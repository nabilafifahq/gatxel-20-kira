import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { jakartaDate } from '@kira/core'

/**
 * Dua keputusan dari uji tembus: sesi dihitung untuk streak bila paling sedikit separuh soalnya dijawab, dan setelah batas
 * layar sesi baru tidak dimulai, sedangkan sesi yang sudah berjalan boleh diselesaikan.
 */
const ownerUrl = process.env.DATABASE_URL_OWNER
const appUrl = process.env.DATABASE_URL_APP
const authUrl = process.env.DATABASE_URL_AUTH
const ready = Boolean(ownerUrl && appUrl && authUrl)

describe.skipIf(!ready)('sesi dihitung dan batas layar', () => {
  const owner = ready ? postgres(ownerUrl!, { max: 4, onnotice: () => {} }) : (null as never)
  const orgId = randomUUID()
  const guardianId = randomUUID()
  const kid = randomUUID()
  const today = jakartaDate()
  const ctx = { orgId, userId: kid, role: 'learner' as const }
  let dbm: typeof import('@/server/db')
  let runner: typeof import('@/server/dal/learner-runner')
  let results: typeof import('@/server/dal/learner-results')
  let session: typeof import('@/server/dal/learner-session')
  let core: typeof import('@/server/dal/learner-core')
  let end: () => Promise<void>

  const inKid = <T>(fn: (tx: import('@/server/db').Tx) => Promise<T>) => dbm.inOrg(ctx, fn)
  const ensureToday = () => inKid(async (tx) => session.ensureTodayQuests(tx, ctx, await core.loadLearner(tx, kid), today))
  let questId = ''
  const latihan = async () => (await owner`select id, attempt_id, status from quest where id = ${questId}`)[0]!
  const pickLatihan = async () => (await owner`select id from quest where learner_id = ${kid} and date = ${today} and kind = 'daily' and session = 'latihan' order by id limit 1`)[0]!.id as string
  const answer = async (attemptId: string, positions: number[]) => {
    for (const position of positions) {
      await owner`insert into response (org_id, learner_id, attempt_id, position, item_ref, skill_id, subject, item_type, difficulty, status, answer, attempt_no, client_id)
        select ${orgId}, ${kid}, ${attemptId}, ${position}, it->>'ref', 'uji', 'math', 'mcq', 1, 'wrong', '{}'::jsonb, 1, ${randomUUID()}
        from attempt a, jsonb_array_elements(a.items) it where a.id = ${attemptId} and (it->>'position')::int = ${position}`
    }
  }
  const sizeOf = async (attemptId: string) => (await owner`select jsonb_array_length(items)::int as n from attempt where id = ${attemptId}`)[0]!.n as number
  const dayDone = async () => (await owner`select coalesce(sum(quests_done), 0)::int as n from day_record where learner_id = ${kid} and date = ${today}`)[0]!.n as number
  const questXp = async () => (await owner`select count(*)::int as n from xp_event where learner_id = ${kid} and reason = 'quest'`)[0]!.n as number

  beforeAll(async () => {
    process.env.KIRA_ORIGIN = 'http://localhost:3100'
    process.env.DATABASE_URL_APP = appUrl!
    process.env.DATABASE_URL_AUTH = authUrl!
    process.env.KIRA_SECRET = 'uji-sesi-dihitung-rahasia-minimal-32-karakter'
    process.env.KIRA_DATA_DIR = '.kira-local/data'
    delete process.env.KIRA_VALKEY_URL
    dbm = await import('@/server/db')
    runner = await import('@/server/dal/learner-runner')
    results = await import('@/server/dal/learner-results')
    session = await import('@/server/dal/learner-session')
    core = await import('@/server/dal/learner-core')
    end = () => (dbm.appDb() as unknown as { $client: { end(): Promise<void> } }).$client.end()
    await owner`insert into org (id, name) values (${orgId}, 'Uji sesi __GTX_SEED__')`
    await owner`insert into member_profile (user_id, org_id, name, role, email) values (${guardianId}, ${orgId}, 'Ibu', 'guardian', ${`${guardianId}@example.test`})`
    await owner`insert into auth.user_account (id, org_id, kind, role, email, name) values (${kid}, ${orgId}, 'learner', 'learner', null, 'Anak sesi')`
    await owner`insert into learner_profile (user_id, org_id, name, grade, active, screen_limit_min, rest_weekdays, started_on) values (${kid}, ${orgId}, 'Anak sesi', 2, true, 120, '{}', '2026-10-01')`
    await owner`insert into guardian_link (org_id, guardian_id, learner_id) values (${orgId}, ${guardianId}, ${kid})`
  }, 120_000)

  afterAll(async () => {
    await owner`delete from org where id = ${orgId}`
    await owner`delete from auth.user_account where org_id = ${orgId}`
    await Promise.all([owner.end(), end()])
  })

  it('kurang dari separuh dijawab: sesi tetap terbuka dengan soal baru, tanpa streak dan XP selesai, hasil menyebut yang dibutuhkan', async () => {
    await ensureToday()
    questId = await pickLatihan()
    const first = await latihan()
    const id = first.attempt_id as string
    const n = await sizeOf(id)
    const need = Math.ceil(n / 2)
    await answer(id, Array.from({ length: need - 1 }, (_, i) => i + 1))
    await inKid((tx) => runner.submitAttempt(tx, ctx, kid, id))

    const after = await latihan()
    expect(after).toMatchObject({ status: 'ready', attempt_id: null })
    expect(await dayDone()).toBe(0)
    expect(await questXp()).toBe(0)
    const dto = await inKid((tx) => results.resultsDTO(tx, kid, id))
    expect(dto).toMatchObject({ notCounted: { answered: need - 1, need, total: n } })

    await ensureToday()
    const again = await latihan()
    expect(again.attempt_id).not.toBeNull()
    expect(again.attempt_id).not.toBe(id)
  }, 120_000)

  it('tepat separuh dijawab: sesi selesai dan dihitung', async () => {
    const q = await latihan()
    const id = q.attempt_id as string
    const n = await sizeOf(id)
    await answer(id, Array.from({ length: Math.ceil(n / 2) }, (_, i) => i + 1))
    await inKid((tx) => runner.submitAttempt(tx, ctx, kid, id))
    expect((await latihan()).status).toBe('done')
    expect(await dayDone()).toBe(1)
    expect(await questXp()).toBe(1)
    const dto = await inKid((tx) => results.resultsDTO(tx, kid, id))
    expect(dto).not.toHaveProperty('notCounted')
  }, 120_000)

  it('setelah batas layar: sesi baru ditolak, sesi yang sudah berjalan boleh selesai', async () => {
    const newAttempt = async () =>
      (await owner`insert into attempt (org_id, learner_id, kind, mode, subject, title, items)
        values (${orgId}, ${kid}, 'test', 'latihan', 'math', 'Uji batas', ${owner.json([{ ref: 'm2.addition.001', section: 'core', position: 1, difficulty: 1 }])}) returning id`)[0]!.id as string
    const open = (id: string) => inKid((tx) => runner.runnerDTO(tx, kid, id, { markOpened: true }))

    const before = await newAttempt()
    expect(await open(before)).toHaveProperty('items')

    await owner`update learner_profile set screen_limit_min = 30 where user_id = ${kid}`
    await owner`insert into day_record (org_id, learner_id, date, minutes) values (${orgId}, ${kid}, ${today}, 30)
      on conflict (learner_id, date) do update set minutes = 30`

    const fresh = await newAttempt()
    expect(await open(fresh)).toEqual({ limit: true })
    const [row] = await owner`select opened_at from attempt where id = ${fresh}`
    expect(row!.opened_at).toBeNull()

    // Sudah terbuka sebelum batas tercapai.
    expect(await open(before)).toHaveProperty('items')
    // Belum tercatat terbuka tetapi sudah ada jawaban, misalnya dari mode luring.
    const offline = await newAttempt()
    await answer(offline, [1])
    expect(await open(offline)).toHaveProperty('items')
  }, 120_000)
})
