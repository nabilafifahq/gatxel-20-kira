import { describe, expect, it } from 'vitest'
import {
  ACCESSORIES,
  ACCESSORY_IDS,
  ARENA_BADGES,
  BADGES,
  FULL_XP_ROUNDS,
  accessoryHowToEarn,
  applyDiminishing,
  diminishingFactor,
  earnedAccessories,
  earnedArenaBadges,
  emptyArenaBadgeStats,
  emptyTrackXp,
  isXpTrack,
  levelForXp,
  levelUps,
  newlyEarnedAccessories,
  qmAnswerXp,
  roundRawXp,
  trackLevels,
  trackProgress,
  trackXpFromRows,
  xpForLevel,
  type ArenaBadgeStats,
} from '../src'

describe('jalur XP', () => {
  it('menjumlahkan XP per jalur dan mengabaikan jalur yang tidak dikenal', () => {
    const xp = trackXpFromRows([
      { track: 'belajar', xp: 120 },
      { track: 'hitung', xp: 40 },
      { track: 'hitung', xp: 70 },
      { track: 'pengetahuan', xp: 5 },
      { track: 'lain', xp: 999 },
    ])
    expect(xp).toEqual({ belajar: 120, hitung: 110, pengetahuan: 5 })
  })

  it('XP negatif tidak membuat jalur di bawah nol', () => {
    expect(trackXpFromRows([{ track: 'hitung', xp: -50 }]).hitung).toBe(0)
  })

  it('level per jalur memakai rumus yang sama: level 2 di 100, level 3 di 300', () => {
    expect(trackLevels({ belajar: 99, hitung: 100, pengetahuan: 300 })).toEqual({ belajar: 1, hitung: 2, pengetahuan: 3 })
    for (const xp of [0, 49, 100, 299, 300, 599, 600, 4500]) expect(trackLevels({ belajar: xp, hitung: xp, pengetahuan: xp }).hitung).toBe(levelForXp(xp))
  })

  it('trackProgress memberi persen, sisa XP, dan urutan tiga jalur', () => {
    const p = trackProgress({ belajar: 0, hitung: 150, pengetahuan: 300 })
    expect(p.map((x) => x.track)).toEqual(['belajar', 'hitung', 'pengetahuan'])
    expect(p[1]).toMatchObject({ level: 2, into: 50, span: 200, toNext: 150, percent: 25 })
    expect(p[2]).toMatchObject({ level: 3, into: 0, percent: 0 })
    expect(p[0]!.level).toBe(1)
    expect(xpForLevel(2)).toBe(100)
  })

  it('levelUps hanya menyebut jalur yang naik', () => {
    const before = { belajar: 50, hitung: 90, pengetahuan: 0 }
    const after = { belajar: 60, hitung: 120, pengetahuan: 0 }
    expect(levelUps(before, after)).toEqual([{ track: 'hitung', from: 1, to: 2 }])
    expect(levelUps(after, after)).toEqual([])
  })

  it('isXpTrack dan emptyTrackXp', () => {
    expect(isXpTrack('hitung')).toBe(true)
    expect(isXpTrack('x')).toBe(false)
    expect(emptyTrackXp()).toEqual({ belajar: 0, hitung: 0, pengetahuan: 0 })
  })
})

