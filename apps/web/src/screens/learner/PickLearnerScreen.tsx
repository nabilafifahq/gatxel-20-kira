'use client'

import Link from 'next/link'
import { SiteFooter } from '@/components/ui/SiteFooter'
import type { ReactElement } from 'react'
import { Avatar } from '@kira/figures'
import type { PickLearnerDTO } from '@/lib/dto'
import { UiIcon } from '@/components/ui/icons'
import { avatarLabel } from '@/components/learner/LearnerHeader'
import { LEARNER_ROUTES } from '@/components/learner/routes'
import { useLang, useT } from '@/lib/i18n/client'
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
  const t = useT()
  const lang = useLang()
  const learners = data.learners
  return (
    <div className="flex min-h-svh flex-col bg-bg text-fg">
      <SignInBar grownUpHref={grownUpHref} />
      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 pt-2 pb-10 md:px-10 md:pb-14">
        <div className="flex flex-col items-center gap-1.5 text-center">
          <h1 className="m-0 text-h1 font-bold">{t.shell.pick.who}</h1>
          <p className="m-0 text-body-lg text-fg-muted">{learners.length > 0 ? t.shell.pick.tapPicture : t.shell.pick.noLearners}</p>
        </div>
        <ul aria-label={t.shell.pick.learnersOn(data.deviceName)} className="m-0 grid w-full max-w-[560px] list-none grid-cols-2 gap-4 p-0 sm:flex sm:max-w-none sm:flex-wrap sm:justify-center sm:gap-6">
          {learners.map((l) => (
            <li key={l.id} className="flex">
                <Link
                  href={pinHref(l.id)}
                  aria-label={l.locked ? t.shell.pick.cardLabelLocked(l.name, l.grade) : t.shell.pick.cardLabel(l.name, l.grade)}
                  className={`${CARD} relative border-border bg-surface text-fg no-underline transition-transform duration-150 ease-kira hover:border-fg active:scale-97`}
                >
                  <Avatar name={l.avatar} size={120} title={avatarLabel(l.avatar, lang)} className="h-20 w-20 sm:h-30 sm:w-30" />
                  <span className="flex flex-col items-center">
                    <span className="text-h2 font-bold break-words">{l.name}</span>
                    <span className="text-body font-semibold text-fg-muted">{t.common.grade(l.grade)}</span>
{l.doneToday ? (
                      <span className="inline-flex items-center gap-1.5 text-body font-bold">
                        <UiIcon name="moon" size={18} />
                        {t.shell.pick.doneForToday}
                      </span>
                    ) : null}
                  </span>
                  {l.locked ? (
                    <span className="absolute top-3 right-3 inline-flex h-8 items-center gap-1 rounded-pill border-2 border-fg bg-surface px-2.5 text-small font-bold">
                      <UiIcon name="lock" size={16} />
                      {t.shell.pick.shortBreak}
                    </span>
                  ) : null}
                </Link>
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
                <span className="text-h3 font-bold">{t.shell.pick.addLearner}</span>
                <span className="text-body font-semibold text-fg-muted">{t.shell.pick.grownUpsOnly}</span>
              </span>
            </Link>
          </li>
        </ul>
        <p className="m-0 max-w-[480px] text-center text-body text-fg-muted">{t.shell.pick.everyoneOwn}</p>
      </main>
      <SiteFooter area="learner" />
    </div>
  )
}
