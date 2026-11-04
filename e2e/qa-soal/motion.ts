// Animasi dan stiker: maskot, konfeti, peti, lencana, naik level, pembahasan bergerak. Tiap animasi berakhir, tidak menghalangi
// ketukan, tenang dengan reduced motion, tanpa lompatan tata letak, dan semua gambar termuat.
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { allItems, ROOT } from './lib'
import { answer, BASE, chromium, ids, login, makeAttempt, PHONE, sql, TABLET, type Page } from './driver'
import type { BrowserContext } from '@playwright/test'

const OUT = 'C:/kw5/qa-soal/.kira-local/qa-motion'
mkdirSync(OUT, { recursive: true })
const say = (ok: boolean | string, msg: string) => console.log(`${ok === true ? 'OK  ' : ok === false ? 'BAD ' : `${ok} `} ${msg}`)

/** Rujukan aset statis di kode dan konten: berkas di public/ harus ada. */
function scanStatic() {
  const pub = join(ROOT, 'apps/web/public')
  const refs = new Map<string, string>()
  const re = /["'`(]\/((?:icons|maps|flags|sounds|fonts|dict|stickers|badges|images|img|world|books|art)\/[A-Za-z0-9_./-]+\.[a-z0-9]{2,5})/g
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f)
      if (f === 'node_modules' || f === '.next' || f === 'public') continue
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(tsx?|json|css|js|mjs)$/.test(f)) {
        for (const m of readFileSync(p, 'utf8').matchAll(re)) refs.set(m[1]!, p.replace(ROOT, ''))
      }
    }
  }
  for (const d of ['apps/web/src', 'packages/figures/src', 'packages/content/src', 'content']) walk(join(ROOT, d))
  const missing = [...refs].filter(([r]) => !existsSync(join(pub, r)))
  say(missing.length === 0, `aset statis dirujuk ${refs.size}, hilang ${missing.length} ${JSON.stringify(missing.slice(0, 10))}`)
  // Berkas suara dari daftar sfx.
  const sfx = readFileSync(join(ROOT, 'apps/web/src/components/learner/sfx.ts'), 'utf8')
  const miss: string[] = []
  let total = 0
  for (const m of sfx.matchAll(/clips\('([a-z0-9]+)', (\d+)/g)) for (let i = 1; i <= Number(m[2]); i++) {
    total++
    if (!existsSync(join(pub, 'sounds', `${m[1]}-${i}.mp3`))) miss.push(`${m[1]}-${i}`)
  }
  say(miss.length === 0, `berkas bunyi ${total}, hilang ${miss.length} ${miss.join(',')}`)
}

function watch(page: Page, bag: string[]) {
  page.on('response', (r) => {
    if (r.status() >= 400 && !r.url().includes('/api/heartbeat')) bag.push(`HTTP ${r.status()} ${r.url().replace(BASE, '')}`)
  })
  page.on('requestfailed', (r) => {
    const f = r.failure()?.errorText ?? ''
    if (!f.includes('ERR_ABORTED')) bag.push(`failed ${f} ${r.url().replace(BASE, '')}`)
  })
  page.on('pageerror', (e) => bag.push(`pageerror ${e.message.slice(0, 200)}`))
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('429')) bag.push(`console ${m.text().slice(0, 200)}`)
  })
}

const CLS = `
  window.__cls = 0; window.__shifts = [];
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) { if (!e.hadRecentInput) { window.__cls += e.value; window.__shifts.push(Math.round(e.value * 1000) / 1000) } } }).observe({ type: 'layout-shift', buffered: true }) } catch {}
`

/** Elemen hiasan penuh layar yang masih ada dan masih menangkap ketukan. */
async function blocker(page: Page) {
  return page.evaluate(() => {
    const pts = [[window.innerWidth / 2, window.innerHeight / 2], [40, 40], [window.innerWidth - 40, window.innerHeight - 40]]
    const out: string[] = []
    for (const [x, y] of pts) {
      const el = document.elementFromPoint(x!, y!)
      const f = el?.closest('.fixed, canvas')
      if (f && !f.closest('dialog,[role=dialog],[role=alertdialog]') && (f as HTMLElement).offsetWidth >= window.innerWidth * 0.9 && (f as HTMLElement).offsetHeight >= window.innerHeight * 0.8) out.push(`${f.tagName}.${String(f.getAttribute('class')).slice(0, 60)}`)
    }
    return out
  })
}

const running = (page: Page) => page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && (a.effect?.getComputedTiming().iterations ?? 1) === Infinity).length)

