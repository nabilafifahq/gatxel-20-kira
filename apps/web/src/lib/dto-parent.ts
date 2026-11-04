import type { FeatureMap } from '@kira/core/features'
import type { AvatarName, DayPresetId, DayRulesDTO, Subject, WeekSummaryDTO } from './dto'
import type { ArenaTutorDTO, XpTrackDTO } from './dto-arena'

/**
 * Dashboard orang tua (/keluarga). Teks untuk orang tua dalam bahasa Indonesia. Semua data dibaca lewat
 * withFamilyAdmin, jadi hanya anak yang tertaut lewat guardian_link yang pernah masuk ke DTO ini.
 */

export type ParentChildStatus = 'rest' | 'none' | 'not-started' | 'in-progress' | 'done'

export type ParentChildCard = {
  id: string
  name: string
  grade: number
  avatar: AvatarName
  status: ParentChildStatus
  statusLabel: string
  requiredDone: number
  requiredTotal: number
  optionalDone: number
  optionalTotal: number
  streak: number
  minutesToday: number
  screenLimitMin: number
  xp: number
  level: number
  tracks: XpTrackDTO[]
  /** Anak belum aktif karena persetujuan orang tua belum diberikan. */
  active: boolean
  href: string
}

export type ParentHomeDTO = {
  parentName: string
  familyName: string
  children: ParentChildCard[]
  maxChildren: number
  apk: { available: boolean; size: string | null }
  /** Keluarga ini punya tutor (keluarga lama): tombol tambah anak dan nilai jawaban terbuka berbeda. */
  hasTutor: boolean
}

export type ParentSessionDTO = {
  /** Id sesi hari ini (quest). */
  questId: string
  subject: Subject
  /** Latihan, Tes, Paper, atau nama sesi lain. */
  label: string
  session: string
  required: boolean
  state: 'ready' | 'in-progress' | 'done'
  /** Sesi sudah dimulai: isinya tidak bisa diganti, hanya Wajib atau Opsional. */
  started: boolean
  score: string | null
  questionCount: number | null
  /** Jenis sesi inti (Latihan, Tes, Paper) yang bisa dijadikan Wajib atau Opsional. */
  core: boolean
  attemptId: string | null
  /** Hasil per soal tersedia setelah dikumpulkan. */
  resultHref: string | null
}

export type ParentSkillDTO = { id: string; title: string; stars: number; mastery: number; state: 'baru' | 'diulang' | 'ditinjau' | 'dikuasai'; answered: number }

export type ParentWorkDTO = {
  responseId: string
  attemptId: string
  subject: Subject
  title: string
  prompt: string
  type: 'write' | 'speak' | 'draw' | 'photo'
  text: string | null
  mediaId: string | null
  status: 'pending' | 'correct' | 'wrong'
  criteria: { label: string; points: number }[]
  feedback: string | null
}

export type ParentChildDTO = {
  parentName: string
  familyName: string
  card: ParentChildCard
  hasTutor: boolean
  today: { date: string; sessions: ParentSessionDTO[] }
  skillMap: { subject: Subject; label: string; skills: ParentSkillDTO[] }[]
  weakSkills: { subject: Subject; title: string; note: string }[]
  fixIt: { open: number; cleared: number; bySkill: { title: string; subject: Subject; count: number }[] }
  arena: ArenaTutorDTO | null
  week: WeekSummaryDTO
  attempts: { id: string; date: string; title: string; subject: Subject; score: string; minutes: number; href: string }[]
  work: ParentWorkDTO[]
  controls: {
    screenLimitMin: number
    restWeekdays: number[]
    soundEnabled: boolean
    musicEnabled: boolean
    dayPreset: DayPresetId
    features: FeatureMap
    dayRules: DayRulesDTO
    streak: number
    grade: number
    avatar: AvatarName
  }
}

export type ParentResultRow = {
  position: number
  skillTitle: string
  prompt: string
  yourAnswer: string
  correctAnswer: string
  explanation: string | null
  status: 'correct' | 'wrong' | 'blank' | 'pending'
  tries: number
  manual: boolean
}

export type ParentResultDTO = {
  learner: { id: string; name: string }
  attempt: { id: string; title: string; subject: Subject; date: string; score: string; submitted: boolean }
  rows: ParentResultRow[]
}

