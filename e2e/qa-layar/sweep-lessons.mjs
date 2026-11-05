// Membuka setiap pelajaran di content/lessons dan menjalani setiap langkahnya pada beberapa lebar layar,
// lalu mengukur luapan per komponen. Hanya untuk stack lokal sekali pakai.
//   E2E_BASE_URL=http://localhost:3201 node e2e/qa-layar/sweep-lessons.mjs <berkas-laporan.json> [saring-skill] [--workers=4]
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { groupFindings, measureInPage } from './measure.mjs'
import { saveLearnerState } from './login.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3201'
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const REPORT = args[0] ?? 'lessons.json'
const FILTER = args[1] ?? ''
const WORKERS = Number(process.argv.find((a) => a.startsWith('--workers='))?.split('=')[1] ?? 4)
const SIZES = [
  { width: 390, height: 844 },
  { width: 375, height: 667 },
  { width: 360, height: 740 },
  { width: 768, height: 1024 },
]
const ROOT_SEL = '[data-jenjang]'

const lessons = []
const walk = (d) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (e.name.endsWith('.json')) {
      const j = JSON.parse(readFileSync(p, 'utf8'))
      if (!FILTER || new RegExp(FILTER).test(j.skill)) lessons.push({ skill: j.skill, steps: j.steps.length, checks: j.check?.length ?? 0 })
    }
  }
}
walk(join(ROOT, 'content', 'lessons'))

mkdirSync(dirname(REPORT), { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const state = `${REPORT}.state.json`
await saveLearnerState(browser, BASE, state)

const rows = []
const failed = []
let measured = 0
let doneLessons = 0
let stepsWalked = 0
const t0 = Date.now()
const queue = [...lessons]

async function worker() {
  const ctx = await browser.newContext({ storageState: state, viewport: SIZES[0], hasTouch: true, deviceScaleFactor: 1, locale: 'en-GB', timezoneId: 'Asia/Jakarta' })
  await ctx.route(/\/api\/(tts|audio)|\.(mp3|ogg|wav)(\?|$)/, (r) => r.abort())
  const page = await ctx.newPage()
  for (;;) {
    const l = queue.shift()
    if (!l) break
    try {
      await page.setViewportSize(SIZES[0])
      await page.goto(`${BASE}/lesson/${l.skill}`, { waitUntil: 'domcontentloaded', timeout: 45_000 })
      const next = page.getByRole('button', { name: /^(Next part|Bagian berikutnya)$/ })
      await next.waitFor({ timeout: 30_000 })
      // Semua langkah ditambah soal cek pertama, yang bisa dicapai tanpa menjawab.
      const parts = l.steps + (l.checks > 0 ? 1 : 0)
      for (let at = 0; at < parts; at++) {
        for (const size of SIZES) {
          await page.setViewportSize(size)
          const found = await page.evaluate(measureInPage, ROOT_SEL)
          measured++
          for (const f of found) rows.push({ ...f, width: size.width, where: `${l.skill}#${at + 1}` })
        }
        stepsWalked++
        if (at < parts - 1) await next.click({ timeout: 5000 })
      }
      doneLessons++
    } catch (e) {
      failed.push({ skill: l.skill, error: String(e).slice(0, 160) })
      console.log(`GAGAL ${l.skill}: ${String(e).slice(0, 120)}`)
    }
    if (doneLessons % 25 === 0 && doneLessons) console.log(`${doneLessons}/${lessons.length} pelajaran, ${stepsWalked} bagian, ${rows.length} temuan, ${Math.round((Date.now() - t0) / 1000)} dtk`)
  }
  await ctx.close()
}
await Promise.all(Array.from({ length: WORKERS }, () => worker()))
await browser.close()
const groups = groupFindings(rows)
writeFileSync(REPORT, JSON.stringify({ lessons: lessons.length, doneLessons, stepsWalked, measured, findings: rows.length, failed, groups }, null, 1))
console.log(`SELESAI: ${doneLessons}/${lessons.length} pelajaran, ${stepsWalked} bagian, ${measured} ukuran, ${rows.length} temuan, ${groups.length} komponen, ${failed.length} gagal, ${Math.round((Date.now() - t0) / 1000)} dtk`)
for (const g of groups.slice(0, 40)) {
  console.log(`${String(g.count).padStart(6)} ${g.kind} ${g.sig.slice(0, 110)}\n         e.g. ${g.examples[0].where} @${g.examples[0].width}: ${g.examples[0].text.slice(0, 40)} | ${g.examples[0].detail}`)
}
