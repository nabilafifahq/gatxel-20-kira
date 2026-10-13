import { eq, sql } from 'drizzle-orm'
import type postgres from 'postgres'
import { AI_JOB_KINDS, JOB_KINDS, TTS_JOB_KINDS, tables, withOrg, type Db } from '@kira/db'
import type { AiProvider } from './ai/types'
import { workerCtx } from './db'
import type { Env } from './env'
import { JobError, PostponeError, UsageLimitError, isAbortError, refCode, whenWib } from './errors'
import type { FailureInfo, Handler, HandlerCtx, JobRow } from './handlers/types'
import type { Logger } from './log'

/**
 * Antrean job. Dua jalur: job AI satu per satu (batas langganan), job lain dua sekaligus.
 * Job diambil lewat kira_claim_jobs (SECURITY DEFINER, FOR UPDATE SKIP LOCKED) yang menaikkan
 * attempts saat mengambil. Gagal: dicoba lagi paling banyak 3 kali dengan jeda 2^attempts menit.
 * Batas pemakaian AI dan penundaan tidak memakai jatah percobaan: job diantrekan lagi dan attempts dikembalikan.
 */

export const MAX_ATTEMPTS = 3
const LIMIT_FALLBACK_MS = 30 * 60 * 1000
const LIMIT_MAX_WAIT_MS = 8 * 24 * 60 * 60 * 1000

export type Decision = {
  action: 'retry' | 'requeue' | 'fail'
  runAfter: Date | null
  /** Kembalikan attempts (tidak memakai jatah percobaan). */
  refund: boolean
  message: string
  result: unknown
  /** Kode rujukan untuk kesalahan tak terduga; dicatat di log bersama pesan aslinya. */
  ref: string | null
}

/** Keputusan setelah handler melempar. Murni supaya bisa diuji. */
export function decide(e: unknown, attempts: number, aborted: boolean, now: Date): Decision {
  if (aborted || isAbortError(e)) {
    return { action: 'requeue', runAfter: now, refund: true, message: 'Worker dimulai ulang. Job dijalankan lagi.', result: null, ref: null }
  }
  if (e instanceof UsageLimitError) {
    const reset = e.resetAt && e.resetAt.getTime() > now.getTime() && e.resetAt.getTime() - now.getTime() < LIMIT_MAX_WAIT_MS ? e.resetAt : null
    const runAfter = reset ? new Date(reset.getTime() + 60_000) : new Date(now.getTime() + LIMIT_FALLBACK_MS)
    return {
      action: 'requeue',
      runAfter,
      refund: true,
      message: `Batas pemakaian ${e.providerLabel} sedang tercapai. Job dijalankan lagi sekitar ${whenWib(runAfter, now)}.`,
      result: null,
      ref: null,
    }
  }
  if (e instanceof PostponeError) {
    return { action: 'requeue', runAfter: e.runAfter, refund: true, message: e.note, result: null, ref: null }
  }
  const known = e instanceof JobError
  const ref = known ? null : refCode()
  const base = known ? e.message : `Terjadi kesalahan di worker. Kode rujukan ${ref}.`
  const retryable = known ? e.retryable : true
  const result = known ? (e.result ?? null) : null
  if (!retryable || attempts >= MAX_ATTEMPTS) {
    const suffix = retryable ? ` Gagal setelah ${attempts} kali percobaan.` : ''
    return { action: 'fail', runAfter: null, refund: false, message: `${base}${suffix}`, result, ref }
  }
  const runAfter = new Date(now.getTime() + 2 ** attempts * 60_000)
  return { action: 'retry', runAfter, refund: false, message: `${base} Dicoba lagi otomatis ${whenWib(runAfter, now)}.`, result, ref }
}

type Lane = { name: string; kinds: string[]; concurrency: number; active: number; pumping: boolean; again: boolean }

export type QueueDeps = {
  db: Db
  client: postgres.Sql
  env: Env
  ai: AiProvider
  log: Logger
  handlers: Partial<Record<string, Handler>>
  now?: () => Date
}

export class JobQueue {
  private readonly lanes: Lane[]
  private stopping = false
  private readonly running = new Map<string, { promise: Promise<void>; abort: AbortController }>()
  private readonly now: () => Date

  constructor(private readonly deps: QueueDeps) {
    const ai = AI_JOB_KINDS as readonly string[]
    const tts = TTS_JOB_KINDS as readonly string[]
    this.lanes = [
      { name: 'ai', kinds: [...ai], concurrency: 1, active: 0, pumping: false, again: false },
      { name: 'umum', kinds: JOB_KINDS.filter((k) => !ai.includes(k) && !tts.includes(k)), concurrency: 2, active: 0, pumping: false, again: false },
      // Suara: klip permintaan learner tidak menunggu batch yang berjam-jam. Layanan tts memproses satu permintaan sekali.
      { name: 'suara', kinds: ['tts.clip'], concurrency: 1, active: 0, pumping: false, again: false },
      { name: 'suara-batch', kinds: ['tts.batch'], concurrency: 1, active: 0, pumping: false, again: false },
    ]
    this.now = deps.now ?? (() => new Date())
  }

  get activeCount(): number {
    return this.running.size
  }

  /** Dipanggil saat NOTIFY kira_job, saat polling, dan setiap job selesai. */
  trigger(): void {
    if (this.stopping) return
    for (const lane of this.lanes) void this.pump(lane)
  }

