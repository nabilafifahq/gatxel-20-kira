// Suara di browser sungguhan: klip ada, klip hilang, tanpa suara perangkat, satu klip per waktu, tanpa bunyi sebelum sentuhan,
// dan kunci klip dihitung dari teks yang tampil di layar.
import { createHash } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { allItems } from './lib'
import { answer, BASE, chromium, ids, login, makeAttempt, PHONE, TABLET, sql, type Page } from './driver'
import { clipTextsOf, isClipText, letterClip, spokenBlanks, splitClipText, styleForPassageKind, styleForSkill, ttsKeyInput, type TtsStyleId } from '../../packages/core/src/tts'
import type { Item } from '../../packages/content/src/schema'
import type { BrowserContext, Route } from '@playwright/test'

const OUT = 'C:/kw5/qa-soal/.kira-local/qa-audio'
mkdirSync(OUT, { recursive: true })
const say = (ok: boolean | string, msg: string) => console.log(`${ok === true ? 'OK  ' : ok === false ? 'BAD ' : `${ok} `} ${msg}`)
const key = (t: string, s: TtsStyleId) => createHash('sha256').update(ttsKeyInput(t, s)).digest('hex')
const ref = (i: Item) => ({ ref: i.id, difficulty: i.difficulty })

type Qa = { speak: string[]; cancel: number; speakBeforeGesture: number; audioPlay: string[]; audioBeforeGesture: number; playing: number; maxPlaying: number; sfx: number; sfxBeforeGesture: number; overlaps: number; gesture: boolean; speakingNow: boolean }

const INIT = (withVoice: boolean, speechMs: number) => `
(() => {
  const q = window.__qa = { speak: [], cancel: 0, speakBeforeGesture: 0, audioPlay: [], audioBeforeGesture: 0, playing: 0, maxPlaying: 0, sfx: 0, sfxBeforeGesture: 0, overlaps: 0, gesture: false, speakingNow: false };
  for (const t of ['pointerdown','keydown','touchend']) addEventListener(t, () => { q.gesture = true }, true);
  let cur = null;
  const voices = ${withVoice} ? [{ lang: 'en-GB', name: 'qa', voiceURI: 'qa', localService: true, default: true }] : [];
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
    getVoices: () => voices,
    speaking: false,
    addEventListener() {}, removeEventListener() {},
    cancel() { q.cancel++; q.speakingNow = false; if (cur) { const c = cur; cur = null; c.onend && c.onend({}) } },
    speak(u) { q.speak.push(u.text); if (!q.gesture) q.speakBeforeGesture++; q.speakingNow = true; cur = u; setTimeout(() => { if (cur === u) { cur = null; q.speakingNow = false; u.onend && u.onend({}) } }, ${speechMs}) },
  }});
  window.SpeechSynthesisUtterance = function (t) { this.text = t };
  const RealAudio = window.Audio;
  window.Audio = function (src) {
    const a = { src: src || '', onended: null, onerror: null, _on: false,
      play() { q.audioPlay.push(this.src); if (!q.gesture) q.audioBeforeGesture++; if (!this._on) { this._on = true; q.playing++; q.maxPlaying = Math.max(q.maxPlaying, q.playing) } const self = this; clearTimeout(self._t); self._t = setTimeout(() => { if (self._on) { self._on = false; q.playing--; self.onended && self.onended({}) } }, ${speechMs}); return Promise.resolve() },
      pause() { if (this._on) { this._on = false; q.playing--; clearTimeout(this._t) } } };
    return a;
  };
  void RealAudio;
  const P = window.AudioContext && window.AudioContext.prototype;
  if (P) { const orig = P.createBufferSource; P.createBufferSource = function () { const n = orig.call(this); const s = n.start.bind(n); n.start = (...a) => { q.sfx++; if (!q.gesture) q.sfxBeforeGesture++; if (q.playing > 0 || q.speakingNow) q.overlaps++; return s(...a) }; return n } }
})();
`

const qa = (p: Page) => p.evaluate(() => (window as unknown as { __qa: Qa }).__qa)

