'use client'

import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { cx } from './cx'
import { ConsoleIcon } from './icons'

/**
 * Kontrol form konsol. Label selalu terlihat, petunjuk di aria-describedby,
 * error ditulis sebagai teks (bukan hanya warna). Tinggi 44px, teks 16px.
 * Paste tidak pernah diblokir.
 */

export const CONTROL =
  'h-12 w-full min-w-0 rounded-md border-2 bg-surface px-3 text-body text-fg placeholder:text-fg-muted focus-visible:ring-4 focus-visible:ring-lilac ' +
  'disabled:cursor-not-allowed disabled:border-lavender disabled:bg-lavender disabled:text-fg-muted'

export function controlBorder(error?: string | null): string {
  return error ? 'border-danger' : 'border-border hover:border-fg'
}

/** Tanda kolom wajib: bintang merah yang terlihat, dan kata "wajib" untuk pembaca layar. */
export function RequiredMark() {
  return (
    <>
      <span aria-hidden="true" className="font-bold text-danger"> *</span>
      <span className="visually-hidden"> wajib</span>
    </>
  )
}

/** Tanda kolom yang boleh dilewati. */
export function OptionalMark() {
  return <span className="font-normal text-fg-muted"> (opsional)</span>
}

/** Satu baris di atas form yang punya kolom wajib. */
export function RequiredNote({ className }: { className?: string }) {
  return (
    <p className={cx('m-0 text-small text-fg-muted', className)}>
      <span aria-hidden="true" className="font-bold text-danger">*</span> wajib diisi
    </p>
  )
}

/**
 * Pindahkan fokus ke isian pertama yang bermasalah, setelah React menulis pesannya ke DOM.
 * Isian biasa ditandai aria-invalid; kelompok seperti PIN gambar dan pemeriksaan keamanan memakai data-problem.
 */
export function focusFirstProblem(root: HTMLElement | null) {
  if (!root) return
  window.setTimeout(() => {
    const el = root.querySelector<HTMLElement>('[aria-invalid="true"], [data-problem="true"]')
    if (!el) return
    el.focus({ preventScroll: true })
    el.scrollIntoView({ block: 'center' })
  }, 0)
}

type RequirementProps = {
  /** Tampilkan * merah dan aria-required. Bukan atribut HTML required: pemeriksaan dan pesannya milik form. */
  required?: boolean
  /** Tampilkan (opsional) setelah label. */
  optional?: boolean
}

export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <span id={id} className="flex items-start gap-1.5 text-small font-bold text-danger">
      <ConsoleIcon name="alert" size={16} strokeWidth={2.5} className="mt-[3px]" />
      <span>{children}</span>
    </span>
  )
}

type FieldShellProps = {
  id: string
  label: ReactNode
  hint?: ReactNode
  error?: string | null
  labelAside?: ReactNode
  className?: string
  children: ReactNode
  hideLabel?: boolean
} & RequirementProps

/** Pembungkus label, petunjuk, dan error. `id` milik kontrolnya. */
export function FieldShell({ id, label, hint, error, labelAside, className, children, hideLabel, required, optional }: FieldShellProps) {
  return (
    <div className={cx('flex min-w-0 flex-col gap-1.5', className)}>
      <div className={cx('flex items-baseline gap-2', hideLabel && 'visually-hidden')}>
        <label htmlFor={id} className="text-small font-bold">
          {label}
          {required ? <RequiredMark /> : optional ? <OptionalMark /> : null}
        </label>
        {labelAside ? <span className="ml-auto">{labelAside}</span> : null}
      </div>
      {children}
      {hint ? (
        <span id={`${id}-hint`} className="text-small text-fg-muted">
          {hint}
        </span>
      ) : null}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </div>
  )
}

