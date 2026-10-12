// __GTX_SEED__
import QRCode from 'qrcode'
import type { PrintLjkDTO, PrintPaperDTO } from '@/lib/dto'
import type { ClientItem } from '@kira/content/present'
import { ITEM_BARS, ITEM_ORDER } from './console-shared'

function q(ref: string, type: ClientItem['type'], prompt: string, extra: Partial<ClientItem> = {}): ClientItem {
  return { ref, type, skill: 'm2-arrays', difficulty: 2, prompt, lang: 'en-GB', expectedSeconds: 60, ...extra }
}

export const printPaper: PrintPaperDTO = {
  code: 'W01-M-P01',
  title: 'Arrays and skip counting',
  subject: 'math',
  subjectLabel: 'Math',
  grade: 2,
  minutes: 15,
  instructions: ['Read each question twice.', 'Show your working in the box.', 'Write your answer in the answer box.'],
  learnerName: null,
  date: null,
  withKey: false,
  sections: [
    {
      title: 'A. Arrays',
      items: [
        {
          number: 1,
          item: q('KRA-M-0390', 'numeric', 'How many stars are there? Write the number.', {
            figure: { kind: 'array', rows: 3, cols: 4, icon: 'star', alt: '3 rows of 4 stars.' },
          }),
          answerText: '12 stars, 3 × 4 = 12',
          explanation: 'Accept 4 + 4 + 4 = 12 or 4 × 3 = 12. Watch for counting one row twice.',
        },
        {
          number: 2,
          item: q('KRA-M-0391', 'draw', 'Draw an array with 2 rows of 5 dots. Then write how many dots there are.', { drawBackground: 'dots' }),
          answerText: '2 rows of 5, 10 dots',
          explanation: 'Rows must be straight and evenly spaced. 5 rows of 2 is a different array: ask which is the row.',
        },
        {
          number: 3,
          item: q('KRA-M-0392', 'mcq', 'Which array shows 4 rows of 3?', {
            options: [
              { i: 0, figure: { kind: 'array', rows: 3, cols: 4, icon: 'dot', alt: '3 rows of 4 dots.' } },
              { i: 1, figure: { kind: 'array', rows: 4, cols: 3, icon: 'dot', alt: '4 rows of 3 dots.' } },
              { i: 2, figure: { kind: 'array', rows: 2, cols: 6, icon: 'dot', alt: '2 rows of 6 dots.' } },
            ],
          }),
          answerText: 'B',
          explanation: 'A has the same 12 dots as 3 rows of 4. Choosing A means rows and columns are mixed up.',
        },
      ],
    },
    {
      title: 'B. Skip counting',
      items: [
        {
          number: 4,
          item: q('KRA-M-0402', 'text', 'Count in 2s. Write the missing numbers: 2, 4, __, __, 10, __', {
            figure: { kind: 'sequence', items: ['2', '4', null, null, '10', null], style: 'boxes', alt: '2, 4, blank, blank, 10, blank.' },
            blanks: 3,
          }),
          answerText: '6, 8, 12',
          explanation: 'All three needed for the mark.',
        },
        {
          number: 5,
          item: q('KRA-M-0403', 'mcq', 'Count in 5s. Which number comes next? 5, 10, 15, 20, ...', {
            options: [
              { i: 0, text: '21' },
              { i: 1, text: '25' },
              { i: 2, text: '30' },
              { i: 3, text: '40' },
            ],
          }),
          answerText: 'B, 25',
          explanation: 'Choosing 21 means counting in 1s at the end.',
        },
        { number: 6, item: { ...ITEM_BARS, ref: 'KRA-M-0451' }, answerText: '5', explanation: '9 bananas minus 4 pears. Watch for 13, which adds the two bars.' },
        {
          number: 7,
          item: q('KRA-M-0404', 'numeric', 'There are 5 plates. Each plate has 2 apples. How many apples are there?', {
            figure: { kind: 'groups', groups: [2, 2, 2, 2, 2], icon: 'apple', container: 'plate', alt: '5 plates with 2 apples on each.' },
            unit: 'apples',
          }),
          answerText: '10 apples',
          explanation: 'Accept 2 + 2 + 2 + 2 + 2 = 10 or 5 × 2 = 10. An answer of 7 means the numbers were added, 5 + 2.',
        },
        { number: 8, item: { ...ITEM_ORDER, ref: 'KRA-S-0120', prompt: 'Put the numbers in order from smallest to largest.', orderItems: [{ i: 2, text: '45' }, { i: 0, text: '12' }, { i: 3, text: '54' }, { i: 1, text: '21' }] }, answerText: '12, 21, 45, 54', explanation: 'Watch for 21 and 12 swapped: look at the tens digit first.' },
      ],
    },
  ],
}

export const printKey: PrintPaperDTO = { ...printPaper, withKey: true }

export const printPaperNamed: PrintPaperDTO = { ...printPaper, learnerName: 'Alya', date: '2026-10-19' }

export async function printLjk(optionCount: 4 | 5 = 4): Promise<PrintLjkDTO> {
  const code = optionCount === 4 ? 'KRA-ESM-M1-S1' : 'KRA-IKM-P1'
  const qrDataUrl = await QRCode.toDataURL(`https://kira.local/ljk/${code}?seed=${'__GTX_SEED__'}`, { margin: 1, width: 240, errorCorrectionLevel: 'M' })
  return optionCount === 4
    ? { code, title: 'Mock test, Math', questionCount: 40, optionCount: 4, shortAnswerFrom: null, qrDataUrl }
    : { code, title: 'Practice paper, IKMC style', questionCount: 25, optionCount: 5, shortAnswerFrom: 21, qrDataUrl }
}
