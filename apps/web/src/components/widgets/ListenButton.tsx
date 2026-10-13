'use client'

import { useId, useState, type ReactElement } from 'react'
import type { Subject } from '@/lib/dto'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { useSpeech, type SpeechLang } from '@/components/learner/speech'

/**
 * Tombol putar suara untuk soal dengar dan eja. Teksnya dibacakan lewat useSpeech dan tidak pernah
 * ditampilkan di layar. Satu tombol untuk putar dan berhenti, tinggi 56 px. Bila perangkat tidak punya suara,
 * tombol tetap terlihat dengan garis putus-putus dan satu kalimat penjelasan.
 */

const TINT: Record<Subject, string> = { math: 'bg-math-50', english: 'bg-english-50', science: 'bg-science-50' }

export function ListenButton({
  text,
  lang = 'en-GB',
  subject,
  label = 'Play the audio',
  disabled = false,
  className,
}: {
  text: string
  lang?: SpeechLang
  subject: Subject
  label?: string
  disabled?: boolean
  className?: string
}): ReactElement {
  const { status, toggle } = useSpeech(lang)
  const [played, setPlayed] = useState(false)
  const noteId = useId()
  const playing = status === 'reading'
  const off = status === 'unavailable'
  return (
    <span className={cx('inline-flex flex-wrap items-center gap-2.5', className)}>
      <button
        type="button"
        aria-pressed={off ? undefined : playing}
        aria-describedby={off ? noteId : undefined}
        disabled={off || disabled}
        onClick={() => {
          setPlayed(true)
          toggle(text)
        }}
        className={cx(
          'inline-flex h-16 min-w-16 flex-none items-center justify-center gap-3 rounded-control px-6 text-body-lg font-bold transition-transform duration-150 ease-kira',
          off || disabled
            ? 'cursor-not-allowed border-2 border-dashed border-review bg-bg text-fg-muted'
            : playing
              ? cx('cursor-pointer border-3 border-fg text-fg', TINT[subject])
              : 'cursor-pointer border-2 border-border bg-surface text-fg hover:border-fg active:scale-97',
        )}
      >
        <UiIcon name={off ? 'speaker-off' : playing ? 'waveform' : 'speaker'} size={28} />
        {playing ? 'Playing' : played ? 'Play it again' : label}
      </button>
      {off ? (
        <span id={noteId} className="text-body text-fg-muted">
          No English voice on this device.
        </span>
      ) : null}
    </span>
  )
}
