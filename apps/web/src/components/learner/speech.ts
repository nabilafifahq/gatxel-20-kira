'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { TTS_DEFAULT_STYLE, type TtsStyleId } from '@kira/core/tts'
import { duckMusic } from './music'
import { stopHostVoice } from './host-voice'
import { sharedAudio, unlockAudio } from './shared-audio'
import { fetchClipKeys, fetchClips, planForLang, requestClips, ttsStatus, type SpeechPart } from './tts-client'

/**
 * Baca suara. Aturan pemilik: suara tidak boleh berganti. Hanya klip yang sudah dibuat (/tts/<kunci>.mp3, dari simpanan
 * service worker bila offline) yang diputar. Tidak ada suara perangkat (speechSynthesis atau TextToSpeech Android) untuk anak:
 * suara itu bisa laki-laki atau robotik. Bila satu klip belum ada, tombol diam (dan klipnya diminta dibuat worker), tidak
 * pernah berganti suara. Teks Indonesia hanya dibacakan klip `id` yang nyata (kuncinya memakai versi suara Indonesia); selain itu diam.
 * Hanya satu teks dibaca pada satu waktu; tombol lain kembali ke idle.
 */

export type SpeechLang = 'en-GB' | 'id'
export type SpeechStatus = 'idle' | 'reading' | 'unavailable'
/** Satu teks, atau bagian-bagian berurutan (prompt, lalu tiap opsi) yang masing-masing menjadi klipnya sendiri. */
export type SpeechInput = string | readonly SpeechPart[]
export type SpeakOptions = { style?: TtsStyleId }

const EVENT = 'kira:speech-start'
const GAP_MS = 220

let currentAudio: HTMLAudioElement | null = null
/** Rantai klip yang berlaku. Elemennya sama untuk semua rantai, jadi rantai lama dikenali dari nomor ini. */
let chainSeq = 0

/** Diamkan klip yang sedang diputar, tanpa memberi tahu tombol. */
function silence(): void {
  chainSeq++
  if (currentAudio) {
    currentAudio.onended = null
    currentAudio.onerror = null
    currentAudio.pause()
    currentAudio = null
  }
}

/** Hentikan semua bacaan yang sedang berjalan, dan semua tombol baca kembali ke idle. */
export function stopSpeech(): void {
  silence()
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENT, { detail: '' }))
}

// Pembawa acara kuis mulai bicara: bacaan soal berhenti, tidak ada bunyi di atas bunyi lain.
if (typeof window !== 'undefined') window.addEventListener('kira:host-start', () => stopSpeech())

