import 'server-only'
import type { ActionResult } from '@/lib/dto'
import { runAction } from '../errors'

/** runAction untuk aksi anak: pesan umum mengikuti bahasa tampilan anak (lihat runAction di errors.ts). */
export function runLearnerAction<T>(context: string, fn: () => Promise<T>): Promise<ActionResult<T>> {
  return runAction(context, fn, 'en-GB')
}
