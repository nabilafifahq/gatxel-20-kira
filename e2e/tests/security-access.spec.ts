import { expect, test } from '@playwright/test'
import { closeDb, createPracticeAttempt, db, internalStatuses, mcqItems } from './helpers'
import { api, createOrgB, dropOrgB, familyA, uploadPng, type OrgB } from './security-helpers'

/**
 * Kontrol akses: IDOR antar keluarga dan antar anak, naik peran, kebocoran kunci jawaban.
 * Setiap pelaku masuk lewat sesi yang dibuat langsung di database.
 */

let A: Awaited<ReturnType<typeof familyA>>
let B: OrgB
const UUID0 = '00000000-0000-4000-8000-000000000000'

test.beforeAll(async () => {
  A = await familyA()
  B = await createOrgB()
})

test.afterAll(async () => {
  await dropOrgB(B)
  await db()`delete from auth.session where user_agent = 'security-e2e'`
  await db()`delete from auth.device where name = 'security-e2e'`
  await closeDb()
})

test.describe('IDOR media', () => {
  test('berkas anak hanya terbuka untuk pemilik, orang tuanya, dan tutor', async () => {
    const attemptId = await createPracticeAttempt('Aisha', mcqItems('e2.', 2))
    const owner = await api(A.aisha)
    const up = await uploadPng(owner, attemptId)
    expect(up.status()).toBe(200)
    const { mediaId } = (await up.json()) as { mediaId: string }

    const get = async (who: Parameters<typeof api>[0]) => (await (await api(who)).get(`/api/media/${mediaId}`)).status()
    expect(await get(A.aisha)).toBe(200)
    expect(await get(A.mama)).toBe(200)
    expect(await get(A.tutor)).toBe(200)
    // Anak lain di keluarga yang sama, keluarga lain (anak dan orang tua), dan tanpa sesi.
    expect(await get(A.raka)).toBe(404)
    expect(await get(B.learner)).toBe(404)
    expect(await get(B.guardian)).toBe(404)
    expect(await get(null)).toBe(401)
  })

  test('unggahan ke attempt milik anak lain atau keluarga lain ditolak', async () => {
    const attemptId = await createPracticeAttempt('Aisha', mcqItems('e2.', 2))
    expect((await uploadPng(await api(A.raka), attemptId)).status()).toBe(403)
    expect((await uploadPng(await api(B.learner), attemptId)).status()).toBe(403)
    expect((await uploadPng(await api(B.learner), B.attemptId)).status()).toBe(403) // attempt miliknya tapi sudah dikumpulkan
  })
})

test.describe('IDOR halaman dan data', () => {
  test('hasil dan pembahasan attempt anak lain tidak tampil', async () => {
    const attemptId = await createPracticeAttempt('Aisha', mcqItems('e2.', 2))
    for (const who of [A.raka, B.learner]) {
      const ctx = await api(who)
      for (const path of [`/results/${attemptId}`, `/results/${attemptId}/review`, `/run/${attemptId}`]) {
        const res = await ctx.get(path, { maxRedirects: 0 })
        const body = await res.text()
        expect(res.status(), path).not.toBe(200)
        expect(body).not.toContain('E2E practice')
      }
    }
  })

  test('attempt keluarga B tidak terbaca dari keluarga A (anak, orang tua, tutor)', async () => {
    for (const who of [A.aisha, A.mama, A.tutor]) {
      const ctx = await api(who)
      for (const path of [`/results/${B.attemptId}`, `/results/${B.attemptId}/review`, `/run/${B.attemptId}`, `/konsol/learner/${B.learnerId}`, `/konsol/learner/${B.learnerId}/percobaan/${B.attemptId}`, `/cetak/paper/${B.attemptId}`]) {
        const res = await ctx.get(path, { maxRedirects: 0 })
        const body = await res.text()
        expect(body, path).not.toContain(B.attemptTitle)
        expect(body, path).not.toContain(B.noteBody)
        expect(body, path).not.toContain('Anak B')
      }
    }
  })

  test('konsol tutor A tidak menampilkan data keluarga B di halaman daftar', async () => {
    const ctx = await api(A.tutor)
    for (const path of ['/konsol', '/konsol/learner', '/konsol/hasil', '/konsol/laporan', '/konsol/rencana', '/konsol/pengaturan']) {
      const res = await ctx.get(path)
      const body = await res.text()
      expect(body, path).not.toContain('Anak B')
      expect(body, path).not.toContain(B.attemptTitle)
    }
  })

  test('halaman keluarga: orang tua A tidak melihat anak B', async () => {
    const ctx = await api(A.mama)
    for (const path of ['/keluarga', '/keluarga/privasi']) {
      const body = await (await ctx.get(path)).text()
      expect(body, path).not.toContain('Anak B')
    }
  })

  test('id yang tidak ada atau bukan UUID tidak menghasilkan 500', async () => {
    const ctx = await api(A.tutor)
    for (const path of [`/konsol/learner/${UUID0}`, '/konsol/learner/bukan-uuid', `/results/${UUID0}`, '/results/1;drop', `/cetak/paper/${UUID0}`]) {
      const res = await ctx.get(path, { maxRedirects: 0 })
      expect(res.status(), path).toBeLessThan(500)
    }
  })
})

