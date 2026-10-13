import { describe, expect, it } from 'vitest'
import { itemSchema, type Item } from '@kira/content/schema'
import { AI_ITEM_TYPES, HINTS_SCHEMA, RUBRIC_SCHEMA, itemsEnvelopeSchema, itemJsonSchema, normaliseAiItem, normaliseTags } from '../src/ai/item-schema'
import { checkDraft, jaccard } from '../src/handlers/draft-checks'
import { structureProblems, summary } from '../src/handlers/drafts'
import { GRADE_SCHEMA } from '../src/handlers/grade'

type Json = Record<string, unknown>

/**
 * Aturan mode strict yang dipakai Claude Code CLI 2.1.295 untuk --json-schema (kata kunci yang
 * diizinkan, anyOf tanpa saudara, type primitif) ditambah aturan strict OpenAI (semua properti
 * wajib, additionalProperties false).
 */
const ALLOWED = new Set(['$schema', 'type', 'description', 'title', 'properties', 'required', 'additionalProperties', 'items', 'enum', 'const', 'anyOf'])
const PRIMITIVES = new Set(['string', 'integer', 'number', 'boolean', 'null'])
function assertStrict(node: Json, path = '$'): void {
  for (const k of Object.keys(node)) if (!ALLOWED.has(k)) throw new Error(`${path}: kata kunci ${k} tidak didukung`)
  if (node.anyOf) {
    for (const k of Object.keys(node)) if (!['anyOf', 'description', 'title', '$schema'].includes(k)) throw new Error(`${path}: anyOf punya saudara ${k}`)
    ;(node.anyOf as Json[]).forEach((b, i) => assertStrict(b, `${path}.anyOf[${i}]`))
    return
  }
  const t = node.type
  if (Array.isArray(t)) {
    if (!t.every((x) => PRIMITIVES.has(x))) throw new Error(`${path}: type array hanya untuk tipe primitif`)
  } else if (t === 'object') {
    const props = node.properties as Json
    if (!props) throw new Error(`${path}: object tanpa properties`)
    if (node.additionalProperties !== false) throw new Error(`${path}: additionalProperties harus false`)
    expect([...(node.required as string[])].sort()).toEqual(Object.keys(props).sort())
    for (const [k, v] of Object.entries(props)) assertStrict(v as Json, `${path}.${k}`)
  } else if (t === 'array') {
    if (!node.items || Array.isArray(node.items)) throw new Error(`${path}: array butuh satu skema items`)
    assertStrict(node.items as Json, `${path}[]`)
  } else if (typeof t === 'string') {
    if (!PRIMITIVES.has(t)) throw new Error(`${path}: type ${t} tidak dikenal`)
    if (node.properties || node.items) throw new Error(`${path}: kata kunci tidak cocok dengan type`)
  } else if (!node.enum && !('const' in node)) throw new Error(`${path}: tanpa type`)
}

describe('skema JSON untuk model', () => {
  it('semua skema lolos aturan strict Claude Code dan OpenAI', () => {
    assertStrict(itemsEnvelopeSchema(AI_ITEM_TYPES))
    for (const t of AI_ITEM_TYPES) assertStrict(itemJsonSchema([t]))
    assertStrict(HINTS_SCHEMA)
    assertStrict(RUBRIC_SCHEMA)
    assertStrict(GRADE_SCHEMA)
  })

  it('tanpa figure, passage, dan solution', () => {
    const text = JSON.stringify(itemsEnvelopeSchema(AI_ITEM_TYPES))
    expect(text).not.toMatch(/"figure"|"passage"|"solution"/)
  })
})

const mcqRaw = {
  type: 'mcq',
  difficulty: 2,
  lang: 'en-GB',
  prompt: 'Sari has 8 mangoes. She gives away 3. How many are left?',
  hints: ['Start with 8.', 'Take away 3.', 'Count back 3 from 8.'],
  explanation: '8 take away 3 is 5.',
  tip: null,
  tags: ['Subtraction ', 'within_10'],
  options: [
    { text: '5', why: null },
    { text: '11', why: 'This adds instead of taking away.' },
    { text: '4', why: 'Count back carefully.' },
  ],
  answer: 0,
}

