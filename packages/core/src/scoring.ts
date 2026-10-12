/**
 * Skor preset lomba. Aturan disimpan sebagai data (content/competitions) dan
 * dihitung di server setelah attempt dikumpulkan.
 */

export type ScoringSection = {
  /** Nomor soal pertama dan terakhir (mulai 1, inklusif). */
  from: number
  to: number
  points: number
  /** Pengurangan untuk jawaban salah (angka positif). Kosong tidak dikurangi. */
  wrongPenalty?: number
  label?: string
}

export type PresetRules = {
  questionCount: number
  timeLimitMin: number
  sections: ScoringSection[]
  startScore?: number
  /** Skor akhir diskalakan ke angka ini (misalnya 100 untuk ESMO). */
  scaleTo?: number
  /** Batas lulus pada skor yang sudah diskalakan. */
  passMark?: number
  /** Skor tidak pernah di bawah 0. */
  floorZero?: boolean
}

export type ScoredAnswer = { position: number; status: 'correct' | 'wrong' | 'blank' }

export type PresetScore = {
  raw: number
  max: number
  scaled: number | null
  passed: boolean | null
  correct: number
  wrong: number
  blank: number
  bySection: { label: string; correct: number; total: number; points: number }[]
}

export function sectionFor(rules: PresetRules, position: number): ScoringSection | undefined {
  return rules.sections.find((s) => position >= s.from && position <= s.to)
}

export function maxScore(rules: PresetRules): number {
  const start = rules.startScore ?? 0
  return start + rules.sections.reduce((sum, s) => sum + (s.to - s.from + 1) * s.points, 0)
}

export function validateRules(rules: PresetRules): string[] {
  const errors: string[] = []
  const covered = new Set<number>()
  for (const s of rules.sections) {
    if (s.from < 1 || s.to < s.from) errors.push(`Bagian ${s.from}-${s.to} tidak valid`)
    for (let i = s.from; i <= s.to; i++) {
      if (covered.has(i)) errors.push(`Soal ${i} ada di dua bagian`)
      covered.add(i)
    }
  }
  for (let i = 1; i <= rules.questionCount; i++) if (!covered.has(i)) errors.push(`Soal ${i} tidak punya poin`)
  if (covered.size > rules.questionCount) errors.push('Bagian melebihi jumlah soal')
  return errors
}

export function scoreWithPreset(rules: PresetRules, answers: readonly ScoredAnswer[]): PresetScore {
  const byPos = new Map(answers.map((a) => [a.position, a.status]))
  let raw = rules.startScore ?? 0
  let correct = 0
  let wrong = 0
  let blank = 0
  const bySection = rules.sections.map((s) => ({
    label: s.label ?? `${s.from}-${s.to}`,
    correct: 0,
    total: s.to - s.from + 1,
    points: s.points,
  }))
  rules.sections.forEach((s, idx) => {
    for (let pos = s.from; pos <= s.to; pos++) {
      const status = byPos.get(pos) ?? 'blank'
      if (status === 'correct') {
        raw += s.points
        correct++
        bySection[idx]!.correct++
      } else if (status === 'wrong') {
        raw -= s.wrongPenalty ?? 0
        wrong++
      } else {
        blank++
      }
    }
  })
  if (rules.floorZero) raw = Math.max(0, raw)
  const max = maxScore(rules)
  const scaled = rules.scaleTo ? Math.round((Math.max(0, raw) / max) * rules.scaleTo * 10) / 10 : null
  const comparable = scaled ?? raw
  const passed = rules.passMark === undefined ? null : comparable >= rules.passMark
  return { raw, max, scaled, passed, correct, wrong, blank, bySection }
}
