/**
 * Mode Quick Maths, batas waktu, dan misi harian 5 menit.
 */
import { addDays, weekday, type IsoDate } from '../time'
import { DEFAULT_QM_LEVELS, type QmConfig, type QmMode } from './types'

export type QmModeInfo = {
  title: string
  blurb: string
  /** Mode berwaktu: kunci jawaban tidak pernah dikirim sebelum ronde selesai. */
  timed: boolean
  limitSec: number | null
  /** Jumlah soal yang disiapkan untuk ronde. */
  count: number
  /** Perkiraan menit untuk misi harian. */
  minutes: number
}

export const QM_MODE_INFO: Record<QmMode, QmModeInfo> = {
  practice: { title: 'Practice', blurb: 'No timer. Ask for a hint any time.', timed: false, limitSec: null, count: 10, minutes: 2 },
  sprint60: { title: 'Sprint 60', blurb: 'As many as you can in 60 seconds.', timed: true, limitSec: 60, count: 120, minutes: 1 },
  sprint120: { title: 'Sprint 120', blurb: 'As many as you can in 2 minutes.', timed: true, limitSec: 120, count: 240, minutes: 2 },
  target20: { title: 'Target 20', blurb: '20 questions, as fast as you can.', timed: true, limitSec: 600, count: 20, minutes: 2 },
  tables: { title: 'Times tables', blurb: 'Pick one table and master it.', timed: false, limitSec: null, count: 24, minutes: 2 },
  flash: { title: 'Flash Anzan', blurb: 'Numbers flash by. Add them in your head.', timed: false, limitSec: null, count: 5, minutes: 2 },
  soroban: { title: 'Soroban', blurb: 'Learn the beads, then see them in your mind.', timed: false, limitSec: null, count: 8, minutes: 3 },
}

export const SPRINT_GRACE_MS = 3000

export function isTimedMode(mode: QmMode): boolean {
  return QM_MODE_INFO[mode].timed
}

export function defaultQmConfig(mode: QmMode): QmConfig {
  return {
    mode,
    op: 'mixed',
    digits: 'mixed',
    carry: true,
    auto: true,
    levels: { ...DEFAULT_QM_LEVELS },
    table: 2,
    division: false,
    flashLevel: 1,
    sorobanStage: 'read',
    sorobanLevel: 1,
    focus: null,
    count: QM_MODE_INFO[mode].count,
  }
}

// ---------------------------------------------------------------------------
// Misi harian 5 menit

export const MISSION_STEP_IDS = ['warmup', 'sprint', 'flash', 'tables'] as const
export type MissionStepId = (typeof MISSION_STEP_IDS)[number]

export const MISSION_STEPS: readonly { id: MissionStepId; title: string; mode: QmMode; minutes: number }[] = [
  { id: 'warmup', title: 'Warm-up', mode: 'practice', minutes: 1.5 },
  { id: 'sprint', title: 'Sprint 60', mode: 'sprint60', minutes: 1 },
  { id: 'flash', title: 'Flash Anzan', mode: 'flash', minutes: 1.5 },
  { id: 'tables', title: 'Times table', mode: 'tables', minutes: 1 },
]

export const MISSION_MINUTES = MISSION_STEPS.reduce((n, s) => n + s.minutes, 0)

const TABLE_ROTATION = [2, 5, 10, 3, 4, 6, 9] as const

/** Tabel perkalian misi: berganti setiap hari, sama untuk seluruh hari itu. */
export function missionTable(date: IsoDate): number {
  return TABLE_ROTATION[weekday(date) % TABLE_ROTATION.length]!
}

export function isMissionStepId(value: unknown): value is MissionStepId {
  return typeof value === 'string' && (MISSION_STEP_IDS as readonly string[]).includes(value)
}

export function missionComplete(doneSteps: readonly string[]): boolean {
  return MISSION_STEP_IDS.every((id) => doneSteps.includes(id))
}

/** Hari berturut-turut (berakhir pada `today` atau kemarin) yang misinya selesai. */
export function missionStreak(doneDates: readonly IsoDate[], today: IsoDate): number {
  const set = new Set(doneDates)
  let day = set.has(today) ? today : addDays(today, -1)
  let n = 0
  while (set.has(day)) {
    n++
    day = addDays(day, -1)
  }
  return n
}
