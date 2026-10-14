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
    week: typeof import('@/server/dal/arena-week')
    state: typeof import('@/server/dal/arena-state')
  }

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'kira-lengkap-db-'))
    process.env.KIRA_ORIGIN ??= 'http://localhost:3199'
    process.env.KIRA_SECRET ??= 'x'.repeat(40)
    process.env.DATABASE_URL_AUTH ??= process.env.DATABASE_URL_APP!
    process.env.KIRA_DATA_DIR = dataDir
    dal = { inOrg: (await import('@/server/db')).inOrg, daily: await import('@/server/dal/daily-paper'),
      week: await import('@/server/dal/arena-week'),
      state: await import('@/server/dal/arena-state'),
    }
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

  it('arenaWeekDTO: rekor sprint minggu itu dan jumlah ronde; loadRolled membaca ringkasan retensi', async () => {
    const monday = '2027-05-03' as IsoDate
    expect(await dal.inOrg(asLearner, (tx) => dal.week.arenaWeekDTO(tx, learnerId, monday, addDays(monday, 6)))).toBeNull()
    await owner`insert into arena_session (org_id, learner_id, arena, mode, seed, config, date, finished_at, total, answered, correct, duration_ms, ppm) values
      (${orgId}, ${learnerId}, 'hitung', 'sprint60', 'w1', '{}', ${monday}, now(), 20, 20, 19, 60000, 19),
      (${orgId}, ${learnerId}, 'hitung', 'sprint60', 'w2', '{}', ${addDays(monday, 2)}, now(), 20, 10, 5, 60000, 25),
      (${orgId}, ${learnerId}, 'hitung', 'sprint60', 'w3', '{}', ${addDays(monday, 9)}, now(), 20, 20, 20, 60000, 30),
      (${orgId}, ${learnerId}, 'pengetahuan', 'quiz', 'w4', '{}', ${addDays(monday, 1)}, now(), 10, 10, 8, 50000, null)`
    const w = await dal.inOrg(asLearner, (tx) => dal.week.arenaWeekDTO(tx, learnerId, monday, addDays(monday, 6)))
    expect(w).toMatchObject({ qmRounds: 2, qmBestPpm: 19, quizRounds: 1 })
    await owner`insert into arena_state (org_id, learner_id, arena, data, rolled) values (${orgId}, ${learnerId}, 'hitung', '{}', ${owner.json({ rounds: 7, bestSprintPpm: 22 })})`
    const rolled = await dal.inOrg(asLearner, (tx) => dal.state.loadRolled(tx, learnerId, 'hitung'))
    expect(rolled).toMatchObject({ rounds: 7, bestSprintPpm: 22, perfectSprint: false })
  })

  it('pickDailyPaper berjalan di transaksi pemanggil: dibatalkan bersama transaksinya, dan berhasil bila dikomit', async () => {
    const c = { orgId, learnerId, grade: 2 }
    const day = '2027-06-02'
    const count = async () => (await owner`select count(*)::int as n from paper_pick where learner_id = ${learnerId} and date = ${day}`)[0]!.n
    await expect(
      dal.inOrg(asLearner, async (tx) => {
        const p = await dal.daily.pickDailyPaper(tx, c, 'math', day, 'mini')
        expect(p).not.toBeNull()
        // Di dalam transaksi pilihan sudah terbaca, tetapi belum terlihat dari luar.
        expect(await count()).toBe(0)
        throw new Error('batalkan')
      }),
    ).rejects.toThrow('batalkan')
    expect(await count()).toBe(0)
    const kept = await dal.inOrg(asLearner, (tx) => dal.daily.pickDailyPaper(tx, c, 'math', day, 'mini'))
    expect(await count()).toBe(1)
    expect(await dal.inOrg(asLearner, (tx) => dal.daily.pickDailyPaper(tx, c, 'math', day, 'mini'))).toEqual(kept)
  })
})
