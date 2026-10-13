/**
 * Statistik Quick Maths untuk learner dan laporan tutor: soal per menit, akurasi, rekor pribadi,
 * grafik mingguan, dan jenis soal yang paling lambat.
 */
import { addDays, weekdayNameEn, type IsoDate } from '../time'
import { perMinute } from './adaptive'
import { factLabel } from './generator'
import type { KindStat } from './scoring'
import type { QmMode } from './types'

export type QmStatRow = {
  date: IsoDate
  mode: QmMode
  answered: number
  correct: number
  durationMs: number
  ppm: number
  kinds: Record<string, KindStat>
}

export type WeekPoint = { date: IsoDate; label: string; rounds: number; correct: number; answered: number; ppm: number }

export type SlowFact = { fact: string; label: string; n: number; avgMs: number; accuracy: number }

export type QmStats = {
  rounds: number
  correct: number
  answered: number
  accuracy: number | null
  ppm: number | null
  bestSprintPpm: number | null
  bestTargetSec: number | null
  bestAccuracyRound: { correct: number; answered: number } | null
  week: WeekPoint[]
  slowest: SlowFact[]
}

const SPRINTS: readonly QmMode[] = ['sprint60', 'sprint120']
const ARITH = /^(add|sub|mul|div|comp):/

export function weeklyChart(rows: readonly QmStatRow[], today: IsoDate): WeekPoint[] {
  const days: WeekPoint[] = []
  for (let k = 6; k >= 0; k--) {
    const date = addDays(today, -k)
    const day = rows.filter((r) => r.date === date)
    const correct = day.reduce((n, r) => n + r.correct, 0)
    const answered = day.reduce((n, r) => n + r.answered, 0)
    const ms = day.reduce((n, r) => n + r.durationMs, 0)
    days.push({ date, label: weekdayNameEn(date).slice(0, 3), rounds: day.length, correct, answered, ppm: perMinute(correct, ms) })
  }
  return days
}

export function slowestFacts(rows: readonly QmStatRow[], limit = 3, minAnswers = 4): SlowFact[] {
  const total: Record<string, KindStat> = {}
  for (const r of rows) {
    for (const [fact, k] of Object.entries(r.kinds)) {
      if (!ARITH.test(fact)) continue
      const t = (total[fact] ??= { n: 0, right: 0, ms: 0 })
      t.n += k.n
      t.right += k.right
      t.ms += k.ms
    }
  }
  return Object.entries(total)
    .filter(([, k]) => k.n >= minAnswers)
    .map(([fact, k]) => ({ fact, label: factLabel(fact), n: k.n, avgMs: Math.round(k.ms / k.n), accuracy: Math.round((k.right / k.n) * 100) }))
    .sort((a, b) => b.avgMs - a.avgMs)
    .slice(0, limit)
}

export function summariseQm(rows: readonly QmStatRow[], today: IsoDate): QmStats {
  const answered = rows.reduce((n, r) => n + r.answered, 0)
  const correct = rows.reduce((n, r) => n + r.correct, 0)
  const ms = rows.reduce((n, r) => n + r.durationMs, 0)
  const sprints = rows.filter((r) => SPRINTS.includes(r.mode) && r.answered >= 10 && r.correct / r.answered >= 0.8)
  const targets = rows.filter((r) => r.mode === 'target20' && r.answered >= 20 && r.correct === 20)
  const best = rows.filter((r) => r.answered >= 10).sort((a, b) => b.correct / b.answered - a.correct / a.answered || b.answered - a.answered)[0]
  return {
    rounds: rows.length,
    correct,
    answered,
    accuracy: answered > 0 ? Math.round((correct / answered) * 100) : null,
    ppm: ms > 0 ? perMinute(correct, ms) : null,
    bestSprintPpm: sprints.length ? Math.max(...sprints.map((r) => r.ppm)) : null,
    bestTargetSec: targets.length ? Math.round(Math.min(...targets.map((r) => r.durationMs)) / 100) / 10 : null,
    bestAccuracyRound: best ? { correct: best.correct, answered: best.answered } : null,
    week: weeklyChart(rows, today),
    slowest: slowestFacts(rows.filter((r) => r.date >= addDays(today, -29))),
  }
}
