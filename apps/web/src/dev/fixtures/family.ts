// __GTX_SEED__
import type { FamilyHomeDTO, PrivacyDTO, WeekSummaryDTO } from '@/lib/dto'
import { guardianShell, LEARNER_A, LEARNER_B, wib } from './console-shared'

export const weekSummary: WeekSummaryDTO = {
  learnerName: 'Alya',
  weekLabel: 'Senin 12 sampai Minggu 18 Oktober 2026',
  firstWeek: false,
  minutes: 245,
  minutesPerDay: [
    { label: 'Sen', minutes: 45 },
    { label: 'Sel', minutes: 38 },
    { label: 'Rab', minutes: 52 },
    { label: 'Kam', minutes: 41 },
    { label: 'Jum', minutes: 33 },
    { label: 'Sab', minutes: 36 },
    { label: 'Min', minutes: 0 },
  ],
  questsDone: 17,
  questsPlanned: 18,
  skillsUp: [
    { subject: 'english', title: 'Past tense dengan -ed', stars: 3 },
    { subject: 'science', title: 'Habitat', stars: 2 },
    { subject: 'math', title: 'Count to 100', stars: 3 },
  ],
  skillsToRepeat: [
    { subject: 'math', title: 'Arrays', note: '64% benar di 10 soal terakhir' },
    { subject: 'math', title: 'Waktu dan jam', note: '3 dari 6 benar di simulasi ESMO' },
  ],
  tutorNote: 'Alya cepat di pola bilangan dan suka soal bergambar. Minggu depan ada tambahan 2 soal Arrays di Rabu dan latihan jam di Senin.',
  nextCompetition: { name: 'KMNR 2026 babak penyisihan', date: '2026-11-22' },
}

export const weekSummaryFirst: WeekSummaryDTO = {
  ...weekSummary,
  weekLabel: 'Senin 12 sampai Minggu 18 Oktober 2026',
  firstWeek: true,
  minutes: 47,
  minutesPerDay: [
    { label: 'Sen', minutes: 47 },
    { label: 'Sel', minutes: 0 },
    { label: 'Rab', minutes: 0 },
    { label: 'Kam', minutes: 0 },
    { label: 'Jum', minutes: 0 },
    { label: 'Sab', minutes: 0 },
    { label: 'Min', minutes: 0 },
  ],
  questsDone: 3,
  questsPlanned: 3,
  skillsUp: [],
  skillsToRepeat: [],
  tutorNote: 'Hari pertama lancar. Alya paling semangat di soal bergambar.',
}

export const familyHome: FamilyHomeDTO = {
  shell: guardianShell,
  learners: [
    { id: LEARNER_A.id, name: LEARNER_A.name },
    { id: LEARNER_B.id, name: LEARNER_B.name },
  ],
  selectedLearnerId: LEARNER_A.id,
  summary: weekSummary,
  prevWeekHref: '/dev/konsol/ringkasan?minggu=2026-10-05',
  nextWeekHref: null,
}

export const familyHomeFirst: FamilyHomeDTO = { ...familyHome, summary: weekSummaryFirst, prevWeekHref: null }

export const privacy: PrivacyDTO = {
  shell: guardianShell,
  learner: { id: LEARNER_A.id, name: 'Alya', active: true },
  noticeVersion: '1.0, 12 Oktober 2026',
  purposes: [
    {
      id: 'learning',
      title: 'Belajar di Kira',
      description: 'Menyimpan jawaban, waktu belajar, dan kemajuan skill supaya quest bisa disesuaikan. Wajib untuk memakai Kira.',
      required: true,
      granted: true,
      grantedAt: wib('2026-09-21', '19:12'),
    },
    {
      id: 'progress-email',
      title: 'Laporan mingguan lewat email',
      description: 'Ringkasan setiap Senin ke email orang tua. Tanpa email, laporan tetap ada di halaman ini.',
      required: false,
      granted: true,
      grantedAt: wib('2026-09-21', '19:12'),
    },
    {
      id: 'audio',
      title: 'Rekaman suara untuk soal berbicara',
      description: 'Rekaman disimpan di server rumah, dinilai tutor, dan terhapus otomatis 30 hari setelah direkam. Tidak dikirim ke AI.',
      required: false,
      granted: false,
      grantedAt: null,
    },
    {
      id: 'photo',
      title: 'Foto jawaban kertas',
      description: 'Foto lembar jawaban yang diunggah tutor. Disimpan 90 hari, lalu terhapus otomatis.',
      required: false,
      granted: true,
      grantedAt: wib('2026-10-02', '20:05'),
    },
    {
      id: 'ai-drafts',
      title: 'Saran nilai dari AI untuk tulisan',
      description: 'Teks atau foto tulisan dikirim tanpa nama dan tanpa data EXIF ke Claude untuk saran nilai. Tutor tetap memutuskan nilainya.',
      required: false,
      granted: false,
      grantedAt: null,
    },
  ],
  history: [
    { date: wib('2026-10-02', '20:05'), text: 'Foto jawaban kertas disetujui di HP orang tua.' },
    { date: wib('2026-09-21', '19:12'), text: 'Belajar di Kira dan laporan email disetujui di HP orang tua, Kebijakan Privasi versi 1.0.' },
  ],
  retention: [
    { label: 'Jawaban dan kemajuan belajar', value: 'Selama akun aktif, dihapus 30 hari setelah akun dihapus' },
    { label: 'Rekaman suara', value: '30 hari setelah direkam' },
    { label: 'Foto jawaban kertas', value: '90 hari setelah diunggah' },
    { label: 'Log masuk dan keamanan', value: '12 bulan' },
    { label: 'Cadangan harian', value: '35 hari' },
  ],
  deletion: { requestedAt: null, scheduledFor: null },
}

export const privacyWithdrawn: PrivacyDTO = {
  ...privacy,
  learner: { ...privacy.learner, active: false },
  purposes: privacy.purposes.map((p) => (p.id === 'learning' ? { ...p, granted: false, grantedAt: null } : p)),
  history: [{ date: wib('2026-10-16', '21:40'), text: 'Persetujuan Belajar di Kira ditarik di HP orang tua. Akun Alya dijeda.' }, ...privacy.history],
}

export const privacyDeleting: PrivacyDTO = {
  ...privacy,
  deletion: { requestedAt: wib('2026-10-16', '21:45'), scheduledFor: '2026-11-15' },
}

export { LEARNER_B }
