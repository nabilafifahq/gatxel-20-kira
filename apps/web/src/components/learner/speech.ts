'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'

/**
 * Baca suara. Di APK tablet memakai plugin Capacitor TextToSpeech bila ada,
 * di browser memakai Web Speech API dengan suara en-GB atau id-ID.
 * Hanya satu teks dibaca pada satu waktu; tombol lain kembali ke idle.
 */

export type SpeechLang = 'en-GB' | 'id'
export type SpeechStatus = 'idle' | 'reading' | 'unavailable'

type TtsPlugin = {
  speak(opts: { text: string; lang: string; rate?: number }): Promise<void>
  stop(): Promise<void>
}

declare global {
  interface Window {
    Capacitor?: { Plugins?: { TextToSpeech?: TtsPlugin } }
  }
}

const EVENT = 'kira:speech-start'

function plugin(): TtsPlugin | null {
  if (typeof window === 'undefined') return null
  return window.Capacitor?.Plugins?.TextToSpeech ?? null
}

function pickVoice(lang: SpeechLang): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  const voices = window.speechSynthesis.getVoices()
  if (lang === 'id') {
    return voices.find((v) => /^(id|in)([-_]|$)/i.test(v.lang)) ?? null
  }
  return voices.find((v) => /^en[-_]GB/i.test(v.lang)) ?? voices.find((v) => /^en([-_]|$)/i.test(v.lang)) ?? null
}

/** Hentikan semua bacaan yang sedang berjalan. */
export function stopSpeech(): void {
  const p = plugin()
  if (p) {
    void p.stop().catch(() => undefined)
    return
  }
  try {
    window.speechSynthesis?.cancel()
  } catch {
    // Perangkat tanpa Web Speech: tidak ada yang dihentikan.
  }
}

export function useSpeech(lang: SpeechLang): {
  status: SpeechStatus
  toggle: (text: string) => void
  speak: (text: string, onEnd?: () => void) => void
  stop: () => void
} {
  const id = useId()
  const [available, setAvailable] = useState<boolean | null>(null)
  const [reading, setReading] = useState(false)
  const token = useRef(0)

  useEffect(() => {
    if (plugin()) {
      setAvailable(true)
      return
    }
    if (!('speechSynthesis' in window)) {
      setAvailable(false)
      return
    }
    const check = () => setAvailable(pickVoice(lang) !== null)
    if (window.speechSynthesis.getVoices().length > 0) {
      check()
      return
    }
    // Daftar suara dimuat terlambat di beberapa browser.
    window.speechSynthesis.addEventListener('voiceschanged', check)
    const t = window.setTimeout(check, 1500)
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', check)
      window.clearTimeout(t)
    }
  }, [lang])

  // Tombol lain mulai membaca: yang ini kembali ke idle.
  useEffect(() => {
    const onOther = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== id) {
        token.current++
        setReading(false)
      }
    }
    window.addEventListener(EVENT, onOther)
    return () => window.removeEventListener(EVENT, onOther)
  }, [id])

  // Berhenti membaca saat komponen dilepas, hanya bila komponen ini yang sedang membaca.
  const readingRef = useRef(false)
  useEffect(() => {
    readingRef.current = reading
  }, [reading])
  useEffect(() => {
    return () => {
      if (readingRef.current) stopSpeech()
    }
  }, [])

  const stop = useCallback(() => {
    token.current++
    stopSpeech()
    setReading(false)
  }, [])

  const speak = useCallback(
    (text: string, onEnd?: () => void) => {
      const my = ++token.current
      window.dispatchEvent(new CustomEvent(EVENT, { detail: id }))
      const finish = () => {
        if (token.current !== my) return
        setReading(false)
        onEnd?.()
      }
      const p = plugin()
      if (p) {
        setReading(true)
        p.speak({ text, lang: lang === 'id' ? 'id-ID' : 'en-GB', rate: 0.9 }).then(finish, finish)
        return
      }
      const voice = pickVoice(lang)
      if (!voice || !('speechSynthesis' in window)) {
        setAvailable(false)
        return
      }
      try {
        window.speechSynthesis.cancel()
        const u = new SpeechSynthesisUtterance(text)
        u.voice = voice
        u.lang = voice.lang
        u.rate = 0.9
        u.onend = finish
        u.onerror = finish
        setReading(true)
        window.speechSynthesis.speak(u)
      } catch {
        setReading(false)
      }
    },
    [id, lang],
  )

  const toggle = useCallback(
    (text: string) => {
      if (reading) stop()
      else speak(text)
    },
    [reading, speak, stop],
  )

  const status: SpeechStatus = available === false ? 'unavailable' : reading ? 'reading' : 'idle'
  return { status, toggle, speak, stop }
}
