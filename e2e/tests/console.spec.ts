import { expect, test } from '@playwright/test'
import { closeDb, db, expectNoSeriousA11y, jakartaToday, learnerId, loginAdult, noHorizontalScroll, seedOrgId, TUTOR, watchErrors } from './helpers'

test.afterAll(closeDb)

const PAGES: { path: string; h1: RegExp }[] = [
  { path: '/konsol', h1: /Hari ini/ },
  { path: '/konsol/rencana', h1: /Rencana/ },
  { path: '/konsol/hasil', h1: /Hasil|Kotak hasil/ },
  { path: '/konsol/ljk', h1: /LJK/ },
  { path: '/konsol/bank-soal', h1: /Bank soal/ },
  { path: '/konsol/paper', h1: /paper/i },
  { path: '/konsol/lomba', h1: /Lomba|Kalender/ },
  { path: '/konsol/laporan', h1: /Laporan/ },
  { path: '/konsol/pengaturan', h1: /Pengaturan/ },
  { path: '/konsol/studio-ai', h1: /Studio AI/ },
  { path: '/konsol/impor', h1: /Impor/ },
  { path: '/konsol/learner', h1: /Learner/ },
  { path: '/konsol/koneksi-claude', h1: /Claude/ },
]

test('semua halaman konsol tampil tanpa error, lolos axe, dan tidak bergeser di layar sempit', async ({ page }) => {
  test.setTimeout(240_000)
  const errors = watchErrors(page)
  await loginAdult(page, TUTOR)
  for (const p of PAGES) {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(p.path)
    await expect(page.getByRole('heading', { level: 1 }).first(), p.path).toHaveText(p.h1)
    await expectNoSeriousA11y(page, p.path)
    await page.setViewportSize({ width: 375, height: 800 })
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    await noHorizontalScroll(page)
  }
  const aisha = await learnerId('Aisha')
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(`/konsol/learner/${aisha}`)
  await expect(page.getByRole('heading', { level: 1 }).first()).toContainText('Aisha')
  await expectNoSeriousA11y(page, 'detail learner')
  expect(errors.filter((e) => !e.includes('favicon'))).toEqual([])
})

test('catatan tutor tersimpan', async ({ page }) => {
  await loginAdult(page, TUTOR)
  const raka = await learnerId('Raka')
  await page.goto(`/konsol/learner/${raka}`)
  const note = `Catatan e2e ${Date.now()}`
  await page.getByRole('textbox').first().fill(note)
  await page.getByRole('button', { name: /Simpan catatan/ }).click()
  await expect(page.getByText('Catatan tersimpan.').first()).toBeVisible()
  await expect(page.getByText(note)).toHaveCount(1)
  await expect
    .poll(async () => (await db()`select count(*)::int as n from note where learner_id = ${raka} and body = ${note}`)[0]!.n, { timeout: 15_000 })
    .toBe(1)
  await page.reload()
  await expect(page.getByText(note)).toHaveCount(1)
})

test('rencana: terapkan usulan lalu terbitkan minggu', async ({ page }) => {
  await loginAdult(page, TUTOR)
  await page.goto('/konsol/rencana')
  const apply = page.getByRole('button', { name: /Terapkan semua|Terapkan usulan/ }).first()
  if (await apply.isVisible().catch(() => false)) {
    await apply.click()
    await expect(page.getByRole('status').filter({ hasText: /\S/ }).first()).toBeVisible()
  }
  const publish = page.getByRole('button', { name: /Terbitkan/ }).first()
  if (await publish.isVisible().catch(() => false)) {
    await publish.click()
    const confirm = page.getByRole('dialog').getByRole('button', { name: /Terbitkan/ })
    if (await confirm.isVisible().catch(() => false)) await confirm.click()
  }
  await expect
    .poll(async () => (await db()`select count(*)::int as n from plan_week where status = 'published' and org_id = ${await seedOrgId()}`)[0]!.n, { timeout: 15_000 })
    .toBeGreaterThan(0)
})

test('rencana: Hari ringan di salah satu hari dan satu sesi opsional', async ({ page }) => {
  const lid = await learnerId('Aisha')
  const org = await seedOrgId()
  const today = jakartaToday()
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay()
  const nextMonday = new Date(Date.parse(`${today}T00:00:00Z`) + (((8 - dow) % 7) + (dow === 1 ? 7 : 0)) * 86400000).toISOString().slice(0, 10)
  const wednesday = new Date(Date.parse(`${nextMonday}T00:00:00Z`) + 2 * 86400000).toISOString().slice(0, 10)
  await db()`delete from plan_slot where learner_id = ${lid} and date >= ${nextMonday}`
  await db()`update plan_week set day_templates = '{}'::jsonb where learner_id = ${lid} and week_start = ${nextMonday}`
  await loginAdult(page, TUTOR)
  await page.goto(`/konsol/rencana?learner=${lid}&minggu=${nextMonday}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Rencana minggu' })).toBeVisible()
  // Hari biasa menampilkan 9 sesi wajib otomatis dan meteran waktu layar.
  await expect(page.getByRole('button', { name: /^Template Hari sekolah, Rabu / })).toBeVisible()
  await expect(page.getByRole('img', { name: /^Rabu .*, 9 sesi wajib/ })).toBeVisible()

  await page.getByRole('button', { name: /^Template Hari sekolah, Rabu / }).click()
  const dialog = page.getByRole('dialog', { name: 'Template hari' })
  await dialog.getByRole('radio', { name: /Hari ringan/ }).check()
  await dialog.getByRole('button', { name: 'Pakai template' }).click()
  await expect(page.getByRole('button', { name: /^Template Hari ringan, Rabu / })).toBeVisible()
  await expect
    .poll(async () => (await db()`select day_templates from plan_week where learner_id = ${lid} and week_start = ${nextMonday}`)[0]?.day_templates, { timeout: 15_000 })
    .toEqual({ [wednesday]: 'light' })

  // Satu sesi opsional: Ulang kartu untuk Math di hari Rabu itu.
  await page.getByRole('button', { name: /^Tambah sesi Math, Rabu / }).click()
  const add = page.getByRole('dialog', { name: 'Tambah sesi' })
  await add.getByLabel('Jenis sesi').selectOption('review')
  await add.getByRole('button', { name: 'Tambah ke rencana' }).click()
  await expect
    .poll(async () => (await db()`select count(*)::int as n from plan_slot where learner_id = ${lid} and date = ${wednesday} and session = 'review' and required = false and org_id = ${org}`)[0]!.n, { timeout: 15_000 })
    .toBe(1)
  await db()`update plan_week set day_templates = '{}'::jsonb where learner_id = ${lid} and week_start = ${nextMonday}`
  await db()`delete from plan_slot where learner_id = ${lid} and date >= ${nextMonday}`
})
