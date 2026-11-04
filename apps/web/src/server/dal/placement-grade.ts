import 'server-only'
import { and, desc, eq } from 'drizzle-orm'
import { sessionStartGrade } from '@kira/core/placement'
import { tables } from '@kira/db'
import type { Subject } from '@/lib/dto'
import type { Tx } from '../db'

const { placementRun } = tables

/**
 * Kelas titik awal sesi harian per mapel dari tes penempatan terakhir yang selesai (migrasi 0020).
 * Mapel tanpa hasil memakai kelas yang disebut orang tua, jadi anak lama tidak berubah sama sekali.
 */
export async function placementStartGrade(tx: Tx, learner: { userId: string; grade: number }, subject: Subject): Promise<number> {
  const rows = await tx
    .select({ result: placementRun.result })
    .from(placementRun)
    .where(and(eq(placementRun.learnerId, learner.userId), eq(placementRun.subject, subject), eq(placementRun.status, 'done')))
    .orderBy(desc(placementRun.finishedAt))
    .limit(1)
  const level = (rows[0]?.result as { level?: number } | null)?.level
  return typeof level === 'number' ? sessionStartGrade(level, learner.grade) : learner.grade
}
