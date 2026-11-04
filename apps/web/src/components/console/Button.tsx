'use client'

import Link from 'next/link'
import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cx } from './cx'
import { ConsoleIcon, Spinner, type ConsoleIconName } from './icons'

/**
 * Tombol konsol (papan Button): M 48px, S 36px.
 * Varian: primary (Deep Grape, teks putih: konsol memakai teks di bawah 19 px), secondary (Lavender), quiet (garis bawah), danger (putih, garis merah).
 * Loading tetap bisa difokus dan memakai aria-busy; klik diabaikan selama memuat.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger'
export type ButtonSize = 'M' | 'S'

const BASE =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control font-extrabold no-underline select-none ' +
  'kira-press transition-transform duration-150 ease-kira enabled:not-aria-disabled:hover:-translate-y-px max-sm:h-auto max-sm:max-w-full max-sm:py-2 max-sm:whitespace-normal max-sm:text-center'

const SIZE: Record<ButtonSize, string> = {
  M: 'h-12 min-h-12 px-5 text-body',
  S: 'h-9 min-h-9 px-4 text-small',
}

const DISABLED = 'disabled:border-0 disabled:bg-lavender disabled:text-fg/55 aria-disabled:border-0 aria-disabled:bg-lavender aria-disabled:text-fg/55 aria-disabled:hover:text-fg/55'

const DANGER_TONE: Partial<Record<ButtonVariant, string>> = {
  secondary: 'border-2 border-danger bg-surface text-danger hover:text-danger ' + DISABLED,
  quiet: 'border-0 bg-transparent font-bold text-danger hover:text-danger underline underline-offset-3 decoration-2 ' + DISABLED,
}

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'border-2 border-fg bg-fg text-white hover:text-white ' + DISABLED,
  secondary: 'border-2 border-fg bg-lavender text-fg hover:text-fg ' + DISABLED,
  quiet: 'border-0 bg-transparent font-bold text-fg hover:text-fg underline underline-offset-3 decoration-2 ' + DISABLED,
  danger: 'border-2 border-danger bg-surface text-danger hover:text-danger ' + DISABLED,
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
  /**
   * Isian wajib belum lengkap: tampak abu-abu lewat aria-disabled tetapi tetap bisa diketuk,
   * supaya form bisa menjelaskan yang kurang. Berbeda dari `disabled` yang tidak menanggapi apa pun.
   */
  incomplete?: boolean
  children?: ReactNode
}

export type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'M', tone, icon, iconAfter, loading = false, incomplete = false, className, children, type, onClick, disabled, ...rest },
  ref,
) {
  const iconSize = size === 'S' ? 16 : 18
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={cx(buttonClass(variant, size, undefined, tone), loading && 'cursor-progress', !loading && !disabled && !incomplete && 'cursor-pointer', (disabled || incomplete) && !loading && 'cursor-not-allowed', className)}
      aria-busy={loading || undefined}
      aria-disabled={incomplete || undefined}
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
