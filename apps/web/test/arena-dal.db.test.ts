import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import postgres from 'postgres'
import { randomUUID } from 'node:crypto'
import { createDb, withOrg, type Tx } from '@kira/db/client'
import { applyDiminishing, generateProblem, jakartaDate, roundRawXp, scoreQmRound, type QmConfig } from '@kira/core'
import { roundQuestion } from '@kira/content/knowledge'
import type { QmStartInput } from '@/lib/dto-arena'
import { answerQmRound, finishQmRound, hintQmRound, qmHubDTO, qmRoundDTO, startQmRound } from '@/server/dal/arena-hitung'
import { answerQuizRound, finishQuizRound, quizHubDTO, quizRoundDTO, startQuizRound } from '@/server/dal/arena-pengetahuan'
import { applyAccessory, assertAccessoryEarned } from '@/server/dal/arena-tracks'
import { trackTotals } from '@/server/dal/arena-state'
import { learnerShell, loadLearner, totalXp } from '@/server/dal/learner-core'
import { AppError } from '@/server/errors'
import { learnerExport } from '@/server/dal/data-export'
import { ensureTodayQuests } from '@/server/dal/learner-session'
import { weekStart } from '@kira/core'

/**
 * Tes DAL arena di Postgres sungguhan (migrasi 0007 dan RLS): ronde Quick Maths dan Quiz Arena, XP per jalur,
 * penyusutan XP harian, level adaptif, misi harian, pelajaran strategi, lencana, dan aksesori.
 */

const urls = { owner: process.env.DATABASE_URL_OWNER, app: process.env.DATABASE_URL_APP }
const ready = Boolean(urls.owner && urls.app)

const base: QmStartInput = {
  mode: 'practice',
  op: 'add',
  digits: 'mixed',
  carry: true,
  auto: true,
  table: 2,
  division: false,
  flashLevel: null,
  sorobanStage: 'read',
  sorobanLevel: null,
  focus: null,
  mission: null,
}

