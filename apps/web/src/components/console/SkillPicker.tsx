'use client'

import { useId, useMemo, useState } from 'react'
import type { Subject } from '@/lib/dto'
import { cx } from './cx'
import { FieldError } from './Field'
import { SUBJECT_LABEL } from './format'
import { ConsoleIcon, StarGlyph } from './icons'

/**
 * Pemilih skill: kotak cari dengan daftar radio yang tersaring saat mengetik
 * (lebih dari 15 pilihan memakai pencarian, GTX U-02). Radio asli, jadi panah
 * atas dan bawah berpindah pilihan.
 */
export type SkillOption = { id: string; subject: Subject; grade: number; title: string; stars?: number }

export function SkillPicker({
  skills,
  value,
  onChange,
  error,
  legend = 'Skill',
  showSubject,
}: {
  skills: SkillOption[]
  value: string | null
  onChange: (id: string) => void
  error?: string | null
  legend?: string
  showSubject?: boolean
}) {
  const [q, setQ] = useState('')
  const auto = useId()
  const id = `sp${auto.replace(/:/g, '')}`
  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    const base = t ? skills.filter((s) => s.title.toLowerCase().includes(t) || s.id.toLowerCase().includes(t)) : skills
    // pilihan saat ini selalu terlihat
    if (value && !base.some((s) => s.id === value)) {
      const cur = skills.find((s) => s.id === value)
      if (cur) return [cur, ...base]
    }
    return base
  }, [q, skills, value])

  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0" aria-describedby={error ? `${id}-error` : undefined}>
      <legend className="mb-1.5 p-0 text-small font-bold">{legend}</legend>
      <div className="relative">
        <label htmlFor={`${id}-q`} className="visually-hidden">
          Cari skill
        </label>
        <ConsoleIcon name="search" size={18} strokeWidth={2.5} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-muted" />
        <input
          id={`${id}-q`}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama skill"
          autoComplete="off"
          className="h-11 w-full min-w-0 rounded-control border-2 border-border bg-surface pr-3 pl-9 text-body hover:border-fg"
          aria-describedby={`${id}-count`}
        />
      </div>
      <span id={`${id}-count`} role="status" className="text-small text-fg-muted tabular">
        {q.trim() ? `${list.length} skill cocok dengan "${q.trim()}"` : `${skills.length} skill`}
      </span>
      <div className={cx('max-h-64 overflow-y-auto overscroll-contain rounded-control border-2 bg-surface', error ? 'border-danger' : 'border-divider')}>
        {list.length === 0 ? (
          <p className="m-0 p-3 text-body text-fg-muted">
            Tidak ada skill dengan kata &quot;{q.trim()}&quot;.{' '}
            <button type="button" onClick={() => setQ('')} className="cursor-pointer border-0 bg-transparent p-0 font-bold text-fg underline underline-offset-3">
              Hapus pencarian
            </button>
          </p>
        ) : (
          list.map((s) => {
            const checked = s.id === value
            return (
              <label
                key={s.id}
                className={cx(
                  'flex min-h-11 cursor-pointer items-center gap-2.5 border-b border-divider px-3 py-2 last:border-b-0',
                  checked ? 'bg-bg' : 'hover:bg-bg',
                )}
              >
                <input type="radio" name={`${id}-skill`} value={s.id} checked={checked} onChange={() => onChange(s.id)} className="size-5 flex-none cursor-pointer accent-fg" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={cx('text-body', checked ? 'font-bold' : 'font-semibold')}>{s.title}</span>
                  <span className="text-small text-fg-muted">
                    {showSubject ? `${SUBJECT_LABEL[s.subject]}, ` : ''}Grade {s.grade}
                  </span>
                </span>
                {s.stars != null ? (
                  <span className="flex flex-none items-center gap-0.5" aria-label={`${s.stars} dari 3 bintang`}>
                    {[0, 1, 2].map((i) => (
                      <StarGlyph key={i} size={14} filled={i < (s.stars ?? 0)} />
                    ))}
                  </span>
                ) : null}
              </label>
            )
          })
        )}
      </div>
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </fieldset>
  )
}
