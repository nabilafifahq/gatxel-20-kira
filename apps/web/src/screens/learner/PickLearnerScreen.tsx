import Link from 'next/link'
import type { ReactElement } from 'react'
import { Avatar } from '@kira/figures'
import type { PickLearnerDTO } from '@/lib/dto'
import { UiIcon } from '@/components/ui/icons'
import { avatarLabel } from '@/components/learner/LearnerHeader'
import { LEARNER_ROUTES } from '@/components/learner/routes'
import { SignInBar } from './common'

/**
 * L18 Pilih learner (papan PilihLearner, PilihLearnerBatas). Satu kartu per learner di
 * perangkat ini. Learner yang sudah mencapai batas hari ini tampil putus-putus tanpa tautan.
 * DTO belum membawa href, jadi tautan memakai LEARNER_ROUTES (bisa diganti lewat props).
 */

const CARD = 'flex w-full flex-col items-center justify-center gap-3 rounded-card border-2 px-4 py-6 text-center sm:h-75 sm:w-60 sm:py-0'

export function PickLearnerScreen({
  data,
  pinHref = LEARNER_ROUTES.pin,
  grownUpHref = LEARNER_ROUTES.grownUp,
  addLearnerHref = LEARNER_ROUTES.grownUp,
}: {
  data: PickLearnerDTO
  pinHref?: (learnerId: string) => string
  grownUpHref?: string
  addLearnerHref?: string
}): ReactElement {
  const learners = data.learners
  return (
    <div className="flex min-h-svh flex-col bg-bg text-fg">
      <SignInBar grownUpHref={grownUpHref} />
      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 pt-2 pb-10 md:px-10 md:pb-14">
        <div className="flex flex-col items-center gap-1.5 text-center">
          <h1 className="m-0 text-h1 font-bold">Who is learning today?</h1>
          <p className="m-0 text-body-lg text-fg-muted">{learners.length > 0 ? 'Tap your picture.' : 'No learners on this tablet yet.'}</p>
        </div>
        <ul aria-label={`Learners on ${data.deviceName}`} className="m-0 grid w-full max-w-[560px] list-none grid-cols-2 gap-4 p-0 sm:flex sm:max-w-none sm:flex-wrap sm:justify-center sm:gap-6">
          {learners.map((l) => (
            <li key={l.id} className="flex">
              {l.doneToday ? (
                <div role="group" aria-label={`${l.name}, done for today`} className={`${CARD} border-dashed border-border bg-bg`}>
                  <Avatar name={l.avatar} size={120} className="h-20 w-20 sm:h-30 sm:w-30" />
                  <span className="flex flex-col items-center">
                    <span className="text-h2 font-bold break-words">{l.name}</span>
                    <span className="inline-flex items-center gap-1.5 text-body font-bold">
                      <UiIcon name="moon" size={18} className="hidden sm:block" />
                      Done for today
                    </span>
                    <span className="text-body text-fg-muted">Back tomorrow</span>
                  </span>
                </div>
              ) : (
                <Link
                  href={pinHref(l.id)}
                  aria-label={`${l.name}, Grade ${l.grade}${l.locked ? ', locked for a short break' : ''}`}
                  className={`${CARD} relative border-border bg-surface text-fg no-underline transition-transform duration-150 ease-kira hover:border-fg active:scale-97`}
                >
                  <Avatar name={l.avatar} size={120} title={avatarLabel(l.avatar)} className="h-20 w-20 sm:h-30 sm:w-30" />
                  <span className="flex flex-col items-center">
                    <span className="text-h2 font-bold break-words">{l.name}</span>
                    <span className="text-body font-semibold text-fg-muted">Grade {l.grade}</span>
                  </span>
                  {l.locked ? (
                    <span className="absolute top-3 right-3 inline-flex h-8 items-center gap-1 rounded-pill border-2 border-fg bg-surface px-2.5 text-small font-bold">
                      <UiIcon name="lock" size={16} />
                      Short break
                    </span>
                  ) : null}
                </Link>
              )}
            </li>
          ))}
          <li className="flex">
            <Link
              href={addLearnerHref}
              className={`${CARD} border-dashed border-border bg-transparent text-fg no-underline hover:border-fg`}
            >
              <span className="flex h-20 w-20 items-center justify-center rounded-pill border-2 border-dashed border-border bg-surface sm:h-30 sm:w-30">
                <UiIcon name="plus" size={40} />
              </span>
              <span className="flex flex-col items-center">
                <span className="text-h3 font-bold">Add a learner</span>
                <span className="text-body font-semibold text-fg-muted">Grown-ups only</span>
              </span>
            </Link>
          </li>
        </ul>
        <p className="m-0 max-w-[480px] text-center text-body text-fg-muted">Everyone has their own stars, streak and secret pictures.</p>
      </main>
    </div>
  )
}
