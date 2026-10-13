import { describe, expect, it } from 'vitest'
import {
  dayLabelId,
  defaultQuestionCount,
  firstPlannableDate,
  isRestDate,
  normaliseSlot,
  normaliseWeek,
  plannerDays,
  slotMinutes,
  suggestWeek,
  weekLabelLong,
  weekOf,
  type ExistingSlot,
  type NormaliseSlotInput,
  type SkillMeta,
  type SkillStateLite,
  type SuggestInput,
} from '@/server/dal/planner-logic'

function sk(id: string, order: number, extra: Partial<SkillMeta> = {}): SkillMeta {
  const subject = id[0] === 'm' ? 'math' : id[0] === 'e' ? 'english' : 'science'
  return {
    id,
    subject,
    grade: Number(id[1]),
    title: `T ${id}`,
    order,
    strand: 'Nc',
    prerequisites: [],
    competitions: [],
    hasLesson: false,
    ...extra,
  }
}

function st(gate: SkillStateLite['gate'], extra: Partial<SkillStateLite> = {}): SkillStateLite {
  return { gate, stars: gate === 'mastered' ? 3 : gate === 'review' ? 2 : gate === 'reteach' ? 1 : 0, recent: [], nAnswers: 0, lastPracticed: null, ...extra }
}

const MONDAY = '2026-10-19'
const week = weekOf(MONDAY)

function input(over: Partial<SuggestInput> & { list?: SkillMeta[] } = {}): SuggestInput {
  const list = over.list ?? []
  return {
    today: '2026-10-16',
    firstPlannable: '2026-10-16',
    days: week.map((date) => ({ date, rest: date === '2026-10-25' })),
    learnerGrade: 2,
    screenLimitMin: 60,
    curriculum: list.filter((s) => s.grade === 2),
    skills: new Map(list.map((s) => [s.id, s])),
    states: new Map(),
    slots: [],
    competitions: [],
    ...over,
  }
}

describe('minggu dan label', () => {
  it('menormalkan tanggal apa pun ke Senin', () => {
    expect(normaliseWeek('2026-10-15', '2026-10-01')).toBe('2026-10-12')
    expect(normaliseWeek('2026-10-18', '2026-10-01')).toBe('2026-10-12')
    expect(normaliseWeek('2026-10-19', '2026-10-01')).toBe('2026-10-19')
    expect(normaliseWeek(null, '2026-10-14')).toBe('2026-10-12')
  })

  it('menulis label hari dan minggu seperti fixture', () => {
    expect(dayLabelId('2026-10-19')).toBe('Senin 19 Okt')
    expect(dayLabelId('2026-10-25')).toBe('Minggu 25 Okt')
    expect(weekLabelLong('2026-10-19')).toBe('Senin 19 sampai Minggu 25 Oktober 2026')
    expect(weekLabelLong('2026-09-28')).toBe('Senin 28 September sampai Minggu 4 Oktober 2026')
    expect(weekLabelLong('2026-12-28')).toBe('Senin 28 Desember 2026 sampai Minggu 3 Januari 2027')
    expect(weekOf(MONDAY)).toHaveLength(7)
    expect(weekOf(MONDAY)[6]).toBe('2026-10-25')
  })

  it('memakai rest_day sebagai penimpa hari istirahat mingguan', () => {
    const none = new Map<string, boolean>()
    expect(isRestDate('2026-10-25', [0], none)).toBe(true)
    expect(isRestDate('2026-10-21', [0], none)).toBe(false)
    expect(isRestDate('2026-10-25', [0], new Map([['2026-10-25', false]]))).toBe(false)
    expect(isRestDate('2026-10-21', [0], new Map([['2026-10-21', true]]))).toBe(true)
  })

  it('hari ini hanya bisa direncanakan sebelum quest hari ini dibuat', () => {
    expect(firstPlannableDate('2026-10-16', false)).toBe('2026-10-16')
    expect(firstPlannableDate('2026-10-16', true)).toBe('2026-10-17')
  })
})

