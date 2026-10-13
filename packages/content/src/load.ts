import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { validateRules } from '@kira/core/scoring'
import { z } from 'zod'
import { flatten, gridRulesOk, gridValues, sizeAllowed, solveGrid } from './grid'
import { GENERATORS, generateUncached, genRef } from './math'
import {
  catalogSchema,
  itemFileSchema,
  ITEM_ID,
  lessonSchema,
  passageSchema,
  skillFileSchema,
  SKILL_ID,
  STRANDS,
  SUBJECT_LETTER,
  SUBJECTS,
  type Competition,
  type Item,
  type Lesson,
  type Passage,
  type Preset,
  type Skill,
  type Subject,
} from './schema'

export type ContentIndex = {
  skills: Map<string, Skill>
  skillsByKey: Map<string, Skill[]>
  items: Map<string, Item>
  itemsBySkill: Map<string, Item[]>
  lessons: Map<string, Lesson>
  passages: Map<string, Passage>
  competitions: Competition[]
  presets: Preset[]
}

export type Problem = { file: string; message: string }

export type LoadResult = { index: ContentIndex; errors: Problem[]; warnings: Problem[] }

export function skillKey(subject: Subject, grade: number): string {
  return `${subject}:${grade}`
}

/** Cari folder content/ dari cwd ke atas, atau pakai KIRA_CONTENT_DIR. */
export function findContentDir(start = process.cwd()): string {
  const env = process.env.KIRA_CONTENT_DIR
  if (env && existsSync(env)) return env
  // Di produksi folder konten selalu diberikan lewat KIRA_CONTENT_DIR (image Docker menyalinnya ke /app/content).
  if (process.env.NODE_ENV === 'production') throw new Error(`Folder konten tidak ditemukan. Set KIRA_CONTENT_DIR (sekarang: ${env ?? 'kosong'}).`)
  let dir = start
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, 'content')
    if (existsSync(join(candidate, 'skills'))) return candidate
    const parent = join(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  throw new Error('Folder content/ tidak ditemukan. Set KIRA_CONTENT_DIR.')
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (name.endsWith('.json')) out.push(p)
  }
  return out
}

function readJson(file: string, errors: Problem[], root: string): unknown {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch (e) {
    errors.push({ file: relative(root, file), message: `JSON tidak valid: ${(e as Error).message}` })
    return undefined
  }
}

function zodMessage(e: z.ZodError): string {
  return e.issues
    .slice(0, 6)
    .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('; ')
}

const BANNED_CHARS = /[\u2014\u2013]/
const BANNED_WORDS = /\b(leverag\w*|seamless\w*|robust|delv\w*|unlock\w*|empower\w*|crucial|pivotal|holistic|tapestry|testament|utiliz\w*|utilis\w*)\b/i

function textsOf(item: Item): string[] {
  const t: string[] = [item.prompt, item.explanation, ...item.hints]
  if (item.tip) t.push(item.tip)
  for (const s of item.solution ?? []) t.push(s.say, s.show ?? '')
  if (item.type === 'mcq' || item.type === 'multi') for (const o of item.options) t.push(o.text ?? '', o.why ?? '')
  if (item.type === 'order') t.push(...item.items)
  if (item.type === 'match') for (const [a, b] of item.pairs) t.push(a, b)
  if (item.type === 'sort') t.push(...item.groups, ...item.items.map((i) => i.text))
  if (item.type === 'text') for (const b of item.blanks) t.push(...b.answers)
  if (item.type === 'story') {
    for (const part of item.parts) {
      t.push(part.prompt)
      if (part.type === 'mcq') for (const o of part.options) t.push(o.text ?? '', o.why ?? '')
      if (part.type === 'text') t.push(...part.answers)
    }
  }
  if (item.type === 'listen') {
    t.push(item.listenText)
    for (const o of item.options) t.push(o.text ?? '', o.why ?? '')
  }
  if (item.type === 'tiles') t.push(item.answer, ...item.alternatives, ...item.distractors)
  if (item.type === 'spell') t.push(item.sentence ?? '')
  if (item.type === 'cloze') for (const g of item.gaps) t.push(...g.options)
  if (item.type === 'hotspot') t.push(...item.regions.map((r) => r.label))
  if (item.type === 'label') t.push(...item.labels, ...item.extraLabels)
  if (item.type === 'table') {
    t.push(item.caption ?? '', ...item.head, ...item.rows.flat())
    for (const b of item.blanks) t.push(...b.answers)
  }
  return t
}

