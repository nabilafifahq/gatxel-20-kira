import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { answerToLabels, labelCount, type Item } from '@kira/content'
import { createDb, withOrg, type Db, type OrgContext, type Tx } from '@kira/db/client'
import { computeStreak, jakartaDate, retryXp, saturdayFullSubject, weekStart } from '@kira/core'

/**
 * Alur sesi harian di Postgres sungguhan: 9 sesi wajib, Tes terkunci sampai Latihan selesai, batas waktu Tes dan Paper,
 * paper dinilai preset, ulang sesi (percobaan pertama resmi, 25 persen XP, lencana), Hari ringan, dan sesi opsional.
 * Butuh DATABASE_URL_OWNER dan DATABASE_URL_APP (lihat scripts/dev-db.sh env) dan migrasi sudah dijalankan.
 */

const ownerUrl = process.env.DATABASE_URL_OWNER
const appUrl = process.env.DATABASE_URL_APP
const ready = Boolean(ownerUrl && appUrl)

const WEDNESDAY = '2026-10-14'
const SATURDAY = '2026-10-17'

describe.skipIf(!ready)('sesi harian', () => {
  const owner = ready ? postgres(ownerUrl!, { max: 2, onnotice: () => {} }) : (null as never)
  const app = ready ? createDb(appUrl!, { name: 'session-flow', max: 4 }) : (null as never)
  const orgId = randomUUID()
  const learnerId = randomUUID()
  const tutorId = randomUUID()
  const ctx: OrgContext = { orgId, userId: learnerId, role: 'learner' }
  let db: Db
  // Modul DAL dimuat setelah variabel lingkungan diisi.
  let m: {
    session: typeof import('@/server/dal/learner-session')
    core: typeof import('@/server/dal/learner-core')
    runner: typeof import('@/server/dal/learner-runner')
    results: typeof import('@/server/dal/learner-results')
    today: typeof import('@/server/dal/learner-today')
    paper: typeof import('@/server/dal/daily-paper')
    paperScoring: typeof import('@/server/dal/daily-paper-scoring')
    content: typeof import('@/server/dal/content')
    labels: typeof import('@/server/labels')
  }

  const run = <T>(fn: (tx: Tx) => Promise<T>) => withOrg(db, ctx, fn)

  async function learnerRow(tx: Tx) {
    return m.core.loadLearner(tx, learnerId)
  }

  /** Jawaban benar untuk soal yang dinilai otomatis; soal yang dinilai tutor (tulis, bicara, gambar, foto) dibiarkan kosong. */
  function correctAnswer(item: Item): unknown | null {
    switch (item.type) {
      case 'mcq':
      case 'listen':
        return { choice: item.answer }
      case 'numeric':
        return { value: String(item.answer) }
      case 'story':
        return { parts: item.parts.map((p) => (p.type === 'mcq' ? { choice: p.answer } : p.type === 'numeric' ? { value: String(p.answer) } : { texts: [p.answers[0]] })) }
      case 'tiles':
        return { words: item.answer.split(/\s+/) }
      case 'spell':
        return { value: item.word }
      case 'cloze':
        return { texts: item.gaps.map((g) => g.options[g.answer]) }
      case 'hotspot':
        return { texts: item.answers.map((i) => item.regions[i]!.label) }
      case 'label':
        return { texts: item.labels }
      case 'table':
        return { texts: item.blanks.map((b) => b.answers[0]) }
      case 'grid':
        return { cells: item.filled.flat() }
      default:
        return null
    }
  }

  /** Jawab sebagian soal sebuah attempt dengan benar (maksimal `limit` soal, atau semua), lalu kembalikan jumlah yang dijawab. */
  async function answer(attemptId: string, limit = Infinity, only?: ReadonlySet<string>): Promise<{ answered: string[] }> {
    const answered: string[] = []
    await run(async (tx) => {
      const [a] = await tx.execute<{ id: string; items: { ref: string; position: number }[]; mode: string }>(
        (await import('drizzle-orm')).sql`select id, items, mode from attempt where id = ${attemptId}`,
      )
      const items = a!.items
      const resolved = await m.content.resolveItems(tx, items.map((i) => i.ref))
      let n = 0
      for (const it of items) {
        if (n >= limit) break
        if (only && !only.has(it.ref)) continue
        const item = resolved.get(it.ref)
        const ans = item ? correctAnswer(item) : null
        if (!item || ans === null) continue
        const hidden = a!.mode === 'tes' || a!.mode === 'simulasi'
        const payload = hidden ? answerToLabels(item, ans, m.labels.labelPerm(attemptId, it.ref, labelCount(item))) : ans
        const r = await m.runner.saveAnswer(tx, ctx, learnerId, {
          attemptId,
          position: it.position,
          answer: payload,
          hintsUsed: 0,
          attemptNo: 1,
          timeMs: 4000,
          flagged: false,
          clientId: randomUUID(),
          answeredAt: new Date().toISOString(),
        })
        expect(['correct', 'answered']).toContain(r.status)
        answered.push(it.ref)
        n++
      }
    })
    return { answered }
  }

  async function quests(date: string) {
    return run(async (tx) => {
      const rows = await tx.execute<{ id: string; subject: string; session: string; kind: string; seq: number; status: string; attempt_id: string | null; title: string }>(
        (await import('drizzle-orm')).sql`select id, subject, session, kind, seq, status, attempt_id, title from quest where learner_id = ${learnerId} and date = ${date} order by subject, session, kind, seq`,
      )
      return [...rows]
    })
  }

  async function attemptRow(id: string) {
    const rows = await owner`select * from attempt where id = ${id}`
    return rows[0]!
  }

  beforeAll(async () => {
    process.env.KIRA_ORIGIN = 'http://localhost:3100'
    process.env.DATABASE_URL_APP = appUrl!
    process.env.DATABASE_URL_AUTH = appUrl!
    process.env.KIRA_SECRET = 'uji-sesi-harian-rahasia-minimal-32-karakter'
    process.env.KIRA_DATA_DIR = '.kira-local/data'
    db = app.db
    m = {
      session: await import('@/server/dal/learner-session'),
      core: await import('@/server/dal/learner-core'),
      runner: await import('@/server/dal/learner-runner'),
      results: await import('@/server/dal/learner-results'),
      today: await import('@/server/dal/learner-today'),
      paper: await import('@/server/dal/daily-paper'),
      paperScoring: await import('@/server/dal/daily-paper-scoring'),
      content: await import('@/server/dal/content'),
      labels: await import('@/server/labels'),
    }
    await owner`insert into org (id, name) values (${orgId}, 'Uji sesi harian __GTX_SEED__')`
    await owner`insert into member_profile (user_id, org_id, name, role, email) values (${tutorId}, ${orgId}, 'Tutor uji', 'tutor', 'uji-sesi@example.test')`
    await owner`insert into learner_profile (user_id, org_id, name, grade, active, screen_limit_min, rest_weekdays, started_on)
      values (${learnerId}, ${orgId}, 'Anak uji', 2, true, 120, '{0}', '2026-10-01')`
  })

  afterAll(async () => {
    await owner`delete from org where id = ${orgId}`
    await Promise.all([owner.end(), app.client.end()])
  })

  it('pickDailyPaper: mini 8 soal 15 menit, penuh mengikuti preset, hasilnya tetap untuk masukan yang sama', async () => {
    const c = { orgId, learnerId, grade: 2 }
    const pickP = (...a: [typeof c, Parameters<typeof m.paper.pickDailyPaper>[2], string, 'mini' | 'full']) => run((tx) => m.paper.pickDailyPaper(tx, ...a))
    for (const subject of ['math', 'english', 'science'] as const) {
      const mini = await pickP(c, subject, WEDNESDAY, 'mini')
      expect(mini, subject).not.toBeNull()
      expect(mini!.minutes).toBe(15)
      expect(mini!.itemRefs.length).toBe(8)
      expect(new Set(mini!.itemRefs).size).toBe(8)
      expect(mini!.title).toMatch(/mini paper$/)
      expect(await pickP(c, subject, WEDNESDAY, 'mini')).toEqual(mini)
      const full = await pickP(c, subject, SATURDAY, 'full')
      const preset = m.paperScoring.paperPresetFor(subject, 2, SATURDAY)
      expect(full!.minutes).toBe(preset!.rules.timeLimitMin)
      expect(full!.itemRefs.length).toBe(preset!.rules.questionCount)
    }
  })

  it('hari sekolah membuat 9 sesi wajib dengan soal dan batas waktu yang benar, dan aman dipanggil ulang', async () => {
    const created = await run(async (tx) => m.session.ensureTodayQuests(tx, ctx, await learnerRow(tx), WEDNESDAY))
    expect(created).toHaveLength(9)
    expect(created.every((q) => q.kind === 'daily')).toBe(true)
    for (const subject of ['math', 'english', 'science']) {
      expect(created.filter((q) => q.subject === subject).map((q) => q.session).sort()).toEqual(['latihan', 'paper', 'tes'])
    }
    const lat = await attemptRow(created.find((q) => q.subject === 'math' && q.session === 'latihan')!.attemptId!)
    expect(lat.mode).toBe('latihan')
    expect(lat.time_limit_s).toBeNull()
    expect((lat.items as unknown[]).length).toBe(10)
    for (const subject of ['math', 'english', 'science']) {
      const latQ = created.find((q) => q.subject === subject && q.session === 'latihan')!
      const tesQ = created.find((q) => q.subject === subject && q.session === 'tes')!
      const paperQ = created.find((q) => q.subject === subject && q.session === 'paper')!
      const l = await attemptRow(latQ.attemptId!)
      const t = await attemptRow(tesQ.attemptId!)
      const p = await attemptRow(paperQ.attemptId!)
      expect(t.mode).toBe('tes')
      expect(t.time_limit_s).toBe((t.items as unknown[]).length * 75)
      expect((t.items as unknown[]).length).toBe(8)
      const latRefs = new Set((l.items as { ref: string }[]).map((i) => i.ref))
      expect((t.items as { ref: string }[]).filter((i) => latRefs.has(i.ref))).toEqual([])
      expect(latQ.skillId).toBe(tesQ.skillId)
      expect(p.mode).toBe('tes')
      expect(p.time_limit_s).toBe(15 * 60)
      expect((p.items as unknown[]).length).toBe(8)
      expect(p.preset_id).not.toBeNull()
    }
    // Panggilan kedua tidak membuat sesi atau attempt baru.
    const again = await run(async (tx) => m.session.ensureTodayQuests(tx, ctx, await learnerRow(tx), WEDNESDAY))
    expect(again.map((q) => q.id).sort()).toEqual(created.map((q) => q.id).sort())
    const [n] = await owner`select count(*)::int as n from attempt where learner_id = ${learnerId}`
    expect(n!.n).toBe(9)
    const [dr] = await owner`select quests_done, quests_required from day_record where learner_id = ${learnerId} and date = ${WEDNESDAY}`
    expect(dr).toMatchObject({ quests_done: 0, quests_required: 9 })
  })

  it('Tes terkunci sampai Latihan mapel itu selesai, dan runner menolak membuka jamnya', async () => {
    const all = await quests(WEDNESDAY)
    const tes = all.find((q) => q.subject === 'math' && q.session === 'tes')!
    const lat = all.find((q) => q.subject === 'math' && q.session === 'latihan')!
    const locked = await run((tx) => m.runner.runnerDTO(tx, learnerId, tes.attempt_id!, { markOpened: true }))
    expect(locked).toEqual({ locked: true })
    const [opened] = await owner`select opened_at from attempt where id = ${tes.attempt_id}`
    expect(opened!.opened_at).toBeNull()
    const intro = await run((tx) => m.today.questIntroDTO(tx, ctx, learnerId, tes.id))
    expect(intro).toEqual({ locked: true })

    await answer(lat.attempt_id!)
    await run((tx) => m.runner.submitAttempt(tx, ctx, learnerId, lat.attempt_id!))
    const dto = await run((tx) => m.runner.runnerDTO(tx, learnerId, tes.attempt_id!, { markOpened: true }))
    expect('items' in dto).toBe(true)
    if ('items' in dto) {
      expect(dto.timeLimitSec).toBe(600)
      expect(dto.mode).toBe('tes')
      // Kunci jawaban tidak dikirim sebelum dikumpulkan.
      expect(dto.items.every((i) => !('key' in i) || i.key === undefined)).toBe(true)
    }
    const [o2] = await owner`select opened_at from attempt where id = ${tes.attempt_id}`
    expect(o2!.opened_at).not.toBeNull()
    const [dr] = await owner`select quests_done, quests_required from day_record where learner_id = ${learnerId} and date = ${WEDNESDAY}`
    expect(dr).toMatchObject({ quests_done: 1, quests_required: 9 })
  })

  it('Latihan yang diulang memberi soal baru, XP 25 persen, dan percobaan pertama tetap resmi', async () => {
    const all = await quests(WEDNESDAY)
    const lat = all.find((q) => q.subject === 'math' && q.session === 'latihan')!
    const root = await attemptRow(lat.attempt_id!)
    expect(root.status).toBe('submitted')
    const [xp0] = await owner`select coalesce(sum(amount), 0)::int as n from xp_event where learner_id = ${learnerId} and reason in ('quest-retry')`
    expect(xp0!.n).toBe(0)

    const retryId = await run(async (tx) => m.session.createRetryAttempt(tx, ctx, await learnerRow(tx), root.id))
    const retry = await attemptRow(retryId)
    expect(retry.retry_of).toBe(root.id)
    expect(retry.retry_no).toBe(1)
    expect((retry.items as unknown[]).length).toBe((root.items as unknown[]).length)
    const rootRefs = new Set((root.items as { ref: string }[]).map((i) => i.ref))
    expect((retry.items as { ref: string }[]).filter((i) => rootRefs.has(i.ref)).length).toBeLessThan((retry.items as unknown[]).length)
    // Selama ulangan belum selesai, memanggil lagi memakai ulangan yang sama.
    expect(await run(async (tx) => m.session.createRetryAttempt(tx, ctx, await learnerRow(tx), root.id))).toBe(retryId)

    const masteryBefore = await owner`select n_answers from skill_state where learner_id = ${learnerId} order by skill_id`
    await answer(retryId)
    await run((tx) => m.runner.submitAttempt(tx, ctx, learnerId, retryId))
    const done = await attemptRow(retryId)
    expect(done.status).toBe('submitted')
    // Penguasaan tidak berubah oleh ulangan; jawabannya ditandai ulangan.
    expect(await owner`select n_answers from skill_state where learner_id = ${learnerId} order by skill_id`).toEqual(masteryBefore)
    const [flag] = await owner`select count(*) filter (where retry)::int as r, count(*)::int as n from response where attempt_id = ${retryId}`
    expect(flag!.r).toBe(flag!.n)
    const [ev] = await owner`select amount from xp_event where learner_id = ${learnerId} and reason = 'quest-retry' and ref = ${retryId}`
    expect(ev!.amount).toBe(retryXp((done.result as { perfect: boolean }).perfect ? 30 : 20))
    // Sesi tetap selesai satu kali, hari tetap menghitung satu sesi.
    const [q] = await owner`select status from quest where id = ${lat.id}`
    expect(q!.status).toBe('done')
    const [dr] = await owner`select quests_done from day_record where learner_id = ${learnerId} and date = ${WEDNESDAY}`
    expect(dr!.quests_done).toBe(1)
    // Hasil menampilkan skor resmi dan tombol Try again.
    const res = await run((tx) => m.results.resultsDTO(tx, learnerId, retryId))
    expect('retry' in res && res.retry).toMatchObject({ isRetry: true, retryNo: 1 })
    const rootRes = await run((tx) => m.results.resultsDTO(tx, learnerId, root.id))
    expect('retry' in rootRes && rootRes.retry).toMatchObject({ isRetry: false })
  })

  it('Paper dinilai dengan preset; ulang mengacak soal yang sama dan memberi lencana pantang menyerah', async () => {
    const all = await quests(WEDNESDAY)
    const pq = all.find((q) => q.subject === 'math' && q.session === 'paper')!
    const root = await attemptRow(pq.attempt_id!)
    const refs = (root.items as { ref: string }[]).map((i) => i.ref)
    // Percobaan pertama: hanya dua soal dijawab benar.
    const first = await answer(root.id, 2)
    await run((tx) => m.runner.submitAttempt(tx, ctx, learnerId, root.id))
    const done = await attemptRow(root.id)
    expect(done.status === 'submitted' || done.status === 'needs_grading').toBe(true)
    expect(done.preset_id).toBeTruthy()
    expect(done.score_max).toBeGreaterThan(0)
    expect(done.score_raw).toBeGreaterThan(0)
    expect((done.result as { session: string }).session).toBe('paper')
    const [badge1] = await owner`select count(*)::int as n from badge_award where learner_id = ${learnerId} and badge_id = 'first-paper'`
    expect(badge1!.n).toBe(1)

    const retryId = await run(async (tx) => m.session.createRetryAttempt(tx, ctx, await learnerRow(tx), root.id))
    const retry = await attemptRow(retryId)
    const retryItems = retry.items as { ref: string; position: number; scorePos: number }[]
    expect(retryItems.map((i) => i.ref).sort()).toEqual([...refs].sort())
    expect(retryItems.map((i) => i.position)).toEqual(Array.from({ length: refs.length }, (_, i) => i + 1))
    expect(retryItems.map((i) => i.scorePos).sort((a, b) => a - b)).toEqual(Array.from({ length: refs.length }, (_, i) => i + 1))
    expect(retry.time_limit_s).toBe(root.time_limit_s)
    expect(retry.preset_id).toBe(root.preset_id)
    // Soal yang sama dijawab lebih banyak benar di ulangan, jadi skornya naik.
    await answer(retryId)
    await run((tx) => m.runner.submitAttempt(tx, ctx, learnerId, retryId))
    const after = await attemptRow(retryId)
    expect(after.score_raw).toBeGreaterThan(done.score_raw)
    expect((after.result as { improved: boolean }).improved).toBe(true)
    const [badge2] = await owner`select count(*)::int as n from badge_award where learner_id = ${learnerId} and badge_id = 'never-give-up'`
    expect(badge2!.n).toBe(1)
    // Lencana sesi dihitung dari percobaan pertama saja: satu paper, bukan dua.
    const stats = await run(async (tx) => (await m.core.awardBadges(tx, ctx, await learnerRow(tx), WEDNESDAY)).map((b) => b.id))
    expect(stats).not.toContain('papers-10')
    // Skor terbaik muncul di Today untuk sesi yang diulang.
    const t = await run((tx) => m.today.attemptProgress(tx, [root.id]))
    expect(t.get(root.id)?.score).not.toBeNull()
    void first
  })

  it('menyelesaikan semua sesi wajib melengkapi hari, dan sesi opsional tidak memengaruhi streak', async () => {
    // Sesi opsional dari tutor: Ulang kartu dan Tantangan Hitung Cepat untuk hari ini.
    const [week] = await owner`
      insert into plan_week (org_id, learner_id, week_start, status, published_at, created_by)
      values (${orgId}, ${learnerId}, '2026-10-12', 'published', now(), ${tutorId}) returning id`
    await owner`insert into plan_slot (org_id, plan_week_id, learner_id, date, subject, kind, session, required, mode, question_count)
      values (${orgId}, ${week!.id}, ${learnerId}, ${WEDNESDAY}, 'math', 'quest', 'review', false, 'latihan', 10),
             (${orgId}, ${week!.id}, ${learnerId}, ${WEDNESDAY}, 'math', 'quest', 'quick-maths', false, 'latihan', 10)`
    const day = await run(async (tx) => m.session.ensureTodayQuests(tx, ctx, await learnerRow(tx), WEDNESDAY))
    expect(day.filter((q) => q.kind === 'extra').map((q) => q.session).sort()).toEqual(['quick-maths', 'review'])
    expect(day.filter((q) => q.kind === 'daily')).toHaveLength(9)
    expect(day.filter((q) => q.kind === 'extra').every((q) => q.attemptId === null)).toBe(true)
    const [mid] = await owner`select quests_done, quests_required from day_record where learner_id = ${learnerId} and date = ${WEDNESDAY}`
    expect(mid).toMatchObject({ quests_required: 9 })

    // Selesaikan sisanya: Latihan lebih dulu supaya Tes terbuka.
    const order = ['latihan', 'tes', 'paper']
    const pending = day.filter((q) => q.kind === 'daily' && q.status !== 'done').sort((a, b) => order.indexOf(a.session) - order.indexOf(b.session))
    for (const q of pending) {
      await answer(q.attemptId!, 3)
      await run((tx) => m.runner.submitAttempt(tx, ctx, learnerId, q.attemptId!))
    }
    const [full] = await owner`select quests_done, quests_required from day_record where learner_id = ${learnerId} and date = ${WEDNESDAY}`
    expect(full).toMatchObject({ quests_done: 9, quests_required: 9 })
    // Sesi opsional selesai lewat halaman lain tidak mengubah hitungan wajib.
    expect(await run((tx) => m.session.completeLinkedSession(tx, learnerId, WEDNESDAY, { session: 'review' }))).toBe(true)
    expect(await run((tx) => m.session.completeLinkedSession(tx, learnerId, WEDNESDAY, { session: 'review' }))).toBe(false)
    const [after] = await owner`select quests_done, quests_required from day_record where learner_id = ${learnerId} and date = ${WEDNESDAY}`
    expect(after).toMatchObject({ quests_done: 9, quests_required: 9 })
    const streak = computeStreak({ days: [{ date: WEDNESDAY, questsDone: 9, questsRequired: 9 }], today: WEDNESDAY, restWeekdays: [0], since: WEDNESDAY })
    expect(streak.current).toBe(1)
    // Badge sesi: tes sempurna tidak diberikan karena jawaban dibiarkan sebagian kosong.
    const [pt] = await owner`select count(*)::int as n from badge_award where learner_id = ${learnerId} and badge_id = 'perfect-test'`
    expect(pt!.n).toBe(0)
  })

  it('tugas English dari tutor selesai saat sesi English Skills yang cocok dikumpulkan, dan tugas lain tetap terbuka', async () => {
    const today = jakartaDate()
    const found = await owner`select id from plan_week where learner_id = ${learnerId} and week_start = ${weekStart(today)}`
    const weekId =
      found[0]?.id ??
      (
        await owner`insert into plan_week (org_id, learner_id, week_start, status, published_at, created_by)
          values (${orgId}, ${learnerId}, ${weekStart(today)}, 'published', now(), ${tutorId}) returning id`
      )[0]!.id
    await owner`insert into plan_slot (org_id, plan_week_id, learner_id, date, subject, kind, session, required, mode, question_count, config)
      values (${orgId}, ${weekId}, ${learnerId}, ${today}, 'english', 'quest', 'english-skill', false, 'latihan', 6, ${owner.json({ task: 'listening' })}),
             (${orgId}, ${weekId}, ${learnerId}, ${today}, 'english', 'quest', 'english-skill', false, 'latihan', 6, ${owner.json({ task: 'writing' })})`
    const day = await run(async (tx) => m.session.ensureTodayQuests(tx, ctx, await learnerRow(tx), today))
    const tasks = day.filter((q) => q.session === 'english-skill')
    expect(tasks).toHaveLength(2)
    expect(tasks.every((q) => q.status !== 'done')).toBe(true)

    const english = await import('@/server/dal/english-skills')
    const attemptId = await run((tx) => english.startEnglishSession(tx, ctx, learnerId, 'listening'))
    await answer(attemptId, 2)
    await run((tx) => m.runner.submitAttempt(tx, ctx, learnerId, attemptId))
    const done = (await quests(today)).filter((q) => q.session === 'english-skill')
    const cfgOf = async (id: string) => ((await owner`select config from quest where id = ${id}`)[0]!.config as { task: string }).task
    const byTask = new Map<string, string>()
    for (const q of done) byTask.set(await cfgOf(q.id), q.status)
    expect(byTask.get('listening')).toBe('done')
    expect(byTask.get('writing')).not.toBe('done')
    // Mengumpulkan sesi yang sama dua kali tidak menyelesaikan tugas lain.
    expect(await run((tx) => m.session.completeLinkedSession(tx, learnerId, today, { session: 'english-skill', subject: 'english', task: 'listening' }))).toBe(false)
  })

  it('soal foto jawaban hanya masuk Latihan yang dipilihkan tutor, tidak ke pemilih otomatis', async () => {
    const photo = 's2.life-cycles.019'
    const base = { skillId: 's2.life-cycles', subject: 'science' as const, mode: 'latihan' as const, date: WEDNESDAY, style: 'easy' as const, length: 10 }
    const pools = await run(async (tx) => ({
      auto: (await m.content.poolForSkill(tx, orgId, base.skillId, { allowManual: false })).map((c) => c.ref),
      assigned: (await m.content.poolForSkill(tx, orgId, base.skillId, { allowManual: false, allowPhoto: true })).map((c) => c.ref),
    }))
    expect(pools.auto).not.toContain(photo)
    expect(pools.assigned).toContain(photo)
    // Sesi panjang memakai semua soal skill itu, jadi soal foto pasti ikut bila diizinkan dan tidak pernah bila tidak.
    const long = { ...base, length: 80 }
    const refsAuto = await run(async (tx) => (await m.session.buildQuestItems(tx, ctx, await learnerRow(tx), { ...long, seedKey: 'foto-auto' })).map((x) => x.ref))
    const refsAssigned = await run(async (tx) => (await m.session.buildQuestItems(tx, ctx, await learnerRow(tx), { ...long, seedKey: 'foto-tutor', allowPhoto: true })).map((x) => x.ref))
    expect(refsAuto).not.toContain(photo)
    expect(refsAssigned).toContain(photo)
  })

  it('Sabtu: satu mapel mengerjakan paper penuh dengan waktu preset, dua lainnya paper mini', async () => {
    const day = await run(async (tx) => m.session.ensureTodayQuests(tx, ctx, await learnerRow(tx), SATURDAY))
    const papers = day.filter((q) => q.session === 'paper')
    expect(papers).toHaveLength(3)
    const full = saturdayFullSubject(SATURDAY)
    for (const q of papers) {
      const a = await attemptRow(q.attemptId!)
      if (q.subject === full) {
        const preset = m.paperScoring.paperPresetFor(q.subject as 'math', 2, SATURDAY)
        expect(a.time_limit_s).toBe(preset!.rules.timeLimitMin * 60)
        expect((a.items as unknown[]).length).toBe(preset!.rules.questionCount)
      } else {
        expect(a.time_limit_s).toBe(900)
        expect((a.items as unknown[]).length).toBe(8)
      }
    }
  })

  it('paper Kertas dari Penyusun paper tidak membuat sesi tablet dan tidak dihitung wajib', async () => {
    const MONDAY = '2026-10-19'
    const refs = [...m.content.content().items.values()].filter((i) => i.skill.startsWith('e2.') && i.type === 'mcq').slice(0, 5).map((i) => i.id)
    const [p] = await owner`
      insert into paper (org_id, code, title, subject, grade, minutes, mode, item_refs, created_by)
      values (${orgId}, 'P-UJI-KERTAS', 'Paper kertas uji', 'english', 2, 20, 'kertas', ${refs}, ${tutorId}) returning id`
    const [w] = await owner`
      insert into plan_week (org_id, learner_id, week_start, status, published_at, created_by)
      values (${orgId}, ${learnerId}, ${MONDAY}, 'published', now(), ${tutorId}) returning id`
    await owner`insert into plan_slot (org_id, plan_week_id, learner_id, date, subject, kind, session, required, paper_id, mode, question_count)
      values (${orgId}, ${w!.id}, ${learnerId}, ${MONDAY}, 'english', 'quest', 'paper', true, ${p!.id}, 'kertas', 5)`
    const day = await run(async (tx) => m.session.ensureTodayQuests(tx, ctx, await learnerRow(tx), MONDAY))
    expect(day.filter((q) => q.kind === 'daily')).toHaveLength(8)
    expect(day.some((q) => q.subject === 'english' && q.session === 'paper')).toBe(false)
    const [dr] = await owner`select quests_required from day_record where learner_id = ${learnerId} and date = ${MONDAY}`
    expect(dr!.quests_required).toBe(8)
  })

  it('paper dari Penyusun paper dengan mode Tes menjadi sesi Paper berwaktu menggantikan paper otomatis', async () => {
    const TUESDAY = '2026-10-20'
    const refs = [...m.content.content().items.values()].filter((i) => i.skill.startsWith('s2.') && i.type === 'mcq').slice(0, 6).map((i) => i.id)
    const [p] = await owner`
      insert into paper (org_id, code, title, subject, grade, minutes, mode, item_refs, created_by)
      values (${orgId}, 'P-UJI-TES', 'Paper tes uji', 'science', 2, 12, 'tes', ${refs}, ${tutorId}) returning id`
    const [w] = await owner`select id from plan_week where learner_id = ${learnerId} and week_start = '2026-10-19'`
    await owner`insert into plan_slot (org_id, plan_week_id, learner_id, date, subject, kind, session, required, paper_id, mode, question_count)
      values (${orgId}, ${w!.id}, ${learnerId}, ${TUESDAY}, 'science', 'quest', 'paper', true, ${p!.id}, 'tes', 6)`
    const day = await run(async (tx) => m.session.ensureTodayQuests(tx, ctx, await learnerRow(tx), TUESDAY))
    expect(day.filter((q) => q.kind === 'daily')).toHaveLength(9)
    const q = day.find((x) => x.subject === 'science' && x.session === 'paper')!
    expect(q.title).toBe('Paper tes uji')
    const a = await attemptRow(q.attemptId!)
    expect(a.time_limit_s).toBe(12 * 60)
    expect((a.items as unknown[]).length).toBe(6)
    expect(a.preset_id).toBeNull()
  })

  it('Hari ringan hanya membuat satu Latihan per mapel dan Hari ringan hari ini membuang Tes dan Paper yang belum dimulai', async () => {
    const THURSDAY = '2026-10-15'
    await owner`update plan_week set day_templates = ${owner.json({ [THURSDAY]: 'light' })} where learner_id = ${learnerId} and week_start = '2026-10-12'`
    const light = await run(async (tx) => m.session.ensureTodayQuests(tx, ctx, await learnerRow(tx), THURSDAY))
    expect(light.filter((q) => q.kind === 'daily').map((q) => q.session)).toEqual(['latihan', 'latihan', 'latihan'])
    const [dr] = await owner`select quests_required from day_record where learner_id = ${learnerId} and date = ${THURSDAY}`
    expect(dr!.quests_required).toBe(3)

    // Hari sekolah biasa yang diubah menjadi Hari ringan setelah sesinya dibuat.
    const FRIDAY = '2026-10-16'
    const full = await run(async (tx) => m.session.ensureTodayQuests(tx, ctx, await learnerRow(tx), FRIDAY))
    expect(full.filter((q) => q.kind === 'daily')).toHaveLength(9)
    const mathTes = full.find((q) => q.subject === 'math' && q.session === 'tes')!
    await answer((await quests(FRIDAY)).find((q) => q.subject === 'math' && q.session === 'latihan')!.attempt_id!, 1)
    const dropped = await run((tx) => m.session.dropUnstartedHeavySessions(tx, ctx, learnerId, FRIDAY))
    expect(dropped).toBe(6)
    const left = await quests(FRIDAY)
    expect(left.filter((q) => q.kind === 'daily').every((q) => q.session === 'latihan')).toBe(true)
    expect(left.some((q) => q.id === mathTes.id)).toBe(false)
    const [dr2] = await owner`select quests_required from day_record where learner_id = ${learnerId} and date = ${FRIDAY}`
    expect(dr2!.quests_required).toBe(3)
  })
})
