import { expect, test } from '@playwright/test'
import { closeDb, createPracticeAttempt, mcqItems, pinLogin, registerTablet } from './helpers'

test.afterAll(closeDb)

test('header keamanan GTX ada di halaman masuk', async ({ request }) => {
  const res = await request.get('/masuk')
  expect(res.status()).toBe(200)
  const h = res.headers()
  const csp = h['content-security-policy'] ?? ''
  expect(csp).toContain("default-src 'self'")
  expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/)
  expect(csp).toContain("frame-ancestors 'none'")
  expect(csp).toContain("object-src 'none'")
  expect(h['x-frame-options']).toBe('DENY')
  expect(h['x-content-type-options']).toBe('nosniff')
  expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin')
  expect(h['x-xss-protection']).toBe('0')
  expect(h['strict-transport-security']).toContain('max-age=')
  expect(h['permissions-policy']).toContain('geolocation=()')
  expect(h['x-powered-by']).toBeUndefined()
  expect(h['cache-control']).toContain('no-store')
})

test('endpoint API menolak permintaan tanpa sesi atau token', async ({ request }) => {
  expect((await request.get('/api/media/00000000-0000-4000-8000-000000000000')).status()).toBe(401)
  expect((await request.get('/api/apk')).status()).toBe(401)
  expect((await request.post('/api/heartbeat')).status()).toBeGreaterThanOrEqual(400)
  expect((await request.post('/api/sync', { data: { answers: [], submits: [] } })).status()).toBeGreaterThanOrEqual(400)
  const internal = await request.post('/api/internal/weekly-report', { data: {} })
  expect([401, 503]).toContain(internal.status())
  const wrongToken = await request.post('/api/internal/weekly-report', { data: {}, headers: { Authorization: 'Bearer salah-salah-salah-salah-salah-salah' } })
  expect([401, 503]).toContain(wrongToken.status())
  const mcp = await request.post('/api/mcp', { data: { jsonrpc: '2.0', id: 1, method: 'tools/list' } })
  expect([401, 404]).toContain(mcp.status())
})

test('sesi learner tidak bisa membuka konsol, halaman orang tua, atau halaman cetak', async ({ page }) => {
  await registerTablet(page, ['Aisha'])
  await pinLogin(page, 'Aisha')
  for (const path of ['/konsol', '/konsol/learner', '/keluarga', '/keluarga/privasi', '/cetak/paper/00000000-0000-4000-8000-000000000000']) {
    await page.goto(path)
    await expect(page, path).toHaveURL(/\/today$/)
  }
})

test('tautan ganti learner yang di-prefetch tidak mengakhiri sesi', async ({ page }) => {
  await registerTablet(page, ['Aisha'])
  await pinLogin(page, 'Aisha')
  const res = await page.request.get('/bye', { headers: { 'Next-Router-Prefetch': '1' }, maxRedirects: 0 })
  expect(res.status()).toBe(204)
  await page.goto('/today')
  await expect(page).toHaveURL(/\/today$/)
})

// PNG 1 x 1 piksel untuk menguji unggahan gambar.
const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

test('unggahan dari tablet diterima dari alamat Kira dan ditolak dari situs lain', async ({ page }) => {
  await registerTablet(page, ['Aisha'])
  await pinLogin(page, 'Aisha')
  const attemptId = await createPracticeAttempt('Aisha', mcqItems('e2.', 2))
  // Dari halaman Kira sendiri browser mengirim Origin yang sama dengan alamat yang dibuka.
  const status = await page.evaluate(
    async ({ attemptId, b64 }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
      const form = new FormData()
      form.set('kind', 'drawing')
      form.set('attemptId', attemptId)
      form.set('position', '1')
      form.set('file', new Blob([bytes], { type: 'image/png' }), 'gambar.png')
      return (await fetch('/api/media', { method: 'POST', body: form, credentials: 'same-origin' })).status
    },
    { attemptId, b64: PNG_1PX },
  )
  expect(status).toBe(200)
  // Origin situs lain ditolak walau cookie sesi ikut terkirim.
  const evil = await page.request.post('/api/media', {
    headers: { Origin: 'https://contoh-jahat.test' },
    multipart: { kind: 'drawing', attemptId, position: '1', file: { name: 'gambar.png', mimeType: 'image/png', buffer: Buffer.from(PNG_1PX, 'base64') } },
  })
  expect(evil.status()).toBe(403)
})

test('hasil dan pembahasan tes tidak bisa dibuka sebelum dikumpulkan', async ({ page }) => {
  await registerTablet(page, ['Aisha'])
  await pinLogin(page, 'Aisha')
  const attemptId = await createPracticeAttempt('Aisha', mcqItems('e2.', 2), { mode: 'tes' })
  for (const path of [`/results/${attemptId}`, `/results/${attemptId}/review`]) {
    await page.goto(path)
    await expect(page, path).toHaveURL(new RegExp(`/run/${attemptId}$`))
  }
})
