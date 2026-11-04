import { randomUUID } from 'node:crypto'
import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { closeDb, createPracticeAttempt, db, expectNoSeriousA11y, GUARDIAN, loginAdult, mcqItems, registerTablet, pinLogin, watchErrors } from './helpers'
import { BASE, learnerSession, SESSION_COOKIE, sessionFor, type Who } from './security-helpers'

/**
 * Pintu depan Kira: Daftar dan Masuk di satu halaman, footer di semua kerangka, onboarding dua jalur,
 * daftar langkah orang tua, dan tips pertama anak. Keluarga pemilik dibuat langsung di database, jadi tes ini tidak butuh Mailpit.
 */
test.afterAll(closeDb)

const CREDIT = 'Build by Gatxel @ 2026 Made with Love by GATteam'
const WA = 'https://wa.me/6287794551486?text=Halo%20Tim%20Gatxel%2C%20saya%20tertarik%20berdiskusi%20kemitraan%20bersama%20Kira'
const PIN = ['Matahari', 'Bulan', 'Bintang', 'Kucing']

type Family = { orgId: string; parent: Who; parentId: string; childIds: string[] }

async function asUser(context: BrowserContext, who: Who): Promise<void> {
  const url = new URL(BASE)
  await context.addCookies([{ name: SESSION_COOKIE, value: who.token, domain: url.hostname, path: '/', httpOnly: true, secure: true, sameSite: 'Lax' }])
}

/** Keluarga yang mendaftar sendiri (punya kursi beta), dengan anak yang belum memilih jalur. */
async function ownerFamily(children: { name: string; grade: number }[] = []): Promise<Family> {
  const orgId = randomUUID()
  const parentId = randomUUID()
  const email = `pemilik-${parentId.slice(0, 8)}@contoh.test`
  const sql = db()
  await sql`insert into org (id, name) values (${orgId}, ${'Keluarga Gerbang __GERBANG_E2E__'})`
  await sql`insert into auth.user_account (id, org_id, kind, role, email, name) values (${parentId}, ${orgId}, 'adult', 'guardian', ${email}, 'Ibu Gerbang')`
  await sql`insert into member_profile (user_id, org_id, name, role, email) values (${parentId}, ${orgId}, 'Ibu Gerbang', 'guardian', ${email})`
  await sql`insert into auth.beta_seat (org_id, user_id, email_norm) values (${orgId}, ${parentId}, ${email})`
  const childIds: string[] = []
  for (const c of children) {
    const id = randomUUID()
    childIds.push(id)
    await sql`insert into auth.user_account (id, org_id, kind, role, email, name) values (${id}, ${orgId}, 'learner', 'learner', null, ${c.name})`
    await sql`insert into learner_profile (user_id, org_id, name, avatar, grade, active) values (${id}, ${orgId}, ${c.name}, 'fox', ${c.grade}, true)`
    await sql`insert into guardian_link (org_id, guardian_id, learner_id) values (${orgId}, ${parentId}, ${id})`
  }
  return { orgId, parentId, childIds, parent: await sessionFor(parentId, orgId, 'adult') }
}

async function dropFamily(f: Family): Promise<void> {
  const sql = db()
  await sql`delete from auth.session where org_id = ${f.orgId}`
  await sql`delete from auth.device where org_id = ${f.orgId}`
  await sql`delete from auth.beta_seat where org_id = ${f.orgId}`
  await sql`delete from auth.user_account where org_id = ${f.orgId}`
  await sql`delete from org where id = ${f.orgId}`
}

async function pathOf(learnerId: string): Promise<string | null> {
  const [r] = await db()`select setup_path from learner_profile where user_id = ${learnerId}`
  return (r?.setup_path as string | null) ?? null
}

async function expectFooter(page: Page, opts: { partner: boolean }) {
  const footer = page.getByTestId('site-footer')
  await expect(footer).toBeVisible()
  await expect(footer.getByTestId('site-credit')).toHaveText(CREDIT)
  for (const [label, href] of [['Panduan', '/panduan'], ['Bantuan', '/feedback'], ['Privasi', '/privasi'], ['Syarat', '/ketentuan']] as const) {
    await expect(footer.getByRole('link', { name: label, exact: true })).toHaveAttribute('href', href)
  }
  const partner = footer.getByRole('link', { name: 'Partner with Gatxel' })
  if (opts.partner) {
    await expect(partner).toHaveAttribute('href', WA)
    await expect(partner).toHaveAttribute('target', '_blank')
    await expect(partner).toHaveAttribute('rel', /noopener/)
  } else {
    await expect(partner).toHaveCount(0)
    await expect(page.locator('a[href*="wa.me"]')).toHaveCount(0)
  }
}

