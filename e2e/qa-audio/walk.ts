// Suara ujung ke ujung per layar: play() selesai, currentTime maju, durasi masuk akal, satu suara, tanpa speechSynthesis.
import { chromium, webkit, type BrowserContext, type Locator, type Page } from '@playwright/test'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { BASE, EN_VER, ID_VER, INIT, OUT, ROOT, SIZES, WEBVIEW_UA, allContentItems, allIn, heldSet, idOf, isHeld, makeAttempt, man, pinIn, psql, useStaging, qa, sleep, trackNet, type Net, type PlayRec, type RawItem } from './lib'

type Kid = { name: string; grade: number; id: string; org: string; state: string; uiLang: string }
type Clip = { key: string | null; ver: string; style: string; text: string; resolved: boolean | null; err: string | null; ct: number; dur: number | null; ended: boolean; cps: number | null; byteLen: number | null }
type R = { surface: string; ok: boolean; notes: string[]; clips: Clip[] }

const argv = process.argv.slice(2)
const ONLY = process.env.QA_ONLY?.split(',')
const SIZE_FILTER = process.env.QA_SIZES?.split(',')
const UA_FILTER = process.env.QA_UA?.split(',') ?? ['chromium', 'webview']
void argv

const kids = JSON.parse(readFileSync(join(OUT, 'kids.json'), 'utf8')) as Kid[]
const kid = kids.find((k) => k.name.startsWith('Audio'))!
const items = allContentItems()
const held = heldSet()

const singleSentence = (s: string) => !/[.!?]\s+\S/.test(s.trim())
const multiSentence = (s: string) => /[.!?]\s+[A-Z]/.test(s.trim())
const teacherOk = (t: string) => allIn(t, 'teacher', EN_VER)
const en4 = items.filter((i) => i.lang === 'en-GB' && !i.passage && !i.figure)
const isGoodMcq = (i: RawItem) => i.type === 'mcq' && i.options.every((o: { text?: string; figure?: unknown }) => o.text && !o.figure)
const mcqSingle = en4.find((i) => i.id.startsWith('e4.') && isGoodMcq(i) && singleSentence(i.prompt) && teacherOk(i.prompt) && i.explanation && idOf(i.explanation) && allIn(idOf(i.explanation)!, 'indonesian', ID_VER))!
const mcqMulti = en4.find((i) => i.id.startsWith('e4.') && isGoodMcq(i) && multiSentence(i.prompt) && teacherOk(i.prompt))!
const listenItem = items.find((i) => i.type === 'listen' && i.id.startsWith('e4.')) ?? items.find((i) => i.type === 'listen')!
const spellItem = items.find((i) => i.type === 'spell' && i.id.startsWith('e4.')) ?? items.find((i) => i.type === 'spell')!
const withSolution = en4.find(
  (i) => /^[ems]4\./.test(i.id) && isGoodMcq(i) && Array.isArray(i.solution) && i.solution.length >= 2 && i.solution.every((s: { say: string }) => teacherOk(s.say) && idOf(s.say) && allIn(idOf(s.say)!, 'indonesian', ID_VER)) && i.explanation && idOf(i.explanation),
)

function readLessons(): { skill: string; subject: string; steps: { say: string }[]; file: string }[] {
  const out: { skill: string; subject: string; steps: { say: string }[]; file: string }[] = []
  for (const subject of ['english', 'math', 'science']) {
    for (const g of ['g1', 'g2', 'g3', 'g4', 'g5', 'g6']) {
      let names: string[]
      try {
        names = readdirSync(join(ROOT, 'content/lessons', subject, g))
      } catch {
        continue
      }
      for (const f of names) {
        const j = JSON.parse(readFileSync(join(ROOT, 'content/lessons', subject, g, f), 'utf8'))
        out.push({ skill: j.skill, subject, steps: j.steps, file: f })
      }
    }
  }
  return out
}
const lessons = readLessons()
const heldEn = (say: string) => { const id = idOf(say); return Boolean(id) && isHeld(id!, held) }
const voiced = (l: { steps: { say: string }[] }) => l.steps.every((s) => !s.say || (idOf(s.say) && !heldEn(s.say) && allIn(idOf(s.say)!, 'indonesian', ID_VER) && teacherOk(s.say)))
const lessonAll = lessons.find((l) => l.skill.startsWith('m4.') && l.steps.length >= 3 && voiced(l)) ?? lessons.find((l) => voiced(l))!
const lessonHeld = lessons.find((l) => l.skill.startsWith('e4.') && l.steps.length >= 3 && l.steps.some((s) => heldEn(s.say)) && !heldEn(l.steps[0]!.say) && idOf(l.steps[0]!.say) && allIn(idOf(l.steps[0]!.say)!, 'indonesian', ID_VER))!

console.log('Soal: tunggal', mcqSingle?.id, 'jamak', mcqMulti?.id, 'dengar', listenItem?.id, 'eja', spellItem?.id, 'langkah', withSolution?.id, 'pelajaran', lessonAll?.skill, 'ditahan', lessonHeld?.skill)

const subjectOf = (id: string) => (id.startsWith('e') ? 'english' : id.startsWith('m') ? 'math' : 'science')
const open = (ref: RawItem) => makeAttempt(kid, [{ id: ref.id, difficulty: ref.difficulty }], subjectOf(ref.id))

const langOfVer = (v: string) => (v === ID_VER ? 'id' : v.startsWith(EN_VER) ? 'en' : '?')
const CPS: Record<string, [number, number]> = { teacher: [6, 26], quizhost: [6, 28], dictation: [3, 22], second: [6, 26], indonesian: [5, 28] }

