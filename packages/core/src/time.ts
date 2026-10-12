/**
 * Waktu belajar dihitung di Asia/Jakarta (WIB, UTC+7). Indonesia tidak memakai
 * daylight saving, jadi offset tetap +7 jam aman dan tidak butuh data zona waktu.
 * Tanggal disimpan sebagai string ISO "YYYY-MM-DD".
 */

export const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export type IsoDate = string

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function isIsoDate(s: string): s is IsoDate {
  if (!ISO_DATE.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

/** Tanggal kalender di Jakarta untuk sebuah instan. */
export function jakartaDate(at: Date = new Date()): IsoDate {
  return new Date(at.getTime() + JAKARTA_OFFSET_MS).toISOString().slice(0, 10)
}

/** Jam dan menit di Jakarta, misalnya "16.05". */
export function jakartaClock(at: Date = new Date()): string {
  const d = new Date(at.getTime() + JAKARTA_OFFSET_MS)
  return `${String(d.getUTCHours()).padStart(2, '0')}.${String(d.getUTCMinutes()).padStart(2, '0')}`
}

/** Instan UTC saat tengah malam Jakarta untuk tanggal itu. */
export function jakartaMidnight(date: IsoDate): Date {
  return new Date(Date.parse(`${date}T00:00:00Z`) - JAKARTA_OFFSET_MS)
}

export function addDays(date: IsoDate, n: number): IsoDate {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)
}

/** Selisih hari b dikurangi a. */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS)
}

/** 0 = Minggu, 1 = Senin, ..., 6 = Sabtu. */
export function weekday(date: IsoDate): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay()
}

/** Senin dari minggu tanggal itu. */
export function weekStart(date: IsoDate): IsoDate {
  const wd = weekday(date)
  return addDays(date, wd === 0 ? -6 : 1 - wd)
}

/** Tujuh tanggal Senin sampai Minggu. */
export function weekDates(monday: IsoDate): IsoDate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

export function compareDates(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0
}

const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]
const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** "12 Oktober 2026" */
export function formatDateId(date: IsoDate, withWeekday = false): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const base = `${d} ${MONTHS_ID[m - 1]} ${y}`
  return withWeekday ? `${DAYS_ID[weekday(date)]}, ${base}` : base
}

/** "12 October 2026" (en-GB) */
export function formatDateEn(date: IsoDate, withWeekday = false): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const base = `${d} ${MONTHS_EN[m - 1]} ${y}`
  return withWeekday ? `${DAYS_EN[weekday(date)]} ${base}` : base
}

export function weekdayNameEn(date: IsoDate): string {
  return DAYS_EN[weekday(date)]!
}

export function weekdayNameId(date: IsoDate): string {
  return DAYS_ID[weekday(date)]!
}

/** "13 menit 20 detik" */
export function formatDurationId(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m === 0) return `${r} detik`
  if (r === 0) return `${m} menit`
  return `${m} menit ${r} detik`
}

/** "13 minutes 20 seconds" */
export function formatDurationEn(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  const mm = `${m} minute${m === 1 ? '' : 's'}`
  const ss = `${r} second${r === 1 ? '' : 's'}`
  if (m === 0) return ss
  if (r === 0) return mm
  return `${mm} ${ss}`
}

/** "12:40" untuk timer. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}
