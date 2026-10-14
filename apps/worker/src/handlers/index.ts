import type { JobKind } from '@kira/db'
import { draftHandler } from './drafts'
import { gradeHandler } from './grade'
import { importHandler } from './import'
import { learnerDeleteHandler } from './learner-delete'
import { sourcingRunHandler } from './sourcing'
import { testHandler } from './test'
import { ttsBatchHandler, ttsClipHandler } from './tts'
import type { Handler } from './types'

/** Satu handler untuk setiap JOB_KINDS di packages/db/src/jobs.ts. */
export const HANDLERS: Record<JobKind, Handler> = {
  'ai.items': draftHandler('items'),
  'ai.variants': draftHandler('variants'),
  'ai.hints': draftHandler('hints'),
  'ai.translate': draftHandler('translate'),
  'ai.rubric': draftHandler('rubric'),
  'ai.grade': gradeHandler,
  'ai.import': importHandler,
  'ai.test': testHandler,
  'learner.delete': learnerDeleteHandler,
  'tts.batch': ttsBatchHandler,
  'tts.clip': ttsClipHandler,
  'sourcing.run': sourcingRunHandler,
}
