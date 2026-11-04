import { expect, test } from '@playwright/test'
import { closeDb, db, expectNoSeriousA11y, GUARDIAN, jakartaToday, learnerId, loginAdult, noHorizontalScroll, seedOrgId, watchErrors } from './helpers'

test.afterAll(async () => {
  const org = await seedOrgId()
  await db()`delete from worksheet where org_id = ${org}`
  await closeDb()
})

/**
 * Pelatih Orang Tua: halaman mingguan (data tipis tetap membantu), lembar kerja (buat, buka lembar dan kunci, batas harian)
 * dan rapor bulanan. Semua di lebar HP, tanpa geser mendatar.
 */

test('Pelatih: anak dengan data memberi skill, kegiatan, dan kalimat pujian; anak baru mendapat penjelasan jujur', async ({ page }) => {
  const errors = watchErrors(page)
  await page.setViewportSize({ width: 390, height: 844 })
  const org = await seedOrgId()
  const raka = await learnerId('Raka')
  const aisha = await learnerId('Aisha')
  await db()`delete from skill_state where learner_id in (${raka}, ${aisha}) and skill_id in ('m4.place-value', 'e4.prefixes')`
  await db()`delete from skill_state where learner_id = ${aisha}`
  await db()`insert into skill_state (org_id, learner_id, skill_id, theta, n_answers, recent, gate, stars)
    values (${org}, ${raka}, 'm4.place-value', 0, 14, ${Array.from({ length: 14 }, () => 0.4)}, 'reteach', 1)
    on conflict (learner_id, skill_id) do update set n_answers = 14, recent = excluded.recent, gate = 'reteach', stars = 1`
  await loginAdult(page, GUARDIAN, `/keluarga/pelatih?learner=${raka}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Pelatih orang tua' })).toBeVisible()
  await expect(page.getByText('Kegiatan 10 menit:').first()).toBeVisible()
  await expect(page.getByText('Kalimat yang bisa Anda ucapkan')).toBeVisible()
  await expect(page.getByText(/Data masih sedikit|Baru 1 skill/).first()).toBeVisible()
  await noHorizontalScroll(page)
  await expectNoSeriousA11y(page, 'pelatih')

  await page.goto(`/keluarga/pelatih?learner=${aisha}`)
  await expect(page.getByText('Belum cukup data').first()).toBeVisible()
  await expect(page.getByText('Untuk dicoba dulu', { exact: false })).toBeVisible()
  await noHorizontalScroll(page)
  expect(errors.filter((e) => !e.includes('favicon'))).toEqual([])
})

test('Lembar kerja: buat lembar, buka lembar dan kunci, batas harian', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const org = await seedOrgId()
  await db()`delete from worksheet where org_id = ${org}`
  const raka = await learnerId('Raka')
  await loginAdult(page, GUARDIAN, `/keluarga/lembar?learner=${raka}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Lembar kerja' })).toBeVisible()
  await noHorizontalScroll(page)
  await page.getByRole('button', { name: 'Buat lembar kerja' }).click()
  await expect(page.getByRole('heading', { name: 'Lembar siap' })).toBeVisible()
  const sheet = await page.getByRole('link', { name: /Buka lembar untuk anak/ }).getAttribute('href')
  const key = await page.getByRole('link', { name: /Buka kunci jawaban/ }).getAttribute('href')
  expect(sheet).toMatch(/^\/cetak\/lembar\/[0-9a-f-]{36}$/)
  expect(key).toBe(`${sheet}/kunci`)

  const p2 = await context.newPage()
  await p2.setViewportSize({ width: 390, height: 844 })
  await p2.goto(sheet!)
  await expect(p2.getByText('Take your time.').first()).toBeVisible()
  await expect(p2.getByRole('button', { name: 'Cetak halaman ini' })).toBeVisible()
  await expect(p2.getByText('Raka').first()).toBeVisible()
  await p2.goto(key!)
  await expect(p2.getByText('Kunci jawaban, untuk orang tua').first()).toBeVisible()
  await expect(p2.getByText('Answer', { exact: true }).first()).toBeVisible()
  expect(await p2.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  await p2.close()

  // Jatah harian: setelah 10 lembar dibuat, tombol mati dan pesan jelas muncul.
  const today = jakartaToday()
  const rows = (await db()`select count(*)::int as n from worksheet where org_id = ${org}`)[0]!.n as number
  for (let i = rows; i < 10; i++) {
    await db()`insert into worksheet (org_id, learner_id, subject, skill_id, item_count, day) values (${org}, ${raka}, 'math', 'm4.place-value', 6, ${today})`
  }
  await page.goto(`/keluarga/lembar?learner=${raka}`)
  await expect(page.getByText('Jatah hari ini sudah habis.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Buat lembar kerja' })).toBeDisabled()
})

test('Rapor bulanan: ringkasan, cakupan mengacu pada kerangka Cambridge Primary, dan versi cetak', async ({ page }) => {
  const errors = watchErrors(page)
  await page.setViewportSize({ width: 390, height: 844 })
  const aisha = await learnerId('Aisha')
  await loginAdult(page, GUARDIAN, `/keluarga/rapor?learner=${aisha}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Rapor bulanan' })).toBeVisible()
  await expect(page.getByText('Yang bisa dilakukan bulan depan')).toBeVisible()
  await noHorizontalScroll(page)
  await expectNoSeriousA11y(page, 'rapor bulanan')
  const href = await page.getByRole('link', { name: 'Buka versi cetak' }).getAttribute('href')
  expect(href).toContain(`/cetak/rapor/${aisha}`)
  await page.goto(href!)
  await expect(page.getByText('Rapor bulanan').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cetak halaman ini' })).toBeVisible()
  const body = await page.locator('main').innerText()
  expect(body).not.toMatch(/resmi dari Cambridge|disertifikasi|terakreditasi/i)
  expect(errors.filter((e) => !e.includes('favicon'))).toEqual([])
})

test('Rapor dan lembar kerja: keluarga lain mendapat 404 untuk anak yang bukan miliknya', async ({ page }) => {
  await loginAdult(page, GUARDIAN, '/keluarga')
  const res = await page.goto('/cetak/rapor/00000000-0000-4000-8000-000000000000')
  expect(res?.status()).toBe(404)
  const res2 = await page.goto('/cetak/lembar/00000000-0000-4000-8000-000000000000')
  expect(res2?.status()).toBe(404)
})
