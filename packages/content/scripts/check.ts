import { checkDictionary } from '../src/dictionary'
import { checkExtras } from '../src/extras'
import { checkGenerators, findContentDir, loadContent } from '../src/load'
import { SUBJECTS } from '../src/schema'
import { GENERATORS } from '../src/math'
import { loadSpelling } from '../src/spelling'
import { loadFlashcards } from '../src/flashcards'

const dir = findContentDir()
const started = Date.now()
const scopeArg = process.argv.find((a) => a.startsWith('--scope='))
const scopes = scopeArg ? scopeArg.slice('--scope='.length).split(',').filter(Boolean) : []
const inScope = (p: { file: string; message: string }) =>
  scopes.length === 0 || scopes.some((s) => p.file.includes(s) || p.message.includes(s))
const loaded = loadContent(dir)
const { index } = loaded
const errors = loaded.errors.filter(inScope)
const warnings = loaded.warnings.filter(inScope)
const genProblems = checkGenerators(index.skills, Number(process.env.SEEDS ?? 25)).filter(inScope)
const spelling = loadSpelling(dir)
const extraProblems = checkExtras(dir, index).filter(inScope)
const cards = loadFlashcards(dir)
const dictProblems = checkDictionary(dir, new Map([...index.skills].map(([id, sk]) => [id, sk.strand]))).filter(inScope)
const allErrors = [...errors, ...cards.errors.filter(inScope), ...genProblems, ...spelling.errors.filter(inScope), ...extraProblems, ...dictProblems]
if (scopes.length) console.log(`Scope: ${scopes.join(', ')} (error di luar scope disembunyikan: ${loaded.errors.length - errors.length})`)

const rows: string[] = []
for (const subject of SUBJECTS) {
  for (let g = 1; g <= 6; g++) {
    const skills = index.skillsByKey.get(`${subject}:${g}`) ?? []
    const items = skills.reduce((n, s) => n + (index.itemsBySkill.get(s.id)?.length ?? 0), 0)
    const gens = skills.filter((s) => GENERATORS.has(s.id)).length
    const lessons = skills.filter((s) => index.lessons.has(s.id)).length
    rows.push(`${subject.padEnd(8)} G${g}  skill ${String(skills.length).padStart(3)}  soal ${String(items).padStart(5)}  generator ${String(gens).padStart(3)}  pelajaran ${String(lessons).padStart(3)}`)
  }
}
console.log(rows.join('\n'))
// Pembahasan bergerak: jumlah soal olimpiade yang punya gerakan, dan cakupan pembahasan per mapel.
const MIN_OLY_ANIMATED = 150
let olyAnimated = 0
const solved: Record<string, [number, number]> = {}
for (const item of index.items.values()) {
  const subj = index.skills.get(item.skill)?.subject ?? 'math'
  const row = (solved[subj] ??= [0, 0])
  row[1]++
  if (item.solution && item.solution.length > 0) row[0]++
  if (item.skill.includes('.oly-') && item.solution?.some((s) => s.anim)) olyAnimated++
}
console.log(`Pembahasan: ${Object.entries(solved).map(([k, [a, b]]) => `${k} ${a}/${b}`).join(', ')}; olimpiade ber-gerakan ${olyAnimated}`)
if (scopes.length === 0 && olyAnimated < MIN_OLY_ANIMATED) allErrors.push({ file: 'items/oly', message: `Soal olimpiade ber-gerakan ${olyAnimated}, minimal ${MIN_OLY_ANIMATED}` })

console.log(`Bacaan ${index.passages.size}, lomba ${index.competitions.length}, preset ${index.presets.length}`)
console.log(`Dek kartu ${cards.decks.length}, kartu ${cards.decks.reduce((n, d) => n + d.cards.length, 0)}`)
console.log(`Kata Spelling Bee: starters ${spelling.levels.starters.length}, movers ${spelling.levels.movers.length}, flyers ${spelling.levels.flyers.length}`)

const showWarn = process.argv.includes('--warnings')
if (warnings.length) {
  console.log(`\n${warnings.length} peringatan${showWarn ? '' : ' (tambah --warnings untuk melihat)'}`)
  if (showWarn) for (const w of warnings) console.log(`  ${w.file}: ${w.message}`)
}
if (allErrors.length) {
  console.error(`\n${allErrors.length} error:`)
  for (const e of allErrors.slice(0, 200)) console.error(`  ${e.file}: ${e.message}`)
  if (allErrors.length > 200) console.error(`  ... dan ${allErrors.length - 200} lagi`)
  process.exit(1)
}
console.log(`\ncontent:check bersih (${Date.now() - started} ms)`)
