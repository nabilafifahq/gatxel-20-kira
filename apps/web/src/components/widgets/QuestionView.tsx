'use client'

import { useId, useState, type ReactElement, type ReactNode } from 'react'
import type { ClientItem } from '@kira/content/present'
import { styleForPassageKind } from '@kira/core/tts'
import type { Subject } from '@/lib/dto'
import { Button, IconButton } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { FigureFrame } from '@/components/learner/FigureFrame'
import { ReadAloudButton } from '@/components/learner/ReadAloudButton'
import { SUBJECT_STYLE } from '@/components/learner/subject'
import { ClozePrompt } from './ClozeWidget'
import { speakableClipParts, speakableStyle } from './speakable-parts'
import { TextPrompt } from './TextWidget'
import type { WidgetFeedback } from './types'

/**
 * Tampilan soal: pill nomor soal, teks soal Andika (ukuran mengikuti jenjang), figur di
 * FigureFrame, panel bacaan yang bisa dilipat untuk soal membaca, teks yang harus
 * dibacakan anak (soal bicara), tombol baca suara, dan tombol Terms untuk soal ESMO.
 * Untuk soal isian, kotak isian muncul di tempat ___ lewat `answer`.
 */

export function NumberPill({ n, subject, className }: { n: number | string; subject: Subject; className?: string }): ReactElement {
  return (
    <span
      className={cx(
        'inline-flex h-8.5 min-w-11 flex-none items-center justify-center rounded-pill px-3 text-body-lg font-bold text-white tabular-nums',
        SUBJECT_STYLE[subject].solid,
        className,
      )}
    >
      {n}
    </span>
  )
}

/** Panel istilah Indonesia ke English (papan RunnerEsmoTerms). */
export function TermsPanel({ terms, onClose, className }: { terms: { term: string; en: string }[]; onClose: () => void; className?: string }): ReactElement {
  const titleId = useId()
  return (
    <aside aria-labelledby={titleId} className={cx('flex flex-col gap-3 rounded-card border-2 border-fg bg-surface px-6 pt-4 pb-6', className)}>
      <div className="flex items-center gap-2.5">
        <UiIcon name="book" size={24} />
        <h2 id={titleId} className="m-0 text-h3 font-bold">
          Terms in this question
        </h2>
        <IconButton icon="close" label="Close terms" size="M" className="ml-auto" onClick={onClose} />
      </div>
      <dl className="m-0 flex flex-col">
        {terms.map((t) => (
          <div key={t.term} className="grid grid-cols-2 gap-x-4 border-b border-divider py-2">
            <dt lang="id" className="font-reading text-h3 font-bold">
              {t.term}
            </dt>
            <dd lang="en-GB" className="m-0 font-reading text-h3">
              {t.en}
            </dd>
          </div>
        ))}
      </dl>
      <p className="m-0 text-body text-fg-muted">The real contest has no Terms button. Use it less each week.</p>
    </aside>
  )
}

function PassagePanel({ passage, lang }: { passage: NonNullable<ClientItem['passage']>; lang: ClientItem['lang'] }): ReactElement {
  const [open, setOpen] = useState(true)
  const bodyId = useId()
  return (
    <section aria-label={passage.title} className="rounded-control border border-divider bg-bg">
      <div className="flex items-center gap-3 px-4 py-2">
        <UiIcon name="book" size={22} />
        <h3 className="m-0 min-w-0 flex-1 text-body-lg font-bold">{passage.title}</h3>
        <Button variant="quiet" size="M" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((o) => !o)} className="px-3">
          {open ? 'Hide the text' : 'Show the text'}
          <UiIcon name={open ? 'chevron-up' : 'chevron-down'} size={20} />
        </Button>
      </div>
      <div id={bodyId} hidden={!open} lang={lang} className="max-h-[40svh] overflow-y-auto px-4 pb-4">
        <ReadAloudButton text={passage.text} style={styleForPassageKind(passage.kind)} lang={lang} subject="english" showNote={false} className="mb-3" />
        {passage.text.split(/\n{2,}/).map((para, i) => (
          <p key={i} className="text-question mt-0 mb-3 last:mb-0">
            {para}
          </p>
        ))}
      </div>
    </section>
  )
}

