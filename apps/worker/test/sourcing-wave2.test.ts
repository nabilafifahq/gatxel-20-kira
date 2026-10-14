import { describe, expect, it } from 'vitest'
import { findContentDir, loadContent } from '@kira/content/load'
import { loadRegistry } from '@kira/content/extras'
import { allowedHosts, canAutoFetch } from '@kira/content/sources'
import { buildItem } from '../src/sourcing/build-item'
import { BLIMP_CONFIGS, parseBlimp } from '../src/sourcing/datasets/blimp'
import { primaryGrade } from '../src/sourcing/datasets/primary'
import { parseQasc } from '../src/sourcing/datasets/qasc'
import { parseSciq } from '../src/sourcing/datasets/sciq'
import { parseTabmwp } from '../src/sourcing/datasets/tabmwp'
import { mapCandidate } from '../src/sourcing/map'
import type { Candidate } from '../src/sourcing/types'

const content = loadContent(findContentDir()).index
const skillsOf = (s: Candidate['subject'], g: number) => content.skillsByKey.get(`${s}:${g}`) ?? []

const hf = (rows: Record<string, unknown>[], total = 1000) => JSON.stringify({ rows: rows.map((row, i) => ({ row_idx: i, row })), num_rows_total: total })

describe('TabMWP', () => {
  const data = {
    '1': { question: 'Look at the table. Then answer the question. How many apples does Mia have?', choices: null, answer: '12', unit: null, table_title: 'Apples', table: 'Name | Apples\nMia | 12\nTom | 9', row_num: 3, column_num: 2, solution: 'Find Mia in the table.\n\nMia has 12 apples.', ques_type: 'free_text', ans_type: 'integer_number', grade: 2 },
    '2': { question: 'Who has more apples?', choices: ['Mia', 'Tom'], answer: 'Mia', unit: null, table_title: null, table: 'Name | Apples\nMia | 12\nTom | 9', row_num: 3, column_num: 2, solution: 'Mia has more.', ques_type: 'multi_choice', ans_type: 'extractive_text', grade: 3 },
    '3': { question: 'What is the mean?', choices: null, answer: '4.5', unit: 'cm', table_title: 'Lengths', table: 'Item | Length\nA | 4\nB | 5', row_num: 3, column_num: 2, solution: 'Add and divide.', ques_type: 'free_text', ans_type: 'decimal_number', grade: 5 },
    '4': { question: 'Grade seven question.', choices: null, answer: '1', table: 'A | B\n1 | 2', ques_type: 'free_text', ans_type: 'integer_number', grade: 7 },
    '5': { question: 'Which word?', choices: null, answer: 'cat', table: 'A | B\n1 | 2', ques_type: 'free_text', ans_type: 'extractive_text', grade: 2 },
    '6': { question: 'Big table?', choices: null, answer: '1', table: 'A | B\n1 | 2', row_num: 20, column_num: 2, ques_type: 'free_text', ans_type: 'integer_number', grade: 2 },
  }
  const parsed = parseTabmwp(JSON.stringify(data))
  it('mengubah soal bilangan dan pilihan ganda, membuang kelas tinggi, jawaban teks bebas, dan tabel besar', () => {
    expect(parsed.rawCount).toBe(6)
    const c = parsed.rows
    expect(c[0]).toMatchObject({ type: 'numeric', grade: 2, answer: 12, topicHint: 'table-data' })
    expect(c[0]!.prompt).toBe('Apples\nName | Apples\nMia | 12\nTom | 9\n\nHow many apples does Mia have?')
    expect(c[1]).toMatchObject({ type: 'mcq', options: ['Mia', 'Tom'], answer: 0 })
    expect(c[2]).toMatchObject({ type: 'numeric', answer: 4.5, allowDecimal: true, unit: 'cm' })
    expect(c.slice(3)).toEqual([null, null, null])
  })
  it('galat JSON tidak melempar', () => {
    expect(parseTabmwp('bukan json')).toEqual({ rows: [], rawCount: 0 })
    expect(parseTabmwp('[]')).toEqual({ rows: [], rawCount: 0 })
  })
  it('dipetakan ke skill data di kelas itu dan lolos pembangun soal', () => {
    for (const c of parsed.rows.filter((x): x is Candidate => x !== null)) {
      const m = mapCandidate(c, skillsOf)
      expect(m, c.externalId).not.toBeNull()
      if (c.grade === 2) expect(m!.skillId).toBe('m2.charts')
      expect(buildItem(c, m!, 'tabmwp').ok).toBe(true)
    }
  })
})

