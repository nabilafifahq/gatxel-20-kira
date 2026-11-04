// Survei semua layar utama anak: tangkapan layar, tata letak, tautan, tombol, per kelas dan lebar.
import { writeFileSync } from 'node:fs'
import { chromium, families, layoutSweep, newCtx, OUT, say, sql } from './lib'
import { ensureToday } from './a2-sessions'

const ROUTES = ['/today', '/map', '/review', '/practice', '/practice/cards', '/practice/review', '/reading', '/english', '/quick-maths', '/quiz-arena', '/tools', '/my-words', '/fix-it', '/me', '/world', '/world/shop', '/world/friend', '/world/cards', '/world/story', '/world/boss', '/world/trophies', '/world/certificate', '/competitions', '/esmo', '/today/done', '/placement']

async function main() {
  const grade = Number(process.argv[2])
  const width = Number(process.argv[3] ?? 800)
  const height = width < 500 ? 812 : 1100
  const f = families().find((x) => x.grade === grade)!
  const b = await chromium.launch()
  const ctx = await newCtx(b, { viewport: { width, height }, tag: `survey-g${grade}-${width}`, state: `${OUT}/state-g${grade}.json` })
  const page = await ctx.newPage()
  await ensureToday(page, f)
  const dump: Record<string, unknown> = {}
  for (const r of ROUTES) {
    const resp = await page.goto(r, { waitUntil: 'domcontentloaded' }).catch((e) => {
      say(false, `g${grade} ${r} goto ${String(e).slice(0, 100)}`)
      return null
    })
    await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {})
    await page.waitForTimeout(350)
    const final = new URL(page.url()).pathname
    const tag = r.replace(/\//g, '_')
    await page.screenshot({ path: `${OUT}/sv-g${grade}-${width}${tag}.png`, fullPage: true })
    const sw = await layoutSweep(page)
    const text = (await page.locator('main, body').first().innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300)
    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll('main a, main button, a[href]'))
        .filter((e) => (e as HTMLElement).offsetParent !== null)
        .map((e) => `${e.tagName === 'A' ? (e as HTMLAnchorElement).getAttribute('href') : 'btn'} :: ${(e.getAttribute('aria-label') ?? (e as HTMLElement).innerText).trim().replace(/\s+/g, ' ').slice(0, 60)}`)
        .slice(0, 70),
    )
    dump[r] = { status: resp?.status(), final, text, links, sw }
    const sw2 = sw.filter((x) => !/^small 4[23]x44 "(Privasi|Syarat|Terms|Privacy)"/.test(x))
    say(sw2.length === 0 ? true : false, `g${grade} ${width} ${r} -> ${final} [${resp?.status()}] ${JSON.stringify(sw2.slice(0, 6))}`)
    if ((resp?.status() ?? 200) >= 400) say(false, `g${grade} ${r} status ${resp?.status()}`)
  }
  writeFileSync(`${OUT}/survey-g${grade}-${width}.json`, JSON.stringify(dump, null, 1))
  const q = await page.evaluate(() => (window as unknown as { __qa: { speak: string[] } }).__qa?.speak?.length ?? -1)
  say(q <= 0, `g${grade} ${width} survei suara perangkat ${q}`)
  await b.close()
  await sql.end()
}
main().catch((e) => {
  console.error(String(e).slice(0, 1000))
  process.exit(1)
})