function judge(p: PlayRec): Clip {
  const m = p.key ? man.get(p.key) : undefined
  const dur = p.duration
  return {
    key: p.key,
    ver: m?.version ?? '?',
    style: m?.style ?? '?',
    text: m?.text ?? '?',
    resolved: p.resolved,
    err: p.err,
    ct: Math.round(p.maxCT * 100) / 100,
    dur: dur === null ? null : Math.round(dur * 100) / 100,
    ended: p.ended,
    cps: m && dur ? Math.round((m.text.length / dur) * 10) / 10 : null,
    byteLen: p.bytes,
  }
}

function clipProblems(c: Clip, want: 'en' | 'id', media: boolean): string[] {
  const out: string[] = []
  if (!c.key) out.push('tanpa kunci')
  if (c.ver === '?') out.push(`kunci ${c.key?.slice(0, 10)} tidak ada di manifest`)
  else if (langOfVer(c.ver) !== want) out.push(`versi ${c.ver}, seharusnya bahasa ${want}: ${c.text.slice(0, 50)}`)
  if (!media) return out
  if (c.resolved !== true) out.push(`play() ${c.resolved === false ? `ditolak ${c.err}` : 'belum selesai'}`)
  if (c.ct <= 0.05) out.push('currentTime tidak maju')
  if (c.dur === null) out.push('durasi tidak terbaca')
  else if (c.text.length >= 8) {
    const [lo, hi] = CPS[c.style] ?? [5, 28]
    if (c.dur > 1.5 + c.text.length / lo || c.dur < c.text.length / hi - 0.3) out.push(`durasi ${c.dur}s untuk ${c.text.length} huruf`)
  }
  return out
}

type Env = { page: Page; ctx: BrowserContext; media: boolean; full: boolean; results: R[]; cfg: string }

async function observe(e: Env, surface: string, want: 'en' | 'id', tap: () => Promise<void>, opts: { minClips?: number; minCT?: number; timeout?: number; waitEnd?: boolean; extra?: (r: R, plays: PlayRec[]) => Promise<void> } = {}): Promise<R> {
  const { page, media } = e
  const res: R = { surface, ok: true, notes: [], clips: [] }
  try {
    const before = (await qa(page)).plays.length
    await tap()
    const minClips = e.full ? (opts.minClips ?? 1) : 1
    const minCT = opts.minCT ?? 0.4
    const deadline = Date.now() + (opts.timeout ?? (e.full ? 45_000 : 15_000))
    let plays: PlayRec[] = []
    let lastN = -1
    let lastChange = Date.now()
    while (Date.now() < deadline) {
      const q = await qa(page)
      plays = q.plays.slice(before)
      if (!media) {
        if (plays.length >= 1) break
      } else if (opts.waitEnd && e.full) {
        const endedNow = plays.length > 0 && plays.at(-1)!.ended
        if (plays.length !== lastN || !endedNow) {
          lastN = plays.length
          lastChange = Date.now()
        }
        if (plays.length >= minClips && endedNow && Date.now() - lastChange > 700) break
      } else if (plays.length >= minClips && (plays.at(-1)!.maxCT >= minCT || plays.at(-1)!.ended)) break
      await sleep(120)
    }
    await sleep(150)
    plays = (await qa(page)).plays.slice(before)
    res.clips = plays.map(judge)
    if (plays.length === 0) {
      res.ok = false
      res.notes.push('tidak ada play()')
    }
    if (plays.length < minClips) {
      res.ok = false
      res.notes.push(`hanya ${plays.length} klip, diharapkan paling sedikit ${minClips}`)
    }
    res.clips.forEach((c, i) => {
      // Klip terakhir boleh baru mulai saat penguji berhenti mengamati. Yang sudah lewat harus sudah maju dan selesai.
      const justStarted = i === res.clips.length - 1 && i > 0 && !c.ended
      const probs = clipProblems(c, want, media).filter((p) => !(justStarted && (p.includes('currentTime') || p.includes('durasi') || p.includes('belum selesai'))))
      if (probs.length > 0) {
        res.ok = false
        res.notes.push(...probs)
      }
    })
    if (!media && plays.length > 0) {
      const q = await qa(page)
      res.notes.push(`jalur: elemen ${q.elements}, new Audio ${q.audios}, urutan ${q.order.slice(-6).map((o) => o.map((x) => String(x).slice(0, 10)).join(':')).join(' ')}`)
      const firstPlay = q.order.findIndex((o) => o[0] === 'play')
      const lastLoadBefore = [...q.order.slice(0, Math.max(0, firstPlay))].reverse().find((o) => o[0] === 'load')
      if (q.audios > 1 || q.elements > 1) { res.ok = false; res.notes.push('lebih dari satu elemen audio') }
      if (!lastLoadBefore) { res.ok = false; res.notes.push('tidak ada load() sebelum play()') }
      const tapLoad = q.loads.some((l) => (l.ev === 'click' || l.ev === 'touchend') && l.trusted)
      if (!tapLoad) { res.ok = false; res.notes.push('load() tidak terjadi di dalam ketukan') }
    }
    if (opts.extra) await opts.extra(res, plays)
  } catch (err) {
    res.ok = false
    res.notes.push(`galat: ${String(err).slice(0, 200)}`)
  }
  const q = await qa(page).catch(() => null)
  if (q && q.speak > 0) {
    res.ok = false
    res.notes.push(`speechSynthesis.speak dipanggil ${q.speak} kali`)
  }
  if (q && q.maxPlaying > 1) {
    res.ok = false
    res.notes.push(`${q.maxPlaying} elemen berbunyi bersamaan`)
  }
  e.results.push(res)
  console.log(`  ${res.ok ? 'OK ' : 'BAD'} ${surface} clips=${res.clips.length} ${res.clips.slice(0, 2).map((c) => `${c.ver.slice(0, 5)}:${c.ct}/${c.dur}s`).join(' ')} ${res.notes.slice(0, 3).join(' | ')}`)
  return res
}

