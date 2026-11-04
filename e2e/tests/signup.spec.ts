import { randomBytes } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import { closeDb, db } from './helpers'

/**
 * Pendaftaran publik end to end dengan Mailpit (SMTP lokal). Alur yang butuh email dilewati bila MAILPIT_URL tidak
 * diisi (misalnya http://127.0.0.1:8025), karena CI belum menyediakan Mailpit. Syarat password tidak butuh email,
 * jadi selalu jalan.
 */
const MAILPIT = process.env.MAILPIT_URL
test.afterAll(closeDb)

const run = randomBytes(4).toString('hex')
const PASSWORD = 'Kalimat-panjang-mudah-diingat-2026!'
const NEW_PASSWORD = 'Password-baru-yang-panjang-2026!'

type Mail = { Text: string; Subject: string; To: { Address: string }[] }

async function mailTo(address: string, subjectPart: string): Promise<Mail> {
  for (let i = 0; i < 40; i++) {
    const list = (await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`)).json()) as { messages: { ID: string; Subject: string }[] }
    const hit = list.messages.find((m) => m.Subject.includes(subjectPart))
    if (hit) return (await (await fetch(`${MAILPIT}/api/v1/message/${hit.ID}`)).json()) as Mail
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Email "${subjectPart}" untuk ${address} tidak masuk Mailpit`)
}

const linkIn = (mail: Mail, path: string): string => {
  const m = mail.Text.match(new RegExp(`https?://[^\\s]+${path}[^\\s]*`))
  if (!m) throw new Error(`Tautan ${path} tidak ada di email`)
  return m[0]
}

async function fillSignup(page: Page, email: string) {
  await page.goto('/daftar')
  await page.getByLabel('Nama orang tua').fill('Ibu Uji Daftar')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('checkbox', { name: /Saya setuju/ }).check()
  await page.getByRole('button', { name: 'Daftar', exact: true }).click()
}

async function seatsFree(): Promise<number> {
  const [row] = await db()`select count(*)::int as n from auth.beta_seat`
  return 100 - (row!.n as number)
}

test.describe('syarat password', () => {
  const field = (page: Page) => page.getByLabel('Password', { exact: true })
  const submit = (page: Page) => page.getByRole('button', { name: 'Daftar', exact: true }).click()
  const rule = (page: Page, text: string) => page.getByRole('list', { name: 'Syarat password' }).getByRole('listitem').filter({ hasText: text })

  /** Ketikan baru terbaca setelah React aktif, jadi diulang sampai daftar centang bereaksi. */
  async function untilHydrated(page: Page) {
    await expect(async () => {
      await field(page).fill('')
      await field(page).pressSequentially('A')
      await expect(rule(page, 'huruf kapital')).toContainText('sudah terpenuhi', { timeout: 1000 })
    }).toPass()
  }

  test('daftar centang terpenuhi satu per satu sambil mengetik', async ({ page }) => {
    await page.goto('/daftar')
    const rules = {
      length: rule(page, 'Minimal 13 karakter'),
      upper: rule(page, 'huruf kapital'),
      number: rule(page, 'Ada angka'),
      symbol: rule(page, 'Ada simbol'),
    }
    const expectMet = async (...met: (keyof typeof rules)[]) => {
      for (const key of Object.keys(rules) as (keyof typeof rules)[]) await expect(rules[key]).toContainText(met.includes(key) ? 'sudah terpenuhi' : 'belum terpenuhi')
    }
    await expectMet()

    await untilHydrated(page)
    await expectMet('upper')
    await field(page).pressSequentially('1')
    await expectMet('upper', 'number')
    await field(page).pressSequentially('!')
    await expectMet('upper', 'number', 'symbol')
    // Dua belas karakter belum cukup, karakter ketiga belas memenuhi semuanya.
    await field(page).pressSequentially('abcdefghi')
    await expectMet('upper', 'number', 'symbol')
    await field(page).pressSequentially('j')
    await expectMet('length', 'upper', 'number', 'symbol')
    // Menghapus karakter membatalkan centangnya lagi.
    await field(page).press('Backspace')
    await expectMet('upper', 'number', 'symbol')
  })

  test('password lemah ditolak di browser dan juga oleh server', async ({ page }) => {
    await page.goto('/daftar')
    await untilHydrated(page)
    await page.getByLabel('Nama orang tua').fill('Ibu Uji Lemah')
    await page.getByLabel('Email', { exact: true }).fill(`kira.lemah.${run}@gmail.com`)
    await page.getByRole('checkbox', { name: /Saya setuju/ }).check()
    const toServer: string[] = []
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.headers()['next-action']) toServer.push(r.url())
    })

    // Di browser: pesan muncul tanpa permintaan ke server.
    await field(page).fill('Pendek-1!')
    await submit(page)
    await expect(page.getByText('Password paling sedikit 13 karakter.').first()).toBeVisible()
    expect(toServer).toEqual([])

    // Pemeriksaan browser dilewati: formulir lolos dengan password kuat, lalu permintaannya diubah menjadi lemah.
    for (const [weak, message] of [
      ['Pendek-1!', 'Password paling sedikit 13 karakter.'],
      ['tanpa-kapital-panjang-2026!', 'Tambahkan paling sedikit satu huruf kapital.'],
    ] as const) {
      await page.route('**/daftar', async (route) => {
        const req = route.request()
        if (req.method() !== 'POST' || !req.headers()['next-action']) return route.continue()
        const body = req.postData() ?? ''
        expect(body).toContain(PASSWORD)
        return route.continue({ postData: body.replace(PASSWORD, weak) })
      })
      await field(page).fill(PASSWORD)
      await expect(page.getByText(message)).toHaveCount(0)
      await submit(page)
      await expect(page.getByText(message).first()).toBeVisible()
      await page.unroute('**/daftar')
    }
    expect(toServer).toHaveLength(2)
    await expect(page.getByRole('heading', { name: 'Cek email Anda' })).toHaveCount(0)
    const rows = await db()`select 1 from auth.signup where email_norm = ${`kiralemah${run}@gmail.com`}`
    expect(rows).toHaveLength(0)
  })
})

