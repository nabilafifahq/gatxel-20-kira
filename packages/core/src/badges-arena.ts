/**
 * Lencana arena: Quick Maths, Quiz Arena, dan level jalur XP. Dievaluasi di server setiap kali ronde arena
 * selesai (lewat awardBadges). Aturan hanya membaca ArenaBadgeStats, jadi mudah diuji.
 */
import type { XpTrack } from './xp-tracks'

export type ArenaBadgeStats = {
  qmRounds: number
  /** Soal benar per menit terbaik pada sprint dengan akurasi 80 persen atau lebih (0 bila belum ada). */
  qmBestSprintPpm: number
  qmPerfectSprint: boolean
  /** Jumlah operasi (tambah, kurang, kali, bagi) yang sudah dijawab benar di ronde selesai. */
  qmOpsPlayed: number
  qmFlashCleared: number
  qmSorobanRounds: number
  qmAnzanPassed: number
  /** Tabel yang dikuasai: ronde 10 jawaban atau lebih dengan akurasi 90 persen atau lebih. */
  qmTablesMastered: number
  /** Waktu Target 20 tercepat tanpa salah, dalam detik; null bila belum ada. */
  qmTarget20Sec: number | null
  qmMissionsDone: number
  qmMissionStreak: number
  qmStrategies: number
  quizRounds: number
  quizTopicsTried: number
  quizAsiaFlagsKnown: number
  quizAsiaFlagsTotal: number
  quizFlagsKnown: number
  quizFlagsTotal: number
  quizProvincesKnown: number
  quizProvincesTotal: number
  quizPlanetsKnown: number
  quizPlanetsTotal: number
  quizCapitalsKnown: number
  quizSpeedBest: number
  quizPerfectRound: boolean
  quizTopicsTotal: number
  levels: Record<XpTrack, number>
}

export type ArenaBadgeDef = {
  id: string
  title: string
  description: string
  /** Tulisan pendek di medali. */
  glyph: string
  rule: (s: ArenaBadgeStats) => boolean
}

