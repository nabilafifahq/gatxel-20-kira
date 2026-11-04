import { devices, expect, test, type Page } from '@playwright/test'
import { db, expectNoSeriousA11y, GUARDIAN, learnerId, LEARNERS, loginAdult, noHorizontalScroll, seedOrgId, TUTOR, waitForPath, watchErrors } from './helpers'

/**
 * Anak masuk langsung di browser dengan kode keluarga, di ukuran iPhone dan konteks browser baru.
 * E2E_WEBKIT=1 menjalankan berkas ini di WebKit lewat HTTPS (cookie __Host- butuh origin aman).
 */
const { defaultBrowserType: _ignored, ...iphone } = devices['iPhone 13']
test.use({ ...iphone, viewport: { width: 375, height: 812 } })
test.describe.configure({ mode: 'serial' })

const AISHA_PIN = ['Matahari', 'Bulan', 'Bintang', 'Kucing']
const WRONG_PIN = ['Pohon', 'Apel', 'Perahu', 'Bola']

const codeOf = async (org: string) => (await db()`select code from family_code where org_id = ${org}`)[0]!.code as string

async function tapPin(page: Page, pin: string[]) {
  // Tunggu React terpasang: WebKit di mesin uji lebih lambat dari jari, dan ketukan sebelum itu tidak terhitung.
  const first = page.getByRole('button', { name: pin[0]!, exact: true })
  await expect.poll(() => first.evaluate((el) => Object.keys(el).some((k) => k.startsWith('__reactProps')))).toBe(true)
  for (const p of pin) await page.getByRole('button', { name: p, exact: true }).click()
}

async function typeCode(page: Page, code: string) {
  await page.getByLabel('Kode keluarga').fill(code)
  await page.getByRole('button', { name: 'Lanjut' }).click()
}

async function reset(org: string) {
  await db()`delete from auth.device where org_id = ${org} and name like 'Perangkat %'`
  await db()`update auth.learner_secret set failed_pins = 0, locked_until = null where user_id in (select user_id from learner_profile where org_id = ${org})`
}