const skip = (e: Env, surface: string, why: string) => {
  e.results.push({ surface, ok: false, notes: [`DILEWATI: ${why}`], clips: [] })
  console.log(`  SKIP ${surface}: ${why}`)
}
const want = (s: string) => !ONLY || ONLY.some((o) => s.startsWith(o))
const readBtn = (scope: Page | Locator) => scope.getByRole('button', { name: 'Read aloud', exact: true }).first()
const shot = (e: Env, n: string) => e.page.screenshot({ path: join(OUT, 'shots', `${e.cfg}-${n}.png`) }).catch(() => undefined)
const stopAudio = async (e: Env) => {
  await e.page.evaluate(() => document.querySelectorAll('audio').forEach((a) => a.pause())).catch(() => undefined)
}
const liveNow = (e: Env) => e.page.evaluate(() => (window as unknown as { __qaNow: () => { live: number; liveCT: number[] } }).__qaNow())

async function gotoSettled(page: Page, path: string): Promise<void> {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('load').catch(() => undefined)
  await sleep(500)
}

async function answerWrongTwice(page: Page, it: RawItem): Promise<void> {
  const wrongIdx = it.options.findIndex((_: unknown, i: number) => i !== it.answer)
  const group = page.locator('section[aria-label="Your answer"]').getByRole('group', { name: 'Answers' })
  const wrongText = (it.options[wrongIdx].text as string).replace(/\s+/g, ' ').trim()
  const tapWrong = async () => {
    const btns = group.locator('button')
    const n = await btns.count()
    for (let i = 0; i < n; i++) {
      const al = (await btns.nth(i).getAttribute('aria-label')) ?? ''
      if (al.replace(/^[A-F], /, '').replace(/\s+/g, ' ').trim() === wrongText) {
        await btns.nth(i).click()
        return
      }
    }
    throw new Error(`opsi salah tidak ketemu: ${wrongText}`)
  }
  await tapWrong()
  await page.getByRole('button', { name: 'Check', exact: true }).click()
  const again = page.getByRole('button', { name: 'Try again', exact: true })
  await again.waitFor({ timeout: 15_000 })
  await sleep(400)
  await again.click()
  await tapWrong()
  await page.getByRole('button', { name: 'Check', exact: true }).click()
}

const offTranslate = async (page: Page) => {
  const t = page.getByTestId('translate-toggle').first()
  if ((await t.count()) && (await t.getAttribute('aria-pressed')) === 'true') await t.click()
}
const onTranslate = async (page: Page) => {
  const t = page.getByTestId('translate-toggle').first()
  await t.waitFor({ timeout: 15_000 })
  if ((await t.getAttribute('aria-pressed')) !== 'true') await t.click()
  await sleep(500)
}

async function openReader(page: Page): Promise<void> {
  const play = page.getByRole('button', { name: /Read along|^Play$/ }).first()
  for (let i = 0; i < 3; i++) {
    await page.locator('a[href^="/reading/"]').first().click()
    await sleep(1500)
    if (await play.isVisible().catch(() => false)) return
  }
  await play.waitFor()
}

