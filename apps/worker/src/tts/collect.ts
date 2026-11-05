import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { findContentDir, loadContent, type ContentIndex } from '@kira/content/load'
import { loadSpelling } from '@kira/content/spelling'
import type { Item } from '@kira/content/schema'
import { bookSpeechClips, loadBooks } from '@kira/content/books'
import { loadDictionary } from '@kira/content/dictionary'
import { itemSpeechClips, lessonSpeechClips, passageSpeechClips, spellingSpeechClips } from '@kira/content/speech'
import { dictionaryWordClips } from '@kira/core/dictionary'
import { loadFlashcards } from '@kira/content/flashcards'
import { CARDS, STORY } from '@kira/core'
import { clipTextsOf, spokenIndonesian, TTS_FIXED_LINES, TTS_VOICE_VERSION, ttsKeyInput, type TtsClipRequest } from '@kira/core/tts'
import { collectSourceTexts, loadTranslations, loadVoiceHeld, lookupTranslation, readTranslationFile, TRANSLATION_DIR, translationHash, type SourceText } from '@kira/content/translations'

/**
 * Kumpulkan semua teks bahasa Inggris yang dibacakan layar learner, dengan gaya yang sama persis
 * dengan yang dipakai web (apps/web/src/components/learner/speech.ts). Aturan teks dan gaya ada di
 * packages/core/src/tts.ts dan packages/content/src/speech.ts supaya kedua sisi menghasilkan kunci klip yang sama.
 */

export const itemClips = (item: Item): TtsClipRequest[] => itemSpeechClips(item)

/**
 * Bentuk ucapan satu teks terjemahan: istilah Inggris di dalam kurung (`ulat (caterpillar)`) tidak dibacakan, karena suara
 * Indonesia membacanya dengan bunyi Indonesia. Teks di layar dan kuncinya tidak berubah. Kurung berisi arti Indonesia
 * (`sweet (manis)`) atau angka tetap dibacakan: sebuah kurung hanya dibuang bila semua katanya ada di teks Inggris sumbernya.
 */
export function withoutEnglishGloss(id: string, en: string): string {
  const source = (en.toLowerCase().match(/[a-z]+/g) ?? []).filter((w) => w.length >= 3)
  const known = (w: string) => source.some((s) => s === w || (w.length >= 3 && (s.startsWith(w) || w.startsWith(s))))
  return id
    .replace(/\s*\(([^()]*)\)/g, (whole, inner: string) => {
      if (/\d/.test(inner)) return whole
      const words = inner.toLowerCase().match(/[a-z]+/g) ?? []
      return words.length > 0 && words.every(known) ? '' : whole
    })
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Klip Indonesia beserta bentuk ucapannya. */
export type IdClip = TtsClipRequest & { spoken: string }

/**
 * Klip suara Indonesia dari terjemahan penjelasan. Peran selalu `indonesian`, dan hanya teks hasil terjemahan yang masuk, jadi teks
 * Inggris tidak pernah sampai ke suara Indonesia. Dipisah dari repoClips: set Inggris tidak ikut berubah. Urutan: jenis yang diminta dulu.
 */
export function translationClips(dir: string = findContentDir(), kinds: readonly SourceText['kind'][] = ['lesson', 'explanation', 'solution', 'tip', 'why']): IdClip[] {
  const { map } = loadTranslations(dir)
  const sources = collectSourceTexts(dir, new Set(kinds))
  // Terjemahan yang memuat kata Inggris di luar kurung tidak dibuatkan klip: anak tidak boleh mendengar pelafalan yang salah.
  const held = loadVoiceHeld(dir)
  const seen = new Set<string>()
  const out: IdClip[] = []
  // Kalimat tetap buatan kode untuk langkah pembahasan turunan.
  const shared = join(dir, TRANSLATION_DIR, '_shared.json')
  if (existsSync(shared)) {
    for (const e of Object.values(readTranslationFile(shared).entries)) {
      for (const text of clipTextsOf([e.id])) {
        if (seen.has(text)) continue
        seen.add(text)
        out.push({ text, style: 'indonesian', spoken: spokenIndonesian(text) })
      }
    }
  }
  for (const kind of kinds) {
    for (const f of sources) {
      for (const t of f.texts) {
        if (t.kind !== kind) continue
        const id = lookupTranslation(map, t.en)
        if (!id || held.has(translationHash(id))) continue
        for (const text of clipTextsOf([id])) {
          if (seen.has(text)) continue
          seen.add(text)
          out.push({ text, style: 'indonesian', spoken: spokenIndonesian(withoutEnglishGloss(text, t.en)) })
        }
      }
    }
  }
  return out
}

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
