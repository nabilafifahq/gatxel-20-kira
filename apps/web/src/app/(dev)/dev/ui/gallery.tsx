'use client'

// __GTX_SEED__ galeri komponen learner dengan data contoh.

import Link from 'next/link'
import { useState, type ReactElement, type ReactNode } from 'react'
import type { SolutionStep } from '@kira/content/schema'
import type { FigureSpec } from '@kira/figures'
import type { DayStatus, QuestStopDTO, RunnerItem, SegmentState, StreakDTO, Subject } from '@/lib/dto'
import { Button, ButtonLink, IconButton } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { UI_ICON_NAMES, UiIcon } from '@/components/ui/icons'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { AnswerTile, type AnswerTileState } from '@/components/learner/AnswerTile'
import { BadgeMedal, BadgeTile } from '@/components/learner/BadgeTile'
import { FeedbackSheet, type FeedbackKind } from '@/components/learner/FeedbackSheet'
import { FigureFrame } from '@/components/learner/FigureFrame'
import { HintButton, HintList, HintStack } from '@/components/learner/HintStack'
import { NumericKeypad } from '@/components/learner/NumericKeypad'
import { OfflineBanner } from '@/components/learner/OfflineBanner'
import { ProgressSegments } from '@/components/learner/ProgressSegments'
import { QuestStamp, QuestStopBig, QuestStopRow } from '@/components/learner/QuestStop'
import { ReadAloudButton } from '@/components/learner/ReadAloudButton'
import { SolutionPlayer } from '@/components/learner/SolutionPlayer'
import { DayGlyph, FreezePill, StreakChain, StreakCount } from '@/components/learner/StreakChain'
import { SubjectChip } from '@/components/learner/SubjectChip'
import { SubjectIcon } from '@/components/learner/SubjectIcon'
import { Timer } from '@/components/learner/Timer'
import { XpPill } from '@/components/learner/XpPill'
import { QuestionView } from '@/components/widgets/QuestionView'
import { Widget } from '@/components/widgets/Widget'
import type { WidgetFeedback } from '@/components/widgets/types'

const SUBJECTS: Subject[] = ['math', 'english', 'science']

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }): ReactElement {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex flex-col gap-4 border-t border-divider pt-8">
      <h2 id={`${id}-title`} className="m-0 text-h2 font-bold">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-body font-semibold text-fg-muted">{label}</span>
      <div className="flex flex-wrap items-center gap-4">{children}</div>
    </div>
  )
}

function stop(p: Partial<QuestStopDTO> & Pick<QuestStopDTO, 'subject' | 'state'>): QuestStopDTO {
  return {
    questId: `seed-${p.subject}-${p.state}`,
    session: 'latihan',
    sessionLabel: 'Practice',
    required: true,
    timed: false,
    best: null,
    title: 'Arrays and skip counting',
    meta: '10 questions, about 15 minutes',
    total: 10,
    answered: p.state === 'in-progress' ? 3 : p.state === 'done' ? 10 : 0,
    segments: [],
    href: p.state === 'locked' || p.state === 'rest' ? null : '#',
    ctaLabel: p.state === 'in-progress' ? 'Continue' : 'Start',
    offlineReady: false,
    ...p,
  }
}

const SEGMENTS: SegmentState[] = ['correct', 'correct', 'not-yet', 'answered', 'current', 'todo', 'todo', 'todo', 'todo', 'todo']
const TILE_STATES: AnswerTileState[] = ['default', 'selected', 'correct', 'not-yet', 'dimmed', 'disabled']
const DAY_STATUSES: DayStatus[] = ['complete', 'partial', 'rest', 'freeze', 'missed', 'today', 'upcoming']
const SHEETS: FeedbackKind[] = ['correct', 'not-yet', 'revealed', 'sent', 'saved']

