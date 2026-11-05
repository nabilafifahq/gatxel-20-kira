// Mengukur luapan dan kontrol tertutup di layar utama pada lebar iPhone, Chromium dan WebKit.
// Lewat proxy HTTPS lokal (https-proxy.mjs) karena cookie __Host- butuh origin aman. Hanya untuk stack sekali pakai.
//   E2E_BASE_URL=https://localhost:3202 DATABASE_URL_OWNER=... node e2e/qa-layar/sweep-screens.mjs <laporan.json> <folder-gambar> [--only=kata] [--engine=webkit]
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, devices, webkit } from '@playwright/test'
import postgres from 'postgres'
import { coveredControlsInPage, groupFindings, measureInPage } from './measure.mjs'
import { saveAdultState, saveLearnerState } from './login.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const BASE = process.env.E2E_BASE_URL ?? 'https://localhost:3202'
const OWNER = process.env.DATABASE_URL_OWNER
if (!OWNER || !/@(127\.0\.0\.1|localhost)[:/]/.test(OWNER)) {
  console.error('DATABASE_URL_OWNER harus menunjuk database lokal sekali pakai.')
  process.exit(1)
}
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const REPORT = args[0] ?? 'screens.json'
const SHOTS = args[1] ?? 'screens-shots'
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1] ?? ''
const ENGINE = process.argv.find((a) => a.startsWith('--engine='))?.split('=')[1] ?? ''
mkdirSync(SHOTS, { recursive: true })
mkdirSync(dirname(REPORT), { recursive: true })

// 664 adalah tinggi area terlihat iPhone 13 di Safari dengan bilah alamat dan bilah bawah tampil.
const SIZES = [
  { width: 375, height: 603 },
  { width: 390, height: 664 },
]

const sql = postgres(OWNER, { max: 2, onnotice: () => {} })
const org = (await sql`select id from org where name like ${'%__GTX_SEED__%'} order by created_at limit 1`)[0].id
const learnerRows = await sql`select user_id, name from learner_profile where org_id = ${org}`
const raka = learnerRows.find((r) => r.name === 'Raka').user_id
const aisha = learnerRows.find((r) => r.name === 'Aisha').user_id

/** Soal terpanjang dan soal bergambar per tipe, supaya setiap tipe diuji pada isi terberatnya. */
function pickItems() {
  const byType = new Map()
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith('.json')) {
        for (const it of JSON.parse(readFileSync(p, 'utf8')).items ?? []) {
          if (!byType.has(it.type)) byType.set(it.type, [])
          byType.get(it.type).push(it)
        }
      }
    }
  }
  walk(join(ROOT, 'content', 'items'))
  const size = (it) => JSON.stringify(it.options ?? it.items ?? it.pairs ?? it.rows ?? []).length + (it.prompt ?? '').length + (it.passage ?? '').length
  const picks = []
  for (const [type, list] of byType) {
    const sorted = [...list].sort((a, b) => size(b) - size(a))
    const chosen = new Map()
    chosen.set(sorted[0].id, sorted[0])
    const fig = sorted.find((i) => i.figure)
    if (fig) chosen.set(fig.id, fig)
    chosen.set(list[Math.floor(list.length / 2)].id, list[Math.floor(list.length / 2)])
    for (const it of chosen.values()) picks.push({ ...it, type })
  }
  // Umpan balik dan pemutar langkah: pilihan ganda dengan penjelasan dan langkah terpanjang.
  const mcq = byType.get('mcq') ?? []
  const feedback = [...mcq].filter((i) => i.solution && i.options?.every((o) => o.text)).sort((a, b) => JSON.stringify(b.solution).length + (b.explanation ?? '').length - JSON.stringify(a.solution).length - (a.explanation ?? '').length).slice(0, 4)
  return { picks, feedback }
}
const subjectOf = (id) => (id.startsWith('m') ? 'math' : id.startsWith('e') ? 'english' : 'science')
async function makeAttempt(items, mode = 'latihan') {
  const refs = items.map((it, i) => ({ ref: it.id, section: 'core', position: i + 1, difficulty: it.difficulty ?? 1 }))
  const rows = await sql`insert into attempt (org_id, learner_id, kind, mode, subject, title, items, time_limit_s)
    values (${org}, ${raka}, 'test', ${mode}, ${subjectOf(items[0].id)}, 'QA layar', ${sql.json(refs)}, ${null}) returning id`
  return rows[0].id
}

