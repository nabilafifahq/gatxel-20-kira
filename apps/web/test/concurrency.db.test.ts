import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import type { Item } from '@kira/content'
import { createDb, withOrg, type Db, type OrgContext, type Tx } from '@kira/db/client'

/**
 * Permintaan paralel pada data yang sama (kapasitas): jawaban yang sama disimpan dua kali, kumpul ganda, XP dan lencana
 * di bawah simpan paralel, peti harian dibuka dua kali, percobaan PIN paralel, dan pendaftaran paralel dengan satu email.
 * Setiap tes menjalankan transaksi sungguhan secara bersamaan lewat kumpulan koneksi yang berbeda.
 * Butuh DATABASE_URL_OWNER, DATABASE_URL_APP, DATABASE_URL_AUTH dan migrasi sudah dijalankan.
 */

const ownerUrl = process.env.DATABASE_URL_OWNER
const appUrl = process.env.DATABASE_URL_APP
const authUrl = process.env.DATABASE_URL_AUTH
const ready = Boolean(ownerUrl && appUrl && authUrl)
const WEDNESDAY = '2026-10-14'

describe.skipIf(!ready)('konkurensi', () => {
  const owner = ready ? postgres(ownerUrl!, { max: 4, onnotice: () => {} }) : (null as never)
  const app = ready ? createDb(appUrl!, { name: 'konkurensi', max: 16 }) : (null as never)
  const orgId = randomUUID()
  const learnerId = randomUUID()
  const tutorId = randomUUID()
  const ctx: OrgContext = { orgId, userId: learnerId, role: 'learner' }
  let db: Db
  let m: {
    session: typeof import('@/server/dal/learner-session')
    core: typeof import('@/server/dal/learner-core')
    runner: typeof import('@/server/dal/learner-runner')
    content: typeof import('@/server/dal/content')
    motion: typeof import('@/server/dal/learner-motion')
    pin: typeof import('@/server/auth/pin')
  }
  const run = <T>(fn: (tx: Tx) => Promise<T>) => withOrg(db, ctx, fn)

  function correct(item: Item): unknown | null {
    if (item.type === 'mcq' || item.type === 'listen') return { choice: item.answer }
    if (item.type === 'numeric') return { value: String(item.answer) }
    return null
  }

  /** Soal sebuah attempt yang bisa dijawab otomatis. */
  async function answerable(attemptId: string): Promise<{ position: number; answer: unknown }[]> {
    return run(async (tx) => {
      const [a] = await tx.execute<{ items: { ref: string; position: number }[] }>(sql`select items from attempt where id = ${attemptId}`)
      const resolved = await m.content.resolveItems(tx, a!.items.map((i) => i.ref))
      const out: { position: number; answer: unknown }[] = []
      for (const it of a!.items) {
        const item = resolved.get(it.ref)
        const ans = item ? correct(item) : null
        if (ans !== null) out.push({ position: it.position, answer: ans })
      }
      return out
    })
  }

  const payload = (attemptId: string, position: number, answer: unknown, clientId = randomUUID()) => ({
    attemptId,
    position,
    answer,
    hintsUsed: 0,
    attemptNo: 1,
    timeMs: 4000,
    flagged: false,
    clientId,
    answeredAt: new Date().toISOString(),
  })

  async function questAttempt(subject: string, session: string): Promise<string> {
    const rows = await owner`select attempt_id from quest where learner_id = ${learnerId} and date = ${WEDNESDAY} and subject = ${subject} and session = ${session} and kind = 'daily'`
    return rows[0]!.attempt_id as string
  }

  beforeAll(async () => {
    process.env.KIRA_ORIGIN = 'http://localhost:3100'
    process.env.DATABASE_URL_APP = appUrl!
    process.env.DATABASE_URL_AUTH = authUrl!
    process.env.KIRA_SECRET = 'uji-konkurensi-rahasia-minimal-32-karakter'
    process.env.KIRA_DATA_DIR = '.kira-local/data'
    db = app.db
    m = {
      session: await import('@/server/dal/learner-session'),
      core: await import('@/server/dal/learner-core'),
      runner: await import('@/server/dal/learner-runner'),
      content: await import('@/server/dal/content'),
      motion: await import('@/server/dal/learner-motion'),
      pin: await import('@/server/auth/pin'),
    }
    await owner`insert into org (id, name) values (${orgId}, 'Uji konkurensi __GTX_SEED__')`
    await owner`insert into auth.user_account (id, org_id, kind, role, name) values (${learnerId}, ${orgId}, 'learner', 'learner', 'Anak konkurensi')`
    await owner`insert into member_profile (user_id, org_id, name, role, email) values (${tutorId}, ${orgId}, 'Tutor uji', 'tutor', 'konkurensi@example.test')`
    await owner`insert into learner_profile (user_id, org_id, name, grade, active, screen_limit_min, rest_weekdays, started_on)
      values (${learnerId}, ${orgId}, 'Anak konkurensi', 2, true, 120, '{0}', '2026-10-01')`
    await run(async (tx) => m.session.ensureTodayQuests(tx, ctx, await m.core.loadLearner(tx, learnerId), WEDNESDAY))
  })

  afterAll(async () => {
    await owner`delete from org where id = ${orgId}`
    await owner`delete from auth.user_account where org_id = ${orgId}`
    await Promise.all([owner.end(), app.client.end()])
  })

  it('jawaban yang sama disimpan dua kali bersamaan: satu baris dan satu XP', async () => {
    const attemptId = await questAttempt('math', 'latihan')
    const [first] = await answerable(attemptId)
    expect(first).toBeDefined()
    const same = randomUUID()
    const results = await Promise.all(Array.from({ length: 6 }, () => run((tx) => m.runner.saveAnswer(tx, ctx, learnerId, payload(attemptId, first!.position, first!.answer, same)))))
    expect(results.every((r) => r.status === 'correct' || r.status === 'wrong' || r.status === 'answered')).toBe(true)
    const { n } = (await owner`select count(*)::int as n from response where attempt_id = ${attemptId} and position = ${first!.position}`)[0]!
    expect(n).toBe(1)
    // clientId berbeda untuk soal yang sama dan percobaan yang sama: tetap satu baris.
    await Promise.all(Array.from({ length: 6 }, () => run((tx) => m.runner.saveAnswer(tx, ctx, learnerId, payload(attemptId, first!.position, first!.answer)))))
    const { n: n2 } = (await owner`select count(*)::int as n from response where attempt_id = ${attemptId} and position = ${first!.position}`)[0]!
    expect(n2).toBe(1)
    const { xp } = (await owner`select coalesce(sum(amount),0)::int as xp from xp_event where learner_id = ${learnerId} and ref = ${attemptId}`)[0]!
    const { rxp } = (await owner`select coalesce(sum(xp),0)::int as rxp from response where attempt_id = ${attemptId}`)[0]!
    expect(xp).toBe(rxp)
  })

  it('simpan paralel satu sesi: tidak ada pembaruan hilang pada penguasaan skill dan XP', async () => {
    const attemptId = await questAttempt('math', 'latihan')
    const items = await answerable(attemptId)
    await Promise.all(items.map((it) => run((tx) => m.runner.saveAnswer(tx, ctx, learnerId, payload(attemptId, it.position, it.answer)))))
    const resp = await owner`select skill_id, status from response where attempt_id = ${attemptId} and attempt_no = 1 and status in ('correct','wrong')`
    const bySkill = new Map<string, number>()
    for (const r of resp) bySkill.set(r.skill_id as string, (bySkill.get(r.skill_id as string) ?? 0) + 1)
    for (const [skill, count] of bySkill) {
      const [st] = await owner`select n_answers from skill_state where learner_id = ${learnerId} and skill_id = ${skill}`
      expect(st!.n_answers, skill).toBe(count)
    }
    const { xp } = (await owner`select coalesce(sum(amount),0)::int as xp from xp_event where learner_id = ${learnerId} and ref = ${attemptId}`)[0]!
    const { rxp } = (await owner`select coalesce(sum(xp),0)::int as rxp from response where attempt_id = ${attemptId}`)[0]!
    expect(xp).toBe(rxp)
  })

  it('kumpul ganda bersamaan: XP, lencana, dan sesi selesai hanya sekali', async () => {
    const paralel = await questAttempt('english', 'latihan')
    const urut = await questAttempt('science', 'latihan')
    for (const id of [paralel, urut]) {
      for (const it of await answerable(id)) await run((tx) => m.runner.saveAnswer(tx, ctx, learnerId, payload(id, it.position, it.answer)))
    }
    const shape = async (id: string) => {
      // Peristiwa XP selain per jawaban (bonus sesi) harus sama dengan kumpul tunggal; XP jawaban harus sama dengan XP di baris response.
      const rows = await owner`select reason, count(*)::int as n, coalesce(sum(amount),0)::int as total from xp_event where learner_id = ${learnerId} and ref = ${id} and reason <> 'answer' group by reason order by reason`
      const { a, r } = (await owner`select (select coalesce(sum(amount),0)::int from xp_event where learner_id = ${learnerId} and ref = ${id} and reason = 'answer') as a, (select coalesce(sum(xp),0)::int from response where attempt_id = ${id}) as r`)[0]!
      expect(a).toBe(r)
      return rows.map((x) => `${x.reason}:${x.n}:${x.total}`)
    }
    await run((tx) => m.runner.submitAttempt(tx, ctx, learnerId, urut))
    const settled = await Promise.allSettled(Array.from({ length: 4 }, () => run((tx) => m.runner.submitAttempt(tx, ctx, learnerId, paralel))))
    expect(settled.every((s) => s.status === 'fulfilled')).toBe(true)
    expect(await shape(paralel)).toEqual(await shape(urut))
    const { n } = (await owner`select count(*)::int as n from quest where learner_id = ${learnerId} and date = ${WEDNESDAY} and status = 'done'`)[0]!
    expect(n).toBe(2)
    const badges = await owner`select badge_id, count(*)::int as n from badge_award where learner_id = ${learnerId} group by badge_id`
    expect(badges.every((b) => b.n === 1)).toBe(true)
  })

  it('peti harian dibuka bersamaan: hanya satu yang berhasil', async () => {
    const today = { variant: 'all-done', progress: { done: 9, total: 9, extraDone: 0, extraTotal: 0 } } as never
    const settled = await Promise.allSettled(Array.from({ length: 6 }, () => run((tx) => m.motion.openChestTx(tx, orgId, learnerId, today, WEDNESDAY))))
    expect(settled.filter((s) => s.status === 'fulfilled')).toHaveLength(1)
    const { n } = (await owner`select count(*)::int as n from daily_chest where learner_id = ${learnerId} and date = ${WEDNESDAY}`)[0]!
    expect(n).toBe(1)
  })

  it('percobaan PIN paralel: paling banyak 5 pemeriksaan sebelum terkunci, PIN benar pun ditolak setelah itu', async () => {
    const pinUser = randomUUID()
    await owner`insert into auth.user_account (id, org_id, kind, role, name) values (${pinUser}, ${orgId}, 'learner', 'learner', 'Anak PIN')`
    await m.pin.setPin(pinUser, ['sun', 'moon', 'star', 'cat'])
    const results = await Promise.all(Array.from({ length: 24 }, () => m.pin.checkPin(pinUser, ['tree', 'apple', 'boat', 'ball'])))
    const wrong = results.filter((r) => !r.ok && r.reason === 'wrong').length
    const locked = results.filter((r) => !r.ok && r.reason === 'locked').length
    expect(results.some((r) => r.ok)).toBe(false)
    expect(wrong).toBeLessThanOrEqual(m.pin.PIN_MAX_FAILS)
    expect(wrong + locked).toBe(24)
    const good = await m.pin.checkPin(pinUser, ['sun', 'moon', 'star', 'cat'])
    expect(good.ok).toBe(false)
  })

  it('pendaftaran paralel dengan satu email: tepat satu akun', async () => {
    const email = `Sama-${randomUUID()}@Example.test`
    const attempts = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((x, i) =>
      owner`insert into auth.user_account (id, org_id, kind, role, email, name) values (${randomUUID()}, ${orgId}, 'adult', 'guardian', ${i % 2 ? email.toLowerCase() : email}, ${'Wali ' + x})`.then(
        () => 'ok',
        () => 'dup',
      ),
    )
    const res = await Promise.all(attempts)
    expect(res.filter((r) => r === 'ok')).toHaveLength(1)
  })
})