/** Soal listening: teks soal disembunyikan, anak mendengar suaranya lalu memilih jawaban. Teks bisa dibuka. */
function ListenPrompt({ item, subject, promptId }: { item: ClientItem; subject: Subject; promptId: string }): ReactElement {
  const [shown, setShown] = useState(false)
  const wordsId = useId()
  // Hanya prompt (dan teks bacaan) yang diputar; pilihan jawaban terlihat di layar.
  const parts = speakableClipParts(item).slice(0, item.readText ? 2 : 1)
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <p id={promptId} className="text-question m-0 font-bold">
        Listen, then choose the answer.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <ReadAloudButton
          text={parts}
          style={speakableStyle(item)}
          lang={item.lang}
          subject={subject}
          showNote={false}
          labels={{ idle: 'Play the question', busy: 'Playing' }}
        />
        <Button variant="quiet" size="M" aria-expanded={shown} aria-controls={wordsId} onClick={() => setShown((o) => !o)} className="px-3">
          {shown ? 'Hide the words' : 'Show the words'}
          <UiIcon name={shown ? 'chevron-up' : 'chevron-down'} size={20} />
        </Button>
      </div>
      <p id={wordsId} hidden={!shown} lang={item.lang} className="text-question m-0 whitespace-pre-line">
        {item.prompt}
      </p>
    </div>
  )
}

export function QuestionView({
  item,
  number,
  subject,
  answer,
  hideTools = false,
  showTerms = true,
  children,
  figurePaper,
  listen = false,
  className,
}: {
  item: ClientItem
  number: number | string
  subject: Subject
  /** Untuk soal isian: kotak isian di dalam teks soal. */
  answer?: { value: unknown | null; onChange: (v: unknown | null) => void; disabled?: boolean; feedback?: WidgetFeedback }
  /** Runner menaruh tombol baca suara dan Terms di bar sendiri. */
  hideTools?: boolean
  showTerms?: boolean
  /** Isi tambahan di bawah figur, misalnya daftar hint. */
  children?: ReactNode
  figurePaper?: boolean
  /** Sesi listening English Skills: sembunyikan teks soal pilihan ganda dan putar suaranya. */
  listen?: boolean
  className?: string
}): ReactElement {
  const [termsOpen, setTermsOpen] = useState(false)
  const promptId = useId()
  const hasTerms = showTerms && !!item.terms && item.terms.length > 0
  const inlineBlanks = item.type === 'text' && !!answer
  const inlineGaps = item.type === 'cloze' && !!answer
  // Soal ketuk di gambar dan beri label menampilkan figurnya di area jawaban, lengkap dengan lapisan ketuk.
  const figureInAnswer = item.type === 'hotspot' || item.type === 'label'
  const listenMode = listen && (item.type === 'mcq' || item.type === 'multi') && item.lang === 'en-GB'
  return (
    <div className={cx('flex flex-col gap-4 md:gap-5', className)}>
      {item.passage ? <PassagePanel passage={item.passage} lang={item.lang} /> : null}
      <div className="flex items-start gap-3.5">
        <NumberPill n={number} subject={subject} className="mt-1" />
        {listenMode ? (
          <ListenPrompt item={item} subject={subject} promptId={promptId} />
        ) : inlineGaps && answer ? (
          <ClozePrompt
            id={promptId}
            item={item}
            value={answer.value}
            onChange={answer.onChange}
            disabled={answer.disabled}
            feedback={answer.feedback ?? null}
            subject={subject}
          />
        ) : inlineBlanks && answer ? (
          <TextPrompt
            id={promptId}
            item={item}
            value={answer.value}
            onChange={answer.onChange}
            disabled={answer.disabled}
            feedback={answer.feedback ?? null}
            subject={subject}
          />
        ) : (
          <p id={promptId} lang={item.lang} className="text-question m-0 whitespace-pre-line">
            {item.prompt}
          </p>
        )}
      </div>
      {item.readText ? (
        <div className="flex flex-col gap-1 rounded-control border-2 border-border bg-surface px-4 py-3 md:ml-14.5">
          <span className="text-body font-bold">Read this out loud</span>
          <p lang={item.lang} className="text-question m-0">
            {item.readText}
          </p>
        </div>
      ) : null}
      {item.figure && !figureInAnswer ? (
        <FigureFrame spec={item.figure} paper={figurePaper ?? subject === 'math'} className="self-start md:ml-14.5" />
      ) : null}
      {children ? <div className="md:ml-14.5">{children}</div> : null}
      {!hideTools ? (
        <div className="flex flex-wrap items-center gap-3 md:ml-14.5">
          <ReadAloudButton text={speakableClipParts(item)} style={speakableStyle(item)} lang={item.lang} subject={subject} />
          {hasTerms ? (
            <Button variant="secondary" icon="book" aria-expanded={termsOpen} onClick={() => setTermsOpen((o) => !o)}>
              Terms
            </Button>
          ) : null}
        </div>
      ) : null}
      {!hideTools && hasTerms && termsOpen && item.terms ? <TermsPanel terms={item.terms} onClose={() => setTermsOpen(false)} /> : null}
    </div>
  )
}
