import type { IconName } from '@kira/figures/spec'
import { COUNTABLES, DAYS, MONTHS, NAMES, digital, mcqFrom, numberWords, ordinal, plural, rupiah, timeWords } from './helpers'
import {
  SHAPE_INFO, SHOP_ITEMS, SOLID_INFO, THINGS, art, cap, clockFig, coinOrNote, countList, fracFig, frame, listAnd, mcqOpts,
  moneyFig, nextHour, onesText, pickName, range, seqFig, shapeFig, solidFig, tensText, twoNames,
  type Fig, type FracShape, type MoneyValue, type Opt, type ShapeKey, type Solid,
} from './g1'
import type { Generator } from './types'

/* -------------------------------------------------------------------------
 * Helper lokal Grade 2
 * ---------------------------------------------------------------------- */

const FOOD = COUNTABLES.filter((c) => ['apple', 'orange', 'banana', 'strawberry', 'cookie', 'muffin', 'sweet', 'egg'].includes(c.icon))
const SMALL = COUNTABLES.filter((c) => ['marble', 'shell', 'button', 'ball', 'crayon', 'pencil', 'book', 'star'].includes(c.icon))

/** Basetens dengan alt yang menyebut batang dan kubus. */
function tensFig(t: number, u: number): Fig {
  return { kind: 'basetens', tens: t, ones: u, alt: `${t} ten ${t === 1 ? 'rod' : 'rods'} and ${u} small ${u === 1 ? 'cube' : 'cubes'}.` }
}

/** Kata bilangan dengan atau tanpa tanda hubung, untuk jawaban teks. */
const wordForms = (n: number): string[] => [...new Set([numberWords(n), numberWords(n).replace(/-/g, ' ')])]

const signOf = (a: number, b: number): '<' | '>' | '=' => (a < b ? '<' : a > b ? '>' : '=')

/* -------------------------------------------------------------------------
 * Counting, sequences and place value
 * ---------------------------------------------------------------------- */

const numbersTo100: Generator = {
  skill: 'm2.numbers-to-100',
  levels: [1, 2, 3, 4],
  generate({ rng, level }) {
    const t = rng.int(2, 9)
    const u = rng.int(0, 9)
    const n = t * 10 + u
    if (level === 1) {
      const figure = tensFig(t, u)
      return {
        type: 'numeric',
        prompt: 'What number do the tens and ones show?',
        figure,
        answer: n,
        hints: ['Each rod is 10. Each small cube is 1.', 'Count the rods in 10s. Then count on the cubes.', `Start with the rods: 10, 20 and so on, up to ${t} rods.`],
        explanation: `${tensText(t)} and ${onesText(u)} make ${n}.`,
        solution: [
          { say: `Count the rods in 10s.`, show: countList(10, t * 10, 10), figure },
          ...(u > 0 ? [{ say: `Count on ${onesText(u)}.`, show: countList(t * 10, n) }] : []),
          { say: `The number is ${n}.`, show: `${t * 10} + ${u} = ${n}` },
        ],
      }
    }
    if (level === 2) {
      const w = numberWords(n)
      if (rng.chance(0.5)) {
        const ds: { value: number; why: string }[] = []
        if (u !== 0 && u !== t) ds.push({ value: u * 10 + t, why: `${u * 10 + t} is ${numberWords(u * 10 + t)}. The tens come first in ${w}.` })
        if (u !== 0) ds.push({ value: t * 100 + u, why: `${t * 100 + u} is ${numberWords(t * 100 + u)}. ${cap(w)} is ${t * 10} and ${u}, written ${n}.` })
        else ds.push({ value: t, why: `${t} is ${numberWords(t)}. ${cap(w)} has ${tensText(t)}.` })
        ds.push(...rng.shuffle([n + 1, n - 1, n + 10, n - 10]).map((v) => ({ value: v, why: `${v} is ${numberWords(v)}.` })))
        return {
          type: 'mcq',
          prompt: `Which number is ${w}?`,
          ...mcqFrom(rng, n, ds),
          hints: [`Say ${w} slowly.`, 'The first word tells the tens. The second word tells the ones.', `${cap(numberWords(t * 10))} means ${tensText(t)}.`],
          explanation: `${cap(w)} is ${tensText(t)} and ${onesText(u)}, so we write ${n}.`,
        }
      }
      const ds: { value: string; why: string }[] = []
      if (u !== 0 && u !== t) ds.push({ value: numberWords(u * 10 + t), why: `${cap(numberWords(u * 10 + t))} is ${u * 10 + t}. The digits are swapped.` })
      ds.push(...rng.shuffle([n + 1, n - 1, n + 10, n - 10]).map((v) => ({ value: numberWords(v), why: `${cap(numberWords(v))} is ${v}.` })))
      return {
        type: 'mcq',
        prompt: `Which word matches ${n}?`,
        ...mcqFrom(rng, w, ds),
        hints: [`Say ${n} out loud.`, `The ${t} in ${n} means ${t * 10}.`, `Find the words that start with ${numberWords(t * 10)}.`],
        explanation: `${n} is ${tensText(t)} and ${onesText(u)}, so we say ${w}.`,
      }
    }
    if (level === 3) {
      const m = rng.pick(range(21, 99).filter((x) => x % 10 !== 0))
      const w = numberWords(m)
      const mt = Math.floor(m / 10)
      if (rng.chance(0.35)) {
        return {
          type: 'numeric',
          prompt: `Type the number ${w}.`,
          answer: m,
          hints: [`Say ${w} out loud.`, 'The first word tells you the tens digit.', `${cap(numberWords(mt * 10))} means ${tensText(mt)}. Write ${mt} first.`],
          explanation: `${cap(w)} is ${tensText(mt)} and ${onesText(m % 10)}, so we write ${m}.`,
        }
      }
      return {
        type: 'text',
        prompt: `Write ${m} in words.`,
        blanks: [{ answers: wordForms(m) }],
        hints: [`Say ${m} out loud slowly.`, 'Write the tens word first, then the ones word.', `${m} has ${tensText(mt)}. ${mt * 10} is ${numberWords(mt * 10)}.`],
        explanation: `${m} is written ${w}.`,
        tip: 'Numbers like 47 have a hyphen: forty-seven.',
      }
    }
    if (rng.chance(0.5)) {
      const thing = rng.pick([
        { icon: 'sweet' as IconName, many: 'sweets', container: 'bag' as const, holder: 'bag', holders: 'bags' },
        { icon: 'pencil' as IconName, many: 'pencils', container: 'box' as const, holder: 'box', holders: 'boxes' },
        { icon: 'egg' as IconName, many: 'eggs', container: 'box' as const, holder: 'box', holders: 'boxes' },
      ])
      const tt = rng.int(2, 8)
      const uu = rng.int(1, 9)
      const total = tt * 10 + uu
      const figure: Fig = { kind: 'groups', groups: [...Array.from({ length: tt }, () => 10), uu], icon: thing.icon, container: thing.container, alt: `${tt} ${thing.holders} with 10 ${thing.many} in each and 1 ${thing.holder} with ${uu}.` }
      return {
        type: 'numeric',
        prompt: `Each full ${thing.holder} has 10 ${thing.many}. How many ${thing.many} are there?`,
        figure,
        answer: total,
        hints: ['Count the full ones in 10s.', `There are ${tt} full ${thing.holders}. Count 10, 20 and on.`, `After the full ${thing.holders}, count on the ${uu} in the last one.`],
        explanation: `${tt} tens make ${tt * 10}, and ${uu} more make ${total}.`,
        solution: [
          { say: `Count the full ${thing.holders} in 10s.`, show: countList(10, tt * 10, 10), figure },
          { say: `Count on the last ${uu}.`, show: countList(tt * 10, total) },
          { say: `There are ${total} ${thing.many}.`, show: `${tt * 10} + ${uu} = ${total}` },
        ],
      }
    }
    const name = pickName(rng)
    const tt = rng.int(3, 9)
    const uu = rng.int(1, 9)
    return {
      type: 'numeric',
      prompt: `Eggs come in trays of 10. ${name} has ${tt} trays and ${plural(uu, 'more egg', 'more eggs')}. How many eggs does ${name} have?`,
      answer: tt * 10 + uu,
      hints: ['Each tray is a ten.', `${tt} trays is ${tensText(tt)}. Count in 10s.`, `Count the trays: 10, 20 and on. Then add the ${uu}.`],
      explanation: `${tt} tens make ${tt * 10}, and ${uu} more make ${tt * 10 + uu}.`,
      tags: ['word-problem'],
    }
  },
}

const sequences: Generator = {
  skill: 'm2.sequences',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level === 1) {
      const step = rng.pick([1, 10])
      const more = rng.chance(0.5)
      const n = more ? rng.int(10, 99 - step) : rng.int(10 + step, 99)
      const ans = more ? n + step : n - step
      const tens = step === 10
      return {
        type: 'numeric',
        prompt: `What is ${step} ${more ? 'more' : 'less'} than ${n}?`,
        ...(tens ? { figure: tensFig(Math.floor(n / 10), n % 10) } : {}),
        answer: ans,
        hints: tens
          ? ['Which digit changes when you add or take 10?', `${more ? 'Adding' : 'Taking away'} 10 changes the tens digit. The ones stay the same.`, `${n} has ${tensText(Math.floor(n / 10))}. ${more ? 'Add' : 'Take away'} one ten.`]
          : [more ? '1 more is the next number when you count.' : '1 less is the number just before.', `Count ${more ? 'on' : 'back'} one from ${n}.`, more ? `Say ${n}. What comes next?` : `Count up to ${n}. What did you say just before it?`],
        explanation: tens ? `${n} has ${tensText(Math.floor(n / 10))}. ${more ? 'One more ten' : 'One less ten'} makes ${ans}.` : `${step} ${more ? 'more' : 'less'} than ${n} is ${ans}.`,
        solution: [{ say: tens ? `Change the tens digit by 1.` : `Count ${more ? 'on' : 'back'} one.`, show: `${n} ${more ? '+' : '-'} ${step} = ${ans}` }, { say: `The answer is ${ans}.`, show: String(ans) }],
      }
    }
    if (level === 2 || level === 3) {
      const up = level === 2
      const s = up ? rng.pick([2, 5, 10]) : rng.pick([2, 5, 10])
      const len = 6
      let start: number
      if (up) start = s === 5 ? rng.pick(range(0, 70, 5)) : s === 10 ? rng.int(1, 40) : rng.int(1, 80)
      else start = s === 5 ? rng.pick(range(30, 100, 5)) : s === 10 ? rng.int(55, 99) : rng.int(20, 99)
      const nums = range(0, len - 1).map((i) => start + (up ? s : -s) * i)
      if (!up && rng.chance(0.4)) {
        const rule = `Count back in ${s}s`
        const shown = nums.slice(0, 5)
        return {
          type: 'mcq',
          prompt: 'What is the rule for this pattern?',
          figure: seqFig(shown),
          ...mcqFrom(rng, rule, rng.shuffle([2, 5, 10].filter((x) => x !== s)).flatMap((x) => [
            { value: `Count back in ${x}s`, why: `${shown[0]} - ${x} is ${shown[0]! - x}, not ${shown[1]}.` },
          ]).concat([{ value: `Count on in ${s}s`, why: 'The numbers are getting smaller, so it counts back.' }])),
          hints: ['Are the numbers getting bigger or smaller?', 'Find the difference between two numbers next to each other.', `Work out ${shown[0]} - ${shown[1]}.`],
          explanation: `Each number is ${s} less than the one before, so the rule is count back in ${s}s.`,
          solution: [{ say: 'Find the jump between two numbers.', show: `${shown[0]} - ${shown[1]} = ${s}`, figure: seqFig(shown) }, { say: `Every jump is ${s} back.`, show: rule }],
        }
      }
      const gap = rng.int(1, len - 1)
      const ans = nums[gap]!
      const prev = nums[gap - 1]!
      const figure = seqFig(nums.map((v, i) => (i === gap ? null : v)))
      return {
        type: 'numeric',
        prompt: 'Which number is missing?',
        figure,
        answer: ans,
        hints: ['Are the numbers getting bigger or smaller?', `Find the jump between two numbers next to each other.`, `Look at ${prev}, the number before the gap. ${up ? 'Add' : 'Take away'} the jump.`],
        explanation: `The pattern counts ${up ? 'on' : 'back'} in ${s}s. ${prev} ${up ? '+' : '-'} ${s} = ${ans}.`,
        solution: [
          { say: `Each jump is ${s}.`, figure },
          { say: `${up ? 'Add' : 'Take away'} ${s} ${up ? 'to' : 'from'} ${prev}.`, show: `${prev} ${up ? '+' : '-'} ${s} = ${ans}` },
          { say: 'Check the whole pattern.', show: nums.join(', ') },
        ],
      }
    }
    if (level === 4) {
      const s = rng.pick([2, 5, 10])
      const jumps = rng.int(3, 5)
      const on = rng.chance(0.6)
      const min = s === 10 ? 0 : s === 5 ? 0 : 2 * rng.int(0, 20) + rng.int(0, 1)
      const max = min + s * 10
      const start = on ? min + s * rng.int(0, 10 - jumps) : min + s * rng.int(jumps, 10)
      const ans = start + (on ? s : -s) * jumps
      const js = range(0, jumps - 1).map((i) => ({ from: start + (on ? s : -s) * i, to: start + (on ? s : -s) * (i + 1) }))
      return {
        type: 'numberline',
        prompt: `Start at ${start}. Make ${jumps} jumps of ${s} ${on ? 'forwards' : 'backwards'}. Tap where you land.`,
        min,
        max,
        step: s,
        answer: ans,
        hints: [`Find ${start} first.`, `Each jump ${on ? 'adds' : 'takes away'} ${s}.`, `The first jump lands on ${start + (on ? s : -s)}. Keep going.`],
        explanation: `${jumps} jumps of ${s} from ${start} land on ${ans}: ${[start, ...js.map((j) => j.to)].join(', ')}.`,
        solution: [
          { say: `Start at ${start}.`, figure: { kind: 'numberline', min, max, step: s, labels: 'all', jumps: js, alt: `${jumps} jumps of ${s} from ${start} to ${ans}.` } },
          { say: `Count ${on ? 'on' : 'back'} in ${s}s.`, show: [start, ...js.map((j) => j.to)].join(', ') },
        ],
      }
    }
    const s = rng.pick([3, 4, 20, 25])
    const start = s >= 20 ? rng.pick([0, 5, 10]) : rng.int(1, 9)
    const nums = range(0, 4).map((i) => start + s * i)
    const ans = start + s * 5
    return {
      type: 'numeric',
      prompt: 'What number comes next?',
      figure: seqFig([...nums, null]),
      answer: ans,
      hints: ['Find how much the numbers go up each time.', `Work out ${nums[1]} - ${nums[0]}.`, `Check that the jump is the same all the way. Then add it to ${nums[4]}.`],
      explanation: `The numbers go up by ${s} each time. ${nums[4]} + ${s} = ${ans}.`,
      solution: [
        { say: 'Find the jump.', show: `${nums[1]} - ${nums[0]} = ${s}`, figure: seqFig([...nums, null]) },
        { say: `Add ${s} to the last number.`, show: `${nums[4]} + ${s} = ${ans}` },
      ],
      tags: ['olympiad'],
    }
  },
}

const oddEven2: Generator = {
  skill: 'm2.odd-even',
  levels: [1, 2, 3, 4],
  generate({ rng, level }) {
    if (level === 1) {
      const wantEven = rng.chance(0.5)
      const pool = range(10, 99)
      const target = rng.pick(pool.filter((n) => (n % 2 === 0) === wantEven))
      const others = rng.sample(pool.filter((n) => (n % 2 === 0) !== wantEven), 3)
      return {
        type: 'mcq',
        prompt: `Which number is ${wantEven ? 'even' : 'odd'}?`,
        ...mcqFrom(rng, target, others.map((o) => ({ value: o, why: `${o} ends in ${o % 10}, so it is ${wantEven ? 'odd' : 'even'}.` }))),
        hints: ['Only the ones digit matters.', 'Even numbers end in 0, 2, 4, 6 or 8. Odd numbers end in 1, 3, 5, 7 or 9.', 'Look at the last digit of each number.'],
        explanation: `${target} ends in ${target % 10}, so it is ${wantEven ? 'even' : 'odd'}.`,
      }
    }
    if (level === 2) {
      const evens = rng.sample(range(10, 98).filter((n) => n % 2 === 0), 4)
      const odds = rng.sample(range(11, 99).filter((n) => n % 2 === 1), 4)
      const items = rng.shuffle([...evens.map((n) => ({ text: String(n), group: 1 })), ...odds.map((n) => ({ text: String(n), group: 0 }))])
      return {
        type: 'sort',
        prompt: 'Sort the numbers into odd and even.',
        groups: ['Odd', 'Even'],
        items,
        hints: ['Only the ones digit matters.', 'Even numbers end in 0, 2, 4, 6 or 8.', `Start with ${items[0]!.text}. Look at its last digit.`],
        explanation: `Even: ${listAnd([...evens].sort((a, b) => a - b).map(String))}. Odd: ${listAnd([...odds].sort((a, b) => a - b).map(String))}.`,
      }
    }
    if (level === 3) {
      if (rng.chance(0.5)) {
        const kind = rng.pick(['even', 'odd'] as const)
        const n = rng.int(20, 97)
        const after = rng.chance(0.6)
        const want = kind === 'even' ? 0 : 1
        const ans = after ? ((n + 1) % 2 === want ? n + 1 : n + 2) : ((n - 1) % 2 === want ? n - 1 : n - 2)
        return {
          type: 'numeric',
          prompt: `What is the ${kind} number just ${after ? 'after' : 'before'} ${n}?`,
          answer: ans,
          hints: [`Count ${after ? 'on' : 'back'} from ${n}, one at a time.`, 'Odd and even numbers take turns.', `Say the number ${after ? 'after' : 'before'} ${n}. Is it ${kind}?`],
          explanation: Math.abs(ans - n) === 1 ? `The number just ${after ? 'after' : 'before'} ${n} is ${ans}, and ${ans} is ${kind}.` : `Counting ${after ? 'on' : 'back'} from ${n}: ${countList(after ? n + 1 : n - 1, ans)}. ${ans} is the first ${kind} number.`,
        }
      }
      const o = rng.pick(range(21, 97).filter((x) => x % 2 === 1))
      return {
        type: 'numeric',
        prompt: `Which even number is between ${o} and ${o + 2}?`,
        answer: o + 1,
        hints: [`${o} and ${o + 2} are both odd.`, 'Between two odd numbers next to each other is one even number.', `Count on one from ${o}.`],
        explanation: `${o + 1} comes between ${o} and ${o + 2}, and it ends in ${(o + 1) % 10}, so it is even.`,
      }
    }
    const d = rng.int(2, 8)
    const kind = rng.pick(['odd', 'even'] as const)
    const u = rng.pick(range(1, 9).filter((x) => (x % 2 === 0) === (kind === 'even')))
    const n = d * 10 + u
    return {
      type: 'numeric',
      prompt: `I am an ${kind} number. I am between ${d * 10} and ${d * 10 + 10}. My digits add up to ${d + u}. What number am I?`,
      answer: n,
      hints: [`List the ${kind} numbers between ${d * 10} and ${d * 10 + 10}.`, `My tens digit is ${d}. What must my ones digit be?`, `${d} + ? = ${d + u}. Work out the ones digit.`],
      explanation: `The tens digit is ${d}. ${d} + ${u} = ${d + u}, so the number is ${n}. It ends in ${u}, so it is ${kind}.`,
      solution: [
        { say: `The number is in the ${d * 10}s, so the tens digit is ${d}.` },
        { say: `The digits add up to ${d + u}.`, show: `${d} + ${u} = ${d + u}` },
        { say: `So the number is ${n}.`, show: String(n) },
      ],
      tags: ['olympiad'],
    }
  },
}

const placeValue: Generator = {
  skill: 'm2.place-value',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const t = rng.int(2, 9)
    const u = rng.pick(range(1, 9).filter((x) => x !== t))
    const n = t * 10 + u
    if (level === 1) {
      const askTens = rng.chance(0.5)
      if (rng.chance(0.4)) {
        return {
          type: 'numeric',
          prompt: `How many tens are in ${n}?`,
          figure: tensFig(t, u),
          answer: t,
          hints: ['The first digit of a 2-digit number tells the tens.', `Count the rods. Each rod is a ten.`, `${n} is between ${t * 10} and ${t * 10 + 10}.`],
          explanation: `${n} = ${t * 10} + ${u}. That is ${tensText(t)} and ${onesText(u)}.`,
        }
      }
      return {
        type: 'numeric',
        prompt: `What is the value of the ${askTens ? t : u} in ${n}?`,
        answer: askTens ? t * 10 : u,
        hints: ['Look at where the digit is.', 'The left digit is tens. The right digit is ones.', askTens ? `The ${t} is in the tens place. How many is ${t} tens?` : `The ${u} is in the ones place.`],
        explanation: askTens ? `The ${t} is in the tens place, so it is worth ${t} tens, which is ${t * 10}.` : `The ${u} is in the ones place, so it is worth ${u}.`,
        solution: [{ say: `Split ${n} into tens and ones.`, show: `${n} = ${t * 10} + ${u}`, figure: tensFig(t, u) }, { say: `The ${askTens ? t : u} is worth ${askTens ? t * 10 : u}.` }],
      }
    }
    if (level === 2) {
      const v = rng.int(0, 2)
      const prompt = v === 0 ? `${n} = ___ + ${u}` : v === 1 ? `${t * 10} + ${u} = ___` : `${n} = ${t * 10} + ___`
      const answer = v === 0 ? t * 10 : v === 1 ? n : u
      return {
        type: 'numeric',
        prompt,
        answer,
        hints: ['Split the number into tens and ones.', `The ${t} in ${n} means ${tensText(t)}.`, v === 1 ? `Put ${t} tens and ${u} ones together.` : `${n} is ${t} tens and ${onesText(u)}.`],
        explanation: `${n} is ${tensText(t)} and ${onesText(u)}, so ${n} = ${t * 10} + ${u}.`,
        solution: [{ say: `Split ${n}.`, figure: tensFig(t, u), show: `${n} = ${t * 10} + ${u}` }, { say: 'The tens and ones together make the number.' }],
      }
    }
    if (level === 3) {
      return {
        type: 'mcq',
        prompt: `Which is the same as ${n}?`,
        ...mcqFrom(rng, `${t * 10} + ${u}`, rng.shuffle([
          { value: `${t} + ${u}`, why: `The ${t} in ${n} means ${t} tens, which is ${t * 10}.` },
          { value: `${u * 10} + ${t}`, why: `That makes ${u * 10 + t}. The tens and ones are swapped.` },
          { value: `${t * 10} + ${u * 10}`, why: `That makes ${t * 10 + u * 10}. The ${u} is ones, not tens.` },
          { value: `${t * 10 + 10} + ${u}`, why: `That makes ${n + 10}.` },
        ])),
        hints: [`Split ${n} into tens and ones.`, `The ${t} is worth ${t * 10}. The ${u} is worth ${u}.`, 'Work out each option and check.'],
        explanation: `${n} is ${tensText(t)} and ${onesText(u)}, so ${n} = ${t * 10} + ${u}.`,
      }
    }
    if (level === 4) {
      const figure = tensFig(t - 1, u + 10)
      if (rng.chance(0.5)) {
        return {
          type: 'numeric',
          prompt: 'What number do these tens and ones make?',
          figure,
          answer: n,
          hints: ['Count the rods in 10s first.', `There are more than 10 cubes. 10 cubes make 1 more ten.`, `${t - 1} rods make ${(t - 1) * 10}. Then count on the ${u + 10} cubes.`],
          explanation: `${tensText(t - 1)} and ${onesText(u + 10)} is the same as ${tensText(t)} and ${onesText(u)}. That makes ${n}.`,
          solution: [
            { say: `${t - 1} rods make ${(t - 1) * 10}.`, figure },
            { say: `${u + 10} cubes are 1 ten and ${onesText(u)}.`, show: `${u + 10} = 10 + ${u}` },
            { say: `${(t - 1) * 10} + ${u + 10} = ${n}.`, show: `${(t - 1) * 10} + ${u + 10} = ${n}`, figure: tensFig(t, u) },
          ],
        }
      }
      return {
        type: 'numeric',
        prompt: `${n} is ${tensText(t - 1)} and ___ ones.`,
        answer: u + 10,
        hints: [`${n} is usually ${tensText(t)} and ${onesText(u)}.`, 'Break one ten into 10 ones.', `${tensText(t - 1)} is ${(t - 1) * 10}. How many more to make ${n}?`],
        explanation: `${n} = ${(t - 1) * 10} + ${u + 10}, so it is ${tensText(t - 1)} and ${onesText(u + 10)}.`,
        solution: [{ say: `Start with ${tensText(t)} and ${onesText(u)}.`, figure: tensFig(t, u) }, { say: 'Swap one ten for 10 ones.', show: `${n} = ${(t - 1) * 10} + ${u + 10}`, figure }],
      }
    }
    const three = rng.chance(0.5)
    const digits = rng.sample(range(0, 9), three ? 3 : 2)
    const biggest = rng.chance(0.5)
    const nonZero = digits.filter((x) => x !== 0)
    const sorted = [...digits].sort((a, b) => b - a)
    let ans: number
    if (biggest) ans = sorted[0]! * 10 + sorted[1]!
    else {
      const first = Math.min(...nonZero)
      const rest = digits.filter((x) => x !== first)
      ans = first * 10 + Math.min(...rest)
    }
    return {
      type: 'numeric',
      prompt: `Use ${three ? 'two of the digit cards' : 'the digit cards'} ${listAnd(digits.map(String))}. Make the ${biggest ? 'biggest' : 'smallest'} 2-digit number.`,
      figure: { kind: 'sequence', items: digits.map(String), style: 'boxes', alt: `Digit cards: ${listAnd(digits.map(String))}.` },
      answer: ans,
      hints: ['The tens digit matters most.', biggest ? 'Put the biggest digit in the tens place.' : 'Put the smallest digit you can in the tens place. A 2-digit number cannot start with 0.', biggest ? `The biggest digit is ${sorted[0]}. Which digit goes next to it?` : `Find the smallest digit that is not 0.`],
      explanation: biggest ? `${sorted[0]} is the biggest digit, so it goes in the tens place. Then ${sorted[1]} goes in the ones place: ${ans}.` : `${Math.floor(ans / 10)} is the smallest digit that can go first. Then ${ans % 10} goes in the ones place: ${ans}.`,
      tags: ['olympiad'],
    }
  },
}

