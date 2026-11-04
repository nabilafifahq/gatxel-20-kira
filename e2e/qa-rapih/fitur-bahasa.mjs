// Layar Kira World, Me, Results, Today dalam Indonesia dan Inggris, ponsel dan tablet: teks yang lupa diterjemahkan, overflow, sebutan tutor.
import { browser, done, ids, log, loginAisha, newCtx, overflow, PHONE, setLang, shot, sql, TABLET } from './fitur-lib.mjs'

const { org, aisha } = await ids()
const b = await browser()
const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)
const settle = (page) => page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {})
const EN_WORDS = /\b(the|your|you|stars?|friend|shop|and|more|earn|earned|cards?|boss|bosses|weekly|story|trophy|trophies|badges?|today|with|this|that|hatch|egg|back|next|start|week|reward|day|days)\b/gi
const ID_WORDS = /\b(kamu|bintang|teman|toko|dan|lagi|hari ini|kartu|cerita|piala|lencana|untuk|dengan|yang|minggu|mulai|selesai)\b/gi
const allow = /\b(Kira World|Kira|Star Shop)\b/g

try {
  await setLang(aisha, 'en')
  await sql`delete from learner_feature where learner_id = ${aisha}`
  await sql`delete from star_ledger where learner_id = ${aisha}`
  await sql`delete from world_state where learner_id = ${aisha}`
  await sql`delete from world_item where learner_id = ${aisha}`
  await sql`delete from world_card where learner_id = ${aisha}`
  await sql`insert into star_ledger (org_id, learner_id, amount, reason, source, date) values (${org}, ${aisha}, 60, 'session', 'qa-fitur:bahasa', ${today})`
  for (const c of ['an-lion', 'an-elephant', 'rb-robot']) await sql`insert into world_card (org_id, learner_id, card_id, source) values (${org}, ${aisha}, ${c}, 'qa-fitur') on conflict do nothing`

  const [res] = await sql`select id from attempt where learner_id = ${aisha} and status = 'submitted' order by submitted_at desc nulls last limit 1`
  const screens = ['/today', '/me', '/world', '/world/friend', '/world/shop', '/world/cards', '/world/story', '/world/trophies', '/world/boss', ...(res ? [`/results/${res.id}`] : [])]
  log(null, 'hasil dipakai', res?.id ?? '(tidak ada hasil, layar Results dilewati)')

  for (const [vp, tag] of [[PHONE, '375'], [TABLET, '800']]) {
    const ctx = await newCtx(b, vp)
    const page = await loginAisha(ctx)
    const errs = []
    page.on('pageerror', (e) => errs.push(e.message))
    page.on('response', (r) => {
      if (r.status() >= 500) errs.push(`HTTP ${r.status()} ${r.url()}`)
    })
    // Sekali menetas lewat layar asli supaya layar teman punya isi.
    if (tag === '375') {
      await page.goto('/world/friend')
      await settle(page)
      await page.getByRole('button', { name: 'Hatch the egg' }).click().catch(() => {})
      await page.getByRole('button', { name: /Moonbun/ }).click()
      await page.getByLabel('What will you call your friend?').fill('Mimi')
      await page.getByRole('button', { name: 'Meet your friend' }).click()
      await page.getByRole('heading', { name: /Mimi the Moonbun/ }).waitFor({ timeout: 8000 })
    }
    for (const lang of ['en', 'id']) {
      await setLang(aisha, lang)
      for (const s of screens) {
        await page.goto(s, { waitUntil: 'domcontentloaded' })
        await settle(page)
        await page.waitForTimeout(150)
        const name = `lang-${lang}-${s.replace(/[^a-z]+/g, '_').slice(0, 20)}-${tag}`
        await shot(page, name)
        const htmlLang = await page.locator('html').getAttribute('lang')
        const ov = await overflow(page)
        if (ov.scrollW > ov.clientW || ov.bad.length) log(false, `${lang} ${s} ${tag}: overflow`, JSON.stringify(ov))
        const text = (await page.locator('main').first().innerText().catch(() => page.locator('body').innerText())).replace(/\s+/g, ' ')
        if (/tutor/i.test(text)) log(false, `${lang} ${s} ${tag}: menyebut tutor`, (text.match(/.{0,50}tutor.{0,50}/i) ?? [''])[0])
        if (/illustrative|mock|dummy|unlock/i.test(text)) log(false, `${lang} ${s} ${tag}: kata terlarang`, (text.match(/.{0,50}(illustrative|mock|dummy|unlock).{0,50}/i) ?? [''])[0])
        if (/[\u2013\u2014]/.test(text)) log(false, `${lang} ${s} ${tag}: tanda pisah`, (text.match(/.{0,40}[\u2013\u2014].{0,40}/) ?? [''])[0])
        const small = await page.evaluate(() => [...document.querySelectorAll('main a, main button')].filter((el) => {
          const r = el.getBoundingClientRect()
          return r.width > 0 && r.height > 0 && (r.height < 44 || r.width < 44) && !el.closest('p') && !el.closest('footer')
        }).map((el) => `${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24)}:${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`).slice(0, 4))
        if (small.length && tag === '375') log(false, `${lang} ${s}: target ketuk < 44`, small.join(', '))
        if (tag === '375') {
          const clean = text.replace(allow, '')
          const hits = [...clean.matchAll(lang === 'id' ? EN_WORDS : ID_WORDS)].map((m) => clean.slice(Math.max(0, m.index - 22), m.index + m[0].length + 22))
          log(null, `${lang} ${s} html=${htmlLang}: kata bahasa lain ${hits.length}`, [...new Set(hits)].slice(0, 6).join(' | '))
        }
      }
    }
    await setLang(aisha, 'en')
    log(errs.length === 0, `${tag}: tanpa error halaman`, errs.join(' | ').slice(0, 300))
    await ctx.close()
  }
} catch (e) {
  log(false, 'skrip gagal', e.message.slice(0, 400))
} finally {
  await setLang(aisha, 'en')
  await sql`delete from star_ledger where learner_id = ${aisha}`
  await sql`delete from world_state where learner_id = ${aisha}`
  await sql`delete from world_item where learner_id = ${aisha}`
  await sql`delete from world_card where learner_id = ${aisha}`
  await done(b)
}
