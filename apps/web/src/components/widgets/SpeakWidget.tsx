'use client'

import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { useOnline } from '@/components/learner/hooks'
import { formatClock } from '@/components/learner/Timer'
import { useT } from '@/lib/i18n/client'
import { asMedia } from './answers'
import type { WidgetProps } from './types'

/**
 * Jawaban suara dinilai tutor (papan RunnerBicara, Izin, Rekam, Dengar).
 * Mikrofon baru diminta setelah anak mengetuk Record. Alur: siap, minta izin, merekam
 * dengan meter suara dan waktu, dengar ulang, kirim. Rekaman diunggah lewat onUpload,
 * lalu nilai menjadi { mediaId }. Tanpa onUpload, jawaban suara dianggap dimatikan.
 */

type Phase = 'ready' | 'permission' | 'blocked' | 'recording' | 'recorded' | 'uploading' | 'failed'

const BARS = 16

function pickMime(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) {
    if (MediaRecorder.isTypeSupported(m)) return m
  }
  return ''
}

export function SpeakWidget({ item, value, onChange, disabled = false, onUpload, onSkip }: WidgetProps): ReactElement {
  const maxSec = item.maxSeconds ?? 60
  const sentId = asMedia(value)
  const online = useOnline()
  const [phase, setPhase] = useState<Phase>('ready')
  const [secs, setSecs] = useState(0)
  const [levels, setLevels] = useState<number[]>(() => Array.from({ length: BARS }, () => 0.15))
  const [len, setLen] = useState(0)
  const [pos, setPos] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [live, setLive] = useState('')
  const dict = useT()

  const recRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef(0)
  const tickRef = useRef(0)
  const blobRef = useRef<Blob | null>(null)
  const urlRef = useRef<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const stopStream = () => {
    window.cancelAnimationFrame(rafRef.current)
    window.clearInterval(tickRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    void ctxRef.current?.close().catch(() => undefined)
    ctxRef.current = null
  }

  useEffect(() => {
    return () => {
      try {
        if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop()
      } catch {
        // Perekam sudah berhenti.
      }
      stopStream()
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    }
  }, [])

  const stop = () => {
    const rec = recRef.current
    if (rec && rec.state !== 'inactive') rec.stop()
  }

  const start = async () => {
    if (disabled) return
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setPhase('blocked')
      return
    }
    setPhase('permission')
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setPhase('blocked')
      return
    }
    streamRef.current = stream
    const mime = pickMime()
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' })
      blobRef.current = blob
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      urlRef.current = URL.createObjectURL(blob)
      if (audioRef.current) audioRef.current.src = urlRef.current
      stopStream()
      setPos(0)
      setPlaying(false)
      setPhase('recorded')
    }
    recRef.current = rec

    // Meter suara dari AnalyserNode, diperbarui sekitar 10 kali per detik.
    try {
      const Ctx = window.AudioContext
      const ctx = new Ctx()
      ctxRef.current = ctx
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      src.connect(analyser)
      const data = new Uint8Array(analyser.fftSize)
      let last = 0
      const loop = (t: number) => {
        rafRef.current = window.requestAnimationFrame(loop)
        if (t - last < 100) return
        last = t
        analyser.getByteTimeDomainData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) {
          const x = ((data[i] ?? 128) - 128) / 128
          sum += x * x
        }
        const rms = Math.min(1, Math.sqrt(sum / data.length) * 4)
        setLevels((l) => [...l.slice(1), Math.max(0.12, rms)])
      }
      rafRef.current = window.requestAnimationFrame(loop)
    } catch {
      // Tanpa meter suara rekaman tetap berjalan.
    }

    const started = Date.now()
    setSecs(0)
    tickRef.current = window.setInterval(() => {
      const s = Math.floor((Date.now() - started) / 1000)
      setSecs(s)
      setLen(s)
      if (s >= maxSec) stop()
    }, 250)
    rec.start(250)
    setPhase('recording')
    setLive(dict.widgets.speak.recordingLive)
  }

  const send = async () => {
    const blob = blobRef.current
    if (!blob || !onUpload) return
    setPhase('uploading')
    try {
      const res = await onUpload(blob, 'audio')
      if (res) {
        onChange({ mediaId: res.mediaId })
        setLive(dict.widgets.speak.sentLive)
      } else setPhase('failed')
    } catch {
      setPhase('failed')
    }
  }

  const again = () => {
    blobRef.current = null
    setLen(0)
    setPos(0)
    setPlaying(false)
    onChange(null)
    setPhase('ready')
  }

  const togglePlay = () => {
    const a = audioRef.current
    if (!a) return
    if (a.paused) void a.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
    else {
      a.pause()
      setPlaying(false)
    }
  }

  useEffect(() => {
    if (phase === 'recorded') setLive(dict.widgets.speak.recordedLive(formatClock(len)))
  }, [phase, len, dict])

  let body: ReactElement
  if (!onUpload) {
    body = (
      <Centered>
        <Circle tone="muted">
          <UiIcon name="mic-off" size={48} />
        </Circle>
        <span className="font-display text-h1 font-semibold">{dict.widgets.speak.offTitle}</span>
        <p className="m-0 max-w-[320px] text-body-lg">{dict.widgets.speak.offBody}</p>
        {onSkip ? <Button onClick={onSkip}>{dict.widgets.shared.skipThisOne}</Button> : null}
      </Centered>
    )
  } else if (sentId) {
    body = (
      <Centered>
        <span className="flex h-24 w-24 items-center justify-center rounded-card border-2 border-fg bg-success text-white">
          <UiIcon name="check" size={52} />
        </span>
        <span className="font-display text-h1 font-semibold">{dict.widgets.speak.sentTitle}</span>
        <p className="m-0 max-w-[320px] text-body-lg">{dict.widgets.speak.sentBody}</p>
      </Centered>
    )
  } else if (phase === 'blocked') {
    body = (
      <Centered>
        <Circle tone="muted">
          <UiIcon name="mic-off" size={48} />
        </Circle>
        <span className="font-display text-h1 font-semibold">{dict.widgets.speak.blockedTitle}</span>
        <p className="m-0 max-w-[320px] text-body-lg">{dict.widgets.speak.blockedBody}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button variant="secondary" onClick={() => void start()}>
            {dict.common.tryAgain}
          </Button>
          {onSkip ? <Button onClick={onSkip}>{dict.widgets.shared.skipThisOne}</Button> : null}
        </div>
      </Centered>
    )
  } else if (phase === 'permission') {
    body = (
      <Centered>
        <Circle tone="ink">
          <UiIcon name="mic" size={60} />
        </Circle>
        <span className="font-display text-h1 font-semibold">{dict.widgets.speak.allowTitle}</span>
        <p className="m-0 max-w-[320px] text-body-lg">{dict.widgets.speak.allowBody}</p>
      </Centered>
    )
  } else if (phase === 'recording') {
    body = (
      <Centered>
        <div aria-hidden="true" className="flex h-14 items-center gap-1.25">
          {levels.map((l, i) => (
            <span key={i} className="w-2 rounded-pill bg-danger" style={{ height: `${Math.round(8 + l * 48)}px` }} />
          ))}
        </div>
        <button
          type="button"
          onClick={stop}
          aria-label={dict.widgets.speak.stop}
          className="flex h-34 w-34 cursor-pointer items-center justify-center rounded-pill border-6 border-danger-50 bg-danger p-0 text-white active:scale-97"
        >
          <UiIcon name="stop" size={48} />
        </button>
        <span className="inline-flex items-baseline gap-2.5">
          <span className="font-numbers text-h1 font-semibold tabular-nums">{formatClock(secs)}</span>
          <span className="text-body font-semibold text-fg-muted">{dict.widgets.speak.ofMax(formatClock(maxSec))}</span>
        </span>
        <p className="m-0 text-body-lg font-bold">{dict.widgets.speak.recordingHint}</p>
      </Centered>
    )
  } else if (phase === 'recorded' || phase === 'uploading' || phase === 'failed') {
    const progress = len > 0 ? pos / len : 0
    body = (
      <div className="flex flex-1 flex-col justify-center gap-5">
        <div className="flex items-center gap-3.5 rounded-card border-2 border-border p-4">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? dict.widgets.speak.pause : dict.widgets.speak.listen}
            className="flex h-14 w-14 flex-none cursor-pointer items-center justify-center rounded-pill bg-fg p-0 text-white"
          >
            <UiIcon name={playing ? 'pause' : 'play'} size={24} />
          </button>
          <div aria-hidden="true" className="flex h-12 min-w-0 flex-1 items-center gap-1">
            {Array.from({ length: 20 }, (_, i) => (
              <span
                key={i}
                className={cx('min-w-0 flex-1 rounded-pill', i / 20 < progress ? 'bg-fg' : 'bg-review')}
                style={{ height: `${8 + ((i * 13 + 5) % 7) * 5}px` }}
              />
            ))}
          </div>
          <span className="flex-none text-body font-bold tabular-nums">
            {formatClock(pos)} / {formatClock(len)}
          </span>
          <audio
            ref={audioRef}
            src={urlRef.current ?? undefined}
            preload="auto"
            onTimeUpdate={(e) => setPos(Math.floor(e.currentTarget.currentTime))}
            onEnded={() => {
              setPlaying(false)
              setPos(0)
            }}
            className="hidden"
          />
        </div>
        {phase === 'failed' ? (
          <p role="alert" className="m-0 rounded-control border-2 border-warn bg-surface px-4 py-3 text-body-lg font-semibold">
            {dict.widgets.speak.failed}
          </p>
        ) : !online ? (
          <p className="m-0 flex items-center gap-2 text-body-lg font-semibold">
            <UiIcon name="offline" size={22} />
            {dict.widgets.speak.offline}
          </p>
        ) : (
          <p className="m-0 text-body-lg">{dict.widgets.speak.listenToCheck}</p>
        )}
        <div className="flex flex-col gap-3">
          <Button icon="send" loading={phase === 'uploading'} disabled={!online} onClick={() => void send()}>
            {phase === 'uploading' ? dict.widgets.shared.sending : dict.widgets.shared.sendToTutor}
          </Button>
          <Button variant="secondary" icon="replay" disabled={phase === 'uploading'} onClick={again}>
            {dict.widgets.speak.recordAgain}
          </Button>
        </div>
      </div>
    )
  } else {
    body = (
      <Centered>
        <button
          type="button"
          onClick={() => void start()}
          disabled={disabled}
          aria-label={dict.widgets.speak.recordAria}
          className="flex h-34 w-34 cursor-pointer items-center justify-center rounded-pill bg-fg p-0 text-white transition-transform duration-150 ease-kira active:scale-97 disabled:cursor-not-allowed disabled:bg-divider"
        >
          <UiIcon name="mic" size={60} />
        </button>
        <span className="font-display text-h1 font-semibold">{dict.widgets.speak.record}</span>
        <p className="m-0 max-w-[300px] text-body-lg">{dict.widgets.speak.recordHint(maxSec)}</p>
      </Centered>
    )
  }

  return (
    <section aria-label={dict.widgets.shared.yourAnswer} className="flex w-full flex-col gap-4">
      <span role="status" className="visually-hidden">
        {live}
      </span>
      {body}
      <p className="m-0 flex items-center gap-2 border-t border-divider pt-3.5 text-body text-fg-muted">
        <UiIcon name="lock" size={20} />
        {dict.widgets.speak.onlyTutor}
      </p>
    </section>
  )
}

function Centered({ children }: { children: ReactNode }): ReactElement {
  return <div className="flex flex-1 flex-col items-center justify-center gap-4 py-4 text-center">{children}</div>
}

function Circle({ children, tone }: { children: ReactNode; tone: 'muted' | 'ink' }): ReactElement {
  return (
    <span
      className={cx(
        'flex h-24 w-24 items-center justify-center rounded-pill',
        tone === 'muted' ? 'border-2 border-border bg-bg text-fg-muted' : 'bg-fg text-white',
      )}
    >
      {children}
    </span>
  )
}
