import { expect, test } from '@playwright/test'

/** Pola isian wajib di form daftar: tanda *, tombol tampak abu-abu tetapi tetap bisa diketuk, pesan di samping isian, dan fokus. */
const TERMS = 'Centang persetujuan Syarat dan Ketentuan untuk melanjutkan.'

test.describe('isian wajib di form daftar', () => {
  test.skip(!!process.env.TURNSTILE_SITE_KEY, 'Pemeriksaan keamanan aktif: tes ini memakai form tanpa Turnstile')

  test('tanda, tombol abu-abu, pesan, dan fokus', async ({ page }) => {
    await page.goto('/daftar')
    await expect(page.getByText('wajib diisi').first()).toBeVisible()
    const name = page.getByLabel('Nama orang tua')
    await expect(name).toHaveAttribute('aria-required', 'true')
    await expect(page.getByLabel('Email', { exact: true })).toHaveAttribute('aria-required', 'true')
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('aria-required', 'true')

    const terms = page.getByRole('checkbox', { name: /Saya setuju dengan Syarat dan Ketentuan dan Kebijakan Privasi/ })
    await expect(terms).toHaveAttribute('aria-required', 'true')
    await expect(terms).not.toBeChecked()
    const marketing = page.getByRole('checkbox', { name: /Kirim saya kabar produk, tips belajar, dan penawaran dari Kira lewat email \(opsional\)/ })
    await expect(marketing).not.toBeChecked()
    await expect(marketing).not.toHaveAttribute('aria-required', 'true')

    // Tautan persetujuan membuka tab baru, jadi isian tidak hilang.
    for (const href of ['/ketentuan', '/privasi']) await expect(page.locator(`form a[href="${href}"]`)).toHaveAttribute('target', '_blank')

    const submit = page.getByRole('button', { name: 'Daftar', exact: true })
    await expect(submit).toHaveAttribute('aria-disabled', 'true')
    await expect(submit).toBeEnabled()

    // Ketukan saat belum lengkap tidak mengirim: pesan muncul dan fokus pindah ke masalah pertama.
    await submit.click()
    await expect(page.getByText('Tulis nama Anda, paling sedikit 2 huruf.')).toBeVisible()
    await expect(page.getByText(TERMS)).toBeVisible()
    await expect(name).toBeFocused()
    await expect(page.getByRole('heading', { name: 'Cek email Anda' })).toHaveCount(0)

    // Password 12 karakter cukup; yang belum dicentang tinggal persetujuan.
    await name.fill('Ibu Uji')
    await page.getByLabel('Email', { exact: true }).fill('ibu.uji.wajib@gmail.com')
    await page.getByLabel('Password', { exact: true }).fill('Abcdefgh123!')
    await expect(page.getByText('Minimal 12 karakter')).toBeVisible()
    await expect(submit).toHaveAttribute('aria-disabled', 'true')
    await submit.click()
    await expect(page.getByText(TERMS)).toBeVisible()
    await expect(terms).toBeFocused()

    // Email kabar tidak wajib: tombol hidup hanya karena persetujuan wajib.
    await terms.check()
    await expect(page.getByText(TERMS)).toHaveCount(0)
    await expect(submit).not.toHaveAttribute('aria-disabled', 'true')
  })

  test('form masuk tidak punya kotak centang wajib baru', async ({ page }) => {
    await page.goto('/masuk')
    await expect(page.getByRole('button', { name: 'Masuk', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Masuk', exact: true })).not.toHaveAttribute('aria-disabled', 'true')
    await expect(page.getByRole('checkbox', { name: /Saya setuju/ })).toHaveCount(0)
  })
})
