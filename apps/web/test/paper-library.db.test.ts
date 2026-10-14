import { mkdtemp, readFile, rm, stat, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { addDays, jakartaDate, weekday, type IsoDate } from '@kira/core'
import { expandProgram } from '@kira/content/programs'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * Tes terpadu DAL pustaka paper, Buku Salah, program olimpiade, dan potong gambar di Postgres sungguhan.
 * Butuh DATABASE_URL_OWNER dan DATABASE_URL_APP dan migrasi sudah dijalankan (lihat scripts/dev-db.sh env).
 * Tanpa itu seluruh berkas dilewati.
 */

const ready = Boolean(process.env.DATABASE_URL_OWNER && process.env.DATABASE_URL_APP)

describe.skipIf(!ready)('DAL pustaka paper di Postgres', () => {
  const owner = ready ? postgres(process.env.DATABASE_URL_OWNER!, { max: 2, onnotice: () => {} }) : (null as never)
  const orgId = randomUUID()
  const tutorId = randomUUID()
  const learnerId = randomUUID()
  const tutor = { orgId, userId: tutorId, role: 'tutor' as const }
  let dataDir = ''
  // Modul DAL dimuat sesudah env diisi (env() membaca process.env saat pertama dipakai).
  let dal: {
    inOrg: typeof import('@/server/db').inOrg
    daily: typeof import('@/server/dal/daily-paper')
    lib: typeof import('@/server/dal/paper-library')
    mist: typeof import('@/server/dal/mistake-book')
    prog: typeof import('@/server/dal/console-program')
    imp: typeof import('@/server/dal/console-import')
    png: typeof import('@/server/png-crop')
  }

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'kira-paper-db-'))
    process.env.KIRA_ORIGIN ??= 'http://localhost:3199'
    process.env.KIRA_SECRET ??= 'x'.repeat(40)
    process.env.DATABASE_URL_AUTH ??= process.env.DATABASE_URL_APP!
    process.env.KIRA_DATA_DIR = dataDir
    dal = {
      inOrg: (await import('@/server/db')).inOrg,
      daily: await import('@/server/dal/daily-paper'),
      lib: await import('@/server/dal/paper-library'),
      mist: await import('@/server/dal/mistake-book'),
      prog: await import('@/server/dal/console-program'),
      imp: await import('@/server/dal/console-import'),
      png: await import('@/server/png-crop'),
    }
    await owner`insert into org (id, name) values (${orgId}, 'Org PL __GTX_SEED__')`
    await owner`insert into member_profile (user_id, org_id, name, role, email) values (${tutorId}, ${orgId}, 'Tutor PL', 'tutor', 'tutor-pl-dal@example.test')`
    await owner`insert into learner_profile (user_id, org_id, name, grade, active) values (${learnerId}, ${orgId}, 'Anak PL', 2, true)`
  })

  afterAll(async () => {
    await owner`delete from org where id = ${orgId}`
    await owner.end()
    await (globalThis as unknown as { __kiraPools?: { closeAll: () => Promise<void> } }).__kiraPools?.closeAll()
    await rm(dataDir, { recursive: true, force: true })
  })

  async function orgItem(ref: string): Promise<string> {
    const [row] = await owner`insert into org_item (org_id, skill_id, subject, grade, body, source, created_by) values (${orgId}, 'm2.oly-patterns', 'math', 2,
      ${owner.json({ type: 'mcq', skill: 'm2.oly-patterns', difficulty: 3, prompt: `Soal ${ref}`, lang: 'en-GB', options: [{ text: 'a' }, { text: 'b' }], answer: 0, hints: ['h1', 'h2', 'h3'], explanation: 'e', tags: [], source: 'imported' })}, 'imported', ${tutorId}) returning id`
    return row!.id as string
  }

  it('pustaka: baris dibuat dari paket yang punya data paper dan dihapus bila datanya dikosongkan', async () => {
    const ids = await Promise.all([orgItem('1'), orgItem('2'), orgItem('3')])
    const refs = ids.map((id) => `org:${id}`)
    const batch = randomUUID()
    const meta = { competition: 'ikmc', year: 2023, section: 'bagian a', originalMinutes: 30, source: 'https://example.org/p.pdf' }
    await dal.inOrg(tutor, (tx) => dal.lib.syncLibraryEntryTx(tx, tutor, { id: batch, subject: 'math', grade: 2, createdBy: tutorId, meta, refs }))
    const [row] = await owner`select * from paper_library where import_batch_id = ${batch}`
    expect(row).toMatchObject({ competition: 'ikmc', year: 2023, section: 'A', minutes: 30, title: 'IKMC 2023, Grade 2, part A', source: 'https://example.org/p.pdf' })
    expect(row!.item_refs).toEqual(refs)
    // Sinkron ulang memperbarui baris yang sama.
    await dal.inOrg(tutor, (tx) => dal.lib.syncLibraryEntryTx(tx, tutor, { id: batch, subject: 'math', grade: 2, createdBy: tutorId, meta: { ...meta, section: null, source: null }, refs }))
    const again = await owner`select section, source from paper_library where import_batch_id = ${batch}`
    expect(again).toHaveLength(1)
    expect(again[0]).toMatchObject({ section: 'penuh', source: 'unggahan tutor' })
    // Tanpa data paper, baris hilang.
    await dal.inOrg(tutor, (tx) => dal.lib.syncLibraryEntryTx(tx, tutor, { id: batch, subject: 'math', grade: 2, createdBy: tutorId, meta: { competition: null, year: null, section: null, originalMinutes: null, source: null }, refs }))
    expect(await owner`select id from paper_library where import_batch_id = ${batch}`).toHaveLength(0)
  })

  it('paper harian: bagian belum dikerjakan, tetap di hari yang sama, lalu paper buatan Kira, Sabtu penuh', async () => {
    const mk = async (competition: string, year: number, section: string, minutes: number) => {
      const ids = await Promise.all(['a', 'b', 'c', 'd'].map((n) => orgItem(`${competition}${year}${section}${n}`)))
      await owner`insert into paper_library (org_id, import_batch_id, origin, competition, year, subject, grade, section, title, minutes, source, item_refs, created_by)
        values (${orgId}, ${randomUUID()}, 'official', ${competition}, ${year}, 'math', 2, ${section}, ${`${competition.toUpperCase()} ${year}, Grade 2, part ${section}`}, ${minutes}, 'unggahan tutor', ${ids.map((i) => `org:${i}`)}, ${tutorId})`
    }
    await mk('ikmc', 2023, 'A', 20)
    await mk('sasmo', 2022, 'A', 25)
    const ctx = { orgId, learnerId, grade: 2 }
    const pick = (...a: [typeof ctx, 'math' | 'english' | 'science', string, 'mini' | 'full']) => dal.inOrg({ orgId, userId: learnerId, role: 'learner' }, (tx) => dal.daily.pickDailyPaper(tx, ...a))
    // 2026-10-13 hari Selasa.
    const first = await pick(ctx, 'math', '2026-10-13', 'mini')
    expect(first).toMatchObject({ source: 'Real contest paper', minutes: 20 })
    expect(first!.title).toBe('IKMC 2023, Grade 2, part A')
    expect(first!.itemRefs).toHaveLength(4)
    // Memanggil lagi di hari yang sama memberi paper yang sama.
    expect(await pick(ctx, 'math', '2026-10-13', 'mini')).toEqual(first)
    // Besok: lomba lain (bergiliran).
    const second = await pick(ctx, 'math', '2026-10-14', 'mini')
    expect(second!.title).toBe('SASMO 2022, Grade 2, part A')
    // Lusa: pustaka habis, jatuh ke Paper gaya lomba buatan Kira dengan soal olimpiade repo.
    const third = await pick(ctx, 'math', '2026-10-15', 'mini')
    expect(third).toMatchObject({ source: 'Kira-made contest-style paper', title: 'Kira contest-style mini paper' })
    expect(third!.itemRefs.length).toBe(8)
    expect(third!.itemRefs.every((r) => /^m2\.oly-/.test(r) || r.startsWith('org:'))).toBe(true)
    expect(third!.minutes).toBe(15)
    // Sabtu 2026-10-17: jenis mengikuti permintaan sesi harian. Satu mapel bergiliran meminta paper penuh, mapel lain mini.
    const satMini = await pick(ctx, 'math', '2026-10-17', 'mini')
    expect(satMini).toMatchObject({ title: 'Kira contest-style mini paper', minutes: 15 })
    const sat = await pick(ctx, 'math', '2026-10-17', 'full')
    // Paper penuh buatan Kira meniru lomba hari itu: jumlah soal dan waktu mengikuti preset.
    const contest = (await import('@/server/dal/daily-paper-scoring')).paperPresetFor('math', 2, '2026-10-17')!
    expect(sat).toMatchObject({ source: 'Kira-made contest-style paper', title: 'Kira contest-style full paper', minutes: contest.rules.timeLimitMin })
    expect(sat!.itemRefs.length).toBe(contest.rules.questionCount)
    // English tanpa pustaka: skill English yang ditandai lomba cukup untuk paper buatan Kira.
    expect(await pick(ctx, 'english', '2026-10-13', 'mini')).toMatchObject({ source: 'Kira-made contest-style paper' })
    // Grade tanpa soal sama sekali (tidak ada skill lomba di Grade 1 English pada tes ini) tidak melempar galat.
    await expect(pick({ orgId, learnerId, grade: 6 }, 'math', '2026-10-13', 'full')).resolves.toBeDefined()
    // Dua permintaan serentak memilih paper yang sama.
    const [x, y] = await Promise.all([pick(ctx, 'math', '2026-10-20', 'mini'), pick(ctx, 'math', '2026-10-20', 'mini')])
    expect(x).toEqual(y)
  })

  it('Buku Salah: salah di Tes terbuka, sesi ulang dibuat, benar di sesi ulang menutupnya', async () => {
    const refs = ['m2.oly-patterns.001', 'm2.oly-patterns.002', 'm2.oly-logic.001']
    const [att] = await owner`insert into attempt (org_id, learner_id, kind, mode, subject, title, items, submitted_at, status)
      values (${orgId}, ${learnerId}, 'quest', 'tes', 'math', 'Tes', ${owner.json(refs.map((ref, i) => ({ ref, section: 'core', position: i + 1, difficulty: 3 })))}, now() - interval '2 hours', 'submitted') returning id`
    const add = (pos: number, status: string, timeMs: number) =>
      owner`insert into response (org_id, attempt_id, learner_id, position, item_ref, skill_id, subject, item_type, difficulty, status, time_ms, client_id, answered_at)
        values (${orgId}, ${att!.id}, ${learnerId}, ${pos}, ${refs[pos - 1]!}, ${refs[pos - 1]!.split('.').slice(0, 2).join('.')}, 'math', 'mcq', 3, ${status}, ${timeMs}, ${randomUUID()}, now() - interval '2 hours')`
    await add(1, 'wrong', 2000)
    await add(2, 'correct', 9000)
    await add(3, 'blank', 0)
    const open = await dal.inOrg({ orgId, userId: learnerId, role: 'learner' }, (tx) => dal.mist.openMistakes(tx, learnerId))
    expect(open.map((o) => o.ref).sort()).toEqual(['m2.oly-logic.001', 'm2.oly-patterns.001'])
    const sess = await dal.inOrg({ orgId, userId: learnerId, role: 'learner' }, (tx) => dal.mist.startFixItSession(tx, { orgId, userId: learnerId, role: 'learner' }, learnerId))
    const [redo] = await owner`select kind, mode, ref_id, items from attempt where id = ${sess}`
    expect(redo).toMatchObject({ kind: 'test', mode: 'latihan' })
    expect(String(redo!.ref_id)).toMatch(/^buku-salah:/)
    expect((redo!.items as unknown[]).length).toBe(2)
    // Sesi yang belum selesai dilanjutkan, bukan dibuat ulang.
    expect(await dal.inOrg({ orgId, userId: learnerId, role: 'learner' }, (tx) => dal.mist.startFixItSession(tx, { orgId, userId: learnerId, role: 'learner' }, learnerId))).toBe(sess)
    const dto = await dal.inOrg({ orgId, userId: learnerId, role: 'learner' }, (tx) => dal.mist.fixItDTO(tx, learnerId))
    expect(dto).toMatchObject({ open: 2, canStart: true, sessionSize: 2 })
    // Soal pertama dijawab benar di sesi ulang: keluar dari daftar; yang lain tetap.
    await owner`update attempt set status = 'submitted', submitted_at = now() where id = ${sess}`
    await owner`insert into response (org_id, attempt_id, learner_id, position, item_ref, skill_id, subject, item_type, difficulty, status, client_id, answered_at)
      values (${orgId}, ${sess}, ${learnerId}, 1, 'm2.oly-patterns.001', 'm2.oly-patterns', 'math', 'mcq', 3, 'correct', ${randomUUID()}, now())`
    const after = await dal.inOrg({ orgId, userId: learnerId, role: 'learner' }, (tx) => dal.mist.openMistakes(tx, learnerId))
    expect(after.map((o) => o.ref)).toEqual(['m2.oly-logic.001'])
    // Today: perhentian opsional Fix-it Book hanya hari Sabtu dan hanya bila masih ada soal terbuka.
    const today = await import('@/server/dal/learner-today')
    const learnerCtx = { orgId, userId: learnerId, role: 'learner' as const }
    const sat = await dal.inOrg(learnerCtx, (tx) => today.fixItExtra(tx, learnerId, '2026-10-17'))
    expect(sat).toMatchObject({ href: '/fix-it', required: false, questId: null, sessionLabel: 'Fix-it Book', state: 'ready' })
    expect(sat!.meta).toBe('1 question from tests and papers to try again')
    expect(await dal.inOrg(learnerCtx, (tx) => today.fixItExtra(tx, learnerId, '2026-10-16'))).toBeNull()
    // Laporan tutor: jenis kesalahan dan soal terbuka.
    const report = await dal.mist.mistakeReportDTO({ userId: tutorId, orgId, role: 'tutor', name: 'Tutor PL' } as never, learnerId)
    expect(report.open).toBe(1)
    expect(report.byType[0]).toMatchObject({ type: 'blank', count: 1 })
    expect(report.cleared).toBe(1)
  })

  it('program olimpiade: slot Latihan dan Tes masuk plan_slot, bentrok dan istirahat dilewati, batal menghapus yang belum lewat', async () => {
    await owner`update learner_profile set rest_weekdays = array[0] where user_id = ${learnerId}`
    // Senin paling cepat dua hari dari sekarang, supaya semua hari belum lewat dan quest hari ini belum dibuat.
    const today = jakartaDate()
    let start = addDays(today, 2)
    while (weekday(start) !== 1) start = addDays(start, 1)
    const r = await dal.inOrg(tutor, (tx) => dal.prog.startProgramTx(tx, tutor, { learnerId, programId: 'olimpiade-math-g2', startDate: start }))
    expect(r.restDaysSkipped).toBe(8)
    // 46 hari biasa bukan Minggu x 2 slot, ditambah 2 hari ringan (Jumat dan Sabtu; Minggu terakhir istirahat),
    // ditambah satu Paper penuh di Sabtu simulasi.
    expect(r.slots).toBe(46 * 2 + 2 + 1)
    expect(r.simulations).toBe(1)
    expect(r.draftWeeks).toBe(0)
    const planned = await owner`select session, required, count(*)::int as n from plan_slot where learner_id = ${learnerId} group by session, required order by session`
    expect(planned.map((p) => [p.session, p.required, p.n])).toEqual([['latihan', true, 48], ['paper', true, 1], ['tes', true, 46]])

    // Dalam model sesi harian: hari program menghasilkan Latihan dan Tes wajib dengan skill program, dan Sabtu simulasi Paper penuh.
    const prog = dal.prog.programById('olimpiade-math-g2')!
    const days = expandProgram(prog, start)
    const normal = days.find((d) => d.kind === 'normal' && weekday(d.date) === 2)!
    const sim = days.find((d) => d.kind === 'simulation')!
    const learnerCtx = { orgId, userId: learnerId, role: 'learner' as const }
    const session = await import('@/server/dal/learner-session')
    const core = await import('@/server/dal/learner-core')
    const onDay = (date: IsoDate) => dal.inOrg(learnerCtx, async (tx) => session.ensureTodayQuests(tx, learnerCtx, await core.loadLearner(tx, learnerId), date))
    const tue = await onDay(normal.date)
    expect(tue.filter((q) => q.kind === 'daily')).toHaveLength(9)
    expect(tue.filter((q) => q.kind === 'extra')).toHaveLength(0)
    for (const slot of normal.slots) {
      const q = tue.find((x) => x.subject === 'math' && x.session === slot.mode && x.kind === 'daily')!
      expect(q.skillId, slot.mode).toBe(slot.skillId)
      const [att] = await owner`select mode, items from attempt where id = ${q.attemptId!}`
      expect(att!.mode).toBe(slot.mode)
      expect((att!.items as unknown[]).length).toBeGreaterThanOrEqual(Math.min(slot.questionCount, 4))
    }
    const satQuests = await onDay(sim.date)
    const mathPaper = satQuests.find((q) => q.subject === 'math' && q.session === 'paper' && q.kind === 'daily')!
    expect((mathPaper.config as { paper?: string }).paper).toBe('full')
    const [paperAttempt] = await owner`select time_limit_s from attempt where id = ${mathPaper.attemptId!}`
    expect(paperAttempt!.time_limit_s).toBeGreaterThan(15 * 60)
    const weeks = await owner`select status from plan_week where learner_id = ${learnerId}`
    expect(weeks.length).toBeGreaterThanOrEqual(8)
    expect(weeks.every((w) => w.status === 'published')).toBe(true)
    await expect(dal.inOrg(tutor, (tx) => dal.prog.startProgramTx(tx, tutor, { learnerId, programId: 'olimpiade-math-g2', startDate: start }))).rejects.toThrow(/sudah berjalan/)
    const gone = await dal.inOrg(tutor, (tx) => dal.prog.cancelProgramTx(tx, tutor, r.runId))
    expect(gone.removed).toBe(r.slots)
    expect(await owner`select id from plan_slot where learner_id = ${learnerId}`).toHaveLength(0)
    await expect(dal.inOrg(tutor, (tx) => dal.prog.cancelProgramTx(tx, tutor, r.runId))).rejects.toThrow(/sudah dibatalkan/)
    await expect(dal.inOrg(tutor, (tx) => dal.prog.startProgramTx(tx, tutor, { learnerId, programId: 'olimpiade-math-g2', startDate: '2020-01-01' }))).rejects.toThrow(/sudah lewat/)
  })

  it('potong gambar: halaman dipotong jadi media figure, dipasang ke soal, lalu masuk soal org saat disetujui', async () => {
    // Halaman PNG 200x300 di media org.
    const pixels = Buffer.alloc(200 * 300 * 3, 255)
    const png = dal.png.encodePng(pixels, 200, 300, 2)
    const rel = join(orgId, '2026-10', `${randomUUID()}.png`)
    await mkdir(join(dataDir, 'media', orgId, '2026-10'), { recursive: true })
    await writeFile(join(dataDir, 'media', rel), png)
    const [page] = await owner`insert into media (org_id, kind, path, mime, size, sha256, created_by) values (${orgId}, 'page', ${rel}, 'image/png', ${png.length}, 'p', ${tutorId}) returning id`
    const [pdf] = await owner`insert into media (org_id, kind, path, mime, size, sha256, created_by) values (${orgId}, 'pdf', 'x/y.pdf', 'application/pdf', 1, 'q', ${tutorId}) returning id`
    const items = Array.from({ length: 3 }, (_, i) => ({ number: i + 1, prompt: `Which shape is next in row ${i + 1}?`, options: ['circle', 'square', 'star'], answer: 1, answerFromKey: 1, figureNote: null, page: 1, status: 'ok', approved: false, orgItemId: null, keyCheck: 'agree', aiAnswer: 1 }))
    const [batch] = await owner`insert into import_batch (org_id, title, subject, grade, media_id, status, items, pages, created_by, competition, year, section, original_minutes, source)
      values (${orgId}, 'Paket uji', 'math', 2, ${pdf!.id}, 'review', ${owner.json(items)}, ${[page!.id as string]}, ${tutorId}, 'ikmc', 2024, 'B', 35, 'unggahan tutor') returning id`
    const fig = await dal.inOrg(tutor, (tx) => dal.imp.attachFigureTx(tx, tutor, { batchId: batch!.id as string, index: 0, page: 1, rect: { x: 0.1, y: 0.1, w: 0.5, h: 0.4 }, alt: 'A row of shapes with one blank.' }))
    expect(fig.url).toMatch(/^\/api\/media\/[0-9a-f-]{36}$/)
    const [figRow] = await owner`select id, kind, path, mime from media where kind = 'figure' and org_id = ${orgId}`
    expect(figRow).toMatchObject({ kind: 'figure', mime: 'image/png' })
    const stored = dal.png.decodePng(await readFile(join(dataDir, 'media', figRow!.path as string)))
    expect([stored.width, stored.height]).toEqual([100, 120])
    // Memasang lagi mengganti gambar lama (satu media figure tersisa).
    await dal.inOrg(tutor, (tx) => dal.imp.attachFigureTx(tx, tutor, { batchId: batch!.id as string, index: 0, page: 1, rect: { x: 0, y: 0, w: 0.5, h: 0.5 }, alt: 'A larger row of shapes.' }))
    expect(await owner`select id from media where kind = 'figure' and org_id = ${orgId}`).toHaveLength(1)
    await expect(dal.inOrg(tutor, (tx) => dal.imp.attachFigureTx(tx, tutor, { batchId: batch!.id as string, index: 0, page: 1, rect: { x: 0, y: 0, w: 0.02, h: 0.02 }, alt: 'Terlalu kecil untuk dipotong.' }))).rejects.toThrow(/terlalu kecil/)
    await expect(dal.inOrg(tutor, (tx) => dal.imp.attachFigureTx(tx, tutor, { batchId: batch!.id as string, index: 9, page: 1, rect: { x: 0, y: 0, w: 0.5, h: 0.5 }, alt: 'Soal tidak ada.' }))).rejects.toThrow(/tidak ada/)
    // Setujui semua soal: org_item memuat figur clip untuk soal 1, dan pustaka paper terbentuk.
    const res = await dal.inOrg(tutor, (tx) => dal.imp.approveImportItemsTx(tx, tutor, { batchId: batch!.id as string, indexes: [0, 1, 2] }))
    expect(res.created).toBe(3)
    const [finalFig] = await owner`select path from media where kind = 'figure' and org_id = ${orgId}`
    const first = await owner`select body from org_item where org_id = ${orgId} and body->>'prompt' = 'Which shape is next in row 1?'`
    expect((first[0]!.body as { figure?: { kind: string } }).figure?.kind).toBe('clip')
    const [lib] = await owner`select title, section, minutes, source, item_refs from paper_library where import_batch_id = ${batch!.id}`
    expect(lib).toMatchObject({ title: 'IKMC 2024, Grade 2, part B', section: 'B', minutes: 35 })
    expect((lib!.item_refs as string[]).length).toBe(3)
    // Sesudah disetujui gambar tidak bisa diubah lagi.
    await expect(dal.inOrg(tutor, (tx) => dal.imp.removeFigureTx(tx, tutor, { batchId: batch!.id as string, index: 0 }))).rejects.toThrow()
    expect((await stat(join(dataDir, 'media', finalFig!.path as string))).size).toBeGreaterThan(0)
    // Gambar pertama yang diganti sudah dihapus dari disk.
    await expect(stat(join(dataDir, 'media', figRow!.path as string))).rejects.toThrow()
  })
})
