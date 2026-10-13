import { expect, test } from '@playwright/test'
import { closeDb, expectNoSeriousA11y, noHorizontalScroll, pinLogin, registerTablet, waitForPath, watchErrors } from './helpers'

test.afterAll(closeDb)

test('English Skills: lima kartu, tingkat Starters untuk kelas 2, dan menu ada di navigasi utama', async ({ page }) => {
  const errors = watchErrors(page)
  await registerTablet(page, ['Aisha'])
  await pinLogin(page, 'Aisha')

  await page.getByRole('navigation', { name: 'Main' }).first().getByRole('link', { name: 'English Skills' }).click()
  await waitForPath(page, (p) => p === '/english')
  await expect(page.getByRole('heading', { level: 1, name: 'English Skills' })).toBeVisible()
  await expect(page.getByText(/Starters level \(Pre A1\)/)).toBeVisible()
  for (const title of ['Listening', 'Speaking test', 'Writing', 'Spelling Bee', 'Reading']) {
    await expect(page.getByRole('heading', { level: 2, name: title })).toBeVisible()
  }
  await expectNoSeriousA11y(page, 'English Skills')
  await noHorizontalScroll(page)
  expect(errors.filter((e) => !e.includes('favicon'))).toEqual([])
})

test('Listening: teks soal tersembunyi, tombol putar ada, teks bisa dibuka', async ({ page }) => {
  await registerTablet(page, ['Aisha'])
  await pinLogin(page, 'Aisha')

  await page.goto('/english/listening/start')
  await waitForPath(page, (p) => p.startsWith('/run/'))
  await expect(page.getByText('Listen, then choose the answer.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play the question' })).toBeVisible()
  // Soal listening dimulai dengan kata Listen: sebelum dibuka, teksnya tidak terlihat.
  await expect(page.locator('p[lang="en-GB"]', { hasText: /^Listen/ })).toBeHidden()
  await page.getByRole('button', { name: 'Show the words' }).click()
  await expect(page.locator('p[lang="en-GB"]', { hasText: /^Listen/ })).toBeVisible()
  await expectNoSeriousA11y(page, 'listening runner')
})

test('Speaking: penguji menampilkan soal bergambar dan widget rekam', async ({ page }) => {
  await registerTablet(page, ['Aisha'])
  await pinLogin(page, 'Aisha')

  await page.goto('/english/speaking/start')
  await waitForPath(page, (p) => p.startsWith('/run/'))
  await expect(page.getByLabel('Question').first()).toBeVisible()
  await expect(page.getByRole('button', { name: /record/i }).first()).toBeVisible()
})

test('Spelling Bee: satu putaran punya sepuluh kata, tombol dengar, dan kotak ketik', async ({ page }) => {
  const errors = watchErrors(page)
  await registerTablet(page, ['Aisha'])
  await pinLogin(page, 'Aisha')

  await page.goto('/english/spelling')
  await expect(page.getByRole('heading', { level: 1, name: 'Spelling Bee' })).toBeVisible()
  await expect(page.getByText('Word 1 of 10')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Hear the word' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Hear it in a sentence' })).toBeVisible()
  await page.getByLabel('Type the word you hear').fill('zzzz')
  await page.getByRole('button', { name: 'Check', exact: true }).click()
  await expect(page.getByText('Not quite. Listen again and try once more.')).toBeVisible()
  await expectNoSeriousA11y(page, 'Spelling Bee')
  expect(errors.filter((e) => !e.includes('favicon'))).toEqual([])
})
