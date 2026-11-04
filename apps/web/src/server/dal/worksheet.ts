import 'server-only'
import { and, count, eq, sql } from 'drizzle-orm'
import { jakartaDate } from '@kira/core'
import { answerText, isPaperType, type Item } from '@kira/content'
import { GENERATORS, genRef, instanceSignature } from '@kira/content/math'
import { tables } from '@kira/db'
import type { PrintPaperDTO, Subject } from '@/lib/dto'
import type { WorksheetLength, WorksheetPageDTO, WorksheetSkillOption } from '@/lib/dto-coach'
import type { Actor } from '../auth/actor'
import { withFamilyAdmin } from '../auth/parent'
import type { Tx } from '../db'
import { invalid, notFound } from '../errors'
import { chooseChild, linkedChildren } from './coach'
import { presentForConsole } from './console-bank'
import { SUBJECT_ID_LABEL, SUBJECT_ORDER } from './console-common'
import { content, poolForSkill, resolveItems, skill } from './content'
import { loadLearner } from './learner-core'
import { paperInstructions } from './print'
import { chooseWorksheetRefs, normalizePrompt, WORKSHEET_LENGTHS, WORKSHEET_PER_DAY, type StaticCandidate } from './worksheet-logic'

/**
 * Lembar kerja untuk dicetak orang tua. Catatan lembar (tabel worksheet, migrasi 0022) menyimpan skill, panjang, dan
 * id yang menjadi seed, jadi soal lembar dan kuncinya selalu sama dan membuka ulang tidak memakai jatah harian.
 * Soal berasal dari bank repo dan generator yang sudah ada, tanpa layanan luar.
 */

const { worksheet, skillState } = tables

const MIN_SKILL_ITEMS = 6

function lengthCount(id: WorksheetLength): number {
  return WORKSHEET_LENGTHS.find((l) => l.id === id)!.count
}

/** Soal cetak yang tersedia untuk satu skill: soal repo bertipe kertas dan generator. */
function availableFor(skillId: string): number {
  if (GENERATORS.has(skillId)) return 999
  return (content().itemsBySkill.get(skillId) ?? []).filter((i) => isPaperType(i.type) && i.lang !== 'id').length
}

export async function usedToday(tx: Tx, orgId: string, day: string): Promise<number> {
  const [r] = await tx.select({ n: count() }).from(worksheet).where(and(eq(worksheet.orgId, orgId), eq(worksheet.day, day)))
  return Number(r?.n ?? 0)
}

export async function worksheetPageDTO(actor: Actor, learnerParam: string | null): Promise<WorksheetPageDTO> {
  const today = jakartaDate()
  return withFamilyAdmin(actor, async (tx, scope) => {
    const children = await linkedChildren(tx)
    const child = chooseChild(children, learnerParam)
    const limit = { perDay: WORKSHEET_PER_DAY, usedToday: await usedToday(tx, actor.orgId, today) }
    const lengths = WORKSHEET_LENGTHS.map((l) => ({ id: l.id as WorksheetLength, label: l.label, count: l.count }))
    if (!child) return { children, selectedId: null, skills: [], limit, lengths }
    await scope.assertParentOf(child.id)
    const skills: WorksheetSkillOption[] = []
    for (const s of content().skills.values()) {
      if (s.strand === 'Oly') continue
      if (s.grade > child.grade || s.grade < Math.max(1, child.grade - 1)) continue
      const available = availableFor(s.id)
      if (available < MIN_SKILL_ITEMS) continue
      skills.push({ id: s.id, subject: s.subject, title: s.title, titleId: s.titleId, grade: s.grade, available })
    }
    skills.sort((a, b) => SUBJECT_ORDER.indexOf(a.subject) - SUBJECT_ORDER.indexOf(b.subject) || b.grade - a.grade || a.title.localeCompare(b.title))
    return { children, selectedId: child.id, skills, limit, lengths }
  })
}

async function pickRefs(tx: Tx, orgId: string, learnerId: string, skillId: string, n: number, seed: string): Promise<{ ref: string; difficulty: number }[]> {
  const pool = await poolForSkill(tx, orgId, skillId, { allowManual: false, paperOnly: true })
  const fixed = pool.filter((p) => !p.unlimited)
  const resolved = await resolveItems(tx, fixed.map((p) => p.ref))
  const statics: StaticCandidate[] = []
  for (const p of fixed) {
    const item = resolved.get(p.ref)
    if (!item) continue
    statics.push({ ref: p.ref, difficulty: p.difficulty, sig: normalizePrompt(item.prompt) })
  }
  const [st] = await tx
    .select({ stars: skillState.stars })
    .from(skillState)
    .where(and(eq(skillState.learnerId, learnerId), eq(skillState.skillId, skillId)))
    .limit(1)
  const gen = GENERATORS.get(skillId)
  return chooseWorksheetRefs({
    count: n,
    stars: st?.stars ?? 0,
    seed,
    statics,
    gen: gen ? { skillId, levels: gen.levels } : null,
    genRef: (s, level, sd) => genRef(s, level as 1 | 2 | 3 | 4 | 5, sd),
    genSig: (ref) => instanceSignature(ref),
  })
}

