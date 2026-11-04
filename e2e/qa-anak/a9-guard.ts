// Saklar fitur, batas layar, sesi kosong, luring dan sambung lagi, deployment baru. Keluarga baru lewat pendaftaran sungguhan.
import { answer as answerEn } from '../qa-soal/driver'
import { answer as answerId } from './driver-id'
import { chromium, layoutSweep, newCtx, OUT, pinIn, qa, resolveItem, say, signUp, sql, TABLET, type Family, type Page } from './lib'
import { attemptItems, STR } from './session'

const today = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)
const body = async (p: Page) => (await p.locator('body').innerText()).replace(/\s+/g, ' ')

const OFF: [string, string[], RegExp?][] = [
  ['drill-math', ['/practice/start?subject=math&strand=Nf&n=5&timed=0&style=mixed'], /Math drill|Drill Matematika|Latihan Matematika/],
  ['mental-math', ['/quick-maths', '/quick-maths/play'], /Mental Math|Hitung Cepat/],
  ['quiz-arena', ['/quiz-arena', '/quiz-arena/flags'], /Quiz Arena|Arena Kuis/],
  ['flashcards', ['/practice/cards', '/practice/cards/e4-antonyms?mode=cards'], /Flashcards|Kartu kilas/],
  ['vocab', ['/practice/cards?mode=vocab'], /Vocab drill/],
  ['reading-room', ['/reading', '/reading/g4-x/c1'], /Reading Room|Ruang baca/],
  ['english-skills', ['/english', '/english/spelling', '/english/listening/start'], /English Skills/],
  ['kira-world', ['/world', '/world/shop', '/world/friend', '/world/cards', '/world/boss', '/world/story', '/world/trophies', '/world/certificate/7'], /Kira World|Dunia Kira/],
  ['manipulatives', ['/tools'], /Maths Tools|Alat peraga/],
  ['dictionary', ['/my-words'], undefined],
  ['olympiad-math', ['/competitions', '/esmo', '/practice/start?subject=math&strand=Oly&n=5&timed=0&style=mixed'], undefined],
  ['placement', ['/placement'], undefined],
]

async function features(page: Page, f: Family) {
  for (const [key, links, navRe] of OFF) {
    await sql`insert into learner_feature (org_id, learner_id, key, enabled) values (${f.orgId!}, ${f.learnerId!}, ${key}, false) on conflict (learner_id, key) do update set enabled = false`
    await page.goto('/practice')
    await page.waitForTimeout(400)
    const hub = await body(page)
    if (navRe && navRe.test(hub)) say(false, `${f.lang} saklar ${key} mati: masih tampil di menu atau hub: ${(navRe.exec(hub) ?? [''])[0]}`)
    for (const l of links) {
      const r = await page.goto(l, { waitUntil: 'domcontentloaded' }).catch(() => null)
      await page.waitForTimeout(500)
      const final = new URL(page.url())
      const t = await body(page)
      const is404 = (r?.status() ?? 200) === 404 || /This page could not be found|404/.test(t)
      const stillOpen = final.pathname === l.split('?')[0] && !/(turned off|switched off|dimatikan|belum dibuka|not open|grown-up|orang dewasa|orang tua)/i.test(t)
      const created = final.pathname.startsWith('/run/')
      say(!is404 && !stillOpen && !created, `${f.lang} saklar ${key} ${l} -> ${final.pathname}${final.search} [${r?.status()}] :: ${t.replace(/^Kira .*?(Me|Aku) /, '').slice(0, 90)}`)
      if (key === 'drill-math' || key === 'kira-world') await page.screenshot({ path: `${OUT}/guard-${f.lang}-${key}.png`, fullPage: true })
    }
    await sql`update learner_feature set enabled = true where learner_id = ${f.learnerId!} and key = ${key}`
  }
}

async function startRequired(page: Page, f: Family) {
  const re = f.lang === 'id' ? /^(Mulai|Lanjut)/ : /^(Start|Continue|Keep going)/
  await page.goto('/today')
  const s = page.getByRole('link', { name: re }).first()
  await s.waitFor({ timeout: 15000 })
  await s.click()
  await page.waitForURL((u) => u.pathname !== '/today', { timeout: 30000 })
  await page.waitForTimeout(300)
  if (new URL(page.url()).pathname.startsWith('/quest/')) {
    await page.getByRole('link', { name: re }).or(page.getByRole('button', { name: re })).first().click({ timeout: 15000 })
    await page.waitForURL((u) => u.pathname.startsWith('/run/'), { timeout: 40000 })
  }
  await page.locator(`section[aria-label="${STR[f.lang].a}"]`).first().waitFor({ timeout: 20000 })
  return new URL(page.url()).pathname.split('/').pop()!
}