describe('menit per hari', () => {
  it('memakai estimateMinutes untuk skill dan menit paper untuk paper', () => {
    expect(slotMinutes({ questionCount: 10 })).toBe(15)
    expect(slotMinutes({ questionCount: 6 })).toBe(10)
    expect(slotMinutes({ questionCount: 4 })).toBe(5)
    expect(slotMinutes({ questionCount: 20, paperMinutes: 25 })).toBe(25)
    expect(slotMinutes({ questionCount: 20, paperMinutes: null })).toBe(30)
  })

  it('jumlah soal default: Latihan 10, Tes 8, Belajar lama 6, untuk semua grade', () => {
    expect(defaultQuestionCount('belajar', 2)).toBe(6)
    expect(defaultQuestionCount('latihan', 1)).toBe(10)
    expect(defaultQuestionCount('latihan', 4)).toBe(10)
    expect(defaultQuestionCount('tes', 2)).toBe(8)
  })

  it('menjumlahkan menit, menandai lewat batas, dan menolkan hari istirahat', () => {
    const days = plannerDays(
      week,
      new Set(['2026-10-25']),
      [
        { date: '2026-10-19', minutes: 30 },
        { date: '2026-10-19', minutes: 35 },
        { date: '2026-10-20', minutes: 15 },
        { date: '2026-10-25', minutes: 15 },
      ],
      60,
    )
    expect(days[0]).toEqual({ date: '2026-10-19', label: 'Senin 19 Okt', rest: false, totalMinutes: 65, overLimit: true })
    expect(days[1]).toMatchObject({ totalMinutes: 15, overLimit: false })
    expect(days[6]).toMatchObject({ rest: true, totalMinutes: 0, overLimit: false })
  })
})

