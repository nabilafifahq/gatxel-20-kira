import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import type postgres from 'postgres'
import { addDays, jakartaDate, jakartaMidnight, weekStart, weekday } from '@kira/core/time'
import { tables, withOrg, type Db, type WeeklyReportRequest } from '@kira/db'
import { listOrgIds, workerCtx } from './db'
import type { Env } from './env'
import type { Logger } from './log'
import { deleteStored } from './media'

/**
 * Jadwal berkala, semua dalam WIB (Asia/Jakarta, UTC+7 tanpa DST):
 * - retention: setiap hari 03.15 WIB, memanggil kira_retention() lalu menghapus berkasnya.
 * - weekly-report: setiap Minggu 19.00 WIB, meminta web menyiapkan laporan mingguan per learner.
 * - tts-batch: setiap hari 01.30 WIB, menjadwalkan job tts.batch (suara bahasa Inggris) bila TTS_URL diisi.
 * Tabel schedule_state mencatat waktu jalan terakhir. Slot diklaim dengan upsert bersyarat
 * sebelum dijalankan, jadi restart atau dua worker tidak menjalankan slot yang sama dua kali.
 * Slot yang terlewat (server mati) dijalankan sekali saat worker hidup lagi.
 */

export type Slot = { kind: 'daily'; hour: number; minute: number } | { kind: 'weekly'; weekday: number; hour: number; minute: number }

const DAY_MS = 24 * 60 * 60 * 1000

/** Waktu slot terakhir yang sudah lewat (atau tepat sekarang). */
export function latestSlotAt(slot: Slot, now: Date): Date {
  const today = jakartaDate(now)
  const offset = (slot.hour * 60 + slot.minute) * 60_000
  if (slot.kind === 'daily') {
    const at = new Date(jakartaMidnight(today).getTime() + offset)
    return at.getTime() > now.getTime() ? new Date(at.getTime() - DAY_MS) : at
  }
  const back = (weekday(today) - slot.weekday + 7) % 7
  const at = new Date(jakartaMidnight(addDays(today, -back)).getTime() + offset)
  return at.getTime() > now.getTime() ? new Date(at.getTime() - 7 * DAY_MS) : at
}

export type DueCheck = { due: boolean; slotAt: Date; tooLate: boolean }

/**
 * Due bila belum pernah jalan sejak slot terakhir. tooLate bila slot itu sudah lewat lebih dari
 * maxLateMs (misalnya laporan Minggu yang baru bisa jalan hari Rabu): slot dicatat tanpa dijalankan.
 */
export function dueCheck(slot: Slot, lastRunAt: Date | null, now: Date, maxLateMs?: number): DueCheck {
  const slotAt = latestSlotAt(slot, now)
  const due = lastRunAt === null || lastRunAt.getTime() < slotAt.getTime()
  const tooLate = due && maxLateMs !== undefined && now.getTime() - slotAt.getTime() > maxLateMs
  return { due, slotAt, tooLate }
}

export type ScheduleDeps = { db: Db; client: postgres.Sql; env: Env; log: Logger; fetchImpl?: typeof fetch; sleep?: (ms: number, signal: AbortSignal) => Promise<void> }

type Schedule = { name: string; slot: Slot; maxLateMs?: number; run: (deps: ScheduleDeps, slotAt: Date, signal: AbortSignal) => Promise<string> }

export async function runRetention(deps: ScheduleDeps): Promise<string> {
  const rows = await deps.client<{ path: string }[]>`select path from kira_retention()`
  let failed = 0
  for (const r of rows) {
    try {
      await deleteStored(deps.env.KIRA_DATA_DIR, r.path)
    } catch {
      failed++
    }
  }
  deps.log.info('retensi selesai', { media: rows.length, failedFiles: failed })
  return `selesai: ${rows.length} berkas media dihapus${failed ? `, ${failed} gagal` : ''}`
}

const sleepAbortable = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => (clearTimeout(t), resolve()), { once: true })
  })

/** POST ke web untuk setiap learner aktif. Yang gagal dicoba lagi dua kali dengan jeda 1 menit. */
export async function runWeeklyReport(deps: ScheduleDeps, slotAt: Date, signal: AbortSignal): Promise<string> {
  const week = weekStart(jakartaDate(slotAt))
  const targets: WeeklyReportRequest[] = []
  for (const orgId of await listOrgIds(deps.client)) {
    const learners = await withOrg(deps.db, workerCtx(orgId, null), (tx) =>
      tx
        .select({ id: tables.learnerProfile.userId })
        .from(tables.learnerProfile)
        .where(and(eq(tables.learnerProfile.active, true), isNull(tables.learnerProfile.deletedAt))),
    )
    for (const l of learners) targets.push({ orgId, learnerId: l.id, weekStart: week })
  }
  const url = `${deps.env.KIRA_INTERNAL_URL.replace(/\/+$/, '')}/api/internal/weekly-report`
  const doFetch = deps.fetchImpl ?? fetch
  const sleep = deps.sleep ?? sleepAbortable
  let pending = targets
  let ok = 0
  let queued = 0
  let rejected = 0
  const statuses = new Set<number>()
  for (let round = 0; round < 3 && pending.length && !signal.aborted; round++) {
    if (round > 0) await sleep(60_000, signal)
    const retry: WeeklyReportRequest[] = []
    for (const t of pending) {
      if (signal.aborted) {
        retry.push(t)
        continue
      }
      try {
        const res = await doFetch(url, {
          method: 'POST',
          headers: { authorization: `Bearer ${deps.env.KIRA_INTERNAL_TOKEN}`, 'content-type': 'application/json' },
          body: JSON.stringify(t),
          signal: AbortSignal.timeout(15_000),
        })
        const body = (await res.json().catch(() => null)) as { queued?: unknown } | null
        if (res.ok) {
          ok++
          if (typeof body?.queued === 'number') queued += body.queued
        } else if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
          // Ditolak web (misalnya token internal tidak cocok): tidak dicoba lagi.
          rejected++
          statuses.add(res.status)
        } else retry.push(t)
      } catch {
        retry.push(t)
      }
    }
    pending = retry
  }
  deps.log.info('laporan mingguan diminta', { learners: targets.length, ok, queued, failed: pending.length, rejected, statuses: [...statuses] })
  return `selesai: ${ok} dari ${targets.length} learner${pending.length ? `, ${pending.length} gagal dihubungi` : ''}${rejected ? `, ${rejected} ditolak web (kode ${[...statuses].join(', ')})` : ''}`
}

