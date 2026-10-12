import { expect, test } from '@playwright/test'
import { closeDb, GUARDIAN, loginAdult, TUTOR, waitForPath, watchErrors } from './helpers'

test.afterAll(closeDb)

test('password salah memberi pesan umum tanpa membocorkan akun', async ({ page }) => {
  await page.goto('/masuk')
  // Tanpa JavaScript pun password tidak pernah masuk ke URL.
  for (const method of await page.locator('form').evaluateAll((fs) => fs.map((f) => f.getAttribute('method')))) expect(method).toBe('post')
  await page.getByLabel('Email').first().fill(TUTOR.email)
  await page.getByLabel('Password', { exact: true }).fill('password-yang-salah-sekali')
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  const alert = page.getByRole('alert').filter({ hasText: /\S/ }).first()
  await expect(alert).toBeVisible()
  const wrongPassword = (await alert.textContent()) ?? ''

  await page.goto('/masuk')
  await page.getByLabel('Email').first().fill('tidak-ada@contoh.test')
  await page.getByLabel('Password', { exact: true }).fill('password-yang-salah-sekali')
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  const alert2 = page.getByRole('alert').filter({ hasText: /\S/ }).first()
  await expect(alert2).toBeVisible()
  const unknownAccount = (await alert2.textContent()) ?? ''
  // Kode referensi berbeda; isi pesan selain kode harus sama persis.
  const strip = (s: string) => s.replace(/KR-[0-9A-F]{6}/g, 'KODE')
  expect(strip(wrongPassword)).toBe(strip(unknownAccount))
})

test('tutor masuk ke konsol dan keluar lagi', async ({ page }) => {
  const errors = watchErrors(page)
  await loginAdult(page, TUTOR)
  await expect(page).toHaveURL(/\/konsol$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Hari ini' })).toBeVisible()
  await page.getByRole('button', { name: 'Keluar' }).first().click()
  await waitForPath(page, (p) => p === '/masuk')
  await page.goto('/konsol')
  await expect(page).toHaveURL(/\/masuk\?next=/)
  expect(errors).toEqual([])
})

test('orang tua masuk ke halaman keluarga dan tidak bisa membuka konsol', async ({ page }) => {
  await loginAdult(page, GUARDIAN)
  await expect(page).toHaveURL(/\/keluarga/)
  await page.goto('/konsol/pengaturan')
  await expect(page).toHaveURL(/\/keluarga/)
  await page.goto('/cetak/paper/00000000-0000-4000-8000-000000000000')
  await expect(page).toHaveURL(/\/keluarga/)
})

test('passkey: tutor membuat passkey lalu masuk tanpa password', async ({ page }) => {
  const errors = watchErrors(page)
  // Autentikator virtual Chromium: sidik jari atau PIN perangkat disetujui otomatis.
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  })
  await loginAdult(page, TUTOR)
  await page.goto('/konsol/pengaturan')
  await page.getByRole('button', { name: 'Tambah passkey' }).click()
  const dialog = page.getByRole('dialog', { name: 'Tambah passkey' })
  await dialog.getByLabel('Nama passkey').fill('Laptop e2e')
  await dialog.getByRole('button', { name: 'Buat passkey' }).click()
  await expect(page.getByText('Passkey Laptop e2e tersimpan.')).toBeVisible()

  await page.getByRole('button', { name: 'Keluar' }).first().click()
  await waitForPath(page, (p) => p === '/masuk')
  await page.getByRole('button', { name: 'Masuk dengan passkey' }).click()
  await waitForPath(page, (p) => p.startsWith('/konsol'))
  await expect(page.getByRole('heading', { level: 1, name: 'Hari ini' })).toBeVisible()
  expect(errors.filter((e) => !e.includes('favicon'))).toEqual([])
})
