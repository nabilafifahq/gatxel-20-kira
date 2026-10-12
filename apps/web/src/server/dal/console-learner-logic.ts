import 'server-only'
import { addDays, computeGate, difficultyToB, initialTheta, outcomeScore, pushRecent, updateTheta, weekStart, type Gate, type IsoDate } from '@kira/core'
import { skillGrade } from '@kira/content/schema'
import type { HeatCell } from '@/lib/dto'

/**
 * Logika murni detail learner (T02): minggu peta penguasaan, putar ulang gerbang per minggu,
 * teks skor, dan menit attempt. DAL `console-learner.ts` menyiapkan data dari database.
 */

export const HEATMAP_WEEKS = 8

/** Senin dari `weeks` minggu terakhir, paling lama dulu, minggu ini paling akhir. */
export function lastWeekStarts(today: IsoDate, weeks = HEATMAP_WEEKS): IsoDate[] {
  const monday = weekStart(today)
  return Array.from({ length: weeks }, (_, i) => addDays(monday, -7 * (weeks - 1 - i)))
}

/** Label kolom peta: M1 untuk minggu paling lama sampai M8 untuk minggu ini. */
export function weekColumns(today: IsoDate, weeks = HEATMAP_WEEKS): { weekStart: IsoDate; label: string }[] {
  return lastWeekStarts(today, weeks).map((w, i) => ({ weekStart: w, label: `M${i + 1}` }))
}

/** Satu jawaban percobaan pertama yang sudah dinilai otomatis, urut waktu. */
export type ReplayAnswer = {
  skillId: string
  /** Tanggal belajar (WIB). */
  date: IsoDate
  correct: boolean
  hintsUsed: number
  difficulty: number
}

/**
 * Sel peta per skill untuk minggu-minggu `weeks`. Akurasi sel = jawaban pertama yang benar
 * tanpa hint dibagi semua jawaban pertama di minggu itu. Gerbang sel = gerbang skill di akhir
 * minggu itu, dihitung ulang dengan mesin yang sama dengan applyOutcome (theta, jendela 20 skor,
 * computeGate) dari jawaban pertama paling awal. Minggu sebelum jawaban pertama bergerbang `new`.
 * `answers` harus urut waktu.
 */
export function heatCells(answers: readonly ReplayAnswer[], weeks: readonly IsoDate[], learnerGrade: number): Map<string, HeatCell[]> {
  const bySkill = new Map<string, ReplayAnswer[]>()
  for (const a of answers) {
    const list = bySkill.get(a.skillId) ?? []
    list.push(a)
    bySkill.set(a.skillId, list)
  }
  const out = new Map<string, HeatCell[]>()
  for (const [skillId, list] of bySkill) {
    let theta = initialTheta(learnerGrade, skillGrade(skillId))
    let n = 0
    let recent: number[] = []
    let gate: Gate = 'new'
    let i = 0
    const cells: HeatCell[] = []
    for (const w of weeks) {
      const end = addDays(w, 6)
      let total = 0
      let right = 0
      while (i < list.length && list[i]!.date <= end) {
        const a = list[i]!
        const s = outcomeScore({ correct: a.correct, hintsUsed: a.hintsUsed })
        theta = updateTheta(theta, n, difficultyToB(a.difficulty), s)
        recent = pushRecent(recent, s)
        n += 1
        gate = computeGate({ nAnswers: n, recentScores: recent, theta }).gate
        if (a.date >= w) {
          total += 1
          if (a.correct && a.hintsUsed === 0) right += 1
        }
        i += 1
      }
      cells.push({ weekStart: w, accuracy: total > 0 ? Math.round((100 * right) / total) : null, answers: total, gate })
    }
    out.set(skillId, cells)
  }
  return out
}

/** Sel kosong untuk skill tanpa jawaban di jendela peta. */
export function emptyCells(weeks: readonly IsoDate[]): HeatCell[] {
  return weeks.map((w) => ({ weekStart: w, accuracy: null, answers: 0, gate: 'new' }))
}

/** 8, 7,5 (desimal koma). */
export function numId(n: number): string {
  if (Number.isInteger(n)) return String(n)
  return String(Math.round(n * 10) / 10).replace('.', ',')
}

/** "8 dari 10", "75 dari 100" untuk skor berskala, ditambah jumlah yang menunggu nilai. */
export function scoreText(a: { scoreRaw: number | null; scoreMax: number | null; scoreScaled: number | null; itemCount: number; pending: number }): string {
  let base: string
  if (a.scoreScaled != null) base = `${numId(Math.round(a.scoreScaled))} dari 100`
  else if (a.scoreRaw != null) base = `${numId(a.scoreRaw)} dari ${numId(a.scoreMax ?? a.itemCount)}`
  else base = 'Belum ada skor'
  return a.pending > 0 ? `${base}, ${a.pending} menunggu nilai` : base
}

/**
 * Menit kerja attempt. Jumlah waktu per soal dari perangkat paling mendekati waktu kerja anak
 * (attempt quest dibuat saat Today dibuka, jadi selisih mulai dan kumpul bisa berjam-jam).
 * Tanpa waktu per soal (misalnya LJK kertas) memakai elapsed_s, lalu selisih waktu.
 */
export function attemptMinutes(a: { activeMs: number; elapsedS: number; startedAt: Date; submittedAt: Date | null }): number {
  if (a.activeMs > 0) return Math.max(1, Math.round(a.activeMs / 60000))
  if (a.elapsedS > 0) return Math.max(1, Math.round(a.elapsedS / 60))
  if (a.submittedAt) return Math.max(1, Math.round((a.submittedAt.getTime() - a.startedAt.getTime()) / 60000))
  return 0
}

/** Teks jawaban dari yourAnswerText (en-GB untuk layar learner) dalam bahasa konsol. */
export function answerTextId(text: string): string {
  if (text === 'No answer' || text.trim() === '') return 'Tidak dijawab'
  if (text === 'Voice recording sent') return 'Rekaman suara'
  if (text === 'Drawing sent') return 'Gambar'
  const frac = /^(\d+) of (\d+) parts$/.exec(text)
  if (frac) return `${frac[1]} dari ${frac[2]} bagian diarsir`
  return text
}
