import { describe, expect, it } from 'vitest'
import {
  CORE_SESSIONS,
  EASY_BAND,
  MAX_EXTRA_PER_DAY,
  TEST_BAND,
  assembleSession,
  baselineSessions,
  bestIndex,
  composeDay,
  computeStreak,
  createRng,
  defaultTemplate,
  difficultyToB,
  earnedBadges,
  isLinkSession,
  pCorrect,
  pickItems,
  pointsByPosition,
  requiredCount,
  retryImproved,
  retryXp,
  saturdayFullSubject,
  scaleRulesToCount,
  scoreFraction,
  scoreWithPreset,
  sessionCompletionXp,
  sessionMinutes,
  tesTimeLimitSec,
  validateRules,
  type BadgeStats,
  type PlannedSlot,
  type PresetRules,
} from '../src'

const slot = (id: string, subject: PlannedSlot['subject'], session: PlannedSlot['session'], required: boolean, order = 0, paperKind: PlannedSlot['paperKind'] = null): PlannedSlot => ({
  id,
  subject,
  session,
  required,
  paperKind,
  order,
})

describe('template hari', () => {
  it('Senin sampai Jumat memakai Hari sekolah, Sabtu memakai Sabtu paper penuh', () => {
    expect(defaultTemplate('2026-10-12')).toBe('school') // Senin
    expect(defaultTemplate('2026-10-16')).toBe('school') // Jumat
    expect(defaultTemplate('2026-10-17')).toBe('saturday')
  })
  it('paper penuh bergiliran antar mapel setiap Sabtu', () => {
    const saturdays = ['2026-10-10', '2026-10-17', '2026-10-24', '2026-10-31']
    const subjects = saturdays.map(saturdayFullSubject)
    expect(new Set(subjects.slice(0, 3)).size).toBe(3)
    expect(subjects[3]).toBe(subjects[0])
    // Seluruh minggu yang sama memilih mapel yang sama.
    expect(saturdayFullSubject('2026-10-12')).toBe(saturdayFullSubject('2026-10-17'))
  })
  it('hari sekolah punya 9 sesi wajib: Latihan, Tes, dan Paper mini untuk tiap mapel', () => {
    const base = baselineSessions('school', '2026-10-13')
    expect(base).toHaveLength(9)
    expect(base.filter((b) => b.session === 'paper').every((b) => b.paper === 'mini')).toBe(true)
    for (const s of CORE_SESSIONS) expect(base.filter((b) => b.session === s)).toHaveLength(3)
  })
  it('Sabtu: satu mapel mendapat paper penuh, dua lainnya paper mini', () => {
    const base = baselineSessions('saturday', '2026-10-17')
    expect(base).toHaveLength(9)
    const papers = base.filter((b) => b.session === 'paper')
    expect(papers.filter((p) => p.paper === 'full')).toHaveLength(1)
    expect(papers.filter((p) => p.paper === 'full')[0]!.subject).toBe(saturdayFullSubject('2026-10-17'))
    expect(papers.filter((p) => p.paper === 'mini')).toHaveLength(2)
  })
  it('Hari ringan hanya satu Latihan per mapel', () => {
    const base = baselineSessions('light', '2026-10-13')
    expect(base).toHaveLength(3)
    expect(base.every((b) => b.session === 'latihan')).toBe(true)
  })
})

