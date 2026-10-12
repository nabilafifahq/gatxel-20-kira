import type { Rng } from '@kira/core/rng'
import type { IconName } from '@kira/figures/spec'
import {
  DIGITS19,
  O,
  PLACE1,
  PLACES,
  SURVEYS,
  T,
  WORD,
  addPairWith,
  addSteps,
  arrangements,
  art,
  biggerReason,
  borrowFlags,
  cap,
  columnFig,
  digitAt,
  figChoice,
  lc,
  listAnd,
  numChoice,
  numbersFor,
  oneOf,
  pickName,
  range,
  regionOf,
  roundTo,
  rulePair,
  subPairWith,
  subSteps,
  symCount,
  textChoice,
  twoNames,
  withSolutions,
  type Fig,
  type NumRule,
  type Step,
} from './g3'
import { fmt, mcqFrom, numberWords, ordinal, plural } from './helpers'
import type { GeneratedItem, Generator } from './types'

/** Generator Math Grade 4 (Cambridge Primary Stage 4). Bantuan bersama ada di g3.ts. */

const Th = (n: number): string => plural(n, 'thousand', 'thousands')
const Hd = (n: number): string => plural(n, 'hundred', 'hundreds')

// ---------------------------------------------------------------------------
// Np: nilai tempat, membandingkan, pembulatan
// ---------------------------------------------------------------------------

const placeValue4: Generator = {
  skill: 'm4.place-value',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const blocks = (): GeneratedItem => {
      const th = rng.int(1, 9)
      const h = rng.int(0, 9)
      const t = rng.int(0, 9)
      const o = rng.int(1, 9)
      const n = th * 1000 + h * 100 + t * 10 + o
      const figure: Fig = { kind: 'basetens', thousands: th, hundreds: h, tens: t, ones: o, alt: `Base ten blocks: ${Th(th)}, ${Hd(h)}, ${T(t)} and ${O(o)}.` }
      return {
        type: 'numeric',
        prompt: 'What number do the blocks show?',
        figure,
        answer: n,
        hints: ['Count each kind of block on its own.', 'A big cube is 1,000, a flat is 100, a stick is 10 and a small cube is 1.', `The ${Th(th)} ${th === 1 ? 'makes' : 'make'} ${fmt(th * 1000)}.`],
        explanation: `${fmt(th * 1000)} + ${h * 100} + ${t * 10} + ${o} = ${fmt(n)}.${h === 0 || t === 0 ? ' A 0 holds the place of an empty column.' : ''}`,
        solution: [
          { say: 'Find the value of each kind of block.', figure, show: `${fmt(th * 1000)}, ${h * 100}, ${t * 10}, ${o}` },
          { say: 'Add the values. Use 0 for any empty column.', show: `${fmt(th * 1000)} + ${h * 100} + ${t * 10} + ${o} = ${fmt(n)}` },
        ],
      }
    }

    const digitValue = (): GeneratedItem => {
      const ds = rng.sample(DIGITS19, 4)
      const n = Number(ds.join(''))
      const pos = rng.int(0, 3)
      const d = digitAt(n, pos)
      const value = d * 10 ** pos
      const others = [0, 1, 2, 3].filter((p) => p !== pos).map((p) => ({
        value: d * 10 ** p,
        why: p === 0 ? `${d} is the digit on its own. In the ${PLACES[pos]} column it is worth more.` : `${fmt(d * 10 ** p)} would be right if the ${d} were in the ${PLACES[p]} column.`,
      }))
      return {
        type: 'mcq',
        prompt: `What is the value of the digit ${d} in ${fmt(n)}?`,
        ...mcqFrom(rng, value, others),
        hints: [`Find the digit ${d} in ${fmt(n)}.`, 'From the right, the columns are ones, tens, hundreds and thousands.', `The ${d} is in the ${PLACES[pos]} column.`],
        explanation: `In ${fmt(n)}, the ${d} is in the ${PLACES[pos]} column, so it is worth ${fmt(value)}.`,
      }
    }

    const partition = (): GeneratedItem => {
      const th = rng.int(1, 9)
      const h = rng.int(0, 9)
      const t = rng.int(1, 9)
      const o = rng.int(0, 9)
      const n = th * 1000 + h * 100 + t * 10 + o
      const parts = [th * 1000, h * 100, t * 10, o]
      const choices = [0, 1, 2].filter((i) => parts[i]! > 0)
      const miss = rng.pick(choices)
      const place = 3 - miss
      const shown = parts.map((p, i) => (i === miss ? '___' : fmt(p))).filter((x, i) => i === miss || parts[i]! > 0).join(' + ')
      return {
        type: 'numeric',
        prompt: `Find the missing number. ${fmt(n)} = ${shown}`,
        answer: parts[miss]!,
        hints: [`Split ${fmt(n)} into thousands, hundreds, tens and ones.`, 'Each part is the value of one digit.', `Look at the ${PLACES[place]} digit of ${fmt(n)}. It is ${digitAt(n, place)}.`],
        explanation: `${fmt(n)} = ${parts.filter((p) => p > 0).map(fmt).join(' + ')}, so the missing number is ${fmt(parts[miss]!)}.`,
      }
    }

    const words = (): GeneratedItem => {
      const th = rng.int(1, 9)
      const h = rng.chance(0.3) ? 0 : rng.int(1, 9)
      const t = rng.chance(0.3) ? 0 : rng.int(1, 9)
      const o = rng.int(0, 9)
      const n = th * 1000 + h * 100 + t * 10 + o
      const w = numberWords(n)
      return {
        type: 'numeric',
        prompt: `Write ${w} in digits.`,
        answer: n,
        hints: ['Listen for the thousands first, then the hundreds, tens and ones.', 'Write one digit in each of the four columns. Use 0 for an empty column.', `${cap(numberWords(th))} thousand means ${th} in the thousands column.`],
        explanation: `${cap(w)} is ${Th(th)}, ${Hd(h)}, ${T(t)} and ${O(o)}, so it is written ${fmt(n)}.`,
      }
    }

    const times10 = (): GeneratedItem => {
      const kind = rng.int(0, 3)
      let q = ''
      let ans = 0
      let a = 0
      let k = 10
      if (kind === 0) {
        a = rng.int(12, 999)
        k = 10
        q = `${a} × 10`
        ans = a * 10
      } else if (kind === 1) {
        a = rng.int(2, 99)
        k = 100
        q = `${a} × 100`
        ans = a * 100
      } else if (kind === 2) {
        ans = rng.int(12, 999)
        a = ans * 10
        k = 10
        q = `${fmt(a)} ÷ 10`
      } else {
        ans = rng.int(2, 99)
        a = ans * 100
        k = 100
        q = `${fmt(a)} ÷ 100`
      }
      const mult = kind <= 1
      const shift = k === 10 ? 'one place' : 'two places'
      const wrong = [
        { value: mult ? a * (k === 10 ? 100 : 10) : a / (k === 10 ? 100 : 10), why: `This ${mult ? 'multiplies' : 'divides'} by ${k === 10 ? 100 : 10}. The question uses ${k}.` },
        { value: mult ? a / k : a * k, why: `This ${mult ? 'divides' : 'multiplies'}. The question asks you to ${mult ? 'multiply' : 'divide'}.` },
        { value: mult ? a + k : a - k, why: `This ${mult ? 'adds' : 'takes away'} ${k}. ${mult ? 'Multiplying' : 'Dividing'} by ${k} moves every digit ${shift}.` },
      ].filter((w) => Number.isInteger(w.value) && w.value > 0)
      return {
        type: 'mcq',
        prompt: `What is ${q}?`,
        ...numChoice(rng, ans, wrong),
        hints: [`${mult ? 'Multiplying' : 'Dividing'} by ${k} moves every digit ${shift} ${mult ? 'to the left' : 'to the right'}.`, mult ? `Each digit becomes ${k} times bigger.` : `Each digit becomes ${k} times smaller.`, `Write ${fmt(a)} in a place value chart first.`],
        explanation: `${q} = ${fmt(ans)}. Every digit moves ${shift} ${mult ? 'to the left' : 'to the right'}.`,
        solution: [
          { say: `Write ${fmt(a)} in a place value chart.`, show: fmt(a) },
          { say: `Move every digit ${shift} ${mult ? 'to the left and fill the gaps with 0' : 'to the right'}.`, show: `${q} = ${fmt(ans)}` },
        ],
      }
    }

    const regroup = (): GeneratedItem => {
      const th = rng.int(2, 7)
      const h = rng.int(10, 15)
      const t = rng.int(1, 9)
      const n = th * 1000 + h * 100 + t * 10
      return {
        type: 'numeric',
        prompt: `What number is ${Th(th)}, ${h} hundreds and ${T(t)}?`,
        answer: n,
        hints: ['There are more than 9 hundreds.', '10 hundreds make 1 thousand.', `${h} hundreds make ${fmt(h * 100)}.`],
        explanation: `${fmt(th * 1000)} + ${fmt(h * 100)} + ${t * 10} = ${fmt(n)}.`,
      }
    }

    const story = (): GeneratedItem => {
      const name = pickName(rng)
      const kind = rng.int(0, 2)
      if (kind === 0) {
        const b = rng.int(12, 89)
        const thing = rng.pick(['pencils', 'sheets of paper', 'paper cups', 'stickers'])
        return {
          type: 'numeric',
          prompt: `A school buys ${b} boxes of ${thing}. Each box has 100 ${thing}. How many ${thing} is that?`,
          answer: b * 100,
          hints: ['Each box has the same number.', `Work out ${b} × 100.`, 'Multiplying by 100 moves each digit two places to the left.'],
          explanation: `${b} × 100 = ${fmt(b * 100)} ${thing}.`,
          tags: WORD,
        }
      }
      if (kind === 1) {
        const packs = rng.int(120, 950)
        return {
          type: 'numeric',
          prompt: `A shop has ${fmt(packs * 10)} stickers in packs of 10. How many packs are there?`,
          answer: packs,
          hints: ['Find how many tens are in the number.', `Work out ${fmt(packs * 10)} ÷ 10.`, 'Dividing by 10 moves each digit one place to the right.'],
          explanation: `${fmt(packs * 10)} ÷ 10 = ${packs} packs.`,
          tags: WORD,
        }
      }
      const withZero = rng.chance(0.5)
      const ds = withZero ? [0, ...rng.sample(DIGITS19, 3)] : rng.sample(DIGITS19, 4)
      const shown = rng.shuffle(ds).map(String)
      const all = arrangements(ds)
      const largest = rng.chance(0.5)
      const ans = largest ? all[all.length - 1]! : all[0]!
      return {
        type: 'numeric',
        prompt: `${name} has the digit cards ${listAnd(shown)}. What is the ${largest ? 'largest' : 'smallest'} 4-digit number ${name} can make?`,
        figure: { kind: 'sequence', items: shown, style: 'boxes', alt: `Digit cards ${listAnd(shown)}.` },
        answer: ans,
        hints: ['The thousands digit matters most.', largest ? 'Put the digits in order from biggest to smallest.' : 'Put the smallest digit you can first. A 4-digit number cannot start with 0.', `The thousands digit should be ${digitAt(ans, 3)}.`],
        explanation: `${fmt(ans)} has the ${largest ? 'largest' : 'smallest'} possible digit in each column, starting with the thousands.`,
        tags: WORD,
      }
    }

    const evenOdd = (): GeneratedItem => {
      const ds = rng.sample(range(0, 9), 4)
      const even = rng.chance(0.5)
      const largest = rng.chance(0.5)
      const all = arrangements(ds).filter((x) => (x % 2 === 0) === even)
      if (all.length === 0) return story()
      const ans = largest ? all[all.length - 1]! : all[0]!
      const shown = rng.shuffle(ds).map(String)
      return {
        type: 'numeric',
        prompt: `Use each card once: ${listAnd(shown)}. What is the ${largest ? 'largest' : 'smallest'} ${even ? 'even' : 'odd'} 4-digit number you can make?`,
        figure: { kind: 'sequence', items: shown, style: 'boxes', alt: `Digit cards ${listAnd(shown)}.` },
        answer: ans,
        hints: [`An ${even ? 'even' : 'odd'} number must end in ${even ? '0, 2, 4, 6 or 8' : '1, 3, 5, 7 or 9'}.`, `Choose the ones digit first, then make the rest as ${largest ? 'large' : 'small'} as possible.`, `Which cards could go in the ones column?`],
        explanation: `${fmt(ans)} ends in ${ans % 10}, so it is ${even ? 'even' : 'odd'}, and its other digits are as ${largest ? 'large' : 'small'} as they can be.`,
      }
    }

    if (level === 1) return oneOf(rng, [blocks, digitValue])
    if (level === 2) return oneOf(rng, [partition, words])
    if (level === 3) return oneOf(rng, [times10, regroup])
    if (level === 4) return story()
    return evenOdd()
  },
}

const MOUNTAINS = [
  { name: 'Kerinci', h: 3805 },
  { name: 'Rinjani', h: 3726 },
  { name: 'Semeru', h: 3676 },
  { name: 'Slamet', h: 3428 },
  { name: 'Arjuno', h: 3339 },
  { name: 'Lawu', h: 3265 },
  { name: 'Bromo', h: 2329 },
] as const

const compareOrder4: Generator = {
  skill: 'm4.compare-order',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const extreme = (): GeneratedItem => {
      const ths = rng.sample(DIGITS19, 4)
      const nums = ths.map((t) => t * 1000 + rng.int(0, 999))
      const largest = rng.chance(0.5)
      const ans = largest ? Math.max(...nums) : Math.min(...nums)
      return {
        type: 'mcq',
        prompt: `Which number is the ${largest ? 'largest' : 'smallest'}?`,
        ...numChoice(rng, ans, nums.filter((x) => x !== ans).map((x) => ({ value: x, why: largest ? `${biggerReason(ans, x)}, so ${fmt(ans)} is larger.` : `${biggerReason(x, ans)}, so ${fmt(ans)} is smaller.` }))),
        hints: ['Compare the thousands digits first.', largest ? 'The number with the most thousands is the largest.' : 'The number with the fewest thousands is the smallest.', 'Write the thousands digit of each number.'],
        explanation: `${fmt(ans)} has the ${largest ? 'most' : 'fewest'} thousands, so it is the ${largest ? 'largest' : 'smallest'}.`,
      }
    }

    const statement = (): GeneratedItem => {
      const th = rng.int(1, 9)
      const p = rng.int(0, 2)
      const [x, y] = rng.sample(range(0, 9), 2) as [number, number]
      const rest = () => rng.int(0, 9)
      const digs = (d: number) => {
        const arr = [th, rest(), rest(), rest()]
        arr[3 - p] = d
        return Number(arr.join(''))
      }
      let a = digs(x)
      let b = digs(y)
      if (p < 2) {
        const hi = digitAt(a, 2)
        b = Number([th, hi, ...String(b).slice(2)].join(''))
      }
      if (a === b) b += 1
      const correct = a > b ? `${fmt(a)} > ${fmt(b)}` : `${fmt(a)} < ${fmt(b)}`
      const big = Math.max(a, b)
      const small = Math.min(a, b)
      return {
        type: 'mcq',
        prompt: 'Which of these is true?',
        ...textChoice(rng, correct, [
          { value: a > b ? `${fmt(a)} < ${fmt(b)}` : `${fmt(a)} > ${fmt(b)}`, why: `${fmt(big)} is bigger than ${fmt(small)}, so this sign points the wrong way.` },
          { value: `${fmt(a)} = ${fmt(b)}`, why: 'The numbers have different digits, so they are not equal.' },
          { value: a > b ? `${fmt(b)} > ${fmt(a)}` : `${fmt(b)} < ${fmt(a)}`, why: `This says ${fmt(b)} is ${a > b ? 'greater' : 'less'} than ${fmt(a)}. Compare the digits again from the left.` },
        ]),
        hints: ['Compare the digits from the left, one column at a time.', '> means is greater than. < means is less than.', `Both numbers have ${Th(th)}. Move to the next column.`],
        explanation: `${biggerReason(big, small)}, so ${fmt(big)} is greater. ${correct} is true.`,
      }
    }

    const order = (): GeneratedItem => {
      const ds = rng.sample(range(0, 9), 4)
      const all = arrangements(ds)
      const picked = rng.sample(all, 5)
      const asc = rng.chance(0.5)
      const sorted = [...picked].sort((x, y) => (asc ? x - y : y - x))
      return {
        type: 'order',
        prompt: `Put the numbers in order, starting with the ${asc ? 'smallest' : 'largest'}.`,
        items: sorted.map(fmt),
        hints: ['Compare the thousands first.', 'If the thousands match, compare the hundreds, then the tens, then the ones.', `${fmt(sorted[0]!)} is the ${asc ? 'smallest' : 'largest'}, so it goes first.`],
        explanation: `In order: ${sorted.map(fmt).join(', ')}.`,
      }
    }

    const line = (): GeneratedItem => {
      if (rng.chance(0.5)) {
        const k = rng.pick([1, 3, 5, 7, 9, 11, 13, 15, 17, 19])
        const ans = k * 500
        return {
          type: 'numberline',
          prompt: `Show where ${fmt(ans)} goes on the number line.`,
          min: 0,
          max: 10000,
          step: 500,
          answer: ans,
          hints: ['The line goes from 0 to 10,000.', 'Each small step is 500, so two steps make 1,000.', `${fmt(ans)} is halfway between ${fmt(ans - 500)} and ${fmt(ans + 500)}.`],
          explanation: `Each step is 500. ${fmt(ans)} sits on the mark halfway between ${fmt(ans - 500)} and ${fmt(ans + 500)}.`,
        }
      }
      const th = rng.int(1, 8) * 1000
      const k = rng.int(1, 9)
      const ans = th + k * 100
      return {
        type: 'numberline',
        prompt: `Show where ${fmt(ans)} goes on the number line.`,
        min: th,
        max: th + 1000,
        step: 100,
        answer: ans,
        hints: [`The line goes from ${fmt(th)} to ${fmt(th + 1000)}.`, 'Each small step is 100.', `Count on in hundreds from ${fmt(th)}: ${fmt(th + 100)}, ${fmt(th + 200)}, ...`],
        explanation: `${fmt(ans)} is ${k} steps of 100 after ${fmt(th)}.`,
      }
    }

    const mountains = (): GeneratedItem => {
      const ms = rng.sample(MOUNTAINS, 4)
      const figure: Fig = { kind: 'table', head: ['Mountain', 'Height (m)'], rows: ms.map((m) => [m.name, fmt(m.h)]), alt: `Heights of mountains in Indonesia: ${ms.map((m) => `${m.name} ${fmt(m.h)} m`).join(', ')}.` }
      if (rng.chance(0.5)) {
        const sorted = [...ms].sort((a, b) => b.h - a.h)
        return {
          type: 'order',
          prompt: 'The table shows the heights of some mountains in Indonesia. Order them from highest to lowest.',
          figure,
          items: sorted.map((m) => m.name),
          hints: ['Compare the heights, starting with the thousands.', 'If the thousands match, compare the hundreds.', `${sorted[0]!.name} is ${fmt(sorted[0]!.h)} m.`],
          explanation: `Highest to lowest: ${sorted.map((m) => `${m.name} (${fmt(m.h)} m)`).join(', ')}.`,
          tags: WORD,
        }
      }
      const low = rng.chance(0.4)
      const ans = [...ms].sort((a, b) => (low ? a.h - b.h : b.h - a.h))[0]!
      return {
        type: 'mcq',
        prompt: `The table shows the heights of some mountains in Indonesia. Which mountain is the ${low ? 'lowest' : 'highest'}?`,
        figure,
        ...textChoice(rng, ans.name, ms.filter((m) => m !== ans).map((m) => ({ value: m.name, why: `${m.name} is ${fmt(m.h)} m. ${low ? biggerReason(m.h, ans.h) : biggerReason(ans.h, m.h)}.` }))),
        hints: ['Compare the heights, starting with the thousands.', 'If the thousands match, compare the hundreds.', 'Write the hundreds digit of each height.'],
        explanation: `${ans.name} is ${fmt(ans.h)} m, the ${low ? 'lowest' : 'highest'} in the table.`,
        tags: WORD,
      }
    }

    const between = (): GeneratedItem => {
      const t = rng.int(2, 9) * 1000
      const a = t - rng.int(2, 6)
      const b = t + rng.int(2, 6)
      return {
        type: 'numeric',
        prompt: `How many whole numbers are bigger than ${fmt(a)} and smaller than ${fmt(b)}?`,
        answer: b - a - 1,
        hints: [`List the numbers after ${fmt(a)}.`, `Do not count ${fmt(a)} or ${fmt(b)}.`, `The first one is ${fmt(a + 1)}.`],
        explanation: `The numbers are ${listAnd(range(a + 1, b - 1).map(fmt))}. That is ${b - a - 1} numbers.`,
      }
    }

    if (level === 1) return extreme()
    if (level === 2) return statement()
    if (level === 3) return oneOf(rng, [order, line])
    if (level === 4) return mountains()
    return between()
  },
}

const rounding4: Generator = {
  skill: 'm4.rounding',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const round = (p: 10 | 100 | 1000): GeneratedItem => {
      let n = rng.int(1001, 9989)
      if (rng.chance(0.2)) n = Math.floor(n / p) * p + p / 2
      if (n % p === 0) n += p === 10 ? 3 : p === 100 ? 37 : 412
      const lo = Math.floor(n / p) * p
      const hi = lo + p
      const ans = roundTo(n, p)
      const dp = p === 10 ? 0 : p === 100 ? 1 : 2
      const d = digitAt(n, dp)
      const up = d >= 5
      const hints = [`Which two multiples of ${fmt(p)} is ${fmt(n)} between?`, `Look at the ${PLACES[dp]} digit. 5 or more rounds up.`, `${fmt(n)} is between ${fmt(lo)} and ${fmt(hi)}.`]
      const explanation = `${fmt(n)} is between ${fmt(lo)} and ${fmt(hi)}. The ${PLACES[dp]} digit is ${d}, so it rounds ${up ? 'up' : 'down'} to ${fmt(ans)}.`
      const figure: Fig = { kind: 'numberline', min: lo, max: hi, step: p / 10, labels: [lo, lo + p / 2, hi], marks: [{ at: n, label: fmt(n) }], alt: `A number line from ${fmt(lo)} to ${fmt(hi)} with ${fmt(n)} marked.` }
      if (rng.chance(0.5)) return { type: 'numeric', prompt: `Round ${fmt(n)} to the nearest ${fmt(p)}.`, figure, answer: ans, hints, explanation }
      const others = ([10, 100, 1000] as const).filter((q) => q !== p).map((q) => ({ value: roundTo(n, q), why: `This is ${fmt(n)} rounded to the nearest ${fmt(q)}.` }))
      return {
        type: 'mcq',
        prompt: `Round ${fmt(n)} to the nearest ${fmt(p)}.`,
        ...numChoice(rng, ans, [{ value: up ? lo : hi, why: `The ${PLACES[dp]} digit is ${d}, so ${fmt(n)} rounds ${up ? 'up' : 'down'}.` }, ...others], { spread: [2 * p, -2 * p] }),
        hints,
        explanation,
      }
    }

    const which = (): GeneratedItem => {
      const target = rng.int(2, 9) * 1000
      const ans = rng.chance(0.5) ? target - 500 + rng.int(1, 99) : target + 499 - rng.int(1, 99)
      const ds = [target - 501 - rng.int(0, 50), target + 500 + rng.int(0, 90), target - 1000 + rng.int(-200, 200), target + 1000 - rng.int(0, 400)]
      return {
        type: 'mcq',
        prompt: `Which number rounds to ${fmt(target)} when rounded to the nearest 1,000?`,
        ...numChoice(rng, ans, ds.map((x) => ({ value: x, why: `${fmt(x)} rounds to ${fmt(roundTo(x, 1000))}.` }))),
        hints: ['Round each number to the nearest 1,000.', 'Look at the hundreds digit of each number.', `A number rounds to ${fmt(target)} if it is from ${fmt(target - 500)} up to ${fmt(target + 499)}.`],
        explanation: `${fmt(ans)} is between ${fmt(target - 500)} and ${fmt(target + 499)}, so it rounds to ${fmt(target)}.`,
      }
    }

    const estimate = (): GeneratedItem => {
      const add = rng.chance(0.6)
      let a = add ? rng.int(1200, 6400) : rng.int(3200, 9400)
      let b = rng.int(1100, add ? 3400 : a - 1500)
      if (a % 1000 === 500) a += 7
      if (b % 1000 === 500) b -= 9
      const ra = roundTo(a, 1000)
      const rb = roundTo(b, 1000)
      const ans = add ? ra + rb : ra - rb
      const story = rng.chance(0.5)
      const what = rng.pick([{ n: 'visitors came to a museum', a: 'on Saturday', b: 'on Sunday' }, { n: 'people ran in a fun run', a: 'this year', b: 'last year' }])
      return {
        type: 'numeric',
        prompt: story && add
          ? `${fmt(a)} ${what.n} ${what.a} and ${fmt(b)} ${what.b}. Round each number to the nearest 1,000 to estimate the total.`
          : `Estimate ${fmt(a)} ${add ? '+' : '-'} ${fmt(b)} by rounding each number to the nearest 1,000.`,
        answer: ans,
        hints: ['Round each number first.', `Look at the hundreds digit of ${fmt(a)} and of ${fmt(b)}.`, `${fmt(a)} rounds to ${fmt(ra)}.`],
        explanation: `${fmt(a)} rounds to ${fmt(ra)} and ${fmt(b)} rounds to ${fmt(rb)}. ${fmt(ra)} ${add ? '+' : '-'} ${fmt(rb)} = ${fmt(ans)}.`,
        ...(story && add ? { tags: WORD } : {}),
      }
    }

    const edge = (): GeneratedItem => {
      const p = rng.pick([100, 1000] as const)
      const target = p === 100 ? rng.int(12, 98) * 100 : rng.int(2, 9) * 1000
      const small = rng.chance(0.5)
      const ans = small ? target - p / 2 : target + p / 2 - 1
      return {
        type: 'numeric',
        prompt: `What is the ${small ? 'smallest' : 'largest'} whole number that rounds to ${fmt(target)} to the nearest ${fmt(p)}?`,
        answer: ans,
        hints: ['Think about the numbers just below and just above.', 'A number exactly halfway rounds up.', small ? `${fmt(target - p / 2 - 1)} rounds down to ${fmt(target - p)}. Try the next number.` : `${fmt(target + p / 2)} rounds up to ${fmt(target + p)}. Try the number before it.`],
        explanation: small ? `${fmt(ans)} is exactly halfway, so it rounds up to ${fmt(target)}.` : `${fmt(ans)} rounds down to ${fmt(target)}, but ${fmt(ans + 1)} rounds up.`,
      }
    }

    if (level === 1) return round(10)
    if (level === 2) return round(100)
    if (level === 3) return round(1000)
    if (level === 4) return oneOf(rng, [which, estimate])
    return edge()
  },
}

// ---------------------------------------------------------------------------
// Ni: bilangan negatif
// ---------------------------------------------------------------------------

const deg = (n: number): string => `${n} °C`

const negative4: Generator = {
  skill: 'm4.negative-numbers',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const read = (): GeneratedItem => {
      const sc = rng.pick([
        { min: -10, max: 20, step: 2 },
        { min: -20, max: 20, step: 5 },
        { min: -10, max: 10, step: 1 },
      ])
      const pos = rng.chance(0.25)
      // nilai positif tidak sama dengan nilai satu tanda, supaya petunjuk tidak memuat jawaban
      const v = pos ? rng.int(2, sc.max / sc.step - 1) * sc.step : -rng.int(1, -sc.min / sc.step - 1) * sc.step
      return {
        type: 'numeric',
        prompt: 'What temperature does the thermometer show?',
        figure: { kind: 'thermometer', min: sc.min, max: sc.max, value: v, step: sc.step, alt: `A thermometer from ${sc.min} to ${sc.max} degrees Celsius, marked every ${sc.step} ${sc.step === 1 ? 'degree' : 'degrees'}. It shows ${deg(v)}.` },
        answer: v,
        allowNegative: true,
        unit: '°C',
        hints: ['Find zero on the thermometer first.', 'Temperatures below zero are negative numbers.', `Each mark is ${sc.step} ${sc.step === 1 ? 'degree' : 'degrees'}. Count from 0 to the top of the line.`],
        explanation: v < 0 ? `The line is ${-v} degrees below zero, so the temperature is ${deg(v)}.` : `The line is ${v} degrees above zero, so the temperature is ${deg(v)}.`,
      }
    }

    const line = (): GeneratedItem => {
      const ans = -rng.int(1, 9)
      return {
        type: 'numberline',
        prompt: `Show ${ans} on the number line.`,
        min: -10,
        max: 10,
        step: 1,
        answer: ans,
        hints: ['Find 0 in the middle of the line.', 'Negative numbers are to the left of 0.', `Count ${plural(-ans, 'step', 'steps')} to the left of 0.`],
        explanation: `${ans} is ${plural(-ans, 'step', 'steps')} to the left of 0.`,
      }
    }

    const colder = (): GeneratedItem => {
      const [a, b] = rng.sample(range(-9, 6).filter((x) => x !== 0), 2) as [number, number]
      const askCold = rng.chance(0.5)
      const ans = askCold ? Math.min(a, b) : Math.max(a, b)
      const other = ans === a ? b : a
      return {
        type: 'mcq',
        prompt: `Which is ${askCold ? 'colder' : 'warmer'}: ${deg(a)} or ${deg(b)}?`,
        ...textChoice(rng, deg(ans), [
          { value: deg(other), why: `${other} is ${other > ans ? 'higher' : 'lower'} on the thermometer than ${ans}.` },
          { value: 'They are the same', why: `${a} and ${b} are different temperatures.` },
          { value: deg(-ans === other ? ans - 1 : -ans), why: `This temperature is not one of the two in the question.` },
        ]),
        hints: ['Picture a thermometer: higher numbers are warmer.', 'Below zero, the bigger the number after the minus sign, the colder it is.', 'Put both temperatures on a number line.'],
        explanation: `${deg(ans)} is ${askCold ? 'lower' : 'higher'} on the thermometer, so it is ${askCold ? 'colder' : 'warmer'}.`,
      }
    }

    const order = (): GeneratedItem => {
      const temps = rng.sample(range(-9, 9), 5)
      const sorted = [...temps].sort((a, b) => a - b)
      return {
        type: 'order',
        prompt: 'Put the temperatures in order, from coldest to warmest.',
        items: sorted.map(deg),
        hints: ['Negative temperatures are colder than zero.', 'The bigger the number after the minus sign, the colder it is.', `The coldest is ${deg(sorted[0]!)}.`],
        explanation: `Coldest to warmest: ${sorted.map(deg).join(', ')}.`,
      }
    }

    const change = (): GeneratedItem => {
      const kind = rng.int(0, 2)
      if (kind === 0) {
        const a = -rng.int(2, 8)
        const up0 = rng.int(-a + 1, -a + 9)
        const up = a + up0 === -a ? up0 + 1 : up0
        return {
          type: 'numeric',
          prompt: `It is ${deg(a)}. The temperature rises by ${up} degrees. What is the temperature now?`,
          answer: a + up,
          allowNegative: true,
          unit: '°C',
          hints: ['Rises means it gets warmer, so count up.', `First count up from ${a} to 0. That is ${-a} degrees.`, `After 0, count up the rest of the ${up} degrees.`],
          explanation: `${a} up ${-a} degrees is 0. ${up - -a} more degrees makes ${deg(a + up)}.`,
          solution: [
            { say: `Start at ${a} on a number line.`, figure: { kind: 'numberline', min: -10, max: 10, step: 1, labels: [-10, -5, 0, 5, 10], jumps: [{ from: a, to: 0 }, { from: 0, to: a + up }], alt: `A number line with a jump from ${a} to 0 and from 0 to ${a + up}.` } },
            { say: 'Count up to 0 first.', show: `${a} + ${-a} = 0` },
            { say: 'Then count on the rest.', show: `0 + ${up + a} = ${a + up}` },
          ],
          tags: WORD,
        }
      }
      if (kind === 1) {
        const a = rng.int(2, 7)
        const down = rng.int(a + 1, a + 8)
        return {
          type: 'numeric',
          prompt: `It is ${deg(a)}. The temperature falls by ${down} degrees. What is the temperature now?`,
          answer: a - down,
          allowNegative: true,
          unit: '°C',
          hints: ['Falls means it gets colder, so count down.', `First count down from ${a} to 0. That is ${a} degrees.`, `Then count down ${down - a} more below 0.`],
          explanation: `${a} down ${a} degrees is 0. ${down - a} more degrees below 0 is ${deg(a - down)}.`,
          tags: WORD,
        }
      }
      const a = -rng.int(2, 9)
      const b = rng.int(2, 12)
      return {
        type: 'numeric',
        prompt: `In the morning it was ${deg(a)}. In the afternoon it was ${deg(b)}. How many degrees warmer was it in the afternoon?`,
        answer: b - a,
        unit: '°C',
        hints: ['Count up from the lower temperature to the higher one.', `Count from ${a} up to 0, then from 0 up to ${b}.`, `From ${a} to 0 is ${-a} degrees.`],
        explanation: `${-a} degrees up to 0 and ${b} more degrees to ${b}. ${-a} + ${b} = ${b - a} degrees.`,
        tags: WORD,
      }
    }

    const cities = (): GeneratedItem => {
      const data = rng.sample([
        { c: 'Moscow', t: rng.int(-12, -5) },
        { c: 'Oslo', t: rng.int(-8, -3) },
        { c: 'Seoul', t: rng.int(-6, -1) },
        { c: 'London', t: rng.int(1, 6) },
        { c: 'Tokyo', t: rng.int(3, 9) },
        { c: 'Jakarta', t: rng.int(26, 31) },
      ], 4)
      if (!data.some((d) => d.t < 0)) data[0] = { c: 'Moscow', t: -9 }
      const temps = data.map((d) => d.t)
      if (new Set(temps).size < 4) return change()
      const figure: Fig = { kind: 'table', head: ['City', 'Temperature'], rows: data.map((d) => [d.c, deg(d.t)]), alt: `Temperatures on a January morning: ${data.map((d) => `${d.c} ${deg(d.t)}`).join(', ')}.` }
      const hot = data.reduce((a, b) => (b.t > a.t ? b : a))
      const cold = data.reduce((a, b) => (b.t < a.t ? b : a))
      return {
        type: 'numeric',
        prompt: `The table shows the temperature in four cities on a January morning. How much warmer was ${hot.c} than ${cold.c}?`,
        figure,
        answer: hot.t - cold.t,
        unit: '°C',
        hints: ['Count up from the colder temperature to the warmer one.', 'Count up to 0 first, then on to the warmer temperature.', `From ${deg(cold.t)} to 0 is ${-cold.t} degrees.`],
        explanation: `${-cold.t} degrees from ${deg(cold.t)} up to 0, then ${hot.t} more. ${-cold.t} + ${hot.t} = ${hot.t - cold.t} degrees.`,
        tags: WORD,
      }
    }

    const fallEachHour = (): GeneratedItem => {
      const a = rng.int(2, 6)
      const k = rng.int(2, 3)
      const hrs = rng.int(3, 5)
      const ans = a - k * hrs
      if (ans >= 0) return change()
      return {
        type: 'numeric',
        prompt: `At midnight on a mountain it was ${deg(a)}. The temperature fell by ${k} degrees every hour. What was the temperature after ${hrs} hours?`,
        answer: ans,
        allowNegative: true,
        unit: '°C',
        hints: ['Count back in equal steps, one step for each hour.', `It falls ${k} degrees each hour, so count back in ${k}s.`, `After 1 hour it was ${deg(a - k)}.`],
        explanation: `${a}, ${listAnd(range(1, hrs).map((i) => String(a - k * i)))}. After ${hrs} hours it was ${deg(ans)}.`,
        tags: WORD,
      }
    }

    const countBack = (): GeneratedItem => {
      const k = rng.int(2, 5)
      const a = rng.int(k, 3 * k)
      const n = rng.int(5, 8)
      const term = (i: number) => a - (i - 1) * k
      return {
        type: 'numeric',
        prompt: `${pickName(rng)} counts back in ${k}s: ${term(1)}, ${term(2)}, ${term(3)}, ... What is the ${ordinal(n)} number?`,
        answer: term(n),
        allowNegative: true,
        hints: ['Keep counting back past zero.', 'Numbers below zero are negative.', `The 4th number is ${term(4)}.`],
        explanation: `${range(1, n).map((i) => term(i)).join(', ')}. The ${ordinal(n)} number is ${term(n)}.`,
      }
    }

    if (level === 1) return oneOf(rng, [read, line])
    if (level === 2) return oneOf(rng, [colder, order])
    if (level === 3) return change()
    if (level === 4) return cities()
    return oneOf(rng, [fallEachHour, countBack])
  },
}

// ---------------------------------------------------------------------------
// Nc: barisan
// ---------------------------------------------------------------------------

