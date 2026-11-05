import { createHash, randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { startFakeOidc, type FakeOidc } from './fake-oidc'

/**
 * Masuk dan daftar dengan Google di Postgres sungguhan, lewat Route Handler dan server OIDC palsu:
 * orang tua baru, akun lama, email belum terverifikasi, state dan nonce salah, pendaftar menunggu, kursi penuh, email sekali pakai.
 * Butuh DATABASE_URL_OWNER, DATABASE_URL_APP, DATABASE_URL_AUTH dan migrasi sudah dijalankan.
 */
const ownerUrl = process.env.DATABASE_URL_OWNER
const appUrl = process.env.DATABASE_URL_APP
const authUrl = process.env.DATABASE_URL_AUTH
const ready = Boolean(ownerUrl && appUrl && authUrl)
const SESSION = '__Host-kira.session'
const sha = (v: string) => createHash('sha256').update(v).digest('hex')

const jar = vi.hoisted(() => new Map<string, string>())
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'user-agent': 'uji', 'cf-connecting-ip': '203.0.113.9' }),
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string, opts?: { maxAge?: number }) => {
      if (opts?.maxAge === 0) jar.delete(name)
      else jar.set(name, value)
    },
    delete: (name: string) => jar.delete(name),
  }),
}))
// Batas laju dan MX bukan yang diuji di sini. Domain uji memakai .test, yang tidak punya MX.
vi.mock('@/server/limiter', async (orig) => ({ ...(await orig<typeof import('@/server/limiter')>()), takeToken: async () => 0 }))
vi.mock('node:dns/promises', () => ({ resolveMx: async () => [{ exchange: 'mx.uji.test', priority: 1 }] }))

