// Tangkapan layar produk untuk /panduan dari stack sekali pakai dengan data contoh fiktif (seed: Aisha dan Raka).
// Hasilnya webp kecil di apps/web/public/panduan-img, masing-masing di bawah 80 KB, ditambah berbagi.png untuk pratinjau tautan.
//
// Pemakaian (server dev atau start sudah jalan, database sudah di-seed):
//   E2E_BASE_URL=http://localhost:3167 DATABASE_URL_OWNER=... CHROMIUM_PATH=... node e2e/panduan-shots.mjs [nama ...]
//
// Jangan pernah menjalankan skrip ini terhadap produksi: skrip menulis data contoh ke database yang ditunjuk,
// karena itu alamat database selain lokal ditolak.
/* global document, window, Image -- dipakai di dalam page.evaluate, yang berjalan di browser */
import { mkdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import postgres from 'postgres'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'apps', 'web', 'public', 'panduan-img')
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3167'
const OWNER = process.env.DATABASE_URL_OWNER
if (!OWNER || !/@(127\.0\.0\.1|localhost)[:/]/.test(OWNER)) {
  console.error('DATABASE_URL_OWNER harus menunjuk database lokal sekali pakai.')
  process.exit(1)
}
const only = new Set(process.argv.slice(2))
const MAX_BYTES = 78 * 1024
const WIDTH = 390
const HEIGHT = 640
const SCALE = 1.5

const sql = postgres(OWNER, { max: 2, onnotice: () => {} })
mkdirSync(OUT, { recursive: true })

const orgRow = (await sql`select id, name from org where name like ${'%__GTX_SEED__%'} order by created_at limit 1`)[0]
const org = orgRow.id
const learner = async (name) => (await sql`select user_id from learner_profile where org_id = ${org} and name = ${name} limit 1`)[0].user_id
const aisha = await learner('Aisha')
const raka = await learner('Raka')
const guardian = (await sql`select id from auth.user_account where email = 'mama@contoh.test'`)[0].id

async function prepare() {
  // Nama yang wajar di layar. Dikembalikan di akhir supaya seed --reset tetap menemukan org ini.
  await sql`update org set name = 'Keluarga Rina' where id = ${org}`
  await sql`update auth.user_account set name = 'Rina' where id = ${guardian}`
  await sql`update member_profile set name = 'Rina' where user_id = ${guardian}`
  await sql`update day_rules set preset = 'seimbang', rules = null where learner_id in (${aisha}, ${raka})`

  // Enam hari belajar terakhir, supaya halaman Keluarga dan rapor tidak kosong.
  for (const [who, base] of [[aisha, 22], [raka, 28]]) {
    for (let i = 1; i <= 6; i++) {
      await sql`insert into day_record (org_id, learner_id, date, quests_done, quests_required, minutes)
        values (${org}, ${who}, (now() at time zone 'Asia/Jakarta')::date - ${i}::int, 3, 3, ${base + (i * 3) % 11})
        on conflict (learner_id, date) do update set quests_done = 3, quests_required = 3, minutes = excluded.minutes`
    }
  }
  // Kemajuan skill Raka untuk contoh Pelatih orang tua.
  for (const [skill, n, p] of [['m4.place-value', 14, 0.4], ['m4.add-sub-mental', 12, 0.5], ['e4.prefixes', 11, 0.55]]) {
    await sql`insert into skill_state (org_id, learner_id, skill_id, theta, n_answers, recent, gate, stars)
      values (${org}, ${raka}, ${skill}, 0, ${n}, ${Array.from({ length: n }, () => p)}, 'reteach', 1)
      on conflict (learner_id, skill_id) do update set n_answers = excluded.n_answers, recent = excluded.recent, gate = 'reteach', stars = 1`
  }
  // Bintang dan kartu fiktif untuk layar Dunia Kira.
  await sql`delete from star_ledger where learner_id = ${aisha} and source like 'panduan:%'`
  await sql`insert into star_ledger (org_id, learner_id, amount, reason, source, date) values (${org}, ${aisha}, 86, 'session', 'panduan:seed', current_date)`
  for (const c of ['an-lion', 'an-elephant', 'an-whale', 'rb-robot', 'an-turtle']) {
    await sql`insert into world_card (org_id, learner_id, card_id, source) values (${org}, ${aisha}, ${c}, 'panduan') on conflict do nothing`
  }
}

async function restore() {
  await sql`update org set name = ${orgRow.name} where id = ${org}`
  await sql`update auth.user_account set name = 'Mama Contoh' where id = ${guardian}`
  await sql`update member_profile set name = 'Mama Contoh' where user_id = ${guardian}`
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })

async function newPhone() {
  const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: SCALE, locale: 'id-ID', timezoneId: 'Asia/Jakarta', reducedMotion: 'reduce' })
  return { context, page: await context.newPage() }
}

async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(300)
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
      for (const q of [0.8, 0.72, 0.64, 0.56, 0.48, 0.4, 0.32]) {
        const url = canvas.toDataURL('image/webp', q)
        const bytes = Math.floor((url.length - 'data:image/webp;base64,'.length) * 0.75)
        if (bytes <= max || q === 0.32) return { url, q, w: canvas.width, h: canvas.height }
      }
      return null
    },
    { b64, max: MAX_BYTES },
  )
}