const sequences4: Generator = {
  skill: 'm4.sequences',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const seq = (steps: readonly number[], middle: boolean, allowNeg = false): GeneratedItem => {
      const step = rng.pick(steps)
      const up = rng.chance(0.55)
      const len = 5
      const span = step * (len - 1)
      const start = up ? rng.int(allowNeg ? -span : 1, Math.max(2, 9999 - span)) : rng.int(allowNeg ? Math.min(span, 9999) - span : span + 1, Math.max(span + 2, Math.min(9999, span * 4)))
      const terms = Array.from({ length: len }, (_, i) => (up ? start + i * step : start - i * step))
      const miss = middle ? rng.int(1, len - 2) : len - 1
      const k = miss >= 2 ? 0 : len - 2
      return {
        type: 'numeric',
        prompt: middle ? 'What is the missing number in the sequence?' : 'What is the next number in the sequence?',
        figure: { kind: 'sequence', items: terms.map((v, i) => (i === miss ? null : fmt(v))), style: 'stones', alt: `A sequence: ${terms.map((v, i) => (i === miss ? 'a missing number' : fmt(v))).join(', ')}.` },
        answer: terms[miss]!,
        allowNegative: terms[miss]! < 0,
        hints: ['Look at how the numbers change from one to the next.', 'Find the difference between two numbers next to each other.', `From ${fmt(terms[k]!)} to ${fmt(terms[k + 1]!)} the numbers go ${up ? 'up' : 'down'} by ${fmt(step)}.`],
        explanation: `The rule is ${up ? 'add' : 'subtract'} ${fmt(step)}. ${fmt(terms[miss - 1]!)} ${up ? '+' : '-'} ${fmt(step)} = ${fmt(terms[miss]!)}.`,
      }
    }

    const thousand = (): GeneratedItem => {
      const n = rng.int(1001, 8999)
      const more = rng.chance(0.5)
      const step = rng.pick([100, 1000])
      const ans = more ? n + step : n - step
      return {
        type: 'numeric',
        prompt: `What is ${fmt(step)} ${more ? 'more' : 'less'} than ${fmt(n)}?`,
        answer: ans,
        hints: [`Which digit changes when you ${more ? 'add' : 'take away'} ${fmt(step)}?`, `Only the ${step === 100 ? 'hundreds' : 'thousands'} digit changes, unless it goes past ${more ? 9 : 0}.`, `The ${step === 100 ? 'hundreds' : 'thousands'} digit of ${fmt(n)} is ${digitAt(n, step === 100 ? 2 : 3)}.`],
        explanation: `${fmt(n)} ${more ? '+' : '-'} ${fmt(step)} = ${fmt(ans)}.`,
      }
    }

    const rule = (): GeneratedItem => {
      const step = rng.pick([6, 7, 9, 25, 50, 250])
      const up = rng.chance(0.5)
      const start = up ? rng.int(10, 3000) : rng.int(2000, 9000)
      const terms = Array.from({ length: 5 }, (_, i) => (up ? start + i * step : start - i * step))
      const w = (s: number, u: boolean) => `${u ? 'add' : 'subtract'} ${s}`
      return {
        type: 'mcq',
        prompt: 'What is the rule for this sequence?',
        figure: { kind: 'sequence', items: terms.map(fmt), style: 'stones', alt: `A sequence: ${terms.map(fmt).join(', ')}.` },
        ...textChoice(rng, w(step, up), [
          { value: w(step, !up), why: `The numbers get ${up ? 'bigger' : 'smaller'}, so the rule must ${up ? 'add' : 'subtract'}.` },
          { value: w(step * 2, up), why: `Check the jump between two numbers next to each other. It is ${step}.` },
          { value: w(step + 1, up), why: `${fmt(terms[0]!)} ${up ? '+' : '-'} ${step + 1} is ${fmt(up ? terms[0]! + step + 1 : terms[0]! - step - 1)}, not the next number.` },
        ]),
        hints: ['Do the numbers get bigger or smaller?', 'Find the difference between two numbers next to each other.', `Compare ${fmt(terms[1]!)} and ${fmt(terms[2]!)}.`],
        explanation: `Each number is ${step} ${up ? 'more' : 'less'} than the one before, so the rule is ${w(step, up)}.`,
      }
    }

    const story = (): GeneratedItem => {
      const kind = rng.int(0, 2)
      const name = pickName(rng)
      if (kind === 0) {
        const h = rng.int(5, 20)
        const g = rng.int(2, 6)
        const w = rng.int(4, 9)
        return {
          type: 'numeric',
          prompt: `A sunflower is ${h} cm tall. It grows ${g} cm every week. How tall is it after ${w} weeks?`,
          answer: h + g * w,
          unit: 'cm',
          hints: ['The height goes up by the same amount each week.', `Add ${g} cm for each of the ${w} weeks.`, `After 1 week it is ${h + g} cm.`],
          explanation: `${h} + ${w} × ${g} = ${h} + ${g * w} = ${h + g * w} cm.`,
          tags: WORD,
        }
      }
      if (kind === 1) {
        const s = rng.int(1, 5) * 5000
        const add = rng.pick([5000, 10000, 15000])
        const w = rng.int(3, 6)
        return {
          type: 'numeric',
          prompt: `${name} has Rp${s.toLocaleString('id-ID')} in a money box and adds Rp${add.toLocaleString('id-ID')} every week. How much is in the box after ${w} weeks?`,
          answer: s + add * w,
          unit: 'rupiah',
          hints: ['The amount goes up by the same each week.', `Add Rp${add.toLocaleString('id-ID')} for each week.`, `After 1 week there is Rp${(s + add).toLocaleString('id-ID')}.`],
          explanation: `Rp${s.toLocaleString('id-ID')} + ${w} × Rp${add.toLocaleString('id-ID')} = Rp${(s + add * w).toLocaleString('id-ID')}.`,
          tags: WORD,
        }
      }
      const k = rng.int(3, 9)
      const a = rng.int(1, k - 1)
      const m = rng.int(8, 20)
      const ans = a + k * m
      const offs = rng.shuffle([1, -1, 2, -2]).filter((d) => d % k !== 0)
      return {
        type: 'mcq',
        prompt: `Which number is in the sequence ${a}, ${a + k}, ${a + 2 * k}, ${a + 3 * k}, ...?`,
        ...numChoice(rng, ans, offs.map((d) => ({ value: ans + d, why: `Numbers in the sequence are ${a} more than a multiple of ${k}. ${ans + d} is not.` })), { spread: [k + 1, -k - 1] }),
        hints: [`The rule is add ${k}.`, `Every number in the sequence is ${a} more than a number in the ${k} times table.`, 'Take the first number away from each answer, then check the ${k} times table.'.replace('${k}', String(k))],
        explanation: `${ans} - ${a} = ${ans - a}, which is ${m} × ${k}. So ${ans} is in the sequence.`,
      }
    }

    const nth = (): GeneratedItem => {
      const k = rng.int(3, 12)
      const a = rng.int(1, 30)
      const n = rng.pick([20, 25, 50, 100])
      return {
        type: 'numeric',
        prompt: `What is the ${ordinal(n)} number in the sequence ${a}, ${a + k}, ${a + 2 * k}, ...?`,
        answer: a + (n - 1) * k,
        hints: ['You do not need to write every number.', `From the 1st number to the ${ordinal(n)} there are ${n - 1} jumps of ${k}.`, `${n - 1} × ${k} = ${(n - 1) * k}.`],
        explanation: `${a} + ${n - 1} × ${k} = ${a} + ${fmt((n - 1) * k)} = ${fmt(a + (n - 1) * k)}.`,
      }
    }

    if (level === 1) return seq([25, 50, 100, 1000], false)
    if (level === 2) return oneOf(rng, [() => seq([6, 7, 9], true), thousand])
    const throughZero = (): GeneratedItem => {
      const step = rng.int(2, 6)
      const start = rng.int(step, 3 * step)
      const terms = Array.from({ length: 5 }, (_, i) => start - i * step)
      return {
        type: 'numeric',
        prompt: 'What is the next number in the sequence?',
        figure: { kind: 'sequence', items: [...terms.slice(0, 4).map(String), null], style: 'stones', alt: `A sequence: ${terms.slice(0, 4).join(', ')}, then a missing number.` },
        answer: terms[4]!,
        allowNegative: true,
        hints: ['The numbers are getting smaller.', `Each number is ${step} less than the one before. Keep going past zero.`, `${terms[3]} - ${step}: count back ${step} on a number line.`],
        explanation: `The rule is subtract ${step}. ${terms[3]} - ${step} = ${terms[4]}.`,
      }
    }

    if (level === 3) return oneOf(rng, [rule, throughZero])
    if (level === 4) return story()
    return nth()
  },
}

// ---------------------------------------------------------------------------
// Ni: penjumlahan dan pengurangan
// ---------------------------------------------------------------------------

const addSubMental4: Generator = {
  skill: 'm4.add-sub-mental',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const bond = (): GeneratedItem => {
      const tens = rng.chance(0.5)
      const a = tens ? rng.int(11, 99) * 10 : rng.int(1, 9) * 100
      const aa = tens && a % 100 === 0 ? a + 40 : a
      return {
        type: 'numeric',
        prompt: `Find the missing number. ${aa} + ___ = 1,000`,
        answer: 1000 - aa,
        hints: ['Think of pairs that make 1,000.', tens ? 'Make the next hundred first, then 1,000.' : '1,000 is 10 hundreds.', tens ? (Math.ceil(aa / 100) * 100 === 1000 ? `Count on in tens from ${aa}.` : `${aa} + ${Math.ceil(aa / 100) * 100 - aa} = ${Math.ceil(aa / 100) * 100}.`) : `${aa} is ${Hd(aa / 100)}.`],
        explanation: `${aa} + ${1000 - aa} = 1,000.`,
      }
    }

    const multiples = (cross: boolean): GeneratedItem => {
      const add = rng.chance(0.5)
      const big = rng.chance(0.3)
      const m = big ? rng.int(1, 4) * 1000 : rng.int(1, 9) * 100
      let n = rng.int(11, 85) * 100 + (rng.chance(0.4) ? rng.int(1, 99) : 0)
      for (let i = 0; i < 60; i++) {
        const p = big ? 3 : 2
        const d = digitAt(n, p)
        const md = m / 10 ** p
        const crosses = add ? d + md > 9 : d - md < 0
        const fits = add ? n + m <= 9999 : n - m >= 1000
        if (fits && (big || crosses === cross)) break
        n = rng.int(11, 85) * 100 + (rng.chance(0.4) ? rng.int(1, 99) : 0)
      }
      const ans = add ? n + m : n - m
      return {
        type: 'numeric',
        prompt: `${fmt(n)} ${add ? '+' : '-'} ${fmt(m)} = ___`,
        answer: ans,
        hints: [`${fmt(m)} is ${big ? Th(m / 1000) : Hd(m / 100)}.`, `${add ? 'Count on' : 'Count back'} in ${big ? 'thousands' : 'hundreds'}.`, `The ${big ? 'thousands' : 'hundreds'} digit of ${fmt(n)} is ${digitAt(n, big ? 3 : 2)}.`],
        explanation: `${fmt(n)} ${add ? '+' : '-'} ${fmt(m)} = ${fmt(ans)}.`,
      }
    }

    const near = (): GeneratedItem => {
      const k = rng.pick([99, 199, 999, 98, 198])
      const r = k === 98 || k === 198 ? k + 2 : k + 1
      const fix = r - k
      const add = rng.chance(0.5)
      const n = add ? rng.int(1200, 8000) : rng.int(Math.max(1200, k + 300), 9500)
      const ans = add ? n + k : n - k
      if (rng.chance(0.35)) {
        const correct = add ? `${fmt(n)} + ${fmt(r)} - ${fix}` : `${fmt(n)} - ${fmt(r)} + ${fix}`
        return {
          type: 'mcq',
          prompt: `Which is a quick way to work out ${fmt(n)} ${add ? '+' : '-'} ${k}?`,
          ...textChoice(rng, correct, add
            ? [
                { value: `${fmt(n)} + ${fmt(r)} + ${fix}`, why: `This adds ${fmt(r + fix)}. ${k} is ${fix} less than ${fmt(r)}.` },
                { value: `${fmt(n)} - ${fmt(r)} + ${fix}`, why: `This takes away. The question adds ${k}.` },
                { value: `${fmt(n)} + ${fmt(r)} - ${fix + 1}`, why: `${fmt(r)} - ${fix + 1} is ${r - fix - 1}, not ${k}.` },
              ]
            : [
                { value: `${fmt(n)} - ${fmt(r)} - ${fix}`, why: `This takes away ${fmt(r + fix)}. Add the extra ${fix} back.` },
                { value: `${fmt(n)} + ${fmt(r)} - ${fix}`, why: `This adds. The question takes away ${k}.` },
                { value: `${fmt(n)} - ${fmt(r)} + ${fix + 1}`, why: `${fmt(r)} - ${fix + 1} is ${r - fix - 1}, not ${k}.` },
              ]),
          hints: [`${k} is very close to ${fmt(r)}.`, `${add ? 'Add' : 'Take away'} ${fmt(r)}, then fix the difference.`, `${k} = ${fmt(r)} - ${fix}.`],
          explanation: `${k} is ${fmt(r)} - ${fix}, so ${fmt(n)} ${add ? '+' : '-'} ${k} = ${correct} = ${fmt(ans)}.`,
        }
      }
      return {
        type: 'numeric',
        prompt: `${fmt(n)} ${add ? '+' : '-'} ${k} = ___`,
        answer: ans,
        hints: [`${k} is very close to ${fmt(r)}.`, `${add ? 'Add' : 'Take away'} ${fmt(r)}, then ${add ? 'take away' : 'add back'} ${fix}.`, `${fmt(n)} ${add ? '+' : '-'} ${fmt(r)} = ${fmt(add ? n + r : n - r)}.`],
        explanation: `${fmt(n)} ${add ? '+' : '-'} ${fmt(r)} = ${fmt(add ? n + r : n - r)}. ${add ? 'Take away' : 'Add back'} ${fix} to get ${fmt(ans)}.`,
      }
    }

    const story = (): GeneratedItem => {
      const kind = rng.int(0, 2)
      if (kind === 0) {
        const n = rng.int(20, 60) * 100
        const out = rng.int(5, 15) * 100
        const back = rng.int(2, 9) * 50
        return {
          type: 'numeric',
          prompt: `A library has ${fmt(n)} books. It lends out ${fmt(out)} books and gets ${back} back. How many books are in the library now?`,
          answer: n - out + back,
          hints: ['Work in two steps.', 'Take away the books lent out, then add the books that came back.', `${fmt(n)} - ${fmt(out)} = ${fmt(n - out)}.`],
          explanation: `${fmt(n)} - ${fmt(out)} = ${fmt(n - out)}, then ${fmt(n - out)} + ${back} = ${fmt(n - out + back)}.`,
          tags: WORD,
        }
      }
      if (kind === 1) {
        const a = rng.int(25, 80) * 100
        const b = rng.int(12, 40) * 100
        const name = pickName(rng)
        return {
          type: 'numeric',
          prompt: `${name}'s school wants to collect ${fmt(a + b)} plastic bottles for recycling. So far it has ${fmt(a)}. How many more bottles are needed?`,
          answer: b,
          hints: ['Find the difference between the target and the bottles so far.', `Count up from ${fmt(a)} to ${fmt(a + b)}.`, `Count up from ${fmt(a)} in thousands, then in hundreds.`],
          explanation: `${fmt(a + b)} - ${fmt(a)} = ${fmt(b)} more bottles.`,
          tags: WORD,
        }
      }
      const t = rng.int(2, 9) * 1000
      const a = t + rng.int(1, 30)
      const b = t - rng.int(2, 40)
      return {
        type: 'numeric',
        prompt: `Find the difference between ${fmt(a)} and ${fmt(b)}.`,
        figure: { kind: 'numberline', min: b, max: a, step: 1, labels: [b, t, a], jumps: [{ from: b, to: t }, { from: t, to: a }], alt: `A number line from ${fmt(b)} to ${fmt(a)} with jumps through ${fmt(t)}.` },
        answer: a - b,
        hints: ['The numbers are close, so count up from the smaller one.', `Count up from ${fmt(b)} to ${fmt(t)}, then on to ${fmt(a)}.`, `${fmt(b)} to ${fmt(t)} is ${t - b}.`],
        explanation: `${t - b} + ${a - t} = ${a - b}.`,
      }
    }

    const missing = (): GeneratedItem => {
      const total = rng.int(3, 9) * 1000
      const a = rng.int(1100, total - 600)
      return {
        type: 'numeric',
        prompt: `Find the missing number. ${fmt(total)} - ___ = ${fmt(a)}`,
        answer: total - a,
        hints: ['Taking away the missing number leaves the answer.', `Count up from ${fmt(a)} to ${fmt(total)}.`, `${fmt(a)} to ${fmt(Math.ceil((a + 1) / 100) * 100)} is ${Math.ceil((a + 1) / 100) * 100 - a}.`],
        explanation: `${fmt(total)} - ${fmt(a)} = ${fmt(total - a)}. Check: ${fmt(total)} - ${fmt(total - a)} = ${fmt(a)}.`,
      }
    }

    if (level === 1) return oneOf(rng, [bond, () => multiples(false)])
    if (level === 2) return multiples(true)
    if (level === 3) return near()
    if (level === 4) return story()
    return missing()
  },
}

const addSubWritten4: Generator = {
  skill: 'm4.add-sub-written',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const add = (pattern: boolean[], fallback: [number, number]): GeneratedItem => {
      const [a, b] = addPairWith(rng, 4, pattern, fallback)
      const s = a + b
      return {
        type: 'numeric',
        prompt: `Work out ${fmt(a)} + ${fmt(b)}.`,
        figure: columnFig('+', a, b),
        answer: s,
        hints: ['Line up the thousands, hundreds, tens and ones.', 'Start with the ones. If a column makes 10 or more, carry 1.', `Ones: ${digitAt(a, 0)} + ${digitAt(b, 0)} = ${digitAt(a, 0) + digitAt(b, 0)}.`],
        explanation: `${fmt(a)} + ${fmt(b)} = ${fmt(s)}.`,
        solution: [{ say: 'Write the numbers in columns.', figure: columnFig('+', a, b) }, ...addSteps(a, b)].slice(0, 8),
      }
    }

    const sub = (test: (x: number, y: number, f: boolean[]) => boolean, fallback: [number, number]): GeneratedItem => {
      const [a, b] = subPairWith(rng, 4, test, fallback)
      const d = a - b
      return {
        type: 'numeric',
        prompt: `Work out ${fmt(a)} - ${fmt(b)}.`,
        figure: columnFig('-', a, b),
        answer: d,
        hints: ['Line up the thousands, hundreds, tens and ones.', 'If the top digit is smaller, exchange 1 from the column on the left.', `Ones: can you take ${digitAt(b, 0)} from ${digitAt(a, 0)}?`],
        explanation: `${fmt(a)} - ${fmt(b)} = ${fmt(d)}. Check: ${fmt(d)} + ${fmt(b)} = ${fmt(a)}.`,
        solution: [{ say: 'Write the numbers in columns.', figure: columnFig('-', a, b) }, ...subSteps(a, b)].slice(0, 7).concat([{ say: 'Check with addition.', show: `${fmt(d)} + ${fmt(b)} = ${fmt(a)}` }]),
      }
    }

    const zeros = (): GeneratedItem => {
      const a = rng.pick([rng.int(2, 9) * 1000, rng.int(2, 9) * 1000 + rng.int(1, 9), rng.int(2, 9) * 1000 + rng.int(1, 9) * 100])
      const b = rng.int(1001, a - 300)
      const bb = b % 10 === 0 ? b + 7 : b
      return sub((x, y) => x === a && y === bb, [a, bb])
    }

    const story = (): GeneratedItem => {
      const name = pickName(rng)
      const kind = rng.int(0, 2)
      if (kind === 0) {
        const m = rng.int(1200, 3800)
        const t = rng.int(900, 2900)
        const sold = rng.int(1000, m + t - 500)
        return {
          type: 'numeric',
          prompt: `A farmer picked ${fmt(m)} mangoes on Monday and ${fmt(t)} on Tuesday. ${fmt(sold)} mangoes were sold. How many are left?`,
          answer: m + t - sold,
          hints: ['Find how many were picked altogether first.', 'Add the two days, then take away the mangoes sold.', `${fmt(m)} + ${fmt(t)} = ${fmt(m + t)}.`],
          explanation: `${fmt(m)} + ${fmt(t)} = ${fmt(m + t)}. ${fmt(m + t)} - ${fmt(sold)} = ${fmt(m + t - sold)}.`,
          solution: [
            { say: 'Add the mangoes picked.', figure: columnFig('+', m, t, m + t) },
            { say: 'Take away the mangoes sold.', figure: columnFig('-', m + t, sold, m + t - sold) },
          ],
          tags: WORD,
        }
      }
      if (kind === 1) {
        const a = rng.int(2500, 6000)
        const b = rng.int(1200, a - 300)
        return {
          type: 'numeric',
          prompt: `A concert hall has ${fmt(a)} seats. ${fmt(b)} tickets have been sold. How many seats are still free?`,
          answer: a - b,
          hints: ['Some seats are sold. Find how many are left.', `Work out ${fmt(a)} - ${fmt(b)} in columns.`, `Ones: can you take ${digitAt(b, 0)} from ${digitAt(a, 0)}?`],
          explanation: `${fmt(a)} - ${fmt(b)} = ${fmt(a - b)} free seats.`,
          tags: WORD,
        }
      }
      const a = rng.int(2100, 5800)
      const b = rng.int(1100, 3900)
      const exact = a + b
      const est = roundTo(a, 1000) + roundTo(b, 1000)
      const wrongs = [exact + 1000, exact - 1000, exact + 100, Number(String(exact).slice(0, -1))].filter((x) => x > 0 && x !== exact)
      return {
        type: 'mcq',
        prompt: `${name} adds ${fmt(a)} and ${fmt(b)}. Which answer is correct? Estimate first to check.`,
        ...numChoice(rng, exact, wrongs.map((x) => ({ value: x, why: Math.abs(x - est) > 900 ? `The estimate is about ${fmt(est)}, so ${fmt(x)} is too far away.` : `Check the column addition again. The ones digit should be ${(digitAt(a, 0) + digitAt(b, 0)) % 10}.` }))),
        hints: ['Round each number to the nearest 1,000 to estimate.', `${fmt(a)} is about ${fmt(roundTo(a, 1000))} and ${fmt(b)} is about ${fmt(roundTo(b, 1000))}.`, `Then check the ones: ${digitAt(a, 0)} + ${digitAt(b, 0)} ends in ${(digitAt(a, 0) + digitAt(b, 0)) % 10}.`],
        explanation: `The estimate is ${fmt(est)}. The exact answer is ${fmt(a)} + ${fmt(b)} = ${fmt(exact)}.`,
        tags: WORD,
      }
    }

    const missingDigit = (): GeneratedItem => {
      const [a, b] = addPairWith(rng, 4, [true, true, false, false], [3456, 2378])
      const s = a + b
      const pos = rng.int(1, 3)
      const d = digitAt(a, pos)
      const raw = String(a).split('').map((c, i, arr) => (arr.length - 1 - i === pos ? '?' : c)).join('')
      const aStr = `${raw.slice(0, 1)},${raw.slice(1)}`
      return {
        type: 'numeric',
        prompt: `Find the missing digit. ${aStr} + ${fmt(b)} = ${fmt(s)}`,
        answer: d,
        hints: ['Use the inverse.', `Work out ${fmt(s)} - ${fmt(b)} to find the first number.`, `Ones: ${digitAt(s, 0)} - ${digitAt(b, 0)}: do you need to exchange?`],
        explanation: `${fmt(s)} - ${fmt(b)} = ${fmt(a)}, so the missing digit is ${d}.`,
      }
    }

    if (level === 1) return rng.chance(0.5) ? add([true, false, false, false], [3427, 1256]) : sub((x, y, f) => x - y > 500 && f.filter(Boolean).length === 1, [5683, 2459])
    if (level === 2) return rng.chance(0.5) ? add([true, true, rng.chance(0.5), false], [3768, 2456]) : sub((x, y, f) => x - y > 500 && f.filter(Boolean).length === 2, [6243, 2768])
    if (level === 3) return zeros()
    if (level === 4) return story()
    return missingDigit()
  },
}

// ---------------------------------------------------------------------------
// Ni: perkalian, faktor, kelipatan, pembagian
// ---------------------------------------------------------------------------

const ARRAY_ICONS: readonly IconName[] = ['apple', 'cookie', 'muffin', 'flower', 'star', 'egg', 'strawberry', 'shell', 'button']

const timesTables4: Generator = {
  skill: 'm4.times-tables',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const fact = (tables: readonly number[]): GeneratedItem => {
      const t = rng.pick(tables)
      const n = rng.int(2, 10)
      const p = n * t
      return {
        type: 'numeric',
        prompt: rng.chance(0.5) ? `${n} × ${t} = ___` : `${t} × ${n} = ___`,
        answer: p,
        hints: [`Use the ${t} times table.`, n > 5 ? `Start from 5 × ${t} = ${5 * t}, then count on in ${t}s.` : `Count in ${t}s.`, n > 5 ? `${n - 5} more ${t}s after ${5 * t}.` : `Start at ${t} and count on in ${t}s.`],
        explanation: `${n} × ${t} = ${p}.`,
      }
    }

    const array7 = (): GeneratedItem => {
      const r = rng.int(4, 9)
      const icon = rng.pick(ARRAY_ICONS)
      const figure: Fig = { kind: 'array', rows: r, cols: 7, icon, alt: `${r} rows of 7.` }
      return {
        type: 'numeric',
        prompt: `There are ${r} rows with 7 in each row. How many are there altogether?`,
        figure,
        answer: 7 * r,
        hints: ['Count one row first.', 'Each row has 7. Use the 7 times table.', r > 5 ? '5 rows make 35. Count on in 7s.' : 'Count in 7s, one row at a time.'],
        explanation: `${r} × 7 = ${7 * r}.`,
      }
    }

    const missing = (): GeneratedItem => {
      const t = rng.pick([6, 7, 8, 9])
      const n = rng.int(3, 10)
      return {
        type: 'numeric',
        prompt: rng.chance(0.5) ? `___ × ${t} = ${n * t}` : `${t} × ___ = ${n * t}`,
        answer: n,
        hints: [`Use the ${t} times table.`, `How many ${t}s make ${n * t}?`, 'You can also divide to find the missing number.'],
        explanation: `${n} × ${t} = ${n * t}, so the missing number is ${n}.`,
      }
    }

    const zeroOne = (): GeneratedItem => {
      const n = rng.int(3, 99)
      const zero = rng.chance(0.5)
      const ans = zero ? 0 : n
      const q = zero ? (rng.chance(0.5) ? `0 × ${n}` : `${n} × 0`) : rng.chance(0.5) ? `1 × ${n}` : `${n} × 1`
      return {
        type: 'mcq',
        prompt: `What is ${q}?`,
        ...numChoice(rng, ans, zero
          ? [{ value: n, why: `${n} × 1 is ${n}. Multiplying by 0 gives 0.` }, { value: 1, why: 'Multiplying by 0 gives 0, not 1.' }, { value: n * 10, why: 'Multiplying by 0 does not add a zero. It gives 0.' }]
          : [{ value: 1, why: `Multiplying by 1 keeps the number the same, ${n}.` }, { value: 0, why: 'Only multiplying by 0 gives 0.' }, { value: n + 1, why: `This adds 1. Multiplying by 1 keeps the number the same.` }]),
        hints: [zero ? 'Think of 0 groups, or groups with nothing in them.' : 'Think of 1 group.', zero ? 'Any number multiplied by 0 gives the same answer.' : 'One group of a number is just that number.', zero ? `${n} groups of 0 is nothing.` : `1 group of ${n} is ${n} things.`],
        explanation: zero ? `Any number times 0 is 0, so ${q} = 0.` : `Any number times 1 stays the same, so ${q} = ${n}.`,
      }
    }

    const related = (): GeneratedItem => {
      const a = rng.int(3, 9)
      const b = rng.int(3, 9)
      const kind = rng.int(0, 2)
      if (kind === 0) {
        return {
          type: 'numeric',
          prompt: `${a} × ${b} = ${a * b}. What is ${a * 10} × ${b}?`,
          answer: a * b * 10,
          hints: [`${a * 10} is 10 times bigger than ${a}.`, 'So the answer is 10 times bigger too.', `${a * b} × 10: move each digit one place to the left.`],
          explanation: `${a * 10} × ${b} = ${a} × ${b} × 10 = ${a * b} × 10 = ${a * b * 10}.`,
        }
      }
      if (kind === 1) {
        return {
          type: 'numeric',
          prompt: `${a} × ${b} = ${a * b}. What is ${a * b} ÷ ${b}?`,
          answer: a,
          hints: ['Division undoes multiplication.', `The three numbers ${a}, ${b} and ${a * b} make a fact family.`, `${a * b} ÷ ${b} asks: how many ${b}s make ${a * b}?`],
          explanation: `${a} × ${b} = ${a * b}, so ${a * b} ÷ ${b} = ${a}.`,
        }
      }
      const pair = rng.pick([[2, 5], [5, 2], [4, 5], [5, 4], [2, 10]] as const)
      const c = rng.int(3, 9)
      const order = rng.chance(0.5) ? [pair[0], c, pair[1]] : [c, pair[0], pair[1]]
      return {
        type: 'numeric',
        prompt: `${order.join(' × ')} = ___`,
        answer: pair[0] * pair[1] * c,
        hints: ['You can multiply the numbers in any order.', `Multiply ${pair[0]} × ${pair[1]} first. It makes a friendly number.`, `${pair[0]} × ${pair[1]} = ${pair[0] * pair[1]}.`],
        explanation: `${pair[0]} × ${pair[1]} = ${pair[0] * pair[1]}, then ${pair[0] * pair[1]} × ${c} = ${pair[0] * pair[1] * c}.`,
      }
    }

    const match = (): GeneratedItem => {
      const used = new Set<number>()
      const pairs: [string, string][] = []
      for (let i = 0; i < 60 && pairs.length < 5; i++) {
        const t = rng.pick([6, 7, 8, 9])
        const n = rng.int(3, 10)
        if (used.has(n * t)) continue
        used.add(n * t)
        pairs.push([`${n} × ${t}`, String(n * t)])
      }
      return {
        type: 'match',
        prompt: 'Match each multiplication to its answer.',
        pairs,
        hints: ['Start with the facts you know best.', 'Use a fact you know to work out a harder one, like double 4 to get 8.', `For ${pairs[0]![0]}, count in ${pairs[0]![0].split(' × ')[1]}s.`],
        explanation: pairs.map(([q, a]) => `${q} = ${a}`).join('. ') + '.',
      }
    }

    const story = (): GeneratedItem => {
      const r = rng.int(6, 9)
      const c = rng.int(6, 9)
      const empty = rng.int(2, 9)
      const name = pickName(rng)
      if (rng.chance(0.5)) {
        return {
          type: 'numeric',
          prompt: `A hall has ${r} rows of ${c} chairs. ${empty} chairs are empty. How many children are sitting down?`,
          answer: r * c - empty,
          hints: ['First find how many chairs there are.', `Multiply, then take away the ${empty} empty chairs.`, `${r} × ${c} = ${r * c}.`],
          explanation: `${r} × ${c} = ${r * c} chairs. ${r * c} - ${empty} = ${r * c - empty} children.`,
          tags: WORD,
        }
      }
      const w = rng.int(3, 9)
      return {
        type: 'numeric',
        prompt: `${name} reads for ${w} minutes every day for ${c} days, then reads for ${empty} minutes more. How many minutes is that altogether?`,
        answer: w * c + empty,
        hints: ['Find the total for the days first.', `Multiply ${w} by ${c}, then add ${empty}.`, `${w} × ${c} = ${w * c}.`],
        explanation: `${w} × ${c} = ${w * c}, then ${w * c} + ${empty} = ${w * c + empty} minutes.`,
        tags: WORD,
      }
    }

    const sumProduct = (): GeneratedItem => {
      const [a, b] = rng.sample([2, 3, 4, 5, 6, 7, 8, 9], 2).sort((x, y) => x - y) as [number, number]
      const bigger = rng.chance(0.5)
      return {
        type: 'numeric',
        prompt: `Two different numbers multiply to make ${a * b} and add to make ${a + b}. What is the ${bigger ? 'larger' : 'smaller'} number?`,
        answer: bigger ? b : a,
        hints: [`List pairs of numbers that multiply to make ${a * b}.`, `Check which pair adds up to ${a + b}.`, `Start with 1 × ${a * b}. Does 1 + ${a * b} make ${a + b}?`],
        explanation: `${a} × ${b} = ${a * b} and ${a} + ${b} = ${a + b}. The ${bigger ? 'larger' : 'smaller'} number is ${bigger ? b : a}.`,
      }
    }

    if (level === 1) return oneOf(rng, [array7, () => fact([7])])
    if (level === 2) return oneOf(rng, [() => fact([6, 7, 8, 9]), missing, zeroOne])
    if (level === 3) return oneOf(rng, [related, match])
    if (level === 4) return story()
    return sumProduct()
  },
}

export const factorsOf = (n: number): number[] => range(1, n).filter((d) => n % d === 0)

