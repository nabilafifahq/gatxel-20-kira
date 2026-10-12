// __GTX_SEED__
import type { PlanSlotDTO, PlannerDTO, Subject } from '@/lib/dto'
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

let n = 0
function slot(day: number, subject: Subject, skillId: string, title: string, minutes: number, mode: PlanSlotDTO['mode'] = 'latihan', kind: PlanSlotDTO['kind'] = 'quest'): PlanSlotDTO {
  n += 1
  return { id: `slot-${n}`, date: DAYS[day]![0], subject, kind, skillId, title, mode, minutes, questionCount: Math.round(minutes / 1.5) }
}

const slots: PlanSlotDTO[] = [
  slot(0, 'math', 'm2-arrays', 'Arrays', 15, 'belajar'),
  slot(0, 'english', 'e2-past-ed', 'Past tense -ed', 15),
  slot(0, 'science', 's2-habitats', 'Habitat', 15),
  slot(1, 'math', 'm2-skip', 'Skip counting', 15),
  slot(1, 'english', 'e2-plural', 'Plural tak beraturan', 15),
  slot(1, 'science', 's2-food-chains', 'Rantai makanan', 15),
  slot(2, 'math', 'm2-arrays', 'Arrays lanjut', 15),
  slot(2, 'english', 'e2-reading-short', 'Bacaan pendek', 20),
  slot(2, 'science', 's2-living', 'Hidup dan tak hidup', 15),
  slot(3, 'math', 'm2-times-2-5-10', 'Kali 2, 5, 10', 15),
  slot(3, 'english', 'e2-vocab', 'Kosakata dalam kalimat', 15),
  slot(3, 'science', 's2-plants', 'Bagian tumbuhan', 15),
  slot(4, 'math', 'm2-weekly', 'Tes mingguan Math', 15, 'tes'),
  slot(4, 'english', 'e2-weekly', 'Tes mingguan English', 15, 'tes'),
  slot(4, 'science', 's2-weekly', 'Tes mingguan Science', 15, 'tes'),
  slot(5, 'math', 'm2-patterns', 'Paper pola bilangan', 25, 'kertas'),
  slot(5, 'math', 'm2-count-100', 'Count to 100', 10, 'latihan', 'bonus'),
  slot(5, 'english', 'e2-reading-short', 'Bacaan pendek: The lost kite', 20),
  slot(5, 'english', 'e2-vocab', 'Kosakata', 10, 'latihan', 'bonus'),
  slot(5, 'science', 's2-habitats', 'Habitat', 10, 'latihan', 'bonus'),
]

function total(date: string): number {
  return slots.filter((s) => s.date === date).reduce((a, s) => a + s.minutes, 0)
}

export const planner: PlannerDTO = {
  shell,
  learnerId: 'lrn_seed_alya',
  weekStart: '2026-10-19',
  weekLabel: 'Senin 19 sampai Minggu 25 Oktober 2026',
  status: 'draft',
  days: DAYS.map(([date, label], i) => ({ date, label, rest: i === 6, totalMinutes: i === 6 ? 0 : total(date), overLimit: i !== 6 && total(date) > 60 })),
  slots,
  suggestions: [
    {
      id: 'sug-arrays',
      date: '2026-10-21',
      subject: 'math',
      skillId: 'm2-arrays',
      title: 'Tambah latihan Arrays',
      reason: 'Arrays baru 64% benar di 10 soal terakhir. Rabu jadi 65 menit kalau ditambah.',
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
    { id: 'm2-count-100', subject: 'math', grade: 2, title: 'Count to 100', stars: 3 },
    { id: 'm2-arrays', subject: 'math', grade: 2, title: 'Arrays', stars: 1 },
    { id: 'm2-skip', subject: 'math', grade: 2, title: 'Skip counting', stars: 2 },
    { id: 'm2-time', subject: 'math', grade: 2, title: 'Waktu dan jam', stars: 1 },
    { id: 'm2-patterns', subject: 'math', grade: 2, title: 'Pola bilangan', stars: 3 },
    { id: 'm2-times-2-5-10', subject: 'math', grade: 2, title: 'Kali 2, 5, 10', stars: 2 },
    { id: 'm2-halves', subject: 'math', grade: 2, title: 'Setengah dan seperempat', stars: 0 },
    { id: 'm2-money', subject: 'math', grade: 2, title: 'Uang rupiah', stars: 0 },
    { id: 'm2-data', subject: 'math', grade: 2, title: 'Diagram batang', stars: 1 },
    { id: 'm2-weekly', subject: 'math', grade: 2, title: 'Tes mingguan Math', stars: 0 },
    { id: 'm3-place-value', subject: 'math', grade: 3, title: 'Nilai tempat sampai 1.000', stars: 0 },
    { id: 'e2-past-ed', subject: 'english', grade: 2, title: 'Past tense -ed', stars: 3 },
    { id: 'e2-plural', subject: 'english', grade: 2, title: 'Plural tak beraturan', stars: 2 },
    { id: 'e2-vocab', subject: 'english', grade: 2, title: 'Kosakata dalam kalimat', stars: 3 },
    { id: 'e2-reading-short', subject: 'english', grade: 2, title: 'Bacaan pendek', stars: 2 },
    { id: 'e2-weekly', subject: 'english', grade: 2, title: 'Tes mingguan English', stars: 0 },
    { id: 's2-habitats', subject: 'science', grade: 2, title: 'Habitat', stars: 2 },
    { id: 's2-living', subject: 'science', grade: 2, title: 'Hidup dan tak hidup', stars: 2 },
    { id: 's2-food-chains', subject: 'science', grade: 2, title: 'Rantai makanan', stars: 1 },
    { id: 's2-plants', subject: 'science', grade: 2, title: 'Bagian tumbuhan', stars: 1 },
    { id: 's2-weekly', subject: 'science', grade: 2, title: 'Tes mingguan Science', stars: 0 },
  ],
  screenLimitMin: 60,
  prevWeekHref: '/dev/konsol/rencana?minggu=2026-10-12',
  nextWeekHref: '/dev/konsol/rencana?minggu=2026-10-26',
}

export const plannerPublished: PlannerDTO = { ...planner, status: 'published' }

export const plannerEmpty: PlannerDTO = {
  ...planner,
  slots: [],
  suggestions: [],
  days: planner.days.map((d) => ({ ...d, totalMinutes: 0, overLimit: false })),
}
