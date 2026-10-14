import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { addDays, type IsoDate } from '@kira/core'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * Tes DB untuk celah gelombang 2 (taper program, retensi arena, pickDailyPaper dalam transaksi pemanggil).
 * Butuh DATABASE_URL_OWNER dan DATABASE_URL_APP dan migrasi sudah dijalankan. Tanpa itu berkas dilewati.
 */
const ready = Boolean(process.env.DATABASE_URL_OWNER && process.env.DATABASE_URL_APP)

describe.skipIf(!ready)('celah gelombang 2 di Postgres', () => {
  const owner = ready ? postgres(process.env.DATABASE_URL_OWNER!, { max: 2, onnotice: () => {} }) : (null as never)
  const orgId = randomUUID()
  const tutorId = randomUUID()
  const learnerId = randomUUID()
  let dataDir = ''
  let dal: {
    inOrg: typeof import('@/server/db').inOrg
    daily: typeof import('@/server/dal/daily-paper')
  }

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'kira-lengkap-db-'))
    process.env.KIRA_ORIGIN ??= 'http://localhost:3199'
    process.env.KIRA_SECRET ??= 'x'.repeat(40)
    process.env.DATABASE_URL_AUTH ??= process.env.DATABASE_URL_APP!
    process.env.KIRA_DATA_DIR = dataDir
    dal = { inOrg: (await import('@/server/db')).inOrg, daily: await import('@/server/dal/daily-paper') }
    await owner`insert into org (id, name) values (${orgId}, 'Org LK __GTX_SEED__')`
    await owner`insert into member_profile (user_id, org_id, name, role, email) values (${tutorId}, ${orgId}, 'Tutor LK', 'tutor', 'tutor-lk-dal@example.test')`
    await owner`insert into learner_profile (user_id, org_id, name, grade, active) values (${learnerId}, ${orgId}, 'Anak LK', 2, true)`
  })

  afterAll(async () => {
    await owner`delete from org where id = ${orgId}`
    await owner.end()
    await (globalThis as unknown as { __kiraPools?: { closeAll: () => Promise<void> } }).__kiraPools?.closeAll()
    await rm(dataDir, { recursive: true, force: true })
  })

  const asLearner = { orgId, userId: learnerId, role: 'learner' as const }

  it('taperSubjects: hanya hari ringan di akhir program aktif yang dikenali', async () => {
    const { loadPrograms } = await import('@kira/content/extras')
    const { findContentDir } = await import('@kira/content/load')
    const prog = loadPrograms(findContentDir()).programs.find((p) => p.id === 'olimpiade-math-g2')!
    const start = '2027-03-01' as IsoDate
    await owner`insert into program_run (org_id, learner_id, program_id, start_date, end_date, created_by)
      values (${orgId}, ${learnerId}, ${prog.id}, ${start}, ${addDays(start, prog.weeks * 7 - 1)}, ${tutorId})`
    const lastDay = addDays(start, prog.weeks * 7 - 1)
    const beforeTaper = addDays(start, prog.weeks * 7 - prog.taper.days - 1)
    expect([...(await dal.inOrg(asLearner, (tx) => dal.daily.taperSubjects(tx, learnerId, lastDay)))]).toEqual(['math'])
    expect((await dal.inOrg(asLearner, (tx) => dal.daily.taperSubjects(tx, learnerId, beforeTaper))).size).toBe(0)
    expect((await dal.inOrg(asLearner, (tx) => dal.daily.taperSubjects(tx, learnerId, addDays(lastDay, 3)))).size).toBe(0)
  })
})