test.describe('naik peran', () => {
  test('anak tidak bisa membuka konsol atau halaman orang tua', async () => {
    const ctx = await api(A.aisha)
    for (const path of ['/konsol', '/konsol/pengaturan', '/keluarga', '/keluarga/privasi', '/perangkat']) {
      const res = await ctx.get(path, { maxRedirects: 0 })
      const body = await res.text()
      expect([200, 301, 302, 303, 307, 308, 404], path).toContain(res.status())
      if (res.status() === 200) expect(body, path).not.toContain('Pengaturan konsol')
    }
  })

  test('orang tua tidak bisa membuka konsol tutor, API unggah PDF, atau sinkron anak', async () => {
    const ctx = await api(A.mama)
    const konsol = await ctx.get('/konsol', { maxRedirects: 0 })
    expect(konsol.status()).toBeGreaterThanOrEqual(300)
    const pdf = await ctx.post('/api/media', { multipart: { kind: 'pdf', file: { name: 'a.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF\n12345') } } })
    expect(pdf.status()).toBe(403)
    expect((await ctx.post('/api/sync', { data: { answers: [], submits: [] } })).status()).toBe(401)
    expect((await ctx.post('/api/heartbeat')).status()).toBe(401)
  })

  test('anak tidak bisa mengunggah PDF atau halaman kertas', async () => {
    const attemptId = await createPracticeAttempt('Aisha', mcqItems('e2.', 2))
    const ctx = await api(A.aisha)
    for (const kind of ['pdf', 'page']) {
      const res = await ctx.post('/api/media', { multipart: { kind, attemptId, file: { name: 'a.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF\n12345') } } })
      expect(res.status(), kind).toBe(403)
    }
  })

  test('sesi anak tidak bisa memanggil API internal tanpa token', async () => {
    const res = await (await api(A.aisha)).post('/api/internal/weekly-report', { data: { orgId: A.orgId, learnerId: A.aishaId, weekStart: '2026-11-02' } })
    expect(await internalStatuses(await api(A.aisha))).toContain(res.status())
  })
})

test.describe('kunci jawaban', () => {
  test('halaman run tes berwaktu tidak memuat jawaban, penjelasan, atau petunjuk', async () => {
    const items = mcqItems('e2.', 3)
    const attemptId = await createPracticeAttempt('Aisha', items, { mode: 'tes', timeLimitS: 600 })
    const ctx = await api(A.aisha)
    const res = await ctx.get(`/run/${attemptId}`)
    expect(res.status()).toBe(200)
    const html = await res.text()
    expect(html).not.toMatch(/\\?"answerIndex\\?"|\\?"correct\\?":\s*\d|\\?"explanation\\?"|\\?"solution\\?"|\\?"hints\\?":\s*\[\s*\\?"/)
    // Hasil dan pembahasan tidak ada sebelum dikumpulkan, juga lewat permintaan RSC.
    const rsc = await ctx.get(`/results/${attemptId}/review`, { headers: { RSC: '1' }, maxRedirects: 0 })
    expect((await rsc.text()).toLowerCase()).not.toContain('explanation')
  })

  test('menyimpan jawaban lewat /api/sync tidak mengembalikan benar atau salah untuk tes', async () => {
    const items = mcqItems('e2.', 2)
    const attemptId = await createPracticeAttempt('Aisha', items, { mode: 'tes', timeLimitS: 600 })
    const res = await (await api(A.aisha)).post('/api/sync', {
      data: { answers: [{ clientId: 'c1', attemptId, itemRef: items[0]!.id, position: 1, answer: { kind: 'mcq', choice: 0 }, ms: 1200 }], submits: [] },
    })
    expect(res.status()).toBe(200)
    const text = JSON.stringify(await res.json())
    expect(text).not.toMatch(/correct|explanation|solution/i)
  })
})

test.describe('mass assignment dan input', () => {
  test('/api/sync dan /api/tts/request menolak kolom tambahan', async () => {
    const a = await (await api(A.aisha)).post('/api/sync', { data: { answers: [], submits: [], role: 'tutor', orgId: B.orgId } })
    expect(a.status()).toBe(400)
    const t = await (await api(A.aisha)).post('/api/tts/request', { data: { clips: [{ text: 'hello', style: 'normal', orgId: B.orgId }] } })
    expect(t.status()).toBe(400)
  })

  test('semua Server Action memakai Zod .strict() pada objek input', async () => {
    const { readdirSync, readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const dir = join(process.cwd(), 'apps/web/src/server/actions')
    const lonely: string[] = []
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.ts'))) {
      const src = readFileSync(join(dir, f), 'utf8')
      const objects = (src.match(/z\s*\.object\(/g) ?? []).length
      const stricts = (src.match(/\.strict\(\)/g) ?? []).length
      if (stricts < objects) lonely.push(`${f}: ${objects} objek, ${stricts} strict`)
    }
    expect(lonely).toEqual([])
  })
})
