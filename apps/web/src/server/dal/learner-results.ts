import 'server-only'
import { eq } from 'drizzle-orm'
import { formatDateEn, formatDateId, jakartaDate, type IsoDate } from '@kira/core'
import { tables } from '@kira/db'
import { answerText, MANUAL_TYPES, type Item } from '@kira/content'
import { analysePegs, blocksValue, formatLength, parseBars, parseBlocks, parseModel, parsePegs, parsePlacements } from '@kira/content/manip'
import { bestIndex } from '@kira/core'
import type { ResultsDTO, RetryDTO, ReviewDTO, ReviewQuestionDTO, Subject } from '@/lib/dto'
import { dictFor, type Dict } from '@/lib/i18n'
import type { Tx } from '../db'
import { preset, resolveItems, skill, toClient } from './content'
import { presetForAttempt } from './learner-competition'
import { learnerShell, loadLearner, markerFor } from './learner-core'
import { xpBarFor } from './learner-xpbar'
import { attemptTitle, exitFor, latestByPosition, loadAttempt, presentationSeed, type AttemptItem } from './learner-runner'
import { worldPeek } from './kira-world'
import { familyOf, learnerLang, retryInfo, scoreOf, scoreText } from './learner-session'

const { response } = tables

const SUBJECT_LABEL: Record<Subject, string> = { math: 'Math', english: 'English', science: 'Science' }

type Topic = { label: string; right: number; total: number }

/** Teks jawaban learner untuk pembahasan. */
export function yourAnswerText(item: Item, answer: unknown, t: Dict['runner']['dal']['answers'] = dictFor('en').runner.dal.answers): string {
  if (answer === null || answer === undefined) return t.none
  const a = answer as Record<string, unknown>
  const letter = (i: number) => String.fromCharCode(65 + i)
  switch (item.type) {
    case 'mcq': {
      const i = a.choice as number
      const o = item.options[i]
      return o ? (o.text ? `${letter(i)}. ${o.text}` : letter(i)) : t.none
    }
    case 'multi':
      return ((a.choices as number[]) ?? []).map((i) => (item.options[i]?.text ? `${letter(i)}. ${item.options[i]?.text}` : letter(i))).join('; ') || t.none
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
      return t.fraction(a.shaded as number, item.parts)
    case 'write':
      return (a.text as string) ?? ''
    case 'speak':
      return t.voice
    case 'draw':
      return t.drawing
    case 'photo':
      return t.photo
    case 'story':
      return (
        ((a.parts as (Record<string, unknown> | null)[]) ?? [])
          .map((p, k) => {
            const part = item.parts[k]
            if (!part || !p) return `${k + 1}. ${t.none}`
            if (part.type === 'mcq') {
              const o = part.options[p.choice as number]
              return `${k + 1}. ${o?.text ?? t.none}`
            }
            if (part.type === 'numeric') return `${k + 1}. ${String(p.value ?? '')}${part.unit ? ` ${part.unit}` : ''}`
            return `${k + 1}. ${((p.texts as string[]) ?? [])[0] ?? ''}`
          })
          .join('; ') || t.none
      )
    case 'listen': {
      const o = item.options[a.choice as number]
      return o ? (o.text ?? String.fromCharCode(65 + (a.choice as number))) : t.none
    }
    case 'tiles':
      return ((a.words as string[]) ?? []).join(' ') || t.none
    case 'spell':
      return (a.value as string) || t.none
    case 'cloze':
    case 'hotspot':
    case 'table':
      return ((a.texts as string[]) ?? []).filter(Boolean).join(', ') || t.none
    case 'label':
      return ((a.texts as string[]) ?? []).map((v, i) => `${i + 1}. ${v || '?'}`).join('; ') || t.none
    case 'grid': {
      const cells = (a.cells as number[]) ?? []
      const n = item.size
      return Array.from({ length: n }, (_, r) => cells.slice(r * n, r * n + n).map((c) => (c === 0 ? '_' : String(c))).join(' ')).join(' / ')
    }
    case 'blocks': {
      const b = parseBlocks(a.blocks)
      return b ? t.blocks(blocksValue(b), b.h, b.t, b.o) : t.none
    }
    case 'fractionbar':
      return (parseBars(a.bars) ?? []).map((b, i) => t.bar(i + 1, b.shaded, b.den)).join('; ') || t.none
    case 'barmodel': {
      const m = parseModel(a.model)
      return m ? m.bars.map((b) => `${b.label}: ${b.units}`).join('; ') + (m.unit !== undefined ? `; 1 unit = ${m.unit}` : '') : t.none
    }
    case 'tangram': {
      const placed = parsePlacements(a.placed, item.slots.length, item.pieces.length)
      return placed ? t.pieces(placed.filter(Boolean).length, item.slots.length) : t.none
    }
    case 'geoboard': {
      const pegs = parsePegs(a.pegs, item.size)
      if (!pegs) return t.none
      const info = analysePegs(pegs)
      return info.ok ? t.shape(info.sides, formatLength(info.area), formatLength(info.perimeter)) : t.shapeOpen
    }
  }
}

