'use client'

import Link from 'next/link'
import type { FamilyHomeDTO } from '@/lib/dto'
import { ButtonLink } from '@/components/console/Button'
import { cx } from '@/components/console/cx'
import { ConsoleIcon } from '@/components/console/icons'
import { FAMILY_ROUTES } from '@/components/console/routes'
import { FamilyShell } from '@/components/family/FamilyShell'
import { WeekSummary } from '@/components/family/WeekSummary'

/**
 * G01 Ringkasan minggu untuk orang tua (papan RingkasanMinggu, RingkasanMingguPertama).
 * Untuk HP: satu kolom, angka dalam kalimat, tombol 48px. Learner dan minggu dipilih
 * lewat tautan (parameter URL `learner` dan tautan minggu dari DTO).
 */

export type FamilyHomeScreenProps = { data: FamilyHomeDTO }

export function FamilyHomeScreen({ data }: FamilyHomeScreenProps) {
  const s = data.summary
  const current = data.learners.find((l) => l.id === data.selectedLearnerId)
  return (
    <FamilyShell shell={data.shell} active="home" learnerName={current?.name ?? s.learnerName}>
      {data.learners.length > 1 ? (
        <nav aria-label="Pilih anak" className="relative -mb-2 flex gap-2 overflow-x-auto">
          {data.learners.map((l) => {
            const on = l.id === data.selectedLearnerId
            return (
              <Link
                key={l.id}
                href={`?learner=${encodeURIComponent(l.id)}`}
                aria-current={on ? 'page' : undefined}
                className={cx(
                  'inline-flex h-11 flex-none items-center rounded-pill border-2 px-4 text-body font-bold text-fg no-underline hover:text-fg',
                  on ? 'border-fg bg-surface' : 'border-divider bg-surface hover:border-fg',
                )}
              >
                {l.name}
              </Link>
            )
          })}
        </nav>
      ) : null}

      <div className="flex items-end gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h1 className="m-0 text-h2 font-bold">{s.firstWeek ? 'Minggu pertama' : 'Minggu ini'}</h1>
          <p className="m-0 text-body text-fg-muted">{s.weekLabel}</p>
        </div>
        <nav aria-label="Pilih minggu" className="flex flex-none gap-2">
          {data.prevWeekHref ? (
            <Link
              href={data.prevWeekHref}
              aria-label="Minggu sebelumnya"
              className="inline-flex size-11 items-center justify-center rounded-control border-2 border-border bg-surface text-fg hover:border-fg hover:text-fg"
            >
              <ConsoleIcon name="chevronLeft" size={20} strokeWidth={2.5} />
            </Link>
          ) : null}
          {data.nextWeekHref ? (
            <Link
              href={data.nextWeekHref}
              aria-label="Minggu berikutnya"
              className="inline-flex size-11 items-center justify-center rounded-control border-2 border-border bg-surface text-fg hover:border-fg hover:text-fg"
            >
              <ConsoleIcon name="chevronRight" size={20} strokeWidth={2.5} />
            </Link>
          ) : null}
        </nav>
      </div>

      <WeekSummary summary={s} />

      <div className="flex flex-col gap-2.5">
        <ButtonLink href={`${FAMILY_ROUTES.privacy}?learner=${encodeURIComponent(data.selectedLearnerId)}`} variant="secondary" icon="shield" className="h-12 w-full">
          Privasi dan data {s.learnerName}
        </ButtonLink>
      </div>
    </FamilyShell>
  )
}
