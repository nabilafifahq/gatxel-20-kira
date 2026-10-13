/**
 * Kontrak data antara server (DAL, halaman) dan komponen layar.
 * Komponen layar hanya menerima DTO ini dan memanggil action lewat props.
 * Semua tanggal berupa string ISO "YYYY-MM-DD" (WIB) atau timestamp ISO.
 * Jangan menambahkan field yang berisi data rahasia (hash, token, kunci jawaban tes).
 */

import type { ClientItem } from '@kira/content/present'
import type { SolutionStep } from '@kira/content/schema'
import type { FigureSpec } from '@kira/figures/spec'
import type { AccessoryId } from '@kira/core'
import type { AccessoryDTO, ArenaTutorDTO, XpTrackDTO } from './dto-arena'

import type { SessionType } from '@kira/core'

export type { SessionType }
export type Subject = 'math' | 'english' | 'science'
export type QuestSubject = Subject | 'bonus'
export type Jenjang = '1-2' | '3-4' | '5-6'
export type AvatarName = 'fox' | 'cat' | 'owl' | 'bear' | 'rabbit' | 'turtle' | 'penguin' | 'frog'
export type DayStatus = 'complete' | 'partial' | 'rest' | 'freeze' | 'missed' | 'today' | 'upcoming' | 'none'

/** Hasil action dari server. `reference` adalah kode referensi error untuk ditampilkan. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; message: string; reference: string; fieldErrors?: Record<string, string> }

// ---------------------------------------------------------------------------
// Learner: umum

export type LearnerShell = {
  learnerId: string
  name: string
  avatar: AvatarName
  /** Aksesori avatar yang dipakai (didapat dari level jalur XP). */
  accessory?: AccessoryId | null
  grade: number
  jenjang: Jenjang
  /** Tampilkan tombol Review di navigasi bila Buku Koreksi aktif (Fase 2). */
  showReview: boolean
  dueReviewCount: number
}

export type StreakDay = { date: string; label: string; longLabel: string; status: DayStatus; isToday: boolean }

export type StreakDTO = { current: number; freezes: number; week: StreakDay[]; weekDone: number }

// L18 Pilih learner
export type PickLearnerDTO = {
  deviceName: string
  learners: { id: string; name: string; avatar: AvatarName; grade: number; doneToday: boolean; locked: boolean }[]
}

// L01 Masuk anak (PIN gambar)
export type PinPicture = 'sun' | 'moon' | 'star' | 'cat' | 'fish' | 'tree' | 'apple' | 'boat' | 'ball'
export type PinScreenDTO = {
  learnerId: string
  name: string
  avatar: AvatarName
  /** Urutan 9 gambar di layar (tetap, tidak diacak supaya anak hafal posisinya). */
  pictures: PinPicture[]
  lockedUntil: string | null
  attemptsLeft: number
}
export type PinActions = {
  submitPin(learnerId: string, pin: PinPicture[]): Promise<ActionResult<{ redirectTo: string }>>
}

// ---------------------------------------------------------------------------
// L02 Today

export type QuestStopDTO = {
  questId: string | null
  subject: QuestSubject
  state: 'locked' | 'ready' | 'in-progress' | 'done' | 'rest'
  /** Jenis sesi dan labelnya ("Practice", "Test", "Paper", ...). */
  session: SessionType
  sessionLabel: string
  /** Sesi wajib dihitung untuk streak; sesi opsional ("Extra today") tidak. */
  required: boolean
  /** Ada hitung mundur (Tes dan Paper). */
  timed: boolean
  /** Skor terbaik bila sesi sudah diulang, misalnya "Best 9 of 10". */
  best: string | null
  title: string
  /** Misalnya "Math, 3 of 10 done, about 10 minutes left". */
  meta: string
  total: number
  answered: number
  /** Status per soal untuk bar progres quest aktif. */
  segments: SegmentState[]
  href: string | null
  ctaLabel: string
  offlineReady: boolean
}

export type SegmentState = 'correct' | 'not-yet' | 'current' | 'todo' | 'answered'

/** Sesi wajib satu mapel di jalur Today: Practice, Test, Paper. */
export type TodayGroupDTO = { subject: Subject; label: string; done: number; total: number; stops: QuestStopDTO[] }

