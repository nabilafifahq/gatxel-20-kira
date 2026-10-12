import type { Rng } from '@kira/core/rng'
import type { FigureSpecInput, IconName } from '@kira/figures/spec'
import { COUNTABLES, DAYS, MONTHS, NAMES, digital, fmt, mcqFrom, numberWords, ordinal, plural, rupiah, timeWords } from './helpers'
import type { GeneratedItem, Generator } from './types'

/**
 * Generator Math Grade 3 (Cambridge Primary Stage 3).
 * Bagian atas berisi bantuan bersama yang juga dipakai g4.ts.
 */

// ---------------------------------------------------------------------------
// Bantuan bersama
// ---------------------------------------------------------------------------

export type Fig = FigureSpecInput
export type Step = { say: string; show?: string; figure?: Fig }
type Maker = () => GeneratedItem

export const WORD = ['word-problem']

export const pickName = (rng: Rng): string => rng.pick(NAMES)

export function twoNames(rng: Rng): [string, string] {
  const s = rng.sample(NAMES, 2)
  return [s[0]!, s[1]!]
}

export function oneOf(rng: Rng, makers: readonly Maker[]): GeneratedItem {
  return rng.pick(makers)()
}

export const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

/** Bulatkan ke kelipatan p terdekat; tepat di tengah dibulatkan ke atas. */
export function roundTo(n: number, p: number): number {
  return Math.floor(n / p + 0.5) * p
}

export const PLACES = ['ones', 'tens', 'hundreds', 'thousands', 'ten thousands'] as const
export const PLACE1 = ['one', 'ten', 'hundred', 'thousand', 'ten thousand'] as const
export const H = (n: number): string => plural(n, 'hundred', 'hundreds')
export const T = (n: number): string => plural(n, 'ten', 'tens')
export const O = (n: number): string => plural(n, 'one', 'ones')
export const digitAt = (n: number, p: number): number => Math.floor(Math.abs(n) / 10 ** p) % 10

export function listAnd(xs: readonly (string | number)[]): string {
  const s = xs.map((x) => (typeof x === 'number' ? fmt(x) : x))
  if (s.length <= 1) return s.join('')
  return `${s.slice(0, -1).join(', ')} and ${s[s.length - 1]}`
}

export const range = (a: number, b: number): number[] => Array.from({ length: b - a + 1 }, (_, i) => a + i)
export const DIGITS19 = range(1, 9)

/** Pilihan ganda angka. Pengecoh dari daftar, lalu cadangan di sekitar jawaban bila kurang. */
export function numChoice(
  rng: Rng,
  answer: number,
  distractors: readonly { value: number; why: string }[],
  opt: { min?: number; render?: (v: number) => string; spread?: readonly number[] } = {},
): { options: { text: string; why?: string }[]; answer: number } {
  const min = opt.min ?? 0
  const render = opt.render ?? fmt
  const list = distractors.filter((d) => Number.isFinite(d.value) && d.value >= min && d.value !== answer)
  for (const s of opt.spread ?? [10, -10, 1, -1, 100, -100]) {
    const v = answer + s
    if (v >= min) list.push({ value: v, why: `${render(v)} is ${v > answer ? 'too big' : 'too small'}. Work through each step again.` })
  }
  return mcqFrom(rng, answer, list, 4, render)
}

/** Pilihan ganda teks (4 opsi). */
export function textChoice(
  rng: Rng,
  answer: string,
  distractors: readonly { value: string; why: string }[],
): { options: { text: string; why?: string }[]; answer: number } {
  return mcqFrom(rng, answer, distractors, 4)
}

/** Pilihan ganda dengan figur sebagai opsi. */
export function figChoice(
  rng: Rng,
  correct: Fig,
  distractors: readonly { figure: Fig; why: string }[],
): { options: { figure: Fig; why?: string }[]; answer: number } {
  const all = rng.shuffle([{ figure: correct, why: '' }, ...distractors.slice(0, 3)])
  return {
    options: all.map((o) => (o.why ? { figure: o.figure, why: o.why } : { figure: o.figure })),
    answer: all.findIndex((o) => o.why === ''),
  }
}

/** Semua susunan angka dari kartu digit, tanpa nol di depan, urut naik. */
export function arrangements(ds: readonly number[]): number[] {
  const out = new Set<number>()
  const go = (rest: number[], acc: number[]) => {
    if (rest.length === 0) {
      if (acc[0] !== 0) out.add(Number(acc.join('')))
      return
    }
    rest.forEach((d, i) => go([...rest.slice(0, i), ...rest.slice(i + 1)], [...acc, d]))
  }
  go([...ds], [])
  return [...out].sort((a, b) => a - b)
}

/** Alasan singkat mengapa a lebih besar dari b, dari kolom terkiri yang berbeda. */
export function biggerReason(a: number, b: number): string {
  for (let p = 4; p >= 0; p--) {
    const da = digitAt(a, p)
    const db = digitAt(b, p)
    if (da !== db) return `${fmt(a)} has ${da} ${da === 1 ? PLACE1[p] : PLACES[p]} and ${fmt(b)} has ${db} ${db === 1 ? PLACE1[p] : PLACES[p]}`
  }
  return `${fmt(a)} and ${fmt(b)} are equal`
}

// --- kolom bersusun ---

const COL_HEAD = ['Th', 'H', 'T', 'O']

function colRow(sign: string, n: number, width: number): string[] {
  return [sign, ...String(n).padStart(width, ' ').split('').map((c) => (c === ' ' ? '' : c))]
}

export function columnFig(op: '+' | '-', a: number, b: number, result?: number): Fig {
  const width = Math.max(String(a).length, String(b).length, result === undefined ? 0 : String(result).length)
  const rows = [colRow('', a, width), colRow(op, b, width)]
  if (result !== undefined) rows.push(colRow('', result, width))
  const word = op === '+' ? 'add' : 'take away'
  return {
    kind: 'table',
    head: [' ', ...COL_HEAD.slice(4 - width)],
    rows,
    alt: `Column ${op === '+' ? 'addition' : 'subtraction'}: ${fmt(a)} ${word} ${fmt(b)}${result === undefined ? '' : `, answer ${fmt(result)}`}.`,
  }
}

export function carryFlags(a: number, b: number): boolean[] {
  const flags: boolean[] = []
  let c = 0
  const len = Math.max(String(a).length, String(b).length)
  for (let i = 0; i < len; i++) {
    const s = digitAt(a, i) + digitAt(b, i) + c
    flags.push(s >= 10)
    c = s >= 10 ? 1 : 0
  }
  return flags
}

export function borrowFlags(a: number, b: number): boolean[] {
  const flags: boolean[] = []
  let br = 0
  for (let i = 0; i < String(a).length; i++) {
    const d = digitAt(a, i) - br - digitAt(b, i)
    flags.push(d < 0)
    br = d < 0 ? 1 : 0
  }
  return flags
}

/** Langkah penjumlahan bersusun, kolom satuan dulu. */
export function addSteps(a: number, b: number): Step[] {
  const steps: Step[] = []
  const len = Math.max(String(a).length, String(b).length)
  let carry = 0
  for (let i = 0; i < len; i++) {
    const da = digitAt(a, i)
    const db = digitAt(b, i)
    const s = da + db + carry
    const show = `${da} + ${db}${carry ? ' + 1' : ''} = ${s}`
    const say = s >= 10
      ? `Add the ${PLACES[i]}. Write ${s % 10} and carry 1 into the ${PLACES[i + 1]} column.`
      : `Add the ${PLACES[i]}. Write ${s}.`
    steps.push({ say, show })
    carry = s >= 10 ? 1 : 0
  }
  if (carry) steps.push({ say: `Write the carried 1 in the ${PLACES[len]} column.`, show: `${fmt(a + b)}` })
  return steps
}

/** Langkah pengurangan bersusun dengan menukar (exchange), kolom satuan dulu. */
export function subSteps(a: number, b: number): Step[] {
  const top = String(a).split('').reverse().map(Number)
  const bot = String(b).split('').reverse().map(Number)
  const steps: Step[] = []
  for (let i = 0; i < top.length; i++) {
    const bi = bot[i] ?? 0
    if (i >= bot.length && i === top.length - 1 && top[i] === 0) break
    let say = ''
    if (top[i]! < bi) {
      let j = i + 1
      while (top[j] === 0) j++
      const was = top[i]!
      top[j] = top[j]! - 1
      for (let k = j - 1; k > i; k--) top[k] = 9
      top[i] = top[i]! + 10
      say = j === i + 1
        ? `You cannot take ${bi} from ${was}. Exchange 1 ${PLACE1[j]} for 10 ${PLACES[i]}, so there are ${top[i]} ${PLACES[i]}.`
        : `There are no ${PLACES[i + 1]} to exchange. Exchange 1 ${PLACE1[j]}, then 1 ${PLACE1[i + 1]}, so there are ${top[i]} ${PLACES[i]}.`
    }
    const r = top[i]! - bi
    steps.push({ say: `${say}${say ? ' ' : ''}Take away the ${PLACES[i]}: ${top[i]} - ${bi} = ${r}.`.trim(), show: `${top[i]} - ${bi} = ${r}` })
  }
  return steps
}

/** Dua bilangan dengan pola simpan per kolom. Pola: true berarti kolom itu menyimpan. */
export function addPairWith(rng: Rng, digits: number, pattern: readonly boolean[], fallback: [number, number]): [number, number] {
  const lo = 10 ** (digits - 1)
  const hi = 10 ** digits - 1
  for (let i = 0; i < 600; i++) {
    const a = rng.int(lo, hi)
    const b = rng.int(lo, hi)
    if (a + b > hi) continue
    const f = carryFlags(a, b)
    if (pattern.every((p, k) => f[k] === p)) return [a, b]
  }
  return fallback
}

export function subPairWith(rng: Rng, digits: number, test: (a: number, b: number, f: boolean[]) => boolean, fallback: [number, number]): [number, number] {
  const lo = 10 ** (digits - 1)
  const hi = 10 ** digits - 1
  for (let i = 0; i < 800; i++) {
    const a = rng.int(lo * 2, hi)
    const b = rng.int(lo, a - 1)
    if (b < lo) continue
    if (test(a, b, borrowFlags(a, b))) return [a, b]
  }
  return fallback
}

const things = (rng: Rng, icons: readonly IconName[]) => rng.pick(COUNTABLES.filter((c) => icons.includes(c.icon)))

// ---------------------------------------------------------------------------
// Np: nilai tempat
// ---------------------------------------------------------------------------

const PACKS = [
  { big: 'boxes of 100 stickers', mid: 'strips of 10', single: 'single stickers', unit: 'stickers' },
  { big: 'bags of 100 beads', mid: 'strings of 10', single: 'loose beads', unit: 'beads' },
  { big: 'boxes of 100 paper clips', mid: 'packs of 10', single: 'loose clips', unit: 'paper clips' },
  { big: 'crates of 100 mangoes', mid: 'bags of 10', single: 'single mangoes', unit: 'mangoes' },
] as const

const placeValue: Generator = {
  skill: 'm3.place-value',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const blocks = (regroup: boolean): GeneratedItem => {
      const h = rng.int(1, regroup ? 8 : 9)
      let t = rng.int(1, 9)
      let o = rng.int(1, 9)
      const bigTens = regroup && rng.chance(0.5)
      if (regroup && bigTens) t = rng.int(11, 19)
      if (regroup && !bigTens) {
        t = rng.int(0, 8)
        o = rng.int(11, 19)
      }
      const total = h * 100 + t * 10 + o
      const figure: Fig = { kind: 'basetens', hundreds: h, tens: t, ones: o, alt: `Base ten blocks: ${H(h)}, ${T(t)} and ${O(o)}.` }
      const hints = !regroup
        ? ['Count each kind of block on its own.', 'A big square is 100, a stick is 10 and a small cube is 1.', `The ${H(h)} make ${h * 100}.`]
        : bigTens
          ? ['Count the tens carefully. There are more than 9.', '10 tens make 1 hundred, so you can swap 10 tens for a hundred.', `${t} tens make ${t * 10}.`]
          : ['Count the ones carefully. There are more than 9.', '10 ones make 1 ten, so you can swap 10 ones for a ten.', `${o} ones make 1 ten and ${O(o - 10)}.`]
      return {
        type: 'numeric',
        prompt: regroup ? `There are more than 9 ${bigTens ? 'tens' : 'ones'} here. What number do the blocks show?` : 'What number do the blocks show?',
        figure,
        answer: total,
        hints,
        explanation: `${cap(H(h))} is ${h * 100}, ${T(t)} is ${t * 10} and ${O(o)} is ${o}. ${h * 100} + ${t * 10} + ${o} = ${total}.`,
        solution: [
          { say: 'Find the value of the hundreds.', show: `${h} × 100 = ${h * 100}`, figure },
          { say: 'Find the value of the tens.', show: `${t} × 10 = ${t * 10}` },
          { say: 'Add the ones as well.', show: `${h * 100} + ${t * 10} + ${o} = ${total}` },
        ],
        ...(regroup ? {} : { tip: 'Say the value of each block out loud as you count it.' }),
      }
    }

    const digitValue = (): GeneratedItem => {
      const ds = rng.sample(DIGITS19, 3)
      const n = ds[0]! * 100 + ds[1]! * 10 + ds[2]!
      const pos = rng.int(0, 2)
      const d = digitAt(n, pos)
      const value = d * 10 ** pos
      const others = [0, 1, 2]
        .filter((p) => p !== pos)
        .map((p) => ({
          value: d * 10 ** p,
          why: p === 0
            ? `${d} is the digit on its own. In the ${PLACES[pos]} column it is worth more.`
            : `${fmt(d * 10 ** p)} would be right if the ${d} were in the ${PLACES[p]} column.`,
        }))
      return {
        type: 'mcq',
        prompt: `What is the value of the digit ${d} in ${n}?`,
        ...mcqFrom(rng, value, [...others, { value: n, why: `${n} is the whole number. The question asks about the digit ${d} only.` }]),
        hints: [`Find the digit ${d} in ${n}.`, 'From the right, the columns are ones, tens and hundreds.', `The ${d} is in the ${PLACES[pos]} column.`],
        explanation: `In ${n}, the ${d} is in the ${PLACES[pos]} column, so it is worth ${fmt(value)}.`,
        solution: [
          { say: `Write ${n} in a place value chart.`, figure: { kind: 'table', head: ['H', 'T', 'O'], rows: [ds.map(String)], alt: `Place value chart: ${ds[0]} hundreds, ${ds[1]} tens, ${ds[2]} ones.` } },
          { say: `The ${d} is in the ${PLACES[pos]} column.`, show: `${d} ${PLACES[pos]} = ${fmt(value)}` },
        ],
      }
    }

    const partition = (): GeneratedItem => {
      if (rng.chance(0.25)) {
        const h = rng.int(1, 9)
        const o = rng.int(1, 9)
        const n = h * 100 + o
        return {
          type: 'numeric',
          prompt: `Find the missing number. ${n} = ${h * 100} + ___`,
          answer: o,
          hints: [`Split ${n} into hundreds, tens and ones.`, `There are no tens in ${n}. The 0 holds the tens place.`, `${h * 100} is the hundreds part. What is left?`],
          explanation: `${n} has ${H(h)}, no tens and ${O(o)}, so ${n} = ${h * 100} + ${o}.`,
        }
      }
      const h = rng.int(1, 9)
      const t = rng.int(1, 9)
      const o = rng.int(1, 9)
      const n = h * 100 + t * 10 + o
      const parts = [h * 100, t * 10, o]
      const miss = rng.int(0, 1)
      const place = 2 - miss
      const shown = parts.map((p, i) => (i === miss ? '___' : String(p))).join(' + ')
      return {
        type: 'numeric',
        prompt: `Find the missing number. ${n} = ${shown}`,
        answer: parts[miss]!,
        hints: [`Split ${n} into hundreds, tens and ones.`, 'Each part is the value of one digit.', `Look at the ${PLACES[place]} digit of ${n}. It is ${digitAt(n, place)}.`],
        explanation: `${n} = ${h * 100} + ${t * 10} + ${o}, so the missing number is ${parts[miss]}.`,
        solution: [
          { say: `Split ${n} into its parts.`, show: `${n} = ${h * 100} + ${t * 10} + ${o}` },
          { say: 'Compare with the number sentence to find the missing part.', show: `${parts[miss]}` },
        ],
      }
    }

    const words = (): GeneratedItem => {
      const h = rng.int(1, 9)
      const zeroT = rng.chance(0.35)
      const t = zeroT ? 0 : rng.int(1, 9)
      const o = !zeroT && rng.chance(0.2) ? 0 : rng.int(1, 9)
      const n = h * 100 + t * 10 + o
      const w = numberWords(n)
      return {
        type: 'numeric',
        prompt: `Write ${w} in digits.`,
        answer: n,
        hints: ['Listen for the hundreds, then the tens, then the ones.', 'Write one digit in each column. Use 0 for an empty column.', `${cap(numberWords(h))} hundred means ${h} in the hundreds column.`],
        explanation: `${cap(w)} is ${H(h)}, ${T(t)} and ${O(o)}, so it is written ${n}.${t === 0 ? ' The 0 shows there are no tens.' : o === 0 ? ' The 0 shows there are no ones.' : ''}`,
      }
    }

    const expanded = (): GeneratedItem => {
      const h = rng.int(1, 9)
      const t = rng.int(1, 9)
      const o = rng.int(1, 9)
      const n = h * 100 + t * 10 + o
      const parts = rng.shuffle([h * 100, t * 10, o])
      return {
        type: 'numeric',
        prompt: `What number is ${parts.join(' + ')}?`,
        answer: n,
        hints: ['Find the hundreds part first.', 'Put the parts in order: hundreds, then tens, then ones.', `The hundreds part is ${h * 100}.`],
        explanation: `${h * 100} + ${t * 10} + ${o} = ${n}.`,
      }
    }

    const sameAs = (): GeneratedItem => {
      const h = rng.int(2, 9)
      const t = rng.int(1, 8)
      const o = rng.int(0, 9)
      const n = h * 100 + t * 10 + o
      const say = (a: number, b: number, c: number) => `${H(a)}, ${T(b)} and ${O(c)}`
      const swapHundred = rng.chance(0.5)
      const correct = swapHundred ? say(h - 1, t + 10, o) : say(h, t - 1, o + 10)
      const wrong = swapHundred
        ? [
            { value: say(h, t + 10, o), why: `This makes ${fmt(n + 100)}. After the swap there is 1 hundred fewer.` },
            { value: say(h - 1, t, o + 10), why: `This makes ${fmt(n - 90)}. 1 hundred is the same as 10 tens.` },
            { value: say(h - 1, t + 10, o + 10), why: `This makes ${fmt(n + 10)}. Only one swap is needed.` },
          ]
        : [
            { value: say(h, t, o + 10), why: `This makes ${fmt(n + 10)}. After the swap there is 1 ten fewer.` },
            { value: say(h - 1, t - 1, o + 10), why: `This makes ${fmt(n - 100)}. Only a ten was swapped, so the hundreds stay the same.` },
            { value: say(h, t - 1, o + 1), why: `This makes ${fmt(n - 9)}. 1 ten is the same as 10 ones.` },
          ]
      const [a, b, c] = swapHundred ? [h - 1, t + 10, o] : [h, t - 1, o + 10]
      return {
        type: 'mcq',
        prompt: `Which is the same as ${n}?`,
        ...textChoice(rng, correct, wrong),
        hints: ['Work out the number each answer makes.', 'Swapping 1 hundred for 10 tens, or 1 ten for 10 ones, keeps the number the same.', `${n} has ${say(h, t, o)}.`],
        explanation: `${cap(correct)} makes ${a * 100} + ${b * 10} + ${c} = ${n}.`,
      }
    }

    const packs = (): GeneratedItem => {
      const ctx = rng.pick(PACKS)
      const name = pickName(rng)
      const bigMid = rng.chance(0.5)
      const h = rng.int(2, bigMid ? 8 : 9)
      const t = bigMid ? rng.int(10, 15) : rng.int(2, 9)
      const o = rng.int(1, 9)
      const total = h * 100 + t * 10 + o
      return {
        type: 'numeric',
        prompt: `${name} has ${h} ${ctx.big}, ${t} ${ctx.mid} and ${o} ${ctx.single}. How many ${ctx.unit} does ${name} have?`,
        answer: total,
        hints: ['Work out what each kind of pack is worth.', `Each big pack is 100 and each smaller pack is 10.`, `${h} packs of 100 make ${h * 100}.`],
        explanation: `${h} × 100 = ${h * 100}, ${t} × 10 = ${t * 10} and there are ${o} more. ${h * 100} + ${t * 10} + ${o} = ${total}.`,
        solution: [
          { say: 'Find the hundreds.', show: `${h} × 100 = ${h * 100}` },
          { say: 'Find the tens.', show: `${t} × 10 = ${t * 10}` },
          { say: 'Add everything together.', show: `${h * 100} + ${t * 10} + ${o} = ${total}` },
        ],
        tags: WORD,
      }
    }

    const cards = (): GeneratedItem => {
      const withZero = rng.chance(0.4)
      const ds = withZero ? [0, ...rng.sample(DIGITS19, 2)] : rng.sample(DIGITS19, 3)
      const shown = rng.shuffle(ds)
      const largest = rng.chance(0.5)
      const all = arrangements(ds)
      const answer = largest ? all[all.length - 1]! : all[0]!
      const first = digitAt(answer, 2)
      return {
        type: 'numeric',
        prompt: `Use the digit cards ${listAnd(shown.map(String))} once each. Make the ${largest ? 'largest' : 'smallest'} 3-digit number.`,
        figure: { kind: 'sequence', items: shown.map(String), style: 'boxes', alt: `Digit cards ${listAnd(shown.map(String))}.` },
        answer,
        hints: [
          'The hundreds digit makes the biggest difference.',
          largest ? 'Put the biggest digit in the hundreds column, then the next biggest in the tens.' : 'Put the smallest digit you can in the hundreds column. A 3-digit number cannot start with 0.',
          `The hundreds digit should be ${first}.`,
        ],
        explanation: `${answer} has the ${largest ? 'largest' : 'smallest'} possible digit in each column, starting with the hundreds.${!largest && withZero ? ' The 0 cannot go first, so it goes in the tens column.' : ''}`,
      }
    }

    const riddle = (): GeneratedItem => {
      const h = rng.int(1, 6)
      const a = rng.int(1, 3)
      const up = h - a < 0 || rng.chance(0.6)
      const t = up ? h + a : h - a
      const ones = [
        { o: t, clue: 'My ones digit is the same as my tens digit.' },
        ...(2 * h <= 9 ? [{ o: 2 * h, clue: 'My ones digit is double my hundreds digit.' }] : []),
        ...(h + t <= 9 ? [{ o: h + t, clue: 'My ones digit is my hundreds digit and my tens digit added together.' }] : []),
        { o: 0, clue: 'I have no ones.' },
      ]
      const pick = rng.pick(ones)
      const n = h * 100 + t * 10 + pick.o
      return {
        type: 'numeric',
        prompt: `I am a 3-digit number. My hundreds digit is ${h}. My tens digit is ${a} ${up ? 'more' : 'less'} than my hundreds digit. ${pick.clue} What number am I?`,
        answer: n,
        hints: ['Work out one digit at a time.', 'Start with the hundreds digit, then use it to find the tens digit.', `The tens digit is ${h} ${up ? '+' : '-'} ${a}.`],
        explanation: `Hundreds ${h}, tens ${t} and ones ${pick.o} make ${n}.`,
      }
    }

    const howMany = (): GeneratedItem => {
      const withZero = rng.chance(0.5)
      const ds = withZero ? [0, ...rng.sample(DIGITS19, 2)] : rng.sample(DIGITS19, 3)
      const shown = rng.shuffle(ds).map(String)
      const all = arrangements(ds)
      const first = Math.min(...ds.filter((d) => d !== 0))
      const startWith = all.filter((x) => digitAt(x, 2) === first)
      return {
        type: 'numeric',
        prompt: `How many different 3-digit numbers can you make with the cards ${listAnd(shown)}? Use each card once in every number.`,
        figure: { kind: 'sequence', items: shown, style: 'boxes', alt: `Digit cards ${listAnd(shown)}.` },
        answer: all.length,
        hints: ['Make a list so that you do not miss any.', 'Choose the hundreds digit first, then swap the other two cards.', `With ${first} in the hundreds column you can make ${listAnd(startWith)}.`],
        explanation: `The numbers are ${listAnd(all)}. That is ${all.length} numbers.${withZero ? ' A 3-digit number cannot start with 0.' : ''}`,
      }
    }

    if (level === 1) return oneOf(rng, [() => blocks(false), digitValue])
    if (level === 2) return oneOf(rng, [partition, words, expanded])
    if (level === 3) return oneOf(rng, [() => blocks(true), sameAs])
    if (level === 4) return oneOf(rng, [packs, cards])
    return oneOf(rng, [riddle, howMany])
  },
}

const compareOrder: Generator = {
  skill: 'm3.compare-order',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const statement = (close: boolean): GeneratedItem => {
      let a: number
      let b: number
      let hint3: string
      if (!close) {
        const [ha, hb] = rng.sample(DIGITS19, 2) as [number, number]
        a = ha * 100 + rng.int(0, 99)
        b = hb * 100 + rng.int(0, 99)
        hint3 = `${a} has ${H(ha)}. ${b} has ${H(hb)}.`
      } else {
        const h = rng.int(1, 9)
        const [x, y] = rng.sample(range(0, 9), 2) as [number, number]
        a = h * 100 + x * 10 + y
        b = h * 100 + y * 10 + x
        hint3 = `Both numbers have ${H(h)}, so compare the tens next.`
      }
      const big = Math.max(a, b)
      const small = Math.min(a, b)
      const correct = a > b ? `${a} > ${b}` : `${a} < ${b}`
      return {
        type: 'mcq',
        prompt: 'Which of these is true?',
        ...textChoice(rng, correct, [
          { value: a > b ? `${a} < ${b}` : `${a} > ${b}`, why: `${big} is bigger than ${small}, so this sign points the wrong way.` },
          { value: `${a} = ${b}`, why: 'The two numbers have different digits, so they are not equal.' },
          { value: a > b ? `${b} > ${a}` : `${b} < ${a}`, why: `This says ${b} is ${a > b ? 'greater' : 'less'} than ${a}. Check the hundreds and tens again.` },
        ]),
        hints: ['Compare the digits from the left, one column at a time.', '> means is greater than. < means is less than.', hint3],
        explanation: `${biggerReason(big, small)}, so ${big} is greater. That makes ${correct} true.`,
        tip: 'The open side of < or > faces the bigger number.',
      }
    }

    const extreme = (): GeneratedItem => {
      const ds = rng.sample(DIGITS19, 3)
      const all = arrangements(ds)
      const largest = rng.chance(0.5)
      const ans = largest ? all[all.length - 1]! : all[0]!
      const others = rng.sample(all.filter((x) => x !== ans), 3)
      const tie = others.find((x) => digitAt(x, 2) === digitAt(ans, 2))
      return {
        type: 'mcq',
        prompt: `Which number is the ${largest ? 'largest' : 'smallest'}?`,
        ...numChoice(rng, ans, others.map((x) => ({
          value: x,
          why: largest ? `${biggerReason(ans, x)}, so ${ans} is larger.` : `${biggerReason(x, ans)}, so ${ans} is smaller.`,
        }))),
        hints: ['Look at the hundreds digit of each number first.', 'If two numbers have the same hundreds, compare their tens.', `The ${largest ? 'biggest' : 'smallest'} hundreds digit here is ${digitAt(ans, 2)}.`],
        explanation: tie
          ? `${ans} and ${tie} both have ${H(digitAt(ans, 2))}, but ${ans} has ${largest ? 'more' : 'fewer'} tens. So ${ans} is the ${largest ? 'largest' : 'smallest'}.`
          : `${ans} has the ${largest ? 'most' : 'fewest'} hundreds, so it is the ${largest ? 'largest' : 'smallest'}.`,
      }
    }

    const order = (): GeneratedItem => {
      const ds = rng.sample(DIGITS19, 3)
      const all = arrangements(ds)
      const picked = rng.sample(all, 4)
      if (rng.chance(0.5)) picked.push(ds[0]! * 10 + ds[1]!)
      const asc = rng.chance(0.5)
      const sorted = [...picked].sort((x, y) => (asc ? x - y : y - x))
      return {
        type: 'order',
        prompt: `Put the numbers in order, starting with the ${asc ? 'smallest' : 'largest'}.`,
        items: sorted.map(String),
        hints: ['Compare the hundreds digits first.', 'When the hundreds match, compare the tens. Then compare the ones.', `${sorted[0]} is the ${asc ? 'smallest' : 'largest'}, so it goes first.`],
        explanation: `In order: ${sorted.join(', ')}.`,
      }
    }

    const line = (wide: boolean): GeneratedItem => {
      if (!wide) {
        const h = rng.int(1, 8)
        const min = h * 100
        const k = rng.int(1, 9)
        const ans = min + k * 10
        return {
          type: 'numberline',
          prompt: `Show where ${ans} goes on the number line.`,
          min,
          max: min + 100,
          step: 10,
          answer: ans,
          hints: [`The line goes from ${min} to ${min + 100}.`, 'Each small step is 10.', `Count on in tens from ${min}: ${min + 10}, ${min + 20}, ...`],
          explanation: `${ans} is ${k} steps of 10 after ${min}.`,
        }
      }
      const k = rng.pick([1, 3, 5, 7, 9, 11, 13, 15, 17, 19])
      const ans = k * 50
      return {
        type: 'numberline',
        prompt: `Show where ${ans} goes on the number line.`,
        min: 0,
        max: 1000,
        step: 50,
        answer: ans,
        hints: ['The line goes from 0 to 1,000.', 'Each small step is 50, so two steps make 100.', `${ans} is halfway between ${ans - 50} and ${ans + 50}.`],
        explanation: `${ans} is halfway between ${ans - 50} and ${ans + 50}, so it sits on the mark between them.`,
      }
    }

    const classes = (): GeneratedItem => {
      const ctx = rng.pick([
        { unit: 'bottles', verb: 'collected', head: 'Bottles' },
        { unit: 'pages', verb: 'read', head: 'Pages' },
        { unit: 'points', verb: 'scored', head: 'Points' },
      ])
      const h = rng.int(3, 7)
      const [t1, t2] = rng.sample(range(1, 8), 2) as [number, number]
      const [o1, o2] = rng.sample(range(0, 9), 2) as [number, number]
      const most = rng.chance(0.6)
      const vals = [h * 100 + t1 * 10 + o1, h * 100 + t1 * 10 + o2, h * 100 + t2 * 10 + rng.int(0, 9), most ? (h - 1) * 100 + 90 + rng.int(0, 9) : (h + 1) * 100 + rng.int(0, 9)]
      const uniq = [...new Set(vals)]
      while (uniq.length < 4) uniq.push(h * 100 + rng.int(0, 99))
      const vs = [...new Set(uniq)].slice(0, 4)
      while (vs.length < 4) vs.push(vs[vs.length - 1]! + 1)
      const names = ['3A', '3B', '3C', '3D']
      const shuffled = rng.shuffle(vs)
      const table: Fig = {
        kind: 'table',
        head: ['Class', ctx.head],
        rows: names.map((c, i) => [c, String(shuffled[i])]),
        alt: `Table: ${names.map((c, i) => `class ${c} ${shuffled[i]} ${ctx.unit}`).join(', ')}.`,
      }
      const ansVal = most ? Math.max(...shuffled) : Math.min(...shuffled)
      const ansIdx = shuffled.indexOf(ansVal)
      if (rng.chance(0.4)) {
        const order = names.map((c, i) => ({ c, v: shuffled[i]! })).sort((x, y) => y.v - x.v)
        return {
          type: 'order',
          prompt: `The table shows the ${ctx.unit} four classes ${ctx.verb}. Order the classes from most to fewest.`,
          figure: table,
          items: order.map((x) => x.c),
          hints: ['Compare the hundreds first, then the tens, then the ones.', 'The class with the biggest number goes first.', `Class ${order[0]!.c} has ${order[0]!.v}, the biggest number.`],
          explanation: `From most to fewest: ${order.map((x) => `${x.c} (${x.v})`).join(', ')}.`,
          tags: WORD,
        }
      }
      return {
        type: 'mcq',
        prompt: `The table shows the ${ctx.unit} four classes ${ctx.verb}. Which class ${ctx.verb} the ${most ? 'most' : 'fewest'}?`,
        figure: table,
        ...textChoice(rng, names[ansIdx]!, names.filter((_, i) => i !== ansIdx).map((c) => {
          const v = shuffled[names.indexOf(c)]!
          return { value: c, why: `${c} ${ctx.verb} ${v}. ${most ? biggerReason(ansVal, v) : biggerReason(v, ansVal)}.` }
        })),
        hints: ['Compare the numbers in the table.', 'Look at the hundreds first. If they match, look at the tens.', `${most ? 'More' : 'Fewer'} hundreds means a ${most ? 'bigger' : 'smaller'} number.`],
        explanation: `Class ${names[ansIdx]} ${ctx.verb} ${ansVal}, the ${most ? 'biggest' : 'smallest'} number in the table.`,
        tags: WORD,
      }
    }

    const between = (): GeneratedItem => {
      const h = rng.int(2, 9) * 100
      const a = h - rng.int(2, 7)
      const b = h + rng.int(2, 7)
      const n = b - a - 1
      return {
        type: 'numeric',
        prompt: `How many whole numbers are bigger than ${a} and smaller than ${b}?`,
        answer: n,
        hints: [`List the numbers that come after ${a}.`, `Do not count ${a} or ${b} themselves.`, `The first number is ${a + 1}.`],
        explanation: `The numbers are ${listAnd(range(a + 1, b - 1))}. That is ${n} numbers.`,
      }
    }

    if (level === 1) return oneOf(rng, [() => statement(false), extreme])
    if (level === 2) return oneOf(rng, [() => statement(true), () => line(false), extreme])
    if (level === 3) return oneOf(rng, [order, () => line(true)])
    if (level === 4) return classes()
    return between()
  },
}

const round10100: Generator = {
  skill: 'm3.round-10-100',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const nearest10 = (three: boolean): GeneratedItem => {
      let n = three ? rng.int(101, 994) : rng.int(11, 94)
      if (rng.chance(0.25)) n = Math.floor(n / 10) * 10 + 5
      if (n % 10 === 0) n += rng.int(1, 9)
      const lo = Math.floor(n / 10) * 10
      const hi = lo + 10
      const ans = roundTo(n, 10)
      const up = n % 10 >= 5
      const figure: Fig = { kind: 'numberline', min: lo, max: hi, step: 1, labels: [lo, hi], marks: [{ at: n, label: String(n) }], alt: `A number line from ${lo} to ${hi} with ${n} marked.` }
      const hints = [`Which two tens is ${n} between?`, 'Look at the ones digit. 5 or more rounds up. Less than 5 rounds down.', `${n} is between ${lo} and ${hi}.`]
      const explanation = `${n} is between ${lo} and ${hi}. The ones digit is ${n % 10}, so it rounds ${up ? 'up' : 'down'} to ${ans}.`
      if (!three) return { type: 'numeric', prompt: `Round ${n} to the nearest 10.`, figure, answer: ans, hints, explanation, tip: 'A number ending in 5 rounds up.' }
      return {
        type: 'mcq',
        prompt: `Round ${n} to the nearest 10.`,
        ...numChoice(rng, ans, [
          { value: up ? lo : hi, why: `The ones digit is ${n % 10}, so ${n} rounds ${up ? 'up' : 'down'}.` },
          { value: roundTo(n, 100), why: 'This is the nearest 100. The question asks for the nearest 10.' },
          { value: n, why: `${n} is the number itself. Rounding to the nearest 10 gives a number ending in 0.` },
        ], { spread: [20, -20, 30, -30] }),
        hints,
        explanation,
      }
    }

    const nearest100 = (): GeneratedItem => {
      let n = rng.int(101, 989)
      const r = rng.next()
      if (r < 0.25) n = Math.floor(n / 100) * 100 + 50
      else if (r < 0.4) n = rng.int(951, 994)
      if (n % 100 === 0) n += rng.int(11, 89)
      const lo = Math.floor(n / 100) * 100
      const hi = lo + 100
      const ans = roundTo(n, 100)
      const up = digitAt(n, 1) >= 5
      const figure: Fig = { kind: 'numberline', min: lo, max: hi, step: 10, labels: [lo, lo + 50, hi], marks: [{ at: n, label: String(n) }], alt: `A number line from ${fmt(lo)} to ${fmt(hi)} with ${n} marked.` }
      const hints = [`Which two hundreds is ${n} between?`, 'Look at the tens digit. 5 or more rounds up. Less than 5 rounds down.', `${n} is between ${fmt(lo)} and ${fmt(hi)}.`]
      const explanation = `${n} is between ${fmt(lo)} and ${fmt(hi)}. The tens digit is ${digitAt(n, 1)}, so it rounds ${up ? 'up' : 'down'} to ${fmt(ans)}.`
      if (rng.chance(0.5)) return { type: 'numeric', prompt: `Round ${n} to the nearest 100.`, figure, answer: ans, hints, explanation }
      return {
        type: 'mcq',
        prompt: `Round ${n} to the nearest 100.`,
        figure,
        ...numChoice(rng, ans, [
          { value: up ? lo : hi, why: `The tens digit is ${digitAt(n, 1)}, so ${n} rounds ${up ? 'up' : 'down'}.` },
          { value: roundTo(n, 10), why: 'This is the nearest 10. The question asks for the nearest 100.' },
          { value: lo + 50, why: `Rounding to the nearest 100 gives a whole number of hundreds.` },
        ], { spread: [200, -200, 100, -100] }),
        hints,
        explanation,
      }
    }

    const whichRounds = (): GeneratedItem => {
      const target = rng.int(2, 9) * 100
      const ans = rng.chance(0.5) ? target - 50 + rng.int(1, 9) : target + 49 - rng.int(1, 9)
      const ds = [target - 51 - rng.int(0, 8), target + 50 + rng.int(0, 9), target - 100 + rng.int(-20, 20)]
      return {
        type: 'mcq',
        prompt: `Which number rounds to ${target} when rounded to the nearest 100?`,
        ...numChoice(rng, ans, ds.map((x) => ({ value: x, why: `${x} rounds to ${fmt(roundTo(x, 100))}.` })), { spread: [100, -100, 150] }),
        hints: ['Round each number to the nearest 100.', 'Look at the tens digit of each number.', `A number rounds to ${target} if it is from ${target - 50} up to ${target + 49}.`],
        explanation: `${ans} is between ${target - 50} and ${target + 49}, so it rounds to ${target}.`,
      }
    }

    const estimate = (): GeneratedItem => {
      let a = rng.int(110, 590)
      let b = rng.int(110, 390)
      if (a % 100 === 50) a += 3
      if (b % 100 === 50) b -= 4
      const ra = roundTo(a, 100)
      const rb = roundTo(b, 100)
      const story = rng.chance(0.5)
      const fruit = rng.pick(['mangoes', 'rambutans', 'oranges', 'bananas'])
      return {
        type: 'numeric',
        prompt: story
          ? `A shop sold ${a} ${fruit} on Monday and ${b} on Tuesday. Round each number to the nearest 100. Estimate the total.`
          : `Estimate ${a} + ${b} by rounding each number to the nearest 100.`,
        answer: ra + rb,
        hints: ['Round each number first, then add.', `Look at the tens digit of ${a} and of ${b}.`, `${a} rounds to ${ra}.`],
        explanation: `${a} rounds to ${ra} and ${b} rounds to ${rb}. ${ra} + ${rb} = ${ra + rb}.`,
        ...(story ? { tags: WORD } : {}),
      }
    }

    const edge = (): GeneratedItem => {
      const hundred = rng.chance(0.5)
      const p = hundred ? 100 : 10
      const target = hundred ? rng.int(2, 9) * 100 : rng.int(3, 98) * 10
      const small = rng.chance(0.5)
      const ans = small ? target - p / 2 : target + p / 2 - 1
      return {
        type: 'numeric',
        prompt: `What is the ${small ? 'smallest' : 'largest'} whole number that rounds to ${target} to the nearest ${p}?`,
        answer: ans,
        hints: [
          'Think about the numbers just below and just above.',
          'A number exactly halfway rounds up.',
          small ? `${target - p / 2 - 1} rounds down to ${target - p}. Try the next number.` : `${target + p / 2} rounds up to ${target + p}. Try the number before it.`,
        ],
        explanation: small
          ? `${ans} is exactly halfway, so it rounds up to ${target}. ${ans - 1} rounds down to ${target - p}.`
          : `${ans} rounds down to ${target}. ${ans + 1} is halfway, so it rounds up to ${target + p}.`,
      }
    }

    if (level === 1) return nearest10(false)
    if (level === 2) return nearest10(true)
    if (level === 3) return nearest100()
    if (level === 4) return oneOf(rng, [whichRounds, estimate])
    return edge()
  },
}

