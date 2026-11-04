import { chromium, families, newCtx, OUT, PHONE, qa, sql, TABLET, WEBVIEW_UA } from './lib'
import { ensureToday } from './a2-sessions'
async function one(b: import('@playwright/test').Browser, grade: number, vp: { width: number; height: number }, ua: string | undefined) {
  const f = families().find((x) => x.grade === grade)!
  const ctx = await newCtx(b, { viewport: vp, ua, tag: 't-audio3', state: `${OUT}/state-g${grade}.json` })
  const page = await ctx.newPage()
  let today = ''
  page.on('response', async (r) => { if (r.url().endsWith('/api/tts/today')) today = `${r.status()} ${(await r.text().catch(() => '')).slice(0, 70)}` })
  await ensureToday(page, f)
  await page.goto('/world/story')
  await page.waitForTimeout(800)
  await page.locator('main section button, main button.flex').first().click()
  await page.waitForTimeout(1200)
  const btns = await page.evaluate(() => Array.from(document.querySelectorAll('main button')).map((b) => `${b.getAttribute('aria-label') ?? ''}|${(b as HTMLElement).innerText.trim().slice(0, 18)}|${(b as HTMLButtonElement).disabled}`).filter((x) => !/^\|[a-zA-Z,.']+\|false$/.test(x)).slice(0, 14))
  const url = page.url()
  const sp = page.getByRole('button', { name: f.lang === 'en' ? /Read aloud/ : /Bacakan/ }).first()
  const vis = await sp.isVisible().catch(() => false)
  if (vis) await sp.click().catch(() => {})
  await page.waitForTimeout(2500)
  const q = await qa(page)
  console.log(JSON.stringify({ grade, w: vp.width, ua: !!ua, base: new URL(url).port, today, vis, plays: q.clips.length, errs: q.clipErrors.slice(0, 2), btns }))
  await ctx.close()
}
async function main() {
  const b = await chromium.launch()
  await one(b, 4, TABLET, undefined)
  await one(b, 4, PHONE, undefined)
  await one(b, 4, PHONE, WEBVIEW_UA)
  await one(b, 6, TABLET, undefined)
  await one(b, 6, PHONE, undefined)
  await b.close(); await sql.end()
}
main().catch((e) => { console.error(String(e).slice(0, 500)); process.exit(1) })