const wordsOf = (s: string) => s.split(/\s+/).filter(Boolean)
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const apart = (a: { x: number; y: number }, b: { x: number; y: number }, gap: number) => Math.abs(a.x - b.x) >= gap || Math.abs(a.y - b.y) >= gap

/** Pemeriksaan isi jenis soal baru (cerita, dengar, susun kata, eja, celah, gambar, label, tabel, kotak). */
function newTypeProblems(item: Item): string[] {
  const p: string[] = []
  const dup = (list: string[]) => new Set(list.map((x) => x.trim().toLowerCase())).size !== list.length
  switch (item.type) {
    case 'story': {
      if (/_{3,}/.test(item.prompt)) p.push('Cerita tidak boleh memuat ___')
      if (dup(item.parts.map((part) => part.prompt))) p.push('Pertanyaan cerita kembar')
      item.parts.forEach((part, k) => {
        if (part.type !== 'mcq') return
        if (part.answer >= part.options.length) p.push(`Pertanyaan ${k + 1}: answer di luar opsi`)
        if (dup(part.options.map((o) => o.text ?? JSON.stringify(o.figure)))) p.push(`Pertanyaan ${k + 1}: opsi kembar`)
      })
      break
    }
    case 'listen': {
      if (item.answer >= item.options.length) p.push('answer di luar opsi')
      if (dup(item.options.map((o) => o.text ?? JSON.stringify(o.figure)))) p.push('Opsi kembar')
      if (item.prompt.toLowerCase().includes(item.listenText.trim().toLowerCase())) p.push('Prompt memuat listenText, padahal teks dengar tidak boleh terlihat')
      break
    }
    case 'tiles': {
      const order = wordsOf(item.answer)
      if (order.length < 3 || order.length > 9) p.push(`Kalimat harus 3 sampai 9 kata, sekarang ${order.length}`)
      if (order.length + item.distractors.length > 12) p.push('Kartu lebih dari 12')
      const key = [...order].sort().join(' ')
      const seen = new Set([item.answer.trim()])
      for (const alt of item.alternatives) {
        if ([...wordsOf(alt)].sort().join(' ') !== key) p.push(`Kalimat lain memakai kata yang berbeda: "${alt.slice(0, 40)}"`)
        if (seen.has(alt.trim())) p.push(`Kalimat lain kembar: "${alt.slice(0, 40)}"`)
        seen.add(alt.trim())
      }
      const have = new Set(order.map((w) => w.toLowerCase().replace(/[.,!?]+$/, '')))
      for (const d of item.distractors) {
        if (d.includes(' ')) p.push(`Kartu pengecoh harus satu kata: "${d}"`)
        if (have.has(d.toLowerCase().replace(/[.,!?]+$/, ''))) p.push(`Kartu pengecoh sama dengan kata di kalimat: "${d}"`)
      }
      if (dup(item.distractors)) p.push('Kartu pengecoh kembar')
      if (item.prompt.toLowerCase().includes(item.answer.trim().toLowerCase())) p.push('Prompt memuat kalimat jawaban')
      break
    }
    case 'spell': {
      if (new RegExp(`(?<![A-Za-z])${escapeRe(item.word)}(?![A-Za-z])`, 'i').test(item.prompt)) p.push('Prompt memuat kata yang harus dieja')
      if (item.alsoAccept.some((w) => w.toLowerCase() === item.word.toLowerCase())) p.push('alsoAccept sama dengan word')
      break
    }
    case 'cloze': {
      const blanks = (item.prompt.match(/_{3,}/g) ?? []).length
      if (blanks !== item.gaps.length) p.push(`Prompt punya ${blanks} titik kosong, gaps ${item.gaps.length}`)
      item.gaps.forEach((g, k) => {
        if (g.answer >= g.options.length) p.push(`Celah ${k + 1}: answer di luar opsi`)
        if (dup(g.options)) p.push(`Celah ${k + 1}: opsi kembar`)
      })
      break
    }
    case 'hotspot': {
      if (item.answers.some((a) => a >= item.regions.length)) p.push('answers di luar regions')
      if (new Set(item.answers).size !== item.answers.length) p.push('answers kembar')
      if (item.answers.length >= item.regions.length) p.push('Semua area benar')
      if (dup(item.regions.map((r) => r.label))) p.push('Label area kembar')
      item.regions.forEach((r, k) => {
        if (r.x - r.w / 2 < -0.5 || r.x + r.w / 2 > 100.5 || r.y - r.h / 2 < -0.5 || r.y + r.h / 2 > 100.5) p.push(`Area ${k} keluar dari gambar`)
      })
      for (let i = 0; i < item.regions.length; i++) {
        for (let j = i + 1; j < item.regions.length; j++) if (!apart(item.regions[i]!, item.regions[j]!, 14)) p.push(`Area ${i} dan ${j} terlalu dekat untuk diketuk`)
      }
      break
    }
    case 'label': {
      if (item.labels.length !== item.spots.length) p.push(`labels ${item.labels.length} tidak sama dengan spots ${item.spots.length}`)
      if (dup([...item.labels, ...item.extraLabels])) p.push('Label kembar')
      for (let i = 0; i < item.spots.length; i++) {
        for (let j = i + 1; j < item.spots.length; j++) if (!apart(item.spots[i]!, item.spots[j]!, 14)) p.push(`Titik ${i} dan ${j} terlalu dekat untuk diketuk`)
      }
      break
    }
    case 'table': {
      item.rows.forEach((row, r) => {
        if (row.length !== item.head.length) p.push(`Baris ${r} punya ${row.length} sel, kepala tabel ${item.head.length}`)
      })
      const seen = new Set<string>()
      for (const b of item.blanks) {
        const cell = item.rows[b.row]?.[b.col]
        if (cell === undefined) p.push(`Sel kosong (${b.row}, ${b.col}) di luar tabel`)
        else if (cell !== '') p.push(`Sel (${b.row}, ${b.col}) harus dikosongkan di rows`)
        const k = `${b.row}:${b.col}`
        if (seen.has(k)) p.push(`Sel kosong kembar (${b.row}, ${b.col})`)
        seen.add(k)
      }
      item.rows.forEach((row, r) =>
        row.forEach((cell, c) => {
          if (cell === '' && !seen.has(`${r}:${c}`)) p.push(`Sel (${r}, ${c}) kosong tetapi tidak ada di blanks`)
        }),
      )
      break
    }
    case 'grid': {
      const n = item.size
      if (!sizeAllowed(item.puzzle, n)) p.push(`${item.puzzle} tidak bisa berukuran ${n}x${n}`)
      if (item.given.length !== n || item.filled.length !== n || item.given.some((r) => r.length !== n) || item.filled.some((r) => r.length !== n)) {
        p.push(`given dan filled harus ${n}x${n}`)
        break
      }
      const given = flatten(item.given)
      const solution = flatten(item.filled)
      const values = gridValues(item.puzzle, n, solution)
      if (!gridRulesOk(item.puzzle, n, solution, values)) p.push('filled tidak memenuhi aturan teka-teki')
      if (given.some((g, i) => g !== 0 && g !== solution[i])) p.push('given tidak cocok dengan filled')
      const blanks = given.filter((g) => g === 0).length
      if (blanks < 2) p.push('Teka-teki butuh minimal 2 sel kosong')
      else if (solveGrid(item.puzzle, n, given, values, 2).length !== 1) p.push('Teka-teki tidak punya tepat satu penyelesaian')
      break
    }
    default:
      break
  }
  return p
}

