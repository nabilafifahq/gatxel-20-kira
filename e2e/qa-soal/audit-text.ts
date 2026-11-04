// Audit teks soal: markup mentah, notasi matematika, tanda hubung panjang, dan jenis figur yang dipakai.
import { allItems } from './lib'
import { GENERATORS, generateItem, genRef } from '../../packages/content/src/math'
import type { Item } from '../../packages/content/src/schema'

const hits: Record<string, string[]> = {}
const add = (k: string, v: string) => {
  ;(hits[k] ??= []).push(v)
}
const RAW: [string, RegExp][] = [
  ['latex', /\\(frac|sqrt|times|div|cdot|left|right)|\$[^ ]+\$/],
  ['caret', /\d\s*\^\s*\d/],
  ['html', /<\/?(sup|sub|b|i|br|span|div|p)\b|&[a-z]+;|&#\d+;/i],
  ['markdown', /\*\*[^*]+\*\*|__[a-z]/i],
  ['kurung kurawal', /[{}]/],
  ['undefined', /\b(undefined|NaN|null|\[object)\b/],
  ['titik dua kali', /\.\.(?!\.)/],
  ['spasi ganda', / {2,}/],
]
const texts = (it: Item): string[] => {
  const a = it as unknown as Record<string, unknown>
  const out = [it.prompt, it.explanation, ...it.hints, ...(it.tip ? [it.tip] : [])]
  for (const o of (a.options as { text?: string }[] | undefined) ?? []) if (o.text) out.push(o.text)
  for (const p of (Array.isArray(a.parts) ? a.parts : []) as { prompt: string; options?: { text?: string }[] }[]) {
    out.push(p.prompt)
    for (const o of p.options ?? []) if (o.text) out.push(o.text)
  }
  for (const s of it.solution ?? []) {
    out.push(s.say)
    if (s.show) out.push(s.show)
  }
  return out
}
const scan = (it: Item) => {
  for (const t of texts(it)) for (const [k, re] of RAW) if (re.test(t)) add(k, `${it.id}: ${t.slice(0, 80)}`)
}
const items = allItems()
items.forEach(scan)
let gens = 0
for (const [skill, g] of GENERATORS) {
  for (const lv of g.levels) {
    for (let s = 0; s < 6; s++) {
      gens++
      try {
        scan(generateItem(genRef(skill, lv, `t${s}`)))
      } catch (e) {
        add('generator gagal', `${skill}:${lv} ${String(e).slice(0, 80)}`)
      }
    }
  }
}
console.log(`soal ${items.length}, contoh generator ${gens}`)
for (const [k, v] of Object.entries(hits)) console.log(`\n## ${k}: ${v.length}\n${[...new Set(v)].slice(0, 8).join('\n')}`)

// Notasi yang dipakai
const sup = items.filter((i) => /[²³⁴]/.test(i.prompt)).length
const frac = items.filter((i) => /\d\/\d/.test(i.prompt)).length
const uni = items.filter((i) => /[½¼¾⅓⅔]/.test(i.prompt)).length
console.log(`\nprompt berpangkat unicode ${sup}, pecahan 1/2 ${frac}, pecahan unicode ${uni}`)
const kinds: Record<string, number> = {}
for (const i of items) {
  const f = i.figure as { kind?: string } | undefined
  if (f?.kind) kinds[f.kind] = (kinds[f.kind] ?? 0) + 1
}
console.log('jenis figur', JSON.stringify(kinds))