async function walk(e: Env): Promise<void> {
  const { page } = e
  page.setDefaultTimeout(20_000)

  if (want('q-read')) {
    await gotoSettled(page, `/run/${open(mcqSingle)}`)
    await observe(e, 'q-read', 'en', async () => { await readBtn(page).click() }, { minClips: 1 + 2 * mcqSingle.options.length, waitEnd: true, timeout: 60_000, extra: async (r) => {
      r.notes.push('rantai: ' + r.clips.map((c) => c.text.slice(0, 18)).join(' > '))
      if (e.full && r.clips.some((c) => !c.ended)) { r.ok = false; r.notes.push('ada klip rantai yang belum selesai') }
      const first = r.clips[0]
      if (first && first.text !== mcqSingle.prompt && !mcqSingle.prompt.includes(first.text)) { r.ok = false; r.notes.push(`klip pertama bukan soal: ${first.text} | ${mcqSingle.prompt}`) }
    } })
    await stopAudio(e)
  }
  if (want('q-multi')) {
    await gotoSettled(page, `/run/${open(mcqMulti)}`)
    await observe(e, 'q-multi', 'en', async () => { await readBtn(page).click() }, { minClips: 2 })
    await stopAudio(e)
  }
  if (want('listen')) {
    await gotoSettled(page, `/run/${open(listenItem)}`)
    await observe(e, 'listen', 'en', async () => { await page.getByRole('button', { name: 'Play the audio', exact: true }).click() }, { extra: async (r) => {
      const body = await page.locator('main').innerText().catch(() => '')
      if (listenItem.listenText && body.includes(listenItem.listenText)) { r.ok = false; r.notes.push('teks dengar tampil di layar') }
    } })
    await stopAudio(e)
  }
  if (want('spell')) {
    await gotoSettled(page, `/run/${open(spellItem)}`)
    await observe(e, 'spell', 'en', async () => { await page.getByRole('button', { name: /Hear|Play/ }).first().click() }, { extra: async (r) => {
      if (r.clips[0] && r.clips[0].style !== 'dictation' && r.clips[0].style !== 'teacher') { r.ok = false; r.notes.push(`gaya ${r.clips[0].style}`) }
    } })
    await stopAudio(e)
  }
  if (want('tes')) {
    // Mode Tes: perangkat hanya menerima kunci klip, teks dengar tidak dikirim.
    const a1 = makeAttempt(kid, [{ id: listenItem.id, difficulty: listenItem.difficulty }], subjectOf(listenItem.id), 'tes', 600)
    await gotoSettled(page, `/run/${a1}`)
    await shot(e, 'tes-listen')
    await observe(e, 'tes-listen', 'en', async () => { await page.getByRole('button', { name: 'Play the audio', exact: true }).click() }, { minCT: 0.1 })
    await stopAudio(e)
    const a2 = makeAttempt(kid, [{ id: spellItem.id, difficulty: spellItem.difficulty }], subjectOf(spellItem.id), 'tes', 600)
    await gotoSettled(page, `/run/${a2}`)
    await observe(e, 'tes-spell', 'en', async () => { await page.getByRole('button', { name: /Hear|Play/ }).first().click() }, { minCT: 0.2 })
    await stopAudio(e)
  }
  if (want('bee')) {
    await gotoSettled(page, '/english/spelling')
    await observe(e, 'bee-word', 'en', async () => { await page.getByRole('button', { name: 'Hear the word', exact: true }).click() }, { minCT: 0.1, extra: async (r) => {
      if (r.clips[0] && r.clips[0].style !== 'dictation') { r.ok = false; r.notes.push(`gaya ${r.clips[0].style}`) }
    } })
    await stopAudio(e)
    await observe(e, 'bee-sentence', 'en', async () => { await page.getByRole('button', { name: 'Hear it in a sentence', exact: true }).click() }, { minCT: 0.2 })
    await stopAudio(e)
  }
  if (want('lrev')) {
    await gotoSettled(page, `/practice/review/${lessonAll.skill}`)
    const b = readBtn(page)
    if (await b.isVisible().catch(() => false)) {
      await observe(e, 'lesson-review-en', 'en', async () => { await b.click() }, { minClips: 2 })
      await stopAudio(e)
      await onTranslate(page)
      await sleep(600)
      await observe(e, 'lesson-review-id', 'id', async () => { await readBtn(page).click() }, {})
      await stopAudio(e)
      await offTranslate(page)
    } else skip(e, 'lesson-review', `tombol tidak tampil di ${page.url()}`)
  }
  if (want('lesson-en')) {
    await gotoSettled(page, `/lesson/${lessonAll.skill}`)
    await offTranslate(page)
    await observe(e, 'lesson-en', 'en', async () => { await page.getByRole('button', { name: 'Play', exact: true }).click() }, { minClips: 2, extra: async (r) => {
      if (r.clips[0] && !lessonAll.steps[0]!.say.includes(r.clips[0].text)) { r.ok = false; r.notes.push(`klip bukan langkah 1: ${r.clips[0].text}`) }
    } })
    await page.getByRole('button', { name: 'Pause', exact: true }).click().catch(() => undefined)
    await sleep(200)
  }
  if (want('lesson-id')) {
    await gotoSettled(page, `/lesson/${lessonAll.skill}`)
    await onTranslate(page)
    await observe(e, 'lesson-id', 'id', async () => { await page.getByRole('button', { name: 'Play', exact: true }).click() }, { minClips: 2, extra: async (r) => {
      const cap = await page.locator('p[aria-live="polite"]').first().getAttribute('lang')
      if (cap !== 'id') { r.ok = false; r.notes.push(`caption lang=${cap}`) }
    } })
    await page.getByRole('button', { name: 'Pause', exact: true }).click().catch(() => undefined)
    await sleep(200)
  }
  if (want('held')) {
    await gotoSettled(page, `/lesson/${lessonHeld.skill}`)
    await onTranslate(page)
    const heldAt = lessonHeld.steps.findIndex((s) => heldEn(s.say))
    const res: R = { surface: 'held-step', ok: true, notes: [], clips: [] }
    const soundBtn = page.locator('header button[aria-pressed]').filter({ has: page.locator('svg') }).filter({ hasText: /Sound|Suara/ }).first()
    await sleep(900)
    const visibleFirst = await soundBtn.isVisible().catch(() => false)
    res.notes.push(`langkah 1 bersuara, tombol suara tampil: ${visibleFirst}`)
    if (!visibleFirst) { res.ok = false; res.notes.push('kontrol positif gagal') }
    for (let i = 0; i < heldAt; i++) {
      await page.getByRole('button', { name: 'Next part', exact: true }).click()
      await sleep(200)
    }
    await sleep(1200)
    const before = (await qa(page)).plays.length
    const soundVisible = await page.locator('header button[aria-pressed]').filter({ has: page.locator('svg') }).filter({ hasText: /Sound|Suara/ }).first().isVisible().catch(() => false)
    res.notes.push(`langkah ${heldAt + 1} ditahan, tombol suara tampil: ${soundVisible}`)
    if (soundVisible) { res.ok = false; res.notes.push('tombol suara tampil pada langkah ditahan') }
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await sleep(2500)
    const after = (await qa(page)).plays.slice(before)
    res.clips = after.map(judge)
    const leak = res.clips.filter((c, i) => i === 0 && c.ver === EN_VER)
    if (leak.length > 0) { res.ok = false; res.notes.push(`suara Inggris pada langkah ditahan: ${leak[0]!.text}`) }
    await page.getByRole('button', { name: 'Pause', exact: true }).click().catch(() => undefined)
    await shot(e, 'held')
    e.results.push(res)
    console.log(`  ${res.ok ? 'OK ' : 'BAD'} held-step ${res.notes.join(' | ')} clips=${res.clips.map((c) => c.ver).join(',')}`)
  }

  if (want('held')) {
    const heldItem = en4.find((i) => /^e[3-5]\./.test(i.id) && isGoodMcq(i) && i.explanation && heldEn(i.explanation))
    const res: R = { surface: 'held-feedback', ok: true, notes: [], clips: [] }
    if (heldItem) {
      await gotoSettled(page, `/run/${open(heldItem)}`)
      await answerWrongTwice(page, heldItem)
      await page.getByTestId('translate-toggle').first().waitFor({ timeout: 15_000 })
      await onTranslate(page)
      await sleep(1500)
      const shown = await readBtn(page.locator('[role="status"]').first()).isVisible().catch(() => false)
      res.notes.push(`${heldItem.id}: tombol suara tampil ${shown}`)
      if (shown) res.ok = false
      await offTranslate(page)
    } else res.notes.push('tidak ada soal contoh')
    e.results.push(res)
    console.log(`  ${res.ok ? 'OK ' : 'BAD'} held-feedback ${res.notes.join(' | ')}`)
  }
  if (want('feedback') || want('solution') || want('review')) {
    const it = withSolution ?? mcqSingle
    const attempt = open(it)
    await gotoSettled(page, `/run/${attempt}`)
    await answerWrongTwice(page, it)
    await page.getByTestId('translate-toggle').first().waitFor({ timeout: 15_000 })
    await sleep(500)
    await shot(e, 'feedback')
    if (want('feedback')) {
      await onTranslate(page)
      await observe(e, 'feedback-id', 'id', async () => { await readBtn(page.locator('[role="status"]').first()).click() }, {})
      await stopAudio(e)
    }
    if (want('solution')) {
      const watch = page.getByRole('button', { name: 'Watch how it works' })
      if (await watch.isVisible().catch(() => false)) await watch.click()
      const player = page.getByRole('region', { name: 'Solution player' }).first()
      if (await player.isVisible().catch(() => false)) {
        await observe(e, 'solution-id', 'id', async () => { await player.getByRole('button', { name: 'Play', exact: true }).click() }, { minClips: 2 })
        await player.getByRole('button', { name: 'Pause', exact: true }).click().catch(() => undefined)
        const inner = player.getByTestId('translate-toggle').first()
        if (await inner.isVisible().catch(() => false)) { if ((await inner.getAttribute('aria-pressed')) === 'true') await inner.click() }
        else { await page.getByTestId('translate-toggle').last().click() }
        await sleep(600)
        await observe(e, 'solution-en', 'en', async () => { await player.getByRole('button', { name: /^(Play|Play again from the start)$/ }).first().click() }, { minClips: 2 })
        await player.getByRole('button', { name: 'Pause', exact: true }).click().catch(() => undefined)
        await shot(e, 'solution')
      } else skip(e, 'solution', 'pemutar langkah tidak tampil')
    }
    if (want('review')) {
      await page.keyboard.press('Escape').catch(() => undefined)
      await page.getByRole('button', { name: /^Close/ }).first().click({ timeout: 1500 }).catch(() => undefined)
      await sleep(400)
      const next = page.getByRole('button', { name: /^(Next|Finish|See your results|Done)/ }).first()
      await next.click({ timeout: 8000 }).catch(() => undefined)
      await sleep(1500)
      const done = page.getByRole('button', { name: /Finish|Submit|Send|See/ }).first()
      if (await done.isVisible().catch(() => false)) await done.click().catch(() => undefined)
      await sleep(2000)
      await gotoSettled(page, `/results/${attempt}/review`)
      await shot(e, 'review')
      const toggle = page.getByTestId('translate-toggle').first()
      if (await toggle.isVisible().catch(() => false)) {
        await onTranslate(page)
        await shot(e, 'review-id')
        await observe(e, 'review-id', 'id', async () => { await page.getByRole('button', { name: 'Read aloud', exact: true }).nth(1).click() }, {})
        await stopAudio(e)
        await offTranslate(page)
      } else skip(e, 'review-id', `tombol terjemah tidak tampil di ${page.url()}`)
    }
  }

  if (want('flashcard')) {
    await gotoSettled(page, '/practice/cards')
    await page.locator('a[href^="/practice/cards/"]').first().click()
    await page.waitForURL(/\/practice\/cards\/.+/)
    await sleep(700)
    const beforeFlip = await readBtn(page).isVisible().catch(() => false)
    await page.getByRole('button', { name: /Card front/ }).click()
    await sleep(900)
    const r = await observe(e, 'flashcard', 'en', async () => { await readBtn(page).click() }, {})
    if (beforeFlip) { r.ok = false; r.notes.push('tombol suara tampil sebelum kartu dibalik') }
    await stopAudio(e)
  }
  if (want('dict')) {
    await gotoSettled(page, '/lesson/e2.pronouns')
    await offTranslate(page)
    const caption = page.locator('p[aria-live="polite"]').first()
    const word = caption.getByRole('button').first()
    await word.waitFor({ timeout: 15_000 })
    await word.click()
    const dialog = page.getByRole('dialog').first()
    await dialog.waitFor()
    await sleep(800)
    await shot(e, 'dict')
    await observe(e, 'dict', 'en', async () => { await dialog.getByRole('button', { name: /Read aloud|Stop reading/ }).first().click() }, { minCT: 0.1, extra: async (r) => {
      if (r.clips[0] && r.clips[0].style !== 'dictation') r.notes.push(`gaya ${r.clips[0].style}`)
    } })
    await stopAudio(e)
  }
  if (want('reader')) {
    await gotoSettled(page, '/reading')
    await openReader(page)
    await sleep(800)
    const sync: { want: string; shown: string; match: boolean }[] = []
    const r = await observe(e, 'reader', 'en', async () => { await page.getByRole('button', { name: /Read along|^Play$/ }).first().click() }, { minClips: 3, timeout: e.full ? 40_000 : 15_000, minCT: 0.3, extra: async (rr, plays) => {
      // Periksa kalimat yang disorot pada tiap klip dengan mengikuti beberapa kalimat.
      void plays
      for (let n = 0; n < (e.full ? 4 : 2); n++) {
        const q = await qa(page)
        const last = q.plays.at(-1)!
        const text = last.key ? man.get(last.key)?.text ?? '' : ''
        const shown = (await page.locator('[data-sentence][aria-current="true"]').first().innerText().catch(() => '')).replace(/\s+/g, ' ').trim()
        const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
        sync.push({ want: text, shown, match: norm(shown).startsWith(norm(text).slice(0, 12)) || norm(shown).includes(norm(text)) })
        const seen = q.plays.length
        const t0 = Date.now()
        while (Date.now() - t0 < 12_000) {
          if ((await qa(page)).plays.length > seen) break
          await sleep(100)
        }
        await sleep(120)
      }
      // Tanpa media (WebKit di Windows) klip gagal seketika dan kalimat langsung maju, jadi sorotan tidak bisa dibandingkan.
      const bad = e.media ? sync.filter((s) => !s.match) : []
      rr.notes.push(`sorotan cocok ${sync.length - bad.length}/${sync.length}`)
      if (bad.length) { rr.ok = false; rr.notes.push(`tidak cocok: ${JSON.stringify(bad[0])}`) }
    } })
    void r
    await page.getByRole('button', { name: 'Pause', exact: true }).first().click().catch(() => undefined)
    await sleep(200)
  }
  if (want('story')) {
    await gotoSettled(page, '/world/story')
    await shot(e, 'story-list')
    const ch = page.locator('ol li button').first()
    if (await ch.isVisible().catch(() => false)) {
      await ch.click()
      await sleep(900)
      await observe(e, 'story', 'en', async () => { await readBtn(page).click() }, {})
      await stopAudio(e)
    } else skip(e, 'story', 'bab belum terbuka')
  }
  if (want('album')) {
    await gotoSettled(page, '/world/cards')
    await shot(e, 'album')
    const card = page.locator('button[aria-label]').filter({ hasNotText: /^$/ }).locator('xpath=self::button').first()
    const owned = page.getByRole('button', { name: /card \d+|, No|common|rare/i }).first()
    void card
    if (await owned.isVisible().catch(() => false)) {
      await owned.click()
      const dialog = page.getByRole('dialog').first()
      await dialog.waitFor()
      await sleep(900)
      await shot(e, 'album-open')
      await observe(e, 'album', 'en', async () => { await readBtn(dialog).click() }, {})
      await stopAudio(e)
      await page.keyboard.press('Escape').catch(() => undefined)
    } else skip(e, 'album', 'tidak ada kartu dimiliki')
  }
  if (want('host')) {
    await gotoSettled(page, '/quiz-arena')
    await page.locator('a[href^="/quiz-arena/"]').first().click()
    await page.waitForURL(/\/quiz-arena\/.+/)
    await sleep(500)
    await observe(e, 'host', 'en', async () => { await page.getByRole('button', { name: /Start quiz/ }).click() }, { minCT: 0.2, timeout: 15_000, extra: async (r) => {
      if (r.clips[0] && r.clips[0].style !== 'quizhost') { r.ok = false; r.notes.push(`gaya ${r.clips[0].style}`) }
    } })
    await stopAudio(e)
  }

  // ---------------------------------------- perilaku
  if (want('nav')) {
    const res: R = { surface: 'nav-stops', ok: true, notes: [], clips: [] }
    await gotoSettled(page, `/lesson/${lessonAll.skill}`)
    await offTranslate(page)
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    const t0 = Date.now()
    while (Date.now() - t0 < 10_000 && (await liveNow(e)).live === 0) await sleep(100)
    const was = (await liveNow(e)).live
    await page.locator('header a[href]').first().click()
    await sleep(1200)
    const now = await liveNow(e).catch(() => ({ live: -1, liveCT: [] as number[] }))
    res.notes.push(`pelajaran: berbunyi ${was}, sesudah pindah ${now.live}`)
    if (was !== 1 || now.live !== 0) res.ok = false
    // Baca soal lalu kembali lewat tombol browser.
    await gotoSettled(page, `/run/${open(mcqMulti)}`)
    await readBtn(page).click()
    const t1 = Date.now()
    while (Date.now() - t1 < 10_000 && (await liveNow(e)).live === 0) await sleep(100)
    const was2 = (await liveNow(e)).live
    await page.getByRole('button', { name: /^Exit/ }).first().click()
    await sleep(500)
    const leave = page.getByRole('dialog').getByRole('button', { name: /^(Leave|Exit|Save and leave|Yes|Stop)/ }).first()
    const afterDialog = await liveNow(e).catch(() => ({ live: -1, liveCT: [] as number[] }))
    res.notes.push(`soal: berbunyi ${was2}, dialog keluar ${afterDialog.live}`)
    if (await leave.isVisible().catch(() => false)) await leave.click()
    await page.waitForURL((u) => !u.pathname.startsWith('/run/'), { timeout: 15_000 }).catch(() => undefined)
    await sleep(800)
    const after = await liveNow(e).catch(() => ({ live: -1, liveCT: [] as number[] }))
    res.notes.push(`sesudah keluar ${after.live}, url ${new URL(page.url()).pathname}`)
    if (was2 !== 1 || after.live !== 0 || new URL(page.url()).pathname.startsWith('/run/')) res.ok = false
    // Reader: menu utama saat membaca.
    await gotoSettled(page, '/reading')
    await openReader(page)
    await sleep(1200)
    await page.getByRole('button', { name: /Read along|^Play$/ }).first().click()
    const t2 = Date.now()
    while (Date.now() - t2 < 10_000 && (await liveNow(e)).live === 0) await sleep(100)
    const was3 = (await liveNow(e)).live
    const urlBefore = new URL(page.url()).pathname
    await page.locator('a[href="/reading"]:visible, a[href="/today"]:visible, a[href^="/reading/"]:visible').first().click()
    await page.waitForURL((u) => u.pathname !== urlBefore, { timeout: 15_000 }).catch(() => undefined)
    await sleep(1200)
    res.notes.push(`baca: dari ${urlBefore} ke ${new URL(page.url()).pathname}`)
    const after3 = await liveNow(e).catch(() => ({ live: -1, liveCT: [] as number[] }))
    res.notes.push(`baca: berbunyi ${was3}, sesudah pindah ${after3.live}`)
    if (was3 !== 1 || after3.live !== 0) res.ok = false
    e.results.push(res)
    console.log(`  ${res.ok ? 'OK ' : 'BAD'} nav-stops ${res.notes.join(' | ')}`)
  }
  if (want('rapid')) {
    const res: R = { surface: 'rapid-taps', ok: true, notes: [], clips: [] }
    await gotoSettled(page, `/run/${open(mcqSingle)}`)
    const btn = readBtn(page)
    await btn.waitFor()
    const before = await qa(page)
    const box = await btn.boundingBox()
    const n = 7
    for (let i = 0; i < n; i++) {
      await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
      await sleep(70)
    }
    await sleep(1200)
    const q = await qa(page)
    res.notes.push(`maks berbunyi ${q.maxPlaying}, play ${q.plays.length - before.plays.length}, galat ${q.plays.slice(before.plays.length).filter((p) => p.err && p.err !== 'AbortError').map((p) => p.err).join(',') || 'tidak ada'}`)
    if (q.maxPlaying > 1) res.ok = false
    const note = await page.getByText('The audio did not load').isVisible().catch(() => false)
    if (note) { res.ok = false; res.notes.push('catatan gagal muat tampil setelah ketukan cepat') }
    await stopAudio(e)
    // Berganti langkah cepat saat Play.
    await gotoSettled(page, `/lesson/${lessonAll.skill}`)
    await offTranslate(page)
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await sleep(500)
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: 'Next part', exact: true }).click().catch(() => undefined)
      await sleep(90)
      await page.getByRole('button', { name: /^(Play|Pause)$/ }).first().click().catch(() => undefined)
      await sleep(90)
    }
    await sleep(800)
    const q2 = await qa(page)
    res.notes.push(`pelajaran: maks ${q2.maxPlaying}`)
    if (q2.maxPlaying > 1) res.ok = false
    await stopAudio(e)
    e.results.push(res)
    console.log(`  ${res.ok ? 'OK ' : 'BAD'} rapid-taps ${res.notes.join(' | ')}`)
  }
  if (want('sfx')) {
    const res: R = { surface: 'sfx-no-cut', ok: true, notes: [], clips: [] }
    await gotoSettled(page, `/run/${open(mcqMulti)}`)
    await readBtn(page).click()
    const t0 = Date.now()
    while (Date.now() - t0 < 10_000 && (await liveNow(e)).live === 0) await sleep(100)
    await sleep(300)
    const before = await qa(page)
    const group = page.locator('section[aria-label="Your answer"]').getByRole('group', { name: 'Answers' })
    await group.locator('button').first().click()
    await sleep(800)
    const q = await qa(page)
    const live = await liveNow(e)
    const sfxDuring = q.sfx.slice(before.sfx.length)
    const cut = q.pauses.length - before.pauses.length
    res.notes.push(`efek ${sfxDuring.length} (saat bicara ${sfxDuring.filter((s) => s.speaking).length}), pause ${cut}, masih berbunyi ${live.live}`)
    if (e.media && (cut > 0 || live.live === 0)) res.ok = false
    if (sfxDuring.length === 0) res.notes.push('tidak ada efek terukur saat ketukan')
    await stopAudio(e)
    e.results.push(res)
    console.log(`  ${res.ok ? 'OK ' : 'BAD'} sfx-no-cut ${res.notes.join(' | ')}`)
  }
  if (want('mute')) {
    const res: R = { surface: 'sound-off', ok: true, notes: [], clips: [] }
    await gotoSettled(page, '/me')
    const toggle = page.getByRole('button', { name: /sound effects|Sound/i }).filter({ has: page.locator('svg') }).first()
    await toggle.scrollIntoViewIfNeeded().catch(() => undefined)
    const pressed = await toggle.getAttribute('aria-pressed').catch(() => null)
    if (pressed === 'true') await toggle.click()
    await sleep(300)
    await shot(e, 'mute')
    const isMuted = await page.evaluate(() => Object.keys(localStorage).filter((k) => /sfx|sound|mute/i.test(k)).map((k) => `${k}=${localStorage.getItem(k)}`).join(';'))
    res.notes.push(`penyimpanan: ${isMuted}`)
    // Efek: tidak ada bunyi saat mengetuk jawaban.
    await gotoSettled(page, `/run/${open(mcqMulti)}`)
    const q0 = await qa(page)
    const group = page.locator('section[aria-label="Your answer"]').getByRole('group', { name: 'Answers' })
    await group.locator('button').first().click()
    await sleep(500)
    const q1 = await qa(page)
    const sfx = q1.sfx.length - q0.sfx.length
    res.notes.push(`efek saat senyap ${sfx}`)
    if (sfx > 0) res.ok = false
    // Bacaan yang diketuk sendiri tetap berbunyi (ketukan eksplisit), pembawa acara mengikuti senyap.
    await gotoSettled(page, '/quiz-arena')
    await page.locator('a[href^="/quiz-arena/"]').first().click()
    await page.waitForURL(/\/quiz-arena\/.+/)
    await page.getByRole('button', { name: /Start quiz/ }).click()
    await sleep(3500)
    const q2 = await qa(page)
    const host = q2.plays.filter((p) => p.key && man.get(p.key)?.style === 'quizhost').length
    res.notes.push(`pembawa acara saat senyap ${host}`)
    if (host > 0) res.ok = false
    // Saklar suara pelajaran mati: Play tidak memutar klip.
    await gotoSettled(page, `/lesson/${lessonAll.skill}`)
    await offTranslate(page)
    const before = (await qa(page)).plays.length
    await page.locator('header button[aria-pressed]').filter({ hasText: /Sound|Suara/ }).first().click()
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await sleep(2500)
    const q3 = await qa(page)
    res.notes.push(`pelajaran suara mati: play ${q3.plays.length - before}`)
    if (q3.plays.length - before > 0) res.ok = false
    await page.getByRole('button', { name: 'Pause', exact: true }).click().catch(() => undefined)
    // Kembalikan.
    await gotoSettled(page, '/me')
    const t2 = page.getByRole('button', { name: /sound effects|Sound/i }).filter({ has: page.locator('svg') }).first()
    if ((await t2.getAttribute('aria-pressed').catch(() => null)) === 'false') await t2.click()
    e.results.push(res)
    console.log(`  ${res.ok ? 'OK ' : 'BAD'} sound-off ${res.notes.join(' | ')}`)
  }
}

