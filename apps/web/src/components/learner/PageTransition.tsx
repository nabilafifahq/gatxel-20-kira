'use client'

import { usePathname } from 'next/navigation'
import type { ReactElement, ReactNode } from 'react'

/**
 * Peralihan antar layar learner: layar baru memudar masuk sambil naik 8 px selama 200 ms. Hanya animasi
 * masuk (tanpa keluar), jadi tidak menahan navigasi dan tidak menyentuh fokus. Setelah selesai tidak ada
 * transform tersisa, jadi elemen lengket dan fixed di dalamnya tetap benar. Reduced motion: memudar saja.
 */
export function PageTransition({ children }: { children: ReactNode }): ReactElement {
  const path = usePathname()
  return (
    <div key={path} className="kira-page">
      {children}
    </div>
  )
}
