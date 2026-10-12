'use client'

import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactElement } from 'react'
import { BORDER, DIVIDER, ENGLISH, INK, MATH, SCIENCE, STAR, WARN, WHITE } from '@kira/figures/palette'
import { Button, IconButton } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { useOnline } from '@/components/learner/hooks'
import { asMedia } from './answers'
import type { WidgetProps } from './types'

/**
 * Menggambar dinilai tutor (papan RunnerMenggambar). Kanvas dengan pena, penghapus,
 * enam warna, undo, redo, hapus semua dengan konfirmasi, dan kertas kosong, berpetak,
 * bergaris, atau bertitik. Gambar diekspor PNG lewat onUpload, lalu nilai { mediaId }.
 */

type Bg = 'blank' | 'grid' | 'lines' | 'dots'
type Stroke = { tool: 'pen' | 'eraser'; color: string; points: [number, number][] }

const W = 700
const H = 512
const PEN = 6
const ERASER = 28

const COLOURS: { hex: string; name: string; swatch: string }[] = [
  { hex: INK, name: 'Black', swatch: 'bg-fg' },
  { hex: MATH, name: 'Blue', swatch: 'bg-math' },
  { hex: SCIENCE, name: 'Green', swatch: 'bg-science' },
  { hex: ENGLISH, name: 'Red', swatch: 'bg-english' },
  { hex: STAR, name: 'Yellow', swatch: 'bg-star' },
  { hex: WARN, name: 'Brown', swatch: 'bg-warn' },
]

const BG_NAME: Record<Bg, string> = { blank: 'Blank', grid: 'Squares', lines: 'Lines', dots: 'Dots' }

function drawBackground(ctx: CanvasRenderingContext2D, bg: Bg): void {
  ctx.fillStyle = WHITE
  ctx.fillRect(0, 0, W, H)
  if (bg === 'blank') return
  ctx.strokeStyle = bg === 'lines' ? BORDER : DIVIDER
  ctx.fillStyle = BORDER
  ctx.lineWidth = 1
  if (bg === 'grid') {
    for (let x = 24; x < W; x += 24) {
      ctx.beginPath()
      ctx.moveTo(x + 0.5, 0)
      ctx.lineTo(x + 0.5, H)
      ctx.stroke()
    }
    for (let y = 24; y < H; y += 24) {
      ctx.beginPath()
      ctx.moveTo(0, y + 0.5)
      ctx.lineTo(W, y + 0.5)
      ctx.stroke()
    }
  } else if (bg === 'lines') {
    for (let y = 48; y < H; y += 48) {
      ctx.beginPath()
      ctx.moveTo(0, y + 0.5)
      ctx.lineTo(W, y + 0.5)
      ctx.stroke()
    }
  } else {
    for (let x = 24; x < W; x += 24) for (let y = 24; y < H; y += 24) ctx.fillRect(x - 1, y - 1, 2.5, 2.5)
  }
}

function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, from = 0): void {
  if (s.points.length === 0) return
  ctx.save()
  ctx.globalCompositeOperation = s.tool === 'eraser' ? 'destination-out' : 'source-over'
  ctx.strokeStyle = s.color
  ctx.fillStyle = s.color
  ctx.lineWidth = s.tool === 'eraser' ? ERASER : PEN
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const pts = s.points
  if (pts.length === 1) {
    const p = pts[0]
    if (p) {
      ctx.beginPath()
      ctx.arc(p[0], p[1], ctx.lineWidth / 2, 0, Math.PI * 2)
      ctx.fill()
    }
  } else {
    ctx.beginPath()
    const start = pts[Math.max(0, from - 1)]
    if (start) ctx.moveTo(start[0], start[1])
    for (let i = Math.max(1, from); i < pts.length; i++) {
      const p = pts[i]
      if (p) ctx.lineTo(p[0], p[1])
    }
    ctx.stroke()
  }
  ctx.restore()
}

