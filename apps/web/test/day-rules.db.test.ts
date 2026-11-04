import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { jakartaDate } from '@kira/core'

/**
 * Aturan hari per learner di Postgres sungguhan: bawaan Seimbang, preset, perubahan hari ini (sesi belum dimulai
 * berubah langsung, sesi yang sudah dimulai tetap), streak hanya menghitung sesi wajib, hari tanpa sesi wajib
 * netral, dan atur ulang streak. Tidak bergantung pada hari pelaksanaan: tidak ada hari istirahat.
 */

const ownerUrl = process.env.DATABASE_URL_OWNER
const appUrl = process.env.DATABASE_URL_APP
const ready = Boolean(ownerUrl && appUrl)

describe.skipIf(!ready)('aturan hari', () => {
  const owner = ready ? postgres(ownerUrl!, { max: 2, onnotice: () => {} }) : (null as never)
  const orgId = randomUUID()
  const tutorId = randomUUID()
  const learnerId = randomUUID()
  const today = jakartaDate()
  let rules: typeof import('@/server/dal/console-day-rules')
  let planner: typeof import('@/server/dal/console-planner')
  let session: typeof import('@/server/dal/learner-session')
  let core: typeof import('@/server/dal/learner-core')
  let dbm: typeof import('@/server/db')
  let end: () => Promise<void>

  const actor = () => ({ sessionId: randomUUID(), userId: tutorId, orgId, kind: 'adult' as const, role: 'tutor' as const, name: 'Tutor uji', email: 'uji-aturan@example.test', deviceId: null, createdAt: new Date() })
  const lctx = { orgId, userId: learnerId, role: 'learner' as const }
  const ensure = () => dbm.inOrg(lctx, async (tx) => session.ensureTodayQuests(tx, lctx, await core.loadLearner(tx, learnerId), today))
  const quests = () => owner`select id, subject, session, kind, status, attempt_id from quest where learner_id = ${learnerId} and date = ${today} order by subject, session, kind`
  const record = async () => (await owner`select quests_done, quests_required from day_record where learner_id = ${learnerId} and date = ${today}`)[0]

  beforeAll(async () => {
    process.env.KIRA_ORIGIN = 'http://localhost:3100'
    process.env.DATABASE_URL_APP = appUrl!
    process.env.DATABASE_URL_AUTH = appUrl!
    process.env.KIRA_SECRET = 'uji-aturan-hari-rahasia-minimal-32-karakter'
    process.env.KIRA_DATA_DIR = '.kira-local/data'
    rules = await import('@/server/dal/console-day-rules')
    planner = await import('@/server/dal/console-planner')
    session = await import('@/server/dal/learner-session')
    core = await import('@/server/dal/learner-core')
    dbm = await import('@/server/db')
    end = () => (dbm.appDb() as unknown as { $client: { end(): Promise<void> } }).$client.end()
    await owner`insert into org (id, name) values (${orgId}, 'Uji aturan hari __GTX_SEED__')`
    await owner`insert into member_profile (user_id, org_id, name, role, email) values (${tutorId}, ${orgId}, 'Tutor uji', 'tutor', 'uji-aturan@example.test')`
    // Tanpa baris day_rules: learner baru memakai Seimbang.
    await owner`insert into learner_profile (user_id, org_id, name, grade, active, screen_limit_min, rest_weekdays, started_on)
      values (${learnerId}, ${orgId}, 'Anak aturan', 2, true, 120, '{}', ${today})`
  })

  afterAll(async () => {
    await owner`delete from org where id = ${orgId}`
    await Promise.all([owner.end(), end()])
  })

  it('bawaan Seimbang: 9 sesi, hanya 3 Latihan wajib', async () => {
    const day = await ensure()
    expect(day).toHaveLength(9)
    const req = day.filter((q) => q.kind === 'daily')
    expect(req.map((q) => q.session)).toEqual(['latihan', 'latihan', 'latihan'])
    expect(day.filter((q) => q.kind === 'extra')).toHaveLength(6)
    expect(await record()).toMatchObject({ quests_required: 3, quests_done: 0 })
  })

  it('Penuh hari ini: 6 sesi opsional menjadi wajib saat itu juga, tanpa membuat ulang yang sudah ada', async () => {
    const before = new Set((await quests()).map((q) => q.id))
    const r = await rules.saveDayRules(actor(), { learnerId, preset: 'penuh', rules: null })
    expect(r.today).toBe(true)
    const after = await quests()
    expect(after.filter((q) => q.kind === 'daily')).toHaveLength(9)
    expect(after.every((q) => before.has(q.id))).toBe(true)
    expect(await record()).toMatchObject({ quests_required: 9 })
  })

  it('Ringan hari ini: Tes dan Paper yang belum dimulai dihapus', async () => {
    const r = await rules.saveDayRules(actor(), { learnerId, preset: 'ringan', rules: null })
    expect(r.removed).toBe(6)
    const after = await quests()
    expect(after.map((q) => q.session)).toEqual(['latihan', 'latihan', 'latihan'])
    expect(await record()).toMatchObject({ quests_required: 3 })
  })

  it('sesi yang sudah dimulai tetap saat aturan menghapusnya, dan menjadi opsional', async () => {
    await rules.saveDayRules(actor(), { learnerId, preset: 'penuh', rules: null })
    const [tes] = await owner`select id, attempt_id from quest where learner_id = ${learnerId} and date = ${today} and subject = 'math' and session = 'tes'`
    await owner`update quest set status = 'in_progress' where id = ${tes!.id}`
    const r = await rules.saveDayRules(actor(), { learnerId, preset: 'ringan', rules: null })
    expect(r.kept).toBeGreaterThanOrEqual(0)
    const after = await quests()
    const kept = after.find((q) => q.id === tes!.id)
    expect(kept).toBeDefined()
    expect(kept!.kind).toBe('extra')
    expect(kept!.attempt_id).toBe(tes!.attempt_id)
    expect(after.filter((q) => q.kind === 'daily')).toHaveLength(3)
    expect(await record()).toMatchObject({ quests_required: 3 })
  })

  it('sesi yang sudah dimulai tidak bisa dihapus tetapi bisa dijadikan opsional; isinya ditolak berubah', async () => {
    await rules.saveDayRules(actor(), { learnerId, preset: 'seimbang', rules: null })
    const [lat] = await owner`select id, attempt_id from quest where learner_id = ${learnerId} and date = ${today} and subject = 'english' and session = 'latihan' and kind = 'daily'`
    await owner`update quest set status = 'in_progress' where id = ${lat!.id}`
    await expect(planner.removeSession(actor(), { learnerId, date: today, slotId: null, subject: 'english', session: 'latihan' })).rejects.toMatchObject({ code: 'conflict' })
    const r = await planner.setSessionRequired(actor(), { learnerId, date: today, slotId: null, subject: 'english', session: 'latihan', required: false })
    expect(r.today).toBe(true)
    const after = await quests()
    expect(after.find((q) => q.id === lat!.id)).toMatchObject({ kind: 'extra', status: 'in_progress' })
    expect(await record()).toMatchObject({ quests_required: 2 })
    // Kembali wajib.
    await planner.setSessionRequired(actor(), { learnerId, date: today, slotId: null, subject: 'english', session: 'latihan', required: true })
    expect(await record()).toMatchObject({ quests_required: 3 })
  })

  it('sesi yang belum dimulai bisa dihapus dan hari ini terhitung ulang', async () => {
    const r = await planner.removeSession(actor(), { learnerId, date: today, slotId: null, subject: 'science', session: 'paper' })
    expect(r.today).toBe(true)
    expect((await quests()).some((q) => q.subject === 'science' && q.session === 'paper')).toBe(false)
    // Latihan Science wajib dihapus: wajib turun, hari tetap sah.
    await planner.removeSession(actor(), { learnerId, date: today, slotId: null, subject: 'science', session: 'latihan' })
    expect(await record()).toMatchObject({ quests_required: 2 })
  })

  it('hari tanpa sesi wajib netral dan tidak memutus streak', async () => {
    // Slot dasar dari tes sebelumnya (pilihan eksplisit tutor) menang atas aturan; bersihkan supaya yang diuji murni aturan.
    await owner`delete from plan_slot where learner_id = ${learnerId}`
    const allOptional = Object.fromEntries(
      [1, 2, 3, 4, 5, 6].map((d) => [String(d), Object.fromEntries(['math', 'english', 'science'].map((s) => [s, { latihan: 'optional', tes: 'optional', paper: 'off' }]))]),
    ) as import('@/lib/dto').DayRulesDTO
    await rules.saveDayRules(actor(), { learnerId, preset: 'kustom', rules: allOptional })
    expect(await record()).toMatchObject({ quests_required: 0, quests_done: 0 })
    const l = await dbm.inOrg(lctx, async (tx) => core.loadLearner(tx, learnerId))
    const s = await dbm.inOrg(lctx, (tx) => core.streakFor(tx, l, today))
    expect(s.statusByDate.get(today)).toBe('rest')
    expect(s.current).toBe(0)
    const stored = (await owner`select preset from day_rules where learner_id = ${learnerId}`)[0]
    expect(stored!.preset).toBe('kustom')
  })

  it('aturan kustom yang sama dengan sebuah preset disimpan sebagai preset itu', async () => {
    const { presetRules } = await import('@kira/core')
    await rules.saveDayRules(actor(), { learnerId, preset: 'kustom', rules: presetRules('ringan') as import('@/lib/dto').DayRulesDTO })
    expect((await owner`select preset, rules from day_rules where learner_id = ${learnerId}`)[0]).toMatchObject({ preset: 'ringan', rules: null })
  })

  it('atur ulang streak: riwayat hari dihapus, XP dan jawaban tetap, nama salah ditolak, ada audit', async () => {
    await owner`update learner_profile set started_on = ${'2026-10-01'}, xp = 777 where user_id = ${learnerId}`
    for (const d of ['2026-10-10', '2026-10-11', '2026-10-12']) {
      await owner`insert into day_record (org_id, learner_id, date, quests_done, quests_required) values (${orgId}, ${learnerId}, ${d}, 3, 3) on conflict do nothing`
    }
    await expect(rules.resetStreak(actor(), { learnerId, confirmName: 'Orang lain' })).rejects.toMatchObject({ code: 'invalid' })
    expect((await owner`select count(*)::int as n from day_record where learner_id = ${learnerId} and date < ${today}`)[0]!.n).toBeGreaterThanOrEqual(3)
    const r = await rules.resetStreak(actor(), { learnerId, confirmName: 'anak ATURAN' })
    expect(r.removedDays).toBeGreaterThanOrEqual(3)
    expect((await owner`select count(*)::int as n from day_record where learner_id = ${learnerId} and date < ${today}`)[0]!.n).toBe(0)
    const [lp] = await owner`select xp, streak_since from learner_profile where user_id = ${learnerId}`
    expect(lp!.xp).toBe(777)
    expect(String(lp!.streak_since instanceof Date ? lp!.streak_since.toISOString().slice(0, 10) : lp!.streak_since)).toBe(today)
    const l = await dbm.inOrg(lctx, async (tx) => core.loadLearner(tx, learnerId))
    const s = await dbm.inOrg(lctx, (tx) => core.streakFor(tx, l, today))
    expect(s.current).toBe(0)
    expect((await owner`select count(*)::int as n from audit_log where org_id = ${orgId} and action = 'learner.streak.reset'`)[0]!.n).toBe(1)
  })

  it('learner dan jawaban tidak ikut terhapus saat atur ulang streak', async () => {
    expect((await owner`select count(*)::int as n from quest where learner_id = ${learnerId}`)[0]!.n).toBeGreaterThan(0)
  })
})
