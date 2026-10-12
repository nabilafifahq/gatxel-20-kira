// __GTX_SEED__
import type { BankItemRow, ItemBankDTO, PaperBuilderDTO, PaperDTO } from '@/lib/dto'
import type { ClientItem } from '@kira/content/present'
import { ITEM_ARRAY, ITEM_BARS, ITEM_CLOCK, ITEM_ESMO, ITEM_MATCH, ITEM_ORDER, ITEM_SORT, ITEM_TEXT, ITEM_WRITE, shell } from './console-shared'

type Seed = [ref: string, skillId: string, skillTitle: string, type: string, diff: number, sec: number, text: string, source?: BankItemRow['source'], acc?: number | null, attempts?: number, reports?: number]

const MCQ_OPTIONS: Record<string, string[]> = {
  'KRA-M-0521': ['3', '4', '5', '6'],
  'KRA-M-0524': ['4:00', '4:15', '4:30', '4:45'],
  'KRA-M-0525': ['Ana', 'Ben', 'Cici', 'They are the same height'],
  'KRA-M-0527': ['Wednesday', 'Thursday', 'Friday', 'Saturday'],
  'KRA-M-0530': ['1', '2', '4', '8'],
  'KRA-M-0532': ['Rectangle', 'Square', 'Triangle', 'Circle'],
}

function mcq(ref: string, skill: string, diff: number, sec: number, text: string, lang: 'en-GB' | 'id' = 'en-GB', options = MCQ_OPTIONS[ref] ?? ['1', '2', '3', '4']): ClientItem {
  return {
    ref,
    type: 'mcq',
    skill,
    difficulty: diff,
    prompt: text,
    lang,
    options: options.map((t, i) => ({ i, text: t })),
    expectedSeconds: sec,
  }
}

const MATH_SEEDS: Seed[] = [
  ['KRA-M-0521', 'm2-shapes', 'Shapes', 'mcq', 3, 90, 'How many triangles can you find in the picture?', 'kira-original', 67, 3],
  ['KRA-M-0522', 'm2-word-problems', 'Word problems', 'numeric', 2, 60, 'Tom has 3 red balls and twice as many blue balls. How many balls does he have?', 'kira-original', 75, 4],
  ['KRA-M-0523', 'm2-patterns', 'Pola bilangan', 'numeric', 3, 60, 'What comes next? 2, 4, 8, 16, ...', 'generator', 50, 2],
  ['KRA-M-0524', 'm2-time', 'Waktu dan jam', 'mcq', 2, 75, 'The clock shows quarter to 4. What time is it 30 minutes later?', 'kira-original', 58, 6, 1],
  ['KRA-M-0525', 'm2-logic', 'Logic', 'mcq', 2, 45, 'Ana is taller than Ben. Ben is taller than Cici. Who is the shortest?', 'kira-original', 100, 2],
  ['KRA-M-0526', 'm2-logic', 'Logic', 'numeric', 4, 120, 'A farm has one cow and some hens. There are 12 legs in all. How many hens are there?', 'tutor', 33, 3],
  ['KRA-M-0527', 'm2-calendar', 'Kalender', 'mcq', 3, 75, 'Today is Tuesday. What day will it be in 9 days?', 'kira-original', 100, 1],
  ['KRA-M-0528', 'm2-shapes', 'Shapes', 'numeric', 4, 90, 'How many squares are there in a 2 by 2 grid?', 'kira-original', null, 0],
  ['KRA-M-0529', 'm2-patterns', 'Pola bilangan', 'numeric', 4, 90, 'A frog jumps 3 steps forward and 1 step back each turn. Where is it after 4 turns?', 'ai-draft', null, 0],
  ['KRA-M-0530', 'm2-spatial', 'Spatial', 'mcq', 5, 120, 'Mia folds a paper in half two times and punches one hole. How many holes are there when she opens it?', 'kira-original', 40, 5],
  ['KRA-M-0531', 'm2-count-100', 'Count to 100', 'numeric', 1, 30, 'What number is 10 more than 47?', 'generator', 92, 12],
  ['KRA-M-0532', 'm2-shapes', 'Shapes', 'mcq', 1, 30, 'Which shape has 4 equal sides and 4 square corners?', 'kira-original', 88, 8],
]

function rowFrom(s: Seed, subject: BankItemRow['subject'], grade = 2): BankItemRow & { preview: ClientItem } {
  const [ref, skillId, skillTitle, type, diff, sec, text, source = 'kira-original', acc = null, attempts = 0, reports = 0] = s
  return {
    ref,
    subject,
    grade,
    skillId,
    skillTitle,
    type,
    difficulty: diff,
    promptPreview: text,
    source,
    tags: source === 'imported' ? ['esmo'] : [],
    attempts,
    accuracy: acc,
    reports,
    preview:
      type === 'mcq'
        ? mcq(ref, skillId, diff, sec, text)
        : { ref, type: type as ClientItem['type'], skill: skillId, difficulty: diff, prompt: text, lang: 'en-GB', expectedSeconds: sec, allowDecimal: false, allowNegative: false },
  }
}

