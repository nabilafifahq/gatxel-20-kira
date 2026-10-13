import { describe, expect, it } from 'vitest'
import {
  ADAPT_MIN_ANSWERED,
  FLASH_LEVELS,
  QM_MODE_INFO,
  QM_OPS,
  STRATEGIES,
  STRATEGY_IDS,
  borrowCount,
  carryCount,
  clientPrompts,
  defaultQmConfig,
  digitOfBeads,
  beadsOfDigit,
  digitsToNumber,
  factLabel,
  generateProblem,
  hintFor,
  initialQmLevels,
  missionComplete,
  missionStreak,
  missionTable,
  nextLevel,
  nextSimpleLevel,
  scoreQmRound,
  sorobanDigits,
  summariseQm,
  updateLevels,
  type QmConfig,
  type QmOp,
  type QmProblem,
  type QmStatRow,
} from '../src'

const SEEDS = Array.from({ length: 40 }, (_, i) => `seed-${i}`)

function cfg(over: Partial<QmConfig>): QmConfig {
  return { ...defaultQmConfig('practice'), ...over }
}

function arithOperands(p: QmProblem): { a: number; b: number } {
  expect(p.a).toBeDefined()
  expect(p.b).toBeDefined()
  return { a: p.a!, b: p.b! }
}

describe('Quick Maths: generator deterministik', () => {
  it('seed dan indeks yang sama selalu menghasilkan soal yang sama', () => {
    const c = cfg({ op: 'mixed' })
    for (const seed of SEEDS) for (let i = 0; i < 5; i++) expect(generateProblem(c, seed, i)).toEqual(generateProblem(c, seed, i))
  })

  it('seed berbeda menghasilkan rangkaian soal yang berbeda', () => {
    const c = cfg({ op: 'mixed' })
    const a = Array.from({ length: 20 }, (_, i) => generateProblem(c, 'alpha', i).answer)
    const b = Array.from({ length: 20 }, (_, i) => generateProblem(c, 'beta', i).answer)
    expect(a).not.toEqual(b)
  })

  it('clientPrompts tidak membawa kunci jawaban', () => {
    const json = JSON.stringify(clientPrompts(cfg({ op: 'add' }), 'x'))
    expect(json).not.toContain('"answer"')
    expect(clientPrompts(cfg({ op: 'add', count: 7 }), 'x')).toHaveLength(7)
  })
})

