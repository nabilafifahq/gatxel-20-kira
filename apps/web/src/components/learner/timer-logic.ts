/**
 * Logika Timer tanpa React, supaya bisa dites dan dipakai server maupun klien.
 * Cincin menyusut halus; warnanya mengikuti sisa waktu (DESIGN.md bagian 6a).
 */

/** Jendela terakhir: angka membesar, cincin menebal, ada bunyi tik tiap detik. */
export const URGENT_SECONDS = 10

export type TimerTone = 'neutral' | 'green' | 'amber' | 'red'

export function formatClock(totalSec: number, pad = false): string {
  const s = Math.max(0, Math.floor(totalSec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${pad && m < 10 ? `0${m}` : m}:${r < 10 ? `0${r}` : r}`
}

export function spokenDuration(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const m = Math.floor(s / 60)
  const r = s % 60
  const parts: string[] = []
  if (m > 0) parts.push(`${m} ${m === 1 ? 'minute' : 'minutes'}`)
  if (r > 0 || m === 0) parts.push(`${r} ${r === 1 ? 'second' : 'seconds'}`)
  return parts.join(' ')
}

/** Bagian waktu yang masih tersisa, 0 sampai 1. Total yang tidak dikenal dianggap habis. */
export function remainingFraction(seconds: number, total: number): number {
  if (!(total > 0) || !Number.isFinite(seconds)) return 0
  return Math.min(1, Math.max(0, seconds / total))
}

/** Hijau di atas 50 persen, kuning sampai 20 persen, merah di bawahnya. */
export function toneForFraction(fraction: number): Exclude<TimerTone, 'neutral'> {
  if (fraction > 0.5) return 'green'
  if (fraction >= 0.2) return 'amber'
  return 'red'
}

/** `calm` (warnAt 0, misalnya jeda PIN) tidak memakai warna peringatan, bunyi, atau pembesaran. */
export function isUrgent(seconds: number, calm: boolean): boolean {
  return !calm && seconds > 0 && seconds <= URGENT_SECONDS
}

export const RING_VIEWBOX = 44
export const RING_RADIUS = 18.5
export const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS
export const RING_STROKE = 4
export const RING_STROKE_URGENT = 7

/** Nilai stroke-dashoffset untuk busur yang menyisakan `fraction` dari lingkaran. */
export function ringOffset(fraction: number): number {
  return RING_CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, fraction)))
}

/**
 * Sisa waktu pecahan untuk animasi halus. `seconds` adalah sisa waktu bulat dari induk (turun satu
 * tiap detik); `sinceTickMs` waktu sejak nilai itu tiba. Hasilnya turun mulus dari `seconds` ke
 * `seconds - 1`, lalu menunggu nilai berikutnya.
 */
export function smoothRemaining(seconds: number, sinceTickMs: number): number {
  const into = Math.min(1, Math.max(0, sinceTickMs / 1000))
  return Math.max(0, seconds - into)
}

/** Bunyi yang cocok saat sisa waktu berubah dari `before` ke `now`, atau null. */
export function timerSound(before: number | null, now: number, calm: boolean): 'tick' | 'timeup' | null {
  if (calm || before === null || now === before) return null
  if (now === 0 && before > 0) return 'timeup'
  if (now > 0 && now <= URGENT_SECONDS && now < before) return 'tick'
  return null
}
