// __GTX_SEED__
import type { TutorTodayDTO } from '@/lib/dto'
import { LEARNER_A, shell, wib, TODAY } from './console-shared'

const trend: TutorTodayDTO['trend'] = [
  {
    subject: 'math',
    points: [
      { weekStart: '2026-09-21', label: 'M1', accuracy: 78, answers: 52 },
      { weekStart: '2026-09-28', label: 'M2', accuracy: 74, answers: 61 },
      { weekStart: '2026-10-05', label: 'M3', accuracy: 71, answers: 58 },
      { weekStart: '2026-10-12', label: 'M4', accuracy: 68, answers: 40 },
    ],
  },
  {
    subject: 'english',
    points: [
      { weekStart: '2026-09-21', label: 'M1', accuracy: 82, answers: 48 },
      { weekStart: '2026-09-28', label: 'M2', accuracy: 85, answers: 50 },
      { weekStart: '2026-10-05', label: 'M3', accuracy: 84, answers: 47 },
      { weekStart: '2026-10-12', label: 'M4', accuracy: 88, answers: 33 },
    ],
  },
  {
    subject: 'science',
    points: [
      { weekStart: '2026-09-21', label: 'M1', accuracy: 70, answers: 30 },
      { weekStart: '2026-09-28', label: 'M2', accuracy: 76, answers: 34 },
      { weekStart: '2026-10-05', label: 'M3', accuracy: 79, answers: 31 },
      { weekStart: '2026-10-12', label: 'M4', accuracy: 81, answers: 22 },
    ],
  },
]

export const tutorToday: TutorTodayDTO = {
  shell,
  dateLabel: 'Jumat, 16 Oktober 2026',
  learner: LEARNER_A,
  attention: [
    {
      id: 'att-skill',
      kind: 'skill-low',
      title: 'Arrays baru 64% benar di 10 soal terakhir',
      detail: 'Math, di bawah batas 70%. Usulan: tambah 2 soal Arrays di Rabu.',
      actionLabel: 'Jadwalkan ulang',
      href: '/konsol/rencana',
    },
    {
      id: 'att-grade',
      kind: 'needs-grading',
      title: '2 jawaban English menunggu nilai',
      detail: 'Soal uraian dari quest Kamis, sekitar 3 menit untuk menilai.',
      actionLabel: 'Nilai sekarang',
      href: '/konsol/hasil',
    },
    {
      id: 'att-reg',
      kind: 'registration',
      title: 'Pendaftaran KMNR tutup 5 hari lagi',
      detail: 'Alya belum terdaftar.',
      actionLabel: 'Buka pendaftaran',
      href: '/konsol/lomba',
    },
    {
      id: 'att-ai',
      kind: 'ai-draft',
      title: '6 draf soal dari Studio AI menunggu ditinjau',
      detail: 'Variasi soal Waktu dan jam untuk Grade 2. Draf tidak dipakai sebelum disetujui.',
      actionLabel: 'Tinjau draf',
      href: '/konsol/studio-ai',
    },
  ],
  today: [
    { subject: 'math', questTitle: 'Arrays and equal groups', state: 'in-progress', answered: 4, total: 10, accuracy: 75, minutes: 9, syncedAt: wib(TODAY, '15:42') },
    { subject: 'english', questTitle: 'Past tense: -ed verbs', state: 'done', answered: 10, total: 10, accuracy: 90, minutes: 11, syncedAt: wib(TODAY, '15:20') },
    { subject: 'science', questTitle: 'Frog life cycle', state: 'not-started', answered: 0, total: 8, accuracy: null, minutes: 0, syncedAt: null },
  ],
  trend,
  partial: [],
  upcoming: [
    { name: 'KMNR 2026 babak penyisihan', date: '2026-11-22', daysToGo: 37, registrationClose: '2026-10-21' },
    { name: 'ESMO 4 final', date: '2026-12-06', daysToGo: 51, registrationClose: null },
  ],
}

export const tutorTodayAllClear: TutorTodayDTO = { ...tutorToday, attention: [] }

export const tutorTodayPartial: TutorTodayDTO = {
  ...tutorToday,
  partial: ['Tablet Alya belum mengirim data Science sejak pukul 14.20. Angka Science di halaman ini belum lengkap.'],
  today: tutorToday.today.map((s) =>
    s.subject === 'science' ? { ...s, state: 'in-progress', answered: 3, accuracy: null, minutes: 6, syncedAt: wib(TODAY, '14:20') } : s,
  ),
  trend: trend.map((t) =>
    t.subject === 'science' ? { ...t, points: t.points.map((p, i) => (i === 3 ? { ...p, accuracy: null, answers: 0 } : p)) } : t,
  ),
}

export const tutorTodayEmpty: TutorTodayDTO = {
  ...tutorToday,
  shell: { ...shell, learners: [], currentLearnerId: null },
  learner: null,
  attention: [],
  today: [],
  trend: [],
  upcoming: [],
}
