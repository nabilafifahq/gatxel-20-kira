// Suara sungguhan dengan klip nyata: kunci sesuai teks, satu suara, tanpa suara perangkat, berhenti saat pindah layar, profil WebView.
import { createHash } from 'node:crypto'
import { clipTextsOf, isClipText, letterClip, spokenBlanks, splitClipText, styleForPassageKind, styleForSkill, ttsKeyInput, type TtsStyleId } from '../../packages/core/src/tts'
import { loadContent } from '../../packages/content/src/load'
import type { Item } from '../../packages/content/src/schema'
import { allItems } from '../qa-soal/lib'
import { ensureToday } from './a2-sessions'
import { chromium, families, newCtx, OUT, PHONE, qa, say, sql, TABLET, WEBVIEW_UA, type Family, type Page } from './lib'

const VERSION = 'piper-lessac-medium'
const key = (t: string, s: TtsStyleId) => createHash('sha256').update(ttsKeyInput(t, s, VERSION)).digest('hex')

async function mkAttempt(f: Family, refs: { id: string; difficulty: number }[], subject: string, opts: { mode?: string; timeLimitS?: number } = {}) {
  const items = refs.map((r, i) => ({ ref: r.id, section: 'core', position: i + 1, difficulty: r.difficulty }))
  const rows = await sql`insert into attempt (org_id, learner_id, kind, mode, subject, title, items, time_limit_s)
    values (${f.orgId!}, ${f.learnerId!}, 'test', ${opts.mode ?? 'latihan'}, ${subject}, 'QA suara', ${sql.json(items)}, ${opts.timeLimitS ?? null}) returning id`
  return rows[0]!.id as string
}

function trackClips(page: Page) {
  const clips: { key: string; status: number }[] = []
  page.on('response', (r) => {
    const u = new URL(r.url())
    if (u.pathname.startsWith('/tts/') && u.pathname.endsWith('.mp3')) clips.push({ key: u.pathname.slice(5, -4), status: r.status() })
  })
  return clips
}

const untilEnded = async (page: Page, n: number, ms = 15000) => {
  const end = Date.now() + ms
  while (Date.now() < end) {
    const s = await qa(page)
    if (s.ended >= n) return true
    await page.waitForTimeout(150)
  }
  return false
}

