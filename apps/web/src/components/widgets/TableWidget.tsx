'use client'

import { useState, type ReactElement } from 'react'
import { cellMatches } from '@kira/content/check'
import { Button } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { SUBJECT_STYLE } from '@/components/learner/subject'
import { asTexts } from './answers'
import { CharKeypad, DIGITS_0_9, LETTERS_AZ } from './CharKeypad'
import type { WidgetProps } from './types'

/**
 * Lengkapi tabel: ketuk sel kosong, lalu isi dengan papan angka atau huruf. Tombol "Next gap" pindah
 * ke sel kosong berikutnya. Tabel tidak bisa digulir ke samping. Nilai { texts: string[] }, isi tiap sel kosong
 * menurut urutan di item.table.blanks.
 */
export function TableWidget({ item, value, onChange, disabled = false, feedback = null, subject }: WidgetProps): ReactElement | null {
  const style = SUBJECT_STYLE[subject]
  const table = item.table
  const [active, setActive] = useState(0)
  if (!table) return null
  const blanks = table.blanks
  const texts = asTexts(value, blanks.length)
  const locked = disabled || !!feedback
  const at = Math.min(active, Math.max(0, blanks.length - 1))
  const current = blanks[at]
  const numeric = current?.numeric ?? false
  const key = item.key?.type === 'table' ? item.key.blanks : null
  const blankIndex = (r: number, c: number) => blanks.findIndex((b) => b.row === r && b.col === c)

  const set = (i: number, t: string) => {
    const next = texts.slice()
    next[i] = t
    onChange(next.every((x) => x === '') ? null : { texts: next })
  }
  const okAt = (i: number): boolean | null => {
    if (!feedback || !key) return null
    return (key[i] ?? []).some((a) => cellMatches(texts[i] ?? '', a))
  }

  const keys = numeric ? [...DIGITS_0_9, '.', '/', '-'] : [...LETTERS_AZ, ' ', '-', "'"]
  const cell = texts[at] ?? ''

  return (
    <div className="flex w-full flex-col gap-4">
      <p className="m-0 text-body font-semibold text-fg-muted" aria-live="polite">
        {locked ? 'Your table' : 'Tap an empty box, then type.'}
      </p>
      <table lang={item.lang} className="w-full table-fixed border-collapse rounded-control border-2 border-border bg-surface font-reading text-h3">
        {table.caption ? <caption className="pb-2 text-left text-body-lg font-bold">{table.caption}</caption> : null}
        <thead>
          <tr>
            {table.head.map((h, c) => (
              <th key={c} scope="col" className="border-2 border-border bg-bg px-2 py-2 text-left font-bold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, r) => (
            <tr key={r}>
              {row.map((text, c) => {
                const bi = blankIndex(r, c)
                if (bi < 0) {
                  return (
                    <td key={c} className="border-2 border-border px-2 py-2">
                      {text}
                    </td>
                  )
                }
                const ok = okAt(bi)
                const isActive = bi === at && !locked
                return (
                  <td key={c} className="border-2 border-border p-1">
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => setActive(bi)}
                      aria-label={`${table.head[c] ?? 'Column'}, row ${r + 1}: ${texts[bi] ? texts[bi] : 'empty'}${ok === true ? ', right' : ok === false ? ', not yet' : ''}`}
                      aria-current={isActive ? 'true' : undefined}
                      className={cx(
                        'flex min-h-14 w-full items-center justify-between gap-1 rounded-control px-2 text-left font-bold',
                        ok === true
                          ? 'border-3 border-success bg-success-50'
                          : ok === false
                            ? 'border-3 border-warn bg-surface'
                            : isActive
                              ? cx('border-3', style.border, style.tint)
                              : locked
                                ? 'border-2 border-divider bg-bg'
                                : 'border-2 border-dashed border-border bg-surface',
                        !locked && 'cursor-pointer hover:border-fg',
                      )}
                    >
                      <span className="min-w-0 truncate">{texts[bi] ?? ''}</span>
                      {ok !== null ? <UiIcon name={ok ? 'check' : 'not-yet'} size={18} className={ok ? 'text-success' : 'text-warn'} /> : null}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {!locked && current ? (
        <div className="flex flex-col items-center gap-3">
          <div className="flex w-full max-w-[420px] items-center gap-3">
            <output aria-live="polite" aria-label={`Box ${at + 1} of ${blanks.length}`} className={cx('flex h-14 min-w-0 flex-1 items-center rounded-control border-3 bg-surface px-4 font-reading text-h2 font-bold', style.border)}>
              <span className="truncate">{cell}</span>
            </output>
            {blanks.length > 1 ? (
              <Button variant="secondary" iconAfter="arrow-right" onClick={() => setActive((at + 1) % blanks.length)}>
                Next gap
              </Button>
            ) : null}
          </div>
          <CharKeypad
            keys={keys}
            columns={numeric ? 6 : 7}
            label={numeric ? 'Numbers' : 'Letters'}
            subject={subject}
            onKey={(k) => cell.length < 16 && set(at, cell + k)}
            onBackspace={() => set(at, cell.slice(0, -1))}
            onClear={() => set(at, '')}
          />
        </div>
      ) : null}
    </div>
  )
}
