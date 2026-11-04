import { expect, test } from '@playwright/test'
import { closeDb, db, expectNoSeriousA11y, learnerId, loginAdult, GUARDIAN, noHorizontalScroll, pinLogin, registerTablet, waitForPath, watchErrors } from './helpers'

test.afterAll(closeDb)

test('Latihan Bebas: menu dengan pilihan, mulai latihan topik, dan kartu belajar', async ({ page }) => {
  const errors = watchErrors(page)
  await registerTablet(page, ['Aisha'])
  await pinLogin(page, 'Aisha')

  await page.getByRole('navigation', { name: 'Main' }).first().getByRole('link', { name: 'Practice' }).click()
  await waitForPath(page, (p) => p === '/practice')
  await expect(page.getByRole('heading', { level: 1, name: 'Free practice' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Number of questions' })).toBeVisible()
  await page.getByRole('button', { name: 'True or false' }).click()
  await page.getByRole('button', { name: 'Mixed', exact: true }).click()
  await page.getByRole('button', { name: '5', exact: true }).click()
  await expectNoSeriousA11y(page, 'Practice')
  await noHorizontalScroll(page)

  // Satu tile topik Math memulai sesi di runner tanpa quest.
  const mathTile = page.locator('section[aria-labelledby="pr-math"] a').first()
  await expect(mathTile).toBeVisible()
  await mathTile.click()
  await waitForPath(page, (p) => p.startsWith('/run/') || p === '/practice')

  // Kartu belajar: dek contoh, balik kartu, tombol penilaian.
  await page.goto('/practice/cards')
  await expect(page.getByRole('heading', { level: 1, name: 'Flashcards' })).toBeVisible()
  await page.getByRole('link', { name: /Animal words/ }).click()
  await waitForPath(page, (p) => p.startsWith('/practice/cards/'))
  await page.getByRole('button', { name: /Card front/ }).click()
  await page.getByRole('button', { name: 'I knew it' }).click()
  await expect(page.getByText('Card 2 of')).toBeVisible()
  expect(errors.filter((e) => !e.includes('favicon'))).toEqual([])
})

test('Saklar fitur: Math mati menyembunyikan menu Math dan Quick Maths, rute mati dialihkan dengan ramah', async ({ page }) => {
  const id = await learnerId('Aisha')
  const org = (await db()`select org_id from learner_profile where user_id = ${id}`)[0]!.org_id as string
  for (const key of ['math', 'mental-math']) {
    await db()`insert into learner_feature (learner_id, org_id, key, enabled) values (${id}, ${org}, ${key}, false) on conflict (learner_id, key) do update set enabled = false`
  }
  try {
    await registerTablet(page, ['Aisha'])
    await pinLogin(page, 'Aisha')
    const nav = page.getByRole('navigation', { name: 'Main' }).first()
    await expect(nav.getByRole('link', { name: 'Quick Maths' })).toHaveCount(0)
    await page.goto('/quick-maths')
    await waitForPath(page, (p) => p === '/practice')
    await expect(page.getByText(/is resting for now/)).toBeVisible()
    await expect(page.locator('section[aria-labelledby="pr-math"]')).toHaveCount(0)
    await expect(page.locator('section[aria-labelledby="pr-science"]')).toBeVisible()
  } finally {
    await db()`delete from learner_feature where learner_id = ${id}`
  }
})

test('Orang tua: daftar centang fitur di halaman anak dengan pilihan cepat', async ({ page }) => {
  await loginAdult(page, GUARDIAN, '/keluarga')
  await page.getByRole('link', { name: /Aisha/ }).first().click()
  await waitForPath(page, (p) => p.startsWith('/keluarga/anak/'))
  await page.getByRole('heading', { name: 'Pengaturan' }).click()
  await expect(page.getByRole('heading', { name: 'Fitur yang dipakai' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Mapel harian' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Drill dan latihan' })).toBeVisible()
  await page.getByRole('button', { name: 'Fokus sekolah' }).click()
  await expect(page.getByRole('checkbox', { name: 'Quiz Arena' })).not.toBeChecked()
  await page.getByRole('button', { name: 'Lengkap' }).click()
  await expect(page.getByRole('checkbox', { name: 'Quiz Arena' })).toBeChecked()
})

test('Ulasan singkat: pelajaran selesai muncul, langkah inti dan tiga soal cepat', async ({ page }) => {
  const id = await learnerId('Aisha')
  const org = (await db()`select org_id from learner_profile where user_id = ${id}`)[0]!.org_id as string
  await db()`insert into skill_state (learner_id, org_id, skill_id, lesson_done_at) values (${id}, ${org}, 'e1.digraphs', now()) on conflict (learner_id, skill_id) do update set lesson_done_at = now()`
  await registerTablet(page, ['Aisha'])
  await pinLogin(page, 'Aisha')
  await page.goto('/practice/review')
  await expect(page.getByRole('heading', { level: 1, name: 'Quick review' })).toBeVisible()
  await page.locator('a[href="/practice/review/e1.digraphs"]').click()
  await expect(page.getByRole('link', { name: 'Try 3 questions' })).toBeVisible()
  await page.getByRole('link', { name: 'Try 3 questions' }).click()
  await waitForPath(page, (p) => p.startsWith('/run/'))
})