const factorsMultiples4: Generator = {
  skill: 'm4.factors-multiples',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const multipleMcq = (): GeneratedItem => {
      const t = rng.pick([3, 4, 6, 7, 8, 9])
      const ans = t * rng.int(4, 12)
      const wrong = [ans + 1, ans - 1, ans + 2, ans - 2, ans + t + 1].filter((x) => x % t !== 0)
      return {
        type: 'mcq',
        prompt: `Which number is a multiple of ${t}?`,
        ...numChoice(rng, ans, rng.shuffle(wrong).map((x) => ({ value: x, why: `${x} ÷ ${t} leaves a remainder of ${x % t}, so it is not a multiple of ${t}.` })), { spread: [] }),
        hints: [`Multiples of ${t} are in the ${t} times table.`, `Divide each number by ${t}. A multiple leaves no remainder.`, `${t}, ${2 * t}, ${3 * t}, ... keep counting in ${t}s.`],
        explanation: `${ans} = ${ans / t} × ${t}, so it is a multiple of ${t}.`,
      }
    }

    const chooseMultiples = (): GeneratedItem => {
      const t = rng.pick([3, 4, 6, 8, 9])
      const nRight = rng.int(2, 3)
      const set = new Set<number>()
      while (set.size < nRight) set.add(t * rng.int(3, 12))
      while (set.size < 6) {
        const x = rng.int(10, 100)
        if (x % t !== 0) set.add(x)
      }
      const nums = rng.shuffle([...set])
      return {
        type: 'multi',
        prompt: `Choose all the multiples of ${t}.`,
        options: nums.map((x) => (x % t === 0 ? { text: String(x) } : { text: String(x), why: `${x} ÷ ${t} leaves a remainder, so ${x} is not a multiple of ${t}.` })),
        answers: nums.map((x, i) => (x % t === 0 ? i : -1)).filter((i) => i >= 0),
        hints: [`A multiple of ${t} is in the ${t} times table, even past 10 × ${t}.`, `Check each number: does it divide exactly by ${t}?`, `${10 * t} is a multiple of ${t}. Count on or back in ${t}s from there.`],
        explanation: `The multiples of ${t} are ${listAnd(nums.filter((x) => x % t === 0).sort((x, y) => x - y))}.`,
      }
    }

    const factorPair = (): GeneratedItem => {
      const n = rng.pick([12, 16, 18, 20, 24, 30, 32, 36, 40, 42, 48])
      const pairs = factorsOf(n).filter((d) => d * d <= n && d > 1).map((d) => [d, n / d] as [number, number])
      const correct = rng.pick(pairs)
      const wrongs: { value: string; why: string }[] = []
      for (const [a, b] of rng.shuffle([[correct[0] + 1, correct[1]], [correct[0], correct[1] + 1], [correct[0] - 1, correct[1] + 1], [correct[0] + 2, correct[1] - 1], [Math.floor(n / 2) - 1, 2]] as [number, number][])) {
        if (a * b !== n && a > 0 && b > 0) wrongs.push({ value: `${a} and ${b}`, why: `${a} × ${b} = ${a * b}, not ${n}.` })
      }
      return {
        type: 'mcq',
        prompt: `Which pair of numbers multiply to make ${n}?`,
        ...textChoice(rng, `${correct[0]} and ${correct[1]}`, wrongs),
        hints: ['A factor pair multiplies to make the number.', 'Multiply each pair and check.', `Start with the first pair: multiply the two numbers.`],
        explanation: `${correct[0]} × ${correct[1]} = ${n}, so ${correct[0]} and ${correct[1]} are a factor pair of ${n}.`,
      }
    }

    const chooseFactors = (): GeneratedItem => {
      const n = rng.pick([12, 18, 20, 24, 30, 36])
      const fs = factorsOf(n)
      const right = rng.sample(fs, rng.int(2, 4))
      const wrongPool = range(2, n - 1).filter((x) => n % x !== 0)
      const wrong = rng.sample(wrongPool, 6 - right.length)
      const nums = rng.shuffle([...right, ...wrong])
      return {
        type: 'multi',
        prompt: `Choose all the factors of ${n}.`,
        options: nums.map((x) => (n % x === 0 ? { text: String(x) } : { text: String(x), why: `${n} ÷ ${x} leaves a remainder of ${n % x}, so ${x} is not a factor of ${n}.` })),
        answers: nums.map((x, i) => (n % x === 0 ? i : -1)).filter((i) => i >= 0),
        hints: [`A factor divides ${n} exactly, with no remainder.`, `Look for pairs that multiply to make ${n}.`, `1 × ${n} = ${n}, so 1 and ${n} are factors. Try 2, then 3.`],
        explanation: `The factors of ${n} are ${listAnd(fs)}. Here that means ${listAnd(nums.filter((x) => n % x === 0).sort((x, y) => x - y))}.`,
      }
    }

    const common = (): GeneratedItem => {
      const [a, b] = rng.pick([[3, 4], [4, 6], [2, 5], [3, 5], [6, 8], [4, 10], [6, 9], [2, 7]] as const)
      const l = (a * b) / gcdN(a, b)
      const ans = l * rng.int(1, Math.max(1, Math.floor(60 / l)))
      const wrong = [ans + a, ans + b, ans - a, ans - b, a * 7, b * 7].filter((x) => x > 0 && !(x % a === 0 && x % b === 0))
      return {
        type: 'mcq',
        prompt: `Which number is a multiple of both ${a} and ${b}?`,
        ...numChoice(rng, ans, rng.shuffle(wrong).map((x) => ({ value: x, why: x % a === 0 ? `${x} is a multiple of ${a} but not of ${b}.` : x % b === 0 ? `${x} is a multiple of ${b} but not of ${a}.` : `${x} is not a multiple of ${a} or of ${b}.` })), { spread: [] }),
        hints: ['Check each number against both times tables.', `It must divide exactly by ${a} and by ${b}.`, `Start with the multiples of ${b}. Is each one also in the ${a} times table?`],
        explanation: `${ans} = ${ans / a} × ${a} and ${ans} = ${ans / b} × ${b}, so it is a multiple of both.`,
      }
    }

    const divisibility = (): GeneratedItem => {
      const t = rng.pick([2, 5, 10, 25])
      const nums = new Set<number>()
      while (nums.size < 3) nums.add(t * rng.int(3, Math.floor(400 / t)))
      while (nums.size < 6) {
        const x = rng.int(11, 399)
        if (x % t !== 0) nums.add(x)
      }
      const items = rng.shuffle([...nums]).map((x) => ({ text: String(x), group: x % t === 0 ? 0 : 1 }))
      const rule: Record<number, string> = { 2: 'Multiples of 2 end in 0, 2, 4, 6 or 8.', 5: 'Multiples of 5 end in 0 or 5.', 10: 'Multiples of 10 end in 0.', 25: 'Multiples of 25 end in 00, 25, 50 or 75.' }
      return {
        type: 'sort',
        prompt: `Sort the numbers. Which are multiples of ${t}?`,
        groups: [`Multiple of ${t}`, `Not a multiple of ${t}`],
        items,
        hints: ['You only need to look at the end of each number.', rule[t]!, `Look at the last ${t === 25 ? 'two digits' : 'digit'} of ${items[0]!.text}.`],
        explanation: `${rule[t]} So the multiples of ${t} are ${listAnd(items.filter((x) => x.group === 0).map((x) => x.text))}.`,
      }
    }

    const packs = (): GeneratedItem => {
      const [a, b] = rng.pick([[6, 4], [6, 8], [4, 10], [8, 12], [6, 10], [9, 6], [4, 6], [10, 8], [12, 9], [5, 4], [3, 8], [10, 15]] as const)
      const [x, y] = rng.pick([['bread rolls', 'juice cartons'], ['cups', 'plates'], ['pencils', 'erasers'], ['stickers', 'cards']] as const)
      const l = (a * b) / gcdN(a, b)
      return {
        type: 'numeric',
        prompt: `${cap(x)} come in packs of ${a}. ${cap(y)} come in packs of ${b}. What is the smallest number of each you can buy so the numbers are equal?`,
        answer: l,
        hints: ['You need a number in both times tables.', `List the multiples of ${a} and the multiples of ${b}.`, `Count in ${Math.max(a, b)}s. Stop at the first number that is also in the ${Math.min(a, b)} times table.`],
        explanation: `${l} is the smallest number that is a multiple of ${a} and of ${b}. That is ${l / a} packs of ${x} and ${l / b} packs of ${y}.`,
        tags: WORD,
      }
    }

    const countFactors = (): GeneratedItem => {
      const n = rng.pick([12, 16, 18, 20, 24, 28, 30, 36, 40])
      const fs = factorsOf(n)
      return {
        type: 'numeric',
        prompt: `How many factors does ${n} have?`,
        answer: fs.length,
        hints: ['Find the factors in pairs.', `Start with 1 × ${n}, then try 2, 3, 4 and so on.`, `Stop when the pairs start to repeat.`],
        explanation: `The factors of ${n} are ${listAnd(fs)}. That is ${fs.length} factors.`,
      }
    }

    const riddle = (): GeneratedItem => {
      for (let t = 0; t < 40; t++) {
        const m = rng.pick([6, 7, 8, 9])
        const k = rng.pick([3, 4, 5])
        const r = rng.int(1, k - 1)
        const lim = rng.pick([40, 50, 60])
        const sols = range(1, lim - 1).filter((x) => x % m === 0 && x % k === r)
        if (sols.length !== 1) continue
        const ans = sols[0]!
        return {
          type: 'numeric',
          prompt: `I am less than ${lim}. I am a multiple of ${m}. When you divide me by ${k}, the remainder is ${r}. What number am I?`,
          answer: ans,
          hints: [`List the multiples of ${m} that are less than ${lim}.`, `Divide each one by ${k} and check the remainder.`, `Write the ${m} times table up to ${lim}, then test each number.`],
          explanation: `${ans} is a multiple of ${m}, and ${ans} ÷ ${k} = ${Math.floor(ans / k)} r ${r}. No other multiple of ${m} under ${lim} works.`,
        }
      }
      return countFactors()
    }

    const arrayFactor = (): GeneratedItem => {
      const r = rng.int(3, 7)
      let c = rng.int(3, 9)
      if (c === r) c = r === 9 ? 8 : r + 1
      const n = r * c
      const icon = rng.pick(ARRAY_ICONS)
      return {
        type: 'numeric',
        prompt: `The array shows ${n} things. Complete the factor pair: ${r} × ___ = ${n}`,
        figure: { kind: 'array', rows: r, cols: c, icon, alt: `An array with ${r} rows and ${n} things altogether.` },
        answer: c,
        hints: ['The rows and the number in each row make a factor pair.', 'Count how many are in one row.', `What times ${r} makes ${n}?`],
        explanation: `There are ${r} rows of ${c}. ${r} × ${c} = ${n}, so ${r} and ${c} are a factor pair of ${n}.`,
      }
    }

    if (level === 1) return oneOf(rng, [multipleMcq, chooseMultiples])
    if (level === 2) return oneOf(rng, [factorPair, chooseFactors, arrayFactor])
    if (level === 3) return oneOf(rng, [common, divisibility])
    if (level === 4) return oneOf(rng, [packs, countFactors])
    return riddle()
  },
}

function gcdN(a: number, b: number): number {
  return b === 0 ? a : gcdN(b, a % b)
}

const gridFig = (n: number, m: number): Fig => {
  const parts = String(n).split('').map((d, i, arr) => Number(d) * 10 ** (arr.length - 1 - i)).filter((x) => x > 0)
  return {
    kind: 'table',
    head: ['×', ...parts.map(fmt)],
    rows: [[String(m), ...parts.map((x) => fmt(x * m))]],
    alt: `Grid method for ${fmt(n)} × ${m}: ${parts.map((x) => `${fmt(x)} × ${m} = ${fmt(x * m)}`).join(', ')}.`,
  }
}

const multiplyWritten4: Generator = {
  skill: 'm4.multiply-written',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const make = (n: number, m: number, asMcq: boolean, withGrid = false): GeneratedItem => {
      const parts = String(n).split('').map((d, i, arr) => Number(d) * 10 ** (arr.length - 1 - i)).filter((x) => x > 0)
      const p = n * m
      const hints = [n < 100 ? 'Split the number into tens and ones.' : 'Split the number into hundreds, tens and ones.', `Multiply each part by ${m}, then add the answers.`, `${fmt(parts[0]!)} × ${m} = ${fmt(parts[0]! * m)}.`]
      const explanation = `${parts.map((x) => `${fmt(x)} × ${m} = ${fmt(x * m)}`).join(', ')}. ${parts.map((x) => fmt(x * m)).join(' + ')} = ${fmt(p)}.`
      const solution: Step[] = [
        { say: `Split ${fmt(n)} into ${listAnd(parts.map(fmt))}.`, show: `${fmt(n)} = ${parts.map(fmt).join(' + ')}` },
        { say: `Multiply each part by ${m}.`, figure: gridFig(n, m) },
        { say: 'Add the parts together.', show: `${parts.map((x) => fmt(x * m)).join(' + ')} = ${fmt(p)}` },
      ]
      if (!asMcq && withGrid) {
        return {
          type: 'numeric',
          prompt: `Use the grid to work out ${fmt(n)} × ${m}.`,
          figure: { kind: 'table', head: ['×', ...parts.map(fmt)], rows: [[String(m), ...parts.map(() => '?')]], alt: `A grid to work out ${fmt(n)} × ${m}: ${listAnd(parts.map(fmt))} across the top and ${m} down the side.` },
          answer: p,
          hints,
          explanation,
          solution,
        }
      }
      if (!asMcq) return { type: 'numeric', prompt: `Work out ${fmt(n)} × ${m}.`, answer: p, hints, explanation, solution }
      const ones = n % 10
      const digs = String(n).split('').map(Number)
      const noCarry = Number(digs.map((dg, i) => (i === 0 ? String(dg * m) : String((dg * m) % 10))).join(''))
      return {
        type: 'mcq',
        prompt: `What is ${fmt(n)} × ${m}?`,
        ...numChoice(rng, p, [
          { value: n * m - ones * m + ones, why: `The ones need multiplying too: ${ones} × ${m} = ${ones * m}.` },
          { value: noCarry, why: 'The carried digits were forgotten. When a column makes 10 or more, carry the tens into the next column.' },
          { value: n + m, why: 'This adds. × means groups of.' },
          { value: p + 100, why: 'Check the carrying into the hundreds again.' },
          { value: p - 10, why: 'Check the carrying from the ones into the tens.' },
        ]),
        hints,
        explanation,
        solution,
      }
    }

    const story = (): GeneratedItem => {
      const name = pickName(rng)
      const ctx = rng.pick([
        { n: rng.int(32, 58), m: rng.int(3, 9), p: (n: number, m: number) => `A bus has ${n} seats. How many seats are there on ${m} buses?`, unit: 'seats' },
        { n: rng.pick([125, 150, 175, 240, 250]), m: rng.int(3, 8), p: (n: number, m: number) => `A box holds ${n} pencils. How many pencils are in ${m} boxes?`, unit: 'pencils' },
        { n: rng.int(112, 365), m: rng.int(3, 6), p: (n: number, m: number) => `${name} walks ${n} steps to school. How many steps is that on ${m} school days?`, unit: 'steps' },
        { n: rng.int(24, 48), m: rng.int(6, 9), p: (n: number, m: number) => `A tray holds ${n} eggs. How many eggs are on ${m} trays?`, unit: 'eggs' },
      ])
      if (ctx.n % 10 === 0) ctx.n += 3
      const p = ctx.n * ctx.m
      return {
        type: 'numeric',
        prompt: ctx.p(ctx.n, ctx.m),
        answer: p,
        hints: ['Look for equal groups.', `Work out ${ctx.n} × ${ctx.m}. Split ${ctx.n} into parts.`, `Start with the biggest part: ${fmt(10 ** (String(ctx.n).length - 1) * Math.floor(ctx.n / 10 ** (String(ctx.n).length - 1)))} × ${ctx.m} = ${fmt(10 ** (String(ctx.n).length - 1) * Math.floor(ctx.n / 10 ** (String(ctx.n).length - 1)) * ctx.m)}.`],
        explanation: `${ctx.n} × ${ctx.m} = ${fmt(p)} ${ctx.unit}.`,
        solution: [
          { say: 'Multiply each part.', figure: gridFig(ctx.n, ctx.m) },
          { say: 'Add the parts.', show: `${fmt(ctx.n)} × ${ctx.m} = ${fmt(p)}` },
        ],
        tags: WORD,
      }
    }

    const missingDigit = (): GeneratedItem => {
      const m = rng.int(3, 9)
      const t = rng.int(2, 9)
      const d = rng.int(2, 9)
      const n = t * 10 + d
      return {
        type: 'numeric',
        prompt: `Find the missing digit. ${t}? × ${m} = ${fmt(n * m)}`,
        answer: d,
        hints: ['Use the tens first.', `${t * 10} × ${m} = ${t * 10 * m}. How much more makes ${fmt(n * m)}?`, `${fmt(n * m)} - ${t * 10 * m} = ${n * m - t * 10 * m}.`],
        explanation: `${n * m - t * 10 * m} ÷ ${m} = ${d}, so the number is ${n} and the missing digit is ${d}.`,
      }
    }

    const noZeroOnes = (lo: number, hi: number) => {
      const n = rng.int(lo, hi)
      return n % 10 === 0 ? n + rng.int(1, 9) : n
    }
    if (level === 1) {
      const m = rng.int(2, 5)
      return make(noZeroOnes(12, 48), m, false, rng.chance(0.6))
    }
    if (level === 2) return make(noZeroOnes(23, 98), rng.int(4, 9), rng.chance(0.5))
    if (level === 3) return make(noZeroOnes(112, 899), rng.int(3, 9), rng.chance(0.5))
    if (level === 4) return story()
    return missingDigit()
  },
}

const divideWritten4: Generator = {
  skill: 'm4.divide-written',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const exact = (easy: boolean): GeneratedItem => {
      let d: number
      let q: number
      if (easy) {
        d = rng.int(2, 4)
        const qt = rng.int(1, Math.floor(9 / d))
        const qo = rng.int(1, Math.floor(9 / d))
        q = qt * 10 + qo
      } else {
        d = rng.int(3, 8)
        q = rng.int(12, Math.floor(99 / d))
        if (q % 10 === 0) q += 1
      }
      const n = q * d
      const t = Math.floor(n / d / 10) * 10 * d
      const rest = n - t
      return {
        type: 'numeric',
        prompt: easy ? `Share the blocks into ${d} equal groups. What is ${n} ÷ ${d}?` : `Work out ${n} ÷ ${d}.`,
        ...(easy ? { figure: { kind: 'basetens', tens: Math.floor(n / 10), ones: n % 10, alt: `Base ten blocks for ${n}: ${plural(Math.floor(n / 10), 'ten', 'tens')} and ${plural(n % 10, 'one', 'ones')}.` } as Fig } : {}),
        answer: q,
        hints: ['Split the number into two parts that are easy to divide.', `Find the biggest multiple of ${d * 10} that fits into ${n}.`, `${t} ÷ ${d} = ${t / d}.`],
        explanation: `${n} = ${t} + ${rest}. ${t} ÷ ${d} = ${t / d} and ${rest} ÷ ${d} = ${rest / d}. ${t / d} + ${rest / d} = ${q}.`,
        solution: [
          { say: `Split ${n} into ${t} and ${rest}.`, show: `${n} = ${t} + ${rest}` },
          { say: `Divide each part by ${d}.`, show: `${t} ÷ ${d} = ${t / d}, ${rest} ÷ ${d} = ${rest / d}` },
          { say: 'Add the two answers.', show: `${t / d} + ${rest / d} = ${q}` },
        ],
      }
    }

    const remainder = (): GeneratedItem => {
      const d = rng.int(3, 8)
      let q = rng.int(11, Math.floor(98 / d))
      if (q % 10 === 0) q += 1
      const r = rng.int(1, d - 1)
      const n = q * d + r
      if (n > 99) return exact(false)
      const asText = rng.chance(0.6)
      const hints = [`Find the biggest multiple of ${d} that fits into ${n}.`, `${d} × 10 = ${d * 10}. Then keep counting in ${d}s.`, `How many ${d}s fit into ${n}? What is left?`]
      const explanation = `${q} × ${d} = ${q * d} and ${n} - ${q * d} = ${r}. So ${n} ÷ ${d} = ${q} r ${r}.`
      if (asText) return { type: 'text', prompt: `${n} ÷ ${d} = ___ r ___`, blanks: [{ answers: [String(q)] }, { answers: [String(r)] }], hints, explanation }
      return { type: 'numeric', prompt: `What is the remainder when ${n} is divided by ${d}?`, answer: r, hints, explanation }
    }

    const story = (): GeneratedItem => {
      const kind = rng.int(0, 2)
      const d = rng.int(4, 8)
      let q = rng.int(6, Math.floor(95 / d))
      if (q === 10) q = 11
      let r = rng.int(1, d - 1)
      if (r === q || r === q + 1) r = r > 1 ? r - 1 : 2
      const n = q * d + r
      const name = pickName(rng)
      if (kind === 0) {
        return {
          type: 'mcq',
          prompt: `${n} children are going on a trip. Each minibus carries ${d} children. How many minibuses are needed?`,
          ...textChoice(rng, String(q + 1), [
            { value: String(q), why: `${q} minibuses carry ${q * d} children, so ${r} children would be left behind.` },
            { value: `${q} r ${r}`, why: 'You cannot have part of a minibus. Round up so everyone has a seat.' },
            { value: String(r), why: `${r} is the number of children left over, not the number of minibuses.` },
          ]),
          hints: [`Work out ${n} ÷ ${d}.`, 'Every child needs a seat. Think about the children left over.', `${q} × ${d} = ${q * d}.`],
          explanation: `${n} ÷ ${d} = ${q} r ${r}. The ${r} extra children need one more minibus, so ${q + 1} minibuses are needed.`,
          tags: WORD,
        }
      }
      if (kind === 1) {
        return {
          type: 'numeric',
          prompt: `${name} has ${n} beads. A bracelet needs ${d} beads. How many bracelets can ${name} make?`,
          answer: q,
          hints: [`Work out ${n} ÷ ${d}.`, 'A bracelet needs all its beads, so ignore the beads left over.', `${d} × 10 = ${d * 10}. Keep counting in ${d}s.`],
          explanation: `${n} ÷ ${d} = ${q} r ${r}. ${name} can make ${q} bracelets with ${plural(r, 'bead', 'beads')} left over.`,
          tags: WORD,
        }
      }
      return {
        type: 'numeric',
        prompt: `${n} mangoes are shared equally into ${d} baskets. How many mangoes are left over?`,
        answer: r,
        hints: [`Work out ${n} ÷ ${d}.`, 'The mangoes left over are the remainder.', `${d} × 10 = ${d * 10}. Keep counting in ${d}s.`],
        explanation: `${n} ÷ ${d} = ${q} r ${r}. Each basket gets ${q} and ${plural(r, 'mango is', 'mangoes are')} left over.`,
        tags: WORD,
      }
    }

    const reverse = (): GeneratedItem => {
      const d = rng.int(3, 9)
      const q = rng.int(11, 25)
      const r = rng.int(1, d - 1)
      return {
        type: 'numeric',
        prompt: `A number is divided by ${d}. The answer is ${q} remainder ${r}. What is the number?`,
        answer: q * d + r,
        hints: ['Work backwards.', `Multiply ${q} by ${d}, then add the remainder.`, `${q} × ${d} = ${q * d}.`],
        explanation: `${q} × ${d} = ${q * d} and ${q * d} + ${r} = ${q * d + r}.`,
      }
    }

    const easy3 = (): GeneratedItem => {
      const d = rng.int(2, 4)
      const digits = [rng.int(1, Math.floor(9 / d)), rng.int(0, Math.floor(9 / d)), rng.int(1, Math.floor(9 / d))]
      const q = digits[0]! * 100 + digits[1]! * 10 + digits[2]!
      const n = q * d
      return {
        type: 'numeric',
        prompt: `Work out ${n} ÷ ${d}.`,
        answer: q,
        hints: ['Split the number into hundreds, tens and ones.', `Divide each part by ${d}.`, `${digits[0]! * 100 * d} ÷ ${d} = ${digits[0]! * 100}.`],
        explanation: `${n} = ${[digits[0]! * 100 * d, digits[1]! * 10 * d, digits[2]! * d].filter((x) => x > 0).join(' + ')}. Dividing each part by ${d} gives ${[digits[0]! * 100, digits[1]! * 10, digits[2]!].filter((x) => x > 0).join(' + ')} = ${q}.`,
      }
    }

    if (level === 1) return oneOf(rng, [() => exact(true), easy3])
    if (level === 2) return exact(false)
    if (level === 3) return remainder()
    if (level === 4) return story()
    return reverse()
  },
}

// ---------------------------------------------------------------------------
// Np dan Nf: desimal dan pecahan
// ---------------------------------------------------------------------------

export const dec = (hundredths: number): number => Number((hundredths / 100).toFixed(2))

const decimals4: Generator = {
  skill: 'm4.decimals',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const tenths = (): GeneratedItem => {
      const s = rng.int(1, 9)
      if (rng.chance(0.5)) {
        return {
          type: 'numeric',
          prompt: 'What decimal is shaded?',
          figure: { kind: 'fraction', shape: 'bar', parts: 10, shaded: s, alt: `A bar cut into 10 equal parts with ${s} shaded.` },
          answer: s / 10,
          allowDecimal: true,
          hints: ['The bar is split into 10 equal parts, so each part is one tenth.', 'Tenths are written in the first place after the decimal point.', 'Count the shaded tenths.'],
          explanation: `${s} tenths are shaded. ${s}/10 = ${fmt(s / 10)}.`,
        }
      }
      return {
        type: 'numeric',
        prompt: `Write ${s}/10 as a decimal.`,
        answer: s / 10,
        allowDecimal: true,
        hints: ['Tenths go in the first place after the decimal point.', 'Write 0, then the point, then the number of tenths.', `${s}/10 means ${s} tenths.`],
        explanation: `${s}/10 is ${s} tenths, which is ${fmt(s / 10)}.`,
      }
    }

    const hundredths = (): GeneratedItem => {
      const n = rng.int(11, 89)
      if (rng.chance(0.5)) {
        const cells = rng.sample(range(0, 99), n).sort((a, b) => a - b).map((k) => [Math.floor(k / 10), k % 10] as [number, number])
        const ordered = range(0, n - 1).map((k) => [Math.floor(k / 10), k % 10] as [number, number])
        return {
          type: 'numeric',
          prompt: 'The whole grid is 1. What decimal is shaded?',
          figure: { kind: 'grid', rows: 10, cols: 10, shaded: rng.chance(0.7) ? ordered : cells, alt: `A 10 by 10 grid with ${n} squares shaded.` },
          answer: dec(n),
          allowDecimal: true,
          hints: ['The grid has 100 squares, so each square is one hundredth.', 'Count full rows of 10 first. Each row is one tenth.', `Count the full shaded rows.`],
          explanation: `${n} hundredths are shaded. ${n}/100 = ${fmt(dec(n))}.`,
        }
      }
      const whole = rng.int(1, 9)
      const t = rng.int(1, 9)
      const h = rng.int(1, 9)
      const x = whole + dec(t * 10 + h)
      const pick = rng.pick(['tenths', 'hundredths'] as const)
      const digit = pick === 'tenths' ? t : h
      const v = Number(x.toFixed(2))
      return {
        type: 'mcq',
        prompt: `What is the value of the ${digit} in ${fmt(v)}?`,
        ...textChoice(rng, `${digit} ${pick}`, [
          { value: `${digit} ${pick === 'tenths' ? 'hundredths' : 'tenths'}`, why: `The first place after the point is tenths. The second place is hundredths.` },
          { value: `${digit} ones`, why: 'The ones digit is before the decimal point.' },
          { value: `${digit} tens`, why: `There are no tens in ${fmt(v)}.` },
        ]),
        hints: ['Find the decimal point first.', 'After the point come tenths, then hundredths.', `Is the ${digit} in the first or second place after the point?`],
        explanation: `In ${fmt(v)}, the ${digit} is in the ${pick === 'tenths' ? 'first' : 'second'} place after the point, so it is ${digit} ${pick}.`,
      }
    }

    const line = (): GeneratedItem => {
      const a = rng.int(0, 5)
      const k = rng.int(1, 9)
      const ans = Number((a + k / 10).toFixed(1))
      return {
        type: 'numberline',
        prompt: `Show ${fmt(ans)} on the number line.`,
        min: a,
        max: a + 1,
        step: 0.1,
        answer: ans,
        hints: [`The line goes from ${a} to ${a + 1}.`, 'It is split into 10 equal steps, so each step is 0.1.', `Count ${k} steps of 0.1 from ${a}.`],
        explanation: `${fmt(ans)} is ${k} tenths after ${a}.`,
      }
    }

    const compare = (): GeneratedItem => {
      const t = rng.int(2, 8)
      const a = t / 10
      const b = dec((t - 1) * 10 + rng.int(1, 9) + (rng.chance(0.5) ? 0 : 0))
      const bigger = Math.max(a, b)
      const smaller = Math.min(a, b)
      const correct = `${fmt(bigger)} is larger`
      return {
        type: 'mcq',
        prompt: `Which is true about ${fmt(a)} and ${fmt(b)}?`,
        ...textChoice(rng, correct, [
          { value: `${fmt(smaller)} is larger`, why: `Compare the tenths first: ${fmt(bigger)} has ${digitAt(Math.round(bigger * 100), 1)} tenths and ${fmt(smaller)} has ${digitAt(Math.round(smaller * 100), 1)}.` },
          { value: 'They are equal', why: `${fmt(a)} = ${fmt(a)}0, which is not the same as ${fmt(b)}.` },
          { value: 'You cannot compare them', why: 'You can compare any two decimals by writing them with the same number of places.' },
        ]),
        hints: ['Write both numbers with two decimal places.', `${fmt(a)} is the same as ${a.toFixed(2)}.`, 'Compare the tenths digits first.'],
        explanation: `${fmt(a)} = ${a.toFixed(2)}. ${bigger.toFixed(2)} is larger than ${smaller.toFixed(2)}, so ${fmt(bigger)} is larger.`,
        tip: 'More digits after the point does not mean a bigger number.',
      }
    }

    const fracDec = (): GeneratedItem => {
      const pairs = [
        { f: '1/2', d: 0.5 },
        { f: '1/4', d: 0.25 },
        { f: '3/4', d: 0.75 },
        { f: '1/10', d: 0.1 },
        { f: `${rng.int(11, 99)}/100`, d: 0 },
      ]
      const pr = rng.pick(pairs)
      const value = pr.d || dec(Number(pr.f.split('/')[0]))
      return {
        type: 'numeric',
        prompt: `Write ${pr.f} as a decimal.`,
        answer: value,
        allowDecimal: true,
        hints: ['Think of the fraction as hundredths.', pr.f.endsWith('/100') ? 'Hundredths go two places after the point.' : `Find an equivalent fraction with 100 at the bottom.`, pr.f === '1/2' ? '1/2 = 50/100.' : pr.f === '1/4' ? '1/4 = 25/100.' : pr.f === '3/4' ? '3/4 = 75/100.' : pr.f === '1/10' ? '1/10 = 10/100.' : `${pr.f} means ${pr.f.split('/')[0]} hundredths.`],
        explanation: `${pr.f} = ${fmt(value)}.`,
      }
    }

    const measure = (): GeneratedItem => {
      const kind = rng.int(0, 2)
      if (kind === 0) {
        const cm = rng.pick([rng.int(1, 9) * 10 + rng.int(1, 9), rng.int(11, 39) * 10]) + rng.pick([0, 100, 200])
        return {
          type: 'numeric',
          prompt: `${fmt(dec(cm))} m = ___ cm`,
          answer: cm,
          unit: 'cm',
          hints: ['1 m = 100 cm.', 'Multiply by 100: each digit moves two places to the left.', `${fmt(dec(cm))} m is ${fmt(dec(cm))} × 100 cm.`],
          explanation: `${fmt(dec(cm))} × 100 = ${cm}, so ${fmt(dec(cm))} m = ${cm} cm.`,
        }
      }
      if (kind === 1) {
        const t = rng.int(1, 9)
        return {
          type: 'mcq',
          prompt: `Which is the same as ${fmt(t / 10)}?`,
          ...textChoice(rng, `${t}/10`, [
            { value: `${t}/100`, why: `${t}/100 is ${fmt(dec(t))}, which has the ${t} in the hundredths place.` },
            { value: `1/${t}`, why: `1/${t} is one of ${t} equal parts, not ${t} tenths.` },
            { value: `${t * 10}/10`, why: `${t * 10}/10 is ${t} whole ones.` },
          ]),
          hints: ['Look at the first place after the decimal point.', 'The first place after the point is tenths.', `${fmt(t / 10)} has ${t} in the tenths place.`],
          explanation: `${fmt(t / 10)} is ${t} tenths, which is ${t}/10.`,
        }
      }
      const [A, B] = twoNames(rng)
      const a = rng.int(2, 3) + rng.int(1, 9) / 10
      const b = Number((Math.floor(a) + dec(rng.int(1, 99))).toFixed(2))
      const aa = Number(a.toFixed(1))
      if (aa === b) return measure()
      const ans = aa > b ? A : B
      return {
        type: 'mcq',
        prompt: `${A} jumps ${fmt(aa)} m. ${B} jumps ${fmt(b)} m. Who jumps further?`,
        ...textChoice(rng, ans, [
          { value: ans === A ? B : A, why: `${fmt(Math.max(aa, b))} is larger than ${fmt(Math.min(aa, b))}. Compare the tenths first.` },
          { value: 'They jump the same', why: `${fmt(aa)} and ${fmt(b)} are different lengths.` },
          { value: 'You cannot tell', why: 'Both are in metres, so you can compare them.' },
        ]),
        hints: ['Both jumps are in metres.', 'Write both with two decimal places, then compare.', `${fmt(aa)} = ${aa.toFixed(2)}.`],
        explanation: `${aa.toFixed(2)} and ${b.toFixed(2)}: ${ans} jumps further with ${fmt(Math.max(aa, b))} m.`,
        tags: WORD,
      }
    }

    const order = (): GeneratedItem => {
      const vals = new Set<number>()
      while (vals.size < 4) vals.add(rng.chance(0.5) ? rng.int(1, 9) / 10 : dec(rng.int(1, 99)))
      const arr = [...vals]
      const asc = rng.chance(0.5)
      const sorted = [...arr].sort((a, b) => (asc ? a - b : b - a))
      if (rng.chance(0.4)) {
        const t = rng.int(1, 8)
        return {
          type: 'numeric',
          prompt: `Which decimal is exactly halfway between ${fmt(t / 10)} and ${fmt((t + 1) / 10)}?`,
          answer: dec(t * 10 + 5),
          allowDecimal: true,
          hints: ['Write both numbers in hundredths.', `${fmt(t / 10)} = ${(t / 10).toFixed(2)} and ${fmt((t + 1) / 10)} = ${((t + 1) / 10).toFixed(2)}.`, 'Find the number in the middle of these hundredths.'],
          explanation: `${(t / 10).toFixed(2)} and ${((t + 1) / 10).toFixed(2)} have ${fmt(dec(t * 10 + 5))} exactly in the middle.`,
        }
      }
      return {
        type: 'order',
        prompt: `Put the decimals in order, starting with the ${asc ? 'smallest' : 'largest'}.`,
        items: sorted.map(fmt),
        hints: ['Write each decimal with two places after the point.', 'Compare the tenths first, then the hundredths.', `${fmt(sorted[0]!)} = ${sorted[0]!.toFixed(2)}.`],
        explanation: `In order: ${sorted.map(fmt).join(', ')}.`,
      }
    }

    const tenthsLine = (): GeneratedItem => {
      const k = rng.int(1, 9)
      return {
        type: 'mcq',
        prompt: 'What decimal is at point A?',
        figure: { kind: 'numberline', min: 0, max: 1, step: 0.1, labels: [0, 1], marks: [{ at: k / 10, label: 'A' }], alt: `A number line from 0 to 1 in tenths. Point A is ${plural(k, 'step', 'steps')} after 0.` },
        ...textChoice(rng, fmt(k / 10), [
          { value: fmt(dec(k)), why: `${fmt(dec(k))} is ${k} hundredths, which is much closer to 0.` },
          { value: String(k), why: `${k} is a whole number. Point A is between 0 and 1.` },
          { value: fmt((10 - k) / 10 || 0.5), why: 'Count the steps from 0, not from 1.' },
          { value: fmt(((k % 9) + 1) / 10), why: `Count the steps from 0 to A again.` },
        ].filter((w) => w.value !== fmt(k / 10))),
        hints: ['The line from 0 to 1 is split into 10 equal steps.', 'Each step is one tenth.', 'Count the steps from 0 to A.'],
        explanation: `A is ${plural(k, 'step', 'steps')} of one tenth after 0, so it is ${fmt(k / 10)}.`,
      }
    }

    if (level === 1) return oneOf(rng, [tenths, tenthsLine])
    if (level === 2) return hundredths()
    if (level === 3) return oneOf(rng, [line, compare, fracDec])
    if (level === 4) return measure()
    return order()
  },
}

const frac4 = (n: number, d: number): string => `${n}/${d}`
const DEN_NAME: Record<number, string> = { 2: 'halves', 3: 'thirds', 4: 'quarters', 5: 'fifths', 6: 'sixths', 7: 'sevenths', 8: 'eighths', 9: 'ninths', 10: 'tenths', 11: 'elevenths', 12: 'twelfths' }
type FracShape4 = 'bar' | 'circle' | 'square'
const fracFig4 = (shape: FracShape4, parts: number, shaded: number): Fig => ({ kind: 'fraction', shape, parts, shaded, alt: `A ${shape} cut into ${parts} equal parts with ${plural(shaded, 'part', 'parts')} shaded.` })

/** Pecahan sederhana (bentuk paling sederhana). */
function simplest(n: number, d: number): [number, number] {
  const g = gcdN(n, d)
  return [n / g, d / g]
}

/** Jawaban teks yang wajar untuk sebuah pecahan. */
function fracAnswers(n: number, d: number): string[] {
  const out = new Set<string>([frac4(n, d)])
  const [a, b] = simplest(n, d)
  out.add(b === 1 ? String(a) : frac4(a, b))
  if (n === d) {
    out.add('1')
    out.add('1 whole')
  }
  if (n === 0) out.add('0')
  return [...out]
}

const EQUIV4: readonly [number, number, number][] = [
  [1, 2, 6], [1, 2, 8], [1, 2, 10], [1, 3, 6], [2, 3, 6], [1, 3, 9], [2, 3, 9], [1, 4, 8], [3, 4, 8], [1, 4, 12], [3, 4, 12], [1, 5, 10], [2, 5, 10], [3, 5, 10], [4, 5, 10], [1, 6, 12], [5, 6, 12], [2, 3, 12],
]

