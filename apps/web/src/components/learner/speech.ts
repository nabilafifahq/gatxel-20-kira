'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { TTS_DEFAULT_STYLE, type TtsStyleId } from '@kira/core/tts'
import { hasNativeBridge, nativeReady, nativeSpeak, nativeStop, nativeTtsReady } from '@/lib/native'
import { clipPlan, deviceText, fetchClips, requestClips, ttsStatus } from './tts-client'

/**
 * Baca suara, hanya untuk teks bahasa Inggris (rencana bagian 11.4: teks Indonesia tidak dibacakan).
 * Urutan: klip Qwen3-TTS yang sudah dibuat (/tts/<kunci>.mp3, dari simpanan service worker bila offline),
 * kalau belum ada diminta dibuat worker dan sementara dibacakan suara perangkat. Di APK tablet suara
 * perangkat lewat TextToSpeech Android (jembatan KiraNative, lib/native.ts), di browser lewat Web Speech API.
 * Hanya satu teks dibaca pada satu waktu; tombol lain kembali ke idle.
 */

export type SpeechLang = 'en-GB' | 'id'
export type SpeechStatus = 'idle' | 'reading' | 'unavailable'
/** Satu teks, atau bagian-bagian berurutan (prompt, lalu tiap opsi) yang masing-masing menjadi klipnya sendiri. */
export type SpeechInput = string | readonly string[]
export type SpeakOptions = { style?: TtsStyleId }

const EVENT = 'kira:speech-start'
const RATE = 0.9
const GAP_MS = 220

function pickVoice(lang: SpeechLang): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  const voices = window.speechSynthesis.getVoices()
  if (lang === 'id') {
    return voices.find((v) => /^(id|in)([-_]|$)/i.test(v.lang)) ?? null
  }
  return voices.find((v) => /^en[-_]GB/i.test(v.lang)) ?? voices.find((v) => /^en([-_]|$)/i.test(v.lang)) ?? null
}

let currentAudio: HTMLAudioElement | null = null

/** Hentikan semua bacaan yang sedang berjalan. */
export function stopSpeech(): void {
  if (currentAudio) {
    currentAudio.onended = null
    currentAudio.onerror = null
    currentAudio.pause()
    currentAudio = null
  }
  if (hasNativeBridge()) nativeStop()
  try {
    window.speechSynthesis?.cancel()
  } catch {
    // Perangkat tanpa Web Speech: tidak ada yang dihentikan.
  }
}

/**
 * Putar klip berurutan. onDone(true) bila semua selesai atau dihentikan; onDone(false) bila klip pertama tidak
 * bisa diputar (misalnya autoplay diblokir), supaya pembaca beralih ke suara perangkat.
 */
function playChain(blobs: Blob[], isCurrent: () => boolean, onDone: (ok: boolean) => void): void {
  const audio = new Audio()
  currentAudio = audio
  let url: string | null = null
  let i = 0
  const release = () => {
    if (url) URL.revokeObjectURL(url)
    url = null
  }
  const end = (ok: boolean) => {
    release()
    audio.onended = null
    audio.onerror = null
    if (currentAudio === audio) currentAudio = null
    onDone(ok)
  }
  const next = () => {
    release()
    if (!isCurrent() || currentAudio !== audio) {
      end(true)
      return
    }
    if (i >= blobs.length) {
      end(true)
      return
    }
    url = URL.createObjectURL(blobs[i++]!)
    audio.src = url
    audio.play().catch(() => end(i > 1))
  }
  audio.onended = () => window.setTimeout(next, GAP_MS)
  audio.onerror = () => end(i > 1)
  next()
}

export function useSpeech(lang: SpeechLang): {
  status: SpeechStatus
  toggle: (input: SpeechInput, opts?: SpeakOptions) => void
  speak: (input: SpeechInput, onEnd?: () => void, opts?: SpeakOptions) => void
  stop: () => void
} {
  const id = useId()
  const [available, setAvailable] = useState<boolean | null>(null)
  const [clipsReady, setClipsReady] = useState(false)
  const [reading, setReading] = useState(false)
  const token = useRef(0)

  useEffect(() => {
    if (lang === 'id') {
      setAvailable(false)
      return
    }
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
    // Bila suara Qwen aktif di server, tombol tetap hidup walau perangkat tidak punya suara bahasa Inggris.
    void ttsStatus().then((s) => {
      if (!cancelled && s?.enabled) setClipsReady(true)
    })
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
    (input: SpeechInput, onEnd?: () => void, opts?: SpeakOptions) => {
      const my = ++token.current
      window.dispatchEvent(new CustomEvent(EVENT, { detail: id }))
      const finish = () => {
        if (token.current !== my) return
        setReading(false)
        onEnd?.()
      }
      if (lang === 'id') {
        // Teks Indonesia tidak dibacakan. onEnd tetap dipanggil supaya pemutar langkah tidak menunggu selamanya.
        window.setTimeout(finish, 0)
        return
      }
      const text = deviceText(input)
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
      const speakDevice = () => {
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
      }

      // Klip Qwen lebih dulu. Semua klip harus ada supaya suaranya tidak berganti di tengah kalimat.
      const plan = clipPlan(input, opts?.style ?? TTS_DEFAULT_STYLE)
      if (plan.length === 0) {
        speakDevice()
        return
      }
      setReading(true)
      void (async () => {
        const status = await ttsStatus()
        if (token.current !== my) return
        if (status && !status.enabled) {
          speakDevice()
          return
        }
        const set = await fetchClips(plan)
        if (token.current !== my) return
        if (!set.failed && set.missing.length === 0 && set.blobs.length === plan.length) {
          playChain(
            set.blobs,
            () => token.current === my,
            (ok) => {
              if (token.current !== my) return
              if (ok) finish()
              else speakDevice()
            },
          )
          return
        }
        if (set.missing.length > 0 && status?.enabled) requestClips(set.missing)
        speakDevice()
      })()
    },
    [id, lang],
  )

  const toggle = useCallback(
    (input: SpeechInput, opts?: SpeakOptions) => {
      if (reading) stop()
      else speak(input, undefined, opts)
    },
    [reading, speak, stop],
  )

  const unavailable = available === false && !(clipsReady && lang === 'en-GB')
  const status: SpeechStatus = unavailable ? 'unavailable' : reading ? 'reading' : 'idle'
  return { status, toggle, speak, stop }
}
