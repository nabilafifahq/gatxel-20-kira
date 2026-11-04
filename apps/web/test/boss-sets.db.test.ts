import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BOSS_LEVEL_QUESTIONS, BOSSES } from '@kira/core'

/** Setiap bos di setiap kelas bisa dimulai dengan jumlah soal yang tertulis di layar bos, juga saat klip suara belum ada. */
const ready = Boolean(process.env.DATABASE_URL_OWNER && process.env.DATABASE_URL_APP)

describe.skipIf(!ready)('jumlah soal bos', () => {
  const owner = ready ? postgres(process.env.DATABASE_URL_OWNER!, { max: 2, onnotice: () => {} }) : (null as never)
  const orgId = randomUUID()
  let dbm: typeof import('@/server/db')
  let world: typeof import('@/server/dal/kira-world')
  let end: () => Promise<void>

  beforeAll(async () => {
    process.env.KIRA_ORIGIN = 'http://localhost:3100'
    process.env.DATABASE_URL_APP = process.env.DATABASE_URL_APP!
    process.env.DATABASE_URL_AUTH = process.env.DATABASE_URL_AUTH ?? process.env.DATABASE_URL_APP!
    process.env.KIRA_SECRET = 'uji-jumlah-soal-bos-rahasia-minimal-32-karakter'
    process.env.KIRA_DATA_DIR = '.kira-local/data'
    dbm = await import('@/server/db')
    world = await import('@/server/dal/kira-world')
    end = () => (dbm.appDb() as unknown as { $client: { end(): Promise<void> } }).$client.end()
    await owner`insert into org (id, name) values (${orgId}, 'Uji soal bos __GTX_SEED__')`
  }, 120_000)

  afterAll(async () => {
    await owner`delete from auth.user_account where org_id = ${orgId}`
    await owner`delete from org where id = ${orgId}`
    await Promise.all([owner.end(), end()])
  })

  it.each([1, 2, 3, 4, 5, 6])('kelas %i', async (grade) => {
    const kid = randomUUID()
    await owner`insert into auth.user_account (id, org_id, kind, role, email, name) values (${kid}, ${orgId}, 'learner', 'learner', null, 'Anak')`
    await owner`insert into learner_profile (user_id, org_id, name, grade, active, screen_limit_min, rest_weekdays, started_on) values (${kid}, ${orgId}, 'Anak', ${grade}, true, 120, '{}', '2026-10-01')`
    // Semua lawan sudah datang.
    await owner`insert into day_record (org_id, learner_id, date, minutes, quests_done, quests_required)
      select ${orgId}, ${kid}, current_date - d, 10, 1, 1 from generate_series(1, 200) d`
    const ctx = { orgId, userId: kid, role: 'learner' as const }
    const short: string[] = []
    for (const b of BOSSES) {
      const want = BOSS_LEVEL_QUESTIONS[b.level]
      const got = await dbm
        .inOrg(ctx, (tx) => world.startBossSession(tx, ctx, kid, b.id))
        .then(async (id) => (await owner`select jsonb_array_length(items)::int as n from attempt where id = ${id}`)[0]!.n as number)
        .catch((e: Error) => e.message)
      if (got !== want) short.push(`${b.id}: ${String(got)} dari ${want}`)
    }
    expect(short).toEqual([])
  }, 120_000)
})
