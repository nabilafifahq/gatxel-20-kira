import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import postgres from 'postgres'
import { randomUUID } from 'node:crypto'

/**
 * Tes RLS dan hak akses tabel migrasi 0009: paper_library, paper_pick, program_run, source_record, source_state,
 * kolom metadata import_batch, dan kebijakan media jenis figure. Butuh DATABASE_URL_OWNER, _APP, _WORKER dan migrasi.
 */

const urls = { owner: process.env.DATABASE_URL_OWNER, app: process.env.DATABASE_URL_APP, worker: process.env.DATABASE_URL_WORKER }
const ready = Object.values(urls).every(Boolean)
const conn = (u: string | undefined) => postgres(u!, { max: 2, onnotice: () => {} })

describe.skipIf(!ready)('pustaka paper, Buku Salah, program, dan sumber soal (migrasi 0009)', () => {
  const owner = ready ? conn(urls.owner) : (null as never)
  const app = ready ? conn(urls.app) : (null as never)
  const worker = ready ? conn(urls.worker) : (null as never)

  const orgA = randomUUID()
  const orgB = randomUUID()
  const tutorA = randomUUID()
  const guardianA = randomUUID()
  const learnerA1 = randomUUID()
  const learnerA2 = randomUUID()
  const learnerB = randomUUID()
  const libraryA = randomUUID()
  const figureId = randomUUID()
  const pdfId = randomUUID()

  async function as<T>(db: postgres.Sql, ctx: { org?: string; user?: string; role?: string }, fn: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
    return (await db.begin(async (tx) => {
      if (ctx.org) await tx`select set_config('app.org_id', ${ctx.org}, true)`
      if (ctx.user) await tx`select set_config('app.user_id', ${ctx.user}, true)`
      if (ctx.role) await tx`select set_config('app.role', ${ctx.role}, true)`
      return fn(tx)
    })) as T
  }
  const tutor = { org: orgA, user: tutorA, role: 'tutor' }
  const learner1 = { org: orgA, user: learnerA1, role: 'learner' }
  const guardian = { org: orgA, user: guardianA, role: 'guardian' }

  beforeAll(async () => {
    await owner`insert into org (id, name) values (${orgA}, 'Org A __GTX_SEED__'), (${orgB}, 'Org B __GTX_SEED__')`
    await owner`insert into member_profile (user_id, org_id, name, role, email) values
      (${tutorA}, ${orgA}, 'Tutor A', 'tutor', 'tutor-pl@example.test'), (${guardianA}, ${orgA}, 'Mama A', 'guardian', 'mama-pl@example.test')`
    await owner`insert into learner_profile (user_id, org_id, name, grade, active) values
      (${learnerA1}, ${orgA}, 'Anak A1', 2, true), (${learnerA2}, ${orgA}, 'Anak A2', 2, true), (${learnerB}, ${orgB}, 'Anak B', 2, true)`
    await owner`insert into guardian_link (org_id, guardian_id, learner_id) values (${orgA}, ${guardianA}, ${learnerA1})`
    await owner`insert into paper_library (id, org_id, origin, competition, year, subject, grade, section, title, minutes, source, item_refs, created_by)
      values (${libraryA}, ${orgA}, 'official', 'ikmc', 2023, 'math', 2, 'A', 'IKMC 2023, Grade 2, part A', 25, 'unggahan tutor', array['org:a','org:b','org:c'], ${tutorA})`
    await owner`insert into media (id, org_id, kind, path, mime, size, sha256, created_by) values
      (${figureId}, ${orgA}, 'figure', 'x/figure.png', 'image/png', 10, 'abc', ${tutorA}),
      (${pdfId}, ${orgA}, 'pdf', 'x/paper.pdf', 'application/pdf', 10, 'def', ${tutorA})`
  })

  afterAll(async () => {
    await owner`delete from org where id in (${orgA}, ${orgB})`
    await Promise.all([owner.end(), app.end(), worker.end()])
  })

  it('kolom metadata paket impor ada dan tahun di luar rentang ditolak', async () => {
    const mediaId = randomUUID()
    await owner`insert into media (id, org_id, kind, path, mime, size, sha256, created_by) values (${mediaId}, ${orgA}, 'pdf', 'x/y.pdf', 'application/pdf', 1, 'z', ${tutorA})`
    await owner`insert into import_batch (org_id, title, subject, grade, media_id, created_by, competition, year, section, original_minutes, source)
      values (${orgA}, 'Paket', 'math', 2, ${mediaId}, ${tutorA}, 'ikmc', 2023, 'A', 40, 'unggahan tutor')`
    await expect(
      owner`insert into import_batch (org_id, title, subject, grade, media_id, created_by, year) values (${orgA}, 'Rusak', 'math', 2, ${mediaId}, ${tutorA}, 1999)`,
    ).rejects.toThrow(/import_batch_year_ck/)
  })

  it('pustaka paper: semua peran org membaca, hanya tutor menulis, org lain tidak melihat', async () => {
    for (const ctx of [tutor, learner1, guardian]) {
      const rows = await as(app, ctx, (tx) => tx`select id from paper_library`)
      expect(rows.map((r) => r.id)).toEqual([libraryA])
    }
    await expect(
      as(app, learner1, (tx) => tx`insert into paper_library (org_id, subject, grade, title, minutes, source, item_refs, created_by) values (${orgA}, 'math', 2, 'x', 10, 's', array['a'], ${learnerA1})`),
    ).rejects.toThrow(/row-level security/)
    await as(app, tutor, (tx) => tx`insert into paper_library (org_id, subject, grade, title, minutes, source, item_refs, created_by) values (${orgA}, 'math', 2, 'Tutor', 10, 's', array['a'], ${tutorA})`)
    await expect(as(app, learner1, (tx) => tx`update paper_library set minutes = 1`)).resolves.toBeDefined()
    const unchanged = await as(app, tutor, (tx) => tx`select minutes from paper_library where id = ${libraryA}`)
    expect(unchanged[0]!.minutes).toBe(25)
    const other = await as(app, { org: orgB, user: randomUUID(), role: 'tutor' }, (tx) => tx`select count(*)::int as n from paper_library`)
    expect(other[0]!.n).toBe(0)
  })

  it('satu baris pustaka per paket impor', async () => {
    const batch = randomUUID()
    await owner`insert into paper_library (org_id, import_batch_id, subject, grade, title, minutes, source, item_refs, created_by) values (${orgA}, ${batch}, 'math', 2, 'a', 10, 's', array['a'], ${tutorA})`
    await expect(
      owner`insert into paper_library (org_id, import_batch_id, subject, grade, title, minutes, source, item_refs, created_by) values (${orgA}, ${batch}, 'math', 2, 'b', 10, 's', array['b'], ${tutorA})`,
    ).rejects.toThrow(/paper_library_batch_uq/)
  })

  it('pilihan paper harian: learner menulis miliknya, tidak milik learner lain, orang tua hanya membaca', async () => {
    const insert = (learner: string, date: string) =>
      (tx: postgres.TransactionSql) =>
        tx`insert into paper_pick (org_id, learner_id, date, subject, kind, origin, title, minutes, source, item_refs)
          values (${orgA}, ${learner}, ${date}, 'math', 'mini', 'kira-made', 'Kira mini', 15, 'Kira-made', array['m2.oly-patterns.001'])`
    await as(app, learner1, insert(learnerA1, '2026-10-13'))
    await expect(as(app, learner1, insert(learnerA2, '2026-10-13'))).rejects.toThrow(/row-level security/)
    await expect(as(app, guardian, insert(learnerA1, '2026-10-14'))).rejects.toThrow(/row-level security/)
    // Satu pilihan per learner, tanggal, mapel, dan jenis.
    await expect(as(app, learner1, insert(learnerA1, '2026-10-13'))).rejects.toThrow(/paper_pick_day_uq/)
    const seen = await as(app, guardian, (tx) => tx`select learner_id from paper_pick`)
    expect(seen.map((r) => r.learner_id)).toEqual([learnerA1])
    const other = await as(app, { org: orgA, user: learnerA2, role: 'learner' }, (tx) => tx`select count(*)::int as n from paper_pick`)
    expect(other[0]!.n).toBe(0)
  })

  it('program olimpiade: learner dan orang tua membaca, hanya tutor menulis', async () => {
    await as(app, tutor, (tx) => tx`insert into program_run (org_id, learner_id, program_id, start_date, end_date, created_by) values (${orgA}, ${learnerA1}, 'olimpiade-math-g2', '2026-10-20', '2026-12-14', ${tutorA})`)
    expect((await as(app, learner1, (tx) => tx`select program_id from program_run`)).map((r) => r.program_id)).toEqual(['olimpiade-math-g2'])
    expect((await as(app, guardian, (tx) => tx`select program_id from program_run`)).length).toBe(1)
    expect((await as(app, { org: orgA, user: learnerA2, role: 'learner' }, (tx) => tx`select program_id from program_run`)).length).toBe(0)
    await expect(
      as(app, learner1, (tx) => tx`insert into program_run (org_id, learner_id, program_id, start_date, end_date, created_by) values (${orgA}, ${learnerA1}, 'x', '2026-10-20', '2026-12-14', ${learnerA1})`),
    ).rejects.toThrow(/row-level security/)
    await expect(as(app, learner1, (tx) => tx`delete from program_run`)).resolves.toBeDefined()
    expect((await as(app, tutor, (tx) => tx`select id from program_run`)).length).toBe(1)
  })

  it('catatan sumber: hanya tutor dan worker, worker menulis, kira_app tidak bisa menyisipkan', async () => {
    const hash = 'h'.repeat(64)
    await as(worker, { org: orgA, user: '00000000-0000-4000-8000-000000000000', role: 'worker' }, (tx) =>
      tx`insert into source_record (org_id, source_id, kind, content_hash, body, license, attribution) values (${orgA}, 'gsm8k', 'item', ${hash}, '{}'::jsonb, 'mit', 'Cobbe dkk.')`,
    )
    expect((await as(app, tutor, (tx) => tx`select source_id from source_record`)).map((r) => r.source_id)).toEqual(['gsm8k'])
    expect((await as(app, learner1, (tx) => tx`select source_id from source_record`)).length).toBe(0)
    await expect(
      as(app, tutor, (tx) => tx`insert into source_record (org_id, source_id, kind, content_hash, body, license, attribution) values (${orgA}, 'x', 'item', 'y', '{}'::jsonb, 'mit', 'a')`),
    ).rejects.toThrow(/permission denied/)
    // Dobel di org yang sama ditolak oleh kunci unik; org lain boleh.
    await expect(
      owner`insert into source_record (org_id, source_id, kind, content_hash, body, license, attribution) values (${orgA}, 'asdiv', 'item', ${hash}, '{}'::jsonb, 'cc-by-nc', 'Miao')`,
    ).rejects.toThrow(/source_record_hash_uq/)
    await owner`insert into source_record (org_id, source_id, kind, content_hash, body, license, attribution) values (${orgB}, 'asdiv', 'item', ${hash}, '{}'::jsonb, 'cc-by-nc', 'Miao')`
    await expect(
      owner`insert into source_record (org_id, source_id, kind, content_hash, body, license, attribution, status) values (${orgA}, 'q', 'item', 'k', '{}'::jsonb, 'mit', 'a', 'bogus')`,
    ).rejects.toThrow(/source_record_status_ck/)
  })

  it('status sumber: tutor menyalakan dan mematikan, worker menyimpan penanda lanjut', async () => {
    await as(app, tutor, (tx) => tx`insert into source_state (org_id, source_id, enabled) values (${orgA}, 'gsm8k', false)`)
    await as(worker, { org: orgA, user: '00000000-0000-4000-8000-000000000000', role: 'worker' }, (tx) =>
      tx`update source_state set cursor = '{"at": 480}'::jsonb, last_run_at = now() where source_id = 'gsm8k'`,
    )
    const rows = await as(app, tutor, (tx) => tx`select enabled, cursor from source_state`)
    expect(rows[0]).toMatchObject({ enabled: false, cursor: { at: 480 } })
    expect((await as(app, learner1, (tx) => tx`select * from source_state`)).length).toBe(0)
    await expect(as(app, tutor, (tx) => tx`delete from source_state`)).rejects.toThrow(/permission denied/)
  })

  it('media jenis figure terlihat oleh learner dan orang tua, berkas lain milik org tetap tertutup', async () => {
    for (const ctx of [learner1, guardian]) {
      expect((await as(app, ctx, (tx) => tx`select id from media where id = ${figureId}`)).length).toBe(1)
      expect((await as(app, ctx, (tx) => tx`select id from media where id = ${pdfId}`)).length).toBe(0)
    }
    expect((await as(app, tutor, (tx) => tx`select id from media where id in (${figureId}, ${pdfId})`)).length).toBe(2)
    await expect(
      as(app, learner1, (tx) => tx`insert into media (org_id, kind, path, mime, size, sha256, created_by) values (${orgA}, 'figure', 'p', 'image/png', 1, 's', ${learnerA1})`),
    ).rejects.toThrow(/row-level security/)
  })

  it('menghapus learner ikut menghapus pilihan paper dan program miliknya', async () => {
    const lid = randomUUID()
    await owner`insert into learner_profile (user_id, org_id, name, grade, active) values (${lid}, ${orgA}, 'Sementara', 2, true)`
    await owner`insert into paper_pick (org_id, learner_id, date, subject, kind, origin, title, minutes, source, item_refs) values (${orgA}, ${lid}, '2026-10-13', 'math', 'mini', 'kira-made', 't', 5, 's', array['a'])`
    await owner`insert into program_run (org_id, learner_id, program_id, start_date, end_date, created_by) values (${orgA}, ${lid}, 'p', '2026-10-20', '2026-12-14', ${tutorA})`
    await owner`delete from learner_profile where user_id = ${lid}`
    expect((await owner`select count(*)::int as n from paper_pick where learner_id = ${lid}`)[0]!.n).toBe(0)
    expect((await owner`select count(*)::int as n from program_run where learner_id = ${lid}`)[0]!.n).toBe(0)
  })

  it('semua tabel baru memakai RLS yang dipaksa', async () => {
    const rows = await owner`select relname, relrowsecurity, relforcerowsecurity from pg_class where relname in ('paper_library','paper_pick','program_run','source_record','source_state')`
    expect(rows).toHaveLength(5)
    for (const r of rows) expect([r.relname, r.relrowsecurity, r.relforcerowsecurity]).toEqual([r.relname, true, true])
  })
})
