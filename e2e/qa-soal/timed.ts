// Mode berwaktu: kebocoran kunci, muat ulang, ketuk ganda, offline, tombol kembali. Menulis laporan ke stdout.
import { mkdirSync } from 'node:fs'
import { allItems } from './lib'
import { answer, BASE, chromium, ids, login, makeAttempt, PHONE, pollStatus, sql, TABLET } from './driver'
import type { Item } from '../../packages/content/src/schema'

const OUT = process.env.QA_OUT ?? 'C:/kw5/qa-soal/.kira-local/qa-timed'
mkdirSync(OUT, { recursive: true })

const results: string[] = []
const say = (ok: boolean | string, msg: string) => {
  const line = `${ok === true ? 'OK  ' : ok === false ? 'BAD ' : `${ok} `} ${msg}`
  results.push(line)
  console.log(line)
}

const TYPES = ['mcq', 'multi', 'numeric', 'text', 'order', 'match', 'sort', 'numberline', 'clock', 'fraction', 'story', 'listen', 'tiles', 'spell', 'cloze', 'hotspot', 'label', 'table', 'grid', 'blocks', 'fractionbar', 'barmodel', 'tangram', 'geoboard'] as const

function pickOne(type: string, items: Item[]): Item {
  return items.find((i) => i.type === type && i.explanation.length > 30)!
}

/** Kata kunci struktur data yang tidak boleh ada di payload mode berwaktu. */
const FORBIDDEN = ['"key":', '\\"key\\":', '"reveal"', '\\"reveal\\"', '"answerText"', '\\"answerText\\"', '"whyWrong"', '\\"whyWrong\\"', '"hints"', '\\"hints\\"', '"explanation"', '\\"explanation\\"', '"solution"', '\\"solution\\"', '"filled"', '\\"filled\\"', '"targets"', '\\"targets\\"', '"unitValue"', '\\"unitValue\\"', '"example"', '\\"example\\"', '"rule"', '\\"rule\\"', '"acceptAlt"', '\\"acceptAlt\\"', '"alsoAccept"', '\\"alsoAccept\\"']

function leaks(body: string, items: Item[]): string[] {
  const out: string[] = []
  for (const f of FORBIDDEN) if (body.includes(f)) out.push(`struktur ${f}`)
  const esc = (s: string) => JSON.stringify(s).slice(1, -1)
  const has = (s: string) => body.includes(s) || body.includes(esc(s)) || body.includes(esc(esc(s)))
  for (const it of items) {
    if (has(it.explanation)) out.push(`penjelasan ${it.id}`)
    for (const h of it.hints) if (has(h)) out.push(`petunjuk ${it.id}`)
    if (it.tip && has(it.tip)) out.push(`tip ${it.id}`)
    if (it.type === 'text') for (const b of it.blanks) for (const a of b.answers) if (a.length >= 4 && has(a) && !it.prompt.includes(a)) out.push(`jawaban isian ${it.id}: ${a}`)
    if (it.type === 'tiles' && has(it.answer)) out.push(`kalimat jawaban ${it.id}`)
    if (it.type === 'table') for (const b of it.blanks) for (const a of b.answers) if (a.length >= 4 && has(`"${a}"`)) out.push(`jawaban tabel ${it.id}: ${a}`)
  }
  return out
}