async function main() {
  mkdirSync(join(OUT, 'shots'), { recursive: true })
  // Kartu untuk album: satu kartu dimiliki.
  const cardId = process.env.QA_CARD
  if (cardId) psql(`insert into world_card (learner_id, org_id, card_id, source) values ('${kid.id}','${kid.org}','${cardId}','boss') on conflict do nothing;`)
  const summary: unknown[] = []
  const allNet: Net[] = []
  for (const browserName of UA_FILTER) {
    const isWebkit = browserName === 'webkit'
    const b = isWebkit ? await webkit.launch() : await chromium.launch({ args: ['--autoplay-policy=user-gesture-required'] })
    for (const s of SIZES) {
      if (SIZE_FILTER && !SIZE_FILTER.includes(s.name)) continue
      const cfg = `${browserName}-${s.name}`
      console.log(`== ${cfg}`)
      const ctx = await b.newContext({
        viewport: { width: s.width, height: s.height },
        hasTouch: isWebkit ? s.touch : s.touch,
        isMobile: isWebkit ? false : s.touch,
        userAgent: browserName === 'webview' ? WEBVIEW_UA : undefined,
        locale: 'en-GB',
        timezoneId: 'Asia/Jakarta',
        storageState: join(OUT, process.env.QA_STATE ?? kid.state),
        ignoreHTTPSErrors: true,
        ...(process.env.QA_STAGING && !process.env.QA_NOROUTE ? { serviceWorkers: 'block' as const } : {}),
      })
      if (process.env.QA_STAGING && !process.env.QA_NOROUTE) await useStaging(ctx, process.env.QA_STAGING, process.env.QA_VERSION!)
      await ctx.addInitScript(INIT)
      const net: Net[] = []
      trackNet(ctx, net)
      const page = await ctx.newPage()
      const errs: string[] = []
      page.on('pageerror', (er) => errs.push(er.message.slice(0, 200)))
      const results: R[] = []
      const e: Env = { page, ctx, media: !isWebkit, full: browserName === 'chromium' && s.name === '390x844', results, cfg }
      await pinIn(page, kid.name)
      await walk(e).catch((er) => {
        results.push({ surface: 'walk', ok: false, notes: [`galat: ${String(er).slice(0, 300)}`], clips: [] })
        console.log('  WALK ERROR', String(er).slice(0, 300))
      })
      await ctx.close()
      const not200 = net.filter((n) => n.status !== 200 && n.status !== 206)
      summary.push({ cfg, results, pageErrors: errs, requests: net.length, statuses404: not200.length, not200: not200.slice(0, 40).map((n) => ({ key: n.key, status: n.status, page: n.page })) })
      allNet.push(...net)
      writeFileSync(join(OUT, `walk-${browserName}${process.env.QA_TAG ?? ''}.json`), JSON.stringify(summary, null, 1))
      writeFileSync(join(OUT, `net-${browserName}${process.env.QA_TAG ?? ''}.json`), JSON.stringify(allNet))
    }
    await b.close()
  }
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
