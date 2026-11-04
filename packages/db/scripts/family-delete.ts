import { randomBytes } from 'node:crypto'
import type postgres from 'postgres'
import { emailKey } from '@kira/core/email'
import { addDays, jakartaDate, jakartaMidnight } from '@kira/core/time'

/**
 * Hapus satu keluarga atas permintaan orang tua (perintah admin family-delete). Tidak ada layanan mandiri selama pilot.
 *
 * Mengikuti janji Kebijakan Privasi:
 * - Data anak: permintaan hapus biasa (deletion_request dan job learner.delete), dihapus 7 hari setelah permintaan dan
 *   masih bisa dibatalkan orang tua dari halaman Privasi selama masa itu. Worker yang menghapus data dan berkasnya.
 * - Akun orang tua dan kursi: dihapus saat perintah dijalankan lagi setelah semua anak terhapus, paling lambat 30 hari.
 * - Yang tetap sampai lama simpannya habis: catatan audit (12 bulan), pesan bantuan (12 bulan, tanpa tautan akun), email
 *   keluar yang sudah terkirim (90 hari), cadangan (8 minggu). Karena audit_log terikat ke org, baris org tetap ada
 *   sebagai nisan tanpa nama keluarga.
 *
 * Keluarga bertutor tidak dilayani perintah ini.
 */

/** Sama dengan DELETION_DELAY_DAYS di apps/web/src/server/dal/privacy.ts dan Kebijakan Privasi. */
const DELETION_DELAY_DAYS = 7
export const DELETED_ORG_NAME = 'Keluarga dihapus'
const RETAINED_TABLES = new Set(['audit_log'])

type Family = { orgId: string; parentId: string; email: string; emailNorm: string; seatOwner: string | null }

async function findFamily(sql: postgres.Sql, emailRaw: string): Promise<Family> {
  const email = emailRaw.trim().toLowerCase()
  const key = emailKey(email)
  const users = await sql<{ id: string; org_id: string; role: string; email: string; email_norm: string | null }[]>`
    select id, org_id, role, email, email_norm from auth.user_account
    where (lower(email) = ${email} or email_norm = ${key}) and kind = 'adult'
    order by (lower(email) = ${email}) desc limit 1`
  const user = users[0]
  if (!user) throw new Error('Akun orang tua dengan email itu tidak ditemukan.')
  if (user.role !== 'guardian') throw new Error('Akun itu bukan orang tua. Keluarga bertutor tidak dihapus lewat perintah ini.')
  const [tutors] = await sql<{ n: number }[]>`select count(*)::int as n from member_profile where org_id = ${user.org_id} and role = 'tutor' and removed_at is null`
  if (tutors!.n > 0) throw new Error('Keluarga ini punya tutor. Keluarga bertutor tidak dihapus lewat perintah ini.')
  const [seat] = await sql<{ user_id: string }[]>`select user_id from auth.beta_seat where org_id = ${user.org_id}`
  if (seat && seat.user_id !== user.id) throw new Error('Email itu bukan pemilik kursi keluarga ini. Minta pemilik kursi yang mengajukan.')
  return { orgId: user.org_id, parentId: user.id, email: user.email, emailNorm: user.email_norm ?? key, seatOwner: seat?.user_id ?? null }
}

async function orgTables(sql: postgres.Sql): Promise<string[]> {
  const rows = await sql<{ name: string }[]>`select conrelid::regclass::text as name from pg_constraint where contype = 'f' and confrelid = 'public.org'::regclass order by 1`
  return rows.map((r) => r.name)
}

export type FamilyPlan = {
  orgId: string
  seatHeld: boolean
  learners: { id: string; active: boolean; deletion: { reference: string; scheduledFor: string } | null }[]
  remove: Record<string, number>
  keep: Record<string, number>
}

/** Bacaan saja: berapa baris yang akan terhapus dan berapa yang tetap sampai lama simpannya habis. */
export async function familyPlan(sql: postgres.Sql, emailRaw: string): Promise<FamilyPlan> {
  const f = await findFamily(sql, emailRaw)
  const learners = await sql<{ id: string; active: boolean; reference: string | null; scheduled_for: string | null }[]>`
    select l.user_id as id, l.active, d.reference, d.scheduled_for::text as scheduled_for
    from learner_profile l
    left join lateral (
      select reference, scheduled_for from deletion_request r
      where r.learner_id = l.user_id and r.cancelled_at is null and r.executed_at is null order by r.created_at desc limit 1
    ) d on true
    where l.org_id = ${f.orgId} order by l.created_at`
  const remove: Record<string, number> = {}
  const keep: Record<string, number> = {}
  for (const table of await orgTables(sql)) {
    const [row] = await sql.unsafe<{ n: number }[]>(`select count(*)::int as n from ${table} where org_id = $1`, [f.orgId])
    if (row!.n > 0) (RETAINED_TABLES.has(table) ? keep : remove)[table] = row!.n
  }
  for (const table of ['auth.device', 'auth.invite', 'auth.mcp_token', 'auth.session', 'auth.user_account']) {
    const [row] = await sql.unsafe<{ n: number }[]>(`select count(*)::int as n from ${table} where org_id = $1`, [f.orgId])
    if (row!.n > 0) remove[table] = row!.n
  }
  const [tickets] = await sql<{ n: number }[]>`select count(*)::int as n from support_ticket where account_id = ${f.parentId} or sender_email = ${f.email}`
  if (tickets!.n > 0) keep['support_ticket'] = tickets!.n
  const [mail] = await sql<{ n: number }[]>`select count(*)::int as n from public_mail where to_addr = ${f.email} and status <> 'queued'`
  if (mail!.n > 0) keep['public_mail'] = mail!.n
  return {
    orgId: f.orgId,
    seatHeld: f.seatOwner !== null,
    learners: learners.map((l) => ({ id: l.id, active: l.active, deletion: l.reference && l.scheduled_for ? { reference: l.reference, scheduledFor: l.scheduled_for } : null })),
    remove,
    keep,
  }
}

