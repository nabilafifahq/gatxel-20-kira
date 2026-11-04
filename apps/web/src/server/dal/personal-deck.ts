import 'server-only'
import type { Flashcard } from '@kira/content/flashcards'
import type { Tx } from '../db'
import { personalVocabDeck } from './vocab'

/**
 * Dek pribadi dari kata yang disimpan anak di kamus (tabel saved_word, dibangun saat dibuka). Kembalikan null
 * bila anak belum menyimpan kata. `backLang` adalah bahasa sisi belakang kartu (arti Indonesia).
 */
export type PersonalDeck = { title: string; cards: Flashcard[]; backLang: 'en-GB' | 'id' }

export const PERSONAL_DECK_ID = 'my-words'

export async function personalDeckFor(tx: Tx, learnerId: string): Promise<PersonalDeck | null> {
  const deck = await personalVocabDeck(tx, learnerId)
  if (!deck) return null
  return { title: deck.title, cards: deck.cards.map((c) => ({ id: c.id, front: c.front, back: c.back, say: c.say })) as Flashcard[], backLang: 'id' }
}
