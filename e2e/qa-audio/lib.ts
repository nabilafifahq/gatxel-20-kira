// Alat bersama uji suara ujung ke ujung: instrumen HTMLMediaElement, manifest, data keluarga, dan pembukaan soal lewat SQL.
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { Browser, BrowserContext, Page, Response } from '@playwright/test'
import { isClipText, splitClipText, ttsKeyInput } from '../../packages/core/src/tts'

export const ROOT = 'C:/kw5/akhir'
export const OUT = process.env.QA_OUT ?? 'C:/kw5/tiga-audio-work/out'
export const TTS_DIR = 'C:/Kira/data/tts'
export const EN_VER = 'piper-lessac-medium'
export const ID_VER = 'id-piper1'

function stackInfo(): { base: string; mailpit: string; db: string } {
  const txt = existsSync('C:/kw5/tiga-stack.txt') ? readFileSync('C:/kw5/tiga-stack.txt', 'utf8') : ''
  const mail = /Mailpit:\s*(http\S+)/i.exec(txt)?.[1] ?? 'http://127.0.0.1:8198'
  const web = /(?:Web|Proxy|URL):\s*(http\S+)/i.exec(txt)?.[1] ?? 'http://127.0.0.1:3198'
  const db = /docker exec -i (\S+)/.exec(txt)?.[1] ?? 'kiraqa3-db-1'
  return { base: web.replace(/\/$/, ''), mailpit: mail.replace(/\/$/, ''), db }
}
export const STACK = stackInfo()
export const BASE = process.env.E2E_BASE_URL ?? STACK.base

export function psql(sql: string): string {
  return execFileSync('docker', ['exec', '-i', STACK.db, 'psql', '-U', 'postgres', '-d', 'kira', '-At', '-v', 'ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8' }).trim()
}

export type ManRow = { key: string; style: string; text: string; version: string; spoken?: string }
export const man = new Map<string, ManRow>()
for (const f of [`manifest-${EN_VER}.jsonl`, `manifest-${ID_VER}.jsonl`]) {
  for (const line of readFileSync(join(TTS_DIR, f), 'utf8').split('\n')) {
    if (!line.trim()) continue
    const m = JSON.parse(line) as ManRow
    man.set(m.key, m)
  }
}
export const clipKey = (text: string, style: string, version: string) => createHash('sha256').update(ttsKeyInput(text, style as never, version)).digest('hex')
export const planKeys = (text: string, style: string, version: string) => splitClipText(text).filter(isClipText).map((t) => clipKey(t, style, version))
export const allIn = (text: string, style: string, version: string) => {
  const k = planKeys(text, style, version)
  return k.length > 0 && k.every((x) => man.has(x))
}

// ---------------------------------------------------------------- konten
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- soal mentah dari JSON, bentuknya banyak
export type RawItem = Record<string, any> & { id: string; type: string; skill: string; prompt: string; lang?: string }
export function allContentItems(): RawItem[] {
  const out: RawItem[] = []
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f)
      if (statSync(p).isDirectory()) walk(p)
      else if (f.endsWith('.json')) {
        const j = JSON.parse(readFileSync(p, 'utf8'))
        for (const it of j.items ?? []) out.push({ ...it, skill: it.skill ?? j.skill, lang: it.lang ?? j.lang ?? 'en-GB', _file: p })
      }
    }
  }
  walk(join(ROOT, 'content/items'))
  return out
}
const hash = (en: string) => createHash('sha256').update(en, 'utf8').digest('hex').slice(0, 20)
let trAll: Record<string, { en: string; id: string }> | null = null
function loadTr(): Record<string, { en: string; id: string }> {
  if (trAll) return trAll
  const all: Record<string, { en: string; id: string }> = {}
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f)
      if (statSync(p).isDirectory()) walk(p)
      else if (f.endsWith('.json') && !f.startsWith('_voice')) {
        const j = JSON.parse(readFileSync(p, 'utf8'))
        Object.assign(all, j.entries ?? {})
      }
    }
  }
  walk(join(ROOT, 'content/translations/id'))
  trAll = all
  return all
}
export const idOf = (en: string): string | undefined => loadTr()[hash(en)]?.id
export const heldSet = (): Set<string> => new Set((JSON.parse(readFileSync(join(ROOT, 'content/translations/id/_voice-held.json'), 'utf8')) as { held: string[] }).held)
export const isHeld = (en: string, held: Set<string>) => held.has(hash(en))

