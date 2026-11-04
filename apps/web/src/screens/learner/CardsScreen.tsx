'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import type { CardSessionDTO, CardsHubDTO, DeckRow } from '@/server/dal/flashcards'
import { finishCardsAction } from '@/server/actions/flashcards'
import { Figure } from '@kira/figures'
import { Button } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { LearnerFrame, LearnerHeader } from '@/components/learner/LearnerHeader'
import { DICT_CLIP_STYLE } from '@kira/core/dictionary'
import { ReadAloudButton } from '@/components/learner/ReadAloudButton'
import { playSfx } from '@/components/learner/sfx'
import { ActionError } from '@/screens/learner/common'
import { useT } from '@/lib/i18n/client'

/**
 * Kartu belajar. Daftar dek per mapel dan kelas dengan kemajuan, pemutar kartu dengan animasi balik, tombol
 * "I knew it" dan "Not yet", dan mode Vocab drill (kata ke arti, arti ke kata, atau mengeja).
 */

function DeckTile({ d, mode }: { d: DeckRow; mode: string }): ReactElement {
  const t = useT()
  const tc = t.reading.cards
  const pct = d.total > 0 ? Math.round((d.known / d.total) * 100) : 0
  return (
    <li>
      <Link
        href={`/practice/cards/${d.id}?mode=${mode}`}
        prefetch={false}
        className="flex h-full min-h-28 flex-col justify-center gap-2 rounded-card border-2 border-border bg-surface p-4 text-fg no-underline transition-transform duration-150 ease-kira hover:border-fg active:scale-98"
      >
        <span lang={d.personal ? undefined : 'en-GB'} className="text-h3 font-bold">
          {d.personal ? tc.myWords : d.title}
        </span>
        <span className="text-body text-fg-muted">
          {d.personal ? tc.yourSavedWords : `${t.common.subject[d.subject]}, ${t.common.grade(d.grade)}`}
          {d.due > 0 ? tc.readyToReview(d.due) : ''}
        </span>
        <span role="img" aria-label={tc.knownAria(d.known, d.total)} className="flex h-2.5 overflow-hidden rounded-control bg-divider">
          <span className="bg-fg" style={{ width: `${pct}%` }} />
        </span>
        <span className="text-body text-fg-muted tabular-nums">
          {tc.known(d.known, d.total)}
        </span>
      </Link>
    </li>
  )
}

export function CardsHubScreen({ data }: { data: CardsHubDTO }): ReactElement {
  const t = useT()
  const tc = t.reading.cards
  // Ada ratusan dek: kelas anak dulu, kelas lain menunggu sampai diminta.
  const [allGrades, setAllGrades] = useState(false)
  const otherGrades = data.decks.some((d) => !d.personal && d.grade !== data.grade)
  const bySubject = (['english', 'science', 'math'] as const).map((s) => ({ s, decks: data.decks.filter((d) => d.subject === s && !d.personal && (allGrades || d.grade === data.grade)) }))
  const personal = data.decks.filter((d) => d.personal)
  const vocab = data.mode === 'vocab'
  return (
    <LearnerFrame shell={data.shell} current="practice" className="flex flex-col gap-6">
      <LearnerHeader shell={data.shell} title={vocab ? tc.vocabDrill : tc.flashcards} subline={vocab ? tc.vocabSubline : tc.cardsSubline} />
      <Link href="/practice" className="w-fit text-body font-bold text-fg underline underline-offset-3">
        {tc.backToPractice}
      </Link>
      {data.decks.length === 0 ? <p className="m-0 text-body-lg text-fg-muted">{tc.noDecks}</p> : null}
      {personal.length > 0 ? (
        <section aria-labelledby="dk-mine" className="flex flex-col gap-3">
          <h2 id="dk-mine" className="m-0 text-h2 font-bold">
            {tc.myWords}
          </h2>
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
            {personal.map((d) => (
              <DeckTile key={d.id} d={d} mode={data.mode} />
            ))}
          </ul>
        </section>
      ) : null}
      {bySubject
        .filter((g) => g.decks.length > 0)
        .map((g) => (
          <section key={g.s} aria-labelledby={`dk-${g.s}`} className="flex flex-col gap-3">
            <h2 id={`dk-${g.s}`} className="m-0 text-h2 font-bold">
              {t.common.subject[g.s]}
            </h2>
            <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
              {g.decks.map((d) => (
                <DeckTile key={d.id} d={d} mode={data.mode} />
              ))}
            </ul>
          </section>
        ))}
      {otherGrades && !allGrades ? (
        <Button variant="secondary" onClick={() => setAllGrades(true)} className="self-start">
          {tc.otherGrades}
        </Button>
      ) : null}
    </LearnerFrame>
  )
}

