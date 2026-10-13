import { writeFile } from 'node:fs/promises'
import { createProvider } from './ai'
import { connectWorkerDb } from './db'
import { EnvError, loadEnv, type Env } from './env'
import { HANDLERS } from './handlers'
import { log } from './log'
import { ensureMediaRoot } from './media'
import { OutboxSender, smtpMailer } from './outbox'
import { killAllChildren } from './proc'
import { JobQueue } from './queue'
import { Scheduler } from './scheduler'

/**
 * Worker Kira. Mendengarkan NOTIFY kira_job dan kira_mail, memeriksa antrean setiap 30 detik,
 * kotak keluar setiap 60 detik, dan jadwal setiap 60 detik. Berkas /tmp/kira-worker-alive
 * diperbarui setiap 30 detik selama database bisa dihubungi (untuk healthcheck Docker).
 * SIGTERM/SIGINT: berhenti mengambil job, tunggu job berjalan, sisanya diantrekan lagi.
 */

export const HEARTBEAT_FILE = '/tmp/kira-worker-alive'
const JOB_POLL_MS = 30_000
const MAIL_POLL_MS = 60_000
const SCHEDULE_POLL_MS = 60_000
const HEARTBEAT_MS = 30_000
// Docker memberi 10 detik sebelum SIGKILL: 6 detik untuk selesai, lalu sisa job dibatalkan dan diantrekan lagi.
const SHUTDOWN_GRACE_MS = 6_000

async function main(): Promise<void> {
  let env: Env
  try {
    env = loadEnv()
  } catch (e) {
    log.error(e instanceof EnvError ? e.message : `Konfigurasi worker tidak terbaca: ${(e as Error).message}`)
    process.exit(1)
  }

  try {
    await ensureMediaRoot(env.KIRA_DATA_DIR)
  } catch (e) {
    log.error(`Folder KIRA_DATA_DIR tidak bisa dipakai. Periksa izin tulis folder ${env.KIRA_DATA_DIR}.`, { error: e })
    process.exit(1)
  }

  const { db, client } = connectWorkerDb(env.DATABASE_URL_WORKER)
  try {
    await client`select 1`
  } catch (e) {
    log.error('Database tidak bisa dihubungi. Periksa DATABASE_URL_WORKER dan pastikan Postgres sudah jalan.', { error: e })
    await client.end({ timeout: 2 }).catch(() => undefined)
    process.exit(1)
  }

  const ai = createProvider(env)
  if (!ai.ready) log.warn('AI belum siap, job AI akan gagal dengan pesan ini', { provider: ai.name, reason: ai.notReadyReason })
  const mailer = smtpMailer(env)
  if (!mailer) log.warn('SMTP_URL kosong, email masuk status no-smtp')

  const queue = new JobQueue({ db, client, env, ai, log, handlers: HANDLERS })
  const outbox = new OutboxSender({ db, client, env, log, mailer })
  const scheduler = new Scheduler({ db, client, env, log, ai })

  let lastBeat = 0
  const heartbeat = async () => {
    try {
      await client`select 1`
      await writeFile(HEARTBEAT_FILE, new Date().toISOString())
      lastBeat = Date.now()
    } catch (e) {
      log.warn('heartbeat gagal, database tidak menjawab', { error: e, sinceLastBeatMs: lastBeat ? Date.now() - lastBeat : null })
    }
  }

  await client.listen('kira_job', () => queue.trigger(), () => queue.trigger())
  await client.listen('kira_mail', () => outbox.trigger(), () => outbox.trigger())
  const timers = [
    setInterval(() => queue.trigger(), JOB_POLL_MS),
    setInterval(() => outbox.trigger(), MAIL_POLL_MS),
    setInterval(() => scheduler.trigger(), SCHEDULE_POLL_MS),
    setInterval(() => void heartbeat(), HEARTBEAT_MS),
  ]
  await heartbeat()
  queue.trigger()
  outbox.trigger()
  scheduler.trigger()
  log.info('worker jalan', { provider: ai.name, model: ai.model, smtp: Boolean(mailer) })

  let stopping = false
  const shutdown = async (signal: string) => {
    if (stopping) return
    stopping = true
    log.info('worker berhenti', { signal, runningJobs: queue.activeCount })
    for (const t of timers) clearInterval(t)
    await Promise.allSettled([queue.shutdown(SHUTDOWN_GRACE_MS), outbox.shutdown(), scheduler.shutdown()])
    killAllChildren()
    await client.end({ timeout: 5 }).catch(() => undefined)
    log.info('worker selesai berhenti')
    process.exit(0)
  }
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
}

process.on('exit', killAllChildren)
process.on('unhandledRejection', (e) => log.error('promise ditolak tanpa penanganan', { error: e }))

main().catch((e) => {
  log.error('worker gagal mulai', { error: e })
  killAllChildren()
  process.exit(1)
})