// ---------------------------------------------------------------- instrumen di halaman
export const INIT = String.raw`(() => {
  if (window.__qa) return;
  const now = () => Math.round(performance.now());
  const q = window.__qa = { plays: [], loads: [], order: [], audios: 0, speak: 0, sfx: [], playing: 0, maxPlaying: 0, elements: 0, pauses: [] };
  try { if ('speechSynthesis' in window) { const s = window.speechSynthesis; const o = s.speak.bind(s); s.speak = (u) => { q.speak++; q.order.push(['speak', u && u.text]); return o(u) } } } catch (e) {}
  const blobKey = new WeakMap(); const urlKey = new Map();
  const oBlob = Response.prototype.blob;
  Response.prototype.blob = async function () { const b = await oBlob.call(this); const m = /\/tts\/([0-9a-f]{64})\.mp3/.exec(this.url || ''); if (m) blobKey.set(b, m[1]); return b };
  const oCreate = URL.createObjectURL;
  URL.createObjectURL = function (b) { const u = oCreate.call(URL, b); if (blobKey.has(b)) urlKey.set(u, { key: blobKey.get(b), bytes: b.size }); return u };
  const A = window.Audio;
  const W = function (...a) { q.audios++; q.order.push(['new Audio']); return new A(...a) };
  W.prototype = A.prototype; window.Audio = W;
  const live = new Set();
  const watch = (el) => {
    if (el.__qaw) return; el.__qaw = true; q.elements++;
    el.addEventListener('playing', () => { live.add(el); q.playing = live.size; q.maxPlaying = Math.max(q.maxPlaying, live.size); q.order.push(['playing']) });
    const drop = () => { live.delete(el); q.playing = live.size };
    el.addEventListener('pause', () => { drop(); q.pauses.push(now()); q.order.push(['pause']); if (el.__rec) el.__rec.pausedAt = now() });
    el.addEventListener('ended', () => { drop(); q.order.push(['ended']); if (el.__rec) { el.__rec.ended = true; el.__rec.maxCT = Math.max(el.__rec.maxCT, el.currentTime) } });
    el.addEventListener('emptied', drop);
    el.addEventListener('timeupdate', () => { if (el.__rec) el.__rec.maxCT = Math.max(el.__rec.maxCT, el.currentTime) });
    el.addEventListener('durationchange', () => { if (el.__rec && isFinite(el.duration)) el.__rec.duration = el.duration });
    el.addEventListener('error', () => { q.order.push(['error', el.error && el.error.code]); if (el.__rec) el.__rec.mediaError = el.error && el.error.code });
  };
  const inTap = () => { const e = window.event; return { ev: e ? e.type : null, trusted: !!(e && e.isTrusted), active: navigator.userActivation ? navigator.userActivation.isActive : null } };
  const oLoad = HTMLMediaElement.prototype.load;
  HTMLMediaElement.prototype.load = function () { watch(this); const t = inTap(); q.loads.push({ t: now(), ...t }); q.order.push(['load', t.ev]); return oLoad.call(this) };
  const oPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    watch(this);
    const info = urlKey.get(this.src) || { key: null, bytes: null };
    const t = inTap();
    const rec = { t: now(), key: info.key, bytes: info.bytes, resolved: null, err: null, maxCT: 0, duration: null, ended: false, pausedAt: null, ev: t.ev, active: t.active };
    q.plays.push(rec); q.order.push(['play', info.key ? info.key.slice(0, 10) : this.src.slice(0, 30)]);
    this.__rec = rec;
    let p;
    try { p = oPlay.call(this) } catch (e) { rec.resolved = false; rec.err = String(e); throw e }
    if (p && p.then) p.then(() => { rec.resolved = true; rec.resolvedAt = now() }, (e) => { rec.resolved = false; rec.err = e.name });
    return p;
  };
  if (window.AudioBufferSourceNode) {
    const oStart = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...a) { q.sfx.push({ t: now(), speaking: live.size > 0 }); q.order.push(['sfx', live.size]); return oStart.apply(this, a) };
  }
  window.__qaNow = () => ({ live: live.size, liveCT: [...live].map((e) => e.currentTime) });
})();`

