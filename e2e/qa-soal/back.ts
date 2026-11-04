// Tombol kembali setelah mengumpulkan, dan muat ulang tepat setelah Check lalu menjawab lagi: tidak ada skor ganda.
import { mkdirSync } from 'node:fs'
import { allItems } from './lib'
import { answer, BASE, chromium, ids, login, makeAttempt, PHONE, pollStatus, sql, TABLET } from './driver'

const OUT = 'C:/kw5/qa-soal/.kira-local/qa-back'
mkdirSync(OUT, { recursive: true })
const say = (ok: boolean | string, msg: string) => console.log(`${ok === true ? 'OK  ' : ok === false ? 'BAD ' : `${ok} `} ${msg}`)

async function main() {
  const pool = allItems().filter((i) => !i.passage && !i.figure)
  const { org, raka } = await ids()
  const who = { org, id: raka }
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ locale: 'en-GB', timezoneId: 'Asia/Jakarta', viewport: PHONE, hasTouch: true })
  const page = await login(ctx, 'Raka')
  const errs: string[] = []
  page.on('pageerror', (e) => errs.push(e.message.slice(0, 200)))

  // ---- Tes: kumpul, ke hasil, kembali.
  {
    const mcqs = pool.filter((i) => i.type === 'mcq' && i.id.startsWith('e3.')).slice(5, 7)
    const id = await makeAttempt(who, mcqs.map((i) => ({ ref: i.id, difficulty: i.difficulty })), 'english', { mode: 'tes', timeLimitS: 300 })
    await page.goto(`${BASE}/today`)
    await page.goto(`${BASE}/run/${id}`)
    await page.getByText(/Question 1 of/).first().waitFor()
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await page.getByRole('button', { name: 'Hand in', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Hand in' }).click()
    await page.waitForURL((u) => u.pathname.startsWith('/results/'), { timeout: 20000 })
    await page.waitForTimeout(800)
    await page.goBack()
    await page.waitForTimeout(2500)
    await page.screenshot({ path: `${OUT}/back-after-submit.png` })
    const path = new URL(page.url()).pathname
    const handIn = await page.getByRole('button', { name: 'Hand in', exact: true }).count()
    const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 120)
    say(path.startsWith('/results/') || handIn === 0, `kembali setelah kumpul: ${path}, tombol Hand in ${handIn}, isi "${body}"`)
    const [a] = await sql`select status from attempt where id = ${id}`
    say(a!.status === 'submitted', `attempt tetap ${a!.status}`)
    // Buka lagi alamat runner lewat tautan penuh.
    await page.goto(`${BASE}/run/${id}`)
    await page.waitForTimeout(1200)
    say(new URL(page.url()).pathname.startsWith('/results/'), `membuka runner yang sudah dikumpulkan berakhir di ${new URL(page.url()).pathname}`)
  }

  // ---- Latihan: Check lalu langsung muat ulang, jawab lagi: XP dan baris tidak ganda.
  {
    const it = pool.find((i) => i.type === 'numeric' && i.id.startsWith('m4.'))!
    const filler = pool.find((i) => i.type === 'mcq' && i.id.startsWith('e4.'))!
    const id = await makeAttempt(who, [it, filler].map((i) => ({ ref: i.id, difficulty: i.difficulty })), 'math')
    await page.setViewportSize(TABLET)
    await page.goto(`${BASE}/run/${id}`)
    await page.locator('section[aria-label="Your answer"]').waitFor()
    await answer(page, it, true, { issues: [] })
    const xpBefore = (await sql`select coalesce(sum(xp),0)::int as x from response where attempt_id = ${id}`)[0]!.x
    await page.getByRole('button', { name: 'Check', exact: true }).click()
    await page.reload()
    await page.locator('section[aria-label="Your answer"]').waitFor()
    await page.waitForTimeout(1200)
    const hdr = (await page.locator('header').innerText()).replace(/\s+/g, ' ')
    if (/Question 1 of 2/.test(hdr)) {
      // Kiriman pertama kalah balapan dengan muat ulang: anak menjawab lagi.
      await answer(page, it, true, { issues: [] })
      await page.getByRole('button', { name: 'Check', exact: true }).click()
      await page.locator('[role=status] h2').first().waitFor()
      await pollStatus(id, 1, 1)
      await page.waitForTimeout(800)
    }
    const rows = await sql`select position, attempt_no, xp from response where attempt_id = ${id}`
    say(rows.length === 1, `muat ulang tepat setelah Check: ${JSON.stringify(rows)}, xp awal ${xpBefore}, header "${hdr}"`)
  }

  // ---- Keluar lewat tombol X saat tes berjalan: dialog, jawaban tersimpan.
  {
    const mcqs = pool.filter((i) => i.type === 'mcq' && i.id.startsWith('e6.')).slice(3, 5)
    const id = await makeAttempt(who, mcqs.map((i) => ({ ref: i.id, difficulty: i.difficulty })), 'english', { mode: 'tes', timeLimitS: 300 })
    await page.goto(`${BASE}/run/${id}`)
    await page.getByText(/Question 1 of/).first().waitFor()
    await page.locator('section[aria-label="Answers"]').getByRole('group', { name: 'Answers' }).locator('button').first().click()
    await page.getByRole('button', { name: 'Exit and save' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Leave', exact: true }).click()
    await page.waitForURL((u) => u.pathname === '/today', { timeout: 15000 })
    const r = await sql`select position from response where attempt_id = ${id}`
    say(r.length === 1, `keluar saat tes: jawaban yang baru dipilih tersimpan (${r.length} baris)`)
  }

  say(errs.length === 0, `pageerror ${JSON.stringify(errs)}`)
  await browser.close()
  await sql.end()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
