import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { jakartaDate } from '@kira/core'

/**
 * Saklar fitur per anak di Postgres sungguhan: bawaan semua menyala, contoh pemilik (hanya Science harian, Olimpiade
 * Science, English harian, dan Vocab) menghasilkan sesi English dan Science saja, mapel mati tidak punya sesi,
 * hitungan wajib dan streak ikut menyesuaikan, dan RLS membatasi anak lain.
 */

const ownerUrl = process.env.DATABASE_URL_OWNER
const appUrl = process.env.DATABASE_URL_APP
const ready = Boolean(ownerUrl && appUrl)

describe.skipIf(!ready)('saklar fitur', () => {
  const owner = ready ? postgres(ownerUrl!, { max: 2, onnotice: () => {} }) : (null as never)
  const orgId = randomUUID()
  const otherOrg = randomUUID()
  const tutorId = randomUUID()
  const learnerId = randomUUID()
  const today = jakartaDate()
  let feats: typeof import('@/server/dal/learner-features')
  let session: typeof import('@/server/dal/learner-session')
  let core: typeof import('@/server/dal/learner-core')
  let dbm: typeof import('@/server/db')
  let end: () => Promise<void>

  const lctx = { orgId, userId: learnerId, role: 'learner' as const }
  const tctx = { orgId, userId: tutorId, role: 'tutor' as const }
  const ensure = () => dbm.inOrg(lctx, async (tx) => session.ensureTodayQuests(tx, lctx, await core.loadLearner(tx, learnerId), today))
  const subjects = async () => [...new Set((await owner`select subject from quest where learner_id = ${learnerId} and date = ${today}`).map((r) => r.subject as string))].sort()
  const save = (map: Record<string, boolean>) => dbm.inOrg(tctx, (tx) => feats.saveFeaturesTx(tx, tctx, learnerId, map))

  beforeAll(async () => {
    process.env.KIRA_ORIGIN = 'http://localhost:3100'
    process.env.DATABASE_URL_APP = appUrl!
    process.env.DATABASE_URL_AUTH = appUrl!
    process.env.KIRA_SECRET = 'uji-saklar-fitur-rahasia-minimal-32-karakter'
    process.env.KIRA_DATA_DIR = '.kira-local/data'
    feats = await import('@/server/dal/learner-features')
    session = await import('@/server/dal/learner-session')
    core = await import('@/server/dal/learner-core')
    dbm = await import('@/server/db')
    end = () => (dbm.appDb() as unknown as { $client: { end(): Promise<void> } }).$client.end()
    await owner`insert into org (id, name) values (${orgId}, 'Uji saklar fitur __GTX_SEED__')`
    await owner`insert into org (id, name) values (${otherOrg}, 'Uji saklar org lain __GTX_SEED__')`
    await owner`insert into member_profile (user_id, org_id, name, role, email) values (${tutorId}, ${orgId}, 'Tutor uji', 'tutor', 'uji-saklar@example.test')`
    await owner`insert into learner_profile (user_id, org_id, name, grade, active, screen_limit_min, rest_weekdays, started_on)
      values (${learnerId}, ${orgId}, 'Anak saklar', 2, true, 120, '{}', ${today})`
  })

  afterAll(async () => {
    await owner`delete from org where id in (${orgId}, ${otherOrg})`
    await Promise.all([owner.end(), end()])
  })

  it('bawaan: semua fitur menyala dan sesi harian untuk tiga mapel', async () => {
    expect(await dbm.inOrg(lctx, (tx) => feats.isFeatureOnTx(tx, learnerId, 'math'))).toBe(true)
    await ensure()
    expect(await subjects()).toEqual(['english', 'math', 'science'])
  })

  it('contoh pemilik: Math mati, sesinya hilang dan hitungan wajib menyusut', async () => {
    const before = (await owner`select quests_required from day_record where learner_id = ${learnerId} and date = ${today}`)[0]!.quests_required as number
    const r = await save({ math: false, 'drill-math': false, 'mental-math': false, 'olympiad-math': false })
    expect(r.today).toBe(true)
    expect(r.removed).toBeGreaterThan(0)
    expect(await subjects()).toEqual(['english', 'science'])
    const after = (await owner`select quests_required from day_record where learner_id = ${learnerId} and date = ${today}`)[0]!.quests_required as number
    expect(after).toBeLessThan(before)
    expect(await dbm.inOrg(lctx, (tx) => feats.isFeatureOnTx(tx, learnerId, 'drill-math'))).toBe(false)
    expect(await dbm.inOrg(lctx, (tx) => feats.isFeatureOnTx(tx, learnerId, 'vocab'))).toBe(true)
    expect(await dbm.inOrg(lctx, (tx) => feats.isFeatureOnTx(tx, learnerId, 'olympiad-science'))).toBe(true)
  })

  it('menyalakan lagi mengembalikan sesi Math dan menghapus barisnya', async () => {
    await save({})
    expect(await subjects()).toEqual(['english', 'math', 'science'])
    expect((await owner`select count(*)::int as n from learner_feature where learner_id = ${learnerId}`)[0]!.n).toBe(0)
  })

  it('RLS: org lain tidak melihat saklar anak ini', async () => {
    await save({ paper: false })
    const other = { orgId: otherOrg, userId: randomUUID(), role: 'tutor' as const }
    const rows = await dbm.inOrg(other, (tx) => feats.featureMapFor(tx, learnerId))
    expect(rows).toEqual({})
    expect(await dbm.inOrg(lctx, (tx) => feats.featureMapFor(tx, learnerId))).toEqual({ paper: false })
  })

  it('Paper mati: tidak ada sesi paper hari ini', async () => {
    await ensure()
    expect((await owner`select count(*)::int as n from quest where learner_id = ${learnerId} and date = ${today} and session = 'paper'`)[0]!.n).toBe(0)
  })
})
