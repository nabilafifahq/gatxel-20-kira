import { expect, test } from '@playwright/test'
import { closeDb, db, jakartaToday, learnerId, mcqItems, pinLogin, registerTablet, seedOrgId } from './helpers'

test.afterAll(closeDb)

/**
 * Quest hari ini tetap bisa dikerjakan saat internet rumah putus: service worker menyimpan halaman
 * runner, jawaban masuk antrean IndexedDB, lalu terkirim saat online lagi.
 * Butuh build produksi (next start); server pengembangan memuat ulang modul lewat HMR.
 */
test.skip(!process.env.E2E_PROD, 'Jalankan dengan E2E_PROD=1 terhadap next start')

test('quest yang disimpan offline bisa dijawab dan tersinkron setelah online', async ({ page, context }) => {
  const org = await seedOrgId()
  const lid = await learnerId('Aisha')
  const today = jakartaToday()
  const items = mcqItems('e2.', 3)
  // Tes lain mungkin sudah membuat quest hari ini; mulai dari hari yang bersih.
  await db()`delete from attempt where id in (select attempt_id from quest where learner_id = ${lid} and date = ${today})`
  await db()`delete from quest where learner_id = ${lid} and date = ${today}`
  await db()`delete from plan_slot where learner_id = ${lid} and date = ${today}`
  const [p] = await db()`
    insert into paper (org_id, code, title, subject, grade, minutes, mode, item_refs, created_by)
    values (${org}, 'P-E2E-01', 'Offline practice', 'english', 2, 10, 'latihan', ${items.map((i) => i.id)}, ${lid})
    returning id`
  const monday = new Date(Date.parse(`${today}T00:00:00Z`) - (((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7) * 86400000)).toISOString().slice(0, 10)
  const [w] = await db()`
    insert into plan_week (org_id, learner_id, week_start, status, published_at, created_by)
    values (${org}, ${lid}, ${monday}, 'published', now(), ${lid})
    on conflict (learner_id, week_start) do update set status = 'published'
    returning id`
  await db()`delete from rest_day where learner_id = ${lid} and date = ${today}`
  await db()`update learner_profile set rest_weekdays = '{}' where user_id = ${lid}`
  await db()`
    insert into plan_slot (org_id, plan_week_id, learner_id, date, subject, kind, paper_id, mode, question_count)
    values (${org}, ${w!.id}, ${lid}, ${today}, 'english', 'quest', ${p!.id}, 'latihan', 3)`

  await registerTablet(page, ['Aisha'])
  await pinLogin(page, 'Aisha')
  const [q] = await db()`select attempt_id from quest where learner_id = ${lid} and date = ${today} and subject = 'english' and kind = 'daily'`
  const runUrl = `/run/${q!.attempt_id}`

  // Tunggu service worker aktif dan halaman runner tersimpan.
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, { timeout: 30_000 }).catch(async () => {
    await page.reload()
    await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, { timeout: 30_000 })
  })
  await page.evaluate(async (urls) => {
    const reg = await navigator.serviceWorker.ready
    reg.active?.postMessage({ type: 'precache', urls })
  }, ['/today', runUrl])
  await expect
    .poll(async () => page.evaluate(async (u) => Boolean(await (await caches.open('kira-v1-pages')).match(u)), runUrl), { timeout: 30_000 })
    .toBe(true)
  const [before] = await db()`select opened_at from attempt where id = ${q!.attempt_id}`
  expect(before!.opened_at, 'menyimpan halaman tidak memulai jam').toBeNull()

  await context.setOffline(true)
  await page.goto(runUrl)
  await expect(page.getByText('Question 1 of 3')).toBeVisible()
  const first = items[0]!
  await page.getByRole('radio', { name: first.options[first.answer]!.text! }).or(page.getByRole('button', { name: first.options[first.answer]!.text! })).first().click()
  await page.getByRole('button', { name: 'Check', exact: true }).click()
  await expect(page.getByText(/saved on this/i).first()).toBeVisible()
  const queued = await db()`select count(*)::int as n from response where attempt_id = ${q!.attempt_id}`
  expect(queued[0]!.n).toBe(0)

  await context.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect
    .poll(async () => (await db()`select count(*)::int as n from response where attempt_id = ${q!.attempt_id} and position = 1`)[0]!.n, { timeout: 45_000 })
    .toBe(1)
  const [r] = await db()`select status from response where attempt_id = ${q!.attempt_id} and position = 1`
  expect(r!.status).toBe('correct')
})