describe('menyusun sesi satu hari', () => {
  it('tanpa slot semua sesi dasar otomatis', () => {
    const day = composeDay({ template: 'school', date: '2026-10-13', slots: [] })
    expect(day).toHaveLength(9)
    expect(day.every((e) => e.required && e.slotId === null)).toBe(true)
    expect(day[0]!.key).toBe('auto:math:latihan:0')
  })
  it('slot wajib menggantikan sesi dasar yang sama, slot wajib lain menjadi sesi tambahan', () => {
    const day = composeDay({
      template: 'school',
      date: '2026-10-13',
      slots: [slot('a', 'math', 'latihan', true, 1), slot('b', 'math', 'latihan', true, 2)],
    })
    expect(requiredCount(day)).toBe(10)
    const math = day.filter((e) => e.subject === 'math' && e.session === 'latihan')
    expect(math.map((e) => [e.key, e.seq])).toEqual([
      ['a', 0],
      ['b', 1],
    ])
  })
  it('sesi opsional tidak dihitung wajib dan paling banyak 10', () => {
    const slots = Array.from({ length: 14 }, (_, i) => slot(`x${i}`, 'english', 'review', false, i))
    const day = composeDay({ template: 'school', date: '2026-10-13', slots })
    expect(day.filter((e) => !e.required)).toHaveLength(MAX_EXTRA_PER_DAY)
    expect(requiredCount(day)).toBe(9)
    expect(day.filter((e) => !e.required).map((e) => e.seq)).toEqual(Array.from({ length: 10 }, (_, i) => i))
  })
  it('slot Latihan opsional tidak menggantikan Latihan wajib', () => {
    const day = composeDay({ template: 'light', date: '2026-10-13', slots: [slot('o', 'math', 'latihan', false)] })
    expect(requiredCount(day)).toBe(3)
    expect(day.find((e) => e.key === 'o')?.required).toBe(false)
    expect(day.find((e) => e.key === 'auto:math:latihan:0')).toBeDefined()
  })
  it('paper wajib memakai jenis dari slot bila ada', () => {
    const day = composeDay({ template: 'saturday', date: '2026-10-17', slots: [slot('p', 'science', 'paper', true, 0, 'full')] })
    expect(day.find((e) => e.key === 'p')?.paper).toBe('full')
  })
})

describe('waktu', () => {
  it('Tes memakai 75 detik per soal', () => {
    expect(tesTimeLimitSec(8)).toBe(600)
    expect(tesTimeLimitSec(8, 60)).toBe(480)
  })
  it('hari sekolah sekitar 100 menit tanpa Hitung Cepat', () => {
    const per = (s: 'latihan' | 'tes' | 'paper') => sessionMinutes({ session: s, paper: 'mini' })
    const total = 3 * (per('latihan') + per('tes') + per('paper'))
    expect(total).toBeGreaterThanOrEqual(90)
    expect(total).toBeLessThanOrEqual(110)
  })
  it('sesi tautan memakai halaman lain', () => {
    expect(isLinkSession('lesson')).toBe(true)
    expect(isLinkSession('latihan')).toBe(false)
    expect(isLinkSession('paper')).toBe(false)
  })
})

describe('paper mini dengan aturan preset', () => {
  const ikmc: PresetRules = {
    questionCount: 24,
    timeLimitMin: 75,
    sections: [
      { from: 1, to: 8, points: 3 },
      { from: 9, to: 16, points: 4 },
      { from: 17, to: 24, points: 5 },
    ],
  }
  const sasmo: PresetRules = {
    questionCount: 25,
    timeLimitMin: 90,
    startScore: 15,
    sections: [
      { from: 1, to: 15, points: 2, wrongPenalty: 1 },
      { from: 16, to: 25, points: 4 },
    ],
  }
  it('membagi soal sebanding dan tetap sah', () => {
    const r = scaleRulesToCount(ikmc, 8, 15)
    expect(r.questionCount).toBe(8)
    expect(r.timeLimitMin).toBe(15)
    expect(r.sections.map((s) => s.to - s.from + 1)).toEqual([3, 3, 2])
    expect(r.sections.map((s) => s.points)).toEqual([3, 4, 5])
    expect(validateRules(r)).toEqual([])
  })
  it('skor awal ikut diperkecil dan pengurang tetap', () => {
    const r = scaleRulesToCount(sasmo, 8, 15)
    expect(validateRules(r)).toEqual([])
    expect(r.startScore).toBe(5)
    expect(r.sections[0]!.wrongPenalty).toBe(1)
    const s = scoreWithPreset(r, [
      { position: 1, status: 'correct' },
      { position: 2, status: 'wrong' },
    ])
    expect(s.raw).toBe(5 + 2 - 1)
  })
  it('jumlah soal sama atau lebih besar dari aturan memakai aturan asli', () => {
    const r = scaleRulesToCount(ikmc, 24)
    expect(r.sections).toEqual(ikmc.sections)
    expect(scaleRulesToCount(ikmc, 40).questionCount).toBe(24)
  })
  it('poin per nomor soal', () => {
    const m = pointsByPosition(scaleRulesToCount(ikmc, 8))
    expect([...m.values()]).toEqual([3, 3, 3, 4, 4, 4, 5, 5])
  })
})