async function fullSession(page: Page, who: { org: string; id: string }, tag: string, reduced: boolean) {
  const items = allItems().filter((i) => i.type === 'mcq' && i.id.startsWith('e4.') && !i.figure && !i.passage).slice(30, 35)
  const id = await makeAttempt(who, items.map((i) => ({ ref: i.id, difficulty: i.difficulty })), 'english')
  await page.goto(`${BASE}/run/${id}`)
  await page.locator('section[aria-label="Your answer"]').waitFor()
  for (let n = 0; n < items.length; n++) {
    await answer(page, items[n]!, true, { issues: [] })
    await page.getByRole('button', { name: 'Check', exact: true }).click()
    await page.locator('[role=status] h2', { hasText: /^Correct$/ }).first().waitFor()
    if (n === 2) await page.screenshot({ path: `${OUT}/${tag}-combo.png` })
    await page.locator('[role=status]').getByRole('button', { name: /^(Next|Finish)$/ }).first().click()
    if (n < items.length - 1) await page.locator('header').getByText(new RegExp(`Question ${n + 2} of|${n + 2}/`)).locator('visible=true').first().waitFor()
  }
  await page.waitForURL((u) => u.pathname.startsWith('/results/'), { timeout: 20000 })
  await page.waitForTimeout(300)
  const canvas = await page.locator('canvas').count()
  await page.screenshot({ path: `${OUT}/${tag}-results-300ms.png` })
  const b1 = await blocker(page)
  say(b1.length === 0, `${tag}: konfeti tidak menghalangi ketukan (kanvas ${canvas}) ${JSON.stringify(b1)}`)
  await page.waitForTimeout(5000)
  await page.screenshot({ path: `${OUT}/${tag}-results-5s.png`, fullPage: true })
  const canvasAfter = await page.locator('canvas').count()
  const overlay = await page.getByText(/Level \d+/).count()
  say(canvasAfter === 0, `${tag}: konfeti selesai setelah 5 detik (kanvas ${canvasAfter}, teks level ${overlay})`)
  const inf = await running(page)
  if (reduced) say(inf === 0, `${tag}: reduced motion, animasi tanpa akhir ${inf}`)
  else say('INFO', `${tag}: animasi berulang tanpa akhir yang masih jalan ${inf}`)
  const back = page.getByRole('link', { name: /Back to Today/ }).or(page.getByRole('button', { name: /Back to Today/ })).first()
  await back.click({ timeout: 8000 })
  await page.waitForURL((u) => u.pathname === '/today', { timeout: 15000 })
  say(true, `${tag}: tombol di hasil bisa diketuk setelah animasi`)
}

async function crawl(page: Page, bag: string[], tag: string) {
  const pages = ['/today', '/map', '/me', '/practice', '/practice/cards', '/english', '/reading', '/tools', '/quiz-arena', '/competitions', '/my-words', '/fix-it', '/world', '/world/shop', '/world/cards', '/world/friend', '/world/boss', '/review', '/quick-maths']
  for (const p of pages) {
    const start = bag.length
    const r = await page.goto(`${BASE}${p}`, { waitUntil: 'domcontentloaded' }).catch(() => null)
    await page.waitForTimeout(900)
    const broken = await page.evaluate(() => Array.from(document.images).filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src))
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    const svgs = await page.evaluate(() => document.querySelectorAll('svg').length)
    await page.screenshot({ path: `${OUT}/${tag}${p.replace(/\//g, '_')}.png` }).catch(() => {})
    console.log(`     ${tag} ${p}: ${r?.status()} akhir ${new URL(page.url()).pathname}, gambar rusak ${broken.length}, svg ${svgs}, lebih lebar ${over}, error baru ${bag.length - start}`)
    if (broken.length) bag.push(`broken ${p}: ${broken.slice(0, 3).join(',')}`)
    if (over > 1) bag.push(`overflow ${p}: ${over}`)
  }
}

