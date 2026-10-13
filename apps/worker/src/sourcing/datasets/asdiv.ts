import type { Candidate, ParsedRows } from '../types'
import { clean, decodeEntities, needsPicture, unsafeForKids } from './common'

/**
 * ASDiv (CC BY-NC 4.0): soal cerita Math berlabel kelas 1 sampai 6. Hanya soal dengan satu jawaban angka
 * yang dipakai; jawaban ganda ("3; 2"), pecahan, dan negatif dilewati.
 * Format: <Problem ID Grade Source><Body/><Question/><Solution-Type/><Answer/><Formula/></Problem>.
 */

const DIFFICULTY_BY_GRADE = [1, 2, 3, 3, 4, 5]
const PROBLEM = /<Problem\s+([^>]*)>([\s\S]*?)<\/Problem>/g

function attr(attrs: string, name: string): string | null {
  const m = new RegExp(`${name}="([^"]*)"`).exec(attrs)
  return m ? decodeEntities(m[1]!) : null
}

function tag(body: string, name: string): string | null {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`).exec(body)
  return m ? decodeEntities(m[1]!) : null
}

/** "9 (apples)" menjadi { value: 9, unit: "apples" }. Null bila bukan satu angka biasa. */
export function parseAnswer(raw: string): { value: number; unit?: string; decimal: boolean } | null {
  const m = /^\s*(\d+(?:\.\d{1,2})?)\s*(?:\(([^)]{1,40})\))?\s*$/.exec(raw)
  if (!m) return null
  const value = Number(m[1])
  const unit = m[2]?.trim()
  return { value, ...(unit && unit.length <= 20 ? { unit } : {}), decimal: m[1]!.includes('.') }
}

export function parseAsdiv(xml: string): ParsedRows {
  const rows: (Candidate | null)[] = []
  for (const m of xml.matchAll(PROBLEM)) {
    const attrs = m[1]!
    const body = m[2]!
    const id = attr(attrs, 'ID')
    const grade = Number(attr(attrs, 'Grade'))
    const text = tag(body, 'Body')
    const question = tag(body, 'Question')
    const answer = tag(body, 'Answer')
    const type = tag(body, 'Solution-Type')
    const formula = tag(body, 'Formula')
    if (!id || !text || !question || !answer || !Number.isInteger(grade) || grade < 1 || grade > 6) {
      rows.push(null)
      continue
    }
    const parsed = parseAnswer(answer)
    const prompt = clean(`${text} ${question}`)
    if (!parsed || prompt.length < 15 || prompt.length > 400 || unsafeForKids(prompt) || needsPicture(prompt)) {
      rows.push(null)
      continue
    }
    const sentence = formula ? clean(formula) : null
    rows.push({
      externalId: id,
      subject: 'math',
      grade,
      type: 'numeric',
      prompt,
      answer: parsed.value,
      ...(parsed.unit ? { unit: parsed.unit } : {}),
      ...(parsed.decimal ? { allowDecimal: true } : {}),
      ...(sentence ? { steps: [`Write the number sentence: ${sentence}`] } : {}),
      ...(type ? { topicHint: clean(type) } : {}),
      difficulty: DIFFICULTY_BY_GRADE[grade - 1]!,
    })
  }
  return { rows, rawCount: rows.length }
}
