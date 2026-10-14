import { createHash } from 'node:crypto'
import type { Candidate } from '../types'
import { clean, unsafeForKids } from './common'
import type { HfParsed } from './science-mcq'

/**
 * BLiMP (Warstadt dkk. 2020, CC BY 4.0): pasangan kalimat minimal, satu benar secara tata bahasa dan satu salah.
 * Dijadikan soal English "Which sentence is correct?" (dua pilihan). Hanya fenomena yang cocok untuk SD yang dipakai,
 * masing-masing dipasang ke satu skill English Kira. Kunci pasti benar karena pasangan disusun oleh peneliti.
 * Baris: { sentence_good, sentence_bad, UID, pair_id }. Satu konfigurasi Hugging Face per fenomena.
 *
 * Open Trivia DB tidak punya kategori bahasa atau kosakata, dan lisensi contoh soal Cambridge YLE belum bisa dipastikan
 * membolehkan pengambilan otomatis, jadi sumber English mingguan memakai BLiMP.
 */

export const BLIMP_PHENOMENA: Record<string, { skillId: string; grade: number; rule: string }> = {
  irregular_past_participle_verbs: { skillId: 'e2.irregular-past', grade: 2, rule: 'Some verbs have a special form with "had" or "has".' },
  anaphor_gender_agreement: { skillId: 'e2.pronouns', grade: 2, rule: 'Use "himself" for a boy and "herself" for a girl.' },
  anaphor_number_agreement: { skillId: 'e2.pronouns', grade: 2, rule: 'Use "himself" or "herself" for one person and "themselves" for many.' },
  determiner_noun_agreement_1: { skillId: 'e3.plurals', grade: 3, rule: 'Use "this" or "that" with one thing, and "these" or "those" with many.' },
  determiner_noun_agreement_2: { skillId: 'e3.plurals', grade: 3, rule: 'Use "this" or "that" with one thing, and "these" or "those" with many.' },
  regular_plural_subject_verb_agreement_1: { skillId: 'e4.subject-verb', grade: 4, rule: 'The verb must match the subject.' },
  regular_plural_subject_verb_agreement_2: { skillId: 'e4.subject-verb', grade: 4, rule: 'The verb must match the subject.' },
  irregular_plural_subject_verb_agreement_1: { skillId: 'e4.subject-verb', grade: 4, rule: 'The verb must match the subject, also for words like "children" and "men".' },
  irregular_plural_subject_verb_agreement_2: { skillId: 'e4.subject-verb', grade: 4, rule: 'The verb must match the subject, also for words like "children" and "men".' },
}

export const BLIMP_CONFIGS = Object.keys(BLIMP_PHENOMENA)

type HfPage = { rows?: { row_idx?: number; row?: Record<string, unknown> }[]; num_rows_total?: number }

export function parseBlimp(json: string, config: string): HfParsed {
  let page: HfPage
  try {
    page = JSON.parse(json) as HfPage
  } catch {
    return { rows: [], rawCount: 0, total: 0 }
  }
  const rows = (page.rows ?? []).map((r) => (r.row ? toCandidate(r.row, config) : null))
  return { rows, rawCount: rows.length, total: page.num_rows_total ?? 0 }
}

function toCandidate(row: Record<string, unknown>, config: string): Candidate | null {
  const ph = BLIMP_PHENOMENA[config]
  if (!ph || typeof row.sentence_good !== 'string' || typeof row.sentence_bad !== 'string') return null
  const good = clean(row.sentence_good)
  const bad = clean(row.sentence_bad)
  if (good === bad || good.length < 12 || good.length > 80 || bad.length > 80) return null
  if (unsafeForKids(good, bad)) return null
  const h = createHash('sha256').update(good).digest()
  const goodFirst = h[0]! % 2 === 0
  const pair = typeof row.pair_id === 'number' ? row.pair_id : h.readUInt32BE(0)
  return {
    externalId: `blimp-${config}-${pair}`,
    subject: 'english',
    grade: ph.grade,
    type: 'mcq',
    prompt: 'Which sentence is correct?',
    options: goodFirst ? [good, bad] : [bad, good],
    answer: goodFirst ? 0 : 1,
    explanation: `The correct sentence is "${good}" ${ph.rule}`.slice(0, 280),
    skillHint: ph.skillId,
    dedupeKey: good,
    difficulty: Math.min(4, ph.grade),
  }
}
