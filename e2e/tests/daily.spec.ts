import { expect, test } from '@playwright/test'
import { closeDb, db, expectNoSeriousA11y, jakartaToday, learnerId, noHorizontalScroll, pinLogin, registerTablet, seedOrgId, waitForPath, watchErrors } from './helpers'

test.afterAll(closeDb)

/**
 * Struktur harian baru: 9 sesi wajib per hari (Practice, Test, Paper untuk tiap mapel), Test terkunci sampai
 * Practice mapel itu selesai dan berhitung mundur, sesi opsional di "Extra today", Hari ringan, dan Try again.
 */

function mondayOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  return new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86400000).toISOString().slice(0, 10)
}

/** Hari bersih untuk Aisha: tanpa sesi, tanpa slot rencana hari ini, dan Minggu tidak lagi hari istirahat. */
async function resetToday(): Promise<{ lid: string; org: string; today: string }> {
  const org = await seedOrgId()
  const lid = await learnerId('Aisha')
  const today = jakartaToday()
  await db()`delete from attempt where id in (select attempt_id from quest where learner_id = ${lid} and date = ${today} and attempt_id is not null)`
  await db()`delete from quest where learner_id = ${lid} and date = ${today}`
  await db()`delete from plan_slot where learner_id = ${lid} and date = ${today}`
  await db()`delete from rest_day where learner_id = ${lid} and date = ${today}`
  await db()`update learner_profile set rest_weekdays = '{}' where user_id = ${lid}`
  await db()`update plan_week set day_templates = '{}'::jsonb where learner_id = ${lid} and week_start = ${mondayOf(today)}`
  return { lid, org, today }
}

async function publishedWeek(org: string, lid: string, today: string): Promise<string> {
  const [w] = await db()`
    insert into plan_week (org_id, learner_id, week_start, status, published_at, created_by)
    values (${org}, ${lid}, ${mondayOf(today)}, 'published', now(), ${lid})
    on conflict (learner_id, week_start) do update set status = 'published'
    returning id`
  return w!.id as string
}

test('Today: 9 sesi wajib per mapel, Test terkunci, Competitions ada di menu', async ({ page }) => {
  const errors = watchErrors(page)
  await resetToday()
  await registerTablet(page, ['Aisha'])
  await pinLogin(page, 'Aisha')

  await expect(page.getByText('0 of 9 sessions done')).toBeVisible()
  for (const subject of ['Math', 'English', 'Science']) {
    const group = page.getByRole('group', { name: `${subject} sessions` })
    await expect(group.getByRole('heading', { name: subject })).toBeVisible()
    await expect(page.getByRole('group', { name: new RegExp(`^${subject} test, locked`) })).toBeVisible()
    await expect(page.getByText(`Opens after your ${subject} practice`)).toBeVisible()
    await expect(page.getByRole('link', { name: new RegExp(`^${subject} paper, ready`) })).toBeVisible()
  }
  await expect(page.getByRole('heading', { level: 4, name: /^Practice: / })).toBeVisible()
  await expect(page.getByRole('link', { name: /^English practice, ready/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /^Science practice, ready/ })).toBeVisible()
  await expectNoSeriousA11y(page, 'Today 9 sesi')
  await noHorizontalScroll(page)

  const [count] = await db()`select count(*)::int as n from quest where learner_id = ${await learnerId('Aisha')} and date = ${jakartaToday()} and kind = 'daily'`
  expect(count!.n).toBe(9)

  await page.getByRole('link', { name: 'Competitions' }).first().click()
  await waitForPath(page, (p) => p === '/competitions')
  expect(errors.filter((e) => !e.includes('favicon'))).toEqual([])
})

test('Test terbuka setelah Practice mapel itu selesai dan berhitung mundur dari 10 menit', async ({ page }) => {
  const { lid, today } = await resetToday()
  await registerTablet(page, ['Aisha'])
  await pinLogin(page, 'Aisha')
  await expect(page.getByText('0 of 9 sessions done')).toBeVisible()

  const rows = await db()`select id, subject, session, attempt_id from quest where learner_id = ${lid} and date = ${today} and kind = 'daily'`
  const q = (subject: string, session: string) => rows.find((r) => r.subject === subject && r.session === session)!

  // Test yang masih terkunci tidak bisa dibuka lewat alamat langsung, dan jamnya tidak mulai.
  await page.goto(`/run/${q('english', 'tes').attempt_id}`)
  await waitForPath(page, (p) => p === '/today')
  const [locked] = await db()`select opened_at from attempt where id = ${q('english', 'tes').attempt_id}`
  expect(locked!.opened_at).toBeNull()

  // Practice Math selesai: Test Math terbuka.
  await db()`update attempt set status = 'submitted', submitted_at = now(), score_raw = 9, score_max = 10, result = '{"perfect":false,"session":"latihan","byTopic":[],"newBadges":[]}'::jsonb where id = ${q('math', 'latihan').attempt_id}`
  await db()`update quest set status = 'done', completed_at = now() where id = ${q('math', 'latihan').id}`
  await page.goto('/today')
  await expect(page.getByText('1 of 9 sessions done')).toBeVisible()
  // Test Math sekarang sesi yang sebaiknya dikerjakan, jadi tampil besar dengan tombol Start.
  await expect(page.getByRole('heading', { level: 4, name: /^Test: / })).toBeVisible()
  await expect(page.getByText('8 questions, 10 minutes on the clock').first()).toBeVisible()
  await page.getByRole('link', { name: 'Start', exact: true }).click()
  await waitForPath(page, (p) => p.startsWith('/quest/'))
  await expect(page.getByText('Timed test')).toBeVisible()
  await expect(page.getByText('10 minutes on the clock')).toBeVisible()
  await page.getByRole('link', { name: 'Start' }).click()
  await waitForPath(page, (p) => p === `/run/${q('math', 'tes').attempt_id}`)
  const timer = page.getByRole('timer')
  await expect(timer).toContainText(/10:00|9:5\d/)
  await expect(timer).toHaveAttribute('aria-label', /minutes?( \d+ seconds?)? left/)
  const [opened] = await db()`select opened_at, time_limit_s from attempt where id = ${q('math', 'tes').attempt_id}`
  expect(opened!.opened_at).not.toBeNull()
  expect(opened!.time_limit_s).toBe(600)
})

