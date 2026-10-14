'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type ReactElement } from 'react'
import type { QuizActions, QuizHubDTO, QuizTopicCard, QuizTopicDTO } from '@/lib/dto-arena'
import { Button } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { LearnerFrame } from '@/components/learner/LearnerHeader'
import { ArenaPic } from '@/components/learner/arena/ArenaPic'
import { XpTrackBars } from '@/components/learner/arena/XpTrackBars'
import { ActionError } from '@/screens/learner/common'

/** Quiz Arena: dua belas topik dengan kemajuan, kuis campuran, dan halaman topik dengan tiga mode. */

function ProgressBar({ known, total, label }: { known: number; total: number; label: string }): ReactElement {
  const pct = total > 0 ? Math.round((known / total) * 100) : 0
  return (
    <div className="flex flex-col gap-1">
      <span role="img" aria-label={`${label}: ${known} of ${total} known`} className="flex h-2.5 overflow-hidden rounded-control bg-divider">
        <span className="bg-knowledge" style={{ width: `${pct}%` }} />
      </span>
      <span className="text-body text-fg-muted tabular-nums">
        {known} of {total} known
      </span>
    </div>
  )
}

function useStart(actions: Pick<QuizActions, 'start'>) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<{ message: string; reference: string } | null>(null)
  const start = async (key: string, topic: Parameters<QuizActions['start']>[0]['topic'], mode: Parameters<QuizActions['start']>[0]['mode'], variant?: 'map') => {
    setBusy(key)
    setError(null)
    try {
      const res = await actions.start({ topic, mode, ...(variant ? { variant } : {}) })
      if (res.ok) router.push(res.data.redirectTo)
      else setError({ message: res.message, reference: res.reference })
    } catch {
      setError({ message: 'The round could not start. Check the internet and try again.', reference: 'KRA-QZ-NET' })
    } finally {
      setBusy(null)
    }
  }
  return { busy, error, start }
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
            <span className="text-h3 font-bold">{t.title}</span>
            <span className="text-body text-fg-muted">{t.blurb}</span>
          </span>
        </div>
        <ProgressBar known={t.known} total={t.total} label={t.title} />
      </Link>
    </li>
  )
}

export function QuizHubScreen({ data, actions }: { data: QuizHubDTO; actions: Pick<QuizActions, 'start'> }): ReactElement {
  const { busy, error, start } = useStart(actions)
  return (
    <LearnerFrame shell={data.shell} current="quiz-arena" className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <UiIcon name="globe" size={36} className="text-knowledge" />
          <h1 className="m-0 text-h1 font-bold">Quiz Arena</h1>
        </div>
        <p className="m-0 max-w-[640px] text-body-lg text-fg-muted">Flags, capitals, animals, space and more. Every quiz is new, and you earn blue XP.</p>
        <XpTrackBars tracks={data.tracks} only="pengetahuan" className="max-w-[460px]" />
      </header>
      {data.limitReached ? (
        <p role="status" className="m-0 rounded-card border-2 border-fg bg-surface p-4 text-body-lg font-bold">
          Time for a break. You have used your minutes for today.
        </p>
      ) : null}
      {data.xpNote ? (
        <p role="note" className="m-0 text-body text-fg-muted">
          {data.xpNote}
        </p>
      ) : null}
      {error ? <ActionError message={error.message} reference={error.reference} /> : null}

      <section aria-label="Mixed quiz" className="flex flex-wrap items-center gap-3 rounded-card border border-divider bg-surface p-5">
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="m-0 text-h2 font-bold">Surprise me</h2>
          <p className="m-0 text-body text-fg-muted">Questions from every topic, all mixed up.{data.speedBest > 0 ? ` Your best speed quiz: ${data.speedBest} right.` : ''}</p>
        </div>
        <Button variant="secondary" loading={busy === 'mix-quiz'} disabled={data.limitReached} onClick={() => void start('mix-quiz', 'mix', 'quiz')}>
          Mixed quiz
        </Button>
        <Button variant="secondary" loading={busy === 'mix-speed'} disabled={data.limitReached} onClick={() => void start('mix-speed', 'mix', 'speed')}>
          Mixed speed quiz
        </Button>
      </section>

      <section aria-labelledby="topics-h" className="flex flex-col gap-3">
        <h2 id="topics-h" className="m-0 text-h2 font-bold">
          Topics
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
  const { busy, error, start } = useStart(actions)
  const t = data.topic
  const off = data.limitReached
  const modes = [
    { mode: 'learn' as const, title: 'Learn', blurb: 'Flip through flashcards and see the answers. Earn a little XP.', cta: 'Start flashcards' },
    { mode: 'quiz' as const, title: 'Quiz', blurb: '10 questions with no timer. You see why after each one.', cta: 'Start quiz' },
    { mode: 'speed' as const, title: 'Speed quiz', blurb: 'As many right as you can in 60 seconds.', cta: 'Start speed quiz' },
    ...(t.id === 'continents' ? [{ mode: 'quiz' as const, variant: 'map' as const, title: 'Point on the map', blurb: 'Tap the right continent or ocean on a world map. 10 questions, no timer.', cta: 'Start map quiz' }] : []),
  ]
  return (
    <LearnerFrame shell={data.shell} current="quiz-arena" className="flex flex-col gap-5">
      <nav aria-label="Breadcrumb">
        <Link href="/quiz-arena" className="inline-flex min-h-11 items-center gap-1 text-body-lg font-bold text-fg">
          <UiIcon name="arrow-left" size={20} /> Quiz Arena
        </Link>
      </nav>
      <header className="flex flex-wrap items-center gap-4">
        <span className="flex h-24 w-28 flex-none items-center justify-center rounded-card bg-knowledge-50">
          <ArenaPic pic={t.pic} size={t.pic.t === 'flag' ? 64 : 72} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="m-0 text-h1 font-bold">{t.title}</h1>
          <p className="m-0 text-body-lg text-fg-muted">{t.blurb}</p>
          <div className="max-w-[420px]">
            <ProgressBar known={t.known} total={t.total} label={t.title} />
          </div>
          {data.tiers.gated && data.tiers.open < 3 ? <p className="m-0 text-body text-fg-muted">New questions appear as you learn these. Know most of them to bring in harder ones.</p> : null}
        </div>
      </header>
      {off ? (
        <p role="status" className="m-0 rounded-card border-2 border-fg bg-surface p-4 text-body-lg font-bold">
          Time for a break. You have used your minutes for today.
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
