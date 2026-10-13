import 'server-only'
import { and, eq, like, sql } from 'drizzle-orm'
import { createRng, jakartaDate } from '@kira/core'
import { groupByArea, sessionRef, sessionSkillId, YLE_LEVELS, yleLevelOfGrade, type EnglishSessionArea } from '@kira/core/english-skills'
import { tables } from '@kira/db'
import { findContentDir } from '@kira/content/load'
import { loadSpelling, spellingId, type SpellingLevel, type SpellingLoad } from '@kira/content/spelling'
import type { EnglishCardDTO, EnglishSkillsDTO, SpellingAnswerInput, SpellingResultDTO, SpellingRoundDTO } from '@/lib/dto-english'
import type { OrgContext, Tx } from '../db'
import { invalid, notFound } from '../errors'
import { poolForSkill, skill, skillsFor } from './content'
import { grantXp, learnerShell, loadLearner, recentSeen, skillStates, type LearnerRow } from './learner-core'
import type { AttemptItem } from './learner-runner'
import { buildQuestItems } from './learner-today'

/**
 * Keterampilan English (rencana bagian 12): halaman English Skills, sesi listening, speaking, dan writing
 * yang dibuat sebagai attempt biasa (kind test, mode latihan, ref_id english:<area>) sehingga XP, kemajuan skill,
 * jawaban offline, dan antrean penilaian tutor memakai jalur yang sudah ada, dan Spelling Bee.
 */

const { attempt, xpEvent } = tables

const SESSION_LENGTH: Record<EnglishSessionArea, { count: number; minutes: number; noun: string }> = {
  listening: { count: 6, minutes: 6, noun: 'question' },
  speaking: { count: 5, minutes: 6, noun: 'question' },
  writing: { count: 2, minutes: 12, noun: 'task' },
}

const BEE_WORDS = 10
const BEE_DAILY_XP_CAP = 40
const XP_FIRST_TRY = 3
const XP_SECOND_TRY = 1

