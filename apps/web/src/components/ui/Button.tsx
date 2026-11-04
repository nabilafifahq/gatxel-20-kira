import Link from 'next/link'
import type { ButtonHTMLAttributes, ComponentProps, ReactElement, ReactNode } from 'react'
import { cx } from './cx'
import { UiIcon, type UiIconName } from './icons'

/**
 * Tombol Kira (papan Button). Kata kerja di depan, sentence case.
 * Ukuran L 56 px untuk learner, M 48 px untuk konsol dan aksi kedua, S 36 px hanya konsol.
 * Tombol tetap bisa difokus saat loading; klik diabaikan dan aria-busy diset.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'quiet' | 'danger'
export type ButtonSize = 'L' | 'M' | 'S'

const BASE =
  'relative inline-flex items-center justify-center gap-2 rounded-control font-extrabold whitespace-nowrap select-none ' +
  'kira-press transition-transform duration-150 ease-kira enabled:hover:-translate-y-px aria-disabled:cursor-not-allowed ' +
  'disabled:cursor-not-allowed aria-busy:cursor-progress cursor-pointer no-underline'

const SIZE: Record<ButtonSize, string> = {
  L: 'h-14 px-6 text-h3',
  M: 'h-12 px-5 text-body-lg',
  S: 'h-9 px-4 text-body',
}

const ICON_ONLY: Record<ButtonSize, string> = {
  L: 'h-14 w-14 px-0',
  M: 'h-12 w-12 px-0',
  S: 'h-9 w-9 px-0',
}

const DISABLED = 'disabled:border-0 disabled:bg-lavender disabled:text-fg/55 aria-disabled:border-0 aria-disabled:bg-lavender aria-disabled:text-fg/55'

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'border-2 border-fg bg-lilac text-fg ' + DISABLED,
  secondary: 'border-2 border-fg bg-lavender text-fg ' + DISABLED,
  accent: 'border-2 border-fg bg-yellow text-fg ' + DISABLED,
  quiet: 'border-0 bg-transparent text-fg font-bold underline underline-offset-3 decoration-2 ' + DISABLED + ' disabled:no-underline',
  danger: 'border-2 border-danger bg-surface text-danger ' + DISABLED,
}

const ICON_SIZE: Record<ButtonSize, number> = { L: 20, M: 18, S: 16 }

/** Teks di atas Lilac hanya 19 px tebal ke atas (kontras 3:1): ukuran M dan S memakai Deep Grape berteks putih. */
const PRIMARY_SMALL = 'border-2 border-fg bg-fg text-white ' + DISABLED

export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'L', iconOnly = false, extra?: string): string {
  return cx(BASE, iconOnly ? ICON_ONLY[size] : SIZE[size], variant === 'primary' && size !== 'L' ? PRIMARY_SMALL : VARIANT[variant], extra)
}

type CommonProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Ikon sebelum label. */
  icon?: UiIconName
  /** Ikon sesudah label, biasanya arrow-right untuk tombol maju. */
  iconAfter?: UiIconName
  loading?: boolean
  children?: ReactNode
  className?: string
}

export type ButtonProps = CommonProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'>

export function Button({
  variant = 'primary',
  size = 'L',
  icon,
  iconAfter,
  loading = false,
  children,
  className,
  type = 'button',
  onClick,
  ...rest
}: ButtonProps): ReactElement {
  const iconSize = ICON_SIZE[size]
  return (
    <button
      {...rest}
      type={type}
      aria-busy={loading || undefined}
      onClick={loading ? (e) => e.preventDefault() : onClick}
      className={buttonClasses(variant, size, false, className)}
    >
      {loading ? <UiIcon name="spinner" size={iconSize} /> : icon ? <UiIcon name={icon} size={iconSize + 2} /> : null}
      {children}
      {iconAfter && !loading ? <UiIcon name={iconAfter} size={iconSize} /> : null}
    </button>
  )
}

/** Tombol ikon saja. `label` wajib dan menjadi aria-label. */
export function IconButton({
  icon,
  label,
  variant = 'secondary',
  size = 'L',
  iconSize,
  className,
  type = 'button',
  loading = false,
  onClick,
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> & {
  icon: UiIconName
  label: string
  variant?: ButtonVariant
  size?: ButtonSize
  iconSize?: number
  loading?: boolean
}): ReactElement {
  return (
    <button
      {...rest}
      type={type}
      aria-label={label}
      aria-busy={loading || undefined}
      onClick={loading ? (e) => e.preventDefault() : onClick}
      className={buttonClasses(variant, size, true, className)}
    >
      <UiIcon name={loading ? 'spinner' : icon} size={iconSize ?? (size === 'L' ? 24 : size === 'M' ? 20 : 16)} />
    </button>
  )
}

export type ButtonLinkProps = CommonProps & Omit<ComponentProps<typeof Link>, 'children' | 'className'>

/** Tautan bergaya tombol (next/link). Dipakai untuk navigasi, bukan untuk aksi. */
export function ButtonLink({
  variant = 'primary',
  size = 'L',
  icon,
  iconAfter,
  children,
  className,
  loading: _loading,
  ...rest
}: ButtonLinkProps): ReactElement {
  void _loading
  const iconSize = ICON_SIZE[size]
  return (
    <Link {...rest} className={buttonClasses(variant, size, false, className)}>
      {icon ? <UiIcon name={icon} size={iconSize + 2} /> : null}
      {children}
      {iconAfter ? <UiIcon name={iconAfter} size={iconSize} /> : null}
    </Link>
  )
}

/** Tautan ikon saja (misalnya tombol keluar 56 px di bar atas). */
export function IconLink({
  icon,
  label,
  size = 'L',
  variant = 'secondary',
  className,
  ...rest
}: Omit<ComponentProps<typeof Link>, 'children' | 'className' | 'aria-label'> & {
  icon: UiIconName
  label: string
  size?: ButtonSize
  variant?: ButtonVariant
  className?: string
}): ReactElement {
  return (
    <Link {...rest} aria-label={label} className={buttonClasses(variant, size, true, className)}>
      <UiIcon name={icon} size={size === 'L' ? 24 : size === 'M' ? 20 : 16} />
    </Link>
  )
}
