/**
 * Penilaian ronde Quick Maths dari jawaban yang tersimpan di server.
 */
import { qmAnswerXp } from '../arena-xp'
import { perMinute, type OpRoundStat } from './adaptive'
import { generateProblem } from './generator'
import { QM_MODE_INFO } from './modes'
import type { QmConfig, QmOp, QmProblem } from './types'

/** Satu jawaban yang disimpan server. `a` null berarti dilewati. `t` = ms sejak ronde mulai (jam server). */
export type StoredAnswer = { i: number; a: number | null; ms: number; t: number; hint?: boolean }

export type KindStat = { n: number; right: number; ms: number }

export type QmReviewRow = { i: number; text: string; yours: number | null; answer: number; ok: boolean }

export type QmRoundResult = {
  answered: number
  correct: number
  skipped: number
  durationMs: number
  ppm: number
  perOp: Partial<Record<QmOp, OpRoundStat>>
  kinds: Record<string, KindStat>
  perCorrectXp: number[]
  review: QmReviewRow[]
}

const MAX_MS_PER_ANSWER = 60000

export function promptText(p: QmProblem): string {
  const pr = p.prompt
  switch (pr.kind) {
    case 'arith':
      return pr.text
    case 'flash':
      return pr.terms.map((n, k) => (k === 0 ? String(n) : n < 0 ? `− ${-n}` : `+ ${n}`)).join(' ') + ' = ?'
    case 'bead-read':
      return 'Read the beads'
    case 'bead-set':
      return `Show ${pr.target}`
    case 'bead-anzan':
      return pr.add === null ? 'Remember the beads' : `Remember the beads, then add ${pr.add}`
  }
}

export function answerXpFor(p: QmProblem, hint: boolean): number {
  let xp: number
  if (p.op === 'flash') xp = 2 + p.level
  else if (p.op === 'soroban') xp = 2 + p.level
  else xp = qmAnswerXp(p.level)
  return hint ? Math.max(1, Math.round(xp / 2)) : xp
}

export function scoreQmRound(cfg: QmConfig, seed: string, answers: readonly StoredAnswer[]): QmRoundResult {
  const perOp: Partial<Record<QmOp, OpRoundStat>> = {}
  const kinds: Record<string, KindStat> = {}
  const perCorrectXp: number[] = []
  const review: QmReviewRow[] = []
  let correct = 0
  let answered = 0
  let skipped = 0
  let activeMs = 0
  let lastT = 0
  for (const a of answers) {
    const p = generateProblem(cfg, seed, a.i)
    const ms = Math.max(0, Math.min(MAX_MS_PER_ANSWER, a.ms))
    activeMs += ms
    lastT = Math.max(lastT, a.t)
    if (a.a === null) {
      skipped++
      review.push({ i: a.i, text: promptText(p), yours: null, answer: p.answer, ok: false })
      continue
    }
    answered++
    const ok = a.a === p.answer
    if (ok) {
      correct++
      perCorrectXp.push(answerXpFor(p, a.hint === true))
    }
    review.push({ i: a.i, text: promptText(p), yours: a.a, answer: p.answer, ok })
    const k = (kinds[p.fact] ??= { n: 0, right: 0, ms: 0 })
    k.n++
    if (ok) k.right++
    k.ms += ms
    if (p.op !== 'flash' && p.op !== 'soroban') {
      const s = (perOp[p.op] ??= { answered: 0, correct: 0, totalMs: 0 })
      s.answered++
      if (ok) s.correct++
      s.totalMs += ms
    }
  }
  const info = QM_MODE_INFO[cfg.mode]
  const durationMs = info.limitSec && cfg.mode !== 'target20' ? info.limitSec * 1000 : cfg.mode === 'target20' ? Math.max(1, lastT) : Math.max(1, activeMs)
  return { answered, correct, skipped, durationMs, ppm: perMinute(correct, durationMs), perOp, kinds, perCorrectXp, review }
}
