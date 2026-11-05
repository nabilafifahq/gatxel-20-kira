import type { ReactElement } from 'react'
import { cx } from '@/components/ui/cx'

/**
 * Ukuran huruf papan pelajaran mengikuti panjang teks. Batas dipilih supaya baris terpanjang tetap muat
 * di papan selebar 390 px tanpa memotong kata, dan teks pendek tetap terasa besar.
 */
export function showSizeClass(text: string): string {
  const n = text.length
  if (n <= 12) return 'text-h1 md:text-display'
  if (n <= 24) return 'text-h2 md:text-h1'
  return 'text-h3 md:text-h2'
}

/**
 * Teks `show` di papan pelajaran. Ikut alur tata letak dan tingginya tumbuh mengikuti isi,
 * jadi tidak pernah terpotong dan tidak pernah menimpa gambar di bawahnya.
 */
export function LessonShow({ text, borderClass }: { text: string; borderClass: string }): ReactElement {
  return (
    <span
      lang="en-GB"
      data-lesson-show
      className={cx(
        'flex min-h-14 max-w-full min-w-0 flex-none items-center justify-center rounded-card border-3 bg-surface px-4 py-2 text-center font-numbers font-semibold text-balance tabular-nums [overflow-wrap:anywhere] md:min-h-18 md:px-5',
        showSizeClass(text),
        borderClass,
      )}
    >
      {text}
    </span>
  )
}
