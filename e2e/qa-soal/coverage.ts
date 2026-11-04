// Cakupan semua jenis soal lewat runner sungguhan: benar, salah, ulangi benar. Menulis JSON hasil ke QA_OUT.
import { mkdirSync, writeFileSync } from 'node:fs'
import { allItems } from './lib'
import { answer, BASE, chromium, ids, layoutProbe, login, makeAttempt, PHONE, pollStatus, sheetProbe, sql, TABLET, type Issue, type Page } from './driver'
import { generateItem, GENERATORS, genRef } from '../../packages/content/src/math'
import type { Item } from '../../packages/content/src/schema'

const OUT = process.env.QA_OUT ?? 'C:/kw5/qa-soal/.kira-local/qa'
mkdirSync(`${OUT}/shots`, { recursive: true })
const K = Number(process.env.QA_K ?? 2)
const ONLY = process.env.QA_TYPES?.split(',')
const WORKERS = Number(process.env.QA_WORKERS ?? 2)
const OUTFILE = process.env.QA_FILE ?? 'coverage.json'
const MANUAL = new Set(['speak', 'draw', 'photo'])

function sample(): Item[] {
  const all = allItems().filter((i) => !MANUAL.has(i.type))
  const by = new Map<string, Item[]>()
  for (const it of all) {
    const k = `${it.type}|${it.id.slice(0, 2)}`
    const list = by.get(k) ?? []
    list.push(it)
    by.set(k, list)
  }
  const out: Item[] = []
  for (const list of by.values()) {
    // Variasi: yang berbacaan, bergambar, lalu tengah dan akhir bank.
    const sorted = [...list].sort((a, b) => a.id.localeCompare(b.id))
    const pick: Item[] = []
    const add = (x?: Item) => {
      if (x && !pick.includes(x) && pick.length < K) pick.push(x)
    }
    add(sorted.find((x) => x.passage))
    add(sorted.find((x) => x.figure))
    add(sorted[Math.floor(sorted.length / 2)])
    add(sorted[sorted.length - 1])
    out.push(...pick)
  }
  // Generator Math: satu per jenis dan kelas.
  const seen = new Set<string>()
  for (const [skill, g] of GENERATORS) {
    for (const lv of g.levels) {
      let gi: Item
      try {
        gi = generateItem(genRef(skill, lv, 'qa1'))
      } catch {
        continue
      }
      const k = `${gi.type}|${skill.slice(0, 2)}`
      if (seen.has(k)) continue
      seen.add(k)
      out.push(gi)
    }
  }
  return ONLY ? out.filter((i) => ONLY.includes(i.type)) : out
}

type Row = { ref: string; type: string; grade: string; flow: string; vw: number; rightRight?: boolean; wrongWrong?: boolean; sheet: boolean; explanation: boolean; next: boolean; issues: Issue[]; error?: string; sec: number }
const rows: Row[] = []
const net: string[] = []

function watch(page: Page, tag: () => string) {
  page.on('console', (m) => {
    if (m.type() === 'error') net.push(`${tag()} console: ${m.text().slice(0, 240)}`)
  })
  page.on('pageerror', (e) => net.push(`${tag()} pageerror: ${e.message.slice(0, 240)}`))
  page.on('response', (r) => {
    if (r.status() >= 400) net.push(`${tag()} HTTP ${r.status()} ${r.url().replace(BASE, '')}`)
  })
  page.on('requestfailed', (r) => {
    const f = r.failure()?.errorText ?? ''
    if (!f.includes('ERR_ABORTED')) net.push(`${tag()} failed ${f} ${r.url().replace(BASE, '')}`)
  })
}

const shotDone = new Set<string>()
async function shot(page: Page, name: string, full = false) {
  if (shotDone.has(name)) return
  shotDone.add(name)
  await page.screenshot({ path: `${OUT}/shots/${name}.png`, fullPage: full }).catch(() => {})
}

async function waitSheet(page: Page, title: RegExp) {
  await page.locator('[role=status] h2', { hasText: title }).first().waitFor({ timeout: 10000 })
}

