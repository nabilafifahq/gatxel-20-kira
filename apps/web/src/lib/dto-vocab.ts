import type { LearnerShell } from './dto'

/** Kata pribadi anak (Kamus Ketuk). Arti diisi server dari kamus supaya halaman tetap utuh saat offline. */
export type SavedWordDTO = {
  word: string
  /** Arti Indonesia, paling banyak 3. */
  id: string[]
  /** Arti English sederhana. */
  en: string
  pos: string | null
  savedAt: string
}

export type MyWordsDTO = { shell: LearnerShell; words: SavedWordDTO[]; max: number }
