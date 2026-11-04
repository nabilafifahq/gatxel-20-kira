import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * Bahasa tampilan anak di Postgres sungguhan: bawaan kolom, orang tua hanya bisa mengubah anaknya sendiri,
 * dan bahasa untuk layar tanpa sesi di tablet.
 */

const ownerUrl = process.env.DATABASE_URL_OWNER
const appUrl = process.env.DATABASE_URL_APP
const authUrl = process.env.DATABASE_URL_AUTH
const ready = Boolean(ownerUrl && appUrl && authUrl)

describe.skipIf(!ready)('bahasa tampilan anak', () => {
  const owner = ready ? postgres(ownerUrl!, { max: 2, onnotice: () => {} }) : (null as never)
  const orgA = randomUUID()
  const orgB = randomUUID()
  const gA = randomUUID()
  const a1 = randomUUID()
  const a2 = randomUUID()
  const b1 = randomUUID()
  let P: typeof import('@/server/dal/parent-control')
  let D: typeof import('@/server/auth/device')
  let A: typeof import('@/server/auth/accounts')
  let end: () => Promise<void>

  const parentA = () => ({ sessionId: randomUUID(), userId: gA, orgId: orgA, kind: 'adult' as const, role: 'guardian' as const, name: 'Ibu A', email: `${gA}@example.test`, deviceId: null, createdAt: new Date() })
  const langOf = async (id: string) => (await owner`select ui_lang, ui_lang_switch from auth.user_account where id = ${id}`)[0]!

  beforeAll(async () => {
    process.env.KIRA_ORIGIN = 'http://localhost:3100'
    process.env.DATABASE_URL_APP = appUrl!
    process.env.DATABASE_URL_AUTH = authUrl!
    process.env.KIRA_SECRET = 'uji-bahasa-tampilan-rahasia-minimal-32-karakter'
    process.env.KIRA_DATA_DIR = '.kira-local/data'
    P = await import('@/server/dal/parent-control')
    D = await import('@/server/auth/device')
    A = await import('@/server/auth/accounts')
    const dbm = await import('@/server/db')
    end = () => (dbm.appDb() as unknown as { $client: { end(): Promise<void> } }).$client.end()
    await owner`insert into org (id, name) values (${orgA}, 'Keluarga A __GTX_SEED__'), (${orgB}, 'Keluarga B __GTX_SEED__')`
    await owner`insert into member_profile (user_id, org_id, name, role, email) values (${gA}, ${orgA}, 'Ibu A', 'guardian', ${`${gA}@example.test`})`
    await owner`insert into learner_profile (user_id, org_id, name, grade, active, screen_limit_min, rest_weekdays) values
      (${a1}, ${orgA}, 'Anak Satu', 2, true, 90, '{}'),
      (${a2}, ${orgA}, 'Anak Dua', 3, true, 90, '{}'),
      (${b1}, ${orgB}, 'Anak Bayu', 4, true, 90, '{}')`
    await owner`insert into guardian_link (org_id, guardian_id, learner_id) values (${orgA}, ${gA}, ${a1})`
    for (const [id, org, nm] of [[a1, orgA, 'Anak Satu'], [a2, orgA, 'Anak Dua'], [b1, orgB, 'Anak Bayu']] as const) {
      await owner`insert into auth.user_account (id, org_id, kind, role, email, name) values (${id}, ${org}, 'learner', 'learner', null, ${nm})`
    }
  })

  afterAll(async () => {
    await owner`delete from auth.user_account where org_id in (${orgA}, ${orgB})`
    await owner`delete from org where id in (${orgA}, ${orgB})`
    await Promise.all([owner.end(), end()])
  })

  it('anak baru memakai Indonesia dan belum boleh mengganti sendiri', async () => {
    expect(await langOf(a1)).toEqual({ ui_lang: 'id', ui_lang_switch: false })
  })

  it('kolom hanya menerima id dan en', async () => {
    await expect(owner`update auth.user_account set ui_lang = 'fr' where id = ${a1}`).rejects.toThrow(/user_account_ui_lang_ck/)
  })

  it('orang tua mengubah bahasa anaknya, dan pembacaan DTO mengikuti', async () => {
    await P.parentSaveUiLang(parentA(), { learnerId: a1, uiLang: 'en', uiLangSwitch: true })
    expect(await langOf(a1)).toEqual({ ui_lang: 'en', ui_lang_switch: true })
    expect((await A.learnerUiPrefs([a1], orgA)).get(a1)).toEqual({ uiLang: 'en', uiLangSwitch: true })
    const audit = await owner`select action from audit_log where org_id = ${orgA} and action = 'parent.uilang'`
    expect(audit.length).toBeGreaterThan(0)
    await P.parentSaveUiLang(parentA(), { learnerId: a1, uiLang: 'id', uiLangSwitch: false })
  })

  it('anak yang tidak tertaut dan anak keluarga lain ditolak, datanya tidak berubah', async () => {
    for (const other of [a2, b1]) {
      await expect(P.parentSaveUiLang(parentA(), { learnerId: other, uiLang: 'en', uiLangSwitch: true })).rejects.toMatchObject({ code: 'forbidden' })
      expect(await langOf(other)).toEqual({ ui_lang: 'id', ui_lang_switch: false })
    }
  })

  it('pembaruan langsung dibatasi org: akun keluarga lain tidak tersentuh', async () => {
    await A.setLearnerUiPrefs(b1, orgA, { uiLang: 'en' })
    expect((await langOf(b1)).ui_lang).toBe('id')
  })

  it('tablet: Inggris hanya bila semua anaknya Inggris', async () => {
    expect(await D.deviceUiLang([])).toBe('id')
    expect(await D.deviceUiLang([a1, a2])).toBe('id')
    await owner`update auth.user_account set ui_lang = 'en' where id = ${a1}`
    expect(await D.deviceUiLang([a1, a2])).toBe('id')
    expect(await D.deviceUiLang([a1])).toBe('en')
    await owner`update auth.user_account set ui_lang = 'id' where id = ${a1}`
  })
})