export const BANK_ITEMS: (BankItemRow & { preview: ClientItem })[] = [
  ...MATH_SEEDS.map((s) => rowFrom(s, 'math')),
  { ...rowFrom(['KRA-M-0398', 'm2-arrays', 'Arrays', 'mcq', 2, 45, ITEM_ARRAY.prompt, 'kira-original', 64, 14, 0], 'math'), preview: ITEM_ARRAY },
  { ...rowFrom(['KRA-M-0413', 'm2-time', 'Waktu dan jam', 'numeric', 3, 60, ITEM_CLOCK.prompt, 'kira-original', 67, 9, 1], 'math'), preview: ITEM_CLOCK },
  { ...rowFrom(['KRA-M-0451', 'm2-data', 'Diagram batang', 'numeric', 2, 60, ITEM_BARS.prompt, 'kira-original', 81, 7], 'math'), preview: ITEM_BARS },
  { ...rowFrom(['ORG-ESMO-M-0007', 'm2-patterns', 'Pola bilangan', 'mcq', 3, 60, ITEM_ESMO.prompt, 'imported', 75, 4], 'math'), preview: ITEM_ESMO },
  { ...rowFrom(['KRA-E-0211', 'e2-past-ed', 'Past tense -ed', 'match', 2, 75, ITEM_MATCH.prompt, 'kira-original', 85, 11], 'english'), preview: ITEM_MATCH },
  { ...rowFrom(['KRA-E-0230', 'e2-past-ed', 'Past tense -ed', 'text', 2, 60, ITEM_TEXT.prompt, 'kira-original', 90, 10], 'english'), preview: ITEM_TEXT },
  { ...rowFrom(['KRA-E-0302', 'e2-writing-recount', 'Menulis cerita singkat', 'write', 3, 600, ITEM_WRITE.prompt, 'kira-original', null, 2], 'english'), preview: ITEM_WRITE },
  { ...rowFrom(['KRA-S-0120', 's2-life-cycles', 'Siklus hidup', 'order', 2, 60, ITEM_ORDER.prompt, 'kira-original', 79, 6], 'science'), preview: ITEM_ORDER },
  { ...rowFrom(['KRA-S-0144', 's2-materials', 'Magnet dan bahan', 'sort', 2, 75, ITEM_SORT.prompt, 'ai-draft', null, 0], 'science'), preview: ITEM_SORT },
]

export const PAPER: PaperDTO = {
  id: 'paper-w02-m-p7',
  title: 'Olympiad practice',
  subject: 'math',
  grade: 2,
  minutes: 15,
  mode: 'kertas',
  presetId: 'p7-olimpiade',
  itemRefs: ['KRA-M-0531', 'KRA-M-0532', 'KRA-M-0525', 'KRA-M-0522', 'KRA-M-0527', 'KRA-M-0523', 'KRA-M-0521', 'KRA-M-0524'],
  createdAt: '2026-10-15',
  code: 'W02-M-P7',
}

export const paperBuilder: PaperBuilderDTO = {
  shell,
  paper: PAPER,
  items: BANK_ITEMS,
  presets: [
    { id: 'p7-olimpiade', title: 'P7 Olimpiade: 10 soal, 15 menit' },
    { id: 'p10-mingguan', title: 'P10 Tes mingguan: 12 soal, 20 menit' },
  ],
  papers: [
    PAPER,
    { id: 'paper-w01-m-p1', title: 'Arrays and equal groups', subject: 'math', grade: 2, minutes: 20, mode: 'kertas', presetId: null, itemRefs: ['KRA-M-0398', 'KRA-M-0531'], createdAt: '2026-10-09', code: 'W01-M-P01' },
  ],
}

export const paperBuilderNew: PaperBuilderDTO = { ...paperBuilder, paper: null }

// ---------------------------------------------------------------------------
// Bank soal (T07)

export const BANK_SKILLS: ItemBankDTO['facets']['skills'] = Array.from(
  new Map(BANK_ITEMS.map((r) => [r.skillId, { id: r.skillId, title: r.skillTitle, subject: r.subject, grade: r.grade }])).values(),
)

/** Bank soal lengkap untuk pratinjau; halaman pratinjau menyaringnya menurut parameter URL. */
export const BANK_ROWS: BankItemRow[] = BANK_ITEMS.map(({ preview: _p, ...row }) => row)

