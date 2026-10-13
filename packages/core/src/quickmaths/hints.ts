/**
 * Petunjuk strategi per soal dan pelajaran strategi singkat (en-GB, untuk learner).
 * Semua angka dihitung dari operan soal, jadi petunjuk selalu cocok dengan soalnya.
 * Baris terakhir `steps` memuat jawaban; petunjuk sebelum menjawab hanya memakai `steps` tanpa baris terakhir.
 */
import { borrowCount, carryCount } from './generator'
import type { QmProblem, StrategyId } from './types'

const MINUS = '−'
const TIMES = '×'
const DIV = '÷'

export type QmHint = { strategy: StrategyId | null; title: string; steps: string[] }

function addHint(a: number, b: number): QmHint {
  const x = Math.max(a, b)
  const y = Math.min(a, b)
  const sum = a + b
  if (x <= 9) {
    if (sum === 10) return { strategy: 'bonds10', title: 'Pairs that make 10', steps: [`${a} and ${b} are a pair that makes 10.`, `${a} + ${b} = 10`] }
    if (a === b) return { strategy: 'doubles', title: 'Doubles', steps: [`Two groups of ${a}.`, `Double ${a} is ${sum}.`] }
    if (x - y === 1) return { strategy: 'doubles', title: 'Near doubles', steps: [`${y} and ${x} are next to each other. Double ${y} is ${y * 2}.`, `${y * 2} + 1 = ${sum}`] }
    if (sum > 10) {
      const need = 10 - x
      return {
        strategy: 'bridge10',
        title: 'Bridge ten',
        steps: [`${x} needs ${need} to make 10. Split ${y} into ${need} and ${y - need}.`, `${x} + ${need} = 10, then 10 + ${y - need} = ${sum}`],
      }
    }
    return { strategy: null, title: 'Count on', steps: [`Start at ${x} and count on ${y}.`, `${x} + ${y} = ${sum}`] }
  }
  // Hampir sepuluh penuh: 47 + 19
  for (const [big, small] of [[a, b], [b, a]] as const) {
    if (small >= 8 && small % 10 >= 8 && small <= 39 && big > small) {
      const up = Math.ceil(small / 10) * 10
      const back = up - small
      return {
        strategy: 'compensation',
        title: 'Round, then fix',
        steps: [`${small} is ${back} less than ${up}.`, `${big} + ${up} = ${big + up}, then take away ${back}: ${big + up} ${MINUS} ${back} = ${sum}`],
      }
    }
  }
  if (y <= 9) {
    const ones = x % 10
    if (ones + y >= 10) {
      const toNext = 10 - ones
      const next = x + toNext
      return {
        strategy: 'bridge10',
        title: 'Bridge ten',
        steps: [`${x} needs ${toNext} to reach ${next}. Split ${y} into ${toNext} and ${y - toNext}.`, `${x} + ${toNext} = ${next}, then ${next} + ${y - toNext} = ${sum}`],
      }
    }
    return { strategy: null, title: 'Only the ones change', steps: [`${ones} + ${y} = ${ones + y}, so the tens stay the same.`, `${x - ones} + ${ones + y} = ${sum}`] }
  }
  const place = (n: number, p: number): number => Math.floor(n / p) % 10 * p
  const places = [100, 10, 1].filter((p) => place(a, p) > 0 || place(b, p) > 0)
  const bits = places.map((p) => `${place(a, p)} + ${place(b, p)} = ${place(a, p) + place(b, p)}`)
  const parts = (n: number): number[] => places.map((p) => place(n, p)).filter((v) => v > 0)
  const pa = parts(a)
  const pb = parts(b)
  if (carryCount(a, b) === 0) {
    return { strategy: 'partition', title: 'Add the parts', steps: [`Split ${a} into ${pa.join(' + ')} and ${b} into ${pb.join(' + ')}.`, `Add place by place: ${bits.join(', ')}. Together that is ${sum}.`] }
  }
  const lead = pa[0]! + (pb.length >= pa.length ? pb[0]! : 0)
  const restA = a - pa[0]!
  const restB = pb.length >= pa.length ? b - pb[0]! : b
  return {
    strategy: 'left-to-right',
    title: 'Add from the left',
    steps: [`Start with the biggest parts: ${pa[0]}${pb.length >= pa.length ? ` + ${pb[0]}` : ''} = ${lead}.`, `Then the rest: ${restA} + ${restB} = ${restA + restB}. ${lead} + ${restA + restB} = ${sum}`],
  }
}

