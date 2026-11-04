'use client'

import { ConsoleIcon } from '@/components/console/icons'
import { buttonClass } from '@/components/console/Button'

/** Cetak halaman ini. Di HP dan komputer, pilih "Simpan sebagai PDF" di jendela cetak. */
export function PrintButton({ label = 'Cetak atau simpan PDF' }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass('primary', 'M', 'cursor-pointer print:hidden')}>
      <ConsoleIcon name="printer" size={18} strokeWidth={2.25} />
      {label}
    </button>
  )
}