async function main() {
  const f = families().find((x) => x.grade === 4)!
  const fid = families().find((x) => x.grade === 3)!
  const items = allItems()
  const b = await chromium.launch()
  const ua = process.argv[2] === 'webview' ? WEBVIEW_UA : undefined
  const tag = process.argv[2] === 'webview' ? 'wv' : 'std'
  const vp = process.argv[2] === 'webview' ? PHONE : TABLET
  const mcq = items.find((i) => i.type === 'mcq' && i.id.startsWith('e4.') && !i.passage && !i.figure)! as Extract<Item, { type: 'mcq' }>
  const mcq2 = items.find((i) => i.type === 'mcq' && i.id.startsWith('e4.') && !i.passage && !i.figure && i.id !== mcq.id)! as Extract<Item, { type: 'mcq' }>
  const listen = items.find((i) => i.type === 'listen' && i.id.startsWith('e3.'))! as Extract<Item, { type: 'listen' }>
  const spell = items.find((i) => i.type === 'spell' && i.id.startsWith('e4.'))! as Extract<Item, { type: 'spell' }>
  const pass = items.find((i) => i.type === 'mcq' && i.passage && i.id.startsWith('e5.'))! as Extract<Item, { type: 'mcq' }>
  say('INFO', `audio ${tag}: mcq ${mcq.id} listen ${listen.id} spell ${spell.id} passage ${pass.id}`)

  const ctx = await newCtx(b, { viewport: vp, ua, tag: `audio-${tag}`, state: `${OUT}/state-g4.json` })
  const page = await ctx.newPage()
  const clips = trackClips(page)
  await ensureToday(page, f)
  await page.waitForTimeout(800)
  const fresh0 = await qa(page)
  say(fresh0.sfxBeforeGesture === 0 && fresh0.playBeforeGesture === 0, `${tag}: tanpa bunyi sebelum sentuhan di Today (sfx ${fresh0.sfxBeforeGesture}, klip ${fresh0.playBeforeGesture})`)

  // A. Baca soal pilihan ganda: kunci sama dengan teks layar, klip nyata selesai diputar.
  const id = await mkAttempt(f, [mcq, mcq2, listen, spell], 'english')
  await page.goto(`/run/${id}`)
  await page.locator('section[aria-label="Your answer"]').waitFor()
  await page.waitForTimeout(1000)
  const s0 = await qa(page)
  say(s0.sfxBeforeGesture === 0 && s0.playBeforeGesture === 0, `${tag}: tanpa bunyi sebelum sentuhan di runner (sfx ${s0.sfxBeforeGesture}, klip ${s0.playBeforeGesture})`)
  const prompt = (await page.locator('section[aria-label="Question"] p').first().innerText()).trim()
  const optionTexts = await page.getByRole('group', { name: 'Answers' }).locator('button').evaluateAll((els) => els.map((e) => (e.getAttribute('aria-label') ?? '').replace(/^[A-F], /, '')))
  const style = styleForSkill(mcq.skill)
  const expected = clipTextsOf([spokenBlanks(prompt), ...optionTexts.flatMap((t, i) => [letterClip(i), t])]).map((t) => key(t, style))
  await page.getByRole('button', { name: /Read aloud/ }).last().click()
  await page.waitForTimeout(1200)
  const miss = expected.filter((k) => !clips.some((c) => c.key === k))
  say(miss.length === 0, `${tag}: kunci klip soal sesuai teks (termasuk pramuat): diharapkan ${expected.length}, diminta ${clips.length}, kurang ${miss.length}`)
  const bad = clips.filter((c) => c.status !== 200)
  say(bad.length === 0, `${tag}: semua klip soal ada ${JSON.stringify(bad.slice(0, 3))}`)
  const ended = await untilEnded(page, 1, 12000)
  const s1 = await qa(page)
  say(ended && s1.clipErrors.length === 0, `${tag}: klip nyata benar-benar diputar sampai selesai (selesai ${s1.ended}, galat ${JSON.stringify(s1.clipErrors.slice(0, 2))})`)
  say(s1.maxPlaying <= 1, `${tag}: paling banyak satu klip (puncak ${s1.maxPlaying}) ${JSON.stringify(s1.overlapSrc.slice(0, 1))}`)
  // Ketuk lagi: berhenti.
  await page.waitForTimeout(100)
  const stopBtn = page.getByRole('button', { name: /Reading|Stop reading/ }).last()
  if (await stopBtn.isVisible().catch(() => false)) {
    await stopBtn.click()
    await page.waitForTimeout(250)
    const s2 = await qa(page)
    say(s2.playing === 0, `${tag}: ketuk lagi menghentikan bacaan (bermain ${s2.playing})`)
  }
  // Baca lalu jawab dan Check: suara soal berhenti.
  await page.getByRole('button', { name: /Read aloud/ }).last().click()
  await page.waitForTimeout(600)
  const opt = mcq.options[mcq.answer]!.text!
  await page.getByRole('group', { name: 'Answers' }).locator('button').filter({ hasText: opt }).first().click()
  await page.getByRole('button', { name: 'Check', exact: true }).click()
  await page.locator('[role=status] h2').first().waitFor()
  await page.waitForTimeout(250)
  const s3 = await qa(page)
  say(s3.playing === 0, `${tag}: Check menghentikan bacaan (bermain ${s3.playing})`)
  say(s3.sfx >= 1, `${tag}: bunyi efek setelah Check berjalan (${s3.sfx})`)
  await page.locator('[role=status]').getByRole('button', { name: 'Next', exact: true }).click({ timeout: 8000 })
  await page.waitForTimeout(500)
  // Soal kedua: baca lalu ketuk keluar. Next yang sudah lewat tidak membawa suara.
  await page.getByRole('button', { name: /Read aloud/ }).last().click()
  await page.waitForTimeout(500)
  const m2t = (await page.locator('section[aria-label="Your answer"] button').first().getAttribute('aria-label'))
  await page.locator('section[aria-label="Your answer"] button').first().click()
  await page.getByRole('button', { name: 'Check', exact: true }).click()
  await page.locator('[role=status] h2').first().waitFor()
  const h = await page.locator('[role=status] h2').first().innerText()
  if (/Not yet/.test(h)) {
    await page.getByRole('button', { name: 'Try again', exact: true }).click()
    await page.locator('section[aria-label="Your answer"] button').filter({ hasText: mcq2.options[mcq2.answer]!.text! }).first().click()
    await page.getByRole('button', { name: 'Check', exact: true }).click()
    await page.locator('[role=status] h2').first().waitFor()
  }
  await page.locator('[role=status]').getByRole('button', { name: 'Next', exact: true }).click({ timeout: 8000 })
  void m2t

  // B. Dengar: tombol hidup, klip sesuai listenText, putar lagi, teks tidak tampil.
  await page.getByRole('button', { name: 'Play the audio' }).waitFor({ timeout: 10000 })
  await page.waitForTimeout(400)
  const off = await page.getByRole('button', { name: 'Play the audio' }).isDisabled()
  say(!off, `${tag}: tombol dengar hidup dengan klip nyata`)
  await page.screenshot({ path: `${OUT}/audio-${tag}-listen.png` })
  const e0 = (await qa(page)).ended
  await page.getByRole('button', { name: 'Play the audio' }).click()
  const wantL = clipTextsOf(splitClipText(listen.listenText)).map((t) => key(t, styleForSkill(listen.skill)))
  await page.waitForTimeout(800)
  say(wantL.every((k) => clips.some((c) => c.key === k && c.status === 200)), `${tag}: klip dengar ${listen.id} ada dan sesuai (${clips.length} diminta, ${wantL.length} diharapkan)`)
  const okL = await untilEnded(page, e0 + 1, 15000)
  say(okL, `${tag}: klip dengar selesai diputar`)
  const qtxt = await page.locator('section[aria-label="Question"]').innerText()
  say(!qtxt.includes(listen.listenText.slice(0, 20)), `${tag}: teks dengar tidak tampil`)
  await page.getByRole('button', { name: 'Play it again' }).waitFor({ timeout: 8000 }).catch(() => say(false, `${tag}: tombol Play it again tidak muncul`))
  // Jawab dengan benar.
  await page.locator('section[aria-label="Your answer"]').getByRole('group', { name: 'Answers' }).locator('button').filter({ hasText: (listen.options[listen.answer]! as { text?: string }).text ?? '' }).first().click()
  await page.getByRole('button', { name: 'Check', exact: true }).click()
  await page.locator('[role=status] h2').first().waitFor()
  await page.locator('[role=status]').getByRole('button', { name: 'Next', exact: true }).click({ timeout: 8000 })
  // C. Eja.
  const playSpell = page.getByRole('button', { name: /Hear the word|Play it again/ }).first()
  await playSpell.waitFor({ timeout: 10000 })
  const e1 = (await qa(page)).ended
  await playSpell.click()
  await page.waitForTimeout(800)
  const statuses = clips.map((c) => c.status)
  say(statuses.length > 0 && statuses.every((x) => x === 200), `${tag}: klip eja ${spell.id} ada (${JSON.stringify(statuses)})`)
  say(await untilEnded(page, e1 + 1, 10000), `${tag}: klip eja selesai diputar`)
  // D. Klip mulai lalu keluar lewat tombol keluar: suara berhenti.
  await playSpell.click().catch(() => {})
  await page.waitForTimeout(250)
  await page.getByRole('button', { name: 'Exit quest' }).or(page.getByRole('button', { name: /Exit/ })).first().click({ timeout: 5000 }).catch(() => say('INFO', `${tag}: tombol keluar tidak ketemu`))
  await page.waitForTimeout(250)
  await page.getByRole('button', { name: 'Leave', exact: true }).or(page.getByRole('link', { name: 'Leave', exact: true })).first().click({ timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(1200)
  const s4 = await qa(page).catch(() => null)
  say(!s4 || s4.playing === 0, `${tag}: pindah layar menghentikan suara (bermain ${s4?.playing}), url ${new URL(page.url()).pathname}`)

  // E. Bacaan dan soal: dua tombol, satu suara. Kunci bacaan sama dengan layar.
  const content = loadContent().index
  const idp = await mkAttempt(f, [pass], 'english')
  await page.goto(`/run/${idp}`)
  await page.locator('section[aria-label="Your answer"]').waitFor()
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}/audio-${tag}-passage.png`, fullPage: true })
  const panel = page.locator('section[aria-label="Question"] section').first()
  const paras = await panel.locator('p').allInnerTexts()
  const pst = styleForPassageKind(content.passages.get(pass.passage!)!.kind)
  const wantP = splitClipText(paras.join('\n\n')).filter(isClipText).map((t) => key(t, pst))
  const sBefore = await qa(page)
  await panel.getByRole('button', { name: 'Read aloud' }).click()
  await page.waitForTimeout(1000)
  const missP = wantP.filter((k) => !clips.some((c) => c.key === k))
  const bad404 = clips.filter((c) => c.status !== 200)
  say(missP.length === 0 && bad404.length === 0, `${tag}: klip bacaan ${pass.passage}: diharapkan ${wantP.length}, kurang ${missP.length}, 404 ${bad404.length}`)
  await page.getByRole('button', { name: /Read aloud/ }).last().click()
  await page.waitForTimeout(800)
  const s5 = await qa(page)
  say(s5.maxPlaying <= 1, `${tag}: dua tombol baca satu suara (puncak ${s5.maxPlaying}, sebelumnya ${sBefore.maxPlaying})`)

  // F. Buku: baca bersama dengan sorotan kalimat, simpan posisi.
  await page.goto('/reading')
  await page.waitForTimeout(500)
  const book = page.locator('main a[href^="/reading/"]').first()
  const bookHref = await book.getAttribute('href')
  await book.click()
  await page.waitForURL((u) => u.pathname.startsWith('/reading/') && u.pathname !== '/reading', { timeout: 15000 })
  await page.waitForTimeout(600)
  const chap = page.locator('main a[href*="/reading/"]').first()
  if (await chap.isVisible().catch(() => false)) {
    await chap.click()
    await page.waitForTimeout(1200)
  }
  await page.screenshot({ path: `${OUT}/audio-${tag}-reader.png`, fullPage: true })
  clips.length = 0
  const e2 = (await qa(page)).ended
  const read = page.getByRole('button', { name: /Read along|Play/ }).first()
  say(await read.isVisible().catch(() => false), `${tag}: tombol baca bersama ada, buku ${bookHref}, url ${new URL(page.url()).pathname}`)
  await read.click().catch(() => {})
  await page.waitForTimeout(800)
  const hl = await page.evaluate(() => {
    const m = document.querySelector('[aria-current="true"], [data-active="true"], [data-sentence-active="true"], .bg-highlight, mark')
    return m ? (m as HTMLElement).innerText.slice(0, 80) : null
  })
  await page.screenshot({ path: `${OUT}/audio-${tag}-reader-play.png` })
  const c1 = await untilEnded(page, e2 + 1, 15000)
  say(c1 && clips.length > 0 && clips.every((c) => c.status === 200), `${tag}: buku klip diputar: ${clips.length} klip, selesai ${c1}, status ${JSON.stringify([...new Set(clips.map((c) => c.status))])}`)
  say('INFO', `${tag}: sorotan kalimat: ${JSON.stringify(hl)}`)
  await page.waitForTimeout(300)
  const hl2 = await page.evaluate(() => {
    const m = document.querySelector('[aria-current="true"], [data-active="true"], [data-sentence-active="true"], .bg-highlight, mark')
    return m ? (m as HTMLElement).innerText.slice(0, 80) : null
  })
  say('INFO', `${tag}: sorotan setelah satu kalimat: ${JSON.stringify(hl2)}`)
  // Pindah layar lewat tautan.
  await page.goto('/today')
  await page.waitForTimeout(500)
  const s6 = await qa(page)
  say(s6.playing === 0 && s6.speak.length === 0, `${tag}: keluar buku berhenti, suara perangkat ${s6.speak.length}`)

  // G. Kamus Ketuk di soal.
  const idw = await mkAttempt(f, [mcq2], 'english')
  await page.goto(`/run/${idw}`)
  await page.locator('section[aria-label="Your answer"]').waitFor()
  await page.waitForTimeout(500)
  const word = page.locator('section[aria-label="Question"] button').filter({ hasText: /^[A-Za-z]{4,}$/ }).first()
  if (await word.isVisible().catch(() => false)) {
    await word.click()
    await page.waitForTimeout(700)
    await page.screenshot({ path: `${OUT}/audio-${tag}-dict.png` })
    clips.length = 0
    const e3 = (await qa(page)).ended
    const dlg = page.getByRole('dialog').first()
    const sp = dlg.getByRole('button', { name: /Read aloud|Reading/ }).first()
    if (await sp.isVisible().catch(() => false)) {
      await sp.click()
      await page.waitForTimeout(900)
      say(clips.length > 0 && clips.every((c) => c.status === 200) && (await untilEnded(page, e3 + 1, 8000)), `${tag}: kata kamus bersuara (${clips.length} klip, ${JSON.stringify(clips.map((c) => c.status))})`)
    } else say(false, `${tag}: tombol suara di kamus tidak ada, isi: ${(await dlg.innerText().catch(() => '')).slice(0, 120)}`)
  } else say('INFO', `${tag}: tidak ada kata ketuk di soal`)

  // H. Kartu kilas.
  await page.goto('/practice/cards')
  await page.waitForTimeout(600)
  const deck = page.locator('main a[href*="/practice/cards"]').first()
  if (await deck.isVisible().catch(() => false)) {
    await deck.click()
    await page.waitForTimeout(1000)
    await page.screenshot({ path: `${OUT}/audio-${tag}-card.png`, fullPage: true })
    clips.length = 0
    const e4 = (await qa(page)).ended
    const sp = page.getByRole('button', { name: /Read aloud/ }).first()
    if (await sp.isVisible().catch(() => false)) {
      await sp.click()
      await page.waitForTimeout(900)
      say(clips.length > 0 && clips.every((c) => c.status === 200) && (await untilEnded(page, e4 + 1, 8000)), `${tag}: kartu kilas bersuara (${clips.length} klip, ${JSON.stringify(clips.map((c) => c.status))})`)
    } else say('INFO', `${tag}: dek pertama tanpa tombol suara, url ${page.url()}`)
  } else say(false, `${tag}: tidak ada dek kartu`)

  // I. Efek suara dimatikan.
  await page.goto('/me')
  await page.waitForTimeout(500)
  const toggle = page.getByRole('button', { name: /Sound effects are on/ })
  if (await toggle.isVisible().catch(() => false)) {
    await toggle.click()
    await page.waitForTimeout(200)
    const idm = await mkAttempt(f, [mcq, mcq2], 'english')
    await page.goto(`/run/${idm}`)
    await page.locator('section[aria-label="Your answer"]').waitFor()
    await page.waitForTimeout(400)
    const sfx0 = (await qa(page)).sfx
    await page.locator('section[aria-label="Your answer"]').getByRole('group', { name: 'Answers' }).locator('button').filter({ hasText: mcq.options[mcq.answer]!.text! }).first().click()
    await page.getByRole('button', { name: 'Check', exact: true }).click()
    await page.locator('[role=status] h2').first().waitFor()
    await page.waitForTimeout(600)
    const sfx1 = (await qa(page)).sfx
    say(sfx1 === sfx0, `${tag}: efek suara mati dihormati (bunyi ${sfx1 - sfx0})`)
    await page.goto('/me')
    await page.getByRole('button', { name: /Sound effects are off/ }).click({ timeout: 8000 }).catch(() => say(false, `${tag}: status mati tidak tersimpan setelah pindah layar`))
  } else say('INFO', `${tag}: tombol efek suara tidak ada di /me`)

  const end = await qa(page)
  say(end.speak.length === 0, `${tag}: speechSynthesis.speak tidak pernah dipanggil di halaman terakhir (${end.speak.length})`)
  await ctx.close()

  // J. Anak antarmuka Indonesia: soal Inggris tetap bersuara.
  const ctx2 = await newCtx(b, { viewport: vp, ua, tag: `audio-${tag}-id`, state: `${OUT}/state-g3.json` })
  const p2 = await ctx2.newPage()
  const clips2 = trackClips(p2)
  await ensureToday(p2, fid)
  const e3i = items.find((i) => i.type === 'mcq' && i.id.startsWith('e3.') && !i.passage && !i.figure)! as Extract<Item, { type: 'mcq' }>
  const idi = await mkAttempt(fid, [e3i], 'english')
  await p2.goto(`/run/${idi}`)
  await p2.locator('section[aria-label="Jawabanmu"]').waitFor()
  await p2.waitForTimeout(600)
  await p2.getByRole('button', { name: /Bacakan/ }).last().click({ timeout: 5000 }).catch(() => say(false, `${tag}: anak Indonesia, tombol Bacakan tidak ada`))
  await p2.waitForTimeout(900)
  say(clips2.length > 0 && clips2.every((c) => c.status === 200), `${tag}: anak Indonesia mendengar soal Inggris (${clips2.length} klip)`)
  const e = await qa(p2)
  say(e.speak.length === 0, `${tag}: anak Indonesia suara perangkat ${e.speak.length}`)
  await ctx2.close()
  await b.close()
  await sql.end()
}
main().catch((e) => {
  console.error(String(e).slice(0, 1500))
  process.exit(1)
})
