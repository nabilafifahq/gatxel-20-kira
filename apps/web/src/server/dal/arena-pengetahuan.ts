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
import type { Dict } from '@/lib/i18n'
import type { OrgContext, Tx } from '../db'
import { AppError, conflict, invalid } from '../errors'
import { trackDTOs } from './arena-tracks'
import { finishedRoundsOn, loadQuizState, saveArenaState, trackTotals, type QuizState } from './arena-state'
import { EN_DICT, assertCanPlay, assertOpen, clampMs, dropStaleRounds, loadSession, requestDict, xpNote, type SessionRow } from './arena-session'
import { awardBadges, learnerShell, loadLearner } from './learner-core'
import { awardDrillStars } from './kira-world'
import { completeLinkedSession } from './learner-session'

const { arenaSession, xpEvent } = tables

type QuizConfig = { topic: RoundTopic; mode: 'learn' | 'quiz' | 'speed'; plan: string[]; variant?: 'map' }
type StoredQuizAnswer = { i: number; a: KAnswer | null; ms: number; t: number }

function parseConfig(raw: unknown, t: Dict = EN_DICT): QuizConfig {
  const c = raw as QuizConfig
  if (!c || !isRoundTopic(c.topic) || !(c.mode in KROUND) || !Array.isArray(c.plan)) throw new AppError('invalid', t.arena.errors.roundInvalid)
  return c
}

function parseAnswers(raw: unknown): StoredQuizAnswer[] {
  return Array.isArray(raw) ? (raw as StoredQuizAnswer[]) : []
}

function topicTitle(topic: RoundTopic, t: Dict): string {
  return topic === 'mix' ? t.arena.quiz.mixedTitle : topicById(topic).title
}

// ---------------------------------------------------------------------------

