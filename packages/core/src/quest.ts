import { CHALLENGE_BAND, CORE_BAND, LEARN_BAND, pickItems, type Candidate } from './picker'
import type { Gate } from './gates'
import type { Rng } from './rng'

export const SUBJECTS = ['math', 'english', 'science'] as const
export type Subject = (typeof SUBJECTS)[number]

export const MODES = ['belajar', 'latihan', 'kilat', 'tes', 'simulasi', 'kertas', 'review'] as const
export type Mode = (typeof MODES)[number]

export type Section = 'warmup' | 'core' | 'challenge' | 'sprint'

export type QuestSlot = { ref: string; section: Section; difficulty: number }

export const DEFAULT_QUEST_LENGTH = 10
export const MAX_WARMUP = 3

/** Mode yang menampilkan kunci dan umpan balik langsung. */
export function modeShowsFeedback(mode: Mode): boolean {
  return mode === 'belajar' || mode === 'latihan' || mode === 'kilat' || mode === 'review'
}

/** Mode yang boleh membuka hint. */
export function modeAllowsHints(mode: Mode): boolean {
  return mode === 'belajar' || mode === 'latihan' || mode === 'review'
}

/** Kunci jawaban boleh dikirim ke perangkat sebelum dikumpulkan hanya untuk mode latihan. */
export function modeMaySendKey(mode: Mode): boolean {
  return modeShowsFeedback(mode)
}

/**
 * Susun quest harian: pemanasan dari kartu Buku Koreksi (paling banyak 3),
 * soal inti di pita 0,75 sampai 0,85, lalu satu soal tantangan di 0,55 sampai 0,70.
 * Mode Belajar memakai pita lebih mudah (0,80 sampai 0,90) dan tanpa tantangan.
 */
export function assembleQuest(input: {
  mode: 'belajar' | 'latihan'
  theta: number
  dueRefs: readonly { ref: string; difficulty: number }[]
  candidates: readonly Candidate[]
  challengeCandidates?: readonly Candidate[]
  length?: number
  rng: Rng
}): QuestSlot[] {
  const length = input.length ?? DEFAULT_QUEST_LENGTH
  const slots: QuestSlot[] = []
  const used = new Set<string>()

  for (const due of input.dueRefs.slice(0, Math.min(MAX_WARMUP, Math.max(0, length - 4)))) {
    slots.push({ ref: due.ref, section: 'warmup', difficulty: due.difficulty })
    used.add(due.ref)
  }

  const challengeCount = input.mode === 'latihan' && length >= 6 ? 1 : 0
  const coreCount = length - slots.length - challengeCount
  const core = pickItems({
    candidates: input.candidates,
    theta: input.theta,
    count: coreCount,
    band: input.mode === 'belajar' ? LEARN_BAND : CORE_BAND,
    rng: input.rng,
    exclude: used,
  })
  // Urutkan inti dari mudah ke sulit supaya awal quest terasa ringan.
  core.sort((a, b) => b.p - a.p)
  for (const c of core) {
    slots.push({ ref: c.candidate.ref, section: 'core', difficulty: c.candidate.difficulty })
    if (!c.candidate.unlimited) used.add(c.candidate.ref)
  }

  if (challengeCount > 0) {
    const pool = input.challengeCandidates?.length ? input.challengeCandidates : input.candidates
    const [challenge] = pickItems({
      candidates: pool,
      theta: input.theta,
      count: 1,
      band: CHALLENGE_BAND,
      rng: input.rng,
      exclude: used,
    })
    if (challenge) slots.push({ ref: challenge.candidate.ref, section: 'challenge', difficulty: challenge.candidate.difficulty })
  }
  return slots
}

export type SkillProgress = {
  id: string
  order: number
  gate: Gate
  prerequisites: readonly string[]
  lastPracticed?: string | null
}

/**
 * Pilih skill untuk quest hari ini bila tutor belum merencanakan.
 * Urutan: skill reteach yang sedang berjalan, lalu skill baru berikutnya yang
 * prasyaratnya sudah review atau mastered, lalu skill review, lalu skill mastered untuk pemeliharaan.
 */
export function chooseSkill(skills: readonly SkillProgress[], rng: Rng): SkillProgress | undefined {
  if (skills.length === 0) return undefined
  const byId = new Map(skills.map((s) => [s.id, s]))
  const ordered = [...skills].sort((a, b) => a.order - b.order)
  const ready = (s: SkillProgress) =>
    s.prerequisites.every((p) => {
      const pre = byId.get(p)
      return pre === undefined || pre.gate === 'review' || pre.gate === 'mastered'
    })

  const reteach = ordered.filter((s) => s.gate === 'reteach')
  if (reteach.length > 0) {
    return reteach.sort((a, b) => (b.lastPracticed ?? '').localeCompare(a.lastPracticed ?? ''))[0]
  }
  const fresh = ordered.find((s) => s.gate === 'new' && ready(s))
  if (fresh) return fresh
  const review = ordered.filter((s) => s.gate === 'review')
  if (review.length > 0) {
    return review.sort((a, b) => (a.lastPracticed ?? '').localeCompare(b.lastPracticed ?? ''))[0]
  }
  const anyNew = ordered.find((s) => s.gate === 'new')
  if (anyNew) return anyNew
  return rng.pick(ordered)
}

/** Perkiraan menit: 1,5 menit per soal, dibulatkan ke 5 menit. */
export function estimateMinutes(questionCount: number, perQuestion = 1.5): number {
  return Math.max(5, Math.round((questionCount * perQuestion) / 5) * 5)
}