describe('usulan', () => {
  const place = sk('m2.place-value', 10)
  const add = sk('m2.add', 20, { prerequisites: ['m2.place-value'], hasLesson: true })
  const sub = sk('m2.sub', 30, { prerequisites: ['m2.add'] })
  const money = sk('m2.money', 40)
  const time = sk('m2.time', 50)
  const oly = sk('m2.oly-patterns', 900, { strand: 'Oly', competitions: ['kmnr'] })
  const phonics = sk('e2.phonics', 10, { prerequisites: ['e1.sounds'] })
  const e1 = sk('e1.sounds', 10)
  const list = [place, add, sub, money, time, oly, phonics, e1]

  it('mengurutkan ajar ulang, review lama, lalu satu skill baru', () => {
    const states = new Map<string, SkillStateLite>([
      ['m2.place-value', st('review', { recent: [1, 1, 0.6, 1], nAnswers: 12, lastPracticed: '2026-10-07' })],
      ['m2.money', st('reteach', { recent: [1, 0, 0, 1, 0.6, 0, 1, 0, 1, 0], nAnswers: 10, lastPracticed: '2026-10-15' })],
      ['m2.time', st('review', { recent: [1], nAnswers: 10, lastPracticed: '2026-10-14' })],
    ])
    const out = suggestWeek(input({ list, states }))
    const math = out.filter((s) => s.subject === 'math')
    expect(math.map((s) => [s.date, s.skillId, s.kind])).toEqual([
      ['2026-10-19', 'm2.money', 'reteach'],
      ['2026-10-20', 'm2.place-value', 'review'],
      ['2026-10-21', 'm2.add', 'new'],
    ])
    expect(math[0]).toMatchObject({ id: '2026-10-19:math:m2.money', mode: 'latihan', questionCount: 10, reason: 'Akurasi 46% di 10 soal terakhir.' })
    expect(math[1]).toMatchObject({ mode: 'latihan', questionCount: 10, reason: 'Belum dilatih 9 hari.' })
    // m2.add punya pelajaran: pelajarannya ditawarkan di pembuka Latihan; prasyaratnya review di grade yang sama.
    expect(math[2]).toMatchObject({ mode: 'latihan', reason: 'Lanjutan dari T m2.place-value.' })
    // m2.time review tapi baru dilatih 2 hari lalu: tidak diusulkan.
    expect(out.some((s) => s.skillId === 'm2.time')).toBe(false)
    // Prasyarat lintas grade tanpa data dianggap terpenuhi.
    expect(out.find((s) => s.subject === 'english')).toMatchObject({ skillId: 'e2.phonics', reason: 'Lanjutan dari T e1.sounds di Grade 1.' })
  })

  it('melewati hari istirahat, hari yang sudah lewat, sel yang terisi, dan skill yang terjadwal', () => {
    const states = new Map<string, SkillStateLite>([
      ['m2.money', st('reteach', { recent: [0, 0, 1], nAnswers: 10 })],
      ['m2.time', st('reteach', { recent: [0, 1, 1], nAnswers: 10 })],
      ['m2.place-value', st('reteach', { recent: [0, 0, 0], nAnswers: 10 })],
    ])
    const slots: ExistingSlot[] = [
      { date: '2026-10-20', subject: 'math', kind: 'quest', skillId: 'm2.sub', minutes: 15 },
      { date: '2026-10-22', subject: 'math', kind: 'bonus', skillId: 'm2.place-value', minutes: 15 },
    ]
    const out = suggestWeek(
      input({
        list,
        states,
        slots,
        today: '2026-10-19',
        firstPlannable: '2026-10-20',
        days: week.map((date) => ({ date, rest: date === '2026-10-21' || date === '2026-10-25' })),
      }),
    ).filter((s) => s.subject === 'math')
    // Senin sudah lewat, Selasa terisi, Rabu istirahat; m2.place-value terjadwal sebagai bonus.
    expect(out.map((s) => [s.date, s.skillId])).toEqual([
      ['2026-10-22', 'm2.money'],
      ['2026-10-23', 'm2.time'],
    ])
    // Slot bonus tidak mengisi sel quest: Kamis tetap mendapat usulan.
    expect(out[0]!.date).toBe('2026-10-22')
  })

  it('menahan skill baru yang prasyaratnya di grade yang sama belum review', () => {
    const states = new Map<string, SkillStateLite>([['m2.place-value', st('new', { recent: [1, 1, 1], nAnswers: 3, lastPracticed: '2026-10-15' })]])
    const out = suggestWeek(input({ list, states })).filter((s) => s.subject === 'math')
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ skillId: 'm2.place-value', kind: 'new', reason: 'Baru 3 soal dikerjakan. Status skill muncul setelah 10 soal.' })
  })

  it('mengusulkan persiapan lomba dan menandai skill ajar ulang yang masuk materi lomba', () => {
    const tagged = sk('m2.money', 40, { competitions: ['kmnr'] })
    const all = list.map((s) => (s.id === 'm2.money' ? tagged : s))
    const states = new Map<string, SkillStateLite>([['m2.money', st('reteach', { recent: [0, 1, 0, 1], nAnswers: 10 })]])
    const competitions = [
      { name: 'KMNR', date: '2026-11-22', competitionId: 'kmnr', subjects: ['math'] },
      { name: 'IKMC', date: '2027-03-31', competitionId: 'ikmc', subjects: ['math'] },
    ]
    const out = suggestWeek(input({ list: all, states, competitions })).filter((s) => s.subject === 'math')
    expect(out[0]).toMatchObject({ skillId: 'm2.money', reason: 'Akurasi 50% di 4 soal terakhir. Masuk materi KMNR, 37 hari lagi.' })
    expect(out.find((s) => s.kind === 'competition')).toMatchObject({ skillId: 'm2.oly-patterns', reason: 'Persiapan KMNR, 37 hari lagi.', mode: 'latihan' })
    // Lomba di luar 45 hari tidak dipakai.
    const far = suggestWeek(input({ list: all, states, competitions: [competitions[1]!] }))
    expect(far.some((s) => s.kind === 'competition')).toBe(false)
  })

  it('menyebut menit hari itu bila usulan membuat hari lewat batas', () => {
    const slots: ExistingSlot[] = [{ date: '2026-10-19', subject: 'english', kind: 'quest', skillId: null, minutes: 70 }]
    const out = suggestWeek(input({ list, slots }))
    const monMath = out.find((s) => s.date === '2026-10-19' && s.subject === 'math')
    expect(monMath?.reason).toBe('Skill berikutnya di urutan Grade 2. Senin sudah 70 menit, lewat batas 60.')
    const tueMath = out.find((s) => s.date === '2026-10-20' && s.subject === 'math')
    expect(tueMath).toBeUndefined()
  })

  it('id usulan lain tidak berubah setelah satu usulan diterapkan', () => {
    const states = new Map<string, SkillStateLite>([
      ['m2.money', st('reteach', { recent: [0, 0, 1], nAnswers: 10 })],
      ['m2.time', st('reteach', { recent: [0, 1, 1], nAnswers: 10 })],
    ])
    const before = suggestWeek(input({ list, states }))
    const second = before.find((s) => s.skillId === 'm2.time')!
    const applied: ExistingSlot[] = [{ date: second.date, subject: second.subject, kind: 'quest', skillId: second.skillId, minutes: 10 }]
    const after = suggestWeek(input({ list, states, slots: applied }))
    expect(after.map((s) => s.id)).toEqual(before.filter((s) => s.id !== second.id).map((s) => s.id))
  })

  it('paling banyak satu usulan per mapel per hari dan kosong bila semua terisi', () => {
    const states = new Map<string, SkillStateLite>(
      ['m2.money', 'm2.time', 'm2.place-value', 'm2.add', 'm2.sub'].map((id) => [id, st('reteach', { recent: [0], nAnswers: 10 })]),
    )
    const out = suggestWeek(input({ list, states }))
    const keys = out.map((s) => `${s.date}:${s.subject}`)
    expect(new Set(keys).size).toBe(keys.length)
    const full: ExistingSlot[] = week.flatMap((date) => (['math', 'english', 'science'] as const).map((subject) => ({ date, subject, kind: 'quest' as const, skillId: null, minutes: 10 })))
    expect(suggestWeek(input({ list, states, slots: full }))).toEqual([])
  })
})

