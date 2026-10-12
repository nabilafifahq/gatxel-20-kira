// __GTX_SEED__
// Data contoh layar learner untuk halaman pratinjau /dev/screens. Nama, tanggal, dan
// skor buatan; tidak memakai data anak sungguhan dan tidak pernah masuk database produksi.

import { answerText } from '@kira/content/check'
import { itemSchema, type ItemInput } from '@kira/content/schema'
import type {
  CompetitionIntroDTO,
  CompetitionPickDTO,
  CorrectionBookDTO,
  DayStatus,
  DoneTodayDTO,
  EsmoDTO,
  LearnerShell,
  LessonDTO,
  MapDTO,
  MapSkillDTO,
  MeDTO,
  PickLearnerDTO,
  PinScreenDTO,
  QuestIntroDTO,
  QuestStopDTO,
  ResultsDTO,
  ReviewDTO,
  ReviewQuestionDTO,
  RunnerDTO,
  RunnerItem,
  SavedResponse,
  SegmentState,
  StreakDTO,
  TodayDTO,
} from '@/lib/dto'
import {
  E_PAST_TEXT,
  E_SPEAK,
  E_WRITE,
  M_ARRAY_KEYPAD,
  M_GROUPS_PICTURES,
  M_MATCH_ARRAYS,
  M_ORDER_FIVES,
  M_PATTERN_MCQ,
  M_SPLIT_NUMERIC,
  S_DRAW,
  allWidgetItems,
  asRunner,
  englishTestItems,
  esmoItems,
  make,
  sprintItems,
} from './learner-items'

export const SEED_MARK = '__GTX_SEED__'

// ---------------------------------------------------------------------------
// Umum

export const SHELL: LearnerShell = {
  learnerId: 'seed-learner-nadia',
  name: 'Nadia',
  avatar: 'fox',
  grade: 2,
  jenjang: '1-2',
  showReview: true,
  dueReviewCount: 6,
}

const SHELL_NO_REVIEW: LearnerShell = { ...SHELL, showReview: false, dueReviewCount: 0 }

const WEEK_DATES = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']
const SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function week(statuses: DayStatus[], todayIndex: number): StreakDTO['week'] {
  return statuses.map((status, i) => ({
    date: WEEK_DATES[i] ?? '2026-10-05',
    label: i === todayIndex ? 'Today' : (SHORT[i] ?? ''),
    longLabel: LONG[i] ?? '',
    status,
    isToday: i === todayIndex,
  }))
}

export const STREAK: StreakDTO = {
  current: 12,
  freezes: 1,
  week: week(['complete', 'complete', 'complete', 'complete', 'partial', 'upcoming', 'rest'], 4),
  weekDone: 4,
}

const STREAK_FIRST: StreakDTO = {
  current: 0,
  freezes: 0,
  week: week(['today', 'upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming', 'rest'], 0),
  weekDone: 0,
}

const STREAK_ALL: StreakDTO = {
  current: 13,
  freezes: 1,
  week: week(['complete', 'complete', 'complete', 'complete', 'complete', 'upcoming', 'rest'], 4),
  weekDone: 5,
}

const STREAK_REST: StreakDTO = {
  current: 14,
  freezes: 1,
  week: week(['complete', 'freeze', 'complete', 'complete', 'complete', 'complete', 'rest'], 6),
  weekDone: 6,
}

// ---------------------------------------------------------------------------
// L18 Pilih learner dan L01 Masuk anak

export function pickLearnerFixture(state: string): PickLearnerDTO {
  return {
    deviceName: 'Tablet ruang belajar',
    learners: [
      { id: 'seed-learner-nadia', name: 'Nadia', avatar: 'fox', grade: 2, doneToday: false, locked: false },
      { id: 'seed-learner-bima', name: 'Bima', avatar: 'owl', grade: 4, doneToday: state === 'limit', locked: state === 'locked' },
    ],
  }
}

export function pinFixture(state: string): PinScreenDTO {
  return {
    learnerId: 'seed-learner-nadia',
    name: 'Nadia',
    avatar: 'fox',
    pictures: ['sun', 'moon', 'star', 'cat', 'fish', 'tree', 'apple', 'boat', 'ball'],
    lockedUntil: state === 'locked' ? new Date(Date.now() + (14 * 60 + 52) * 1000).toISOString() : null,
    attemptsLeft: state === 'wrong' ? 2 : state === 'locked' ? 0 : 3,
  }
}

/** PIN pratinjau: kucing, bintang, apel, perahu. */
export const DEV_PIN = ['cat', 'star', 'apple', 'boat'] as const

// ---------------------------------------------------------------------------
// L02 Today

function segs(answered: ('c' | 'n' | 'a')[], total: number): SegmentState[] {
  return Array.from({ length: total }, (_, i) => {
    const a = answered[i]
    if (a === 'c') return 'correct'
    if (a === 'n') return 'not-yet'
    if (a === 'a') return 'answered'
    return i === answered.length ? 'current' : 'todo'
  })
}

function stop(p: Partial<QuestStopDTO> & Pick<QuestStopDTO, 'subject' | 'state' | 'title' | 'meta'>): QuestStopDTO {
  return {
    questId: p.state === 'rest' ? null : `seed-quest-${p.subject}`,
    total: 10,
    answered: 0,
    segments: segs([], 10),
    href: p.state === 'locked' || p.state === 'rest' ? null : `/dev/screens/quest-intro?subject=${p.subject}`,
    ctaLabel: 'Start',
    offlineReady: false,
    ...p,
  }
}

const READY_META = '10 questions, about 15 minutes'

