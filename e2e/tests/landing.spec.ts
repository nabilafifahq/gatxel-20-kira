import { expect, test } from '@playwright/test'
import { expectNoSeriousA11y, watchErrors } from './helpers'

/** Halaman publik tanpa sesi: halaman depan, daftar, masuk, dan dokumen hukum. Tidak butuh Mailpit. */
test('halaman depan, daftar, dan masuk lolos aksesibilitas tanpa error konsol', async ({ page }) => {
  const errors = watchErrors(page)
  for (const path of ['/', '/daftar', '/masuk', '/privasi', '/ketentuan']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    await expectNoSeriousA11y(page, path)
  }
  expect(errors).toEqual([])
})

test('halaman depan muat di layar HP tanpa gulir horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto('/')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