const equivalent4: Generator = {
  skill: 'm4.equivalent-fractions',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const missing = (simplify: boolean): GeneratedItem => {
      const [a, b, d2] = rng.pick(EQUIV4)
      const m = d2 / b
      if (simplify) {
        return {
          type: 'numeric',
          prompt: `Find the missing number. ${frac4(a * m, d2)} = ___/${b}`,
          figure: fracFig4('bar', d2, a * m),
          answer: a,
          hints: ['Equivalent fractions show the same amount.', 'Divide the top and the bottom by the same number.', `What do you divide ${d2} by to get ${b}?`],
          explanation: `${a * m} ÷ ${m} = ${a} and ${d2} ÷ ${m} = ${b}, so ${frac4(a * m, d2)} = ${frac4(a, b)}.`,
        }
      }
      return {
        type: 'numeric',
        prompt: `Find the missing number. ${frac4(a, b)} = ___/${d2}`,
        figure: fracFig4('bar', b, a),
        answer: a * m,
        hints: ['Equivalent fractions show the same amount.', 'Multiply the top and the bottom by the same number.', a === 1 ? `Split each of the ${b} parts into smaller equal parts until there are ${d2}.` : `${b} × ${m} = ${d2}.`],
        explanation: `${a} × ${m} = ${a * m} and ${b} × ${m} = ${d2}, so ${frac4(a, b)} = ${frac4(a * m, d2)}.`,
        solution: [
          { say: `Start with ${frac4(a, b)}.`, figure: fracFig4('bar', b, a) },
          { say: `Split each part into ${m}. The shaded amount stays the same.`, figure: fracFig4('bar', d2, a * m) },
          { say: 'Write the new fraction.', show: `${frac4(a, b)} = ${frac4(a * m, d2)}` },
        ],
      }
    }

    const sameTop = (): GeneratedItem => {
      const n = rng.int(1, 4)
      const [d1, d2] = rng.sample(range(n + 1, 12), 2) as [number, number]
      const big = d1 < d2 ? d1 : d2
      const small = d1 < d2 ? d2 : d1
      const correct = `${frac4(n, big)} > ${frac4(n, small)}`
      return {
        type: 'mcq',
        prompt: 'Which of these is true?',
        ...textChoice(rng, correct, [
          { value: `${frac4(n, small)} > ${frac4(n, big)}`, why: `${DEN_NAME[small]} are smaller parts than ${DEN_NAME[big]}, so ${frac4(n, small)} is the smaller fraction.` },
          { value: `${frac4(n, big)} = ${frac4(n, small)}`, why: 'The parts are different sizes, so the fractions are not equal.' },
          { value: `${frac4(n, big)} < ${frac4(n, small)}`, why: `${big} parts are bigger than ${small} parts, so ${frac4(n, big)} is larger.` },
        ]),
        hints: ['Both fractions have the same top number.', 'The more parts a whole is cut into, the smaller each part.', `Compare ${frac4(1, big)} with ${frac4(1, small)}.`],
        explanation: `${n} parts of ${big} are bigger than ${n} parts of ${small}, so ${correct}.`,
      }
    }

    const lineMark = (): GeneratedItem => {
      const d = rng.pick([4, 5, 6, 8, 10])
      const k = rng.int(1, d - 1)
      return {
        type: 'mcq',
        prompt: 'What fraction is at point A?',
        figure: { kind: 'numberline', min: 0, max: 1, step: 1 / d, labels: [0, 1], marks: [{ at: k / d, label: 'A' }], alt: `A number line from 0 to 1 split into ${d} equal steps. Point A is at step ${k}.` },
        ...textChoice(rng, frac4(k, d), [
          { value: frac4(k, d + 1), why: `Count the equal steps from 0 to 1 again. There are ${d}.` },
          { value: frac4(d - k, d), why: `${frac4(d - k, d)} counts the steps from A to 1.` },
          { value: frac4(k + 1, d), why: `Count the steps from 0 to A again. There ${k === 1 ? 'is' : 'are'} ${k}.` },
          { value: frac4(1, k + 1), why: `Count the steps from 0 to A, then write it over ${d}.` },
        ]),
        hints: ['Count the equal steps between 0 and 1.', 'That number goes on the bottom of the fraction.', 'Now count the steps from 0 to A.'],
        explanation: `The line from 0 to 1 is split into ${d} equal steps, and A is ${plural(k, 'step', 'steps')} along, so A is ${frac4(k, d)}.`,
      }
    }

    const related = (): GeneratedItem => {
      const opts = [[1, 2, 3, 8], [1, 2, 5, 8], [1, 4, 3, 8], [3, 4, 5, 8], [2, 3, 5, 6], [1, 3, 1, 6], [1, 2, 3, 10], [2, 5, 3, 10], [3, 4, 7, 8], [1, 2, 2, 6]] as const
      const [a, b, c, d] = rng.pick(opts)
      const va = a / b
      const vc = c / d
      const ans = va > vc ? frac4(a, b) : va < vc ? frac4(c, d) : 'They are equal'
      const fa = frac4(a, b)
      const fc = frac4(c, d)
      const conv = `${fa} = ${frac4(a * (d / b), d)}`
      return {
        type: 'mcq',
        prompt: `Which is larger, ${fa} or ${fc}?`,
        ...textChoice(rng, ans, [
          ...(ans !== fa ? [{ value: fa, why: `${conv}, which is ${va > vc ? 'more' : 'less'} than ${fc}.` }] : []),
          ...(ans !== fc ? [{ value: fc, why: `${conv}, so compare ${frac4(a * (d / b), d)} with ${fc}.` }] : []),
          ...(ans !== 'They are equal' ? [{ value: 'They are equal', why: `${conv}, which is not the same as ${fc}.` }] : []),
          { value: 'You cannot tell', why: 'Change one fraction so they have the same bottom number, then compare.' },
        ]),
        hints: ['Make the bottom numbers the same.', `Change ${fa} into ${DEN_NAME[d]}.`, `${b} × ${d / b} = ${d}.`],
        explanation: `${conv}. Compared with ${fc}, ${ans === 'They are equal' ? 'they are the same' : `${ans} is larger`}.`,
      }
    }

    const order = (): GeneratedItem => {
      const pool = [[1, 2], [1, 4], [3, 4], [1, 8], [3, 8], [5, 8], [7, 8]] as const
      const pick = rng.sample(pool, 4)
      const asc = rng.chance(0.5)
      const sorted = [...pick].sort((x, y) => (asc ? x[0] / x[1] - y[0] / y[1] : y[0] / y[1] - x[0] / x[1]))
      return {
        type: 'order',
        prompt: `Put the fractions in order, starting with the ${asc ? 'smallest' : 'largest'}.`,
        items: sorted.map(([n, d]) => frac4(n, d)),
        hints: ['Change every fraction into eighths.', '1/2 = 4/8 and 1/4 = 2/8.', sorted[0]![1] === 8 ? `${frac4(sorted[0]![0], 8)} is already in eighths.` : `${frac4(sorted[0]![0], sorted[0]![1])} = ${frac4(sorted[0]![0] * (8 / sorted[0]![1]), 8)}.`],
        explanation: `In eighths: ${sorted.map(([n, d]) => frac4(n * (8 / d), 8)).join(', ')}. So the order is ${sorted.map(([n, d]) => frac4(n, d)).join(', ')}.`,
      }
    }

    const between = (): GeneratedItem => {
      const opts = [
        { lo: [1, 4], hi: [1, 2], a: [3, 8], wrong: [[1, 8], [5, 8], [7, 8]] },
        { lo: [1, 2], hi: [3, 4], a: [5, 8], wrong: [[3, 8], [7, 8], [1, 8]] },
        { lo: [1, 3], hi: [2, 3], a: [1, 2], wrong: [[1, 6], [5, 6], [1, 4]] },
        { lo: [1, 5], hi: [2, 5], a: [3, 10], wrong: [[1, 10], [5, 10], [7, 10]] },
        { lo: [1, 4], hi: [3, 4], a: [5, 12], wrong: [[1, 12], [11, 12], [1, 6]] },
      ] as const
      const o = rng.pick(opts)
      const f = (x: readonly [number, number]) => frac4(x[0], x[1])
      const L = ([o.lo[1], o.hi[1], o.a[1], ...o.wrong.map((w) => w[1])] as number[]).reduce((x, y) => (x * y) / gcdN(x, y))
      const inL = (x: readonly [number, number]) => frac4(x[0] * (L / x[1]), L)
      const eq = (x: readonly [number, number]) => (x[1] === L ? f(x) : `${f(x)} = ${inL(x)}`)
      return {
        type: 'mcq',
        prompt: `Which fraction is between ${f(o.lo)} and ${f(o.hi)}?`,
        ...textChoice(rng, f(o.a), o.wrong.map((w) => ({ value: f(w), why: `${eq(w)}, which is ${w[0] / w[1] < o.lo[0] / o.lo[1] ? `smaller than ${f(o.lo)}` : `larger than ${f(o.hi)}`}.` }))),
        hints: ['Change all the fractions so they have the same bottom number.', `Use ${DEN_NAME[L]} for every fraction.`, `${f(o.lo)} = ${inL(o.lo)}.`],
        explanation: `${f(o.lo)} = ${inL(o.lo)} and ${f(o.hi)} = ${inL(o.hi)}. ${eq(o.a)}, which is between them.`,
      }
    }

    const shadeEq = (): GeneratedItem => {
      const [a, b, d2] = rng.pick(EQUIV4.filter((e) => e[2] <= 12))
      const shape = rng.pick(['bar', 'circle', 'square'] as const)
      return {
        type: 'fraction',
        prompt: `This ${shape} has ${d2} equal parts. Shade ${frac4(a, b)} of it.`,
        shape,
        parts: d2,
        answer: { num: a, den: b },
        hints: [`${frac4(a, b)} is the same as some number of the ${d2} parts.`, 'Multiply the top and the bottom by the same number.', `${b} × ${d2 / b} = ${d2}.`],
        explanation: `${frac4(a, b)} = ${frac4(a * (d2 / b), d2)}, so shade ${a * (d2 / b)} of the ${d2} parts.`,
      }
    }

    if (level === 1) return oneOf(rng, [() => missing(false), shadeEq])
    if (level === 2) return oneOf(rng, [() => missing(true), sameTop])
    if (level === 3) return lineMark()
    if (level === 4) return oneOf(rng, [related, order])
    return between()
  },
}

const fractionsAddSub4: Generator = {
  skill: 'm4.fractions-add-sub',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const addMcq = (): GeneratedItem => {
      const d = rng.int(5, 12)
      const a = rng.int(1, d - 2)
      const b = rng.int(1, d - 1 - a)
      return {
        type: 'mcq',
        prompt: `${frac4(a, d)} + ${frac4(b, d)} = ?`,
        figure: fracFig4('bar', d, a),
        ...textChoice(rng, frac4(a + b, d), [
          { value: frac4(a + b, 2 * d), why: `Only add the top numbers. The parts are the same size, so the bottom number stays ${d}.` },
          { value: frac4(a + b + 1, d), why: `Count again: ${a} + ${b} = ${a + b}.` },
          { value: frac4(Math.abs(a - b) || 1, d), why: 'This takes away. The question adds.' },
          { value: frac4(a * b, d), why: 'This multiplies the top numbers. Add them instead.' },
        ].filter((w) => w.value !== frac4(a + b, d))),
        hints: ['The bottom numbers are the same, so the parts are the same size.', 'Add the top numbers. The bottom number stays the same.', `${a} + ${b} = ${a + b}.`],
        explanation: `${plural(a, 'part', 'parts')} + ${plural(b, 'part', 'parts')} = ${a + b} parts of ${d}. So ${frac4(a, d)} + ${frac4(b, d)} = ${frac4(a + b, d)}.`,
      }
    }

    const shadeSum = (): GeneratedItem => {
      const d = rng.pick([6, 8, 10, 12])
      const a = rng.int(1, d - 2)
      const b = rng.int(1, d - 1 - a)
      return {
        type: 'fraction',
        prompt: `Shade ${frac4(a, d)} + ${frac4(b, d)} of the bar.`,
        shape: 'bar',
        parts: d,
        answer: { num: a + b, den: d },
        hints: [`The bar has ${d} equal parts.`, `Shade ${a} parts, then ${b} more parts.`, `${a} + ${b} = ${a + b}.`],
        explanation: `${frac4(a, d)} + ${frac4(b, d)} = ${frac4(a + b, d)}, so ${a + b} parts are shaded.`,
      }
    }

    const subtract = (): GeneratedItem => {
      const d = rng.int(5, 12)
      const a = rng.int(3, d - 1)
      const b = rng.int(1, a - 1)
      if (rng.chance(0.5)) {
        return {
          type: 'text',
          prompt: `Work out ${frac4(a, d)} - ${frac4(b, d)}. Write your answer as a fraction.`,
          blanks: [{ answers: fracAnswers(a - b, d) }],
          hints: ['The bottom numbers are the same.', 'Take away the top numbers. The bottom number stays the same.', `${a} - ${b} = ${a - b}.`],
          explanation: `${a} parts - ${plural(b, 'part', 'parts')} = ${plural(a - b, 'part', 'parts')} of ${d}, so the answer is ${frac4(a - b, d)}.`,
        }
      }
      return {
        type: 'mcq',
        prompt: `${frac4(a, d)} - ${frac4(b, d)} = ?`,
        ...textChoice(rng, frac4(a - b, d), [
          { value: frac4(a + b, d), why: 'This adds. The question takes away.' },
          { value: frac4(a - b + 1, d), why: `Check the subtraction: ${a} - ${b} = ${a - b}.` },
          { value: frac4(b, d), why: `${frac4(b, d)} is the amount taken away, not what is left.` },
          { value: frac4(a - b, 2 * d), why: `The parts stay the same size, so the bottom number stays ${d}.` },
        ].filter((w) => w.value !== frac4(a - b, d))),
        hints: ['The bottom numbers are the same.', 'Take away the top numbers. The bottom number stays the same.', `${a} - ${b} = ${a - b}.`],
        explanation: `${a} - ${b} = ${a - b}, so ${frac4(a, d)} - ${frac4(b, d)} = ${frac4(a - b, d)}.`,
      }
    }

    const whole = (): GeneratedItem => {
      const d = rng.int(4, 10)
      if (rng.chance(0.5)) {
        const a = rng.int(1, d - 1)
        return {
          type: 'text',
          prompt: `${frac4(a, d)} + ${frac4(d - a, d)} = ___`,
          blanks: [{ answers: fracAnswers(d, d) }],
          hints: ['Add the top numbers.', `How many parts of ${d} make one whole?`, `${a} + ${d - a} = ${d}.`],
          explanation: `${frac4(a, d)} + ${frac4(d - a, d)} = ${frac4(d, d)}, which is 1 whole.`,
        }
      }
      const b = rng.int(1, d - 1)
      return {
        type: 'text',
        prompt: `1 - ${frac4(b, d)} = ___`,
        blanks: [{ answers: fracAnswers(d - b, d) }],
        hints: [`Write 1 as a fraction with ${d} at the bottom.`, `1 = ${frac4(d, d)}.`, `${d} - ${b} = ${d - b}.`],
        explanation: `1 = ${frac4(d, d)}, and ${frac4(d, d)} - ${frac4(b, d)} = ${frac4(d - b, d)}.`,
        solution: [
          { say: 'Write 1 as a fraction.', show: `1 = ${frac4(d, d)}`, figure: fracFig4('bar', d, d) },
          { say: 'Take away the top numbers.', show: `${frac4(d, d)} - ${frac4(b, d)} = ${frac4(d - b, d)}` },
        ],
      }
    }

    const story = (): GeneratedItem => {
      const name = pickName(rng)
      const d = rng.pick([6, 8, 9, 10, 12])
      const a = rng.int(1, Math.floor(d / 2))
      const b = rng.int(1, d - a - 1)
      const left = d - a - b
      const ctx = rng.pick([
        { what: 'a fence', do1: 'paints', w1: 'on Monday', w2: 'on Tuesday', q: 'What fraction of the fence is left to paint?' },
        { what: 'a book', do1: 'reads', w1: 'on Saturday', w2: 'on Sunday', q: 'What fraction of the book is left to read?' },
        { what: 'a jigsaw', do1: 'finishes', w1: 'in the morning', w2: 'in the afternoon', q: 'What fraction of the jigsaw is left to do?' },
      ])
      return {
        type: 'text',
        prompt: `${name} ${ctx.do1} ${frac4(a, d)} of ${ctx.what} ${ctx.w1} and ${frac4(b, d)} ${ctx.w2}. ${ctx.q}`,
        blanks: [{ answers: fracAnswers(left, d) }],
        hints: ['First add the two parts that are done.', `Then take that away from 1 whole, which is ${frac4(d, d)}.`, `${a} + ${b} = ${a + b} parts are done.`],
        explanation: `${frac4(a, d)} + ${frac4(b, d)} = ${frac4(a + b, d)} is done. ${frac4(d, d)} - ${frac4(a + b, d)} = ${frac4(left, d)} is left.`,
        tags: WORD,
      }
    }

    const pairToOne = (): GeneratedItem => {
      const d = rng.int(6, 12)
      const a = rng.int(1, d - 1)
      const correct = `${frac4(a, d)} and ${frac4(d - a, d)}`
      const wrong = [
        { value: `${frac4(a, d)} and ${frac4(d - a + 1, d)}`, why: `${a} + ${d - a + 1} = ${d + 1}, which is more than ${d}.` },
        { value: `${frac4(a, d)} and ${frac4(Math.max(1, d - a - 1), d)}`, why: `${a} + ${Math.max(1, d - a - 1)} = ${a + Math.max(1, d - a - 1)}, which is less than ${d}.` },
        { value: `${frac4(a, d)} and ${frac4(d - a, d - a)}`, why: `${frac4(d - a, d - a)} is already 1 whole on its own.` },
        { value: `${frac4(a, d)} and ${frac4(d, d)}`, why: `${frac4(d, d)} is 1 whole, so the total is more than 1.` },
      ].filter((w) => w.value !== correct)
      return {
        type: 'mcq',
        prompt: 'Which two fractions add up to exactly 1 whole?',
        ...textChoice(rng, correct, wrong),
        hints: [`1 whole is the same as ${frac4(d, d)}.`, `The top numbers must add up to ${d}.`, `Check each pair: add the top numbers.`],
        explanation: `${a} + ${d - a} = ${d}, so ${correct} make ${frac4(d, d)}, which is 1 whole.`,
      }
    }

    if (level === 1) return oneOf(rng, [addMcq, shadeSum])
    if (level === 2) return subtract()
    if (level === 3) return whole()
    if (level === 4) return story()
    return pairToOne()
  },
}

const MEASURES4 = [
  { whole: 1000, unit: 'g', of: 'a kilogram', big: 'kg', ds: [2, 4, 5, 10] },
  { whole: 100, unit: 'cm', of: 'a metre', big: 'm', ds: [2, 4, 5, 10] },
  { whole: 60, unit: 'minutes', of: 'an hour', big: 'hour', ds: [2, 3, 4, 5, 6, 10] },
  { whole: 1000, unit: 'ml', of: 'a litre', big: 'l', ds: [2, 4, 5, 10] },
] as const

const fractionsOfAmounts4: Generator = {
  skill: 'm4.fractions-of-amounts',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const unit = (): GeneratedItem => {
      const d = rng.pick([3, 4, 6, 7, 8, 9])
      const k = rng.int(3, 12)
      return {
        type: 'numeric',
        prompt: `What is ${frac4(1, d)} of ${d * k}?`,
        figure: { kind: 'fraction', shape: 'bar', parts: d, shaded: 1, label: String(d * k), alt: `A bar for ${d * k} split into ${d} equal parts, with 1 part shaded.` },
        answer: k,
        hints: [`To find ${frac4(1, d)}, divide by ${d}.`, `Use the ${d} times table.`, `How many ${d}s make ${d * k}?`],
        explanation: `${d * k} ÷ ${d} = ${k}, so ${frac4(1, d)} of ${d * k} is ${k}.`,
      }
    }

    const nonUnit = (): GeneratedItem => {
      const d = rng.pick([3, 4, 5, 6, 8, 10])
      const s = rng.int(2, d - 1)
      const k = rng.int(3, 12)
      const n = d * k
      const ans = s * k
      const hints = [`Find ${frac4(1, d)} of ${n} first.`, `Divide by ${d}, then multiply by ${s}.`, `${n} ÷ ${d} = ${k}.`]
      const explanation = `${n} ÷ ${d} = ${k}. ${s} × ${k} = ${ans}, so ${frac4(s, d)} of ${n} is ${ans}.`
      const figure: Fig = { kind: 'fraction', shape: 'bar', parts: d, shaded: s, label: String(n), alt: `A bar for ${n} split into ${d} equal parts, with ${s} parts shaded.` }
      if (rng.chance(0.5)) return { type: 'numeric', prompt: `What is ${frac4(s, d)} of ${n}?`, figure, answer: ans, hints, explanation }
      return {
        type: 'mcq',
        prompt: `What is ${frac4(s, d)} of ${n}?`,
        figure,
        ...numChoice(rng, ans, [
          { value: k, why: `${k} is ${frac4(1, d)} of ${n}. You need ${s} of these parts.` },
          { value: n - ans, why: `${n - ans} is the other part, ${frac4(d - s, d)} of ${n}.` },
          { value: Math.round(n / s), why: `This divides by ${s}. Divide by ${d}, then multiply by ${s}.` },
          { value: ans + k, why: `That is ${s + 1} parts. You need ${s}.` },
        ]),
        hints,
        explanation,
      }
    }

    const measure = (): GeneratedItem => {
      const m = rng.pick(MEASURES4)
      const d = rng.pick(m.ds)
      const s = rng.int(1, d - 1)
      const ans = (m.whole / d) * s
      return {
        type: 'numeric',
        prompt: `How many ${m.unit === 'g' ? 'grams' : m.unit === 'cm' ? 'centimetres' : m.unit === 'ml' ? 'millilitres' : 'minutes'} are in ${frac4(s, d)} of ${m.of}?`,
        answer: ans,
        unit: m.unit,
        hints: [`1 ${m.big} = ${fmt(m.whole)} ${m.unit}.`, `Find ${frac4(1, d)} of ${fmt(m.whole)} first.`, s === 1 ? `Share ${fmt(m.whole)} into ${d} equal parts. How big is each part?` : `${fmt(m.whole)} ÷ ${d} = ${fmt(m.whole / d)}.`],
        explanation: `${fmt(m.whole)} ÷ ${d} = ${fmt(m.whole / d)}${s > 1 ? ` and ${s} × ${fmt(m.whole / d)} = ${fmt(ans)}` : ''}. So ${frac4(s, d)} of ${m.of} is ${fmt(ans)} ${m.unit}.`,
      }
    }

    const story = (): GeneratedItem => {
      const name = pickName(rng)
      if (rng.chance(0.5)) {
        const [n, d] = rng.pick([[32, 8], [24, 8], [30, 6], [28, 4], [36, 9], [35, 5], [40, 8]] as const)
        const s = rng.int(1, d - 1)
        const yes = (n / d) * s
        return {
          type: 'numeric',
          prompt: `There are ${n} children in a class. ${frac4(s, d)} of them walk to school. How many children do not walk to school?`,
          answer: n - yes,
          hints: [`First find ${frac4(s, d)} of ${n}.`, 'Then take that away from the whole class.', `Find one part first: divide ${n} by ${d}.`],
          explanation: `${frac4(s, d)} of ${n} is ${yes}. ${n} - ${yes} = ${n - yes} children do not walk.`,
          tags: WORD,
        }
      }
      const [money, d] = rng.pick([[50000, 5], [40000, 4], [60000, 3], [80000, 8], [30000, 6], [20000, 4]] as const)
      const s = rng.int(1, d - 1)
      const spent = (money / d) * s
      return {
        type: 'numeric',
        prompt: `${name} has Rp${money.toLocaleString('id-ID')}. ${name} spends ${frac4(s, d)} of it on a book. How much money is left?`,
        answer: money - spent,
        unit: 'rupiah',
        hints: [`Find ${frac4(s, d)} of Rp${money.toLocaleString('id-ID')} first.`, 'Then take the amount spent away from the money at the start.', `Rp${money.toLocaleString('id-ID')} ÷ ${d} = Rp${(money / d).toLocaleString('id-ID')}.`],
        explanation: `${frac4(s, d)} of Rp${money.toLocaleString('id-ID')} is Rp${spent.toLocaleString('id-ID')}. Rp${money.toLocaleString('id-ID')} - Rp${spent.toLocaleString('id-ID')} = Rp${(money - spent).toLocaleString('id-ID')}.`,
        tags: WORD,
      }
    }

    const inverse = (): GeneratedItem => {
      const d = rng.pick([3, 4, 5, 6, 8])
      const s = rng.int(1, d - 1)
      const k = rng.int(3, 12)
      const part = s * k
      return {
        type: 'numeric',
        prompt: `${frac4(s, d)} of a number is ${part}. What is the number?`,
        answer: d * k,
        hints: [`The whole is split into ${d} equal parts.`, s > 1 ? `${s} parts make ${part}, so find 1 part first.` : `1 part is ${part}.`, s > 1 ? `${part} ÷ ${s} = ${k}.` : `Multiply ${part} by ${d}.`],
        explanation: `1 part is ${k}, so ${d} parts make ${d} × ${k} = ${d * k}.`,
        solution: [
          { say: `Draw a bar with ${d} equal parts. ${s} of them make ${part}.`, figure: fracFig4('bar', d, s) },
          { say: 'Find one part.', show: `${part} ÷ ${s} = ${k}` },
          { say: 'Find the whole.', show: `${d} × ${k} = ${d * k}` },
        ],
      }
    }

    if (level === 1) return unit()
    if (level === 2) return nonUnit()
    if (level === 3) return measure()
    if (level === 4) return story()
    return inverse()
  },
}

// ---------------------------------------------------------------------------
// Nm: uang
// ---------------------------------------------------------------------------

const rp = (n: number): string => `Rp${n.toLocaleString('id-ID')}`

const SHOP4 = [
  { one: 'notebook', many: 'notebooks', lo: 5000, hi: 12000 },
  { one: 'pen', many: 'pens', lo: 3000, hi: 7500 },
  { one: 'box of crayons', many: 'boxes of crayons', lo: 12000, hi: 25000 },
  { one: 'storybook', many: 'storybooks', lo: 25000, hi: 45000 },
  { one: 'football', many: 'footballs', lo: 45000, hi: 90000 },
  { one: 'water bottle', many: 'water bottles', lo: 15000, hi: 35000 },
  { one: 'kite', many: 'kites', lo: 10000, hi: 20000 },
  { one: 'pencil case', many: 'pencil cases', lo: 18000, hi: 40000 },
] as const

const priceRp = (rng: Rng, lo: number, hi: number): number => rng.int(lo / 500, hi / 500) * 500

const moneyRupiah4: Generator = {
  skill: 'm4.money-rupiah',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const name = pickName(rng)

    const count = (): GeneratedItem => {
      const denoms = rng.sample([2000, 5000, 10000, 20000, 50000] as const, 3).sort((a, b) => b - a)
      const items = denoms.map((v) => ({ value: v, count: rng.int(1, v >= 20000 ? 2 : 3) }))
      const total = items.reduce((t, i) => t + i.value * i.count, 0)
      const words = ['zero', 'one', 'two', 'three']
      return {
        type: 'numeric',
        prompt: `${name} has these notes. How much money is that altogether?`,
        figure: { kind: 'money', items, alt: `${cap(listAnd(items.map((i) => `${words[i.count]} ${rp(i.value)} ${i.count > 1 ? 'notes' : 'note'}`)))}.` },
        answer: total,
        unit: 'rupiah',
        hints: ['Start with the notes worth the most.', 'Find the value of each kind of note, then add.', `${items[0]!.count} × ${rp(items[0]!.value)} = ${rp(items[0]!.value * items[0]!.count)}.`],
        explanation: `${items.map((i) => rp(i.value * i.count)).join(' + ')} = ${rp(total)}.`,
      }
    }

    const several = (): GeneratedItem => {
      const it = rng.pick(SHOP4.filter((x) => x.hi <= 25000))
      const n = rng.int(3, 6)
      const p = priceRp(rng, it.lo, it.hi)
      const total = n * p
      const paid = [50000, 100000, 200000].find((v) => v >= total + 1000)!
      if (rng.chance(0.5)) {
        return {
          type: 'numeric',
          prompt: `${name} buys ${n} ${it.many} at ${rp(p)} each. How much does ${name} pay?`,
          answer: total,
          unit: 'rupiah',
          hints: ['Each item costs the same, so multiply.', `Work out ${n} × ${rp(p)}.`, p % 1000 === 0 ? `Work out ${n} × ${p / 1000}, then write the answer in thousands.` : `Split ${rp(p)} into ${rp(p - (p % 1000))} and ${rp(p % 1000)}. Multiply each part by ${n}.`],
          explanation: `${n} × ${rp(p)} = ${rp(total)}.`,
          tags: WORD,
        }
      }
      return {
        type: 'numeric',
        prompt: `${name} buys ${n} ${it.many} at ${rp(p)} each and pays with ${rp(paid)}. How much change does ${name} get?`,
        answer: paid - total,
        unit: 'rupiah',
        hints: ['First find the total cost.', `Multiply ${rp(p)} by ${n}, then take the total away from ${rp(paid)}.`, `${n} × ${rp(p)} = ${rp(total)}.`],
        explanation: `${n} × ${rp(p)} = ${rp(total)}. ${rp(paid)} - ${rp(total)} = ${rp(paid - total)}.`,
        solution: [
          { say: 'Find the total cost.', show: `${n} × ${rp(p)} = ${rp(total)}` },
          { say: 'Take it away from the money paid.', show: `${rp(paid)} - ${rp(total)} = ${rp(paid - total)}` },
        ],
        tags: WORD,
      }
    }

    const list = (): GeneratedItem => {
      const picks = rng.sample(SHOP4.filter((x) => x.hi <= 45000), 4).map((x) => ({ ...x, p: priceRp(rng, x.lo, x.hi) }))
      const figure: Fig = { kind: 'table', head: ['Item', 'Price'], rows: picks.map((x) => [cap(x.one), rp(x.p)]), alt: `Price list: ${picks.map((x) => `${x.one} ${rp(x.p)}`).join(', ')}.` }
      const [a, b] = rng.sample(picks, 2) as [(typeof picks)[number], (typeof picks)[number]]
      const na = rng.int(2, 3)
      const nb = rng.int(1, 2)
      const total = na * a.p + nb * b.p
      const paid = [100000, 150000, 200000].find((v) => v >= total + 1000)!
      return {
        type: 'numeric',
        prompt: `${name} buys ${na} ${a.many} and ${nb === 1 ? art(b.one) : `${nb} ${b.many}`}. ${name} pays with ${rp(paid)}. How much change does ${name} get?`,
        figure,
        answer: paid - total,
        unit: 'rupiah',
        hints: ['Find the cost of each kind of item first.', 'Add the costs, then take the total away from the money paid.', `${na} × ${rp(a.p)} = ${rp(na * a.p)}.`],
        explanation: `${na} × ${rp(a.p)} = ${rp(na * a.p)} and ${nb} × ${rp(b.p)} = ${rp(nb * b.p)}. The total is ${rp(total)}. ${rp(paid)} - ${rp(total)} = ${rp(paid - total)}.`,
        tags: WORD,
      }
    }

    const deal = (): GeneratedItem => {
      if (rng.chance(0.5)) {
        const k = rng.int(3, 5)
        const single = rng.int(4, 9) * 1000 + rng.pick([0, 500])
        const pack = k * single - rng.int(2, 6) * 500
        const it = rng.pick(['pens', 'erasers', 'juice boxes', 'stickers sheets'.replace('stickers sheets', 'sheets of stickers')])
        return {
          type: 'numeric',
          prompt: `A pack of ${k} ${it} costs ${rp(pack)}. One costs ${rp(single)} on its own. How much do you save by buying the pack?`,
          answer: k * single - pack,
          unit: 'rupiah',
          hints: [`Find the cost of ${k} single ${it} first.`, `Then find the difference between that and ${rp(pack)}.`, `${k} × ${rp(single)} = ${rp(k * single)}.`],
          explanation: `${k} × ${rp(single)} = ${rp(k * single)}. ${rp(k * single)} - ${rp(pack)} = ${rp(k * single - pack)} saved.`,
          tags: WORD,
        }
      }
      const t = rng.int(8, 15) * 1000
      const budget = t * rng.int(3, 7) + rng.int(1, t / 1000 - 1) * 1000
      const n = Math.floor(budget / t)
      return {
        type: 'mcq',
        prompt: `${name} has ${rp(budget)}. A ticket costs ${rp(t)}. How many tickets can ${name} buy?`,
        ...numChoice(rng, n, [
          { value: n + 1, why: `${n + 1} tickets cost ${rp((n + 1) * t)}, which is more than ${rp(budget)}.` },
          { value: n - 1, why: `${name} still has enough money for one more ticket.` },
          { value: budget - n * t, why: `${rp(budget - n * t)} is the money left over, not the number of tickets.` },
        ], { render: (v) => (v >= 1000 ? rp(v) : String(v)), spread: [2, -2] }),
        hints: [`How many lots of ${rp(t)} fit into ${rp(budget)}?`, `Count on in ${rp(t)} steps without going over.`, `2 tickets cost ${rp(2 * t)}.`],
        explanation: `${n} × ${rp(t)} = ${rp(n * t)}, which fits. One more would cost ${rp((n + 1) * t)}, which is too much. So ${n} tickets.`,
        tags: WORD,
      }
    }

    const saving = (): GeneratedItem => {
      const w = rng.pick([10000, 15000, 20000, 25000])
      const target = rng.pick([100000, 150000, 200000, 120000])
      const weeks = Math.ceil(target / w)
      return {
        type: 'numeric',
        prompt: `${name} saves ${rp(w)} every week. How many weeks does it take to save at least ${rp(target)}?`,
        answer: weeks,
        hints: ['Count up in equal steps, one step for each week.', `Count in ${rp(w)}s until you reach ${rp(target)} or more.`, `After 2 weeks ${name} has ${rp(2 * w)}.`],
        explanation: `After ${weeks - 1} weeks ${name} has ${rp((weeks - 1) * w)}, which is not enough. After ${weeks} weeks ${name} has ${rp(weeks * w)}.`,
        tags: WORD,
      }
    }

    if (level === 1) return count()
    if (level === 2) return several()
    if (level === 3) return list()
    if (level === 4) return deal()
    return saving()
  },
}

const usd = (cents: number): string => `$${(cents / 100).toFixed(2)}`
const asDollars = (cents: number): number => Number((cents / 100).toFixed(2))

const SHOP_USD = [
  { one: 'postcard', many: 'postcards', lo: 35, hi: 95 },
  { one: 'keyring', many: 'keyrings', lo: 150, hi: 395 },
  { one: 'notebook', many: 'notebooks', lo: 120, hi: 350 },
  { one: 'bottle of juice', many: 'bottles of juice', lo: 85, hi: 245 },
  { one: 'sandwich', many: 'sandwiches', lo: 250, hi: 495 },
  { one: 'cap', many: 'caps', lo: 450, hi: 899 },
] as const

const moneyDecimals4: Generator = {
  skill: 'm4.money-decimals',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const name = pickName(rng)
    const price = (it: (typeof SHOP_USD)[number]) => rng.int(it.lo / 5, it.hi / 5) * 5

    const convert = (): GeneratedItem => {
      const c0 = rng.int(105, 995)
      const c = c0 % 100 === 0 ? c0 + 5 : c0
      if (rng.chance(0.5)) {
        return {
          type: 'numeric',
          prompt: `100 cents make $1. How many cents is ${usd(c)}?`,
          answer: c,
          unit: 'cents',
          hints: ['The digits after the point are cents.', `${usd(c)} is ${plural(Math.floor(c / 100), 'dollar', 'dollars')} and ${c % 100} cents.`, `${plural(Math.floor(c / 100), 'dollar is', 'dollars is')} ${Math.floor(c / 100) * 100} cents.`],
          explanation: `${plural(Math.floor(c / 100), 'dollar', 'dollars')} = ${Math.floor(c / 100) * 100} cents. ${Math.floor(c / 100) * 100} + ${c % 100} = ${c} cents.`,
        }
      }
      return {
        type: 'numeric',
        prompt: `100 cents make $1. Write ${c} cents in dollars.`,
        answer: asDollars(c),
        allowDecimal: true,
        hints: ['Every 100 cents is one dollar.', `How many hundreds are in ${c}? The rest are cents.`, 'Write the dollars, then a point, then the cents with two digits.'],
        explanation: `${c} cents = ${plural(Math.floor(c / 100), 'dollar', 'dollars')} and ${c % 100} cents, which is ${usd(c)}.`,
      }
    }

    const addTwo = (): GeneratedItem => {
      const [a, b] = rng.sample(SHOP_USD, 2) as [(typeof SHOP_USD)[number], (typeof SHOP_USD)[number]]
      const pa = price(a)
      const pb = price(b)
      return {
        type: 'numeric',
        figure: { kind: 'table', caption: 'Shop prices', head: ['Item', 'Price'], rows: [[cap(a.one), usd(pa)], [cap(b.one), usd(pb)]], alt: `Shop prices: ${a.one} ${usd(pa)}, ${b.one} ${usd(pb)}.` },
        prompt: `${name} is on a school trip abroad. ${name} buys ${art(a.one)} for ${usd(pa)} and ${art(b.one)} for ${usd(pb)}. How much is that altogether, in dollars?`,
        answer: asDollars(pa + pb),
        allowDecimal: true,
        hints: ['Add the dollars and the cents separately, or change both to cents.', `${usd(pa)} is ${pa} cents and ${usd(pb)} is ${pb} cents.`, `${pa} + ${pb}: add the hundreds first.`],
        explanation: `${pa} + ${pb} = ${pa + pb} cents, which is ${usd(pa + pb)}.`,
        solution: [
          { say: 'Change both prices to cents.', show: `${usd(pa)} = ${pa} cents, ${usd(pb)} = ${pb} cents` },
          { say: 'Add the cents.', show: `${pa} + ${pb} = ${pa + pb}` },
          { say: 'Change back to dollars.', show: `${pa + pb} cents = ${usd(pa + pb)}` },
        ],
        tags: WORD,
      }
    }

    const change = (): GeneratedItem => {
      const it = rng.pick(SHOP_USD)
      const p = price(it)
      const paid = [500, 1000, 2000].find((v) => v >= p + 50)!
      const ans = paid - p
      const prompt = `${name} buys ${art(it.one)} for ${usd(p)} and pays with ${usd(paid).replace('.00', '')}. How much change does ${name} get?`
      const hints = ['Change is what you get back.', `Count up from ${usd(p)} to the next whole dollar, then to ${usd(paid).replace('.00', '')}.`, `From ${usd(p)} to ${usd(Math.ceil(p / 100) * 100)} is ${Math.ceil(p / 100) * 100 - p} cents.`]
      const explanation = `${usd(paid)} - ${usd(p)} = ${usd(ans)}.`
      if (rng.chance(0.5)) return { type: 'numeric', prompt, answer: asDollars(ans), allowDecimal: true, hints, explanation, tags: WORD }
      return {
        type: 'mcq',
        prompt,
        ...mcqFrom(rng, usd(ans), [
          { value: usd(ans + 100), why: `${usd(p)} + ${usd(ans + 100)} is more than ${usd(paid)}.` },
          { value: usd(Math.abs(ans - 10)), why: 'Check the cents: count up to the next whole dollar first.' },
          { value: usd(p), why: 'This is the price, not the change.' },
          { value: usd(ans + 10), why: 'Check the cents: count up to the next whole dollar first.' },
        ]),
        hints,
        explanation,
        tags: WORD,
      }
    }

    const multi = (): GeneratedItem => {
      const it = rng.pick(SHOP_USD.filter((x) => x.hi < 400))
      const n = rng.int(2, 4)
      const p = price(it)
      const total = n * p
      const paid = [500, 1000, 2000].find((v) => v >= total + 50)!
      return {
        type: 'numeric',
        figure: { kind: 'table', caption: 'Shop prices', head: ['Item', 'Price'], rows: [[cap(it.one), usd(p)]], alt: `Shop prices: ${it.one} ${usd(p)} each.` },
        prompt: `${name} buys ${n} ${it.many} at ${usd(p)} each and pays with ${usd(paid).replace('.00', '')}. How much change does ${name} get?`,
        answer: asDollars(paid - total),
        allowDecimal: true,
        hints: ['Find the total cost first.', `Multiply ${p} cents by ${n}, then take the total away from ${fmt(paid)} cents.`, `${n} × ${p} = ${fmt(total)} cents.`],
        explanation: `${n} × ${usd(p)} = ${usd(total)}. ${usd(paid)} - ${usd(total)} = ${usd(paid - total)}.`,
        tags: WORD,
      }
    }

    const howMany = (): GeneratedItem => {
      const p = rng.int(9, 49) * 5
      const budget = rng.pick([500, 1000])
      const n = Math.floor(budget / p)
      return {
        type: 'numeric',
        prompt: `Stickers cost ${usd(p)} each. How many stickers can ${name} buy with ${usd(budget).replace('.00', '')}?`,
        answer: n,
        hints: ['Change the money to cents.', `How many lots of ${p} cents fit into ${fmt(budget)} cents?`, `Count on in steps of ${usd(p)}: ${usd(p)}, ${usd(2 * p)}, ${usd(3 * p)}, and so on.`],
        explanation: `${n} × ${usd(p)} = ${usd(n * p)}, which fits. ${n + 1} stickers would cost ${usd((n + 1) * p)}, which is too much.`,
        tags: WORD,
      }
    }

    if (level === 1) return convert()
    if (level === 2) return addTwo()
    if (level === 3) return change()
    if (level === 4) return multi()
    return howMany()
  },
}