export function DrawWidget({ item, value, onChange, disabled = false, onUpload, onSkip }: WidgetProps): ReactElement {
  const sentId = asMedia(value)
  const online = useOnline()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [redo, setRedo] = useState<Stroke[]>([])
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen')
  const [colour, setColour] = useState(INK)
  const [bg, setBg] = useState<Bg>(item.drawBackground ?? 'blank')
  const [confirm, setConfirm] = useState(false)
  const [emptyErr, setEmptyErr] = useState(false)
  const [mode, setMode] = useState<'draw' | 'paper'>(onUpload ? 'draw' : 'paper')
  const [sending, setSending] = useState(false)
  const [failed, setFailed] = useState(false)
  const current = useRef<Stroke | null>(null)
  const [dpr, setDpr] = useState(1)
  const locked = disabled || !!sentId || sending

  useEffect(() => {
    setDpr(Math.min(3, Math.max(1, window.devicePixelRatio || 1)))
  }, [])

  const ctx2d = useCallback((): CanvasRenderingContext2D | null => {
    const ctx = canvasRef.current?.getContext('2d') ?? null
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
    return ctx
  }, [dpr])

  const redraw = useCallback(
    (list: Stroke[]) => {
      const ctx = ctx2d()
      if (!ctx) return
      ctx.clearRect(0, 0, W, H)
      for (const s of list) drawStroke(ctx, s)
    },
    [ctx2d],
  )

  useEffect(() => {
    redraw(strokes)
  }, [strokes, redraw, mode, dpr])

  const point = (e: PointerEvent<HTMLCanvasElement>): [number, number] | null => {
    const c = canvasRef.current
    if (!c) return null
    const r = c.getBoundingClientRect()
    if (!r.width || !r.height) return null
    return [Math.round(((e.clientX - r.left) / r.width) * W), Math.round(((e.clientY - r.top) / r.height) * H)]
  }

  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (locked || mode !== 'draw') return
    const p = point(e)
    if (!p) return
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Pointer capture tidak didukung: gambar tetap jalan.
    }
    setConfirm(false)
    setEmptyErr(false)
    current.current = { tool, color: colour, points: [p] }
    const ctx = ctx2d()
    if (ctx) drawStroke(ctx, current.current)
  }
  const move = (e: PointerEvent<HTMLCanvasElement>) => {
    const s = current.current
    if (!s) return
    const p = point(e)
    if (!p) return
    s.points.push(p)
    const ctx = ctx2d()
    if (ctx) drawStroke(ctx, s, s.points.length - 1)
  }
  const up = () => {
    const s = current.current
    current.current = null
    if (!s) return
    setStrokes((list) => [...list, s])
    setRedo([])
  }

  const send = async () => {
    if (!onUpload) return
    if (strokes.length === 0) {
      setEmptyErr(true)
      return
    }
    const out = document.createElement('canvas')
    out.width = W
    out.height = H
    const ctx = out.getContext('2d')
    const src = canvasRef.current
    if (!ctx || !src) return
    drawBackground(ctx, bg)
    ctx.drawImage(src, 0, 0, W, H)
    const blob = await new Promise<Blob | null>((resolve) => out.toBlob((b) => resolve(b), 'image/png'))
    if (!blob) {
      setFailed(true)
      return
    }
    setSending(true)
    setFailed(false)
    try {
      const res = await onUpload(blob, 'drawing')
      if (res) onChange({ mediaId: res.mediaId })
      else setFailed(true)
    } catch {
      setFailed(true)
    } finally {
      setSending(false)
    }
  }

  const tile = (on: boolean, off = false) =>
    cx(
      'flex h-14 w-14 flex-none items-center justify-center rounded-control p-0 text-fg',
      off ? 'cursor-not-allowed border-2 border-divider bg-bg text-border' : on ? 'cursor-pointer border-3 border-fg bg-science-50' : 'cursor-pointer border-2 border-border bg-surface hover:border-fg',
    )

  const undoOff = locked || strokes.length === 0
  const redoOff = locked || redo.length === 0

  return (
    <section aria-label="Your drawing" className="flex w-full flex-col gap-3.5">
      {mode === 'draw' && !sentId ? (
        <div role="toolbar" aria-label="Drawing tools" className="flex flex-wrap items-center gap-2">
          <button type="button" aria-label="Pen" aria-pressed={tool === 'pen'} disabled={locked} onClick={() => setTool('pen')} className={tile(tool === 'pen')}>
            <UiIcon name="pencil" size={26} />
          </button>
          <button type="button" aria-label="Rubber" aria-pressed={tool === 'eraser'} disabled={locked} onClick={() => setTool('eraser')} className={tile(tool === 'eraser')}>
            <UiIcon name="eraser" size={26} />
          </button>
          <span aria-hidden="true" className="mx-1 h-9 w-0.5 flex-none bg-divider" />
          <div role="radiogroup" aria-label="Colour" className="flex flex-wrap items-center gap-1.5">
            {COLOURS.map((c) => {
              const on = tool === 'pen' && colour === c.hex
              return (
                <button
                  key={c.hex}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={c.name}
                  disabled={locked}
                  onClick={() => {
                    setColour(c.hex)
                    setTool('pen')
                  }}
                  className={cx('flex h-12 w-12 flex-none cursor-pointer items-center justify-center rounded-pill bg-surface p-0', on ? 'border-3 border-fg' : 'border-2 border-divider')}
                >
                  <span className={cx('h-7.5 w-7.5 rounded-pill', c.swatch)} />
                </button>
              )
            })}
          </div>
          <span aria-hidden="true" className="mx-1 h-9 w-0.5 flex-none bg-divider" />
          <IconButton
            icon="undo"
            label="Undo"
            disabled={undoOff}
            onClick={() => {
              const last = strokes[strokes.length - 1]
              if (!last) return
              setStrokes(strokes.slice(0, -1))
              setRedo([...redo, last])
            }}
          />
          <IconButton
            icon="redo"
            label="Redo"
            disabled={redoOff}
            onClick={() => {
              const last = redo[redo.length - 1]
              if (!last) return
              setRedo(redo.slice(0, -1))
              setStrokes([...strokes, last])
            }}
          />
          <label className="flex items-center gap-2 text-body font-semibold">
            <span className="sr-only sm:not-sr-only">Paper</span>
            <select
              value={bg}
              disabled={locked}
              onChange={(e) => setBg(e.target.value as Bg)}
              className="h-14 rounded-control border-2 border-border bg-surface px-3 text-body"
            >
              {(Object.keys(BG_NAME) as Bg[]).map((b) => (
                <option key={b} value={b}>
                  {BG_NAME[b]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={locked || strokes.length === 0}
            onClick={() => setConfirm(true)}
            className="ml-auto h-14 cursor-pointer rounded-control border-2 border-danger bg-surface px-4 text-body-lg font-bold text-danger disabled:cursor-not-allowed disabled:border-divider disabled:text-border"
          >
            Clear
          </button>
        </div>
      ) : null}

      {mode === 'draw' || sentId ? (
        <div className={cx('relative w-full overflow-hidden rounded-control border-2 border-border', bg === 'grid' ? 'paper-grid' : 'bg-surface')}>
          {bg === 'lines' || bg === 'dots' ? <PaperPattern bg={bg} /> : null}
          <canvas
            ref={canvasRef}
            width={W * dpr}
            height={H * dpr}
            aria-label={sentId ? 'Your drawing, sent' : `Drawing area, ${strokes.length} ${strokes.length === 1 ? 'line' : 'lines'} drawn`}
            role="img"
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            onPointerLeave={up}
            className={cx('relative block aspect-[700/512] h-auto w-full touch-none', !locked && 'cursor-crosshair')}
          />
          {strokes.length === 0 && !sentId ? (
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center text-h3 font-semibold text-border">
              Draw here with your finger
            </span>
          ) : null}
          {confirm ? (
            <div role="alertdialog" aria-label="Clear the whole drawing?" className="absolute inset-x-3 top-3 z-10 flex flex-wrap items-center gap-3 rounded-control border-2 border-warn bg-surface py-2.5 pr-3 pl-4">
              <span className="flex-1 text-body-lg font-bold">Clear the whole drawing?</span>
              <Button variant="secondary" size="M" onClick={() => setConfirm(false)} autoFocus>
                Keep it
              </Button>
              <Button
                variant="danger"
                size="M"
                onClick={() => {
                  setRedo([])
                  setStrokes([])
                  setConfirm(false)
                }}
              >
                Yes, clear
              </Button>
            </div>
          ) : null}
          {emptyErr ? (
            <p role="alert" className="absolute bottom-3 left-3 z-10 m-0 flex items-center gap-2 rounded-control border-2 border-warn bg-surface px-3.5 py-2.5 text-body-lg font-bold">
              <UiIcon name="alert-circle" size={22} />
              Draw something first, then send it.
            </p>
          ) : null}
        </div>
      ) : null}

      {sentId ? (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-control border-2 border-success bg-success-50 px-4 py-3">
          <UiIcon name="check-circle" size={28} className="text-success" />
          <span className="flex-1 text-body-lg font-bold">Sent to your tutor. Your tutor will look and give you stars.</span>
        </div>
      ) : mode === 'paper' ? (
        <div role="status" className="flex flex-col gap-3 rounded-control border-2 border-border bg-bg px-4 py-3">
          <span className="text-body-lg font-bold">
            {onUpload
              ? 'Draw it on paper. When you finish, show your tutor. Your tutor takes a photo.'
              : 'Drawings cannot be sent from this device yet. Draw it on paper and show your tutor.'}
          </span>
          <div className="flex flex-wrap gap-3">
            {onUpload ? (
              <Button variant="secondary" onClick={() => setMode('draw')}>
                Draw here
              </Button>
            ) : null}
            {onSkip ? (
              <Button iconAfter="arrow-right" onClick={onSkip}>
                Next question
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="quiet" className="underline" onClick={() => setMode('paper')} disabled={sending}>
            Draw on paper instead
          </Button>
          {failed ? (
            <span role="alert" className="text-body font-semibold text-warn">
              Your drawing did not send. Check the internet and try again.
            </span>
          ) : !online ? (
            <span className="inline-flex items-center gap-2 text-body font-semibold">
              <UiIcon name="offline" size={20} />
              Offline. Send it when the internet is back.
            </span>
          ) : null}
          <Button icon="send" loading={sending} disabled={!online || disabled} onClick={() => void send()} className="ml-auto">
            {sending ? 'Sending' : 'Send to tutor'}
          </Button>
        </div>
      )}
    </section>
  )
}

/** Garis atau titik di belakang kanvas (kanvas transparan, penghapus tidak menghapus kertas). */
function PaperPattern({ bg }: { bg: 'lines' | 'dots' }): ReactElement {
  return (
    <svg aria-hidden="true" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
      {bg === 'lines'
        ? Array.from({ length: Math.floor(H / 48) }, (_, k) => <line key={k} x1="0" x2={W} y1={48 * (k + 1)} y2={48 * (k + 1)} className="stroke-border" strokeWidth="1" />)
        : Array.from({ length: Math.floor(W / 24) - 1 }, (_, i) =>
            Array.from({ length: Math.floor(H / 24) - 1 }, (_, j) => <circle key={`${i}-${j}`} cx={24 * (i + 1)} cy={24 * (j + 1)} r="1.4" className="fill-border" />),
          )}
    </svg>
  )
}
