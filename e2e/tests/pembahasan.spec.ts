import { expect, test, type Page } from '@playwright/test'
import { closeDb, db, expectNoSeriousA11y, learnerId, mcqItems, noHorizontalScroll, pinLogin, registerTablet, seedOrgId, waitForPath, watchErrors } from './helpers'

test.afterAll(closeDb)

async function answerMcq(page: Page, optionText: string) {
  // Kata di soal bisa diketuk (Kamus Ketuk) dan juga berperan tombol, jadi pilihan dicari hanya di dalam kelompok jawaban.
  const answers = page.getByRole('group', { name: 'Answers' })
  await answers.getByRole('radio', { name: optionText }).or(answers.getByRole('button', { name: optionText })).first().click()
  await page.getByRole('button', { name: 'Check', exact: true }).click()
}

async function mathAttempt(mode: 'latihan' | 'tes', refs: { id: string; difficulty: number }[]): Promise<string> {
  const org = await seedOrgId()
  const lid = await learnerId('Aisha')
  const items = refs.map((r, i) => ({ ref: r.id, section: 'core', position: i + 1, difficulty: r.difficulty }))
  const rows = await db()`
    insert into attempt (org_id, learner_id, kind, mode, subject, title, items, time_limit_s)
    values (${org}, ${lid}, 'test', ${mode}, 'math', 'Pembahasan e2e', ${db().json(items)}, ${mode === 'tes' ? 600 : null})
    returning id`
  return rows[0]!.id as string
}

/** Pembahasan bergerak dan putaran perbaikan di Latihan (Pembahasan Bergerak). */
test('Latihan: salah dua kali membuka pembahasan, pelajaran, dan satu soal serupa', async ({ page }) => {
  const errors = watchErrors(page)
  const items = mcqItems('m3.', 2)
  expect(items.length).toBe(2)
  const attemptId = await mathAttempt('latihan', items)
  await registerTablet(page, ['Aisha'])
  await pinLogin(page, 'Aisha')
  const first = await page.goto(`/run/${attemptId}`)
  // Pembahasan dimuat malas: halaman runner tidak membawa langkahnya.
  expect(await first!.text()).not.toContain('"solution":[')
  await expect(page.getByText('Question 1 of 2')).toBeVisible()

  const wrongText = items[0]!.options.find((_, i) => i !== items[0]!.answer)!.text!
  await answerMcq(page, wrongText)
  await expect(page.getByText(/not yet/i).first()).toBeVisible()
  await expect(page.getByTestId('remedial-panel')).toHaveCount(0)
  await page.getByRole('button', { name: /try again/i }).click()
  await answerMcq(page, wrongText)

  // Kunci terbuka, putaran perbaikan muncul.
  const panel = page.getByTestId('remedial-panel')
  await expect(panel).toBeVisible()
  await expectNoSeriousA11y(page, 'putaran perbaikan')

  // 1. Pembahasan bergerak: tidak jalan sendiri, bisa diputar dan dijeda.
  await panel.getByRole('button', { name: 'Watch how it works' }).click()
  const player = page.getByRole('region', { name: 'Solution player' })
  await expect(player).toBeVisible()
  await expect(player.getByText(/Step 1 of \d/)).toBeVisible()
  await expect(player.getByText('Tap Play')).toBeVisible()
  await player.getByRole('button', { name: 'Next step' }).click()
  await expect(player.getByText(/Step 2 of \d/)).toBeVisible()
  await player.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(player.getByRole('button', { name: 'Pause' })).toBeVisible()
  await player.getByRole('button', { name: 'Pause' }).click()
  await page.getByRole('button', { name: 'Close' }).click()

  // 2. Satu langkah pelajaran (bila skill punya pelajaran), 3. soal serupa.
  const lessonBtn = panel.getByRole('button', { name: 'One quick lesson' })
  await expect(lessonBtn.or(panel.getByRole('button', { name: 'Try one like it' }))).toBeVisible()
  if (await lessonBtn.isVisible().catch(() => false)) {
    await lessonBtn.click()
    await expect(page.getByRole('region', { name: 'Quick lesson' })).toBeVisible()
    await page.getByRole('button', { name: 'Close' }).click()
  }
  await panel.getByRole('button', { name: 'Try one like it' }).click()
  await expect(page.getByText(/Question 2 of 3/)).toBeVisible()

  const org = await db()`select items from attempt where id = ${attemptId}`
  const stored = org[0]!.items as { ref: string; remedialOf?: number }[]
  expect(stored).toHaveLength(3)
  expect(stored[2]!.remedialOf).toBe(1)
  expect(new Set(stored.map((s) => s.ref)).size).toBe(3)
  await noHorizontalScroll(page)
  expect(errors.filter((e) => !e.includes('favicon'))).toEqual([])
})

test('Latihan: jawaban benar tidak menambah langkah apa pun', async ({ page }) => {
  const items = mcqItems('m3.', 2)
  const attemptId = await mathAttempt('latihan', items)
  await registerTablet(page, ['Aisha'])
  await pinLogin(page, 'Aisha')
  await page.goto(`/run/${attemptId}`)
  await answerMcq(page, items[0]!.options[items[0]!.answer]!.text!)
  await expect(page.getByText(/correct/i).first()).toBeVisible()
  await expect(page.getByTestId('remedial-panel')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /try one like it/i })).toHaveCount(0)
})

test('reduced motion: pembahasan tampil sebagai gambar diam dengan Back dan Next', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const items = mcqItems('m3.', 2)
  const attemptId = await mathAttempt('latihan', items)
  await registerTablet(page, ['Aisha'])
  await pinLogin(page, 'Aisha')
  await page.goto(`/run/${attemptId}`)
  const wrongText = items[0]!.options.find((_, i) => i !== items[0]!.answer)!.text!
  await answerMcq(page, wrongText)
  await page.getByRole('button', { name: /try again/i }).click()
  await answerMcq(page, wrongText)
  await page.getByTestId('remedial-panel').getByRole('button', { name: 'Watch how it works' }).click()
  const player = page.getByRole('region', { name: 'Solution player' })
  await expect(player.getByText('Still pictures')).toBeVisible()
  await expect(player.getByRole('button', { name: 'Play', exact: true })).toHaveCount(0)
  await player.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(player.getByText(/Step 2 of/)).toBeVisible()
})

test('Tes berwaktu: tidak ada pembahasan atau kunci sebelum dikumpulkan, pembahasan ada di review sesudahnya', async ({ page }) => {
  const items = mcqItems('m3.', 2)
  const attemptId = await mathAttempt('tes', items)
  await registerTablet(page, ['Aisha'])
  await pinLogin(page, 'Aisha')
  const res = await page.goto(`/run/${attemptId}`)
  const html = await res!.text()
  expect(html).not.toContain('"solution"')
  expect(html).not.toContain('remedial')
  await expect(page.getByTestId('remedial-panel')).toHaveCount(0)

  // Kumpulkan lewat server, lalu review menawarkan pembahasan.
  await db()`update attempt set status = 'submitted', submitted_at = now(), score_raw = 0, score_max = 2 where id = ${attemptId}`
  await page.goto(`/results/${attemptId}/review`)
  await waitForPath(page, (p) => p.endsWith("/review"))
  await expect(page.getByRole('region', { name: 'Solution player' }).first()).toBeVisible()
})
