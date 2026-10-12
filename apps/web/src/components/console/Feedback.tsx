'use client'

import type { ReactNode } from 'react'
import { Button } from './Button'
import { cx } from './cx'
import { ConsoleIcon, type ConsoleIconName } from './icons'

/**
 * State error, kosong, peringatan, dan memuat untuk konsol (papan TutorHariIni,
 * DataTable, EmptyState). Error selalu menyebut apa yang terjadi, apa yang harus
 * dilakukan, dan kode referensi yang bisa disalin.
 */

export function ReferenceCode({ code, prefix = 'Kode referensi' }: { code: string; prefix?: string }) {
  return (
    <span className="text-small text-fg-muted tabular">
      {prefix} <span className="font-semibold text-fg select-all">{code}</span>
    </span>
  )
}

export function ErrorState({
  title,
  body,
  reference,
  onRetry,
  retryLabel = 'Coba lagi',
  retrying,
  className,
  compact,
}: {
  title: ReactNode
  body: ReactNode
  reference: string | null
  onRetry?: () => void
  retryLabel?: string
  retrying?: boolean
  className?: string
  compact?: boolean
}) {
  return (
    <div
      role="alert"
      className={cx(
        'flex flex-wrap items-center gap-x-4 gap-y-3 rounded-card border-2 border-danger bg-surface',
        compact ? 'p-4' : 'p-5',
        className,
      )}
    >
      <ConsoleIcon name="alert" size={24} strokeWidth={2.5} className="self-start text-danger" />
      <div className="flex min-w-0 flex-[1_1_320px] flex-col">
        <span className="text-body font-bold">{title}</span>
        <span className="text-body">{body}</span>
        {reference ? <ReferenceCode code={reference} /> : null}
      </div>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry} loading={retrying} className="flex-none">
          {retryLabel}
        </Button>
      ) : null}
    </div>
  )
}

export type AlertTone = 'danger' | 'warn' | 'success' | 'info'

const TONE_ICON: Record<AlertTone, ConsoleIconName> = {
  danger: 'alert',
  warn: 'alert',
  success: 'checkCircle',
  info: 'infoCircle',
}
const TONE_BORDER: Record<AlertTone, string> = {
  danger: 'border-danger',
  warn: 'border-warn',
  success: 'border-success',
  info: 'border-border',
}
const TONE_TEXT: Record<AlertTone, string> = {
  danger: 'text-danger',
  warn: 'text-warn',
  success: 'text-success',
  info: 'text-fg',
}

/** Kotak pesan di dalam alur (error action, peringatan, info). */
export function InlineAlert({
  tone,
  title,
  children,
  reference,
  action,
  className,
  live = tone === 'danger' ? 'alert' : 'status',
}: {
  tone: AlertTone
  title?: ReactNode
  children?: ReactNode
  reference?: string | null
  action?: ReactNode
  className?: string
  live?: 'alert' | 'status' | 'none'
}) {
  return (
    <div
      role={live === 'none' ? undefined : live}
      className={cx('flex flex-wrap items-start gap-x-3 gap-y-2 rounded-control border-2 bg-surface px-4 py-3.5', TONE_BORDER[tone], className)}
    >
      <ConsoleIcon name={TONE_ICON[tone]} size={22} strokeWidth={2.5} className={cx('mt-0.5', TONE_TEXT[tone])} />
      <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5">
        {title ? <span className="text-body font-bold">{title}</span> : null}
        {children ? <div className="text-body">{children}</div> : null}
        {reference ? <ReferenceCode code={reference} /> : null}
      </div>
      {action ? <div className="flex flex-none items-center gap-2 self-center">{action}</div> : null}
    </div>
  )
}

/** Error hasil action (ActionResult ok: false) dalam bentuk InlineAlert. */
export function ActionError({ error, className }: { error: { message: string; reference: string } | null; className?: string }) {
  if (!error) return null
  return (
    <InlineAlert tone="danger" title={error.message} reference={error.reference} className={className} />
  )
}

export function EmptyState({
  icon = 'bank',
  title,
  body,
  actions,
  filters,
  className,
  compact,
}: {
  icon?: ConsoleIconName
  title: ReactNode
  body?: ReactNode
  actions?: ReactNode
  /** Untuk filter tanpa hasil: label filter aktif yang ditampilkan sebagai chip. */
  filters?: string[]
  className?: string
  compact?: boolean
}) {
  return (
    <section
      role="status"
      className={cx(
        'flex flex-col items-center justify-center gap-2.5 rounded-card border border-divider bg-surface text-center',
        compact ? 'px-6 py-7' : 'min-h-[260px] p-8',
        className,
      )}
    >
      <ConsoleIcon name={filters && filters.length ? 'filter' : icon} size={compact ? 36 : 48} strokeWidth={1.75} className="text-fg-muted" />
      {filters && filters.length ? (
        <div aria-label="Filter aktif" className="flex flex-wrap justify-center gap-1.5">
          {filters.map((f) => (
            <span key={f} className="inline-flex h-[30px] items-center rounded-pill border border-border bg-surface px-2.5 text-small font-semibold">
              {f}
            </span>
          ))}
        </div>
      ) : null}
      <p className="m-0 max-w-[460px] text-body-lg font-bold">{title}</p>
      {body ? <p className="m-0 max-w-[460px] text-body text-fg-muted">{body}</p> : null}
      {actions ? <div className="mt-1.5 flex flex-wrap justify-center gap-2.5">{actions}</div> : null}
    </section>
  )
}

/** Baris kerangka saat memuat. Statis (tanpa animasi denyut). */
export function SkeletonRows({ rows = 3, label = 'Memuat' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-divider p-4 last:border-b-0">
          <span className="h-3.5 w-[110px] rounded-pill bg-divider" />
          <span className="h-3.5 flex-1 rounded-pill bg-bg" />
          <span className="h-3.5 w-20 rounded-pill bg-divider" />
        </div>
      ))}
    </div>
  )
}

/** Status dengan ikon dan teks, tidak pernah hanya warna. */
export function StatusText({ tone, icon, children, className }: { tone: AlertTone | 'muted'; icon?: ConsoleIconName; children: ReactNode; className?: string }) {
  const color = tone === 'muted' ? 'text-fg-muted' : TONE_TEXT[tone]
  const ic = icon ?? (tone === 'muted' ? 'clock' : TONE_ICON[tone])
  return (
    <span className={cx('inline-flex items-center gap-1.5 font-semibold', className)}>
      <ConsoleIcon name={ic} size={18} strokeWidth={2.5} className={color} />
      <span>{children}</span>
    </span>
  )
}
