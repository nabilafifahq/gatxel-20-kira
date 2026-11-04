import { describe, expect, it } from 'vitest'
import { genRef, instanceSignature } from '@kira/content/math'
import { renderWeekSummaryEmail } from '@/components/family/WeekSummaryEmail'
import { weekSummary } from '@/dev/fixtures/family'
import type { CoachDTO } from '@/lib/dto-coach'
import { coverageFor, isMonth, monthRange, nextMonthAdvice, recentMonths, replayMonth } from '@/server/dal/coach-report'
import { dataNote, dataState, MIN_ANSWERS, praiseSentence, selectStrength, selectWeak, type SkillSnapshot } from '@/server/dal/coach-logic'
import { chooseWorksheetRefs, difficultyBand, WORKSHEET_LENGTHS } from '@/server/dal/worksheet-logic'

const snap = (skillId: string, subject: SkillSnapshot['subject'], accuracy: number | null, answers = 12, extra: Partial<SkillSnapshot> = {}): SkillSnapshot => ({
  skillId,
  subject,
  grade: 3,
  strand: 'Ni',
  title: skillId,
  stars: accuracy === null ? 0 : accuracy >= 0.85 ? 3 : accuracy >= 0.7 ? 2 : 1,
  gate: accuracy === null ? 'new' : accuracy >= 0.85 ? 'mastered' : accuracy >= 0.7 ? 'review' : 'reteach',
  answers,
  accuracy,
  ...extra,
})

describe('pelatih: memilih skill dari data nyata', () => {
  it('hanya skill dengan cukup jawaban yang dihitung, dan yang terlemah lebih dulu', () => {
    const weak = selectWeak([snap('a', 'math', 0.5), snap('b', 'math', 0.4), snap('c', 'english', 0.6), snap('d', 'science', 0.1, MIN_ANSWERS - 1)])
    expect(weak.map((s) => s.skillId)).toEqual(['b', 'a', 'c'])
  })

  it('paling banyak dua per mapel, sisa slot diisi bila mapel lain kosong', () => {
    const weak = selectWeak([snap('a', 'math', 0.1), snap('b', 'math', 0.2), snap('c', 'math', 0.3), snap('d', 'english', 0.9, 12, { stars: 3, gate: 'review' })])
    expect(weak.map((s) => s.skillId)).toEqual(['a', 'b', 'd'])
    expect(selectWeak([snap('a', 'math', 0.1), snap('b', 'math', 0.2), snap('c', 'math', 0.3)]).length).toBe(3)
  })

  it('skill yang sudah dikuasai dan skill olimpiade tidak ditunjuk sebagai lemah', () => {
    expect(selectWeak([snap('a', 'math', 0.95), snap('o', 'math', 0.2, 12, { strand: 'Oly' })])).toEqual([])
  })

  it('data tipis dan kosong dijelaskan dengan jujur', () => {
    expect(dataState([])).toBe('empty')
    expect(dataState([snap('a', 'math', 0.5)])).toBe('thin')
    expect(dataState([snap('a', 'math', 0.5), snap('b', 'math', 0.5), snap('c', 'english', 0.5)])).toBe('ok')
    expect(dataNote('empty', 0)).toMatch(/Belum cukup data/)
    expect(dataNote('thin', 1)).toMatch(/Baru 1 skill/)
    expect(dataNote('ok', 3)).toBe('')
  })

  it('kekuatan: bintang minimal 2, bukan skill lemah, ketepatan tertinggi', () => {
    const weak = selectWeak([snap('w', 'math', 0.3)])
    const s = selectStrength([snap('w', 'math', 0.3), snap('x', 'english', 0.9), snap('y', 'science', 0.75)], weak)
    expect(s?.skillId).toBe('x')
    expect(selectStrength([snap('w', 'math', 0.3)], weak)).toBeNull()
  })

  it('kalimat pujian memuji usaha, berganti antarminggu, dan punya cadangan', () => {
    const strength = { title: 'Awalan dan akhiran' }
    const a = praiseSentence('Raka', strength, 'k:2026-11-02', true)
    expect(a).toContain('Raka')
    expect(a).toContain('Awalan dan akhiran')
    expect(new Set(['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'].map((w) => praiseSentence('Raka', strength, `k:${w}`, true))).size).toBeGreaterThan(1)
    expect(praiseSentence('Raka', null, 'x', true)).toMatch(/terima kasih/i)
    expect(praiseSentence('Raka', null, 'x', false)).toMatch(/kapan pun/i)
    expect(`${a}${praiseSentence('Raka', null, 'x', false)}`).not.toMatch(/pintar|jenius/i)
  })
})