describe('normaliseAiItem', () => {
  it('mcq dari model menjadi soal Kira yang lolos itemSchema', () => {
    const n = normaliseAiItem(mcqRaw, { skill: 'm2.subtraction' })
    expect(n.reason).toBeNull()
    const parsed = itemSchema.safeParse(n.candidate)
    expect(parsed.success).toBe(true)
    expect(n.candidate).toMatchObject({ id: 'draft', source: 'ai-draft', skill: 'm2.subtraction', tags: ['subtraction', 'within-10'] })
    expect(n.candidate!.tip).toBeUndefined()
    expect((n.candidate!.options as Json[])[0]).toEqual({ text: '5' })
  })

  it('match: pasangan objek menjadi tuple, write: isian kosong dibuang', () => {
    const m = normaliseAiItem(
      { type: 'match', difficulty: 1, lang: 'en-GB', prompt: 'Match.', hints: ['a', 'b', 'c'], explanation: 'e', tip: null, tags: [], pairs: [{ left: 'cat', right: 'kitten' }, { left: 'dog', right: 'puppy' }] },
      { skill: 'e1.animals' },
    )
    expect(m.candidate!.pairs).toEqual([['cat', 'kitten'], ['dog', 'puppy']])
    const w = normaliseAiItem(
      { type: 'write', difficulty: 2, lang: 'en-GB', prompt: 'Write about rain.', hints: [], explanation: 'Use full stops.', tip: null, tags: [], rubric: { criteria: [{ label: 'Uses full stops', points: 1 }] }, minWords: null, maxWords: 30, planning: [], model: null },
      { skill: 'e2.write-sentences' },
    )
    expect(w.candidate).not.toHaveProperty('minWords')
    expect(w.candidate).not.toHaveProperty('planning')
    expect(w.candidate!.maxWords).toBe(30)
    expect(itemSchema.safeParse(w.candidate).success).toBe(true)
  })

  it('bentuk yang tidak terbaca ditolak dengan alasan', () => {
    expect(normaliseAiItem('teks', { skill: 'm2.x' }).reason).toBe('bukan objek JSON')
    expect(normaliseAiItem({ type: 'carousel', prompt: 'x' }, { skill: 'm2.x' }).reason).toMatch(/jenis soal tidak dikenal/)
    expect(normaliseAiItem({ type: 'mcq', prompt: '  ' }, { skill: 'm2.x' }).reason).toBe('prompt kosong')
  })

  it('tag dinormalisasi', () => {
    expect(normaliseTags(['ESMO', 'word problem', 'x!y', 'esmo'])).toEqual(['esmo', 'word-problem', 'xy'])
  })
})

describe('checkDraft', () => {
  const ok = normaliseAiItem(mcqRaw, { skill: 'm2.subtraction' }).candidate!

  it('draf bersih tanpa masalah', () => {
    expect(checkDraft(ok).problems).toEqual([])
  })

  it('hint bukan 3, penjelasan kosong, jawaban di luar opsi, opsi kembar', () => {
    const bad = { ...ok, hints: ['Only one.'], explanation: undefined, answer: 7, options: [{ text: '5' }, { text: '5' }, { text: '6' }] }
    const c = checkDraft(bad)
    expect(c.parsed).toBeNull()
    expect(c.problems).toEqual(expect.arrayContaining(['Hint harus tepat 3 untuk soal yang dinilai otomatis, sekarang 1.', 'Penjelasan kosong.', 'answer di luar opsi', 'Opsi kembar']))
  })

  it('em dash, kata terlarang, dan bingkai antitesis', () => {
    const dash = String.fromCharCode(0x2014)
    const c = checkDraft({ ...ok, explanation: `8 take away 3 ${dash} that is 5. It is crucial.`, tip: 'This is not just maths, it is fun.' })
    expect(c.problems.some((p) => p.startsWith('Ada em dash atau en dash'))).toBe(true)
    expect(c.problems.some((p) => p.startsWith('Kata terlarang GTX'))).toBe(true)
    expect(c.problems.some((p) => p.startsWith('Ada bingkai antitesis'))).toBe(true)
  })

  it('prompt menyebut gambar tanpa figur', () => {
    expect(checkDraft({ ...ok, prompt: 'Look at the picture. How many apples?' }).problems).toContain('Prompt menyebut gambar, tabel, atau diagram, padahal draf ini tidak punya figur.')
    expect(checkDraft({ ...ok, prompt: 'Look at the picture. How many apples?' }, { hasFigure: true }).problems).toEqual([])
  })

  it('varian yang terlalu mirip dengan soal asal dan dengan draf lain', () => {
    const variant = { ...ok, prompt: 'Sari has 8 mangoes. She gives away 3. How many are left now?' }
    expect(checkDraft(variant, { source: ok }).problems).toContain('Terlalu mirip dengan soal asal.')
    const fresh = { ...ok, prompt: 'Budi has 9 kites. 4 fly away. How many kites does he have?', options: [{ text: '5' }, { text: '13' }, { text: '6' }] }
    expect(checkDraft(fresh, { source: ok }).problems).toEqual([])
    expect(checkDraft(fresh, { siblings: [fresh] }).problems).toContain('Mirip dengan draf lain di job ini.')
  })

  it('jaccard', () => {
    expect(jaccard(['a', 'b'], ['a', 'b'])).toBe(1)
    expect(jaccard(['a', 'b'], ['c'])).toBe(0)
  })
})