export function todayFixture(state: string): TodayDTO {
  const base = {
    shell: SHELL,
    dateLabel: 'Friday 9 October',
    headline: "Friday's quests",
    nextCompetition: { name: 'KMNR', daysToGo: 41 },
    esmo: { href: '/dev/screens/esmo', label: 'ESMO 4 final practice' },
    minutesToday: 18,
    screenLimitMin: 60,
  }
  const bonusLocked = stop({ subject: 'bonus', state: 'locked', title: 'Mixed review', meta: 'Opens after all three', total: 5 })
  switch (state) {
    case 'first-day':
      return {
        ...base,
        headline: 'Welcome to Kira',
        subline: 'Monday. Your first quests are ready.',
        variant: 'first-day',
        streak: STREAK_FIRST,
        stops: [
          stop({ subject: 'math', state: 'ready', title: 'Arrays and skip counting', meta: READY_META, offlineReady: true }),
          stop({ subject: 'english', state: 'ready', title: 'Past tense with -ed', meta: READY_META }),
          stop({ subject: 'science', state: 'ready', title: 'Living things and their habitats', meta: READY_META }),
        ],
        activeIndex: 0,
        bonus: bonusLocked,
        nextCompetition: { name: 'KMNR', daysToGo: 45 },
        minutesToday: 0,
      }
    case 'one-done':
      return {
        ...base,
        subline: 'Friday. Math is done, English is next.',
        variant: 'normal',
        streak: STREAK,
        stops: [
          stop({ subject: 'math', state: 'done', title: 'Arrays and skip counting', meta: 'Done, 9 of 10 correct', answered: 10, ctaLabel: 'See answers' }),
          stop({ subject: 'english', state: 'ready', title: 'Past tense with -ed', meta: READY_META, offlineReady: true }),
          stop({ subject: 'science', state: 'ready', title: 'Living things and their habitats', meta: READY_META }),
        ],
        activeIndex: 1,
        bonus: bonusLocked,
      }
    case 'all-done':
      return {
        ...base,
        subline: 'Friday. All three done, 27 of 30 correct.',
        variant: 'all-done',
        streak: STREAK_ALL,
        stops: [
          stop({ subject: 'math', state: 'done', title: 'Arrays and skip counting', meta: 'Done, 9 of 10 correct', answered: 10 }),
          stop({ subject: 'english', state: 'done', title: 'Past tense with -ed', meta: 'Done, 10 of 10 correct', answered: 10 }),
          stop({ subject: 'science', state: 'done', title: 'Living things and their habitats', meta: 'Done, 8 of 10 correct', answered: 10 }),
        ],
        activeIndex: null,
        bonus: stop({ subject: 'bonus', state: 'ready', title: 'Mixed review', meta: '5 questions, about 8 minutes. Only if you want.', total: 5, ctaLabel: 'Start bonus' }),
        minutesToday: 47,
      }
    case 'rest-day':
      return {
        ...base,
        dateLabel: 'Sunday 11 October',
        headline: "Sunday's quests",
        subline: 'Sunday. No quests today.',
        variant: 'rest-day',
        streak: STREAK_REST,
        stops: [
          stop({ subject: 'math', state: 'rest', title: 'Math', meta: 'Back on Monday' }),
          stop({ subject: 'english', state: 'rest', title: 'English', meta: 'Back on Monday' }),
          stop({ subject: 'science', state: 'rest', title: 'Science', meta: 'Back on Monday' }),
        ],
        activeIndex: null,
        bonus: null,
        nextCompetition: { name: 'KMNR', daysToGo: 39 },
        minutesToday: 0,
      }
    case 'time-limit':
      return {
        ...base,
        subline: 'Friday. That is 60 minutes for today.',
        variant: 'time-limit',
        streak: STREAK,
        stops: [
          stop({ subject: 'math', state: 'done', title: 'Arrays and skip counting', meta: 'Done, 9 of 10 correct', answered: 10 }),
          stop({ subject: 'english', state: 'done', title: 'Past tense with -ed', meta: 'Done, 7 of 10 correct', answered: 10 }),
          stop({ subject: 'science', state: 'locked', title: 'Living things and their habitats', meta: 'Moves to tomorrow', answered: 3 }),
        ],
        activeIndex: null,
        bonus: bonusLocked,
        minutesToday: 60,
      }
    default:
      return {
        ...base,
        subline: 'Friday. You started Math.',
        variant: 'normal',
        streak: STREAK,
        stops: [
          stop({
            subject: 'math',
            state: 'in-progress',
            title: 'Arrays and skip counting',
            meta: '3 of 10 done, about 10 minutes left',
            answered: 3,
            segments: segs(['c', 'c', 'n'], 10),
            ctaLabel: 'Continue',
            href: '/dev/screens/runner',
            offlineReady: true,
          }),
          stop({ subject: 'english', state: 'ready', title: 'Past tense with -ed', meta: READY_META }),
          stop({ subject: 'science', state: 'ready', title: 'Living things and their habitats', meta: READY_META }),
        ],
        activeIndex: 0,
        bonus: bonusLocked,
      }
  }
}

// ---------------------------------------------------------------------------
// L03 Pembuka quest

export function questIntroFixture(state: string): QuestIntroDTO {
  return {
    shell: SHELL,
    questId: 'seed-quest-math',
    subject: 'math',
    title: 'Arrays and skip counting',
    questionCount: 10,
    minutes: 15,
    hintsPerQuestion: 3,
    youWillPractise: ['Rows and columns', 'Counting in 2s, 5s and 10s'],
    modeLabel: 'Practice, with hints',
    lessonHref: '/dev/screens/lesson',
    startHref: '/dev/screens/runner',
    alternative: state === 'missing' ? { subject: 'english', href: '/dev/screens/runner?state=all-widgets' } : null,
  }
}

// ---------------------------------------------------------------------------
// L04 sampai L06 Runner

function saved(list: [number, SavedResponse['status'], unknown, Partial<SavedResponse>?][]): SavedResponse[] {
  return list.map(([position, status, answer, extra]) => ({ position, answer, status, hintsUsed: 0, attemptNo: 1, flagged: false, ...extra }))
}

