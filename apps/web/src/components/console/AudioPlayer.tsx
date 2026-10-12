'use client'

import { useEffect, useRef, useState } from 'react'
import { cx } from './cx'
import { ConsoleIcon } from './icons'

/**
 * Pemutar rekaman jawaban (papan KotakHasil, fase 3): tombol putar 44px, gelombang
 * dekoratif yang terisi sesuai posisi, dan waktu. Memakai elemen <audio> asli;
 * kalau berkas gagal dimuat, pesan error dan tautan unduh tampil.
 */

function clock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const s = Math.floor(sec)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const BARS = Array.from({ length: 28 }, (_, i) => 6 + ((i * 13 + 5) % 7) * 4)

export function AudioPlayer({ src, label }: { src: string; label: string }) {
  const ref = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const a = ref.current
    if (!a) return
    const onTime = () => setTime(a.currentTime)
    const onMeta = () => setDuration(a.duration)
    const onEnd = () => setPlaying(false)
    const onErr = () => setFailed(true)
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('loadedmetadata', onMeta)
    a.addEventListener('ended', onEnd)
    a.addEventListener('error', onErr)
    return () => {
      a.removeEventListener('timeupdate', onTime)
      a.removeEventListener('loadedmetadata', onMeta)
      a.removeEventListener('ended', onEnd)
      a.removeEventListener('error', onErr)
    }
  }, [])

  async function toggle() {
    const a = ref.current
    if (!a) return
    if (playing) {
      a.pause()
      setPlaying(false)
      return
    }
    try {
      await a.play()
      setPlaying(true)
    } catch {
      setFailed(true)
    }
  }

  const frac = duration > 0 ? time / duration : 0
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-3.5 rounded-control border border-divider bg-bg px-3.5 py-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? 'Jeda rekaman' : label}
          className="inline-flex size-11 flex-none cursor-pointer items-center justify-center rounded-pill border-0 bg-fg p-0 text-white hover:bg-fg-muted"
        >
          <ConsoleIcon name={playing ? 'pause' : 'play'} size={20} strokeWidth={3} />
        </button>
        <div aria-hidden="true" className="flex h-9 min-w-0 flex-1 items-center gap-[3px]">
          {BARS.map((h, i) => (
            <span key={i} style={{ height: h }} className={cx('min-w-0 flex-1 rounded-pill', i / BARS.length < frac ? 'bg-fg' : 'bg-review')} />
          ))}
        </div>
        <span className="flex-none text-body font-bold tabular" aria-live="off">
          {clock(time)} / {clock(duration)}
        </span>
        <audio ref={ref} src={src} preload="metadata" className="hidden" />
      </div>
      {failed ? (
        <span role="alert" className="text-small font-bold text-danger">
          Rekaman tidak bisa diputar di peramban ini.{' '}
          <a href={src} download className="font-bold">
            Unduh rekaman
          </a>
        </span>
      ) : null}
    </div>
  )
}
