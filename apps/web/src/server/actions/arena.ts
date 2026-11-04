'use server'

import { z } from 'zod'
import { throttleIp } from '../auth/ratelimit'
import { ACCESSORY_IDS, QM_MODES, SOROBAN_STAGES, STRATEGY_IDS, MISSION_STEP_IDS } from '@kira/core'
import { TOPIC_IDS, type KAnswer } from '@kira/content/knowledge'
import type { AccessoryId } from '@kira/core'
import type { ActionResult } from '@/lib/dto'
import type { QmAnswerResult, QmResultDTO, QmStartInput, QuizAnswerResult, QuizResultDTO, QuizStartInput } from '@/lib/dto-arena'
import { dictFor, tOf } from '@/lib/i18n'
import { getT } from '@/lib/i18n/server'
import { inOrg } from '../db'
import { orgCtx, requireLearner } from '../auth/actor'
import { runAction } from '../errors'
import { answerQmRound, finishQmRound, hintQmRound, startQmRound } from '../dal/arena-hitung'
import { answerQuizRound, finishQuizRound, startQuizRound } from '../dal/arena-pengetahuan'
import { systemCtx } from '../audit'
import { applyAccessory, assertAccessoryEarned } from '../dal/arena-tracks'

/**
 * Action arena. Setiap action: requireLearner() lebih dulu, lalu Zod .strict(), lalu DAL yang hanya
 * menyentuh ronde milik learner itu (kepemilikan dicek di loadSession dan RLS). Jawaban selalu diperiksa
 * di server dari seed; client tidak pernah menerima kunci jawaban mode berwaktu.
 */

/** runAction untuk anak: pesan umum dari errors.ts dan batas laju mengikuti bahasa tampilan. */
async function runChild<T>(context: string, fn: () => Promise<T>): Promise<ActionResult<T>> {
  const res = await runAction(context, fn, 'en-GB')
  if (res.ok) return res
  const en = dictFor('en').arena.errors
  if (res.message !== en.generic && res.message !== en.badInput && res.message !== en.slowDown) return res
  const t = (await getT()).arena.errors
  return { ...res, message: res.message === en.generic ? t.generic : res.message === en.badInput ? t.badInput : t.slowDown }
}

const roundId = z.string().uuid()
const startQm = z
  .object({
    mode: z.enum(QM_MODES),
    op: z.enum(['add', 'sub', 'mul', 'div', 'mixed']),
    digits: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal('mixed')]),
    carry: z.boolean(),
    auto: z.boolean(),
    table: z.number().int().min(2).max(12),
    division: z.boolean(),
    flashLevel: z.number().int().min(1).max(8).nullable(),
    sorobanStage: z.enum(SOROBAN_STAGES),
    sorobanLevel: z.number().int().min(1).max(4).nullable(),
    focus: z.enum(STRATEGY_IDS).nullable(),
    mission: z.enum(MISSION_STEP_IDS).nullable(),
  })
  .strict()

export async function startQmAction(input: QmStartInput): Promise<ActionResult<{ redirectTo: string }>> {
  return runChild(
    'startQm',
    async () => {
      const actor = await requireLearner()
      const data = startQm.parse(input)
      const { roundId: id } = await inOrg(orgCtx(actor), (tx) => startQmRound(tx, orgCtx(actor), actor.userId, data, tOf(actor)))
      return { redirectTo: `/quick-maths/play/${id}` }
    },
  )
}

const answerQm = z.object({ roundId, index: z.number().int().min(0).max(999), answer: z.number().int().min(0).max(9_999_999).nullable(), ms: z.number().min(0).max(3_600_000) }).strict()

export async function answerQmAction(input: { roundId: string; index: number; answer: number | null; ms: number }): Promise<ActionResult<QmAnswerResult>> {
  return runChild(
    'answerQm',
    async () => {
      const actor = await requireLearner()
      await throttleIp('arena-answer', 600, actor.userId)
      const data = answerQm.parse(input)
      return inOrg(orgCtx(actor), (tx) => answerQmRound(tx, actor.userId, data, tOf(actor)))
    },
  )
}

const hintQm = z.object({ roundId, index: z.number().int().min(0).max(999) }).strict()

export async function hintQmAction(input: { roundId: string; index: number }): Promise<ActionResult<{ title: string; steps: string[] }>> {
  return runChild(
    'hintQm',
    async () => {
      const actor = await requireLearner()
      const data = hintQm.parse(input)
      return inOrg(orgCtx(actor), (tx) => hintQmRound(tx, actor.userId, data, tOf(actor)))
    },
  )
}

export async function finishQmAction(id: string): Promise<ActionResult<QmResultDTO>> {
  return runChild(
    'finishQm',
    async () => {
      const actor = await requireLearner()
      const rid = roundId.parse(id)
      return inOrg(orgCtx(actor), (tx) => finishQmRound(tx, orgCtx(actor), actor.userId, rid, tOf(actor)))
    },
  )
}

const startQuiz = z.object({ topic: z.union([z.enum(TOPIC_IDS), z.literal('mix')]), mode: z.enum(['learn', 'quiz', 'speed']), variant: z.literal('map').optional() }).strict()

export async function startQuizAction(input: QuizStartInput): Promise<ActionResult<{ redirectTo: string }>> {
  return runChild(
    'startQuiz',
    async () => {
      const actor = await requireLearner()
      const data = startQuiz.parse(input)
      const { roundId: id } = await inOrg(orgCtx(actor), (tx) => startQuizRound(tx, orgCtx(actor), actor.userId, data, tOf(actor)))
      return { redirectTo: `/quiz-arena/play/${id}` }
    },
  )
}

const answerQuiz = z
  .object({
    roundId,
    index: z.number().int().min(0).max(999),
    answer: z.union([z.number().int().min(0).max(9), z.boolean(), z.array(z.string().min(1).max(40)).min(1).max(10), z.string().regex(/^[a-z]{3,16}$/), z.null()]),
    ms: z.number().min(0).max(3_600_000),
  })
  .strict()

export async function answerQuizAction(input: { roundId: string; index: number; answer: KAnswer | null; ms: number }): Promise<ActionResult<QuizAnswerResult>> {
  return runChild(
    'answerQuiz',
    async () => {
      const actor = await requireLearner()
      await throttleIp('arena-answer', 600, actor.userId)
      const data = answerQuiz.parse(input)
      return inOrg(orgCtx(actor), (tx) => answerQuizRound(tx, actor.userId, data, tOf(actor)))
    },
  )
}

export async function finishQuizAction(id: string): Promise<ActionResult<QuizResultDTO>> {
  return runChild(
    'finishQuiz',
    async () => {
      const actor = await requireLearner()
      const rid = roundId.parse(id)
      return inOrg(orgCtx(actor), (tx) => finishQuizRound(tx, orgCtx(actor), actor.userId, rid, tOf(actor)))
    },
  )
}

const accessory = z.union([z.enum(ACCESSORY_IDS), z.null()])

export async function changeAccessoryAction(value: AccessoryId | null): Promise<ActionResult> {
  return runChild(
    'changeAccessory',
    async () => {
      const actor = await requireLearner()
      const data = accessory.parse(value)
      await inOrg(orgCtx(actor), (tx) => assertAccessoryEarned(tx, actor.userId, data, tOf(actor)))
      await inOrg(systemCtx(actor.orgId), (tx) => applyAccessory(tx, actor.userId, data))
      return undefined
    },
  )
}
