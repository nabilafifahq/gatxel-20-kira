'use client'

import { useEffect, useRef, useState, type ChangeEvent, type ReactElement } from 'react'
import { Button } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { useOnline } from '@/components/learner/hooks'
import { asMedia } from './answers'
import type { WidgetProps } from './types'

/**
 * Jawaban foto, dinilai tutor dengan rubrik dan saran AI. Anak memotret jawaban di kertas dengan kamera
 * tablet atau memilih foto dari galeri. Foto diperkecil dan disimpan ulang sebagai JPEG di perangkat (data
 * lokasi dan EXIF tidak ikut), diunggah lewat onUpload, lalu nilai menjadi { mediaId }. Tombol Skip memakai
 * onSkip dari runner bila kamera tidak ada atau foto dimatikan.
 */

const MAX_EDGE = 1600
const PASS_THROUGH = new Set(['image/jpeg', 'image/png', 'image/webp'])

/** Perkecil dan simpan ulang sebagai JPEG. Bila tidak bisa dibaca, berkas asli dipakai hanya bila jenisnya didukung server. */
async function prepare(file: File): Promise<Blob | null> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height))
    const w = Math.max(1, Math.round(bmp.width * scale))
    const h = Math.max(1, Math.round(bmp.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return PASS_THROUGH.has(file.type) ? file : null
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(bmp, 0, 0, w, h)
    bmp.close()
    const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    return out ?? (PASS_THROUGH.has(file.type) ? file : null)
  } catch {
    return PASS_THROUGH.has(file.type) ? file : null
  }
}

type Phase = 'ready' | 'working' | 'failed'

export function PhotoWidget({ value, onChange, disabled = false, onUpload, onSkip }: WidgetProps): ReactElement {
  const sent = asMedia(value)
  const online = useOnline()
  const [phase, setPhase] = useState<Phase>('ready')
  const [message, setMessage] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const urlRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    }
  }, [])

  const unavailable = !onUpload
  const busy = phase === 'working'
  const off = disabled || unavailable || !online

  const take = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !onUpload) return
    setPhase('working')
    setMessage('')
    const blob = await prepare(file)
    if (!blob) {
      setPhase('failed')
      setMessage('This photo could not be read. Try the camera, or choose a different photo.')
      return
    }
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = URL.createObjectURL(blob)
    setPreview(urlRef.current)
    const res = await onUpload(blob, 'image')
    if (!res) {
      setPhase('failed')
      setMessage('The photo did not send. Check your connection and try again. If it keeps failing, ask a grown-up about photos.')
      return
    }
    setPhase('ready')
    onChange({ mediaId: res.mediaId })
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <p className="m-0 text-body font-semibold text-fg-muted" aria-live="polite">
        {sent ? 'Your photo is ready. Send it to your tutor.' : 'Take a photo of your answer on paper.'}
      </p>
      {preview ? (
        // Foto dari perangkat sendiri (blob), bukan aset luar.
        <img src={preview} alt="Your photo of the answer" className="max-h-[50svh] w-full max-w-[420px] rounded-control border-2 border-border bg-surface object-contain" />
      ) : sent ? (
        <p className="m-0 inline-flex items-center gap-2 text-body-lg font-bold">
          <UiIcon name="check" size={22} className="text-success" />
          Photo saved
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button icon="camera" loading={busy} disabled={off || busy} onClick={() => cameraRef.current?.click()}>
          {sent ? 'Take another photo' : 'Take a photo'}
        </Button>
        <Button variant="secondary" disabled={off || busy} onClick={() => galleryRef.current?.click()}>
          Choose a photo
        </Button>
        {onSkip && !sent ? (
          <Button variant="quiet" onClick={onSkip}>
            Skip this one
          </Button>
        ) : null}
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" tabIndex={-1} aria-hidden="true" onChange={(e) => void take(e)} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" tabIndex={-1} aria-hidden="true" onChange={(e) => void take(e)} />
      {!online ? (
        <p role="status" className="m-0 text-body-lg">
          You are offline. Photos need the internet. Skip this one for now, or try again when you are back online.
        </p>
      ) : null}
      {unavailable ? (
        <p role="status" className="m-0 text-body-lg">
          Photos are not available on this screen.
        </p>
      ) : null}
      {phase === 'failed' ? (
        <p role="alert" className={cx('m-0 rounded-control border-2 border-warn bg-warn-50 px-4 py-3 text-body-lg')}>
          {message}
        </p>
      ) : null}
    </div>
  )
}
