import { describe, expect, it } from 'vitest'
import { itemSchema, type Item } from '@kira/content/schema'
import { AI_ITEM_TYPES, NO_VARIANT_TYPES, itemForPrompt, itemsEnvelopeSchema, normaliseAiItem } from '../src/ai/item-schema'
import { checkDraft } from '../src/handlers/draft-checks'
import { structureProblems, translateGeometry } from '../src/handlers/drafts'

type Json = Record<string, unknown>

// Jenis soal baru: jawaban model menjadi soal Kira yang lolos itemSchema dan pemeriksaan draf.

const common = { difficulty: 2, lang: 'en-GB', hints: ['One.', 'Two.', 'Three.'], explanation: 'Because it fits.', tip: null, tags: [] }
const opt = (text: string, why: string | null = null) => ({ text, why })

const NEW_RAW: Record<string, Json> = {
  numberline: { ...common, type: 'numberline', prompt: 'Tap 35 on the number line.', min: 30, max: 40, step: 1, answer: 35, tolerance: 0 },
  clock: { ...common, type: 'clock', prompt: 'Show half past four.', hour: 4, minute: 30, stepMinutes: 5 },
  fraction: { ...common, type: 'fraction', prompt: 'Shade one half of the bar.', shape: 'bar', parts: 4, numerator: 1, denominator: 2 },
  story: {
    ...common,
    type: 'story',
    prompt: 'Mia has 8 mangoes. She gives 3 to Sam.',
    parts: [
      { type: 'numeric', prompt: 'How many mangoes does Mia have now?', options: [], answerIndex: null, answerNumber: 5, unit: null, accepted: [] },
      { type: 'mcq', prompt: 'Who has fewer mangoes?', options: [opt('Mia'), opt('Sam', 'Check who has 3.'), opt('Neither')], answerIndex: 1, answerNumber: null, unit: null, accepted: [] },
      { type: 'text', prompt: 'What fruit is it?', options: [], answerIndex: null, answerNumber: null, unit: null, accepted: ['mango', 'mangoes'] },
    ],
  },
  listen: { ...common, type: 'listen', prompt: 'Listen. Which animal did you hear?', listenText: 'I can see a cat on the mat.', options: [opt('dog'), opt('cat'), opt('hen')], answer: 1 },
  tiles: { ...common, type: 'tiles', prompt: 'Build the sentence.', answer: 'we eat rice and fish', alternatives: ['we eat fish and rice'], distractors: ['drink'] },
  spell: { ...common, type: 'spell', prompt: 'Listen, then spell the word.', word: 'hat', sentence: 'I wear a hat.' },
  cloze: { ...common, type: 'cloze', prompt: 'She ___ to school and ___ her friends.', gaps: [{ options: ['walks', 'walk'], answer: 0 }, { options: ['meet', 'meets'], answer: 1 }] },
  table: {
    ...common,
    type: 'table',
    prompt: 'Complete the table.',
    caption: null,
    head: ['Animal', 'Legs'],
    rows: [['Cat', '4'], ['Bird', '2'], ['Spider', '8']],
    blanks: [{ row: 1, col: 1, alsoAccept: [] }, { row: 2, col: 1, alsoAccept: ['eight'] }],
  },
  grid: {
    ...common,
    type: 'grid',
    prompt: 'Put 1 to 4 in every row, column and box once.',
    puzzle: 'sudoku',
    given: [[1, 2, 0, 4], [0, 4, 1, 0], [0, 1, 4, 0], [4, 3, 0, 1]],
    filled: [[1, 2, 3, 4], [3, 4, 1, 2], [2, 1, 4, 3], [4, 3, 2, 1]],
  },
  hotspot: { ...common, type: 'hotspot', prompt: 'Tap the animal that lives in water.', pictures: [{ icon: 'cat', label: 'cat' }, { icon: 'fish', label: 'fish' }, { icon: 'hen', label: 'hen' }], answers: ['fish'] },
  label: { ...common, type: 'label', prompt: 'Put each label on its picture.', pictures: [{ icon: 'sun', label: 'sun' }, { icon: 'moon', label: 'moon' }], extraLabels: ['star'] },
  photo: { ...common, hints: [], type: 'photo', prompt: 'Work it out on paper, then take a photo.', rubric: { criteria: [{ label: 'Shows the working', points: 2 }, { label: 'Correct answer', points: 2 }] } },
}

