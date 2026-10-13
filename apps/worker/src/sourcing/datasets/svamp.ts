import type { Candidate, ParsedRows } from '../types'
import { clean, needsPicture, unsafeForKids } from './common'

/**
 * SVAMP (MIT): soal cerita Math satu hitungan (tambah, kurang, kali, bagi) sampai kelas 4, tanpa label kelas.
 * Kelas ditebak dari jenis hitungan dan besar bilangan: tambah dan kurang sampai 20 untuk kelas 1, sampai 100
 * untuk kelas 2, selebihnya kelas 3; kali dan bagi sampai 100 untuk kelas 3, selebihnya kelas 4.
 * Format: array JSON { ID, Body, Question, Equation, Answer, Type }.
 */

type Raw = { ID?: unknown; Body?: unknown; Question?: unknown; Equation?: unknown; Answer?: unknown; Type?: unknown }

const SUBORDINATE = /^(if|when|after|before|since|because|while|although|as|given|suppose)\b/i

/** Body SVAMP sering berhenti sebelum pertanyaan ("... jika ada diskon 25 dollar per paket"); gabungkan dengan benar. */
export function joinBodyQuestion(body: string, question: string): string {
  const b = body.trim()
  const q = question.trim()
  if (/[.!?]$/.test(b)) return `${b} ${q}`
  const lastSentence = b.split(/(?<=[.!?])\s+/).pop() ?? b
  if (SUBORDINATE.test(lastSentence)) return `${b}, ${q.charAt(0).toLowerCase()}${q.slice(1)}`
  return `${b}. ${q}`
}

export function svampGrade(type: string, numbers: readonly number[]): number {
  const max = Math.max(0, ...numbers)
  if (type === 'Addition' || type === 'Subtraction') return max <= 20 ? 1 : max <= 100 ? 2 : 3
  return max <= 100 ? 3 : 4
}

export function parseSvamp(json: string): ParsedRows {
  let data: Raw[]
  try {
    data = JSON.parse(json) as Raw[]
  } catch {
    return { rows: [], rawCount: 0 }
  }
  if (!Array.isArray(data)) return { rows: [], rawCount: 0 }
  const rows = data.map(toCandidate)
  return { rows, rawCount: rows.length }
}

function toCandidate(r: Raw): Candidate | null {
  if (typeof r.ID !== 'string' || typeof r.Body !== 'string' || typeof r.Question !== 'string' || typeof r.Answer !== 'number' || typeof r.Type !== 'string') return null
  const type = r.Type === 'Common-Divison' ? 'Common-Division' : r.Type
  if (!['Addition', 'Subtraction', 'Multiplication', 'Common-Division'].includes(type)) return null
  const answer = Math.round(r.Answer * 100) / 100
  if (!Number.isFinite(answer) || answer < 0 || answer > 1000) return null
  const prompt = clean(joinBodyQuestion(r.Body, r.Question))
  if (prompt.length < 20 || prompt.length > 300 || unsafeForKids(prompt) || needsPicture(prompt)) return null
  const numbers = (prompt.match(/\d+(?:\.\d+)?/g) ?? []).map(Number)
  if (numbers.some((n) => n > 1000)) return null
  const decimal = !Number.isInteger(answer)
  const grade = svampGrade(type, numbers)
  const equation = typeof r.Equation === 'string' ? clean(r.Equation.replace(/\.0\b/g, '')) : null
  return {
    externalId: `svamp-${r.ID}`,
    subject: 'math',
    grade,
    type: 'numeric',
    prompt,
    answer,
    ...(decimal ? { allowDecimal: true } : {}),
    ...(equation ? { steps: [`Write the number sentence: ${equation}`] } : {}),
    topicHint: type,
    difficulty: Math.min(5, grade + 1),
  }
}
