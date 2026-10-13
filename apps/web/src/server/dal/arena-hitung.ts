import 'server-only'
import { randomUUID } from 'node:crypto'
import { and, desc, eq, isNotNull, sql } from 'drizzle-orm'
import {
  ARENA_BADGES,
  FULL_XP_ROUNDS,
  MISSION_BONUS_XP,
  MISSION_MINUTES,
  MISSION_STEPS,
  QM_MODE_INFO,
  QM_OPS,
  STRATEGIES,
  STRATEGY_XP,
  SPRINT_GRACE_MS,
  applyDiminishing,
  clientPrompts,
  defaultQmConfig,
  describeFlashLevel,
  describeLevel,
  generateProblem,
  hintFor,
  jakartaDate,
  levelUps,
  missionComplete,
  missionStreak,
  missionTable,
  newlyEarnedAccessories,
  nextSimpleLevel,
  roundRawXp,
  scoreQmRound,
  strategyById,
  summariseQm,
  trackLevels,
  updateLevelsAccumulated,
  type IsoDate,
  type QmConfig,
  type QmOp,
  type QmStatRow,
  type StoredAnswer,
} from '@kira/core'
import { tables } from '@kira/db'
import type {
  ArenaRewardDTO,
  QmAnswerResult,
  QmHubDTO,
  QmLessonDTO,
  QmResultDTO,
  QmRoundDTO,
  QmStartInput,
  QmStatsDTO,
} from '@/lib/dto-arena'
import type { OrgContext, Tx } from '../db'
import { AppError, conflict, invalid } from '../errors'
import { trackDTOs } from './arena-tracks'
import { finishedRoundsOn, loadQmState, saveArenaState, trackTotals, type QmState } from './arena-state'
import { assertCanPlay, assertOpen, clampMs, dropStaleRounds, loadSession, xpNote, type SessionRow } from './arena-session'
import { awardBadges, learnerShell, loadLearner } from './learner-core'

const { arenaSession, xpEvent } = tables

const OP_WORD: Record<QmOp, string> = { add: 'Adding', sub: 'Taking away', mul: 'Times', div: 'Sharing' }

// ---------------------------------------------------------------------------
// Pengaturan ronde

function startInputOf(cfg: QmConfig): QmStartInput {
  return {
    mode: cfg.mode,
    op: cfg.op,
    digits: cfg.digits,
    carry: cfg.carry,
    auto: cfg.auto,
    table: cfg.table,
    division: cfg.division,
    flashLevel: cfg.mode === 'flash' ? cfg.flashLevel : null,
    sorobanStage: cfg.sorobanStage,
    sorobanLevel: cfg.mode === 'soroban' ? cfg.sorobanLevel : null,
    focus: cfg.focus,
    mission: null,
  }
}

function parseConfig(raw: unknown): QmConfig {
  const cfg = raw as QmConfig
  if (!cfg || typeof cfg !== 'object' || !QM_MODE_INFO[cfg.mode]) throw new AppError('invalid', 'That round is not valid.')
  return cfg
}

function parseAnswers(raw: unknown): StoredAnswer[] {
  return Array.isArray(raw) ? (raw as StoredAnswer[]) : []
}

function roundTitle(cfg: QmConfig, mission: string | null): string {
  if (cfg.focus) return strategyById(cfg.focus)?.title ?? 'Strategy'
  if (mission) return MISSION_STEPS.find((s) => s.id === mission)?.title ?? 'Daily mission'
  if (cfg.mode === 'tables') return `${cfg.table} times table`
  if (cfg.mode === 'soroban') return cfg.sorobanStage === 'read' ? 'Soroban: read the beads' : cfg.sorobanStage === 'set' ? 'Soroban: set the beads' : 'Soroban in your head'
  if (cfg.mode === 'flash') return `Flash Anzan level ${cfg.flashLevel}`
  return QM_MODE_INFO[cfg.mode].title
}

function roundSubtitle(cfg: QmConfig): string {
  if (cfg.focus) return 'Try the strategy on five questions.'
  if (cfg.mode === 'flash') return describeFlashLevel(cfg.flashLevel)
  if (cfg.mode === 'soroban') return QM_MODE_INFO.soroban.blurb
  if (cfg.mode === 'tables') return cfg.division ? 'Times and sharing facts.' : 'Times facts.'
  if (cfg.auto) return 'Kira keeps the questions just right for you.'
  const op = cfg.op === 'mixed' ? 'All four operations' : OP_WORD[cfg.op]
  return `${op}, ${cfg.digits === 'mixed' ? 'mixed digits' : `${cfg.digits} digit${cfg.digits === 1 ? '' : 's'}`}, ${cfg.carry ? 'with' : 'without'} carrying`
}

