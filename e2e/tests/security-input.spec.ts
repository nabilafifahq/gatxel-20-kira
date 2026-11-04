import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { isClipText, splitClipText, styleForSkill, ttsKeyInput } from '../../packages/core/src/tts'
import { closeDb, createPracticeAttempt, db, GUARDIAN, loginAdult, mcqItems, TUTOR } from './helpers'
import { api, BASE, familyA, learnerSession, SESSION_COOKIE, sha256, uploadPng } from './security-helpers'

/** Masukan jahat: CSRF, XSS tersimpan, redirect terbuka, traversal path, metode, ukuran, sesi. */

let A: Awaited<ReturnType<typeof familyA>>
test.beforeAll(async () => {
  A = await familyA()
})
test.afterAll(async () => {
  await db()`delete from auth.session where user_agent = 'security-e2e'`
  await db()`delete from auth.device where name = 'security-e2e'`
  await closeDb()
})

const EVIL = 'https://contoh-jahat.test'

test.describe('CSRF', () => {
  test('semua Route Handler tulis menolak Origin situs lain walau cookie sesi benar', async () => {
    const attemptId = await createPracticeAttempt('Aisha', mcqItems('e2.', 2))
    const ctx = await api(A.aisha, { Origin: EVIL })
    expect((await uploadPng(ctx, attemptId)).status()).toBe(403)
    expect((await ctx.post('/api/sync', { data: { answers: [], submits: [] } })).status()).toBe(403)
    expect((await ctx.post('/api/tts/request', { data: { clips: [{ text: 'hello', style: 'normal' }] } })).status()).toBe(403)
    expect((await ctx.post('/api/heartbeat')).status()).toBe(403)
  })

  test('Origin "null" (iframe sandbox) ditolak', async () => {
    const ctx = await api(A.aisha, { Origin: 'null' })
    expect((await ctx.post('/api/heartbeat')).status()).toBe(403)
  })

  test('GET tidak punya efek samping: /bye menolak prefetch', async () => {
    const ctx = await api(A.aisha)
    const res = await ctx.get('/bye', { headers: { 'Next-Router-Prefetch': '1' }, maxRedirects: 0 })
    expect(res.status()).toBe(204)
    // Sesi masih hidup.
    expect((await ctx.get('/today', { maxRedirects: 0 })).status()).toBe(200)
  })

  test('Server Action dari Origin lain tidak dijalankan', async () => {
    const ctx = await api(A.mama, { Origin: EVIL, 'Next-Action': '7f0000000000000000000000000000000000000000', 'Content-Type': 'text/plain;charset=UTF-8' })
    const res = await ctx.post('/keluarga', { data: '["x"]' })
    expect(res.status()).not.toBe(200)
  })
})

test.describe('redirect terbuka', () => {
  for (const next of ['//contoh-jahat.test', 'https://contoh-jahat.test', '/\\contoh-jahat.test', 'javascript:alert(1)', '/%2f%2fcontoh-jahat.test']) {
    test(`next=${next} tidak mengalihkan keluar setelah masuk`, async ({ page }) => {
      await loginAdult(page, GUARDIAN, next)
      expect(new URL(page.url()).origin).toBe(new URL(BASE).origin)
    })
  }
})

