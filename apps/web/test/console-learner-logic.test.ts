import { describe, expect, it } from 'vitest'
import { computeGate, difficultyToB, initialTheta, outcomeScore, pushRecent, updateTheta } from '@kira/core'
import { answerTextId, attemptMinutes, heatCells, lastWeekStarts, scoreText, weekColumns, type ReplayAnswer } from '@/server/dal/console-learner-logic'

describe('minggu peta penguasaan', () => {
  it('memberi 8 Senin terakhir, minggu ini paling akhir', () => {
    const w = lastWeekStarts('2026-10-14')
    expect(w).toHaveLength(8)
    expect(w[0]).toBe('2026-08-24')
    expect(w[7]).toBe('2026-10-12')
    expect(weekColumns('2026-10-18').map((c) => c.label)).toEqual(['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8'])
  })
})

/** Mesin acuan yang sama dengan applyOutcome di learner-core, ditulis langsung untuk pembanding. */
function engineGate(answers: ReplayAnswer[], learnerGrade: number, skillGrade: number) {
  let theta = initialTheta(learnerGrade, skillGrade)
  let recent: number[] = []
  let n = 0
  let gate = 'new'
  for (const a of answers) {
    const s = outcomeScore({ correct: a.correct, hintsUsed: a.hintsUsed })
    theta = updateTheta(theta, n, difficultyToB(a.difficulty), s)
    recent = pushRecent(recent, s)
    n += 1
    gate = computeGate({ nAnswers: n, recentScores: recent, theta }).gate
  }
  return gate
}

function ans(date: string, correct: boolean, hintsUsed = 0, difficulty = 2, skillId = 'm2.arrays'): ReplayAnswer {
  return { skillId, date, correct, hintsUsed, difficulty }
}

describe('putar ulang gerbang per minggu', () => {
  const weeks = lastWeekStarts('2026-10-14', 4) // 21 Sep, 28 Sep, 5 Okt, 12 Okt

  it('minggu sebelum jawaban pertama bergerbang new dan kosong', () => {
    const cells = heatCells([ans('2026-10-06', true)], weeks, 2).get('m2.arrays')!
    expect(cells.map((c) => c.gate)).toEqual(['new', 'new', 'new', 'new'])
    expect(cells[0]).toEqual({ weekStart: '2026-09-21', accuracy: null, answers: 0, gate: 'new' })
    expect(cells[2]).toEqual({ weekStart: '2026-10-05', accuracy: 100, answers: 1, gate: 'new' })
  })

  it('menghitung akurasi tanpa hint, tetapi hint tetap dihitung sebagai jawaban', () => {
    const list = [ans('2026-10-12', true), ans('2026-10-12', true, 1), ans('2026-10-13', false), ans('2026-10-14', true)]
    const cell = heatCells(list, weeks, 2).get('m2.arrays')![3]!
    expect(cell.answers).toBe(4)
    expect(cell.accuracy).toBe(50)
  })

  it('gerbang di akhir tiap minggu sama dengan mesin, termasuk jawaban sebelum jendela peta', () => {
    const early = Array.from({ length: 8 }, (_, i) => ans(`2026-09-0${i + 1}`, i % 3 !== 0))
    const w1 = [ans('2026-09-22', true), ans('2026-09-23', true), ans('2026-09-24', false)]
    const w3 = Array.from({ length: 12 }, (_, i) => ans('2026-10-07', i !== 4, 0, 3))
    const list = [...early, ...w1, ...w3]
    const cells = heatCells(list, weeks, 2).get('m2.arrays')!
    // Jawaban awal September mengubah gerbang, tetapi tidak dihitung di sel.
    expect(cells[0]).toMatchObject({ answers: 3, accuracy: 67, gate: engineGate([...early, ...w1], 2, 2) })
    expect(cells[0]!.gate).not.toBe('new')
    // Minggu tanpa jawaban membawa gerbang minggu sebelumnya.
    expect(cells[1]).toMatchObject({ answers: 0, accuracy: null, gate: cells[0]!.gate })
    expect(cells[2]).toMatchObject({ answers: 12, accuracy: 92, gate: engineGate(list, 2, 2) })
    expect(cells[3]!.gate).toBe(cells[2]!.gate)
  })

  it('sepuluh jawaban benar pertama membuat skill dikuasai, banyak salah membuat ajar ulang', () => {
    const good = Array.from({ length: 10 }, () => ans('2026-10-13', true))
    expect(heatCells(good, weeks, 2).get('m2.arrays')![3]!.gate).toBe('mastered')
    const nine = good.slice(0, 9)
    expect(heatCells(nine, weeks, 2).get('m2.arrays')![3]!.gate).toBe('new')
    const bad = Array.from({ length: 10 }, (_, i) => ans('2026-10-13', i < 4))
    expect(heatCells(bad, weeks, 2).get('m2.arrays')![3]!.gate).toBe('reteach')
  })

  it('memisahkan skill dan memakai grade skill untuk theta awal', () => {
    const list = [...Array.from({ length: 10 }, () => ans('2026-10-13', true, 0, 2, 'm1.count')), ans('2026-10-13', false, 0, 2, 'm3.place-value')]
    const map = heatCells(list, weeks, 2)
    expect([...map.keys()].sort()).toEqual(['m1.count', 'm3.place-value'])
    expect(map.get('m1.count')![3]!.gate).toBe(engineGate(list.slice(0, 10), 2, 1))
    expect(map.get('m3.place-value')![3]).toMatchObject({ answers: 1, accuracy: 0, gate: 'new' })
  })
})

