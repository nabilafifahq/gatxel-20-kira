// Screenshot halaman untuk pemeriksaan visual.
// Pemakaian: node scripts/shot.mjs <url> <out.png> [lebar] [tinggi] [--full]
/* global document -- dipakai di dalam page.evaluate, yang berjalan di browser */
import { chromium } from '@playwright/test'

const [url, out, w = '1180', h = '820'] = process.argv.slice(2)
if (!url || !out) {
  console.error('Pemakaian: node scripts/shot.mjs <url> <out.png> [lebar] [tinggi] [--full]')
  process.exit(1)
}
const executablePath = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium'
const browser = await chromium.launch({ executablePath })
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: 1 })
const res = await page.goto(url, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await page.screenshot({ path: out, fullPage: process.argv.includes('--full') })
console.log(`${res?.status()} ${url} -> ${out}`)
await browser.close()