export type TodayDTO = {
  shell: LearnerShell
  dateLabel: string
  /** "Friday's sessions" atau sapaan hari pertama. */
  headline: string
  subline: string
  variant: 'first-day' | 'normal' | 'all-done' | 'rest-day' | 'time-limit'
  streak: StreakDTO
  /** Sesi wajib per mapel, mapel dalam urutan Math, English, Science. */
  groups: TodayGroupDTO[]
  /** Sesi opsional dari tutor ("Extra today"). Tidak memengaruhi streak. */
  extras: QuestStopDTO[]
  /** Sesi yang sebaiknya dikerjakan sekarang (tampil besar). */
  activeQuestId: string | null
  progress: { done: number; total: number; extraDone: number; extraTotal: number }
  nextCompetition: { name: string; daysToGo: number } | null
  esmo: { href: string; label: string } | null
  minutesToday: number
  screenLimitMin: number
  /** Tiga bar XP (Belajar, Quick Maths, Quiz); diisi halaman Today. */
  tracks?: XpTrackDTO[]
}

// L03 Pembuka quest
export type QuestIntroDTO = {
  shell: LearnerShell
  questId: string
  subject: Subject
  title: string
  questionCount: number
  minutes: number
  hintsPerQuestion: number
  youWillPractise: string[]
  modeLabel: string
  /** Batas waktu sesi berwaktu, dalam menit; null bila tanpa waktu. */
  timeLimitMin: number | null
  lessonHref: string | null
  startHref: string
  /** Diisi client: apakah paket quest sudah tersimpan di perangkat. */
  alternative: { subject: Subject; href: string } | null
}

// ---------------------------------------------------------------------------
// L04, L05, L06 Runner

export type RunnerMode = 'belajar' | 'latihan' | 'kilat' | 'tes' | 'simulasi' | 'review'

export type RunnerItem = ClientItem & { position: number; section: 'warmup' | 'core' | 'challenge' | 'sprint' }

export type SavedResponse = {
  position: number
  answer: unknown
  status: 'correct' | 'wrong' | 'blank' | 'pending' | 'answered'
  hintsUsed: number
  attemptNo: number
  flagged: boolean
}

export type RunnerDTO = {
  shell: LearnerShell
  attemptId: string
  kind: 'quest' | 'test' | 'simulation' | 'review' | 'paper' | 'lesson-check'
  mode: RunnerMode
  subject: Subject
  title: string
  items: RunnerItem[]
  saved: SavedResponse[]
  /** Untuk tes berwaktu dan simulasi. */
  timeLimitSec: number | null
  startedAt: string
  /** Detik yang sudah lewat menurut server saat halaman dimuat. */
  elapsedSec: number
  showFeedback: boolean
  allowHints: boolean
  allowRetry: boolean
  exitHref: string
  doneHref: string
  /** Tombol Terms untuk istilah English di soal ESMO. */
  showTerms: boolean
  /** Paket offline: semua yang dibutuhkan untuk menyelesaikan tanpa jaringan. */
  offline: boolean
  /** Sesi English Skills: listening menyembunyikan teks soal, speaking membacakan soal sebagai penguji. */
  englishArea?: 'listening' | 'speaking' | 'writing'
}

export type AnswerPayload = {
  attemptId: string
  position: number
  answer: unknown
  hintsUsed: number
  attemptNo: number
  timeMs: number
  flagged: boolean
  /** UUID dari perangkat untuk idempotensi (jawaban yang sama tidak dihitung dua kali). */
  clientId: string
  answeredAt: string
}

export type AnswerResult = {
  status: 'correct' | 'wrong' | 'blank' | 'pending' | 'answered'
  xp: number
  /** Untuk mode tanpa umpan balik, status disembunyikan menjadi 'answered'. */
}

export type RunnerActions = {
  saveAnswer(p: AnswerPayload): Promise<ActionResult<AnswerResult>>
  submitAttempt(attemptId: string, clientId: string): Promise<ActionResult<{ redirectTo: string }>>
  reportProblem(input: { itemRef: string; reason: 'wrong-answer' | 'confusing' | 'picture' | 'other'; note: string }): Promise<ActionResult<{ reference: string }>>
}

// ---------------------------------------------------------------------------
// L07 Hasil, L08 Pembahasan, L17 Hasil ESMO

export type ResultQuestion = {
  position: number
  status: 'correct' | 'wrong' | 'blank' | 'pending'
  skillTitle: string
}

/** Posisi di level untuk bar XP di akhir sesi: `into` dari `span` XP di level itu. */
export type XpBarDTO = {
  before: { level: number; into: number; span: number }
  after: { level: number; into: number; span: number }
}

export type ResultsDTO = {
  shell: LearnerShell
  attemptId: string
  subject: Subject
  title: string
  meta: string
  scoreLabel: string
  scoreValue: number
  scoreMax: number
  /** Skala 100 dan garis batas, untuk ESMO. */
  scaled: { value: number; target: number } | null
  headline: string
  detail: string
  timeUsedSec: number
  timeLimitSec: number | null
  xp: number
  newBadges: { id: string; title: string; description: string }[]
  questions: ResultQuestion[]
  strongest: { topic: string; line: string } | null
  weakest: { topic: string; line: string } | null
  byTopic: { label: string; right: number; total: number }[]
  reviewHref: string
  backHref: string
  backLabel: string
  tone: 'full' | 'normal' | 'low'
  /** Ulang sesi: null bila sesi ini tidak bisa diulang. */
  retry: RetryDTO | null
  /** Bar XP di perayaan akhir sesi. Kosong: bar tidak ditampilkan. */
  xpBar?: XpBarDTO
}