let spellingCache: SpellingLoad | null = null
function spelling(): SpellingLoad {
  spellingCache ??= loadSpelling(findContentDir())
  return spellingCache
}

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`
}

async function sessionsDone(tx: Tx, learnerId: string): Promise<Map<string, number>> {
  const rows = await tx
    .select({ ref: attempt.refId, n: sql<number>`count(*) filter (where ${attempt.submittedAt} is not null)::int` })
    .from(attempt)
    .where(and(eq(attempt.learnerId, learnerId), like(attempt.refId, 'english:%')))
    .groupBy(attempt.refId)
  return new Map(rows.map((r) => [r.ref ?? '', r.n]))
}

export async function englishSkillsDTO(tx: Tx, learnerId: string): Promise<EnglishSkillsDTO> {
  const learner = await loadLearner(tx, learnerId)
  const level = yleLevelOfGrade(learner.grade)
  const states = await skillStates(tx, learnerId)
  const groups = groupByArea(skillsFor('english', learner.grade))
  const done = await sessionsDone(tx, learnerId)
  const readingSkills = groups.reading
  const readingDone = readingSkills.filter((s) => states.get(s.id)?.gate === 'mastered').length

  const sessionCard = (area: EnglishSessionArea, title: string, blurb: string, cta: string): EnglishCardDTO => {
    const len = SESSION_LENGTH[area]
    const exists = (items: number) => Boolean(skill(sessionSkillId(learner.grade, area))) && items > 0
    const n = done.get(sessionRef(area)) ?? 0
    return {
      area,
      title,
      blurb,
      detail: `${plural(len.count, len.noun)}, about ${len.minutes} minutes`,
      progress: n > 0 ? `${plural(n, 'session')} done` : null,
      href: `/english/${area}/start`,
      cta,
      unavailable: !exists(1),
    }
  }

  const wordsForLevel = spelling().levels[level.id].length
  const cards: EnglishCardDTO[] = [
    sessionCard('listening', 'Listening', 'Listen to a short talk, then pick the right answer. Press the speaker as many times as you like.', 'Start listening'),
    sessionCard('speaking', 'Speaking test', 'An examiner asks you questions about pictures. You record your answers. Your tutor listens and gives you feedback.', 'Start the test'),
    sessionCard('writing', 'Writing', 'Write sentences about a picture and keep a short journal. Your tutor reads it and helps you improve.', 'Start writing'),
    {
      area: 'spelling',
      title: 'Spelling Bee',
      blurb: 'Hear a word and the sentence it comes from. Then spell it. Ten words in a round.',
      detail: `${BEE_WORDS} words, about 6 minutes`,
      progress: null,
      href: '/english/spelling',
      cta: 'Join the Bee',
      unavailable: wordsForLevel < BEE_WORDS,
    },
    {
      area: 'reading',
      title: 'Reading',
      blurb: 'Stories, poems and facts, with questions. Reading skills are on the map, together with your daily quests.',
      detail: `${plural(readingSkills.length, 'skill')} for your grade`,
      progress: readingSkills.length > 0 ? `${readingDone} of ${readingSkills.length} skills mastered` : null,
      href: '/map',
      cta: 'Open the map',
      unavailable: readingSkills.length === 0,
    },
  ]
  return {
    shell: await learnerShell(tx, learner),
    levelName: level.name,
    cefr: level.cefr,
    ladder: YLE_LEVELS.map((l) => ({ name: l.name, cefr: l.cefr, grades: `Grades ${l.grades[0]} and ${l.grades[1]}`, current: l.id === level.id })),
    cards,
  }
}

/** Pilih `count` soal manual (bicara atau menulis): yang belum pernah dikerjakan lebih dulu, lalu urut dari mudah. */
async function pickManualItems(tx: Tx, ctx: OrgContext, learner: LearnerRow, skillId: string, count: number): Promise<AttemptItem[]> {
  const pool = (await poolForSkill(tx, ctx.orgId, skillId, { allowManual: true })).filter((p) => p.manual)
  const seen = await recentSeen(tx, learner.userId)
  const rng = createRng(`${learner.userId}:${Date.now()}:${skillId}`)
  const fresh = rng.shuffle(pool.filter((p) => !seen.has(p.ref)))
  const old = rng.shuffle(pool.filter((p) => seen.has(p.ref))).sort((a, b) => (seen.get(b.ref) ?? 0) - (seen.get(a.ref) ?? 0))
  const chosen = [...fresh, ...old].slice(0, count).sort((a, b) => a.difficulty - b.difficulty)
  return chosen.map((c, i) => ({ ref: c.ref, section: i === 0 ? 'warmup' : 'core', position: i + 1, difficulty: c.difficulty }))
}

/** Mulai (atau lanjutkan) sesi English Skills. Mengembalikan id attempt untuk /run/<id>. */
export async function startEnglishSession(tx: Tx, ctx: OrgContext, learnerId: string, area: EnglishSessionArea): Promise<string> {
  const learner = await loadLearner(tx, learnerId)
  const skillId = sessionSkillId(learner.grade, area)
  const sk = skill(skillId)
  if (!sk) throw notFound('Belum ada soal untuk kelas ini.')
  const open = await tx
    .select({ id: attempt.id })
    .from(attempt)
    .where(and(eq(attempt.learnerId, learnerId), eq(attempt.refId, sessionRef(area)), eq(attempt.status, 'in_progress')))
    .limit(1)
  if (open[0]) return open[0].id
  const len = SESSION_LENGTH[area]
  const items =
    area === 'listening'
      ? await buildQuestItems(tx, ctx, learner, { skillId, subject: 'english', mode: 'latihan', date: jakartaDate(), seedKey: `${learnerId}:${Date.now()}:${skillId}`, length: len.count })
      : await pickManualItems(tx, ctx, learner, skillId, len.count)
  if (items.length === 0) throw invalid('No questions are ready for this skill yet.')
  const level = yleLevelOfGrade(learner.grade)
  const title = `${level.name} ${area === 'speaking' ? 'speaking test' : area}`
  const [row] = await tx
    .insert(attempt)
    .values({ orgId: ctx.orgId, learnerId, kind: 'test', refId: sessionRef(area), mode: 'latihan', subject: 'english', title, items })
    .returning({ id: attempt.id })
  return row!.id
}

async function beeXpToday(tx: Tx, learnerId: string): Promise<number> {
  const [row] = await tx
    .select({ n: sql<number>`coalesce(sum(${xpEvent.amount}), 0)::int` })
    .from(xpEvent)
    .where(and(eq(xpEvent.learnerId, learnerId), eq(xpEvent.reason, 'spelling-bee'), eq(xpEvent.date, jakartaDate())))
  return row?.n ?? 0
}

/** Satu putaran Spelling Bee: sepuluh kata acak dari tingkat Cambridge learner. */
export async function spellingRound(tx: Tx, learnerId: string): Promise<SpellingRoundDTO> {
  const learner = await loadLearner(tx, learnerId)
  const level = yleLevelOfGrade(learner.grade)
  const words = spelling().levels[level.id]
  if (words.length < BEE_WORDS) throw notFound('Belum ada daftar kata untuk tingkat ini.')
  const rng = createRng(`${learnerId}:${Date.now()}:bee`)
  const picked = rng.shuffle([...words]).slice(0, BEE_WORDS)
  return {
    shell: await learnerShell(tx, learner),
    levelName: level.name,
    words: picked.map((w) => ({ id: spellingId(level.id as SpellingLevel, w.word), word: w.word, sentence: w.sentence })),
    xpLeftToday: Math.max(0, BEE_DAILY_XP_CAP - (await beeXpToday(tx, learnerId))),
  }
}

/**
 * Nilai putaran di server: ejaan dicek ulang dari daftar kata, XP dibatasi per hari supaya putaran
 * yang diulang terus tidak menambah XP tanpa batas.
 */
export async function finishSpellingRound(tx: Tx, ctx: OrgContext, learnerId: string, answers: SpellingAnswerInput[]): Promise<SpellingResultDTO> {
  const learner = await loadLearner(tx, learnerId)
  const level = yleLevelOfGrade(learner.grade)
  const byId = new Map(spelling().levels[level.id].map((w) => [spellingId(level.id as SpellingLevel, w.word), w]))
  const seen = new Set<string>()
  let correct = 0
  let xp = 0
  for (const a of answers) {
    const word = byId.get(a.id)
    if (!word || seen.has(a.id)) continue
    seen.add(a.id)
    if (a.typed.trim().toLowerCase() === word.word.toLowerCase()) {
      correct++
      xp += a.tries === 1 ? XP_FIRST_TRY : XP_SECOND_TRY
    }
  }
  if (seen.size === 0) throw invalid('Nothing to check.')
  const left = Math.max(0, BEE_DAILY_XP_CAP - (await beeXpToday(tx, learnerId)))
  const granted = Math.min(xp, left)
  await grantXp(tx, ctx, learnerId, granted, 'spelling-bee', level.id, jakartaDate())
  return { correct, total: seen.size, xp: granted, xpLeftToday: left - granted }
}