function ToastButtons(): ReactElement {
  const toast = useToast()
  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="secondary" size="M" onClick={() => toast({ kind: 'success', title: 'Avatar saved' })}>
        Success toast
      </Button>
      <Button variant="secondary" size="M" onClick={() => toast({ kind: 'info', title: 'Saved on this tablet', body: 'It will sync when you are back online.' })}>
        Info toast
      </Button>
      <Button
        variant="secondary"
        size="M"
        onClick={() => toast({ kind: 'error', title: 'Your report was not sent', body: 'Check the internet and try again.', reference: 'DEV-0001' })}
      >
        Error toast
      </Button>
    </div>
  )
}

function WidgetCard({ item, n }: { item: RunnerItem; n: number }): ReactElement {
  const [value, setValue] = useState<unknown | null>(null)
  const [feedback, setFeedback] = useState<WidgetFeedback>(null)
  const subject: Subject = item.skill.startsWith('e') ? 'english' : item.skill.startsWith('s') ? 'science' : 'math'
  return (
    <article className="flex flex-col gap-4 rounded-card border border-divider bg-surface p-5" aria-label={`Widget ${item.type}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-8 items-center rounded-pill bg-fg px-3 text-body font-bold text-white">{item.type}</span>
        <span className="text-body text-fg-muted">{item.ref}</span>
        <span className="ml-auto flex gap-2">
          <Button size="S" variant={feedback === 'correct' ? 'primary' : 'secondary'} onClick={() => setFeedback(feedback === 'correct' ? null : 'correct')}>
            Correct
          </Button>
          <Button size="S" variant={feedback === 'not-yet' ? 'primary' : 'secondary'} onClick={() => setFeedback(feedback === 'not-yet' ? null : 'not-yet')}>
            Not yet
          </Button>
          <Button size="S" variant="quiet" onClick={() => setValue(null)}>
            Reset
          </Button>
        </span>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <QuestionView item={item} number={n} subject={subject} answer={{ value, onChange: setValue, disabled: feedback !== null, feedback }} />
        <Widget
          item={item}
          value={value}
          onChange={setValue}
          disabled={feedback !== null}
          feedback={feedback}
          subject={subject}
          onUpload={() => new Promise((resolve) => window.setTimeout(() => resolve({ mediaId: 'dev-media-0001' }), 600))}
          onSkip={() => setValue(null)}
        />
      </div>
      <pre className="m-0 overflow-x-auto rounded-control bg-bg p-3 text-small">{JSON.stringify(value)}</pre>
    </article>
  )
}

export function Gallery({
  items,
  streak,
  solution,
  solutionFigure,
}: {
  items: RunnerItem[]
  streak: StreakDTO
  solution: SolutionStep[]
  solutionFigure: FigureSpec | null
}): ReactElement {
  const [dialog, setDialog] = useState<'none' | 'learner' | 'alert'>('none')
  const [hints, setHints] = useState(1)
  const [keypad, setKeypad] = useState('12')
  const figure = items.find((i) => i.figure)?.figure ?? null
  return (
    <ToastProvider area="learner">
      <div data-jenjang="1-2" className="min-h-svh bg-bg text-fg">
        <main className="mx-auto flex max-w-[1180px] flex-col gap-8 px-4 py-8 md:px-8">
          <header className="flex flex-col gap-2">
            <h1 className="m-0 text-h1 font-bold">Komponen learner</h1>
            <p className="m-0 text-body text-fg-muted">
              Semua komponen dengan state-nya. Layar lengkap ada di <Link href="/dev/screens">/dev/screens</Link>.
            </p>
            <nav aria-label="Bagian" className="flex flex-wrap gap-x-4 gap-y-1 text-body">
              {['tombol', 'ikon', 'dialog', 'mapel', 'streak', 'quest', 'progres', 'jawaban', 'umpan-balik', 'timer', 'figur', 'lencana', 'sinkron', 'widget'].map((s) => (
                <a key={s} href={`#${s}`}>
                  {s}
                </a>
              ))}
            </nav>
          </header>

          <Section id="tombol" title="Button">
            {(['primary', 'secondary', 'quiet', 'danger'] as const).map((v) => (
              <Row key={v} label={v}>
                <Button variant={v}>Check</Button>
                <Button variant={v} size="M">
                  Simpan rencana
                </Button>
                <Button variant={v} size="S">
                  Small
                </Button>
                <Button variant={v} iconAfter="arrow-right">
                  Next
                </Button>
                <Button variant={v} disabled>
                  Disabled
                </Button>
                <Button variant={v} loading>
                  Saving
                </Button>
              </Row>
            ))}
            <Row label="IconButton dan ButtonLink">
              <IconButton icon="close" label="Close" />
              <IconButton icon="play" label="Play" variant="primary" />
              <IconButton icon="hint" label="Hint" disabled />
              <IconButton icon="refresh" label="Loading" loading />
              <ButtonLink href="#tombol" iconAfter="arrow-right">
                Go to Today
              </ButtonLink>
            </Row>
          </Section>

          <Section id="ikon" title="Icons">
            <ul className="m-0 grid list-none grid-cols-4 gap-3 p-0 sm:grid-cols-8 lg:grid-cols-10">
              {UI_ICON_NAMES.map((n) => (
                <li key={n} className="flex flex-col items-center gap-1 rounded-control border border-divider bg-surface p-2 text-center">
                  <UiIcon name={n} size={24} />
                  <span className="text-small break-all text-fg-muted">{n}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section id="dialog" title="Dialog, Toast, EmptyState">
            <Row label="Dialog">
              <Button variant="secondary" onClick={() => setDialog('learner')}>
                Open dialog
              </Button>
              <Button variant="secondary" onClick={() => setDialog('alert')}>
                Open alert dialog
              </Button>
            </Row>
            <Row label="Toast">
              <ToastButtons />
            </Row>
            <div className="grid gap-4 md:grid-cols-2">
              <EmptyState
                title="No review cards today."
                body="Your next cards come back on Thursday."
                actions={
                  <ButtonLink href="#dialog" iconAfter="arrow-right">
                    Back to Today
                  </ButtonLink>
                }
              />
              <EmptyState tone="console" title="Tidak ada soal yang cocok" body="Coba hapus salah satu filter." filters={['Math', 'Grade 2', 'Arrays']} />
            </div>
            <Dialog
              open={dialog === 'learner'}
              onClose={() => setDialog('none')}
              title="Leave this quest?"
              description="Your answers are saved. You can carry on later from question 4."
              footer={
                <>
                  <Button variant="secondary" onClick={() => setDialog('none')} data-autofocus>
                    Stay
                  </Button>
                  <Button onClick={() => setDialog('none')}>Leave</Button>
                </>
              }
            />
            <Dialog
              open={dialog === 'alert'}
              onClose={() => setDialog('none')}
              role="alertdialog"
              dismissible={false}
              align="center"
              title="Time's up"
              description="Your answers are being handed in."
              footer={<Button onClick={() => setDialog('none')}>See my score</Button>}
            />
          </Section>

          <Section id="mapel" title="SubjectChip, SubjectIcon, XpPill">
            {(['L', 'M', 'S', 'XS'] as const).map((size) => (
              <Row key={size} label={`Chip ${size}`}>
                {[...SUBJECTS, 'bonus' as const].map((s) => (
                  <SubjectChip key={s} subject={s} size={size} />
                ))}
              </Row>
            ))}
            <Row label="Icon (tint, white)">
              {SUBJECTS.map((s) => (
                <SubjectIcon key={s} subject={s} size={48} />
              ))}
              {SUBJECTS.map((s) => (
                <span key={s} className={s === 'math' ? 'rounded-control bg-math p-1' : s === 'english' ? 'rounded-control bg-english p-1' : 'rounded-control bg-science p-1'}>
                  <SubjectIcon subject={s} size={40} tone="white" />
                </span>
              ))}
            </Row>
            <Row label="XpPill">
              <XpPill xp={8} />
              <XpPill xp={95} size="L" />
            </Row>
          </Section>

          <Section id="streak" title="Streak">
            <Row label="StreakChain L, M, S">
              <StreakChain streak={streak} size="L" />
            </Row>
            <Row label="M">
              <StreakChain streak={streak} size="M" />
            </Row>
            <Row label="S (HP)">
              <div className="w-[358px] max-w-full">
                <StreakChain streak={streak} size="S" />
              </div>
            </Row>
            <Row label="StreakCount, FreezePill, DayGlyph">
              <StreakCount current={12} />
              <StreakCount current={0} />
              <StreakCount current={12} layout="inline" />
              <FreezePill count={1} />
              <FreezePill count={2} saved />
              {DAY_STATUSES.map((d) => (
                <span key={d} className="flex flex-col items-center gap-1 text-small">
                  <DayGlyph status={d} />
                  {d}
                </span>
              ))}
            </Row>
          </Section>

          <Section id="quest" title="QuestStop">
            <Row label="QuestStamp L dan S">
              {(['ready', 'in-progress', 'done', 'locked', 'rest'] as const).map((st) => (
                <QuestStamp key={st} stop={stop({ subject: 'math', state: st })} />
              ))}
              {(['ready', 'in-progress', 'done', 'locked', 'rest'] as const).map((st) => (
                <QuestStamp key={`s-${st}`} stop={stop({ subject: 'english', state: st })} size="S" />
              ))}
              <QuestStamp stop={stop({ subject: 'bonus', state: 'done' })} />
            </Row>
            <div className="flex flex-col gap-4">
              <QuestStopBig stop={stop({ subject: 'math', state: 'in-progress', meta: '3 of 10 done, about 10 minutes left', offlineReady: true })} />
              <QuestStopRow stop={stop({ subject: 'english', state: 'ready', title: 'Past tense with -ed' })} />
              <QuestStopRow stop={stop({ subject: 'science', state: 'done', title: 'Living things', meta: 'Done, 8 of 10 correct' })} />
              <QuestStopRow stop={stop({ subject: 'bonus', state: 'locked', title: 'Mixed review', meta: 'Opens after all three' })} size="S" />
            </div>
          </Section>

          <Section id="progres" title="ProgressSegments">
            {SUBJECTS.map((s) => (
              <ProgressSegments key={s} segments={SEGMENTS} subject={s} label={`${s} progress`} />
            ))}
            <div className="w-[358px] max-w-full">
              <ProgressSegments segments={SEGMENTS} subject="math" label="Small" size="S" />
            </div>
          </Section>

          <Section id="jawaban" title="AnswerTile, NumericKeypad">
            {SUBJECTS.map((s) => (
              <div key={s} className="grid grid-cols-2 gap-x-4 gap-y-5 pt-3 md:grid-cols-3">
                {TILE_STATES.map((st, i) => (
                  <AnswerTile key={st} subject={s} state={st} letter={String.fromCharCode(65 + i)} disabled={st === 'disabled'}>
                    <span className="text-question block">{st}</span>
                  </AnswerTile>
                ))}
              </div>
            ))}
            <div className="grid gap-6 md:grid-cols-3">
              <NumericKeypad value={keypad} onChange={setKeypad} subject="math" label="Your answer" showLabel />
              <NumericKeypad value="7" onChange={() => undefined} subject="english" feedback="correct" disabled label="Correct" showLabel />
              <NumericKeypad value="5" onChange={() => undefined} subject="science" feedback="not-yet" disabled label="Not yet" showLabel size="M" />
            </div>
          </Section>

          <Section id="umpan-balik" title="FeedbackSheet, HintStack, ReadAloudButton">
            <div className="grid gap-4 md:grid-cols-2">
              {SHEETS.map((k) => (
                <FeedbackSheet
                  key={k}
                  kind={k}
                  subject="math"
                  xp={k === 'correct' ? 8 : 0}
                  hintsUsed={k === 'correct' ? 1 : 0}
                  explanation="3 rows of 2 make 6."
                  answerText="6"
                  solution={solution.length > 0 ? solution : null}
                  onShowHint={k === 'not-yet' ? () => undefined : undefined}
                  showHintLabel="Show hint 1"
                  savedLine={k === 'saved' ? 'Saved on this tablet. It will sync when you are back online.' : null}
                  primary={k === 'not-yet' ? { label: 'Try again', onClick: () => undefined } : { label: 'Next', onClick: () => undefined, icon: 'arrow-right' }}
                />
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <HintStack hints={['Count the dots in one row.', 'Count in 2s for each row.', '2, 4, ...']} opened={hints} onOpenNext={() => setHints((h) => Math.min(3, h + 1))} />
              <div className="flex flex-col gap-3">
                <Row label="HintButton">
                  <HintButton total={3} opened={hints} onOpen={() => setHints((h) => Math.min(3, h + 1))} />
                  <HintButton total={3} opened={3} onOpen={() => undefined} compact />
                </Row>
                <HintList hints={['Count the dots in one row.', 'Count in 2s for each row.']} opened={2} />
                <Row label="ReadAloudButton">
                  <ReadAloudButton text="How many dots are there?" subject="math" />
                  <ReadAloudButton text="Berapa banyak titik?" lang="id" subject="math" compact />
                </Row>
              </div>
            </div>
          </Section>

          <Section id="timer" title="Timer">
            <Row label="countdown, 1 minute left, time up, stopwatch">
              <Timer mode="countdown" seconds={512} />
              <Timer mode="countdown" seconds={48} />
              <Timer mode="countdown" seconds={0} />
              <Timer mode="stopwatch" seconds={754} />
              <Timer mode="countdown" seconds={8} warnAt={10} compact />
            </Row>
          </Section>

          <Section id="figur" title="FigureFrame, SolutionPlayer">
            <div className="grid gap-6 md:grid-cols-2">
              {figure ? <FigureFrame spec={figure} paper /> : <p className="m-0 text-body">No figure in the fixture.</p>}
              {solution.length > 0 ? (
                <SolutionPlayer steps={solution} subject="math" figure={solutionFigure ?? undefined} />
              ) : (
                <SolutionPlayer steps={[]} subject="math" />
              )}
            </div>
            <div className="max-w-[420px]">
              <span className="text-body font-semibold text-fg-muted">Reduced motion</span>
              <SolutionPlayer steps={solution} subject="english" reduced />
            </div>
          </Section>

          <Section id="lencana" title="BadgeTile, BadgeMedal">
            <ul className="m-0 grid max-w-[560px] list-none grid-cols-2 gap-3 p-0 sm:grid-cols-4">
              <li className="flex">
                <BadgeTile id="streak-7" title="7-day streak" description="Learn 7 days in a row" earnedAt="2026-10-09" className="w-full" />
              </li>
              <li className="flex">
                <BadgeTile id="first-olympiad-paper" title="First olympiad paper" description="Finish a whole paper" earnedAt="2026-10-11" isNew className="w-full" />
              </li>
              <li className="flex">
                <BadgeTile id="clock-master" title="Clock master" description="3 stars on all Time skills" earnedAt={null} className="w-full" />
              </li>
              <li className="flex items-center justify-center">
                <BadgeMedal id="perfect-paper" title="Perfect paper" />
              </li>
            </ul>
          </Section>

          <Section id="sinkron" title="OfflineBanner">
            <Row label="pill">
              <OfflineBanner state="offline" />
              <OfflineBanner state="pending" pendingCount={3} />
              <OfflineBanner state="synced" />
            </Row>
            <div className="flex max-w-[480px] flex-col gap-3">
              <OfflineBanner state="offline" variant="banner" />
              <OfflineBanner state="pending" pendingCount={1} variant="banner" />
              <OfflineBanner state="synced" variant="banner" />
            </div>
          </Section>

          <Section id="widget" title="Widgets">
            <p className="m-0 text-body text-fg-muted">Setiap tipe soal dengan nilai yang tersimpan di bawahnya. Tombol Correct dan Not yet menampilkan state umpan balik.</p>
            {items.map((item, i) => (
              <WidgetCard key={item.ref} item={item} n={i + 1} />
            ))}
          </Section>
        </main>
      </div>
    </ToastProvider>
  )
}
