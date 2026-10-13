import { createHash, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import postgres from 'postgres'

/**
 * Perintah admin server Kira. Dijalankan pemilik server dari terminal (Docker: lihat docs/pasang-windows.md).
 * Memakai DATABASE_URL_OWNER (melewati RLS), jadi hanya untuk pemeliharaan.
 *
 *   status                 ringkasan isi database dan antrean job
 *   reset-link <email>     tautan atur ulang password (berlaku 30 menit), bila email belum diatur
 *   unlock <email>         hapus kunci masuk setelah terlalu banyak percobaan salah
 *   pin-unlock <nama>      buka kunci PIN learner (nama persis seperti di konsol)
 *   tts-batch              jadwalkan job tts.batch (membuat suara bahasa Inggris yang belum ada) untuk setiap org
 *
 * Tidak pernah mencetak password, hash, atau token selain tautan reset yang memang diminta.
 */

const url = process.env.DATABASE_URL_OWNER
if (!url) {
  console.error('DATABASE_URL_OWNER belum diisi.')
  process.exit(1)
}
const ca = process.env.PGSSLROOTCERT ? readFileSync(process.env.PGSSLROOTCERT, 'utf8') : undefined
const sql = postgres(url, { max: 1, onnotice: () => {}, ...(ca ? { ssl: { ca, rejectUnauthorized: true } } : {}) })

const sha256hex = (v: string) => createHash('sha256').update(v).digest('hex')
const normaliseEmail = (e: string) => e.trim().toLowerCase()

async function status(): Promise<void> {
  const [counts] = await sql`
    select
      (select count(*)::int from org) as orgs,
      (select count(*)::int from member_profile where removed_at is null) as adults,
      (select count(*)::int from learner_profile where deleted_at is null) as learners,
      (select count(*)::int from learner_profile where deleted_at is null and active) as active_learners,
      (select count(*)::int from job where status = 'queued') as jobs_queued,
      (select count(*)::int from job where status = 'running') as jobs_running,
      (select count(*)::int from job where status = 'failed' and finished_at > now() - interval '7 days') as jobs_failed_7d,
      (select count(*)::int from outbox_email where status = 'queued') as email_queued,
      (select count(*)::int from outbox_email where status = 'no-smtp') as email_no_smtp`
  const schedules = await sql`select name, last_run_at, last_result from schedule_state order by name`
  const migrations = await sql`select name, applied_at from kira_migration order by name`.catch(() => [])
  // Hak tabel penting, terutama setelah memulihkan cadangan: consent_event dan audit_log harus append-only.
  const problems = await sql<{ problem: string }[]>`
    select problem from (
      select format('%s punya %s di %s', r, p, t) as problem
      from unnest(array['kira_app', 'kira_worker']) r, unnest(array['consent_event', 'audit_log']) t, unnest(array['UPDATE', 'DELETE']) p
      where has_table_privilege(r, t, p)
      union all
      select 'kira_app bisa membaca schedule_state' where has_table_privilege('kira_app', 'schedule_state', 'SELECT')
      union all
      select 'hak bawaan masih ada (' || defaclobjtype::text || ')' from pg_default_acl
    ) x`
  const privileges = problems.length === 0 ? 'sesuai migrasi' : problems.map((p) => p.problem)
  console.log(JSON.stringify({ ...counts, schedules, migrations: migrations.map((m) => m.name), privileges }, null, 2))
  if (problems.length > 0) process.exitCode = 1
}

async function resetLink(emailRaw: string | undefined): Promise<void> {
  if (!emailRaw) throw new Error('Pakai: admin reset-link <email>')
  const origin = (process.env.KIRA_ORIGIN ?? '').replace(/\/$/, '')
  if (!origin.startsWith('https://') && !origin.startsWith('http://localhost')) throw new Error('KIRA_ORIGIN belum diisi dengan alamat https Kira.')
  const email = normaliseEmail(emailRaw)
  const users = await sql`select id from auth.user_account where lower(email) = ${email} and kind = 'adult' and disabled_at is null limit 1`
  if (!users[0]) throw new Error('Akun dewasa dengan email itu tidak ditemukan.')
  const token = randomBytes(32).toString('base64url')
  await sql`insert into auth.reset_token (user_id, token_hash, expires_at) values (${users[0].id}, ${sha256hex(token)}, now() + interval '30 minutes')`
  console.log(`Tautan atur ulang password (berlaku 30 menit, sekali pakai):\n${origin}/reset/${token}`)
}

async function unlock(emailRaw: string | undefined): Promise<void> {
  if (!emailRaw) throw new Error('Pakai: admin unlock <email>')
  const email = normaliseEmail(emailRaw)
  const key = `email:${sha256hex(email)}`
  const res = await sql`delete from auth.login_attempt where key = ${key} and success = false`
  await sql`update auth.user_account set failed_logins = 0, locked_until = null where lower(email) = ${email}`
  console.log(`Kunci masuk dibuka. ${res.count} percobaan gagal dihapus.`)
}

async function pinUnlock(name: string | undefined): Promise<void> {
  if (!name) throw new Error('Pakai: admin pin-unlock <nama learner>')
  const rows = await sql`select user_id from learner_profile where name = ${name} and deleted_at is null`
  if (rows.length !== 1) throw new Error(rows.length === 0 ? 'Learner dengan nama itu tidak ditemukan.' : 'Ada lebih dari satu learner dengan nama itu. Buka kunci dari konsol (Learner).')
  await sql`update auth.learner_secret set failed_pins = 0, locked_until = null where user_id = ${rows[0]!.user_id}`
  console.log(`PIN ${name} bisa dipakai lagi.`)
}

/** Antrekan job tts.batch bila belum ada yang menunggu atau berjalan. Worker butuh TTS_URL dan layanan tts jalan. */
async function ttsBatch(): Promise<void> {
  const orgs = await sql<{ id: string }[]>`select id from org order by created_at`
  for (const o of orgs) {
    const open = await sql`select id from job where org_id = ${o.id} and kind = 'tts.batch' and status in ('queued', 'running') limit 1`
    if (open[0]) {
      console.log(`Org ${o.id}: sudah ada job tts.batch yang menunggu atau berjalan.`)
      continue
    }
    const [row] = await sql<{ id: string }[]>`insert into job (org_id, kind, payload) values (${o.id}, 'tts.batch', '{"scope":"all"}'::jsonb) returning id`
    await sql`select pg_notify('kira_job', ${row!.id})`
    console.log(`Org ${o.id}: job tts.batch ${row!.id} dijadwalkan. Lihat kemajuannya dengan: docker compose logs -f worker`)
  }
}

const [cmd, arg] = process.argv.slice(2)
try {
  if (cmd === 'status') await status()
  else if (cmd === 'reset-link') await resetLink(arg)
  else if (cmd === 'unlock') await unlock(arg)
  else if (cmd === 'pin-unlock') await pinUnlock(arg)
  else if (cmd === 'tts-batch') await ttsBatch()
  else {
    console.log('Perintah: status | reset-link <email> | unlock <email> | pin-unlock <nama learner> | tts-batch')
    process.exitCode = cmd ? 1 : 0
  }
} catch (e) {
  console.error((e as Error).message)
  process.exitCode = 1
} finally {
  await sql.end()
}
