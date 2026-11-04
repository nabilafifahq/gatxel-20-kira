// QA akhir sisi anak: keluarga baru lewat pendaftaran sungguhan, hook audio, pencatat galat, dan pengenal soal.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test'
import postgres from 'postgres'
import { generateItem, isGenRef } from '../../packages/content/src/math'
import type { Item } from '../../packages/content/src/schema'
import { allItems } from '../qa-soal/lib'

export const BASE = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3198'
export const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:8198'
export const OUT = 'C:/kw5/qa-anak-shots'
mkdirSync(OUT, { recursive: true })
export const FAM_FILE = `${OUT}/families.json`
export const LOG = `${OUT}/log.txt`
export const sql = postgres(process.env.DATABASE_URL_OWNER!, { max: 3, onnotice: () => {} })

export const say = (ok: boolean | string, msg: string) => {
  const line = `${ok === true ? 'OK  ' : ok === false ? 'BUG ' : `${ok} `} ${msg}`
  console.log(line)
  appendFileSync(LOG, line + '\n')
}

export const WEBVIEW_UA = 'Mozilla/5.0 (Linux; Android 11; SM-T220 Build/RP1A.200720.012; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.230 Safari/537.36'
export const PHONE = { width: 375, height: 812 }
export const TABLET = { width: 800, height: 1100 }
export const PASSWORD = 'kalimat-panjang-qa-anak-2026'
export const PIN_ID = ['Matahari', 'Bulan', 'Bintang', 'Kucing']
export const PIN_EN = ['Sun', 'Moon', 'Star', 'Cat']

export type Family = { grade: number; name: string; lang: 'id' | 'en'; email: string; learnerId?: string; orgId?: string }

export function families(): Family[] {
  return existsSync(FAM_FILE) ? (JSON.parse(readFileSync(FAM_FILE, 'utf8')) as Family[]) : []
}
export function saveFamily(f: Family) {
  const all = families().filter((x) => x.grade !== f.grade || x.name !== f.name)
  all.push(f)
  writeFileSync(FAM_FILE, JSON.stringify(all, null, 1))
}

let _items: Map<string, Item> | null = null
export function resolveItem(ref: string): Item | null {
  if (isGenRef(ref)) return generateItem(ref)
  if (!_items) _items = new Map(allItems().map((i) => [i.id, i]))
  return _items.get(ref) ?? null
}

/** Hook halaman: suara perangkat (harus 0), klip yang diputar sungguhan, tumpang tindih, bunyi sebelum sentuhan. */
export const HOOK = `globalThis.__name = globalThis.__name || ((f) => f);
(() => {
  if (window.__qa) return;
  const q = window.__qa = { speak: [], clips: [], playing: 0, maxPlaying: 0, overlapSrc: [], ended: 0, clipErrors: [], gesture: false, playBeforeGesture: 0, sfx: 0, sfxBeforeGesture: 0, sfxErrors: [], now: [] };
  for (const t of ['pointerdown','keydown','touchend']) addEventListener(t, () => { q.gesture = true }, true);
  try {
    const P = window.SpeechSynthesis && window.SpeechSynthesis.prototype;
    if (P) { const o = P.speak; P.speak = function (u) { q.speak.push(String(u && u.text).slice(0, 80)); return o.call(this, u) } }
  } catch (e) {}
  const P2 = HTMLMediaElement.prototype, op = P2.play;
  const seen = new WeakSet();
  P2.play = function () {
    const el = this;
    if (!seen.has(el)) {
      seen.add(el);
      el.addEventListener('playing', () => { if (!el.__on) { el.__on = true; q.playing++; q.now.push(el.currentSrc || el.src); if (q.playing > 1) q.overlapSrc.push(q.now.slice(-2).join(' + ')); q.maxPlaying = Math.max(q.maxPlaying, q.playing) } });
      const off = () => { if (el.__on) { el.__on = false; q.playing--; const i = q.now.indexOf(el.currentSrc || el.src); if (i >= 0) q.now.splice(i, 1) } };
      el.addEventListener('pause', off); el.addEventListener('ended', () => { q.ended++; off() }); el.addEventListener('error', () => { q.clipErrors.push(el.currentSrc || el.src); off() });
    }
    q.clips.push(el.currentSrc || el.src);
    if (!q.gesture) q.playBeforeGesture++;
    const r = op.call(this);
    if (r && r.catch) r.catch((e) => q.clipErrors.push(String(e && e.name) + ' ' + (el.currentSrc || el.src)));
    return r;
  };
  const A = window.AudioContext && window.AudioContext.prototype;
  if (A) { const o = A.createBufferSource; A.createBufferSource = function () { const n = o.call(this); const s = n.start.bind(n); n.start = (...a) => { q.sfx++; if (!q.gesture) q.sfxBeforeGesture++; return s(...a) }; return n } }
})();`

export type QaState = { speak: string[]; clips: string[]; playing: number; maxPlaying: number; overlapSrc: string[]; ended: number; clipErrors: string[]; gesture: boolean; playBeforeGesture: number; sfx: number; sfxBeforeGesture: number; now: string[] }
export const qa = (p: Page) => p.evaluate(() => (window as unknown as { __qa: unknown }).__qa as never) as Promise<QaState>

