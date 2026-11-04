import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { jakartaDate } from '@kira/core'

/**
 * Dashboard orang tua di Postgres sungguhan. Dua keluarga, dan di keluarga A satu anak yang tidak tertaut ke
 * orang tua A: tidak satu pun aksi atau pembacaan boleh menjangkau anak yang bukan miliknya, dan tidak ada
 * perubahan yang tertinggal. Juga: aksi yang sah mengubah data, dicatat sebagai orang tua, dan jawaban tulis
 * bisa dinilai orang tua.
 */

const ownerUrl = process.env.DATABASE_URL_OWNER
const appUrl = process.env.DATABASE_URL_APP
const authUrl = process.env.DATABASE_URL_AUTH
const ready = Boolean(ownerUrl && appUrl && authUrl)

describe.skipIf(!ready)('dashboard orang tua', () => {
  const owner = ready ? postgres(ownerUrl!, { max: 2, onnotice: () => {} }) : (null as never)
  const orgA = randomUUID()
  const orgB = randomUUID()
  const gA = randomUUID()
  const gB = randomUUID()
  const tutorA = randomUUID()
  const a1 = randomUUID() // anak milik orang tua A
  const a2 = randomUUID() // anak keluarga A yang tidak tertaut ke orang tua A
  const b1 = randomUUID() // anak keluarga B
  const today = jakartaDate()
  let P: typeof import('@/server/dal/parent-control')
  let R: typeof import('@/server/dal/parent')
  let dbm: typeof import('@/server/db')
  let end: () => Promise<void>

  const actor = (userId: string, orgId: string, role: 'guardian' | 'tutor' = 'guardian') => ({ sessionId: randomUUID(), userId, orgId, kind: 'adult' as const, role, name: 'Orang tua uji', email: `${userId}@example.test`, deviceId: null, createdAt: new Date() })
  const PA = () => actor(gA, orgA)
  const forbidden = { code: 'forbidden' }
  // Sesi anak yang bukan milik orang tua ini disembunyikan RLS, jadi bisa terbaca sebagai tidak ditemukan; keduanya menolak.
  const forbid = { code: expect.stringMatching(/^(forbidden|not-found)$/) }
  const learnerRow = async (id: string) => (await owner`select name, grade, screen_limit_min, sound_enabled from learner_profile where user_id = ${id}`)[0]!

  beforeAll(async () => {
    process.env.KIRA_ORIGIN = 'http://localhost:3100'
    process.env.DATABASE_URL_APP = appUrl!
    process.env.DATABASE_URL_AUTH = authUrl!
    process.env.KIRA_SECRET = 'uji-dashboard-orang-tua-rahasia-minimal-32-karakter'
    process.env.KIRA_DATA_DIR = '.kira-local/data'
    P = await import('@/server/dal/parent-control')
    R = await import('@/server/dal/parent')
    dbm = await import('@/server/db')
    end = () => (dbm.appDb() as unknown as { $client: { end(): Promise<void> } }).$client.end()
    await owner`insert into org (id, name) values (${orgA}, 'Keluarga A __GTX_SEED__'), (${orgB}, 'Keluarga B __GTX_SEED__')`
    await owner`insert into member_profile (user_id, org_id, name, role, email) values
      (${gA}, ${orgA}, 'Ibu A', 'guardian', ${`${gA}@example.test`}),
      (${gB}, ${orgB}, 'Ibu B', 'guardian', ${`${gB}@example.test`}),
      (${tutorA}, ${orgA}, 'Tutor A', 'tutor', ${`${tutorA}@example.test`})`
    await owner`insert into learner_profile (user_id, org_id, name, grade, active, screen_limit_min, rest_weekdays, started_on) values
      (${a1}, ${orgA}, 'Anak Satu', 2, true, 90, '{}', ${today}),
      (${a2}, ${orgA}, 'Anak Dua', 3, true, 90, '{}', ${today}),
      (${b1}, ${orgB}, 'Anak Bayu', 4, true, 90, '{}', ${today})`
    await owner`insert into guardian_link (org_id, guardian_id, learner_id) values (${orgA}, ${gA}, ${a1}), (${orgB}, ${gB}, ${b1})`
    for (const [id, org, nm] of [[a1, orgA, 'Anak Satu'], [a2, orgA, 'Anak Dua'], [b1, orgB, 'Anak Bayu']] as const) {
      await owner`insert into auth.user_account (id, org_id, kind, role, email, name) values (${id}, ${org}, 'learner', 'learner', null, ${nm})`
    }
    // Sesi hari ini untuk anak yang bukan milik orang tua A.
    for (const [id, org] of [[a2, orgA], [b1, orgB]] as const) {
      const ctx = { orgId: org, userId: id, role: 'learner' as const }
      const session = await import('@/server/dal/learner-session')
      const core = await import('@/server/dal/learner-core')
      await dbm.inOrg(ctx, async (tx) => session.ensureTodayQuests(tx, ctx, await core.loadLearner(tx, id), today))
    }
  })

  afterAll(async () => {
    await owner`delete from auth.user_account where org_id in (${orgA}, ${orgB})`
    await owner`delete from org where id in (${orgA}, ${orgB})`
    await Promise.all([owner.end(), end()])
  })

  it('beranda hanya memuat anak yang tertaut', async () => {
    const home = await R.parentHomeDTO(PA())
    expect(home.children.map((c) => c.id)).toEqual([a1])
    const homeB = await R.parentHomeDTO(actor(gB, orgB))
    expect(homeB.children.map((c) => c.id)).toEqual([b1])
  })

  it('anak sendiri: detail terbaca, dengan aturan hari Seimbang sebagai bawaan', async () => {
    const d = await R.parentChildDTO(PA(), a1)
    expect(d.card.id).toBe(a1)
    expect(d.controls.dayPreset).toBe('seimbang')
    expect(d.skillMap.length).toBeGreaterThan(0)
    expect(d.hasTutor).toBe(true)
  })

  it('pembacaan anak lain ditolak: anak keluarga lain dan anak sekeluarga yang tidak tertaut', async () => {
    for (const other of [a2, b1]) {
      await expect(R.parentChildDTO(PA(), other)).rejects.toMatchObject(forbidden)
      await expect(R.parentResultDTO(PA(), other, randomUUID())).rejects.toMatchObject(forbidden)
    }
  })

  it('setiap aksi atas anak lain ditolak dan tidak mengubah apa pun', async () => {
    const before = { a2: await learnerRow(a2), b1: await learnerRow(b1) }
    const rules = Object.fromEntries([1, 2, 3, 4, 5, 6].map((d) => [String(d), Object.fromEntries(['math', 'english', 'science'].map((s) => [s, { latihan: 'off', tes: 'off', paper: 'off' }]))])) as never
    for (const other of [a2, b1]) {
      await expect(P.parentSaveDayRules(PA(), { learnerId: other, preset: 'kustom', rules })).rejects.toMatchObject(forbidden)
      await expect(P.parentResetStreak(PA(), { learnerId: other, confirmName: 'x' })).rejects.toMatchObject(forbidden)
      const foreignQuest = (await owner`select id from quest where learner_id = ${other} and date = ${today} and session = 'latihan' limit 1`)[0]!.id as string
      await expect(P.parentSetSessionRequired(PA(), { questId: foreignQuest, required: false })).rejects.toMatchObject(forbid)
      await expect(P.parentRemoveSession(PA(), { questId: foreignQuest })).rejects.toMatchObject(forbid)
      await expect(P.parentAddOptional(PA(), { learnerId: other, subject: 'math', session: 'latihan' })).rejects.toMatchObject(forbidden)
      await expect(P.parentSetQuestionCount(PA(), { questId: foreignQuest, questionCount: 12 })).rejects.toMatchObject(forbid)
      await expect(P.parentSaveLimits(PA(), { learnerId: other, screenLimitMin: 20, restWeekdays: [] })).rejects.toMatchObject(forbidden)
      await expect(P.parentSaveSound(PA(), { learnerId: other, soundEnabled: false, musicEnabled: false })).rejects.toMatchObject(forbidden)
      await expect(P.parentResetPin(PA(), { learnerId: other, pin: ['sun', 'moon', 'star', 'cat'] })).rejects.toMatchObject(forbidden)
      await expect(P.parentUnlock(PA(), other)).rejects.toMatchObject(forbidden)
      await expect(P.parentEditChild(PA(), { learnerId: other, name: 'Diubah', grade: 1, avatar: 'fox' })).rejects.toMatchObject(forbidden)
    }
    expect(await learnerRow(a2)).toEqual(before.a2)
    expect(await learnerRow(b1)).toEqual(before.b1)
    expect((await owner`select count(*)::int as n from day_rules where learner_id in (${a2}, ${b1})`)[0]!.n).toBe(0)
    expect((await owner`select count(*)::int as n from plan_slot where learner_id in (${a2}, ${b1})`)[0]!.n).toBe(0)
    expect((await owner`select count(*)::int as n from quest where learner_id in (${a2}, ${b1}) and date = ${today}`)[0]!.n).toBe(18)
    expect((await owner`select count(*)::int as n from audit_log where target in (${a2}, ${b1}) and action like 'parent.%'`)[0]!.n).toBe(0)
  })

  it('tutor atau peran lain tidak lolos withFamilyAdmin', async () => {
    await expect(R.parentChildDTO(actor(tutorA, orgA, 'tutor'), a1)).rejects.toMatchObject(forbidden)
  })

  it('aturan hari anak sendiri berubah, hari ini ikut, dan tercatat sebagai orang tua', async () => {
    // Today sudah dibuat sebagai anak.
    const { inOrg } = dbm
    const ctx = { orgId: orgA, userId: a1, role: 'learner' as const }
    const session = await import('@/server/dal/learner-session')
    const core = await import('@/server/dal/learner-core')
    await inOrg(ctx, async (tx) => session.ensureTodayQuests(tx, ctx, await core.loadLearner(tx, a1), today))
    const r = await P.parentSaveDayRules(PA(), { learnerId: a1, preset: 'ringan', rules: null })
    expect(r.today).toBe(true)
    expect((await owner`select preset from day_rules where learner_id = ${a1}`)[0]!.preset).toBe('ringan')
    expect((await owner`select count(*)::int as n from quest where learner_id = ${a1} and date = ${today}`)[0]!.n).toBe(3)
    const audit = await owner`select actor_kind, actor_id from audit_log where org_id = ${orgA} and action = 'parent.dayrules'`
    expect(audit[0]).toMatchObject({ actor_kind: 'guardian', actor_id: gA })
    // Sesi hari ini: Tes opsional ditambah, dijadikan wajib, lalu dihapus.
    await P.parentAddOptional(PA(), { learnerId: a1, subject: 'math', session: 'tes' })
    expect((await R.parentChildDTO(PA(), a1)).today.sessions.some((s) => s.subject === 'math' && s.session === 'tes' && !s.required)).toBe(true)
    const tesId = async () => (await R.parentChildDTO(PA(), a1)).today.sessions.find((x) => x.subject === 'math' && x.session === 'tes')!.questId
    await P.parentSetSessionRequired(PA(), { questId: await tesId(), required: true })
    expect((await owner`select quests_required from day_record where learner_id = ${a1} and date = ${today}`)[0]!.quests_required).toBe(4)
    await P.parentRemoveSession(PA(), { questId: await tesId() })
    expect((await owner`select quests_required from day_record where learner_id = ${a1} and date = ${today}`)[0]!.quests_required).toBe(3)
  })

  it('batas layar, suara, nama, dan PIN anak sendiri', async () => {
    await P.parentSaveLimits(PA(), { learnerId: a1, screenLimitMin: 45, restWeekdays: [0] })
    await P.parentSaveSound(PA(), { learnerId: a1, soundEnabled: false, musicEnabled: false })
    await P.parentEditChild(PA(), { learnerId: a1, name: 'Anak Satu Baru', grade: 3, avatar: 'cat' })
    await P.parentResetPin(PA(), { learnerId: a1, pin: ['sun', 'moon', 'star', 'cat'] })
    await P.parentUnlock(PA(), a1)
    expect(await learnerRow(a1)).toMatchObject({ name: 'Anak Satu Baru', grade: 3, screen_limit_min: 45, sound_enabled: false })
  })

  it('atur ulang streak oleh orang tua: nama harus cocok, XP tetap', async () => {
    await owner`update learner_profile set xp = 321 where user_id = ${a1}`
    await owner`insert into day_record (org_id, learner_id, date, quests_done, quests_required) values (${orgA}, ${a1}, '2026-10-02', 3, 3) on conflict do nothing`
    await expect(P.parentResetStreak(PA(), { learnerId: a1, confirmName: 'salah' })).rejects.toMatchObject({ code: 'invalid' })
    const r = await P.parentResetStreak(PA(), { learnerId: a1, confirmName: 'anak satu baru' })
    expect(r.removedDays).toBeGreaterThanOrEqual(1)
    expect((await owner`select xp from learner_profile where user_id = ${a1}`)[0]!.xp).toBe(321)
  })

  it('tambah anak: tertaut ke orang tua ini saja, belum aktif sampai ada persetujuan', async () => {
    const r = await P.parentAddChild(PA(), { name: 'Anak Tiga', grade: 1, avatar: 'fox', pin: ['sun', 'moon', 'star', 'cat'] })
    const link = await owner`select guardian_id from guardian_link where learner_id = ${r.learnerId}`
    expect(link.map((l) => l.guardian_id)).toEqual([gA])
    expect((await owner`select active from learner_profile where user_id = ${r.learnerId}`)[0]!.active).toBe(false)
    await expect(P.parentAddChild(PA(), { name: 'anak tiga', grade: 1, avatar: 'fox', pin: ['sun', 'moon', 'star', 'cat'] })).rejects.toMatchObject({ code: 'invalid' })
    expect((await R.parentHomeDTO(PA())).children.map((c) => c.id)).toContain(r.learnerId)
    expect((await R.parentHomeDTO(actor(gB, orgB))).children.map((c) => c.id)).not.toContain(r.learnerId)
  })

  it('jawaban tulis: orang tua melihat dan menilai anaknya, bukan anak lain', async () => {
    const content = (await import('@/server/dal/content')).content()
    const item = [...content.items.values()].find((i) => i.type === 'write' && 'rubric' in i && i.rubric)
    if (!item) return
    const mk = async (learner: string, org: string) => {
      const [at] = await owner`insert into attempt (org_id, learner_id, kind, mode, subject, title, items, status, submitted_at)
        values (${org}, ${learner}, 'test', 'tes', ${item.skill.startsWith('e') ? 'english' : item.skill.startsWith('m') ? 'math' : 'science'}, 'Tulis uji', ${owner.json([{ ref: item.id, position: 1 }] as never)}, 'needs_grading', now()) returning id`
      const [rs] = await owner`insert into response (org_id, attempt_id, learner_id, position, item_ref, skill_id, subject, item_type, difficulty, answer, status, client_id)
        values (${org}, ${at!.id}, ${learner}, 1, ${item.id}, ${item.skill}, 'english', 'write', 3, ${owner.json({ text: 'Jawaban anak' } as never)}, 'pending', ${randomUUID()}) returning id`
      return { attemptId: at!.id as string, responseId: rs!.id as string }
    }
    const mine = await mk(a1, orgA)
    const theirs = await mk(b1, orgB)
    const d = await R.parentChildDTO(PA(), a1)
    expect(d.work.map((w) => w.responseId)).toContain(mine.responseId)
    expect(d.work.map((w) => w.responseId)).not.toContain(theirs.responseId)
    await expect(P.parentMarkWork(PA(), { responseId: theirs.responseId, verdict: 'good', feedback: '' })).rejects.toMatchObject(forbid)
    expect((await owner`select status from response where id = ${theirs.responseId}`)[0]!.status).toBe('pending')
    await P.parentMarkWork(PA(), { responseId: mine.responseId, verdict: 'good', feedback: 'Bagus sekali' })
    expect((await owner`select status from response where id = ${mine.responseId}`)[0]!.status).toBe('correct')
  })
})