test.describe('pendaftaran orang tua', () => {
  test.skip(!MAILPIT, 'MAILPIT_URL belum diisi')
  test.describe.configure({ mode: 'serial' })
  const email = `kira.uji.${run}@gmail.com`

  test.afterAll(async () => {
    const orgs = await db()`select org_id from auth.beta_seat where email_norm like ${`%${run}%`}`
    for (const o of orgs) {
      await db()`delete from auth.user_account where org_id = ${o.org_id}`
      await db()`delete from org where id = ${o.org_id}`
    }
    await db()`delete from auth.beta_seat where email_norm like ${`%${run}%`}`
    await db()`delete from auth.signup where email_norm like ${`%${run}%`}`
    await db()`delete from auth.waitlist where email_norm like ${`%${run}%`}`
  })

  test('halaman depan publik tampil di / untuk pengunjung baru', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('trusted')
    await expect(page.getByText(/Tersisa \d+ dari \d+ kursi/).first()).toBeVisible()
    for (const href of ['/panduan', '/panduan/anak', '/privasi', '/ketentuan']) await expect(page.locator(`a[href="${href}"]`).first()).toBeVisible()
    // Hanya kalimat yang diizinkan: tanpa klaim resmi, bersertifikat, atau didukung.
    await expect(page.getByText(/Cambridge/).first()).toHaveText(/mengacu pada kerangka Cambridge Primary/)
    await expect(page.getByText(/resmi|bersertifikat|didukung|official|certified|endorsed/i)).toHaveCount(0)
  })

  test('email sekali pakai ditolak dengan pesan ramah', async ({ page }) => {
    await page.goto('/daftar')
    await page.getByLabel('Nama orang tua').fill('Ibu Uji')
    await page.getByLabel('Email', { exact: true }).fill(`uji${run}@tmailor.com`)
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
    await page.getByRole('checkbox', { name: /Saya setuju/ }).check()
    await page.getByRole('button', { name: 'Daftar', exact: true }).click()
    await expect(page.getByText(/Alamat email sementara belum bisa dipakai/)).toBeVisible()
  })

  test('daftar, konfirmasi email, tambah anak, dan buka Kira untuk anak', async ({ page, context }) => {
    const before = await seatsFree()
    await fillSignup(page, email)
    await expect(page.getByRole('heading', { name: 'Cek email Anda' })).toBeVisible()

    // Belum dikonfirmasi: tidak bisa masuk, dengan pesan ramah dan tombol kirim ulang.
    const other = await context.newPage()
    await other.goto('/masuk')
    await other.getByLabel('Email', { exact: true }).first().fill(email)
    await other.getByLabel('Password', { exact: true }).fill(PASSWORD)
    await other.getByRole('button', { name: 'Masuk', exact: true }).click()
    await expect(other.getByText(/belum dikonfirmasi/)).toBeVisible()
    await other.close()

    const mail = await mailTo(email, 'Konfirmasi email')
    const link = linkIn(mail, '/daftar/konfirmasi/')
    // Pemindai email tanpa JavaScript tidak memakai token atau kursi.
    expect((await page.request.get(link)).status()).toBe(200)
    expect(await seatsFree()).toBe(before)
    // Browser sungguhan: tanpa langkah password, akun aktif dan langsung masuk ke langkah tambah anak.
    await page.goto(link)
    await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0)
    await expect(page).toHaveURL(/\/mulai/, { timeout: 45_000 })
    expect(await seatsFree()).toBe(before - 1)

    // Tautan sekali pakai.
    await page.context().clearCookies()
    await page.goto(link)
    await expect(page.getByRole('heading', { name: 'Tautan ini sudah tidak berlaku' })).toBeVisible()
    await page.goto('/masuk')
    await page.getByLabel('Email', { exact: true }).first().fill(email)
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
    await page.getByRole('button', { name: 'Masuk', exact: true }).click()
    await expect(page).toHaveURL(/\/keluarga|\/mulai/)
    await page.goto('/mulai')

    await page.getByLabel('Nama panggilan').fill('Nara')
    for (const p of ['Matahari', 'Bulan', 'Bintang', 'Kucing']) await page.getByRole('button', { name: p, exact: true }).click()
    // Tidak ada persetujuan yang tercentang dari awal.
    await page.getByText('Izin tambahan, boleh nanti').click()
    const boxes = page.getByRole('form', { name: 'Tambah anak' }).getByRole('checkbox')
    for (let i = 0; i < (await boxes.count()); i++) await expect(boxes.nth(i)).not.toBeChecked()
    await page.getByRole('checkbox', { name: /Belajar di Kira/ }).check()
    await page.getByRole('button', { name: 'Tambahkan anak' }).click()
    await expect(page.getByText('Nara', { exact: true }).first()).toBeVisible()
    await page.getByRole('link', { name: 'Lanjut pilih jalur' }).click()
    await page.getByRole('button', { name: 'Pakai jalur rekomendasi' }).click()
    await page.getByRole('button', { name: 'Mulai belajar sebagai anak' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByText('Nara').first()).toBeVisible()
  })

  test('lupa password mengirim tautan dan jawabannya sama untuk email yang tidak dikenal', async ({ page }) => {
    await page.goto('/masuk')
    await page.getByRole('button', { name: 'Lupa password?' }).click()
    await page.getByLabel('Email', { exact: true }).fill(email)
    await page.getByRole('button', { name: 'Kirim link' }).click()
    const known = await page.getByText(/Bila ada akun Kira/).textContent()
    const mail = await mailTo(email, 'Atur ulang password')
    await page.goto(linkIn(mail, '/reset/'))
    await page.getByLabel(/Password baru|Password/).first().fill(NEW_PASSWORD)
    await page.getByRole('button', { name: /Simpan|Atur ulang/ }).first().click()
    await expect(page).toHaveURL(/\/masuk\?notice=reset-done/)

    await page.getByRole('button', { name: 'Lupa password?' }).click()
    await page.getByLabel('Email', { exact: true }).fill(`tidak.ada.${run}@gmail.com`)
    await page.getByRole('button', { name: 'Kirim link' }).click()
    expect(await page.getByText(/Bila ada akun Kira/).textContent()).toBe(known?.replace(email, `tidak.ada.${run}@gmail.com`) ?? known)
  })

  test('kursi penuh: pendaftaran berganti ke daftar tunggu dan berhenti berlangganan bekerja', async ({ page }) => {
    const wl = `kira.tunggu.${run}@gmail.com`
    const [seat] = await db()`select count(*)::int as n from auth.beta_seat`
    const need = 100 - (seat!.n as number)
    const fake: string[] = []
    for (let i = 0; i < need; i++) {
      const id = crypto.randomUUID()
      fake.push(id)
      await db()`insert into auth.beta_seat (org_id, user_id, email_norm) values (${id}, ${id}, ${`penuh${i}.${run}@x.test`})`
    }
    try {
      await page.goto('/')
      await expect(page.getByText('Kursi beta sudah penuh.').first()).toBeVisible()
      await page.goto('/daftar')
      await expect(page.getByRole('heading', { name: 'Kursi beta sudah penuh' })).toBeVisible()
      const consent = page.getByRole('checkbox', { name: /Kabari saya/ })
      await expect(consent).not.toBeChecked()
      await page.getByLabel('Email', { exact: true }).fill(wl)
      await page.getByRole('button', { name: 'Masuk daftar tunggu' }).click()
      await expect(page.getByText('Centang persetujuan supaya kami boleh mengirim kabar.')).toBeVisible()
      await consent.check()
      await page.getByRole('button', { name: 'Masuk daftar tunggu' }).click()
      await expect(page.getByText(`Cek email ${wl}.`)).toBeVisible()

      const confirmMail = await mailTo(wl, 'Konfirmasi daftar tunggu')
      await page.goto(linkIn(confirmMail, '/kabar/konfirmasi/'))
      await page.getByRole('button', { name: 'Ya, kabari saya' }).click()
      await expect(page.getByRole('heading', { name: 'Anda masuk daftar tunggu' })).toBeVisible()
      const welcome = await mailTo(wl, 'Anda ada di daftar tunggu')
      await page.goto(linkIn(welcome, '/kabar/berhenti/'))
      await expect(page.getByRole('heading', { name: 'Anda sudah berhenti berlangganan' })).toBeVisible()
      const [row] = await db()`select unsubscribed_at from auth.waitlist where email = ${wl}`
      expect(row!.unsubscribed_at).not.toBeNull()
    } finally {
      for (const id of fake) await db()`delete from auth.beta_seat where org_id = ${id}`
    }
  })
})
