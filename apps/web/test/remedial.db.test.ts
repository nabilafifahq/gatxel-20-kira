import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Item } from '@kira/content'
import { createDb, withOrg, type Db, type OrgContext, type Tx } from '@kira/db/client'

/**
 * Putaran perbaikan di Latihan, di Postgres sungguhan: pelajaran dan soal serupa hanya setelah jawaban salah,
 * soal serupa tidak kembar dan tidak ikut skor, mode berwaktu menolak, dan soal serupa yang tetap salah masuk Fix-it.
 * Butuh DATABASE_URL_OWNER dan DATABASE_URL_APP dan migrasi sudah dijalankan.
 */

const ownerUrl = process.env.DATABASE_URL_OWNER
const appUrl = process.env.DATABASE_URL_APP
const ready = Boolean(ownerUrl && appUrl)
const WEDNESDAY = '2026-10-14'

describe.skipIf(!ready)('putaran perbaikan', () => {
  const owner = ready ? postgres(ownerUrl!, { max: 2, onnotice: () => {} }) : (null as never)
  const app = ready ? createDb(appUrl!, { name: 'remedial', max: 4 }) : (null as never)
  const orgId = randomUUID()
  const learnerId = randomUUID()
  const tutorId = randomUUID()
  const ctx: OrgContext = { orgId, userId: learnerId, role: 'learner' }
  let db: Db
  let m: {
    session: typeof import('@/server/dal/learner-session')
    core: typeof import('@/server/dal/learner-core')
    runner: typeof import('@/server/dal/learner-runner')
    remedial: typeof import('@/server/dal/remedial')
    mistakes: typeof import('@/server/dal/mistake-book')
    content: typeof import('@/server/dal/content')
  }
  const run = <T>(fn: (tx: Tx) => Promise<T>) => withOrg(db, ctx, fn)

  const right = (item: Item): unknown => {
    if (item.type === 'mcq') return { choice: item.answer }
    if (item.type === 'numeric') return { value: String(item.answer) }
    return null
  }
  const wrong = (item: Item): unknown => {
    if (item.type === 'mcq') return { choice: (item.answer + 1) % item.options.length }
    if (item.type === 'numeric') return { value: String(item.answer + 7) }
    return null
  }

  async function save(attemptId: string, position: number, answer: unknown, attemptNo = 1) {
    return run((tx) =>
      m.runner.saveAnswer(tx, ctx, learnerId, { attemptId, position, answer, hintsUsed: 0, attemptNo, timeMs: 6000, flagged: false, clientId: randomUUID(), answeredAt: new Date().toISOString() } as never),
    )
  }

  async function attemptOf(session: 'latihan' | 'tes') {
    const created = await run(async (tx) => m.session.ensureTodayQuests(tx, ctx, await m.core.loadLearner(tx, learnerId), WEDNESDAY))
    const q = created.find((x) => x.subject === 'math' && x.session === session)!
    return q.attemptId!
  }

  async function itemsOf(attemptId: string) {
    const rows = await owner`select items, mode from attempt where id = ${attemptId}`
    return rows[0]!.items as { ref: string; position: number; remedialOf?: number }[]
  }

  beforeAll(async () => {
    process.env.KIRA_ORIGIN = 'http://localhost:3100'
    process.env.DATABASE_URL_APP = appUrl!
    process.env.DATABASE_URL_AUTH = appUrl!
    process.env.KIRA_SECRET = 'uji-putaran-perbaikan-rahasia-minimal-32-karakter'
    process.env.KIRA_DATA_DIR = '.kira-local/data'
    db = app.db
    m = {
      session: await import('@/server/dal/learner-session'),
      core: await import('@/server/dal/learner-core'),
      runner: await import('@/server/dal/learner-runner'),
      remedial: await import('@/server/dal/remedial'),
      mistakes: await import('@/server/dal/mistake-book'),
      content: await import('@/server/dal/content'),
    }
    await owner`insert into org (id, name) values (${orgId}, 'Uji perbaikan __GTX_SEED__')`
    await owner`insert into member_profile (user_id, org_id, name, role, email) values (${tutorId}, ${orgId}, 'Tutor uji', 'tutor', 'uji-perbaikan@example.test')`
    await owner`insert into learner_profile (user_id, org_id, name, grade, active, screen_limit_min, rest_weekdays, started_on)
      values (${learnerId}, ${orgId}, 'Anak uji', 2, true, 120, '{0}', '2026-10-01')`
    await owner`insert into day_rules (learner_id, org_id, preset) values (${learnerId}, ${orgId}, 'penuh')`
  })

  afterAll(async () => {
    await owner`delete from org where id = ${orgId}`
    await Promise.all([owner.end(), app.client.end()])
  })

  it('menolak sebelum soal dijawab salah, dan menolak di mode berwaktu', async () => {
    const lat = await attemptOf('latihan')
    const items = await itemsOf(lat)
    const resolved = await run((tx) => m.content.resolveItems(tx, items.map((i) => i.ref)))
    const target = items.find((i) => ['mcq', 'numeric'].includes(resolved.get(i.ref)!.type))!
    await expect(run((tx) => m.remedial.remedialLesson(tx, learnerId, lat, target.position))).rejects.toThrow()
    await expect(run((tx) => m.remedial.walkthroughFor(tx, learnerId, lat, target.position))).rejects.toThrow()
    await save(lat, target.position, right(resolved.get(target.ref)!))
    const steps = await run((tx) => m.remedial.walkthroughFor(tx, learnerId, lat, target.position))
    expect(steps?.length ?? 0).toBeGreaterThan(1)
    await expect(run((tx) => m.remedial.addRemedialItem(tx, learnerId, orgId, lat, target.position))).rejects.toThrow()
    const tes = await attemptOf('tes')
    await expect(run((tx) => m.remedial.addRemedialItem(tx, learnerId, orgId, tes, 1))).rejects.toThrow()
    // Tes berwaktu yang masih berjalan tidak membuka pembahasan, bahkan sesudah soal dijawab.
    const tesItems = await itemsOf(tes)
    const tesResolved = await run((tx) => m.content.resolveItems(tx, tesItems.map((i) => i.ref)))
    const tesTarget = tesItems.find((i) => ['mcq', 'numeric'].includes(tesResolved.get(i.ref)!.type))
    if (tesTarget) await expect(run((tx) => m.remedial.walkthroughFor(tx, learnerId, tes, tesTarget.position))).rejects.toThrow()
  })

  it('setelah salah: pelajaran, satu soal serupa yang tidak kembar, tidak ikut skor, dan salah lagi masuk Fix-it', async () => {
    const lat = await attemptOf('latihan')
    const items = await itemsOf(lat)
    const resolved = await run((tx) => m.content.resolveItems(tx, items.map((i) => i.ref)))
    const candidates = items.filter((i) => ['mcq', 'numeric'].includes(resolved.get(i.ref)!.type))
    // Soal pertama sudah dijawab benar di tes sebelumnya; pakai soal kedua.
    const target = candidates[1] ?? candidates[0]!
    const wrongItem = resolved.get(target.ref)!
    await save(lat, target.position, wrong(wrongItem))

    const lesson = await run((tx) => m.remedial.remedialLesson(tx, learnerId, lat, target.position))
    if (lesson) {
      expect(lesson.steps.length).toBeGreaterThan(0)
      expect(lesson.steps.length).toBeLessThanOrEqual(3)
    }

    const sib = await run((tx) => m.remedial.addRemedialItem(tx, learnerId, orgId, lat, target.position))
    expect(sib).not.toBeNull()
    expect(sib!.remedialOf).toBe(target.position)
    expect(items.map((i) => i.ref)).not.toContain(sib!.ref)
    expect(sib!.key).toBeTruthy()
    const after = await itemsOf(lat)
    expect(after).toHaveLength(items.length + 1)
    // Memanggil lagi mengembalikan soal serupa yang sama, tidak menambah lagi.
    const again = await run((tx) => m.remedial.addRemedialItem(tx, learnerId, orgId, lat, target.position))
    expect(again!.ref).toBe(sib!.ref)
    expect(await itemsOf(lat)).toHaveLength(items.length + 1)
    // Soal serupa tidak punya putaran perbaikan sendiri.
    await expect(run((tx) => m.remedial.addRemedialItem(tx, learnerId, orgId, lat, sib!.position))).rejects.toThrow()

    // Jawab soal serupa salah dua kali (percobaan 1 dan 2), jawab sisanya benar, lalu kumpulkan.
    const sibItem = (await run((tx) => m.content.resolveItems(tx, [sib!.ref]))).get(sib!.ref)!
    await save(lat, sib!.position, wrong(sibItem), 1)
    await save(lat, sib!.position, wrong(sibItem), 2)
    for (const it of items) {
      const item = resolved.get(it.ref)!
      const a = it.position === target.position ? wrong(item) : right(item)
      if (a !== null && it.position !== target.position) await save(lat, it.position, a)
    }
    await run((tx) => m.runner.submitAttempt(tx, ctx, learnerId, lat))
    const row = (await owner`select score_max from attempt where id = ${lat}`)[0]!
    expect(Number(row.score_max)).toBe(items.length)
    const open = await run((tx) => m.mistakes.openMistakes(tx, learnerId))
    expect(open.map((o) => o.ref)).toContain(sib!.ref)
  })
})