// ---------------------------------------------------------------------------
// Nc: membilang, barisan, ganjil genap
// ---------------------------------------------------------------------------

const sequences3: Generator = {
  skill: 'm3.sequences',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const moreLess = (cross: boolean): GeneratedItem => {
      const more = rng.chance(0.5)
      let step: number
      let n: number
      if (!cross) {
        step = rng.pick([1, 10, 100])
        const p = step === 1 ? 0 : step === 10 ? 1 : 2
        do {
          n = rng.int(120, 880)
        } while (more ? digitAt(n, p) === 9 : digitAt(n, p) === 0)
      } else {
        step = rng.pick([1, 10])
        const h = rng.int(2, 8)
        if (step === 10) n = more ? h * 100 + 90 + rng.int(0, 9) : h * 100 + rng.int(0, 9)
        else n = more ? h * 100 + rng.pick([99, rng.int(1, 8) * 10 + 9]) : h * 100 + rng.pick([0, rng.int(1, 9) * 10])
      }
      const ans = more ? n + step : n - step
      const p = step === 1 ? 0 : step === 10 ? 1 : 2
      return {
        type: 'numeric',
        prompt: `What is ${step} ${more ? 'more' : 'less'} than ${n}?`,
        answer: ans,
        hints: [
          `Count ${more ? 'on' : 'back'} ${step} from ${n}.`,
          `${more ? 'Adding' : 'Taking away'} ${step} changes the ${PLACES[p]} digit.`,
          cross
            ? `The ${PLACES[p]} digit of ${n} is ${digitAt(n, p)}, so the next column changes too.`
            : `The ${PLACES[p]} digit of ${n} is ${digitAt(n, p)}.`,
        ],
        explanation: `${n} ${more ? '+' : '-'} ${step} = ${ans}.`,
      }
    }

    const seq = (steps: readonly number[], middle: boolean): GeneratedItem => {
      const step = rng.pick(steps)
      const up = rng.chance(0.6)
      const len = 5
      const span = step * (len - 1)
      const start = up ? rng.int(1, 999 - span) : rng.int(span + 1, 999)
      const terms = Array.from({ length: len }, (_, i) => (up ? start + i * step : start - i * step))
      const miss = middle ? rng.int(1, len - 2) : len - 1
      const k = miss >= 2 ? 0 : len - 2
      const ans = terms[miss]!
      return {
        type: 'numeric',
        prompt: middle ? 'What is the missing number in the sequence?' : 'What is the next number in the sequence?',
        figure: {
          kind: 'sequence',
          items: terms.map((v, i) => (i === miss ? null : String(v))),
          style: 'stones',
          alt: `A sequence: ${terms.map((v, i) => (i === miss ? 'a missing number' : String(v))).join(', ')}.`,
        },
        answer: ans,
        hints: ['Look at how the numbers change from one to the next.', 'Find the difference between two numbers that are next to each other.', `From ${terms[k]} to ${terms[k + 1]} the numbers go ${up ? 'up' : 'down'} by ${step}.`],
        explanation: `The rule is ${up ? 'add' : 'subtract'} ${step}. ${terms[miss - 1]} ${up ? '+' : '-'} ${step} = ${ans}.`,
      }
    }

    const rule = (): GeneratedItem => {
      const step = rng.pick([3, 4, 5, 25, 50])
      const up = rng.chance(0.5)
      const start = up ? rng.int(10, 500) : rng.int(400, 900)
      const terms = Array.from({ length: 5 }, (_, i) => (up ? start + i * step : start - i * step))
      const word = (s: number, u: boolean) => `${u ? 'add' : 'subtract'} ${s}`
      return {
        type: 'mcq',
        prompt: 'What is the rule for this sequence?',
        figure: { kind: 'sequence', items: terms.map(String), style: 'stones', alt: `A sequence: ${terms.join(', ')}.` },
        ...textChoice(rng, word(step, up), [
          { value: word(step, !up), why: `The numbers get ${up ? 'bigger' : 'smaller'}, so the rule must ${up ? 'add' : 'subtract'}.` },
          { value: word(step * 2, up), why: `Check the jump between two numbers next to each other. It is ${step}.` },
          { value: word(step + 1, up), why: `${terms[0]} ${up ? '+' : '-'} ${step + 1} is ${up ? terms[0]! + step + 1 : terms[0]! - step - 1}, which is not the next number.` },
        ]),
        hints: ['Do the numbers get bigger or smaller?', 'Find the difference between two numbers next to each other.', `Compare ${terms[0]} and ${terms[1]}.`],
        explanation: `Each number is ${step} ${up ? 'more' : 'less'} than the one before, so the rule is ${word(step, up)}.`,
      }
    }

    const oddEvenSort = (big: boolean): GeneratedItem => {
      const lo = big ? 100 : 10
      const hi = big ? 999 : 99
      const set = new Set<number>()
      while (set.size < 3) set.add(rng.int(lo / 2, (hi - 1) / 2) * 2 + 1)
      while (set.size < 6) set.add(rng.int(lo / 2, hi / 2 - 1) * 2)
      const nums = rng.shuffle([...set])
      const odds = nums.filter((x) => x % 2 === 1)
      const evens = nums.filter((x) => x % 2 === 0)
      return {
        type: 'sort',
        prompt: 'Sort the numbers into odd and even.',
        groups: ['Odd', 'Even'],
        items: nums.map((x) => ({ text: String(x), group: x % 2 === 0 ? 1 : 0 })),
        hints: ['Only the ones digit tells you if a number is odd or even.', 'Even numbers end in 0, 2, 4, 6 or 8. Odd numbers end in 1, 3, 5, 7 or 9.', `${nums[0]} ends in ${nums[0]! % 10}.`],
        explanation: `Odd: ${listAnd(odds)}. Even: ${listAnd(evens)}.`,
      }
    }

    const chooseParity = (): GeneratedItem => {
      const odd = rng.chance(0.5)
      const nRight = rng.int(2, 4)
      const set = new Set<number>()
      const want = (x: number) => (x % 2 === 1) === odd
      while (set.size < nRight) {
        const x = rng.int(100, 999)
        if (want(x)) set.add(x)
      }
      while (set.size < 6) {
        const x = rng.int(100, 999)
        if (!want(x)) set.add(x)
      }
      const nums = rng.shuffle([...set])
      const parity = odd ? 'odd' : 'even'
      return {
        type: 'multi',
        prompt: `Choose all the ${parity} numbers.`,
        options: nums.map((x) => (want(x) ? { text: String(x) } : { text: String(x), why: `${x} ends in ${x % 10}, so it is ${odd ? 'even' : 'odd'}.` })),
        answers: nums.map((x, i) => (want(x) ? i : -1)).filter((i) => i >= 0),
        hints: ['Look only at the last digit of each number.', `${cap(parity)} numbers end in ${odd ? '1, 3, 5, 7 or 9' : '0, 2, 4, 6 or 8'}.`, `${nums[0]} ends in ${nums[0]! % 10}.`],
        explanation: `The ${parity} numbers are ${listAnd(nums.filter(want))}.`,
      }
    }

    const frog = (): GeneratedItem => {
      const k = rng.pick([3, 4, 5, 10, 25])
      const s = rng.int(1, 30)
      const m = rng.int(4, 9)
      const ans = s + k * m
      const offs = rng.shuffle([1, -1, 2, -2, 3, -3].filter((d) => d % k !== 0))
      return {
        type: 'mcq',
        prompt: `A frog starts at ${s} and jumps on ${k} each time. Which number does it land on?`,
        ...numChoice(rng, ans, offs.map((d) => ({ value: ans + d, why: `The frog lands on ${s}, ${s + k}, ${s + 2 * k} and so on. ${ans + d} falls between two landing numbers.` })), { spread: [k + 1, -k - 1] }),
        hints: ['Count on from the start in equal jumps.', `The frog lands on ${s}, ${s + k}, ${s + 2 * k}, ... Keep going.`, `Each landing number is ${s} plus a number in the ${k} times table.`],
        explanation: `${ans} = ${s} + ${m} × ${k}, so the frog lands on ${ans} after ${m} jumps.`,
        tags: WORD,
      }
    }

    const countSay = (): GeneratedItem => {
      const name = pickName(rng)
      const back = rng.chance(0.6)
      const k = rng.pick([2, 5, 10, 25, 50, 100])
      const m = rng.int(5, 8)
      const s = back ? rng.int(m, 9) * k + (k < 10 ? rng.int(0, 9) : 0) : rng.int(1, 9) * (k >= 25 ? k : 1) + (k < 10 ? rng.int(0, 20) : 0)
      const nth = (i: number) => (back ? s - (i - 1) * k : s + (i - 1) * k)
      const ans = nth(m)
      return {
        type: 'numeric',
        prompt: `${name} counts ${back ? 'back' : 'on'} in ${k}s: ${nth(1)}, ${nth(2)}, ${nth(3)}, ... What is the ${ordinal(m)} number ${name} says?`,
        answer: ans,
        hints: [`Keep counting ${back ? 'back' : 'on'} in ${k}s.`, `${nth(1)} is the 1st number. Count each number as you say it.`, `The 4th number is ${nth(4)}.`],
        explanation: `${listAnd(range(1, m).map((i) => String(nth(i))))}. The ${ordinal(m)} number is ${ans}.`,
        tags: WORD,
      }
    }

    const sumParity = (): GeneratedItem => {
      const wantOdd = rng.chance(0.5)
      const n = (odd: boolean) => {
        const x = rng.int(100, 998)
        return odd ? (x % 2 === 1 ? x : x + 1) : x % 2 === 0 ? x : x + 1
      }
      const make = (p: boolean, q: boolean) => `${n(p)} + ${n(q)}`
      const correct = wantOdd ? make(true, false) : rng.chance(0.5) ? make(true, true) : make(false, false)
      const wrong = wantOdd
        ? [
            { value: make(true, true), why: 'Odd + odd always makes an even number.' },
            { value: make(false, false), why: 'Even + even always makes an even number.' },
            { value: make(true, true), why: 'Odd + odd always makes an even number.' },
          ]
        : [
            { value: make(true, false), why: 'Odd + even always makes an odd number.' },
            { value: make(false, true), why: 'Even + odd always makes an odd number.' },
            { value: make(true, false), why: 'Odd + even always makes an odd number.' },
          ]
      return {
        type: 'mcq',
        prompt: `Which total is ${wantOdd ? 'odd' : 'even'}? You do not need to work out the totals.`,
        ...textChoice(rng, correct, wrong),
        hints: ['Look only at the ones digit of each number.', 'Odd + odd = even. Even + even = even. Odd + even = odd.', `In ${correct.split(' + ')[0]}, the ones digit is ${Number(correct.split(' + ')[0]) % 10}.`],
        explanation: `${correct}: ${wantOdd ? 'an odd number plus an even number makes an odd total' : 'two numbers that are both odd or both even make an even total'}.`,
      }
    }

    const nthTerm = (): GeneratedItem => {
      const k = rng.pick([3, 4, 5, 6, 8, 9])
      const a = rng.int(2, 20)
      const nth = rng.pick([10, 12, 15, 20])
      const ans = a + (nth - 1) * k
      return {
        type: 'numeric',
        prompt: `What is the ${ordinal(nth)} number in the sequence ${a}, ${a + k}, ${a + 2 * k}, ${a + 3 * k}, ...?`,
        answer: ans,
        hints: ['You do not need to write every number.', `From the 1st number to the ${ordinal(nth)} there are ${nth - 1} jumps of ${k}.`, `${nth - 1} jumps of ${k} make ${(nth - 1) * k}.`],
        explanation: `${a} + ${nth - 1} × ${k} = ${a} + ${(nth - 1) * k} = ${ans}.`,
      }
    }

    if (level === 1) return oneOf(rng, [() => moreLess(false), () => oddEvenSort(false), () => seq([2, 5, 10], false)])
    if (level === 2) return oneOf(rng, [() => moreLess(true), () => seq([2, 5, 10, 100], false), () => seq([10, 100], true)])
    if (level === 3) return oneOf(rng, [() => seq([3, 4, 5, 25, 50], true), rule, chooseParity, () => oddEvenSort(true)])
    if (level === 4) return oneOf(rng, [frog, countSay, sumParity])
    return nthTerm()
  },
}

// ---------------------------------------------------------------------------
// Ni: penjumlahan dan pengurangan
// ---------------------------------------------------------------------------

const addSubMental: Generator = {
  skill: 'm3.add-sub-mental',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const bondTens = (): GeneratedItem => {
      const a = rng.int(1, 9) * 10
      return {
        type: 'numeric',
        prompt: `Find the missing number. ${a} + ___ = 100`,
        figure: { kind: 'numberline', min: 0, max: 100, step: 10, labels: 'all', jumps: [{ from: a, to: 100 }], alt: `A number line from 0 to 100 with a jump from ${a} to 100.` },
        answer: 100 - a,
        hints: ['Think of tens that make 100.', `How many tens are in ${a}? How many more tens make 100?`, `${a} is ${T(a / 10)}.`],
        explanation: `${T(a / 10)} + ${T(10 - a / 10)} = 10 tens, so ${a} + ${100 - a} = 100.`,
      }
    }

    const addTens = (three: boolean, cross: boolean): GeneratedItem => {
      const add = rng.chance(0.5)
      const big = three && !cross && rng.chance(0.4)
      const m = big ? rng.int(1, 4) * 100 : rng.int(1, 6) * 10
      let n = three ? rng.int(120, 880) : rng.int(12, 89)
      const p = big ? 2 : 1
      for (let i = 0; i < 50; i++) {
        const sum = add ? digitAt(n, p) + m / 10 ** p : digitAt(n, p) - m / 10 ** p
        const crosses = add ? sum > 9 : sum < 0
        const fits = add ? n + m <= (three ? 999 : 99) : n - m >= (three ? 100 : 10)
        if (crosses === cross && fits) break
        n = three ? rng.int(120, 880) : rng.int(12, 89)
      }
      const ans = add ? n + m : n - m
      return {
        type: 'numeric',
        prompt: `${n} ${add ? '+' : '-'} ${m} = ___`,
        answer: ans,
        hints: [
          `Which digit of ${n} changes?`,
          big ? `${m} is ${H(m / 100)}, so only the hundreds change.` : `${m} is ${T(m / 10)}. Count ${add ? 'on' : 'back'} in tens.`,
          cross ? `${add ? 'Count on' : 'Count back'} in tens: the tens digit goes past ${add ? '9' : '0'}, so the hundreds change too.` : `The ${PLACES[p]} digit of ${n} is ${digitAt(n, p)}.`,
        ],
        explanation: `${n} ${add ? '+' : '-'} ${m} = ${ans}.`,
      }
    }

    const bond2 = (): GeneratedItem => {
      const a = rng.int(11, 89)
      const aa = a % 10 === 0 ? a + 3 : a
      const next = Math.ceil(aa / 10) * 10
      return {
        type: 'numeric',
        prompt: `Find the missing number. ${aa} + ___ = 100`,
        answer: 100 - aa,
        hints: ['Make the next ten first, then make 100.', `How far is ${aa} from ${next}?`, `${aa} + ${next - aa} = ${next}.`],
        explanation: `${aa} + ${next - aa} = ${next}, and ${next} + ${100 - next} = 100. ${next - aa} + ${100 - next} = ${100 - aa}.`,
        solution: [
          { say: `Count on from ${aa} to the next ten.`, show: `${aa} + ${next - aa} = ${next}` },
          { say: 'Count on in tens to 100.', show: `${next} + ${100 - next} = 100` },
          { say: 'Add the two jumps.', show: `${next - aa} + ${100 - next} = ${100 - aa}` },
        ],
      }
    }

    const bond1000 = (tens: boolean): GeneratedItem => {
      const a = tens ? rng.int(11, 89) * 10 : rng.int(1, 9) * 100
      const aa = tens && a % 100 === 0 ? a + 30 : a
      const ans = 1000 - aa
      return {
        type: 'numeric',
        prompt: `Find the missing number. ${aa} + ___ = 1,000`,
        answer: ans,
        hints: tens
          ? ['Make the next hundred first.', `How far is ${aa} from ${Math.ceil(aa / 100) * 100}?`, `${aa} + ${Math.ceil(aa / 100) * 100 - aa} = ${Math.ceil(aa / 100) * 100}.`]
          : ['Think of hundreds that make 1,000.', '1,000 is 10 hundreds.', `${aa} is ${H(aa / 100)}.`],
        explanation: `${aa} + ${ans} = 1,000.`,
      }
    }

    const twoDigit = (): GeneratedItem => {
      const add = rng.chance(0.55)
      if (add) {
        const ao = rng.int(2, 9)
        const bo = rng.int(10 - ao, 9)
        const at = rng.int(2, 7)
        const bt = rng.int(1, 9 - at)
        const a = at * 10 + ao
        const b = bt * 10 + bo
        const tb = bt * 10
        return {
          type: 'numeric',
          prompt: `${a} + ${b} = ___`,
          answer: a + b,
          hints: ['Split the second number into tens and ones.', `Add the tens of ${b} first, then the ones.`, `${a} + ${tb} = ${a + tb}.`],
          explanation: `${a} + ${tb} = ${a + tb}, then ${a + tb} + ${b % 10} = ${a + b}.`,
          solution: [
            { say: `Split ${b} into ${tb} and ${b % 10}.`, show: `${b} = ${tb} + ${b % 10}` },
            { say: 'Add the tens.', show: `${a} + ${tb} = ${a + tb}` },
            { say: 'Add the ones.', show: `${a + tb} + ${b % 10} = ${a + b}` },
          ],
        }
      }
      const ao = rng.int(0, 8)
      const bo = rng.int(ao + 1, 9)
      const at = rng.int(4, 9)
      const bt = rng.int(1, at - 1)
      const a = at * 10 + ao
      const b = bt * 10 + bo
      const tb = bt * 10
      return {
        type: 'numeric',
        prompt: `${a} - ${b} = ___`,
        answer: a - b,
        hints: ['Split the number you take away into tens and ones.', 'Take away the tens first, then the ones.', `${a} - ${tb} = ${a - tb}.`],
        explanation: `${a} - ${tb} = ${a - tb}, then ${a - tb} - ${b % 10} = ${a - b}.`,
        solution: [
          { say: `Split ${b} into ${tb} and ${b % 10}.`, show: `${b} = ${tb} + ${b % 10}` },
          { say: 'Take away the tens.', show: `${a} - ${tb} = ${a - tb}` },
          { say: 'Take away the ones.', show: `${a - tb} - ${b % 10} = ${a - b}` },
        ],
      }
    }

    const compensate = (): GeneratedItem => {
      const k = rng.pick([9, 19, 29, 99])
      const add = rng.chance(0.5)
      const n = add ? rng.int(120, 999 - k - 1) : rng.int(Math.max(130, k + 30), 990)
      const r = k + 1
      const ans = add ? n + k : n - k
      if (rng.chance(0.4)) {
        const correct = add ? `${n} + ${r} - 1` : `${n} - ${r} + 1`
        return {
          type: 'mcq',
          prompt: `Which is a quick way to work out ${n} ${add ? '+' : '-'} ${k}?`,
          ...textChoice(rng, correct, add
            ? [
                { value: `${n} + ${r} + 1`, why: `This adds ${r + 1}. ${k} is 1 less than ${r}, so take 1 away.` },
                { value: `${n} - ${r} + 1`, why: `This takes away. The question adds ${k}.` },
                { value: `${n} + ${r - 10} + 1`, why: `${r - 10} + 1 is ${r - 9}. That adds too little.` },
              ]
            : [
                { value: `${n} - ${r} - 1`, why: `This takes away ${r + 1}. Take away ${r}, then add 1 back.` },
                { value: `${n} + ${r} - 1`, why: `This adds. The question takes away ${k}.` },
                { value: `${n} - ${r - 10} - 1`, why: `${r - 10} + 1 is ${r - 9}. That takes away too little.` },
              ]),
          hints: [`${k} is very close to ${r}.`, `${add ? 'Adding' : 'Taking away'} ${r} is easy. Then fix the extra 1.`, `${k} = ${r} - 1.`],
          explanation: `${k} is ${r} - 1. So ${n} ${add ? '+' : '-'} ${k} = ${correct} = ${ans}.`,
        }
      }
      return {
        type: 'numeric',
        prompt: `${n} ${add ? '+' : '-'} ${k} = ___`,
        answer: ans,
        hints: [`${k} is very close to ${r}.`, `${add ? 'Add' : 'Take away'} ${r}, then ${add ? 'take away' : 'add back'} 1.`, `${n} ${add ? '+' : '-'} ${r} = ${add ? n + r : n - r}.`],
        explanation: `${n} ${add ? '+' : '-'} ${r} = ${add ? n + r : n - r}. ${add ? 'Take away 1' : 'Add 1 back'} to get ${ans}.`,
        tip: 'Numbers ending in 9 are easy to round to the next ten.',
      }
    }

    const story = (): GeneratedItem => {
      const name = pickName(rng)
      const kind = rng.int(0, 3)
      if (kind === 0) {
        const s = rng.int(25, 60) * 10
        const a = rng.int(8, 20) * 10
        const b = rng.int(3, Math.min(15, (s - a) / 10 - 2)) * 10
        return {
          type: 'numeric',
          prompt: `A shop had ${s} eggs. It sold ${a} in the morning and ${b} in the afternoon. How many eggs are left?`,
          answer: s - a - b,
          hints: ['There are two amounts to take away.', `Take away ${a} first, then ${b}.`, `${s} - ${a} = ${s - a}.`],
          explanation: `${s} - ${a} = ${s - a}, then ${s - a} - ${b} = ${s - a - b}.`,
          tags: WORD,
        }
      }
      if (kind === 1) {
        const p = rng.int(25, 55)
        const off = rng.int(8, p - 10)
        const on = rng.int(6, 25)
        return {
          type: 'numeric',
          prompt: `A bus had ${p} passengers. At the next stop ${off} got off and ${on} got on. How many passengers are on the bus now?`,
          answer: p - off + on,
          hints: ['First take away the people who got off.', 'Then add the people who got on.', `${p} - ${off} = ${p - off}.`],
          explanation: `${p} - ${off} = ${p - off}, then ${p - off} + ${on} = ${p - off + on}.`,
          tags: WORD,
        }
      }
      if (kind === 2) {
        const a = rng.int(28, 79)
        let b = rng.int(16, 69)
        if (b % 10 === 0) b += rng.int(1, 9)
        return {
          type: 'numeric',
          prompt: `${name} walked ${a} steps to the shop and ${b} steps back home. How many steps did ${name} walk altogether?`,
          answer: a + b,
          hints: ['Altogether means add.', `Split ${b} into tens and ones.`, `${a} + ${Math.floor(b / 10) * 10} = ${a + Math.floor(b / 10) * 10}.`],
          explanation: `${a} + ${b} = ${a + b}.`,
          tags: WORD,
        }
      }
      const n = rng.int(30, 70) * 10
      const a = rng.int(5, 25) * 10
      const b = rng.int(5, 20) * 10
      return {
        type: 'numeric',
        prompt: `A library had ${n} books. It bought ${a} new books, then lent out ${b}. How many books are on the shelves now?`,
        answer: n + a - b,
        hints: ['Work in two steps.', `Add the new books first, then take away the books lent out.`, `${n} + ${a} = ${n + a}.`],
        explanation: `${n} + ${a} = ${n + a}, then ${n + a} - ${b} = ${n + a - b}.`,
        tags: WORD,
      }
    }

    const difference = (): GeneratedItem => {
      const h = rng.int(2, 9) * 100
      const a = h + rng.int(1, 15)
      const b = h - rng.int(2, 15)
      return {
        type: 'numeric',
        prompt: `Find the difference between ${a} and ${b}.`,
        figure: { kind: 'numberline', min: b, max: a, step: 1, labels: [b, h, a], jumps: [{ from: b, to: h }, { from: h, to: a }], alt: `A number line from ${b} to ${a} with jumps from ${b} to ${h} and from ${h} to ${a}.` },
        answer: a - b,
        hints: ['The numbers are close, so count up from the smaller one.', `Count up from ${b} to ${h}, then on to ${a}.`, `From ${b} to ${h} is ${h - b}.`],
        explanation: `${b} to ${h} is ${h - b}, and ${h} to ${a} is ${a - h}. ${h - b} + ${a - h} = ${a - b}.`,
      }
    }

    const missing = (): GeneratedItem => {
      const kind = rng.int(0, 2)
      if (kind === 0) {
        let b = rng.int(21, 89)
        if (b % 10 === 0) b += rng.int(1, 9)
        const c = rng.int(110, 600)
        return {
          type: 'numeric',
          prompt: `Find the missing number. ___ - ${b} = ${c}`,
          answer: b + c,
          hints: ['Adding undoes taking away.', `The missing number is ${b} more than ${c}.`, `Start with ${c} + ${Math.floor(b / 10) * 10} = ${c + Math.floor(b / 10) * 10}.`],
          explanation: `${c} + ${b} = ${b + c}. Check: ${b + c} - ${b} = ${c}.`,
        }
      }
      if (kind === 1) {
        const a = rng.int(120, 480)
        const c = a + rng.int(130, 420)
        return {
          type: 'numeric',
          prompt: `Find the missing number. ${a} + ___ = ${c}`,
          answer: c - a,
          hints: ['Taking away undoes adding.', `Work out ${c} - ${a}, or count up from ${a} to ${c}.`, `From ${a} to ${Math.ceil(a / 100) * 100} is ${Math.ceil(a / 100) * 100 - a}.`],
          explanation: `${c} - ${a} = ${c - a}. Check: ${a} + ${c - a} = ${c}.`,
        }
      }
      const s = rng.int(150, 600)
      const x = rng.pick([99, 49, 29])
      const y = rng.pick([19, 9, 11, 21])
      const ans = s + x - y
      return {
        type: 'numeric',
        prompt: `Start at ${s}. Add ${x}, then take away ${y}. What number do you finish on?`,
        answer: ans,
        hints: ['Do one step at a time.', `Adding ${x} is the same as adding ${x + 1} and taking away 1.`, `${s} + ${x} = ${s + x}.`],
        explanation: `${s} + ${x} = ${s + x}, then ${s + x} - ${y} = ${ans}.`,
      }
    }

    if (level === 1) return oneOf(rng, [bondTens, () => addTens(false, false)])
    if (level === 2) return oneOf(rng, [bond2, () => bond1000(false), () => addTens(true, false)])
    if (level === 3) return oneOf(rng, [twoDigit, () => addTens(true, true), compensate, () => bond1000(true)])
    if (level === 4) return oneOf(rng, [story, difference])
    return missing()
  },
}

const addSubColumns: Generator = {
  skill: 'm3.add-sub-columns',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const add = (pattern: boolean[], fallback: [number, number]): GeneratedItem => {
      const [a, b] = addPairWith(rng, 3, pattern, fallback)
      const s = a + b
      const carries = pattern.filter(Boolean).length
      return {
        type: 'numeric',
        prompt: `Work out ${a} + ${b}.`,
        figure: columnFig('+', a, b),
        answer: s,
        hints: [
          'Line up the hundreds, tens and ones.',
          carries ? 'Start with the ones. If a column makes 10 or more, carry 1 into the next column.' : 'Start with the ones, then add the tens, then the hundreds.',
          `Ones: ${digitAt(a, 0)} + ${digitAt(b, 0)} = ${digitAt(a, 0) + digitAt(b, 0)}.`,
        ],
        explanation: `${a} + ${b} = ${s}.${carries ? ` You carry ${carries === 1 ? 'once' : 'twice'}.` : ''}`,
        solution: [{ say: 'Write the numbers in columns.', figure: columnFig('+', a, b) }, ...addSteps(a, b), { say: 'Read the answer.', figure: columnFig('+', a, b, s) }].slice(0, 8),
      }
    }

    const sub = (kind: 'none' | 'one' | 'zero'): GeneratedItem => {
      const [a, b] = subPairWith(
        rng,
        3,
        (x, y, f) => {
          if (x - y < 100) return false
          if (kind === 'none') return f.every((v) => !v)
          if (kind === 'one') return f.filter(Boolean).length === 1
          return digitAt(x, 1) === 0 && f[0] === true && digitAt(y, 1) > 0
        },
        kind === 'none' ? [586, 243] : kind === 'one' ? [562, 238] : [503, 278],
      )
      const d = a - b
      return {
        type: 'numeric',
        prompt: `Work out ${a} - ${b}.`,
        figure: columnFig('-', a, b),
        answer: d,
        hints: [
          'Line up the hundreds, tens and ones.',
          kind === 'none' ? 'Start with the ones, then the tens, then the hundreds.' : 'If the top digit is smaller, exchange 1 from the next column on the left.',
          `Ones: can you take ${digitAt(b, 0)} from ${digitAt(a, 0)}?`,
        ],
        explanation: `${a} - ${b} = ${d}. Check: ${d} + ${b} = ${a}.`,
        solution: [{ say: 'Write the numbers in columns.', figure: columnFig('-', a, b) }, ...subSteps(a, b), { say: 'Check with addition.', show: `${d} + ${b} = ${a}` }].slice(0, 8),
      }
    }

    const story = (): GeneratedItem => {
      const kind = rng.int(0, 3)
      const name = pickName(rng)
      if (kind === 0) {
        const [a, b] = addPairWith(rng, 3, [true, rng.chance(0.5)], [465, 278])
        return {
          type: 'numeric',
          prompt: `A school library has ${a} books. It buys ${b} more books. How many books does it have now?`,
          answer: a + b,
          hints: ['Is this an adding or a taking away problem?', 'Buying more books makes the total bigger, so add.', `Ones: ${digitAt(a, 0)} + ${digitAt(b, 0)} = ${digitAt(a, 0) + digitAt(b, 0)}.`],
          explanation: `${a} + ${b} = ${a + b}.`,
          solution: [{ say: 'Add the two amounts in columns.', figure: columnFig('+', a, b) }, ...addSteps(a, b)].slice(0, 8),
          tags: WORD,
        }
      }
      if (kind === 1) {
        const [a, b] = subPairWith(rng, 3, (_x, _y, f) => f.some(Boolean), [532, 287])
        return {
          type: 'numeric',
          prompt: `A train has ${a} seats. ${b} seats are taken. How many seats are empty?`,
          answer: a - b,
          hints: ['Some seats are taken. The rest are empty.', 'Take away the seats that are taken.', `Write ${a} - ${b} in columns and start with the ones.`],
          explanation: `${a} - ${b} = ${a - b}.`,
          solution: [{ say: 'Subtract in columns.', figure: columnFig('-', a, b) }, ...subSteps(a, b)].slice(0, 8),
          tags: WORD,
        }
      }
      if (kind === 2) {
        const a = rng.int(215, 480)
        const more = rng.int(126, 999 - a - 20)
        const other = rng.pick(NAMES.filter((x) => x !== name))
        return {
          type: 'numeric',
          prompt: `${name} scores ${a} points in a game. ${other} scores ${more} more points than ${name}. How many points does ${other} score?`,
          answer: a + more,
          hints: [`${other} scores more, so the answer is bigger than ${a}.`, `Add ${more} to ${a}.`, `Ones: ${digitAt(a, 0)} + ${digitAt(more, 0)} = ${digitAt(a, 0) + digitAt(more, 0)}.`],
          explanation: `${a} + ${more} = ${a + more}.`,
          tags: WORD,
        }
      }
      const [d, b] = [rng.int(212, 489), rng.int(128, 467)]
      const a = d + b > 999 ? d : d + b
      const bb = a === d ? rng.int(105, d - 100) : b
      const res = a - bb
      return {
        type: 'mcq',
        prompt: `${a} - ${bb} = ${res}. Which calculation checks this answer?`,
        ...textChoice(rng, `${res} + ${bb}`, [
          { value: `${a} + ${bb}`, why: `${a} + ${bb} is ${a + bb}. To check, add the answer to the number taken away.` },
          { value: `${res} - ${bb}`, why: 'This takes away again. Adding undoes taking away.' },
          { value: `${a} + ${res}`, why: `${a} + ${res} is ${a + res}, which does not give back ${a}.` },
        ]),
        hints: ['Adding and taking away undo each other.', 'Add the answer to the number that was taken away. You should get back the first number.', `The first number is ${a}. Which calculation should make ${a}?`],
        explanation: `${res} + ${bb} = ${a}, so it checks that ${a} - ${bb} = ${res}.`,
      }
    }

    const missingDigit = (): GeneratedItem => {
      const [a, b] = addPairWith(rng, 3, [true, rng.chance(0.5)], [356, 248])
      const s = a + b
      const pos = rng.int(1, 2)
      const d = digitAt(a, pos)
      const aStr = String(a).split('').map((c, i, arr) => (arr.length - 1 - i === pos ? '?' : c)).join('')
      return {
        type: 'numeric',
        prompt: `Find the missing digit. ${aStr} + ${b} = ${s}`,
        answer: d,
        hints: ['Work from the ones column, like column addition.', `You can also work out ${s} - ${b} to find the first number.`, `Ones: ${digitAt(a, 0)} + ${digitAt(b, 0)} = ${digitAt(a, 0) + digitAt(b, 0)}.`],
        explanation: `${s} - ${b} = ${a}, so the missing digit is ${d}.`,
        solution: [{ say: 'Use the inverse: take away to find the first number.', figure: columnFig('-', s, b) }, ...subSteps(s, b)].slice(0, 8),
      }
    }

    if (level === 1) return rng.chance(0.5) ? add([false, false, false], [342, 135]) : sub('none')
    if (level === 2) return rng.chance(0.5) ? add(rng.chance(0.5) ? [true, false, false] : [false, true, false], [347, 128]) : sub('one')
    if (level === 3) return rng.chance(0.5) ? add([true, true, false], [358, 276]) : sub('zero')
    if (level === 4) return story()
    return missingDigit()
  },
}

// ---------------------------------------------------------------------------
// Ni: perkalian dan pembagian
// ---------------------------------------------------------------------------

const TABLES3 = [2, 3, 4, 5, 6, 8, 9, 10] as const

