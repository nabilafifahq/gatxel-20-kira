/**
 * Jalankan fn lalu tunggu sampai paling sedikit `minMs` (ditambah sedikit acak). Dipakai jawaban publik yang tidak boleh
 * membocorkan apakah sebuah email sudah terdaftar: cabang "sudah ada" dan "baru" jadi sama lamanya.
 */
export async function evenTime<T>(minMs: number, fn: () => Promise<T>, jitterMs = 100): Promise<T> {
  const started = Date.now()
  try {
    return await fn()
  } finally {
    const left = minMs - (Date.now() - started)
    await new Promise((r) => setTimeout(r, Math.max(0, left) + Math.random() * jitterMs))
  }
}
