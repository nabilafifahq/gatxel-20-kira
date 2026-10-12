import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import postgres from 'postgres'
import { randomUUID } from 'node:crypto'

/**
 * Tes RLS dan hak akses role di Postgres sungguhan.
 * Butuh DATABASE_URL_OWNER, DATABASE_URL_APP, DATABASE_URL_AUTH, DATABASE_URL_WORKER
 * (lihat scripts/dev-db.sh env) dan migrasi sudah dijalankan.
 */

const urls = {
  owner: process.env.DATABASE_URL_OWNER,
  app: process.env.DATABASE_URL_APP,
  auth: process.env.DATABASE_URL_AUTH,
  worker: process.env.DATABASE_URL_WORKER,
}
const ready = Object.values(urls).every(Boolean)

const conn = (u: string | undefined) => postgres(u!, { max: 2, onnotice: () => {} })

describe.skipIf(!ready)('RLS dan role database', () => {
  const owner = ready ? conn(urls.owner) : (null as never)
  const app = ready ? conn(urls.app) : (null as never)
  const authDb = ready ? conn(urls.auth) : (null as never)
  const worker = ready ? conn(urls.worker) : (null as never)

  const orgA = randomUUID()
  const orgB = randomUUID()
  const tutorA = randomUUID()
  const guardianA = randomUUID()
  const learnerA1 = randomUUID()
  const learnerA2 = randomUUID()
  const learnerB = randomUUID()

  async function as<T>(
    db: postgres.Sql,
    ctx: { org?: string; user?: string; role?: string },
    fn: (tx: postgres.TransactionSql) => Promise<T>,
  ): Promise<T> {
    return (await db.begin(async (tx) => {
      if (ctx.org) await tx`select set_config('app.org_id', ${ctx.org}, true)`
      if (ctx.user) await tx`select set_config('app.user_id', ${ctx.user}, true)`
      if (ctx.role) await tx`select set_config('app.role', ${ctx.role}, true)`
      return fn(tx)
    })) as T
  }

  beforeAll(async () => {
    await owner`insert into org (id, name) values (${orgA}, 'Org A __GTX_SEED__'), (${orgB}, 'Org B __GTX_SEED__')`
    await owner`insert into member_profile (user_id, org_id, name, role, email) values
      (${tutorA}, ${orgA}, 'Tutor A', 'tutor', 'tutor-a@example.test'),
      (${guardianA}, ${orgA}, 'Mama A', 'guardian', 'mama-a@example.test')`
    await owner`insert into learner_profile (user_id, org_id, name, grade, active) values
      (${learnerA1}, ${orgA}, 'Anak A1', 2, true),
      (${learnerA2}, ${orgA}, 'Anak A2', 3, true),
      (${learnerB}, ${orgB}, 'Anak B', 2, true)`
    await owner`insert into guardian_link (org_id, guardian_id, learner_id) values (${orgA}, ${guardianA}, ${learnerA1})`
    for (const [org, learner] of [[orgA, learnerA1], [orgA, learnerA2], [orgB, learnerB]] as const) {
      await owner`insert into skill_state (org_id, learner_id, skill_id, theta) values (${org}, ${learner}, 'm2.arrays', 0.5)`
      await owner`insert into note (org_id, learner_id, author_id, body) values (${org}, ${learner}, ${tutorA}, 'catatan')`
    }
    await owner`insert into consent_event (org_id, learner_id, guardian_id, recorded_by, purpose, granted, notice_version, method)
      values (${orgA}, ${learnerA1}, ${guardianA}, ${guardianA}, 'learning', true, 'v1', 'in-app')`
    await owner`insert into job (org_id, kind, payload) values (${orgA}, 'test-kind', '{}'::jsonb)`
  })

  afterAll(async () => {
    await owner`delete from org where id in (${orgA}, ${orgB})`
    await Promise.all([owner.end(), app.end(), authDb.end(), worker.end()])
  })

  it('kira_app tanpa app.org_id tidak melihat baris apa pun', async () => {
    const rows = await as(app, {}, (tx) => tx`select count(*)::int as n from learner_profile`)
    expect(rows[0]!.n).toBe(0)
    const orgs = await as(app, {}, (tx) => tx`select count(*)::int as n from org`)
    expect(orgs[0]!.n).toBe(0)
  })

  it('tutor org A melihat semua learner A dan tidak melihat org B', async () => {
    const rows = await as(app, { org: orgA, user: tutorA, role: 'tutor' }, (tx) => tx`select user_id from learner_profile order by name`)
    expect(rows.map((r) => r.user_id).sort()).toEqual([learnerA1, learnerA2].sort())
    const b = await as(app, { org: orgA, user: tutorA, role: 'tutor' }, (tx) => tx`select count(*)::int as n from skill_state where org_id = ${orgB}`)
    expect(b[0]!.n).toBe(0)
  })

  it('menulis baris untuk org lain ditolak', async () => {
    await expect(
      as(app, { org: orgA, user: tutorA, role: 'tutor' }, (tx) => tx`insert into note (org_id, learner_id, author_id, body) values (${orgB}, ${learnerB}, ${tutorA}, 'x')`),
    ).rejects.toThrow(/row-level security/)
  })

  it('learner hanya melihat datanya sendiri dan tidak melihat catatan tutor', async () => {
    const own = await as(app, { org: orgA, user: learnerA1, role: 'learner' }, (tx) => tx`select learner_id from skill_state`)
    expect(own.map((r) => r.learner_id)).toEqual([learnerA1])
    const notes = await as(app, { org: orgA, user: learnerA1, role: 'learner' }, (tx) => tx`select count(*)::int as n from note`)
    expect(notes[0]!.n).toBe(0)
    const profiles = await as(app, { org: orgA, user: learnerA1, role: 'learner' }, (tx) => tx`select user_id from learner_profile`)
    expect(profiles.map((r) => r.user_id)).toEqual([learnerA1])
  })

  it('learner tidak bisa menulis data learner lain', async () => {
    await expect(
      as(app, { org: orgA, user: learnerA1, role: 'learner' }, (tx) => tx`insert into xp_event (org_id, learner_id, amount, reason, date) values (${orgA}, ${learnerA2}, 10, 'x', '2026-10-12')`),
    ).rejects.toThrow(/row-level security/)
  })

  it('orang tua hanya melihat anak yang tertaut', async () => {
    const rows = await as(app, { org: orgA, user: guardianA, role: 'guardian' }, (tx) => tx`select learner_id from skill_state`)
    expect(rows.map((r) => r.learner_id)).toEqual([learnerA1])
  })

  it('peran worker palsu di koneksi kira_app tidak melihat data learner', async () => {
    const rows = await as(app, { org: orgA, user: tutorA, role: 'worker' }, (tx) => tx`select count(*)::int as n from skill_state`)
    expect(rows[0]!.n).toBe(0)
  })

  it('kira_app tidak punya akses ke skema auth', async () => {
    await expect(app`select count(*) from auth.user_account`).rejects.toThrow(/permission denied/)
  })

  it('kira_auth tidak punya akses ke tabel publik', async () => {
    await expect(authDb`select count(*) from learner_profile`).rejects.toThrow(/permission denied/)
  })

  it('persetujuan tidak bisa diubah atau dihapus oleh aplikasi', async () => {
    await expect(
      as(app, { org: orgA, user: guardianA, role: 'guardian' }, (tx) => tx`update consent_event set granted = false`),
    ).rejects.toThrow(/permission denied/)
    await expect(
      as(app, { org: orgA, user: tutorA, role: 'tutor' }, (tx) => tx`delete from consent_event`),
    ).rejects.toThrow(/permission denied/)
  })

  it('kira_app tidak bisa memanggil fungsi definer worker', async () => {
    await expect(app`select * from kira_claim_jobs(null, 5)`).rejects.toThrow(/permission denied/)
  })

  it('worker mengambil job lintas org lewat fungsi definer lalu bekerja di dalam org', async () => {
    const jobs = await worker`select * from kira_claim_jobs(array['test-kind'], 5)`
    expect(jobs.length).toBeGreaterThanOrEqual(1)
    const j = jobs.find((x) => x.org_id === orgA)!
    expect(j).toBeTruthy()
    const seen = await as(worker, { org: orgA, user: tutorA, role: 'worker' }, (tx) => tx`select count(*)::int as n from skill_state`)
    expect(seen[0]!.n).toBe(2)
    const other = await as(worker, { org: orgA, user: tutorA, role: 'worker' }, (tx) => tx`select count(*)::int as n from skill_state where org_id = ${orgB}`)
    expect(other[0]!.n).toBe(0)
  })

  it('kira_org_count bisa dipanggil semua role aplikasi', async () => {
    const r = await app`select kira_org_count() as n`
    expect(r[0]!.n).toBeGreaterThanOrEqual(2)
  })
})