async function flow(page: Page, who: { org: string; id: string }, item: Item, filler: { ref: string; difficulty: number }, flowName: 'right' | 'wrong' | 'retry', vw: number) {
  const started = Date.now()
  const grade = item.skill.slice(0, 2)
  const row: Row = { ref: item.id, type: item.type, grade, flow: flowName, vw, sheet: false, explanation: false, next: false, issues: [], sec: 0 }
  rows.push(row)
  const subject = item.skill[0] === 'm' ? 'math' : item.skill[0] === 'e' ? 'english' : 'science'
  const attemptId = await makeAttempt(who, [{ ref: item.id, difficulty: item.difficulty }, filler], subject)
  const safe = `${item.type}-${grade}-${vw}`
  try {
    await page.setViewportSize(vw === 375 ? PHONE : TABLET)
    await page.goto(`${BASE}/run/${attemptId}`, { waitUntil: 'domcontentloaded' })
    await page.locator('section[aria-label="Your answer"]').waitFor({ timeout: 15000 })
    await page.waitForTimeout(150)
    row.issues.push(...(await layoutProbe(page)))
    await shot(page, `${safe}-q`)
    const check = page.getByRole('button', { name: item.type === 'write' ? 'Send to tutor' : 'Check', exact: true })
    const O = { issues: row.issues }
    if (item.type === 'write') {
      await answer(page, item, true, O)
      await check.click({ timeout: 8000 })
      await waitSheet(page, /Sent to your tutor/)
      row.sheet = true
      row.explanation = true
      const s = await pollStatus(attemptId, 1, 1)
      row.rightRight = s === 'pending'
    } else if (flowName === 'right') {
      await answer(page, item, true, O)
      await shot(page, `${safe}-answered`)
      row.issues.push(...(await layoutProbe(page)).filter((x) => x.kind !== 'small-target'))
      await check.click({ timeout: 8000 })
      await waitSheet(page, /^Correct$/).catch(async (e) => {
        row.error = `sheet bukan Correct: ${await page.locator('[role=status] h2').first().textContent().catch(() => '?')}`
        throw e
      })
      row.sheet = true
      row.issues.push(...(await sheetProbe(page)))
      row.explanation = await page.locator('[role=status]').filter({ hasText: item.explanation.slice(0, 40) }).first().isVisible().catch(() => false)
      await shot(page, `${safe}-right`)
      const s = await pollStatus(attemptId, 1, 1)
      row.rightRight = s === 'correct'
      if (!row.rightRight) row.error = `server: ${s}`
    } else if (flowName === 'wrong') {
      await answer(page, item, false, O)
      await check.click({ timeout: 8000 })
      await waitSheet(page, /^Not yet$/).catch(async (e) => {
        row.error = `sheet bukan Not yet: ${await page.locator('[role=status] h2').first().textContent().catch(() => '?')}`
        throw e
      })
      row.sheet = true
      const s1 = await pollStatus(attemptId, 1, 1)
      await shot(page, `${safe}-notyet`)
      row.issues.push(...(await sheetProbe(page)))
      await page.getByRole('button', { name: 'Try again', exact: true }).click({ timeout: 8000 })
      await page.waitForTimeout(80)
      await answer(page, item, false, O)
      await check.click({ timeout: 8000 })
      await page.getByText('How to solve it').first().waitFor({ timeout: 10000 })
      row.explanation = await page.locator('[role=status]').filter({ hasText: item.explanation.slice(0, 40) }).first().isVisible().catch(() => false)
      if (!(await page.getByText('The answer', { exact: true }).first().isVisible().catch(() => false))) row.issues.push({ kind: 'no-answer-text', detail: 'kunci tidak tampil setelah salah dua kali' })
      row.issues.push(...(await sheetProbe(page)))
      await shot(page, `${safe}-revealed`)
      const s2 = await pollStatus(attemptId, 1, 2)
      row.wrongWrong = s1 === 'wrong' && s2 === 'wrong'
      if (!row.wrongWrong) row.error = `server: ${s1}/${s2}`
    } else {
      await answer(page, item, false, O)
      await check.click({ timeout: 8000 })
      await waitSheet(page, /^Not yet$/)
      await page.getByRole('button', { name: 'Try again', exact: true }).click({ timeout: 8000 })
      await page.waitForTimeout(80)
      await answer(page, item, true, O)
      await check.click({ timeout: 8000 })
      await waitSheet(page, /^Correct$/)
      row.sheet = true
      row.explanation = true
      await page.getByText('Right on the second try.').first().waitFor({ timeout: 4000 })
      const s = await pollStatus(attemptId, 1, 2)
      row.rightRight = s === 'correct'
      if (!row.rightRight) row.error = `server: ${s}`
    }
    await page.locator('[role=status]').getByRole('button', { name: /^(Next|Finish)$/ }).first().click({ timeout: 8000 })
    await page.locator('header').getByText(/Question 2 of 2|2\/2/).locator('visible=true').first().waitFor({ timeout: 8000 })
    row.next = true
  } catch (e) {
    row.error = (row.error ? `${row.error} | ` : '') + String(e).replace(/\s+/g, ' ').slice(0, 300)
    await page.screenshot({ path: `${OUT}/shots/ERR-${flowName}-${item.id.replace(/[:.]/g, '_')}-${vw}.png` }).catch(() => {})
  }
  row.sec = Math.round((Date.now() - started) / 100) / 10
}

