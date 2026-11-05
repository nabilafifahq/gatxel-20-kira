'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type ReactElement } from 'react'
import type { QuizActions, QuizHubDTO, QuizTopicCard, QuizTopicDTO } from '@/lib/dto-arena'
import { Button } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { CountdownOverlay } from '@/components/learner/CountdownOverlay'
import { LearnerFrame } from '@/components/learner/LearnerHeader'
import { ArenaPic } from '@/components/learner/arena/ArenaPic'
import { XpTrackBars } from '@/components/learner/arena/XpTrackBars'
import { ActionError } from '@/screens/learner/common'
import { useT } from '@/lib/i18n/client'

/** Quiz Arena: dua belas topik dengan kemajuan, kuis campuran, dan halaman topik dengan tiga mode. */

function ProgressBar({ known, total, label }: { known: number; total: number; label: string }): ReactElement {
  const t = useT().arena.quiz
  const pct = total > 0 ? Math.round((known / total) * 100) : 0
  return (
    <div className="flex flex-col gap-1">
      <span role="img" aria-label={t.progressAria(label, known, total)} className="flex h-2.5 overflow-hidden rounded-control bg-divider">
        <span className="bg-knowledge" style={{ width: `${pct}%` }} />
      </span>
      <span className="text-body text-fg-muted tabular-nums">
        {t.progress(known, total)}
      </span>
    </div>
  )
}

function useStart(actions: Pick<QuizActions, 'start'>) {
  const dict = useT().arena
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<{ message: string; reference: string } | null>(null)
  type Topic = Parameters<QuizActions['start']>[0]['topic']
  type Mode = Parameters<QuizActions['start']>[0]['mode']
  // Speed quiz berwaktu: hitung mundur 3, 2, 1, Go dulu; ronde dibuat saat Go muncul.
  const [counting, setCounting] = useState<{ key: string; topic: Topic; mode: Mode } | null>(null)
  const start = (key: string, topic: Topic, mode: Mode, variant?: 'map') => {
    if (mode === 'speed') {
      setBusy(key)
      setCounting({ key, topic, mode })
      return Promise.resolve()
    }
    return launch(key, topic, mode, variant)
  }
  const overlay = counting ? <CountdownOverlay onGo={() => void launch(counting.key, counting.topic, counting.mode)} onDone={() => setCounting(null)} /> : null
  const launch = async (key: string, topic: Topic, mode: Mode, variant?: 'map') => {
    setBusy(key)
    setError(null)
    try {
      const res = await actions.start({ topic, mode, ...(variant ? { variant } : {}) })
      if (res.ok) router.push(res.data.redirectTo)
      else setError({ message: res.message, reference: res.reference })
    } catch {
      setError({ message: dict.errors.roundNet, reference: 'KRA-QZ-NET' })
    } finally {
      setBusy(null)
    }
  }
  return { busy, error, start, overlay }
}

function TopicTile({ t }: { t: QuizTopicCard }): ReactElement {
  return (
    <li>
      <Link
        href={`/quiz-arena/${t.id}`}
        className="flex h-full min-h-44 flex-col gap-3 rounded-card border-2 border-border bg-surface p-4 text-fg no-underline transition-transform duration-150 ease-kira hover:border-fg active:scale-98"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-16 w-20 flex-none items-center justify-center rounded-control bg-knowledge-50">
            <ArenaPic pic={t.pic} size={t.pic.t === 'flag' ? 44 : 52} />
          </span>
          <span className="flex min-w-0 flex-col">
            <span lang="en-GB" className="text-h3 font-bold">{t.title}</span>
            <span lang="en-GB" className="text-body text-fg-muted">{t.blurb}</span>
          </span>
        </div>
        <ProgressBar known={t.known} total={t.total} label={t.title} />
      </Link>
    </li>
  )
}

