import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { presentItem } from '@kira/content/present'
import { loadContent } from '@kira/content/load'
import { itemSpeechClips } from '@kira/content/speech'
import { ttsKeyInput } from '@kira/core/tts'
import { clipKey, clipPlan, deviceText } from '@/components/learner/tts-client'
import { speakableClipParts, speakableStyle } from '@/components/widgets/speakable-parts'

const { index } = loadContent(join(__dirname, '../../../content'))

describe('klip suara: sisi web sama dengan sisi worker', () => {
  it('kunci SubtleCrypto sama dengan sha256 node', async () => {
    const k = await clipKey('Which word is missing?', 'teacher')
    expect(k).toBe(createHash('sha256').update(ttsKeyInput('Which word is missing?', 'teacher')).digest('hex'))
  })

  it('setiap klip yang diminta layar sudah termasuk klip yang dibuat batch, untuk semua soal English dan Science', () => {
    let checked = 0
    for (const item of index.items.values()) {
      if (item.lang !== 'en-GB' || item.id[0] === 'm') continue
      // Dua seed berbeda: urutan opsi yang diacak tidak boleh menghasilkan klip baru.
      for (const seed of ['a', 'b']) {
        const client = presentItem(item, { seed, includeKey: true, includeHints: true })
        const asked = clipPlan(speakableClipParts(client), speakableStyle(client)).map((c) => ttsKeyInput(c.text, c.style))
        const batch = new Set(itemSpeechClips(item).map((c) => ttsKeyInput(c.text, c.style)))
        for (const k of asked) expect(batch.has(k), `${item.id}: ${k.slice(0, 80)}`).toBe(true)
        // Teks dengar soal dengar dan eja diputar ListenButton dengan gaya soal: klipnya harus ikut dibuat batch.
        if (client.listenText) {
          const heard = clipPlan(client.listenText, speakableStyle(client)).map((c) => ttsKeyInput(c.text, c.style))
          expect(heard.length, item.id).toBeGreaterThan(0)
          for (const k of heard) expect(batch.has(k), `${item.id} listenText: ${k.slice(0, 80)}`).toBe(true)
        }
      }
      checked++
    }
    expect(checked).toBeGreaterThan(1500)
  })

  it('suara perangkat membaca semua bagian dengan jeda', () => {
    expect(deviceText(['Pick one', 'Option A.', 'cat'])).toBe('Pick one. Option A. cat.')
    expect(deviceText('Hello there.')).toBe('Hello there.')
  })
})
