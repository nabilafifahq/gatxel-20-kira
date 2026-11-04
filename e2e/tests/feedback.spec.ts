import { randomBytes } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import { closeDb, db, expectNoSeriousA11y, GUARDIAN, loginAdult, pinLogin, registerTablet, watchErrors } from './helpers'

/**
 * Halaman Bantuan: pengirim publik dan orang tua yang masuk, lampiran terlalu besar dan PNG palsu, serta akun anak.
 * Pemeriksaan email lewat Mailpit dilewati bila MAILPIT_URL tidak diisi.
 */
const MAILPIT = process.env.MAILPIT_URL
test.afterAll(closeDb)

const run = randomBytes(4).toString('hex')
const ONE_PIXEL_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

type Mail = { ID: string; Subject: string; Text: string; HTML: string; ReplyTo: { Address: string }[]; To: { Address: string }[]; Attachments: { FileName: string; ContentType: string }[] }

async function mailWith(subjectPart: string): Promise<Mail> {
  for (let i = 0; i < 60; i++) {
    const list = (await (await fetch(`${MAILPIT}/api/v1/messages?limit=200`)).json()) as { messages: { ID: string; Subject: string }[] }
    const hit = list.messages.find((m) => m.Subject.includes(subjectPart))
    if (hit) return (await (await fetch(`${MAILPIT}/api/v1/message/${hit.ID}`)).json()) as Mail
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Email "${subjectPart}" tidak masuk Mailpit`)
}

async function fillForm(page: Page, subject: string): Promise<void> {
  await page.getByRole('radio', { name: 'Masalah atau bug' }).check({ force: true })
  await page.getByLabel('Subjek').fill(subject)
  await page.locator('textarea[name=message]').fill('Tombol simpan tidak merespons saat ditekan di HP saya.')
}

const ticket = async (subject: string) => (await db()`select * from support_ticket where subject = ${subject}`)[0]

test('alamat /bantuan dan tautan di halaman depan menuju halaman Bantuan', async ({ page }) => {
  await page.goto('/bantuan')
  await expect(page).toHaveURL(/\/feedback$/)
  await page.goto('/')
  await page.getByRole('contentinfo').getByRole('link', { name: 'Bantuan' }).click()
  await expect(page).toHaveURL(/\/feedback$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Bantuan dan masukan' })).toBeVisible()
})

test('pengunjung mengirim pesan dengan email sendiri', async ({ page }) => {
  const errors = watchErrors(page)
  const subject = `Tombol rusak ${run} publik`
  const email = `kira.uji.${run}@gmail.com`
  await page.goto('/feedback')

  const whatsapp = page.getByRole('link', { name: 'Chat lewat WhatsApp' })
  await expect(whatsapp).toHaveAttribute('href', /^https:\/\/wa\.me\/6287794551486\?text=.+/)
  await expect(page.getByText('0877 9455 1486')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Chat tim kemitraan' })).toHaveAttribute('href', /^https:\/\/wa\.me\/6287794551486\?text=.*bermitra/)
  await expect(page.getByTestId('metadata')).toContainText('browser Mozilla')
  await expect(page.getByTestId('metadata')).toContainText(/layar \d+x\d+/)
  await expect(page.getByTestId('metadata')).toContainText('WIB')
  await expect(page.getByTestId('metadata')).not.toContainText('akun')
  await expectNoSeriousA11y(page, '/feedback')

  await page.getByRole('button', { name: 'Kirim pesan' }).click()
  await expect(page.getByText('Pilih salah satu kategori.')).toBeVisible()
  await expect(page.getByText('Isi email Anda supaya kami bisa membalas.')).toBeVisible()

  await fillForm(page, subject)
  await page.getByLabel('Email Anda').fill(email)
  await page.getByRole('button', { name: 'Kirim pesan' }).click()
  const reference = await page.getByTestId('nomor-referensi').textContent()
  expect(reference).toMatch(/^KR-[0-9A-Z]{8}$/)
  await expect(page.getByRole('heading', { name: 'Pesan Anda sudah kami terima' })).toBeVisible()

  const row = await ticket(subject)
  expect(row).toMatchObject({ reference, category: 'bug', sender_email: email, account_id: null, account_role: null })
  expect(row!.user_agent).toContain('Mozilla')
  expect(row!.screen).toMatch(/^\d+x\d+$/)

  if (MAILPIT) {
    const mail = await mailWith(`[Kira][Bug] ${subject}`)
    expect(mail.Subject).toContain(reference!)
    expect(mail.ReplyTo.map((a) => a.Address)).toEqual([email])
    expect(mail.Text).toContain(email)
    expect(mail.Text).toContain('Tombol simpan tidak merespons')
    expect(mail.Text).toContain('Build by Gatxel @ 2026 Made with Love by GATteam')
    // Turnstile mati di lingkungan tes: pengirim publik tanpa bukti tidak menerima balasan otomatis.
    const confirm = (await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json()) as { messages: unknown[] }
    expect(confirm.messages).toHaveLength(0)
  }
  expect(errors).toEqual([])
})

test('lampiran terlalu besar dan PNG palsu ditolak dengan pesan jelas', async ({ page, request, baseURL }) => {
  const subject = `Lampiran ditolak ${run}`
  await page.goto('/feedback')
  await fillForm(page, subject)
  await page.getByLabel('Email Anda').fill(`kira.uji.${run}.b@gmail.com`)

  const file = page.locator('input[type="file"]')
  await file.setInputFiles({ name: 'besar.png', mimeType: 'image/png', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) })
  await expect(page.getByRole('alert').filter({ hasText: 'Ukuran paling besar 5 MB' })).toBeVisible()
  await file.setInputFiles({ name: 'catatan.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('MZ') })
  await expect(page.getByRole('alert').filter({ hasText: 'PNG, JPG, PDF, atau MP4' })).toBeVisible()

  // Lolos pemeriksaan di browser karena namanya .png; server membaca isinya dan menolak.
  await file.setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: Buffer.from('ini teks biasa yang berpura-pura menjadi gambar png') })
  await expect(page.getByText('foto.png')).toBeVisible()
  await page.getByRole('button', { name: 'Kirim pesan' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'PNG, JPG, PDF, atau MP4' }).first()).toBeVisible()
  await expect(page.getByLabel('Subjek')).toHaveValue(subject)
  expect(await ticket(subject)).toBeUndefined()

  // Tanpa formulir: server sendiri menolak berkas di atas 5 MB dan kolom yang tidak dikenal.
  const big = await request.post(`${baseURL}/api/feedback`, {
    multipart: { category: 'bug', subject, message: 'Pesan yang cukup panjang untuk lolos.', email: `kira.uji.${run}.b@gmail.com`, attachment: { name: 'besar.png', mimeType: 'image/png', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) } },
  })
  expect(big.status()).toBe(413)
  expect(await ticket(subject)).toBeUndefined()
})

test('orang tua yang masuk mengirim lampiran sebagai akunnya', async ({ page }) => {
  const errors = watchErrors(page)
  const subject = `Lampiran foto ${run} orang tua`
  await loginAdult(page, GUARDIAN)
  await page.goto('/keluarga')
  await page.getByRole('navigation', { name: 'Halaman keluarga' }).getByRole('link', { name: 'Bantuan' }).click()
  await expect(page).toHaveURL(/\/feedback\?dari=\/keluarga$/)

  await expect(page.getByTestId('dikirim-sebagai')).toContainText(`Dikirim sebagai ${GUARDIAN.email}`)
  await expect(page.getByLabel('Email Anda')).toHaveCount(0)
  await expect(page.getByTestId('metadata')).toContainText('halaman asal /keluarga')
  await expect(page.getByTestId('metadata')).toContainText('(orang tua)')
  await expectNoSeriousA11y(page, '/feedback masuk')

  await fillForm(page, subject)
  await page.locator('input[type="file"]').setInputFiles({ name: 'layar saya.png', mimeType: 'image/png', buffer: ONE_PIXEL_PNG })
  await expect(page.getByText('layar saya.png')).toBeVisible()
  await page.getByRole('button', { name: 'Kirim pesan' }).click()
  const reference = (await page.getByTestId('nomor-referensi').textContent())!

  const row = await ticket(subject)
  expect(row).toMatchObject({ reference, sender_email: GUARDIAN.email, account_role: 'guardian', page_from: '/keluarga', attachment_name: 'layar saya.png', attachment_mime: 'image/png' })
  expect(row!.account_id).toBeTruthy()

  if (MAILPIT) {
    const mail = await mailWith(`[Kira][Bug] ${subject}`)
    expect(mail.ReplyTo.map((a) => a.Address)).toEqual([GUARDIAN.email])
    expect(mail.Attachments.map((a) => a.FileName)).toEqual(['layar saya.png'])
    expect(mail.Text).toContain(String(row!.account_id))

    const confirm = await mailWith(`Pesan Anda ke Kira sudah kami terima (${reference})`)
    expect(confirm.To.map((a) => a.Address)).toEqual([GUARDIAN.email])
    expect(confirm.Text).toContain(reference)
    // Balasan otomatis tidak pernah mengulang teks bebas pengirim.
    expect(confirm.Text).not.toContain(subject)
    expect(confirm.Text).not.toContain('Tombol simpan')
    expect(confirm.HTML).not.toContain('Tombol simpan')
    expect(confirm.Attachments).toHaveLength(0)

    // Lampiran dihapus dari kotak keluar setelah terkirim.
    const [out] = await db()`select attachment_path, status from public_mail where subject like ${`%${reference}%`} and kind = 'support-ticket'`
    expect(out).toMatchObject({ attachment_path: null, status: 'sent' })
  }
  expect(errors).toEqual([])
})

test('akun anak melihat ajakan meminta bantuan orang tua, tanpa formulir atau unggahan', async ({ page, request, baseURL }) => {
  await registerTablet(page)
  await pinLogin(page, 'Aisha')
  await page.goto('/feedback')
  await expect(page.getByRole('heading', { level: 1, name: 'Minta bantuan orang tua' })).toBeVisible()
  await expect(page.locator('form')).toHaveCount(0)
  await expect(page.locator('input[type="file"]')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Chat lewat WhatsApp' })).toHaveCount(0)
  await expect(page.locator('a[href^="https://"]')).toHaveCount(0)

  const cookies = await page.context().cookies()
  const res = await request.post(`${baseURL}/api/feedback`, {
    headers: { cookie: cookies.map((c) => `${c.name}=${c.value}`).join('; ') },
    multipart: { category: 'bug', subject: `Dari anak ${run}`, message: 'Pesan dari akun anak tidak boleh masuk.' },
  })
  expect(res.status()).toBe(403)
  expect(await ticket(`Dari anak ${run}`)).toBeUndefined()
})
