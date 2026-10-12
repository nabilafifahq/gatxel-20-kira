import 'server-only'
import type { LabelPerm } from '@kira/content'
import { hmac } from './auth/crypto'

/*
 * Label rahasia untuk runner mode Tes, Simulasi, dan Kertas (lihat packages/content/src/labels.ts).
 * Keduanya dihitung dari KIRA_SECRET, jadi stabil setiap kali halaman dimuat ulang tetapi tidak bisa
 * dihitung di perangkat learner.
 */

/** Seed urutan tampil opsi dan kartu. Seed mode latihan (id attempt) bisa dihitung ulang di browser. */
export function runnerSeed(attemptId: string): string {
  return hmac(attemptId, 'runner-seed')
}

/** Permutasi label untuk satu soal di satu attempt: indeks asli diurutkan menurut HMAC masing-masing. */
export function labelPerm(attemptId: string, ref: string, n: number): LabelPerm | null {
  if (n < 2) return null
  const keyed = Array.from({ length: n }, (_, i) => ({ i, k: hmac(`${attemptId}:${ref}:${i}`, 'runner-label') }))
  keyed.sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : a.i - b.i))
  const perm = new Array<number>(n)
  keyed.forEach((x, label) => {
    perm[x.i] = label
  })
  return perm
}
