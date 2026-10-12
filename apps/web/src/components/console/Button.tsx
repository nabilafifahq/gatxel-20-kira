'use client'

import Link from 'next/link'
import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cx } from './cx'
import { ConsoleIcon, Spinner, type ConsoleIconName } from './icons'

/**
 * Tombol konsol (papan Button): M 44px teks 16, S 32px teks 14.
 * Varian: primary (isi --fg), secondary (garis 2px --border), quiet (tanpa garis), danger (isi --danger).
 * Loading tetap bisa difokus dan memakai aria-busy; klik diabaikan selama memuat.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger'
export type ButtonSize = 'M' | 'S'

const BASE =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control font-bold no-underline select-none ' +
  'transition-transform duration-150 ease-kira active:scale-97 disabled:active:scale-100 aria-disabled:active:scale-100'

const SIZE: Record<ButtonSize, string> = {
  M: 'h-11 px-4 text-body',
  S: 'h-8 px-3 text-small',
}

const DANGER_TONE: Partial<Record<ButtonVariant, string>> = {
  secondary:
    'border-2 border-danger bg-surface text-danger hover:border-danger hover:bg-danger-50 hover:text-danger disabled:border-divider disabled:bg-bg disabled:text-border',
  quiet: 'border-0 bg-transparent font-semibold text-danger hover:bg-danger-50 hover:text-danger hover:underline underline-offset-3 disabled:text-border',
}

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'border-0 bg-fg text-white hover:bg-fg-muted hover:text-white disabled:bg-divider disabled:text-fg-muted aria-disabled:bg-divider aria-disabled:text-fg-muted',
  secondary:
    'border-2 border-border bg-surface text-fg hover:border-fg hover:bg-bg hover:text-fg disabled:border-divider disabled:bg-bg disabled:text-border aria-disabled:border-divider aria-disabled:bg-bg aria-disabled:text-border',
  quiet:
    'border-0 bg-transparent font-semibold text-fg hover:bg-bg hover:text-fg hover:underline underline-offset-3 active:bg-divider disabled:text-border aria-disabled:text-border',
  danger:
    'border-0 bg-danger text-white hover:text-white hover:underline underline-offset-3 disabled:bg-divider disabled:text-fg-muted aria-disabled:bg-divider aria-disabled:text-fg-muted',
}

export function buttonClass(variant: ButtonVariant = 'secondary', size: ButtonSize = 'M', extra?: string, tone?: 'danger'): string {
  return cx(BASE, SIZE[size], (tone === 'danger' && DANGER_TONE[variant]) || VARIANT[variant], extra)
}

type CommonProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Warna aksi hapus untuk varian secondary dan quiet. */
  tone?: 'danger'
  icon?: ConsoleIconName
  iconAfter?: ConsoleIconName
  loading?: boolean
  children?: ReactNode
}

export type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'M', tone, icon, iconAfter, loading = false, className, children, type, onClick, disabled, ...rest },
  ref,
) {
  const iconSize = size === 'S' ? 16 : 18
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={cx(buttonClass(variant, size, undefined, tone), loading && 'cursor-progress', !loading && !disabled && 'cursor-pointer', disabled && 'cursor-not-allowed', className)}
      aria-busy={loading || undefined}
      disabled={disabled}
      onClick={(e) => {
        if (loading) {
          e.preventDefault()
          return
        }
        onClick?.(e)
      }}
      {...rest}
    >
      {loading ? <Spinner size={iconSize} /> : icon ? <ConsoleIcon name={icon} size={iconSize} strokeWidth={2.25} /> : null}
      {children}
      {iconAfter && !loading ? <ConsoleIcon name={iconAfter} size={iconSize} strokeWidth={2.25} /> : null}
    </button>
  )
})

/** Tombol ikon saja: aria-label wajib. M 44px, S 32px. */
export const IconButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'children' | 'icon' | 'iconAfter'> & { icon: ConsoleIconName; label: string }>(
  function IconButton({ icon, label, size = 'M', variant = 'secondary', tone, className, loading, type, ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type ?? 'button'}
        aria-label={label}
        title={label}
        aria-busy={loading || undefined}
        className={cx(buttonClass(variant, size, undefined, tone), size === 'M' ? 'w-11 px-0' : 'w-8 px-0', 'cursor-pointer', className)}
        {...rest}
      >
        {loading ? <Spinner size={size === 'S' ? 14 : 18} /> : <ConsoleIcon name={icon} size={size === 'S' ? 14 : 20} strokeWidth={2.5} />}
      </button>
    )
  },
)

type LinkProps = CommonProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { href: string; external?: boolean; scroll?: boolean; prefetch?: boolean }

/** Tautan dengan tampilan tombol. Tautan ke luar Kira membuka tab baru dan memakai rel noopener. */
export function ButtonLink({ href, variant = 'secondary', size = 'M', tone, icon, iconAfter, className, children, external, scroll, prefetch, ...rest }: LinkProps) {
  const iconSize = size === 'S' ? 16 : 18
  const inner = (
    <>
      {icon ? <ConsoleIcon name={icon} size={iconSize} strokeWidth={2.25} /> : null}
      {children}
      {iconAfter ? <ConsoleIcon name={iconAfter} size={iconSize} strokeWidth={2.25} /> : null}
    </>
  )
  const cls = cx(buttonClass(variant, size, undefined, tone), className)
  if (external) {
    return (
      <a href={href} className={cls} target="_blank" rel="noopener noreferrer" {...rest}>
        {inner}
      </a>
    )
  }
  return (
    <Link href={href} className={cls} scroll={scroll} prefetch={prefetch} {...rest}>
      {inner}
    </Link>
  )
}