const GROUP_STORIES: readonly { t: number | null; make: (n: number, t: number) => string; unit: string }[] = [
  { t: 8, make: (n) => `A spider has 8 legs. How many legs do ${n} spiders have?`, unit: 'legs' },
  { t: 6, make: (n) => `An ant has 6 legs. How many legs do ${n} ants have?`, unit: 'legs' },
  { t: 4, make: (n) => `A car has 4 wheels. How many wheels do ${n} cars have?`, unit: 'wheels' },
  { t: null, make: (n, t) => `There are ${n} tables. ${t} children sit at each table. How many children are there?`, unit: 'children' },
  { t: null, make: (n, t) => `Pencils come in packs of ${t}. How many pencils are in ${n} packs?`, unit: 'pencils' },
  { t: null, make: (n, t) => `The hall has ${n} rows of chairs with ${t} chairs in each row. How many chairs are there?`, unit: 'chairs' },
]

const timesTables3: Generator = {
  skill: 'm3.times-tables',
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
        hints: [`Use the ${t} times table.`, `Count in ${t}s, ${n} times.`, n > 5 ? `5 × ${t} = ${5 * t}. Count on ${n - 5} more ${t}s.` : `Start at ${t} and count on in ${t}s.`],
        explanation: `${n} groups of ${t} make ${p}, so ${n} × ${t} = ${p}.`,
      }
    }

    const arrayCount = (): GeneratedItem => {
      const t = rng.pick([2, 5, 10])
      const r = rng.int(2, 6)
      const th = things(rng, ['apple', 'cookie', 'muffin', 'flower', 'star', 'egg', 'strawberry'])
      const figure: Fig = { kind: 'array', rows: r, cols: t, icon: th.icon, alt: `${r} rows of ${t} ${th.many}.` }
      return {
        type: 'numeric',
        prompt: `There are ${r} rows of ${t} ${th.many}. How many ${th.many} are there?`,
        figure,
        answer: r * t,
        hints: ['Count one row first.', `Each row has ${t}. Count in ${t}s, one row at a time.`, `Row 1 makes ${t}. Keep counting in ${t}s for each row.`],
        explanation: `${r} rows of ${t} is ${r} × ${t} = ${r * t}.`,
        solution: [
          { say: `There are ${r} rows with ${t} in each row.`, figure },
          { say: `Count in ${t}s.`, show: range(1, r).map((i) => i * t).join(', ') },
          { say: 'Write the multiplication.', show: `${r} × ${t} = ${r * t}` },
        ],
      }
    }

    const missingFactor = (): GeneratedItem => {
      const t = rng.pick([3, 4, 6, 8])
      const n = rng.int(2, 10)
      const p = n * t
      const left = rng.chance(0.5)
      return {
        type: 'numeric',
        prompt: left ? `___ × ${t} = ${p}` : `${t} × ___ = ${p}`,
        answer: n,
        hints: [`Use the ${t} times table.`, `Count in ${t}s until you reach ${p}.`, `Keep track of how many ${t}s you count on your fingers.`],
        explanation: `${n} × ${t} = ${p}, so the missing number is ${n}.`,
      }
    }

    const whichMultiple = (): GeneratedItem => {
      const t = rng.pick([3, 4, 6, 8, 9])
      const k = rng.int(4, 10)
      const ans = k * t
      const ds = [ans + 1, ans - 1, ans + 2, ans - 2, ans + t + 1, ans - t + 1].filter((x) => x % t !== 0 && x > 0)
      return {
        type: 'mcq',
        prompt: `Which number is in the ${t} times table?`,
        ...numChoice(rng, ans, rng.shuffle(ds).map((x) => ({ value: x, why: `${x} is between ${Math.floor(x / t) * t} and ${Math.ceil(x / t) * t} in the ${t} times table.` })), { spread: [] }),
        hints: [`Count in ${t}s.`, `Numbers in the ${t} times table are ${t}, ${2 * t}, ${3 * t} and so on.`, `Try dividing each number into groups of ${t}.`],
        explanation: `${ans} = ${k} × ${t}, so it is in the ${t} times table.`,
      }
    }

    const double = (): GeneratedItem => {
      const pair = rng.pick([[2, 4], [4, 8], [3, 6], [5, 10]] as const)
      const n = rng.int(3, 9)
      const known = n * pair[0]
      return {
        type: 'numeric',
        prompt: `${n} × ${pair[0]} = ${known}. What is ${n} × ${pair[1]}?`,
        answer: n * pair[1],
        hints: [`How are ${pair[0]} and ${pair[1]} linked?`, `${pair[1]} is double ${pair[0]}, so the answer is double ${known}.`, `Double the tens of ${known} first.`],
        explanation: `${pair[1]} is double ${pair[0]}, so ${n} × ${pair[1]} is double ${known}, which is ${n * pair[1]}.`,
      }
    }

    const match = (): GeneratedItem => {
      const used = new Set<number>()
      const pairs: [string, string][] = []
      for (let i = 0; i < 40 && pairs.length < 4; i++) {
        const t = rng.pick([3, 4, 6, 8, 9])
        const n = rng.int(3, 10)
        if (used.has(n * t)) continue
        used.add(n * t)
        pairs.push([`${n} × ${t}`, String(n * t)])
      }
      return {
        type: 'match',
        prompt: 'Match each multiplication to its answer.',
        pairs,
        hints: ['Start with the fact you know best.', 'Count in steps of the times table if you need to.', `${pairs[0]![0]}: count in ${pairs[0]![0].split(' × ')[1]}s.`],
        explanation: pairs.map(([q, a]) => `${q} = ${a}`).join('. ') + '.',
      }
    }

    const story = (): GeneratedItem => {
      const st = rng.pick(GROUP_STORIES)
      const t = st.t ?? rng.pick([3, 4, 5, 6, 8, 9])
      const n = rng.int(3, 9)
      if (rng.chance(0.35)) {
        const name = pickName(rng)
        const k = rng.int(2, Math.min(9, n * t - 5))
        return {
          type: 'numeric',
          prompt: `${name} buys ${n} packs of ${t} stickers. ${name} gives away ${k} stickers. How many stickers are left?`,
          answer: n * t - k,
          hints: ['First find how many stickers there are altogether.', `Multiply, then take away the ${k} stickers.`, `${n} × ${t} = ${n * t}.`],
          explanation: `${n} × ${t} = ${n * t}, then ${n * t} - ${k} = ${n * t - k}.`,
          tags: WORD,
        }
      }
      return {
        type: 'numeric',
        prompt: st.make(n, t),
        answer: n * t,
        hints: ['Look for equal groups.', `There are ${n} groups of ${t}.`, `Count in ${t}s, ${n} times.`],
        explanation: `${n} × ${t} = ${n * t}, so there are ${n * t} ${st.unit}.`,
        tags: WORD,
      }
    }

    const common = (): GeneratedItem => {
      const pairs = [[2, 3], [3, 4], [4, 6], [6, 8], [3, 5], [4, 5], [6, 9], [2, 9], [3, 8], [5, 6], [4, 10], [8, 10]] as const
      const [a, b] = rng.pick(pairs)
      const l = (a * b) / gcd2(a, b)
      const maxK = Math.floor((10 * Math.min(a, b)) / l)
      const m = l * rng.int(1, Math.max(1, maxK))
      const lo = m - rng.int(1, l - 1)
      const hi = m + rng.int(1, l - 1)
      return {
        type: 'numeric',
        prompt: `Which number is in the ${a} and ${b} times tables, and between ${lo} and ${hi}?`,
        answer: m,
        hints: ['List some numbers in each times table.', `Write the ${a} times table and the ${b} times table. Look for a number in both lists.`, `Count in ${b}s. Check each number: is it in the ${a} times table too?`],
        explanation: `${m} = ${m / a} × ${a} and ${m} = ${m / b} × ${b}. It is the only number in both tables between ${lo} and ${hi}.`,
      }
    }

    if (level === 1) return oneOf(rng, [arrayCount, () => fact([2, 5, 10])])
    if (level === 2) return oneOf(rng, [() => fact([3, 4, 6, 8]), missingFactor, whichMultiple])
    if (level === 3) return oneOf(rng, [() => fact([6, 8, 9]), double, match])
    if (level === 4) return story()
    return common()
  },
}

function gcd2(a: number, b: number): number {
  return b === 0 ? a : gcd2(b, a % b)
}

const division3: Generator = {
  skill: 'm3.division',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const share = (): GeneratedItem => {
      const t = rng.int(2, 5)
      const k = rng.int(3, Math.floor(20 / t))
      const n = t * k
      const th = things(rng, ['cookie', 'apple', 'sweet', 'strawberry', 'egg', 'muffin'])
      const box = rng.pick(['plates', 'bags', 'boxes'])
      return {
        type: 'numeric',
        prompt: `Share ${n} ${th.many} equally between ${t} ${box}. How many ${th.many} go in each?`,
        figure: { kind: 'objects', items: [{ icon: th.icon, count: n }], alt: `There are ${n} ${th.many}.` },
        answer: k,
        hints: [`Give one to each of the ${t} ${box}, then another, until all are shared.`, `You need ${t} equal groups. Use the ${t} times table.`, `${t} × ? = ${n}. Count in ${t}s up to ${n}.`],
        explanation: `${n} ÷ ${t} = ${k} because ${t} × ${k} = ${n}.`,
        solution: [
          { say: `Share the ${th.many} into ${t} equal groups.`, figure: { kind: 'groups', groups: Array.from({ length: t }, () => k), icon: th.icon, container: box === 'plates' ? 'plate' : box === 'bags' ? 'bag' : 'box', alt: `${t} groups of ${k} ${th.many}.` } },
          { say: `Each group has ${k}.`, show: `${n} ÷ ${t} = ${k}` },
        ],
      }
    }

    const fact = (tables: readonly number[]): GeneratedItem => {
      const t = rng.pick(tables)
      const k = rng.int(2, 10)
      const n = t * k
      // patokan yang bukan jawaban dan hasilnya juga bukan jawaban
      const bm = [5, 10, 2].find((x) => x !== k && x * t !== k) ?? 5
      return {
        type: 'numeric',
        prompt: `${n} ÷ ${t} = ___`,
        answer: k,
        hints: [`Use the ${t} times table.`, `How many ${t}s make ${n}?`, `${bm} × ${t} = ${bm * t}. Is ${n} more or less than that?`],
        explanation: `${k} × ${t} = ${n}, so ${n} ÷ ${t} = ${k}.`,
      }
    }

    const family = (): GeneratedItem => {
      const [a, b] = rng.sample([3, 4, 5, 6, 8, 9], 2) as [number, number]
      const p = a * b
      const correct = rng.chance(0.5) ? `${p} ÷ ${a} = ${b}` : `${p} ÷ ${b} = ${a}`
      return {
        type: 'mcq',
        prompt: `${a} × ${b} = ${p}. Which division fact is in the same fact family?`,
        ...textChoice(rng, correct, [
          { value: `${a} ÷ ${b} = ${p}`, why: `When you divide, start with the biggest number, ${p}.` },
          { value: `${p} ÷ ${a} = ${b + 1}`, why: `${a} × ${b + 1} = ${a * (b + 1)}, so this is wrong.` },
          { value: `${p} × ${a} = ${b}`, why: `This uses ×. ${p} × ${a} is much bigger than ${b}.` },
        ]),
        hints: ['A fact family uses the same three numbers.', 'Division undoes multiplication.', `The three numbers are ${a}, ${b} and ${p}.`],
        explanation: `${a} × ${b} = ${p}, so ${p} ÷ ${a} = ${b} and ${p} ÷ ${b} = ${a}.`,
      }
    }

    const remainder = (asText: boolean): GeneratedItem => {
      const t = rng.pick([2, 3, 4, 5, 6, 8, 9, 10])
      const q = rng.int(2, 9)
      const r = rng.int(1, t - 1)
      const n = q * t + r
      const th = things(rng, ['sweet', 'marble', 'pencil', 'button', 'shell'])
      const figure: Fig | undefined = n <= 20 ? { kind: 'objects', items: [{ icon: th.icon, count: n }], alt: `There are ${n} ${th.many}.` } : undefined
      const hints = [`Use the ${t} times table.`, `Find the biggest number in the ${t} times table that is not more than ${n}.`, `${q - 1} × ${t} = ${(q - 1) * t}. Can you fit one more ${t}?`]
      const explanation = `${q} × ${t} = ${q * t}, and ${n} - ${q * t} = ${r}. So ${n} ÷ ${t} = ${q} r ${r}.`
      if (asText) {
        return {
          type: 'text',
          prompt: `${n} ÷ ${t} = ___ r ___`,
          ...(figure ? { figure } : {}),
          blanks: [{ answers: [String(q)] }, { answers: [String(r)] }],
          hints,
          explanation,
        }
      }
      return {
        type: 'numeric',
        prompt: `What is the remainder when ${n} is divided by ${t}?`,
        ...(figure ? { figure } : {}),
        answer: r,
        hints: [hints[0]!, hints[1]!, `How many ${t}s fit into ${n}? Then find how many are left.`],
        explanation,
      }
    }

    const story = (): GeneratedItem => {
      const kind = rng.int(0, 2)
      const t = rng.int(3, 6)
      const q = rng.int(3, 8)
      let r = rng.int(1, t - 1)
      if (r === q || r === q + 1) r = r === 1 ? 2 : 1
      const n = q * t + r
      const name = pickName(rng)
      if (kind === 0) {
        return {
          type: 'mcq',
          prompt: `${n} children go on a trip. Each car takes ${t} children. How many cars are needed?`,
          ...textChoice(rng, String(q + 1), [
            { value: String(q), why: `${q} cars only take ${q * t} children. ${r} more children still need a car.` },
            { value: `${q} r ${r}`, why: 'You cannot have part of a car. Every child needs a seat.' },
            { value: String(r), why: `${r} is the number of children left over after ${q} full cars.` },
          ]),
          hints: [`Work out ${n} ÷ ${t}.`, 'Think about the children who are left over. They need a car too.', `${q} × ${t} = ${q * t}.`],
          explanation: `${n} ÷ ${t} = ${q} r ${r}. The ${r} children left over need one more car, so ${q + 1} cars are needed.`,
          tags: WORD,
        }
      }
      if (kind === 1) {
        return {
          type: 'numeric',
          prompt: `${name} has ${n} stickers. Each page of an album holds ${t} stickers. How many pages can ${name} fill?`,
          answer: q,
          hints: [`Work out ${n} ÷ ${t}.`, 'A page is only full when it has all its stickers.', `Count in ${t}s up to ${n} without going over.`],
          explanation: `${n} ÷ ${t} = ${q} r ${r}. ${name} fills ${q} pages and has ${plural(r, 'sticker', 'stickers')} left over.`,
          tags: WORD,
        }
      }
      return {
        type: 'numeric',
        prompt: `${n} eggs are packed into boxes of ${t}. How many eggs are left over?`,
        answer: r,
        hints: [`Work out ${n} ÷ ${t}.`, 'The eggs left over are the remainder.', `${q} × ${t} = ${q * t}.`],
        explanation: `${q} full boxes hold ${q * t} eggs. ${n} - ${q * t} = ${r}, so ${plural(r, 'egg is', 'eggs are')} left over.`,
        tags: WORD,
      }
    }

    const reverse = (): GeneratedItem => {
      const t = rng.int(3, 9)
      const q = rng.int(4, 10)
      const r = rng.int(1, t - 1)
      return {
        type: 'numeric',
        prompt: `A number is divided by ${t}. The answer is ${q} remainder ${r}. What is the number?`,
        answer: q * t + r,
        hints: ['Work backwards.', `Multiply ${q} by ${t}, then add the remainder.`, `${q} × ${t} = ${q * t}.`],
        explanation: `${q} × ${t} = ${q * t}, and ${q * t} + ${r} = ${q * t + r}. Check: ${q * t + r} ÷ ${t} = ${q} r ${r}.`,
      }
    }

    if (level === 1) return oneOf(rng, [share, () => fact([2, 5, 10])])
    if (level === 2) return oneOf(rng, [() => fact([3, 4, 6, 8, 9]), family])
    if (level === 3) return oneOf(rng, [() => remainder(true), () => remainder(false)])
    if (level === 4) return story()
    return reverse()
  },
}

const multiply2d1d: Generator = {
  skill: 'm3.multiply-2d-1d',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const tens = (): GeneratedItem => {
      const a = rng.int(1, 9)
      const b = rng.pick([2, 3, 4, 5, 6, 8, 9])
      return {
        type: 'numeric',
        prompt: rng.chance(0.5) ? `${a * 10} × ${b} = ___` : `${b} × ${a * 10} = ___`,
        figure: { kind: 'basetens', tens: a, alt: `Base ten blocks: ${plural(a, 'ten', 'tens')}, which is ${a * 10}.` },
        answer: a * b * 10,
        hints: ['Use a times table fact you know.', `${a * 10} is ${a} tens.`, `${a} × ${b} = ${a * b}.`],
        explanation: `${a} tens × ${b} = ${a * b} tens, which is ${a * b * 10}.`,
      }
    }

    const grid = (m: number, n: number): Fig => ({
      kind: 'table',
      head: ['×', String(Math.floor(n / 10) * 10), String(n % 10)],
      rows: [[String(m), String(Math.floor(n / 10) * 10 * m), String((n % 10) * m)]],
      alt: `Grid method: ${Math.floor(n / 10) * 10} × ${m} = ${Math.floor(n / 10) * 10 * m} and ${n % 10} × ${m} = ${(n % 10) * m}.`,
    })

    const partition = (big: boolean): GeneratedItem => {
      const m = big ? rng.pick([3, 4, 5, 6, 8]) : rng.int(2, 5)
      let n = big ? rng.int(23, 98) : rng.int(12, 48)
      if (n % 10 === 0) n += 3
      const tn = Math.floor(n / 10) * 10
      const on = n % 10
      const p = n * m
      const hints = ['Split the 2-digit number into tens and ones.', `${n} = ${tn} + ${on}. Multiply each part by ${m}.`, `${tn} × ${m} = ${tn * m}.`]
      const solution: Step[] = [
        { say: `Split ${n} into ${tn} and ${on}.`, show: `${n} = ${tn} + ${on}` },
        { say: 'Multiply each part.', figure: grid(m, n) },
        { say: 'Add the two parts.', show: `${tn * m} + ${on * m} = ${p}` },
      ]
      const explanation = `${tn} × ${m} = ${tn * m} and ${on} × ${m} = ${on * m}. ${tn * m} + ${on * m} = ${p}.`
      if (!big) {
        return {
          type: 'numeric',
          prompt: `Use the grid to work out ${n} × ${m}.`,
          figure: { kind: 'table', head: ['×', String(tn), String(on)], rows: [[String(m), '?', '?']], alt: `A grid to work out ${n} × ${m}: ${tn} and ${on} across the top and ${m} down the side.` },
          answer: p,
          hints,
          explanation,
          solution,
        }
      }
      const ds = [
        { value: tn * m + on, why: `This only multiplies the tens. The ${on} ones need multiplying by ${m} too.` },
        { value: n + m, why: 'This adds the numbers. × means groups of.' },
        { value: p + 10, why: 'Check the ones part again. Only carry the tens from it.' },
        { value: p - 10, why: `Check the ones part again. ${on} × ${m} = ${on * m}.` },
      ]
      if (on * m >= 10) ds.unshift({ value: Number(`${tn / 10 * m}${on * m}`), why: `The tens part is ${tn * m}. Add ${tn * m} and ${on * m}, do not write them side by side.` })
      return { type: 'mcq', prompt: `What is ${n} × ${m}?`, ...numChoice(rng, p, ds), hints, explanation, solution }
    }

    const story = (): GeneratedItem => {
      const m = rng.int(3, 9)
      const n = rng.int(12, 48)
      const name = pickName(rng)
      const ctx = rng.pick([
        { p: `A box holds ${n} eggs. How many eggs are in ${m} boxes?`, unit: 'eggs' },
        { p: `${name} reads ${n} pages every day. How many pages does ${name} read in ${m} days?`, unit: 'pages' },
        { p: `A minibus has ${n} seats. How many seats are there on ${m} minibuses?`, unit: 'seats' },
        { p: `A packet has ${n} crayons. How many crayons are in ${m} packets?`, unit: 'crayons' },
      ])
      const tn = Math.floor(n / 10) * 10
      if (n % 10 === 0) return story()
      return {
        type: 'numeric',
        prompt: ctx.p,
        answer: n * m,
        hints: ['Look for equal groups.', `Work out ${n} × ${m}. Split ${n} into tens and ones.`, `${tn} × ${m} = ${tn * m}.`],
        explanation: `${n} × ${m} = ${tn * m} + ${(n % 10) * m} = ${n * m} ${ctx.unit}.`,
        tags: WORD,
      }
    }

    const missingDigit = (): GeneratedItem => {
      const m = rng.int(3, 9)
      const t = rng.int(1, 9)
      const d = rng.int(1, 9)
      const n = t * 10 + d
      const p = n * m
      return {
        type: 'numeric',
        prompt: `Find the missing digit. ${t}? × ${m} = ${p}`,
        answer: d,
        hints: ['Use the tens first to see how much is left.', `${t * 10} × ${m} = ${t * 10 * m}. How much more is needed to make ${p}?`, `${p} - ${t * 10 * m} = ${p - t * 10 * m}.`],
        explanation: `${p} - ${t * 10 * m} = ${p - t * 10 * m}, and ${p - t * 10 * m} = ${d} × ${m}. So the number is ${n} and the missing digit is ${d}.`,
      }
    }

    if (level === 1) return tens()
    if (level === 2) return partition(false)
    if (level === 3) return partition(true)
    if (level === 4) return story()
    return missingDigit()
  },
}

// ---------------------------------------------------------------------------
// Nf: pecahan
// ---------------------------------------------------------------------------

export const frac = (n: number, d: number): string => `${n}/${d}`
export const FRAC_SHAPES = ['bar', 'circle', 'square'] as const
export type FracShape = (typeof FRAC_SHAPES)[number]

export function fracFig(shape: FracShape, parts: number, shaded: number): Fig {
  return { kind: 'fraction', shape, parts, shaded, alt: `A ${shape} cut into ${parts} equal parts with ${plural(shaded, 'part', 'parts')} shaded.` }
}

/** Pengecoh untuk soal "pecahan berapa yang diarsir". */
export function shadedWrong(s: number, d: number): { value: string; why: string }[] {
  return [
    { value: frac(d - s, d), why: `${frac(d - s, d)} is the part that is not shaded.` },
    { value: frac(s, d - s), why: `The bottom number is the number of equal parts altogether, which is ${d}.` },
    { value: frac(d, s), why: 'The top number shows the shaded parts. The bottom number shows all the equal parts.' },
    { value: frac(s, d + 1), why: `Count the equal parts again. There are ${d}.` },
    { value: frac(s + 1, d), why: `Count the shaded parts again. There ${s === 1 ? 'is' : 'are'} ${s}.` },
  ]
}

const SET_SHAPES = [
  { icon: 'star', one: 'star', many: 'stars' },
  { icon: 'heart', one: 'heart', many: 'hearts' },
  { icon: 'circle', one: 'circle', many: 'circles' },
  { icon: 'square', one: 'square', many: 'squares' },
  { icon: 'triangle', one: 'triangle', many: 'triangles' },
] as const

const fractions3: Generator = {
  skill: 'm3.fractions',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const nameIt = (unit: boolean): GeneratedItem => {
      const d = unit ? rng.pick([2, 3, 4]) : rng.pick([3, 4, 5, 6, 8, 10])
      const s = unit ? 1 : rng.int(2, d - 1)
      const shape = rng.pick(FRAC_SHAPES)
      return {
        type: 'mcq',
        prompt: 'What fraction of the shape is shaded?',
        figure: fracFig(shape, d, s),
        ...textChoice(rng, frac(s, d), shadedWrong(s, d)),
        hints: ['Count all the equal parts first.', 'The bottom number is all the equal parts. The top number is the shaded parts.', `There are ${d} equal parts.`],
        explanation: `${cap(plural(s, 'part is', 'parts are'))} shaded out of ${d} equal parts, so ${frac(s, d)} is shaded.`,
        solution: [
          { say: `Count all the equal parts. There are ${d}.`, figure: fracFig(shape, d, s) },
          { say: `Count the shaded parts. There ${s === 1 ? 'is' : 'are'} ${s}.` },
          { say: 'Write shaded parts over all parts.', show: frac(s, d) },
        ],
      }
    }

    const shade = (unit: boolean): GeneratedItem => {
      const d = unit ? rng.pick([2, 3, 4, 5]) : rng.pick([3, 4, 5, 6, 8, 10])
      const s = unit ? 1 : rng.int(2, d - 1)
      const shape = rng.pick(FRAC_SHAPES)
      return {
        type: 'fraction',
        prompt: `Shade ${frac(s, d)} of the ${shape}.`,
        shape,
        parts: d,
        answer: { num: s, den: d },
        hints: [`The bottom number, ${d}, tells you how many equal parts there are.`, `The top number, ${s}, tells you how many parts to shade.`, 'Shade the parts one at a time and count as you go.'],
        explanation: `${frac(s, d)} means ${s} of ${d} equal parts, so ${plural(s, 'part is', 'parts are')} shaded.`,
      }
    }

    const ofSet = (): GeneratedItem => {
      const [p, q] = rng.sample(SET_SHAPES, 2) as [(typeof SET_SHAPES)[number], (typeof SET_SHAPES)[number]]
      const a = rng.int(1, 5)
      let b = rng.int(2, 6)
      if (b === a) b += 1
      const total = a + b
      return {
        type: 'mcq',
        prompt: `What fraction of the shapes are ${p.many}?`,
        figure: { kind: 'objects', items: [{ icon: p.icon, count: a }, { icon: q.icon, count: b }], alt: `${plural(a, p.one, p.many)} and ${plural(b, q.one, q.many)}.` },
        ...textChoice(rng, frac(a, total), [
          { value: frac(a, b), why: `${frac(a, b)} compares the ${p.many} with the ${q.many}. The bottom number must be all ${total} shapes.` },
          { value: frac(b, total), why: `${frac(b, total)} is the fraction that are ${q.many}.` },
          { value: frac(total, a), why: `The top number shows the ${p.many}. The bottom number shows all the shapes.` },
        ]),
        hints: ['Count all the shapes first.', `The bottom number is the total. The top number is the number of ${p.many}.`, `There are ${total} shapes altogether.`],
        explanation: `${a} of the ${total} shapes ${a === 1 ? 'is a' : 'are'} ${a === 1 ? p.one : p.many}, so the fraction is ${frac(a, total)}.`,
      }
    }

    const notShaded = (): GeneratedItem => {
      const d = rng.pick([4, 5, 6, 8, 10])
      const s = rng.int(1, d - 1)
      const shape = rng.pick(FRAC_SHAPES)
      return {
        type: 'mcq',
        prompt: 'What fraction of the shape is not shaded?',
        figure: fracFig(shape, d, s),
        ...textChoice(rng, frac(d - s, d), [
          { value: frac(s, d), why: `${frac(s, d)} is the part that is shaded.` },
          { value: frac(d - s, s), why: `The bottom number is all the equal parts, which is ${d}.` },
          { value: frac(d - s, d + 1), why: `Count the equal parts again. There are ${d}.` },
          { value: frac(d, d - s), why: 'The top number shows the parts you want. The bottom number shows all the parts.' },
        ]),
        hints: ['Count the parts that are not shaded.', 'The bottom number is all the equal parts.', `There are ${d} equal parts and ${s} ${s === 1 ? 'is' : 'are'} shaded.`],
        explanation: `${d} - ${s} = ${d - s} parts are not shaded, so the answer is ${frac(d - s, d)}.`,
      }
    }

    const whichShows = (): GeneratedItem => {
      const d = rng.pick([3, 4, 5, 6, 8])
      const s = rng.int(1, d - 1)
      const shape = rng.pick(FRAC_SHAPES)
      const cands = [
        { parts: d, shaded: d - s, why: `This shows ${frac(d - s, d)}.` },
        { parts: d + 1, shaded: s, why: `This shows ${frac(s, d + 1)}. Count the equal parts.` },
        { parts: d, shaded: s + 1, why: `This shows ${frac(s + 1, d)}. Count the shaded parts.` },
        { parts: d - 1, shaded: s, why: `This shows ${frac(s, d - 1)}. Count the equal parts.` },
        { parts: d + 2, shaded: s, why: `This shows ${frac(s, d + 2)}. Count the equal parts.` },
      ].filter((c) => c.parts >= 2 && c.shaded >= 1 && c.shaded < c.parts && !(c.parts === d && c.shaded === s))
      const seen = new Set<string>()
      const wrong: { figure: Fig; why: string }[] = []
      for (const c of cands) {
        const key = `${c.parts}/${c.shaded}`
        if (seen.has(key)) continue
        seen.add(key)
        wrong.push({ figure: fracFig(shape, c.parts, c.shaded), why: c.why })
      }
      return {
        type: 'mcq',
        prompt: `Which picture shows ${frac(s, d)} shaded?`,
        ...figChoice(rng, fracFig(shape, d, s), wrong),
        hints: [`${frac(s, d)} means ${s} of ${d} equal parts.`, 'Count the equal parts in each picture, then count the shaded parts.', `Look for a shape with ${d} equal parts.`],
        explanation: `The right picture has ${d} equal parts with ${s} shaded, which is ${frac(s, d)}.`,
      }
    }

    const food = (): GeneratedItem => {
      const d = rng.pick([6, 8, 10])
      const [A, B] = twoNames(rng)
      const x = rng.int(1, 3)
      const y = rng.int(1, 3)
      const left = d - x - y
      const f = rng.pick([
        { n: 'pizza', parts: 'slices' },
        { n: 'cake', parts: 'pieces' },
        { n: 'martabak', parts: 'pieces' },
      ])
      return {
        type: 'mcq',
        prompt: `A ${f.n} is cut into ${d} equal ${f.parts}. ${A} eats ${x} and ${B} eats ${y}. What fraction of the ${f.n} is left?`,
        ...textChoice(rng, frac(left, d), [
          { value: frac(x + y, d), why: `${frac(x + y, d)} is the fraction that was eaten.` },
          { value: frac(left, x + y), why: `The bottom number is all the ${f.parts}, which is ${d}.` },
          { value: frac(d - x, d), why: `This only takes away the ${f.parts} that ${A} ate.` },
          { value: frac(left + 1, d), why: `Check the subtraction again: ${d} - ${x} - ${y}.` },
          { value: frac(x, d), why: `${frac(x, d)} is the part that ${A} ate.` },
          { value: frac(left, d + 1), why: `The ${f.n} has ${d} ${f.parts}, so the bottom number is ${d}.` },
        ]),
        hints: [`Find how many ${f.parts} were eaten altogether.`, `Take the eaten ${f.parts} away from ${d}.`, `${x} + ${y} = ${x + y}.`],
        explanation: `${x} + ${y} = ${x + y} ${f.parts} were eaten. ${d} - ${x + y} = ${left}, so ${frac(left, d)} of the ${f.n} is left.`,
        tags: WORD,
      }
    }

    const toWhole = (): GeneratedItem => {
      const d = rng.pick([4, 5, 6, 8, 10])
      const s = rng.int(1, d - 2)
      return {
        type: 'mcq',
        prompt: `${frac(s, d)} of the bar is shaded. What fraction must be added to make one whole?`,
        figure: fracFig('bar', d, s),
        ...textChoice(rng, frac(d - s, d), [
          { value: frac(s, d), why: 'This is the part that is already shaded.' },
          { value: frac(1, d), why: `Adding ${frac(1, d)} makes ${frac(s + 1, d)}. That is not a whole yet.` },
          { value: frac(d, d), why: `${frac(d, d)} is a whole on its own. Added to ${frac(s, d)} it is too much.` },
          { value: frac(d - s, s), why: `The bottom number stays ${d}, because the bar has ${d} equal parts.` },
        ]),
        hints: ['One whole means every part is shaded.', `One whole is ${frac(d, d)}.`, `How many of the ${d} parts are not shaded yet?`],
        explanation: `${frac(s, d)} + ${frac(d - s, d)} = ${frac(d, d)}, which is one whole.`,
      }
    }

    const group = (): GeneratedItem => {
      const n = rng.int(5, 10)
      const k = rng.int(1, n - 1)
      const what = rng.pick(['wear glasses', 'have a pet cat', 'walk to school', 'like swimming'])
      return {
        type: 'mcq',
        prompt: `There are ${n} children in a group. ${k} of them ${what}. What fraction of the children ${what}?`,
        ...textChoice(rng, frac(k, n), [
          { value: frac(n - k, n), why: `${frac(n - k, n)} is the fraction of children who do not.` },
          { value: frac(k, n - k), why: `The bottom number is all the children, which is ${n}.` },
          { value: frac(n, k), why: 'The top number shows the children you are asked about. The bottom number shows all the children.' },
          { value: frac(k, n + 1), why: `Count the children again. There are ${n}.` },
        ]),
        hints: ['How many children are there altogether?', 'The bottom number is the whole group. The top number is the part you want.', `There are ${n} children altogether.`],
        explanation: `${k} out of ${n} children ${what}, so the fraction is ${frac(k, n)}.`,
        tags: WORD,
      }
    }

    const gridMore = (): GeneratedItem => {
      const d = rng.pick([8, 10, 12])
      const k = rng.pick(d === 8 ? [2, 4] : d === 10 ? [2, 5] : [2, 3, 4])
      const m = rng.int(1, 3)
      const sh = d / k + m
      const name = pickName(rng)
      const [rows, cols] = d === 8 ? [2, 4] : d === 10 ? [2, 5] : [3, 4]
      return {
        type: 'mcq',
        prompt: `${name} has a grid of ${d} squares. ${name} shades ${frac(1, k)} of the grid, then ${m} more ${m === 1 ? 'square' : 'squares'}. What fraction is shaded now?`,
        figure: { kind: 'grid', rows, cols, shaded: [], alt: `An empty grid of ${rows} rows and ${cols} columns, ${d} squares in all.` },
        ...textChoice(rng, frac(sh, d), [
          { value: frac(m, d), why: `This only counts the ${m} extra ${m === 1 ? 'square' : 'squares'}.` },
          { value: frac(1 + m, d), why: `${frac(1, k)} of ${d} squares is ${d / k} squares, which is more than 1 square.` },
          { value: frac(d - sh, d), why: `${frac(d - sh, d)} is the part that is not shaded.` },
          { value: frac(sh, d + m), why: `The grid still has ${d} squares, so the bottom number is ${d}.` },
        ]),
        hints: [`First find ${frac(1, k)} of ${d} squares.`, `${frac(1, k)} of ${d} is ${d} ÷ ${k}. Then add the ${m} extra.`, `${d} ÷ ${k} = ${d / k}.`],
        explanation: `${frac(1, k)} of ${d} is ${d / k} squares. ${d / k} + ${m} = ${sh}, so ${frac(sh, d)} of the grid is shaded.`,
        tags: WORD,
      }
    }

    if (level === 1) return oneOf(rng, [() => nameIt(true), () => shade(true)])
    if (level === 2) return oneOf(rng, [() => nameIt(false), () => shade(false)])
    if (level === 3) return oneOf(rng, [ofSet, notShaded, whichShows])
    if (level === 4) return oneOf(rng, [food, toWhole, group])
    return gridMore()
  },
}

const MEASURE_FRACTIONS = [
  { q: 'How many minutes are in 1/2 of an hour?', a: 30, unit: 'minutes', fact: 'There are 60 minutes in 1 hour.', d: 2, whole: 60 },
  { q: 'How many minutes are in 1/4 of an hour?', a: 15, unit: 'minutes', fact: 'There are 60 minutes in 1 hour.', d: 4, whole: 60 },
  { q: 'How many minutes are in 3/4 of an hour?', a: 45, unit: 'minutes', fact: 'There are 60 minutes in 1 hour.', d: 4, whole: 60 },
  { q: 'How many centimetres are in 1/4 of a metre?', a: 25, unit: 'cm', fact: 'There are 100 centimetres in 1 metre.', d: 4, whole: 100 },
  { q: 'How many centimetres are in 1/2 of a metre?', a: 50, unit: 'cm', fact: 'There are 100 centimetres in 1 metre.', d: 2, whole: 100 },
  { q: 'How many centimetres are in 1/10 of a metre?', a: 10, unit: 'cm', fact: 'There are 100 centimetres in 1 metre.', d: 10, whole: 100 },
  { q: 'How many grams are in 1/2 of a kilogram?', a: 500, unit: 'g', fact: 'There are 1,000 grams in 1 kilogram.', d: 2, whole: 1000 },
  { q: 'How many grams are in 1/4 of a kilogram?', a: 250, unit: 'g', fact: 'There are 1,000 grams in 1 kilogram.', d: 4, whole: 1000 },
  { q: 'How many millilitres are in 1/2 of a litre?', a: 500, unit: 'ml', fact: 'There are 1,000 millilitres in 1 litre.', d: 2, whole: 1000 },
  { q: 'How many millilitres are in 1/4 of a litre?', a: 250, unit: 'ml', fact: 'There are 1,000 millilitres in 1 litre.', d: 4, whole: 1000 },
] as const