export const ARENA_BADGES: readonly ArenaBadgeDef[] = [
  // Quick Maths
  { id: 'qm-first', title: 'First Quick Maths round', description: 'Finish a round in Quick Maths.', glyph: 'QM', rule: (s) => s.qmRounds >= 1 },
  { id: 'qm-rounds-50', title: '50 Quick Maths rounds', description: 'Finish 50 rounds in Quick Maths.', glyph: '50', rule: (s) => s.qmRounds >= 50 },
  { id: 'qm-ppm-20', title: '20 a minute', description: 'Get 20 right in one minute in a sprint.', glyph: '20', rule: (s) => s.qmBestSprintPpm >= 20 },
  { id: 'qm-ppm-40', title: '40 a minute', description: 'Get 40 right in one minute in a sprint.', glyph: '40', rule: (s) => s.qmBestSprintPpm >= 40 },
  { id: 'qm-ppm-60', title: '60 a minute', description: 'Get 60 right in one minute in a sprint.', glyph: '60', rule: (s) => s.qmBestSprintPpm >= 60 },
  { id: 'qm-sprint-perfect', title: 'Perfect sprint', description: 'Finish a sprint with 15 or more answers and none wrong.', glyph: '100%', rule: (s) => s.qmPerfectSprint },
  { id: 'qm-all-ops', title: 'All four operations', description: 'Get answers right in adding, taking away, times and sharing.', glyph: '4', rule: (s) => s.qmOpsPlayed >= 4 },
  { id: 'qm-target-90', title: 'Target 20 in 90', description: 'Answer all 20 right in under 90 seconds.', glyph: '90 s', rule: (s) => s.qmTarget20Sec !== null && s.qmTarget20Sec <= 90 },
  { id: 'qm-tables-5', title: 'Five times tables', description: 'Master five times tables with a round of 90 percent or better.', glyph: '5 ×', rule: (s) => s.qmTablesMastered >= 5 },
  { id: 'qm-tables-all', title: 'Every times table', description: 'Master the 2 to 10 times tables.', glyph: '2-10', rule: (s) => s.qmTablesMastered >= 9 },
  { id: 'qm-flash-5', title: 'Flash Anzan level 5', description: 'Clear level 5 in Flash Anzan.', glyph: 'L5', rule: (s) => s.qmFlashCleared >= 5 },
  { id: 'qm-soroban', title: 'Bead reader', description: 'Finish a round of reading the soroban.', glyph: 'SO', rule: (s) => s.qmSorobanRounds >= 1 },
  { id: 'qm-anzan', title: 'Soroban in my head', description: 'Pass a round of soroban in your head.', glyph: 'AZ', rule: (s) => s.qmAnzanPassed >= 1 },
  { id: 'qm-strategies', title: 'Seven strategies', description: 'Finish all seven strategy lessons.', glyph: '7', rule: (s) => s.qmStrategies >= 7 },
  { id: 'qm-mission-1', title: 'Daily mission', description: 'Finish a daily mission.', glyph: '5 m', rule: (s) => s.qmMissionsDone >= 1 },
  { id: 'qm-mission-7', title: 'Seven missions in a row', description: 'Finish the daily mission seven days in a row.', glyph: '7', rule: (s) => s.qmMissionStreak >= 7 },
  // Quiz Arena
  { id: 'quiz-first', title: 'First quiz', description: 'Finish a round in Quiz Arena.', glyph: 'Q', rule: (s) => s.quizRounds >= 1 },
  { id: 'quiz-rounds-50', title: '50 quiz rounds', description: 'Finish 50 rounds in Quiz Arena.', glyph: '50', rule: (s) => s.quizRounds >= 50 },
  { id: 'quiz-topics-all', title: 'Every topic', description: 'Try every topic in Quiz Arena.', glyph: '12', rule: (s) => s.quizTopicsTotal > 0 && s.quizTopicsTried >= s.quizTopicsTotal },
  { id: 'quiz-flags-asia', title: 'All the flags of Asia', description: 'Know every flag in Asia.', glyph: 'AS', rule: (s) => s.quizAsiaFlagsTotal > 0 && s.quizAsiaFlagsKnown >= s.quizAsiaFlagsTotal },
  { id: 'quiz-flags-world', title: 'All the flags', description: 'Know every flag in Quiz Arena.', glyph: 'ALL', rule: (s) => s.quizFlagsTotal > 0 && s.quizFlagsKnown >= s.quizFlagsTotal },
  { id: 'quiz-provinces', title: '38 provinces', description: 'Know all the provinces of Indonesia and their capitals.', glyph: '38', rule: (s) => s.quizProvincesTotal > 0 && s.quizProvincesKnown >= s.quizProvincesTotal },
  { id: 'quiz-planets', title: '8 planets', description: 'Know all eight planets.', glyph: '8', rule: (s) => s.quizPlanetsTotal > 0 && s.quizPlanetsKnown >= s.quizPlanetsTotal },
  { id: 'quiz-capitals-50', title: '50 capital cities', description: 'Know 50 capital cities.', glyph: '50', rule: (s) => s.quizCapitalsKnown >= 50 },
  { id: 'quiz-speed-20', title: 'Quick thinker', description: 'Get 20 right in one speed quiz.', glyph: '20', rule: (s) => s.quizSpeedBest >= 20 },
  { id: 'quiz-perfect', title: 'Perfect quiz', description: 'Finish a quiz round of 10 or more with none wrong.', glyph: '100%', rule: (s) => s.quizPerfectRound },
  // Level
  { id: 'lvl-qm-5', title: 'Quick Maths level 5', description: 'Reach Quick Maths level 5.', glyph: 'L5', rule: (s) => s.levels.hitung >= 5 },
  { id: 'lvl-quiz-5', title: 'Quiz level 5', description: 'Reach Quiz level 5.', glyph: 'L5', rule: (s) => s.levels.pengetahuan >= 5 },
  { id: 'lvl-all-5', title: 'All-rounder', description: 'Reach level 5 in Learning, Quick Maths and Quiz.', glyph: 'x3', rule: (s) => s.levels.belajar >= 5 && s.levels.hitung >= 5 && s.levels.pengetahuan >= 5 },
] as const

export function earnedArenaBadges(stats: ArenaBadgeStats, alreadyHave: ReadonlySet<string>): ArenaBadgeDef[] {
  return ARENA_BADGES.filter((b) => !alreadyHave.has(b.id) && b.rule(stats))
}

export function arenaBadgeById(id: string): ArenaBadgeDef | undefined {
  return ARENA_BADGES.find((b) => b.id === id)
}

export function emptyArenaBadgeStats(): ArenaBadgeStats {
  return {
    qmRounds: 0,
    qmBestSprintPpm: 0,
    qmPerfectSprint: false,
    qmOpsPlayed: 0,
    qmFlashCleared: 0,
    qmSorobanRounds: 0,
    qmAnzanPassed: 0,
    qmTablesMastered: 0,
    qmTarget20Sec: null,
    qmMissionsDone: 0,
    qmMissionStreak: 0,
    qmStrategies: 0,
    quizRounds: 0,
    quizTopicsTried: 0,
    quizAsiaFlagsKnown: 0,
    quizAsiaFlagsTotal: 0,
    quizFlagsKnown: 0,
    quizFlagsTotal: 0,
    quizProvincesKnown: 0,
    quizProvincesTotal: 0,
    quizPlanetsKnown: 0,
    quizPlanetsTotal: 0,
    quizCapitalsKnown: 0,
    quizSpeedBest: 0,
    quizPerfectRound: false,
    quizTopicsTotal: 0,
    levels: { belajar: 1, hitung: 1, pengetahuan: 1 },
  }
}
