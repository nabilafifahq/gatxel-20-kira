import 'server-only'
import { eq } from 'drizzle-orm'
import { modeAllowsHints, modeShowsFeedback, type Mode } from '@kira/core'
import { tables } from '@kira/db'
import { clashKeys, type Item } from '@kira/content'
import { translateSolution, type SolutionStepView } from '@kira/content/walkthrough'
import type { RunnerItem } from '@/lib/dto'
import { getT } from '@/lib/i18n/server'
import type { Tx } from '../db'
import { invalid, notFound } from '../errors'
import { lesson, poolForSkill, resolveItems, toClient } from './content'
import { pickSibling } from './remedial-logic'
import { idText, withSayId } from './translations'
import { latestByPosition, lazySolution, loadAttempt, presentationSeed, type AttemptItem } from './learner-runner'

/**
 * Putaran perbaikan di Latihan. Setelah jawaban salah yang sudah terbuka kuncinya: pembahasan, satu langkah
 * pelajaran dari skill itu, lalu satu soal saudara (skill sama, angka atau soal tulisan lain, tidak kembar
 * dengan isi sesi). Soal saudara baru masuk sesi saat anak mengetuk "Try one like it" (`addRemedialItem`),
 * jadi anak yang melewatinya tidak meninggalkan soal kosong. Soal saudara tidak ikut skor sesi. Bila soal
 * saudara juga salah, skill itu muncul di Fix-it (lihat `openMistakes` di mistake-book.ts).
 * Hanya mode yang menampilkan umpan balik; mode berwaktu tidak pernah lewat sini.
 */

const { attempt, response } = tables

export type RemedialLesson = { title: string; steps: SolutionStepView[] }

type Guarded = { a: Awaited<ReturnType<typeof loadAttempt>>; slot: AttemptItem; all: AttemptItem[] }

/** Pesan error ke anak, hanya dibaca di jalur error. */
const errors = async () => (await getT()).lessons.errors

/** Syarat: attempt milik learner dan masih jalan, mode latihan, soalnya sudah dijawab salah, dan bukan soal saudara. */
async function guard(tx: Tx, learnerId: string, attemptId: string, position: number): Promise<Guarded> {
  const a = await loadAttempt(tx, learnerId, attemptId)
  if (a.status !== 'in_progress') throw invalid((await errors()).questHandedIn)
  if (a.refId?.startsWith('boss:') || !modeShowsFeedback(a.mode as Mode) || ['tes', 'simulasi', 'kertas', 'kilat'].includes(a.mode)) throw invalid((await errors()).extraPracticeOnly)
  const all = (a.items as AttemptItem[]) ?? []
  const slot = all.find((i) => i.position === position)
  if (!slot) throw notFound((await errors()).notInQuest)
  if (slot.remedialOf !== undefined) throw invalid((await errors()).alreadyExtra)
  const rows = await tx.select().from(response).where(eq(response.attemptId, a.id))
  const latest = latestByPosition(rows).get(position)
  if (!latest || latest.status !== 'wrong') throw invalid((await errors()).extraAfterMiss)
  return { a, slot, all }
}

/** Satu langkah pelajaran dari skill soal (paling banyak tiga langkah pertama). Null bila skill belum punya pelajaran. */
export async function remedialLesson(tx: Tx, learnerId: string, attemptId: string, position: number): Promise<RemedialLesson | null> {
  const { slot } = await guard(tx, learnerId, attemptId, position)
  const item = (await resolveItems(tx, [slot.ref])).get(slot.ref)
  if (!item) return null
  const l = lesson(item.skill)
  if (!l) return null
  return { title: l.title, steps: l.steps.slice(0, 3).map(withSayId) }
}

/** Tambahkan soal saudara ke sesi dan kembalikan untuk ditampilkan. Satu soal saudara per soal salah. */
export async function addRemedialItem(tx: Tx, learnerId: string, orgId: string, attemptId: string, position: number): Promise<RunnerItem | null> {
  const { a, slot, all } = await guard(tx, learnerId, attemptId, position)
  const mode = a.mode as Mode
  const render = (entry: AttemptItem, item: Item): RunnerItem => ({
    ...lazySolution(toClient(item, { ref: entry.ref, seed: presentationSeed(a), includeKey: true, includeHints: modeAllowsHints(mode) })),
    position: entry.position,
    section: 'core',
    remedialOf: position,
  })
  const existing = all.find((i) => i.remedialOf === position)
  if (existing) {
    const it = (await resolveItems(tx, [existing.ref])).get(existing.ref)
    return it ? render(existing, it) : null
  }
  const wrong = (await resolveItems(tx, [slot.ref])).get(slot.ref)
  if (!wrong) return null
  const pool = await poolForSkill(tx, orgId, wrong.skill, { allowManual: false })
  // Penjaga soal kembar pusat: soal serupa tidak boleh tampil sama atau berpola operan sama dengan soal yang sudah ada di sesi.
  const present = await resolveItems(tx, all.map((i) => i.ref))
  const taken = new Set<string>()
  for (const it of present.values()) for (const k of clashKeys(it)) taken.add(k)
  const takenRefs = new Set(all.map((i) => i.ref))
  let ref: string | null = null
  let item: Item | undefined
  for (let tries = 0; tries < 8; tries++) {
    const r = pickSibling({ wrong, pool, takenRefs, seed: `${a.id}:${position}:remedial:${tries}` })
    if (!r) break
    const it = (await resolveItems(tx, [r])).get(r)
    if (it && !clashKeys(it).some((k) => taken.has(k))) {
      ref = r
      item = it
      break
    }
    takenRefs.add(r)
  }
  if (!ref || !item) return null
  const entry: AttemptItem = { ref, section: 'core', position: Math.max(...all.map((i) => i.position)) + 1, difficulty: item.difficulty, remedialOf: position }
  await tx.update(attempt).set({ items: [...all, entry] }).where(eq(attempt.id, a.id))
  return render(entry, item)
}

/**
 * Langkah pembahasan satu soal, dimuat malas. Hanya sesudah soal dijawab di mode umpan balik, atau sesudah
 * attempt dikumpulkan (mode berwaktu). Mode berwaktu yang masih berjalan tidak pernah mendapatkannya.
 */
export async function walkthroughFor(tx: Tx, learnerId: string, attemptId: string, position: number): Promise<SolutionStepView[] | null> {
  const a = await loadAttempt(tx, learnerId, attemptId)
  const all = (a.items as AttemptItem[]) ?? []
  const slot = all.find((i) => i.position === position)
  if (!slot) throw notFound((await errors()).notInQuest)
  if (a.status === 'in_progress') {
    const hidden = ['tes', 'simulasi', 'kertas'].includes(a.mode) || (a.refId?.startsWith('boss:') ?? false)
    if (hidden || !modeShowsFeedback(a.mode as Mode) || a.mode === 'kilat') throw invalid((await errors()).stepsAfterHandIn)
    const rows = await tx.select().from(response).where(eq(response.attemptId, a.id))
    if (!latestByPosition(rows).has(position)) throw invalid((await errors()).answerFirst)
  }
  const item = (await resolveItems(tx, [slot.ref])).get(slot.ref)
  return item?.solution ? translateSolution(item, item.solution, idText) : null
}
