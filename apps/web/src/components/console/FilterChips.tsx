'use client'

import { ConsoleIcon } from './icons'

/**
 * Ringkasan filter aktif (GTX L-06): jumlah hasil, chip yang bisa dihapus satu per satu,
 * dan Hapus semua filter. Jumlah hasil diumumkan lewat role="status".
 */
export function FilterChips({
  resultText,
  chips,
  onClearAll,
}: {
  resultText: string
  chips: { key: string; label: string; onRemove: () => void }[]
  onClearAll: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
      <span role="status" className="text-body font-extrabold tabular">
        {resultText}
      </span>
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={c.onRemove}
          aria-label={`Hapus filter ${c.label}`}
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-pill border border-border bg-surface pr-2 pl-3 text-small font-semibold text-fg hover:border-fg"
        >
          {c.label}
          <ConsoleIcon name="x" size={14} strokeWidth={3} />
        </button>
      ))}
      {chips.length > 0 ? (
        <button
          type="button"
          onClick={onClearAll}
          className="h-8 cursor-pointer border-0 bg-transparent px-1.5 text-small font-bold text-fg underline underline-offset-3"
        >
          Hapus semua filter
        </button>
      ) : null}
    </div>
  )
}
