'use client'

import { useState, type ReactElement } from 'react'
import { Figure } from '@kira/figures'
import type { FigureSpec } from '@kira/figures/spec'
import { Button, IconButton } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { Dialog } from '@/components/ui/Dialog'
import { useT } from '@/lib/i18n/client'

/**
 * Bingkai figur (papan FigureFrame). Membungkus SVG dari @kira/figures; alt teks
 * diambil dari FigureSpec sehingga sama di layar, pembahasan, dan PDF.
 * Tombol perbesar membuka figur selebar layar sampai ditutup.
 */
export function FigureFrame({
  spec,
  lang = 'en-GB',
  maxWidth = 420,
  paper = false,
  zoom = true,
  className,
}: {
  spec: FigureSpec
  /** Bahasa isi figur (label dan alt). `<html lang>` mengikuti bahasa tampilan, jadi isinya perlu tag sendiri. */
  lang?: string
  /** Lebar maksimum figur di dalam bingkai. */
  maxWidth?: number
  /** Latar kertas berpetak 8 px untuk area kerja Math. */
  paper?: boolean
  zoom?: boolean
  className?: string
}): ReactElement {
  const [open, setOpen] = useState(false)
  const t = useT()
  return (
    <figure
      className={cx(
        'relative m-0 flex items-center justify-center rounded-control border border-divider p-4',
        paper ? 'paper-grid' : 'bg-surface',
        zoom && 'min-h-22',
        className,
      )}
    >
      <div lang={lang} className="w-full" style={{ maxWidth }}>
        <Figure spec={spec} />
      </div>
      {zoom ? (
        <>
          <IconButton icon="zoom-in" label={t.widgets.figure.zoomIn} onClick={() => setOpen(true)} className="absolute right-2.5 bottom-2.5" />
          <Dialog
            open={open}
            onClose={() => setOpen(false)}
            title={<span className="visually-hidden">{t.widgets.figure.zoomedTitle}</span>}
            size="full"
            footer={
              <Button variant="secondary" icon="close" onClick={() => setOpen(false)} data-autofocus>
                {t.common.close}
              </Button>
            }
          >
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <div lang={lang} className="w-full max-w-[min(1100px,90svh)]">
                <Figure spec={spec} maxWidth={1100} />
              </div>
            </div>
            <p lang={lang} className="m-0 text-body text-fg-muted">{spec.alt}</p>
          </Dialog>
        </>
      ) : null}
    </figure>
  )
}
