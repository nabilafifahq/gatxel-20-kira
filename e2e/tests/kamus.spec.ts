import { expect, test } from '@playwright/test'
import { closeDb, db, expectNoSeriousA11y, learnerId, noHorizontalScroll, pinLogin, registerTablet, watchErrors } from './helpers'

test.afterAll(closeDb)

/** Kamus Ketuk: ketuk kata di pelajaran, lihat arti, simpan, lihat di My words, dan hapus. Mati di skill kosakata. */
test('Kamus Ketuk: ketuk, simpan, My words, dan mati di skill kosakata', async ({ page }) => {
  const sql = db()
  const aisha = await learnerId('Aisha')
  await sql`delete from saved_word where learner_id = ${aisha}`

  const errors = watchErrors(page)
  await registerTablet(page, ['Aisha', 'Raka'])
  await pinLogin(page, 'Aisha')

  // Skill kosakata: kata tidak bisa diketuk.
  await page.goto('/lesson/e2.synonyms-opposites')
  await expect(page.locator('p[aria-live="polite"]')).toBeVisible()
  await page.waitForTimeout(800)
  await expect(page.locator('p[aria-live="polite"] button')).toHaveCount(0)

  // Skill biasa: kata bisa diketuk.
  await page.goto('/lesson/e2.pronouns')
  const caption = page.locator('p[aria-live="polite"]')
  await expect(caption).toBeVisible()
  const word = caption.getByRole('button').first()
  await expect(word).toBeVisible()
  const text = (await word.innerText()).toLowerCase()
  await word.click()
  const dialog = page.getByRole('dialog', { name: new RegExp(text.replace(/[^a-z']/g, ''), 'i') })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('[lang="id"]')).not.toBeEmpty()
  await expectNoSeriousA11y(page, 'popover Kamus Ketuk')
  await noHorizontalScroll(page)

  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog.getByText('Saved')).toBeVisible()
  const rows = await sql`select word from saved_word where learner_id = ${aisha}`
  expect(rows.length).toBe(1)

  // Esc menutup popover.
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()

  await page.goto('/my-words')
  await expect(page.getByRole('heading', { level: 1, name: 'My words' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Saved words' }).getByRole('listitem')).toHaveCount(1)
  await expectNoSeriousA11y(page, 'My words')
  await noHorizontalScroll(page)

  await page.getByRole('button', { name: /^Remove / }).click()
  await expect(page.getByText(/Tap a word in a question or a lesson/)).toBeVisible()
  expect((await sql`select word from saved_word where learner_id = ${aisha}`).length).toBe(0)
  expect(errors).toEqual([])
})
