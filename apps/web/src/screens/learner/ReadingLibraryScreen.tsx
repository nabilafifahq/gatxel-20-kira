'use client'

import Link from 'next/link'
import { useMemo, useState, type ReactElement, type ReactNode } from 'react'
import { BookCover } from '@kira/figures'
import type { BookLength } from '@kira/content/books'
import type { BookCardDTO, ReadingLibraryDTO } from '@/lib/dto-reading'
import { ButtonLink } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { LearnerFrame } from '@/components/learner/LearnerHeader'

/**
 * Ruang Baca (Reading Room): perpustakaan menurut level (kelas 1 sampai 6), jenis, genre, dan panjang, dengan buku
 * yang sedang dibaca dan rak buku yang sudah selesai. Tidak ada hukuman: buku boleh dibuka kapan saja.
 */

const LENGTH_LABEL: Record<BookLength, string> = { short: 'Short', medium: 'Medium', long: 'Long' }

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }): ReactElement {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cx(
        'inline-flex h-11 cursor-pointer items-center rounded-pill border-2 px-4 text-body font-bold transition-transform duration-150 ease-kira active:scale-97',
        on ? 'border-fg bg-fg text-white' : 'border-border bg-surface text-fg hover:border-fg',
      )}
    >
      {children}
    </button>
  )
}

function StatusBadge({ b }: { b: BookCardDTO }): ReactElement | null {
  if (b.status === 'finished')
    return (
      <span className="inline-flex items-center gap-1 rounded-pill bg-success-50 px-2.5 py-0.5 text-small font-bold text-success">
        <UiIcon name="check" size={14} strokeWidth={3} />
        Finished
      </span>
    )
  if (b.status === 'reading')
    return (
      <span className="inline-flex items-center rounded-pill bg-english-50 px-2.5 py-0.5 text-small font-bold text-english">
        Reading, {b.chaptersDone} of {b.chapterCount}
      </span>
    )
  return null
}

export function BookCard({ b }: { b: BookCardDTO }): ReactElement {
  return (
    <li className="min-w-0">
      <Link
        href={b.href}
        className="flex h-full min-h-44 gap-4 rounded-card border border-divider bg-surface p-4 text-fg no-underline transition-transform duration-150 ease-kira hover:border-fg active:scale-98"
      >
        <BookCover motif={b.cover.motif} tint={b.cover.tint} className="h-36 w-26 flex-none" />
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-h3 font-bold">{b.title}</span>
          <span className="text-small text-fg-muted">
            Grade {b.grade} level, {b.kind === 'story' ? 'story' : 'non-fiction'}, {b.genreLabel.toLowerCase()}
          </span>
          <span className="text-small text-fg-muted">
            {b.chapterCount} chapters, about {b.minutes} minutes
          </span>
          <span className="mt-auto">
            <StatusBadge b={b} />
          </span>
        </span>
      </Link>
    </li>
  )
}