/** Buat catatan lembar. Batas harian per keluarga dihitung di transaksi yang sama dengan penulisan. */
export async function createWorksheet(actor: Actor, input: { learnerId: string; skillId: string; length: WorksheetLength }): Promise<{ id: string }> {
  const today = jakartaDate()
  return withFamilyAdmin(actor, async (tx, scope) => {
    await scope.assertParentOf(input.learnerId)
    const learner = await loadLearner(tx, input.learnerId)
    const s = skill(input.skillId)
    if (!s || s.strand === 'Oly') throw notFound('Skill ini tidak ditemukan. Muat ulang halaman lalu pilih lagi.')
    const n = lengthCount(input.length)
    if (availableFor(s.id) < MIN_SKILL_ITEMS) throw invalid('Skill ini belum punya cukup soal cetak. Pilih skill lain.')
    // Hitung dan tulis di bawah kunci per keluarga: permintaan serentak tidak melewati batas harian.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'worksheet:' + actor.orgId}))`)
    if ((await usedToday(tx, actor.orgId, today)) >= WORKSHEET_PER_DAY) {
      throw invalid(`Batas ${WORKSHEET_PER_DAY} lembar per hari untuk keluarga ini sudah tercapai. Coba lagi besok, atau cetak ulang lembar yang sudah dibuat.`)
    }
    const [row] = await tx
      .insert(worksheet)
      .values({ orgId: actor.orgId, learnerId: learner.userId, createdBy: actor.userId, subject: s.subject, skillId: s.id, itemCount: n, day: today })
      .returning({ id: worksheet.id })
    const picked = await pickRefs(tx, actor.orgId, learner.userId, s.id, n, row!.id)
    if (picked.length < Math.min(n, 5)) throw invalid('Soal untuk skill ini belum cukup untuk satu lembar. Pilih skill lain atau lembar yang lebih pendek.')
    return { id: row!.id }
  })
}

type Q = PrintPaperDTO['sections'][number]['items'][number]

/** Lembar atau kunci untuk dicetak. Isi soal dibangun ulang dari seed, jadi lembar dan kuncinya selalu cocok. */
export async function worksheetPrintDTO(actor: Actor, id: string, withKey: boolean): Promise<PrintPaperDTO> {
  return withFamilyAdmin(actor, async (tx, scope) => {
    const [w] = await tx.select().from(worksheet).where(eq(worksheet.id, id)).limit(1)
    if (!w) throw notFound('Lembar kerja tidak ditemukan.')
    await scope.assertParentOf(w.learnerId)
    const learner = await loadLearner(tx, w.learnerId)
    const s = skill(w.skillId)
    if (!s) throw notFound('Skill untuk lembar ini tidak ada lagi.')
    const picked = await pickRefs(tx, actor.orgId, w.learnerId, w.skillId, w.itemCount, w.id)
    const resolved = await resolveItems(tx, picked.map((p) => p.ref))
    const items: Q[] = []
    for (const p of picked) {
      const item: Item | undefined = resolved.get(p.ref)
      if (!item) continue
      const shown = presentForConsole(item, { ref: p.ref, seed: w.id, withKey: false })
      items.push({ number: items.length + 1, item: shown, ...(withKey ? { answerText: answerText(item), explanation: item.explanation } : {}) })
    }
    const minutes = Math.max(5, Math.ceil(items.length * 1.5))
    const working = w.subject === 'math' && items.some((q) => ['numeric', 'clock', 'numberline', 'fraction'].includes(q.item.type))
    return {
      code: `LK-${w.id.slice(0, 4).toUpperCase()}`,
      title: s.title,
      subject: w.subject as Subject,
      subjectLabel: SUBJECT_ID_LABEL[w.subject as Subject],
      grade: s.grade,
      minutes,
      instructions: paperInstructions('latihan', minutes, { working }),
      learnerName: learner.name,
      date: null,
      sections: [{ title: '', items }],
      withKey,
      cheer: 'Take your time. Every try helps you learn.',
      ...(withKey ? { keyLabel: 'Kunci jawaban, untuk orang tua' } : {}),
    }
  })
}
