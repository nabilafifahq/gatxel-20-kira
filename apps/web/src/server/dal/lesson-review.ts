import 'server-only'
import { and, desc, eq, isNotNull } from 'drizzle-orm'
import { jakartaDate } from '@kira/core'
import { effectiveOn } from '@kira/core/features'
import { tables } from '@kira/db'
import type { LearnerShell, Subject } from '@/lib/dto'
import type { OrgContext, Tx } from '../db'
import { notFound } from '../errors'
import { lesson, skill, strandName } from './content'
import { featureMapFor } from './learner-features'
import { learnerShell, loadLearner, QUICK_REVIEW_PREFIX } from './learner-core'
import { buildQuestItems } from './learner-session'
import { guardPracticeRefs } from './practice-guard'

const { skillState, attempt } = tables

/** Ulasan singkat pelajaran yang sudah selesai: langkah inti, lalu 3 soal cepat. Tanpa efek ke streak, tanpa batas. */

export type ReviewListDTO = {
  shell: LearnerShell
  groups: { subject: Subject; label: string; lessons: { skillId: string; title: string; strand: string }[] }[]
}
export type ReviewDTO = {
  shell: LearnerShell
  skillId: string
  subject: Subject
  title: string
  steps: { say: string; show: string | null }[]
  lessonHref: string
}

const LABEL: Record<Subject, string> = { math: 'Math', english: 'English', science: 'Science' }

/** Langkah inti: lewati pengantar panjang (langkah pertama bila pelajaran punya 5 langkah atau lebih), paling banyak 4. */
export function coreSteps<T extends { say: string }>(steps: readonly T[]): T[] {
  const body = steps.length >= 5 ? steps.slice(1) : [...steps]
  return body.slice(0, 4)
}

export async function reviewListDTO(tx: Tx, learnerId: string): Promise<ReviewListDTO> {
  const learner = await loadLearner(tx, learnerId)
  const features = await featureMapFor(tx, learnerId)
  const rows = await tx
    .select({ skillId: skillState.skillId, at: skillState.lessonDoneAt })
    .from(skillState)
    .where(and(eq(skillState.learnerId, learnerId), isNotNull(skillState.lessonDoneAt)))
    .orderBy(desc(skillState.lessonDoneAt))
  const groups = new Map<Subject, ReviewListDTO['groups'][number]['lessons']>()
  for (const r of rows) {
    const sk = skill(r.skillId)
    const l = lesson(r.skillId)
    if (!sk || !l || !effectiveOn(features, sk.subject)) continue
    groups.set(sk.subject, [...(groups.get(sk.subject) ?? []), { skillId: r.skillId, title: l.title, strand: strandName(sk.strand) }])
  }
  return {
    shell: await learnerShell(tx, learner),
    groups: (['math', 'english', 'science'] as const).filter((s) => groups.has(s)).map((s) => ({ subject: s, label: LABEL[s], lessons: groups.get(s)! })),
  }
}

async function requireFinished(tx: Tx, learnerId: string, skillId: string) {
  const sk = skill(skillId)
  const l = lesson(skillId)
  if (!sk || !l) throw notFound()
  const [row] = await tx.select({ at: skillState.lessonDoneAt }).from(skillState).where(and(eq(skillState.learnerId, learnerId), eq(skillState.skillId, skillId))).limit(1)
  if (!row?.at) throw notFound('Selesaikan pelajarannya dulu.')
  if (!effectiveOn(await featureMapFor(tx, learnerId), sk.subject)) throw notFound()
  return { sk, l }
}

export async function reviewDTO(tx: Tx, learnerId: string, skillId: string): Promise<ReviewDTO> {
  const { sk, l } = await requireFinished(tx, learnerId, skillId)
  const learner = await loadLearner(tx, learnerId)
  return {
    shell: await learnerShell(tx, learner),
    skillId,
    subject: sk.subject,
    title: l.title,
    steps: coreSteps(l.steps).map((s) => ({ say: s.say, show: s.show ?? null })),
    lessonHref: `/lesson/${skillId}`,
  }
}

/** Tiga soal cepat lewat pembuat sesi pusat. XP datang dari jawaban; tidak ada quest, jadi streak tidak berubah. */
export async function startReviewQuiz(tx: Tx, ctx: OrgContext, learnerId: string, skillId: string): Promise<string> {
  const { sk, l } = await requireFinished(tx, learnerId, skillId)
  const learner = await loadLearner(tx, learnerId)
  const built = await buildQuestItems(tx, ctx, learner, {
    skillId,
    subject: sk.subject,
    mode: 'latihan',
    style: 'easy',
    date: jakartaDate(),
    seedKey: `${learnerId}:${Date.now()}:review:${skillId}`,
    length: 3,
  })
  const allowed = new Set(await guardPracticeRefs(tx, learnerId, built.map((b) => b.ref)))
  const items = built.filter((b) => allowed.has(b.ref)).map((b, i) => ({ ...b, position: i + 1 }))
  const [row] = await tx
    .insert(attempt)
    .values({ orgId: ctx.orgId, learnerId, kind: 'test', mode: 'latihan', subject: sk.subject, title: `${QUICK_REVIEW_PREFIX}${l.title}`, items })
    .returning({ id: attempt.id })
  return row!.id
}
