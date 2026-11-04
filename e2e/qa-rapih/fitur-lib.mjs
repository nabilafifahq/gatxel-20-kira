// Pustaka bersama skrip QA fitur (Aisha saja). Jalankan dari C:/kw5/rapih/e2e dengan env rapih-env.sh.
// Alamat server lewat E2E_BASE_URL, bawaan http://localhost:3189.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from '@playwright/test'
import postgres from 'postgres'

export const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3189'
export const SHOTS = 'C:/kw5/rapih-shots/fitur'
export const PHONE = { width: 375, height: 812 }
export const TABLET = { width: 800, height: 1100 }
export const sql = postgres(process.env.DATABASE_URL_OWNER, { max: 2, onnotice: () => {} })

export async function ids() {
  const [o] = await sql`select id from org where name like ${'%__GTX_SEED__%'} order by created_at limit 1`
  const [l] = await sql`select user_id from learner_profile where org_id = ${o.id} and name = 'Aisha' limit 1`
  return { org: o.id, aisha: l.user_id }
}

export const out = []
export function log(ok, what, detail = '') {
  const line = `${ok === true ? 'OK  ' : ok === false ? 'BUG ' : 'INFO'} ${what}${detail ? ' :: ' + detail : ''}`
  out.push(line)
  console.log(line)
}

export async function setLang(aisha, lang) {
  await sql`update auth.user_account set ui_lang = ${lang}, ui_lang_switch = false where id = ${aisha}`
}

export async function browser() {
  return chromium.launch({ headless: true })
}

export async function newCtx(b, viewport, extra = {}) {
  return b.newContext({ baseURL: BASE, viewport, locale: 'en-GB', timezoneId: 'Asia/Jakarta', hasTouch: viewport.width < 500, ...extra })
}

export async function loginAdult(page, email, password, next) {
  await page.goto(`/masuk?next=${encodeURIComponent(next)}`)
  await page.getByLabel('Email').first().fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/masuk'), { timeout: 30000 })
}

/** Daftarkan tablet untuk Aisha lalu masuk dengan PIN gambar. Bahasa harus en saat login agar nama gambar cocok. */
export async function loginAisha(ctx) {
  const page = await ctx.newPage()
  await loginAdult(page, 'tutor@contoh.test', 'kira-tutor-contoh-2026', '/perangkat')
  await page.goto('/perangkat')
  await page.getByLabel('Nama tablet').fill(`QA fitur ${Date.now()}`)
  await page.getByRole('checkbox', { name: 'Aisha' }).check()
  await page.getByRole('button', { name: 'Daftarkan tablet' }).click()
  await page.waitForURL((u) => u.pathname === '/', { timeout: 30000 })
  await page.getByRole('link', { name: /^Aisha, / }).click()
  await page.waitForURL((u) => u.pathname.startsWith('/pin/'))
  for (const p of ['Sun', 'Moon', 'Star', 'Cat']) await page.getByRole('button', { name: p, exact: true }).click()
  await page.waitForURL((u) => u.pathname === '/today', { timeout: 30000 })
  return page
}

export async function shot(page, name, fullPage = true) {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage })
}

export async function overflow(page) {
  return page.evaluate(() => {
    const w = document.documentElement.clientWidth
    const bad = []
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.right > w + 1 && getComputedStyle(el).position !== 'fixed') {
        let p = el.parentElement
        let clipped = false
        while (p && p !== document.body) {
          const o = getComputedStyle(p).overflowX
          if (o === 'auto' || o === 'scroll' || o === 'hidden') {
            clipped = true
            break
          }
          p = p.parentElement
        }
        if (!clipped) bad.push(`${el.tagName.toLowerCase()}:${(el.textContent || '').trim().slice(0, 40)}`)
      }
    }
    return { scrollW: document.documentElement.scrollWidth, clientW: w, bad: bad.slice(0, 5) }
  })
}

/** Item MCQ teks untuk mempersingkat sesi saat tes. */
export function mcqItems(prefix, count) {
  const dir = 'C:/kw5/rapih/content/items'
  const res = []
  const walk = (d) => {
    for (const f of readdirSync(d).sort()) {
      const p = join(d, f)
      if (statSync(p).isDirectory()) walk(p)
      else if (f.endsWith('.json')) {
        const file = JSON.parse(readFileSync(p, 'utf8'))
        for (const it of file.items ?? []) {
          if (res.length >= count) return
          if (it.id.startsWith(prefix) && it.type === 'mcq' && !it.passage && !it.figure && it.lang !== 'id' && it.options.every((o) => o.text && !o.figure)) res.push(it)
        }
      }
    }
  }
  walk(dir)
  return res
}

export async function done(b) {
  await b?.close().catch(() => {})
  await sql.end()
}
