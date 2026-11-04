import { createHash, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import postgres from 'postgres'
import { isSafeAddress, type EmailIdentity } from '@kira/core/email'
import { emailSamples, seatReopenedEmail } from '@kira/core/email-templates'

/**
 * Perintah admin server Kira. Dijalankan pemilik server dari terminal (Docker: lihat docs/pasang-windows.md).
 * Memakai DATABASE_URL_OWNER (melewati RLS), jadi hanya untuk pemeliharaan.
 *
 *   status                 ringkasan isi database dan antrean job
 *   reset-link <email>     tautan atur ulang password (berlaku 30 menit), bila email belum diatur
 *   unlock <email>         hapus kunci masuk setelah terlalu banyak percobaan salah
 *   pin-unlock <nama>      buka kunci PIN learner (nama persis seperti di konsol)
 *   reset-streak <nama>    hapus riwayat hari dan pembeku streak learner itu saja, lalu hitung ulang hari ini (XP dan jawaban tetap)
 *   tts-batch              jadwalkan job tts.batch (membuat suara bahasa Inggris yang belum ada) untuk setiap org
 *   tts-status             jumlah klip suara yang sudah jadi dan yang masih menunggu, dari job tts.batch terakhir tiap org
 *   waitlist-count         jumlah daftar tunggu (terkonfirmasi, menunggu konfirmasi, berhenti, sudah diundang) dan sisa kursi
 *   waitlist-export        cetak CSV daftar tunggu yang terkonfirmasi dan belum berhenti (email, sumber, tanggal)
 *   waitlist-notify <n>    antrekan undangan kursi untuk n orang tertua di daftar tunggu (dikirim bertahap, 10 per menit)
 *   sourcing-now           jadwalkan pembaruan sumber soal (seperti jadwal Minggu dini hari) sekarang juga untuk setiap org
 *   email-samples <email>  antrekan satu contoh setiap jenis email ke alamat itu; worker mengirimnya lewat SMTP_URL (bertahap, 10 per menit)
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

/**
 * Atur ulang streak satu learner: hapus riwayat day_record sebelum hari ini dan mulai hitungan streak dari hari ini
 * (pembeku streak dihitung dari riwayat, jadi ikut kosong), lalu hitung ulang hari ini dari sesinya.
 * XP, lencana, penguasaan skill, dan jawaban tidak disentuh. Dicatat di audit_log.
 */
async function resetStreak(name: string | undefined): Promise<void> {
  if (!name) throw new Error('Pakai: admin reset-streak <nama learner>')
  const rows = await sql`select user_id, org_id from learner_profile where name = ${name} and deleted_at is null`
  if (rows.length !== 1) throw new Error(rows.length === 0 ? 'Learner dengan nama itu tidak ditemukan.' : 'Ada lebih dari satu learner dengan nama itu. Atur ulang dari konsol atau dashboard orang tua.')
  const { user_id: id, org_id: org } = rows[0]!
  const [row0] = await sql<{ today: string }[]>`select to_char((now() at time zone 'Asia/Jakarta')::date, 'YYYY-MM-DD') as today`
  const today = row0!.today
  await sql.begin(async (tx) => {
    const gone = await tx`delete from day_record where learner_id = ${id} and date < ${today}::date returning date`
    await tx`update learner_profile set streak_since = ${today}::date, updated_at = now() where user_id = ${id}`
    await tx`
      insert into day_record (org_id, learner_id, date, quests_done, quests_required)
      select ${org}, ${id}, ${today}::date, count(*) filter (where status = 'done' and kind = 'daily')::int, count(*) filter (where kind = 'daily')::int
      from quest where learner_id = ${id} and date = ${today}::date
      having count(*) > 0
      on conflict (learner_id, date) do update set quests_done = excluded.quests_done, quests_required = excluded.quests_required`
    await tx`insert into audit_log (org_id, actor_kind, action, target, meta) values (${org}, 'system', 'learner.streak.reset', ${id}::text, ${tx.json({ removedDays: gone.length, since: today, via: 'admin' })})`
    console.log(`Streak ${name} diatur ulang: ${gone.length} hari riwayat dihapus, hitungan mulai ${today}.`)
  })
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

/**
 * Antrekan job sourcing.run per org bila belum ada yang menunggu atau berjalan. Batas AI_WEEKLY_CONTENT_JOBS di worker
 * tetap berlaku (0 berarti tidak ada soal yang diambil), dan AI harus siap. Hasilnya muncul di log worker dan di tabel job.
 */
async function sourcingNow(db: postgres.Sql = sql, log: (s: string) => void = console.log): Promise<number> {
  const orgs = await db<{ id: string }[]>`select id from org order by created_at`
  let queued = 0
  for (const o of orgs) {
    const open = await db`select id from job where org_id = ${o.id} and kind = 'sourcing.run' and status in ('queued', 'running') limit 1`
    if (open[0]) {
      log(`Org ${o.id}: sudah ada job sourcing.run yang menunggu atau berjalan.`)
      continue
    }
    const [row] = await db<{ id: string }[]>`insert into job (org_id, kind, payload) values (${o.id}, 'sourcing.run', '{"scope":"org"}'::jsonb) returning id`
    await db`select pg_notify('kira_job', ${row!.id})`
    log(`Org ${o.id}: job sourcing.run ${row!.id} dijadwalkan. Batas AI per minggu mengikuti AI_WEEKLY_CONTENT_JOBS di .env. Lihat: docker compose logs -f worker`)
    queued++
  }
  return queued
}

/** Ringkasan suara per org dari job tts.batch terakhir: job.result memuat total, existing, generated, failed, remaining. */
async function ttsStatus(db: postgres.Sql = sql, log: (s: string) => void = console.log): Promise<void> {
  const orgs = await db<{ id: string }[]>`select id from org order by created_at`
  for (const o of orgs) {
    const waiting = await db<{ n: number }[]>`select count(*)::int as n from job where org_id = ${o.id} and kind in ('tts.batch', 'tts.clip') and status = 'queued'`
    const running = await db<{ n: number }[]>`select count(*)::int as n from job where org_id = ${o.id} and kind in ('tts.batch', 'tts.clip') and status = 'running'`
    const [last] = await db<{ status: string; result: Record<string, unknown> | null; finished_at: Date | null; payload: { refs?: unknown[] } | null }[]>`
      select status, result, finished_at, payload from job
      where org_id = ${o.id} and kind = 'tts.batch' and status in ('done', 'failed') and result is not null and (payload->'refs') is null
      order by coalesce(finished_at, created_at) desc limit 1`
    const num = (k: string): number => (typeof last?.result?.[k] === 'number' ? (last.result[k] as number) : 0)
    if (!last) {
      log(`Org ${o.id}: belum ada batch suara yang selesai. Job menunggu ${waiting[0]!.n}, berjalan ${running[0]!.n}.`)
      continue
    }
    const done = num('existing') + num('generated')
    const pending = num('remaining')
    const total = num('total')
    log(`Org ${o.id}: klip jadi ${done} dari ${total}, menunggu ${pending}, gagal ${num('failed')}. Job menunggu ${waiting[0]!.n}, berjalan ${running[0]!.n}. Batch terakhir ${last.status}${last.finished_at ? ` pada ${last.finished_at.toISOString()}` : ''}.`)
  }
}


const SEATS = Number(process.env.KIRA_BETA_SEATS ?? 100)

const emailIdentity = (origin: string): EmailIdentity => ({ origin, legalName: process.env.KIRA_LEGAL_NAME?.trim() || null, legalAddress: process.env.KIRA_LEGAL_ADDRESS?.trim() || null })

async function waitlistCount(): Promise<void> {
  const [w] = await sql`
    select
      count(*) filter (where unsubscribed_at is null and confirmed_at is not null)::int as confirmed,
      count(*) filter (where unsubscribed_at is null and confirmed_at is null)::int as pending,
      count(*) filter (where unsubscribed_at is not null)::int as unsubscribed,
      count(*) filter (where invited_at is not null and unsubscribed_at is null)::int as invited,
      count(*) filter (where converted_at is not null)::int as converted
    from auth.waitlist`
  const [s] = await sql`select count(*)::int as taken from auth.beta_seat`
  console.log(JSON.stringify({ ...w, seatsTotal: SEATS, seatsTaken: s!.taken, seatsFree: Math.max(0, SEATS - (s!.taken as number)) }, null, 2))
}

const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`

async function waitlistExport(): Promise<void> {
  const rows = await sql`select email, source, consented_at, confirmed_at, invited_at from auth.waitlist where unsubscribed_at is null and confirmed_at is not null and converted_at is null order by created_at`
  console.log('email,sumber,setuju_pada,dikonfirmasi_pada,diundang_pada')
  for (const r of rows) console.log([r.email, r.source, r.consented_at?.toISOString(), r.confirmed_at?.toISOString(), r.invited_at?.toISOString() ?? ''].map(csvCell).join(','))
}

/** Antrekan undangan ke n orang terlama yang terkonfirmasi, belum berhenti, belum diundang, dan belum punya akun. 10 email per menit. */
async function waitlistNotify(nRaw: string | undefined): Promise<void> {
  const n = Number(nRaw)
  if (!Number.isInteger(n) || n < 1 || n > 1000) throw new Error('Pakai: admin waitlist-notify <jumlah 1 sampai 1000>')
  const origin = (process.env.KIRA_ORIGIN ?? '').replace(/\/$/, '')
  if (!origin.startsWith('https://') && !origin.startsWith('http://localhost')) throw new Error('KIRA_ORIGIN belum diisi dengan alamat https Kira.')
  const [s] = await sql`select count(*)::int as taken from auth.beta_seat`
  const free = Math.max(0, SEATS - (s!.taken as number))
  if (free === 0) console.log('Peringatan: tidak ada kursi kosong sekarang. Undangan tetap diantrekan, tetapi pendaftaran masih penuh.')
  else if (n > free) console.log(`Peringatan: hanya ${free} kursi kosong, sedangkan undangan yang diantrekan ${n}. Yang datang terlambat masuk daftar tunggu lagi.`)
  const rows = await sql<{ id: string; email: string; token: string }[]>`
    select id, email, token from auth.waitlist
    where unsubscribed_at is null and confirmed_at is not null and invited_at is null and converted_at is null
    order by created_at limit ${n}`
  let i = 0
  for (const r of rows) {
    const { html, text, subject } = seatReopenedEmail(emailIdentity(origin), { signupUrl: `${origin}/daftar`, unsubscribeUrl: `${origin}/kabar/berhenti/${r.token}` })
    await sql.begin(async (tx) => {
      await tx`insert into public_mail (to_addr, subject, html, text, kind, list_unsubscribe, send_after) values (${r.email}, ${subject}, ${html}, ${text}, 'waitlist-invite', ${`${origin}/api/kabar/berhenti/${r.token}`}, now() + (${Math.floor(i / 10)} * interval '1 minute'))`
      await tx`update auth.waitlist set invited_at = now() where id = ${r.id}`
    })
    i++
  }
  await sql`select pg_notify('kira_mail', 'public')`
  console.log(`${rows.length} undangan diantrekan, dikirim bertahap 10 per menit (selesai sekitar ${Math.ceil(rows.length / 10)} menit).`)
}

/**
 * Satu contoh setiap jenis email, lewat kotak keluar dan worker yang sama dengan email sungguhan, jadi header dan SMTP-nya juga diuji.
 * Token di tautan contoh tidak berlaku. Tidak ada data keluarga yang dipakai.
 */
async function emailSamplesCommand(addressRaw: string | undefined): Promise<void> {
  const to = addressRaw?.trim() ?? ''
  if (!isSafeAddress(to)) throw new Error('Pakai: admin email-samples <alamat email>')
  const origin = (process.env.KIRA_ORIGIN ?? '').replace(/\/$/, '')
  if (!origin.startsWith('https://') && !origin.startsWith('http://localhost')) throw new Error('KIRA_ORIGIN belum diisi dengan alamat https Kira.')
  const samples = emailSamples(emailIdentity(origin))
  let i = 0
  for (const { kind, mail, listUnsubscribe } of samples) {
    await sql`insert into public_mail (to_addr, subject, html, text, kind, list_unsubscribe, send_after) values (${to}, ${mail.subject}, ${mail.html}, ${mail.text}, ${kind}, ${listUnsubscribe ?? null}, now() + (${i * 6} * interval '1 second'))`
    i++
  }
  await sql`select pg_notify('kira_mail', 'public')`
  console.log(`${samples.length} email contoh diantrekan ke ${to}. Worker mengirimnya lewat SMTP dalam sekitar 2 menit. Status: docker compose logs -f worker`)
}

const [cmd, arg] = process.argv.slice(2)
try {
  if (cmd === 'status') await status()
  else if (cmd === 'reset-link') await resetLink(arg)
  else if (cmd === 'unlock') await unlock(arg)
  else if (cmd === 'pin-unlock') await pinUnlock(arg)
  else if (cmd === 'reset-streak') await resetStreak(arg)
  else if (cmd === 'tts-batch') await ttsBatch()
  else if (cmd === 'tts-status') await ttsStatus()
  else if (cmd === 'waitlist-count') await waitlistCount()
  else if (cmd === 'waitlist-export') await waitlistExport()
  else if (cmd === 'waitlist-notify') await waitlistNotify(arg)
  else if (cmd === 'sourcing-now') await sourcingNow()
  else if (cmd === 'email-samples') await emailSamplesCommand(arg)
  else {
    console.log('Perintah: status | reset-link <email> | unlock <email> | pin-unlock <nama learner> | reset-streak <nama learner> | tts-batch | tts-status | sourcing-now | waitlist-count | waitlist-export | waitlist-notify <n> | email-samples <email>')
    process.exitCode = cmd ? 1 : 0
  }
} catch (e) {
  console.error((e as Error).message)
  process.exitCode = 1
} finally {
  await sql.end()
}
