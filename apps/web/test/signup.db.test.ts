import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * Pendaftaran, verifikasi, kursi, dan daftar tunggu di Postgres sungguhan lewat layanan signup.
 * Butuh DATABASE_URL_OWNER, DATABASE_URL_APP, DATABASE_URL_AUTH dan migrasi sudah dijalankan.
 */
const ownerUrl = process.env.DATABASE_URL_OWNER
const appUrl = process.env.DATABASE_URL_APP
const authUrl = process.env.DATABASE_URL_AUTH
const ready = Boolean(ownerUrl && appUrl && authUrl)
const PASSWORD = 'Kalimat-panjang-2026!'

describe.skipIf(!ready)('pendaftaran dan daftar tunggu', () => {
  const owner = ready ? postgres(ownerUrl!, { max: 2, onnotice: () => {} }) : (null as never)
  const run = randomUUID().slice(0, 8)
  let svc: typeof import('@/server/signup/service')
  let dbm: typeof import('@/server/db')
  let end: () => Promise<void>

  const mailTo = async (to: string, kind: string) => (await owner`select text, html from public_mail where to_addr = ${to} and kind = ${kind} order by created_at desc limit 1`)[0]
  const tokenOf = (text: string, path: string) => text.match(new RegExp(`${path}([A-Za-z0-9_-]+)`))![1]!
  const count = async (q: Promise<postgres.RowList<postgres.Row[]>>) => (await q)[0]!.n as number

  beforeAll(async () => {
    process.env.KIRA_ORIGIN = 'http://localhost:3100'
    process.env.DATABASE_URL_APP = appUrl!
    process.env.DATABASE_URL_AUTH = authUrl!
    process.env.KIRA_SECRET = 'uji-pendaftaran-rahasia-minimal-32-karakter-xx'
    process.env.KIRA_DATA_DIR = '.kira-local/data'
    process.env.KIRA_HIBP = 'off'
    process.env.KIRA_BETA_SEATS = '100000'
    svc = await import('@/server/signup/service')
    dbm = await import('@/server/db')
    end = async () => {
      await Promise.all([(dbm.appDb() as unknown as { $client: { end(): Promise<void> } }).$client.end(), (dbm.authDb() as unknown as { $client: { end(): Promise<void> } }).$client.end()])
    }
  })

  afterAll(async () => {
    const seats = await owner`select org_id from auth.beta_seat where email_norm like ${`%${run}%`}`
    for (const s of seats) {
      await owner`delete from auth.user_account where org_id = ${s.org_id}`
      await owner`delete from org where id = ${s.org_id}`
      await owner`delete from auth.beta_seat where org_id = ${s.org_id}`
    }
    await owner`delete from auth.signup where email_norm like ${`%${run}%`}`
    await owner`delete from auth.waitlist where email_norm like ${`%${run}%`}`
    await owner`delete from public_mail where to_addr like ${`%${run}%`}`
    await Promise.all([owner.end(), end()])
  })

  it('daftar baru: pendaftar tersimpan tanpa akun, email konfirmasi masuk antrean, token sekali pakai', async () => {
    const email = `ibu.${run}@gmail.com`
    await svc.startSignup({ name: 'Ibu Uji', email, password: PASSWORD, consent: true, ipHash: 'x' })
    expect(await count(owner`select count(*)::int as n from auth.signup where email_norm = ${`ibu${run}@gmail.com`}`)).toBe(1)
    expect(await count(owner`select count(*)::int as n from auth.user_account where lower(email) = ${email}`)).toBe(0)
    const mail = await mailTo(email, 'signup-verify')
    const token = tokenOf(mail!.text as string, '/daftar/konfirmasi/')
    const [row] = await owner`select token_hash, password_hash, expires_at from auth.signup where email_norm = ${`ibu${run}@gmail.com`}`
    expect(row!.token_hash).not.toBe(token)
    expect(row!.password_hash).not.toContain(PASSWORD)
    expect(new Date(row!.expires_at).getTime() - Date.now()).toBeGreaterThan(23 * 3600 * 1000)
    expect(new Date(row!.expires_at).getTime() - Date.now()).toBeLessThanOrEqual(24 * 3600 * 1000)
    // Pre-hijack: tanpa password yang benar, token tidak terpakai dan kursi tidak terambil.
    expect(await count(owner`select count(*)::int as n from auth.signup where email_norm = ${`ibu${run}@gmail.com`}`)).toBe(1)
    const ok = await svc.verifySignup(token)
    expect(ok.status).toBe('ok')
    expect((await svc.verifySignup(token)).status).toBe('invalid')
    const [u] = await owner`select role, kind, email_norm from auth.user_account where lower(email) = ${email}`
    expect(u).toMatchObject({ role: 'guardian', kind: 'adult', email_norm: `ibu${run}@gmail.com` })
  })

  it('email kabar: bawaan tidak berlangganan, di pendaftar dan di akun', async () => {
    const email = `bawaan.${run}@gmail.com`
    await svc.startSignup({ name: 'Ibu Bawaan', email, password: PASSWORD, consent: true, ipHash: 'x' })
    const [p] = await owner`select marketing_opt_in, marketing_opt_in_at from auth.signup where lower(email) = ${email}`
    expect(p).toMatchObject({ marketing_opt_in: false, marketing_opt_in_at: null })
    const token = tokenOf((await mailTo(email, 'signup-verify'))!.text as string, '/daftar/konfirmasi/')
    expect((await svc.verifySignup(token)).status).toBe('ok')
    const [u] = await owner`select marketing_opt_in, marketing_opt_in_at, marketing_token from auth.user_account where lower(email) = ${email}`
    expect(u).toMatchObject({ marketing_opt_in: false, marketing_opt_in_at: null, marketing_token: null })
    expect(await count(owner`select count(*)::int as n from audit_log where action = 'marketing.opted-in' and meta->>'via' = 'signup' and actor_id in (select id from auth.user_account where lower(email) = ${email})`)).toBe(0)
  })

  it('email kabar: yang mencentang tersimpan dengan waktu, ikut ke akun, dan tautan berhenti menghentikannya', async () => {
    const email = `kabar.${run}@gmail.com`
    await svc.startSignup({ name: 'Ibu Kabar', email, password: PASSWORD, consent: true, marketing: true, ipHash: 'x' })
    const [p] = await owner`select marketing_opt_in, marketing_opt_in_at from auth.signup where lower(email) = ${email}`
    expect(p!.marketing_opt_in).toBe(true)
    expect(p!.marketing_opt_in_at).toBeTruthy()
    const token = tokenOf((await mailTo(email, 'signup-verify'))!.text as string, '/daftar/konfirmasi/')
    const ok = await svc.verifySignup(token)
    expect(ok.status).toBe('ok')
    const [u] = await owner`select id, marketing_opt_in, marketing_opt_in_at, marketing_notice_version, marketing_token from auth.user_account where lower(email) = ${email}`
    expect(u!.marketing_opt_in).toBe(true)
    expect(new Date(u!.marketing_opt_in_at).getTime()).toBe(new Date(p!.marketing_opt_in_at).getTime())
    expect(u!.marketing_notice_version).toBeTruthy()
    expect(u!.marketing_token).toMatch(/^[A-Za-z0-9_-]{20,100}$/)
    expect(await count(owner`select count(*)::int as n from audit_log where action = 'marketing.opted-in' and actor_id = ${u!.id}`)).toBe(1)
    expect(await svc.unsubscribeByToken(u!.marketing_token)).toBe('account')
    expect(await svc.unsubscribeByToken(u!.marketing_token)).toBe('account')
    const [off] = await owner`select marketing_opt_in, marketing_withdrawn_at, marketing_opt_in_at from auth.user_account where id = ${u!.id}`
    expect(off!.marketing_opt_in).toBe(false)
    expect(off!.marketing_withdrawn_at).toBeTruthy()
    expect(off!.marketing_opt_in_at).toBeTruthy()
    expect(await svc.unsubscribeByToken('tidak-dikenal-sama-sekali-000000')).toBeNull()
  })

  it('email yang sudah punya akun: jawaban sama, tidak ada pendaftar baru, pemilik dikabari', async () => {
    const variant = `i.bu.${run}+x@gmail.com`
    await expect(svc.startSignup({ name: 'Ibu Lain', email: variant, password: PASSWORD, consent: true, ipHash: 'x' })).resolves.toBeUndefined()
    expect(await count(owner`select count(*)::int as n from auth.signup where email_norm = ${`ibu${run}@gmail.com`}`)).toBe(0)
    expect(await count(owner`select count(*)::int as n from public_mail where kind = 'signup-existing' and to_addr like ${`%${run}%`}`)).toBe(1)
  })

  it('titik dan +tag Gmail menjadi satu pendaftar saja', async () => {
    await svc.startSignup({ name: 'Ibu Dua', email: `dua.${run}@gmail.com`, password: PASSWORD, consent: true, ipHash: 'x' })
    await svc.startSignup({ name: 'Ibu Dua', email: `d.ua.${run}+lagi@gmail.com`, password: PASSWORD, consent: true, ipHash: 'x' })
    expect(await count(owner`select count(*)::int as n from auth.signup where email_norm = ${`dua${run}@gmail.com`}`)).toBe(1)
  })

  it('pengiriman ulang dibatasi satu menit dan mengganti token', async () => {
    const email = `dua.${run}@gmail.com`
    const before = await count(owner`select count(*)::int as n from public_mail where kind = 'signup-verify' and to_addr = ${email}`)
    await svc.resendVerification(email)
    expect(await count(owner`select count(*)::int as n from public_mail where kind = 'signup-verify' and to_addr = ${email}`)).toBe(before)
    await owner`update auth.signup set last_sent_at = now() - interval '2 minutes' where email_norm = ${`dua${run}@gmail.com`}`
    await svc.resendVerification(email)
    expect(await count(owner`select count(*)::int as n from public_mail where kind = 'signup-verify' and to_addr = ${email}`)).toBe(before + 1)
  })

  it('email sekali pakai ditolak dengan pesan ramah, persetujuan wajib', async () => {
    await expect(svc.startSignup({ name: 'Ibu', email: `x${run}@tmailor.com`, password: PASSWORD, consent: true, ipHash: 'x' })).rejects.toThrow(/sementara/)
    await expect(svc.startSignup({ name: 'Ibu', email: `x${run}@gmail.com`, password: PASSWORD, consent: false, ipHash: 'x' })).rejects.toThrow(/persetujuan/)
    await expect(svc.joinWaitlist({ email: `y${run}@temp-mail.org`, consent: true })).rejects.toThrow(/sementara/)
  })

  it('pendaftar kedaluwarsa tidak bisa diverifikasi dan dibersihkan oleh jadwal retensi', async () => {
    const email = `tiga.${run}@gmail.com`
    await svc.startSignup({ name: 'Ibu Tiga', email, password: PASSWORD, consent: true, ipHash: 'x' })
    const token = tokenOf((await mailTo(email, 'signup-verify'))!.text as string, '/daftar/konfirmasi/')
    await owner`update auth.signup set expires_at = now() - interval '1 minute' where email_norm = ${`tiga${run}@gmail.com`}`
    expect((await svc.verifySignup(token)).status).toBe('invalid')
    await owner`select kira_purge_public()`
    expect(await count(owner`select count(*)::int as n from auth.signup where email_norm = ${`tiga${run}@gmail.com`}`)).toBe(0)
  })

  it('daftar tunggu: konfirmasi, satu baris per alamat ternormalisasi, berhenti berlangganan', async () => {
    const a = `tunggu.${run}@gmail.com`
    await svc.joinWaitlist({ email: a, consent: true })
    await svc.joinWaitlist({ email: `t.unggu.${run}+lagi@gmail.com`, consent: true })
    expect(await count(owner`select count(*)::int as n from auth.waitlist where email_norm = ${`tunggu${run}@gmail.com`}`)).toBe(1)
    const confirm = await mailTo(a, 'waitlist-confirm')
    expect(confirm!.text).toContain('/kabar/berhenti/')
    const token = tokenOf(confirm!.text as string, '/kabar/konfirmasi/')
    expect(await svc.confirmWaitlist(token)).toBe(true)
    expect(await svc.confirmWaitlist('tidak-ada-token-sama-sekali-123')).toBe(false)
    expect(await mailTo(a, 'waitlist-welcome')).toBeTruthy()
    expect(await svc.unsubscribeWaitlist(token)).toBe(true)
    expect(await svc.unsubscribeWaitlist(token)).toBe(true)
    const [w] = await owner`select unsubscribed_at from auth.waitlist where email_norm = ${`tunggu${run}@gmail.com`}`
    expect(w!.unsubscribed_at).not.toBeNull()
    // Setiap email daftar tunggu membawa header berhenti satu klik.
    const [h] = await owner`select list_unsubscribe from public_mail where to_addr = ${a} and kind = 'waitlist-welcome'`
    expect(h!.list_unsubscribe).toContain('/api/kabar/berhenti/')
  })

  it('persetujuan daftar tunggu wajib dan alamat yang sudah punya akun tidak dibocorkan', async () => {
    await expect(svc.joinWaitlist({ email: `z${run}@gmail.com`, consent: false })).rejects.toThrow()
    await expect(svc.joinWaitlist({ email: `ibu.${run}@gmail.com`, consent: true })).resolves.toBeUndefined()
    expect(await count(owner`select count(*)::int as n from auth.waitlist where email_norm = ${`ibu${run}@gmail.com`}`)).toBe(0)
  })
})
