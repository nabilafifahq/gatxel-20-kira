import 'server-only'
import { eq } from 'drizzle-orm'
import { modeAllowsHints, modeShowsFeedback, type Mode } from '@kira/core'
import { tables } from '@kira/db'
import type { SolutionStep } from '@kira/content/schema'
import { clashKeys, type Item } from '@kira/content'
import type { RunnerItem } from '@/lib/dto'
import type { Tx } from '../db'
import { invalid, notFound } from '../errors'
import { lesson, poolForSkill, resolveItems, toClient } from './content'
import { pickSibling } from './remedial-logic'
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

export type RemedialLesson = { title: string; steps: SolutionStep[] }

type Guarded = { a: Awaited<ReturnType<typeof loadAttempt>>; slot: AttemptItem; all: AttemptItem[] }

/** Syarat: attempt milik learner dan masih jalan, mode latihan, soalnya sudah dijawab salah, dan bukan soal saudara. */
async function guard(tx: Tx, learnerId: string, attemptId: string, position: number): Promise<Guarded> {
  const a = await loadAttempt(tx, learnerId, attemptId)
  if (a.status !== 'in_progress') throw invalid('This quest is already handed in.')
  if (!modeShowsFeedback(a.mode as Mode) || ['tes', 'simulasi', 'kertas', 'kilat'].includes(a.mode)) throw invalid('Extra help is for practice only.')
  const all = (a.items as AttemptItem[]) ?? []
  const slot = all.find((i) => i.position === position)
  if (!slot) throw notFound('That question is not in this quest.')
  if (slot.remedialOf !== undefined) throw invalid('This question is already the extra one.')
  const rows = await tx.select().from(response).where(eq(response.attemptId, a.id))
  const latest = latestByPosition(rows).get(position)
  if (!latest || latest.status !== 'wrong') throw invalid('Extra help opens after a question is missed.')
  return { a, slot, all }
}

/** Satu langkah pelajaran dari skill soal (paling banyak tiga langkah pertama). Null bila skill belum punya pelajaran. */
export async function remedialLesson(tx: Tx, learnerId: string, attemptId: string, position: number): Promise<RemedialLesson | null> {
  const { slot } = await guard(tx, learnerId, attemptId, position)
  const item = (await resolveItems(tx, [slot.ref])).get(slot.ref)
  if (!item) return null
  const l = lesson(item.skill)
  if (!l) return null
  return { title: l.title, steps: l.steps.slice(0, 3) }
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
export async function walkthroughFor(tx: Tx, learnerId: string, attemptId: string, position: number): Promise<SolutionStep[] | null> {
  const a = await loadAttempt(tx, learnerId, attemptId)
  const all = (a.items as AttemptItem[]) ?? []
  const slot = all.find((i) => i.position === position)
  if (!slot) throw notFound('That question is not in this quest.')
  if (a.status === 'in_progress') {
    const hidden = ['tes', 'simulasi', 'kertas'].includes(a.mode)
    if (hidden || !modeShowsFeedback(a.mode as Mode) || a.mode === 'kilat') throw invalid('The steps open after you hand in.')
    const rows = await tx.select().from(response).where(eq(response.attemptId, a.id))
    if (!latestByPosition(rows).has(position)) throw invalid('Answer the question first.')
  }
  const item = (await resolveItems(tx, [slot.ref])).get(slot.ref)
  return item?.solution ?? null
}
