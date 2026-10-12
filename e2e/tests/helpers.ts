import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, type BrowserContext, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import postgres from 'postgres'

/** Akun dan data dari packages/db/scripts/seed.ts (org __GTX_SEED__). */
export const TUTOR = { email: 'tutor@contoh.test', password: 'kira-tutor-contoh-2026' }
export const GUARDIAN = { email: 'mama@contoh.test', password: 'kira-mama-contoh-2026' }
export const LEARNERS = {
  Aisha: { grade: 2, pin: ['Sun', 'Moon', 'Star', 'Cat'] },
  Raka: { grade: 4, pin: ['Tree', 'Apple', 'Boat', 'Ball'] },
} as const
export type LearnerName = keyof typeof LEARNERS

const ROOT = fileURLToPath(new URL('../..', import.meta.url))

let client: postgres.Sql | null = null

/** Koneksi pemilik database (melewati RLS) hanya untuk menyiapkan dan memeriksa data tes. */
export function db(): postgres.Sql {
  if (!client) {
    const url = process.env.DATABASE_URL_OWNER
    if (!url) throw new Error('DATABASE_URL_OWNER belum diisi')
    client = postgres(url, { max: 2, onnotice: () => {} })
  }
  return client
}

export async function closeDb(): Promise<void> {
  await client?.end()
  client = null
}

export async function seedOrgId(): Promise<string> {
  const rows = await db()`select id from org where name like ${'%__GTX_SEED__%'} order by created_at limit 1`
  return rows[0]!.id as string
}

export async function learnerId(name: LearnerName): Promise<string> {
  const org = await seedOrgId()
  const rows = await db()`select user_id from learner_profile where org_id = ${org} and name = ${name} limit 1`
  return rows[0]!.user_id as string
}

/** Hari ini di Asia/Jakarta (YYYY-MM-DD). */
export function jakartaToday(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)
}

export async function loginAdult(page: Page, who: { email: string; password: string }, next?: string): Promise<void> {
  await page.goto(next ? `/masuk?next=${encodeURIComponent(next)}` : '/masuk')
  await page.getByLabel('Email').first().fill(who.email)
  await page.getByLabel('Password', { exact: true }).fill(who.password)
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await waitForPath(page, (p) => !p.startsWith('/masuk'))
}

/**
 * Tunggu sampai alamat halaman cocok. Dipakai sebagai ganti waitForURL karena action yang mengganti
 * cookie lalu redirect bisa membatalkan satu navigasi di tengah jalan (net::ERR_ABORTED) di CI yang lambat.
 */
export async function waitForPath(page: Page, ok: (pathname: string) => boolean, timeout = 30_000): Promise<void> {
  await expect.poll(() => ok(new URL(page.url()).pathname), { timeout, intervals: [100, 250, 500] }).toBe(true)
  await page.waitForLoadState('domcontentloaded').catch(() => {})
}

/** Daftarkan browser ini sebagai tablet learner (tutor masuk, lalu otomatis keluar). */
export async function registerTablet(page: Page, learners: LearnerName[] = ['Aisha', 'Raka'], name = 'Tablet e2e'): Promise<void> {
  await loginAdult(page, TUTOR, '/perangkat')
  await page.goto('/perangkat')
  await page.getByLabel('Nama tablet').fill(name)
  for (const l of learners) await page.getByRole('checkbox', { name: l }).check()
  await page.getByRole('button', { name: 'Daftarkan tablet' }).click()
  await waitForPath(page, (p) => p === '/')
}

/** Pilih learner di tablet lalu masukkan PIN gambar. */
export async function pinLogin(page: Page, name: LearnerName): Promise<void> {
  await page.goto('/')
  await page.getByRole('link', { name: new RegExp(`^${name}, Grade`) }).click()
  await waitForPath(page, (p) => p.startsWith('/pin/'))
  for (const p of LEARNERS[name].pin) await page.getByRole('button', { name: p, exact: true }).click()
  await waitForPath(page, (p) => p === '/today')
}

/** Item MCQ dari konten repo untuk satu skill (dipakai untuk attempt tes yang bisa ditebak isinya). */
export function mcqItems(prefix: string, count: number): { id: string; answer: number; options: { text?: string }[]; difficulty: number }[] {
  const dir = join(ROOT, 'content', 'items')
  const out: { id: string; answer: number; options: { text?: string }[]; difficulty: number }[] = []
  const walk = (d: string) => {
    for (const f of readdirSync(d).sort()) {
      const p = join(d, f)
      if (statSync(p).isDirectory()) walk(p)
      else if (f.endsWith('.json')) {
        const file = JSON.parse(readFileSync(p, 'utf8')) as { items: { id: string; type: string; answer: number; options: { text?: string; figure?: unknown }[]; difficulty: number; passage?: string; figure?: unknown; lang?: string }[] }
        for (const it of file.items) {
          if (out.length >= count) return
          if (it.id.startsWith(prefix) && it.type === 'mcq' && !it.passage && !it.figure && it.lang !== 'id' && it.options.every((o) => o.text && !o.figure)) out.push(it)
        }
      }
    }
  }
  walk(dir)
  return out
}

/** Attempt latihan berisi soal yang diketahui, langsung untuk learner itu. */
export async function createPracticeAttempt(name: LearnerName, refs: { id: string; difficulty: number }[], opts: { mode?: 'latihan' | 'tes'; timeLimitS?: number } = {}): Promise<string> {
  const org = await seedOrgId()
  const lid = await learnerId(name)
  const items = refs.map((r, i) => ({ ref: r.id, section: 'core', position: i + 1, difficulty: r.difficulty }))
  const rows = await db()`
    insert into attempt (org_id, learner_id, kind, mode, subject, title, items, time_limit_s)
    values (${org}, ${lid}, 'test', ${opts.mode ?? 'latihan'}, 'english', 'E2E practice', ${db().json(items)}, ${opts.timeLimitS ?? null})
    returning id`
  return rows[0]!.id as string
}

/** Jalankan axe dan gagal bila ada pelanggaran serius atau kritis. */
export async function expectNoSeriousA11y(page: Page, label: string): Promise<void> {
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
  const bad = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(bad.map((v) => `${label}: ${v.id} (${v.impact}) ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([])
}

/** Kumpulkan error konsol dan respons HTTP >= 500 selama tes. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 300)}`)
  })
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('response', (r) => {
    if (r.status() >= 500) errors.push(`HTTP ${r.status()} ${r.url()}`)
  })
  return errors
}

export async function noHorizontalScroll(page: Page): Promise<void> {
  const { scrollW, innerW } = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth }))
  expect(scrollW, 'halaman tidak boleh bergeser ke samping').toBeLessThanOrEqual(innerW)
}

export async function newTabletContext(context: BrowserContext): Promise<Page> {
  return context.newPage()
}
