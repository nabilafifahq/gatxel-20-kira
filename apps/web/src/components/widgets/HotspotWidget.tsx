'use client'

import type { ReactElement } from 'react'
import { normaliseText } from '@kira/content/check'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { SUBJECT_STYLE } from '@/components/learner/subject'
import { asTexts } from './answers'
import { FigureStage, stageStyle } from './FigureStage'
import type { WidgetProps } from './types'

/**
 * Ketuk di gambar: gambar (figur) dengan area ketuk di atasnya. Setiap area adalah tombol dengan nama
 * (label) untuk pembaca layar dan keyboard; di layar hanya garis putus-putus. Anak memilih sebanyak
 * item.hotspot.count area. Nilai { texts: string[] }, label area yang dipilih.
 */
export function HotspotWidget({ item, value, onChange, disabled = false, feedback = null, subject }: WidgetProps): ReactElement | null {
  const style = SUBJECT_STYLE[subject]
  const spot = item.hotspot
  const figure = item.figure
  if (!spot || !figure) return null
  const need = spot.count
  const chosen = asTexts(value, 8).filter((t) => t !== '')
  const locked = disabled || !!feedback
  const key = item.key?.type === 'hotspot' ? item.key.answers.map((a) => normaliseText(a, false)) : null

  const toggle = (label: string) => {
    if (locked) return
    const has = chosen.includes(label)
    let next = has ? chosen.filter((c) => c !== label) : [...chosen, label]
    // Saat jumlah pilihan sudah penuh, pilihan baru menggantikan pilihan paling lama.
    if (!has && next.length > need) next = next.slice(next.length - need)
    onChange(next.length === 0 ? null : { texts: next })
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <p className="m-0 text-body font-semibold text-fg-muted" aria-live="polite">
        {need > 1 ? `Tap ${need} places in the picture. ${chosen.length} of ${need} chosen.` : 'Tap the right place in the picture.'}
      </p>
      <FigureStage spec={figure}>
        <div role="group" aria-label="Places in the picture" lang={item.lang}>
          {spot.regions.map((r) => {
            const selected = chosen.includes(r.label)
            const ok = feedback && key && selected ? key.includes(normaliseText(r.label, false)) : null
            return (
              <button
                key={r.label}
                type="button"
                disabled={locked}
                aria-pressed={selected}
                aria-label={`${r.label}${ok === true ? ', right place' : ok === false ? ', not yet' : ''}`}
                onClick={() => toggle(r.label)}
                style={stageStyle(r.x, r.y, r.w, r.h)}
                className={cx(
                  'absolute flex items-start justify-end rounded-control p-0 transition-transform duration-150 ease-kira',
                  ok === true
                    ? 'border-3 border-success'
                    : ok === false
                      ? 'border-3 border-warn'
                      : selected
                        ? cx('border-3', style.border)
                        : cx('border-2 border-dashed', locked ? 'border-divider' : 'border-border'),
                  !locked && 'cursor-pointer hover:border-fg active:scale-97',
                )}
              >
                {selected ? (
                  <span
                    aria-hidden="true"
                    className={cx(
                      '-m-2.5 inline-flex h-7 w-7 items-center justify-center rounded-pill text-white',
                      ok === true ? 'bg-success' : ok === false ? 'bg-warn' : style.solid,
                    )}
                  >
                    <UiIcon name={ok === false ? 'not-yet' : 'check'} size={16} />
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </FigureStage>
    </div>
  )
}