/** Pemeriksaan isi yang tidak bisa dinyatakan di skema Zod. */
export function semanticProblems(item: Item, ctx: { passages?: Map<string, Passage> } = {}): string[] {
  const p: string[] = []
  const hintSet = new Set(item.hints.map((h) => h.toLowerCase()))
  if (hintSet.size !== item.hints.length) p.push('Hint tidak boleh sama')
  if (item.hints.some((h) => h.trim().toLowerCase() === item.explanation.trim().toLowerCase())) p.push('Hint sama dengan penjelasan')
  for (const t of textsOf(item)) {
    if (BANNED_CHARS.test(t)) p.push(`Ada em dash atau en dash: "${t.slice(0, 50)}"`)
    if (BANNED_WORDS.test(t)) p.push(`Kata terlarang GTX: "${t.slice(0, 50)}"`)
  }
  switch (item.type) {
    case 'mcq':
    case 'multi': {
      const keys = item.options.map((o) => (o.text ?? JSON.stringify(o.figure)).trim().toLowerCase())
      if (new Set(keys).size !== keys.length) p.push('Opsi kembar')
      if (item.type === 'mcq' && item.answer >= item.options.length) p.push('answer di luar opsi')
      if (item.type === 'multi') {
        if (item.answers.some((a) => a >= item.options.length)) p.push('answers di luar opsi')
        if (new Set(item.answers).size !== item.answers.length) p.push('answers kembar')
        if (item.answers.length >= item.options.length) p.push('Semua opsi benar')
      }
      break
    }
    case 'sort': {
      if (item.items.some((i) => i.group >= item.groups.length)) p.push('group di luar daftar groups')
      for (let g = 0; g < item.groups.length; g++) if (!item.items.some((i) => i.group === g)) p.push(`Grup ${item.groups[g]} kosong`)
      break
    }
    case 'numberline':
      if (item.min >= item.max) p.push('min harus lebih kecil dari max')
      if (item.answer < item.min || item.answer > item.max) p.push('answer di luar garis bilangan')
      break
    case 'fraction':
      if (item.answer.num > item.answer.den) p.push('Pecahan lebih dari 1')
      if ((item.answer.num * item.parts) % item.answer.den !== 0) p.push('Pecahan tidak bisa diarsir dengan jumlah bagian ini')
      break
    case 'text': {
      const blanks = (item.prompt.match(/___/g) ?? []).length
      if (blanks > 0 && blanks !== item.blanks.length) p.push(`Prompt punya ${blanks} titik kosong, blanks ${item.blanks.length}`)
      if (item.blanks.length > 1 && blanks === 0) p.push('Lebih dari satu blank butuh ___ di prompt')
      break
    }
    case 'order':
      if (new Set(item.items.map((i) => i.toLowerCase())).size !== item.items.length) p.push('Kartu urutan kembar')
      break
    case 'match': {
      const l = new Set(item.pairs.map(([a]) => a.toLowerCase()))
      const r = new Set(item.pairs.map(([, b]) => b.toLowerCase()))
      if (l.size !== item.pairs.length || r.size !== item.pairs.length) p.push('Pasangan kembar')
      break
    }
    case 'numeric':
      if (!item.allowNegative && item.answer < 0) p.push('Jawaban negatif butuh allowNegative')
      break
    default:
      p.push(...newTypeProblems(item))
      break
  }
  if (item.passage && ctx.passages && !ctx.passages.has(item.passage)) p.push(`Bacaan ${item.passage} tidak ada`)
  if (item.lang === 'id' && !item.tags.includes('esmo') && !item.tags.includes('id')) p.push('Soal berbahasa Indonesia harus bertag esmo atau id')
  return p
}

