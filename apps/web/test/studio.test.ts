import { describe, expect, it } from 'vitest'
import { childDataProblem, draftSkill, jobSummary, monthBounds, parseApprovedDraft } from '@/server/dal/console-studio'

const titles: Record<string, string> = { 'm2.arrays': 'Arrays', 'm2.time': 'Time' }
const titleOf = (id: string) => titles[id] ?? id

const VALID = {
  type: 'mcq',
  skill: 'm2.numbers-to-100',
  difficulty: 2,
  prompt: 'There are 3 rows of 4 mangoes. How many mangoes are there?',
  options: [{ text: '7' }, { text: '12' }, { text: '10' }, { text: '14' }],
  answer: 1,
  hints: ['Count one row first.', 'Add the rows together.', 'Use 3 groups of 4.'],
  explanation: '3 rows of 4 make 12.',
}

describe('monthBounds: kuota job AI per bulan kalender WIB', () => {
  it('memberi tanggal 1 bulan ini dan bulan depan', () => {
    expect(monthBounds('2026-10-12')).toEqual({ start: '2026-10-01', next: '2026-11-01' })
    expect(monthBounds('2026-12-31')).toEqual({ start: '2026-12-01', next: '2027-01-01' })
    expect(monthBounds('2027-01-01')).toEqual({ start: '2027-01-01', next: '2027-02-01' })
  })
})

describe('childDataProblem: instruksi ke AI tanpa data anak', () => {
  const names = ['Aisha', 'Raka Putra']
  it('menolak email, angka 16 digit, dan nama learner', () => {
    expect(childDataProblem('kirim ke mama@contoh.test', names)).toContain('email')
    expect(childDataProblem('NIK 3507123456789012', names)).toContain('16 digit')
    expect(childDataProblem('Buat soal untuk aisha yang suka kucing', names)).toContain('Aisha')
    expect(childDataProblem('Soal tentang Putra dan layang-layang', names)).toContain('Putra')
  })

  it('tidak salah tangkap kata yang hanya memuat nama', () => {
    expect(childDataProblem('pakai konteks pasar dan uang rupiah', names)).toBeNull()
    expect(childDataProblem('soal karakter cerita rakyat', names)).toBeNull()
    expect(childDataProblem('', names)).toBeNull()
  })
})

describe('jobSummary: ringkasan job AI', () => {
  it('menyebut jenis, skill, jumlah, dan hasil', () => {
    expect(jobSummary({ kind: 'items', status: 'done', input: { skill: { id: 'm2.arrays' }, count: 5 }, output: { drafts: 5, withProblems: 1 }, error: null }, titleOf)).toBe(
      '5 soal baru Arrays, 5 draf jadi, 1 perlu dicek',
    )
    expect(jobSummary({ kind: 'variants', status: 'running', input: { skill: { id: 'm2.time' }, count: 3, itemRef: 'm2.time.004' }, output: null, error: null }, titleOf)).toBe(
      '3 varian Time dari m2.time.004',
    )
    expect(jobSummary({ kind: 'translate', status: 'queued', input: { itemRef: 'm2.time.004', to: 'id' }, output: null, error: null }, titleOf)).toBe(
      'Terjemahan m2.time.004 ke Bahasa Indonesia',
    )
    expect(jobSummary({ kind: 'mcp', status: 'done', input: { skillId: 'm2.arrays', count: 2 }, output: { drafts: 2, withProblems: 0 }, error: null }, titleOf)).toBe(
      '2 draf Arrays dari Claude lewat MCP',
    )
    expect(jobSummary({ kind: 'test', status: 'done', input: { kind: 'test' }, output: {}, error: null }, titleOf)).toBe('Tes koneksi AI')
  })

  it('job yang dicoba lagi tetap menunggu dan membawa pesan worker', () => {
    const s = jobSummary({ kind: 'hints', status: 'queued', input: { itemRef: 'm2.time.004' }, output: null, error: 'Waktu habis. Dicoba lagi otomatis pukul 16.05 WIB.' }, titleOf)
    expect(s).toBe('Hint bertingkat untuk m2.time.004. Waktu habis. Dicoba lagi otomatis pukul 16.05 WIB.')
  })
})

describe('parseApprovedDraft: JSON draf yang disetujui', () => {
  it('memaksa id, sumber, dan skill dari server', () => {
    const r = parseApprovedDraft(JSON.stringify({ ...VALID, id: 'KRA-9', source: 'kira-original', skill: 'm6.oly-logic' }), 'm2.numbers-to-100')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.item).toMatchObject({ id: 'draft', source: 'ai-draft', skill: 'm2.numbers-to-100', type: 'mcq', answer: 1 })
  })

  it('menolak JSON rusak, bukan objek, dan lebih dari 20 KB', () => {
    expect(parseApprovedDraft('{"type": "mcq",', 'm2.numbers-to-100')).toMatchObject({ ok: false })
    expect(parseApprovedDraft('[1, 2]', 'm2.numbers-to-100')).toMatchObject({ ok: false, message: expect.stringContaining('satu objek') })
    expect(parseApprovedDraft(JSON.stringify({ ...VALID, explanation: 'x'.repeat(21_000) }), 'm2.numbers-to-100')).toMatchObject({ ok: false, message: expect.stringContaining('20 KB') })
  })

  it('menyebut bagian yang belum lolos skema', () => {
    const r = parseApprovedDraft(JSON.stringify({ ...VALID, hints: ['Only one.'] }), 'm2.numbers-to-100')
    expect(r).toMatchObject({ ok: false, message: expect.stringContaining('hints') })
  })

  it('menolak draf yang melanggar aturan konten (em dash, opsi kembar)', () => {
    expect(parseApprovedDraft(JSON.stringify({ ...VALID, explanation: '3 rows of 4 \u2014 that is 12.' }), 'm2.numbers-to-100')).toMatchObject({ ok: false, message: expect.stringContaining('em dash') })
    expect(parseApprovedDraft(JSON.stringify({ ...VALID, options: [{ text: '7' }, { text: '12' }, { text: '12' }] }), 'm2.numbers-to-100')).toMatchObject({ ok: false, message: expect.stringContaining('Opsi kembar') })
  })
})

describe('draftSkill', () => {
  it('memakai skill draf bila dikenal, selain itu skill permintaan job', () => {
    expect(draftSkill({ skill: 'm2.numbers-to-100' }, { skill: { id: 'm1.oly-logic' } })).toBe('m2.numbers-to-100')
    expect(draftSkill({ skill: 'm9.tidak-ada' }, { skill: { id: 'm1.oly-logic' } })).toBe('m1.oly-logic')
    expect(draftSkill({}, { kind: 'mcp', skillId: 'm2.oly-esmo' })).toBe('m2.oly-esmo')
    expect(draftSkill(null, null)).toBeNull()
  })
})
