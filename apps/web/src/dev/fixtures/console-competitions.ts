// __GTX_SEED__
import type { CompetitionCalendarDTO } from '@/lib/dto'
import { LEARNER_A, LEARNER_B, shell } from './console-shared'

const rows: CompetitionCalendarDTO['rows'] = [
  {
    id: 'ev-kmnr',
    name: 'KMNR 2026',
    subjectLine: 'Math, soal berbahasa Indonesia',
    date: '2026-11-22',
    dateLabel: 'November sampai Desember 2026',
    dateIsEstimate: true,
    registrationClose: '2026-10-21',
    status: 'not-registered',
    presetLabel: '',
    presetVerified: null,
    link: 'https://kmnr-penyelenggara.test/daftar',
    learnerIds: [LEARNER_A.id],
  },
  {
    id: 'ev-esmo',
    name: 'ESMO 4, final',
    subjectLine: 'Math dan English',
    date: null,
    dateLabel: 'November 2026, tanggal belum diumumkan',
    dateIsEstimate: true,
    registrationClose: null,
    status: 'check',
    presetLabel: 'ESMO Math, 40 soal, 50 menit',
    presetVerified: true,
    link: null,
    learnerIds: [LEARNER_A.id],
  },
  {
    id: 'ev-ikmc',
    name: 'IKMC Pre-Ecolier',
    subjectLine: 'Math, soal berbahasa Inggris',
    date: '2027-04-17',
    dateLabel: '17 April 2027',
    dateIsEstimate: false,
    registrationClose: '2027-02-28',
    status: 'not-open',
    presetLabel: 'IKMC Pre-Ecolier, 24 soal, 75 menit',
    presetVerified: true,
    link: 'https://ikmc-indonesia.test',
    learnerIds: [LEARNER_A.id, LEARNER_B.id],
  },
  {
    id: 'ev-sasmo',
    name: 'SASMO 2027',
    subjectLine: 'Math, soal berbahasa Inggris',
    date: '2027-03-20',
    dateLabel: 'Maret 2027',
    dateIsEstimate: true,
    registrationClose: '2027-01-15',
    status: 'not-open',
    presetLabel: 'SASMO Grade 4, 25 soal, 90 menit',
    presetVerified: false,
    link: null,
    learnerIds: [LEARNER_B.id],
  },
  {
    id: 'ev-ksnr',
    name: 'KSNR 2026',
    subjectLine: 'Science, soal berbahasa Indonesia',
    date: '2026-10-10',
    dateLabel: '10 Oktober 2026',
    dateIsEstimate: false,
    registrationClose: '2026-09-25',
    status: 'done',
    presetLabel: '',
    presetVerified: null,
    link: null,
    learnerIds: [LEARNER_A.id],
  },
]

const MONTHS = [
  ['2026-10', 'Oktober 2026'],
  ['2026-11', 'November 2026'],
  ['2026-12', 'Desember 2026'],
  ['2027-01', 'Januari 2027'],
  ['2027-02', 'Februari 2027'],
  ['2027-03', 'Maret 2027'],
  ['2027-04', 'April 2027'],
  ['2027-05', 'Mei 2027'],
  ['2027-06', 'Juni 2027'],
] as const

export const competitions: CompetitionCalendarDTO = {
  shell,
  todayLabel: 'Hari ini Jumat, 16 Oktober 2026',
  months: MONTHS.map(([key, name]) => ({
    key,
    name,
    rows:
      key === '2026-10'
        ? [{ id: 'ev-ksnr', name: 'KSNR 2026', when: '10 Oktober, selesai' }]
        : key === '2026-11'
          ? [
              { id: 'ev-kmnr', name: 'KMNR 2026', when: 'akhir November' },
              { id: 'ev-esmo', name: 'ESMO 4, final', when: 'tanggal belum ada' },
            ]
          : key === '2027-03'
            ? [{ id: 'ev-sasmo', name: 'SASMO 2027', when: 'Maret' }]
            : key === '2027-04'
              ? [{ id: 'ev-ikmc', name: 'IKMC Pre-Ecolier', when: '17 April' }]
              : [],
  })),
  rows,
  catalog: [
    { id: 'esmo', name: 'ESMO', organizer: 'Penyelenggara ESMO', format: 'Math 40 soal 50 menit, English 40 soal 40 menit, 4 pilihan, skala 100', verified: true, website: null },
    { id: 'ikmc', name: 'IKMC Pre-Ecolier', organizer: 'Kangaroo Math Indonesia', format: '24 soal pilihan ganda 5 opsi, 75 menit, nilai minus untuk jawaban salah', verified: true, website: 'https://ikmc-indonesia.test' },
    { id: 'sasmo', name: 'SASMO', organizer: 'Singapore and Asian Schools Math Olympiad', format: '25 soal, sebagian isian, 90 menit', verified: false, website: null },
    { id: 'kmnr', name: 'KMNR', organizer: 'Klinik Pendidikan MIPA', format: 'Babak penyisihan 30 soal, babak final isian', verified: false, website: 'https://kmnr-penyelenggara.test' },
  ],
  presets: [
    { id: 'esmo-math-2026', title: 'ESMO Math, 40 soal, 50 menit', verified: true },
    { id: 'ikmc-pre-ecolier', title: 'IKMC Pre-Ecolier, 24 soal, 75 menit', verified: true },
    { id: 'sasmo-g4', title: 'SASMO Grade 4, 25 soal, 90 menit', verified: false },
  ],
}

export const competitionsEmpty: CompetitionCalendarDTO = { ...competitions, months: [], rows: [] }
