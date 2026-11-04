import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

/**
 * Orang tua yang mendaftar dengan titik atau +tag di alamat Gmail bisa masuk dengan bentuk yang diketik maupun bentuk bakunya.
 * Tautan atur ulang password selalu dikirim ke alamat terdaftar, bukan alamat yang diketik di form.
 */
vi.mock('next/headers', () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }) }))

const urls = { owner: process.env.DATABASE_URL_OWNER, app: process.env.DATABASE_URL_APP, auth: process.env.DATABASE_URL_AUTH }
const ready = Object.values(urls).every(Boolean)

describe.skipIf(!ready)('masuk dengan alias Gmail', () => {
  const owner = ready ? postgres(urls.owner!, { max: 2, onnotice: () => {} }) : (null as never)
  const run = randomUUID().slice(0, 8)
  const orgId = randomUUID()
  const userId = randomUUID()
  const typed = `na.bila.${run}+kira@gmail.com`
  const norm = `nabila${run}@gmail.com`
  const PASSWORD = 'kalimat panjang yang mudah diingat 2026'
  let accounts: typeof import('@/server/auth/accounts')

  beforeAll(async () => {
    process.env.KIRA_ORIGIN = 'http://localhost:3100'
    process.env.DATABASE_URL_APP = urls.app!
    process.env.DATABASE_URL_AUTH = urls.auth!
    process.env.KIRA_SECRET = 'uji-alias-gmail-rahasia-minimal-32-karakter-xx'
    process.env.KIRA_DATA_DIR = '.kira-local/data'
    process.env.KIRA_HIBP = 'off'
    accounts = await import('@/server/auth/accounts')
    const { hashSecret } = await import('@/server/auth/password')
    await owner`insert into org (id, name) values (${orgId}, 'Uji alias __GTX_SEED__')`
    await owner`insert into auth.user_account (id, org_id, kind, role, email, email_norm, name, password_hash, password_changed_at)
      values (${userId}, ${orgId}, 'adult', 'guardian', ${typed}, ${norm}, 'Mama alias', ${await hashSecret(PASSWORD)}, now())`
  }, 60_000)

  afterAll(async () => {
    await owner`delete from auth.user_account where id = ${userId}`
    await owner`delete from org where id = ${orgId}`
    await owner.end()
  })

  it.each([
    ['bentuk yang diketik saat daftar', typed],
    ['bentuk baku', norm],
    ['tanpa +tag', `na.bila.${run}@gmail.com`],
    ['huruf besar dan spasi', `  NABILA${run}@GMAIL.COM `],
    ['googlemail', `nabila${run}@googlemail.com`],
  ])('masuk dengan %s', async (_label, email) => {
    const user = await accounts.loginWithPassword(email, PASSWORD)
    expect(user.id).toBe(userId)
  })

  it('password salah tetap ditolak dengan pesan yang sama, dan kegagalan dihitung bersama untuk semua alias', async () => {
    await expect(accounts.loginWithPassword(norm, 'bukan password yang benar sama sekali')).rejects.toThrow(/belum cocok/)
    await expect(accounts.loginWithPassword(typed, 'bukan password yang benar sama sekali')).rejects.toThrow(/belum cocok/)
    await accounts.loginWithPassword(typed, PASSWORD)
  })

  it('tautan atur ulang password dikirim ke alamat terdaftar walau form diisi bentuk lain', async () => {
    await accounts.requestPasswordReset(`nabila${run}+lain@gmail.com`)
    const rows = await owner`select to_addr from outbox_email where org_id = ${orgId} and kind = 'password-reset'`
    expect(rows.map((r) => r.to_addr)).toEqual([typed])
  })
})