const fractionsOfAmounts3: Generator = {
  skill: 'm3.fractions-of-amounts',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const groupsFig = (n: number, d: number, icon: IconName, many: string): Fig => ({
      kind: 'groups',
      groups: Array.from({ length: d }, () => n / d),
      icon,
      container: 'circle',
      highlightGroups: 1,
      alt: `${n} ${many} in ${d} equal groups of ${n / d}, with 1 group highlighted.`,
    })

    const easy = (): GeneratedItem => {
      const d = rng.pick([2, 3, 4])
      const k = rng.int(2, d === 2 ? 9 : d === 3 ? 6 : 5)
      const n = d * k
      const th = things(rng, ['strawberry', 'apple', 'cookie', 'sweet', 'egg', 'flower', 'shell'])
      return {
        type: 'numeric',
        prompt: `Find ${frac(1, d)} of ${n} ${th.many}.`,
        figure: { kind: 'objects', items: [{ icon: th.icon, count: n }], alt: `There are ${n} ${th.many}.` },
        answer: k,
        hints: [`${frac(1, d)} means 1 of ${d} equal groups.`, `Share the ${n} ${th.many} into ${d} equal groups.`, `${n} ÷ ${d} tells you how many are in one group.`],
        explanation: `${n} shared into ${d} equal groups gives ${k} in each group, so ${frac(1, d)} of ${n} is ${k}.`,
        solution: [
          { say: `Share ${n} into ${d} equal groups.`, figure: groupsFig(n, d, th.icon, th.many) },
          { say: 'One group is the answer.', show: `${n} ÷ ${d} = ${k}` },
        ],
      }
    }

    const unit = (): GeneratedItem => {
      const d = rng.pick([2, 3, 4, 5, 10])
      const k = rng.int(3, d === 10 ? 9 : 12)
      const n = d * k
      return {
        type: 'numeric',
        prompt: `What is ${frac(1, d)} of ${n}?`,
        answer: k,
        hints: [`To find ${frac(1, d)}, divide by ${d}.`, `${n} ÷ ${d}: use the ${d} times table.`, `How many ${d}s make ${n}?`],
        explanation: `${n} ÷ ${d} = ${k}, so ${frac(1, d)} of ${n} is ${k}.`,
      }
    }

    const nonUnit = (): GeneratedItem => {
      const d = rng.pick([3, 4, 5, 10])
      const s = rng.int(2, d - 1)
      const k = rng.int(2, 10)
      const n = d * k
      const ans = s * k
      const hints = [`First find ${frac(1, d)} of ${n}.`, `Divide by ${d} to find one part. Then multiply by ${s}.`, `${frac(1, d)} of ${n} is ${n} ÷ ${d}.`]
      const explanation = `${n} ÷ ${d} = ${k}, so ${frac(1, d)} of ${n} is ${k}. ${frac(s, d)} is ${s} × ${k} = ${ans}.`
      const solution: Step[] = [
        { say: `Split ${n} into ${d} equal parts.`, figure: fracFig('bar', d, s), show: `${n} ÷ ${d} = ${k}` },
        { say: `Take ${s} of the parts.`, show: `${s} × ${k} = ${ans}` },
      ]
      if (rng.chance(0.5)) return { type: 'numeric', prompt: `What is ${frac(s, d)} of ${n}?`, answer: ans, hints, explanation, solution }
      return {
        type: 'mcq',
        prompt: `What is ${frac(s, d)} of ${n}?`,
        ...numChoice(rng, ans, [
          { value: k, why: `${k} is ${frac(1, d)} of ${n}. You need ${s} of these parts.` },
          { value: n - ans, why: `${n - ans} is the part that is left, ${frac(d - s, d)} of ${n}.` },
          { value: ans + k, why: `That is ${s + 1} parts. You need ${s} parts.` },
          { value: n * s, why: `Multiplying ${n} by ${s} makes the answer bigger than ${n}. A fraction of ${n} is smaller.` },
        ]),
        hints,
        explanation,
        solution,
      }
    }

    const story = (): GeneratedItem => {
      const kind = rng.int(0, 3)
      const [name, friend] = twoNames(rng)
      if (kind === 0) {
        const d = rng.pick([3, 4, 5])
        const k = rng.int(3, 10)
        const n = d * k
        return {
          type: 'numeric',
          prompt: `${name} has ${n} marbles. ${name} gives ${frac(1, d)} of them to ${friend}. How many marbles does ${name} keep?`,
          answer: n - k,
          hints: [`First find ${frac(1, d)} of ${n}.`, `${frac(1, d)} goes to ${friend}. Take that away from ${n}.`, `${n} ÷ ${d} = ${k}.`],
          explanation: `${frac(1, d)} of ${n} is ${k}. ${n} - ${k} = ${n - k}, so ${name} keeps ${n - k} marbles.`,
          tags: WORD,
        }
      }
      if (kind === 1) {
        const opts = [[20, 4], [20, 5], [24, 3], [24, 4], [30, 3], [30, 5], [28, 4], [32, 4], [30, 10]] as const
        const [n, d] = rng.pick(opts)
        const s = rng.int(1, d - 1)
        const what = rng.pick(['walk to school', 'bring a water bottle', 'have a sister', 'play badminton'])
        return {
          type: 'numeric',
          prompt: `There are ${n} children in a class. ${frac(s, d)} of them ${what}. How many children ${what}?`,
          answer: (n / d) * s,
          hints: [`Find ${frac(1, d)} of ${n} first.`, `Divide ${n} by ${d}${s > 1 ? `, then multiply by ${s}` : ''}.`, s > 1 ? `${n} ÷ ${d} = ${n / d}.` : `Use the ${d} times table. How many ${d}s make ${n}?`],
          explanation: `${n} ÷ ${d} = ${n / d}${s > 1 ? ` and ${s} × ${n / d} = ${(n / d) * s}` : ''}. So ${(n / d) * s} children ${what}.`,
          tags: WORD,
        }
      }
      if (kind === 2) {
        const m = rng.pick(MEASURE_FRACTIONS)
        return {
          type: 'numeric',
          prompt: m.q,
          answer: m.a,
          unit: m.unit,
          hints: [m.fact, `Divide ${fmt(m.whole)} by ${m.d} to find one part.`, `Share ${fmt(m.whole)} into ${m.d} equal parts. How big is one part?`],
          explanation: `${m.fact} ${m.q.replace('How many ', '').replace(' are in ', ' in ').replace('?', '')} is ${fmt(m.a)}.`,
        }
      }
      const opts = [[10000, 2], [20000, 2], [20000, 4], [12000, 3], [12000, 4], [8000, 2], [8000, 4], [50000, 5], [50000, 10], [30000, 3]] as const
      const [n, d] = rng.pick(opts)
      return {
        type: 'numeric',
        prompt: `${name} has ${rupiah(n)}. ${name} spends ${frac(1, d)} of it on a book. How much does the book cost?`,
        answer: n / d,
        unit: 'rupiah',
        hints: [`Find ${frac(1, d)} of ${rupiah(n)}.`, `Divide ${rupiah(n)} by ${d}.`, `Think of ${n / 1000} thousand ÷ ${d}.`],
        explanation: `${rupiah(n)} ÷ ${d} = ${rupiah(n / d)}, so the book costs ${rupiah(n / d)}.`,
        tags: WORD,
      }
    }

    const inverse = (): GeneratedItem => {
      const d = rng.pick([3, 4, 5, 10])
      const s = rng.chance(0.5) ? rng.int(2, d - 1) : 1
      const k = rng.int(s === 1 ? 5 : 3, 12)
      const part = s * k
      return {
        type: 'numeric',
        prompt: `${frac(s, d)} of a number is ${part}. What is the number?`,
        answer: d * k,
        hints: [
          `Draw a bar split into ${d} equal parts.`,
          s === 1 ? `1 part is ${part}. There are ${d} parts in the whole.` : `${s} parts make ${part}, so find 1 part first.`,
          s === 1 ? `Multiply ${part} by ${d}.` : `${part} ÷ ${s} = ${k}.`,
        ],
        explanation: `1 part is ${k}, and ${d} parts make ${d} × ${k} = ${d * k}.`,
        solution: [
          { say: `The whole is split into ${d} equal parts.`, figure: fracFig('bar', d, s) },
          { say: 'Find one part.', show: `${part} ÷ ${s} = ${k}` },
          { say: 'Find all the parts.', show: `${d} × ${k} = ${d * k}` },
        ],
      }
    }

    if (level === 1) return easy()
    if (level === 2) return unit()
    if (level === 3) return nonUnit()
    if (level === 4) return story()
    return inverse()
  },
}

const EQUIV3 = [
  [1, 2, 4], [1, 2, 6], [1, 2, 8], [1, 2, 10], [1, 3, 6], [2, 3, 6], [1, 4, 8], [3, 4, 8], [1, 5, 10], [2, 5, 10], [3, 5, 10], [4, 5, 10], [2, 4, 8], [1, 3, 9],
] as const

const equivalent3: Generator = {
  skill: 'm3.equivalent-fractions',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const shadeHalf = (): GeneratedItem => {
      const parts = rng.pick([4, 6, 8, 10])
      const shape = rng.pick(FRAC_SHAPES)
      return {
        type: 'fraction',
        prompt: `This ${shape} has ${parts} equal parts. Shade ${frac(1, 2)} of it.`,
        shape,
        parts,
        answer: { num: 1, den: 2 },
        hints: ['Half means 1 of 2 equal parts.', `Half of ${parts} parts is ${parts} ÷ 2.`, 'Shade the parts one at a time and count as you go.'],
        explanation: `${parts} ÷ 2 = ${parts / 2}, so ${parts / 2} of the ${parts} parts are shaded. ${frac(1, 2)} = ${frac(parts / 2, parts)}.`,
      }
    }

    const missing = (pool: readonly (readonly [number, number, number])[]): GeneratedItem => {
      const [a, b, d2] = rng.pick(pool)
      const m = d2 / b
      const top = rng.chance(0.7)
      return {
        type: 'numeric',
        prompt: top ? `Find the missing number. ${frac(a, b)} = ___/${d2}` : `Find the missing number. ${frac(a, b)} = ${a * m}/___`,
        figure: fracFig('bar', b, a),
        answer: top ? a * m : d2,
        hints: ['Equivalent fractions show the same amount.', 'Whatever you multiply the bottom number by, multiply the top number by the same.', top ? (a === 1 ? `Split each of the ${b} parts into smaller equal parts until there are ${d2}.` : `${b} × ${m} = ${d2}.`) : `${a} × ${m} = ${a * m}.`],
        explanation: `${a} × ${m} = ${a * m} and ${b} × ${m} = ${d2}, so ${frac(a, b)} = ${frac(a * m, d2)}.`,
        solution: [
          { say: `${frac(a, b)} of a bar.`, figure: fracFig('bar', b, a) },
          { say: `Split each part into ${m}. The shaded amount stays the same.`, figure: fracFig('bar', d2, a * m) },
          { say: 'Write the new fraction.', show: `${frac(a, b)} = ${frac(a * m, d2)}` },
        ],
      }
    }

    const unitCompare = (): GeneratedItem => {
      const ds = rng.sample([2, 3, 4, 5, 6, 8, 10], 4)
      const largest = rng.chance(0.6)
      const ans = largest ? Math.min(...ds) : Math.max(...ds)
      return {
        type: 'mcq',
        prompt: `Which fraction is the ${largest ? 'largest' : 'smallest'}?`,
        ...textChoice(rng, frac(1, ans), ds.filter((d) => d !== ans).map((d) => ({
          value: frac(1, d),
          why: `${frac(1, d)} is 1 of ${d} equal parts. ${largest ? `Cutting into ${d} parts makes each part smaller than cutting into ${ans}.` : `Cutting into ${d} parts makes each part bigger than cutting into ${ans}.`}`,
        }))),
        hints: ['Think of the same bar cut into different numbers of equal parts.', 'The more parts a whole is cut into, the smaller each part is.', `Compare ${frac(1, ds.filter((d) => d !== ans)[0]!)} and ${frac(1, ds.filter((d) => d !== ans)[1]!)} first.`],
        explanation: `All the fractions have 1 on top. ${frac(1, ans)} has the ${largest ? 'fewest' : 'most'} parts, so each part is the ${largest ? 'biggest' : 'smallest'}.`,
      }
    }

    const sameDen = (): GeneratedItem => {
      const d = rng.pick([5, 6, 8, 10])
      const [x, y] = rng.sample(range(1, d - 1), 2) as [number, number]
      const big = Math.max(x, y)
      const small = Math.min(x, y)
      const correct = x > y ? `${frac(x, d)} > ${frac(y, d)}` : `${frac(x, d)} < ${frac(y, d)}`
      return {
        type: 'mcq',
        prompt: 'Which of these is true?',
        ...textChoice(rng, correct, [
          { value: x > y ? `${frac(x, d)} < ${frac(y, d)}` : `${frac(x, d)} > ${frac(y, d)}`, why: `${frac(big, d)} has more parts shaded, so it is bigger.` },
          { value: `${frac(x, d)} = ${frac(y, d)}`, why: `${plural(x, 'part', 'parts')} and ${plural(y, 'part', 'parts')} are different amounts.` },
          { value: x > y ? `${frac(y, d)} > ${frac(x, d)}` : `${frac(y, d)} < ${frac(x, d)}`, why: `${frac(small, d)} is smaller than ${frac(big, d)}. Check which way the sign points.` },
        ]),
        hints: [`Both fractions are cut into ${d} equal parts.`, 'When the bottom numbers are the same, compare the top numbers.', `${frac(x, d)} is ${plural(x, 'part', 'parts')}. ${frac(y, d)} is ${plural(y, 'part', 'parts')}.`],
        explanation: `The parts are the same size, and ${big} parts is more than ${plural(small, 'part', 'parts')}. So ${correct} is true.`,
      }
    }

    const whichEqual = (): GeneratedItem => {
      const [a, b, d2] = rng.pick(EQUIV3)
      const m = d2 / b
      const correct = frac(a * m, d2)
      return {
        type: 'mcq',
        prompt: `Which fraction is equal to ${frac(a, b)}?`,
        figure: fracFig('bar', b, a),
        ...textChoice(rng, correct, [
          { value: frac(a, d2), why: 'Only the bottom number changed. Multiply the top number by the same amount.' },
          { value: frac(a + 1, b + 1), why: 'Adding 1 to the top and the bottom changes the size of the fraction.' },
          { value: frac(b, a), why: 'This fraction is upside down.' },
          { value: frac(a * m + 1, d2), why: `Check the top number: ${a} × ${m} = ${a * m}.` },
        ]),
        hints: ['Equivalent fractions show the same amount.', 'Multiply the top and the bottom number by the same number.', `Try multiplying the top and bottom of ${frac(a, b)} by ${m}.`],
        explanation: `${frac(a, b)} = ${frac(a * m, d2)} because ${a} × ${m} = ${a * m} and ${b} × ${m} = ${d2}.`,
      }
    }

    const shadeEquiv = (): GeneratedItem => {
      const [a, b, d2] = rng.pick(EQUIV3.filter((e) => e[0] !== 1 || e[1] !== 2))
      const shape = rng.pick(FRAC_SHAPES)
      return {
        type: 'fraction',
        prompt: `This ${shape} has ${d2} equal parts. Shade ${frac(a, b)} of it.`,
        shape,
        parts: d2,
        answer: { num: a, den: b },
        hints: [`${frac(a, b)} is the same as some number of ${d2}ths.`, `${b} × ${d2 / b} = ${d2}, so multiply the top number by ${d2 / b} too.`, `Each of the ${b} big parts is ${d2 / b} small parts.`],
        explanation: `${frac(a, b)} = ${frac(a * (d2 / b), d2)}, so shade ${a * (d2 / b)} of the ${d2} parts.`,
      }
    }

    const orderIt = (): GeneratedItem => {
      const unitSet = rng.chance(0.5)
      const asc = rng.chance(0.5)
      let fr: { n: number; d: number }[]
      if (unitSet) fr = rng.sample([2, 3, 4, 5, 6, 8, 10], 4).map((d) => ({ n: 1, d }))
      else {
        const d = rng.pick([6, 8, 10])
        fr = rng.sample(range(1, d - 1), 4).map((n) => ({ n, d }))
      }
      const sorted = [...fr].sort((p, q) => (asc ? p.n / p.d - q.n / q.d : q.n / q.d - p.n / p.d))
      return {
        type: 'order',
        prompt: `Put the fractions in order, starting with the ${asc ? 'smallest' : 'largest'}.`,
        items: sorted.map((f) => frac(f.n, f.d)),
        hints: [
          unitSet ? 'All the fractions have 1 on top.' : 'All the fractions have the same bottom number.',
          unitSet ? 'The more equal parts, the smaller each part.' : 'Compare the top numbers: more parts means a bigger fraction.',
          `${frac(sorted[0]!.n, sorted[0]!.d)} is the ${asc ? 'smallest' : 'largest'}.`,
        ],
        explanation: `In order: ${sorted.map((f) => frac(f.n, f.d)).join(', ')}.`,
      }
    }

    const cake = (): GeneratedItem => {
      const [A, B] = twoNames(rng)
      const same = rng.chance(0.5)
      let fa: [number, number]
      let fb: [number, number]
      if (same) {
        const [a, b, d2] = rng.pick(EQUIV3)
        fa = [a, b]
        fb = [a * (d2 / b), d2]
      } else {
        const [x, y] = rng.sample([2, 3, 4, 5, 6, 8], 2) as [number, number]
        fa = [1, x]
        fb = [1, y]
      }
      const va = fa[0] / fa[1]
      const vb = fb[0] / fb[1]
      const ans = same ? 'They eat the same amount' : va > vb ? A : B
      const wrong = [
        { value: 'They eat the same amount', why: `${frac(...fa)} and ${frac(...fb)} are different amounts of cake.` },
        { value: A, why: same ? `${frac(...fa)} = ${frac(...fb)}, so ${A} does not eat more.` : `${frac(...fa)} is smaller than ${frac(...fb)}.` },
        { value: B, why: same ? `${frac(...fb)} = ${frac(...fa)}, so ${B} does not eat more.` : `${frac(...fb)} is smaller than ${frac(...fa)}.` },
        { value: 'You cannot tell', why: 'The cakes are the same size, so you can compare the fractions.' },
      ].filter((w) => w.value !== ans)
      return {
        type: 'mcq',
        prompt: `${A} eats ${frac(...fa)} of a cake. ${B} eats ${frac(...fb)} of a cake the same size. Who eats more?`,
        ...textChoice(rng, ans, wrong),
        hints: ['Draw two bars the same length.', same ? 'Check if the two fractions are equivalent.' : 'When the top numbers are both 1, fewer parts means bigger parts.', `Shade ${frac(...fa)} of one bar and ${frac(...fb)} of the other.`],
        explanation: same
          ? `${frac(...fa)} = ${frac(...fb)}, so they eat the same amount.`
          : `${frac(...(va > vb ? fa : fb))} is bigger than ${frac(...(va > vb ? fb : fa))}, so ${ans} eats more.`,
        tags: WORD,
      }
    }

    const howManyParts = (): GeneratedItem => {
      const [a, b, d2] = rng.pick(EQUIV3.filter((e) => e[2] !== e[1] * 1))
      const name = d2 === 4 ? 'quarters' : d2 === 6 ? 'sixths' : d2 === 8 ? 'eighths' : d2 === 9 ? 'ninths' : 'tenths'
      return {
        type: 'numeric',
        prompt: `How many ${name} make ${frac(a, b)}?`,
        answer: a * (d2 / b),
        hints: [`A ${name.slice(0, -1)} is ${frac(1, d2)}.`, `Write ${frac(a, b)} as a fraction with ${d2} at the bottom.`, a === 1 ? `Draw ${frac(1, b)} of a bar, then split every part into smaller parts until there are ${d2}.` : `${b} × ${d2 / b} = ${d2}.`],
        explanation: `${frac(a, b)} = ${frac(a * (d2 / b), d2)}, so ${a * (d2 / b)} ${name} make ${frac(a, b)}.`,
      }
    }

    const whichHalf = (): GeneratedItem => {
      const k = rng.int(2, 5)
      const wrong = [
        { value: frac(k - 1, 2 * k), why: `Half of ${2 * k} parts is ${k} parts. ${k - 1} ${k - 1 === 1 ? 'part is' : 'parts are'} less than half.` },
        { value: frac(k + 1, 2 * k), why: `Half of ${2 * k} parts is ${k} parts. ${k + 1} parts are more than half.` },
        { value: frac(k, 2 * k + 1), why: `${2 * k + 1} parts cannot be split into two equal halves of whole parts.` },
        { value: frac(1, k + 1), why: `${frac(1, k + 1)} is 1 of ${k + 1} equal parts, which is less than half.` },
      ].filter((w) => w.value !== frac(1, 2) && !w.value.startsWith('0/'))
      return {
        type: 'mcq',
        prompt: `Which fraction is equal to ${frac(1, 2)}?`,
        ...textChoice(rng, frac(k, 2 * k), wrong),
        hints: ['A half is 1 of 2 equal parts.', 'A fraction equal to a half has a top number that is half of the bottom number.', 'For each fraction, ask: is the top number half of the bottom number?'],
        explanation: `${k} is half of ${2 * k}, so ${frac(k, 2 * k)} = ${frac(1, 2)}.`,
      }
    }

    const notEqual = (): GeneratedItem => {
      const base = rng.pick([[1, 2], [1, 3], [1, 4], [2, 3], [3, 4], [1, 5], [2, 5]] as const)
      const [a, b] = base
      const ms = rng.sample([2, 3, 4, 5].filter((m) => b * m <= 20), 3)
      const equal = ms.map((m) => ({ value: frac(a * m, b * m), why: `${frac(a * m, b * m)} = ${frac(a, b)}, because ${a} and ${b} were both multiplied by ${m}.` }))
      const m0 = rng.pick([2, 3])
      const imp = rng.chance(0.5) ? frac(a * m0, b * m0 + 1) : frac(a + m0, b + m0)
      return {
        type: 'mcq',
        prompt: `Which fraction is not equal to ${frac(a, b)}?`,
        ...textChoice(rng, imp, equal),
        hints: ['Three of these fractions are equivalent to each other.', `Check each fraction: were the top and bottom of ${frac(a, b)} multiplied by the same number?`, `Start with ${equal[0]!.value}: ${b} × ${ms[0]} = ${b * ms[0]!}.`],
        explanation: `${imp} cannot be made by multiplying the top and bottom of ${frac(a, b)} by the same number, so it is not equal to ${frac(a, b)}.`,
      }
    }

    if (level === 1) return oneOf(rng, [shadeHalf, whichHalf, () => missing(EQUIV3.filter((e) => e[0] === 1 && e[1] === 2))])
    if (level === 2) return oneOf(rng, [unitCompare, sameDen])
    if (level === 3) return oneOf(rng, [whichEqual, shadeEquiv, () => missing(EQUIV3)])
    if (level === 4) return oneOf(rng, [orderIt, cake])
    return oneOf(rng, [howManyParts, notEqual])
  },
}

// ---------------------------------------------------------------------------
// Nm: uang rupiah
// ---------------------------------------------------------------------------

export const art = (w: string): string => (/^[aeiou]/i.test(w) ? `an ${w}` : `a ${w}`)

const SHOP3 = [
  { one: 'pencil', many: 'pencils', lo: 2000, hi: 3500 },
  { one: 'eraser', many: 'erasers', lo: 1500, hi: 3000 },
  { one: 'notebook', many: 'notebooks', lo: 4000, hi: 8000 },
  { one: 'ruler', many: 'rulers', lo: 3000, hi: 5000 },
  { one: 'kite', many: 'kites', lo: 6000, hi: 12000 },
  { one: 'ball', many: 'balls', lo: 8000, hi: 15000 },
  { one: 'bottle of water', many: 'bottles of water', lo: 3000, hi: 5000 },
  { one: 'bread roll', many: 'bread rolls', lo: 2500, hi: 5000 },
  { one: 'box of crayons', many: 'boxes of crayons', lo: 7000, hi: 14000 },
  { one: 'storybook', many: 'storybooks', lo: 9000, hi: 18000 },
] as const

export const price = (rng: Rng, lo: number, hi: number): number => rng.int(lo / 500, hi / 500) * 500

const NOTE_OR_COIN = (v: number): string => (v <= 1000 ? 'coin' : 'note')

export function moneyAlt(items: readonly { value: number; count: number }[]): string {
  const words = ['zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten']
  const parts = items.map((i) => `${words[i.count]!.toLowerCase()} ${rupiah(i.value)} ${NOTE_OR_COIN(i.value)}${i.count > 1 ? 's' : ''}`)
  return `${cap(listAnd(parts))}.`
}

const DENOMS = [20000, 10000, 5000, 2000, 1000, 500] as const

const moneyRupiah3: Generator = {
  skill: 'm3.money-rupiah',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const name = pickName(rng)

    const count = (): GeneratedItem => {
      const denoms = rng.sample([500, 1000, 2000, 5000, 10000] as const, rng.int(2, 3)).sort((a, b) => b - a)
      const items = denoms.map((v) => ({ value: v, count: rng.int(1, v >= 5000 ? 1 : 3) }))
      const total = items.reduce((s, i) => s + i.value * i.count, 0)
      const first = items.find((i) => i.count > 1) ?? items[0]!
      return {
        type: 'numeric',
        prompt: 'How much money is there altogether?',
        figure: { kind: 'money', items, alt: moneyAlt(items) },
        answer: total,
        unit: 'rupiah',
        hints: ['Start with the note worth the most.', 'Count on as you add each note or coin.', first.count > 1 ? `${first.count} × ${rupiah(first.value)} = ${rupiah(first.value * first.count)}.` : `Start at ${rupiah(items[0]!.value)}, then count on ${rupiah(items[1]!.value)}.`],
        explanation: `${items.map((i) => rupiah(i.value * i.count)).join(' + ')} = ${rupiah(total)}.`,
        solution: [
          { say: 'Find the value of each kind of note or coin.', figure: { kind: 'money', items, alt: moneyAlt(items) }, show: items.map((i) => `${i.count} × ${rupiah(i.value)} = ${rupiah(i.value * i.count)}`).join(', ').slice(0, 120) },
          { say: 'Add them together, starting with the biggest.', show: `${items.map((i) => rupiah(i.value * i.count)).join(' + ')} = ${rupiah(total)}` },
        ],
      }
    }

    const shopTable = (n: number) => {
      const picks = rng.sample(SHOP3, n).map((it) => ({ ...it, p: price(rng, it.lo, it.hi) }))
      const figure: Fig = {
        kind: 'table',
        head: ['Item', 'Price'],
        rows: picks.map((x) => [cap(x.one), rupiah(x.p)]),
        alt: `Price list: ${picks.map((x) => `${x.one} ${rupiah(x.p)}`).join(', ')}.`,
      }
      return { picks, figure }
    }

    const two = (): GeneratedItem => {
      const { picks, figure } = shopTable(4)
      const [a, b] = rng.sample(picks, 2) as [(typeof picks)[number], (typeof picks)[number]]
      return {
        type: 'numeric',
        prompt: `${name} buys ${art(a.one)} and ${art(b.one)}. How much does ${name} pay?`,
        figure,
        answer: a.p + b.p,
        unit: 'rupiah',
        hints: ['Find the two prices in the table.', 'Add the two prices. Add the thousands first, then the rest.', `The ${a.one} costs ${rupiah(a.p)}.`],
        explanation: `${rupiah(a.p)} + ${rupiah(b.p)} = ${rupiah(a.p + b.p)}.`,
        tags: WORD,
      }
    }

    const change = (): GeneratedItem => {
      const it = rng.pick(SHOP3)
      const p = price(rng, it.lo, it.hi)
      const notes = [10000, 20000, 50000].filter((v) => v >= p + 500 && v <= p * 8)
      const paid = notes.length ? rng.pick(notes) : [10000, 20000, 50000].find((v) => v >= p + 500)!
      const ans = paid - p
      const next = Math.ceil((p + 1) / 1000) * 1000
      const hints = ['Change is the money you get back.', `Take ${rupiah(p)} away from ${rupiah(paid)}, or count up from ${rupiah(p)}.`, `Count up from ${rupiah(p)} to ${rupiah(next)} first.`]
      const explanation = `${rupiah(paid)} - ${rupiah(p)} = ${rupiah(ans)}.`
      const prompt = `${name} buys ${art(it.one)} for ${rupiah(p)} and pays with a ${rupiah(paid)} note. How much change does ${name} get?`
      if (rng.chance(0.5)) return { type: 'numeric', prompt, answer: ans, unit: 'rupiah', hints, explanation, tags: WORD }
      return {
        type: 'mcq',
        prompt,
        ...numChoice(rng, ans, [
          { value: p, why: 'This is the price. Change is the money you get back.' },
          { value: ans + 1000, why: `Check the thousands again: ${rupiah(p)} + ${rupiah(ans + 1000)} is more than ${rupiah(paid)}.` },
          { value: ans - 1000, why: `${rupiah(p)} + ${rupiah(ans - 1000)} is less than ${rupiah(paid)}.` },
          { value: ans + 500, why: `${rupiah(p)} + ${rupiah(ans + 500)} is more than ${rupiah(paid)}.` },
        ], { render: rupiah, spread: [] }),
        hints,
        explanation,
        tags: WORD,
      }
    }

    const several = (): GeneratedItem => {
      const it = rng.pick(SHOP3.filter((x) => x.hi <= 8000))
      const n = rng.int(2, 4)
      const p = price(rng, it.lo, it.hi)
      const total = n * p
      const paid = [10000, 20000, 50000].find((v) => v >= total + 500 && v !== 2 * total)!
      return {
        type: 'numeric',
        prompt: `${name} buys ${n} ${it.many} at ${rupiah(p)} each. ${name} pays with a ${rupiah(paid)} note. How much change does ${name} get?`,
        answer: paid - total,
        unit: 'rupiah',
        hints: ['First find the total cost.', `Multiply ${rupiah(p)} by ${n}, then take the total away from ${rupiah(paid)}.`, `${n} × ${rupiah(p)} = ${rupiah(total)}.`],
        explanation: `${n} × ${rupiah(p)} = ${rupiah(total)}. ${rupiah(paid)} - ${rupiah(total)} = ${rupiah(paid - total)}.`,
        solution: [
          { say: 'Find the total cost.', show: `${n} × ${rupiah(p)} = ${rupiah(total)}` },
          { say: 'Take the cost away from the money paid.', show: `${rupiah(paid)} - ${rupiah(total)} = ${rupiah(paid - total)}` },
        ],
        tags: WORD,
      }
    }

    const whichTwo = (): GeneratedItem => {
      for (let tries = 0; tries < 20; tries++) {
        const { picks, figure } = shopTable(4)
        const pairs: { text: string; sum: number }[] = []
        for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) pairs.push({ text: `${cap(art(picks[i]!.one))} and ${art(picks[j]!.one)}`, sum: picks[i]!.p + picks[j]!.p })
        const target = rng.pick(pairs)
        if (pairs.filter((x) => x.sum === target.sum).length > 1) continue
        const wrong = rng.shuffle(pairs.filter((x) => x !== target)).slice(0, 3)
        return {
          type: 'mcq',
          prompt: `${name} spends exactly ${rupiah(target.sum)} on two different items. Which two items does ${name} buy?`,
          figure,
          ...textChoice(rng, target.text, wrong.map((w) => ({ value: w.text, why: `These cost ${rupiah(w.sum)} altogether.` }))),
          hints: ['Add the prices of two items at a time.', `Look for two prices that add up to ${rupiah(target.sum)}.`, 'Start with the most expensive item. What else could make the total?'],
          explanation: `${target.text} cost ${rupiah(target.sum)} altogether.`,
          tags: WORD,
        }
      }
      return several()
    }

    const fewest = (): GeneratedItem => {
      const x = rng.int(7, 39) * 500
      const pieces: number[] = []
      let rest = x
      for (const d of DENOMS) {
        while (rest >= d) {
          pieces.push(d)
          rest -= d
        }
      }
      return {
        type: 'numeric',
        prompt: `You can use Rp500 and Rp1.000 coins, and Rp2.000, Rp5.000, Rp10.000 and Rp20.000 notes. What is the smallest number of coins and notes that make ${rupiah(x)}?`,
        answer: pieces.length,
        hints: ['Use the biggest note you can first.', 'Keep choosing the biggest note or coin that still fits.', `Start with ${art(rupiah(pieces[0]!) + ' ' + NOTE_OR_COIN(pieces[0]!))}. What is left?`],
        explanation: `${pieces.map((v) => rupiah(v)).join(' + ')} = ${rupiah(x)}. That is ${pieces.length} coins and notes.`,
      }
    }

    if (level === 1) return count()
    if (level === 2) return two()
    if (level === 3) return change()
    if (level === 4) return oneOf(rng, [several, whichTwo])
    return fewest()
  },
}

// ---------------------------------------------------------------------------
// Gt: waktu
// ---------------------------------------------------------------------------

/** Jam 1 sampai 12 dari jam 0 sampai 23. */
export const hour12 = (h: number): number => ((h + 11) % 12) + 1

/** Variasi jawaban teks untuk jam digital 12 jam, misalnya 6:25. */
export function digitalAnswers(h: number, m: number): string[] {
  const hh = hour12(h)
  const mm = String(m).padStart(2, '0')
  return [`${hh}:${mm}`, `${String(hh).padStart(2, '0')}:${mm}`, `${hh}.${mm}`, `${String(hh).padStart(2, '0')}.${mm}`]
}

/** Pengecoh baca jam dalam kata. */
export function clockWrong(h: number, m: number): { value: string; why: string }[] {
  const hh = hour12(h)
  const out: { value: string; why: string }[] = []
  if (m > 30) out.push({ value: timeWords(h - 1, m), why: `The hour hand has gone past ${hh === 1 ? 12 : hh - 1}, so the next hour is ${hh === 12 ? 1 : hh + 1}.` })
  else out.push({ value: timeWords(h + 1, m), why: `The hour hand is just after ${hh}, so the hour is ${hh}.` })
  if (m !== 0 && m !== 30) {
    if (m < 30) out.push({ value: m === 15 ? `quarter to ${hh}` : `${m} minutes to ${hh}`, why: 'The minute hand is on the right side of the clock, so the time is minutes past the hour.' })
    else out.push({ value: m === 45 ? `quarter past ${hh === 12 ? 1 : hh + 1}` : `${60 - m} minutes past ${hh}`, why: 'The minute hand is on the left side of the clock, so the time is minutes to the next hour.' })
  }
  if (m % 5 === 0 && m !== 0 && m / 5 !== hh % 12) out.push({ value: timeWords(m / 5, (hh % 12) * 5), why: 'The short hand shows the hour. The long hand shows the minutes.' })
  out.push({ value: timeWords(h, (m + 5) % 60 === 0 ? 55 : (m + 5) % 60), why: 'Count the minutes in 5s from the 12 again.' })
  out.push({ value: timeWords(h, m === 0 ? 30 : 0), why: m === 0 ? 'The long hand points at the 12, so it is an o\'clock time.' : `The long hand points at the ${m / 5}, not the 12.` })
  return out
}