describe('lembar kerja: memilih soal', () => {
  const statics = Array.from({ length: 12 }, (_, i) => ({ ref: `m3.t${i}`, difficulty: (i % 5) + 1, sig: `soal ${i % 10}` }))
  const base = { stars: 1, seed: 'abc', statics, genRef: (s: string, l: number, sd: string) => genRef(s, l as 1, sd), genSig: (r: string) => instanceSignature(r) }

  it('panjang lembar sesuai pilihan', () => {
    expect(WORKSHEET_LENGTHS.map((l) => l.count)).toEqual([6, 10, 15])
  })

  it('tanpa generator: soal tidak berulang dan naik dari mudah ke sulit', () => {
    const out = chooseWorksheetRefs({ ...base, count: 8, gen: null })
    expect(out.length).toBe(8)
    expect(new Set(out.map((o) => o.ref)).size).toBe(8)
    const sigs = out.map((o) => statics.find((s) => s.ref === o.ref)!.sig)
    expect(new Set(sigs).size).toBe(8)
    for (let i = 1; i < out.length; i++) expect(out[i]!.difficulty).toBeGreaterThanOrEqual(out[i - 1]!.difficulty)
  })

  it('dengan generator: sama untuk seed yang sama, berbeda untuk seed lain, tanpa instans kembar', () => {
    const gen = { skillId: 'm3.place-value', levels: [1, 2, 3, 4, 5] }
    const a = chooseWorksheetRefs({ ...base, count: 15, gen })
    const b = chooseWorksheetRefs({ ...base, count: 15, gen })
    const c = chooseWorksheetRefs({ ...base, count: 15, gen, seed: 'lain' })
    expect(a).toEqual(b)
    expect(a.map((x) => x.ref)).not.toEqual(c.map((x) => x.ref))
    expect(a.length).toBe(15)
    const sigs = a.map((x) => (x.ref.startsWith('gen:') ? instanceSignature(x.ref) : x.ref))
    expect(new Set(sigs).size).toBe(15)
  })

  it('rentang kesulitan mengikuti bintang anak', () => {
    expect(difficultyBand(0)).toEqual([1, 3])
    expect(difficultyBand(2)).toEqual([2, 4])
    expect(difficultyBand(3)).toEqual([3, 5])
  })
})

