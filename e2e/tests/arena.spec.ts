import { expect, test, type Page } from '@playwright/test'
import { closeDb, db, expectNoSeriousA11y, learnerId, noHorizontalScroll, pinLogin, registerTablet, watchErrors } from './helpers'

test.afterAll(closeDb)

async function typeNumber(page: Page, n: number) {
  for (const ch of String(n)) await page.getByRole('button', { name: ch, exact: true }).click()
}

/** Hitung jawaban soal aritmetika dari teks soal di layar ("6 + 63 = ?"). */
async function solve(page: Page): Promise<number> {
  const text = ((await page.locator('p[aria-live="polite"]').first().textContent()) ?? '').trim()
  const missing = /^(\d+) \+ \? = (\d+)$/.exec(text)
  if (missing) return Number(missing[2]) - Number(missing[1])
  const m = /^(\d+) ([+−×÷]) (\d+) = \?$/.exec(text)
  if (!m) throw new Error(`Soal tidak dikenali: ${text}`)
  const a = Number(m[1])
  const b = Number(m[3])
  return m[2] === '+' ? a + b : m[2] === '−' ? a - b : m[2] === '×' ? a * b : a / b
}

test('Quick Maths: latihan dari menu sampai hasil, XP ungu masuk, Today dan Me menampilkan tiga bar', async ({ page }) => {
  const errors = watchErrors(page)
  await registerTablet(page, ['Aisha'])
  await pinLogin(page, 'Aisha')

  // Tiga bar XP ada di Today.
  await expect(page.getByRole('list', { name: 'XP and levels' })).toBeVisible()

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Quick Maths' }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Quick Maths' })).toBeVisible()
  await expectNoSeriousA11y(page, 'Quick Maths hub')
  await noHorizontalScroll(page)

  await page.getByRole('button', { name: 'Start practice' }).click()
  await expect(page.getByText('Question 1 of 10')).toBeVisible()
  await expectNoSeriousA11y(page, 'Quick Maths ronde')

  // Satu jawaban salah dulu: kunci dan petunjuk muncul setelah menjawab.
  await typeNumber(page, 9999)
  await page.getByRole('button', { name: 'Check' }).click()
  await expect(page.getByText(/The answer is/)).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()

  for (let i = 1; i < 10; i++) {
    await expect(page.getByText(`Question ${i + 1} of 10`)).toBeVisible()
    await typeNumber(page, await solve(page))
    await page.getByRole('button', { name: 'Check' }).click()
    await expect(page.getByText('Correct').first()).toBeVisible()
  }
  await expect(page.getByRole('heading', { level: 1, name: 'Round done' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('You got 9 of 10 right.')).toBeVisible()
  await expect(page.getByText('Quick Maths XP')).toBeVisible()
  await expectNoSeriousA11y(page, 'Quick Maths hasil')

  // XP tercatat di jalur hitung, bukan di XP Belajar.
  const lid = await learnerId('Aisha')
  const rows = await db()`select track, sum(amount)::int as n from xp_event where learner_id = ${lid} group by track`
  expect(rows.map((r) => r.track)).toEqual(['hitung'])
  expect(rows[0]!.n).toBeGreaterThan(0)

  await page.goto('/me')
  await expect(page.getByRole('heading', { name: 'XP and levels' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Accessories' })).toBeVisible()
  await expectNoSeriousA11y(page, 'Me')
  expect(errors.filter((e) => !e.includes('favicon'))).toEqual([])
})

test('Quiz Arena: kuis provinsi tanpa timer, soal diacak, hasil dan kemajuan topik', async ({ page }) => {
  const errors = watchErrors(page)
  await registerTablet(page, ['Aisha'])
  await pinLogin(page, 'Aisha')

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Quiz Arena' }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Quiz Arena' })).toBeVisible()
  await expectNoSeriousA11y(page, 'Quiz Arena hub')
  await page.getByRole('link', { name: /Provinces of Indonesia/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Provinces of Indonesia' })).toBeVisible()
  await expectNoSeriousA11y(page, 'Quiz Arena topik')
  await page.getByRole('button', { name: 'Start quiz' }).click()

  await expect(page.getByText('Question 1 of 10')).toBeVisible()
  await expectNoSeriousA11y(page, 'Quiz ronde')
  for (let i = 0; i < 10; i++) {
    await expect(page.getByText(`Question ${i + 1} of 10`)).toBeVisible()
    const choices = page.locator('section[aria-label="Question"] button').filter({ hasNotText: /^(Next|Skip)$/ })
    if (await page.locator('ol[aria-label="Your order"]').count()) {
      const items = page.locator('ul[aria-label="Tap in order"] button')
      while ((await items.count()) > 0) await items.first().click()
      await page.getByRole('button', { name: 'Check' }).click()
    } else {
      await choices.first().click()
    }
    const next = page.getByRole('button', { name: 'Next', exact: true })
    await expect(next.or(page.getByText(`Question ${i + 2} of 10`)).or(page.getByRole('heading', { name: 'Round done' })).first()).toBeVisible({ timeout: 15_000 })
    if (await next.isVisible().catch(() => false)) await next.click()
  }
  await expect(page.getByRole('heading', { level: 1, name: 'Round done' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('Quiz XP').first()).toBeVisible()

  const lid = await learnerId('Aisha')
  const answers = await db()`select answered, correct, mode from arena_session where learner_id = ${lid} and arena = 'pengetahuan' and finished_at is not null`
  expect(answers).toHaveLength(1)
  expect(answers[0]!.mode).toBe('quiz')
  expect(answers[0]!.answered).toBe(10)
  expect(errors.filter((e) => !e.includes('favicon'))).toEqual([])
})

test('Arena: ronde milik learner lain tidak bisa dibuka, halaman bendera memakai berkas sendiri', async ({ page }) => {
  await registerTablet(page, ['Aisha', 'Raka'])
  await pinLogin(page, 'Aisha')
  const other = await learnerId('Raka')
  const org = (await db()`select org_id from learner_profile where user_id = ${other}`)[0]!.org_id as string
  const rows = await db()`insert into arena_session (org_id, learner_id, arena, mode, seed, config, date)
    values (${org}, ${other}, 'hitung', 'practice', 'x', '{}'::jsonb, current_date) returning id`
  const res = await page.goto(`/quick-maths/play/${rows[0]!.id as string}`)
  expect(res?.status()).toBe(404)

  const flag = await page.request.get('/flags/4x3/id.svg')
  expect(flag.status()).toBe(200)
  expect(flag.headers()['content-type']).toContain('image/svg')
  expect((await page.request.get('/flags/LICENSE')).status()).toBe(200)
})