async function missionStepsDoneOn(tx: Tx, learnerId: string, date: IsoDate): Promise<string[]> {
  const rows = await tx
    .select({ step: arenaSession.missionStep })
    .from(arenaSession)
    .where(and(eq(arenaSession.learnerId, learnerId), eq(arenaSession.arena, 'hitung'), eq(arenaSession.date, date), isNotNull(arenaSession.missionStep), isNotNull(arenaSession.finishedAt)))
  return rows.map((r) => r.step as string)
}

export async function startQmRound(tx: Tx, ctx: OrgContext, learnerId: string, input: QmStartInput): Promise<{ roundId: string }> {
  const learner = await loadLearner(tx, learnerId)
  const today = jakartaDate()
  await assertCanPlay(tx, learner, today)
  await dropStaleRounds(tx, learnerId)
  const state = await loadQmState(tx, learnerId, learner.grade)

  let mode = input.mode
  let missionStep: string | null = null
  if (input.mission) {
    const step = MISSION_STEPS.find((x) => x.id === input.mission)
    if (!step) throw invalid('That mission step does not exist.')
    if ((await missionStepsDoneOn(tx, learnerId, today)).includes(step.id)) throw conflict('You already finished that step today.')
    mode = step.mode
    missionStep = step.id
  }
  const cfg: QmConfig = {
    ...defaultQmConfig(mode),
    ...(missionStep
      ? { op: 'mixed' as const, digits: 'mixed' as const, carry: true, auto: true, table: missionTable(today), division: true }
      : { op: input.op, digits: input.digits, carry: input.carry, auto: input.auto, table: input.table, division: input.division, sorobanStage: input.sorobanStage, focus: input.focus }),
    levels: { ...state.levels },
  }
  cfg.flashLevel = input.flashLevel && !missionStep ? input.flashLevel : state.flashLevel
  cfg.sorobanLevel = input.sorobanLevel && !missionStep ? input.sorobanLevel : state.soroban[cfg.sorobanStage]
  if (missionStep === 'tables') cfg.count = 12
  if (cfg.focus) {
    cfg.mode = 'practice'
    cfg.count = 5
    cfg.auto = false
  }
  const seed = randomUUID()
  const [row] = await tx
    .insert(arenaSession)
    .values({ orgId: ctx.orgId, learnerId, arena: 'hitung', mode: cfg.mode, missionStep, seed, config: cfg, date: today, total: cfg.count })
    .returning({ id: arenaSession.id })
  return { roundId: row!.id }
}

// ---------------------------------------------------------------------------
// Jawaban dan petunjuk

type InterimResult = { hints?: number[] } | null

function hintsOf(row: SessionRow): number[] {
  const r = row.result as InterimResult
  return Array.isArray(r?.hints) ? r!.hints! : []
}

export async function hintQmRound(tx: Tx, learnerId: string, input: { roundId: string; index: number }): Promise<{ title: string; steps: string[] }> {
  const row = await loadSession(tx, learnerId, input.roundId, 'hitung', true)
  assertOpen(row)
  const cfg = parseConfig(row.config)
  if (QM_MODE_INFO[cfg.mode].timed) throw invalid('Hints are not available in timed rounds.')
  const answers = parseAnswers(row.answers)
  if (input.index !== answers.length || input.index >= cfg.count) throw conflict('Hints are only for the question you are on.')
  const hint = hintFor(generateProblem(cfg, row.seed, input.index))
  if (!hint) throw invalid('There is no hint for this question.')
  const hints = hintsOf(row)
  if (!hints.includes(input.index)) await tx.update(arenaSession).set({ result: { hints: [...hints, input.index] } }).where(eq(arenaSession.id, row.id))
  return { title: hint.title, steps: hint.steps.slice(0, -1) }
}

