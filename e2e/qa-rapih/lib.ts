// Pembantu QA boss dan batas layar: hanya memakai Raka, tidak pernah seed ulang. Jalankan dari folder e2e dengan env rapih.
import type { Page } from '@playwright/test'
import { allItems } from '../qa-soal/lib'
import { answer, BASE, chromium, ids, layoutProbe, login, sql } from '../qa-soal/driver'
import { generateItem, parseGenRef } from '../../packages/content/src/math'
import type { Item } from '../../packages/content/src/schema'

export { answer, BASE, chromium, ids, layoutProbe, login, sql }
export const OUT = 'C:/kw5/rapih-shots/boss'
export const say = (ok: boolean | string, msg: string) => console.log(`${ok === true ? 'OK  ' : ok === false ? 'BAD ' : `${ok} `} ${msg}`)
export const VIEW = { phone: { width: 375, height: 812 }, tablet: { width: 800, height: 1100 } }

const pool = new Map<string, Item>()
export function itemOf(ref: string): Item {
  if (parseGenRef(ref)) return generateItem(ref)
  if (pool.size === 0) for (const i of allItems()) pool.set(i.id, i)
  const it = pool.get(ref)
  if (!it) throw new Error(`soal ${ref} tidak ada di content/items`)
  return it
}

export type Snap = { stars: number; starRows: number; xp: number; xpRows: number; cards: string[]; progress: unknown }
export async function snap(id: string): Promise<Snap> {
  const [s] = await sql`select coalesce(sum(amount),0)::int t, count(*)::int n from star_ledger where learner_id = ${id}`
  const [x] = await sql`select coalesce(sum(amount),0)::int t, count(*)::int n from xp_event where learner_id = ${id}`
  const c = await sql`select card_id from world_card where learner_id = ${id} order by card_id`
  const [w] = await sql`select progress from world_state where learner_id = ${id}`
  return { stars: s!.t, starRows: s!.n, xp: x!.t, xpRows: x!.n, cards: c.map((r) => r.card_id as string), progress: w?.progress ?? null }
}

/** Mata-mata bunyi: setiap AudioBufferSourceNode yang dimulai dicatat sebelum halaman jalan. */
export const SPY = () => {
  const w = window as unknown as { __sfx: number }
  w.__sfx = 0
  const start = AudioBufferSourceNode.prototype.start
  AudioBufferSourceNode.prototype.start = function (...a: Parameters<typeof start>) {
    w.__sfx += 1
    return start.apply(this, a)
  }
}
export const sfx = (p: Page) => p.evaluate(() => (window as unknown as { __sfx: number }).__sfx ?? 0)
export const energy = (p: Page) => p.getByRole('progressbar').first().getAttribute('aria-valuenow')
export const panelBtn = (p: Page) => p.locator('[role=status]').getByRole('button', { name: /^(Next|Finish|Lanjut|Selesai)$/ })

export async function latestAttempt(id: string, bossId: string) {
  const [a] = await sql`select id, items, status, ref_id from attempt where learner_id = ${id} and ref_id like ${'boss:%:' + bossId + ':%'} order by created_at desc limit 1`
  return a as unknown as { id: string; items: { ref: string; position: number; remedialOf?: number }[]; status: string; ref_id: string }
}

/** Satu soal lewat UI sungguhan. Benar: sekali Check. Salah: salah dua kali sampai jawaban terbuka. */
export async function oneQuestion(page: Page, item: Item, right: boolean, o: { dbl?: boolean } = {}) {
  const check = page.getByRole('button', { name: 'Check', exact: true })
  await answer(page, item, right, { issues: [] })
  if (o.dbl) await check.dblclick({ timeout: 8000 })
  else await check.click({ timeout: 8000 })
  if (right) return
  const retry = page.getByRole('button', { name: 'Try again', exact: true })
  await retry.waitFor({ timeout: 10000 })
  await retry.click()
  await answer(page, item, false, { issues: [] })
  await check.click({ timeout: 8000 })
}

export function watch(page: Page): string[] {
  const errs: string[] = []
  page.on('pageerror', (e) => errs.push(`pageerror ${e.message.slice(0, 200)}`))
  page.on('response', (r) => {
    if (r.status() >= 500) errs.push(`HTTP ${r.status()} ${r.url()}`)
  })
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errs.push(`console ${m.text().slice(0, 200)}`)
  })
  return errs
}

export const noScroll = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
