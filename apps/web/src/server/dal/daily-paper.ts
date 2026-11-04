import 'server-only'
import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import { createRng, MINI_PAPER_MINUTES, type IsoDate } from '@kira/core'
import { MANUAL_TYPES, type Item } from '@kira/content'
import { findContentDir } from '@kira/content/load'
import { MANIPULATIVE_GEN_LEVELS } from '@kira/content/manip'
import { GENERATORS, genRef, instanceSignature, newSeed, type Level } from '@kira/content/math'
import { loadPrograms } from '@kira/content/extras'
import { programPosition, type Program } from '@kira/content/programs'
import { tables } from '@kira/db'
import type { Subject } from '@/lib/dto'
import type { Tx } from '../db'
import { content, skillsFor } from './content'
import { paperPresetFor } from './daily-paper-scoring'
import { recentGeneratedContent, recentSeen } from './learner-core'
import {
  assembleKiraPaper,
  choosePaper,
  fullCandidates,
  FULL_COUNT,
  KIRA_MADE_LABEL_EN,
  miniCandidates,
  MINI_COUNT,
  type LibraryEntry,
  type PickRecord,
  type PoolItem,
} from './paper-picker-logic'

/**
 * Paper harian (rencana 10.4 dan 10.5). Satu pilihan per learner, tanggal, mapel, dan jenis (mini atau full):
 * pilihan pertama disimpan di `paper_pick`, jadi memanggil lagi di hari yang sama mengembalikan paper yang sama,
 * dan bagian yang sudah keluar tidak dipilih lagi. Lihat paper-picker-logic.ts untuk aturan pemilihan.
 *
 * Tanda tangan ini disepakati dengan agen "harian" (Today): `source` adalah label en-GB untuk layar learner,
 * misalnya "Real contest paper" atau "Kira-made contest-style paper".
 */

export type DailyPaperCtx = { orgId: string; learnerId: string; grade: number }
export type DailyPaper = { title: string; minutes: number; itemRefs: string[]; source: string }
export const REAL_PAPER_LABEL_EN = 'Real contest paper'

const { paperLibrary, paperPick, orgItem, programRun } = tables

type PickRow = typeof paperPick.$inferSelect

function toResult(r: Pick<PickRow, 'title' | 'minutes' | 'itemRefs' | 'source'>): DailyPaper {
  return { title: r.title, minutes: r.minutes, itemRefs: [...r.itemRefs], source: r.source }
}

let programCache: Program[] | null = null
function programs(): Program[] {
  programCache ??= loadPrograms(findContentDir()).programs
  return programCache
}

/** Rentang durasi simulasi bila tanggal ini Sabtu simulasi di program olimpiade yang sedang jalan untuk mapel ini. */
export async function simulationWindow(tx: Tx, learnerId: string, subject: Subject, date: IsoDate): Promise<{ min: number; max: number } | null> {
  const runs = await tx
    .select({ programId: programRun.programId, startDate: programRun.startDate })
    .from(programRun)
    .where(and(eq(programRun.learnerId, learnerId), eq(programRun.status, 'active')))
  for (const r of runs) {
    const prog = programs().find((p) => p.id === r.programId)
    if (!prog || prog.subject !== subject) continue
    const pos = programPosition(prog, r.startDate, date)
    if (pos?.simulationSaturday) return { min: prog.simulation.minMinutes, max: prog.simulation.maxMinutes }
  }
  return null
}

/** Mapel dengan program olimpiade aktif yang tanggal ini jatuh di hari ringan (taper) sebelum lomba. */
export async function taperSubjects(tx: Tx, learnerId: string, date: IsoDate): Promise<Set<Subject>> {
  const runs = await tx
    .select({ programId: programRun.programId, startDate: programRun.startDate })
    .from(programRun)
    .where(and(eq(programRun.learnerId, learnerId), eq(programRun.status, 'active')))
  const out = new Set<Subject>()
  for (const r of runs) {
    const prog = programs().find((p) => p.id === r.programId)
    if (prog && programPosition(prog, r.startDate, date)?.taper) out.add(prog.subject as Subject)
  }
  return out
}

