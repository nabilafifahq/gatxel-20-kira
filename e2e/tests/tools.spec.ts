import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import { fittingOrientations, PIECE_NAME, type PieceType, type Pt } from '../../packages/content/src/manip'
import { closeDb, createPracticeAttempt, db, expectNoSeriousA11y, noHorizontalScroll, pinLogin, registerTablet, waitForPath, watchErrors } from './helpers'

test.afterAll(closeDb)

const ROOT = fileURLToPath(new URL('../..', import.meta.url))

type Tangram = { id: string; type: string; pieces: PieceType[]; slots: Pt[][] }
type Geo = { id: string; type: string; example: [number, number][] }
function firstOf<T extends { type: string }>(file: string, type: string): T {
  const j = JSON.parse(readFileSync(`${ROOT}/content/items/math/${file}`, 'utf8')) as { items: T[] }
  return j.items.find((i) => i.type === type)!
}

/** Id soal pertama di berkas alat peraga (nomor soal ditentukan saat penggabungan, jadi jangan ditulis tangan). */
function firstId(file: string): string {
  return (JSON.parse(readFileSync(`${ROOT}/content/items/math/${file}`, 'utf8')) as { items: { id: string }[] }).items[0]!.id
}

/** Susun tangram lewat ketukan, memakai orientasi yang dihitung dari soal. */
async function solveTangram(page: Page, item: Tangram) {
  const used = new Set<number>()
  for (let s = 0; s < item.slots.length; s++) {
    for (let p = 0; p < item.pieces.length; p++) {
      if (used.has(p)) continue
      const o = fittingOrientations(item.pieces[p]!, item.slots[s]!)[0]
      if (!o) continue
      used.add(p)
      const tray = page.getByRole('group', { name: 'Tray of pieces' })
      await tray.getByRole('button', { name: new RegExp(`^${PIECE_NAME[item.pieces[p]!]}`) }).first().click()
      for (let r = 0; r < o.rot; r++) await page.getByRole('button', { name: 'Turn', exact: true }).click()
      if (o.flip) await page.getByRole('button', { name: 'Flip', exact: true }).click()
      // Titik tengah kotak batas segitiga siku-siku jatuh di sisi miringnya, jadi kirim ketukan langsung ke tempat itu.
      await page.getByRole('button', { name: new RegExp(`^Place ${s + 1} of ${item.slots.length}`) }).dispatchEvent('click')
      break
    }
  }
}

const peg = (page: Page, x: number, y: number) => page.getByRole('button', { name: new RegExp(`^Peg column ${x + 1}, row ${y + 1}(,|$)`) })

test('Maths Tools: lima alat bisa dimainkan dengan ketukan saja, tanpa pelanggaran aksesibilitas', async ({ page }) => {
  const errors = watchErrors(page)
  await registerTablet(page, ['Aisha'])
  await pinLogin(page, 'Aisha')

  await page.getByRole('navigation', { name: 'Main' }).first().getByRole('link', { name: 'Maths Tools' }).click()
  await waitForPath(page, (p) => p === '/tools')
  await expect(page.getByRole('heading', { level: 1, name: 'Maths Tools' })).toBeVisible()

  // Balok: tambah 10 satuan, tukar jadi 1 puluhan.
  for (let i = 0; i < 10; i++) await page.getByRole('button', { name: 'Add one one', exact: true }).click()
  await expect(page.getByText('10 is 0 hundreds, 0 tens, 10 ones')).toBeVisible()
  await page.getByRole('button', { name: 'Trade 10 for 1 ten' }).click()
  await expect(page.getByText('10 is 0 hundreds, 1 ten, 0 ones')).toBeVisible()
  await page.getByRole('button', { name: 'Break 1 into 10 ones' }).click()
  await expect(page.getByText('10 is 0 hundreds, 0 tens, 10 ones')).toBeVisible()
  await expectNoSeriousA11y(page, 'tools blocks')

  // Batang pecahan: potong jadi 4, arsir 2, bandingkan dengan batang kedua.
  await page.getByRole('radio', { name: 'Fraction bars' }).click()
  await page.getByRole('radio', { name: '4', exact: true }).first().click()
  await page.getByRole('button', { name: 'Part 2 of 4', exact: true }).first().click()
  await expect(page.getByText('2/4').first()).toBeVisible()
  await expectNoSeriousA11y(page, 'tools fractions')

  // Model batang: tambah satu batang, beri label, tambah unit.
  await page.getByRole('radio', { name: 'Bar models' }).click()
  await page.getByRole('button', { name: 'Add bar' }).click()
  await page.getByRole('radio', { name: 'Bar A' }).click()
  await page.getByRole('button', { name: 'More units in bar 1' }).click()
  await expect(page.getByText('2 units').first()).toBeVisible()
  await expectNoSeriousA11y(page, 'tools bar model')

  // Tangram: dua segitiga besar.
  await page.getByRole('radio', { name: 'Tangram' }).click()
  await page.getByRole('radio', { name: 'Two triangles' }).click()
  await page.getByRole('group', { name: 'Tray of pieces' }).getByRole('button').first().click()
  await page.getByRole('button', { name: /^Place 1 of 2/ }).click()
  await expect(page.getByText(/1 of 2 placed/)).toBeVisible()
  await expectNoSeriousA11y(page, 'tools tangram')

  // Geoboard: persegi panjang 3 kali 2.
  await page.getByRole('radio', { name: 'Geoboard' }).click()
  for (const [x, y] of [[0, 0], [3, 0], [3, 2], [0, 2], [0, 0]] as const) await peg(page, x, y).click()
  await expect(page.getByText('4 sides, perimeter 10, area 6 square units')).toBeVisible()
  await expectNoSeriousA11y(page, 'tools geoboard')

  await noHorizontalScroll(page)
  expect(errors.filter((e) => !e.includes('favicon'))).toEqual([])
})

