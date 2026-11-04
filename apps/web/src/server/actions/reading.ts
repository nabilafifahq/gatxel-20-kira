'use server'

import { z } from 'zod'
import type { ActionResult } from '@/lib/dto'
import type { QuizAnswerInput, QuizDTO, QuizResultDTO } from '@/lib/dto-reading'
import { inOrg } from '../db'
import { forbidden } from '../errors'
import { tOf } from '@/lib/i18n'
import { runLearnerAction as runAction } from './learner-run'
import { orgCtx, requireLearner } from '../auth/actor'
import { isFeatureOn } from '../dal/learner-features'
import { logReadingSeconds, markChapterRead, saveProgress, startChapterQuiz, submitChapterQuiz } from '../dal/reading-room'

const bookId = z.string().regex(/^g[1-6]-[a-z0-9-]{2,60}$/)
const chapterId = z.string().regex(/^c[1-8]$/)

async function reader() {
  const actor = await requireLearner()
  if (!(await isFeatureOn(actor.userId, 'reading-room'))) throw forbidden(tOf(actor).reading.errors.readingOff)
  return actor
}

const progressSchema = z.object({ bookId, chapterId, sentenceIdx: z.number().int().min(0).max(4999) }).strict()

/** Simpan tempat berhenti membaca. */
export async function saveReadingProgressAction(input: { bookId: string; chapterId: string; sentenceIdx: number }): Promise<ActionResult<null>> {
  return runAction(
    'saveReadingProgress',
    async () => {
      const actor = await reader()
      const data = progressSchema.parse(input)
      await inOrg(orgCtx(actor), (tx) => saveProgress(tx, orgCtx(actor), actor.userId, data))
      return null
    },
  )
}

const timeSchema = z.object({ seconds: z.number().int().min(1).max(60) }).strict()

/** Catat detik membaca (dipanggil tiap 30 detik saat anak aktif membaca). */
export async function logReadingTimeAction(input: { seconds: number }): Promise<ActionResult<null>> {
  return runAction(
    'logReadingTime',
    async () => {
      const actor = await reader()
      const data = timeSchema.parse(input)
      await inOrg(orgCtx(actor), (tx) => logReadingSeconds(tx, orgCtx(actor), actor.userId, data.seconds))
      return null
    },
  )
}

const chapterSchema = z.object({ bookId, chapterId }).strict()

/** Mulai kuis bab: server memilih soal dan tidak mengirim kunci. */
export async function startChapterQuizAction(input: { bookId: string; chapterId: string }): Promise<ActionResult<QuizDTO>> {
  return runAction(
    'startChapterQuiz',
    async () => {
      const actor = await reader()
      const data = chapterSchema.parse(input)
      return inOrg(orgCtx(actor), (tx) => startChapterQuiz(tx, orgCtx(actor), actor.userId, data.bookId, data.chapterId))
    },
  )
}

const submitSchema = z
  .object({
    quizId: z.string().uuid(),
    answers: z.array(z.object({ questionId: z.string().regex(/^q[1-8]$/), choice: z.number().int().min(0).max(3) }).strict()).min(0).max(8),
  })
  .strict()

/** Kumpulkan kuis: server menilai dan memberi XP sekali per bab. */
export async function submitChapterQuizAction(input: { quizId: string; answers: QuizAnswerInput[] }): Promise<ActionResult<QuizResultDTO>> {
  return runAction(
    'submitChapterQuiz',
    async () => {
      const actor = await reader()
      const data = submitSchema.parse(input)
      return inOrg(orgCtx(actor), (tx) => submitChapterQuiz(tx, orgCtx(actor), actor.userId, data.quizId, data.answers))
    },
  )
}

/** Lewati kuis: bab dihitung sudah dibaca, tanpa XP. */
export async function skipChapterQuizAction(input: { bookId: string; chapterId: string }): Promise<ActionResult<{ bookFinished: boolean; nextHref: string | null }>> {
  return runAction(
    'skipChapterQuiz',
    async () => {
      const actor = await reader()
      const data = chapterSchema.parse(input)
      return inOrg(orgCtx(actor), (tx) => markChapterRead(tx, orgCtx(actor), actor.userId, data.bookId, data.chapterId))
    },
  )
}