export function QuizHubScreen({ data, actions }: { data: QuizHubDTO; actions: Pick<QuizActions, 'start'> }): ReactElement {
  const { busy, error, start, overlay } = useStart(actions)
  const dict = useT().arena
  const t = dict.quiz
  return (
    <LearnerFrame shell={data.shell} current="quiz-arena" className="flex flex-col gap-5">
      {overlay}
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <UiIcon name="globe" size={36} className="text-fg" />
          <h1 className="m-0 text-h1 font-bold">{t.title}</h1>
        </div>
        <p className="m-0 max-w-[640px] text-body-lg text-fg-muted">{t.hub.intro}</p>
        <XpTrackBars tracks={data.tracks} only="pengetahuan" className="max-w-[460px]" />
      </header>
      {data.limitReached ? (
        <p role="status" className="m-0 rounded-card border-2 border-fg bg-surface p-4 text-body-lg font-bold">
          {dict.breakTime}
        </p>
      ) : null}
      {data.xpNote ? (
        <p role="note" className="m-0 text-body text-fg-muted">
          {data.xpNote}
        </p>
      ) : null}
      {error ? <ActionError message={error.message} reference={error.reference} /> : null}

      <section aria-label={t.mixedTitle} className="flex flex-wrap items-center gap-3 rounded-card bg-surface shadow-soft p-5">
        <div className="flex min-w-0 grow basis-52 flex-col">
          <h2 className="m-0 text-h2 font-bold">{t.hub.surprise}</h2>
          <p className="m-0 text-body text-fg-muted">{t.hub.surpriseBlurb}{data.speedBest > 0 ? t.hub.speedBest(data.speedBest) : ''}</p>
        </div>
        <Button variant="secondary" loading={busy === 'mix-quiz'} disabled={data.limitReached} onClick={() => void start('mix-quiz', 'mix', 'quiz')}>
          {t.hub.mixedQuiz}
        </Button>
        <Button variant="secondary" loading={busy === 'mix-speed'} disabled={data.limitReached} onClick={() => void start('mix-speed', 'mix', 'speed')}>
          {t.hub.mixedSpeed}
        </Button>
      </section>

      <section aria-labelledby="topics-h" className="flex flex-col gap-3">
        <h2 id="topics-h" className="m-0 text-h2 font-bold">
          {t.hub.topics}
        </h2>
        <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
          {data.topics.map((t) => (
            <TopicTile key={t.id} t={t} />
          ))}
        </ul>
      </section>
    </LearnerFrame>
  )
}

export function QuizTopicScreen({ data, actions }: { data: QuizTopicDTO; actions: Pick<QuizActions, 'start'> }): ReactElement {
  const { busy, error, start, overlay } = useStart(actions)
  const dict = useT().arena
  const copy = dict.quiz.topic
  const t = data.topic
  const off = data.limitReached
  const modes = [
    { mode: 'learn' as const, title: copy.learn, blurb: copy.learnBlurb, cta: copy.learnCta },
    { mode: 'quiz' as const, title: copy.quiz, blurb: copy.quizBlurb, cta: copy.quizCta },
    { mode: 'speed' as const, title: copy.speed, blurb: copy.speedBlurb, cta: copy.speedCta },
    ...(t.id === 'continents' ? [{ mode: 'quiz' as const, variant: 'map' as const, title: copy.map, blurb: copy.mapBlurb, cta: copy.mapCta }] : []),
  ]
  return (
    <LearnerFrame shell={data.shell} current="quiz-arena" className="flex flex-col gap-5">
      {overlay}
      <nav aria-label={dict.breadcrumb}>
        <Link href="/quiz-arena" className="inline-flex min-h-11 items-center gap-1 text-body-lg font-bold text-fg">
          <UiIcon name="arrow-left" size={20} /> {dict.quiz.title}
        </Link>
      </nav>
      <header className="flex flex-wrap items-center gap-4">
        <span className="flex h-24 w-28 flex-none items-center justify-center rounded-card bg-knowledge-50">
          <ArenaPic pic={t.pic} size={t.pic.t === 'flag' ? 64 : 72} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 lang="en-GB" className="m-0 text-h1 font-bold">{t.title}</h1>
          <p lang="en-GB" className="m-0 text-body-lg text-fg-muted">{t.blurb}</p>
          <div className="max-w-[420px]">
            <ProgressBar known={t.known} total={t.total} label={t.title} />
          </div>
          {data.tiers.gated && data.tiers.open < 3 ? <p className="m-0 text-body text-fg-muted">{copy.tiers}</p> : null}
        </div>
      </header>
      {off ? (
        <p role="status" className="m-0 rounded-card border-2 border-fg bg-surface p-4 text-body-lg font-bold">
          {dict.breakTime}
        </p>
      ) : null}
      {data.xpNote ? (
        <p role="note" className="m-0 text-body text-fg-muted">
          {data.xpNote}
        </p>
      ) : null}
      {error ? <ActionError message={error.message} reference={error.reference} /> : null}
      <ul className={cx('m-0 grid list-none gap-3 p-0', modes.length > 3 ? 'md:grid-cols-2' : 'md:grid-cols-3')}>
        {modes.map((m) => (
          <li key={'variant' in m ? 'map' : m.mode} className={cx('flex flex-col gap-3 rounded-card border-2 border-border bg-surface p-5')}>
            <h2 className="m-0 text-h2 font-bold">{m.title}</h2>
            <p className="m-0 flex-1 text-body-lg text-fg-muted">{m.blurb}</p>
            <Button loading={busy === ('variant' in m ? 'map' : m.mode)} disabled={off} onClick={() => void start('variant' in m ? 'map' : m.mode, t.id, m.mode, 'variant' in m ? m.variant : undefined)}>
              {m.cta}
            </Button>
          </li>
        ))}
      </ul>
    </LearnerFrame>
  )
}
