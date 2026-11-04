// Soal yang dinilai orang: bicara, gambar, foto, lewat ketukan sungguhan dengan mikrofon palsu dan berkas foto.
import { mkdirSync, writeFileSync } from 'node:fs'
import { allItems } from './lib'
import { BASE, chromium, ids, layoutProbe, login, makeAttempt, PHONE, pollStatus, sql, TABLET } from './driver'

const OUT = 'C:/kw5/qa-soal/.kira-local/qa-manual'
mkdirSync(OUT, { recursive: true })
const say = (ok: boolean | string, msg: string) => console.log(`${ok === true ? 'OK  ' : ok === false ? 'BAD ' : `${ok} `} ${msg}`)
// PNG 1x1 yang sah.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')

async function main() {
  const items = allItems()
  const { org, raka } = await ids()
  const who = { org, id: raka }
  const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] })
  const ctx = await browser.newContext({ locale: 'en-GB', timezoneId: 'Asia/Jakarta', viewport: TABLET, hasTouch: true, permissions: ['microphone'] })
  const page = await login(ctx, 'Raka')
  const bad: string[] = []
  page.on('pageerror', (e) => bad.push(`pageerror ${e.message.slice(0, 160)}`))
  page.on('response', (r) => {
    if (r.status() >= 400 && !r.url().includes('/api/heartbeat')) bad.push(`${r.status()} ${r.url().replace(BASE, '')}`)
  })
  const photoFile = `${OUT}/foto.png`
  writeFileSync(photoFile, PNG)
  const pick = (type: string, prefix: string) => items.find((i) => i.type === type && i.id.startsWith(prefix))!
  for (const vp of [PHONE, TABLET]) {
    await page.setViewportSize(vp)
    // ---- Gambar
    {
      const it = pick('draw', 's4.')
      const id = await makeAttempt(who, [{ ref: it.id, difficulty: it.difficulty }], 'science')
      await page.goto(`${BASE}/run/${id}`)
      await page.locator('section[aria-label="Your drawing"]').waitFor()
      const issues = await layoutProbe(page)
      const canvas = page.locator('section[aria-label="Your drawing"] canvas').first()
      await canvas.scrollIntoViewIfNeeded()
      const b = (await canvas.boundingBox())!
      await page.mouse.move(b.x + 20, b.y + 20)
      await page.mouse.down()
      await page.mouse.move(b.x + 120, b.y + 90, { steps: 6 })
      await page.mouse.up()
      await page.screenshot({ path: `${OUT}/draw-${vp.width}.png` })
      await page.getByRole('button', { name: 'Send to tutor' }).click()
      const s = await pollStatus(id, 1, 1, 15000)
      say(s === 'pending', `gambar ${vp.width}: terkirim, status ${s}, tata letak ${JSON.stringify(issues.filter((x) => x.kind !== 'small-target').map((x) => x.kind))}`)
      await page.locator('[role=status] h2').first().waitFor({ timeout: 8000 })
      await page.screenshot({ path: `${OUT}/draw-sent-${vp.width}.png` })
    }
    // ---- Foto
    {
      const it = pick('photo', 'm3.')
      const id = await makeAttempt(who, [{ ref: it.id, difficulty: it.difficulty }], 'math')
      await page.goto(`${BASE}/run/${id}`)
      await page.getByRole('button', { name: 'Choose a photo' }).waitFor()
      await page.screenshot({ path: `${OUT}/photo-${vp.width}.png` })
      await page.locator('input[type=file]:not([capture])').setInputFiles(photoFile)
      await page.getByText(/Your photo is ready|Photo saved/).first().waitFor({ timeout: 15000 }).catch(() => undefined)
      const check = page.getByRole('button', { name: 'Send to tutor', exact: true })
      await page.waitForTimeout(400)
      await page.screenshot({ path: `${OUT}/photo-ready-${vp.width}.png` })
      const enabled = await check.isEnabled().catch(() => false)
      if (enabled) await check.click()
      const s = await pollStatus(id, 1, 1, 10000)
      say(s === 'pending', `foto ${vp.width}: tombol kirim ${enabled}, status ${s}`)
    }
    // ---- Bicara
    {
      const it = pick('speak', 'e4.')
      const id = await makeAttempt(who, [{ ref: it.id, difficulty: it.difficulty }], 'english')
      await page.goto(`${BASE}/run/${id}`)
      const rec = page.getByRole('button', { name: 'Record your answer' })
      await rec.waitFor({ timeout: 10000 }).catch(() => undefined)
      await page.screenshot({ path: `${OUT}/speak-${vp.width}.png` })
      if (await rec.isVisible().catch(() => false)) {
        await rec.click()
        await page.getByRole('button', { name: 'Stop recording' }).waitFor({ timeout: 10000 })
        await page.waitForTimeout(1200)
        await page.getByRole('button', { name: 'Stop recording' }).click()
        await page.getByRole('button', { name: 'Send to tutor' }).waitFor({ timeout: 10000 })
        await page.screenshot({ path: `${OUT}/speak-recorded-${vp.width}.png` })
        await page.getByRole('button', { name: 'Send to tutor' }).click()
        const s = await pollStatus(id, 1, 1, 15000)
        say(s === 'pending', `bicara ${vp.width}: terkirim, status ${s}`)
      } else {
        say(false, `bicara ${vp.width}: tombol rekam tidak muncul`)
      }
    }
  }
  // ---- Bicara tanpa izin mikrofon: ada jalan keluar.
  {
    const ctx2 = await browser.newContext({ locale: 'en-GB', timezoneId: 'Asia/Jakarta', viewport: PHONE, hasTouch: true })
    await ctx2.addInitScript(`navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('no', 'NotAllowedError'))`)
    const p2 = await login(ctx2, 'Raka')
    const it = pick('speak', 'e5.')
    const id = await makeAttempt(who, [{ ref: it.id, difficulty: it.difficulty }], 'english')
    await p2.goto(`${BASE}/run/${id}`)
    await p2.getByRole('button', { name: 'Record your answer' }).click({ timeout: 10000 })
    await p2.waitForTimeout(800)
    await p2.screenshot({ path: `${OUT}/speak-denied.png` })
    const skip = await p2.getByRole('button', { name: 'Skip this one' }).count()
    say(skip === 1, `mikrofon ditolak: ada tombol lewati (${skip})`)
    await ctx2.close()
  }
  say(bad.length === 0, `kesalahan ${JSON.stringify([...new Set(bad)].slice(0, 6))}`)
  await browser.close()
  await sql.end()
}
main().catch((e) => {
  console.error(String(e).slice(0, 500))
  process.exit(1)
})
