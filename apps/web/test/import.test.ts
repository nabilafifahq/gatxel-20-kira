import { describe, expect, it } from 'vitest'
import type { Skill } from '@kira/content'
import {
  buildImportedItem,
  cleanImportedText,
  competitionLang,
  detectCompetition,
  detectLang,
  importTags,
  nextPackNumber,
  normalizeTag,
  parseLabels,
  pickImportSkill,
  statusAfterEdit,
  type CatalogEntry,
} from '@/server/dal/console-import'

const CATALOG: CatalogEntry[] = [
  { id: 'imso', tags: ['imso'], langBySubject: {}, lang: ['en-GB'] },
  { id: 'esmo', tags: ['esmo'], langBySubject: { math: 'id', english: 'en-GB' }, lang: ['id', 'en-GB'] },
  { id: 'kmnr', tags: ['kmnr'], langBySubject: { math: 'id' }, lang: ['id'] },
  { id: 'cambridge-checkpoint', tags: ['checkpoint'], langBySubject: { math: 'en-GB' }, lang: ['en-GB'] },
]

function skill(id: string, order: number, extra: Partial<Skill> = {}): Skill {
  return { id, subject: 'math', grade: 2, strand: 'Nc', title: id, titleId: id, canDo: 'I can.', order, prerequisites: [], competitions: [], generator: false, ...extra }
}

describe('statusAfterEdit: status soal setelah diedit tutor', () => {
  const clean = { prompt: 'Berapa 3 + 4?', options: ['6', '7', '8', '9'], answer: 1 }
  it('edit menyelesaikan sisa teks kunci, pecahan rusak, dan kunci yang tidak cocok', () => {
    expect(statusAfterEdit('leftover-key-text', clean)).toBe('ok')
    expect(statusAfterEdit('broken-fraction', { ...clean, options: ['1/4', '1/2', '3/4', '2/4'] })).toBe('ok')
    expect(statusAfterEdit('key-mismatch', clean)).toBe('ok')
    expect(statusAfterEdit('ok', clean)).toBe('ok')
  })

  it('masalah yang masih ada di teks tetap ditandai', () => {
    expect(statusAfterEdit('leftover-key-text', { ...clean, prompt: 'Berapa 3 + 4? Jawaban: B' })).toBe('leftover-key-text')
    expect(statusAfterEdit('broken-fraction', { ...clean, options: ['1 4', '1 2', '3 4', '2 4'] })).toBe('broken-fraction')
    expect(statusAfterEdit('ok', { ...clean, prompt: 'Berapa � + 4?' })).toBe('broken-fraction')
  })

  it('perlu dicek tetap sampai disetujui, dan soal tanpa kunci perlu dicek', () => {
    expect(statusAfterEdit('needs-check', clean)).toBe('needs-check')
    expect(statusAfterEdit('key-mismatch', { ...clean, answer: null })).toBe('needs-check')
    expect(statusAfterEdit('ok', { ...clean, answer: 7 })).toBe('needs-check')
  })
})

describe('label dan tag', () => {
  it('normalizeTag membuat tag huruf kecil dengan tanda hubung', () => {
    expect(normalizeTag('Level 1')).toBe('level-1')
    expect(normalizeTag('ESMO')).toBe('esmo')
    expect(normalizeTag('  Olimpiade   Sains! ')).toBe('olimpiade-sains')
    expect(normalizeTag('Babak Penyisihan 2025 (latihan)')).toBe('babak-penyisihan-2025-latihan')
    expect(normalizeTag('***')).toBe('')
  })

  it('parseLabels memisah koma, membuang yang kosong dan kembar', () => {
    expect(parseLabels('ESMO, Level 1, esmo, ,')).toEqual(['ESMO', 'Level 1'])
    expect(parseLabels('')).toEqual([])
    expect(parseLabels(Array.from({ length: 14 }, (_, i) => `L${i}`).join(','))).toHaveLength(10)
  })

  it('importTags: tag lomba, keep-order, id untuk soal Indonesia, lalu label', () => {
    const esmo = CATALOG[1]!
    expect(importTags(['ESMO', 'Level 1'], esmo, 'id')).toEqual(['esmo', 'keep-order', 'level-1'])
    expect(importTags(['Latihan'], CATALOG[2]!, 'id')).toEqual(['kmnr', 'keep-order', 'id', 'latihan'])
    expect(importTags([], null, 'en-GB')).toEqual(['keep-order'])
    expect(importTags(Array.from({ length: 12 }, (_, i) => `Label ${i}`), esmo, 'id')).toHaveLength(10)
  })
})

describe('detectCompetition dan bahasa paket', () => {
  it('mengenali lomba dari label atau nama berkas', () => {
    expect(detectCompetition(['ESMO', 'Level 1'], 'Latihan soal ke-5.pdf', CATALOG)?.id).toBe('esmo')
    expect(detectCompetition([], 'Latihan KMNR 2026 babak 1.pdf', CATALOG)?.id).toBe('kmnr')
    expect(detectCompetition([], 'Cambridge Checkpoint Math 2025.pdf', CATALOG)?.id).toBe('cambridge-checkpoint')
    expect(detectCompetition(['Checkpoint'], 'paket.pdf', CATALOG)?.id).toBe('cambridge-checkpoint')
  })

  it('tidak menebak lomba dari potongan kata', () => {
    expect(detectCompetition([], 'Latihan kimsonia.pdf', CATALOG)).toBeNull()
    expect(detectCompetition(['Level 1'], 'Latihan soal ke-5 Math.pdf', CATALOG)).toBeNull()
  })

  it('bahasa: English untuk mapel English, bahasa preset lomba, lalu kata yang paling sering', () => {
    expect(detectLang('english', 'id', ['Berapa banyak apel?'])).toBe('en-GB')
    expect(detectLang('math', competitionLang(CATALOG[1]!, 'math'), ['How many apples are there?'])).toBe('id')
    expect(competitionLang(CATALOG[1]!, 'english')).toBe('en-GB')
    expect(competitionLang(null, 'math')).toBeNull()
    expect(detectLang('math', null, ['Ibu membeli 15 kue. Berapa kue yang tersisa?', 'Hari apakah 10 hari lagi dari Senin?'])).toBe('id')
    expect(detectLang('science', null, ['Which of the following is a mammal?', 'How many legs does a spider have?'])).toBe('en-GB')
  })
})

