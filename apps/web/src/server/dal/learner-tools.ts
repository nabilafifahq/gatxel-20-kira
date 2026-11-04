import 'server-only'
import type { ToolsDTO } from '@/lib/dto'
import type { Tx } from '../db'
import { notFound } from '../errors'
import { isFeatureOnTx } from './learner-features'
import { learnerShell, loadLearner } from './learner-core'

/** Halaman Alat peraga Math. Hanya untuk learner yang fiturnya menyala. */
export async function toolsDTO(tx: Tx, learnerId: string): Promise<ToolsDTO> {
  if (!(await isFeatureOnTx(tx, learnerId, 'manipulatives'))) throw notFound('Halaman ini tidak tersedia.')
  const learner = await loadLearner(tx, learnerId)
  return { shell: await learnerShell(tx, learner) }
}
