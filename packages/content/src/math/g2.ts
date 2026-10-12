import { mcqFrom, nearNumbers, COUNTABLES, NAMES, plural } from './helpers'
import type { Generator } from './types'

/** Generator Math Grade 2. */
export const generators: Generator[] = [
  {
    skill: 'm2.arrays',
    levels: [1, 2, 3, 4],
    generate({ rng, level }) {
      const rows = level <= 2 ? rng.int(2, 4) : rng.int(3, 6)
      const cols = level === 1 ? rng.pick([2, 5, 10]) : level === 2 ? rng.int(2, 5) : rng.int(3, 6)
      const thing = rng.pick(COUNTABLES.filter((c) => ['apple', 'cookie', 'muffin', 'flower', 'star', 'egg'].includes(c.icon)))
      const total = rows * cols
      const figure = { kind: 'array' as const, rows, cols, icon: thing.icon, alt: `${rows} rows of ${plural(cols, thing.one, thing.many)}.` }
      const hints: [string, string, string] = [
        'Look at one row first. How many are in it?',
        `Count in ${cols}s, one row at a time.`,
        `Row 1 makes ${cols}. Row 2 makes ${cols * 2}. Keep going.`,
      ]
      const solution = [
        { say: `There are ${rows} rows. Each row has ${cols}.`, figure },
        { say: `Count in ${cols}s: ${Array.from({ length: rows }, (_, i) => (i + 1) * cols).join(', ')}.`, show: Array.from({ length: rows }, () => cols).join(' + ') + ` = ${total}` },
        { say: `So there are ${total} altogether.`, show: `${rows} × ${cols} = ${total}` },
      ]
      if (level === 4) {
        const name = rng.pick(NAMES)
        return {
          type: 'numeric',
          prompt: `${name} puts ${thing.many} in ${rows} rows. Each row has ${cols} ${thing.many}. How many ${thing.many} are there?`,
          answer: total,
          hints,
          explanation: `${rows} rows of ${cols} is ${rows} × ${cols} = ${total}.`,
          solution,
          tags: ['word-problem'],
        }
      }
      if (level === 3) {
        const m = mcqFrom(rng, `${rows} × ${cols}`, [
          { value: `${rows} + ${cols}`, why: 'Adding the rows and the columns does not count every item.' },
          { value: `${rows} × ${cols + 1}`, why: 'Count the items in one row again.' },
          { value: `${rows + 1} × ${cols}`, why: 'Count the rows again.' },
        ])
        return {
          type: 'mcq',
          prompt: `Which number sentence matches this array?`,
          figure,
          ...m,
          hints,
          explanation: `There are ${rows} rows with ${cols} in each row, so the array shows ${rows} × ${cols}.`,
          solution,
        }
      }
      return {
        type: 'numeric',
        prompt: `There are ${rows} rows of ${thing.many}. Each row has ${cols} ${thing.many}. How many ${thing.many} are there?`,
        figure,
        answer: total,
        hints,
        explanation: `${rows} rows of ${cols} make ${total}. Skip count: ${Array.from({ length: rows }, (_, i) => (i + 1) * cols).join(', ')}.`,
        solution,
        ...(level === 1 ? { tip: 'Counting in 2s, 5s or 10s is faster than counting one by one.' } : {}),
      }
    },
  },
]

// Contoh pemakaian nearNumbers supaya impor dipakai oleh generator lain di file ini.
void nearNumbers