describe('ulang sesi', () => {
  it('XP ulang 25 persen dengan minimum 1', () => {
    expect(retryXp(20)).toBe(5)
    expect(retryXp(10)).toBe(3)
    expect(retryXp(5)).toBe(1)
    expect(retryXp(1)).toBe(1)
    expect(retryXp(0)).toBe(0)
    expect(sessionCompletionXp({ session: 'paper', perfect: true })).toBe(40)
    expect(sessionCompletionXp({ session: 'paper', perfect: true, retry: true })).toBe(10)
    expect(sessionCompletionXp({ session: 'latihan', perfect: false })).toBe(20)
    expect(sessionCompletionXp({ session: 'review', perfect: false })).toBe(20)
  })
  it('skor terbaik dan perbaikan', () => {
    const first = { raw: 6, max: 10, scaled: null }
    const second = { raw: 8, max: 10, scaled: null }
    expect(scoreFraction(first)).toBeCloseTo(0.6)
    expect(bestIndex([first, second])).toBe(1)
    expect(bestIndex([second, first])).toBe(0)
    expect(bestIndex([])).toBe(-1)
    expect(retryImproved([first], second)).toBe(true)
    expect(retryImproved([first, second], { raw: 8, max: 10, scaled: null })).toBe(false)
    expect(retryImproved([], second)).toBe(false)
  })
  it('skor berskala dipakai bila tidak ada maksimum', () => {
    expect(scoreFraction({ raw: null, max: null, scaled: 70 })).toBeCloseTo(0.7)
    expect(scoreFraction({ raw: -3, max: 10, scaled: null })).toBe(0)
  })
})

describe('susunan Latihan dan Tes', () => {
  const pool = [1, 2, 3, 4, 5].flatMap((d) => Array.from({ length: 8 }, (_, i) => ({ ref: `i-${d}-${i}`, difficulty: d })))
  const meanP = (refs: string[], theta: number) => {
    const ps = refs.map((r) => pCorrect(theta, difficultyToB(Number(r.split('-')[1]))))
    return ps.reduce((a, b) => a + b, 0) / ps.length
  }
  it('Latihan 10 soal mudah, Tes 8 soal lebih sulit', () => {
    const lat = assembleSession({ kind: 'latihan', theta: 0, candidates: pool, count: 10, rng: createRng(1) })
    const tes = assembleSession({ kind: 'tes', theta: 0, candidates: pool, count: 8, rng: createRng(1) })
    expect(lat).toHaveLength(10)
    expect(tes).toHaveLength(8)
    expect(meanP(lat.map((s) => s.ref), 0)).toBeGreaterThan(meanP(tes.map((s) => s.ref), 0))
    expect(meanP(lat.map((s) => s.ref), 0)).toBeGreaterThanOrEqual(EASY_BAND[0] - 0.15)
    expect(meanP(tes.map((s) => s.ref), 0)).toBeLessThanOrEqual(TEST_BAND[1] + 0.1)
    expect(tes.every((s) => s.section === 'core')).toBe(true)
  })
  it('Tes menghindari soal Latihan hari itu', () => {
    const lat = assembleSession({ kind: 'latihan', theta: 0, candidates: pool, count: 10, rng: createRng(2) })
    const tes = assembleSession({ kind: 'tes', theta: 0, candidates: pool, count: 8, avoid: new Set(lat.map((s) => s.ref)), rng: createRng(3) })
    expect(tes.filter((t) => lat.some((l) => l.ref === t.ref))).toHaveLength(0)
  })
  it('bank soal kecil: soal yang dihindari dipakai lagi tanpa duplikat', () => {
    const small = Array.from({ length: 9 }, (_, i) => ({ ref: `s-${i}`, difficulty: 3 }))
    const tes = assembleSession({ kind: 'tes', theta: 0, candidates: small, count: 8, avoid: new Set(small.slice(0, 5).map((s) => s.ref)), rng: createRng(4) })
    expect(tes).toHaveLength(8)
    expect(new Set(tes.map((t) => t.ref)).size).toBe(8)
  })
  it('tanpa reuse hasilnya bisa kurang dari jumlah soal supaya skill lain mengisi dulu', () => {
    const small = Array.from({ length: 9 }, (_, i) => ({ ref: `s-${i}`, difficulty: 3 }))
    const avoid = new Set(small.slice(0, 5).map((s) => s.ref))
    const strict = assembleSession({ kind: 'tes', theta: 0, candidates: small, count: 8, avoid, reuse: false, rng: createRng(7) })
    expect(strict).toHaveLength(4)
    expect(strict.some((s) => avoid.has(s.ref))).toBe(false)
  })
  it('Latihan memakai paling banyak dua kartu Buku Koreksi di awal', () => {
    const due = [1, 2, 3, 4].map((n) => ({ ref: `due-${n}`, difficulty: 2 }))
    const lat = assembleSession({ kind: 'latihan', theta: 0, dueRefs: due, candidates: pool, count: 10, rng: createRng(5) })
    expect(lat.filter((s) => s.section === 'warmup')).toHaveLength(2)
    expect(lat).toHaveLength(10)
    expect(lat[0]!.section).toBe('warmup')
    const tes = assembleSession({ kind: 'tes', theta: 0, dueRefs: due, candidates: pool, count: 8, rng: createRng(5) })
    expect(tes.some((s) => s.section === 'warmup')).toBe(false)
  })
  it('generator tanpa batas mengisi Latihan walau hanya satu kandidat', () => {
    const gens = [{ ref: 'gen:m2.x:2', difficulty: 2, unlimited: true }]
    const lat = assembleSession({ kind: 'latihan', theta: 0, candidates: gens, count: 10, rng: createRng(6) })
    expect(lat).toHaveLength(10)
    expect(pickItems({ candidates: gens, theta: 0, count: 1, band: TEST_BAND, rng: createRng(1) })).toHaveLength(1)
  })
})

