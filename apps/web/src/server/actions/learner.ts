'use server'

import { z } from 'zod'
import { AVATARS, PIN_PICTURES } from '@kira/figures/spec'
import { tables } from '@kira/db'
import type { ActionResult, AnswerPayload, AnswerResult, AvatarName, PinPicture, RemedialLessonDTO, RunnerItem, SolutionStepDTO } from '@/lib/dto'
import { inOrg } from '../db'
import { getT } from '@/lib/i18n/server'
import { AppError, newReference, notFound, runAction as runBase, toFailure } from '../errors'
import { localFailure, orgCtx, requireActor, requireLearner } from '../auth/actor'
import { getDevice, touchDevice } from '../auth/device'
import { checkPin } from '../auth/pin'
import { endCurrentSession, startSession } from '../auth/session'
import { clientIp, throttleIp } from '../auth/ratelimit'
import { ipHash } from '../auth/crypto'
import { forwardProblemReport } from '../dal/support'
import { log } from '../log'
import { learnerOrgFor, setLearnerAvatar } from '../dal/learner-entry'
import { answerPayloadSchema, saveAnswer, submitAttempt } from '../dal/learner-runner'
import { completeLesson } from '../dal/learner-explore'
import { loadLearner } from '../dal/learner-core'
import { createRetryAttempt } from '../dal/learner-session'
import { addRemedialItem, remedialLesson, walkthroughFor } from '../dal/remedial'
import { startEsmoMock, startEsmoPack, startSimulation } from '../dal/learner-competition'
import { audit } from '../audit'

async function runAction<T>(context: string, fn: () => Promise<T>, lang?: 'id' | 'en-GB'): Promise<ActionResult<T>> {
  return localFailure(await runBase(context, fn, lang))
}

const pinSchema = z.object({ learnerId: z.string().uuid(), pin: z.array(z.enum(PIN_PICTURES)).length(4) }).strict()

export async function submitPinAction(learnerId: string, pin: PinPicture[]): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    await throttleIp('pin', 240)
    const input = pinSchema.parse({ learnerId, pin })
    const device = await getDevice()
    if (!device) throw new AppError('forbidden', (await getT()).shell.pin.notSetUp)
    const learner = await learnerOrgFor(device, input.learnerId)
    if (!learner) throw notFound((await getT()).shell.pin.checkAccount)
    if (!learner.active) throw new AppError('forbidden', (await getT()).shell.pin.nearlyReady)
    const result = await checkPin(input.learnerId, input.pin)
    if (!result.ok) {
      const reference = newReference()
      if (result.reason === 'locked') {
        await audit({ orgId: device.orgId, userId: input.learnerId, role: 'learner' }, 'pin.locked', input.learnerId)
        return { ok: false, message: (await getT()).shell.pin.lockedMessage, reference, fieldErrors: { lockedUntil: result.lockedUntil.toISOString() } }
      }
      return { ok: false, message: (await getT()).shell.pin.wrongMessage, reference, fieldErrors: { attemptsLeft: String(result.attemptsLeft) } }
    }
    await startSession({ id: input.learnerId, orgId: device.orgId, kind: 'learner' }, device.id)
    await touchDevice(device.id)
    return { ok: true, data: { redirectTo: '/today' } }
  } catch (e) {
    return localFailure(toFailure(e, 'submitPin', 'en-GB'))
  }
}

export async function saveAnswerAction(p: AnswerPayload): Promise<ActionResult<AnswerResult>> {
  return runAction(
    'saveAnswer',
    async () => {
      const actor = await requireLearner()
      await throttleIp('save-answer', 600, actor.userId)
      const input = answerPayloadSchema.parse(p)
      return inOrg(orgCtx(actor), (tx) => saveAnswer(tx, orgCtx(actor), actor.userId, input as AnswerPayload))
    },
    'en-GB',
  )
}

export async function submitAttemptAction(attemptId: string, clientId: string): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(
    'submitAttempt',
    async () => {
      const actor = await requireLearner()
      await throttleIp('submit', 120, actor.userId)
      const id = z.string().uuid().parse(attemptId)
      z.string().min(1).max(64).parse(clientId)
      return inOrg(orgCtx(actor), (tx) => submitAttempt(tx, orgCtx(actor), actor.userId, id))
    },
    'en-GB',
  )
}

const reportSchema = z
  .object({
    itemRef: z.string().min(3).max(120),
    reason: z.enum(['wrong-answer', 'confusing', 'picture', 'other']),
    note: z.string().max(500),
  })
  .strict()

export async function reportProblemAction(input: { itemRef: string; reason: 'wrong-answer' | 'confusing' | 'picture' | 'other'; note: string }): Promise<ActionResult<{ reference: string }>> {
  return runAction(
    'reportProblem',
    async () => {
      const actor = await requireActor()
      const data = reportSchema.parse(input)
      const reference = newReference()
      await inOrg(orgCtx(actor), (tx) =>
        tx.insert(tables.problemReport).values({
          orgId: actor.orgId,
          learnerId: actor.role === 'learner' ? actor.userId : null,
          reporterId: actor.userId,
          itemRef: data.itemRef,
          reason: data.reason,
          note: data.note.trim(),
          reference,
        }),
      )
      // Laporan sudah tersimpan: gagal meneruskan ke kotak bantuan tidak boleh menggagalkan laporan anak.
      try {
        await throttleIp('problem-report-forward', 6, actor.userId)
        await forwardProblemReport({ orgId: actor.orgId, reference, itemRef: data.itemRef, reason: data.reason, note: data.note, ipHash: ipHash(await clientIp()) })
      } catch (e) {
        log.warn('laporan soal tidak diteruskan ke kotak bantuan', { reference, error: e })
      }
      return { reference }
    },
    'en-GB',
  )
}