describe('penyaring tingkat SD', () => {
  it('meloloskan soal pendek dan membuang istilah SMP, soal panjang, dan kata panjang', () => {
    expect(primaryGrade('What do plants need to grow?', ['water', 'sand', 'plastic', 'glass'])).toBe(3)
    expect(primaryGrade('What is the powerhouse of the cell called in biology?', ['photosynthesis', 'a', 'b', 'c'])).toBeNull()
    expect(primaryGrade('What type of molecule carries genetic information?', ['rope', 'sand', 'wire', 'tape'])).toBeNull()
    expect(primaryGrade('Why?', ['a', 'b'])).toBeNull()
    expect(primaryGrade('What do the roots of a tall tree take in from the ground below it each day for the tree to be able to grow big and strong?', ['water', 'sand', 'rock', 'ice'])).toBeNull()
  })
})

describe('SciQ', () => {
  const row = (q: string, c: string, d: [string, string, string]) => ({ question: q, correct_answer: c, distractor1: d[0], distractor2: d[1], distractor3: d[2], support: 'x' })
  const parsed = parseSciq(hf([row('What do plants need to grow?', 'water', ['sand', 'plastic', 'glass']), row('What is the term for a kind of molecule?', 'atom', ['a', 'b', 'c']), row('What do plants need?', 'water', ['water', 'sand', 'glass']), row('Sentence without question mark', 'x', ['y', 'z', 'w'])], 13679))
  it('hanya soal tingkat SD dengan empat opsi berbeda yang dipakai', () => {
    expect(parsed.rawCount).toBe(4)
    expect(parsed.total).toBe(13679)
    const c = parsed.rows[0]!
    expect(c).toMatchObject({ subject: 'science', type: 'mcq', grade: 3 })
    expect(c.options![c.answer]).toBe('water')
    expect(c.options).toHaveLength(4)
    expect(parsed.rows.slice(1)).toEqual([null, null, null])
  })
  it('urutan opsi tetap untuk soal yang sama', () => {
    const again = parseSciq(hf([row('What do plants need to grow?', 'water', ['sand', 'plastic', 'glass'])]))
    expect(again.rows[0]!.options).toEqual(parsed.rows[0]!.options)
  })
  it('JSON rusak tidak melempar', () => {
    expect(parseSciq('x')).toEqual({ rows: [], rawCount: 0, total: 0 })
  })
})

describe('QASC', () => {
  const choices = { text: ['pearls', 'streams', 'shells', 'diamonds', 'rain', 'beads', 'cooled', 'liquid'], label: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] }
  const parsed = parseQasc(hf([{ id: 'Q1', question: 'What forms from clouds?', choices, answerKey: 'E', combinedfact: 'Clouds can make rain' }, { id: 'Q2', question: 'What forms from clouds?', choices, answerKey: 'Z' }, { id: 'Q3', question: 'What forms from clouds', choices, answerKey: 'E' }], 8134))
  it('delapan pilihan dikurangi menjadi empat dengan jawaban benar tetap ada', () => {
    const c = parsed.rows[0]!
    expect(c.options).toHaveLength(4)
    expect(c.options![c.answer]).toBe('rain')
    expect(c.explanation).toBe('Clouds can make rain.')
    expect(c.externalId).toBe('qasc-Q1')
    expect(parsed.rows.slice(1)).toEqual([null, null])
  })
  it('lolos pembangun soal dan petakan ke skill Science', () => {
    const c = parsed.rows[0]!
    const m = mapCandidate(c, skillsOf)
    expect(m).not.toBeNull()
    expect(buildItem(c, m!, 'qasc').ok).toBe(true)
  })
})