describe('Quick Maths: aman untuk kelas 2', () => {
  it('level otomatis: jawaban tidak negatif, bulat, dan pembagian selalu habis', () => {
    for (const op of QM_OPS) {
      for (let level = 1; level <= 8; level++) {
        const levels = { add: 1, sub: 1, mul: 1, div: 1, [op]: level }
        const c = cfg({ op, auto: true, levels })
        for (const seed of SEEDS) {
          for (let i = 0; i < 6; i++) {
            const p = generateProblem(c, seed, i)
            expect(Number.isInteger(p.answer)).toBe(true)
            expect(p.answer).toBeGreaterThanOrEqual(0)
            const { a, b } = arithOperands(p)
            if (op === 'add') expect(p.answer).toBe(p.missing ? b : a + b)
            if (op === 'sub') {
              expect(a).toBeGreaterThan(b)
              expect(p.answer).toBe(a - b)
              expect(p.answer).toBeGreaterThan(0)
            }
            if (op === 'mul') expect(p.answer).toBe(a * b)
            if (op === 'div') {
              expect(a % b).toBe(0)
              expect(p.answer).toBe(a / b)
              expect(p.answer).toBeGreaterThan(0)
            }
          }
        }
      }
    }
  })

  it('pengaturan manual: semua kombinasi digit, simpan atau pinjam tetap aman', () => {
    for (const op of ['add', 'sub', 'mul', 'div', 'mixed'] as const) {
      for (const digits of [1, 2, 3, 'mixed'] as const) {
        for (const carry of [true, false]) {
          const c = cfg({ op, digits, carry, auto: false })
          for (const seed of SEEDS.slice(0, 15)) {
            for (let i = 0; i < 6; i++) {
              const p = generateProblem(c, seed, i)
              expect(p.answer, `${op}/${digits}/${carry}/${seed}/${i}`).toBeGreaterThanOrEqual(0)
              expect(Number.isInteger(p.answer)).toBe(true)
              if (p.op === 'div') expect(p.a! % p.b!).toBe(0)
              if (p.op === 'sub') expect(p.a!).toBeGreaterThan(p.b!)
            }
          }
        }
      }
    }
  })

  it('carry mati: tanpa simpanan dan tanpa pinjaman untuk 2 dan 3 digit', () => {
    for (const digits of [2, 3] as const) {
      for (const seed of SEEDS) {
        const add = generateProblem(cfg({ op: 'add', digits, carry: false, auto: false }), seed, 0)
        expect(carryCount(add.a!, add.b!)).toBe(0)
        const sub = generateProblem(cfg({ op: 'sub', digits, carry: false, auto: false }), seed, 0)
        expect(borrowCount(sub.a!, sub.b!)).toBe(0)
      }
    }
  })

  it('carry hidup: ada simpanan dan pinjaman untuk 2 digit', () => {
    for (const seed of SEEDS) {
      const add = generateProblem(cfg({ op: 'add', digits: 2, carry: true, auto: false }), seed, 0)
      expect(carryCount(add.a!, add.b!)).toBeGreaterThan(0)
      const sub = generateProblem(cfg({ op: 'sub', digits: 2, carry: true, auto: false }), seed, 0)
      expect(borrowCount(sub.a!, sub.b!)).toBeGreaterThan(0)
    }
  })

  it('digit 1 menjaga operan satu angka', () => {
    for (const seed of SEEDS) {
      const p = generateProblem(cfg({ op: 'add', digits: 1, carry: false, auto: false }), seed, 0)
      expect(p.a).toBeLessThan(10)
      expect(p.b).toBeLessThan(10)
    }
  })

  it('level 1 penjumlahan tidak lebih dari 10, level 8 bisa tiga digit', () => {
    let big = false
    for (const seed of SEEDS) {
      const p1 = generateProblem(cfg({ op: 'add', levels: { add: 1, sub: 1, mul: 1, div: 1 } }), seed, 0)
      expect(p1.a! + p1.b!).toBeLessThanOrEqual(10)
      const p8 = generateProblem(cfg({ op: 'add', levels: { add: 8, sub: 1, mul: 1, div: 1 } }), seed, 0)
      if (p8.a! >= 100 && p8.b! >= 100) big = true
    }
    expect(big).toBe(true)
  })
})

describe('Quick Maths: tabel perkalian', () => {
  it('semua soal memakai tabel yang dipilih dan setiap pengali muncul sekali per 12 soal', () => {
    const c = cfg({ mode: 'tables', table: 7, division: false, count: 24 })
    const first = Array.from({ length: 12 }, (_, i) => generateProblem(c, 'tt', i))
    for (const p of first) {
      expect(p.fact).toBe('mul:7')
      expect([p.a, p.b]).toContain(7)
    }
    const others = first.map((p) => (p.a === 7 ? p.b : p.a)).sort((x, y) => x! - y!)
    expect(others).toEqual(Array.from({ length: 12 }, (_, i) => i + 1))
  })

  it('dengan pembagian, sepertiga soal adalah pembagian yang habis', () => {
    const c = cfg({ mode: 'tables', table: 6, division: true, count: 24 })
    const kinds = Array.from({ length: 24 }, (_, i) => generateProblem(c, 'tt', i))
    expect(kinds.filter((p) => p.op === 'div')).toHaveLength(8)
    for (const p of kinds.filter((x) => x.op === 'div')) expect(p.a! % 6).toBe(0)
  })
})

