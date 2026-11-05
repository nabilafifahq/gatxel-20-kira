// Cakupan suara satu anak per kelas: sesi sungguhan dan pelajaran sungguhan. Menghitung tombol tampil, tombol tersembunyi, dan klip 404.
// Juga perilaku muat: soal pertama hanya mengambil klip soal ini dan soal berikutnya.
import { chromium, type Page } from '@playwright/test'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { EN_VER, ID_VER, INIT, OUT, ROOT, WEBVIEW_UA, clipKey, idOf, makeAttempt, man, pinIn, psql, qa, sleep, trackNet, useStaging, type Net } from './lib'
import { allItems } from '../qa-soal/lib'
import { generateItem, isGenRef } from '../../packages/content/src/math'
import { itemSpeechClips } from '../../packages/content/src/speech'
import type { Item } from '../../packages/content/src/schema'

void WEBVIEW_UA
type Kid = { name: string; grade: number; id: string; org: string; state: string; uiLang: string }
const kids = (JSON.parse(readFileSync(join(OUT, 'kids.json'), 'utf8')) as Kid[]).filter((k) => k.name.startsWith('Suara'))
const CAP = Number(process.env.QA_CAP ?? 8)
const ONLY_GRADES = process.env.QA_GRADES?.split(',').map(Number)
const byId = new Map(allItems().map((i) => [i.id, i]))
const itemOf = (ref: string): Item | null => {
  try {
    return byId.get(ref) ?? (isGenRef(ref) ? generateItem(ref) : null)
  } catch {
    return null
  }
}
const keysOfItem = (it: Item, withSolution: boolean): { key: string; text: string; style: string }[] => {
  const all = itemSpeechClips(it)
  const solution = new Set((it.solution ?? []).map((s) => s.say))
  return all
    .filter((c) => withSolution || !(c.style === 'teacher' && [...solution].some((s) => s.includes(c.text))))
    .map((c) => ({ key: clipKey(c.text, c.style, EN_VER), text: c.text, style: c.style }))
}

function lessonOf(skill: string): { skill: string; steps: { say: string }[] } | null {
  const subject = skill[0] === 'e' ? 'english' : skill[0] === 'm' ? 'math' : 'science'
  const g = `g${skill[1]}`
  try {
    const names = readdirSync(join(ROOT, 'content/lessons', subject, g))
    for (const f of names) {
      const j = JSON.parse(readFileSync(join(ROOT, 'content/lessons', subject, g, f), 'utf8'))
      if (j.skill === skill) return j
    }
  } catch {
    return null
  }
  return null
}

const buttons = (page: Page) =>
  page.evaluate(() => {
    const out = { readShown: 0, readHidden: 0, listenShown: 0, listenOff: 0, note: 0 }
    for (const b of Array.from(document.querySelectorAll('button'))) {
      const name = (b.getAttribute('aria-label') ?? b.textContent ?? '').trim()
      const vis = getComputedStyle(b).visibility === 'visible' && b.getBoundingClientRect().width > 0
      if (/^(Read aloud|Bacakan)$/.test(name)) {
        if (vis) out.readShown++
        else out.readHidden++
      }
      if (/^(Play the audio|Hear the word|Putar suara|Dengarkan kata)/.test(name) || /Hear/.test(name)) {
        if (vis && !(b as HTMLButtonElement).disabled) out.listenShown++
        else out.listenOff++
      }
    }
    if (document.body.innerText.includes('The audio for this question is not ready')) out.note++
    return out
  })

