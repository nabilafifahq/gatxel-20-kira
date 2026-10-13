import { expect, test } from '@playwright/test'
import { closeDb, db, expectNoSeriousA11y, learnerId, noHorizontalScroll, pinLogin, registerTablet, seedOrgId, waitForPath, watchErrors } from './helpers'

test.afterAll(closeDb)

/** Fix-it Book (Buku Salah): soal salah dari Tes terkumpul, muncul di Review, dan sesi ulang bisa dimulai. */
test('Fix-it Book: kartu di Review, daftar, dan mulai sesi ulang', async ({ page }) => {
  const sql = db()
  const org = await seedOrgId()
  const aisha = await learnerId('Aisha')
  const refs = ['m2.oly-patterns.001', 'm2.oly-logic.001']
  await sql`delete from attempt where learner_id = ${aisha} and ref_id like 'buku-salah%'`
  const [att] = await sql`insert into attempt (org_id, learner_id, kind, mode, subject, title, items, submitted_at, status, score_raw, score_max)
    values (${org}, ${aisha}, 'quest', 'tes', 'math', 'Tes e2e', ${sql.json(refs.map((ref, i) => ({ ref, section: 'core', position: i + 1, difficulty: 3 })))}, now(), 'submitted', 0, 2) returning id`
  for (const [i, ref] of refs.entries()) {
    await sql`insert into response (org_id, attempt_id, learner_id, position, item_ref, skill_id, subject, item_type, difficulty, status, time_ms, client_id)
      values (${org}, ${att!.id}, ${aisha}, ${i + 1}, ${ref}, ${ref.split('.').slice(0, 2).join('.')}, 'math', 'mcq', 3, 'wrong', 20000, ${`fixit-e2e-${i}-${Date.now()}`})`
  }

  const errors = watchErrors(page)
  await registerTablet(page, ['Aisha', 'Raka'])
  await pinLogin(page, 'Aisha')

  await page.goto('/review')
  await expect(page.getByRole('heading', { name: 'Fix-it Book' })).toBeVisible()
  await expect(page.getByText(/2 questions to try again/)).toBeVisible()
  await expectNoSeriousA11y(page, 'review dengan kartu Fix-it')
  await noHorizontalScroll(page)

  await page.getByRole('link', { name: 'Open Fix-it Book' }).click()
  await waitForPath(page, (p) => p === '/fix-it')
  await expect(page.getByRole('heading', { level: 1, name: 'Fix-it Book' })).toBeVisible()
  await expect(page.getByText(/2 questions from tests and papers to try again/)).toBeVisible()
  await expectNoSeriousA11y(page, 'Fix-it Book')
  await noHorizontalScroll(page)

  await page.getByRole('link', { name: /Fix some now|Start Saturday fix-it/ }).click()
  await waitForPath(page, (p) => p.startsWith('/run/'))
  const [redo] = await sql`select ref_id, mode, jsonb_array_length(items) as n from attempt where learner_id = ${aisha} and ref_id like 'buku-salah%'`
  expect(redo).toMatchObject({ mode: 'latihan', n: 2 })
  await expect(page.getByRole('button').first()).toBeVisible()
  expect(errors.filter((e) => !e.includes('favicon'))).toEqual([])
})
