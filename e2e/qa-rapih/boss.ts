// Bos ujung ke ujung sebagai anak: menang, kalah, ketuk ganda, muat ulang, ulang lawan yang sudah kalah. Raka saja, tanpa seed.
// Jalankan: cd e2e && . C:/kw5/rapih-env.sh && E2E_BASE_URL=http://localhost:3189 ../node_modules/.bin/tsx qa-rapih/boss.ts
import { mkdirSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { BASE, chromium, energy, ids, itemOf, latestAttempt, layoutProbe, login, noScroll, oneQuestion, OUT, panelBtn, say, sfx, snap, SPY, sql, VIEW, watch } from './lib'

mkdirSync(OUT, { recursive: true })

type Plan = (i: number, total: number) => boolean

async function battle(page: Page, raka: string, bossId: string, tag: string, plan: Plan, o: { dblAt?: number; reloadAt?: number; dblFinish?: boolean } = {}) {
  await page.goto(`${BASE}/world/boss/start?b=${bossId}`)
  await page.waitForURL((u) => u.pathname.startsWith('/run/'), { timeout: 30000 })
  const a = await latestAttempt(raka, bossId)
  const items = a.items.filter((x) => x.remedialOf === undefined).sort((x, y) => x.position - y.position)
  const total = items.length
  await page.getByRole('progressbar').first().waitFor({ timeout: 15000 })
  say(true, `${tag}: runner terbuka, ${total} soal, tenaga ${await energy(page)}`)
  await page.screenshot({ path: `${OUT}/${tag}-run-start.png` })
  const probe = (await layoutProbe(page)).filter((x) => x.kind !== 'small-target')
  say(probe.length === 0, `${tag}: tata letak runner ${JSON.stringify(probe.slice(0, 3))}`)
  say(await noScroll(page), `${tag}: tidak bergeser ke samping`)
  // Ronde yang tertinggal (putaran sebelumnya terhenti) dilanjutkan dari soal yang belum selesai, seperti anak yang kembali.
  const doneRows = await sql`select position, status, attempt_no from response where attempt_id = ${a.id}`
  const doneAt = new Set(doneRows.filter((r) => r.status === 'correct' || (r.status === 'wrong' && Number(r.attempt_no) >= 2)).map((r) => Number(r.position)))
  if (doneAt.size > 0) say('NOTE', `${tag}: melanjutkan ronde lama, ${doneAt.size} soal sudah selesai`)
  for (let i = 0; i < total; i++) {
    if (doneAt.has(items[i]!.position)) continue
    const it = itemOf(items[i]!.ref)
    const right = plan(i, total)
    const before = await energy(page)
    const sndBefore = await sfx(page)
    await oneQuestion(page, it, right, { dbl: o.dblAt === i })
    if (o.dblAt === i) {
      await page.waitForTimeout(900)
      const rows = await sql`select count(*)::int n from response where attempt_id = ${a.id} and position = ${items[i]!.position}`
      say(rows[0]?.n === 1, `${tag}: ketuk ganda Check, baris jawaban soal ini = ${rows[0]?.n}`)
      const advanced = !(await panelBtn(page).isVisible())
      say(advanced ? 'NOTE' : true, `${tag}: ketuk ganda Check ${advanced ? 'langsung lewat ke soal berikutnya, umpan balik tidak terlihat' : 'tetap di umpan balik'}; tenaga ${await energy(page)}`)
      await page.screenshot({ path: `${OUT}/${tag}-after-dbl.png` })
      if (advanced) continue
    }
    await panelBtn(page).waitFor({ timeout: 15000 })
    await page.waitForTimeout(120)
    const fx = await page.evaluate(() => ({ hit: document.querySelectorAll('.kw-hit').length, zap: document.querySelectorAll('.kw-zap').length, ring: document.querySelectorAll('.kw-flash-ring').length, hop: document.querySelectorAll('.kw-hop').length }))
    const after = await energy(page)
    const line = await page.locator('p[aria-live=polite]').first().textContent().catch(() => '')
    const snd = (await sfx(page)) - sndBefore
    say(right ? Number(after) < Number(before) || after === '0' : after === before, `${tag} q${i + 1} ${it.type} ${right ? 'benar' : 'salah'}: tenaga ${before}->${after} fx=${JSON.stringify(fx)} bunyi+${snd} "${line}"`)
    if (i < 2 || i === total - 1) await page.screenshot({ path: `${OUT}/${tag}-q${i + 1}-${right ? 'right' : 'wrong'}.png` })
    if (o.reloadAt === i) {
      // Beri waktu antrean jawaban terkirim, seperti anak yang menyegarkan halaman.
      await page.waitForTimeout(900)
      const e1 = await energy(page)
      await page.reload()
      await page.getByRole('progressbar').first().waitFor({ timeout: 15000 })
      const e2 = await energy(page)
      say(e1 === e2, `${tag}: muat ulang di tengah, tenaga ${e1}->${e2}`)
      await page.screenshot({ path: `${OUT}/${tag}-after-reload.png` })
      // Setelah muat ulang runner membuka soal berikutnya yang belum selesai, jadi tidak ada tombol lanjut untuk soal ini.
      if (i < total - 1) continue
      await page.waitForTimeout(800)
      await page.screenshot({ path: `${OUT}/${tag}-reload-last.png` })
      say(await panelBtn(page).isVisible(), `${tag}: muat ulang setelah soal terakhir, tombol Finish tetap ada`)
    }
    const last = i === total - 1
    if (last && o.dblFinish) await panelBtn(page).dblclick({ timeout: 8000 })
    else await panelBtn(page).click({ timeout: 8000 })
  }
  await page.waitForURL((u) => u.pathname.startsWith('/world/boss/result/') || u.pathname.startsWith('/results/'), { timeout: 30000 })
  say(new URL(page.url()).pathname.startsWith('/world/boss/result/'), `${tag}: pindah ke ${new URL(page.url()).pathname.split('/').slice(0, 4).join('/')}`)
  return { id: a.id, total }
}

async function resultShots(page: Page, tag: string, wantCard: boolean) {
  const snd0 = await sfx(page)
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/${tag}-result-early.png` })
  await page.waitForTimeout(wantCard ? 3000 : 1500)
  await page.screenshot({ path: `${OUT}/${tag}-result.png`, fullPage: true })
  say((await sfx(page)) > snd0, `${tag}: layar hasil berbunyi (+${(await sfx(page)) - snd0})`)
  say(await noScroll(page), `${tag}: hasil tidak bergeser ke samping`)
  const text = (await page.locator('main, body').first().innerText()).replace(/\s+/g, ' ').slice(0, 500)
  console.log(`     teks: ${text}`)
  return text
}

/** Supaya skrip bisa diulang tanpa seed: hanya data bos milik Raka yang dikosongkan. Aisha tidak disentuh. */
async function resetRakaBoss(raka: string) {
  await sql`delete from attempt where learner_id = ${raka} and ref_id like 'boss:%'`
  await sql`delete from world_card where learner_id = ${raka} and source like 'boss:%'`
  await sql`delete from star_ledger where learner_id = ${raka} and reason = 'boss'`
  await sql`update world_state set progress = progress - 'boss' - 'bossWins' where learner_id = ${raka}`
}

async function main() {
  const { raka } = await ids()
  await resetRakaBoss(raka)
  const browser = await chromium.launch()
  const only = process.env.QA_VIEW
  for (const [name, viewport] of Object.entries(VIEW)) {
    if (only && only !== name) continue
    const [winBoss, loseBoss] = name === 'phone' ? ['clickerclaw', 'mumblewump'] : ['robot', 'mumblewump']
    const ctx = await browser.newContext({ locale: 'en-GB', timezoneId: 'Asia/Jakarta', viewport, hasTouch: true, serviceWorkers: 'block' })
    await ctx.addInitScript(SPY)
    const page = await login(ctx, 'Raka')
    const errs = watch(page)

    // Jalan seperti anak: Kira World, tab Boss, pilih lawan.
    await page.goto(`${BASE}/world`)
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${OUT}/${name}-world.png`, fullPage: true })
    await page.getByRole('link', { name: /boss/i }).first().click({ timeout: 10000 })
    await page.waitForURL((u) => u.pathname === '/world/boss', { timeout: 15000 })
    await page.waitForTimeout(800)
    await page.screenshot({ path: `${OUT}/${name}-boss.png`, fullPage: true })
    say(await noScroll(page), `${name}: papan bos tidak bergeser`)
    await page.getByRole('button', { name: new RegExp(winBoss === 'robot' ? 'Puzzle Robot' : 'Clickerclaw') }).first().click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${OUT}/${name}-boss-picked.png` })

    // Menang: salah sekali di awal, muat ulang di tengah, ketuk ganda Check, ketuk ganda Finish.
    const s0 = await snap(raka)
    const first = await battle(page, raka, winBoss, `${name}-win`, (i) => i !== 1, { dblAt: 2, reloadAt: 3, dblFinish: true })
    const t1 = await resultShots(page, `${name}-win`, true)
    const s1 = await snap(raka)
    console.log(`     delta bintang ${s1.stars - s0.stars} (baris +${s1.starRows - s0.starRows}) xp ${s1.xp - s0.xp} (baris +${s1.xpRows - s0.xpRows}) kartu ${JSON.stringify(s1.cards.filter((c) => !s0.cards.includes(c)))}`)
    say(s1.cards.length > s0.cards.length, `${name}: kartu langka bertambah`)
    say(/You beat/.test(t1), `${name}: judul menang tampil`)
    // Muat ulang layar hasil dan buka lagi runner yang sudah dikumpulkan.
    await page.reload()
    await page.waitForTimeout(3500)
    const s1b = await snap(raka)
    say(JSON.stringify(s1) === JSON.stringify(s1b), `${name}: muat ulang hasil tidak memberi hadiah lagi`)
    await page.goto(`${BASE}/run/${first.id}`)
    await page.waitForTimeout(3500)
    console.log(`     buka lagi runner selesai -> ${new URL(page.url()).pathname}`)
    await page.screenshot({ path: `${OUT}/${name}-rerun-after-submit.png`, fullPage: true })
    say(new URL(page.url()).pathname.startsWith('/world/boss/result/'), `${name}: runner selesai kembali ke hasil bos`)
    const s1c = await snap(raka)
    say(JSON.stringify(s1) === JSON.stringify(s1c), `${name}: buka lagi runner tidak memberi hadiah lagi`)

    // Album.
    await page.goto(`${BASE}/world/cards`)
    await page.waitForTimeout(1000)
    await page.screenshot({ path: `${OUT}/${name}-album.png`, fullPage: true })
    const added = s1.cards.filter((c) => !s0.cards.includes(c))
    console.log(`     album: ${(await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 240)}`)
    console.log(`     kartu baru ${added.join(',')}`)

    // Lawan yang sudah kalah diulang: kartu tidak dobel, bintang minggu ini tidak dobel.
    const r0 = await snap(raka)
    await battle(page, raka, winBoss, `${name}-repeat`, () => true)
    await resultShots(page, `${name}-repeat`, false)
    const r1 = await snap(raka)
    say(r1.cards.length === r0.cards.length, `${name}: ulang lawan, kartu ${r0.cards.length}->${r1.cards.length}`)
    say(r1.stars === r0.stars, `${name}: ulang lawan, bintang ${r0.stars}->${r1.stars}`)

    // Kalah: semua salah. Tidak ada yang berkurang.
    const l0 = await snap(raka)
    await battle(page, raka, loseBoss, `${name}-lose`, () => false)
    const t3 = await resultShots(page, `${name}-lose`, false)
    const l1 = await snap(raka)
    say(l1.stars >= l0.stars && l1.starRows === l0.starRows, `${name}: kalah, bintang ${l0.stars}->${l1.stars}`)
    say(l1.xp >= l0.xp, `${name}: kalah, xp ${l0.xp}->${l1.xp}`)
    say(l1.cards.length === l0.cards.length, `${name}: kalah, kartu tetap`)
    say(/rematch/i.test(t3), `${name}: kata tanding ulang tampil`)
    say(errs.length === 0, `${name}: tanpa error ${JSON.stringify(errs.slice(0, 5))}`)
    await ctx.close()
  }
  await browser.close()
  await sql.end()
}
main().catch((e) => {
  console.error(String(e).slice(0, 800))
  process.exit(1)
})