// ---------------------------------------------------------------------------
// Gt: jam 24 dan jadwal
// ---------------------------------------------------------------------------

const hh = (h: number, m: number): string => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

/** Variasi jawaban teks untuk waktu 24 jam. */
function answers24(h: number, m: number): string[] {
  const mm = String(m).padStart(2, '0')
  const H = String(h).padStart(2, '0')
  const out = new Set([`${H}:${mm}`, `${H}.${mm}`, `${H}${mm}`, `${h}:${mm}`, `${h}.${mm}`])
  return [...out]
}

const ampm = (h: number, m: number): string => `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'a.m.' : 'p.m.'}`

const time24: Generator = {
  skill: 'm4.time-24-hour',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const to24 = (): GeneratedItem => {
      const pm = rng.chance(0.65)
      const h = pm ? rng.int(13, 23) : rng.int(1, 11)
      const m = rng.int(0, 11) * 5
      return {
        type: 'text',
        prompt: `Write ${ampm(h, m)} in 24-hour time.`,
        blanks: [{ answers: answers24(h, m) }],
        hints: ['24-hour times always use four digits.', pm ? 'For p.m. times, add 12 to the hour.' : 'For a.m. times, keep the hour and put a 0 in front if it has one digit.', pm ? `${h - 12} + 12 = ${h}.` : `The hour is ${h}.`],
        explanation: `${ampm(h, m)} is ${hh(h, m)} in 24-hour time.`,
      }
    }

    const to12 = (): GeneratedItem => {
      const h = rng.int(13, 23)
      const m = rng.int(0, 11) * 5
      return {
        type: 'mcq',
        prompt: `What is ${hh(h, m)} in 12-hour time?`,
        figure: { kind: 'clock', h, m, digital: true, alt: `A digital clock showing ${hh(h, m)}.` },
        ...textChoice(rng, ampm(h, m), [
          { value: `${h - 12}:${String(m).padStart(2, '0')} a.m.`, why: `${hh(h, m)} is after midday, so it is p.m.` },
          { value: `${h - 10}:${String(m).padStart(2, '0')} p.m.`, why: 'Take away 12 from the hour, not 10.' },
          { value: `${h}:${String(m).padStart(2, '0')} p.m.`, why: '12-hour times only go up to 12. Take away 12 from the hour.' },
        ]),
        hints: ['Hours after 12 are in the afternoon or evening.', 'Take away 12 from the hour and add p.m.', `${h} - 12 = ${h - 12}.`],
        explanation: `${h} - 12 = ${h - 12}, so ${hh(h, m)} is ${ampm(h, m)}`,
      }
    }

    const fromClock = (): GeneratedItem => {
      const pm = rng.chance(0.6)
      const h12 = rng.int(1, 11)
      const m = rng.int(0, 11) * 5
      const h = pm ? h12 + 12 : h12
      const when = pm ? rng.pick(['in the afternoon', 'in the evening']) : 'in the morning'
      const fixedWhen = pm && h >= 18 ? 'in the evening' : pm ? 'in the afternoon' : when
      return {
        type: 'text',
        prompt: `The clock shows a time ${fixedWhen}. Write it in 24-hour time.`,
        figure: { kind: 'clock', h: h12, m, alt: `A clock showing ${timeWordsLocal(h12, m)}.` },
        blanks: [{ answers: answers24(h, m) }],
        hints: ['First read the clock: the long hand shows the minutes.', pm ? 'After midday, add 12 to the hour.' : 'Before midday, the hour stays the same.', `The clock shows ${timeWordsLocal(h12, m)}.`],
        explanation: `The clock shows ${timeWordsLocal(h12, m)} ${fixedWhen}, which is ${hh(h, m)}.`,
      }
    }

    const duration = (): GeneratedItem => {
      const h1 = rng.int(8, 16)
      const m1 = rng.int(1, 11) * 5
      // selalu melewati jam bulat berikutnya, dan tidak berakhir tepat di jam bulat
      const len = 60 - m1 + rng.int(1, 11) * 5 + (rng.chance(0.5) ? 60 : 0)
      const end = h1 * 60 + m1 + len
      const h2 = Math.floor(end / 60)
      const m2 = end % 60
      const what = rng.pick(['A train leaves at', 'A bus leaves at', 'A plane takes off at'])
      const arr = what.startsWith('A plane') ? 'lands' : 'arrives'
      return {
        type: 'numeric',
        prompt: `${what} ${hh(h1, m1)} and ${arr} at ${hh(h2, m2)}. How many minutes does the trip take?`,
        answer: len,
        unit: 'minutes',
        hints: ['Count on from the start time to the next o\'clock.', `${hh(h1, m1)} to ${hh(h1 + 1, 0)} is ${60 - m1} minutes.`, `Then count on from ${hh(h1 + 1, 0)} to ${hh(h2, m2)}.`],
        explanation: `${60 - m1} minutes to ${hh(h1 + 1, 0)}, then ${end - (h1 + 1) * 60} more minutes. ${60 - m1} + ${end - (h1 + 1) * 60} = ${len} minutes.`,
        tags: WORD,
      }
    }

    const midnight = (): GeneratedItem => {
      const h1 = rng.int(21, 23)
      const m1 = rng.int(1, 11) * 5
      const lenH = rng.int(1, 2)
      const lenM = rng.int(1, 11) * 5
      const end = (h1 * 60 + m1 + lenH * 60 + lenM) % (24 * 60)
      const h2 = Math.floor(end / 60)
      const m2 = end % 60
      if (h1 * 60 + m1 + lenH * 60 + lenM < 24 * 60) return duration()
      return {
        type: 'text',
        prompt: `A film starts at ${hh(h1, m1)}. It lasts ${lenH} ${lenH === 1 ? 'hour' : 'hours'} and ${lenM} minutes. What time does it end, in 24-hour time?`,
        blanks: [{ answers: answers24(h2, m2) }],
        hints: ['Add the hours first, then the minutes.', 'After 23:59 the clock starts again from midnight.',`${hh(h1, m1)} + ${lenH} ${lenH === 1 ? 'hour' : 'hours'} = ${hh((h1 + lenH) % 24, m1)}.`],
        explanation: `${hh(h1, m1)} + ${lenH} ${lenH === 1 ? 'hour' : 'hours'} = ${hh((h1 + lenH) % 24, m1)}. Then ${lenM} more minutes gives ${hh(h2, m2)}.`,
        tags: WORD,
      }
    }

    if (level === 1) return to24()
    if (level === 2) return to12()
    if (level === 3) return fromClock()
    if (level === 4) return duration()
    return midnight()
  },
}

function timeWordsLocal(h: number, m: number): string {
  const hr = ((h + 11) % 12) + 1
  const next = (hr % 12) + 1
  if (m === 0) return `${hr} o'clock`
  if (m === 15) return `quarter past ${hr}`
  if (m === 30) return `half past ${hr}`
  if (m === 45) return `quarter to ${next}`
  if (m < 30) return `${m} minutes past ${hr}`
  return `${60 - m} minutes to ${next}`
}

const STOPS = ['Malang', 'Lawang', 'Pandaan', 'Surabaya'] as const

function busTimetable(rng: Rng) {
  const legs = [rng.int(4, 6) * 5, rng.int(5, 7) * 5, rng.int(8, 12) * 5]
  const starts = [rng.int(6 * 12, 7 * 12) * 5, 0, 0]
  starts[1] = starts[0]! + rng.int(16, 24) * 5
  starts[2] = starts[1]! + rng.int(16, 24) * 5
  const buses = ['Bus A', 'Bus B', 'Bus C']
  const slow = rng.int(0, 2)
  const fast = (slow + 1 + rng.int(0, 1)) % 3
  const times = buses.map((_, b) => {
    const t = [starts[b]!]
    for (let i = 0; i < 3; i++) {
      const extra = b === slow ? 10 : b === fast ? -5 : 0
      t.push(t[i]! + legs[i]! + (i === 2 ? extra : 0))
    }
    return t
  })
  const fmtT = (mins: number) => hh(Math.floor(mins / 60), mins % 60)
  const figure: Fig = {
    kind: 'table',
    caption: 'Bus timetable',
    head: ['Stop', ...buses],
    rows: STOPS.map((st, i) => [st, ...buses.map((_, b) => fmtT(times[b]![i]!))]),
    alt: `Bus timetable. ${buses.map((bn, b) => `${bn}: ${STOPS.map((st, i) => `${st} ${fmtT(times[b]![i]!)}`).join(', ')}`).join('. ')}.`,
  }
  return { buses, times, figure, fmtT }
}

const timetables4: Generator = {
  skill: 'm4.timetables',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const name = pickName(rng)

    const read = (): GeneratedItem => {
      const { buses, times, figure, fmtT } = busTimetable(rng)
      const b = rng.int(0, 2)
      const st = rng.int(0, 2)
      const ans = fmtT(times[b]![st]!)
      const wrong = [
        ...buses.filter((_, k) => k !== b).map((_, k) => ({ value: fmtT(times[k >= b ? k + 1 : k]![st]!), why: `That is when ${buses[k >= b ? k + 1 : k]} leaves ${STOPS[st]}.` })),
        { value: fmtT(times[b]![st + 1]!), why: `That is when ${buses[b]} reaches ${STOPS[st + 1]}.` },
      ]
      return {
        type: 'mcq',
        prompt: `Look at the timetable. When does ${buses[b]} leave ${STOPS[st]}?`,
        figure,
        ...textChoice(rng, ans, wrong),
        hints: [`Find the row for ${STOPS[st]}.`, `Find the column for ${buses[b]}.`, 'The time is where the row and the column meet.'],
        explanation: `In the ${STOPS[st]} row and the ${buses[b]} column, the time is ${ans}.`,
      }
    }

    const units = (): GeneratedItem => {
      if (rng.chance(0.5)) {
        const f = rng.pick([
          { q: (n: number) => `How many seconds are in ${n} minutes?`, per: 60 },
          { q: (n: number) => `How many minutes are in ${n} hours?`, per: 60 },
          { q: (n: number) => `How many hours are in ${n} days?`, per: 24 },
          { q: (n: number) => `How many days are in ${n} weeks?`, per: 7 },
        ])
        const n = rng.int(3, 8)
        return {
          type: 'numeric',
          prompt: f.q(n),
          answer: n * f.per,
          hints: [`1 of the bigger unit is ${f.per} of the smaller unit.`, `Multiply ${n} by ${f.per}.`, `2 make ${2 * f.per}. Keep adding ${f.per}.`],
          explanation: `${n} × ${f.per} = ${n * f.per}.`,
        }
      }
      const total = rng.int(65, 290)
      const mm = total % 60 === 0 ? total + 15 : total
      return {
        type: 'text',
        prompt: `${mm} minutes = ___ hours ___ minutes`,
        blanks: [{ answers: [String(Math.floor(mm / 60))] }, { answers: [String(mm % 60)] }],
        hints: ['60 minutes make 1 hour.', `How many 60s fit into ${mm}?`, 'The minutes left over go in the second gap.'],
        explanation: `${Math.floor(mm / 60)} × 60 = ${Math.floor(mm / 60) * 60}, and ${mm} - ${Math.floor(mm / 60) * 60} = ${mm % 60}. So ${mm} minutes = ${Math.floor(mm / 60)} hours ${mm % 60} minutes.`,
      }
    }

    const tripTime = (): GeneratedItem => {
      const { buses, times, figure, fmtT } = busTimetable(rng)
      const b = rng.int(0, 2)
      const [s1, s2] = rng.sample([0, 1, 2, 3], 2).sort((x, y) => x - y) as [number, number]
      const len = times[b]![s2]! - times[b]![s1]!
      return {
        type: 'numeric',
        prompt: `How many minutes does ${buses[b]} take to go from ${STOPS[s1]} to ${STOPS[s2]}?`,
        figure,
        answer: len,
        unit: 'minutes',
        hints: [`Find when ${buses[b]} leaves ${STOPS[s1]} and when it reaches ${STOPS[s2]}.`, 'Count on from the first time to the second time.', `${buses[b]} leaves ${STOPS[s1]} at ${fmtT(times[b]![s1]!)}.`],
        explanation: `${fmtT(times[b]![s1]!)} to ${fmtT(times[b]![s2]!)} is ${len} minutes.`,
      }
    }

    const nextBus = (): GeneratedItem => {
      const { buses, times, figure, fmtT } = busTimetable(rng)
      const st = rng.int(0, 2)
      const target = rng.int(0, 2)
      const prev = target === 0 ? times[0]![st]! - rng.int(2, 8) * 5 : times[target - 1]![st]! + 5
      const arrive = rng.int(prev, times[target]![st]! - 5)
      const wait = times[target]![st]! - arrive
      if (rng.chance(0.5)) {
        return {
          type: 'mcq',
          prompt: `${name} gets to ${STOPS[st]} at ${fmtT(arrive)}. Which is the next bus ${name} can catch?`,
          figure,
          ...textChoice(rng, buses[target]!, [...buses.filter((x) => x !== buses[target]).map((x) => ({ value: x, why: `${x} leaves ${STOPS[st]} at ${fmtT(times[buses.indexOf(x)]![st]!)}. ${times[buses.indexOf(x)]![st]! < arrive ? `That is before ${fmtT(arrive)}.` : `${buses[target]} leaves sooner.`}` })), { value: 'None of the buses', why: `${buses[target]} leaves after ${fmtT(arrive)}, so ${name} can catch it.` }]),
          hints: [`Find the ${STOPS[st]} row.`, `Look for the first time after ${fmtT(arrive)}.`, `Read the ${STOPS[st]} times from left to right.`],
          explanation: `${buses[target]} leaves ${STOPS[st]} at ${fmtT(times[target]![st]!)}, the first bus after ${fmtT(arrive)}.`,
          tags: WORD,
        }
      }
      return {
        type: 'numeric',
        prompt: `${name} gets to ${STOPS[st]} at ${fmtT(arrive)} and catches the next bus. How many minutes does ${name} wait?`,
        figure,
        answer: wait,
        unit: 'minutes',
        hints: [`Find the first bus that leaves ${STOPS[st]} after ${fmtT(arrive)}.`, 'Count on from the arrival time to the departure time.', `Look along the ${STOPS[st]} row.`],
        explanation: `The next bus is ${buses[target]} at ${fmtT(times[target]![st]!)}. ${fmtT(arrive)} to ${fmtT(times[target]![st]!)} is ${wait} minutes.`,
        tags: WORD,
      }
    }

    const plan = (): GeneratedItem => {
      const { buses, times, figure, fmtT } = busTimetable(rng)
      const durs = times.map((t) => t[3]! - t[0]!)
      if (rng.chance(0.5) && new Set(durs).size === 3) {
        const ans = buses[durs.indexOf(Math.min(...durs))]!
        const ex = buses.findIndex((x) => x !== ans)
        return {
          type: 'mcq',
          prompt: 'Which bus takes the shortest time from Malang to Surabaya?',
          figure,
          ...textChoice(rng, ans, [...buses.filter((x) => x !== ans).map((x) => ({ value: x, why: `${x} takes ${durs[buses.indexOf(x)]} minutes. ${ans} takes ${Math.min(...durs)} minutes.` })), { value: 'They all take the same time', why: `The trips take ${listAnd(durs.map((d) => `${d} minutes`))}.` }]),
          hints: ['Work out the trip time for each bus.', 'Count on from the Malang time to the Surabaya time.', `${buses[ex]} leaves Malang at ${fmtT(times[ex]![0]!)} and reaches Surabaya at ${fmtT(times[ex]![3]!)}.`],
          explanation: `The trips take ${buses.map((x, k) => `${x} ${durs[k]} minutes`).join(', ')}. ${ans} is the fastest.`,
          tags: WORD,
        }
      }
      const b = rng.int(0, 2)
      const deadline = times[b]![3]! + rng.int(1, 4) * 5
      const ok = buses.filter((_, k) => times[k]![3]! <= deadline)
      const ans = ok[ok.length - 1]!
      return {
        type: 'mcq',
        prompt: `${name} must be in Surabaya by ${fmtT(deadline)}. Which is the latest bus from Malang that ${name} can take?`,
        figure,
        ...textChoice(rng, ans, [...buses.filter((x) => x !== ans).map((x) => ({ value: x, why: times[buses.indexOf(x)]![3]! > deadline ? `${x} reaches Surabaya at ${fmtT(times[buses.indexOf(x)]![3]!)}, which is too late.` : `${x} works, but ${ans} leaves later and still arrives in time.` })), { value: 'None of the buses', why: `${ans} reaches Surabaya at ${fmtT(times[buses.indexOf(ans)]![3]!)}, which is in time.` }]),
        hints: ['Look at the Surabaya row.', `Which buses arrive at ${fmtT(deadline)} or earlier?`, 'Of those buses, pick the one that leaves Malang last.'],
        explanation: `${ans} reaches Surabaya at ${fmtT(times[buses.indexOf(ans)]![3]!)}, which is in time.${buses.indexOf(ans) < 2 ? ` ${listAnd(buses.slice(buses.indexOf(ans) + 1))} ${buses.indexOf(ans) === 1 ? 'arrives' : 'arrive'} after ${fmtT(deadline)}.` : ' It is the last bus of the day.'}`,
        tags: WORD,
      }
    }

    const MONTHS4 = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const DAYS4 = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    const calendar = (): GeneratedItem => {
      const mo = rng.pick([0, 2, 3, 4, 5, 6, 7, 8, 9, 10])
      const d1 = rng.int(DAYS4[mo]! - 8, DAYS4[mo]! - 1)
      const d2 = rng.int(2, 9)
      const gap = DAYS4[mo]! - d1 + d2
      return {
        type: 'numeric',
        prompt: `How many days after ${d1} ${MONTHS4[mo]} is ${d2} ${MONTHS4[mo + 1]}?`,
        answer: gap,
        unit: 'days',
        hints: [`How many days does ${MONTHS4[mo]} have?`, `Count to the end of ${MONTHS4[mo]}, then on into ${MONTHS4[mo + 1]}.`, `${MONTHS4[mo]} has ${DAYS4[mo]} days.`],
        explanation: `${DAYS4[mo]! - d1} days to the end of ${MONTHS4[mo]} and ${d2} more days. ${DAYS4[mo]! - d1} + ${d2} = ${gap}.`,
      }
    }

    if (level === 1) return oneOf(rng, [read, units])
    if (level === 2) return tripTime()
    if (level === 3) return oneOf(rng, [nextBus, calendar])
    if (level === 4) return plan()
    return oneOf(rng, [plan, nextBus])
  },
}

// ---------------------------------------------------------------------------
// Gg: konversi satuan, keliling dan luas
// ---------------------------------------------------------------------------

const UNITS4 = [
  { big: 'm', small: 'cm', k: 100, bigW: 'metres', smallW: 'centimetres' },
  { big: 'cm', small: 'mm', k: 10, bigW: 'centimetres', smallW: 'millimetres' },
  { big: 'km', small: 'm', k: 1000, bigW: 'kilometres', smallW: 'metres' },
  { big: 'kg', small: 'g', k: 1000, bigW: 'kilograms', smallW: 'grams' },
  { big: 'l', small: 'ml', k: 1000, bigW: 'litres', smallW: 'millilitres' },
] as const

const convertUnits4: Generator = {
  skill: 'm4.convert-units',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const simple = (): GeneratedItem => {
      const u = rng.pick(UNITS4)
      const n = rng.int(2, 9)
      const down = rng.chance(0.65)
      if (down) {
        return {
          type: 'numeric',
          prompt: `${n} ${u.big} = ___ ${u.small}`,
          answer: n * u.k,
          unit: u.small,
          hints: [`How many ${u.smallW} are in 1 ${u.big}?`, `1 ${u.big} = ${fmt(u.k)} ${u.small}.`, `Multiply ${n} by ${fmt(u.k)}.`],
          explanation: `1 ${u.big} = ${fmt(u.k)} ${u.small}, so ${n} ${u.big} = ${fmt(n * u.k)} ${u.small}.`,
        }
      }
      return {
        type: 'numeric',
        prompt: `${fmt(n * u.k)} ${u.small} = ___ ${u.big}`,
        answer: n,
        unit: u.big,
        hints: [`How many ${u.smallW} are in 1 ${u.big}?`, `1 ${u.big} = ${fmt(u.k)} ${u.small}.`, `Divide ${fmt(n * u.k)} by ${fmt(u.k)}.`],
        explanation: `${fmt(n * u.k)} ÷ ${fmt(u.k)} = ${n}, so ${fmt(n * u.k)} ${u.small} = ${n} ${u.big}.`,
      }
    }

    const mixed = (): GeneratedItem => {
      const u = rng.pick(UNITS4.filter((x) => x.k >= 100))
      const n = rng.int(1, 6)
      const r = u.k === 100 ? rng.int(5, 95) : rng.int(1, 19) * 50
      const total = n * u.k + r
      if (rng.chance(0.5)) {
        return {
          type: 'numeric',
          prompt: `${n} ${u.big} ${r} ${u.small} = ___ ${u.small}`,
          answer: total,
          unit: u.small,
          hints: [`Change the ${u.bigW} to ${u.smallW} first.`, `${n} ${u.big} = ${fmt(n * u.k)} ${u.small}.`, `Then add the ${r} ${u.small}.`],
          explanation: `${fmt(n * u.k)} + ${r} = ${fmt(total)} ${u.small}.`,
        }
      }
      return {
        type: 'text',
        prompt: `${fmt(total)} ${u.small} = ___ ${u.big} ___ ${u.small}`,
        blanks: [{ answers: [String(n)] }, { answers: [String(r)] }],
        hints: [`1 ${u.big} = ${fmt(u.k)} ${u.small}.`, `How many whole ${u.bigW} are in ${fmt(total)} ${u.small}?`, 'What is left over goes in the second gap.'],
        explanation: `${fmt(n * u.k)} ${u.small} = ${n} ${u.big}, and ${r} ${u.small} are left over. So ${fmt(total)} ${u.small} = ${n} ${u.big} ${r} ${u.small}.`,
      }
    }

    const decimals = (): GeneratedItem => {
      const u = rng.pick(UNITS4.filter((x) => x.k >= 100))
      const whole = rng.int(0, 4)
      const tenths = rng.int(whole === 0 ? 2 : 1, 9)
      const x = whole + tenths / 10
      if (rng.chance(0.6)) {
        return {
          type: 'numeric',
          prompt: `${fmt(x)} ${u.big} = ___ ${u.small}`,
          answer: Math.round(x * u.k),
          unit: u.small,
          hints: [`1 ${u.big} = ${fmt(u.k)} ${u.small}.`, `Multiply ${fmt(x)} by ${fmt(u.k)}.`, `0.1 ${u.big} = ${fmt(u.k / 10)} ${u.small}.`],
          explanation: `${fmt(x)} × ${fmt(u.k)} = ${fmt(Math.round(x * u.k))}, so ${fmt(x)} ${u.big} = ${fmt(Math.round(x * u.k))} ${u.small}.`,
        }
      }
      const other = Math.round(x * u.k) + rng.pick([-1, 1]) * rng.int(1, 3) * (u.k / 20)
      const a = `${fmt(x)} ${u.big}`
      const b = `${fmt(other)} ${u.small}`
      const correct = x * u.k > other ? `${a} is more than ${b}` : `${b} is more than ${a}`
      return {
        type: 'mcq',
        prompt: 'Which is true?',
        ...textChoice(rng, correct, [
          { value: x * u.k > other ? `${b} is more than ${a}` : `${a} is more than ${b}`, why: `${a} = ${fmt(Math.round(x * u.k))} ${u.small}. Compare that with ${b}.` },
          { value: `${a} is the same as ${b}`, why: `${a} = ${fmt(Math.round(x * u.k))} ${u.small}, which is not ${b}.` },
          { value: `${a} is the same as ${fmt(x)} ${u.small}`, why: `1 ${u.big} is ${fmt(u.k)} ${u.small}, so the numbers change when you change the unit.` },
        ]),
        hints: ['Change both amounts to the same unit.', `1 ${u.big} = ${fmt(u.k)} ${u.small}.`, `${a} = ${fmt(x)} × ${fmt(u.k)} ${u.small}.`],
        explanation: `${a} = ${fmt(Math.round(x * u.k))} ${u.small}. So ${correct}.`,
      }
    }

    const story = (): GeneratedItem => {
      const kind = rng.int(0, 2)
      const name = pickName(rng)
      if (kind === 0) {
        const bottle = rng.pick([250, 500, 750])
        const n = rng.int(2, 8)
        const total = bottle * n
        if (total % 1000 !== 0 && total % 500 !== 0) return story()
        return {
          type: 'numeric',
          prompt: `A bottle holds ${bottle} ml. How many bottles of water fill a ${fmt(total / 1000)} litre jug?`,
          answer: n,
          hints: ['Use the same unit for both amounts.', `${fmt(total / 1000)} l = ${fmt(total)} ml.`, `How many lots of ${bottle} make ${fmt(total)}?`],
          explanation: `${fmt(total / 1000)} l = ${fmt(total)} ml, and ${fmt(total)} ÷ ${bottle} = ${n} bottles.`,
          tags: WORD,
        }
      }
      if (kind === 1) {
        const m = rng.int(2, 6)
        const k = rng.pick([2, 4, 5])
        return {
          type: 'numeric',
          prompt: `${name} has a rope ${m} m long and cuts it into ${k} equal pieces. How long is each piece, in centimetres?`,
          answer: (m * 100) / k,
          unit: 'cm',
          hints: ['Change the metres to centimetres first.', `${m} m = ${m * 100} cm.`, `Divide ${m * 100} by ${k}.`],
          explanation: `${m} m = ${m * 100} cm. ${m * 100} ÷ ${k} = ${(m * 100) / k} cm.`,
          tags: WORD,
        }
      }
      const max = rng.pick([2000, 4000])
      const step = max === 2000 ? 250 : 500
      const v = rng.int(2, max / step - 1) * step
      return {
        type: 'numeric',
        prompt: `What is the mass of the bag of flour on the scales, in grams?`,
        figure: { kind: 'scale', max: max / 1000, value: v / 1000, step: step / 1000, unit: 'kg', alt: `Scales from 0 to ${max / 1000} kg, marked every ${fmt(step)} g. The pointer is at ${fmt(v)} g.` },
        answer: v,
        unit: 'g',
        hints: ['Work out what each small mark is worth.', `The scale goes from 0 to ${max / 1000} kg, which is ${fmt(max)} g.`, `Each mark is ${fmt(step)} g.`],
        explanation: `The marks go up in ${fmt(step)} g. The pointer is at ${fmt(v)} g.`,
      }
    }

    const order = (): GeneratedItem => {
      const pool = [980, 1050, 1200, 1300, 1450, 900, 1150, 1500]
      const vals = rng.sample(pool, 4)
      const show = (g: number) => {
        const r = rng.int(0, 2)
        if (r === 0 || g % 1000 === 0) return `${fmt(g)} g`
        if (r === 1 && g >= 1000) return `${Math.floor(g / 1000)} kg ${g % 1000} g`
        return `${fmt(g / 1000)} kg`
      }
      const texts = vals.map((g) => ({ g, t: show(g) }))
      const sorted = [...texts].sort((a, b) => b.g - a.g)
      const kgItem = texts.find((x) => x.t.includes('kg'))
      return {
        type: 'order',
        prompt: 'Order the masses from heaviest to lightest.',
        items: sorted.map((x) => x.t),
        hints: ['Change every mass into grams first.', '1 kg = 1,000 g, and 0.1 kg = 100 g.', kgItem ? `${kgItem.t} is ${fmt(kgItem.g)} g.` : 'Then compare the numbers of grams.'],
        explanation: `In grams: ${sorted.map((x) => fmt(x.g)).join(', ')}. So the order is ${sorted.map((x) => x.t).join(', ')}.`,
      }
    }

    if (level === 1) return simple()
    if (level === 2) return mixed()
    if (level === 3) return decimals()
    if (level === 4) return story()
    return order()
  },
}

const perimeterArea4: Generator = {
  skill: 'm4.perimeter-area',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const rectGrid = (): GeneratedItem => {
      const w = rng.int(3, 9)
      const h = rng.int(2, 6)
      const cells: [number, number][] = []
      for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) cells.push([r + 1, c + 1])
      const area = rng.chance(0.5)
      const figure: Fig = { kind: 'grid', rows: h + 2, cols: w + 2, shaded: cells, showUnits: true, alt: `A rectangle ${w} squares long and ${h} squares wide on a grid of 1 cm squares.` }
      return {
        type: 'numeric',
        prompt: area ? 'Each square is 1 cm². What is the area of the rectangle?' : 'Each square has sides of 1 cm. What is the perimeter of the rectangle?',
        figure,
        answer: area ? w * h : 2 * (w + h),
        unit: area ? 'cm²' : 'cm',
        hints: area
          ? ['Area is the number of squares inside.', 'Count the squares in one row, then multiply by the number of rows.', `One row has ${w} squares.`]
          : ['Perimeter is the distance all the way around.', 'Add the lengths of all four sides.', `The long sides are ${w} cm each.`],
        explanation: area ? `${h} rows of ${w} squares: ${h} × ${w} = ${w * h} cm².` : `${w} + ${h} + ${w} + ${h} = ${2 * (w + h)} cm.`,
      }
    }

    const labelled = (): GeneratedItem => {
      const l = rng.int(5, 15)
      const w = rng.int(2, Math.max(2, Math.floor(l * 0.65)))
      const area = rng.chance(0.5)
      const figure: Fig = { kind: 'shape', shape: 'rectangle', sideLabels: [`${l} cm`, `${w} cm`], alt: `A rectangle ${l} cm long and ${w} cm wide.` }
      return {
        type: 'numeric',
        prompt: `What is the ${area ? 'area' : 'perimeter'} of this rectangle?`,
        figure,
        answer: area ? l * w : 2 * (l + w),
        unit: area ? 'cm²' : 'cm',
        hints: area
          ? ['Area of a rectangle = length × width.', `Multiply ${l} by ${w}.`, l > 10 ? `${l} × ${w}: split ${l} into 10 and ${l - 10} if it helps.` : `Count on in steps of ${l}, ${w} times.`]
          : ['Perimeter is the total of all four sides.', `Add ${l} + ${w}, then double it.`, `${l} + ${w} = ${l + w}.`],
        explanation: area ? `${l} × ${w} = ${l * w} cm².` : `(${l} + ${w}) × 2 = ${2 * (l + w)} cm.`,
      }
    }

    const missingSide = (): GeneratedItem => {
      const kind = rng.int(0, 2)
      if (kind === 0) {
        const l = rng.int(6, 14)
        const w = rng.int(2, l - 1)
        const p = 2 * (l + w)
        return {
          type: 'numeric',
          prompt: `A rectangle has a perimeter of ${p} cm. Its length is ${l} cm. What is its width?`,
          answer: w,
          unit: 'cm',
          hints: ['The perimeter is two lengths and two widths.', `Take away the two lengths from ${p} cm.`, `${l} + ${l} = ${2 * l}.`],
          explanation: `${p} - ${2 * l} = ${2 * w}, which is two widths. ${2 * w} ÷ 2 = ${w} cm.`,
        }
      }
      if (kind === 1) {
        const l = rng.int(4, 12)
        const w = rng.int(2, 9)
        return {
          type: 'numeric',
          prompt: `A rectangle has an area of ${l * w} cm². Its length is ${l} cm. What is its width?`,
          answer: w,
          unit: 'cm',
          hints: ['Area = length × width.', `What number times ${l} makes ${l * w}?`, `Divide ${l * w} by ${l}.`],
          explanation: `${l} × ${w} = ${l * w}, so the width is ${w} cm.`,
        }
      }
      const sd = rng.int(5, 15)
      return {
        type: 'numeric',
        prompt: `A square has a perimeter of ${4 * sd} cm. How long is each side?`,
        answer: sd,
        unit: 'cm',
        hints: ['A square has 4 equal sides.', `Share ${4 * sd} cm equally between the 4 sides.`, `Divide ${4 * sd} by 4.`],
        explanation: `${4 * sd} ÷ 4 = ${sd} cm.`,
      }
    }

    const compound = (): GeneratedItem => {
      const W = rng.int(5, 9)
      const Hh = rng.int(4, 7)
      const a = rng.int(2, W - 2)
      const b = rng.int(2, Hh - 2)
      const cells: [number, number][] = []
      for (let r = 0; r < Hh; r++) for (let c = 0; c < W; c++) if (!(r < b && c >= W - a)) cells.push([r + 1, c + 1])
      const area = W * Hh - a * b
      const per = 2 * (W + Hh)
      const askArea = rng.chance(0.5)
      return {
        type: 'numeric',
        prompt: askArea ? 'Each square is 1 cm². What is the area of this L-shape?' : 'Each square has sides of 1 cm. What is the perimeter of this L-shape?',
        figure: { kind: 'grid', rows: Hh + 2, cols: W + 2, shaded: cells, showUnits: true, alt: `An L-shape on a grid of 1 cm squares. It is ${W} squares wide and ${Hh} squares tall, with a ${a} by ${b} corner cut away.` },
        answer: askArea ? area : per,
        unit: askArea ? 'cm²' : 'cm',
        hints: askArea
          ? ['Split the L-shape into two rectangles.', 'Find the area of each rectangle, then add.', `The bottom rectangle is ${W} by ${Hh - b}.`]
          : ['Go all the way around the edge.', 'Count the length of each straight edge, then add them.', `The bottom edge is ${W} cm.`],
        explanation: askArea
          ? `${W} × ${Hh - b} = ${W * (Hh - b)} and ${W - a} × ${b} = ${(W - a) * b}. ${W * (Hh - b)} + ${(W - a) * b} = ${area} cm².`
          : `The edges are ${W}, ${Hh - b}, ${a}, ${b}, ${W - a} and ${Hh} cm. They add up to ${per} cm.`,
      }
    }

    const story = (): GeneratedItem => {
      const name = pickName(rng)
      if (rng.chance(0.5)) {
        const l = rng.int(4, 9)
        const w = rng.int(3, l)
        return {
          type: 'numeric',
          prompt: `A floor is ${l} m long and ${w} m wide. It is covered with square tiles that are 1 m long. How many tiles are needed?`,
          answer: l * w,
          hints: ['Each tile covers 1 square metre.', 'Find the area of the floor.', `${w} rows of ${l} tiles.`],
          explanation: `${l} × ${w} = ${l * w} tiles.`,
          tags: WORD,
        }
      }
      const items = rng.sample([
        { text: 'a fence around a field', group: 0 },
        { text: 'a frame around a picture', group: 0 },
        { text: 'lights around a window', group: 0 },
        { text: 'a path around a pool', group: 0 },
        { text: 'tiles for a bathroom floor', group: 1 },
        { text: 'paint for a wall', group: 1 },
        { text: 'grass seed for a lawn', group: 1 },
        { text: 'a rug to cover a floor', group: 1 },
      ], 6)
      if (!items.some((x) => x.group === 0)) items[0] = { text: 'a fence around a field', group: 0 }
      if (!items.some((x) => x.group === 1)) items[1] = { text: 'paint for a wall', group: 1 }
      void name
      return {
        type: 'sort',
        prompt: 'Sort the jobs. Do you need to find the perimeter or the area?',
        groups: ['Perimeter', 'Area'],
        items,
        hints: ['Perimeter is the edge. Area is the surface inside.', 'Ask: does it go around the outside, or cover the whole surface?', `${cap(items[0]!.text)}: around or cover?`],
        explanation: `Perimeter: ${listAnd(items.filter((x) => x.group === 0).map((x) => x.text))}. Area: ${listAnd(items.filter((x) => x.group === 1).map((x) => x.text))}.`,
      }
    }

    const smallest = (): GeneratedItem => {
      const area = rng.pick([12, 16, 18, 20, 24, 30, 36])
      const pairs = range(1, area).filter((x) => area % x === 0 && x <= area / x).map((x) => [x, area / x] as [number, number])
      const best = pairs[pairs.length - 1]!
      const p = 2 * (best[0] + best[1])
      const largest = rng.chance(0.3)
      const pick = largest ? pairs[0]! : best
      return {
        type: 'numeric',
        prompt: `Rectangles have an area of ${area} cm² and sides that are whole centimetres. What is the ${largest ? 'largest' : 'smallest'} perimeter one can have?`,
        answer: largest ? 2 * (pick[0] + pick[1]) : p,
        unit: 'cm',
        hints: [`List the pairs of numbers that multiply to make ${area}.`, 'Work out the perimeter for each pair.', `${pairs[0]![0]} × ${pairs[0]![1]} = ${area}.`],
        explanation: `The rectangles are ${pairs.map(([a, b]) => `${a} by ${b} (perimeter ${2 * (a + b)} cm)`).join(', ')}. The ${largest ? 'largest' : 'smallest'} perimeter is ${2 * (pick[0] + pick[1])} cm.`,
      }
    }

    const fixedPerimeter = (): GeneratedItem => {
      const p = rng.int(6, 15) * 2
      const half = p / 2
      const pairs = range(1, Math.floor(half / 2)).map((x) => [x, half - x] as [number, number])
      const best = pairs[pairs.length - 1]!
      return {
        type: 'numeric',
        prompt: `A rectangle has a perimeter of ${p} cm. Its sides are whole centimetres. What is the largest area it can have?`,
        answer: best[0] * best[1],
        unit: 'cm²',
        hints: [`The length and the width add up to half of ${p}.`, `List the pairs of whole numbers that add up to ${half}.`, `${pairs[0]![0]} cm by ${pairs[0]![1]} cm has an area of ${pairs[0]![0] * pairs[0]![1]} cm².`],
        explanation: `The length and the width add up to ${half}. The areas are ${pairs.map(([a, b]) => `${a} × ${b} = ${a * b}`).join(', ')}. The largest area is ${best[0] * best[1]} cm².`,
      }
    }

    const compare = (): GeneratedItem => {
      const sameArea = rng.chance(0.5)
      let pairs: [number, number][]
      if (sameArea) {
        const area = rng.pick([12, 16, 18, 20, 24, 30, 36])
        pairs = range(2, area).filter((x) => area % x === 0 && x <= area / x).map((x) => [area / x, x] as [number, number])
      } else {
        const half = rng.int(7, 12)
        pairs = range(2, Math.floor(half / 2)).map((x) => [half - x, x] as [number, number])
      }
      const [A, B] = rng.sample(pairs, 2) as [[number, number], [number, number]]
      const aA = A[0] * A[1]
      const aB = B[0] * B[1]
      const pA = 2 * (A[0] + A[1])
      const pB = 2 * (B[0] + B[1])
      const S1 = 'Same area, different perimeters'
      const S2 = 'Same perimeter, different areas'
      const S3 = 'Same area and same perimeter'
      const S4 = 'Different areas and different perimeters'
      const wrong = sameArea
        ? [
            { value: S2, why: `The perimeters are ${pA} cm and ${pB} cm, so they are different.` },
            { value: S3, why: `The areas match, but the perimeters are ${pA} cm and ${pB} cm.` },
            { value: S4, why: `Both areas are ${aA} cm².` },
          ]
        : [
            { value: S1, why: `The areas are ${aA} cm² and ${aB} cm², so they are different.` },
            { value: S3, why: `The perimeters match, but the areas are ${aA} cm² and ${aB} cm².` },
            { value: S4, why: `Both perimeters are ${pA} cm.` },
          ]
      return {
        type: 'mcq',
        prompt: 'Look at rectangles A and B. Which is true?',
        figure: {
          kind: 'table',
          head: ['Rectangle', 'Length', 'Width'],
          rows: [['A', `${A[0]} cm`, `${A[1]} cm`], ['B', `${B[0]} cm`, `${B[1]} cm`]],
          alt: `Rectangle A is ${A[0]} cm by ${A[1]} cm. Rectangle B is ${B[0]} cm by ${B[1]} cm.`,
        },
        ...textChoice(rng, sameArea ? S1 : S2, wrong),
        hints: ['Work out the area and the perimeter of each rectangle.', 'Area = length × width. Perimeter = the total of all four sides.', `Rectangle A: ${A[0]} × ${A[1]} = ${aA} cm².`],
        explanation: `Rectangle A has an area of ${aA} cm² and a perimeter of ${pA} cm. Rectangle B has an area of ${aB} cm² and a perimeter of ${pB} cm. ${sameArea ? 'So they have the same area, but different perimeters.' : 'So they have the same perimeter, but different areas.'}`,
      }
    }

    if (level === 1) return rectGrid()
    if (level === 2) return labelled()
    if (level === 3) return missingSide()
    if (level === 4) return oneOf(rng, [compound, story])
    return oneOf(rng, [smallest, fixedPerimeter, compare])
  },
}

