import 'server-only'
import { and, eq, gte, lte, sql } from 'drizzle-orm'
import { addDays, jakartaDate, weekStart as mondayOf, type IsoDate } from '@kira/core'
import { loadCoachActivities, pickActivity, STRAND_PLAIN, type CoachActivity } from '@kira/content/coach'
import { findContentDir } from '@kira/content/load'
import { tables } from '@kira/db'
import type { Subject } from '@/lib/dto'
import type { CoachActivityDTO, CoachChild, CoachDTO, CoachPageDTO, CoachWeakDTO } from '@/lib/dto-coach'
import type { Actor } from '../auth/actor'
import { withFamilyAdmin } from '../auth/parent'
import type { Tx } from '../db'
import { log } from '../log'
import { accuracyLine, dataNote, dataState, isSolid, praiseSentence, qualified, selectStrength, selectWeak, type SkillSnapshot } from './coach-logic'
import { SUBJECT_ID_LABEL, SUBJECT_ORDER, weekLabelId } from './console-common'
import { skill } from './content'
import { visibleLearners } from './console-shell'
import { loadLearner } from './learner-core'

/**
 * Pelatih Orang Tua, bagian mingguan. Semua dari data nyata skill_state dan pustaka kegiatan di content/coach/.
 * Tanpa AI: skill dipilih dengan aturan di coach-logic.ts, kegiatan dipilih dari pustaka dan berganti tiap minggu.
 */

const { skillState, dayRecord } = tables

const g = globalThis as unknown as { __kiraCoach?: CoachActivity[] }

export function coachActivities(): CoachActivity[] {
  if (g.__kiraCoach) return g.__kiraCoach
  const { activities, errors } = loadCoachActivities(findContentDir())
  if (errors.length > 0) log.error('pustaka kegiatan pelatih punya error', { count: errors.length, first: errors.slice(0, 3) })
  g.__kiraCoach = activities
  return activities
}

function activityDTO(a: CoachActivity): CoachActivityDTO {
  return { id: a.id, title: a.title, minutes: 10, materials: a.materials, steps: a.steps, ask: a.ask, easier: a.easier }
}

/** Nomor minggu sejak 1970, untuk memutar pilihan kegiatan tiap minggu secara deterministik. */
function weekIndex(monday: IsoDate): number {
  return Math.floor(Date.parse(`${monday}T00:00:00Z`) / (7 * 24 * 3600 * 1000))
}

export async function skillSnapshots(tx: Tx, learnerId: string): Promise<SkillSnapshot[]> {
  const rows = await tx
    .select({ skillId: skillState.skillId, stars: skillState.stars, gate: skillState.gate, n: skillState.nAnswers, recent: skillState.recent })
    .from(skillState)
    .where(eq(skillState.learnerId, learnerId))
  const out: SkillSnapshot[] = []
  for (const r of rows) {
    const s = skill(r.skillId)
    if (!s) continue
    const recent = r.recent ?? []
    out.push({
      skillId: s.id,
      subject: s.subject,
      grade: s.grade,
      strand: s.strand,
      title: s.titleId || s.title,
      stars: r.stars,
      gate: r.gate,
      answers: r.n,
      accuracy: recent.length > 0 ? recent.reduce((a, b) => a + b, 0) / recent.length : null,
    })
  }
  return out
}

/** Kegiatan mingguan untuk satu anak. `monday` menentukan rotasi kegiatan dan label minggu. */
export async function coachFor(tx: Tx, learnerId: string, monday: IsoDate): Promise<CoachDTO> {
  const learner = await loadLearner(tx, learnerId)
  const snaps = await skillSnapshots(tx, learnerId)
  const all = coachActivities()
  const rot = weekIndex(monday)

  const weakSnaps = selectWeak(snaps)
  const used = new Set<string>()
  const weak: CoachWeakDTO[] = weakSnaps.map((s, i) => {
    const picked = pickActivity(all, { subject: s.subject, strand: s.strand, grade: learner.grade }, used, rot + i)
    if (picked) used.add(picked.id)
    return {
      skillId: s.skillId,
      subject: s.subject,
      subjectLabel: SUBJECT_ID_LABEL[s.subject],
      title: s.title,
      plain: STRAND_PLAIN[s.strand] ?? 'Skill ini melatih satu bagian dari pelajaran di kelas.',
      accuracyLine: accuracyLine(s),
      solid: isSolid(s),
      activity: picked ? activityDTO(picked) : null,
    }
  })

  const strengthSnap = selectStrength(snaps, weakSnaps)
  const minutes =
    (
      await tx
        .select({ m: sql<number>`coalesce(sum(${dayRecord.minutes}), 0)::int` })
        .from(dayRecord)
        .where(and(eq(dayRecord.learnerId, learnerId), gte(dayRecord.date, monday), lte(dayRecord.date, addDays(monday, 6))))
    )[0]?.m ?? 0

  const state = dataState(snaps)
  let starter: CoachDTO['starter'] = null
  if (state === 'empty') {
    const subject = SUBJECT_ORDER[rot % SUBJECT_ORDER.length]!
    const a = pickActivity(all, { subject, strand: 'Oly', grade: learner.grade }, new Set(), rot)
    if (a) starter = { ...activityDTO(a), subjectLabel: SUBJECT_ID_LABEL[subject] }
  }

  return {
    learnerId,
    name: learner.name,
    grade: learner.grade,
    weekLabel: weekLabelId(monday),
    state,
    note: dataNote(state, qualified(snaps).length),
    weak,
    starter,
    strength: strengthSnap
      ? {
          title: strengthSnap.title,
          subjectLabel: SUBJECT_ID_LABEL[strengthSnap.subject],
          line: `${strengthSnap.stars} bintang, ${accuracyLine(strengthSnap).replace(/^S/, 's')}`,
        }
      : null,
    praise: praiseSentence(learner.name, strengthSnap, `${learnerId}:${monday}`, minutes > 0),
    minutesThisWeek: minutes,
  }
}

/** Anak yang tertaut ke orang tua ini, diurutkan menurut nama. */
export async function linkedChildren(tx: Tx): Promise<CoachChild[]> {
  return (await visibleLearners(tx)).map((l) => ({ id: l.id, name: l.name, grade: l.grade }))
}

export function chooseChild(children: readonly CoachChild[], param: string | null): CoachChild | null {
  return children.find((c) => c.id === param) ?? children[0] ?? null
}

export async function parentCoachDTO(actor: Actor, learnerParam: string | null, today: IsoDate = jakartaDate()): Promise<CoachPageDTO> {
  return withFamilyAdmin(actor, async (tx, scope) => {
    const children = await linkedChildren(tx)
    const child = chooseChild(children, learnerParam)
    if (!child) return { children, selectedId: null, coach: null }
    await scope.assertParentOf(child.id)
    return { children, selectedId: child.id, coach: await coachFor(tx, child.id, mondayOf(today)) }
  })
}

export type { Subject }