export type RetryDTO = {
  /** Percobaan ini adalah ulangan (bukan yang resmi). */
  isRetry: boolean
  /** Nomor ulangan, 0 untuk percobaan pertama. */
  retryNo: number
  /** Skor percobaan pertama, yang dipakai untuk laporan dan streak. */
  official: string
  /** Skor terbaik dari semua percobaan, atau null bila baru satu percobaan. */
  best: string | null
  /** Ulangan memberi 25 persen XP. */
  xpNote: string
  /** Ada ulangan yang belum selesai; tombol melanjutkannya. */
  continueOpen: boolean
}

export type ReviewQuestionDTO = {
  position: number
  item: ClientItem
  yourAnswerText: string
  correctAnswerText: string
  status: 'correct' | 'wrong' | 'blank' | 'pending'
  explanation: string
  whyYourAnswer: string | null
  tip: string | null
  solution: SolutionStep[] | null
  tutorFeedback: string | null
  similarHref: string | null
}

export type ReviewDTO = {
  shell: LearnerShell
  attemptId: string
  title: string
  subject: Subject
  questions: ReviewQuestionDTO[]
  openPosition: number
  backHref: string
}

// L14 Selesai hari ini
export type DoneTodayDTO = {
  shell: LearnerShell
  variant: 'all-done' | 'time-limit'
  title: string
  line: string
  xpToday: number
  minutesToday: number
  quests: { subject: Subject; session: string; title: string; score: string; required: boolean }[]
  tomorrow: string
  answersHref: string | null
  streak: StreakDTO
}

// L09 Peta belajar
export type MapSkillDTO = {
  id: string
  title: string
  canDo: string
  state: 'locked' | 'new' | 'learning' | 'review' | 'mastered'
  stars: 0 | 1 | 2 | 3
  isToday: boolean
  lessonHref: string | null
  practiseHref: string | null
}
export type MapDTO = {
  shell: LearnerShell
  grade: number
  subjects: { subject: Subject; chapters: { title: string; skills: MapSkillDTO[] }[] }[]
  selectedSubject: Subject
}

// L10 Me
export type MeDTO = {
  shell: LearnerShell
  level: number
  xp: number
  xpIntoLevel: number
  xpLevelSpan: number
  xpToNext: number
  badges: { id: string; title: string; description: string; earnedAt: string | null; isNew: boolean; glyph?: string }[]
  /** Tiga bar XP dengan level per jalur. */
  tracks?: XpTrackDTO[]
  accessories?: AccessoryDTO[]
  monthLabel: string
  calendar: { date: string; day: number; status: DayStatus; inMonth: boolean }[]
  streakLine: string
  avatars: AvatarName[]
}
export type MeActions = {
  changeAvatar(avatar: AvatarName): Promise<ActionResult>
  changeAccessory?(accessory: AccessoryId | null): Promise<ActionResult>
}

// L11 Buku Koreksi
export type CorrectionBookDTO = {
  shell: LearnerShell
  dueCount: number
  groups: { subject: Subject; title: string; count: number; note: string }[]
  cards: { subject: Subject; prompt: string; meta: string }[]
  comingBack: string | null
  startHref: string | null
}

// L12 Pelajaran
export type LessonDTO = {
  shell: LearnerShell
  skillId: string
  subject: Subject
  title: string
  meta: string
  steps: SolutionStep[]
  check: ClientItem[]
  practiseHref: string
  backHref: string
}
export type LessonActions = { completeLesson(skillId: string, correct: number, total: number): Promise<ActionResult> }

// L13 Simulator lomba
export type CompetitionPresetCard = {
  presetId: string
  title: string
  subjectLine: string
  formatLines: string[]
  verified: boolean
  lastTry: string | null
  href: string
}
export type CompetitionPickDTO = { shell: LearnerShell; presets: CompetitionPresetCard[] }
export type CompetitionIntroDTO = {
  shell: LearnerShell
  presetId: string
  title: string
  sub: string
  verified: boolean
  rules: string[]
  tip: string | null
  questionCount: number
  timeLimitSec: number
  optionCount: 4 | 5
  startLabel: string
}
export type CompetitionActions = { startSimulation(presetId: string): Promise<ActionResult<{ redirectTo: string }>> }

