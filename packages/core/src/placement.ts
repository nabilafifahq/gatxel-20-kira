import { difficultyToB, initialTheta, pCorrect, updateTheta } from './ability'
import type { Rng } from './rng'

/**
 * Tes penempatan: tes adaptif pendek (8 sampai 12 soal) per mapel dengan model Rasch yang sama dengan mesin belajar.
 * Modul ini murni. Tingkat soal dipetakan ke satu skala: b = (kelas - 3,5) * 0,6 + b(kesulitan) * 0,4, jadi satu
 * kelas kira-kira 0,6 logit. Mulai dari kelas yang disebut orang tua, naik atau turun antar kelas, berhenti saat
 * perkiraan stabil. Hasilnya perkiraan kasar, bukan penilaian resmi.
 */

export const PLACEMENT_MIN = 8
export const PLACEMENT_MAX = 12
/** Retake hanya boleh sekali sebulan. */
export const PLACEMENT_RETAKE_DAYS = 30
/** Learner yang dibuat sebelum tanggal ini tidak pernah ditanya otomatis (misalnya keluarga lama). */
export const PLACEMENT_AUTO_SINCE = '2026-11-05T00:00:00+07:00'

const LOGIT_PER_GRADE = 0.6
const THETA_CAP = 2.2
/** Peluang benar yang dicari: cukup menantang, tidak membuat anak merasa gagal. */
const TARGET_P = 0.62
const STABLE_RANGE = 0.4

export type PlacementSubject = 'math' | 'english' | 'science'

export function gradeToTheta(grade: number): number {
  return (grade - 3.5) * LOGIT_PER_GRADE
}

/** Kelas kontinu 1 sampai 6 dari theta. */
export function thetaToGrade(theta: number): number {
  return Math.min(6, Math.max(1, 3.5 + theta / LOGIT_PER_GRADE))
}

export function itemB(grade: number, difficulty: number): number {
  return gradeToTheta(grade) + difficultyToB(difficulty) * 0.4
}

// ---------------------------------------------------------------------------
// Kelompok strand untuk peta kekuatan

export type StrandGroup = { id: string; label: string }

const GROUPS: Record<string, StrandGroup> = {
  num: { id: 'num', label: 'Bilangan' },
  geo: { id: 'geo', label: 'Geometri dan pengukuran' },
  data: { id: 'data', label: 'Data dan peluang' },
  read: { id: 'read', label: 'Membaca' },
  write: { id: 'write', label: 'Menulis dan tata bahasa' },
  listen: { id: 'listen', label: 'Menyimak dan berbicara' },
  life: { id: 'life', label: 'Makhluk hidup' },
  mat: { id: 'mat', label: 'Bahan dan perubahannya' },
  phys: { id: 'phys', label: 'Gaya, energi, dan cahaya' },
  earth: { id: 'earth', label: 'Bumi dan antariksa' },
  sci: { id: 'sci', label: 'Cara kerja sains' },
  other: { id: 'other', label: 'Lainnya' },
}

export const GROUP_ORDER: Record<PlacementSubject, string[]> = {
  math: ['num', 'geo', 'data'],
  english: ['read', 'write', 'listen'],
  science: ['life', 'mat', 'phys', 'earth', 'sci'],
}

export function strandGroup(strand: string): StrandGroup {
  if (/^N[a-z]$/.test(strand)) return GROUPS.num!
  if (/^G[a-z]$/.test(strand)) return GROUPS.geo!
  if (/^S[sp]$/.test(strand)) return GROUPS.data!
  if (/^R[a-z]$/.test(strand)) return GROUPS.read!
  if (/^W[a-z]$/.test(strand)) return GROUPS.write!
  if (strand === 'SL') return GROUPS.listen!
  if (/^B[a-z]$/.test(strand)) return GROUPS.life!
  if (/^C[a-z]$/.test(strand)) return GROUPS.mat!
  if (/^P[a-z]$/.test(strand)) return GROUPS.phys!
  if (/^ES/.test(strand)) return GROUPS.earth!
  if (strand === 'TWS') return GROUPS.sci!
  return GROUPS.other!
}

export function groupLabel(id: string): string {
  return GROUPS[id]?.label ?? 'Lainnya'
}

// ---------------------------------------------------------------------------
// Jalannya tes