const compareOrder2: Generator = {
  skill: 'm2.compare-order',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level === 1) {
      const a = rng.int(10, 99)
      const sameTens = rng.chance(0.4)
      const b = sameTens ? rng.pick(range(Math.floor(a / 10) * 10, Math.floor(a / 10) * 10 + 9).filter((x) => x !== a && x >= 10)) : rng.pick(range(10, 99).filter((x) => Math.floor(x / 10) !== Math.floor(a / 10)))
      const s = signOf(a, b)
      const correct = `${a} ${s} ${b}`
      const wrongSign = s === '<' ? '>' : '<'
      const ta = Math.floor(a / 10)
      const tb = Math.floor(b / 10)
      return {
        type: 'mcq',
        prompt: 'Which is true?',
        ...mcqFrom(rng, correct, [
          { value: `${a} ${wrongSign} ${b}`, why: `${a} is ${s === '<' ? 'less' : 'greater'} than ${b}, so ${wrongSign} is the wrong sign.` },
          { value: `${a} = ${b}`, why: `${a} and ${b} are different numbers.` },
          { value: `${b} ${s} ${a}`, why: `${b} is ${s === '<' ? 'greater' : 'less'} than ${a}.` },
        ]),
        hints: ['< means less than. > means greater than.', 'Compare the tens digits first.', ta === tb ? `Both numbers have ${tensText(ta)}. Compare the ones.` : `${a} has ${tensText(ta)}. ${b} has ${tensText(tb)}.`],
        explanation: ta === tb ? `Both have ${tensText(ta)}, and ${a % 10} ones is ${s === '<' ? 'less' : 'more'} than ${b % 10} ones, so ${correct}.` : `${tensText(ta)} is ${s === '<' ? 'less' : 'more'} than ${tensText(tb)}, so ${correct}.`,
        tip: 'The open side of < or > faces the bigger number.',
      }
    }
    if (level === 2) {
      const base = rng.int(12, 98)
      const pool = [...new Set([base, Number(String(base).split('').reverse().join('')), base + rng.pick([1, 2, 10, -10]), rng.int(10, 99)].filter((v) => v >= 10 && v <= 99))]
      while (pool.length < 4) {
        const v = rng.int(10, 99)
        if (!pool.includes(v)) pool.push(v)
      }
      const nums = pool.slice(0, 4)
      const greatest = rng.chance(0.5)
      const ans = greatest ? Math.max(...nums) : Math.min(...nums)
      return {
        type: 'mcq',
        prompt: `Which number is the ${greatest ? 'greatest' : 'smallest'}?`,
        ...mcqFrom(rng, ans, nums.filter((v) => v !== ans).map((v) => ({ value: v, why: greatest ? `${v} is less than ${ans}.` : `${v} is greater than ${ans}.` }))),
        hints: [greatest ? 'Greatest means the biggest.' : 'Smallest means the least.', 'Compare the tens digits first.', `If two numbers have the same tens, compare the ones.`],
        explanation: `${ans} is the ${greatest ? 'greatest' : 'smallest'}. Look at the tens: ${listAnd(nums.map((v) => `${v} has ${tensText(Math.floor(v / 10))}`))}.`,
      }
    }
    if (level === 3) {
      const count = rng.int(4, 5)
      const nums = rng.sample(range(10, 99), count)
      const up = rng.chance(0.5)
      const sorted = [...nums].sort((a, b) => (up ? a - b : b - a))
      return {
        type: 'order',
        prompt: `Put the numbers in order. Start with the ${up ? 'smallest' : 'greatest'}.`,
        items: sorted.map(String),
        hints: [`Find the ${up ? 'smallest' : 'greatest'} number first.`, 'Sort by the tens digit. Use the ones digit when the tens are the same.', `Which number has the ${up ? 'fewest' : 'most'} tens?`],
        explanation: `From ${up ? 'smallest to greatest' : 'greatest to smallest'}: ${sorted.join(', ')}.`,
      }
    }
    if (level === 4) {
      if (rng.chance(0.6)) {
        const n = rng.pick(range(12, 88).filter((x) => x % 10 !== 0 && x % 10 !== 5))
        const t = Math.floor(n / 10)
        return {
          type: 'numberline',
          prompt: `Estimate. Tap where ${n} goes on the number line.`,
          min: 0,
          max: 100,
          step: 1,
          answer: n,
          tolerance: 4,
          hints: ['The middle of the line is 50.', `${n} is ${n < 50 ? 'less' : 'more'} than 50.`, `${n} is between ${t * 10} and ${t * 10 + 10}. Find that part of the line.`],
          explanation: `${n} is between ${t * 10} and ${t * 10 + 10}, ${n % 10 < 5 ? `nearer to ${t * 10}` : `nearer to ${t * 10 + 10}`}.`,
          solution: [
            { say: `Find ${t * 10} and ${t * 10 + 10}.`, figure: { kind: 'numberline', min: 0, max: 100, step: 10, labels: 'all', marks: [{ at: n, label: String(n) }], alt: `A number line from 0 to 100 in tens, with ${n} marked between ${t * 10} and ${t * 10 + 10}.` } },
            { say: `${n} is ${n % 10} more than ${t * 10}.`, show: `${t * 10} < ${n} < ${t * 10 + 10}` },
          ],
        }
      }
      const t = rng.int(2, 9)
      const u = rng.int(1, 8)
      const n = t * 10 + u
      return {
        type: 'numeric',
        prompt: `A number has ${tensText(t)}. It is greater than ${n - 1} and less than ${n + 1}. What is the number?`,
        answer: n,
        hints: [`The number is between ${n - 1} and ${n + 1}.`, 'Only one whole number fits between them.', `Count on one from ${n - 1}.`],
        explanation: `${n} is the only number between ${n - 1} and ${n + 1}, and it has ${tensText(t)}.`,
      }
    }
    const target = rng.pick([30, 40, 50, 60, 70])
    const dists = rng.sample([1, 2, 3, 4, 6, 7, 8, 9], 4).sort((a, b) => a - b)
    const opts = dists.map((d) => target + (rng.chance(0.5) ? d : -d))
    const ans = opts[0]!
    return {
      type: 'mcq',
      prompt: `Which number is closest to ${target}?`,
      ...mcqFrom(rng, ans, opts.slice(1).map((v) => ({ value: v, why: `${v} is ${Math.abs(v - target)} away from ${target}. ${ans} is only ${Math.abs(ans - target)} away.` }))),
      hints: [`Closest means the smallest jump to ${target}.`, `Work out how far each number is from ${target}.`, `Count from ${opts[1]} to ${target}. Then try the others.`],
      explanation: `${ans} is ${dists[0]} away from ${target}. The others are further away.`,
      solution: [
        { say: `Find how far each number is from ${target}.`, show: opts.map((v) => `${v}: ${Math.abs(v - target)}`).join(', ') },
        { say: `The smallest distance is ${dists[0]}.`, show: String(ans) },
      ],
    }
  },
}

/* -------------------------------------------------------------------------
 * Addition and subtraction
 * ---------------------------------------------------------------------- */

const numberBonds: Generator = {
  skill: 'm2.number-bonds',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level === 1) {
      const a = rng.pick(range(1, 19).filter((x) => x !== 10))
      const front = rng.chance(0.5)
      return {
        type: 'numeric',
        prompt: front ? `${a} + ___ = 20` : `___ + ${a} = 20`,
        figure: frame(a, 10, `A twenty frame with ${a} of the 20 boxes filled.`),
        answer: 20 - a,
        hints: ['A full twenty frame has 20 boxes.', a < 10 ? `Use a bond to 10: ${a} + ${10 - a} = 10, then add another 10.` : `${a} is 10 and ${a - 10}. What goes with ${a - 10} to make 10?`, 'Count the empty boxes.'],
        explanation: `${a} and ${20 - a} make 20.`,
        solution: [
          { say: `${a} boxes are filled.`, figure: frame(a, 10, `A twenty frame with ${a} boxes filled.`) },
          { say: 'The empty boxes make the rest of 20.', show: front ? `${a} + ${20 - a} = 20` : `${20 - a} + ${a} = 20` },
        ],
      }
    }
    if (level === 2) {
      const a = rng.pick(range(10, 90, 10))
      return {
        type: 'numeric',
        prompt: rng.chance(0.5) ? `${a} + ___ = 100` : `100 = ${a} + ___`,
        figure: { kind: 'numberline', min: 0, max: 100, step: 10, labels: 'all', marks: [{ at: a }], alt: `A number line from 0 to 100 in tens with ${a} marked.` },
        answer: 100 - a,
        hints: ['Use a bond to 10 to help.', `${a / 10} + ${10 - a / 10} = 10, so think in tens.`, `Count on in 10s from ${a} to 100.`],
        explanation: `${tensText(a / 10)} and ${tensText(10 - a / 10)} make 10 tens, so ${a} + ${100 - a} = 100.`,
        solution: [
          { say: 'Use the bond to 10.', show: `${a / 10} + ${10 - a / 10} = 10` },
          { say: 'Now think in tens.', show: `${a} + ${100 - a} = 100` },
        ],
      }
    }
    if (level === 3) {
      const to100 = rng.chance(0.5)
      const total = to100 ? 100 : 20
      const lefts: number[] = []
      const pool = to100 ? range(10, 90, 10) : range(1, 19)
      for (const v of rng.shuffle(pool)) {
        if (lefts.length === 4) break
        if (!lefts.includes(total - v) && !lefts.includes(v)) lefts.push(v)
      }
      return {
        type: 'match',
        prompt: `Match each number to its partner to make ${total}.`,
        pairs: lefts.map((v) => [String(v), String(total - v)] as [string, string]),
        hints: [`Each pair must add up to ${total}.`, to100 ? 'Think of bonds to 10, then make them tens.' : 'Think of bonds to 10 to help.', `Start with ${lefts[0]}. What goes with it to make ${total}?`],
        explanation: `${listAnd(lefts.map((v) => `${v} + ${total - v}`))} each make ${total}.`,
      }
    }
    if (level === 4) {
      const v = rng.int(0, 2)
      const name = pickName(rng)
      if (v === 0) {
        const k = rng.int(3, 17)
        return {
          type: 'numeric',
          prompt: `A crate holds 20 mangoes. It has ${k} mangoes in it. How many more mangoes fit?`,
          answer: 20 - k,
          hints: ['Think of 20 as the full crate.', `What goes with ${k} to make 20?`, k < 10 ? `${k} + ${10 - k} = 10. Then add 10 more.` : `${k} + ${20 - k - (20 - k > 10 ? 10 : 0)} makes the next ten.`],
          explanation: `${k} + ${20 - k} = 20, so ${20 - k} more mangoes fit.`,
          tags: ['word-problem'],
        }
      }
      if (v === 1) {
        const k = rng.pick(range(10, 90, 10))
        return {
          type: 'numeric',
          prompt: `A ribbon is 100 cm long. ${name} cuts off ${k} cm. How long is the rest of the ribbon?`,
          answer: 100 - k,
          unit: 'cm',
          hints: ['The two pieces make 100 cm together.', `Think: ${k} + ? = 100.`, `Use ${k / 10} + ${10 - k / 10} = 10.`],
          explanation: `${k} + ${100 - k} = 100, so ${100 - k} cm is left.`,
          tags: ['word-problem'],
        }
      }
      const a = rng.int(1, 9)
      return {
        type: 'numeric',
        prompt: `${a} + ${10 - a} = 10. Use this to fill the gap: ${a * 10} + ___ = 100.`,
        answer: (10 - a) * 10,
        hints: ['Look at how the two number sentences are alike.', `${a * 10} is ${a} tens.`, `${a} tens and how many tens make 10 tens?`],
        explanation: `${a} + ${10 - a} = 10, so ${a} tens + ${10 - a} tens = 10 tens. ${a * 10} + ${(10 - a) * 10} = 100.`,
      }
    }
    const a = rng.pick(range(11, 89).filter((x) => x % 10 !== 0))
    const up = Math.ceil(a / 10) * 10
    return {
      type: 'numeric',
      prompt: `${a} + ___ = 100`,
      answer: 100 - a,
      hints: [`First make ${a} up to the next ten.`, `${a} + ${up - a} = ${up}. Then go from ${up} to 100.`, `${up} + ${100 - up} = 100. Add the two jumps.`],
      explanation: `${a} + ${up - a} = ${up}, and ${up} + ${100 - up} = 100. ${up - a} + ${100 - up} = ${100 - a}.`,
      solution: [
        { say: `Jump to the next ten.`, show: `${a} + ${up - a} = ${up}`, figure: { kind: 'numberline', min: Math.floor(a / 10) * 10, max: 100, step: 10, labels: 'all', jumps: [{ from: a, to: up, label: `+${up - a}` }, { from: up, to: 100, label: `+${100 - up}` }], alt: `A jump from ${a} to ${up}, then from ${up} to 100.` } },
        { say: 'Jump to 100.', show: `${up} + ${100 - up} = 100` },
        { say: 'Add the jumps.', show: `${up - a} + ${100 - up} = ${100 - a}` },
      ],
      tags: ['olympiad'],
    }
  },
}

const addition: Generator = {
  skill: 'm2.addition',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const name = pickName(rng)
    if (level === 1) {
      if (rng.chance(0.5)) {
        const aa = rng.pick(range(21, 98).filter((x) => x % 10 <= 8))
        const bb = rng.int(1, 9 - (aa % 10))
        return {
          type: 'numeric',
          prompt: `${aa} + ${bb} = ___`,
          answer: aa + bb,
          hints: ['Only the ones change here.', `Add ${bb} to the ${aa % 10} ones.`, `${aa % 10} + ${bb} = ${(aa % 10) + bb}. Keep the tens the same.`],
          explanation: `${aa % 10} + ${bb} = ${(aa % 10) + bb}, and the ${tensText(Math.floor(aa / 10))} stay the same, so ${aa} + ${bb} = ${aa + bb}.`,
          solution: [{ say: 'Add the ones.', show: `${aa % 10} + ${bb} = ${(aa % 10) + bb}` }, { say: 'Keep the tens.', show: `${aa} + ${bb} = ${aa + bb}` }],
        }
      }
      const a = rng.int(11, 69)
      const b = rng.pick(range(10, 90 - a, 10).filter((x) => x + a <= 99))
      return {
        type: 'numeric',
        prompt: `${a} + ${b} = ___`,
        figure: tensFig(Math.floor(a / 10), a % 10),
        answer: a + b,
        hints: [`Adding ${b} means adding ${tensText(b / 10)}.`, 'Only the tens digit changes.', `Count on in 10s from ${a}.`],
        explanation: `${a} + ${b}: add ${tensText(b / 10)} to ${a}. Counting on in tens gives ${a + b}.`,
        solution: [{ say: `Count on ${tensText(b / 10)} from ${a}.`, show: countList(a, a + b, 10) }, { say: `So ${a} + ${b} = ${a + b}.` }],
      }
    }
    if (level === 2) {
      const ta = rng.int(1, 7)
      const tb = rng.int(1, 8 - ta)
      const ua = rng.int(1, 8)
      const ub = rng.int(1, 9 - ua)
      const a = ta * 10 + ua
      const b = tb * 10 + ub
      return {
        type: 'numeric',
        prompt: `${a} + ${b} = ___`,
        answer: a + b,
        hints: ['Split both numbers into tens and ones.', `Add the tens: ${ta * 10} + ${tb * 10}.`, `Then add the ones: ${ua} + ${ub}.`],
        explanation: `${ta * 10} + ${tb * 10} = ${(ta + tb) * 10} and ${ua} + ${ub} = ${ua + ub}. ${(ta + tb) * 10} + ${ua + ub} = ${a + b}.`,
        solution: [
          { say: 'Add the tens.', show: `${ta * 10} + ${tb * 10} = ${(ta + tb) * 10}` },
          { say: 'Add the ones.', show: `${ua} + ${ub} = ${ua + ub}` },
          { say: 'Put them together.', show: `${(ta + tb) * 10} + ${ua + ub} = ${a + b}` },
        ],
      }
    }
    if (level === 3) {
      if (rng.chance(0.3)) {
        const a = rng.int(12, 49)
        const b = rng.pick(range(12, 49).filter((x) => x !== a && x % 10 !== Math.floor(x / 10)))
        const bRev = (b % 10) * 10 + Math.floor(b / 10)
        return {
          type: 'mcq',
          prompt: `Which has the same answer as ${a} + ${b}?`,
          ...mcqFrom(rng, `${b} + ${a}`, [
            { value: `${b} - ${a}`, why: 'Taking away gives a different answer.' },
            { value: `${a} + ${bRev}`, why: `${bRev} is not the same as ${b}.` },
            { value: `${a} + ${b + 1}`, why: `${b + 1} is 1 more than ${b}.` },
          ]),
          hints: ['Adding can be done in any order.', 'Swapping the two numbers round gives the same answer.', `Look for an option that adds ${a} and ${b} again.`],
          explanation: `Adding in any order gives the same answer, so ${a} + ${b} = ${b} + ${a}.`,
          tip: 'Start with the bigger number when you add. It is quicker.',
        }
      }
      const a = rng.pick(range(14, 88).filter((x) => x % 10 >= 4))
      const b = rng.int(10 - (a % 10) + 1, 9)
      const up = Math.ceil(a / 10) * 10
      const toTen = up - a
      const rest = b - toTen
      const figure: Fig = { kind: 'numberline', min: up - 10, max: up + 10, step: 1, labels: [up - 10, up, up + 10], jumps: [{ from: a, to: up, label: `+${toTen}` }, { from: up, to: a + b, label: `+${rest}` }], alt: `A jump from ${a} to ${up}, then a jump from ${up} to ${a + b}.` }
      return {
        type: 'numeric',
        prompt: `${a} + ${b} = ___`,
        answer: a + b,
        hints: ['Can you make the next ten first?', `Split ${b} into ${toTen} and ${rest}.`, `${a} + ${toTen} = ${up}. Now add the rest.`],
        explanation: `${a} + ${toTen} = ${up}, then ${up} + ${rest} = ${a + b}.`,
        solution: [
          { say: `Split ${b} into ${toTen} and ${rest}.`, show: `${b} = ${toTen} + ${rest}` },
          { say: `Jump to ${up}.`, show: `${a} + ${toTen} = ${up}` },
          { say: `Add the rest.`, show: `${up} + ${rest} = ${a + b}`, figure },
        ],
      }
    }
    if (level === 4) {
      const ua = rng.int(3, 9)
      const ub = rng.int(10 - ua, 9)
      const ta = rng.int(1, 6)
      const tb = rng.int(1, 8 - ta)
      const a = ta * 10 + ua
      const b = tb * 10 + ub
      const sum = a + b
      const word = rng.chance(0.5)
      const t = rng.pick(SMALL)
      return {
        type: 'numeric',
        prompt: word ? `${name} has ${a} ${t.many}. ${name} gets ${b} more. How many ${t.many} does ${name} have now?` : `${a} + ${b} = ___`,
        answer: sum,
        hints: ['Add the tens, then add the ones.', `${ta * 10} + ${tb * 10} = ${(ta + tb) * 10}. Then ${ua} + ${ub}.`, `${ua} + ${ub} is more than 10. Make a new ten.`],
        explanation: `${ta * 10} + ${tb * 10} = ${(ta + tb) * 10}, and ${ua} + ${ub} = ${ua + ub}. ${(ta + tb) * 10} + ${ua + ub} = ${sum}.`,
        solution: [
          { say: 'Add the tens.', show: `${ta * 10} + ${tb * 10} = ${(ta + tb) * 10}` },
          { say: 'Add the ones. That makes a new ten.', show: `${ua} + ${ub} = ${ua + ub}` },
          { say: 'Put them together.', show: `${(ta + tb) * 10} + ${ua + ub} = ${sum}` },
        ],
        ...(word ? { tags: ['word-problem'] } : {}),
      }
    }
    if (rng.chance(0.5)) {
      const a = rng.pick(range(15, 60).filter((x) => x % 10 !== 0))
      const s = rng.int(a + 12, 99)
      return {
        type: 'numeric',
        prompt: `${a} + ___ = ${s}`,
        answer: s - a,
        hints: [`What do you add to ${a} to make ${s}?`, `Count on from ${a}: jump in tens, then in ones.`, `Jump to the next ten after ${a} first.`],
        explanation: `From ${a} to ${s} is ${s - a}, so ${a} + ${s - a} = ${s}.`,
        solution: [
          { say: `Count on from ${a} to ${s}.`, figure: { kind: 'numberline', min: Math.floor(a / 10) * 10, max: Math.ceil(s / 10) * 10, step: 1, labels: 'ends', jumps: [{ from: a, to: s, label: `+${s - a}` }], alt: `A jump from ${a} to ${s}.` } },
          { say: `The jump is ${s - a}.`, show: `${a} + ${s - a} = ${s}` },
        ],
      }
    }
    const x = rng.pick([5, 15, 25, 35, 45])
    const z = rng.pick([5, 15, 25].filter((v) => v + x <= 60))
    const y = rng.int(11, 99 - x - z)
    const order = rng.shuffle([x, y, z])
    return {
      type: 'numeric',
      prompt: `${order.join(' + ')} = ___`,
      answer: x + y + z,
      hints: ['Look for two numbers that make a whole ten.', `${x} and ${z} both end in 5.`, `Add ${x} + ${z} first. Then add ${y}.`],
      explanation: `${x} + ${z} = ${x + z}, and ${x + z} + ${y} = ${x + y + z}.`,
      solution: [{ say: 'Add the two numbers that end in 5.', show: `${x} + ${z} = ${x + z}` }, { say: 'Add the last number.', show: `${x + z} + ${y} = ${x + y + z}` }],
      tags: ['olympiad'],
    }
  },
}