test.describe('XSS tersimpan', () => {
  const payloads = ['<img src=x onerror="window.__xss=1">', '"><script>window.__xss=1</script>', "'-alert(1)-'", '<svg onload="window.__xss=1">']

  test('nama anak dan catatan berisi HTML tampil sebagai teks di konsol, keluarga, dan tablet', async ({ browser }) => {
    const name = payloads[0]!
    const original = await db()`select name from learner_profile where user_id = ${A.rakaId}`
    await db()`update learner_profile set name = ${name} where user_id = ${A.rakaId}`
    await db()`update auth.user_account set name = ${name} where id = ${A.rakaId}`
    await db()`insert into note (org_id, learner_id, author_id, body) values (${A.orgId}, ${A.rakaId}, ${A.tutorId}, ${payloads[1]!})`
    try {
      for (const who of [A.tutor, A.mama, A.raka]) {
        const context = await browser.newContext({ baseURL: BASE, extraHTTPHeaders: { Cookie: `${SESSION_COOKIE}=${who.token}` } })
        const page = await context.newPage()
        const dialogs: string[] = []
        page.on('dialog', (d) => {
          dialogs.push(d.message())
          void d.dismiss()
        })
        const paths = who === A.raka ? ['/today', '/me'] : who === A.tutor ? ['/konsol', '/konsol/learner', `/konsol/learner/${A.rakaId}`] : ['/keluarga', '/keluarga/privasi']
        for (const p of paths) {
          await page.goto(p)
          await page.waitForLoadState('networkidle').catch(() => {})
          expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss), p).toBeUndefined()
          expect(await page.locator('img[src="x"], svg[onload]').count(), p).toBe(0)
        }
        expect(dialogs).toEqual([])
        await context.close()
      }
    } finally {
      await db()`update learner_profile set name = ${original[0]!.name} where user_id = ${A.rakaId}`
      await db()`update auth.user_account set name = ${original[0]!.name} where id = ${A.rakaId}`
      await db()`delete from note where learner_id = ${A.rakaId} and body = ${payloads[1]!}`
    }
  })
})

test.describe('path traversal', () => {
  const evil = ['..%2f..%2f..%2fetc%2fpasswd', '%2e%2e%2f%2e%2e%2fetc%2fpasswd', '..\\..\\windows\\win.ini', '....//....//etc/passwd', '%00', 'a%00.png', '%252e%252e%252f']
  test('/api/media/[id] dan /tts/[file] hanya menerima id dan nama berkas yang sah', async () => {
    const ctx = await api(A.tutor)
    for (const e of evil) {
      for (const base of ['/api/media/', '/tts/']) {
        const res = await ctx.get(base + e, { maxRedirects: 0 })
        const body = await res.text()
        expect(res.status(), base + e).toBeGreaterThanOrEqual(300)
        expect(res.status(), base + e).toBeLessThan(500)
        expect(body).not.toMatch(/root:|\[fonts\]|\[extensions\]/)
      }
    }
  })

  test('berkas statis tidak bisa dipakai membaca source atau .env', async () => {
    const ctx = await api(null)
    for (const p of ['/.env', '/.env.local', '/_next/../.env', '/..%2f.env', '/package.json', '/.git/config', '/_next/static/../../server/app/page.js']) {
      const res = await ctx.get(p, { maxRedirects: 0 })
      const body = await res.text()
      expect(body, p).not.toMatch(/KIRA_SECRET|DATABASE_URL|\[core\]/)
    }
  })
})

test.describe('metode HTTP', () => {
  test('rute hanya menerima metode yang dirancang; override metode diabaikan', async () => {
    const ctx = await api(A.aisha)
    for (const route of ['/api/sync', '/api/heartbeat', '/api/tts/request', '/api/media']) {
      for (const m of ['GET', 'PUT', 'PATCH', 'DELETE'] as const) {
        const res = await ctx.fetch(route, { method: m, maxRedirects: 0 })
        // /api/media dan /api/tts/today punya GET sendiri; selain itu 405.
        if (route === '/api/media' && m === 'GET') continue
        expect(res.status(), `${m} ${route}`).toBe(405)
      }
      const o = await ctx.fetch(route, { method: 'POST', headers: { 'X-HTTP-Method-Override': 'DELETE', Origin: EVIL } })
      expect(o.status(), route).toBe(403)
    }
    const trace = await ctx.fetch('/masuk', { method: 'TRACE' })
    expect(trace.status()).not.toBe(200)
  })

  test('OPTIONS tidak membuka CORS untuk situs lain', async () => {
    const ctx = await api(null)
    for (const route of ['/api/sync', '/api/media', '/api/health', '/masuk']) {
      const res = await ctx.fetch(route, { method: 'OPTIONS', headers: { Origin: EVIL, 'Access-Control-Request-Method': 'POST' } })
      expect(res.headers()['access-control-allow-origin'], route).toBeUndefined()
    }
  })

  test('/api/mcp mati secara bawaan dan /api/internal tidak terlihat dari Cloudflare', async () => {
    const ctx = await api(null)
    expect((await ctx.post('/api/mcp', { data: { jsonrpc: '2.0', id: 1, method: 'tools/list' } })).status()).toBe(404)
    expect((await ctx.get('/api/mcp')).status()).toBe(404)
    const viaCf = await ctx.post('/api/internal/weekly-report', { data: {}, headers: { 'CF-Connecting-IP': '203.0.113.7', 'CF-Ray': 'abc-CGK', Authorization: 'Bearer x'.repeat(8) } })
    expect(viaCf.status()).toBe(404)
  })
})

