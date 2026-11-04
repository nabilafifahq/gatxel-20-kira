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
  /** Ruang Baca: perpustakaan dan pembaca buku bab. */
  reading: '/reading',
  /** Fix-it Book (Buku Salah) dan awal sesi ulangnya. */
  fixIt: '/fix-it',
  fixItStart: '/fix-it/start',
  me: '/me',
  /** Kamus Ketuk: kata yang disimpan anak. */
  myWords: '/my-words',
  /** Kira World: bintang, teman, toko, album, cerita, robot, piala. */
  world: '/world',
  quickMaths: '/quick-maths',
  /** Latihan Bebas: anak memilih apa yang mau dilatih. */
  practice: '/practice',
  flashcards: '/practice/cards',
  quizArena: '/quiz-arena',
  esmo: '/esmo',
  competitions: '/competitions',
  pick: '/',
  pin: (learnerId: string) => `/pin/${encodeURIComponent(learnerId)}`,
  /** Halaman masuk dewasa (tutor atau orang tua). */
  grownUp: '/masuk',
  /** Ganti learner: akhiri sesi anak lalu kembali ke pilihan learner. */
  switchLearner: '/bye',
} as const

export type LearnerNavKey = 'today' | 'map' | 'review' | 'competitions' | 'practice' | 'english' | 'reading' | 'world' | 'quick-maths' | 'quiz-arena' | 'me'
