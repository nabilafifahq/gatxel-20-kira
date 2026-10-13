import { describe, expect, it } from 'vitest'
import {
  classifySkills,
  minutesPerDay,
  pickNextCompetition,
  questTotals,
  repeatNote,
  replayGate,
  weekRangeLabel,
  type GateState,
  type SkillWeek,
} from '@/server/dal/week-summary'

const gate = (stars: number, g: GateState['gate'] = stars === 0 ? 'new' : stars === 1 ? 'reteach' : stars === 2 ? 'review' : 'mastered', accuracy: number | null = null, answers = 20): GateState => ({
  gate: g,
  stars,
  accuracy,
  answers,
})

function sk(id: string, week: [number, number], before: GateState, after: GateState, subject: SkillWeek['subject'] = 'math'): SkillWeek {
  return { skillId: id, subject, title: id, week: { right: week[0], total: week[1] }, before, after }
}

describe('weekRangeLabel', () => {
  it('menulis satu bulan, lintas bulan, dan lintas tahun', () => {
    expect(weekRangeLabel('2026-10-12')).toBe('Senin 12 sampai Minggu 18 Oktober 2026')
    expect(weekRangeLabel('2026-09-28')).toBe('Senin 28 September sampai Minggu 4 Oktober 2026')
    expect(weekRangeLabel('2025-12-29')).toBe('Senin 29 Desember 2025 sampai Minggu 4 Januari 2026')
  })
})

describe('minutesPerDay', () => {
  it('mengisi tujuh hari Sen sampai Min, hari tanpa catatan 0', () => {
    const out = minutesPerDay('2026-10-12', [
      { date: '2026-10-12', minutes: 45 },
      { date: '2026-10-14', minutes: 52.4 },
      { date: '2026-10-18', minutes: 10 },
      { date: '2026-10-19', minutes: 99 },
    ])
    expect(out.map((d) => d.label)).toEqual(['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'])
    expect(out.map((d) => d.minutes)).toEqual([45, 0, 52, 0, 0, 0, 10])
  })
})

describe('questTotals', () => {
  const base = { monday: '2026-10-12', restOverrides: [] as { date: string; rest: boolean }[], restWeekdays: [0] }

  it('menghitung hari belajar sampai hari ini, tanpa hari istirahat Minggu', () => {
    const r = questTotals({
      ...base,
      today: '2026-10-18',
      startedOn: '2026-09-01',
      rows: [
        { date: '2026-10-12', minutes: 40, questsDone: 3, questsRequired: 3, rest: false },
        { date: '2026-10-13', minutes: 30, questsDone: 2, questsRequired: 3, rest: false },
      ],
    })
    // Senin 3 dan Selasa 3 dari day_record, Rabu sampai Sabtu 4 hari x 9 sesi wajib; Minggu istirahat.
    expect(r).toEqual({ done: 5, planned: 42 })
  })

  it('tidak menghitung hari sesudah hari ini dan sebelum learner mulai', () => {
    const r = questTotals({ ...base, today: '2026-10-14', startedOn: '2026-10-13', rows: [] })
    // Rabu dan Kamis, 2 hari x 9 sesi wajib.
    expect(r).toEqual({ done: 0, planned: 18 })
  })

  it('learner yang belum pernah mulai tidak punya rencana quest', () => {
    expect(questTotals({ ...base, today: '2026-10-14', startedOn: null, rows: [] })).toEqual({ done: 0, planned: 0 })
  })

  it('rest_day mengalahkan hari istirahat mingguan, dan quest_required dari day_record dipakai', () => {
    const r = questTotals({
      ...base,
      today: '2026-10-18',
      startedOn: '2026-09-01',
      restOverrides: [
        { date: '2026-10-18', rest: false },
        { date: '2026-10-15', rest: true },
      ],
      rows: [{ date: '2026-10-12', minutes: 10, questsDone: 1, questsRequired: 2, rest: false }],
    })
    // Sen 2 + Sel 9 + Rab 9 + Kam istirahat + Jum 9 + Sab 9 + Min 9 (bukan istirahat lagi) = 47
    expect(r).toEqual({ done: 1, planned: 47 })
  })

  it('quest selesai tidak pernah melebihi rencana', () => {
    const r = questTotals({ ...base, today: '2026-10-18', startedOn: '2026-10-18', rows: [{ date: '2026-10-18', minutes: 20, questsDone: 3, questsRequired: 3, rest: true }] })
    expect(r).toEqual({ done: 3, planned: 3 })
  })
})