function subHint(a: number, b: number): QmHint {
  const diff = a - b
  if (a <= 10) return { strategy: 'bonds10', title: 'Think addition', steps: [`What do you add to ${b} to make ${a}?`, `${b} + ${diff} = ${a}, so ${a} ${MINUS} ${b} = ${diff}`] }
  if (a <= 19 && b <= 9 && borrowCount(a, b) > 0) {
    const toTen = a - 10
    const rest = b - toTen
    return {
      strategy: 'bridge10',
      title: 'Bridge ten',
      steps: [`Take away ${toTen} to get down to 10. You still have ${rest} to take away.`, `10 ${MINUS} ${rest} = ${diff}`],
    }
  }
  if (b >= 8 && b % 10 >= 8 && b <= 39) {
    const up = Math.ceil(b / 10) * 10
    const back = up - b
    return {
      strategy: 'compensation',
      title: 'Round, then fix',
      steps: [`${b} is ${back} less than ${up}.`, `${a} ${MINUS} ${up} = ${a - up}, then add ${back} back: ${a - up} + ${back} = ${diff}`],
    }
  }
  if (b <= 9) {
    const ones = a % 10
    if (ones >= b) return { strategy: null, title: 'Only the ones change', steps: [`${ones} ${MINUS} ${b} = ${ones - b}, the tens stay the same.`, `${a - ones} + ${ones - b} = ${diff}`] }
    const rest = b - ones
    return {
      strategy: 'bridge10',
      title: 'Bridge ten',
      steps: [`Take away ${ones} to reach ${a - ones}. You still have ${rest} to take away.`, `${a - ones} ${MINUS} ${rest} = ${diff}`],
    }
  }
  const tens = Math.floor(b / 10) * 10
  const ones = b - tens
  return {
    strategy: 'partition',
    title: 'Take away in parts',
    steps: [`Split ${b} into ${tens} and ${ones}. Take away the ${tens} first: ${a} ${MINUS} ${tens} = ${a - tens}.`, `Then ${ones}: ${a - tens} ${MINUS} ${ones} = ${diff}`],
  }
}

