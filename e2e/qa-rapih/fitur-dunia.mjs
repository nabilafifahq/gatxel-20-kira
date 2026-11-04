// Teman (telur, menetas, nama jahat, tumbuh), toko, piala dan sertifikat PDF, drill kosakata, audio kartu. Hanya Aisha.
import { writeFileSync } from 'node:fs'
import { browser, done, ids, log, loginAisha, newCtx, overflow, PHONE, setLang, shot, sql, SHOTS, TABLET } from './fitur-lib.mjs'

const { org, aisha } = await ids()
const b = await browser()
const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)
const settle = (page) => page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {})
const check = async (page, label) => {
  const ov = await overflow(page)
  log(ov.scrollW <= ov.clientW, `${label}: tanpa geser samping`, ov.scrollW > ov.clientW ? JSON.stringify(ov) : '')
}

async function resetWorld() {
  await sql`delete from star_ledger where learner_id = ${aisha}`
  await sql`delete from world_state where learner_id = ${aisha}`
  await sql`delete from world_item where learner_id = ${aisha}`
  await sql`delete from world_card where learner_id = ${aisha}`
}
let seededDays = []
let savedProfile = null
const addStars = (n, tag) => sql`insert into star_ledger (org_id, learner_id, amount, reason, source, date) values (${org}, ${aisha}, ${n}, 'session', ${'qa-fitur:' + tag}, ${today})`