export async function answerQmRound(tx: Tx, learnerId: string, input: { roundId: string; index: number; answer: number | null; ms: number }): Promise<QmAnswerResult> {
  const row = await loadSession(tx, learnerId, input.roundId, 'hitung', true)
  assertOpen(row)
  const cfg = parseConfig(row.config)
  if (input.index < 0 || input.index >= cfg.count) throw invalid('That question does not exist.')
  const info = QM_MODE_INFO[cfg.mode]
  const answers = parseAnswers(row.answers)
  const problem = generateProblem(cfg, row.seed, input.index)
  const reveal = (ok: boolean): QmAnswerResult => {
    if (ok || info.timed) return { correct: ok }
    const hint = hintFor(problem)
    return { correct: false, answer: problem.answer, ...(hint ? { hint: { title: hint.title, steps: hint.steps } } : {}) }
  }
  // Jawaban pertama untuk satu soal yang berlaku; panggilan ulang hanya mengembalikan hasilnya.
  const prev = answers[input.index]
  if (prev) return reveal(prev.a === problem.answer)
  if (input.index !== answers.length) throw conflict('Answer the questions in order.')
  const elapsed = Date.now() - row.startedAt.getTime()
  if (info.limitSec && elapsed > info.limitSec * 1000 + SPRINT_GRACE_MS) throw conflict("Time's up.")
  const stored: StoredAnswer = { i: input.index, a: input.answer, ms: clampMs(input.ms), t: elapsed, ...(hintsOf(row).includes(input.index) ? { hint: true } : {}) }
  await tx.update(arenaSession).set({ answers: [...answers, stored] }).where(eq(arenaSession.id, row.id))
  return reveal(input.answer === problem.answer)
}

// ---------------------------------------------------------------------------
// Selesai: XP, level adaptif, lencana

type PriorBests = { sprintPpm: number | null; targetSec: number | null }

async function priorBests(tx: Tx, learnerId: string, excludeId: string): Promise<PriorBests> {
  const s = arenaSession
  const r = (
    await tx
      .select({
        ppm: sql<number | null>`max(${s.ppm}) filter (where ${s.mode} in ('sprint60', 'sprint120') and ${s.answered} >= 10 and ${s.correct}::float / nullif(${s.answered}, 0) >= 0.8)`,
        target: sql<number | null>`min(${s.durationMs}) filter (where ${s.mode} = 'target20' and ${s.answered} = 20 and ${s.correct} = 20)`,
      })
      .from(s)
      .where(and(eq(s.learnerId, learnerId), eq(s.arena, 'hitung'), isNotNull(s.finishedAt), sql`${s.id} <> ${excludeId}`))
  )[0]
  return { sprintPpm: r?.ppm ?? null, targetSec: r?.target != null ? r.target / 1000 : null }
}

function resultLines(cfg: QmConfig, r: ReturnType<typeof scoreQmRound>): string[] {
  const total = cfg.count
  const sec = Math.round(r.durationMs / 100) / 10
  if (cfg.mode === 'sprint60' || cfg.mode === 'sprint120') return [`You got ${r.correct} right in ${QM_MODE_INFO[cfg.mode].limitSec} seconds.`, `That is ${r.ppm} right a minute.`]
  if (cfg.mode === 'target20') return [`${r.correct} of 20 right in ${sec} seconds.`]
  if (cfg.mode === 'flash') return [`You got ${r.correct} of ${total} right at level ${cfg.flashLevel}.`]
  if (cfg.mode === 'soroban') return [`You got ${r.correct} of ${total} right.`]
  return [`You got ${r.correct} of ${total} right.`, ...(r.ppm > 0 && cfg.mode !== 'practice' ? [`That is ${r.ppm} right a minute.`] : [])]
}

