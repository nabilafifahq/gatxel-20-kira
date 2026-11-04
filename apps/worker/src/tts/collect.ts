import { findContentDir, loadContent, type ContentIndex } from '@kira/content/load'
import { loadSpelling } from '@kira/content/spelling'
import type { Item } from '@kira/content/schema'
import { bookSpeechClips, loadBooks } from '@kira/content/books'
import { loadDictionary } from '@kira/content/dictionary'
import { itemSpeechClips, lessonSpeechClips, passageSpeechClips, spellingSpeechClips } from '@kira/content/speech'
import { dictionaryWordClips } from '@kira/core/dictionary'
import { loadFlashcards } from '@kira/content/flashcards'
import { CARDS, STORY } from '@kira/core'
import { clipTextsOf, TTS_FIXED_LINES, TTS_VOICE_VERSION, ttsKeyInput, type TtsClipRequest } from '@kira/core/tts'

/**
 * Kumpulkan semua teks bahasa Inggris yang dibacakan layar learner, dengan gaya yang sama persis
 * dengan yang dipakai web (apps/web/src/components/learner/speech.ts). Aturan teks dan gaya ada di
 * packages/core/src/tts.ts dan packages/content/src/speech.ts supaya kedua sisi menghasilkan kunci klip yang sama.
 */

export const itemClips = (item: Item): TtsClipRequest[] => itemSpeechClips(item)

/** Klip dari konten repo, berurutan: English dulu, lalu Science, lalu Math, tiap mapel dari kelas rendah. */
export function repoClips(index: ContentIndex): TtsClipRequest[] {
  const out: TtsClipRequest[] = [...TTS_FIXED_LINES]
  const rank = (id: string) => `${id[0] === 'e' ? 0 : id[0] === 's' ? 1 : 2}${id[1]}`
  const skillIds = [...index.skills.keys()].sort((a, b) => rank(a).localeCompare(rank(b)) || a.localeCompare(b))
  for (const id of skillIds) {
    for (const item of index.itemsBySkill.get(id) ?? []) out.push(...itemSpeechClips(item))
    const lesson = index.lessons.get(id)
    if (lesson) out.push(...lessonSpeechClips(lesson))
  }
  for (const p of index.passages.values()) out.push(...passageSpeechClips(p))
  return out
}

/** Kalimat buku Ruang Baca (content/books), suara utama, satu klip per kalimat. */
export function bookClips(dir: string = findContentDir()): TtsClipRequest[] {
  return loadBooks(dir).books.flatMap((b) => bookSpeechClips(b))
}

/** Klip satu kata untuk Kamus Ketuk (content/dictionary/en-id.json). Tanpa berkas kamus, tidak ada klip tambahan. */
export function dictionaryClips(dir: string = findContentDir()): TtsClipRequest[] {
  try {
    return dictionaryWordClips(loadDictionary(dir))
  } catch {
    return []
  }
}

/**
 * Layar dunia Kira yang membacakan teks tetap: cerita (halaman tiap bab), album kartu ("Nama. Fakta"), dan kartu kilat dari
 * berkas dek (depan atau say, dan belakang yang juga bahasa Inggris). Semuanya suara utama, dipecah per kalimat seperti di layar.
 * Dek pribadi anak (buatan sendiri) bukan konten bersama: klipnya diminta lewat tts.clip dan disimpan di folder keluarga.
 */
export function worldClips(dir: string = findContentDir()): TtsClipRequest[] {
  const texts: string[] = []
  for (const ch of STORY) for (const p of ch.pages) texts.push(p.text)
  for (const c of CARDS) texts.push(`${c.name}. ${c.fact}`)
  try {
    for (const d of loadFlashcards(dir).decks) for (const c of d.cards) texts.push(c.say ?? c.front, c.back)
  } catch {
    // tanpa dek, tidak ada klip tambahan
  }
  return clipTextsOf(texts).map((text) => ({ text, style: 'teacher' as const }))
}

/** Buang klip kembar (teks dan peran sama). Urutan pertama dipertahankan. */
export function dedupe<T extends TtsClipRequest>(clips: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const c of clips) {
    const k = ttsKeyInput(c.text, c.style)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(c)
  }
  return out
}

const globalKeysByVersion = new Map<string, Set<string>>()

/**
 * Masukan kunci (ttsKeyInput) semua klip konten bersama: repo, kata ejaan, kamus, dan buku. Klip dengan kunci di sini
 * publik; teks lain dianggap milik org yang memintanya.
 */
export function globalClipKeys(version: string = TTS_VOICE_VERSION): Set<string> {
  let globalKeys = globalKeysByVersion.get(version)
  if (!globalKeys) {
    const { index } = loadContent()
    const spelling = loadSpelling(findContentDir())
    const spellingClips = Object.values(spelling.levels).flatMap((words) => spellingSpeechClips(words))
    globalKeys = new Set([...repoClips(index), ...spellingClips, ...dictionaryClips(), ...bookClips(), ...worldClips()].map((c) => ttsKeyInput(c.text, c.style, version)))
    globalKeysByVersion.set(version, globalKeys)
  }
  return globalKeys
}
