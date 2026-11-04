import { expect, test } from '@playwright/test'
import { closeDb, db, expectNoSeriousA11y, learnerId, noHorizontalScroll, pinLogin, registerTablet, seedOrgId, waitForPath, watchErrors } from './helpers'

test.afterAll(closeDb)

const SHOTS = process.env.E2E_SHOTS

/** Kira World: bintang, teman, toko, album, cerita, tantangan bos, dan ruang piala. */
test('Kira World: telur menetas, beri camilan, belanja, album, cerita, bos, piala', async ({ page }) => {
  const sql = db()
  const org = await seedOrgId()
  const aisha = await learnerId('Aisha')
  await sql`delete from star_ledger where learner_id = ${aisha}`
  await sql`delete from world_state where learner_id = ${aisha}`
  await sql`delete from world_item where learner_id = ${aisha}`
  await sql`delete from world_card where learner_id = ${aisha}`
  await sql`delete from attempt where learner_id = ${aisha} and ref_id like 'boss:%'`
  await sql`insert into star_ledger (org_id, learner_id, amount, reason, source, date) values (${org}, ${aisha}, 60, 'session', 'e2e:seed', current_date)`
  await sql`insert into contest_medal (org_id, learner_id, title, medal, earned_on) values (${org}, ${aisha}, 'OSN tingkat sekolah', 'silver', current_date)`
  for (const c of ['an-lion', 'an-elephant', 'an-whale', 'rb-robot']) {
    await sql`insert into world_card (org_id, learner_id, card_id, source) values (${org}, ${aisha}, ${c}, 'e2e')`
  }
  const errors = watchErrors(page)
  await registerTablet(page, ['Aisha', 'Raka'])
  await pinLogin(page, 'Aisha')
  const shot = async (name: string) => {
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true })
  }

  await page.goto('/world')
  await expect(page.getByRole('heading', { level: 1, name: 'Kira World' })).toBeVisible()
  await expect(page.getByText('A mystery egg').or(page.getByText('Your egg is ready!'))).toBeVisible()
  await expectNoSeriousA11y(page, 'Kira World beranda')
  await noHorizontalScroll(page)
  await shot('hub')

  // Telur menetas, pilih teman, beri nama.
  await page.goto('/world/friend')
  await page.getByRole('button', { name: 'Hatch the egg' }).click()
  await page.getByRole('button', { name: /Moonbun/ }).click()
  await page.getByLabel('What will you call your friend?').fill('Mimi')
  await shot('hatch')
  await page.getByRole('button', { name: 'Meet your friend' }).click()
  await expect(page.getByRole('heading', { name: /Mimi the Moonbun/ })).toBeVisible()
  await expectNoSeriousA11y(page, 'Teman')
  await noHorizontalScroll(page)
  await shot('pet')

  // Camilan memakai bintang di server.
  await page.getByRole('button', { name: 'Apple, 2 stars' }).click()
  await expect(page.getByRole('status')).toContainText('Crunch')
  const [afterTreat] = await sql`select coalesce(sum(amount),0)::int as n from star_ledger where learner_id = ${aisha}`
  expect(afterTreat!.n).toBe(58)

  // Toko: beli kostum dan pakai.
  await page.goto('/world/shop')
  await expect(page.getByRole('heading', { level: 1, name: 'Star Shop' })).toBeVisible()
  await expectNoSeriousA11y(page, 'Toko Bintang')
  await noHorizontalScroll(page)
  await shot('shop')
  await page.getByRole('button', { name: 'Buy Bow for 9 stars' }).click()
  await expect(page.getByRole('button', { name: 'Wear' }).first()).toBeVisible()
  const [owned] = await sql`select count(*)::int as n from world_item where learner_id = ${aisha} and item_id = 'pet-bow'`
  expect(owned!.n).toBe(1)

  // Album kartu.
  await page.goto('/world/cards')
  await expect(page.getByRole('heading', { level: 1, name: 'Card album' })).toBeVisible()
  await expectNoSeriousA11y(page, 'Album kartu')
  await noHorizontalScroll(page)
  await shot('cards')

  // Cerita: bab 1 terbuka, bab 2 menunggu tujuan mingguan.
  await page.goto('/world/story')
  await expect(page.getByRole('heading', { level: 1, name: 'Kira and the Lost Library' })).toBeVisible()
  await shot('story-list')
  await page.getByRole('button', { name: /The Dark Lamp/ }).click()
  await expect(page.getByText('Page 1 of 12')).toBeVisible()
  await shot('story-page')
  for (let i = 0; i < 11; i++) await page.getByRole('button', { name: 'Turn the page' }).click()
  await expect(page.getByText(/Next time:/)).toBeVisible()
  await expect(page.getByText('A new scrap of the note')).toBeVisible()
  await expectNoSeriousA11y(page, 'Cerita')
  await noHorizontalScroll(page)
  await shot('story-end')
  // Selesai bab: kartu kenangan, lalu sobekan surat tersimpan.
  await page.getByRole('button', { name: 'Finish chapter' }).click()
  await expect(page.getByRole('dialog').getByText('Lumi')).toBeVisible()
  await shot('story-card')
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).first().click()
  await expect(page.getByText('1 of 8 scraps')).toBeVisible()
  await expect(page.getByText('Bring home the six big books.')).toBeVisible()
  const [card] = await sql`select count(*)::int as n from world_card where learner_id = ${aisha} and card_id = 'st-lumi'`
  expect(card!.n).toBe(1)

  // Tantangan bos: 3 lawan datang lebih dulu, lalu runner dengan bar tenaga.
  await page.goto('/world/boss')
  await expect(page.getByRole('heading', { level: 1, name: 'Boss challenge' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Clickerclaw/ })).toBeVisible()
  await expect(page.getByText('A new challenger').first()).toBeVisible()
  await expectNoSeriousA11y(page, 'Tantangan bos')
  await noHorizontalScroll(page)
  await shot('boss')
  await page.getByRole('button', { name: /Clickerclaw/ }).click()
  await expect(page.getByText('The counting crab')).toBeVisible()
  await page.getByRole('link', { name: 'Start the challenge' }).click()
  await waitForPath(page, (p) => p.startsWith('/run/'))
  await expect(page.getByRole('progressbar', { name: 'Clickerclaw energy' })).toBeVisible()
  const [att] = await sql`select jsonb_array_length(items) as n, ref_id, items from attempt where learner_id = ${aisha} and ref_id like 'boss:%' order by created_at desc limit 1`
  expect(att!.ref_id).toContain(':clickerclaw:')
  expect(att!.n).toBeGreaterThanOrEqual(5)
  const refs = (att!.items as { ref: string }[]).map((i) => i.ref)
  expect(new Set(refs).size).toBe(refs.length)
  await noHorizontalScroll(page)
  await shot('boss-run')

  // Saklar orang tua: Math mati berarti lawan Math tidak ditawarkan dan tidak bisa dimulai lewat alamatnya.
  await sql`insert into learner_feature (org_id, learner_id, key, enabled) values (${org}, ${aisha}, 'math', false) on conflict (learner_id, key) do update set enabled = false`
  await page.goto('/world/boss')
  await expect(page.getByRole('button', { name: /Clickerclaw/ })).toHaveCount(0)
  await page.goto('/world/boss/start?b=clickerclaw')
  await waitForPath(page, (p) => p === '/world/boss')
  await sql`delete from learner_feature where learner_id = ${aisha} and key = 'math'`
  // Lawan yang belum datang juga tidak bisa dimulai lewat alamatnya.
  await page.goto('/world/boss/start?b=aurora')
  await waitForPath(page, (p) => p === '/world/boss')

  // Hasil: menang memberi momen kartu, kalah menawarkan tanding ulang dan tidak mengurangi apa pun.
  const items = att!.items as object[]
  const [won] = await sql`insert into attempt (org_id, learner_id, kind, mode, subject, title, ref_id, items, status, submitted_at, score_raw, score_max, result) values (${org}, ${aisha}, 'test', 'latihan', 'math', 'Clickerclaw', 'boss:2026-01-05:clickerclaw:1', ${sql.json(items as never)}, 'submitted', now(), ${items.length}, ${items.length}, ${sql.json({ boss: { won: true, stars: 10, cardId: 'bs-clickerclaw' } } as never)}) returning id`
  await page.goto(`/world/boss/result/${won!.id}`)
  await expect(page.getByRole('heading', { level: 1, name: 'You beat Clickerclaw!' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'A new rare card!' })).toBeVisible()
  await expectNoSeriousA11y(page, 'Hasil menang')
  await noHorizontalScroll(page)
  await shot('boss-win')
  const [lost] = await sql`insert into attempt (org_id, learner_id, kind, mode, subject, title, ref_id, items, status, submitted_at, score_raw, score_max, result) values (${org}, ${aisha}, 'test', 'latihan', 'math', 'Clickerclaw', 'boss:2026-01-05:clickerclaw:2', ${sql.json(items as never)}, 'submitted', now(), 1, ${items.length}, ${sql.json({ boss: { won: false, stars: 0, cardId: null } } as never)}) returning id`
  await page.goto(`/world/boss/result/${lost!.id}`)
  await expect(page.getByRole('link', { name: 'Friendly rematch' })).toBeVisible()
  await expect(page.getByText('Nothing was lost')).toBeVisible()
  await expectNoSeriousA11y(page, 'Hasil kalah')
  await noHorizontalScroll(page)
  await shot('boss-lose')

  // Ruang piala: medali dari orang tua dan segel streak.
  await page.goto('/world/trophies')
  await expect(page.getByRole('heading', { level: 1, name: 'Trophy room' })).toBeVisible()
  await expect(page.getByText('OSN tingkat sekolah')).toBeVisible()
  await expectNoSeriousA11y(page, 'Ruang piala')
  await noHorizontalScroll(page)
  await shot('trophies')

  // Sertifikat ditolak bila streak belum mencapai tonggaknya.
  const res = await page.request.get('/world/certificate/100')
  expect(res.status()).toBe(404)

  expect(errors).toEqual([])
})
