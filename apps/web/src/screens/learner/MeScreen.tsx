'use client'

import { useState, type CSSProperties, type ReactElement } from 'react'
import { Avatar } from '@kira/figures'
import { jakartaDate } from '@kira/core/time'
import type { AccessoryId } from '@kira/core'
import type { AvatarName, MeActions, MeDTO } from '@/lib/dto'
import { Button, ButtonLink } from '@/components/ui/Button'
import { LangSwitch } from '@/components/learner/LangSwitch'
import { cx } from '@/components/ui/cx'
import { Dialog } from '@/components/ui/Dialog'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { BadgeTile } from '@/components/learner/BadgeTile'
import { avatarLabel, LearnerFrame } from '@/components/learner/LearnerHeader'
import { LEARNER_ROUTES } from '@/components/learner/routes'
import { SoundToggle } from '@/components/learner/SoundToggle'
import { MusicToggle } from '@/components/learner/MusicToggle'
import { ChestCollection } from '@/components/learner/ChestCollection'
import { DayGlyph, dayStatusWord } from '@/components/learner/StreakChain'
import { XpTrackBars } from '@/components/learner/arena/XpTrackBars'
import { useLang, useT } from '@/lib/i18n/client'
import { ActionError } from './common'

/**
 * L10 Me (papan Me, MeBaru): avatar, level dan XP, lencana, kalender streak bulan ini.
 * DTO kalender belum menandai hari ini; layar memakai status `today` atau tanggal
 * Asia/Jakarta perangkat.
 */

function AvatarDialog({
  open,
  onClose,
  avatars,
  current,
  onSaved,
  actions,
}: {
  open: boolean
  onClose: () => void
  avatars: AvatarName[]
  current: AvatarName
  onSaved: (a: AvatarName) => void
  actions: MeActions
}): ReactElement {
  const t = useT()
  const lang = useLang()
  const [choice, setChoice] = useState<AvatarName>(current)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ message: string; reference: string } | null>(null)

  const save = async () => {
    if (choice === current) {
      onClose()
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await actions.changeAvatar(choice)
      if (res.ok) {
        onSaved(choice)
        onClose()
      } else setError({ message: res.message, reference: res.reference })
    } catch {
      setError({ message: t.shell.me.avatarNotSaved, reference: 'KRA-ME-NET' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t.shell.me.chooseAvatar}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button onClick={() => void save()} loading={busy} data-autofocus>
            {t.shell.me.saveAvatar}
          </Button>
        </>
      }
    >
      <div role="radiogroup" aria-label={t.shell.me.avatars} className="grid grid-cols-4 gap-3">
        {avatars.map((a) => {
          const on = a === choice
          return (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={avatarLabel(a, lang)}
              onClick={() => setChoice(a)}
              className={cx(
                'flex aspect-square cursor-pointer items-center justify-center rounded-card bg-surface p-1.5',
                on ? 'border-3 border-fg bg-bg' : 'border-2 border-border hover:border-fg',
              )}
            >
              <Avatar name={a} size={72} className="h-full w-full max-w-18" />
            </button>
          )
        })}
      </div>
      {error ? <ActionError message={error.message} reference={error.reference} /> : null}
    </Dialog>
  )
}