async function answerRow(page: Page, f: Family, ref: string, correct = true) {
  const S = STR[f.lang]
  const answer = f.lang === 'id' ? answerId : answerEn
  await answer(page, resolveItem(ref)!, correct, { issues: [] })
  await page.getByRole('button', { name: S.check, exact: true }).click({ timeout: 8000 })
  await page.locator('[role=status] h2').first().waitFor({ timeout: 15000 })
  return (await page.locator('[role=status] h2').first().innerText()).trim()
}
const next = async (page: Page, f: Family) => {
  const S = STR[f.lang]
  await page.waitForTimeout(700)
  await page.locator('[role=status]').getByRole('button', { name: new RegExp(`^(${S.next}|${S.finish})$`) }).first().click({ timeout: 8000 })
  await page.waitForTimeout(300)
}

async function offline(page: Page, f: Family, id: string) {
  const list = await attemptItems(id)
  const r0 = await answerRow(page, f, list[0]!.ref)
  await next(page, f)
  const ctx = page.context()
  await ctx.setOffline(true)
  await page.waitForTimeout(600)
  const r1 = await answerRow(page, f, list[1]!.ref)
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/guard-${f.lang}-offline.png` })
  const line = await body(page)
  const friendly = /(Saved on this|Sudah tersimpan|Tersimpan|offline|internet)/i.test(line)
  say(friendly, `${f.lang} luring: pesan ramah saat tidak tersambung; penilaian lokal soal 2 "${r1}" (soal 1 "${r0}")`)
  await next(page, f)
  const r2 = await answerRow(page, f, list[2]!.ref, false)
  say(r2 === STR[f.lang].notYet, `${f.lang} luring: jawaban salah tetap ditandai ${r2}`)
  const before = await sql`select count(*)::int n from response where attempt_id = ${id}`
  await ctx.setOffline(false)
  await page.waitForTimeout(6000)
  const after = await sql`select position, status, attempt_no from response where attempt_id = ${id} order by position, attempt_no`
  const pos = new Set(after.map((a) => a.position as number))
  say(pos.has(2) && pos.has(3), `${f.lang} sambung lagi: jawaban tersinkron, sebelum ${before[0]!.n}, sesudah ${after.length} ${JSON.stringify(after.map((a) => `${a.position}:${a.status}`))}`)
}

async function deployment(page: Page, f: Family) {
  // Deployment baru: chunk lama 404 saat anak pindah layar di tab yang masih terbuka.
  await page.goto('/today')
  await page.waitForTimeout(1500)
  let blocked = 0
  await page.route('**/_next/static/**', (r) => {
    blocked++
    return r.fulfill({ status: 404, body: 'not found' })
  })
  await page.route('**/*', (r) => {
    const h = r.request().headers()
    if (h.rsc || h['next-router-state-tree']) return r.fulfill({ status: 404, contentType: 'text/plain', body: 'gone' })
    return r.fallback()
  })
  const u0 = page.url()
  await page.getByRole('link', { name: f.lang === 'id' ? /^Latihan/ : /^Practice/ }).first().click({ timeout: 6000 }).catch(() => {})
  await page.waitForTimeout(1200)
  await page.unroute('**/_next/static/**')
  await page.unroute('**/*')
  await page.waitForTimeout(3500)
  await page.screenshot({ path: `${OUT}/guard-${f.lang}-deploy.png` })
  const t = await body(page)
  const blank = t.length < 20
  const raw = /Application error|Unhandled|client-side exception/i.test(t)
  say(!blank && !raw, `${f.lang} deployment baru: chunk diblokir ${blocked}, dari ${new URL(u0).pathname} ke ${new URL(page.url()).pathname}, ${t.slice(0, 110)}`)
  // Sesudah pulih, tombol normal.
  const go = await page.goto('/today').catch(() => null)
  say((go?.status() ?? 0) === 200, `${f.lang} deployment: pulih ke Today`)

  // Aksi server lama ditolak: jawaban tidak hilang.
  const id = await startRequired(page, f)
  const list = await attemptItems(id)
  const done = await sql`select count(*)::int n from response where attempt_id = ${id}`
  await page.route('**/*', (r) => {
    if (r.request().method() === 'POST' && r.request().headers()['next-action']) return r.fulfill({ status: 404, contentType: 'text/plain', body: 'Failed to find Server Action' })
    return r.fallback()
  })
  const start = done[0]!.n as number
  const idx = start
  const shown = await answerRow(page, f, list[idx]!.ref).catch((e) => `gagal ${String(e).split('\n')[0]!.slice(0, 90)}`)
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/guard-${f.lang}-action-404.png` })
  const tt = await body(page)
  say(!/Application error/.test(tt), `${f.lang} aksi server lama ditolak: soal tampil "${shown}", ${tt.slice(tt.indexOf(STR[f.lang].q), tt.indexOf(STR[f.lang].q) + 60)}`)
  await page.unroute('**/*')
  await page.waitForTimeout(500)
  await page.reload()
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `${OUT}/guard-${f.lang}-action-after.png` })
  const rows = await sql`select position from response where attempt_id = ${id}`
  say(rows.some((r) => (r.position as number) === idx + 1), `${f.lang} jawaban tidak hilang setelah aksi ditolak lalu muat ulang (baris ${rows.length}, soal ${idx + 1})`)
}

