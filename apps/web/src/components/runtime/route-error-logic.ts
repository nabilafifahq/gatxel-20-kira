/**
 * Logika penjaga galat rute. Deployment baru saat tab masih terbuka membuat chunk lama 404: pesannya berbeda antar
 * browser dan WebView, jadi dikenali dari nama dan isi pesan. Satu kali muat ulang otomatis cukup untuk mengambil
 * versi baru; penjaga waktu mencegah putaran muat ulang bila chunk memang tetap gagal (misalnya jaringan putus).
 */
const CHUNK_ERROR = /ChunkLoadError|Loading (CSS )?chunk|Failed to load chunk|dynamically imported module|Importing a module script failed|error loading dynamically/i

export const CHUNK_RELOAD_KEY = 'kira-chunk-reload-at'
const RELOAD_GAP_MS = 60_000

export function isChunkError(error: { name?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  return CHUNK_ERROR.test(`${error.name ?? ''} ${error.message ?? ''}`)
}

/** Boleh muat ulang otomatis bila belum pernah, atau yang terakhir sudah lewat semenit. */
export function mayAutoReload(lastAt: number | null, now: number): boolean {
  return lastAt === null || now - lastAt > RELOAD_GAP_MS
}
