import 'server-only'
import type { Tx } from '../db'

/**
 * Seam untuk penjaga soal ganda pusat (session-guard.ts, guardSet, dari pilot/cambridge). Selama berkas itu
 * belum ada di cabang ini, pembuat sesi pusat sudah memprioritaskan soal yang belum pernah dilihat (recentSeen).
 * Saat digabung, integrator mengganti isi fungsi ini dengan panggilan guardSet; semua sesi Latihan Bebas dan
 * Ulasan singkat sudah melewatinya.
 */
export async function guardPracticeRefs(_tx: Tx, _learnerId: string, refs: string[]): Promise<string[]> {
  return refs
}
