import 'server-only'
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import {
  ARENA_BADGES,
  FULL_XP_ROUNDS,
  LEARN_CARD_XP,
  LEARN_DECK_MAX_XP,
  QUIZ_ANSWER_XP,
  SPRINT_GRACE_MS,
  applyDiminishing,
  jakartaDate,
  levelUps,
  newlyEarnedAccessories,
  roundRawXp,
  trackLevels,
  type IsoDate,
} from '@kira/core'
import {
  KROUND,
  TOPICS,
  factById,
  isCorrectAnswer,
  isRoundTopic,
  openTier,
  planRound,
  recordKnow,
  roundQuestion,
  topicById,
  topicProgress,
  type KAnswer,
  type KClientQuestion,
  type KQuestion,
  type KnowMap,
  type LearnCard,
  type RoundTopic,
  type TopicId,
  MAP_REGIONS,
  planMapRound,
} from '@kira/content/knowledge'
import { tables } from '@kira/db'
import type { ArenaRewardDTO, QuizAnswerResult, QuizHubDTO, QuizResultDTO, QuizRoundDTO, QuizStartInput, QuizTopicCard, QuizTopicDTO } from '@/lib/dto-arena'
import type { OrgContext, Tx } from '../db'
import { AppError, conflict, invalid } from '../errors'
import { trackDTOs } from './arena-tracks'
import { finishedRoundsOn, loadQuizState, saveArenaState, trackTotals, type QuizState } from './arena-state'
import { assertCanPlay, assertOpen, clampMs, dropStaleRounds, loadSession, xpNote, type SessionRow } from './arena-session'
import { awardBadges, learnerShell, loadLearner } from './learner-core'
import { completeLinkedSession } from './learner-session'

const { arenaSession, xpEvent } = tables

type QuizConfig = { topic: RoundTopic; mode: 'learn' | 'quiz' | 'speed'; plan: string[]; variant?: 'map' }
type StoredQuizAnswer = { i: number; a: KAnswer | null; ms: number; t: number }

function parseConfig(raw: unknown): QuizConfig {
  const c = raw as QuizConfig
  if (!c || !isRoundTopic(c.topic) || !(c.mode in KROUND) || !Array.isArray(c.plan)) throw new AppError('invalid', 'That round is not valid.')
  return c
}

function parseAnswers(raw: unknown): StoredQuizAnswer[] {
  return Array.isArray(raw) ? (raw as StoredQuizAnswer[]) : []
}

function topicTitle(topic: RoundTopic): string {
  return topic === 'mix' ? 'Mixed quiz' : topicById(topic).title
}

// ---------------------------------------------------------------------------

export async function startQuizRound(tx: Tx, ctx: OrgContext, learnerId: string, input: QuizStartInput): Promise<{ roundId: string }> {
  if (!isRoundTopic(input.topic)) throw invalid('That topic does not exist.')
  if (input.topic === 'mix' && input.mode === 'learn') throw invalid('Flashcards need one topic.')
  if (input.variant === 'map' && (input.topic !== 'continents' || input.mode !== 'quiz')) throw invalid('The map round is only for Continents and oceans.')
  const learner = await loadLearner(tx, learnerId)
  const today = jakartaDate()
  await assertCanPlay(tx, learner, today)
  await dropStaleRounds(tx, learnerId)
  const state = await loadQuizState(tx, learnerId)
  const seed = randomUUID()
  const plan = input.variant === 'map' ? planMapRound(seed) : planRound({ topic: input.topic, mode: input.mode, seed, know: state.know })
  const config: QuizConfig = { topic: input.topic, mode: input.mode, plan, ...(input.variant ? { variant: input.variant } : {}) }
  const [row] = await tx
    .insert(arenaSession)
    .values({ orgId: ctx.orgId, learnerId, arena: 'pengetahuan', mode: input.mode, topic: input.topic, seed, config, date: today, total: plan.length })
    .returning({ id: arenaSession.id })
  return { roundId: row!.id }
}

