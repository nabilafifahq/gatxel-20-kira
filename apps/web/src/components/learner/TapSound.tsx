'use client'

import type { PointerEvent, ReactElement, ReactNode } from 'react'
import { playSfx } from './sfx'

const TARGET =
  'button, [role="button"], [role="radio"], [role="checkbox"], [role="option"], [role="gridcell"], [role="switch"]'

/** Apakah sentuhan ini mengenai kontrol jawaban yang aktif? Ditulis terpisah supaya bisa dites. */
export function isTapTarget(el: Element | null): boolean {
  const hit = el?.closest(TARGET)
  if (!hit) return false
  if (hit.closest('[data-no-tap]')) return false
  if (hit.hasAttribute('disabled') || hit.getAttribute('aria-disabled') === 'true') return false
  return true
}

/**
 * Satu tempat untuk bunyi ketuk di semua ubin jawaban dan tombol angka: menangkap sentuhan pada kontrol
 * apa pun di dalamnya (22 jenis widget, termasuk keypad), jadi widget baru otomatis berbunyi. Pembungkus
 * `display: contents` tidak mengubah tata letak. Bunyi tetap lewat `playSfx` sehingga bisa dimatikan.
 * Tandai kontrol yang sudah punya bunyi sendiri dengan `data-no-tap`.
 */
export function TapSound({ children }: { children: ReactNode }): ReactElement {
  return (
    <div
      className="contents"
      onPointerDownCapture={(e: PointerEvent<HTMLDivElement>) =>
        isTapTarget(e.target as Element | null) ? playSfx('tap') : undefined
      }
    >
      {children}
    </div>
  )
}
