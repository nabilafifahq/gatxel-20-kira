/**
 * Alamat layar learner yang tidak ikut di DTO (navigasi utama, pilih learner,
 * masuk dewasa). Satu-satunya tempat alamat ini ditulis: ubah di sini kalau
 * struktur route (learner) berbeda.
 */
export const LEARNER_ROUTES = {
  today: '/today',
  /** L14 Selesai hari ini: ringkasan kerja hari ini. */
  doneToday: '/today/done',
  map: '/map',
  /** English Skills: listening, speaking, writing, dan Spelling Bee. */
  english: '/english',
  review: '/review',
  me: '/me',
  esmo: '/esmo',
  competitions: '/competitions',
  pick: '/',
  pin: (learnerId: string) => `/pin/${encodeURIComponent(learnerId)}`,
  /** Halaman masuk dewasa (tutor atau orang tua). */
  grownUp: '/masuk',
  /** Ganti learner: akhiri sesi anak lalu kembali ke pilihan learner. */
  switchLearner: '/bye',
} as const

export type LearnerNavKey = 'today' | 'map' | 'english' | 'review' | 'me'
