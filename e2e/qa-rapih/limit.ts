// Batas layar tercapai di tengah bos dan Quick Maths, dan muat ulang setelah soal terakhir. Raka saja, tanpa seed.
// Batas Raka dikembalikan di akhir, juga bila skrip gagal.
// Jalankan: cd e2e && . C:/kw5/rapih-env.sh && E2E_BASE_URL=http://localhost:3189 ../node_modules/.bin/tsx qa-rapih/limit.ts
import { mkdirSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { answer, BASE, chromium, energy, ids, itemOf, latestAttempt, login, noScroll, oneQuestion, OUT, panelBtn, say, snap, SPY, sql, VIEW, watch } from './lib'

mkdirSync(OUT, { recursive: true })

/** Tangkap detak 2 menit milik LearnerRuntime supaya bisa dipicu tanpa menunggu 2 menit; kode kliennya tetap yang asli. */
const HOOK = () => {
  const w = window as unknown as { __beat?: () => void }
  const si = window.setInterval
  window.setInterval = ((fn: () => void, ms?: number, ...r: unknown[]) => {
    if (ms === 120000) w.__beat = fn
    return si(fn, ms, ...(r as []))
  }) as typeof window.setInterval
}

const today = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)
const text = async (p: Page) => (await p.locator('body').innerText()).replace(/\s+/g, ' ')

/** Detak sungguhan. Server menyimpan jawaban detak selama 45 detik, jadi tunggu dulu supaya batas baru terbaca. */
async function beat(page: Page) {
  await page.waitForTimeout(47000)
  const res = page.waitForResponse((r) => r.url().endsWith('/api/heartbeat'), { timeout: 15000 })
  await page.evaluate(() => (window as unknown as { __beat?: () => void }).__beat?.())
  const body = (await (await res).json()) as { minutes: number; limit: number }
  await page.waitForTimeout(1500)
  return body
}

async function overLimit(raka: string, org: string) {
  await sql`update learner_profile set screen_limit_min = 15 where user_id = ${raka}`
  await sql`insert into day_record (org_id, learner_id, date, minutes, last_ping_at) values (${org}, ${raka}, ${today()}, 20, now()) on conflict (learner_id, date) do update set minutes = 20, last_ping_at = now()`
}

async function bossThrough(page: Page, raka: string, org: string, boss: string, tag: string) {
  await sql`update learner_profile set screen_limit_min = 60 where user_id = ${raka}`
  await sql`update day_record set minutes = 1 where learner_id = ${raka} and date = ${today()}`
  await page.goto(`${BASE}/world/boss/start?b=${boss}`)
  await page.waitForURL((u) => u.pathname.startsWith('/run/'), { timeout: 30000 })
  const a = await latestAttempt(raka, boss)
  const items = a.items.filter((x) => x.remedialOf === undefined).sort((x, y) => x.position - y.position)
  await page.getByRole('progressbar').first().waitFor()
  const before = await snap(raka)
  await oneQuestion(page, itemOf(items[0]!.ref), true)
  await panelBtn(page).waitFor({ timeout: 15000 })

  // Batas tercapai di tengah pertarungan.
  await overLimit(raka, org)
  const b = await beat(page)
  say(b.minutes >= b.limit, `${tag}: detak melihat ${b.minutes} dari ${b.limit} menit`)
  say(new URL(page.url()).pathname.startsWith('/run/'), `${tag}: pertarungan tidak diputus (${new URL(page.url()).pathname.slice(0, 12)})`)
  await page.screenshot({ path: `${OUT}/${tag}-limit-midround.png` })
  await panelBtn(page).click()
  for (let i = 1; i < items.length; i++) {
    await oneQuestion(page, itemOf(items[i]!.ref), true)
    await panelBtn(page).waitFor({ timeout: 15000 })
    await page.waitForTimeout(100)
    await panelBtn(page).click()
  }
  await page.waitForURL((u) => u.pathname.startsWith('/world/boss/result/'), { timeout: 30000 })
  await page.waitForTimeout(3500)
  await page.screenshot({ path: `${OUT}/${tag}-limit-result.png`, fullPage: true })
  const [row] = await sql`select status, score_raw from attempt where id = ${a.id}`
  say(row!.status === 'submitted', `${tag}: ronde tersimpan, status ${row!.status}, skor ${row!.score_raw}`)
  const after = await snap(raka)
  say(after.xp >= before.xp, `${tag}: XP tetap masuk ${before.xp}->${after.xp}`)
  say(true, `${tag}: layar hasil tetap tampil: ${(await text(page)).slice(0, 170)}`)

  // Anak menekan tanding ulang atau main lagi setelah batas habis.
  await page.getByRole('link', { name: /Friendly rematch|Play again/ }).first().click()
  await page.waitForTimeout(3000)
  const path = new URL(page.url()).pathname
  await page.screenshot({ path: `${OUT}/${tag}-limit-rematch.png`, fullPage: true })
  say(!path.startsWith('/run/'), `${tag}: ronde baru setelah batas habis ditolak, sekarang di ${path.slice(0, 22)}`)
  say(/break|istirahat/i.test(await text(page)), `${tag}: ada kata istirahat yang ramah`)
  say(await noScroll(page), `${tag}: tidak bergeser ke samping`)
  console.log(`     teks: ${(await text(page)).slice(0, 320)}`)
  // Setelah keluar dari hasil, detak berikutnya mengantar ke layar istirahat (kecuali sudah di sana).
  await beat(page)
  await page.waitForTimeout(2500)
  say(new URL(page.url()).pathname === '/today/done', `${tag}: detak berikutnya membawa ke layar istirahat, sekarang ${new URL(page.url()).pathname}`)
}

