'use client'

import { useSyncExternalStore } from 'react'

/**
 * Efek suara learner. Berkas CC0 dari Kenney disimpan di server sendiri (`/sounds`, lihat
 * LICENSE-sounds.txt), jadi area learner tetap tanpa aset dari luar. Suara selalu bisa dimatikan
 * (DESIGN.md bagian 6a): pilihannya disimpan per perangkat di localStorage dan dibaca setiap
 * `playSfx`. Web Audio dipakai supaya bunyi tidak terlambat dan tidak memakai Range request,
 * sehingga service worker bisa menyimpan berkasnya untuk mode offline.
 */

export type SfxName = 'correct' | 'notyet' | 'combo' | 'levelup' | 'badge' | 'complete' | 'tick' | 'timeup' | 'tap'

/** `gain` menyetarakan kerasnya: tik dan ketukan muncul sering, jadi lebih pelan. */
const FILES: Record<SfxName, { src: string; gain: number }> = {
  correct: { src: '/sounds/correct.mp3', gain: 0.8 },
  notyet: { src: '/sounds/notyet.mp3', gain: 0.7 },
  combo: { src: '/sounds/combo.mp3', gain: 0.8 },
  levelup: { src: '/sounds/levelup.mp3', gain: 0.8 },
  badge: { src: '/sounds/badge.mp3', gain: 0.8 },
  complete: { src: '/sounds/complete.mp3', gain: 0.8 },
  tick: { src: '/sounds/tick.mp3', gain: 0.45 },
  timeup: { src: '/sounds/timeup.mp3', gain: 0.8 },
  tap: { src: '/sounds/tap.mp3', gain: 0.4 },
}

export const SFX_NAMES = Object.keys(FILES) as SfxName[]
export const SFX_MUTED_KEY = 'kira.sfx.muted'

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

export function isSfxMuted(): boolean {
  if (mutedCache === null) mutedCache = readMuted()
  return mutedCache
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
  const muted = useSyncExternalStore(subscribeSfxMuted, isSfxMuted, () => false)
  return [muted, setSfxMuted]
}

// ---------------------------------------------------------------------------
// Pemutar

let ctx: AudioContext | null = null
const raw = new Map<SfxName, Promise<ArrayBuffer | null>>()
const decoded = new Map<SfxName, Promise<AudioBuffer | null>>()
const buffers = new Map<SfxName, AudioBuffer>()
let unlockBound = false

function audioContext(): AudioContext | null {
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

function fetchRaw(name: SfxName): Promise<ArrayBuffer | null> {
  let p = raw.get(name)
  if (!p) {
    p = fetch(FILES[name].src)
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .catch(() => null)
      .then((b) => {
        if (!b) raw.delete(name)
        return b
      })
    raw.set(name, p)
  }
  return p
}

function bufferFor(name: SfxName, c: AudioContext): Promise<AudioBuffer | null> {
  const hit = buffers.get(name)
  if (hit) return Promise.resolve(hit)
  let p = decoded.get(name)
  if (!p) {
    p = fetchRaw(name)
      .then(async (data) => {
        if (!data) return null
        try {
          return await c.decodeAudioData(data.slice(0))
        } catch {
          return null
        }
      })
      .then((b) => {
        if (b) buffers.set(name, b)
        else decoded.delete(name)
        return b
      })
    decoded.set(name, p)
  }
  return p
}

/**
 * Siapkan semua bunyi: unduh berkas lebih dulu, lalu buka kunci audio pada sentuhan pertama
 * (aturan autoplay browser). Aman dipanggil berulang; tidak melakukan apa-apa di server.
 */
export function primeSfx(): void {
  if (typeof window === 'undefined') return
  for (const name of SFX_NAMES) void fetchRaw(name)
  if (unlockBound) return
  unlockBound = true
  const unlock = () => {
    const c = audioContext()
    if (c && c.state === 'suspended') void c.resume().catch(() => undefined)
    if (c) for (const name of SFX_NAMES) void bufferFor(name, c)
  }
  for (const type of ['pointerdown', 'keydown', 'touchend'] as const) window.addEventListener(type, unlock, { passive: true })
}

export function playSfx(name: SfxName): void {
  if (typeof window === 'undefined' || isSfxMuted()) return
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
  const c = audioContext()
  if (!c) return
  // resume() harus dipanggil di sini (bukan setelah await) supaya iOS menganggapnya bagian dari sentuhan.
  if (c.state === 'suspended') void c.resume().catch(() => undefined)
  const asked = Date.now()
  void bufferFor(name, c)
    .then((buf) => {
      if (!buf || isSfxMuted() || Date.now() - asked > STALE_MS) return
      const src = c.createBufferSource()
      src.buffer = buf
      const gain = c.createGain()
      gain.gain.value = FILES[name].gain
      src.connect(gain)
      gain.connect(c.destination)
      src.start()
    })
    .catch(() => undefined)
}
