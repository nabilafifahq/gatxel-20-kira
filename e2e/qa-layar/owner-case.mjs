// Tangkapan layar kasus pemilik: "Prefixes change meanings" langkah 3 pada lebar iPhone, Chromium dan WebKit.
//   E2E_BASE_URL=http://localhost:3201 node e2e/qa-layar/owner-case.mjs <folder> <awalan-nama> [skill] [langkah]
/* global document, getComputedStyle -- dipakai di dalam page.evaluate, yang berjalan di browser */
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, devices, webkit } from '@playwright/test'
import { saveLearnerState } from './login.mjs'

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3201'
const OUT = process.argv[2] ?? 'C:/kw5/layar-shots'
const PREFIX = process.argv[3] ?? 'after'
const SKILL = process.argv[4] ?? 'e3.prefixes'
const STEP = Number(process.argv[5] ?? 3)
mkdirSync(OUT, { recursive: true })

const b0 = await chromium.launch()
const state = join(OUT, `.${PREFIX}-state.json`)
await saveLearnerState(b0, process.env.E2E_LOGIN_BASE ?? BASE, state)
await b0.close()

for (const [engineName, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await engine.launch()
  const base = engineName === 'webkit' ? (process.env.E2E_HTTPS_BASE ?? 'https://localhost:3202') : BASE
  const { defaultBrowserType: _d, ...phone } = devices['iPhone 13']
  const ctx = await browser.newContext({ ...phone, viewport: { width: 390, height: 664 }, storageState: state, locale: 'en-GB', ignoreHTTPSErrors: true })
  const page = await ctx.newPage()
  await page.goto(`${base}/lesson/${SKILL}`, { waitUntil: 'domcontentloaded' })
  const next = page.getByRole('button', { name: /^(Next part|Bagian berikutnya)$/ })
  await next.waitFor({ timeout: 30_000 })
  // WebKit di mesin uji lebih lambat dari jari: tunggu React terpasang sebelum mengetuk.
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => Object.keys(b).some((k) => k.startsWith('__reactProps'))), null, { timeout: 30_000 })
  await page.waitForTimeout(300)
  for (let i = 1; i < STEP; i++) await next.click()
  await page.waitForTimeout(450)
  await page.screenshot({ path: join(OUT, `${PREFIX}-${SKILL}-step${STEP}-${engineName}-390.png`) })
  await page.screenshot({ path: join(OUT, `${PREFIX}-${SKILL}-step${STEP}-${engineName}-390-full.png`), fullPage: true })
  const box = await page.evaluate(() => {
    const show = document.querySelector('[data-lesson-show]') ?? [...document.querySelectorAll('span')].find((s) => /disagree, disobey/.test(s.textContent ?? ''))
    if (!show) return null
    return { text: show.textContent, clientH: show.clientHeight, scrollH: show.scrollHeight, clientW: show.clientWidth, scrollW: show.scrollWidth, font: getComputedStyle(show).fontSize, family: getComputedStyle(show).fontFamily.slice(0, 40) }
  })
  console.log(engineName, JSON.stringify(box))
  await browser.close()
}