const timeClock3: Generator = {
  skill: 'm3.time-clock',
  levels: [1, 2, 3, 4],
  generate({ rng, level }) {
    const pickTime = (step: number) => ({ h: rng.int(1, 12), m: rng.int(0, 60 / step - 1) * step })

    const read = (step: number): GeneratedItem => {
      const { h, m } = pickTime(step)
      const figure: Fig = { kind: 'clock', h, m, alt: `A clock showing ${timeWords(h, m)}.` }
      return {
        type: 'mcq',
        prompt: 'What time does the clock show?',
        figure,
        ...textChoice(rng, timeWords(h, m), clockWrong(h, m)),
        hints: ['The long hand shows the minutes. The short hand shows the hour.', 'Count in 5s from the 12 to the long hand.', m === 0 ? 'The long hand points at the 12.' : `The long hand points at the ${m / 5}.`],
        explanation: `The long hand is on the ${m === 0 ? 12 : m / 5}, which means ${m === 0 ? "o'clock" : `${m} minutes`}. The short hand ${m <= 30 ? `has just passed ${h}` : `is nearly at ${hour12(h + 1)}`}. The time is ${timeWords(h, m)}.`,
      }
    }

    const set = (step: 15 | 5): GeneratedItem => {
      const { h, m } = pickTime(step)
      return {
        type: 'clock',
        prompt: `Show ${timeWords(h, m)} on the clock.`,
        answer: { h, m },
        stepMinutes: step,
        hints: ['Set the long minute hand first, then the short hour hand.', 'Each number on the clock is 5 minutes for the long hand.', m === 0 ? 'For o\'clock, the long hand points at the 12.' : `${m} minutes means the long hand points at the ${m / 5}.`],
        explanation: `${cap(timeWords(h, m))} is ${digital(h, m)}. The long hand points at the ${m === 0 ? 12 : m / 5} and the short hand is ${m === 0 ? `on the ${h}` : m <= 30 ? `just after the ${h}` : `close to the ${hour12(h + 1)}`}.`,
      }
    }

    const toDigital = (): GeneratedItem => {
      const { h, m } = pickTime(5)
      const mm = m === 0 ? 5 : m
      if (rng.chance(0.5)) {
        return {
          type: 'text',
          prompt: `Write ${timeWords(h, mm)} as a digital time.`,
          blanks: [{ answers: digitalAnswers(h, mm) }],
          hints: ['A digital time shows the hour, then a colon, then the minutes.', mm > 30 ? `Minutes to the hour: take ${60 - mm} away from 60.` : 'Minutes past the hour go after the colon.', mm > 30 ? `The hour is ${h}, because it is not yet ${hour12(h + 1)} o'clock.` : `The hour is ${h}.`],
          explanation: `${cap(timeWords(h, mm))} is ${digital(h, mm)}.`,
        }
      }
      return {
        type: 'mcq',
        prompt: `Which digital time is the same as ${timeWords(h, mm)}?`,
        ...textChoice(rng, digital(h, mm), [
          ...(mm !== 30 ? [{ value: digital(h, 60 - mm), why: mm > 30 ? `${digital(h, 60 - mm)} is ${60 - mm} minutes past ${h}.` : `${digital(h, 60 - mm)} is ${60 - mm} minutes past ${h}, which is ${mm} minutes to ${hour12(h + 1)}.` }] : []),
          { value: digital(hour12(h + 1), mm), why: `${digital(hour12(h + 1), mm)} is an hour later.` },
          ...(mm !== 30 ? [{ value: digital(hour12(h + 1), 60 - mm), why: mm > 30 ? `The hour is still ${h}. It is ${mm} minutes past ${h}, which is ${60 - mm} minutes to ${hour12(h + 1)}.` : `${digital(hour12(h + 1), 60 - mm)} is ${60 - mm} minutes past ${hour12(h + 1)}.` }] : []),
          { value: digital(hour12(h - 1), mm), why: `${digital(hour12(h - 1), mm)} is an hour earlier.` },
          { value: digital(h, mm === 55 ? 50 : mm + 5), why: `Check the minutes again. They should be ${mm}.` },
        ]),
        hints: ['Digital times show minutes past the hour.', mm > 30 ? `${60 - mm} minutes to ${hour12(h + 1)} is ${mm} minutes past ${h}.` : `The minutes come after the colon.`, `The hour is ${h}.`],
        explanation: `${cap(timeWords(h, mm))} is ${digital(h, mm)}.`,
      }
    }

    const ampm = (): GeneratedItem => {
      const acts = [
        { what: 'eats breakfast', h: rng.int(6, 7), am: true },
        { what: 'arrives at school', h: 7, am: true },
        { what: 'eats lunch', h: 12, am: false },
        { what: 'plays football after school', h: rng.int(3, 5), am: false },
        { what: 'eats dinner', h: rng.int(6, 7), am: false },
        { what: 'goes to bed', h: rng.int(8, 9), am: false },
      ]
      const a = rng.pick(acts)
      const m = rng.int(0, 11) * 5
      const name = pickName(rng)
      const sfx = a.am ? 'a.m.' : 'p.m.'
      const other = a.am ? 'p.m.' : 'a.m.'
      const wrong = [
        { value: `${digital(a.h, m)} ${other}`, why: a.am ? 'p.m. times are after midday. This happens in the morning.' : 'a.m. times are before midday. This happens later in the day.' },
        { value: `${digital(hour12(a.h + 1), m)} ${sfx}`, why: m <= 30 ? `The short hand is just after ${a.h}, so the hour is ${a.h}.` : `The short hand is between ${a.h} and ${hour12(a.h + 1)}, so the hour is ${a.h}.` },
        { value: `${digital(a.h, (m + 30) % 60)} ${sfx}`, why: `The long hand points at the ${m === 0 ? 12 : m / 5}, so the minutes are ${m}.` },
      ]
      if (m % 5 === 0 && m !== 0 && m / 5 !== a.h % 12) wrong.unshift({ value: `${digital(m / 5, (a.h % 12) * 5)} ${sfx}`, why: 'The short hand shows the hour. The long hand shows the minutes.' })
      return {
        type: 'mcq',
        prompt: `The clock shows when ${name} ${a.what}. What time is it?`,
        figure: { kind: 'clock', h: a.h, m, alt: `A clock showing ${timeWords(a.h, m)}.` },
        ...textChoice(rng, `${digital(a.h, m)} ${sfx}`, wrong),
        hints: ['Read the clock first: the long hand shows the minutes.', 'a.m. means before midday. p.m. means after midday.', `Is it morning, afternoon or evening when someone ${a.what.replace('eats', 'eats').replace('goes', 'goes')}?`],
        explanation: `The clock shows ${timeWords(a.h, m)}. ${name} ${a.what} ${a.am ? 'in the morning' : a.h === 12 ? 'just after midday' : a.h >= 6 ? 'in the evening' : 'in the afternoon'}, so it is ${digital(a.h, m)} ${sfx}`,
        tags: WORD,
      }
    }

    if (level === 1) return oneOf(rng, [() => read(15), () => set(15)])
    if (level === 2) return oneOf(rng, [() => read(5), () => set(5)])
    if (level === 3) return toDigital()
    return ampm()
  },
}

export const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const
export const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

/** Kalender satu bulan sebagai tabel. start: 0 = Senin. */
export function calendarFig(month: number, start: number): Fig {
  const days = MONTH_DAYS[month]!
  const rows: string[][] = []
  let row: string[] = Array.from({ length: start }, () => '')
  for (let d = 1; d <= days; d++) {
    row.push(String(d))
    if (row.length === 7) {
      rows.push(row)
      row = []
    }
  }
  if (row.length) rows.push([...row, ...Array.from({ length: 7 - row.length }, () => '')])
  return { kind: 'table', caption: MONTHS[month]!, head: [...WEEK], rows, alt: `A calendar for ${MONTHS[month]}. The 1st is a ${DAYS[start]}. It has ${days} days.` }
}

const timeIntervals3: Generator = {
  skill: 'm3.time-intervals',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const name = pickName(rng)

    const units = (): GeneratedItem => {
      const facts = [
        { big: 'hours', small: 'minutes', per: 60, fact: 'There are 60 minutes in 1 hour.' },
        { big: 'weeks', small: 'days', per: 7, fact: 'There are 7 days in 1 week.' },
        { big: 'minutes', small: 'seconds', per: 60, fact: 'There are 60 seconds in 1 minute.' },
        { big: 'days', small: 'hours', per: 24, fact: 'There are 24 hours in 1 day.' },
        { big: 'years', small: 'months', per: 12, fact: 'There are 12 months in 1 year.' },
      ]
      const f = rng.pick(facts)
      const n = rng.int(3, 5)
      return {
        type: 'numeric',
        prompt: `How many ${f.small} are in ${n} ${f.big}?`,
        answer: n * f.per,
        hints: [f.fact, `Add ${f.per} for each one, or multiply by ${n}.`, `2 ${f.big} = ${2 * f.per} ${f.small}. Keep adding ${f.per}.`],
        explanation: `${f.fact} ${n} × ${f.per} = ${n * f.per}.`,
      }
    }

    const monthDays = (): GeneratedItem => {
      const mo = rng.pick([0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
      if (rng.chance(0.5)) {
        return {
          type: 'numeric',
          prompt: `How many days are there in ${MONTHS[mo]}?`,
          answer: MONTH_DAYS[mo]!,
          hints: ['Every month except February has 30 or 31 days.', 'Use your knuckles to remember which months are long.', `${MONTHS[mo]} is month number ${mo + 1}.`],
          explanation: `${MONTHS[mo]} has ${MONTH_DAYS[mo]} days.`,
          tip: 'Knuckle months have 31 days. Months in the dips between knuckles have 30, except February.',
        }
      }
      const next = MONTHS[(mo + 1) % 12]!
      return {
        type: 'mcq',
        prompt: `Which month comes straight after ${MONTHS[mo]}?`,
        ...textChoice(rng, next, [
          { value: MONTHS[(mo + 11) % 12]!, why: `${MONTHS[(mo + 11) % 12]} comes before ${MONTHS[mo]}.` },
          { value: MONTHS[(mo + 2) % 12]!, why: `${MONTHS[(mo + 2) % 12]} comes two months after ${MONTHS[mo]}.` },
          { value: MONTHS[(mo + 6) % 12]!, why: `${MONTHS[(mo + 6) % 12]} is half a year away from ${MONTHS[mo]}.` },
        ]),
        hints: ['Say the months of the year in order.', 'There are 12 months. After the last month, the order starts again.', `${MONTHS[mo]} is month number ${mo + 1}.`],
        explanation: `${next} comes straight after ${MONTHS[mo]}.`,
      }
    }

    const within = (): GeneratedItem => {
      const h = rng.int(1, 11)
      const m1 = rng.int(0, 7) * 5
      const len = rng.int(2, (55 - m1) / 5) * 5
      const what = rng.pick(['A cartoon', 'A music lesson', 'A swimming lesson', 'A school assembly', 'Piano practice'])
      return {
        type: 'numeric',
        prompt: `${what} starts at ${digital(h, m1)} and ends at ${digital(h, m1 + len)}. How long does it last?`,
        answer: len,
        unit: 'minutes',
        hints: ['Both times are in the same hour.', 'Count on in 5s from the start time to the end time.', `From ${digital(h, m1)} to ${digital(h, m1 + 5)} is 5 minutes.`],
        explanation: `${m1 + len} - ${m1} = ${len}, so it lasts ${len} minutes.`,
      }
    }

    const dayOfWeek = (): GeneratedItem => {
      const mo = rng.pick([0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
      const start = rng.int(0, 6)
      const d = rng.int(2, MONTH_DAYS[mo]!)
      const dow = (start + d - 1) % 7
      return {
        type: 'mcq',
        prompt: `Look at the calendar. What day of the week is ${d} ${MONTHS[mo]}?`,
        figure: calendarFig(mo, start),
        ...textChoice(rng, DAYS[dow]!, [1, 6, 2].map((k) => ({ value: DAYS[(dow + k) % 7]!, why: `Find ${d} in the calendar, then look up to the top of its column.` }))),
        hints: [`Find the number ${d} on the calendar.`, 'The day names are at the top of each column.', `Go up the column from ${d} to the top.`],
        explanation: `${d} ${MONTHS[mo]} is in the ${DAYS[dow]} column.`,
      }
    }

    const endTime = (): GeneratedItem => {
      const h = rng.int(1, 11)
      const m1 = rng.int(1, 11) * 5
      let len = rng.pick([15, 20, 25, 30, 35, 40, 45])
      if (m1 + len === 60) len += 5
      const tot = m1 + len
      const eh = tot >= 60 ? hour12(h + 1) : h
      const em = tot % 60
      const what = rng.pick(['Swimming', 'A football match', 'A baking class', 'A dance lesson'])
      return {
        type: 'clock',
        prompt: `${what} starts at ${digital(h, m1)}. It lasts ${len} minutes. Show the time it ends.`,
        answer: { h: eh, m: em },
        stepMinutes: 5,
        hints: ['Start at the start time and count on.', `Count on ${len} minutes in 5s.`, tot >= 60 ? `From ${digital(h, m1)} to ${hour12(h + 1)}:00 is ${60 - m1} minutes.` : `${m1} + ${len} is less than 60, so the hour stays the same.`],
        explanation: tot >= 60
          ? `${digital(h, m1)} to ${hour12(h + 1)}:00 is ${60 - m1} minutes. ${len - (60 - m1)} more minutes makes ${digital(eh, em)}.`
          : `${m1} + ${len} = ${tot}, so it ends at ${digital(eh, em)}.`,
        tags: WORD,
      }
    }

    const weekLater = (): GeneratedItem => {
      const mo = rng.pick([0, 2, 3, 4, 6, 7, 9, 11])
      const start = rng.int(0, 6)
      const k = rng.pick([1, 2])
      const d = rng.int(1, MONTH_DAYS[mo]! - 7 * k)
      const ans = d + 7 * k
      return {
        type: 'mcq',
        prompt: `${name}'s birthday is ${k === 1 ? 'one week' : 'two weeks'} after ${d} ${MONTHS[mo]}. What is the date of the birthday?`,
        figure: calendarFig(mo, start),
        ...textChoice(rng, `${ans} ${MONTHS[mo]}`, [
          { value: `${d + k} ${MONTHS[mo]}`, why: `A week is 7 days, so add 7 for each week.` },
          { value: `${ans + 1} ${MONTHS[mo]}`, why: `Count again: one week after ${d} is ${d + 7}.` },
          { value: `${ans - 1} ${MONTHS[mo]}`, why: `Count again: one week after ${d} is ${d + 7}.` },
          { value: `${d + 5 * k} ${MONTHS[mo]}`, why: 'A week has 7 days, including the weekend.' },
        ]),
        hints: ['A week is 7 days.', 'On the calendar, one week later is the date just below.', `Find ${d} on the calendar.`],
        explanation: `${k === 1 ? 'One week is 7 days' : 'Two weeks is 14 days'}. ${d} + ${7 * k} = ${ans}, so the birthday is ${ans} ${MONTHS[mo]}.`,
        tags: WORD,
      }
    }

    const across = (): GeneratedItem => {
      const h = rng.int(1, 9)
      const m1 = rng.int(6, 11) * 5
      const dh = rng.int(0, 1)
      const m2 = rng.int(1, 8) * 5
      const eh = h + 1 + dh
      const len = 60 - m1 + dh * 60 + m2
      const what = rng.pick(['A film', 'A train ride', 'A school trip to the zoo', 'A long bus ride'])
      return {
        type: 'numeric',
        prompt: `${what} starts at ${digital(h, m1)} and ends at ${digital(hour12(eh), m2)}. How many minutes does it last?`,
        answer: len,
        unit: 'minutes',
        hints: ['Count on to the next o\'clock first.', `From ${digital(h, m1)} to ${h + 1}:00 is ${60 - m1} minutes. Then keep counting.`, dh ? `${h + 1}:00 to ${eh}:00 is 60 minutes.` : `${h + 1}:00 to ${digital(eh, m2)} is ${m2} minutes.`],
        explanation: `${60 - m1} minutes to ${h + 1}:00${dh ? `, 60 minutes to ${eh}:00` : ''} and ${m2} minutes more. ${60 - m1}${dh ? ' + 60' : ''} + ${m2} = ${len} minutes.`,
        tags: WORD,
      }
    }

    const between = (): GeneratedItem => {
      const mo = rng.pick([0, 2, 4, 6, 7, 9, 11])
      const d1 = rng.int(1, 15)
      const gap = rng.int(5, 13)
      return {
        type: 'numeric',
        prompt: `How many days after ${d1} ${MONTHS[mo]} is ${d1 + gap} ${MONTHS[mo]}?`,
        answer: gap,
        unit: 'days',
        hints: ['Count on from the first date.', `Take ${d1} away from ${d1 + gap}.`, `${d1} ${MONTHS[mo]} to ${d1 + 7} ${MONTHS[mo]} is one week.`],
        explanation: `${d1 + gap} - ${d1} = ${gap}, so it is ${gap} days later.`,
      }
    }

    const crossMonth = (): GeneratedItem => {
      const mo = rng.pick([0, 2, 3, 4, 5, 6, 7, 8, 9, 10])
      const days = MONTH_DAYS[mo]!
      const d = rng.int(days - 6, days - 1)
      const add = rng.int(days - d + 2, days - d + 9)
      const nd = d + add - days
      const next = MONTHS[(mo + 1) % 12]!
      return {
        type: 'mcq',
        prompt: `${name}'s holiday starts on ${d} ${MONTHS[mo]}. It ends ${add} days later. On what date does it end?`,
        ...textChoice(rng, `${nd} ${next}`, [
          { value: `${d + add} ${MONTHS[mo]}`, why: `${MONTHS[mo]} only has ${days} days, so the date moves into ${next}.` },
          { value: `${nd + 1} ${next}`, why: `${MONTHS[mo]} has ${days} days. Count on from ${d} ${MONTHS[mo]} again.` },
          { value: `${nd - 1 > 0 ? nd - 1 : nd + 2} ${next}`, why: `${MONTHS[mo]} has ${days} days, not ${days - 1}.` },
          { value: `${add - d > 0 ? add - d : nd + 3} ${next}`, why: `Count on ${add} days from ${d} ${MONTHS[mo]}.` },
        ]),
        hints: [`How many days does ${MONTHS[mo]} have?`, `Count on to the end of ${MONTHS[mo]} first, then into ${next}.`, `From ${d} ${MONTHS[mo]} to ${days} ${MONTHS[mo]} is ${days - d} days.`],
        explanation: `${days - d} days takes you to ${days} ${MONTHS[mo]}. ${add - (days - d)} more days is ${nd} ${next}.`,
        tags: WORD,
      }
    }

    if (level === 1) return oneOf(rng, [units, monthDays])
    if (level === 2) return oneOf(rng, [within, dayOfWeek])
    if (level === 3) return oneOf(rng, [endTime, weekLater])
    if (level === 4) return oneOf(rng, [across, between])
    return crossMonth()
  },
}

// ---------------------------------------------------------------------------
// Gg: ukuran (panjang, massa, kapasitas, suhu)
// ---------------------------------------------------------------------------

const RULER_THINGS: readonly { icon: IconName; name: string }[] = [
  { icon: 'pencil', name: 'pencil' },
  { icon: 'crayon', name: 'crayon' },
  { icon: 'key', name: 'key' },
  { icon: 'leaf', name: 'leaf' },
  { icon: 'paperclip', name: 'paper clip' },
  { icon: 'caterpillar', name: 'caterpillar' },
]

export const cmText = (cm: number): string => (cm >= 100 ? `${Math.floor(cm / 100)} m${cm % 100 ? ` ${cm % 100} cm` : ''}` : `${cm} cm`)

const length3: Generator = {
  skill: 'm3.length',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const ruler = (offset: boolean): GeneratedItem => {
      const th = rng.pick(RULER_THINGS)
      const len = offset ? rng.int(5, 11) : rng.int(3, 12)
      const start = offset ? rng.int(1, 4) : 0
      const figure: Fig = { kind: 'ruler', lengthCm: 15, objectCm: len, objectStartCm: start, object: th.icon, alt: `A ${th.name} next to a ruler. It goes from ${start} cm to ${start + len} cm.` }
      return {
        type: 'numeric',
        prompt: `How long is the ${th.name}?`,
        figure,
        answer: len,
        unit: 'cm',
        hints: offset
          ? ['Look at both ends of the object.', 'The object does not start at 0, so take the start away from the end.', `It starts at ${start} cm.`]
          : ['Look where the object starts and ends.', 'It starts at 0, so read the number at the other end.', 'Read the ruler at the right-hand end of the object.'],
        explanation: offset ? `It goes from ${start} cm to ${start + len} cm. ${start + len} - ${start} = ${len} cm.` : `It starts at 0 and ends at ${len} cm, so it is ${len} cm long.`,
      }
    }

    const unitChoice = (): GeneratedItem => {
      const items = [
        { what: 'a pencil', unit: 'cm' },
        { what: 'a book', unit: 'cm' },
        { what: 'a classroom', unit: 'm' },
        { what: 'a football pitch', unit: 'm' },
        { what: 'a swimming pool', unit: 'm' },
        { what: 'the road from Malang to Surabaya', unit: 'km' },
        { what: 'a long train ride', unit: 'km' },
        { what: 'an ant', unit: 'mm' },
      ]
      const it = rng.pick(items)
      const all = [
        { value: 'mm', why: 'Millimetres are for very small lengths, like an ant.' },
        { value: 'cm', why: 'Centimetres are for short lengths, like a pencil.' },
        { value: 'm', why: 'Metres are for longer lengths, like a room.' },
        { value: 'km', why: 'Kilometres are for very long distances, like between two towns.' },
        { value: 'kg', why: 'Kilograms measure mass, not length.' },
      ].filter((u) => u.value !== it.unit)
      return {
        type: 'mcq',
        prompt: `Which unit is best for measuring the length of ${it.what}?`,
        ...textChoice(rng, it.unit, rng.shuffle(all).slice(0, 3)),
        hints: [`Think about how long ${it.what} is.`, 'mm and cm are for small things. m is for longer things. km is for distances between places.', `Is ${it.what} longer than your arm?`],
        explanation: `${cap(it.what)} is best measured in ${it.unit === 'mm' ? 'millimetres' : it.unit === 'cm' ? 'centimetres' : it.unit === 'm' ? 'metres' : 'kilometres'}.`,
      }
    }

    const compare = (): GeneratedItem => {
      const a = rng.int(1, 3) * 100
      const b = a + rng.pick([-30, -15, -5, 5, 20, 40])
      const aText = `${a / 100} m`
      const bText = `${b} cm`
      const correct = a > b ? `${aText} is longer than ${bText}` : `${bText} is longer than ${aText}`
      return {
        type: 'mcq',
        prompt: `Which is true?`,
        ...textChoice(rng, correct, [
          { value: a > b ? `${bText} is longer than ${aText}` : `${aText} is longer than ${bText}`, why: `${aText} is ${a} cm. Compare ${a} cm with ${b} cm.` },
          { value: `${aText} is the same as ${bText}`, why: `${aText} is ${a} cm, which is different from ${b} cm.` },
          { value: `${aText} is the same as ${a / 100} cm`, why: '1 m is 100 cm, so metres are much longer than centimetres.' },
        ]),
        hints: ['Change both lengths to the same unit.', '1 m = 100 cm.', `Write ${aText} in centimetres, then compare it with ${b} cm.`],
        explanation: `${aText} = ${a} cm, and ${Math.max(a, b)} cm is longer than ${Math.min(a, b)} cm.`,
      }
    }

    const convert = (): GeneratedItem => {
      const kind = rng.int(0, 3)
      if (kind === 0) {
        const m = rng.int(2, 9)
        return {
          type: 'numeric',
          prompt: `${m} m = ___ cm`,
          answer: m * 100,
          unit: 'cm',
          hints: ['How many centimetres are in 1 metre?', '1 m = 100 cm.', `Multiply ${m} by 100.`],
          explanation: `1 m = 100 cm, so ${m} m = ${m} × 100 = ${m * 100} cm.`,
        }
      }
      if (kind === 1) {
        const m = rng.int(1, 4)
        const c = rng.int(5, 95)
        return {
          type: 'numeric',
          prompt: `${m} m ${c} cm = ___ cm`,
          answer: m * 100 + c,
          unit: 'cm',
          hints: ['Change the metres to centimetres first.', `${m} m = ${m * 100} cm.`, `Then add the ${c} cm.`],
          explanation: `${m} m = ${m * 100} cm. ${m * 100} + ${c} = ${m * 100 + c} cm.`,
        }
      }
      if (kind === 2) {
        const m = rng.int(1, 6)
        const c = rng.int(1, 19) * 5
        return {
          type: 'text',
          prompt: `${m * 100 + c} cm = ___ m ___ cm`,
          blanks: [{ answers: [String(m)] }, { answers: [String(c)] }],
          hints: ['100 cm make 1 m.', `How many whole hundreds are in ${m * 100 + c}?`, 'Each hundred centimetres is 1 m. The rest stays as centimetres.'],
          explanation: `${m * 100} cm = ${m} m, so ${m * 100 + c} cm = ${m} m ${c} cm.`,
        }
      }
      const k = rng.int(2, 5)
      return {
        type: 'numeric',
        prompt: `${k} km = ___ m`,
        answer: k * 1000,
        unit: 'm',
        hints: ['How many metres are in 1 kilometre?', '1 km = 1,000 m.', `Multiply ${k} by 1,000.`],
        explanation: `1 km = 1,000 m, so ${k} km = ${fmt(k * 1000)} m.`,
      }
    }

    const story = (): GeneratedItem => {
      const kind = rng.int(0, 2)
      if (kind === 0) {
        const m = rng.int(2, 4)
        const cut = rng.int(3, 18) * 5
        const who = pickName(rng)
        return {
          type: 'numeric',
          prompt: `${who} has a ribbon ${m} m long. ${who} cuts off ${cut} cm. How many centimetres of ribbon are left?`,
          answer: m * 100 - cut,
          unit: 'cm',
          hints: ['Use the same unit for both lengths.', `${m} m = ${m * 100} cm. Take away the piece that is cut off.`, `${m * 100} - ${cut}: take away the tens first.`],
          explanation: `${m} m = ${m * 100} cm. ${m * 100} - ${cut} = ${m * 100 - cut} cm.`,
          tags: WORD,
        }
      }
      if (kind === 1) {
        const a = rng.int(55, 95)
        const n = rng.int(3, 5)
        return {
          type: 'numeric',
          prompt: `A table is ${a} cm long. ${cap(numberWords(n))} tables are put end to end. How long is the row of tables in centimetres?`,
          answer: a * n,
          unit: 'cm',
          hints: ['All the tables are the same length.', `Add ${a} cm ${n} times, or multiply.`, `${a} + ${a} = ${2 * a}.`],
          explanation: `${n} × ${a} = ${a * n} cm, which is ${cmText(a * n)}.`,
          tags: WORD,
        }
      }
      const [A, B] = twoNames(rng)
      const ja = rng.int(110, 180)
      const jb = rng.int(95, ja - 8)
      return {
        type: 'numeric',
        prompt: `${A} jumps ${cmText(ja)}. ${B} jumps ${jb} cm. How much further does ${A} jump, in centimetres?`,
        answer: ja - jb,
        unit: 'cm',
        hints: ['Change both jumps to centimetres.', `${cmText(ja)} = ${ja} cm. Find the difference.`, `Count up from ${jb} to ${Math.ceil((jb + 1) / 10) * 10}.`],
        explanation: `${cmText(ja)} = ${ja} cm. ${ja} - ${jb} = ${ja - jb} cm.`,
        tags: WORD,
      }
    }

    const orderLengths = (): GeneratedItem => {
      const vals = rng.sample([95, 105, 110, 120, 140, 150, 155, 190, 210, 250], 4)
      const show = (v: number) => (rng.chance(0.5) ? `${v} cm` : cmText(v))
      const texts = vals.map((v) => ({ v, t: show(v) }))
      const sorted = [...texts].sort((p, q) => p.v - q.v)
      return {
        type: 'order',
        prompt: 'Put the lengths in order, starting with the shortest.',
        items: sorted.map((x) => x.t),
        hints: ['Change all the lengths into centimetres first.', '1 m = 100 cm.', `${sorted[sorted.length - 1]!.t} is ${sorted[sorted.length - 1]!.v} cm.`],
        explanation: `In centimetres: ${sorted.map((x) => x.v).join(', ')}. So the order is ${sorted.map((x) => x.t).join(', ')}.`,
      }
    }

    if (level === 1) return oneOf(rng, [() => ruler(false), unitChoice])
    if (level === 2) return oneOf(rng, [() => ruler(true), compare])
    if (level === 3) return convert()
    if (level === 4) return story()
    return orderLengths()
  },
}

const MASS_THINGS = ['bag of flour', 'pineapple', 'bag of rice', 'watermelon', 'box of tea', 'bunch of bananas'] as const
const DRINKS = ['water', 'orange juice', 'milk', 'coconut water'] as const

const massCapacity3: Generator = {
  skill: 'm3.mass-capacity',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const readScale = (hard: boolean): GeneratedItem => {
      const kg = hard && rng.chance(0.4)
      const max = kg ? rng.pick([5, 10]) : hard ? rng.pick([500, 1000]) : 1000
      const step = kg ? (max === 5 ? 1 : 2) : hard ? (max === 500 ? 50 : 200) : 100
      const value = rng.int(2, max / step - 1) * step
      const th = rng.pick(MASS_THINGS)
      const unit = kg ? 'kg' : 'g'
      return {
        type: 'numeric',
        prompt: `What is the mass of the ${th}?`,
        figure: { kind: 'scale', max, value, step, unit, alt: `Scales from 0 to ${fmt(max)} ${unit}, marked every ${step} ${unit}. The pointer is at ${fmt(value)} ${unit}.` },
        answer: value,
        unit,
        hints: ['Find where the pointer is.', `Each mark on the scale is ${step} ${unit}.`, `Count on in ${step}s from 0 to the pointer.`],
        explanation: `The marks go up in ${step}s. The pointer is at ${fmt(value)} ${unit}.`,
      }
    }

    const readJug = (hard: boolean): GeneratedItem => {
      const litres = hard && rng.chance(0.3)
      const capacity = litres ? 5 : hard ? rng.pick([500, 1000]) : 1000
      const step = litres ? 1 : hard ? (capacity === 500 ? 50 : 200) : 100
      const value = rng.int(2, capacity / step - 1) * step
      const drink = rng.pick(DRINKS)
      const unit = litres ? 'l' : 'ml'
      return {
        type: 'numeric',
        prompt: `How much ${drink} is in the jug?`,
        figure: { kind: 'jug', capacity, value, step, unit, alt: `A jug marked every ${step} ${unit} up to ${fmt(capacity)} ${unit}. The ${drink} reaches ${fmt(value)} ${unit}.` },
        answer: value,
        unit,
        hints: ['Look at the top of the liquid.', `Each mark on the jug is ${step} ${unit}.`, `Count up in ${step}s from the bottom.`],
        explanation: `The marks go up in ${step}s. The ${drink} reaches ${fmt(value)} ${unit}.`,
      }
    }

    const unitChoice = (): GeneratedItem => {
      const items = [
        { q: 'the mass of an elephant', unit: 'kg' },
        { q: 'the mass of an apple', unit: 'g' },
        { q: 'the mass of a sack of rice', unit: 'kg' },
        { q: 'the mass of a pencil', unit: 'g' },
        { q: 'how much water is in a bucket', unit: 'l' },
        { q: 'how much medicine is in a spoon', unit: 'ml' },
        { q: 'how much water fills a bath', unit: 'l' },
        { q: 'how much juice is in a cup', unit: 'ml' },
      ]
      const it = rng.pick(items)
      const all = [
        { value: 'g', why: 'Grams are for the mass of light things.' },
        { value: 'kg', why: 'Kilograms are for the mass of heavier things.' },
        { value: 'ml', why: 'Millilitres are for small amounts of liquid.' },
        { value: 'l', why: 'Litres are for larger amounts of liquid.' },
        { value: 'cm', why: 'Centimetres measure length.' },
      ].filter((u) => u.value !== it.unit)
      return {
        type: 'mcq',
        prompt: `Which unit is best for measuring ${it.q}?`,
        ...textChoice(rng, it.unit, rng.shuffle(all).slice(0, 3)),
        hints: ['Are you measuring mass or how much liquid?', 'Grams and kilograms measure mass. Millilitres and litres measure capacity.', 'Is the amount small or large?'],
        explanation: `${cap(it.q)} is best measured in ${it.unit === 'g' ? 'grams' : it.unit === 'kg' ? 'kilograms' : it.unit === 'ml' ? 'millilitres' : 'litres'}.`,
      }
    }

    const convert = (): GeneratedItem => {
      const mass = rng.chance(0.5)
      const big = mass ? 'kg' : 'l'
      const small = mass ? 'g' : 'ml'
      const kind = rng.int(0, 3)
      if (kind === 0) {
        const n = rng.int(2, 9)
        return {
          type: 'numeric',
          prompt: `${n} ${big} = ___ ${small}`,
          answer: n * 1000,
          unit: small,
          hints: [`How many ${small} are in 1 ${big}?`, `1 ${big} = 1,000 ${small}.`, `Multiply ${n} by 1,000.`],
          explanation: `1 ${big} = 1,000 ${small}, so ${n} ${big} = ${fmt(n * 1000)} ${small}.`,
        }
      }
      if (kind === 1) {
        const n = rng.int(1, 4)
        const r = rng.int(1, 9) * 100
        return {
          type: 'numeric',
          prompt: `${n} ${big} ${r} ${small} = ___ ${small}`,
          answer: n * 1000 + r,
          unit: small,
          hints: [`Change the ${big} to ${small} first.`, `${n} ${big} = ${fmt(n * 1000)} ${small}.`, `Then add the ${r} ${small}.`],
          explanation: `${n} ${big} = ${fmt(n * 1000)} ${small}. ${fmt(n * 1000)} + ${r} = ${fmt(n * 1000 + r)} ${small}.`,
        }
      }
      if (kind === 2) {
        const half = rng.chance(0.5)
        return {
          type: 'numeric',
          prompt: `How many ${mass ? 'grams' : 'millilitres'} are in ${half ? 'half' : 'a quarter'} of a ${mass ? 'kilogram' : 'litre'}?`,
          answer: half ? 500 : 250,
          unit: small,
          hints: [`1 ${big} = 1,000 ${small}.`, `${half ? 'Half' : 'A quarter'} means divide by ${half ? 2 : 4}.`, half ? 'Half of 10 hundreds is 5 hundreds.' : 'Halve 1,000, then halve again.'],
          explanation: `1,000 ÷ ${half ? 2 : 4} = ${half ? 500 : 250}, so ${half ? 'half' : 'a quarter'} of a ${mass ? 'kilogram' : 'litre'} is ${half ? 500 : 250} ${small}.`,
        }
      }
      const a = rng.int(1, 3) * 1000
      const b = a + rng.pick([-300, -100, 200, 500])
      const correct = a > b ? `${a / 1000} ${big} is more than ${fmt(b)} ${small}` : `${fmt(b)} ${small} is more than ${a / 1000} ${big}`
      return {
        type: 'mcq',
        prompt: 'Which is true?',
        ...textChoice(rng, correct, [
          { value: a > b ? `${fmt(b)} ${small} is more than ${a / 1000} ${big}` : `${a / 1000} ${big} is more than ${fmt(b)} ${small}`, why: `${a / 1000} ${big} = ${fmt(a)} ${small}. Compare ${fmt(a)} with ${fmt(b)}.` },
          { value: `${a / 1000} ${big} is the same as ${fmt(b)} ${small}`, why: `${a / 1000} ${big} = ${fmt(a)} ${small}, which is different from ${fmt(b)} ${small}.` },
          { value: `${a / 1000} ${big} is the same as ${a / 1000} ${small}`, why: `1 ${big} is 1,000 ${small}, so ${big} is much bigger than ${small}.` },
        ]),
        hints: ['Change both amounts to the same unit.', `1 ${big} = 1,000 ${small}.`, `${a / 1000} ${big} is ${fmt(a)} ${small === 'g' ? 'grams' : 'millilitres'}.`],
        explanation: `${a / 1000} ${big} = ${fmt(a)} ${small}, and ${fmt(Math.max(a, b))} is more than ${fmt(Math.min(a, b))}.`,
      }
    }

    const story = (): GeneratedItem => {
      const name = pickName(rng)
      const kind = rng.int(0, 2)
      if (kind === 0) {
        const kg = rng.int(1, 3)
        const used = rng.int(2, 9) * 100
        return {
          type: 'numeric',
          prompt: `A bag of rice has a mass of ${kg} kg. ${name} uses ${used} g of it. How many grams of rice are left?`,
          answer: kg * 1000 - used,
          unit: 'g',
          hints: ['Use the same unit for both amounts.', `${kg} kg = ${fmt(kg * 1000)} g. Take away the rice that was used.`, `${fmt(kg * 1000)} - ${used}: take away the hundreds.`],
          explanation: `${kg} kg = ${fmt(kg * 1000)} g. ${fmt(kg * 1000)} - ${used} = ${fmt(kg * 1000 - used)} g.`,
          tags: WORD,
        }
      }
      if (kind === 1) {
        const jug = rng.pick([750, 800, 900, 1000])
        const cup = rng.pick([150, 200, 250])
        let n = rng.int(2, Math.floor(jug / cup) - 1)
        if (jug - n * cup === n * cup && n > 2) n -= 1
        else if (jug - n * cup === n * cup) n += 1
        const drink = rng.pick(DRINKS)
        return {
          type: 'numeric',
          prompt: `A jug holds ${jug} ml of ${drink}. ${name} pours ${n} cups of ${cup} ml. How much ${drink} is left in the jug?`,
          answer: jug - n * cup,
          unit: 'ml',
          hints: ['First find how much was poured out.', `${n} cups of ${cup} ml. Multiply, then take away from ${jug} ml.`, `${n} × ${cup} = ${n * cup}.`],
          explanation: `${n} × ${cup} = ${n * cup} ml poured. ${jug} - ${n * cup} = ${jug - n * cup} ml left.`,
          tags: WORD,
        }
      }
      const n = rng.int(3, 6)
      const each = rng.pick([250, 500])
      return {
        type: 'numeric',
        prompt: `${name} buys ${n} bottles of water. Each bottle holds ${each} ml. How many millilitres is that altogether?`,
        answer: n * each,
        unit: 'ml',
        hints: ['Each bottle holds the same amount.', `Multiply ${each} by ${n}.`, `2 bottles hold ${2 * each} ml.`],
        explanation: `${n} × ${each} = ${fmt(n * each)} ml${n * each >= 1000 ? `, which is ${Math.floor((n * each) / 1000)} l ${(n * each) % 1000 ? `${(n * each) % 1000} ml` : ''}`.trimEnd() : ''}.`,
        tags: WORD,
      }
    }

    const books = (): GeneratedItem => {
      const n = rng.int(3, 5)
      const each = rng.pick([200, 250, 300, 400, 500])
      const box = rng.pick([200, 300, 400, 500])
      const total = n * each + box
      const t = total % 1000 === 0 ? `${total / 1000} kg` : total > 1000 ? `${Math.floor(total / 1000)} kg ${total % 1000} g` : `${total} g`
      return {
        type: 'numeric',
        prompt: `A box holds ${n} books that are all the same. The full box has a mass of ${t}. The empty box is ${box} g. What is the mass of one book?`,
        answer: each,
        unit: 'g',
        hints: ['First find the mass of the books without the box.', `Change ${t} to grams, then take away ${box} g.`, `${t} = ${fmt(total)} g.`],
        explanation: `${fmt(total)} - ${box} = ${fmt(n * each)} g for ${n} books. ${fmt(n * each)} ÷ ${n} = ${each} g each.`,
        tags: WORD,
      }
    }

    if (level === 1) return oneOf(rng, [() => readScale(false), () => readJug(false)])
    if (level === 2) return oneOf(rng, [() => readScale(true), () => readJug(true), unitChoice])
    if (level === 3) return convert()
    if (level === 4) return story()
    return books()
  },
}

const temperature3: Generator = {
  skill: 'm3.temperature',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const read = (fine: boolean): GeneratedItem => {
      const step = fine ? 2 : rng.pick([5, 10])
      const max = rng.pick([40, 50])
      const v = fine ? rng.int(6, max / 2 - 1) * 2 : rng.int(3, max / 5 - 1) * 5
      if (!fine && rng.chance(0.4)) return pickThermo(max)
      return {
        type: 'numeric',
        prompt: 'What temperature does the thermometer show?',
        figure: { kind: 'thermometer', min: 0, max, value: v, step, alt: `A thermometer from 0 to ${max} degrees Celsius, marked every ${step} degrees. It shows ${v} °C.` },
        answer: v,
        unit: '°C',
        hints: ['Find the top of the red line.', `Each mark is ${step} degrees.`, `Find the labelled number just below the top of the line, then count on in ${step}s.`],
        explanation: `The marks go up in ${step}s. The line stops at ${v} °C.`,
        solution: [
          { say: 'Find the top of the line.', figure: { kind: 'thermometer', min: 0, max, value: v, step, alt: `A thermometer showing ${v} °C.` } },
          { say: `Count up in ${step}s from the number just below it.`, show: `${v} °C` },
        ],
      }
    }

    const pickThermo = (max: number): GeneratedItem => {
      const v = rng.int(2, max / 5 - 2) * 5
      const th = (x: number): Fig => ({ kind: 'thermometer', min: 0, max, value: x, step: 5, alt: `A thermometer showing ${x} °C.` })
      const wrong = [v + 5, v - 5, v + 10, v - 10].filter((x) => x > 0 && x < max)
      return {
        type: 'mcq',
        prompt: `Which thermometer shows ${v} °C?`,
        ...figChoice(rng, th(v), wrong.slice(0, 3).map((x) => ({ figure: th(x), why: `This thermometer shows ${x} °C.` }))),
        hints: ['Look at the top of the red line on each thermometer.', 'Each mark is 5 degrees.', `Find ${v - (v % 10)} on the scale first.`],
        explanation: `The right thermometer has its line at ${v} °C.`,
      }
    }

    const warmer = (): GeneratedItem => {
      const [A, B] = rng.sample(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], 2) as [string, string]
      const a = rng.int(18, 34)
      let b = rng.int(18, 34)
      if (b === a) b += 2
      const hotter = a > b ? A : B
      const colder = a > b ? B : A
      return {
        type: 'mcq',
        prompt: `On ${A} it was ${a} °C. On ${B} it was ${b} °C. Which is true?`,
        ...textChoice(rng, `${hotter} was warmer.`, [
          { value: `${colder} was warmer.`, why: `${Math.min(a, b)} °C is a lower temperature than ${Math.max(a, b)} °C.` },
          { value: 'Both days were the same.', why: `${a} °C and ${b} °C are different temperatures.` },
          { value: `${hotter} was colder.`, why: `${Math.max(a, b)} is the higher number, so ${hotter} was warmer.` },
        ]),
        hints: ['A higher temperature means warmer.', 'Compare the two numbers.', `${a} or ${b}: which is bigger?`],
        explanation: `${Math.max(a, b)} °C is higher than ${Math.min(a, b)} °C, so ${hotter} was warmer.`,
      }
    }

    const change = (): GeneratedItem => {
      const kind = rng.int(0, 2)
      if (kind === 0) {
        const a = rng.int(16, 25)
        const up = rng.int(4, 12)
        return {
          type: 'numeric',
          prompt: `In the morning it is ${a} °C. By midday the temperature rises by ${up} degrees. What is the temperature at midday?`,
          answer: a + up,
          unit: '°C',
          hints: ['Rises means it gets warmer.', `Add ${up} to ${a}.`, `Count on from ${a}: ${a + 1}, ${a + 2}, ...`],
          explanation: `${a} + ${up} = ${a + up}, so it is ${a + up} °C at midday.`,
          tags: WORD,
        }
      }
      if (kind === 1) {
        const a = rng.int(25, 35)
        const down = rng.int(4, 12)
        return {
          type: 'numeric',
          prompt: `In the afternoon it is ${a} °C. At night the temperature falls by ${down} degrees. What is the temperature at night?`,
          answer: a - down,
          unit: '°C',
          hints: ['Falls means it gets colder.', `Take ${down} away from ${a}.`, `Count back from ${a}: ${a - 1}, ${a - 2}, ...`],
          explanation: `${a} - ${down} = ${a - down}, so it is ${a - down} °C at night.`,
          tags: WORD,
        }
      }
      const a = rng.int(17, 23)
      const b = rng.int(Math.ceil((a + 1) / 10) * 10 + 1, 34)
      return {
        type: 'numeric',
        prompt: `At 7 a.m. it was ${a} °C. At 1 p.m. it was ${b} °C. How many degrees warmer was it at 1 p.m.?`,
        answer: b - a,
        unit: '°C',
        hints: ['Find the difference between the two temperatures.', `Count up from ${a} to ${b}.`, `From ${a} to ${Math.ceil((a + 1) / 10) * 10} is ${Math.ceil((a + 1) / 10) * 10 - a} degrees.`],
        explanation: `${b} - ${a} = ${b - a}, so it was ${b - a} degrees warmer.`,
        tags: WORD,
      }
    }

    const table = (): GeneratedItem => {
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday']
      const temps = rng.sample(range(22, 34), 4)
      const figure: Fig = { kind: 'table', head: ['Day', 'Temperature'], rows: days.map((d, i) => [d, `${temps[i]} °C`]), alt: `Temperatures: ${days.map((d, i) => `${d} ${temps[i]} °C`).join(', ')}.` }
      const hi = Math.max(...temps)
      const lo = Math.min(...temps)
      if (rng.chance(0.5)) {
        const warmest = rng.chance(0.5)
        const ans = days[temps.indexOf(warmest ? hi : lo)]!
        return {
          type: 'mcq',
          prompt: `The table shows the midday temperature in a town. Which day was the ${warmest ? 'warmest' : 'coolest'}?`,
          figure,
          ...textChoice(rng, ans, days.filter((d) => d !== ans).map((d) => ({ value: d, why: `${d} was ${temps[days.indexOf(d)]} °C. ${ans} was ${warmest ? 'warmer' : 'cooler'} at ${warmest ? hi : lo} °C.` }))),
          hints: ['Compare the four temperatures.', warmest ? 'The warmest day has the highest temperature.' : 'The coolest day has the lowest temperature.', 'Look at the tens digits first, then the ones.'],
          explanation: `The ${warmest ? 'highest' : 'lowest'} temperature is ${warmest ? hi : lo} °C, on ${ans}.`,
        }
      }
      return {
        type: 'numeric',
        prompt: 'The table shows the midday temperature in a town. What is the difference between the warmest and coolest days?',
        figure,
        answer: hi - lo,
        unit: '°C',
        hints: ['Find the highest and the lowest temperature.', 'Take the lowest away from the highest.', `The highest temperature is ${hi} °C.`],
        explanation: `The warmest was ${hi} °C and the coolest was ${lo} °C. ${hi} - ${lo} = ${hi - lo} degrees.`,
      }
    }

    const sensible = (): GeneratedItem => {
      const sets = [
        { q: 'Which is the most likely temperature on a hot day in Surabaya?', a: '33 °C', h: 'A hot day is much warmer than a cool room.', wrong: [['3 °C', 'That is colder than a fridge.'], ['80 °C', 'That is hotter than a cup of tea. People could not live in it.'], ['0 °C', 'Water freezes at 0 °C.']] },
        { q: 'At what temperature does water freeze?', a: '0 °C', h: 'Ice is very cold. Think of the lowest temperature here.', wrong: [['100 °C', 'Water boils at 100 °C.'], ['37 °C', 'That is about the temperature of your body.'], ['10 °C', 'Water is still liquid at 10 °C.']] },
        { q: 'At what temperature does water boil?', a: '100 °C', h: 'Boiling water is much hotter than your body.', wrong: [['0 °C', 'Water freezes at 0 °C.'], ['37 °C', 'That is about the temperature of your body.'], ['50 °C', 'Water is hot at 50 °C, but it does not boil yet.']] },
        { q: 'Which is closest to the temperature inside a healthy person?', a: '37 °C', h: 'Your body is warm, a little warmer than a hot day.', wrong: [['3 °C', 'That is as cold as a fridge.'], ['73 °C', 'That is far too hot for a person.'], ['100 °C', 'Water boils at 100 °C.']] },
        { q: 'Which is the most likely temperature inside a fridge?', a: '4 °C', h: 'A fridge is cold, but the food inside is not frozen.', wrong: [['40 °C', 'That is hotter than a sunny day.'], ['24 °C', 'That is the temperature of a cool room.'], ['100 °C', 'Water boils at 100 °C.']] },
      ]
      const st = rng.pick(sets)
      return {
        type: 'mcq',
        prompt: st.q,
        ...textChoice(rng, st.a, st.wrong.map(([v, w]) => ({ value: v!, why: w! }))),
        hints: ['Think about what each temperature feels like.', st.h, 'Cross out any temperature that does not make sense.'],
        explanation: `${st.a} is the sensible answer.`,
      }
    }

    const twoSteps = (): GeneratedItem => {
      const a = rng.int(17, 22)
      const up = rng.int(6, 13)
      const down = rng.int(3, 9)
      return {
        type: 'numeric',
        prompt: `At 6 a.m. it was ${a} °C. By midday it rose by ${up} degrees. By night it fell by ${down} degrees. What was the temperature at night?`,
        answer: a + up - down,
        unit: '°C',
        hints: ['Work in two steps.', 'First add the rise, then take away the fall.', `${a} + ${up} = ${a + up}.`],
        explanation: `${a} + ${up} = ${a + up}, then ${a + up} - ${down} = ${a + up - down} °C.`,
        tags: WORD,
      }
    }

    if (level === 1) return read(false)
    if (level === 2) return oneOf(rng, [() => read(true), warmer])
    if (level === 3) return change()
    if (level === 4) return oneOf(rng, [table, sensible])
    return twoSteps()
  },
}

