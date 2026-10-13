import { z } from 'zod'
import { figureSpec } from '@kira/figures/spec'

export { ICON_NAMES } from '@kira/figures/spec'
export type { IconName } from '@kira/figures/spec'

/**
 * Skema konten Kira. Semua JSON di content/ divalidasi dengan skema ini oleh
 * `pnpm content:check`. Teks learner memakai ejaan en-GB.
 */

export const SUBJECTS = ['math', 'english', 'science'] as const
export const subject = z.enum(SUBJECTS)
export type Subject = z.infer<typeof subject>

export const SUBJECT_LETTER: Record<Subject, 'm' | 'e' | 's'> = { math: 'm', english: 'e', science: 's' }

export const grade = z.number().int().min(1).max(6)
export const difficulty = z.number().int().min(1).max(5)

export const STRANDS: Record<Subject, readonly string[]> = {
  math: ['Nc', 'Ni', 'Nm', 'Np', 'Nf', 'Gt', 'Gg', 'Gp', 'Ss', 'Sp', 'Oly'],
  english: ['Rw', 'Rv', 'Rg', 'Rs', 'Ri', 'Ra', 'Ww', 'Wv', 'Wg', 'Ws', 'Wc', 'Wp', 'SL'],
  science: ['Bs', 'Bp', 'Be', 'Cm', 'Cp', 'Cc', 'Pf', 'Pe', 'Pl', 'ESp', 'ESc', 'ESs', 'TWS'],
}

export const STRAND_NAMES: Record<string, { en: string; id: string }> = {
  Nc: { en: 'Counting and sequences', id: 'Membilang dan barisan' },
  Ni: { en: 'Integers and powers', id: 'Bilangan bulat dan pangkat' },
  Nm: { en: 'Money', id: 'Uang' },
  Np: { en: 'Place value, ordering and rounding', id: 'Nilai tempat, urutan, dan pembulatan' },
  Nf: { en: 'Fractions, decimals, percentages and ratio', id: 'Pecahan, desimal, persen, dan rasio' },
  Gt: { en: 'Time', id: 'Waktu' },
  Gg: { en: 'Shapes and measurement', id: 'Bangun dan pengukuran' },
  Gp: { en: 'Position and transformation', id: 'Posisi dan transformasi' },
  Ss: { en: 'Statistics', id: 'Statistika' },
  Sp: { en: 'Probability', id: 'Peluang' },
  Oly: { en: 'Olympiad thinking', id: 'Nalar olimpiade' },
  Rw: { en: 'Reading: word structure', id: 'Membaca: struktur kata' },
  Rv: { en: 'Reading: vocabulary', id: 'Membaca: kosakata' },
  Rg: { en: 'Reading: grammar and punctuation', id: 'Membaca: tata bahasa dan tanda baca' },
  Rs: { en: 'Reading: structure of texts', id: 'Membaca: struktur teks' },
  Ri: { en: 'Reading: interpretation', id: 'Membaca: pemahaman' },
  Ra: { en: 'Reading: appreciation', id: 'Membaca: apresiasi' },
  Ww: { en: 'Writing: spelling', id: 'Menulis: ejaan' },
  Wv: { en: 'Writing: vocabulary', id: 'Menulis: kosakata' },
  Wg: { en: 'Writing: grammar and punctuation', id: 'Menulis: tata bahasa dan tanda baca' },
  Ws: { en: 'Writing: structure of texts', id: 'Menulis: struktur teks' },
  Wc: { en: 'Writing: creating texts', id: 'Menulis: membuat teks' },
  Wp: { en: 'Writing: presentation', id: 'Menulis: penyajian' },
  SL: { en: 'Speaking and listening', id: 'Berbicara dan menyimak' },
  Bs: { en: 'Structure and function', id: 'Struktur dan fungsi' },
  Bp: { en: 'Life processes', id: 'Proses kehidupan' },
  Be: { en: 'Ecosystems', id: 'Ekosistem' },
  Cm: { en: 'Materials and their structure', id: 'Bahan dan strukturnya' },
  Cp: { en: 'Properties of materials', id: 'Sifat bahan' },
  Cc: { en: 'Changes to materials', id: 'Perubahan bahan' },
  Pf: { en: 'Forces and energy', id: 'Gaya dan energi' },
  Pe: { en: 'Electricity and magnetism', id: 'Listrik dan magnet' },
  Pl: { en: 'Light and sound', id: 'Cahaya dan bunyi' },
  ESp: { en: 'Planet Earth', id: 'Planet Bumi' },
  ESc: { en: 'Cycles on Earth', id: 'Siklus di Bumi' },
  ESs: { en: 'Earth in space', id: 'Bumi di antariksa' },
  TWS: { en: 'Thinking and working scientifically', id: 'Berpikir dan bekerja ilmiah' },
}