const subtraction: Generator = {
  skill: 'm2.subtraction',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level === 1) {
      if (rng.chance(0.5)) {
        const a = rng.pick(range(21, 99).filter((x) => x % 10 >= 2))
        const b = rng.int(1, a % 10)
        return {
          type: 'numeric',
          prompt: `${a} - ${b} = ___`,
          answer: a - b,
          hints: ['Only the ones change here.', `Take ${b} from the ${a % 10} ones.`, `${a % 10} - ${b} = ${(a % 10) - b}. Keep the tens the same.`],
          explanation: `${a % 10} - ${b} = ${(a % 10) - b}, and the tens stay the same, so ${a} - ${b} = ${a - b}.`,
        }
      }
      const a = rng.int(31, 99)
      const b = rng.pick(range(10, Math.floor(a / 10) * 10 - 10, 10))
      return {
        type: 'numeric',
        prompt: `${a} - ${b} = ___`,
        figure: tensFig(Math.floor(a / 10), a % 10),
        answer: a - b,
        hints: [`Taking ${b} means taking away ${tensText(b / 10)}.`, 'Only the tens digit changes.', `Count back in 10s from ${a}.`],
        explanation: `Take away ${tensText(b / 10)} from ${a}. Counting back in tens gives ${a - b}.`,
        solution: [{ say: `Count back ${tensText(b / 10)} from ${a}.`, show: countList(a, a - b, 10) }, { say: `So ${a} - ${b} = ${a - b}.` }],
      }
    }
    if (level === 2) {
      const ta = rng.int(3, 9)
      const tb = rng.int(1, ta - 1)
      const ua = rng.int(1, 9)
      const ub = rng.int(0, ua)
      const a = ta * 10 + ua
      const b = tb * 10 + ub
      return {
        type: 'numeric',
        prompt: `${a} - ${b} = ___`,
        answer: a - b,
        hints: ['Split both numbers into tens and ones.', `Take away the tens: ${ta * 10} - ${tb * 10}.`, `Then take away the ones: ${ua} - ${ub}.`],
        explanation: `${ta * 10} - ${tb * 10} = ${(ta - tb) * 10} and ${ua} - ${ub} = ${ua - ub}. Together that makes ${a - b}.`,
        solution: [
          { say: 'Take away the tens.', show: `${ta * 10} - ${tb * 10} = ${(ta - tb) * 10}` },
          { say: 'Take away the ones.', show: `${ua} - ${ub} = ${ua - ub}` },
          { say: 'Put them together.', show: `${(ta - tb) * 10} + ${ua - ub} = ${a - b}` },
        ],
      }
    }
    if (level === 3) {
      if (rng.chance(0.5)) {
        const a = rng.pick(range(21, 98).filter((x) => x % 10 <= 6 && x % 10 >= 1))
        const b = rng.int((a % 10) + 1, 9)
        const down = Math.floor(a / 10) * 10
        const first = a - down
        const rest = b - first
        const figure: Fig = { kind: 'numberline', min: down - 10, max: down + 10, step: 1, labels: [down - 10, down, down + 10], jumps: [{ from: a, to: down, label: `-${first}` }, { from: down, to: a - b, label: `-${rest}` }], alt: `A jump back from ${a} to ${down}, then a jump back from ${down} to ${a - b}.` }
        return {
          type: 'numeric',
          prompt: `${a} - ${b} = ___`,
          answer: a - b,
          hints: [`Can you jump back to ${down} first?`, `Split ${b} into ${first} and ${rest}.`, `${a} - ${first} = ${down}. Now take away the rest.`],
          explanation: `${a} - ${first} = ${down}, then ${down} - ${rest} = ${a - b}.`,
          solution: [
            { say: `Split ${b} into ${first} and ${rest}.`, show: `${b} = ${first} + ${rest}` },
            { say: `Jump back to ${down}.`, show: `${a} - ${first} = ${down}` },
            { say: 'Take away the rest.', show: `${down} - ${rest} = ${a - b}`, figure },
          ],
        }
      }
      const b = rng.int(21, 78)
      const a = rng.int(b + 3, Math.min(99, b + 19))
      const up = Math.ceil(b / 10) * 10 === b ? b + 10 : Math.ceil(b / 10) * 10
      return {
        type: 'numeric',
        prompt: `What is the difference between ${b} and ${a}?`,
        answer: a - b,
        hints: ['The difference is how far apart the numbers are.', `Count on from ${b} to ${a}.`, up < a ? `Jump from ${b} to ${up} first. Then on to ${a}.` : `Count on from ${b} one at a time.`],
        explanation: `Counting on from ${b} to ${a} is ${a - b}, so the difference is ${a - b}.`,
        solution: [
          { say: `Count on from ${b} to ${a}.`, figure: { kind: 'numberline', min: Math.floor(b / 10) * 10, max: Math.ceil(a / 10) * 10, step: 1, labels: 'ends', jumps: up < a ? [{ from: b, to: up, label: `+${up - b}` }, { from: up, to: a, label: `+${a - up}` }] : [{ from: b, to: a, label: `+${a - b}` }], alt: `Counting on from ${b} to ${a}.` } },
          { say: `The jumps add up to ${a - b}.`, show: `${a} - ${b} = ${a - b}` },
        ],
      }
    }
    if (level === 4) {
      if (rng.chance(0.4)) {
        const a = rng.int(21, 56)
        const b = rng.int(12, 99 - a)
        const s = a + b
        return {
          type: 'numeric',
          prompt: `${a} + ${b} = ${s}. Use this to work out ${s} - ${b}.`,
          answer: a,
          hints: ['Adding and taking away are linked.', `${s} is made of ${a} and ${b}.`, `If you take ${b} away from ${s}, which part is left?`],
          explanation: `${a} + ${b} = ${s}, so ${s} - ${b} = ${a}. Taking away undoes adding.`,
          tip: 'Use an addition fact to check a subtraction.',
        }
      }
      const ub = rng.int(2, 9)
      const ua = rng.int(0, ub - 1)
      const tb = rng.int(1, 6)
      const ta = rng.int(tb + 1, 9)
      const a = ta * 10 + ua
      const b = tb * 10 + ub
      const mid = a - tb * 10
      return {
        type: 'numeric',
        prompt: `${a} - ${b} = ___`,
        answer: a - b,
        hints: ['Take away the tens first, then the ones.', `${a} - ${tb * 10} = ${mid}.`, `Now take ${ub} from ${mid}. Jump back to ${Math.floor(mid / 10) * 10} first.`],
        explanation: `${a} - ${tb * 10} = ${mid}, then ${mid} - ${ub} = ${a - b}.`,
        solution: [
          { say: `Take away ${tensText(tb)}.`, show: `${a} - ${tb * 10} = ${mid}` },
          { say: `Take away ${onesText(ub)}.`, show: `${mid} - ${ub} = ${a - b}` },
          { say: 'Check by adding.', show: `${a - b} + ${b} = ${a}` },
        ],
      }
    }
    const total = rng.pick([50, 60, 70, 80, 90, 100])
    const c = rng.int(11, Math.floor(total / 2) - 2)
    const d = rng.int(5, total - c - 5)
    const left = total - c - d
    return {
      type: 'numeric',
      prompt: `A hall has ${total} chairs. ${c} children and ${d} adults sit down. How many chairs are empty?`,
      answer: left,
      hints: ['First find how many people sit down.', `${c} + ${d} people sit on chairs.`, `Work out ${c} + ${d}. Then take that from ${total}.`],
      explanation: `${c} + ${d} = ${c + d} people sit down. ${total} - ${c + d} = ${left} chairs are empty.`,
      solution: [{ say: 'Add the people.', show: `${c} + ${d} = ${c + d}` }, { say: 'Take them from the chairs.', show: `${total} - ${c + d} = ${left}` }],
      tags: ['word-problem'],
    }
  },
}

const doublesHalves: Generator = {
  skill: 'm2.doubles-halves',
  levels: [1, 2, 3, 4],
  generate({ rng, level }) {
    if (level === 1 || level === 2) {
      const half = rng.chance(0.5)
      if (half) {
        const n = level === 1 ? rng.pick(range(4, 20, 2)) : rng.pick([...range(22, 40, 2), 50, 60, 70, 80, 90, 100])
        const h = n / 2
        return {
          type: 'numeric',
          prompt: `What is half of ${n}?`,
          answer: h,
          hints: ['Half means 2 equal parts.', 'Halving is the opposite of doubling.', n % 20 === 0 ? `Think in tens. Half of ${n / 10} tens is how many tens?` : n % 10 === 0 ? `Split ${n} into ${n - 10} and 10. Halve each part.` : `Which number doubled makes ${n}?`],
          explanation: `${h} + ${h} = ${n}, so half of ${n} is ${h}.`,
          solution: n >= 20 && n % 10 !== 0 && n > 20
            ? [{ say: `Split ${n} into tens and ones.`, show: `${n} = ${Math.floor(n / 10) * 10} + ${n % 10}` }, { say: 'Halve each part.', show: `${Math.floor(n / 20) * 10 + ((Math.floor(n / 10) % 2) * 5)} + ${(n % 10) / 2}${Math.floor(n / 10) % 2 ? '' : ''} = ${h}` }]
            : [{ say: `Share ${n} into 2 equal parts.`, show: `${h} + ${h} = ${n}` }, { say: `Half of ${n} is ${h}.` }],
        }
      }
      const n = level === 1 ? rng.int(2, 10) : rng.pick([...range(11, 20), 25, 30, 35, 40, 45, 50])
      return {
        type: 'numeric',
        prompt: `What is double ${n}?`,
        answer: 2 * n,
        hints: ['Double means add the number to itself.', `Work out ${n} + ${n}.`, n % 10 === 0 ? `Think of ${n} as ${tensText(n / 10)}. Double the tens.` : n > 10 ? `Double the tens, then double the ones. Double ${Math.floor(n / 10) * 10} is ${Math.floor(n / 10) * 20}.` : `Start at ${n}. Count on ${n} more.`],
        explanation: `Double ${n} is ${n} + ${n} = ${2 * n}.`,
        solution: n > 10
          ? [{ say: 'Double the tens.', show: `${Math.floor(n / 10) * 10} + ${Math.floor(n / 10) * 10} = ${Math.floor(n / 10) * 20}` }, { say: 'Double the ones.', show: `${n % 10} + ${n % 10} = ${(n % 10) * 2}` }, { say: 'Add the two parts.', show: `${Math.floor(n / 10) * 20} + ${(n % 10) * 2} = ${2 * n}` }]
          : [{ say: `Add ${n} and ${n}.`, show: `${n} + ${n} = ${2 * n}` }, { say: `Double ${n} is ${2 * n}.` }],
      }
    }
    if (level === 3) {
      const n = rng.pick([...range(6, 20), 25, 30, 35, 40, 45, 50])
      const v = rng.int(0, 2)
      if (v === 0) {
        return {
          type: 'numeric',
          prompt: `Double ___ is ${2 * n}.`,
          answer: n,
          hints: ['Doubling and halving undo each other.', `Find half of ${2 * n}.`, `Which number added to itself makes ${2 * n}?`],
          explanation: `Half of ${2 * n} is ${n}, so double ${n} is ${2 * n}.`,
        }
      }
      if (v === 1) {
        return {
          type: 'numeric',
          prompt: `Half of ___ is ${n}.`,
          answer: 2 * n,
          hints: ['Doubling and halving undo each other.', `Double ${n}.`, `Work out ${n} + ${n}.`],
          explanation: `Double ${n} is ${2 * n}, so half of ${2 * n} is ${n}.`,
        }
      }
      return {
        type: 'mcq',
        prompt: `Double ${n} is ${2 * n}. What is half of ${2 * n}?`,
        ...mcqFrom(rng, n, [
          { value: 4 * n, why: `${4 * n} is double ${2 * n}, not half.` },
          { value: 2 * n, why: `${2 * n} is the number you start with.` },
          { value: n + 1, why: `${n + 1} + ${n + 1} is ${2 * n + 2}.` },
          { value: n - 1, why: `${n - 1} + ${n - 1} is ${2 * n - 2}.` },
        ]),
        hints: ['Halving undoes doubling.', `Which number doubles to make ${2 * n}?`, `Cut ${2 * n} into 2 equal parts.`],
        explanation: `Halving undoes doubling. Double ${n} is ${2 * n}, so half of ${2 * n} is ${n}.`,
      }
    }
    const name = pickName(rng)
    const v = rng.int(0, 2)
    if (v === 0) {
      const n = rng.pick(range(12, 40, 2))
      return {
        type: 'numeric',
        prompt: `A box has ${n} crayons. Half of them are blue. How many crayons are blue?`,
        answer: n / 2,
        hints: ['Half means 2 equal groups.', `Find half of ${n}.`, n > 20 ? `Split ${n} into ${Math.floor(n / 10) * 10} and ${n % 10}. Halve each part.` : `Which number doubled makes ${n}?`],
        explanation: `Half of ${n} is ${n / 2}, because ${n / 2} + ${n / 2} = ${n}.`,
        tags: ['word-problem'],
      }
    }
    if (v === 1) {
      const n = rng.pick([...range(11, 20), 25, 35, 45])
      return {
        type: 'numeric',
        prompt: `${name} has ${n} stickers. ${name} doubles them. How many stickers does ${name} have now?`,
        answer: 2 * n,
        hints: ['Doubling means twice as many.', `Work out ${n} + ${n}.`, `Double the tens, then double the ones.`],
        explanation: `Double ${n} is ${2 * n}.`,
        tags: ['word-problem'],
      }
    }
    const n = rng.int(11, 24)
    return {
      type: 'numeric',
      prompt: `${n} + ${n + 1} = ___`,
      answer: 2 * n + 1,
      hints: [`${n} and ${n + 1} are next to each other.`, `Use double ${n} to help.`, `Double ${n}, then add 1.`],
      explanation: `Double ${n} is ${2 * n}. ${n + 1} is 1 more than ${n}, so the answer is ${2 * n + 1}.`,
      tip: 'Near doubles: double the smaller number, then add 1.',
    }
  },
}

/* -------------------------------------------------------------------------
 * Multiplication and division
 * ---------------------------------------------------------------------- */

const GROUP_THINGS: readonly { icon: IconName; container: 'plate' | 'bag' | 'box' | 'basket' | 'circle'; holder: string; holders: string; many: string; into: string; in: string }[] = [
  { icon: 'apple', container: 'basket', holder: 'basket', holders: 'baskets', many: 'apples', into: 'into', in: 'in' },
  { icon: 'cookie', container: 'plate', holder: 'plate', holders: 'plates', many: 'cookies', into: 'onto', in: 'on' },
  { icon: 'sweet', container: 'bag', holder: 'bag', holders: 'bags', many: 'sweets', into: 'into', in: 'in' },
  { icon: 'pencil', container: 'box', holder: 'box', holders: 'boxes', many: 'pencils', into: 'into', in: 'in' },
  { icon: 'egg', container: 'box', holder: 'box', holders: 'boxes', many: 'eggs', into: 'into', in: 'in' },
  { icon: 'marble', container: 'bag', holder: 'bag', holders: 'bags', many: 'marbles', into: 'into', in: 'in' },
]

const TABLE_STORIES: readonly { s: number; text: (a: number) => string; unit: string }[] = [
  { s: 2, text: (a) => `A bicycle has 2 wheels. How many wheels do ${a} bicycles have?`, unit: 'wheels' },
  { s: 2, text: (a) => `A bird has 2 legs. How many legs do ${a} birds have?`, unit: 'legs' },
  { s: 2, text: (a) => `Socks come in pairs. How many socks are in ${a} pairs?`, unit: 'socks' },
  { s: 5, text: (a) => `A hand has 5 fingers. How many fingers are on ${a} hands?`, unit: 'fingers' },
  { s: 5, text: (a) => `A pack has 5 pencils. How many pencils are in ${a} packs?`, unit: 'pencils' },
  { s: 5, text: (a) => `A star has 5 points. How many points do ${a} stars have?`, unit: 'points' },
  { s: 10, text: (a) => `A box holds 10 eggs. How many eggs are in ${a} boxes?`, unit: 'eggs' },
  { s: 10, text: (a) => `A tray has 10 cakes. How many cakes are on ${a} trays?`, unit: 'cakes' },
]

const timesTables: Generator = {
  skill: 'm2.times-tables',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level === 1) {
      const s = rng.pick([2, 5, 10])
      const g = rng.int(3, 6)
      const thing = rng.pick(GROUP_THINGS.filter((x) => s <= 10))
      const figure: Fig = { kind: 'groups', groups: Array.from({ length: g }, () => s), icon: thing.icon, container: thing.container, alt: `${g} ${thing.holders} with ${s} ${thing.many} ${thing.in} each.` }
      if (rng.chance(0.5)) {
        return {
          type: 'mcq',
          prompt: 'Which number sentence matches the picture?',
          figure,
          ...mcqFrom(rng, `${g} × ${s}`, [
            { value: `${g} + ${s}`, why: `${g} + ${s} adds the groups and the size. It does not count every one.` },
            { value: `${g} × ${s + 1}`, why: `Each ${thing.holder} has ${s}, not ${s + 1}.` },
            { value: `${g + 1} × ${s}`, why: `Count the ${thing.holders} again. There are ${g}.` },
          ]),
          hints: [`Count the ${thing.holders}.`, `How many are in each ${thing.holder}?`, `${g} groups of ${s} is written with ×.`],
          explanation: `There are ${g} groups with ${s} in each, so the picture shows ${g} × ${s} = ${g * s}.`,
        }
      }
      return {
        type: 'numeric',
        prompt: `There are ${g} ${thing.holders} with ${s} ${thing.many} ${thing.in} each. How many ${thing.many} altogether?`,
        figure,
        answer: g * s,
        hints: ['Count in equal steps.', `Count in ${s}s, one ${thing.holder} at a time.`, `The first ${thing.holder} is ${s}. The next one makes ${2 * s}.`],
        explanation: `${g} groups of ${s} make ${g * s}. ${g} × ${s} = ${g * s}.`,
        solution: [
          { say: `There are ${g} groups of ${s}.`, figure },
          { say: `Count in ${s}s.`, show: countList(s, g * s, s) },
          { say: 'Write it as a multiplication.', show: `${g} × ${s} = ${g * s}` },
        ],
      }
    }
    if (level === 2) {
      const s = rng.pick([2, 5, 10, 2, 5, 10, 1])
      const a = rng.int(1, 10)
      const swap = rng.chance(0.4)
      return {
        type: 'numeric',
        prompt: swap ? `${s} × ${a} = ___` : `${a} × ${s} = ___`,
        answer: a * s,
        hints: [s === 1 ? 'Multiplying by 1 keeps the number the same.' : `Use the ${s} times table.`, s === 1 ? `Think of ${a} groups with 1 in each.` : `Count in ${s}s, ${a} times.`, s === 1 ? 'Count the groups.' : `Count in ${s}s on your fingers. Stop when ${a} fingers are up.`],
        explanation: `${a} × ${s} = ${a * s}. ${s === 1 ? `${a} lots of 1 is ${a}.` : `Counting in ${s}s, ${a} times, gives ${a * s}.`}`,
        solution: s === 1 ? [{ say: `${a} lots of 1.`, show: `${a} × 1 = ${a}` }, { say: 'The number stays the same.' }] : [{ say: `Count in ${s}s, ${a} times.`, show: countList(s, a * s, s) }, { say: `So the answer is ${a * s}.`, show: `${a} × ${s} = ${a * s}` }],
      }
    }
    if (level === 3) {
      const s = rng.pick([2, 5, 10])
      const a = rng.pick(range(2, 10).filter((x) => x !== s))
      if (rng.chance(0.5)) {
        return {
          type: 'numeric',
          prompt: `___ × ${s} = ${a * s}`,
          answer: a,
          hints: [`How many ${s}s make ${a * s}?`, `Count in ${s}s until you reach ${a * s}.`, 'Count how many numbers you said.'],
          explanation: `${a} × ${s} = ${a * s}. Counting in ${s}s reaches ${a * s} after ${a} steps.`,
          solution: [{ say: `Count in ${s}s to ${a * s}.`, show: countList(s, a * s, s) }, { say: `That is ${a} steps.`, show: `${a} × ${s} = ${a * s}` }],
        }
      }
      const b = s
      return {
        type: 'mcq',
        prompt: `Which is the same as ${a} × ${b}?`,
        ...mcqFrom(rng, `${b} × ${a}`, [
          { value: `${a} + ${b}`, why: `${a} + ${b} = ${a + b}, but ${a} × ${b} = ${a * b}.` },
          { value: `${a} × ${a}`, why: `${a} × ${a} = ${a * a}.` },
          { value: `${b} + ${b}`, why: `${b} + ${b} is only 2 lots of ${b}.` },
          { value: `${b} × ${a + 1}`, why: `${b} × ${a + 1} = ${b * (a + 1)}.` },
        ].filter((d) => d.value !== `${b} × ${a}`)),
        figure: { kind: 'array', rows: a, cols: b, icon: 'dot', alt: `An array of dots with ${a} rows of ${b}.` },
        hints: ['Look at the array. Count rows, then columns.', 'Turning an array round does not change how many dots.', `${a} rows of ${b} is the same as ${b} columns of ${a}.`],
        explanation: `${a} × ${b} and ${b} × ${a} both make ${a * b}. You can multiply in any order.`,
      }
    }
    if (level === 4) {
      const story = rng.pick(TABLE_STORIES)
      const a = rng.int(3, 10)
      return {
        type: 'numeric',
        prompt: story.text(a),
        answer: a * story.s,
        hints: [`Each one has ${story.s}.`, `This is ${a} lots of ${story.s}.`, `Count in ${story.s}s, ${a} times.`],
        explanation: `${a} × ${story.s} = ${a * story.s} ${story.unit}.`,
        solution: [{ say: `There are ${a} groups of ${story.s}.`, show: `${a} × ${story.s}` }, { say: `Count in ${story.s}s.`, show: `${countList(story.s, a * story.s, story.s)}` }],
        tags: ['word-problem'],
      }
    }
    const name = pickName(rng)
    const s = rng.pick([2, 5, 10])
    const g = rng.int(3, 8)
    const k = rng.int(1, s === 2 ? 1 : s - 1)
    const thing = rng.pick(GROUP_THINGS)
    return {
      type: 'numeric',
      prompt: `${name} has ${g} ${thing.holders} with ${s} ${thing.many} ${thing.in} each. ${name} also has ${plural(k, `loose ${thing.many.slice(0, -1)}`, `loose ${thing.many}`)}. How many ${thing.many} does ${name} have?`,
      answer: g * s + k,
      hints: ['First count the full groups.', `${g} × ${s} gives the ${thing.many} in the full groups.`, `Work out ${g} × ${s}. Then add the ${plural(k, 'loose one', 'loose ones')}.`],
      explanation: `${g} × ${s} = ${g * s}, and ${g * s} + ${k} = ${g * s + k}.`,
      solution: [{ say: 'Multiply for the full groups.', show: `${g} × ${s} = ${g * s}` }, { say: 'Add the loose ones.', show: `${g * s} + ${k} = ${g * s + k}` }],
      tags: ['word-problem'],
    }
  },
}