function headlineFor(pct: number, pending: number, marker: 'tutor' | 'grownup', t: Dict['runner']['dal']): { headline: string; detail: string; tone: ResultsDTO['tone'] } {
  if (pending > 0 && pct >= 0.5) return { headline: t.headlines.soFar, detail: marker === 'grownup' ? t.details.grownupRest : t.details.tutorRest, tone: 'normal' }
  if (pct >= 1) return { headline: t.headlines.full, detail: t.details.full, tone: 'full' }
  if (pct >= 0.7) return { headline: t.headlines.strong, detail: t.details.strong, tone: 'normal' }
  if (pct >= 0.4) return { headline: t.headlines.good, detail: t.details.good, tone: 'low' }
  return { headline: t.headlines.kept, detail: t.details.kept, tone: 'low' }
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
  const lang = await learnerLang()
  const dict = dictFor(lang)
  const t = dict.runner.dal
  const learner = await loadLearner(tx, learnerId)
  const marker = await markerFor(tx)
  // Soal serupa dari putaran perbaikan tidak ikut skor sesi (tetap ada di review).
  const items = ((a.items as AttemptItem[]) ?? []).filter((i) => i.remedialOf === undefined)
  const resolved = await resolveItems(tx, items.map((i) => i.ref))
  const latest = latestByPosition(await tx.select().from(response).where(eq(response.attemptId, a.id)))
  const result = (a.result as { byTopic?: Topic[]; timeUsedSec?: number; pending?: number; newBadges?: ResultsDTO['newBadges']; world?: { stars: number; cards: string[] } } | null) ?? {}
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
  // Paper harian dinilai dengan preset yang tersimpan di attempt (poin lomba), bukan hanya jumlah benar.
  const p = presetForAttempt(a) ?? (a.presetId ? preset(a.presetId) : undefined)
  const scaledTarget = p?.rules.passMark ?? (a.kind.startsWith('esmo') ? 70 : null)
  const pct = total > 0 ? correct / Math.max(1, total - pending) : 0
  const tone = headlineFor(pct, pending, marker, t)
  const topics = (result.byTopic ?? []).filter((t) => t.total > 0)
  const sorted = [...topics].sort((x, y) => y.right / y.total - x.right / x.total)
  const strongest = sorted.length > 1 ? sorted[0] : undefined
  const weakest = sorted.length > 1 ? sorted[sorted.length - 1] : undefined
  const subject = a.subject as Subject
  const date = a.submittedAt ? (lang === 'id' ? formatDateId : formatDateEn)(jakartaDate(a.submittedAt) as IsoDate, true) : ''
  const exit = exitFor(a)
  const retry = await retryDTO(tx, a, total, dict)
  return {
    shell: await learnerShell(tx, learner),
    marker,
    attemptId: a.id,
    subject,
    title: attemptTitle(a.title, dict),
    meta: `${t.metaQuestions(total)}${a.timeLimitS ? `, ${t.metaMinutes(Math.round(a.timeLimitS / 60))}` : ''}${date ? `, ${date}` : ''}`,
    scoreLabel: a.scoreScaled !== null && a.scoreScaled !== undefined ? t.outOf(Math.round(a.scoreScaled), 100) : t.outOf(correct, total),
    scoreValue: a.scoreScaled !== null && a.scoreScaled !== undefined ? Math.round(a.scoreScaled) : p ? Math.round(a.scoreRaw ?? correct) : correct,
    scoreMax: a.scoreScaled !== null && a.scoreScaled !== undefined ? 100 : p ? Math.round(a.scoreMax ?? total) : total,
    scaled: a.scoreScaled !== null && a.scoreScaled !== undefined && scaledTarget !== null ? { value: Math.round(a.scoreScaled), target: scaledTarget } : null,
    headline: tone.headline,
    detail: tone.detail,
    timeUsedSec: result.timeUsedSec ?? a.elapsedS,
    timeLimitSec: a.timeLimitS,
    xp: a.xp,
    ...(result.world ? { world: { ...result.world, pet: (await worldPeek(tx, learnerId).catch(() => null))?.pet ?? null } } : {}),
    newBadges: result.newBadges ?? [],
    questions,
    strongest: strongest ? { topic: strongest.label, line: t.topicLine(strongest.right, strongest.total) } : null,
    weakest: weakest && weakest !== strongest ? { topic: weakest.label, line: t.topicLine(weakest.right, weakest.total) } : null,
    byTopic: topics,
    reviewHref: `/results/${a.id}/review`,
    backHref: exit,
    backLabel: exit === '/esmo' ? t.backEsmo : exit === '/competitions' ? t.backPractice : exit === '/review' ? t.backReview : t.backToday,
    tone: tone.tone,
    retry,
    xpBar: await xpBarFor(tx, learnerId, a.id),
  }
}