test('anak baru masuk di browser baru: kode, nama, PIN, lalu berikutnya langsung nama dan PIN', async ({ browser }) => {
  test.setTimeout(240_000)
  const org = await seedOrgId()
  await reset(org)
  const aisha = await learnerId('Aisha')
  const context = await browser.newContext({ ...iphone, viewport: { width: 375, height: 812 }, ignoreHTTPSErrors: true })
  const page = await context.newPage()
  const errors = watchErrors(page)

  await page.goto('/masuk')
  await page.getByRole('link', { name: /Masuk sebagai anak/ }).click()
  await waitForPath(page, (p) => p === '/masuk/anak')
  await expect(page.getByRole('heading', { name: 'Masuk dengan kode keluarga' })).toBeVisible()
  await expectNoSeriousA11y(page, '/masuk/anak')
  await noHorizontalScroll(page)

  // Kode salah: pesan ramah, tidak ada nama.
  await typeCode(page, 'BBBB-BBBB')
  await expect(page.getByText('Kodenya belum cocok.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Aisha' })).toHaveCount(0)

  // Kode benar dengan huruf kecil: hanya nama depan, tanpa kelas.
  await typeCode(page, (await codeOf(org)).toLowerCase())
  await expect(page.getByRole('heading', { name: 'Siapa yang belajar hari ini?' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Aisha', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Raka', exact: true })).toBeVisible()
  await expect(page.getByText(/Kelas \d/)).toHaveCount(0)
  await expectNoSeriousA11y(page, 'pilih nama')
  await noHorizontalScroll(page)
  expect((await context.cookies()).some((c) => c.name === '__Host-kira.device')).toBe(false)

  // PIN salah tidak memberi apa pun.
  await page.getByRole('link', { name: 'Aisha', exact: true }).click()
  await waitForPath(page, (p) => p === `/masuk/anak/${aisha}`)
  await noHorizontalScroll(page)
  await tapPin(page, WRONG_PIN)
  await expect(page.getByText('Gambarnya belum cocok.')).toBeVisible()
  expect((await context.cookies()).some((c) => c.name === '__Host-kira.device')).toBe(false)

  await tapPin(page, AISHA_PIN)
  await waitForPath(page, (p) => p === '/today')
  await page.locator('#today-quests').waitFor({ state: 'attached', timeout: 30_000 })

  // Perangkat terdaftar lewat mekanisme yang sama.
  const rows = await db()`select name, learner_ids, registered_by, revoked_at, expires_at from auth.device where org_id = ${org} and name = 'Perangkat Aisha'`
  expect(rows).toHaveLength(1)
  expect(rows[0]!.learner_ids).toEqual([aisha])
  const audit = await db()`select action from audit_log where org_id = ${org} and action in ('family_code.used', 'device.registered', 'login.family_code')`
  expect(new Set(audit.map((a) => a.action))).toEqual(new Set(['family_code.used', 'device.registered', 'login.family_code']))

  // Sesi anak tidak bisa membuka halaman orang tua atau konsol.
  for (const path of ['/keluarga', '/konsol/pengaturan', '/mulai']) {
    await page.goto(path)
    expect(new URL(page.url()).pathname.startsWith(path)).toBe(false)
  }

  // Kunjungan berikutnya: langsung nama dan PIN, tanpa kode.
  await context.clearCookies({ name: '__Host-kira.session' })
  await page.goto('/masuk/anak')
  await waitForPath(page, (p) => p === '/')
  await page.getByRole('link', { name: /^Aisha, / }).click()
  await waitForPath(page, (p) => p.startsWith('/pin/'))
  // Bahasa layar kini mengikuti anak di perangkat ini (data contoh: Inggris).
  await tapPin(page, [...LEARNERS.Aisha.pin])
  await waitForPath(page, (p) => p === '/today')

  // Saudara di browser yang sama: lewat kode lagi, masuk ke perangkat yang sama.
  await context.clearCookies({ name: '__Host-kira.session' })
  await page.goto('/')
  await page.getByRole('link', { name: 'Name not here? Use the family code' }).click()
  await waitForPath(page, (p) => p === '/masuk/anak')
  await page.getByLabel('Family code').fill(await codeOf(org))
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('link', { name: 'Raka', exact: true }).click()
  await waitForPath(page, (p) => p.startsWith('/masuk/anak/'))
  await tapPin(page, [...LEARNERS.Raka.pin])
  await waitForPath(page, (p) => p === '/today')
  const shared = await db()`select learner_ids from auth.device where org_id = ${org} and name = 'Perangkat Aisha' and revoked_at is null`
  expect(shared).toHaveLength(1)
  expect(new Set(shared[0]!.learner_ids as string[])).toEqual(new Set([aisha, await learnerId('Raka')]))
  expect(errors.filter((e) => !e.includes('401'))).toEqual([])
  await context.close()
})

test('saklar fitur dan batas layar berlaku untuk sesi dari kode keluarga', async ({ browser }) => {
  test.setTimeout(180_000)
  const org = await seedOrgId()
  await reset(org)
  const id = await learnerId('Aisha')
  for (const key of ['math', 'mental-math']) {
    await db()`insert into learner_feature (learner_id, org_id, key, enabled) values (${id}, ${org}, ${key}, false) on conflict (learner_id, key) do update set enabled = false`
  }
  const before = (await db()`select screen_limit_min from learner_profile where user_id = ${id}`)[0]!.screen_limit_min as number
  await db()`update learner_profile set screen_limit_min = 45 where user_id = ${id}`
  const context = await browser.newContext({ ...iphone, viewport: { width: 375, height: 812 }, ignoreHTTPSErrors: true })
  try {
    const page = await context.newPage()
    await page.goto('/masuk/anak')
    await typeCode(page, await codeOf(org))
    await page.getByRole('link', { name: 'Aisha', exact: true }).click()
    await waitForPath(page, (p) => p.startsWith('/masuk/anak/'))
    await tapPin(page, AISHA_PIN)
    await waitForPath(page, (p) => p === '/today')
    await page.goto('/quick-maths')
    await waitForPath(page, (p) => p === '/practice')
    // Batas layar dibaca per anak dari sesi, sama seperti perangkat yang didaftarkan orang tua.
    const beat = await page.evaluate(() => fetch('/api/heartbeat', { method: 'POST' }).then((r) => r.json() as Promise<{ limit: number }>))
    expect(beat.limit).toBe(45)
  } finally {
    await db()`delete from learner_feature where learner_id = ${id}`
    await db()`update learner_profile set screen_limit_min = ${before} where user_id = ${id}`
    await context.close()
  }
})

