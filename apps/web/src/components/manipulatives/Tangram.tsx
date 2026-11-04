'use client'

import { useMemo, useState, type KeyboardEvent, type ReactElement } from 'react'
import { orient, PIECE_NAME, tangramScore, type PieceType, type Placement, type Pt, type TangramState } from '@kira/content/manip'
import { Button } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { playSfx } from '@/components/learner/sfx'
import type { ToolProps } from './types'

/**
 * Tangram: ketuk keping di baki untuk memilihnya, ketuk Turn atau Flip untuk mengubah arahnya, lalu ketuk
 * satu tempat bergaris putus untuk menaruhnya. Keping menempel di garis tempat itu. Ketuk keping yang sudah
 * ditaruh untuk mengambilnya lagi. Nilai: satu entri [keping, putaran, cermin] atau null per tempat.
 */

const FILL: Record<PieceType, string> = {
  L: 'fill-math',
  M: 'fill-science',
  S: 'fill-star',
  Q: 'fill-english',
  P: 'fill-mental',
}

const path = (pts: readonly Pt[], ox = 0, oy = 0) => pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0] + ox} ${p[1] + oy}`).join(" ") + " Z"

const bbox = (pts: readonly Pt[]) => ({ x: Math.min(...pts.map((p) => p[0])), y: Math.min(...pts.map((p) => p[1])), x2: Math.max(...pts.map((p) => p[0])), y2: Math.max(...pts.map((p) => p[1])) })

type Orient = { rot: number; flip: boolean }

export function Tangram({
  value,
  onChange,
  disabled = false,
  feedback = null,
  onMilestone,
  pieces,
  slots,
}: ToolProps<TangramState> & { pieces: PieceType[]; slots: Pt[][] }): ReactElement {
  const locked = disabled || feedback !== null
  const placed: TangramState = value.length === slots.length ? value : slots.map(() => null)
  const [orients, setOrients] = useState<Orient[]>(() => pieces.map(() => ({ rot: 0, flip: false })))
  const [selected, setSelected] = useState<number | null>(null)

  const box = useMemo(() => {
    const all = slots.flat()
    const b = bbox(all)
    return { x: b.x, y: b.y, w: b.x2 - b.x, h: b.y2 - b.y }
  }, [slots])
  const pad = 0.5
  const unit = 56
  const W = (box.w + pad * 2) * unit
  const H = (box.h + pad * 2) * unit

  const where = (pieceIndex: number) => placed.findIndex((p) => p !== null && p[0] === pieceIndex)
  const setPlaced = (next: TangramState) => onChange(next)

  const pickPiece = (idx: number) => {
    if (locked) return
    const at = where(idx)
    if (at >= 0) {
      const pl = placed[at]!
      setOrients((o) => o.map((x, k) => (k === idx ? { rot: pl[1], flip: pl[2] === 1 } : x)))
      setPlaced(placed.map((p, k) => (k === at ? null : p)))
    }
    setSelected(selected === idx ? null : idx)
  }

  const putIn = (slotIndex: number) => {
    if (locked) return
    const existing = placed[slotIndex]
    if (selected === null) {
      // Ambil keping dari tempat ini.
      if (existing) {
        const [p, rot, flip] = existing
        setOrients((o) => o.map((x, k) => (k === p ? { rot, flip: flip === 1 } : x)))
        setPlaced(placed.map((x, k) => (k === slotIndex ? null : x)))
        setSelected(p)
      }
      return
    }
    const o = orients[selected]!
    const pl: Placement = [selected, o.rot, o.flip ? 1 : 0]
    const next = placed.map((x, k) => (k === slotIndex ? pl : x))
    setPlaced(next)
    setSelected(existing ? existing[0] : null)
    playSfx('whoosh')
    onMilestone?.('place')
    const sc = tangramScore({ pieces, slots }, next)
    if (sc.all) onMilestone?.('done')
  }

  const turn = () => {
    if (selected === null || locked) return
    setOrients((o) => o.map((x, k) => (k === selected ? { ...x, rot: (x.rot + 1) % 4 } : x)))
  }
  const flip = () => {
    if (selected === null || locked) return
    setOrients((o) => o.map((x, k) => (k === selected ? { ...x, flip: !x.flip } : x)))
  }
  const reset = () => {
    setPlaced(slots.map(() => null))
    setSelected(null)
  }

  const onKey = (e: KeyboardEvent<SVGElement>, fn: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      fn()
    }
  }

  const trayPieces = pieces.map((t, i) => ({ t, i })).filter(({ i }) => where(i) < 0)
  const doneCount = placed.filter(Boolean).length
  const ring = feedback === 'correct' ? 'stroke-success' : feedback === 'not-yet' ? 'stroke-warn' : 'stroke-fg'

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="paper-grid flex w-full justify-center overflow-hidden rounded-card border border-divider bg-surface p-2">
        <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`Tangram board with ${slots.length} places`} className="h-auto w-full" style={{ touchAction: 'manipulation', maxWidth: W }}>
          <g transform={`translate(${(pad - box.x) * unit} ${(pad - box.y) * unit}) scale(${unit})`}>
            {slots.map((slot, i) => {
              const pl = placed[i]
              const b = bbox(slot)
              const piece = pl ? orient(pieces[pl[0]]!, pl[1], pl[2] === 1) : null
              const type = pl ? pieces[pl[0]]! : null
              return (
                <g
                  key={i}
                  role="button"
                  tabIndex={locked ? -1 : 0}
                  aria-label={`Place ${i + 1} of ${slots.length}, ${pl ? `holds a ${PIECE_NAME[type!]}` : 'empty'}${selected !== null && !pl ? '. Tap to place the chosen piece' : ''}`}
                  onClick={() => putIn(i)}
                  onKeyDown={(e) => onKey(e, () => putIn(i))}
                  // Grup ini ada di dalam scale(unit): outline biasa ikut membesar menutupi papan, jadi fokus keyboard memakai garis tepi.
                  className={cx('outline-none [&:focus-visible>path:first-child]:stroke-fg [&:focus-visible>path:first-child]:[stroke-width:0.14]', !locked && 'cursor-pointer')}
                >
                  <path d={path(slot)} className={cx('fill-bg', selected !== null && !pl && !locked ? 'stroke-fg' : 'stroke-border')} strokeWidth={0.06} strokeDasharray="0.18 0.14" strokeLinejoin="round" />
                  {piece && type ? (
                    <path
                      key={`${pl![0]}-${pl![1]}-${pl![2]}`}
                      d={path(piece, b.x, b.y)}
                      className={cx(FILL[type], ring, 'kira-pop')}
                      style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                      strokeWidth={0.08}
                      strokeLinejoin="round"
                    />
                  ) : null}
                </g>
              )
            })}
          </g>
        </svg>
      </div>

      <div className="flex flex-col gap-3 rounded-card border border-divider bg-surface p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="m-0 text-body font-bold">
            Pieces <span className="font-semibold text-fg-muted">({doneCount} of {slots.length} placed)</span>
          </h3>
          <div className="flex gap-2">
            <Button variant="secondary" size="M" icon="refresh" disabled={locked || selected === null} onClick={turn}>
              Turn
            </Button>
            <Button variant="secondary" size="M" disabled={locked || selected === null} onClick={flip}>
              Flip
            </Button>
          </div>
        </div>
        {trayPieces.length === 0 ? (
          <p className="m-0 text-body text-fg-muted">All pieces are on the board. Tap a piece on the board to pick it up again.</p>
        ) : (
          <div role="group" aria-label="Tray of pieces" className="flex flex-wrap gap-2">
            {trayPieces.map(({ t, i }) => {
              const o = orients[i]!
              const pts = orient(t, o.rot, o.flip)
              const b = bbox(pts)
              const on = selected === i
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={on}
                  aria-label={`${PIECE_NAME[t]}${on ? ', chosen' : ''}${o.rot || o.flip ? `, turned ${o.rot * 90} degrees${o.flip ? ' and flipped' : ''}` : ''}`}
                  disabled={locked}
                  onClick={() => pickPiece(i)}
                  className={cx(
                    'inline-flex h-20 w-20 cursor-pointer items-center justify-center rounded-control border-3 bg-bg p-1.5 transition-[transform,opacity] duration-150 ease-kira enabled:active:scale-95 disabled:cursor-not-allowed',
                    on ? 'border-fg bg-surface' : 'border-divider',
                  )}
                >
                  <svg viewBox={`${b.x - 0.1} ${b.y - 0.1} ${b.x2 - b.x + 0.2} ${b.y2 - b.y + 0.2}`} className="h-full w-full" aria-hidden="true">
                    <path d={path(pts)} className={cx(FILL[t], 'stroke-fg')} strokeWidth={0.08} strokeLinejoin="round" style={{ transition: 'opacity 150ms' }} />
                  </svg>
                </button>
              )
            })}
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <Button variant="quiet" size="M" disabled={locked || doneCount === 0} onClick={reset}>
          Start again
        </Button>
      </div>
    </div>
  )
}