export function loadContent(dir: string = findContentDir()): LoadResult {
  const errors: Problem[] = []
  const warnings: Problem[] = []
  const index: ContentIndex = {
    skills: new Map(),
    skillsByKey: new Map(),
    items: new Map(),
    itemsBySkill: new Map(),
    lessons: new Map(),
    passages: new Map(),
    competitions: [],
    presets: [],
  }

  // Skill
  for (const file of walk(join(dir, 'skills'))) {
    const rel = relative(dir, file)
    const m = /^skills[\\/](math|english|science)[\\/]g([1-6])(?:-[a-z0-9-]+)?\.json$/.exec(rel)
    if (!m) {
      errors.push({ file: rel, message: 'Nama file skill harus skills/<subject>/g<grade>.json atau g<grade>-<nama>.json' })
      continue
    }
    const parsed = skillFileSchema.safeParse(readJson(file, errors, dir))
    if (!parsed.success) {
      errors.push({ file: rel, message: zodMessage(parsed.error) })
      continue
    }
    const subj = m[1] as Subject
    const g = Number(m[2])
    for (const s of parsed.data) {
      if (s.subject !== subj || s.grade !== g) errors.push({ file: rel, message: `${s.id}: subject atau grade tidak cocok dengan nama file` })
      if (!s.id.startsWith(`${SUBJECT_LETTER[subj]}${g}.`)) errors.push({ file: rel, message: `${s.id}: awalan id harus ${SUBJECT_LETTER[subj]}${g}.` })
      if (!STRANDS[subj].includes(s.strand)) errors.push({ file: rel, message: `${s.id}: strand ${s.strand} tidak dikenal` })
      if (index.skills.has(s.id)) errors.push({ file: rel, message: `${s.id}: id skill kembar` })
      for (const t of [s.title, s.titleId, s.canDo]) if (BANNED_CHARS.test(t)) errors.push({ file: rel, message: `${s.id}: ada em dash` })
      index.skills.set(s.id, s)
      const key = skillKey(subj, g)
      index.skillsByKey.set(key, [...(index.skillsByKey.get(key) ?? []), s])
    }
  }
  for (const list of index.skillsByKey.values()) list.sort((a, b) => a.order - b.order)
  for (const s of index.skills.values()) {
    for (const pre of s.prerequisites) if (!index.skills.has(pre)) errors.push({ file: `skills/${s.subject}`, message: `${s.id}: prasyarat ${pre} tidak ada` })
    if (s.generator && !GENERATORS.has(s.id)) errors.push({ file: `skills/${s.subject}`, message: `${s.id}: generator:true tapi generator tidak ada` })
  }

  // Bacaan
  for (const file of walk(join(dir, 'passages'))) {
    const rel = relative(dir, file)
    const parsed = passageSchema.safeParse(readJson(file, errors, dir))
    if (!parsed.success) {
      errors.push({ file: rel, message: zodMessage(parsed.error) })
      continue
    }
    if (BANNED_CHARS.test(parsed.data.text)) errors.push({ file: rel, message: 'Bacaan memuat em dash atau en dash' })
    if (index.passages.has(parsed.data.id)) errors.push({ file: rel, message: `${parsed.data.id}: id bacaan kembar` })
    index.passages.set(parsed.data.id, parsed.data)
  }

  // Soal
  for (const file of walk(join(dir, 'items'))) {
    const rel = relative(dir, file)
    const m = /^items[\\/](math|english|science)[\\/]g([1-6])[\\/]([a-z0-9-]+)\.json$/.exec(rel)
    if (!m) {
      errors.push({ file: rel, message: 'Nama file soal harus items/<subject>/g<grade>/<slug>.json' })
      continue
    }
    const expectedSkill = `${SUBJECT_LETTER[m[1] as Subject]}${m[2]}.${m[3]}`
    const parsed = itemFileSchema.safeParse(readJson(file, errors, dir))
    if (!parsed.success) {
      errors.push({ file: rel, message: zodMessage(parsed.error) })
      continue
    }
    if (parsed.data.skill !== expectedSkill) errors.push({ file: rel, message: `skill harus ${expectedSkill}` })
    if (!index.skills.has(expectedSkill)) errors.push({ file: rel, message: `Skill ${expectedSkill} belum ada di skills/` })
    for (const item of parsed.data.items) {
      if (item.skill !== expectedSkill) errors.push({ file: rel, message: `${item.id}: skill harus ${expectedSkill}` })
      if (!ITEM_ID.test(item.id) || !item.id.startsWith(`${expectedSkill}.`)) errors.push({ file: rel, message: `${item.id}: id harus ${expectedSkill}.NNN` })
      if (index.items.has(item.id)) errors.push({ file: rel, message: `${item.id}: id soal kembar` })
      for (const msg of semanticProblems(item, { passages: index.passages })) errors.push({ file: rel, message: `${item.id}: ${msg}` })
      index.items.set(item.id, item)
      index.itemsBySkill.set(item.skill, [...(index.itemsBySkill.get(item.skill) ?? []), item])
    }
  }

  // Pelajaran
  for (const file of walk(join(dir, 'lessons'))) {
    const rel = relative(dir, file)
    const parsed = lessonSchema.safeParse(readJson(file, errors, dir))
    if (!parsed.success) {
      errors.push({ file: rel, message: zodMessage(parsed.error) })
      continue
    }
    const l = parsed.data
    if (!index.skills.has(l.skill)) errors.push({ file: rel, message: `Skill ${l.skill} tidak ada` })
    if (index.lessons.has(l.skill)) errors.push({ file: rel, message: `Pelajaran untuk ${l.skill} kembar` })
    for (const c of l.check) {
      if (!c.id.startsWith(`${l.skill}.9`) || !ITEM_ID.test(c.id)) errors.push({ file: rel, message: `${c.id}: id soal cek pelajaran harus ${l.skill}.9NN` })
      for (const msg of semanticProblems(c)) errors.push({ file: rel, message: `${c.id}: ${msg}` })
    }
    for (const s of l.steps) if (BANNED_CHARS.test(s.say) || BANNED_CHARS.test(s.show ?? '')) errors.push({ file: rel, message: 'Langkah pelajaran memuat em dash' })
    index.lessons.set(l.skill, l)
  }

  // Katalog lomba
  const catalogFile = join(dir, 'competitions', 'catalog.json')
  if (existsSync(catalogFile)) {
    const parsed = catalogSchema.safeParse(readJson(catalogFile, errors, dir))
    if (!parsed.success) errors.push({ file: 'competitions/catalog.json', message: zodMessage(parsed.error) })
    else {
      index.competitions = parsed.data.competitions
      index.presets = parsed.data.presets
      const ids = new Set(index.competitions.map((c) => c.id))
      for (const p of index.presets) {
        if (!ids.has(p.competition)) errors.push({ file: 'competitions/catalog.json', message: `${p.id}: lomba ${p.competition} tidak ada` })
        for (const e of validateRules(p.rules)) errors.push({ file: 'competitions/catalog.json', message: `${p.id}: ${e}` })
      }
    }
  } else warnings.push({ file: 'competitions/catalog.json', message: 'Katalog lomba belum ada' })

  // Peringatan cakupan
  for (const s of index.skills.values()) {
    const n = index.itemsBySkill.get(s.id)?.length ?? 0
    if (!s.generator && n < 5) warnings.push({ file: `items/${s.subject}/g${s.grade}`, message: `${s.id}: baru ${n} soal (minimal 5)` })
    if (!index.lessons.has(s.id) && s.strand !== 'Oly') warnings.push({ file: `lessons/${s.subject}/g${s.grade}`, message: `${s.id}: belum ada pelajaran` })
  }
  for (const subj of SUBJECTS) {
    for (let g = 1; g <= 6; g++) {
      if (!index.skillsByKey.has(skillKey(subj, g))) warnings.push({ file: `skills/${subj}/g${g}.json`, message: 'Belum ada skill' })
    }
  }
  return { index, errors, warnings }
}

