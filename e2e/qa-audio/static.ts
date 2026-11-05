// Cakupan statis seluruh bank: soal dengar dan eja, kata Spelling Bee, dan semua soal tertulis terhadap manifest yang disajikan.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { allItems } from '../qa-soal/lib'
import { EN_VER, ROOT, clipKey, man } from './lib'
import { listenTextOf } from '../../packages/content/src/present'
import { itemSpeechClips, spellingSpeechClips } from '../../packages/content/src/speech'
import { isClipText, splitClipText, styleForSkill } from '../../packages/core/src/tts'

const items = allItems()
const has = (t: string, s: string) => man.has(clipKey(t, s, EN_VER))
const out: Record<string, unknown> = {}
const ls = { listen: { items: 0, clips: 0, missing: [] as string[] }, spell: { items: 0, clips: 0, missing: [] as string[] } }
for (const it of items) {
  if ((it.type !== 'listen' && it.type !== 'spell') || it.lang !== 'en-GB') continue
  const b = ls[it.type]
  b.items++
  const heard = listenTextOf(it)!
  for (const t of splitClipText(heard).filter(isClipText)) {
    b.clips++
    if (!has(t, styleForSkill(it.skill))) b.missing.push(`${it.id}: ${t}`)
  }
}
out.listen = { ...ls.listen, missingN: ls.listen.missing.length, missing: ls.listen.missing.slice(0, 10) }
out.spell = { ...ls.spell, missingN: ls.spell.missing.length, missing: ls.spell.missing.slice(0, 10) }

const beeWords: { word: string; sentence: string }[] = []
const walk = (d: string) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f)
    if (statSync(p).isDirectory()) walk(p)
    else if (f.endsWith('.json')) {
      const j = JSON.parse(readFileSync(p, 'utf8'))
      for (const w of j.words ?? j.items ?? []) if (w.word && w.sentence) beeWords.push({ word: w.word, sentence: w.sentence })
    }
  }
}
walk(join(ROOT, 'content/spelling'))
const bee = spellingSpeechClips(beeWords)
const beeMissing = bee.filter((c) => !has(c.text, c.style))
out.bee = { words: beeWords.length, clips: bee.length, missingN: beeMissing.length, missing: beeMissing.slice(0, 8).map((c) => `${c.style}: ${c.text}`) }

const perGrade: Record<string, { items: number; full: number; partial: number; none: number }> = {}
const badParts = new Map<string, number>()
for (const it of items) {
  if (it.lang !== 'en-GB') continue
  const g = it.id.slice(0, 2)
  const row = (perGrade[g] ??= { items: 0, full: 0, partial: 0, none: 0 })
  const clips = itemSpeechClips(it)
  const ok = clips.filter((c) => has(c.text, c.style)).length
  row.items++
  if (clips.length > 0 && ok === clips.length) row.full++
  else if (ok > 0) row.partial++
  else row.none++
  if (ok !== clips.length) for (const c of clips) if (!has(c.text, c.style)) badParts.set(it.type, (badParts.get(it.type) ?? 0) + 1)
}
out.bank = perGrade
out.missingByType = Object.fromEntries(badParts)
console.log(JSON.stringify(out, null, 1))
