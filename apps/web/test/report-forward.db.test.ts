import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * Laporan soal dari anak: keluarga tanpa tutor masuk ke kotak bantuan dengan kategori koreksi dan rincian soal,
 * tanpa nama anak. Keluarga bertutor tetap lewat konsol, jadi tidak ada pesan bantuan.
 */
const urls = { owner: process.env.DATABASE_URL_OWNER, app: process.env.DATABASE_URL_APP, auth: process.env.DATABASE_URL_AUTH }
const ready = Object.values(urls).every(Boolean)

describe.skipIf(!ready)('laporan soal anak ke kotak bantuan', () => {
  const owner = ready ? postgres(urls.owner!, { max: 2, onnotice: () => {} }) : (null as never)
  const run = randomUUID().slice(0, 8)
  const parentEmail = `ortu.${run}@uji.test`
  const tutorParentEmail = `ortu.tutor.${run}@uji.test`
  const orgA = randomUUID()
  const orgB = randomUUID()
  const guardianA = randomUUID()
  const learnerA = randomUUID()
  const guardianB = randomUUID()
  const tutorB = randomUUID()
  let support: typeof import('@/server/dal/support')

  beforeAll(async () => {
    process.env.KIRA_ORIGIN = 'https://kira.test'
    process.env.DATABASE_URL_APP = urls.app!
    process.env.DATABASE_URL_AUTH = urls.auth!
    process.env.KIRA_SECRET = 'uji-laporan-soal-rahasia-minimal-32-karakter'
    process.env.KIRA_DATA_DIR = '/tmp/kira-uji'
    process.env.KIRA_SUPPORT_EMAIL = 'tim.a@gatxel.test'
    support = await import('@/server/dal/support')
    await owner`insert into org (id, name) values (${orgA}, 'Uji lapor A __GTX_SEED__'), (${orgB}, 'Uji lapor B __GTX_SEED__')`
    await owner`insert into member_profile (user_id, org_id, name, role, email) values
      (${guardianA}, ${orgA}, 'Mama A', 'guardian', ${parentEmail}),
      (${guardianB}, ${orgB}, 'Mama B', 'guardian', ${tutorParentEmail}),
      (${tutorB}, ${orgB}, 'Tutor B', 'tutor', ${`tutor.${run}@uji.test`})`
    await owner`insert into auth.user_account (id, org_id, kind, role, email, name) values (${guardianA}, ${orgA}, 'adult', 'guardian', ${parentEmail}, 'Mama A')`
    await owner`insert into learner_profile (user_id, org_id, name, grade, active, screen_limit_min, rest_weekdays, started_on)
      values (${learnerA}, ${orgA}, 'NamaRahasiaAnak', 3, true, 120, '{0}', '2026-10-01')`
  })

  afterAll(async () => {
    await owner`delete from public_mail where reply_to in (${parentEmail}, ${tutorParentEmail})`
    await owner`delete from support_ticket where sender_email in (${parentEmail}, ${tutorParentEmail})`
    await owner`delete from auth.user_account where id = ${guardianA}`
    await owner`delete from org where id in (${orgA}, ${orgB})`
    await owner.end()
  })

  it('keluarga tanpa tutor: tiket koreksi memuat soal, skill, kelas, layar, dan id learner, tanpa nama anak', async () => {
    const sent = await support.forwardProblemReport({ orgId: orgA, reference: 'KR-UJI1', itemRef: 'm2.addition.001', reason: 'wrong-answer', note: 'angkanya aneh', learnerId: learnerA, screen: 'practice', ipHash: 'hash' })
    expect(sent).toBe(true)
    const [t] = await owner`select category, subject, message, sender_email, account_id, account_role, page_from from support_ticket where sender_email = ${parentEmail}`
    expect(t).toMatchObject({ category: 'koreksi', account_id: guardianA, account_role: 'guardian', page_from: 'Layar latihan anak' })
    const message = t!.message as string
    for (const part of ['m2.addition.001', 'Skill: m2.addition', 'Kelas soal: 2', 'Kelas anak: 3', `Learner: ${learnerA}`, 'Layar: Layar latihan anak', 'Jawabannya salah', 'angkanya aneh', 'KR-UJI1']) expect(message).toContain(part)
    expect(message).not.toContain('NamaRahasiaAnak')
    expect(t!.subject as string).not.toContain('NamaRahasiaAnak')
  })

  it('keluarga bertutor: tetap lewat konsol, tidak ada tiket', async () => {
    const sent = await support.forwardProblemReport({ orgId: orgB, reference: 'KR-UJI2', itemRef: 'm2.addition.001', reason: 'other', note: '', learnerId: null, screen: 'test', ipHash: 'hash' })
    expect(sent).toBe(false)
    const rows = await owner`select 1 from support_ticket where sender_email = ${tutorParentEmail}`
    expect(rows.length).toBe(0)
  })
})