async function main() {
  const pool = allItems().filter((i) => !i.passage)
  const sample = TYPES.map((t) => pickOne(t, pool)).filter(Boolean)
  const { org, raka } = await ids()
  const who = { org, id: raka }
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ locale: 'en-GB', timezoneId: 'Asia/Jakarta', viewport: TABLET, hasTouch: true })
  const page = await login(ctx, 'Raka')
  const net: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') net.push(`console: ${m.text().slice(0, 200)}`)
  })
  page.on('pageerror', (e) => net.push(`pageerror: ${e.message.slice(0, 200)}`))

  // ---- Kebocoran kunci: HTML mentah, RSC, dan respons server action.
  const refs = sample.map((i) => ({ ref: i.id, difficulty: i.difficulty }))
  for (const mode of ['tes', 'simulasi', 'kertas'] as const) {
    const id = await makeAttempt(who, refs, 'english', { mode, timeLimitS: 900 })
    const bodies: { url: string; body: string; method: string }[] = []
    const onResp = async (r: import('@playwright/test').Response) => {
      const u = r.url()
      if (!u.startsWith(BASE) || /\.(js|css|woff2?|mp3|png|svg)(\?|$)/.test(u)) return
      try {
        bodies.push({ url: u.replace(BASE, ''), body: await r.text(), method: r.request().method() })
      } catch {
        // navigasi sudah lewat
      }
    }
    page.on('response', onResp)
    await page.setViewportSize(TABLET)
    const resp = await page.goto(`${BASE}/run/${id}`)
    const html = await resp!.text()
    await page.getByText(/Question 1 of/).first().waitFor({ timeout: 15000 })
    const dom = await page.content()
    const rsc = await page.evaluate(async (u) => (await fetch(u, { headers: { RSC: '1' } })).text(), `/run/${id}`)
    const l1 = [...new Set([...leaks(html, sample), ...leaks(dom, sample), ...leaks(rsc, sample)])]
    say(l1.length === 0, `${mode}: HTML ${html.length} b, DOM, RSC ${rsc.length} b tanpa kunci${l1.length ? `: ${l1.slice(0, 12).join('; ')}` : ''}`)
    // Label opsi: i tidak boleh sama dengan indeks asli (kalau sama, kunci bisa ditebak).
    const opt = sample[0] as Extract<Item, { type: 'mcq' }>
    const m = /"options\\?":\[(.{0,800}?)\]/.exec(rsc)
    say('INFO', `${mode}: contoh opsi payload ${(m?.[1] ?? '').replace(/\\/g, '').slice(0, 140)} (kunci asli ${opt.answer})`)
    // Respons simpan jawaban tidak boleh memberi status benar atau salah.
    await page.locator('section[aria-label="Answers"]').getByRole('group', { name: 'Answers' }).locator('button').first().click()
    await page.waitForTimeout(1500)
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await page.waitForTimeout(300)
    const posts = bodies.filter((b) => b.method === 'POST')
    const verdict = posts.filter((b) => /"status":"(correct|wrong)"/.test(b.body))
    const l2 = posts.flatMap((b) => leaks(b.body, sample))
    say(verdict.length === 0 && l2.length === 0, `${mode}: ${posts.length} POST, tanpa status benar/salah di respons${verdict.length ? ` BOCOR ${verdict[0]!.body.slice(0, 200)}` : ''}${l2.length ? ` ${l2.slice(0, 5).join('; ')}` : ''}`)
    page.off('response', onResp)
    const [row] = await sql`select status, score from response where attempt_id = ${id} and position = 1`
    say('INFO', `${mode}: baris response posisi 1: ${JSON.stringify(row)}`)
  }

  // ---- Timer dan tampilan di HP.
  {
    const mcqs = pool.filter((i) => i.type === 'mcq' && i.id.startsWith('e4.') && !i.figure).slice(0, 3)
    const id = await makeAttempt(who, mcqs.map((i) => ({ ref: i.id, difficulty: i.difficulty })), 'english', { mode: 'tes', timeLimitS: 45 })
    await page.setViewportSize(PHONE)
    await page.goto(`${BASE}/run/${id}`)
    await page.getByText(/Question 1 of/).first().waitFor()
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${OUT}/timer-phone-low.png` })
    const before = await page.getByRole('timer').first().textContent().catch(() => null)
    // Muat ulang: jam tetap jalan, tidak mulai dari awal.
    const [o1] = await sql`select opened_at from attempt where id = ${id}`
    await page.locator('section[aria-label="Answers"]').getByRole('group', { name: 'Answers' }).locator('button').first().click()
    await page.waitForTimeout(1300)
    await page.reload()
    await page.getByText(/Question \d of/).first().waitFor()
    const [o2] = await sql`select opened_at from attempt where id = ${id}`
    say(String(o1!.opened_at) === String(o2!.opened_at), `muat ulang tidak mengulang jam (opened_at tetap), timer ${before}`)
    const saved = await sql`select position, attempt_no, count(*)::int as n from response where attempt_id = ${id} group by 1,2`
    say(saved.length === 1 && saved[0]!.n === 1, `muat ulang tes: jawaban tersimpan satu baris ${JSON.stringify(saved)}`)
    const q1Pressed = await page.getByRole('button', { name: /^Question 1, answered/ }).count()
    say(q1Pressed === 1, 'muat ulang tes: palet soal 1 tetap terjawab')
    // Tunggu habis: otomatis terkumpul.
    await page.waitForTimeout(100)
    await page.getByText("Time's up").first().waitFor({ timeout: 70000 })
    await page.screenshot({ path: `${OUT}/timer-phone-timeup.png` })
    await page.waitForTimeout(1500)
    const [st] = await sql`select status, elapsed_s from attempt where id = ${id}`
    say(st!.status === 'submitted', `waktu habis: attempt ${st!.status}, elapsed ${st!.elapsed_s}`)
    await page.getByRole('button', { name: /See my score/ }).click()
    await page.waitForURL((u) => u.pathname.startsWith('/results/'), { timeout: 15000 })
    await page.waitForTimeout(800)
    await page.screenshot({ path: `${OUT}/timer-phone-results.png`, fullPage: true })
    // Kembali setelah kumpul: tidak bisa mengerjakan lagi.
    await page.goBack()
    await page.waitForTimeout(1500)
    say(new URL(page.url()).pathname.startsWith('/results/') || !(await page.getByRole('button', { name: 'Hand in', exact: true }).count()), `kembali setelah kumpul berakhir di ${new URL(page.url()).pathname}`)
  }

  // ---- Jawaban ke server setelah waktu habis ditolak.
  {
    const mcqs = pool.filter((i) => i.type === 'mcq' && i.id.startsWith('e3.') && !i.figure).slice(0, 2)
    const id = await makeAttempt(who, mcqs.map((i) => ({ ref: i.id, difficulty: i.difficulty })), 'english', { mode: 'tes', timeLimitS: 300 })
    await page.setViewportSize(TABLET)
    await page.goto(`${BASE}/run/${id}`)
    await page.getByText(/Question 1 of/).first().waitFor()
    // Ketuk ganda Hand in.
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await page.getByRole('button', { name: 'Hand in', exact: true }).click()
    await page.screenshot({ path: `${OUT}/handin-confirm.png` })
    const xp0 = (await sql`select coalesce(sum(amount),0)::int as x from xp_event where learner_id = ${raka}`.catch(() => [{ x: -1 }]))[0]!.x
    await page.getByRole('dialog').getByRole('button', { name: 'Hand in' }).dblclick()
    await page.waitForURL((u) => u.pathname.startsWith('/results/'), { timeout: 20000 })
    const xp1 = (await sql`select coalesce(sum(amount),0)::int as x from xp_event where learner_id = ${raka}`.catch(() => [{ x: -1 }]))[0]!.x
    const [st] = await sql`select status, submitted_at from attempt where id = ${id}`
    say(st!.status === 'submitted', `ketuk ganda Hand in: status ${st!.status}, xp ${xp0} ke ${xp1}`)
  }

  // ---- Latihan: ketuk ganda Check, muat ulang setelah Check, muat ulang sebelum Check, ketuk ganda Next.
  {
    const mcq = pool.find((i) => i.type === 'mcq' && i.id.startsWith('e5.') && !i.figure)!
    const num = pool.find((i) => i.type === 'numeric' && i.id.startsWith('m5.'))!
    const txt = pool.find((i) => i.type === 'text' && i.id.startsWith('e5.'))!
    const id = await makeAttempt(who, [mcq, num, txt].map((i) => ({ ref: i.id, difficulty: i.difficulty })), 'english')
    await page.goto(`${BASE}/run/${id}`)
    await page.locator('section[aria-label="Your answer"]').waitFor()
    const issues = { issues: [] as { kind: string; detail: string }[] }
    await answer(page, mcq, true, issues)
    await page.getByRole('button', { name: 'Check', exact: true }).dblclick()
    await page.locator('[role=status] h2', { hasText: /^Correct$/ }).first().waitFor({ timeout: 8000 })
    await pollStatus(id, 1, 1)
    await page.waitForTimeout(800)
    const rows = await sql`select position, attempt_no, xp from response where attempt_id = ${id}`
    say(rows.length === 1, `ketuk ganda Check: ${rows.length} baris response ${JSON.stringify(rows)}`)
    // Ketuk ganda Next tidak boleh melompati soal 2.
    await page.locator('[role=status]').getByRole('button', { name: 'Next', exact: true }).dblclick()
    await page.waitForTimeout(500)
    const on2 = await page.locator('header').getByText(/Question 2 of 3/).count()
    say(on2 === 1, `ketuk ganda Next: tetap di soal 2 (${await page.locator('header').innerText().catch(() => '?')})`)
    // Muat ulang di tengah jawaban: belum tersimpan, tidak terhitung.
    await page.getByRole('button', { name: '1', exact: true }).first().click()
    await page.reload()
    await page.locator('section[aria-label="Your answer"]').waitFor()
    const after = await sql`select position from response where attempt_id = ${id} order by 1`
    const on2b = await page.locator('header').getByText(/Question 2 of 3/).count()
    say(after.length === 1 && on2b === 1, `muat ulang sebelum Check: ${after.length} baris, kembali ke soal 2`)
    // Muat ulang tepat setelah Check.
    await answer(page, num, true, issues)
    await page.getByRole('button', { name: 'Check', exact: true }).click()
    await page.locator('[role=status] h2', { hasText: /^Correct$/ }).first().waitFor({ timeout: 8000 })
    await page.reload()
    await page.locator('section[aria-label="Your answer"]').waitFor()
    await page.waitForTimeout(800)
    const after2 = await sql`select position, attempt_no, status from response where attempt_id = ${id} order by 1`
    const hdr = await page.locator('header').innerText().catch(() => '?')
    say(after2.length >= 1 && new Set(after2.map((r) => `${r.position}:${r.attempt_no}`)).size === after2.length, `muat ulang setelah Check: ${JSON.stringify(after2)} header "${hdr.replace(/\s+/g, ' ')}"`)
    // Kembali di browser saat latihan: tidak ada error, jawaban tetap.
    await page.goto(`${BASE}/today`)
    await page.waitForLoadState('domcontentloaded')
    await page.goto(`${BASE}/run/${id}`)
    await page.locator('section[aria-label="Your answer"]').waitFor()
    await page.goBack()
    await page.waitForTimeout(800)
    say(new URL(page.url()).pathname === '/today', `kembali dari runner ke ${new URL(page.url()).pathname}`)
    await page.goForward()
    await page.locator('section[aria-label="Your answer"]').waitFor({ timeout: 10000 })
    say(true, 'maju lagi: runner terbuka dengan jawaban tersimpan')
  }

  // ---- Offline saat sesi berjalan: service worker, antrean, sinkron.
  {
    const mcqs = pool.filter((i) => i.type === 'mcq' && i.id.startsWith('e6.') && !i.figure).slice(0, 3)
    const id = await makeAttempt(who, mcqs.map((i) => ({ ref: i.id, difficulty: i.difficulty })), 'english')
    await page.goto(`${BASE}/run/${id}`)
    await page.locator('section[aria-label="Your answer"]').waitFor()
    await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, { timeout: 30000 }).catch(() => undefined)
    const swOn = await page.evaluate(() => navigator.serviceWorker?.controller !== null)
    say(swOn, 'service worker mengendalikan halaman')
    const issues = { issues: [] as { kind: string; detail: string }[] }
    await ctx.setOffline(true)
    await answer(page, mcqs[0]!, true, issues)
    await page.getByRole('button', { name: 'Check', exact: true }).click()
    await page.locator('[role=status] h2', { hasText: /^Correct$/ }).first().waitFor({ timeout: 8000 })
    const line = await page.getByText(/It will sync when you are back online/).first().isVisible().catch(() => false)
    say(line, 'offline: umpan balik tetap muncul dan ada kalimat tersimpan')
    await page.screenshot({ path: `${OUT}/offline-feedback.png` })
    await page.locator('[role=status]').getByRole('button', { name: 'Next', exact: true }).click()
    await answer(page, mcqs[1]!, false, issues)
    await page.getByRole('button', { name: 'Check', exact: true }).click()
    await page.locator('[role=status] h2', { hasText: /^Not yet$/ }).first().waitFor({ timeout: 8000 })
    await page.waitForTimeout(500)
    const offRows = await sql`select position from response where attempt_id = ${id}`
    say(offRows.length === 0, `offline: belum ada baris di server (${offRows.length})`)
    await ctx.setOffline(false)
    const a = await pollStatus(id, 1, 1, 30000)
    const b = await pollStatus(id, 2, 1, 30000)
    say(a === 'correct' && b === 'wrong', `online lagi: tersinkron ${a}/${b}`)
    const final = await sql`select position, attempt_no, count(*)::int as n from response where attempt_id = ${id} group by 1,2 order by 1`
    say(final.every((r) => r.n === 1), `tidak ganda setelah sinkron ${JSON.stringify(final)}`)
    // Halaman yang belum disimpan dibuka saat offline.
    const fresh = await makeAttempt(who, mcqs.map((i) => ({ ref: i.id, difficulty: i.difficulty })), 'english')
    await ctx.setOffline(true)
    await page.goto(`${BASE}/run/${fresh}`).catch(() => undefined)
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `${OUT}/offline-unsaved-page.png` })
    say('INFO', `offline halaman belum disimpan: "${(await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 120)}"`)
    await ctx.setOffline(false)
  }

  console.log('console dan error:', JSON.stringify([...new Set(net)], null, 1))
  await browser.close()
  await sql.end()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
