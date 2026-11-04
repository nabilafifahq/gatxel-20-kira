// Tes dan Paper dari Today: pengatur waktu ramah, tanpa kunci di payload, tanpa soal kembar, skor akhir sama dengan hitungan sendiri.
import { appendFileSync } from 'node:fs'
import { answer as answerEn } from '../qa-soal/driver'
import { answer as answerId } from './driver-id'
import { ensureToday } from './a2-sessions'
import { chromium, families, layoutSweep, newCtx, OUT, PHONE, qa, resolveItem, say, sql, TABLET, type Family, type Page } from './lib'
import { attemptItems, dupeCheck } from './session'

const T = {
  en: { a: 'Your answer', next: 'Next', handIn: 'Hand in', see: /See my score/, start: /^Start/ },
  id: { a: 'Jawabanmu', next: 'Lanjut', handIn: 'Kumpulkan', see: /Lihat nilai|Lihat skor|Lihat hasil/, start: /^Mulai/ },
}

async function runTest(page: Page, f: Family, label: string, href: string) {
  const L = T[f.lang]
  const answer = f.lang === 'id' ? answerId : answerEn
  await page.goto(href)
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(400)
  if (!new URL(page.url()).pathname.startsWith('/run/')) {
    await page.screenshot({ path: `${OUT}/timed-g${f.grade}-${label}-intro.png`, fullPage: true })
    const go = page.getByRole('link', { name: L.start }).or(page.getByRole('button', { name: L.start })).first()
    await go.click({ timeout: 15000 })
    await page.waitForURL((u) => u.pathname.startsWith('/run/'), { timeout: 40000 })
  }
  const path = new URL(page.url()).pathname
  const id = path.split('/').pop()!
  const ansLabel = f.lang === 'id' ? 'Jawaban' : 'Answers'
  await page.locator(`section[aria-label="${ansLabel}"]`).first().waitFor({ timeout: 20000 })
  const raw = await (await page.request.get(path)).text()
  const leak = [/\\?"(solution|answers|acceptAlt|filled|blanksKey|hints)\\?"\s*:/.exec(raw)?.[0], /\\?"answer\\?"\s*:\s*(\d|\\?"|\{)/.exec(raw)?.[0], /\\?"tolerance\\?"\s*:/.exec(raw)?.[0]].filter(Boolean)
  say(leak.length === 0, `g${f.grade} ${label}: payload tanpa kunci ${JSON.stringify(leak)}`)
  const [a] = await sql`select mode, time_limit_s, kind, title from attempt where id = ${id}`
  await page.screenshot({ path: `${OUT}/timed-g${f.grade}-${label}-q1.png` })
  const timerTxt = await page.locator('[role=timer], [aria-label*="left"], [aria-label*="sisa"], [aria-label*="time"]').first().getAttribute('aria-label').catch(() => null)
  const list = await attemptItems(id)
  const d = dupeCheck(list)
  say(d.length === 0, `g${f.grade} ${label}: tanpa soal kembar (${list.length} soal) ${JSON.stringify(d.slice(0, 2))}`)
  say('INFO', `g${f.grade} ${label}: mode ${a?.mode} batas ${a?.time_limit_s}s, judul ${a?.title}, timer "${timerTxt}", jenis ${[...new Set(list.map((x) => resolveItem(x.ref)?.type))].join(',')}`)
  let expectedRight = 0
  let answered = 0
  const issues: string[] = []
  for (let i = 0; i < list.length; i++) {
    const it = resolveItem(list[i]!.ref)!
    const right = i % 3 !== 1
    try {
      // Runner tes memberi label Answers pada bagian jawaban; driver memakai label runner latihan.
      await page.evaluate(([from, to]) => document.querySelector(`section[aria-label="${from}"]`)?.setAttribute('aria-label', to!), [ansLabel, L.a])
      await answer(page, it, right, { issues: [] })
      answered++
      if (right) expectedRight++
    } catch (e) {
      issues.push(`${it.id} ${it.type}: ${String(e).split('\n')[0]!.slice(0, 100)}`)
    }
    appendFileSync(`${OUT}/qs-timed-g${f.grade}.txt`, `${label} ${i + 1} ${it.id} ${it.type} ${right ? 'benar' : 'salah'}: ${String((it as { prompt?: string }).prompt).slice(0, 140)}\n`)
    const sw = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    if (sw) issues.push(`geser samping ${it.id}`)
    if (i < list.length - 1) await page.getByRole('button', { name: L.next, exact: true }).click({ timeout: 8000 })
    await page.waitForTimeout(120)
  }
  say(issues.length === 0, `g${f.grade} ${label}: semua soal bisa dijawab ${JSON.stringify(issues.slice(0, 4))}`)
  await page.screenshot({ path: `${OUT}/timed-g${f.grade}-${label}-last.png` })
  await page.getByRole('button', { name: L.handIn, exact: true }).first().click({ timeout: 8000 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/timed-g${f.grade}-${label}-confirm.png` })
  await page.getByRole('dialog').getByRole('button', { name: L.handIn, exact: true }).click({ timeout: 8000 })
  await page.waitForURL((u) => u.pathname.startsWith('/results/'), { timeout: 30000 }).catch(async () => {
    const see = page.getByRole('button', { name: L.see }).or(page.getByRole('link', { name: L.see })).first()
    await see.click({ timeout: 10000 }).catch(() => {})
    await page.waitForURL((u) => u.pathname.startsWith('/results/'), { timeout: 20000 }).catch(() => {})
  })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${OUT}/timed-g${f.grade}-${label}-results.png`, fullPage: true })
  const rows = await sql`select position, status from response where attempt_id = ${id} order by position, attempt_no desc`
  const st = new Map<number, string>()
  for (const r of rows) if (!st.has(r.position as number)) st.set(r.position as number, r.status as string)
  const right = [...st.values()].filter((s) => s === 'correct').length
  const pend = [...st.values()].filter((s) => s === 'pending' || s === 'answered').length
  const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ')
  const score = /(\d+)\s*(?:of|out of|dari)\s*(\d+)/.exec(body)
  say(right === expectedRight, `g${f.grade} ${label}: skor DB ${right} = hitungan sendiri ${expectedRight} dari ${answered}/${list.length} (tunggu ${pend}); layar "${score?.[0]}" url ${new URL(page.url()).pathname}`)
  if (score && Number(score[1]) !== expectedRight) say(false, `g${f.grade} ${label}: skor layar ${score[0]} beda dengan ${expectedRight}`)
  const sw = (await layoutSweep(page)).filter((x) => !/^small 4[23]x44/.test(x))
  say(sw.length === 0, `g${f.grade} ${label} hasil tata letak ${JSON.stringify(sw.slice(0, 4))}`)
}

async function main() {
  const grade = Number(process.argv[2])
  const f = families().find((x) => x.grade === grade)!
  const b = await chromium.launch()
  const ctx = await newCtx(b, { viewport: process.argv[3] === 'phone' ? PHONE : TABLET, tag: `timed-g${grade}`, state: `${OUT}/state-g${grade}.json` })
  const page = await ctx.newPage()
  await ensureToday(page, f)
  await page.waitForTimeout(800)
  const stops = await page.evaluate(() =>
    Array.from(document.querySelectorAll('main a[href]'))
      .map((a) => ({ href: a.getAttribute('href') ?? '', name: (a.getAttribute('aria-label') ?? (a as HTMLElement).innerText).replace(/\s+/g, ' ').slice(0, 90) }))
      .filter((x) => x.href.startsWith('/quest/') || x.href.startsWith('/run/') || x.href.includes('/start')),
  )
  say('INFO', `g${grade} Today tambahan: ${JSON.stringify(stops.map((s) => s.name.slice(0, 45)))}`)
  const test = stops.find((s) => /\b(test|tes)\b/i.test(s.name))
  const paper = stops.find((s) => /\bpaper\b/i.test(s.name))
  if (test) await runTest(page, f, 'tes', test.href).catch((e) => say(false, `g${grade} tes gagal ${String(e).split('\n')[0]!.slice(0, 200)}`))
  else say(false, `g${grade}: tes tambahan tidak ditemukan`)
  await page.goto('/today')
  await page.waitForTimeout(400)
  if (paper) await runTest(page, f, 'paper', paper.href).catch((e) => say(false, `g${grade} paper gagal ${String(e).split('\n')[0]!.slice(0, 200)}`))
  else say(false, `g${grade}: paper tambahan tidak ditemukan`)
  const q = await qa(page)
  say(q.speak.length === 0, `g${grade} tes suara perangkat ${q.speak.length}`)
  await b.close()
  await sql.end()
}
main().catch((e) => {
  console.error(String(e).slice(0, 1000))
  process.exit(1)
})