/** Ulang sesi: skor resmi (percobaan pertama), skor terbaik, dan apakah masih ada ulangan yang belum selesai. */
async function retryDTO(tx: Tx, a: Awaited<ReturnType<typeof loadAttempt>>, total: number, dict: Dict): Promise<RetryDTO | null> {
  const info = await retryInfo(tx, a)
  if (!info) return null
  const family = await familyOf(tx, info.rootId)
  const done = family.filter((f) => f.status !== 'in_progress')
  const root = family[0]!
  const bestAt = done.length > 1 ? bestIndex(done.map(scoreOf)) : -1
  return {
    isRetry: a.retryOf !== null,
    retryNo: a.retryNo,
    official: scoreText(root, total, dict.runner)?.text ?? dict.common.done,
    best: bestAt > 0 ? (scoreText(done[bestAt]!, total, dict.runner)?.text ?? null) : null,
    xpNote: dict.runner.dal.xpNote,
    continueOpen: family.some((f) => f.status === 'in_progress' && f.retryNo > 0),
  }
}

export async function reviewDTO(tx: Tx, learnerId: string, attemptId: string, open: number | null): Promise<ReviewDTO | NotSubmitted> {
  const a = await loadAttempt(tx, learnerId, attemptId)
  if (a.status === 'in_progress') return { inProgress: true }
  const dict = dictFor(await learnerLang())
  const t = dict.runner.dal
  const learner = await loadLearner(tx, learnerId)
  const marker = await markerFor(tx)
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
      item: toClient(item, { ref: it.ref, seed: presentationSeed(a), includeKey: true, includeHints: true }),
      yourAnswerText: yourAnswerText(item, r?.answer ?? null, t.answers),
      correctAnswerText: MANUAL_TYPES.includes(item.type) ? (marker === 'grownup' ? t.grownupMark : t.tutorMark) : answerText(item),
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
    marker,
    attemptId: a.id,
    title: attemptTitle(a.title, dict),
    subject: a.subject as Subject,
    questions,
    openPosition: open && questions.some((q) => q.position === open) ? open : firstWrong,
    backHref: `/results/${a.id}`,
  }
}

export { SUBJECT_LABEL }
