// Kalimat soal generator yang dibacakan: per kelas, tingkat, dan generator. Benih tetap untuk daftar, benih lain untuk mengukur cakupan.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { EN_VER, OUT, clipKey, man } from './lib'
import { generateUncached, genRef, GENERATORS } from '../../packages/content/src/math'
import { listenTextOf } from '../../packages/content/src/present'
import { speakableFieldsOf } from '../../packages/content/src/speech'
import { clipTextsOf, isClipText, speakableParts, splitClipText, styleForSkill } from '../../packages/core/src/tts'
import type { Item } from '../../packages/content/src/schema'

const SEEDS = Number(process.env.QA_SEEDS ?? 5000)
const HOLDOUT = Number(process.env.QA_HOLDOUT ?? 500)
const GRADES = (process.env.QA_GRADES ?? '1,2').split(',')

/** Klip yang harus ada supaya tombol baca tampil: sama dengan isi speakableClipParts di layar. */
function questionClips(it: Item, style: string): { text: string; style: string }[] {
  const out = clipTextsOf(speakableParts(speakableFieldsOf(it))).map((text) => ({ text, style }))
  const heard = listenTextOf(it)
  if (heard) for (const text of splitClipText(heard)) if (isClipText(text)) out.push({ text, style })
  return out
}
const solutionClips = (it: Item): string[] => (it.solution ?? []).flatMap((s) => splitClipText(s.say)).filter(isClipText)

type Row = { skill: string; level: number; seeds: number; distinct: number; newLast20: number; fails: number; ms: number }
const report: Record<string, unknown> = { seeds: SEEDS, holdout: HOLDOUT }
const allClips = new Map<string, { text: string; style: string; grade: string }>()
for (const grade of GRADES) {
  const rows: Row[] = []
  const gradeClips = new Set<string>()
  const solutions = new Set<string>()
  const gens = [...GENERATORS.values()].filter((g) => new RegExp(`^[mes]${grade}\\.`).test(g.skill))
  for (const g of gens) {
    const style = styleForSkill(g.skill)
    for (const level of g.levels) {
      const t0 = Date.now()
      const seen = new Set<string>()
      let newLast = 0
      let fails = 0
      for (let i = 0; i < SEEDS; i++) {
        let it: Item
        try {
          it = generateUncached(genRef(g.skill, level, i.toString(36)))
        } catch {
          fails++
          continue
        }
        for (const c of questionClips(it, style)) {
          const k = `${c.style}|${c.text}`
          if (!seen.has(k)) {
            seen.add(k)
            if (i >= SEEDS * 0.8) newLast++
          }
          gradeClips.add(k)
          if (!allClips.has(k)) allClips.set(k, { ...c, grade })
        }
        for (const s of solutionClips(it)) solutions.add(`teacher|${s}`)
      }
      rows.push({ skill: g.skill, level, seeds: SEEDS, distinct: seen.size, newLast20: newLast, fails, ms: Date.now() - t0 })
    }
  }
  const missing = [...gradeClips].filter((k) => {
    const [style, ...rest] = k.split('|')
    return !man.has(clipKey(rest.join('|'), style!, EN_VER))
  })
  const solutionMissing = [...solutions].filter((k) => !man.has(clipKey(k.slice('teacher|'.length), 'teacher', EN_VER)))
  const open = rows.filter((r) => r.newLast20 > 0)
  report[`g${grade}`] = {
    generators: gens.length,
    levels: rows.length,
    distinctQuestionClips: gradeClips.size,
    notInManifest: missing.length,
    distinctSolutionClips: solutions.size,
    solutionNotInManifest: solutionMissing.length,
    levelsSaturated: rows.length - open.length,
    levelsStillGrowing: open.length,
    biggest: [...rows].sort((a, b) => b.distinct - a.distinct).slice(0, 12).map((r) => `${r.skill}:${r.level}=${r.distinct} (+${r.newLast20})`),
    fails: rows.reduce((a, r) => a + r.fails, 0),
    seconds: Math.round(rows.reduce((a, r) => a + r.ms, 0) / 1000),
  }
  console.log(`g${grade}`, JSON.stringify(report[`g${grade}`]))
  writeFileSync(join(OUT, `gen-count-g${grade}.json`), JSON.stringify(rows))
}

// Cakupan pada benih yang tidak dipakai untuk daftar: soal yang semua klipnya ada, sebelum dan sesudah daftar ditambahkan.
for (const grade of GRADES) {
  const gens = [...GENERATORS.values()].filter((g) => new RegExp(`^[mes]${grade}\\.`).test(g.skill))
  let n = 0
  let before = 0
  let after = 0
  const lv: Record<string, { n: number; before: number; after: number }> = {}
  for (const g of gens) {
    const style = styleForSkill(g.skill)
    for (const level of g.levels) {
      const row = (lv[g.skill] ??= { n: 0, before: 0, after: 0 })
      for (let i = 0; i < HOLDOUT; i++) {
        let it: Item
        try {
          it = generateUncached(genRef(g.skill, level, `h${i.toString(36)}`))
        } catch {
          continue
        }
        const clips = questionClips(it, style)
        const has = clips.every((c) => man.has(clipKey(c.text, c.style, EN_VER)))
        const hasAfter = has || clips.every((c) => man.has(clipKey(c.text, c.style, EN_VER)) || allClips.has(`${c.style}|${c.text}`))
        n++
        row.n++
        if (has) {
          before++
          row.before++
        }
        if (hasAfter) {
          after++
          row.after++
        }
      }
    }
  }
  const worst = Object.entries(lv).sort((a, b) => a[1].after / a[1].n - b[1].after / b[1].n).slice(0, 10).map(([s, r]) => `${s} ${Math.round((100 * r.after) / r.n)}%`)
  report[`coverage-g${grade}`] = { questions: n, buttonBefore: before, buttonAfter: after, pctBefore: Math.round((1000 * before) / n) / 10, pctAfter: Math.round((1000 * after) / n) / 10, worst }
  console.log(`cakupan g${grade}`, JSON.stringify(report[`coverage-g${grade}`]))
}
const fresh = [...allClips.values()].filter((c) => !man.has(clipKey(c.text, c.style, EN_VER)))
report.totalDistinct = allClips.size
report.totalNew = fresh.length
report.freshByGrade = fresh.reduce<Record<string, number>>((a, c) => ((a[c.grade] = (a[c.grade] ?? 0) + 1), a), {})
writeFileSync(join(OUT, 'gen-clips.json'), JSON.stringify(fresh))
writeFileSync(join(OUT, 'gen-count.json'), JSON.stringify(report, null, 1))
console.log('total', allClips.size, 'baru', fresh.length, JSON.stringify(report.freshByGrade))