const division: Generator = {
  skill: 'm2.division',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level === 1) {
      const d = rng.int(2, 5)
      const q = rng.int(2, Math.floor(20 / d))
      const n = d * q
      const thing = rng.pick(GROUP_THINGS)
      const figure: Fig = { kind: 'objects', items: [{ icon: thing.icon, count: n }], alt: `A picture of ${n} ${thing.many}.` }
      return {
        type: 'numeric',
        prompt: `Share ${n} ${thing.many} equally ${thing.into} ${d} ${thing.holders}. How many go ${thing.in} each ${thing.holder}?`,
        figure,
        answer: q,
        hints: ['Sharing equally means every group gets the same.', `Give 1 to each of the ${d} ${thing.holders}. Keep going.`, `Share out ${d} at a time until all ${n} are gone.`],
        explanation: `${n} shared into ${d} equal groups gives ${q} in each. ${n} ÷ ${d} = ${q}.`,
        solution: [
          { say: `Share ${n} into ${d} equal groups.`, figure: { kind: 'groups', groups: Array.from({ length: d }, () => q), icon: thing.icon, container: thing.container, alt: `${d} ${thing.holders} with ${q} ${thing.many} ${thing.in} each.` } },
          { say: `Each group has ${q}.`, show: `${n} ÷ ${d} = ${q}` },
        ],
      }
    }
    if (level === 2) {
      const s = rng.pick([2, 5, 10])
      const q = rng.int(2, s === 10 ? 6 : 8)
      const n = s * q
      const figure: Fig = { kind: 'array', rows: q, cols: s, icon: 'dot', alt: `${n} dots in rows of ${s}.` }
      return {
        type: 'numeric',
        prompt: `How many groups of ${s} are in ${n}?`,
        figure,
        answer: q,
        hints: [`Make groups of ${s}.`, `Count in ${s}s until you reach ${n}.`, 'Count how many numbers you said.'],
        explanation: `Counting in ${s}s reaches ${n} after ${q} steps, so there are ${q} groups. ${n} ÷ ${s} = ${q}.`,
        solution: [{ say: `Each row is a group of ${s}.`, figure }, { say: `Count the rows: ${countList(s, n, s)}.`, show: `${n} ÷ ${s} = ${q}` }],
      }
    }
    if (level === 3) {
      const s = rng.pick([2, 5, 10])
      const q = rng.int(2, 10)
      const n = s * q
      const v = rng.int(0, 2)
      if (v === 0) {
        return {
          type: 'numeric',
          prompt: `${n} ÷ ${s} = ___`,
          answer: q,
          hints: [`Think: how many ${s}s make ${n}?`, `Use the ${s} times table.`, `___ × ${s} = ${n}. Count in ${s}s to find it.`],
          explanation: `${q} × ${s} = ${n}, so ${n} ÷ ${s} = ${q}.`,
        }
      }
      if (v === 1) {
        return {
          type: 'numeric',
          prompt: `${q} × ${s} = ${n}. What is ${n} ÷ ${s}?`,
          answer: q,
          hints: ['Division undoes multiplication.', `${n} ÷ ${s} asks how many ${s}s make ${n}.`, `Look at the multiplication again. Which number is multiplied by ${s}?`],
          explanation: `${q} × ${s} = ${n}, so ${n} ÷ ${s} = ${q}.`,
        }
      }
      return {
        type: 'numeric',
        prompt: `___ ÷ ${s} = ${q}`,
        answer: n,
        hints: ['Division and multiplication are linked.', `Which number shared into groups of ${s} makes ${q} groups?`, `Work out ${q} × ${s}.`],
        explanation: `${q} × ${s} = ${n}, so ${n} ÷ ${s} = ${q}.`,
      }
    }
    if (level === 4) {
      if (rng.chance(0.5)) {
        const s = rng.pick([2, 5, 10])
        const q = rng.int(3, 10)
        return {
          type: 'numeric',
          prompt: `${s * q} children get into teams of ${s}. How many teams are there?`,
          answer: q,
          hints: [`Each team has ${s} children.`, `How many ${s}s make ${s * q}?`, `Count in ${s}s up to ${s * q}.`],
          explanation: `${s * q} ÷ ${s} = ${q}, so there are ${q} teams.`,
          tags: ['word-problem'],
        }
      }
      const d = rng.pick([2, 5, 10])
      const q = rng.int(2, 10)
      const thing = rng.pick(GROUP_THINGS)
      return {
        type: 'numeric',
        prompt: `Share ${d * q} ${thing.many} equally ${thing.into} ${d} ${thing.holders}. How many ${thing.many} go ${thing.in} each ${thing.holder}?`,
        answer: q,
        hints: ['Sharing equally means every group gets the same.', `Think: ${d} × ? = ${d * q}.`, `Use the ${d} times table to find the missing number.`],
        explanation: `${d * q} ÷ ${d} = ${q}, so each ${thing.holder} gets ${q}.`,
        tags: ['word-problem'],
      }
    }
    const s = rng.pick([2, 5, 10])
    const q = rng.int(2, 8)
    const r = rng.int(1, s - 1)
    const n = s * q + r
    const askLeft = rng.chance(0.4)
    const thing = rng.pick(GROUP_THINGS.filter((x) => x.icon === 'sweet' || x.icon === 'marble'))
    return {
      type: 'numeric',
      prompt: askLeft ? `${n} ${thing.many} go into bags of ${s}. How many ${thing.many} are left over?` : `${n} ${thing.many} go into bags of ${s}. How many bags can be filled?`,
      figure: { kind: 'groups', groups: [...Array.from({ length: q }, () => s), r], icon: thing.icon, container: 'bag', alt: `${q} full bags of ${s} and 1 bag with ${r}.` },
      answer: askLeft ? r : q,
      hints: [`Count in ${s}s, but do not go past ${n}.`, `${q} × ${s} = ${q * s}. The next ${s} would be ${q * s + s}.`, askLeft ? `How many more is ${n} than ${q * s}?` : `${n} is between ${q * s} and ${q * s + s}.`],
      explanation: askLeft ? `${q} bags hold ${q * s}. ${n} - ${q * s} = ${r} left over.` : `${q} bags hold ${q * s}. There are not enough left to fill another bag, so ${q} bags can be filled.`,
      tags: ['word-problem', 'olympiad'],
    }
  },
}

/* -------------------------------------------------------------------------
 * Money
 * ---------------------------------------------------------------------- */

/** Pecah jumlah menjadi uang paling sedikit dengan pecahan yang ada. */
function fewestPieces(amount: number): { value: MoneyValue; count: number }[] {
  const vals: MoneyValue[] = [20000, 10000, 5000, 2000, 1000, 500, 200, 100]
  const out: { value: MoneyValue; count: number }[] = []
  let left = amount
  for (const v of vals) {
    const c = Math.floor(left / v)
    if (c > 0) {
      out.push({ value: v, count: c })
      left -= c * v
    }
  }
  return out
}

const money2: Generator = {
  skill: 'm2.money',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const name = pickName(rng)
    if (level === 1) {
      const opt = rng.pick([
        { v: 500 as MoneyValue, max: 6 },
        { v: 1000 as MoneyValue, max: 10 },
        { v: 2000 as MoneyValue, max: 9 },
        { v: 5000 as MoneyValue, max: 6 },
        { v: 10000 as MoneyValue, max: 5 },
      ])
      const k = rng.int(3, opt.max)
      const total = opt.v * k
      const figure = moneyFig([{ value: opt.v, count: k }])
      return {
        type: 'numeric',
        prompt: 'How much money is this altogether?',
        figure,
        answer: total,
        unit: 'rupiah',
        hints: [`Each ${coinOrNote(opt.v)} is ${rupiah(opt.v)}.`, `Count in steps of ${rupiah(opt.v)}.`, `Start: ${rupiah(opt.v)}, ${rupiah(opt.v * 2)}. Keep going for all ${k}.`],
        explanation: `${k} × ${rupiah(opt.v)} = ${rupiah(total)}.`,
        solution: [{ say: 'Count on for each one.', show: range(1, k).map((i) => rupiah(opt.v * i)).join(', '), figure }, { say: `That is ${rupiah(total)}.` }],
      }
    }
    if (level === 2) {
      const hundreds = rng.chance(0.35)
      const pool: MoneyValue[] = hundreds ? [500, 200, 100] : [10000, 5000, 2000, 1000]
      const vals = rng.sample(pool, rng.int(2, 3)).sort((a, b) => b - a)
      const items = vals.map((v) => ({ value: v, count: rng.int(1, hundreds ? 3 : 2) }))
      const total = items.reduce((s, it) => s + it.value * it.count, 0)
      const parts = items.flatMap((it) => Array.from({ length: it.count }, () => rupiah(it.value)))
      const figure = moneyFig(items)
      return {
        type: 'numeric',
        prompt: 'How much money is this altogether?',
        figure,
        answer: total,
        unit: 'rupiah',
        hints: ['Start with the coin or note worth the most.', hundreds ? 'Think in hundreds: Rp500 is 5 hundreds.' : 'Think in thousands: Rp5.000 is 5 thousand.', `Start at ${rupiah(items[0]!.value)} and add the next one.`],
        explanation: `${parts.join(' + ')} = ${rupiah(total)}.`,
        solution: [{ say: 'Start with the biggest.', figure }, { say: 'Add each one in turn.', show: `${parts.join(' + ')} = ${rupiah(total)}` }],
      }
    }
    if (level === 3) {
      const paid = rng.pick([5000, 10000, 20000])
      const item = rng.pick(SHOP_ITEMS.filter((s) => s.prices.some((p) => p < paid)))
      const price = rng.pick(item.prices.filter((p) => p < paid))
      const change = paid - price
      return {
        type: 'numeric',
        prompt: `${name} buys ${art(item.name)} ${item.name} for ${rupiah(price)}. ${name} pays with ${rupiah(paid)}. How much change does ${name} get?`,
        figure: moneyFig([{ value: paid as MoneyValue, count: 1 }]),
        answer: change,
        unit: 'rupiah',
        hints: ['Change is the money you get back.', `Take ${rupiah(price)} away from ${rupiah(paid)}.`, `Count on from ${price / 1000} thousand to ${paid / 1000} thousand.`],
        explanation: `${rupiah(paid)} - ${rupiah(price)} = ${rupiah(change)}.`,
        solution: [{ say: 'Count on from the price to the money paid.', show: `${price / 1000} + ${change / 1000} = ${paid / 1000}` }, { say: `The change is ${rupiah(change)}.`, show: `${rupiah(paid)} - ${rupiah(price)} = ${rupiah(change)}` }],
        tags: ['word-problem'],
      }
    }
    if (level === 4) {
      if (rng.chance(0.5)) {
        const i1 = rng.pick(SHOP_ITEMS)
        const p1 = rng.pick(i1.prices)
        const i2 = rng.pick(SHOP_ITEMS.filter((x) => x !== i1 && x.prices.some((p) => p + p1 < 20000)))
        const p2 = rng.pick(i2.prices.filter((p) => p + p1 < 20000))
        const paid = p1 + p2 < 10000 ? 10000 : 20000
        const cost = p1 + p2
        return {
          type: 'numeric',
          prompt: `${name} buys ${art(i1.name)} ${i1.name} for ${rupiah(p1)}. ${name} also buys ${art(i2.name)} ${i2.name} for ${rupiah(p2)}. ${name} pays with ${rupiah(paid)}. How much change does ${name} get?`,
          answer: paid - cost,
          unit: 'rupiah',
          hints: ['There are two steps: add, then take away.', `First find the total cost: ${rupiah(p1)} + ${rupiah(p2)}.`, `The total is ${rupiah(cost)}. Now take it away from ${rupiah(paid)}.`],
          explanation: `${rupiah(p1)} + ${rupiah(p2)} = ${rupiah(cost)}. ${rupiah(paid)} - ${rupiah(cost)} = ${rupiah(paid - cost)}.`,
          solution: [{ say: 'Add the prices.', show: `${rupiah(p1)} + ${rupiah(p2)} = ${rupiah(cost)}` }, { say: 'Find the change.', show: `${rupiah(paid)} - ${rupiah(cost)} = ${rupiah(paid - cost)}` }],
          tags: ['word-problem'],
        }
      }
      const amount = rng.pick([700, 800, 900, 1200, 1500, 1700, 2500, 3500, 6000, 7000, 8000])
      const coins = amount < 1000 || amount % 1000 !== 0
      const exact = fewestPieces(amount)
      const label = (list: { value: MoneyValue; count: number }[]) => list.flatMap((it) => Array.from({ length: it.count }, () => rupiah(it.value))).join(' + ')
      const sum = (list: { value: MoneyValue; count: number }[]) => list.reduce((s, it) => s + it.value * it.count, 0)
      const wrongs: { value: MoneyValue; count: number }[][] = coins
        ? [
            [...exact.slice(0, -1), { value: exact[exact.length - 1]!.value, count: exact[exact.length - 1]!.count + 1 }],
            exact.map((it) => ({ value: (it.value === 500 ? 200 : it.value === 200 ? 100 : it.value === 1000 ? 500 : it.value === 2000 ? 1000 : it.value) as MoneyValue, count: it.count })),
            [{ value: 1000, count: 1 }, { value: 100, count: 1 }],
          ]
        : [
            [...exact.slice(0, -1), { value: exact[exact.length - 1]!.value, count: exact[exact.length - 1]!.count + 1 }],
            exact.map((it) => ({ value: (it.value === 5000 ? 2000 : it.value === 2000 ? 1000 : it.value) as MoneyValue, count: it.count })),
            [{ value: 5000, count: 1 }, { value: 500, count: 1 }],
          ]
      const ds = wrongs.filter((w) => sum(w) !== amount).map((w) => ({ value: label(w), why: `That makes ${rupiah(sum(w))}.` }))
      while (ds.length < 3) {
        const extra = amount + 100 * (ds.length + 1)
        ds.push({ value: label(fewestPieces(extra)), why: `That makes ${rupiah(extra)}.` })
      }
      return {
        type: 'mcq',
        prompt: `Which coins and notes make ${rupiah(amount)}?`,
        ...mcqFrom(rng, label(exact), ds),
        hints: ['Add up each set.', 'Start with the coin or note worth the most.', `Add the first set. Is it ${rupiah(amount)}?`],
        explanation: `${label(exact)} = ${rupiah(amount)}.`,
      }
    }
    const amount = rng.pick([3000, 4000, 6000, 7000, 8000, 9000, 11000, 12000, 13000, 14000, 16000, 17000, 18000, 19000])
    const best = fewestPieces(amount)
    const pieces = best.reduce((s, it) => s + it.count, 0)
    return {
      type: 'numeric',
      prompt: `What is the smallest number of notes and coins that make ${rupiah(amount)}? Use Rp1.000, Rp2.000, Rp5.000, Rp10.000 and Rp20.000.`,
      answer: pieces,
      hints: ['Use the biggest notes you can.', `Start with the biggest note that is not more than ${rupiah(amount)}.`, `Take that note away. Then do the same with what is left.`],
      explanation: `${best.map((it) => (it.count === 1 ? rupiah(it.value) : `${it.count} × ${rupiah(it.value)}`)).join(' + ')} = ${rupiah(amount)}. That is ${pieces} notes and coins.`,
      solution: [{ say: 'Use the biggest notes first.', figure: moneyFig(best) }, { say: 'Count the notes and coins.', show: String(pieces) }],
      tags: ['olympiad'],
    }
  },
}

/* -------------------------------------------------------------------------
 * Fractions
 * ---------------------------------------------------------------------- */

const FRAC_SHAPES: readonly FracShape[] = ['bar', 'circle', 'square']
const FRAC_WORD: Record<string, string> = { '1/2': 'one half', '1/3': 'one third', '1/4': 'one quarter', '2/3': 'two thirds', '3/4': 'three quarters', '2/4': 'two quarters' }
const fracText = (n: number, d: number) => `${n}/${d}`

const fractionsShapes: Generator = {
  skill: 'm2.fractions-shapes',
  levels: [1, 2, 3, 4],
  generate({ rng, level }) {
    const shape = rng.pick(FRAC_SHAPES)
    if (level === 1) {
      const den = rng.pick([2, 3, 4])
      const word = FRAC_WORD[fracText(1, den)]!
      return {
        type: 'fraction',
        prompt: `Shade ${word} of the ${shape}.`,
        shape,
        parts: den,
        answer: { num: 1, den },
        hints: [`${cap(word)} is 1 of ${den} equal parts.`, `The ${shape} has ${den} equal parts.`, 'Count the parts first. Then choose how many to shade.'],
        explanation: `${cap(word)} means 1 of ${den} equal parts, so shade 1 part.`,
        solution: [{ say: `The ${shape} has ${den} equal parts.`, figure: fracFig(shape, den, 0) }, { say: 'Shade 1 part.', show: fracText(1, den), figure: fracFig(shape, den, 1) }],
      }
    }
    if (level === 2) {
      const p = rng.pick([2, 3, 4])
      const sh = rng.int(1, p - 1)
      const correct = fracText(sh, p)
      const pool = ['1/2', '1/3', '1/4', '2/3', '3/4']
      const ds = [
        { value: fracText(p - sh, p), why: `${p - sh} ${p - sh === 1 ? 'part is' : 'parts are'} white. Count the shaded parts.` },
        { value: fracText(sh, p - sh), why: 'The bottom number is all the parts, not just the white ones.' },
        ...rng.shuffle(pool).map((f) => ({ value: f, why: `${f} means ${f.split('/')[0]} of ${f.split('/')[1]} equal parts. This shape has ${p} parts.` })),
      ].filter((d) => d.value !== correct && !d.value.endsWith('/1'))
      return {
        type: 'mcq',
        prompt: 'What fraction of the shape is shaded?',
        figure: fracFig(shape, p, sh),
        ...mcqFrom(rng, correct, ds),
        hints: ['Count all the equal parts. That is the bottom number.', 'Count the shaded parts. That is the top number.', `The shape has ${p} equal parts.`],
        explanation: `${sh} of ${p} equal parts ${sh === 1 ? 'is' : 'are'} shaded, so ${correct} is shaded.`,
      }
    }
    if (level === 3) {
      if (rng.chance(0.5)) {
        const v = rng.pick([
          { num: 1, den: 2, parts: 4 }, { num: 1, den: 2, parts: 6 }, { num: 1, den: 2, parts: 8 },
          { num: 1, den: 4, parts: 8 }, { num: 1, den: 3, parts: 6 },
        ])
        const word = FRAC_WORD[fracText(v.num, v.den)]!
        const k = (v.parts * v.num) / v.den
        return {
          type: 'fraction',
          prompt: `Shade ${word} of the ${shape}. It has ${v.parts} equal parts.`,
          shape,
          parts: v.parts,
          answer: { num: v.num, den: v.den },
          hints: [`${cap(word)} means ${v.den} equal groups, and you shade 1 group.`, `Share the ${v.parts} parts into ${v.den} equal groups.`, `How many parts are in each of the ${v.den} groups?`],
          explanation: `${v.parts} parts in ${v.den} equal groups is ${k} in each group. Shading ${k} of ${v.parts} parts shows ${word}.`,
          solution: [{ say: `Share ${v.parts} parts into ${v.den} groups.`, show: `${v.parts} ÷ ${v.den} = ${k}` }, { say: `Shade ${k} parts.`, show: `${k}/${v.parts} = ${v.num}/${v.den}`, figure: fracFig(shape, v.parts, k) }],
        }
      }
      return {
        type: 'mcq',
        prompt: 'Which fraction is the same as one half?',
        ...mcqFrom(rng, '2/4', rng.shuffle([
          { value: '1/4', why: '1/4 is one quarter. That is less than a half.' },
          { value: '1/3', why: '1/3 is one third. That is less than a half.' },
          { value: '2/3', why: '2/3 is two thirds. That is more than a half.' },
          { value: '3/4', why: '3/4 is three quarters. That is more than a half.' },
        ])),
        figure: fracFig(shape, 4, 2),
        hints: ['Look at the picture. How much is shaded?', 'One half means the shaded part and the white part are the same size.', 'Count the shaded parts and all the parts.'],
        explanation: '2 of 4 equal parts are shaded. That is the same as one half, so 2/4 = 1/2.',
      }
    }
    const v = rng.int(0, 3)
    if (v === 0) {
      const f = rng.pick([{ num: 3, den: 4, parts: 4 }, { num: 2, den: 3, parts: 3 }, { num: 3, den: 4, parts: 8 }, { num: 2, den: 3, parts: 6 }])
      const word = FRAC_WORD[fracText(f.num, f.den)]!
      const k = (f.parts * f.num) / f.den
      return {
        type: 'fraction',
        prompt: `Shade ${word} of the ${shape}.${f.parts !== f.den ? ` It has ${f.parts} equal parts.` : ''}`,
        shape,
        parts: f.parts,
        answer: { num: f.num, den: f.den },
        hints: [`${cap(word)} means ${f.num} of ${f.den} equal groups.`, `Share the ${f.parts} parts into ${f.den} equal groups.`, `Find 1 group first. Then shade ${f.num} groups.`],
        explanation: `${cap(word)} of ${f.parts} parts is ${k} parts, so shade ${k}.`,
        solution: [{ say: `One group is ${f.parts / f.den} ${f.parts / f.den === 1 ? 'part' : 'parts'}.`, show: `${f.parts} ÷ ${f.den} = ${f.parts / f.den}` }, { say: `Shade ${f.num} groups.`, show: `${f.num} × ${f.parts / f.den} = ${k}`, figure: fracFig(shape, f.parts, k) }],
      }
    }
    if (v === 1) {
      const pool: Opt[] = rng.shuffle([
        { figure: fracFig(shape, 4, 1), why: 'This shows 1/4, one quarter.' },
        { figure: fracFig(shape, 4, 2), why: 'This shows 2/4, which is one half.' },
        { figure: fracFig(shape, 3, 2), why: 'This shows 2 of 3 parts. That is two thirds.' },
        { figure: fracFig(shape, 2, 1), why: 'This shows one half.' },
      ])
      return {
        type: 'mcq',
        prompt: 'Which shape has three quarters shaded?',
        ...mcqOpts(rng, { figure: fracFig(shape, 4, 3) }, pool, 4),
        hints: ['Three quarters means 3 of 4 equal parts.', 'Look for a shape with 4 equal parts.', 'Count the shaded parts in each shape with 4 parts.'],
        explanation: 'The shape with 3 of its 4 equal parts shaded shows three quarters.',
      }
    }
    if (v === 2) {
      const den = rng.pick([2, 3, 4])
      const name = den === 2 ? 'halves' : den === 3 ? 'thirds' : 'quarters'
      return {
        type: 'numeric',
        prompt: `How many ${name} make one whole?`,
        figure: fracFig(shape, den, den),
        answer: den,
        hints: [`A whole is cut into equal ${name}.`, 'Count the equal parts in the picture.', 'Every part is shaded. Count them all.'],
        explanation: `A whole cut into ${name} has ${den} equal parts, so ${den} ${name} make one whole.`,
      }
    }
    const p = rng.pick([3, 4])
    const sh = rng.int(1, p - 1)
    const white = fracText(p - sh, p)
    return {
      type: 'mcq',
      prompt: 'What fraction of the shape is not shaded?',
      figure: fracFig(shape, p, sh),
      ...mcqFrom(rng, white, rng.shuffle([
        { value: fracText(sh, p), why: `${fracText(sh, p)} is the shaded part. The question asks about the white part.` },
        { value: fracText(p - sh, sh === 0 ? 1 : sh + p - sh === p ? p + 1 : p), why: `This shape has ${p} equal parts.` },
        ...['1/2', '1/3', '2/3', '1/4', '3/4'].map((f) => ({ value: f, why: `Count the white parts and all the parts again.` })),
      ].filter((d) => d.value !== white))),
      hints: ['Not shaded means the white parts.', 'Count all the equal parts. That is the bottom number.', `There are ${p} parts. Count the white ones.`],
      explanation: `${p - sh} of ${p} parts ${p - sh === 1 ? 'is' : 'are'} white, so ${white} is not shaded.`,
    }
  },
}

