// __GTX_SEED__
import type { LjkDTO } from '@/lib/dto'
import { shell } from './console-shared'

const PAT = ['B', 'A', 'C', 'D', 'B', 'C', 'A', 'B', 'D', 'C']

function answers40(): (string | null)[] {
  return Array.from({ length: 40 }, (_, i) => {
    const n = i + 1
    if (n > 33 || n === 7 || n === 19) return null
    return PAT[i % 10]!
  })
}

const SHEETS: LjkDTO['sheets'] = [
  { attemptId: 'att-esmo-m1', code: 'KRA-ESM-M1-S1', title: 'Simulasi ESMO Math', learnerName: 'Alya', questionCount: 40, optionCount: 4, shortAnswerFrom: null, entered: 31 },
  { attemptId: 'att-ikmc-1', code: 'KRA-IKM-P1', title: 'Latihan IKMC paket 1', learnerName: 'Bima', questionCount: 24, optionCount: 5, shortAnswerFrom: null, entered: 0 },
  { attemptId: 'att-sasmo-1', code: 'KRA-SAS-P2', title: 'Latihan SASMO paket 2', learnerName: 'Bima', questionCount: 25, optionCount: 5, shortAnswerFrom: 16, entered: 12 },
]

export function ljkFor(lembar: string | undefined): LjkDTO {
  const s = SHEETS.find((x) => x.attemptId === lembar) ?? SHEETS[0]!
  const answers =
    s.attemptId === 'att-esmo-m1'
      ? answers40()
      : s.attemptId === 'att-sasmo-1'
        ? Array.from({ length: 25 }, (_, i) => (i < 10 ? PAT[i]! : i === 15 ? '36' : i === 16 ? '125' : null))
        : Array.from({ length: s.questionCount }, () => null)
  return {
    shell,
    sheets: SHEETS,
    selected: { attemptId: s.attemptId, code: s.code, title: s.title, learnerName: s.learnerName, questionCount: s.questionCount, optionCount: s.optionCount, shortAnswerFrom: s.shortAnswerFrom, answers },
  }
}

export const ljkEmpty: LjkDTO = { shell, sheets: [], selected: null }