describe('Quick Maths: Flash Anzan', () => {
  it('jumlah selalu tidak negatif dan sesuai tanda, untuk semua level', () => {
    for (let level = 1; level <= FLASH_LEVELS.length; level++) {
      const c = cfg({ mode: 'flash', flashLevel: level })
      for (const seed of SEEDS) {
        const p = generateProblem(c, seed, 0)
        expect(p.prompt.kind).toBe('flash')
        if (p.prompt.kind !== 'flash') continue
        const spec = FLASH_LEVELS[level - 1]!
        expect(p.prompt.terms).toHaveLength(spec.terms)
        expect(p.prompt.intervalMs).toBe(spec.intervalMs)
        let running = 0
        for (const t of p.prompt.terms) {
          running += t
          expect(running).toBeGreaterThanOrEqual(0)
          if (!spec.signs) expect(t).toBeGreaterThan(0)
        }
        expect(p.answer).toBe(running)
      }
    }
  })

  it('angka yang sama tidak tampil dua kali berturut-turut', () => {
    const c = cfg({ mode: 'flash', flashLevel: 4 })
    let repeats = 0
    for (const seed of SEEDS) {
      const p = generateProblem(c, seed, 1)
      if (p.prompt.kind !== 'flash') continue
      for (let k = 1; k < p.prompt.terms.length; k++) if (Math.abs(p.prompt.terms[k]!) === Math.abs(p.prompt.terms[k - 1]!)) repeats++
    }
    expect(repeats).toBe(0)
  })
})

describe('Quick Maths: sempoa virtual', () => {
  it('manik dan angka saling bolak-balik untuk 0 sampai 9', () => {
    for (let d = 0; d <= 9; d++) expect(digitOfBeads(beadsOfDigit(d))).toBe(d)
    expect(beadsOfDigit(7)).toEqual({ heaven: 1, earth: 2 })
    expect(beadsOfDigit(4)).toEqual({ heaven: 0, earth: 4 })
  })

  it('sorobanDigits dan digitsToNumber saling membalik', () => {
    expect(sorobanDigits(47, 3)).toEqual([0, 4, 7])
    expect(digitsToNumber([0, 4, 7])).toBe(47)
  })

  it('tahap baca, atur, dan anzan menghasilkan soal yang benar', () => {
    for (const stage of ['read', 'set', 'anzan'] as const) {
      for (let level = 1; level <= 4; level++) {
        const c = cfg({ mode: 'soroban', sorobanStage: stage, sorobanLevel: level })
        for (const seed of SEEDS.slice(0, 10)) {
          const p = generateProblem(c, seed, 0)
          if (p.prompt.kind === 'bead-read') expect(digitsToNumber(p.prompt.digits)).toBe(p.answer)
          else if (p.prompt.kind === 'bead-set') expect(p.prompt.target).toBe(p.answer)
          else if (p.prompt.kind === 'bead-anzan') expect(digitsToNumber(p.prompt.digits) + (p.prompt.add ?? 0)).toBe(p.answer)
          else throw new Error('jenis tidak dikenal')
          expect(p.answer).toBeGreaterThan(0)
        }
      }
    }
  })
})