  private async pump(lane: Lane): Promise<void> {
    if (lane.pumping) {
      lane.again = true
      return
    }
    lane.pumping = true
    try {
      do {
        lane.again = false
        while (!this.stopping && lane.active < lane.concurrency) {
          const jobs = await this.claim(lane.kinds, lane.concurrency - lane.active)
          if (jobs.length === 0) break
          for (const job of jobs) this.start(lane, job)
        }
      } while (lane.again && !this.stopping)
    } catch (e) {
      this.deps.log.error('gagal mengambil job dari antrean', { lane: lane.name, error: e })
    } finally {
      lane.pumping = false
    }
  }

  private async claim(kinds: string[], limit: number): Promise<JobRow[]> {
    const rows = await this.deps.client<JobRow[]>`select id, org_id, kind, payload, attempts, created_by from kira_claim_jobs(${kinds}::text[], ${limit}::int)`
    return rows.map((r) => ({ ...r }))
  }

  private start(lane: Lane, job: JobRow): void {
    lane.active++
    const abort = new AbortController()
    const promise = this.execute(job, abort.signal)
      .catch((e) => this.deps.log.error('job berhenti tanpa status akhir', { jobId: job.id, kind: job.kind, error: e }))
      .finally(() => {
        lane.active--
        this.running.delete(job.id)
        if (!this.stopping) void this.pump(lane)
      })
    this.running.set(job.id, { promise, abort })
  }

  /** Jalankan satu job sampai statusnya tercatat (done, failed, atau queued lagi). */
  async execute(job: JobRow, signal: AbortSignal): Promise<void> {
    const { db, client, env, ai } = this.deps
    const log = this.deps.log.child({ jobId: job.id, kind: job.kind, attempt: job.attempts })
    const org = workerCtx(job.org_id, job.created_by)
    const handler = this.deps.handlers[job.kind]
    const started = Date.now()
    if (!handler) {
      await this.finish(job, { status: 'failed', lastError: 'Jenis job ini tidak dikenal worker.', result: null })
      log.warn('jenis job tidak dikenal')
      return
    }
    const h: HandlerCtx = { job, org, db, client, env, ai, log, signal, finalAttempt: job.attempts >= MAX_ATTEMPTS, now: this.now }
    log.info('job mulai')
    try {
      const result = await handler.run(h)
      await this.finish(job, { status: 'done', lastError: null, result: result ?? null })
      log.info('job selesai', { ms: Date.now() - started })
    } catch (e) {
      const d = decide(e, job.attempts, signal.aborted, this.now())
      const meta: Record<string, unknown> = { ms: Date.now() - started, action: d.action, ref: d.ref }
      if (d.ref) meta.error = e
      else meta.reason = e instanceof Error ? e.message : String(e)
      const detail = (e as { providerDetail?: unknown }).providerDetail
      if (detail) meta.providerDetail = detail
      if (d.action === 'fail') log.error('job gagal', meta)
      else log.warn(d.action === 'retry' ? 'job dicoba lagi nanti' : 'job diantrekan lagi', meta)
      const info: FailureInfo = { action: d.action, message: d.message, runAfter: d.runAfter }
      try {
        await handler.onFailure?.(h, info)
      } catch (e2) {
        log.error('gagal memperbarui data domain setelah job gagal', { error: e2 })
      }
      if (d.action === 'fail') await this.finish(job, { status: 'failed', lastError: d.message, result: d.result })
      else await this.requeue(job, d.runAfter ?? this.now(), d.refund, d.message)
    }
  }

  private async finish(job: JobRow, f: { status: 'done' | 'failed'; lastError: string | null; result: unknown }): Promise<void> {
    await withOrg(this.deps.db, workerCtx(job.org_id, job.created_by), (tx) =>
      tx
        .update(tables.job)
        .set({ status: f.status, finishedAt: this.now(), lastError: f.lastError, result: f.result ?? null, lockedAt: null })
        .where(eq(tables.job.id, job.id)),
    )
  }

  private async requeue(job: JobRow, runAfter: Date, refund: boolean, message: string): Promise<void> {
    await withOrg(this.deps.db, workerCtx(job.org_id, job.created_by), (tx) =>
      tx
        .update(tables.job)
        .set({
          status: 'queued',
          runAfter,
          lockedAt: null,
          lastError: message,
          ...(refund ? { attempts: sql`greatest(0, ${tables.job.attempts} - 1)` } : {}),
        })
        .where(eq(tables.job.id, job.id)),
    )
  }

  /** Berhenti mengambil job, beri waktu job berjalan untuk selesai, lalu batalkan sisanya (diantrekan lagi). */
  async shutdown(graceMs: number): Promise<void> {
    this.stopping = true
    const all = () => Promise.allSettled([...this.running.values()].map((r) => r.promise))
    if (this.running.size === 0) return
    this.deps.log.info('menunggu job berjalan selesai', { count: this.running.size })
    const timedOut = await Promise.race([all().then(() => false), new Promise<boolean>((r) => setTimeout(() => r(true), graceMs).unref())])
    if (!timedOut) return
    for (const r of this.running.values()) r.abort.abort()
    await Promise.race([all(), new Promise((r) => setTimeout(r, 3000).unref())])
  }
}
