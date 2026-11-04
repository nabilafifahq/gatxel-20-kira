import { expect, test, type Page } from '@playwright/test'
import { closeDb, db, expectNoSeriousA11y, GUARDIAN, learnerId, loginAdult, noHorizontalScroll, pinLogin, registerTablet, seedOrgId, watchErrors } from './helpers'

/**
 * Tes penempatan: kartu hari pertama di Today, tes adaptif satu soal sekali tampil tanpa skor, lewati dan lanjutkan,
 * hari belajar tetap jalan, hasil untuk orang tua dengan catatan bukan asesmen Cambridge, tes ulang sebulan sekali,
 * dan anak lama tidak ditanya.
 */

test.afterAll(async () => {
  const org = await seedOrgId()
  await db()`delete from placement_run where org_id = ${org}`
  await db()`update learner_profile set created_at = now() where org_id = ${org} and name in ('Aisha', 'Raka')`
  await closeDb()
})

/** Jawab "I'm not sure" sampai tes selesai. Mengembalikan jumlah soal yang tampil. */
async function finishWithUnsure(page: Page): Promise<number> {
  let shown = 0
  for (let i = 0; i < 14; i++) {
    if (await page.getByRole('heading', { name: 'All done, thank you!' }).isVisible()) break
    await expect(page.getByRole('region', { name: 'Question' })).toBeVisible()
    shown++
    await page.getByRole('button', { name: "I'm not sure" }).click()
    await expect(page.getByRole('heading', { name: 'All done, thank you!' }).or(page.getByRole('button', { name: "I'm not sure", disabled: false }))).toBeVisible()
  }
  return shown
}

test('anak baru: kartu di Today, tes tanpa skor, lewati, dan hari belajar tetap jalan', async ({ page }) => {
  const errors = watchErrors(page)
  const org = await seedOrgId()
  const aisha = await learnerId('Aisha')
  const raka = await learnerId('Raka')
  await db()`delete from placement_run where org_id = ${org}`
  // Tes lain sudah menjawab soal sebagai Aisha; tes penempatan otomatis hanya untuk anak yang belum punya jawaban.
  await db()`delete from skill_state where learner_id = ${aisha}`
  await db()`update learner_profile set created_at = '2026-12-01T00:00:00Z' where user_id = ${aisha}`
  await db()`update learner_profile set created_at = '2026-01-10T00:00:00Z' where user_id = ${raka}`

  await registerTablet(page, ['Aisha', 'Raka'], 'Tablet penempatan')
  await pinLogin(page, 'Aisha')
  const card = page.getByRole('region', { name: 'Find your starting point' })
  await expect(card).toBeVisible()
  await expect(card).toContainText('This helps Kira pick the right questions')
  await expect(page.getByText('Required today')).toBeVisible()
  await noHorizontalScroll(page)
  await expectNoSeriousA11y(page, 'Today dengan kartu penempatan')

  // Pilih mapel, lalu intro yang ramah.
  await card.getByRole('link', { name: "Let's go" }).click()
  await expect(page.getByRole('heading', { name: 'Pick a subject to start' })).toBeVisible()
  await page.getByRole('link', { name: /Math/ }).click()
  await expect(page.getByRole('heading', { name: 'Let us find your starting point' })).toBeVisible()
  await expect(page.getByText('No timer and no score. Nobody passes or fails.')).toBeVisible()
  await expectNoSeriousA11y(page, 'intro penempatan')
  await page.getByRole('button', { name: 'Start' }).click()

  // Soal pertama: tidak ada jam, tidak ada skor, tidak ada umpan balik benar atau salah.
  await expect(page.getByRole('region', { name: 'Question' })).toBeVisible()
  await expect(page.getByText(/Correct|Not yet|Try again|score|timer/i)).toHaveCount(0)
  await expectNoSeriousA11y(page, 'soal penempatan')
  await page.getByRole('button', { name: "I'm not sure" }).click()
  await expect(page.getByRole('region', { name: 'Question' })).toBeVisible()

  // Berhenti di tengah lalu lanjutkan: soal berikutnya tetap, nomor tidak mundur.
  await page.getByRole('link', { name: 'Stop for now' }).click()
  await expect(page.getByRole('region', { name: 'Find your starting point' }).or(page.getByRole('region', { name: 'Carry on with your starting point' }))).toBeVisible()
  await expect(page.getByRole('link', { name: 'Carry on' })).toBeVisible()
  const [mid] = await db()`select status, jsonb_array_length(answers) as n from placement_run where learner_id = ${aisha} and subject = 'math'`
  expect(mid!.status).toBe('in_progress')
  expect(mid!.n).toBe(1)

  await page.goto('/placement?subject=math')
  const shown = await finishWithUnsure(page)
  expect(shown).toBeGreaterThanOrEqual(7)
  expect(shown).toBeLessThanOrEqual(11)
  await expect(page.getByRole('heading', { name: 'All done, thank you!' })).toBeVisible()
  const [done] = await db()`select status, jsonb_array_length(answers) as n from placement_run where learner_id = ${aisha} and subject = 'math'`
  expect(done!.status).toBe('done')
  expect(done!.n).toBeGreaterThanOrEqual(8)
  expect(done!.n).toBeLessThanOrEqual(12)

  // Lewati English: tidak ditanya lagi; Science boleh nanti. Hari belajar tetap jalan.
  await page.goto('/placement?subject=english')
  await page.getByRole('button', { name: 'Skip this test' }).click()
  await expect(page.getByText('Required today')).toBeVisible()
  const [skipped] = await db()`select status from placement_run where learner_id = ${aisha} and subject = 'english'`
  expect(skipped!.status).toBe('skipped')
  await expect(page.getByRole('region', { name: 'Find your starting point' })).toBeVisible()

  // Anak lama tidak ditanya.
  await page.goto('/bye')
  await pinLogin(page, 'Raka')
  await expect(page.getByText('Required today')).toBeVisible()
  await expect(page.getByRole('region', { name: /starting point/ })).toHaveCount(0)
  const [{ n }] = (await db()`select count(*)::int as n from placement_run where learner_id = ${raka}`) as unknown as [{ n: number }]
  expect(n).toBe(0)
  expect(errors.length).toBe(0)
})

