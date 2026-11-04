import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { splitClipText, isClipText, ttsKeyInput, TTS_DEFAULT_STYLE } from '../../packages/core/src/tts'
const DIR = 'C:/kw5/akhir-stack/data/tts'
const V = 'piper-lessac-medium'
const has = (t: string) => existsSync(join(DIR, `${createHash('sha256').update(ttsKeyInput(t, TTS_DEFAULT_STYLE, V)).digest('hex')}.mp3`))
const tally: Record<string, { n: number; miss: number; ex: string[] }> = {}
const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (f.endsWith('.json')) {
  const j = JSON.parse(readFileSync(p, 'utf8')); const k = j.subject as string; const t = (tally[k] ??= { n: 0, miss: 0, ex: [] })
  for (const c of j.cards ?? []) for (const s of [c.front, c.say ?? c.back]) { if (typeof s !== 'string') continue; for (const x of splitClipText(s).filter(isClipText)) { t.n++; if (!has(x)) { t.miss++; if (t.ex.length < 4) t.ex.push(x.slice(0, 40)) } } }
} } }
walk('C:/kw5/akhir-anak/content/flashcards')
console.log(JSON.stringify(tally))