// ---------------------------------------------------------------------------
// Gg: sudut
// ---------------------------------------------------------------------------

type Shape2D = Extract<Fig, { kind: 'shape' }>['shape']
type Solid = Extract<Fig, { kind: 'solid' }>['solid']

type AngleKind = 'acute' | 'right' | 'obtuse' | 'straight'
const ANGLE_KINDS: readonly AngleKind[] = ['acute', 'right', 'obtuse', 'straight']
const ANGLE_LABEL: Record<AngleKind, string> = { acute: 'Acute', right: 'Right angle', obtuse: 'Obtuse', straight: 'Straight angle' }
const ANGLE_WHY: Record<AngleKind, string> = {
  acute: 'An acute angle is smaller than a right angle.',
  right: 'A right angle is a square corner.',
  obtuse: 'An obtuse angle is bigger than a right angle and smaller than a straight line.',
  straight: 'A straight angle makes a straight line.',
}
const ANGLE_IS: Record<AngleKind, string> = {
  acute: 'This angle is smaller than a right angle.',
  right: 'This angle is exactly a square corner.',
  obtuse: 'This angle is bigger than a right angle.',
  straight: 'This angle makes a straight line.',
}
const angleKind = (d: number): AngleKind => (d < 90 ? 'acute' : d === 90 ? 'right' : d < 180 ? 'obtuse' : 'straight')
const angleFig = (d: number): Fig => ({ kind: 'angle', degrees: d, alt: `An angle of ${d} degrees.` })
const degreesFor = (rng: Rng, k: AngleKind): number => (k === 'acute' ? rng.int(3, 15) * 5 : k === 'right' ? 90 : k === 'obtuse' ? rng.int(21, 33) * 5 : 180)
const angleWords = (k: AngleKind): string => (k === 'right' ? 'a right angle' : k === 'straight' ? 'a straight angle' : `an ${k} angle`)
/** Sudut kecil antara jarum jam pada jam bulat h. */
const handAngle = (h: number): number => Math.min(h, 12 - h) * 30

/** Jumlah sudut per jenis untuk bentuk yang digambar renderer (lihat packages/figures). */
const SHAPE_ANGLES: readonly { shape: Shape2D; name: string; acute: number; right: number; obtuse: number }[] = [
  { shape: 'triangle', name: 'triangle with 3 equal sides', acute: 3, right: 0, obtuse: 0 },
  { shape: 'right-triangle', name: 'right-angled triangle', acute: 2, right: 1, obtuse: 0 },
  { shape: 'square', name: 'square', acute: 0, right: 4, obtuse: 0 },
  { shape: 'rectangle', name: 'rectangle', acute: 0, right: 4, obtuse: 0 },
  { shape: 'rhombus', name: 'rhombus', acute: 2, right: 0, obtuse: 2 },
  { shape: 'trapezium', name: 'trapezium', acute: 2, right: 0, obtuse: 2 },
  { shape: 'parallelogram', name: 'parallelogram', acute: 2, right: 0, obtuse: 2 },
  { shape: 'kite', name: 'kite', acute: 1, right: 0, obtuse: 3 },
  { shape: 'pentagon', name: 'regular pentagon', acute: 0, right: 0, obtuse: 5 },
  { shape: 'hexagon', name: 'regular hexagon', acute: 0, right: 0, obtuse: 6 },
  { shape: 'octagon', name: 'regular octagon', acute: 0, right: 0, obtuse: 8 },
]

const DIR4 = ['north', 'east', 'south', 'west'] as const

const angles4: Generator = {
  skill: 'm4.angles',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const name = pickName(rng)
    const kindChoice = (k: AngleKind) =>
      textChoice(rng, ANGLE_LABEL[k], ANGLE_KINDS.filter((x) => x !== k).map((x) => ({ value: ANGLE_LABEL[x], why: `${ANGLE_WHY[x]} ${ANGLE_IS[k]}` })))

    const classify = (): GeneratedItem => {
      const k = rng.pick(['acute', 'acute', 'right', 'obtuse', 'obtuse', 'straight'] as const)
      const d = degreesFor(rng, k)
      return {
        type: 'mcq',
        prompt: 'What kind of angle is this?',
        figure: angleFig(d),
        ...kindChoice(k),
        hints: ['Compare the angle with a square corner, such as the corner of a book.', 'Is it smaller than a square corner, the same, or bigger?', k === 'straight' ? 'Check whether the two arms make one straight line.' : 'Look at how wide the two arms open.'],
        explanation: `This angle is ${d}°. ${ANGLE_WHY[k]}`,
      }
    }

    const extreme = (): GeneratedItem => {
      const ds = rng.sample([25, 40, 55, 70, 90, 110, 125, 140, 160], 4)
      const big = rng.chance(0.5)
      const target = big ? Math.max(...ds) : Math.min(...ds)
      const word = big ? 'largest' : 'smallest'
      return {
        type: 'mcq',
        prompt: `Which angle is the ${word}?`,
        ...figChoice(rng, angleFig(target), ds.filter((d) => d !== target).map((d) => ({ figure: angleFig(d), why: `This angle is ${d}°. The ${word} angle is ${target}°.` }))),
        hints: ['The size of an angle is how far its arms open.', 'Sort the angles: smaller than a square corner, a square corner, or bigger.', big ? 'Look for the angle whose arms open the widest.' : 'Look for the angle whose arms are closest together.'],
        explanation: `The angles are ${listAnd([...ds].sort((a, b) => a - b).map((d) => `${d}°`))}. The ${word} is ${target}°.`,
      }
    }

    const findKind = (): GeneratedItem => {
      const k = rng.pick(['acute', 'right', 'obtuse'] as const)
      const d = degreesFor(rng, k)
      return {
        type: 'mcq',
        prompt: k === 'right' ? 'Which of these is a right angle?' : `Which of these angles is ${k}?`,
        ...figChoice(rng, angleFig(d), ANGLE_KINDS.filter((x) => x !== k).map((o) => {
          const od = degreesFor(rng, o)
          return { figure: angleFig(od), why: `This angle is ${od}°, so it is ${angleWords(o)}.` }
        })),
        hints: ['Compare each angle with a square corner.', k === 'acute' ? 'An acute angle is smaller than a square corner.' : k === 'obtuse' ? 'An obtuse angle is wider than a square corner, but it is not a straight line.' : 'A right angle fits a square corner exactly.', 'Rule out the angles that do not match, one at a time.'],
        explanation: `The angle of ${d}° is ${angleWords(k)}. ${ANGLE_WHY[k]}`,
      }
    }

    const sortDeg = (): GeneratedItem => {
      const acute = rng.sample([10, 25, 35, 45, 60, 75, 85], 2)
      const obtuse = rng.sample([95, 100, 120, 135, 150, 170], 2)
      const extra = rng.chance(0.5) ? rng.pick([15, 50, 65, 80].filter((x) => !acute.includes(x))) : rng.pick([105, 115, 140, 160].filter((x) => !obtuse.includes(x)))
      const all = rng.shuffle([...acute, ...obtuse, 90, extra])
      const group = (d: number) => (d < 90 ? 0 : d === 90 ? 1 : 2)
      return {
        type: 'sort',
        prompt: 'Sort the angles by their size.',
        groups: ['Acute', 'Right angle', 'Obtuse'],
        items: all.map((d) => ({ text: `${d}°`, group: group(d) })),
        hints: ['A right angle is exactly 90°.', 'Acute angles are less than 90°. Obtuse angles are between 90° and 180°.', `Start with ${all[0]}°. Is it less than 90° or more?`],
        explanation: `Acute: ${all.filter((d) => d < 90).map((d) => `${d}°`).join(', ')}. Right angle: 90°. Obtuse: ${all.filter((d) => d > 90).map((d) => `${d}°`).join(', ')}.`,
      }
    }

    const countIn = (): GeneratedItem => {
      const s = rng.pick(SHAPE_ANGLES)
      const ask = rng.pick(['acute', 'right', 'obtuse'] as const)
      const n = s[ask]
      const parts = [
        s.acute ? plural(s.acute, 'acute angle', 'acute angles') : '',
        s.right ? plural(s.right, 'right angle', 'right angles') : '',
        s.obtuse ? plural(s.obtuse, 'obtuse angle', 'obtuse angles') : '',
      ].filter(Boolean)
      return {
        type: 'numeric',
        prompt: `How many ${ask} angles does this shape have?`,
        figure: { kind: 'shape', shape: s.shape, alt: `A picture of a ${s.name}.` },
        answer: n,
        hints: ['Look at each corner of the shape in turn.', ask === 'acute' ? 'An acute angle is smaller than a square corner.' : ask === 'obtuse' ? 'An obtuse angle is wider than a square corner.' : 'A right angle fits a square corner exactly.', 'Mark each corner as you check it, so you count each one once.'],
        explanation: `The ${s.name} has ${listAnd(parts)}.${n === 0 ? ` So it has no ${ask} angles.` : ''}`,
      }
    }

    const clockKind = (): GeneratedItem => {
      const h = rng.int(1, 11)
      const sp = Math.min(h, 12 - h)
      const d = handAngle(h)
      const k = angleKind(d)
      return {
        type: 'mcq',
        prompt: `What kind of angle do the hands of a clock make at ${h} o'clock?`,
        figure: { kind: 'clock', h, m: 0, alt: `A clock showing ${h} o'clock.` },
        ...kindChoice(k),
        hints: ['Look at the smaller gap between the two hands.', 'Compare the gap with a square corner.', `Each space between two numbers is 30°. The hands are ${plural(sp, 'space', 'spaces')} apart.`],
        explanation: `The hands are ${plural(sp, 'space', 'spaces')} apart. ${sp} × 30° = ${d}°, so the angle is ${k === 'right' ? 'a right angle' : k === 'straight' ? 'a straight angle' : k}.`,
      }
    }

    const TURN4 = [
      { name: 'quarter turn', d: 90 },
      { name: 'half turn', d: 180 },
      { name: 'three-quarter turn', d: 270 },
      { name: 'whole turn', d: 360 },
    ] as const

    const turnDeg = (): GeneratedItem => {
      const t = rng.pick(TURN4)
      const hints =
        t.d === 360
          ? ['A quarter turn is a right angle.', 'A right angle is 90°.', 'A whole turn is 4 quarter turns.']
          : t.d === 270
            ? ['A whole turn is 360°.', 'A three-quarter turn is 3 quarter turns.', 'Find a quarter of 360°, then multiply by 3.']
            : ['A whole turn is 360°.', `How many ${t.name}s make a whole turn?`, `Divide 360 by ${360 / t.d}.`]
      return {
        type: 'numeric',
        prompt: `How many degrees are in a ${t.name}?`,
        answer: t.d,
        unit: '°',
        hints,
        explanation: t.d === 360 ? '4 × 90° = 360°.' : t.d === 270 ? '360 ÷ 4 = 90 and 3 × 90 = 270. So a three-quarter turn is 270°.' : `360 ÷ ${360 / t.d} = ${t.d}. So a ${t.name} is ${t.d}°.`,
      }
    }

    const orderAngles = (): GeneratedItem => {
      const words = rng.sample([
        { t: 'half a right angle', d: 45 },
        { t: 'a right angle', d: 90 },
        { t: 'a straight angle', d: 180 },
        { t: 'a three-quarter turn', d: 270 },
        { t: 'a whole turn', d: 360 },
      ], 2)
      const nums = rng.sample([30, 60, 75, 100, 120, 150, 200, 240, 300].filter((d) => !words.some((w) => Math.abs(w.d - d) < 15)), 2).map((d) => ({ t: `${d}°`, d }))
      const all = [...words, ...nums]
      const sorted = [...all].sort((a, b) => a.d - b.d)
      const ex = words.find((w) => w.d !== 90 && w.d !== 180) ?? words[0]!
      return {
        type: 'order',
        prompt: 'Order the angles from smallest to largest.',
        items: sorted.map((x) => x.t),
        hints: ['Change each angle into degrees first.', 'A right angle is 90°. A straight angle is 2 right angles.', `${cap(ex.t)} is ${ex.d}°.`],
        explanation: `In degrees: ${sorted.map((x) => (x.t.endsWith('°') ? x.t : `${x.d}° (${x.t})`)).join(', ')}.`,
      }
    }

    const minuteTurn = (): GeneratedItem => {
      const k = rng.pick([2, 3, 4, 6, 8, 9, 10])
      return {
        type: 'numeric',
        prompt: `The minute hand of a clock moves from 12 to ${k}. How many degrees does it turn?`,
        figure: { kind: 'clock', h: 12, m: k * 5, alt: `A clock with the minute hand pointing at ${k}.` },
        answer: k * 30,
        unit: '°',
        hints: ['A whole turn of the minute hand is 360°.', 'There are 12 equal spaces around the clock.', '360 ÷ 12 = 30, so each space is 30°.'],
        explanation: `From 12 to ${k} is ${k} spaces. ${k} × 30 = ${k * 30}, so the hand turns ${k * 30}°.`,
      }
    }

    const clockAngle = (): GeneratedItem => {
      const h = rng.int(2, 10)
      const sp = Math.min(h, 12 - h)
      return {
        type: 'numeric',
        prompt: h === 6 ? "What is the angle between the hands of a clock at 6 o'clock?" : `What is the smaller angle between the hands of a clock at ${h} o'clock?`,
        figure: { kind: 'clock', h, m: 0, alt: `A clock showing ${h} o'clock.` },
        answer: sp * 30,
        unit: '°',
        hints: ['There are 12 equal spaces around a clock face.', '360 ÷ 12 = 30, so each space is 30°.', `Count the spaces between the hands at ${h} o'clock.`],
        explanation: `The hands are ${plural(sp, 'space', 'spaces')} apart. ${sp} × 30 = ${sp * 30}, so the angle is ${sp * 30}°.`,
      }
    }

    const compass = (): GeneratedItem => {
      const start = rng.int(0, 3)
      const cw = rng.chance(0.6)
      const turns = [rng.pick([90, 180, 270]), ...(rng.chance(0.5) ? [rng.pick([90, 180])] : [])]
      const quarter = (deg: number) => (cw ? deg / 90 : -deg / 90)
      const total = turns.reduce((a, b) => a + b, 0)
      const at = (q: number) => DIR4[(((start + q) % 4) + 4) % 4]!
      const end = at(quarter(total))
      const way = cw ? 'clockwise' : 'anticlockwise'
      const wrong = [
        { value: cap(at(-quarter(total))), why: `That is where ${name} would face after turning ${cw ? 'anticlockwise' : 'clockwise'}.` },
        ...(turns.length > 1 ? [{ value: cap(at(quarter(turns[0]!))), why: `That is where ${name} faces after the first turn only.` }] : []),
        { value: cap(DIR4[start]!), why: `${name} faces ${DIR4[start]} again only after a whole turn of 360°.` },
        ...DIR4.map((d) => ({ value: cap(d), why: `Count each 90° as a quarter turn ${way}, starting from ${DIR4[start]}.` })),
      ]
      return {
        type: 'mcq',
        prompt: `${name} faces ${DIR4[start]}. ${name} turns ${turns[0]}° ${way}${turns.length > 1 ? `, then ${turns[1]}° more` : ''}. Which way does ${name} face now?`,
        ...textChoice(rng, cap(end), wrong),
        hints: ['A turn of 90° is a quarter turn.', turns.length > 1 ? `Add the turns: ${turns[0]}° + ${turns[1]}°.` : `How many quarter turns is ${turns[0]}°?`, cw ? 'Clockwise turns go the same way as the hands of a clock.' : 'Anticlockwise turns go the opposite way to the hands of a clock.'],
        explanation: `${turns.length > 1 ? `${turns[0]}° + ${turns[1]}° = ${total}°. ` : ''}${total}° is ${plural(total / 90, 'quarter turn', 'quarter turns')}. ${plural(total / 90, 'quarter turn', 'quarter turns')} ${way} from ${DIR4[start]} ${total / 90 === 1 ? 'faces' : 'face'} ${end}.`,
        tags: WORD,
      }
    }

    if (level === 1) return classify()
    if (level === 2) return oneOf(rng, [extreme, findKind, sortDeg])
    if (level === 3) return oneOf(rng, [countIn, clockKind])
    if (level === 4) return oneOf(rng, [turnDeg, orderAngles])
    return oneOf(rng, [minuteTurn, clockAngle, compass])
  },
}

// ---------------------------------------------------------------------------
// Gg: bangun datar
// ---------------------------------------------------------------------------

/** Fakta bentuk sesuai gambar renderer: trapesium sama kaki, layang-layang 1 sumbu, segi banyak beraturan. */
const SHAPE_FACTS: readonly { shape: Shape2D; name: string; parallel: number; lines: number; regular: boolean; whyPar: string; whySym: string }[] = [
  { shape: 'triangle', name: 'triangle with 3 equal sides', parallel: 0, lines: 3, regular: true, whyPar: 'No two sides of a triangle are parallel.', whySym: 'Fold from each corner to the middle of the opposite side.' },
  { shape: 'right-triangle', name: 'right-angled triangle', parallel: 0, lines: 0, regular: false, whyPar: 'No two sides of a triangle are parallel.', whySym: 'Its three sides are all different lengths, so no fold makes the halves match.' },
  { shape: 'square', name: 'square', parallel: 2, lines: 4, regular: true, whyPar: 'Both pairs of opposite sides are parallel.', whySym: 'Fold it up and down, across, and along both diagonals.' },
  { shape: 'rectangle', name: 'rectangle', parallel: 2, lines: 2, regular: false, whyPar: 'Both pairs of opposite sides are parallel.', whySym: 'Fold it up and down, or across. A diagonal fold does not match.' },
  { shape: 'rhombus', name: 'rhombus', parallel: 2, lines: 2, regular: false, whyPar: 'Both pairs of opposite sides are parallel.', whySym: 'Fold it along each diagonal, from corner to corner.' },
  { shape: 'parallelogram', name: 'parallelogram', parallel: 2, lines: 0, regular: false, whyPar: 'Both pairs of opposite sides are parallel.', whySym: 'It leans to one side, so no fold makes the halves match exactly.' },
  { shape: 'trapezium', name: 'trapezium', parallel: 1, lines: 1, regular: false, whyPar: 'Only the top side and the bottom side are parallel.', whySym: 'Only the fold down the middle, from top to bottom, matches.' },
  { shape: 'kite', name: 'kite', parallel: 0, lines: 1, regular: false, whyPar: 'No two sides of this kite go in the same direction.', whySym: 'Only the fold from the top corner to the bottom corner matches.' },
  { shape: 'pentagon', name: 'regular pentagon', parallel: 0, lines: 5, regular: true, whyPar: 'Each side of a regular pentagon faces a corner, so no sides are parallel.', whySym: 'Fold from each corner to the middle of the opposite side.' },
  { shape: 'hexagon', name: 'regular hexagon', parallel: 3, lines: 6, regular: true, whyPar: 'Each side is parallel to the side opposite it, which makes 3 pairs.', whySym: '3 folds go corner to corner, and 3 go through the middles of opposite sides.' },
  { shape: 'octagon', name: 'regular octagon', parallel: 4, lines: 8, regular: true, whyPar: 'Each side is parallel to the side opposite it, which makes 4 pairs.', whySym: '4 folds go corner to corner, and 4 go through the middles of opposite sides.' },
]

const NAME_QUAD: readonly { shape: Shape2D; name: string; alt: string; because: string; wrong: readonly { value: string; why: string }[] }[] = [
  {
    shape: 'rectangle', name: 'Rectangle', alt: 'A four-sided shape with two long sides, two short sides and four square corners.',
    because: 'It has 4 right angles, and its opposite sides are equal. Not all 4 sides are equal, so it is a rectangle.',
    wrong: [
      { value: 'Square', why: 'A square has 4 equal sides. This shape has two long sides and two short sides.' },
      { value: 'Rhombus', why: 'A rhombus has 4 equal sides. This shape has two long sides and two short sides.' },
      { value: 'Kite', why: 'A kite has two pairs of equal sides next to each other. Here the equal sides are opposite.' },
      { value: 'Trapezium', why: 'A trapezium has only one pair of parallel sides. This shape has two pairs.' },
    ],
  },
  {
    shape: 'rhombus', name: 'Rhombus', alt: 'A four-sided shape with 4 equal sides and no square corners, standing on one corner.',
    because: 'It has 4 equal sides and no right angles, so it is a rhombus.',
    wrong: [
      { value: 'Square', why: 'A square has 4 right angles. This shape has none.' },
      { value: 'Rectangle', why: 'A rectangle has 4 right angles. This shape has none.' },
      { value: 'Trapezium', why: 'A trapezium has only one pair of parallel sides. This shape has two pairs.' },
    ],
  },
  {
    shape: 'parallelogram', name: 'Parallelogram', alt: 'A four-sided shape that leans to one side. Its opposite sides are parallel and equal.',
    because: 'It has two pairs of parallel sides and no right angles. Its sides are not all equal, so it is a parallelogram.',
    wrong: [
      { value: 'Rhombus', why: 'A rhombus has 4 equal sides. This shape has two long sides and two short sides.' },
      { value: 'Rectangle', why: 'A rectangle has 4 right angles. This shape has none.' },
      { value: 'Kite', why: 'A kite has two pairs of equal sides next to each other. Here the equal sides are opposite.' },
      { value: 'Trapezium', why: 'A trapezium has only one pair of parallel sides. This shape has two pairs.' },
    ],
  },
  {
    shape: 'trapezium', name: 'Trapezium', alt: 'A four-sided shape with a long bottom side and a shorter top side parallel to it.',
    because: 'It has exactly one pair of parallel sides, so it is a trapezium.',
    wrong: [
      { value: 'Parallelogram', why: 'A parallelogram has two pairs of parallel sides. This shape has only one pair.' },
      { value: 'Rhombus', why: 'A rhombus has 4 equal sides. The top and bottom of this shape are different lengths.' },
      { value: 'Kite', why: 'A kite has no parallel sides. The top and bottom of this shape are parallel.' },
      { value: 'Rectangle', why: 'A rectangle has 4 right angles. This shape has none.' },
    ],
  },
  {
    shape: 'kite', name: 'Kite', alt: 'A four-sided shape with two short equal sides at the top and two long equal sides at the bottom.',
    because: 'It has two pairs of equal sides next to each other and no parallel sides, so it is a kite.',
    wrong: [
      { value: 'Rhombus', why: 'A rhombus has 4 equal sides. This shape has two short sides and two long sides.' },
      { value: 'Parallelogram', why: 'A parallelogram has two pairs of parallel sides. This shape has none.' },
      { value: 'Trapezium', why: 'A trapezium has one pair of parallel sides. This shape has none.' },
      { value: 'Square', why: 'A square has 4 equal sides and 4 right angles. This shape has neither.' },
    ],
  },
]

const RIDDLES: readonly { clue: string; answer: string; wrong: readonly { value: string; why: string }[] }[] = [
  {
    clue: 'I have 4 right angles. My sides are not all equal.', answer: 'Rectangle',
    wrong: [
      { value: 'Square', why: 'A square has 4 equal sides.' },
      { value: 'Rhombus', why: 'A rhombus has 4 equal sides and no right angles.' },
      { value: 'Kite', why: 'A kite with 4 right angles would be a square, with all sides equal.' },
    ],
  },
  {
    clue: 'I have 4 equal sides but no right angles.', answer: 'Rhombus',
    wrong: [
      { value: 'Square', why: 'A square has 4 right angles.' },
      { value: 'Rectangle', why: 'A rectangle has 4 right angles.' },
      { value: 'Trapezium', why: 'A trapezium has only one pair of parallel sides, so its sides cannot all be equal.' },
    ],
  },
  {
    clue: 'I have 4 sides and exactly one pair of parallel sides.', answer: 'Trapezium',
    wrong: [
      { value: 'Parallelogram', why: 'A parallelogram has two pairs of parallel sides.' },
      { value: 'Kite', why: 'A kite has no parallel sides.' },
      { value: 'Rectangle', why: 'A rectangle has two pairs of parallel sides.' },
    ],
  },
  {
    clue: 'I have two pairs of equal sides next to each other. I have exactly one line of symmetry.', answer: 'Kite',
    wrong: [
      { value: 'Rhombus', why: 'A rhombus has 2 lines of symmetry.' },
      { value: 'Parallelogram', why: 'In a parallelogram the equal sides are opposite each other.' },
      { value: 'Rectangle', why: 'A rectangle has 2 lines of symmetry, and its equal sides are opposite.' },
    ],
  },
  {
    clue: 'I have two pairs of parallel sides and no right angles. My sides are not all equal.', answer: 'Parallelogram',
    wrong: [
      { value: 'Rhombus', why: 'A rhombus has 4 equal sides.' },
      { value: 'Rectangle', why: 'A rectangle has 4 right angles.' },
      { value: 'Trapezium', why: 'A trapezium has only one pair of parallel sides.' },
    ],
  },
  {
    clue: 'I have 6 equal sides and 6 equal angles.', answer: 'Regular hexagon',
    wrong: [
      { value: 'Regular pentagon', why: 'A pentagon has 5 sides.' },
      { value: 'Regular octagon', why: 'An octagon has 8 sides.' },
      { value: 'Rhombus', why: 'A rhombus has 4 sides.' },
    ],
  },
  {
    clue: 'I have 3 equal sides and 3 lines of symmetry.', answer: 'Equilateral triangle',
    wrong: [
      { value: 'Right-angled triangle', why: 'A right-angled triangle has one right angle, so its angles are not all equal.' },
      { value: 'Isosceles triangle', why: 'An isosceles triangle has exactly 2 equal sides.' },
      { value: 'Square', why: 'A square has 4 sides.' },
    ],
  },
]

const STATEMENTS: readonly { text: string; ok: boolean; why?: string }[] = [
  { text: 'Every square is a rectangle.', ok: true },
  { text: 'Every square is a rhombus.', ok: true },
  { text: 'A parallelogram has 2 pairs of parallel sides.', ok: true },
  { text: 'A regular hexagon has 6 lines of symmetry.', ok: true },
  { text: 'An equilateral triangle has 3 equal angles.', ok: true },
  { text: 'A rhombus has 4 equal sides.', ok: true },
  { text: 'A regular octagon has 8 equal sides.', ok: true },
  { text: 'Every rectangle is a square.', ok: false, why: 'A rectangle can have two long sides and two short sides.' },
  { text: 'Every rhombus is a square.', ok: false, why: 'A rhombus does not need right angles.' },
  { text: 'A kite always has 2 pairs of parallel sides.', ok: false, why: 'Most kites have no parallel sides at all.' },
  { text: 'A parallelogram always has 4 right angles.', ok: false, why: 'Most parallelograms lean, so their angles are not right angles.' },
  { text: 'A regular pentagon has 6 sides.', ok: false, why: 'A pentagon has 5 sides.' },
  { text: 'An equilateral triangle has 1 line of symmetry.', ok: false, why: 'It has 3 lines of symmetry, one from each corner.' },
  { text: 'A scalene triangle has 2 equal sides.', ok: false, why: 'A scalene triangle has no equal sides.' },
  { text: 'A square has 2 lines of symmetry.', ok: false, why: 'A square has 4 lines of symmetry.' },
]

const LETTERS6 = ['A', 'B', 'C', 'D', 'E', 'F'] as const