export const SKILL_ID = /^[mes][1-6]\.[a-z0-9]+(?:-[a-z0-9]+)*$/
export const ITEM_ID = /^[mes][1-6]\.[a-z0-9]+(?:-[a-z0-9]+)*\.\d{3}$/
export const PASSAGE_ID = /^[mes][1-6]\.p\.[a-z0-9]+(?:-[a-z0-9]+)*$/

const text = (max: number) => z.string().trim().min(1).max(max)

export const skillSchema = z
  .object({
    id: z.string().regex(SKILL_ID),
    subject,
    grade,
    strand: z.string(),
    title: text(60),
    titleId: text(80),
    canDo: text(120),
    order: z.number().int().min(1).max(999),
    prerequisites: z.array(z.string().regex(SKILL_ID)).max(6).default([]),
    term: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
    competitions: z.array(z.string()).max(12).default([]),
    generator: z.boolean().default(false),
  })
  .strict()
export type Skill = z.infer<typeof skillSchema>

export const solutionStepSchema = z
  .object({
    say: text(220),
    show: text(120).optional(),
    figure: figureSpec.optional(),
  })
  .strict()
export type SolutionStep = z.infer<typeof solutionStepSchema>

const optionSchema = z
  .object({
    text: text(160).optional(),
    figure: figureSpec.optional(),
    why: text(200).optional(),
  })
  .strict()
  .refine((o) => o.text !== undefined || o.figure !== undefined, 'Opsi butuh text atau figure')

const rubricSchema = z
  .object({
    criteria: z.array(z.object({ label: text(80), points: z.number().int().min(1).max(4) }).strict()).min(1).max(6),
  })
  .strict()

const MODE_LIST = ['belajar', 'latihan', 'kilat', 'tes', 'simulasi', 'kertas', 'review'] as const

const base = {
  id: z.string(),
  skill: z.string().regex(SKILL_ID),
  difficulty,
  prompt: text(900),
  lang: z.enum(['en-GB', 'id']).default('en-GB'),
  figure: figureSpec.optional(),
  passage: z.string().regex(PASSAGE_ID).optional(),
  hints: z.array(text(200)).length(3),
  explanation: text(600),
  tip: text(200).optional(),
  solution: z.array(solutionStepSchema).min(2).max(8).optional(),
  tags: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(10).default([]),
  source: z.enum(['kira-original', 'imported', 'ai-draft', 'tutor']).default('kira-original'),
  expectedSeconds: z.number().int().min(5).max(900).optional(),
  modes: z.array(z.enum(MODE_LIST)).optional(),
  points: z.number().int().min(1).max(10).optional(),
  terms: z.array(z.object({ term: text(40), en: text(60) }).strict()).max(10).optional(),
}

const manualBase = { ...base, hints: z.array(text(200)).max(3).default([]) }

