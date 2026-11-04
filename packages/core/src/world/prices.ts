/**
 * Semua harga Toko Bintang dan camilan teman ada di sini, supaya ekonomi bisa disetel di satu tempat.
 * Perhitungannya ada di docs/riset-cerita-bergambar.md (bagian Ekonomi bintang) dan dijaga oleh economy.test.ts.
 *
 * Tiga kelas harga:
 * - hari pertama (paling 9): anak yang hanya menyelesaikan 3 sesi wajib sudah bisa membeli sesuatu;
 * - minggu pertama (15 sampai 45): tujuan beberapa hari;
 * - tujuan panjang (60 ke atas): tujuan berminggu-minggu.
 */
export const PRICE = {
  // Hadiah set album tidak dijual. Angka ini hanya pengisi supaya barangnya punya bentuk yang sama.
  reward: 20,
  // Camilan: pengeluaran kecil harian untuk teman.
  apple: 2,
  ball: 2,
  strawberry: 3,
  kite: 3,
  balloon: 3,
  cake: 4,
  'ice-cream': 5,
  // Hari pertama
  sky: 8,
  meadow: 8,
  'pet-bow': 9,
  // Minggu pertama
  'party-hat': 15,
  bandana: 15,
  sunset: 20,
  'pet-glasses': 25,
  night: 20,
  'flower-crown': 35,
  candy: 40,
  ocean: 45,
  // Tujuan panjang
  'pet-crown': 60,
  'frame-star': 70,
  'home-pond': 80,
  'frame-moon': 100,
  'frame-crown': 150,
  // Rumah yang juga hadiah set; harganya tidak terpakai selama set itu ada.
  'home-treehouse': 30,
  'home-cave': 35,
  'home-castle': 45,
} as const satisfies Record<string, number>

/** Hari yang biasa: 3 sesi Latihan wajib (preset Seimbang), 1 sempurna, 1 bab Reading, 1 Drill. */
export const TYPICAL_DAY_STARS = 3 * 3 + 2 + 2 + 2
/** Hari yang tenang: hanya 3 sesi wajib tanpa sempurna. */
export const QUIET_DAY_STARS = 3 * 3
