// Suara sisanya, tiap kali memeriksa klip benar-benar diputar: cerita, kamus, kartu kilas, kartu album, buku dan hentikan saat pindah lewat tautan.
import { ensureToday } from './a2-sessions'
import { chromium, families, newCtx, OUT, PHONE, qa, say, sql, TABLET, WEBVIEW_UA, type Page } from './lib'

async function played(page: Page, act: () => Promise<void>, ms = 3500) {
  const s0 = await qa(page)
  const seen: { key: string; status: number }[] = []
  const on = (r: import('@playwright/test').Response) => {
    const u = new URL(r.url())
    if (u.pathname.startsWith('/tts/')) seen.push({ key: u.pathname.slice(5, 17), status: r.status() })
  }
  page.on('response', on)
  await act()
  await page.waitForTimeout(ms)
  page.off('response', on)
  const s1 = await qa(page)
  return { plays: s1.clips.length - s0.clips.length, ended: s1.ended - s0.ended, errors: s1.clipErrors.slice(s0.clipErrors.length), reqs: seen, maxPlaying: s1.maxPlaying }
}

async function main() {
  const grade = Number(process.argv[2] ?? 4)
  const webview = process.argv[3] === 'webview'
  const f = families().find((x) => x.grade === grade)!
  const en = f.lang === 'en'
  const READ = en ? /Read aloud/ : /Bacakan/
  const b = await chromium.launch()
  const ctx = await newCtx(b, { viewport: webview ? PHONE : TABLET, ua: webview ? WEBVIEW_UA : undefined, tag: `audio2-g${grade}`, state: `${OUT}/state-g${grade}.json` })
  const page = await ctx.newPage()
  const tag = `g${grade}${webview ? ' wv' : ''}`
  await ensureToday(page, f)

  // Cerita.
  await page.goto('/world/story')
  await page.waitForTimeout(800)
  await page.locator('main section button, main button.flex').first().click()
  await page.waitForTimeout(900)
  const r1 = await played(page, () => page.getByRole('button', { name: READ }).first().click())
  say(r1.plays > 0 && r1.errors.length === 0, `${tag} cerita: putar ${r1.plays}, selesai ${r1.ended}, permintaan ${JSON.stringify(r1.reqs.slice(0, 4))}, galat ${JSON.stringify(r1.errors.slice(0, 2))}`)

  // Kamus Ketuk dari kalimat cerita.
  await page.locator('main button').filter({ hasText: /^(Saturday|book|Pine|Hill|bag|back)$/ }).first().click({ timeout: 5000 }).catch(() => say(false, `${tag} kata cerita tidak bisa diketuk`))
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/a2-${grade}-dict.png` })
  const dlg = page.getByRole('dialog').first()
  const r2 = await played(page, () => dlg.getByRole('button', { name: READ }).first().click())
  say(r2.plays > 0 && r2.errors.length === 0, `${tag} kamus: putar ${r2.plays}, selesai ${r2.ended}, permintaan ${JSON.stringify(r2.reqs.slice(0, 3))}`)
  const saveBtn = dlg.getByRole('button', { name: en ? /Save|Add/ : /Simpan/ }).first()
  if (await saveBtn.isVisible().catch(() => false)) {
    await saveBtn.click()
    await page.waitForTimeout(600)
    say('INFO', `${tag} kata disimpan`)
  }
  await page.keyboard.press('Escape')
  await page.goto('/my-words')
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/a2-${grade}-mywords.png`, fullPage: true })
  const mw = page.getByRole('button', { name: READ }).first()
  if (await mw.isVisible().catch(() => false)) {
    const r2b = await played(page, () => mw.click())
    say(r2b.plays > 0, `${tag} kata saya: putar ${r2b.plays}`)
  } else say('INFO', `${tag} kata saya tanpa tombol suara per kata: ${(await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 120)}`)

  // Kartu kilas: kosakata dan sains.
  for (const prefix of ['e', 's', 'm']) {
    await page.goto('/practice/cards')
    await page.waitForTimeout(600)
    const deck = page.locator(`main a[href*="/practice/cards/${prefix}${grade}"]`).first()
    if (!(await deck.isVisible().catch(() => false))) {
      say(prefix === 'm' ? 'INFO' : false, `${tag} tidak ada dek ${prefix}${grade}`)
      continue
    }
    const href = await deck.getAttribute('href')
    await deck.click()
    await page.waitForTimeout(1000)
    if (prefix === 'e') await page.screenshot({ path: `${OUT}/a2-${grade}-card.png`, fullPage: true })
    const sp = page.getByRole('button', { name: READ }).first()
    if (await sp.isVisible().catch(() => false)) {
      const r3 = await played(page, () => sp.click(), 2500)
      say(r3.plays > 0 && r3.errors.length === 0, `${tag} kartu ${href}: putar ${r3.plays}, selesai ${r3.ended}`)
    } else say(prefix === 'e' ? false : 'INFO', `${tag} kartu ${href}: tanpa tombol suara`)
  }

  // Album: kartu yang dimiliki. Beri satu kartu lewat bos? Lihat dulu yang ada.
  await page.goto('/world/cards')
  await page.waitForTimeout(800)
  const body = (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 260)
  say('INFO', `${tag} album: ${body}`)
  const ownedCard = page.locator('main button[aria-label]').filter({ hasText: /./ }).first()
  void ownedCard

  // Buku lalu pindah lewat tautan navigasi (bukan muat ulang): suara harus berhenti.
  await page.goto('/reading')
  await page.waitForTimeout(600)
  await page.locator('main a[href^="/reading/"]').first().click()
  await page.waitForTimeout(800)
  await page.locator('main a[href*="/reading/"]').first().click()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${OUT}/a2-${grade}-bookpage.png` })
  const rb = await played(page, () => page.getByRole('button', { name: en ? /Read along|^Play/ : /Baca bersama|^Putar|Baca/ }).first().click({ timeout: 6000 }), 700)
  say(rb.plays > 0, `${tag} buku: putar ${rb.plays}`)
  const nav = page.getByRole('link', { name: en ? /^Today/ : /^Hari ini/ }).first()
  await nav.click()
  await page.waitForURL((u) => u.pathname === '/today', { timeout: 15000 })
  await page.waitForTimeout(500)
  const s = await qa(page)
  say(s.playing === 0, `${tag} pindah lewat navigasi menghentikan suara (bermain ${s.playing})`)
  say(s.speak.length === 0, `${tag} suara perangkat ${s.speak.length}`)
  await b.close()
  await sql.end()
}
main().catch((e) => {
  console.error(String(e).slice(0, 1000))
  process.exit(1)
})
