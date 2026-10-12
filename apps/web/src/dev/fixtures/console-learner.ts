// __GTX_SEED__
import type { HeatCell, LearnerDetailDTO } from '@/lib/dto'
import { shell, wib } from './console-shared'

const WEEKS = ['2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12']

function cells(vals: (number | null)[]): HeatCell[] {
  return vals.map((v, i) => ({
    weekStart: WEEKS[i]!,
    accuracy: v,
    answers: v == null ? 0 : 10,
    gate: v == null ? 'new' : v >= 85 ? 'mastered' : v >= 70 ? 'review' : 'reteach',
  }))
}

export const learnerDetail: LearnerDetailDTO = {
  shell,
  learner: { id: 'lrn_seed_alya', name: 'Alya', grade: 2, avatar: 'fox', since: '2026-09-21', xp: 1240, level: 4, streak: 6 },
  weeks: WEEKS.map((w, i) => ({ weekStart: w, label: `M${i + 1}` })),
  heatmap: [
    {
      subject: 'math',
      skills: [
        { id: 'm2-count-100', title: 'Count to 100', stars: 3, cells: cells([80, 86, 90, 92]) },
        { id: 'm2-arrays', title: 'Arrays', stars: 1, cells: cells([null, 78, 70, 64]) },
        { id: 'm2-skip', title: 'Skip counting', stars: 2, cells: cells([null, null, 72, 80]) },
        { id: 'm2-time', title: 'Waktu dan jam', stars: 1, cells: cells([75, 70, 62, 58]) },
        { id: 'm2-patterns', title: 'Pola bilangan', stars: 3, cells: cells([82, 88, 90, 91]) },
      ],
    },
    {
      subject: 'english',
      skills: [
        { id: 'e2-past-ed', title: 'Past tense dengan -ed', stars: 3, cells: cells([70, 78, 84, 88]) },
        { id: 'e2-plural', title: 'Plural tak beraturan', stars: 2, cells: cells([null, 60, 68, 74]) },
        { id: 'e2-vocab', title: 'Kosakata dalam kalimat', stars: 3, cells: cells([80, 82, 85, 86]) },
      ],
    },
    {
      subject: 'science',
      skills: [
        { id: 's2-habitats', title: 'Habitat', stars: 2, cells: cells([null, 66, 72, 76]) },
        { id: 's2-living', title: 'Living things', stars: 2, cells: cells([70, 76, 79, 81]) },
      ],
    },
  ],
  attempts: [
    { id: 'att-7', date: '2026-10-16', title: 'Paper P7 Olimpiade Math', subject: 'math', score: '7 dari 10', minutes: 13, href: '/konsol/hasil?attempt=att-7' },
    { id: 'att-6', date: '2026-10-15', title: 'Quest English: Past tense with -ed', subject: 'english', score: '8 dari 10', minutes: 14, href: '/konsol/hasil?attempt=att-6' },
    { id: 'att-5', date: '2026-10-15', title: 'Quest Math: Arrays and skip counting', subject: 'math', score: '6 dari 10', minutes: 17, href: '/konsol/hasil?attempt=att-5' },
    { id: 'att-4', date: '2026-10-14', title: 'Simulasi ESMO Math, 40 soal', subject: 'math', score: '75 dari 100', minutes: 46, href: '/konsol/hasil?attempt=att-4' },
    { id: 'att-3', date: '2026-10-14', title: 'Quest Science: Living things and their habitats', subject: 'science', score: '7 dari 10', minutes: 15, href: '/konsol/hasil?attempt=att-3' },
    { id: 'att-2', date: '2026-10-12', title: 'Paper W01-M-P01, di kertas', subject: 'math', score: '6 dari 7', minutes: 20, href: '/konsol/hasil?attempt=att-2' },
  ],
  notes: [
    { id: 'n2', author: 'Dina Pratiwi', date: wib('2026-10-16', '16:10'), body: 'Arrays: masih menghitung satu per satu. Besok coba kertas berpetak dan lingkari tiap baris dulu.' },
    { id: 'n1', author: 'Dina Pratiwi', date: wib('2026-10-12', '19:30'), body: 'Hari pertama lancar. Paling semangat di soal bergambar.' },
  ],
}

export const learnerDetailNew: LearnerDetailDTO = {
  ...learnerDetail,
  learner: { ...learnerDetail.learner, id: 'lrn_seed_bima', name: 'Bima', grade: 4, avatar: 'owl', since: '2026-10-16', xp: 0, level: 1, streak: 0 },
  heatmap: [],
  attempts: [],
  notes: [],
}
