// Bacaan panjang di HP, soal jutaan di keypad, tabel, lembar umpan balik, tumpukan figur per jenis.
import { mkdirSync, writeFileSync } from 'node:fs'
import { allItems } from './lib'
import { answer, BASE, chromium, ids, layoutProbe, login, makeAttempt, PHONE, pollStatus, sheetProbe, sql, TABLET, type Page } from './driver'
import { generateItem, genRef } from '../../packages/content/src/math'
import type { Item } from '../../packages/content/src/schema'
import { loadContent } from '../../packages/content/src/load'

const OUT = 'C:/kw5/qa-soal/.kira-local/qa-reading'
mkdirSync(`${OUT}/fig`, { recursive: true })
const say = (ok: boolean | string, msg: string) => console.log(`${ok === true ? 'OK  ' : ok === false ? 'BAD ' : `${ok} `} ${msg}`)
const ref = (i: Item) => ({ ref: i.id, difficulty: i.difficulty })
const subjectOf = (i: Item) => (i.skill[0] === 'm' ? 'math' : i.skill[0] === 'e' ? 'english' : 'science')

async function main() {
  const items = allItems()
  const { index } = loadContent()
  const { org, raka } = await ids()
  const who = { org, id: raka }
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ locale: 'en-GB', timezoneId: 'Asia/Jakarta', viewport: PHONE, hasTouch: true })
  const page = await login(ctx, 'Raka')
  const errs: string[] = []
  page.on('pageerror', (e) => errs.push(e.message.slice(0, 200)))

  // ---- Jawaban jutaan: benar-benar diketik dan dinilai benar.
  const big = [items.find((i) => i.id === 'm6.add-subtract.001')!, generateItem(genRef('m6.multiply-written', 5, 'qa7')), items.find((i) => i.id === 'm6.percentages.702')!]
  for (const it of big) {
    const id = await makeAttempt(who, [ref(it)], subjectOf(it))
    await page.goto(`${BASE}/run/${id}`)
    await page.locator('section[aria-label="Your answer"]').waitFor()
    await answer(page, it, true, { issues: [] })
    await page.screenshot({ path: `${OUT}/big-${it.type}-${it.id.replace(/[:.]/g, '_')}.png` })
    await page.getByRole('button', { name: 'Check', exact: true }).click()
    await page.locator('[role=status] h2').first().waitFor()
    const s = await pollStatus(id, 1, 1)
    say(s === 'correct', `jawaban panjang ${it.id}: server ${s}`)
  }
  {
    const it = items.find((i) => i.id === 's4.earth-sun-moon.027')!
    const id = await makeAttempt(who, [ref(it)], subjectOf(it))
    await page.goto(`${BASE}/run/${id}`)
    await page.locator('section[aria-label="Your answer"]').waitFor()
    await answer(page, it, true, { issues: [] })
    await page.screenshot({ path: `${OUT}/table-mixed.png`, fullPage: true })
    await page.getByRole('button', { name: 'Check', exact: true }).click()
    await page.locator('[role=status] h2').first().waitFor()
    say((await pollStatus(id, 1, 1)) === 'correct', 'tabel jawaban campuran 10:00 a.m. bisa diketik dan benar')
  }

  // ---- Bacaan panjang: yang terpanjang di kelas 4 sampai 6.
  const longest = (g: string) =>
    items
      .filter((i) => i.passage && i.id.startsWith(g) && i.type === 'mcq')
      .sort((a, b) => (index.passages.get(b.passage!)?.text.length ?? 0) - (index.passages.get(a.passage!)?.text.length ?? 0))[0]! as Extract<Item, { type: 'mcq' }>
  for (const g of ['e4', 'e5', 'e6', 's5']) {
    const it = longest(g)
    if (!it) continue
    const len = index.passages.get(it.passage!)!.text.length
    const id = await makeAttempt(who, [ref(it)], subjectOf(it))
    await page.setViewportSize(PHONE)
    await page.goto(`${BASE}/run/${id}`)
    await page.locator('section[aria-label="Your answer"]').waitFor()
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${OUT}/passage-${g}-top.png` })
    const panel = page.locator('section[aria-label="Question"] section').first()
    const body = panel.locator('div[lang]').first()
    const m = await body.evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight, overflow: getComputedStyle(el).overflowY }))
    say(m.sh > m.ch, `${g} bacaan ${len} huruf: kotak ${m.ch} px, isi ${m.sh} px, gulir ${m.overflow}`)
    // Gulir bacaan ke tengah, lalu jawab, lalu kembali: posisi baca tetap.
    await body.evaluate((el) => {
      el.scrollTop = 300
    })
    const opt = page.getByRole('group', { name: 'Answers' }).locator('button').first()
    await opt.scrollIntoViewIfNeeded()
    await opt.click()
    await page.waitForTimeout(150)
    await page.screenshot({ path: `${OUT}/passage-${g}-answer.png` })
    const st = await body.evaluate((el) => el.scrollTop)
    say(Math.abs(st - 300) < 2, `${g} posisi baca tetap setelah memilih jawaban (${st})`)
    await page.evaluate(() => window.scrollTo(0, 0))
    const vis = await panel.evaluate((el) => el.getBoundingClientRect().top < window.innerHeight)
    say(vis, `${g} bacaan terjangkau lagi dengan gulir ke atas`)
    // Sembunyikan dan tampilkan.
    await panel.getByRole('button', { name: /Hide the text/ }).click()
    await page.waitForTimeout(100)
    const qVisible = await page.getByRole('group', { name: 'Answers' }).evaluate((el) => el.getBoundingClientRect().top < window.innerHeight)
    say(qVisible, `${g} Hide the text mendekatkan pilihan jawaban`)
    await page.screenshot({ path: `${OUT}/passage-${g}-hidden.png` })
    await panel.getByRole('button', { name: /Show the text/ }).click()
    // Salah dua kali: lembar panjang tetap terbaca, tombol Next terlihat.
    const it2 = it
    await page.reload()
    await page.locator('section[aria-label="Your answer"]').waitFor()
    for (let t = 0; t < 2; t++) {
      await answer(page, it2, false, { issues: [] })
      await page.getByRole('button', { name: 'Check', exact: true }).click()
      await page.locator('[role=status] h2', { hasText: /^Not yet$/ }).first().waitFor()
      if (t === 0) await page.getByRole('button', { name: 'Try again', exact: true }).click()
    }
    await page.waitForTimeout(400)
    const sheet = await sheetProbe(page)
    say(sheet.length === 0, `${g} lembar umpan balik di dalam layar ${JSON.stringify(sheet)}`)
    await page.screenshot({ path: `${OUT}/passage-${g}-revealed.png` })
    const next = page.locator('[role=status]').getByRole('button', { name: /^(Next|Finish)$/ }).first()
    const box = await next.boundingBox()
    say(!!box && box.y + box.height <= PHONE.height && box.y >= 0, `${g} tombol lanjut terlihat tanpa menggulir (y ${Math.round(box?.y ?? -1)})`)
    const heading = page.locator('[role=status] h2').first()
    const hb = await heading.boundingBox()
    say(!!hb && hb.y >= 0, `${g} judul lembar terlihat saat terbuka (y ${Math.round(hb?.y ?? -1)})`)
  }

  // ---- Lembar panjang pada soal terpanjang dengan penjelasan terpanjang.
  {
    const it = [...items].filter((i) => i.type === 'mcq' && !i.passage).sort((a, b) => b.explanation.length - a.explanation.length)[0]! as Extract<Item, { type: 'mcq' }>
    const id = await makeAttempt(who, [ref(it)], subjectOf(it))
    await page.goto(`${BASE}/run/${id}`)
    await page.locator('section[aria-label="Your answer"]').waitFor()
    for (let t = 0; t < 2; t++) {
      await answer(page, it, false, { issues: [] })
      await page.getByRole('button', { name: 'Check', exact: true }).click()
      await page.locator('[role=status] h2', { hasText: /^Not yet$/ }).first().waitFor()
      if (t === 0) await page.getByRole('button', { name: 'Try again', exact: true }).click()
    }
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${OUT}/longest-explanation.png` })
    const sheet = await sheetProbe(page)
    const scroller = await page.locator('[role=status] h2').first().evaluate((el) => {
      const p = el.closest('[role=status]')!.parentElement!
      return { sh: p.scrollHeight, ch: p.clientHeight, top: p.scrollTop }
    })
    say(sheet.length === 0, `penjelasan terpanjang ${it.explanation.length} huruf: ${JSON.stringify(scroller)} ${JSON.stringify(sheet)}`)
  }

  // ---- Figur: satu per jenis, di HP dan tablet, tumpukan untuk dilihat.
  const seen = new Map<string, Item>()
  for (const it of items) {
    const f = it.figure as { kind?: string } | undefined
    if (f?.kind && !seen.has(f.kind) && it.type !== 'label' && it.type !== 'hotspot') seen.set(f.kind, it)
  }
  const shots: string[] = []
  for (const [kind, it] of seen) {
    const id = await makeAttempt(who, [ref(it)], subjectOf(it))
    await page.setViewportSize(PHONE)
    await page.goto(`${BASE}/run/${id}`)
    await page.locator('section[aria-label="Your answer"]').waitFor()
    await page.waitForTimeout(120)
    const issues = await layoutProbe(page)
    const fig = page.locator('section[aria-label="Question"]')
    const file = `${OUT}/fig/${kind}.png`
    await fig.screenshot({ path: file }).catch(() => {})
    shots.push(kind)
    console.log(`     ${kind} ${it.id} ${issues.filter((i) => i.kind !== 'small-target').map((i) => `${i.kind}:${i.detail.slice(0, 40)}`).join(' | ')}`)
  }
  const html = `<!doctype html><body style="margin:0;background:#fff;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;font:12px sans-serif">${shots.map((k) => `<div><div>${k}</div><img style="width:100%" src="file:///${OUT}/fig/${k}.png"></div>`).join('')}</body>`
  writeFileSync(`${OUT}/figures.html`, html)
  const sheetPage = await browser.newPage({ viewport: { width: 1500, height: 1000 } })
  await sheetPage.goto(`file:///${OUT}/figures.html`)
  await sheetPage.waitForTimeout(800)
  await sheetPage.screenshot({ path: `${OUT}/figures-sheet.png`, fullPage: true })

  console.log('pageerror', JSON.stringify(errs))
  void TABLET
  await browser.close()
  await sql.end()
}
void ((_: Page) => 0)
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