describe('usulan dengan sesi baru', () => {
  const place = sk('m2.place-value', 10)
  const list = [place, sk('m2.money', 40), sk('e2.phonics', 10), sk('s2.plants', 10)]
  const states = new Map<string, SkillStateLite>([['m2.money', st('reteach', { recent: [0, 0, 1], nAnswers: 10 })]])

  it('sesi dasar dari template tidak mengisi sel, jadi usulan tetap muncul', () => {
    const autos: ExistingSlot[] = week.map((date) => ({ date, subject: 'math' as const, kind: 'quest' as const, skillId: null, minutes: 7, session: 'latihan' as const, required: true, auto: true }))
    const out = suggestWeek(input({ list, states, slots: autos })).filter((s) => s.subject === 'math')
    expect(out.length).toBeGreaterThan(0)
  })

  it('Tes atau sesi opsional mapel itu tidak mengisi sel Latihan', () => {
    const slots: ExistingSlot[] = [
      { date: '2026-10-19', subject: 'math', kind: 'quest', skillId: 'm2.sub', minutes: 10, session: 'tes', required: true },
      { date: '2026-10-20', subject: 'math', kind: 'quest', skillId: 'm2.sub', minutes: 7, session: 'latihan', required: false },
    ]
    const out = suggestWeek(input({ list, states, slots })).filter((s) => s.subject === 'math')
    expect(out.map((s) => s.date)).toContain('2026-10-19')
    expect(out.map((s) => s.date)).toContain('2026-10-20')
  })

  it('Latihan wajib yang diatur tutor mengisi sel', () => {
    const slots: ExistingSlot[] = [{ date: '2026-10-19', subject: 'math', kind: 'quest', skillId: 'm2.sub', minutes: 7, session: 'latihan', required: true }]
    const out = suggestWeek(input({ list, states, slots })).filter((s) => s.subject === 'math')
    expect(out.map((s) => s.date)).not.toContain('2026-10-19')
  })
})