describe('Quick Maths: petunjuk strategi', () => {
  function lastNumberIn(text: string): number {
    const nums = text.match(/\d+/g)!
    return Number(nums[nums.length - 1])
  }

  it('baris terakhir petunjuk selalu memuat jawaban yang benar', () => {
    const bad: string[] = []
    for (const op of QM_OPS) {
      for (let level = 1; level <= 8; level++) {
        const c = cfg({ op, auto: true, levels: { add: 1, sub: 1, mul: 1, div: 1, [op]: level } })
        for (const seed of SEEDS) {
          for (let i = 0; i < 4; i++) {
            const p = generateProblem(c, seed, i)
            const h = hintFor(p)
            if (!h) {
              bad.push(`tanpa petunjuk: ${p.prompt.kind === 'arith' ? p.prompt.text : ''}`)
              continue
            }
            const last = h.steps[h.steps.length - 1]!
            if (!last.includes(String(p.answer))) bad.push(`${p.prompt.kind === 'arith' ? p.prompt.text : ''} -> ${last} (jawaban ${p.answer})`)
            expect(lastNumberIn(last)).toBeGreaterThanOrEqual(0)
          }
        }
      }
    }
    expect(bad).toEqual([])
  })

  it('petunjuk soal fokus strategi juga benar', () => {
    for (const focus of STRATEGY_IDS) {
      for (const seed of SEEDS) {
        const p = generateProblem(cfg({ focus, count: 5 }), seed, 0)
        const h = hintFor(p)
        expect(h, focus).not.toBeNull()
        expect(h!.steps[h!.steps.length - 1]).toContain(String(p.answer))
      }
    }
  })

  it('Flash Anzan dan sempoa tidak punya petunjuk strategi', () => {
    expect(hintFor(generateProblem(cfg({ mode: 'flash' }), 's', 0))).toBeNull()
    expect(hintFor(generateProblem(cfg({ mode: 'soroban' }), 's', 0))).toBeNull()
  })

  it('ada tujuh pelajaran strategi, masing-masing tiga kartu', () => {
    expect(STRATEGIES).toHaveLength(7)
    expect(STRATEGIES.map((s) => s.id).sort()).toEqual([...STRATEGY_IDS].sort())
    for (const s of STRATEGIES) expect(s.cards).toHaveLength(3)
  })

  it('latihan strategi menghasilkan jenis soal yang sesuai', () => {
    for (const seed of SEEDS) {
      const b = generateProblem(cfg({ focus: 'bonds10' }), seed, 0)
      expect(b.fact).toBe('add:bond10')
      const d = generateProblem(cfg({ focus: 'doubles' }), seed, 0)
      expect(['add:double', 'add:near-double', 'add:bond10']).toContain(d.fact)
      const br = generateProblem(cfg({ focus: 'bridge10' }), seed, 0)
      expect(br.fact).toBe('add:bridge10')
      const m = generateProblem(cfg({ focus: 'times-patterns' }), seed, 0)
      expect([2, 5, 9, 10].some((t) => m.fact === `mul:${t}`)).toBe(true)
    }
  })
})

describe('Quick Maths: adaptif', () => {
  it('naik saat akurasi di atas 90 persen dan kecepatan tidak turun', () => {
    expect(nextLevel({ level: 3, answered: 10, correct: 10, ppm: 20, prevPpm: 18 })).toEqual({ level: 4, change: 1 })
    expect(nextLevel({ level: 3, answered: 10, correct: 10, ppm: 20, prevPpm: null })).toEqual({ level: 4, change: 1 })
  })

  it('tidak naik saat kecepatan turun jauh atau akurasi hanya 90 persen', () => {
    expect(nextLevel({ level: 3, answered: 10, correct: 10, ppm: 10, prevPpm: 20 }).change).toBe(0)
    expect(nextLevel({ level: 3, answered: 10, correct: 9, ppm: 30, prevPpm: 20 }).change).toBe(0)
  })

  it('turun saat akurasi di bawah 60 persen, tidak turun dari level 1', () => {
    expect(nextLevel({ level: 4, answered: 10, correct: 5, ppm: 8, prevPpm: 10 })).toEqual({ level: 3, change: -1 })
    expect(nextLevel({ level: 1, answered: 10, correct: 2, ppm: 3, prevPpm: null })).toEqual({ level: 1, change: 0 })
  })

  it('tidak berubah bila jawaban terlalu sedikit, dan berhenti di level maksimum', () => {
    expect(nextLevel({ level: 3, answered: ADAPT_MIN_ANSWERED - 1, correct: 7, ppm: 30, prevPpm: 10 }).change).toBe(0)
    expect(nextLevel({ level: 8, answered: 12, correct: 12, ppm: 30, prevPpm: 10 })).toEqual({ level: 8, change: 0 })
  })

  it('updateLevels memperbarui tiap operasi sendiri dan mengembalikan perubahan', () => {
    const r = updateLevels(
      { add: 3, sub: 3, mul: 2, div: 1 },
      { add: { answered: 12, correct: 12, totalMs: 30000 }, mul: { answered: 10, correct: 4, totalMs: 40000 } },
      {},
    )
    expect(r.levels).toEqual({ add: 4, sub: 3, mul: 1, div: 1 })
    expect(r.changes).toEqual([
      { op: 'add', from: 3, to: 4 },
      { op: 'mul', from: 2, to: 1 },
    ])
    expect(r.ppm.add).toBe(24)
  })

  it('nextSimpleLevel untuk Flash Anzan lima soal', () => {
    expect(nextSimpleLevel(3, 4, 5, 8)).toBe(4)
    expect(nextSimpleLevel(3, 3, 5, 8)).toBe(3)
    expect(nextSimpleLevel(3, 1, 5, 8)).toBe(2)
    expect(nextSimpleLevel(8, 5, 5, 8)).toBe(8)
  })

  it('level awal naik menurut kelas', () => {
    expect(initialQmLevels(2).add).toBeGreaterThan(initialQmLevels(1).add)
    expect(initialQmLevels(5).mul).toBeGreaterThan(initialQmLevels(2).mul)
  })
})