test('Try again: percobaan pertama tetap resmi dan ulangan membuka soal baru', async ({ page }) => {
  const errors = watchErrors(page)
  const { lid, today } = await resetToday()
  await registerTablet(page, ['Aisha'])
  await pinLogin(page, 'Aisha')
  await expect(page.getByText('0 of 9 sessions done')).toBeVisible()
  const [row] = await db()`select id, attempt_id from quest where learner_id = ${lid} and date = ${today} and subject = 'math' and session = 'latihan'`
  const root = row!.attempt_id as string
  await db()`update attempt set status = 'submitted', submitted_at = now(), score_raw = 7, score_max = 10, result = '{"perfect":false,"session":"latihan","byTopic":[],"newBadges":[]}'::jsonb where id = ${root}`
  await db()`update quest set status = 'done', completed_at = now() where id = ${row!.id}`

  await page.goto(`/results/${root}`)
  await expect(page.getByRole('region', { name: 'Try again' })).toBeVisible()
  await expect(page.getByText('Trying again earns a quarter of the XP.')).toBeVisible()
  await expectNoSeriousA11y(page, 'hasil dengan Try again')
  await page.getByRole('button', { name: 'Try again' }).click()
  await waitForPath(page, (p) => p.startsWith('/run/') && p !== `/run/${root}`)
  await expect(page.getByText('Question 1 of 10')).toBeVisible()
  const [retry] = await db()`select id, retry_of, retry_no, status, items from attempt where learner_id = ${lid} and retry_of = ${root}`
  expect(retry!.retry_no).toBe(1)
  expect(retry!.status).toBe('in_progress')
  expect((retry!.items as unknown[]).length).toBe(10)
  // Percobaan pertama dan hitungan hari tidak berubah.
  const [q] = await db()`select status from quest where id = ${row!.id}`
  expect(q!.status).toBe('done')
  expect(errors.filter((e) => !e.includes('favicon'))).toEqual([])

  // Hasil percobaan pertama menawarkan melanjutkan ulangan yang sedang berjalan.
  await page.goto(`/results/${root}`)
  await expect(page.getByRole('button', { name: 'Continue your retry' })).toBeVisible()
})

test('sesi opsional dari tutor tampil di Extra today dan tidak menambah sesi wajib', async ({ page }) => {
  const { lid, org, today } = await resetToday()
  const week = await publishedWeek(org, lid, today)
  await db()`delete from plan_slot where learner_id = ${lid} and date = ${today}`
  await db()`insert into plan_slot (org_id, plan_week_id, learner_id, date, subject, kind, session, required, mode, question_count)
    values (${org}, ${week}, ${lid}, ${today}, 'math', 'quest', 'review', false, 'latihan', 10),
           (${org}, ${week}, ${lid}, ${today}, 'english', 'quest', 'english-skill', false, 'latihan', 10)`
  await db()`update plan_slot set config = '{"task":"listening"}'::jsonb where learner_id = ${lid} and date = ${today} and session = 'english-skill'`
  await registerTablet(page, ['Aisha'])
  await pinLogin(page, 'Aisha')
  await expect(page.getByText('0 of 9 sessions done')).toBeVisible()
  const extra = page.getByRole('region', { name: 'Extra today' })
  await expect(extra).toBeVisible()
  await expect(extra.getByText('Review cards')).toBeVisible()
  await expect(extra.getByText('English listening')).toBeVisible()
  await expect(extra.getByText('Optional, and your streak does not change.')).toBeVisible()
  await expectNoSeriousA11y(page, 'Today dengan Extra today')
  const [dr] = await db()`select quests_required from day_record where learner_id = ${lid} and date = ${today}`
  expect(dr!.quests_required).toBe(9)
  await db()`delete from plan_slot where learner_id = ${lid} and date = ${today}`
})

test('Hari ringan: tiga Practice saja yang wajib', async ({ page }) => {
  const { lid, org, today } = await resetToday()
  const week = await publishedWeek(org, lid, today)
  await db()`update plan_week set day_templates = ${db().json({ [today]: 'light' })} where id = ${week}`
  await registerTablet(page, ['Aisha'])
  await pinLogin(page, 'Aisha')
  await expect(page.getByText('0 of 3 sessions done')).toBeVisible()
  await expect(page.getByRole('link', { name: /^English practice, ready/ })).toBeVisible()
  await expect(page.getByRole('group', { name: /test, locked/ })).toHaveCount(0)
  const [dr] = await db()`select quests_required from day_record where learner_id = ${lid} and date = ${today}`
  expect(dr!.quests_required).toBe(3)
  await db()`update plan_week set day_templates = '{}'::jsonb where id = ${week}`
})
