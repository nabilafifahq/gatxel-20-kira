import 'server-only'
import type { Flashcard } from '@kira/content/flashcards'
import type { Tx } from '../db'

/**
 * Seam untuk dek pribadi dari kata yang disimpan anak di kamus. Agent kamus mengganti isi `personalDeckFor`
 * (membaca tabel kamusnya) tanpa mengubah pemutar kartu. Kembalikan null bila anak belum menyimpan kata.
 * `backLang` adalah bahasa sisi belakang kartu (arti), supaya teks Indonesia tidak dibacakan.
 */
export type PersonalDeck = { title: string; cards: Flashcard[]; backLang: 'en-GB' | 'id' }

export const PERSONAL_DECK_ID = 'my-words'

export async function personalDeckFor(_tx: Tx, _learnerId: string): Promise<PersonalDeck | null> {
  return null
}
