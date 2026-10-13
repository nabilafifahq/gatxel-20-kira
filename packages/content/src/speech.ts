import { clipTextsOf, isClipText, speakableParts, splitClipText, styleForPassageKind, styleForSkill, type SpeakableFields, type TtsClipRequest } from '@kira/core/tts'
import type { Item, Lesson, Passage } from './schema'

/**
 * Teks bahasa Inggris yang dibacakan layar learner, dari bentuk konten (Item, Lesson, Passage). Web memakainya
 * untuk menyiapkan klip hari ini, worker untuk membuat semua klip. Aturan teks dan gaya ada di
 * packages/core/src/tts.ts supaya kunci klip dari kedua sisi dan dari layar learner (speech.ts) sama.
 */

export function speakableFieldsOf(item: Item): SpeakableFields {
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

/** Klip soal: prompt, opsi, dan langkah pembahasan. Soal berbahasa Indonesia tidak dibacakan. */
export function itemSpeechClips(item: Item): TtsClipRequest[] {
  if (item.lang !== 'en-GB') return []
  const style = styleForSkill(item.skill)
  const out: TtsClipRequest[] = clipTextsOf(speakableParts(speakableFieldsOf(item))).map((text) => ({ text, style }))
  // Langkah pembahasan dibacakan SolutionPlayer dengan gaya guru.
  for (const step of item.solution ?? []) for (const text of splitClipText(step.say)) if (isClipText(text)) out.push({ text, style: 'teacher' })
  return out
}

export function lessonSpeechClips(lesson: Lesson): TtsClipRequest[] {
  const out: TtsClipRequest[] = []
  for (const step of lesson.steps) for (const text of splitClipText(step.say)) if (isClipText(text)) out.push({ text, style: 'teacher' })
  for (const c of lesson.check) out.push(...itemSpeechClips(c))
  return out
}

export function passageSpeechClips(p: Pick<Passage, 'kind' | 'text' | 'lang'>): TtsClipRequest[] {
  if (p.lang !== 'en-GB') return []
  const style = styleForPassageKind(p.kind)
  return splitClipText(p.text).filter(isClipText).map((text) => ({ text, style }))
}

/** Kata Spelling Bee: kata dan kalimat contohnya, keduanya dengan suara dikte. */
export function spellingSpeechClips(words: readonly { word: string; sentence: string }[]): TtsClipRequest[] {
  return words.flatMap((w) => [
    { text: w.word, style: 'dictation' as const },
    ...splitClipText(w.sentence).map((text) => ({ text, style: 'dictation' as const })),
  ])
}
