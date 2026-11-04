import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createHash, randomUUID } from 'node:crypto'
import postgres from 'postgres'

/**
 * Kursi beta di Postgres sungguhan: 150 verifikasi serentak untuk batas 100 menghasilkan tepat 100 keluarga,
 * dan sisanya masuk daftar tunggu. Memakai role kira_auth (yang dipakai aplikasi) dan kira_owner untuk bersih-bersih.
 */
const ownerUrl = process.env.DATABASE_URL_OWNER
const authUrl = process.env.DATABASE_URL_AUTH
const ready = Boolean(ownerUrl && authUrl)
const sha = (v: string) => createHash('sha256').update(v).digest('hex')

describe.skipIf(!ready)('kursi beta', () => {
  const owner = ready ? postgres(ownerUrl!, { max: 2, onnotice: () => {} }) : (null as never)
  const auth = ready ? postgres(authUrl!, { max: 15, onnotice: () => {} }) : (null as never)
  const run = randomUUID().slice(0, 8)
  const tokens: string[] = []

  beforeAll(async () => {
    for (let i = 0; i < 150; i++) {
      const token = `tok-${run}-${i}`
      tokens.push(token)
      await owner`insert into auth.signup (email, email_norm, name, password_hash, token_hash, expires_at, terms_version, notice_version)
        values (${`u${i}.${run}@seat.test`}, ${`u${i}.${run}@seat.test`}, ${`Ibu ${i} Uji`}, 'x', ${sha(token)}, now() + interval '1 day', 't', 'n')`
    }
  })

  afterAll(async () => {
    const orgs = await owner`select org_id from auth.beta_seat where email_norm like ${`%.${run}@seat.test`}`
    const ids = orgs.map((o) => o.org_id as string)
    if (ids.length) {
      await owner`delete from auth.user_account where org_id = any(${ids}::uuid[])`
      await owner`delete from org where id = any(${ids}::uuid[])`
      await owner`delete from auth.beta_seat where org_id = any(${ids}::uuid[])`
    }
    await owner`delete from auth.waitlist where email_norm like ${`%.${run}@seat.test`}`
    await owner`delete from auth.signup where email_norm like ${`%.${run}@seat.test`}`
    await Promise.all([owner.end(), auth.end()])
  })

  it('150 verifikasi serentak untuk batas 100: tepat 100 kursi', async () => {
    const [{ n: base }] = (await owner`select count(*)::int as n from auth.beta_seat`) as unknown as [{ n: number }]
    const cap = base + 100
    const results = await Promise.all(
      tokens.map(async (t) => {
        const rows = await auth`select status from kira_verify_signup(${sha(t)}, ${cap})`
        return rows[0]!.status as string
      }),
    )
    expect(results.filter((s) => s === 'ok')).toHaveLength(100)
    expect(results.filter((s) => s === 'full')).toHaveLength(50)
    const [{ n }] = (await owner`select count(*)::int as n from auth.beta_seat where email_norm like ${`%.${run}@seat.test`}`) as unknown as [{ n: number }]
    expect(n).toBe(100)
    const [{ w }] = (await owner`select count(*)::int as w from auth.waitlist where email_norm like ${`%.${run}@seat.test`}`) as unknown as [{ w: number }]
    expect(w).toBe(50)
    const [{ o }] = (await owner`select count(*)::int as o from org o join auth.beta_seat s on s.org_id = o.id where s.email_norm like ${`%.${run}@seat.test`}`) as unknown as [{ o: number }]
    expect(o).toBe(100)
    const [{ seats }] = (await auth`select kira_seats_taken() as seats`) as unknown as [{ seats: number }]
    expect(seats).toBe(cap)
  })

  it('token yang sama tidak bisa dipakai dua kali', async () => {
    const rows = await auth`select status from kira_verify_signup(${sha(tokens[0]!)}, ${100000})`
    expect(rows[0]!.status).toBe('invalid')
  })

  it('token kedaluwarsa atau tidak dikenal ditolak', async () => {
    const t = `exp-${run}`
    await owner`insert into auth.signup (email, email_norm, name, password_hash, token_hash, expires_at, terms_version, notice_version)
      values (${`exp.${run}@seat.test`}, ${`exp.${run}@seat.test`}, 'Lama', 'x', ${sha(t)}, now() - interval '1 minute', 't', 'n')`
    expect((await auth`select status from kira_verify_signup(${sha(t)}, ${100000})`)[0]!.status).toBe('invalid')
    expect((await auth`select status from kira_verify_signup(${sha('tidak-ada')}, ${100000})`)[0]!.status).toBe('invalid')
  })

  it('kira_app tidak bisa membaca tabel auth atau memanggil verifikasi', async () => {
    const app = postgres(process.env.DATABASE_URL_APP ?? ownerUrl!, { max: 1, onnotice: () => {} })
    try {
      if (process.env.DATABASE_URL_APP) {
        await expect(app`select * from auth.signup`).rejects.toThrow()
        await expect(app`select * from kira_verify_signup('x', 1)`).rejects.toThrow()
      }
    } finally {
      await app.end()
    }
  })
})
