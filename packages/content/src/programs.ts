import { z } from 'zod'
import { addDays, daysBetween, weekday, type IsoDate } from '@kira/core'
import { SKILL_ID, subject, grade } from './schema'

/**
 * Program Persiapan Olimpiade (rencana 13.3): 8 minggu per mapel. Tutor memilih tanggal mulai, lalu
 * expandProgram mengisi skill Latihan dan Tes setiap hari sesuai minggu programnya. Data program ada di
 * content/programs/*.json; fungsi di sini murni (tanpa database).
 */

const text = (max: number) => z.string().trim().min(1).max(max)
const skillId = z.string().regex(SKILL_ID)
const count = z.number().int().min(4).max(30)

export const phaseSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    name: text(40),
    /** Minggu program, dari dan sampai (1 sampai 8). */
    weeks: z.tuple([z.number().int().min(1).max(8), z.number().int().min(1).max(8)]),
    focus: text(80),
    summary: text(400),
    /** Skill Latihan, bergiliran per hari program di fase ini. */
    latihan: z.array(skillId).min(1).max(14),
    /** "previous": skill Latihan hari program sebelumnya (diulang berjarak). Selain itu daftar skill bergiliran. */
    tes: z.union([z.literal('previous'), z.array(skillId).min(1).max(14)]),
    latihanQuestions: count,
    tesQuestions: count,
    /** Pesan untuk tutor, misalnya meminta rekaman penjelasan. */
    note: text(300).optional(),
  })
  .strict()
export type ProgramPhase = z.infer<typeof phaseSchema>

export const programSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    title: text(80),
    subject,
    grade,
    competitions: z.array(z.string().regex(/^[a-z0-9-]+$/)).min(1).max(6),
    summary: text(400),
    weeks: z.literal(8),
    phases: z.array(phaseSchema).min(1).max(6),
    /** Hari terakhir: hanya teka-teki ringan, tanpa Tes. */
    taper: z.object({ days: z.number().int().min(1).max(4), skills: z.array(skillId).min(1).max(6), questions: count }).strict(),
    /** Minggu simulasi: Sabtu memakai paper penuh berdurasi minMinutes sampai maxMinutes bila ada. */
    simulation: z.object({ weeks: z.array(z.number().int().min(1).max(8)).min(1).max(4), minMinutes: z.number().int().min(10).max(120), maxMinutes: z.number().int().min(10).max(180) }).strict(),
  })
  .strict()
  .superRefine((p, ctx) => {
    const covered = new Set<number>()
    for (const [i, ph] of p.phases.entries()) {
      if (ph.weeks[0] > ph.weeks[1]) ctx.addIssue({ code: 'custom', message: 'Minggu awal lebih besar dari minggu akhir', path: ['phases', i, 'weeks'] })
      for (let w = ph.weeks[0]; w <= ph.weeks[1]; w++) {
        if (covered.has(w)) ctx.addIssue({ code: 'custom', message: `Minggu ${w} dipakai dua fase`, path: ['phases', i, 'weeks'] })
        covered.add(w)
      }
    }
    for (let w = 1; w <= 8; w++) if (!covered.has(w)) ctx.addIssue({ code: 'custom', message: `Minggu ${w} belum punya fase`, path: ['phases'] })
    if (p.simulation.minMinutes > p.simulation.maxMinutes) ctx.addIssue({ code: 'custom', message: 'minMinutes lebih besar dari maxMinutes', path: ['simulation'] })
  })
export type Program = z.infer<typeof programSchema>

export const PROGRAM_DAYS = 56

export type ProgramSlot = {
  subject: z.infer<typeof subject>
  mode: 'latihan' | 'tes'
  skillId: string
  questionCount: number
}

export type ProgramDay = {
  date: IsoDate
  /** 1 sampai 56. */
  day: number
  week: number
  phaseId: string
  phaseName: string
  /** taper: hari ringan di akhir. simulation: Sabtu di minggu simulasi. */
  kind: 'normal' | 'simulation' | 'taper'
  slots: ProgramSlot[]
  note: string | null
}

export const SATURDAY = 6

/** Isi semua hari program dari tanggal mulai. Hari istirahat disaring oleh pemanggil. */
export function expandProgram(p: Program, start: IsoDate): ProgramDay[] {
  const total = p.weeks * 7
  const out: ProgramDay[] = []
  let prevLatihan: string | null = null
  for (let i = 0; i < total; i++) {
    const date = addDays(start, i)
    const week = Math.floor(i / 7) + 1
    const phase = p.phases.find((ph) => week >= ph.weeks[0] && week <= ph.weeks[1])!
    const phaseStart = (phase.weeks[0] - 1) * 7
    const inTaper = i >= total - p.taper.days
    const isSim = p.simulation.weeks.includes(week) && weekday(date) === SATURDAY && !inTaper
    if (inTaper) {
      const skill = p.taper.skills[(i - (total - p.taper.days)) % p.taper.skills.length]!
      out.push({
        date, day: i + 1, week, phaseId: phase.id, phaseName: phase.name, kind: 'taper',
        slots: [{ subject: p.subject, mode: 'latihan', skillId: skill, questionCount: p.taper.questions }],
        note: 'Hari ringan sebelum lomba: teka-teki santai saja, atau istirahat.',
      })
      prevLatihan = skill
      continue
    }
    const latihan = phase.latihan[(i - phaseStart) % phase.latihan.length]!
    const tes = phase.tes === 'previous' ? (prevLatihan ?? latihan) : phase.tes[(i - phaseStart) % phase.tes.length]!
    const slots: ProgramSlot[] = [
      { subject: p.subject, mode: 'latihan', skillId: latihan, questionCount: phase.latihanQuestions },
      { subject: p.subject, mode: 'tes', skillId: tes, questionCount: phase.tesQuestions },
    ]
    out.push({
      date, day: i + 1, week, phaseId: phase.id, phaseName: phase.name, kind: isSim ? 'simulation' : 'normal', slots,
      note: isSim ? `Simulasi bertimer ${p.simulation.minMinutes} sampai ${p.simulation.maxMinutes} menit dari paper asli (Paper hari Sabtu).` : (phase.note ?? null),
    })
    prevLatihan = latihan
  }
  return out
}

/** Posisi tanggal di dalam program, atau null bila di luar 8 minggu. */
export function programPosition(p: Program, start: IsoDate, date: IsoDate): { day: number; week: number; simulationSaturday: boolean; taper: boolean } | null {
  const i = daysBetween(start, date)
  if (i < 0 || i >= p.weeks * 7) return null
  const week = Math.floor(i / 7) + 1
  const taper = i >= p.weeks * 7 - p.taper.days
  return { day: i + 1, week, taper, simulationSaturday: !taper && p.simulation.weeks.includes(week) && weekday(date) === SATURDAY }
}

/** Semua skill yang dipakai program, untuk pemeriksaan konten. */
export function programSkillIds(p: Program): string[] {
  const ids = new Set<string>(p.taper.skills)
  for (const ph of p.phases) {
    for (const s of ph.latihan) ids.add(s)
    if (ph.tes !== 'previous') for (const s of ph.tes) ids.add(s)
  }
  return [...ids]
}
