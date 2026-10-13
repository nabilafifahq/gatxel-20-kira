import type { ContentIndex } from '@kira/content/load'
import type { Item } from '@kira/content/schema'
import { itemSpeechClips, lessonSpeechClips, passageSpeechClips } from '@kira/content/speech'
import { TTS_FIXED_LINES, ttsKeyInput, type TtsClipRequest } from '@kira/core/tts'

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

/** Buang klip kembar (teks dan gaya sama). Urutan pertama dipertahankan. */
export function dedupe(clips: TtsClipRequest[]): TtsClipRequest[] {
  const seen = new Set<string>()
  const out: TtsClipRequest[] = []
  for (const c of clips) {
    const k = ttsKeyInput(c.text, c.style)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(c)
  }
  return out
}
