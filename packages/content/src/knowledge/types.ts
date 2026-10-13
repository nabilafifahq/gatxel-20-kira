/**
 * Quiz Arena: model data. Fakta ditulis sebagai data (folder data/), soal dibuat dari fakta oleh generate.ts.
 * Semua teks yang dibaca learner berbahasa Inggris (en-GB).
 */
import type { IconName } from '@kira/figures/spec'

export const TOPIC_IDS = ['flags', 'capitals', 'provinces', 'continents', 'animals', 'body', 'space', 'inventors', 'landmarks', 'instruments', 'dinosaurs', 'words'] as const
export type TopicId = (typeof TOPIC_IDS)[number]

export const PLANET_NAMES = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'sun', 'moon'] as const
export type PlanetName = (typeof PLANET_NAMES)[number]

/** Gambar yang boleh dipakai soal: bendera (SVG milik sendiri), ikon @kira/figures, atau planet. Tanpa emoji dan tanpa aset luar. */
export type Pic = { t: 'flag'; code: string } | { t: 'icon'; name: IconName } | { t: 'planet'; name: PlanetName }

export type KOption = { label: string; pic?: Pic }

/** Satu pertanyaan pilihan ganda yang bisa dibuat dari sebuah fakta. */
export type KAsk = {
  prompt: string
  pic?: Pic
  answer: KOption
  /** Kolam jawaban salah: semua `answer` dengan `pool` yang sama dalam satu topik. Kosong bila memakai `wrong`. */
  pool: string
  /** Pilihan salah tertulis tangan (dipakai bila kolam tidak cocok). */
  wrong?: string[]
  /** Ambil pengecoh dari kolam lain (daftar kunci kolam) alih-alih dari `pool`. */
  draw?: string[]
  /** Kelompok untuk memilih pengecoh yang mirip (near) atau yang pasti berbeda (far). */
  group?: string
  mode?: 'near' | 'far' | 'any'
  /** Label yang tidak boleh muncul sebagai pilihan salah, misalnya jawaban lain yang juga benar. */
  exclude?: string[]
  /** Pilihan berupa gambar saja (label tetap menjadi nama aksesibel). */
  style?: 'text' | 'pics'
  /** Membuat versi benar atau salah dari pertanyaan ini. */
  statement?: (label: string) => string
  explain?: string
  /** Jumlah pilihan (default 4). */
  options?: number
}

export type KCard = { front: string; back: string; frontPic?: Pic; backPic?: Pic }

/** Pernyataan benar atau salah yang tertulis tangan. */
export type KTrueFalse = { prompt: string; truth: boolean; explain: string; pic?: Pic }

export type KFact = {
  id: string
  topic: TopicId
  /** Kelompok kemajuan, misalnya benua untuk bendera atau pulau untuk provinsi. */
  group: string
  /** 1 paling dikenal anak, 3 paling jarang. Soal baru dibuka bertahap per tingkat. */
  tier: 1 | 2 | 3
  card: KCard
  asks: KAsk[]
  tf?: KTrueFalse[]
}

/** Urutkan: `items` tertulis dalam urutan yang benar; ronde mengambil `pick` item acak lalu mengacaknya. */
export type KOrderSet = {
  id: string
  topic: TopicId
  prompt: string
  items: { id: string; label: string; pic?: Pic }[]
  pick: number
  explain: string
}

export type TopicMode = 'learn' | 'quiz' | 'speed'

export type KTopic = {
  id: TopicId
  title: string
  blurb: string
  pic: Pic
  /** Topik ini punya gambar di soalnya. */
  pictures: boolean
  facts: KFact[]
  orders: KOrderSet[]
}

// ---------------------------------------------------------------------------
// Soal untuk client (tanpa kunci) dan kunci di server

export type KClientQuestion =
  | { kind: 'mc'; factId: string; prompt: string; pic?: Pic; style: 'text' | 'pics'; options: KOption[] }
  | { kind: 'tf'; factId: string; prompt: string; pic?: Pic }
  | { kind: 'order'; factId: string; prompt: string; items: { id: string; label: string; pic?: Pic }[] }

export type KKey =
  | { kind: 'mc'; correct: number; explain: string; factId: string; answerLabel: string }
  | { kind: 'tf'; correct: boolean; explain: string; factId: string; answerLabel: string }
  | { kind: 'order'; correct: string[]; explain: string; factId: string; answerLabel: string }

export type KAnswer = number | boolean | string[]

export type KQuestion = { client: KClientQuestion; key: KKey }

/** Catatan kemajuan per fakta, disimpan di arena_state. */
export type KnowEntry = { n: number; r: number; last: 0 | 1 }
export type KnowMap = Record<string, KnowEntry>

/** Fakta dianggap dikenal setelah dijawab benar dua kali. */
export const KNOWN_AFTER_RIGHT = 2

export function isKnown(e: KnowEntry | undefined): boolean {
  return !!e && e.r >= KNOWN_AFTER_RIGHT
}

export type KRoundMode = 'learn' | 'quiz' | 'speed'

export const KROUND = {
  learn: { count: 12, timed: false, limitSec: null as number | null },
  quiz: { count: 10, timed: false, limitSec: null as number | null },
  speed: { count: 60, timed: true, limitSec: 60 as number | null },
} as const