// L15 Paket ESMO
export type EsmoPack = { id: string; num: number; status: 'new' | 'in-progress' | 'done'; score: number | null; href: string }
export type EsmoDTO = {
  shell: LearnerShell
  finalName: string
  finalDate: string | null
  daysToGo: number | null
  columns: {
    subject: 'math' | 'english'
    name: string
    langNote: string
    doneLine: string
    packs: EsmoPack[]
    mockMeta: string
    mockHref: string
  }[]
}
export type EsmoActions = { startPack(packId: string): Promise<ActionResult<{ redirectTo: string }>>; startMock(subject: 'math' | 'english'): Promise<ActionResult<{ redirectTo: string }>> }

// ---------------------------------------------------------------------------
// Konsol tutor

export type ConsoleShell = {
  userName: string
  orgName: string
  role: 'tutor' | 'guardian'
  learners: { id: string; name: string; grade: number }[]
  currentLearnerId: string | null
  aiEnabled: boolean
}

export type AttentionItem = {
  id: string
  kind: 'skill-low' | 'needs-grading' | 'registration' | 'consent' | 'sync' | 'problem-report' | 'ai-draft'
  title: string
  detail: string
  actionLabel: string
  href: string
}

export type SubjectTodayStatus = {
  subject: Subject
  questTitle: string | null
  state: 'not-started' | 'in-progress' | 'done' | 'rest' | 'not-planned'
  answered: number
  total: number
  accuracy: number | null
  minutes: number
  syncedAt: string | null
}

export type TrendPoint = { weekStart: string; label: string; accuracy: number | null; answers: number }

export type TutorTodayDTO = {
  shell: ConsoleShell
  dateLabel: string
  learner: { id: string; name: string; grade: number } | null
  attention: AttentionItem[]
  today: SubjectTodayStatus[]
  trend: { subject: Subject; points: TrendPoint[] }[]
  partial: string[]
  upcoming: { name: string; date: string; daysToGo: number; registrationClose: string | null }[]
}

// T02 Detail learner
export type HeatCell = { weekStart: string; accuracy: number | null; answers: number; gate: 'new' | 'reteach' | 'review' | 'mastered' }
export type LearnerDetailDTO = {
  shell: ConsoleShell
  learner: { id: string; name: string; grade: number; avatar: AvatarName; since: string; xp: number; level: number; streak: number }
  weeks: { weekStart: string; label: string }[]
  heatmap: { subject: Subject; skills: { id: string; title: string; stars: number; cells: HeatCell[] }[] }[]
  attempts: { id: string; date: string; title: string; subject: Subject; score: string; minutes: number; href: string }[]
  notes: { id: string; author: string; date: string; body: string }[]
  /** Ringkasan arena (Quick Maths dan Quiz Arena) untuk tutor. */
  arena?: ArenaTutorDTO
}
export type LearnerDetailActions = { addNote(learnerId: string, body: string): Promise<ActionResult> }

// T03 Perencana mingguan
export type DayTemplateId = 'school' | 'saturday' | 'light'
export type PlanSlotConfig = { presetId?: string; task?: 'listening' | 'reading' | 'writing' | 'speaking'; perQuestionSec?: number }
export type PlanSlotDTO = {
  /** Id slot, atau auto:<tanggal>:<mapel>:<sesi>:<n> untuk sesi dari template yang belum punya slot. */
  id: string
  /** Sesi dari template hari yang dipilih Kira saat dibuka; belum ada slot di database. */
  auto: boolean
  /** Slot berisi paper dari Penyusun paper (isinya diubah di sana, di rencana hanya dipindah atau dihapus). */
  fromPaper: boolean
  date: string
  subject: Subject
  kind: 'quest' | 'bonus' | 'rest'
  session: SessionType
  /** Sesi wajib dihitung untuk streak; sesi opsional tidak. */
  required: boolean
  paperKind: 'mini' | 'full' | null
  skillId: string | null
  title: string
  mode: 'belajar' | 'latihan' | 'tes' | 'kertas'
  minutes: number
  questionCount: number
  config: PlanSlotConfig | null
}
export type PlannerDay = {
  date: string
  label: string
  rest: boolean
  /** Menit semua sesi hari itu, wajib dan opsional. */
  totalMinutes: number
  /** Menit sesi wajib saja. */
  requiredMinutes: number
  overLimit: boolean
  template: DayTemplateId
  templateLabel: string
  requiredCount: number
  extraCount: number
}
export type PlannerDTO = {
  shell: ConsoleShell
  learnerId: string
  weekStart: string
  weekLabel: string
  status: 'draft' | 'published'
  days: PlannerDay[]
  slots: PlanSlotDTO[]
  suggestions: { id: string; date: string; subject: Subject; skillId: string; title: string; reason: string }[]
  skills: { id: string; subject: Subject; grade: number; title: string; stars: number; hasLesson: boolean }[]
  /** Preset lomba untuk sesi Simulasi lomba. */
  presets: { id: string; subject: Subject; title: string; minutes: number }[]
  screenLimitMin: number
  prevWeekHref: string
  nextWeekHref: string
}
export type UpsertSlotInput = {
  learnerId: string
  slotId?: string
  date: string
  subject: Subject
  session: SessionType
  required: boolean
  skillId: string | null
  mode: PlanSlotDTO['mode']
  questionCount: number
  paperKind: 'mini' | 'full' | null
  config: PlanSlotConfig | null
}
export type PlannerActions = {
  upsertSlot(input: UpsertSlotInput): Promise<ActionResult>
  moveSlot(input: { slotId: string; date: string }): Promise<ActionResult>
  deleteSlot(slotId: string): Promise<ActionResult>
  setRestDay(input: { learnerId: string; date: string; rest: boolean }): Promise<ActionResult>
  applySuggestions(input: { learnerId: string; weekStart: string; ids: string[] }): Promise<ActionResult>
  publishWeek(input: { learnerId: string; weekStart: string }): Promise<ActionResult>
  setDayTemplate(input: { learnerId: string; date: string; template: DayTemplateId }): Promise<ActionResult>
  copyWeek(input: { learnerId: string; fromWeekStart: string; toWeekStart: string }): Promise<ActionResult<{ copied: number; skipped: number }>>
}

