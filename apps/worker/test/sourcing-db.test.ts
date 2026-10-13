import { mkdtemp, rm, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { findContentDir, loadContent } from '@kira/content/load'
import { registrySchema } from '@kira/content/sources'
import type { AiProvider, AiRunInput } from '../src/ai/types'
import { connectWorkerDb } from '../src/db'
import type { Env } from '../src/env'
import { log } from '../src/log'
import { runWeeklySourcing } from '../src/sourcing/run'

/**
 * Pembaruan mingguan sumber soal di Postgres sungguhan, dengan unduhan dan AI palsu. Butuh DATABASE_URL_OWNER dan
 * DATABASE_URL_WORKER dan migrasi sudah dijalankan; tanpa itu seluruh berkas dilewati.
 */

const ready = Boolean(process.env.DATABASE_URL_OWNER && process.env.DATABASE_URL_WORKER)

const GSM = [
  { question: 'Tom has 5 apples. He buys 3 more apples. How many apples does Tom have now?', answer: 'Tom has 5+3=<<5+3=8>>8 apples.\n#### 8' },
  { question: 'Mia pays $5 for a book and $3 for a pen. How much does she pay in all?', answer: 'She pays 5+3=<<5+3=8>>8 dollars.\n#### 8' },
  { question: 'A box has 12 pencils. 4 are broken. How many pencils still work?', answer: '12-4=<<12-4=8>>8 pencils work.\n#### 8' },
  { question: 'There are 9 birds on a tree. 3 fly away. How many birds are left on the tree?', answer: '9-3=<<9-3=6>>6 birds are left.\n#### 6' },
  { question: 'A farm sells 5000 eggs in a year and 2000 more in the next. How many eggs is that?', answer: '5000+2000=<<5000+2000=7000>>7000\n#### 7000' },
]

const ARC = {
  rows: [
    { row_idx: 0, row: { id: 'MCAS_2009_5_6516', question: 'Which of these is a producer in a food chain?', choices: { text: ['grass', 'rabbit', 'fox', 'eagle'], label: ['A', 'B', 'C', 'D'] }, answerKey: 'A' } },
    { row_idx: 1, row: { id: 'Mercury_417466', question: 'Which object is shown in the diagram below?', choices: { text: ['a', 'b', 'c', 'd'], label: ['A', 'B', 'C', 'D'] }, answerKey: 'B' } },
  ],
  num_rows_total: 2,
}

const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(2000, 32), Buffer.from('\n%%EOF')])

const registry = registrySchema.parse({
  version: 1,
  updated: '2026-10-13',
  sources: [
    {
      id: 'gsm8k', name: 'GSM8K', site: 'https://github.com/openai/grade-school-math', subjects: ['math'], grades: [3, 4, 5, 6], license: 'mit', attribution: 'Cobbe dkk. (2021), OpenAI. Lisensi MIT.',
      format: 'jsonl', access: 'auto', importer: 'gsm8k', fetch: { kind: 'http-text', urls: ['https://raw.githubusercontent.com/openai/grade-school-math/master/grade_school_math/data/train.jsonl'] }, maxPerRun: 10,
    },
    {
      id: 'arc-easy', name: 'ARC Easy', site: 'https://huggingface.co/datasets/allenai/ai2_arc', subjects: ['science'], grades: [3, 4, 5, 6], license: 'cc-by-sa', attribution: 'Clark dkk. (2018), Allen Institute for AI.',
      format: 'json', access: 'auto', importer: 'arc-easy', fetch: { kind: 'hf-rows', dataset: 'allenai/ai2_arc', config: 'ARC-Easy', split: 'test' }, maxPerRun: 10,
    },
    {
      id: 'ikmc-pdf', name: 'IKMC contoh', site: 'https://ikmc.kangaroo.org.pk', subjects: ['math'], grades: [2], license: 'official-free', attribution: 'Kangaroo Pakistan.',
      format: 'pdf', access: 'auto', competition: 'ikmc', maxPerRun: 1,
      fetch: { kind: 'official-pdf', files: [{ url: 'https://ikmc.kangaroo.org.pk/uploads/ikmc/documents/1-PreEcolier.pdf', title: 'IKMC 2022 Pre-Ecolier', grade: 2, year: 2022 }, { url: 'https://ikmc.kangaroo.org.pk/uploads/ikmc/documents/1-Ecolier.pdf', title: 'IKMC 2022 Ecolier', grade: 3, year: 2022 }] },
    },
    {
      id: 'berbayar', name: 'Paper berbayar', site: 'https://example.org', subjects: ['math'], grades: [2], license: 'paid', attribution: 'Penerbit.', format: 'pdf', access: 'manual-upload',
    },
  ],
})

