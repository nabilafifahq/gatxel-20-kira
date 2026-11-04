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
const OTHER_PASSWORD = 'Password-orang-lain-2026!'
const NEW_PASSWORD = 'Password-baru-pemilik-2026!'
const NEW_NAME = 'Ibu Pengisi Baru'

describe.skipIf(!ready)('pendaftaran dan daftar tunggu', () => {
  const owner = ready ? postgres(ownerUrl!, { max: 2, onnotice: () => {} }) : (null as never)
  const run = randomUUID().slice(0, 8)
  let svc: typeof import('@/server/signup/service')
  let dbm: typeof import('@/server/db')
  let end: () => Promise<void>

  const mailTo = async (to: string, kind: string) => (await owner`select text, html from public_mail where to_addr = ${to} and kind = ${kind} order by created_at desc limit 1`)[0]
  const tokenOf = (text: string, path: string) => text.match(new RegExp(`${path}([A-Za-z0-9_-]+)`))![1]!
  const count = async (q: Promise<postgres.RowList<postgres.Row[]>>) => (await q)[0]!.n as number
  const latestToken = async (to: string) => tokenOf((await mailTo(to, 'signup-verify'))!.text as string, '/daftar/konfirmasi/')
  const backdate = (norm: string) => owner`update auth.signup set last_sent_at = now() - interval '2 minutes' where email_norm = ${norm}`
  const signupRow = async (norm: string) => (await owner`select name, password_hash, conflict from auth.signup where email_norm = ${norm}`)[0]!
  const matches = async (hash: unknown, password: string) => (await import('@/server/auth/password')).verifySecret(hash as string, password)
  const seats = (norm: string) => count(owner`select count(*)::int as n from auth.beta_seat where email_norm = ${norm}`)
  const accountHash = async (email: string) => (await owner`select password_hash from auth.user_account where lower(email) = ${email}`)[0]?.password_hash

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
    // Token saja cukup (keputusan pemilik, lihat docs/laporan-keamanan.md), dan hanya sekali.
    const ok = await svc.verifySignup(token)
    expect(ok.status).toBe('ok')
    expect((await svc.verifySignup(token)).status).toBe('invalid')
    const [u] = await owner`select role, kind, email_norm, password_hash from auth.user_account where lower(email) = ${email}`
    expect(u).toMatchObject({ role: 'guardian', kind: 'adult', email_norm: `ibu${run}@gmail.com` })
    // Password dari formulir daftar yang menjadi password akun.
    expect(await matches(u!.password_hash, PASSWORD)).toBe(true)
    // Pemilik email dikabari bahwa akunnya aktif.
    const active = await mailTo(email, 'signup-active')
    expect(active!.text).toContain('Akun Kira Anda aktif')
    expect(active!.text).toContain('Kalau bukan Anda yang mendaftar, atur ulang password lewat Lupa password dan hubungi kami')
  })

  describe('pendaftaran kedua untuk email yang masih menunggu', () => {
    const signUp = (email: string, name: string, password: string) => svc.startSignup({ name, email, password, consent: true, ipHash: 'x' })

    /** Tautan bertanda: tanpa isian baru tidak terjadi apa-apa, isian lemah ditolak, lalu nama dan password baru menggantikan yang tersimpan. */
    async function activateWithNewPassword(email: string, norm: string, token: string, deadPasswords: string[]) {
      expect((await svc.verifySignup(token)).status).toBe('needs-password')
      expect(await svc.signupTokenState(token)).toBe('needs-password')
      expect(await seats(norm)).toBe(0)
      expect(await accountHash(email)).toBeUndefined()
      await expect(svc.verifySignup(token, { name: NEW_NAME, password: 'Pendek-1!' })).rejects.toThrow(/13 karakter/)
      await expect(svc.verifySignup(token, { name: ' A ', password: NEW_PASSWORD })).rejects.toThrow(/nama orang tua/)
      expect(await accountHash(email)).toBeUndefined()
      expect((await svc.verifySignup(token, { name: `  ${NEW_NAME} `, password: NEW_PASSWORD })).status).toBe('ok')
      expect(await seats(norm)).toBe(1)
      const [account] = await owner`select u.name as account_name, m.name as profile_name from auth.user_account u join member_profile m on m.user_id = u.id where lower(u.email) = ${email}`
      expect(account).toMatchObject({ account_name: NEW_NAME, profile_name: NEW_NAME })
      const hash = await accountHash(email)
      expect(await matches(hash, NEW_PASSWORD)).toBe(true)
      for (const dead of deadPasswords) expect(await matches(hash, dead)).toBe(false)
      expect((await svc.verifySignup(token, { name: NEW_NAME, password: NEW_PASSWORD })).status).toBe('invalid')
    }

    it('pemilik dulu, lalu orang lain: data tersimpan utuh, tautan lama mati, tautan baru meminta password baru', async () => {
      const email = `satu.ganda.${run}@gmail.com`
      const norm = `satuganda${run}@gmail.com`
      await signUp(email, 'Ibu Pemilik', PASSWORD)
      const first = await latestToken(email)
      await backdate(norm)
      await expect(signUp(email, 'Orang Lain', OTHER_PASSWORD)).resolves.toBeUndefined()
      const row = await signupRow(norm)
      expect(row.name).toBe('Ibu Pemilik')
      expect(row.conflict).toBe(true)
      expect(await matches(row.password_hash, PASSWORD)).toBe(true)
      expect(await matches(row.password_hash, OTHER_PASSWORD)).toBe(false)
      expect((await svc.verifySignup(first)).status).toBe('invalid')
      await activateWithNewPassword(email, norm, await latestToken(email), [PASSWORD, OTHER_PASSWORD])
    })

    it('orang lain dulu, lalu pemilik: password orang lain tidak pernah menjadi password akun', async () => {
      const email = `dua.ganda.${run}@gmail.com`
      const norm = `duaganda${run}@gmail.com`
      await signUp(email, 'Orang Lain', OTHER_PASSWORD)
      await backdate(norm)
      await expect(signUp(email, 'Ibu Pemilik', PASSWORD)).resolves.toBeUndefined()
      expect((await signupRow(norm)).conflict).toBe(true)
      await activateWithNewPassword(email, norm, await latestToken(email), [PASSWORD, OTHER_PASSWORD])
    })

    it('di dalam jeda satu menit: tanda tetap terpasang pada tautan yang sudah terkirim', async () => {
      const email = `tiga.ganda.${run}@gmail.com`
      const norm = `tigaganda${run}@gmail.com`
      await signUp(email, 'Orang Lain', OTHER_PASSWORD)
      const only = await latestToken(email)
      await signUp(email, 'Ibu Pemilik', PASSWORD)
      expect(await count(owner`select count(*)::int as n from public_mail where kind = 'signup-verify' and to_addr = ${email}`)).toBe(1)
      await activateWithNewPassword(email, norm, only, [PASSWORD, OTHER_PASSWORD])
    })

    it('batas email habis: tanda tetap terpasang pada tautan terakhir', async () => {
      const email = `empat.ganda.${run}@gmail.com`
      const norm = `empatganda${run}@gmail.com`
      for (let i = 0; i < 5; i++) {
        await signUp(email, 'Orang Lain', OTHER_PASSWORD)
        await backdate(norm)
      }
      const last = await latestToken(email)
      await signUp(email, 'Ibu Pemilik', PASSWORD)
      expect(await count(owner`select count(*)::int as n from public_mail where kind = 'signup-verify' and to_addr = ${email}`)).toBe(5)
      await activateWithNewPassword(email, norm, last, [PASSWORD, OTHER_PASSWORD])
    })

    it('mengulang password yang tersimpan tidak mencabut tanda', async () => {
      const email = `lima.ganda.${run}@gmail.com`
      const norm = `limaganda${run}@gmail.com`
      await signUp(email, 'Orang Lain', OTHER_PASSWORD)
      await backdate(norm)
      await signUp(email, 'Ibu Pemilik', PASSWORD)
      await backdate(norm)
      await signUp(email, 'Orang Lain', OTHER_PASSWORD)
      expect((await signupRow(norm)).conflict).toBe(true)
      await activateWithNewPassword(email, norm, await latestToken(email), [PASSWORD, OTHER_PASSWORD])
    })

    it('password sama: dianggap kirim ulang, tanpa tanda, tetap langsung aktif', async () => {
      const email = `enam.ganda.${run}@gmail.com`
      const norm = `enamganda${run}@gmail.com`
      await signUp(email, 'Ibu Sama', PASSWORD)
      const first = await latestToken(email)
      await backdate(norm)
      await signUp(email, 'Nama Lain', PASSWORD)
      const row = await signupRow(norm)
      expect(row.conflict).toBe(false)
      expect(row.name).toBe('Ibu Sama')
      const second = await latestToken(email)
      expect(second).not.toBe(first)
      expect((await svc.verifySignup(first)).status).toBe('invalid')
      expect(await svc.signupTokenState(second)).toBe('direct')
      expect((await svc.verifySignup(second)).status).toBe('ok')
      expect(await matches(await accountHash(email), PASSWORD)).toBe(true)
    })

    it('nama dan password baru diabaikan pada tautan tanpa tanda', async () => {
      const email = `tujuh.ganda.${run}@gmail.com`
      await signUp(email, 'Ibu Tujuh', PASSWORD)
      expect((await svc.verifySignup(await latestToken(email), { name: NEW_NAME, password: OTHER_PASSWORD })).status).toBe('ok')
      expect(await matches(await accountHash(email), PASSWORD)).toBe(true)
      const [account] = await owner`select name from auth.user_account where lower(email) = ${email}`
      expect(account!.name).toBe('Ibu Tujuh')
    })

    it('pendaftar yang sudah kedaluwarsa ditimpa utuh tanpa tanda', async () => {
      const email = `delapan.ganda.${run}@gmail.com`
      const norm = `delapanganda${run}@gmail.com`
      await signUp(email, 'Orang Lain', OTHER_PASSWORD)
      await owner`update auth.signup set expires_at = now() - interval '1 minute' where email_norm = ${norm}`
      await signUp(email, 'Ibu Pemilik', PASSWORD)
      const row = await signupRow(norm)
      expect(row.conflict).toBe(false)
      expect(row.name).toBe('Ibu Pemilik')
      expect(await matches(row.password_hash, PASSWORD)).toBe(true)
      expect((await svc.verifySignup(await latestToken(email))).status).toBe('ok')
    })
  })

  it.each([
    ['terlalu pendek', 'Pendek-1!', /13 karakter/],
    ['tanpa huruf kapital', 'tanpa-kapital-panjang-2026!', /huruf kapital/],
    ['tanpa angka', 'Tanpa-angka-yang-panjang!', /satu angka/],
    ['tanpa simbol', 'TanpaSimbolYangPanjang2026', /satu simbol/],
  ])('password lemah ditolak server dan tidak disimpan: %s', async (_label, password, message) => {
    await expect(svc.startSignup({ name: 'Ibu Lemah', email: `lemah.${run}@gmail.com`, password, consent: true, ipHash: 'x' })).rejects.toThrow(message)
    expect(await count(owner`select count(*)::int as n from auth.signup where email_norm = ${`lemah${run}@gmail.com`}`)).toBe(0)
  })

  it('password yang memuat bagian awal email ditolak server', async () => {
    await expect(svc.startSignup({ name: 'Ibu Lemah', email: `lemah.${run}@gmail.com`, password: `Aa1!-lemah.${run}-kalimat`, consent: true, ipHash: 'x' })).rejects.toThrow(/alamat email/)
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

  it('batas email habis saat daftar ulang: tautan terakhir di kotak masuk tetap berlaku', async () => {
    const email = `batas.${run}@gmail.com`
    for (let i = 0; i < 6; i++) {
      await svc.startSignup({ name: 'Ibu Batas', email, password: PASSWORD, consent: true, ipHash: 'x' })
      await owner`update auth.signup set last_sent_at = now() - interval '2 minutes' where email_norm = ${`batas${run}@gmail.com`}`
    }
    expect(await count(owner`select count(*)::int as n from public_mail where kind = 'signup-verify' and to_addr = ${email}`)).toBe(5)
    const token = tokenOf((await mailTo(email, 'signup-verify'))!.text as string, '/daftar/konfirmasi/')
    expect((await svc.verifySignup(token)).status).toBe('ok')
  })

  it('kirim ulang sampai batas email: setiap token baru benar-benar terkirim', async () => {
    const email = `ulang.${run}@gmail.com`
    const backdate = () => owner`update auth.signup set last_sent_at = now() - interval '2 minutes' where email_norm = ${`ulang${run}@gmail.com`}`
    for (let i = 0; i < 2; i++) {
      await svc.startSignup({ name: 'Ibu Ulang', email, password: PASSWORD, consent: true, ipHash: 'x' })
      await backdate()
    }
    for (let i = 0; i < 3; i++) {
      await svc.resendVerification(email)
      await backdate()
    }
    expect(await count(owner`select count(*)::int as n from public_mail where kind = 'signup-verify' and to_addr = ${email}`)).toBe(5)
    const token = tokenOf((await mailTo(email, 'signup-verify'))!.text as string, '/daftar/konfirmasi/')
    expect((await svc.verifySignup(token)).status).toBe('ok')
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
