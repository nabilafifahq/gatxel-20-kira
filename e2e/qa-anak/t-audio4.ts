import { chromium, families, newCtx, OUT, qa, sql, TABLET } from './lib'
import { ensureToday } from './a2-sessions'
async function main() {
  const b = await chromium.launch()
  for (const grade of [4, 2]) {
    const f = families().find((x) => x.grade === grade)!
    const ctx = await newCtx(b, { viewport: TABLET, tag: 't-audio4', state: `${OUT}/state-g${grade}.json` })
    const page = await ctx.newPage()
    await ensureToday(page, f)
    for (let i = 0; i < 2; i++) {
      const t0 = Date.now()
      const r = await page.evaluate(async () => { const t = performance.now(); const x = await fetch('/api/tts/today'); const j = await x.json(); return { s: x.status, ms: Math.round(performance.now() - t), en: j.enabled, urls: j.urls?.length, v: j.voiceVersion } })
      console.log('today', grade, JSON.stringify(r), Date.now() - t0)
    }
    await page.goto('/world/story')
    await page.waitForTimeout(600)
    await page.locator('main section button, main button.flex').first().click()
    await page.waitForTimeout(800)
    const t1 = Date.now()
    await page.getByRole('button', { name: f.lang === 'en' ? /Read aloud/ : /Bacakan/ }).first().click()
    let plays = 0
    while (Date.now() - t1 < 25000) { plays = (await qa(page)).clips.length; if (plays > 0) break; await page.waitForTimeout(100) }
    console.log('ketuk sampai bunyi', grade, Date.now() - t1, 'ms, putar', plays)
    await ctx.close()
  }
  await b.close(); await sql.end()
}
main().catch((e) => { console.error(String(e).slice(0, 500)); process.exit(1) })
