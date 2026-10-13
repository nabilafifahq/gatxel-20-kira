'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type ReactElement, type ReactNode } from 'react'
import type { QmMode } from '@kira/core'
import type { QmActions, QmHubDTO, QmStartInput, QmStatsDTO } from '@/lib/dto-arena'
import { Button } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { LearnerFrame } from '@/components/learner/LearnerHeader'
import { XpTrackBars } from '@/components/learner/arena/XpTrackBars'
import { ActionError } from '@/screens/learner/common'

/**
 * Quick Maths: misi harian, permainan (Practice, Sprint, Target, Times tables, Flash Anzan, Soroban),
 * pengaturan, pelajaran strategi, dan statistik. Soal dibuat dan diperiksa di server.
 */

type Settings = { auto: boolean; op: QmStartInput['op']; digits: QmStartInput['digits']; carry: boolean; table: number; division: boolean; stage: QmStartInput['sorobanStage'] }

const DEFAULTS: Settings = { auto: true, op: 'mixed', digits: 'mixed', carry: true, table: 2, division: false, stage: 'read' }
const STORAGE_KEY = 'kira.quickmaths.settings'

const OPS: { id: Settings['op']; label: string; sym: string }[] = [
  { id: 'add', label: 'Add', sym: '+' },
  { id: 'sub', label: 'Take away', sym: '−' },
  { id: 'mul', label: 'Times', sym: '×' },
  { id: 'div', label: 'Share', sym: '÷' },
  { id: 'mixed', label: 'Mixed', sym: '+ − × ÷' },
]

