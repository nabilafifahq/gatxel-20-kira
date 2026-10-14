import 'server-only'
import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import { createRng, MINI_PAPER_MINUTES, type IsoDate } from '@kira/core'
import { MANUAL_TYPES, type Item } from '@kira/content'
import { findContentDir } from '@kira/content/load'
import { loadPrograms } from '@kira/content/extras'
import { programPosition, type Program } from '@kira/content/programs'
import { tables } from '@kira/db'
import type { Subject } from '@/lib/dto'
import { inOrg, type Tx } from '../db'
import { content, skillsFor } from './content'
import { paperPresetFor } from './daily-paper-scoring'
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

export async function pickDailyPaper(ctx: DailyPaperCtx, subject: Subject, date: string, kind: 'mini' | 'full'): Promise<DailyPaper | null> {
  // Jenis ditentukan pemanggil (sesi harian): Sabtu satu mapel bergiliran meminta paper penuh, dua lainnya tetap mini.
  const effective: 'mini' | 'full' = kind
  return inOrg({ orgId: ctx.orgId, userId: ctx.learnerId, role: 'learner' }, async (tx) => {
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
      const made = assembleKiraPaper(await kiraPool(tx, ctx.orgId, subject, ctx.grade), effective === 'full' ? fullCount : MINI_COUNT, picks, rng)
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
  })
}
