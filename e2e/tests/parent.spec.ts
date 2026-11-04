import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { closeDb, db, expectNoSeriousA11y, GUARDIAN, jakartaToday, learnerId, loginAdult, noHorizontalScroll, pinLogin, registerTablet, seedOrgId, watchErrors } from './helpers'

test.afterAll(async () => {
  // Kembalikan hari Penuh untuk spesifikasi lain.
  const org = await seedOrgId()
  await db()`update day_rules set preset = 'penuh', rules = null where org_id = ${org}`
  await closeDb()
})

/**
 * Dashboard orang tua (/keluarga): beranda berisi anak, halaman anak dengan sesi hari ini dan pengaturan,
 * aturan hari, atur ulang streak dengan konfirmasi nama, dan anak yang bukan milik keluarga ini menjadi 404.
 * Hari Penuh dari data contoh: 9 sesi wajib. Today anak menampilkan label Wajib dan Opsional.
 */

test('Today anak memberi label sesi wajib dan petunjuk streak', async ({ page }) => {
  const lid = await learnerId('Aisha')
  const org = await seedOrgId()
  await db()`update learner_profile set rest_weekdays = '{}' where user_id = ${lid}`
  await db()`update day_rules set preset = 'seimbang', rules = null where learner_id = ${lid} and org_id = ${org}`
  await db()`delete from attempt where id in (select attempt_id from quest where learner_id = ${lid} and date = ${jakartaToday()} and attempt_id is not null)`
  await db()`delete from quest where learner_id = ${lid} and date = ${jakartaToday()}`
  await registerTablet(page, ['Aisha', 'Raka'], 'Tablet orang tua')
  await pinLogin(page, 'Aisha')
  await expect(page.getByText('Required today')).toBeVisible()
  await expect(page.getByText('Finish the required ones to keep your streak.')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Optional today' })).toBeVisible()
  await expect(page.getByText(/3 of 3|0 of 3 sessions done/)).toBeVisible()
})

test('beranda orang tua menampilkan kedua anak, tanpa geser mendatar di HP', async ({ page }) => {
  const errors = watchErrors(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await loginAdult(page, GUARDIAN, '/keluarga')
  await expect(page.getByRole('heading', { level: 1, name: /Halo/ })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Aisha' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Raka' })).toBeVisible()
  await expectNoSeriousA11y(page, 'beranda orang tua')
  await noHorizontalScroll(page)
  expect(errors.filter((e) => !e.includes('favicon'))).toEqual([])
})

test('halaman anak: aturan hari Ringan tersimpan dan atur ulang streak meminta nama', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await loginAdult(page, GUARDIAN, '/keluarga')
  const aisha = await learnerId('Aisha')
  await page.goto(`/keluarga/anak/${aisha}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Aisha' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Sesi hari ini' })).toBeVisible()
  await noHorizontalScroll(page)

  await page.getByRole('heading', { level: 2, name: 'Pengaturan' }).click()
  await page.getByRole('radio', { name: /^Ringan/ }).click()
  await page.getByRole('button', { name: 'Simpan aturan hari' }).click()
  await expect.poll(async () => (await db()`select preset from day_rules where learner_id = ${aisha}`)[0]?.preset).toBe('ringan')
  await expect(page.getByText(/Hari ini ikut berubah|tersimpan/).first()).toBeVisible()

  // Atur ulang streak: tombol membuka konfirmasi, nama harus diketik.
  await db()`insert into day_record (org_id, learner_id, date, quests_done, quests_required) values (${await seedOrgId()}, ${aisha}, '2026-10-01', 3, 3) on conflict do nothing`
  await page.getByRole('button', { name: 'Atur ulang streak' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox').fill('Salah')
  await dialog.getByRole('button', { name: 'Atur ulang streak' }).click()
  await expect(dialog).toBeVisible()
  await dialog.getByRole('textbox').fill('Aisha')
  await dialog.getByRole('button', { name: 'Atur ulang streak' }).click()
  await expect.poll(async () => (await db()`select count(*)::int as n from day_record where learner_id = ${aisha} and date < ${jakartaToday()}`)[0]!.n).toBe(0)
  const audit = await db()`select actor_kind from audit_log where action = 'parent.streak.reset' and target = ${aisha}`
  expect(audit[0]?.actor_kind).toBe('guardian')
})

test('anak keluarga lain tidak bisa dibuka orang tua ini', async ({ page }) => {
  const orgB = randomUUID()
  const kid = randomUUID()
  await db()`insert into org (id, name) values (${orgB}, 'Keluarga lain __GTX_SEED__')`
  await db()`insert into learner_profile (user_id, org_id, name, grade, active) values (${kid}, ${orgB}, 'Anak Lain', 2, true)`
  try {
    await loginAdult(page, GUARDIAN, '/keluarga')
    const res = await page.goto(`/keluarga/anak/${kid}`)
    expect(res?.status()).toBe(404)
    const res2 = await page.goto(`/keluarga/anak/${kid}/hasil/${randomUUID()}`)
    expect(res2?.status()).toBe(404)
  } finally {
    await db()`delete from org where id = ${orgB}`
  }
})