async function blankSession(page: Page, f: Family) {
  const id = await startRequired(page, f)
  await sql`update attempt set mode = 'tes', time_limit_s = 600 where id = ${id}`
  await page.goto(`/run/${id}`)
  await page.waitForTimeout(1200)
  const [q0] = await sql`select status from quest where attempt_id = ${id}`
  const L = f.lang === 'id' ? 'Kumpulkan' : 'Hand in'
  await page.getByRole('button', { name: L, exact: true }).first().click({ timeout: 8000 })
  await page.waitForTimeout(400)
  await page.getByRole('dialog').getByRole('button', { name: L, exact: true }).click({ timeout: 8000 })
  await page.waitForTimeout(3000)
  await page.screenshot({ path: `${OUT}/guard-${f.lang}-blank.png`, fullPage: true })
  const t = await body(page)
  const [q1] = await sql`select status from quest where attempt_id = ${id}`
  const [d] = await sql`select count(*)::int n from day_record where learner_id = ${f.learnerId!} and date = ${today()}`
  void d
  const m = /(Answer at least[^.]*\.|Jawab setidaknya[^.]*\.|Jawab paling sedikit[^.]*\.|[^.]*belum dihitung[^.]*\.|[^.]*tidak dihitung[^.]*\.)/.exec(t)
  say(q1?.status !== 'done', `${f.lang} sesi kosong: status misi ${q0?.status} -> ${q1?.status}, tidak terhitung; url ${new URL(page.url()).pathname}; kata-kata: ${m?.[0] ?? t.slice(0, 160)}`)
  const streak = await sql`select coalesce(current_streak,0) c from learner_streak where learner_id = ${f.learnerId!}`.catch(() => [])
  say('INFO', `${f.lang} sesi kosong streak: ${JSON.stringify(streak[0] ?? null)}`)
}