export async function startQuizRound(tx: Tx, ctx: OrgContext, learnerId: string, input: QuizStartInput, t: Dict = EN_DICT): Promise<{ roundId: string }> {
  if (!isRoundTopic(input.topic)) throw invalid(t.arena.errors.topicMissing)
  if (input.topic === 'mix' && input.mode === 'learn') throw invalid(t.arena.errors.cardsOneTopic)
  if (input.variant === 'map' && (input.topic !== 'continents' || input.mode !== 'quiz')) throw invalid(t.arena.errors.mapOnly)
  const learner = await loadLearner(tx, learnerId)
  const today = jakartaDate()
  await assertCanPlay(tx, learner, today, t)
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

export async function answerQuizRound(tx: Tx, learnerId: string, input: { roundId: string; index: number; answer: KAnswer | null; ms: number }, t: Dict = EN_DICT): Promise<QuizAnswerResult> {
  const row = await loadSession(tx, learnerId, input.roundId, 'pengetahuan', true, t)
  assertOpen(row, t)
  const cfg = parseConfig(row.config, t)
  if (input.index < 0 || input.index >= cfg.plan.length) throw invalid(t.arena.errors.noQuestion)
  const answers = parseAnswers(row.answers)
  if (cfg.mode === 'learn') {
    if (input.index < answers.length) return { correct: true }
    if (input.index !== answers.length) throw conflict(t.arena.errors.cardsInOrder)
    await tx.update(arenaSession).set({ answers: [...answers, { i: input.index, a: typeof input.answer === 'number' ? 1 : null, ms: clampMs(input.ms), t: Date.now() - row.startedAt.getTime() }] }).where(eq(arenaSession.id, row.id))
    return { correct: true }
  }
  const q = roundQuestion(cfg.plan, row.seed, input.index)
  const timed = KROUND[cfg.mode].timed
  const reveal = (ok: boolean): QuizAnswerResult => (timed ? { correct: ok } : { correct: ok, explain: q.key.explain, answerLabel: q.key.answerLabel })
  const prev = answers[input.index]
  if (prev) return reveal(isCorrectAnswer(q.key, prev.a))
  if (input.index !== answers.length) throw conflict(t.arena.errors.inOrder)
  const elapsed = Date.now() - row.startedAt.getTime()
  const limit = KROUND[cfg.mode].limitSec
  if (limit && elapsed > limit * 1000 + SPRINT_GRACE_MS) throw conflict(t.arena.errors.timeUp)
  await tx.update(arenaSession).set({ answers: [...answers, { i: input.index, a: input.answer, ms: clampMs(input.ms), t: elapsed }] }).where(eq(arenaSession.id, row.id))
  return reveal(isCorrectAnswer(q.key, input.answer))
}

// ---------------------------------------------------------------------------

function yoursLabel(q: KQuestion, a: KAnswer | null, t: Dict): string {
  if (a === null) return t.arena.quiz.skipped
  const c = q.client
  if (c.kind === 'mc') return typeof a === 'number' ? (c.options[a]?.label ?? '') : ''
  if (c.kind === 'tf') return a === true ? t.arena.quiz.true : a === false ? t.arena.quiz.false : ''
  if (c.kind === 'map') return typeof a === 'string' ? (MAP_REGIONS.find((r) => r.id === a)?.label ?? '') : ''
  return Array.isArray(a) ? a.map((id) => c.items.find((i) => i.id === id)?.label ?? '').join(', ') : ''
}

function reviewPrompt(c: KClientQuestion): string {
  return c.prompt
}

export async function finishQuizRound(tx: Tx, ctx: OrgContext, learnerId: string, roundId: string, t: Dict = EN_DICT): Promise<QuizResultDTO> {
  const res = t.arena.quiz.result
  const row = await loadSession(tx, learnerId, roundId, 'pengetahuan', true, t)
  if (row.finishedAt) {
    const stored = (row.result as { dto?: QuizResultDTO } | null)?.dto
    if (stored) return stored
    throw conflict(t.arena.errors.alreadyFinished)
  }
  const learner = await loadLearner(tx, learnerId)
  const cfg = parseConfig(row.config, t)
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
    // Benar dan Salah adalah kata antarmuka, jadi mengikuti bahasa anak seperti tombolnya.
    const answer = q.client.kind !== 'tf' ? q.key.answerLabel : q.key.answerLabel === 'True' ? t.arena.quiz.true : q.key.answerLabel === 'False' ? t.arena.quiz.false : q.key.answerLabel
    review.push({ i: a.i, prompt: reviewPrompt(q.client), yours: yoursLabel(q, a.a, t), answer, ok, ...(pic ? { pic } : {}) })
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
  if (answered >= 5) await awardDrillStars(tx, learnerId, row.id, row.date as IsoDate)
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
    xpNote: xpNote(roundsBefore, t),
    trackLabel: t.arena.reward.trackLabel.pengetahuan,
    levelUp: ups ? { level: ups.to, label: t.arena.reward.levelUp.pengetahuan(ups.to) } : null,
    badges: newBadges
      .map((b) => ARENA_BADGES.find((x) => x.id === b.id) ?? null)
      .filter((b): b is NonNullable<typeof b> => b !== null)
      .map((b) => ({ id: b.id, title: t.arena.badges[b.id]?.title ?? b.title, description: t.arena.badges[b.id]?.description ?? b.description, glyph: b.glyph })),
    accessories: accessories.map((a) => ({ id: a.id, label: t.arena.accessories[a.id] })),
    tracks: trackDTOs(after),
  }
  const lines =
    cfg.mode === 'learn'
      ? [res.lookedAt(answered), res.tryQuiz]
      : cfg.mode === 'speed'
        ? [res.speed(correct, info.limitSec)]
        : [res.plain(correct, cfg.plan.length)]
  const dto: QuizResultDTO = {
    mode: cfg.mode,
    topicTitle: topicTitle(cfg.topic, t),
    answered,
    correct,
    accuracy: answered > 0 ? Math.round((correct / answered) * 100) : 0,
    durationSec: Math.round(durationMs / 1000),
    title: cfg.mode === 'learn' ? res.cardsDone : res.roundDone,
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
  const t = await requestDict()
  const row: SessionRow = await loadSession(tx, learnerId, roundId, 'pengetahuan', false, t)
  const learner = await loadLearner(tx, learnerId)
  const cfg = parseConfig(row.config, t)
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
    topicTitle: topicTitle(cfg.topic, t),
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
  const t = await requestDict()
  const learner = await loadLearner(tx, learnerId)
  const today = jakartaDate()
  const state = await loadQuizState(tx, learnerId)
  const roundsToday = await finishedRoundsOn(tx, learnerId, 'pengetahuan', today)
  return {
    shell: await learnerShell(tx, learner, today),
    tracks: trackDTOs(await trackTotals(tx, learnerId)),
    topics: TOPICS.map((t) => topicCard(t.id, state.know)),
    roundsToday,
    xpNote: roundsToday >= FULL_XP_ROUNDS ? xpNote(roundsToday, t) : null,
    limitReached: await limitReached(tx, learnerId, today),
    speedBest: state.speedBest,
  }
}

export async function quizTopicDTO(tx: Tx, learnerId: string, id: TopicId): Promise<QuizTopicDTO> {
  const t = await requestDict()
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
    xpNote: roundsToday >= FULL_XP_ROUNDS ? xpNote(roundsToday, t) : null,
  }
}
