'use client'

import { useSyncExternalStore } from 'react'

/**
 * Efek suara learner. Berkas CC0 dari Kenney disimpan di server sendiri (`/sounds`, lihat
 * LICENSE-sounds.txt), jadi area learner tetap tanpa aset dari luar. Suara selalu bisa dimatikan
 * (DESIGN.md bagian 6a): pilihannya disimpan per perangkat di localStorage dan dibaca setiap
 * `playSfx`. Web Audio dipakai supaya bunyi tidak terlambat dan tidak memakai Range request,
 * sehingga service worker bisa menyimpan berkasnya untuk mode offline.
 */

export type SfxName =
  | 'correct'
  | 'notyet'
  | 'tap'
  | 'combo'
  | 'levelup'
  | 'badge'
  | 'chest'
  | 'complete'
  | 'tick'
  | 'timeup'
  | 'count'
  | 'go'
  | 'whoosh'
  | 'flag'
  | 'quiz'

export type SfxOptions = {
  /** Tingkat kombo 1 sampai 3: makin tinggi, makin tinggi nadanya. */
  level?: 1 | 2 | 3
  /** Bintang sesi: 3 memutar jingle besar, selain itu jingle pendek. */
  stars?: number
}

type Clip = { src: string; gain: number }
const clips = (prefix: string, n: number, gain: number): Clip[] => Array.from({ length: n }, (_, i) => ({ src: `/sounds/${prefix}-${i + 1}.mp3`, gain }))

/**
 * Setiap kejadian punya 2 sampai 4 varian yang dipilih acak (tidak pernah sama dua kali berturut-turut),
 * supaya bunyinya tidak membosankan. `gain` menyetarakan kerasnya: tik, ketukan, dan whoosh muncul sering,
 * jadi lebih pelan.
 */
const FILES: Record<string, Clip[]> = {
  correct: clips('correct', 3, 0.8),
  notyet: clips('notyet', 3, 0.7),
  tap: clips('tap', 4, 0.4),
  combo1: clips('combo1', 2, 0.8),
  combo2: clips('combo2', 2, 0.8),
  combo3: clips('combo3', 2, 0.8),
  levelup: clips('levelup', 3, 0.8),
  badge: clips('badge', 3, 0.8),
  chest: clips('chest', 3, 0.85),
  complete: clips('complete', 3, 0.8),
  big: clips('big', 3, 0.85),
  tick: clips('tick', 2, 0.45),
  timeup: clips('timeup', 3, 0.8),
  count: clips('count', 2, 0.6),
  go: clips('go', 2, 0.75),
  whoosh: clips('whoosh', 3, 0.22),
  flag: clips('flag', 2, 0.6),
  quiz: clips('quiz', 2, 0.7),
}

export const SFX_NAMES = ['correct', 'notyet', 'tap', 'combo', 'levelup', 'badge', 'chest', 'complete', 'tick', 'timeup', 'count', 'go', 'whoosh', 'flag', 'quiz'] as const satisfies readonly SfxName[]
export const SFX_MUTED_KEY = 'kira.sfx.muted'

/** Kunci berkas untuk satu pemanggilan: kombo mengikuti tingkat, complete mengikuti bintang. */
export function sfxKey(name: SfxName, opts?: SfxOptions): string {
  if (name === 'combo') return `combo${Math.min(3, Math.max(1, opts?.level ?? 1))}`
  if (name === 'complete') return (opts?.stars ?? 0) >= 3 ? 'big' : 'complete'
  return name
}

/** Pilih varian acak, bukan yang baru saja diputar. `rnd` bisa diganti di tes. */
export function pickVariant(count: number, last: number, rnd: () => number = Math.random): number {
  if (count <= 1) return 0
  const n = Math.floor(rnd() * (count - 1))
  return n >= last && last >= 0 ? n + 1 : n
}

/** Bunyi yang baru siap setelah ini dianggap basi dan dilewati. */
const STALE_MS = 1200

// ---------------------------------------------------------------------------
// Bisu atau tidak (per perangkat)

let mutedCache: boolean | null = null
const listeners = new Set<() => void>()

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function readMuted(): boolean {
  try {
    return storage()?.getItem(SFX_MUTED_KEY) === '1'
  } catch {
    return false
  }
}

/** Pilihan perangkat saja (tombol di Me). */
export function isSfxDeviceMuted(): boolean {
  if (mutedCache === null) mutedCache = readMuted()
  return mutedCache
}

/**
 * Pilihan tutor (kolom learner_profile.sound_enabled dan music_enabled). Bila tutor mematikannya, pilihan
 * perangkat tidak berlaku: tidak ada bunyi dan tidak ada musik di perangkat anak.
 */
let tutorSfx = true
let tutorMusic = true
export function setTutorSoundPolicy(policy: { sfx: boolean; music: boolean }): void {
  tutorSfx = policy.sfx
  tutorMusic = policy.music
  for (const l of listeners) l()
}
export function tutorAllowsSfx(): boolean {
  return tutorSfx
}
export function tutorAllowsMusic(): boolean {
  return tutorMusic
}

