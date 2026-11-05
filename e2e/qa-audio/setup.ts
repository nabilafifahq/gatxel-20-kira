// Membuat keluarga uji suara: satu anak utama (UI English) dan satu anak per kelas 1 sampai 6.
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { OUT, learner, makeFamily, psql } from './lib'

async function main() {
  mkdirSync(OUT, { recursive: true })
  const stamp = Date.now().toString(36)
  const browser = await chromium.launch()
  const fam1 = [1, 2, 3, 4, 5].map((g) => ({ name: `Suara${g}${stamp}`, grade: g, uiLang: 'en' as const }))
  const fam2 = [{ name: `Suara6${stamp}`, grade: 6, uiLang: 'en' as const }, { name: `Audio${stamp}`, grade: 4, uiLang: 'en' as const }, { name: `Bunyi${stamp}`, grade: 3, uiLang: 'id' as const }]
  await makeFamily(browser, `tiga.audio.${stamp}.a@gmail.com`, fam1, `${OUT}/state-a.json`)
  await makeFamily(browser, `tiga.audio.${stamp}.b@gmail.com`, fam2, `${OUT}/state-b.json`)
  await browser.close()
  const kids = [...fam1.map((k) => ({ ...k, state: 'state-a.json' })), ...fam2.map((k) => ({ ...k, state: 'state-b.json' }))].map((k) => ({ ...k, ...learner(k.name) }))
  writeFileSync(`${OUT}/kids.json`, JSON.stringify(kids, null, 1))
  console.log(kids.map((k) => `${k.name} g${k.grade} ${k.uiLang}`).join('\n'))
  void psql
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
