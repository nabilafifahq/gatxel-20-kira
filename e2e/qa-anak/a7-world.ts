// Kira World dan area jelajah: dompet, telur, toko, album dengan suara kartu, cerita, bos, piala, sertifikat PDF, buku panjang, alat peraga, kamus.
import { ensureToday } from './a2-sessions'
import { chromium, families, layoutSweep, newCtx, OUT, PHONE, qa, say, sql, TABLET, WEBVIEW_UA, type Page } from './lib'

const stars = async (page: Page) => {
  const t = (await page.locator('body').innerText()).replace(/\s+/g, ' ')
  return t
}
const sweep = async (page: Page, tag: string) => {
  const sw = (await layoutSweep(page)).filter((x) => !/^small 4[23]x44/.test(x))
  if (sw.length) say(false, `${tag} tata letak ${JSON.stringify(sw.slice(0, 5))}`)
}

async function main() {
  const grade = Number(process.argv[2])
  const phone = process.argv[3] === 'phone'
  const webview = process.argv[4] === 'webview'
  const f = families().find((x) => x.grade === grade)!
  const en = f.lang === 'en'
  const b = await chromium.launch()
  const ctx = await newCtx(b, { viewport: phone ? PHONE : TABLET, ua: webview ? WEBVIEW_UA : undefined, tag: `world-g${grade}`, state: `${OUT}/state-g${grade}.json` })
  const page = await ctx.newPage()
  await ensureToday(page, f)
  const pre = phone ? 'wp' : 'wt'

  // Telur menetas: nama dan jenis teman.
  await page.goto('/world/friend')
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${OUT}/${pre}-g${grade}-friend-0.png`, fullPage: true })
  const hatch = page.getByRole('button', { name: en ? /hatch/i : /tetas/i }).first()
  if (await hatch.isVisible().catch(() => false)) {
    await hatch.click()
    await page.waitForTimeout(800)
    await page.screenshot({ path: `${OUT}/${pre}-g${grade}-friend-1.png`, fullPage: true })
    const kinds = page.locator('main button[aria-pressed], main [role=radio], main button').filter({ hasNotText: /^$/ })
    await kinds.first().click().catch(() => {})
    await page.waitForTimeout(250)
    const name = page.getByRole('textbox').first()
    await name.fill('Bobo').catch(() => {})
    const save = page.getByRole('button', { name: en ? /Meet|Save|Done|name|Go|OK/i : /Simpan|Beri|Lanjut|Selesai|Kenalan|Ayo/i }).last()
    await save.click({ timeout: 5000 }).catch(() => say(false, `g${grade} tombol simpan teman tidak ketemu`))
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `${OUT}/${pre}-g${grade}-friend-2.png`, fullPage: true })
    const [p] = await sql`select * from learner_pet where learner_id = ${f.learnerId!}`.catch(() => [null])
    say(!!p, `g${grade} teman menetas tersimpan: ${p ? JSON.stringify({ kind: p.kind, name: p.name }) : 'tidak'}`)
  } else say('INFO', `g${grade} telur sudah menetas atau tombol tidak ada`)
  await sweep(page, `g${grade} teman`)

  // Toko: beli satu barang, bintang berkurang.
  await page.goto('/world/shop')
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}/${pre}-g${grade}-shop.png`, fullPage: true })
  const buy = page.locator('main').getByRole('button', { name: en ? /Buy/ : /Beli/ }).and(page.locator(':enabled')).first()
  if (await buy.isVisible().catch(() => false)) {
    const label = await buy.getAttribute('aria-label')
    const [w0] = await sql`select coalesce(sum(delta),0)::int n from star_ledger where learner_id = ${f.learnerId!}`.catch(() => [{ n: null }])
    await buy.click()
    await page.waitForTimeout(1200)
    const [w1] = await sql`select coalesce(sum(delta),0)::int n from star_ledger where learner_id = ${f.learnerId!}`.catch(() => [{ n: null }])
    say('INFO', `g${grade} beli "${label}": bintang ${w0?.n} -> ${w1?.n}`)
    await page.screenshot({ path: `${OUT}/${pre}-g${grade}-shop-after.png` })
  } else say('INFO', `g${grade} tidak ada barang yang terbeli`)
  await sweep(page, `g${grade} toko`)

  // Album: kartu milik dan suaranya.
  await page.goto('/world/cards')
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${OUT}/${pre}-g${grade}-album.png`, fullPage: true })
  await sweep(page, `g${grade} album`)
  const setBtn = page.locator('main button').nth(0)
  void setBtn
  const owned = page.locator('main button[aria-label]').filter({ hasNot: page.locator('[disabled]') })
  const count = await owned.count()
  say('INFO', `g${grade} album tombol kartu ${count}`)

  // Cerita: bab pertama, gambar, teks, suara.
  await page.goto('/world/story')
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${OUT}/${pre}-g${grade}-story.png`, fullPage: true })
  const ch = page.locator('main button.flex, main section button').first()
  if (await ch.isVisible().catch(() => false)) {
    await ch.click()
    await page.waitForTimeout(900)
    await page.screenshot({ path: `${OUT}/${pre}-g${grade}-story-1.png`, fullPage: true })
    const e0 = (await qa(page)).ended
    const sp = page.getByRole('button', { name: en ? /Read aloud/ : /Bacakan/ }).first()
    if (await sp.isVisible().catch(() => false)) {
      await sp.click()
      await page.waitForTimeout(2500)
      const s = await qa(page)
      say(s.clips.length > 0 && s.clipErrors.length === 0, `g${grade} cerita bersuara: klip ${s.clips.length}, selesai ${s.ended - e0}, galat ${JSON.stringify(s.clipErrors.slice(0, 2))}`)
    } else say(process.env.E2E_BASE_URL?.includes('3197') ? false : 'INFO', `g${grade} cerita tanpa tombol suara`)
    const imgs = await page.locator('main svg, main img').count()
    say(imgs > 0, `g${grade} cerita punya gambar (${imgs})`)
    await sweep(page, `g${grade} cerita`)
  }

  // Bos: 14 bos, terbuka menurut hari belajar.
  await page.goto('/world/boss')
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${OUT}/${pre}-g${grade}-boss.png`, fullPage: true })
  const bossBody = await stars(page)
  const bossCount = await page.locator('main section[aria-label] li, main section[aria-label] article').count()
  say('INFO', `g${grade} bos: elemen ${bossCount}; ${bossBody.slice(bossBody.indexOf(en ? 'Boss' : 'Bos'), bossBody.indexOf(en ? 'Boss' : 'Bos') + 200)}`)
  await sweep(page, `g${grade} bos`)
  const start = page.locator('main a[href^="/world/boss/start"]').first()
  if (await start.isVisible().catch(() => false)) {
    await start.click()
    await page.waitForURL((u) => !u.pathname.startsWith('/world/boss'), { timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(800)
    await page.screenshot({ path: `${OUT}/${pre}-g${grade}-boss-run.png` })
    say(new URL(page.url()).pathname.startsWith('/run/'), `g${grade} bos membuka runner: ${new URL(page.url()).pathname}`)
    const path = new URL(page.url()).pathname
    if (path.startsWith('/run/')) {
      const raw = await (await page.request.get(path)).text()
      const leak = /\\?"answer\\?"\s*:\s*(\d|\\?"|\{)/.exec(raw)?.[0]
      say(!leak, `g${grade} bos payload tanpa kunci ${leak ?? ''}`)
    }
  } else say('INFO', `g${grade} bos belum ada yang terbuka`)

  // Piala dan sertifikat: belum tercapai tidak boleh mengunduh; setelah streak 7 hari (disetel di DB) PDF terbit.
  await page.goto('/world/trophies')
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}/${pre}-g${grade}-trophies.png`, fullPage: true })
  await sweep(page, `g${grade} piala`)
  const notYet = await page.request.get('/world/certificate/30', { maxRedirects: 0 })
  say(notYet.status() === 303 || notYet.status() === 302 || notYet.status() === 307, `g${grade} sertifikat belum tercapai diarahkan (${notYet.status()})`)

  // Buku panjang: kelas 5 dan 6 di lebar HP.
  await page.goto('/reading')
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${OUT}/${pre}-g${grade}-reading.png`, fullPage: true })
  const youChip = page.getByRole('button', { name: en ? `Grade ${grade} (you)` : new RegExp(`Kelas ${grade}`) }).first()
  await youChip.click().catch(() => {})
  await page.waitForTimeout(300)
  const book = page.locator('main a[href^="/reading/"]').first()
  if (await book.isVisible().catch(() => false)) {
    const name = (await book.innerText()).replace(/\s+/g, ' ').slice(0, 60)
    await book.click()
    await page.waitForURL((u) => u.pathname !== '/reading', { timeout: 15000 })
    await page.waitForTimeout(700)
    await page.screenshot({ path: `${OUT}/${pre}-g${grade}-book.png`, fullPage: true })
    const chapter = page.locator('main a[href*="/reading/"]').first()
    if (await chapter.isVisible().catch(() => false)) {
      const chHref = await chapter.getAttribute('href')
      await chapter.click()
      await page.waitForTimeout(1200)
      await page.screenshot({ path: `${OUT}/${pre}-g${grade}-reader.png`, fullPage: true })
      await sweep(page, `g${grade} pembaca`)
      const words = (await page.locator('main').innerText()).split(/\s+/).length
      say('INFO', `g${grade} buku "${name}" bab ${chHref}: halaman pertama sekitar ${words} kata`)
      const fs = await page.evaluate(() => {
        const p = document.querySelector('main p')
        return p ? parseFloat(getComputedStyle(p).fontSize) : 0
      })
      say(fs >= 16, `g${grade} ukuran huruf pembaca ${fs}px`)
      // Halaman berikut, lalu simpan posisi.
      const next = page.getByRole('button', { name: en ? /Next page|Next/ : /Halaman berikut|Lanjut/ }).last()
      if (await next.isVisible().catch(() => false)) {
        await next.click().catch(() => {})
        await page.waitForTimeout(1800)
        const url = page.url()
        await page.goto('/today')
        await page.waitForTimeout(300)
        await page.goto(url)
        await page.waitForTimeout(1000)
        await page.screenshot({ path: `${OUT}/${pre}-g${grade}-reader-resume.png` })
        const pageTxt = (await page.locator('body').innerText()).match(/(Page|Halaman) \d+ (of|dari) \d+/)?.[0]
        say(!!pageTxt && !/^(Page|Halaman) 1 /.test(pageTxt), `g${grade} posisi bacaan tersimpan: ${pageTxt}`)
      }
    }
  } else say(false, `g${grade} tidak ada buku`)

  // Alat peraga: lima alat terbuka.
  await page.goto('/tools')
  await page.waitForTimeout(700)
  const tools = await page.locator('main [role=tablist] [role=tab], main [role=radiogroup] [role=radio]').count()
  const btns = en ? ['Place value blocks', 'Fraction bars', 'Bar models', 'Tangram', 'Geoboard'] : ['Blok nilai tempat', 'Batang pecahan', 'Model batang', 'Tangram', 'Papan paku']
  for (const n of btns) {
    const bt = page.getByRole('tab', { name: n }).or(page.getByRole('button', { name: n, exact: true })).or(page.getByRole('radio', { name: n })).first()
    if (!(await bt.isVisible().catch(() => false))) {
      say('INFO', `g${grade} alat ${n}: tombol tidak ketemu (${tools})`)
      continue
    }
    await bt.click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${OUT}/${pre}-g${grade}-tool-${n.replace(/\s/g, '')}.png`, fullPage: true })
    await sweep(page, `g${grade} alat ${n}`)
  }
  const q = await qa(page)
  say(q.speak.length === 0, `g${grade} world suara perangkat ${q.speak.length}`)
  await b.close()
  await sql.end()
}
main().catch((e) => {
  console.error(String(e).slice(0, 1000))
  process.exit(1)
})