function Chips<T extends string | number>({ label, value, options, onChange, disabled }: { label: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; disabled?: boolean }): ReactElement {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.id === value
        return (
          <button
            key={String(o.id)}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(o.id)}
            className={cx(
              'min-h-11 min-w-11 cursor-pointer rounded-control border-2 px-4 text-body font-bold',
              on ? 'border-3 border-mental bg-mental-50 text-mental' : 'border-border bg-surface text-fg hover:border-fg',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function Card({ title, id, children, className }: { title: string; id?: string; children: ReactNode; className?: string }): ReactElement {
  return (
    <section id={id} aria-labelledby={id ? `${id}-h` : undefined} aria-label={id ? undefined : title} className={cx('flex min-w-0 scroll-mt-6 flex-col gap-3 rounded-card border border-divider bg-surface p-5 md:p-6', className)}>
      <h2 id={id ? `${id}-h` : undefined} className="m-0 text-h2 font-bold">
        {title}
      </h2>
      {children}
    </section>
  )
}

function WeekChart({ week }: { week: QmStatsDTO['week'] }): ReactElement {
  const max = Math.max(1, ...week.map((d) => d.correct))
  return (
    <ul aria-label="Right answers in the last 7 days" className="m-0 flex h-36 list-none items-end gap-2 p-0">
      {week.map((d) => (
        <li key={d.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" aria-label={`${d.label}: ${d.correct} right in ${d.rounds} ${d.rounds === 1 ? 'round' : 'rounds'}${d.ppm > 0 ? `, ${d.ppm} a minute` : ''}`}>
          <span aria-hidden="true" className="text-body font-bold tabular-nums">
            {d.correct > 0 ? d.correct : ''}
          </span>
          <span aria-hidden="true" className={cx('w-full rounded-t-control', d.correct > 0 ? 'bg-mental' : 'bg-divider')} style={{ height: `${d.correct > 0 ? Math.max(6, Math.round((d.correct / max) * 80)) : 4}px` }} />
          <span aria-hidden="true" className="text-body text-fg-muted">
            {d.label}
          </span>
        </li>
      ))}
    </ul>
  )
}

function StatsCard({ stats }: { stats: QmStatsDTO }): ReactElement {
  if (stats.rounds === 0) {
    return (
      <Card title="My Quick Maths">
        <p className="m-0 text-body-lg text-fg-muted">Finish a round to see how many a minute you can do, your best scores and which facts to practise.</p>
      </Card>
    )
  }
  return (
    <Card title="My Quick Maths" id="stats">
      <dl className="m-0 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Rounds', String(stats.rounds)],
          ['Right a minute', stats.ppm === null ? '-' : String(stats.ppm)],
          ['Accuracy', stats.accuracy === null ? '-' : `${stats.accuracy}%`],
          ['Best sprint', stats.bestSprintPpm === null ? '-' : `${stats.bestSprintPpm} a minute`],
        ].map(([k, v]) => (
          <div key={k} className="flex flex-col rounded-control bg-mental-50 px-3 py-2">
            <dt className="text-body text-fg-muted">{k}</dt>
            <dd className="m-0 font-display text-h1 leading-tight font-semibold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-body-lg">
        {stats.bestTargetSec !== null ? <span>Target 20 record: <strong className="tabular-nums">{stats.bestTargetSec} s</strong></span> : null}
        {stats.bestAccuracyRound ? <span>Best round: <strong className="tabular-nums">{stats.bestAccuracyRound.correct} of {stats.bestAccuracyRound.answered}</strong></span> : null}
      </div>
      <h3 className="m-0 text-h3 font-bold">This week</h3>
      <WeekChart week={stats.week} />
      {stats.slowest.length > 0 ? (
        <>
          <h3 className="m-0 text-h3 font-bold">Slowest facts</h3>
          <p className="m-0 text-body text-fg-muted">These take you the longest. A few practice rounds will speed them up.</p>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {stats.slowest.map((f) => (
              <li key={f.fact} className="flex flex-wrap items-baseline justify-between gap-2 rounded-control border border-divider px-3 py-2 text-body-lg">
                <span className="font-bold">{f.label}</span>
                <span className="tabular-nums text-fg-muted">{f.avgSec} s each, {f.accuracy}% right</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </Card>
  )
}

export function QuickMathsHubScreen({ data, actions }: { data: QmHubDTO; actions: Pick<QmActions, 'start'> }): ReactElement {
  const router = useRouter()
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<{ message: string; reference: string } | null>(null)

  // Pengaturan terakhir diingat di perangkat ini (kenyamanan, bukan data penting).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) setSettings({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) })
    } catch {
      // abaikan
    }
  }, [])
  const update = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // abaikan
    }
  }

  const start = async (key: string, input: Partial<QmStartInput> & { mode: QmMode }) => {
    setBusy(key)
    setError(null)
    const full: QmStartInput = {
      op: settings.op,
      digits: settings.digits,
      carry: settings.carry,
      auto: settings.auto,
      table: settings.table,
      division: settings.division,
      flashLevel: null,
      sorobanStage: settings.stage,
      sorobanLevel: null,
      focus: null,
      mission: null,
      ...input,
    }
    try {
      const res = await actions.start(full)
      if (res.ok) router.push(res.data.redirectTo)
      else setError({ message: res.message, reference: res.reference })
    } catch {
      setError({ message: 'The round could not start. Check the internet and try again.', reference: 'KRA-QM-NET' })
    } finally {
      setBusy(null)
    }
  }

  const nextStep = data.mission.steps.find((s) => !s.done)
  const off = data.limitReached
  const manual = !settings.auto

  return (
    <LearnerFrame shell={data.shell} current="quick-maths" className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <UiIcon name="bolt" size={36} className="text-mental" />
          <h1 className="m-0 text-h1 font-bold">Quick Maths</h1>
        </div>
        <p className="m-0 max-w-[640px] text-body-lg text-fg-muted">Fast sums, any time. You earn purple XP and Quick Maths levels.</p>
        <XpTrackBars tracks={data.tracks} only="hitung" className="max-w-[460px]" />
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

      <Card title="Daily mission" id="mission">
        <p className="m-0 text-body-lg text-fg-muted">
          About {data.mission.minutes} minutes. Finish all four steps for {data.mission.bonusXp} bonus XP.
          {data.mission.streak > 1 ? ` ${data.mission.streak} days in a row.` : ''}
        </p>
        <ol className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {data.mission.steps.map((s, i) => (
            <li key={s.id} className={cx('flex items-center gap-3 rounded-control border-2 px-3 py-3', s.done ? 'border-success bg-success-50' : 'border-border bg-surface')}>
              <span aria-hidden="true" className={cx('flex h-8 w-8 flex-none items-center justify-center rounded-pill text-body font-bold', s.done ? 'bg-success text-white' : 'border-2 border-border text-fg')}>
                {s.done ? <UiIcon name="check" size={18} /> : i + 1}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-body font-bold">{s.title}</span>
                <span className="text-body text-fg-muted">{s.done ? 'Done' : `About ${s.minutes} min`}</span>
              </span>
            </li>
          ))}
        </ol>
        {data.mission.done ? (
          <p className="m-0 text-body-lg font-bold text-success">Mission done for today. Nice work.</p>
        ) : (
          <Button iconAfter="arrow-right" loading={busy === 'mission'} disabled={off || !nextStep} onClick={() => nextStep && void start('mission', { mode: nextStep.mode, mission: nextStep.id })} className="self-start">
            {data.mission.steps.some((s) => s.done) ? `Next step: ${nextStep?.title ?? ''}` : 'Start the mission'}
          </Button>
        )}
      </Card>

      <Card title="Your settings" id="settings">
        <div className="flex flex-col gap-1.5">
          <span className="text-body font-bold">Level</span>
          <Chips
            label="Level"
            value={settings.auto ? 'auto' : 'mine'}
            options={[
              { id: 'auto', label: 'Auto (just right)' },
              { id: 'mine', label: 'My choice' },
            ]}
            onChange={(v) => update({ auto: v === 'auto' })}
          />
        </div>
        {settings.auto ? (
          <ul className="m-0 grid list-none gap-1.5 p-0 text-body md:grid-cols-2">
            {data.levels.map((l) => (
              <li key={l.op} className="rounded-control bg-mental-50 px-3 py-2">
                <strong>{l.label}</strong> level {l.level}: {l.description}
              </li>
            ))}
          </ul>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <span className="text-body font-bold">Sums</span>
              <Chips label="Sums" value={settings.op} options={OPS.map((o) => ({ id: o.id, label: `${o.label}${o.id === 'mixed' ? '' : ` ${o.sym}`}` }))} onChange={(v) => update({ op: v })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-body font-bold">Digits</span>
              <Chips
                label="Digits"
                value={settings.digits}
                options={[
                  { id: 1 as QmStartInput['digits'], label: '1' },
                  { id: 2 as QmStartInput['digits'], label: '2' },
                  { id: 3 as QmStartInput['digits'], label: '3' },
                  { id: 'mixed' as QmStartInput['digits'], label: 'Mixed' },
                ]}
                onChange={(v) => update({ digits: v })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-body font-bold">Carrying and borrowing</span>
              <Chips
                label="Carrying and borrowing"
                value={settings.carry ? 'yes' : 'no'}
                options={[
                  { id: 'yes', label: 'With' },
                  { id: 'no', label: 'Without' },
                ]}
                onChange={(v) => update({ carry: v === 'yes' })}
              />
            </div>
          </>
        )}
        <p className="m-0 text-body text-fg-muted">For Grade 2: answers are never negative and sharing always comes out even.</p>
      </Card>

      <Card title="Pick a game" id="games">
        <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2 xl:grid-cols-3">
          {(
            [
              ['practice', 'Practice', 'No timer. Ask for a hint any time.', 'Start practice'],
              ['sprint60', 'Sprint 60', 'As many as you can in 60 seconds.', 'Start sprint'],
              ['sprint120', 'Sprint 120', 'As many as you can in 2 minutes.', 'Start sprint'],
              ['target20', 'Target 20', '20 questions, as fast as you can.', 'Start target'],
            ] as const
          ).map(([mode, title, blurb, cta]) => (
            <li key={mode} className="flex flex-col gap-2 rounded-control border-2 border-border p-4">
              <h3 className="m-0 text-h3 font-bold">{title}</h3>
              <p className="m-0 flex-1 text-body text-fg-muted">{blurb}</p>
              <Button variant="secondary" size="M" loading={busy === mode} disabled={off} onClick={() => void start(mode, { mode })}>
                {cta}
              </Button>
            </li>
          ))}
          <li className="flex flex-col gap-2 rounded-control border-2 border-border p-4 md:col-span-2 xl:col-span-1">
            <h3 className="m-0 text-h3 font-bold">Times tables</h3>
            <p className="m-0 text-body text-fg-muted">Pick one table and master it.</p>
            <Chips label="Table" value={settings.table} options={Array.from({ length: 11 }, (_, i) => ({ id: i + 2, label: String(i + 2) }))} onChange={(v) => update({ table: v })} />
            <label className="flex min-h-11 items-center gap-2 text-body font-semibold">
              <input type="checkbox" checked={settings.division} onChange={(e) => update({ division: e.target.checked })} className="h-5 w-5" />
              Include sharing facts
            </label>
            <Button variant="secondary" size="M" loading={busy === 'tables'} disabled={off} onClick={() => void start('tables', { mode: 'tables' })}>
              Practise the {settings.table} times table
            </Button>
          </li>
          <li className="flex flex-col gap-2 rounded-control border-2 border-border p-4 md:col-span-2 xl:col-span-1">
            <h3 className="m-0 text-h3 font-bold">Flash Anzan</h3>
            <p className="m-0 text-body text-fg-muted">Numbers flash by. Add them in your head.</p>
            <p className="m-0 text-body">
              Level {data.flash.level}: {data.flash.description}
            </p>
            <Button variant="secondary" size="M" loading={busy === 'flash'} disabled={off} onClick={() => void start('flash', { mode: 'flash' })}>
              Start Flash Anzan
            </Button>
          </li>
          <li className="flex flex-col gap-2 rounded-control border-2 border-border p-4 md:col-span-2 xl:col-span-1">
            <h3 className="m-0 text-h3 font-bold">Soroban</h3>
            <p className="m-0 text-body text-fg-muted">Learn the bead values, then see the beads in your mind.</p>
            <Chips
              label="Soroban stage"
              value={settings.stage}
              options={[
                { id: 'read' as Settings['stage'], label: `Read (L${data.soroban.read})` },
                { id: 'set' as Settings['stage'], label: `Set (L${data.soroban.set})` },
                { id: 'anzan' as Settings['stage'], label: `In my head (L${data.soroban.anzan})` },
              ]}
              onChange={(v) => update({ stage: v })}
            />
            <Button variant="secondary" size="M" loading={busy === 'soroban'} disabled={off} onClick={() => void start('soroban', { mode: 'soroban', sorobanStage: settings.stage })}>
              Start soroban
            </Button>
          </li>
        </ul>
        {manual ? <p className="m-0 text-body text-fg-muted">Sprints, Target and Practice use your settings above.</p> : null}
      </Card>

      <Card title="Strategy lessons" id="strategies">
        <p className="m-0 text-body-lg text-fg-muted">Short lessons with tricks for quick sums. Finish a lesson to earn 10 XP.</p>
        <ul className="m-0 grid list-none gap-2 p-0 md:grid-cols-2">
          {data.strategies.map((s) => (
            <li key={s.id}>
              <Link href={`/quick-maths/lessons/${s.id}`} className="flex min-h-14 items-center gap-3 rounded-control border-2 border-border bg-surface px-4 py-2 text-fg no-underline hover:border-fg">
                <span aria-hidden="true" className={cx('flex h-8 w-8 flex-none items-center justify-center rounded-pill', s.done ? 'bg-success text-white' : 'border-2 border-border')}>
                  {s.done ? <UiIcon name="check" size={18} /> : null}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-body-lg font-bold">{s.title}</span>
                  <span className="text-body text-fg-muted">{s.summary}</span>
                </span>
                <span className="ml-auto text-body font-bold">{s.done ? 'Done' : 'Open'}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <StatsCard stats={data.stats} />
    </LearnerFrame>
  )
}