// T04 Penyusun paper
export type BankItemRow = {
  ref: string
  subject: Subject
  grade: number
  skillId: string
  skillTitle: string
  type: string
  difficulty: number
  promptPreview: string
  source: 'kira-original' | 'imported' | 'ai-draft' | 'tutor' | 'generator'
  tags: string[]
  attempts: number
  accuracy: number | null
  reports: number
}
export type PaperDTO = {
  id: string
  title: string
  subject: Subject
  grade: number
  minutes: number
  mode: 'latihan' | 'tes' | 'kertas'
  presetId: string | null
  itemRefs: string[]
  createdAt: string
  code: string
}
export type PaperBuilderDTO = {
  shell: ConsoleShell
  paper: PaperDTO | null
  items: (BankItemRow & { preview: ClientItem })[]
  presets: { id: string; title: string }[]
  papers: PaperDTO[]
  /** Isi awal paper baru, misalnya dari Tambah ke paper di bank soal (?tambah=). */
  draftRefs?: string[]
}
export type PaperBuilderActions = {
  savePaper(input: { paperId?: string; title: string; subject: Subject; grade: number; minutes: number; mode: PaperDTO['mode']; itemRefs: string[] }): Promise<ActionResult<{ paperId: string }>>
  /** `items` membawa pratinjau soal terpilih yang belum ada di `PaperBuilderDTO.items` (instans generator baru). */
  generatePaper(input: { subject: Subject; grade: number; skillIds: string[]; count: number; difficulty: [number, number] }): Promise<ActionResult<{ itemRefs: string[]; items?: (BankItemRow & { preview: ClientItem })[] }>>
  assignPaper(input: { paperId: string; learnerId: string; date: string }): Promise<ActionResult>
  deletePaper(paperId: string): Promise<ActionResult>
}

// T05 Kotak hasil dan penilaian
export type InboxRow = {
  responseId: string
  learnerName: string
  subject: Subject
  itemTitle: string
  type: 'write' | 'speak' | 'draw' | 'photo'
  submittedAt: string
  status: 'waiting' | 'graded'
  score: number | null
  max: number
}
export type GradingDTO = {
  responseId: string
  learnerName: string
  prompt: string
  item: ClientItem
  answerText: string | null
  mediaUrl: string | null
  mediaKind: 'audio' | 'image' | null
  rubric: { label: string; points: number }[]
  scores: number[] | null
  feedback: string | null
  aiSuggestion: { scores: number[]; feedback: string; confidence: string; createdAt: string } | null
}
export type InboxDTO = { shell: ConsoleShell; filter: 'waiting' | 'graded'; rows: InboxRow[]; selected: GradingDTO | null }
export type InboxActions = {
  grade(input: { responseId: string; scores: number[]; feedback: string; acceptedAi: boolean }): Promise<ActionResult>
  requestAiSuggestion(responseId: string): Promise<ActionResult>
}

// T06 Input LJK
export type LjkDTO = {
  shell: ConsoleShell
  sheets: { attemptId: string; code: string; title: string; learnerName: string; questionCount: number; optionCount: 4 | 5; shortAnswerFrom: number | null; entered: number }[]
  selected: { attemptId: string; code: string; title: string; learnerName: string; questionCount: number; optionCount: 4 | 5; shortAnswerFrom: number | null; answers: (string | null)[] } | null
}
export type LjkActions = { saveLjk(input: { attemptId: string; answers: (string | null)[]; submit: boolean }): Promise<ActionResult<{ score: string }>> }

