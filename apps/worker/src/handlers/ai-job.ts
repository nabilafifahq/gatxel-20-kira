import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { SKILL_ID, SUBJECTS } from '@kira/content/schema'
import { tables, withOrg, type AiJobInput, type Tx } from '@kira/db'
import { JobError } from '../errors'
import type { FailureInfo, Handler, HandlerCtx } from './types'

/**
 * Bagian bersama semua job AI: membaca `ai_job` dari payload.aiJobId, memvalidasi `ai_job.input`
 * (kontrak di packages/db/src/jobs.ts), menandai running, dan menulis status akhir.
 */

const skillBrief = z.object({
  id: z.string().regex(SKILL_ID),
  subject: z.enum(SUBJECTS),
  grade: z.number().int().min(1).max(6),
  title: z.string().max(200),
  canDo: z.string().max(400),
  strand: z.string().max(20),
})
const instructions = z.string().max(4000)
const itemRef = z.string().min(1).max(200)
const count = z.number().int().min(1).max(10)
const difficulty = z.number().int().min(1).max(5)

export const aiInputSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('items'), skill: skillBrief, count, difficulty, instructions, examples: z.array(z.unknown()).max(12) }),
  z.object({ kind: z.literal('variants'), skill: skillBrief, count, difficulty, instructions, itemRef, item: z.unknown() }),
  z.object({ kind: z.literal('hints'), skill: skillBrief, instructions, itemRef, item: z.unknown() }),
  z.object({ kind: z.literal('translate'), skill: skillBrief, instructions, itemRef, item: z.unknown(), to: z.enum(['id', 'en-GB']) }),
  z.object({ kind: z.literal('rubric'), skill: skillBrief, instructions, itemRef, item: z.unknown() }),
  z.object({
    kind: z.literal('grade'),
    responseId: z.uuid(),
    skill: skillBrief,
    item: z.unknown(),
    answerText: z.string().max(20000).nullable(),
    mediaId: z.uuid().nullable(),
  }),
  z.object({ kind: z.literal('import'), batchId: z.uuid(), mediaId: z.uuid(), subject: z.enum(SUBJECTS), grade: z.number().int().min(1).max(6), title: z.string().max(200) }),
  z.object({ kind: z.literal('test') }),
])
export type AiInput = z.infer<typeof aiInputSchema>
// Kontrak web: setiap bentuk input yang lolos skema ini juga AiJobInput.
type _Contract = AiInput extends AiJobInput ? true : never
const _contract: _Contract = true
void _contract

export type AiInputOf<K extends AiInput['kind']> = Extract<AiInput, { kind: K }>

export type LoadedAiJob<K extends AiInput['kind'] = AiInput['kind']> = {
  id: string
  status: 'queued' | 'running' | 'done' | 'failed'
  input: AiInputOf<K>
  createdBy: string
}

const payloadSchema = z.object({ aiJobId: z.uuid() })

export function aiJobIdOf(payload: unknown): string | null {
  const p = payloadSchema.safeParse(payload)
  return p.success ? p.data.aiJobId : null
}

/** Baca ai_job milik job ini. Jenis input harus cocok dengan jenis job (ai.items dengan kind items). */
export async function loadAiJob<K extends AiInput['kind']>(h: HandlerCtx, kind: K): Promise<LoadedAiJob<K>> {
  const id = aiJobIdOf(h.job.payload)
  if (!id) throw new JobError('Payload job AI tidak berisi aiJobId. Buat permintaan baru dari konsol.', { retryable: false })
  const rows = await withOrg(h.db, h.org, (tx) =>
    tx
      .select({ id: tables.aiJob.id, status: tables.aiJob.status, input: tables.aiJob.input, createdBy: tables.aiJob.createdBy })
      .from(tables.aiJob)
      .where(eq(tables.aiJob.id, id))
      .limit(1),
  )
  const row = rows[0]
  if (!row) throw new JobError('Data job AI tidak ditemukan. Buat permintaan baru dari konsol.', { retryable: false })
  const parsed = aiInputSchema.safeParse(row.input)
  if (!parsed.success) {
    h.log.warn('input ai_job tidak sesuai kontrak', { aiJobId: id, paths: parsed.error.issues.slice(0, 5).map((i) => i.path.join('.')) })
    throw new JobError('Isi permintaan AI tidak lengkap. Buat permintaan baru dari konsol.', { retryable: false })
  }
  if (parsed.data.kind !== kind) throw new JobError('Jenis permintaan AI tidak cocok dengan jenis job.', { retryable: false })
  return { id: row.id, status: row.status, input: parsed.data as AiInputOf<K>, createdBy: row.createdBy }
}

export async function markAiRunning(h: HandlerCtx, aiJobId: string): Promise<void> {
  await withOrg(h.db, h.org, (tx) =>
    tx.update(tables.aiJob).set({ status: 'running', startedAt: h.now(), error: null }).where(eq(tables.aiJob.id, aiJobId)),
  )
}

export type AiJobFinish = {
  output: unknown
  provider: string | null
  model: string | null
  durationMs: number | null
  usage: unknown
}

export async function completeAiJobTx(tx: Tx, aiJobId: string, f: AiJobFinish, now: Date): Promise<void> {
  await tx
    .update(tables.aiJob)
    .set({
      status: 'done',
      output: f.output ?? null,
      error: null,
      provider: f.provider,
      model: f.model,
      durationMs: f.durationMs,
      usage: f.usage ?? null,
      finishedAt: now,
    })
    .where(eq(tables.aiJob.id, aiJobId))
}

/** ai_job ikut status job: gagal permanen menjadi failed, dicoba lagi atau diantrekan menjadi queued dengan pesannya. */
export async function failAiJob(h: HandlerCtx, info: FailureInfo, extra: { output?: unknown } = {}): Promise<void> {
  const id = aiJobIdOf(h.job.payload)
  if (!id) return
  await withOrg(h.db, h.org, (tx) =>
    tx
      .update(tables.aiJob)
      .set(
        info.action === 'fail'
          ? { status: 'failed', error: info.message, finishedAt: h.now(), provider: h.ai.name, ...(extra.output !== undefined ? { output: extra.output } : {}) }
          : { status: 'queued', error: info.message },
      )
      .where(eq(tables.aiJob.id, id)),
  )
}

/** Handler AI standar: onFailure memperbarui ai_job. */
export function aiHandler(run: (h: HandlerCtx) => Promise<unknown>, onFailure?: Handler['onFailure']): Handler {
  return {
    run,
    async onFailure(h, info) {
      await failAiJob(h, info)
      if (onFailure) await onFailure(h, info)
    },
  }
}