export async function finishQmRound(tx: Tx, ctx: OrgContext, learnerId: string, roundId: string): Promise<QmResultDTO> {
  const row = await loadSession(tx, learnerId, roundId, 'hitung', true)
  if (row.finishedAt) {
    const stored = (row.result as { dto?: QmResultDTO } | null)?.dto
    if (stored) return stored
    throw conflict('This round is already finished.')
  }
  const learner = await loadLearner(tx, learnerId)
  const cfg = parseConfig(row.config)
  const answers = parseAnswers(row.answers)
  const r = scoreQmRound(cfg, row.seed, answers)
  const state: QmState = await loadQmState(tx, learnerId, learner.grade, true)
  const roundsBefore = await finishedRoundsOn(tx, learnerId, 'hitung', row.date)
  const before = await trackTotals(tx, learnerId)
  const bests = await priorBests(tx, learnerId, row.id)
  const levelNotes: string[] = []
  const lines = resultLines(cfg, r)

  // Level adaptif (hanya ronde otomatis berisi soal aritmetika campuran, bukan pelajaran strategi)
  const arithmetic = ['practice', 'sprint60', 'sprint120', 'target20'].includes(cfg.mode) && !cfg.focus
  if (arithmetic && cfg.auto) {
    const u = updateLevelsAccumulated(state.levels, state.pending, r.perOp, state.ppm)
    state.levels = u.levels
    state.ppm = { ...state.ppm, ...u.ppm }
    state.pending = u.pending
    for (const c of u.changes) {
      levelNotes.push(c.to > c.from ? `${OP_WORD[c.op]} is now level ${c.to}: ${describeLevel(c.op, c.to)}.` : `Kira moved ${OP_WORD[c.op].toLowerCase()} to level ${c.to} so it feels just right.`)
    }
  }
  for (const op of QM_OPS) if ((r.perOp[op]?.correct ?? 0) > 0 && !state.opsPlayed.includes(op)) state.opsPlayed.push(op)
  if (cfg.mode === 'flash') {
    const next = nextSimpleLevel(cfg.flashLevel, r.correct, cfg.count, 8)
    if (r.correct / cfg.count >= 0.8) state.flashCleared = Math.max(state.flashCleared, cfg.flashLevel)
    if (next !== cfg.flashLevel) levelNotes.push(next > cfg.flashLevel ? `Flash Anzan is now level ${next}: ${describeFlashLevel(next)}.` : `Kira moved Flash Anzan to level ${next} so it feels just right.`)
    state.flashLevel = next
  }
  if (cfg.mode === 'soroban') {
    const next = nextSimpleLevel(cfg.sorobanLevel, r.correct, cfg.count, 4)
    state.soroban[cfg.sorobanStage] = next
    state.sorobanRounds += 1
    if (cfg.sorobanStage === 'anzan' && r.correct / cfg.count >= 0.75) state.anzanPassed += 1
    if (next > cfg.sorobanLevel) levelNotes.push(`The soroban is now level ${next}. There are more rods.`)
  }
  if (cfg.mode === 'tables' && r.answered >= 10 && r.correct / r.answered >= 0.9 && !state.tablesMastered.includes(cfg.table)) state.tablesMastered.push(cfg.table)
  let strategyDone: QmResultDTO['strategyDone'] = null
  if (cfg.focus && r.correct >= 4) {
    const s = strategyById(cfg.focus)
    if (s) strategyDone = { id: s.id, title: s.title }
    if (!state.strategies.includes(cfg.focus)) state.strategies.push(cfg.focus)
  }

  // XP: ronde, pelajaran strategi (sekali), misi harian (sekali per hari)
  const raw = roundRawXp({ perCorrectXp: r.perCorrectXp, answered: r.answered, correct: r.correct })
  const xp = applyDiminishing(raw, roundsBefore)
  const extra: { reason: string; ref: string; amount: number }[] = []
  if (strategyDone) extra.push({ reason: 'strategy', ref: strategyDone.id, amount: STRATEGY_XP })
  let mission: QmResultDTO['mission'] = null
  if (row.missionStep) {
    const done = [...new Set([...(await missionStepsDoneOn(tx, learnerId, row.date)), row.missionStep])]
    const complete = missionComplete(done)
    const bonus = complete && !state.missionDates.includes(row.date) ? MISSION_BONUS_XP : 0
    if (bonus > 0) {
      state.missionDates.push(row.date)
      extra.push({ reason: 'mission', ref: row.date, amount: bonus })
    }
    mission = { step: row.missionStep, stepsDone: done.length, stepsTotal: MISSION_STEPS.length, complete, bonusXp: bonus }
  }
  const events = [...(xp > 0 ? [{ reason: 'round', ref: row.id, amount: xp }] : []), ...extra]
  for (const e of events) {
    await tx.insert(xpEvent).values({ orgId: ctx.orgId, learnerId, amount: e.amount, reason: e.reason, ref: e.ref, date: row.date, track: 'hitung' }).onConflictDoNothing()
  }
  const earnedXp = events.reduce((n, e) => n + e.amount, 0)

  await saveArenaState(tx, ctx, learnerId, 'hitung', state)
  const personal: string[] = []
  const sprint = cfg.mode === 'sprint60' || cfg.mode === 'sprint120'
  if (sprint && r.answered >= 10 && r.correct / r.answered >= 0.8 && r.ppm > (bests.sprintPpm ?? 0) && bests.sprintPpm !== null) personal.push(`A new best sprint: ${r.ppm} a minute.`)
  if (cfg.mode === 'target20' && r.answered === 20 && r.correct === 20 && bests.targetSec !== null && r.durationMs / 1000 < bests.targetSec) personal.push(`A new Target 20 record: ${Math.round(r.durationMs / 100) / 10} seconds.`)

  // Simpan hasil dulu supaya hitungan lencana dan level melihat ronde ini.
  await tx
    .update(arenaSession)
    .set({ finishedAt: new Date(), answered: r.answered, correct: r.correct, durationMs: r.durationMs, ppm: r.ppm, xp: earnedXp })
    .where(eq(arenaSession.id, row.id))
  const newBadges = await awardBadges(tx, ctx, learner, row.date)
  const after = await trackTotals(tx, learnerId)
  const ups = levelUps(before, after).find((u) => u.track === 'hitung')
  const accessories = newlyEarnedAccessories(trackLevels(before), trackLevels(after))
  const reward: ArenaRewardDTO = {
    xp: earnedXp,
    xpNote: xpNote(roundsBefore),
    trackLabel: 'Quick Maths XP',
    levelUp: ups ? { level: ups.to, label: `Quick Maths level ${ups.to}` } : null,
    badges: newBadges
      .map((b) => ARENA_BADGES.find((a) => a.id === b.id) ?? null)
      .filter((b): b is NonNullable<typeof b> => b !== null)
      .map((b) => ({ id: b.id, title: b.title, description: b.description, glyph: b.glyph })),
    accessories: accessories.map((a) => ({ id: a.id, label: a.label })),
    tracks: trackDTOs(after),
  }
  const accuracy = r.answered > 0 ? Math.round((r.correct / r.answered) * 100) : 0
  const dto: QmResultDTO = {
    answered: r.answered,
    correct: r.correct,
    accuracy,
    ppm: r.ppm,
    durationSec: Math.round(r.durationMs / 1000),
    title: strategyDone ? 'Strategy learned' : 'Round done',
    lines: [...lines, ...personal],
    review: r.review,
    reward,
    strategyDone,
    mission,
    levelNotes,
    nextHref: row.missionStep ? '/quick-maths#mission' : '/quick-maths',
  }
  await tx
    .update(arenaSession)
    .set({ result: { dto, kinds: r.kinds, perOp: r.perOp, levelNotes } })
    .where(eq(arenaSession.id, row.id))
  return dto
}