function describedBy(id: string, hint?: ReactNode, error?: string | null, extra?: string): string | undefined {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null, extra ?? null].filter(Boolean)
  return ids.length ? ids.join(' ') : undefined
}

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  id?: string
  label: ReactNode
  hint?: ReactNode
  error?: string | null
  labelAside?: ReactNode
  fieldClassName?: string
  hideLabel?: boolean
  /** Elemen di dalam kanan kontrol, misalnya tombol Tampilkan. */
  trailing?: ReactNode
  trailingWidth?: 'sm' | 'md'
} & RequirementProps

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { id, label, hint, error, labelAside, fieldClassName, className, hideLabel, trailing, trailingWidth = 'md', type = 'text', required, optional, ...rest },
  ref,
) {
  const auto = useId()
  const fid = id ?? `f${auto.replace(/:/g, '')}`
  return (
    <FieldShell id={fid} label={label} hint={hint} error={error} labelAside={labelAside} className={fieldClassName} hideLabel={hideLabel} required={required} optional={optional}>
      <div className="relative min-w-0">
        <input
          ref={ref}
          id={fid}
          type={type}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(fid, hint, error, rest['aria-describedby'])}
          className={cx(CONTROL, controlBorder(error), trailing ? (trailingWidth === 'sm' ? 'pr-14' : 'pr-32') : null, className)}
          {...rest}
        />
        {trailing ? <div className="absolute top-1 right-1 bottom-1 flex items-center">{trailing}</div> : null}
      </div>
    </FieldShell>
  )
})

type TextAreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> & {
  id?: string
  label: ReactNode
  hint?: ReactNode
  error?: string | null
  labelAside?: ReactNode
  fieldClassName?: string
  hideLabel?: boolean
} & RequirementProps

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { id, label, hint, error, labelAside, fieldClassName, className, hideLabel, rows = 3, required, optional, ...rest },
  ref,
) {
  const auto = useId()
  const fid = id ?? `f${auto.replace(/:/g, '')}`
  return (
    <FieldShell id={fid} label={label} hint={hint} error={error} labelAside={labelAside} className={fieldClassName} hideLabel={hideLabel} required={required} optional={optional}>
      <textarea
        ref={ref}
        id={fid}
        rows={rows}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fid, hint, error, rest['aria-describedby'])}
        className={cx(
          'w-full min-w-0 resize-y rounded-md border-2 bg-surface px-3 py-2.5 text-body text-fg placeholder:text-fg-muted disabled:border-lavender disabled:bg-lavender',
          controlBorder(error),
          className,
        )}
        {...rest}
      />
    </FieldShell>
  )
})

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> & {
  id?: string
  label: ReactNode
  hint?: ReactNode
  error?: string | null
  fieldClassName?: string
  hideLabel?: boolean
  options: { value: string; label: string; disabled?: boolean }[]
  /** Penanda filter aktif: garis --fg dan teks tebal. */
  active?: boolean
} & RequirementProps

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { id, label, hint, error, fieldClassName, className, hideLabel, options, active, required, optional, ...rest },
  ref,
) {
  const auto = useId()
  const fid = id ?? `f${auto.replace(/:/g, '')}`
  return (
    <FieldShell id={fid} label={label} hint={hint} error={error} className={fieldClassName} hideLabel={hideLabel} required={required} optional={optional}>
      <div className="relative min-w-0">
        <select
          ref={ref}
          id={fid}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(fid, hint, error, rest['aria-describedby'])}
          className={cx(
            CONTROL,
            'cursor-pointer appearance-none pr-10',
            error ? 'border-danger' : active ? 'border-fg font-extrabold' : 'border-border hover:border-fg',
            className,
          )}
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        <ConsoleIcon name="chevronDown" size={16} strokeWidth={2.5} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2" />
      </div>
    </FieldShell>
  )
})

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'id'> & {
  id?: string
  label: ReactNode
  description?: ReactNode
  indeterminate?: boolean
  /** Pesan bila kotak wajib belum dicentang, tampil tepat di bawah labelnya. */
  error?: string | null
} & RequirementProps

/** Kotak centang asli. Status campuran memakai properti DOM `indeterminate`, bukan aria-checked. */
export function Checkbox({ id, label, description, indeterminate, className, required, optional, error, ...rest }: CheckboxProps) {
  const auto = useId()
  const fid = id ?? `c${auto.replace(/:/g, '')}`
  return (
    <div className={cx('flex min-h-6 items-start gap-2.5', className)}>
      {/* Kotak 20 px dengan area tekan 44 px: label pembungkus melebar 12 px ke tiap sisi tanpa menggeser tata letak. */}
      <label className="-m-3 flex-none cursor-pointer p-3 has-disabled:cursor-not-allowed">
        <input
          id={fid}
          type="checkbox"
          ref={(el) => {
            if (el) el.indeterminate = Boolean(indeterminate)
          }}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={[description ? `${fid}-desc` : null, error ? `${fid}-error` : null].filter(Boolean).join(' ') || undefined}
          className="mt-[3px] block size-5 cursor-pointer accent-fg disabled:cursor-not-allowed"
          {...rest}
        />
      </label>
      <span className="flex min-w-0 flex-col">
        <label htmlFor={fid} className="cursor-pointer text-body font-semibold">
          {label}
          {required ? <RequiredMark /> : optional ? <OptionalMark /> : null}
        </label>
        {description ? (
          <span id={`${fid}-desc`} className="text-small text-fg-muted">
            {description}
          </span>
        ) : null}
        {error ? <FieldError id={`${fid}-error`}>{error}</FieldError> : null}
      </span>
    </div>
  )
}