async function newLogged(browser: import('@playwright/test').Browser, withVoice: boolean, speechMs: number): Promise<{ ctx: BrowserContext; page: Page; errs: string[] }> {
  const ctx = await browser.newContext({ locale: 'en-GB', timezoneId: 'Asia/Jakarta', viewport: TABLET, hasTouch: true })
  await ctx.addInitScript(INIT(withVoice, speechMs))
  const page = await login(ctx, 'Raka')
  const errs: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('429')) errs.push(m.text().slice(0, 160))
  })
  page.on('pageerror', (e) => errs.push(`pageerror ${e.message.slice(0, 160)}`))
  return { ctx, page, errs }
}

async function main() {
  const items = allItems()
  const { org, raka } = await ids()
  const who = { org, id: raka }
  const browser = await chromium.launch()
  const mcq = items.find((i) => i.type === 'mcq' && i.id.startsWith('e4.') && !i.passage && !i.figure)! as Extract<Item, { type: 'mcq' }>
  const mcq2 = items.find((i) => i.type === 'mcq' && i.id.startsWith('e5.') && !i.passage && !i.figure)! as Extract<Item, { type: 'mcq' }>
  const passageItem = items.find((i) => i.type === 'mcq' && i.passage && i.id.startsWith('e5.'))! as Extract<Item, { type: 'mcq' }>
  const listen = items.find((i) => i.type === 'listen' && i.id.startsWith('e3.'))! as Extract<Item, { type: 'listen' }>
  const spell = items.find((i) => i.type === 'spell' && i.id.startsWith('e4.'))! as Extract<Item, { type: 'spell' }>
  const idItem = items.find((i) => i.lang === 'id' && (i.type === 'mcq' || i.type === 'numeric'))

  // ---- A. Klip ada: kunci dari teks layar, satu klip per waktu, jawaban tidak ikut terbaca.
  {
    const { ctx, page, errs } = await newLogged(browser, true, 900)
    const requested: string[] = []
    await ctx.route('**/api/tts/today', (r: Route) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ enabled: true, urls: [] }) }))
    await ctx.route('**/tts/*.mp3', (r: Route) => {
      requested.push(new URL(r.request().url()).pathname.replace('/tts/', '').replace('.mp3', ''))
      return r.fulfill({ status: 200, contentType: 'audio/mpeg', body: Buffer.from('ID3') })
    })
    const id = await makeAttempt(who, [mcq, mcq2].map(ref), 'english')
    await page.goto(`${BASE}/run/${id}`)
    await page.locator('section[aria-label="Your answer"]').waitFor()
    await page.waitForTimeout(1200)
    const before = await qa(page)
    say(before.sfxBeforeGesture === 0 && before.speakBeforeGesture === 0 && before.audioBeforeGesture === 0, `tanpa bunyi sebelum sentuhan pertama (sfx ${before.sfxBeforeGesture}, suara ${before.speakBeforeGesture}, klip ${before.audioBeforeGesture})`)
    const prompt = (await page.locator('section[aria-label="Question"] p').first().innerText()).trim()
    const optionTexts = await page.getByRole('group', { name: 'Answers' }).locator('button').evaluateAll((els) => els.map((e) => (e.getAttribute('aria-label') ?? '').replace(/^[A-F], /, '')))
    const style = styleForSkill(mcq.skill)
    const expected = clipTextsOf([spokenBlanks(prompt), ...optionTexts.flatMap((t, i) => [letterClip(i), t])]).map((t) => key(t, style))
    await page.getByRole('button', { name: /Read aloud/ }).last().click()
    await page.waitForTimeout(800)
    const missingFromRequest = expected.filter((k) => !requested.includes(k))
    const extra = requested.filter((k) => !expected.includes(k))
    say(missingFromRequest.length === 0 && extra.length === 0, `kunci klip sama dengan teks di layar: diharapkan ${expected.length}, diminta ${requested.length}, kurang ${missingFromRequest.length}, lebih ${extra.length}`)
    // Tap lagi: berhenti.
    await page.getByRole('button', { name: /Reading|Stop reading/ }).last().click()
    const p1 = (await qa(page)).playing
    await page.waitForTimeout(200)
    say(p1 === 0, `ketuk lagi menghentikan klip (masih bermain ${p1})`)
    // Mulai membaca, lalu Check dan Next: apakah suara soal lama tetap jalan?
    await page.getByRole('button', { name: /Read aloud/ }).last().click()
    await page.waitForTimeout(300)
    const playingA = (await qa(page)).playing
    await answer(page, mcq, true, { issues: [] })
    await page.getByRole('button', { name: 'Check', exact: true }).click()
    await page.locator('[role=status] h2', { hasText: /^Correct$/ }).first().waitFor()
    await page.waitForTimeout(250)
    const afterCheck = await qa(page)
    say(afterCheck.playing === 0, `Check menghentikan bacaan soal (sebelum ${playingA}, sesudah ${afterCheck.playing}, tumpang tindih sfx ${afterCheck.overlaps})`)
    await page.locator('[role=status]').getByRole('button', { name: 'Next', exact: true }).click()
    await page.waitForTimeout(250)
    const afterNext = await qa(page)
    say(afterNext.playing === 0, `Next tidak membawa suara soal lama ke soal baru (bermain ${afterNext.playing})`)
    say(afterNext.maxPlaying <= 1, `paling banyak satu klip bersamaan (puncak ${afterNext.maxPlaying})`)
    say(errs.length === 0, `konsol bersih saat klip ada: ${JSON.stringify(errs.slice(0, 3))}`)
    await ctx.close()
  }

  // ---- B. Bacaan panjang dan tombol kedua: satu suara saja, kunci bacaan cocok.
  {
    const { ctx, page } = await newLogged(browser, true, 1500)
    const requested: string[] = []
    await ctx.route('**/api/tts/today', (r: Route) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ enabled: true, urls: [] }) }))
    await ctx.route('**/tts/*.mp3', (r: Route) => {
      requested.push(new URL(r.request().url()).pathname.replace('/tts/', '').replace('.mp3', ''))
      return r.fulfill({ status: 200, contentType: 'audio/mpeg', body: Buffer.from('ID3') })
    })
    const id = await makeAttempt(who, [ref(passageItem)], 'english')
    await page.goto(`${BASE}/run/${id}`)
    await page.locator('section[aria-label="Your answer"]').waitFor()
    const panel = page.locator('section[aria-label="Question"] section').first()
    const paras = await panel.locator('p').allInnerTexts()
    await panel.getByRole('button', { name: 'Read aloud' }).click()
    await page.waitForTimeout(600)
    // Bacaan dan paragraf klipnya dipecah per paragraf (\n\n), sama dengan layar.
    const passages = paras.join('\n\n')
    const style = styleForPassageKind((await import('../../packages/content/src/load')).loadContent().index.passages.get(passageItem.passage!)!.kind)
    const want = splitClipText(passages).filter(isClipText).map((t) => key(t, style))
    const miss = want.filter((k) => !requested.includes(k))
    say(miss.length === 0, `klip bacaan dari teks layar: ${want.length} klip, tidak diminta ${miss.length}`)
    // Tombol bacaan jalan, lalu tombol soal: yang pertama berhenti.
    await page.getByRole('button', { name: /Read aloud/ }).last().click()
    await page.waitForTimeout(600)
    const s = await qa(page)
    say(s.maxPlaying <= 1, `dua tombol baca: satu suara saja (puncak ${s.maxPlaying})`)
    await ctx.close()
  }

  // ---- C. Klip hilang, layanan aktif: suara perangkat dipakai, klip diminta dibuat, tidak ada UI rusak.
  {
    const { ctx, page, errs } = await newLogged(browser, true, 700)
    const reqs: string[] = []
    await ctx.route('**/api/tts/today', (r: Route) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ enabled: true, urls: [] }) }))
    await ctx.route('**/api/tts/request', (r: Route) => {
      reqs.push(r.request().postData() ?? '')
      return r.fulfill({ status: 202, contentType: 'application/json', body: '{}' })
    })
    const id = await makeAttempt(who, [ref(listen), ref(spell)], 'english')
    await page.goto(`${BASE}/run/${id}`)
    await page.locator('section[aria-label="Your answer"]').waitFor()
    await page.getByRole('button', { name: 'Play the audio' }).click()
    await page.waitForTimeout(700)
    const s = await qa(page)
    say(s.speak.some((t) => t.includes(listen.listenText.slice(0, 20))), `klip dengar hilang: suara perangkat membacakan listenText (${s.speak.length} ucapan)`)
    say(reqs.length >= 1, `klip yang hilang diminta dibuat (${reqs.length} permintaan)`)
    await page.waitForTimeout(800)
    const replay = await page.getByRole('button', { name: 'Play it again' }).count()
    say(replay === 1, 'tombol putar berubah menjadi Play it again')
    await page.getByRole('button', { name: 'Play it again' }).click()
    await page.waitForTimeout(150)
    say(((await qa(page)).speak.length) >= 2, 'putar ulang berjalan')
    await page.screenshot({ path: `${OUT}/listen-missing-clip.png` })
    const prompt = await page.locator('section[aria-label="Question"]').innerText()
    say(!prompt.includes(listen.listenText.slice(0, 25)), 'teks dengar tidak tampil di layar sebelum menjawab')
    console.log('INFO konsol saat klip 404:', JSON.stringify(errs.slice(0, 2)), errs.length)
    await ctx.close()
  }

  // ---- D. Tidak ada suara sama sekali (WebView tanpa TTS, layanan mati).
  {
    const { ctx, page } = await newLogged(browser, false, 500)
    await ctx.route('**/api/tts/today', (r: Route) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ enabled: false, urls: [] }) }))
    const id = await makeAttempt(who, [ref(listen), ref(spell), ref(mcq)], 'english')
    await page.setViewportSize(PHONE)
    await page.goto(`${BASE}/run/${id}`)
    await page.locator('section[aria-label="Your answer"]').waitFor()
    await page.waitForTimeout(1800)
    await page.screenshot({ path: `${OUT}/listen-no-voice-phone.png` })
    const disabled = await page.getByRole('button', { name: /Play the audio/ }).isDisabled().catch(() => null)
    const note = await page.getByText(/No English voice/).first().isVisible().catch(() => false)
    say(disabled === true && note, `tanpa suara: tombol mati dan ada catatan (mati ${disabled}, catatan ${note})`)
    const words = await page.getByRole('button', { name: /Show the words/ }).count()
    console.log(`INFO tanpa suara, soal dengar: tombol tampilkan kata ${words}. Anak tetap bisa menekan pilihan tetapi tidak mendengar soalnya.`)
    await ctx.close()
  }

  // ---- E. Hanya bahasa Inggris yang dibacakan.
  if (idItem) {
    const { ctx, page } = await newLogged(browser, true, 500)
    const reqs: string[] = []
    await ctx.route('**/tts/*.mp3', (r: Route) => {
      reqs.push(r.request().url())
      return r.abort()
    })
    const id = await makeAttempt(who, [ref(idItem)], idItem.skill[0] === 'm' ? 'math' : 'science')
    await page.goto(`${BASE}/run/${id}`)
    await page.locator('section[aria-label="Your answer"]').waitFor()
    const btn = await page.getByRole('button', { name: /Read aloud/ }).count()
    say(btn === 0, `soal bahasa Indonesia ${idItem.id}: tombol baca ${btn}`)
    await ctx.close()
  } else {
    console.log('INFO tidak ada soal bahasa Indonesia di bank tertulis')
  }

  // ---- F. Bunyi efek setelah sentuhan dan berkas suara termuat.
  {
    const { ctx, page } = await newLogged(browser, true, 300)
    const sounds: string[] = []
    page.on('response', (r) => {
      if (r.url().includes('/sounds/')) sounds.push(`${r.status()} ${r.url().split('/sounds/')[1]}`)
    })
    const id = await makeAttempt(who, [mcq, mcq2].map(ref), 'english')
    await page.goto(`${BASE}/run/${id}`)
    await page.locator('section[aria-label="Your answer"]').waitFor()
    await answer(page, mcq, true, { issues: [] })
    await page.getByRole('button', { name: 'Check', exact: true }).click()
    await page.waitForTimeout(1000)
    const s = await qa(page)
    say(s.sfx >= 1, `bunyi efek berjalan setelah sentuhan (${s.sfx} bunyi)`)
    say(sounds.every((x) => x.startsWith('200')), `${sounds.length} berkas suara termuat ${JSON.stringify(sounds.filter((x) => !x.startsWith('200')))}`)
    await ctx.close()
  }

  await browser.close()
  await sql.end()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
