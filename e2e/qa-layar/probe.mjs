// Pemeriksaan cepat satu halaman di WebKit: posisi bilah bawah dan tangkapan layar tanpa gulir.
//   node e2e/qa-layar/probe.mjs <path> <file-png> <state.json> [lebar] [tinggi]
/* global document, window */
import { devices, webkit } from '@playwright/test'

const [path, out, state, w = '390', h = '664'] = process.argv.slice(2)
const BASE = process.env.E2E_HTTPS_BASE ?? 'https://localhost:3202'
const browser = await webkit.launch()
const { defaultBrowserType: _d, viewport: _v, ...phone } = devices['iPhone 13']
const ctx = await browser.newContext({ ...phone, viewport: { width: Number(w), height: Number(h) }, ignoreHTTPSErrors: true, storageState: state, locale: 'en-GB' })
const page = await ctx.newPage()
await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1800)
const info = await page.evaluate(() => {
  const navs = [...document.querySelectorAll('nav')].map((n) => {
    const r = n.getBoundingClientRect()
    return { label: n.getAttribute('aria-label'), top: Math.round(r.top), bottom: Math.round(r.bottom), pos: window.getComputedStyle(n).position, display: window.getComputedStyle(n).display }
  })
  return { url: window.location.pathname, inner: [window.innerWidth, window.innerHeight], scrollY: window.scrollY, docH: document.documentElement.scrollHeight, navs }
})
console.log(JSON.stringify(info))
await page.screenshot({ path: out })
await browser.close()
