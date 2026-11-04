import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { jakartaDate } from '@kira/core'

/**
 * Ganti pelajaran oleh orang tua di Postgres sungguhan. Keluarga A punya tutor (seperti keluarga lama), keluarga B
 * mendaftar sendiri tanpa tutor. Yang dibuktikan: pilihan sesuai kelas, mapel, dan saklar; sesi berganti pelajaran dan
 * Today anak ikut; sesi selesai ditolak; sesi berjalan tetap jalan dan perubahan berlaku mulai sesi berikutnya; streak
 * tetap dihitung dari sesi wajib; orang tua keluarga lain dan orang tua yang tidak tertaut ditolak; alur tutor tetap jalan.
 */

const ownerUrl = process.env.DATABASE_URL_OWNER
const appUrl = process.env.DATABASE_URL_APP
const authUrl = process.env.DATABASE_URL_AUTH
const ready = Boolean(ownerUrl && appUrl && authUrl)

describe.skipIf(!ready)('ganti pelajaran oleh orang tua', () => {
  const owner = ready ? postgres(ownerUrl!, { max: 2, onnotice: () => {} }) : (null as never)
  const orgA = randomUUID()
  const orgB = randomUUID()
  const gA = randomUUID()
  const gB = randomUUID()
  const tutorA = randomUUID()
  const a1 = randomUUID() // anak orang tua A, kelas 2
  const a2 = randomUUID() // anak keluarga A yang tidak tertaut ke orang tua A
  const a3 = randomUUID() // anak keluarga A untuk alur tutor
  const b1 = randomUUID() // anak keluarga B, kelas 4
  const today = jakartaDate()
  const NEW_SKILL = 'm2.arrays'
  const OTHER_SKILL = 'm2.place-value'
  let P: typeof import('@/server/dal/parent-skill-change')
  let R: typeof import('@/server/dal/parent')
  let planner: typeof import('@/server/dal/console-planner')
  let session: typeof import('@/server/dal/learner-session')
  let core: typeof import('@/server/dal/learner-core')
  let dbm: typeof import('@/server/db')
  let end: () => Promise<void>

  const actor = (userId: string, orgId: string, role: 'guardian' | 'tutor' = 'guardian') => ({ sessionId: randomUUID(), userId, orgId, kind: 'adult' as const, role, name: 'Dewasa uji', email: `${userId}@example.test`, deviceId: null, createdAt: new Date() })
  const PA = () => actor(gA, orgA)
  const PB = () => actor(gB, orgB)
  const TA = () => actor(tutorA, orgA, 'tutor')
  const forbid = { code: expect.stringMatching(/^(forbidden|not-found)$/) }

  const openToday = (learner: string, org: string) => {
    const ctx = { orgId: org, userId: learner, role: 'learner' as const }
    return dbm.inOrg(ctx, async (tx) => session.ensureTodayQuests(tx, ctx, await core.loadLearner(tx, learner), today))
  }
  const questOf = async (learner: string, subject: string, sessionName: string) =>
    (await owner`select id, skill_id, attempt_id, kind, status, title, plan_slot_id from quest where learner_id = ${learner} and date = ${today} and subject = ${subject} and session = ${sessionName} order by seq limit 1`)[0]!
  const dayRecord = async (learner: string) => (await owner`select quests_done, quests_required from day_record where learner_id = ${learner} and date = ${today}`)[0]!
  const childSession = async (learner: string, questId: string, a = PA()) => (await R.parentChildDTO(a, learner)).today.sessions.find((s) => s.questId === questId)!
  /** Satu jawaban nyata di attempt ini: sesi menjadi sedang dikerjakan, seperti di runner. */
  const answerOne = async (learner: string, org: string, attemptId: string) => {
    const [at] = await owner`select items, subject from attempt where id = ${attemptId}`
    const it = (at!.items as { ref: string; position: number; difficulty: number }[])[0]!
    await owner`insert into response (org_id, attempt_id, learner_id, position, item_ref, skill_id, subject, item_type, difficulty, answer, status, client_id)
      values (${org}, ${attemptId}, ${learner}, ${it.position}, ${it.ref}, ${NEW_SKILL}, ${at!.subject}, 'mcq', ${it.difficulty}, ${owner.json({ value: 'x' } as never)}, 'wrong', ${randomUUID()})`
  }

  beforeAll(async () => {
    process.env.KIRA_ORIGIN = 'http://localhost:3100'
    process.env.DATABASE_URL_APP = appUrl!
    process.env.DATABASE_URL_AUTH = authUrl!
    process.env.KIRA_SECRET = 'uji-ganti-pelajaran-rahasia-minimal-32-karakter'
    process.env.KIRA_DATA_DIR = '.kira-local/data'
    P = await import('@/server/dal/parent-skill-change')
    R = await import('@/server/dal/parent')
    planner = await import('@/server/dal/console-planner')
    session = await import('@/server/dal/learner-session')
    core = await import('@/server/dal/learner-core')
    dbm = await import('@/server/db')
    end = () => (dbm.appDb() as unknown as { $client: { end(): Promise<void> } }).$client.end()
    await owner`insert into org (id, name) values (${orgA}, 'Keluarga A __GTX_SEED__'), (${orgB}, 'Keluarga B __GTX_SEED__')`
    await owner`insert into member_profile (user_id, org_id, name, role, email) values
      (${gA}, ${orgA}, 'Ibu A', 'guardian', ${`${gA}@example.test`}),
      (${gB}, ${orgB}, 'Ibu B', 'guardian', ${`${gB}@example.test`}),
      (${tutorA}, ${orgA}, 'Tutor A', 'tutor', ${`${tutorA}@example.test`})`
    await owner`insert into learner_profile (user_id, org_id, name, grade, active, screen_limit_min, rest_weekdays, started_on) values
      (${a1}, ${orgA}, 'Anak Satu', 2, true, 90, '{}', ${today}),
      (${a2}, ${orgA}, 'Anak Dua', 2, true, 90, '{}', ${today}),
      (${a3}, ${orgA}, 'Anak Tiga', 2, true, 90, '{}', ${today}),
      (${b1}, ${orgB}, 'Anak Bayu', 4, true, 90, '{}', ${today})`
    await owner`insert into guardian_link (org_id, guardian_id, learner_id) values (${orgA}, ${gA}, ${a1}), (${orgB}, ${gB}, ${b1})`
    for (const [id, org, nm] of [[a1, orgA, 'Anak Satu'], [a2, orgA, 'Anak Dua'], [a3, orgA, 'Anak Tiga'], [b1, orgB, 'Anak Bayu']] as const) {
      await owner`insert into auth.user_account (id, org_id, kind, role, email, name) values (${id}, ${org}, 'learner', 'learner', null, ${nm})`
      await owner`insert into day_rules (learner_id, org_id, preset) values (${id}, ${org}, 'seimbang')`
      await openToday(id, org)
    }
  })

  afterAll(async () => {
    await owner`delete from auth.user_account where org_id in (${orgA}, ${orgB})`
    await owner`delete from org where id in (${orgA}, ${orgB})`
    await Promise.all([owner.end(), end()])
  })

  it('setiap sesi menunjukkan pelajarannya; Latihan dan Tes bisa diganti, Paper tidak', async () => {
    const d = await R.parentChildDTO(PA(), a1)
    const lat = d.today.sessions.find((s) => s.subject === 'math' && s.session === 'latihan')!
    expect(lat.skill?.title).toBeTruthy()
    expect(lat.skill?.titleEn).toBeTruthy()
    expect(lat.canChangeSkill).toBe(true)
    const paper = d.today.sessions.find((s) => s.subject === 'math' && s.session === 'paper')!
    expect(paper.canChangeSkill).toBe(false)
    expect(paper.skill).toBeNull()
    expect(paper.contentTitle).toBeTruthy()
  })

  it('pilihan: kelas anak dan mapel sesi, per topik dengan nama Indonesia, tanpa skill yang tidak punya soal otomatis', async () => {
    const q = await questOf(a1, 'math', 'latihan')
    const o = await P.parentSkillOptions(PA(), { questId: q.id as string })
    const ids = o.topics.flatMap((t) => t.skills.map((s) => s.id))
    expect(ids.length).toBeGreaterThan(5)
    expect(ids.every((id) => id.startsWith('m2.'))).toBe(true)
    expect(o.topics.map((t) => t.label)).toContain('Nilai tempat, urutan, dan pembulatan')
    expect(o.appliesTo).toBe('Latihan Math dan Tes Math')
    const e = await P.parentSkillOptions(PA(), { questId: (await questOf(a1, 'english', 'latihan')).id as string })
    const eIds = e.topics.flatMap((t) => t.skills.map((s) => s.id))
    expect(eIds.every((id) => id.startsWith('e2.'))).toBe(true)
    expect(eIds).not.toContain('e2.starters-speaking')
    expect(eIds).not.toContain('e2.starters-writing')
    await expect(P.parentChangeSessionSkill(PA(), { questId: q.id as string, skillId: 'm3.place-value' })).rejects.toMatchObject({ code: 'invalid' })
    await expect(P.parentChangeSessionSkill(PA(), { questId: q.id as string, skillId: 'e2.reading-information' })).rejects.toMatchObject({ code: 'invalid' })
    await expect(P.parentChangeSessionSkill(PA(), { questId: (await questOf(a1, 'english', 'latihan')).id as string, skillId: 'e2.starters-speaking' })).rejects.toMatchObject({ code: 'invalid' })
    await expect(P.parentChangeSessionSkill(PA(), { questId: (await questOf(a1, 'math', 'paper')).id as string, skillId: NEW_SKILL })).rejects.toMatchObject({ code: 'invalid' })
  })

  it('saklar fitur: olimpiade mati berarti skill olimpiade hilang dan ditolak server', async () => {
    const q = await questOf(a1, 'math', 'latihan')
    const before = await P.parentSkillOptions(PA(), { questId: q.id as string })
    const oly = before.topics.find((t) => t.id === 'Oly')
    expect(oly).toBeTruthy()
    const olySkill = oly!.skills[0]!.id
    await owner`insert into learner_feature (learner_id, org_id, key, enabled) values (${a1}, ${orgA}, 'olympiad-math', false)`
    try {
      const after = await P.parentSkillOptions(PA(), { questId: q.id as string })
      expect(after.topics.find((t) => t.id === 'Oly')).toBeUndefined()
      await expect(P.parentChangeSessionSkill(PA(), { questId: q.id as string, skillId: olySkill })).rejects.toMatchObject({ code: 'invalid' })
    } finally {
      await owner`delete from learner_feature where learner_id = ${a1}`
    }
  })

  it('sesi belum dimulai berganti; Tes yang mengikuti ikut; Today anak langsung memakainya; wajib tetap wajib', async () => {
    const lat = await questOf(a1, 'math', 'latihan')
    const tes = await questOf(a1, 'math', 'tes')
    expect(tes.skill_id).toBe(lat.skill_id)
    const other = lat.skill_id === NEW_SKILL ? OTHER_SKILL : NEW_SKILL
    const recBefore = await dayRecord(a1)
    const r = await P.parentChangeSessionSkill(PA(), { questId: lat.id as string, skillId: other })
    expect(r.change).toMatchObject({ today: true, regenerated: 2 })
    expect(r.note).toContain('Latihan Math dan Tes Math')
    const latAfter = await questOf(a1, 'math', 'latihan')
    const tesAfter = await questOf(a1, 'math', 'tes')
    expect(latAfter).toMatchObject({ id: lat.id, skill_id: other, kind: 'daily' })
    expect(tesAfter).toMatchObject({ id: tes.id, skill_id: other, kind: 'extra' })
    expect(latAfter.attempt_id).not.toBe(lat.attempt_id)
    expect(tesAfter.attempt_id).not.toBe(tes.attempt_id)
    const items = (await owner`select items from attempt where id = ${latAfter.attempt_id as string}`)[0]!.items as { ref: string }[]
    expect(items.length).toBe(10)
    expect(items.filter((i) => i.ref.includes(other)).length).toBeGreaterThanOrEqual(5)
    expect(await dayRecord(a1)).toEqual(recBefore)
    // Bila Today dimuat ulang, isinya tetap pilihan orang tua dan sesinya tidak dibuat ulang lagi.
    await openToday(a1, orgA)
    expect(await questOf(a1, 'math', 'latihan')).toMatchObject({ skill_id: other, attempt_id: latAfter.attempt_id })
    const ctx = { orgId: orgA, userId: a1, role: 'learner' as const }
    const { todayDTO } = await import('@/server/dal/learner-today')
    const dto = await dbm.inOrg(ctx, (tx) => todayDTO(tx, ctx, a1))
    expect(JSON.stringify(dto)).toContain((await import('@/server/dal/content')).skill(other)!.title)
    const week = await owner`select status from plan_week where learner_id = ${a1}`
    expect(week[0]!.status).toBe('published')
    const slot = await owner`select base, required, skill_id from plan_slot where learner_id = ${a1} and date = ${today} and subject = 'math' and session = 'latihan'`
    expect(slot).toEqual([{ base: true, required: true, skill_id: other }])
    const audit = await owner`select actor_kind, actor_id from audit_log where org_id = ${orgA} and action = 'parent.session.skill' and target = ${a1}`
    expect(audit[0]).toMatchObject({ actor_kind: 'guardian', actor_id: gA })
    // Ganti lagi: slot yang sama diubah, Tes tetap mengikuti.
    const again = lat.skill_id === NEW_SKILL ? NEW_SKILL : OTHER_SKILL
    await P.parentChangeSessionSkill(PA(), { questId: lat.id as string, skillId: again })
    expect((await questOf(a1, 'math', 'tes')).skill_id).toBe(again)
    expect(await owner`select id from plan_slot where learner_id = ${a1} and date = ${today} and subject = 'math' and session = 'latihan'`).toHaveLength(1)
  })

  it('Tes yang diganti sendiri tidak mengubah Latihan, dan tidak lagi mengikuti Latihan', async () => {
    const lat = await questOf(a1, 'math', 'latihan')
    const tes = await questOf(a1, 'math', 'tes')
    const opts = await P.parentSkillOptions(PA(), { questId: tes.id as string })
    const pick = opts.topics.flatMap((t) => t.skills).find((s) => s.id !== lat.skill_id && s.id !== tes.skill_id)!
    await P.parentChangeSessionSkill(PA(), { questId: tes.id as string, skillId: pick.id })
    const tesNow = await questOf(a1, 'math', 'tes')
    expect(tesNow.skill_id).not.toBe(lat.skill_id)
    expect((await questOf(a1, 'math', 'latihan')).skill_id).toBe(lat.skill_id)
    const other = lat.skill_id === NEW_SKILL ? OTHER_SKILL : NEW_SKILL
    await P.parentChangeSessionSkill(PA(), { questId: lat.id as string, skillId: other })
    expect((await questOf(a1, 'math', 'tes')).skill_id).toBe(tesNow.skill_id)
    await P.parentChangeSessionSkill(PA(), { questId: tes.id as string, skillId: other })
  })

  it('sesi berjalan tetap jalan dengan pesan jelas; perubahan berlaku mulai sesi berikutnya yang belum dimulai', async () => {
    const lat = await questOf(a1, 'english', 'latihan')
    const tes = await questOf(a1, 'english', 'tes')
    await answerOne(a1, orgA, lat.attempt_id as string)
    const row = await childSession(a1, lat.id as string)
    expect(row).toMatchObject({ state: 'in-progress', started: true, canChangeSkill: true })
    expect(row.skillNote).toContain('tetap berjalan')
    expect(row.skillNote).toContain('Tes English')
    const opts = await P.parentSkillOptions(PA(), { questId: lat.id as string })
    expect(opts.appliesTo).toBe('Tes English')
    const pick = opts.topics.flatMap((t) => t.skills).find((s) => s.id !== lat.skill_id)!
    const r = await P.parentChangeSessionSkill(PA(), { questId: lat.id as string, skillId: pick.id })
    expect(r.note).toContain('tetap berjalan')
    expect(await questOf(a1, 'english', 'latihan')).toMatchObject({ skill_id: lat.skill_id, attempt_id: lat.attempt_id })
    expect(await questOf(a1, 'english', 'tes')).toMatchObject({ id: tes.id, skill_id: pick.id })
    expect((await owner`select count(*)::int as n from response where attempt_id = ${lat.attempt_id as string}`)[0]!.n).toBe(1)
  })

  it('sesi berjalan tanpa sesi berikutnya: orang tua diberi tahu dan tidak ada yang berubah', async () => {
    const tes = await questOf(a1, 'english', 'tes')
    await answerOne(a1, orgA, tes.attempt_id as string)
    const row = await childSession(a1, tes.id as string)
    expect(row).toMatchObject({ state: 'in-progress', canChangeSkill: false })
    expect(row.skillNote).toContain('tetap berjalan')
    expect((await R.parentChildDTO(PA(), a1)).card.status).toBe('in-progress')
    await expect(P.parentSkillOptions(PA(), { questId: tes.id as string })).rejects.toMatchObject({ code: 'conflict' })
    await expect(P.parentChangeSessionSkill(PA(), { questId: tes.id as string, skillId: OTHER_SKILL.replace('m2', 'e2') })).rejects.toMatchObject({ code: 'conflict' })
    expect(await questOf(a1, 'english', 'tes')).toMatchObject({ skill_id: tes.skill_id, attempt_id: tes.attempt_id })
  })

  it('sesi selesai ditolak: pelajaran, soal, dan rencana tidak berubah', async () => {
    const lat = await questOf(a1, 'science', 'latihan')
    await owner`update quest set status = 'done', completed_at = now() where id = ${lat.id as string}`
    await owner`update attempt set status = 'submitted', submitted_at = now() where id = ${lat.attempt_id as string}`
    const row = await childSession(a1, lat.id as string)
    expect(row).toMatchObject({ state: 'done', canChangeSkill: false })
    expect(row.skillNote).toContain('Sudah selesai')
    const slotsBefore = await owner`select id from plan_slot where learner_id = ${a1} and subject = 'science'`
    const opts = await P.parentSkillOptions(PA(), { questId: (await questOf(a1, 'science', 'tes')).id as string })
    const pick = opts.topics.flatMap((t) => t.skills).find((s) => s.id !== lat.skill_id)!
    await expect(P.parentChangeSessionSkill(PA(), { questId: lat.id as string, skillId: pick.id })).rejects.toMatchObject({ code: 'conflict', message: expect.stringContaining('Sudah selesai') })
    await expect(P.parentSkillOptions(PA(), { questId: lat.id as string })).rejects.toMatchObject({ code: 'conflict' })
    expect(await questOf(a1, 'science', 'latihan')).toMatchObject({ skill_id: lat.skill_id, attempt_id: lat.attempt_id, status: 'done' })
    expect(await owner`select id from plan_slot where learner_id = ${a1} and subject = 'science'`).toEqual(slotsBefore)
    // Tes setelah Latihan selesai masih bisa diganti.
    await P.parentChangeSessionSkill(PA(), { questId: (await questOf(a1, 'science', 'tes')).id as string, skillId: pick.id })
    expect((await questOf(a1, 'science', 'tes')).skill_id).toBe(pick.id)
  })

  it('streak: sesi opsional yang diganti tidak dihitung; sesi wajib yang diganti tetap menentukan hari itu', async () => {
    // Keluarga B: Seimbang, 3 Latihan wajib. Tanpa tutor, sesi wajib tidak memuat soal yang menunggu orang dewasa.
    const rec = await dayRecord(b1)
    expect(rec).toMatchObject({ quests_required: 3, quests_done: 0 })
    const tes = await questOf(b1, 'math', 'tes')
    expect(tes.kind).toBe('extra')
    const opts = await P.parentSkillOptions(PB(), { questId: tes.id as string })
    const pick = opts.topics.flatMap((t) => t.skills).find((s) => s.id !== tes.skill_id)!
    await P.parentChangeSessionSkill(PB(), { questId: tes.id as string, skillId: pick.id })
    expect(await questOf(b1, 'math', 'tes')).toMatchObject({ kind: 'extra', skill_id: pick.id })
    expect(await dayRecord(b1)).toEqual(rec)

    const latMath = await questOf(b1, 'math', 'latihan')
    const optsLat = await P.parentSkillOptions(PB(), { questId: latMath.id as string })
    const other = optsLat.topics.flatMap((t) => t.skills).find((s) => s.id !== latMath.skill_id && s.id !== pick.id)!
    await P.parentChangeSessionSkill(PB(), { questId: latMath.id as string, skillId: other.id })
    expect((await questOf(b1, 'math', 'latihan')).kind).toBe('daily')
    expect(await dayRecord(b1)).toEqual(rec)

    const ctx = { orgId: orgB, userId: b1, role: 'learner' as const }
    const runner = await import('@/server/dal/learner-runner')
    const finish = async (subject: string) => {
      const q = await questOf(b1, subject, 'latihan')
      await dbm.inOrg(ctx, (tx) => runner.submitAttempt(tx, ctx, b1, q.attempt_id as string))
    }
    const streak = async () => dbm.inOrg(ctx, async (tx) => (await core.streakFor(tx, await core.loadLearner(tx, b1), today)).current)
    const before = await streak()
    await finish('math')
    expect(await dayRecord(b1)).toMatchObject({ quests_required: 3, quests_done: 1 })
    expect(await streak()).toBe(before)
    await finish('english')
    await finish('science')
    expect(await dayRecord(b1)).toMatchObject({ quests_required: 3, quests_done: 3 })
    expect(await streak()).toBe(before + 1)
  })

  it('kepemilikan: orang tua keluarga lain dan orang tua yang tidak tertaut ditolak, tidak ada yang berubah', async () => {
    for (const [other, subject] of [[a2, 'math'], [b1, 'english']] as const) {
      const q = await questOf(other, subject, 'tes')
      const slots = await owner`select id from plan_slot where learner_id = ${other} order by id`
      const skillId = subject === 'math' ? NEW_SKILL : 'e4.reading-information'
      await expect(P.parentSkillOptions(PA(), { questId: q.id as string })).rejects.toMatchObject(forbid)
      await expect(P.parentChangeSessionSkill(PA(), { questId: q.id as string, skillId })).rejects.toMatchObject(forbid)
      expect(await questOf(other, subject, 'tes')).toMatchObject({ skill_id: q.skill_id, attempt_id: q.attempt_id })
      expect(await owner`select id from plan_slot where learner_id = ${other} order by id`).toEqual(slots)
    }
    const q = await questOf(a1, 'math', 'latihan')
    await expect(P.parentSkillOptions(PB(), { questId: q.id as string })).rejects.toMatchObject(forbid)
    await expect(P.parentChangeSessionSkill(PB(), { questId: q.id as string, skillId: NEW_SKILL })).rejects.toMatchObject(forbid)
    expect((await owner`select count(*)::int as n from audit_log where action = 'parent.session.skill' and target = ${a2}`)[0]!.n).toBe(0)
  })

  it('tutor keluarga lama: pintu orang tua tertutup, dan alur Rencana mengganti pelajaran hari ini dengan penjaga yang sama', async () => {
    const q = await questOf(a3, 'math', 'latihan')
    await expect(P.parentChangeSessionSkill(TA(), { questId: q.id as string, skillId: NEW_SKILL })).rejects.toMatchObject({ code: 'forbidden' })
    await expect(R.parentChildDTO(TA(), a3)).rejects.toMatchObject({ code: 'forbidden' })

    const skillId = q.skill_id === NEW_SKILL ? OTHER_SKILL : NEW_SKILL
    const base = { learnerId: a3, date: today, subject: 'math' as const, session: 'latihan' as const, required: true, mode: 'latihan' as const, questionCount: 10, paperKind: null, config: null, fromAuto: true }
    const change = await planner.upsertSlot(TA(), { ...base, skillId })
    expect(change).toMatchObject({ today: true, regenerated: 1 })
    expect(await questOf(a3, 'math', 'latihan')).toMatchObject({ id: q.id, skill_id: skillId, kind: 'daily' })

    // Tutor melihat pilihan yang sama di halaman perencana, dan Today anak langsung memakai perubahan.
    const dto = await planner.plannerDTO(TA(), a3, today)
    expect(dto!.slots.find((s) => s.date === today && s.subject === 'math' && s.session === 'latihan')).toMatchObject({ skillId, auto: false })

    await answerOne(a3, orgA, (await questOf(a3, 'math', 'latihan')).attempt_id as string)
    const slotId = dto!.slots.find((s) => s.date === today && s.subject === 'math' && s.session === 'latihan')!.id
    await expect(planner.upsertSlot(TA(), { ...base, fromAuto: undefined, slotId, skillId: q.skill_id as string })).rejects.toMatchObject({ code: 'conflict' })
    expect((await questOf(a3, 'math', 'latihan')).skill_id).toBe(skillId)
  })
})