describe('XP arena dan anti penggilingan', () => {
  it('ronde 1 sampai 6 hari itu penuh, lalu menyusut', () => {
    for (let before = 0; before < FULL_XP_ROUNDS; before++) expect(diminishingFactor(before)).toBe(1)
    expect(diminishingFactor(6)).toBe(0.5)
    expect(diminishingFactor(11)).toBe(0.5)
    expect(diminishingFactor(12)).toBe(0.25)
    expect(diminishingFactor(19)).toBe(0.25)
    expect(diminishingFactor(20)).toBe(0.1)
    expect(diminishingFactor(500)).toBe(0.1)
  })

  it('XP menyusut tetapi tidak pernah di bawah 1 bila ada XP mentah', () => {
    expect(applyDiminishing(40, 0)).toBe(40)
    expect(applyDiminishing(40, 6)).toBe(20)
    expect(applyDiminishing(40, 25)).toBe(4)
    expect(applyDiminishing(3, 60)).toBe(1)
    expect(applyDiminishing(0, 0)).toBe(0)
  })

  it('XP harian arena terbatas: 100 ronde penuh tidak jauh lebih banyak dari ronde ke-20', () => {
    let total = 0
    for (let r = 0; r < 100; r++) total += applyDiminishing(50, r)
    const first20 = Array.from({ length: 20 }, (_, r) => applyDiminishing(50, r)).reduce((a, b) => a + b, 0)
    expect(total).toBeLessThan(first20 + 80 * 6)
    expect(applyDiminishing(50, 99)).toBeLessThanOrEqual(5)
  })

  it('XP per jawaban naik dengan level Quick Maths', () => {
    expect(qmAnswerXp(1)).toBe(1)
    expect(qmAnswerXp(3)).toBe(2)
    expect(qmAnswerXp(8)).toBe(4)
    expect(qmAnswerXp(99)).toBe(4)
  })

  it('bonus selesai dan sempurna hanya untuk ronde cukup panjang', () => {
    expect(roundRawXp({ perCorrectXp: [2, 2, 2], answered: 3, correct: 3 })).toBe(6)
    expect(roundRawXp({ perCorrectXp: Array(8).fill(2), answered: 8, correct: 8 })).toBe(21)
    expect(roundRawXp({ perCorrectXp: Array(10).fill(2), answered: 10, correct: 10 })).toBe(30)
    expect(roundRawXp({ perCorrectXp: Array(9).fill(2), answered: 10, correct: 9 })).toBe(23)
  })
})

describe('aksesori avatar', () => {
  it('setiap id punya definisi, dan ada tiga aksesori per jalur', () => {
    expect(ACCESSORIES.map((a) => a.id).sort()).toEqual([...ACCESSORY_IDS].sort())
    for (const track of ['belajar', 'hitung', 'pengetahuan'] as const) expect(ACCESSORIES.filter((a) => a.track === track)).toHaveLength(3)
  })

  it('didapat dari level jalurnya', () => {
    expect(earnedAccessories({ belajar: 1, hitung: 1, pengetahuan: 1 })).toEqual([])
    expect(earnedAccessories({ belajar: 3, hitung: 6, pengetahuan: 2 }).map((a) => a.id)).toEqual(['star-pin', 'visor', 'glasses'])
    expect(earnedAccessories({ belajar: 10, hitung: 10, pengetahuan: 10 })).toHaveLength(9)
  })

  it('newlyEarnedAccessories menyebut yang baru didapat', () => {
    const got = newlyEarnedAccessories({ belajar: 2, hitung: 2, pengetahuan: 2 }, { belajar: 2, hitung: 3, pengetahuan: 2 })
    expect(got.map((a) => a.id)).toEqual(['visor'])
  })

  it('teks cara mendapatkan memakai Earn, bukan kata terlarang', () => {
    for (const a of ACCESSORIES) {
      const text = accessoryHowToEarn(a)
      expect(text.startsWith('Earn it at ')).toBe(true)
      expect(text.toLowerCase()).not.toContain('unlock')
    }
  })
})

