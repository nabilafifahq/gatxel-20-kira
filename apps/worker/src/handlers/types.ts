import type postgres from 'postgres'
import type { Db, OrgContext } from '@kira/db'
import type { AiProvider } from '../ai/types'
import type { Env } from '../env'
import type { Logger } from '../log'

/** Baris hasil kira_claim_jobs. attempts sudah termasuk percobaan yang sedang berjalan. */
export type JobRow = {
  id: string
  org_id: string
  kind: string
  payload: unknown
  attempts: number
  created_by: string | null
}

export type HandlerCtx = {
  job: JobRow
  /** Konteks withOrg: org job, userId = created_by job (atau pengguna sistem), role worker. */
  org: OrgContext
  db: Db
  client: postgres.Sql
  env: Env
  ai: AiProvider
  log: Logger
  /** Dibatalkan saat worker berhenti; job lalu diantrekan lagi tanpa memakai jatah percobaan. */
  signal: AbortSignal
  /** Percobaan terakhir: kegagalan berikutnya membuat job gagal permanen. */
  finalAttempt: boolean
  now: () => Date
}

export type FailureInfo = {
  /** retry: dicoba lagi nanti (jatah berkurang). requeue: diantrekan lagi tanpa memakai jatah. fail: gagal permanen. */
  action: 'retry' | 'requeue' | 'fail'
  message: string
  runAfter: Date | null
}

export type Handler = {
  run(h: HandlerCtx): Promise<unknown>
  /** Perbarui baris domain (ai_job, import_batch) saat job gagal atau diantrekan lagi. */
  onFailure?(h: HandlerCtx, info: FailureInfo): Promise<void>
}
