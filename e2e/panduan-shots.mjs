// Tangkapan layar produk untuk /panduan dari stack sekali pakai dengan data contoh fiktif (seed: Aisha dan Raka).
// Hasilnya webp kecil di apps/web/public/panduan-img, masing-masing di bawah 80 KB.
//
// Pemakaian (server dev atau start sudah jalan, database sudah di-seed):
//   E2E_BASE_URL=http://localhost:3167 DATABASE_URL_OWNER=... CHROMIUM_PATH=... node e2e/panduan-shots.mjs [nama ...]
//
// Jangan pernah menjalankan skrip ini terhadap produksi: skrip menulis bintang dan kartu contoh ke database yang ditunjuk.
/* global document, window, Image, fetch -- dipakai di dalam page.evaluate, yang berjalan di browser */
import { mkdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import postgres from 'postgres'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'apps', 'web', 'public', 'panduan-img')
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3167'
const OWNER = process.env.DATABASE_URL_OWNER
if (!OWNER || !/127\.0\.0\.1|localhost/.test(OWNER)) {
  console.error('DATABASE_URL_OWNER harus menunjuk database lokal sekali pakai.')
  process.exit(1)
}
const only = new Set(process.argv.slice(2))
const MAX_BYTES = 78 * 1024
const WIDTH = 390
const SCALE = 1.5

const sql = postgres(OWNER, { max: 2, onnotice: () => {} })
mkdirSync(OUT, { recursive: true })

const org = (await sql`select id from org where name like ${'%__GTX_SEED__%'} order by created_at limit 1`)[0].id
const learner = async (name) => (await sql`select user_id from learner_profile where org_id = ${org} and name = ${name} limit 1`)[0].user_id
const aisha = await learner('Aisha')
const raka = await learner('Raka')

// Data contoh untuk layar Dunia Kira: bintang, kartu, dan medali fiktif.
await sql`delete from star_ledger where learner_id = ${aisha} and source like 'panduan:%'`
await sql`insert into star_ledger (org_id, learner_id, amount, reason, source, date) values (${org}, ${aisha}, 86, 'session', 'panduan:seed', current_date)`
for (const c of ['an-lion', 'an-elephant', 'an-whale', 'rb-robot', 'an-turtle']) {
  await sql`insert into world_card (org_id, learner_id, card_id, source) values (${org}, ${aisha}, ${c}, 'panduan') on conflict do nothing`
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })

async function newPhone() {
  const context = await browser.newContext({ viewport: { width: WIDTH, height: 780 }, deviceScaleFactor: SCALE, locale: 'id-ID', timezoneId: 'Asia/Jakarta', reducedMotion: 'reduce' })
  return { context, page: await context.newPage() }
}

async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(250)
}

/** Ubah PNG menjadi webp lewat kanvas Chromium, turunkan mutu sampai di bawah batas ukuran. */
async function toWebp(page, png) {
  const b64 = png.toString('base64')
  return page.evaluate(
    async ({ b64, max }) => {
      const img = new Image()
      img.src = `data:image/png;base64,${b64}`
      await img.decode()
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d').drawImage(img, 0, 0)
      for (const q of [0.82, 0.74, 0.66, 0.58, 0.5, 0.42, 0.34]) {
        const url = canvas.toDataURL('image/webp', q)
        const bytes = Math.floor((url.length - 'data:image/webp;base64,'.length) * 0.75)
        if (bytes <= max || q === 0.34) return { url, bytes, q, w: canvas.width, h: canvas.height }
      }
    },
    { b64, max: MAX_BYTES },
  )
}

const sizes = {}