describe('jenis soal baru dari model', () => {
  it('semua jenis ada di AI_ITEM_TYPES dan skema modelnya bisa dibuat', () => {
    for (const t of Object.keys(NEW_RAW)) expect(AI_ITEM_TYPES).toContain(t)
    expect(JSON.stringify(itemsEnvelopeSchema(AI_ITEM_TYPES))).toContain('"listenText"')
    expect(NO_VARIANT_TYPES).toEqual([])
  })

  for (const [type, raw] of Object.entries(NEW_RAW)) {
    it(`${type}: lolos itemSchema dan pemeriksaan draf tanpa masalah`, () => {
      const n = normaliseAiItem(raw, { skill: 'e2.test' })
      expect(n.reason).toBeNull()
      const parsed = itemSchema.safeParse(n.candidate)
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true)
      expect(checkDraft(n.candidate!).problems).toEqual([])
    })
  }

  it('clock, fraction, dan numberline menjadi bentuk Kira', () => {
    expect(normaliseAiItem(NEW_RAW.clock!, { skill: 'm2.time' }).candidate).toMatchObject({ answer: { h: 4, m: 30 }, stepMinutes: 5 })
    expect(normaliseAiItem(NEW_RAW.fraction!, { skill: 'm2.fractions' }).candidate).toMatchObject({ answer: { num: 1, den: 2 }, parts: 4 })
    expect(normaliseAiItem(NEW_RAW.numberline!, { skill: 'm2.line' }).candidate).toMatchObject({ min: 30, max: 40, answer: 35 })
  })

  it('tabel: sel yang disembunyikan dikosongkan dan jawabannya diambil dari rows', () => {
    const c = normaliseAiItem(NEW_RAW.table!, { skill: 'e2.test' }).candidate!
    expect(c.rows).toEqual([['Cat', '4'], ['Bird', ''], ['Spider', '']])
    expect(c.blanks).toEqual([{ row: 1, col: 1, answers: ['2'] }, { row: 2, col: 1, answers: ['8', 'eight'] }])
  })

  it('hotspot dan label dibuat dari gambar ikon dengan area di tengah tiap gambar', () => {
    const h = normaliseAiItem(NEW_RAW.hotspot!, { skill: 'e1.test' }).candidate!
    expect(h.answers).toEqual([1])
    expect((h.regions as Json[]).map((r) => r.label)).toEqual(['cat', 'fish', 'hen'])
    expect((h.figure as Json).kind).toBe('scene')
    const l = normaliseAiItem(NEW_RAW.label!, { skill: 'e1.test' }).candidate!
    expect(l.labels).toEqual(['sun', 'moon'])
    expect(l.spots).toHaveLength(2)
  })

  it('hotspot dengan ikon yang tidak dikenal ditandai tanpa figur', () => {
    const bad = normaliseAiItem({ ...NEW_RAW.hotspot, pictures: [{ icon: 'dragon', label: 'dragon' }, { icon: 'fish', label: 'fish' }], answers: ['fish'] }, { skill: 'e1.test' })
    expect(bad.candidate).not.toHaveProperty('figure')
    const c = checkDraft(bad.candidate!)
    expect(c.parsed).toBeNull()
    expect(c.problems.length).toBeGreaterThan(0)
  })

  it('listen: prompt yang memuat teks dengar ditandai', () => {
    const c = checkDraft(normaliseAiItem({ ...NEW_RAW.listen, prompt: 'Listen: I can see a cat on the mat. Which animal?' }, { skill: 'e1.test' }).candidate!)
    expect(c.problems.join()).toContain('listenText')
  })

  it('spell dan tiles: prompt tidak boleh membocorkan jawaban', () => {
    expect(checkDraft(normaliseAiItem({ ...NEW_RAW.spell, prompt: 'Spell the word hat.' }, { skill: 'e1.test' }).candidate!).problems.join()).toContain('eja')
    expect(checkDraft(normaliseAiItem({ ...NEW_RAW.tiles, prompt: 'Build: we eat rice and fish' }, { skill: 'e1.test' }).candidate!).problems.join()).toContain('kalimat jawaban')
  })

  it('grid yang punya lebih dari satu penyelesaian ditandai', () => {
    const raw = { ...NEW_RAW.grid, given: [[1, 0, 0, 4], [0, 4, 1, 0], [0, 1, 4, 0], [4, 0, 0, 1]] }
    expect(checkDraft(normaliseAiItem(raw, { skill: 'm2.test' }).candidate!).problems.join()).toContain('tepat satu')
  })

  it('kata terlarang dan em dash di teks jenis baru terdeteksi', () => {
    const dash = String.fromCharCode(0x2014)
    const l = checkDraft(normaliseAiItem({ ...NEW_RAW.listen, listenText: `I can see a cat ${dash} on the mat.` }, { skill: 'e1.test' }).candidate!)
    expect(l.problems.some((p) => p.startsWith('Ada em dash'))).toBe(true)
    const t = checkDraft(normaliseAiItem({ ...NEW_RAW.tiles, answer: 'we unlock rice and fish', alternatives: [] }, { skill: 'e1.test' }).candidate!)
    expect(t.problems.some((p) => p.startsWith('Kata terlarang'))).toBe(true)
  })

  it('prompt tabel tidak dianggap menyebut gambar yang tidak ada', () => {
    const c = checkDraft(normaliseAiItem({ ...NEW_RAW.table, prompt: 'Look at the table and complete it.' }, { skill: 'e1.test' }).candidate!)
    expect(c.problems).toEqual([])
  })
})