/** Bisu bila perangkat dibisukan atau tutor mematikan suara. */
export function isSfxMuted(): boolean {
  return isSfxDeviceMuted() || !tutorSfx
}

export function setSfxMuted(muted: boolean): void {
  mutedCache = muted
  try {
    const s = storage()
    if (s) {
      if (muted) s.setItem(SFX_MUTED_KEY, '1')
      else s.removeItem(SFX_MUTED_KEY)
    }
  } catch {
    // penyimpanan diblokir: pilihan tetap berlaku sampai halaman ditutup
  }
  for (const l of listeners) l()
}

export function subscribeSfxMuted(cb: () => void): () => void {
  listeners.add(cb)
  const onStorage = (e: StorageEvent) => {
    if (e.key === SFX_MUTED_KEY || e.key === null) {
      mutedCache = readMuted()
      cb()
    }
  }
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(cb)
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage)
  }
}

/** Status bisu untuk tombol di halaman Me. Render server dan render pertama: suara aktif. */
export function useSfxMuted(): [boolean, (muted: boolean) => void] {
  const muted = useSyncExternalStore(subscribeSfxMuted, isSfxDeviceMuted, () => false)
  return [muted, setSfxMuted]
}

/** Apakah tutor mengizinkan bunyi dan musik (untuk menonaktifkan tombol di Me). */
export function useTutorSoundPolicy(): { sfx: boolean; music: boolean } {
  const sfx = useSyncExternalStore(subscribeSfxMuted, tutorAllowsSfx, () => true)
  const music = useSyncExternalStore(subscribeSfxMuted, tutorAllowsMusic, () => true)
  return { sfx, music }
}

// ---------------------------------------------------------------------------
// Pemutar

let ctx: AudioContext | null = null
const raw = new Map<string, Promise<ArrayBuffer | null>>()
const decoded = new Map<string, Promise<AudioBuffer | null>>()
const buffers = new Map<string, AudioBuffer>()
const lastVariant = new Map<string, number>()
let unlockBound = false

export function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (ctx) return ctx
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  try {
    ctx = new Ctor()
  } catch {
    return null
  }
  return ctx
}

function fetchRaw(src: string): Promise<ArrayBuffer | null> {
  let p = raw.get(src)
  if (!p) {
    p = fetch(src)
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .catch(() => null)
      .then((b) => {
        if (!b) raw.delete(src)
        return b
      })
    raw.set(src, p)
  }
  return p
}

/** Dipakai juga oleh musik latar supaya satu AudioContext dan satu jalur unduh. */
export function bufferFor(src: string, c: AudioContext): Promise<AudioBuffer | null> {
  const hit = buffers.get(src)
  if (hit) return Promise.resolve(hit)
  let p = decoded.get(src)
  if (!p) {
    p = fetchRaw(src)
      .then(async (data) => {
        if (!data) return null
        try {
          return await c.decodeAudioData(data.slice(0))
        } catch {
          return null
        }
      })
      .then((b) => {
        if (b) buffers.set(src, b)
        else decoded.delete(src)
        return b
      })
    decoded.set(src, p)
  }
  return p
}

/** Berkas yang diunduh lebih dulu: yang sering dipakai di sesi. Sisanya diambil saat pertama kali dibutuhkan. */
const EAGER = ['correct', 'notyet', 'tap', 'combo1', 'tick', 'complete', 'count', 'go']

/**
 * Siapkan bunyi: unduh berkas lebih dulu, lalu buka kunci audio pada sentuhan pertama
 * (aturan autoplay browser). Aman dipanggil berulang; tidak melakukan apa-apa di server.
 */
export function primeSfx(): void {
  if (typeof window === 'undefined') return
  const eager = EAGER.flatMap((k) => FILES[k]!.map((c) => c.src))
  for (const src of eager) void fetchRaw(src)
  if (unlockBound) return
  unlockBound = true
  const unlock = () => {
    const c = audioContext()
    if (c && c.state === 'suspended') void c.resume().catch(() => undefined)
    if (c) for (const src of eager) void bufferFor(src, c)
  }
  for (const type of ['pointerdown', 'keydown', 'touchend'] as const) window.addEventListener(type, unlock, { passive: true })
}

export function playSfx(name: SfxName, opts?: SfxOptions): void {
  if (typeof window === 'undefined' || isSfxMuted()) return
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
  const c = audioContext()
  if (!c) return
  // resume() harus dipanggil di sini (bukan setelah await) supaya iOS menganggapnya bagian dari sentuhan.
  if (c.state === 'suspended') void c.resume().catch(() => undefined)
  const key = sfxKey(name, opts)
  const list = FILES[key]
  if (!list) return
  const at = pickVariant(list.length, lastVariant.get(key) ?? -1)
  lastVariant.set(key, at)
  const clip = list[at]!
  const asked = Date.now()
  void bufferFor(clip.src, c)
    .then((buf) => {
      if (!buf || isSfxMuted() || Date.now() - asked > STALE_MS) return
      const src = c.createBufferSource()
      src.buffer = buf
      const gain = c.createGain()
      gain.gain.value = clip.gain
      src.connect(gain)
      gain.connect(c.destination)
      src.start()
    })
    .catch(() => undefined)
}
