import 'server-only'
import { eq } from 'drizzle-orm'
import { formatDateEn, jakartaDate, type IsoDate } from '@kira/core'
import { tables } from '@kira/db'
import { answerText, type Item } from '@kira/content'
import type { ResultsDTO, ReviewDTO, ReviewQuestionDTO, Subject } from '@/lib/dto'
import type { Tx } from '../db'
import { resolveItems, skill, toClient } from './content'
import { presetForAttempt } from './learner-competition'
import { learnerShell, loadLearner } from './learner-core'
import { exitFor, latestByPosition, loadAttempt, type AttemptItem } from './learner-runner'

const { response } = tables

const SUBJECT_LABEL: Record<Subject, string> = { math: 'Math', english: 'English', science: 'Science' }

type Topic = { label: string; right: number; total: number }

/** Teks jawaban learner untuk pembahasan. */
export function yourAnswerText(item: Item, answer: unknown): string {
  if (answer === null || answer === undefined) return 'No answer'
  const a = answer as Record<string, unknown>
  const letter = (i: number) => String.fromCharCode(65 + i)
  switch (item.type) {
    case 'mcq': {
      const i = a.choice as number
      const o = item.options[i]
      return o ? (o.text ? `${letter(i)}. ${o.text}` : letter(i)) : 'No answer'
    }
    case 'multi':
      return ((a.choices as number[]) ?? []).map((i) => (item.options[i]?.text ? `${letter(i)}. ${item.options[i]?.text}` : letter(i))).join('; ') || 'No answer'
    case 'numeric':
      return `${a.value as string}${item.unit ? ` ${item.unit}` : ''}`
    case 'text':
      return ((a.texts as string[]) ?? []).join(', ')
    case 'order':
      return ((a.order as number[]) ?? []).map((i) => item.items[i] ?? '?').join(', ')
    case 'match':
      return ((a.pairs as number[]) ?? []).map((r, l) => `${item.pairs[l]?.[0] ?? '?'}: ${item.pairs[r]?.[1] ?? '?'}`).join('; ')
    case 'sort':
      return ((a.groups as number[]) ?? []).map((g, i) => `${item.items[i]?.text ?? '?'}: ${item.groups[g] ?? '?'}`).join('; ')
    case 'numberline':
      return String(a.position)
    case 'clock':
      return `${a.h as number}:${String(a.m as number).padStart(2, '0')}`
    case 'fraction':
      return `${a.shaded as number} of ${item.parts} parts`
    case 'write':
      return (a.text as string) ?? ''
    case 'speak':
      return 'Voice recording sent'
    case 'draw':
      return 'Drawing sent'
  }
}

function headlineFor(pct: number, pending: number): { headline: string; detail: string; tone: ResultsDTO['tone'] } {
  if (pending > 0 && pct >= 0.5) return { headline: 'Great work so far', detail: 'Your tutor will mark the rest.', tone: 'normal' }
  if (pct >= 1) return { headline: 'Every one right', detail: 'That is a full score. Brilliant.', tone: 'full' }
  if (pct >= 0.7) return { headline: 'Strong work', detail: 'Look at the ones marked Not yet to see the steps.', tone: 'normal' }
  if (pct >= 0.4) return { headline: 'Good effort', detail: 'Some of these were tricky. The steps will help.', tone: 'low' }
  return { headline: 'You kept going', detail: 'These were hard. We will practise them again soon.', tone: 'low' }
}

/** Attempt yang belum dikumpulkan tidak punya hasil: halaman hasil kembali ke runner. */
export type NotSubmitted = { inProgress: true }

/*
 * Mode Tes, Simulasi, dan Kertas menilai jawaban diam-diam selama attempt berjalan. Hasil per soal dan kunci
 * hanya dikirim setelah attempt dikumpulkan, supaya learner tidak bisa membuka /results/<id> di tengah tes.
 */