describe('pickImportSkill', () => {
  const skills = [
    skill('m2.numbers-to-100', 1),
    skill('m2.oly-patterns', 900, { strand: 'Oly', competitions: ['ikmc', 'kmnr', 'seamo'] }),
    skill('m2.oly-logic', 910, { strand: 'Oly', competitions: ['ikmc', 'kmnr'] }),
    skill('m2.oly-esmo', 950, { strand: 'Oly', competitions: ['esmo'] }),
  ]
  it('memilih skill paling khusus untuk lomba yang terdeteksi', () => {
    expect(pickImportSkill(skills, 'esmo')).toBe('m2.oly-esmo')
    expect(pickImportSkill(skills, 'kmnr')).toBe('m2.oly-logic')
  })
  it('lomba tanpa skill khusus memakai skill olimpiade, paket biasa memakai skill pertama', () => {
    expect(pickImportSkill(skills, 'osn-sd')).toBe('m2.oly-patterns')
    expect(pickImportSkill([...skills].reverse(), null)).toBe('m2.numbers-to-100')
    expect(pickImportSkill([], 'esmo')).toBeNull()
  })
})

describe('paket ESMO', () => {
  it('nomor paket berikutnya per mapel', () => {
    expect(nextPackNumber([], 'math')).toBe(1)
    expect(nextPackNumber(['esmo:math:1', 'esmo:math:3', 'esmo:english:7', 'lain'], 'math')).toBe(4)
    expect(nextPackNumber(['esmo:math:1', 'esmo:english:7'], 'english')).toBe(8)
  })
})

describe('teks dan soal hasil impor', () => {
  it('cleanImportedText: tanda pisah di antara angka menjadi minus, lainnya menjadi koma', () => {
    expect(cleanImportedText('8 \u2013 3 = ...')).toBe('8 - 3 = ...')
    expect(cleanImportedText('15\u20136')).toBe('15 - 6')
    expect(cleanImportedText('Ibu \u2014 membeli kue')).toBe('Ibu, membeli kue')
    expect(cleanImportedText('Baris  satu.\n\n  Baris   dua.')).toBe('Baris satu.\nBaris dua.')
  })

  const base = { prompt: 'Ibu membeli 15 kue. Adik makan 6 kue. Berapa kue yang tersisa?', options: ['9', '8', '21', '6'], answer: 0 }
  const ctx = { skillId: 'm2.oly-esmo', lang: 'id' as const, tags: ['esmo', 'keep-order'] }

  it('membuat soal pilihan ganda yang lolos itemSchema dengan hint umum', () => {
    const r = buildImportedItem(base, ctx)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.item).toMatchObject({ type: 'mcq', skill: 'm2.oly-esmo', lang: 'id', answer: 0, source: 'imported', tags: ['esmo', 'keep-order'], difficulty: 3 })
    expect(r.item.hints).toHaveLength(3)
    expect(r.item.explanation).toContain('paket latihan resmi')
    if (r.item.type === 'mcq') expect(r.item.options.map((o) => o.text)).toEqual(['9', '8', '21', '6'])
  })

  it('soal English memakai hint dan pembahasan berbahasa Inggris', () => {
    const r = buildImportedItem({ prompt: 'How many legs does a spider have?', options: ['6', '8', '10', '4'], answer: 1 }, { skillId: 's2.living-things', lang: 'en-GB', tags: ['keep-order'] })
    expect(r.ok && r.item.explanation).toContain('official practice pack')
  })

  it('menolak soal tanpa kunci, dengan sisa teks kunci, atau opsi kembar', () => {
    expect(buildImportedItem({ ...base, answer: null }, ctx)).toMatchObject({ ok: false, message: 'belum punya kunci' })
    expect(buildImportedItem({ ...base, prompt: `${base.prompt} Kunci jawaban: A` }, ctx)).toMatchObject({ ok: false })
    expect(buildImportedItem({ ...base, options: ['9', '9', '21', '6'] }, ctx)).toMatchObject({ ok: false, message: expect.stringContaining('Opsi kembar') })
    expect(buildImportedItem({ ...base, options: ['9', 'x'.repeat(200)] }, ctx)).toMatchObject({ ok: false, message: expect.stringContaining('options.1.text') })
  })

  it('soal Indonesia di luar ESMO butuh tag id supaya lolos pemeriksaan konten', () => {
    expect(buildImportedItem(base, { ...ctx, tags: ['keep-order'] })).toMatchObject({ ok: false, message: expect.stringContaining('esmo atau id') })
    expect(buildImportedItem(base, { ...ctx, tags: ['keep-order', 'id'] }).ok).toBe(true)
  })
})