function mulHint(a: number, b: number): QmHint {
  const prod = a * b
  const t = [a, b].find((n) => [2, 5, 9, 10].includes(n))
  const other = t === a ? b : a
  if (a <= 12 && b <= 12) {
    if (t === 2) return { strategy: 'times-patterns', title: 'Double it', steps: [`Times 2 means double.`, `Double ${other} is ${prod}.`] }
    if (t === 10) return { strategy: 'times-patterns', title: 'Times ten', steps: [`Times 10 puts a zero on the end.`, `${other} ${TIMES} 10 = ${prod}`] }
    if (t === 5) return { strategy: 'times-patterns', title: 'Half of ten', steps: [`${other} ${TIMES} 10 = ${other * 10}. Times 5 is half of that.`, `Half of ${other * 10} is ${prod}.`] }
    if (t === 9) return { strategy: 'times-patterns', title: 'Nine pattern', steps: [`${other} ${TIMES} 10 = ${other * 10}. Take away one ${other}.`, `${other * 10} ${MINUS} ${other} = ${prod}`] }
    const small = Math.min(a, b)
    const big = Math.max(a, b)
    if (small === 3) return { strategy: null, title: 'Double and one more', steps: [`3 ${TIMES} ${big} is ${big} + ${big} + ${big}.`, `Double ${big} is ${big * 2}, plus ${big} is ${prod}.`] }
    if (small === 4) return { strategy: null, title: 'Double double', steps: [`Double ${big} is ${big * 2}. Double that again.`, `Double ${big * 2} is ${prod}.`] }
    const five = big * 5
    const rest = (small - 5) * big
    if (small > 5) return { strategy: null, title: 'Split at five', steps: [`${small} = 5 + ${small - 5}. ${big} ${TIMES} 5 = ${five}, and ${big} ${TIMES} ${small - 5} = ${rest}.`, `${five} + ${rest} = ${prod}`] }
    return { strategy: null, title: 'Count in steps', steps: [`Count in ${big}s, ${small} times.`, `${big} ${TIMES} ${small} = ${prod}`] }
  }
  const small = Math.min(a, b)
  const big = Math.max(a, b)
  if (small <= 9) {
    const tens = Math.floor(big / 10) * 10
    const ones = big - tens
    return { strategy: 'partition', title: 'Split into tens and ones', steps: [`Split ${big} into ${tens} and ${ones}: ${tens} ${TIMES} ${small} = ${tens * small}, ${ones} ${TIMES} ${small} = ${ones * small}.`, `${tens * small} + ${ones * small} = ${prod}`] }
  }
  const tens = Math.floor(big / 10) * 10
  const ones = big - tens
  return { strategy: 'partition', title: 'Split one number', steps: [`Split ${big} into ${tens} and ${ones}: ${tens} ${TIMES} ${small} = ${tens * small}, ${ones} ${TIMES} ${small} = ${ones * small}.`, `${tens * small} + ${ones * small} = ${prod}`] }
}

function divHint(a: number, b: number): QmHint {
  const q = a / b
  if (q <= 12 && b <= 12) {
    return { strategy: 'times-patterns', title: 'Think multiplication', steps: [`What times ${b} makes ${a}?`, `${b} ${TIMES} ${q} = ${a}, so ${a} ${DIV} ${b} = ${q}`] }
  }
  const q10 = Math.floor(q / 10) * 10
  const q1 = q - q10
  return {
    strategy: 'partition',
    title: 'Share in parts',
    steps: [`Split the answer into easy parts: ${b} ${TIMES} ${q10} = ${b * q10} and ${b} ${TIMES} ${q1} = ${b * q1}.`, `${b * q10} + ${b * q1} = ${a}, so the answer is ${q10} + ${q1} = ${q}`],
  }
}

