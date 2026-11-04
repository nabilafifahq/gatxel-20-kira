// Audit pemetaan suara: kunci klip yang diminta layar learner harus sama dengan kunci yang dibuat worker,
// dan teksnya harus sama dengan teks yang tampil di layar.
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { clipTextsOf, isClipText, speakableParts, splitClipText, spokenBlanks, styleForPassageKind, styleForSkill, ttsKeyInput, type TtsStyleId } from '../../packages/core/src/tts'
import { itemSpeechClips, passageSpeechClips } from '../../packages/content/src/speech'
import { presentItem, type ClientItem } from '../../packages/content/src/present'
import { passageSchema, type Item, type Passage } from '../../packages/content/src/schema'
import { allItems, ROOT } from './lib'

const key = (text: string, style: TtsStyleId) => createHash('sha256').update(ttsKeyInput(text, style)).digest('hex')

/** Salinan apa adanya dari apps/web/src/components/widgets/speakable-parts.ts (tidak bisa diimpor karena alias @/). */
function webParts(item: ClientItem): string[] {
  return speakableParts({
    prompt: item.prompt,
    readText: item.readText,
    options: item.options?.map((o) => o.text ?? o.figure?.alt ?? ''),
    orderItems: item.orderItems?.map((o) => o.text),
    matchLeft: item.matchLeft,
    matchRight: item.matchRight?.map((r) => r.text),
    sortGroups: item.sortGroups,
    sortItems: item.sortItems?.map((s) => s.text),
    parts: item.parts?.map((p) => ({ prompt: p.prompt, options: p.options?.map((o) => o.text ?? o.figure?.alt ?? '') })),
    tiles: item.tiles,
    cloze: item.cloze,
    labels: item.labelDiagram?.labels,
    table: item.table ? { head: item.table.head, rows: item.table.rows } : undefined,
  })
}

const passages = new Map<string, Passage>()
const walk = (d: string) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f)
    if (statSync(p).isDirectory()) walk(p)
    else if (f.endsWith('.json')) {
      const raw = JSON.parse(readFileSync(p, 'utf8'))
      for (const x of Array.isArray(raw) ? raw : raw.passages ?? [raw]) {
        const r = passageSchema.safeParse(x)
        if (r.success) passages.set(r.data.id, r.data)
      }
    }
  }
}
walk(join(ROOT, 'content', 'passages'))

let items = 0
let webClips = 0
let mapped = 0
const missing: string[] = []
const idWithAudio: string[] = []
const screenDiff: string[] = []
const sample = allItems()
for (const item of sample as Item[]) {
  items++
  const passage = item.passage ? passages.get(item.passage) : undefined
  const worker = new Set(itemSpeechClips(item).map((c) => key(c.text, c.style)))
  if (passage) for (const c of passageSpeechClips(passage)) worker.add(key(c.text, c.style))
  if (item.lang !== 'en-GB') {
    if (itemSpeechClips(item).length > 0) idWithAudio.push(item.id)
    continue
  }
  // Tiga benih: urutan acak tidak boleh membuat klip yang tidak dibuat worker.
  for (const seed of ['a', 'b', 'c']) {
    const ci = presentItem(item, { seed, includeKey: true, includeHints: true, ...(passage ? { passage } : {}) })
    const style = styleForSkill(item.skill)
    const plan = clipTextsOf(webParts(ci))
    for (const text of plan) {
      webClips++
      if (worker.has(key(text, style))) mapped++
      else missing.push(`${item.id} [${style}] "${text.slice(0, 70)}"`)
    }
    // ListenButton (soal dengar dan eja)
    if (ci.listenText) {
      for (const text of splitClipText(ci.listenText).filter(isClipText)) {
        webClips++
        if (worker.has(key(text, style))) mapped++
        else missing.push(`${item.id} listen [${style}] "${text.slice(0, 70)}"`)
      }
    }
    // PassagePanel
    if (ci.passage) {
      const pstyle = styleForPassageKind(ci.passage.kind)
      for (const text of splitClipText(ci.passage.text).filter(isClipText)) {
        webClips++
        if (worker.has(key(text, pstyle))) mapped++
        else missing.push(`${item.id} passage [${pstyle}] "${text.slice(0, 70)}"`)
      }
    }
    // Teks klip harus berasal dari teks di layar: prompt yang ditampilkan, dengan ___ dibaca "blank".
    const spoken = spokenBlanks(ci.prompt).replace(/\s+/g, ' ').trim()
    const joined = plan.join(' ').replace(/\s+/g, ' ')
    if (!joined.startsWith(spoken.slice(0, Math.min(60, spoken.length)))) screenDiff.push(`${item.id} "${spoken.slice(0, 60)}" != "${joined.slice(0, 60)}"`)
  }
}
console.log(`soal ${items}; klip diminta layar (3 benih) ${webClips}; cocok dengan batch worker ${mapped}; tidak cocok ${missing.length}`)
console.log('contoh tidak cocok:', [...new Set(missing)].slice(0, 25))
console.log('soal bahasa Indonesia yang tetap punya klip:', idWithAudio.length, idWithAudio.slice(0, 5))
console.log('prompt layar beda dengan klip:', screenDiff.length, screenDiff.slice(0, 8))
