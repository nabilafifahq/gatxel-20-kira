import { expect, test } from '@playwright/test'
import { closeDb, createPracticeAttempt, db, mcqItems, pinLogin, registerTablet } from './helpers'

test.afterAll(closeDb)

test('tes berwaktu: jam mulai saat dibuka dan jawaban dikumpulkan otomatis saat waktu habis', async ({ page }) => {
  const items = mcqItems('e2.', 3)
  const attemptId = await createPracticeAttempt('Aisha', items, { mode: 'tes', timeLimitS: 120 })
  // Attempt dibuat 10 menit lalu (seperti quest yang dibuat saat Today dimuat pagi hari).
  await db()`update attempt set started_at = now() - interval '10 minutes' where id = ${attemptId}`
  await registerTablet(page, ['Aisha'])
  await pinLogin(page, 'Aisha')

  await page.clock.install()
  await page.goto(`/run/${attemptId}`)
  await expect(page.getByText(/2:00|1:59/).first()).toBeVisible()
  const [opened] = await db()`select opened_at from attempt where id = ${attemptId}`
  expect(opened!.opened_at).not.toBeNull()

  const first = items[0]!
  await page.getByRole('radio', { name: first.options[first.answer]!.text! }).or(page.getByRole('button', { name: first.options[first.answer]!.text! })).first().click()
  await expect.poll(async () => (await db()`select count(*)::int as n from response where attempt_id = ${attemptId}`)[0]!.n, { timeout: 20_000 }).toBeGreaterThanOrEqual(1)

  await page.clock.fastForward('02:05')
  const dialog = page.getByRole('alertdialog')
  await expect(dialog.getByText(/Your answers are saved/)).toBeVisible()
  await expect.poll(async () => (await db()`select status from attempt where id = ${attemptId}`)[0]!.status, { timeout: 20_000 }).toBe('submitted')
  await dialog.getByRole('link', { name: /See my score/ }).or(dialog.getByRole('button', { name: /See my score/ })).first().click()
  await page.waitForURL(new RegExp(`/results/${attemptId}`), { timeout: 30_000 })
  const [a] = await db()`select status, elapsed_s from attempt where id = ${attemptId}`
  expect(a!.status).toBe('submitted')
  expect(a!.elapsed_s).toBeLessThanOrEqual(120)
  const [r] = await db()`select status from response where attempt_id = ${attemptId} and position = 1`
  expect(r!.status).toBe('correct')
})
