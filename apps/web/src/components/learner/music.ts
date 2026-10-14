'use client'

import { useSyncExternalStore } from 'react'
import { audioContext, bufferFor, subscribeSfxMuted, tutorAllowsMusic } from './sfx'

/**
 * Musik latar yang tenang (DESIGN.md bagian 6a). Tiga lagu CC0 di /sounds (lihat LICENSE-sounds.txt),
 * diputar berulang lewat Web Audio supaya volume bisa diatur di iOS juga. Bawaan MATI: anak atau orang tua
 * menyalakannya lewat tombol Music di Me. Saat bacaan (TTS) berjalan, musik diturunkan (ducking).
 * Jika tutor mematikan musik, pilihan perangkat tidak berlaku.
 */

export const MUSIC_ON_KEY = 'kira.music.on'
export const MUSIC_TRACKS = ['/sounds/music-1.mp3', '/sounds/music-2.mp3', '/sounds/music-3.mp3'] as const
export const MUSIC_VOLUME = 0.22
export const MUSIC_DUCKED = 0.05

let onCache: boolean | null = null
const listeners = new Set<() => void>()

function readOn(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(MUSIC_ON_KEY) === '1'
  } catch {
    return false
  }
}

/** Pilihan perangkat. */
export function isMusicDeviceOn(): boolean {
  if (onCache === null) onCache = readOn()
  return onCache
}

/** Musik boleh terdengar: perangkat menyalakannya dan tutor mengizinkan. */
export function isMusicWanted(): boolean {
  return isMusicDeviceOn() && tutorAllowsMusic()
}

export function setMusicOn(on: boolean): void {
  onCache = on
  try {
    if (on) localStorage.setItem(MUSIC_ON_KEY, '1')
    else localStorage.removeItem(MUSIC_ON_KEY)
  } catch {
    // penyimpanan diblokir: pilihan tetap berlaku sampai halaman ditutup
  }
  for (const l of listeners) l()
  syncMusic()
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  const off = subscribeSfxMuted(cb)
  return () => {
    listeners.delete(cb)
    off()
  }
}

export function useMusicOn(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, isMusicDeviceOn, () => false)
  return [on, setMusicOn]
}

// ---------------------------------------------------------------------------
// Ducking: setiap pemilik (satu pembaca) menurunkan musik selama ia membaca.

const ducking = new Set<string>()

export function duckMusic(owner: string, ducked: boolean): void {
  if (ducked) ducking.add(owner)
  else ducking.delete(owner)
  applyVolume()
}

export function isMusicDucked(): boolean {
  return ducking.size > 0
}

// ---------------------------------------------------------------------------
// Pemutar

let source: AudioBufferSourceNode | null = null
let gain: GainNode | null = null
let playingIndex = -1
let starting = false

function applyVolume(): void {
  const c = audioContext()
  if (!c || !gain) return
  const target = isMusicDucked() ? MUSIC_DUCKED : MUSIC_VOLUME
  gain.gain.cancelScheduledValues(c.currentTime)
  gain.gain.setTargetAtTime(target, c.currentTime, 0.25)
}

function stopNow(): void {
  const c = audioContext()
  const s = source
  const g = gain
  source = null
  gain = null
  playingIndex = -1
  if (!s || !g || !c) return
  g.gain.cancelScheduledValues(c.currentTime)
  g.gain.setTargetAtTime(0, c.currentTime, 0.15)
  window.setTimeout(() => {
    try {
      s.stop()
    } catch {
      // sudah berhenti
    }
    s.disconnect()
    g.disconnect()
  }, 600)
}

/** Menyamakan pemutar dengan pilihan sekarang. Aman dipanggil kapan saja. */
export function syncMusic(): void {
  if (typeof window === 'undefined') return
  const want = isMusicWanted() && document.visibilityState !== 'hidden'
  if (!want) {
    stopNow()
    return
  }
  if (source || starting) return
  const c = audioContext()
  if (!c) return
  if (c.state === 'suspended') void c.resume().catch(() => undefined)
  starting = true
  const index = Math.floor(Math.random() * MUSIC_TRACKS.length)
  void bufferFor(MUSIC_TRACKS[index]!, c)
    .then((buf) => {
      starting = false
      if (!buf || !isMusicWanted() || source) return
      const s = c.createBufferSource()
      s.buffer = buf
      s.loop = true
      const g = c.createGain()
      g.gain.value = 0
      s.connect(g)
      g.connect(c.destination)
      s.start()
      source = s
      gain = g
      playingIndex = index
      applyVolume()
    })
    .catch(() => {
      starting = false
    })
}

export function currentMusicIndex(): number {
  return playingIndex
}