export type PlacementCandidate = {
  ref: string
  skillId: string
  grade: number
  strand: string
  difficulty: number
  unlimited?: boolean
  /** Hari sejak anak terakhir melihat soal ini; kosong berarti belum pernah. */
  seenDaysAgo?: number
}

export type PlacementAnswer = {
  ref: string
  skillId: string
  grade: number
  group: string
  difficulty: number
  b: number
  correct: boolean
  /** Anak memilih "belum tahu": dihitung belum tepat, tetapi tidak disebut salah di layar. */
  unsure: boolean
  /** Perkiraan theta setelah soal ini. */
  thetaAfter: number
}

export function startTheta(parentGrade: number): number {
  return gradeToTheta(Math.min(6, Math.max(1, parentGrade)))
}

/** Perbarui perkiraan setelah satu jawaban. Memakai updateTheta Rasch yang sama dengan mesin belajar. */
export function nextTheta(theta: number, answered: number, b: number, correct: boolean): number {
  const t = updateTheta(theta, answered, b, correct ? 1 : 0)
  return Math.min(THETA_CAP, Math.max(-THETA_CAP, t))
}

/** Stabil: sudah cukup soal dan empat perkiraan terakhir berdekatan, atau sudah mencapai batas atas. */
export function isStable(thetas: readonly number[]): boolean {
  const n = thetas.length
  if (n >= PLACEMENT_MAX) return true
  if (n < PLACEMENT_MIN) return false
  const last = thetas.slice(-4)
  return Math.max(...last) - Math.min(...last) <= STABLE_RANGE
}

/**
 * Soal berikutnya: peluang benar dekat TARGET_P, kelompok strand digilir, skill yang sama tidak dua kali berturut-turut,
 * dan soal yang pernah dilihat anak baru dipakai bila tidak ada pilihan lain. Tidak pernah mengulang ref yang sudah keluar.
 */
export function pickNext(input: {
  candidates: readonly PlacementCandidate[]
  theta: number
  asked: readonly Pick<PlacementAnswer, 'ref' | 'skillId' | 'group'>[]
  rng: Rng
}): PlacementCandidate | null {
  const { candidates, theta, asked, rng } = input
  const usedRefs = new Set(asked.map((a) => a.ref))
  const bySkill = new Map<string, number>()
  const byGroup = new Map<string, number>()
  for (const a of asked) {
    bySkill.set(a.skillId, (bySkill.get(a.skillId) ?? 0) + 1)
    byGroup.set(a.group, (byGroup.get(a.group) ?? 0) + 1)
  }
  const lastSkill = asked[asked.length - 1]?.skillId
  let best: { c: PlacementCandidate; score: number } | null = null
  for (const c of candidates) {
    if (usedRefs.has(c.ref)) continue
    const p = pCorrect(theta, itemB(c.grade, c.difficulty))
    const seen = !c.unlimited && c.seenDaysAgo !== undefined ? 1 : 0
    const score =
      Math.abs(p - TARGET_P) +
      (byGroup.get(strandGroup(c.strand).id) ?? 0) * 0.07 +
      (bySkill.get(c.skillId) ?? 0) * 0.25 +
      (c.skillId === lastSkill ? 0.2 : 0) +
      seen * 0.6 +
      rng.next() * 0.03
    if (!best || score < best.score) best = { c, score }
  }
  return best?.c ?? null
}

// ---------------------------------------------------------------------------
// Hasil

export type PlacementConfidence = 'cukup' | 'kasar'
export type GroupStatus = 'kuat' | 'cukup' | 'perlu' | 'belum'

export type PlacementGroupResult = { id: string; label: string; asked: number; correct: number; status: GroupStatus }
export type PlacementTopic = { skillId: string; grade: number; group: string }

export type PlacementResult = {
  /** Kelas kontinu dari theta akhir, satu desimal. */
  levelExact: number
  /** Kelas bulat 1 sampai 6 yang dipakai untuk menaruh titik awal. */
  level: number
  startGrade: number
  theta: number
  answered: number
  confidence: PlacementConfidence
  groups: PlacementGroupResult[]
  strengths: PlacementTopic[]
  focus: PlacementTopic[]
}

