'use client'

import { useId } from 'react'
import { Icon } from '@kira/figures'
import type { PinPicture } from '@/lib/dto'
import { Button } from './Button'
import { cx } from './cx'
import { FieldError } from './Field'

/**
 * Pemilih PIN gambar untuk learner (4 dari 9 gambar, berurutan, boleh berulang).
 * Gambar sama dengan layar masuk anak (L01): sun, moon, star, cat, fish, tree,
 * apple, boat, ball dari @kira/figures. Urutan tetap supaya anak hafal posisinya.
 */

export const PIN_ORDER: PinPicture[] = ['sun', 'moon', 'star', 'cat', 'fish', 'tree', 'apple', 'boat', 'ball']
export const PIN_LENGTH = 4

export const PIN_LABEL: Record<PinPicture, string> = {
  sun: 'Matahari',
  moon: 'Bulan',
  star: 'Bintang',
  cat: 'Kucing',
  fish: 'Ikan',
  tree: 'Pohon',
  apple: 'Apel',
  boat: 'Perahu',
  ball: 'Bola',
}

export function pinProblem(pin: PinPicture[]): string | null {
  if (pin.length < PIN_LENGTH) return `Pilih ${PIN_LENGTH} gambar. Baru ${pin.length} gambar terpilih.`
  return null
}

export function PinChooser({
  value,
  onChange,
  error,
  legend = 'PIN gambar',
  hint = 'Pilih 4 gambar berurutan. Gambar yang sama boleh dipakai lebih dari sekali.',
}: {
  value: PinPicture[]
  onChange: (next: PinPicture[]) => void
  error?: string | null
  legend?: string
  hint?: string
}) {
  const auto = useId()
  const gid = `pin${auto.replace(/:/g, '')}`
  const full = value.length >= PIN_LENGTH
  const spoken = value.length ? value.map((p, i) => `${i + 1} ${PIN_LABEL[p]}`).join(', ') : 'belum ada gambar'
  return (
    <fieldset
      className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0"
      aria-describedby={[`${gid}-hint`, error ? `${gid}-error` : null].filter(Boolean).join(' ')}
    >
      <legend className="mb-1.5 p-0 text-small font-bold">{legend}</legend>
      <span id={`${gid}-hint`} className="-mt-2 text-small text-fg-muted">
        {hint}
      </span>
      <div className="flex flex-wrap items-center gap-2" aria-hidden="true">
        {Array.from({ length: PIN_LENGTH }, (_, i) => {
          const p = value[i]
          return (
            <span
              key={i}
              className={cx(
                'relative inline-flex size-14 items-center justify-center rounded-control bg-surface',
                p ? 'border-2 border-fg' : 'border-2 border-dashed border-border',
              )}
            >
              {p ? <Icon name={p} size={40} /> : null}
              <span className="absolute -top-2 -left-2 inline-flex size-5 items-center justify-center rounded-pill bg-fg text-small leading-none font-bold text-white">
                {i + 1}
              </span>
            </span>
          )
        })}
      </div>
      <p className="visually-hidden" aria-live="polite">
        PIN terpilih: {spoken}.
      </p>
      <div className="grid max-w-[264px] grid-cols-3 gap-2">
        {PIN_ORDER.map((p) => (
          <button
            key={p}
            type="button"
            aria-label={PIN_LABEL[p]}
            aria-disabled={full || undefined}
            onClick={() => {
              if (!full) onChange([...value, p])
            }}
            className={cx(
              'inline-flex h-[72px] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-control border-2 bg-surface',
              full ? 'cursor-not-allowed border-divider opacity-60' : 'border-border hover:border-fg active:scale-97',
              'transition-transform duration-150 ease-kira',
            )}
          >
            <Icon name={p} size={40} />
            <span className="text-small leading-none font-semibold">{PIN_LABEL[p]}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="S" icon="arrowLeft" disabled={value.length === 0} onClick={() => onChange(value.slice(0, -1))}>
          Hapus gambar terakhir
        </Button>
        <Button variant="quiet" size="S" disabled={value.length === 0} onClick={() => onChange([])}>
          Ulangi dari awal
        </Button>
      </div>
      {error ? <FieldError id={`${gid}-error`}>{error}</FieldError> : null}
    </fieldset>
  )
}
