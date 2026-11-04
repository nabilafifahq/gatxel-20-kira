import { chromium, families, newCtx, OUT, sql, TABLET } from './lib'
import { ensureToday } from './a2-sessions'
async function main() {
  const f = families().find((x) => x.grade === 6)!
  const b = await chromium.launch()
  const ctx = await newCtx(b, { viewport: TABLET, tag: 't-pet', state: `${OUT}/state-g6.json` })
  const page = await ctx.newPage()
  await ensureToday(page, f)
  await page.goto('/world/friend')
  await page.waitForTimeout(800)
  for (const w of [800, 375]) {
    await page.setViewportSize({ width: w, height: 812 })
    await page.waitForTimeout(300)
    const r = await page.evaluate(() => {
      const p = document.querySelector('main p[role=status]') as HTMLElement | null
      const pet = document.querySelector('main button[aria-label] svg')?.getBoundingClientRect()
      if (!p) return null
      const s = getComputedStyle(p)
      const q = p.getBoundingClientRect()
      return { pos: s.position, top: s.top, left: s.left, bottom: s.bottom, w: q.width, y: q.y, h: q.height, cls: p.className.slice(0, 120), parentH: p.parentElement?.getBoundingClientRect().height, petY: pet?.y, petH: pet?.height }
    })
    console.log(w, JSON.stringify(r))
    await page.locator('main').first().screenshot({ path: `${OUT}/t-pet-${w}.png` })
  }
  await b.close(); await sql.end()
}
main().catch((e) => { console.error(String(e).slice(0, 500)); process.exit(1) })