const QUEST_ITEMS: ItemInput[] = [
  { ...M_SPLIT_NUMERIC, id: 'm2.add-subtract.101' },
  { ...M_PATTERN_MCQ, id: 'm2.patterns.102' },
  {
    id: 'm2.arrays.103',
    skill: 'm2.arrays',
    type: 'numeric',
    difficulty: 2,
    prompt: 'How many dots are there in 3 rows of 2?',
    figure: { kind: 'array', rows: 3, cols: 2, icon: 'dot', alt: '3 rows of dots with 2 dots in each row.' },
    answer: 6,
    hints: ['Count the dots in one row.', 'Count in 2s for each row.', '2, 4, ...'],
    explanation: '3 rows of 2 make 6.',
  },
  M_ARRAY_KEYPAD,
  M_GROUPS_PICTURES,
  M_ORDER_FIVES,
  M_MATCH_ARRAYS,
  {
    id: 'm2.arrays.108',
    skill: 'm2.arrays',
    type: 'mcq',
    difficulty: 2,
    prompt: 'Which number sentence matches 5 rows of 2?',
    options: [{ text: '5 + 2' }, { text: '2 + 2 + 2 + 2 + 2' }, { text: '5 + 5 + 5' }, { text: '2 + 5 + 2' }],
    answer: 1,
    hints: ['Each row has 2.', 'Add one 2 for every row.', 'There are 5 rows, so add 2 five times.'],
    explanation: '5 rows of 2 is 2 added 5 times.',
  },
  {
    id: 'm2.arrays.109',
    skill: 'm2.arrays',
    type: 'numeric',
    difficulty: 3,
    prompt: 'A box has 2 rows of 6 eggs. How many eggs are in the box?',
    figure: { kind: 'array', rows: 2, cols: 6, icon: 'egg', alt: '2 rows of eggs with 6 eggs in each row.' },
    answer: 12,
    hints: ['Count the eggs in one row.', 'Count on 6 more for the second row.', '6 and 6 make ...'],
    explanation: '2 rows of 6 make 12.',
  },
  {
    id: 'm2.skip-counting.110',
    skill: 'm2.skip-counting',
    type: 'numeric',
    difficulty: 2,
    prompt: 'Count in tens: 10, 20, 30, ___. What comes next?',
    answer: 40,
    hints: ['Look at the tens digit.', 'It goes up by 1 ten each time.', '30 and 10 more is ...'],
    explanation: '30 and 10 more is 40.',
  },
]

function questItems(): RunnerItem[] {
  return asRunner(QUEST_ITEMS.map((x) => make(x)))
}

const RUNNER_BASE = {
  shell: SHELL,
  attemptId: 'seed-attempt-math-001',
  kind: 'quest' as const,
  mode: 'latihan' as const,
  subject: 'math' as const,
  title: 'Arrays and skip counting',
  timeLimitSec: null,
  startedAt: '2026-10-09T09:12:00+07:00',
  elapsedSec: 240,
  showFeedback: true,
  allowHints: true,
  allowRetry: true,
  exitHref: '/dev/screens/today',
  doneHref: '/dev/screens/results',
  showTerms: false,
  offline: true,
}

export function runnerFixture(state: string): RunnerDTO {
  switch (state) {
    case 'all-widgets':
      return { ...RUNNER_BASE, attemptId: 'seed-attempt-widgets', title: 'Every answer type', items: allWidgetItems(), saved: [] }
    case 'pictures':
    case 'order':
    case 'match': {
      const start = state === 'pictures' ? 5 : state === 'order' ? 6 : 7
      const ans: [number, SavedResponse['status'], unknown][] = [
        [1, 'correct', { value: '9' }],
        [2, 'correct', { choice: 1 }],
        [3, 'wrong', { value: '5' }],
        [4, 'correct', { value: '20' }],
        [5, 'correct', { choice: 1 }],
        [6, 'correct', { order: [0, 1, 2, 3] }],
      ]
      return { ...RUNNER_BASE, items: questItems(), saved: saved(ans.slice(0, start - 1).map(([p, s, a]) => [p, s, a, p === 3 ? { attemptNo: 2 } : undefined])) }
    }
    case 'review':
      return {
        ...RUNNER_BASE,
        attemptId: 'seed-attempt-review',
        kind: 'review',
        mode: 'review',
        title: 'Review cards',
        allowHints: false,
        items: asRunner([make(M_PATTERN_MCQ), make(E_PAST_TEXT), make(M_SPLIT_NUMERIC)]),
        saved: [],
        exitHref: '/dev/screens/correction-book',
      }
    case 'write':
    case 'speak':
    case 'draw': {
      const one = state === 'write' ? E_WRITE : state === 'speak' ? E_SPEAK : S_DRAW
      return {
        ...RUNNER_BASE,
        subject: state === 'draw' ? 'science' : 'english',
        title: state === 'draw' ? 'Living things and their habitats' : 'Past tense with -ed',
        items: asRunner([make(one)]),
        saved: [],
      }
    }
    case 'weekly-test':
    case 'weekly-one-minute':
    case 'weekly-time-up': {
      const one = state === 'weekly-one-minute' || state === 'weekly-time-up'
      const items = englishTestItems()
      const keys = [0, 2, 1, 0, 2, 3, 2, 0, 3, 0]
      const upto = one ? 10 : 2
      return {
        ...RUNNER_BASE,
        attemptId: 'seed-attempt-weekly',
        kind: 'test',
        mode: 'tes',
        subject: 'english',
        title: 'Weekly test',
        items,
        saved: saved(
          keys
            .slice(0, upto)
            .map((k, i): [number, SavedResponse['status'], unknown, Partial<SavedResponse>?] => [i + 1, 'answered', { choice: k }, { flagged: i === 1 }])
            .filter(([p]) => !(one && (p === 7 || p === 10))),
        ),
        timeLimitSec: 900,
        elapsedSec: state === 'weekly-time-up' ? 900 : one ? 842 : 198,
        showFeedback: false,
        allowHints: false,
        allowRetry: false,
        doneHref: '/dev/screens/results',
      }
    }
    case 'esmo-practice':
      return {
        ...RUNNER_BASE,
        attemptId: 'seed-attempt-esmo-4',
        kind: 'test',
        mode: 'tes',
        title: 'Practice 4',
        items: esmoItems(10),
        saved: saved([
          [1, 'answered', { choice: 1 }],
          [2, 'answered', { choice: 0 }, { flagged: true }],
        ]),
        timeLimitSec: 780,
        elapsedSec: 156,
        showFeedback: false,
        allowHints: false,
        allowRetry: false,
        showTerms: true,
        exitHref: '/dev/screens/esmo',
      }
    case 'esmo-mock': {
      const items = esmoItems(40)
      const ans: [number, SavedResponse['status'], unknown, Partial<SavedResponse>?][] = []
      for (let p = 1; p <= 22; p++) if (p !== 10 && p !== 18) ans.push([p, 'answered', { choice: (p * 7) % 4 }, { flagged: p === 5 || p === 16 }])
      return {
        ...RUNNER_BASE,
        attemptId: 'seed-attempt-esmo-mock',
        kind: 'simulation',
        mode: 'simulasi',
        title: 'Mock test',
        items,
        saved: saved(ans),
        timeLimitSec: 3000,
        elapsedSec: 1128,
        showFeedback: false,
        allowHints: false,
        allowRetry: false,
        showTerms: true,
        exitHref: '/dev/screens/esmo',
      }
    }
    case 'kilat':
      return {
        ...RUNNER_BASE,
        attemptId: 'seed-attempt-sprint',
        mode: 'kilat',
        title: 'Times tables sprint',
        items: sprintItems(),
        saved: [],
        timeLimitSec: 60,
        elapsedSec: 0,
        allowHints: false,
        allowRetry: false,
      }
    default:
      return {
        ...RUNNER_BASE,
        items: questItems(),
        saved: saved([
          [1, 'correct', { value: '9' }],
          [2, 'correct', { choice: 1 }],
          [3, 'wrong', { value: '5' }, { attemptNo: 2 }],
        ]),
      }
  }
}