async function main() {
  const browser = await chromium.launch({ args: ['--autoplay-policy=user-gesture-required'] })
  const report: unknown[] = []
  const allNet: Net[] = []
  for (const k of kids) {
    if (ONLY_GRADES && !ONLY_GRADES.includes(k.grade)) continue
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: 'en-GB', timezoneId: 'Asia/Jakarta', storageState: join(OUT, k.state), ...(process.env.QA_STAGING && !process.env.QA_NOROUTE ? { serviceWorkers: 'block' as const } : {}) })
    if (process.env.QA_STAGING && !process.env.QA_NOROUTE) await useStaging(ctx, process.env.QA_STAGING, process.env.QA_VERSION!)
    await ctx.addInitScript(INIT)
    const net: Net[] = []
    const swFetch: string[] = []
    trackNet(ctx, net, swFetch)
    const page = await ctx.newPage()
    page.setDefaultTimeout(25_000)
    await pinIn(page, k.name)
    await page.locator('#today-quests').waitFor({ state: 'attached', timeout: 40_000 }).catch(() => undefined)
    await sleep(1500)
    const rows = psql(`select id, subject, items::text from attempt where learner_id='${k.id}' and kind='quest' and mode='latihan' and submitted_at is null order by created_at;`)
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        const [id, subject, ...rest] = l.split('|')
        return { id: id!, subject: subject!, items: JSON.parse(rest.join('|')) as { ref: string; difficulty: number; position: number }[] }
      })
    const rowOut: Record<string, unknown> = { grade: k.grade, name: k.name, sessions: rows.map((r) => `${r.subject}:${r.items.length}`) }

    // ---- Muat: soal pertama sesi sungguhan.
    const load: unknown[] = []
    for (const r of rows.slice(0, 3)) {
      const start = net.length
      const swStart = swFetch.length
      const t0 = Date.now()
      await page.goto(`/run/${r.id}`.replace(/^/, new URL(page.url()).origin), { waitUntil: 'load' })
      await sleep(2800)
      const got = net.slice(start)
      const refs = [...r.items].sort((a, b) => a.position - b.position).map((i) => i.ref)
      const sets = refs.map((ref) => {
        const it = itemOf(ref)
        return new Set(it ? keysOfItem(it, true).map((c) => c.key) : [])
      })
      const later = new Set<string>()
      sets.slice(2).forEach((s) => s.forEach((x) => later.add(x)))
      const first2 = new Set<string>([...sets[0]!, ...(sets[1] ?? [])])
      const keys = [...new Set(got.map((g) => g.key))]
      const onlyLater = keys.filter((x) => later.has(x) && !first2.has(x))
      const outside = keys.filter((x) => !later.has(x) && !first2.has(x))
      load.push({ subject: r.subject, items: refs.length, firstRefs: refs.slice(0, 2), fetched: keys.length, bytes: got.reduce((a, g) => a + (g.status === 200 ? g.bytes : 0), 0), notFound: got.filter((g) => g.status === 404).length, fromSW: got.filter((g) => g.fromSW).length, swInitiated: new Set(swFetch.slice(swStart)).size, expectFirst2: first2.size, onlyLater: onlyLater.length, outside: outside.length, outsideTexts: outside.slice(0, 3).map((x) => man.get(x)?.text ?? x.slice(0, 10)), wholeSession: new Set(sets.flatMap((s) => [...s])).size, ms: Date.now() - t0 })
      await page.goto(new URL('/today', page.url()).href)
      await sleep(300)
    }
    rowOut.load = load

    // ---- Statis: seluruh soal sesi (kunci dihitung dari isi soal), berapa klip ada di manifest.
    let staticItems = 0
    let staticFull = 0
    let staticPartial = 0
    let staticNone = 0
    let missingText: string[] = []
    const listenSpell = { items: 0, clips: 0, inManifest: 0, missing: [] as string[] }
    for (const r of rows) {
      for (const { ref } of r.items) {
        const it = itemOf(ref)
        if (!it || it.lang !== 'en-GB') continue
        staticItems++
        const c = keysOfItem(it, false)
        const inM = c.filter((x) => man.has(x.key))
        if (c.length > 0 && inM.length === c.length) staticFull++
        else if (inM.length > 0) staticPartial++
        else staticNone++
        if (inM.length !== c.length) missingText.push(...c.filter((x) => !man.has(x.key)).map((x) => `${ref}: ${x.text}`))
        if (it.type === 'listen' || it.type === 'spell') {
          listenSpell.items++
          listenSpell.clips += c.length
          listenSpell.inManifest += inM.length
          listenSpell.missing.push(...c.filter((x) => !man.has(x.key)).map((x) => `${ref}: ${x.text}`))
        }
      }
    }
    missingText = missingText.slice(0, 12)
    rowOut.static = { items: staticItems, allClips: staticFull, partial: staticPartial, none: staticNone, missing: missingText, listenSpell }

    // ---- Layar: tiap soal sesi dibuka sendiri, tombol dihitung.
    const scr = { bytes: 0, items: 0, readShown: 0, readHidden: 0, listenShown: 0, listenOff: 0, notFound: 0, notes: 0, perType: {} as Record<string, { n: number; shown: number; hidden: number }>, hiddenSamples: [] as string[] }
    for (const r of rows) {
      const refs = r.items.slice(0, CAP)
      const special = r.items.filter((x) => {
        const it = itemOf(x.ref)
        return it && (it.type === 'listen' || it.type === 'spell')
      })
      const walkRefs = [...new Map([...refs, ...special].map((x) => [x.ref, x])).values()]
      for (const it of walkRefs) {
        const content = itemOf(it.ref)
        const attempt = makeAttempt(k, [{ id: it.ref, difficulty: it.difficulty }], r.subject)
        const start = net.length
        await page.goto(new URL(`/run/${attempt}`, page.url()).href, { waitUntil: 'load' }).catch(() => undefined)
        await page.locator('section[aria-label="Question"]').first().waitFor({ timeout: 15_000 }).catch(() => undefined)
        await sleep(1100)
        const b = await buttons(page)
        const nf = net.slice(start).filter((n) => n.status === 404).length
        scr.bytes += net.slice(start).reduce((a, n) => a + (n.status === 200 ? n.bytes : 0), 0)
        scr.items++
        scr.readShown += b.readShown
        scr.readHidden += b.readHidden
        scr.listenShown += b.listenShown
        scr.listenOff += b.listenOff
        scr.notFound += nf
        scr.notes += b.note
        const t = content?.type ?? '?'
        const pt = (scr.perType[t] ??= { n: 0, shown: 0, hidden: 0 })
        pt.n++
        pt.shown += b.readShown
        pt.hidden += b.readHidden
        if (b.readHidden > 0 && scr.hiddenSamples.length < 8) scr.hiddenSamples.push(`${it.ref}: ${(content?.prompt ?? '').slice(0, 70)}`)
      }
    }
    rowOut.screens = scr

    // ---- Pelajaran: satu per mapel, dari skill sesi.
    const lessonsOut: unknown[] = []
    for (const r of rows) {
      const skill = [...new Set(r.items.map((i) => itemOf(i.ref)?.skill).filter(Boolean))].find((s) => lessonOf(s as string)) as string | undefined
      if (!skill) continue
      const lesson = lessonOf(skill)!
      const start = net.length
      await page.goto(new URL(`/lesson/${skill}`, page.url()).href, { waitUntil: 'load' })
      await sleep(900)
      const toggle = page.getByTestId('translate-toggle').first()
      const steps = lesson.steps.length
      // Bahasa Inggris: kunci langkah ada di manifest, langkah 1 benar-benar berbunyi.
      const enMissing = lesson.steps.filter((s) => !man.has(clipKey(s.say, 'teacher', EN_VER)) && s.say.length <= 280).length
      const before = (await qa(page)).plays.length
      await page.getByRole('button', { name: 'Play', exact: true }).click()
      const t0 = Date.now()
      while (Date.now() - t0 < 8000) {
        const q = await qa(page)
        if (q.plays.length > before && q.plays.at(-1)!.maxCT > 0.2) break
        await sleep(100)
      }
      const q = await qa(page)
      const enPlayed = q.plays.slice(before).map((p) => p.key && man.get(p.key)?.version)
      await page.getByRole('button', { name: 'Pause', exact: true }).click().catch(() => undefined)
      await page.locator('body').evaluate(() => document.querySelectorAll('audio').forEach((a) => a.pause()))
      // Bahasa Indonesia: berjalan per langkah, tombol suara tampil atau tersembunyi.
      let idShown = 0
      let idHidden = 0
      let idNoTranslation = 0
      if (await toggle.isVisible().catch(() => false)) {
        await toggle.click()
        await sleep(500)
        await page.getByRole('button', { name: 'Previous part', exact: true }).click({ timeout: 1000 }).catch(() => undefined)
        for (let i = 0; i < steps; i++) {
          await sleep(650)
          const cap = await page.locator('p[aria-live="polite"]').first().getAttribute('lang').catch(() => null)
          const vis = await page
            .locator('header button[aria-pressed]')
            .filter({ hasText: /Sound|Suara/ })
            .first()
            .evaluate((b) => getComputedStyle(b).visibility === 'visible')
            .catch(() => false)
          if (cap !== 'id') idNoTranslation++
          if (vis) idShown++
          else idHidden++
          const next = page.getByRole('button', { name: 'Next part', exact: true })
          if (i < steps - 1) await next.click({ timeout: 3000 }).catch(() => undefined)
        }
        await toggle.click().catch(() => undefined)
      }
      const got = net.slice(start)
      lessonsOut.push({ skill, steps, enMissing, enPlayed: enPlayed[0] ?? null, idShown, idHidden, idNoTranslation, requested: got.length, notFound: got.filter((g) => g.status === 404).length, idKeys: got.filter((g) => man.get(g.key)?.version === ID_VER).length, enKeys: got.filter((g) => man.get(g.key)?.version === EN_VER).length })
    }
    rowOut.lessons = lessonsOut
    const q = await qa(page).catch(() => null)
    rowOut.speak = q?.speak ?? -1
    report.push(rowOut)
    console.log(JSON.stringify(rowOut).slice(0, 1800))
    allNet.push(...net)
    writeFileSync(join(OUT, `coverage${process.env.QA_TAG ?? ''}.json`), JSON.stringify(report, null, 1))
    writeFileSync(join(OUT, `net-coverage${process.env.QA_TAG ?? ''}.json`), JSON.stringify(allNet))
    await ctx.close()
  }
  await browser.close()
  void idOf
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