export const mcqItem = z.object({ ...base, type: z.literal('mcq'), options: z.array(optionSchema).min(2).max(5), answer: z.number().int().min(0).max(4) }).strict()
export const multiItem = z.object({ ...base, type: z.literal('multi'), options: z.array(optionSchema).min(3).max(6), answers: z.array(z.number().int().min(0).max(5)).min(1).max(5) }).strict()
export const numericItem = z.object({ ...base, type: z.literal('numeric'), answer: z.number(), tolerance: z.number().min(0).max(1000).default(0), acceptAlt: z.array(z.number()).max(4).optional(), unit: text(20).optional(), allowNegative: z.boolean().default(false), allowDecimal: z.boolean().default(false) }).strict()
export const textItem = z.object({ ...base, type: z.literal('text'), blanks: z.array(z.object({ answers: z.array(text(60)).min(1).max(8), caseSensitive: z.boolean().default(false) }).strict()).min(1).max(5) }).strict()
export const orderItem = z.object({ ...base, type: z.literal('order'), items: z.array(text(80)).min(3).max(8) }).strict()
export const matchItem = z.object({ ...base, type: z.literal('match'), pairs: z.array(z.tuple([text(60), text(60)])).min(2).max(6) }).strict()
export const sortItem = z.object({ ...base, type: z.literal('sort'), groups: z.array(text(30)).min(2).max(4), items: z.array(z.object({ text: text(40), group: z.number().int().min(0).max(3) }).strict()).min(3).max(10) }).strict()
export const numberlineItem = z.object({ ...base, type: z.literal('numberline'), min: z.number(), max: z.number(), step: z.number().positive(), answer: z.number(), tolerance: z.number().min(0).default(0) }).strict()
export const clockItem = z.object({ ...base, type: z.literal('clock'), answer: z.object({ h: z.number().int().min(0).max(23), m: z.number().int().min(0).max(59) }).strict(), stepMinutes: z.union([z.literal(1), z.literal(5), z.literal(15), z.literal(30)]).default(5) }).strict()
export const fractionItem = z.object({ ...base, type: z.literal('fraction'), shape: z.enum(['bar', 'circle', 'square']), parts: z.number().int().min(2).max(16), answer: z.object({ num: z.number().int().min(0), den: z.number().int().min(1) }).strict() }).strict()
export const writeItem = z.object({ ...manualBase, type: z.literal('write'), rubric: rubricSchema, minWords: z.number().int().min(1).max(400).optional(), maxWords: z.number().int().min(5).max(600).optional(), planning: z.array(text(120)).max(5).optional(), model: text(800).optional() }).strict()
export const speakItem = z.object({ ...manualBase, type: z.literal('speak'), rubric: rubricSchema, readText: text(600).optional(), maxSeconds: z.number().int().min(10).max(180).default(60) }).strict()
export const drawItem = z.object({ ...manualBase, type: z.literal('draw'), rubric: rubricSchema, background: z.enum(['blank', 'grid', 'lines', 'dots']).default('blank') }).strict()

/** Sudut peta untuk bagian soal ketuk di gambar dan beri label: persen dari lebar dan tinggi figur. */
const pct = z.number().min(0).max(100)
const regionSchema = z.object({ label: text(40), x: pct, y: pct, w: z.number().min(8).max(100), h: z.number().min(8).max(100) }).strict()
const spotSchema = z.object({ x: pct, y: pct }).strict()
const gridCell = z.number().int().min(0).max(99)

/** Pertanyaan di dalam soal cerita bertahap: hanya jenis yang dinilai otomatis dengan satu jawaban. */
const storyPartMcq = z.object({ type: z.literal('mcq'), prompt: text(220), options: z.array(optionSchema).min(2).max(5), answer: z.number().int().min(0).max(4) }).strict()
const storyPartNumeric = z
  .object({ type: z.literal('numeric'), prompt: text(220), answer: z.number(), tolerance: z.number().min(0).max(1000).default(0), unit: text(20).optional(), allowNegative: z.boolean().default(false), allowDecimal: z.boolean().default(false) })
  .strict()
const storyPartText = z.object({ type: z.literal('text'), prompt: text(220), answers: z.array(text(60)).min(1).max(8), caseSensitive: z.boolean().default(false) }).strict()
export const storyPartSchema = z.discriminatedUnion('type', [storyPartMcq, storyPartNumeric, storyPartText])
export type StoryPart = z.infer<typeof storyPartSchema>

