import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { addDays, jakartaDate, weekStart, weekday } from '@kira/core'

/**
 * Perencana mingguan di Postgres sungguhan: sesi wajib dari template, slot yang menggantikan sesi dasar,
 * sesi opsional (paling banyak 10), template Hari ringan, salin minggu, meteran waktu layar, dan sesi hari ini.
 * Butuh DATABASE_URL_OWNER dan DATABASE_URL_APP dan migrasi sudah dijalankan.
 */

const ownerUrl = process.env.DATABASE_URL_OWNER
const appUrl = process.env.DATABASE_URL_APP
const ready = Boolean(ownerUrl && appUrl)

describe.skipIf(!ready)('perencana sesi', () => {
  const owner = ready ? postgres(ownerUrl!, { max: 2, onnotice: () => {} }) : (null as never)
  const orgId = randomUUID()
  const learnerId = randomUUID()
  const tutorId = randomUUID()
  const today = jakartaDate()
  const nextMonday = weekStart(addDays(today, 7))
  const monday2 = addDays(nextMonday, 7)
  const day = (i: number) => addDays(nextMonday, i)
  let planner: typeof import('@/server/dal/console-planner')
  let session: typeof import('@/server/dal/learner-session')
  let core: typeof import('@/server/dal/learner-core')
  let end: () => Promise<void>

  const actor = () => ({ sessionId: randomUUID(), userId: tutorId, orgId, kind: 'adult' as const, role: 'tutor' as const, name: 'Tutor uji', email: 'uji-rencana@example.test', deviceId: null, createdAt: new Date() })
  const dto = async (week = nextMonday) => {
    const d = await planner.plannerDTO(actor(), learnerId, week)
    expect(d).not.toBeNull()
    return d!
  }
  const base = (over: Partial<import('@/lib/dto').UpsertSlotInput>): import('@/lib/dto').UpsertSlotInput => ({
    learnerId,
    date: day(1),
    subject: 'math',
    session: 'latihan',
    required: false,
    skillId: null,
    mode: 'latihan',
    questionCount: 10,
    paperKind: null,
    config: null,
    ...over,
  })

  beforeAll(async () => {
    process.env.KIRA_ORIGIN = 'http://localhost:3100'
    process.env.DATABASE_URL_APP = appUrl!
    process.env.DATABASE_URL_AUTH = appUrl!
    process.env.KIRA_SECRET = 'uji-rencana-harian-rahasia-minimal-32-karakter'
    process.env.KIRA_DATA_DIR = '.kira-local/data'
    planner = await import('@/server/dal/console-planner')
    session = await import('@/server/dal/learner-session')
    core = await import('@/server/dal/learner-core')
    const db = await import('@/server/db')
    end = () => (db.appDb() as unknown as { $client: { end(): Promise<void> } }).$client.end()
    await owner`insert into org (id, name) values (${orgId}, 'Uji rencana __GTX_SEED__')`
    await owner`insert into member_profile (user_id, org_id, name, role, email) values (${tutorId}, ${orgId}, 'Tutor uji', 'tutor', 'uji-rencana@example.test')`
    await owner`insert into learner_profile (user_id, org_id, name, grade, active, screen_limit_min, rest_weekdays, started_on)
      values (${learnerId}, ${orgId}, 'Anak uji', 2, true, 120, '{0}', '2026-10-01')`
  })

  afterAll(async () => {
    await owner`delete from org where id = ${orgId}`
    await Promise.all([owner.end(), end()])
  })

  it('minggu kosong: Senin sampai Jumat 9 sesi wajib otomatis, Sabtu satu paper penuh, Minggu istirahat', async () => {
    const d = await dto()
    expect(d.days.map((x) => x.rest)).toEqual([false, false, false, false, false, false, true])
    for (let i = 0; i < 5; i++) {
      expect(d.days[i]).toMatchObject({ template: 'school', requiredCount: 9, extraCount: 0, overLimit: false })
      expect(d.days[i]!.totalMinutes).toBeGreaterThanOrEqual(90)
      expect(d.days[i]!.totalMinutes).toBeLessThanOrEqual(110)
    }
    expect(d.days[5]).toMatchObject({ template: 'saturday', requiredCount: 9 })
    const sat = d.slots.filter((s) => s.date === day(5) && s.session === 'paper')
    expect(sat.filter((s) => s.paperKind === 'full')).toHaveLength(1)
    expect(sat.filter((s) => s.paperKind === 'mini')).toHaveLength(2)
    expect(d.slots.filter((s) => s.date === day(0)).every((s) => s.auto && s.required)).toBe(true)
    expect(d.slots.some((s) => s.date === day(6))).toBe(false)
    expect(d.presets.length).toBeGreaterThan(0)
  })

  it('slot wajib menggantikan sesi dasar yang sama; slot kedua menambah sesi wajib', async () => {
    const skill = 'm2.place-value'
    await planner.upsertSlot(actor(), base({ date: day(0), required: true, skillId: skill }))
    let d = await dto()
    const mon = d.slots.filter((s) => s.date === day(0) && s.subject === 'math' && s.session === 'latihan')
    expect(mon).toHaveLength(1)
    expect(mon[0]).toMatchObject({ auto: false, required: true, skillId: skill })
    expect(d.days[0]!.requiredCount).toBe(9)
    await planner.upsertSlot(actor(), base({ date: day(0), required: true, skillId: 'm2.arrays' }))
    d = await dto()
    expect(d.slots.filter((s) => s.date === day(0) && s.subject === 'math' && s.session === 'latihan' && s.required)).toHaveLength(2)
    expect(d.days[0]!.requiredCount).toBe(10)
  })

  it('sesi opsional: semua jenis bisa ditambah, paling banyak 10 per hari, dan tidak dihitung wajib', async () => {
    const date = day(2)
    const adds = [
      base({ date, session: 'review' }),
      base({ date, session: 'quick-maths' }),
      base({ date, subject: 'english', session: 'english-skill', config: { task: 'listening' } }),
      base({ date, session: 'simulation', config: { presetId: 'ikmc-pre-ecolier-2027' } }),
      base({ date, session: 'lesson', skillId: 'm2.place-value' }),
      base({ date, session: 'esmo' }),
      base({ date, session: 'knowledge' }),
      base({ date, subject: 'english', session: 'reading', skillId: 'e2.reading-information' }),
      base({ date, session: 'paper', paperKind: 'mini' }),
      base({ date, session: 'tes', skillId: null, questionCount: 8, mode: 'tes' }),
    ]
    for (const a of adds) await planner.upsertSlot(actor(), a)
    const d = await dto()
    expect(d.days[2]).toMatchObject({ requiredCount: 9, extraCount: 10 })
    await expect(planner.upsertSlot(actor(), base({ date, session: 'review' }))).rejects.toMatchObject({ code: 'conflict' })
    // Validasi server: simulasi butuh preset, Math tidak boleh Tugas English.
    await expect(planner.upsertSlot(actor(), base({ date: day(3), session: 'simulation' }))).rejects.toMatchObject({ code: 'invalid' })
    await expect(planner.upsertSlot(actor(), base({ date: day(3), session: 'english-skill', config: { task: 'listening' } }))).rejects.toMatchObject({ code: 'invalid' })
  })

  it('terbit lalu Today membuat sesi wajib dan sesi opsional hari itu', async () => {
    expect((await dto()).status).toBe('draft')
    await planner.publishWeek(actor(), { learnerId, weekStart: nextMonday })
    expect((await dto()).status).toBe('published')
    const quests = await ensureOn(day(2))
    expect(quests.filter((q) => q.kind === 'daily')).toHaveLength(9)
    const extras = quests.filter((q) => q.kind === 'extra')
    expect(extras).toHaveLength(10)
    // Sesi tautan tidak punya attempt; Latihan, Tes, dan Paper opsional dikerjakan di runner.
    for (const q of extras) {
      const link = !['latihan', 'tes', 'paper', 'reading'].includes(q.session)
      expect(q.attemptId === null, q.session).toBe(link)
    }
    const [dr] = await owner`select quests_required from day_record where learner_id = ${learnerId} and date = ${day(2)}`
    expect(dr!.quests_required).toBe(9)
    // Hari Senin: Latihan Math dari slot tutor menggantikan pilihan otomatis, dan slot kedua menjadi sesi wajib ke-10.
    const mon = await ensureOn(day(0))
    expect(mon.filter((q) => q.kind === 'daily')).toHaveLength(10)
    const mathLat = mon.filter((q) => q.subject === 'math' && q.session === 'latihan').sort((x, y) => x.seq - y.seq)
    expect(mathLat.map((q) => q.skillId)).toEqual(['m2.place-value', 'm2.arrays'])
  })

  it('Hari ringan: 3 sesi wajib, dan template bawaan hari itu tidak disimpan', async () => {
    await planner.setDayTemplate(actor(), { learnerId, date: day(3), template: 'light' })
    let d = await dto()
    expect(d.days[3]).toMatchObject({ template: 'light', requiredCount: 3 })
    expect(d.days[3]!.totalMinutes).toBeLessThan(30)
    const [row] = await owner`select day_templates from plan_week where learner_id = ${learnerId} and week_start = ${nextMonday}`
    expect(row!.day_templates).toEqual({ [day(3)]: 'light' })
    await planner.setDayTemplate(actor(), { learnerId, date: day(3), template: 'school' })
    d = await dto()
    expect(d.days[3]).toMatchObject({ template: 'school', requiredCount: 9 })
    const [row2] = await owner`select day_templates from plan_week where learner_id = ${learnerId} and week_start = ${nextMonday}`
    expect(row2!.day_templates).toEqual({})
    // Jumat bisa dijadikan template Sabtu dan sebaliknya; paper penuh ikut berpindah ke mapel yang bergiliran.
    await planner.setDayTemplate(actor(), { learnerId, date: day(4), template: 'saturday' })
    d = await dto()
    expect(d.slots.filter((s) => s.date === day(4) && s.paperKind === 'full')).toHaveLength(1)
    await planner.setDayTemplate(actor(), { learnerId, date: day(4), template: 'school' })
  })

  it('meteran: hari sekolah dengan sesi opsional panjang melewati batas waktu layar', async () => {
    await planner.upsertSlot(actor(), base({ date: day(1), session: 'simulation', config: { presetId: 'ikmc-pre-ecolier-2027' } }))
    const d = await dto()
    expect(d.days[1]!.totalMinutes).toBeGreaterThan(120)
    expect(d.days[1]).toMatchObject({ overLimit: true })
    expect(d.days[1]!.requiredMinutes).toBeLessThan(110)
  })

  it('pindah slot opsional ke hari lain dan hapus slot', async () => {
    const d = await dto()
    const sim = d.slots.find((s) => s.date === day(1) && s.session === 'simulation')!
    await planner.moveSlot(actor(), { slotId: sim.id, date: day(4) })
    expect((await dto()).slots.find((s) => s.id === sim.id)?.date).toBe(day(4))
    await planner.deleteSlot(actor(), sim.id)
    expect((await dto()).slots.some((s) => s.id === sim.id)).toBe(false)
  })

  it('salin minggu: slot dan template ikut, hari lewat dan istirahat dilewati', async () => {
    const before = await dto()
    const customSlots = before.slots.filter((s) => !s.auto).length
    const r = await planner.copyWeek(actor(), { learnerId, fromWeekStart: nextMonday, toWeekStart: monday2 })
    expect(r.copied).toBe(customSlots)
    const after = await dto(monday2)
    expect(after.slots.filter((s) => !s.auto)).toHaveLength(customSlots)
    expect(after.days[0]).toMatchObject({ requiredCount: 10 })
    expect(after.days[2]).toMatchObject({ extraCount: 10 })
    await expect(planner.copyWeek(actor(), { learnerId, fromWeekStart: monday2, toWeekStart: monday2 })).rejects.toMatchObject({ code: 'invalid' })
    await expect(planner.copyWeek(actor(), { learnerId, fromWeekStart: addDays(monday2, 14), toWeekStart: addDays(monday2, 21) })).rejects.toMatchObject({ code: 'conflict' })
  })

  it('hari ini yang sesinya sudah dibuat: sesi wajib ditolak, sesi opsional boleh, Hari ringan membuang Tes dan Paper', async () => {
    if (weekday(today) === 0) return // Minggu istirahat, tidak ada sesi hari ini
    await ensureOn(today)
    await expect(planner.upsertSlot(actor(), base({ date: today, required: true, skillId: 'm2.place-value' }))).rejects.toMatchObject({ code: 'conflict' })
    await planner.upsertSlot(actor(), base({ date: today, session: 'review' }))
    // Template lain tidak berlaku untuk hari ini, dan Hari ringan hanya setelah minggu itu terbit.
    await expect(planner.setDayTemplate(actor(), { learnerId, date: today, template: 'school' })).rejects.toMatchObject({ code: 'conflict' })
    await expect(planner.setDayTemplate(actor(), { learnerId, date: today, template: 'light' })).rejects.toMatchObject({ code: 'conflict' })
    await planner.publishWeek(actor(), { learnerId, weekStart: weekStart(today) })
    await planner.setDayTemplate(actor(), { learnerId, date: today, template: 'light' })
    const [dr] = await owner`select quests_required from day_record where learner_id = ${learnerId} and date = ${today}`
    expect(dr!.quests_required).toBe(3)
    const left = await owner`select session from quest where learner_id = ${learnerId} and date = ${today} and kind = 'daily'`
    expect(left.every((q) => q.session === 'latihan')).toBe(true)
    // Today berikutnya tidak membuat Tes dan Paper lagi, dan sesi opsional yang ditambah tutor ikut dibuat.
    const again = await ensureOn(today)
    expect(again.filter((q) => q.kind === 'daily')).toHaveLength(3)
    expect(again.some((q) => q.kind === 'extra' && q.session === 'review')).toBe(true)
  })

  /** Jalankan ensureTodayQuests untuk learner uji pada tanggal itu, sebagai learner. */
  async function ensureOn(date: string) {
    const { withOrg, createDb } = await import('@kira/db/client')
    const app = createDb(appUrl, { name: 'planner-flow', max: 2 })
    const ctx = { orgId, userId: learnerId, role: 'learner' as const }
    try {
      return await withOrg(app.db, ctx, async (t) => session.ensureTodayQuests(t, ctx, await core.loadLearner(t, learnerId), date))
    } finally {
      await app.client.end()
    }
  }
})