describe('Quick Maths: skor ronde', () => {
  it('menghitung benar, salah, dilewati, per operasi, dan XP', () => {
    const c = cfg({ op: 'add', levels: { add: 1, sub: 1, mul: 1, div: 1 } })
    const answers = Array.from({ length: 10 }, (_, i) => {
      const p = generateProblem(c, 'score', i)
      return { i, a: i === 3 ? p.answer + 1 : i === 4 ? null : p.answer, ms: 2000, t: (i + 1) * 2000 }
    })
    const r = scoreQmRound(c, 'score', answers)
    expect(r.correct).toBe(8)
    expect(r.answered).toBe(9)
    expect(r.skipped).toBe(1)
    expect(r.perCorrectXp).toHaveLength(8)
    expect(r.perOp.add).toEqual({ answered: 9, correct: 8, totalMs: 18000 })
    expect(r.review).toHaveLength(10)
    expect(r.review.filter((x) => x.ok)).toHaveLength(8)
  })

  it('sprint memakai batas waktu penuh untuk soal per menit', () => {
    const c = cfg({ mode: 'sprint60', op: 'add' })
    const answers = Array.from({ length: 30 }, (_, i) => ({ i, a: generateProblem(c, 'sp', i).answer, ms: 1800, t: (i + 1) * 1800 }))
    const r = scoreQmRound(c, 'sp', answers)
    expect(r.durationMs).toBe(60000)
    expect(r.ppm).toBe(30)
  })

  it('target 20 memakai jam server dari mulai sampai jawaban terakhir', () => {
    const c = cfg({ mode: 'target20', op: 'add', count: 20 })
    const answers = Array.from({ length: 20 }, (_, i) => ({ i, a: generateProblem(c, 'tg', i).answer, ms: 2000, t: (i + 1) * 3000 }))
    const r = scoreQmRound(c, 'tg', answers)
    expect(r.durationMs).toBe(60000)
  })

  it('petunjuk memangkas XP jawaban separuh', () => {
    const c = cfg({ op: 'add', levels: { add: 5, sub: 1, mul: 1, div: 1 } })
    const p = generateProblem(c, 'h', 0)
    const plain = scoreQmRound(c, 'h', [{ i: 0, a: p.answer, ms: 1000, t: 1000 }])
    const hinted = scoreQmRound(c, 'h', [{ i: 0, a: p.answer, ms: 1000, t: 1000, hint: true }])
    expect(hinted.perCorrectXp[0]).toBeLessThan(plain.perCorrectXp[0]!)
    expect(hinted.perCorrectXp[0]).toBeGreaterThanOrEqual(1)
  })

  it('mode berwaktu terdaftar dengan batas yang benar', () => {
    expect(QM_MODE_INFO.sprint60.limitSec).toBe(60)
    expect(QM_MODE_INFO.sprint120.limitSec).toBe(120)
    expect(QM_MODE_INFO.target20.count).toBe(20)
    expect(QM_MODE_INFO.practice.timed).toBe(false)
  })
})