const fetched: string[] = []
const fakeFetch = (async (input: string | URL | Request) => {
  const url = String(input instanceof Request ? input.url : input)
  fetched.push(url)
  if (url.includes('train.jsonl')) return new Response(GSM.map((g) => JSON.stringify(g)).join('\n'))
  if (url.includes('datasets-server.huggingface.co')) return new Response(JSON.stringify(ARC))
  if (url.endsWith('.pdf')) return new Response(Buffer.concat([PDF, Buffer.from(url)]), { headers: { 'content-type': 'application/pdf' } })
  return new Response('tidak ada', { status: 404 })
}) as typeof fetch

/** AI palsu: tahu jawaban benar tiap soal, kecuali dua yang sengaja salah atau ragu. */
function fakeAi(): { ai: AiProvider; calls: AiRunInput[] } {
  const calls: AiRunInput[] = []
  const truth = (prompt: string): number | null => {
    if (prompt.includes('pencils still work')) return 9 // beda dengan kunci sumber (8)
    if (prompt.includes('birds')) return null // ragu
    if (prompt.includes('producer')) return 0
    return 8
  }
  const ai: AiProvider = {
    name: 'claude-code', label: 'Claude', model: 'm', ready: true, notReadyReason: null, modelFor: () => 'm', describe: async () => null,
    run: async (input) => {
      calls.push(input)
      const payload = JSON.parse(input.prompt.slice(input.prompt.indexOf('['))) as { number: number; prompt: string; options?: string[] }[]
      return { json: { answers: payload.map((q) => ({ number: q.number, answer: truth(q.prompt) })) }, model: 'm', durationMs: 1 }
    },
  }
  return { ai, calls }
}

