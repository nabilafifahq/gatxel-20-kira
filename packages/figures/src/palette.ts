/**
 * Warna figur dan ikon, sama persis dengan token DESIGN.md v1.0 (Brand Kit). Figur tidak boleh
 * memakai warna di luar daftar ini (diperiksa oleh test/palette.test.ts). Garis dan teks selalu
 * Deep Grape; Sky Blue, Kira Lilac, dan Butter Yellow hanya untuk isi.
 */
export const GRAPE = '#6546A5'
export const LILAC = '#B99AEF'
export const LAVENDER = '#E9DDFB'
export const YELLOW = '#FFE69A'
export const SKY = '#9DD8F7'
export const CLOUD = '#FFFCF5'
export const WHITE = '#FFFFFF'
export const SUCCESS = '#2E7D4F'
export const DANGER = '#B42318'

export const INK = GRAPE
export const MUTED = GRAPE
export const BORDER = GRAPE
export const DIVIDER = LAVENDER
export const BG = CLOUD
export const MATH = SKY
export const MATH_50 = LAVENDER
export const ENGLISH = LILAC
export const ENGLISH_50 = LAVENDER
export const SCIENCE = YELLOW
export const SCIENCE_50 = LAVENDER
export const MENTAL = LILAC
export const MENTAL_50 = LAVENDER
export const KNOWLEDGE = SKY
export const KNOWLEDGE_50 = LAVENDER
export const WARN = GRAPE
export const WARN_50 = LAVENDER
export const STAR = YELLOW
export const REVIEW = SKY

export const PALETTE = [GRAPE, LILAC, LAVENDER, YELLOW, SKY, CLOUD, WHITE, SUCCESS, DANGER] as const

export const TONES = {
  math: { stroke: INK, fill: MATH },
  english: { stroke: INK, fill: ENGLISH },
  science: { stroke: INK, fill: SCIENCE },
  warn: { stroke: INK, fill: WARN_50 },
  star: { stroke: INK, fill: STAR },
  muted: { stroke: INK, fill: BG },
  ink: { stroke: INK, fill: WHITE },
} as const

export type Tone = keyof typeof TONES

export const FONT_LABEL = 'Nunito, system-ui, sans-serif'
export const FONT_READING = 'Nunito, system-ui, sans-serif'
export const FONT_DISPLAY = "Fredoka, Nunito, system-ui, sans-serif"
export const FONT_NUMBERS = "'Baloo 2', Nunito, system-ui, sans-serif"

/** Nada arena (Quick Maths dan Quiz Arena). Terpisah dari TONES supaya soal tidak bisa memakainya. */
export const ARENA_TONES = {
  mental: { stroke: INK, fill: MENTAL },
  knowledge: { stroke: INK, fill: KNOWLEDGE },
} as const