export async function resultsDTO(tx: Tx, learnerId: string, attemptId: string): Promise<ResultsDTO | NotSubmitted> {
  const a = await loadAttempt(tx, learnerId, attemptId)
  if (a.status === 'in_progress') return { inProgress: true }
  const learner = await loadLearner(tx, learnerId)
  const items = (a.items as AttemptItem[]) ?? []
  const resolved = await resolveItems(tx, items.map((i) => i.ref))
  const latest = latestByPosition(await tx.select().from(response).where(eq(response.attemptId, a.id)))
  const result = (a.result as { byTopic?: Topic[]; timeUsedSec?: number; pending?: number; newBadges?: ResultsDTO['newBadges'] } | null) ?? {}
  const questions = items.map((it) => {
    const r = latest.get(it.position)
    const item = resolved.get(it.ref)
    return {
      position: it.position,
      status: (r?.status ?? 'blank') as ResultsDTO['questions'][number]['status'],
      skillTitle: item ? (skill(item.skill)?.title ?? '') : '',
    }
  })
  const correct = questions.filter((q) => q.status === 'correct').length
  const pending = questions.filter((q) => q.status === 'pending').length
  const total = items.length
  const p = presetForAttempt(a)
  const scaledTarget = p?.rules.passMark ?? (a.kind.startsWith('esmo') ? 70 : null)
  const pct = total > 0 ? correct / Math.max(1, total - pending) : 0
  const tone = headlineFor(pct, pending)
  const topics = (result.byTopic ?? []).filter((t) => t.total > 0)
  const sorted = [...topics].sort((x, y) => y.right / y.total - x.right / x.total)
  const strongest = sorted.length > 1 ? sorted[0] : undefined
  const weakest = sorted.length > 1 ? sorted[sorted.length - 1] : undefined
  const subject = a.subject as Subject
  const date = a.submittedAt ? formatDateEn(jakartaDate(a.submittedAt) as IsoDate, true) : ''
  const exit = exitFor(a)
  return {
    shell: await learnerShell(tx, learner),
    attemptId: a.id,
    subject,
    title: a.title,
    meta: `${total} questions${a.timeLimitS ? `, ${Math.round(a.timeLimitS / 60)} minutes` : ''}${date ? `, ${date}` : ''}`,
    scoreLabel: a.scoreScaled !== null && a.scoreScaled !== undefined ? `${Math.round(a.scoreScaled)} out of 100` : `${correct} out of ${total}`,
    scoreValue: a.scoreScaled !== null && a.scoreScaled !== undefined ? Math.round(a.scoreScaled) : p ? Math.round(a.scoreRaw ?? correct) : correct,
    scoreMax: a.scoreScaled !== null && a.scoreScaled !== undefined ? 100 : p ? Math.round(a.scoreMax ?? total) : total,
    scaled: a.scoreScaled !== null && a.scoreScaled !== undefined && scaledTarget !== null ? { value: Math.round(a.scoreScaled), target: scaledTarget } : null,
    headline: tone.headline,
    detail: tone.detail,
    timeUsedSec: result.timeUsedSec ?? a.elapsedS,
    timeLimitSec: a.timeLimitS,
    xp: a.xp,
    newBadges: result.newBadges ?? [],
    questions,
    strongest: strongest ? { topic: strongest.label, line: `${strongest.right} of ${strongest.total} right` } : null,
    weakest: weakest && weakest !== strongest ? { topic: weakest.label, line: `${weakest.right} of ${weakest.total} right` } : null,
    byTopic: topics,
    reviewHref: `/results/${a.id}/review`,
    backHref: exit,
    backLabel: exit === '/esmo' ? 'Back to ESMO' : exit === '/competitions' ? 'Back to practice' : exit === '/review' ? 'Back to Review' : 'Back to Today',
    tone: tone.tone,
  }
}

export async function reviewDTO(tx: Tx, learnerId: string, attemptId: string, open: number | null): Promise<ReviewDTO | NotSubmitted> {
  const a = await loadAttempt(tx, learnerId, attemptId)
  if (a.status === 'in_progress') return { inProgress: true }
  const learner = await loadLearner(tx, learnerId)
  const items = (a.items as AttemptItem[]) ?? []
  const resolved = await resolveItems(tx, items.map((i) => i.ref))
  const latest = latestByPosition(await tx.select().from(response).where(eq(response.attemptId, a.id)))
  const questions: ReviewQuestionDTO[] = []
  for (const it of items) {
    const item = resolved.get(it.ref)
    if (!item) continue
    const r = latest.get(it.position)
    const status = (r?.status ?? 'blank') as ReviewQuestionDTO['status']
    const choice = item.type === 'mcq' && r?.answer ? (r.answer as { choice?: number }).choice : undefined
    const why = choice !== undefined && item.type === 'mcq' && choice !== item.answer ? (item.options[choice]?.why ?? null) : null
    questions.push({
      position: it.position,
      item: toClient(item, { ref: it.ref, seed: a.id, includeKey: true, includeHints: true }),
      yourAnswerText: yourAnswerText(item, r?.answer ?? null),
      correctAnswerText: item.type === 'write' || item.type === 'speak' || item.type === 'draw' ? 'Your tutor will mark this.' : answerText(item),
      status,
      explanation: item.explanation,
      whyYourAnswer: why,
      tip: item.tip ?? null,
      solution: item.solution ?? null,
      tutorFeedback: r?.feedback ?? null,
      similarHref: status === 'wrong' && item.skill ? `/practice/${item.skill}` : null,
    })
  }
  const firstWrong = questions.find((q) => q.status === 'wrong')?.position ?? questions[0]?.position ?? 1
  return {
    shell: await learnerShell(tx, learner),
    attemptId: a.id,
    title: a.title,
    subject: a.subject as Subject,
    questions,
    openPosition: open && questions.some((q) => q.position === open) ? open : firstWrong,
    backHref: `/results/${a.id}`,
  }
}

export { SUBJECT_LABEL }