async function capture(page, name) {
  if (only.size && !only.has(name)) return
  await settle(page)
  const png = await page.screenshot({ animations: 'disabled' })
  const res = await toWebp(page, png)
  const file = join(OUT, `${name}.webp`)
  writeFileSync(file, Buffer.from(res.url.split(',')[1], 'base64'))
  console.log(`${name}.webp ${res.w}x${res.h} ${Math.round(statSync(file).size / 102.4) / 10} KB q=${res.q}`)
}

async function adultLogin(page, email, password, next) {
  await page.goto(`${BASE}/masuk?next=${encodeURIComponent(next)}`)
  await page.getByLabel('Email').first().fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/masuk'), { timeout: 45_000 })
}

/** Gulir sampai sebuah judul berada di dekat atas layar. */
async function scrollToHeading(page, name) {
  const h = page.getByRole('heading', { name, exact: true }).first()
  await h.waitFor({ state: 'visible', timeout: 15_000 })
  await h.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 16))
}

async function publicShots() {
  const { context, page } = await newPhone()
  await page.goto(`${BASE}/daftar`)
  await capture(page, 'daftar')
  await context.close()
}

async function childShots() {
  const { context, page } = await newPhone()
  await adultLogin(page, 'tutor@contoh.test', 'kira-tutor-contoh-2026', '/perangkat')
  await page.goto(`${BASE}/perangkat`)
  await page.getByLabel('Nama tablet').fill('Tablet panduan')
  await page.getByRole('checkbox', { name: 'Aisha' }).check()
  await page.getByRole('checkbox', { name: 'Raka' }).check()
  await page.getByRole('button', { name: 'Daftarkan tablet' }).click()
  await page.waitForURL((u) => u.pathname === '/', { timeout: 45_000 })
  await page.goto(`${BASE}/`)
  await page.getByRole('link', { name: /^Aisha, / }).click()
  await page.waitForURL((u) => u.pathname.startsWith('/pin/'))
  await capture(page, 'pin')
  for (const p of ['Sun', 'Moon', 'Star', 'Cat']) await page.getByRole('button', { name: p, exact: true }).click()
  await page.waitForURL((u) => u.pathname === '/today', { timeout: 45_000 })
  await page.getByRole('heading', { level: 1 }).first().waitFor({ state: 'visible', timeout: 45_000 })
  await capture(page, 'today')

  if (!only.size || only.has('kamus')) {
    await page.goto(`${BASE}/lesson/e2.pronouns`)
    const word = page.locator('p[aria-live="polite"]').getByRole('button').first()
    await word.waitFor({ state: 'visible', timeout: 30_000 })
    await word.click()
    await page.getByRole('dialog').first().waitFor({ state: 'visible', timeout: 15_000 })
    await capture(page, 'kamus')
  }

  const pages = [
    ['latihan', '/practice'],
    ['hitung-cepat', '/quick-maths'],
    ['lomba', '/competitions'],
    ['kartu', '/practice/cards'],
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

async function parentShots() {
  const { context, page } = await newPhone()
  await adultLogin(page, 'mama@contoh.test', 'kira-mama-contoh-2026', '/keluarga')
  await page.goto(`${BASE}/keluarga`)
  await capture(page, 'keluarga')
  await page.goto(`${BASE}/keluarga/anak/${aisha}`)
  await settle(page)
  await page.locator('summary', { hasText: 'Pengaturan' }).first().click()
  await scrollToHeading(page, 'Fitur yang dipakai')
  await capture(page, 'saklar-fitur')
  await scrollToHeading(page, 'Aturan hari')
  await capture(page, 'aturan-hari')
  await page.goto(`${BASE}/keluarga/pelatih?learner=${raka}`)
  await capture(page, 'pelatih')
  await page.goto(`${BASE}/keluarga/rapor?learner=${aisha}`)
  await capture(page, 'rapor')
  await page.goto(`${BASE}/keluarga/privasi?learner=${aisha}`)
  await capture(page, 'privasi')
  await context.close()
}

/** Gambar pratinjau tautan 1200 x 630 dari elemen dan token yang sama dengan halaman panduan. */
async function shareImage() {
  if (only.size && !only.has('berbagi')) return
  const context = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, reducedMotion: 'reduce' })
  const page = await context.newPage()
  await page.goto(`${BASE}/panduan`)
  await settle(page)
  await page.evaluate(() => {
    const star = document.querySelector('header svg')?.cloneNode(true)
    document.body.innerHTML = ''
    const card = document.createElement('div')
    card.className = 'flex items-center bg-lavender text-fg'
    card.style.cssText = 'width:1200px;height:630px;gap:56px;padding:0 96px;box-sizing:border-box'
    if (star) {
      star.setAttribute('width', '300')
      star.setAttribute('height', '300')
      card.append(star)
    }
    const text = document.createElement('div')
    text.innerHTML = '<div class="font-display font-semibold" style="font-size:84px;line-height:96px">Panduan Kira</div><div class="font-display" style="font-size:40px;line-height:54px;margin-top:16px">Untuk orang tua dan anak, kelas 1 sampai 6</div>'
    card.append(text)
    document.body.append(card)
  })
  await page.waitForTimeout(300)
  await page.screenshot({ path: join(OUT, 'berbagi.png'), clip: { x: 0, y: 0, width: 1200, height: 630 } })
  console.log(`berbagi.png ${Math.round(statSync(join(OUT, 'berbagi.png')).size / 102.4) / 10} KB`)
  await context.close()
}

try {
  await prepare()
  await publicShots()
  await childShots()
  await parentShots()
  await shareImage()
} finally {
  await restore()
  await browser.close()
  await sql.end()
}