export type Problem = { where: string; what: string }
export const problems: Problem[] = []

/** Semua galat konsol, galat halaman, dan permintaan gagal dicatat ke berkas masing-masing skrip. */
export function watch(ctx: BrowserContext, tag: string) {
  const file = `${OUT}/errors-${tag}.txt`
  const note = (page: Page | null, what: string) => {
    const where = page ? new URL(page.url() === 'about:blank' ? BASE : page.url()).pathname : '?'
    problems.push({ where, what })
    appendFileSync(file, `${where} :: ${what}\n`)
  }
  ctx.on('page', (p) => {
    p.on('console', (m) => {
      if (m.type() === 'error') note(p, `console ${m.text().slice(0, 240)}`)
    })
    p.on('pageerror', (e) => note(p, `pageerror ${e.message.slice(0, 240)}`))
    p.on('response', (r) => {
      const s = r.status()
      if (s >= 400) note(p, `http ${s} ${r.request().method()} ${new URL(r.url()).pathname}`)
    })
    p.on('requestfailed', (r) => {
      const f = r.failure()?.errorText ?? ''
      if (f.includes('ERR_ABORTED')) return
      note(p, `failed ${f} ${r.method()} ${new URL(r.url()).pathname}`)
    })
  })
}

export async function newCtx(browser: Browser, opts: { viewport?: { width: number; height: number }; ua?: string; reduced?: boolean; touch?: boolean; tag: string; state?: string }): Promise<BrowserContext> {
  const ctx = await browser.newContext({
    baseURL: BASE,
    viewport: opts.viewport ?? TABLET,
    userAgent: opts.ua,
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
    hasTouch: opts.touch ?? true,
    ...(opts.reduced ? { reducedMotion: 'reduce' as const } : {}),
    ...(opts.state ? { storageState: opts.state } : {}),
  })
  await ctx.addInitScript(HOOK)
  watch(ctx, opts.tag)
  return ctx
}