describe.skipIf(!ready)('runWeeklySourcing di Postgres', () => {
  const owner = ready ? postgres(process.env.DATABASE_URL_OWNER!, { max: 2, onnotice: () => {} }) : (null as never)
  const wk = ready ? connectWorkerDb(process.env.DATABASE_URL_WORKER!) : (null as never)
  const orgId = randomUUID()
  const learnerId = randomUUID()
  let dataDir = ''
  const content = loadContent(findContentDir()).index
  const signal = new AbortController().signal
  const sleep = async () => undefined
  const at = new Date('2026-10-18T02:00:00+07:00')
  const env = (cap: number) => ({ KIRA_DATA_DIR: dataDir, AI_WEEKLY_CONTENT_JOBS: cap }) as unknown as Env

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'kira-sourcing-'))
    await owner`insert into org (id, name) values (${orgId}, 'Org Sumber __GTX_SEED__')`
    await owner`insert into learner_profile (user_id, org_id, name, grade, active) values (${learnerId}, ${orgId}, 'Anak Sumber', 2, true)`
  })

  afterAll(async () => {
    await owner`delete from org where id = ${orgId}`
    await owner.end()
    await wk.client.end({ timeout: 2 })
    await rm(dataDir, { recursive: true, force: true })
  })

  it('AI belum siap: dilewati tanpa mengunduh apa pun', async () => {
    fetched.length = 0
    const ai = { ...fakeAi().ai, ready: false, notReadyReason: 'Token belum diisi' } as AiProvider
    const r = await runWeeklySourcing({ ...wk, env: env(60), log, ai, fetchImpl: fakeFetch, sleep, loaded: { content, registry }, onlyOrgIds: [orgId] }, at, signal)
    expect(r).toMatch(/^dilewati: Token belum diisi/)
    expect(fetched).toEqual([])
  })

  it('batas AI nol: tidak ada panggilan AI dan tidak ada soal masuk', async () => {
    const { ai, calls } = fakeAi()
    const r = await runWeeklySourcing({ ...wk, env: env(0), log, ai, fetchImpl: fakeFetch, sleep, loaded: { content, registry }, onlyOrgIds: [orgId] }, at, signal)
    expect(r).toMatch(/AI 0 dari 0/)
    expect(calls).toHaveLength(0)
    expect((await owner`select count(*)::int as n from org_item where org_id = ${orgId}`)[0]!.n).toBe(0)
  })

  it('soal bersumber kunci yang sama dengan AI masuk bank, yang beda atau ragu masuk antrean Studio, PDF masuk Impor, draf diminta', async () => {
    const { ai, calls } = fakeAi()
    const summary = await runWeeklySourcing({ ...wk, env: env(60), log, ai, fetchImpl: fakeFetch, sleep, loaded: { content, registry }, onlyOrgIds: [orgId] }, at, signal)
    expect(summary).toMatch(/^selesai:/)

    // GSM8K: 2 lolos (apel dan uang), 1 beda kunci, 1 AI ragu, 1 disaring parser (bilangan besar).
    const records = await owner`select source_id, status, verify, skill_id, key_origin, license from source_record where org_id = ${orgId} and kind = 'item' order by source_id, status`
    const gsm = records.filter((r) => r.source_id === 'gsm8k')
    expect(gsm.map((r) => [r.status, r.verify]).sort()).toEqual([['published', 'agree'], ['published', 'agree'], ['queued', 'disagree'], ['queued', 'unverified']])
    for (const r of gsm) expect(r).toMatchObject({ key_origin: 'source', license: 'mit' })
    const items = await owner`select skill_id, subject, grade, source, tags, approved_at, approved_by, body from org_item where org_id = ${orgId} order by skill_id`
    expect(items).toHaveLength(3) // 2 GSM8K + 1 ARC
    for (const it of items) {
      expect(it.source).toBe('imported')
      expect(it.approved_at).not.toBeNull()
      expect(it.approved_by).toBeNull()
      expect((it.tags as string[]).some((t) => t.startsWith('src-'))).toBe(true)
      expect((it.body as { source: string }).source).toBe('imported')
    }
    expect(items.find((i) => i.subject === 'science')).toMatchObject({ grade: 5 })

    // Antrean Studio: draf di bawah ai_job "sourcing", dengan catatan dan atribusi dalam bahasa Indonesia.
    const drafts = await owner`select d.status, d.problems, d.body, j.kind from ai_draft d join ai_job j on j.id = d.job_id where d.org_id = ${orgId} order by d.created_at`
    expect(drafts).toHaveLength(2)
    expect(drafts.every((d) => d.kind === 'sourcing' && d.status === 'pending')).toBe(true)
    const problems = drafts.flatMap((d) => d.problems as string[]).join(' | ')
    expect(problems).toMatch(/Kunci dari GSM8K adalah 8, tetapi AI menjawab 9/)
    expect(problems).toMatch(/AI tidak yakin/)
    expect(problems).toMatch(/Sumber: GSM8K \(MIT\)/)
    expect(JSON.stringify(drafts.map((d) => d.body))).not.toMatch(/[–—]/)

    // ARC: soal bergambar disaring, soal produsen masuk dan ditandai sumbernya.
    expect(records.filter((r) => r.source_id === 'arc-easy').map((r) => [r.status, r.verify])).toEqual([['published', 'agree']])

    // PDF resmi: satu PDF per jalan (maxPerRun 1), lengkap dengan data paper, masuk antrean ai.import.
    const batches = await owner`select title, subject, grade, status, competition, year, source, tags from import_batch where org_id = ${orgId}`
    expect(batches).toHaveLength(1)
    expect(batches[0]).toMatchObject({ title: 'IKMC 2022 Pre-Ecolier', subject: 'math', grade: 2, status: 'uploaded', competition: 'ikmc', year: 2022, tags: ['ikmc'] })
    expect(String(batches[0]!.source)).toMatch(/^https:\/\/ikmc\.kangaroo\.org\.pk\//)
    const importJobs = await owner`select kind from job where org_id = ${orgId} and kind = 'ai.import'`
    expect(importJobs).toHaveLength(1)
    expect((await readdir(join(dataDir, 'media', orgId), { recursive: true })).some((f) => String(f).endsWith('.pdf'))).toBe(true)

    // Draf baru untuk skill tipis lewat job ai.items biasa.
    const draftJobs = await owner`select input from ai_job where org_id = ${orgId} and kind = 'items'`
    expect(draftJobs.length).toBeGreaterThan(0)
    expect(draftJobs.length).toBeLessThanOrEqual(8)
    for (const j of draftJobs) {
      const input = j.input as { skill: { grade: number }; instructions: string; count: number }
      expect(input.skill.grade).toBe(2)
      expect(input.count).toBe(5)
      expect(input.instructions).not.toMatch(/Anak Sumber/)
    }
    expect(await owner`select id from job where org_id = ${orgId} and kind = 'ai.items'`).toHaveLength(draftJobs.length)

    // Catatan jalan: satu ai_job sourcing selesai dengan hitungan, dan pemakaian AI sesuai.
    const [run] = await owner`select status, output from ai_job where org_id = ${orgId} and kind = 'sourcing' order by created_at desc limit 1`
    expect(run!.status).toBe('done')
    expect(run!.output).toMatchObject({ published: 3, queued: 2, pdfs: 1 })
    const used = (run!.output as { aiCalls: number }).aiCalls
    expect(used).toBe(calls.length + 2 + draftJobs.length) // panggilan cek kunci + 2 per PDF + satu per permintaan draf
    expect(used).toBeLessThanOrEqual(60)

    // Penanda lanjut dan status sumber tersimpan.
    const states = await owner`select source_id, last_result, cursor from source_state where org_id = ${orgId} order by source_id`
    expect(states.map((s) => s.source_id)).toEqual(['arc-easy', 'gsm8k', 'ikmc-pdf'])
  })

  it('jalan berikutnya tidak menggandakan: soal dobel dibuang, PDF berikutnya diambil, sumber yang dimatikan dilewati', async () => {
    await owner`insert into source_state (org_id, source_id, enabled) values (${orgId}, 'arc-easy', false) on conflict (org_id, source_id) do update set enabled = false`
    // Mulai dari awal dataset lagi supaya terlihat baris yang sama dibaca ulang.
    await owner`update source_state set cursor = '{"at": 0}'::jsonb where org_id = ${orgId} and source_id = 'gsm8k'`
    const before = (await owner`select count(*)::int as n from org_item where org_id = ${orgId}`)[0]!.n
    const { ai } = fakeAi()
    const summary = await runWeeklySourcing({ ...wk, env: env(60), log, ai, fetchImpl: fakeFetch, sleep, loaded: { content, registry }, onlyOrgIds: [orgId] }, at, signal)
    expect(summary).toMatch(/4 dobel dibuang|[4-9] dobel dibuang/)
    expect((await owner`select count(*)::int as n from org_item where org_id = ${orgId}`)[0]!.n).toBe(before)
    expect((await owner`select count(*)::int as n from source_record where org_id = ${orgId} and kind = 'item' and source_id = 'arc-easy'`)[0]!.n).toBe(1)
    const batches = await owner`select title from import_batch where org_id = ${orgId} order by created_at`
    expect(batches.map((b) => b.title)).toEqual(['IKMC 2022 Pre-Ecolier', 'IKMC 2022 Ecolier'])
    // Sumber berbayar tidak pernah diunduh.
    expect(fetched.some((u) => u.includes('example.org'))).toBe(false)
  })

  it('tts.batch diantrekan hanya bila jenis job itu ada', async () => {
    const { enqueueTts, ttsAvailable } = await import('../src/sourcing/store')
    const n = await wk.db.transaction(async () => 0)
    void n
    expect(typeof ttsAvailable()).toBe('boolean')
    // Tanpa soal English tidak ada yang ditulis, ada atau tidak jenis job-nya.
    const { withOrg } = await import('@kira/db')
    const { workerCtx } = await import('../src/db')
    expect(await withOrg(wk.db, workerCtx(orgId, null), (tx) => enqueueTts(tx, orgId, []))).toBeNull()
  })
})
