// Naik level, peti harian, dan lencana baru: muncul, berakhir, tidak menghalangi, tenang dengan reduced motion.
import { mkdirSync } from 'node:fs'
import { allItems } from './lib'
import { answer, BASE, chromium, ids, login, makeAttempt, PHONE, sql, TABLET, type Page } from './driver'
import { levelForXp as levelFromXp, xpForLevel } from '../../packages/core/src/xp'
import type { Browser } from '@playwright/test'

const OUT = 'C:/kw5/qa-soal/.kira-local/qa-motion2'
mkdirSync(OUT, { recursive: true })
const say = (ok: boolean | string, msg: string) => console.log(`${ok === true ? 'OK  ' : ok === false ? 'BAD ' : `${ok} `} ${msg}`)
const today = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)

async function nearLevelUp(org: string, id: string) {
  const [r] = await sql`select coalesce(sum(amount),0)::int as x from xp_event where learner_id = ${id} and track = 'belajar'`
  const total = r!.x as number
  const next = xpForLevel(levelFromXp(total) + 1)
  const add = next - total - 3
  if (add > 0) await sql`insert into xp_event (org_id, learner_id, amount, reason, date, track) values (${org}, ${id}, ${add}, 'qa', ${today()}, 'belajar')`
  return { total, next }
}

async function session(page: Page, who: { org: string; id: string }, slice: number) {
  const items = allItems().filter((i) => i.type === 'mcq' && i.id.startsWith('e2.') && !i.figure && !i.passage).slice(slice, slice + 3)
  const id = await makeAttempt(who, items.map((i) => ({ ref: i.id, difficulty: i.difficulty })), 'english')
  await page.goto(`${BASE}/run/${id}`)
  await page.locator('section[aria-label="Your answer"]').waitFor()
  for (const it of items) {
    await answer(page, it, true, { issues: [] })
    await page.getByRole('button', { name: 'Check', exact: true }).click()
    await page.locator('[role=status] h2', { hasText: /^Correct$/ }).first().waitFor()
    await page.locator('[role=status]').getByRole('button', { name: /^(Next|Finish)$/ }).first().click()
  }
  await page.waitForURL((u) => u.pathname.startsWith('/results/'), { timeout: 20000 })
}

async function levelUp(browser: Browser, tag: string, reduced: boolean, who: { org: string; id: string }, slice: number) {
  const ctx = await browser.newContext({ locale: 'en-GB', timezoneId: 'Asia/Jakarta', viewport: reduced ? PHONE : TABLET, hasTouch: true, ...(reduced ? { reducedMotion: 'reduce' as const } : {}) })
  const page = await login(ctx, 'Aisha')
  const errs: string[] = []
  page.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
  const { next } = await nearLevelUp(who.org, who.id)
  await session(page, who, slice)
  const overlay = page.getByText('You levelled up!', { exact: true })
  await overlay.waitFor({ timeout: 8000 }).catch(() => undefined)
  const shown = await overlay.isVisible().catch(() => false)
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/${tag}-levelup.png` })
  say(shown, `${tag}: layar naik level muncul (ambang ${next} XP)`)
  if (shown) {
    if (reduced) {
      const anim = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && (a.effect?.getComputedTiming().duration ?? 0) as number > 200).length)
      say(anim === 0, `${tag}: tidak ada animasi panjang saat naik level (${anim})`)
    }
    await page.getByRole('button', { name: 'Continue', exact: true }).click({ timeout: 8000 })
    await overlay.waitFor({ state: 'hidden', timeout: 4000 })
    say(true, `${tag}: Continue menutup layar naik level`)
  }
  // Tanpa menekan apa pun: berakhir sendiri?
  await nearLevelUp(who.org, who.id)
  await session(page, who, slice + 3)
  await overlay.waitFor({ timeout: 8000 }).catch(() => undefined)
  const shown2 = await overlay.isVisible().catch(() => false)
  await page.waitForTimeout(6000)
  const still = await overlay.isVisible().catch(() => false)
  say(shown2 && !still, `${tag}: layar naik level berakhir sendiri (muncul ${shown2}, masih ${still})`)
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}/${tag}-after-levelup.png`, fullPage: true })
  const back = page.getByRole('link', { name: /Back to Today/ }).or(page.getByRole('button', { name: /Back to Today/ })).first()
  await back.click({ timeout: 8000 })
  await page.waitForURL((u) => u.pathname === '/today', { timeout: 15000 })
  say(errs.length === 0, `${tag}: pageerror ${JSON.stringify(errs)}`)
  await ctx.close()
}

async function chest(browser: Browser, tag: string, reduced: boolean, who: { org: string; id: string }) {
  const ctx = await browser.newContext({ locale: 'en-GB', timezoneId: 'Asia/Jakarta', viewport: reduced ? PHONE : TABLET, hasTouch: true, ...(reduced ? { reducedMotion: 'reduce' as const } : {}) })
  const page = await login(ctx, 'Aisha')
  const bad: string[] = []
  page.on('response', (r) => {
    if (r.status() >= 400 && !r.url().includes('/api/heartbeat')) bad.push(`${r.status()} ${r.url().replace(BASE, '')}`)
  })
  await page.goto(`${BASE}/today`)
  await page.waitForTimeout(800)
  await sql`delete from daily_chest where learner_id = ${who.id} and date = ${today()}`
  await sql`update quest set status = 'done' where learner_id = ${who.id} and date = ${today()}`
  await page.goto(`${BASE}/today`)
  const open = page.getByRole('button', { name: 'Open your chest' })
  await open.waitFor({ timeout: 10000 }).catch(() => undefined)
  const ready = await open.isVisible().catch(() => false)
  await page.screenshot({ path: `${OUT}/${tag}-chest-ready.png` })
  say(ready, `${tag}: peti siap dibuka setelah semua sesi selesai`)
  if (ready) {
    await open.scrollIntoViewIfNeeded()
    await open.click()
    await page.waitForTimeout(1600)
    await page.screenshot({ path: `${OUT}/${tag}-chest-open.png` })
    const text = await page.locator('[aria-labelledby="chest-title"]').innerText().catch(() => '')
    say(text.length > 0, `${tag}: isi peti "${text.replace(/\s+/g, ' ').slice(0, 110)}"`)
    await page.waitForTimeout(2500)
    const fullScreen = await page.evaluate(() => {
      const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2)
      return el?.closest('canvas, .fixed')?.tagName ?? null
    })
    say(fullScreen === null || fullScreen !== 'CANVAS', `${tag}: tidak ada lapisan yang menghalangi setelah peti (${fullScreen})`)
    await page.reload()
    await page.waitForTimeout(1000)
    const again = await page.getByRole('button', { name: 'Open your chest' }).count()
    say(again === 0, `${tag}: peti hanya sekali sehari setelah muat ulang (tombol ${again})`)
    await page.locator('[aria-labelledby="chest-title"]').scrollIntoViewIfNeeded().catch(() => undefined)
    await page.screenshot({ path: `${OUT}/${tag}-chest-after-reload.png` })
  }
  say(bad.length === 0, `${tag}: permintaan gagal ${JSON.stringify(bad.slice(0, 4))}`)
  await ctx.close()
}

async function main() {
  const { org, aisha } = await ids()
  const who = { org, id: aisha }
  const browser = await chromium.launch()
  await levelUp(browser, 'normal', false, who, 40)
  await levelUp(browser, 'reduced', true, who, 60)
  await chest(browser, 'normal', false, who)
  await chest(browser, 'reduced', true, who)
  await browser.close()
  await sql.end()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