/** Uji setiap generator: 25 seed per tingkat harus valid dan deterministik. */
export function checkGenerators(skills: Map<string, Skill>, seedsPerLevel = 25): Problem[] {
  const problems: Problem[] = []
  for (const [skill, gen] of GENERATORS) {
    if (!SKILL_ID.test(skill)) problems.push({ file: `math/${skill}`, message: 'Id skill generator tidak valid' })
    if (!skills.has(skill)) problems.push({ file: `math/${skill}`, message: 'Skill generator tidak ada di skills/' })
    else if (!skills.get(skill)!.generator) problems.push({ file: `math/${skill}`, message: 'Skill punya generator tapi generator:false' })
    for (const level of gen.levels) {
      for (let s = 0; s < seedsPerLevel; s++) {
        const ref = genRef(skill, level, s.toString(36))
        try {
          const a = generateUncached(ref)
          const b = generateUncached(ref)
          if (JSON.stringify(a) !== JSON.stringify(b)) problems.push({ file: `math/${skill}`, message: `${ref}: tidak deterministik` })
          for (const msg of semanticProblems(a)) problems.push({ file: `math/${skill}`, message: `${ref}: ${msg}` })
        } catch (e) {
          problems.push({ file: `math/${skill}`, message: `${ref}: ${(e as Error).message.slice(0, 300)}` })
          break
        }
      }
    }
  }
  return problems
}

