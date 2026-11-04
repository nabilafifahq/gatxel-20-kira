import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * Perintah admin family-delete, dijalankan sungguhan sebagai proses terhadap Postgres: dry-run tidak mengubah apa pun,
 * anak mengikuti permintaan hapus biasa, kursi kosong setelah keluarga terhapus, dan keluarga lain tidak tersentuh.
 */
const ready = Boolean(process.env.DATABASE_URL_OWNER)
const root = join(import.meta.dirname, '..', '..', '..')

function admin(...args: string[]): { out: string; code: number | null } {
  const r = spawnSync(process.execPath, ['--import', 'tsx', 'packages/db/scripts/admin.ts', 'family-delete', ...args], { cwd: root, env: process.env, encoding: 'utf8' })
  return { out: `${r.stdout}${r.stderr}`, code: r.status }
}

describe.skipIf(!ready)('perintah admin family-delete', () => {
  const owner = ready ? postgres(process.env.DATABASE_URL_OWNER!, { max: 2, onnotice: () => {} }) : (null as never)
  const run = randomUUID().slice(0, 8)

  type Fam = { org: string; parent: string; learner: string; email: string; norm: string }
  const fam = (email: string, norm: string): Fam => ({ org: randomUUID(), parent: randomUUID(), learner: randomUUID(), email, norm })
  const target = fam(`ma.ma.${run}+kira@gmail.com`, `mama${run}@gmail.com`)
  const other = fam(`lain.${run}@uji.test`, `lain.${run}@uji.test`)
  const tutorOrg = randomUUID()
  const tutorParent = randomUUID()
  const tutorId = randomUUID()
  const tutorParentEmail = `bertutor.${run}@uji.test`

  async function insertFamily(f: Fam, name: string): Promise<void> {
    await owner`insert into org (id, name) values (${f.org}, ${name})`
    await owner`insert into auth.user_account (id, org_id, kind, role, email, email_norm, name) values (${f.parent}, ${f.org}, 'adult', 'guardian', ${f.email}, ${f.norm}, 'Mama uji')`
    await owner`insert into member_profile (user_id, org_id, name, role, email) values (${f.parent}, ${f.org}, 'Mama uji', 'guardian', ${f.email})`
    await owner`insert into auth.user_account (id, org_id, kind, role, name) values (${f.learner}, ${f.org}, 'learner', 'learner', 'Anak uji')`
    await owner`insert into learner_profile (user_id, org_id, name, grade, active, screen_limit_min, rest_weekdays, started_on) values (${f.learner}, ${f.org}, 'Anak uji', 3, true, 120, '{0}', '2026-10-01')`
    await owner`insert into guardian_link (org_id, guardian_id, learner_id) values (${f.org}, ${f.parent}, ${f.learner})`
    await owner`insert into auth.beta_seat (org_id, user_id, email_norm) values (${f.org}, ${f.parent}, ${f.norm})`
    await owner`insert into xp_event (org_id, learner_id, amount, reason, ref, date) values (${f.org}, ${f.learner}, 5, 'uji', 'uji', '2026-11-01')`
    await owner`insert into audit_log (org_id, actor_id, actor_kind, action, target) values (${f.org}, ${f.parent}, 'guardian', 'org.created', ${f.org})`
  }

  const snapshot = async (f: Fam) => {
    const [row] = await owner`select
      (select name from org where id = ${f.org}) as org_name,
      (select count(*)::int from auth.user_account where org_id = ${f.org}) as users,
      (select count(*)::int from member_profile where org_id = ${f.org}) as members,
      (select count(*)::int from learner_profile where org_id = ${f.org} and active) as active_learners,
      (select count(*)::int from xp_event where org_id = ${f.org}) as xp,
      (select count(*)::int from auth.beta_seat where org_id = ${f.org}) as seats,
      (select count(*)::int from deletion_request where org_id = ${f.org}) as requests,
      (select count(*)::int from job where org_id = ${f.org}) as jobs,
      (select count(*)::int from audit_log where org_id = ${f.org}) as audit`
    return row!
  }
  const seatsTaken = async () => (await owner`select count(*)::int as n from auth.beta_seat`)[0]!.n as number

  beforeAll(async () => {
    await insertFamily(target, 'Keluarga Target __GTX_SEED__')
    await insertFamily(other, 'Keluarga Lain __GTX_SEED__')
    await owner`insert into org (id, name) values (${tutorOrg}, 'Keluarga Bertutor __GTX_SEED__')`
    await owner`insert into auth.user_account (id, org_id, kind, role, email, email_norm, name) values (${tutorParent}, ${tutorOrg}, 'adult', 'guardian', ${tutorParentEmail}, ${tutorParentEmail}, 'Mama')`
    await owner`insert into member_profile (user_id, org_id, name, role, email) values (${tutorParent}, ${tutorOrg}, 'Mama', 'guardian', ${tutorParentEmail}), (${tutorId}, ${tutorOrg}, 'Tutor', 'tutor', ${`tutor.${run}@uji.test`})`
    await owner`insert into support_ticket (reference, category, subject, message, sender_email, account_id, account_role) values (${`KR-F${run}`}, 'lainnya', 'Tolong hapus', 'Hapus keluarga', ${target.email}, ${target.parent}, 'guardian')`
  })

  afterAll(async () => {
    await owner`delete from support_ticket where reference = ${`KR-F${run}`}`
    await owner`delete from auth.beta_seat where org_id in (${target.org}, ${other.org})`
    await owner`delete from auth.user_account where org_id in (${target.org}, ${other.org}, ${tutorOrg})`
    await owner`delete from org where id in (${target.org}, ${other.org}, ${tutorOrg})`
    await owner.end()
  })

  it('dry-run menampilkan jumlah baris dan tidak mengubah apa pun, juga lewat bentuk baku email', async () => {
    const before = await snapshot(target)
    const r = admin(target.norm)
    expect(r.code).toBe(0)
    expect(r.out).toContain(target.org)
    expect(r.out).toContain('"xp_event": 1')
    expect(r.out).toContain('"support_ticket": 1')
    expect(r.out).not.toContain('Anak uji')
    expect(await snapshot(target)).toEqual(before)
  })

  it('kode konfirmasi salah ditolak, keluarga bertutor ditolak', async () => {
    const before = await snapshot(target)
    const wrong = admin(target.email, '--confirm', other.org)
    expect(wrong.code).toBe(1)
    expect(wrong.out).toContain('tidak cocok')
    expect(await snapshot(target)).toEqual(before)
    const tutored = admin(tutorParentEmail)
    expect(tutored.code).toBe(1)
    expect(tutored.out).toContain('bertutor')
  })

  it('tahap pertama: anak dijeda dengan permintaan hapus 7 hari, kursi masih terpakai, keluarga lain tetap', async () => {
    const otherBefore = await snapshot(other)
    const taken = await seatsTaken()
    const r = admin(target.email, '--confirm', target.org)
    expect(r.code).toBe(0)
    const after = await snapshot(target)
    expect(after).toMatchObject({ active_learners: 0, requests: 1, jobs: 1, seats: 1, users: 2 })
    const [req] = await owner`select scheduled_for::text as d, requested_by from deletion_request where org_id = ${target.org}`
    expect(req!.requested_by).toBe(target.parent)
    const [gap] = await owner`select (${req!.d}::date - (now() at time zone 'Asia/Jakarta')::date)::int as days`
    expect(gap!.days).toBe(7)
    const [job] = await owner`select kind, status, payload from job where org_id = ${target.org}`
    expect(job).toMatchObject({ kind: 'learner.delete', status: 'queued', payload: { learnerId: target.learner } })
    expect(await seatsTaken()).toBe(taken)
    expect(await snapshot(other)).toEqual(otherBefore)
  })

  it('menjalankan lagi sebelum worker selesai tidak menggandakan permintaan', async () => {
    const r = admin(target.email, '--confirm', target.org)
    expect(r.code).toBe(0)
    expect(await snapshot(target)).toMatchObject({ requests: 1, jobs: 1, seats: 1 })
  })

  it('tahap kedua: setelah anak terhapus worker, kursi kosong dan hanya keluarga itu yang terhapus', async () => {
    const otherBefore = await snapshot(other)
    const taken = await seatsTaken()
    await owner`select path from kira_delete_learner(${target.org}::uuid, ${target.learner}::uuid)`
    const r = admin(target.email, '--confirm', target.org)
    expect(r.code).toBe(0)
    expect(await seatsTaken()).toBe(taken - 1)
    const after = await snapshot(target)
    expect(after).toMatchObject({ org_name: 'Keluarga dihapus', users: 0, members: 0, seats: 0, xp: 0, requests: 0, jobs: 0 })
    expect(after.audit as number).toBeGreaterThanOrEqual(2)
    const [done] = await owner`select count(*)::int as n from audit_log where org_id = ${target.org} and action = 'family.deleted'`
    expect(done!.n).toBe(1)
    const [ticket] = await owner`select account_id from support_ticket where reference = ${`KR-F${run}`}`
    expect(ticket!.account_id).toBeNull()
    expect(await snapshot(other)).toEqual(otherBefore)
    const again = admin(target.email)
    expect(again.code).toBe(1)
    expect(again.out).toContain('tidak ditemukan')
  })
})