export type PlayRec = { t: number; key: string | null; bytes: number | null; resolved: boolean | null; err: string | null; maxCT: number; duration: number | null; ended: boolean; pausedAt: number | null; ev: string | null; active: boolean | null; mediaError?: number }
export type Qa = { plays: PlayRec[]; loads: { t: number; ev: string | null; trusted: boolean; active: boolean | null }[]; order: unknown[][]; audios: number; speak: number; sfx: { t: number; speaking: boolean }[]; playing: number; maxPlaying: number; elements: number; pauses: number[] }
export const qa = (p: Page) => p.evaluate(() => (window as unknown as { __qa: Qa }).__qa)
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ---------------------------------------------------------------- jaringan
export type Net = { key: string; status: number; bytes: number; fromSW: boolean; at: number; page: string }
export function trackNet(ctx: BrowserContext, sink: Net[], swSink?: string[]): void {
  ctx.on('response', async (r: Response) => {
    const u = new URL(r.url())
    const m = /^\/tts\/([0-9a-f]{64})\.mp3$/.exec(u.pathname)
    if (!m) return
    // Permintaan dari dalam service worker dihitung lewat permintaan halaman saja.
    if (r.request().serviceWorker()) {
      swSink?.push(m[1]!)
      return
    }
    // Dicatat seketika: body respons dari service worker bisa tertahan, jadi 404 tidak boleh menunggunya.
    let page: string
    try {
      page = r.frame().url()
    } catch {
      page = BASE
    }
    const row: Net = { key: m[1]!, status: r.status(), bytes: Number(r.headers()['content-length'] ?? 0), fromSW: r.fromServiceWorker(), at: Date.now(), page: new URL(page || BASE).pathname }
    sink.push(row)
    if (r.status() === 200 && !row.bytes) row.bytes = await r.body().then((b) => b.length).catch(() => 0)
  })
}

// ---------------------------------------------------------------- keluarga dan anak
const PASSWORD = 'Kalimat-Uji-Suara-Fiktif-2026!'
export const PICS = ['Matahari', 'Bulan', 'Bintang', 'Kucing'] as const
const EN_PICS: Record<string, string> = { Matahari: 'Sun', Bulan: 'Moon', Bintang: 'Star', Kucing: 'Cat' }