try {
  await setLang(aisha, 'en')
  await sql`delete from learner_feature where learner_id = ${aisha}`
  await resetWorld()
  await addStars(5, 'sedikit')
  const ctx = await newCtx(b, PHONE)
  const page = await loginAisha(ctx)
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('dialog', (d) => {
    errors.push(`dialog muncul: ${d.message()}`)
    d.dismiss()
  })

  // Telur belum siap (bintang sedikit).
  await page.goto('/world')
  await settle(page)
  await shot(page, 'hub-telur-375')
  await check(page, 'hub telur')
  await page.goto('/world/friend')
  await settle(page)
  await shot(page, 'pet-belum-375')

  // Toko dengan bintang kurang.
  await page.goto('/world/shop')
  await settle(page)
  await shot(page, 'shop-kurang-375')
  await check(page, 'toko bintang sedikit')
  const buyLow = page.getByRole('button', { name: /Buy|stars/i })
  log(null, 'toko: tombol beli', String(await buyLow.count()))
  const disabled = await page.locator('main button[disabled], button[aria-disabled="true"]').count()
  const bodyLow = (await page.locator('body').innerText()).replace(/\s+/g, ' ')
  log(null, 'toko bintang kurang: tombol nonaktif', `${disabled} :: ${(bodyLow.match(/.{0,50}(more stars|need).{0,50}/i) ?? [''])[0]}`)

  // Bintang cukup: menetas dengan nama jahat.
  await addStars(120, 'cukup')
  const pick = async () => {
    await page.goto('/world/friend')
    await settle(page)
    const hatch = page.getByRole('button', { name: 'Hatch the egg' })
    if (await hatch.count()) await hatch.click()
    await page.getByRole('button', { name: /Moonbun/ }).click()
  }
  // Nama jahat: maxlength dicabut supaya isi utuh sampai ke server, seperti orang yang mengutak-atik halaman.
  for (const [i, v] of ['x'.repeat(500), '<img src=x onerror=alert(1)>', '<b>x</b>'].entries()) {
    await sql`update world_state set pet = null where learner_id = ${aisha}`
    await pick()
    const input = page.getByLabel('What will you call your friend?')
    log(null, 'kolom nama maxlength', String(await input.getAttribute('maxlength')))
    await input.evaluate((el) => el.removeAttribute('maxlength'))
    await input.fill(v)
    await page.getByRole('button', { name: 'Meet your friend' }).click()
    await page.waitForTimeout(1500)
    const msg = (await page.getByRole('alert').first().innerText().catch(() => '')).replace(/\s+/g, ' ')
    const [w] = await sql`select pet from world_state where learner_id = ${aisha}`
    log(!w?.pet, `nama ditolak server: ${v.slice(0, 28)}`, `pesan="${msg}" pet=${JSON.stringify(w?.pet ?? null).slice(0, 100)}`)
    log(i === 0 ? msg.length > 0 : /1 to 12|1 sampai 12/.test(msg), 'pesan untuk anak', msg.slice(0, 120))
    await shot(page, `pet-nama-${i}-375`)
    await check(page, `form nama ${i}`)
    const leaked = await page.locator('img[src="x"], form b').count()
    log(leaked === 0, 'tidak ada HTML dari nama', String(leaked))
  }
  log(errors.length === 0, 'tanpa error halaman atau alert', errors.join(' | ').slice(0, 200))

  // Nama sah terpanjang dan terlebar: kartu dan gelembung tidak pecah.
  const input2 = page.getByLabel('What will you call your friend?')
  await input2.fill('WWWWWWWWWWWW')
  await page.getByRole('button', { name: 'Meet your friend' }).click()
  await page.getByRole('heading', { name: /the Moonbun/ }).waitFor({ timeout: 8000 })
  await settle(page)
  await shot(page, 'pet-jadi-375')
  await check(page, 'teman nama lebar')
  await page.goto('/world')
  await settle(page)
  await shot(page, 'hub-teman-375')
  await check(page, 'hub nama lebar')
  await page.goto('/world/friend')
  await settle(page)

  // Tumbuh: hari belajar lewat day_record (tahap teman) dan hati.
  const growth = async () => (await page.locator('main, body').first().innerText()).replace(/\s+/g, ' ')
  const before = await growth()
  log(null, 'teman sebelum tumbuh', before.slice(0, 220))

  // Streak 7 hari untuk piala dan pertumbuhan.
  const cols = await sql`select column_name from information_schema.columns where table_name = 'day_record'`
  log(null, 'kolom day_record', cols.map((c) => c.column_name).join(','))
  const [lp] = await sql`select started_on::text s, streak_since::text ss from learner_profile where user_id = ${aisha}`
  savedProfile = lp
  await sql`update learner_profile set started_on = ${new Date(Date.now() + 7 * 3600e3 - 20 * 86400e3).toISOString().slice(0, 10)}, streak_since = null where user_id = ${aisha}`
  const days = [...Array(8).keys()].map((i) => new Date(Date.now() + 7 * 3600e3 - (i + 1) * 86400e3).toISOString().slice(0, 10))
  const saved = await sql`select date::text d from day_record where learner_id = ${aisha}`
  seededDays = days.filter((x) => !saved.some((r) => r.d === x))
  for (const x of seededDays) await sql`insert into day_record (org_id, learner_id, date, quests_done, quests_required, minutes) values (${org}, ${aisha}, ${x}, 3, 3, 20)`
  for (const [i, x] of [...Array(10).keys()].map((k) => [k, new Date(Date.now() + 7 * 3600e3 - (k + 1) * 86400e3).toISOString().slice(0, 10)])) {
    await sql`insert into quest (org_id, learner_id, date, subject, session, mode, title, kind, status, seq) values (${org}, ${aisha}, ${x}, 'math', 'latihan', 'latihan', 'QA fitur', 'daily', 'done', ${90 + i})`
  }
  await page.goto('/world/friend')
  await settle(page)
  await shot(page, 'pet-tumbuh-375')
  log(null, 'teman sesudah 8 hari belajar', (await growth()).slice(0, 220))

  // Toko: beli, pakai, bintang kurang.
  await page.goto('/world/shop')
  await settle(page)
  await shot(page, 'shop-cukup-375')
  await check(page, 'toko')
  const buy = page.getByRole('button', { name: /^Buy/ }).first()
  log(null, 'nama tombol beli pertama', (await buy.getAttribute('aria-label').catch(() => '')) ?? (await buy.innerText()))
  const sumBefore = (await sql`select coalesce(sum(amount),0)::int n from star_ledger where learner_id = ${aisha}`)[0].n
  await buy.click()
  await page.waitForTimeout(1500)
  const sumAfter = (await sql`select coalesce(sum(amount),0)::int n from star_ledger where learner_id = ${aisha}`)[0].n
  log(sumAfter < sumBefore, 'beli memotong bintang', `${sumBefore} -> ${sumAfter}`)
  await shot(page, 'shop-beli-375')
  const wear = page.getByRole('button', { name: /^(Wear|Use|Equip|Put on|Move in)/ }).first()
  if (await wear.count()) {
    await wear.click()
    await page.waitForTimeout(1200)
    log(true, 'tombol pakai ditekan', await wear.innerText().catch(() => ''))
    await shot(page, 'shop-pakai-375')
  } else log(false, 'tidak ada tombol pakai setelah beli')

  // Bintang habis: pesan tidak cukup.
  const spend = (await sql`select coalesce(sum(amount),0)::int n from star_ledger where learner_id = ${aisha}`)[0].n
  await sql`insert into star_ledger (org_id, learner_id, amount, reason, source, date) values (${org}, ${aisha}, ${-spend}, 'spend', 'qa-fitur:habis', ${today})`
  await page.reload()
  await settle(page)
  await shot(page, 'shop-habis-375')
  const t2 = (await page.locator('body').innerText()).replace(/\s+/g, ' ')
  log(null, 'toko bintang habis', (t2.match(/.{0,60}(need|more stars|not enough).{0,60}/i) ?? ['(tidak ada kalimat)'])[0])
  const buyLeft = page.getByRole('button', { name: /^Buy/ }).first()
  if (await buyLeft.count()) {
    const en = await buyLeft.isEnabled()
    log(null, 'tombol beli saat bintang habis', en ? 'aktif' : 'nonaktif')
    if (en) {
      await buyLeft.click()
      await page.waitForTimeout(1000)
      await shot(page, 'shop-kurang-klik-375')
      log(null, 'pesan setelah klik', (await page.getByRole('alert').first().innerText().catch(() => '')).slice(0, 120))
    }
  } else log(null, 'tidak ada tombol Buy saat bintang habis')
  await addStars(spend, 'kembali')

  // Piala dan sertifikat.
  await page.goto('/world/trophies')
  await settle(page)
  await shot(page, 'trophy-375')
  await check(page, 'piala')
  const certLink = page.getByRole('link', { name: /Certificate/ }).first()
  if (await certLink.count()) {
    log(true, 'tautan sertifikat 7 hari muncul', await certLink.getAttribute('href'))
    const res = await page.request.get('/world/certificate/7')
    const pdf = await res.body()
    log(res.status() === 200 && pdf.subarray(0, 4).toString() === '%PDF', 'PDF terkirim', `${res.status()} ${res.headers()['content-type']} ${pdf.length}b`)
    writeFileSync(`${SHOTS}/certificate-7.pdf`, pdf)
    const raw = pdf.toString('latin1')
    log(raw.includes('(Aisha)'), 'nama di PDF', (raw.match(/\(([^)]*Aisha[^)]*)\)/) ?? [])[1] ?? '')
    log(raw.includes(today), 'tanggal di PDF', (raw.match(/\((Awarded[^)]*)\)/) ?? [])[1] ?? '')
    const not = await page.request.get('/world/certificate/30', { maxRedirects: 0 })
    log(not.status() === 303 && not.headers()['location'] === '/world/trophies', 'sertifikat 30 hari belum didapat kembali ke piala', `${not.status()} ${not.headers()['location'] ?? ''}`)
  } else log(false, 'tautan sertifikat 7 hari tidak muncul')

  // Album dan audio kartu dengan klip palsu.
  await sql`insert into world_card (org_id, learner_id, card_id, source) values (${org}, ${aisha}, 'an-lion', 'qa-fitur') on conflict do nothing`
  await page.goto('/world/cards')
  await settle(page)
  await shot(page, 'album-375')
  await check(page, 'album')
} catch (e) {
  log(false, 'skrip gagal', e.message.slice(0, 500))
} finally {
  if (seededDays.length) await sql`delete from day_record where learner_id = ${aisha} and date = any(${seededDays}::date[])`
  await sql`delete from quest where learner_id = ${aisha} and title = 'QA fitur'`
  if (savedProfile) await sql`update learner_profile set started_on = ${savedProfile.s}, streak_since = ${savedProfile.ss} where user_id = ${aisha}`
  await resetWorld()
  await done(b)
}
