import type { ClientItem } from '@kira/content/present'
import { speakableParts, styleForSkill, type TtsStyleId } from '@kira/core/tts'

/**
 * Bagian soal yang dibacakan, untuk klip suara Qwen: prompt, lalu tiap opsi dengan penanda hurufnya.
 * Setiap bagian menjadi klipnya sendiri, jadi urutan opsi yang diacak tidak membuat klip baru. Isinya harus
 * sama dengan packages/content/src/speech.ts (sisi worker). Jenis soal baru yang punya teks bacaan sendiri
 * ditambahkan di kedua tempat itu. `speakableText` (speakable.ts) tetap dipakai sebagai teks cadangan.
 */
export function speakableClipParts(item: ClientItem): string[] {
  return speakableParts({
    prompt: item.prompt,
    readText: item.readText,
    options: item.options?.map((o) => o.text ?? o.figure?.alt ?? ''),
    orderItems: item.orderItems?.map((o) => o.text),
    matchLeft: item.matchLeft,
    matchRight: item.matchRight?.map((r) => r.text),
    sortGroups: item.sortGroups,
    sortItems: item.sortItems?.map((s) => s.text),
  })
}

/** Gaya suara untuk soal ini: soal ejaan dan dikte dibacakan pelan dan jelas, lainnya oleh guru. */
export function speakableStyle(item: Pick<ClientItem, 'skill'>): TtsStyleId {
  return styleForSkill(item.skill)
}
