// Saklar fitur mati: tanpa bintang, tanpa menu World, tautan tidak 404, deep link ramah. Selalu menyalakan kembali di akhir.
import { browser, done, ids, log, loginAdult, loginAisha, mcqItems, newCtx, overflow, PHONE, setLang, shot, sql, TABLET } from './fitur-lib.mjs'

const { org, aisha } = await ids()
const b = await browser()
const textOf = async (page) => (await page.locator('main, body').first().innerText()).replace(/\s+/g, ' ').slice(0, 140)
const deep = ['/world', '/world/boss', '/world/pet', '/world/shop', '/world/album', '/world/story', '/world/trophies', '/world/friend', '/world/cards', '/world/certificate/7', '/world/boss/start?b=slime', '/world/boss/result/00000000-0000-4000-8000-000000000000']

async function linksOk(page, label) {
  const hrefs = await page.evaluate(() => [...new Set([...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')))].filter((h) => h.startsWith('/')))
  const world = hrefs.filter((h) => h.startsWith('/world'))
  log(world.length === 0, `${label}: tidak ada tautan World`, world.join(','))
  for (const h of hrefs) {
    // /bye mengeluarkan anak dari sesinya; tautan yang memulai sesi tidak boleh ikut dipanggil.
    if (['/bye', '/start', '/quest/', '/run/'].some((x) => h.includes(x))) continue
    const r = await page.request.get(h, { maxRedirects: 3 }).catch(() => null)
    if (!r || r.status() >= 400) log(false, `${label}: tautan rusak ${h}`, String(r?.status()))
  }
  log(null, `${label}: ${hrefs.length} tautan diperiksa`)
}

try {
  await setLang(aisha, 'en')
  await sql`delete from learner_feature where learner_id = ${aisha}`

  // Orang tua mematikan Dunia Kira lewat layar asli.
  const pc = await newCtx(b, PHONE)
  const pp = await pc.newPage()
  await loginAdult(pp, 'mama@contoh.test', 'kira-mama-contoh-2026', `/keluarga/anak/${aisha}`)
  await pp.goto(`/keluarga/anak/${aisha}`)
  await pp.getByText('Pengaturan', { exact: true }).click().catch(() => {})
  const box = pp.getByRole('checkbox', { name: /Dunia Kira/ })
  await box.first().scrollIntoViewIfNeeded()
  await box.first().uncheck()
  await shot(pp, 'saklar-ortu-375')
  await pp.getByRole('button', { name: 'Simpan pilihan fitur' }).click()
  await pp.waitForTimeout(4000)
  await shot(pp, 'saklar-ortu-tersimpan-375')
  const rows = await sql`select key, enabled from learner_feature where learner_id = ${aisha}`
  log(rows.some((r) => r.key === 'kira-world' && !r.enabled), 'orang tua: saklar Dunia Kira tersimpan mati', JSON.stringify(rows))
  await pc.close()

  for (const [vp, tag] of [[PHONE, '375'], [TABLET, '800']]) {
    const ctx = await newCtx(b, vp)
    const page = await loginAisha(ctx)
    const t0 = Date.now()
    await page.getByText(/Hi, Aisha/).first().waitFor({ timeout: 40000 })
    log(null, `Today ${tag}: isi muncul setelah login`, `${Date.now() - t0} ms`)
    await shot(page, `off-today-${tag}`)
    await linksOk(page, `Today ${tag}`)
    const navWorld = await page.locator('a[href^="/world"]:visible').count()
    log(navWorld === 0, `Today ${tag}: tidak ada menu World`, String(navWorld))
    if (vp === PHONE) {
      const more = page.getByRole('button', { name: /More/ })
      if (await more.count()) {
        await more.first().click()
        await page.waitForTimeout(400)
        await shot(page, 'off-moresheet-375', false)
        const inSheet = await page.locator('a[href^="/world"]').count()
        const txt = await page.locator('[role="dialog"]').first().innerText().catch(() => '')
        log(inSheet === 0 && !/world/i.test(txt), 'lembar More: tidak ada World', txt.replace(/\s+/g, ' ').slice(0, 120))
        await page.keyboard.press('Escape')
      } else log(false, 'tombol More tidak ditemukan di ponsel')
    }
    await page.goto('/me')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    await shot(page, `off-me-${tag}`)
    await linksOk(page, `Me ${tag}`)
    const meTxt = await page.locator('body').innerText()
    log(!/Kira World|\bstars\b/i.test(meTxt), `Me ${tag}: tidak menyebut World atau bintang`, (meTxt.match(/.{0,30}(Kira World|\bstars\b).{0,30}/i) ?? [''])[0])

    for (const d of deep) {
      const resp = await page.goto(d, { waitUntil: 'domcontentloaded' }).catch((e) => ({ status: () => e.message.slice(0, 60) }))
      await page.waitForTimeout(200)
      const name = d.replace(/[^a-z0-9]+/g, '_')
      await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {})
      await shot(page, `off-deep${name}-${tag}`, false).catch(() => log(false, `deep ${d} ${tag}: halaman error browser, layar tidak bisa dipotret`))
      const t = await textOf(page).catch(() => '')
      const blank = t.trim().length < 15
      const finalUrl = new URL(page.url()).pathname
      log(!blank && !/application error|something went wrong|internal server|could not be found/i.test(t), `deep ${d} ${tag}: ${resp?.status?.()} -> ${finalUrl}`, t)
    }

    if (vp === PHONE) {
      const finish = async (label, tag2) => {
        await page.goto('/today')
        await page.getByText(/Hi, Aisha/).first().waitFor({ timeout: 40000 })
        await page.getByRole('link', { name: 'Start', exact: true }).first().click()
        await page.waitForURL((u) => /^\/(quest|run)\//.test(u.pathname), { timeout: 30000 })
        if (page.url().includes('/quest/')) {
          await shot(page, `quest-${tag2}-375`)
          await page.getByRole('link', { name: /Start|Begin|Let|Go/ }).or(page.getByRole('button', { name: /Start|Begin|Let|Go/ })).first().click()
          await page.waitForURL((u) => u.pathname.startsWith('/run/'), { timeout: 30000 })
        }
        const attemptId = new URL(page.url()).pathname.split('/').pop()
        const [a] = await sql`select kind, subject from attempt where id = ${attemptId}`
        const prefix = a.subject === 'english' ? 'e2.' : a.subject === 'science' ? 's2.' : 'm2.'
        const short = mcqItems(prefix, 2).map((it, i) => ({ ref: it.id, section: 'core', position: i + 1, difficulty: it.difficulty }))
        log(null, `${label}: sesi ${a.kind}/${a.subject} dipersingkat`, short.map((x) => x.ref).join(','))
        await sql`update attempt set items = ${sql.json(short)} where id = ${attemptId}`
        await page.goto(`/run/${attemptId}`)
        const before = (await sql`select count(*)::int n from star_ledger where learner_id = ${aisha}`)[0].n
        for (let i = 0; i < 10 && page.url().includes('/run/'); i++) {
          const opt = page.locator('button[aria-pressed="false"]').first()
          if (await opt.count()) await opt.click({ timeout: 2000 }).catch(() => {})
          const check = page.getByRole('button', { name: 'Check', exact: true })
          if (await check.count()) await check.click({ timeout: 2000 }).catch(() => {})
          await page.waitForTimeout(500)
          const next = page.getByRole('button', { name: /^(Next|Continue|See|Finish|Submit|Done)/ }).first()
          if (await next.count()) await next.click({ timeout: 2000 }).catch(() => {})
          await page.waitForTimeout(800)
        }
        await page.waitForTimeout(1500)
        await shot(page, `selesai-${tag2}-375`)
        const path = new URL(page.url()).pathname
        const [st] = await sql`select status from attempt where id = ${attemptId}`
        log(st.status === 'submitted', `${label}: sesi benar-benar selesai`, `${st.status} ${path}`)
        const after = (await sql`select count(*)::int n from star_ledger where learner_id = ${aisha}`)[0].n
        return { before, after, path }
      }
      const off = await finish('World mati', 'off')
      log(off.after === off.before, 'star_ledger tidak bertambah saat World mati', `${off.before} -> ${off.after}`)
      if (off.path.startsWith('/results')) {
        await linksOk(page, 'Results 375')
        const rt = await page.locator('body').innerText()
        log(!/\bstars?\b|Kira World/i.test(rt), 'Results: tidak menyebut bintang', (rt.match(/.{0,30}\bstars?\b.{0,30}/i) ?? [''])[0])
        await page.goto(off.path)
        await shot(page, 'off-results-375')
        const tl = (await page.locator('body').innerText()).replace(/\s+/g, ' ')
        log(null, 'Results isi', tl.slice(0, 200))
      }
      // Kontrol: dengan saklar menyala sesi yang sama memang memberi bintang.
      await sql`delete from learner_feature where learner_id = ${aisha} and key = 'kira-world'`
      const on = await finish('World nyala', 'on')
      log(on.after > on.before, 'kontrol: star_ledger bertambah saat World menyala', `${on.before} -> ${on.after}`)
      await sql`delete from star_ledger where learner_id = ${aisha}`
      await sql`insert into learner_feature (learner_id, org_id, key, enabled) values (${aisha}, ${org}, 'kira-world', false)`
    }
    await ctx.close()
  }

  // Saklar lain: tombol Me hilang, deep link ramah.
  const others = { 'mental-math': ['/quick-maths'], 'quiz-arena': ['/quiz-arena'], 'reading-room': ['/reading'], vocab: ['/practice/cards'], flashcards: ['/practice/cards'] }
  await sql`delete from learner_feature where learner_id = ${aisha}`
  const ctx = await newCtx(b, PHONE)
  const page = await loginAisha(ctx)
  await page.goto('/me')
  const baseHrefs = await page.evaluate(() => [...new Set([...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')))])
  log(null, 'Me semua menyala', baseHrefs.join(' '))
  await shot(page, 'on-me-375')
  for (const [key, paths] of Object.entries(others)) {
    await sql`insert into learner_feature (learner_id, org_id, key, enabled) values (${aisha}, ${org}, ${key}, false) on conflict (learner_id, key) do update set enabled = false`
    await page.goto('/me')
    await page.waitForTimeout(200)
    const hrefs = await page.evaluate(() => [...new Set([...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')))])
    const gone = baseHrefs.filter((h) => !hrefs.includes(h))
    await shot(page, `off-${key}-me-375`)
    const leftover = paths.filter((p) => hrefs.some((h) => h === p || h.startsWith(p + '/') || h.startsWith(p + '?')))
    log(null, `${key}: tautan Me hilang`, gone.join(' ') || '(tidak ada)')
    if (key !== 'vocab' && key !== 'flashcards') log(leftover.length === 0, `${key}: Me menyembunyikan tombol`, leftover.join(','))
    for (const p of paths) {
      const r = await page.goto(p, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(200)
      await shot(page, `off-${key}-deep-375`, false)
      const t = await textOf(page)
      log(t.length > 15 && !/application error|internal server|could not be found/i.test(t), `${key}: deep ${p} ${r?.status()} -> ${new URL(page.url()).pathname}`, t)
      const ov = await overflow(page)
      if (ov.scrollW > ov.clientW) log(false, `${key}: overflow ${p}`, JSON.stringify(ov))
    }
    await sql`delete from learner_feature where learner_id = ${aisha} and key = ${key}`
  }
  // vocab dan flashcards keduanya mati.
  for (const key of ['vocab', 'flashcards']) await sql`insert into learner_feature (learner_id, org_id, key, enabled) values (${aisha}, ${org}, ${key}, false) on conflict (learner_id, key) do update set enabled = false`
  await page.goto('/me')
  const h2 = await page.evaluate(() => [...new Set([...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')))])
  log(!h2.some((h) => h.startsWith('/practice/cards')), 'vocab+flashcards mati: Me tanpa tautan kartu', h2.filter((h) => h.includes('card')).join(','))
  await shot(page, 'off-kartu-me-375')
  const r = await page.goto('/practice/cards', { waitUntil: 'domcontentloaded' })
  await shot(page, 'off-kartu-deep-375', false)
  log((await textOf(page)).length > 15, `vocab+flashcards: deep /practice/cards ${r?.status()} -> ${new URL(page.url()).pathname}`, await textOf(page))
} catch (e) {
  log(false, 'skrip gagal', e.message.slice(0, 400))
} finally {
  await sql`delete from learner_feature where learner_id = ${aisha}`
  log(null, 'semua saklar Aisha menyala kembali')
  await done(b)
}