describe('Quick Maths: misi harian dan statistik', () => {
  it('misi selesai bila keempat langkah selesai', () => {
    expect(missionComplete(['warmup', 'sprint', 'flash'])).toBe(false)
    expect(missionComplete(['warmup', 'sprint', 'flash', 'tables'])).toBe(true)
  })

  it('tabel misi berganti per hari dan tetap sama di hari yang sama', () => {
    const days = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'].map(missionTable)
    expect(new Set(days).size).toBe(7)
    expect(missionTable('2026-10-13')).toBe(missionTable('2026-10-13'))
  })

  it('missionStreak menghitung hari berturut-turut sampai hari ini atau kemarin', () => {
    expect(missionStreak(['2026-10-11', '2026-10-12', '2026-10-13'], '2026-10-13')).toBe(3)
    expect(missionStreak(['2026-10-11', '2026-10-12'], '2026-10-13')).toBe(2)
    expect(missionStreak(['2026-10-10'], '2026-10-13')).toBe(0)
  })

  const row = (over: Partial<QmStatRow>): QmStatRow => ({ date: '2026-10-13', mode: 'sprint60', answered: 20, correct: 18, durationMs: 60000, ppm: 18, kinds: {}, ...over })

  it('summariseQm: rekor, akurasi, grafik mingguan, dan jenis paling lambat', () => {
    const rows: QmStatRow[] = [
      row({ ppm: 18, kinds: { 'mul:7': { n: 5, right: 3, ms: 30000 }, 'add:bridge10': { n: 10, right: 10, ms: 20000 }, 'flash:L2': { n: 5, right: 5, ms: 90000 } } }),
      row({ date: '2026-10-12', ppm: 25, correct: 25, answered: 26, durationMs: 60000, mode: 'sprint60' }),
      row({ date: '2026-10-12', mode: 'target20', answered: 20, correct: 20, durationMs: 83400, ppm: 14.4 }),
      row({ date: '2026-10-01', mode: 'practice', answered: 10, correct: 5, durationMs: 40000, ppm: 7.5 }),
    ]
    const s = summariseQm(rows, '2026-10-13')
    expect(s.rounds).toBe(4)
    expect(s.bestSprintPpm).toBe(25)
    expect(s.bestTargetSec).toBe(83.4)
    expect(s.week).toHaveLength(7)
    expect(s.week[6]).toMatchObject({ date: '2026-10-13', rounds: 1, correct: 18 })
    expect(s.week[5]).toMatchObject({ date: '2026-10-12', rounds: 2 })
    expect(s.slowest[0]).toMatchObject({ fact: 'mul:7', avgMs: 6000, accuracy: 60 })
    expect(s.slowest.map((x) => x.fact)).not.toContain('flash:L2')
    expect(s.bestAccuracyRound).toEqual({ correct: 20, answered: 20 })
  })

  it('statistik kosong tidak gagal', () => {
    const s = summariseQm([], '2026-10-13')
    expect(s.rounds).toBe(0)
    expect(s.accuracy).toBeNull()
    expect(s.bestSprintPpm).toBeNull()
    expect(s.week.every((d) => d.rounds === 0)).toBe(true)
  })

  it('factLabel memberi nama yang bisa dibaca', () => {
    expect(factLabel('mul:7')).toBe('7 times table')
    expect(factLabel('add:2d1d+')).toBe('2-digit plus 1-digit with carrying')
    expect(factLabel('sub:2d2d-')).toBe('2-digit minus 2-digit with borrowing')
    expect(factLabel('add:bridge10')).toBe('Adding across ten')
    expect(factLabel('flash:L5')).toBe('Flash Anzan level 5')
  })

  it('QM_OPS dipakai sebagai tipe operasi', () => {
    const ops: QmOp[] = [...QM_OPS]
    expect(ops).toHaveLength(4)
  })
})
