/**
 * Tiga jalur XP. Setiap baris xp_event membawa satu jalur. Level per jalur memakai
 * rumus yang sama dengan XP Belajar (levelForXp): level L dicapai saat XP >= 50 x (L - 1) x L.
 *  - belajar      Latihan, Tes, Paper, Pelajaran, Ulang (bar kuning bintang)
 *  - hitung       Quick Maths (bar ungu)
 *  - pengetahuan  Quiz Arena (bar biru tua)
 */
import { levelProgress } from './xp'

export const XP_TRACKS = ['belajar', 'hitung', 'pengetahuan'] as const
export type XpTrack = (typeof XP_TRACKS)[number]

export function isXpTrack(value: unknown): value is XpTrack {
  return typeof value === 'string' && (XP_TRACKS as readonly string[]).includes(value)
}

/** Teks layar learner (en-GB). */
export const TRACK_TEXT: Record<XpTrack, { name: string; xp: string; level: string }> = {
  belajar: { name: 'Learning', xp: 'Learning XP', level: 'Level' },
  hitung: { name: 'Quick Maths', xp: 'Quick Maths XP', level: 'Quick Maths level' },
  pengetahuan: { name: 'Quiz', xp: 'Quiz XP', level: 'Quiz level' },
}

export type TrackXp = Record<XpTrack, number>

export function emptyTrackXp(): TrackXp {
  return { belajar: 0, hitung: 0, pengetahuan: 0 }
}

/** Jumlahkan baris (track, xp) dari database. Jalur yang tidak dikenal diabaikan, XP negatif tidak menurunkan di bawah 0. */
export function trackXpFromRows(rows: readonly { track: string; xp: number }[]): TrackXp {
  const out = emptyTrackXp()
  for (const r of rows) if (isXpTrack(r.track)) out[r.track] += r.xp
  for (const t of XP_TRACKS) out[t] = Math.max(0, Math.round(out[t]))
  return out
}

export type TrackProgress = {
  track: XpTrack
  xp: number
  level: number
  into: number
  span: number
  toNext: number
  percent: number
}

export function trackProgress(xp: TrackXp): TrackProgress[] {
  return XP_TRACKS.map((track) => {
    const p = levelProgress(xp[track])
    return { track, xp: xp[track], level: p.level, into: p.into, span: p.span, toNext: p.toNext, percent: p.span > 0 ? Math.min(100, Math.round((p.into / p.span) * 100)) : 0 }
  })
}

export function trackLevels(xp: TrackXp): Record<XpTrack, number> {
  return { belajar: levelProgress(xp.belajar).level, hitung: levelProgress(xp.hitung).level, pengetahuan: levelProgress(xp.pengetahuan).level }
}

/** Naik level per jalur antara dua keadaan XP. */
export function levelUps(before: TrackXp, after: TrackXp): { track: XpTrack; from: number; to: number }[] {
  const a = trackLevels(before)
  const b = trackLevels(after)
  return XP_TRACKS.filter((t) => b[t] > a[t]).map((track) => ({ track, from: a[track], to: b[track] }))
}
