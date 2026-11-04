// Cakupan klip: untuk tiap sumber teks yang bisa dibacakan, apakah berkas klipnya ada di folder data stack?
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { ttsKeyInput, type TtsClipRequest } from '../../packages/core/src/tts'
import { spellingSpeechClips } from '../../packages/content/src/speech'
import { loadContent } from '../../packages/content/src/load'
import { bookClips, dictionaryClips, repoClips, worldClips } from '../../apps/worker/src/tts/collect'
import { createHash } from 'node:crypto'

const DIR = 'C:/kw5/akhir-stack/data/tts'
const V = 'piper-lessac-medium'
const has = (c: TtsClipRequest) => existsSync(join(DIR, `${createHash('sha256').update(ttsKeyInput(c.text, c.style, V)).digest('hex')}.mp3`))
const { index } = loadContent()
const groups: [string, TtsClipRequest[]][] = [
  ['soal, bacaan, pelajaran', repoClips(index)],
  ['buku', bookClips()],
  ['kamus', dictionaryClips()],
  ['kartu dunia', worldClips()],
]
try {
  const spelling = (index as unknown as { spelling?: { levels: Record<string, { word: string; sentence: string }[]> } }).spelling
  if (spelling) groups.push(['eja', Object.values(spelling.levels).flatMap((w) => spellingSpeechClips(w))])
} catch {
  // lewati
}
for (const [name, list] of groups) {
  const uniq = [...new Map(list.map((c) => [`${c.style}|${c.text}`, c])).values()]
  const miss = uniq.filter((c) => !has(c))
  console.log(`${name}: ${uniq.length} klip, hilang ${miss.length}`, miss.slice(0, 6).map((c) => `[${c.style}] ${c.text.slice(0, 50)}`))
}