const { picks, feedback } = pickItems()
const runScreens = []
for (const it of picks) runScreens.push({ name: `run-${it.type}-${it.id}`, path: `/run/${await makeAttempt([it])}`, who: 'learner' })
const testAttempt = await makeAttempt(picks.filter((p) => p.type === 'mcq').slice(0, 2), 'tes')
runScreens.push({ name: 'run-test-mode', path: `/run/${testAttempt}`, who: 'learner' })

const PUBLIC = ['/beranda', '/', '/feedback', '/masuk', '/daftar', '/masuk/anak', '/panduan', '/panduan/anak', '/bantuan', '/privasi', '/ketentuan']
const LEARNER = ['/today', '/map', '/practice', '/practice/cards', '/practice/review', '/review', '/reading', '/tools', '/world', '/world/boss', '/world/cards', '/world/friend', '/world/shop', '/world/story', '/world/trophies', '/me', '/my-words', '/english', '/english/spelling', '/competitions', '/quick-maths', '/quiz-arena', '/fix-it', '/esmo']
const PARENT = ['/keluarga', `/keluarga/anak/${raka}`, `/keluarga/anak/${aisha}`, '/keluarga/lembar', '/keluarga/minggu', '/keluarga/pelatih', '/keluarga/piala', '/keluarga/privasi', '/keluarga/rapor', '/mulai']

const screens = [
  ...PUBLIC.map((path) => ({ name: `public${path.replaceAll('/', '-')}`, path, who: 'none' })),
  ...PARENT.map((path, i) => ({ name: `parent-${i}${path.split('/').slice(0, 3).join('-')}`, path, who: 'parent' })),
  ...LEARNER.map((path) => ({ name: `learner${path.replaceAll('/', '-')}`, path, who: 'learner' })),
  ...runScreens,
].filter((s) => !ONLY || s.name.includes(ONLY) || s.path.includes(ONLY))

const b0 = await chromium.launch()
const learnerState = `${REPORT}.learner.json`
const parentState = `${REPORT}.parent.json`
const httpBase = process.env.KIRA_ORIGIN ?? 'http://localhost:3201'
await saveLearnerState(b0, httpBase, learnerState)
await saveAdultState(b0, httpBase, parentState, 'mama@contoh.test', 'kira-mama-contoh-2026')
await b0.close()

const rows = []
const covered = []
const failures = []
let measured = 0

async function record(page, name, engine, size, shot) {
  const found = await page.evaluate(measureInPage, 'body')
  measured++
  for (const f of found) rows.push({ ...f, width: size.width, where: `${name}|${engine}` })
  const cov = await page.evaluate(coveredControlsInPage)
  for (const c of cov) covered.push({ ...c, width: size.width, engine, where: name })
  if (shot) await page.screenshot({ path: join(SHOTS, `${engine}-${size.width}-${name.replace(/[^a-z0-9.-]+/gi, '_').slice(0, 80)}.png`) }).catch(() => {})
}

async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 1200 }).catch(() => {})
  await page.waitForTimeout(100)
}

async function visit(page, engine, size, s, shot) {
  const res = await page.goto(`${BASE}${s.path}`, { waitUntil: 'domcontentloaded', timeout: 45_000 })
  await settle(page)
  if (res && res.status() >= 400) failures.push({ where: s.name, engine, status: res.status() })
  await record(page, s.name, engine, size, shot)
}

