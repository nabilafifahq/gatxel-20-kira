import { expect, test } from '@playwright/test'
import { closeDb, expectNoSeriousA11y, noHorizontalScroll, pinLogin, registerTablet, waitForPath, watchErrors } from './helpers'

test.afterAll(closeDb)

test('Ruang Baca: perpustakaan, filter level, baca satu bab, kuis, dan rak buku', async ({ page }) => {
  const errors = watchErrors(page)
  await registerTablet(page, ['Aisha'])
  await pinLogin(page, 'Aisha')

  await page.getByRole('navigation', { name: 'Main' }).first().getByRole('link', { name: 'Reading Room' }).click()
  await waitForPath(page, (p) => p === '/reading')
  await expect(page.getByRole('heading', { level: 1, name: 'Reading Room' })).toBeVisible()
  await expect(page.getByText('Your shelf is empty for now', { exact: false })).toBeVisible()
  await expectNoSeriousA11y(page, 'library')
  await noHorizontalScroll(page)

  await page.getByRole('button', { name: 'Grade 1', exact: true }).click()
  await page.getByRole('link', { name: /Dewi and the Red Kite/ }).click()
  await waitForPath(page, (p) => p === '/reading/g1-dewi-red-kite')
  await expect(page.getByRole('heading', { level: 2, name: 'Chapters' })).toBeVisible()
  await page.getByRole('link', { name: 'Start reading' }).click()

  await waitForPath(page, (p) => p === '/reading/g1-dewi-red-kite/c1')
  await expect(page.getByRole('heading', { level: 1, name: /Chapter 1: A Red Kite/ })).toBeVisible()
  await expect(page.getByText('Dewi has a red kite.')).toBeVisible()
  await expect(page.getByRole('button', { name: /Read along|Play/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Read this sentence again' })).toBeVisible()
  const size = page.getByText(/^Text: /)
  await expect(size).toHaveText('Text: Large')
  await page.getByRole('button', { name: 'Larger text' }).click()
  await expect(size).toHaveText('Text: Extra large')
  await page.getByRole('button', { name: 'Smaller text' }).click()
  await expectNoSeriousA11y(page, 'reader')
  await noHorizontalScroll(page)

  // Pindah halaman sampai tombol Finish chapter muncul.
  for (let i = 0; i < 10; i++) {
    if (await page.getByRole('button', { name: 'Finish chapter' }).isVisible()) break
    await page.getByRole('button', { name: 'Next page' }).click()
  }
  await page.getByRole('button', { name: 'Finish chapter' }).click()
  await page.getByRole('button', { name: 'Answer the questions' }).click()
  for (let q = 0; q < 5; q++) {
    await expect(page.getByText(`Question ${q + 1} of 5`)).toBeVisible()
    await page.getByRole('radio').first().click()
    await page.getByRole('button', { name: q < 4 ? 'Next question' : 'Check my answers' }).click()
  }
  await expect(page.getByRole('heading', { level: 2, name: /You got \d of 5/ })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Next chapter' })).toBeVisible()
  await expectNoSeriousA11y(page, 'quiz result')

  // Tempat berhenti dan menit tampil di perpustakaan.
  await page.goto('/reading')
  await expect(page.getByRole('heading', { level: 2, name: 'Keep reading' })).toBeVisible()
  expect(errors.filter((e) => !e.includes('favicon'))).toEqual([])
})

test('Ruang Baca di HP: tidak ada gulir mendatar dan target sentuh 44 px', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 700 }, hasTouch: true, locale: 'en-GB', timezoneId: 'Asia/Jakarta' })
  const page = await ctx.newPage()
  await registerTablet(page, ['Aisha'])
  await pinLogin(page, 'Aisha')
  await page.goto('/reading/g1-dewi-red-kite/c1')
  await expect(page.getByText('Dewi has a red kite.')).toBeVisible()
  await noHorizontalScroll(page)
  for (const name of ['Smaller text', 'Larger text', 'Read this sentence again']) {
    const box = await page.getByRole('button', { name }).boundingBox()
    expect(box!.width).toBeGreaterThanOrEqual(44)
    expect(box!.height).toBeGreaterThanOrEqual(44)
  }
  await ctx.close()
})