async function capture(page, name, { clip, full, locator } = {}) {
  if (only.size && !only.has(name)) return
  await settle(page)
  let png
  if (locator) png = await locator.screenshot({ animations: 'disabled' })
  else png = await page.screenshot({ animations: 'disabled', fullPage: Boolean(full), ...(clip ? { clip } : {}) })
  const res = await toWebp(page, png)
  const file = join(OUT, `${name}.webp`)
  writeFileSync(file, Buffer.from(res.url.split(',')[1], 'base64'))
  sizes[name] = { w: res.w, h: res.h, kb: Math.round(statSync(file).size / 102.4) / 10, q: res.q }
  console.log(`${name}.webp ${res.w}x${res.h} ${sizes[name].kb} KB q=${res.q}`)
}

async function adultLogin(page, email, password, next) {
  await page.goto(`${BASE}/masuk?next=${encodeURIComponent(next)}`)
  await page.getByLabel('Email').first().fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/masuk'), { timeout: 45_000 })
}

// ---------------------------------------------------------------------------
// Layar orang tua
{
  const { context, page } = await newPhone()
  await adultLogin(page, 'mama@contoh.test', 'kira-mama-contoh-2026', '/keluarga')
  await page.goto(`${BASE}/keluarga`)
  await capture(page, 'keluarga', { clip: { x: 0, y: 0, width: WIDTH, height: 780 } })
  await page.goto(`${BASE}/keluarga/anak/${aisha}`)
  await settle(page)
  const rules = page.getByRole('heading', { name: /Sesi wajib|Aturan sesi|Aturan hari/i }).first()
  if (await rules.count()) await rules.scrollIntoViewIfNeeded()
  await capture(page, 'aturan-hari')
  const sw = page.getByRole('heading', { name: /Mapel dan fitur|Fitur/i }).first()
  if (await sw.count()) await sw.scrollIntoViewIfNeeded()
  await capture(page, 'saklar-fitur')
  await page.goto(`${BASE}/keluarga/pelatih`)
  await capture(page, 'pelatih')
  await page.goto(`${BASE}/keluarga/rapor`)
  await capture(page, 'rapor')
  await page.goto(`${BASE}/keluarga/privasi`)
  await capture(page, 'privasi')
  await context.close()
}

// ---------------------------------------------------------------------------
// Layar anak
{
  const { context, page } = await newPhone()
  await adultLogin(page, 'tutor@contoh.test', 'kira-tutor-contoh-2026', '/perangkat')
  await page.goto(`${BASE}/perangkat`)
  await page.getByLabel('Nama tablet').fill('Tablet panduan')
  await page.getByRole('checkbox', { name: 'Aisha' }).check()
  await page.getByRole('checkbox', { name: 'Raka' }).check()
  await page.getByRole('button', { name: 'Daftarkan tablet' }).click()
  await page.waitForURL((u) => u.pathname === '/', { timeout: 45_000 })
  await page.goto(`${BASE}/`)
  await settle(page)
  await capture(page, 'pilih-anak')
  await page.getByRole('link', { name: /^Aisha, / }).click()
  await page.waitForURL((u) => u.pathname.startsWith('/pin/'))
  await capture(page, 'pin')
  for (const p of ['Sun', 'Moon', 'Star', 'Cat']) await page.getByRole('button', { name: p, exact: true }).click()
  await page.waitForURL((u) => u.pathname === '/today', { timeout: 45_000 })
  await capture(page, 'today')

  const pages = [
    ['latihan', '/practice'],
    ['hitung-cepat', '/quick-maths'],
    ['lomba', '/competitions'],
    ['kartu', '/practice/cards'],
    ['ulas', '/practice/review'],
    ['baca', '/reading'],
    ['alat', '/tools'],
    ['dunia', '/world'],
    ['toko', '/world/shop'],
    ['album', '/world/cards'],
    ['cerita', '/world/story'],
    ['bos', '/world/boss'],
    ['piala', '/world/trophies'],
  ]
  for (const [name, path] of pages) {
    if (only.size && !only.has(name)) continue
    await page.goto(`${BASE}${path}`)
    await capture(page, name)
  }
  await context.close()
}

writeFileSync(join(OUT, 'sizes.json.txt'), JSON.stringify(sizes, null, 1))
await browser.close()
await sql.end()