// ---------------------------------------------------------------------------
// L07 Hasil, L17 Hasil ESMO

const Q_STATUS = (right: number[], total = 10): ResultsDTO['questions'] =>
  Array.from({ length: total }, (_, i) => ({
    position: i + 1,
    status: right.includes(i + 1) ? 'correct' : 'wrong',
    skillTitle: ['Patterns', 'Numbers', 'Patterns', 'Shapes', 'Numbers', 'Shapes', 'Patterns', 'Logic', 'Measures', 'Shapes'][i] ?? 'Numbers',
  }))

export function resultsFixture(state: string): ResultsDTO {
  const base: ResultsDTO = {
    shell: SHELL,
    attemptId: 'seed-attempt-p7',
    subject: 'math',
    title: 'Olympiad paper P7',
    meta: '10 questions, 15 minutes',
    scoreLabel: 'Your score',
    scoreValue: 7,
    scoreMax: 10,
    scaled: null,
    headline: '7 of 10 right on your first olympiad paper.',
    detail: 'Question 6 has a short animation that shows how to count the triangles.',
    timeUsedSec: 800,
    timeLimitSec: 900,
    xp: 95,
    newBadges: [{ id: 'first-olympiad-paper', title: 'First olympiad paper', description: 'You finished a whole olympiad paper.' }],
    questions: Q_STATUS([1, 2, 3, 5, 7, 8, 10]),
    strongest: { topic: 'Patterns', line: '3 of 3' },
    weakest: { topic: 'Shapes', line: '1 of 3' },
    byTopic: [],
    reviewHref: '/dev/screens/review',
    backHref: '/dev/screens/today',
    backLabel: 'Back to Today',
    tone: 'normal',
  }
  switch (state) {
    case 'full':
      return {
        ...base,
        scoreValue: 10,
        headline: '10 of 10. Every answer is right.',
        detail: 'The steps for every question are still there if you want to look.',
        timeUsedSec: 725,
        xp: 150,
        newBadges: [{ id: 'perfect-paper', title: 'Perfect paper', description: 'Every answer right on an olympiad paper.' }],
        questions: Q_STATUS([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
        weakest: { topic: 'Paper P8, a bit harder', line: '' },
        tone: 'full',
      }
    case 'low':
      return {
        ...base,
        scoreValue: 3,
        headline: '3 of 10 this time. This paper was a hard one.',
        detail: 'Start with question 6. It has a short animation.',
        timeUsedSec: 900,
        xp: 35,
        newBadges: [],
        questions: Q_STATUS([1, 3, 7]),
        weakest: { topic: 'Shapes', line: '0 of 3' },
        tone: 'low',
      }
    case 'esmo':
    case 'esmo-low': {
      const low = state === 'esmo-low'
      const topics = low
        ? [['Patterns', 6, 8], ['Time and clocks', 2, 6], ['Shapes', 4, 6], ['Mystery numbers', 5, 6], ['Calendar', 1, 4], ['Other topics', 8, 10]]
        : [['Patterns', 7, 8], ['Time and clocks', 3, 6], ['Shapes', 5, 6], ['Mystery numbers', 5, 6], ['Calendar', 2, 4], ['Other topics', 8, 10]]
      const right = topics.reduce((n, t) => n + (t[1] as number), 0)
      const score = Math.round((right / 40) * 100)
      return {
        ...base,
        attemptId: 'seed-attempt-esmo-mock',
        title: 'Mock test score',
        meta: '40 questions, Saturday 17 October',
        scoreValue: right,
        scoreMax: 40,
        scaled: { value: score, target: 70 },
        headline: low ? `${70 - score} points to go.` : `${score - 70} points above your target.`,
        detail: low ? `${right} of 40 right. ${28 - right} more right answers would reach 70.` : `${right} of 40 right.`,
        timeUsedSec: 2760,
        timeLimitSec: 3000,
        xp: 60,
        newBadges: [],
        questions: Array.from({ length: 40 }, (_, i) => ({ position: i + 1, status: i < right ? 'correct' : 'wrong', skillTitle: 'ESMO' })),
        strongest: null,
        weakest: { topic: 'Time and clocks', line: low ? 'Most points to win back: Time and clocks, then Calendar.' : 'Next to practise: Time and clocks, then Calendar.' },
        byTopic: topics.map((t) => ({ label: t[0] as string, right: t[1] as number, total: t[2] as number })),
        backHref: '/dev/screens/esmo',
        backLabel: 'Back to ESMO',
        tone: low ? 'low' : 'normal',
      }
    }
    default:
      return base
  }
}

// ---------------------------------------------------------------------------
// L08 Pembahasan

const P7: { topic: string; text: string; opts: string[]; key: number; her: number; why?: string; explain: string; tip: string; player?: boolean }[] = [
  { topic: 'Patterns', text: 'What comes next? 2, 4, 6, 8, ...', opts: ['9', '10', '12', '16'], key: 1, her: 1, explain: 'The numbers go up in 2s. 8 and 2 more is 10.', tip: 'Find the jump between two numbers first.' },
  { topic: 'Numbers', text: 'Which number is 10 more than 47?', opts: ['48', '37', '57', '147'], key: 2, her: 2, explain: '10 more changes the tens. 4 tens become 5 tens, so the answer is 57.', tip: 'For 10 more, only the tens digit goes up by 1.' },
  { topic: 'Patterns', text: 'Circle, square, circle, square, ... What is the 9th shape?', opts: ['circle', 'square', 'triangle', 'star'], key: 0, her: 0, explain: 'Circles are in the 1st, 3rd, 5th, 7th and 9th places.', tip: 'In a pattern of 2, the odd places match the 1st shape.' },
  { topic: 'Shapes', text: 'How many sides do 2 triangles and 1 square have altogether?', opts: ['7', '9', '10', '12'], key: 2, her: 1, why: '9 counts one triangle with only 2 sides. Every triangle has 3 sides.', explain: '3 and 3 and 4 make 10.', tip: 'Count one shape at a time, then add.' },
  { topic: 'Numbers', text: 'Sam has 15 marbles. He gives 6 away. How many are left?', opts: ['9', '11', '21', '8'], key: 0, her: 0, explain: '15 take away 6 is 9.', tip: 'Gives away means take away.' },
  { topic: 'Shapes', text: 'How many triangles are in this shape?', opts: ['3', '4', '5', '6'], key: 3, her: 1, player: true, why: '4 counts the three small triangles and the big one. It misses the two triangles made of two small ones side by side.', explain: 'Count by size: 3 small, 2 made of two small ones, and 1 big. 3 and 2 and 1 make 6.', tip: 'Count small shapes first, then join neighbours, then the whole shape.' },
  { topic: 'Patterns', text: 'Count in 5s: 5, 10, 15, ___, 25. What is missing?', opts: ['16', '18', '20', '30'], key: 2, her: 2, explain: '15 and 5 more is 20.', tip: 'Check it: 20 and 5 more should give 25.' },
  { topic: 'Logic', text: 'Ali is taller than Ben. Ben is taller than Cara. Who is the shortest?', opts: ['Ali', 'Ben', 'Cara', 'All the same'], key: 2, her: 2, explain: 'Put them in a line from tall to short: Ali, Ben, Cara.', tip: 'Draw the order as a line.' },
  { topic: 'Measures', text: 'A pencil is 12 cm long. A crayon is 5 cm shorter. How long is the crayon?', opts: ['17 cm', '7 cm', '5 cm', '8 cm'], key: 1, her: 0, why: '17 cm adds the 5 cm. Shorter means take away.', explain: '12 take away 5 is 7, so the crayon is 7 cm long.', tip: 'Shorter, fewer and less all mean take away.' },
  { topic: 'Shapes', text: 'Which shape has 4 equal sides?', opts: ['rectangle', 'triangle', 'square', 'circle'], key: 2, her: 2, explain: 'A square has 4 sides, all the same length.', tip: 'A rectangle also has 4 sides. Only its opposite sides match.' },
]

const LET = ['A', 'B', 'C', 'D']

export function reviewFixture(state: string): ReviewDTO {
  const questions: ReviewQuestionDTO[] = P7.map((q, i) => {
    const input: ItemInput = {
      id: `m2.olympiad-p7.${String(i + 1).padStart(3, '0')}`,
      skill: 'm2.olympiad-p7',
      type: 'mcq',
      difficulty: 4,
      prompt: q.text,
      options: q.opts.map((text) => ({ text })),
      answer: q.key,
      tags: ['keep-order', 'olympiad'],
      ...(q.player ? { figure: { kind: 'shape', shape: 'triangle', tone: 'math', alt: 'A big triangle split into 3 small triangles by 2 lines from the top corner.' } } : {}),
      hints: ['Read the question again.', 'Draw it if you can.', 'Check each answer.'],
      explanation: q.explain,
      tip: q.tip,
      ...(q.player
        ? {
            solution: [
              { say: 'Count the small triangles: 1, 2, 3.', show: '3' },
              { say: 'Two small ones side by side make a bigger triangle: 4.', show: '3 + 1' },
              { say: 'The other pair makes one more: 5.', show: '3 + 2' },
              { say: 'The whole shape is a triangle too: 6.', show: '3 + 2 + 1 = 6' },
            ],
          }
        : {}),
    }
    const item = make(input)
    const parsed = itemSchema.parse(input)
    const ok = q.her === q.key
    return {
      position: i + 1,
      item,
      yourAnswerText: `${LET[q.her] ?? 'A'}. ${q.opts[q.her] ?? ''}`,
      correctAnswerText: answerText(parsed),
      status: ok ? 'correct' : 'wrong',
      explanation: q.explain,
      whyYourAnswer: ok ? null : (q.why ?? null),
      tip: q.tip,
      solution: parsed.solution ?? null,
      tutorFeedback: null,
      similarHref: ok ? null : '/dev/screens/runner?state=review',
    }
  })
  return {
    shell: SHELL,
    attemptId: 'seed-attempt-p7',
    title: 'Olympiad paper P7, answers',
    subject: 'math',
    questions,
    openPosition: state === 'first' ? 1 : 6,
    backHref: '/dev/screens/results',
  }
}

// ---------------------------------------------------------------------------
// L14 Selesai hari ini

export function doneTodayFixture(state: string): DoneTodayDTO {
  const limit = state === 'time-limit'
  return {
    shell: SHELL,
    variant: limit ? 'time-limit' : 'all-done',
    title: limit ? 'That is 60 minutes for today' : 'All done for today',
    line: limit ? 'Your streak is safe. Science moves to tomorrow, and your answers are saved.' : 'Your streak is now 13 days. See you tomorrow.',
    xpToday: limit ? 85 : 120,
    minutesToday: limit ? 60 : 47,
    quests: [
      { subject: 'math', title: 'Arrays and skip counting', score: '9 of 10' },
      { subject: 'english', title: 'Past tense with -ed', score: limit ? '7 of 10' : '10 of 10' },
      { subject: 'science', title: 'Living things and their habitats', score: limit ? 'Stopped at question 4. Saved.' : '8 of 10' },
    ],
    tomorrow: limit ? 'Tomorrow starts with Science, from question 5.' : 'Tomorrow is Saturday: bonus quests. Sunday is a rest day.',
    answersHref: '/dev/screens/results',
    streak: limit ? STREAK : STREAK_ALL,
  }
}

// ---------------------------------------------------------------------------
// L09 Peta

type Code = 'm' | 'l' | 'r' | 't' | 'x' | 'n'

function chapters(subject: 'math' | 'english' | 'science', list: [string, [string, Code, number][]][]): { title: string; skills: MapSkillDTO[] }[] {
  return list.map(([title, skills], ci) => ({
    title,
    skills: skills.map(([name, code, stars], si) => ({
      id: `${subject[0]}2.seed-${ci}-${si}`,
      title: name,
      canDo: `I can work with ${name.toLowerCase()}.`,
      state: code === 'm' ? 'mastered' : code === 'r' ? 'review' : code === 'x' ? 'locked' : code === 'n' ? 'new' : 'learning',
      stars: Math.max(0, Math.min(3, stars)) as 0 | 1 | 2 | 3,
      isToday: code === 't',
      lessonHref: code === 'x' ? null : '/dev/screens/lesson',
      practiseHref: code === 'x' ? null : '/dev/screens/quest-intro',
    })),
  }))
}

export function mapFixture(state: string): MapDTO {
  return {
    shell: SHELL,
    grade: 2,
    selectedSubject: state === 'english' ? 'english' : state === 'science' ? 'science' : 'math',
    subjects: [
      {
        subject: 'math',
        chapters: chapters('math', [
          ['Numbers to 100', [['Count to 100', 'm', 3], ['Tens and ones', 'm', 3], ['Compare numbers', 'r', 2]]],
          ['Add and take away', [['Number bonds to 20', 'm', 3], ['Add 2-digit numbers', 'l', 2], ['Take away 2-digit numbers', 'l', 1]]],
          ['Times and groups', [['Arrays', 't', 1], ['Skip counting in 2s, 5s, 10s', 'n', 0], ['Equal groups', 'x', 0]]],
          ['Shapes', [['2D shapes', 'l', 1], ['3D shapes', 'x', 0], ['Symmetry', 'x', 0]]],
          ['Time', [["O'clock and half past", 'r', 2], ['Quarter past and to', 'l', 1], ['Days and months', 'x', 0]]],
          ['Fractions', [['Halves', 'x', 0], ['Quarters', 'x', 0], ['Thirds', 'x', 0]]],
        ]),
      },
      {
        subject: 'english',
        chapters: chapters('english', [
          ['Phonics and spelling', [['Long vowel sounds', 'm', 3], ['Rhyming words', 'm', 3], ['Tricky words', 'l', 2]]],
          ['Grammar', [['Nouns and verbs', 'm', 3], ['Past tense with -ed', 't', 1], ['Irregular plurals', 'r', 1]]],
          ['Sentences', [['Capital letters and full stops', 'm', 3], ['There is and there are', 'l', 2], ['Joining words', 'x', 0]]],
          ['Reading', [['Short stories', 'l', 2], ['Finding facts', 'l', 1], ['Putting events in order', 'x', 0]]],
          ['Vocabulary', [['Opposites', 'm', 3], ['Same meaning', 'l', 1], ['Words in sentences', 'x', 0]]],
          ['Writing', [['Describing words', 'x', 0], ['Short paragraphs', 'x', 0], ['Instructions', 'x', 0]]],
        ]),
      },
      {
        subject: 'science',
        chapters: chapters('science', [
          ['Living things', [['Living and non-living', 'm', 3], ['Habitats', 't', 1], ['Food chains', 'x', 0]]],
          ['Plants', [['Parts of a plant', 'm', 3], ['What plants need', 'l', 2], ['Growing seeds', 'x', 0]]],
          ['Humans and animals', [['Body parts', 'm', 3], ['Healthy eating', 'l', 1], ['Animal groups', 'x', 0]]],
          ['Materials', [['Naming materials', 'l', 2], ['Hard, soft, bendy', 'x', 0], ['Changing shape', 'x', 0]]],
          ['Forces', [['Push and pull', 'x', 0], ['Moving things', 'x', 0], ['Rough and smooth', 'x', 0]]],
          ['Earth and sky', [['Day and night', 'x', 0], ['Weather', 'x', 0], ['Seasons', 'x', 0]]],
        ]),
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// L10 Me

export function meFixture(state: string): MeDTO {
  const fresh = state === 'new'
  const calendar: MeDTO['calendar'] = []
  // Oktober 2026 dimulai hari Kamis: Senin 28 sampai Rabu 30 September di luar bulan.
  for (let d = 28; d <= 30; d++) calendar.push({ date: `2026-09-${d}`, day: d, status: 'none', inMonth: false })
  const today = 12
  for (let d = 1; d <= 31; d++) {
    const date = `2026-10-${String(d).padStart(2, '0')}`
    const dow = (d + 2) % 7 // 0 Senin
    const sunday = dow === 6
    let status: DayStatus = 'upcoming'
    if (fresh) {
      if (d < today) status = 'none'
      else if (d === today) status = 'today'
      else if (sunday) status = 'rest'
    } else if (d === 1) status = 'missed'
    else if (d === 6) status = 'freeze'
    else if (d < today) status = sunday ? 'rest' : 'complete'
    else if (d === today) status = 'partial'
    else if (sunday) status = 'rest'
    calendar.push({ date, day: d, status, inMonth: true })
  }
  calendar.push({ date: '2026-11-01', day: 1, status: 'none', inMonth: false })
  return {
    shell: SHELL,
    level: fresh ? 1 : 4,
    xp: fresh ? 0 : 920,
    xpIntoLevel: fresh ? 0 : 320,
    xpLevelSpan: fresh ? 100 : 400,
    xpToNext: fresh ? 100 : 80,
    badges: [
      { id: 'first-quest', title: 'First quest', description: 'Finish your first quest', earnedAt: fresh ? null : '2026-09-21', isNew: false },
      { id: 'streak-7', title: '7-day streak', description: 'Learn 7 days in a row', earnedAt: fresh ? null : '2026-10-09', isNew: false },
      { id: 'perfect-quest', title: 'Perfect quest', description: 'Every answer right in a quest', earnedAt: fresh ? null : '2026-10-07', isNew: false },
      { id: 'questions-100', title: '100 questions', description: 'Answer 100 questions', earnedAt: fresh ? null : '2026-10-10', isNew: false },
      { id: 'first-olympiad-paper', title: 'First olympiad paper', description: 'Finish a whole olympiad paper', earnedAt: fresh ? null : '2026-10-11', isNew: !fresh },
      { id: 'streak-30', title: '30-day streak', description: 'Learn 30 days in a row', earnedAt: null, isNew: false },
      { id: 'clock-master', title: 'Clock master', description: '3 stars on all Time skills', earnedAt: null, isNew: false },
      { id: 'esmo-ready', title: 'ESMO ready', description: 'Finish all 10 ESMO packs', earnedAt: null, isNew: false },
    ],
    monthLabel: 'October 2026',
    calendar,
    streakLine: fresh ? 'Your streak starts today' : '12 day streak, 1 freeze saved',
    avatars: ['fox', 'cat', 'owl', 'bear', 'rabbit', 'turtle', 'penguin', 'frog'],
  }
}

// ---------------------------------------------------------------------------
// L11 Buku Koreksi

export function correctionBookFixture(state: string): CorrectionBookDTO {
  if (state === 'empty') {
    return { shell: SHELL, dueCount: 0, groups: [], cards: [], comingBack: 'Your next cards come back on Thursday.', startHref: null }
  }
  return {
    shell: SHELL,
    dueCount: 6,
    groups: [
      { subject: 'math', title: 'Fix it', count: 3, note: 'Look at the answer first, then try again.' },
      { subject: 'math', title: 'Times tables', count: 2, note: 'Quick facts. Try to answer before you count.' },
      { subject: 'english', title: 'Words', count: 1, note: 'Words from this week in English.' },
    ],
    cards: [
      { subject: 'math', prompt: 'How many triangles are in this shape?', meta: 'Fix it, from Olympiad paper P7' },
      { subject: 'math', prompt: 'How many sides do 2 triangles and 1 square have altogether?', meta: 'Fix it, from Olympiad paper P7' },
      { subject: 'math', prompt: 'A pencil is 12 cm long. A crayon is 5 cm shorter. How long is the crayon?', meta: 'Fix it, from Olympiad paper P7' },
      { subject: 'math', prompt: '6 × 2 = ?', meta: 'Times tables, times 2' },
      { subject: 'math', prompt: '5 × 4 = ?', meta: 'Times tables, times 5' },
      { subject: 'english', prompt: 'One mouse, two ___.', meta: 'Words, special plurals' },
    ],
    comingBack: 'Coming back: 4 cards tomorrow and 3 on Thursday.',
    startHref: '/dev/screens/runner?state=review',
  }
}

// ---------------------------------------------------------------------------
// L12 Pelajaran

export function lessonFixture(_state: string): LessonDTO {
  void _state
  return {
    shell: SHELL,
    skillId: 'm2.arrays',
    subject: 'math',
    title: 'Lesson: Arrays',
    meta: 'Times and groups chapter. About 4 minutes.',
    steps: [
      { say: 'Apples can sit in a row. This row has 4 apples.', show: '4', figure: { kind: 'array', rows: 1, cols: 4, icon: 'apple', alt: '1 row of 4 apples.' } },
      { say: 'Now there are 3 rows. Each row has 4 apples.', figure: { kind: 'array', rows: 3, cols: 4, icon: 'apple', alt: '3 rows of 4 apples.' } },
      { say: 'This is called an array. Count the rows going down: 1, 2, 3.', show: '3 rows', figure: { kind: 'array', rows: 3, cols: 4, icon: 'apple', highlightRows: 3, alt: '3 rows of 4 apples, each row marked.' } },
      { say: '3 rows of 4 is 12. We write it as 3 times 4 equals 12.', show: '3 × 4 = 12', figure: { kind: 'array', rows: 3, cols: 4, icon: 'apple', alt: '3 rows of 4 apples, 12 apples in all.' } },
    ],
    check: [
      make({
        id: 'm2.arrays.901',
        skill: 'm2.arrays',
        type: 'mcq',
        difficulty: 2,
        prompt: 'How many apples are there in 3 rows of 4?',
        figure: { kind: 'array', rows: 3, cols: 4, icon: 'apple', alt: '3 rows of 4 apples.' },
        options: [{ text: '8' }, { text: '7' }, { text: '12' }, { text: '34' }],
        answer: 2,
        tags: ['keep-order'],
        hints: ['Count one row first.', 'Count on in 4s.', '4, 8, ...'],
        explanation: '3 rows of 4 is 12.',
      }),
      make({
        id: 'm2.arrays.902',
        skill: 'm2.arrays',
        type: 'numeric',
        difficulty: 2,
        prompt: 'How many dots are in 2 rows of 5?',
        figure: { kind: 'array', rows: 2, cols: 5, icon: 'dot', alt: '2 rows of 5 dots.' },
        answer: 10,
        hints: ['Count one row.', 'Count on 5 more.', '5, 10.'],
        explanation: '2 rows of 5 is 10.',
      }),
    ],
    practiseHref: '/dev/screens/quest-intro',
    backHref: '/dev/screens/map',
  }
}

// ---------------------------------------------------------------------------
// L13 Simulator lomba

export function competitionPickFixture(_state: string): CompetitionPickDTO {
  void _state
  return {
    shell: SHELL,
    presets: [
      { presetId: 'ikmc-pre-ecolier-2027', title: 'IKMC Pre-Ecolier', subjectLine: 'Math, in English', formatLines: ['24 questions, 75 minutes', '3 parts: 3, 4 and 5 points'], verified: true, lastTry: null, href: '/dev/screens/competition-intro' },
      { presetId: 'esmo-math-2026', title: 'ESMO Math', subjectLine: 'Math, in Indonesian', formatLines: ['40 questions, 50 minutes', 'Terms button for English words'], verified: true, lastTry: '75 of 100', href: '/dev/screens/esmo' },
      { presetId: 'sasmo-2027', title: 'SASMO', subjectLine: 'Math, in English', formatLines: ['Choose answers and write numbers', 'Wrong answers take a point off'], verified: false, lastTry: null, href: '/dev/screens/competition-intro?state=unverified' },
    ],
  }
}

export function competitionIntroFixture(state: string): CompetitionIntroDTO {
  if (state === 'unverified') {
    return {
      shell: SHELL,
      presetId: 'sasmo-2027',
      title: 'SASMO practice',
      sub: 'Math, in English. Rules not checked yet.',
      verified: false,
      rules: [
        'Some questions have answers to choose. Some need a number to write.',
        'Right answer: 2 points. Wrong answer: 1 point off. Empty: 0 points.',
        'Write-in questions are worth 4 points.',
        'You start with 15 points.',
      ],
      tip: 'If you really do not know, leave it empty. A wrong answer takes a point away, and an empty one does not.',
      questionCount: 25,
      timeLimitSec: 5400,
      optionCount: 5,
      startLabel: 'Practise anyway',
    }
  }
  return {
    shell: SHELL,
    presetId: 'ikmc-pre-ecolier-2027',
    title: 'IKMC Pre-Ecolier practice',
    sub: 'Math, in English. 24 questions.',
    verified: true,
    rules: [
      'There are 24 questions in 3 parts.',
      'Part A questions are worth 3 points, Part B 4 points, Part C 5 points.',
      'You have 75 minutes. The clock keeps going, even if you stop.',
      'Choose one answer for each question. You can change it.',
      'No hints in a competition. Wrong answers do not take points off in this practice.',
    ],
    tip: null,
    questionCount: 24,
    timeLimitSec: 4500,
    optionCount: 5,
    startLabel: 'Start',
  }
}

// ---------------------------------------------------------------------------
// L15 Paket ESMO

export function esmoFixture(state: string): EsmoDTO {
  const fresh = state === 'new'
  const pack = (subject: 'math' | 'english', num: number, status: 'new' | 'in-progress' | 'done', score: number | null) => ({
    id: `seed-esmo-${subject}-${num}`,
    num,
    status,
    score,
    href: status === 'done' ? '/dev/screens/review' : '/dev/screens/runner?state=esmo-practice',
  })
  const math = fresh
    ? Array.from({ length: 10 }, (_, i) => pack('math', i + 1, 'new', null))
    : [pack('math', 1, 'done', 8), pack('math', 2, 'done', 7), pack('math', 3, 'done', 9), pack('math', 4, 'in-progress', 2), ...Array.from({ length: 6 }, (_, i) => pack('math', i + 5, 'new', null))]
  const english = fresh
    ? Array.from({ length: 10 }, (_, i) => pack('english', i + 1, 'new', null))
    : [pack('english', 1, 'done', 9), pack('english', 2, 'done', 6), ...Array.from({ length: 8 }, (_, i) => pack('english', i + 3, 'new', null))]
  return {
    shell: SHELL_NO_REVIEW,
    finalName: 'ESMO 4 final',
    finalDate: '2026-11-21',
    daysToGo: fresh ? 47 : 40,
    columns: [
      { subject: 'math', name: 'Math', langNote: 'Questions in Bahasa Indonesia', doneLine: `${math.filter((p) => p.status === 'done').length} of 10 done`, packs: math, mockMeta: '40 questions in 50 minutes, like the first round.', mockHref: '/dev/screens/runner?state=esmo-mock' },
      { subject: 'english', name: 'English', langNote: 'Questions in English', doneLine: `${english.filter((p) => p.status === 'done').length} of 10 done`, packs: english, mockMeta: '40 questions in 40 minutes, like the first round.', mockHref: '/dev/screens/runner?state=esmo-mock' },
    ],
  }
}

// ---------------------------------------------------------------------------
// Daftar layar dan state untuk halaman pratinjau.

export const LEARNER_SCREENS: Record<string, { states: string[]; title: string }> = {
  'pick-learner': { title: 'L18 Pilih learner', states: ['normal', 'limit', 'locked'] },
  pin: { title: 'L01 Masuk anak', states: ['normal', 'wrong', 'locked'] },
  today: { title: 'L02 Today', states: ['normal', 'first-day', 'one-done', 'all-done', 'rest-day', 'time-limit'] },
  'quest-intro': { title: 'L03 Pembuka quest', states: ['ready', 'missing'] },
  runner: {
    title: 'L04 sampai L06 Runner',
    states: ['quest', 'pictures', 'order', 'match', 'all-widgets', 'review', 'write', 'speak', 'draw', 'weekly-test', 'weekly-one-minute', 'weekly-time-up', 'esmo-practice', 'esmo-mock', 'kilat', 'save-error'],
  },
  results: { title: 'L07 dan L17 Hasil', states: ['normal', 'full', 'low', 'esmo', 'esmo-low'] },
  review: { title: 'L08 Pembahasan', states: ['solution', 'first'] },
  'done-today': { title: 'L14 Selesai hari ini', states: ['all-done', 'time-limit'] },
  map: { title: 'L09 Peta belajar', states: ['math', 'english', 'science'] },
  me: { title: 'L10 Me', states: ['normal', 'new'] },
  'correction-book': { title: 'L11 Buku Koreksi', states: ['normal', 'empty'] },
  lesson: { title: 'L12 Pelajaran', states: ['normal'] },
  'competition-pick': { title: 'L13 Simulator lomba', states: ['normal'] },
  'competition-intro': { title: 'L13 Instruksi lomba', states: ['verified', 'unverified'] },
  esmo: { title: 'L15 Paket ESMO', states: ['normal', 'new'] },
}