async function main() {
  scanStatic()
  const { org, raka, aisha } = await ids()
  // Cukup XP supaya sesi ini melewati naik level (lewat data, bukan lewat jalan pintas tampilan).
  const browser = await chromium.launch()
  const bag: string[] = []

  // ---- Gerak normal, tablet, dan layout shift.
  const ctx: BrowserContext = await browser.newContext({ locale: 'en-GB', timezoneId: 'Asia/Jakarta', viewport: TABLET, hasTouch: true })
  await ctx.addInitScript(CLS)
  const page = await login(ctx, 'Raka')
  watch(page, bag)
  await fullSession(page, { org, id: raka }, 'normal', false)
  await page.goto(`${BASE}/today`)
  await page.waitForTimeout(1500)
  const cls = await page.evaluate(() => ({ cls: (window as unknown as { __cls: number }).__cls, s: (window as unknown as { __shifts: number[] }).__shifts }))
  say(cls.cls < 0.1, `today: lompatan tata letak ${cls.cls.toFixed(3)}`)
  // Layout shift di runner saat lembar umpan balik terbuka.
  const items = allItems().filter((i) => i.type === 'mcq' && i.id.startsWith('e5.') && !i.figure && !i.passage).slice(10, 12)
  const id = await makeAttempt({ org, id: raka }, items.map((i) => ({ ref: i.id, difficulty: i.difficulty })), 'english')
  for (const vp of [TABLET, PHONE]) {
    const fresh = await makeAttempt({ org, id: raka }, items.map((i) => ({ ref: i.id, difficulty: i.difficulty })), 'english')
    await page.setViewportSize(vp)
    await page.goto(`${BASE}/run/${fresh}`)
    await page.locator('section[aria-label="Your answer"]').waitFor()
    await page.waitForTimeout(800)
    await page.evaluate(() => {
      ;(window as unknown as { __cls: number }).__cls = 0
    })
    await answer(page, items[0]!, true, { issues: [] })
    await page.getByRole('button', { name: 'Check', exact: true }).click()
    await page.locator('[role=status] h2', { hasText: /^Correct$/ }).first().waitFor()
    await page.waitForTimeout(800)
    const c = await page.evaluate(() => (window as unknown as { __cls: number }).__cls)
    say(c < 0.1, `runner ${vp.width}: lompatan tata letak saat umpan balik ${c.toFixed(3)}`)
  }
  void id
  await page.setViewportSize(TABLET)

  // ---- Pembahasan bergerak, soal bergambar: terbuka, langkah berjalan, tutup, soal serupa.
  {
    const withSolution = allItems().find((i) => i.solution && i.solution.some((s) => s.anim) && i.type === 'mcq') ?? allItems().find((i) => i.solution && i.type === 'mcq')!
    const a = await makeAttempt({ org, id: raka }, [{ ref: withSolution.id, difficulty: withSolution.difficulty }], withSolution.skill[0] === 'm' ? 'math' : withSolution.skill[0] === 'e' ? 'english' : 'science')
    await page.goto(`${BASE}/run/${a}`)
    await page.locator('section[aria-label="Your answer"]').waitFor()
    for (let t = 0; t < 2; t++) {
      await answer(page, withSolution, false, { issues: [] })
      await page.getByRole('button', { name: 'Check', exact: true }).click()
      await page.locator('[role=status] h2', { hasText: /^Not yet$/ }).first().waitFor()
      if (t === 0) await page.getByRole('button', { name: 'Try again', exact: true }).click()
    }
    await page.getByRole('button', { name: /Watch how it works/ }).click({ timeout: 8000 })
    await page.getByRole('dialog').waitFor()
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `${OUT}/solution-dialog.png` })
    const stepsShown = await page.getByRole('dialog').innerText()
    say(stepsShown.length > 20, `pembahasan bergerak terbuka untuk ${withSolution.id}: "${stepsShown.replace(/\s+/g, ' ').slice(0, 90)}"`)
    const nextStep = page.getByRole('dialog').getByRole('button', { name: /Next|Next step/ }).first()
    if (await nextStep.count()) {
      await nextStep.click()
      await page.waitForTimeout(500)
      await page.screenshot({ path: `${OUT}/solution-dialog-2.png` })
    }
    await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).first().click()
    await page.waitForTimeout(600)
    const fix = await page.locator('[data-testid="remedial-panel"]').innerText().catch(() => '')
    say(fix.length > 0, `setelah pembahasan panel perbaikan: "${fix.replace(/\s+/g, ' ').slice(0, 80)}"`)
    const lesson = page.getByRole('button', { name: /One quick lesson/ })
    if (await lesson.count()) {
      await lesson.click()
      await page.getByRole('dialog').waitFor()
      await page.waitForTimeout(600)
      await page.screenshot({ path: `${OUT}/remedial-lesson.png` })
      await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).first().click()
      await page.waitForTimeout(400)
    }
    const like = page.getByRole('button', { name: /Try one like it/ })
    if (await like.count()) {
      await like.click()
      await page.waitForTimeout(1500)
      await page.screenshot({ path: `${OUT}/try-one-like-it.png` })
      const ans = await page.locator('section[aria-label="Your answer"]').count()
      const status = await page.locator('[role=status] h2').count()
      say(ans === 1 && status === 0, 'Try one like it membuka soal serupa baru')
    }
  }

  // ---- Jelajah semua halaman learner di tablet dan HP.
  await crawl(page, bag, 'tablet')
  await page.setViewportSize(PHONE)
  await crawl(page, bag, 'phone')

  // ---- Reduced motion.
  const ctx2 = await browser.newContext({ locale: 'en-GB', timezoneId: 'Asia/Jakarta', viewport: PHONE, hasTouch: true, reducedMotion: 'reduce' })
  const p2 = await login(ctx2, 'Raka')
  watch(p2, bag)
  await fullSession(p2, { org, id: raka }, 'reduced', true)
  await p2.goto(`${BASE}/today`)
  await p2.waitForTimeout(800)
  await p2.screenshot({ path: `${OUT}/reduced-today.png` })
  const inf = await running(p2)
  say(inf === 0, `reduced motion, Today: animasi tanpa akhir ${inf}`)
  await p2.goto(`${BASE}/world`)
  await p2.waitForTimeout(800)
  const infW = await running(p2)
  say(infW === 0, `reduced motion, World: animasi tanpa akhir ${infW}`)
  await ctx2.close()

  void aisha
  const uniq = [...new Set(bag)]
  say(uniq.length === 0, `error dan permintaan gagal di jalur utama: ${uniq.length}`)
  for (const u of uniq.slice(0, 40)) console.log('   ', u)
  await browser.close()
  await sql.end()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
