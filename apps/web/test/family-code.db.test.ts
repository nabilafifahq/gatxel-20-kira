import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

/**
 * Kode keluarga di Postgres sungguhan, lewat role yang dipakai aplikasi: kode keluarga A tidak pernah membuka keluarga B,
 * mengganti kode tidak mengeluarkan perangkat, anak terhapus atau nonaktif tidak terdaftar, dan percobaan kode dibatasi.
 */
const jar = new Map<string, string>()
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (n: string) => (jar.has(n) ? { value: jar.get(n)! } : undefined),
    set: (n: string, v: string, o?: { maxAge?: number }) => {
      if (o?.maxAge === 0) jar.delete(n)
      else jar.set(n, v)
    },
  }),
  headers: async () => new Headers({ 'cf-connecting-ip': '203.0.113.77' }),
}))
vi.mock('next/cache', () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }))

const ownerUrl = process.env.DATABASE_URL_OWNER
const appUrl = process.env.DATABASE_URL_APP
const authUrl = process.env.DATABASE_URL_AUTH
const ready = Boolean(ownerUrl && appUrl && authUrl)
const PIN = ['sun', 'moon', 'star', 'cat'] as const
const WRONG = ['tree', 'apple', 'boat', 'ball'] as const

describe.skipIf(!ready)('kode keluarga', () => {
  const owner = ready ? postgres(ownerUrl!, { max: 2, onnotice: () => {} }) : (null as never)
  const app = ready ? postgres(appUrl!, { max: 1, onnotice: () => {} }) : (null as never)
  const auth = ready ? postgres(authUrl!, { max: 1, onnotice: () => {} }) : (null as never)
  const orgA = randomUUID()
  const orgB = randomUUID()
  const a1 = randomUUID()
  const a2 = randomUUID()
  const aOff = randomUUID()
  const aGone = randomUUID()
  const aNoPin = randomUUID()
  const b1 = randomUUID()
  const gA = randomUUID()
  let F: typeof import('@/server/auth/family-code')
  let Act: typeof import('@/server/actions/family-code')
  let Adm: typeof import('@/server/auth/admin')
  let Dal: typeof import('@/server/dal/family-code')
  let Dev: typeof import('@/server/auth/device')
  let end: () => Promise<void>

  const codeOf = async (org: string) => (await owner`select code from family_code where org_id = ${org}`)[0]!.code as string
  const parentA = () => ({ sessionId: randomUUID(), userId: gA, orgId: orgA, kind: 'adult' as const, role: 'guardian' as const, name: 'Ibu A', email: `${gA}@example.test`, deviceId: null, createdAt: new Date() })

  beforeAll(async () => {
    process.env.KIRA_ORIGIN = 'http://localhost:3100'
    process.env.DATABASE_URL_APP = appUrl!
    process.env.DATABASE_URL_AUTH = authUrl!
    process.env.KIRA_SECRET = 'uji-kode-keluarga-rahasia-minimal-32-karakter'
    process.env.KIRA_DATA_DIR = '.kira-local/data'
    delete process.env.KIRA_VALKEY_URL
    delete process.env.KIRA_TURNSTILE_SITE_KEY
    delete process.env.KIRA_TURNSTILE_SECRET
    F = await import('@/server/auth/family-code')
    Act = await import('@/server/actions/family-code')
    Adm = await import('@/server/auth/admin')
    Dal = await import('@/server/dal/family-code')
    Dev = await import('@/server/auth/device')
    const pw = await import('@/server/auth/password')
    const pin = await import('@/server/auth/pin')
    const dbm = await import('@/server/db')
    end = () => (dbm.appDb() as unknown as { $client: { end(): Promise<void> } }).$client.end()
    await owner`insert into org (id, name) values (${orgA}, 'Keluarga A __GTX_SEED__'), (${orgB}, 'Keluarga B __GTX_SEED__')`
    await owner`insert into member_profile (user_id, org_id, name, role, email) values (${gA}, ${orgA}, 'Ibu A', 'guardian', ${`${gA}@example.test`})`
    const kids = [
      [a1, orgA, 'Aisha Putri', true, null],
      [a2, orgA, 'Bima Sakti', true, null],
      [aOff, orgA, 'Citra Nonaktif', false, null],
      [aGone, orgA, 'Dewi Terhapus', true, new Date()],
      [aNoPin, orgA, 'Eka Belumpin', true, null],
      [b1, orgB, 'Farah Lain', true, null],
    ] as const
    for (const [id, org, nm, active, del] of kids) {
      await owner`insert into learner_profile (user_id, org_id, name, grade, active, screen_limit_min, rest_weekdays, deleted_at) values (${id}, ${org}, ${nm}, 3, ${active}, 90, '{}', ${del})`
      await owner`insert into auth.user_account (id, org_id, kind, role, email, name) values (${id}, ${org}, 'learner', 'learner', null, ${nm})`
      if (id !== aNoPin) await pin.setPin(id, PIN)
    }
    await owner`insert into guardian_link (org_id, guardian_id, learner_id) values (${orgA}, ${gA}, ${a1}), (${orgA}, ${gA}, ${a2})`
    void pw
  })

  afterAll(async () => {
    await owner`delete from auth.device where org_id in (${orgA}, ${orgB})`
    await owner`delete from auth.session where org_id in (${orgA}, ${orgB})`
    await owner`delete from auth.user_account where org_id in (${orgA}, ${orgB})`
    await owner`delete from org where id in (${orgA}, ${orgB})`
    await Promise.all([owner.end(), app.end(), auth.end()])
    await end()
  })

  it('setiap org baru otomatis punya kode dengan bentuk yang benar, dan semua kode unik', async () => {
    const a = await codeOf(orgA)
    const b = await codeOf(orgB)
    expect(a).toMatch(/^[23456789BCDFGHJKMNPQRSTVWXYZ]{8}$/)
    expect(b).toMatch(/^[23456789BCDFGHJKMNPQRSTVWXYZ]{8}$/)
    expect(a).not.toBe(b)
    const [{ dup }] = (await owner`select count(*) - count(distinct code) as dup from family_code`) as unknown as [{ dup: string }]
    expect(Number(dup)).toBe(0)
    const [{ missing }] = (await owner`select count(*)::int as missing from org o where not exists (select 1 from family_code f where f.org_id = o.id)`) as unknown as [{ missing: number }]
    expect(missing).toBe(0)
  })

  it('kode keluarga A hanya membuka keluarga A; kode tak dikenal tidak membuka apa pun', async () => {
    const a = await F.orgForFamilyCode(await codeOf(orgA))
    expect(a).toBe(orgA)
    const names = (await F.familyChildChoices(orgA)).map((c) => c.firstName)
    expect(names).toEqual(['Aisha', 'Bima'])
    expect(names.join()).not.toContain('Farah')
    expect(await F.orgForFamilyCode('BBBBBBBB')).toBeNull()
    expect(await F.orgForFamilyCode('bukan-kode')).toBeNull()
    expect(await F.familyChildChoice(orgA, b1)).toBeNull()
  })

  it('daftar nama: hanya nama depan, tanpa anak nonaktif, terhapus, atau belum ber-PIN', async () => {
    const list = await F.familyChildChoices(orgA)
    expect(list.map((c) => c.id).sort()).toEqual([a1, a2].sort())
    expect(Object.keys(list[0]!).sort()).toEqual(['firstName', 'id'])
  })

  it('role anak dan kira_auth tidak bisa membaca tabel kode; kira_app hanya org sendiri', async () => {
    await expect(auth`select * from family_code`).rejects.toThrow(/permission denied/)
    const read = (org: string, role: string) =>
      app.begin(async (tx) => {
        await tx`select set_config('app.org_id', ${org}, true), set_config('app.user_id', ${randomUUID()}, true), set_config('app.role', ${role}, true)`
        return tx`select org_id from family_code`
      })
    expect((await read(orgA, 'guardian')).map((r) => r.org_id)).toEqual([orgA])
    expect((await read(orgA, 'tutor')).map((r) => r.org_id)).toEqual([orgA])
    expect(await read(orgA, 'learner')).toEqual([])
    await expect(app`update family_code set code = 'BBBBBBBB'`).rejects.toThrow(/permission denied/)
    await expect(app`select kira_rotate_family_code(${orgB}::uuid)`).rejects.toThrow(/permission denied/)
    await expect(app`select kira_org_by_family_code('BBBBBBBB')`).rejects.toThrow(/permission denied/)
  })

  it('kode saja tidak memberi akses: tanpa PIN benar tidak ada sesi dan tidak ada perangkat', async () => {
    jar.clear()
    expect((await Act.checkFamilyCodeAction({ code: (await codeOf(orgA)).toLowerCase() })).ok).toBe(true)
    expect(jar.has('__Host-kira.kode')).toBe(true)
    const wrong = await Act.submitFamilyPinAction(a1, [...WRONG])
    expect(wrong.ok).toBe(false)
    expect(jar.has('__Host-kira.session')).toBe(false)
    expect(jar.has('__Host-kira.device')).toBe(false)
    const [{ n }] = (await owner`select count(*)::int as n from auth.device where org_id = ${orgA}`) as unknown as [{ n: number }]
    expect(n).toBe(0)
  })

  it('tiket keluarga A tidak bisa dipakai untuk anak keluarga B atau anak nonaktif', async () => {
    jar.clear()
    expect((await Act.checkFamilyCodeAction({ code: await codeOf(orgA) })).ok).toBe(true)
    for (const other of [b1, aOff, aGone, aNoPin]) {
      const r = await Act.submitFamilyPinAction(other, [...PIN])
      expect(r.ok).toBe(false)
    }
    const [{ failed }] = (await owner`select failed_pins as failed from auth.learner_secret where user_id = ${b1}`) as unknown as [{ failed: number }]
    expect(failed).toBe(0)
  })

  it('PIN benar: browser menjadi perangkat terdaftar yang terlihat dan bisa dicabut, tercatat di audit', async () => {
    jar.clear()
    await owner`update auth.learner_secret set failed_pins = 0, locked_until = null where user_id = ${a1}`
    expect((await Act.checkFamilyCodeAction({ code: await codeOf(orgA) })).ok).toBe(true)
    const r = await Act.submitFamilyPinAction(a1, [...PIN])
    expect(r).toEqual({ ok: true, data: { redirectTo: '/today' } })
    expect(jar.has('__Host-kira.device')).toBe(true)
    expect(jar.has('__Host-kira.session')).toBe(true)
    expect(jar.has('__Host-kira.kode')).toBe(false)

    const listed = await Adm.listDevices(orgA)
    expect(listed).toHaveLength(1)
    expect(listed[0]!.name).toBe('Perangkat Aisha')
    expect(listed[0]!.learnerIds).toEqual([a1])
    const seen = await Dal.familyDevicesFor(parentA())
    expect(seen.map((d) => d.id)).toEqual([listed[0]!.id])

    const actions = (await owner`select action, meta from audit_log where org_id = ${orgA} order by created_at`).map((x) => x.action as string)
    expect(actions).toEqual(expect.arrayContaining(['family_code.used', 'device.registered', 'login.family_code']))
    const raw = JSON.stringify(await owner`select meta, target from audit_log where org_id = ${orgA}`)
    expect(raw).not.toContain(await codeOf(orgA))

    // Mengganti kode tidak mengeluarkan perangkat; kode lama langsung gugur, juga tiket yang memakainya.
    const before = await codeOf(orgA)
    expect((await Act.checkFamilyCodeAction({ code: before })).ok).toBe(true)
    const fresh = await Dal.rotateFamilyCode(parentA())
    expect(fresh).not.toBe(before)
    expect(await codeOf(orgA)).toBe(fresh)
    expect(await F.orgForFamilyCode(before)).toBeNull()
    expect(await F.orgForFamilyCode(fresh)).toBe(orgA)
    expect(await F.readFamilyTicket()).toBeNull()
    expect((await Act.checkFamilyCodeAction({ code: before })).ok).toBe(false)
    expect((await Adm.listDevices(orgA)).map((d) => d.id)).toEqual([listed[0]!.id])
    expect((await Dev.getDevice())?.id).toBe(listed[0]!.id)
    const [{ rotated }] = (await owner`select count(*)::int as rotated from audit_log where org_id = ${orgA} and action = 'family_code.rotated'`) as unknown as [{ rotated: number }]
    expect(rotated).toBe(1)

    // Saudara di browser yang sama menambah anak ke perangkat itu, tanpa perangkat baru.
    jar.delete('__Host-kira.session')
    expect((await Act.checkFamilyCodeAction({ code: fresh })).ok).toBe(true)
    expect((await Act.submitFamilyPinAction(a2, [...PIN])).ok).toBe(true)
    const after = await Adm.listDevices(orgA)
    expect(after).toHaveLength(1)
    expect(after[0]!.learnerIds.sort()).toEqual([a1, a2].sort())

    // Dicabut dengan cara yang sama seperti perangkat lain.
    expect(await Adm.revokeDevice(orgA, listed[0]!.id)).toBe(true)
    expect(await Adm.listDevices(orgA)).toHaveLength(0)
  })

  it('tiket palsu ditolak', async () => {
    jar.clear()
    jar.set('__Host-kira.kode', `${await codeOf(orgA)}.${Date.now() + 60_000}.palsu`)
    expect(await F.readFamilyTicket()).toBeNull()
    const r = await Act.submitFamilyPinAction(a1, [...PIN])
    expect(r.ok).toBe(false)
  })

  it('PIN tetap terkunci di jalur kode, juga saat percobaan paralel', async () => {
    jar.clear()
    await owner`update auth.learner_secret set failed_pins = 0, locked_until = null where user_id = ${a2}`
    expect((await Act.checkFamilyCodeAction({ code: await codeOf(orgA) })).ok).toBe(true)
    const results = await Promise.all(Array.from({ length: 12 }, () => Act.submitFamilyPinAction(a2, [...WRONG])))
    expect(results.every((r) => !r.ok)).toBe(true)
    const [row] = (await owner`select failed_pins as failed, locked_until as locked from auth.learner_secret where user_id = ${a2}`) as unknown as [{ failed: number; locked: Date | null }]
    expect(row.failed).toBe(5)
    expect(row.locked).not.toBeNull()
    // Terkunci: PIN benar pun ditolak.
    const good = await Act.submitFamilyPinAction(a2, [...PIN])
    expect(good.ok).toBe(false)
    expect(jar.has('__Host-kira.session')).toBe(false)
    await owner`update auth.learner_secret set failed_pins = 0, locked_until = null where user_id = ${a2}`
  })

  it('percobaan kode dibatasi per IP dengan pesan yang ramah', async () => {
    jar.clear()
    let limited: string | null = null
    for (let i = 0; i < 40 && !limited; i++) {
      const r = await Act.checkFamilyCodeAction({ code: 'BBBBBBBB' })
      expect(r.ok).toBe(false)
      if (!r.ok && !/belum cocok/.test(r.message)) limited = r.message
    }
    expect(limited).toMatch(/Pelan-pelan/)
    // Kode benar dari IP yang sama pun menunggu.
    const r = await Act.checkFamilyCodeAction({ code: await codeOf(orgA) })
    expect(r.ok).toBe(false)
  })
})