describe('BLiMP (sumber English)', () => {
  it('semua fenomena dipasang ke skill English yang ada di kelasnya', () => {
    expect(BLIMP_CONFIGS.length).toBeGreaterThanOrEqual(9)
    for (const config of BLIMP_CONFIGS) {
      const p = parseBlimp(hf([{ sentence_good: 'The boys have eaten all the apples.', sentence_bad: 'The boys have ate all the apples.', pair_id: 7 }]), config)
      const c = p.rows[0]!
      expect(c, config).not.toBeNull()
      const m = mapCandidate(c, skillsOf)
      expect(m, config).toEqual({ skillId: c.skillHint, grade: c.grade })
      const built = buildItem(c, m!, 'blimp')
      expect(built.ok, config).toBe(true)
      if (built.ok) expect(built.item.lang).toBe('en-GB')
    }
  })
  it('kunci selalu kalimat yang benar dan opsi dibuat deterministik', () => {
    const rows = [
      { sentence_good: 'The boys have eaten all the apples.', sentence_bad: 'The boys have ate all the apples.', pair_id: 1 },
      { sentence_good: 'These girls are very kind people.', sentence_bad: 'This girls are very kind people.', pair_id: 2 },
      { sentence_good: 'The cat sat on the warm mat today.', sentence_bad: 'The cat sit on the warm mat today.', pair_id: 3 },
      { sentence_good: 'Mia hurt herself on the playground.', sentence_bad: 'Mia hurt himself on the playground.', pair_id: 4 },
    ]
    const a = parseBlimp(hf(rows), 'determiner_noun_agreement_1')
    const b = parseBlimp(hf(rows), 'determiner_noun_agreement_1')
    expect(a.rows).toEqual(b.rows)
    a.rows.forEach((c, i) => expect(c!.options![c!.answer]).toBe(rows[i]!.sentence_good))
    expect(a.rows.map((c) => c!.answer)).toContain(0)
    expect(a.rows.map((c) => c!.answer)).toContain(1)
    expect(a.rows[0]!.dedupeKey).toBe(rows[0]!.sentence_good)
  })
  it('membuang pasangan tak aman, terlalu panjang, atau fenomena tak dikenal', () => {
    const bad = hf([{ sentence_good: 'The soldiers killed many people there.', sentence_bad: 'The soldiers kills many people there.' }, { sentence_good: 'x'.repeat(100), sentence_bad: 'y' }])
    expect(parseBlimp(bad, 'determiner_noun_agreement_1').rows).toEqual([null, null])
    expect(parseBlimp(hf([{ sentence_good: 'The boys are here today.', sentence_bad: 'The boys is here today.' }]), 'tidak_ada').rows).toEqual([null])
  })
})

describe('registri sumber gelombang 2', () => {
  const { registry, errors } = loadRegistry(findContentDir())
  it('valid, dan sumber baru diambil otomatis hanya dari host yang diizinkan', () => {
    expect(errors).toEqual([])
    for (const id of ['tabmwp-dataset', 'sciq-dataset', 'qasc-dataset', 'blimp']) {
      const s = registry!.sources.find((x) => x.id === id)!
      expect(s, id).toBeTruthy()
      expect(canAutoFetch(s), id).toBe(true)
      expect(allowedHosts(s)).toHaveLength(1)
    }
    const blimp = registry!.sources.find((x) => x.id === 'blimp')!
    expect(blimp.subjects).toEqual(['english'])
    expect(blimp.license).toBe('cc-by')
  })
  it('importer SciQ tetap nonkomersial dan tidak boleh masuk repo', () => {
    expect(registry!.sources.find((x) => x.id === 'sciq-dataset')!.license).toBe('cc-by-nc')
    expect(registry!.sources.find((x) => x.id === 'tabmwp-dataset')!.license).toBe('cc-by-nc-sa')
  })
})
