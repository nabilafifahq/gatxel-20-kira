/**
 * Alamat halaman konsol, orang tua, publik, dan cetak yang dipakai layar.
 * Satu tempat supaya halaman (page.tsx) dan navigasi tetap sama. Pembuat halaman
 * cukup mengubah nilai di sini kalau struktur rute berbeda.
 */
export const CONSOLE_ROUTES = {
  today: '/konsol',
  plan: '/konsol/rencana',
  inbox: '/konsol/hasil',
  ljk: '/konsol/ljk',
  bank: '/konsol/bank-soal',
  paper: '/konsol/paper',
  competitions: '/konsol/lomba',
  reports: '/konsol/laporan',
  settings: '/konsol/pengaturan',
  studio: '/konsol/studio-ai',
  import: '/konsol/impor',
  /** Pustaka paper, Buku Salah, program olimpiade, dan sumber soal. */
  library: '/konsol/pustaka',
  libraryMistakes: '/konsol/pustaka/buku-salah',
  libraryProgram: '/konsol/pustaka/program',
  librarySources: '/konsol/pustaka/sumber',
  learners: '/konsol/learner',
  claude: '/konsol/koneksi-claude',
  learnerDetail: (id: string) => `/konsol/learner/${encodeURIComponent(id)}`,
  signOut: '/keluar',
} as const

export const FAMILY_ROUTES = {
  home: '/keluarga',
  privacy: '/keluarga/privasi',
} as const

export const PUBLIC_ROUTES = {
  login: '/masuk',
  privacyNotice: '/privasi',
  terms: '/ketentuan',
} as const

export const PRINT_ROUTES = {
  paper: (id: string) => `/cetak/paper/${encodeURIComponent(id)}`,
  key: (id: string) => `/cetak/kunci/${encodeURIComponent(id)}`,
  ljk: (attemptId: string) => `/cetak/ljk/${encodeURIComponent(attemptId)}`,
} as const