/** Selesaikan Quick Maths lewat UI: baca soal dari layar, jawab dari kunci sesi di DB bila ada. */
async function quickMaths(page: Page, raka: string, org: string, tag: string) {
  await sql`update learner_profile set screen_limit_min = 60 where user_id = ${raka}`
  await sql`update day_record set minutes = 1 where learner_id = ${raka} and date = ${today()}`
  await page.goto(`${BASE}/quick-maths`)
  await page.getByRole('button', { name: 'Start practice' }).click({ timeout: 15000 })
  await page.waitForURL((u) => u.pathname.includes('/play/'), { timeout: 30000 }).catch(() => {})
  await page.getByText(/Question 1 of/).first().waitFor({ timeout: 20000 })
  const sessionId = new URL(page.url()).pathname.split('/').pop()!
  const total = Number(((await text(page)).match(/Question 1 of (\d+)/) ?? [])[1] ?? 10)
  const key = page.locator('section').getByRole('button', { name: '1', exact: true }).first()
  await key.click({ timeout: 8000 })
  await page.getByRole('button', { name: 'Check', exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click({ timeout: 8000 }).catch(() => {})
  await overLimit(raka, org)
  const b = await beat(page)
  say(b.minutes >= b.limit, `${tag}: detak melihat ${b.minutes} dari ${b.limit} menit`)
  say(new URL(page.url()).pathname.includes('/play/'), `${tag}: ronde tidak diputus`)
  await page.screenshot({ path: `${OUT}/${tag}-qm-midround.png` })
  for (let i = 2; i <= total; i++) {
    await page.getByText(new RegExp(`Question ${i} of`)).first().waitFor({ timeout: 15000 })
    await page.locator('section').getByRole('button', { name: '1', exact: true }).first().click({ timeout: 8000 })
    await page.getByRole('button', { name: 'Check', exact: true }).click()
    // Jawaban salah menunggu tombol Next, juga di soal terakhir.
    await page.getByRole('button', { name: 'Next', exact: true }).click({ timeout: 5000 }).catch(() => {})
  }
  await page.getByRole('heading', { level: 1, name: 'Round done' }).waitFor({ timeout: 30000 })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${OUT}/${tag}-qm-done.png`, fullPage: true })
  const [row] = await sql`select finished_at, answered, correct from arena_session where id = ${sessionId}`
  say(!!row?.finished_at, `${tag}: ronde Quick Maths tersimpan, dijawab ${row?.answered}, benar ${row?.correct}`)
  console.log(`     teks: ${(await text(page)).slice(0, 320)}`)
  // Main lagi saat batas habis: ditolak dengan kata yang ramah, hasil tetap di layar.
  await page.getByRole('button', { name: 'Play again', exact: true }).click({ timeout: 8000 })
  await page.waitForTimeout(2000)
  await page.screenshot({ path: `${OUT}/${tag}-qm-again-limit.png`, fullPage: true })
  const again = await text(page)
  say(/break/i.test(again) && /Round done/.test(again) && !/Reference/.test(again), `${tag}: Play again saat batas habis menjelaskan istirahat dan hasil tetap tampil`)
  console.log(`     teks: ${again.slice(0, 420)}`)
  await page.goto(`${BASE}/quick-maths`)
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `${OUT}/${tag}-qm-hub-limit.png`, fullPage: true })
  console.log(`     hub/akhir ${new URL(page.url()).pathname}: ${(await text(page)).slice(0, 320)}`)
  say(/break|istirahat/i.test(await text(page)), `${tag}: kata istirahat tampil`)
}

/** Muat ulang setelah soal terakhir dijawab, sebelum menekan Finish: ronde harus tetap bisa dikumpulkan. */
async function reloadLast(page: Page, raka: string, boss: string, tag: string) {
  // Ronde lama yang tertinggal milik Raka dibuang supaya putaran ini mulai dari soal pertama.
  await sql`delete from attempt where learner_id = ${raka} and status = 'in_progress' and ref_id like ${'boss:%:' + boss + ':%'}`
  await page.goto(`${BASE}/world/boss/start?b=${boss}`)
  await page.waitForURL((u) => u.pathname.startsWith('/run/'), { timeout: 30000 })
  const a = await latestAttempt(raka, boss)
  const items = a.items.filter((x) => x.remedialOf === undefined).sort((x, y) => x.position - y.position)
  await page.getByRole('progressbar').first().waitFor()
  for (let i = 0; i < items.length; i++) {
    await oneQuestion(page, itemOf(items[i]!.ref), true)
    await panelBtn(page).waitFor({ timeout: 15000 })
    await page.waitForTimeout(100)
    if (i < items.length - 1) await panelBtn(page).click()
  }
  await page.waitForTimeout(1500)
  await page.reload()
  await page.waitForTimeout(6000)
  await page.screenshot({ path: `${OUT}/${tag}-reload-last.png`, fullPage: true })
  const [row] = await sql`select status from attempt where id = ${a.id}`
  const path = new URL(page.url()).pathname
  console.log(`     setelah muat ulang: ${path.slice(0, 24)} status ${row!.status}: ${(await text(page)).slice(0, 200)}`)
  const ok = await page.getByRole('button').filter({ hasText: /Finish|Try again/ }).count()
  say(row!.status === 'submitted' || ok > 0, `${tag}: muat ulang setelah soal terakhir tidak membuat anak terjebak`)
}

/** Ketuk ganda pada pilihan jawaban, lalu salah sekali dan benar pada percobaan kedua: bar dan skor server harus sama. */
async function retryMix(page: Page, raka: string, boss: string, tag: string) {
  await sql`delete from attempt where learner_id = ${raka} and status = 'in_progress' and ref_id like ${'boss:%:' + boss + ':%'}`
  await page.goto(`${BASE}/world/boss/start?b=${boss}`)
  await page.waitForURL((u) => u.pathname.startsWith('/run/'), { timeout: 30000 })
  const a = await latestAttempt(raka, boss)
  const items = a.items.filter((x) => x.remedialOf === undefined).sort((x, y) => x.position - y.position)
  await page.getByRole('progressbar').first().waitFor()
  const check = page.getByRole('button', { name: 'Check', exact: true })
  const first = itemOf(items[0]!.ref)
  await answer(page, first, true, { issues: [] })
  await answer(page, first, true, { issues: [] })
  await page.waitForTimeout(150)
  say(first.type !== 'mcq' || (await check.isEnabled()), `${tag}: ketuk ganda pilihan jawaban, Check tetap bisa ditekan (${first.type})`)
  await check.click({ timeout: 8000 })
  await panelBtn(page).waitFor({ timeout: 15000 })
  await page.waitForTimeout(100)
  await panelBtn(page).click()
  const second = itemOf(items[1]!.ref)
  await answer(page, second, false, { issues: [] })
  await check.click({ timeout: 8000 })
  await page.getByRole('button', { name: 'Try again', exact: true }).click({ timeout: 10000 })
  await answer(page, second, true, { issues: [] })
  await check.click({ timeout: 8000 })
  await panelBtn(page).waitFor({ timeout: 15000 })
  await page.waitForTimeout(150)
  const bar = await energy(page)
  say(true, `${tag}: salah lalu benar, tenaga ${bar}`)
  await panelBtn(page).click()
  for (let i = 2; i < items.length; i++) {
    await oneQuestion(page, itemOf(items[i]!.ref), i !== 2)
    await panelBtn(page).waitFor({ timeout: 15000 })
    await page.waitForTimeout(100)
    await panelBtn(page).click()
  }
  await page.waitForURL((u) => u.pathname.startsWith('/world/boss/result/'), { timeout: 30000 })
  await page.waitForTimeout(3500)
  await page.screenshot({ path: `${OUT}/${tag}-retry-result.png`, fullPage: true })
  const [row] = await sql`select status, score_raw, score_max, result->'boss' as boss from attempt where id = ${a.id}`
  say(row!.score_raw === items.length - 1, `${tag}: skor server ${row!.score_raw} dari ${row!.score_max}, salah-lalu-benar ikut dihitung seperti bar; ${JSON.stringify(row!.boss)}`)
  const rows = await sql`select position, count(*)::int n from response where attempt_id = ${a.id} group by 1 order by 1`
  say(rows[0]!.n === 1, `${tag}: ketuk ganda pilihan hanya satu baris jawaban (${rows[0]!.n})`)
  console.log(`     teks: ${(await text(page)).slice(30, 330)}`)
}

/** Bahasa Indonesia: papan bos, bar di runner, hasil menang dan hasil kalah. */
async function idLook(page: Page, raka: string) {
  await sql`update auth.user_account set ui_lang = 'id' where id = ${raka}`
  await page.goto(`${BASE}/world/boss`)
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${OUT}/id-boss.png`, fullPage: true })
  console.log(`     papan: ${(await text(page)).slice(0, 420)}`)
  const [won] = await sql`select id from attempt where learner_id = ${raka} and ref_id like 'boss:%' and (result->'boss'->>'won')::boolean order by (result->'boss'->>'cardId') is null, created_at limit 1`
  const [lost] = await sql`select id from attempt where learner_id = ${raka} and ref_id like 'boss:%' and not (result->'boss'->>'won')::boolean limit 1`
  await page.goto(`${BASE}/world/boss/result/${won!.id}`)
  await page.waitForTimeout(3800)
  await page.screenshot({ path: `${OUT}/id-win.png`, fullPage: true })
  console.log(`     menang: ${(await text(page)).slice(0, 420)}`)
  await page.goto(`${BASE}/world/boss/result/${lost!.id}`)
  await page.waitForTimeout(2200)
  await page.screenshot({ path: `${OUT}/id-lose.png`, fullPage: true })
  console.log(`     kalah: ${(await text(page)).slice(0, 420)}`)
  await page.goto(`${BASE}/world/boss/start?b=clickerclaw`)
  await page.waitForURL((u) => u.pathname.startsWith('/run/'), { timeout: 30000 })
  await page.getByRole('progressbar').first().waitFor()
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/id-run.png` })
  console.log(`     runner: ${(await text(page)).slice(0, 300)}`)
  await sql`update auth.user_account set ui_lang = 'en' where id = ${raka}`
}

async function main() {
  const { raka, org } = await ids()
  const [was] = await sql`select screen_limit_min from learner_profile where user_id = ${raka}`
  const browser = await chromium.launch()
  const part = process.env.QA_PART ?? 'all'
  try {
    const ctx = await browser.newContext({ locale: 'en-GB', timezoneId: 'Asia/Jakarta', viewport: VIEW.phone, hasTouch: true, serviceWorkers: 'block' })
    await ctx.addInitScript(SPY)
    await ctx.addInitScript(HOOK)
    const page = await login(ctx, 'Raka')
    const errs = watch(page)
    if (part === 'all' || part === 'reload') await reloadLast(page, raka, 'clickerclaw', 'phone')
    if (part === 'all' || part === 'id') await idLook(page, raka)
    if (part === 'all' || part === 'retry') await retryMix(page, raka, 'mumblewump', 'phone')
    if (part === 'all' || part === 'boss') await bossThrough(page, raka, org, 'robot', 'phone')
    if (part === 'all' || part === 'qm') await quickMaths(page, raka, org, 'phone')
    say(errs.length === 0, `tanpa error ${JSON.stringify(errs.slice(0, 5))}`)
    // Indonesia: layar akhir dan pesan istirahat.
    if (part === 'all' || part === 'boss') {
      await sql`update auth.user_account set ui_lang = 'id' where id = ${raka}`
      await page.goto(`${BASE}/today/done`)
      await page.waitForTimeout(1500)
      await page.screenshot({ path: `${OUT}/phone-limit-done-id.png`, fullPage: true })
      console.log(`     /today/done id: ${(await text(page)).slice(0, 260)}`)
      await page.goto(`${BASE}/world/boss`)
      await page.waitForTimeout(1500)
      console.log(`     /world/boss id -> ${new URL(page.url()).pathname}: ${(await text(page)).slice(0, 260)}`)
      await sql`update auth.user_account set ui_lang = 'en' where id = ${raka}`
    }
    await ctx.close()
  } finally {
    await sql`update auth.user_account set ui_lang = 'en' where id = ${raka}`
    await sql`update learner_profile set screen_limit_min = ${was!.screen_limit_min} where user_id = ${raka}`
    await sql`update day_record set minutes = 1 where learner_id = ${raka} and date = ${today()}`
    await browser.close()
    await sql.end()
  }
}
main().catch((e) => {
  console.error(String(e).slice(0, 800))
  process.exit(1)
})
