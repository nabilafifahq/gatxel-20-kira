/**
 * Dijalankan Next sekali saat proses web mulai, sebelum menerima permintaan. Konten soal (puluhan ribu berkas)
 * dimuat di sini, jadi tidak ada permintaan pertama yang menunggu pemuatan, dan /api/health baru lulus setelah selesai.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NODE_ENV !== 'production') return
  const { warmUp } = await import('./server/warm')
  warmUp()
}
