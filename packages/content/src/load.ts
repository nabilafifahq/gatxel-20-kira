import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { validateRules } from '@kira/core/scoring'
import { z } from 'zod'
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

const BANNED_CHARS = /[—–]/
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
  return t
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

