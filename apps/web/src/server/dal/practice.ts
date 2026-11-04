import 'server-only'
import { z } from 'zod'
import { jakartaDate } from '@kira/core'
import { effectiveOn, type FeatureKey, type FeatureMap } from '@kira/core/features'
import { tables } from '@kira/db'
import { classifyStyle, QUESTION_STYLES, type QuestionStyle } from '@kira/content/style'
import { generateItem, isGenRef } from '@kira/content/math'
import type { Subject } from '@/lib/dto'
import type { Dict } from '@/lib/i18n'
import { getT } from '@/lib/i18n/server'
import type { OrgContext, Tx } from '../db'
import { invalid } from '../errors'
import { content, skillsFor, strandName, type PoolCandidate } from './content'
import { featureMapFor } from './learner-features'
import { learnerShell, loadLearner } from './learner-core'
import { buildQuestItems } from './learner-session'
import { guardPracticeRefs } from './practice-guard'

const { attempt } = tables

/**
 * Latihan Bebas: anak memilih apa yang mau dilatih. Sesi dibuat oleh pembuat sesi pusat (buildQuestItems) dengan
 * aturan tanpa soal ganda yang sama. Tidak ada quest di baliknya, jadi tidak mengubah streak; XP datang dari jawaban.
 */

export const PRACTICE_COUNTS = [5, 8, 10, 15] as const
const SECONDS_PER_QUESTION = 45
const MIN_ITEMS = 3

export type PracticeTile = {
  id: string
  title: string
  sub: string
  /** Alamat dasar. Tile latihan memakai /practice/start dengan opsi anak ditambahkan di layar. */
  href: string
  /** Tile latihan membawa pilihan gaya dan jumlah soal; tile tautan tidak. */
  drill: boolean
}
export type PracticeSection = { id: string; title: string; hint: string; tiles: PracticeTile[] }
export type PracticeDTO = {
  shell: Awaited<ReturnType<typeof learnerShell>>
  /** Fitur yang dimatikan orang tua dan baru saja dicoba anak (dari ?off=). */
  offNote: string | null
  sections: PracticeSection[]
  styles: { id: QuestionStyle; label: string }[]
  counts: readonly number[]
}

const OFF_LABEL: Partial<Record<FeatureKey, keyof Dict['lessons']['practice']['offLabel']>> = {
  'quiz-arena': 'quizArena',
  'mental-math': 'quickMaths',
  'english-skills': 'englishSkills',
  'olympiad-math': 'competitions',
  'olympiad-english': 'competitions',
  'olympiad-science': 'competitions',
}


const sentenceCase = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

/** Skill yang dipakai untuk satu topik (strand) di mapel dan kelas anak. Skill menulis dan bicara dilewati. */
function strandSkills(subject: Subject, grade: number, strand: string): string[] {
  return skillsFor(subject, grade)
    .filter((s) => s.strand === strand && !['Wc', 'SL', 'Wp'].includes(s.strand))
    .map((s) => s.id)
}

function strandsOf(subject: Subject, grade: number, filter: (strand: string) => boolean): { strand: string; skills: number }[] {
  const out = new Map<string, number>()
  for (const s of skillsFor(subject, grade)) {
    if (['Wc', 'SL', 'Wp'].includes(s.strand) || !filter(s.strand)) continue
    out.set(s.strand, (out.get(s.strand) ?? 0) + 1)
  }
  return [...out.entries()].map(([strand, skills]) => ({ strand, skills }))
}