describe('rapor bulanan', () => {
  it('rentang bulan dan pemilih bulan', () => {
    expect(monthRange('2026-11')).toEqual({ start: '2026-11-01', endExclusive: '2026-12-01', days: 30 })
    expect(monthRange('2026-12').endExclusive).toBe('2027-01-01')
    expect(monthRange('2028-02').days).toBe(29)
    expect(isMonth('2026-13')).toBe(false)
    expect(isMonth('2026-1')).toBe(false)
    expect(recentMonths('2026-02-10', 3).map((m) => m.value)).toEqual(['2026-02', '2026-01', '2025-12'])
    expect(recentMonths('2026-11-04', 1)[0]!.label).toBe('November 2026')
  })

  it('replayMonth membandingkan bintang awal dan akhir bulan dari jawaban percobaan pertama', () => {
    const start = new Date('2026-11-01T00:00:00+07:00')
    const rows = Array.from({ length: 30 }, (_, i) => ({
      skillId: 'm3.place-value',
      at: new Date(start.getTime() + (i < 10 ? -86400000 * 5 : 86400000 * (i - 9))),
      correct: i >= 10,
      hintsUsed: 0,
      difficulty: 3,
    }))
    const r = replayMonth(rows, start, 3, () => 3).get('m3.place-value')!
    expect(r.monthTotal).toBe(20)
    expect(r.monthRight).toBe(20)
    expect(r.after.stars).toBeGreaterThan(r.before.stars)
  })

  it('cakupan Cambridge dihitung jujur: kuat, sedang dilatih, belum disentuh, tanpa skill', () => {
    const map = {
      objectives: { math: { '3': ['3Ni.01', '3Ni.02', '3Ni.03', '3Ni.04'] }, english: {}, science: {} },
      skills: {
        'm3.a': { match: 'direct', direct: ['3Ni.01'], partial: [] },
        'm3.b': { match: 'direct', direct: ['3Ni.02'], partial: [] },
        'm3.c': { match: 'partial', direct: [], partial: ['3Ni.03'] },
      },
    } as never
    const states = new Map([
      ['m3.a', { stars: 3, answers: 20 }],
      ['m3.b', { stars: 1, answers: 10 }],
    ])
    const c = coverageFor(map, 'math', 3, states, () => 'math')
    expect(c).toMatchObject({ total: 4, strong: 1, inProgress: 1, notYet: 1, noSkill: 1, stage: 3 })
    expect(c.frameworkTitle).toMatch(/Cambridge Primary Math/)
    expect(c.strong + c.inProgress + c.notYet + c.noSkill).toBe(c.total)
  })

  it('saran bulan depan: berdasarkan data, dan ada saran lembut untuk keluarga baru', () => {
    expect(nextMonthAdvice({ name: 'Raka', activeDays: 0, minutes: 0, weakTitles: [], coverage: [], hasData: false }).join(' ')).toMatch(/10 menit sehari/)
    const adv = nextMonthAdvice({
      name: 'Raka',
      activeDays: 6,
      minutes: 90,
      weakTitles: [{ title: 'Nilai tempat', subject: 'math' }],
      coverage: [{ subject: 'math', label: 'Math', frameworkTitle: 'x', stage: 3, total: 10, strong: 2, inProgress: 3, notYet: 4, noSkill: 1 }],
      hasData: true,
    })
    expect(adv.join(' ')).toMatch(/6 hari/)
    expect(adv.join(' ')).toMatch(/Nilai tempat/)
    expect(adv.join(' ')).toMatch(/2 dari 10/)
  })
})

describe('email mingguan memuat Pelatih', () => {
  const coach: CoachDTO = {
    learnerId: 'x',
    name: 'Raka',
    grade: 3,
    weekLabel: '2 sampai 8 November 2026',
    state: 'ok',
    note: '',
    weak: [
      {
        skillId: 'm3.place-value',
        subject: 'math',
        subjectLabel: 'Math',
        title: 'Nilai tempat',
        plain: 'Anak belajar nilai tempat.',
        accuracyLine: 'Sekitar 40% benar di 14 soal terakhir.',
        solid: false,
        activity: { id: 'm-np-b', title: 'Tiga kartu, angka terbesar', minutes: 10, materials: ['kartu'], steps: ['a', 'b', 'c'], ask: 'Kenapa?', easier: 'Mudah' },
      },
    ],
    starter: null,
    strength: { title: 'Awalan', subjectLabel: 'English', line: '3 bintang' },
    praise: 'Raka, aku senang kamu tidak menyerah.',
    minutesThisWeek: 25,
  }

  it('HTML dan teks memuat kegiatan, kekuatan, dan kalimat pujian; tanpa Pelatih email tetap sama', () => {
    const mail = renderWeekSummaryEmail(weekSummary, { coach, coachUrl: 'https://kira-rumah.test/keluarga/pelatih' })
    expect(mail.html).toContain('Pelatih minggu ini')
    expect(mail.html).toContain('Tiga kartu, angka terbesar')
    expect(mail.text).toContain('Kalimat untuk anak: Raka, aku senang kamu tidak menyerah.')
    expect(mail.text).toContain('https://kira-rumah.test/keluarga/pelatih')
    const plain = renderWeekSummaryEmail(weekSummary, {})
    expect(plain.html).not.toContain('Pelatih minggu ini')
  })
})
