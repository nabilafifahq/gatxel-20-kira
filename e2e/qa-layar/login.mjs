// Masuk sebagai anak contoh lewat perangkat terdaftar, lalu simpan cookie supaya semua pekerja memakainya.
export async function saveLearnerState(browser, base, file, name = 'Raka') {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(`${base}/masuk?next=${encodeURIComponent('/perangkat')}`)
  await page.getByLabel('Email').first().fill('tutor@contoh.test')
  await page.getByLabel('Password', { exact: true }).fill('kira-tutor-contoh-2026')
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/masuk'), { timeout: 45_000 })
  await page.goto(`${base}/perangkat`)
  await page.getByLabel('Nama tablet').fill(`QA layar ${Date.now()}`)
  await page.getByRole('checkbox', { name }).check()
  await page.getByRole('button', { name: 'Daftarkan tablet' }).click()
  await page.waitForURL((u) => u.pathname === '/', { timeout: 45_000 })
  await page.getByRole('link', { name: new RegExp(`^${name}, Grade`) }).click()
  await page.waitForURL((u) => u.pathname.startsWith('/pin/'))
  const pin = name === 'Aisha' ? ['Sun', 'Moon', 'Star', 'Cat'] : ['Tree', 'Apple', 'Boat', 'Ball']
  for (const p of pin) await page.getByRole('button', { name: p, exact: true }).click()
  await page.waitForURL((u) => u.pathname === '/today', { timeout: 45_000 })
  await ctx.storageState({ path: file })
  await ctx.close()
}

export async function saveAdultState(browser, base, file, email, password, next = '/keluarga') {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(`${base}/masuk?next=${encodeURIComponent(next)}`)
  await page.getByLabel('Email').first().fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/masuk'), { timeout: 45_000 })
  await ctx.storageState({ path: file })
  await ctx.close()
}