/** Cerita (di prompt) dengan 2 sampai 4 pertanyaan bertahap. */
export const storyItem = z.object({ ...base, type: z.literal('story'), parts: z.array(storyPartSchema).min(2).max(4) }).strict()
/** Dengar lalu jawab: listenText dibacakan lewat suara dan tidak pernah ditampilkan sebelum jawaban dikirim. */
export const listenItem = z.object({ ...base, type: z.literal('listen'), listenText: text(300), options: z.array(optionSchema).min(2).max(5), answer: z.number().int().min(0).max(4) }).strict()
/** Susun kata: answer dipecah per spasi menjadi kartu, distractors adalah kartu pengecoh. */
export const tilesItem = z.object({ ...base, type: z.literal('tiles'), answer: text(120), alternatives: z.array(text(120)).max(3).default([]), distractors: z.array(text(20)).max(4).default([]) }).strict()
/** Eja: anak mendengar word (lalu sentence) dan mengetik dengan papan huruf. */
export const spellItem = z
  .object({ ...base, type: z.literal('spell'), word: z.string().trim().min(2).max(16).regex(/^[A-Za-z][A-Za-z'-]*$/), sentence: text(160).optional(), alsoAccept: z.array(z.string().trim().min(2).max(16).regex(/^[A-Za-z][A-Za-z'-]*$/)).max(3).default([]) })
  .strict()
/** Pilih kata di celah: prompt memuat ___ untuk tiap celah, gaps[i] adalah pilihan dan indeks jawabannya. */
export const clozeItem = z
  .object({ ...base, type: z.literal('cloze'), gaps: z.array(z.object({ options: z.array(text(30)).min(2).max(5), answer: z.number().int().min(0).max(4) }).strict()).min(1).max(4) })
  .strict()
/** Ketuk di gambar: figur wajib, regions adalah area ketuk dalam persen, answers adalah indeks region yang benar. */
export const hotspotItem = z
  .object({ ...base, type: z.literal('hotspot'), figure: figureSpec, regions: z.array(regionSchema).min(2).max(8), answers: z.array(z.number().int().min(0).max(7)).min(1).max(3) })
  .strict()
/** Beri label diagram: labels[k] adalah label yang benar untuk spots[k]; extraLabels adalah label pengecoh. */
export const labelItem = z
  .object({ ...base, type: z.literal('label'), figure: figureSpec, labels: z.array(text(24)).min(2).max(6), spots: z.array(spotSchema).min(2).max(6), extraLabels: z.array(text(24)).max(2).default([]) })
  .strict()
/** Lengkapi tabel: sel di blanks dikosongkan di rows, anak mengisinya. */
export const tableItem = z
  .object({
    ...base,
    type: z.literal('table'),
    caption: text(60).optional(),
    head: z.array(text(24)).min(2).max(5),
    rows: z.array(z.array(z.string().trim().max(24)).min(2).max(5)).min(2).max(6),
    blanks: z.array(z.object({ row: z.number().int().min(0).max(5), col: z.number().int().min(0).max(4), answers: z.array(text(24)).min(1).max(4) }).strict()).min(1).max(8),
  })
  .strict()
/** Teka-teki kotak. given memakai 0 untuk sel kosong; filled adalah satu-satunya penyelesaian. */
export const GRID_PUZZLES = ['magic', 'sudoku', 'latin'] as const
export const gridItem = z
  .object({
    ...base,
    type: z.literal('grid'),
    puzzle: z.enum(GRID_PUZZLES),
    size: z.union([z.literal(3), z.literal(4)]),
    given: z.array(z.array(gridCell).min(3).max(4)).min(3).max(4),
    filled: z.array(z.array(z.number().int().min(1).max(99)).min(3).max(4)).min(3).max(4),
  })
  .strict()
/** Jawaban foto: anak memotret jawaban di kertas, tutor menilai dengan rubrik dan saran AI. */
export const photoItem = z.object({ ...manualBase, type: z.literal('photo'), rubric: rubricSchema }).strict()