/** Skill yang dipakai paper buatan Kira: strand olimpiade untuk Math, skill yang ditandai lomba untuk English dan Science. */
function contestSkillIds(subject: Subject, grade: number): Set<string> {
  const skills = skillsFor(subject, grade)
  const picked = subject === 'math' ? skills.filter((s) => s.strand === 'Oly') : skills.filter((s) => s.competitions.length > 0)
  return new Set(picked.map((s) => s.id))
}

function usable(item: { type: Item['type']; lang?: string }): boolean {
  return !MANUAL_TYPES.includes(item.type) && item.lang !== 'id'
}

/** Soal generator Math kelas ini di tingkat tersulit, satu per skill, untuk paper saat bank olimpiade (76 sampai 412 soal per kelas) habis. */
function mathSpare(grade: number, need: number, rng: ReturnType<typeof createRng>, taken: Set<string>): PoolItem[] {
  const skills = rng.shuffle([...GENERATORS.entries()].filter(([id]) => id.startsWith(`m${grade}.`)))
  const out: PoolItem[] = []
  for (let round = 0; out.length < need && round < 4; round++) {
    for (const [id, gen] of skills) {
      if (out.length >= need) break
      const levels = gen.levels.filter((l) => !MANIPULATIVE_GEN_LEVELS.has(`${id}:${l}`))
      const level = levels[levels.length - 1] as Level | undefined
      if (level === undefined) continue
      // Isi yang sudah keluar dilewati: generator bersempit (misalnya sisi kubus) tidak mengulang soal yang sama.
      for (let tries = 0; tries < 12; tries++) {
        const ref = genRef(id, level, newSeed(rng))
        const sig = instanceSignature(ref)
        if (taken.has(sig)) continue
        taken.add(sig)
        out.push({ ref, skillId: id, difficulty: level })
        break
      }
    }
  }
  return out
}

/** Soal tertulis kelas ini di luar skill lomba yang belum pernah keluar, untuk English dan Science saat bank lomba habis. */
function writtenSpare(subject: Subject, grade: number, need: number, rng: ReturnType<typeof createRng>, seen: ReadonlySet<string>): PoolItem[] {
  const contest = contestSkillIds(subject, grade)
  const out: PoolItem[] = []
  for (const s of rng.shuffle(skillsFor(subject, grade).filter((x) => !contest.has(x.id)))) {
    const fresh = (content().itemsBySkill.get(s.id) ?? []).filter((item) => usable(item) && !seen.has(item.id))
    for (const item of rng.shuffle([...fresh]).slice(0, 3)) {
      if (out.length >= need) return out
      out.push({ ref: item.id, skillId: s.id, difficulty: item.difficulty })
    }
  }
  return out
}

/** Soal olimpiade di repo dan draf AI atau tulisan tutor yang sudah disetujui (org_item), untuk satu mapel dan grade. */
export async function kiraPool(tx: Tx, orgId: string, subject: Subject, grade: number): Promise<PoolItem[]> {
  const skillIds = contestSkillIds(subject, grade)
  const pool: PoolItem[] = []
  for (const id of skillIds) {
    for (const item of content().itemsBySkill.get(id) ?? []) if (usable(item)) pool.push({ ref: item.id, skillId: id, difficulty: item.difficulty })
  }
  if (skillIds.size > 0) {
    const rows = await tx
      .select({ id: orgItem.id, skillId: orgItem.skillId, body: orgItem.body })
      .from(orgItem)
      .where(and(eq(orgItem.orgId, orgId), eq(orgItem.subject, subject), eq(orgItem.grade, grade), isNull(orgItem.retiredAt), inArray(orgItem.source, ['ai-draft', 'tutor'])))
    for (const r of rows) {
      if (!skillIds.has(r.skillId)) continue
      const body = r.body as { type?: Item['type']; lang?: string; difficulty?: number }
      if (!body.type || !usable({ type: body.type, ...(body.lang ? { lang: body.lang } : {}) })) continue
      pool.push({ ref: `org:${r.id}`, skillId: r.skillId, difficulty: body.difficulty ?? 3 })
    }
  }
  return pool
}

/**
 * Berjalan di dalam transaksi pemanggil (`tx` sudah withOrg untuk org dan learner ini), jadi tidak membuka koneksi
 * kedua dan pilihan ikut batal bersama transaksi sesi harian bila ada yang gagal.
 */
