/** Kontrak bersama semua alat peraga: komponen terkendali, ketuk saja, bisa dipakai di widget soal, langkah pelajaran, dan halaman Alat. */
export type ToolFeedback = 'correct' | 'not-yet' | null

export type ToolMilestone = 'trade' | 'shape' | 'place' | 'done' | 'bar'

export type ToolProps<T> = {
  value: T
  onChange(v: T): void
  disabled?: boolean
  feedback?: ToolFeedback
  /** Kejadian kecil yang layak disambut maskot di halaman Alat dan pelajaran. */
  onMilestone?(kind: ToolMilestone): void
}