/** Petunjuk untuk soal aritmetika; null untuk Flash Anzan dan sempoa. */
export function hintFor(p: QmProblem): QmHint | null {
  if (p.prompt.kind !== 'arith' || p.a === undefined || p.b === undefined) return null
  const { a, b } = p
  if (p.missing) return { strategy: 'bonds10', title: 'Count up', steps: [`Start at ${a} and count up to ${a + b}.`, `${b} steps: ${a} + ${b} = ${a + b}`] }
  switch (p.op) {
    case 'add':
      return addHint(a, b)
    case 'sub':
      return subHint(a, b)
    case 'mul':
      return mulHint(a, b)
    case 'div':
      return divHint(a, b)
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Pelajaran strategi

export type StrategyCard = { title: string; text: string; example?: string[] }

export type Strategy = {
  id: StrategyId
  title: string
  summary: string
  cards: StrategyCard[]
}

export const STRATEGIES: readonly Strategy[] = [
  {
    id: 'bonds10',
    title: 'Pairs that make 10',
    summary: 'Know the pairs that add up to 10 without counting.',
    cards: [
      { title: 'Ten is a friend', text: 'Many sums get easy when you spot a pair that makes 10.', example: ['1 and 9', '2 and 8', '3 and 7', '4 and 6', '5 and 5'] },
      { title: 'Find the partner', text: 'To find the partner of 7, ask: what do I add to 7 to get 10?', example: ['7 + ? = 10', '7 + 3 = 10'] },
      { title: 'Use it', text: 'A pair that makes 10 also helps with taking away.', example: ['10 − 4 = 6', 'because 4 + 6 = 10'] },
    ],
  },
  {
    id: 'doubles',
    title: 'Doubles and near doubles',
    summary: 'Doubles are quick. Near doubles are a double plus or minus one.',
    cards: [
      { title: 'Doubles', text: 'A double is a number added to itself.', example: ['4 + 4 = 8', '6 + 6 = 12', '8 + 8 = 16'] },
      { title: 'Near doubles', text: 'When two numbers are next to each other, double the smaller one and add 1.', example: ['6 + 7', 'double 6 is 12', '12 + 1 = 13'] },
      { title: 'Try it', text: 'Look for doubles in sums before you start counting.' },
    ],
  },
  {
    id: 'bridge10',
    title: 'Bridging ten',
    summary: 'Jump to 10 first, then add what is left.',
    cards: [
      { title: 'Make ten first', text: 'To add across ten, fill up to 10 with part of the second number.', example: ['8 + 5', '8 needs 2 to make 10'] },
      { title: 'Split the rest', text: 'Split 5 into 2 and 3. Add the 2 to make 10, then add the 3.', example: ['8 + 2 = 10', '10 + 3 = 13'] },
      { title: 'It works for bigger numbers', text: 'The same jump works from 38 to 40.', example: ['38 + 7', '38 + 2 = 40', '40 + 5 = 45'] },
    ],
  },
  {
    id: 'compensation',
    title: 'Round, then fix',
    summary: 'Use a friendly number, then fix the small difference.',
    cards: [
      { title: 'Nearly a ten', text: 'Adding 9 is the same as adding 10 and taking away 1.', example: ['47 + 9', '47 + 10 = 57', '57 − 1 = 56'] },
      { title: 'Taking away', text: 'Taking away 19 is taking away 20 and adding 1 back.', example: ['62 − 19', '62 − 20 = 42', '42 + 1 = 43'] },
      { title: 'Fix it', text: 'Always ask which way the fix goes: too much was added or too much was taken away.' },
    ],
  },
  {
    id: 'partition',
    title: 'Partitioning',
    summary: 'Split numbers into tens and ones.',
    cards: [
      { title: 'Tens and ones', text: 'Break 34 into 30 and 4.', example: ['34 = 30 + 4', '25 = 20 + 5'] },
      { title: 'Add the parts', text: 'Add tens with tens and ones with ones.', example: ['30 + 20 = 50', '4 + 5 = 9', '50 + 9 = 59'] },
      { title: 'Taking away', text: 'You can take away the tens and then the ones.', example: ['78 − 35', '78 − 30 = 48', '48 − 5 = 43'] },
    ],
  },
  {
    id: 'left-to-right',
    title: 'Adding from the left',
    summary: 'Start with the biggest parts. Your answer takes shape early.',
    cards: [
      { title: 'Biggest first', text: 'Start with the tens, then add the ones.', example: ['47 + 36', '40 + 30 = 70'] },
      { title: 'Then the rest', text: 'Add the ones, and put both answers together.', example: ['7 + 6 = 13', '70 + 13 = 83'] },
      { title: 'Why it helps', text: 'You can say a good guess early, and you do not need to remember a carried digit.' },
    ],
  },
  {
    id: 'times-patterns',
    title: 'Times table patterns',
    summary: 'Spot the patterns in the 2, 5, 9 and 10 times tables.',
    cards: [
      { title: 'Twos and tens', text: 'Times 2 is a double. Times 10 puts a zero on the end.', example: ['2 × 7 = 14', '10 × 7 = 70'] },
      { title: 'Fives', text: 'Times 5 is half of times 10. The answers end in 0 or 5.', example: ['5 × 6', '10 × 6 = 60', 'half of 60 is 30'] },
      { title: 'Nines', text: 'Times 9 is times 10 take away one group.', example: ['9 × 7', '70 − 7 = 63'] },
    ],
  },
]

export function strategyById(id: string): Strategy | undefined {
  return STRATEGIES.find((s) => s.id === id)
}
