import { chromium, newCtx, OUT, say, signUp, sql, TABLET } from './lib'
async function main() {
  const b = await chromium.launch()
  const ctx = await newCtx(b, { viewport: TABLET, tag: 'smoke' })
  const page = await ctx.newPage()
  const f = await signUp(page, { grade: 1, name: 'Nara', lang: 'id' })
  say('INFO', JSON.stringify({ ...f, email: f.email }))
  await page.screenshot({ path: `${OUT}/g1-pick.png`, fullPage: true })
  await ctx.storageState({ path: `${OUT}/state-g1-device.json` })
  await b.close(); await sql.end()
}
main().catch((e) => { console.error(String(e).slice(0, 800)); process.exit(1) })