// T07 Bank soal
export type ItemBankDTO = {
  shell: ConsoleShell
  rows: BankItemRow[]
  total: number
  page: number
  pageSize: number
  filters: { subject: Subject | null; grade: number | null; skillId: string | null; type: string | null; difficulty: number | null; source: string | null; q: string }
  facets: { skills: { id: string; title: string; subject: Subject; grade: number }[] }
  preview: { row: BankItemRow; item: ClientItem; answerText: string; explanation: string; hints: string[] } | null
}

// T08 Kalender lomba
export type CompetitionRow = {
  id: string
  name: string
  subjectLine: string
  date: string | null
  dateLabel: string
  dateIsEstimate: boolean
  registrationClose: string | null
  status: 'not-open' | 'not-registered' | 'registered' | 'done' | 'skip' | 'check'
  presetLabel: string
  presetVerified: boolean | null
  link: string | null
  learnerIds: string[]
  /** Id katalog dan preset tersimpan, supaya form Ubah tidak menebak dari nama. */
  competitionId?: string | null
  presetId?: string | null
}
export type CompetitionCalendarDTO = {
  shell: ConsoleShell
  todayLabel: string
  months: { key: string; name: string; rows: { id: string; name: string; when: string }[] }[]
  rows: CompetitionRow[]
  catalog: { id: string; name: string; organizer: string; format: string; verified: boolean; website: string | null }[]
  presets: { id: string; title: string; verified: boolean }[]
}
export type CompetitionCalendarActions = {
  saveEvent(input: { eventId?: string; competitionId: string | null; name: string; subjects: Subject[]; date: string | null; dateIsEstimate: boolean; registrationClose: string | null; presetId: string | null; link: string | null; learnerIds: string[] }): Promise<ActionResult>
  setStatus(input: { eventId: string; status: CompetitionRow['status'] }): Promise<ActionResult>
  deleteEvent(eventId: string): Promise<ActionResult>
}

// T09 Laporan dan ekspor
export type ReportDTO = {
  shell: ConsoleShell
  learnerId: string
  weekStart: string
  weekLabel: string
  markdown: string
  summary: WeekSummaryDTO
  outbox: { id: string; to: string; subject: string; status: 'queued' | 'sent' | 'failed' | 'no-smtp'; createdAt: string }[]
  /** Waktu laporan minggu ini terakhir dikirim (week_report.sent_at), supaya status Terkirim bertahan setelah muat ulang. */
  sentAt?: string | null
}
export type ReportActions = {
  sendReport(input: { learnerId: string; weekStart: string; note: string }): Promise<ActionResult>
  exportJson(learnerId: string): Promise<ActionResult<{ filename: string; json: string }>>
}

// T10 Pengaturan
export type SettingsDTO = {
  shell: ConsoleShell
  account: { name: string; email: string; passkeys: { id: string; name: string; createdAt: string; lastUsedAt: string | null }[] }
  devices: { id: string; name: string; learners: string[]; createdAt: string; lastSeenAt: string | null; expiresAt: string }[]
  learners: { id: string; name: string; screenLimitMin: number; restWeekdays: number[]; reviewEnabled: boolean }[]
  members: { id: string; name: string; email: string; role: 'tutor' | 'guardian'; learners: string[] }[]
  invites: { id: string; email: string; role: 'tutor' | 'guardian'; expiresAt: string }[]
  email: { configured: boolean; from: string | null }
  backups: { lastAt: string | null; lastSize: string | null; folder: string }
  /** APK tablet di <KIRA_DATA_DIR>/apk/kira.apk, diunduh lewat /api/apk. */
  apk?: { available: boolean; size: string | null; updatedAt: string | null }
}
export type SettingsActions = {
  updateLearnerLimits(input: { learnerId: string; screenLimitMin: number; restWeekdays: number[]; reviewEnabled: boolean }): Promise<ActionResult>
  revokeDevice(deviceId: string): Promise<ActionResult>
  renameDevice(input: { deviceId: string; name: string }): Promise<ActionResult>
  registerThisDevice(input: { name: string; learnerIds: string[] }): Promise<ActionResult>
  removePasskey(passkeyId: string): Promise<ActionResult>
  inviteMember(input: { email: string; role: 'tutor' | 'guardian'; learnerIds: string[] }): Promise<ActionResult<{ link: string }>>
  revokeInvite(inviteId: string): Promise<ActionResult>
  changePassword(input: { current: string; next: string }): Promise<ActionResult>
}