const fractionsAmounts: Generator = {
  skill: 'm2.fractions-amounts',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const thing = rng.pick(FOOD)
    const groupsFig = (d: number, q: number): Fig => ({ kind: 'groups', groups: Array.from({ length: d }, () => q), icon: thing.icon, container: 'plate', alt: `${d} plates with ${plural(q, thing.one, thing.many)} on each.` })
    if (level === 1 || level === 2) {
      const d = level === 1 ? rng.pick([2, 4]) : 3
      const q = rng.int(2, level === 1 ? (d === 2 ? 10 : 5) : 6)
      const n = d * q
      const word = d === 2 ? 'half' : d === 4 ? 'a quarter' : 'one third'
      const show = rng.chance(0.5)
      return {
        type: 'numeric',
        prompt: `What is ${word} of ${n}?`,
        ...(show ? { figure: { kind: 'objects', items: [{ icon: thing.icon, count: n }], alt: `A picture of ${n} ${thing.many}.` } as Fig } : {}),
        answer: q,
        hints: [`${cap(word)} means ${d} equal groups.`, `Share ${n} into ${d} equal groups.`, d === 2 ? `Which number doubled makes ${n}?` : `Think: ${d} × ? = ${n}.`],
        explanation: `${n} shared into ${d} equal groups gives ${q} in each, so ${word} of ${n} is ${q}.`,
        solution: [{ say: `Share ${n} into ${d} equal groups.`, figure: groupsFig(d, q) }, { say: `Each group has ${q}.`, show: `${n} ÷ ${d} = ${q}` }],
      }
    }
    if (level === 3) {
      const three = rng.chance(0.6)
      const d = three ? 4 : 3
      const num = three ? 3 : 2
      const q = rng.int(2, 6)
      const n = d * q
      const word = three ? 'three quarters' : 'two thirds'
      return {
        type: 'numeric',
        prompt: `What is ${word} of ${n}?`,
        figure: groupsFig(d, q),
        answer: num * q,
        hints: [`First find ${three ? 'one quarter' : 'one third'} of ${n}.`, `Share ${n} into ${d} equal groups.`, `One group is ${q}. Now take ${num} groups.`],
        explanation: `One ${three ? 'quarter' : 'third'} of ${n} is ${q}, so ${word} is ${num} × ${q} = ${num * q}.`,
        solution: [
          { say: `Share ${n} into ${d} equal groups.`, figure: groupsFig(d, q), show: `${n} ÷ ${d} = ${q}` },
          { say: `Take ${num} of the groups.`, show: `${num} × ${q} = ${num * q}` },
        ],
      }
    }
    if (level === 4) {
      const name = pickName(rng)
      const v = rng.int(0, 2)
      if (v === 0) {
        const q = rng.int(4, 8)
        return {
          type: 'numeric',
          prompt: `There are ${4 * q} children in a class. A quarter of them walk to school. How many children walk?`,
          answer: q,
          hints: ['A quarter means 4 equal groups.', `Share ${4 * q} into 4 equal groups.`, `Halve ${4 * q}, then halve again.`],
          explanation: `Half of ${4 * q} is ${2 * q}, and half of ${2 * q} is ${q}. A quarter of ${4 * q} is ${q}.`,
          tags: ['word-problem'],
        }
      }
      if (v === 1) {
        const q = rng.int(4, 15)
        return {
          type: 'numeric',
          prompt: `${name} has ${2 * q} sweets. ${name} gives away half. How many sweets are left?`,
          answer: q,
          hints: ['Giving away half leaves the other half.', `Find half of ${2 * q}.`, `Which number doubled makes ${2 * q}?`],
          explanation: `Half of ${2 * q} is ${q}. ${name} gives away ${q}, so ${q} are left.`,
          tags: ['word-problem'],
        }
      }
      const q = rng.int(2, 7)
      return {
        type: 'numeric',
        prompt: `A baker makes ${3 * q} cakes. One third of them have cherries. How many cakes have cherries?`,
        answer: q,
        hints: ['One third means 3 equal groups.', `Share ${3 * q} into 3 equal groups.`, `Think: 3 × ? = ${3 * q}.`],
        explanation: `${3 * q} ÷ 3 = ${q}, so one third of ${3 * q} is ${q}.`,
        tags: ['word-problem'],
      }
    }
    const d = rng.pick([2, 4, 3])
    const q = rng.int(3, d === 2 ? 15 : 8)
    const word = d === 2 ? 'Half' : d === 4 ? 'A quarter' : 'One third'
    return {
      type: 'numeric',
      prompt: `${word} of a number is ${q}. What is the number?`,
      figure: { kind: 'groups', groups: Array.from({ length: d }, (_, i) => (i === 0 ? q : 0)), icon: 'dot', container: 'circle', alt: `${d} equal groups. One group has ${q}. The other groups are empty.` },
      answer: d * q,
      hints: [`The number is cut into ${d} equal groups.`, `Each group has ${q}.`, `Work out ${d} × ${q}.`],
      explanation: `${d} groups of ${q} make ${d * q}, so ${word.toLowerCase()} of ${d * q} is ${q}.`,
      tags: ['olympiad'],
    }
  },
}

/* -------------------------------------------------------------------------
 * Time
 * ---------------------------------------------------------------------- */

const tellingTime: Generator = {
  skill: 'm2.telling-time',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const h = rng.int(1, 12)
    if (level === 1) {
      const figure = clockFig(h, 15)
      return {
        type: 'mcq',
        prompt: 'What time does the clock show?',
        figure,
        ...mcqFrom(rng, `quarter past ${h}`, [
          { value: `quarter to ${h}`, why: 'At quarter to, the long hand points to 9.' },
          { value: `half past ${h}`, why: 'At half past, the long hand points to 6.' },
          { value: h === 3 ? `quarter past ${nextHour(h)}` : "3 o'clock", why: h === 3 ? `The short hand has just passed 3, not ${nextHour(h)}.` : "The long hand on 3 means 15 minutes past, not 3 o'clock." },
          { value: `quarter past ${nextHour(h)}`, why: `The short hand has just passed ${h}.` },
        ]),
        hints: ['Look at the long hand first.', 'When the long hand points to 3, it is quarter past.', 'Now look at the short hand. Which number has it just passed?'],
        explanation: `The long hand points to 3 and the short hand has just passed ${h}, so it is quarter past ${h}.`,
      }
    }
    if (level === 2) {
      if (rng.chance(0.5)) {
        const figure = clockFig(h, 45)
        const nh = nextHour(h)
        return {
          type: 'mcq',
          prompt: 'What time does the clock show?',
          figure,
          ...mcqFrom(rng, `quarter to ${nh}`, [
            { value: `quarter to ${h}`, why: `The short hand is nearly at ${nh}, so it is quarter to ${nh}.` },
            { value: `quarter past ${nh}`, why: 'At quarter past, the long hand points to 3.' },
            { value: `quarter past ${h}`, why: 'At quarter past, the long hand points to 3.' },
            { value: "9 o'clock", why: "The long hand on 9 means quarter to, not 9 o'clock." },
          ]),
          hints: ['Look at the long hand first.', 'When the long hand points to 9, it is quarter to.', 'Quarter to tells you the next hour. Which number is the short hand nearly at?'],
          explanation: `The long hand points to 9 and the short hand is nearly at ${nh}, so it is quarter to ${nh}.`,
        }
      }
      const past = rng.chance(0.5)
      const m = past ? 15 : 45
      const hh = past ? h : h
      return {
        type: 'clock',
        prompt: `Show ${timeWords(hh, m)} on the clock.`,
        answer: { h: hh, m },
        stepMinutes: 15,
        hints: past ? ['Quarter past means 15 minutes after the hour.', 'The long hand points to 3.', `The short hand is just past ${hh}.`] : ['Quarter to means 15 minutes before the next hour.', 'The long hand points to 9.', `The short hand is nearly at ${nextHour(hh)}.`],
        explanation: past ? `At quarter past ${hh}, the long hand points to 3 and the short hand is just past ${hh}.` : `At quarter to ${nextHour(hh)}, the long hand points to 9 and the short hand is nearly at ${nextHour(hh)}.`,
        solution: [{ say: `Put the long hand on ${past ? 3 : 9}.` }, { say: `Put the short hand ${past ? `just past ${hh}` : `nearly at ${nextHour(hh)}`}.`, figure: clockFig(hh, m) }],
      }
    }
    if (level === 3) {
      const m = rng.pick([0, 15, 30, 45])
      const figure = clockFig(h, m)
      const correct = digital(h, m)
      const ds = [
        { value: digital(h, m === 15 ? 45 : m === 45 ? 15 : m === 30 ? 0 : 30), why: m === 15 ? 'The long hand on 3 means 15 minutes.' : m === 45 ? 'The long hand on 9 means 45 minutes.' : m === 30 ? 'The long hand on 6 means 30 minutes.' : 'The long hand on 12 means 00 minutes.' },
        ...(m !== 0 ? [{ value: digital(h, m / 5), why: `The long hand on ${m / 5} means ${m} minutes, not ${m / 5}.` }] : [{ value: digital(h, 12), why: 'The long hand on 12 means 00 minutes, not 12.' }]),
        { value: digital(nextHour(h), m), why: `The short hand shows ${h}.` },
        { value: digital(m === 0 ? 12 : h === 12 ? 11 : h, m === 0 ? h * 5 % 60 : (m + 5) % 60), why: 'Read the long hand again.' },
      ]
      return {
        type: 'mcq',
        prompt: 'Which digital time matches the clock?',
        figure,
        ...mcqFrom(rng, correct, ds),
        hints: ['The long hand shows the minutes.', 'Each number on the clock is 5 minutes for the long hand.', `The long hand points to ${m === 0 ? 12 : m / 5}. How many minutes is that?`],
        explanation: `The short hand shows ${h} and the long hand shows ${m} minutes, so the time is ${correct}.`,
      }
    }
    if (level === 4) {
      const m = rng.pick([5, 10, 20, 25, 35, 40, 50, 55])
      if (rng.chance(0.5)) {
        return {
          type: 'clock',
          prompt: `Show ${digital(h, m)} on the clock.`,
          answer: { h, m },
          stepMinutes: 5,
          hints: ['The long hand shows the minutes.', `Count in 5s round the clock to ${m}.`, `The long hand points to ${m / 5}. The short hand is between ${h} and ${nextHour(h)}.`],
          explanation: `At ${digital(h, m)}, the long hand points to ${m / 5} (${m} minutes) and the short hand is between ${h} and ${nextHour(h)}.`,
          solution: [{ say: `Count in 5s to ${m}.`, show: countList(5, m, 5) }, { say: `Put the long hand on ${m / 5}.`, figure: clockFig(h, m) }],
        }
      }
      const figure = clockFig(h, m)
      return {
        type: 'mcq',
        prompt: 'What time does the clock show?',
        figure,
        ...mcqFrom(rng, digital(h, m), [
          { value: digital(h, m / 5), why: `The long hand on ${m / 5} means ${m} minutes.` },
          { value: digital(nextHour(h), m), why: `The short hand has not reached ${nextHour(h)} yet.` },
          { value: digital(h, (m + 5) % 60), why: 'Count in 5s round the clock again.' },
          { value: digital(h, m === 55 ? 50 : 60 - m), why: 'Count the minutes from 12 going clockwise.' },
        ]),
        hints: ['Count the minutes in 5s from 12.', `The long hand points to ${m / 5}.`, `Count ${m / 5} fives: 5, 10, 15...`],
        explanation: `The long hand points to ${m / 5}, which is ${m} minutes. The short hand is after ${h}. The time is ${digital(h, m)}.`,
      }
    }
    const m = rng.pick([35, 40, 45, 50, 55])
    const nh = nextHour(h)
    const words = timeWords(h, m)
    if (rng.chance(0.5)) {
      return {
        type: 'clock',
        prompt: `Show ${words} on the clock.`,
        answer: { h, m },
        stepMinutes: 5,
        hints: [`The word to means before ${nh} o'clock.`, `${60 - m} minutes before the hour, the long hand points to ${m / 5}.`, `The short hand is nearly at ${nh}.`],
        explanation: `${cap(words)} is ${digital(h, m)}. The long hand points to ${m / 5} and the short hand is nearly at ${nh}.`,
      }
    }
    return {
      type: 'mcq',
      prompt: `Which digital time is ${words}?`,
      ...mcqFrom(rng, digital(h, m), [
        { value: digital(nh, 60 - m), why: `That is ${60 - m} minutes past ${nh}, not ${60 - m} minutes to ${nh}.` },
        { value: digital(nh, m), why: `${nh}:${m} is after ${nh} o'clock.` },
        { value: digital(h, 60 - m), why: `${digital(h, 60 - m)} is ${60 - m} minutes past ${h}.` },
      ]),
      hints: [`${words} is before ${nh} o'clock.`, `How many minutes past ${h} is ${60 - m} minutes before ${nh}?`, `Work out 60 - ${60 - m}.`],
      explanation: `${60 - m} minutes to ${nh} is ${m} minutes past ${h}, so it is ${digital(h, m)}.`,
    }
  },
}

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const UNIT_QS: readonly { q: string; a: number; hint: string }[] = [
  { q: 'How many minutes are there in 1 hour?', a: 60, hint: 'The long hand goes all the way round in 1 hour.' },
  { q: 'How many hours are there in 1 day?', a: 24, hint: 'A day has the morning, afternoon, evening and night.' },
  { q: 'How many days are there in 1 week?', a: 7, hint: 'Say the days from Monday.' },
  { q: 'How many months are there in 1 year?', a: 12, hint: 'Say the months from January.' },
  { q: 'How many seconds are there in 1 minute?', a: 60, hint: 'A fast hand on some clocks goes round once each minute.' },
]

const ACTIVITIES: readonly { what: string; unit: 'seconds' | 'minutes' | 'hours' | 'days' }[] = [
  { what: 'blink your eyes', unit: 'seconds' },
  { what: 'clap your hands 5 times', unit: 'seconds' },
  { what: 'brush your teeth', unit: 'minutes' },
  { what: 'eat a banana', unit: 'minutes' },
  { what: 'sleep at night', unit: 'hours' },
  { what: 'fly from Jakarta to Bali', unit: 'hours' },
  { what: 'grow a bean plant', unit: 'days' },
]

const timeDurations: Generator = {
  skill: 'm2.time-durations',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const name = pickName(rng)
    if (level === 1) {
      if (rng.chance(0.5)) {
        const u = rng.pick(UNIT_QS)
        return {
          type: 'numeric',
          prompt: u.q,
          answer: u.a,
          hints: ['Think about the units of time you know.', u.hint, 'Count carefully, one at a time.'],
          explanation: `${u.q.replace('How many ', '').replace(' are there in ', ' in ').replace('?', '')}: ${u.a}.`,
        }
      }
      const act = rng.pick(ACTIVITIES)
      const order = ['seconds', 'minutes', 'hours', 'days'] as const
      const idx = order.indexOf(act.unit)
      return {
        type: 'mcq',
        prompt: `How long does it take to ${act.what}? Choose the best unit.`,
        ...mcqFrom(rng, act.unit, order.filter((x) => x !== act.unit).map((x) => ({ value: x, why: order.indexOf(x) < idx ? `${cap(x)} are too short for this.` : `${cap(x)} are too long for this.` }))),
        hints: ['Imagine doing it. Is it quick or slow?', 'Seconds are very short. Days are very long.', 'Think: could you count it, or does it take longer?'],
        explanation: `It takes some ${act.unit} to ${act.what}, so ${act.unit} is the best unit.`,
      }
    }
    if (level === 2) {
      const start = rng.int(1, 9)
      const dur = rng.int(2, 3)
      const end = start + dur
      if (rng.chance(0.5)) {
        return {
          type: 'numeric',
          prompt: `A film starts at ${start} o'clock and ends at ${end} o'clock. How many hours long is the film?`,
          figure: clockFig(start, 0),
          answer: dur,
          unit: 'hours',
          hints: ['Count the hours from the start to the end.', `Start at ${start} o'clock. Count on one hour at a time.`, `${start} o'clock to ${start + 1} o'clock is 1 hour.`],
          explanation: `From ${start} o'clock to ${end} o'clock is ${dur} hours.`,
          solution: [{ say: 'Count on in hours.', show: range(start, end).map((x) => `${x} o'clock`).join(', ') }, { say: `That is ${dur} hours.` }],
          tags: ['word-problem'],
        }
      }
      return {
        type: 'clock',
        prompt: `Football practice starts at half past ${start}. It lasts ${dur} hours. Show the time it ends.`,
        answer: { h: end, m: 30 },
        stepMinutes: 30,
        hints: [`Start at half past ${start}.`, `Add ${dur} hours. The long hand stays on 6.`, `1 hour later is half past ${start + 1}.`],
        explanation: `${dur} hours after half past ${start} is half past ${end}.`,
        tags: ['word-problem'],
      }
    }
    if (level === 3) {
      const h = rng.int(1, 11)
      const m1 = rng.pick(range(0, 40, 5))
      const m2 = rng.pick(range(m1 + 10, 55, 5))
      const dur = m2 - m1
      const what = rng.pick(['Lunch', 'Swimming', 'A maths lesson', 'Story time', 'Reading time'])
      return {
        type: 'numeric',
        prompt: `${what} starts at ${digital(h, m1)} and ends at ${digital(h, m2)}. How many minutes does it last?`,
        figure: clockFig(h, m1),
        answer: dur,
        unit: 'minutes',
        hints: ['The hour is the same, so look at the minutes.', `Count on in 5s from ${m1} to ${m2}.`, `Work out ${m2} - ${m1}.`],
        explanation: `From ${digital(h, m1)} to ${digital(h, m2)} is ${m2} - ${m1} = ${dur} minutes.`,
        solution: [{ say: `Count on in 5s from ${m1} minutes.`, show: countList(m1, m2, 5) }, { say: `That is ${dur} minutes.`, show: `${m2} - ${m1} = ${dur}` }],
        tags: ['word-problem'],
      }
    }
    if (level === 4) {
      const j = rng.int(0, 11)
      const month = MONTHS[j]!
      const days = MONTH_DAYS[j]!
      const startDow = rng.int(0, 6)
      const rows: string[][] = []
      let row: string[] = Array.from({ length: startDow }, () => '')
      for (let d = 1; d <= days; d++) {
        row.push(String(d))
        if (row.length === 7) {
          rows.push(row)
          row = []
        }
      }
      if (row.length) {
        while (row.length < 7) row.push('')
        rows.push(row)
      }
      const dowOf = (d: number) => (startDow + d - 1) % 7
      const figure: Fig = { kind: 'table', caption: month, head: DAY_SHORT, rows, alt: `A calendar for ${month}. ${month} 1st is a ${DAYS[startDow]}. ${month} has ${days} days.` }
      const v = rng.int(0, 2)
      if (v === 0) {
        const d = rng.int(2, days)
        const ans = DAYS[dowOf(d)]!
        return {
          type: 'mcq',
          prompt: `Look at the calendar. What day of the week is ${d} ${month}?`,
          figure,
          ...mcqFrom(rng, ans, rng.shuffle([1, 2, 6, 5, 3]).map((k) => DAYS[(dowOf(d) + k) % 7]!).map((x) => ({ value: x, why: `Find ${d} on the calendar. Then look up to the top of its column.` }))),
          hints: [`Find ${d} on the calendar.`, 'The day names are at the top of each column.', `Put your finger on ${d}. Move it straight up.`],
          explanation: `${d} is in the ${DAY_SHORT[dowOf(d)]} column, so ${d} ${month} is a ${ans}.`,
        }
      }
      if (v === 1) {
        const d = rng.int(1, days - 7)
        return {
          type: 'numeric',
          prompt: `What is the date one week after ${d} ${month}?`,
          figure,
          answer: d + 7,
          hints: ['One week is 7 days.', 'On a calendar, one week later is straight down one row.', `Add 7 to ${d}.`],
          explanation: `One week is 7 days. ${d} + 7 = ${d + 7}, so it is ${d + 7} ${month}.`,
        }
      }
      const target = rng.int(0, 6)
      const which = rng.int(2, 4)
      const first = ((target - startDow + 7) % 7) + 1
      const ans = first + 7 * (which - 1)
      return {
        type: 'numeric',
        prompt: `What is the date of the ${ordinal(which)} ${DAYS[target]} in ${month}?`,
        figure,
        answer: ans,
        hints: [`Find the ${DAY_SHORT[target]} column.`, `The 1st ${DAYS[target]} is the first date in that column.`, `Find the 1st ${DAYS[target]}. Then add 7 for each week after it.`],
        explanation: `The 1st ${DAYS[target]} is ${first} ${month}. Adding 7 ${which === 2 ? 'once' : which === 3 ? 'twice' : 'three times'} gives ${ans}.`,
      }
    }
    if (rng.chance(0.5)) {
      const h = rng.int(1, 11)
      const m = rng.pick([30, 40, 45, 50])
      const dur = rng.pick([20, 30, 40, 45].filter((x) => x + m > 60))
      const total = m + dur
      const eh = nextHour(h)
      const em = total - 60
      return {
        type: 'clock',
        prompt: `A bus leaves at ${digital(h, m)}. The trip takes ${dur} minutes. Show the time the bus arrives.`,
        answer: { h: eh, m: em },
        stepMinutes: 5,
        hints: [`Count on from ${digital(h, m)} to ${eh} o'clock first.`, `${digital(h, m)} to ${eh}:00 is ${60 - m} minutes.`, `Then add the other ${dur - (60 - m)} minutes.`],
        explanation: `${60 - m} minutes takes the time to ${eh}:00. ${dur - (60 - m)} more minutes makes ${digital(eh, em)}.`,
        tags: ['word-problem'],
      }
    }
    const h = rng.int(1, 10)
    const m = rng.pick([15, 30, 45])
    const endH = h + rng.int(1, 2)
    const total = (endH - h) * 60 - m
    return {
      type: 'numeric',
      prompt: `${name} plays from ${digital(h, m)} to ${endH}:00. How many minutes is that?`,
      answer: total,
      unit: 'minutes',
      hints: [`Count on from ${digital(h, m)} to the next hour.`, `Count in 5s from ${m} minutes up to 60.`, endH - h > 1 ? `Then add 60 minutes for each whole hour after ${h + 1}:00.` : 'Count how many 5s you said. Then multiply by 5.'],
      explanation: endH - h > 1 ? `${digital(h, m)} to ${h + 1}:00 is ${60 - m} minutes, and ${h + 1}:00 to ${endH}:00 is 60 minutes more. That is ${total} minutes.` : `From ${digital(h, m)} to ${endH}:00 is ${total} minutes.`,
      tags: ['word-problem', 'olympiad'],
    }
  },
}

