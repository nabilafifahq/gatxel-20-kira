// Drill kosakata: contoh kalimat tidak membocorkan jawaban. Tombol dengar kartu memicu klip (klip dipalsukan, tidak membuat suara asli).
import { browser, done, ids, log, loginAisha, newCtx, overflow, PHONE, setLang, shot, sql } from './fitur-lib.mjs'

const { aisha } = await ids()
const b = await browser()
const settle = (page) => page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {})

try {
  await setLang(aisha, 'en')
  await sql`delete from learner_feature where learner_id = ${aisha}`
  const ctx = await newCtx(b, PHONE, { serviceWorkers: 'block' })
  await ctx.addInitScript(() => {
    window.__played = []
    const orig = window.HTMLMediaElement.prototype.play
    window.HTMLMediaElement.prototype.play = function () {
      window.__played.push(this.src || 'tanpa-src')
      setTimeout(() => this.dispatchEvent(new Event('ended')), 50)
      return Promise.resolve()
    }
    window.__origPlay = orig
    if (window.speechSynthesis) {
      window.__spoken = []
      const os = window.speechSynthesis.speak.bind(window.speechSynthesis)
      window.speechSynthesis.speak = (u) => {
        window.__spoken.push(u.text)
        void os
      }
    }
  })
  const ttsCalls = []
  // Layanan suara palsu: status aktif dan klip mp3 kecil. Tidak ada suara asli yang dibuat.
  await ctx.route('**/api/tts/today', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ enabled: true, urls: [] }) }))
  await ctx.route('**/api/tts/request', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  // Hanya klip di /tts/, bukan /api/tts/today: pola glob yang lebih longgar menimpa status palsu di atas.
  await ctx.route((url) => url.pathname.startsWith('/tts/'), async (route) => {
    ttsCalls.push(route.request().url())
    await route.fulfill({ status: 200, contentType: 'audio/mpeg', body: Buffer.from('ID3-stub') })
  })
  const page = await loginAisha(ctx)
  const seen = []
  page.on('request', (r) => { if (/tts/.test(r.url())) seen.push(r.method() + ' ' + new URL(r.url()).pathname.slice(0, 40)) })
  page.on('console', (m) => { if (m.type() === 'error') seen.push('console: ' + m.text().slice(0, 120)) })
  await page.goto('/practice/cards')
  await settle(page)
  await shot(page, 'kartu-hub-375')
  const links = await page.evaluate(() => [...document.querySelectorAll('a[href*="/practice/cards/"]')].map((a) => ({ h: a.getAttribute('href'), t: a.textContent.replace(/\s+/g, ' ').trim().slice(0, 50) })))
  log(null, 'dek', JSON.stringify(links.slice(0, 8)))
  const tab = page.getByRole('button', { name: 'Vocab drill' }).or(page.getByRole('link', { name: 'Vocab drill' })).or(page.getByRole('tab', { name: 'Vocab drill' }))
  log((await tab.count()) > 0, 'ada pintu drill kosakata di hub', String(await tab.count()))
  if (await tab.count()) await tab.first().click()
  await page.waitForTimeout(500)
  await shot(page, 'kartu-hub-vocab-375')
  const after = await page.evaluate(() => [...document.querySelectorAll('a[href*="/practice/cards/"]')].map((a) => a.getAttribute('href')))
  const vocab = { h: after.find((h) => h.includes('mode=vocab')) ?? '/practice/cards/e2-adjectives?mode=vocab' }
  log(after.some((h) => h.includes('mode=vocab')), 'tautan dek mode vocab', vocab.h)
  const scan = async (label) => {
    const main = (await page.locator('main, body').first().innerText()).replace(/\s+/g, ' ')
    const leak = /Example:/i.test(main)
    log(!leak, `${label}: tidak ada "Example:"`, main.slice(0, 200))
    return main
  }
  if (vocab) {
    await page.goto(vocab.h)
    await settle(page)
    await shot(page, 'vocab-kata-375')
    await scan('kata ke arti')
    const ov = await overflow(page)
    log(ov.scrollW <= ov.clientW, 'vocab: tanpa geser samping', JSON.stringify(ov.bad))
    // Pilihan yang memuat kata yang ditanyakan membocorkan jawaban.
    for (const [name, tagn] of [['Meaning to word', 'arti'], [/Spell/i, 'eja']]) {
      const btn = page.getByRole('button', { name }).first()
      if (await btn.count()) {
        await btn.click()
        await page.waitForTimeout(400)
        await shot(page, `vocab-${tagn}-375`)
        await scan(`mode ${tagn}`)
      } else log(false, `tombol mode ${tagn} tidak ada`)
    }
    const word = page.getByRole('button', { name: /Word to meaning|Word/i }).first()
    if (await word.count()) await word.click()
    await page.waitForTimeout(300)
    // Dengar: tombol baca di soal.
    const listen = page.getByRole('button', { name: 'Read aloud' }).first()
    log((await listen.count()) > 0, 'vocab: tombol dengar ada', await listen.innerText().catch(() => ''))
    const n0 = ttsCalls.length
    if (await listen.count()) {
      await listen.click()
      await page.waitForTimeout(1500)
      const st = await page.evaluate(() => ({ played: window.__played, spoken: window.__spoken ?? [] }))
      log(ttsCalls.length > n0 || st.played.length > 0 || st.spoken.length > 0, 'vocab: tombol memicu suara', `tts=${ttsCalls.slice(n0).join(',').slice(0, 140)} played=${st.played.length} spoken=${JSON.stringify(st.spoken).slice(0, 80)}`)
    }
    await shot(page, 'vocab-dengar-375')
  }
  // Kartu balik biasa: dengar dan balik.
  const flash = links.find((l) => !l.h.includes('mode=vocab'))
  if (flash) {
    await page.goto(flash.h)
    await settle(page)
    await shot(page, 'kartu-depan-375')
    const listen = page.getByRole('button', { name: 'Read aloud' }).first()
    await page.waitForTimeout(800)
    const n0 = ttsCalls.length
    if (await listen.count()) {
      log(null, 'tombol sebelum klik', JSON.stringify({ disabled: await listen.isDisabled(), pressed: await listen.getAttribute('aria-pressed') }))
      await listen.click()
      await page.waitForTimeout(150)
      log(null, 'tombol sesudah klik', JSON.stringify({ text: await page.locator('button[aria-pressed]').first().innerText().catch(() => ''), pressed: await page.locator('button[aria-pressed]').first().getAttribute('aria-pressed').catch(() => '') }))
      await page.waitForTimeout(1500)
      const st = await page.evaluate(() => ({ played: window.__played, spoken: window.__spoken ?? [] }))
      log(ttsCalls.length > n0 || st.played.length > 0 || st.spoken.length > 0, 'kartu: tombol dengar memicu suara', `tts=${ttsCalls.length - n0} played=${st.played.length} spoken=${JSON.stringify(st.spoken).slice(0, 80)}`)
    } else log(false, 'kartu: tombol dengar tidak ada', flash.h)
    await page.locator('[aria-label]').filter({ hasText: /./ }).first().waitFor({ timeout: 3000 }).catch(() => {})
    const ovf = await overflow(page)
    log(ovf.scrollW <= ovf.clientW, 'kartu: tanpa geser samping', JSON.stringify(ovf.bad))
  }
  log(null, 'permintaan tts', seen.slice(0, 8).join(' | '))
} catch (e) {
  log(false, 'skrip gagal', e.message.slice(0, 400))
} finally {
  await done(b)
}