describe.skipIf(!ready)('arena DAL (Postgres)', () => {
  const owner = ready ? postgres(urls.owner!, { max: 2, onnotice: () => {} }) : (null as never)
  const app = ready ? createDb(urls.app, { name: 'arena-test', max: 4 }) : (null as never)
  const orgId = randomUUID()
  const today = jakartaDate()

  async function newLearner(grade = 2): Promise<{ id: string; run: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T>; ctx: { orgId: string; userId: string; role: 'learner' } }> {
    const id = randomUUID()
    await owner`insert into learner_profile (user_id, org_id, name, grade, active, screen_limit_min) values (${id}, ${orgId}, 'Anak Tes __GTX_SEED__', ${grade}, true, 120)`
    const ctx = { orgId, userId: id, role: 'learner' as const }
    return { id, ctx, run: (fn) => withOrg(app.db, ctx, fn) }
  }

  type L = Awaited<ReturnType<typeof newLearner>>

  async function sessionOf(id: string): Promise<{ seed: string; config: QmConfig }> {
    const rows = await owner`select seed, config from arena_session where id = ${id}`
    return { seed: rows[0]!.seed as string, config: rows[0]!.config as QmConfig }
  }

  async function playQm(l: L, input: QmStartInput, opts: { wrongAt?: number[]; count?: number } = {}) {
    const { roundId } = await l.run((tx) => startQmRound(tx, l.ctx, l.id, input))
    const { seed, config } = await sessionOf(roundId)
    const n = opts.count ?? config.count
    for (let i = 0; i < n; i++) {
      const answer = generateProblem(config, seed, i).answer
      await l.run((tx) => answerQmRound(tx, l.id, { roundId, index: i, answer: opts.wrongAt?.includes(i) ? answer + 1 : answer, ms: 1500 }))
    }
    const result = await l.run((tx) => finishQmRound(tx, l.ctx, l.id, roundId))
    return { roundId, seed, config, result }
  }

  beforeAll(async () => {
    // ensureTodayQuests memanggil pemilih paper harian, yang membuka koneksi lewat server/db.ts (env dibaca saat pertama dipakai).
    process.env.KIRA_ORIGIN ??= 'http://localhost:3199'
    process.env.KIRA_SECRET ??= 'x'.repeat(40)
    process.env.DATABASE_URL_AUTH ??= urls.app
    process.env.KIRA_DATA_DIR ??= '.kira-local/data'
    await owner`insert into org (id, name) values (${orgId}, 'Org Arena __GTX_SEED__')`
  })

  afterAll(async () => {
    await owner`delete from org where id = ${orgId}`
    await Promise.all([owner.end(), app.client.end()])
  })

  it('Quick Maths: ronde latihan dari awal sampai akhir, XP masuk jalur hitung saja', async () => {
    const l = await newLearner()
    const { roundId } = await l.run((tx) => startQmRound(tx, l.ctx, l.id, base))
    const dto = await l.run((tx) => qmRoundDTO(tx, l.id, roundId))
    expect(dto.prompts).toHaveLength(10)
    expect(dto.hints).toBe(true)
    expect(JSON.stringify(dto)).not.toContain('"answer"')
    const { seed, config } = await sessionOf(roundId)

    // Jawaban harus berurutan
    await expect(l.run((tx) => answerQmRound(tx, l.id, { roundId, index: 1, answer: 1, ms: 500 }))).rejects.toMatchObject({ code: 'conflict' })

    const p0 = generateProblem(config, seed, 0)
    const first = await l.run((tx) => answerQmRound(tx, l.id, { roundId, index: 0, answer: p0.answer, ms: 800 }))
    expect(first).toEqual({ correct: true })
    // Jawaban pertama yang berlaku: panggilan ulang dengan nilai lain tidak mengubah hasil
    const again = await l.run((tx) => answerQmRound(tx, l.id, { roundId, index: 0, answer: p0.answer + 5, ms: 800 }))
    expect(again.correct).toBe(true)

    // Petunjuk sebelum menjawab tidak membuka angka akhir, dan memangkas XP soal itu
    const hint = await l.run((tx) => hintQmRound(tx, l.id, { roundId, index: 1 }))
    expect(hint.steps.length).toBeGreaterThanOrEqual(1)
    const p1 = generateProblem(config, seed, 1)
    await l.run((tx) => answerQmRound(tx, l.id, { roundId, index: 1, answer: p1.answer, ms: 900 }))

    // Jawaban salah memberi kunci dan petunjuk (mode tanpa waktu)
    const p2 = generateProblem(config, seed, 2)
    const wrong = await l.run((tx) => answerQmRound(tx, l.id, { roundId, index: 2, answer: p2.answer + 1, ms: 900 }))
    expect(wrong.correct).toBe(false)
    expect(wrong.answer).toBe(p2.answer)
    expect(wrong.hint?.steps.length).toBeGreaterThan(0)

    for (let i = 3; i < 10; i++) await l.run((tx) => answerQmRound(tx, l.id, { roundId, index: i, answer: generateProblem(config, seed, i).answer, ms: 1000 }))
    const result = await l.run((tx) => finishQmRound(tx, l.ctx, l.id, roundId))
    expect(result.correct).toBe(9)
    expect(result.answered).toBe(10)
    expect(result.reward.xp).toBeGreaterThan(0)
    expect(result.reward.trackLabel).toBe('Quick Maths XP')
    expect(result.reward.badges.map((b) => b.id)).toContain('qm-first')
    expect(result.review).toHaveLength(10)

    const totals = await l.run((tx) => trackTotals(tx, l.id))
    expect(totals).toEqual({ belajar: 0, hitung: result.reward.xp, pengetahuan: 0 })
    expect(await l.run((tx) => totalXp(tx, l.id))).toBe(0)

    // Selesai dua kali: hasil sama, XP tidak ganda
    const second = await l.run((tx) => finishQmRound(tx, l.ctx, l.id, roundId))
    expect(second).toEqual(result)
    const events = await owner`select count(*)::int as n from xp_event where learner_id = ${l.id} and track = 'hitung'`
    expect(events[0]!.n).toBe(1)
    await expect(l.run((tx) => answerQmRound(tx, l.id, { roundId, index: 9, answer: 1, ms: 1 }))).rejects.toMatchObject({ code: 'conflict' })
  })

  it('jawaban benar sempurna menaikkan level adaptif operasi itu', async () => {
    const l = await newLearner()
    const { result } = await playQm(l, base)
    expect(result.accuracy).toBe(100)
    expect(result.levelNotes.some((n) => n.startsWith('Adding is now level 4'))).toBe(true)
    const next = await l.run((tx) => qmHubDTO(tx, l.id))
    expect(next.levels.find((x) => x.op === 'add')?.level).toBe(4)
    expect(next.levels.find((x) => x.op === 'sub')?.level).toBe(3)
    expect(next.stats.rounds).toBe(1)
  })

  it('ronde campuran pendek tetap menggerakkan level karena hasilnya dikumpulkan per operasi', async () => {
    const l = await newLearner()
    for (let k = 0; k < 6; k++) await playQm(l, { ...base, op: 'mixed' })
    const hub = await l.run((tx) => qmHubDTO(tx, l.id))
    expect(hub.levels.reduce((n, x) => n + x.level, 0)).toBeGreaterThan(9)
  })

  it('ronde milik learner lain tidak bisa dibaca atau dijawab', async () => {
    const a = await newLearner()
    const b = await newLearner()
    const { roundId } = await a.run((tx) => startQmRound(tx, a.ctx, a.id, base))
    await expect(b.run((tx) => qmRoundDTO(tx, b.id, roundId))).rejects.toMatchObject({ code: 'not-found' })
    await expect(b.run((tx) => answerQmRound(tx, b.id, { roundId, index: 0, answer: 1, ms: 1 }))).rejects.toMatchObject({ code: 'not-found' })
    // Walau memakai id learner lain, RLS membatasi baris
    await expect(b.run((tx) => answerQmRound(tx, a.id, { roundId, index: 0, answer: 1, ms: 1 }))).rejects.toMatchObject({ code: 'not-found' })
    await expect(b.run((tx) => finishQmRound(tx, b.ctx, a.id, roundId))).rejects.toMatchObject({ code: 'not-found' })
  })

  it('sprint: jawaban setelah waktu habis ditolak, dan ronde tetap bisa diselesaikan', async () => {
    const l = await newLearner()
    const { roundId } = await l.run((tx) => startQmRound(tx, l.ctx, l.id, { ...base, mode: 'sprint60' }))
    const { seed, config } = await sessionOf(roundId)
    const p0 = generateProblem(config, seed, 0)
    const ok = await l.run((tx) => answerQmRound(tx, l.id, { roundId, index: 0, answer: p0.answer, ms: 700 }))
    // Mode berwaktu: hanya benar atau salah, tanpa kunci atau petunjuk
    expect(ok).toEqual({ correct: true })
    const p1 = generateProblem(config, seed, 1)
    const miss = await l.run((tx) => answerQmRound(tx, l.id, { roundId, index: 1, answer: p1.answer + 1, ms: 700 }))
    expect(miss).toEqual({ correct: false })
    await expect(l.run((tx) => hintQmRound(tx, l.id, { roundId, index: 2 }))).rejects.toMatchObject({ code: 'invalid' })
    await owner`update arena_session set started_at = now() - interval '100 seconds' where id = ${roundId}`
    await expect(l.run((tx) => answerQmRound(tx, l.id, { roundId, index: 2, answer: 1, ms: 700 }))).rejects.toThrow(/Time's up/)
    const result = await l.run((tx) => finishQmRound(tx, l.ctx, l.id, roundId))
    expect(result.answered).toBe(2)
    expect(result.correct).toBe(1)
    expect(result.ppm).toBe(1)
  })

  it('anti penggilingan: setelah enam ronde hari ini XP ronde berikutnya menyusut', async () => {
    const l = await newLearner()
    for (let k = 0; k < 6; k++) {
      await owner`insert into arena_session (org_id, learner_id, arena, mode, seed, config, date, finished_at, answered, correct, duration_ms, ppm)
        values (${orgId}, ${l.id}, 'hitung', 'practice', 'x', '{}'::jsonb, ${today}, now(), 10, 10, 20000, 30)`
    }
    const { config, seed, result } = await playQm(l, base)
    const answers = Array.from({ length: config.count }, (_, i) => ({ i, a: generateProblem(config, seed, i).answer, ms: 1500, t: (i + 1) * 1500 }))
    const scored = scoreQmRound(config, seed, answers)
    const raw = roundRawXp({ perCorrectXp: scored.perCorrectXp, answered: scored.answered, correct: scored.correct })
    expect(result.reward.xp).toBe(applyDiminishing(raw, 6))
    expect(result.reward.xp).toBeLessThan(raw)
    expect(result.reward.xpNote).toContain('a little less XP')
    const hub = await l.run((tx) => qmHubDTO(tx, l.id))
    expect(hub.roundsToday).toBe(7)
    expect(hub.xpNote).not.toBeNull()
  })

  it('misi harian: empat langkah, bonus sekali, langkah yang sama tidak diulang', async () => {
    const l = await newLearner()
    const steps = ['warmup', 'sprint', 'flash', 'tables'] as const
    let last
    for (let k = 0; k < steps.length; k++) {
      const step = steps[k]!
      const count = step === 'sprint' ? 12 : undefined
      last = await playQm(l, { ...base, mission: step }, count ? { count } : {})
      expect(last.result.mission).toMatchObject({ step, stepsDone: k + 1, stepsTotal: 4, complete: k === 3 })
    }
    expect(last!.result.mission?.bonusXp).toBe(25)
    const bonus = await owner`select amount from xp_event where learner_id = ${l.id} and reason = 'mission'`
    expect(bonus.map((r) => r.amount)).toEqual([25])
    await expect(l.run((tx) => startQmRound(tx, l.ctx, l.id, { ...base, mission: 'warmup' }))).rejects.toMatchObject({ code: 'conflict' })
    const hub = await l.run((tx) => qmHubDTO(tx, l.id))
    expect(hub.mission.done).toBe(true)
    expect(hub.mission.streak).toBe(1)
    expect(last!.result.reward.badges.map((b) => b.id)).toEqual(expect.arrayContaining(['qm-mission-1']))
  })

  it('pelajaran strategi: XP sekali, selesai bila empat dari lima benar', async () => {
    const l = await newLearner()
    const input: QmStartInput = { ...base, focus: 'bonds10', auto: false }
    const first = await playQm(l, input, { wrongAt: [4] })
    expect(first.config.count).toBe(5)
    expect(first.result.strategyDone).toEqual({ id: 'bonds10', title: 'Pairs that make 10' })
    const rows = await owner`select amount from xp_event where learner_id = ${l.id} and reason = 'strategy'`
    expect(rows).toHaveLength(1)
    const second = await playQm(l, input)
    expect(second.result.strategyDone).not.toBeNull()
    expect(await owner`select count(*)::int as n from xp_event where learner_id = ${l.id} and reason = 'strategy'`).toEqual([{ n: 1 }])
    const hub = await l.run((tx) => qmHubDTO(tx, l.id))
    expect(hub.strategies.find((s) => s.id === 'bonds10')?.done).toBe(true)
  })

  it('tabel perkalian dikuasai, Flash Anzan dan sempoa naik level', async () => {
    const l = await newLearner()
    const tables = await playQm(l, { ...base, mode: 'tables', table: 7 }, { count: 12 })
    expect(tables.result.correct).toBe(12)
    const flash = await playQm(l, { ...base, mode: 'flash' })
    expect(flash.result.levelNotes.some((n) => n.startsWith('Flash Anzan is now level 2'))).toBe(true)
    const soroban = await playQm(l, { ...base, mode: 'soroban', sorobanStage: 'anzan' })
    expect(soroban.config.count).toBe(8)
    const hub = await l.run((tx) => qmHubDTO(tx, l.id))
    expect(hub.flash.level).toBe(2)
    expect(hub.flash.cleared).toBe(1)
    expect(hub.soroban.anzan).toBe(2)
    const stats = await owner`select data from arena_state where learner_id = ${l.id} and arena = 'hitung'`
    expect(stats[0]!.data.tablesMastered).toEqual([7])
    expect(stats[0]!.data.sorobanRounds).toBe(1)
    expect(stats[0]!.data.anzanPassed).toBe(1)
  })

  it('Quiz Arena: kuis bendera dari awal sampai akhir, XP masuk jalur pengetahuan', async () => {
    const l = await newLearner()
    const { roundId } = await l.run((tx) => startQuizRound(tx, l.ctx, l.id, { topic: 'flags', mode: 'quiz' }))
    const dto = await l.run((tx) => quizRoundDTO(tx, l.id, roundId))
    expect(dto.questions).toHaveLength(10)
    expect(JSON.stringify(dto)).not.toContain('"correct"')
    const rows = await owner`select seed, config from arena_session where id = ${roundId}`
    const seed = rows[0]!.seed as string
    const plan = (rows[0]!.config as { plan: string[] }).plan
    let rightFirst = 0
    for (let i = 0; i < plan.length; i++) {
      const key = roundQuestion(plan, seed, i).key
      const answer = key.kind === 'mc' ? (i === 4 ? (key.correct + 1) % 3 : key.correct) : key.correct
      const res = await l.run((tx) => answerQuizRound(tx, l.id, { roundId, index: i, answer, ms: 2000 }))
      expect(res.explain).toBeTruthy()
      if (res.correct) rightFirst++
    }
    expect(rightFirst).toBeGreaterThanOrEqual(8)
    const result = await l.run((tx) => finishQuizRound(tx, l.ctx, l.id, roundId))
    expect(result.reward.trackLabel).toBe('Quiz XP')
    expect(result.reward.xp).toBeGreaterThan(0)
    expect(result.reward.badges.map((b) => b.id)).toContain('quiz-first')
    expect(result.review).toHaveLength(10)
    expect(await l.run((tx) => finishQuizRound(tx, l.ctx, l.id, roundId))).toEqual(result)
    const totals = await l.run((tx) => trackTotals(tx, l.id))
    expect(totals.pengetahuan).toBe(result.reward.xp)
    expect(totals.hitung).toBe(0)
    const state = await owner`select data from arena_state where learner_id = ${l.id} and arena = 'pengetahuan'`
    expect(Object.keys(state[0]!.data.know).length).toBeGreaterThanOrEqual(5)
    const hub = await l.run((tx) => quizHubDTO(tx, l.id))
    expect(hub.topics.find((t) => t.id === 'flags')?.seen).toBeGreaterThanOrEqual(5)
  })

  it('Quiz Arena: speed quiz tidak membuka kunci, kartu belajar memberi XP kecil', async () => {
    const l = await newLearner()
    const { roundId } = await l.run((tx) => startQuizRound(tx, l.ctx, l.id, { topic: 'capitals', mode: 'speed' }))
    const rows = await owner`select seed, config from arena_session where id = ${roundId}`
    const seed = rows[0]!.seed as string
    const plan = (rows[0]!.config as { plan: string[] }).plan
    expect(plan).toHaveLength(60)
    const key = roundQuestion(plan, seed, 0).key
    const res = await l.run((tx) => answerQuizRound(tx, l.id, { roundId, index: 0, answer: key.kind === 'mc' ? key.correct : key.correct, ms: 900 }))
    expect(res).toEqual({ correct: true })
    await owner`update arena_session set started_at = now() - interval '90 seconds' where id = ${roundId}`
    await expect(l.run((tx) => answerQuizRound(tx, l.id, { roundId, index: 1, answer: 0, ms: 900 }))).rejects.toThrow(/Time's up/)
    const done = await l.run((tx) => finishQuizRound(tx, l.ctx, l.id, roundId))
    expect(done.correct).toBe(1)

    const learn = await l.run((tx) => startQuizRound(tx, l.ctx, l.id, { topic: 'provinces', mode: 'learn' }))
    const deck = await l.run((tx) => quizRoundDTO(tx, l.id, learn.roundId))
    expect(deck.cards).toHaveLength(12)
    for (let i = 0; i < 12; i++) await l.run((tx) => answerQuizRound(tx, l.id, { roundId: learn.roundId, index: i, answer: 1, ms: 3000 }))
    const cards = await l.run((tx) => finishQuizRound(tx, l.ctx, l.id, learn.roundId))
    expect(cards.reward.xp).toBeLessThanOrEqual(10)
    expect(cards.reward.xp).toBeGreaterThan(0)
    expect(cards.title).toBe('Cards done')
  })

  it('ronde yang berakhir menyelesaikan sesi Quick Maths dan Quiz Arena dari tutor, dan hanya yang cocok', async () => {
    const l = await newLearner()
    const tutorId = randomUUID()
    await owner`insert into member_profile (user_id, org_id, name, role, email) values (${tutorId}, ${orgId}, 'Tutor Arena', 'tutor', 'tutor-arena-link@example.test')`
    await owner`update learner_profile set rest_weekdays = '{}' where user_id = ${l.id}`
    const [week] = await owner`insert into plan_week (org_id, learner_id, week_start, status, published_at, created_by) values (${orgId}, ${l.id}, ${weekStart(today)}, 'published', now(), ${tutorId}) returning id`
    await owner`insert into plan_slot (org_id, plan_week_id, learner_id, date, subject, kind, session, required, mode, question_count)
      values (${orgId}, ${week!.id}, ${l.id}, ${today}, 'math', 'quest', 'quick-maths', false, 'latihan', 10),
             (${orgId}, ${week!.id}, ${l.id}, ${today}, 'science', 'quest', 'knowledge', false, 'latihan', 10)`
    const day = await l.run(async (tx) => ensureTodayQuests(tx, l.ctx, await loadLearner(tx, l.id), today))
    const statusOf = async (session: string) => (await owner`select status from quest where learner_id = ${l.id} and date = ${today} and session = ${session}`)[0]!.status
    expect(day.filter((q) => q.kind === 'extra').map((q) => q.session).sort()).toEqual(['knowledge', 'quick-maths'])

    await playQm(l, base, { count: 5 })
    expect(await statusOf('quick-maths')).toBe('done')
    expect(await statusOf('knowledge')).not.toBe('done')

    const { roundId } = await l.run((tx) => startQuizRound(tx, l.ctx, l.id, { topic: 'flags', mode: 'quiz' }))
    const rows = await owner`select seed, config from arena_session where id = ${roundId}`
    const plan = (rows[0]!.config as { plan: string[] }).plan
    for (let i = 0; i < plan.length; i++) {
      const key = roundQuestion(plan, rows[0]!.seed as string, i).key
      await l.run((tx) => answerQuizRound(tx, l.id, { roundId, index: i, answer: key.correct, ms: 1500 }))
    }
    await l.run((tx) => finishQuizRound(tx, l.ctx, l.id, roundId))
    expect(await statusOf('knowledge')).toBe('done')
  })

  it('aksesori hanya bisa dipakai setelah didapat dari level jalur', async () => {
    const l = await newLearner()
    const system = (fn: (tx: Tx) => Promise<void>) => withOrg(app.db, { orgId, userId: '00000000-0000-0000-0000-000000000000', role: 'tutor' }, fn)
    const set = async (a: Parameters<typeof applyAccessory>[2]) => {
      await l.run((tx) => assertAccessoryEarned(tx, l.id, a))
      await system((tx) => applyAccessory(tx, l.id, a))
    }
    await expect(set('visor')).rejects.toMatchObject({ code: 'forbidden' })
    await owner`insert into xp_event (org_id, learner_id, amount, reason, ref, date, track) values (${orgId}, ${l.id}, 300, 'round', 'seed-xp', ${today}, 'hitung')`
    await set('visor')
    const shell = await l.run(async (tx) => learnerShell(tx, await loadLearner(tx, l.id)))
    expect(shell.accessory).toBe('visor')
    await expect(set('crown')).rejects.toBeInstanceOf(AppError)
    await set(null)
    expect((await l.run(async (tx) => learnerShell(tx, await loadLearner(tx, l.id)))).accessory).toBeNull()
  })

  it('salinan data learner memuat jalur XP dan ronde arena', async () => {
    const l = await newLearner()
    await playQm(l, base)
    const tutor = { orgId, userId: randomUUID(), role: 'tutor' as const }
    const out = await withOrg(app.db, tutor, (tx) => learnerExport(tx, l.id))
    const json = JSON.parse(out.json) as { xpEvents: { track: string }[]; arenaRounds: { arena: string; mode: string; answered: number }[]; arenaProgress: { arena: string }[] }
    expect(json.xpEvents.map((e) => e.track)).toContain('hitung')
    expect(json.arenaRounds).toHaveLength(1)
    expect(json.arenaRounds[0]).toMatchObject({ arena: 'hitung', mode: 'practice', answered: 10 })
    expect(json.arenaProgress.map((a) => a.arena)).toEqual(['hitung'])
  })

  it('batas layar harian menghentikan ronde baru', async () => {
    const l = await newLearner()
    await owner`insert into day_record (org_id, learner_id, date, minutes) values (${orgId}, ${l.id}, ${today}, 120)`
    await expect(l.run((tx) => startQmRound(tx, l.ctx, l.id, base))).rejects.toMatchObject({ code: 'forbidden' })
    await expect(l.run((tx) => startQuizRound(tx, l.ctx, l.id, { topic: 'flags', mode: 'quiz' }))).rejects.toMatchObject({ code: 'forbidden' })
    const hub = await l.run((tx) => qmHubDTO(tx, l.id))
    expect(hub.limitReached).toBe(true)
  })
})
