/**
 * Lencana untuk usaha dan kebiasaan, bukan hanya nilai.
 * Aturan dievaluasi di server setiap kali quest, review, atau tes selesai.
 */

export type BadgeStats = {
  questsDone: number
  perfectQuests: number
  answersTotal: number
  currentStreak: number
  bestStreak: number
  masteredSkills: number
  reviewSessions: number
  simulationsDone: number
  olympiadPapersDone: number
  lessonsDone: number
  subjectsToday: number
  hintsUsedThenCorrect: number
  esmoPackagesDone: number
  speakingDone: number
  writingDone: number
}

export type BadgeDef = {
  id: string
  title: string
  description: string
  rule: (s: BadgeStats) => boolean
}

export const BADGES: readonly BadgeDef[] = [
  { id: 'first-quest', title: 'First quest', description: 'You finished your first quest.', rule: (s) => s.questsDone >= 1 },
  { id: 'three-subjects', title: 'All three today', description: 'Math, English and Science in one day.', rule: (s) => s.subjectsToday >= 3 },
  { id: 'streak-3', title: 'Three days in a row', description: 'Quests done three days in a row.', rule: (s) => s.bestStreak >= 3 },
  { id: 'streak-7', title: 'A full week', description: 'Quests done seven days in a row.', rule: (s) => s.bestStreak >= 7 },
  { id: 'streak-30', title: 'Thirty days', description: 'Quests done thirty days in a row.', rule: (s) => s.bestStreak >= 30 },
  { id: 'perfect-quest', title: 'Every one right', description: 'A quest with every answer right first time.', rule: (s) => s.perfectQuests >= 1 },
  { id: 'hint-helper', title: 'Used a hint well', description: 'You opened a hint and then got it right.', rule: (s) => s.hintsUsedThenCorrect >= 1 },
  { id: 'answers-100', title: '100 answers', description: 'You answered 100 questions.', rule: (s) => s.answersTotal >= 100 },
  { id: 'answers-500', title: '500 answers', description: 'You answered 500 questions.', rule: (s) => s.answersTotal >= 500 },
  { id: 'answers-1000', title: '1,000 answers', description: 'You answered 1,000 questions.', rule: (s) => s.answersTotal >= 1000 },
  { id: 'first-mastered', title: 'First skill mastered', description: 'Three stars on one skill.', rule: (s) => s.masteredSkills >= 1 },
  { id: 'mastered-10', title: 'Ten skills mastered', description: 'Three stars on ten skills.', rule: (s) => s.masteredSkills >= 10 },
  { id: 'first-review', title: 'Fixed my mistakes', description: 'You finished a review session.', rule: (s) => s.reviewSessions >= 1 },
  { id: 'review-10', title: 'Review habit', description: 'Ten review sessions done.', rule: (s) => s.reviewSessions >= 10 },
  { id: 'first-olympiad', title: 'First Olympiad paper', description: 'You finished an Olympiad paper.', rule: (s) => s.olympiadPapersDone >= 1 },
  { id: 'first-simulation', title: 'Competition practice', description: 'You finished a full competition practice.', rule: (s) => s.simulationsDone >= 1 },
  { id: 'esmo-5', title: 'Five ESMO packs', description: 'Five ESMO practice packs done.', rule: (s) => s.esmoPackagesDone >= 5 },
  { id: 'first-lesson', title: 'Watched a lesson', description: 'You finished a lesson.', rule: (s) => s.lessonsDone >= 1 },
  { id: 'first-speaking', title: 'Brave voice', description: 'You recorded a speaking answer.', rule: (s) => s.speakingDone >= 1 },
  { id: 'first-writing', title: 'Writer', description: 'You sent a piece of writing.', rule: (s) => s.writingDone >= 1 },
] as const

export function earnedBadges(stats: BadgeStats, alreadyHave: ReadonlySet<string>): BadgeDef[] {
  return BADGES.filter((b) => !alreadyHave.has(b.id) && b.rule(stats))
}

export function badgeById(id: string): BadgeDef | undefined {
  return BADGES.find((b) => b.id === id)
}
