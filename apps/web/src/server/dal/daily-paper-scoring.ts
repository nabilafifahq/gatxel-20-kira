import 'server-only'
import { daysBetween, scaleRulesToCount, type IsoDate, type PaperKind, type PresetRules } from '@kira/core'
import type { Preset } from '@kira/content'
import { preset, presets } from './content'
import type { Subject } from '@/lib/dto'

/**
 * Preset lomba yang menilai Paper harian di tablet. Paper penuh memakai aturan preset apa adanya,
 * paper mini (8 soal, 15 menit) memakai aturan yang sama yang diperkecil (scaleRulesToCount).
 * Pemilih soal (daily-paper.ts) dan penilaian di runner sama-sama memakai berkas ini, jadi paper
 * yang soalnya diganti pemilih lain tetap dinilai dengan preset yang cocok.
 */

const ROTATION_ANCHOR: IsoDate = '2026-01-05'

/** Preset yang cocok untuk mapel dan grade, tanpa paket latihan ESMO dan tanpa Checkpoint. */
export function paperPresetsFor(subject: Subject, grade: number): Preset[] {
  return presets()
    .filter((p) => p.subject === subject && !p.id.startsWith('esmo-practice') && !p.id.startsWith('cambridge-checkpoint'))
    .filter((p) => p.grades.includes(grade) || p.grades.some((g) => Math.abs(g - grade) <= 1))
    .sort((a, b) => Number(b.verified) - Number(a.verified) || a.id.localeCompare(b.id))
}

/** Preset hari itu: bergiliran antar preset yang cocok, satu per hari. */
export function paperPresetFor(subject: Subject, grade: number, date: IsoDate): Preset | undefined {
  const list = paperPresetsFor(subject, grade)
  if (list.length === 0) return undefined
  const day = daysBetween(ROTATION_ANCHOR, date)
  return list[((day % list.length) + list.length) % list.length]
}

/** Aturan skor untuk paper dengan n soal. */
export function paperRules(p: Preset, kind: PaperKind, n: number, minutes: number): PresetRules {
  return kind === 'mini' ? scaleRulesToCount(p.rules, n, minutes) : p.rules
}

/** Preset yang tersimpan di attempt, dengan aturan yang disesuaikan jumlah soal. */
export function presetRulesFor(presetId: string | null, n: number): { preset: Preset; rules: PresetRules } | null {
  if (!presetId) return null
  const p = preset(presetId)
  if (!p) return null
  return { preset: p, rules: n >= p.rules.questionCount ? p.rules : scaleRulesToCount(p.rules, n) }
}
