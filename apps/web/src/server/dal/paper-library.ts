import 'server-only'
import { and, desc, eq, gte, inArray, isNull } from 'drizzle-orm'
import { findContentDir } from '@kira/content/load'
import { loadMedals } from '@kira/content/extras'
import { medalFor, medalLine, type MedalEntry } from '@kira/content/medals'
import { tables } from '@kira/db'
import type { Subject } from '@/lib/dto'
import type { MedalRowDTO, PaperLibraryDTO, PaperLibraryRowDTO, PaperPickRowDTO } from '@/lib/dto-paper'
import type { Actor } from '../auth/actor'
import { orgCtx } from '../auth/actor'
import type { OrgContext, Tx } from '../db'
import { inOrg } from '../db'
import { shellIn } from './console-shell'
import { kiraPool } from './daily-paper'
import { minutesFor, paperTitle } from './paper-picker-logic'

/**
 * Pustaka paper (rencana 10): satu baris `paper_library` per paket impor yang diberi data paper
 * (lomba, tahun, bagian). Baris dibuat dan diperbarui saat soal paket disetujui atau data paper diubah.
 */

const { paperLibrary, paperPick, attempt } = tables

export type BatchMeta = { competition: string | null; year: number | null; section: string | null; originalMinutes: number | null; source: string | null }

export const SOURCE_UPLOAD_LABEL = 'unggahan tutor'
export const MIN_LIBRARY_ITEMS = 3

/** "Bagian A" menjadi "A", kosong atau "paper penuh" menjadi "penuh". */
export function normalizeSection(raw: string | null | undefined): string {
  const t = (raw ?? '').trim().replace(/^(bagian|part|section|sesi|babak)\s*/i, '')
  if (!t || /^(penuh|full|semua|lengkap|utuh)/i.test(t)) return 'penuh'
  const code = t.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase()
  return code || 'penuh'
}

export type LibrarySync = { id: string; subject: Subject; grade: number; createdBy: string; meta: BatchMeta; refs: string[] }

/**
 * Samakan baris pustaka dengan paket impor: dibuat atau diperbarui bila paket punya data paper dan sedikitnya
 * MIN_LIBRARY_ITEMS soal yang sudah disetujui, dihapus bila datanya dikosongkan atau soalnya kurang.
 */
export async function syncLibraryEntryTx(tx: Tx, ctx: OrgContext, b: LibrarySync): Promise<void> {
  const hasMeta = Boolean(b.meta.competition || b.meta.year || (b.meta.section && b.meta.section.trim()))
  const [existing] = await tx.select({ id: paperLibrary.id }).from(paperLibrary).where(eq(paperLibrary.importBatchId, b.id)).limit(1)
  if (!hasMeta || b.refs.length < MIN_LIBRARY_ITEMS) {
    if (existing) await tx.delete(paperLibrary).where(eq(paperLibrary.id, existing.id))
    return
  }
  const section = normalizeSection(b.meta.section)
  const minutes = Math.min(300, Math.max(1, b.meta.originalMinutes ?? minutesFor(b.refs.length)))
  const values = {
    origin: 'official' as const,
    competition: b.meta.competition,
    year: b.meta.year,
    subject: b.subject,
    grade: b.grade,
    section,
    title: paperTitle({ competition: b.meta.competition, year: b.meta.year, grade: b.grade, section }),
    minutes,
    source: b.meta.source?.trim() || SOURCE_UPLOAD_LABEL,
    itemRefs: b.refs,
    updatedAt: new Date(),
  }
  if (existing) await tx.update(paperLibrary).set(values).where(eq(paperLibrary.id, existing.id))
  else await tx.insert(paperLibrary).values({ orgId: ctx.orgId, importBatchId: b.id, createdBy: b.createdBy, ...values })
}

let medalCache: MedalEntry[] | null = null
export function medalEntries(): MedalEntry[] {
  medalCache ??= loadMedals(findContentDir()).entries
  return medalCache
}

const SUBJECTS: readonly Subject[] = ['math', 'english', 'science']

export async function paperLibraryDTO(actor: Actor, learnerParam: string | null): Promise<PaperLibraryDTO> {
  return inOrg(orgCtx(actor), async (tx) => {
    const { shell, learner } = await shellIn(tx, actor, learnerParam)
    const rows = await tx.select().from(paperLibrary).where(isNull(paperLibrary.retiredAt)).orderBy(desc(paperLibrary.year), desc(paperLibrary.createdAt)).limit(300)
    const picks = learner
      ? await tx.select().from(paperPick).where(eq(paperPick.learnerId, learner.id)).orderBy(desc(paperPick.date), desc(paperPick.createdAt)).limit(30)
      : []
    const seenRefs = new Set(picks.flatMap((p) => p.itemRefs))
    const entries: PaperLibraryRowDTO[] = rows.map((r) => ({
      id: r.id,
      title: r.title,
      subject: r.subject,
      grade: r.grade,
      competition: r.competition,
      year: r.year,
      section: r.section,
      minutes: r.minutes,
      items: r.itemRefs.length,
      source: r.source,
      picked: r.itemRefs.length > 0 && r.itemRefs.filter((x) => seenRefs.has(x)).length / r.itemRefs.length >= 0.5,
    }))

    // Hasil paper: attempt learner yang soalnya persis sama dengan pilihan.
    const results = new Map<string, { raw: number; max: number }>()
    if (learner && picks.length > 0) {
      const since = new Date(Date.parse(`${picks[picks.length - 1]!.date}T00:00:00+07:00`))
      const attempts = await tx
        .select({ items: attempt.items, raw: attempt.scoreRaw, max: attempt.scoreMax, status: attempt.status })
        .from(attempt)
        .where(and(eq(attempt.learnerId, learner.id), gte(attempt.startedAt, since), inArray(attempt.status, ['submitted', 'graded'])))
        .orderBy(desc(attempt.startedAt))
        .limit(400)
      for (const a of attempts) {
        if (a.raw === null || a.max === null || !Array.isArray(a.items)) continue
        const key = (a.items as { ref?: string }[]).map((i) => i.ref ?? '').join('|')
        if (!results.has(key)) results.set(key, { raw: a.raw, max: a.max })
      }
    }
    const pickRows: PaperPickRowDTO[] = picks.map((p) => {
      const res = results.get(p.itemRefs.join('|'))
      const medal = res && p.competition ? medalFor(medalEntries(), { competition: p.competition, year: p.year, grade: learner!.grade, raw: res.raw, max: res.max }) : null
      return {
        id: p.id,
        date: p.date,
        subject: p.subject,
        kind: p.kind,
        title: p.title,
        minutes: p.minutes,
        origin: p.origin,
        result: res ? `${Math.round(res.raw)} dari ${Math.round(res.max)} benar` : null,
        medal: medal ? medalLine(medal) : null,
      }
    })

    const kiraMade = learner
      ? await Promise.all(SUBJECTS.map(async (subject) => ({ subject, items: (await kiraPool(tx, actor.orgId, subject, learner.grade)).length })))
      : []
    const medals: MedalRowDTO[] = medalEntries().map((m) => ({
      competition: m.competition,
      year: m.year,
      grades: m.grades.length ? m.grades.map((g) => `Grade ${g}`).join(', ') : 'Semua grade',
      bands: m.bands.map((b) => `${b.name} ${b.min}${m.unit === 'percent' ? ' persen' : ` dari ${m.max} poin`}`).join(', '),
      verified: m.verified,
      source: m.source,
    }))
    return { shell, learner: learner ? { id: learner.id, name: learner.name, grade: learner.grade } : null, entries, kiraMade, picks: pickRows, medals }
  })
}