export async function answerQuizRound(tx: Tx, learnerId: string, input: { roundId: string; index: number; answer: KAnswer | null; ms: number }): Promise<QuizAnswerResult> {
  const row = await loadSession(tx, learnerId, input.roundId, 'pengetahuan', true)
  assertOpen(row)
  const cfg = parseConfig(row.config)
  if (input.index < 0 || input.index >= cfg.plan.length) throw invalid('That question does not exist.')
  const answers = parseAnswers(row.answers)
  if (cfg.mode === 'learn') {
    if (input.index < answers.length) return { correct: true }
    if (input.index !== answers.length) throw conflict('Go through the cards in order.')
    await tx.update(arenaSession).set({ answers: [...answers, { i: input.index, a: typeof input.answer === 'number' ? 1 : null, ms: clampMs(input.ms), t: Date.now() - row.startedAt.getTime() }] }).where(eq(arenaSession.id, row.id))
    return { correct: true }
  }
  const q = roundQuestion(cfg.plan, row.seed, input.index)
  const timed = KROUND[cfg.mode].timed
  const reveal = (ok: boolean): QuizAnswerResult => (timed ? { correct: ok } : { correct: ok, explain: q.key.explain, answerLabel: q.key.answerLabel })
  const prev = answers[input.index]
  if (prev) return reveal(isCorrectAnswer(q.key, prev.a))
  if (input.index !== answers.length) throw conflict('Answer the questions in order.')
  const elapsed = Date.now() - row.startedAt.getTime()
  const limit = KROUND[cfg.mode].limitSec
  if (limit && elapsed > limit * 1000 + SPRINT_GRACE_MS) throw conflict("Time's up.")
  await tx.update(arenaSession).set({ answers: [...answers, { i: input.index, a: input.answer, ms: clampMs(input.ms), t: elapsed }] }).where(eq(arenaSession.id, row.id))
  return reveal(isCorrectAnswer(q.key, input.answer))
}

// ---------------------------------------------------------------------------

function yoursLabel(q: KQuestion, a: KAnswer | null): string {
  if (a === null) return 'Skipped'
  const c = q.client
  if (c.kind === 'mc') return typeof a === 'number' ? (c.options[a]?.label ?? '') : ''
  if (c.kind === 'tf') return a === true ? 'True' : a === false ? 'False' : ''
  if (c.kind === 'map') return typeof a === 'string' ? (MAP_REGIONS.find((r) => r.id === a)?.label ?? '') : ''
  return Array.isArray(a) ? a.map((id) => c.items.find((i) => i.id === id)?.label ?? '').join(', ') : ''
}

function reviewPrompt(c: KClientQuestion): string {
  return c.prompt
}

