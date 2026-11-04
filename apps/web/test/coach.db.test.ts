import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { jakartaDate, weekStart } from '@kira/core'

/**
 * Pelatih Orang Tua di Postgres sungguhan: pelatih mingguan dari skill_state nyata (data cukup, tipis, kosong),
 * lembar kerja (batas harian per keluarga, soal tidak berulang, sama persis saat dibuka ulang, tidak bisa dibuka keluarga lain),
 * dan rapor bulanan (waktu belajar dan keadaan kosong).
 */

const ownerUrl = process.env.DATABASE_URL_OWNER
const appUrl = process.env.DATABASE_URL_APP
const authUrl = process.env.DATABASE_URL_AUTH
const ready = Boolean(ownerUrl && appUrl && authUrl)

describe.skipIf(!ready)('pelatih orang tua', () => {
  const owner = ready ? postgres(ownerUrl!, { max: 2, onnotice: () => {} }) : (null as never)
  const orgA = randomUUID()
  const orgB = randomUUID()
  const gA = randomUUID()
  const gB = randomUUID()
  const kid = randomUUID() // anak keluarga A, kelas 3, banyak data
  const fresh = randomUUID() // anak keluarga A, kelas 3, belum belajar
  const stranger = randomUUID() // anak keluarga A yang tidak tertaut ke orang tua A
  const other = randomUUID() // anak keluarga B
  const today = jakartaDate()
  let C: typeof import('@/server/dal/coach')
  let W: typeof import('@/server/dal/worksheet')
  let R: typeof import('@/server/dal/coach-report')
  let L: typeof import('@/server/dal/worksheet-logic')
  let dbm: typeof import('@/server/db')
  let end: () => Promise<void>

  const actor = (userId: string, orgId: string) => ({ sessionId: randomUUID(), userId, orgId, kind: 'adult' as const, role: 'guardian' as const, name: 'Orang tua uji', email: `${userId}@example.test`, deviceId: null, createdAt: new Date() })
  const PA = () => actor(gA, orgA)
  const PB = () => actor(gB, orgB)
  const state = (learner: string, org: string, skill: string, n: number, score: number, stars: number, gate: string) =>
    owner`insert into skill_state (org_id, learner_id, skill_id, theta, n_answers, recent, gate, stars)
      values (${org}, ${learner}, ${skill}, 0, ${n}, ${Array.from({ length: Math.min(n, 20) }, () => score)}, ${gate}, ${stars})`

  beforeAll(async () => {
    process.env.KIRA_ORIGIN = 'http://localhost:3100'
    process.env.DATABASE_URL_APP = appUrl!
    process.env.DATABASE_URL_AUTH = authUrl!
    process.env.KIRA_SECRET = 'uji-pelatih-orang-tua-rahasia-minimal-32-karakter'
    process.env.KIRA_DATA_DIR = '.kira-local/data'
    C = await import('@/server/dal/coach')
    W = await import('@/server/dal/worksheet')
    R = await import('@/server/dal/coach-report')
    L = await import('@/server/dal/worksheet-logic')
    dbm = await import('@/server/db')
    end = () => (dbm.appDb() as unknown as { $client: { end(): Promise<void> } }).$client.end()
    await owner`insert into org (id, name) values (${orgA}, 'Keluarga A __GTX_SEED__'), (${orgB}, 'Keluarga B __GTX_SEED__')`
    await owner`insert into member_profile (user_id, org_id, name, role, email) values
      (${gA}, ${orgA}, 'Ibu A', 'guardian', ${`${gA}@example.test`}),
      (${gB}, ${orgB}, 'Ibu B', 'guardian', ${`${gB}@example.test`})`
    await owner`insert into learner_profile (user_id, org_id, name, grade, active, screen_limit_min, rest_weekdays, started_on) values
      (${kid}, ${orgA}, 'Anak Rajin', 3, true, 90, '{}', ${today}),
      (${fresh}, ${orgA}, 'Anak Baru', 3, true, 90, '{}', ${today}),
      (${stranger}, ${orgA}, 'Anak Lain', 3, true, 90, '{}', ${today}),
      (${other}, ${orgB}, 'Anak Bayu', 3, true, 90, '{}', ${today})`
    await owner`insert into guardian_link (org_id, guardian_id, learner_id) values (${orgA}, ${gA}, ${kid}), (${orgA}, ${gA}, ${fresh}), (${orgB}, ${gB}, ${other})`
    for (const [id, org, nm] of [[kid, orgA, 'Anak Rajin'], [fresh, orgA, 'Anak Baru'], [stranger, orgA, 'Anak Lain'], [other, orgB, 'Anak Bayu']] as const) {
      await owner`insert into auth.user_account (id, org_id, kind, role, email, name) values (${id}, ${org}, 'learner', 'learner', null, ${nm})`
    }
    // Anak Rajin: tiga skill lemah (dua Math, satu Science), satu kuat, satu masih sedikit datanya.
    await state(kid, orgA, 'm3.place-value', 14, 0.4, 1, 'reteach')
    await state(kid, orgA, 'm3.compare-order', 12, 0.55, 1, 'reteach')
    await state(kid, orgA, 's3.plant-parts', 10, 0.5, 1, 'reteach')
    await state(kid, orgA, 'e3.prefixes', 16, 0.95, 3, 'mastered')
    await state(kid, orgA, 'e3.suffixes', 16, 0.9, 2, 'review')
    await state(kid, orgA, 'm3.sequences', 3, 0.3, 0, 'new')
    await owner`insert into day_record (org_id, learner_id, date, minutes, quests_done, quests_required, rest) values (${orgA}, ${kid}, ${today}, 25, 1, 3, false)`
  })

  afterAll(async () => {
    await owner`delete from org where id in (${orgA}, ${orgB})`
    await Promise.all([owner.end(), end()])
  })

  it('pelatih memilih 3 skill terlemah dari data nyata, dengan kegiatan dan satu kekuatan', async () => {
    const page = await C.parentCoachDTO(PA(), kid)
    const c = page.coach!
    expect(c.state).toBe('ok')
    expect(c.weak.map((w) => w.skillId)).toEqual(['m3.place-value', 's3.plant-parts', 'm3.compare-order'])
    expect(c.weak.every((w) => w.activity !== null && w.activity.steps.length >= 3 && w.accuracyLine.includes('%'))).toBe(true)
    // Skill dengan 3 jawaban tidak dihitung: data belum cukup.
    expect(c.weak.some((w) => w.skillId === 'm3.sequences')).toBe(false)
    expect(c.strength?.title).toBeTruthy()
    expect(c.praise.length).toBeGreaterThan(20)
    expect(c.minutesThisWeek).toBe(weekStart(today) <= today ? 25 : 0)
  })

  it('anak yang belum belajar mendapat penjelasan jujur dan satu kegiatan ringan, bukan layar kosong', async () => {
    const c = (await C.parentCoachDTO(PA(), fresh)).coach!
    expect(c.state).toBe('empty')
    expect(c.weak).toEqual([])
    expect(c.note).toMatch(/Belum cukup data/)
    expect(c.starter?.steps.length).toBeGreaterThanOrEqual(3)
    expect(c.strength).toBeNull()
  })

  it('orang tua tidak bisa menjangkau anak yang bukan miliknya', async () => {
    const page = await C.parentCoachDTO(PA(), stranger)
    // Param anak asing diabaikan: jatuh ke anak pertama yang tertaut.
    expect([kid, fresh]).toContain(page.selectedId)
    expect(page.children.map((c) => c.id)).not.toContain(stranger)
    await expect(W.createWorksheet(PA(), { learnerId: stranger, skillId: 'm3.place-value', length: 'short' })).rejects.toMatchObject({ code: expect.stringMatching(/^(forbidden|not-found)$/) })
  })

  it('lembar kerja: soal tidak berulang, naik dari mudah, sama saat dibuka ulang, kunci cocok', async () => {
    const { id } = await W.createWorksheet(PA(), { learnerId: kid, skillId: 'm3.place-value', length: 'long' })
    const sheet = await W.worksheetPrintDTO(PA(), id, false)
    const again = await W.worksheetPrintDTO(PA(), id, false)
    const key = await W.worksheetPrintDTO(PA(), id, true)
    const prompts = sheet.sections[0]!.items.map((q) => q.item.prompt)
    expect(prompts.length).toBe(15)
    // Soal generator boleh punya kalimat sama dengan gambar berbeda; yang tidak boleh adalah dua soal yang identik.
    const same = sheet.sections[0]!.items.map(({ item }) => JSON.stringify({ ...item, ref: undefined, reveal: undefined }))
    expect(new Set(same).size).toBe(same.length)
    expect(again.sections[0]!.items.map((q) => q.item.prompt)).toEqual(prompts)
    expect(key.sections[0]!.items.map((q) => q.item.prompt)).toEqual(prompts)
    expect(key.sections[0]!.items.every((q) => (q.answerText ?? '').length > 0)).toBe(true)
    expect(sheet.sections[0]!.items.every((q) => q.answerText === undefined)).toBe(true)
    expect(key.keyLabel).toMatch(/orang tua/)
  })

  it('lembar kerja: keluarga lain tidak bisa membuka lembar ini', async () => {
    const { id } = await W.createWorksheet(PA(), { learnerId: kid, skillId: 'e3.prefixes', length: 'short' })
    await expect(W.worksheetPrintDTO(PB(), id, false)).rejects.toMatchObject({ code: expect.stringMatching(/^(forbidden|not-found)$/) })
    const rows = await owner`select count(*)::int as n from worksheet where id = ${id}`
    expect(rows[0]!.n).toBe(1)
  })

  it('lembar kerja: batas harian per keluarga, dan membuka ulang tidak memakai jatah', async () => {
    const [{ n }] = (await owner`select count(*)::int as n from worksheet where org_id = ${orgA}`) as unknown as [{ n: number }]
    for (let i = n; i < L.WORKSHEET_PER_DAY; i++) await W.createWorksheet(PA(), { learnerId: kid, skillId: 'm3.compare-order', length: 'short' })
    await expect(W.createWorksheet(PA(), { learnerId: kid, skillId: 'm3.compare-order', length: 'short' })).rejects.toMatchObject({ code: 'invalid', userMessage: expect.stringMatching(/Batas/) })
    const [{ id }] = (await owner`select id from worksheet where org_id = ${orgA} limit 1`) as unknown as [{ id: string }]
    await expect(W.worksheetPrintDTO(PA(), id, false)).resolves.toBeTruthy()
    // Keluarga B tidak terpengaruh batas keluarga A.
    await expect(W.createWorksheet(PB(), { learnerId: other, skillId: 'm3.place-value', length: 'short' })).resolves.toHaveProperty('id')
  })

  it('RLS: peran anak tidak bisa membaca lembar kerja', async () => {
    const rows = await dbm.inOrg({ orgId: orgA, userId: kid, role: 'learner' }, (tx) => tx.execute(`select id from worksheet` as never))
    expect((rows as unknown as unknown[]).length).toBe(0)
  })

  it('rapor bulanan: waktu belajar dihitung, bulan kosong memberi catatan yang membantu', async () => {
    const month = today.slice(0, 7)
    const page = await R.parentReportDTO(PA(), kid, month)
    expect(page.report!.minutes).toBe(25)
    expect(page.report!.activeDays).toBe(1)
    expect(page.report!.hasData).toBe(true)
    expect(page.report!.coverage.length).toBe(3)
    const empty = await R.parentReportDTO(PA(), fresh, month)
    expect(empty.report!.hasData).toBe(false)
    expect(empty.report!.emptyNote).toMatch(/Belum ada kegiatan belajar/)
    expect(empty.report!.next.length).toBeGreaterThan(0)
    expect(empty.report!.coverageNote).toMatch(/mengacu pada kerangka Cambridge Primary/)
  })
})
