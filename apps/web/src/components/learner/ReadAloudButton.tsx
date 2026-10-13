'use client'

import { useId, type ReactElement } from 'react'
import type { Subject } from '@/lib/dto'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import type { TtsStyleId } from '@kira/core/tts'
import { useSpeech, type SpeechInput, type SpeechLang } from './speech'

/**
 * Tombol baca suara (papan ReadAloudButton). Satu tombol untuk mulai dan berhenti
 * dengan aria-pressed. Tinggi 56 px. Saat membaca, latar memakai tint mapel.
 * Tidak tersedia berarti perangkat tidak punya suara bahasa Inggris dan klip Qwen belum aktif; tombol tetap
 * terlihat dengan garis putus-putus. Teks Indonesia tidak dibacakan, jadi untuk lang="id" tombol tidak tampil.
 */

const TINT: Record<Subject, string> = { math: 'bg-math-50', english: 'bg-english-50', science: 'bg-science-50' }

export function ReadAloudButton({
  text,
  lang = 'en-GB',
  subject = 'math',
  compact = false,
  showNote = true,
  style,
  labels,
  className,
}: {
  /** Satu teks, atau bagian berurutan (prompt lalu tiap opsi) yang masing-masing menjadi klip suara. */
  text: SpeechInput
  lang?: SpeechLang
  subject?: Subject
  /** Ikon saja (HP). */
  compact?: boolean
  /** Tampilkan kalimat "No English voice on this tablet." saat tidak tersedia. */
  showNote?: boolean
  /** Gaya suara Qwen (guru, pencerita, dikte). Bawaan: guru. */
  style?: TtsStyleId
  /** Label tombol bila bukan Read aloud (misalnya Play the question). */
  labels?: { idle: string; busy: string }
  className?: string
}): ReactElement | null {
  const { status, toggle } = useSpeech(lang)
  const noteId = useId()
  const reading = status === 'reading'
  const off = status === 'unavailable'
  if (lang === 'id') return null
  return (
    <span className={cx('inline-flex flex-wrap items-center gap-2.5', className)}>
      <button
        type="button"
        aria-pressed={off ? undefined : reading}
        aria-label={compact ? (reading ? 'Stop reading' : 'Read aloud') : undefined}
        aria-describedby={off ? noteId : undefined}
        disabled={off}
        onClick={() => toggle(text, style ? { style } : undefined)}
        className={cx(
          'inline-flex h-14 min-w-14 flex-none items-center justify-center gap-2 rounded-control text-body-lg font-bold transition-transform duration-150 ease-kira',
          compact ? 'px-0' : 'px-5',
          off
            ? 'cursor-not-allowed border-2 border-dashed border-review bg-bg text-fg-muted'
            : reading
              ? cx('cursor-pointer border-2 border-fg text-fg', TINT[subject])
              : 'cursor-pointer border-2 border-border bg-surface text-fg hover:border-fg active:scale-97',
        )}
      >
        <UiIcon name={off ? 'speaker-off' : reading ? 'waveform' : 'speaker'} size={22} />
        {compact ? null : reading ? (labels?.busy ?? 'Reading') : (labels?.idle ?? 'Read aloud')}
      </button>
      {off ? (
        <span id={noteId} className={cx('text-body text-fg-muted', showNote ? '' : 'visually-hidden')}>
          No English voice on this device.
        </span>
      ) : null}
    </span>
  )
}