test('orang tua melihat hasil dengan catatan perkiraan, lalu menyiapkan tes yang dilewati; tes ulang sebulan sekali', async ({ page }) => {
  const errors = watchErrors(page)
  const aisha = await learnerId('Aisha')
  await loginAdult(page, GUARDIAN, `/keluarga/anak/${aisha}`)
  const section = page.locator('details', { has: page.getByRole('heading', { level: 2, name: 'Tes penempatan' }) })
  await expect(section).toBeVisible()
  await section.locator('summary').click()
  await expect(section.getByText(/sekitar kelas \d/).first()).toBeVisible()
  await expect(section.getByText('Peta kekuatan per bagian')).toBeVisible()
  await expect(section.getByText('Yang sudah kuat')).toBeVisible()
  await expect(section.getByText('Yang akan jadi fokus')).toBeVisible()
  await expect(section.getByText('Yang akan Kira lakukan')).toBeVisible()
  await expect(section.getByText(/bukan asesmen Cambridge/)).toBeVisible()
  await expect(section.getByText(/Tes ulang bisa disiapkan lagi mulai/)).toBeVisible()
  await noHorizontalScroll(page)

  // English dilewati: orang tua menyiapkannya lagi.
  await section.getByRole('button', { name: 'Siapkan tes lagi' }).click()
  await expect(section.getByText(/siap\. .* akan melihatnya di layar Hari Ini/)).toBeVisible()
  const [row] = await db()`select status, origin from placement_run where learner_id = ${aisha} and subject = 'english' and status = 'ready'`
  expect(row!.origin).toBe('parent')
  expect(errors.length).toBe(0)
})