type RadioOption<T extends string> = { value: T; label: ReactNode; description?: ReactNode; disabled?: boolean }

/** Grup radio dengan fieldset dan legend. Selalu ada satu nilai terpilih. */
export function RadioGroup<T extends string>({
  name,
  legend,
  value,
  onChange,
  options,
  hint,
  error,
  layout = 'stack',
  className,
  hideLegend,
  required,
}: {
  name: string
  legend: ReactNode
  value: T
  onChange: (v: T) => void
  options: RadioOption<T>[]
  hint?: ReactNode
  error?: string | null
  layout?: 'stack' | 'row' | 'tiles'
  className?: string
  hideLegend?: boolean
  required?: boolean
}) {
  const auto = useId()
  const gid = `r${auto.replace(/:/g, '')}`
  return (
    <fieldset
      className={cx('m-0 flex min-w-0 flex-col gap-2 border-0 p-0', className)}
      aria-describedby={[hint ? `${gid}-hint` : null, error ? `${gid}-error` : null].filter(Boolean).join(' ') || undefined}
    >
      <legend className={cx('mb-1.5 p-0 text-small font-bold', hideLegend && 'visually-hidden')}>
        {legend}
        {required ? <RequiredMark /> : null}
      </legend>
      <div className={cx(layout === 'stack' && 'flex flex-col gap-2', layout === 'row' && 'flex flex-wrap gap-x-5 gap-y-2', layout === 'tiles' && 'grid gap-2 sm:grid-cols-2')}>
        {options.map((o) => {
          const oid = `${gid}-${o.value}`
          const checked = o.value === value
          return (
            <label
              key={o.value}
              htmlFor={oid}
              className={cx(
                'flex cursor-pointer items-start gap-2.5',
                layout === 'tiles' &&
                  cx('min-h-11 rounded-control border-2 px-3 py-2', checked ? 'border-fg bg-lilac' : 'border-border bg-surface hover:border-fg'),
                o.disabled && 'cursor-not-allowed opacity-60',
              )}
            >
              <input
                id={oid}
                type="radio"
                name={name}
                value={o.value}
                checked={checked}
                disabled={o.disabled}
                onChange={() => onChange(o.value)}
                className="mt-[3px] size-5 flex-none cursor-pointer accent-fg"
              />
              <span className="flex min-w-0 flex-col">
                <span className={cx('text-body', checked ? 'font-bold' : 'font-semibold')}>{o.label}</span>
                {o.description ? <span className="text-small text-fg-muted">{o.description}</span> : null}
              </span>
            </label>
          )
        })}
      </div>
      {hint ? (
        <span id={`${gid}-hint`} className="text-small text-fg-muted">
          {hint}
        </span>
      ) : null}
      {error ? <FieldError id={`${gid}-error`}>{error}</FieldError> : null}
    </fieldset>
  )
}

/** Sakelar 56 x 32 (papan PrivasiKeluarga). role="switch" dengan aria-checked di elemen button. */
export function Switch({
  checked,
  onChange,
  labelledBy,
  label,
  disabled,
  busy,
  describedBy: desc,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  labelledBy?: string
  label?: string
  disabled?: boolean
  busy?: boolean
  describedBy?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label}
      aria-describedby={desc}
      aria-busy={busy || undefined}
      disabled={disabled}
      onClick={() => {
        if (!busy) onChange(!checked)
      }}
      className={cx(
        'relative after:absolute after:-inset-y-1.5 after:inset-x-0 after:content-[""] relative flex h-8 w-14 flex-none cursor-pointer items-center rounded-pill border-2 p-[3px] disabled:cursor-not-allowed disabled:opacity-60',
        checked ? 'border-fg bg-fg' : 'border-border bg-surface',
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          'size-[22px] rounded-pill border border-fg transition-transform duration-150 ease-kira',
          checked ? 'translate-x-6 bg-surface' : 'translate-x-0 bg-divider',
        )}
      />
    </button>
  )
}
