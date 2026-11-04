// Masuk pertama: PIN, tips, Today, tes penempatan.
import { chromium, families, layoutSweep, newCtx, OUT, PHONE, pinIn, qa, say, signUp, sql, TABLET, type Family } from './lib'
const NAMES: [number, string, 'id' | 'en'][] = [[1, 'Nara', 'id'], [2, 'Bima', 'en'], [3, 'Citra', 'id'], [4, 'Dewa', 'en'], [5, 'Eka', 'id'], [6, 'Farah', 'en']]
async function main() {
  const only = process.argv[2] ? process.argv[2].split(',').map(Number) : [1, 2, 3, 4, 5, 6]
  const b = await chromium.launch()
  for (const [grade, name, lang] of NAMES) {
    if (!only.includes(grade)) continue
    const ctx = await newCtx(b, { viewport: TABLET, tag: `first-g${grade}` })
    const page = await ctx.newPage()
    let f: Family | undefined = families().find((x) => x.grade === grade && x.name === name)
    if (f) { await sql`delete from org where false`; }
    const fresh = await signUp(page, { grade, name, lang, email: undefined })
    f = fresh
    await page.screenshot({ path: `${OUT}/g${grade}-1-pick.png` })
    await page.getByRole('link', { name: new RegExp(`^${name}, `) }).click()
    await page.waitForURL((u) => u.pathname.startsWith('/pin/'))
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${OUT}/g${grade}-2-pin.png`, fullPage: true })
    // Satu PIN salah dulu: pesan ramah?
    const wrong = lang === 'id' ? ['Bulan', 'Bulan', 'Bulan', 'Bulan'] : ['Moon', 'Moon', 'Moon', 'Moon']
    for (const p of wrong) await page.getByRole('button', { name: p, exact: true }).click()
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `${OUT}/g${grade}-2b-pin-wrong.png`, fullPage: true })
    const names = lang === 'id' ? ['Matahari', 'Bulan', 'Bintang', 'Kucing'] : ['Sun', 'Moon', 'Star', 'Cat']
    for (const p of names) await page.getByRole('button', { name: p, exact: true }).click()
    await page.waitForURL((u) => !u.pathname.startsWith('/pin/'), { timeout: 30000 })
    await page.waitForTimeout(1500)
    say('INFO', `g${grade} ${lang} setelah PIN: ${new URL(page.url()).pathname}`)
    await page.screenshot({ path: `${OUT}/g${grade}-3-today.png` })
    await page.screenshot({ path: `${OUT}/g${grade}-3-today-full.png`, fullPage: true })
    const tips = page.getByTestId('first-run-tips')
    const hasTips = await tips.isVisible().catch(() => false)
    say(hasTips, `g${grade} tips pertama tampil`)
    let n = 0
    while (hasTips && (await tips.isVisible().catch(() => false)) && n < 8) {
      n++
      const txt = (await tips.innerText()).replace(/\s+/g, ' ')
      say('INFO', `g${grade} tip ${n}: ${txt}`)
      await tips.getByRole('button').last().click()
      await page.waitForTimeout(250)
      if (n === 1) await page.screenshot({ path: `${OUT}/g${grade}-3b-tip2.png` })
    }
    const s = await qa(page)
    say(s.speak.length === 0, `g${grade} suara perangkat 0 (${s.speak.length})`)
    const sw = await layoutSweep(page)
    say(sw.length === 0, `g${grade} today tablet ${JSON.stringify(sw.slice(0, 6))}`)
    await page.setViewportSize(PHONE)
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${OUT}/g${grade}-3c-today-phone.png`, fullPage: true })
    const sw2 = await layoutSweep(page)
    say(sw2.length === 0, `g${grade} today phone ${JSON.stringify(sw2.slice(0, 6))}`)
    await ctx.storageState({ path: `${OUT}/state-g${grade}.json` })
    await ctx.close()
  }
  await b.close(); await sql.end()
}
main().catch((e) => { console.error(String(e).slice(0, 1200)); process.exit(1) })
