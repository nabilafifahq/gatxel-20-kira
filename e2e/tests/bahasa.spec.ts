import { expect, test, type Page } from '@playwright/test'
import { closeDb, createPracticeAttempt, db, expectNoSeriousA11y, GUARDIAN, jakartaToday, learnerId, loginAdult, mcqItems, noHorizontalScroll, pinLogin, registerTablet, seedOrgId, watchErrors } from './helpers'

/**
 * Bahasa tampilan anak: antarmuka Indonesia, soal tetap Inggris, dan pengaturan orang tua.
 * Data contoh memakai tampilan Inggris; tes ini mengganti Aisha dan Raka lalu mengembalikannya.
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

const htmlLangOf = (page: Page) => page.locator('html').getAttribute('lang')

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

  // Sesi dengan soal yang diketahui: tombol Indonesia, isi soal Inggris dan bertanda lang untuk pembaca layar.
  const items = mcqItems('e2.', 2) as unknown as { id: string; difficulty: number; prompt: string }[]
  expect(items.length).toBe(2)
  const attempt = await createPracticeAttempt('Aisha', items)
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto(`/run/${attempt}`)
  expect(await htmlLangOf(page)).toBe('id')
  await expect(page.getByRole('button', { name: 'Periksa' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Check', exact: true })).toHaveCount(0)
  const prompt = page.locator('main [lang="en-GB"]').getByText(items[0]!.prompt, { exact: false }).first()
  await expect(prompt).toBeVisible()
  await noHorizontalScroll(page)
  await expectNoSeriousA11y(page, 'sesi Indonesia')

  // Jawab: kata umpan balik Indonesia.
  await page.locator('main [lang="en-GB"] button, main button[lang="en-GB"], main button:has([lang="en-GB"])').first().click()
  await page.getByRole('button', { name: 'Periksa' }).click()
  await expect(page.getByText(/Betul|Benar|Hebat|Belum tepat/).first()).toBeVisible()
  await expect(page.getByText('Not yet', { exact: true })).toHaveCount(0)
  expect(errors.filter((e) => !e.includes('favicon'))).toEqual([])
})

test('layar pilih anak mengikuti bahasa anak di tablet itu', async ({ page }) => {
  await setUiLang('Aisha', 'id')
  await registerTablet(page, ['Aisha'])
  await page.goto('/')
  expect(await htmlLangOf(page)).toBe('id')
  await expect(page.getByRole('link', { name: /^Aisha, Kelas 2/ })).toBeVisible()
  await setUiLang('Aisha', 'en')
  await page.goto('/')
  expect(await htmlLangOf(page)).toBe('en-GB')
  await expect(page.getByRole('link', { name: /^Aisha, Grade 2/ })).toBeVisible()
})

test('anak baru memakai bahasa Indonesia dari awal, keluarga lama tetap Inggris', async () => {
  const org = await seedOrgId()
  const existing = await db()`select ui_lang from auth.user_account where org_id = ${org} and kind = 'learner'`
  expect(existing.every((r) => r.ui_lang === 'en')).toBe(true)
  const [dflt] = await db()`select column_default from information_schema.columns where table_schema = 'auth' and table_name = 'user_account' and column_name = 'ui_lang'`
  expect(String(dflt!.column_default)).toContain('id')
})

test('orang tua mengganti bahasa tampilan anak, dan tombol bahasa anak hanya muncul bila diizinkan', async ({ page, context }) => {
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

  // Belum diizinkan: tombol tidak ada. Sudah diizinkan: anak bisa mengganti sendiri.
  await context.clearCookies()
  await setUiLang('Raka', 'en')
  await registerTablet(page, ['Raka'])
  await pinLogin(page, 'Raka')
  await page.goto('/me')
  await expect(page.getByRole('group', { name: 'Language' })).toHaveCount(0)
  await setUiLang('Raka', 'en', true)
  await page.goto('/me')
  await page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'Bahasa Indonesia' }).click()
  await expect.poll(() => htmlLangOf(page)).toBe('id')
  await expect(page.getByRole('group', { name: 'Bahasa', exact: true })).toBeVisible()
})
