import { expect, test } from '@playwright/test'
import { closeDb, expectNoSeriousA11y, noHorizontalScroll, pinLogin, registerTablet, waitForPath, watchErrors } from './helpers'

test.afterAll(closeDb)

/**
 * Navigasi learner: rel tablet memuat delapan tujuan, bar bawah di HP memuat empat tujuan utama ditambah lembar More
 * untuk sisanya (ketuk saja, target minimal 44 px).
 */

const RAIL = ['Today', 'Map', 'Review', 'Competitions', 'English Skills', 'Quick Maths', 'Quiz Arena', 'Me']

test('tablet: rel kiri memuat delapan tujuan utama', async ({ page }) => {
  const errors = watchErrors(page)
  await registerTablet(page, ['Aisha'])
  await pinLogin(page, 'Aisha')
  const nav = page.getByRole('navigation', { name: 'Main' }).first()
  const names = await nav.getByRole('link').allInnerTexts()
  // Review tampil bila learner memakainya; semua tujuan lain selalu ada, dalam urutan ini.
  expect(names.map((n) => n.split('\n')[0]!.trim()).filter((n) => RAIL.includes(n))).toEqual(RAIL.filter((n) => n === 'Review' ? names.some((x) => x.startsWith('Review')) : true))
  expect(errors.filter((e) => !e.includes('favicon'))).toEqual([])
})

test('HP: bar bawah memuat tujuan utama dan lembar More memuat sisanya', async ({ page }) => {
  const errors = watchErrors(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await registerTablet(page, ['Aisha'])
  await pinLogin(page, 'Aisha')
  const bar = page.getByRole('navigation', { name: 'Main' }).last()
  await expect(bar.getByRole('link', { name: 'Today' })).toBeVisible()
  await expect(bar.getByRole('link', { name: 'Map' })).toBeVisible()
  await expect(bar.getByRole('link', { name: 'Me' })).toBeVisible()
  await expect(bar.getByRole('link', { name: 'Quiz Arena' })).toHaveCount(0)
  const more = bar.getByRole('button', { name: 'More' })
  await expect(more).toBeVisible()
  await expect(more).toHaveAttribute('aria-expanded', 'false')
  await noHorizontalScroll(page)

  await more.click()
  const sheet = page.getByRole('dialog', { name: 'More' })
  await expect(sheet).toBeVisible()
  for (const name of ['Competitions', 'English Skills', 'Quick Maths', 'Quiz Arena']) {
    const link = sheet.getByRole('link', { name })
    await expect(link).toBeVisible()
    const box = await link.boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(44)
  }
  await expectNoSeriousA11y(page, 'More sheet')
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
  await expect(more).toBeFocused()

  await more.click()
  await page.getByRole('dialog', { name: 'More' }).getByRole('link', { name: 'Quiz Arena' }).click()
  await waitForPath(page, (p) => p === '/quiz-arena')
  // Di layar arena, tombol More menyala karena layar yang terbuka ada di dalamnya.
  await expect(page.getByRole('navigation', { name: 'Main' }).last().getByRole('button', { name: /^More/ })).toBeVisible()
  expect(errors.filter((e) => !e.includes('favicon'))).toEqual([])
})
