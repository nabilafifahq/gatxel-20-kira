// Sapuan tata letak tanpa menjawab: semua tabel, label, hotspot, figur per jenis, opsi panjang, di 375 dan 800 px.
import { mkdirSync, writeFileSync } from 'node:fs'
import { allItems } from './lib'
import { BASE, chromium, ids, layoutProbe, login, makeAttempt, PHONE, sql, TABLET, type Issue, type Page } from './driver'
import type { Item } from '../../packages/content/src/schema'

const OUT = process.env.QA_OUT ?? 'C:/kw5/qa-soal/.kira-local/qa-sweep'
mkdirSync(`${OUT}/shots`, { recursive: true })
const GROUPS = process.env.QA_GROUPS?.split(',')

function groups(): Record<string, Item[]> {
  const items = allItems()
  const out: Record<string, Item[]> = {}
  out.table = items.filter((i) => i.type === 'table')
  out.label = items.filter((i) => i.type === 'label')
  out.hotspot = items.filter((i) => i.type === 'hotspot')
  out.small = items.filter((i) => ['numberline', 'clock', 'fraction'].includes(i.type))
  out.cloze = items.filter((i) => i.type === 'cloze')
  out.match = items.filter((i) => i.type === 'match').filter((_, i) => i % 3 === 0)
  out.text = items.filter((i) => i.type === 'text').filter((_, i) => i % 6 === 0)
  out.order = items.filter((i) => i.type === 'order').filter((_, i) => i % 4 === 0)
  out.sort = items.filter((i) => i.type === 'sort').filter((_, i) => i % 5 === 0)
  out.tiles = items.filter((i) => i.type === 'tiles').filter((_, i) => i % 3 === 0)
  out.story = items.filter((i) => i.type === 'story').filter((_, i) => i % 3 === 0)
  out.longopt = items.filter((i) => (i.type === 'mcq' || i.type === 'multi') && i.options.some((o) => (o.text ?? '').split(/\s+/).some((w) => w.length >= 11))).slice(0, 120)
  out.grid = items.filter((i) => i.type === 'grid').slice(0, 12)
  const byKind = new Map<string, Item[]>()
  for (const it of items) {
    const f = it.figure as { type?: string; kind?: string } | undefined
    if (!f || it.type === 'hotspot' || it.type === 'label') continue
    const k = `${f.type ?? f.kind ?? '?'}|${it.skill.slice(0, 2)}`
    const list = byKind.get(k) ?? []
    if (list.length < 4) list.push(it)
    byKind.set(k, list)
  }
  out.figure = [...byKind.values()].flat()
  const optFig = items.filter((i) => (i.type === 'mcq' || i.type === 'multi') && i.options.some((o) => o.figure))
  out.optfigure = optFig.filter((_, i) => i % Math.max(1, Math.floor(optFig.length / 80)) === 0).slice(0, 80)
  const passage = items.filter((i) => i.passage && Number(i.skill[1]) >= 4)
  out.passage = passage.filter((_, i) => i % Math.max(1, Math.floor(passage.length / 40)) === 0).slice(0, 40)
  return GROUPS ? Object.fromEntries(Object.entries(out).filter(([k]) => GROUPS.includes(k))) : out
}

async function walk(page: Page, who: { org: string; id: string }, name: string, list: Item[], vw: number, found: Record<string, { ref: string; vw: number; kind: string; detail: string }[]>) {
  const chunk = 25
  for (let s = 0; s < list.length; s += chunk) {
    const part = list.slice(s, s + chunk)
    const subject = part[0]!.skill[0] === 'm' ? 'math' : part[0]!.skill[0] === 'e' ? 'english' : 'science'
    const id = await makeAttempt(who, part.map((i) => ({ ref: i.id, difficulty: i.difficulty })), subject, { mode: 'tes' })
    await page.setViewportSize(vw === 375 ? PHONE : TABLET)
    await page.goto(`${BASE}/run/${id}`, { waitUntil: 'domcontentloaded' })
    for (let i = 0; i < part.length; i++) {
      const it = part[i]!
      try {
        await page.getByText(new RegExp(`Question ${i + 1} of`)).first().waitFor({ timeout: 8000 })
        await page.locator('section[aria-label="Answers"]').first().waitFor({ timeout: 8000 })
        await page.waitForTimeout(40)
        const issues: Issue[] = await page.evaluate(() => {
          // layoutProbe memakai section "Your answer"; mode tes memakai "Answers". Samakan label sementara.
          const a = document.querySelector('section[aria-label="Answers"]')
          if (a) a.setAttribute('aria-label', 'Your answer')
          return []
        })
        issues.push(...(await layoutProbe(page)))
        await page.evaluate(() => {
          const a = document.querySelector('section[aria-label="Your answer"]')
          if (a) a.setAttribute('aria-label', 'Answers')
        })
        for (const x of issues) (found[name] ??= []).push({ ref: it.id, vw, kind: x.kind, detail: x.detail })
        if (i === 0 || issues.some((x) => x.kind !== 'small-target')) await page.screenshot({ path: `${OUT}/shots/${name}-${vw}-${it.id.replace(/[:.]/g, '_')}.png`, fullPage: true }).catch(() => {})
        if (i < part.length - 1) await page.getByRole('button', { name: 'Next', exact: true }).click({ timeout: 8000 })
      } catch (e) {
        ;(found[name] ??= []).push({ ref: it.id, vw, kind: 'walk-error', detail: String(e).replace(/\s+/g, ' ').slice(0, 200) })
        await page.goto(`${BASE}/run/${id}`, { waitUntil: 'domcontentloaded' })
        await page.getByRole('button', { name: new RegExp(`^Question ${i + 2},`) }).click({ timeout: 8000 }).catch(() => {})
      }
    }
  }
}

async function main() {
  const g = groups()
  console.log(Object.entries(g).map(([k, v]) => `${k}:${v.length}`).join(' '))
  const { org, raka } = await ids()
  const who = { org, id: raka }
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ locale: 'en-GB', timezoneId: 'Asia/Jakarta', viewport: TABLET, hasTouch: true })
  const page = await login(ctx, 'Raka')
  const found: Record<string, { ref: string; vw: number; kind: string; detail: string }[]> = {}
  const save = () => writeFileSync(`${OUT}/sweep.json`, JSON.stringify(found, null, 1))
  for (const [name, list] of Object.entries(g)) {
    for (const vw of [375, 800]) {
      await walk(page, who, name, list, vw, found)
      save()
      const f = found[name] ?? []
      const kinds: Record<string, number> = {}
      for (const x of f) kinds[`${x.vw}:${x.kind}`] = (kinds[`${x.vw}:${x.kind}`] ?? 0) + 1
      console.log(name, vw, new Date().toISOString(), JSON.stringify(kinds))
    }
  }
  await browser.close()
  await sql.end()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