/* -------------------------------------------------------------------------
 * Shapes, symmetry and measures
 * ---------------------------------------------------------------------- */

const G2_SHAPES: readonly ShapeKey[] = ['circle', 'semicircle', 'triangle', 'square', 'rectangle', 'pentagon', 'hexagon', 'octagon']
const vertexText = (k: number) => `${k} ${k === 1 ? 'vertex' : 'vertices'}`

const shapes2d2: Generator = {
  skill: 'm2.shapes-2d',
  levels: [1, 2, 3, 4],
  generate({ rng, level }) {
    if (level === 1) {
      const s = rng.pick(G2_SHAPES)
      const others = rng.shuffle(G2_SHAPES.filter((x) => x !== s))
      return {
        type: 'mcq',
        prompt: 'What is the name of this shape?',
        figure: shapeFig(s),
        ...mcqFrom(rng, s, others.map((x) => ({ value: x, why: SHAPE_INFO[x].about }))),
        hints: ['Count the straight sides.', 'Look for curved sides too.', 'Put your finger on one vertex and go round the shape.'],
        explanation: `This shape is ${art(s)} ${s}. ${SHAPE_INFO[s].about}`,
      }
    }
    if (level === 2) {
      const s = rng.pick<ShapeKey>(['triangle', 'square', 'rectangle', 'pentagon', 'hexagon', 'octagon'])
      const vert = rng.chance(0.5)
      const k = vert ? SHAPE_INFO[s].corners : SHAPE_INFO[s].sides
      return {
        type: 'numeric',
        prompt: vert ? 'How many vertices does this shape have?' : 'How many sides does this shape have?',
        figure: shapeFig(s),
        answer: k,
        hints: [vert ? 'A vertex is a corner, where two sides meet.' : 'A side is one straight edge.', `Count each ${vert ? 'vertex' : 'side'} once as you go round.`, 'Start at the top and go round in one direction.'],
        explanation: `${cap(art(s))} ${s} has ${k} ${vert ? 'vertices' : 'sides'}.`,
      }
    }
    if (level === 3) {
      const v = rng.int(0, 2)
      if (v === 2) {
        const others = rng.sample<ShapeKey>(['circle', 'triangle', 'square', 'hexagon', 'oval'], 3)
        return {
          type: 'mcq',
          prompt: 'Which shape has one curved side and one straight side?',
          ...mcqOpts(rng, { figure: shapeFig('semicircle') }, others.map((x) => ({ figure: shapeFig(x), why: SHAPE_INFO[x].curved ? 'This shape has no straight side.' : 'This shape has no curved side.' })), 4),
          hints: ['Look for a shape with a curve.', 'It must also have one straight edge.', 'Think of a circle cut in half.'],
          explanation: 'A semicircle has one curved side and one straight side. It is half of a circle.',
        }
      }
      const s = rng.pick<ShapeKey>(['triangle', 'square', 'pentagon', 'hexagon', 'octagon'])
      const k = v === 0 ? SHAPE_INFO[s].sides : SHAPE_INFO[s].corners
      const others = rng.shuffle(G2_SHAPES.filter((x) => (v === 0 ? SHAPE_INFO[x].sides : SHAPE_INFO[x].corners) !== k && x !== 'semicircle'))
      return {
        type: 'mcq',
        prompt: v === 0 ? `Which shape has ${k} sides?` : `Which shape has ${vertexText(k)}?`,
        ...mcqOpts(rng, { figure: shapeFig(s) }, others.map((x) => ({ figure: shapeFig(x), why: v === 0 ? `This shape has ${SHAPE_INFO[x].sides === 0 ? 'no straight' : SHAPE_INFO[x].sides} sides.` : `This shape has ${SHAPE_INFO[x].corners === 0 ? 'no' : SHAPE_INFO[x].corners} vertices.` })), 4),
        hints: [`Count the ${v === 0 ? 'sides' : 'vertices'} of each shape.`, 'Go round each shape with your finger.', 'Check the shapes one at a time.'],
        explanation: `${cap(art(s))} ${s} has ${v === 0 ? `${k} sides` : vertexText(k)}.`,
      }
    }
    const v = rng.int(0, 2)
    if (v === 0) {
      const s = rng.pick<ShapeKey>(['triangle', 'pentagon', 'hexagon', 'octagon', 'rectangle'])
      const info = SHAPE_INFO[s]
      return {
        type: 'mcq',
        prompt: `I have ${info.sides} straight sides and ${vertexText(info.corners)}.${s === 'rectangle' ? ' My opposite sides are equal.' : ''} What shape am I?`,
        ...mcqFrom(rng, s, rng.shuffle(G2_SHAPES.filter((x) => x !== s && x !== 'circle')).map((x) => ({ value: x, why: SHAPE_INFO[x].about }))),
        hints: ['Use the number of sides.', 'Shape names often tell the number of sides: penta is 5, hexa is 6, octa is 8.', `Which shape has exactly ${info.sides} sides?`],
        explanation: `${cap(art(s))} ${s} has ${info.sides} sides and ${vertexText(info.corners)}.`,
      }
    }
    if (v === 1) {
      const items = rng.sample<ShapeKey>(['triangle', 'square', 'rectangle', 'pentagon', 'hexagon'], rng.int(2, 3))
      const total = items.reduce((s, x) => s + SHAPE_INFO[x].sides, 0)
      return {
        type: 'numeric',
        prompt: 'How many sides are there altogether?',
        figure: { kind: 'shapes', items: items.map((x) => ({ shape: x })), alt: `Shapes: ${listAnd(items.map((x) => `${art(x)} ${x} with ${SHAPE_INFO[x].sides} sides`))}.` },
        answer: total,
        hints: ['Count the sides of each shape.', 'Write down the number for each shape.', 'Add the numbers together.'],
        explanation: `${items.map((x) => SHAPE_INFO[x].sides).join(' + ')} = ${total} sides.`,
        solution: [{ say: 'Count the sides of each shape.', show: items.map((x) => `${x}: ${SHAPE_INFO[x].sides}`).join(', ') }, { say: 'Add them up.', show: `${items.map((x) => SHAPE_INFO[x].sides).join(' + ')} = ${total}` }],
        tags: ['olympiad'],
      }
    }
    return {
      type: 'text',
      prompt: 'Every point on a circle is the same distance from its ___.',
      figure: { kind: 'shape', shape: 'circle', sideLabels: ['3 cm'], alt: 'A circle with a dot in the middle and a line 3 cm long from the dot to the edge.' },
      blanks: [{ answers: ['centre', 'center'] }],
      hints: ['Look at the dot in the picture.', 'The line goes from the dot to the edge.', 'It is the point in the middle. Its name starts with c.'],
      explanation: 'The middle point of a circle is its centre. Every point on the circle is the same distance from it.',
    }
  },
}

const G2_SOLIDS: readonly Solid[] = ['cube', 'cuboid', 'sphere', 'cylinder', 'cone', 'square-pyramid', 'triangular-prism']
const POLY: readonly Solid[] = ['cube', 'cuboid', 'square-pyramid', 'triangular-prism']

const shapes3d2: Generator = {
  skill: 'm2.shapes-3d',
  levels: [1, 2, 3, 4],
  generate({ rng, level }) {
    if (level === 1) {
      const s = rng.pick(G2_SOLIDS)
      return {
        type: 'mcq',
        prompt: 'What is the name of this 3D shape?',
        figure: solidFig(s),
        ...mcqFrom(rng, SOLID_INFO[s].name, rng.shuffle(G2_SOLIDS.filter((x) => x !== s)).map((x) => ({ value: SOLID_INFO[x].name, why: SOLID_INFO[x].about }))),
        hints: ['Look at the shape of each face.', 'Are there curved faces, or only flat ones?', 'Look at the bottom face first.'],
        explanation: `This is ${art(SOLID_INFO[s].name)} ${SOLID_INFO[s].name}. ${SOLID_INFO[s].about}`,
      }
    }
    if (level === 2) {
      if (rng.chance(0.75)) {
        const s = rng.pick(POLY)
        const what = rng.pick(['faces', 'edges', 'vertices'] as const)
        const info = SOLID_INFO[s]
        const ans = what === 'faces' ? info.flat : what === 'edges' ? info.edges : info.vertices
        return {
          type: 'numeric',
          prompt: `How many ${what} does ${art(info.name)} ${info.name} have?`,
          figure: solidFig(s),
          answer: ans,
          hints: [what === 'faces' ? 'A face is a flat surface.' : what === 'edges' ? 'An edge is where two faces meet.' : 'A vertex is a corner where edges meet.', 'Remember to count the ones you cannot see at the back.', what === 'faces' ? 'Count the top, the bottom and the sides.' : what === 'edges' ? 'Count the edges round the bottom first.' : 'Count the vertices at the bottom first.'],
          explanation: `${cap(art(info.name))} ${info.name} has ${info.flat} faces, ${info.edges} edges and ${info.vertices} vertices.`,
        }
      }
      const s = rng.pick<Solid>(['cylinder', 'cone', 'sphere'])
      const info = SOLID_INFO[s]
      return {
        type: 'numeric',
        prompt: `How many flat faces does ${art(info.name)} ${info.name} have?`,
        figure: solidFig(s),
        answer: info.flat,
        hints: ['A flat face could sit on a table.', 'Curved faces do not count here.', s === 'sphere' ? 'Is any part of it flat?' : 'Look at the ends of the shape.'],
        explanation: info.about,
      }
    }
    if (level === 3) {
      const q = rng.pick([
        { text: 'What shape are the faces of a cube?', ans: 'square', fig: 'cube' as Solid },
        { text: 'What shape are the flat faces of a cylinder?', ans: 'circle', fig: 'cylinder' as Solid },
        { text: 'What shape is the flat face of a cone?', ans: 'circle', fig: 'cone' as Solid },
        { text: 'What shape is the base of a square-based pyramid?', ans: 'square', fig: 'square-pyramid' as Solid },
        { text: 'What shape are the sloping faces of a square-based pyramid?', ans: 'triangle', fig: 'square-pyramid' as Solid },
        { text: 'What shape are the two end faces of a triangular prism?', ans: 'triangle', fig: 'triangular-prism' as Solid },
        { text: 'What shape are most faces of a cuboid?', ans: 'rectangle', fig: 'cuboid' as Solid },
      ])
      return {
        type: 'mcq',
        prompt: q.text,
        figure: solidFig(q.fig),
        ...mcqFrom(rng, q.ans, ['circle', 'square', 'triangle', 'rectangle', 'pentagon'].filter((x) => x !== q.ans).map((x) => ({ value: x, why: `Look at the face again. It is not ${art(x)} ${x}.` }))),
        hints: ['Imagine printing the face on paper.', 'Count the sides of the face.', 'Look for straight sides or a curved edge.'],
        explanation: `${SOLID_INFO[q.fig].about}`,
      }
    }
    const v = rng.int(0, 2)
    if (v === 0) {
      const s = rng.pick(POLY.filter((x) => x !== 'cuboid'))
      const info = SOLID_INFO[s]
      return {
        type: 'mcq',
        prompt: `I have ${info.flat} faces, ${info.edges} edges and ${info.vertices} vertices. What shape am I?`,
        ...mcqFrom(rng, info.name, rng.shuffle(G2_SOLIDS.filter((x) => x !== s && !(s === 'cube' && x === 'cuboid'))).map((x) => ({ value: SOLID_INFO[x].name, why: `${cap(art(SOLID_INFO[x].name))} ${SOLID_INFO[x].name} has ${SOLID_INFO[x].flat} flat faces, ${SOLID_INFO[x].edges} edges and ${SOLID_INFO[x].vertices} vertices.` }))),
        hints: ['Start with the number of vertices.', 'Picture each shape and count its corners.', `Which shape has exactly ${info.vertices} vertices?`],
        explanation: `${cap(art(info.name))} ${info.name} has ${info.flat} faces, ${info.edges} edges and ${info.vertices} vertices.`,
        tags: ['olympiad'],
      }
    }
    if (v === 1) {
      const pair = rng.sample(POLY.filter((x) => x !== 'cuboid'), 2)
      const a = SOLID_INFO[pair[0]!]
      const b = SOLID_INFO[pair[1]!]
      const what = rng.pick(['edges', 'vertices'] as const)
      const va = what === 'edges' ? a.edges : a.vertices
      const vb = what === 'edges' ? b.edges : b.vertices
      const [big, small, vbig, vsmall] = va >= vb ? [a, b, va, vb] : [b, a, vb, va]
      return {
        type: 'numeric',
        prompt: `${cap(art(big.name))} ${big.name} has more ${what} than ${art(small.name)} ${small.name}. How many more?`,
        answer: vbig - vsmall,
        hints: [`Find the ${what} of each shape.`, `${cap(art(big.name))} ${big.name} has ${vbig} ${what}.`, `${cap(art(small.name))} ${small.name} has ${vsmall}. Find the difference.`],
        explanation: `${vbig} - ${vsmall} = ${vbig - vsmall}.`,
        tags: ['olympiad'],
      }
    }
    const obj = rng.pick([
      { text: 'a dice', ans: 'cube' as Solid, icon: 'block' as IconName },
      { text: 'a football', ans: 'sphere' as Solid, icon: 'ball' as IconName },
      { text: 'a tin of beans', ans: 'cylinder' as Solid, icon: 'jar' as IconName },
      { text: 'a box of tissues', ans: 'cuboid' as Solid, icon: 'box' as IconName },
      { text: 'a party hat', ans: 'cone' as Solid, icon: 'hat' as IconName },
    ])
    return {
      type: 'mcq',
      prompt: `What 3D shape is ${obj.text}?`,
      ...mcqFrom(rng, SOLID_INFO[obj.ans].name, rng.shuffle(G2_SOLIDS.filter((x) => x !== obj.ans)).map((x) => ({ value: SOLID_INFO[x].name, why: SOLID_INFO[x].about }))),
      hints: [`Picture ${obj.text} in your hand.`, 'Are its faces flat, curved, or both?', 'Count its flat faces.'],
      explanation: `${cap(obj.text)} is shaped like ${art(SOLID_INFO[obj.ans].name)} ${SOLID_INFO[obj.ans].name}. ${SOLID_INFO[obj.ans].about}`,
    }
  },
}

type Sym = { shape: Extract<Fig, { kind: 'shape' }>['shape']; line: 'vertical' | 'horizontal'; name: string }

/** Benar sesuai orientasi renderer: segitiga, segi lima, dan bintang menghadap ke atas. */
const SYM_YES: readonly Sym[] = [
  { shape: 'square', line: 'vertical', name: 'square' }, { shape: 'square', line: 'horizontal', name: 'square' },
  { shape: 'rectangle', line: 'vertical', name: 'rectangle' }, { shape: 'rectangle', line: 'horizontal', name: 'rectangle' },
  { shape: 'circle', line: 'vertical', name: 'circle' }, { shape: 'triangle', line: 'vertical', name: 'triangle' },
  { shape: 'pentagon', line: 'vertical', name: 'pentagon' }, { shape: 'hexagon', line: 'horizontal', name: 'hexagon' },
  { shape: 'octagon', line: 'vertical', name: 'octagon' }, { shape: 'semicircle', line: 'vertical', name: 'semicircle' },
  { shape: 'star', line: 'vertical', name: 'star' }, { shape: 'kite', line: 'vertical', name: 'kite' },
]
const SYM_NO: readonly Sym[] = [
  { shape: 'right-triangle', line: 'vertical', name: 'right-angled triangle' }, { shape: 'right-triangle', line: 'horizontal', name: 'right-angled triangle' },
  { shape: 'parallelogram', line: 'vertical', name: 'parallelogram' }, { shape: 'parallelogram', line: 'horizontal', name: 'parallelogram' },
  { shape: 'triangle', line: 'horizontal', name: 'triangle' }, { shape: 'pentagon', line: 'horizontal', name: 'pentagon' },
  { shape: 'semicircle', line: 'horizontal', name: 'semicircle' }, { shape: 'star', line: 'horizontal', name: 'star' },
  { shape: 'kite', line: 'horizontal', name: 'kite' },
]
const symFig = (x: Sym): Fig => ({ kind: 'shape', shape: x.shape, lineOfSymmetry: x.line, alt: `${cap(art(x.name))} ${x.name} with a dashed ${x.line} line through the middle.` })

const SYM_LETTERS = ['A', 'H', 'M', 'O', 'T', 'U', 'V', 'W', 'X', 'Y']
const NOSYM_LETTERS = ['F', 'G', 'J', 'L', 'N', 'P', 'Q', 'R', 'S', 'Z']

const symmetry: Generator = {
  skill: 'm2.symmetry',
  levels: [1, 2, 3, 4],
  generate({ rng, level }) {
    if (level === 1) {
      const yes = rng.pick(SYM_YES)
      const no = rng.sample(SYM_NO, 3)
      return {
        type: 'mcq',
        prompt: 'Which dashed line is a line of symmetry?',
        ...mcqOpts(rng, { figure: symFig(yes) }, no.map((x) => ({ figure: symFig(x), why: `If you fold the ${x.name} on this line, the two halves do not match.` })), 4),
        hints: ['A line of symmetry splits a shape into two matching halves.', 'Imagine folding the shape along the dashed line.', 'Check each shape. Would one half sit exactly on the other?'],
        explanation: `Folding the ${yes.name} along the ${yes.line} line makes the two halves match, so it is a line of symmetry.`,
      }
    }
    if (level === 2) {
      const want = rng.chance(0.6)
      const ans = want ? rng.pick(SYM_LETTERS) : rng.pick(NOSYM_LETTERS)
      const others = want ? rng.sample(NOSYM_LETTERS, 3) : rng.sample(SYM_LETTERS, 3)
      return {
        type: 'mcq',
        prompt: want ? 'Which capital letter has a line of symmetry?' : 'Which capital letter has no line of symmetry?',
        ...mcqFrom(rng, ans, others.map((x) => ({ value: x, why: want ? `${x} does not match itself when folded.` : `${x} can be folded so both halves match.` }))),
        hints: ['Imagine folding each letter down the middle.', 'Try a line from top to bottom, then a line across.', 'Check each letter. Do both halves match?'],
        explanation: want ? `${ans} can be folded so both halves match, so it has a line of symmetry.` : `${ans} cannot be folded so both halves match, so it has no line of symmetry.`,
      }
    }
    if (level === 3) {
      const kinds: ShapeKey[] = ['circle', 'triangle', 'square', 'hexagon', 'pentagon']
      const half = Array.from({ length: 3 }, () => rng.pick(kinds))
      const full = [...half, ...[...half].reverse()]
      const gap = rng.int(0, 5)
      const ans = full[gap]!
      const items = full.map((s, i) => (i === gap ? null : { shape: s }))
      const desc = full.map((s, i) => (i === gap ? 'blank' : s)).join(', ')
      return {
        type: 'mcq',
        prompt: 'Which shape makes the pattern symmetrical?',
        figure: { kind: 'pattern', items, alt: `A row of 6 shapes: ${desc}. The mirror line is between the 3rd and 4th shapes.` },
        ...mcqFrom(rng, ans, rng.shuffle(kinds.filter((k) => k !== ans)).map((x) => ({ value: x, why: `Look at the shape on the other side of the mirror line, the same distance away.` }))),
        hints: ['The mirror line is in the middle of the row.', 'Each shape has a partner the same distance from the middle.', `The blank is shape ${gap + 1}. Its partner is shape ${6 - gap}.`],
        explanation: `The blank is the mirror partner of shape ${6 - gap}, which is ${art(ans)} ${ans}. The pattern reads ${full.join(', ')}.`,
      }
    }
    const pick = rng.pick([
      { shape: 'rectangle' as const, n: 2, name: 'rectangle', note: 'one down the middle and one across the middle' },
      { shape: 'square' as const, n: 4, name: 'square', note: 'one down, one across and two corner to corner' },
      { shape: 'kite' as const, n: 1, name: 'kite', note: 'one down the middle only' },
      { shape: 'semicircle' as const, n: 1, name: 'semicircle', note: 'one down the middle only' },
      { shape: 'parallelogram' as const, n: 0, name: 'parallelogram', note: 'no fold makes the halves match' },
      { shape: 'triangle' as const, n: 3, name: 'triangle', note: 'one from each corner to the middle of the opposite side' },
    ])
    const tri = pick.shape === 'triangle'
    return {
      type: 'numeric',
      prompt: tri ? 'This triangle has 3 equal sides. How many lines of symmetry does it have?' : `How many lines of symmetry does this ${pick.name} have?`,
      figure: { kind: 'shape', shape: pick.shape, ...(tri ? { sideLabels: ['4 cm', '4 cm', '4 cm'] } : {}), alt: tri ? 'A triangle with 3 equal sides of 4 cm.' : `A drawing of ${art(pick.name)} ${pick.name}.` },
      answer: pick.n,
      hints: ['Imagine folding the shape so both halves match.', 'Try a fold down the middle, across the middle and from corner to corner.', 'Count every fold that works.'],
      explanation: `${cap(art(pick.name))} ${pick.name} has ${pick.n} ${pick.n === 1 ? 'line' : 'lines'} of symmetry: ${pick.note}.`,
      tags: ['olympiad'],
    }
  },
}

const RULER_THINGS: readonly { icon: IconName; name: string }[] = [
  { icon: 'pencil', name: 'pencil' }, { icon: 'crayon', name: 'crayon' }, { icon: 'key', name: 'key' }, { icon: 'eraser', name: 'eraser' },
  { icon: 'spoon', name: 'spoon' }, { icon: 'leaf', name: 'leaf' }, { icon: 'feather', name: 'feather' }, { icon: 'carrot', name: 'carrot' },
  { icon: 'nail', name: 'nail' }, { icon: 'paperclip', name: 'paperclip' },
]

const ESTIMATES: readonly { what: string; right: string; wrongs: readonly { v: string; why: string }[] }[] = [
  { what: 'a new pencil', right: '18 cm', wrongs: [{ v: '18 m', why: '18 m is longer than a classroom.' }, { v: '1 cm', why: '1 cm is about the width of a fingertip.' }, { v: '180 cm', why: '180 cm is about as tall as a grown-up.' }] },
  { what: 'a classroom door', right: '2 m', wrongs: [{ v: '2 cm', why: '2 cm is shorter than your thumb.' }, { v: '20 m', why: '20 m is taller than a house.' }, { v: '20 cm', why: '20 cm is about the length of a book.' }] },
  { what: 'a paperclip', right: '3 cm', wrongs: [{ v: '3 m', why: '3 m is taller than a door.' }, { v: '30 cm', why: '30 cm is about the length of a school ruler.' }, { v: '30 m', why: '30 m is longer than a bus.' }] },
  { what: 'a school bus', right: '10 m', wrongs: [{ v: '10 cm', why: '10 cm is shorter than your hand.' }, { v: '1 m', why: '1 m is about as long as a big step.' }, { v: '100 m', why: '100 m is a long race track.' }] },
  { what: 'your hand', right: '12 cm', wrongs: [{ v: '12 m', why: '12 m is longer than a bus.' }, { v: '1 cm', why: '1 cm is about the width of a fingertip.' }, { v: '120 cm', why: '120 cm is about as tall as a child.' }] },
]