/** Jadwalkan job tts.batch per org, kecuali sudah ada yang menunggu atau berjalan. Tanpa TTS_URL tidak melakukan apa pun. */
export async function runTtsBatchEnqueue(deps: ScheduleDeps): Promise<string> {
  if (!deps.env.TTS_URL) return 'dilewati: TTS_URL belum diisi'
  let queued = 0
  for (const orgId of await listOrgIds(deps.client)) {
    const ctx = workerCtx(orgId, null)
    const open = await withOrg(deps.db, ctx, (tx) =>
      tx.select({ id: tables.job.id }).from(tables.job).where(and(eq(tables.job.kind, 'tts.batch'), inArray(tables.job.status, ['queued', 'running']))).limit(1),
    )
    if (open.length > 0) continue
    await withOrg(deps.db, ctx, async (tx) => {
      const [row] = await tx.insert(tables.job).values({ orgId, kind: 'tts.batch', payload: { scope: 'all' } }).returning({ id: tables.job.id })
      await tx.execute(sql`select pg_notify('kira_job', ${row!.id})`)
    })
    queued++
  }
  return `selesai: ${queued} job batch suara dijadwalkan`
}

export const SCHEDULES: Schedule[] = [
  { name: 'retention', slot: { kind: 'daily', hour: 3, minute: 15 }, run: (d) => runRetention(d) },
  { name: 'weekly-report', slot: { kind: 'weekly', weekday: 0, hour: 19, minute: 0 }, maxLateMs: 2 * DAY_MS, run: runWeeklyReport },
  { name: 'tts-batch', slot: { kind: 'daily', hour: 1, minute: 30 }, run: (d) => runTtsBatchEnqueue(d) },
]

export class Scheduler {
  private busy = false
  private stopping = false
  private current: Promise<void> | null = null
  private readonly abort = new AbortController()

  constructor(
    private readonly deps: ScheduleDeps,
    private readonly schedules: Schedule[] = SCHEDULES,
    private readonly now: () => Date = () => new Date(),
  ) {}

  trigger(): void {
    if (this.busy || this.stopping) return
    this.current = this.tick()
  }

  /**
   * Klaim slot: hanya satu pemanggil yang mendapat baris kembali untuk slot yang sama.
   * Waktu dikirim sebagai teks ISO karena drizzle membuat serializer timestamptz client postgres.js
   * transparan (Date tidak diubah), jadi query mentah tidak boleh mengirim objek Date.
   */
  private async claim(name: string, slotAt: Date, now: Date, note: string): Promise<boolean> {
    const rows = await this.deps.client`
      insert into schedule_state (name, last_run_at, last_result) values (${name}, ${now.toISOString()}::timestamptz, ${note})
      on conflict (name) do update set last_run_at = excluded.last_run_at, last_result = excluded.last_result
      where schedule_state.last_run_at is null or schedule_state.last_run_at < ${slotAt.toISOString()}::timestamptz
      returning name`
    return rows.length > 0
  }

  private async lastRunAt(name: string): Promise<Date | null> {
    const [row] = await this.deps.client<{ ms: number | null }[]>`select extract(epoch from last_run_at)::float8 * 1000 as ms from schedule_state where name = ${name}`
    return row?.ms === null || row?.ms === undefined ? null : new Date(Number(row.ms))
  }

  async tick(): Promise<void> {
    this.busy = true
    try {
      for (const s of this.schedules) {
        if (this.stopping) break
        const now = this.now()
        const check = dueCheck(s.slot, await this.lastRunAt(s.name), now, s.maxLateMs)
        if (!check.due) continue
        if (check.tooLate) {
          if (await this.claim(s.name, check.slotAt, now, 'dilewati: jadwal sudah lewat lebih dari 2 hari')) this.deps.log.warn('jadwal terlewat dan dilewati', { schedule: s.name })
          continue
        }
        if (!(await this.claim(s.name, check.slotAt, now, 'berjalan'))) continue
        this.deps.log.info('jadwal mulai', { schedule: s.name })
        let result: string
        try {
          result = await s.run(this.deps, check.slotAt, this.abort.signal)
        } catch (e) {
          this.deps.log.error('jadwal gagal', { schedule: s.name, error: e })
          result = 'gagal: lihat log worker'
        }
        await this.deps.client`update schedule_state set last_result = ${result.slice(0, 300)} where name = ${s.name}`
      }
    } catch (e) {
      this.deps.log.error('pemeriksaan jadwal gagal', { error: e })
    } finally {
      this.busy = false
    }
  }

  async shutdown(): Promise<void> {
    this.stopping = true
    this.abort.abort()
    if (this.current) await this.current
  }
}
