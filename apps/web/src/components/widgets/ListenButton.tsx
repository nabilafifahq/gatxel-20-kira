'use client'

import { useId, useState, type ReactElement } from 'react'
import type { Subject } from '@/lib/dto'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import type { TtsStyleId } from '@kira/core/tts'
import { useSpeech, type SpeechLang } from '@/components/learner/speech'
import { useT } from '@/lib/i18n/client'

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
  label,
  disabled = false,
  style,
  className,
  clips,
  missing = false,
}: {
  text: string
  lang?: SpeechLang
  subject: Subject
  label?: string
  disabled?: boolean
  /** Gaya suara klip (soal eja memakai suara dikte yang pelan). Harus sama dengan gaya klip batch di worker. */
  style?: TtsStyleId
  className?: string
  /** Mode tanpa umpan balik: kunci klip pengganti teks. Tidak jatuh ke suara perangkat. */
  clips?: readonly string[]
  /** Mode tanpa umpan balik: klip belum ada. */
  missing?: boolean
}): ReactElement {
  const { status, toggle, playKeys, stop } = useSpeech(lang)
  const [played, setPlayed] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const noteId = useId()
  const t = useT()
  const playing = status === 'reading'
  const off = missing || (clips === undefined && status === 'unavailable')
  const note = missing ? t.widgets.shared.audioNotReady : off ? t.widgets.shared.noVoice : loadFailed ? t.widgets.shared.audioFailed : null
  return (
    <span className={cx('inline-flex flex-wrap items-center gap-2.5', className)}>
      <button
        type="button"
        aria-pressed={off ? undefined : playing}
        aria-describedby={note ? noteId : undefined}
        disabled={off || disabled}
        onClick={() => {
          setPlayed(true)
          if (clips === undefined) {
            toggle(text, style ? { style } : undefined)
          } else if (playing) {
            stop()
          } else {
            setLoadFailed(false)
            playKeys(clips, () => setLoadFailed(true))
          }
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
        {playing ? t.widgets.shared.playing : played ? t.widgets.listen.again : (label ?? t.widgets.listen.play)}
      </button>
      {note ? (
        <span id={noteId} className="text-body text-fg-muted">
          {note}
        </span>
      ) : null}
    </span>
  )
}
