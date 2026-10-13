'use client'

import { useEffect } from 'react'
import { precacheClips, ttsStatus } from '@/components/learner/tts-client'

/**
 * Minta service worker menyimpan klip suara bahasa Inggris untuk sesi hari ini supaya suara tetap ada saat
 * internet rumah putus. Tidak melakukan apa pun bila suara Qwen belum aktif di server.
 */
export function TtsRuntime() {
  useEffect(() => {
    let cancelled = false
    void ttsStatus().then((s) => {
      if (!cancelled && s?.enabled) precacheClips(s.urls)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return null
}
