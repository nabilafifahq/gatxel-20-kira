'use client'

import { useId, type ReactNode } from 'react'
import { cx } from './cx'
import { ConsoleIcon } from './icons'

/**
 * Tabel konsol (papan DataTable, GTX L-05, L-07, U-01).
 * Teks rata kiri, angka rata kanan dengan tabular-nums, garis pemisah tanpa zebra,
 * header lengket, wilayah gulir bisa dijangkau keyboard (tabindex, role region,
 * aria-labelledby ke caption). Kotak centang header memilih halaman ini saja.
 */

export type Column<T> = {
  key: string
  header: ReactNode
  /** Teks untuk aria-label tombol urut. */
  headerText?: string
  align?: 'left' | 'right'
  cell: (row: T) => ReactNode
  /** Sel pertama yang menamai baris: dirender sebagai <th scope="row">. */
  rowHeader?: boolean
  sortable?: boolean
  className?: string
  headerClassName?: string
  /** Sembunyikan kolom di layar sempit. */
  hideBelow?: 'sm' | 'md' | 'lg'
}

export type SortState = { key: string; dir: 'asc' | 'desc' }

const HIDE: Record<NonNullable<Column<unknown>['hideBelow']>, string> = {
  sm: 'max-sm:hidden',
  md: 'max-md:hidden',
  lg: 'max-lg:hidden',
}

