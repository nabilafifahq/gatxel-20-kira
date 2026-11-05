import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import { closeDb, createPracticeAttempt, db, learnerId, noHorizontalScroll, pinLogin, registerTablet, waitForPath, watchErrors } from './helpers'

/**
 * Terjemahan penjelasan: bahasa Inggris dulu, satu ketukan ke Indonesia, diingat per anak. Soal dan jawaban tetap Inggris.
 * Suara mengikuti bahasa teks: teks Indonesia hanya klip peran indonesian, tidak pernah suara perangkat.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SKILL = 'e1.capitals-full-stops'
const ITEM = 'e1.capitals-full-stops.001'
const hash = (en: string) => createHash('sha256').update(en, 'utf8').digest('hex').slice(0, 20)
const file = JSON.parse(readFileSync(join(ROOT, 'content/translations/id/english/g1/capitals-full-stops.json'), 'utf8')) as { entries: Record<string, { en: string; id: string }> }
const idOf = (en: string): string => {
  const e = file.entries[hash(en)]
  if (!e) throw new Error(`terjemahan tidak ada: ${en}`)
  return e.id
}

const FIRST_STEP = 'A sentence starts with a capital letter.'
const EXPLANATION = 'A sentence starts with a capital letter. My starts with a capital M.'

const toggle = (page: Page) => page.getByTestId('translate-toggle')
const shot = async (page: Page, name: string) => {
  if (process.env.E2E_SHOTS) await page.screenshot({ path: join(process.env.E2E_SHOTS, `${name}.png`) })
}

// Klip tiruan lewat page.route tidak melihat permintaan dari service worker.
test.use({ serviceWorkers: 'block' })

/** Hitung panggilan suara perangkat. Harus selalu nol. */
async function spyDeviceVoice(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __deviceVoice: number }
    w.__deviceVoice = 0
    if ('speechSynthesis' in window) {
      const synth = window.speechSynthesis
      const speak = synth.speak.bind(synth)
      synth.speak = (u: SpeechSynthesisUtterance) => {
        w.__deviceVoice++
        speak(u)
      }
    }
  })
}
const deviceVoiceCalls = (page: Page) => page.evaluate(() => (window as unknown as { __deviceVoice: number }).__deviceVoice)

/** Layanan klip tiruan: mencatat kunci yang diminta, dan klip hanya ada bila `clipsExist`. */
async function fakeClips(page: Page, clipsExist: boolean): Promise<string[]> {
  const asked: string[] = []
  await page.route('**/api/tts/today', (r) => r.fulfill({ json: { enabled: true, urls: [], voiceVersion: 'k1', idVoiceVersion: 'id-piper1' } }))
  await page.route('**/tts/*.mp3', (r) => {
    asked.push(new URL(r.request().url()).pathname.replace('/tts/', '').replace('.mp3', ''))
    return clipsExist ? r.fulfill({ status: 200, contentType: 'audio/mpeg', body: Buffer.alloc(800) }) : r.fulfill({ status: 404, body: '' })
  })
  return asked
}

const clipKey = (text: string, style: string, version: string) => createHash('sha256').update(`${version}\n${style}\n${text}`, 'utf8').digest('hex')

test.beforeEach(async () => {
  for (const name of ['Aisha', 'Raka'] as const) {
    const id = await learnerId(name)
    await db()`update auth.user_account set explain_id_first = false where id = ${id}`
  }
})

test.afterAll(async () => {
  await closeDb()
})

test('Pelajaran di layar 375: bahasa Inggris dulu, satu ketukan ke Indonesia, diingat per anak', async ({ page, context }) => {
  const errors = watchErrors(page)
  await page.setViewportSize({ width: 375, height: 812 })
  await registerTablet(page, ['Aisha', 'Raka'])
  await pinLogin(page, 'Aisha')
  await page.goto(`/lesson/${SKILL}`)

  const caption = page.locator('p[aria-live="polite"]')
  await expect(caption).toHaveAttribute('lang', 'en-GB')
  await expect(caption).toContainText(FIRST_STEP)
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false')

  await toggle(page).click()
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true')
  await expect(caption).toHaveAttribute('lang', 'id')
  await expect(caption).toHaveText(idOf(FIRST_STEP))
  await noHorizontalScroll(page)
  await shot(page, 'pelajaran-375')

  // Diingat saat halaman dibuka lagi.
  await page.reload()
  await expect(caption).toHaveText(idOf(FIRST_STEP))

  // Anak lain di perangkat yang sama mulai dari bahasa Inggris.
  await context.clearCookies({ name: '__Host-kira.session' })
  await context.clearCookies({ name: 'kira.session' })
  await pinLogin(page, 'Raka')
  await page.goto(`/lesson/${SKILL}`)
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false')
  await expect(caption).toContainText(FIRST_STEP)
  expect(errors).toEqual([])
})

test('Setelan orang tua: penjelasan bahasa Indonesia lebih dulu', async ({ page }) => {
  const id = await learnerId('Aisha')
  await db()`update auth.user_account set explain_id_first = true where id = ${id}`
  await registerTablet(page, ['Aisha'])
  await pinLogin(page, 'Aisha')
  await page.goto(`/lesson/${SKILL}`)
  await expect(page.locator('p[aria-live="polite"]')).toHaveText(idOf(FIRST_STEP))
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true')
})

