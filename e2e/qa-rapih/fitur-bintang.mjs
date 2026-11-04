// Sesi wajib selesai: saklar Kira World mati tidak memberi bintang, menyala memberi bintang. Soal dipersingkat, tetap diklik sungguhan.
import { browser, done, ids, log, loginAisha, mcqItems, newCtx, PHONE, setLang, shot, sql } from './fitur-lib.mjs'

const { org, aisha } = await ids()
const b = await browser()

async function finish(page, label, tag) {
  await page.goto('/today')
  await page.getByText(/Hi, Aisha/).first().waitFor({ timeout: 30000 })
  await page.locator('a[href^="/quest/"], a[href^="/run/"]').first().click()
  await page.waitForURL((u) => /^\/(quest|run)\//.test(u.pathname), { timeout: 30000 })
  if (page.url().includes('/quest/')) {
    await page.getByRole('link', { name: /Start|Begin|Let|Go/ }).or(page.getByRole('button', { name: /Start|Begin|Let|Go/ })).first().click()
    await page.waitForURL((u) => u.pathname.startsWith('/run/'), { timeout: 30000 })
  }
  const attemptId = new URL(page.url()).pathname.split('/').pop()
  const [a] = await sql`select subject from attempt where id = ${attemptId}`
  const prefix = a.subject === 'english' ? 'e2.' : a.subject === 'science' ? 's2.' : 'm2.'
  const short = mcqItems(prefix, 2).map((it, i) => ({ ref: it.id, section: 'core', position: i + 1, difficulty: it.difficulty }))
  await sql`update attempt set items = ${sql.json(short)} where id = ${attemptId}`
  await page.goto(`/run/${attemptId}`)
  const before = (await sql`select count(*)::int n from star_ledger where learner_id = ${aisha}`)[0].n
  for (let i = 0; i < 12 && page.url().includes('/run/'); i++) {
    const check = page.getByRole('button', { name: 'Check', exact: true })
    if (await check.count()) {
      await page.locator('button[aria-pressed="false"]').first().click({ timeout: 2000 }).catch(() => {})
      await check.click({ timeout: 2000 }).catch(() => {})
    }
    await page.waitForTimeout(400)
    const next = page.getByRole('button', { name: /^(Next|Continue|See|Finish|Submit|Done)/ }).first()
    if (await next.count()) await next.click({ timeout: 2000 }).catch(() => {})
    await page.waitForTimeout(500)
  }
  await page.waitForTimeout(1200)
  await shot(page, `selesai-${tag}-375`)
  const [st] = await sql`select status from attempt where id = ${attemptId}`
  const path = new URL(page.url()).pathname
  log(st.status === 'submitted', `${label}: sesi selesai`, `${st.status} ${path}`)
  const after = (await sql`select count(*)::int n from star_ledger where learner_id = ${aisha}`)[0].n
  return { before, after, path }
}

try {
  await setLang(aisha, 'en')
  await sql`delete from star_ledger where learner_id = ${aisha}`
  await sql`delete from learner_feature where learner_id = ${aisha}`
  await sql`insert into learner_feature (learner_id, org_id, key, enabled) values (${aisha}, ${org}, 'kira-world', false)`
  const ctx = await newCtx(b, PHONE)
  const page = await loginAisha(ctx)
  const off = await finish(page, 'World mati', 'off')
  log(off.after === off.before, 'World mati: star_ledger tetap', `${off.before} -> ${off.after}`)
  if (off.path.startsWith('/results')) {
    const links = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')).filter((h) => h.startsWith('/world')))
    log(links.length === 0, 'Results: tanpa tautan World', links.join(','))
    const rt = await page.locator('main').first().innerText().catch(() => '')
    log(!/\bstars\b|Kira World/i.test(rt), 'Results: tidak menyebut bintang', (rt.match(/.{0,30}\bstars\b.{0,30}/i) ?? [''])[0])
  }
  await sql`delete from learner_feature where learner_id = ${aisha}`
  const on = await finish(page, 'World nyala', 'on')
  log(on.after > on.before, 'kontrol World nyala: star_ledger bertambah', `${on.before} -> ${on.after}`)
} catch (e) {
  log(false, 'skrip gagal', e.message.slice(0, 300))
} finally {
  await sql`delete from star_ledger where learner_id = ${aisha}`
  await sql`delete from learner_feature where learner_id = ${aisha}`
  await done(b)
}
