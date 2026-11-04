'use client'

import type { ReactElement } from 'react'
import { Button } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { useT } from '@/lib/i18n/client'

/**
 * Hint bertingkat (papan HintStack). Tepat tiga hint per soal: dorongan, strategi,
 * langkah pertama. Terbuka berurutan dan tetap terlihat setelah dibuka. Membuka hint
 * membuat XP soal itu menjadi separuh, dan tombolnya menyebutkan itu sebelum diketuk.
 */

/** Daftar hint yang sudah dibuka. Tidak merender apa pun bila belum ada. */
export function HintList({ hints, opened, className, contentLang = 'en-GB' }: { hints: string[]; opened: number; className?: string; contentLang?: string }): ReactElement | null {
  const t = useT().runner.hints
  const shown = hints.slice(0, opened)
  if (shown.length === 0) return null
  return (
    <div role="status" className={cx('flex flex-col gap-2.5 rounded-control bg-lavender px-4 py-3', className)}>
      {shown.map((h, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <UiIcon name="hint" size={22} className="mt-0.5" />
          <div className="flex min-w-0 flex-col">
            <span className="text-body font-bold">{t.of(i + 1, hints.length)}</span>
            <span lang={contentLang} className="font-reading text-h3">{h}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

/** Tombol Hint dengan sisa hint. Nonaktif saat semua hint terbuka atau umpan balik tampil. */
export function HintButton({
  total,
  opened,
  onOpen,
  disabled = false,
  compact = false,
}: {
  total: number
  opened: number
  onOpen: () => void
  disabled?: boolean
  compact?: boolean
}): ReactElement {
  const t = useT().runner.hints
  const left = Math.max(0, total - opened)
  const off = disabled || left === 0
  return (
    <Button variant="secondary" icon="hint" disabled={off} onClick={onOpen} className="px-4">
      {t.hint}
      {compact ? (
        <span className="visually-hidden">, {t.left(left)}</span>
      ) : (
        <span className={cx('text-body font-semibold', off ? 'text-border' : 'text-fg-muted')}>{t.left(left)}</span>
      )}
      {left > 0 ? <span className="visually-hidden">. {t.halvesXp}</span> : null}
    </Button>
  )
}

/** Versi lengkap untuk layar tanpa bar bawah: daftar hint, tombol, dan catatan XP. */
export function HintStack({
  hints,
  opened,
  onOpenNext,
  baseXp,
  disabled = false,
  className,
}: {
  hints: string[]
  opened: number
  onOpenNext: () => void
  /** XP soal tanpa hint, untuk kalimat "XP for this question: 5 instead of 10." */
  baseXp?: number
  disabled?: boolean
  className?: string
}): ReactElement | null {
  const t = useT().runner.hints
  if (hints.length === 0) return null
  const left = hints.length - opened
  return (
    <div className={cx('flex flex-col gap-3', className)}>
      <HintList hints={hints} opened={opened} />
      {left > 0 ? (
        <Button variant="secondary" icon={opened === 0 ? 'hint' : undefined} disabled={disabled} onClick={onOpenNext} className="self-start">
          {opened === 0 ? t.hint : t.show(opened + 1)}
        </Button>
      ) : null}
      {opened === 0 ? (
        <p className="m-0 text-body text-fg-muted">{t.halvesXp}</p>
      ) : baseXp ? (
        <p className="m-0 text-body text-fg-muted">{t.xpLine(Math.round(baseXp / 2), baseXp)}</p>
      ) : null}
    </div>
  )
}
