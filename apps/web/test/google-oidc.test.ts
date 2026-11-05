import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { isEmbeddedBrowser } from '@/lib/embedded-browser'
import { startFakeOidc, type FakeOidc } from './fake-oidc'

/**
 * Masuk Google tanpa database: keadaan mati, cookie alur, alamat persetujuan, dan pemeriksaan ID token terhadap server OIDC palsu.
 * Keputusan akun diuji di google-signin.db.test.ts.
 */
process.env.KIRA_ORIGIN = 'https://kira.test'
process.env.DATABASE_URL_APP = 'postgres://x'
process.env.DATABASE_URL_AUTH = 'postgres://x'
process.env.KIRA_SECRET = 'uji-rahasia-minimal-32-karakter-xxxxxxxx'
process.env.KIRA_DATA_DIR = '.kira-local/data'

const jar = vi.hoisted(() => new Map<string, string>())
const reqHeaders = vi.hoisted(() => new Headers())
vi.mock('next/headers', () => ({
  headers: async () => reqHeaders,
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string, opts?: { maxAge?: number }) => {
      if (opts?.maxAge === 0) jar.delete(name)
      else jar.set(name, value)
    },
    delete: (name: string) => jar.delete(name),
  }),
}))

describe('masuk Google: protokol', () => {
  let oidc: FakeOidc
  let g: typeof import('@/server/auth/google')
  const NONCE = 'nonce-uji-panjang-sekali-0123456789'

  const on = () => {
    process.env.KIRA_GOOGLE_CLIENT_ID = oidc.clientId
    process.env.KIRA_GOOGLE_CLIENT_SECRET = oidc.clientSecret
    process.env.KIRA_GOOGLE_TEST_OIDC = oidc.url
  }
  const off = () => {
    delete process.env.KIRA_GOOGLE_CLIENT_ID
    delete process.env.KIRA_GOOGLE_CLIENT_SECRET
    delete process.env.KIRA_GOOGLE_TEST_OIDC
  }
  const claims = { sub: 'sub-1', email: 'ibu@gmail.com', email_verified: true, name: 'Ibu Uji', nonce: NONCE }
  const refusedWith = async (token: string, nonce = NONCE) => {
    on()
    const e = await g.verifyIdToken(g.googleConfig()!, token, nonce).then(
      () => null,
      (err: unknown) => err,
    )
    expect(e).toBeInstanceOf(g.GoogleRefused)
    return (e as InstanceType<typeof g.GoogleRefused>).reason
  }

  beforeAll(async () => {
    oidc = await startFakeOidc()
    g = await import('@/server/auth/google')
  })
  afterEach(() => {
    off()
    jar.clear()
    reqHeaders.delete('user-agent')
  })
  afterAll(async () => {
    await oidc.stop()
  })

  it('mati sampai kedua nilai diisi, dan rutenya 404', async () => {
    expect(g.googleEnabled()).toBe(false)
    expect(await g.googleButtonVisible()).toBe(false)
    process.env.KIRA_GOOGLE_CLIENT_ID = 'x'
    expect(g.googleEnabled()).toBe(false)
    process.env.KIRA_GOOGLE_CLIENT_ID = '  '
    process.env.KIRA_GOOGLE_CLIENT_SECRET = 'y'
    expect(g.googleEnabled()).toBe(false)
    off()
    const start = await import('@/app/api/auth/google/start/route')
    const callback = await import('@/app/api/auth/google/callback/route')
    expect((await start.GET(new Request('https://kira.test/api/auth/google/start'))).status).toBe(404)
    expect((await callback.GET(new Request('https://kira.test/api/auth/google/callback?state=a&code=b'))).status).toBe(404)
    expect(jar.size).toBe(0)
  }, 30000)

  it('kebijakan privasi tidak berubah selama fitur mati, dan menyebut Google saat menyala', async () => {
    const { privacyNoticeData } = await import('@/server/legal')
    expect(JSON.stringify(privacyNoticeData())).not.toContain('Google')
    on()
    const notice = privacyNoticeData()
    const row = notice.recipients.find((r) => r.name.startsWith('Google LLC'))
    expect(row).toMatchObject({ abroad: true })
    expect(row!.name).toContain('hanya bila Anda sendiri memilih')
    expect(notice.dataRows.some((d) => d.data.startsWith('Masuk dengan Google'))).toBe(true)
  }, 30000)

  it('alamat produksi selalu Google, walau alamat palsu terisi', () => {
    on()
    vi.stubEnv('NODE_ENV', 'production')
    expect(g.googleConfig()).toMatchObject({ tokenUrl: 'https://oauth2.googleapis.com/token', jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs', authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth' })
    vi.unstubAllEnvs()
  })

  it('tombol dan rute mulai menolak WebView, termasuk aplikasi Android Kira', async () => {
    on()
    const android = 'Mozilla/5.0 (Linux; Android 13; SM-X200; wv) AppleWebKit/537.36 Chrome/120.0 Safari/537.36 KiraAndroid/1.4'
    const safari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
    expect(isEmbeddedBrowser(android)).toBe(true)
    expect(isEmbeddedBrowser('Mozilla/5.0 (Linux; Android 13; Pixel; wv) AppleWebKit/537.36')).toBe(true)
    expect(isEmbeddedBrowser(`${safari} Instagram 300.0`)).toBe(true)
    expect(isEmbeddedBrowser(safari)).toBe(false)
    expect(isEmbeddedBrowser('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36')).toBe(false)
    reqHeaders.set('user-agent', android)
    expect(await g.googleButtonVisible()).toBe(false)
    reqHeaders.set('user-agent', safari)
    expect(await g.googleButtonVisible()).toBe(true)
    const start = await import('@/app/api/auth/google/start/route')
    const res = await start.GET(new Request('https://kira.test/api/auth/google/start', { headers: { 'user-agent': android } }))
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('/masuk?notice=google-app')
    expect(jar.size).toBe(0)
  }, 30000)

  it('prefetch tidak memulai alur, dan batas laju berlaku', async () => {
    on()
    const start = await import('@/app/api/auth/google/start/route')
    const prefetch = await start.GET(new Request('https://kira.test/api/auth/google/start', { headers: { purpose: 'prefetch' } }))
    expect(prefetch.status).toBe(204)
    expect(jar.size).toBe(0)
    reqHeaders.set('cf-connecting-ip', '198.51.100.7')
    let last = 0
    for (let i = 0; i < 200 && last !== 429; i++) last = (await start.GET(new Request('https://kira.test/api/auth/google/start'))).status
    reqHeaders.delete('cf-connecting-ip')
    expect(last).toBe(429)
  }, 30000)

  it('alamat persetujuan: kode dan PKCE S256, tiga cakupan saja, state dan nonce dari cookie', async () => {
    on()
    const start = await import('@/app/api/auth/google/start/route')
    const res = await start.GET(new Request('https://kira.test/api/auth/google/start?next=%2Forang-tua'))
    expect(res.status).toBe(303)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const url = new URL(res.headers.get('location')!)
    expect(url.origin + url.pathname).toBe(`${oidc.url}/authorize`)
    const q = url.searchParams
    expect(q.get('scope')).toBe('openid email profile')
    expect(q.get('response_type')).toBe('code')
    expect(q.get('code_challenge_method')).toBe('S256')
    expect(q.get('redirect_uri')).toBe('https://kira.test/api/auth/google/callback')
    expect(q.get('client_id')).toBe(oidc.clientId)
    expect(q.has('client_secret')).toBe(false)
    const flow = await g.takeGoogleFlow()
    expect(flow).toMatchObject({ state: q.get('state'), nonce: q.get('nonce'), next: '/orang-tua' })
    // Satu kali pakai.
    expect(await g.takeGoogleFlow()).toBeNull()
  })

  it('next yang menuju situs lain dibuang', async () => {
    on()
    const start = await import('@/app/api/auth/google/start/route')
    for (const next of ['https://jahat.test/x', '//jahat.test', '/\\jahat.test', '/%09/jahat.test'.replace('%09', '\t')]) {
      await start.GET(new Request(`https://kira.test/api/auth/google/start?next=${encodeURIComponent(next)}`))
      expect((await g.takeGoogleFlow())?.next).toBeNull()
    }
  })

  it('cookie alur yang diubah atau kedaluwarsa ditolak', async () => {
    on()
    await g.beginGoogleFlow(g.googleConfig()!, null)
    const raw = jar.get(g.GOOGLE_FLOW_COOKIE)!
    const [body, sig] = raw.split('.') as [string, string]
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url').toString()), state: 'state-penyerang-panjang-sekali-000' })).toString('base64url')
    jar.set(g.GOOGLE_FLOW_COOKIE, `${forged}.${sig}`)
    expect(await g.takeGoogleFlow()).toBeNull()
    await g.beginGoogleFlow(g.googleConfig()!, null)
    const now = Date.now
    Date.now = () => now() + 11 * 60 * 1000
    try {
      expect(await g.takeGoogleFlow()).toBeNull()
    } finally {
      Date.now = now
    }
  })

  it('ID token sah diterima dan hanya sub, email, nama yang diambil', async () => {
    on()
    const out = await g.verifyIdToken(g.googleConfig()!, await oidc.sign(claims), NONCE)
    expect(out).toEqual({ sub: 'sub-1', email: 'ibu@gmail.com', name: 'Ibu Uji' })
  })

  it('tanda tangan, aud, iss, exp, azp, dan nonce yang salah ditolak', async () => {
    on()
    expect(await refusedWith(await oidc.sign(claims, { wrongKey: true }))).toBe('token')
    expect(await refusedWith(await oidc.sign({ ...claims, aud: 'klien-lain' }))).toBe('token')
    expect(await refusedWith(await oidc.sign({ ...claims, iss: 'https://penerbit-lain.test' }))).toBe('token')
    expect(await refusedWith(await oidc.sign({ ...claims, exp: Math.floor(Date.now() / 1000) - 60 }))).toBe('token')
    expect(await refusedWith(await oidc.sign({ ...claims, azp: 'klien-lain' }))).toBe('token')
    expect(await refusedWith(await oidc.sign(claims), 'nonce-lain-panjang-sekali-012345')).toBe('nonce')
    expect(await refusedWith(await oidc.sign({ ...claims, nonce: undefined }))).toBe('nonce')
    const unsigned = `${Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url')}.${(await oidc.sign(claims)).split('.')[1]}.`
    expect(await refusedWith(unsigned)).toBe('token')
  })

  it('email_verified harus true', async () => {
    on()
    expect(await refusedWith(await oidc.sign({ ...claims, email_verified: false }))).toBe('unverified')
    expect(await refusedWith(await oidc.sign({ ...claims, email_verified: 'true' }))).toBe('unverified')
    expect(await refusedWith(await oidc.sign({ ...claims, email_verified: undefined }))).toBe('unverified')
  })

  it('nama dari Google dibersihkan, dan nama kosong diganti', () => {
    expect(g.cleanGoogleName('  Ibu\u0000 Uji ')).toBe('Ibu  Uji')
    expect(g.cleanGoogleName('A')).toBe('Orang tua')
    expect(g.cleanGoogleName(undefined)).toBe('Orang tua')
    expect(g.cleanGoogleName('x'.repeat(200))).toHaveLength(80)
  })
})