describe('teks attempt', () => {
  it('menulis skor', () => {
    expect(scoreText({ scoreRaw: 8, scoreMax: 10, scoreScaled: null, itemCount: 10, pending: 0 })).toBe('8 dari 10')
    expect(scoreText({ scoreRaw: 30, scoreMax: 40, scoreScaled: 74.6, itemCount: 40, pending: 0 })).toBe('75 dari 100')
    expect(scoreText({ scoreRaw: 7.5, scoreMax: null, scoreScaled: null, itemCount: 10, pending: 0 })).toBe('7,5 dari 10')
    expect(scoreText({ scoreRaw: 5, scoreMax: 8, scoreScaled: null, itemCount: 8, pending: 2 })).toBe('5 dari 8, 2 menunggu nilai')
    expect(scoreText({ scoreRaw: null, scoreMax: null, scoreScaled: null, itemCount: 6, pending: 0 })).toBe('Belum ada skor')
  })

  it('memakai waktu per soal, lalu elapsed_s, lalu selisih waktu', () => {
    const startedAt = new Date('2026-10-12T08:00:00Z')
    expect(attemptMinutes({ activeMs: 13 * 60000 + 20000, elapsedS: 9000, startedAt, submittedAt: new Date('2026-10-12T10:30:00Z') })).toBe(13)
    expect(attemptMinutes({ activeMs: 0, elapsedS: 1200, startedAt, submittedAt: null })).toBe(20)
    expect(attemptMinutes({ activeMs: 0, elapsedS: 0, startedAt, submittedAt: new Date('2026-10-12T08:46:00Z') })).toBe(46)
    expect(attemptMinutes({ activeMs: 5000, elapsedS: 0, startedAt, submittedAt: null })).toBe(1)
    expect(attemptMinutes({ activeMs: 0, elapsedS: 0, startedAt, submittedAt: null })).toBe(0)
  })

  it('menerjemahkan teks jawaban learner ke bahasa konsol', () => {
    expect(answerTextId('No answer')).toBe('Tidak dijawab')
    expect(answerTextId('')).toBe('Tidak dijawab')
    expect(answerTextId('Voice recording sent')).toBe('Rekaman suara')
    expect(answerTextId('Drawing sent')).toBe('Gambar')
    expect(answerTextId('3 of 4 parts')).toBe('3 dari 4 bagian diarsir')
    expect(answerTextId('B. 20')).toBe('B. 20')
  })
})
