import { expect, test, type Page } from '@playwright/test'
import { closeDb, db, expectNoSeriousA11y, GUARDIAN, jakartaToday, learnerId, loginAdult, mcqItems, noHorizontalScroll, pinLogin, registerTablet, seedOrgId, waitForPath, watchErrors } from './helpers'

/**
 * Bahasa tampilan anak: antarmuka Indonesia, soal tetap Inggris, dan pengaturan orang tua.
 * Data contoh memakai tampilan Inggris; tes ini mengganti Aisha lalu mengembalikannya.
 */

async function setUiLang(name: 'Aisha' | 'Raka', lang: 'id' | 'en', allowSwitch = false): Promise<string> {
  const id = await learnerId(name)
  await db()`update auth.user_account set ui_lang = ${lang}, ui_lang_switch = ${allowSwitch} where id = ${id}`
  return id
}

async function resetToday(id: string): Promise<void> {
  await db()`update learner_profile set rest_weekdays = '{}' where user_id = ${id}`
  await db()`delete from attempt where id in (select attempt_id from quest where learner_id = ${id} and date = ${jakartaToday()} and attempt_id is not null)`
  await db()`delete from quest where learner_id = ${id} and date = ${jakartaToday()}`
}

async function htmlLangOf(page: Page): Promise<string | null> {
  return page.locator('html').getAttribute('lang')
}

test.afterAll(async () => {
  await setUiLang('Aisha', 'en')
  await setUiLang('Raka', 'en')
  await closeDb()
})

test('anak berbahasa Indonesia melihat Today dan sesi dalam bahasa Indonesia, soalnya tetap Inggris', async ({ page }) => {
  const errors = watchErrors(page)
  const id = await setUiLang('Aisha', 'en')
  await resetToday(id)
  await registerTablet(page, ['Aisha'])
  await pinLogin(page, 'Aisha')

  // Pilihan orang tua berlaku di request berikutnya, tanpa keluar dari sesi.
  await setUiLang('Aisha', 'id')
  await page.goto('/today')
  expect(await htmlLangOf(page)).toBe('id')
  const nav = page.getByRole('navigation').first()
  await expect(nav.getByRole('link', { name: 'Hari ini' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Peta' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Today', exact: true })).toHaveCount(0)
  await expectNoSeriousA11y(page, 'Hari ini')
  await noHorizontalScroll(page)

  // Sesi dengan soal yang diketahui: instruksi Indonesia, isi soal Inggris dan bertanda lang.
  const items = mcqItems('e', 3)
  await page.setViewportSize({ width: 375, height: 800 })
  const skill = (await db()`select coalesce(max(id::text), '') as x from org limit 1`)[0]
  expect(skill).toBeTruthy()
  await page.goto('/practice')
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(/Free practice/)
  const tile = page.locator('section[aria-labelledby="pr-english"] a').first()
  await tile.click()
  await waitForPath(page, (p) => p.startsWith('/run/'))
  await expect(page.getByRole('button', { name: 'Periksa' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Check', exact: true })).toHaveCount(0)
  // Prompt berasal dari konten berbahasa Inggris dan ditandai lang en-GB untuk pembaca layar.
  const prompt = page.locator('[data-item-prompt]').first()
  await expect(prompt).toHaveAttribute('lang', 'en-GB')
  await expect(prompt).toHaveText(/\b(the|a|is|are|which|what|choose|word)\b/i)
  await noHorizontalScroll(page)
  expect(items.length).toBeGreaterThan(0)
  expect(errors.filter((e) => !e.includes('favicon'))).toEqual([])
})

test('layar pilih anak dan PIN mengikuti bahasa anak di tablet itu', async ({ page }) => {
  const id = await setUiLang('Aisha', 'id')
  await registerTablet(page, ['Aisha'])
  await page.goto('/')
  expect(await htmlLangOf(page)).toBe('id')
  await expect(page.getByRole('link', { name: /^Aisha, Kelas 2/ })).toBeVisible()
  await setUiLang('Aisha', 'en')
  await page.goto('/')
  expect(await htmlLangOf(page)).toBe('en-GB')
  await expect(page.getByRole('link', { name: /^Aisha, Grade 2/ })).toBeVisible()
  expect(id).toBeTruthy()
})

test('anak baru memakai bahasa Indonesia dari awal, keluarga lama tetap Inggris', async () => {
  const org = await seedOrgId()
  const existing = await db()`select ui_lang from auth.user_account where org_id = ${org} and kind = 'learner'`
  expect(existing.every((r) => r.ui_lang === 'en')).toBe(true)
  const [dflt] = await db()`select column_default from information_schema.columns where table_schema = 'auth' and table_name = 'user_account' and column_name = 'ui_lang'`
  expect(String(dflt!.column_default)).toContain('id')
})

test('orang tua mengganti bahasa tampilan anak, dan anak melihat hasilnya', async ({ page, context }) => {
  const errors = watchErrors(page)
  const id = await setUiLang('Raka', 'en')
  await loginAdult(page, GUARDIAN, `/keluarga/anak/${id}`)
  await page.getByText('Pengaturan', { exact: true }).click()
  const group = page.getByRole('group', { name: 'Bahasa tampilan anak' })
  await expect(group).toBeVisible()
  await expect(group.getByRole('radio', { name: 'English' })).toBeChecked()
  await group.getByRole('radio', { name: 'Bahasa Indonesia' }).check()
  await expect(page.getByText('Bahasa tampilan tersimpan.')).toBeVisible()
  await expect.poll(async () => (await db()`select ui_lang from auth.user_account where id = ${id}`)[0]!.ui_lang).toBe('id')
  await expectNoSeriousA11y(page, 'pengaturan bahasa')
  expect(errors.filter((e) => !e.includes('favicon'))).toEqual([])

  // Muat ulang: pilihan tersimpan terbaca kembali.
  await page.reload()
  await page.getByText('Pengaturan', { exact: true }).click()
  await expect(page.getByRole('group', { name: 'Bahasa tampilan anak' }).getByRole('radio', { name: 'Bahasa Indonesia' })).toBeChecked()

  // Tombol bahasa anak hanya muncul bila diizinkan.
  await context.clearCookies()
  await setUiLang('Raka', 'en')
  await registerTablet(page, ['Raka'])
  await pinLogin(page, 'Raka')
  await page.goto('/me')
  await expect(page.getByRole('group', { name: 'Language' })).toHaveCount(0)
  await setUiLang('Raka', 'en', true)
  await page.goto('/me')
  const sw = page.getByRole('group', { name: 'Language' })
  await sw.getByRole('button', { name: 'Bahasa Indonesia' }).click()
  await expect.poll(() => htmlLangOf(page)).toBe('id')
  await expect(page.getByRole('group', { name: 'Bahasa' })).toBeVisible()
})
