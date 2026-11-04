import type { ReactElement } from 'react'
import { BG, ENGLISH, ENGLISH_50, INK, KNOWLEDGE, KNOWLEDGE_50, MATH, MATH_50, MENTAL, MENTAL_50, SCIENCE, SCIENCE_50, STAR, WARN, WARN_50, WHITE } from './palette'

/**
 * Sampul buku Ruang Baca: bidang berwarna, jilid di kiri, dan satu gambar sederhana di tengah.
 * Warna hanya dari palette.ts. Judul tidak digambar di sini (teks HTML di sekitarnya), jadi sampul tetap
 * tajam dan bisa dibaca pembaca layar lewat `title`.
 */

export const COVER_MOTIFS = ['kite', 'boat', 'tree', 'star', 'fish', 'house', 'mountain', 'bird', 'rocket', 'leaf'] as const
export type CoverMotif = (typeof COVER_MOTIFS)[number]
export const COVER_TINTS = ['math', 'english', 'science', 'mental', 'knowledge', 'warn'] as const
export type CoverTint = (typeof COVER_TINTS)[number]

const TINT: Record<CoverTint, { main: string; soft: string }> = {
  math: { main: MATH, soft: MATH_50 },
  english: { main: ENGLISH, soft: ENGLISH_50 },
  science: { main: SCIENCE, soft: SCIENCE_50 },
  mental: { main: MENTAL, soft: MENTAL_50 },
  knowledge: { main: KNOWLEDGE, soft: KNOWLEDGE_50 },
  warn: { main: WARN, soft: WARN_50 },
}

const S = { stroke: INK, strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

function Motif({ motif, main, soft }: { motif: CoverMotif; main: string; soft: string }): ReactElement {
  switch (motif) {
    case 'kite':
      return (
        <g {...S}>
          <path d="M50 8 L74 36 L50 66 L26 36 Z" fill={main} />
          <path d="M50 8 V66 M26 36 H74" fill="none" stroke={WHITE} />
          <path d="M50 66 C42 76 58 82 50 92 C44 98 54 102 48 108" fill="none" />
          <path d="M44 78 L56 82 M46 94 L58 96" fill="none" />
        </g>
      )
    case 'boat':
      return (
        <g {...S}>
          <path d="M50 14 V68" fill="none" />
          <path d="M50 16 L82 62 H50 Z" fill={WHITE} />
          <path d="M46 28 L22 62 H46 Z" fill={main} />
          <path d="M14 70 H86 L74 90 H26 Z" fill={STAR} />
          <path d="M6 100 C20 92 30 108 44 100 C58 92 70 108 94 100" fill="none" stroke={main} />
        </g>
      )
    case 'tree':
      return (
        <g {...S}>
          <rect x="43" y="68" width="14" height="34" rx="3" fill={WARN} />
          <circle cx="50" cy="40" r="28" fill={main} />
          <circle cx="36" cy="52" r="16" fill={main} />
          <circle cx="64" cy="52" r="16" fill={main} />
          <circle cx="44" cy="34" r="4" fill={WHITE} stroke="none" />
          <circle cx="62" cy="44" r="4" fill={WHITE} stroke="none" />
        </g>
      )
    case 'star':
      return (
        <g {...S}>
          <path d="M50 8 L61 38 L93 39 L67 58 L76 90 L50 72 L24 90 L33 58 L7 39 L39 38 Z" fill={STAR} />
          <circle cx="42" cy="44" r="3" fill={INK} stroke="none" />
          <circle cx="58" cy="44" r="3" fill={INK} stroke="none" />
          <path d="M43 56 C47 62 53 62 57 56" fill="none" />
        </g>
      )
    case 'fish':
      return (
        <g {...S}>
          <path d="M14 52 C30 24 62 24 76 52 C62 80 30 80 14 52 Z" fill={main} />
          <path d="M72 52 L94 32 V72 Z" fill={main} />
          <circle cx="32" cy="46" r="4" fill={WHITE} />
          <circle cx="32" cy="46" r="1.5" fill={INK} stroke="none" />
          <path d="M46 36 C52 48 52 56 46 68" fill="none" stroke={WHITE} />
          <path d="M14 94 C20 88 26 100 32 94 M62 98 C68 92 74 104 80 98" fill="none" stroke={main} />
        </g>
      )
    case 'house':
      return (
        <g {...S}>
          <rect x="22" y="48" width="56" height="44" rx="2" fill={WHITE} />
          <path d="M12 52 L50 16 L88 52 Z" fill={main} />
          <rect x="42" y="66" width="16" height="26" rx="2" fill={STAR} />
          <rect x="27" y="58" width="11" height="11" fill={soft} />
          <rect x="62" y="58" width="11" height="11" fill={soft} />
        </g>
      )
    case 'mountain':
      return (
        <g {...S}>
          <path d="M4 92 L38 24 L58 62 L70 42 L96 92 Z" fill={main} />
          <path d="M38 24 L28 44 L38 40 L46 46 Z" fill={WHITE} />
          <circle cx="78" cy="20" r="9" fill={STAR} />
        </g>
      )
    case 'bird':
      return (
        <g {...S}>
          <ellipse cx="48" cy="56" rx="30" ry="22" fill={main} />
          <circle cx="74" cy="40" r="14" fill={main} />
          <path d="M86 40 L98 44 L86 48 Z" fill={STAR} />
          <circle cx="76" cy="37" r="3" fill={WHITE} />
          <path d="M18 54 L2 44 L6 64 Z" fill={main} />
          <path d="M34 52 C44 38 58 44 56 62 C46 66 38 62 34 52 Z" fill={soft} />
          <path d="M40 78 V92 M54 78 V92" fill="none" />
        </g>
      )
    case 'rocket':
      return (
        <g {...S}>
          <path d="M50 6 C70 24 70 58 62 80 H38 C30 58 30 24 50 6 Z" fill={WHITE} />
          <path d="M38 62 L22 84 L38 80 Z M62 62 L78 84 L62 80 Z" fill={main} />
          <circle cx="50" cy="38" r="9" fill={soft} />
          <path d="M42 86 L50 104 L58 86 Z" fill={STAR} />
        </g>
      )
    case 'leaf':
      return (
        <g {...S}>
          <path d="M16 86 C10 40 40 12 90 14 C92 62 66 92 16 86 Z" fill={main} />
          <path d="M16 86 C36 66 58 44 78 28 M44 66 L44 44 M60 50 L74 52" fill="none" stroke={WHITE} />
        </g>
      )
  }
}

export function BookCover({ motif, tint, title, className }: { motif: CoverMotif; tint: CoverTint; title?: string; className?: string }): ReactElement {
  const { main, soft } = TINT[tint]
  return (
    <svg viewBox="0 0 120 160" className={className} {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}>
      <rect x="2" y="2" width="116" height="156" rx="8" fill={soft} stroke={INK} strokeWidth="3" />
      <rect x="2" y="2" width="14" height="156" rx="6" fill={main} stroke={INK} strokeWidth="3" />
      <rect x="28" y="14" width="80" height="6" rx="3" fill={main} opacity="0.35" />
      <g transform="translate(34 30) scale(0.94)">
        <Motif motif={motif} main={main} soft={soft} />
      </g>
      <rect x="28" y="140" width="80" height="6" rx="3" fill={BG} stroke={INK} strokeWidth="1.5" />
    </svg>
  )
}