const shapes2d4: Generator = {
  skill: 'm4.shapes-2d',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const nameQuad = (): GeneratedItem => {
      const q = rng.pick(NAME_QUAD)
      return {
        type: 'mcq',
        prompt: 'What is the name of this quadrilateral?',
        figure: { kind: 'shape', shape: q.shape, alt: q.alt },
        ...textChoice(rng, q.name, rng.shuffle(q.wrong)),
        hints: ['Count the sides and look at the corners.', 'Check which sides are equal and which sides are parallel.', 'Are any of the corners right angles?'],
        explanation: q.because,
      }
    }

    const facts = (): GeneratedItem => {
      const s = rng.pick(SHAPE_FACTS)
      if (rng.chance(0.5)) {
        return {
          type: 'numeric',
          prompt: 'How many pairs of parallel sides does this shape have?',
          figure: { kind: 'shape', shape: s.shape, alt: `A picture of a ${s.name}.` },
          answer: s.parallel,
          hints: ['Parallel sides go in the same direction and never meet.', 'Look at each pair of opposite sides.', 'Imagine making the sides longer. Would they ever cross?'],
          explanation: `${s.whyPar} The ${s.name} has ${s.parallel === 0 ? 'no pairs' : plural(s.parallel, 'pair', 'pairs')} of parallel sides.`,
        }
      }
      return {
        type: 'numeric',
        prompt: 'How many lines of symmetry does this shape have?',
        figure: { kind: 'shape', shape: s.shape, alt: `A picture of a ${s.name}.` },
        answer: s.lines,
        hints: ['A line of symmetry splits a shape into two matching halves.', 'Imagine folding the shape so the two halves fit exactly.', 'Try lines up and down, across, and on a slant.'],
        explanation: `${s.whySym} The ${s.name} has ${s.lines === 0 ? 'no lines' : plural(s.lines, 'line', 'lines')} of symmetry.`,
      }
    }

    const pickShape = (): GeneratedItem => {
      const byLines = rng.chance(0.5)
      const val = (x: (typeof SHAPE_FACTS)[number]) => (byLines ? x.lines : x.parallel)
      const target = rng.pick(SHAPE_FACTS)
      const v = val(target)
      const picks = rng.shuffle(SHAPE_FACTS.filter((x) => val(x) !== v)).slice(0, 3)
      const fig = (x: (typeof SHAPE_FACTS)[number]): Fig => ({ kind: 'shape', shape: x.shape, alt: `A picture of a ${x.name}.` })
      const desc = (x: (typeof SHAPE_FACTS)[number]) =>
        byLines
          ? x.lines === 0 ? 'no lines of symmetry' : `${plural(x.lines, 'line', 'lines')} of symmetry`
          : x.parallel === 0 ? 'no parallel sides' : `${plural(x.parallel, 'pair', 'pairs')} of parallel sides`
      return {
        type: 'mcq',
        prompt: byLines
          ? v === 0 ? 'Which shape has no lines of symmetry?' : `Which shape has exactly ${plural(v, 'line', 'lines')} of symmetry?`
          : v === 0 ? 'Which shape has no parallel sides?' : `Which shape has exactly ${plural(v, 'pair', 'pairs')} of parallel sides?`,
        ...figChoice(rng, fig(target), picks.map((x) => ({ figure: fig(x), why: `This is a ${x.name}. It has ${desc(x)}.` }))),
        hints: byLines
          ? ['A line of symmetry splits a shape into two matching halves.', 'Imagine folding each shape so the halves fit exactly.', 'Count the folds that work for each shape.']
          : ['Parallel sides go in the same direction and never meet.', 'Check the opposite sides of each shape.', 'Count the pairs of parallel sides in each shape.'],
        explanation: `The ${target.name} has ${desc(target)}. ${byLines ? target.whySym : target.whyPar}`,
      }
    }

    const shapesFig = (list: readonly (typeof SHAPE_FACTS)[number][]): Fig => ({
      kind: 'shapes',
      items: list.map((s, i) => ({ shape: s.shape, label: LETTERS6[i]! })),
      alt: `Shapes: ${list.map((s, i) => `${LETTERS6[i]} is a ${s.name}`).join(', ')}.`,
    })

    const regularSort = (): GeneratedItem => {
      const reg = rng.sample(SHAPE_FACTS.filter((s) => s.regular), rng.int(2, 3))
      const irr = rng.sample(SHAPE_FACTS.filter((s) => !s.regular), 6 - reg.length)
      const list = rng.shuffle([...reg, ...irr])
      return {
        type: 'sort',
        prompt: 'Sort the shapes. Is each one a regular polygon?',
        figure: shapesFig(list),
        groups: ['Regular', 'Not regular'],
        items: list.map((s, i) => ({ text: `Shape ${LETTERS6[i]}`, group: s.regular ? 0 : 1 })),
        hints: ['A regular polygon has all sides equal and all angles equal.', 'Check the sides first, then the angles.', 'A shape with equal sides can still have angles that are not equal.'],
        explanation: `Regular: ${list.map((s, i) => (s.regular ? `${LETTERS6[i]} (${s.name})` : '')).filter(Boolean).join(', ')}. Not regular: ${list.map((s, i) => (!s.regular ? `${LETTERS6[i]} (${s.name})` : '')).filter(Boolean).join(', ')}.`,
      }
    }

    const parallelMulti = (): GeneratedItem => {
      const yes = rng.sample(SHAPE_FACTS.filter((s) => s.parallel > 0), rng.int(2, 3))
      const no = rng.sample(SHAPE_FACTS.filter((s) => s.parallel === 0), 5 - yes.length)
      const list = rng.shuffle([...yes, ...no])
      return {
        type: 'multi',
        prompt: 'Which shapes have at least one pair of parallel sides? Choose every correct shape.',
        figure: shapesFig(list),
        options: list.map((s, i) => (s.parallel > 0 ? { text: `Shape ${LETTERS6[i]}` } : { text: `Shape ${LETTERS6[i]}`, why: `${LETTERS6[i]} is a ${s.name}. ${s.whyPar}` })),
        answers: list.map((s, i) => (s.parallel > 0 ? i : -1)).filter((i) => i >= 0),
        hints: ['Parallel sides go in the same direction and never meet.', 'Look for two sides that are like the rails of a train track.', 'Opposite sides are the best place to look.'],
        explanation: `${list.filter((s) => s.parallel > 0).length} shapes have parallel sides: ${list.map((s, i) => (s.parallel > 0 ? `${LETTERS6[i]} (${s.name})` : '')).filter(Boolean).join(', ')}.`,
      }
    }

    const riddle = (): GeneratedItem => {
      const r = rng.pick(RIDDLES)
      return {
        type: 'mcq',
        prompt: `Read the clues. ${r.clue} What shape am I?`,
        ...textChoice(rng, r.answer, r.wrong),
        hints: ['Read one clue at a time.', 'Cross out every shape that breaks a clue.', 'Sketch the shape to check each clue.'],
        explanation: `${r.clue.replace(/\bI have\b/g, 'It has').replace(/\bMy\b/g, 'Its')} Only ${art(r.answer.toLowerCase())} fits every clue.`,
      }
    }

    const triangles = (): GeneratedItem => {
      const eq = rng.sample(range(3, 9), 2).map((a) => [a, a, a])
      const iso = rng.sample(range(4, 9), 2).map((a) => {
        let b = rng.int(2, 2 * a - 1)
        if (b === a) b = a + 1
        return rng.shuffle([a, a, b])
      })
      const sca = rng.sample(range(3, 6), 2).map((a) => {
        const b = a + rng.int(1, 3)
        const c = b + rng.int(1, a - 1)
        return rng.shuffle([a, b, c])
      })
      const txt = (s: number[]) => `sides ${s[0]} cm, ${s[1]} cm and ${s[2]} cm`
      const items = rng.shuffle([...eq.map((s) => ({ text: txt(s), group: 0 })), ...iso.map((s) => ({ text: txt(s), group: 1 })), ...sca.map((s) => ({ text: txt(s), group: 2 }))])
      return {
        type: 'sort',
        prompt: 'Sort the triangles by the lengths of their sides.',
        groups: ['Equilateral', 'Isosceles', 'Scalene'],
        items,
        hints: ['Equilateral means all 3 sides are equal.', 'Isosceles means exactly 2 sides are equal. Scalene means no sides are equal.', `Start with the triangle with ${items[0]!.text}.`],
        explanation: `Equilateral: ${items.filter((x) => x.group === 0).map((x) => x.text.replace('sides ', '')).join('; ')}. Isosceles: ${items.filter((x) => x.group === 1).map((x) => x.text.replace('sides ', '')).join('; ')}. Scalene: ${items.filter((x) => x.group === 2).map((x) => x.text.replace('sides ', '')).join('; ')}.`,
      }
    }

    const statements = (): GeneratedItem => {
      const t = rng.sample(STATEMENTS.filter((s) => s.ok), rng.int(2, 3))
      const f = rng.sample(STATEMENTS.filter((s) => !s.ok), 5 - t.length)
      const list = rng.shuffle([...t, ...f])
      return {
        type: 'multi',
        prompt: 'Which of these are true? Choose every true sentence.',
        options: list.map((s) => (s.ok ? { text: s.text } : { text: s.text, why: s.why ?? 'This sentence is not true.' })),
        answers: list.map((s, i) => (s.ok ? i : -1)).filter((i) => i >= 0),
        hints: ['Check each sentence on its own.', 'Sketch the shape to test the sentence.', 'Watch out for the words every and always.'],
        explanation: `True: ${list.filter((s) => s.ok).map((s) => s.text).join(' ')} The other sentences are false.`,
      }
    }

    if (level === 1) return nameQuad()
    if (level === 2) return oneOf(rng, [facts, pickShape])
    if (level === 3) return oneOf(rng, [regularSort, parallelMulti])
    if (level === 4) return oneOf(rng, [riddle, triangles])
    return statements()
  },
}

// ---------------------------------------------------------------------------
// Gg: bangun ruang dan jaring-jaring
// ---------------------------------------------------------------------------

type Net = { cells: [number, number][]; alt: string; why: string }
const CUBE_NETS: readonly Net[] = [
  { cells: [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1], [3, 1]], alt: 'Six squares: a column of 4, with one square on each side of the second square.', why: '' },
  { cells: [[0, 0], [0, 1], [1, 1], [2, 1], [3, 1], [3, 2]], alt: 'Six squares: a column of 4, with one square left of the top square and one right of the bottom square.', why: '' },
  { cells: [[0, 1], [1, 0], [1, 1], [2, 1], [3, 1], [3, 2]], alt: 'Six squares: a column of 4, with one square left of the second square and one right of the bottom square.', why: '' },
  { cells: [[0, 0], [0, 1], [1, 1], [2, 1], [2, 2], [3, 1]], alt: 'Six squares: a column of 4, with one square left of the top square and one right of the third square.', why: '' },
  { cells: [[0, 0], [0, 1], [1, 1], [1, 2], [2, 2], [2, 3]], alt: 'Six squares in three steps of 2 squares, like a staircase.', why: '' },
  { cells: [[0, 0], [0, 1], [0, 2], [1, 2], [1, 3], [1, 4]], alt: 'Six squares: a row of 3, then another row of 3 one step down, joined at the end.', why: '' },
  { cells: [[0, 0], [0, 1], [1, 1], [1, 2], [1, 3], [2, 1]], alt: 'Six squares: 2 at the top, a row of 3 below starting under the second one, and 1 under the first square of the row.', why: '' },
  { cells: [[0, 0], [0, 1], [1, 1], [1, 2], [1, 3], [2, 3]], alt: 'Six squares: 2 at the top, a row of 3 below starting under the second one, and 1 under the last square of the row.', why: '' },
]
const NOT_NETS: readonly Net[] = [
  { cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]], alt: 'Six squares in 2 rows of 3, making a rectangle.', why: 'It has 2 by 2 blocks of squares. Four squares in a block cannot all fold around a cube.' },
  { cells: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5]], alt: 'Six squares in one long row.', why: 'A row of 6 squares rolls up into a tube. The two ends stay open.' },
  { cells: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 2]], alt: 'A row of 5 squares with 1 square below the middle one.', why: 'Five squares in a row is too many. The first and the fifth squares land on the same face.' },
  { cells: [[0, 0], [0, 1], [1, 0], [1, 1], [2, 1], [3, 1]], alt: 'A 2 by 2 block of squares with 2 more squares below the right-hand column.', why: 'It has a 2 by 2 block of squares. Those 4 squares cannot all fold around a cube.' },
  { cells: [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2]], alt: 'A column of 4 squares with 2 more squares to the right of the bottom one, making an L.', why: 'The last square lands on a face that is already covered, so one face stays open.' },
  { cells: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 1], [1, 2]], alt: 'A row of 4 squares with 2 squares under the middle two.', why: 'It has a 2 by 2 block of squares. Those 4 squares cannot all fold around a cube.' },
  { cells: [[0, 0], [0, 2], [1, 0], [1, 1], [1, 2], [2, 1]], alt: 'A row of 3 squares with 1 square above each end and 1 square below the middle.', why: 'The two squares at the top fold onto the same face.' },
]
const netFig = (n: Net): Fig => ({
  kind: 'grid',
  rows: Math.max(...n.cells.map((c) => c[0])) + 1,
  cols: Math.max(...n.cells.map((c) => c[1])) + 1,
  shaded: n.cells,
  alt: n.alt,
})

const SOLID_NAMES: readonly { solid: Solid; name: string; is: string; look: string }[] = [
  { solid: 'cube', name: 'Cube', is: 'A cube has 6 square faces.', look: 'A 3D shape with 6 equal square faces.' },
  { solid: 'cuboid', name: 'Cuboid', is: 'A cuboid has 6 rectangle faces.', look: 'A 3D shape with 6 rectangle faces, like a box.' },
  { solid: 'sphere', name: 'Sphere', is: 'A sphere is round all over, with no flat faces.', look: 'A 3D shape that is round all over, like a ball.' },
  { solid: 'cylinder', name: 'Cylinder', is: 'A cylinder has 2 circle faces and a curved surface.', look: 'A 3D shape with 2 circle faces and a curved side, like a tin.' },
  { solid: 'cone', name: 'Cone', is: 'A cone has 1 circle face and a curved surface that comes to a point.', look: 'A 3D shape with 1 circle face and a curved side that comes to a point.' },
  { solid: 'square-pyramid', name: 'Square-based pyramid', is: 'A square-based pyramid has a square base and 4 triangle faces.', look: 'A 3D shape with a square base and 4 triangle faces that meet at a point.' },
  { solid: 'triangular-prism', name: 'Triangular prism', is: 'A triangular prism has 2 triangle ends and 3 rectangle faces.', look: 'A 3D shape with 2 triangle ends and 3 rectangle faces, like a tent.' },
]

const SOLID_COUNTS: readonly { solid: Solid; name: string; faces: number; edges: number; vertices: number }[] = [
  { solid: 'cube', name: 'cube', faces: 6, edges: 12, vertices: 8 },
  { solid: 'cuboid', name: 'cuboid', faces: 6, edges: 12, vertices: 8 },
  { solid: 'square-pyramid', name: 'square-based pyramid', faces: 5, edges: 8, vertices: 5 },
  { solid: 'triangular-prism', name: 'triangular prism', faces: 5, edges: 9, vertices: 6 },
]

const BASES4 = [
  { n: 3, adj: 'triangular', shape: 'triangle' as Shape2D, word: 'triangle' },
  { n: 4, adj: 'square-based', shape: 'square' as Shape2D, word: 'square' },
  { n: 5, adj: 'pentagonal', shape: 'pentagon' as Shape2D, word: 'pentagon' },
  { n: 6, adj: 'hexagonal', shape: 'hexagon' as Shape2D, word: 'hexagon' },
  { n: 8, adj: 'octagonal', shape: 'octagon' as Shape2D, word: 'octagon' },
] as const

const NET_WORDS: readonly { net: string; solid: string; kind: 'prism' | 'pyramid' | 'cube' | 'curved' }[] = [
  { net: '6 squares', solid: 'Cube', kind: 'cube' },
  { net: '2 squares and 4 rectangles', solid: 'Cuboid', kind: 'cube' },
  { net: '2 triangles and 3 rectangles', solid: 'Triangular prism', kind: 'prism' },
  { net: '1 square and 4 triangles', solid: 'Square-based pyramid', kind: 'pyramid' },
  { net: '4 triangles', solid: 'Triangular-based pyramid', kind: 'pyramid' },
  { net: '2 circles and 1 rectangle', solid: 'Cylinder', kind: 'curved' },
  { net: '2 hexagons and 6 rectangles', solid: 'Hexagonal prism', kind: 'prism' },
  { net: '1 pentagon and 5 triangles', solid: 'Pentagonal pyramid', kind: 'pyramid' },
]

const shapes3d4: Generator = {
  skill: 'm4.shapes-3d',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const name = pickName(rng)

    const count = (): GeneratedItem => {
      const s = rng.pick(SOLID_COUNTS)
      const ask = rng.pick(['faces', 'edges', 'vertices'] as const)
      const pyr = s.solid === 'square-pyramid'
      const hints =
        ask === 'faces'
          ? ['A face is a flat surface.', 'Count the faces you can see, then picture the ones at the back.', 'Count each face once.']
          : ask === 'edges'
            ? ['An edge is where two faces meet.', pyr ? 'Count the edges around the base, then the ones going up to the top.' : 'Count the edges on the front end, the back end, then the ones joining them.', 'Picture the edges hidden at the back.']
            : ['A vertex is a corner where edges meet.', pyr ? 'Count the corners of the base, then the point at the top.' : 'Count the corners at the front, then the ones at the back.', 'Picture the corners hidden at the back.']
      return {
        type: 'numeric',
        prompt: `How many ${ask} does this ${s.name} have?`,
        figure: { kind: 'solid', solid: s.solid, alt: `A picture of a ${s.name}.` },
        answer: s[ask],
        hints,
        explanation: `A ${s.name} has ${s.faces} faces, ${s.edges} edges and ${s.vertices} vertices.`,
      }
    }

    const nameSolid = (): GeneratedItem => {
      const s = rng.pick(SOLID_NAMES)
      const others = SOLID_NAMES.filter((x) => x !== s && !(s.solid === 'cube' && x.solid === 'cuboid'))
      return {
        type: 'mcq',
        prompt: 'What is the name of this 3D shape?',
        figure: { kind: 'solid', solid: s.solid, alt: s.look },
        ...textChoice(rng, s.name, rng.shuffle(others).map((o) => ({ value: o.name, why: o.is }))),
        hints: ['Look at the shape of each face.', 'Check for curved surfaces and for a point at the top.', 'Count the flat faces you can see.'],
        explanation: `${s.is} So it is ${art(s.name.toLowerCase())}.`,
      }
    }

    const which = (): GeneratedItem => {
      const s = rng.pick(SOLID_COUNTS.filter((x) => x.solid !== 'cuboid'))
      const opts = SOLID_COUNTS.filter((x) => x.name !== s.name && !(s.solid === 'cube' && x.solid === 'cuboid'))
      const extra = [{ name: 'cylinder', faces: 3, edges: 2, vertices: 0 }, { name: 'cone', faces: 2, edges: 1, vertices: 1 }]
      return {
        type: 'mcq',
        prompt: `Which 3D shape has ${s.faces} faces, ${s.edges} edges and ${s.vertices} vertices?`,
        ...textChoice(rng, cap(s.name), rng.shuffle([...opts, ...extra]).map((o) => ({ value: cap(o.name), why: `A ${o.name} has ${plural(o.faces, 'face', 'faces')}, ${plural(o.edges, 'edge', 'edges')} and ${plural(o.vertices, 'vertex', 'vertices')}.` }))),
        hints: ['Picture each shape and count its faces first.', 'Then check the edges and the vertices.', 'A pyramid has a point at the top. A prism has two matching ends.'],
        explanation: `A ${s.name} has ${s.faces} faces, ${s.edges} edges and ${s.vertices} vertices.`,
      }
    }

    const sortSolids = (): GeneratedItem => {
      const prisms = rng.sample(['cube', 'cuboid', 'triangular prism', 'pentagonal prism', 'hexagonal prism'], 2)
      const pyramids = rng.sample(['square-based pyramid', 'triangular-based pyramid', 'pentagonal pyramid', 'hexagonal pyramid'], 2)
      const neither = rng.sample(['sphere', 'cylinder', 'cone'], rng.int(1, 2))
      const items = rng.shuffle([...prisms.map((t) => ({ text: t, group: 0 })), ...pyramids.map((t) => ({ text: t, group: 1 })), ...neither.map((t) => ({ text: t, group: 2 }))])
      return {
        type: 'sort',
        prompt: 'Sort the 3D shapes into prisms, pyramids and neither.',
        groups: ['Prism', 'Pyramid', 'Neither'],
        items,
        hints: ['A prism has two matching ends joined by rectangles.', 'A pyramid has one base and triangles that meet at a point.', 'Shapes with a curved surface go in neither.'],
        explanation: `Prisms: ${listAnd(prisms)}. Pyramids: ${listAnd(pyramids)}. Neither: ${listAnd(neither)}, because ${neither.length > 1 ? 'they have' : 'it has'} a curved surface.`,
      }
    }

    const general = (): GeneratedItem => {
      const prism = rng.chance(0.5)
      const b = rng.pick(prism ? BASES4.filter((x) => x.n !== 4) : BASES4)
      const solidName = prism ? `${b.adj} prism` : b.n === 3 ? 'triangular-based pyramid' : `${b.adj} pyramid`
      const ask = rng.pick(['faces', 'edges', 'vertices'] as const)
      const n = b.n
      let answer: number
      let hints: string[]
      let explanation: string
      if (prism) {
        if (ask === 'faces') {
          answer = n + 2
          hints = ['A prism has two matching ends joined by rectangles.', `Each end is a ${b.word}.`, `There is one rectangle for each side of the ${b.word}.`]
          explanation = `2 ${b.word} ends + ${n} rectangles = ${n + 2} faces.`
        } else if (ask === 'edges') {
          answer = 3 * n
          hints = ['Count the edges on each end, then the edges joining the ends.', `Each ${b.word} end has ${n} edges.`, `${n} more edges join the two ends.`]
          explanation = `${n} + ${n} + ${n} = ${3 * n} edges.`
        } else {
          answer = 2 * n
          hints = ['All the vertices are on the two ends.', `Each end is a ${b.word} with ${n} corners.`, 'Add the corners on both ends.']
          explanation = `${n} + ${n} = ${2 * n} vertices.`
        }
      } else if (ask === 'faces') {
        answer = n + 1
        hints = ['A pyramid has one base and triangles that meet at the top.', `The base is a ${b.word} with ${n} sides.`, 'There is one triangle for each side of the base.']
        explanation = `1 ${b.word} base + ${n} triangles = ${n + 1} faces.`
      } else if (ask === 'edges') {
        answer = 2 * n
        hints = ['Count the edges around the base, then the edges going up.', `The base has ${n} edges.`, 'One edge goes up from each corner of the base to the top.']
        explanation = `${n} edges around the base + ${n} edges going up = ${2 * n} edges.`
      } else {
        answer = n + 1
        hints = ['Count the corners of the base, then the top.', `The base has ${n} corners.`, 'Remember the point at the top.']
        explanation = `${n} corners on the base + 1 at the top = ${n + 1} vertices.`
      }
      return {
        type: 'numeric',
        prompt: `A ${solidName} has a ${b.word} ${prism ? 'at each end' : 'as its base'}. How many ${ask} does it have?`,
        figure: { kind: 'shape', shape: b.shape, alt: `A ${b.n === 3 ? 'triangle' : b.n === 4 ? 'square' : `regular ${b.word}`} with ${n} sides, the ${prism ? 'end' : 'base'} of the ${solidName}.` },
        answer,
        hints,
        explanation,
      }
    }

    const nets = (): GeneratedItem => {
      if (rng.chance(0.5)) {
        const good = rng.pick(CUBE_NETS)
        const bad = rng.sample(NOT_NETS, 3)
        return {
          type: 'mcq',
          prompt: 'Which of these is a net of a cube?',
          ...figChoice(rng, netFig(good), bad.map((n) => ({ figure: netFig(n), why: n.why }))),
          hints: ['A cube has 6 square faces, so its net has 6 squares.', 'Picture folding the squares up around one square at the bottom.', 'A net that has 2 squares landing on the same face is not a net of a cube.'],
          explanation: 'The correct net folds up with every square on a different face of the cube. In each of the others, two squares land on the same face.',
        }
      }
      const bad = rng.pick(NOT_NETS)
      const goods = rng.sample(CUBE_NETS, 3)
      return {
        type: 'mcq',
        prompt: 'Three of these are nets of a cube. Which one is not?',
        ...figChoice(rng, netFig(bad), goods.map((n) => ({ figure: netFig(n), why: 'This one folds into a cube: every square lands on a different face.' }))),
        hints: ['Picture folding each net around one square at the bottom.', 'Check whether two squares land on the same face.', 'Look for a 2 by 2 block, or for more than 4 squares in a row.'],
        explanation: `The odd one out: ${bad.why}`,
      }
    }

    const netWords = (): GeneratedItem => {
      const n = rng.pick(NET_WORDS)
      const others = NET_WORDS.filter((x) => x.solid !== n.solid && !(n.solid === 'Cube' && x.solid === 'Cuboid'))
      return {
        type: 'mcq',
        prompt: `A net is made of ${n.net}. Which 3D shape does it fold into?`,
        ...textChoice(rng, n.solid, rng.shuffle(others).map((o) => ({ value: o.solid, why: `The net of a ${o.solid.toLowerCase()} has ${o.net}.` }))),
        hints: ['Each flat shape in the net becomes one face.', 'Count the faces and look at their shapes.', n.kind === 'prism' ? 'Two matching ends joined by rectangles make a prism.' : n.kind === 'pyramid' ? 'Triangles that meet at one point make a pyramid.' : n.kind === 'curved' ? 'A rectangle can roll up to make a curved surface.' : 'Look at whether all the faces are squares.'],
        explanation: `The ${n.net} fold up to make ${art(n.solid.toLowerCase())}. Each flat shape becomes one face.`,
      }
    }

    const straws = (): GeneratedItem => {
      const s = rng.pick([
        { name: 'cube', many: 'cubes', edges: 12, vertices: 8, solid: 'cube' as Solid | null },
        { name: 'square-based pyramid', many: 'square-based pyramids', edges: 8, vertices: 5, solid: 'square-pyramid' as Solid | null },
        { name: 'triangular prism', many: 'triangular prisms', edges: 9, vertices: 6, solid: 'triangular-prism' as Solid | null },
        { name: 'triangular-based pyramid', many: 'triangular-based pyramids', edges: 6, vertices: 4, solid: null },
      ])
      const k = rng.int(1, 3)
      const askStraws = rng.chance(0.5)
      const per = askStraws ? s.edges : s.vertices
      const what = askStraws ? 'edge' : 'vertex'
      return {
        type: 'numeric',
        prompt: `${name} makes ${k === 1 ? `a ${s.name}` : `${k} ${s.many}`} from straws and balls of clay. Each edge is a straw and each vertex is a ball of clay. How many ${askStraws ? 'straws' : 'balls of clay'} are needed?`,
        ...(s.solid ? { figure: { kind: 'solid', solid: s.solid, alt: `A picture of a ${s.name}.` } as Fig } : {}),
        answer: k * per,
        hints: [`Each ${askStraws ? 'straw' : 'ball of clay'} is one ${what}.`, `How many ${askStraws ? 'edges' : 'vertices'} does one ${s.name} have?`, k > 1 ? `Then multiply by ${k}.` : askStraws ? 'Count the edges around the bottom first.' : 'Count the corners at the bottom first.'],
        explanation: k > 1 ? `One ${s.name} has ${per} ${askStraws ? 'edges' : 'vertices'}. ${k} × ${per} = ${k * per}.` : `A ${s.name} has ${per} ${askStraws ? 'edges' : 'vertices'}, so ${name} needs ${per}.`,
        tags: WORD,
      }
    }

    const dice = (): GeneratedItem => {
      const x = rng.int(1, 6)
      const side = rng.pick([['top', 'bottom'], ['front', 'back'], ['left', 'right']] as const)
      return {
        type: 'numeric',
        prompt: `On a normal dice, opposite faces always add up to 7. The ${side[0]} face shows ${x}. What number is on the ${side[1]}?`,
        figure: { kind: 'solid', solid: 'cube', alt: 'A picture of a dice shaped like a cube.' },
        answer: 7 - x,
        hints: ['Opposite faces always add up to 7.', `Which number goes with ${x} to make 7?`, `Work out 7 - ${x}.`],
        explanation: `${x} + ${7 - x} = 7, so the ${side[1]} shows ${7 - x}.`,
        tags: WORD,
      }
    }

    if (level === 1) return oneOf(rng, [count, nameSolid])
    if (level === 2) return oneOf(rng, [which, sortSolids])
    if (level === 3) return general()
    if (level === 4) return oneOf(rng, [nets, netWords])
    return oneOf(rng, [straws, dice])
  },
}

// ---------------------------------------------------------------------------
// Gp: koordinat dan translasi
// ---------------------------------------------------------------------------

const sq = (n: number): string => plural(n, 'square', 'squares')
const moveText = (dx: number, dy: number): string =>
  [dx ? `${sq(Math.abs(dx))} ${dx > 0 ? 'right' : 'left'}` : '', dy ? `${sq(Math.abs(dy))} ${dy > 0 ? 'up' : 'down'}` : ''].filter(Boolean).join(' and ')
const pm = (v: number, d: number): string => `${v} ${d >= 0 ? '+' : '-'} ${Math.abs(d)}`

const coordinates4: Generator = {
  skill: 'm4.coordinates',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const grid = (points: { x: number; y: number; label?: string }[], alt: string): Fig => ({ kind: 'coordinates', size: 8, points, alt })
    const nonZero = (lo: number, hi: number): number => {
      const v = rng.int(lo, hi - 1)
      return v >= 0 ? v + 1 : v
    }

    const read = (): GeneratedItem => {
      const x = rng.int(1, 7)
      let y = rng.int(1, 7)
      if (y === x) y = x === 7 ? 6 : x + 1
      return {
        type: 'text',
        prompt: 'What are the coordinates of point A? Point A is at (___, ___).',
        figure: grid([{ x, y, label: 'A' }], `A coordinate grid from 0 to 8. Point A is ${x} across and ${y} up.`),
        blanks: [{ answers: [String(x)] }, { answers: [String(y)] }],
        hints: ['Coordinates are written (across, up).', 'Start at 0. Count across along the x-axis first.', 'Then count up the y-axis.'],
        explanation: `A is ${x} across and ${y} up, so A is at (${x}, ${y}).`,
      }
    }

    const which = (): GeneratedItem => {
      let x = rng.int(1, 7)
      const y = rng.int(1, 7)
      if (x === y) x = y === 7 ? 6 : y + 1
      const cands = [
        { x, y, tip: '' },
        { x: y, y: x, tip: 'The first number tells you how far across.' },
        { x: x + (x < 7 ? 1 : -1), y, tip: 'Count across again from 0.' },
        { x, y: y + (y > 1 ? -1 : 1), tip: 'Count up again from 0.' },
      ]
      const pts = rng.shuffle(cands)
      const labels = ['A', 'B', 'C', 'D']
      return {
        type: 'mcq',
        prompt: `Which point is at (${x}, ${y})?`,
        figure: grid(pts.map((p, i) => ({ x: p.x, y: p.y, label: labels[i]! })), `A coordinate grid with points ${pts.map((p, i) => `${labels[i]} at (${p.x}, ${p.y})`).join(', ')}.`),
        options: pts.map((p, i) => (p.tip ? { text: labels[i]!, why: `${labels[i]} is at (${p.x}, ${p.y}). ${p.tip}` } : { text: labels[i]! })),
        answer: pts.findIndex((p) => !p.tip),
        hints: ['The first number tells you how far across.', 'The second number tells you how far up.', `Go across ${x} from 0, then go up ${y}.`],
        explanation: `Go across ${x} and up ${y}. The point there is ${labels[pts.findIndex((p) => !p.tip)]}.`,
      }
    }

    const direction = (): GeneratedItem => {
      const x = rng.int(2, 6)
      const y = rng.int(2, 6)
      const k = rng.int(1, 2)
      const dx = rng.pick([-1, 1]) * k
      const dy = rng.pick([-1, 1]) * k
      const dir = (sx: number, sy: number) => `${sy > 0 ? 'north' : 'south'}-${sx > 0 ? 'east' : 'west'}`
      const ans = dir(dx, dy)
      const MEAN: Record<string, string> = {
        'north-east': 'North-east means up and to the right.',
        'north-west': 'North-west means up and to the left.',
        'south-east': 'South-east means down and to the right.',
        'south-west': 'South-west means down and to the left.',
      }
      return {
        type: 'mcq',
        prompt: 'North is at the top of the grid. In which direction is B from A?',
        figure: grid([{ x, y, label: 'A' }, { x: x + dx, y: y + dy, label: 'B' }], `A coordinate grid. A is at (${x}, ${y}) and B is at (${x + dx}, ${y + dy}).`),
        ...textChoice(rng, cap(ans), ['north-east', 'north-west', 'south-east', 'south-west'].filter((d) => d !== ans).map((d) => ({ value: cap(d), why: `${MEAN[d]} B is ${dy > 0 ? 'up' : 'down'} and to the ${dx > 0 ? 'right' : 'left'} of A.` }))),
        hints: ['Put your finger on A, then move it to B.', 'Does B go up or down from A? Left or right?', 'Up is north and right is east.'],
        explanation: `B is ${sq(k)} ${dy > 0 ? 'up' : 'down'} and ${sq(k)} to the ${dx > 0 ? 'right' : 'left'} of A, so B is ${ans} of A.`,
      }
    }

    const fourth = (): GeneratedItem => {
      const x1 = rng.int(1, 4)
      const y1 = rng.int(1, 4)
      const w = rng.int(2, 4)
      const h = rng.int(2, 4)
      const corners: [number, number][] = [[x1, y1], [x1 + w, y1], [x1 + w, y1 + h], [x1, y1 + h]]
      const miss = rng.int(0, 3)
      const shown = [1, 2, 3].map((k) => corners[(miss + k) % 4]!)
      const labels = ['A', 'B', 'C']
      const [mx, my] = corners[miss]!
      const shape = w === h ? 'square' : 'rectangle'
      const nx = shown.find((p) => p[0] === mx)!
      const ny = shown.find((p) => p[1] === my)!
      const lx = labels[shown.indexOf(nx)]!
      const ly = labels[shown.indexOf(ny)]!
      return {
        type: 'text',
        prompt: `A, B and C are three corners of a ${shape}. Where is the fourth corner? It is at (___, ___).`,
        figure: grid(shown.map((p, i) => ({ x: p[0], y: p[1], label: labels[i]! })), `A coordinate grid with A at (${shown[0]![0]}, ${shown[0]![1]}), B at (${shown[1]![0]}, ${shown[1]![1]}) and C at (${shown[2]![0]}, ${shown[2]![1]}).`),
        blanks: [{ answers: [String(mx)] }, { answers: [String(my)] }],
        hints: [`The sides of a ${shape} go straight across and straight up.`, 'The missing corner has the same first number as one corner and the same second number as another.', `Look at the corner next to the gap, ${lx}, at (${nx[0]}, ${nx[1]}).`],
        explanation: `The missing corner is straight across from ${ly} and straight up or down from ${lx}. It has the same first number as ${lx} and the same second number as ${ly}, so it is at (${mx}, ${my}).`,
      }
    }

    const translate = (): GeneratedItem => {
      const x = rng.int(2, 6)
      const y = rng.int(2, 6)
      const dx = nonZero(Math.max(-3, -x), Math.min(3, 8 - x))
      const dy = nonZero(Math.max(-3, -y), Math.min(3, 8 - y))
      return {
        type: 'text',
        prompt: `Point P is at (${x}, ${y}). It moves ${moveText(dx, dy)}. Where is it now? P is at (___, ___).`,
        figure: grid([{ x, y, label: 'P' }], `A coordinate grid with P at (${x}, ${y}).`),
        blanks: [{ answers: [String(x + dx)] }, { answers: [String(y + dy)] }],
        hints: ['Moving right or left changes the first number.', 'Moving up or down changes the second number.', `Start with the first number: ${pm(x, dx)}.`],
        explanation: `${pm(x, dx)} = ${x + dx} and ${pm(y, dy)} = ${y + dy}. P is now at (${x + dx}, ${y + dy}).`,
      }
    }

    const describe = (): GeneratedItem => {
      const x = rng.int(2, 6)
      const y = rng.int(2, 6)
      const dx = nonZero(Math.max(-3, -x + 1), Math.min(4, 7 - x))
      const dy = nonZero(Math.max(-3, -y + 1), Math.min(4, 7 - y))
      const x2 = x + dx
      const y2 = y + dy
      const ans = cap(moveText(dx, dy))
      return {
        type: 'mcq',
        prompt: `Point A moves to point B. Which describes the move?`,
        figure: grid([{ x, y, label: 'A' }, { x: x2, y: y2, label: 'B' }], `A coordinate grid. A is at (${x}, ${y}) and B is at (${x2}, ${y2}).`),
        ...textChoice(rng, ans, [
          { value: cap(moveText(-dx, -dy)), why: 'That is the move from B back to A.' },
          { value: cap(moveText(dy, dx)), why: 'The across and up amounts are mixed up.' },
          { value: cap(moveText(-dx, dy)), why: `Check the first numbers: they go from ${x} to ${x2}.` },
          { value: cap(moveText(dx, -dy)), why: `Check the second numbers: they go from ${y} to ${y2}.` },
          { value: cap(moveText(x2, y2)), why: 'Those are the numbers for B. The move is the change from A to B.' },
        ]),
        hints: ['Compare the first numbers to find the move across.', 'Compare the second numbers to find the move up or down.', `A is at (${x}, ${y}) and B is at (${x2}, ${y2}).`],
        explanation: `${x} to ${x2} is ${sq(Math.abs(dx))} ${dx > 0 ? 'right' : 'left'}. ${y} to ${y2} is ${sq(Math.abs(dy))} ${dy > 0 ? 'up' : 'down'}.`,
      }
    }

    const shapeMove = (): GeneratedItem => {
      const x1 = rng.int(1, 3)
      const y1 = rng.int(1, 3)
      const a = rng.int(2, 3)
      const tri: [number, number][] = [[x1, y1], [x1 + a, y1], [x1 + rng.int(0, a), y1 + rng.int(2, 3)]]
      const maxX = Math.max(...tri.map((p) => p[0]))
      const maxY = Math.max(...tri.map((p) => p[1]))
      const dx = nonZero(Math.max(-3, -x1), Math.min(3, 8 - maxX))
      const dy = nonZero(Math.max(-3, -y1), Math.min(3, 8 - maxY))
      const labels = ['A', 'B', 'C']
      const v = rng.int(0, 2)
      const [vx, vy] = tri[v]!
      return {
        type: 'text',
        prompt: `Triangle ABC moves ${moveText(dx, dy)}. Where does ${labels[v]} move to? ${labels[v]} moves to (___, ___).`,
        figure: { kind: 'coordinates', size: 8, polygon: true, points: tri.map((p, i) => ({ x: p[0], y: p[1], label: labels[i]! })), alt: `A triangle on a coordinate grid with A at (${tri[0]![0]}, ${tri[0]![1]}), B at (${tri[1]![0]}, ${tri[1]![1]}) and C at (${tri[2]![0]}, ${tri[2]![1]}).` },
        blanks: [{ answers: [String(vx + dx)] }, { answers: [String(vy + dy)] }],
        hints: ['Every corner of the triangle moves the same way.', `Find ${labels[v]} first. Read its coordinates.`, 'Change the first number for the move across, and the second for up or down.'],
        explanation: `${labels[v]} is at (${vx}, ${vy}). ${pm(vx, dx)} = ${vx + dx} and ${pm(vy, dy)} = ${vy + dy}. So ${labels[v]} moves to (${vx + dx}, ${vy + dy}).`,
      }
    }

    const reverse = (): GeneratedItem => {
      const x = rng.int(1, 7)
      const y = rng.int(1, 7)
      const dx = nonZero(Math.max(-3, 1 - x), Math.min(3, 7 - x))
      const dy = nonZero(Math.max(-3, 1 - y), Math.min(3, 7 - y))
      const x2 = x + dx
      const y2 = y + dy
      return {
        type: 'text',
        prompt: `Point Q moves ${moveText(dx, dy)}. Now it is at (${x2}, ${y2}). Where was Q before the move? Q was at (___, ___).`,
        figure: grid([{ x: x2, y: y2, label: 'Q' }], `A coordinate grid with Q at (${x2}, ${y2}) after the move.`),
        blanks: [{ answers: [String(x)] }, { answers: [String(y)] }],
        hints: ['Undo the move to go back to the start.', `Undo ${moveText(dx, 0)} by going ${moveText(-dx, 0)}.`, `Start with the first number: ${pm(x2, -dx)}.`],
        explanation: `${pm(x2, -dx)} = ${x} and ${pm(y2, -dy)} = ${y}. Q was at (${x}, ${y}).`,
        tags: WORD,
      }
    }

    if (level === 1) return read()
    if (level === 2) return oneOf(rng, [which, direction])
    if (level === 3) return oneOf(rng, [fourth, translate])
    if (level === 4) return oneOf(rng, [translate, describe])
    return oneOf(rng, [shapeMove, reverse])
  },
}

// ---------------------------------------------------------------------------
// Ss: tabel, piktogram, diagram batang
// ---------------------------------------------------------------------------

const SURVEYS4 = SURVEYS.filter((s) => s.topic !== 'way to school')
const WHO4 = 'the children in Class 4'