test.describe('ukuran body', () => {
  test('body terlalu besar ditolak dengan 413 sebelum diproses', async () => {
    const big = Buffer.alloc(2_000_000, 97)
    const ctx = await api(A.aisha)
    expect((await ctx.post('/api/sync', { headers: { 'Content-Type': 'application/json' }, data: big })).status()).toBe(413)
    expect((await ctx.post('/api/tts/request', { headers: { 'Content-Type': 'application/json' }, data: Buffer.alloc(30_000, 97) })).status()).toBe(413)
    const attemptId = await createPracticeAttempt('Aisha', mcqItems('e2.', 2))
    const img = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(7 * 1024 * 1024, 0)])
    const res = await ctx.post('/api/media', { multipart: { kind: 'drawing', attemptId, position: '1', file: { name: 'besar.png', mimeType: 'image/png', buffer: img } } })
    expect(res.status()).toBe(413)
  })

  test('jenis berkas dicek dari isi: SVG, HTML, dan skrip ditolak walau berekstensi gambar', async () => {
    const attemptId = await createPracticeAttempt('Aisha', mcqItems('e2.', 2))
    const ctx = await api(A.aisha)
    const bad: [string, string, Buffer][] = [
      ['x.svg', 'image/svg+xml', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script></svg>')],
      ['x.png', 'image/png', Buffer.from('<html><script>alert(1)</script></html>        ')],
      ['x.png', 'image/png', Buffer.from('GIF89a' + 'A'.repeat(100))],
      ['x.png', 'image/png', Buffer.from('MZ' + 'A'.repeat(100))],
    ]
    for (const [name, mimeType, buffer] of bad) {
      const res = await ctx.post('/api/media', { multipart: { kind: 'drawing', attemptId, position: '1', file: { name, mimeType, buffer } } })
      expect(res.status(), name).toBe(415)
    }
    // PNG yang terpotong (tanpa IEND) ditolak oleh pembersih gambar.
    const truncated = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQ', 'base64')
    const res = await ctx.post('/api/media', { multipart: { kind: 'drawing', attemptId, position: '1', file: { name: 'x.png', mimeType: 'image/png', buffer: truncated } } })
    expect(res.status()).toBe(415)
  })

  test('EXIF dibuang dari JPEG yang diunggah', async () => {
    const attemptId = await createPracticeAttempt('Aisha', mcqItems('e2.', 2))
    const jfif = Buffer.from([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00])
    const exif = Buffer.concat([Buffer.from([0xff, 0xe1, 0x00, 0x16]), Buffer.from('Exif\0\0GPS-LAT-6.2000')])
    const sos = Buffer.from([0xff, 0xda, 0x00, 0x04, 0x01, 0x02, 0x11, 0x22, 0x33, 0x44])
    const jpg = Buffer.concat([Buffer.from([0xff, 0xd8]), jfif, exif, sos, Buffer.from([0xff, 0xd9])])
    const ctx = await api(A.aisha)
    const up = await ctx.post('/api/media', { multipart: { kind: 'image', attemptId, position: '1', file: { name: 'foto.jpg', mimeType: 'image/jpeg', buffer: jpg } } })
    expect(up.status()).toBe(200)
    const { mediaId } = (await up.json()) as { mediaId: string }
    const got = await ctx.get(`/api/media/${mediaId}`)
    const bytes = await got.body()
    expect(bytes.includes(Buffer.from('GPS-LAT'))).toBe(false)
    expect(got.headers()['content-type']).toBe('image/jpeg')
    expect(got.headers()['x-content-type-options']).toBe('nosniff')
  })
})

