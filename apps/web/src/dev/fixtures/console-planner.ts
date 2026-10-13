// __GTX_SEED__
import type { DayTemplateId, PlanSlotDTO, PlannerDTO, PlannerDay, SessionType, Subject } from '@/lib/dto'
import { shell } from './console-shared'

const DAYS = [
  ['2026-10-19', 'Senin 19 Okt'],
  ['2026-10-20', 'Selasa 20 Okt'],
  ['2026-10-21', 'Rabu 21 Okt'],
  ['2026-10-22', 'Kamis 22 Okt'],
  ['2026-10-23', 'Jumat 23 Okt'],
  ['2026-10-24', 'Sabtu 24 Okt'],
  ['2026-10-25', 'Minggu 25 Okt'],
] as const

const TEMPLATE_LABEL: Record<DayTemplateId, string> = { school: 'Hari sekolah', saturday: 'Sabtu paper penuh', light: 'Hari ringan' }
const TEMPLATES: DayTemplateId[] = ['school', 'school', 'light', 'school', 'school', 'saturday', 'school']
const SUBJECTS: Subject[] = ['math', 'english', 'science']

let n = 0
function session(day: number, subject: Subject, kind: SessionType, o: Partial<PlanSlotDTO> & { title: string; minutes: number }): PlanSlotDTO {
  n += 1
  return {
    id: o.auto ? `auto:${DAYS[day]![0]}:${subject}:${kind}:0` : `slot-${n}`,
    auto: false,
    fromPaper: false,
    date: DAYS[day]![0],
    subject,
    kind: 'quest',
    session: kind,
    required: true,
    paperKind: kind === 'paper' ? 'mini' : null,
    skillId: null,
    mode: kind === 'tes' ? 'tes' : 'latihan',
    questionCount: kind === 'latihan' ? 10 : 8,
    config: null,
    ...o,
  }
}

/** Hari sekolah: tiga sesi wajib per mapel, sebagian sudah diatur tutor dan sisanya dipilih Kira. */
function schoolDay(day: number, skills: [string, string][], fullPaper: Subject | null = null): PlanSlotDTO[] {
  return SUBJECTS.flatMap((subject, i) => {
    const [skillId, title] = skills[i]!
    return [
      session(day, subject, 'latihan', { skillId, title, minutes: 7 }),
      session(day, subject, 'tes', { title: 'Skill sama dengan Latihan', minutes: 10, auto: true }),
      session(day, subject, 'paper', fullPaper === subject ? { paperKind: 'full', title: 'Paper penuh, dipilih Kira', minutes: 75, auto: true } : { title: 'Paper mini, dipilih Kira', minutes: 15, auto: true }),
    ]
  })
}

const slots: PlanSlotDTO[] = [
  ...schoolDay(0, [['m2-arrays', 'Arrays'], ['e2-past-ed', 'Past tense -ed'], ['s2-habitats', 'Habitat']]),
  ...schoolDay(1, [['m2-skip', 'Skip counting'], ['e2-plural', 'Plural tak beraturan'], ['s2-food-chains', 'Rantai makanan']]),
  ...SUBJECTS.map((subject, i) => session(2, subject, 'latihan', { skillId: ['m2-arrays', 'e2-reading-short', 's2-living'][i]!, title: ['Arrays lanjut', 'Bacaan pendek', 'Hidup dan tak hidup'][i]!, minutes: 7 })),
  ...schoolDay(3, [['m2-times-2-5-10', 'Kali 2, 5, 10'], ['e2-vocab', 'Kosakata dalam kalimat'], ['s2-plants', 'Bagian tumbuhan']]),
  ...schoolDay(4, [['m2-patterns', 'Pola bilangan'], ['e2-vocab', 'Kosakata'], ['s2-habitats', 'Habitat']]),
  ...schoolDay(5, [['m2-patterns', 'Pola bilangan'], ['e2-reading-short', 'Bacaan pendek'], ['s2-habitats', 'Habitat']], 'science'),
  session(0, 'math', 'review', { title: 'Ulang kartu', minutes: 5, required: false, questionCount: 0 }),
  session(1, 'math', 'quick-maths', { title: 'Tantangan Hitung Cepat', minutes: 5, required: false, questionCount: 0 }),
  session(3, 'english', 'english-skill', { title: 'Tugas English: listening', minutes: 10, required: false, questionCount: 0, config: { task: 'listening' } }),
  session(5, 'math', 'simulation', { title: 'IKMC Pre-Ecolier', minutes: 75, required: false, questionCount: 0, config: { presetId: 'ikmc-pre-ecolier-2027' } }),
]

function day(i: number, limit: number): PlannerDay {
  const [date, label] = DAYS[i]!
  const rest = i === 6
  const mine = rest ? [] : slots.filter((s) => s.date === date)
  const total = mine.reduce((a, s) => a + s.minutes, 0)
  const template = TEMPLATES[i]!
  return {
    date,
    label,
    rest,
    totalMinutes: total,
    requiredMinutes: mine.filter((s) => s.required).reduce((a, s) => a + s.minutes, 0),
    overLimit: !rest && total > limit,
    template,
    templateLabel: TEMPLATE_LABEL[template],
    requiredCount: mine.filter((s) => s.required).length,
    extraCount: mine.filter((s) => !s.required).length,
  }
}