// ---------------------------------------------------------------------------
// Gg: keliling dan luas
// ---------------------------------------------------------------------------

export type Cell = [number, number]

export function cellPerimeter(cells: readonly Cell[]): number {
  const set = new Set(cells.map(([r, c]) => `${r},${c}`))
  let p = 0
  for (const [r, c] of cells) {
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (!set.has(`${r + dr},${c + dc}`)) p++
  }
  return p
}

export function rectCells(r0: number, c0: number, h: number, w: number): Cell[] {
  const out: Cell[] = []
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) out.push([r0 + r, c0 + c])
  return out
}

/** Bangun siku (L, U, T, atau tangga) di dalam grid. */
export function rectilinear(rng: Rng, maxW: number, maxH: number): { cells: Cell[]; name: string } {
  const w = rng.int(3, maxW)
  const h = rng.int(3, maxH)
  const all = rectCells(1, 1, h, w)
  const kind = rng.pick(['L', 'U', 'T', 'step'] as const)
  const drop = new Set<string>()
  if (kind === 'L') {
    const a = rng.int(1, w - 1)
    const b = rng.int(1, h - 1)
    for (const [r, c] of rectCells(1, 1 + w - a, b, a)) drop.add(`${r},${c}`)
  } else if (kind === 'U') {
    const b = rng.int(1, h - 1)
    const c0 = rng.int(2, w - 1)
    for (let r = 1; r < 1 + b; r++) drop.add(`${r},${c0}`)
  } else if (kind === 'T') {
    const b = rng.int(1, h - 1)
    for (let r = 1 + h - b; r <= h; r++) {
      drop.add(`${r},1`)
      drop.add(`${r},${w}`)
    }
  } else {
    for (let r = 1; r <= h; r++) for (let c = 1; c <= w; c++) if (c > w - (r - 1)) drop.add(`${r},${c}`)
  }
  const cells = all.filter(([r, c]) => !drop.has(`${r},${c}`))
  return { cells, name: kind }
}

const perimeterArea3: Generator = {
  skill: 'm3.perimeter-area',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const gridItem = (cells: Cell[], rows: number, cols: number, ask: 'area' | 'perimeter', shapeWord: string): GeneratedItem => {
      const area = cells.length
      const per = cellPerimeter(cells)
      const figure: Fig = { kind: 'grid', rows, cols, shaded: cells, showUnits: true, alt: `A ${shapeWord} drawn on a grid of 1 cm squares. It covers ${area} squares and its edge is ${per} cm long.` }
      const rowsUsed = [...new Set(cells.map((c) => c[0]))].sort((x, y) => x - y)
      const rowCounts = rowsUsed.map((r) => cells.filter((c) => c[0] === r).length)
      if (ask === 'area') {
        return {
          type: 'numeric',
          prompt: 'Each square is 1 square centimetre. What is the area of the shaded shape?',
          figure,
          answer: area,
          unit: 'square cm',
          solution: [
            { say: 'Count the shaded squares one row at a time.', figure },
            { say: 'Add the rows together.', show: `${rowCounts.join(' + ')} = ${area}` },
          ],
          hints: ['Area is the space inside the shape.', 'Count the shaded squares. Count each row in turn.', 'Mark each square as you count it so you do not count it twice.'],
          explanation: `The shape covers ${area} squares, so its area is ${area} square centimetres.`,
        }
      }
      return {
        type: 'numeric',
        prompt: 'Each square has sides of 1 cm. What is the perimeter of the shaded shape?',
        figure,
        answer: per,
        unit: 'cm',
        hints: ['Perimeter is the distance all the way around the edge.', 'Count the square edges along the outside of the shape.', 'Start at one corner and go around, counting each 1 cm edge.'],
        explanation: `Going all the way around the outside edge there are ${per} edges of 1 cm, so the perimeter is ${per} cm.`,
        solution: [
          { say: 'Start at one corner and walk around the outside edge.', figure },
          { say: 'Count every 1 cm side you pass until you are back at the start.', show: `${per} cm` },
        ],
      }
    }

    const rect = (big: boolean): GeneratedItem => {
      const w = rng.int(2, big ? 7 : 5)
      const h = rng.int(2, big ? 5 : 4)
      const rows = h + rng.int(1, 3)
      const cols = w + rng.int(1, 3)
      const cells = rectCells(rng.int(0, rows - h), rng.int(0, cols - w), h, w)
      return gridItem(cells, rows, cols, rng.chance(0.5) ? 'area' : 'perimeter', 'rectangle')
    }

    const labelled = (): GeneratedItem => {
      const kind = rng.int(0, 2)
      if (kind === 0) {
        const l = rng.int(5, 12)
        const w = rng.int(2, Math.max(2, Math.floor(l * 0.65)))
        const p = 2 * (l + w)
        return {
          type: 'numeric',
          prompt: `What is the perimeter of this rectangle?`,
          figure: { kind: 'shape', shape: 'rectangle', sideLabels: [`${l} cm`, `${w} cm`], alt: `A rectangle ${l} cm long and ${w} cm wide.` },
          answer: p,
          unit: 'cm',
          hints: ['Perimeter is the distance all the way around.', 'A rectangle has two long sides and two short sides.', `${l} + ${w} + ${l} + ${w}: add the two long sides first.`],
          explanation: `${l} + ${w} + ${l} + ${w} = ${p} cm.`,
        }
      }
      if (kind === 1) {
        const k = rng.int(1, 3)
        const sides = [4 * k, 5 * k, 3 * k]
        const p = 12 * k
        return {
          type: 'numeric',
          prompt: 'What is the perimeter of this triangle?',
          figure: { kind: 'shape', shape: 'right-triangle', sideLabels: sides.map((x) => `${x} cm`), alt: `A right-angled triangle with sides ${sides[0]} cm, ${sides[1]} cm and ${sides[2]} cm.` },
          answer: p,
          unit: 'cm',
          hints: ['Perimeter is the total length of all the sides.', 'Add the three side lengths.', `${sides[0]} + ${sides[1]} = ${sides[0]! + sides[1]!}.`],
          explanation: `${sides.join(' + ')} = ${p} cm.`,
        }
      }
      const sh = rng.pick([{ shape: 'pentagon', n: 5 }, { shape: 'hexagon', n: 6 }, { shape: 'square', n: 4 }, { shape: 'triangle', n: 3 }] as const)
      const side = rng.int(2, 9)
      return {
        type: 'numeric',
        prompt: `All the sides of this ${sh.shape} are ${side} cm long. What is its perimeter?`,
        figure: { kind: 'shape', shape: sh.shape, sideLabels: [`${side} cm`], alt: `A ${sh.shape} with ${sh.n} equal sides of ${side} cm.` },
        answer: sh.n * side,
        unit: 'cm',
        hints: [`How many sides does a ${sh.shape} have?`, `Add ${side} cm once for every side, or multiply.`, `A ${sh.shape} has ${sh.n} sides.`],
        explanation: `${sh.n} × ${side} = ${sh.n * side} cm.`,
      }
    }

    const lshape = (): GeneratedItem => {
      const { cells } = rectilinear(rng, 6, 5)
      const maxR = Math.max(...cells.map((c) => c[0]))
      const maxC = Math.max(...cells.map((c) => c[1]))
      return gridItem(cells, maxR + 2, maxC + 2, rng.chance(0.5) ? 'area' : 'perimeter', 'shape')
    }

    const story = (): GeneratedItem => {
      const kind = rng.int(0, 2)
      if (kind === 0) {
        const s = rng.int(3, 12)
        return {
          type: 'numeric',
          prompt: `A square garden has sides of ${s} m. A fence goes all the way around it. How long is the fence?`,
          answer: 4 * s,
          unit: 'm',
          hints: ['The fence goes around the edge, so find the perimeter.', 'A square has 4 equal sides.', `Add ${s} four times, or work out 4 × ${s}.`],
          explanation: `4 × ${s} = ${4 * s} m of fence.`,
          tags: WORD,
        }
      }
      if (kind === 1) {
        const l = rng.int(8, 20)
        const w = rng.int(5, l - 2)
        return {
          type: 'numeric',
          prompt: `A photo is ${l} cm long and ${w} cm wide. ${pickName(rng)} puts ribbon around its edge. How much ribbon is needed?`,
          answer: 2 * (l + w),
          unit: 'cm',
          hints: ['Ribbon around the edge is the perimeter.', 'Add all four sides of the rectangle.', `${l} + ${w} = ${l + w}.`],
          explanation: `${l} + ${w} + ${l} + ${w} = ${2 * (l + w)} cm of ribbon.`,
          tags: WORD,
        }
      }
      const items = rng.sample([
        { text: 'a fence around a field', group: 0 },
        { text: 'ribbon around a card', group: 0 },
        { text: 'a border around a photo', group: 0 },
        { text: 'a path around a pond', group: 0 },
        { text: 'carpet for a floor', group: 1 },
        { text: 'paint for a wall', group: 1 },
        { text: 'grass to cover a garden', group: 1 },
        { text: 'paper to cover a book', group: 1 },
      ], 6)
      if (!items.some((i) => i.group === 0) || !items.some((i) => i.group === 1)) items[0] = { text: 'a fence around a field', group: 0 }
      return {
        type: 'sort',
        prompt: 'Sort the jobs. Do you need the perimeter or the area?',
        groups: ['Perimeter', 'Area'],
        items,
        hints: ['Perimeter is the edge. Area is the space inside.', 'Ask yourself: does it go around the outside, or cover the whole surface?', `${cap(items[0]!.text)}: does it go around or cover?`],
        explanation: `Perimeter: ${listAnd(items.filter((i) => i.group === 0).map((i) => i.text))}. Area: ${listAnd(items.filter((i) => i.group === 1).map((i) => i.text))}.`,
      }
    }

    const sameArea = (): GeneratedItem => {
      const norm = (cells: Cell[]): Cell[] => {
        const r0 = Math.min(...cells.map((c) => c[0]))
        const c0 = Math.min(...cells.map((c) => c[1]))
        return cells.map(([r, c]) => [r - r0, c - c0] as Cell).sort((p, q) => p[0] - q[0] || p[1] - q[1])
      }
      const grow = (n: number): Cell[] => {
        const set = new Map<string, Cell>([['0,0', [0, 0]]])
        for (let i = 0; set.size < n && i < 400; i++) {
          const base = rng.pick([...set.values()])
          const [dr, dc] = rng.pick([[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
          const cell: Cell = [base[0] + dr, base[1] + dc]
          if (Math.abs(cell[0]) > 3 || Math.abs(cell[1]) > 4) continue
          set.set(`${cell[0]},${cell[1]}`, cell)
        }
        return norm([...set.values()])
      }
      for (let tries = 0; tries < 30; tries++) {
        const area = rng.pick([6, 8, 9, 10, 12])
        const byPer = new Map<number, Cell[]>()
        for (let h = 1; h <= 5; h++) if (area % h === 0 && area / h <= 8) byPer.set(2 * (h + area / h), rectCells(0, 0, h, area / h))
        for (let i = 0; i < 40; i++) {
          const c = grow(area)
          if (c.length !== area) continue
          const p = cellPerimeter(c)
          if (!byPer.has(p)) byPer.set(p, c)
        }
        if (byPer.size < 4) continue
        const chosen = rng.sample([...byPer.keys()], 4)
        const longest = rng.chance(0.5)
        const target = longest ? Math.max(...chosen) : Math.min(...chosen)
        const fig = (c: Cell[]): Fig => ({
          kind: 'grid',
          rows: Math.max(...c.map((x) => x[0])) + 1,
          cols: Math.max(...c.map((x) => x[1])) + 1,
          shaded: c,
          alt: `A shape made of ${c.length} squares. Its perimeter is ${cellPerimeter(c)} units.`,
        })
        return {
          type: 'mcq',
          prompt: `Each shape has an area of ${area} squares. Which shape has the ${longest ? 'longest' : 'shortest'} perimeter?`,
          ...figChoice(rng, fig(byPer.get(target)!), chosen.filter((p) => p !== target).map((p) => ({ figure: fig(byPer.get(p)!), why: `This shape has a perimeter of ${p} units. The ${longest ? 'longest' : 'shortest'} is ${target} units.` }))),
          hints: ['Perimeter is the distance around the edge.', 'Count the outside edges of each shape.', longest ? 'Long, thin shapes usually have longer perimeters.' : 'Shapes that are close to a square usually have shorter perimeters.'],
          explanation: `All the shapes cover ${area} squares. The answer has ${target} edges around it, the ${longest ? 'most' : 'fewest'} of the four.`,
        }
      }
      return rect(true)
    }

    if (level === 1) return rect(false)
    if (level === 2) return oneOf(rng, [() => rect(true), labelled])
    if (level === 3) return oneOf(rng, [lshape, labelled])
    if (level === 4) return story()
    return sameArea()
  },
}

// ---------------------------------------------------------------------------
// Gg: bangun datar, bangun ruang, simetri, sudut
// ---------------------------------------------------------------------------

type Shape2DName = 'circle' | 'semicircle' | 'oval' | 'square' | 'rectangle' | 'triangle' | 'right-triangle' | 'pentagon' | 'hexagon' | 'octagon' | 'rhombus' | 'trapezium' | 'parallelogram' | 'kite' | 'star'

export const POLY3: readonly { shape: Shape2DName; name: string; sides: number; ra: number }[] = [
  { shape: 'triangle', name: 'triangle', sides: 3, ra: 0 },
  { shape: 'right-triangle', name: 'right-angled triangle', sides: 3, ra: 1 },
  { shape: 'square', name: 'square', sides: 4, ra: 4 },
  { shape: 'rectangle', name: 'rectangle', sides: 4, ra: 4 },
  { shape: 'pentagon', name: 'pentagon', sides: 5, ra: 0 },
  { shape: 'hexagon', name: 'hexagon', sides: 6, ra: 0 },
  { shape: 'octagon', name: 'octagon', sides: 8, ra: 0 },
  { shape: 'rhombus', name: 'quadrilateral', sides: 4, ra: 0 },
  { shape: 'trapezium', name: 'quadrilateral', sides: 4, ra: 0 },
  { shape: 'parallelogram', name: 'quadrilateral', sides: 4, ra: 0 },
]

const shapeFig = (shape: Shape2DName, alt: string): Fig => ({ kind: 'shape', shape, alt })

const shapes2d3: Generator = {
  skill: 'm3.shapes-2d',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const countSides = (what: 'sides' | 'vertices'): GeneratedItem => {
      const p = rng.pick(POLY3)
      return {
        type: 'numeric',
        prompt: `How many ${what} does this shape have?`,
        figure: shapeFig(p.shape, `A ${p.name} with ${p.sides} straight sides.`),
        answer: p.sides,
        hints: [what === 'sides' ? 'A side is a straight edge.' : 'A vertex is a corner, where two sides meet.', `Put your finger on one ${what === 'sides' ? 'side' : 'corner'} and count around the shape.`, `Stop when you get back to the ${what === 'sides' ? 'side' : 'corner'} you started on.`],
        explanation: `The shape has ${p.sides} sides and ${p.sides} vertices.${p.name !== 'quadrilateral' ? ` It is a ${p.name}.` : ' It is a quadrilateral.'}`,
      }
    }

    const nameIt = (): GeneratedItem => {
      const pool = POLY3.filter((p) => ['triangle', 'square', 'rectangle', 'pentagon', 'hexagon', 'octagon'].includes(p.shape))
      const p = rng.pick(pool)
      const names = ['triangle', 'square', 'rectangle', 'pentagon', 'hexagon', 'octagon', 'circle']
      const facts: Record<string, string> = { triangle: '3 sides', square: '4 equal sides', rectangle: '4 sides and 4 right angles', pentagon: '5 sides', hexagon: '6 sides', octagon: '8 sides', circle: 'one curved side' }
      return {
        type: 'mcq',
        prompt: 'What is the name of this shape?',
        figure: shapeFig(p.shape, `A shape with ${p.sides} straight sides.`),
        ...textChoice(rng, p.name, rng.shuffle(names.filter((n) => n !== p.name)).slice(0, 3).map((n) => ({ value: n, why: `A ${n} has ${facts[n]}.` }))),
        hints: ['Count the sides.', 'Tri means 3, penta means 5, hexa means 6 and octa means 8.', 'Put your finger on one side and count around the shape.'],
        explanation: `The shape has ${p.sides} sides, so it is a ${p.name}.`,
      }
    }

    const rightAngles = (): GeneratedItem => {
      const p = rng.pick(POLY3)
      return {
        type: 'numeric',
        prompt: 'How many right angles does this shape have?',
        figure: shapeFig(p.shape, `A ${p.name === 'quadrilateral' ? 'quadrilateral that leans' : p.name}. It has ${p.ra} right ${p.ra === 1 ? 'angle' : 'angles'}.`),
        answer: p.ra,
        hints: ['A right angle is a square corner, like the corner of a book.', 'Check each corner with the corner of a piece of paper.', 'Start at one corner and check each corner in turn.'],
        explanation: p.ra ? `${p.ra === 4 ? 'All 4 corners are' : 'One corner is'} a square corner, so the shape has ${p.ra} right ${p.ra === 1 ? 'angle' : 'angles'}.` : 'None of the corners is a square corner, so the shape has 0 right angles.',
      }
    }

    const whichHas = (): GeneratedItem => {
      const n = rng.pick([3, 5, 6, 8])
      const correct = POLY3.find((p) => p.sides === n && p.shape !== 'right-triangle')!
      const others = rng.shuffle(POLY3.filter((p) => p.sides !== n && p.sides !== 4)).slice(0, 2)
      const quad = rng.pick(POLY3.filter((p) => p.sides === 4))
      const wrong = [...others, quad].map((p) => ({ figure: shapeFig(p.shape, `A shape with ${p.sides} sides.`), why: `This shape has ${p.sides} sides.` }))
      return {
        type: 'mcq',
        prompt: `Which shape has ${n} sides?`,
        ...figChoice(rng, shapeFig(correct.shape, `A shape with ${n} sides.`), wrong),
        hints: ['Count the sides of each shape.', 'Count around each shape, one side at a time.', `Look for a ${correct.name}.`],
        explanation: `A ${correct.name} has ${n} sides.`,
      }
    }

    const sortQuads = (): GeneratedItem => {
      const curved = rng.chance(0.4)
      if (curved) {
        const pool = [
          { text: 'circle', group: 1 }, { text: 'semicircle', group: 1 }, { text: 'oval', group: 1 },
          { text: 'triangle', group: 0 }, { text: 'square', group: 0 }, { text: 'hexagon', group: 0 }, { text: 'rectangle', group: 0 }, { text: 'pentagon', group: 0 },
        ]
        const items = [...rng.sample(pool.filter((x) => x.group === 1), 2), ...rng.sample(pool.filter((x) => x.group === 0), 4)]
        return {
          type: 'sort',
          prompt: 'Sort the shapes by their sides.',
          groups: ['Only straight sides', 'Has a curved side'],
          items: rng.shuffle(items),
          hints: ['Picture each shape in your head.', 'A circle has a curved side. A square has only straight sides.', `Draw a ${items[0]!.text} in the air with your finger.`],
          explanation: `Curved: ${listAnd(items.filter((x) => x.group === 1).map((x) => x.text))}. Only straight: ${listAnd(items.filter((x) => x.group === 0).map((x) => x.text))}.`,
        }
      }
      const pool = [
        { text: 'square', group: 0 }, { text: 'rectangle', group: 0 }, { text: 'kite', group: 0 },
        { text: 'triangle', group: 1 }, { text: 'pentagon', group: 1 }, { text: 'hexagon', group: 1 }, { text: 'octagon', group: 1 }, { text: 'circle', group: 1 },
      ]
      const items = [...rng.sample(pool.filter((x) => x.group === 0), 2), ...rng.sample(pool.filter((x) => x.group === 1), 4)]
      return {
        type: 'sort',
        prompt: 'A quadrilateral has 4 straight sides. Sort the shapes.',
        groups: ['Quadrilateral', 'Not a quadrilateral'],
        items: rng.shuffle(items),
        hints: ['Count the sides of each shape in your head.', 'Quad means 4. A quadrilateral has exactly 4 straight sides.', `How many sides does a ${items[0]!.text} have?`],
        explanation: `Quadrilaterals: ${listAnd(items.filter((x) => x.group === 0).map((x) => x.text))}. The others do not have exactly 4 straight sides.`,
      }
    }

    const whoAmI = (): GeneratedItem => {
      const riddles = [
        { clue: 'I have 4 sides and 4 right angles. My sides are not all the same length.', a: 'rectangle', wrong: [['square', 'A square has 4 equal sides.'], ['hexagon', 'A hexagon has 6 sides.'], ['triangle', 'A triangle has 3 sides.']] },
        { clue: 'I have 4 equal sides and 4 right angles.', a: 'square', wrong: [['rectangle', 'A rectangle has 2 long sides and 2 short sides.'], ['pentagon', 'A pentagon has 5 sides.'], ['circle', 'A circle has no corners.']] },
        { clue: 'I have 3 sides and one of my angles is a right angle.', a: 'right-angled triangle', wrong: [['square', 'A square has 4 sides.'], ['pentagon', 'A pentagon has 5 sides.'], ['rectangle', 'A rectangle has 4 sides.']] },
        { clue: 'I have 6 straight sides and 6 vertices.', a: 'hexagon', wrong: [['pentagon', 'A pentagon has 5 sides.'], ['octagon', 'An octagon has 8 sides.'], ['triangle', 'A triangle has 3 sides.']] },
        { clue: 'I have one curved side and no vertices.', a: 'circle', wrong: [['semicircle', 'A semicircle has a straight side too.'], ['square', 'A square has 4 vertices.'], ['triangle', 'A triangle has 3 vertices.']] },
        { clue: 'I have 8 straight sides.', a: 'octagon', wrong: [['hexagon', 'A hexagon has 6 sides.'], ['pentagon', 'A pentagon has 5 sides.'], ['rectangle', 'A rectangle has 4 sides.']] },
      ]
      const r = rng.pick(riddles)
      return {
        type: 'mcq',
        prompt: `${r.clue} What shape am I?`,
        ...textChoice(rng, r.a, r.wrong.map(([v, w]) => ({ value: v!, why: w! }))),
        hints: ['Read one clue at a time.', 'Cross out the shapes that do not match the first clue.', 'Now check the second clue for the shapes that are left.'],
        explanation: `A ${r.a} matches every clue: ${r.clue.replace(/^I have /, '').replace(/\.$/, '').replace(/ I /g, ' it ').replace(/My /g, 'its ')}.`,
      }
    }

    const sidesStory = (): GeneratedItem => {
      const name = pickName(rng)
      const [p, q] = rng.sample(POLY3.filter((x) => ['triangle', 'pentagon', 'hexagon', 'octagon', 'square'].includes(x.shape)), 2) as [(typeof POLY3)[number], (typeof POLY3)[number]]
      const a = rng.int(2, 4)
      const b = rng.int(2, 4)
      const total = a * p.sides + b * q.sides
      return {
        type: 'numeric',
        prompt: `${name} draws ${a} ${p.name}s and ${b} ${q.name}s. How many sides is that altogether?`,
        answer: total,
        hints: [`How many sides does ${art(p.name)} have? And ${art(q.name)}?`, 'Multiply for each kind of shape, then add.', `${a} ${p.name}s have ${a} × ${p.sides} = ${a * p.sides} sides.`],
        explanation: `${a} × ${p.sides} = ${a * p.sides} and ${b} × ${q.sides} = ${b * q.sides}. ${a * p.sides} + ${b * q.sides} = ${total} sides.`,
        tags: WORD,
      }
    }

    const straws = (): GeneratedItem => {
      const name = pickName(rng)
      const sq = rng.int(2, 4)
      const tri = rng.pick([2, 3, 5, 6])
      const total = sq * 4 + tri * 3
      return {
        type: 'numeric',
        prompt: `${name} has ${total} straws. Each straw makes one side of a shape. ${name} makes ${sq} squares and uses the other straws for triangles. How many triangles does ${name} make?`,
        answer: tri,
        hints: ['First find how many straws the squares use.', `A square uses 4 straws. Take those away from ${total}.`, `${sq} squares use ${sq * 4} straws.`],
        explanation: `${sq} × 4 = ${sq * 4} straws for squares. ${total} - ${sq * 4} = ${tri * 3} straws are left. ${tri * 3} ÷ 3 = ${tri} triangles.`,
        tags: WORD,
      }
    }

    if (level === 1) return oneOf(rng, [() => countSides('sides'), nameIt])
    if (level === 2) return oneOf(rng, [() => countSides('vertices'), rightAngles, whichHas])
    if (level === 3) return oneOf(rng, [sortQuads, whoAmI])
    if (level === 4) return sidesStory()
    return straws()
  },
}

type SolidName = 'cube' | 'cuboid' | 'sphere' | 'cylinder' | 'cone' | 'square-pyramid' | 'triangular-prism'

export const SOLID3: readonly { solid: SolidName; name: string; faces: number; edges: number; vertices: number; faceShapes: string; rolls: boolean }[] = [
  { solid: 'cube', name: 'cube', faces: 6, edges: 12, vertices: 8, faceShapes: '6 squares', rolls: false },
  { solid: 'cuboid', name: 'cuboid', faces: 6, edges: 12, vertices: 8, faceShapes: '6 rectangles', rolls: false },
  { solid: 'square-pyramid', name: 'square-based pyramid', faces: 5, edges: 8, vertices: 5, faceShapes: '1 square and 4 triangles', rolls: false },
  { solid: 'triangular-prism', name: 'triangular prism', faces: 5, edges: 9, vertices: 6, faceShapes: '2 triangles and 3 rectangles', rolls: false },
  { solid: 'cylinder', name: 'cylinder', faces: 3, edges: 2, vertices: 0, faceShapes: '2 circles and 1 curved surface', rolls: true },
  { solid: 'cone', name: 'cone', faces: 2, edges: 1, vertices: 1, faceShapes: '1 circle and 1 curved surface', rolls: true },
  { solid: 'sphere', name: 'sphere', faces: 1, edges: 0, vertices: 0, faceShapes: '1 curved surface', rolls: true },
]

const OBJECTS3D: readonly { what: string; solid: SolidName }[] = [
  { what: 'a dice', solid: 'cube' },
  { what: 'a cereal box', solid: 'cuboid' },
  { what: 'a tin of soup', solid: 'cylinder' },
  { what: 'a football', solid: 'sphere' },
  { what: 'an ice cream cone', solid: 'cone' },
  { what: 'a tent', solid: 'triangular-prism' },
  { what: 'a brick', solid: 'cuboid' },
  { what: 'an orange', solid: 'sphere' },
  { what: 'a glass jar', solid: 'cylinder' },
]

const solidName = (s: SolidName) => SOLID3.find((x) => x.solid === s)!.name

const shapes3d3: Generator = {
  skill: 'm3.shapes-3d',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const nameIt = (): GeneratedItem => {
      const sd = rng.pick(SOLID3)
      return {
        type: 'mcq',
        prompt: 'What is the name of this 3D shape?',
        figure: { kind: 'solid', solid: sd.solid, alt: `A 3D shape with ${sd.faceShapes}.` },
        ...textChoice(rng, sd.name, rng.shuffle(SOLID3.filter((x) => x !== sd)).slice(0, 3).map((x) => ({ value: x.name, why: `A ${x.name} has ${x.faceShapes}.` }))),
        hints: ['Look at the shape of the faces.', 'Is any face curved? Are there any triangles?', 'Count the flat faces you can see.'],
        explanation: `This shape has ${sd.faceShapes}, so it is a ${sd.name}.`,
      }
    }

    const object = (): GeneratedItem => {
      const o = rng.pick(OBJECTS3D)
      const ans = solidName(o.solid)
      return {
        type: 'mcq',
        prompt: `Which 3D shape is ${o.what} most like?`,
        ...textChoice(rng, ans, rng.shuffle(SOLID3.filter((x) => x.solid !== o.solid && !(o.solid === 'cuboid' && x.solid === 'cube') && !(o.solid === 'cube' && x.solid === 'cuboid'))).slice(0, 3).map((x) => ({ value: x.name, why: `A ${x.name} has ${x.faceShapes}. Picture ${o.what} and compare.` }))),
        hints: [`Picture ${o.what} in your head.`, 'Does it have flat faces, curved surfaces or both?', 'Think about the shape of its faces.'],
        explanation: `${cap(o.what)} is shaped like a ${ans}.`,
      }
    }

    const count = (): GeneratedItem => {
      const sd = rng.pick(SOLID3.filter((x) => !x.rolls))
      const what = rng.pick(['faces', 'edges', 'vertices'] as const)
      const ans = sd[what]
      const tip: Record<string, string> = { faces: 'A face is a flat surface.', edges: 'An edge is where two faces meet.', vertices: 'A vertex is a corner, where edges meet.' }
      return {
        type: 'numeric',
        prompt: `How many ${what} does a ${sd.name} have?`,
        figure: { kind: 'solid', solid: sd.solid, alt: `A picture of a ${sd.name}.` },
        answer: ans,
        hints: [tip[what]!, 'Count the ones you can see, then think about the ones at the back.', what === 'faces' ? `A ${sd.name} has ${sd.faceShapes.replace(/^\d+ /, 'some ')} as faces.` : what === 'edges' ? 'Count the edges around the bottom first.' : 'Count the vertices on the bottom first, then the top.'],
        explanation: `A ${sd.name} has ${sd.faces} faces, ${sd.edges} edges and ${sd.vertices} vertices.`,
      }
    }

    const curved = (): GeneratedItem => {
      const q = rng.pick([
        { s: 'cylinder' as const, ask: 'flat faces', a: 2, why: 'A cylinder has a circle at each end.' },
        { s: 'cone' as const, ask: 'flat faces', a: 1, why: 'A cone has one circle at the bottom.' },
        { s: 'cone' as const, ask: 'vertices', a: 1, why: 'A cone has one point at the top.' },
        { s: 'sphere' as const, ask: 'flat faces', a: 0, why: 'A sphere is curved all over.' },
        { s: 'cylinder' as const, ask: 'vertices', a: 0, why: 'A cylinder has no corners.' },
      ])
      return {
        type: 'numeric',
        prompt: `How many ${q.ask} does a ${q.s} have?`,
        figure: { kind: 'solid', solid: q.s, alt: `A picture of a ${q.s}.` },
        answer: q.a,
        hints: [q.ask === 'flat faces' ? 'A flat face could sit flat on a table.' : 'A vertex is a pointed corner.', `Picture ${q.s === 'cylinder' ? 'a tin of soup' : q.s === 'cone' ? 'an ice cream cone' : 'a ball'}.`, q.ask === 'flat faces' ? 'Look at the top and the bottom of the shape.' : 'Run your finger over the shape. Is there anywhere sharp?'],
        explanation: `${q.why} So it has ${q.a} ${q.ask}.`,
      }
    }

    const faceShapes = (): GeneratedItem => {
      const sd = rng.pick(SOLID3.filter((x) => x.solid !== 'sphere'))
      return {
        type: 'mcq',
        prompt: `What are the faces of a ${sd.name}?`,
        figure: { kind: 'solid', solid: sd.solid, alt: `A picture of a ${sd.name}.` },
        ...textChoice(rng, sd.faceShapes, rng.shuffle(SOLID3.filter((x) => x.faceShapes !== sd.faceShapes)).slice(0, 3).map((x) => ({ value: x.faceShapes, why: `These are the faces of a ${x.name}.` }))),
        hints: ['Imagine taking the shape apart, face by face.', 'Look at the bottom face first, then the faces around the sides.', `What shape is the bottom of a ${sd.name}?`],
        explanation: `A ${sd.name} has ${sd.faceShapes}.`,
      }
    }

    const rolls = (): GeneratedItem => {
      const items = [...rng.sample(SOLID3.filter((x) => x.rolls), 2), ...rng.sample(SOLID3.filter((x) => !x.rolls), 3)]
      return {
        type: 'sort',
        prompt: 'Which shapes can roll? Sort them.',
        groups: ['Can roll', 'Cannot roll'],
        items: rng.shuffle(items).map((x) => ({ text: x.name, group: x.rolls ? 0 : 1 })),
        hints: ['A shape can roll if it has a curved surface.', 'Shapes with only flat faces slide, but they do not roll.', `Does a ${items[0]!.name} have a curved surface?`],
        explanation: `${cap(listAnd(items.filter((x) => x.rolls).map((x) => x.name)))} can roll because they have a curved surface.`,
      }
    }

    const story = (): GeneratedItem => {
      const name = pickName(rng)
      const kind = rng.int(0, 2)
      if (kind === 0) {
        const n = rng.int(2, 5)
        return {
          type: 'numeric',
          prompt: `${name} has ${n} dice. Each dice is a cube. How many faces do the dice have altogether?`,
          answer: n * 6,
          hints: ['How many faces does one cube have?', `Multiply the faces of one cube by ${n}.`, 'A cube has 6 faces.'],
          explanation: `${n} × 6 = ${n * 6} faces.`,
          tags: WORD,
        }
      }
      if (kind === 1) {
        const sd = rng.pick(SOLID3.filter((x) => !x.rolls))
        const n = rng.int(2, 4)
        const what = rng.pick(['edges', 'vertices'] as const)
        return {
          type: 'numeric',
          prompt: `${name} makes ${n} ${sd.name}s from straws and clay. How many ${what} do they have altogether?`,
          answer: n * sd[what],
          hints: [`Count the ${what} on one ${sd.name}.`, `Multiply by ${n}.`, `One ${sd.name} has ${sd[what]} ${what}.`],
          explanation: `${n} × ${sd[what]} = ${n * sd[what]} ${what}.`,
          tags: WORD,
        }
      }
      const sd = rng.pick(SOLID3.filter((x) => !x.rolls && x.solid !== 'cube'))
      return {
        type: 'mcq',
        prompt: `I have ${sd.faces} faces, ${sd.edges} edges and ${sd.vertices} vertices. Which 3D shape am I?`,
        ...textChoice(rng, sd.name, SOLID3.filter((x) => x !== sd && !(sd.solid === 'cuboid' && x.solid === 'cube')).slice(0, 4).map((x) => ({ value: x.name, why: `A ${x.name} has ${x.faces} ${x.faces === 1 ? 'face' : 'faces'}, ${x.edges} ${x.edges === 1 ? 'edge' : 'edges'} and ${x.vertices} ${x.vertices === 1 ? 'vertex' : 'vertices'}.` }))),
        hints: ['Check one number at a time.', 'Start with the vertices. They are the easiest to picture.', `Which shapes have exactly ${sd.vertices} vertices?`],
        explanation: `A ${sd.name} has ${sd.faces} faces, ${sd.edges} edges and ${sd.vertices} vertices.`,
      }
    }

    const frame = (): GeneratedItem => {
      const sd = rng.pick(SOLID3.filter((x) => !x.rolls))
      const name = pickName(rng)
      return {
        type: 'numeric',
        prompt: `${name} builds the frame of a ${sd.name}. Each edge is a straw and each vertex is a ball of clay. How many straws and balls of clay are used altogether?`,
        answer: sd.edges + sd.vertices,
        hints: ['Straws are the edges. Balls of clay are the vertices.', 'Count the edges and the vertices, then add them.', `A ${sd.name} has ${sd.edges} edges.`],
        explanation: `${sd.edges} straws for the edges and ${sd.vertices} balls for the vertices. ${sd.edges} + ${sd.vertices} = ${sd.edges + sd.vertices}.`,
        tags: WORD,
      }
    }

    if (level === 1) return oneOf(rng, [nameIt, object])
    if (level === 2) return oneOf(rng, [count, count, curved])
    if (level === 3) return oneOf(rng, [faceShapes, rolls])
    if (level === 4) return story()
    return frame()
  },
}

