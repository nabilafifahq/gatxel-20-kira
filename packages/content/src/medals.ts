import { z } from 'zod'
import { grade } from './schema'

/**
 * Batas medali per lomba dan tahun (rencana 10.5), dari content/competitions/medals.json.
 * Hanya angka yang diketahui dan punya sumber; lomba tanpa data tidak dibandingkan.
 * `min` dalam persen dari nilai penuh (unit percent) atau dalam poin (unit points, butuh max).
 */

const band = z.object({ name: z.string().trim().min(1).max(30), min: z.number().min(0).max(1000) }).strict()

export const medalEntrySchema = z
  .object({
    competition: z.string().regex(/^[a-z0-9-]+$/),
    year: z.number().int().min(2015).max(2035),
    grades: z.array(grade).max(6).default([]),
    unit: z.enum(['percent', 'points']),
    /** Nilai penuh, wajib bila unit points. */
    max: z.number().positive().max(1000).optional(),
    /** Dari tertinggi ke terendah, misalnya Emas, Perak, Perunggu. */
    bands: z.array(band).min(1).max(6),
    source: z.string().url(),
    verified: z.boolean(),
    note: z.string().trim().min(1).max(200).optional(),
  })
  .strict()
  .superRefine((e, ctx) => {
    if (e.unit === 'points' && e.max === undefined) ctx.addIssue({ code: 'custom', message: 'unit points butuh max', path: ['max'] })
    for (let i = 1; i < e.bands.length; i++) {
      if (e.bands[i]!.min > e.bands[i - 1]!.min) ctx.addIssue({ code: 'custom', message: 'bands harus urut dari tertinggi', path: ['bands', i] })
    }
  })
export type MedalEntry = z.infer<typeof medalEntrySchema>

export const medalFileSchema = z.object({ entries: z.array(medalEntrySchema).max(500) }).strict()

export type MedalResult = {
  entry: MedalEntry
  /** Medali tertinggi yang tercapai, atau null bila di bawah semua batas. */
  reached: string | null
  /** Medali berikutnya dan kekurangannya dalam persen nilai penuh. */
  next: { name: string; missingPct: number } | null
}

export function entryFor(entries: readonly MedalEntry[], q: { competition: string; year: number | null; grade: number }): MedalEntry | null {
  const same = entries.filter((e) => e.competition === q.competition && (e.grades.length === 0 || e.grades.includes(q.grade)))
  if (same.length === 0) return null
  if (q.year !== null) {
    const exact = same.find((e) => e.year === q.year)
    if (exact) return exact
  }
  return null
}

/** Bandingkan nilai dengan batas medali. Null bila lomba, tahun, atau kelas itu belum punya data. */
export function medalFor(
  entries: readonly MedalEntry[],
  q: { competition: string; year: number | null; grade: number; raw: number; max: number },
): MedalResult | null {
  const entry = entryFor(entries, q)
  if (!entry || q.max <= 0) return null
  const pct = (100 * q.raw) / q.max
  const need = (b: { min: number }) => (entry.unit === 'percent' ? b.min : (100 * b.min) / (entry.max ?? 1))
  let reached: string | null = null
  let next: MedalResult['next'] = null
  for (const b of entry.bands) {
    if (pct >= need(b)) {
      reached = b.name
      break
    }
    next = { name: b.name, missingPct: Math.round((need(b) - pct) * 10) / 10 }
  }
  return { entry, reached, next }
}

export function medalLine(r: MedalResult): string {
  if (r.reached) return r.next ? `Mencapai ${r.reached}. ${r.next.name} kurang ${String(r.next.missingPct).replace('.', ',')} persen lagi.` : `Mencapai ${r.reached}.`
  return r.next ? `Belum mencapai batas medali. ${r.next.name} kurang ${String(r.next.missingPct).replace('.', ',')} persen lagi.` : 'Belum mencapai batas medali.'
}