test('Maths Tools di layar HP: tidak bergeser ke samping dan targetnya cukup besar', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await registerTablet(page, ['Aisha'])
  await pinLogin(page, 'Aisha')
  await page.goto('/tools')
  await expect(page.getByRole('heading', { level: 1, name: 'Maths Tools' })).toBeVisible()
  for (const name of ['Fraction bars', 'Bar models', 'Tangram', 'Geoboard']) {
    await page.getByRole('radio', { name }).click()
    await noHorizontalScroll(page)
  }
  const box = await page.getByRole('radio', { name: 'Geoboard' }).boundingBox()
  expect(box!.height).toBeGreaterThanOrEqual(44)
})

test('soal alat peraga di latihan: lima jenis dijawab dengan ketukan dan dinilai di server', async ({ page }) => {
  const errors = watchErrors(page)
  const tangram = firstOf<Tangram>('g1/shapes-2d.tools.json', 'tangram')
  const geo = firstOf<Geo>('g2/shapes-2d.tools.json', 'geoboard')
  const refs = [
    { id: firstId('g2/place-value.tools.json'), difficulty: 1 },
    { id: firstId('g1/halves.tools.json'), difficulty: 1 },
    { id: firstId('g2/addition.tools.json'), difficulty: 1 },
    { id: tangram.id, difficulty: 1 },
    { id: geo.id, difficulty: 1 },
  ]
  const attemptId = await createPracticeAttempt('Aisha', refs)
  await registerTablet(page, ['Aisha'])
  await pinLogin(page, 'Aisha')
  await page.goto(`/run/${attemptId}`)
  await expect(page.getByText('Question 1 of 5')).toBeVisible()

  const check = async () => {
    await page.getByRole('button', { name: 'Check', exact: true }).click()
    await expect(page.getByText(/correct/i).first()).toBeVisible()
    await page.getByRole('button', { name: /^(Next|Finish)$/ }).click()
  }

  // 1. Balok: 47 = 4 puluhan dan 7 satuan.
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Add one ten', exact: true }).click()
  for (let i = 0; i < 7; i++) await page.getByRole('button', { name: 'Add one one', exact: true }).click()
  await expectNoSeriousA11y(page, 'runner blocks')
  await check()

  // 2. Batang pecahan: setengah.
  await page.getByRole('button', { name: 'Part 1 of 2', exact: true }).click()
  await check()

  // 3. Model batang: Red beads 6 dan Blue beads 3.
  await page.getByRole('button', { name: 'Add bar' }).click()
  await page.getByRole('radio', { name: 'Red beads' }).first().click()
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'More units in bar 1' }).click()
  await page.getByRole('button', { name: 'Add bar' }).click()
  await page.getByRole('radio', { name: 'Blue beads' }).last().click()
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'More units in bar 2' }).click()
  await expectNoSeriousA11y(page, 'runner bar model')
  await check()

  // 4. Tangram.
  await solveTangram(page, tangram)
  await expectNoSeriousA11y(page, 'runner tangram')
  await check()

  // 5. Geoboard: bentuk contoh dari soal, lalu ketuk pasak pertama untuk menutup.
  for (const [x, y] of [...geo.example, geo.example[0]!]) await peg(page, x, y).click()
  await expectNoSeriousA11y(page, 'runner geoboard')
  await page.getByRole('button', { name: 'Check', exact: true }).click()
  await expect(page.getByText(/correct/i).first()).toBeVisible()
  await page.getByRole('button', { name: /^(Next|Finish)$/ }).click()

  await waitForPath(page, (p) => p === `/results/${attemptId}`)
  const rows = await db()`select position, status from response where attempt_id = ${attemptId} order by position`
  expect(rows.map((r) => r.status)).toEqual(['correct', 'correct', 'correct', 'correct', 'correct'])
  await noHorizontalScroll(page)
  expect(errors.filter((e) => !e.includes('favicon'))).toEqual([])
})

test('pelajaran dengan alat: langkah coba sendiri dan soal cek balok', async ({ page }) => {
  await registerTablet(page, ['Aisha'])
  await pinLogin(page, 'Aisha')
  await page.goto('/lesson/m2.place-value')
  const next = page.getByRole('button', { name: 'Next part' })
  // Empat langkah penjelasan, lalu langkah alat.
  for (let i = 0; i < 4; i++) await next.click()
  await expect(page.getByRole('button', { name: 'Trade 10 for 1 ten' })).toBeVisible()
  await page.getByRole('button', { name: 'Trade 10 for 1 ten' }).click()
  await expect(page.getByText('63 is 6 tens, 3 ones')).toBeVisible()
  await expectNoSeriousA11y(page, 'lesson tool step')
})