describe('replayGate', () => {
  it('kurang dari 10 jawaban tetap new dengan 0 bintang', () => {
    const r = replayGate(Array.from({ length: 9 }, () => ({ correct: true, hintsUsed: 0, difficulty: 3 })), 2, 2)
    expect(r).toMatchObject({ gate: 'new', stars: 0, answers: 9 })
  })

  it('banyak jawaban salah menjadi reteach, lalu naik bila mulai benar', () => {
    const wrong = Array.from({ length: 12 }, () => ({ correct: false, hintsUsed: 0, difficulty: 2 }))
    expect(replayGate(wrong, 2, 2)).toMatchObject({ gate: 'reteach', stars: 1 })
    const right = Array.from({ length: 40 }, () => ({ correct: true, hintsUsed: 0, difficulty: 3 }))
    expect(replayGate([...wrong, ...right], 2, 2)).toMatchObject({ gate: 'mastered', stars: 3 })
  })

  it('jawaban benar dengan hint dihitung 0,6', () => {
    const r = replayGate(Array.from({ length: 10 }, () => ({ correct: true, hintsUsed: 1, difficulty: 2 })), 2, 2)
    expect(r.accuracy).toBeCloseTo(0.6)
    expect(r.gate).toBe('reteach')
  })
})

describe('classifySkills', () => {
  it('akurasi minggu di bawah 70% masuk Perlu diulang dengan angka', () => {
    const { up, repeat } = classifySkills([sk('m2.a', [2, 6], gate(2), gate(2, 'review', 0.72))])
    expect(up).toEqual([])
    expect(repeat.map((r) => [r.skillId, r.note])).toEqual([['m2.a', '2 dari 6 benar minggu ini']])
  })

  it('gerbang reteach masuk Perlu diulang walau minggu ini sedikit soal', () => {
    const { repeat } = classifySkills([sk('m2.b', [2, 2], gate(1), gate(1, 'reteach', 0.64, 10))])
    expect(repeat.map((r) => r.note)).toEqual(['64% benar di 10 soal terakhir'])
  })

  it('bintang naik ke 2 atau lebih masuk Naik', () => {
    const { up, repeat } = classifySkills([sk('e2.a', [3, 4], gate(1), gate(2, 'review', 0.75), 'english')])
    expect(repeat).toEqual([])
    expect(up.map((u) => [u.skillId, u.after.stars])).toEqual([['e2.a', 2]])
  })

  it('bintang naik hanya sampai 1 tidak dihitung naik', () => {
    const { up } = classifySkills([sk('m2.c', [5, 6], gate(0), gate(1, 'reteach', 0.69, 10))])
    expect(up).toEqual([])
  })

  it('minggu kuat tanpa kenaikan bintang tetap Naik bila 5 jawaban dan 80% atau lebih', () => {
    const { up } = classifySkills([
      sk('m2.strong', [4, 5], gate(3), gate(3)),
      sk('m2.few', [2, 2], gate(3), gate(3)),
      sk('m2.weak', [3, 5], gate(2), gate(2)),
    ])
    expect(up.map((u) => u.skillId)).toEqual(['m2.strong'])
  })

  it('skill yang tidak dilatih minggu ini diabaikan', () => {
    expect(classifySkills([sk('m2.idle', [0, 0], gate(1), gate(3))])).toEqual({ up: [], repeat: [] })
  })

  it('paling banyak 5 skill per daftar, yang paling lemah dulu', () => {
    const many = Array.from({ length: 7 }, (_, i) => sk(`m2.s${i}`, [i % 3, 6], gate(2), gate(2)))
    const { repeat } = classifySkills(many)
    expect(repeat).toHaveLength(5)
    expect(repeat[0]!.week.right).toBe(0)
  })
})

describe('repeatNote', () => {
  it('memakai catatan minggu bila akurasi minggu rendah, selain itu akurasi gerbang', () => {
    expect(repeatNote(sk('x', [1, 4], gate(1), gate(1, 'reteach', 0.5, 14)))).toBe('1 dari 4 benar minggu ini')
    expect(repeatNote(sk('x', [3, 3], gate(1), gate(1, 'reteach', 0.55, 25)))).toBe('55% benar di 20 soal terakhir')
  })
})

describe('pickNextCompetition', () => {
  const L = 'learner-a'
  it('memilih tanggal pasti terdekat untuk learner ini', () => {
    const rows = [
      { name: 'Perkiraan', date: '2026-10-20', dateIsEstimate: true, status: 'not-registered', learnerIds: [] },
      { name: 'Dilewati', date: '2026-10-21', dateIsEstimate: false, status: 'skip', learnerIds: [] },
      { name: 'Anak lain', date: '2026-10-22', dateIsEstimate: false, status: 'registered', learnerIds: ['learner-b'] },
      { name: 'Semua learner', date: '2026-11-01', dateIsEstimate: false, status: 'registered', learnerIds: [] },
      { name: 'Learner ini', date: '2026-10-30', dateIsEstimate: false, status: 'not-registered', learnerIds: [L] },
      { name: 'Sudah lewat', date: '2026-10-01', dateIsEstimate: false, status: 'registered', learnerIds: [L] },
    ]
    expect(pickNextCompetition(rows, L, '2026-10-12')).toEqual({ name: 'Learner ini', date: '2026-10-30' })
  })

  it('null bila tidak ada lomba dengan tanggal pasti', () => {
    expect(pickNextCompetition([{ name: 'X', date: null, dateIsEstimate: true, status: 'check', learnerIds: [] }], L, '2026-10-12')).toBeNull()
  })
})