describe('streak sesi harian', () => {
  const since = '2026-10-05'
  it('hari lengkap bila semua sesi wajib selesai, sembilan pada hari sekolah', () => {
    const days = [
      { date: '2026-10-05', questsDone: 9, questsRequired: 9 },
      { date: '2026-10-06', questsDone: 8, questsRequired: 9 },
    ]
    const r = computeStreak({ days, today: '2026-10-07', restWeekdays: [0], since })
    expect(r.statusByDate.get('2026-10-05')).toBe('complete')
    expect(r.statusByDate.get('2026-10-06')).toBe('partial')
    expect(r.current).toBe(0)
  })
  it('Hari ringan: tiga sesi wajib cukup untuk menjaga streak', () => {
    const days = [
      { date: '2026-10-05', questsDone: 9, questsRequired: 9 },
      { date: '2026-10-06', questsDone: 3, questsRequired: 3 },
      { date: '2026-10-07', questsDone: 9, questsRequired: 9 },
    ]
    const r = computeStreak({ days, today: '2026-10-07', restWeekdays: [0], since })
    expect(r.current).toBe(3)
  })
  it('hari tanpa catatan butuh sembilan sesi', () => {
    const r = computeStreak({ days: [], today: '2026-10-06', restWeekdays: [0], since })
    expect(r.statusByDate.get('2026-10-05')).toBe('missed')
  })
})

describe('lencana sesi', () => {
  const zero: BadgeStats = {
    questsDone: 0, perfectQuests: 0, answersTotal: 0, currentStreak: 0, bestStreak: 0, masteredSkills: 0,
    reviewSessions: 0, simulationsDone: 0, olympiadPapersDone: 0, lessonsDone: 0, subjectsToday: 0,
    hintsUsedThenCorrect: 0, esmoPackagesDone: 0, speakingDone: 0, writingDone: 0,
    papersDone: 0, papersPassed: 0, testsPerfect: 0, testsEarlyPerfect: 0, retriesImproved: 0,
  }
  const ids = (s: Partial<BadgeStats>) => earnedBadges({ ...zero, ...s }, new Set()).map((b) => b.id)
  it('paper pertama, di atas batas lulus, dan sepuluh paper', () => {
    expect(ids({ papersDone: 1 })).toEqual(['first-paper'])
    expect(ids({ papersDone: 1, papersPassed: 1 })).toEqual(['first-paper', 'paper-pass'])
    expect(ids({ papersDone: 10 })).toEqual(['first-paper', 'papers-10'])
  })
  it('tes sempurna, selesai lebih awal, dan pantang menyerah', () => {
    expect(ids({ testsPerfect: 1 })).toEqual(['perfect-test'])
    expect(ids({ testsPerfect: 1, testsEarlyPerfect: 1 })).toEqual(['perfect-test', 'early-finish'])
    expect(ids({ retriesImproved: 1 })).toEqual(['never-give-up'])
  })
})
