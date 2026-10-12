import { expect, test } from '@playwright/test'
import { closeDb, db, learnerId, loginAdult, mcqItems, seedOrgId, TUTOR, watchErrors } from './helpers'

test.afterAll(closeDb)

test('paper, kunci, dan LJK tercetak untuk tutor', async ({ page }) => {
  const errors = watchErrors(page)
  const org = await seedOrgId()
  const raka = await learnerId('Raka')
  const items = mcqItems('e2.', 4)
  const [p] = await db()`
    insert into paper (org_id, code, title, subject, grade, minutes, mode, item_refs, created_by)
    values (${org}, ${`P-E2E-${Date.now() % 100000}`}, 'Printed practice', 'english', 2, 15, 'kertas', ${items.map((i) => i.id)}, ${raka})
    returning id, code`
  const attemptItems = items.map((it, i) => ({ ref: it.id, section: 'core', position: i + 1, difficulty: it.difficulty }))
  const [a] = await db()`
    insert into attempt (org_id, learner_id, kind, ref_id, mode, subject, title, items, code)
    values (${org}, ${raka}, 'paper', ${p!.id}, 'kertas', 'english', 'Printed practice', ${db().json(attemptItems)}, ${`L-E2E-${Date.now() % 100000}`})
    returning id`

  await loginAdult(page, TUTOR)
  await page.setViewportSize({ width: 794, height: 1123 })

  await page.goto(`/cetak/paper/${p!.id}?learner=${raka}`)
  await expect(page.getByText('Printed practice').first()).toBeVisible()
  await expect(page.getByText(items[0]!.options[0]!.text!).first()).toBeVisible()

  await page.goto(`/cetak/kunci/${p!.id}`)
  await expect(page.getByText(items[0]!.options[items[0]!.answer]!.text!).first()).toBeVisible()

  await page.goto(`/cetak/ljk/${a!.id}`)
  await expect(page.locator('img[src^="data:image/png;base64"]').first()).toBeVisible()
  const pdf = await page.pdf({ format: 'A4' })
  expect(pdf.byteLength).toBeGreaterThan(5000)
  expect(errors.filter((e) => !e.includes('favicon'))).toEqual([])
})
