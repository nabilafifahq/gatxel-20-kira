'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef, type ReactElement, type ReactNode } from 'react'
import { playSfx } from './sfx'

/**
 * Peralihan antar layar learner: layar baru memudar masuk sambil naik 8 px selama 200 ms. Hanya animasi
 * masuk (tanpa keluar), jadi tidak menahan navigasi dan tidak menyentuh fokus. Setelah selesai tidak ada
 * transform tersisa, jadi elemen lengket dan fixed di dalamnya tetap benar. Reduced motion: memudar saja.
 */
export function PageTransition({ children }: { children: ReactNode }): ReactElement {
  const path = usePathname()
  // Whoosh sangat pelan saat pindah layar (bukan saat layar pertama dibuka).
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    playSfx('whoosh')
  }, [path])
  return (
    <div key={path} className="kira-page">
      {children}
    </div>
  )
}