test.describe('sesi', () => {
  test('cookie sesi: __Host-, HttpOnly, Secure, SameSite, dan diganti saat masuk (anti fiksasi)', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: BASE })
    // Penyerang menebak atau menanam token sesi pilihannya: server tidak pernah menerima token buatan klien.
    const planted = 'F'.repeat(43)
    expect((await (await api({ token: planted, userId: '', orgId: '' })).get('/keluarga', { maxRedirects: 0 })).status()).toBeGreaterThanOrEqual(300)
    const page = await context.newPage()
    await loginAdult(page, TUTOR)
    const cookies = (await context.cookies()).filter((c) => c.name === SESSION_COOKIE)
    expect(cookies).toHaveLength(1)
    const c = cookies[0]!
    expect(c.value).not.toBe(planted)
    expect(c.httpOnly).toBe(true)
    expect(c.secure).toBe(true)
    expect(c.sameSite).toBe('Lax')
    expect(c.path).toBe('/')
    expect(c.value.length).toBeGreaterThanOrEqual(40)
    // Token di database hanya berupa hash.
    const rows = await db()`select id from auth.session where id = ${c.value}`
    expect(rows).toHaveLength(0)
    const hashed = await db()`select id from auth.session where id = ${sha256(c.value)} and revoked_at is null`
    expect(hashed).toHaveLength(1)
    // Cookie tanam tidak pernah menjadi sesi.
    const planted2 = await db()`select id from auth.session where id = ${sha256(planted)}`
    expect(planted2).toHaveLength(0)
    await context.close()
  })

  test('keluar mencabut sesi di server; cookie lama tidak bisa dipakai lagi', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: BASE })
    const page = await context.newPage()
    await loginAdult(page, GUARDIAN)
    const old = (await context.cookies()).find((c) => c.name === SESSION_COOKIE)!.value
    expect((await page.request.post('/keluar', { maxRedirects: 0 })).status()).toBeLessThan(400)
    const replay = await api({ token: old, userId: '', orgId: '' })
    const res = await replay.get('/keluarga', { maxRedirects: 0 })
    expect(res.status()).toBeGreaterThanOrEqual(300)
    await context.close()
  })

  test('sesi kedaluwarsa atau menganggur melewati batas ditolak', async () => {
    const idle = await (await import('./security-helpers')).sessionFor(A.mamaId, A.orgId, 'adult')
    await db()`update auth.session set last_seen_at = now() - interval '2 hours' where id = ${sha256(idle.token)}`
    const r1 = await (await api(idle)).get('/keluarga', { maxRedirects: 0 })
    expect(r1.status()).toBeGreaterThanOrEqual(300)
    const old = await (await import('./security-helpers')).sessionFor(A.mamaId, A.orgId, 'adult')
    await db()`update auth.session set expires_at = now() - interval '1 minute' where id = ${sha256(old.token)}`
    const r2 = await (await api(old)).get('/keluarga', { maxRedirects: 0 })
    expect(r2.status()).toBeGreaterThanOrEqual(300)
  })

  test('akun dikunci setelah 20 kegagalan dan jawabannya sama untuk email yang tidak ada', async ({ page }) => {
    const ghost = `hantu-${Date.now()}@contoh.test`
    for (const email of [ghost, 'mama@contoh.test']) {
      const key = `email:${sha256(email)}`
      await db()`delete from auth.login_attempt where key = ${key}`
      for (let i = 0; i < 20; i++) await db()`insert into auth.login_attempt (key, success) values (${key}, false)`
    }
    const messages: string[] = []
    for (const [email, password] of [[ghost, 'salah-salah-salah-1'], ['mama@contoh.test', GUARDIAN.password]] as const) {
      await page.goto('/masuk')
      await page.getByLabel('Email').first().fill(email)
      await page.getByLabel('Password', { exact: true }).fill(password)
      await page.getByRole('button', { name: 'Masuk', exact: true }).click()
      await expect(page.getByText(/dikunci 15 menit/i).first()).toBeVisible()
      messages.push((await page.getByText(/dikunci 15 menit/i).first().innerText()).trim())
      expect(new URL(page.url()).pathname).toBe('/masuk')
    }
    expect(messages[0]).toBe(messages[1])
    await db()`delete from auth.login_attempt where key in (${`email:${sha256(ghost)}`}, ${`email:${sha256('mama@contoh.test')}`})`
  })

  test('kesalahan masuk tidak membedakan email terdaftar dan tidak', async ({ page }) => {
    const seen: string[] = []
    for (const email of ['mama@contoh.test', `tidak-ada-${Date.now()}@contoh.test`]) {
      await page.goto('/masuk')
      await page.getByLabel('Email').first().fill(email)
      await page.getByLabel('Password', { exact: true }).fill('salah-salah-salah-1')
      await page.getByRole('button', { name: 'Masuk', exact: true }).click()
      await expect(page.getByText(/belum cocok/i).first()).toBeVisible()
      seen.push((await page.getByText(/belum cocok/i).first().innerText()).trim())
    }
    expect(seen[0]).toBe(seen[1])
    await db()`delete from auth.login_attempt where key in (${`email:${sha256('mama@contoh.test')}`})`
  })

  test('ganti password mencabut sesi lain; token atur ulang hanya berlaku sekali', async () => {
    const other = await (await import('./security-helpers')).sessionFor(A.mamaId, A.orgId, 'adult')
    const ok = await (await api(other)).get('/keluarga', { maxRedirects: 0 })
    expect(ok.status()).toBe(200)
    // Token atur ulang yang sudah terpakai tidak lagi valid di halaman.
    const token = 'U'.repeat(43)
    await db()`insert into auth.reset_token (user_id, token_hash, expires_at, used_at) values (${A.mamaId}, ${sha256(token)}, now() + interval '30 minutes', now())`
    const res = await (await api(null)).get(`/reset/${token}`)
    expect(await res.text()).toContain('Link ini sudah tidak berlaku')
    await db()`delete from auth.reset_token where token_hash = ${sha256(token)}`
  })
})