const BAR_SETS4: readonly { title: string; cats: readonly string[]; y: string; q: (c: string) => string; more: (a: string, b: string) => string; all: string }[] = [
  { title: 'Books borrowed from the library', cats: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], y: 'Books', q: (c) => `How many books were borrowed on ${c}?`, more: (a, b) => `How many more books were borrowed on ${a} than on ${b}?`, all: 'How many books were borrowed altogether?' },
  { title: 'Visitors to the school fair', cats: ['Stall A', 'Stall B', 'Stall C', 'Stall D', 'Stall E'], y: 'Visitors', q: (c) => `How many visitors went to ${c}?`, more: (a, b) => `How many more visitors went to ${a} than to ${b}?`, all: 'How many visits were there altogether?' },
  { title: 'Mangoes picked', cats: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'], y: 'Mangoes', q: (c) => `How many mangoes were picked in ${c}?`, more: (a, b) => `How many more mangoes were picked in ${a} than in ${b}?`, all: 'How many mangoes were picked altogether?' },
  { title: 'Plastic bottles collected', cats: ['Class 4A', 'Class 4B', 'Class 4C', 'Class 4D'], y: 'Bottles', q: (c) => `How many bottles did ${c} collect?`, more: (a, b) => `How many more bottles did ${a} collect than ${b}?`, all: 'How many bottles were collected altogether?' },
]

const dataCharts4: Generator = {
  skill: 'm4.data-charts',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const survey = (n: number, lo: number, hi: number, mult = 1) => {
      const s = rng.pick(SURVEYS4)
      const labels = rng.sample(s.items, n)
      const values = rng.sample(range(Math.ceil(lo / mult), Math.floor(hi / mult)), n).map((v) => v * mult)
      return { s, labels, values }
    }
    const tableFig = (s: (typeof SURVEYS)[number], labels: readonly string[], values: readonly (number | string)[]): Fig => ({
      kind: 'table',
      head: [cap(s.topic), 'Number of children'],
      rows: labels.map((l, i) => [l, String(values[i])]),
      alt: `Table of ${s.of(WHO4)}: ${labels.map((l, i) => `${l} ${values[i]}`).join(', ')}.`,
    })
    const bars = (step: number, mult: number) => {
      const set = rng.pick(BAR_SETS4)
      const cats = set.cats.slice(0, rng.int(4, set.cats.length))
      const values = rng.sample(range(3, Math.floor((step * 10) / mult)), cats.length).map((v) => v * mult)
      const figure: Fig = { kind: 'bars', title: set.title, categories: [...cats], values, step, yLabel: set.y, alt: `Bar chart of ${set.title.toLowerCase()}: ${cats.map((c, i) => `${c} ${values[i]}`).join(', ')}.` }
      return { set, cats, values, figure }
    }

    const readTable = (): GeneratedItem => {
      const { s, labels, values } = survey(5, 4, 32)
      const i = rng.int(0, 4)
      return {
        type: 'numeric',
        prompt: `The table shows ${s.of(WHO4)}. How many children chose ${lc(labels[i]!)}?`,
        figure: tableFig(s, labels, values),
        answer: values[i]!,
        hints: [`Find the row for ${labels[i]}.`, 'Read across to the number column.', 'Check that you are reading the right row.'],
        explanation: `The ${labels[i]} row shows ${values[i]} children.`,
      }
    }

    const readBar = (): GeneratedItem => {
      const step = rng.pick([10, 20])
      const { set, cats, values, figure } = bars(step, step / 2)
      const half = values.findIndex((v) => v % step !== 0)
      const i = half >= 0 && rng.chance(0.7) ? half : rng.int(0, cats.length - 1)
      return {
        type: 'numeric',
        prompt: set.q(cats[i]!),
        figure,
        answer: values[i]!,
        hints: ['Find the bar, then look across to the scale.', `The scale goes up in ${step}s. Halfway between two lines is ${step / 2} more.`, `Put your finger on the top of the bar for ${cats[i]} and slide it across.`],
        explanation: values[i]! % step ? `The bar for ${cats[i]} ends halfway between ${values[i]! - step / 2} and ${values[i]! + step / 2}, so it shows ${values[i]}.` : `The bar for ${cats[i]} reaches the line for ${values[i]}.`,
      }
    }

    const picto = (): GeneratedItem => {
      const key = rng.pick([2, 4, 10, 5])
      const halves = key !== 5
      const s = rng.pick(SURVEYS4)
      const labels = rng.sample(s.items, 4)
      const counts = labels.map(() => rng.int(1, 7) + (halves && rng.chance(0.4) ? 0.5 : 0))
      if (halves && !counts.some((c) => c % 1 !== 0)) counts[rng.int(0, 3)] = rng.int(1, 6) + 0.5
      const values = counts.map((c) => c * key)
      const i = halves && rng.chance(0.7) ? counts.findIndex((c) => c % 1 !== 0) : rng.int(0, 3)
      const c = counts[i]!
      return {
        type: 'numeric',
        prompt: `Each symbol means ${key} children. How many children chose ${lc(labels[i]!)}?`,
        figure: {
          kind: 'pictogram',
          title: cap(s.topic),
          rows: labels.map((l, k) => ({ label: l, count: counts[k]! })),
          icon: s.icon,
          key,
          alt: `Pictogram of ${s.of(WHO4)}. Each symbol means ${key} children. ${labels.map((l, k) => `${l}: ${symCount(counts[k]!)}`).join(', ')}.`,
        },
        answer: values[i]!,
        hints: ['Look at the key first.', `Each whole symbol means ${key}.${halves ? ` Half a symbol means ${key / 2}.` : ''}`, `Count the symbols in the ${labels[i]} row.`],
        explanation: c % 1 ? `${labels[i]} has ${plural(Math.floor(c), 'whole symbol', 'whole symbols')} and a half. ${Math.floor(c)} × ${key} = ${Math.floor(c) * key}, and half a symbol is ${key / 2}. ${Math.floor(c) * key} + ${key / 2} = ${values[i]}.` : `${labels[i]} has ${plural(c, 'symbol', 'symbols')}. ${c} × ${key} = ${values[i]}.`,
      }
    }

    const compareBars = (): GeneratedItem => {
      const step = rng.pick([5, 10])
      const { set, cats, values, figure } = bars(step, 5)
      const [i, j] = rng.sample(range(0, cats.length - 1), 2) as [number, number]
      const hi = values[i]! > values[j]! ? i : j
      const lo = hi === i ? j : i
      if (rng.chance(0.5)) {
        return {
          type: 'numeric',
          prompt: set.more(cats[hi]!, cats[lo]!),
          figure,
          answer: values[hi]! - values[lo]!,
          hints: ['Read the two bars first.', `Find the bar for ${cats[hi]} and the bar for ${cats[lo]}.`, `${cats[hi]} shows ${values[hi]}.`],
          explanation: `${cats[hi]} shows ${values[hi]} and ${cats[lo]} shows ${values[lo]}. ${values[hi]} - ${values[lo]} = ${values[hi]! - values[lo]!}.`,
          tags: WORD,
        }
      }
      const total = values.reduce((a, b) => a + b, 0)
      return {
        type: 'numeric',
        prompt: set.all,
        figure,
        answer: total,
        hints: ['Read the value of every bar.', 'Add the values together.', `The first bar shows ${values[0]}.`],
        explanation: `${values.join(' + ')} = ${total}.`,
      }
    }

    const missing = (): GeneratedItem => {
      const { s, labels, values } = survey(4, 5, 30)
      const i = rng.int(0, 3)
      const total = values.reduce((a, b) => a + b, 0)
      const shown = values.map((v, k) => (k === i ? '?' : v))
      const known = values.filter((_, k) => k !== i)
      return {
        type: 'numeric',
        prompt: `${total} children answered the survey. How many children chose ${lc(labels[i]!)}?`,
        figure: { ...(tableFig(s, labels, shown) as Extract<Fig, { kind: 'table' }>), alt: `Table of ${s.of(WHO4)}: ${labels.map((l, k) => `${l} ${k === i ? 'unknown' : values[k]}`).join(', ')}.` },
        answer: values[i]!,
        hints: ['Add the numbers you know.', `Then take that away from ${total}.`, `${known.join(' + ')} = ?`],
        explanation: `${known.join(' + ')} = ${known.reduce((a, b) => a + b, 0)}. ${total} - ${known.reduce((a, b) => a + b, 0)} = ${values[i]}.`,
        tags: WORD,
      }
    }

    const whichChart = (): GeneratedItem => {
      const { s, labels, values } = survey(4, 5, 45, 5)
      const barFig = (vals: number[], alt: string): Fig => ({ kind: 'bars', categories: labels, values: vals, step: 10, axisMax: 50, alt })
      const desc = (vals: number[]) => labels.map((l, k) => `${l} ${vals[k]}`).join(', ')
      const [p, q] = rng.sample([0, 1, 2, 3], 2) as [number, number]
      const swapped = values.map((v, k) => (k === p ? values[q]! : k === q ? values[p]! : v))
      const r = rng.int(0, 3)
      const off1 = values.map((v, k) => (k === r ? v + (v < 40 ? 10 : -10) : v))
      const t = (r + 1 + rng.int(0, 2)) % 4
      const off2 = values.map((v, k) => (k === t ? v + (v > 10 ? -5 : 5) : v))
      return {
        type: 'mcq',
        prompt: `The table shows ${s.of(WHO4)}. Which bar chart shows the same data?`,
        figure: tableFig(s, labels, values),
        ...figChoice(rng, barFig(values, `Bar chart: ${desc(values)}.`), [
          { figure: barFig(swapped, `Bar chart: ${desc(swapped)}.`), why: `In this chart ${labels[p]} and ${labels[q]} have swapped places.` },
          { figure: barFig(off1, `Bar chart: ${desc(off1)}.`), why: `In this chart ${labels[r]} shows ${off1[r]}, but the table says ${values[r]}.` },
          { figure: barFig(off2, `Bar chart: ${desc(off2)}.`), why: `In this chart ${labels[t]} shows ${off2[t]}, but the table says ${values[t]}.` },
        ]),
        hints: ['Check one bar at a time against the table.', 'The scale goes up in 10s. Halfway between two lines is 5 more.', `${labels[0]} should be ${values[0]}.`],
        explanation: `The correct chart shows ${desc(values)}, the same as the table.`,
      }
    }

    const pictoDiff = (): GeneratedItem => {
      const key = rng.pick([2, 4, 10])
      const s = rng.pick(SURVEYS4)
      const labels = rng.sample(s.items, 4)
      const counts = labels.map(() => rng.int(1, 8) + (rng.chance(0.5) ? 0.5 : 0))
      const [i, j] = rng.sample([0, 1, 2, 3], 2) as [number, number]
      if (counts[i] === counts[j]) counts[i] = counts[i]! + 1.5
      const hi = counts[i]! > counts[j]! ? i : j
      const lo = hi === i ? j : i
      const ans = (counts[hi]! - counts[lo]!) * key
      return {
        type: 'numeric',
        prompt: `Each symbol means ${key} children. How many more children chose ${lc(labels[hi]!)} than ${lc(labels[lo]!)}?`,
        figure: {
          kind: 'pictogram',
          title: cap(s.topic),
          rows: labels.map((l, k) => ({ label: l, count: counts[k]! })),
          icon: s.icon,
          key,
          alt: `Pictogram of ${s.of(WHO4)}. Each symbol means ${key} children. ${labels.map((l, k) => `${l}: ${symCount(counts[k]!)}`).join(', ')}.`,
        },
        answer: ans,
        hints: ['Use the key to work out the number of children in each row.', 'Half a symbol is worth half as much as a whole symbol.', `Find the numbers for ${labels[hi]} and ${labels[lo]}, then subtract.`],
        explanation: `${labels[hi]}: ${symCount(counts[hi]!)}, which is ${counts[hi]! * key}. ${labels[lo]}: ${symCount(counts[lo]!)}, which is ${counts[lo]! * key}. ${counts[hi]! * key} - ${counts[lo]! * key} = ${ans}.`,
        tags: WORD,
      }
    }

    const statements = (): GeneratedItem => {
      const set = rng.pick(BAR_SETS4)
      const cats = set.cats.slice(0, 4)
      const b = rng.int(2, 5) * 5
      const others = rng.sample(range(1, 10).map((v) => v * 5).filter((v) => v !== b && v !== 2 * b && v * 2 !== b && v !== 4 * b && v * 2 !== 2 * b), 2)
      const vals = rng.shuffle([2 * b, b, ...others])
      const iA = vals.indexOf(2 * b)
      const iB = vals.indexOf(b)
      const total = vals.reduce((x, y) => x + y, 0)
      const top = vals.indexOf(Math.max(...vals))
      const notTop = [0, 1, 2, 3].filter((k) => k !== top)
      const c = rng.pick(notTop)
      const [x, y] = rng.sample([0, 1, 2, 3], 2) as [number, number]
      const figure: Fig = { kind: 'bars', title: set.title, categories: [...cats], values: vals, step: 10, yLabel: set.y, alt: `Bar chart of ${set.title.toLowerCase()}: ${cats.map((ct, k) => `${ct} ${vals[k]}`).join(', ')}.` }
      return {
        type: 'mcq',
        prompt: 'Which sentence about the bar chart is true?',
        figure,
        ...textChoice(rng, `${cats[iA]} has twice as many as ${cats[iB]}.`, [
          { value: `${cats[c]} has the most.`, why: `${cats[top]} has the most, with ${vals[top]}.` },
          { value: `The total is ${total + 10}.`, why: `Add all the bars: ${vals.join(' + ')} = ${total}.` },
          { value: `${cats[x]} and ${cats[y]} have the same.`, why: `${cats[x]} has ${vals[x]} and ${cats[y]} has ${vals[y]}.` },
        ]),
        hints: ['Read the value of every bar first.', 'Test each sentence with the numbers.', 'Twice as many means double.'],
        explanation: `${cats[iA]} has ${2 * b} and ${cats[iB]} has ${b}. ${b} × 2 = ${2 * b}, so ${cats[iA]} has twice as many as ${cats[iB]}.`,
      }
    }

    if (level === 1) return oneOf(rng, [readTable, readBar])
    if (level === 2) return picto()
    if (level === 3) return compareBars()
    if (level === 4) return oneOf(rng, [missing, whichChart])
    return oneOf(rng, [pictoDiff, statements])
  },
}

// ---------------------------------------------------------------------------
// Ss: diagram Venn dan Carroll
// ---------------------------------------------------------------------------

const NUM_RULES4: readonly NumRule[] = [
  { name: 'Multiples of 3', short: 'Multiple of 3', pred: 'a multiple of 3', predPl: 'multiples of 3', test: (n) => n % 3 === 0 },
  { name: 'Multiples of 4', short: 'Multiple of 4', pred: 'a multiple of 4', predPl: 'multiples of 4', test: (n) => n % 4 === 0 },
  { name: 'Multiples of 5', short: 'Multiple of 5', pred: 'a multiple of 5', predPl: 'multiples of 5', test: (n) => n % 5 === 0 },
  { name: 'Multiples of 6', short: 'Multiple of 6', pred: 'a multiple of 6', predPl: 'multiples of 6', test: (n) => n % 6 === 0 },
  { name: 'Even numbers', short: 'Even', pred: 'even', predPl: 'even', test: (n) => n % 2 === 0 },
  { name: 'Odd numbers', short: 'Odd', pred: 'odd', predPl: 'odd', test: (n) => n % 2 === 1 },
  { name: 'Factors of 24', short: 'Factor of 24', pred: 'a factor of 24', predPl: 'factors of 24', test: (n) => 24 % n === 0 },
  { name: 'Factors of 36', short: 'Factor of 36', pred: 'a factor of 36', predPl: 'factors of 36', test: (n) => 36 % n === 0 },
  { name: 'Factors of 30', short: 'Factor of 30', pred: 'a factor of 30', predPl: 'factors of 30', test: (n) => 30 % n === 0 },
]

const CLUBS = [
  { A: 'Likes football', B: 'Likes badminton', a: 'like football', b: 'like badminton', alsoB: 'also like badminton', both: 'like both sports', neither: 'like neither sport', onlyA: 'like football but not badminton' },
  { A: 'Can swim', B: 'Can ride a bike', a: 'can swim', b: 'can ride a bike', alsoB: 'can also ride a bike', both: 'can do both', neither: 'can do neither', onlyA: 'can swim but cannot ride a bike' },
  { A: 'Likes mango', B: 'Likes durian', a: 'like mango', b: 'like durian', alsoB: 'also like durian', both: 'like both fruits', neither: 'like neither fruit', onlyA: 'like mango but not durian' },
  { A: 'Plays chess', B: 'Plays congklak', a: 'play chess', b: 'play congklak', alsoB: 'also play congklak', both: 'play both games', neither: 'play neither game', onlyA: 'play chess but not congklak' },
] as const

const vennCarroll4: Generator = {
  skill: 'm4.venn-carroll',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const facts = (n: number, a: NumRule, b: NumRule) => `${n} is ${a.test(n) ? '' : 'not '}${a.pred} and ${b.test(n) ? '' : 'not '}${b.pred}`
    const regionText = (r: string, a: NumRule, b: NumRule) =>
      r === 'a' ? `In the ${lc(a.name)} circle only` : r === 'b' ? `In the ${lc(b.name)} circle only` : r === 'both' ? 'In both circles' : 'Outside both circles'
    const emptyVenn = (a: NumRule, b: NumRule): Fig => ({ kind: 'venn', sets: [a.name, b.name], items: [], alt: `An empty Venn diagram with circles for ${lc(a.name)} and ${lc(b.name)}.` })
    const pickN = (a: NumRule, b: NumRule, target: string, max: number): number => {
      const pool = range(1, max).filter((n) => regionOf(n, a, b) === target)
      return pool.length ? rng.pick(pool) : numbersFor(rng, a, b, [1, 1, 1, 1]).get(target)![0]!
    }

    const where = (): GeneratedItem => {
      const [a, b] = rulePair(rng, NUM_RULES4)
      const regions = ['a', 'b', 'both', 'none'] as const
      const target = rng.pick(regions)
      const n = pickN(a, b, target, 60)
      return {
        type: 'mcq',
        prompt: `A Venn diagram has two circles: ${lc(a.name)} and ${lc(b.name)}. Where does ${n} go?`,
        figure: emptyVenn(a, b),
        ...textChoice(rng, regionText(target, a, b), regions.filter((r) => r !== target).map((r) => ({ value: regionText(r, a, b), why: `Check both rules again. ${facts(n, a, b)}.` }))),
        hints: ['Test the number against each rule, one at a time.', `Is ${n} ${a.pred}? Is it ${b.pred}?`, `Start with the first rule: is ${n} ${a.pred}?`],
        explanation: `${facts(n, a, b)}, so it goes ${lc(regionText(target, a, b))}.`,
        solution: [
          { say: `Is ${n} ${a.pred}? ${a.test(n) ? 'Yes' : 'No'}.` },
          { say: `Is ${n} ${b.pred}? ${b.test(n) ? 'Yes' : 'No'}.` },
          { say: `So ${n} goes ${lc(regionText(target, a, b))}.` },
        ],
      }
    }

    const box = (): GeneratedItem => {
      const [a, b] = rulePair(rng, NUM_RULES4.filter((r) => r.short !== 'Odd'))
      const regions = ['a', 'b', 'both', 'none'] as const
      const target = rng.pick(regions)
      const n = pickN(a, b, target, 60)
      const boxText = (r: string) => {
        const inA = r === 'a' || r === 'both'
        const inB = r === 'b' || r === 'both'
        return `${inA ? cap(a.pred) : `Not ${a.pred}`} and ${inB ? b.pred : `not ${b.pred}`}`
      }
      return {
        type: 'mcq',
        prompt: `Which box of the Carroll diagram does ${n} go in?`,
        figure: { kind: 'carroll', cols: [cap(a.pred), `Not ${a.pred}`], rows: [cap(b.pred), `Not ${b.pred}`], cells: [[], [], [], []], alt: `An empty Carroll diagram. The columns are ${a.pred} and not ${a.pred}. The rows are ${b.pred} and not ${b.pred}.` },
        ...textChoice(rng, boxText(target), regions.filter((r) => r !== target).map((r) => ({ value: boxText(r), why: `${facts(n, a, b)}.` }))),
        hints: ['Each box has one rule from its column and one from its row.', `First choose the column: is ${n} ${a.pred}?`, `Then choose the row: is ${n} ${b.pred}?`],
        explanation: `${facts(n, a, b)}. So it goes in the box for ${lc(boxText(target))}.`,
      }
    }

    const sortVenn = (): GeneratedItem => {
      const [a, b] = rulePair(rng, NUM_RULES4.filter((r) => r.short !== 'Odd'))
      const map = numbersFor(rng, a, b, [2, 2, 2, 2])
      const groupOf = (r: string) => (r === 'a' ? 0 : r === 'b' ? 1 : r === 'both' ? 2 : 3)
      const groups = [`${a.short} only`, `${b.short} only`, 'Both', 'Neither']
      const items = rng.shuffle([...map.entries()].flatMap(([r, ns]) => ns.map((n) => ({ text: String(n), group: groupOf(r) }))))
      return {
        type: 'sort',
        prompt: `Sort the numbers for a Venn diagram: ${lc(a.name)} and ${lc(b.name)}.`,
        figure: emptyVenn(a, b),
        groups,
        items,
        hints: ['Test each number against both rules.', `First ask: is it ${a.pred}? Then ask: is it ${b.pred}?`, `Start with ${items[0]!.text}.`],
        explanation: groups.map((g, k) => `${g}: ${items.filter((x) => x.group === k).map((x) => x.text).join(', ')}`).join('. ') + '.',
      }
    }

    const label = (): GeneratedItem => {
      for (let t = 0; t < 20; t++) {
        const [a, b] = rulePair(rng, NUM_RULES4)
        const map = numbersFor(rng, a, b, [2, 2, 2, 2])
        const placed = [...map.entries()].flatMap(([r, ns]) => ns.map((n) => ({ n, inA: r === 'a' || r === 'both' })))
        const wrong = rng
          .shuffle(NUM_RULES4.filter((r) => r !== a && r !== b))
          .map((r) => {
            const bad = placed.find((p) => r.test(p.n) !== p.inA)
            return bad ? { value: r.name, why: bad.inA ? `${bad.n} is inside the circle, but ${bad.n} is not ${r.pred}.` : `${bad.n} is outside the circle, but ${bad.n} is ${r.pred}.` } : null
          })
          .filter((x): x is { value: string; why: string } => x !== null)
        if (wrong.length < 3) continue
        const inside = placed.filter((p) => p.inA).map((p) => p.n).sort((x, y) => x - y)
        return {
          type: 'mcq',
          prompt: 'The label for the first circle is missing. What could it be?',
          figure: {
            kind: 'venn',
            sets: ['?', b.name],
            items: [...map.entries()].flatMap(([r, ns]) => ns.map((n) => ({ text: String(n), region: r as 'a' | 'b' | 'both' | 'none' }))),
            alt: `Venn diagram. First circle, label missing. Second circle: ${lc(b.name)}. First circle only: ${map.get('a')!.join(', ')}. Second circle only: ${map.get('b')!.join(', ')}. Both: ${map.get('both')!.join(', ')}. Outside: ${map.get('none')!.join(', ')}.`,
          },
          ...textChoice(rng, a.name, wrong),
          hints: ['Look at all the numbers inside the first circle, including the overlap.', 'What do all those numbers have in common?', 'Check that no number outside the first circle fits your rule.'],
          explanation: `The numbers in the first circle are ${listAnd(inside)}. They are all ${a.predPl}, and the numbers outside it are not. So the label is ${lc(a.name)}.`,
        }
      }
      return where()
    }

    const totals = (): GeneratedItem => {
      const g = rng.pick(CLUBS)
      const both = rng.int(2, 6)
      const onlyA = rng.int(3, 9)
      const onlyB = rng.int(3, 9)
      const neither = rng.int(1, 6)
      const A = onlyA + both
      const B = onlyB + both
      const N = A + B - both + neither
      const ask = rng.int(0, 2)
      const items = [{ text: String(both), region: 'both' as const }, ...(ask === 2 ? [{ text: String(neither), region: 'none' as const }] : [])]
      const figure: Fig = { kind: 'venn', sets: [g.A, g.B], items, alt: `Venn diagram with circles for ${lc(g.A)} and ${lc(g.B)}. ${both} children are in the overlap.${ask === 2 ? ` ${neither} children are outside both circles.` : ''}` }
      if (ask === 0) {
        return {
          type: 'numeric',
          prompt: `There are ${N} children in Class 4. ${A} children ${g.a}. ${B} children ${g.b}. ${both} children ${g.both}. How many children ${g.neither}?`,
          figure,
          answer: neither,
          hints: [`The ${both} children in the overlap are counted in both groups.`, `Find how many children are inside the circles: ${A} + ${B} - ${both}.`, `Take that away from ${N}.`],
          explanation: `${A} + ${B} - ${both} = ${A + B - both} children are inside the circles. ${N} - ${A + B - both} = ${neither} children ${g.neither}.`,
          tags: WORD,
        }
      }
      if (ask === 1) {
        return {
          type: 'numeric',
          prompt: `${A} children ${g.a}. ${both} of those children ${g.alsoB}. How many children ${g.onlyA}?`,
          figure,
          answer: onlyA,
          hints: ['The overlap is for children who are in both groups.', `The ${A} children include the ${both} in the overlap.`, `Work out ${A} - ${both}.`],
          explanation: `${A} - ${both} = ${onlyA} children ${g.onlyA}.`,
          tags: WORD,
        }
      }
      return {
        type: 'numeric',
        prompt: `${A} children ${g.a}. ${B} children ${g.b}. ${both} children ${g.both}, and ${neither} ${g.neither}. How many children are in the class?`,
        figure,
        answer: N,
        hints: ['Children in the overlap are counted in both groups.', `Inside the circles: ${A} + ${B} - ${both}.`, `Then add the ${neither} outside the circles.`],
        explanation: `${A} + ${B} - ${both} = ${A + B - both}. ${A + B - both} + ${neither} = ${N} children.`,
        tags: WORD,
      }
    }

    if (level === 1) return where()
    if (level === 2) return box()
    if (level === 3) return sortVenn()
    if (level === 4) return label()
    return totals()
  },
}

// ---------------------------------------------------------------------------
// Sp: peluang
// ---------------------------------------------------------------------------

const CHANCE5 = ['Impossible', 'Unlikely', 'Even chance', 'Likely', 'Certain'] as const
type Chance5 = (typeof CHANCE5)[number]
const CHANCE5_WHY: Record<Chance5, string> = {
  Impossible: 'Impossible means it can never happen.',
  Unlikely: 'Unlikely means it could happen, but it probably will not.',
  'Even chance': 'Even chance means it is just as likely to happen as not to happen.',
  Likely: 'Likely means it will probably happen, but not for sure.',
  Certain: 'Certain means it will definitely happen.',
}

const EVENTS4: readonly { text: string; w: Chance5 }[] = [
  { text: 'A coin is flipped and lands on heads.', w: 'Even chance' },
  { text: 'A normal dice is rolled and shows an odd number.', w: 'Even chance' },
  { text: 'A normal dice is rolled and shows an even number.', w: 'Even chance' },
  { text: 'A normal dice is rolled and shows a number from 1 to 6.', w: 'Certain' },
  { text: 'A coin is flipped and lands on heads or tails.', w: 'Certain' },
  { text: 'A letter picked from A, E, I, O and U is a vowel.', w: 'Certain' },
  { text: 'A normal dice is rolled and shows 0.', w: 'Impossible' },
  { text: 'A normal dice is rolled and shows 9.', w: 'Impossible' },
  { text: 'February next year has 35 days.', w: 'Impossible' },
  { text: 'A normal dice is rolled and shows a number bigger than 1.', w: 'Likely' },
  { text: 'A normal dice is rolled and shows a number less than 6.', w: 'Likely' },
  { text: 'A normal dice is rolled and shows a 6.', w: 'Unlikely' },
  { text: 'A normal dice is rolled and shows a 1.', w: 'Unlikely' },
  { text: 'A letter picked from B, C, D, F and A is a vowel.', w: 'Unlikely' },
]

const BAG4: readonly { icon: IconName; one: string; many: string }[] = [
  { icon: 'apple', one: 'apple', many: 'apples' },
  { icon: 'pear', one: 'pear', many: 'pears' },
  { icon: 'orange', one: 'orange', many: 'oranges' },
  { icon: 'banana', one: 'banana', many: 'bananas' },
]

const DICE_OUT: readonly { t: string; k: number; nums: string }[] = [
  { t: 'roll a 7', k: 0, nums: 'none' },
  { t: 'roll a 6', k: 1, nums: '6' },
  { t: 'roll a 1 or a 2', k: 2, nums: '1 and 2' },
  { t: 'roll an even number', k: 3, nums: '2, 4 and 6' },
  { t: 'roll a number less than 5', k: 4, nums: '1, 2, 3 and 4' },
  { t: 'roll a number bigger than 1', k: 5, nums: '2, 3, 4, 5 and 6' },
  { t: 'roll a number from 1 to 6', k: 6, nums: 'all six numbers' },
]

const chance4: Generator = {
  skill: 'm4.chance',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const name = pickName(rng)
    const choice = (ans: Chance5) => textChoice(rng, ans, rng.shuffle(CHANCE5.filter((w) => w !== ans)).map((w) => ({ value: w, why: CHANCE5_WHY[w] })))
    const kindFor = (part: number, whole: number): Chance5 => (part === 0 ? 'Impossible' : part === whole ? 'Certain' : part * 2 === whole ? 'Even chance' : part * 2 > whole ? 'Likely' : 'Unlikely')

    const event = (): GeneratedItem => {
      const e = rng.pick(EVENTS4)
      return {
        type: 'mcq',
        prompt: `How likely is this? ${e.text}`,
        ...choice(e.w),
        hints: ['Think about every way it could turn out.', 'Could it never happen? Must it happen?', 'If it could happen, is it more likely, less likely, or just as likely as not?'],
        explanation: `${e.text.replace(/\.$/, '')}: this is ${lc(e.w)}. ${CHANCE5_WHY[e.w]}`,
      }
    }

    const spinner = (): GeneratedItem => {
      const parts = rng.pick([4, 6, 8, 10])
      const w = rng.pick(CHANCE5)
      const shaded = w === 'Certain' ? parts : w === 'Impossible' ? 0 : w === 'Even chance' ? parts / 2 : w === 'Likely' ? rng.int(parts / 2 + 1, parts - 1) : rng.int(1, parts / 2 - 1)
      return {
        type: 'mcq',
        prompt: 'The spinner is spun once. How likely is it to land on a shaded part?',
        figure: { kind: 'fraction', shape: 'circle', parts, shaded, alt: `A spinner with ${parts} equal parts. ${plural(shaded, 'part is', 'parts are')} shaded.` },
        ...choice(w),
        hints: ['Count the shaded parts and the white parts.', 'Are there more shaded parts, more white parts, or the same number?', `There are ${parts} parts altogether.`],
        explanation: `${shaded} out of ${parts} parts are shaded, so landing on a shaded part is ${w === 'Even chance' ? 'an even chance' : lc(w)}.`,
      }
    }

    const bag = (): GeneratedItem => {
      const [p, q] = rng.sample(BAG4, 2) as [(typeof BAG4)[number], (typeof BAG4)[number]]
      const w = rng.pick(CHANCE5)
      let a = rng.int(2, 8)
      let b = rng.int(2, 8)
      if (w === 'Even chance') b = a
      if (w === 'Likely' && b <= a) b = a + rng.int(1, 3)
      if (w === 'Unlikely' && b >= a) {
        a = Math.max(a, b) + rng.int(2, 3)
        b = rng.int(1, Math.min(3, a - 1))
      }
      const ask = w === 'Impossible' ? rng.pick(BAG4.filter((f) => f !== p && f !== q)) : q
      const items = w === 'Certain' ? [{ icon: q.icon, count: b }] : [{ icon: p.icon, count: a }, { icon: q.icon, count: b }]
      const desc = w === 'Certain' ? plural(b, q.one, q.many) : `${plural(a, p.one, p.many)} and ${plural(b, q.one, q.many)}`
      const total = w === 'Certain' ? b : a + b
      const part = w === 'Impossible' ? 0 : b
      return {
        type: 'mcq',
        prompt: `A bag has ${desc}. ${name} takes one without looking. How likely is it to be ${art(ask.one)}?`,
        figure: { kind: 'objects', items, alt: `A bag with ${desc}.` },
        ...choice(w),
        hints: ['Count each kind of fruit in the bag.', `How many ${ask.many} are there? How many other fruits?`, 'Compare the two numbers.'],
        explanation: `${part} out of ${total} fruits ${part === 1 ? 'is' : 'are'} ${part === 1 ? art(ask.one) : ask.many}, so it is ${w === 'Even chance' ? 'an even chance' : lc(w)}.`,
      }
    }

    const orderDice = (): GeneratedItem => {
      const pick = rng.sample(DICE_OUT, rng.int(4, 5))
      const sorted = [...pick].sort((x, y) => y.k - x.k)
      const ex = rng.pick(pick.filter((x) => x.k > 0 && x.k < 6))
      return {
        type: 'order',
        prompt: 'A normal dice is rolled once. Order these from most likely to least likely.',
        figure: { kind: 'solid', solid: 'cube', alt: 'A picture of a dice shaped like a cube, numbered 1 to 6.' },
        items: sorted.map((x) => x.t),
        hints: ['For each outcome, list the dice numbers that make it happen.', 'More numbers that work means more likely.', `To ${ex.t}, the numbers that work are ${ex.nums}.`],
        explanation: sorted.map((x) => `${cap(x.t)}: ${x.k} out of 6`).join('. ') + '.',
      }
    }

    const evenAdd = (): GeneratedItem => {
      if (rng.chance(0.5)) {
        const [p, q] = rng.sample(BAG4, 2) as [(typeof BAG4)[number], (typeof BAG4)[number]]
        const a = rng.int(3, 9)
        return {
          type: 'numeric',
          prompt: `A bag has ${a} ${p.many} and some ${q.many}. Taking ${art(q.one)} has an even chance. How many ${q.many} are in the bag?`,
          answer: a,
          hints: ['Even chance means both kinds are just as likely.', 'So there must be the same number of each fruit.', `Picture pairing each ${p.one} with ${art(q.one)}.`],
          explanation: `For an even chance, the number of ${q.many} must match the number of ${p.many}. There are ${a} ${p.many}, so there are ${a} ${q.many}.`,
          tags: WORD,
        }
      }
      const r = rng.int(2, 6)
      let d = rng.int(1, 5)
      if (d === r) d = d === 5 ? 4 : d + 1
      const bl = r + d
      return {
        type: 'numeric',
        prompt: `A bag has ${r} red counters and ${bl} blue counters. How many red counters must be added to make an even chance of red?`,
        answer: d,
        hints: ['Even chance means the same number of red and blue.', `How many more is ${bl} than ${r}?`, `Count on from ${r} to ${bl}.`],
        explanation: `${bl} - ${r} = ${d}. With ${d} more red counters there are ${bl} red and ${bl} blue, which is an even chance.`,
        tags: WORD,
      }
    }

    const evenSpinner = (): GeneratedItem => {
      const parts = rng.pick([6, 8])
      const others = rng.sample(range(1, parts - 1).filter((k) => k * 2 !== parts), 3)
      const fig = (k: number): Fig => ({ kind: 'fraction', shape: 'circle', parts, shaded: k, alt: `A spinner with ${parts} equal parts, ${k} shaded.` })
      return {
        type: 'mcq',
        prompt: 'Which spinner gives an even chance of landing on a shaded part?',
        ...figChoice(rng, fig(parts / 2), others.map((k) => ({ figure: fig(k), why: `${k} out of ${parts} parts are shaded. That is ${k * 2 < parts ? 'less' : 'more'} than half.` }))),
        hints: ['Even chance means half of the spinner is shaded.', `Each spinner has ${parts} parts.`, 'Look for a spinner with the same number of shaded and white parts.'],
        explanation: `${parts / 2} out of ${parts} parts is half, so that spinner gives an even chance.`,
      }
    }

    if (level === 1) return event()
    if (level === 2) return spinner()
    if (level === 3) return bag()
    if (level === 4) return orderDice()
    return oneOf(rng, [evenAdd, evenSpinner])
  },
}

void borrowFlags
void PLACE1
void art
void twoNames

/** Ikon dipakai di batch berikutnya. */
export type Icon = IconName
export type R = Rng
export type S = Step

export const generators: Generator[] = [
  placeValue4,
  compareOrder4,
  rounding4,
  negative4,
  sequences4,
  addSubMental4,
  addSubWritten4,
  timesTables4,
  factorsMultiples4,
  multiplyWritten4,
  divideWritten4,
  decimals4,
  equivalent4,
  fractionsAddSub4,
  fractionsOfAmounts4,
  moneyRupiah4,
  moneyDecimals4,
  time24,
  timetables4,
  convertUnits4,
  perimeterArea4,
  angles4,
  shapes2d4,
  shapes3d4,
  coordinates4,
  dataCharts4,
  vennCarroll4,
  chance4,
].map(withSolutions)
