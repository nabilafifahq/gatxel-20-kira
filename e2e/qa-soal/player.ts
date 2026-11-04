// Pembahasan bergerak: Play maju sendiri sampai langkah terakhir dan berhenti, tenang dengan reduced motion, gambar tidak terpotong.
import { mkdirSync } from 'node:fs'
import { allItems } from './lib'
import { answer, BASE, chromium, ids, layoutProbe, login, makeAttempt, PHONE, sql, TABLET } from './driver'
import type { Item } from '../../packages/content/src/schema'

const OUT = 'C:/kw5/qa-soal/.kira-local/qa-player'
mkdirSync(OUT, { recursive: true })
const say = (ok: boolean | string, msg: string) => console.log(`${ok === true ? 'OK  ' : ok === false ? 'BAD ' : `${ok} `} ${msg}`)

async function main() {
  const items = allItems().filter((i): i is Extract<Item, { type: 'mcq' }> => i.type === 'mcq' && !i.passage && i.lang !== 'id' && !!i.solution?.some((s) => s.anim))
  const picks = [items[0]!, items[Math.floor(items.length / 3)]!, items[Math.floor((2 * items.length) / 3)]!, items[items.length - 1]!]
  const { org, raka } = await ids()
  const who = { org, id: raka }
  const browser = await chromium.launch()
  for (const reduced of process.env.QA_REDUCED_ONLY ? [true] : [false, true]) {
    const ctx = await browser.newContext({ locale: 'en-GB', timezoneId: 'Asia/Jakarta', viewport: reduced ? PHONE : TABLET, hasTouch: true, ...(reduced ? { reducedMotion: 'reduce' as const } : {}) })
    const page = await login(ctx, 'Raka')
    for (const it of picks) {
      const tag = `${reduced ? 'reduced' : 'normal'}-${it.id}`
      const total = it.solution!.length
      const id = await makeAttempt(who, [{ ref: it.id, difficulty: it.difficulty }], 'math')
      await page.goto(`${BASE}/run/${id}`)
      await page.locator('section[aria-label="Your answer"]').waitFor()
      for (let t = 0; t < 2; t++) {
        await answer(page, it, false, { issues: [] })
        await page.getByRole('button', { name: 'Check', exact: true }).click()
        await page.locator('[role=status] h2', { hasText: /^Not yet$/ }).first().waitFor()
        if (t === 0) await page.getByRole('button', { name: 'Try again', exact: true }).click()
      }
      await page.getByRole('button', { name: /Watch how it works/ }).click({ timeout: 10000 })
      const dialog = page.getByRole('dialog')
      await dialog.getByText(new RegExp(`Step 1 of ${total}`)).first().waitFor({ timeout: 15000 })
      await page.waitForTimeout(300)
      const issues = (await layoutProbe(page)).filter((x) => x.kind !== 'small-target')
      const svgClip = await dialog.evaluate((d) => {
        const out: string[] = []
        for (const svg of Array.from(d.querySelectorAll('svg'))) {
          const sr = svg.getBoundingClientRect()
          if (sr.width < 60) continue
          for (const t of Array.from(svg.querySelectorAll('text'))) {
            const r = t.getBoundingClientRect()
            if (r.width > 0 && (r.left < sr.left - 1.5 || r.right > sr.right + 1.5 || r.top < sr.top - 1.5 || r.bottom > sr.bottom + 1.5)) out.push((t.textContent ?? '').slice(0, 20))
          }
        }
        return out
      })
      await page.screenshot({ path: `${OUT}/${tag}-1.png` })
      if (reduced) {
        const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && Number(a.effect?.getComputedTiming().duration ?? 0) > 200).length)
        say(running === 0, `${tag}: tanpa gerak panjang (${running})`)
        for (let s = 1; s < total; s++) await dialog.getByRole('button', { name: 'Next', exact: true }).click()
        await dialog.getByText(new RegExp(`Step ${total} of ${total}`)).first().waitFor({ timeout: 5000 })
        await page.screenshot({ path: `${OUT}/${tag}-end.png` })
        say(true, `${tag}: ${total} langkah lewat Next step`)
      } else {
        await dialog.getByRole('button', { name: 'Play', exact: true }).click()
        const started = Date.now()
        await dialog.getByText(new RegExp(`Step ${total} of ${total}`)).first().waitFor({ timeout: 60000 })
        await dialog.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 30000 })
        await page.screenshot({ path: `${OUT}/${tag}-end.png` })
        say(true, `${tag}: Play sampai langkah ${total} dan berhenti sendiri dalam ${Math.round((Date.now() - started) / 1000)} detik`)
      }
      say(svgClip.length === 0, `${tag}: gambar langkah tidak terpotong ${JSON.stringify(svgClip.slice(0, 4))} ${JSON.stringify(issues.slice(0, 2))}`)
      await dialog.getByRole('button', { name: 'Close', exact: true }).first().click()
      await page.waitForTimeout(150)
      say(await page.locator('[role=status]').getByRole('button', { name: /^(Next|Finish)$/ }).first().isVisible(), `${tag}: setelah ditutup tombol lanjut tetap bisa dipakai`)
    }
    await ctx.close()
  }
  await browser.close()
  await sql.end()
}
main().catch((e) => {
  console.error(String(e).slice(0, 500))
  process.exit(1)
})
