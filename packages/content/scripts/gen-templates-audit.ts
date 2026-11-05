/**
 * Ukur teks penjelasan generator: berapa pola yang berbeda bila angka diganti tanda #.
 *   tsx packages/content/scripts/gen-templates-audit.ts [--seeds 30] [--out berkas.json]
 */
import { writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { GENERATORS, genRef, generateItem } from '../src/math'
import { isDerivedSolution } from '../src/walkthrough'
import { templateOf } from '../src/translations'

const { values } = parseArgs({ options: { seeds: { type: 'string', default: '30' }, out: { type: 'string' } } })
const seeds = Number(values.seeds)
const count = new Map<string, { n: number; example: string; skills: Set<string> }>()
let total = 0
const add = (text: string, skill: string) => {
  total++
  const t = templateOf(text).template
  const c = count.get(t) ?? { n: 0, example: text, skills: new Set<string>() }
  c.n++
  c.skills.add(skill)
  count.set(t, c)
}
for (const [skill, gen] of GENERATORS) {
  for (const level of gen.levels) {
    for (let s = 0; s < seeds; s++) {
      try {
        const it = generateItem(genRef(skill, level, s.toString(36)))
        add(it.explanation, skill)
        // Langkah turunan dipecah dari penjelasan, jadi terjemahannya ikut penjelasan.
        if (!isDerivedSolution(it.solution)) for (const st of it.solution ?? []) add(st.say, skill)
      } catch {
        break
      }
    }
  }
}
const list = [...count.entries()].sort((a, b) => b[1].n - a[1].n)
let acc = 0
const at = (share: number) => {
  acc = 0
  for (let i = 0; i < list.length; i++) {
    acc += list[i]![1].n
    if (acc / total >= share) return i + 1
  }
  return list.length
}
const words = list.reduce((w, [t]) => w + t.split(/\s+/).length, 0)
console.log(`generator ${GENERATORS.size}, teks ${total}, pola ${list.length}, kata ${words}; 50% ${at(0.5)} pola, 80% ${at(0.8)}, 90% ${at(0.9)}, 95% ${at(0.95)}, 99% ${at(0.99)}`)
if (values.out) writeFileSync(values.out, JSON.stringify(list.map(([t, c]) => ({ t, n: c.n, example: c.example, skills: [...c.skills].slice(0, 3) })), null, 0))