// T11 Studio AI
export type AiDraftDTO = {
  id: string
  jobId: string
  kind: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
  item: ClientItem | null
  json: string
  problems: string[]
  compareTo: { ref: string; item: ClientItem } | null
}
export type StudioAiDTO = {
  shell: ConsoleShell
  provider: { name: string; ready: boolean; detail: string }
  usage: { used: number; limit: number }
  jobs: { id: string; kind: string; status: 'queued' | 'running' | 'done' | 'failed'; createdAt: string; summary: string; error: string | null }[]
  drafts: AiDraftDTO[]
  skills: { id: string; subject: Subject; grade: number; title: string }[]
}
export type StudioAiActions = {
  requestDrafts(input: { kind: 'items' | 'variants' | 'hints' | 'translate' | 'rubric'; skillId: string; count: number; difficulty: number; itemRef?: string; instructions: string }): Promise<ActionResult>
  approveDraft(input: { draftId: string; json: string }): Promise<ActionResult<{ ref: string }>>
  rejectDraft(draftId: string): Promise<ActionResult>
}

// T12 Impor paket resmi
export type ImportItemDTO = {
  index: number
  number: number
  prompt: string
  options: string[]
  answer: number | null
  answerFromKey: number | null
  figureNote: string | null
  pageImage: string | null
  status: 'ok' | 'key-mismatch' | 'leftover-key-text' | 'broken-fraction' | 'needs-check'
  approved: boolean
  /** Hasil pemeriksaan kunci oleh AI (lihat ImportStoredItem.keyCheck) dan jawaban AI sebagai indeks opsi. */
  keyCheck: 'agree' | 'disagree' | 'ai-only' | 'skipped' | null
  aiAnswer: number | null
  /** Gambar soal hasil potong dari halaman PDF. */
  figure: { url: string; width: number; height: number; alt: string } | null
}
/** Data paper lomba pada paket impor (migrasi 0009). */
export type ImportMetaDTO = { competition: string | null; year: number | null; section: string | null; originalMinutes: number | null; source: string | null }
export type ImportDTO = {
  shell: ConsoleShell
  /** `error`: pesan worker (bahasa Indonesia) bila paket gagal dibaca. */
  batches: { id: string; title: string; status: 'uploaded' | 'parsing' | 'review' | 'done' | 'failed'; createdAt: string; itemCount: number; approved: number; error?: string | null }[]
  selected: { id: string; title: string; subject: Subject; grade: number; tags: string[]; pages: string[]; items: ImportItemDTO[]; meta: ImportMetaDTO } | null
  /** Pilihan lomba untuk isian data paper. */
  competitions: { id: string; name: string }[]
}
export type ImportActions = {
  uploadPdf(form: FormData): Promise<ActionResult<{ batchId: string }>>
  updateImportItem(input: { batchId: string; index: number; prompt: string; options: string[]; answer: number | null }): Promise<ActionResult>
  approveImportItems(input: { batchId: string; indexes: number[] }): Promise<ActionResult<{ created: number }>>
  updateImportMeta(input: { batchId: string } & ImportMetaDTO): Promise<ActionResult>
  /** Potong gambar dari halaman PDF (kotak pecahan 0 sampai 1) dan pasang ke satu soal. */
  attachFigure(input: { batchId: string; index: number; page: number; rect: { x: number; y: number; w: number; h: number }; alt: string }): Promise<ActionResult<{ url: string }>>
  removeFigure(input: { batchId: string; index: number }): Promise<ActionResult>
}

// T13 Learner dan grade
export type LearnersDTO = {
  shell: ConsoleShell
  learners: { id: string; name: string; grade: number; avatar: AvatarName; active: boolean; consent: 'granted' | 'pending' | 'withdrawn'; guardians: string[]; devices: number; since: string }[]
  maxLearners: number
}
export type LearnersActions = {
  addLearner(input: { name: string; grade: number; avatar: AvatarName; pin: PinPicture[]; guardianEmail: string | null }): Promise<ActionResult<{ learnerId: string; inviteLink: string | null }>>
  updateLearner(input: { learnerId: string; name: string; grade: number; avatar: AvatarName }): Promise<ActionResult>
  resetPin(input: { learnerId: string; pin: PinPicture[] }): Promise<ActionResult>
  unlockLearner(learnerId: string): Promise<ActionResult>
  recordOfflineConsent(input: { learnerId: string; guardianName: string; method: string; date: string; purposes: string[] }): Promise<ActionResult>
}

// T14 Koneksi Claude
export type ClaudeConnectionDTO = {
  shell: ConsoleShell
  provider: 'claude-code' | 'openai-compatible' | 'none'
  status: 'connected' | 'not-configured' | 'error'
  detail: string
  lastCheckAt: string | null
  mcp: { enabled: boolean; url: string; tokens: { id: string; name: string; createdAt: string; lastUsedAt: string | null }[] }
}
export type ClaudeConnectionActions = {
  testConnection(): Promise<ActionResult<{ detail: string }>>
  createMcpToken(name: string): Promise<ActionResult<{ token: string }>>
  revokeMcpToken(tokenId: string): Promise<ActionResult>
}