describe('lencana arena', () => {
  const stats = (over: Partial<ArenaBadgeStats> = {}): ArenaBadgeStats => ({ ...emptyArenaBadgeStats(), ...over })

  it('ada sekitar 25 lencana dengan id unik dan tidak bentrok dengan lencana lama', () => {
    expect(ARENA_BADGES.length).toBeGreaterThanOrEqual(25)
    expect(ARENA_BADGES.length).toBeLessThanOrEqual(32)
    const ids = [...BADGES.map((b) => b.id), ...ARENA_BADGES.map((b) => b.id)]
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('statistik kosong tidak memberi lencana apa pun', () => {
    expect(earnedArenaBadges(stats(), new Set())).toEqual([])
  })

  it('lencana yang sudah dimiliki tidak diberikan lagi', () => {
    const got = earnedArenaBadges(stats({ qmRounds: 1 }), new Set(['qm-first']))
    expect(got.map((b) => b.id)).not.toContain('qm-first')
  })

  it('Quick Maths: 20, 40, dan 60 per menit', () => {
    expect(earnedArenaBadges(stats({ qmBestSprintPpm: 19.9 }), new Set()).map((b) => b.id)).not.toContain('qm-ppm-20')
    expect(earnedArenaBadges(stats({ qmBestSprintPpm: 20 }), new Set()).map((b) => b.id)).toEqual(['qm-ppm-20'])
    expect(earnedArenaBadges(stats({ qmBestSprintPpm: 41 }), new Set()).map((b) => b.id)).toEqual(['qm-ppm-20', 'qm-ppm-40'])
    expect(earnedArenaBadges(stats({ qmBestSprintPpm: 60 }), new Set()).map((b) => b.id)).toEqual(['qm-ppm-20', 'qm-ppm-40', 'qm-ppm-60'])
  })

  it('Quick Maths: sprint sempurna, empat operasi, Flash Anzan level 5, Target 20', () => {
    const ids = (s: Partial<ArenaBadgeStats>) => earnedArenaBadges(stats(s), new Set()).map((b) => b.id)
    expect(ids({ qmPerfectSprint: true })).toContain('qm-sprint-perfect')
    expect(ids({ qmOpsPlayed: 3 })).not.toContain('qm-all-ops')
    expect(ids({ qmOpsPlayed: 4 })).toContain('qm-all-ops')
    expect(ids({ qmFlashCleared: 4 })).not.toContain('qm-flash-5')
    expect(ids({ qmFlashCleared: 5 })).toContain('qm-flash-5')
    expect(ids({ qmTarget20Sec: 90.5 })).not.toContain('qm-target-90')
    expect(ids({ qmTarget20Sec: 88 })).toContain('qm-target-90')
    expect(ids({ qmTarget20Sec: null })).not.toContain('qm-target-90')
  })

  it('Quick Maths: tabel, strategi, misi', () => {
    const ids = (s: Partial<ArenaBadgeStats>) => earnedArenaBadges(stats(s), new Set()).map((b) => b.id)
    expect(ids({ qmTablesMastered: 5 })).toContain('qm-tables-5')
    expect(ids({ qmTablesMastered: 8 })).not.toContain('qm-tables-all')
    expect(ids({ qmTablesMastered: 9 })).toContain('qm-tables-all')
    expect(ids({ qmStrategies: 7 })).toContain('qm-strategies')
    expect(ids({ qmMissionsDone: 1 })).toContain('qm-mission-1')
    expect(ids({ qmMissionStreak: 6 })).not.toContain('qm-mission-7')
    expect(ids({ qmMissionStreak: 7 })).toContain('qm-mission-7')
  })

  it('Quiz Arena: bendera Asia, semua bendera, provinsi, planet, ibu kota', () => {
    const ids = (s: Partial<ArenaBadgeStats>) => earnedArenaBadges(stats(s), new Set()).map((b) => b.id)
    expect(ids({ quizAsiaFlagsKnown: 47, quizAsiaFlagsTotal: 48 })).not.toContain('quiz-flags-asia')
    expect(ids({ quizAsiaFlagsKnown: 48, quizAsiaFlagsTotal: 48 })).toContain('quiz-flags-asia')
    expect(ids({ quizAsiaFlagsKnown: 0, quizAsiaFlagsTotal: 0 })).not.toContain('quiz-flags-asia')
    expect(ids({ quizFlagsKnown: 190, quizFlagsTotal: 190 })).toContain('quiz-flags-world')
    expect(ids({ quizProvincesKnown: 38, quizProvincesTotal: 38 })).toContain('quiz-provinces')
    expect(ids({ quizPlanetsKnown: 8, quizPlanetsTotal: 8 })).toContain('quiz-planets')
    expect(ids({ quizCapitalsKnown: 49 })).not.toContain('quiz-capitals-50')
    expect(ids({ quizCapitalsKnown: 50 })).toContain('quiz-capitals-50')
    expect(ids({ quizTopicsTried: 12, quizTopicsTotal: 12 })).toContain('quiz-topics-all')
    expect(ids({ quizSpeedBest: 20 })).toContain('quiz-speed-20')
    expect(ids({ quizPerfectRound: true })).toContain('quiz-perfect')
  })

  it('level jalur memberi lencana level', () => {
    const ids = (levels: ArenaBadgeStats['levels']) => earnedArenaBadges(stats({ levels }), new Set()).map((b) => b.id)
    expect(ids({ belajar: 1, hitung: 5, pengetahuan: 1 })).toEqual(['lvl-qm-5'])
    expect(ids({ belajar: 5, hitung: 5, pengetahuan: 5 })).toEqual(['lvl-qm-5', 'lvl-quiz-5', 'lvl-all-5'])
  })

  it('teks lencana: tanpa kata terlarang atau tanda pisah', () => {
    for (const b of ARENA_BADGES) {
      const text = `${b.title} ${b.description}`
      expect(text).not.toMatch(/[–—]/)
      expect(text.toLowerCase()).not.toMatch(/unlock|navigate|landscape/)
      expect(b.glyph.length).toBeLessThanOrEqual(5)
    }
  })
})