export async function finishQuizRound(tx: Tx, ctx: OrgContext, learnerId: string, roundId: string): Promise<QuizResultDTO> {
  const row = await loadSession(tx, learnerId, roundId, 'pengetahuan', true)
  if (row.finishedAt) {
    const stored = (row.result as { dto?: QuizResultDTO } | null)?.dto
    if (stored) return stored
    throw conflict('This round is already finished.')
  }
  const learner = await loadLearner(tx, learnerId)
  const cfg = parseConfig(row.config)
  const answers = parseAnswers(row.answers)
  const state: QuizState = await loadQuizState(tx, learnerId, true)
  const roundsBefore = await finishedRoundsOn(tx, learnerId, 'pengetahuan', row.date)
  const before = await trackTotals(tx, learnerId)

  let know: KnowMap = state.know
  let correct = 0
  let answered = 0
  const review: QuizResultDTO['review'] = []
  for (const a of answers) {
    const factId = cfg.plan[a.i]
    if (factId === undefined) continue
    if (cfg.mode === 'learn') {
      answered++
      correct++
      if (!factId.startsWith('order:')) {
        const prev = know[factId] ?? { n: 0, r: 0, last: 0 as 0 | 1 }
        know = { ...know, [factId]: { n: prev.n + 1, r: prev.r, last: prev.last } }
      }
      continue
    }
    const q = roundQuestion(cfg.plan, row.seed, a.i)
    const ok = isCorrectAnswer(q.key, a.a)
    if (a.a !== null) answered++
    if (ok) correct++
    know = recordKnow(know, factId, ok, q.key.kind === 'mc')
    const pic = q.client.kind === 'mc' ? q.client.pic : q.client.kind === 'tf' ? q.client.pic : undefined
    review.push({ i: a.i, prompt: reviewPrompt(q.client), yours: yoursLabel(q, a.a), answer: q.key.answerLabel, ok, ...(pic ? { pic } : {}) })
  }

  const info = KROUND[cfg.mode]
  const raw =
    cfg.mode === 'learn'
      ? Math.min(LEARN_DECK_MAX_XP, answered * LEARN_CARD_XP)
      : roundRawXp({ perCorrectXp: Array.from({ length: correct }, () => QUIZ_ANSWER_XP), answered, correct })
  const xp = applyDiminishing(raw, roundsBefore)
  if (xp > 0) {
    await tx.insert(xpEvent).values({ orgId: ctx.orgId, learnerId, amount: xp, reason: 'round', ref: row.id, date: row.date, track: 'pengetahuan' }).onConflictDoNothing()
  }
  const durationMs = info.limitSec ? info.limitSec * 1000 : Math.max(1, answers.reduce((n, a) => n + Math.min(a.ms, 60000), 0))
  const next: QuizState = {
    know,
    speedBest: cfg.mode === 'speed' ? Math.max(state.speedBest, correct) : state.speedBest,
    perfectRound: state.perfectRound || (cfg.mode === 'quiz' && answered >= 10 && correct === answered),
  }
  await saveArenaState(tx, ctx, learnerId, 'pengetahuan', next)
  await tx.update(arenaSession).set({ finishedAt: new Date(), answered, correct, durationMs, xp }).where(eq(arenaSession.id, row.id))
  // Bila tutor memberi Quiz Arena sebagai sesi hari ini, ronde yang berakhir menyelesaikannya.
  if (answered > 0) await completeLinkedSession(tx, learnerId, row.date as IsoDate, { session: 'knowledge', subject: 'science' })
  const newBadges = await awardBadges(tx, ctx, learner, row.date)
  const after = await trackTotals(tx, learnerId)
  const ups = levelUps(before, after).find((u) => u.track === 'pengetahuan')
  const accessories = newlyEarnedAccessories(trackLevels(before), trackLevels(after))
  const reward: ArenaRewardDTO = {
    xp,
    xpNote: xpNote(roundsBefore),
    trackLabel: 'Quiz XP',
    levelUp: ups ? { level: ups.to, label: `Quiz level ${ups.to}` } : null,
    badges: newBadges
      .map((b) => ARENA_BADGES.find((x) => x.id === b.id) ?? null)
      .filter((b): b is NonNullable<typeof b> => b !== null)
      .map((b) => ({ id: b.id, title: b.title, description: b.description, glyph: b.glyph })),
    accessories: accessories.map((a) => ({ id: a.id, label: a.label })),
    tracks: trackDTOs(after),
  }
  const lines =
    cfg.mode === 'learn'
      ? [`You looked at ${answered} cards.`, 'Now try a quiz to see what stuck.']
      : cfg.mode === 'speed'
        ? [`You got ${correct} right in ${info.limitSec} seconds.`]
        : [`You got ${correct} of ${cfg.plan.length} right.`]
  const dto: QuizResultDTO = {
    mode: cfg.mode,
    topicTitle: topicTitle(cfg.topic),
    answered,
    correct,
    accuracy: answered > 0 ? Math.round((correct / answered) * 100) : 0,
    durationSec: Math.round(durationMs / 1000),
    title: cfg.mode === 'learn' ? 'Cards done' : 'Round done',
    lines,
    review,
    reward,
    nextHref: cfg.topic === 'mix' ? '/quiz-arena' : `/quiz-arena/${cfg.topic}`,
  }
  await tx.update(arenaSession).set({ result: { dto } }).where(eq(arenaSession.id, row.id))
  return dto
}

// ---------------------------------------------------------------------------
// Halaman

function cardsOfPlan(plan: readonly string[]): LearnCard[] {
  const out: LearnCard[] = []
  for (const id of plan) {
    const f = factById(id)
    if (!f) continue
    out.push({ factId: f.id, front: f.card.front, back: f.card.back, ...(f.card.frontPic ? { frontPic: f.card.frontPic } : {}), ...(f.card.backPic ? { backPic: f.card.backPic } : {}) })
  }
  return out
}