async function main() {
  const items = sample()
  console.log('sampel', items.length)
  const { org, raka } = await ids()
  const who = { org, id: raka }
  const fillerItem = allItems().find((i) => i.type === 'mcq' && !i.passage && !i.figure && i.id.startsWith('e4.'))!
  const filler = { ref: fillerItem.id, difficulty: fillerItem.difficulty }
  const browser = await chromium.launch()
  const save = () => writeFileSync(`${OUT}/${OUTFILE}`, JSON.stringify({ rows, net }, null, 1))
  const queue = items.map((it, i) => ({ it, i }))
  const worker = async (w: number) => {
    const ctx = await browser.newContext({ locale: 'en-GB', timezoneId: 'Asia/Jakarta', viewport: TABLET, hasTouch: true })
    let tag = `w${w}`
    const page = await login(ctx, 'Raka')
    watch(page, () => tag)
    const seen = new Set<string>()
    for (;;) {
      const job = queue.shift()
      if (!job) break
      const { it, i } = job
      tag = it.id
      const a = i % 2 === 0 ? 375 : 800
      const b = i % 2 === 0 ? 800 : 375
      await flow(page, who, it, filler, 'right', a)
      if (it.type !== 'write') await flow(page, who, it, filler, 'wrong', b)
      if (!seen.has(it.type) && it.type !== 'write') {
        seen.add(it.type)
        await flow(page, who, it, filler, 'retry', a)
      }
      if (i % 10 === 0) {
        save()
        console.log(i, new Date().toISOString(), rows.filter((r) => r.error).length, 'error')
      }
    }
    await ctx.close()
  }
  await Promise.all(Array.from({ length: WORKERS }, (_, w) => worker(w)))
  await browser.close()
  save()
  const t: Record<string, { grades: Set<string>; tried: number; rr: number; rrN: number; ww: number; wwN: number; noSheet: number; noExpl: number; noNext: number }> = {}
  for (const r of rows) {
    const x = (t[r.type] ??= { grades: new Set(), tried: 0, rr: 0, rrN: 0, ww: 0, wwN: 0, noSheet: 0, noExpl: 0, noNext: 0 })
    x.grades.add(r.grade)
    x.tried++
    if (r.flow !== 'wrong') {
      x.rrN++
      if (r.rightRight) x.rr++
    } else {
      x.wwN++
      if (r.wrongWrong) x.ww++
    }
    if (!r.sheet) x.noSheet++
    if (!r.explanation) x.noExpl++
    if (!r.next) x.noNext++
  }
  for (const [k, v] of Object.entries(t).sort()) console.log(k.padEnd(12), [...v.grades].sort().join(',').padEnd(40), `tried ${v.tried}`, `right ${v.rr}/${v.rrN}`, `wrong ${v.ww}/${v.wwN}`, `noSheet ${v.noSheet} noExpl ${v.noExpl} noNext ${v.noNext}`)
  console.log('errors:')
  for (const r of rows.filter((x) => x.error)) console.log(r.flow, r.ref, r.vw, r.error)
  const kinds: Record<string, number> = {}
  for (const r of rows) for (const i of r.issues) kinds[i.kind] = (kinds[i.kind] ?? 0) + 1
  console.log('issues', kinds)
  const netc: Record<string, number> = {}
  for (const n of net) {
    const k = n.replace(/^\S+ /, '')
    netc[k] = (netc[k] ?? 0) + 1
  }
  console.log('net', netc)
  await sql.end()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