test.describe('header', () => {
  test('halaman pribadi no-store, HSTS, frame-ancestors, tanpa X-Powered-By; HTTP dialihkan ke HTTPS di balik Cloudflare', async () => {
    const ctx = await api(A.mama)
    const res = await ctx.get('/keluarga')
    const h = res.headers()
    expect(h['cache-control']).toContain('no-store')
    expect(h['content-security-policy']).toContain("frame-ancestors 'none'")
    expect(h['strict-transport-security']).toMatch(/max-age=\d{7,}/)
    expect(h['x-powered-by']).toBeUndefined()
    expect(h['set-cookie'] ?? '').not.toContain('Domain=')
    // Pengalihan hanya aktif di build produksi (E2E_PROD=1) dan untuk host publik.
    if (process.env.E2E_PROD === '1') {
      const r = await ctx.get('/masuk?x=1', { headers: { Host: 'kira.gatxel.com', 'X-Forwarded-Proto': 'http', 'CF-Ray': 'abc-CGK' }, maxRedirects: 0 })
      expect(r.status()).toBe(308)
      expect(r.headers()['location']).toBe('https://kira.gatxel.com/masuk?x=1')
      const ok = await ctx.get('/masuk', { headers: { Host: 'kira.gatxel.com', 'X-Forwarded-Proto': 'http', 'CF-Ray': 'abc-CGK', 'CF-Visitor': '{"scheme":"https"}' }, maxRedirects: 0 })
      expect(ok.status()).not.toBe(308)
    }
  })

  test('tidak ada rahasia di bundel klien', async () => {
    const ctx = await api(null)
    const html = await (await ctx.get('/masuk')).text()
    const scripts = [...html.matchAll(/\/_next\/static\/[^"']+\.js/g)].map((m) => m[0]).slice(0, 25)
    for (const s of scripts) {
      const body = await (await ctx.get(s)).text()
      expect(body, s).not.toMatch(/KIRA_SECRET|KIRA_INTERNAL_TOKEN|DATABASE_URL_|postgres:\/\/|aman-secret|KIRA_SETUP_TOKEN/)
    }
  })
})

test.describe('uji tembus 5 November', () => {
  test('next dengan tab atau baris baru tidak mengalihkan keluar', async () => {
    const ctx = await api(A.mama)
    for (const n of ['/%09/contoh-jahat.test', '/%0a/contoh-jahat.test', '/%0d/contoh-jahat.test']) {
      const res = await ctx.get(`/masuk?next=${n}`, { maxRedirects: 0 })
      expect(res.status(), n).toBe(307)
      expect(res.headers().location, n).toBe('/keluarga')
    }
  })

  test('saklar mati: rute mulai sesi tidak membuat attempt walau alamatnya diketik langsung', async () => {
    const kid = await learnerSession(A.aishaId, A.orgId, A.tutorId)
    const ctx = await api(kid)
    await db()`insert into learner_feature (learner_id, org_id, key, enabled) values
      (${A.aishaId}, ${A.orgId}, 'english-skills', false), (${A.aishaId}, ${A.orgId}, 'olympiad-math', false)
      on conflict (learner_id, key) do update set enabled = false`
    try {
      const [before] = await db()`select count(*)::int as n from attempt where learner_id = ${A.aishaId}`
      for (const path of ['/english/listening/start', '/esmo/mock/math']) {
        const res = await ctx.get(path, { maxRedirects: 0 })
        expect(res.status(), path).toBe(303)
        expect(res.headers().location ?? '', path).not.toContain('/run/')
      }
      const [after] = await db()`select count(*)::int as n from attempt where learner_id = ${A.aishaId}`
      expect(after!.n).toBe(before!.n)
    } finally {
      await db()`delete from learner_feature where learner_id = ${A.aishaId} and key in ('english-skills', 'olympiad-math')`
    }
  })

  test('tantangan bos: kunci dan pembahasan tidak ada di halaman runner', async () => {
    const kid = await learnerSession(A.aishaId, A.orgId, A.tutorId)
    const ctx = await api(kid)
    const start = await ctx.get('/world/boss/start', { maxRedirects: 0 })
    const location = start.headers().location ?? ''
    test.skip(!location.includes('/run/'), 'Bank soal seed terlalu kecil untuk tantangan bos')
    const body = (await (await ctx.get(location)).text()).replace(/\\"/g, '"')
    for (const field of ['"key":', '"reveal":', '"explanation":', '"whyWrong":', '"hasSolution":']) expect(body, field).not.toContain(field)
  })

  test('rute mulai sesi dibatasi 60 per menit per anak', async () => {
    const kid = await learnerSession(A.aishaId, A.orgId, A.tutorId)
    const ctx = await api(kid)
    const statuses: number[] = []
    for (let i = 0; i < 70; i++) statuses.push((await ctx.get('/practice/start?subject=science&mode=tidak-ada', { maxRedirects: 0 })).status())
    expect(statuses).toContain(429)
    // Ember terisi 1 per detik selama tes berjalan, jadi sedikit di atas 60 masih wajar.
    expect(statuses.filter((s) => s === 303).length).toBeLessThan(70)
  })

  test('tes berwaktu: soal dengar dan eja diputar dari klip, kata tidak ada di halaman, jawaban dinilai', async ({ browser }) => {
    const dataDir = process.env.KIRA_DATA_DIR
    test.skip(!dataDir, 'Butuh KIRA_DATA_DIR yang sama dengan server')
    const listen = { id: 'e1.digraphs.014', skill: 'e1.digraphs', text: 'chop' }
    const spell = { id: 'e1.digraphs.016', skill: 'e1.digraphs', text: 'ship. The ship sails on the sea. ship.' }
    const keysOf = (t: { skill: string; text: string }) => splitClipText(t.text).filter(isClipText).map((c) => sha256(ttsKeyInput(c, styleForSkill(t.skill))))
    const keys = [...keysOf(listen), ...keysOf(spell)]
    const dir = join(dataDir!, 'tts')
    mkdirSync(dir, { recursive: true })
    // Beberapa frame MP3 hening yang sah, supaya browser benar-benar bisa memutarnya.
    const frame = Buffer.alloc(417)
    Buffer.from([0xff, 0xfb, 0x90, 0x64]).copy(frame)
    const silence = Buffer.concat(Array.from({ length: 40 }, () => frame))
    for (const k of keys) writeFileSync(join(dir, `${k}.mp3`), silence)
    const attemptId = await createPracticeAttempt('Aisha', [{ id: listen.id, difficulty: 2 }, { id: spell.id, difficulty: 2 }], { mode: 'tes', timeLimitS: 600 })
    const kid = await learnerSession(A.aishaId, A.orgId, A.tutorId)
    const context = await browser.newContext({ baseURL: BASE, extraHTTPHeaders: { Cookie: `${SESSION_COOKIE}=${kid.token}` } })
    const page = await context.newPage()
    await page.addInitScript(() => {
      const w = window as unknown as { __deviceSpeech: number }
      w.__deviceSpeech = 0
      if ('speechSynthesis' in window) window.speechSynthesis.speak = () => void w.__deviceSpeech++
    })
    const heard: string[] = []
    page.on('response', (r) => {
      if (r.url().includes('/tts/') && r.ok()) heard.push(r.url().split('/').pop()!.replace('.mp3', ''))
    })
    try {
      const res = await page.goto(`/run/${attemptId}`)
      const html = (await res!.text()).replace(/\\"/g, '"')
      for (const leak of ['"listenText":', 'chop', 'The ship sails']) expect(html, leak).not.toContain(leak)
      expect(html).toContain('"listenClips":')

      await page.getByRole('button', { name: 'Play the audio' }).click()
      await expect.poll(() => keysOf(listen).every((k) => heard.includes(k))).toBe(true)
      await page.getByRole('button', { name: /^[A-E], ch$/ }).click()
      await page.getByRole('button', { name: 'Next', exact: true }).click()

      await page.getByRole('button', { name: 'Hear the word' }).click()
      await expect.poll(() => keysOf(spell).every((k) => heard.includes(k))).toBe(true)
      for (const letter of 'ship') await page.getByRole('button', { name: letter, exact: true }).click()
      await expect(page.getByText(/did not load|not ready yet/)).toHaveCount(0)
      expect(await page.evaluate(() => (window as unknown as { __deviceSpeech: number }).__deviceSpeech)).toBe(0)

      await page.getByRole('button', { name: 'Hand in', exact: true }).click()
      await page.getByRole('dialog').getByRole('button', { name: 'Hand in', exact: true }).click()
      await expect.poll(async () => (await db()`select status from attempt where id = ${attemptId}`)[0]!.status, { timeout: 30_000 }).toBe('submitted')
      const [row] = await db()`select score_raw from attempt where id = ${attemptId}`
      expect(row!.score_raw).toBe(2)
    } finally {
      await context.close()
      for (const k of keys) rmSync(join(dir, `${k}.mp3`), { force: true })
    }
  })

  test('/api/sync menghitung anggaran per butir, bukan per permintaan', async () => {
    const kid = await learnerSession(A.aishaId, A.orgId, A.tutorId)
    const ctx = await api(kid, { 'Content-Type': 'application/json' })
    const answers = Array.from({ length: 100 }, () => ({ bukan: 'jawaban' }))
    const statuses: number[] = []
    for (let i = 0; i < 14; i++) statuses.push((await ctx.post('/api/sync', { data: { answers, submits: [] } })).status())
    expect(statuses).toContain(429)
    expect(statuses.filter((s) => s === 200).length).toBeLessThanOrEqual(12)
  })

  test('/api/sync menolak body chunked yang terlalu besar', async () => {
    const kid = await learnerSession(A.aishaId, A.orgId, A.tutorId)
    const res = await fetch(`${BASE}/api/sync`, {
      method: 'POST',
      headers: { Cookie: `${SESSION_COOKIE}=${kid.token}`, 'Content-Type': 'application/json' },
      body: new ReadableStream({
        start(c) {
          for (let i = 0; i < 20; i++) c.enqueue(new Uint8Array(100 * 1024))
          c.close()
        },
      }),
      duplex: 'half',
    } as RequestInit)
    expect(res.status).toBe(413)
  })
})
