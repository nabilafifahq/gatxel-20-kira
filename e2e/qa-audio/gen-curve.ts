// Cakupan tombol baca pada benih baru bila hanya N klip generator teratas yang dibuat.
import { generatorClips } from '../../apps/worker/src/tts/collect'
import { EN_VER, clipKey, man } from './lib'
import { generateUncached, genRef, GENERATORS } from '../../packages/content/src/math'
import { listenTextOf } from '../../packages/content/src/present'
import { speakableFieldsOf } from '../../packages/content/src/speech'
import { clipTextsOf, isClipText, speakableParts, splitClipText, styleForSkill } from '../../packages/core/src/tts'

const GRADE = process.env.QA_GRADE ?? '1'
const SEEDS = Number(process.env.QA_SEEDS ?? 5000)
const HOLDOUT = Number(process.env.QA_HOLDOUT ?? 300)
const list = generatorClips([Number(GRADE)], SEEDS)
const rank = new Map(list.map((c, i) => [`${c.style}|${c.text}`, i]))
const inMan = (t: string, s: string) => man.has(clipKey(t, s, EN_VER))
const fresh = list.filter((c) => !inMan(c.text, c.style)).length
// Untuk tiap soal: urutan klip tertinggi yang dibutuhkan. Soal tampil bila N melewati urutan itu.
const needs: number[] = []
const bySkill = new Map<string, number[]>()
for (const g of GENERATORS.values()) {
  if (!new RegExp(`^[mes]${GRADE}\\.`).test(g.skill)) continue
  const style = styleForSkill(g.skill)
  for (const level of g.levels) {
    for (let i = 0; i < HOLDOUT; i++) {
      const it = generateUncached(genRef(g.skill, level, `h${i.toString(36)}`))
      const heard = listenTextOf(it)
      const texts = [...clipTextsOf(speakableParts(speakableFieldsOf(it))), ...(heard ? splitClipText(heard).filter(isClipText) : [])]
      let top = -1
      for (const t of texts) {
        if (inMan(t, style)) continue
        const r = rank.get(`${style}|${t}`)
        top = Math.max(top, r === undefined ? Number.MAX_SAFE_INTEGER : r)
      }
      needs.push(top)
      const row = bySkill.get(`${g.skill}:${level}`) ?? []
      row.push(top)
      bySkill.set(`${g.skill}:${level}`, row)
    }
  }
}
const pct = (n: number) => Math.round((1000 * needs.filter((v) => v < n).length) / needs.length) / 10
console.log(`kelas ${GRADE}: daftar ${list.length}, baru ${fresh}, soal uji ${needs.length}`)
console.log(JSON.stringify(Object.fromEntries([0, 1000, 2000, 3000, 4000, 6000, 8000, 10000, 12000, 15000, 18000, 21000, 24000, 27000, list.length].map((n) => [n, pct(n)]))))
for (const n of [8000, 12000, 15000, 18000, list.length]) {
  const lowLv = [...bySkill.entries()].map(([k, a]) => [k, Math.round((100 * a.filter((v) => v < n).length) / a.length)] as const).sort((a, b) => a[1] - b[1]).slice(0, 6)
  console.log(n, JSON.stringify(lowLv))
}
