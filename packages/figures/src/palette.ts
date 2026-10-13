/**
 * Warna figur dan ikon, sama persis dengan token DESIGN.md. Figur tidak boleh
 * memakai warna di luar daftar ini (diperiksa oleh test/palette.test.ts).
 */
export const INK = '#14202E'
export const MUTED = '#4A5A6E'
export const BORDER = '#7A8899'
export const DIVIDER = '#D3DCE6'
export const BG = '#F5F8FC'
export const WHITE = '#FFFFFF'
export const MATH = '#1F6FB2'
export const MATH_50 = '#E7F0F9'
export const ENGLISH = '#B4442F'
export const ENGLISH_50 = '#FAECE8'
export const SCIENCE = '#2E7D4F'
export const SCIENCE_50 = '#E7F3EC'
export const MENTAL = '#7A3EB0'
export const MENTAL_50 = '#F2EAF8'
export const KNOWLEDGE = '#27409E'
export const KNOWLEDGE_50 = '#E8ECF9'
export const WARN = '#B54708'
export const WARN_50 = '#FDF1E7'
export const STAR = '#F2B10E'
export const REVIEW = '#A3B1C2'
export const DANGER = '#B42318'

export const PALETTE = [INK, MUTED, BORDER, DIVIDER, BG, WHITE, MATH, MATH_50, ENGLISH, ENGLISH_50, SCIENCE, SCIENCE_50, MENTAL, MENTAL_50, KNOWLEDGE, KNOWLEDGE_50, WARN, WARN_50, STAR, REVIEW, DANGER] as const

export const TONES = {
  math: { stroke: MATH, fill: MATH_50 },
  english: { stroke: ENGLISH, fill: ENGLISH_50 },
  science: { stroke: SCIENCE, fill: SCIENCE_50 },
  warn: { stroke: WARN, fill: WARN_50 },
  star: { stroke: INK, fill: STAR },
  muted: { stroke: MUTED, fill: BG },
  ink: { stroke: INK, fill: WHITE },
} as const

export type Tone = keyof typeof TONES

export const FONT_LABEL = "'Plus Jakarta Sans', 'Segoe UI', system-ui, sans-serif"
export const FONT_READING = 'Andika, Verdana, sans-serif'
export const FONT_DISPLAY = "Mohave, 'Arial Narrow', sans-serif"

/** Nada arena (Quick Maths dan Quiz Arena). Terpisah dari TONES supaya soal tidak bisa memakainya. */
export const ARENA_TONES = {
  mental: { stroke: MENTAL, fill: MENTAL_50 },
  knowledge: { stroke: KNOWLEDGE, fill: KNOWLEDGE_50 },
} as const
