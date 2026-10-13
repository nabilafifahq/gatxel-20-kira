import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * Permintaan hapus akun anak di Postgres sungguhan: learner berhenti aktif di transaksi yang sama dengan
 * permintaannya (tidak ada jeda yang bisa terbaca, dan batal bersama bila transaksi gagal), peran
 * transaksi kembali ke orang tua, dan orang tua tetap tidak bisa mengubah learner_profile secara langsung.
 * Butuh DATABASE_URL_OWNER dan DATABASE_URL_APP dan migrasi sudah dijalankan.
 */

const ownerUrl = process.env.DATABASE_URL_OWNER
const appUrl = process.env.DATABASE_URL_APP
const ready = Boolean(ownerUrl && appUrl)

describe.skipIf(!ready)('permintaan hapus akun anak', () => {
  const owner = ready ? postgres(ownerUrl!, { max: 2, onnotice: () => {} }) : (null as never)
  const orgId = randomUUID()
  const guardianId = randomUUID()
  const learnerId = randomUUID()
  let privacy: typeof import('@/server/dal/privacy')
  let dbm: typeof import('@/server/db')
  let end: () => Promise<void>

  const ctx = { orgId, userId: guardianId, role: 'guardian' as const }
  const active = async () => (await owner`select active from learner_profile where user_id = ${learnerId}`)[0]!.active as boolean
  const openRequests = async () => (await owner`select count(*)::int as n from deletion_request where learner_id = ${learnerId} and cancelled_at is null`)[0]!.n as number

  beforeAll(async () => {
    process.env.KIRA_ORIGIN = 'http://localhost:3100'
    process.env.DATABASE_URL_APP = appUrl!
    process.env.DATABASE_URL_AUTH = appUrl!
    process.env.KIRA_SECRET = 'uji-hapus-akun-anak-rahasia-minimal-32-karakter'
    process.env.KIRA_DATA_DIR = '.kira-local/data'
    privacy = await import('@/server/dal/privacy')
    dbm = await import('@/server/db')
    end = () => (dbm.appDb() as unknown as { $client: { end(): Promise<void> } }).$client.end()
    await owner`insert into org (id, name) values (${orgId}, 'Uji hapus akun __GTX_SEED__')`
    await owner`insert into member_profile (user_id, org_id, name, role, email) values (${guardianId}, ${orgId}, 'Mama uji', 'guardian', 'uji-hapus@example.test')`
    await owner`insert into learner_profile (user_id, org_id, name, grade, active, screen_limit_min, rest_weekdays, started_on)
      values (${learnerId}, ${orgId}, 'Anak uji', 2, true, 120, '{0}', '2026-10-01')`
    await owner`insert into guardian_link (org_id, guardian_id, learner_id) values (${orgId}, ${guardianId}, ${learnerId})`
  })

  afterAll(async () => {
    await owner`delete from org where id = ${orgId}`
    await Promise.all([owner.end(), end()])
  })

  it('orang tua tidak bisa mengubah learner_profile secara langsung', async () => {
    await expect(dbm.inOrg(ctx, (tx) => tx.execute(sql`update learner_profile set active = false where user_id = ${learnerId}`))).rejects.toThrow()
    expect(await active()).toBe(true)
  })

  it('transaksi gagal setelah permintaan: tidak ada permintaan dan learner tetap aktif', async () => {
    await expect(
      dbm.inOrg(ctx, async (tx) => {
        await privacy.requestDeletionTx(tx, ctx, { guardianId, learnerId, confirmName: 'Anak uji' })
        throw new Error('gagal setelah permintaan')
      }),
    ).rejects.toThrow('gagal setelah permintaan')
    expect(await openRequests()).toBe(0)
    expect(await active()).toBe(true)
  })

  it('permintaan tercatat: learner tidak aktif pada commit yang sama dan peran kembali ke orang tua', async () => {
    const roleAfter = await dbm.inOrg(ctx, async (tx) => {
      await privacy.requestDeletionTx(tx, ctx, { guardianId, learnerId, confirmName: 'Anak uji' })
      const rows = await tx.execute(sql`select current_setting('app.role') as role`)
      return (rows as unknown as { role: string }[])[0]!.role
    })
    expect(roleAfter).toBe('guardian')
    expect(await openRequests()).toBe(1)
    expect(await active()).toBe(false)
    const [audit] = await owner`select count(*)::int as n from audit_log where org_id = ${orgId} and action = 'deletion.requested' and actor_kind = 'guardian'`
    expect(audit!.n).toBe(1)
  })
})