describe('structureProblems (terjemahan)', () => {
  const source = itemSchema.parse({ ...normaliseAiItem(mcqRaw, { skill: 'm2.subtraction' }).candidate!, id: 'm2.subtraction.001' }) as Item

  it('jawaban yang sama tidak bermasalah', () => {
    expect(structureProblems(source, { type: 'mcq', answer: 0, options: [{}, {}, {}] })).toEqual([])
  })

  it('posisi jawaban atau jenis berubah', () => {
    expect(structureProblems(source, { type: 'mcq', answer: 1, options: [{}, {}, {}] })).toEqual(['Posisi jawaban benar berubah dari soal asal.'])
    expect(structureProblems(source, { type: 'numeric', answer: 5 })).toEqual(['Jenis soal berubah dari soal asal.'])
  })
})

describe('summary', () => {
  it('ringkasan Indonesia untuk konsol', () => {
    expect(summary([{ body: {}, problems: [] }, { body: {}, problems: ['x'] }], 1)).toBe('2 draf dibuat, 1 perlu dicek, 1 jawaban AI tidak terbaca dan dilewati.')
    expect(summary([{ body: {}, problems: [] }], 0)).toBe('1 draf dibuat.')
  })
})

describe('checkDraft: draf yang belum lolos skema selalu punya masalah', () => {
  const base = normaliseAiItem(
    { type: 'numeric', difficulty: 2, lang: 'en-GB', prompt: 'What is 46 + 32?', hints: ['a', 'b', 'c'], explanation: '78.', tip: null, tags: [], answer: 78, tolerance: 0, unit: null, allowNegative: false, allowDecimal: false },
    { skill: 'm2.addition' },
  ).candidate!

  it('jawaban numerik hilang tetap dilaporkan', () => {
    const c = checkDraft({ ...base, answer: undefined })
    expect(c.parsed).toBeNull()
    expect(c.problems).toContain('answer: isian kosong atau tipenya salah.')
  })

  it('hint terlalu panjang dilaporkan, jumlah hint tidak dobel', () => {
    const c = checkDraft({ ...base, hints: ['x'.repeat(250), 'b'] })
    expect(c.problems).toContain('Hint harus tepat 3 untuk soal yang dinilai otomatis, sekarang 2.')
    expect(c.problems.some((p) => p.startsWith('hints.0: terlalu banyak atau terlalu panjang'))).toBe(true)
    expect(c.problems.some((p) => p.startsWith('hints: '))).toBe(false)
  })

  it('kutipan em dash di daftar masalah diganti [tanda pisah]', () => {
    const c = checkDraft({ ...base, explanation: `78 ${String.fromCharCode(0x2014)} tens then ones.` })
    expect(c.problems).toEqual(['Ada em dash atau en dash: "78 [tanda pisah] tens then ones."'])
  })
})
