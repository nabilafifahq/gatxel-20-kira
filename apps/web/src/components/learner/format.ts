/** Format tanggal dan waktu untuk layar learner (en-GB, zona Asia/Jakarta). */

function parse(iso: string): { date: Date; dateOnly: boolean } {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso)
  return { date: new Date(dateOnly ? `${iso}T00:00:00Z` : iso), dateOnly }
}

/** "9 Oct" */
export function shortDate(iso: string): string {
  const { date, dateOnly } = parse(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: dateOnly ? 'UTC' : 'Asia/Jakarta' }).format(date)
}

/** "Saturday 17 October" */
export function longDate(iso: string): string {
  const { date, dateOnly } = parse(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: dateOnly ? 'UTC' : 'Asia/Jakarta' }).format(date)
}

/** "13:20" dari detik, untuk waktu terpakai di halaman hasil. */
export function minutesSeconds(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r < 10 ? `0${r}` : r}`
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/** "1, 2 and 5" */
export function joinAnd(items: (string | number)[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return String(items[0])
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}
