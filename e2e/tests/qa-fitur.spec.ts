import { expect, test } from '@playwright/test'
import { closeDb, db, learnerId, pinLogin, registerTablet, seedOrgId, waitForPath } from './helpers'

/** Temuan QA fitur anak (malam pilot): ponsel 375 px, kartu belajar, Tangram, dan chunk yang hilang setelah deployment baru. */

test.afterAll(async () => {
  const org = await seedOrgId()
  await db()`delete from placement_run where org_id = ${org}`
  await closeDb()
})

test('Latihan Bebas: mengetuk tile benar-benar memulai sesi, bukan pesan soal kurang', async ({ page }) => {
  await registerTablet(page, ['Aisha'], 'Tablet tile')
  await pinLogin(page, 'Aisha')
  await page.goto('/practice')
  await page.locator('section[aria-labelledby="pr-math"] a').first().click()
  await waitForPath(page, (p) => p.startsWith('/run/'))
  await expect(page.getByText(/Question 1 of/)).toBeVisible()
})

test('tes penempatan di ponsel: tombol Next dan I am not sure ada di dalam layar', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  const org = await seedOrgId()
  const aisha = await learnerId('Aisha')
  await db()`delete from placement_run where org_id = ${org}`
  await db()`insert into placement_run (org_id, learner_id, subject, origin, start_grade, theta) values (${org}, ${aisha}, 'math', 'auto', 2, -0.9)`
  await registerTablet(page, ['Aisha'], 'Ponsel penempatan')
  await pinLogin(page, 'Aisha')
  await page.goto('/placement?subject=math')
  await page.getByRole('button', { name: 'Start' }).click()
  const next = page.getByRole('button', { name: 'Next' })
  await expect(next).toBeVisible()
  const box = await next.boundingBox()
  expect(box!.x + box!.width).toBeLessThanOrEqual(375)
  const { scrollW } = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth }))
  expect(scrollW).toBeLessThanOrEqual(375)
})

test('kartu belajar: kelas anak lebih dulu, kelas lain lewat tombol', async ({ page }) => {
  await registerTablet(page, ['Aisha'], 'Tablet kartu')
  await pinLogin(page, 'Aisha')
  await page.goto('/practice/cards')
  await expect(page.getByRole('link', { name: /Grade 2/ }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: /, Grade 6/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Show other grades' }).click()
  await expect(page.getByRole('link', { name: /, Grade 6/ }).first()).toBeVisible()
})

test('Tangram: mengetuk tempat tidak menggambar blok hitam di papan', async ({ page }) => {
  await registerTablet(page, ['Aisha'], 'Tablet tangram')
  await pinLogin(page, 'Aisha')
  await page.goto('/tools')
  await page.getByRole('radio', { name: 'Tangram' }).click()
  await page.getByRole('radio', { name: 'Two triangles' }).click()
  await page.getByRole('group', { name: 'Tray of pieces' }).getByRole('button').first().click()
  await page.getByRole('button', { name: /^Place 1 of 2/ }).click()
  await expect(page.getByText(/1 of 2 placed/)).toBeVisible()
  const outline = await page.locator('svg[aria-label^="Tangram board"] g[role="button"]').first().evaluate((el) => getComputedStyle(el).outlineStyle)
  expect(outline).toBe('none')
})

test('chunk hilang setelah deployment baru: layar Kira yang ramah, bukan layar bawaan', async ({ page, context }) => {
  await registerTablet(page, ['Aisha'], 'Tablet chunk')
  await pinLogin(page, 'Aisha')
  await page.evaluate(() => sessionStorage.setItem('kira-chunk-reload-at', String(Date.now())))
  await context.route(/\/_next\/static\/chunks\/.*\.js/, (r) => r.fulfill({ status: 404, body: 'gone' }))
  await page.getByRole('navigation', { name: 'Main' }).first().getByRole('link', { name: 'Practice' }).click()
  await expect(page.getByRole('heading', { name: 'Kira has something new for you' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Back to Today' })).toBeVisible()
})