describe('structureProblems untuk jenis baru', () => {
  const source = itemSchema.parse({ ...normaliseAiItem(NEW_RAW.cloze!, { skill: 'e2.test' }).candidate!, id: 'e2.test.001' }) as Item
  it('jumlah celah berubah', () => {
    expect(structureProblems(source, { type: 'cloze', gaps: [{}, {}] })).toEqual([])
    expect(structureProblems(source, { type: 'cloze', gaps: [{}] })).toContain('Jumlah celah berubah dari soal asal.')
  })
})

describe('hotspot dan label untuk varian dan terjemahan AI', () => {
  const asItem = (type: 'hotspot' | 'label'): Item => {
    const n = normaliseAiItem(NEW_RAW[type]!, { skill: 'e1.test' }).candidate!
    return itemSchema.parse({ ...n, id: 'e1.test.001' })
  }

  it('bahan prompt memakai bentuk model (daftar gambar), bukan area dan titik', () => {
    const h = itemForPrompt(asItem('hotspot')) as Record<string, unknown>
    expect(h.regions).toBeUndefined()
    expect(h.figure).toBeUndefined()
    expect(h.pictures).toEqual([{ label: 'cat' }, { label: 'fish' }, { label: 'hen' }])
    expect(h.answers).toEqual(['fish'])
    const l = itemForPrompt(asItem('label')) as Record<string, unknown>
    expect(l.spots).toBeUndefined()
    expect(l.pictures).toEqual([{ label: 'sun' }, { label: 'moon' }])
    expect(l.extraLabels).toEqual(['star'])
  })

  it('varian: jawaban model dengan ikon baru lolos pemeriksaan draf sebagai soal baru', () => {
    const raw = { ...NEW_RAW.hotspot, prompt: 'Tap the animal that can fly.', pictures: [{ icon: 'hen', label: 'hen' }, { icon: 'fish', label: 'fish' }, { icon: 'cat', label: 'cat' }], answers: ['hen'] }
    const n = normaliseAiItem(raw, { skill: 'e1.test' })
    expect(n.reason).toBeNull()
    const c = checkDraft(n.candidate!, { source: asItem('hotspot') as unknown as Record<string, unknown>, siblings: [] })
    expect(c.body.answers).toEqual([0])
    expect(c.problems.filter((p) => /tidak diminta|skema/i.test(p))).toEqual([])
  })

  it('terjemahan hotspot: gambar dan area tetap, hanya label dan teks berganti', () => {
    const source = asItem('hotspot')
    const t = normaliseAiItem({ ...NEW_RAW.hotspot, prompt: 'Ketuk hewan yang hidup di air.', pictures: [{ icon: 'cat', label: 'kucing' }, { icon: 'fish', label: 'ikan' }, { icon: 'hen', label: 'ayam' }], answers: ['ikan'] }, { skill: 'e1.test', lang: 'id' }).candidate!
    const out = translateGeometry(source, { ...t, lang: 'id' })
    if (!('body' in out)) throw new Error(out.reason)
    const s = source as Extract<Item, { type: 'hotspot' }>
    expect(out.body.figure).toEqual(source.figure)
    expect((out.body.regions as { label: string; x: number }[]).map((r) => r.label)).toEqual(['kucing', 'ikan', 'ayam'])
    expect((out.body.regions as { x: number }[]).map((r) => r.x)).toEqual(s.regions.map((r) => r.x))
    expect(out.body.answers).toEqual(s.answers)
    expect(structureProblems(source, out.body)).toEqual([])
  })

  it('terjemahan label: titik tetap, jumlah label berbeda ditolak', () => {
    const source = asItem('label') as Extract<Item, { type: 'label' }>
    const ok = normaliseAiItem({ ...NEW_RAW.label, prompt: 'Taruh setiap label pada gambarnya.', pictures: [{ icon: 'sun', label: 'matahari' }, { icon: 'moon', label: 'bulan' }], extraLabels: ['bintang'] }, { skill: 'e1.test', lang: 'id' }).candidate!
    const out = translateGeometry(source, { ...ok, lang: 'id' })
    if (!('body' in out)) throw new Error(out.reason)
    expect(out.body.labels).toEqual(['matahari', 'bulan'])
    expect(out.body.spots).toEqual(source.spots)
    expect(out.body.extraLabels).toEqual(['bintang'])
    const more = normaliseAiItem({ ...NEW_RAW.label, pictures: [{ icon: 'sun', label: 'a' }, { icon: 'moon', label: 'b' }, { icon: 'star', label: 'c' }], extraLabels: [] }, { skill: 'e1.test', lang: 'id' }).candidate!
    expect(translateGeometry(source, { ...more, lang: 'id' })).toEqual({ reason: 'Jumlah label di terjemahan tidak sama dengan soal asal.' })
  })
})