export const itemSchema = z.discriminatedUnion('type', [
  mcqItem, multiItem, numericItem, textItem, orderItem, matchItem, sortItem, numberlineItem, clockItem, fractionItem,
  writeItem, speakItem, drawItem,
  storyItem, listenItem, tilesItem, spellItem, clozeItem, hotspotItem, labelItem, tableItem, gridItem, photoItem,
])
export type Item = z.infer<typeof itemSchema>
export type ItemInput = z.input<typeof itemSchema>
export type ItemType = Item['type']
export const ITEM_TYPES = itemSchema.options.map((o) => o.shape.type.value) as ItemType[]
export const MANUAL_TYPES: readonly ItemType[] = ['write', 'speak', 'draw', 'photo']
/** Jenis soal yang bisa dicetak di kertas dan dijawab lewat LJK. Jenis lain hanya untuk layar. */
export const PAPER_TYPES: readonly ItemType[] = ['mcq', 'multi', 'numeric', 'text', 'order', 'match', 'sort', 'numberline', 'clock', 'fraction']
export const isPaperType = (type: ItemType): boolean => PAPER_TYPES.includes(type)

export const itemFileSchema = z.object({ skill: z.string().regex(SKILL_ID), items: z.array(itemSchema).min(1) }).strict()

export const passageSchema = z
  .object({
    id: z.string().regex(PASSAGE_ID),
    title: text(80),
    kind: z.enum(['story', 'poem', 'information', 'instructions', 'letter', 'diary', 'report', 'dialogue']),
    text: text(4000),
    lang: z.enum(['en-GB', 'id']).default('en-GB'),
  })
  .strict()
export type Passage = z.infer<typeof passageSchema>

export const lessonSchema = z
  .object({
    skill: z.string().regex(SKILL_ID),
    title: text(60),
    steps: z.array(solutionStepSchema).min(3).max(10),
    check: z.array(z.union([mcqItem, numericItem, textItem])).min(1).max(3),
  })
  .strict()
export type Lesson = z.infer<typeof lessonSchema>

export const scoringSectionSchema = z
  .object({ from: z.number().int().min(1), to: z.number().int().min(1), points: z.number().min(0), wrongPenalty: z.number().min(0).optional(), label: text(40).optional() })
  .strict()

export const presetSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    competition: z.string().regex(/^[a-z0-9-]+$/),
    title: text(60),
    subject,
    grades: z.array(grade).min(1),
    lang: z.enum(['en-GB', 'id']),
    year: z.number().int().min(2024).max(2030),
    verified: z.boolean(),
    rules: z
      .object({
        questionCount: z.number().int().min(1).max(100),
        timeLimitMin: z.number().int().min(1).max(240),
        sections: z.array(scoringSectionSchema).min(1),
        startScore: z.number().optional(),
        scaleTo: z.number().positive().optional(),
        passMark: z.number().optional(),
        floorZero: z.boolean().optional(),
        optionCount: z.union([z.literal(4), z.literal(5)]).default(4),
      })
      .strict(),
    howItWorks: z.array(text(160)).min(1).max(6),
    tip: text(200).optional(),
    itemTags: z.array(z.string()).min(1),
    notes: text(400).optional(),
  })
  .strict()
export type Preset = z.infer<typeof presetSchema>

export const competitionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    name: text(80),
    organizer: text(120),
    scope: z.enum(['international', 'national', 'regional', 'school']),
    subjects: z.array(subject).min(1),
    grades: z.array(grade).min(1),
    lang: z.array(z.enum(['en-GB', 'id'])).min(1),
    format: text(400),
    usualMonths: text(80),
    website: z.string().url().optional(),
    verified: z.boolean(),
    sources: z.array(z.string().url()).max(6).default([]),
    notes: text(400).optional(),
  })
  .strict()
export type Competition = z.infer<typeof competitionSchema>

export const catalogSchema = z
  .object({ competitions: z.array(competitionSchema), presets: z.array(presetSchema) })
  .strict()

export const skillFileSchema = z.array(skillSchema).min(1)

export function skillSubject(skillId: string): Subject {
  const letter = skillId[0]
  return letter === 'm' ? 'math' : letter === 'e' ? 'english' : 'science'
}

export function skillGrade(skillId: string): number {
  return Number(skillId[1])
}