/** Huruf kapital dengan garis simetri yang aman di font sans dan Andika. */
export const LETTERS_V = ['A', 'H', 'I', 'M', 'O', 'T', 'U', 'V', 'W', 'X', 'Y'] as const
export const LETTERS_H = ['B', 'C', 'D', 'E', 'H', 'O', 'X'] as const
export const LETTERS_NONE = ['F', 'G', 'J', 'L', 'N', 'P', 'R', 'S', 'Z'] as const

type SymInfo = { shape: Shape2DName; name: string; v: boolean; h: boolean }
export const SYM_SHAPES: readonly SymInfo[] = [
  { shape: 'square', name: 'square', v: true, h: true },
  { shape: 'rectangle', name: 'rectangle', v: true, h: true },
  { shape: 'triangle', name: 'triangle', v: true, h: false },
  { shape: 'right-triangle', name: 'right-angled triangle', v: false, h: false },
  { shape: 'pentagon', name: 'pentagon', v: true, h: false },
  { shape: 'hexagon', name: 'hexagon', v: true, h: true },
  { shape: 'octagon', name: 'octagon', v: true, h: true },
  { shape: 'rhombus', name: 'rhombus', v: true, h: true },
  { shape: 'trapezium', name: 'trapezium', v: true, h: false },
  { shape: 'parallelogram', name: 'parallelogram', v: false, h: false },
  { shape: 'kite', name: 'kite', v: true, h: false },
  { shape: 'semicircle', name: 'semicircle', v: true, h: false },
  { shape: 'oval', name: 'oval', v: true, h: true },
  { shape: 'star', name: 'star', v: true, h: false },
]

const symWords = [
  'MATH', 'BOOK', 'TOY', 'KITE', 'MOON', 'SUN', 'HOUSE', 'FISH', 'MANGO', 'BATIK', 'JAVA', 'BALI', 'TOMATO', 'WAX', 'YOYO',
]

const symmetry3: Generator = {
  skill: 'm3.symmetry',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const lineFig = (s: SymInfo, line: 'vertical' | 'horizontal'): Fig => ({ kind: 'shape', shape: s.shape, lineOfSymmetry: line, alt: `A ${s.name} with a dashed ${line} line.` })

    const whichLine = (): GeneratedItem => {
      const goods = SYM_SHAPES.flatMap((s) => [...(s.v ? [{ s, line: 'vertical' as const }] : []), ...(s.h ? [{ s, line: 'horizontal' as const }] : [])])
      const bads = SYM_SHAPES.flatMap((s) => [...(!s.v ? [{ s, line: 'vertical' as const }] : []), ...(!s.h ? [{ s, line: 'horizontal' as const }] : [])])
      const good = rng.pick(goods)
      const wrong = rng.sample(bads.filter((b) => b.s !== good.s), 3)
      return {
        type: 'mcq',
        prompt: 'Which dashed line is a line of symmetry?',
        ...figChoice(rng, lineFig(good.s, good.line), wrong.map((b) => ({ figure: lineFig(b.s, b.line), why: `If you fold the ${b.s.name} on this line, the two halves do not match.` }))),
        hints: ['A line of symmetry splits a shape into two matching halves.', 'Imagine folding each shape along the dashed line.', 'Check if one half would fit exactly on top of the other.'],
        explanation: `Folding the ${good.s.name} along the ${good.line} line makes the two halves match exactly.`,
      }
    }

    const letter = (): GeneratedItem => {
      const vertical = rng.chance(0.6)
      const pool = vertical ? LETTERS_V : LETTERS_H
      const ans = rng.pick(pool)
      return {
        type: 'mcq',
        prompt: `Which letter has a ${vertical ? 'vertical' : 'horizontal'} line of symmetry?`,
        ...textChoice(rng, ans, rng.sample(LETTERS_NONE, 3).map((x) => ({ value: x, why: `If you fold ${x} ${vertical ? 'down the middle' : 'across the middle'}, the two halves do not match.` }))),
        hints: [`A ${vertical ? 'vertical' : 'horizontal'} line goes ${vertical ? 'straight up and down' : 'straight across'}.`, `Imagine a mirror ${vertical ? 'down the middle of' : 'across the middle of'} each letter.`, `Does the ${vertical ? 'left half match the right half' : 'top half match the bottom half'}?`],
        explanation: `${ans} has a ${vertical ? 'vertical' : 'horizontal'} line of symmetry: its two halves match when folded ${vertical ? 'down the middle' : 'across the middle'}.`,
      }
    }

    const sortLetters = (): GeneratedItem => {
      const yes = rng.sample(LETTERS_V, 3)
      const no = rng.sample(LETTERS_NONE.filter((x) => !LETTERS_V.includes(x as never)), 3)
      const items = rng.shuffle([...yes.map((t) => ({ text: t, group: 0 })), ...no.map((t) => ({ text: t, group: 1 }))])
      return {
        type: 'sort',
        prompt: 'Sort the letters. Which have a vertical line of symmetry?',
        groups: ['Vertical line', 'No vertical line'],
        items,
        hints: ['A vertical line goes straight up and down through the middle.', 'Imagine folding each letter down the middle.', `Try ${items[0]!.text} first. Do the two halves match?`],
        explanation: `${listAnd(yes)} have a vertical line of symmetry. ${listAnd(no)} do not.`,
      }
    }

    const both = (): GeneratedItem => {
      const good = rng.pick(SYM_SHAPES.filter((s) => s.v && s.h))
      const bad = rng.sample(SYM_SHAPES.filter((s) => !(s.v && s.h)), 3)
      const f = (s: SymInfo): Fig => ({ kind: 'shape', shape: s.shape, alt: `A picture of a ${s.name}.` })
      return {
        type: 'mcq',
        prompt: 'Which shape has a vertical and a horizontal line of symmetry?',
        ...figChoice(rng, f(good), bad.map((s) => ({ figure: f(s), why: s.v ? `A ${s.name} only has a vertical line of symmetry.` : `A ${s.name} has no vertical or horizontal line of symmetry.` }))),
        hints: ['Check two folds for each shape: up and down, then across.', 'Both halves must match for each fold.', 'Shapes that look the same upside down often have both lines.'],
        explanation: `A ${good.name} can be folded down the middle and across the middle, and the halves match both times.`,
      }
    }

    const word = (): GeneratedItem => {
      const w = rng.pick(symWords)
      const n = w.split('').filter((c) => LETTERS_V.includes(c as never)).length
      const name = pickName(rng)
      return {
        type: 'numeric',
        prompt: `${name} writes the word ${w} in capital letters. How many of its letters have a vertical line of symmetry?`,
        answer: n,
        hints: ['Check each letter on its own.', 'Imagine a mirror standing up in the middle of each letter.', `Start with ${w[0]}: does its left half match its right half?`],
        explanation: `The letters with a vertical line of symmetry are ${listAnd(w.split('').filter((c) => LETTERS_V.includes(c as never)))}. That is ${n}.`,
        tags: WORD,
      }
    }

    const complete = (): GeneratedItem => {
      for (let tries = 0; tries < 30; tries++) {
        const rows = 4
        const cols = 6
        const left: Cell[] = []
        for (let r = 0; r < rows; r++) for (let c = 0; c < 3; c++) if (rng.chance(0.45)) left.push([r, c])
        if (left.length < 3) continue
        const mirror = left.map(([r, c]) => [r, cols - 1 - c] as Cell)
        const missing = rng.int(1, Math.min(4, mirror.length - 1))
        const shownRight = rng.sample(mirror, mirror.length - missing)
        return {
          type: 'numeric',
          prompt: 'The pattern should be symmetrical about a vertical line down the middle. How many more squares must be shaded?',
          figure: { kind: 'grid', rows, cols, shaded: [...left, ...shownRight], alt: `A 4 by 6 grid. The left half has ${left.length} shaded squares. The right half has ${shownRight.length} shaded squares.` },
          answer: missing,
          hints: ['The mirror line is between the 3rd and 4th columns.', 'Every shaded square on the left needs a matching square on the right, the same distance from the line.', 'Check the left half one row at a time.'],
          explanation: `The left half has ${left.length} shaded squares, but the right half only has ${shownRight.length}. ${left.length} - ${shownRight.length} = ${missing}, so ${plural(missing, 'more square is', 'more squares are')} needed.`,
        }
      }
      return word()
    }

    if (level === 1) return whichLine()
    if (level === 2) return letter()
    if (level === 3) return oneOf(rng, [sortLetters, both])
    if (level === 4) return word()
    return complete()
  },
}

export const COMPASS = ['north', 'east', 'south', 'west'] as const
export const TURNS = [
  { name: 'quarter turn', k: 1 },
  { name: 'half turn', k: 2 },
  { name: 'three-quarter turn', k: 3 },
  { name: 'whole turn', k: 4 },
] as const

const anglesTurns3: Generator = {
  skill: 'm3.angles-turns',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const rightAnglesIn = (): GeneratedItem => {
      const t = rng.pick(TURNS)
      if (rng.chance(0.5)) {
        return {
          type: 'numeric',
          prompt: `How many right angles are there in a ${t.name}?`,
          answer: t.k,
          hints: t.k === 4
            ? ['Picture turning all the way round on the spot.', 'Count each square corner turn as you go round.', 'Face the door, then turn until you face it again.']
            : ['Picture turning on the spot, one square corner at a time.', 'A whole turn is 4 right angles.', `A ${t.name} is part of a whole turn.`],
          explanation: `A whole turn is 4 right angles. A ${t.name} is ${t.k === 4 ? 'all of it' : t.k === 1 ? 'one quarter of it' : t.k === 2 ? 'half of it' : 'three quarters of it'}, so it is ${t.k} right ${t.k === 1 ? 'angle' : 'angles'}.`,
        }
      }
      return {
        type: 'mcq',
        prompt: `Which turn is the same as ${t.k} right ${t.k === 1 ? 'angle' : 'angles'}?`,
        ...textChoice(rng, t.name, TURNS.filter((x) => x !== t).map((x) => ({ value: x.name, why: `A ${x.name} is ${x.k} right ${x.k === 1 ? 'angle' : 'angles'}.` }))),
        hints: ['Picture turning on the spot, one square corner at a time.', 'Each right angle is one quarter of the way round.', `Turn your arm through ${t.k} right ${t.k === 1 ? 'angle' : 'angles'}.`],
        explanation: `${t.k} right ${t.k === 1 ? 'angle is' : 'angles are'} a ${t.name}.`,
      }
    }

    const compare = (): GeneratedItem => {
      const deg = rng.pick([30, 40, 45, 60, 90, 90, 110, 120, 135, 150])
      const ans = deg < 90 ? 'smaller than a right angle' : deg === 90 ? 'a right angle' : 'bigger than a right angle'
      const all = [
        { value: 'smaller than a right angle', why: 'This angle opens wider than that.' },
        { value: 'a right angle', why: 'A right angle is a square corner. Check this angle with the corner of some paper.' },
        { value: 'bigger than a right angle', why: 'This angle is not that wide.' },
        { value: 'a straight line', why: 'A straight line is 2 right angles. This angle is much smaller.' },
      ].filter((x) => x.value !== ans)
      return {
        type: 'mcq',
        prompt: 'Compare this angle with a right angle. What is it?',
        figure: { kind: 'angle', degrees: deg, alt: `An angle of ${deg} degrees.` },
        ...textChoice(rng, ans, all),
        hints: ['A right angle is a square corner.', 'Put the corner of a piece of paper on the angle.', 'Line up one arm with the edge of the paper. Is the other arm inside or outside the paper?'],
        explanation: deg < 90 ? 'The angle fits inside a square corner, so it is smaller than a right angle.' : deg === 90 ? 'The angle matches a square corner exactly, so it is a right angle.' : 'The angle opens wider than a square corner, so it is bigger than a right angle.',
      }
    }

    const face = (multi: boolean): GeneratedItem => {
      const name = pickName(rng)
      const start = rng.int(0, 3)
      const t1 = rng.pick(TURNS.slice(0, 3))
      const cw1 = rng.chance(0.5)
      const turn = (from: number, k: number, cw: boolean) => (from + (cw ? k : 4 - k)) % 4
      const mid = turn(start, t1.k, cw1)
      let end = mid
      let other = turn(start, t1.k, !cw1)
      let text = `${name} faces ${COMPASS[start]} and makes a ${t1.name} ${cw1 ? 'clockwise' : 'anticlockwise'}.`
      let hint3 = `Point ${COMPASS[start]} with your arm, then turn it ${cw1 ? 'clockwise' : 'anticlockwise'}.`
      let explanation = `A ${t1.name} ${cw1 ? 'clockwise' : 'anticlockwise'} from ${COMPASS[start]} is ${COMPASS[end]}.`
      if (multi) {
        const t2 = rng.pick(TURNS.slice(0, 2))
        const cw2 = rng.chance(0.5)
        end = turn(mid, t2.k, cw2)
        other = turn(mid, t2.k, !cw2)
        text = `${name} faces ${COMPASS[start]}. ${name} makes a ${t1.name} ${cw1 ? 'clockwise' : 'anticlockwise'}, then a ${t2.name} ${cw2 ? 'clockwise' : 'anticlockwise'}.`
        hint3 = `Do the first turn: point ${COMPASS[start]}, then turn ${cw1 ? 'clockwise' : 'anticlockwise'}.`
        explanation = `After the first turn ${name} faces ${COMPASS[mid]}. A ${t2.name} ${cw2 ? 'clockwise' : 'anticlockwise'} from ${COMPASS[mid]} is ${COMPASS[end]}.`
      }
      const why = (c: number) =>
        c === start && c !== end
          ? `${cap(COMPASS[c]!)} is where ${name} started.`
          : c === other
            ? `${cap(COMPASS[c]!)} is where ${name} would face after turning the other way.`
            : `Count the quarter turns again, one at a time.`
      return {
        type: 'mcq',
        prompt: `${text} Which way does ${name} face now?`,
        ...textChoice(rng, COMPASS[end]!, COMPASS.map((_, i) => i).filter((i) => i !== end).map((i) => ({ value: COMPASS[i]!, why: why(i) }))),
        hints: ['Clockwise means the same way as the hands of a clock.', 'Picture a compass with north at the top. Clockwise goes round to the right.', hint3],
        explanation,
        ...(multi ? { tags: WORD } : {}),
      }
    }

    const clockTurn = (): GeneratedItem => {
      const from = rng.pick([12, 3, 6, 9])
      const t = rng.pick(TURNS.slice(0, 3))
      const to = ((from + 3 * t.k - 1) % 12) + 1
      return {
        type: 'mcq',
        prompt: `The minute hand moves clockwise from ${from} to ${to}. What turn has it made?`,
        figure: { kind: 'clock', h: 12, m: (from % 12) * 5, alt: `A clock with the minute hand pointing at ${from}.` },
        ...textChoice(rng, t.name, TURNS.filter((x) => x !== t).map((x) => ({ value: x.name, why: `A ${x.name} moves the hand ${3 * x.k} numbers.` }))),
        hints: ['Each right angle moves the minute hand 3 numbers.', `Count the numbers from ${from} to ${to}, going clockwise.`, `Count in 3s from ${from}, going clockwise.`],
        explanation: `From ${from} to ${to} is ${3 * t.k} numbers, which is ${t.k} quarter ${t.k === 1 ? 'turn' : 'turns'}: a ${t.name}.`,
      }
    }

    const minuteHand = (): GeneratedItem => {
      const h = rng.int(1, 11)
      const k = rng.int(1, 4)
      return {
        type: 'numeric',
        prompt: `The time changes from ${h}:00 to ${k === 4 ? `${hour12(h + 1)}:00` : digital(h, 15 * k)}. How many right angles does the minute hand turn through?`,
        answer: k,
        hints: ['The minute hand makes a whole turn every hour.', 'Each quarter of an hour, 15 minutes, is one right angle.', `${h}:00 to ${digital(h, 15)} is one quarter of an hour.`],
        explanation: `${15 * k} minutes is ${k} quarter${k === 1 ? '' : 's'} of an hour, so the minute hand turns through ${k} right ${k === 1 ? 'angle' : 'angles'}.`,
        tags: WORD,
      }
    }

    if (level === 1) return rightAnglesIn()
    if (level === 2) return compare()
    if (level === 3) return oneOf(rng, [() => face(false), clockTurn])
    if (level === 4) return oneOf(rng, [() => face(false), minuteHand])
    return face(true)
  },
}

// ---------------------------------------------------------------------------
// Gp: posisi dan arah
// ---------------------------------------------------------------------------

const PLACES3 = [
  { label: 'S', name: 'school' },
  { label: 'P', name: 'park' },
  { label: 'L', name: 'library' },
  { label: 'M', name: 'market' },
  { label: 'H', name: 'house' },
  { label: 'B', name: 'bakery' },
  { label: 'Z', name: 'zoo' },
] as const

type MapPoint = { x: number; y: number; label: string; name: string }

function mapFig(points: readonly MapPoint[]): Fig {
  return {
    kind: 'coordinates',
    size: 7,
    points: points.map((p) => ({ x: p.x, y: p.y, label: p.label })),
    alt: `A map on a square grid. ${points.map((p) => `${p.label} is the ${p.name}, ${p.x} squares from the left and ${p.y} squares up`).join('. ')}.`,
  }
}

const KEY = (pts: readonly MapPoint[]) => pts.map((p) => `${p.label} is the ${p.name}`).join(', ')

const positionDirection3: Generator = {
  skill: 'm3.position-direction',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const name = pickName(rng)

    const opposite = (): GeneratedItem => {
      const i = rng.int(0, 3)
      if (rng.chance(0.5)) {
        return {
          type: 'mcq',
          prompt: `Which direction is opposite to ${COMPASS[i]}?`,
          ...textChoice(rng, COMPASS[(i + 2) % 4]!, [1, 3, 0].map((k) => ({ value: COMPASS[(i + k) % 4]!, why: k === 0 ? 'A direction is not opposite to itself.' : `${cap(COMPASS[(i + k) % 4]!)} is a quarter turn from ${COMPASS[i]}.` }))),
          hints: ['Opposite means a half turn away.', 'Opposite directions point away from each other in a straight line.', `Point ${COMPASS[i]}, then turn halfway round.`],
          explanation: `${cap(COMPASS[(i + 2) % 4]!)} is opposite to ${COMPASS[i]}.`,
        }
      }
      const [a, b] = rng.sample(PLACES3, 2) as [(typeof PLACES3)[number], (typeof PLACES3)[number]]
      return {
        type: 'mcq',
        prompt: `The ${a.name} is ${COMPASS[i]} of the ${b.name}. Which way is the ${b.name} from the ${a.name}?`,
        ...textChoice(rng, COMPASS[(i + 2) % 4]!, [0, 1, 3].map((k) => ({ value: COMPASS[(i + k) % 4]!, why: k === 0 ? `That is the way from the ${b.name} to the ${a.name}.` : `${cap(COMPASS[(i + k) % 4]!)} is a quarter turn away. Going back the other way is a half turn.` }))),
        hints: ['Going back the other way means the opposite direction.', 'Opposite directions point away from each other in a straight line.', `Point ${COMPASS[i]}, then turn halfway round.`],
        explanation: `If the ${a.name} is ${COMPASS[i]} of the ${b.name}, then the ${b.name} is ${COMPASS[(i + 2) % 4]} of the ${a.name}.`,
      }
    }

    const layout = (n: number): MapPoint[] => {
      const used = new Set<string>()
      const pts: MapPoint[] = []
      for (const pl of rng.sample(PLACES3, n)) {
        let x = 0
        let y = 0
        do {
          x = rng.int(0, 7)
          y = rng.int(0, 7)
        } while (used.has(`${x},${y}`))
        used.add(`${x},${y}`)
        pts.push({ x, y, label: pl.label, name: pl.name })
      }
      return pts
    }

    const howFar = (): GeneratedItem => {
      for (let t = 0; t < 30; t++) {
        const pts = layout(4)
        const [a, b] = pts as [MapPoint, MapPoint]
        const dx = b.x - a.x
        const dy = b.y - a.y
        if (dx === 0 || dy === 0) continue
        const askX = rng.chance(0.5)
        const dir = askX ? (dx > 0 ? 'east' : 'west') : dy > 0 ? 'north' : 'south'
        const ans = Math.abs(askX ? dx : dy)
        return {
          type: 'numeric',
          prompt: `North is up the map. ${name} walks from the ${a.name} (${a.label}) to the ${b.name} (${b.label}). How many squares ${dir} does ${name} walk?`,
          figure: mapFig(pts),
          answer: ans,
          hints: [`Find ${a.label} and ${b.label} on the map.`, askX ? 'East is to the right and west is to the left. Count the squares across.' : 'North is up and south is down. Count the squares up or down.', `Start at ${a.label} and count one square at a time.`],
          explanation: `From ${a.label} to ${b.label} is ${Math.abs(dx)} ${Math.abs(dx) === 1 ? 'square' : 'squares'} ${dx > 0 ? 'east' : 'west'} and ${Math.abs(dy)} ${Math.abs(dy) === 1 ? 'square' : 'squares'} ${dy > 0 ? 'north' : 'south'}.`,
          solution: [
            { say: `Find ${a.label} and ${b.label} on the map.`, figure: mapFig(pts) },
            { say: askX ? 'Count the squares across, from left to right or right to left.' : 'Count the squares up or down.', show: `${ans} ${ans === 1 ? 'square' : 'squares'} ${dir}` },
          ],
        }
      }
      return opposite()
    }

    const moves = (route: boolean, three: boolean): GeneratedItem => {
      const sq = (n: number) => `${Math.abs(n)} ${Math.abs(n) === 1 ? 'square' : 'squares'}`
      for (let t = 0; t < 80; t++) {
        const start = { x: rng.int(0, 5), y: rng.int(0, 5) }
        const dx = rng.int(1, 3) * (rng.chance(0.7) ? 1 : -1)
        const dy = (three ? rng.int(2, 3) : rng.int(1, 3)) * (rng.chance(0.7) ? 1 : -1)
        const back = three ? rng.int(1, Math.abs(dy) - 1) : 0
        const vy = dy - Math.sign(dy) * back
        const end = { x: start.x + dx, y: start.y + vy }
        const swap = { x: start.x + vy, y: start.y + dx }
        const flipX = { x: start.x - dx, y: start.y + vy }
        const flipY = { x: start.x + dx, y: start.y - vy }
        const spots = [start, end, swap, flipX, flipY]
        if (spots.some((p) => p.x < 0 || p.x > 7 || p.y < 0 || p.y > 7)) continue
        if (new Set(spots.map((p) => `${p.x},${p.y}`)).size !== 5) continue
        const pls = rng.sample(PLACES3, 5)
        const pts: MapPoint[] = spots.map((p, i) => ({ ...p, label: pls[i]!.label, name: pls[i]!.name }))
        const [S, E, W1, W2, W3] = pts as [MapPoint, MapPoint, MapPoint, MapPoint, MapPoint]
        const ew = `${sq(dx)} ${dx > 0 ? 'east' : 'west'}`
        const ns = `${sq(dy)} ${dy > 0 ? 'north' : 'south'}`
        if (route) {
          const ewR = `${sq(dx)} ${dx > 0 ? 'west' : 'east'}`
          const nsR = `${sq(dy)} ${dy > 0 ? 'south' : 'north'}`
          return {
            type: 'mcq',
            prompt: `North is up the map. Which route goes from the ${S.name} (${S.label}) to the ${E.name} (${E.label})?`,
            figure: mapFig([S, E, W1]),
            ...textChoice(rng, `${ew}, then ${ns}`, [
              { value: `${ewR}, then ${ns}`, why: `${E.label} is to the ${dx > 0 ? 'right' : 'left'} of ${S.label}, so go ${dx > 0 ? 'east' : 'west'}.` },
              { value: `${ew}, then ${nsR}`, why: `${E.label} is ${dy > 0 ? 'above' : 'below'} ${S.label}, so go ${dy > 0 ? 'north' : 'south'}.` },
              ...(Math.abs(dx) !== Math.abs(dy) ? [{ value: `${sq(dy)} ${dx > 0 ? 'east' : 'west'}, then ${sq(dx)} ${dy > 0 ? 'north' : 'south'}`, why: 'The numbers of squares are swapped. Count across and up again.' }] : []),
              { value: `${ewR}, then ${nsR}`, why: 'This route goes the opposite way both times.' },
            ]),
            hints: ['East is right, west is left, north is up and south is down.', `First count the squares across from ${S.label} to ${E.label}.`, `Is ${E.label} to the left or the right of ${S.label}?`],
            explanation: `From ${S.label}, go ${ew}, then ${ns} to reach ${E.label}.`,
          }
        }
        const steps = three
          ? `${name} walks ${ew}, then ${ns}, then ${sq(back)} ${dy > 0 ? 'south' : 'north'}`
          : `${name} walks ${ew}, then ${ns}`
        const ewWrong = dx > 0 ? 'west instead of east' : 'east instead of west'
        const nsWrong = dy > 0 ? 'south instead of north' : 'north instead of south'
        return {
          type: 'mcq',
          prompt: `North is up the map. ${name} starts at the ${S.name} (${S.label}). ${steps}. Where is ${name} now?`,
          figure: mapFig(pts),
          ...textChoice(rng, `the ${E.name}`, [
            { value: `the ${W1.name}`, why: 'You reach this place if you mix up the squares across and the squares up or down.' },
            { value: `the ${W2.name}`, why: `You reach this place if you go ${ewWrong}.` },
            { value: `the ${W3.name}`, why: `You reach this place if you go ${nsWrong}.` },
          ]),
          hints: ['Do one move at a time.', 'East is right, west is left, north is up and south is down.', `Start at ${S.label} and move ${ew} first.`],
          explanation: `From ${S.label}, ${ew}${three ? `, ${ns} and ${sq(back)} ${dy > 0 ? 'south' : 'north'}` : ` and ${ns}`} ends at ${E.label}, the ${E.name}.`,
          solution: [
            { say: `Start at ${S.label}, the ${S.name}.`, figure: mapFig(pts) },
            { say: `Move ${ew}.` },
            { say: `Move ${ns}.` },
            ...(three ? [{ say: `Move ${sq(back)} ${dy > 0 ? 'south' : 'north'}.` }] : []),
            { say: `You are at ${E.label}, the ${E.name}.` },
          ],
          ...(three ? { tags: WORD } : {}),
        }
      }
      return opposite()
    }

    if (level === 1) return opposite()
    if (level === 2) return howFar()
    if (level === 3) return moves(false, false)
    if (level === 4) return moves(true, false)
    return moves(false, true)
  },
}

// ---------------------------------------------------------------------------
// Ss: statistika
// ---------------------------------------------------------------------------

export const SURVEYS: readonly { topic: string; of: (who: string) => string; items: readonly string[]; icon: IconName }[] = [
  { topic: 'favourite fruit', of: (w) => `the favourite fruits of ${w}`, items: ['Mangoes', 'Bananas', 'Rambutans', 'Papayas', 'Apples'], icon: 'apple' },
  { topic: 'favourite pet', of: (w) => `the favourite pets of ${w}`, items: ['Cats', 'Fish', 'Rabbits', 'Birds', 'Hamsters'], icon: 'cat' },
  { topic: 'way to school', of: (w) => `how ${w} travel to school`, items: ['Walking', 'Bus', 'Car', 'Motorbike', 'Bicycle'], icon: 'bus' },
  { topic: 'favourite sport', of: (w) => `the favourite sports of ${w}`, items: ['Football', 'Badminton', 'Swimming', 'Basketball', 'Running'], icon: 'ball' },
  { topic: 'favourite colour', of: (w) => `the favourite colours of ${w}`, items: ['Red', 'Blue', 'Green', 'Yellow', 'Purple'], icon: 'star' },
]

export const lc = (label: string): string => label.toLowerCase()

/** Data survei dengan nilai unik. */
export function surveyData(rng: Rng, n: number, lo: number, hi: number, mult = 1): { s: (typeof SURVEYS)[number]; labels: string[]; values: number[] } {
  const s = rng.pick(SURVEYS)
  const labels = rng.sample(s.items, n)
  const pool = rng.shuffle(range(Math.ceil(lo / mult), Math.floor(hi / mult)).map((x) => x * mult))
  return { s, labels, values: pool.slice(0, n) }
}