describe('normaliseSlot', () => {
  const skill = { id: 'm2.place-value', subject: 'math' as const, title: 'Place value' }
  const base = { subject: 'math' as const, required: true, skillId: null, mode: 'latihan' as const, questionCount: 10, paperKind: null, config: null, skill: null, skillHasLesson: false, presetSubject: null }
  const run = (over: Partial<NormaliseSlotInput>) => normaliseSlot({ session: 'latihan', ...base, ...over })
  const fails = (over: Partial<NormaliseSlotInput>) => {
    try {
      run(over)
    } catch (e) {
      return e as { userMessage: string; fieldErrors?: Record<string, string> }
    }
    return null
  }

  it('Latihan butuh skill dari mapel yang sama dan 4 sampai 30 soal', () => {
    expect(fails({})?.fieldErrors?.skillId).toMatch(/Pilih satu skill/)
    expect(fails({ skillId: 'm2.place-value', skill: { ...skill, subject: 'english' } })?.fieldErrors?.skillId).toMatch(/bukan skill Math/)
    expect(fails({ skillId: 'x', skill: null })?.fieldErrors?.skillId).toMatch(/tidak ada di konten/)
    expect(fails({ skillId: skill.id, skill, questionCount: 3 })?.fieldErrors?.questionCount).toMatch(/4 sampai 30/)
    expect(run({ skillId: skill.id, skill })).toMatchObject({ session: 'latihan', required: true, skillId: skill.id, mode: 'latihan', questionCount: 10 })
  })

  it('Tes boleh tanpa skill (ikut Latihan) dan membatasi detik per soal', () => {
    expect(run({ session: 'tes', questionCount: 8 })).toMatchObject({ session: 'tes', skillId: null, mode: 'tes', questionCount: 8, config: null })
    expect(run({ session: 'tes', questionCount: 8, config: { perQuestionSec: 60 } }).config).toEqual({ perQuestionSec: 60 })
    expect(run({ session: 'tes', questionCount: 8, config: { perQuestionSec: 75 } }).config).toBeNull()
    expect(fails({ session: 'tes', questionCount: 8, config: { perQuestionSec: 10 } })?.fieldErrors?.perQuestionSec).toMatch(/30 sampai 180/)
  })

  it('Paper butuh jenis mini atau penuh', () => {
    expect(fails({ session: 'paper' })?.fieldErrors?.paperKind).toMatch(/mini atau paper penuh/)
    expect(run({ session: 'paper', paperKind: 'full' })).toMatchObject({ paperKind: 'full', required: true, skillId: null })
  })

  it('sesi di luar Latihan, Tes, dan Paper selalu opsional', () => {
    expect(run({ session: 'review', required: true }).required).toBe(false)
    expect(run({ session: 'quick-maths', required: true }).required).toBe(false)
  })

  it('simulasi butuh preset yang cocok mapel, tugas English butuh jenis', () => {
    expect(fails({ session: 'simulation' })?.fieldErrors?.presetId).toBeDefined()
    expect(fails({ session: 'simulation', config: { presetId: 'iklc-2027' }, presetSubject: 'english' })?.fieldErrors?.presetId).toMatch(/untuk English/)
    expect(run({ session: 'simulation', config: { presetId: 'ikmc-pre-ecolier-2027' }, presetSubject: 'math' }).config).toEqual({ presetId: 'ikmc-pre-ecolier-2027' })
    expect(fails({ session: 'english-skill', subject: 'math', config: { task: 'listening' } })?.fieldErrors?.subject).toBeDefined()
    expect(fails({ session: 'english-skill', subject: 'english' })?.fieldErrors?.task).toBeDefined()
    expect(run({ session: 'english-skill', subject: 'english', config: { task: 'speaking' } }).config).toEqual({ task: 'speaking' })
  })

  it('Pelajaran butuh skill yang punya pelajaran, Hitung Cepat hanya Math, ESMO bukan Science', () => {
    expect(fails({ session: 'lesson', skillId: skill.id, skill })?.fieldErrors?.skillId).toMatch(/belum punya pelajaran/)
    expect(run({ session: 'lesson', skillId: skill.id, skill, skillHasLesson: true }).skillId).toBe(skill.id)
    expect(fails({ session: 'quick-maths', subject: 'english' })?.fieldErrors?.subject).toBeDefined()
    expect(fails({ session: 'esmo', subject: 'science' })?.fieldErrors?.subject).toBeDefined()
    expect(fails({ session: 'reading', subject: 'math', skillId: skill.id, skill })?.fieldErrors?.subject).toMatch(/hanya untuk English/)
  })
})
