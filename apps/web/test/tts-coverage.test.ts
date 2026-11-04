import { join } from 'node:path'
import { expect, it } from 'vitest'
import { presentItem } from '@kira/content/present'
import { loadContent } from '@kira/content/load'
import { itemSpeechClips } from '@kira/content/speech'
import { loadFlashcards } from '@kira/content/flashcards'
import { clipTextsOf, ttsKeyInput } from '@kira/core/tts'
import { worldClips } from '../../worker/src/tts/collect'
import { clipPlan } from '@/components/learner/tts-client'
import { speakableClipParts, speakableStyle } from '@/components/widgets/speakable-parts'

// Tanpa suara perangkat, tombol baca hanya berbunyi bila klipnya ada. Uji ini menjaga: semua teks yang diminta tombol baca untuk soal
// (semua mapel, dua urutan opsi) dan kartu kilat dari berkas dek sudah termasuk set klip yang dibuat batch.
it('cakupan klip untuk tombol baca', () => {
  const dir = join(__dirname, '../../../content')
  const { index } = loadContent(dir)
  const bySubject: Record<string, { items: number; asked: number; missing: number }> = {}
  const examples: string[] = []
  for (const item of index.items.values()) {
    if (item.lang !== 'en-GB') continue
    const s = item.id[0]!
    const b = (bySubject[s] ??= { items: 0, asked: 0, missing: 0 })
    b.items++
    for (const seed of ['a', 'b']) {
      const client = presentItem(item, { seed, includeKey: true, includeHints: true })
      const asked = clipPlan(speakableClipParts(client), speakableStyle(client)).map((c) => ttsKeyInput(c.text, c.style))
      const batch = new Set(itemSpeechClips(item).map((c) => ttsKeyInput(c.text, c.style)))
      for (const k of asked) {
        b.asked++
        if (!batch.has(k)) {
          b.missing++
          if (examples.length < 5) examples.push(`${item.id}: ${k.slice(0, 70)}`)
        }
      }
    }
  }
  expect(examples).toEqual([])
  for (const b of Object.values(bySubject)) expect(b.missing).toBe(0)
  const decks = loadFlashcards(dir).decks
  const world = new Set(worldClips(dir).map((c) => ttsKeyInput(c.text, c.style)))
  let cards = 0
  let miss = 0
  for (const d of decks) for (const c of d.cards) for (const t of [c.say ?? c.front, c.back]) for (const x of clipTextsOf([t])) {
    cards++
    if (!world.has(ttsKeyInput(x, 'teacher'))) miss++
  }
  expect(cards).toBeGreaterThan(0)
  expect(miss).toBe(0)
})
