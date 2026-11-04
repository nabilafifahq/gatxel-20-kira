// Tiap kelas: tiga sesi wajib dari Today sampai selesai, benar dan salah, lewat ketukan sungguhan. Lalu peti, streak, XP.
import { writeFileSync } from 'node:fs'
import { chromium, families, layoutSweep, newCtx, OUT, PHONE, pinIn, qa, say, sql, TABLET, WEBVIEW_UA, type Family, type Page } from './lib'
import { STR, walkSession } from './session'

export async function ensureToday(page: Page, f: Family) {
  await page.goto('/today')
  await page.waitForLoadState('domcontentloaded')
  if (new URL(page.url()).pathname === '/') await pinIn(page, f)
  else if (new URL(page.url()).pathname.startsWith('/pin/')) {
    const names = f.lang === 'id' ? ['Matahari', 'Bulan', 'Bintang', 'Kucing'] : ['Sun', 'Moon', 'Star', 'Cat']
    for (const p of names) await page.getByRole('button', { name: p, exact: true }).click()
    await page.waitForURL((u) => u.pathname === '/today')
  }
  const tips = page.getByTestId('first-run-tips')
  if (await tips.isVisible().catch(() => false)) await tips.getByRole('button').first().click()
}

async function main() {
  const grade = Number(process.argv[2])
  const vp = process.argv[3] === 'phone' ? PHONE : TABLET
  const f = families().find((x) => x.grade === grade)!
  const ua = process.argv[4] === 'webview' ? WEBVIEW_UA : undefined
  const b = await chromium.launch()
  const ctx = await newCtx(b, { viewport: vp, ua, tag: `sess-g${grade}`, state: `${OUT}/state-g${grade}.json` })
  const page = await ctx.newPage()
  await ensureToday(page, f)
  const S = STR[f.lang]
  const summary: Record<string, unknown>[] = []
  for (let s = 0; s < 3; s++) {
    await ensureToday(page, f)
    // Anak mengetuk Mulai paling atas di jalur.
    const start = page.getByRole('link', { name: f.lang === 'id' ? /^Mulai/ : /^Start/ }).first()
    await start.waitFor({ timeout: 15000 }).catch(() => {})
    if (!(await start.isVisible().catch(() => false))) {
      await page.screenshot({ path: `${OUT}/g${grade}-s${s}-nostart.png`, fullPage: true })
      say('INFO', `g${grade} sesi ${s}: tidak ada tombol Mulai`)
      break
    }
    const href = await start.getAttribute('href')
    await start.click()
    await page.waitForURL((u) => u.pathname !== '/today', { timeout: 30000 })
    await page.waitForTimeout(400)
    if (s === 0) await page.screenshot({ path: `${OUT}/g${grade}-s${s}-intro.png`, fullPage: true })
    if (new URL(page.url()).pathname.startsWith('/quest/')) {
      const go = page.getByRole('link', { name: f.lang === 'id' ? /^Mulai/ : /^Start/ }).or(page.getByRole('button', { name: f.lang === 'id' ? /^Mulai/ : /^Start/ })).first()
      await go.click({ timeout: 15000 })
      await page.waitForURL((u) => u.pathname.startsWith('/run/'), { timeout: 40000 })
    }
    if (!new URL(page.url()).pathname.startsWith('/run/')) {
      say('INFO', `g${grade} sesi ${s} dari ${href} ke ${page.url()}`)
      break
    }
    const res = await walkSession(page, f, { tag: `g${grade}-s${s}`, wrongAt: [2], wrongTwiceAt: [3], shots: s === 0 })
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `${OUT}/g${grade}-s${s}-end.png`, fullPage: true })
    const endText = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 260)
    const finished = await page.getByText(S.done).first().isVisible().catch(() => false)
    say('INFO', `g${grade} sesi ${s} selesai=${finished} url=${new URL(page.url()).pathname}: ${endText}`)
    const bad = res.rows.filter((r) => !r.ok)
    say(bad.length === 0, `g${grade} sesi ${s}: ${res.rows.length} soal, penilaian beda ${bad.length}, jenis ${JSON.stringify(res.types)}`)
    say(res.dupes.length === 0, `g${grade} sesi ${s} soal kembar: ${JSON.stringify(res.dupes)}`)
    say(res.driverGaps.length === 0, `g${grade} sesi ${s} gagal jawab: ${JSON.stringify(res.driverGaps)}`)
    const iss = res.issues.filter((x) => !['small-target'].includes(x.kind))
    say(iss.length === 0, `g${grade} sesi ${s} tata letak: ${JSON.stringify(iss.slice(0, 8))}`)
    summary.push({ s, types: res.types, rows: res.rows.length, bad, issues: res.issues.slice(0, 20), gaps: res.driverGaps })
    // Tombol hasil dan kembali.
    const see = page.getByRole('link', { name: f.lang === 'id' ? /Lihat|Hasil/ : /results|See/i }).or(page.getByRole('button', { name: f.lang === 'id' ? /Lihat hasil/ : /See my results/ })).first()
    if (await see.isVisible().catch(() => false)) {
      await see.click().catch(() => {})
      await page.waitForTimeout(2500)
      await page.screenshot({ path: `${OUT}/g${grade}-s${s}-results.png`, fullPage: true })
      const anim = await page.evaluate(() => document.getAnimations().length)
      say('INFO', `g${grade} sesi ${s} setelah hasil: ${new URL(page.url()).pathname}, animasi berjalan ${anim}`)
    }
  }
  const q = await qa(page).catch(() => null)
  if (q) say(q.speak.length === 0, `g${grade} sesi: suara perangkat ${q.speak.length} ${JSON.stringify(q.speak.slice(0, 3))}, klip ${q.clips.length}`)
  // Today akhir: peti, streak.
  await page.goto('/today')
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${OUT}/g${grade}-today-after.png`, fullPage: true })
  const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 500)
  say('INFO', `g${grade} Today setelah: ${body}`)
  const chest = page.getByRole('button', { name: f.lang === 'id' ? /peti/i : /chest/i }).first()
  if (await chest.isVisible().catch(() => false)) {
    await chest.click()
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `${OUT}/g${grade}-chest.png` })
    say('INFO', `g${grade} peti dibuka: ${(await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 200)}`)
  } else say('INFO', `g${grade} tidak ada tombol peti`)
  const sw = await layoutSweep(page)
  say(sw.length === 0, `g${grade} today setelah: ${JSON.stringify(sw.slice(0, 6))}`)
  const [xp] = await sql`select coalesce(sum(1),0) n from attempt where learner_id = ${f.learnerId!} and submitted_at is not null`.catch(() => [{ n: '?' }])
  say('INFO', `g${grade} attempt selesai di DB ${xp?.n}`)
  writeFileSync(`${OUT}/summary-g${grade}.json`, JSON.stringify(summary, null, 1))
  await ctx.storageState({ path: `${OUT}/state-g${grade}.json` })
  await b.close()
  await sql.end()
}
if (process.argv[1]?.includes('a2-sessions')) {
  main().catch((e) => {
    console.error(String(e).slice(0, 1200))
    process.exit(1)
  })
}
