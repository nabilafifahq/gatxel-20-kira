'use client'

import { useState, type ReactElement } from 'react'
import { DICT_CLIP_STYLE } from '@kira/core/dictionary'
import type { MyWordsDTO, SavedWordDTO } from '@/lib/dto-vocab'
import { ButtonLink, IconButton } from '@/components/ui/Button'
import { LearnerFrame } from '@/components/learner/LearnerHeader'
import { ReadAloudButton } from '@/components/learner/ReadAloudButton'
import { removeWordAction } from '@/server/actions/vocab'

/**
 * My words (Kamus Ketuk): kata yang disimpan anak dari layar soal, pelajaran, dan bacaan. Arti sudah ada di DTO,
 * jadi halaman ini juga bisa dibuka dari cache saat offline. Kata yang disimpan menjadi dek kartu "My words".
 */

function WordCard({ w, onRemove, busy }: { w: SavedWordDTO; onRemove: () => void; busy: boolean }): ReactElement {
  return (
    <li className="flex items-center gap-3 rounded-card border border-divider bg-surface p-4">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p lang="en-GB" className="m-0 font-reading text-h3 font-bold">
          {w.word}
          {w.pos ? <span className="ml-2 text-body font-normal text-fg-muted">{w.pos}</span> : null}
        </p>
        <p lang="id" className="m-0 text-body-lg font-bold">
          {w.id.join(', ')}
        </p>
        <p lang="en-GB" className="m-0 text-body text-fg-muted">
          {w.en}
        </p>
      </div>
      <ReadAloudButton text={w.word} style={DICT_CLIP_STYLE} lang="en-GB" subject="english" compact showNote={false} />
      <IconButton icon="close" label={`Remove ${w.word}`} variant="quiet" size="L" loading={busy} onClick={onRemove} />
    </li>
  )
}

export function MyWordsScreen({ data }: { data: MyWordsDTO }): ReactElement {
  const [words, setWords] = useState(data.words)
  const [busy, setBusy] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const remove = async (word: string) => {
    setBusy(word)
    setFailed(false)
    const r = await removeWordAction({ word })
    setBusy(null)
    if (r.ok) setWords((l) => l.filter((x) => x.word !== word))
    else setFailed(true)
  }
  return (
    <LearnerFrame shell={data.shell} current="me" className="flex flex-col gap-4 md:gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-h1 font-bold">My words</h1>
        <p className="m-0 text-body-lg text-fg-muted">
          {words.length === 0
            ? 'Tap a word in a question or a lesson, then press Save. Your words will wait here.'
            : `${words.length} ${words.length === 1 ? 'word' : 'words'} you saved. Practise them with flashcards.`}
        </p>
      </header>
      {words.length > 0 ? (
        <div>
          <ButtonLink href="/practice/cards/my-words" variant="secondary">
            Practise with flashcards
          </ButtonLink>
        </div>
      ) : null}
      {failed ? (
        <p role="status" className="m-0 text-body-lg text-danger">
          Could not remove that word. Try again.
        </p>
      ) : null}
      {words.length > 0 ? (
        <ul aria-label="Saved words" className="m-0 grid list-none grid-cols-1 gap-3 p-0 lg:grid-cols-2">
          {words.map((w) => (
            <WordCard key={w.word} w={w} busy={busy === w.word} onRemove={() => void remove(w.word)} />
          ))}
        </ul>
      ) : null}
    </LearnerFrame>
  )
}