const length2: Generator = {
  skill: 'm2.length',
  levels: [1, 2, 3, 4],
  generate({ rng, level }) {
    if (level === 1 || level === 2) {
      const t = rng.pick(RULER_THINGS)
      const start = level === 1 ? 0 : rng.int(1, 5)
      const len = rng.int(3, level === 1 ? 18 : 12)
      const end = start + len
      const figure: Fig = { kind: 'ruler', lengthCm: 20, objectCm: len, objectStartCm: start, object: t.icon, alt: `A ${t.name} next to a ruler. It starts at ${start} cm and ends at ${end} cm.` }
      return {
        type: 'numeric',
        prompt: `How long is the ${t.name}?`,
        figure,
        answer: len,
        unit: 'cm',
        hints: start === 0 ? [`Check where the ${t.name} starts.`, `It starts at 0. Read the number at the other end.`, `Follow the end of the ${t.name} down to the ruler.`] : [`The ${t.name} does not start at 0.`, 'Find where it starts and where it ends.', `It starts at ${start}. Count on to the end.`],
        explanation: start === 0 ? `The ${t.name} goes from 0 to ${end}, so it is ${len} cm long.` : `The ${t.name} goes from ${start} cm to ${end} cm. ${end} - ${start} = ${len} cm.`,
        solution: [{ say: `It starts at ${start} and ends at ${end}.`, figure }, { say: start === 0 ? `So it is ${len} cm long.` : 'Find the difference.', show: start === 0 ? `${len} cm` : `${end} - ${start} = ${len} cm` }],
      }
    }
    if (level === 3) {
      const v = rng.int(0, 2)
      if (v === 0) {
        const e = rng.pick(ESTIMATES)
        return {
          type: 'mcq',
          prompt: `About how long is ${e.what}?`,
          ...mcqFrom(rng, e.right, e.wrongs.map((w) => ({ value: w.v, why: w.why }))),
          hints: ['Picture the real thing.', 'A centimetre is tiny. A metre is about one big step.', 'Is it smaller than your arm or bigger than you?'],
          explanation: `${cap(e.what)} is about ${e.right} long.`,
        }
      }
      if (v === 1) {
        const big = rng.chance(0.5)
        const what = big ? rng.pick(['a football pitch', 'a swimming pool', 'the school hall', 'a garden fence']) : rng.pick(['a crayon', 'a book', 'a leaf', 'a toothbrush'])
        const ans = big ? 'metres' : 'centimetres'
        return {
          type: 'mcq',
          prompt: `Which unit is best for measuring ${what}?`,
          ...mcqFrom(rng, ans, [
            { value: big ? 'centimetres' : 'metres', why: big ? 'Centimetres are too small for something this long.' : 'Metres are too big for something this small.' },
            { value: 'kilograms', why: 'Kilograms measure mass, not length.' },
            { value: 'litres', why: 'Litres measure capacity, not length.' },
          ]),
          hints: ['Length is measured in centimetres or metres.', big ? 'Is it longer than you are tall?' : 'Is it smaller than your arm?', 'Big lengths use metres. Small lengths use centimetres.'],
          explanation: `${cap(what)} is ${big ? 'long' : 'short'}, so we measure it in ${ans}.`,
        }
      }
      return {
        type: 'numeric',
        prompt: '1 metre = ___ centimetres',
        answer: 100,
        hints: ['A metre stick is marked in centimetres.', 'Count the centimetres in 10s along a metre stick.', 'There are 10 groups of 10 cm in a metre.'],
        explanation: '1 metre is 100 centimetres.',
      }
    }
    const name = pickName(rng)
    const v = rng.int(0, 2)
    if (v === 0) {
      const a = rng.pick(range(40, 95, 5))
      const b = rng.pick(range(10, a - 10, 5))
      return {
        type: 'numeric',
        prompt: `A ribbon is ${a} cm long. ${name} cuts off ${b} cm. How long is the ribbon now?`,
        answer: a - b,
        unit: 'cm',
        hints: ['Cutting off makes it shorter, so take away.', `Work out ${a} - ${b}.`, `Take away the tens first: ${a} - ${Math.floor(b / 10) * 10}.`],
        explanation: `${a} - ${b} = ${a - b}, so the ribbon is ${a - b} cm long.`,
        tags: ['word-problem'],
      }
    }
    if (v === 1) {
      const a = rng.int(15, 45)
      const b = rng.int(12, 50)
      return {
        type: 'numeric',
        prompt: `A stick is ${a} cm long. Another stick is ${b} cm long. They are put end to end. How long are they together?`,
        answer: a + b,
        unit: 'cm',
        hints: ['End to end means add the lengths.', `Work out ${a} + ${b}.`, `Add the tens, then add the ones.`],
        explanation: `${a} + ${b} = ${a + b} cm.`,
        tags: ['word-problem'],
      }
    }
    const [p, q] = twoNames(rng)
    const hp = rng.int(110, 135)
    const hq = rng.int(100, hp - 3)
    return {
      type: 'numeric',
      prompt: `${p} is ${hp} cm tall. ${q} is ${hq} cm tall. How much taller is ${p}?`,
      figure: { kind: 'bars', categories: [p, q], values: [hp, hq], axisMax: 140, step: 20, yLabel: 'Height in cm', alt: `${p} is ${hp} cm tall. ${q} is ${hq} cm tall.` },
      answer: hp - hq,
      unit: 'cm',
      hints: ['How much taller means find the difference.', `Count on from ${hq} to ${hp}.`, Math.floor(hq / 10) === Math.floor(hp / 10) ? `Count on in ones from ${hq}.` : `Jump from ${hq} to the next ten first.`],
      explanation: `${hp} - ${hq} = ${hp - hq}, so ${p} is ${hp - hq} cm taller.`,
      tags: ['word-problem'],
    }
  },
}

const massCapacity: Generator = {
  skill: 'm2.mass-capacity',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level === 1) {
      if (rng.chance(0.6)) {
        const v = rng.pick(range(100, 900, 100))
        const figure: Fig = { kind: 'scale', max: 1000, value: v, step: 100, unit: 'g', alt: `Kitchen scales from 0 to 1000 g in steps of 100 g. The pointer is at ${v} g.` }
        return {
          type: 'numeric',
          prompt: 'What mass do the scales show?',
          figure,
          answer: v,
          unit: 'g',
          hints: ['Look at where the pointer stops.', 'The scale counts in 100s.', 'Find the number the pointer points to.'],
          explanation: `The pointer is at ${v}, so the mass is ${v} g.`,
        }
      }
      const v = rng.int(1, 9)
      return {
        type: 'numeric',
        prompt: 'What mass do the scales show?',
        figure: { kind: 'scale', max: 10, value: v, step: 1, unit: 'kg', alt: `Scales from 0 to 10 kg. The pointer is at ${v} kg.` },
        answer: v,
        unit: 'kg',
        hints: ['Look at where the pointer stops.', 'The scale counts in 1s.', 'Read the number the pointer points to.'],
        explanation: `The pointer is at ${v}, so the mass is ${v} kg.`,
      }
    }
    if (level === 2) {
      if (rng.chance(0.6)) {
        const v = rng.pick(range(100, 900, 100))
        return {
          type: 'numeric',
          prompt: 'How much water is in the jug?',
          figure: { kind: 'jug', capacity: 1000, value: v, step: 100, unit: 'ml', alt: `A jug marked from 0 to 1000 ml in steps of 100 ml. The water is at ${v} ml.` },
          answer: v,
          unit: 'ml',
          hints: ['Look at the top of the water.', 'The marks go up in 100s.', 'Read the mark level with the water.'],
          explanation: `The water reaches the ${v} ml mark, so there is ${v} ml.`,
        }
      }
      const v = rng.int(1, 4)
      return {
        type: 'numeric',
        prompt: 'How much water is in the jug?',
        figure: { kind: 'jug', capacity: 5, value: v, step: 1, unit: 'l', alt: `A big jug marked from 0 to 5 litres. The water is at ${plural(v, 'litre', 'litres')}.` },
        answer: v,
        unit: 'l',
        hints: ['Look at the top of the water.', 'The marks go up in 1s.', 'Read the mark level with the water.'],
        explanation: `The water reaches the ${v} litre mark, so there ${v === 1 ? 'is 1 litre' : `are ${v} litres`}.`,
      }
    }
    if (level === 3) {
      if (rng.chance(0.5)) {
        const v = rng.pick([100, 300, 500, 700, 900])
        return {
          type: 'numeric',
          prompt: 'What mass do the scales show?',
          figure: { kind: 'scale', max: 1000, value: v, step: 200, unit: 'g', alt: `Scales from 0 to 1000 g with numbers every 200 g. The pointer is halfway between ${v - 100} g and ${v + 100} g.` },
          answer: v,
          unit: 'g',
          hints: ['The numbers go up in 200s.', 'The pointer is between two numbers.', 'Find the two numbers the pointer is between. Then find the middle.'],
          explanation: `The pointer is halfway between ${v - 100} g and ${v + 100} g, so it shows ${v} g.`,
        }
      }
      const items = rng.pick([
        { what: 'a watermelon', ans: 'kilograms', mass: true },
        { what: 'a bag of rice', ans: 'kilograms', mass: true },
        { what: 'a grape', ans: 'grams', mass: true },
        { what: 'a pencil', ans: 'grams', mass: true },
        { what: 'a bath', ans: 'litres', mass: false },
        { what: 'a bucket', ans: 'litres', mass: false },
        { what: 'a teaspoon', ans: 'millilitres', mass: false },
        { what: 'a small cup', ans: 'millilitres', mass: false },
      ])
      const all = ['kilograms', 'grams', 'litres', 'millilitres']
      return {
        type: 'mcq',
        prompt: items.mass ? `Which unit is best for the mass of ${items.what}?` : `Which unit is best for how much ${items.what} holds?`,
        ...mcqFrom(rng, items.ans, all.filter((u) => u !== items.ans).map((u) => ({ value: u, why: u === 'kilograms' ? 'Kilograms are for heavy things.' : u === 'grams' ? 'Grams are for light things.' : u === 'litres' ? 'Litres are for large amounts of liquid.' : 'Millilitres are for tiny amounts of liquid.' }))),
        hints: [items.mass ? 'Mass is how heavy something is.' : 'Capacity is how much liquid fits.', items.mass ? 'Grams are for light things. Kilograms are for heavy things.' : 'Millilitres are for small amounts. Litres are for large amounts.', `Is ${items.what} ${items.mass ? 'heavy or light' : 'a big amount or a tiny amount'}?`],
        explanation: items.mass ? `We measure the mass of ${items.what} in ${items.ans}.` : `We measure how much ${items.what} holds in ${items.ans}.`,
      }
    }
    if (level === 4) {
      if (rng.chance(0.5)) {
        const v = rng.pick([5, 15, 20, 25, 30, 35])
        return {
          type: 'numeric',
          prompt: 'What temperature does the thermometer show?',
          figure: { kind: 'thermometer', min: 0, max: 40, value: v, step: 10, alt: `A thermometer from 0 to 40 degrees Celsius with numbers every 10. The red line stops at ${v} degrees.` },
          answer: v,
          unit: '°C',
          hints: ['Look at the top of the red line.', 'The numbers go up in 10s.', v % 10 === 5 ? `The line stops halfway between ${v - 5} and ${v + 5}.` : 'Find the number next to the top of the line.'],
          explanation: `The red line stops at ${v}, so it is ${v} °C.`,
        }
      }
      const name = pickName(rng)
      const a = rng.pick(range(500, 1000, 100))
      const b = rng.pick(range(100, a - 100, 100))
      return {
        type: 'numeric',
        prompt: `A jug has ${a} ml of juice. ${name} pours out ${b} ml. How much juice is left in the jug?`,
        answer: a - b,
        unit: 'ml',
        hints: ['Pouring out means take away.', `Work out ${a} - ${b}.`, `Think in hundreds: ${a / 100} - ${b / 100}.`],
        explanation: `${a} - ${b} = ${a - b}, so ${a - b} ml is left.`,
        tags: ['word-problem'],
      }
    }
    const mass = rng.chance(0.5)
    const big = mass ? '1 kg' : '1 l'
    const unit = mass ? 'g' : 'ml'
    const smalls = rng.sample([500, 750, 800, 900, 950, 990], 3).map((v) => `${v} ${unit}`)
    return {
      type: 'mcq',
      prompt: mass ? 'Which is the heaviest?' : 'Which holds the most?',
      ...mcqFrom(rng, big, smalls.map((s) => ({ value: s, why: `${s} is less than ${mass ? '1000 g' : '1000 ml'}.` }))),
      hints: [`Change ${big} into ${mass ? 'grams' : 'millilitres'}.`, mass ? '1 kg is the same as 1000 g.' : '1 litre is the same as 1000 ml.', 'Now compare all four numbers.'],
      explanation: `${big} = ${mass ? '1000 g' : '1000 ml'}, which is more than ${listAnd(smalls)}.`,
      tags: ['olympiad'],
    }
  },
}

/* -------------------------------------------------------------------------
 * Position and turns
 * ---------------------------------------------------------------------- */

const CLOCK_POS = [12, 3, 6, 9] as const

const positionTurns: Generator = {
  skill: 'm2.position-turns',
  levels: [1, 2, 3, 4],
  generate({ rng, level }) {
    if (level === 1) {
      const row = rng.sample(THINGS, 6)
      const figure: Fig = { kind: 'icons', items: row.map((x) => ({ icon: x.icon, label: x.name })), alt: `A row of things from left to right: ${row.map((x) => x.name).join(', ')}.` }
      const k = rng.int(2, 3)
      const right = rng.chance(0.5)
      const idx = right ? rng.int(0, 5 - k) : rng.int(k, 5)
      const x = row[idx]!.name
      const ansIdx = idx + (right ? k : -k)
      const ans = row[ansIdx]!.name
      const ds = [ansIdx - 1, ansIdx + 1, idx + (right ? -k : k), idx, ...range(0, 5)]
        .filter((i) => i >= 0 && i <= 5 && i !== ansIdx)
        .map((i) => ({ value: row[i]!.name, why: i === idx ? `That is the ${x} itself.` : `Count ${k} places to the ${right ? 'right' : 'left'} of the ${x} again.` }))
      return {
        type: 'mcq',
        prompt: `What is ${k} places to the ${right ? 'right' : 'left'} of the ${x}?`,
        figure,
        ...mcqFrom(rng, ans, ds),
        hints: [`Find the ${x} first.`, `Move ${right ? 'right' : 'left'} one thing at a time.`, `Count 1, 2${k === 3 ? ', 3' : ''} as you move from the ${x}.`],
        explanation: `Starting at the ${x} and moving ${k} places ${right ? 'right' : 'left'} reaches the ${ans}.`,
      }
    }
    if (level === 2) {
      const start = rng.pick(CLOCK_POS)
      const turn = rng.pick([1, 2, 1])
      const cw = rng.chance(0.5)
      const si = CLOCK_POS.indexOf(start)
      const ans = CLOCK_POS[(si + (cw ? turn : 4 - turn)) % 4]!
      const turnText = turn === 1 ? 'a quarter turn' : 'a half turn'
      return {
        type: 'mcq',
        prompt: `The long hand points to ${start}. It makes ${turnText} ${cw ? 'clockwise' : 'anticlockwise'}. Where does it point now?`,
        figure: clockFig(12, start === 12 ? 0 : start * 5),
        ...mcqFrom(rng, String(ans), CLOCK_POS.filter((p) => p !== ans).map((p) => {
          const diff = (CLOCK_POS.indexOf(p) - si + 4) % 4
          return { value: String(p), why: diff === 0 ? 'That is where it started.' : `${p} is ${diff === 1 ? 'a quarter turn clockwise' : diff === 2 ? 'a half turn' : 'a quarter turn anticlockwise'} from ${start}.` }
        })),
        hints: ['Clockwise is the way clock hands move.', turn === 1 ? 'A quarter turn moves from one of 12, 3, 6, 9 to the next.' : 'A half turn points the opposite way.', `Start at ${start}. Move ${cw ? 'the way the hands go' : 'the opposite way'}.`],
        explanation: `${cap(turnText)} ${cw ? 'clockwise' : 'anticlockwise'} from ${start} takes the hand to ${ans}.`,
      }
    }
    if (level === 3) {
      if (rng.chance(0.5)) {
        const places = rng.shuffle(['school', 'park', 'shop', 'house'])
        const front = places[0]!
        const back = places[1]!
        const leftP = places[2]!
        const rightP = places[3]!
        const name = pickName(rng)
        const turn = rng.pick(['a quarter turn clockwise', 'a quarter turn anticlockwise', 'a half turn'])
        const ans = turn === 'a half turn' ? back : turn.endsWith('anticlockwise') ? leftP : rightP
        return {
          type: 'mcq',
          prompt: `${name} faces the ${front}. The ${back} is behind ${name}. The ${leftP} is on the left. The ${rightP} is on the right. ${name} makes ${turn}. What does ${name} face now?`,
          ...mcqFrom(rng, ans, places.filter((p) => p !== ans).map((p) => ({ value: p, why: p === front ? `${name} faced the ${front} before turning.` : `Turn again: ${turn === 'a half turn' ? 'a half turn faces the opposite way' : turn.endsWith('anticlockwise') ? 'anticlockwise turns to the left' : 'clockwise turns to the right'}.` }))),
          hints: ['Stand up and try it.', turn === 'a half turn' ? 'A half turn makes you face the opposite way.' : turn.endsWith('anticlockwise') ? 'A quarter turn anticlockwise turns you to your left.' : 'A quarter turn clockwise turns you to your right.', `Start by facing the ${front}.`],
          explanation: `${cap(turn)} from facing the ${front} means ${name} now faces the ${ans}.`,
        }
      }
      const letters = rng.shuffle(['A', 'B', 'C', 'D'])
      const sx = rng.int(3, 4)
      const sy = rng.int(3, 4)
      const dx = rng.pick([-2, -1, 1, 2])
      const dy = rng.pick([-2, -1, 1, 2])
      const target = { x: sx + dx, y: sy + dy }
      const spots = [target, { x: sx - dx, y: sy + dy }, { x: sx + dx, y: sy - dy }, { x: sx + dy, y: sy + dx }]
      const uniq = spots.filter((p, i) => spots.findIndex((q) => q.x === p.x && q.y === p.y) === i && !(p.x === sx && p.y === sy))
      while (uniq.length < 4) {
        const cand = { x: rng.int(1, 6), y: rng.int(1, 6) }
        if (!uniq.some((q) => q.x === cand.x && q.y === cand.y) && !(cand.x === sx && cand.y === sy)) uniq.push(cand)
      }
      const pts = uniq.slice(0, 4).map((p, i) => ({ ...p, label: letters[i]! }))
      const h = `${Math.abs(dx)} ${Math.abs(dx) === 1 ? 'square' : 'squares'} ${dx > 0 ? 'right' : 'left'}`
      const vv = `${Math.abs(dy)} ${Math.abs(dy) === 1 ? 'square' : 'squares'} ${dy > 0 ? 'up' : 'down'}`
      return {
        type: 'mcq',
        prompt: `Start at S. Move ${h} and ${vv}. Which letter do you reach?`,
        figure: { kind: 'coordinates', size: 7, points: [{ x: sx, y: sy, label: 'S' }, ...pts.map((p) => ({ x: p.x, y: p.y, label: p.label }))], alt: `A grid. S is at ${sx} across and ${sy} up. ${pts.map((p) => `${p.label} is at ${p.x} across and ${p.y} up`).join('. ')}.` },
        ...mcqFrom(rng, pts[0]!.label, pts.slice(1).map((p) => ({ value: p.label, why: `${p.label} is ${Math.abs(p.x - sx)} across and ${Math.abs(p.y - sy)} ${p.y >= sy ? 'up' : 'down'} from S. Check the directions.` }))),
        hints: ['Put your finger on S.', `Move ${dx > 0 ? 'right' : 'left'} first, then ${dy > 0 ? 'up' : 'down'}.`, `Move ${h}. Then stop and move ${vv}.`],
        explanation: `From S, ${h} and ${vv} reaches ${pts[0]!.label}.`,
      }
    }
    const v = rng.int(0, 2)
    if (v === 0) {
      const what = rng.pick([{ q: 'a half turn', a: 2 }, { q: 'a full turn', a: 4 }, { q: 'three quarters of a turn', a: 3 }])
      return {
        type: 'numeric',
        prompt: `How many quarter turns make ${what.q}?`,
        answer: what.a,
        hints: ['A quarter turn is one of 4 equal turns.', 'Use a clock: a quarter turn moves the hand from 12 to 3.', `Count the quarter turns from 12 for ${what.q}.`],
        explanation: `${cap(what.q)} is ${what.a} quarter turns.`,
      }
    }
    if (v === 1) {
      const start = rng.pick(CLOCK_POS)
      const si = CLOCK_POS.indexOf(start)
      const k = rng.int(1, 3)
      const end = CLOCK_POS[(si + k) % 4]!
      return {
        type: 'numeric',
        prompt: `A hand turns clockwise from ${start} to ${end}. How many quarter turns is that?`,
        figure: clockFig(12, start === 12 ? 0 : start * 5),
        answer: k,
        hints: ['Each quarter turn moves to the next of 12, 3, 6 and 9.', 'Move clockwise, the way clock hands go.', `Count the steps from ${start} to ${end}.`],
        explanation: `Clockwise from ${start}: ${range(1, k).map((i) => CLOCK_POS[(si + i) % 4]).join(', ')}. That is ${k} quarter ${k === 1 ? 'turn' : 'turns'}.`,
      }
    }
    const start = rng.pick(CLOCK_POS)
    const si = CLOCK_POS.indexOf(start)
    const ans = CLOCK_POS[(si + 3) % 4]!
    return {
      type: 'mcq',
      prompt: `A hand points to ${start}. It makes three quarters of a turn clockwise. Where does it point now?`,
      ...mcqFrom(rng, String(ans), CLOCK_POS.filter((p) => p !== ans).map((p) => ({ value: String(p), why: 'Count three quarter turns clockwise, one at a time.' }))),
      hints: ['Three quarters of a turn is 3 quarter turns.', 'Each quarter turn moves to the next of 12, 3, 6 and 9.', `Start at ${start}. Move clockwise 3 times.`],
      explanation: `Three quarter turns clockwise from ${start} end at ${ans}. That is the same as one quarter turn anticlockwise.`,
      tags: ['olympiad'],
    }
  },
}

/* -------------------------------------------------------------------------
 * Statistics and chance
 * ---------------------------------------------------------------------- */

const SURVEYS2: readonly { title: string; labels: readonly string[] }[] = [
  { title: 'Favourite fruit', labels: ['Apples', 'Bananas', 'Mangoes', 'Oranges', 'Papayas'] },
  { title: 'Favourite pet', labels: ['Cats', 'Dogs', 'Fish', 'Rabbits', 'Birds'] },
  { title: 'Favourite colour', labels: ['Red', 'Blue', 'Green', 'Yellow', 'Purple'] },
  { title: 'Favourite sport', labels: ['Football', 'Swimming', 'Badminton', 'Running', 'Cycling'] },
  { title: 'Favourite vegetable', labels: ['Carrots', 'Corn', 'Spinach', 'Peas', 'Broccoli'] },
]