async function mailLink(address: string, subjectPart: string, path: string): Promise<string> {
  for (let i = 0; i < 120; i++) {
    const list = (await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`)).json()) as { messages: { ID: string; Subject: string }[] }
    const hit = list.messages.find((m) => m.Subject.includes(subjectPart))
    if (hit) {
      const m = (await (await fetch(`${MAILPIT}/api/v1/message/${hit.ID}`)).json()) as { Text: string }
      const l = m.Text.match(new RegExp(`https?://[^\\s]+${path}[^\\s]*`))
      if (!l) throw new Error(`tautan ${path} tidak ada di email`)
      return l[0]
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`email ${subjectPart} untuk ${address} tidak masuk`)
}

/** Pendaftaran sungguhan: daftar, email, konfirmasi, tambah anak, jalur rekomendasi, perangkat anak. Berhenti di pilih anak. */
export async function signUp(page: Page, f: Omit<Family, 'email'> & { email?: string }): Promise<Family> {
  const email = f.email ?? `anak-g${f.grade}-${Date.now().toString(36)}@gmail.com`
  await page.goto('/daftar')
  await page.getByLabel('Nama orang tua').fill(`Ibu ${f.name}`)
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('checkbox', { name: /Saya setuju/ }).check()
  await page.waitForFunction(() => (document.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement | null)?.value, undefined, { timeout: 30000 }).catch(() => say('INFO', 'turnstile belum terisi setelah 30 detik'))
  await page.getByRole('button', { name: 'Daftar', exact: true }).click()
  await page.getByRole('heading', { name: 'Cek email Anda' }).waitFor({ timeout: 30000 })
  const link = await mailLink(email, 'Konfirmasi email', '/daftar/konfirmasi/')
  await page.goto(link.replace(/^https?:\/\/[^/]+/, BASE))
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Konfirmasi email' }).click()
  await page.waitForURL(/\/mulai/, { timeout: 60000 })
  await page.getByLabel('Nama panggilan').fill(f.name)
  await page.getByRole('radiogroup', { name: 'Kelas' }).getByRole('radio', { name: String(f.grade), exact: true }).click().catch(async () => {
    await page.getByRole('button', { name: String(f.grade), exact: true }).first().click()
  })
  if (f.lang === 'en') await page.getByText('English', { exact: true }).first().click()
  else await page.getByText('Bahasa Indonesia', { exact: true }).first().click()
  for (const p of PIN_ID) await page.getByRole('button', { name: p, exact: true }).click()
  await page.getByRole('checkbox', { name: /Belajar di Kira/ }).check()
  await page.getByRole('button', { name: 'Tambahkan anak' }).click()
  await page.getByRole('link', { name: 'Lanjut pilih jalur' }).click({ timeout: 30000 })
  await page.getByRole('button', { name: 'Pakai jalur rekomendasi' }).last().click()
  await page.getByRole('button', { name: 'Mulai belajar sebagai anak' }).click({ timeout: 30000 })
  await page.waitForURL((u) => u.pathname === '/', { timeout: 60000 })
  const [row] = await sql`select lp.user_id, lp.org_id, lp.grade from learner_profile lp join auth.user_account ua on ua.org_id = lp.org_id where lower(ua.email::text) = lower(${email}) limit 1`
  const fam: Family = { grade: f.grade, name: f.name, lang: f.lang, email, learnerId: row?.user_id as string, orgId: row?.org_id as string }
  saveFamily(fam)
  return fam
}

/** Dari pilih anak sampai Today lewat PIN gambar (nama gambar mengikuti bahasa anak). */
export async function pinIn(page: Page, f: Family) {
  await page.getByRole('link', { name: new RegExp(`^${f.name}, `) }).click()
  await page.waitForURL((u) => u.pathname.startsWith('/pin/'), { timeout: 30000 })
  const names = f.lang === 'id' ? PIN_ID : PIN_EN
  for (const p of names) await page.getByRole('button', { name: p, exact: true }).click()
  await page.waitForURL((u) => u.pathname !== '/' && !u.pathname.startsWith('/pin/'), { timeout: 30000 })
}

/** Keluarga yang sudah ada: orang tua masuk, daftarkan perangkat baru untuk anak, lalu PIN. */
export async function deviceFor(page: Page, f: Family) {
  await page.goto(`/masuk?next=${encodeURIComponent('/mulai?langkah=3')}`)
  await page.getByLabel('Email').first().fill(f.email)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/masuk'), { timeout: 45000 })
  await page.goto('/mulai?langkah=3')
  await page.getByRole('button', { name: 'Mulai belajar sebagai anak' }).click({ timeout: 30000 })
  await page.waitForURL((u) => u.pathname === '/', { timeout: 60000 })
  await pinIn(page, f)
}

export const dictFor = (lang: 'id' | 'en') =>
  lang === 'id'
    ? { q: 'Soal', a: 'Jawabanmu', answers: 'Jawaban', check: /^(Periksa|Cek)/, correct: 'Benar', notYet: 'Belum tepat' }
    : { q: 'Question', a: 'Your answer', answers: 'Answers', check: /^Check/, correct: 'Correct', notYet: 'Not yet' }

export async function layoutSweep(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = []
    const de = document.documentElement
    if (de.scrollWidth > window.innerWidth + 1) out.push(`hscroll ${de.scrollWidth}>${window.innerWidth}`)
    const vis = (el: Element) => {
      const r = el.getBoundingClientRect()
      const s = getComputedStyle(el)
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'
    }
    for (const el of Array.from(document.querySelectorAll('a,button,[role=button],[role=link],input,select,textarea,[role=radio],[role=tab]'))) {
      if (!vis(el) || el.closest('footer') && false) continue
      const r = el.getBoundingClientRect()
      const name = (el.getAttribute('aria-label') ?? (el as HTMLElement).innerText ?? el.tagName).trim().replace(/\s+/g, ' ').slice(0, 30)
      if (el.classList.contains('visually-hidden') || r.width < 3 || r.height < 3) continue
      if (el.tagName === 'A' && getComputedStyle(el).display === 'inline') continue // tautan dalam kalimat
      if (r.height < 43.5 || r.width < 43.5) out.push(`small ${Math.round(r.width)}x${Math.round(r.height)} "${name}"`)
      if (r.right > window.innerWidth + 1 || r.left < -1) out.push(`offscreen "${name}" ${Math.round(r.left)}..${Math.round(r.right)}`)
    }
    for (const el of Array.from(document.querySelectorAll('main *, header *'))) {
      const h = el as HTMLElement
      if (!vis(h)) continue
      const s = getComputedStyle(h)
      if (s.display === 'inline' || el.closest('svg')) continue
      if (h.scrollWidth > h.clientWidth + 2 && (s.overflowX === 'hidden' || s.overflowX === 'clip') && h.clientWidth > 0 && h.innerText?.trim() && !h.closest('[aria-hidden=true]') && !h.classList.contains('visually-hidden')) out.push('clipped ' + h.innerText.trim().slice(0, 30) + ' ' + h.scrollWidth + '>' + h.clientWidth)
    }
    for (const i of Array.from(document.images)) if (i.complete && i.naturalWidth === 0) out.push(`broken-img ${i.src}`)
    // Emoji sebagai ikon: rentang piktograf di teks yang tampil.
    const text = document.body.innerText
    const emoji = text.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu)
    if (emoji) out.push(`emoji ${[...new Set(emoji)].join(' ')}`)
    if (/[\u2013\u2014]/.test(text)) out.push(`dash "${(text.match(/.{0,25}[\u2013\u2014].{0,25}/) ?? [''])[0]}"`)
    if (/\bunlock/i.test(text)) out.push('kata unlock')
    if (/\b(illustrative|dummy|lorem|undefined|null|NaN|\[object)\b/i.test(text)) out.push(`placeholder "${(text.match(/.{0,25}\b(illustrative|dummy|lorem|undefined|null|NaN|\[object).{0,25}/i) ?? [''])[0]}"`)
    return [...new Set(out)]
  })
}

export { chromium }
export type { Browser, BrowserContext, Page, Item }