export async function changeAvatarAction(avatar: AvatarName): Promise<ActionResult> {
  return runAction(
    'changeAvatar',
    async () => {
      const actor = await requireLearner()
      const value = z.enum(AVATARS).parse(avatar)
      await setLearnerAvatar(actor.orgId, actor.userId, value)
      return undefined
    },
    'en-GB',
  )
}

export async function completeLessonAction(skillId: string, correct: number, total: number): Promise<ActionResult> {
  return runAction(
    'completeLesson',
    async () => {
      const actor = await requireLearner()
      const input = z.object({ skillId: z.string().regex(/^[mes][1-6]\.[a-z0-9-]+$/), correct: z.number().int().min(0).max(10), total: z.number().int().min(0).max(10) }).strict().parse({ skillId, correct, total })
      await inOrg(orgCtx(actor), (tx) => completeLesson(tx, orgCtx(actor), actor.userId, input.skillId, input.correct, input.total))
      return undefined
    },
    'en-GB',
  )
}

/** Ulang seluruh sesi yang sudah selesai (Latihan, Tes, atau Paper). Percobaan pertama tetap resmi. */
export async function retrySessionAction(attemptId: string): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(
    'retrySession',
    async () => {
      const actor = await requireLearner()
      const id = z.string().uuid().parse(attemptId)
      const newId = await inOrg(orgCtx(actor), async (tx) => createRetryAttempt(tx, orgCtx(actor), await loadLearner(tx, actor.userId), id))
      return { redirectTo: `/run/${newId}` }
    },
    'en-GB',
  )
}

export async function startSimulationAction(presetId: string): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(
    'startSimulation',
    async () => {
      const actor = await requireLearner()
      const id = z.string().regex(/^[a-z0-9-]+$/).max(60).parse(presetId)
      const attemptId = await inOrg(orgCtx(actor), (tx) => startSimulation(tx, orgCtx(actor), actor.userId, id))
      return { redirectTo: `/run/${attemptId}` }
    },
    'en-GB',
  )
}

export async function startEsmoPackAction(packId: string): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(
    'startEsmoPack',
    async () => {
      const actor = await requireLearner()
      const id = z.string().regex(/^(esmo|builtin):(math|english):\d{1,3}$/).parse(packId)
      const attemptId = await inOrg(orgCtx(actor), (tx) => startEsmoPack(tx, orgCtx(actor), actor.userId, id))
      return { redirectTo: `/run/${attemptId}` }
    },
    'en-GB',
  )
}

export async function startEsmoMockAction(subject: 'math' | 'english'): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(
    'startEsmoMock',
    async () => {
      const actor = await requireLearner()
      const s = z.enum(['math', 'english']).parse(subject)
      const attemptId = await inOrg(orgCtx(actor), (tx) => startEsmoMock(tx, orgCtx(actor), actor.userId, s))
      return { redirectTo: `/run/${attemptId}` }
    },
    'en-GB',
  )
}

export async function signOutLearnerAction(): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction('signOutLearner', async () => {
    await endCurrentSession()
    return { redirectTo: '/' }
  })
}

const remedialSchema = z.object({ attemptId: z.string().uuid(), position: z.number().int().min(1).max(500) }).strict()

/** Satu langkah pelajaran dari skill soal yang baru salah (Latihan saja). */
export async function remedialLessonAction(input: { attemptId: string; position: number }): Promise<ActionResult<{ lesson: RemedialLessonDTO | null }>> {
  return runAction(
    'remedialLesson',
    async () => {
      const actor = await requireLearner()
      const data = remedialSchema.parse(input)
      const lesson = await inOrg(orgCtx(actor), (tx) => remedialLesson(tx, actor.userId, data.attemptId, data.position))
      return { lesson }
    },
    'en-GB',
  )
}

/** Tambahkan satu soal saudara ke sesi Latihan setelah jawaban salah. */
export async function addRemedialItemAction(input: { attemptId: string; position: number }): Promise<ActionResult<{ item: RunnerItem | null }>> {
  return runAction(
    'addRemedialItem',
    async () => {
      const actor = await requireLearner()
      const data = remedialSchema.parse(input)
      const item = await inOrg(orgCtx(actor), (tx) => addRemedialItem(tx, actor.userId, actor.orgId, data.attemptId, data.position))
      return { item }
    },
    'en-GB',
  )
}

/** Pembahasan bergerak satu soal, dimuat saat anak membukanya. */
export async function walkthroughAction(input: { attemptId: string; position: number }): Promise<ActionResult<{ steps: SolutionStepDTO[] | null }>> {
  return runAction(
    'walkthrough',
    async () => {
      const actor = await requireLearner()
      const data = remedialSchema.parse(input)
      const steps = await inOrg(orgCtx(actor), (tx) => walkthroughFor(tx, actor.userId, data.attemptId, data.position))
      return { steps }
    },
    'en-GB',
  )
}
