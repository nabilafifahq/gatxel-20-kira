import type { QuestSubject, Subject } from '@/lib/dto'

/** Nama mapel di layar learner (en-GB). */
export const SUBJECT_NAME: Record<QuestSubject, string> = {
  math: 'Math',
  english: 'English',
  science: 'Science',
  bonus: 'Bonus quest',
}

/**
 * Kelas warna mapel. Ditulis utuh supaya Tailwind membangkitkan kelasnya.
 * `solid` latar penuh warna mapel, `tint` latar tipis, `border` garis warna mapel.
 */
export type SubjectStyle = {
  text: string
  solid: string
  tint: string
  border: string
  fill: string
  /** Warna isi bar progres. */
  bar: string
  /** Outline fokus atau garis 3 px terpilih. */
  ring: string
}

export const SUBJECT_STYLE: Record<QuestSubject, SubjectStyle> = {
  math: { text: 'text-math', solid: 'bg-math', tint: 'bg-math-50', border: 'border-math', fill: 'fill-math', bar: 'bg-math', ring: 'outline-math' },
  english: { text: 'text-english', solid: 'bg-english', tint: 'bg-english-50', border: 'border-english', fill: 'fill-english', bar: 'bg-english', ring: 'outline-english' },
  science: { text: 'text-science', solid: 'bg-science', tint: 'bg-science-50', border: 'border-science', fill: 'fill-science', bar: 'bg-science', ring: 'outline-science' },
  bonus: { text: 'text-fg', solid: 'bg-star', tint: 'bg-surface', border: 'border-fg', fill: 'fill-star', bar: 'bg-star', ring: 'outline-fg' },
}

export function subjectStyle(s: QuestSubject): SubjectStyle {
  return SUBJECT_STYLE[s]
}

export function isSubject(s: QuestSubject): s is Subject {
  return s !== 'bonus'
}
