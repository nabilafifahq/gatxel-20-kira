'use client'

import { useRef } from 'react'
import { cx } from './cx'

/**
 * Isian lembar jawaban kertas (papan LjkGrid, InputLjk). Satu ketukan per jawaban,
 * ketuk lagi untuk menghapus. Nomor kosong yang diikuti nomor terisi ditandai Kosong.
 * Keyboard: saat fokus di sebuah baris, huruf A sampai E mengisi dan pindah ke baris berikutnya,
 * Backspace menghapus. Nomor isian (SEAMO, SASMO) memakai kotak teks.
 */

export const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const

export function skippedNumbers(answers: (string | null)[]): number[] {
  let last = -1
  answers.forEach((a, i) => {
    if (a != null && a !== '') last = i
  })
  const out: number[] = []
  for (let i = 0; i < last; i++) if (answers[i] == null || answers[i] === '') out.push(i + 1)
  return out
}

export function LjkGrid({
  answers,
  optionCount,
  shortAnswerFrom,
  onChange,
  columns = 4,
}: {
  answers: (string | null)[]
  optionCount: 4 | 5
  shortAnswerFrom: number | null
  onChange: (index: number, value: string | null) => void
  columns?: number
}) {
  const rowRefs = useRef<(HTMLLIElement | null)[]>([])
  const letters = LETTERS.slice(0, optionCount)
  const skipped = new Set(skippedNumbers(answers))
  const n = answers.length
  const perCol = Math.ceil(n / columns)
  const cols = Array.from({ length: columns }, (_, c) => answers.map((_, i) => i).slice(c * perCol, (c + 1) * perCol)).filter((c) => c.length)

  function focusRow(i: number) {
    const li = rowRefs.current[i]
    const target = li?.querySelector<HTMLElement>('button, input')
    target?.focus()
  }

  function row(i: number) {
    const num = i + 1
    const v = answers[i] ?? null
    const isShort = shortAnswerFrom != null && num >= shortAnswerFrom
    const skip = skipped.has(num)
    const aria = `Nomor ${num}, ${v ? (isShort ? `isian ${v}` : `jawaban ${v}`) : skip ? 'kosong' : 'belum diisi'}`
    return (
      <li
        key={num}
        ref={(el) => {
          rowRefs.current[i] = el
        }}
        aria-label={aria}
        onKeyDown={(e) => {
          if (isShort) {
            if (e.key === 'Enter') {
              e.preventDefault()
              focusRow(Math.min(n - 1, i + 1))
            }
            return
          }
          const k = e.key.toUpperCase()
          if ((letters as readonly string[]).includes(k) && !e.metaKey && !e.ctrlKey && !e.altKey) {
            e.preventDefault()
            onChange(i, k)
            focusRow(Math.min(n - 1, i + 1))
          } else if (e.key === 'Backspace' || e.key === 'Delete') {
            e.preventDefault()
            onChange(i, null)
          } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            focusRow(Math.min(n - 1, i + 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            focusRow(Math.max(0, i - 1))
          }
        }}
        className={cx(
          'flex min-h-[60px] flex-none items-center gap-1.5 rounded-control bg-surface px-2.5 sm:gap-2',
          skip ? 'border-2 border-warn' : 'border border-divider',
        )}
      >
        <span className="w-[30px] flex-none text-body font-bold tabular">{num}</span>
        {isShort ? (
          <label className="flex min-w-0 flex-1 items-center gap-2">
            <span className="visually-hidden">Jawaban isian nomor {num}</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={v ?? ''}
              onChange={(e) => onChange(i, e.target.value.trim() === '' ? null : e.target.value.slice(0, 40))}
              className="h-11 w-full min-w-0 max-w-[140px] rounded-control border-2 border-border bg-surface px-3 text-body font-bold tabular hover:border-fg"
            />
            <span className="text-small text-fg-muted">isian</span>
          </label>
        ) : (
          letters.map((L) => {
            const on = v === L
            return (
              <button
                key={L}
                type="button"
                aria-pressed={on}
                aria-label={`Nomor ${num}, ${L}`}
                onClick={() => onChange(i, on ? null : L)}
                className={cx(
                  'flex-none cursor-pointer rounded-pill border-2 p-0 text-body font-bold',
                  optionCount === 5 ? 'size-[42px] sm:size-[46px]' : 'size-[46px]',
                  on ? 'border-fg bg-fg text-white' : 'border-border bg-surface text-fg hover:border-fg',
                )}
              >
                {L}
              </button>
            )
          })
        )}
        {skip ? <span className="ml-auto pl-1 text-small font-bold text-warn">Kosong</span> : null}
      </li>
    )
  }

  return (
    <div className="grid gap-x-4 gap-y-1.5 md:grid-cols-2 xl:grid-cols-4">
      {cols.map((c, ci) => (
        <ol key={ci} start={c[0]! + 1} aria-label={`Nomor ${c[0]! + 1} sampai ${c[c.length - 1]! + 1}`} className="m-0 flex list-none flex-col gap-1.5 p-0">
          {c.map((i) => row(i))}
        </ol>
      ))}
    </div>
  )
}
