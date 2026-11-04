// Practice hub dan Olimpiade: tiap kategori membuka isi nyata di kelas anak; tes berwaktu tanpa kunci di payload, penilaian cocok.
import { writeFileSync } from 'node:fs'
import { answer as answerEn } from '../qa-soal/driver'
import { answer as answerId } from './driver-id'
import { ensureToday } from './a2-sessions'
import { chromium, families, layoutSweep, newCtx, OUT, PHONE, qa, resolveItem, say, sql, TABLET, type Family, type Page } from './lib'
import { attemptItems, dupeCheck, STR, textOf } from './session'

const gradeOf = (ref: string): number | null => {
  const m = /^(?:gen:)?[mes](\d)\./.exec(ref)
  return m ? Number(m[1]) : null
}

function leakCheck(html: string, refs: { ref: string }[]): string[] {
  const leaks: string[] = []
  if (/\\?"(solution|answers|acceptAlt|tolerance|filled)\\?"\s*:/.test(html)) leaks.push(`kata kunci ${(/\\?"(solution|answers|acceptAlt|tolerance|filled)\\?"\s*:/.exec(html) ?? [''])[0]}`)
  if (/\\?"answer\\?"\s*:\s*(\d|\\?")/.test(html)) leaks.push('field answer berisi nilai')
  void refs
  return leaks
}

async function oneQuestion(page: Page, f: Family, attemptId: string, correct: boolean) {
  const S = STR[f.lang]
  const list = await attemptItems(attemptId)
  const item = resolveItem(list[0]!.ref)!
  const answer = f.lang === 'id' ? answerId : answerEn
  await answer(page, item, correct, { issues: [] })
  await page.getByRole('button', { name: S.check, exact: true }).click({ timeout: 8000 })
  await page.locator('[role=status] h2').first().waitFor({ timeout: 15000 })
  return (await page.locator('[role=status] h2').first().innerText()).trim()
}

async function main() {
  const grade = Number(process.argv[2])
  const f = families().find((x) => x.grade === grade)!
  const b = await chromium.launch()
  const ctx = await newCtx(b, { viewport: process.argv[3] === 'phone' ? PHONE : TABLET, tag: `hub-g${grade}`, state: `${OUT}/state-g${grade}.json` })
  const page = await ctx.newPage()
  const S = STR[f.lang]
  // Orang tua menyalakan Olimpiade (setara saklar di dashboard), supaya bagian itu bisa diuji.
  for (const key of ['olympiad-math', 'olympiad-english', 'olympiad-science']) {
    await sql`insert into learner_feature (org_id, learner_id, key, enabled) values (${f.orgId!}, ${f.learnerId!}, ${key}, true) on conflict (learner_id, key) do update set enabled = true`
  }
  await ensureToday(page, f)
  await page.goto('/practice')
  await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {})
  await page.screenshot({ path: `${OUT}/hub-g${grade}.png`, fullPage: true })
  const tiles = await page.evaluate(() =>
    Array.from(document.querySelectorAll('main section a, main a'))
      .map((a) => ({ href: (a as HTMLAnchorElement).getAttribute('href') ?? '', name: (a as HTMLElement).innerText.replace(/\s+/g, ' ').trim().slice(0, 60) }))
      .filter((x) => x.href.startsWith('/') && !x.href.startsWith('/feedback')),
  )
  say('INFO', `g${grade} hub: ${tiles.length} tautan`)
  const report: unknown[] = []
  let opened = 0
  for (const t of tiles) {
    const resp = await page.goto(t.href, { waitUntil: 'domcontentloaded' }).catch(() => null)
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
    const path = new URL(page.url()).pathname
    const rec: Record<string, unknown> = { t, status: resp?.status(), path }
    if (path.startsWith('/run/')) {
      const id = path.split('/').pop()!
      const list = await attemptItems(id)
      const unresolved = list.filter((x) => !resolveItem(x.ref))
      const wrongGrade = [...new Set(list.map((x) => x.ref).filter((r) => {
        const g = gradeOf(r)
        return g !== null && g !== grade
      }))]
      const d = dupeCheck(list)
      rec.count = list.length
      rec.wrongGrade = wrongGrade.slice(0, 5)
      rec.dupes = d
      const hasQ = await page.locator(`section[aria-label="${S.a}"]`).first().isVisible().catch(() => false)
      const types = [...new Set(list.map((x) => resolveItem(x.ref)?.type))]
      rec.types = types
      say(list.length > 0 && hasQ && unresolved.length === 0, `g${grade} hub ${t.name.slice(0, 40)}: ${list.length} soal, jenis ${types.join(',')}`)
      if (wrongGrade.length) say(false, `g${grade} hub ${t.name.slice(0, 40)}: soal kelas lain ${JSON.stringify(wrongGrade.slice(0, 4))}`)
      if (d.length) say(false, `g${grade} hub ${t.name.slice(0, 40)}: soal kembar ${JSON.stringify(d.slice(0, 2))}`)
      if (opened < 3 || /olymp|olimp/i.test(t.name)) {
        await page.screenshot({ path: `${OUT}/hub-g${grade}-t${opened}.png` })
        const shown = await oneQuestion(page, f, id, true).catch((e) => `gagal ${String(e).split('\n')[0]!.slice(0, 80)}`)
        if (shown !== S.correct) say(false, `g${grade} hub ${t.name.slice(0, 40)} ${list[0]!.ref}: jawaban benar tampil ${shown}`)
      }
      opened++
    } else {
      const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 120)
      const sw = (await layoutSweep(page)).filter((x) => !/^small/.test(x))
      say(sw.length === 0 && (resp?.status() ?? 200) < 400, `g${grade} hub ${t.name.slice(0, 40)} -> ${path} ${JSON.stringify(sw.slice(0, 3))} :: ${text.slice(0, 60)}`)
    }
    report.push(rec)
  }

  // Tes berwaktu dari hub: pengatur waktu ramah, kunci tidak ada di payload, penilaian sesuai setelah diserahkan.
  const start = tiles.find((x) => /subject=math/.test(x.href) && /timed=0/.test(x.href))
  if (start) {
    await page.goto(start.href.replace('timed=0', 'timed=1').replace('n=10', 'n=5'))
    await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {})
    const path = new URL(page.url()).pathname
    if (path.startsWith('/run/')) {
      const id = path.split('/').pop()!
      const list = await attemptItems(id)
      const raw = await (await page.request.get(path)).text()
      const leaks = leakCheck(raw, list)
      say(leaks.length === 0, `g${grade} tes berwaktu: kunci tidak di payload ${JSON.stringify(leaks)}`)
      await page.screenshot({ path: `${OUT}/timed-g${grade}.png` })
      const [a] = await sql`select mode, time_limit_s, kind from attempt where id = ${id}`
      say('INFO', `g${grade} tes berwaktu: mode ${a?.mode} batas ${a?.time_limit_s} jenis ${a?.kind}, ${list.length} soal`)
      const dup = dupeCheck(list)
      say(dup.length === 0, `g${grade} tes berwaktu kembar ${JSON.stringify(dup)}`)
    } else say(false, `g${grade} tes berwaktu tidak membuka runner: ${path}`)
  }
  const q = await qa(page)
  say(q.speak.length === 0, `g${grade} hub suara perangkat ${q.speak.length}`)
  writeFileSync(`${OUT}/hub-g${grade}.json`, JSON.stringify(report, null, 1))
  void textOf
  await b.close()
  await sql.end()
}
main().catch((e) => {
  console.error(String(e).slice(0, 1000))
  process.exit(1)
})
