'use client'

import { useState, type ReactElement } from 'react'
import { cx } from '@/components/ui/cx'
import { SUBJECT_STYLE } from '@/components/learner/subject'
import { asPairs } from './answers'
import type { WidgetProps } from './types'

/**
 * Jodohkan dua kolom (papan RunnerJodohkan) tanpa seret: ketuk satu kartu, lalu ketuk
 * pasangannya di kolom lain. Pasangan diberi nomor yang sama di kedua sisi.
 * Nilai { pairs: number[] }: untuk setiap kiri, indeks asli kanan; -1 bila belum.
 */

type Pending = { side: 'left'; l: number } | { side: 'right'; r: number } | null

export function MatchWidget({ item, value, onChange, disabled = false, feedback = null, subject }: WidgetProps): ReactElement {
  const left = item.matchLeft ?? []
  const right = item.matchRight ?? []
  const pairs = asPairs(value, left.length)
  const [pending, setPending] = useState<Pending>(null)
  const style = SUBJECT_STYLE[subject]
  const locked = disabled || !!feedback

  const pairedLefts = pairs.map((p, l) => (p >= 0 ? l : -1)).filter((l) => l >= 0)
  const numberOfLeft = (l: number) => pairedLefts.indexOf(l) + 1
  const leftOfRight = (r: number) => pairs.findIndex((p) => p === r)

  const commit = (next: number[]) => {
    setPending(null)
    onChange(next.every((p) => p < 0) ? null : { pairs: next })
  }

  const join = (l: number, r: number) => {
    const next = pairs.map((p) => (p === r ? -1 : p))
    next[l] = r
    commit(next)
  }

  const tapLeft = (l: number) => {
    if (locked) return
    if (pending?.side === 'right') return join(l, pending.r)
    if (pending?.side === 'left' && pending.l === l) return setPending(null)
    if ((pairs[l] ?? -1) >= 0) {
      const next = pairs.slice()
      next[l] = -1
      onChange(next.every((p) => p < 0) ? null : { pairs: next })
    }
    setPending({ side: 'left', l })
  }

  const tapRight = (r: number) => {
    if (locked) return
    if (pending?.side === 'left') return join(pending.l, r)
    if (pending?.side === 'right' && pending.r === r) return setPending(null)
    const l = leftOfRight(r)
    if (l >= 0) {
      const next = pairs.slice()
      next[l] = -1
      onChange(next.every((p) => p < 0) ? null : { pairs: next })
    }
    setPending({ side: 'right', r })
  }

  const badge = (n: number) => (
    <span className={cx('ml-auto inline-flex h-7.5 w-7.5 flex-none items-center justify-center rounded-pill font-body text-body font-bold text-white', style.solid)}>{n}</span>
  )

  const cell = 'relative flex min-h-[84px] max-md:min-h-[68px] items-center gap-3 rounded-control px-3.5 py-2.5 text-left text-fg transition-transform duration-150 ease-kira'

  const stateCls = (paired: boolean, isPending: boolean, ok: boolean | null) =>
    ok === true
      ? 'border-3 border-success bg-success-50'
      : ok === false
        ? 'border-3 border-warn bg-surface'
        : isPending
          ? cx('border-3', style.border, style.tint)
          : paired
            ? cx('border-2 bg-surface', style.border)
            : 'border-2 border-border bg-surface'

  return (
    <div className="flex w-full flex-col gap-3" onKeyDown={(e) => e.key === 'Escape' && setPending(null)}>
      <p className="m-0 text-body font-semibold text-fg-muted" aria-live="polite">
        {locked ? 'Your pairs' : pending ? 'Now tap its match.' : 'Tap a card, then tap its match.'}
      </p>
      <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-x-4 gap-y-3 max-md:gap-x-2.5">
        {left.map((text, l) => {
          const r = right[l]
          const pairedL = (pairs[l] ?? -1) >= 0
          const okL = feedback ? pairs[l] === l : null
          const lOfR = r ? leftOfRight(r.i) : -1
          const pairedR = lOfR >= 0
          const okR = feedback && r ? (lOfR >= 0 ? pairs[lOfR] === lOfR : false) : null
          const pendL = pending?.side === 'left' && pending.l === l
          const pendR = !!r && pending?.side === 'right' && pending.r === r.i
          return (
            <div key={l} className="contents">
              <button
                type="button"
                disabled={locked}
                aria-pressed={pendL}
                aria-label={`${text}${pairedL ? `, matched with ${right.find((x) => x.i === pairs[l])?.text ?? ''}` : ''}`}
                onClick={() => tapLeft(l)}
                className={cx(cell, 'font-reading text-h3', stateCls(pairedL, pendL, okL), !locked && 'cursor-pointer active:scale-97')}
              >
                <span className="min-w-0">{text}</span>
                {pairedL ? badge(numberOfLeft(l)) : null}
              </button>
              {r ? (
                <button
                  type="button"
                  disabled={locked}
                  aria-pressed={pendR}
                  aria-label={`${r.text}${pairedR ? ', matched' : ''}`}
                  onClick={() => tapRight(r.i)}
                  className={cx(cell, 'font-reading text-h3 font-bold', stateCls(pairedR, pendR, okR), !locked && 'cursor-pointer active:scale-97')}
                >
                  <span className="min-w-0">{r.text}</span>
                  {pairedR ? badge(numberOfLeft(lOfR)) : null}
                </button>
              ) : (
                <span />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