// ---------------------------------------------------------------------------
// Orang tua

export type WeekSummaryDTO = {
  learnerName: string
  weekLabel: string
  firstWeek: boolean
  minutes: number
  minutesPerDay: { label: string; minutes: number }[]
  questsDone: number
  questsPlanned: number
  skillsUp: { subject: Subject; title: string; stars: number }[]
  skillsToRepeat: { subject: Subject; title: string; note: string }[]
  tutorNote: string | null
  nextCompetition: { name: string; date: string } | null
}
export type FamilyHomeDTO = {
  shell: ConsoleShell
  learners: { id: string; name: string }[]
  selectedLearnerId: string
  summary: WeekSummaryDTO
  prevWeekHref: string | null
  nextWeekHref: string | null
}

export type ConsentPurpose = {
  id: 'learning' | 'progress-email' | 'audio' | 'photo' | 'ai-drafts'
  title: string
  description: string
  required: boolean
  granted: boolean
  grantedAt: string | null
}
export type PrivacyDTO = {
  shell: ConsoleShell
  learner: { id: string; name: string; active: boolean }
  noticeVersion: string
  purposes: ConsentPurpose[]
  history: { date: string; text: string }[]
  retention: { label: string; value: string }[]
  deletion: { requestedAt: string | null; scheduledFor: string | null }
}
export type PrivacyActions = {
  setConsent(input: { learnerId: string; purpose: ConsentPurpose['id']; granted: boolean }): Promise<ActionResult>
  exportData(learnerId: string): Promise<ActionResult<{ filename: string; json: string }>>
  requestDeletion(input: { learnerId: string; confirmName: string }): Promise<ActionResult<{ reference: string; scheduledFor: string }>>
  cancelDeletion(learnerId: string): Promise<ActionResult>
}

// ---------------------------------------------------------------------------
// Halaman cetak

export type PrintPaperDTO = {
  code: string
  title: string
  subject: Subject
  subjectLabel: string
  grade: number
  minutes: number
  instructions: string[]
  learnerName: string | null
  date: string | null
  sections: { title: string; items: { number: number; item: ClientItem; answerText?: string; explanation?: string }[] }[]
  withKey: boolean
}

export type PrintLjkDTO = {
  code: string
  title: string
  questionCount: number
  optionCount: 4 | 5
  shortAnswerFrom: number | null
  qrDataUrl: string
}

/** Figur juga dipakai di DTO cetak. */
export type { FigureSpec }

// ---------------------------------------------------------------------------
// Publik: masuk, setup, reset, undangan, daftar perangkat, error

export type LoginScreenProps = {
  next: string | null
  notice: 'locked' | 'reset-done' | 'signed-out' | 'session-expired' | 'invite-accepted' | null
  passwordLogin(input: { email: string; password: string; next: string | null }): Promise<ActionResult<{ redirectTo: string }>>
  /** Upacara WebAuthn dijalankan di client oleh pembungkus; layar hanya memanggilnya. */
  passkeyLogin(next: string | null): Promise<ActionResult<{ redirectTo: string }>>
  passkeySupported: boolean
  requestReset(email: string): Promise<ActionResult>
}

export type SetupScreenProps = {
  createOrg(input: { setupToken: string; orgName: string; name: string; email: string; password: string }): Promise<ActionResult<{ redirectTo: string }>>
}

export type ResetPasswordScreenProps = {
  token: string
  valid: boolean
  resetPassword(input: { token: string; password: string }): Promise<ActionResult<{ redirectTo: string }>>
}

export type AcceptInviteScreenProps = {
  token: string
  invite: { orgName: string; email: string; role: 'tutor' | 'guardian'; learnerNames: string[]; expiresAt: string } | null
  acceptInvite(input: { token: string; name: string; password: string }): Promise<ActionResult<{ redirectTo: string }>>
}

export type RegisterDeviceScreenProps = {
  learners: { id: string; name: string; avatar: AvatarName }[]
  registered: { name: string; learnerNames: string[] } | null
  registerDevice(input: { name: string; learnerIds: string[] }): Promise<ActionResult<{ redirectTo: string }>>
}

export type ErrorScreenProps = {
  kind: '404' | '500' | 'offline' | 'forbidden'
  reference: string | null
  homeHref: string
  lang: 'id' | 'en-GB'
  retry?: () => void
}

/** Ditambahkan oleh pembungkus passkey di konsol (T10) untuk mendaftarkan passkey baru. */
export type PasskeyRegisterFn = (name: string) => Promise<ActionResult>
