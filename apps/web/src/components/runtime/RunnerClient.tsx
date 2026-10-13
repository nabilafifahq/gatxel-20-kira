'use client'

import { useEffect, useMemo, useState } from 'react'
import { RunnerScreen } from '@/screens/learner'
import type { ActionResult, AnswerPayload, AnswerResult, RunnerDTO, SavedResponse } from '@/lib/dto'
import { checkAnswer } from '@kira/content/check'
import { isNetworkError, localAnswers, queueAnswer, queueSubmit } from '@/lib/offline/outbox'
import { reportProblemAction, saveAnswerAction, submitAttemptAction } from '@/server/actions/learner'
import { keepScreenAwake } from '@/lib/native'

/**
 * Pembungkus runner: jawaban yang gagal terkirim karena jaringan masuk kotak keluar
 * di perangkat, dan halaman yang dibuka ulang dari cache memuat jawaban lokal itu.
 */
export function RunnerClient({ data }: { data: RunnerDTO }) {
  const [local, setLocal] = useState<AnswerPayload[] | null>(null)

  // Layar tidak padam di tengah soal (tablet anak biasanya cepat terkunci).
  useEffect(() => keepScreenAwake(), [])

  useEffect(() => {
    let alive = true
    void localAnswers(data.attemptId).then((rows) => {
      if (alive) setLocal(rows)
    })
    return () => {
      alive = false
    }
  }, [data.attemptId])

  const merged = useMemo<RunnerDTO>(() => {
    if (!local || local.length === 0) return data
    const byPos = new Map<number, SavedResponse>(data.saved.map((s) => [s.position, s]))
    for (const p of local) {
      const cur = byPos.get(p.position)
      if (cur && cur.attemptNo > p.attemptNo) continue
      const item = data.items.find((i) => i.position === p.position)
      const status: SavedResponse['status'] = !data.showFeedback || !item?.key ? 'answered' : (checkAnswer(item.key, p.answer).status as SavedResponse['status'])
      byPos.set(p.position, { position: p.position, answer: p.answer, status, hintsUsed: p.hintsUsed, attemptNo: p.attemptNo, flagged: p.flagged })
    }
    return { ...data, saved: [...byPos.values()] }
  }, [data, local])

  const actions = useMemo(
    () => ({
      async saveAnswer(p: AnswerPayload): Promise<ActionResult<AnswerResult>> {
        try {
          const res = await saveAnswerAction(p)
          return res
        } catch (e) {
          if (isNetworkError(e)) {
            await queueAnswer(p)
            return { ok: true, data: { status: 'answered', xp: 0 } }
          }
          throw e
        }
      },
      async submitAttempt(attemptId: string, clientId: string): Promise<ActionResult<{ redirectTo: string }>> {
        try {
          return await submitAttemptAction(attemptId, clientId)
        } catch (e) {
          if (isNetworkError(e)) {
            await queueSubmit(attemptId, clientId)
            return { ok: true, data: { redirectTo: '/today?saved=offline' } }
          }
          throw e
        }
      },
      reportProblem: reportProblemAction,
    }),
    [],
  )

  const onUpload = async (blob: Blob, kind: 'audio' | 'drawing' | 'image', ctx: { attemptId: string; position: number }) => {
    const form = new FormData()
    form.set('file', blob, kind === 'audio' ? 'rekaman.webm' : kind === 'image' ? 'foto.jpg' : 'gambar.png')
    form.set('kind', kind)
    form.set('attemptId', ctx.attemptId)
    form.set('position', String(ctx.position))
    try {
      const res = await fetch('/api/media', { method: 'POST', body: form, credentials: 'same-origin' })
      if (!res.ok) return null
      return (await res.json()) as { mediaId: string }
    } catch {
      return null
    }
  }

  return <RunnerScreen data={merged} actions={actions} onUpload={onUpload} />
}
