'use client'

import type { KeyboardEvent, ReactElement } from 'react'
import { beadsOfDigit } from '@kira/core'
import { cx } from '@/components/ui/cx'

/**
 * Sempoa virtual. Satu manik atas (nilai 5) dan empat manik bawah (nilai 1) per batang, satu angka per batang.
 * Ketuk saja: ketuk manik atas untuk menurunkan atau menaikkannya, ketuk manik bawah ke-k untuk menggeser
 * sampai k manik menempel di sekat. Tanpa seret.
 */

const ROD_W = 64
const TOP = 6
const BOTTOM = 166
const BEAM = 62
const BEAD_RX = 19
const BEAD_RY = 9.5
const GAP = 20

const PLACE = ['ones', 'tens', 'hundreds']

function heavenY(active: boolean): number {
  return active ? BEAM - 3 - BEAD_RY - 1 : TOP + BEAD_RY + 4
}

/** Manik bawah ke-k (1 paling dekat sekat). Aktif menempel di sekat, tidak aktif menempel di bawah. */
function earthY(k: number, active: boolean): number {
  return active ? BEAM + 3 + BEAD_RY + 1 + (k - 1) * GAP : BOTTOM - 4 - BEAD_RY - (4 - k) * GAP
}

export function Soroban({
  digits,
  onChange,
  hidden = false,
  labels = false,
  showValues = false,
  disabled = false,
  className,
}: {
  digits: readonly number[]
  /** Bila diisi, manik bisa diketuk. */
  onChange?: (digits: number[]) => void
  /** Sembunyikan manik (latihan anzan): hanya bingkai yang terlihat. */
  hidden?: boolean
  /** Tulis nama nilai tempat di bawah batang. */
  labels?: boolean
  /** Tulis nilai 5 dan 1 di manik (untuk pelajaran nilai manik). */
  showValues?: boolean
  disabled?: boolean
  className?: string
}): ReactElement {
  const rods = digits.length
  const width = rods * ROD_W + 20
  const height = BOTTOM + 8 + (labels ? 22 : 0)
  const interactive = Boolean(onChange) && !disabled

  const set = (rod: number, next: { heaven: 0 | 1; earth: number }) => {
    if (!onChange) return
    const copy = digits.slice()
    copy[rod] = next.heaven * 5 + next.earth
    onChange(copy)
  }

  const key = (e: KeyboardEvent, fn: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      fn()
    }
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Soroban with ${rods} ${rods === 1 ? 'rod' : 'rods'}`}
      className={cx('h-auto w-full max-w-[360px] flex-none', className)}
      style={{ maxWidth: Math.max(200, width * 2.6) }}
    >
      <rect x="2" y="2" width={width - 4} height={BOTTOM + 2} rx="12" className="fill-surface stroke-mental" strokeWidth="4" />
      {digits.map((d, i) => {
        const cx0 = 10 + i * ROD_W + ROD_W / 2
        const b = beadsOfDigit(d)
        const place = PLACE[rods - 1 - i] ?? ''
        return (
          <g key={i}>
            <line x1={cx0} y1={TOP} x2={cx0} y2={BOTTOM} className="stroke-fg" strokeWidth="3" />
            {hidden ? null : (
              <>
                <g
                  {...(interactive ? { role: 'button', tabIndex: 0, 'aria-label': `Upper bead, ${place} rod, ${b.heaven ? 'down' : 'up'}`, onClick: () => set(i, { heaven: b.heaven ? 0 : 1, earth: b.earth }), onKeyDown: (e: KeyboardEvent) => key(e, () => set(i, { heaven: b.heaven ? 0 : 1, earth: b.earth })) } : { 'aria-hidden': true })}
                  className={interactive ? 'cursor-pointer outline-offset-2 focus-visible:outline-3 focus-visible:outline-fg' : undefined}
                >
                  <rect x={cx0 - ROD_W / 2 + 4} y={heavenY(b.heaven === 1) - 15} width={ROD_W - 8} height="30" fill="transparent" />
                  <ellipse cx={cx0} cy={heavenY(b.heaven === 1)} rx={BEAD_RX} ry={BEAD_RY} className="fill-star stroke-fg" strokeWidth="2.5" />
                  {showValues ? <text x={cx0} y={heavenY(b.heaven === 1) + 4.5} textAnchor="middle" className="fill-fg font-display" fontSize="13" fontWeight="700">5</text> : null}
                </g>
                {[1, 2, 3, 4].map((k) => {
                  const active = b.earth >= k
                  const next = active ? k - 1 : k
                  return (
                    <g
                      key={k}
                      {...(interactive ? { role: 'button', tabIndex: 0, 'aria-label': `Lower bead ${k}, ${place} rod, ${active ? 'up' : 'down'}`, onClick: () => set(i, { heaven: b.heaven, earth: next }), onKeyDown: (e: KeyboardEvent) => key(e, () => set(i, { heaven: b.heaven, earth: next })) } : { 'aria-hidden': true })}
                      className={interactive ? 'cursor-pointer outline-offset-2 focus-visible:outline-3 focus-visible:outline-fg' : undefined}
                    >
                      <rect x={cx0 - ROD_W / 2 + 4} y={earthY(k, active) - 10} width={ROD_W - 8} height="20" fill="transparent" />
                      <ellipse cx={cx0} cy={earthY(k, active)} rx={BEAD_RX} ry={BEAD_RY} className="fill-mental-50 stroke-fg" strokeWidth="2.5" />
                      {showValues ? <text x={cx0} y={earthY(k, active) + 4.5} textAnchor="middle" className="fill-fg font-display" fontSize="13" fontWeight="700">1</text> : null}
                    </g>
                  )
                })}
              </>
            )}
            {labels ? <text x={cx0} y={BOTTOM + 22} textAnchor="middle" className="fill-fg-muted" fontSize="13" fontWeight="600">{place}</text> : null}
          </g>
        )
      })}
      <rect x="8" y={BEAM - 3} width={width - 16} height="6" rx="3" className="fill-mental stroke-fg" strokeWidth="1.5" />
    </svg>
  )
}