export const planner: PlannerDTO = {
  shell,
  learnerId: 'lrn_seed_alya',
  weekStart: '2026-10-19',
  weekLabel: 'Senin 19 sampai Minggu 25 Oktober 2026',
  status: 'draft',
  days: DAYS.map((_, i) => day(i, 120)),
  slots: slots.filter((s) => s.date !== DAYS[6]![0]),
  suggestions: [
    {
      id: 'sug-arrays',
      date: '2026-10-21',
      subject: 'math',
      skillId: 'm2-arrays',
      title: 'Tambah latihan Arrays',
      reason: 'Arrays baru 64% benar di 10 soal terakhir.',
    },
    {
      id: 'sug-time',
      date: '2026-10-19',
      subject: 'math',
      skillId: 'm2-time',
      title: 'Latihan membaca jam',
      reason: 'Waktu dan jam baru 3 dari 6 benar di simulasi ESMO terakhir.',
    },
    {
      id: 'sug-plural',
      date: '2026-10-22',
      subject: 'english',
      skillId: 'e2-plural',
      title: 'Satu sesi plural tak beraturan',
      reason: '74% minggu ini, naik dari 68%. Satu sesi lagi sebelum masuk review berjarak.',
    },
  ],
  skills: [
    { id: 'm2-count-100', subject: 'math', grade: 2, title: 'Count to 100', stars: 3, hasLesson: true },
    { id: 'm2-arrays', subject: 'math', grade: 2, title: 'Arrays', stars: 1, hasLesson: true },
    { id: 'm2-skip', subject: 'math', grade: 2, title: 'Skip counting', stars: 2, hasLesson: false },
    { id: 'm2-time', subject: 'math', grade: 2, title: 'Waktu dan jam', stars: 1, hasLesson: true },
    { id: 'm2-patterns', subject: 'math', grade: 2, title: 'Pola bilangan', stars: 3, hasLesson: false },
    { id: 'm2-times-2-5-10', subject: 'math', grade: 2, title: 'Kali 2, 5, 10', stars: 2, hasLesson: false },
    { id: 'm2-halves', subject: 'math', grade: 2, title: 'Setengah dan seperempat', stars: 0, hasLesson: false },
    { id: 'm2-money', subject: 'math', grade: 2, title: 'Uang rupiah', stars: 0, hasLesson: false },
    { id: 'm2-data', subject: 'math', grade: 2, title: 'Diagram batang', stars: 1, hasLesson: false },
    { id: 'm3-place-value', subject: 'math', grade: 3, title: 'Nilai tempat sampai 1.000', stars: 0, hasLesson: false },
    { id: 'e2-past-ed', subject: 'english', grade: 2, title: 'Past tense -ed', stars: 3, hasLesson: true },
    { id: 'e2-plural', subject: 'english', grade: 2, title: 'Plural tak beraturan', stars: 2, hasLesson: false },
    { id: 'e2-vocab', subject: 'english', grade: 2, title: 'Kosakata dalam kalimat', stars: 3, hasLesson: false },
    { id: 'e2-reading-short', subject: 'english', grade: 2, title: 'Bacaan pendek', stars: 2, hasLesson: false },
    { id: 's2-habitats', subject: 'science', grade: 2, title: 'Habitat', stars: 2, hasLesson: true },
    { id: 's2-living', subject: 'science', grade: 2, title: 'Hidup dan tak hidup', stars: 2, hasLesson: false },
    { id: 's2-food-chains', subject: 'science', grade: 2, title: 'Rantai makanan', stars: 1, hasLesson: false },
    { id: 's2-plants', subject: 'science', grade: 2, title: 'Bagian tumbuhan', stars: 1, hasLesson: false },
  ],
  presets: [
    { id: 'ikmc-pre-ecolier-2027', subject: 'math', title: 'IKMC Pre-Ecolier', minutes: 75 },
    { id: 'kmnr-2026', subject: 'math', title: 'KMNR practice', minutes: 60 },
    { id: 'esmo-english-2026', subject: 'english', title: 'ESMO English Level 1', minutes: 40 },
    { id: 'iksc-2027', subject: 'science', title: 'IKSC Level 1 practice', minutes: 75 },
  ],
  screenLimitMin: 120,
  prevWeekHref: '/dev/konsol/rencana?minggu=2026-10-12',
  nextWeekHref: '/dev/konsol/rencana?minggu=2026-10-26',
}

export const plannerPublished: PlannerDTO = { ...planner, status: 'published' }

/** Belum ada slot dari tutor: semua sesi wajib otomatis dari template, tanpa sesi opsional. */
export const plannerEmpty: PlannerDTO = {
  ...planner,
  slots: planner.slots
    .filter((s) => s.required)
    .map((s) => (s.auto ? s : { ...s, auto: true, skillId: null, title: s.session === 'paper' ? 'Paper mini, dipilih Kira' : 'Skill dipilih Kira', id: `auto:${s.date}:${s.subject}:${s.session}:0` })),
  suggestions: [],
}