function contestsFor(subject: Subject, grade: number): { id: string; name: string; count: number }[] {
  const idx = content()
  const counts = new Map<string, number>()
  for (const item of idx.items.values()) {
    if (!item.skill.startsWith(subject[0]!) || item.skill.charAt(1) !== String(grade)) continue
    for (const t of item.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
  }
  return idx.competitions
    .filter((c) => c.subjects.includes(subject))
    .map((c) => ({ id: c.id, name: c.name.replace(/\s*\(.*\)\s*$/, ''), count: counts.get(c.id) ?? 0 }))
    .filter((c) => c.count >= MIN_ITEMS)
}

const link = (id: string, title: string, sub: string, href: string): PracticeTile => ({ id, title, sub, href, drill: false })
const drill = (id: string, title: string, sub: string, query: string): PracticeTile => ({ id, title, sub, href: `/practice/start?${query}`, drill: true })

export function buildSections(grade: number, features: FeatureMap, dict: Dict): PracticeSection[] {
  const copy = dict.lessons.practice
  const on = (k: FeatureKey) => effectiveOn(features, k)
  const sections: PracticeSection[] = []

  if (on('drill-math')) {
    const tiles = strandsOf('math', grade, (s) => s !== 'Oly').map((t) => drill(`m-${t.strand}`, strandName(t.strand), copy.topicCount(t.skills), `subject=math&strand=${t.strand}`))
    if (tiles.length) sections.push({ id: 'math', title: copy.mathTitle, hint: copy.mathHint, tiles })
  }
  if (on('mental-math')) {
    sections.push({ id: 'mental', title: copy.mentalTitle, hint: copy.mentalHint, tiles: [link('quick', copy.quickMaths, copy.quickMathsSub, '/quick-maths')] })
  }

  const oly: PracticeTile[] = []
  for (const subject of ['math', 'english', 'science'] as const) {
    if (!on(`olympiad-${subject}` as FeatureKey)) continue
    const label = dict.common.subject[subject]
    const skills = strandSkills(subject, grade, 'Oly')
    if (skills.length) oly.push(drill(`oly-${subject}`, copy.subjectOlympiad(label), copy.byTopic, `subject=${subject}&strand=Oly`))
    for (const c of contestsFor(subject, grade)) oly.push(drill(`contest-${subject}-${c.id}`, `${label}: ${c.name}`, copy.contestSub(c.count), `subject=${subject}&contest=${c.id}`))
  }
  if (oly.length) sections.push({ id: 'olympiad', title: copy.olympiadTitle, hint: copy.olympiadHint, tiles: oly })

  const sci = on('science') ? strandsOf('science', grade, () => true).map((t) => drill(`s-${t.strand}`, strandName(t.strand), copy.scienceSub, `subject=science&strand=${t.strand}`)) : []
  if (sci.length) sections.push({ id: 'science', title: copy.scienceTitle, hint: copy.scienceHint, tiles: sci })

  const en: PracticeTile[] = []
  if (on('reading-room')) {
    for (const t of strandsOf('english', grade, (s) => s.startsWith('R'))) en.push(drill(`e-${t.strand}`, sentenceCase(strandName(t.strand).replace(/^Reading: /, '')), copy.readingSub, `subject=english&strand=${t.strand}`))
  }
  if (on('english')) {
    for (const t of strandsOf('english', grade, (s) => !s.startsWith('R') && s !== 'Oly')) en.push(drill(`e-${t.strand}`, sentenceCase(strandName(t.strand).replace(/^Writing: /, '')), copy.englishSub, `subject=english&strand=${t.strand}`))
  }
  if (en.length) sections.push({ id: 'english', title: copy.englishTitle, hint: copy.englishHint, tiles: en })

  const cards: PracticeTile[] = []
  if (on('vocab')) cards.push(link('vocab', copy.vocab, copy.vocabSub, '/practice/cards?mode=vocab'))
  if (on('flashcards')) cards.push(link('cards', copy.flashcards, copy.flashcardsSub, '/practice/cards'))
  if (cards.length) sections.push({ id: 'cards', title: copy.cardsTitle, hint: copy.cardsHint, tiles: cards })

  sections.push({ id: 'review', title: copy.reviewTitle, hint: copy.reviewHint, tiles: [link('review', copy.reviewTile, copy.reviewSub, '/practice/review')] })
  return sections
}

export async function practiceDTO(tx: Tx, learnerId: string, off: string | null): Promise<PracticeDTO> {
  const learner = await loadLearner(tx, learnerId)
  const features = await featureMapFor(tx, learnerId)
  const dict = await getT()
  const offKey = off && off in OFF_LABEL ? OFF_LABEL[off as FeatureKey] : undefined
  return {
    shell: await learnerShell(tx, learner),
    offNote: offKey ? dict.lessons.practice.offLabel[offKey] : null,
    sections: buildSections(learner.grade, features, dict),
    styles: QUESTION_STYLES.map((id) => ({ id, label: dict.lessons.practice.styles[id] })),
    counts: PRACTICE_COUNTS,
  }
}

// ---------------------------------------------------------------------------
// Memulai sesi

export const startSchema = z
  .object({
    subject: z.enum(['math', 'english', 'science']),
    strand: z.string().regex(/^[A-Za-z]{1,3}$/).optional(),
    contest: z.string().regex(/^[a-z0-9-]{1,30}$/).optional(),
    style: z.enum(QUESTION_STYLES).default('mixed'),
    n: z.coerce.number().int().refine((v) => (PRACTICE_COUNTS as readonly number[]).includes(v)).default(10),
    timed: z.enum(['0', '1']).default('0'),
  })
  .strict()
  .refine((v) => Boolean(v.strand) !== Boolean(v.contest), 'Pilih topik atau gaya lomba.')
export type StartInput = z.infer<typeof startSchema>

const genStyleCache = new Map<string, QuestionStyle>()

/** Gaya sebuah kandidat. Soal generator digolongkan dari contoh soalnya; soal org hanya cocok dengan Mixed. */
function styleOf(ref: string): QuestionStyle | null {
  if (isGenRef(ref)) {
    const key = ref
    let s = genStyleCache.get(key)
    if (!s) {
      try {
        s = classifyStyle(generateItem(ref))
      } catch {
        return null
      }
      genStyleCache.set(key, s)
    }
    return s
  }
  const item = content().items.get(ref)
  return item ? classifyStyle(item) : null
}

const FEATURE_FOR: Record<Subject, FeatureKey> = { math: 'drill-math', english: 'english', science: 'science' }

/** Apakah fitur yang dibutuhkan pilihan ini menyala. Olimpiade memakai saklar olimpiade mapelnya. */
export function startAllowed(features: FeatureMap, input: StartInput): boolean {
  if (input.strand === 'Oly' || input.contest) return effectiveOn(features, `olympiad-${input.subject}` as FeatureKey)
  if (input.subject === 'english' && input.strand?.startsWith('R')) return effectiveOn(features, 'reading-room')
  return effectiveOn(features, FEATURE_FOR[input.subject])
}

/** Buat sesi Latihan Bebas dan kembalikan id attempt, atau alasan ramah bila belum cukup soal. */
export async function startFreePractice(tx: Tx, ctx: OrgContext, learnerId: string, raw: unknown): Promise<{ id: string } | { reason: 'off' | 'few' }> {
  const parsed = startSchema.safeParse(raw)
  if (!parsed.success) throw invalid('Pilihan latihan tidak dikenal.')
  const input = parsed.data
  const learner = await loadLearner(tx, learnerId)
  const features = await featureMapFor(tx, learnerId)
  if (!startAllowed(features, input)) return { reason: 'off' }

  let skills: string[]
  let title: string
  if (input.contest) {
    const prefix = `${input.subject[0]}${learner.grade}.`
    const ids = new Set<string>()
    for (const item of content().items.values()) if (item.skill.startsWith(prefix) && item.tags.includes(input.contest)) ids.add(item.skill)
    skills = [...ids]
    title = (await getT()).lessons.practice.contestTitle(input.contest.toUpperCase())
  } else {
    skills = strandSkills(input.subject, learner.grade, input.strand!)
    title = skills.length ? strandName(input.strand!) : 'Practice'
  }
  if (skills.length === 0) return { reason: 'few' }

  const accept = (c: PoolCandidate): boolean => {
    if (input.contest) {
      const item = content().items.get(c.ref)
      if (!item || !item.tags.includes(input.contest)) return false
    }
    if (input.style === 'mixed') return true
    return styleOf(c.ref) === input.style
  }

  const built = await buildQuestItems(tx, ctx, learner, {
    skillId: skills[0]!,
    extraSkills: skills.slice(1),
    subject: input.subject,
    mode: 'latihan',
    style: 'easy',
    date: jakartaDate(),
    seedKey: `${learnerId}:${Date.now()}:free:${input.subject}:${input.strand ?? input.contest}:${input.style}`,
    length: input.n,
    accept,
  })
  const allowed = new Set(await guardPracticeRefs(tx, learnerId, built.map((b) => b.ref)))
  const items = built.filter((b) => allowed.has(b.ref)).map((b, i) => ({ ...b, position: i + 1 }))
  if (items.length < MIN_ITEMS) return { reason: 'few' }
  const timeLimitS = input.timed === '1' ? items.length * SECONDS_PER_QUESTION : null
  const [row] = await tx
    .insert(attempt)
    .values({ orgId: ctx.orgId, learnerId, kind: 'test', mode: 'latihan', subject: input.subject, title, items, ...(timeLimitS ? { timeLimitS } : {}) })
    .returning({ id: attempt.id })
  return { id: row!.id }
}
