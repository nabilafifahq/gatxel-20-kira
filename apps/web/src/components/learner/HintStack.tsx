import type { ReactElement } from 'react'
import { Button } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'

/**
 * Hint bertingkat (papan HintStack). Tepat tiga hint per soal: dorongan, strategi,
 * langkah pertama. Terbuka berurutan dan tetap terlihat setelah dibuka. Membuka hint
 * membuat XP soal itu menjadi separuh, dan tombolnya menyebutkan itu sebelum diketuk.
 */

/** Daftar hint yang sudah dibuka. Tidak merender apa pun bila belum ada. */
export function HintList({ hints, opened, className }: { hints: string[]; opened: number; className?: string }): ReactElement | null {
  const shown = hints.slice(0, opened)
  if (shown.length === 0) return null
  return (
    <div role="status" className={cx('flex flex-col gap-2.5 rounded-control border border-divider bg-bg px-4 py-3', className)}>
      {shown.map((h, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <UiIcon name="hint" size={22} className="mt-0.5" />
          <div className="flex min-w-0 flex-col">
            <span className="text-body font-bold">
              Hint {i + 1} of {hints.length}
            </span>
            <span className="font-reading text-h3">{h}</span>
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
  const left = Math.max(0, total - opened)
  const off = disabled || left === 0
  return (
    <Button variant="secondary" icon="hint" disabled={off} onClick={onOpen} className="px-4">
      Hint
      {compact ? (
        <span className="visually-hidden">, {left} left</span>
      ) : (
        <span className={cx('text-body font-semibold', off ? 'text-border' : 'text-fg-muted')}>{left} left</span>
      )}
      {left > 0 ? <span className="visually-hidden">. A hint halves the XP for this question.</span> : null}
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
  if (hints.length === 0) return null
  const left = hints.length - opened
  return (
    <div className={cx('flex flex-col gap-3', className)}>
      <HintList hints={hints} opened={opened} />
      {left > 0 ? (
        <Button variant="secondary" icon={opened === 0 ? 'hint' : undefined} disabled={disabled} onClick={onOpenNext} className="self-start">
          {opened === 0 ? 'Hint' : `Show hint ${opened + 1}`}
        </Button>
      ) : null}
      {opened === 0 ? (
        <p className="m-0 text-body text-fg-muted">A hint halves the XP for this question.</p>
      ) : baseXp ? (
        <p className="m-0 text-body text-fg-muted">
          XP for this question: {Math.round(baseXp / 2)} instead of {baseXp}.
        </p>
      ) : null}
    </div>
  )
}