test('Suara mengikuti bahasa: klip id untuk Indonesia, klip Inggris untuk Inggris, suara perangkat tidak pernah', async ({ page }) => {
  await spyDeviceVoice(page)
  const asked = await fakeClips(page, true)
  await registerTablet(page, ['Aisha'])
  await pinLogin(page, 'Aisha')
  await page.goto(`/lesson/${SKILL}`)

  const idKey = clipKey(idOf(FIRST_STEP), 'indonesian', 'id-piper1')
  const enKey = clipKey(FIRST_STEP, 'teacher', 'k1')

  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect.poll(() => asked.includes(enKey)).toBe(true)
  expect(asked).not.toContain(idKey)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()

  asked.length = 0
  await toggle(page).click()
  await expect.poll(() => asked.includes(idKey)).toBe(true)
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.waitForTimeout(500)
  // Setelah Indonesia aktif tidak ada klip Inggris yang diminta untuk kalimat ini, dan teks Inggris tidak pernah dipasangkan dengan peran indonesian.
  expect(asked).not.toContain(enKey)
  expect(asked).not.toContain(clipKey(FIRST_STEP, 'indonesian', 'id-piper1'))
  expect(asked).not.toContain(clipKey(idOf(FIRST_STEP), 'teacher', 'k1'))
  expect(await deviceVoiceCalls(page)).toBe(0)
})

test('Tanpa klip id tombol suara tersembunyi dan tidak ada suara pengganti', async ({ page }) => {
  await spyDeviceVoice(page)
  await fakeClips(page, false)
  await registerTablet(page, ['Aisha'])
  await pinLogin(page, 'Aisha')
  await page.goto(`/lesson/${SKILL}`)
  await expect(page.getByRole('button', { name: /^Sound/ })).toBeVisible()
  await toggle(page).click()
  await expect(page.getByRole('button', { name: /^Sound/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.waitForTimeout(500)
  expect(await deviceVoiceCalls(page)).toBe(0)
})

test('Ulasan singkat: tombol terjemahan mengganti langkahnya', async ({ page }) => {
  const id = await learnerId('Aisha')
  const org = (await db()`select org_id from learner_profile where user_id = ${id}`)[0]!.org_id as string
  await db()`insert into skill_state (learner_id, org_id, skill_id, lesson_done_at) values (${id}, ${org}, ${SKILL}, now()) on conflict (learner_id, skill_id) do update set lesson_done_at = now()`
  await registerTablet(page, ['Aisha'])
  await pinLogin(page, 'Aisha')
  await page.goto(`/practice/review/${SKILL}`)
  await expect(page.getByText(FIRST_STEP, { exact: true })).toBeVisible()
  await toggle(page).click()
  await expect(page.getByText(idOf(FIRST_STEP), { exact: true })).toBeVisible()
  await expect(page.getByText(FIRST_STEP, { exact: true })).toHaveCount(0)
  await shot(page, 'ulasan')
})

test('Lembar umpan balik: penjelasan diterjemahkan setelah menjawab, soal dan jawaban tetap Inggris', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  const attemptId = await createPracticeAttempt('Aisha', [{ id: ITEM, difficulty: 1 }])
  await registerTablet(page, ['Aisha'])
  await pinLogin(page, 'Aisha')
  await page.goto(`/run/${attemptId}`)
  // Sebelum menjawab tombolnya belum ada.
  await expect(toggle(page)).toHaveCount(0)
  const option = page.getByRole('radio', { name: /My cat is grey/ }).or(page.getByRole('button', { name: /My cat is grey/ })).first()
  await option.click()
  await page.getByRole('button', { name: 'Check', exact: true }).click()
  await expect(page.getByText(EXPLANATION, { exact: true })).toBeVisible()
  await toggle(page).click()
  await expect(page.getByText(idOf(EXPLANATION), { exact: true })).toBeVisible()
  // Pilihan jawaban tidak ikut diterjemahkan.
  await expect(page.getByText('My cat is grey.').first()).toBeAttached()
  await noHorizontalScroll(page)
  await shot(page, 'umpan-balik-375')
})

test('Tes berwaktu: terjemahan tidak terkirim sebelum dikumpulkan, muncul di pembahasan sesudahnya', async ({ page }) => {
  const attemptId = await createPracticeAttempt('Aisha', [{ id: ITEM, difficulty: 1 }], { mode: 'tes', timeLimitS: 600 })
  await registerTablet(page, ['Aisha'])
  await pinLogin(page, 'Aisha')
  const res = await page.goto(`/run/${attemptId}`)
  const html = await res!.text()
  expect(html).not.toContain(idOf(EXPLANATION))
  expect(html).not.toContain('explanationId')
  await expect(toggle(page)).toHaveCount(0)

  await db()`update attempt set status = 'submitted', submitted_at = now(), score_raw = 0, score_max = 1 where id = ${attemptId}`
  await page.goto(`/results/${attemptId}/review`)
  await waitForPath(page, (p) => p.endsWith('/review'))
  await expect(page.getByText(EXPLANATION, { exact: true })).toBeVisible()
  await page.setViewportSize({ width: 375, height: 812 })
  await toggle(page).first().click()
  await expect(page.getByText(idOf(EXPLANATION), { exact: true })).toBeVisible()
  await noHorizontalScroll(page)
  await shot(page, 'pembahasan-375')
})
