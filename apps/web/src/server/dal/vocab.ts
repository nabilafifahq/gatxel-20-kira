import 'server-only'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { loadDictionary } from '@kira/content/dictionary'
import { findContentDir } from '@kira/content/load'
import { DICT_POS_LABEL, lookupWord, SAVED_WORD_RE, type DictFile } from '@kira/core/dictionary'
import { DICT_CLIP_STYLE } from '@kira/core/dictionary'
import { tables } from '@kira/db'
import type { MyWordsDTO, SavedWordDTO } from '@/lib/dto-vocab'
import { getT } from '@/lib/i18n/server'
import type { Tx } from '../db'
import { conflict, invalid } from '../errors'
import { learnerShell, loadLearner } from './learner-core'

const { savedWord } = tables

/** Paling banyak kata tersimpan per anak. Menjaga daftar dan dek kartu tetap ringan. */
export const MAX_SAVED_WORDS = 500

let dict: DictFile | null = null
function dictionary(): DictFile {
  dict ??= loadDictionary(findContentDir())
  return dict
}

/** Bentuk dasar kata di kamus, atau null bila kata itu tidak ada (nama, angka, salah ketik). */
export function lemmaOf(raw: string): string | null {
  return lookupWord(dictionary(), raw)?.lemma ?? null
}

/**
 * Simpan satu kata ke daftar kata anak. Kata disimpan sebagai bentuk dasar (ran menjadi run). Menyimpan kata yang
 * sama dua kali tidak apa-apa. Mengembalikan bentuk dasar yang tersimpan.
 */
export async function saveWordTx(tx: Tx, orgId: string, learnerId: string, raw: string): Promise<string> {
  const lemma = lemmaOf(raw)
  if (!lemma || !SAVED_WORD_RE.test(lemma)) throw invalid((await getT()).reading.errors.notInDictionary)
  const [count] = await tx.select({ n: sql<number>`count(*)::int` }).from(savedWord).where(eq(savedWord.learnerId, learnerId))
  const [already] = await tx.select({ w: savedWord.word }).from(savedWord).where(and(eq(savedWord.learnerId, learnerId), eq(savedWord.word, lemma))).limit(1)
  if (!already && (count?.n ?? 0) >= MAX_SAVED_WORDS) throw conflict((await getT()).reading.errors.listFull)
  await tx.insert(savedWord).values({ orgId, learnerId, word: lemma }).onConflictDoNothing()
  return lemma
}

export async function removeWordTx(tx: Tx, learnerId: string, raw: string): Promise<void> {
  const lemma = lemmaOf(raw) ?? raw.trim().toLowerCase()
  await tx.delete(savedWord).where(and(eq(savedWord.learnerId, learnerId), eq(savedWord.word, lemma)))
}

export async function savedWordSet(tx: Tx, learnerId: string): Promise<string[]> {
  const rows = await tx.select({ w: savedWord.word }).from(savedWord).where(eq(savedWord.learnerId, learnerId)).orderBy(asc(savedWord.word))
  return rows.map((r) => r.w)
}

export async function myWordsDTO(tx: Tx, learnerId: string): Promise<MyWordsDTO> {
  const rows = await tx.select({ w: savedWord.word, at: savedWord.savedAt }).from(savedWord).where(eq(savedWord.learnerId, learnerId)).orderBy(desc(savedWord.savedAt))
  const d = dictionary()
  const words: SavedWordDTO[] = rows.flatMap((r) => {
    const e = d.entries[r.w]
    return e ? [{ word: r.w, id: e.i, en: e.e, pos: e.p ? (DICT_POS_LABEL[e.p] ?? null) : null, savedAt: r.at.toISOString() }] : []
  })
  const shell = await learnerShell(tx, await loadLearner(tx, learnerId))
  return { shell, words, max: MAX_SAVED_WORDS }
}

/** Kartu satu dek pribadi. Bentuk sama dengan dek berkas (content/flashcards): front, back, say. */
export type PersonalVocabDeck = {
  id: 'personal-vocab'
  subject: 'english'
  grade: number
  title: string
  cards: { id: string; front: string; back: string; say: string }[]
}

/**
 * Dek kartu dari kata pribadi anak, dibuat saat dibuka (tidak disimpan sebagai berkas). Depan: kata English.
 * Belakang: arti Indonesia lalu arti English sederhana. say: kata yang dibacakan (gaya DICT_CLIP_STYLE).
 * Mengembalikan null bila anak belum menyimpan kata. Dipanggil di dalam transaksi org (withOrg/inOrg).
 */
export async function personalVocabDeck(tx: Tx, learnerId: string): Promise<PersonalVocabDeck | null> {
  const rows = await tx.select({ w: savedWord.word }).from(savedWord).where(eq(savedWord.learnerId, learnerId)).orderBy(asc(savedWord.savedAt))
  const d = dictionary()
  const cards = rows.flatMap((r) => {
    const e = d.entries[r.w]
    return e ? [{ id: `pv.${r.w}`, front: r.w, back: `${e.i.join(', ')}\n${e.e}`, say: r.w }] : []
  })
  if (cards.length === 0) return null
  const grade = Math.min(6, Math.max(1, ...rows.map((r) => d.entries[r.w]?.g ?? 1)))
  return { id: 'personal-vocab', subject: 'english', grade, title: 'My words', cards }
}

export { DICT_CLIP_STYLE }