/** Putar klip berurutan. onDone(true) bila semua selesai atau dihentikan; onDone(false) bila klip pertama tidak bisa diputar. */
function playChain(blobs: Blob[], isCurrent: () => boolean, onDone: (ok: boolean) => void): void {
  const chain = ++chainSeq
  const live = () => chain === chainSeq
  const audio = sharedAudio()
  currentAudio = audio
  let url: string | null = null
  let i = 0
  const release = () => {
    if (url) URL.revokeObjectURL(url)
    url = null
  }
  const end = (ok: boolean) => {
    release()
    // Rantai baru sudah memakai elemen yang sama: penangan dan tombolnya milik rantai itu.
    if (!live()) return
    audio.onended = null
    audio.onerror = null
    currentAudio = null
    onDone(ok)
  }
  const next = () => {
    release()
    if (!live() || !isCurrent()) {
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
  /** Putar klip menurut kuncinya. Tanpa suara perangkat. onFail bila klip tidak ada atau gagal diputar. */
  playKeys: (keys: readonly string[], onFail: () => void) => void
  stop: () => void
  /** Bacaan terakhir tidak berbunyi: klip gagal dimuat (offline atau server tidak terjangkau) atau belum dibuat. */
  problem: 'failed' | 'missing' | null
} {
  const id = useId()
  // null = belum tahu; true = layanan klip aktif di server.
  const [clipsReady, setClipsReady] = useState<boolean | null>(null)
  const [reading, setReading] = useState(false)
  const [problem, setProblem] = useState<'failed' | 'missing' | null>(null)
  // Musik latar turun selama bacaan berjalan (ducking).
  useEffect(() => {
    duckMusic(id, reading)
    return () => duckMusic(id, false)
  }, [id, reading])
  const token = useRef(0)

  useEffect(() => {
    let cancelled = false
    void ttsStatus().then((s) => {
      if (!cancelled) setClipsReady(Boolean(lang === 'id' ? s?.idVoiceVersion : s?.enabled))
    })
    return () => {
      cancelled = true
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
      // Tidak ada yang diputar di atas bunyi lain: hentikan bacaan sebelumnya dan suara pembawa acara dulu.
      stopSpeech()
      stopHostVoice()
      unlockAudio()
      // stopSpeech memberi tahu semua tombol, termasuk tombol ini. Token diambil sesudahnya: kalau sebelumnya, bacaan ini langsung usang dan klip tidak pernah diputar.
      const my = ++token.current
      window.dispatchEvent(new CustomEvent(EVENT, { detail: id }))
      const finish = () => {
        if (token.current !== my) return
        setReading(false)
        onEnd?.()
      }
      // Tidak ada teks yang layak dibacakan: diam. onEnd tetap dipanggil supaya pemutar langkah tidak menunggu selamanya.
      const plan = planForLang(input, lang, opts?.style ?? TTS_DEFAULT_STYLE)
      if (plan.length === 0) {
        window.setTimeout(finish, 0)
        return
      }
      setReading(true)
      setProblem(null)
      void (async () => {
        const status = await ttsStatus()
        if (token.current !== my) return
        if (lang === 'id' ? !status?.idVoiceVersion : !status?.enabled) {
          setProblem(lang === 'id' ? 'missing' : 'failed')
          finish()
          return
        }
        const set = await fetchClips(plan)
        if (token.current !== my) return
        if (!set.failed && set.missing.length === 0 && set.blobs.length === plan.length) {
          playChain(
            set.blobs,
            () => token.current === my,
            (ok) => {
              if (!ok) setProblem('failed')
              finish()
            },
          )
          return
        }
        // Ada klip yang belum ada: diam (suara tidak boleh berganti), dan minta worker membuatnya. Tombol menulis alasannya, supaya tidak terasa rusak.
        if (set.missing.length > 0) requestClips(set.missing)
        setProblem(set.failed ? 'failed' : 'missing')
        finish()
      })()
    },
    [id, lang],
  )

  const playKeys = useCallback(
    (keys: readonly string[], onFail: () => void) => {
      stopSpeech()
      stopHostVoice()
      unlockAudio()
      const my = ++token.current // sesudah stopSpeech, yang memberi tahu semua tombol termasuk ini
      window.dispatchEvent(new CustomEvent(EVENT, { detail: id }))
      setReading(true)
      void (async () => {
        const blobs = await fetchClipKeys(keys)
        if (token.current !== my) return
        if (!blobs || blobs.length === 0) {
          setReading(false)
          onFail()
          return
        }
        playChain(
          blobs,
          () => token.current === my,
          (ok) => {
            if (token.current !== my) return
            setReading(false)
            if (!ok) onFail()
          },
        )
      })()
    },
    [id],
  )

  const toggle = useCallback(
    (input: SpeechInput, opts?: SpeakOptions) => {
      if (reading) stop()
      else speak(input, undefined, opts)
    },
    [reading, speak, stop],
  )

  // Tombol disembunyikan bila layanan klip mati; untuk teks Indonesia bila suara Indonesia belum dipromosikan.
  const unavailable = clipsReady === false
  const status: SpeechStatus = unavailable ? 'unavailable' : reading ? 'reading' : 'idle'
  return { status, toggle, speak, playKeys, stop, problem }
}
