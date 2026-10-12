import { expect, test, type Page } from '@playwright/test'
import { closeDb, createPracticeAttempt, db, expectNoSeriousA11y, learnerId, mcqItems, noHorizontalScroll, pinLogin, registerTablet, waitForPath, watchErrors } from './helpers'

test.afterAll(closeDb)

async function answerMcq(page: Page, optionText: string) {
  await page.getByRole('radio', { name: optionText }).or(page.getByRole('button', { name: optionText })).first().click()
  await page.getByRole('button', { name: 'Check', exact: true }).click()
}

test('PIN salah memberi sisa percobaan, PIN benar membuka Today', async ({ page }) => {
  const errors = watchErrors(page)
  await registerTablet(page, ['Aisha', 'Raka'])
  await expect(page.getByRole('link', { name: /^Aisha, Grade 2/ })).toBeVisible()
  await expectNoSeriousA11y(page, 'pilih learner')

  await page.getByRole('link', { name: /^Aisha, Grade 2/ }).click()
  await waitForPath(page, (p) => p.startsWith('/pin/'))
  for (const p of ['Ball', 'Ball', 'Ball', 'Ball']) await page.getByRole('button', { name: p, exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: /4 more tries/ })).toBeVisible()
  await expectNoSeriousA11y(page, 'PIN')

  await pinLogin(page, 'Aisha')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expectNoSeriousA11y(page, 'Today')
  await noHorizontalScroll(page)
  expect(errors.filter((e) => !e.includes('favicon'))).toEqual([])
})

test('latihan: jawab, lihat umpan balik, selesai, dan hasil tersimpan', async ({ page }) => {
  const errors = watchErrors(page)
  const items = mcqItems('e2.', 3)
  expect(items.length).toBe(3)
  const attemptId = await createPracticeAttempt('Aisha', items)
  await registerTablet(page, ['Aisha'])
  await pinLogin(page, 'Aisha')

  await page.goto(`/run/${attemptId}`)
  await expect(page.getByText('Question 1 of 3')).toBeVisible()
  await expectNoSeriousA11y(page, 'runner')

  // Soal 1 benar, soal 2 salah dua kali, soal 3 benar.
  await answerMcq(page, items[0]!.options[items[0]!.answer]!.text!)
  await expect(page.getByText(/correct/i).first()).toBeVisible()
  await page.getByRole('button', { name: /^Next$/ }).click()

  const wrong = items[1]!.options.findIndex((_, i) => i !== items[1]!.answer)
  await answerMcq(page, items[1]!.options[wrong]!.text!)
  await expect(page.getByText(/not yet/i).first()).toBeVisible()

  // Coba lagi lalu lanjut sampai selesai, apa pun hasilnya.
  for (let guard = 0; guard < 6; guard++) {
    if (await page.getByText('Quest done').isVisible().catch(() => false)) break
    const next = page.getByRole('button', { name: /^(Next|Finish)$/ })
    if (await next.isVisible().catch(() => false)) {
      await next.click()
      continue
    }
    const tryAgain = page.getByRole('button', { name: /try again/i })
    if (await tryAgain.isVisible().catch(() => false)) await tryAgain.click()
    const pos = (await page.getByText(/Question (\d) of 3/).textContent())?.match(/Question (\d)/)?.[1]
    const it = items[Number(pos ?? '3') - 1]!
    await answerMcq(page, it.options[it.answer]!.text!)
  }
  await waitForPath(page, (p) => p === `/results/${attemptId}`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expectNoSeriousA11y(page, 'hasil')

  const rows = await db()`select position, attempt_no, status from response where attempt_id = ${attemptId} order by position, attempt_no`
  expect(rows.length).toBeGreaterThanOrEqual(3)
  expect(rows.find((r) => r.position === 1)?.status).toBe('correct')
  expect(rows.find((r) => r.position === 2 && r.attempt_no === 1)?.status).toBe('wrong')
  const [a] = await db()`select status, score_raw from attempt where id = ${attemptId}`
  expect(a!.status).toBe('submitted')
  const lid = await learnerId('Aisha')
  const xp = await db()`select coalesce(sum(amount), 0)::int as n from xp_event where learner_id = ${lid}`
  expect(xp[0]!.n).toBeGreaterThan(0)
  expect(errors.filter((e) => !e.includes('favicon'))).toEqual([])
})

test('ganti learner mengakhiri sesi dan kembali ke pilihan learner', async ({ page }) => {
  await registerTablet(page, ['Aisha', 'Raka'])
  await pinLogin(page, 'Aisha')
  await page.goto('/me')
  await page.getByRole('link', { name: 'Switch learner' }).click()
  await waitForPath(page, (p) => p === '/')
  await page.goto('/today')
  await expect(page).toHaveURL((u) => u.pathname === '/')
  await pinLogin(page, 'Raka')
  await expect(page).toHaveURL(/\/today$/)
})
