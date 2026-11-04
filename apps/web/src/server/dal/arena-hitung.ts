import 'server-only'
import { awardDrillStars } from './kira-world'
import { randomUUID } from 'node:crypto'
import { and, desc, eq, isNotNull, sql } from 'drizzle-orm'
import {
  ARENA_BADGES,
  FLASH_LEVELS,
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
  mergeQmRecords,
  EMPTY_ROLLED,
  type ArenaRolled,
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
import type { Dict } from '@/lib/i18n'
import type { OrgContext, Tx } from '../db'
import { AppError, conflict, invalid } from '../errors'
import { trackDTOs } from './arena-tracks'
import { finishedRoundsOn, loadQmState, loadRolled, saveArenaState, trackTotals, type QmState } from './arena-state'
import { EN_DICT, assertCanPlay, assertOpen, clampMs, dropStaleRounds, loadSession, requestDict, xpNote, type SessionRow } from './arena-session'
import { awardBadges, learnerShell, loadLearner } from './learner-core'
import { completeLinkedSession } from './learner-session'

const { arenaSession, xpEvent } = tables

function levelText(op: QmOp, level: number, t: Dict): string {
  return t.arena.qm.levelDesc(op, level, describeLevel(op, level))
}

function flashText(level: number, t: Dict): string {
  const s = FLASH_LEVELS[Math.max(1, Math.min(FLASH_LEVELS.length, level)) - 1]!
  return t.arena.qm.flashDesc(s.terms, s.digits, s.signs ? 1 : 0, s.intervalMs, describeFlashLevel(level))
}

function strategyTitle(id: string, t: Dict): string {
  return t.arena.qm.strategies[id as keyof Dict['arena']['qm']['strategies']]?.title ?? t.arena.qm.strategyFallback
}

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

function parseConfig(raw: unknown, t: Dict = EN_DICT): QmConfig {
  const cfg = raw as QmConfig
  if (!cfg || typeof cfg !== 'object' || !QM_MODE_INFO[cfg.mode]) throw new AppError('invalid', t.arena.errors.roundInvalid)
  return cfg
}

function parseAnswers(raw: unknown): StoredAnswer[] {
  return Array.isArray(raw) ? (raw as StoredAnswer[]) : []
}

function missionTitle(mission: string, t: Dict): string {
  const step = MISSION_STEPS.find((s) => s.id === mission)
  return step ? t.arena.qm.missionStep[step.id] : t.arena.qm.dailyMission
}

function roundTitle(cfg: QmConfig, mission: string | null, t: Dict): string {
  const qm = t.arena.qm
  if (cfg.focus) return strategyTitle(cfg.focus, t)
  if (mission) return missionTitle(mission, t)
  if (cfg.mode === 'tables') return qm.timesTable(cfg.table)
  if (cfg.mode === 'soroban') return cfg.sorobanStage === 'read' ? qm.roundTitle.sorobanRead : cfg.sorobanStage === 'set' ? qm.roundTitle.sorobanSet : qm.roundTitle.sorobanAnzan
  if (cfg.mode === 'flash') return qm.roundTitle.flash(cfg.flashLevel)
  return qm.modes[cfg.mode]
}

function roundSubtitle(cfg: QmConfig, t: Dict): string {
  const s = t.arena.qm.subtitle
  if (cfg.focus) return s.focus
  if (cfg.mode === 'flash') return flashText(cfg.flashLevel, t)
  if (cfg.mode === 'soroban') return s.soroban
  if (cfg.mode === 'tables') return cfg.division ? s.tablesBoth : s.tables
  if (cfg.auto) return s.auto
  const op = cfg.op === 'mixed' ? s.allOps : t.arena.qm.opWord[cfg.op]
  return `${op}, ${cfg.digits === 'mixed' ? s.digitsMixed : s.digits(cfg.digits)}, ${cfg.carry ? s.withCarry : s.withoutCarry}`
}

async function missionStepsDoneOn(tx: Tx, learnerId: string, date: IsoDate): Promise<string[]> {
  const rows = await tx
    .select({ step: arenaSession.missionStep })
    .from(arenaSession)
    .where(and(eq(arenaSession.learnerId, learnerId), eq(arenaSession.arena, 'hitung'), eq(arenaSession.date, date), isNotNull(arenaSession.missionStep), isNotNull(arenaSession.finishedAt)))
  return rows.map((r) => r.step as string)
}

export async function startQmRound(tx: Tx, ctx: OrgContext, learnerId: string, input: QmStartInput, t: Dict = EN_DICT): Promise<{ roundId: string }> {
  const learner = await loadLearner(tx, learnerId)
  const today = jakartaDate()
  await assertCanPlay(tx, learner, today, t)
  await dropStaleRounds(tx, learnerId)
  const state = await loadQmState(tx, learnerId, learner.grade)

  let mode = input.mode
  let missionStep: string | null = null
  if (input.mission) {
    const step = MISSION_STEPS.find((x) => x.id === input.mission)
    if (!step) throw invalid(t.arena.errors.stepMissing)
    if ((await missionStepsDoneOn(tx, learnerId, today)).includes(step.id)) throw conflict(t.arena.errors.stepDone)
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

export async function hintQmRound(tx: Tx, learnerId: string, input: { roundId: string; index: number }, t: Dict = EN_DICT): Promise<{ title: string; steps: string[] }> {
  const row = await loadSession(tx, learnerId, input.roundId, 'hitung', true, t)
  assertOpen(row, t)
  const cfg = parseConfig(row.config, t)
  if (QM_MODE_INFO[cfg.mode].timed) throw invalid(t.arena.errors.hintsTimed)
  const answers = parseAnswers(row.answers)
  if (input.index !== answers.length || input.index >= cfg.count) throw conflict(t.arena.errors.hintCurrent)
  const hint = hintFor(generateProblem(cfg, row.seed, input.index))
  if (!hint) throw invalid(t.arena.errors.noHint)
  const hints = hintsOf(row)
  if (!hints.includes(input.index)) await tx.update(arenaSession).set({ result: { hints: [...hints, input.index] } }).where(eq(arenaSession.id, row.id))
  return { title: hint.title, steps: hint.steps.slice(0, -1) }
}

export async function answerQmRound(tx: Tx, learnerId: string, input: { roundId: string; index: number; answer: number | null; ms: number }, t: Dict = EN_DICT): Promise<QmAnswerResult> {
  const row = await loadSession(tx, learnerId, input.roundId, 'hitung', true, t)
  assertOpen(row, t)
  const cfg = parseConfig(row.config, t)
  if (input.index < 0 || input.index >= cfg.count) throw invalid(t.arena.errors.noQuestion)
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
  if (input.index !== answers.length) throw conflict(t.arena.errors.inOrder)
  const elapsed = Date.now() - row.startedAt.getTime()
  if (info.limitSec && elapsed > info.limitSec * 1000 + SPRINT_GRACE_MS) throw conflict(t.arena.errors.timeUp)
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

function resultLines(cfg: QmConfig, r: ReturnType<typeof scoreQmRound>, t: Dict): string[] {
  const res = t.arena.qm.result
  const total = cfg.count
  const sec = Math.round(r.durationMs / 100) / 10
  if (cfg.mode === 'sprint60' || cfg.mode === 'sprint120') return [res.sprint(r.correct, QM_MODE_INFO[cfg.mode].limitSec), res.perMinute(r.ppm)]
  if (cfg.mode === 'target20') return [res.target(r.correct, sec)]
  if (cfg.mode === 'flash') return [res.flash(r.correct, total, cfg.flashLevel)]
  if (cfg.mode === 'soroban') return [res.plain(r.correct, total)]
  return [res.plain(r.correct, total), ...(r.ppm > 0 && cfg.mode !== 'practice' ? [res.perMinute(r.ppm)] : [])]
}

export async function finishQmRound(tx: Tx, ctx: OrgContext, learnerId: string, roundId: string, t: Dict = EN_DICT): Promise<QmResultDTO> {
  const res = t.arena.qm.result
  const row = await loadSession(tx, learnerId, roundId, 'hitung', true, t)
  if (row.finishedAt) {
    const stored = (row.result as { dto?: QmResultDTO } | null)?.dto
    if (stored) return stored
    throw conflict(t.arena.errors.alreadyFinished)
  }
  const learner = await loadLearner(tx, learnerId)
  const cfg = parseConfig(row.config, t)
  const answers = parseAnswers(row.answers)
  const r = scoreQmRound(cfg, row.seed, answers)
  const state: QmState = await loadQmState(tx, learnerId, learner.grade, true)
  const roundsBefore = await finishedRoundsOn(tx, learnerId, 'hitung', row.date)
  const before = await trackTotals(tx, learnerId)
  const bests = await priorBests(tx, learnerId, row.id)
  const levelNotes: string[] = []
  const lines = resultLines(cfg, r, t)

  // Level adaptif (hanya ronde otomatis berisi soal aritmetika campuran, bukan pelajaran strategi)
  const arithmetic = ['practice', 'sprint60', 'sprint120', 'target20'].includes(cfg.mode) && !cfg.focus
  if (arithmetic && cfg.auto) {
    const u = updateLevelsAccumulated(state.levels, state.pending, r.perOp, state.ppm)
    state.levels = u.levels
    state.ppm = { ...state.ppm, ...u.ppm }
    state.pending = u.pending
    for (const c of u.changes) {
      levelNotes.push(c.to > c.from ? res.levelUp(t.arena.qm.opWord[c.op], c.to, levelText(c.op, c.to, t)) : res.levelDown(t.arena.qm.opWord[c.op], c.to))
    }
  }
  for (const op of QM_OPS) if ((r.perOp[op]?.correct ?? 0) > 0 && !state.opsPlayed.includes(op)) state.opsPlayed.push(op)
  if (cfg.mode === 'flash') {
    const next = nextSimpleLevel(cfg.flashLevel, r.correct, cfg.count, 8)
    if (r.correct / cfg.count >= 0.8) state.flashCleared = Math.max(state.flashCleared, cfg.flashLevel)
    if (next !== cfg.flashLevel) levelNotes.push(next > cfg.flashLevel ? res.flashUp(next, flashText(next, t)) : res.flashDown(next))
    state.flashLevel = next
  }
  if (cfg.mode === 'soroban') {
    const next = nextSimpleLevel(cfg.sorobanLevel, r.correct, cfg.count, 4)
    state.soroban[cfg.sorobanStage] = next
    state.sorobanRounds += 1
    if (cfg.sorobanStage === 'anzan' && r.correct / cfg.count >= 0.75) state.anzanPassed += 1
    if (next > cfg.sorobanLevel) levelNotes.push(res.sorobanUp(next))
  }
  if (cfg.mode === 'tables' && r.answered >= 10 && r.correct / r.answered >= 0.9 && !state.tablesMastered.includes(cfg.table)) state.tablesMastered.push(cfg.table)
  let strategyDone: QmResultDTO['strategyDone'] = null
  if (cfg.focus && r.correct >= 4) {
    const s = strategyById(cfg.focus)
    if (s) strategyDone = { id: s.id, title: strategyTitle(s.id, t) }
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
  if (r.answered >= 5) await awardDrillStars(tx, learnerId, row.id, row.date as IsoDate)

  await saveArenaState(tx, ctx, learnerId, 'hitung', state)
  const personal: string[] = []
  const sprint = cfg.mode === 'sprint60' || cfg.mode === 'sprint120'
  if (sprint && r.answered >= 10 && r.correct / r.answered >= 0.8 && r.ppm > (bests.sprintPpm ?? 0) && bests.sprintPpm !== null) personal.push(res.bestSprint(r.ppm))
  if (cfg.mode === 'target20' && r.answered === 20 && r.correct === 20 && bests.targetSec !== null && r.durationMs / 1000 < bests.targetSec) personal.push(res.bestTarget(Math.round(r.durationMs / 100) / 10))

  // Simpan hasil dulu supaya hitungan lencana dan level melihat ronde ini.
  await tx
    .update(arenaSession)
    .set({ finishedAt: new Date(), answered: r.answered, correct: r.correct, durationMs: r.durationMs, ppm: r.ppm, xp: earnedXp })
    .where(eq(arenaSession.id, row.id))
  // Bila tutor memberi Quick Maths sebagai sesi hari ini, ronde yang berakhir menyelesaikannya.
  if (r.answered > 0) await completeLinkedSession(tx, learnerId, row.date as IsoDate, { session: 'quick-maths', subject: 'math' })
  const newBadges = await awardBadges(tx, ctx, learner, row.date)
  const after = await trackTotals(tx, learnerId)
  const ups = levelUps(before, after).find((u) => u.track === 'hitung')
  const accessories = newlyEarnedAccessories(trackLevels(before), trackLevels(after))
  const reward: ArenaRewardDTO = {
    xp: earnedXp,
    xpNote: xpNote(roundsBefore, t),
    trackLabel: t.arena.reward.trackLabel.hitung,
    levelUp: ups ? { level: ups.to, label: t.arena.reward.levelUp.hitung(ups.to) } : null,
    badges: newBadges
      .map((b) => ARENA_BADGES.find((a) => a.id === b.id) ?? null)
      .filter((b): b is NonNullable<typeof b> => b !== null)
      .map((b) => ({ id: b.id, title: t.shell.badges[b.id]?.title ?? b.title, description: t.shell.badges[b.id]?.desc ?? b.description, glyph: b.glyph })),
    accessories: accessories.map((a) => ({ id: a.id, label: t.shell.accessories[a.id] })),
    tracks: trackDTOs(after),
  }
  const accuracy = r.answered > 0 ? Math.round((r.correct / r.answered) * 100) : 0
  const dto: QmResultDTO = {
    answered: r.answered,
    correct: r.correct,
    accuracy,
    ppm: r.ppm,
    durationSec: Math.round(r.durationMs / 1000),
    title: strategyDone ? res.strategyLearned : res.roundDone,
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
  const t = await requestDict()
  const row = await loadSession(tx, learnerId, roundId, 'hitung', false, t)
  const learner = await loadLearner(tx, learnerId)
  const cfg = parseConfig(row.config, t)
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
    title: roundTitle(cfg, row.missionStep, t),
    subtitle: roundSubtitle(cfg, t),
    timed: info.timed,
    limitSec: info.limitSec,
    elapsedSec: Math.max(0, Math.floor((Date.now() - row.startedAt.getTime()) / 1000)),
    prompts: clientPrompts(cfg, row.seed),
    done,
    right,
    hints: hintsOn,
    mission: row.missionStep ? { step: row.missionStep, title: missionTitle(row.missionStep, t) } : null,
    focus: cfg.focus ? { id: cfg.focus, title: strategyTitle(cfg.focus, t) } : null,
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

export function qmStatsDTO(rows: QmStatRow[], today: IsoDate, rolled: ArenaRolled = EMPTY_ROLLED, t: Dict = EN_DICT): QmStatsDTO {
  const s = mergeQmRecords(summariseQm(rows, today), rolled)
  return {
    rounds: s.rounds,
    accuracy: s.accuracy,
    ppm: s.ppm,
    bestSprintPpm: s.bestSprintPpm,
    bestTargetSec: s.bestTargetSec,
    bestAccuracyRound: s.bestAccuracyRound,
    week: s.week.map((d) => ({ date: d.date, label: t.arena.qm.weekdayShort[d.label] ?? d.label, rounds: d.rounds, correct: d.correct, ppm: d.ppm })),
    slowest: s.slowest.map((f) => ({ fact: f.fact, label: t.arena.qm.factLabel(f.fact, f.label), avgSec: Math.round(f.avgMs / 100) / 10, accuracy: f.accuracy, n: f.n })),
  }
}

export async function qmHubDTO(tx: Tx, learnerId: string): Promise<QmHubDTO> {
  const t = await requestDict()
  const qm = t.arena.qm
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
    levels: QM_OPS.map((op) => ({ op, label: qm.opWord[op], level: state.levels[op], description: levelText(op, state.levels[op], t) })),
    flash: { level: state.flashLevel, description: flashText(state.flashLevel, t), cleared: state.flashCleared },
    soroban: state.soroban,
    strategies: STRATEGIES.map((s) => ({ id: s.id, title: qm.strategies[s.id].title, summary: qm.strategies[s.id].summary, done: state.strategies.includes(s.id) })),
    mission: {
      steps: MISSION_STEPS.map((s) => ({ id: s.id, title: s.id === 'tables' ? qm.timesTable(missionTable(today)) : qm.missionStep[s.id], minutes: s.minutes, done: doneSteps.includes(s.id), mode: s.mode })),
      done: missionComplete(doneSteps),
      table: missionTable(today),
      minutes: MISSION_MINUTES,
      streak: missionStreak(state.missionDates, today),
      bonusXp: MISSION_BONUS_XP,
    },
    stats: qmStatsDTO(rows, today, await loadRolled(tx, learnerId, 'hitung'), t),
    roundsToday,
    xpNote: roundsToday >= FULL_XP_ROUNDS ? xpNote(roundsToday, t) : null,
    limitReached,
  }
}

export async function qmLessonDTO(tx: Tx, learnerId: string, id: string): Promise<QmLessonDTO | null> {
  const strategy = strategyById(id)
  if (!strategy) return null
  const copy = (await requestDict()).arena.qm.strategies[strategy.id]
  const learner = await loadLearner(tx, learnerId)
  const state = await loadQmState(tx, learnerId, learner.grade)
  const next = STRATEGIES.find((s) => s.id !== strategy.id && !state.strategies.includes(s.id))
  return {
    shell: await learnerShell(tx, learner),
    id: strategy.id,
    title: copy.title,
    summary: copy.summary,
    cards: strategy.cards,
    done: state.strategies.includes(strategy.id),
    nextHref: next ? `/quick-maths/lessons/${next.id}` : null,
    backHref: '/quick-maths',
  }
}
