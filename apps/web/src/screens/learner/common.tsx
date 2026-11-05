'use client'

import { KiraLogo } from '@/components/ui/KiraStar'
import type { ReactElement, ReactNode } from 'react'
import { ButtonLink } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { LEARNER_ROUTES } from '@/components/learner/routes'
import { useT } from '@/lib/i18n/client'

/**
 * Bagian kecil yang dipakai beberapa layar learner: wordmark, bar atas layar masuk,
 * dan kotak error yang menyebut apa yang terjadi, apa yang harus dilakukan, dan kode referensi.
 */

export function Wordmark({ className }: { className?: string }): ReactElement {
  return (
    <KiraLogo size={40} className={className} />
  )
}

/** Bar atas layar Pilih learner dan Masuk anak (papan PilihLearner, MasukAnak). */
export function SignInBar({ grownUpHref = LEARNER_ROUTES.grownUp }: { grownUpHref?: string }): ReactElement {
  const t = useT()
  return (
    <header className="flex h-18 flex-none items-center gap-2 px-3 sm:gap-4 sm:px-4 md:h-22 md:px-10">
      <Wordmark />
      <ButtonLink href={grownUpHref} variant="secondary" icon="question" className="ml-auto max-sm:h-12 max-sm:px-3.5 max-sm:text-body-lg">
        {t.shell.askGrownUp}
      </ButtonLink>
    </header>
  )
}

/** Kotak error inline untuk action yang gagal. `reference` selalu tampil. */
export function ActionError({
  title,
  message,
  reference,
  children,
  className,
}: {
  title?: ReactNode
  message: ReactNode
  reference: string
  children?: ReactNode
  className?: string
}): ReactElement {
  const t = useT()
  return (
    <div role="alert" className={cx('flex items-start gap-3 rounded-control border-2 border-danger bg-danger-50 px-4 py-3', className)}>
      <UiIcon name="alert-circle" size={22} className="mt-1 flex-none text-danger" />
      <div className="flex min-w-0 flex-col gap-1">
        {title ? <p className="m-0 text-body-lg font-bold">{title}</p> : null}
        <p className="m-0 text-body-lg">{message}</p>
        <p className="m-0 text-body text-fg-muted tabular-nums">{t.shell.reference(reference)}</p>
        {children}
      </div>
    </div>
  )
}