describe.skipIf(!ready)('masuk dengan Google', () => {
  const owner = ready ? postgres(ownerUrl!, { max: 2, onnotice: () => {} }) : (null as never)
  const run = randomUUID().slice(0, 8)
  let oidc: FakeOidc
  let dbm: typeof import('@/server/db')
  let startRoute: typeof import('@/app/api/auth/google/start/route')
  let callbackRoute: typeof import('@/app/api/auth/google/callback/route')
  let action: typeof import('@/server/actions/google')
  let g: typeof import('@/server/auth/google')
  let n = 0
  const emailFor = (tag: string) => `${tag}.${run}.${++n}@keluarga.test`
  const subFor = () => `sub-${run}-${++n}`

  /** Jalankan alur penuh dari tombol sampai kembali dari Google, dengan klaim dari tes. */
  async function signIn(claims: Record<string, unknown>, over: { state?: string; nonce?: string; next?: string } = {}): Promise<string> {
    const res = await startRoute.GET(new Request(`https://kira.test/api/auth/google/start${over.next ? `?next=${encodeURIComponent(over.next)}` : ''}`))
    const q = new URL(res.headers.get('location')!).searchParams
    oidc.claims = claims
    const code = oidc.issue(q.get('code_challenge')!, over.nonce ?? q.get('nonce')!)
    const back = await callbackRoute.GET(new Request(`https://kira.test/api/auth/google/callback?state=${encodeURIComponent(over.state ?? q.get('state')!)}&code=${code}&scope=openid&authuser=0&prompt=consent`))
    expect(back.status).toBe(303)
    return back.headers.get('location')!
  }
  const googleUser = (sub: string, email: string, extra: Record<string, unknown> = {}) => ({ sub, email, email_verified: true, name: 'Ibu Google', ...extra })
  const account = async (email: string) => (await owner`select id, org_id, role, kind, password_hash, marketing_opt_in, name from auth.user_account where lower(email) = ${email}`)[0]
  const count = async (q: Promise<postgres.RowList<postgres.Row[]>>) => (await q)[0]!.n as number
  const links = (sub: string) => count(owner`select count(*)::int as n from auth.google_identity where sub = ${sub}`)
  const pendingRows = (norm: string) => count(owner`select count(*)::int as n from auth.signup where email_norm = ${norm}`)
  const sessionFor = async () => {
    const token = jar.get(SESSION)
    if (!token) return null
    return (await owner`select user_id, revoked_at from auth.session where id = ${sha(token)}`)[0] ?? null
  }
  async function makeFamily(email: string, role: 'guardian' | 'tutor' = 'guardian', opts: { password?: string | null; disabled?: boolean } = {}) {
    const orgId = randomUUID()
    const userId = randomUUID()
    await owner`insert into org (id, name) values (${orgId}, ${`Keluarga ${run}`})`
    await owner`insert into auth.user_account (id, org_id, kind, role, email, email_norm, name, password_hash, disabled_at)
      values (${userId}, ${orgId}, 'adult', ${role}, ${email}, ${email}, 'Ibu Lama', ${opts.password === undefined ? 'hash-lama' : opts.password}, ${opts.disabled ? new Date() : null})`
    return { orgId, userId }
  }
  const pendingSignup = (email: string, token: string) =>
    owner`insert into auth.signup (email, email_norm, name, password_hash, token_hash, expires_at, terms_version, notice_version)
      values (${email}, ${email}, 'Penyerang', 'hash-password-penyerang', ${sha(token)}, now() + interval '1 day', 't', 'n')`
  const audits = async (userId: string) => (await owner`select action from audit_log where actor_id = ${userId}`).map((r) => r.action as string)

  beforeAll(async () => {
    oidc = await startFakeOidc()
    process.env.KIRA_ORIGIN = 'https://kira.test'
    process.env.DATABASE_URL_APP = appUrl!
    process.env.DATABASE_URL_AUTH = authUrl!
    process.env.KIRA_SECRET = 'uji-google-rahasia-minimal-32-karakter-xxxxx'
    process.env.KIRA_DATA_DIR = '.kira-local/data'
    process.env.KIRA_HIBP = 'off'
    process.env.KIRA_BETA_SEATS = '100000'
    process.env.KIRA_GOOGLE_CLIENT_ID = oidc.clientId
    process.env.KIRA_GOOGLE_CLIENT_SECRET = oidc.clientSecret
    process.env.KIRA_GOOGLE_TEST_OIDC = oidc.url
    dbm = await import('@/server/db')
    g = await import('@/server/auth/google')
    startRoute = await import('@/app/api/auth/google/start/route')
    callbackRoute = await import('@/app/api/auth/google/callback/route')
    action = await import('@/server/actions/google')
  })

  beforeEach(() => jar.clear())
  afterEach(() => {
    oidc.wrongKey = false
  })

  afterAll(async () => {
    const pattern = `%${run}%`
    const orgs = await owner`select distinct org_id from auth.user_account where email like ${pattern}`
    const ids = orgs.map((o) => o.org_id as string)
    if (ids.length) {
      await owner`delete from audit_log where org_id = any(${ids}::uuid[])`
      await owner`delete from auth.session where org_id = any(${ids}::uuid[])`
      await owner`delete from auth.beta_seat where org_id = any(${ids}::uuid[])`
      await owner`delete from member_profile where org_id = any(${ids}::uuid[])`
      await owner`delete from auth.user_account where org_id = any(${ids}::uuid[])`
      await owner`delete from org where id = any(${ids}::uuid[])`
    }
    await owner`delete from auth.signup where email_norm like ${pattern}`
    await owner`delete from auth.waitlist where email_norm like ${pattern}`
    await owner`delete from public_mail where to_addr like ${pattern}`
    await oidc.stop()
    await Promise.all([owner.end(), (dbm.appDb() as unknown as { $client: { end(): Promise<void> } }).$client.end(), (dbm.authDb() as unknown as { $client: { end(): Promise<void> } }).$client.end()])
  })

  it('orang tua baru: tidak ada yang dibuat sebelum persetujuan, lalu keluarga, kursi, dan sesi dalam satu langkah', async () => {
    const email = emailFor('baru')
    const sub = subFor()
    const [{ n: seatsBefore }] = (await owner`select count(*)::int as n from auth.beta_seat`) as unknown as [{ n: number }]
    expect(await signIn(googleUser(sub, email))).toBe('/daftar/google')
    expect(await account(email)).toBeUndefined()
    expect(await links(sub)).toBe(0)
    expect(jar.has(SESSION)).toBe(false)
    expect(await g.readPendingGoogle()).toEqual({ sub, email, name: 'Ibu Google' })

    // Tanpa centang persetujuan, tidak ada yang dibuat.
    const refused = await action.googleConsentAction({ consent: false })
    expect(refused.ok).toBe(false)
    expect(await account(email)).toBeUndefined()

    const done = await action.googleConsentAction({ consent: true })
    expect(done).toEqual({ ok: true, data: { redirectTo: '/mulai' } })
    const row = await account(email)
    expect(row).toMatchObject({ role: 'guardian', kind: 'adult', password_hash: null, marketing_opt_in: false, name: 'Ibu Google' })
    expect(await links(sub)).toBe(1)
    const [{ n: seatsAfter }] = (await owner`select count(*)::int as n from auth.beta_seat`) as unknown as [{ n: number }]
    expect(seatsAfter).toBe(seatsBefore + 1)
    expect((await sessionFor())?.user_id).toBe(row!.id)
    expect(await g.readPendingGoogle()).toBeNull()
    const actions = await audits(row!.id as string)
    expect(actions).toEqual(expect.arrayContaining(['org.created', 'terms.accepted', 'login.signup']))
    const [terms] = await owner`select meta from audit_log where actor_id = ${row!.id} and action = 'terms.accepted'`
    const { NOTICE_VERSION, TERMS_VERSION } = await import('@/server/auth/accounts')
    expect(terms!.meta).toMatchObject({ termsVersion: TERMS_VERSION, noticeVersion: NOTICE_VERSION })
    // Hanya sub yang disimpan: tabelnya tidak punya kolom token atau email.
    const cols = await owner`select column_name from information_schema.columns where table_schema = 'auth' and table_name = 'google_identity' order by 1`
    expect(cols.map((c) => c.column_name)).toEqual(['created_at', 'sub', 'user_id'])

    // Masuk lagi dengan Google: dikenali dari sub, tanpa langkah persetujuan.
    jar.clear()
    expect(await signIn(googleUser(sub, email))).toBe('/keluarga')
    expect((await sessionFor())?.user_id).toBe(row!.id)
    // Sub yang sama tetap dikenali walau email Google berubah.
    jar.clear()
    expect(await signIn(googleUser(sub, emailFor('ganti')))).toBe('/keluarga')
    expect((await sessionFor())?.user_id).toBe(row!.id)
  })

  it('kabar produk hanya bila dicentang', async () => {
    const email = emailFor('kabar')
    await signIn(googleUser(subFor(), email))
    await action.googleConsentAction({ consent: true, marketing: true })
    const row = await account(email)
    expect(row!.marketing_opt_in).toBe(true)
    expect(await audits(row!.id as string)).toContain('marketing.opted-in')
  })

  it('akun lama dengan email sama: ditautkan dan masuk, next yang aman dipakai', async () => {
    const email = emailFor('lama')
    const sub = subFor()
    const { userId } = await makeFamily(email)
    expect(await signIn(googleUser(sub, email), { next: '/orang-tua' })).toBe('/orang-tua')
    expect((await sessionFor())?.user_id).toBe(userId)
    expect(await links(sub)).toBe(1)
    expect((await account(email))!.password_hash).toBe('hash-lama')
    expect(await audits(userId)).toEqual(expect.arrayContaining(['google.linked', 'login.google']))
  })

  it('akun yang sudah tertaut ke sub lain ditolak dengan ramah', async () => {
    const email = emailFor('tertaut')
    const { userId } = await makeFamily(email)
    await signIn(googleUser(subFor(), email))
    jar.clear()
    const other = subFor()
    expect(await signIn(googleUser(other, email))).toBe('/masuk?notice=google-other-account')
    expect(jar.has(SESSION)).toBe(false)
    expect(await links(other)).toBe(0)
    expect(await count(owner`select count(*)::int as n from auth.google_identity where user_id = ${userId}`)).toBe(1)
  })

  it('tutor lama boleh masuk; tutor baru tidak pernah dibuat', async () => {
    const email = emailFor('tutor')
    const { userId } = await makeFamily(email, 'tutor')
    expect(await signIn(googleUser(subFor(), email))).toBe('/konsol')
    expect((await sessionFor())?.user_id).toBe(userId)
    expect((await account(email))!.role).toBe('tutor')
    const baru = emailFor('calon-tutor')
    await signIn(googleUser(subFor(), baru))
    await action.googleConsentAction({ consent: true })
    expect((await account(baru))!.role).toBe('guardian')
  })

  it('akun anak dan akun nonaktif tidak bisa masuk dengan Google', async () => {
    const off = emailFor('nonaktif')
    await makeFamily(off, 'guardian', { disabled: true })
    expect(await signIn(googleUser(subFor(), off))).toBe('/masuk?notice=google-disabled')
    expect(jar.has(SESSION)).toBe(false)
    const child = emailFor('anak')
    const { orgId } = await makeFamily(emailFor('wali'))
    await owner`insert into auth.user_account (org_id, kind, role, email, email_norm, name) values (${orgId}, 'learner', 'learner', ${child}, ${child}, 'Anak')`
    expect(await signIn(googleUser(subFor(), child))).toBe('/masuk?notice=google-not-adult')
    expect(jar.has(SESSION)).toBe(false)
  })

  it('email belum terverifikasi ditolak dan tidak membuat apa pun', async () => {
    const email = emailFor('belum')
    const sub = subFor()
    expect(await signIn(googleUser(sub, email, { email_verified: false }))).toBe('/masuk?notice=google-unverified')
    expect(await g.readPendingGoogle()).toBeNull()
    expect(await links(sub)).toBe(0)
    expect(await account(email)).toBeUndefined()
  })

  it('state salah, nonce salah, kode salah, dan tanda tangan salah ditolak', async () => {
    const email = emailFor('serang')
    const { userId } = await makeFamily(email)
    const sub = subFor()
    expect(await signIn(googleUser(sub, email), { state: 'state-yang-salah' })).toBe('/masuk?notice=google-failed')
    expect(await signIn(googleUser(sub, email), { nonce: 'nonce-yang-salah-panjang-sekali-0123' })).toBe('/masuk?notice=google-failed')
    oidc.wrongKey = true
    expect(await signIn(googleUser(sub, email))).toBe('/masuk?notice=google-failed')
    oidc.wrongKey = false
    await startRoute.GET(new Request('https://kira.test/api/auth/google/start'))
    const flow = await g.takeGoogleFlow()
    await startRoute.GET(new Request('https://kira.test/api/auth/google/start'))
    const stale = await callbackRoute.GET(new Request(`https://kira.test/api/auth/google/callback?state=${flow!.state}&code=x`))
    expect(stale.headers.get('location')).toBe('/masuk?notice=google-failed')
    // Tanpa cookie alur sama sekali (CSRF dari situs lain).
    jar.clear()
    const csrf = await callbackRoute.GET(new Request('https://kira.test/api/auth/google/callback?state=apa-saja&code=x'))
    expect(csrf.headers.get('location')).toBe('/masuk?notice=google-failed')
    expect(jar.has(SESSION)).toBe(false)
    expect(await links(sub)).toBe(0)
    expect(await count(owner`select count(*)::int as n from auth.session where user_id = ${userId}`)).toBe(0)
  })

  it('pengguna membatalkan di Google', async () => {
    const res = await startRoute.GET(new Request('https://kira.test/api/auth/google/start'))
    const state = new URL(res.headers.get('location')!).searchParams.get('state')!
    const back = await callbackRoute.GET(new Request(`https://kira.test/api/auth/google/callback?state=${state}&error=access_denied`))
    expect(back.headers.get('location')).toBe('/masuk?notice=google-cancelled')
  })

  it('pendaftar menunggu dibuang: akun baru tanpa password penyerang, dan tautan lamanya mati', async () => {
    const email = emailFor('hijack')
    const token = `tok-${run}-${randomUUID()}`
    await pendingSignup(email, token)
    await signIn(googleUser(subFor(), email))
    // Baru meninjau, belum setuju: pendaftar menunggu masih utuh.
    expect(await pendingRows(email)).toBe(1)
    expect((await action.googleConsentAction({ consent: true })).ok).toBe(true)
    expect(await pendingRows(email)).toBe(0)
    const row = await account(email)
    expect(row!.password_hash).toBeNull()
    expect(row!.name).toBe('Ibu Google')
    const rows = await dbm.authDb().execute((await import('drizzle-orm')).sql`select status from kira_verify_signup(${sha(token)}, ${100000})`)
    expect((rows as unknown as { status: string }[])[0]!.status).toBe('invalid')
  })

  it('pendaftar menunggu pada akun lama yang ditautkan ikut dibuang', async () => {
    const email = emailFor('hijack-lama')
    await makeFamily(email)
    await pendingSignup(email, `tok-${run}-${randomUUID()}`)
    await signIn(googleUser(subFor(), email))
    expect(await pendingRows(email)).toBe(0)
    expect((await account(email))!.password_hash).toBe('hash-lama')
  })

  it('kursi penuh: ke halaman ramah saat kembali dari Google dan saat kursi habis di langkah persetujuan', async () => {
    const [{ n: taken }] = (await owner`select count(*)::int as n from auth.beta_seat`) as unknown as [{ n: number }]
    const { env } = await import('@/server/env')
    const cached = env()
    const before = cached.KIRA_BETA_SEATS
    const email = emailFor('penuh')
    const sub = subFor()
    try {
      // Saat persetujuan: lolos pemeriksaan pertama, lalu kursi habis sebelum tombol ditekan.
      cached.KIRA_BETA_SEATS = taken + 1
      expect(await signIn(googleUser(sub, email))).toBe('/daftar/google')
      cached.KIRA_BETA_SEATS = taken
      expect(await action.googleConsentAction({ consent: true })).toEqual({ ok: true, data: { redirectTo: '/daftar' } })
      expect(await account(email)).toBeUndefined()
      expect(await links(sub)).toBe(0)
      expect(jar.has(SESSION)).toBe(false)
      expect(await count(owner`select count(*)::int as n from auth.waitlist where email_norm = ${email}`)).toBe(0)
      // Saat kembali dari Google.
      jar.clear()
      expect(await signIn(googleUser(subFor(), emailFor('penuh2')))).toBe('/daftar')
      expect(await g.readPendingGoogle()).toBeNull()
      // Akun lama tetap bisa masuk saat kursi penuh.
      const old = emailFor('lama-penuh')
      await makeFamily(old)
      expect(await signIn(googleUser(subFor(), old))).toBe('/keluarga')
    } finally {
      cached.KIRA_BETA_SEATS = before
    }
  })

  it('kursi di bawah kunci: dua persetujuan serentak untuk satu kursi hanya satu yang lolos', async () => {
    const [{ n: taken }] = (await owner`select count(*)::int as n from auth.beta_seat`) as unknown as [{ n: number }]
    const cap = taken + 1
    const mk = () => {
      const email = emailFor('balap')
      return owner`select status from kira_google_signup(${subFor()}, ${email}, ${email}, 'Ibu', ${cap}, 't', 'n', 'ip', false)`
    }
    const results = await Promise.all([mk(), mk(), mk(), mk()])
    expect(results.map((r) => r[0]!.status as string).sort()).toEqual(['full', 'full', 'full', 'ok'])
  })

  it('email sekali pakai ditolak dan tidak ada yang dibuat', async () => {
    const email = `ibu.${run}@mailinator.com`
    const sub = subFor()
    expect(await signIn(googleUser(sub, email))).toBe('/masuk?notice=google-disposable')
    expect(await g.readPendingGoogle()).toBeNull()
    expect(await account(email)).toBeUndefined()
    expect(await links(sub)).toBe(0)
  })

  it('di luar Gmail, +tag tidak cukup untuk menautkan; di Gmail, bentuk bakunya sama', async () => {
    const base = `ibu${run}${++n}@kantor.test`
    await makeFamily(base)
    expect(await signIn(googleUser(subFor(), base.replace('@', '+x@')))).toBe('/masuk?notice=google-use-password')
    expect(jar.has(SESSION)).toBe(false)
    const gmail = `ibu${run}${++n}@gmail.com`
    const { userId } = await makeFamily(gmail)
    await signIn(googleUser(subFor(), `${gmail.slice(0, 2)}.${gmail.slice(2)}`))
    expect((await sessionFor())?.user_id).toBe(userId)
  })

  it('cookie persetujuan yang diubah ditolak', async () => {
    const email = emailFor('palsu')
    await signIn(googleUser(subFor(), email))
    const raw = jar.get(g.GOOGLE_PENDING_COOKIE)!
    const [body, sig] = raw.split('.') as [string, string]
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url').toString()), email: emailFor('korban') })).toString('base64url')
    jar.set(g.GOOGLE_PENDING_COOKIE, `${forged}.${sig}`)
    expect(await action.googleConsentAction({ consent: true })).toEqual({ ok: true, data: { redirectTo: '/masuk?notice=google-failed' } })
    expect(jar.has(SESSION)).toBe(false)
  })

  it('tabel: RLS FORCE, hanya kira_auth, dan terhapus bersama akun', async () => {
    const [flags] = await owner`select relrowsecurity, relforcerowsecurity from pg_class where oid = 'auth.google_identity'::regclass`
    expect(flags).toMatchObject({ relrowsecurity: true, relforcerowsecurity: true })
    const [priv] = await owner`select has_table_privilege('kira_app', 'auth.google_identity', 'select') as app, has_table_privilege('kira_worker', 'auth.google_identity', 'select') as worker, has_table_privilege('kira_auth', 'auth.google_identity', 'select') as auth`
    expect(priv).toEqual({ app: false, worker: false, auth: true })
    const [fn] = await owner`select has_function_privilege('kira_app', 'kira_google_signup(text, text, text, text, integer, text, text, text, boolean)', 'execute') as app, has_function_privilege('kira_auth', 'kira_google_signup(text, text, text, text, integer, text, text, text, boolean)', 'execute') as auth`
    expect(fn).toEqual({ app: false, auth: true })
    const email = emailFor('hapus')
    const sub = subFor()
    const { userId } = await makeFamily(email)
    await signIn(googleUser(sub, email))
    expect(await links(sub)).toBe(1)
    await owner`delete from auth.session where user_id = ${userId}`
    await owner`delete from audit_log where actor_id = ${userId}`
    await owner`delete from auth.user_account where id = ${userId}`
    expect(await links(sub)).toBe(0)
  })
})
