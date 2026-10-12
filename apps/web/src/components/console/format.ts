import { formatDateId, jakartaClock, jakartaDate, daysBetween } from '@kira/core/time'
import type { Subject } from '@/lib/dto'

/**
 * Format tanggal, waktu, dan angka untuk konsol dan halaman orang tua (id-ID, WIB).
 * Ditulis tanpa Intl supaya hasil server dan client sama persis.
 */

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function toIsoDate(value: string): string {
  return value.length > 10 ? jakartaDate(new Date(value)) : value
}

/** "16 Oktober 2026" dari "2026-10-16" atau timestamp ISO. */
export function dateId(value: string, withWeekday = false): string {
  return formatDateId(toIsoDate(value), withWeekday)
}

/** "16 Okt" */
export function shortDateId(value: string): string {
  const [, m, d] = toIsoDate(value).split('-').map(Number) as [number, number, number]
  return `${d} ${MONTHS_SHORT[m - 1]}`
}

/** "15.42" (WIB) */
export function timeId(ts: string): string {
  return jakartaClock(new Date(ts))
}

/** "16 Oktober 2026, 15.42" */
export function dateTimeId(ts: string): string {
  return `${dateId(ts)}, ${timeId(ts)}`
}

/** Selisih hari dari `from` ke `to` (tanggal ISO atau timestamp). */
export function daysUntil(from: string, to: string): number {
  return daysBetween(toIsoDate(from), toIsoDate(to))
}

/** Pemisah ribuan titik: 1.204 */
export function num(n: number): string {
  const sign = n < 0 ? '-' : ''
  const [int, frac] = Math.abs(n).toString().split('.') as [string, string | undefined]
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return frac ? `${sign}${grouped},${frac}` : `${sign}${grouped}`
}

export function pct(n: number | null): string {
  return n == null ? 'belum ada' : `${Math.round(n)}%`
}

export const SUBJECT_LABEL: Record<Subject, string> = { math: 'Math', english: 'English', science: 'Science' }

export const SUBJECTS: Subject[] = ['math', 'english', 'science']

/** Kelas warna mapel ditulis utuh supaya Tailwind membangkitkannya. */
export const SUBJECT_TEXT: Record<Subject, string> = { math: 'text-math', english: 'text-english', science: 'text-science' }
export const SUBJECT_BG50: Record<Subject, string> = { math: 'bg-math-50', english: 'bg-english-50', science: 'bg-science-50' }
export const SUBJECT_BORDER: Record<Subject, string> = { math: 'border-math', english: 'border-english', science: 'border-science' }
export const SUBJECT_BG: Record<Subject, string> = { math: 'bg-math', english: 'bg-english', science: 'bg-science' }
export const SUBJECT_STROKE: Record<Subject, string> = { math: 'stroke-math', english: 'stroke-english', science: 'stroke-science' }
export const SUBJECT_FILL: Record<Subject, string> = { math: 'fill-math', english: 'fill-english', science: 'fill-science' }

export function gradeLabel(grade: number): string {
  return `Grade ${grade}`
}
