import { NextResponse } from 'next/server'
import { z } from 'zod'
import { inOrg } from '@/server/db'
import { getActor, orgCtx } from '@/server/auth/actor'
import { AppError, newReference } from '@/server/errors'
import { log } from '@/server/log'
import { answerPayloadSchema, saveAnswer, submitAttempt } from '@/server/dal/learner-runner'
import type { AnswerPayload } from '@/lib/dto'
import { sameOrigin } from '@/server/http'

export const dynamic = 'force-dynamic'

const body = z
  .object({
    answers: z.array(z.unknown()).max(100),
    submits: z.array(z.object({ attemptId: z.string().uuid(), clientId: z.string().min(1).max(64) }).strict()).max(20),
  })
  .strict()

/** Kirim ulang jawaban dan pengumpulan yang tersimpan offline di tablet. Idempoten lewat clientId. */
export async function POST(req: Request) {
  const actor = await getActor()
  if (!actor || actor.role !== 'learner') return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  if (!sameOrigin(req)) return NextResponse.json({ error: 'origin' }, { status: 403 })
  const len = Number(req.headers.get('content-length') ?? '0')
  if (len > 1_500_000) return NextResponse.json({ error: 'too-large' }, { status: 413 })
  const parsed = body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid', reference: newReference() }, { status: 400 })
  const ctx = orgCtx(actor)
  const answers: { clientId: string; ok: boolean; retry: boolean }[] = []
  for (const raw of parsed.data.answers) {
    const p = answerPayloadSchema.safeParse(raw)
    if (!p.success) {
      answers.push({ clientId: String((raw as { clientId?: unknown })?.clientId ?? ''), ok: false, retry: false })
      continue
    }
    try {
      await inOrg(ctx, (tx) => saveAnswer(tx, ctx, actor.userId, p.data as AnswerPayload))
      answers.push({ clientId: p.data.clientId, ok: true, retry: false })
    } catch (e) {
      const retry = !(e instanceof AppError)
      if (retry) log.error('sinkron jawaban gagal', { error: e })
      answers.push({ clientId: p.data.clientId, ok: false, retry })
    }
  }
  const submits: { attemptId: string; ok: boolean; retry: boolean }[] = []
  for (const s of parsed.data.submits) {
    try {
      await inOrg(ctx, (tx) => submitAttempt(tx, ctx, actor.userId, s.attemptId))
      submits.push({ attemptId: s.attemptId, ok: true, retry: false })
    } catch (e) {
      submits.push({ attemptId: s.attemptId, ok: false, retry: !(e instanceof AppError) })
    }
  }
  return NextResponse.json({ answers, submits }, { headers: { 'Cache-Control': 'no-store' } })
}