export async function quizRoundDTO(tx: Tx, learnerId: string, roundId: string): Promise<QuizRoundDTO> {
  const row: SessionRow = await loadSession(tx, learnerId, roundId, 'pengetahuan')
  const learner = await loadLearner(tx, learnerId)
  const cfg = parseConfig(row.config)
  const info = KROUND[cfg.mode]
  const answers = parseAnswers(row.answers)
  const learn = cfg.mode === 'learn'
  const questions = learn ? [] : cfg.plan.map((_, i) => roundQuestion(cfg.plan, row.seed, i))
  const done = answers.map((a) => ({ i: a.i, ok: info.timed || learn ? null : isCorrectAnswer(questions[a.i]!.key, a.a) }))
  const right = learn ? 0 : answers.filter((a) => isCorrectAnswer(questions[a.i]!.key, a.a)).length
  const finished = row.finishedAt ? ((row.result as { dto?: QuizResultDTO } | null)?.dto ?? null) : null
  return {
    shell: await learnerShell(tx, learner),
    id: row.id,
    mode: cfg.mode,
    topic: cfg.topic,
    topicTitle: topicTitle(cfg.topic),
    timed: info.timed,
    limitSec: info.limitSec,
    elapsedSec: Math.max(0, Math.floor((Date.now() - row.startedAt.getTime()) / 1000)),
    questions: questions.map((q) => q.client),
    cards: learn ? cardsOfPlan(cfg.plan) : [],
    done,
    right,
    finished,
    ...(cfg.variant ? { variant: cfg.variant } : {}),
    exitHref: cfg.topic === 'mix' ? '/quiz-arena' : `/quiz-arena/${cfg.topic}`,
    restartHref: cfg.topic === 'mix' ? '/quiz-arena' : `/quiz-arena/${cfg.topic}`,
  }
}

function topicCard(id: TopicId, know: KnowMap): QuizTopicCard {
  const t = topicById(id)
  const p = topicProgress(id, know)
  return { id, title: t.title, blurb: t.blurb, pic: t.pic, known: p.known, total: p.total, seen: p.seen, pictures: t.pictures }
}

async function limitReached(tx: Tx, learnerId: string, today: IsoDate): Promise<boolean> {
  const learner = await loadLearner(tx, learnerId)
  return assertCanPlay(tx, learner, today).then(
    () => false,
    () => true,
  )
}

export async function quizHubDTO(tx: Tx, learnerId: string): Promise<QuizHubDTO> {
  const learner = await loadLearner(tx, learnerId)
  const today = jakartaDate()
  const state = await loadQuizState(tx, learnerId)
  const roundsToday = await finishedRoundsOn(tx, learnerId, 'pengetahuan', today)
  return {
    shell: await learnerShell(tx, learner, today),
    tracks: trackDTOs(await trackTotals(tx, learnerId)),
    topics: TOPICS.map((t) => topicCard(t.id, state.know)),
    roundsToday,
    xpNote: roundsToday >= FULL_XP_ROUNDS ? xpNote(roundsToday) : null,
    limitReached: await limitReached(tx, learnerId, today),
    speedBest: state.speedBest,
  }
}

export async function quizTopicDTO(tx: Tx, learnerId: string, id: TopicId): Promise<QuizTopicDTO> {
  const learner = await loadLearner(tx, learnerId)
  const today = jakartaDate()
  const state = await loadQuizState(tx, learnerId)
  const topic = topicById(id)
  const roundsToday = await finishedRoundsOn(tx, learnerId, 'pengetahuan', today)
  return {
    shell: await learnerShell(tx, learner, today),
    topic: topicCard(id, state.know),
    tracks: trackDTOs(await trackTotals(tx, learnerId)),
    tiers: { open: openTier(topic, state.know), gated: topic.facts.length >= 60 },
    limitReached: await limitReached(tx, learnerId, today),
    xpNote: roundsToday >= FULL_XP_ROUNDS ? xpNote(roundsToday) : null,
  }
}