export function ReadingLibraryScreen({ data }: { data: ReadingLibraryDTO }): ReactElement {
  const [level, setLevel] = useState<number | 'all'>(data.grade)
  const [kind, setKind] = useState<'all' | 'story' | 'nonfiction'>('all')
  const [length, setLength] = useState<BookLength | 'all'>('all')
  const [genre, setGenre] = useState<string>('all')

  const genres = useMemo(() => [...new Map(data.books.map((b) => [b.genre, b.genreLabel] as const)).entries()].sort((a, b) => a[1].localeCompare(b[1])), [data.books])
  const shown = data.books.filter(
    (b) => (level === 'all' || b.grade === level) && (kind === 'all' || b.kind === kind) && (length === 'all' || b.length === length) && (genre === 'all' || b.genre === genre),
  )
  const finished = data.books.filter((b) => b.status === 'finished')

  return (
    <LearnerFrame shell={data.shell} current="reading" className="flex flex-col gap-6 md:gap-7">
      <header className="flex flex-col gap-1.5">
        <h1 className="m-0 text-h1 font-bold">Reading Room</h1>
        <p className="m-0 text-body-lg text-fg-muted">Pick a book and read at your own speed. Press play and Kira reads along with you.</p>
      </header>

      <dl className="m-0 grid max-w-2xl grid-cols-3 gap-3 text-center">
        <div className="rounded-card border border-divider bg-surface p-3">
          <dt className="text-small text-fg-muted">Today</dt>
          <dd className="m-0 text-h3 font-bold tabular-nums">{data.minutesToday} min</dd>
        </div>
        <div className="rounded-card border border-divider bg-surface p-3">
          <dt className="text-small text-fg-muted">This week</dt>
          <dd className="m-0 text-h3 font-bold tabular-nums">{data.minutesWeek} min</dd>
        </div>
        <div className="rounded-card border border-divider bg-surface p-3">
          <dt className="text-small text-fg-muted">Books finished</dt>
          <dd className="m-0 text-h3 font-bold tabular-nums">{data.booksFinished}</dd>
        </div>
      </dl>

      {data.continueBook ? (
        <section aria-labelledby="keep" className="flex flex-col gap-3 rounded-card border-2 border-english bg-english-50 p-4 md:flex-row md:items-center">
          <BookCover motif={data.continueBook.cover.motif} tint={data.continueBook.cover.tint} className="h-32 w-24 flex-none" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 id="keep" className="m-0 text-h3 font-bold">
              Keep reading
            </h2>
            <p className="m-0 text-body-lg">{data.continueBook.title}</p>
            <p className="m-0 text-body text-fg-muted">{data.continueBook.resumeLabel}</p>
          </div>
          <ButtonLink href={data.continueBook.href} variant="primary" className="w-full md:w-auto">
            Carry on reading
          </ButtonLink>
        </section>
      ) : null}

      <section aria-labelledby="find" className="flex flex-col gap-3">
        <h2 id="find" className="m-0 text-h2 font-bold">
          Find a book
        </h2>
        <div role="group" aria-label="Level" className="flex flex-wrap gap-2">
          <Chip on={level === 'all'} onClick={() => setLevel('all')}>
            All levels
          </Chip>
          {[1, 2, 3, 4, 5, 6].map((g) => (
            <Chip key={g} on={level === g} onClick={() => setLevel(g)}>
              Grade {g}
              {g === data.grade ? ' (you)' : ''}
            </Chip>
          ))}
        </div>
        <div role="group" aria-label="Kind of book" className="flex flex-wrap gap-2">
          <Chip on={kind === 'all'} onClick={() => setKind('all')}>
            Stories and facts
          </Chip>
          <Chip on={kind === 'story'} onClick={() => setKind('story')}>
            Stories
          </Chip>
          <Chip on={kind === 'nonfiction'} onClick={() => setKind('nonfiction')}>
            Non-fiction
          </Chip>
        </div>
        <div role="group" aria-label="Genre" className="flex flex-wrap gap-2">
          <Chip on={genre === 'all'} onClick={() => setGenre('all')}>
            Any genre
          </Chip>
          {genres.map(([g, label]) => (
            <Chip key={g} on={genre === g} onClick={() => setGenre(g)}>
              {label}
            </Chip>
          ))}
        </div>
        <div role="group" aria-label="Length" className="flex flex-wrap gap-2">
          <Chip on={length === 'all'} onClick={() => setLength('all')}>
            Any length
          </Chip>
          {(['short', 'medium', 'long'] as const).map((l) => (
            <Chip key={l} on={length === l} onClick={() => setLength(l)}>
              {LENGTH_LABEL[l]}
            </Chip>
          ))}
        </div>
        {shown.length === 0 ? (
          <p className="m-0 rounded-control border-2 border-dashed border-border px-4 py-3 text-body text-fg-muted">No books match. Try another level or genre.</p>
        ) : (
          <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 lg:grid-cols-2 xl:grid-cols-3">
            {shown.map((b) => (
              <BookCard key={b.id} b={b} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="shelf" className="flex flex-col gap-3">
        <h2 id="shelf" className="m-0 text-h2 font-bold">
          My shelf
        </h2>
        {finished.length === 0 ? (
          <p className="m-0 text-body text-fg-muted">Books you finish will stand here. Your shelf is empty for now, and that is fine.</p>
        ) : (
          <ul className="m-0 flex list-none flex-wrap gap-4 p-0">
            {finished.map((b) => (
              <li key={b.id}>
                <Link href={b.href} className="flex w-28 flex-col items-center gap-1.5 text-center text-fg no-underline">
                  <BookCover motif={b.cover.motif} tint={b.cover.tint} className="h-36 w-26" />
                  <span className="text-small font-bold">{b.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </LearnerFrame>
  )
}