// ---------------------------------------------------------------------------
// Pemutar

type Result = { cardId: string; knew: boolean }
type Dir = 'word-to-meaning' | 'meaning-to-word' | 'spell'

/** Arti tanpa contoh kalimat: contohnya memuat kata yang sedang ditanyakan. */
function meaningOnly(back: string): string {
  return back.replace(/\s*Example:[\s\S]*$/, '').trim()
}

function shuffleStable<T>(list: T[], seed: number): T[] {
  const a = [...list]
  let s = seed || 1
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) % 4294967296
    const j = s % (i + 1)
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

function Done({ session, results, onAgain }: { session: CardSessionDTO; results: Result[]; onAgain: () => void }): ReactElement {
  const tc = useT().reading.cards
  const [saved, setSaved] = useState<{ xp: number; knew: number; total: number } | null>(null)
  const [err, setErr] = useState<{ message: string; reference: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const sent = useRef(false)
  const knew = results.filter((r) => r.knew).length
  async function save() {
    if (sent.current && !err) return
    sent.current = true
    setBusy(true)
    setErr(null)
    try {
      const r = await finishCardsAction({ deckId: session.deck.id, results })
      if (r.ok) setSaved(r.data)
      else setErr({ message: r.message, reference: r.reference })
    } catch {
      setErr({ message: tc.saveFailed, reference: 'KRA-FC-NET' })
    } finally {
      setBusy(false)
    }
  }
  // Simpan sekali begitu layar ini tampil.
  useEffect(() => {
    void save()
  }, [])
  return (
    <section aria-live="polite" className="flex flex-col items-start gap-4 rounded-card border border-divider bg-surface p-6">
      <h2 className="m-0 text-h1 font-bold">
        {tc.known(knew, results.length)}
      </h2>
      <p className="m-0 text-body-lg text-fg-muted">
        {knew === results.length ? tc.allWon : tc.missedComeBack}
        {saved && saved.xp > 0 ? tc.earned(saved.xp) : ''}
      </p>
      {err ? <ActionError message={err.message} reference={err.reference} /> : null}
      <div className="flex flex-wrap gap-3">
        {err ? (
          <Button variant="secondary" loading={busy} onClick={() => void save()}>
            {tc.saveAgain}
          </Button>
        ) : null}
        <Button onClick={onAgain}>{tc.playAgain}</Button>
        <Link href={`/practice/cards?mode=${session.mode}`} className="inline-flex h-14 items-center rounded-control border-2 border-border px-6 text-body-lg font-bold text-fg no-underline">
          {tc.allDecks}
        </Link>
      </div>
    </section>
  )
}

export function FlashcardPlayer({ session }: { session: CardSessionDTO }): ReactElement {
  const [round, setRound] = useState(0)
  return <Round key={round} session={session} onAgain={() => setRound((r) => r + 1)} />
}

function Round({ session, onAgain }: { session: CardSessionDTO; onAgain: () => void }): ReactElement {
  const t = useT()
  const tc = t.reading.cards
  const vocab = session.mode === 'vocab'
  const [dir, setDir] = useState<Dir>('word-to-meaning')
  const [i, setI] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [results, setResults] = useState<Result[]>([])
  const [picked, setPicked] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const total = session.cards.length
  const card = session.cards[i]
  const backLang = session.deck.backLang

  const options = useMemo(() => {
    if (!card || !vocab || dir === 'spell') return []
    const meaningToWord = dir === 'meaning-to-word'
    const correct = meaningToWord ? card.front : meaningOnly(card.back)
    const others = session.pool.filter((p) => p.id !== card.id).map((p) => (meaningToWord ? p.front : meaningOnly(p.back)))
    const uniq = [...new Set(others)].filter((o) => o !== correct)
    return shuffleStable([correct, ...shuffleStable(uniq, i + 7).slice(0, 3)], i + 31)
  }, [card, vocab, dir, session.pool, i])

  function next(knew: boolean) {
    if (!card) return
    playSfx(knew ? 'correct' : 'notyet')
    setResults((r) => [...r, { cardId: card.id, knew }])
    setI((x) => x + 1)
    setFlipped(false)
    setPicked(null)
    setTyped('')
  }

  if (total === 0) return <p className="m-0 text-body-lg text-fg-muted">{tc.deckEmpty}</p>
  if (!card) return <Done session={session} results={results} onAgain={onAgain} />

  const progress = (
    <p className="m-0 text-body font-bold tabular-nums" aria-live="polite">
      {tc.cardOf(i + 1, total)}
    </p>
  )

  if (!vocab) {
    return (
      <div className="flex flex-col gap-4">
        {progress}
        <button
          type="button"
          onClick={() => {
            playSfx('tap')
            setFlipped((f) => !f)
          }}
          aria-label={flipped ? tc.backAria : tc.frontAria}
          className="[perspective:1200px] block min-h-64 w-full rounded-card border-0 bg-transparent p-0 text-left"
        >
          <span
            className={cx(
              'grid min-h-64 w-full transition-transform duration-500 ease-kira [transform-style:preserve-3d] motion-reduce:transition-none',
              flipped ? '[transform:rotateY(180deg)]' : '',
            )}
          >
            <span className="flex flex-col items-center justify-center gap-3 rounded-card border-2 border-border bg-surface p-6 text-center [grid-area:1/1] [backface-visibility:hidden]" aria-hidden={flipped}>
              {card.figure ? (
                <span className="block w-full max-w-[260px]">
                  <Figure spec={card.figure} />
                </span>
              ) : null}
              <span lang="en-GB" className="text-h1 font-bold break-words">
                {card.front}
              </span>
              <span className="text-body text-fg-muted">{tc.tapToFlip}</span>
            </span>
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-card border-2 border-fg bg-bg p-6 text-center [backface-visibility:hidden] [transform:rotateY(180deg)]" aria-hidden={!flipped}>
              <span lang={backLang} className="text-h2 font-bold break-words">
                {card.back}
              </span>
            </span>
          </span>
        </button>
        <div className="flex flex-wrap gap-3">
          {/* say memuat kata, arti, dan contoh, jadi baru diputar setelah kartu dibalik supaya jawaban tidak terdengar lebih dulu. Dek pribadi memakai klip kata dari kamus. */}
          {flipped || session.deck.personal ? (
            <ReadAloudButton text={card.say ?? (flipped && backLang === 'en-GB' ? card.back : card.front)} {...(session.deck.personal ? { style: DICT_CLIP_STYLE } : {})} subject="english" showNote={false} />
          ) : null}
        </div>
        {flipped ? (
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => next(false)} className="min-w-40">
              {tc.notYet}
            </Button>
            <Button onClick={() => next(true)} className="min-w-40">
              {tc.knewIt}
            </Button>
          </div>
        ) : (
          <p className="m-0 text-body text-fg-muted">{tc.thinkFirst}</p>
        )}
      </div>
    )
  }

  // Vocab drill
  const meaningToWord = dir === 'meaning-to-word'
  const answer = dir === 'word-to-meaning' ? meaningOnly(card.back) : card.front
  const spelling = dir === 'spell'
  const answered = picked !== null
  const right = answered && picked === answer
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label={tc.drillType}>
        {(
          [
            ['word-to-meaning', tc.wordToMeaning],
            ['meaning-to-word', tc.meaningToWord],
            ['spell', tc.spellIt],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={dir === id}
            disabled={answered}
            onClick={() => setDir(id)}
            className={cx('min-h-11 rounded-pill border-2 px-4 text-body font-bold', dir === id ? 'border-fg bg-fg text-surface' : 'border-border bg-surface text-fg')}
          >
            {label}
          </button>
        ))}
      </div>
      {progress}
      <div className="flex flex-col gap-3 rounded-card border-2 border-border bg-surface p-6">
        <p className="m-0 text-body text-fg-muted">{spelling ? tc.typeTheWord : meaningToWord ? tc.whichWord : tc.whatMeans}</p>
        {spelling || meaningToWord ? (
          <p lang={backLang} className="m-0 text-h3 font-bold break-words whitespace-pre-line">
            {meaningOnly(card.back)}
          </p>
        ) : (
          <p lang="en-GB" className="m-0 text-h1 font-bold break-words">
            {card.front}
          </p>
        )}
        {/* Hanya katanya: say juga membacakan arti, yang justru jawaban latihan ini. */}
        {!meaningToWord && !spelling ? <ReadAloudButton text={card.front} style={DICT_CLIP_STYLE} subject="english" showNote={false} /> : null}
      </div>
      {spelling ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (!typed.trim() || answered) return
            setPicked(typed.trim())
          }}
        >
          <label className="flex flex-col gap-1 text-body font-bold">
            {tc.yourSpelling}
            <input
              lang="en-GB"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={answered}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="h-14 rounded-control border-2 border-border bg-surface px-4 text-body-lg"
            />
          </label>
          {!answered ? <Button type="submit">{t.common.check}</Button> : null}
        </form>
      ) : (
        <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
          {options.map((o) => {
            const isRight = o === answer
            return (
              <li key={o}>
                <button
                  type="button"
                  lang={meaningToWord ? 'en-GB' : backLang}
                  disabled={answered}
                  onClick={() => setPicked(o)}
                  className={cx(
                    'flex min-h-14 w-full items-center rounded-control border-2 px-4 py-2 text-left text-body-lg font-semibold whitespace-pre-line',
                    answered && isRight ? 'border-fg bg-bg' : 'border-border bg-surface',
                    answered && picked === o && !isRight ? 'border-dashed' : '',
                  )}
                >
                  {o}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {answered ? (
        <div role="status" className="flex flex-col gap-3 rounded-card border-2 border-fg bg-surface p-4">
          <p className="m-0 text-body-lg font-bold">
            {(spelling ? picked!.toLowerCase() === answer.toLowerCase() : right) ? (
              tc.right
            ) : (
              <>
                {tc.notYetAnswer}
                <span lang={dir === 'word-to-meaning' ? backLang : 'en-GB'}>{answer}</span>.
              </>
            )}
          </p>
          <Button onClick={() => next(spelling ? picked!.toLowerCase() === answer.toLowerCase() : right)} className="w-fit">
            {i + 1 === total ? tc.finish : tc.nextCard}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export function CardsPlayerScreen({ session }: { session: CardSessionDTO }): ReactElement {
  const tc = useT().reading.cards
  return (
    <LearnerFrame shell={session.shell} current="practice" className="flex flex-col gap-5">
      <LearnerHeader shell={session.shell} title={session.deck.personal ? tc.myWords : <span lang="en-GB">{session.deck.title}</span>} subline={session.mode === 'vocab' ? tc.vocabDrill : tc.flashcards} />
      <Link href={`/practice/cards?mode=${session.mode}`} className="w-fit text-body font-bold text-fg underline underline-offset-3">
        {tc.allDecks}
      </Link>
      <FlashcardPlayer session={session} />
    </LearnerFrame>
  )
}