const ANSWERS: Record<string, { answerText: string; explanation: string; hints: string[] }> = {
  'KRA-M-0521': { answerText: 'C, 5', explanation: '4 small triangles and 1 big triangle made of all of them.', hints: ['Count the small ones first.', 'Is there a big triangle too?'] },
  'KRA-M-0522': { answerText: '9', explanation: 'Twice as many as 3 is 6 blue balls. 3 + 6 = 9.', hints: ['How many blue balls does Tom have?'] },
  'KRA-M-0523': { answerText: '32', explanation: 'Each number is double the one before: 16 + 16 = 32.', hints: ['Compare 2 and 4, then 4 and 8.'] },
  'KRA-M-0524': { answerText: 'B, 4:15', explanation: 'Quarter to 4 is 3:45. 30 minutes later is 4:15.', hints: ['Quarter to 4 means 15 minutes before 4.'] },
  'KRA-M-0525': { answerText: 'C, Cici', explanation: 'Ana is taller than Ben and Ben is taller than Cici, so Cici is the shortest.', hints: ['Put the three names in order.'] },
  'KRA-M-0526': { answerText: '4', explanation: 'The cow has 4 legs. 12 minus 4 is 8 legs left, and each hen has 2 legs: 8 ÷ 2 = 4 hens.', hints: ['How many legs does the cow have?'] },
  'KRA-M-0527': { answerText: 'B, Thursday', explanation: '7 days later is Tuesday again. 2 more days is Thursday.', hints: ['What day is it 7 days from today?'] },
  'KRA-M-0528': { answerText: '5', explanation: '4 small squares and 1 big square around them.', hints: ['Do not forget the big square.'] },
  'KRA-M-0529': { answerText: 'Step 8', explanation: 'Each turn moves the frog 2 steps forward: 4 turns × 2 = 8.', hints: ['Where is the frog after one turn?'] },
  'KRA-M-0530': { answerText: 'C, 4', explanation: 'Two folds make 4 layers, so one punch makes 4 holes.', hints: ['How many layers of paper are there after two folds?'] },
  'KRA-M-0531': { answerText: '57', explanation: '10 more changes the tens digit: 4 tens become 5 tens.', hints: ['Which digit changes when you add 10?'] },
  'KRA-M-0532': { answerText: 'B, Square', explanation: 'A square has 4 equal sides and 4 square corners.', hints: ['Look at the sides first.'] },
  'KRA-M-0398': { answerText: 'B, 20', explanation: '4 rows with 5 apples in each row: 5 + 5 + 5 + 5 = 20, or 4 × 5 = 20.', hints: ['Count the apples in one row.', 'How many rows are there?'] },
  'ORG-ESMO-M-0007': { answerText: 'C, 19', explanation: 'Setiap lompatan bertambah 4: 3, 7, 11, 15, lalu 19.', hints: ['Berapa selisih 3 dan 7?'] },
  'KRA-M-0413': { answerText: '45 minutes past 7 (7:45)', explanation: '7:15 plus 30 minutes is 7:45.', hints: ['Count on in 5s from 15.'] },
}

export function itemBankFor(params: Record<string, string | undefined>): ItemBankDTO {
  const filters: ItemBankDTO['filters'] = {
    subject: (params.mapel as ItemBankDTO['filters']['subject']) ?? null,
    grade: params.grade ? Number(params.grade) : null,
    skillId: params.skill ?? null,
    type: params.tipe ?? null,
    difficulty: params.kesulitan ? Number(params.kesulitan) : null,
    source: params.sumber ?? null,
    q: params.q ?? '',
  }
  const t = filters.q.trim().toLowerCase()
  const all = BANK_ROWS.filter(
    (r) =>
      (!filters.subject || r.subject === filters.subject) &&
      (!filters.grade || r.grade === filters.grade) &&
      (!filters.skillId || r.skillId === filters.skillId) &&
      (!filters.type || r.type === filters.type) &&
      (!filters.difficulty || r.difficulty === filters.difficulty) &&
      (!filters.source || r.source === filters.source) &&
      (!t || r.promptPreview.toLowerCase().includes(t) || r.ref.toLowerCase().includes(t)),
  )
  const pageSize = 8
  const page = Math.max(1, Math.min(Math.ceil(all.length / pageSize) || 1, Number(params.halaman ?? '1') || 1))
  const rows = all.slice((page - 1) * pageSize, page * pageSize)
  const ref = params.soal ?? rows[0]?.ref
  const sel = BANK_ITEMS.find((i) => i.ref === ref)
  const { preview: item, ...row } = sel ?? ({} as (typeof BANK_ITEMS)[number])
  const ans = sel ? (ANSWERS[sel.ref] ?? { answerText: 'Lihat kunci di file soal', explanation: '', hints: [] }) : null
  return {
    shell,
    rows,
    total: all.length,
    page,
    pageSize,
    filters,
    facets: { skills: BANK_SKILLS },
    preview: sel && ans ? { row: row as BankItemRow, item, answerText: ans.answerText, explanation: ans.explanation, hints: ans.hints } : null,
  }
}

export function itemBankEmpty(): ItemBankDTO {
  return { shell, rows: [], total: 0, page: 1, pageSize: 8, filters: { subject: null, grade: null, skillId: null, type: null, difficulty: null, source: null, q: '' }, facets: { skills: [] }, preview: null }
}