export function summarise(subject: PlacementSubject, startGrade: number, answers: readonly PlacementAnswer[]): PlacementResult {
  const theta = answers.length > 0 ? answers[answers.length - 1]!.thetaAfter : startTheta(startGrade)
  const levelExact = Math.round(thetaToGrade(theta) * 10) / 10
  const level = Math.min(6, Math.max(1, Math.round(levelExact)))
  const groups: PlacementGroupResult[] = GROUP_ORDER[subject].map((id) => {
    const mine = answers.filter((a) => a.group === id)
    const correct = mine.filter((a) => a.correct).length
    let status: GroupStatus = 'belum'
    if (mine.length > 0) {
      // Selisih hasil dengan harapan di theta akhir: positif berarti lebih baik dari perkiraan.
      const resid = mine.reduce((s, a) => s + ((a.correct ? 1 : 0) - pCorrect(theta, a.b)), 0) / mine.length
      status = resid >= 0.12 ? 'kuat' : resid <= -0.2 ? 'perlu' : 'cukup'
      if (mine.every((a) => !a.correct)) status = 'perlu'
      if (mine.every((a) => a.correct)) status = 'kuat'
    }
    return { id, label: groupLabel(id), asked: mine.length, correct, status }
  })
  // Kekuatan: soal tersulit yang dijawab benar. Fokus: soal termudah yang belum tepat. Satu topik per skill.
  const seen = new Set<string>()
  const topic = (a: PlacementAnswer): PlacementTopic => ({ skillId: a.skillId, grade: a.grade, group: a.group })
  const firstPerSkill = (a: PlacementAnswer): boolean => {
    if (seen.has(a.skillId)) return false
    seen.add(a.skillId)
    return true
  }
  const strengths = [...answers]
    .filter((a) => a.correct)
    .sort((x, y) => y.b - x.b)
    .filter(firstPerSkill)
    .slice(0, 3)
    .map(topic)
  seen.clear()
  const focus = [...answers]
    .filter((a) => !a.correct)
    .sort((x, y) => x.b - y.b)
    .filter(firstPerSkill)
    .slice(0, 3)
    .map(topic)
  const stable = isStable(answers.map((a) => a.thetaAfter))
  return {
    levelExact,
    level,
    startGrade,
    theta,
    answered: answers.length,
    confidence: stable && answers.length >= PLACEMENT_MIN ? 'cukup' : 'kasar',
    groups,
    strengths,
    focus,
  }
}

// ---------------------------------------------------------------------------
// Efek ke skill_state

export type SeedSkill = { id: string; grade: number; strand: string }
export type SeedRow = { skillId: string; gate: 'review' | 'mastered'; stars: 2 | 3; theta: number }

/**
 * Skill di bawah tingkat ditandai: dua kelas atau lebih di bawah dan kelompoknya tidak lemah: dikuasai; satu kelas di bawah
 * atau kelompok lemah atau belum diuji: perlu diulang. Skill di tingkat itu dan di atasnya tetap baru (tidak ada baris).
 * Skill yang sudah punya jawaban asli tidak pernah ditimpa (dijaga pemanggil).
 */
export function seedPlan(result: Pick<PlacementResult, 'level' | 'groups'>, skills: readonly SeedSkill[]): SeedRow[] {
  const status = new Map(result.groups.map((g) => [g.id, g.status]))
  const out: SeedRow[] = []
  for (const s of skills) {
    if (s.grade >= result.level) continue
    const st = status.get(strandGroup(s.strand).id) ?? 'belum'
    const mastered = s.grade <= result.level - 2 && (st === 'kuat' || st === 'cukup')
    const base = Math.max(0.5, initialTheta(result.level, s.grade))
    out.push({ skillId: s.id, gate: mastered ? 'mastered' : 'review', stars: mastered ? 3 : 2, theta: mastered ? base : base * 0.6 })
  }
  return out
}

/** Kelas titik awal sesi harian: tingkat hasil tes, dibatasi dua kelas di bawah dan satu di atas kelas yang disebut orang tua. */
export function sessionStartGrade(level: number, parentGrade: number): number {
  return Math.min(6, Math.max(1, Math.min(parentGrade + 1, Math.max(parentGrade - 2, level))))
}

/** Kapan tes ulang boleh dimulai lagi: 30 hari setelah tes terakhir selesai. Kosong berarti sekarang. */
export function retakeAllowedAt(lastFinished: Date | null): Date | null {
  if (!lastFinished) return null
  return new Date(lastFinished.getTime() + PLACEMENT_RETAKE_DAYS * 86400000)
}