async function limit(page: Page, f: Family) {
  // Sesi berjalan, batas tercapai: selesaikan sesi, kemajuan tersimpan, sesi baru ditolak ramah.
  const id = await startRequired(page, f)
  const list = await attemptItems(id)
  const r0 = await sql`select count(distinct position)::int n from response where attempt_id = ${id}`
  await sql`update learner_profile set screen_limit_min = 15 where user_id = ${f.learnerId!}`
  await sql`insert into day_record (org_id, learner_id, date, minutes, last_ping_at) values (${f.orgId!}, ${f.learnerId!}, ${today()}, 20, now()) on conflict (learner_id, date) do update set minutes = 20`
  const idx = r0[0]!.n as number
  const shown = await answerRow(page, f, list[idx]!.ref).catch((e) => `gagal ${String(e).split('\n')[0]!.slice(0, 90)}`)
  say(/Correct|Benar/.test(shown), `${f.lang} batas layar di tengah sesi: soal tetap dinilai (${shown})`)
  await page.waitForTimeout(1200)
  const saved = await sql`select count(distinct position)::int n from response where attempt_id = ${id}`
  say((saved[0]!.n as number) > idx, `${f.lang} batas layar: kemajuan tersimpan (${saved[0]!.n} soal)`)
  await page.goto('/today')
  await page.waitForTimeout(1000)
  await page.screenshot({ path: `${OUT}/guard-${f.lang}-limit-today.png`, fullPage: true })
  const t = await body(page)
  const friendly = /(enough screen time|Waktu di layar sudah cukup|break|istirahat)/i.test(t)
  say(friendly, `${f.lang} batas layar Today ramah: ${(/[^.]*(enough screen time|Waktu di layar)[^.]*\./.exec(t) ?? [t.slice(0, 120)])[0]}`)
  const links = await page.evaluate(() => Array.from(document.querySelectorAll('main a[href^="/quest/"], main a[href^="/run/"]')).map((a) => a.getAttribute('href')))
  say('INFO', `${f.lang} batas layar: tautan sesi tersisa ${links.length}`)
  // Sesi baru lewat tautan langsung.
  const [q] = await sql`select id from quest where learner_id = ${f.learnerId!} and date = ${today()} and status <> 'done' and attempt_id is null limit 1`
  for (const url of [q ? `/quest/${q.id}` : '/today', '/practice/start?subject=math&strand=Nf&n=5&timed=0&style=mixed', '/quick-maths', '/quiz-arena/play?topic=flags']) {
    const r = await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => null)
    await page.waitForTimeout(600)
    const p = new URL(page.url()).pathname
    say(!p.startsWith('/run/'), `${f.lang} batas layar: ${url} -> ${p} [${r?.status()}] ${(await body(page)).replace(/^Kira .*?(Me|Aku) /, '').slice(0, 90)}`)
  }
  await page.screenshot({ path: `${OUT}/guard-${f.lang}-limit-start.png`, fullPage: true })
  await sql`update learner_profile set screen_limit_min = 240 where user_id = ${f.learnerId!}`
  await sql`update day_record set minutes = 1 where learner_id = ${f.learnerId!} and date = ${today()}`
}

async function main() {
  const lang = (process.argv[2] ?? 'en') as 'en' | 'id'
  const grade = Number(process.argv[3] ?? 4)
  const b = await chromium.launch()
  const ctx = await newCtx(b, { viewport: TABLET, tag: `guard-${lang}` })
  const page = await ctx.newPage()
  const f = await signUp(page, { grade, name: `Jaga${lang}`, lang })
  await pinIn(page, f)
  await page.waitForTimeout(800)
  const tips = page.getByTestId('first-run-tips')
  if (await tips.isVisible().catch(() => false)) await tips.getByRole('button').first().click()
  const stepName = process.argv[4]
  const run = async (name: string, fn: () => Promise<void>) => {
    if (stepName && stepName !== name) return
    await fn().catch((e) => say(false, `${lang} langkah ${name} gagal: ${String(e).split('\n')[0]!.slice(0, 220)}`))
  }
  await run('swgate', async () => {
    await page.goto('/quiz-arena')
    await page.waitForTimeout(1500)
    await page.goto('/quiz-arena/flags')
    await page.waitForTimeout(1000)
    await sql`insert into learner_feature (org_id, learner_id, key, enabled) values (${f.orgId!}, ${f.learnerId!}, 'quiz-arena', false) on conflict (learner_id, key) do update set enabled = false`
    for (let i = 0; i < 3; i++) {
      const r = await page.goto('/quiz-arena/flags')
      await page.waitForTimeout(500)
      say('INFO', `${lang} saklar mati kunjungan ${i}: dari SW ${r?.fromServiceWorker()}, status ${r?.status()}, akhir ${new URL(page.url()).pathname}`)
    }
    const sw = await page.evaluate(async () => (await navigator.serviceWorker?.getRegistration())?.active?.scriptURL ?? null)
    say('INFO', `${lang} service worker ${sw}`)
    await sql`update learner_feature set enabled = true where learner_id = ${f.learnerId!} and key = 'quiz-arena'`
  })
  await run('features', () => features(page, f))
  await run('offline', async () => {
    const id = await startRequired(page, f)
    await offline(page, f, id)
  })
  await run('deploy', () => deployment(page, f))
  await run('blank', () => blankSession(page, f))
  await run('limit', () => limit(page, f))
  const sw = (await layoutSweep(page)).filter((x) => !/^small/.test(x))
  say('INFO', `${lang} akhir ${JSON.stringify(sw.slice(0, 3))}`)
  const q = await qa(page)
  say(q.speak.length === 0, `${lang} jaga suara perangkat ${q.speak.length}`)
  await b.close()
  await sql.end()
}
main().catch((e) => {
  console.error(String(e).slice(0, 1000))
  process.exit(1)
})