const tallyTables3: Generator = {
  skill: 'm3.tally-tables',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const tallyFig = (labels: string[], values: number[], topic: string): Fig => ({
      kind: 'tally',
      rows: labels.map((l, i) => ({ label: l, count: values[i]! })),
      alt: `Tally chart of ${topic}: ${labels.map((l, i) => `${l} ${values[i]}`).join(', ')}.`,
    })

    const readOne = (): GeneratedItem => {
      const { s, labels, values } = surveyData(rng, 4, 3, 19)
      const i = rng.int(0, 3)
      return {
        type: 'numeric',
        prompt: `The tally chart shows ${s.of('some children')}. How many children chose ${lc(labels[i]!)}?`,
        figure: tallyFig(labels, values, s.topic),
        answer: values[i]!,
        hints: ['Each tally mark stands for 1 child.', 'Each gate of marks with a line across stands for five. Count the gates in fives.', `Find the row for ${labels[i]}.`],
        explanation: `${labels[i]} has ${Math.floor(values[i]! / 5)} ${Math.floor(values[i]! / 5) === 1 ? 'gate' : 'gates'} of 5 and ${values[i]! % 5} more, which is ${values[i]}.`,
      }
    }

    const whichTally = (): GeneratedItem => {
      const n = rng.int(7, 19)
      const one = (k: number): Fig => ({ kind: 'tally', rows: [{ label: 'Count', count: k }], alt: `A tally showing ${k}.` })
      const wrong = [n + 1, n - 1, n + 5, n - 5].filter((k) => k > 0 && k <= 40)
      return {
        type: 'mcq',
        prompt: `Which tally shows ${n}?`,
        ...figChoice(rng, one(n), rng.shuffle(wrong).slice(0, 3).map((k) => ({ figure: one(k), why: `This tally shows ${k}.` }))),
        hints: ['Count each tally in 5s, then add the single marks.', 'Each gate is 5 marks.', `${n} is ${plural(Math.floor(n / 5), 'gate', 'gates')}${n % 5 ? ` and ${n % 5} more` : ''}.`],
        explanation: `${n} is ${plural(Math.floor(n / 5), 'gate', 'gates')} of 5${n % 5 ? ` and ${plural(n % 5, 'single mark', 'single marks')}` : ''}.`,
      }
    }

    const compare = (): GeneratedItem => {
      const { s, labels, values } = surveyData(rng, 4, 3, 22)
      if (rng.chance(0.5)) {
        const most = rng.chance(0.6)
        const target = most ? Math.max(...values) : Math.min(...values)
        const ans = labels[values.indexOf(target)]!
        return {
          type: 'mcq',
          prompt: `The tally chart shows ${s.of('some children')}. Which was ${most ? 'the most' : 'the least'} popular?`,
          figure: tallyFig(labels, values, s.topic),
          ...textChoice(rng, ans, labels.filter((l) => l !== ans).map((l) => ({ value: l, why: `${l} has ${values[labels.indexOf(l)]}. ${ans} has ${most ? 'more' : 'fewer'}.` }))),
          hints: ['Count the tally marks in each row.', most ? 'The most popular has the most marks.' : 'The least popular has the fewest marks.', `Write the number next to each row.`],
          explanation: `${ans} has ${target}, which is the ${most ? 'most' : 'fewest'}.`,
        }
      }
      const [i, j] = rng.sample([0, 1, 2, 3], 2) as [number, number]
      const [a, b] = values[i]! > values[j]! ? [i, j] : [j, i]
      return {
        type: 'numeric',
        prompt: `The tally chart shows ${s.of('some children')}. How many more children chose ${lc(labels[a]!)} than ${lc(labels[b]!)}?`,
        figure: tallyFig(labels, values, s.topic),
        answer: values[a]! - values[b]!,
        hints: ['Count both rows first.', 'How many more means find the difference.', `Count the marks for ${labels[b]} first.`],
        explanation: `${labels[a]} has ${values[a]} and ${labels[b]} has ${values[b]}. ${values[a]} - ${values[b]} = ${values[a]! - values[b]!}.`,
      }
    }

    const tableFig = (labels: string[], cells: string[], topic: string, extra = ''): Fig => ({
      kind: 'table',
      head: [cap(topic), 'Number of children'],
      rows: labels.map((l, i) => [l, cells[i]!]),
      alt: `Frequency table of ${topic}: ${labels.map((l, i) => `${l} ${cells[i] === '?' ? 'missing' : cells[i]}`).join(', ')}.${extra}`,
    })

    const missing = (): GeneratedItem => {
      const { s, labels, values } = surveyData(rng, 4, 4, 15)
      const total = values.reduce((a, b) => a + b, 0)
      const i = rng.int(0, 3)
      const known = values.filter((_, k) => k !== i).reduce((a, b) => a + b, 0)
      return {
        type: 'numeric',
        prompt: `${total} children were asked about their ${s.topic}. How many children chose ${lc(labels[i]!)}?`,
        figure: tableFig(labels, values.map((v, k) => (k === i ? '?' : String(v))), s.topic, ` Total ${total}.`),
        answer: values[i]!,
        hints: ['Add the numbers you know.', `Then take that total away from ${total}.`, `${values.filter((_, k) => k !== i).join(' + ')} = ${known}.`],
        explanation: `${known} children said something else. ${total} - ${known} = ${values[i]}.`,
        solution: [
          { say: 'Add the numbers you know.', show: `${values.filter((_, k) => k !== i).join(' + ')} = ${known}` },
          { say: 'Take that away from the total.', show: `${total} - ${known} = ${values[i]}` },
        ],
      }
    }

    const total = (): GeneratedItem => {
      const { s, labels, values } = surveyData(rng, 4, 3, 16)
      const sum = values.reduce((a, b) => a + b, 0)
      return {
        type: 'numeric',
        prompt: `Each child chose one answer. How many children were asked about their ${s.topic}?`,
        figure: tallyFig(labels, values, s.topic),
        answer: sum,
        hints: ['Count each row of tally marks.', 'Add the four numbers together.', `${labels[0]} has ${values[0]}.`],
        explanation: `${values.join(' + ')} = ${sum} children.`,
      }
    }

    const notChose = (): GeneratedItem => {
      const { s, labels, values } = surveyData(rng, 4, 4, 15)
      const sum = values.reduce((a, b) => a + b, 0)
      const i = rng.int(0, 3)
      return {
        type: 'numeric',
        prompt: `The table shows ${s.of('a class')}. How many children did not choose ${lc(labels[i]!)}?`,
        figure: tableFig(labels, values.map(String), s.topic),
        answer: sum - values[i]!,
        hints: [`Every child who did not choose ${labels[i]} chose something else.`, `Add the other three numbers, or find the total and take away ${labels[i]}.`, 'Add all four numbers to find the total first.'],
        explanation: `The total is ${sum}. ${sum} - ${values[i]} = ${sum - values[i]!} children did not choose ${labels[i]}.`,
        tags: WORD,
      }
    }

    const twoClasses = (): GeneratedItem => {
      const { s, labels } = surveyData(rng, 4, 1, 9)
      for (let t = 0; t < 30; t++) {
        const a = labels.map(() => rng.int(2, 12))
        const b = labels.map(() => rng.int(2, 12))
        const sums = a.map((x, i) => x + b[i]!)
        const max = Math.max(...sums)
        if (sums.filter((x) => x === max).length > 1) continue
        if (a.indexOf(Math.max(...a)) === sums.indexOf(max)) continue
        const ans = labels[sums.indexOf(max)]!
        return {
          type: 'mcq',
          prompt: `The table shows ${s.of('two classes')}. Which was the most popular in both classes together?`,
          figure: { kind: 'table', head: [cap(s.topic), 'Class 3A', 'Class 3B'], rows: labels.map((l, i) => [l, String(a[i]), String(b[i])]), alt: `Table: ${labels.map((l, i) => `${l} 3A ${a[i]}, 3B ${b[i]}`).join('; ')}.` },
          ...textChoice(rng, ans, labels.filter((l) => l !== ans).map((l) => ({ value: l, why: `${l} has ${a[labels.indexOf(l)]} + ${b[labels.indexOf(l)]} = ${sums[labels.indexOf(l)]}. ${ans} has ${max}.` }))),
          hints: ['Add the two classes together for each row.', 'Write the total next to each row, then compare.', `${labels[(sums.indexOf(max) + 1) % 4]}: ${a[(sums.indexOf(max) + 1) % 4]} + ${b[(sums.indexOf(max) + 1) % 4]} = ${sums[(sums.indexOf(max) + 1) % 4]}.`],
          explanation: `Totals: ${labels.map((l, i) => `${l} ${sums[i]}`).join(', ')}. ${ans} has the most with ${max}.`,
        }
      }
      return total()
    }

    if (level === 1) return oneOf(rng, [readOne, whichTally])
    if (level === 2) return compare()
    if (level === 3) return oneOf(rng, [missing, total])
    if (level === 4) return notChose()
    return twoClasses()
  },
}

/** "3 symbols", "1 symbol", "2 and a half symbols". */
export const symCount = (c: number): string => (c % 1 ? `${Math.floor(c)} and a half symbols` : plural(c, 'symbol', 'symbols'))

const pictogramsBars3: Generator = {
  skill: 'm3.pictograms-bars',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const picto = (key: number, halves: boolean) => {
      const { s, labels } = surveyData(rng, 4, 1, 9)
      const counts = labels.map(() => rng.int(1, 8) + (halves && rng.chance(0.5) ? 0.5 : 0))
      if (halves && !counts.some((c) => c % 1 !== 0)) counts[rng.int(0, 3)] = rng.int(1, 7) + 0.5
      const values = counts.map((c) => c * key)
      const figure: Fig = {
        kind: 'pictogram',
        title: cap(s.topic),
        rows: labels.map((l, i) => ({ label: l, count: counts[i]! })),
        icon: s.icon,
        key,
        alt: `Pictogram of ${s.topic}. Each symbol means ${key} children. ${labels.map((l, i) => `${l}: ${symCount(counts[i]!)}`).join(', ')}.`,
      }
      return { s, labels, counts, values, figure }
    }

    const barData = (step: number) => {
      const s = rng.pick([
        { title: 'Books read', cats: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], unit: 'books', y: 'Books' },
        { title: 'Visitors to the class library', cats: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], unit: 'visitors', y: 'Visitors' },
        { title: 'Mangoes picked', cats: ['Week 1', 'Week 2', 'Week 3', 'Week 4'], unit: 'mangoes', y: 'Mangoes' },
        { title: 'Kites sold', cats: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], unit: 'kites', y: 'Kites' },
      ])
      const cats = s.cats.slice(0, rng.int(4, s.cats.length))
      const values = rng.sample(range(1, 10), cats.length).map((v) => v * step)
      const figure: Fig = { kind: 'bars', title: s.title, categories: cats, values, step, yLabel: s.y, alt: `Bar chart of ${s.title.toLowerCase()}: ${cats.map((c, i) => `${c} ${values[i]}`).join(', ')}.` }
      return { s, cats, values, figure }
    }

    const readPicto = (key: number, halves: boolean): GeneratedItem => {
      const { s, labels, counts, values, figure } = picto(key, halves)
      const i = halves ? Math.max(0, counts.findIndex((c) => c % 1 !== 0)) : rng.int(0, 3)
      return {
        type: 'numeric',
        prompt: `Each symbol means ${key} children. How many children chose ${lc(labels[i]!)}?`,
        figure,
        answer: values[i]!,
        hints: ['Look at the key first.', `Each whole symbol is ${key}.${halves ? ` Half a symbol is ${key / 2}.` : ''}`, `Count in ${key}s along the row for ${labels[i]}.`],
        explanation: counts[i]! % 1 ? `${labels[i]} has ${plural(Math.floor(counts[i]!), 'whole symbol', 'whole symbols')} and a half. ${Math.floor(counts[i]!)} × ${key} = ${Math.floor(counts[i]!) * key}, and half a symbol is ${key / 2}, so ${values[i]}.` : `${labels[i]} has ${plural(counts[i]!, 'symbol', 'symbols')}. ${counts[i]} × ${key} = ${values[i]}.`,
      }
    }

    const readBar = (step: number): GeneratedItem => {
      const { s, cats, values, figure } = barData(step)
      const i = rng.int(0, cats.length - 1)
      return {
        type: 'numeric',
        prompt: `How many ${s.unit} were there ${cats[i]!.startsWith('Week') ? 'in' : 'on'} ${cats[i]}?`,
        figure,
        answer: values[i]!,
        hints: ['Find the bar, then look across to the scale.', `The scale goes up in ${step}s.`, `Put your finger on the top of the bar for ${cats[i]} and slide it across.`],
        explanation: `The bar for ${cats[i]} reaches ${values[i]}.`,
        solution: [
          { say: `Find the bar for ${cats[i]}.`, figure },
          { say: 'Slide your finger across from the top of the bar to the scale.', show: `${values[i]}` },
        ],
      }
    }

    const compareBar = (): GeneratedItem => {
      const step = rng.pick([2, 5, 10])
      const { s, cats, values, figure } = barData(step)
      if (rng.chance(0.5)) {
        const [i, j] = rng.sample(range(0, cats.length - 1), 2) as [number, number]
        const [a, b] = values[i]! > values[j]! ? [i, j] : [j, i]
        return {
          type: 'numeric',
          prompt: `How many more ${s.unit} were there ${cats[a]!.startsWith('Week') ? 'in' : 'on'} ${cats[a]} than ${cats[b]!.startsWith('Week') ? 'in' : 'on'} ${cats[b]}?`,
          figure,
          answer: values[a]! - values[b]!,
          hints: ['Read both bars first.', 'How many more means find the difference.', `Read the bar for ${cats[b]} first.`],
          explanation: `${values[a]} - ${values[b]} = ${values[a]! - values[b]!}.`,
          tags: WORD,
        }
      }
      const sum = values.reduce((x, y) => x + y, 0)
      return {
        type: 'numeric',
        prompt: `How many ${s.unit} were there altogether?`,
        figure,
        answer: sum,
        hints: ['Read the value of every bar.', 'Add all the values together.', `The first bar reaches ${values[0]}.`],
        explanation: `${values.join(' + ')} = ${sum}.`,
      }
    }

    const howManySymbols = (): GeneratedItem => {
      const key = rng.pick([2, 5, 10])
      const n = rng.int(3, 9)
      const value = n * key
      return {
        type: 'numeric',
        prompt: `In a pictogram, each symbol means ${key} children. How many symbols are needed to show ${value} children?`,
        answer: n,
        hints: ['Each symbol stands for a group of children.', `How many groups of ${key} make ${value}?`, `Count in ${key}s up to ${value}.`],
        explanation: `${value} ÷ ${key} = ${n}, so ${n} symbols are needed.`,
      }
    }

    const halfBar = (): GeneratedItem => {
      const { s, cats, figure } = barData(10)
      const i = rng.int(0, cats.length - 1)
      const v = rng.int(1, 8) * 10 + 5
      const vals = (figure as { values: number[] }).values.slice()
      vals[i] = v
      const fig: Fig = { ...(figure as Extract<Fig, { kind: 'bars' }>), values: vals, alt: `Bar chart: ${cats.map((c, k) => `${c} ${vals[k]}`).join(', ')}.` }
      return {
        type: 'numeric',
        prompt: `The bar for ${cats[i]} ends halfway between two lines. How many ${s.unit} does it show?`,
        figure: fig,
        answer: v,
        hints: ['The scale goes up in 10s.', 'Halfway between two lines is half of 10 more.', `The bar is just past ${v - 5}.`],
        explanation: `Halfway between ${v - 5} and ${v + 5} is ${v}.`,
      }
    }

    const pictoTotal = (): GeneratedItem => {
      const { labels, counts, values, figure } = picto(rng.pick([2, 10]), true)
      const sum = values.reduce((a, b) => a + b, 0)
      return {
        type: 'numeric',
        prompt: 'How many children are shown in the pictogram altogether?',
        figure,
        answer: sum,
        hints: ['Find the value of each row using the key.', 'Then add the four rows together.', `${labels[0]} has ${symCount(counts[0]!)}, which is ${values[0]}.`],
        explanation: `${values.join(' + ')} = ${sum} children.`,
      }
    }

    if (level === 1) return oneOf(rng, [() => readPicto(2, false), () => readBar(2)])
    if (level === 2) return oneOf(rng, [() => readPicto(rng.pick([5, 10]), false), () => readPicto(2, true), () => readBar(rng.pick([5, 10]))])
    const mostFewest = (): GeneratedItem => {
      const { s, cats, values, figure } = barData(rng.pick([2, 5, 10]))
      const most = rng.chance(0.5)
      const t = values.indexOf(most ? Math.max(...values) : Math.min(...values))
      return {
        type: 'mcq',
        prompt: `Which ${cats[0]!.startsWith('Week') ? 'week' : 'day'} had the ${most ? 'most' : 'fewest'} ${s.unit}?`,
        figure,
        ...textChoice(rng, cats[t]!, cats.filter((_, k) => k !== t).map((c) => ({ value: c, why: `${c} has ${values[cats.indexOf(c)]}, and ${cats[t]} has ${values[t]}.` }))),
        hints: [most ? 'Look for the tallest bar.' : 'Look for the shortest bar.', 'Read each bar against the scale.', 'Compare the numbers you read.'],
        explanation: `${cats[t]} has ${values[t]}, the ${most ? 'most' : 'fewest'} ${s.unit}.`,
      }
    }

    if (level === 3) return oneOf(rng, [compareBar, mostFewest])
    if (level === 4) return oneOf(rng, [howManySymbols, halfBar])
    return pictoTotal()
  },
}

export type NumRule = { name: string; short: string; pred: string; predPl: string; test: (n: number) => boolean }
export const NUM_RULES: readonly NumRule[] = [
  { name: 'Even numbers', short: 'Even', pred: 'even', predPl: 'even', test: (n) => n % 2 === 0 },
  { name: 'Odd numbers', short: 'Odd', pred: 'odd', predPl: 'odd', test: (n) => n % 2 === 1 },
  { name: 'Multiples of 5', short: 'Multiple of 5', pred: 'a multiple of 5', predPl: 'multiples of 5', test: (n) => n % 5 === 0 },
  { name: 'Multiples of 10', short: 'Multiple of 10', pred: 'a multiple of 10', predPl: 'multiples of 10', test: (n) => n % 10 === 0 },
  { name: 'Multiples of 3', short: 'Multiple of 3', pred: 'a multiple of 3', predPl: 'multiples of 3', test: (n) => n % 3 === 0 },
  { name: 'Multiples of 4', short: 'Multiple of 4', pred: 'a multiple of 4', predPl: 'multiples of 4', test: (n) => n % 4 === 0 },
  { name: 'More than 50', short: 'More than 50', pred: 'more than 50', predPl: 'more than 50', test: (n) => n > 50 },
  { name: 'Less than 30', short: 'Less than 30', pred: 'less than 30', predPl: 'less than 30', test: (n) => n < 30 },
]

/** Dua aturan yang keempat daerahnya bisa terisi bilangan 1 sampai 99. */
export function rulePair(rng: Rng, pool: readonly NumRule[] = NUM_RULES): [NumRule, NumRule] {
  for (let t = 0; t < 50; t++) {
    const [a, b] = rng.sample(pool, 2) as [NumRule, NumRule]
    const regions = [0, 0, 0, 0]
    for (let n = 1; n < 100; n++) {
      const k = (a.test(n) ? 0 : 1) + (b.test(n) ? 0 : 2)
      regions[k] = (regions[k] ?? 0) + 1
    }
    if (regions.every((r) => r > 0)) return [a, b]
  }
  return [NUM_RULES[0]!, NUM_RULES[6]!]
}

export function regionOf(n: number, a: NumRule, b: NumRule): 'a' | 'b' | 'both' | 'none' {
  const x = a.test(n)
  const y = b.test(n)
  return x && y ? 'both' : x ? 'a' : y ? 'b' : 'none'
}

/** Ambil bilangan acak 1 sampai 99 untuk tiap daerah. */
export function numbersFor(rng: Rng, a: NumRule, b: NumRule, perRegion: readonly number[]): Map<string, number[]> {
  const out = new Map<string, number[]>([['a', []], ['b', []], ['both', []], ['none', []]])
  const regions = ['a', 'b', 'both', 'none'] as const
  const nums = rng.shuffle(range(1, 99))
  for (const n of nums) {
    const r = regionOf(n, a, b)
    const k = regions.indexOf(r)
    if (out.get(r)!.length < perRegion[k]!) out.get(r)!.push(n)
  }
  return out
}

const vennCarroll3: Generator = {
  skill: 'm3.venn-carroll',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const regionText = (r: string, a: NumRule, b: NumRule) =>
      r === 'a' ? `In the ${lc(a.name)} circle only` : r === 'b' ? `In the ${lc(b.name)} circle only` : r === 'both' ? 'In both circles' : 'Outside both circles'
    const facts = (n: number, a: NumRule, b: NumRule) => `${n} is ${a.test(n) ? '' : 'not '}${a.pred} and ${b.test(n) ? '' : 'not '}${b.pred}`

    const where = (): GeneratedItem => {
      const [a, b] = rulePair(rng)
      const regions = ['a', 'b', 'both', 'none'] as const
      const target = rng.pick(regions)
      const n = numbersFor(rng, a, b, regions.map((r) => (r === target ? 1 : 0))).get(target)![0]!
      return {
        type: 'mcq',
        prompt: `A Venn diagram has two circles: ${lc(a.name)} and ${lc(b.name)}. Where does ${n} go?`,
        figure: { kind: 'venn', sets: [a.name, b.name], items: [], alt: `An empty Venn diagram with circles for ${lc(a.name)} and ${lc(b.name)}.` },
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

    const vennFig = (a: NumRule, b: NumRule, map: Map<string, number[]>): Fig => ({
      kind: 'venn',
      sets: [a.name, b.name],
      items: [...map.entries()].flatMap(([r, ns]) => ns.map((n) => ({ text: String(n), region: r as 'a' | 'b' | 'both' | 'none' }))),
      alt: `Venn diagram. ${a.name} only: ${map.get('a')!.join(', ') || 'none'}. ${b.name} only: ${map.get('b')!.join(', ') || 'none'}. Both: ${map.get('both')!.join(', ') || 'none'}. Outside: ${map.get('none')!.join(', ') || 'none'}.`,
    })

    const countRegion = (): GeneratedItem => {
      const [a, b] = rulePair(rng)
      const per = [rng.int(1, 3), rng.int(1, 3), rng.int(1, 3), rng.int(1, 2)]
      const map = numbersFor(rng, a, b, per)
      const ask = rng.pick(['both', 'a', 'awhole'] as const)
      const ans = ask === 'both' ? map.get('both')!.length : ask === 'a' ? map.get('a')!.length : map.get('a')!.length + map.get('both')!.length
      const q = ask === 'both' ? 'How many numbers are in both circles?' : ask === 'a' ? `How many numbers are ${a.predPl} but not ${b.predPl}?` : `How many numbers are ${a.predPl}?`
      return {
        type: 'numeric',
        prompt: `Look at the Venn diagram. ${q}`,
        figure: vennFig(a, b, map),
        answer: ans,
        hints: ['The middle part, where the circles overlap, is for numbers that fit both rules.', ask === 'awhole' ? `Count every number inside the ${a.name} circle, including the overlap.` : ask === 'a' ? 'Count only the part of the circle that does not overlap.' : 'Count only the numbers in the overlap.', 'Point to each number as you count it.'],
        explanation: ask === 'awhole' ? `${map.get('a')!.length} in ${a.name.toLowerCase()} only and ${map.get('both')!.length} in the overlap make ${ans}.` : `There ${ans === 1 ? 'is' : 'are'} ${ans} in that part of the diagram.`,
      }
    }

    const carrollSort = (): GeneratedItem => {
      const [a, b] = rulePair(rng, NUM_RULES.filter((r) => r.short !== 'Odd'))
      const map = numbersFor(rng, a, b, [2, 2, 1, 2])
      const groupOf = (r: string) => (r === 'a' ? 0 : r === 'b' ? 1 : r === 'both' ? 2 : 3)
      const groups = [`${a.short} only`, `${b.short} only`, 'Both', 'Neither']
      const items = rng.shuffle([...map.entries()].flatMap(([r, ns]) => ns.map((n) => ({ text: String(n), group: groupOf(r) }))))
      return {
        type: 'sort',
        prompt: `Sort the numbers for a Venn diagram: ${lc(a.name)} and ${lc(b.name)}.`,
        figure: { kind: 'venn', sets: [a.name, b.name], items: [], alt: `An empty Venn diagram with circles for ${lc(a.name)} and ${lc(b.name)}.` },
        groups,
        items,
        hints: ['Test each number against both rules.', `First ask: is it ${a.pred}? Then ask: is it ${b.pred}?`, `Start with ${items[0]!.text}.`],
        explanation: groups.map((g, k) => `${g}: ${items.filter((x) => x.group === k).map((x) => x.text).join(', ')}`).join('. ') + '.',
      }
    }

    const wrongPlace = (): GeneratedItem => {
      const [a, b] = rulePair(rng, NUM_RULES.filter((r) => r.short !== 'Odd'))
      const map = numbersFor(rng, a, b, [2, 2, 2, 2])
      const cells = [map.get('both')!, map.get('a')!, map.get('b')!, map.get('none')!].map((c) => c.slice())
      const from = rng.int(0, 3)
      let to = rng.int(0, 3)
      if (to === from) to = (to + 1) % 4
      const moved = cells[from]!.pop()!
      cells[to]!.push(moved)
      const all = cells.flat()
      return {
        type: 'mcq',
        prompt: 'One number is in the wrong place in this Carroll diagram. Which number?',
        figure: {
          kind: 'carroll',
          cols: [a.short, `Not ${a.short.toLowerCase()}`],
          rows: [b.short, `Not ${b.short.toLowerCase()}`],
          cells: [cells[0]!.map(String), cells[2]!.map(String), cells[1]!.map(String), cells[3]!.map(String)],
          alt: `Carroll diagram. ${a.short} and ${b.short.toLowerCase()}: ${cells[0]!.join(', ')}. Not ${a.short.toLowerCase()} and ${b.short.toLowerCase()}: ${cells[2]!.join(', ')}. ${a.short} and not ${b.short.toLowerCase()}: ${cells[1]!.join(', ')}. Neither: ${cells[3]!.join(', ')}.`,
        },
        ...numChoice(rng, moved, rng.sample(all.filter((x) => x !== moved), 3).map((x) => ({ value: x, why: `${x} fits both rules for its box.` })), { spread: [] }),
        hints: ['Each box has two rules: one from its column and one from its row.', 'Check every number against both rules for its box.', 'Start with the top left box.'],
        explanation: `${moved} is ${a.test(moved) ? '' : 'not '}${a.pred} and ${b.test(moved) ? '' : 'not '}${b.pred}, so it belongs in the box for ${a.test(moved) ? lc(a.short) : `not ${lc(a.short)}`} and ${b.test(moved) ? lc(b.short) : `not ${lc(b.short)}`}.`,
      }
    }

    const pets = (): GeneratedItem => {
      const x = rng.int(3, 9)
      const y = rng.int(2, 6)
      const z = rng.int(3, 9)
      const w = rng.int(1, 6)
      const g = rng.pick([
        { A: 'Has a cat', B: 'Has a fish', a: 'have a cat', b: 'have a fish', notA: 'do not have a cat' },
        { A: 'Likes football', B: 'Likes badminton', a: 'like football', b: 'like badminton', notA: 'do not like football' },
        { A: 'Can swim', B: 'Can ride a bike', a: 'can swim', b: 'can ride a bike', notA: 'cannot swim' },
        { A: 'Likes mango', B: 'Likes durian', a: 'like mango', b: 'like durian', notA: 'do not like mango' },
      ])
      const ask = rng.int(0, 2)
      const q = ask === 0 ? `How many children ${g.a}?` : ask === 1 ? 'How many children are in the class?' : `How many children ${g.b} but ${g.notA}?`
      const ans = ask === 0 ? x + y : ask === 1 ? x + y + z + w : z
      return {
        type: 'numeric',
        prompt: `The Venn diagram shows how many children are in each group. ${q}`,
        figure: { kind: 'venn', sets: [g.A, g.B], items: [{ text: String(x), region: 'a' }, { text: String(y), region: 'both' }, { text: String(z), region: 'b' }, { text: String(w), region: 'none' }], alt: `Venn diagram of children: ${g.A} only ${x}, both ${y}, ${g.B} only ${z}, neither ${w}.` },
        answer: ans,
        hints: ['Each number tells you how many children are in that part.', ask === 0 ? `Children in the ${g.A} circle include the overlap.` : ask === 1 ? 'Every child is in exactly one part, inside or outside the circles.' : 'Only count the part of the circle that does not overlap.', ask === 0 ? `The ${g.A} circle has two parts. Add them.` : ask === 1 ? 'Add the numbers in all four parts.' : `Find the part of the ${g.B} circle outside the overlap.`],
        explanation: ask === 0 ? `${x} + ${y} = ${ans} children ${g.a}.` : ask === 1 ? `${x} + ${y} + ${z} + ${w} = ${ans} children.` : `Only the ${g.B} part outside the overlap counts, which is ${z}.`,
        tags: WORD,
      }
    }

    if (level === 1) return where()
    if (level === 2) return countRegion()
    if (level === 3) return carrollSort()
    if (level === 4) return wrongPlace()
    return pets()
  },
}

// ---------------------------------------------------------------------------
// Sp: peluang
// ---------------------------------------------------------------------------

export const CHANCE_WORDS = ['certain', 'likely', 'unlikely', 'impossible'] as const
type ChanceWord = (typeof CHANCE_WORDS)[number]

const EVENTS3: readonly { text: string; w: ChanceWord }[] = [
  { text: 'The sun will set this evening.', w: 'certain' },
  { text: 'The day after Monday will be Tuesday.', w: 'certain' },
  { text: 'A dropped stone will fall down.', w: 'certain' },
  { text: 'Next month will have at least 28 days.', w: 'certain' },
  { text: 'A cat will learn to fly.', w: 'impossible' },
  { text: 'You will roll a 7 on a normal dice numbered 1 to 6.', w: 'impossible' },
  { text: 'Next week will have 8 days.', w: 'impossible' },
  { text: 'The sun will rise in the west tomorrow.', w: 'impossible' },
  { text: 'It will rain in Bogor at some time in January.', w: 'likely' },
  { text: 'You will see a bird outside this week.', w: 'likely' },
  { text: 'Your teacher will come to school on a school day.', w: 'likely' },
  { text: 'You will roll a 6 on a normal dice.', w: 'unlikely' },
  { text: 'You will find a Rp100.000 note on the pavement today.', w: 'unlikely' },
  { text: 'Everyone in your class will wear a red shirt tomorrow.', w: 'unlikely' },
]

const FRUIT_BAG: readonly { icon: IconName; one: string; many: string }[] = [
  { icon: 'apple', one: 'apple', many: 'apples' },
  { icon: 'pear', one: 'pear', many: 'pears' },
  { icon: 'banana', one: 'banana', many: 'bananas' },
  { icon: 'orange', one: 'orange', many: 'oranges' },
  { icon: 'strawberry', one: 'strawberry', many: 'strawberries' },
]

export const CHANCE_WHY: Record<ChanceWord, string> = {
  certain: 'Certain means it will definitely happen.',
  likely: 'Likely means it will probably happen, but not for sure.',
  unlikely: 'Unlikely means it could happen, but probably will not.',
  impossible: 'Impossible means it can never happen.',
}

const chance3: Generator = {
  skill: 'm3.chance',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const wordChoice = (ans: ChanceWord, prompt: string, figure: Fig | undefined, hints: string[], explanation: string): GeneratedItem => ({
      type: 'mcq',
      prompt,
      ...(figure ? { figure } : {}),
      ...textChoice(rng, ans, CHANCE_WORDS.filter((w) => w !== ans).map((w) => ({ value: w, why: CHANCE_WHY[w] }))),
      hints,
      explanation,
    })

    const event = (): GeneratedItem => {
      const e = rng.pick(EVENTS3)
      return wordChoice(e.w, `How likely is this? ${e.text}`, undefined, ['Think about whether it could ever happen.', 'Ask yourself: must it happen? Could it never happen?', 'If it could happen, decide whether it probably will or probably will not.'], `${e.text.replace(/\.$/, '')}: this is ${e.w}. ${CHANCE_WHY[e.w]}`)
    }

    const bag = (): GeneratedItem => {
      const [p, q] = rng.sample(FRUIT_BAG, 2) as [(typeof FRUIT_BAG)[number], (typeof FRUIT_BAG)[number]]
      const kind = rng.pick(CHANCE_WORDS)
      const big = rng.int(6, 9)
      const small = rng.int(1, 2)
      const third = rng.pick(FRUIT_BAG.filter((f) => f !== p && f !== q))
      let a = big
      let b = small
      let ask = p
      if (kind === 'unlikely') ask = q
      if (kind === 'certain') b = 0
      if (kind === 'impossible') ask = third
      if (kind === 'likely') {
        a = big
        b = small
      }
      const items = [{ icon: p.icon, count: a }, ...(b ? [{ icon: q.icon, count: b }] : [])]
      const desc = `${plural(a, p.one, p.many)}${b ? ` and ${plural(b, q.one, q.many)}` : ''}`
      return wordChoice(
        kind,
        `A bag has ${desc}. ${pickName(rng)} takes one fruit without looking. How likely is it to be ${art(ask.one)}?`,
        { kind: 'objects', items, alt: `A bag with ${desc}.` },
        ['Count each kind of fruit in the bag.', `Is there any ${ask.one} in the bag? Is there more of it than the other fruit?`, `There ${a === 1 ? 'is' : 'are'} ${plural(a, p.one, p.many)} in the bag.`],
        kind === 'impossible'
          ? `There is no ${ask.one} in the bag, so it is impossible.`
          : kind === 'certain'
            ? `Every fruit in the bag is ${art(ask.one)}, so it is certain.`
            : kind === 'likely'
              ? `Most of the fruit are ${p.many}, so ${art(p.one)} is likely.`
              : `Only ${plural(b, q.one, q.many)} out of ${a + b}, so ${art(q.one)} is unlikely.`,
      )
    }

    const spinner = (): GeneratedItem => {
      const parts = rng.pick([4, 5, 6, 8, 10])
      const kind = rng.pick(CHANCE_WORDS)
      const shaded = kind === 'certain' ? parts : kind === 'impossible' ? 0 : kind === 'likely' ? rng.int(Math.floor(parts / 2) + 1, parts - 1) : rng.int(1, Math.ceil(parts / 2) - 1)
      return wordChoice(
        kind,
        'The spinner is spun once. How likely is it to land on a shaded part?',
        { kind: 'fraction', shape: 'circle', parts, shaded, alt: `A spinner with ${parts} equal parts. ${shaded} ${shaded === 1 ? 'part is' : 'parts are'} shaded.` },
        ['Count the shaded parts and the white parts.', 'Compare them. Are there more shaded parts or more white parts?', `There are ${parts} parts altogether.`],
        `${shaded} out of ${parts} parts are shaded, so landing on a shaded part is ${kind}.`,
      )
    }

    const sortEvents = (): GeneratedItem => {
      const [p, q, r] = rng.sample(FRUIT_BAG, 3) as [(typeof FRUIT_BAG)[number], (typeof FRUIT_BAG)[number], (typeof FRUIT_BAG)[number]]
      const a = rng.int(6, 9)
      const b = rng.int(1, 2)
      const items = [
        { text: `take ${art(p.one)}`, group: 1 },
        { text: `take ${art(q.one)}`, group: 2 },
        { text: `take ${art(r.one)}`, group: 3 },
        { text: 'take a piece of fruit', group: 0 },
      ]
      return {
        type: 'sort',
        prompt: `A bag has ${plural(a, p.one, p.many)} and ${plural(b, q.one, q.many)}. Take one without looking. Sort the outcomes.`,
        figure: { kind: 'objects', items: [{ icon: p.icon, count: a }, { icon: q.icon, count: b }], alt: `A bag with ${plural(a, p.one, p.many)} and ${plural(b, q.one, q.many)}.` },
        groups: ['Certain', 'Likely', 'Unlikely', 'Impossible'],
        items: rng.shuffle(items),
        hints: ['Count each kind of fruit in the bag.', 'Something that is not in the bag is impossible. Something everything in the bag matches is certain.', `There are ${a} ${p.many} and only ${b} ${b === 1 ? q.one : q.many}.`],
        explanation: `Certain: take a piece of fruit. Likely: take ${art(p.one)}. Unlikely: take ${art(q.one)}. Impossible: take ${art(r.one)}.`,
      }
    }

    const orderIt = (): GeneratedItem => {
      const fr = rng.sample(FRUIT_BAG, 4)
      const counts = rng.sample([1, 2, 4, 6, 8], 3)
      const inBag = fr.slice(0, 3).map((f, i) => ({ f, c: counts[i]! }))
      const sorted = [...inBag].sort((x, y) => y.c - x.c)
      const items = [...sorted.map((x) => `${art(x.f.one)}`), `${art(fr[3]!.one)}`]
      return {
        type: 'order',
        prompt: `A bag has ${listAnd(inBag.map((x) => plural(x.c, x.f.one, x.f.many)))}. Order the outcomes from most likely to least likely.`,
        figure: { kind: 'objects', items: inBag.map((x) => ({ icon: x.f.icon, count: x.c })), alt: `A bag with ${listAnd(inBag.map((x) => plural(x.c, x.f.one, x.f.many)))}.` },
        items,
        hints: ['The more there are of a fruit, the more likely you are to take it.', 'A fruit that is not in the bag is impossible, so it goes last.', `There ${sorted[0]!.c === 1 ? 'is' : 'are'} ${plural(sorted[0]!.c, sorted[0]!.f.one, sorted[0]!.f.many)}.`],
        explanation: `Most likely to least likely: ${items.join(', ')}. ${cap(art(fr[3]!.one))} is impossible because there is none in the bag.`,
      }
    }

    if (level === 1) return event()
    if (level === 2) return bag()
    if (level === 3) return spinner()
    if (level === 4) return sortEvents()
    return orderIt()
  },
}

// ---------------------------------------------------------------------------
// Pembahasan otomatis: bila generator tidak menulis `solution`, kalimat
// penjelasan dipecah menjadi langkah SolutionPlayer. Figur soal ikut di langkah 1.
// ---------------------------------------------------------------------------

const EQUATION = /-?[\d][\d,.]*( (?:[+×÷-]|r) -?[\d][\d,.]*)+ = -?[\d][\d,.]*/

export function autoSolution(item: GeneratedItem): GeneratedItem {
  if (item.solution) return item
  const parts = item.explanation
    .split(/(?<=[.!?])\s+(?=[A-Z0-9(])/)
    .map((x) => x.trim())
    .filter(Boolean)
  if (parts.length < 2 || parts.some((x) => x.length > 220)) return item
  const steps: Step[] = parts.slice(0, 8).map((say, i) => {
    const eq = EQUATION.exec(say)?.[0]
    return {
      say,
      ...(eq && eq.length <= 120 && eq !== say.replace(/\.$/, '') ? { show: eq } : {}),
      ...(i === 0 && item.figure ? { figure: item.figure } : {}),
    }
  })
  return { ...item, solution: steps }
}

export const withSolutions = (g: Generator): Generator => ({ ...g, generate: (ctx) => autoSolution(g.generate(ctx)) })

// ---------------------------------------------------------------------------

export const generators: Generator[] = [
  placeValue,
  compareOrder,
  round10100,
  sequences3,
  addSubMental,
  addSubColumns,
  timesTables3,
  division3,
  multiply2d1d,
  fractions3,
  fractionsOfAmounts3,
  equivalent3,
  moneyRupiah3,
  timeClock3,
  timeIntervals3,
  length3,
  massCapacity3,
  temperature3,
  perimeterArea3,
  shapes2d3,
  shapes3d3,
  symmetry3,
  anglesTurns3,
  positionDirection3,
  tallyTables3,
  pictogramsBars3,
  vennCarroll3,
  chance3,
].map(withSolutions)
