'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { hasNativeBridge, nativeReady, nativeSpeak, nativeStop, nativeTtsReady } from '@/lib/native'

/**
 * Baca suara. Di APK tablet memakai TextToSpeech Android lewat jembatan KiraNative (lib/native.ts),
 * di browser memakai Web Speech API dengan suara en-GB atau id-ID. WebView Android tidak punya
 * suara Web Speech, jadi jembatan dipakai lebih dulu bila sudah siap.
 * Hanya satu teks dibaca pada satu waktu; tombol lain kembali ke idle.
 */

export type SpeechLang = 'en-GB' | 'id'
export type SpeechStatus = 'idle' | 'reading' | 'unavailable'

const EVENT = 'kira:speech-start'
const RATE = 0.9

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
  if (hasNativeBridge()) nativeStop()
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
    let cancelled = false
    let detach: (() => void) | undefined
    const checkWebSpeech = () => {
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
      detach = () => {
        window.speechSynthesis.removeEventListener('voiceschanged', check)
        window.clearTimeout(t)
      }
    }
    if (hasNativeBridge()) {
      void nativeReady().then((ready) => {
        if (cancelled) return
        if (ready?.tts) setAvailable(true)
        else checkWebSpeech()
      })
    } else {
      checkWebSpeech()
    }
    return () => {
      cancelled = true
      detach?.()
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
      const speakWeb = () => {
        const voice = pickVoice(lang)
        if (!voice || !('speechSynthesis' in window)) {
          setReading(false)
          setAvailable(false)
          return
        }
        try {
          window.speechSynthesis.cancel()
          const u = new SpeechSynthesisUtterance(text)
          u.voice = voice
          u.lang = voice.lang
          u.rate = RATE
          u.onend = finish
          u.onerror = finish
          setReading(true)
          window.speechSynthesis.speak(u)
        } catch {
          setReading(false)
        }
      }
      if (nativeTtsReady()) {
        setReading(true)
        nativeSpeak(text, lang, RATE).then(finish, finish)
        return
      }
      if (hasNativeBridge()) {
        // Jembatan ada tetapi belum menjawab hello: tunggu sebentar, lalu pilih jalurnya.
        setReading(true)
        void nativeReady().then((ready) => {
          if (token.current !== my) return
          if (ready?.tts) nativeSpeak(text, lang, RATE).then(finish, finish)
          else speakWeb()
        })
        return
      }
      speakWeb()
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
