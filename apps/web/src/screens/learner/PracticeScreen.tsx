'use client'

import Link from 'next/link'
import { useState, type ReactElement } from 'react'
import { useT } from '@/lib/i18n/client'
import type { PracticeDTO, PracticeTile } from '@/server/dal/practice'
import { cx } from '@/components/ui/cx'
import { UiIcon, type UiIconName } from '@/components/ui/icons'
import { LearnerFrame, LearnerHeader } from '@/components/learner/LearnerHeader'

/**
 * Latihan Bebas: anak memilih apa yang mau dilatih. Tile besar untuk anak 7 tahun, pilihan jumlah soal,
 * waktu, dan gaya soal di bar atas. Tidak ada streak atau tenggat di sini; XP datang dari jawaban.
 */

const SECTION_ICON: Record<string, UiIconName> = { math: 'plus', mental: 'bolt', olympiad: 'trophy', science: 'globe', english: 'book', cards: 'cards', review: 'book' }

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }): ReactElement {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cx('min-h-11 rounded-pill border-2 px-4 text-body font-bold', on ? 'border-fg bg-fg text-surface' : 'border-border bg-surface text-fg')}
    >
      {children}
    </button>
  )
}

export function PracticeScreen({ data, few }: { data: PracticeDTO; few: boolean }): ReactElement {
  const copy = useT().lessons.practice
  const [n, setN] = useState<number>(data.counts[2] ?? 10)
  const [timed, setTimed] = useState(false)
  const [style, setStyle] = useState<string>('mixed')
  const href = (t: PracticeTile) => (t.drill ? `${t.href}&n=${n}&timed=${timed ? 1 : 0}&style=${style}` : t.href)
  return (
    <LearnerFrame shell={data.shell} current="practice" className="flex flex-col gap-6">
      <LearnerHeader shell={data.shell} title={copy.title} subline={copy.subline} />
      {data.offNote ? (
        <p role="status" className="m-0 rounded-card border-2 border-fg bg-surface p-4 text-body-lg font-bold">
          {copy.offNote(data.offNote)}
        </p>
      ) : null}
      {few ? (
        <p role="status" className="m-0 rounded-card border-2 border-fg bg-surface p-4 text-body-lg font-bold">
          {copy.few}
        </p>
      ) : null}

      <section aria-label={copy.options} className="flex flex-col gap-4 rounded-card border border-divider bg-surface p-4">
        <div className="flex flex-col gap-2">
          <h2 className="m-0 text-h3 font-bold">{copy.howMany}</h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label={copy.numberOfQuestions}>
            {data.counts.map((c) => (
              <Chip key={c} on={n === c} onClick={() => setN(c)}>
                {String(c)}
              </Chip>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="m-0 text-h3 font-bold">{copy.timer}</h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label={copy.timer}>
            <Chip on={!timed} onClick={() => setTimed(false)}>
              {copy.takeMyTime}
            </Chip>
            <Chip on={timed} onClick={() => setTimed(true)}>
              {copy.timed}
            </Chip>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="m-0 text-h3 font-bold">{copy.kind}</h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label={copy.kind}>
            {data.styles.map((s) => (
              <Chip key={s.id} on={style === s.id} onClick={() => setStyle(s.id)}>
                {s.label}
              </Chip>
            ))}
          </div>
        </div>
      </section>

      {data.sections.length === 0 ? (
        <p className="m-0 text-body-lg text-fg-muted">{copy.nothingOn}</p>
      ) : null}
      {data.sections.map((s) => (
        <section key={s.id} aria-labelledby={`pr-${s.id}`} className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <UiIcon name={SECTION_ICON[s.id] ?? 'star'} size={30} />
            <div className="flex flex-col">
              <h2 id={`pr-${s.id}`} className="m-0 text-h2 font-bold">
                {s.title}
              </h2>
              <p className="m-0 text-body text-fg-muted">{s.hint}</p>
            </div>
          </div>
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
            {s.tiles.map((t) => (
              <li key={t.id}>
                <Link
                  href={href(t)}
                  prefetch={false}
                  className="flex min-h-24 h-full flex-col justify-center gap-1 rounded-card border-2 border-border bg-surface p-4 text-fg no-underline transition-transform duration-150 ease-kira hover:border-fg active:scale-98"
                >
                  <span className="text-h3 font-bold">{t.title}</span>
                  <span className="text-body text-fg-muted">{t.sub}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </LearnerFrame>
  )
}
