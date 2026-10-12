import { describe, expect, it } from 'vitest'
import { answerParts, attemptOutcome, cleanFeedback, inboxType, rubricResult } from '@/server/dal/console-inbox'
import type { AttemptItem } from '@/server/dal/learner-runner'

const RUBRIC = [
  { label: 'Uses the past tense', points: 2 },
  { label: 'Full sentences', points: 2 },
  { label: 'Tells what happened in order', points: 1 },
]

describe('rubricResult: nilai rubrik menjadi skor jawaban', () => {
  it('menjumlah nilai dan menskalakan ke skor maksimum jawaban', () => {
    expect(rubricResult([2, 1, 1], RUBRIC, 1)).toEqual({ ok: true, total: 4, max: 5, score: 0.8, status: 'correct' })
    expect(rubricResult([2, 2, 1], RUBRIC, 1)).toMatchObject({ total: 5, score: 1, status: 'correct' })
    expect(rubricResult([0, 0, 0], RUBRIC, 1)).toMatchObject({ total: 0, score: 0, status: 'wrong' })
  })

  it('benar bila minimal separuh poin, salah bila kurang dari separuh', () => {
    const even = [
      { label: 'A', points: 2 },
      { label: 'B', points: 2 },
    ]
    expect(rubricResult([1, 1], even)).toMatchObject({ total: 2, max: 4, score: 0.5, status: 'correct' })
    expect(rubricResult([1, 0], even)).toMatchObject({ total: 1, status: 'wrong' })
    // 5 poin: 3 sudah lebih dari separuh, 2 belum.
    expect(rubricResult([2, 1, 0], RUBRIC)).toMatchObject({ total: 3, status: 'correct', score: 0.6 })
    expect(rubricResult([1, 0, 1], RUBRIC)).toMatchObject({ total: 2, status: 'wrong', score: 0.4 })
  })

  it('memakai max_score jawaban untuk soal berpoin', () => {
    expect(rubricResult([2, 1, 1], RUBRIC, 3)).toMatchObject({ score: 2.4 })
    expect(rubricResult([1, 1, 0], RUBRIC, 2)).toMatchObject({ score: 0.8 })
  })

  const message = (r: ReturnType<typeof rubricResult>) => (r.ok ? '' : r.message)

  it('menolak jumlah nilai yang tidak sama dengan kriteria', () => {
    const r = rubricResult([2, 1], RUBRIC)
    expect(r.ok).toBe(false)
    expect(message(r)).toContain('3 kriteria')
  })

  it('menolak nilai di luar 0 sampai poin kriteria dan bukan bilangan bulat', () => {
    expect(message(rubricResult([3, 0, 0], RUBRIC))).toContain('0 sampai 2 poin, sekarang 3')
    expect(rubricResult([-1, 0, 0], RUBRIC).ok).toBe(false)
    expect(rubricResult([1.5, 0, 0], RUBRIC).ok).toBe(false)
    expect(rubricResult([0, 0, 2], RUBRIC).ok).toBe(false)
  })

  it('menolak soal tanpa rubrik', () => {
    expect(rubricResult([], []).ok).toBe(false)
  })
})

describe('attemptOutcome: hitung ulang attempt setelah penilaian', () => {
  const items: AttemptItem[] = [
    { ref: 'e2.writing.003', section: 'core', position: 1, difficulty: 3 },
    { ref: 'e2.spelling.001', section: 'core', position: 2, difficulty: 2 },
    { ref: 'e2.spelling.002', section: 'core', position: 3, difficulty: 2 },
    { ref: 'e2.writing.005', section: 'core', position: 4, difficulty: 3 },
  ]
  const topic = (ref: string) => (ref.includes('writing') ? 'Writing' : 'Spelling')

  it('menghitung benar, menunggu, dan per topik dari status terakhir', () => {
    const statuses: Record<number, string> = { 1: 'correct', 2: 'wrong', 3: 'correct', 4: 'pending' }
    const out = attemptOutcome(items, (p) => statuses[p], topic)
    expect(out).toMatchObject({ correct: 2, pending: 1, total: 4 })
    expect(out.byTopic).toEqual([
      { label: 'Writing', right: 1, total: 2 },
      { label: 'Spelling', right: 1, total: 2 },
    ])
    expect(out.statuses.map((s) => s.status)).toEqual(['correct', 'wrong', 'correct', 'blank'])
  })

  it('tidak ada yang menunggu setelah semua jawaban tulisan dinilai', () => {
    const statuses: Record<number, string> = { 1: 'correct', 2: 'wrong', 3: 'correct', 4: 'wrong' }
    expect(attemptOutcome(items, (p) => statuses[p], topic)).toMatchObject({ correct: 2, pending: 0 })
  })

  it('posisi tanpa jawaban dihitung kosong', () => {
    const out = attemptOutcome(items, () => undefined, topic)
    expect(out).toMatchObject({ correct: 0, pending: 0, total: 4 })
    expect(out.statuses.every((s) => s.status === 'blank')).toBe(true)
  })
})

describe('jenis jawaban di kotak hasil', () => {
  const media = '7416ea31-7602-42e3-923b-dddb96916da2'
  it('write tanpa media adalah tulisan, dengan media adalah foto kertas', () => {
    expect(inboxType('write', null)).toBe('write')
    expect(inboxType('write', media)).toBe('photo')
    expect(inboxType('speak', media)).toBe('speak')
    expect(inboxType('draw', media)).toBe('draw')
    expect(inboxType('mcq', null)).toBeNull()
  })

  it('mengambil teks dan id media dari jawaban tersimpan', () => {
    expect(answerParts({ text: 'Yesterday I played.' }, null)).toEqual({ text: 'Yesterday I played.', mediaId: null })
    expect(answerParts({ mediaId: media }, media)).toEqual({ text: null, mediaId: media })
    expect(answerParts({ mediaId: media, text: 'A pond' }, null)).toEqual({ text: 'A pond', mediaId: media })
    expect(answerParts({ mediaId: 'bukan-uuid' }, null)).toEqual({ text: null, mediaId: null })
    expect(answerParts({ text: '   ' }, null)).toEqual({ text: null, mediaId: null })
    expect(answerParts(null, null)).toEqual({ text: null, mediaId: null })
  })
})

describe('cleanFeedback', () => {
  it('mengganti em dash dan en dash dengan koma', () => {
    expect(cleanFeedback('Great work \u2014 played is right.')).toBe('Great work, played is right.')
    expect(cleanFeedback('  Nice  sentence\u2013well done ')).toBe('Nice sentence, well done')
    expect(cleanFeedback('')).toBe('')
  })
})