export type FamilyDeleteResult =
  | { status: 'scheduled'; scheduledFor: string; learners: number }
  | { status: 'waiting'; scheduledFor: string; learners: number }
  | { status: 'deleted'; mediaPaths: string[] }

/**
 * Tahap pertama: setiap anak mendapat permintaan hapus biasa. Tahap kedua, setelah worker menghapus semua anak: akun
 * orang tua, sisa data keluarga, dan kursinya dihapus. Keluarga tanpa anak langsung ke tahap kedua.
 */
export async function familyDelete(sql: postgres.Sql, emailRaw: string, confirmOrgId: string, now: Date = new Date()): Promise<FamilyDeleteResult> {
  const f = await findFamily(sql, emailRaw)
  if (confirmOrgId !== f.orgId) throw new Error('Kode konfirmasi tidak cocok. Jalankan dulu tanpa --confirm dan salin id keluarga dari hasilnya.')
  const tables = (await orgTables(sql)).filter((t) => !RETAINED_TABLES.has(t))
  return (await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext(${`family-delete:${f.orgId}`}))`
    const learners = await tx<{ id: string; scheduled_for: string | null }[]>`
      select l.user_id as id, (
        select r.scheduled_for::text from deletion_request r
        where r.learner_id = l.user_id and r.cancelled_at is null and r.executed_at is null order by r.created_at desc limit 1
      ) as scheduled_for
      from learner_profile l where l.org_id = ${f.orgId}`
    if (learners.length > 0) {
      const missing = learners.filter((l) => !l.scheduled_for)
      if (missing.length === 0) {
        const last = learners.map((l) => l.scheduled_for!).sort().at(-1)!
        return { status: 'waiting', scheduledFor: last, learners: learners.length } satisfies FamilyDeleteResult
      }
      const scheduledFor = addDays(jakartaDate(now), DELETION_DELAY_DAYS)
      for (const l of missing) {
        const reference = `KR-${randomBytes(3).toString('hex').toUpperCase()}`
        const [req] = await tx<{ id: string }[]>`
          insert into deletion_request (org_id, learner_id, requested_by, reference, scheduled_for)
          values (${f.orgId}, ${l.id}, ${f.parentId}, ${reference}, ${scheduledFor}) returning id`
        const [job] = await tx<{ id: string }[]>`
          insert into job (org_id, kind, payload, created_by, run_after)
          values (${f.orgId}, 'learner.delete', ${tx.json({ learnerId: l.id, deletionRequestId: req!.id })}, ${f.parentId}, ${jakartaMidnight(scheduledFor)}) returning id`
        await tx`update learner_profile set active = false, updated_at = now() where user_id = ${l.id}`
        await tx`insert into audit_log (org_id, actor_id, actor_kind, action, target, meta)
          values (${f.orgId}, ${f.parentId}, 'worker', 'deletion.requested', ${l.id}, ${tx.json({ reference, scheduledFor, from: 'admin family-delete' })})`
        await tx`select pg_notify('kira_job', ${job!.id})`
      }
      return { status: 'scheduled', scheduledFor, learners: learners.length } satisfies FamilyDeleteResult
    }
    const media = await tx<{ path: string }[]>`select path from media where org_id = ${f.orgId} and path is not null`
    const users = await tx<{ id: string }[]>`select id from auth.user_account where org_id = ${f.orgId}`
    for (const table of tables) await tx.unsafe(`delete from ${table} where org_id = $1`, [f.orgId])
    await tx`delete from auth.webauthn_challenge where user_id = any(${users.map((u) => u.id)}::uuid[])`
    await tx`delete from auth.device where org_id = ${f.orgId}`
    await tx`delete from auth.invite where org_id = ${f.orgId}`
    await tx`delete from auth.user_account where org_id = ${f.orgId}`
    await tx`delete from auth.beta_seat where org_id = ${f.orgId}`
    await tx`delete from auth.signup where email_norm = ${f.emailNorm}`
    await tx`delete from auth.waitlist where email_norm = ${f.emailNorm}`
    await tx`delete from public_mail where to_addr = ${f.email} and status = 'queued'`
    await tx`update org set name = ${DELETED_ORG_NAME}, settings = '{}'::jsonb where id = ${f.orgId}`
    await tx`insert into audit_log (org_id, actor_kind, action, target, meta) values (${f.orgId}, 'worker', 'family.deleted', ${f.orgId}, ${tx.json({ from: 'admin family-delete' })})`
    return { status: 'deleted', mediaPaths: media.map((m) => m.path) } satisfies FamilyDeleteResult
  })) as FamilyDeleteResult
}
