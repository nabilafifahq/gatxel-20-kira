import { expect, test } from '@playwright/test'
import { closeDb, db, expectNoSeriousA11y, GUARDIAN, learnerId, loginAdult, noHorizontalScroll, watchErrors } from './helpers'

test.afterAll(closeDb)

test('orang tua melihat ringkasan minggu dan halaman privasi', async ({ page }) => {
  const errors = watchErrors(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await loginAdult(page, GUARDIAN)
  await expect(page).toHaveURL(/\/keluarga/)
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  await expectNoSeriousA11y(page, 'ringkasan keluarga')
  await noHorizontalScroll(page)
  await page.goto('/keluarga/privasi')
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  await expectNoSeriousA11y(page, 'privasi keluarga')
  await noHorizontalScroll(page)
  expect(errors.filter((e) => !e.includes('favicon'))).toEqual([])
})

test('menarik lalu memberi lagi persetujuan rekaman suara tercatat append-only', async ({ page }) => {
  await loginAdult(page, GUARDIAN)
  const aisha = await learnerId('Aisha')
  await page.goto(`/keluarga/privasi?learner=${aisha}`)
  const before = (await db()`select count(*)::int as n from consent_event where learner_id = ${aisha} and purpose = 'audio'`)[0]!.n
  const toggle = page.getByRole('switch', { name: /suara/i }).or(page.getByRole('checkbox', { name: /suara/i })).first()
  await expect(toggle).toBeVisible()
  await toggle.click()
  const confirm = page.getByRole('dialog').getByRole('button', { name: /Tarik|Ya|Simpan/ }).first()
  if (await confirm.isVisible().catch(() => false)) await confirm.click()
  await expect
    .poll(async () => (await db()`select granted from consent_event where learner_id = ${aisha} and purpose = 'audio' order by created_at desc limit 1`)[0]!.granted, { timeout: 15_000 })
    .toBe(false)
  await page.reload()
  await page.getByRole('switch', { name: /suara/i }).or(page.getByRole('checkbox', { name: /suara/i })).first().click()
  const confirm2 = page.getByRole('dialog').getByRole('button', { name: /Setujui|Ya|Simpan/ }).first()
  if (await confirm2.isVisible().catch(() => false)) await confirm2.click()
  await expect
    .poll(async () => (await db()`select granted from consent_event where learner_id = ${aisha} and purpose = 'audio' order by created_at desc limit 1`)[0]!.granted, { timeout: 15_000 })
    .toBe(true)
  const after = (await db()`select count(*)::int as n from consent_event where learner_id = ${aisha} and purpose = 'audio'`)[0]!.n
  expect(after).toBe(before + 2)
})

test('permintaan hapus akun anak bisa dibatalkan dan akun aktif lagi', async ({ page }) => {
  await loginAdult(page, GUARDIAN)
  const raka = await learnerId('Raka')
  await page.goto(`/keluarga/privasi?learner=${raka}`)
  await page.getByRole('button', { name: /Hapus akun|Minta penghapusan|Hapus data/ }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox').fill('Raka')
  await dialog.getByRole('button', { name: /Hapus|Kirim/ }).last().click()
  await expect
    .poll(async () => (await db()`select count(*)::int as n from deletion_request where learner_id = ${raka} and cancelled_at is null`)[0]!.n, { timeout: 15_000 })
    .toBe(1)
  const [job] = await db()`select run_after from job where kind = 'learner.delete' and payload->>'learnerId' = ${raka} order by created_at desc limit 1`
  expect(new Date(job!.run_after as string).getTime()).toBeGreaterThan(Date.now() + 6 * 86400000)
  expect((await db()`select active from learner_profile where user_id = ${raka}`)[0]!.active).toBe(false)

  await page.getByRole('button', { name: /Batalkan/ }).first().click()
  const confirm = page.getByRole('dialog').getByRole('button', { name: /Batalkan/ }).first()
  if (await confirm.isVisible().catch(() => false)) await confirm.click()
  await expect
    .poll(async () => (await db()`select active from learner_profile where user_id = ${raka}`)[0]!.active, { timeout: 15_000 })
    .toBe(true)
  await db()`delete from job where kind = 'learner.delete' and payload->>'learnerId' = ${raka}`
})
