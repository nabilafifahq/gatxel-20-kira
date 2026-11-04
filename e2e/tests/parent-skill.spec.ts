import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import { closeDb, db, expectNoSeriousA11y, GUARDIAN, jakartaToday, learnerId, loginAdult, noHorizontalScroll, pinLogin, registerTablet, seedOrgId, TUTOR, watchErrors } from './helpers'

/**
 * Ganti pelajaran. Orang tua (lebar HP) memilih pelajaran lain untuk sesi hari ini, Today anak di perangkat lain
 * memakainya saat dimuat berikutnya, sesi selesai dan sesi berjalan diberi pesan jelas, dan tutor keluarga lama
 * mengganti pelajaran hari ini lewat Rencana seperti biasa.
 */

type SkillFile = { id: string; title: string; titleId: string }[]
const skills = JSON.parse(readFileSync(fileURLToPath(new URL('../../content/skills/math/g2.json', import.meta.url)), 'utf8')) as SkillFile
const skillById = (id: string) => skills.find((s) => s.id === id)!

const questOf = async (learner: string, subject: string, session: string) =>
  (await db()`select id, skill_id, attempt_id, kind, status from quest where learner_id = ${learner} and date = ${jakartaToday()} and subject = ${subject} and session = ${session} order by kind, seq limit 1`)[0]!

/** Baris sesi di halaman orang tua: "Math, Latihan". */
const rowOf = (page: Page, name: string) => page.getByRole('listitem').filter({ has: page.getByText(name, { exact: true }) })

async function resetDay(learner: string) {
  const org = await seedOrgId()
  await db()`update learner_profile set rest_weekdays = '{}' where user_id = ${learner}`
  await db()`update day_rules set preset = 'seimbang', rules = null where learner_id = ${learner} and org_id = ${org}`
  await db()`delete from attempt where id in (select attempt_id from quest where learner_id = ${learner} and date = ${jakartaToday()} and attempt_id is not null)`
  await db()`delete from quest where learner_id = ${learner} and date = ${jakartaToday()}`
  await db()`delete from plan_slot where learner_id = ${learner} and date = ${jakartaToday()}`
}

test.afterAll(async () => {
  const org = await seedOrgId()
  await db()`update day_rules set preset = 'penuh', rules = null where org_id = ${org}`
  for (const name of ['Aisha', 'Raka'] as const) await resetDay(await learnerId(name))
  await db()`update day_rules set preset = 'penuh', rules = null where org_id = ${org}`
  await closeDb()
})