export async function pickDailyPaper(tx: Tx, ctx: DailyPaperCtx, subject: Subject, date: string, kind: 'mini' | 'full'): Promise<DailyPaper | null> {
  // Jenis ditentukan pemanggil (sesi harian): Sabtu satu mapel bergiliran meminta paper penuh, dua lainnya tetap mini.
  const effective: 'mini' | 'full' = kind
  const same = and(eq(paperPick.learnerId, ctx.learnerId), eq(paperPick.date, date), eq(paperPick.subject, subject), eq(paperPick.kind, effective))
  const [existing] = await tx.select().from(paperPick).where(same).limit(1)
  if (existing) return toResult(existing)

  const rows = await tx
    .select()
    .from(paperLibrary)
    .where(and(eq(paperLibrary.orgId, ctx.orgId), eq(paperLibrary.subject, subject), eq(paperLibrary.grade, ctx.grade), isNull(paperLibrary.retiredAt)))
  const entries: LibraryEntry[] = rows.map((r) => ({
    id: r.id, competition: r.competition, year: r.year, subject: r.subject, grade: r.grade, section: r.section, title: r.title, minutes: r.minutes, source: r.source, itemRefs: r.itemRefs,
  }))
  const history = await tx
    .select({ competition: paperPick.competition, year: paperPick.year, date: paperPick.date, itemRefs: paperPick.itemRefs })
    .from(paperPick)
    .where(and(eq(paperPick.learnerId, ctx.learnerId), eq(paperPick.subject, subject)))
    .orderBy(desc(paperPick.date))
    .limit(300)
  const picks: PickRecord[] = history

  const window = effective === 'full' ? await simulationWindow(tx, ctx.learnerId, subject, date) : null
  const official = choosePaper(effective === 'full' ? fullCandidates(entries) : miniCandidates(entries), picks, { window })

  let chosen: Omit<typeof paperPick.$inferInsert, 'orgId' | 'learnerId' | 'date' | 'subject' | 'kind'> | null = null
  if (official) {
    chosen = { libraryId: official.libraryId, origin: 'official', competition: official.competition, year: official.year, title: official.title, minutes: official.minutes, source: REAL_PAPER_LABEL_EN, itemRefs: official.itemRefs }
  } else {
    const rng = createRng(`${ctx.learnerId}:${date}:${subject}:${effective}`)
    // Paper penuh buatan Kira meniru lomba yang bergiliran hari itu: jumlah soal dan waktunya mengikuti preset, supaya
    // penilaian preset (daily-paper-scoring) pas. Tanpa preset: FULL_COUNT soal dengan 1,5 menit per soal.
    const contest = effective === 'full' ? paperPresetFor(subject, ctx.grade, date) : undefined
    const fullCount = contest?.rules.questionCount ?? FULL_COUNT
    // Soal yang sudah dijawab di sesi lain juga dihitung sudah dilihat, supaya paper tidak mengulang soal Latihan atau Tes.
    const seen = await recentSeen(tx, ctx.learnerId)
    const answered: PickRecord = { competition: null, year: null, date, itemRefs: [...seen.keys()] }
    const made = assembleKiraPaper(
      await kiraPool(tx, ctx.orgId, subject, ctx.grade),
      effective === 'full' ? fullCount : MINI_COUNT,
      [...picks, answered],
      rng,
      (need) => (subject === 'math' ? mathSpare(ctx.grade, need, rng, recentGeneratedContent(seen)) : writtenSpare(subject, ctx.grade, need, rng, new Set([...picks.flatMap((p) => p.itemRefs), ...seen.keys()]))),
    )
    if (made) {
      const title = effective === 'full' ? 'Kira contest-style full paper' : 'Kira contest-style mini paper'
      const minutes = effective === 'mini' ? MINI_PAPER_MINUTES : contest && made.refs.length >= fullCount ? contest.rules.timeLimitMin : made.minutes
      chosen = { libraryId: null, origin: 'kira-made', competition: null, year: null, title, minutes, source: KIRA_MADE_LABEL_EN, itemRefs: made.refs }
    }
  }
  if (!chosen) return null

  await tx.insert(paperPick).values({ orgId: ctx.orgId, learnerId: ctx.learnerId, date, subject, kind: effective, ...chosen }).onConflictDoNothing()
  // Dua permintaan serentak: yang kalah membaca pilihan pemenang supaya hasilnya sama.
  const [row] = await tx.select().from(paperPick).where(same).limit(1)
  return row ? toResult(row) : null
}
