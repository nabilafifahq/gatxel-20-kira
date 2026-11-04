import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadContent } from '@kira/content/load'
import { manipulativeAnswer } from '@kira/content/manip-solve'
import { createDb, withOrg, type Db, type OrgContext, type Tx } from '@kira/db/client'

/**
 * Alat peraga di Postgres sungguhan: soal berjenis blocks, fractionbar, barmodel, tangram, dan geoboard
 * dinilai di server, kunci tidak ikut ke perangkat di mode Tes, dan jawaban dengan bentuk salah ditolak.
 * Butuh DATABASE_URL_OWNER dan DATABASE_URL_APP (lihat scripts/dev-db.sh env) dan migrasi sudah dijalankan.
 */

const ownerUrl = process.env.DATABASE_URL_OWNER
const appUrl = process.env.DATABASE_URL_APP
const ready = Boolean(ownerUrl && appUrl)

describe.skipIf(!ready)('alat peraga di server', () => {
  const owner = ready ? postgres(ownerUrl!, { max: 2, onnotice: () => {} }) : (null as never)
  const app = ready ? createDb(appUrl!, { name: 'peraga', max: 4 }) : (null as never)
  const orgId = randomUUID()
  const learnerId = randomUUID()
  const ctx: OrgContext = { orgId, userId: learnerId, role: 'learner' }
  let db: Db
  let runner: typeof import('@/server/dal/learner-runner')
  const run = <T>(fn: (tx: Tx) => Promise<T>) => withOrg(db, ctx, fn)

  const { index } = loadContent()
  const picks = ['blocks', 'fractionbar', 'barmodel', 'tangram', 'geoboard'].map((t) => [...index.items.values()].find((i) => i.type === t)!)
  let attemptId = ''

  beforeAll(async () => {
    process.env.KIRA_ORIGIN = 'http://localhost:3100'
    process.env.DATABASE_URL_APP = appUrl!
    process.env.DATABASE_URL_AUTH = appUrl!
    process.env.KIRA_SECRET = 'uji-alat-peraga-rahasia-minimal-32-karakter'
    process.env.KIRA_DATA_DIR = '.kira-local/data'
    db = app.db
    runner = await import('@/server/dal/learner-runner')
    await owner`insert into org (id, name) values (${orgId}, 'Uji alat peraga __GTX_SEED__')`
    await owner`insert into learner_profile (user_id, org_id, name, grade, active, screen_limit_min, rest_weekdays, started_on)
      values (${learnerId}, ${orgId}, 'Anak uji', 3, true, 120, '{0}', '2026-10-01')`
    const items = picks.map((it, i) => ({ ref: it.id, section: 'core', position: i + 1, difficulty: it.difficulty }))
    const rows = await owner`
      insert into attempt (org_id, learner_id, kind, mode, subject, title, items, time_limit_s)
      values (${orgId}, ${learnerId}, 'test', 'tes', 'math', 'Uji alat peraga', ${owner.json(items)}, 900)
      returning id`
    attemptId = rows[0]!.id as string
  })

  afterAll(async () => {
    await owner`delete from org where id = ${orgId}`
    await Promise.all([owner.end(), app.client.end()])
  })

  const save = (position: number, answer: unknown) =>
    run((tx) =>
      runner.saveAnswer(tx, ctx, learnerId, { attemptId, position, answer, hintsUsed: 0, attemptNo: 1, timeMs: 3000, flagged: false, clientId: randomUUID(), answeredAt: new Date().toISOString() }),
    )

  it('mode Tes tidak mengirim kunci, target, aturan, contoh, atau pembahasan ke perangkat', async () => {
    const dto = await run((tx) => runner.runnerDTO(tx, learnerId, attemptId))
    expect('items' in dto).toBe(true)
    const json = JSON.stringify(dto)
    for (const secret of ['"key"', '"target"', '"targets"', '"rule"', '"example"', '"unitValue"', '"explanation"', '"reveal"', '"hints"']) expect(json, secret).not.toContain(secret)
    if ('items' in dto) expect(dto.items.map((i) => i.type)).toEqual(['blocks', 'fractionbar', 'barmodel', 'tangram', 'geoboard'])
  })

  it('jawaban dengan bentuk salah ditolak', async () => {
    await expect(save(1, { blocks: { h: 'x', t: 1, o: 1 } })).rejects.toThrow()
    await expect(save(2, { bars: [{ den: 99, shaded: 1 }] })).rejects.toThrow()
    await expect(save(3, { model: { bars: [] } })).rejects.toThrow()
    await expect(save(4, { placed: [[0, 9, 0]] })).rejects.toThrow()
    await expect(save(5, { pegs: [[0, 0], [99, 99], [1, 1]], closed: true })).rejects.toThrow()
  })

  it('jawaban benar dinilai benar di server setelah dikumpulkan, dan jawaban salah dinilai salah', async () => {
    for (const [i, it] of picks.entries()) {
      const answer = manipulativeAnswer(it)
      expect(answer, it.id).not.toBeNull()
      // Soal terakhir sengaja dijawab salah: papan geoboard berisi segitiga kecil yang tidak memenuhi aturan.
      const given = it.type === 'geoboard' ? { pegs: [[0, 0], [1, 0], [0, 1], [1, 1]], closed: true } : answer
      await save(i + 1, given)
    }
    await run((tx) => runner.submitAttempt(tx, ctx, learnerId, attemptId))
    const rows = await owner`select position, status from response where attempt_id = ${attemptId} order by position`
    expect(rows.map((r) => r.status)).toEqual(['correct', 'correct', 'correct', 'correct', 'wrong'])
  })
})