test('orang tua mengganti pelajaran, Today anak ikut, sesi selesai dan sesi berjalan diberi pesan', async ({ page: child, browser, baseURL }) => {
  const lid = await learnerId('Aisha')
  const org = await seedOrgId()
  await resetDay(lid)

  // Anak membuka Today di tabletnya sendiri.
  await registerTablet(child, ['Aisha', 'Raka'], 'Tablet ganti pelajaran')
  await pinLogin(child, 'Aisha')
  await expect(child.getByText('Required today')).toBeVisible()

  // Orang tua di HP.
  const ctx = await browser.newContext({ baseURL: baseURL!, viewport: { width: 390, height: 844 }, locale: 'en-GB', timezoneId: 'Asia/Jakarta' })
  const page = await ctx.newPage()
  const errors = watchErrors(page)
  await loginAdult(page, GUARDIAN, `/keluarga/anak/${lid}`)
  await expect(page.getByRole('heading', { level: 2, name: 'Sesi hari ini' })).toBeVisible()

  const before = await questOf(lid, 'math', 'latihan')
  const target = skillById(before.skill_id === 'm2.arrays' ? 'm2.place-value' : 'm2.arrays')
  const row = rowOf(page, 'Math, Latihan')
  await expect(row.getByText(skillById(before.skill_id as string)?.titleId ?? '', { exact: true })).toBeVisible()
  await noHorizontalScroll(page)

  await row.getByRole('button', { name: 'Ganti pelajaran' }).click()
  const dialog = page.getByRole('dialog', { name: 'Ganti pelajaran Latihan Math' })
  await expect(dialog.getByText('Latihan Math dan Tes Math')).toBeVisible()
  await expect(dialog.getByRole('group', { name: 'Nilai tempat, urutan, dan pembulatan' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Pakai pelajaran ini' })).toBeDisabled()
  await noHorizontalScroll(page)
  await expectNoSeriousA11y(page, 'dialog ganti pelajaran')

  await dialog.getByRole('radio', { name: new RegExp(target.titleId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).check()
  await dialog.getByRole('button', { name: 'Pakai pelajaran ini' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('status').filter({ hasText: `diganti ke ${target.titleId}` })).toBeVisible()
  await expect(rowOf(page, 'Math, Latihan').getByText(target.titleId, { exact: true })).toBeVisible()
  await expect(rowOf(page, 'Math, Tes').getByText(target.titleId, { exact: true })).toBeVisible()

  const after = await questOf(lid, 'math', 'latihan')
  expect(after).toMatchObject({ id: before.id, skill_id: target.id, kind: 'daily' })
  const audit = await db()`select actor_kind from audit_log where org_id = ${org} and action = 'parent.session.skill' and target = ${lid}`
  expect(audit[0]?.actor_kind).toBe('guardian')

  // Today anak memakai pelajaran baru pada muat berikutnya, di perangkat yang berbeda.
  await child.goto('/today')
  await expect(child.getByText(target.title).first()).toBeVisible()

  // Sesi yang sedang dikerjakan tetap berjalan.
  const lat = await questOf(lid, 'english', 'latihan')
  const items = (await db()`select items, subject from attempt where id = ${lat.attempt_id as string}`)[0]!
  const first = (items.items as { ref: string; position: number; difficulty: number }[])[0]!
  await db()`insert into response (org_id, attempt_id, learner_id, position, item_ref, skill_id, subject, item_type, difficulty, answer, status, client_id)
    values (${org}, ${lat.attempt_id as string}, ${lid}, ${first.position}, ${first.ref}, ${lat.skill_id as string}, 'english', 'mcq', ${first.difficulty}, ${db().json({ value: 'x' })}, 'wrong', ${randomUUID()})`
  await page.reload()
  const running = rowOf(page, 'English, Latihan')
  await expect(running.getByText('sedang dikerjakan', { exact: true })).toBeVisible()
  await expect(running.getByText(/tetap berjalan sampai selesai\. Pelajaran baru berlaku mulai Tes English/)).toBeVisible()
  await expect(running.getByRole('button', { name: 'Hapus sesi' })).toHaveCount(0)

  // Sesi yang selesai tidak punya tombol ganti, dan membuka lagi dari tab lama pun ditolak.
  await db()`update quest set status = 'done', completed_at = now() where id = ${after.id as string}`
  await page.reload()
  const finished = rowOf(page, 'Math, Latihan')
  await expect(finished.getByText('Sudah selesai, jadi pelajarannya tidak bisa diganti lagi.')).toBeVisible()
  await expect(finished.getByRole('button', { name: 'Ganti pelajaran' })).toHaveCount(0)

  expect(errors.filter((e) => !e.includes('favicon'))).toEqual([])
  await ctx.close()
})

test('tutor keluarga lama mengganti pelajaran hari ini lewat Rencana, Today anak ikut', async ({ page: child, browser, baseURL }) => {
  const lid = await learnerId('Raka')
  await resetDay(lid)
  await registerTablet(child, ['Aisha', 'Raka'], 'Tablet tutor')
  await pinLogin(child, 'Raka')
  await expect(child.getByText('Required today')).toBeVisible()
  const before = await questOf(lid, 'math', 'latihan')
  const grade4 = JSON.parse(readFileSync(fileURLToPath(new URL('../../content/skills/math/g4.json', import.meta.url)), 'utf8')) as SkillFile
  const target = grade4.find((x) => x.id !== before.skill_id)!

  const ctx = await browser.newContext({ baseURL: baseURL!, viewport: { width: 1280, height: 900 }, locale: 'en-GB', timezoneId: 'Asia/Jakarta' })
  const page = await ctx.newPage()
  await loginAdult(page, TUTOR)
  await page.goto(`/konsol/rencana?learner=${lid}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Rencana minggu' })).toBeVisible()
  const d = new Date(`${jakartaToday()}T00:00:00Z`)
  const day = `${['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][d.getUTCDay()]} ${d.getUTCDate()}`
  await page.getByRole('button', { name: new RegExp(`^Atur Latihan.*, Math, ${day}`) }).click()
  const dialog = page.getByRole('dialog', { name: 'Atur sesi' })
  await dialog.getByRole('searchbox').fill(target.title)
  await dialog.getByRole('radio', { name: new RegExp(target.title.replace(/[.*+?^${}()|[]\]/g, '\$&')) }).first().check()
  await dialog.getByRole('button', { name: 'Tambah ke rencana' }).click()
  await expect.poll(async () => (await questOf(lid, 'math', 'latihan')).skill_id, { timeout: 15_000 }).toBe(target.id)
  expect((await questOf(lid, 'math', 'latihan')).kind).toBe('daily')

  await child.goto('/today')
  await expect(child.getByText(target.title).first()).toBeVisible()
  await ctx.close()
})