async function mailLink(email: string): Promise<string> {
  for (let i = 0; i < 80; i++) {
    const list = (await (await fetch(`${STACK.mailpit}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json()) as { messages: { ID: string; Subject: string }[] }
    const hit = list.messages.find((m) => m.Subject.includes('Konfirmasi email'))
    if (hit) {
      const m = (await (await fetch(`${STACK.mailpit}/api/v1/message/${hit.ID}`)).json()) as { Text: string }
      const l = /https?:\/\/[^\s]+\/daftar\/konfirmasi\/[^\s]*/.exec(m.Text)
      if (l) return l[0].replace(/^https?:\/\/[^/]+/, BASE)
    }
    await sleep(500)
  }
  throw new Error('email konfirmasi tidak masuk')
}

export async function makeFamily(browser: Browser, email: string, kids: { name: string; grade: number; uiLang: 'id' | 'en' }[], stateFile: string): Promise<void> {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 1000 }, locale: 'id-ID' })
  const page = await ctx.newPage()
  page.setDefaultTimeout(30_000)
  await page.goto(`${BASE}/daftar`)
  await page.getByLabel('Nama orang tua').fill('Ibu Uji Suara')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('checkbox', { name: /Saya setuju/ }).check()
  await sleep(2500) // Turnstile uji
  await page.getByRole('button', { name: 'Daftar', exact: true }).click()
  await page.getByRole('heading', { name: 'Cek email Anda' }).waitFor()
  await page.goto(await mailLink(email))
  await page.waitForURL(/\/mulai/, { timeout: 60_000 })
  for (const k of kids) {
    const form = page.getByRole('form', { name: 'Tambah anak' })
    if (!(await form.isVisible().catch(() => false))) {
      await page.getByRole('button', { name: /Tambah anak/ }).first().click()
      await form.waitFor()
    }
    await form.getByLabel('Nama panggilan').fill(k.name)
    await form.getByRole('radio', { name: String(k.grade), exact: true }).or(form.getByRole('button', { name: String(k.grade), exact: true })).first().click({ force: true })
    if (k.uiLang === 'en') await form.getByText('English', { exact: true }).click()
    for (const p of PICS) await form.getByRole('button', { name: p, exact: true }).click()
    await page.getByRole('checkbox', { name: /Saya orang tua atau wali/ }).check()
    await page.getByRole('button', { name: 'Tambahkan anak' }).click()
    await page.getByText(k.name, { exact: true }).first().waitFor()
    await sleep(1200)
  }
  await page.getByRole('link', { name: 'Lanjut pilih jalur' }).click()
  for (let i = 0; i < kids.length; i++) {
    await page.getByRole('button', { name: 'Pakai jalur rekomendasi' }).click()
    await sleep(1200)
    if (await page.getByRole('button', { name: 'Mulai belajar sebagai anak' }).isVisible().catch(() => false)) break
  }
  await page.getByRole('button', { name: 'Mulai belajar sebagai anak' }).click()
  await page.waitForURL((u) => u.pathname === '/', { timeout: 60_000 })
  await ctx.storageState({ path: stateFile })
  await ctx.close()
}

export async function pinIn(page: Page, name: string): Promise<void> {
  await page.goto(`${BASE}/`)
  await page.getByRole('link', { name: new RegExp(`^${name}\\b`) }).first().click()
  await page.waitForURL((u) => u.pathname.startsWith('/pin/') || u.pathname.startsWith('/masuk/anak/'))
  await sleep(Number(process.env.QA_PIN_WAIT ?? 300))
  for (const p of PICS) await page.getByRole('button', { name: new RegExp(`^(${p}|${EN_PICS[p]})$`) }).click()
  await page.waitForURL((u) => u.pathname === '/today', { timeout: 60_000 })
}

export function learner(name: string): { id: string; org: string; grade: number } {
  const row = psql(`select user_id, org_id, grade from learner_profile where name = '${name}' order by created_at desc limit 1;`)
  const [id, org, grade] = row.split('|')
  return { id: id!, org: org!, grade: Number(grade) }
}

export function makeAttempt(who: { id: string; org: string }, items: { id: string; difficulty?: number }[], subject: string, mode = 'latihan', limit: number | null = null): string {
  const js = JSON.stringify(items.map((r, i) => ({ ref: r.id, section: 'core', position: i + 1, difficulty: r.difficulty ?? 3 }))).replace(/'/g, "''")
  return psql(`insert into attempt (org_id, learner_id, kind, mode, subject, title, items, time_limit_s) values ('${who.org}','${who.id}','test','${mode}','${subject}','QA suara','${js}'::jsonb,${limit ?? 'null'}) returning id;`).split('\n')[0]!
}

export const SIZES = [
  { name: '390x844', width: 390, height: 844, touch: true },
  { name: '768x1024', width: 768, height: 1024, touch: true },
  { name: '1280x800', width: 1280, height: 800, touch: false },
]
export const WEBVIEW_UA = 'Mozilla/5.0 (Linux; Android 13; SM-T220 Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.6778.135 Safari/537.36 KiraAndroid/1.0.12'
