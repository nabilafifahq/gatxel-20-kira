// Keadilan penilaian lewat layar sungguhan: huruf besar, spasi, koordinat, angka dengan satuan, ejaan Amerika, benar atau salah.
import { mkdirSync } from 'node:fs'
import { allItems } from './lib'
import { answer, BASE, chromium, ids, login, makeAttempt, PHONE, pollStatus, sql, TABLET, type Page } from './driver'
import type { Item } from '../../packages/content/src/schema'

const OUT = 'C:/kw5/qa-soal/.kira-local/qa-fair'
mkdirSync(OUT, { recursive: true })
const say = (ok: boolean | string, msg: string) => console.log(`${ok === true ? 'OK  ' : ok === false ? 'BAD ' : `${ok} `} ${msg}`)
const subjectOf = (i: Item) => (i.skill[0] === 'm' ? 'math' : i.skill[0] === 'e' ? 'english' : 'science')

async function typed(page: Page, who: { org: string; id: string }, it: Item, value: string, want: 'correct' | 'wrong') {
  const id = await makeAttempt(who, [{ ref: it.id, difficulty: it.difficulty }], subjectOf(it))
  await page.goto(`${BASE}/run/${id}`)
  await page.locator('section[aria-label="Your answer"]').waitFor()
  await page.getByRole('textbox', { name: 'Your answer' }).fill(value)
  await page.getByRole('button', { name: 'Check', exact: true }).click()
  await page.locator('[role=status] h2').first().waitFor()
  const shown = await page.locator('[role=status] h2').first().innerText()
  const s = await pollStatus(id, 1, 1, 20000)
  say(s === want && (want === 'correct') === (shown === 'Correct'), `${it.id} ketik ${JSON.stringify(value)}: server ${s}, layar ${shown}, harapan ${want}`)
}

async function main() {
  const items = allItems()
  const byId = (id: string) => items.find((i) => i.id === id)!
  const { org, raka } = await ids()
  const who = { org, id: raka }
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ locale: 'en-GB', timezoneId: 'Asia/Jakarta', viewport: PHONE, hasTouch: true })
  const page = await login(ctx, 'Raka')

  await typed(page, who, byId('s5.water-cycle.021'), '  VAPOUR  ', 'correct')
  await typed(page, who, byId('s5.water-cycle.021'), 'vapor', 'correct')
  await typed(page, who, byId('s5.water-cycle.021'), 'Water   Vapor.', 'correct')
  await typed(page, who, byId('s5.water-cycle.021'), 'steam', 'wrong')
  await typed(page, who, byId('m6.transformations.001'), '-3,-2', 'correct')
  await typed(page, who, byId('m6.transformations.001'), '( -3 , -2 )', 'correct')
  await typed(page, who, byId('m6.transformations.001'), '(3, -2)', 'wrong')
  await typed(page, who, byId('e3.text-features.025'), '12 kg', 'correct')
  await typed(page, who, byId('e3.text-features.025'), '13', 'wrong')
  await typed(page, who, byId('m6.time-timetables.001'), '5:15pm', 'correct')
  await typed(page, who, byId('m6.add-subtract-fractions.001'), '19/12', 'correct')
  await typed(page, who, byId('e1.capitals-full-stops.020'), 'the', 'wrong')
  await typed(page, who, byId('e1.capitals-full-stops.020'), 'The', 'correct')

  // Benar atau salah: dua kotak, keduanya bisa diketuk, dinilai benar.
  const tf = items.filter((i): i is Extract<Item, { type: 'mcq' }> => i.type === 'mcq' && i.options.length === 2 && i.options.every((o) => /^(true|false|yes|no)$/i.test(o.text ?? '')))
  const by: Record<string, number> = {}
  for (const i of tf) by[i.id.slice(0, 2)] = (by[i.id.slice(0, 2)] ?? 0) + 1
  say('INFO', `soal benar atau salah ${tf.length}: ${JSON.stringify(by)}`)
  const grades = [...new Set(tf.map((i) => i.id.slice(0, 2)))]
  for (const [n, g] of grades.entries()) {
    const it = tf.find((i) => i.id.startsWith(g))!
    for (const correct of [true, false]) {
      const id = await makeAttempt(who, [{ ref: it.id, difficulty: it.difficulty }], subjectOf(it))
      await page.setViewportSize(n % 2 === 0 ? PHONE : TABLET)
      await page.goto(`${BASE}/run/${id}`)
      await page.locator('section[aria-label="Your answer"]').waitFor()
      if (correct) await page.screenshot({ path: `${OUT}/tf-${g}-${n % 2 === 0 ? 375 : 800}.png` })
      await answer(page, it, correct, { issues: [] })
      await page.getByRole('button', { name: 'Check', exact: true }).click()
      await page.locator('[role=status] h2').first().waitFor()
      const s = await pollStatus(id, 1, 1, 20000)
      say(s === (correct ? 'correct' : 'wrong'), `benar atau salah ${it.id}: pilih ${correct ? 'benar' : 'salah'}, server ${s}`)
    }
  }
  await browser.close()
  await sql.end()
}
main().catch((e) => {
  console.error(String(e).slice(0, 500))
  process.exit(1)
})