// ---------------------------------------------------------------------------
// Halaman ronde

export async function qmRoundDTO(tx: Tx, learnerId: string, roundId: string): Promise<QmRoundDTO> {
  const row = await loadSession(tx, learnerId, roundId, 'hitung')
  const learner = await loadLearner(tx, learnerId)
  const cfg = parseConfig(row.config)
  const info = QM_MODE_INFO[cfg.mode]
  const answers = parseAnswers(row.answers)
  const done = answers.map((a) => {
    if (info.timed) return { i: a.i, ok: null }
    return { i: a.i, ok: a.a === generateProblem(cfg, row.seed, a.i).answer }
  })
  const right = answers.filter((a) => a.a !== null && a.a === generateProblem(cfg, row.seed, a.i).answer).length
  const finished = row.finishedAt ? ((row.result as { dto?: QmResultDTO } | null)?.dto ?? null) : null
  const hintsOn = !info.timed && cfg.mode !== 'flash' && cfg.mode !== 'soroban'
  return {
    shell: await learnerShell(tx, learner),
    id: row.id,
    mode: cfg.mode,
    title: roundTitle(cfg, row.missionStep),
    subtitle: roundSubtitle(cfg),
    timed: info.timed,
    limitSec: info.limitSec,
    elapsedSec: Math.max(0, Math.floor((Date.now() - row.startedAt.getTime()) / 1000)),
    prompts: clientPrompts(cfg, row.seed),
    done,
    right,
    hints: hintsOn,
    mission: row.missionStep ? { step: row.missionStep, title: MISSION_STEPS.find((s) => s.id === row.missionStep)?.title ?? 'Daily mission' } : null,
    focus: cfg.focus ? { id: cfg.focus, title: strategyById(cfg.focus)?.title ?? 'Strategy' } : null,
    finished,
    exitHref: cfg.focus ? `/quick-maths/lessons/${cfg.focus}` : '/quick-maths',
    again: row.missionStep ? null : startInputOf(cfg),
  }
}

// ---------------------------------------------------------------------------
// Hub, statistik, pelajaran