export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  sort,
  onSort,
  selection,
  activeRowKey,
  minWidth = 640,
  footer,
  dense,
}: {
  caption: string
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  sort?: SortState
  onSort?: (key: string) => void
  selection?: {
    selected: ReadonlySet<string>
    onToggle: (key: string) => void
    onTogglePage: (selectAll: boolean) => void
    rowLabel: (row: T) => string
    pageLabel: string
  }
  activeRowKey?: string | null
  minWidth?: number
  footer?: ReactNode
  dense?: boolean
}) {
  const auto = useId()
  const cid = `t${auto.replace(/:/g, '')}`
  const pageKeys = rows.map(rowKey)
  const selectedOnPage = selection ? pageKeys.filter((k) => selection.selected.has(k)).length : 0
  const allOnPage = selection != null && pageKeys.length > 0 && selectedOnPage === pageKeys.length
  const someOnPage = selection != null && selectedOnPage > 0 && !allOnPage
  const cellPad = dense ? 'px-4 py-2' : 'px-4 py-3'
  const th = 'sticky top-0 z-10 border-b border-divider bg-surface text-small font-semibold text-fg-muted'

  return (
    <div className="min-w-0 rounded-control border border-divider bg-surface">
      <div role="region" aria-labelledby={cid} tabIndex={0} className="relative overflow-x-auto rounded-control">
        <table className="w-full border-collapse text-body" style={{ minWidth }}>
          <caption id={cid} className="visually-hidden">
            {caption}
          </caption>
          <thead>
            <tr>
              {selection ? (
                <th scope="col" className={cx(th, cellPad, 'w-11 text-left')}>
                  <input
                    type="checkbox"
                    checked={allOnPage}
                    ref={(el) => {
                      if (el) el.indeterminate = someOnPage
                    }}
                    onChange={() => selection.onTogglePage(!allOnPage)}
                    aria-label={selection.pageLabel}
                    className="m-0 size-5 cursor-pointer accent-fg align-middle"
                  />
                </th>
              ) : null}
              {columns.map((c) => {
                const sorted = sort?.key === c.key
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={sorted ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={cx(th, cellPad, c.align === 'right' ? 'text-right' : 'text-left', c.hideBelow && HIDE[c.hideBelow], c.headerClassName)}
                  >
                    {c.sortable && onSort ? (
                      <button
                        type="button"
                        onClick={() => onSort(c.key)}
                        className={cx(
                          'inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-small',
                          sorted ? 'font-extrabold text-fg' : 'font-semibold text-fg-muted hover:text-fg',
                          c.align === 'right' && 'flex-row-reverse',
                        )}
                      >
                        {c.header}
                        {sorted ? (
                          <ConsoleIcon name={sort.dir === 'asc' ? 'arrowUp' : 'arrowDown'} size={14} strokeWidth={3} />
                        ) : (
                          <ConsoleIcon name="chevronDown" size={14} strokeWidth={2.5} className="opacity-0" />
                        )}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const key = rowKey(row)
              const isSelected = selection?.selected.has(key) ?? false
              const isActive = activeRowKey === key
              return (
                <tr key={key} className={cx('border-b border-divider last:border-b-0', (isSelected || isActive) && 'bg-bg', !isSelected && !isActive && 'hover:bg-bg')}>
                  {selection ? (
                    <td className={cx(cellPad, 'w-11 align-middle')}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => selection.onToggle(key)}
                        aria-label={selection.rowLabel(row)}
                        className="m-0 size-5 cursor-pointer accent-fg align-middle"
                      />
                    </td>
                  ) : null}
                  {columns.map((c) => {
                    const cls = cx(cellPad, 'align-middle', c.align === 'right' ? 'text-right tabular' : 'text-left', c.hideBelow && HIDE[c.hideBelow], c.className)
                    return c.rowHeader ? (
                      <th key={c.key} scope="row" className={cx(cls, 'font-bold')}>
                        {c.cell(row)}
                      </th>
                    ) : (
                      <td key={c.key} className={cls}>
                        {c.cell(row)}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {footer}
    </div>
  )
}

/** Bar aksi saat ada baris terpilih (U-01): jumlah, eskalasi ke semua hasil filter, aksi, dan Batal. */
export function BulkBar({
  pageCount,
  total,
  allSelected,
  noun,
  onEscalate,
  onUndoEscalate,
  onCancel,
  children,
}: {
  pageCount: number
  total: number
  allSelected: boolean
  noun: string
  onEscalate?: () => void
  onUndoEscalate?: () => void
  onCancel: () => void
  children?: ReactNode
}) {
  return (
    <div
      role="region"
      aria-label={`Aksi untuk ${noun} terpilih`}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel()
      }}
      className="flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-control bg-fg py-2.5 pr-3 pl-4 text-white"
    >
      <span role="status" className="flex flex-col">
        <span className="text-body font-bold">
          {allSelected ? `Semua ${total} ${noun} yang sesuai filter terpilih.` : `${pageCount} ${noun} di halaman ini terpilih.`}
        </span>
        {allSelected && onUndoEscalate ? (
          <button type="button" onClick={onUndoEscalate} className="cursor-pointer self-start border-0 bg-transparent p-0 text-small font-semibold text-white underline underline-offset-3">
            Batalkan pilihan semua
          </button>
        ) : !allSelected && onEscalate && total > pageCount ? (
          <button type="button" onClick={onEscalate} className="cursor-pointer self-start border-0 bg-transparent p-0 text-small font-semibold text-white underline underline-offset-3">
            Pilih semua {total} {noun} yang sesuai filter
          </button>
        ) : null}
      </span>
      <span className="ml-auto flex flex-wrap gap-2">
        {children}
        <button type="button" onClick={onCancel} className="h-10 cursor-pointer rounded-control border-0 bg-transparent px-3.5 text-body font-bold text-white underline underline-offset-3">
          Batal
        </button>
      </span>
    </div>
  )
}

/** Tombol di dalam BulkBar (latar gelap). */
export function BulkButton({ children, onClick, primary }: { children: ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'h-10 cursor-pointer rounded-control border-2 border-white px-3.5 text-body font-bold',
        primary ? 'bg-surface text-fg' : 'bg-transparent text-white',
      )}
    >
      {children}
    </button>
  )
}

/** Navigasi halaman tabel. */
export function Pagination({
  page,
  pageCount,
  summary,
  prev,
  next,
}: {
  page: number
  pageCount: number
  summary: string
  prev: ReactNode
  next: ReactNode
}) {
  return (
    <nav aria-label="Halaman tabel" className="flex flex-wrap items-center justify-between gap-3 border-t border-divider px-4 py-3">
      <span className="text-small text-fg-muted tabular">{summary}</span>
      <span className="flex gap-2" data-page={page} data-pages={pageCount}>
        {prev}
        {next}
      </span>
    </nav>
  )
}