/** Alur layar yang butuh ketukan: kartu, buku, alat, umpan balik, dan pemutar langkah. */
async function flows(page, engine, size, shot) {
  // Kartu: buka dek pertama, balik kartu.
  await page.goto(`${BASE}/practice/cards`, { waitUntil: 'domcontentloaded' })
  await settle(page)
  const deck = await page.locator('a[href^="/practice/cards/"]').first().getAttribute('href').catch(() => null)
  if (deck) {
    await page.goto(`${BASE}${deck}`, { waitUntil: 'domcontentloaded' })
    await settle(page)
    await record(page, 'flashcard-front', engine, size, shot)
    await page.locator('main button, [data-jenjang] button').filter({ hasNotText: /^$/ }).first().click({ timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(300)
    await record(page, 'flashcard-tap', engine, size, shot)
  }
  // Ruang baca: buku pertama dan bab pertama.
  await page.goto(`${BASE}/reading`, { waitUntil: 'domcontentloaded' })
  await settle(page)
  const book = await page.locator('a[href^="/reading/"]').first().getAttribute('href').catch(() => null)
  if (book) {
    await page.goto(`${BASE}${book}`, { waitUntil: 'domcontentloaded' })
    await settle(page)
    await record(page, 'reading-book', engine, size, shot)
    const chapter = await page.locator(`a[href^="${book}/"]`).first().getAttribute('href').catch(() => null)
    if (chapter) {
      await page.goto(`${BASE}${chapter}`, { waitUntil: 'domcontentloaded' })
      await settle(page)
      await record(page, 'reading-chapter', engine, size, shot)
    }
  }
  // Alat: setiap tab.
  await page.goto(`${BASE}/tools`, { waitUntil: 'domcontentloaded' })
  await settle(page)
  const tabs = page.locator('[aria-pressed], [role="tab"]')
  const n = await tabs.count()
  for (let i = 0; i < n; i++) {
    await tabs.nth(i).click({ timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(250)
    await record(page, `tools-tab-${i}`, engine, size, shot)
  }
  // Umpan balik: jawab salah dua kali, buka pemutar langkah.
  for (const it of feedback) {
    const id = await makeAttempt([it])
    await page.goto(`${BASE}/run/${id}`, { waitUntil: 'domcontentloaded' })
    await settle(page)
    const wrong = it.options.find((_, i) => i !== it.answer)?.text
    for (let round = 0; round < 2; round++) {
      const area = page.locator('section[aria-label="Your answer"], section[aria-label="Jawabanmu"]').first()
      await area.getByRole('button', { name: wrong }).or(area.locator('button', { hasText: wrong })).first().click({ timeout: 8000 })
      await page.getByRole('button', { name: /^(Check|Periksa|Cek)$/ }).click({ timeout: 8000 })
      await page.waitForTimeout(700)
      await record(page, `feedback-${round === 0 ? 'not-yet' : 'revealed'}-${it.id}`, engine, size, shot)
      if (round === 0) {
        await page.getByRole('button', { name: /^(Try again|Coba lagi)$/ }).click({ timeout: 8000 })
        await page.waitForTimeout(250)
      }
    }
    const how = page.getByRole('button', { name: /^(Show me how|Lihat caranya|Tunjukkan caranya)$/ })
    if (await how.count()) {
      await how.first().click({ timeout: 5000 })
      await page.waitForTimeout(800)
      await record(page, `solution-step1-${it.id}`, engine, size, shot)
      const nextStep = page.getByRole('dialog').getByRole('button', { name: /^(Next step|Next|Langkah berikutnya|Lanjut)$/ }).first()
      for (let k = 2; k <= (it.solution?.length ?? 0); k++) {
        await nextStep.click({ timeout: 3000 }).catch(() => {})
        await page.waitForTimeout(250)
        const found = await page.evaluate(measureInPage, '[role="dialog"]')
        measured++
        for (const f of found) rows.push({ ...f, width: size.width, where: `solution-step${k}-${it.id}|${engine}` })
      }
      await page.screenshot({ path: join(SHOTS, `${engine}-${size.width}-solution-last-${it.id}.png`) }).catch(() => {})
    }
  }
}

const engines = [
  ['chromium', chromium],
  ['webkit', webkit],
].filter(([n]) => !ENGINE || n === ENGINE)
const t0 = Date.now()
const { defaultBrowserType: _d, viewport: _v, ...phone } = devices['iPhone 13']
async function runPair(engineName, engine, size) {
  const browser = await engine.launch()
  const shot = size.width === 390 || engineName === 'chromium'
  const makeCtx = (storageState) => browser.newContext({ ...phone, viewport: size, ignoreHTTPSErrors: true, storageState, locale: 'en-GB', timezoneId: 'Asia/Jakarta' })
  const contexts = { none: await makeCtx(undefined), learner: await makeCtx(learnerState), parent: await makeCtx(parentState) }
  for (const c of Object.values(contexts)) await c.route(/\/api\/(tts|audio)|\.(mp3|ogg|wav)(\?|$)/, (r) => r.abort())
  const pages = { none: await contexts.none.newPage(), learner: await contexts.learner.newPage(), parent: await contexts.parent.newPage() }
  let i = 0
  for (const s of screens) {
    try {
      await visit(pages[s.who], engineName, size, s, shot)
    } catch (e) {
      failures.push({ where: s.name, engine: engineName, width: size.width, error: String(e).slice(0, 160) })
    }
    if (++i % 25 === 0) console.log(`${engineName} ${size.width}: ${i}/${screens.length}, ${rows.length} temuan, ${Math.round((Date.now() - t0) / 1000)} dtk`)
  }
  if (!ONLY) {
    try {
      await flows(pages.learner, engineName, size, shot)
    } catch (e) {
      failures.push({ where: 'flows', engine: engineName, width: size.width, error: String(e).slice(0, 240) })
    }
  }
  await browser.close()
}
// --pairs=two: Chromium 375 dan WebKit 390 saja, bila waktu sempit.
const two = process.argv.includes('--pairs=two')
const pairs = engines.flatMap(([n, e]) => SIZES.filter((size) => !two || (n === 'chromium' ? size.width === 375 : size.width === 390)).map((size) => runPair(n, e, size)))
await Promise.all(pairs)
await sql.end()
const groups = groupFindings(rows)
const coveredGroups = new Map()
for (const c of covered) {
  const k = `${c.what} ${c.label} ${c.by ?? ''}`
  const g = coveredGroups.get(k) ?? { ...c, count: 0 }
  g.count++
  coveredGroups.set(k, g)
}
writeFileSync(REPORT, JSON.stringify({ screens: screens.length, measured, findings: rows.length, failures, covered: [...coveredGroups.values()], groups }, null, 1))
console.log(`SELESAI: ${screens.length} layar, ${measured} ukuran, ${rows.length} temuan, ${groups.length} komponen, ${covered.length} kontrol tertutup, ${failures.length} gagal, ${Math.round((Date.now() - t0) / 1000)} dtk`)
for (const f of failures.slice(0, 25)) console.log('GAGAL', JSON.stringify(f).slice(0, 260))
for (const g of groups.slice(0, 60)) {
  console.log(`${String(g.count).padStart(5)} ${g.kind} ${g.sig.slice(0, 100)}\n        e.g. ${g.examples[0].where} @${g.examples[0].width}: ${g.examples[0].text.slice(0, 36)} | ${g.examples[0].detail.slice(0, 100)}`)
}
console.log('KONTROL TERTUTUP')
for (const c of [...coveredGroups.values()].slice(0, 40)) console.log(`${String(c.count).padStart(4)} ${c.what} "${c.label}" ${c.by ?? ''} e.g. ${c.where} ${c.engine} ${c.width}`)
