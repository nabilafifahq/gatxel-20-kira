'use client'

import type { ReactElement } from 'react'
import { useT } from '@/lib/i18n/client'
import { cx } from './cx'

/**
 * Kerangka pemuatan: blok Soft Lavender yang bernapas lewat opacity (mati saat reduced motion).
 * Dipakai di loading.tsx supaya layar yang menunggu data tidak melompat saat isinya datang.
 */
export function Skeleton({ className }: { className?: string }): ReactElement {
  return <div aria-hidden="true" className={cx('kira-skeleton rounded-card bg-lavender', className)} />
}

/** Kerangka layar learner: rel kiri di tablet, sapaan, bar progres, dan tiga kartu. */
export function LearnerSkeleton(): ReactElement {
  const t = useT()
  return (
    <div role="status" aria-busy="true" aria-label={t.shell.ui.loading} className="min-h-svh bg-bg md:flex">
      <div aria-hidden="true" className="hidden h-svh w-26 flex-none bg-surface shadow-soft md:block" />
      <div className="flex min-w-0 flex-1 flex-col gap-6 px-4 pt-5 pb-28 md:px-10 md:pt-8 md:pb-8 md:pl-8">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-pill" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-5 w-64 max-w-full" />
          </div>
        </div>
        <Skeleton className="h-4 w-full rounded-pill" />
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  )
}

/** Kerangka layar dewasa (konsol tutor dan keluarga). */
export function PageSkeleton(): ReactElement {
  return (
    <div role="status" aria-busy="true" aria-label="Memuat" className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 py-8 md:px-8">
      <Skeleton className="h-10 w-72 max-w-full" />
      <Skeleton className="h-5 w-96 max-w-full" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
      <Skeleton className="h-64" />
    </div>
  )
}
