// Cakupan tombol baca soal generator pada set staging, pada benih yang tidak dipakai untuk membuat daftar. Kelas 1 sampai 6, sebelum dan sesudah.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { EN_VER, clipKey, man } from './lib'
import { generateUncached, genRef, GENERATORS } from '../../packages/content/src/math'
import { listenTextOf } from '../../packages/content/src/present'
import { speakableFieldsOf } from '../../packages/content/src/speech'
import { clipTextsOf, isClipText, speakableParts, splitClipText, styleForSkill } from '../../packages/core/src/tts'

const DIR = process.env.QA_STAGING ?? 'C:/kw4/tts-piper2/tts'
const V2 = process.env.QA_VERSION ?? 'piper-lessac-medium-2'
const HOLDOUT = Number(process.env.QA_HOLDOUT ?? 300)
const after = new Set(readFileSync(join(DIR, `manifest-${V2}.jsonl`), 'utf8').split('\n').filter(Boolean).map((l) => (JSON.parse(l) as { key: string }).key))
for (const grade of (process.env.QA_GRADES ?? '1,2,3').split(',')) {
  const perLevel: Record<string, { n: number; before: number; after: number }> = {}
  const perSkill: Record<string, { n: number; before: number; after: number }> = {}
  let n = 0
  let b = 0
  let a = 0
  for (const g of GENERATORS.values()) {
    if (!new RegExp(`^[mes]${grade}\\.`).test(g.skill)) continue
    const style = styleForSkill(g.skill)
    for (const level of g.levels) {
      for (let i = 0; i < HOLDOUT; i++) {
        const it = generateUncached(genRef(g.skill, level, `z${i.toString(36)}`))
        const heard = listenTextOf(it)
        const texts = [...clipTextsOf(speakableParts(speakableFieldsOf(it))), ...(heard ? splitClipText(heard).filter(isClipText) : [])]
        const hasB = texts.every((t) => man.has(clipKey(t, style, EN_VER)))
        const hasA = texts.every((t) => after.has(clipKey(t, style, V2)))
        n++
        b += Number(hasB)
        a += Number(hasA)
        const lv = (perLevel[`tingkat ${level}`] ??= { n: 0, before: 0, after: 0 })
        const sk = (perSkill[g.skill] ??= { n: 0, before: 0, after: 0 })
        for (const r of [lv, sk]) {
          r.n++
          r.before += Number(hasB)
          r.after += Number(hasA)
        }
      }
    }
  }
  const pct = (x: number, y: number) => Math.round((1000 * x) / y) / 10
  console.log(`kelas ${grade}: soal ${n}, tombol sebelum ${pct(b, n)}%, sesudah ${pct(a, n)}%`)
  console.log('  ', Object.entries(perLevel).map(([k, r]) => `${k}: ${pct(r.before, r.n)}>${pct(r.after, r.n)}`).join(' | '))
  console.log('   terendah:', Object.entries(perSkill).sort((x, y) => x[1].after / x[1].n - y[1].after / y[1].n).slice(0, 6).map(([k, r]) => `${k} ${pct(r.after, r.n)}`).join(' | '))
}