export async function qmStatRows(tx: Tx, learnerId: string, limit = 300): Promise<QmStatRow[]> {
  const rows = await tx
    .select({ date: arenaSession.date, mode: arenaSession.mode, answered: arenaSession.answered, correct: arenaSession.correct, durationMs: arenaSession.durationMs, ppm: arenaSession.ppm, result: arenaSession.result })
    .from(arenaSession)
    .where(and(eq(arenaSession.learnerId, learnerId), eq(arenaSession.arena, 'hitung'), isNotNull(arenaSession.finishedAt)))
    .orderBy(desc(arenaSession.startedAt))
    .limit(limit)
  return rows.map((r) => ({
    date: r.date,
    mode: r.mode as QmStatRow['mode'],
    answered: r.answered ?? 0,
    correct: r.correct ?? 0,
    durationMs: r.durationMs ?? 0,
    ppm: r.ppm ?? 0,
    kinds: (r.result as { kinds?: QmStatRow['kinds'] } | null)?.kinds ?? {},
  }))
}

export function qmStatsDTO(rows: QmStatRow[], today: IsoDate): QmStatsDTO {
  const s = summariseQm(rows, today)
  return {
    rounds: s.rounds,
    accuracy: s.accuracy,
    ppm: s.ppm,
    bestSprintPpm: s.bestSprintPpm,
    bestTargetSec: s.bestTargetSec,
    bestAccuracyRound: s.bestAccuracyRound,
    week: s.week.map((d) => ({ date: d.date, label: d.label, rounds: d.rounds, correct: d.correct, ppm: d.ppm })),
    slowest: s.slowest.map((f) => ({ fact: f.fact, label: f.label, avgSec: Math.round(f.avgMs / 100) / 10, accuracy: f.accuracy, n: f.n })),
  }
}

export async function qmHubDTO(tx: Tx, learnerId: string): Promise<QmHubDTO> {
  const learner = await loadLearner(tx, learnerId)
  const today = jakartaDate()
  const state = await loadQmState(tx, learnerId, learner.grade)
  const totals = await trackTotals(tx, learnerId)
  const doneSteps = await missionStepsDoneOn(tx, learnerId, today)
  const roundsToday = await finishedRoundsOn(tx, learnerId, 'hitung', today)
  const rows = await qmStatRows(tx, learnerId)
  const limitReached = await assertCanPlay(tx, learner, today).then(
    () => false,
    () => true,
  )
  return {
    shell: await learnerShell(tx, learner, today),
    tracks: trackDTOs(totals),
    modes: (Object.keys(QM_MODE_INFO) as (keyof typeof QM_MODE_INFO)[]).map((mode) => ({ mode, title: QM_MODE_INFO[mode].title, blurb: QM_MODE_INFO[mode].blurb, timed: QM_MODE_INFO[mode].timed })),
    levels: QM_OPS.map((op) => ({ op, label: OP_WORD[op], level: state.levels[op], description: describeLevel(op, state.levels[op]) })),
    flash: { level: state.flashLevel, description: describeFlashLevel(state.flashLevel), cleared: state.flashCleared },
    soroban: state.soroban,
    strategies: STRATEGIES.map((s) => ({ id: s.id, title: s.title, summary: s.summary, done: state.strategies.includes(s.id) })),
    mission: {
      steps: MISSION_STEPS.map((s) => ({ id: s.id, title: s.id === 'tables' ? `${missionTable(today)} times table` : s.title, minutes: s.minutes, done: doneSteps.includes(s.id), mode: s.mode })),
      done: missionComplete(doneSteps),
      table: missionTable(today),
      minutes: MISSION_MINUTES,
      streak: missionStreak(state.missionDates, today),
      bonusXp: MISSION_BONUS_XP,
    },
    stats: qmStatsDTO(rows, today),
    roundsToday,
    xpNote: roundsToday >= FULL_XP_ROUNDS ? xpNote(roundsToday) : null,
    limitReached,
  }
}

export async function qmLessonDTO(tx: Tx, learnerId: string, id: string): Promise<QmLessonDTO | null> {
  const strategy = strategyById(id)
  if (!strategy) return null
  const learner = await loadLearner(tx, learnerId)
  const state = await loadQmState(tx, learnerId, learner.grade)
  const next = STRATEGIES.find((s) => s.id !== strategy.id && !state.strategies.includes(s.id))
  return {
    shell: await learnerShell(tx, learner),
    id: strategy.id,
    title: strategy.title,
    summary: strategy.summary,
    cards: strategy.cards,
    done: state.strategies.includes(strategy.id),
    nextHref: next ? `/quick-maths/lessons/${next.id}` : null,
    backHref: '/quick-maths',
  }
}