test('Daftar dan Masuk di satu halaman: tanpa pindah halaman, alamat ikut berubah, kembali dan muat ulang benar', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('trusted')
  await expect(page.getByText(/mengacu pada kerangka Cambridge Primary/i).first()).toBeVisible()
  await expect(page.getByText(/Tersisa \d+ dari \d+ kursi/).first()).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Daftar', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByLabel('Nama orang tua')).toBeVisible()

  // Penanda di window hilang kalau halaman dimuat ulang.
  await page.evaluate(() => ((window as unknown as { __kira: number }).__kira = 1))
  await page.getByRole('tab', { name: 'Masuk', exact: true }).click()
  await expect(page).toHaveURL(/\/masuk$/)
  await expect(page.getByRole('tab', { name: 'Masuk', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('autocomplete', 'current-password')
  await expect(page.getByLabel('Nama orang tua')).toHaveCount(0)

  // Keyboard: panah kiri kembali ke Daftar.
  await page.getByRole('tab', { name: 'Masuk', exact: true }).focus()
  await page.keyboard.press('ArrowLeft')
  await expect(page).toHaveURL(/\/daftar$/)
  await expect(page.getByLabel('Nama orang tua')).toBeVisible()

  // Email yang sudah diketik ikut pindah.
  await page.getByLabel('Email', { exact: true }).fill('ibu@contoh.test')
  await page.getByRole('tab', { name: 'Masuk', exact: true }).click()
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('ibu@contoh.test')

  await page.goBack()
  await expect(page).toHaveURL(/\/daftar$/)
  await expect(page.getByLabel('Nama orang tua')).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { __kira?: number }).__kira)).toBe(1)

  await page.goto('/masuk')
  await expect(page.getByRole('tab', { name: 'Masuk', exact: true })).toHaveAttribute('aria-selected', 'true')
  await page.goto('/daftar')
  await expect(page.getByRole('tab', { name: 'Daftar', exact: true })).toHaveAttribute('aria-selected', 'true')
  expect(errors).toEqual([])
})

test('di HP: gradien jadi hero ringkas dan form terjangkau di layar pertama', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto('/')
  const tab = await page.getByRole('tab', { name: 'Daftar', exact: true }).boundingBox()
  const field = await page.getByLabel('Nama orang tua').boundingBox()
  expect(tab!.y + tab!.height).toBeLessThan(667)
  expect(field!.y).toBeLessThan(667)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
})

test('footer dengan teks persis ada di halaman depan, orang tua, anak, panduan, dan hukum; runner tanpa footer', async ({ page, context }) => {
  for (const path of ['/', '/masuk', '/daftar', '/panduan', '/panduan/anak', '/privasi', '/ketentuan']) {
    await page.goto(path)
    await expectFooter(page, { partner: true })
  }
  await page.goto('/privasi')
  await expect(page.getByTestId('site-footer')).toContainText('Pengelola:')
  await expect(page.getByTestId('site-header').getByRole('link', { name: /Kira/ })).toHaveAttribute('href', '/')

  await loginAdult(page, GUARDIAN, '/keluarga')
  await expectFooter(page, { partner: true })
  await page.getByRole('button', { name: /Menu akun/ }).click()
  await expect(page.getByRole('button', { name: 'Keluar' })).toBeVisible()
  await page.keyboard.press('Escape')
  await context.clearCookies()

  await registerTablet(page, ['Aisha'])
  await pinLogin(page, 'Aisha')
  await expectFooter(page, { partner: false })

  const items = mcqItems('e2.', 2)
  const attempt = await createPracticeAttempt('Aisha', items)
  await page.goto(`/run/${attempt}`)
  await expect(page.getByTestId('site-footer')).toHaveCount(0)
})

