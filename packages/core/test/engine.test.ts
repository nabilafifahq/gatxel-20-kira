import { describe, expect, it } from 'vitest'
import {
  addDays,
  answerXp,
  assembleQuest,
  chooseSkill,
  computeGate,
  computeStreak,
  createRng,
  difficultyToB,
  earnedBadges,
  formatClock,
  formatDateId,
  initialTheta,
  isDue,
  jakartaDate,
  levelForXp,
  levelProgress,
  newCard,
  pCorrect,
  pickItems,
  pushRecent,
  questCompletionXp,
  ratingFromOutcome,
  reviewCard,
  scoreWithPreset,
  updateTheta,
  validateRules,
  weekStart,
  weekView,
  type BadgeStats,
  type PresetRules,
} from '../src'

describe('time (WIB)', () => {
  it('memakai tanggal Jakarta, bukan UTC', () => {
    // 2026-10-12 18:30 UTC = 13 Oktober 01.30 WIB
    expect(jakartaDate(new Date('2026-10-12T18:30:00Z'))).toBe('2026-10-13')
    expect(jakartaDate(new Date('2026-10-12T16:59:00Z'))).toBe('2026-10-12')
  })
  it('awal minggu adalah Senin', () => {
    expect(weekStart('2026-10-12')).toBe('2026-10-12') // Senin
    expect(weekStart('2026-10-18')).toBe('2026-10-12') // Minggu
    expect(weekStart('2026-10-17')).toBe('2026-10-12') // Sabtu
  })
  it('format tanggal dan jam', () => {
    expect(formatDateId('2026-10-12', true)).toBe('Senin, 12 Oktober 2026')
    expect(formatClock(760)).toBe('12:40')
    expect(formatClock(58)).toBe('0:58')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('ability', () => {
  it('memetakan tingkat 1 sampai 5 ke b', () => {
    expect([1, 2, 3, 4, 5].map(difficultyToB)).toEqual([-1.5, -0.75, 0, 0.75, 1.5])
  })
  it('theta naik saat benar dan turun saat salah, dengan K 0,4 lalu 0,2', () => {
    const p = pCorrect(0, 0)
    expect(p).toBeCloseTo(0.5)
    expect(updateTheta(0, 0, 0, 1)).toBeCloseTo(0.2)
    expect(updateTheta(0, 12, 0, 1)).toBeCloseTo(0.1)
    expect(updateTheta(0, 0, 0, 0)).toBeCloseTo(-0.2)
    expect(updateTheta(0, 0, 0, 0.6)).toBeCloseTo(0.04)
  })
  it('theta awal dari selisih grade', () => {
    expect(initialTheta(2, 2)).toBe(0)
    expect(initialTheta(4, 2)).toBe(1.5)
    expect(initialTheta(1, 3)).toBe(-1.5)
  })
})

describe('gates', () => {
  it('new di bawah 10 jawaban', () => {
    expect(computeGate({ nAnswers: 9, recentScores: Array(9).fill(1), theta: 2 }).gate).toBe('new')
  })
  it('mastered butuh akurasi 85% dan theta 0,5', () => {
    expect(computeGate({ nAnswers: 20, recentScores: Array(20).fill(1), theta: 0.6 })).toMatchObject({ gate: 'mastered', stars: 3 })
    expect(computeGate({ nAnswers: 20, recentScores: Array(20).fill(1), theta: 0.4 }).gate).toBe('review')
  })
  it('review 70 sampai 84, reteach di bawah 70', () => {
    const seventy = [...Array(14).fill(1), ...Array(6).fill(0)]
    expect(computeGate({ nAnswers: 20, recentScores: seventy, theta: 1 }).gate).toBe('review')
    const sixty = [...Array(12).fill(1), ...Array(8).fill(0)]
    expect(computeGate({ nAnswers: 20, recentScores: sixty, theta: 1 })).toMatchObject({ gate: 'reteach', stars: 1 })
  })
  it('menyimpan 20 skor terakhir', () => {
    let r: number[] = []
    for (let i = 0; i < 25; i++) r = pushRecent(r, i)
    expect(r).toHaveLength(20)
    expect(r[0]).toBe(5)
  })
})

describe('picker dan quest', () => {
  const pool = [1, 2, 3, 4, 5].flatMap((d) =>
    Array.from({ length: 6 }, (_, i) => ({ ref: `item-${d}-${i}`, difficulty: d })),
  )
  it('soal inti berada di pita 0,75 sampai 0,85 bila ada', () => {
    const picked = pickItems({ candidates: pool, theta: 1, count: 4, band: [0.75, 0.85], rng: createRng(1) })
    for (const p of picked) expect(p.p).toBeGreaterThanOrEqual(0.7)
    expect(new Set(picked.map((p) => p.candidate.ref)).size).toBe(4)
  })
  it('menghindari soal yang baru dilihat', () => {
    const seen = pool.map((c) => ({ ...c, seenDaysAgo: c.ref.endsWith('-0') ? 0 : undefined }))
    const picked = pickItems({ candidates: seen, theta: 0, count: 5, band: [0.75, 0.85], rng: createRng(2) })
    expect(picked.some((p) => p.candidate.ref.endsWith('-0'))).toBe(false)
  })
  it('generator unlimited mengisi semua slot', () => {
    const gens = [{ ref: 'gen:a@2', difficulty: 2, unlimited: true }]
    const picked = pickItems({ candidates: gens, theta: 0, count: 7, band: [0.75, 0.85], rng: createRng(3) })
    expect(picked).toHaveLength(7)
  })
  it('quest latihan: pemanasan, inti, tantangan, total 10', () => {
    const slots = assembleQuest({
      mode: 'latihan',
      theta: 0.5,
      dueRefs: [
        { ref: 'due-1', difficulty: 2 },
        { ref: 'due-2', difficulty: 3 },
        { ref: 'due-3', difficulty: 2 },
        { ref: 'due-4', difficulty: 2 },
      ],
      candidates: pool,
      rng: createRng(4),
    })
    expect(slots).toHaveLength(10)
    expect(slots.filter((s) => s.section === 'warmup')).toHaveLength(3)
    expect(slots.filter((s) => s.section === 'challenge')).toHaveLength(1)
    expect(slots.at(-1)?.section).toBe('challenge')
  })
  it('mode belajar tanpa tantangan', () => {
    const slots = assembleQuest({ mode: 'belajar', theta: 0, dueRefs: [], candidates: pool, length: 6, rng: createRng(5) })
    expect(slots).toHaveLength(6)
    expect(slots.every((s) => s.section === 'core')).toBe(true)
  })
  it('memilih skill reteach dulu, lalu skill baru yang siap', () => {
    const rng = createRng(6)
    const skills = [
      { id: 'a', order: 1, gate: 'mastered' as const, prerequisites: [] },
      { id: 'b', order: 2, gate: 'new' as const, prerequisites: ['a'] },
      { id: 'c', order: 3, gate: 'new' as const, prerequisites: ['b'] },
    ]
    expect(chooseSkill(skills, rng)?.id).toBe('b')
    expect(chooseSkill([...skills, { id: 'd', order: 4, gate: 'reteach' as const, prerequisites: [] }], rng)?.id).toBe('d')
  })
})

describe('Buku Koreksi (FSRS)', () => {
  it('jawaban salah jatuh tempo besok, bukan hari ini', () => {
    const now = new Date('2026-10-12T09:00:00Z') // 16.00 WIB
    const card = reviewCard(newCard(now), 'again', now)
    expect(isDue(card, '2026-10-12')).toBe(false)
    expect(isDue(card, '2026-10-13')).toBe(true)
  })
  it('jawaban benar memperpanjang interval', () => {
    const now = new Date('2026-10-12T09:00:00Z')
    let card = reviewCard(newCard(now), 'again', now)
    const later = new Date('2026-10-13T09:00:00Z')
    card = reviewCard(card, 'good', later)
    expect(new Date(card.due).getTime()).toBeGreaterThan(later.getTime() + 24 * 3600 * 1000 - 1)
  })
  it('rating dari hasil jawaban', () => {
    expect(ratingFromOutcome({ correct: false, hintsUsed: 0 })).toBe('again')
    expect(ratingFromOutcome({ correct: true, hintsUsed: 1 })).toBe('hard')
    expect(ratingFromOutcome({ correct: true, hintsUsed: 0, timeMs: 3000, expectedMs: 30000 })).toBe('easy')
    expect(ratingFromOutcome({ correct: true, hintsUsed: 0 })).toBe('good')
  })
})

describe('XP dan level', () => {
  it('XP per tingkat dan separuh dengan hint', () => {
    expect(answerXp({ difficulty: 1, correct: true, hintsUsed: 0 })).toBe(10)
    expect(answerXp({ difficulty: 3, correct: true, hintsUsed: 0 })).toBe(15)
    expect(answerXp({ difficulty: 5, correct: true, hintsUsed: 0 })).toBe(20)
    expect(answerXp({ difficulty: 2, correct: true, hintsUsed: 2 })).toBe(5)
    expect(answerXp({ difficulty: 2, correct: false, hintsUsed: 0 })).toBe(0)
    expect(questCompletionXp({ bonus: false, perfect: true })).toBe(30)
    expect(questCompletionXp({ bonus: true, perfect: false })).toBe(30)
  })
  it('level di 50 x n x (n+1)', () => {
    expect(levelForXp(0)).toBe(1)
    expect(levelForXp(99)).toBe(1)
    expect(levelForXp(100)).toBe(2)
    expect(levelForXp(300)).toBe(3)
    expect(levelProgress(150)).toEqual({ level: 2, into: 50, span: 200, toNext: 150 })
  })
})

describe('streak', () => {
  const since = '2026-10-05' // Senin
  const rest = [0] // Minggu
  it('hari istirahat tidak memutus streak, hari ini yang belum selesai juga tidak', () => {
    const days = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10'].map((date) => ({
      date,
      questsDone: 3,
      questsRequired: 3,
    }))
    const r = computeStreak({ days, today: '2026-10-12', restWeekdays: rest, since })
    expect(r.current).toBe(6)
    expect(r.statusByDate.get('2026-10-11')).toBe('rest')
    expect(r.statusByDate.get('2026-10-12')).toBe('today')
  })
  it('hari terlewat memutus streak tanpa pembeku', () => {
    const days = [
      { date: '2026-10-05', questsDone: 3, questsRequired: 3 },
      { date: '2026-10-06', questsDone: 1, questsRequired: 3 },
      { date: '2026-10-07', questsDone: 3, questsRequired: 3 },
    ]
    const r = computeStreak({ days, today: '2026-10-07', restWeekdays: rest, since })
    expect(r.current).toBe(1)
    expect(r.best).toBe(1)
    expect(r.statusByDate.get('2026-10-06')).toBe('partial')
  })
  it('pembeku didapat setiap 7 hari lengkap dan dipakai otomatis', () => {
    const days = Array.from({ length: 8 }, (_, i) => ({ date: addDays('2026-09-01', i), questsDone: 3, questsRequired: 3 }))
    // 2026-09-09 terlewat, 09-10 lengkap
    days.push({ date: '2026-09-10', questsDone: 3, questsRequired: 3 })
    const r = computeStreak({ days, today: '2026-09-10', restWeekdays: [], since: '2026-09-01' })
    expect(r.statusByDate.get('2026-09-09')).toBe('freeze')
    expect(r.current).toBe(9)
    expect(r.freezes).toBe(0)
  })
  it('tampilan minggu', () => {
    const r = computeStreak({ days: [], today: '2026-10-14', restWeekdays: rest, since })
    const week = weekView(r, '2026-10-14', rest)
    expect(week).toHaveLength(7)
    expect(week[2]?.isToday).toBe(true)
    expect(week[6]?.status).toBe('rest')
    expect(week[3]?.status).toBe('upcoming')
  })
})

describe('preset lomba', () => {
  const ikmc: PresetRules = {
    questionCount: 24,
    timeLimitMin: 75,
    sections: [
      { from: 1, to: 8, points: 3 },
      { from: 9, to: 16, points: 4 },
      { from: 17, to: 24, points: 5 },
    ],
  }
  it('IKMC: 3, 4, dan 5 poin, maksimal 96', () => {
    expect(validateRules(ikmc)).toEqual([])
    const answers = Array.from({ length: 24 }, (_, i) => ({ position: i + 1, status: 'correct' as const }))
    expect(scoreWithPreset(ikmc, answers).raw).toBe(96)
    const half = answers.map((a) => (a.position % 2 === 0 ? { ...a, status: 'wrong' as const } : a))
    expect(scoreWithPreset(ikmc, half).raw).toBe(4 * 3 + 4 * 4 + 4 * 5)
  })
  it('ESMO: 40 soal, skala 100, lulus 70, tanpa pengurangan', () => {
    const esmo: PresetRules = { questionCount: 40, timeLimitMin: 50, sections: [{ from: 1, to: 40, points: 1 }], scaleTo: 100, passMark: 70 }
    const answers = Array.from({ length: 40 }, (_, i) => ({ position: i + 1, status: (i < 29 ? 'correct' : 'wrong') as 'correct' | 'wrong' }))
    const s = scoreWithPreset(esmo, answers)
    expect(s.scaled).toBe(72.5)
    expect(s.passed).toBe(true)
    expect(scoreWithPreset(esmo, answers.slice(0, 27)).passed).toBe(false)
  })
  it('pengurangan untuk salah, kosong tidak dikurangi', () => {
    const rules: PresetRules = {
      questionCount: 4,
      timeLimitMin: 10,
      startScore: 15,
      sections: [
        { from: 1, to: 2, points: 2, wrongPenalty: 1 },
        { from: 3, to: 4, points: 4 },
      ],
    }
    const s = scoreWithPreset(rules, [
      { position: 1, status: 'correct' },
      { position: 2, status: 'wrong' },
      { position: 3, status: 'correct' },
    ])
    expect(s.raw).toBe(15 + 2 - 1 + 4)
    expect(s.blank).toBe(1)
    expect(s.max).toBe(15 + 4 + 8)
  })
  it('validasi menolak soal tanpa poin', () => {
    expect(validateRules({ questionCount: 3, timeLimitMin: 5, sections: [{ from: 1, to: 2, points: 1 }] })).toContain('Soal 3 tidak punya poin')
  })
})

describe('lencana', () => {
  const zero: BadgeStats = {
    questsDone: 0, perfectQuests: 0, answersTotal: 0, currentStreak: 0, bestStreak: 0, masteredSkills: 0,
    reviewSessions: 0, simulationsDone: 0, olympiadPapersDone: 0, lessonsDone: 0, subjectsToday: 0,
    hintsUsedThenCorrect: 0, esmoPackagesDone: 0, speakingDone: 0, writingDone: 0,
    papersDone: 0, papersPassed: 0, testsPerfect: 0, testsEarlyPerfect: 0, retriesImproved: 0,
  }
  it('lencana quest pertama dan tidak dobel', () => {
    const got = earnedBadges({ ...zero, questsDone: 1 }, new Set())
    expect(got.map((b) => b.id)).toEqual(['first-quest'])
    expect(earnedBadges({ ...zero, questsDone: 1 }, new Set(['first-quest']))).toEqual([])
  })
})
