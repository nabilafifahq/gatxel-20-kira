import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { GUARDIAN, loginAdult, noHorizontalScroll, watchErrors } from './helpers'

/** Panduan publik: terbuka tanpa masuk, tanpa pelanggaran axe, semua tautan dan gambar internal hidup. */

const GUIDES = ['/panduan', '/panduan/anak', '/panduan/aplikasi'] as const

/** Semua alamat internal di halaman, tanpa duplikat. */
async function internalLinks(page: Page): Promise<string[]> {
  const hrefs = await page.locator('a[href]').evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''))
  return [...new Set(hrefs.filter((h) => h.startsWith('/') && !h.startsWith('//')))]
}

test('ketiga panduan terbuka tanpa masuk, tanpa pelanggaran axe, dan muat di layar HP', async ({ page }) => {
  test.setTimeout(240_000)
  const errors = watchErrors(page)
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 800 })
    for (const path of GUIDES) {
      await page.goto(path)
      expect(new URL(page.url()).pathname).toBe(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
      expect(axe.violations.map((v) => `${path} @${width}: ${v.id} ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([])
      await noHorizontalScroll(page)
    }
  }
  expect(errors).toEqual([])
})

test('tautan internal, jangkar, dan gambar di panduan semuanya hidup', async ({ page, request }) => {
  test.setTimeout(240_000)
  for (const path of GUIDES) {
    await page.goto(path)
    for (const link of await internalLinks(page)) {
      const [target, hash] = link.split('#')
      if (target) {
        const res = await request.get(target)
        expect(res.status(), `${path} menaut ke ${link}`).toBeLessThan(400)
      }
      if (hash && (!target || target === path)) await expect(page.locator(`[id="${hash}"]`), `${path} menaut ke #${hash}`).toHaveCount(1)
    }
    const anchors = await page.locator('a[href^="#"]').evaluateAll((els) => els.map((e) => e.getAttribute('href')!.slice(1)))
    for (const id of new Set(anchors)) await expect(page.locator(`[id="${id}"]`), `${path} menaut ke #${id}`).toHaveCount(1)

    const images = await page.locator('main img').evaluateAll((els) => els.map((e) => ({ src: e.getAttribute('src')!, lazy: e.getAttribute('loading'), alt: e.getAttribute('alt') })))
    for (const img of images) {
      expect(img.lazy).toBe('lazy')
      expect(img.alt, img.src).toBeTruthy()
      const res = await request.get(img.src)
      expect(res.status(), img.src).toBe(200)
      expect((await res.body()).length, `${img.src} harus di bawah 80 KB`).toBeLessThan(80 * 1024)
      expect(res.headers()['cache-control']).toContain('public')
    }
  }
})

test('berkas APK tetap butuh masuk; orang tua yang masuk melihat jalan untuk mengunduh', async ({ page, request }) => {
  const anon = await request.get('/api/apk')
  expect(anon.status()).toBe(401)

  await page.goto('/panduan/aplikasi')
  const signIn = page.getByRole('link', { name: 'Masuk untuk mengunduh' })
  await expect(signIn).toHaveAttribute('href', '/masuk?next=/panduan/aplikasi')
  await expect(page.locator('a[href="/api/apk"]')).toHaveCount(0)

  await loginAdult(page, GUARDIAN, '/panduan/aplikasi')
  await page.goto('/panduan/aplikasi')
  await expect(signIn).toHaveCount(0)
  const download = page.getByRole('link', { name: 'Unduh aplikasi Android' })
  const preparing = page.getByText('Berkas aplikasi sedang disiapkan')
  await expect(download.or(preparing)).toBeVisible()
})

test('panduan memakai metadata berbagi dan alamat kontak dari konfigurasi', async ({ page }) => {
  await page.goto('/panduan')
  await expect(page).toHaveTitle(/Panduan Kira untuk orang tua/)
  const image = await page.locator('meta[property="og:image"]').getAttribute('content')
  expect(image).toContain('/panduan-img/berbagi.png')
  await expect(page.getByRole('link', { name: 'Buka halaman bantuan' })).toHaveAttribute('href', '/feedback')
  await expect(page.locator('a[href^="mailto:"]').first()).toBeVisible()
  await expect(page.getByText('Build by Gatxel @ 2026 Made with Love by GATteam')).toBeVisible()
})