test('orang tua melihat kode dan perangkat; ganti kode tidak mengeluarkan perangkat; cabut mengakhiri sesi anak', async ({ browser, page }) => {
  test.setTimeout(240_000)
  const org = await seedOrgId()
  await reset(org)
  const before = await codeOf(org)

  // Anak masuk di browser sendiri.
  const childContext = await browser.newContext({ ...iphone, viewport: { width: 375, height: 812 }, ignoreHTTPSErrors: true })
  const child = await childContext.newPage()
  await child.goto('/masuk/anak')
  await typeCode(child, before)
  await child.getByRole('link', { name: 'Aisha', exact: true }).click()
  await waitForPath(child, (p) => p.startsWith('/masuk/anak/'))
  await tapPin(child, AISHA_PIN)
  await waitForPath(child, (p) => p === '/today')

  await loginAdult(page, GUARDIAN, '/keluarga')
  await page.goto('/keluarga')
  await expect(page.getByTestId('family-code')).toHaveText(`${before.slice(0, 4)}-${before.slice(4)}`)
  const device = page.getByTestId('family-device').filter({ hasText: 'Perangkat Aisha' })
  await expect(device).toBeVisible()
  await noHorizontalScroll(page)

  // Ganti kode.
  await page.getByRole('button', { name: 'Ganti kode' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Ganti kode' }).click()
  await expect(page.getByText('Kode baru sudah aktif.')).toBeVisible()
  const after = await codeOf(org)
  expect(after).not.toBe(before)
  await expect(page.getByTestId('family-code')).toHaveText(`${after.slice(0, 4)}-${after.slice(4)}`)

  // Kode lama gugur, perangkat anak tetap berjalan.
  const other = await browser.newContext({ ...iphone, viewport: { width: 375, height: 812 }, ignoreHTTPSErrors: true })
  const stranger = await other.newPage()
  await stranger.goto('/masuk/anak')
  await typeCode(stranger, before)
  await expect(stranger.getByText('Kodenya belum cocok.')).toBeVisible()
  await other.close()
  await child.goto('/today')
  await waitForPath(child, (p) => p === '/today')

  // Cabut: sesi anak berakhir dan kembali butuh kode.
  await device.getByRole('button', { name: /Cabut/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cabut perangkat' }).click()
  await expect(device).toHaveCount(0)
  await child.goto('/today')
  await waitForPath(child, (p) => p !== '/today')
  await childContext.close()
})

test('keluarga tanpa anak mendapat pesan ramah; tutor melihat kode keluarga bertutor', async ({ browser, page }) => {
  test.setTimeout(120_000)
  const org = (await db()`insert into org (name) values ('Keluarga kosong e2e') returning id`)[0]!.id as string
  try {
    const context = await browser.newContext({ ...iphone, viewport: { width: 375, height: 812 }, ignoreHTTPSErrors: true })
    const kid = await context.newPage()
    await kid.goto('/masuk/anak')
    await typeCode(kid, await codeOf(org))
    await expect(kid.getByRole('heading', { name: 'Namamu belum ada di sini' })).toBeVisible()
    await noHorizontalScroll(kid)
    await context.close()
  } finally {
    await db()`delete from org where id = ${org}`
  }
  await loginAdult(page, TUTOR, '/konsol/pengaturan')
  await page.goto('/konsol/pengaturan')
  await expect(page.getByTestId('family-code')).toBeVisible()
})
