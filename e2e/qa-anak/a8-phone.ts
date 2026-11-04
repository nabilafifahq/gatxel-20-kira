// Putaran HP dan WebView Android: keluarga baru, masuk pertama, sesi wajib penuh, penempatan, reduced motion. Galat konsol dicatat.
import { STR, walkSession } from './session'
import { chromium, layoutSweep, newCtx, OUT, PHONE, pinIn, qa, say, signUp, sql, WEBVIEW_UA, type Family, type Page } from './lib'
import { answer as answerEn } from '../qa-soal/driver'
import { answer as answerId } from './driver-id'
import { resolveItem } from './lib'

async function placement(page: Page, f: Family, tag: string) {
  const en = f.lang === 'en'
  await page.goto('/today')
  await page.waitForTimeout(800)
  const go = page.getByRole('link', { name: en ? /Let's go|Continue/ : /Yuk, mulai|Lanjut/ }).first()
  if (!(await go.isVisible().catch(() => false))) {
    say('INFO', `${tag} tidak ada kartu penempatan`)
    return
  }
  await go.click()
  await page.waitForURL((u) => u.pathname.startsWith('/placement'), { timeout: 20000 })
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${OUT}/${tag}-place-0.png`, fullPage: true })
  const startBtn = page.getByRole('button', { name: en ? /Start|Begin|Let's/ : /Mulai/ }).first()
  if (await startBtn.isVisible().catch(() => false)) {
    await startBtn.click().catch(() => {})
    await page.waitForTimeout(900)
  }
  let n = 0
  const seen = new Set<string>()
  const a = en ? 'Your answer' : 'Jawabanmu'
  for (; n < 45; n++) {
    const sec = page.locator(`section[aria-label="${a}"]`)
    if (!(await sec.first().isVisible().catch(() => false))) break
    const prompt = (await page.locator(`section[aria-label="${en ? 'Question' : 'Soal'}"]`).first().innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 90)
    if (seen.has(prompt)) say('INFO', `${tag} penempatan: soal tampil lagi "${prompt.slice(0, 60)}"`)
    seen.add(prompt)
    if (n === 1) await page.screenshot({ path: `${OUT}/${tag}-place-q.png`, fullPage: true })
    // Anak ragu: sebagian Belum yakin, sebagian pilih jawaban pertama.
    const mcq = sec.getByRole('group', { name: en ? 'Answers' : 'Jawaban' }).locator('button').first()
    const next = page.getByRole('button', { name: en ? 'Next' : 'Lanjut', exact: true })
    if (n % 2 === 0 && (await mcq.isVisible().catch(() => false))) {
      await mcq.click().catch(() => {})
      await next.click({ timeout: 6000 }).catch(() => {})
    } else {
      await page.getByRole('button', { name: en ? /Not sure/ : /Belum yakin|Tidak yakin/ }).first().click({ timeout: 6000 }).catch(() => {})
    }
    await page.waitForTimeout(450)
    const leak = await page.evaluate(() => /undefined|NaN|\[object/.test(document.body.innerText))
    if (leak) say(false, `${tag} penempatan: teks rusak`)
  }
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/${tag}-place-end.png`, fullPage: true })
  say('INFO', `${tag} penempatan ${n} soal, akhir ${new URL(page.url()).pathname}: ${(await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 170)}`)
}

async function main() {
  const grade = Number(process.argv[2])
  const lang = (process.argv[3] ?? 'en') as 'en' | 'id'
  const reduced = process.argv[4] === 'reduced'
  const b = await chromium.launch()
  const tag = `p${grade}${reduced ? 'r' : ''}`
  const ctx = await newCtx(b, { viewport: PHONE, ua: WEBVIEW_UA, reduced, tag: `phone-g${grade}${reduced ? 'r' : ''}` })
  const page = await ctx.newPage()
  const f = await signUp(page, { grade, name: `Hp${grade}${reduced ? 'R' : ''}`, lang })
  await page.screenshot({ path: `${OUT}/${tag}-pick.png`, fullPage: true })
  await pinIn(page, f)
  await page.waitForTimeout(1000)
  await page.screenshot({ path: `${OUT}/${tag}-today-top.png` })
  const s0 = await qa(page)
  say(s0.sfxBeforeGesture <= 0, `${tag} WebView: tanpa galat bunyi sebelum sentuhan (sfx ${s0.sfxBeforeGesture})`)
  const tips = page.getByTestId('first-run-tips')
  if (await tips.isVisible().catch(() => false)) {
    await page.screenshot({ path: `${OUT}/${tag}-tips.png` })
    await tips.getByRole('button').first().click()
  }
  const S = STR[f.lang]
  const start = () => page.getByRole('link', { name: f.lang === 'id' ? /^Mulai/ : /^Start/ }).first()
  for (let s = 0; s < 3; s++) {
    await page.goto('/today')
    await start().waitFor({ timeout: 15000 }).catch(() => {})
    if (!(await start().isVisible().catch(() => false))) break
    await start().click()
    await page.waitForURL((u) => u.pathname !== '/today', { timeout: 30000 })
    await page.waitForTimeout(350)
    if (new URL(page.url()).pathname.startsWith('/quest/')) {
      await page.getByRole('link', { name: f.lang === 'id' ? /^Mulai/ : /^Start/ }).or(page.getByRole('button', { name: f.lang === 'id' ? /^Mulai/ : /^Start/ })).first().click({ timeout: 15000 })
      await page.waitForURL((u) => u.pathname.startsWith('/run/'), { timeout: 40000 })
    }
    const res = await walkSession(page, f, { tag: `${tag}-s${s}`, wrongAt: [2], wrongTwiceAt: [4], shots: s === 0 })
    const bad = res.rows.filter((r) => !r.ok)
    say(bad.length === 0, `${tag} sesi ${s}: ${res.rows.length} soal, penilaian beda ${bad.length}, jenis ${JSON.stringify(res.types)}`)
    say(res.dupes.length === 0, `${tag} sesi ${s} kembar ${JSON.stringify(res.dupes)}`)
    say(res.driverGaps.length === 0, `${tag} sesi ${s} gagal jawab ${JSON.stringify(res.driverGaps)}`)
    const iss = res.issues.filter((x) => x.kind !== 'small-target')
    say(iss.length === 0, `${tag} sesi ${s} tata letak HP ${JSON.stringify(iss.slice(0, 6))}`)
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `${OUT}/${tag}-s${s}-end.png` })
    const anims = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length)
    if (reduced) say(anims === 0, `${tag} reduced motion: animasi berjalan ${anims}`)
    void S
  }
  await placement(page, f, tag)
  await page.goto('/today')
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/${tag}-today-end.png`, fullPage: true })
  const sw = (await layoutSweep(page)).filter((x) => !/^small 4[23]x44/.test(x))
  say(sw.length === 0, `${tag} today akhir ${JSON.stringify(sw.slice(0, 5))}`)
  const end = await qa(page)
  say(end.speak.length === 0, `${tag} suara perangkat ${end.speak.length}`)
  void resolveItem
  void answerEn
  void answerId
  await ctx.storageState({ path: `${OUT}/state-${tag}.json` })
  await b.close()
  await sql.end()
}
main().catch((e) => {
  console.error(String(e).slice(0, 1000))
  process.exit(1)
})