const charts: Generator = {
  skill: 'm2.charts',
  levels: [1, 2, 3, 4],
  generate({ rng, level }) {
    const s = rng.pick(SURVEYS2)
    const lower = (l: string) => l.toLowerCase()
    if (level === 1) {
      const labels = rng.sample(s.labels, 4)
      const counts = rng.sample(range(6, 20), 4)
      const k = rng.int(0, 3)
      const c = counts[k]!
      return {
        type: 'numeric',
        prompt: `Look at the tally chart. How many children chose ${lower(labels[k]!)}?`,
        figure: { kind: 'tally', rows: labels.map((l, i) => ({ label: l, count: counts[i]! })), alt: `Tally chart: ${s.title.toLowerCase()}. ${labels.map((l, i) => `${l}: ${counts[i]}`).join(', ')}.` },
        answer: c,
        hints: ['A gate of 4 marks with a line across is 5.', 'Count the gates in 5s first.', 'Then count on the single marks.'],
        explanation: c % 5 === 0 ? `${c / 5} gates of 5 make ${c}.` : `${Math.floor(c / 5)} gates make ${Math.floor(c / 5) * 5}, and ${c % 5} more makes ${c}.`,
      }
    }
    if (level === 2) {
      const labels = rng.sample(s.labels, 4)
      const counts = rng.sample(range(2, 10), 4)
      const figure: Fig = { kind: 'pictogram', title: s.title, rows: labels.map((l, i) => ({ label: l, count: counts[i]! })), icon: 'star', key: 1, alt: `Pictogram: ${s.title.toLowerCase()}. Each star is 1 child. ${labels.map((l, i) => `${l}: ${counts[i]}`).join(', ')}.` }
      if (rng.chance(0.5)) {
        const most = rng.chance(0.5)
        const t = most ? Math.max(...counts) : Math.min(...counts)
        const ans = labels[counts.indexOf(t)]!
        return {
          type: 'mcq',
          prompt: `Which was chosen by the ${most ? 'most' : 'fewest'} children?`,
          figure,
          ...mcqFrom(rng, ans, labels.filter((l) => l !== ans).map((l) => ({ value: l, why: `${l} has ${counts[labels.indexOf(l)]} stars. ${ans} has ${t}.` }))),
          hints: ['Count the stars in each row.', most ? 'The longest row is the most popular.' : 'The shortest row is the least popular.', `Count the stars for ${lower(labels.find((l) => l !== ans)!)} first.`],
          explanation: `${ans} has ${t} stars, the ${most ? 'most' : 'fewest'} of any row.`,
        }
      }
      const order = [0, 1, 2, 3].sort((a, b) => counts[b]! - counts[a]!)
      const hi = order[0]!
      const lo = rng.pick(order.slice(1))
      return {
        type: 'numeric',
        prompt: `How many more children chose ${lower(labels[hi]!)} than ${lower(labels[lo]!)}?`,
        figure,
        answer: counts[hi]! - counts[lo]!,
        hints: ['Find the two rows.', 'How many more means find the difference.', `Count on from ${counts[lo]} to ${counts[hi]}.`],
        explanation: `${counts[hi]} - ${counts[lo]} = ${counts[hi]! - counts[lo]!}.`,
      }
    }
    if (level === 3) {
      const labels = rng.sample(s.labels, 4)
      const counts = rng.sample(range(2, 16).filter((x) => x % 2 === 0), 4)
      const figure: Fig = { kind: 'bars', title: s.title, categories: labels, values: counts, step: 2, axisMax: 16, yLabel: 'Children', alt: `Block graph: ${s.title.toLowerCase()}. ${labels.map((l, i) => `${l}: ${counts[i]}`).join(', ')}.` }
      if (rng.chance(0.5)) {
        const total = counts.reduce((a, b) => a + b, 0)
        return {
          type: 'numeric',
          prompt: 'How many children answered altogether?',
          figure,
          answer: total,
          hints: ['Read each bar.', 'Add all four numbers.', `Start with ${counts[0]} + ${counts[1]}.`],
          explanation: `${counts.join(' + ')} = ${total}.`,
          solution: [{ say: 'Read each bar.', figure }, { say: 'Add them all.', show: `${counts.join(' + ')} = ${total}` }],
        }
      }
      const order = [0, 1, 2, 3].sort((a, b) => counts[b]! - counts[a]!)
      const hi = rng.pick(order.slice(0, 2))
      const lo = order[3]!
      return {
        type: 'numeric',
        prompt: `How many fewer children chose ${lower(labels[lo]!)} than ${lower(labels[hi]!)}?`,
        figure,
        answer: counts[hi]! - counts[lo]!,
        hints: ['Read the two bars.', 'How many fewer means find the difference.', `Work out ${counts[hi]} - ${counts[lo]}.`],
        explanation: `${counts[hi]} - ${counts[lo]} = ${counts[hi]! - counts[lo]!}.`,
      }
    }
    const labels = rng.sample(s.labels, 4)
    const icons = rng.sample(range(2, 8), 4)
    const counts = icons.map((i) => i * 2)
    const figure: Fig = { kind: 'pictogram', title: s.title, rows: labels.map((l, i) => ({ label: l, count: icons[i]! })), icon: 'star', key: 2, alt: `Pictogram: ${s.title.toLowerCase()}. Each star is 2 children. ${labels.map((l, i) => `${l}: ${icons[i]} stars`).join(', ')}.` }
    if (rng.chance(0.5)) {
      const k = rng.int(0, 3)
      return {
        type: 'numeric',
        prompt: `Each star stands for 2 children. How many children chose ${lower(labels[k]!)}?`,
        figure,
        answer: counts[k]!,
        hints: ['Look at the key first.', 'Each star is 2 children, so count in 2s.', `Count the stars for ${lower(labels[k]!)}. Then double.`],
        explanation: `${icons[k]} stars × 2 = ${counts[k]} children.`,
        tags: ['olympiad'],
      }
    }
    const order = [0, 1, 2, 3].sort((a, b) => counts[b]! - counts[a]!)
    const hi = order[0]!
    const lo = order[3]!
    return {
      type: 'numeric',
      prompt: `Each star stands for 2 children. How many more children chose ${lower(labels[hi]!)} than ${lower(labels[lo]!)}?`,
      figure,
      answer: counts[hi]! - counts[lo]!,
      hints: ['Each star is 2 children.', `Work out how many children each row stands for.`, `${labels[hi]} has ${icons[hi]} stars, which is ${counts[hi]} children.`],
      explanation: `${labels[hi]}: ${counts[hi]}. ${labels[lo]}: ${counts[lo]}. ${counts[hi]} - ${counts[lo]} = ${counts[hi]! - counts[lo]!}.`,
      tags: ['olympiad'],
    }
  },
}

const carrollVenn: Generator = {
  skill: 'm2.carroll-venn',
  levels: [1, 2, 3, 4],
  generate({ rng, level }) {
    if (level === 1) {
      const n = rng.int(2, 39)
      const even = n % 2 === 0
      const small = n < 20
      const label = (e: boolean, s: boolean) => `${e ? 'Even' : 'Not even'}, ${s ? 'less than 20' : 'not less than 20'}`
      const cellsFor = (e: boolean, s: boolean) => rng.sample(range(2, 39).filter((x) => x !== n && (x % 2 === 0) === e && (x < 20) === s), 2).map(String)
      const figure: Fig = { kind: 'carroll', cols: ['Even', 'Not even'], rows: ['Less than 20', 'Not less than 20'], cells: [cellsFor(true, true), cellsFor(false, true), cellsFor(true, false), cellsFor(false, false)], alt: 'A Carroll diagram. Columns: even, not even. Rows: less than 20, not less than 20.' }
      const correct = label(even, small)
      return {
        type: 'mcq',
        prompt: `Where does ${n} go in the Carroll diagram?`,
        figure,
        ...mcqFrom(rng, correct, [
          { value: label(!even, small), why: `${n} ends in ${n % 10}, so it is ${even ? 'even' : 'not even'}.` },
          { value: label(even, !small), why: `${n} is ${small ? 'less' : 'not less'} than 20.` },
          { value: label(!even, !small), why: 'Check both rules again.' },
        ]),
        hints: ['Check one rule at a time.', `Is ${n} even? Is ${n} less than 20?`, `Start with the column: does ${n} end in 0, 2, 4, 6 or 8?`],
        explanation: `${n} is ${even ? 'even' : 'not even'} and ${small ? 'less than 20' : 'not less than 20'}, so it goes in that box.`,
      }
    }
    if (level === 2) {
      const pool = range(1, 40)
      const pickIn = (f: (x: number) => boolean, k: number) => rng.sample(pool.filter(f), k)
      const a = pickIn((x) => x % 2 === 0 && x <= 20, 3)
      const b = pickIn((x) => x % 2 === 1 && x > 20, 3)
      const both = pickIn((x) => x % 2 === 0 && x > 20, 3)
      const none = pickIn((x) => x % 2 === 1 && x <= 20, 2)
      const items = [
        ...a.map((x) => ({ text: String(x), region: 'a' as const })),
        ...b.map((x) => ({ text: String(x), region: 'b' as const })),
        ...both.map((x) => ({ text: String(x), region: 'both' as const })),
        ...none.map((x) => ({ text: String(x), region: 'none' as const })),
      ]
      const figure: Fig = { kind: 'venn', sets: ['Even', 'More than 20'], items, alt: `Venn diagram. Even only: ${a.join(', ')}. More than 20 only: ${b.join(', ')}. In both: ${both.join(', ')}. Outside: ${none.join(', ')}.` }
      if (rng.chance(0.5)) {
        const ans = String(rng.pick(both))
        return {
          type: 'mcq',
          prompt: 'Which number is in both circles?',
          figure,
          ...mcqFrom(rng, ans, [
            { value: String(rng.pick(a)), why: 'This number is even but not more than 20.' },
            { value: String(rng.pick(b)), why: 'This number is more than 20 but not even.' },
            { value: String(rng.pick(none)), why: 'This number is outside both circles.' },
          ]),
          hints: ['Both circles means the middle part where they overlap.', 'A number there must be even and more than 20.', 'Look in the overlap.'],
          explanation: `${ans} is even and more than 20, so it is in both circles.`,
        }
      }
      return {
        type: 'numeric',
        prompt: 'How many numbers are even but not more than 20?',
        figure,
        answer: a.length,
        hints: ['Find the Even circle.', 'Do not count the numbers in the overlap.', 'Count the numbers in the part of the Even circle on its own.'],
        explanation: `${listAnd(a.map(String))} are even and not more than 20. That is ${a.length} numbers.`,
      }
    }
    if (level === 3) {
      const ans = rng.pick([10, 20, 30, 40, 50])
      const only5 = rng.pick([5, 15, 25, 35, 45])
      const only2 = rng.pick([4, 6, 8, 12, 14, 16, 18, 22, 24])
      const neither = rng.pick([3, 7, 9, 11, 13, 17, 19, 21, 23])
      const figure: Fig = { kind: 'venn', sets: ['In the 2 times table', 'In the 5 times table'], items: [], alt: 'An empty Venn diagram. One circle is the 2 times table. The other is the 5 times table.' }
      return {
        type: 'mcq',
        prompt: 'Which number belongs in the overlap?',
        figure,
        ...mcqFrom(rng, String(ans), [
          { value: String(only5), why: `${only5} is in the 5 times table but it is odd.` },
          { value: String(only2), why: `${only2} is in the 2 times table but not the 5 times table.` },
          { value: String(neither), why: `${neither} is in neither table.` },
        ]),
        hints: ['The overlap needs a number in both tables.', 'It must be even and end in 0 or 5.', 'Check each number against both rules.'],
        explanation: `${ans} is in the 2 times table and the 5 times table, so it belongs in the overlap.`,
      }
    }
    const pool = range(10, 99)
    const rule = (x: number) => ({ odd: x % 2 === 1, big: x > 50 })
    const wrongCell = rng.int(0, 3)
    const cell = (o: boolean, b: boolean, i: number) => rng.sample(pool.filter((x) => rule(x).odd === o && rule(x).big === b), i === wrongCell ? rng.int(1, 2) : rng.int(2, 3))
    const cells = [cell(true, true, 0), cell(false, true, 1), cell(true, false, 2), cell(false, false, 3)]
    const targetCell = [1, 0, 3, 2][wrongCell]!
    const intruder = rng.pick(pool.filter((x) => {
      const r = rule(x)
      const want = [{ o: true, b: true }, { o: false, b: true }, { o: true, b: false }, { o: false, b: false }][targetCell]!
      return r.odd === want.o && r.big === want.b && !cells.flat().includes(x)
    }))
    const shown = cells.map((c, i) => (i === wrongCell ? rng.shuffle([...c, intruder]) : c))
    const okOnes = rng.sample(cells.flat(), 3)
    return {
      type: 'mcq',
      prompt: 'One number is in the wrong box. Which one?',
      figure: { kind: 'carroll', cols: ['Odd', 'Not odd'], rows: ['More than 50', 'Not more than 50'], cells: shown.map((c) => c.map(String)) as [string[], string[], string[], string[]], alt: `A Carroll diagram. Columns: odd, not odd. Rows: more than 50, not more than 50. Top left: ${shown[0]!.join(', ')}. Top right: ${shown[1]!.join(', ')}. Bottom left: ${shown[2]!.join(', ')}. Bottom right: ${shown[3]!.join(', ')}.` },
      ...mcqFrom(rng, String(intruder), okOnes.map((x) => ({ value: String(x), why: `${x} is ${x % 2 ? 'odd' : 'not odd'} and ${x > 50 ? 'more' : 'not more'} than 50. It is in the right box.` }))),
      hints: ['Check each number against its column and its row.', 'Odd numbers end in 1, 3, 5, 7 or 9.', 'Start with the top left box. Is every number there odd and more than 50?'],
      explanation: `${intruder} is ${intruder % 2 ? 'odd' : 'not odd'}, so it should be in the ${intruder % 2 ? 'Odd' : 'Not odd'} column.`,
      tags: ['olympiad'],
    }
  },
}

type BagKind = { icon: IconName; one: string; many: string }
const BAG_PAIRS: readonly (readonly [BagKind, BagKind])[] = [
  [{ icon: 'sweet', one: 'sweet', many: 'sweets' }, { icon: 'cookie', one: 'cookie', many: 'cookies' }],
  [{ icon: 'apple', one: 'apple', many: 'apples' }, { icon: 'orange', one: 'orange', many: 'oranges' }],
  [{ icon: 'shell', one: 'shell', many: 'shells' }, { icon: 'button', one: 'button', many: 'buttons' }],
  [{ icon: 'marble', one: 'marble', many: 'marbles' }, { icon: 'ball', one: 'ball', many: 'balls' }],
]

const chance: Generator = {
  skill: 'm2.chance',
  levels: [1, 2, 3, 4],
  generate({ rng, level }) {
    const pairs = rng.sample(BAG_PAIRS, 2)
    const [A, B] = rng.shuffle(pairs[0]!)
    const [C, D] = rng.shuffle(pairs[1]!)
    if (!A || !B || !C || !D) throw new Error('chance: pasangan kosong')
    const pick = (k: { one: string }) => `You pick ${art(k.one)} ${k.one}.`
    if (level === 1 || level === 3) {
      const a = rng.int(2, 7)
      const b = level === 3 ? rng.pick(range(1, 7).filter((x) => x !== a)) : rng.int(2, 7)
      const figure: Fig = { kind: 'objects', items: [{ icon: A.icon, count: a }, { icon: B.icon, count: b }], alt: `A bag with ${plural(a, A.one, A.many)} and ${plural(b, B.one, B.many)}.` }
      const intro = `A bag has ${plural(a, A.one, A.many)} and ${plural(b, B.one, B.many)}. You pick one without looking.`
      if (level === 3) {
        const more = rng.chance(0.6)
        const ans = (a > b) === more ? A.many : B.many
        const other = ans === A.many ? B.many : A.many
        return {
          type: 'mcq',
          prompt: `${intro} Which are you ${more ? 'more' : 'less'} likely to pick?`,
          figure,
          ...mcqFrom(rng, cap(ans), [
            { value: cap(other), why: `There are ${more ? 'fewer' : 'more'} ${other} than ${ans}.` },
            { value: cap(C.many), why: `There are no ${C.many} in the bag.` },
            { value: 'Both are equally likely', why: `${a} and ${b} are not the same number.` },
          ]),
          hints: ['Count each kind in the bag.', 'The kind with more in the bag is more likely.', `Compare ${a} and ${b}.`],
          explanation: `There are ${a} ${A.many} and ${b} ${B.many}. There are ${more ? 'more' : 'fewer'} ${ans}, so you are ${more ? 'more' : 'less'} likely to pick one.`,
        }
      }
      const target = rng.pick(['will', 'will not', 'might'] as const)
      const either = `You pick ${art(A.one)} ${A.one} or ${art(B.one)} ${B.one}.`
      const opts = target === 'will'
        ? { correct: either, ds: [{ value: pick(A), why: `It might happen, but you could pick ${art(B.one)} ${B.one} instead.` }, { value: pick(B), why: `It might happen, but you could pick ${art(A.one)} ${A.one} instead.` }, { value: pick(C), why: `There are no ${C.many}, so it will not happen.` }] }
        : target === 'will not'
          ? { correct: pick(C), ds: [{ value: pick(A), why: `There are ${A.many} in the bag, so it might happen.` }, { value: pick(B), why: `There are ${B.many} in the bag, so it might happen.` }, { value: either, why: 'Everything in the bag is one of these, so it will happen.' }] }
          : { correct: pick(A), ds: [{ value: pick(C), why: `There are no ${C.many}, so it will not happen.` }, { value: pick(D), why: `There are no ${D.many}, so it will not happen.` }, { value: either, why: 'Everything in the bag is one of these, so it will happen for sure.' }] }
      return {
        type: 'mcq',
        prompt: `${intro} Which ${target === 'will' ? 'will happen for sure' : target === 'will not' ? 'will not happen' : 'might happen'}?`,
        figure,
        ...mcqFrom(rng, opts.correct, opts.ds),
        hints: ['Look at what is in the bag.', target === 'will' ? 'Will happen means it happens every time.' : target === 'will not' ? 'Will not happen means it can never happen.' : 'Might happen means it can happen, but not every time.', 'Check each sentence against the bag.'],
        explanation: target === 'will' ? `Everything in the bag is ${art(A.one)} ${A.one} or ${art(B.one)} ${B.one}, so that will happen.` : target === 'will not' ? `There are no ${C.many} in the bag, so picking one will not happen.` : `There are ${A.many} and ${B.many}, so picking ${art(A.one)} ${A.one} might happen.`,
      }
    }
    if (level === 2) {
      const target = rng.pick(['always', 'never', 'might'] as const)
      const spin = (parts: number, shaded: number): Fig => ({ kind: 'fraction', shape: 'circle', parts, shaded, alt: `A spinner with ${parts} equal parts. ${shaded === 0 ? 'No parts are' : shaded === parts ? 'All parts are' : `${shaded} ${shaded === 1 ? 'part is' : 'parts are'}`} shaded.` })
      const p1 = rng.pick([4, 6])
      const p2 = p1 === 4 ? 6 : 4
      const full = [spin(p1, p1), spin(p2, p2)]
      const empty = [spin(p1, 0), spin(p2, 0)]
      const part = [spin(p1, rng.int(1, p1 - 1)), spin(p2, rng.int(1, p2 - 1))]
      const correct = target === 'always' ? full[0]! : target === 'never' ? empty[0]! : part[0]!
      const ds: Opt[] = target === 'always'
        ? [{ figure: part[0]!, why: 'This spinner might land on white.' }, { figure: empty[0]!, why: 'This spinner can never land on shaded.' }, { figure: part[1]!, why: 'This spinner might land on white.' }]
        : target === 'never'
          ? [{ figure: part[0]!, why: 'This spinner might land on shaded.' }, { figure: full[0]!, why: 'This spinner always lands on shaded.' }, { figure: part[1]!, why: 'This spinner might land on shaded.' }]
          : [{ figure: full[0]!, why: 'This spinner always lands on shaded.' }, { figure: empty[0]!, why: 'This spinner can never land on shaded.' }, { figure: empty[1]!, why: 'This spinner can never land on shaded.' }]
      return {
        type: 'mcq',
        prompt: target === 'always' ? 'Which spinner will always land on shaded?' : target === 'never' ? 'Which spinner will never land on shaded?' : 'Which spinner might land on shaded?',
        ...mcqOpts(rng, { figure: correct }, ds, 4),
        hints: ['Look at how many parts are shaded on each spinner.', target === 'always' ? 'Always means every part is shaded.' : target === 'never' ? 'Never means no part is shaded.' : 'Might means some parts are shaded and some are not.', 'Check the spinners one at a time.'],
        explanation: target === 'always' ? 'Every part of that spinner is shaded, so it will always land on shaded.' : target === 'never' ? 'No part of that spinner is shaded, so it will never land on shaded.' : 'That spinner has some shaded parts and some white parts, so it might land on shaded.',
      }
    }
    const a = rng.int(2, 8)
    const b = rng.int(1, 6)
    const v = rng.chance(0.5)
    const figure: Fig = { kind: 'objects', items: [{ icon: A.icon, count: a }, { icon: B.icon, count: b }], alt: `A bag with ${plural(a, A.one, A.many)} and ${plural(b, B.one, B.many)}.` }
    if (v) {
      return {
        type: 'numeric',
        prompt: `A bag has ${plural(a, A.one, A.many)} and ${plural(b, B.one, B.many)}. You want to pick ${art(A.one)} ${A.one} for sure. How many ${B.many} must you take out?`,
        figure,
        answer: b,
        hints: [`For sure means the bag has only ${A.many}.`, `Every ${B.one} must come out.`, `Count the ${B.many}.`],
        explanation: `If all ${b} ${b === 1 ? B.one : B.many} come out, only ${A.many} are left, so you will pick ${art(A.one)} ${A.one} for sure.`,
        tags: ['olympiad'],
      }
    }
    const aa = Math.max(a, b + 1)
    return {
      type: 'numeric',
      prompt: `A bag has ${plural(aa, A.one, A.many)} and ${plural(b, B.one, B.many)}. How many ${B.many} must you add to make both equally likely?`,
      figure: { kind: 'objects', items: [{ icon: A.icon, count: aa }, { icon: B.icon, count: b }], alt: `A bag with ${plural(aa, A.one, A.many)} and ${plural(b, B.one, B.many)}.` },
      answer: aa - b,
      hints: ['Equally likely means the same number of each.', `You need as many ${B.many} as ${A.many}.`, `Count on from ${b} to ${aa}.`],
      explanation: `${b} + ${aa - b} = ${aa}, so adding ${aa - b} makes ${aa} of each. Then both are equally likely.`,
      tags: ['olympiad'],
    }
  },
}

/** Generator Math Grade 2. */
export const generators: Generator[] = [
  numbersTo100,
  sequences,
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
        rows === 2 ? `Row 1 makes ${cols}. Count on ${cols} more for row 2.` : `Row 1 makes ${cols}. Row 2 makes ${cols * 2}. Keep going.`,
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
  oddEven2,
  placeValue,
  compareOrder2,
  numberBonds,
  addition,
  subtraction,
  doublesHalves,
  timesTables,
  division,
  money2,
  fractionsShapes,
  fractionsAmounts,
  tellingTime,
  timeDurations,
  shapes2d2,
  shapes3d2,
  symmetry,
  length2,
  massCapacity,
  positionTurns,
  charts,
  carrollVenn,
  chance,
]
