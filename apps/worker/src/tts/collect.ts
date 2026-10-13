import type { ContentIndex } from '@kira/content/load'
import type { Item, Lesson, Passage } from '@kira/content/schema'
import { clipTextsOf, isClipText, speakableParts, splitClipText, styleForPassageKind, styleForSkill, TTS_FIXED_LINES, ttsKeyInput, type SpeakableFields, type TtsClipRequest, type TtsStyleId } from '@kira/core/tts'

/**
 * Kumpulkan semua teks bahasa Inggris yang dibacakan layar learner, dengan gaya yang sama persis
 * dengan yang dipakai web (apps/web/src/components/learner/speech.ts). Aturan teks dan gaya ada di
 * packages/core/src/tts.ts supaya kedua sisi menghasilkan kunci klip yang sama.
 */

function fieldsOf(item: Item): SpeakableFields {
  const f: SpeakableFields = { prompt: item.prompt }
  switch (item.type) {
    case 'mcq':
    case 'multi':
      f.options = item.options.map((o) => o.text ?? o.figure?.alt ?? '')
      break
    case 'order':
      f.orderItems = item.items
      break
    case 'match':
      f.matchLeft = item.pairs.map(([l]) => l)
      f.matchRight = item.pairs.map(([, r]) => r)
      break
    case 'sort':
      f.sortGroups = item.groups
      f.sortItems = item.items.map((i) => i.text)
      break
    case 'speak':
      if (item.readText) f.readText = item.readText
      break
    default:
      break
  }
  return f
}

export function itemClips(item: Item): TtsClipRequest[] {
  if (item.lang !== 'en-GB') return []
  const style = styleForSkill(item.skill)
  const out: TtsClipRequest[] = clipTextsOf(speakableParts(fieldsOf(item))).map((text) => ({ text, style }))
  // Langkah pembahasan dibacakan SolutionPlayer dengan gaya guru.
  for (const step of item.solution ?? []) for (const text of splitClipText(step.say)) if (isClipText(text)) out.push({ text, style: 'teacher' })
  return out
}

export function lessonClips(lesson: Lesson): TtsClipRequest[] {
  const out: TtsClipRequest[] = []
  for (const step of lesson.steps) for (const text of splitClipText(step.say)) if (isClipText(text)) out.push({ text, style: 'teacher' })
  for (const c of lesson.check) out.push(...itemClips(c))
  return out
}

export function passageClips(p: Passage): TtsClipRequest[] {
  if (p.lang !== 'en-GB') return []
  const style = styleForPassageKind(p.kind)
  return splitClipText(p.text).filter(isClipText).map((text) => ({ text, style }))
}

const SUBJECT_ORDER = ['e', 'm', 's'] as const

/** Klip dari konten repo, berurutan: English dulu, lalu Science, lalu Math, tiap mapel dari kelas rendah. */
export function repoClips(index: ContentIndex): TtsClipRequest[] {
  const out: TtsClipRequest[] = [...TTS_FIXED_LINES]
  const rank = (id: string) => `${SUBJECT_ORDER.indexOf(id[0] as 'e' | 'm' | 's') === 0 ? 0 : id[0] === 's' ? 1 : 2}${id[1]}`
  const skillIds = [...index.skills.keys()].sort((a, b) => rank(a).localeCompare(rank(b)) || a.localeCompare(b))
  for (const id of skillIds) {
    for (const item of index.itemsBySkill.get(id) ?? []) out.push(...itemClips(item))
    const lesson = index.lessons.get(id)
    if (lesson) out.push(...lessonClips(lesson))
  }
  for (const p of index.passages.values()) out.push(...passageClips(p))
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

export type { TtsStyleId }