function MeBody({ data, actions, myWords, langSwitch }: { data: MeDTO; actions: MeActions; myWords: boolean; langSwitch: boolean }): ReactElement {
  const t = useT()
  const lang = useLang()
  const toast = useToast()
  const [avatar, setAvatar] = useState<AvatarName>(data.shell.avatar)
  const [accessory, setAccessory] = useState<string | null>(data.shell.accessory ?? null)
  const [accessoryBusy, setAccessoryBusy] = useState(false)
  const [picking, setPicking] = useState(false)
  // Kunci baru setiap kali dialog dibuka supaya pilihan mulai dari avatar yang sedang dipakai.
  const [openCount, setOpenCount] = useState(0)
  const shell = { ...data.shell, avatar, accessory }
  const earned = data.badges.filter((b) => b.earnedAt !== null)
  const pct = data.xpLevelSpan > 0 ? Math.min(100, Math.round((data.xpIntoLevel / data.xpLevelSpan) * 100)) : 0
  const xpLine = t.shell.xpToLevel(data.xpIntoLevel, data.xpLevelSpan, data.level + 1)
  const todayIso = jakartaDate()
  const changeAccessory = async (next: AccessoryId | null) => {
    if (!actions.changeAccessory || accessoryBusy || next === accessory) return
    setAccessoryBusy(true)
    try {
      const res = await actions.changeAccessory(next)
      if (res.ok) {
        setAccessory(next)
        toast({ kind: 'success', title: next ? t.shell.me.accessorySaved : t.shell.me.accessoryOff })
      } else toast({ kind: 'error', title: res.message })
    } catch {
      toast({ kind: 'error', title: t.shell.me.accessoryNotSaved })
    } finally {
      setAccessoryBusy(false)
    }
  }
  const isToday = (c: MeDTO['calendar'][number]) => c.status === 'today' || (c.inMonth && c.date === todayIso)

  return (
    <LearnerFrame shell={shell} current="me" className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center gap-5">
        <Avatar name={avatar} accessory={accessory} background={data.shell.background ?? null} size={96} title={avatarLabel(avatar, lang)} className="h-20 w-20 flex-none md:h-24 md:w-24" />
        <div className="flex min-w-0 flex-col items-start gap-1.5">
          <h1 className="m-0 text-h1 font-bold break-words">{data.shell.name}</h1>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="M"
              onClick={() => {
                setOpenCount((c) => c + 1)
                setPicking(true)
              }}
            >
              {t.shell.me.changeAvatar}
            </Button>
            {/* Tablet bersama: anak lain bisa masuk setelah sesi ini diakhiri. */}
            <ButtonLink href={LEARNER_ROUTES.switchLearner} variant="secondary" size="M" prefetch={false}>
              {t.shell.me.switchLearner}
            </ButtonLink>
            <SoundToggle />
            <MusicToggle />
            <ButtonLink href="/panduan/anak" variant="secondary" size="M" prefetch={false}><span lang="id">Panduan Kira</span></ButtonLink>
          </div>
        </div>
        <div className="flex w-full items-center gap-5 rounded-card bg-surface shadow-soft px-6 py-3.5 lg:ml-auto lg:w-auto">
          <div className="flex flex-col">
            <span className="text-body font-semibold text-fg-muted">{t.shell.me.level}</span>
            <span className="font-numbers text-display leading-none font-semibold tabular-nums">{data.level}</span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2 lg:w-65 lg:flex-none">
            <span role="img" aria-label={xpLine} className="flex h-3 overflow-hidden rounded-control bg-divider">
              <span className="kira-bar-fill bg-star" style={{ '--p': pct / 100 } as CSSProperties} />
            </span>
            <span className="text-body font-semibold tabular-nums">{xpLine}</span>
          </div>
        </div>
      </header>

      {data.tracks ? (
        <section aria-labelledby="me-tracks" className="flex flex-col gap-4 rounded-card bg-surface shadow-soft p-5 md:p-7">
          <h2 id="me-tracks" className="m-0 text-h2 font-bold">
            {t.shell.me.xpAndLevels}
          </h2>
          <XpTrackBars tracks={data.tracks} />
          <div className="flex flex-wrap gap-3">
            {data.tracks.some((x) => x.track === 'hitung') ? (
              <ButtonLink href={LEARNER_ROUTES.quickMaths} variant="secondary" size="M" icon="bolt">
                {t.shell.nav['quick-maths']}
              </ButtonLink>
            ) : null}
            {data.tracks.some((x) => x.track === 'pengetahuan') ? (
              <ButtonLink href={LEARNER_ROUTES.quizArena} variant="secondary" size="M" icon="globe">
                {t.shell.nav['quiz-arena']}
              </ButtonLink>
            ) : null}
          </div>
        </section>
      ) : null}

      {myWords ? (
        <section aria-labelledby="me-words" className="flex flex-wrap items-center gap-3 rounded-card border border-divider bg-surface p-5 md:p-7">
          <h2 id="me-words" className="m-0 min-w-0 flex-1 text-h2 font-bold">
            {t.shell.me.myWords}
          </h2>
          <ButtonLink href={LEARNER_ROUTES.myWords} variant="secondary" size="M" icon="book">
            {t.shell.me.openMyWords}
          </ButtonLink>
        </section>
      ) : null}

      {langSwitch ? (
        <section className="rounded-card border border-divider bg-surface p-5 md:p-7">
          <LangSwitch />
        </section>
      ) : null}

      {data.accessories && actions.changeAccessory ? (
        <section aria-labelledby="me-accessories" className="flex flex-col gap-3 rounded-card bg-surface shadow-soft p-5 md:p-7">
          <h2 id="me-accessories" className="m-0 text-h2 font-bold">
            {t.shell.me.accessories}
          </h2>
          <p className="m-0 text-body-lg text-fg-muted">{t.shell.me.accessoriesLine}</p>
          <div role="radiogroup" aria-label={t.shell.me.accessories} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <button
              type="button"
              role="radio"
              aria-checked={accessory === null}
              disabled={accessoryBusy}
              onClick={() => void changeAccessory(null)}
              className={cx('flex min-h-32 cursor-pointer flex-col items-center justify-center gap-1 rounded-control p-2 text-center', accessory === null ? 'border-3 border-fg bg-bg' : 'border-2 border-border bg-surface hover:border-fg')}
            >
              <Avatar name={avatar} size={64} />
              <span className="text-body font-bold">{t.shell.me.noAccessory}</span>
            </button>
            {data.accessories.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={accessory === a.id}
                aria-disabled={!a.earned}
                disabled={accessoryBusy}
                onClick={() => (a.earned ? void changeAccessory(a.id) : undefined)}
                className={cx(
                  'flex min-h-32 flex-col items-center justify-center gap-1 rounded-control p-2 text-center',
                  a.earned ? 'cursor-pointer' : 'cursor-default border-dashed',
                  accessory === a.id ? 'border-3 border-fg bg-bg' : a.earned ? 'border-2 border-border bg-surface hover:border-fg' : 'border-2 border-border bg-bg',
                )}
              >
                <span className={a.earned ? undefined : 'opacity-50'}>
                  <Avatar name={avatar} accessory={a.id} size={64} />
                </span>
                <span className="text-body font-bold">{a.label}</span>
                {!a.earned ? <span className="text-body leading-5 text-fg-muted">{a.howToEarn}</span> : null}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section aria-label={t.shell.nav.world} className="flex flex-wrap items-center gap-3.5 rounded-card border-2 border-fg bg-surface p-4">
        <div className="flex min-w-50 flex-1 flex-col gap-0.5">
          <h2 className="m-0 text-h3 font-bold">{t.shell.nav.world}</h2>
          <p className="m-0 text-body text-fg-muted">{t.shell.me.worldLine}</p>
        </div>
        <ButtonLink href={LEARNER_ROUTES.world} prefetch={false} iconAfter="arrow-right">
          {t.shell.me.openWorld}
        </ButtonLink>
      </section>
      {data.collection ? <ChestCollection collection={data.collection} avatar={avatar} accessory={accessory} background={data.shell.background ?? null} equip={actions.equipChest} /> : null}

      <div className="flex flex-1 flex-col gap-6 lg:flex-row">
        <section aria-labelledby="me-badges" className="flex min-w-0 flex-col gap-4 rounded-card bg-surface shadow-soft p-5 md:p-7 lg:flex-[1.15]">
          <div className="flex items-center gap-3">
            <h2 id="me-badges" className="m-0 text-h2 font-bold">
              {t.shell.me.badges}
            </h2>
            {data.badges.length > 0 ? (
              <span className="ml-auto text-body font-bold tabular-nums">
                {t.shell.xOfY(earned.length, data.badges.length)}
              </span>
            ) : null}
          </div>
          {earned.length > 0 ? (
            <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-4">
              {data.badges.map((b) => (
                <li key={b.id} className="flex">
                  <BadgeTile id={b.id} title={b.title} description={b.description} earnedAt={b.earnedAt} isNew={b.isNew} {...(b.glyph ? { glyph: b.glyph } : {})} className="w-full" />
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-control border-2 border-dashed border-border p-8 text-center">
              <Avatar name={avatar} size={72} />
              <p className="m-0 text-h3 font-bold">{t.shell.me.noBadgesTitle}</p>
              <p className="m-0 text-body-lg text-fg-muted">{t.shell.me.noBadgesLine}</p>
              <ButtonLink href={LEARNER_ROUTES.today} iconAfter="arrow-right" className="mt-1">
                {t.shell.goToToday}
              </ButtonLink>
            </div>
          )}
        </section>

        <section aria-labelledby="me-calendar" className="flex min-w-0 flex-col gap-3 rounded-card bg-surface shadow-soft p-5 md:p-7 lg:flex-1">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 id="me-calendar" className="m-0 text-h2 font-bold">
              {data.monthLabel}
            </h2>
            <span className="text-body font-bold sm:ml-auto">{data.streakLine}</span>
          </div>
          <div aria-hidden="true" className="grid grid-cols-7 gap-1.5 text-center text-body font-semibold text-fg-muted">
            {t.shell.me.weekdays.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <ol aria-label={t.shell.me.streakCalendar(data.monthLabel)} className="m-0 grid list-none grid-cols-7 gap-1.5 p-0">
            {data.calendar.map((c) => {
              if (!c.inMonth) return <li key={c.date} aria-hidden="true" className="h-13.5" />
              const today = isToday(c)
              const glyph = c.status !== 'upcoming' && c.status !== 'none'
              const quiet = c.status === 'upcoming' || c.status === 'none' || c.status === 'rest'
              return (
                <li
                  key={c.date}
                  aria-label={`${c.day}${today ? t.shell.streak.todaySuffix : ''}, ${c.status === 'none' ? t.shell.me.noQuests : dayStatusWord(c.status, lang)}`}
                  aria-current={today ? 'date' : undefined}
                  className={cx('flex h-13.5 flex-col items-center justify-center gap-0.5 rounded-control', today && 'bg-math-50')}
                >
                  <span
                    aria-hidden="true"
                    className={cx(
                      'text-body leading-5 tabular-nums',
                      today ? 'font-extrabold underline decoration-2 underline-offset-3' : 'font-semibold',
                      quiet && !today ? 'text-fg-muted' : 'text-fg',
                    )}
                  >
                    {c.day}
                  </span>
                  {glyph ? (
                    <span aria-hidden="true">
                      <DayGlyph status={c.status} size={20} isToday={today} />
                    </span>
                  ) : null}
                </li>
              )
            })}
          </ol>
          <div aria-hidden="true" className="mt-auto flex flex-wrap gap-4 pt-2 text-body font-semibold text-fg-muted">
            <span className="inline-flex items-center gap-1.5">
              <DayGlyph status="complete" size={18} />
              {t.common.done}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <DayGlyph status="rest" size={18} />
              {t.shell.me.legendRest}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <DayGlyph status="freeze" size={18} />
              {t.shell.me.legendFreeze}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <DayGlyph status="missed" size={18} />
              {t.shell.me.legendMissed}
            </span>
          </div>
        </section>
      </div>

      <AvatarDialog
        key={openCount}
        open={picking}
        onClose={() => setPicking(false)}
        avatars={data.avatars}
        current={avatar}
        actions={actions}
        onSaved={(a) => {
          setAvatar(a)
          toast({ kind: 'success', title: t.shell.me.avatarSaved })
        }}
      />
    </LearnerFrame>
  )
}

export function MeScreen({ data, actions, myWords = false, langSwitch = false }: { data: MeDTO; actions: MeActions; myWords?: boolean; langSwitch?: boolean }): ReactElement {
  return (
    <ToastProvider area="learner">
      <MeBody data={data} actions={actions} myWords={myWords} langSwitch={langSwitch} />
    </ToastProvider>
  )
}