test('jalur rekomendasi sekali ketuk: tambah anak, satu ketukan, cara anak masuk, muat ulang tetap benar', async ({ page, context }) => {
  const errors = watchErrors(page)
  const f = await ownerFamily()
  await asUser(context, f.parent)
  try {
    await page.goto('/keluarga')
    await expect(page).toHaveURL(/\/mulai/)
    await expect(page.getByText('Tambah anak').first()).toBeVisible()
    await expectNoSeriousA11y(page, '/mulai langkah 1')

    await page.getByLabel('Nama panggilan').fill('Nara')
    await page.getByRole('radio', { name: '5', exact: true }).click()
    for (const p of PIN) await page.getByRole('button', { name: p, exact: true }).click()
    // Tidak ada izin yang tercentang dari awal, dan izin belajar wajib.
    const consent = page.getByRole('checkbox', { name: /Belajar di Kira/ })
    await expect(consent).not.toBeChecked()
    await page.getByRole('button', { name: 'Tambahkan anak' }).click()
    await expect(page.getByText('Centang izin Belajar di Kira')).toBeVisible()
    await consent.check()
    await page.getByRole('button', { name: 'Tambahkan anak' }).click()
    await expect(page.getByText('Kelas 5')).toBeVisible()

    await page.getByRole('link', { name: 'Lanjut pilih jalur' }).click()
    await expect(page).toHaveURL(/langkah=2/)
    await expect(page.getByText('Disarankan')).toBeVisible()
    await expect(page.getByText('Bisa diubah kapan saja di dashboard orang tua.').first()).toBeVisible()
    await expect(page.getByText(/Nara belajar Math, English, dan Science setiap hari/)).toBeVisible()
    await expectNoSeriousA11y(page, '/mulai langkah 2')

    // Muat ulang tanpa langkah: melanjutkan di pilih jalur.
    await page.goto('/mulai')
    await expect(page.getByRole('heading', { name: 'Pilih jalur belajar' })).toBeVisible()
    // Langkah 3 belum terbuka: dikembalikan ke langkah 2.
    await page.goto('/mulai?langkah=3')
    await expect(page.getByRole('heading', { name: 'Pilih jalur belajar' })).toBeVisible()

    await page.getByRole('button', { name: 'Pakai jalur rekomendasi' }).click()
    await expect(page).toHaveURL(/langkah=3/)
    await expect(page.getByRole('heading', { name: 'Cara anak masuk' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mulai belajar sebagai anak' })).toBeEnabled()
    await expect(page.getByRole('link', { name: 'Buka dashboard' })).toHaveAttribute('href', '/keluarga')
    await expect(page.locator('a[href="/panduan/aplikasi"]')).toBeVisible()
    await expectNoSeriousA11y(page, '/mulai langkah 3')

    const [kid] = await db()`select user_id, setup_path from learner_profile where org_id = ${f.orgId}`
    expect(kid!.setup_path).toBe('recommended')
    // Kelas 5: Paper menyala, olimpiade mati sampai dipilih orang tua.
    const off = (await db()`select key from learner_feature where learner_id = ${kid!.user_id as string} and enabled = false`).map((r) => r.key as string)
    expect(off).toContain('olympiad-math')
    expect(off).not.toContain('paper')

    await page.goto('/mulai')
    await expect(page.getByRole('heading', { name: 'Cara anak masuk' })).toBeVisible()
    // Mundur tetap boleh.
    await page.getByRole('link', { name: /Pilih jalur/ }).click()
    await expect(page.getByRole('heading', { name: 'Pilih jalur belajar' })).toBeVisible()

    await page.goto('/mulai?langkah=3')
    await page.getByRole('button', { name: 'Mulai belajar sebagai anak' }).click()
    await expect(page).toHaveURL(new RegExp(`${BASE}/?$`))
    await expect(page.getByText('Nara').first()).toBeVisible()
    expect(errors).toEqual([])
  } finally {
    await dropFamily(f)
  }
})

test('atur sendiri: saklar per anak dengan penjelasan, tersimpan, lalu lanjut', async ({ page, context }) => {
  const f = await ownerFamily([{ name: 'Bima', grade: 3 }])
  await asUser(context, f.parent)
  try {
    await page.goto('/mulai')
    await page.getByRole('link', { name: 'Atur sendiri untuk Bima' }).click()
    await expect(page).toHaveURL(/anak=/)
    await expect(page.getByRole('heading', { name: 'Atur sendiri untuk Bima' })).toBeVisible()
    await expect(page.getByText('Kuis pengetahuan umum per topik.')).toBeVisible()
    await expectNoSeriousA11y(page, '/mulai atur sendiri')
    const quiz = page.getByRole('checkbox', { name: 'Quiz Arena' })
    await expect(quiz).toBeChecked()
    await quiz.uncheck()
    await page.getByRole('button', { name: 'Simpan dan lanjut' }).click()
    await expect(page).toHaveURL(/langkah=3/)
    expect(await pathOf(f.childIds[0]!)).toBe('custom')
    const off = (await db()`select key from learner_feature where learner_id = ${f.childIds[0]!} and enabled = false`).map((r) => r.key as string)
    expect(off).toContain('quiz-arena')
  } finally {
    await dropFamily(f)
  }
})

test('lewati dulu memakai rekomendasi, tidak buntu, dan daftar langkah hilang setelah selesai', async ({ page, context }) => {
  const f = await ownerFamily([{ name: 'Citra', grade: 1 }])
  await asUser(context, f.parent)
  try {
    // Beranda tidak memaksa, tapi menunjukkan langkah berikutnya.
    await page.goto('/keluarga')
    const list = page.getByTestId('first-run-checklist')
    await expect(list).toBeVisible()
    for (const label of ['Tambah anak', 'Pilih jalur', 'Anak menyelesaikan sesi pertama', 'Lihat laporan pertama']) await expect(list.getByText(label)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Pengaturan Citra' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Mapel dan fitur' })).toBeVisible()
    await expectNoSeriousA11y(page, '/keluarga daftar langkah')

    await list.getByRole('link', { name: /Pilih jalur/ }).click()
    await page.getByRole('button', { name: 'Lewati dulu' }).click()
    await expect(page).toHaveURL(/langkah=3/)
    expect(await pathOf(f.childIds[0]!)).toBe('skipped')
    // Kelas 1: isinya sama dengan rekomendasi.
    const off = (await db()`select key from learner_feature where learner_id = ${f.childIds[0]!} and enabled = false`).map((r) => r.key as string)
    expect(off).toContain('paper')
    expect(off).toContain('quiz-arena')

    // Halaman anak: tautan Pengaturan membuka bagian saklar.
    await page.goto('/keluarga')
    await page.getByRole('link', { name: 'Mapel dan fitur' }).click()
    await expect(page.getByRole('heading', { name: 'Fitur yang dipakai' })).toBeVisible()

    await page.goto('/keluarga/minggu')
    await db()`insert into quest (org_id, learner_id, date, subject, session, kind, status, seq) values (${f.orgId}, ${f.childIds[0]!}, ${new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)}, 'math', 'latihan', 'daily', 'done', 0)`
    await page.goto('/keluarga')
    await expect(page.getByRole('heading', { name: /Halo/ })).toBeVisible()
    await expect(page.getByTestId('first-run-checklist')).toHaveCount(0)
  } finally {
    await dropFamily(f)
  }
})

test('tips pertama anak: bisa dilewati, tidak menahan anak, dan hanya muncul sekali', async ({ page, context }) => {
  const f = await ownerFamily([{ name: 'Dewi', grade: 2 }])
  const child = f.childIds[0]!
  await db()`insert into consent_event (org_id, learner_id, guardian_id, recorded_by, purpose, granted, notice_version, method) values (${f.orgId}, ${child}, ${f.parentId}, ${f.parentId}, 'learning', true, '2026-10-12', 'in-app')`
  const who = await learnerSession(child, f.orgId, f.parentId)
  await asUser(context, who)
  try {
    await page.goto('/today')
    const tips = page.getByTestId('first-run-tips')
    await expect(tips).toBeVisible()
    await expect(tips.getByText('Tip 1 of 3')).toBeVisible()
    await expectNoSeriousA11y(page, '/today tips')
    await tips.getByRole('button', { name: 'Next' }).click()
    await expect(tips.getByText('Tip 2 of 3')).toBeVisible()
    await tips.getByRole('button', { name: 'Skip tips' }).click()
    await expect(tips).toHaveCount(0)
    await expect.poll(async () => (await db()`select first_run_done_at from learner_profile where user_id = ${child}`)[0]!.first_run_done_at).not.toBeNull()
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    await expect(page.getByTestId('first-run-tips')).toHaveCount(0)
  } finally {
    await dropFamily(f)
  }
})

test('kursi penuh: daftar tunggu tetap ramah, dan orang tua tetap bisa masuk dari layar yang sama', async ({ page }) => {
  const run = randomUUID().slice(0, 8)
  const [seat] = await db()`select count(*)::int as n from auth.beta_seat`
  for (let i = 0; i < 100 - (seat!.n as number); i++) {
    const id = randomUUID()
    await db()`insert into auth.beta_seat (org_id, user_id, email_norm) values (${id}, ${id}, ${`penuh${i}.${run}@x.test`})`
  }
  try {
    await page.goto('/')
    await expect(page.getByText('Kursi beta sudah penuh.').first()).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Daftar tunggu', exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('heading', { name: 'Kursi beta sudah penuh' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Kenapa layak ditunggu' })).toBeVisible()
    await expect(page.getByRole('checkbox', { name: /Kabari saya/ })).not.toBeChecked()
    await expect(page.getByRole('button', { name: 'Masuk daftar tunggu' })).toBeVisible()
    await expectNoSeriousA11y(page, '/ kursi penuh')
    await page.getByRole('tab', { name: 'Masuk', exact: true }).click()
    await expect(page).toHaveURL(/\/masuk$/)
    await loginAdult(page, GUARDIAN)
    await expect(page).toHaveURL(/\/keluarga/)
  } finally {
    await db()`delete from auth.beta_seat where email_norm like ${`%${run}%`}`
  }
})
