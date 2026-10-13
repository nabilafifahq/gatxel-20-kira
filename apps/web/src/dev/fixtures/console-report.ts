// __GTX_SEED__
import type { ReportDTO } from '@/lib/dto'
import { shell, wib } from './console-shared'
import { weekSummary } from './family'

const MARKDOWN = [
  '# Ringkasan minggu learner_1',
  '12 sampai 18 Oktober 2026. Grade 2, Cambridge Primary Stage 2.',
  '',
  '## Waktu dan quest',
  '- Belajar 245 menit dalam 6 hari, rata-rata 41 menit',
  '- Sesi wajib selesai 49 dari 54, streak 13 hari',
  '',
  '## Akurasi mingguan',
  '| Mapel | M1 | M2 | M3 | M4 |',
  '|---|---|---|---|---|',
  '| Math | 78% | 74% | 71% | 68% |',
  '| English | 82% | 85% | 84% | 88% |',
  '| Science | 70% | 76% | 79% | 81% |',
  '',
  '## Perlu diulang',
  '- Arrays: 64% di 10 soal terakhir, 3 soal dengan hint',
  '- Waktu dan jam: 3 dari 6 benar di simulasi ESMO',
  '',
  '## Naik',
  '- Past tense dengan -ed: 2 ke 3 bintang',
  '- Habitat: 1 ke 2 bintang',
  '',
  '## Lomba',
  '- KMNR: pendaftaran tutup 21 Oktober, belum terdaftar',
  '- ESMO 4 final: tanggal belum diumumkan',
  '',
  '## Batas',
  '- Waktu layar paling lama 60 menit sehari, Minggu hari istirahat',
].join('\n')

export const JSON_EXPORT = JSON.stringify(
  {
    learner: 'learner_1',
    week: '2026-W42',
    range: ['2026-10-12', '2026-10-18'],
    minutes: 245,
    activeDays: 6,
    questsDone: 17,
    questsPlanned: 18,
    streakDays: 13,
    accuracy: { math: [78, 74, 71, 68], english: [82, 85, 84, 88], science: [70, 76, 79, 81] },
    needsReview: [
      { skill: 'm2-arrays', last10: 0.64, hints: 3 },
      { skill: 'm2-time', esmoSim: '3/6' },
    ],
    improved: [
      { skill: 'e2-past-ed', stars: [2, 3] },
      { skill: 's2-habitats', stars: [1, 2] },
    ],
    limits: { dailyMinutes: 60, restDays: ['sun'] },
  },
  null,
  2,
)

export const report: ReportDTO = {
  shell,
  learnerId: 'lrn_seed_alya',
  weekStart: '2026-10-12',
  weekLabel: 'Senin 12 sampai Minggu 18 Oktober 2026',
  markdown: MARKDOWN,
  summary: weekSummary,
  outbox: [
    { id: 'mail-3', to: 'ratna@keluarga-wiratama.test', subject: 'Minggu ini, Alya belajar 3 jam 40 menit', status: 'sent', createdAt: wib('2026-10-12', '07:00') },
    { id: 'mail-2', to: 'ratna@keluarga-wiratama.test', subject: 'Minggu ini, Alya belajar 3 jam 12 menit', status: 'sent', createdAt: wib('2026-10-05', '07:00') },
    { id: 'mail-1', to: 'ratna@keluarga-wiratama.test', subject: 'Minggu pertama Alya di Kira', status: 'failed', createdAt: wib('2026-09-28', '07:00') },
  ],
}

export const reportNoSmtp: ReportDTO = {
  ...report,
  outbox: [{ id: 'mail-q', to: 'ratna@keluarga-wiratama.test', subject: 'Minggu ini, Alya belajar 4 jam 5 menit', status: 'no-smtp', createdAt: wib('2026-10-16', '20:10') }],
}
