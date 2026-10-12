import type { ClientItem } from '@kira/content/present'
import type { Subject } from '@/lib/dto'

export type WidgetFeedback = 'correct' | 'not-yet' | null

/**
 * Props satu widget soal. `value` mengikuti bentuk `Answer` di
 * packages/content/src/check.ts persis; opsi selalu dijawab dengan indeks asli `i`.
 */
export type WidgetProps = {
  item: ClientItem
  value: unknown | null
  onChange(v: unknown | null): void
  disabled?: boolean
  feedback?: WidgetFeedback
  subject: Subject
  onUpload?(blob: Blob, kind: 'audio' | 'drawing'): Promise<{ mediaId: string } | null>
  /**
   * Tambahan di luar kontrak: soal bicara dan gambar boleh dilewati bila tidak bisa
   * dikerjakan di perangkat ini (mikrofon mati, gambar di kertas). Runner yang mengisinya.
   */
  onSkip?(): void
}
