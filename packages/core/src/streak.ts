import { addDays, compareDates, weekDates, weekday, weekStart, type IsoDate } from './time'

/**
 * Streak dihitung ulang dari riwayat harian (WIB).
 * Hari lengkap: semua sesi wajib hari itu selesai (9 pada hari biasa, 3 pada template Hari ringan).
 * Sesi opsional dari tutor tidak dihitung, jadi tidak pernah menambah atau memutus streak.
 * Hari istirahat (hari istirahat mingguan atau dari rencana tutor) tidak memutus streak.
 * Hari terlewat memakai pembeku bila ada; tanpa pembeku streak kembali ke 0.
 * Pembeku: 1 setiap 7 hari lengkap berturut-turut, paling banyak 2 tersimpan.
 * Hari ini yang belum selesai tidak memutus streak (masih ada waktu).
 */

export type DayRecord = { date: IsoDate; questsDone: number; questsRequired: number; rest?: boolean }

export type DayStatus = 'complete' | 'partial' | 'rest' | 'freeze' | 'missed' | 'today' | 'upcoming' | 'none'

export type StreakResult = {
  current: number
  best: number
  freezes: number
  statusByDate: Map<IsoDate, DayStatus>
}

/** Jumlah sesi wajib bila hari itu belum punya catatan (3 mapel kali Latihan, Tes, dan Paper). */
export const DEFAULT_REQUIRED_SESSIONS = 9
export const MAX_FREEZES = 2
export const FREEZE_EVERY = 7

export function computeStreak(input: {
  days: readonly DayRecord[]
  today: IsoDate
  restWeekdays: readonly number[]
  /** Tanggal pertama learner mulai; hari sebelumnya diabaikan. */
  since: IsoDate
}): StreakResult {
  const byDate = new Map(input.days.map((d) => [d.date, d]))
  const statusByDate = new Map<IsoDate, DayStatus>()
  let current = 0
  let best = 0
  let freezes = 0
  let completeRun = 0

  for (let d = input.since; compareDates(d, input.today) <= 0; d = addDays(d, 1)) {
    const rec = byDate.get(d)
    const isRest = rec?.rest === true || (rec === undefined && input.restWeekdays.includes(weekday(d)))
    const required = rec?.questsRequired ?? DEFAULT_REQUIRED_SESSIONS
    const done = rec?.questsDone ?? 0
    const complete = required > 0 && done >= required

    if (complete) {
      current++
      completeRun++
      statusByDate.set(d, 'complete')
      if (completeRun % FREEZE_EVERY === 0) freezes = Math.min(MAX_FREEZES, freezes + 1)
    } else if (isRest || required === 0) {
      statusByDate.set(d, 'rest')
    } else if (d === input.today) {
      statusByDate.set(d, done > 0 ? 'partial' : 'today')
    } else if (freezes > 0) {
      freezes--
      statusByDate.set(d, 'freeze')
    } else {
      statusByDate.set(d, done > 0 ? 'partial' : 'missed')
      current = 0
      completeRun = 0
    }
    best = Math.max(best, current)
  }
  return { current, best, freezes, statusByDate }
}

export type WeekDay = { date: IsoDate; status: DayStatus; isToday: boolean }

/** Tujuh hari minggu ini untuk rantai bintang (Senin sampai Minggu). */
export function weekView(result: StreakResult, today: IsoDate, restWeekdays: readonly number[]): WeekDay[] {
  return weekDates(weekStart(today)).map((date) => {
    let status: DayStatus = result.statusByDate.get(date) ?? 'none'
    if (compareDates(date, today) > 0) status = restWeekdays.includes(weekday(date)) ? 'rest' : 'upcoming'
    return { date, status, isToday: date === today }
  })
}

export function weekCompleteCount(week: readonly WeekDay[]): number {
  return week.filter((d) => d.status === 'complete').length
}
