'use client'

import { QUIZ_HOST_LINES, type TtsClipRequest } from '@kira/core/tts'
import { fetchClips, requestClips, ttsStatus } from './tts-client'
import { isSfxMuted } from './sfx'

/**
 * Suara pembawa acara Quiz Arena (gaya quizhost). Hanya memutar klip Qwen yang sudah dibuat lewat /tts/<kunci>.mp3.
 * Bila layanan suara mati, klip belum ada, atau jaringan gagal, tidak ada bunyi sama sekali: suara perangkat tidak
 * dipakai di sini. Klip yang belum ada diminta dibuat supaya siap lain kali. Mengikuti tombol senyap efek suara.
 */

let current: HTMLAudioElement | null = null
let token = 0

export function stopHostVoice(): void {
  token++
  if (current) {
    current.onended = null
    current.pause()
    current = null
  }
}

/** True bila teks ini termasuk kalimat tetap pembawa acara (hanya itu yang dibuat batch lebih dulu). */
export const isHostLine = (text: string): boolean => QUIZ_HOST_LINES.includes(text)

/** Putar satu kalimat pembawa acara setelah delayMs. Tidak pernah melempar dan tidak menunggu hasilnya. */
export function hostSay(text: string, delayMs = 0): void {
  if (typeof window === 'undefined' || !isHostLine(text) || isSfxMuted()) return
  const my = ++token
  const clip: TtsClipRequest = { text, style: 'quizhost' }
  void (async () => {
    try {
      const status = await ttsStatus()
      if (token !== my || !status?.enabled) return
      const set = await fetchClips([clip])
      if (token !== my) return
      if (set.missing.length > 0) requestClips(set.missing)
      const blob = set.blobs[0]
      if (set.failed || !blob) return
      if (delayMs > 0) await new Promise((r) => window.setTimeout(r, delayMs))
      if (token !== my || isSfxMuted()) return
      if (current) current.pause()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      current = audio
      audio.onended = () => {
        URL.revokeObjectURL(url)
        if (current === audio) current = null
      }
      await audio.play().catch(() => URL.revokeObjectURL(url))
    } catch {
      // diam saja
    }
  })()
}
