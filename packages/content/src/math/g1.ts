import type { Rng } from '@kira/core/rng'
import type { FigureSpecInput, IconName } from '@kira/figures/spec'
import { COUNTABLES, DAYS, MONTHS, NAMES, mcqFrom, numberWords, ordinal, plural, rupiah, timeWords } from './helpers'
import type { Generator } from './types'

/* -------------------------------------------------------------------------
 * Helper bersama Grade 1 dan Grade 2. g2.ts mengimpor dari file ini.
 * ---------------------------------------------------------------------- */

export type Fig = FigureSpecInput
export type Opt = { text?: string; figure?: Fig; why?: string }
export type Step = { say: string; show?: string; figure?: Fig }
export type Countable = (typeof COUNTABLES)[number]
export type Shape2D = Extract<Fig, { kind: 'shape' }>['shape']
export type Solid = Extract<Fig, { kind: 'solid' }>['solid']
export type MoneyValue = Extract<Fig, { kind: 'money' }>['items'][number]['value']
export type FracShape = 'bar' | 'circle' | 'square'

/** Pilihan ganda dengan opsi teks atau figur. Opsi kembar dibuang, lalu urutan diacak deterministik. */
export function mcqOpts(rng: Rng, correct: Opt, distractors: readonly Opt[], count: number): { options: Opt[]; answer: number } {
  const key = (o: Opt) => (o.text ?? JSON.stringify(o.figure)).trim().toLowerCase()
  const seen = new Set<string>([key(correct)])
  const picked: Opt[] = []
  for (const d of distractors) {
    const k = key(d)
    if (seen.has(k)) continue
    seen.add(k)
    picked.push(d)
    if (picked.length >= count - 1) break
  }
  const all = rng.shuffle([{ o: correct, ok: true }, ...picked.map((o) => ({ o, ok: false }))])
  return { options: all.map((x) => x.o), answer: all.findIndex((x) => x.ok) }
}

export const pickName = (rng: Rng): string => rng.pick(NAMES)

export function twoNames(rng: Rng): [string, string] {
  const s = rng.sample(NAMES, 2)
  return [s[0]!, s[1]!]
}

export const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)
export const art = (w: string): string => (/^[aeiou]/i.test(w) ? 'an' : 'a')

export function listAnd(items: readonly string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** Bilangan dari `from` ke `to` (naik atau turun) dengan langkah positif `step`. */
export function range(from: number, to: number, step = 1): number[] {
  const out: number[] = []
  if (from <= to) for (let v = from; v <= to; v += step) out.push(v)
  else for (let v = from; v >= to; v -= step) out.push(v)
  return out
}

export const countList = (from: number, to: number, step = 1): string => range(from, to, step).join(', ')
export const onesText = (u: number): string => `${u} ${u === 1 ? 'one' : 'ones'}`
export const tensText = (t: number): string => `${t} ${t === 1 ? 'ten' : 'tens'}`

const ORD_SMALL = ['zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
  'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth']

/** 3 menjadi "third", 21 menjadi "twenty-first". */
export function ordinalWord(n: number): string {
  if (n < 20) return ORD_SMALL[n]!
  if (n % 10 === 0) return numberWords(n).replace(/y$/, 'ieth')
  return `${numberWords(n - (n % 10))}-${ORD_SMALL[n % 10]}`
}

/** Bingkai sepuluh (2 x 5) atau dua puluh (2 x 10) dengan `filled` kotak terisi. */
export function frame(filled: number, cols: number, alt: string): Fig {
  const shaded: [number, number][] = []
  for (let i = 0; i < filled; i++) shaded.push([Math.floor(i / cols), i % cols])
  return { kind: 'grid', rows: 2, cols, shaded, alt }
}

export function seqFig(items: readonly (number | string | null)[], style: 'stones' | 'boxes' | 'circles' = 'stones'): Fig {
  const one = style === 'stones' ? 'stone' : style === 'boxes' ? 'box' : 'circle'
  const desc = items.map((v) => (v === null ? `a blank ${one}` : String(v)))
  return { kind: 'sequence', items: items.map((v) => (v === null ? null : String(v))), style, alt: `${cap(style)} in a row: ${desc.join(', ')}.` }
}

export function fracFig(shape: FracShape, parts: number, shaded: number): Fig {
  return { kind: 'fraction', shape, parts, shaded, alt: `A ${shape} cut into ${parts} equal parts with ${shaded} ${shaded === 1 ? 'part' : 'parts'} shaded.` }
}

export const ANIMALS: readonly { icon: IconName; name: string }[] = [
  { icon: 'cat', name: 'cat' }, { icon: 'dog', name: 'dog' }, { icon: 'rabbit', name: 'rabbit' }, { icon: 'duck', name: 'duck' },
  { icon: 'frog', name: 'frog' }, { icon: 'mouse', name: 'mouse' }, { icon: 'chick', name: 'chick' }, { icon: 'cow', name: 'cow' },
  { icon: 'lion', name: 'lion' }, { icon: 'monkey', name: 'monkey' }, { icon: 'turtle', name: 'turtle' }, { icon: 'penguin', name: 'penguin' },
  { icon: 'owl', name: 'owl' }, { icon: 'elephant', name: 'elephant' }, { icon: 'snail', name: 'snail' }, { icon: 'bee', name: 'bee' },
]

export const THINGS: readonly { icon: IconName; name: string }[] = [
  { icon: 'ball', name: 'ball' }, { icon: 'car', name: 'car' }, { icon: 'book', name: 'book' }, { icon: 'cup', name: 'cup' },
  { icon: 'hat', name: 'hat' }, { icon: 'bag', name: 'bag' }, { icon: 'kite', name: 'kite' }, { icon: 'boat', name: 'boat' },
  { icon: 'bus', name: 'bus' }, { icon: 'umbrella', name: 'umbrella' }, { icon: 'clock', name: 'clock' }, { icon: 'shoe', name: 'shoe' },
]

export type ShapeKey = 'circle' | 'oval' | 'semicircle' | 'triangle' | 'square' | 'rectangle' | 'pentagon' | 'hexagon' | 'octagon'

/** Sifat bangun datar. `sides` menghitung sisi lurus saja. Alt tidak menyebut nama bangun. */
export const SHAPE_INFO: Record<ShapeKey, { sides: number; corners: number; curved: boolean; alt: string; about: string }> = {
  circle: { sides: 0, corners: 0, curved: true, alt: 'A round flat shape with one curved side and no corners.', about: 'A circle is round with one curved side and no corners.' },
  oval: { sides: 0, corners: 0, curved: true, alt: 'A flat shape like a stretched circle, with one curved side and no corners.', about: 'An oval is like a stretched circle with no corners.' },
  semicircle: { sides: 1, corners: 2, curved: true, alt: 'A flat shape with one curved side, one straight side and 2 corners.', about: 'A semicircle is half a circle, with one curved side and one straight side.' },
  triangle: { sides: 3, corners: 3, curved: false, alt: 'A flat shape with 3 straight sides and 3 corners.', about: 'A triangle has 3 straight sides and 3 corners.' },
  square: { sides: 4, corners: 4, curved: false, alt: 'A flat shape with 4 equal straight sides and 4 square corners.', about: 'A square has 4 sides that are all the same length.' },
  rectangle: { sides: 4, corners: 4, curved: false, alt: 'A flat shape with 4 straight sides, 2 long and 2 short, and 4 square corners.', about: 'A rectangle has 2 long sides, 2 short sides and 4 square corners.' },
  pentagon: { sides: 5, corners: 5, curved: false, alt: 'A flat shape with 5 straight sides and 5 corners.', about: 'A pentagon has 5 straight sides.' },
  hexagon: { sides: 6, corners: 6, curved: false, alt: 'A flat shape with 6 straight sides and 6 corners.', about: 'A hexagon has 6 straight sides.' },
  octagon: { sides: 8, corners: 8, curved: false, alt: 'A flat shape with 8 straight sides and 8 corners.', about: 'An octagon has 8 straight sides.' },
}

export function shapeFig(s: ShapeKey): Fig {
  return { kind: 'shape', shape: s, alt: SHAPE_INFO[s].alt }
}

/** Sifat bangun ruang. `flat` menghitung sisi datar. Alt tidak menyebut nama bangun. */
export const SOLID_INFO: Record<Solid, { name: string; flat: number; edges: number; vertices: number; rolls: boolean; alt: string; about: string }> = {
  cube: { name: 'cube', flat: 6, edges: 12, vertices: 8, rolls: false, alt: 'A solid shape with 6 flat square faces, all the same size.', about: 'A cube has 6 square faces that are all the same size.' },
  cuboid: { name: 'cuboid', flat: 6, edges: 12, vertices: 8, rolls: false, alt: 'A solid box shape with 6 flat rectangle faces.', about: 'A cuboid is a box shape with 6 rectangle faces.' },
  sphere: { name: 'sphere', flat: 0, edges: 0, vertices: 0, rolls: true, alt: 'A solid round shape with one curved face and no flat faces.', about: 'A sphere is round all over, like a ball.' },
  cylinder: { name: 'cylinder', flat: 2, edges: 2, vertices: 0, rolls: true, alt: 'A solid shape with 2 flat circle faces and 1 curved face.', about: 'A cylinder has 2 flat circle faces and 1 curved face.' },
  cone: { name: 'cone', flat: 1, edges: 1, vertices: 1, rolls: true, alt: 'A solid shape with 1 flat circle face, 1 curved face and a point at the top.', about: 'A cone has 1 flat circle face, 1 curved face and a point.' },
  'square-pyramid': { name: 'square-based pyramid', flat: 5, edges: 8, vertices: 5, rolls: false, alt: 'A solid shape with a square base and 4 triangle faces that meet at a point.', about: 'A square-based pyramid has a square base and 4 triangle faces.' },
  'triangular-prism': { name: 'triangular prism', flat: 5, edges: 9, vertices: 6, rolls: false, alt: 'A solid shape with 2 triangle faces at the ends and 3 rectangle faces.', about: 'A triangular prism has 2 triangle faces and 3 rectangle faces.' },
}

export function solidFig(s: Solid): Fig {
  return { kind: 'solid', solid: s, alt: SOLID_INFO[s].alt }
}

export const coinOrNote = (v: number): string => (v <= 1000 ? 'coin' : 'note')

export function moneyAlt(items: readonly { value: MoneyValue; count: number }[]): string {
  return `${cap(listAnd(items.map((it) => `${numberWords(it.count)} ${rupiah(it.value)} ${coinOrNote(it.value)}${it.count === 1 ? '' : 's'}`)))}.`
}

export function moneyFig(items: readonly { value: MoneyValue; count: number }[]): Fig {
  return { kind: 'money', items: items.map((i) => ({ value: i.value, count: i.count })), alt: moneyAlt(items) }
}

/** Barang warung dengan harga wajar dalam Rupiah. */
export const SHOP_ITEMS: readonly { name: string; prices: readonly number[] }[] = [
  { name: 'pencil', prices: [1000, 2000, 3000] },
  { name: 'eraser', prices: [1000, 2000] },
  { name: 'ruler', prices: [2000, 3000, 4000] },
  { name: 'notebook', prices: [3000, 4000, 5000] },
  { name: 'banana', prices: [1000, 2000] },
  { name: 'mango', prices: [3000, 4000, 5000] },
  { name: 'bottle of water', prices: [3000, 4000] },
  { name: 'cup of juice', prices: [5000, 6000] },
  { name: 'kite', prices: [5000, 6000, 7000] },
  { name: 'rice cake', prices: [1000, 2000, 3000] },
  { name: 'box of crayons', prices: [6000, 7000, 8000] },
  { name: 'ball', prices: [6000, 7000, 8000] },
]

/** Alt jam analog yang menyebut posisi jarum. Menit harus kelipatan 5. */
export function clockAlt(h: number, m: number): string {
  const hh = ((h + 11) % 12) + 1
  const next = (hh % 12) + 1
  if (m === 0) return `A clock. The short hour hand points to ${hh}. The long minute hand points to 12.`
  return `A clock. The long minute hand points to ${m / 5}. The short hour hand is between ${hh} and ${next}.`
}

export function clockFig(h: number, m: number): Fig {
  return { kind: 'clock', h, m, alt: clockAlt(h, m) }
}

/** Jam 12 jam berikutnya: 12 diikuti 1. */
export const nextHour = (h: number, add = 1): number => ((h - 1 + add) % 12 + 12) % 12 + 1

const SMALL_COUNTABLES = COUNTABLES.filter((c) => ['marble', 'shell', 'button', 'car', 'ball', 'crayon', 'pencil', 'book'].includes(c.icon))
const FOOD = COUNTABLES.filter((c) => ['apple', 'orange', 'banana', 'strawberry', 'cookie', 'muffin', 'sweet', 'egg'].includes(c.icon))

/* -------------------------------------------------------------------------
 * Counting and sequences (Nc), integers (Ni), place value (Np)
 * ---------------------------------------------------------------------- */

const countObjects: Generator = {
  skill: 'm1.count-objects',
  levels: [1, 2, 3, 4],
  generate({ rng, level }) {
    if (level === 3) {
      const picked = rng.sample(COUNTABLES, 3)
      const a = picked[0]!
      const b = picked[1]!
      const c = picked[2]!
      const na = rng.int(5, 12)
      const nb = rng.int(3, 9)
      const figure: Fig = { kind: 'objects', items: [{ icon: a.icon, count: na }, { icon: b.icon, count: nb }], alt: `${cap(plural(na, a.one, a.many))} and ${plural(nb, b.one, b.many)}, mixed together.` }
      if (rng.chance(0.25)) {
        return {
          type: 'numeric',
          prompt: `How many ${c.many} are in the picture?`,
          figure,
          answer: 0,
          hints: ['Look carefully at the whole picture.', `Find the ${c.many}. How many can you see?`, `Check each thing in turn. Is it ${art(c.one)} ${c.one}?`],
          explanation: `There are no ${c.many} in the picture. When there are none, the number is 0.`,
          tip: 'Zero means none at all.',
        }
      }
      const askA = rng.chance(0.5)
      const t = askA ? a : b
      const other = askA ? b : a
      const n = askA ? na : nb
      return {
        type: 'numeric',
        prompt: `How many ${t.many} are there?`,
        figure,
        answer: n,
        hints: [`Only count the ${t.many}.`, `Touch each ${t.one} once. Skip the ${other.many}.`, `Find one ${t.one} and say 1. Then find the next one.`],
        explanation: `There are ${n} ${t.many}. The ${other.many} are not counted.`,
        solution: [
          { say: `Look only at the ${t.many}.`, figure },
          { say: `Count each ${t.one} once.`, show: countList(1, n) },
          { say: `There are ${n} ${t.many}.`, show: String(n) },
        ],
      }
    }
    if (level === 4) {
      if (rng.chance(0.5)) {
        const bucket = rng.pick([5, 10, 20])
        const n = bucket === 5 ? rng.int(4, 6) : bucket === 10 ? rng.int(9, 11) : rng.int(18, 20)
        const thing = rng.pick(COUNTABLES)
        const figure: Fig = { kind: 'objects', items: [{ icon: thing.icon, count: n }], alt: `A group of ${plural(n, thing.one, thing.many)}.` }
        const m = mcqFrom(
          rng,
          `about ${bucket}`,
          [5, 10, 20].filter((b) => b !== bucket).map((b) => ({ value: `about ${b}`, why: b < n ? `There are more than ${b} here.` : `There are fewer than ${b} here.` })),
          3,
        )
        return {
          type: 'mcq',
          prompt: `Look quickly. About how many ${thing.many} are there?`,
          figure,
          ...m,
          hints: ['Do not count every one. Make a good guess.', 'Is it a small group, a middle group or a big group?', 'Think: is it nearer to 5, 10 or 20?'],
          explanation: n === bucket ? `There are exactly ${n} ${thing.many}, so about ${bucket} is a good estimate.` : `There are ${n} ${thing.many}. ${n} is close to ${bucket}, so about ${bucket} is a good estimate.`,
          solution: [
            { say: 'First, make a guess without counting.', figure },
            { say: `Now count to check. There are ${n}.`, show: countList(1, n) },
            { say: n === bucket ? `The guess of about ${bucket} was spot on.` : `${n} is close to ${bucket}.`, show: `about ${bucket}` },
          ],
        }
      }
      const thing = rng.pick(SMALL_COUNTABLES)
      const n = rng.int(8, 18)
      const name = pickName(rng)
      const figure: Fig = { kind: 'objects', items: [{ icon: thing.icon, count: n }], alt: `A pile of ${plural(n, thing.one, thing.many)}.` }
      return {
        type: 'numeric',
        prompt: `${name} counts ${n} ${thing.many} in a line. Then ${name} pushes them into a pile. How many ${thing.many} are in the pile?`,
        figure,
        answer: n,
        hints: [`Did any ${thing.many} go away or come in?`, 'Moving things around does not change how many there are.', `Think about what ${name} counted in the line.`],
        explanation: `Nothing was added or taken away. The ${thing.many} only moved, so there are still ${n}.`,
        tags: ['word-problem'],
      }
    }
    const thing = rng.pick(COUNTABLES)
    const n = level === 1 ? rng.int(3, 10) : rng.int(11, 20)
    const grouped = level === 2 && rng.chance(0.5)
    const figure: Fig = grouped
      ? { kind: 'groups', groups: [10, n - 10], icon: thing.icon, container: 'circle', alt: `${cap(plural(n, thing.one, thing.many))}: 10 in one ring and ${n - 10} in the other ring.` }
      : { kind: 'objects', items: [{ icon: thing.icon, count: n }], alt: `A picture of ${plural(n, thing.one, thing.many)}.` }
    const hints = [
      `Touch each ${thing.one} once as you count.`,
      grouped ? 'One ring has 10 inside. You do not need to count it again.' : `Count from left to right so no ${thing.one} is missed.`,
      grouped ? 'Say 10 for the full ring. Then count on, one for each.' : `Point to the first ${thing.one} and say 1.`,
    ]
    const explanation = grouped
      ? `10 in one ring and ${n - 10} in the other make ${n}.`
      : `Counting each ${thing.one} once gives ${n}. The last number you say tells you how many.`
    const solution: Step[] = grouped
      ? [
          { say: `One ring has 10 ${thing.many}.`, figure },
          { say: 'Count on from 10 for the other ring.', show: countList(10, n) },
          { say: `So there are ${n} ${thing.many}.`, show: `10 + ${n - 10} = ${n}` },
        ]
      : [
          { say: `Touch each ${thing.one} and say one number.`, figure },
          { say: 'Keep counting to the last one.', show: countList(1, n) },
          { say: `The last number you say is ${n}.`, show: String(n) },
        ]
    const prompt = `How many ${thing.many} are there?`
    if (level === 1 && rng.chance(0.3)) {
      const m = mcqFrom(rng, n, [
        { value: n - 1, why: `${n - 1} is one too few. Check that you did not miss one.` },
        { value: n + 1, why: `${n + 1} is one too many. Check that you did not count one twice.` },
      ], 3)
      return { type: 'mcq', prompt, figure, ...m, hints, explanation, solution }
    }
    return { type: 'numeric', prompt, figure, answer: n, hints, explanation, solution }
  },
}

const TEEN_START: Record<number, string> = {
  11: 'It starts with el, like elephant.',
  12: 'It starts with tw, like two.',
  13: 'It starts with thir, like third.',
  15: 'It starts with fif, like fifth.',
  18: 'It starts with eigh and has only one t.',
  20: 'It starts with tw, like two.',
}

const numberNames: Generator = {
  skill: 'm1.number-names',
  levels: [1, 2, 3, 4],
  generate({ rng, level }) {
    if (level === 3) {
      const nums = rng.sample(range(0, 20), 4)
      const pairs = nums.map((n) => [String(n), numberWords(n)] as [string, string])
      return {
        type: 'match',
        prompt: 'Match each number to its word.',
        pairs,
        hints: ['Read each word slowly, sound by sound.', 'Words that end in teen are numbers from 13 to 19.', `Start with ${nums[0]}. Which word says ${nums[0]}?`],
        explanation: `${listAnd(pairs.map(([a, b]) => `${a} is ${b}`))}.`,
      }
    }
    if (level === 4) {
      const n = rng.int(11, 20)
      const w = numberWords(n)
      if (n < 20 && rng.chance(0.4)) {
        return {
          type: 'numeric',
          prompt: `Type the number ${w}.`,
          answer: n,
          hints: [`Say ${w} out loud.`, 'Numbers from 11 to 19 have 1 ten and some ones.', 'Write 1 for the ten first. Then think about the ones.'],
          explanation: `${cap(w)} is 1 ten and ${onesText(n - 10)}, so we write ${n}.`,
        }
      }
      const third = TEEN_START[n] ?? `It starts with ${numberWords(n - 10)}.`
      return {
        type: 'text',
        prompt: `Write ${n} in words.`,
        blanks: [{ answers: [w] }],
        hints: [`Say ${n} out loud slowly.`, n === 20 ? 'Numbers like 20, 30 and 40 end in ty.' : n <= 12 ? 'Listen for each sound as you say it.' : 'Most numbers from 13 to 19 end in teen.', third],
        explanation: `${n} is written ${w}.`,
      }
    }
    const n = level === 1 ? rng.int(0, 10) : rng.int(11, 20)
    const w = numberWords(n)
    const teen = n >= 13 && n <= 19
    const explanation = `${cap(w)} is written ${n}.${n >= 11 && n <= 19 ? ` It is 1 ten and ${onesText(n - 10)}.` : ''}`
    if (rng.chance(0.5)) {
      const ds: { value: number; why: string }[] = []
      if (level === 2 && n % 10 !== 0 && n !== 11) {
        const swap = (n % 10) * 10 + Math.floor(n / 10)
        ds.push({ value: swap, why: `${swap} is ${numberWords(swap)}. ${cap(w)} has 1 ten and ${onesText(n % 10)}.` })
      }
      for (const d of [1, -1, 2]) if (n + d >= 0) ds.push({ value: n + d, why: `${n + d} is ${numberWords(n + d)}.` })
      return {
        type: 'mcq',
        prompt: `Which number is ${w}?`,
        ...mcqFrom(rng, n, ds, 3),
        hints: [`Say ${w} out loud.`, teen ? 'Words that end in teen have 1 ten and some ones.' : 'Count up from 0 until you say the word.', 'Read each number out loud. Which one sounds right?'],
        explanation,
      }
    }
    const ds: { value: string; why: string }[] = []
    if (teen) {
      const ty = (n % 10) * 10
      ds.push({ value: numberWords(ty), why: `${cap(numberWords(ty))} is ${ty}. The word for ${n} ends in teen.` })
    }
    for (const d of [1, -1, 2]) if (n + d >= 0) ds.push({ value: numberWords(n + d), why: `${cap(numberWords(n + d))} is ${n + d}.` })
    return {
      type: 'mcq',
      prompt: `Which word matches ${n}?`,
      ...mcqFrom(rng, w, ds, 3),
      hints: [`Say ${n} out loud.`, teen ? 'Numbers from 13 to 19 end in teen.' : 'Read each word slowly, sound by sound.', 'Read each word out loud. Which one says the number?'],
      explanation,
    }
  },
}

const countOnBack: Generator = {
  skill: 'm1.count-on-back',
  levels: [1, 2, 3, 4],
  generate({ rng, level }) {
    if (level === 1) {
      const more = rng.chance(0.5)
      const n = more ? rng.int(0, 9) : rng.int(1, 10)
      const ans = more ? n + 1 : n - 1
      const figure: Fig = { kind: 'numberline', min: 0, max: 10, step: 1, labels: 'all', marks: [{ at: n }], alt: `A number line from 0 to 10 with ${n} marked.` }
      const hints = [
        more ? '1 more means the next number when you count.' : '1 less means the number just before.',
        `Find ${n} on the number line. Move one step to the ${more ? 'right' : 'left'}.`,
        more ? `Say ${n}. What do you say next?` : `Count up to ${n}. Which number did you say just before it?`,
      ]
      const explanation = more ? `1 more than ${n} is ${ans}. It comes straight after ${n}.` : `1 less than ${n} is ${ans}. It comes just before ${n}.`
      const solution: Step[] = [
        { say: `Find ${n} on the number line.`, figure },
        {
          say: `Move one step to the ${more ? 'right' : 'left'}.`,
          show: `${n} ${more ? '+' : '-'} 1 = ${ans}`,
          figure: { kind: 'numberline', min: 0, max: 10, step: 1, labels: 'all', jumps: [{ from: n, to: ans }], alt: `A jump from ${n} to ${ans} on a number line from 0 to 10.` },
        },
      ]
      const prompt = `What is 1 ${more ? 'more' : 'less'} than ${n}?`
      if (rng.chance(0.4)) {
        const ds = [
          { value: n, why: `${n} is the number you started with.` },
          { value: more ? n + 2 : n - 2, why: 'That is 2 steps away. Move just one step.' },
          { value: more ? n - 1 : n + 1, why: more ? `That is 1 less than ${n}.` : `That is 1 more than ${n}.` },
        ].filter((d) => d.value >= 0)
        return { type: 'mcq', prompt, figure, ...mcqFrom(rng, ans, ds, 3), hints, explanation, solution }
      }
      return { type: 'numeric', prompt, figure, answer: ans, hints, explanation, solution }
    }
    if (level === 2) {
      const dir = rng.pick([1, -1])
      const len = 5
      const start = dir === 1 ? rng.int(0, 20 - (len - 1)) : rng.int(len - 1, 20)
      const nums = range(0, len - 1).map((i) => start + dir * i)
      const gap = rng.int(1, len - 1)
      const ans = nums[gap]!
      const prev = nums[gap - 1]!
      const figure = seqFig(nums.map((v, i) => (i === gap ? null : v)))
      return {
        type: 'numeric',
        prompt: 'Which number is missing?',
        figure,
        answer: ans,
        hints: ['Are the numbers getting bigger or smaller?', dir === 1 ? 'Each stone is 1 more than the one before.' : 'Each stone is 1 less than the one before.', `Look at the stone before the gap. It says ${prev}.`],
        explanation: dir === 1 ? `The numbers count on in ones. After ${prev} comes ${ans}.` : `The numbers count back in ones. Before ${prev} comes ${ans}.`,
        solution: [
          { say: dir === 1 ? 'The numbers get bigger by 1 each time.' : 'The numbers get smaller by 1 each time.', figure },
          { say: `Say the numbers out loud and fill the gap.`, show: nums.join(', ') },
        ],
      }
    }
    if (level === 3) {
      const on = rng.chance(0.5)
      const k = rng.int(2, 5)
      const a = on ? rng.int(0, 20 - k) : rng.int(k, 20)
      const ans = on ? a + k : a - k
      const jumps = range(0, k - 1).map((i) => ({ from: a + (on ? i : -i), to: a + (on ? i + 1 : -i - 1) }))
      return {
        type: 'numberline',
        prompt: `Start at ${a}. Count ${on ? 'on' : 'back'} ${k}. Tap where you land.`,
        min: 0,
        max: 20,
        step: 1,
        answer: ans,
        hints: [`Put your finger on ${a} first.`, on ? 'Count on means jump to the right, one at a time.' : 'Count back means jump to the left, one at a time.', `Make the first jump to ${on ? a + 1 : a - 1}. Keep going until you have made ${k} jumps.`],
        explanation: `Starting at ${a} and counting ${on ? 'on' : 'back'} ${k} lands on ${ans}.`,
        solution: [
          { say: `Start at ${a}.` },
          { say: `Make ${k} jumps of 1.`, show: on ? countList(a, ans) : countList(a, ans), figure: { kind: 'numberline', min: 0, max: 20, step: 1, labels: 'all', jumps, alt: `${k} jumps of 1 from ${a} to ${ans}.` } },
          { say: `You land on ${ans}.`, show: `${a} ${on ? '+' : '-'} ${k} = ${ans}` },
        ],
      }
    }
    const name = pickName(rng)
    const k = rng.int(2, 5)
    if (rng.chance(0.5)) {
      const a = rng.int(2, 14)
      return {
        type: 'numeric',
        prompt: `${name} stands on step ${a}. ${name} goes up ${k} more steps. Which step is ${name} on now?`,
        answer: a + k,
        hints: ['Going up means counting on.', `Start at ${a} and count on ${k}.`, `The first step up is ${a + 1}. Keep counting.`],
        explanation: `Counting on ${k} from ${a} gives ${a + k}.`,
        solution: [{ say: `Start at step ${a}.` }, { say: `Count on ${k} steps.`, show: countList(a, a + k) }, { say: `${name} is on step ${a + k}.`, show: `${a} + ${k} = ${a + k}` }],
        tags: ['word-problem'],
      }
    }
    const a = rng.int(8, 20)
    return {
      type: 'numeric',
      prompt: `A lift is on floor ${a}. It goes down ${k} floors. Which floor is it on now?`,
      answer: a - k,
      hints: ['Going down means counting back.', `Start at ${a} and count back ${k}.`, `One floor down is ${a - 1}. Keep counting back.`],
      explanation: `Counting back ${k} from ${a} gives ${a - k}.`,
      solution: [{ say: `Start at floor ${a}.` }, { say: `Count back ${k} floors.`, show: countList(a, a - k) }, { say: `The lift is on floor ${a - k}.`, show: `${a} - ${k} = ${a - k}` }],
      tags: ['word-problem'],
    }
  },
}

const SKIP_CONTEXTS: readonly { step: number; icon: IconName; container: 'plate' | 'bag' | 'box' | 'basket' | 'circle'; group: string; many: string; min: number; max: number }[] = [
  { step: 2, icon: 'sock', container: 'circle', group: 'pairs of socks', many: 'socks', min: 3, max: 9 },
  { step: 2, icon: 'shoe', container: 'circle', group: 'pairs of shoes', many: 'shoes', min: 3, max: 9 },
  { step: 5, icon: 'sweet', container: 'bag', group: 'bags of 5 sweets', many: 'sweets', min: 3, max: 8 },
  { step: 5, icon: 'cookie', container: 'plate', group: 'plates of 5 cookies', many: 'cookies', min: 3, max: 8 },
  { step: 10, icon: 'crayon', container: 'box', group: 'boxes of 10 crayons', many: 'crayons', min: 3, max: 6 },
  { step: 10, icon: 'pencil', container: 'box', group: 'packs of 10 pencils', many: 'pencils', min: 3, max: 6 },
]

const skipCount: Generator = {
  skill: 'm1.skip-count',
  levels: [1, 2, 3, 4],
  generate({ rng, level }) {
    if (level === 4) {
      const c = rng.pick(SKIP_CONTEXTS)
      const g = rng.int(c.min, c.max)
      const total = g * c.step
      const figure: Fig = { kind: 'groups', groups: Array.from({ length: g }, () => c.step), icon: c.icon, container: c.container, alt: `${g} ${c.group}.` }
      return {
        type: 'numeric',
        prompt: `There are ${g} ${c.group}. Count in ${c.step}s. How many ${c.many} are there?`,
        figure,
        answer: total,
        hints: ['Count the groups first.', `Count in ${c.step}s, one group at a time.`, `The first group is ${c.step}. The next group makes ${c.step * 2}.`],
        explanation: `${g} groups of ${c.step} make ${total}. Counting in ${c.step}s: ${countList(c.step, total, c.step)}.`,
        solution: [
          { say: `There are ${g} groups. Each group has ${c.step}.`, figure },
          { say: `Count in ${c.step}s, touching each group.`, show: countList(c.step, total, c.step) },
          { say: `There are ${total} ${c.many}.`, show: String(total) },
        ],
        tags: ['word-problem'],
      }
    }
    if (level === 2) {
      const fives = rng.chance(0.5)
      const s = fives ? 5 : 2
      const start = fives ? rng.pick([0, 5, 10, 15, 20, 25]) : rng.pick([1, 3, 5, 7, 9])
      const shown = range(0, 3).map((i) => start + s * i)
      const ans = start + s * 4
      const last = shown[3]!
      const figure = seqFig([...shown, null])
      const m = mcqFrom(rng, ans, [
        { value: last + 1, why: `That is 1 more than ${last}. This pattern adds ${s} each time.` },
        { value: ans + s, why: 'That skips a number in the pattern.' },
        { value: ans - 1, why: `Add ${s} to ${last} to find the next number.` },
      ], 3)
      return {
        type: 'mcq',
        prompt: 'What number comes next?',
        figure,
        ...m,
        hints: ['How much bigger is each number than the one before?', `This pattern counts on in ${s}s.`, `The last number is ${last}. Count on ${s} more.`],
        explanation: `The numbers go up in ${s}s. ${last} + ${s} = ${ans}.`,
        solution: [
          { say: `Each number is ${s} more than the one before.`, figure },
          { say: `Add ${s} to ${last}.`, show: `${last} + ${s} = ${ans}` },
        ],
      }
    }
    let s: number
    let nums: number[]
    if (level === 1) {
      s = rng.pick([2, 10])
      const start = s === 2 ? rng.pick([0, 2, 4, 6, 8, 10]) : rng.pick([0, 10, 20, 30, 40])
      nums = range(0, 5).map((i) => start + s * i)
    } else {
      s = rng.pick([2, 5, 10])
      const start = s === 2 ? rng.pick([12, 14, 16, 18, 20]) : s === 5 ? rng.pick([30, 35, 40, 45, 50]) : rng.pick([60, 70, 80, 90, 100])
      nums = range(0, 5).map((i) => start - s * i)
    }
    const up = level === 1
    const gap = rng.int(1, nums.length - 1)
    const ans = nums[gap]!
    const prev = nums[gap - 1]!
    const figure = seqFig(nums.map((v, i) => (i === gap ? null : v)))
    return {
      type: 'numeric',
      prompt: `Count ${up ? 'in' : 'back in'} ${s}s. Which number is missing?`,
      figure,
      answer: ans,
      hints: [up ? 'What is added each time?' : 'Are the numbers getting bigger or smaller?', `These numbers count ${up ? 'on' : 'back'} in ${s}s.`, `Look at the number before the gap: ${prev}. ${up ? 'Add' : 'Take away'} ${s}.`],
      explanation: `The numbers count ${up ? 'on' : 'back'} in ${s}s. ${prev} ${up ? '+' : '-'} ${s} = ${ans}.`,
      solution: [
        { say: `The numbers ${up ? 'go up' : 'go down'} by ${s} each time.`, figure },
        { say: `${up ? 'Add' : 'Take away'} ${s} ${up ? 'to' : 'from'} the number before the gap.`, show: `${prev} ${up ? '+' : '-'} ${s} = ${ans}` },
        { say: 'Say the whole pattern to check.', show: nums.join(', ') },
      ],
    }
  },
}

const oddEven: Generator = {
  skill: 'm1.odd-even',
  levels: [1, 2, 3, 4],
  generate({ rng, level }) {
    if (level === 1) {
      const wantEven = rng.chance(0.5)
      const pool = range(1, 10)
      const target = rng.pick(pool.filter((n) => (n % 2 === 0) === wantEven))
      const others = rng.sample(pool.filter((n) => (n % 2 === 0) !== wantEven), 2)
      return {
        type: 'mcq',
        prompt: `Which number is ${wantEven ? 'even' : 'odd'}?`,
        ...mcqFrom(rng, target, others.map((o) => ({ value: o, why: wantEven ? `${o} is odd. One is left over when you make pairs.` : `${o} is even. It makes pairs with none left over.` })), 3),
        hints: ['Even numbers can be put into pairs with none left over.', 'Even numbers end in 0, 2, 4, 6 or 8.', 'Check each number. Does it end in 0, 2, 4, 6 or 8?'],
        explanation: wantEven ? `${target} is even. ${target} things make pairs with none left over.` : `${target} is odd. Making pairs from ${target} things leaves one on its own.`,
        solution: [
          { say: 'Even numbers end in 0, 2, 4, 6 or 8.' },
          { say: `${target} is ${wantEven ? 'even' : 'odd'}.`, figure: { kind: 'objects', items: [{ icon: 'sock', count: target }], alt: `A picture of ${plural(target, 'sock', 'socks')}.` } },
        ],
      }
    }
    if (level === 2) {
      const evens = rng.sample(range(0, 20).filter((n) => n % 2 === 0), 3)
      const odds = rng.sample(range(1, 19).filter((n) => n % 2 === 1), 3)
      const items = rng.shuffle([...evens.map((n) => ({ text: String(n), group: 1 })), ...odds.map((n) => ({ text: String(n), group: 0 }))])
      const first = items[0]!.text
      return {
        type: 'sort',
        prompt: 'Sort the numbers into odd and even.',
        groups: ['Odd', 'Even'],
        items,
        hints: ['Look at the ones digit of each number.', 'Even numbers end in 0, 2, 4, 6 or 8. The rest are odd.', `Start with ${first}. Does it end in 0, 2, 4, 6 or 8?`],
        explanation: `Even: ${listAnd([...evens].sort((a, b) => a - b).map(String))}. Odd: ${listAnd([...odds].sort((a, b) => a - b).map(String))}.`,
      }
    }
    if (level === 3) {
      const kind = rng.pick(['even', 'odd'] as const)
      const n = rng.int(1, 18)
      const ans = (n + 1) % 2 === (kind === 'even' ? 0 : 1) ? n + 1 : n + 2
      return {
        type: 'numeric',
        prompt: `What is the next ${kind} number after ${n}?`,
        answer: ans,
        hints: [`Count on from ${n}, one number at a time.`, 'Odd and even numbers take turns: odd, even, odd, even.', `Say the number after ${n}. Is it ${kind}?`],
        explanation: `Counting on from ${n}: ${countList(n + 1, ans)}. ${ans} is the next ${kind} number.`,
        solution: [
          { say: `Count on from ${n}.`, show: countList(n, ans) },
          { say: `${ans} ends in ${ans % 10}, so it is ${kind}.`, show: String(ans) },
        ],
      }
    }
    const n = rng.int(5, 15)
    const even = n % 2 === 0
    const name = pickName(rng)
    const pairs = Math.floor(n / 2)
    const correct = even ? `${n} is even. No sock is left over.` : `${n} is odd. One sock is left over.`
    const ds = even
      ? [
          { value: `${n} is odd. One sock is left over.`, why: `${n} socks make ${pairs} pairs with none left over.` },
          { value: `${n} is even. One sock is left over.`, why: 'Even numbers make pairs with none left over.' },
        ]
      : [
          { value: `${n} is even. No sock is left over.`, why: `${n} socks make ${pairs} pairs and 1 sock is left.` },
          { value: `${n} is odd. Two socks are left over.`, why: 'Two socks could make one more pair.' },
        ]
    const figure: Fig = { kind: 'objects', items: [{ icon: 'sock', count: n }], alt: `${n} socks.` }
    return {
      type: 'mcq',
      prompt: `${name} has ${n} socks. ${name} puts them in pairs. Which sentence is true?`,
      figure,
      ...mcqFrom(rng, correct, ds, 3),
      hints: ['Put the socks into pairs, two at a time.', 'An odd number always leaves one sock on its own.', 'Count in 2s. Stop when you reach the last sock.'],
      explanation: even ? `${n} socks make ${pairs} pairs with none left over, so ${n} is even.` : `${n} socks make ${pairs} pairs and 1 sock is left over, so ${n} is odd.`,
      solution: [
        { say: 'Make pairs of socks.', figure: { kind: 'groups', groups: [...Array.from({ length: pairs }, () => 2), ...(even ? [] : [1])], icon: 'sock', container: 'circle', alt: `${pairs} pairs of socks${even ? '' : ' and 1 sock on its own'}.` } },
        { say: even ? 'Every sock has a partner.' : 'One sock has no partner.', show: even ? `${n} is even` : `${n} is odd` },
      ],
      tags: ['word-problem'],
    }
  },
}

const placeValue20: Generator = {
  skill: 'm1.place-value-20',
  levels: [1, 2, 3, 4],
  generate({ rng, level }) {
    const u = rng.int(1, 9)
    const n = 10 + u
    const figure: Fig = { kind: 'basetens', tens: 1, ones: u, alt: `A ten rod and ${u} small ${u === 1 ? 'cube' : 'cubes'}.` }
    const solution: Step[] = [
      { say: 'The rod is 1 ten. That is 10.', figure },
      { say: `Count on ${onesText(u)} from 10.`, show: countList(10, n) },
      { say: `1 ten and ${onesText(u)} make ${n}.`, show: `10 + ${u} = ${n}` },
    ]
    if (level === 1) {
      return {
        type: 'numeric',
        prompt: 'What number is shown?',
        figure,
        answer: n,
        hints: ['A long rod is 10. A small cube is 1.', 'Start at 10 for the rod. Then count on the cubes.', 'Say 10 first. Then count each small cube.'],
        explanation: `1 ten and ${onesText(u)} make ${n}.`,
        solution,
      }
    }
    if (level === 2) {
      const v = rng.int(0, 2)
      if (v === 0) {
        return {
          type: 'numeric',
          prompt: `${n} is 1 ten and ___ ones.`,
          figure,
          answer: u,
          hints: [`Think of ${n} as a ten and some more.`, `The 1 in ${n} means 1 ten.`, `Count on from 10 up to ${n}. How many steps?`],
          explanation: `${n} is 10 and ${u} more, so it is 1 ten and ${onesText(u)}.`,
          solution,
        }
      }
      if (v === 1) {
        return {
          type: 'numeric',
          prompt: `10 + ${u} = ___`,
          answer: n,
          hints: ['A ten and some ones make a teen number.', `Start at 10 and count on ${u}.`, 'Write 1 for the ten. Then write the ones.'],
          explanation: `10 + ${u} = ${n}. That is 1 ten and ${onesText(u)}.`,
          solution,
        }
      }
      return {
        type: 'numeric',
        prompt: `${n} = 10 + ___`,
        answer: u,
        hints: [`Split ${n} into a ten and some ones.`, `What do you add to 10 to make ${n}?`, `Count on from 10 to ${n}. Count the steps.`],
        explanation: `${n} is 10 and ${u} more, so ${n} = 10 + ${u}.`,
        solution,
      }
    }
    if (level === 3) {
      const ds: { value: string; why: string }[] = []
      if (u >= 2) ds.push({ value: `${tensText(u)} and 1 one`, why: `That is ${u * 10 + 1}. The tens and ones are swapped.` })
      ds.push({ value: onesText(u), why: `That is only ${u}. ${n} also has 1 ten.` })
      ds.push(u < 9 ? { value: `1 ten and ${onesText(u + 1)}`, why: `That is ${n + 1}.` } : { value: `1 ten and ${onesText(u - 1)}`, why: `That is ${n - 1}.` })
      return {
        type: 'mcq',
        prompt: `Which shows ${n}?`,
        ...mcqFrom(rng, `1 ten and ${onesText(u)}`, rng.shuffle(ds), 3),
        hints: [`Split ${n} into tens and ones.`, `The 1 in ${n} tells the tens. The ${u} tells the ones.`, `${n} is 10 and some more. How many more?`],
        explanation: `${n} = 10 + ${u}, so it is 1 ten and ${onesText(u)}.`,
        solution,
      }
    }
    // level 4
    const v = rng.int(0, 2)
    if (v === 0) {
      const name = pickName(rng)
      const k = rng.int(1, 9)
      return {
        type: 'numeric',
        prompt: `Pencils come in packs of 10. ${name} has 1 pack and ${plural(k, 'loose pencil', 'loose pencils')}. How many pencils does ${name} have?`,
        answer: 10 + k,
        hints: ['A pack is a ten.', `1 pack is 10 pencils. Then count on the loose ones.`, `Start at 10 and count on ${k}.`],
        explanation: `1 pack of 10 and ${k} more make ${10 + k} pencils.`,
        solution: [
          { say: 'The pack has 10 pencils.', figure: { kind: 'basetens', tens: 1, ones: k, alt: `1 ten and ${onesText(k)}.` } },
          { say: `Count on ${k}.`, show: `10 + ${k} = ${10 + k}` },
        ],
        tags: ['word-problem'],
      }
    }
    const cases: { t: number; o: number }[] = [
      { t: 0, o: rng.int(11, 19) },
      { t: 2, o: 0 },
      { t: 1, o: 10 },
    ]
    const c = rng.pick(cases)
    const total = c.t * 10 + c.o
    const fig: Fig = { kind: 'basetens', tens: c.t, ones: c.o, alt: `${tensText(c.t)} and ${onesText(c.o)}.` }
    return {
      type: 'numeric',
      prompt: `What number do ${tensText(c.t)} and ${onesText(c.o)} make?`,
      figure: fig,
      answer: total,
      hints: ['Each ten is 10. Each one is 1.', c.t === 0 ? 'There are no tens. Count just the ones.' : 'Count the tens in 10s, then count on the ones.', c.o === 10 ? '10 ones can be swapped for 1 ten.' : c.o === 0 ? 'There are no ones to add.' : `Count the ones from 1 to ${c.o}.`],
      explanation: c.o === 10 ? `10 ones make 1 more ten. 1 ten and 1 ten make 20.` : `${tensText(c.t)} and ${onesText(c.o)} make ${total}.`,
      solution: [
        { say: 'Count the tens, then the ones.', figure: fig },
        { say: `${c.t * 10} and ${c.o} make ${total}.`, show: `${c.t * 10} + ${c.o} = ${total}` },
      ],
    }
  },
}

const compareOrder: Generator = {
  skill: 'm1.compare-order',
  levels: [1, 2, 3, 4],
  generate({ rng, level }) {
    if (level === 1) {
      const picked = rng.sample(COUNTABLES.filter((c) => c.many !== 'fish'), 2)
      const a = picked[0]!
      const b = picked[1]!
      const same = rng.chance(0.2)
      const na = rng.int(3, 10)
      const nb = same ? na : rng.pick(range(2, 10).filter((x) => x !== na))
      const figure: Fig = { kind: 'objects', items: [{ icon: a.icon, count: na }, { icon: b.icon, count: nb }], alt: `${cap(plural(na, a.one, a.many))} and ${plural(nb, b.one, b.many)}.` }
      const correct = same ? 'The same number' : na > nb ? `More ${a.many}` : `More ${b.many}`
      const all = [
        { value: `More ${a.many}`, why: same ? `There are ${na} of each.` : `There are ${na} ${a.many} and ${nb} ${b.many}.` },
        { value: `More ${b.many}`, why: same ? `There are ${na} of each.` : `There are ${nb} ${b.many} and ${na} ${a.many}.` },
        { value: 'The same number', why: `${na} and ${nb} are not the same.` },
      ].filter((d) => d.value !== correct)
      return {
        type: 'mcq',
        prompt: `Are there more ${a.many} or more ${b.many}?`,
        figure,
        ...mcqFrom(rng, correct, all, 3),
        hints: [`Count the ${a.many}. Then count the ${b.many}.`, 'The bigger number means more.', `Count the ${a.many} first and remember the number.`],
        explanation: same ? `There are ${na} ${a.many} and ${nb} ${b.many}. That is the same number.` : `There are ${na} ${a.many} and ${nb} ${b.many}. ${Math.max(na, nb)} is more than ${Math.min(na, nb)}.`,
      }
    }
    if (level === 2) {
      const nums = rng.sample(range(0, 20), 3)
      const greatest = rng.chance(0.5)
      const sorted = [...nums].sort((x, y) => x - y)
      const ans = greatest ? sorted[2]! : sorted[0]!
      const others = nums.filter((v) => v !== ans)
      return {
        type: 'mcq',
        prompt: `Which number is the ${greatest ? 'greatest' : 'smallest'}?`,
        ...mcqFrom(rng, ans, others.map((o) => ({ value: o, why: greatest ? `${o} is less than ${ans}.` : `${o} is more than ${ans}.` })), 3),
        hints: [greatest ? 'Greatest means the biggest number.' : 'Smallest means the least.', 'Numbers further along the number line are bigger.', `Compare two numbers first. Keep the ${greatest ? 'bigger' : 'smaller'} one.`],
        explanation: greatest ? `${ans} comes after ${listAnd(others.sort((x, y) => x - y).map(String))} when you count, so it is the greatest.` : `${ans} comes before ${listAnd(others.sort((x, y) => x - y).map(String))} when you count, so it is the smallest.`,
      }
    }
    if (level === 3) {
      if (rng.chance(0.65)) {
        const nums = rng.sample(range(0, 20), 4).sort((x, y) => x - y)
        return {
          type: 'order',
          prompt: 'Put the numbers in order. Start with the smallest.',
          items: nums.map(String),
          hints: ['Find the smallest number first.', 'Smaller numbers come first when you count.', 'Which of these numbers would you say first when counting from 0?'],
          explanation: `From smallest to greatest: ${nums.join(', ')}.`,
          solution: [
            { say: 'Find each number on a number line.', figure: { kind: 'numberline', min: 0, max: 20, step: 1, labels: 'all', marks: nums.map((v) => ({ at: v })), alt: `A number line from 0 to 20 with ${listAnd(nums.map(String))} marked.` } },
            { say: 'Read them from left to right.', show: nums.join(', ') },
          ],
        }
      }
      const a = rng.int(1, 19)
      return {
        type: 'numberline',
        prompt: `Tap the number between ${a - 1} and ${a + 1}.`,
        min: 0,
        max: 20,
        step: 1,
        answer: a,
        hints: [`Find ${a - 1} on the line first.`, 'Between means in the middle of the two numbers.', `Move one step on from ${a - 1}.`],
        explanation: `${a} comes after ${a - 1} and before ${a + 1}, so it is between them.`,
      }
    }
    if (rng.chance(0.6)) {
      const nums = rng.sample(range(0, 20), 5).sort((x, y) => y - x)
      return {
        type: 'order',
        prompt: 'Put the numbers in order. Start with the greatest.',
        items: nums.map(String),
        hints: ['Find the greatest number first.', 'Greater numbers come later when you count.', 'Look at the tens first. Numbers with 1 ten are bigger than numbers with none.'],
        explanation: `From greatest to smallest: ${nums.join(', ')}.`,
      }
    }
    const x = rng.int(2, 12)
    const y = x + rng.int(3, 6)
    const inside = rng.int(x + 1, y - 1)
    const outside = rng.pick([y + 1, y + 2, Math.max(0, x - 1)].filter((v) => v !== inside && v !== x))
    return {
      type: 'mcq',
      prompt: `Which number is between ${x} and ${y}?`,
      ...mcqFrom(rng, inside, [
        { value: x, why: `${x} is one of the end numbers. It is not between them.` },
        { value: outside, why: outside > y ? `${outside} is more than ${y}.` : `${outside} is less than ${x}.` },
      ], 3),
      hints: [`Find ${x} and ${y} on a number line.`, `A number between them is more than ${x} and less than ${y}.`, `Count on from ${x}. Stop before ${y}.`],
      explanation: `${inside} is more than ${x} and less than ${y}, so it is between them.`,
    }
  },
}

const ordinalNumbers: Generator = {
  skill: 'm1.ordinal',
  levels: [1, 2, 3, 4],
  generate({ rng, level }) {
    if (level === 4) {
      const [a, b] = twoNames(rng)
      if (rng.chance(0.5)) {
        const p = rng.int(3, 10)
        return {
          type: 'numeric',
          prompt: `${a} is ${ordinal(p)} in the queue. How many children are in front of ${a}?`,
          answer: p - 1,
          hints: ['Draw the queue with dots.', `The children in front are 1st, 2nd and so on, up to the child just before ${a}.`, `Start with the 1st child and count up to the child before ${a}.`],
          explanation: `${a} is ${ordinal(p)}, so the children in places 1st to ${ordinal(p - 1)} are in front. That is ${p - 1} children.`,
          solution: [
            { say: `Draw ${p} dots for the queue. ${a} is dot number ${p}.`, figure: { kind: 'sequence', items: [...range(1, p - 1).map((i) => ordinal(i)), a.slice(0, 12)], style: 'circles', alt: `A queue: ${listAnd(range(1, p - 1).map((i) => ordinal(i)))}, then ${a}.` } },
            { say: `Count the dots before ${a}.`, show: `${p} - 1 = ${p - 1}` },
          ],
          tags: ['word-problem'],
        }
      }
      const p = rng.int(1, 9)
      return {
        type: 'text',
        prompt: `${a} finishes ${ordinal(p)} in a race. ${b} finishes just after ${a}. In which place does ${b} finish?`,
        blanks: [{ answers: [ordinal(p + 1), ordinalWord(p + 1)] }],
        hints: ['Just after means the very next place.', `Count on one place from where ${a} finished.`, `${a} is ${ordinal(p)}. Which place comes next?`],
        explanation: `The place after ${ordinal(p)} is ${ordinal(p + 1)}, so ${b} finishes ${ordinal(p + 1)}.`,
        tags: ['word-problem'],
      }
    }
    const len = level === 3 ? rng.int(7, 8) : 5
    const line = rng.sample(ANIMALS, len)
    const figure: Fig = { kind: 'icons', items: line.map((x) => ({ icon: x.icon, label: x.name })), alt: `A line of animals from left to right: ${line.map((x) => x.name).join(', ')}.` }
    const askAnimal = rng.chance(0.5)
    const p = level === 3 ? rng.int(4, len) : rng.int(askAnimal ? 2 : 1, len)
    const target = line[p - 1]!
    const named = (i: number) => `${ordinal(i)} ${line[i - 1]!.name}`
    const explanation = p === 1
      ? `The ${target.name} is on the far left, so it is 1st.`
      : `Counting from the left: ${range(1, Math.min(p, 4)).map(named).join(', ')}${p > 4 ? ' and so on' : ''}. The ${target.name} is ${ordinal(p)}.`
    const hints = ['Start counting from the left.', 'Point to each animal in turn and say its place.', 'Put your finger on the animal on the far left to start.']
    if (askAnimal) {
      const ds = [p - 1, p + 1, p + 2, p - 2].filter((q) => q >= 1 && q <= len).map((q) => ({ value: line[q - 1]!.name, why: `The ${line[q - 1]!.name} is ${ordinal(q)}. Count again from the left.` }))
      const word = level === 3 && rng.chance(0.5) ? ordinalWord(p) : ordinal(p)
      return {
        type: 'mcq',
        prompt: `The animals are in a line. The 1st animal is on the left. Which animal is ${word}?`,
        figure,
        ...mcqFrom(rng, target.name, ds, 3),
        hints,
        explanation,
      }
    }
    if (level === 2 || level === 3) {
      return {
        type: 'text',
        prompt: `Count from the left. The ${target.name} is ___ in the line.`,
        figure,
        blanks: [{ answers: [ordinal(p), ordinalWord(p)] }],
        hints,
        explanation,
      }
    }
    const ds = [p - 1, p + 1, p + 2, p - 2].filter((q) => q >= 1 && q <= len).map((q) => ({ value: ordinal(q), why: `The ${ordinal(q)} animal is the ${line[q - 1]!.name}.` }))
    return {
      type: 'mcq',
      prompt: `The 1st animal is on the left. Where is the ${target.name}?`,
      figure,
      ...mcqFrom(rng, ordinal(p), ds, 3),
      hints,
      explanation,
    }
  },
}

const numberBonds10: Generator = {
  skill: 'm1.number-bonds-10',
  levels: [1, 2, 3, 4],
  generate({ rng, level }) {
    if (level === 1) {
      const k = rng.int(1, 9)
      const figure = frame(k, 5, `A ten frame with ${k} of the 10 boxes filled.`)
      return {
        type: 'numeric',
        prompt: 'How many more counters make 10?',
        figure,
        answer: 10 - k,
        hints: ['A full ten frame has 10 boxes.', 'Count the empty boxes.', `There are ${k} counters. Count on from ${k} to 10.`],
        explanation: `${k} and ${10 - k} make 10.`,
        solution: [
          { say: `There are ${k} counters.`, figure },
          { say: `Count on from ${k} to 10.`, show: countList(k, 10) },
          { say: `${10 - k} more make 10.`, show: `${k} + ${10 - k} = 10` },
        ],
      }
    }
    if (level === 2) {
      const a = rng.int(0, 10)
      const front = rng.chance(0.5)
      const withFrame = rng.chance(0.5)
      return {
        type: 'numeric',
        prompt: front ? `${a} + ___ = 10` : `___ + ${a} = 10`,
        ...(withFrame ? { figure: frame(a, 5, `A ten frame with ${a} of the 10 boxes filled.`) } : {}),
        answer: 10 - a,
        hints: ['Think of pairs that make 10.', 'Use a ten frame or your fingers.', `Start at ${a} and count on to 10.`],
        explanation: `${a} and ${10 - a} make 10.`,
        solution: [
          { say: `Show ${a} on a ten frame.`, figure: frame(a, 5, `A ten frame with ${a} boxes filled.`) },
          { say: 'Count the empty boxes.', show: front ? `${a} + ${10 - a} = 10` : `${10 - a} + ${a} = 10` },
        ],
      }
    }
    if (level === 3) {
      const lefts: number[] = []
      for (const v of rng.shuffle(range(1, 9))) {
        if (lefts.length === 4) break
        if (!lefts.includes(10 - v) && !lefts.includes(v)) lefts.push(v)
      }
      const pairs = lefts.map((v) => [String(v), String(10 - v)] as [string, string])
      return {
        type: 'match',
        prompt: 'Match each number to its partner to make 10.',
        pairs,
        hints: ['Each pair must add up to 10.', 'Show one number on your fingers. Count the fingers that are down.', `Start with ${lefts[0]}. What do you add to ${lefts[0]} to make 10?`],
        explanation: `${listAnd(lefts.map((v) => `${v} + ${10 - v}`))} each make 10.`,
      }
    }
    const v = rng.int(0, 2)
    const name = pickName(rng)
    if (v === 0) {
      const k = rng.int(2, 9)
      return {
        type: 'numeric',
        prompt: `A bus has 10 seats. ${k} children sit down. How many seats are empty?`,
        figure: frame(k, 5, `10 seats in 2 rows of 5. ${k} seats are taken.`),
        answer: 10 - k,
        hints: ['Think of 10 as the whole bus.', `What goes with ${k} to make 10?`, `Count on from ${k} to 10.`],
        explanation: `${k} and ${10 - k} make 10, so ${10 - k} seats are empty.`,
        tags: ['word-problem'],
      }
    }
    if (v === 1) {
      const k = rng.int(1, 8)
      return {
        type: 'numeric',
        prompt: `${name} needs 10 stickers for a card. ${name} has ${k}. How many more does ${name} need?`,
        answer: 10 - k,
        hints: ['You need the pair that makes 10.', `What goes with ${k} to make 10?`, `Count on from ${k} to 10 on your fingers.`],
        explanation: `${k} + ${10 - k} = 10, so ${name} needs ${10 - k} more.`,
        tags: ['word-problem'],
      }
    }
    const t = rng.int(6, 9)
    const a = rng.int(1, t - 2)
    return {
      type: 'numeric',
      prompt: `${t} = ${a} + ___`,
      figure: { kind: 'objects', items: [{ icon: 'dot', count: a }], alt: `A row of ${plural(a, 'dot', 'dots')}.` },
      answer: t - a,
      hints: [`Think: ${a} and how many more make ${t}?`, `Start at ${a} and count on to ${t}.`, `Count on from ${a}: ${a + 1} is one more.`],
      explanation: `${a} and ${t - a} make ${t}.`,
      solution: [
        { say: `Start at ${a}.` },
        { say: `Count on to ${t}.`, show: countList(a, t) },
        { say: `That is ${t - a} more.`, show: `${t} = ${a} + ${t - a}` },
      ],
    }
  },
}

const addWithin20: Generator = {
  skill: 'm1.add-within-20',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const name = pickName(rng)
    if (level === 1) {
      const thing = rng.pick(COUNTABLES)
      const a = rng.int(2, 6)
      const b = rng.int(2, 10 - a)
      const sum = a + b
      const figure: Fig = { kind: 'objects', items: [{ icon: thing.icon, count: a }, { icon: thing.icon, count: b }], alt: `A group of ${plural(a, thing.one, thing.many)} and a group of ${plural(b, thing.one, thing.many)}.` }
      return {
        type: 'numeric',
        prompt: `${name} has ${a} ${thing.many}. ${name} gets ${b} more. How many ${thing.many} does ${name} have now?`,
        figure,
        answer: sum,
        hints: ['Count all of them together.', `Start at ${a} and count on ${b} more.`, `Say ${a}. Then count on: ${a + 1} is one more.`],
        explanation: `${a} and ${b} more make ${sum}.`,
        solution: [
          { say: `Start with ${a}.`, figure },
          { say: `Count on ${b}.`, show: countList(a, sum) },
          { say: `${name} has ${sum} now.`, show: `${a} + ${b} = ${sum}` },
        ],
        tags: ['word-problem'],
      }
    }
    if (level === 2) {
      const a = rng.int(10, 15)
      const b = rng.int(2, Math.min(5, 20 - a))
      const sum = a + b
      const jumps = range(0, b - 1).map((i) => ({ from: a + i, to: a + i + 1 }))
      if (rng.chance(0.5)) {
        return {
          type: 'numberline',
          prompt: `Start at ${a}. Jump on ${b}. Tap where you land.`,
          min: 0,
          max: 20,
          step: 1,
          answer: sum,
          hints: [`Find ${a} first.`, 'Each jump moves one step to the right.', `The first jump lands on ${a + 1}. Keep going.`],
          explanation: `${a} + ${b} = ${sum}. Counting on ${b} from ${a} lands on ${sum}.`,
          solution: [
            { say: `Start at ${a} and make ${b} jumps.`, figure: { kind: 'numberline', min: 0, max: 20, step: 1, labels: 'all', jumps, alt: `${b} jumps of 1 from ${a} to ${sum}.` } },
            { say: `You land on ${sum}.`, show: `${a} + ${b} = ${sum}` },
          ],
        }
      }
      return {
        type: 'numeric',
        prompt: `${a} + ${b} = ___`,
        answer: sum,
        hints: ['Start with the bigger number.', `Count on ${b} from ${a}.`, `${a} + 1 = ${a + 1}. Keep counting on.`],
        explanation: `Counting on ${b} from ${a} gives ${sum}.`,
        solution: [
          { say: `Start at ${a}.` },
          { say: `Count on ${b}.`, show: countList(a, sum) },
          { say: `So ${a} + ${b} = ${sum}.`, show: `${a} + ${b} = ${sum}` },
        ],
      }
    }
    if (level === 3) {
      const a = rng.int(6, 9)
      const b = rng.int(11 - a, 9)
      const sum = a + b
      const toTen = 10 - a
      const rest = b - toTen
      const figure: Fig = { kind: 'numberline', min: 0, max: 20, step: 1, labels: 'all', jumps: [{ from: a, to: 10, label: `+${toTen}` }, { from: 10, to: sum, label: `+${rest}` }], alt: `A jump from ${a} to 10, then a jump from 10 to ${sum}.` }
      return {
        type: 'numeric',
        prompt: `${a} + ${b} = ___`,
        answer: sum,
        hints: ['Can you make 10 first?', `Split ${b} into ${toTen} and ${rest}.`, `${a} + ${toTen} = 10. Now add the rest.`],
        explanation: `${a} + ${toTen} = 10, and 10 + ${rest} = ${sum}. So ${a} + ${b} = ${sum}.`,
        solution: [
          { say: `Split ${b} into ${toTen} and ${rest}.`, show: `${b} = ${toTen} + ${rest}` },
          { say: `${a} + ${toTen} makes 10.`, show: `${a} + ${toTen} = 10` },
          { say: `Then add ${rest} more.`, show: `10 + ${rest} = ${sum}`, figure },
        ],
        tip: 'Making 10 first makes adding easier.',
      }
    }
    if (level === 4) {
      if (rng.chance(0.5)) {
        const a = rng.int(5, 12)
        const s = rng.int(a + 2, 20)
        return {
          type: 'numeric',
          prompt: `${a} + ___ = ${s}`,
          answer: s - a,
          hints: [`What do you add to ${a} to make ${s}?`, `Count on from ${a} to ${s}.`, `Count on from ${a} and keep track on your fingers.`],
          explanation: `Counting on from ${a} to ${s} takes ${s - a} steps, so ${a} + ${s - a} = ${s}.`,
          solution: [
            { say: `Start at ${a}.` },
            { say: `Count on to ${s} and count the jumps.`, show: countList(a, s) },
            { say: `That is ${s - a} jumps.`, show: `${a} + ${s - a} = ${s}` },
          ],
        }
      }
      const x = rng.int(1, 9)
      const z = 10 - x
      const y = rng.int(2, 9)
      const order = rng.shuffle([x, y, z])
      const sum = x + y + z
      return {
        type: 'numeric',
        prompt: `${order.join(' + ')} = ___`,
        answer: sum,
        hints: ['Look for two numbers that make 10.', `${x} and ${z} make 10.`, `Add ${x} and ${z} first. Then add ${y}.`],
        explanation: `${x} + ${z} = 10, and 10 + ${y} = ${sum}.`,
        solution: [
          { say: `Find a pair that makes 10.`, show: `${x} + ${z} = 10` },
          { say: `Add the last number.`, show: `10 + ${y} = ${sum}` },
        ],
      }
    }
    // level 5
    if (rng.chance(0.5)) {
      const thing = rng.pick(SMALL_COUNTABLES)
      const a = rng.int(4, 9)
      const b = rng.int(2, 6)
      const c = rng.int(2, Math.max(2, 20 - a - b))
      const sum = a + b + c
      return {
        type: 'numeric',
        prompt: `${name} has ${a} ${thing.many}. ${name} gets ${b} more. Then ${name} gets ${c} more. How many ${thing.many} now?`,
        answer: sum,
        hints: ['There are three numbers to add.', `Add ${a} and ${b} first.`, `${a} + ${b} = ${a + b}. Now add ${c}.`],
        explanation: `${a} + ${b} = ${a + b}, then ${a + b} + ${c} = ${sum}.`,
        solution: [
          { say: `First add ${a} and ${b}.`, show: `${a} + ${b} = ${a + b}` },
          { say: `Then add ${c}.`, show: `${a + b} + ${c} = ${sum}` },
        ],
        tags: ['word-problem'],
      }
    }
    const [p, q] = twoNames(rng)
    const a = rng.int(5, 12)
    const more = rng.int(2, 20 - a)
    return {
      type: 'numeric',
      prompt: `${p} has ${a} marbles. ${q} has ${more} more marbles than ${p}. How many marbles does ${q} have?`,
      answer: a + more,
      hints: [`${q} has more, so add.`, `Start at ${a} and count on ${more}.`, `${a} + ${more} gives the number for ${q}.`],
      explanation: `${q} has ${more} more than ${a}, so ${a} + ${more} = ${a + more}.`,
      solution: [
        { say: `${p} has ${a}.`, figure: { kind: 'bars', categories: [p, q], values: [a, a + more], step: 2, yLabel: 'Marbles', alt: `${p} has ${a} marbles. ${q} has ${more} more.` } },
        { say: `Add ${more} to ${a}.`, show: `${a} + ${more} = ${a + more}` },
      ],
      tags: ['word-problem'],
    }
  },
}

const TAKE_AWAY: readonly { icon: IconName; many: string; start: (n: number) => string; go: (k: number) => string }[] = [
  { icon: 'bird', many: 'birds', start: (n) => `${n} birds sit on a fence.`, go: (k) => `${k} fly away.` },
  { icon: 'balloon', many: 'balloons', start: (n) => `There are ${n} balloons at a party.`, go: (k) => `${k} pop.` },
  { icon: 'fish', many: 'fish', start: (n) => `${n} fish swim in a pond.`, go: (k) => `${k} swim away.` },
  { icon: 'duck', many: 'ducks', start: (n) => `${n} ducks are on the grass.`, go: (k) => `${k} go into the water.` },
  { icon: 'cookie', many: 'cookies', start: (n) => `There are ${n} cookies on a plate.`, go: (k) => `${k} are eaten.` },
]

const subtractWithin20: Generator = {
  skill: 'm1.subtract-within-20',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level === 1) {
      const c = rng.pick(TAKE_AWAY)
      const a = rng.int(4, 10)
      const k = rng.int(2, a - 1)
      const left = a - k
      const figure: Fig = { kind: 'objects', items: [{ icon: c.icon, count: a, crossed: k }], alt: `${a} ${c.many}. ${k} of them are crossed out.` }
      return {
        type: 'numeric',
        prompt: `${c.start(a)} ${c.go(k)} How many are left?`,
        figure,
        answer: left,
        hints: ['Take away means some go away.', `Cover ${k} of the ${a}. Count the rest.`, `Start at ${a} and count back ${k}.`],
        explanation: `${a} take away ${k} leaves ${left}.`,
        solution: [
          { say: `There are ${a} at the start.`, figure },
          { say: `${k} go away. Count the ones left.`, show: `${a} - ${k} = ${left}` },
        ],
        tags: ['word-problem'],
      }
    }
    if (level === 2) {
      const a = rng.int(11, 20)
      const k = rng.int(2, 5)
      const ans = a - k
      const jumps = range(0, k - 1).map((i) => ({ from: a - i, to: a - i - 1 }))
      return {
        type: 'numberline',
        prompt: `Start at ${a}. Count back ${k}. Tap where you land.`,
        min: 0,
        max: 20,
        step: 1,
        answer: ans,
        hints: [`Find ${a} on the line first.`, 'Counting back means jumping to the left.', `The first jump back lands on ${a - 1}. Keep going.`],
        explanation: `${a} - ${k} = ${ans}. Counting back ${k} from ${a} lands on ${ans}.`,
        solution: [
          { say: `Start at ${a}. Make ${k} jumps back.`, figure: { kind: 'numberline', min: 0, max: 20, step: 1, labels: 'all', jumps, alt: `${k} jumps back from ${a} to ${ans}.` } },
          { say: `You land on ${ans}.`, show: `${a} - ${k} = ${ans}` },
        ],
      }
    }
    if (level === 3) {
      const a = rng.int(11, 18)
      const toTen = a - 10
      const b = rng.int(toTen + 1, 9)
      const ans = a - b
      const rest = b - toTen
      const figure: Fig = { kind: 'numberline', min: 0, max: 20, step: 1, labels: 'all', jumps: [{ from: a, to: 10, label: `-${toTen}` }, { from: 10, to: ans, label: `-${rest}` }], alt: `A jump back from ${a} to 10, then a jump back from 10 to ${ans}.` }
      return {
        type: 'numeric',
        prompt: `${a} - ${b} = ___`,
        answer: ans,
        hints: ['Can you jump back to 10 first?', `Split ${b} into ${toTen} and ${rest}.`, `${a} - ${toTen} = 10. Now take away the rest.`],
        explanation: `${a} - ${toTen} = 10, and 10 - ${rest} = ${ans}. So ${a} - ${b} = ${ans}.`,
        solution: [
          { say: `Split ${b} into ${toTen} and ${rest}.`, show: `${b} = ${toTen} + ${rest}` },
          { say: `Jump back to 10.`, show: `${a} - ${toTen} = 10` },
          { say: `Then take away ${rest} more.`, show: `10 - ${rest} = ${ans}`, figure },
        ],
      }
    }
    if (level === 4) {
      if (rng.chance(0.5)) {
        const a = rng.int(10, 20)
        const k = rng.int(2, a - 3)
        const c = a - k
        return {
          type: 'numeric',
          prompt: `${a} - ___ = ${c}`,
          answer: k,
          hints: [`How many do you take from ${a} to leave ${c}?`, `Count on from ${c} up to ${a}.`, `Start at ${c}. Count on and keep track on your fingers.`],
          explanation: `From ${c} to ${a} is ${k} steps, so ${a} - ${k} = ${c}.`,
          solution: [
            { say: `Count on from ${c} to ${a}.`, show: countList(c, a) },
            { say: `That is ${k} steps.`, show: `${a} - ${k} = ${c}` },
          ],
        }
      }
      const [p, q] = twoNames(rng)
      const a = rng.int(9, 18)
      const b = rng.int(3, a - 2)
      return {
        type: 'numeric',
        prompt: `${p} has ${a} stickers. ${q} has ${b} stickers. How many more stickers does ${p} have?`,
        figure: { kind: 'bars', categories: [p, q], values: [a, b], step: 2, yLabel: 'Stickers', horizontal: true, alt: `${p} has ${a} stickers. ${q} has ${b} stickers.` },
        answer: a - b,
        hints: ['How many more means find the difference.', `Count on from ${b} up to ${a}.`, `Start at ${b}. How many jumps to reach ${a}?`],
        explanation: `From ${b} to ${a} is ${a - b}, so ${p} has ${a - b} more. ${a} - ${b} = ${a - b}.`,
        solution: [
          { say: `Compare ${a} and ${b}.` },
          { say: `Count on from ${b} to ${a}.`, show: countList(b, a) },
          { say: `The difference is ${a - b}.`, show: `${a} - ${b} = ${a - b}` },
        ],
        tags: ['word-problem'],
      }
    }
    const a = rng.int(12, 20)
    const b = rng.int(2, 6)
    const c = rng.int(2, Math.min(6, a - b - 1))
    const ans = a - b - c
    return {
      type: 'numeric',
      prompt: `There are ${a} children on a bus. ${b} get off. Then ${c} more get off. How many children are on the bus now?`,
      answer: ans,
      hints: ['Two groups get off, so take away twice.', `First work out ${a} - ${b}.`, `${a} - ${b} = ${a - b}. Now take away ${c}.`],
      explanation: `${a} - ${b} = ${a - b}, then ${a - b} - ${c} = ${ans}.`,
      solution: [
        { say: `First ${b} get off.`, show: `${a} - ${b} = ${a - b}` },
        { say: `Then ${c} more get off.`, show: `${a - b} - ${c} = ${ans}` },
      ],
      tags: ['word-problem'],
    }
  },
}

const doubles: Generator = {
  skill: 'm1.doubles',
  levels: [1, 2, 3, 4],
  generate({ rng, level }) {
    const thing = rng.pick(FOOD)
    const groupsFig = (n: number): Fig => ({ kind: 'groups', groups: [n, n], icon: thing.icon, container: 'plate', alt: `2 plates with ${plural(n, thing.one, thing.many)} on each.` })
    if (level === 1 || level === 2) {
      const n = level === 1 ? rng.int(1, 5) : rng.int(6, 10)
      const show = level === 1 || rng.chance(0.5)
      return {
        type: 'numeric',
        prompt: level === 1 ? `What is double ${n}?` : `Double ${n} is ___.`,
        ...(show ? { figure: groupsFig(n) } : {}),
        answer: 2 * n,
        hints: ['Double means two lots of the same number.', `Add ${n} and ${n}.`, `Start at ${n}. Count on ${n} more.`],
        explanation: `Double ${n} is ${n} + ${n} = ${2 * n}.`,
        solution: [
          { say: `Double ${n} means ${n} and ${n} again.`, figure: groupsFig(n) },
          { say: `Count on ${n} from ${n}.`, show: `${n} + ${n} = ${2 * n}` },
        ],
      }
    }
    if (level === 3) {
      const n = rng.int(3, 10)
      if (rng.chance(0.5)) {
        return {
          type: 'mcq',
          prompt: `Which number is double ${n}?`,
          ...mcqFrom(rng, 2 * n, [
            { value: 2 * n - 1, why: `${2 * n - 1} is ${n} + ${n - 1}.` },
            { value: n + 2, why: `${n + 2} is ${n} + 2. Double means add ${n}.` },
            { value: 2 * n + 1, why: `${2 * n + 1} is ${n} + ${n + 1}.` },
          ], 3),
          hints: ['Double means add the number to itself.', `Work out ${n} + ${n}.`, `Start at ${n} and count on ${n}.`],
          explanation: `Double ${n} is ${n} + ${n} = ${2 * n}.`,
        }
      }
      return {
        type: 'numeric',
        prompt: `Double ___ is ${2 * n}.`,
        answer: n,
        hints: [`Which number added to itself makes ${2 * n}?`, `Share ${2 * n} into 2 equal groups.`, 'Try a number. Double it and check.'],
        explanation: `${n} + ${n} = ${2 * n}, so double ${n} is ${2 * n}.`,
        solution: [
          { say: `Share ${2 * n} into 2 equal groups.`, figure: groupsFig(n) },
          { say: `Each group has ${n}.`, show: `${n} + ${n} = ${2 * n}` },
        ],
      }
    }
    if (rng.chance(0.5)) {
      const n = rng.int(3, 9)
      const plus = rng.chance(0.5)
      const b = plus ? n + 1 : n - 1
      return {
        type: 'numeric',
        prompt: `${n} + ${b} = ___`,
        answer: n + b,
        hints: [`${n} and ${b} are close to each other.`, `Use double ${n} to help you.`, `Double ${n} is ${2 * n}. Then ${plus ? 'add 1' : 'take away 1'}.`],
        explanation: `Double ${n} is ${2 * n}, and ${b} is 1 ${plus ? 'more' : 'less'} than ${n}, so ${n} + ${b} = ${n + b}.`,
        solution: [
          { say: `Double ${n} is ${2 * n}.`, show: `${n} + ${n} = ${2 * n}` },
          { say: `${b} is 1 ${plus ? 'more' : 'less'} than ${n}.`, show: `${2 * n} ${plus ? '+' : '-'} 1 = ${n + b}` },
        ],
        tip: 'Near doubles are quick if you know your doubles.',
      }
    }
    const [p, q] = twoNames(rng)
    const n = rng.int(4, 10)
    const t = rng.pick(SMALL_COUNTABLES)
    return {
      type: 'numeric',
      prompt: `${p} has ${n} ${t.many}. ${q} has the same number. How many ${t.many} do they have altogether?`,
      answer: 2 * n,
      hints: ['They both have the same number.', `Double ${n}.`, `${n} + ${n}: start at ${n} and count on ${n}.`],
      explanation: `Double ${n} is ${2 * n}, so they have ${2 * n} ${t.many} altogether.`,
      tags: ['word-problem'],
    }
  },
}

/* -------------------------------------------------------------------------
 * Money (Nm) and fractions (Nf)
 * ---------------------------------------------------------------------- */

const money1: Generator = {
  skill: 'm1.money',
  levels: [1, 2, 3, 4],
  generate({ rng, level }) {
    if (level === 1) {
      const pool: MoneyValue[] = [100, 200, 500, 1000, 2000, 5000, 10000]
      const vals = rng.sample(pool, 3).sort((a, b) => a - b)
      const most = rng.chance(0.6)
      const target = most ? vals[2]! : vals[0]!
      const fig = (v: MoneyValue): Fig => ({ kind: 'money', items: [{ value: v, count: 1 }], alt: `One ${rupiah(v)} ${coinOrNote(v)}.` })
      const others = vals.filter((v) => v !== target)
      return {
        type: 'mcq',
        prompt: `Which is worth the ${most ? 'most' : 'least'}?`,
        ...mcqOpts(rng, { figure: fig(target) }, others.map((v) => ({ figure: fig(v), why: most ? `${rupiah(v)} is worth less than ${rupiah(target)}.` : `${rupiah(v)} is worth more than ${rupiah(target)}.` })), 3),
        hints: ['Read the number on each coin or note.', 'A bigger number is worth more money.', `Compare two of them first. Keep the ${most ? 'bigger' : 'smaller'} one.`],
        explanation: `${rupiah(target)} is worth the ${most ? 'most' : 'least'}. It is ${most ? 'more' : 'less'} than ${listAnd(others.map((v) => rupiah(v)))}.`,
      }
    }
    if (level === 2) {
      const opt = rng.pick([
        { v: 100 as MoneyValue, min: 2, max: 9, hint: 'Count in hundreds, one for each coin.' },
        { v: 1000 as MoneyValue, min: 2, max: 9, hint: 'Count in thousands, one for each coin.' },
        { v: 2000 as MoneyValue, min: 2, max: 5, hint: 'Count in 2 thousands, one for each note.' },
        { v: 5000 as MoneyValue, min: 2, max: 2, hint: 'Count in 5 thousands, one for each note.' },
      ])
      const k = rng.int(opt.min, opt.max)
      const total = opt.v * k
      const figure = moneyFig([{ value: opt.v, count: k }])
      return {
        type: 'numeric',
        prompt: 'How much money is this altogether?',
        figure,
        answer: total,
        unit: 'rupiah',
        hints: [`Each ${coinOrNote(opt.v)} is worth ${rupiah(opt.v)}.`, opt.hint, `Start with ${rupiah(opt.v)} for the first ${coinOrNote(opt.v)}.`],
        explanation: `${k} ${coinOrNote(opt.v)}s of ${rupiah(opt.v)} make ${rupiah(total)}.`,
        solution: [
          { say: `There are ${k} ${coinOrNote(opt.v)}s of ${rupiah(opt.v)}.`, figure },
          { say: 'Count on for each one.', show: range(1, k).map((i) => rupiah(opt.v * i)).join(', ') },
          { say: `That is ${rupiah(total)}.`, show: rupiah(total) },
        ],
      }
    }
    if (level === 3) {
      const values = rng.sample([1000, 2000, 5000, 10000] as MoneyValue[], rng.int(2, 3)).sort((a, b) => b - a)
      const items = values.map((v) => ({ value: v, count: v === 10000 ? 1 : rng.int(1, 2) }))
      let total = items.reduce((s, it) => s + it.value * it.count, 0)
      while (total > 20000) {
        items.shift()
        total = items.reduce((s, it) => s + it.value * it.count, 0)
      }
      const pieces = items.reduce((s, it) => s + it.count, 0)
      const figure = moneyFig(items)
      const parts = items.flatMap((it) => Array.from({ length: it.count }, () => rupiah(it.value)))
      return {
        type: 'mcq',
        prompt: 'How much money is this altogether?',
        figure,
        ...mcqFrom(rng, total, [
          { value: pieces * 1000, why: 'Add the value of each one, not just how many there are.' },
          { value: total + 1000, why: 'Check each coin and note again.' },
          { value: total - 1000, why: 'Check that you added every coin and note.' },
        ], 3, rupiah),
        hints: ['Start with the one worth the most.', `Think in thousands: ${rupiah(items[0]!.value)} is ${items[0]!.value / 1000} thousand.`, `Start at ${rupiah(items[0]!.value)} and add the next one.`],
        explanation: `${parts.join(' + ')} = ${rupiah(total)}.`,
        solution: [
          { say: 'Start with the biggest.', figure },
          { say: 'Add each coin or note in turn.', show: `${parts.join(' + ')} = ${rupiah(total)}` },
        ],
      }
    }
    const name = pickName(rng)
    if (rng.chance(0.5)) {
      const i1 = rng.pick(SHOP_ITEMS)
      const p1 = rng.pick(i1.prices)
      const i2 = rng.pick(SHOP_ITEMS.filter((x) => x !== i1 && x.prices.some((p) => p + p1 <= 12000)))
      const p2 = rng.pick(i2.prices.filter((p) => p + p1 <= 12000))
      return {
        type: 'numeric',
        prompt: `${cap(art(i1.name))} ${i1.name} costs ${rupiah(p1)}. ${cap(art(i2.name))} ${i2.name} costs ${rupiah(p2)}. How much do they cost altogether?`,
        answer: p1 + p2,
        unit: 'rupiah',
        hints: ['Altogether means add the prices.', `Think in thousands: ${p1 / 1000} thousand and ${p2 / 1000} thousand.`, `Start at ${p1 / 1000} thousand and count on ${p2 / 1000} more.`],
        explanation: `${rupiah(p1)} + ${rupiah(p2)} = ${rupiah(p1 + p2)}.`,
        solution: [
          { say: 'Add the two prices in thousands.', show: `${p1 / 1000} + ${p2 / 1000} = ${(p1 + p2) / 1000}` },
          { say: `So they cost ${rupiah(p1 + p2)}.`, show: `${rupiah(p1)} + ${rupiah(p2)} = ${rupiah(p1 + p2)}` },
        ],
        tags: ['word-problem'],
      }
    }
    const item = rng.pick(SHOP_ITEMS.filter((s) => s.prices.some((p) => p <= 8000)))
    const p = rng.pick(item.prices.filter((x) => x <= 8000))
    return {
      type: 'numeric',
      prompt: `${name} has ${rupiah(10000)}. ${name} buys ${art(item.name)} ${item.name} for ${rupiah(p)}. How much money is left?`,
      figure: moneyFig([{ value: 10000, count: 1 }]),
      answer: 10000 - p,
      unit: 'rupiah',
      hints: ['Left means take the price away.', `Think in thousands: 10 thousand take away ${p / 1000} thousand.`, `Count on from ${p / 1000} to 10 in thousands.`],
      explanation: `${rupiah(10000)} - ${rupiah(p)} = ${rupiah(10000 - p)}.`,
      solution: [
        { say: 'Think in thousands.', show: `10 - ${p / 1000} = ${10 - p / 1000}` },
        { say: `So ${rupiah(10000 - p)} is left.`, show: `${rupiah(10000)} - ${rupiah(p)} = ${rupiah(10000 - p)}` },
      ],
      tags: ['word-problem'],
    }
  },
}

const FRAC_SHAPES: readonly FracShape[] = ['bar', 'circle', 'square']

const halves: Generator = {
  skill: 'm1.halves',
  levels: [1, 2, 3, 4],
  generate({ rng, level }) {
    const shape = rng.pick(FRAC_SHAPES)
    if (level === 1) {
      return {
        type: 'fraction',
        prompt: `Shade one half of the ${shape}.`,
        shape,
        parts: 2,
        answer: { num: 1, den: 2 },
        hints: ['Half means one of two equal parts.', `The ${shape} is cut into 2 equal parts.`, 'Count the parts first. Then choose how many to shade.'],
        explanation: 'One half is 1 of 2 equal parts, so shade 1 part.',
        solution: [
          { say: `The ${shape} has 2 equal parts.`, figure: fracFig(shape, 2, 0) },
          { say: 'Shade 1 of the 2 parts.', show: '1 of 2 parts', figure: fracFig(shape, 2, 1) },
        ],
      }
    }
    if (level === 2) {
      if (rng.chance(0.3)) {
        return {
          type: 'text',
          prompt: 'Two halves make one ___.',
          blanks: [{ answers: ['whole'] }],
          hints: ['Think of 2 halves of an orange.', 'Halves are parts of one thing.', 'Put the two halves back together. What do you have?'],
          explanation: 'Two halves fit back together to make one whole.',
          solution: [
            { say: 'Here are 2 halves.', figure: fracFig('circle', 2, 2) },
            { say: 'Together they make the whole circle.', show: '2 halves = 1 whole' },
          ],
        }
      }
      const parts = rng.pick([2, 2, 4])
      const pool: Opt[] = rng.shuffle([
        { figure: fracFig(shape, 3, 1), why: 'This shows 1 of 3 equal parts. That is not a half.' },
        { figure: fracFig(shape, 4, 1), why: 'This shows 1 of 4 equal parts. That is a quarter.' },
        { figure: fracFig(shape, 2, 2), why: 'Both parts are shaded. That is the whole shape.' },
        { figure: fracFig(shape, 4, 3), why: 'This shows 3 of 4 parts. That is more than a half.' },
      ])
      return {
        type: 'mcq',
        prompt: 'Which shape has one half shaded?',
        ...mcqOpts(rng, { figure: fracFig(shape, parts, parts / 2) }, pool, 3),
        hints: ['Half means 2 equal parts, with 1 part shaded.', 'The shaded part and the white part must be the same size.', 'Look at each shape. Is the shaded part the same as the white part?'],
        explanation: parts === 2 ? 'The shape cut into 2 equal parts with 1 shaded shows one half.' : 'The shape with 2 of its 4 parts shaded shows one half. Shaded and white are the same size.',
      }
    }
    const thing = rng.pick(FOOD)
    if (level === 3) {
      const n = rng.pick(range(2, 20, 2))
      const h = n / 2
      const figure: Fig = { kind: 'objects', items: [{ icon: thing.icon, count: n }], alt: `A picture of ${plural(n, thing.one, thing.many)}.` }
      const share = rng.chance(0.5)
      return {
        type: 'numeric',
        prompt: share ? `Share ${n} ${thing.many} equally between 2 plates. How many go on each plate?` : `What is half of ${n}?`,
        ...(share ? { figure } : {}),
        answer: h,
        hints: ['Half means 2 equal groups.', `Share the ${n} one at a time into 2 groups.`, 'Put 1 in each group. Keep going until none are left.'],
        explanation: `${n} shared into 2 equal groups gives ${h} in each. Half of ${n} is ${h}.`,
        solution: [
          { say: `Share ${n} into 2 equal groups.`, figure: { kind: 'groups', groups: [h, h], icon: thing.icon, container: 'plate', alt: `2 plates with ${plural(h, thing.one, thing.many)} on each.` } },
          { say: `Each group has ${h}.`, show: `${h} + ${h} = ${n}` },
        ],
        ...(share ? { tags: ['word-problem'] } : {}),
      }
    }
    const v = rng.int(0, 2)
    if (v === 0) {
      const [p, q] = twoNames(rng)
      const n = rng.pick(range(6, 20, 2))
      return {
        type: 'numeric',
        prompt: `${p} has ${n} stickers. ${p} gives half of them to ${q}. How many stickers does ${q} get?`,
        answer: n / 2,
        hints: ['Half means 2 equal shares.', `Split ${n} into 2 equal groups.`, `Think: double what makes ${n}?`],
        explanation: `Half of ${n} is ${n / 2}, because ${n / 2} + ${n / 2} = ${n}.`,
        tags: ['word-problem'],
      }
    }
    if (v === 1) {
      const k = rng.pick(range(4, 12, 2))
      return {
        type: 'numeric',
        prompt: `Some oranges are cut in half. There are ${k} halves. How many oranges were cut?`,
        figure: { kind: 'fraction', shape: 'circle', parts: 2, shaded: 1, label: '1 half', alt: 'One orange cut into 2 equal halves.' },
        answer: k / 2,
        hints: ['Each orange is cut into two halves.', `Put the ${k} halves into pairs.`, 'Two halves make one whole orange. Count the pairs.'],
        explanation: `2 halves make 1 whole, so ${k} halves make ${k / 2} whole oranges.`,
        solution: [
          { say: 'Pair the halves up.', figure: { kind: 'groups', groups: Array.from({ length: k / 2 }, () => 2), icon: 'orange', container: 'circle', alt: `${k / 2} pairs of orange halves.` } },
          { say: `There are ${k / 2} pairs.`, show: `${k} halves = ${k / 2} wholes` },
        ],
        tags: ['word-problem'],
      }
    }
    const parts = rng.pick([4, 6, 8])
    return {
      type: 'fraction',
      prompt: `Shade one half of the ${shape}. It has ${parts} equal parts.`,
      shape,
      parts,
      answer: { num: 1, den: 2 },
      hints: ['Half means the shaded part and the white part are the same size.', `Share the ${parts} parts into 2 equal groups.`, `Half of ${parts} parts is how many parts?`],
      explanation: `Half of ${parts} parts is ${parts / 2} parts. Shading ${parts / 2} of ${parts} shows one half.`,
      solution: [
        { say: `The ${shape} has ${parts} parts.`, figure: fracFig(shape, parts, 0) },
        { say: `Shade ${parts / 2} parts. The rest stay white.`, show: `${parts / 2} + ${parts / 2} = ${parts}`, figure: fracFig(shape, parts, parts / 2) },
      ],
    }
  },
}

const quarters: Generator = {
  skill: 'm1.quarters',
  levels: [1, 2, 3, 4],
  generate({ rng, level }) {
    const shape = rng.pick(FRAC_SHAPES)
    if (level === 1) {
      return {
        type: 'fraction',
        prompt: `Shade one quarter of the ${shape}.`,
        shape,
        parts: 4,
        answer: { num: 1, den: 4 },
        hints: ['A quarter is one of four equal parts.', `The ${shape} is cut into 4 equal parts.`, 'Count the parts first. Then choose how many to shade.'],
        explanation: 'One quarter is 1 of 4 equal parts, so shade 1 part.',
        solution: [
          { say: `The ${shape} has 4 equal parts.`, figure: fracFig(shape, 4, 0) },
          { say: 'Shade 1 of the 4 parts.', show: '1 of 4 parts', figure: fracFig(shape, 4, 1) },
        ],
      }
    }
    if (level === 2) {
      const pool: Opt[] = rng.shuffle([
        { figure: fracFig(shape, 2, 1), why: 'This shows 1 of 2 equal parts. That is a half.' },
        { figure: fracFig(shape, 3, 1), why: 'This shows 1 of 3 equal parts. A quarter needs 4 parts.' },
        { figure: fracFig(shape, 4, 2), why: 'This shows 2 of 4 parts. That is two quarters, or a half.' },
        { figure: fracFig(shape, 4, 3), why: 'This shows 3 of 4 parts. That is three quarters.' },
      ])
      return {
        type: 'mcq',
        prompt: 'Which shape has one quarter shaded?',
        ...mcqOpts(rng, { figure: fracFig(shape, 4, 1) }, pool, 3),
        hints: ['A quarter is 1 of 4 equal parts.', 'Look for a shape cut into 4 equal parts.', 'Count the parts in each shape. Then count the shaded parts.'],
        explanation: 'The shape cut into 4 equal parts with 1 part shaded shows one quarter.',
      }
    }
    const thing = rng.pick(FOOD)
    if (level === 3) {
      const n = rng.pick([4, 8, 12, 16, 20])
      const q = n / 4
      const share = rng.chance(0.5)
      const figure: Fig = { kind: 'objects', items: [{ icon: thing.icon, count: n }], alt: `A picture of ${plural(n, thing.one, thing.many)}.` }
      return {
        type: 'numeric',
        prompt: share ? `Share ${n} ${thing.many} equally into 4 bags. How many go in each bag?` : `What is a quarter of ${n}?`,
        ...(share ? { figure } : {}),
        answer: q,
        hints: ['A quarter means 4 equal groups.', `Share the ${n} one at a time into 4 groups.`, 'Put 1 in each of the 4 groups. Keep going until none are left.'],
        explanation: `${n} shared into 4 equal groups gives ${q} in each. A quarter of ${n} is ${q}.`,
        solution: [
          { say: `Share ${n} into 4 equal groups.`, figure: { kind: 'groups', groups: [q, q, q, q], icon: thing.icon, container: 'bag', alt: `4 bags with ${plural(q, thing.one, thing.many)} in each.` } },
          { say: `Each group has ${q}.`, show: `${q} + ${q} + ${q} + ${q} = ${n}` },
        ],
        ...(share ? { tags: ['word-problem'] } : {}),
      }
    }
    const v = rng.int(0, 2)
    if (v === 0) {
      return {
        type: 'fraction',
        prompt: `Shade three quarters of the ${shape}.`,
        shape,
        parts: 4,
        answer: { num: 3, den: 4 },
        hints: ['A quarter is 1 of 4 equal parts.', 'Three quarters means 3 of those parts.', 'Shade one quarter first. Then keep going.'],
        explanation: 'Three quarters is 3 of 4 equal parts, so shade 3 parts and leave 1 white.',
        solution: [
          { say: 'One quarter is 1 part.', figure: fracFig(shape, 4, 1) },
          { say: 'Three quarters is 3 parts.', show: '3 of 4 parts', figure: fracFig(shape, 4, 3) },
        ],
      }
    }
    if (v === 1) {
      const name = pickName(rng)
      const eaten = rng.int(1, 3)
      return {
        type: 'numeric',
        prompt: `A pizza is cut into quarters. ${name} eats ${eaten} ${eaten === 1 ? 'quarter' : 'quarters'}. How many quarters are left?`,
        figure: fracFig('circle', 4, eaten),
        answer: 4 - eaten,
        hints: ['How many quarters make a whole pizza?', `Take away the ${eaten} eaten.`, `A whole pizza is 4 quarters. Count back ${eaten}.`],
        explanation: `A whole pizza is 4 quarters. 4 - ${eaten} = ${4 - eaten} quarters are left.`,
        tags: ['word-problem'],
      }
    }
    return {
      type: 'numeric',
      prompt: 'How many quarters make one whole?',
      figure: fracFig(shape, 4, 4),
      answer: 4,
      hints: ['A quarter is one part of a whole.', 'The whole is cut into equal quarters.', 'Count the parts in the picture.'],
      explanation: 'A whole cut into quarters has 4 equal parts, so 4 quarters make one whole.',
    }
  },
}

/* -------------------------------------------------------------------------
 * Time (Gt)
 * ---------------------------------------------------------------------- */

const daysMonths: Generator = {
  skill: 'm1.days-months',
  levels: [1, 2, 3, 4],
  generate({ rng, level }) {
    const i = rng.int(0, 6)
    const day = DAYS[i]!
    const d = (k: number) => DAYS[(((i + k) % 7) + 7) % 7]!
    if (level === 1) {
      const after = rng.chance(0.6)
      const ans = after ? d(1) : d(-1)
      return {
        type: 'mcq',
        prompt: `What day comes ${after ? 'after' : 'before'} ${day}?`,
        ...mcqFrom(rng, ans, [
          { value: after ? d(-1) : d(1), why: after ? `${d(-1)} comes before ${day}.` : `${d(1)} comes after ${day}.` },
          { value: after ? d(2) : d(-2), why: after ? `${d(2)} is 2 days after ${day}.` : `${d(-2)} is 2 days before ${day}.` },
        ], 3),
        hints: ['Say the days of the week in order.', 'There are 7 days. After the last one, the week starts again.', after ? `Say ${day}, then say the next day.` : `Say the days up to ${day}. Which day did you say just before it?`],
        explanation: after ? `${ans} comes straight after ${day}.` : `${ans} comes just before ${day}.`,
      }
    }
    if (level === 2) {
      const len = rng.int(4, 5)
      const items = range(0, len - 1).map((k) => d(k))
      return {
        type: 'order',
        prompt: `Put the days in order. Start with ${day}.`,
        items,
        hints: ['Say the days of the week in order.', `${day} is first. Which day comes next?`, 'After Sunday, the week starts again with Monday.'],
        explanation: `The days go in this order: ${items.join(', ')}.`,
      }
    }
    if (level === 3) {
      const v = rng.int(0, 2)
      if (v === 0) {
        return {
          type: 'mcq',
          prompt: `Today is ${day}. What day was yesterday?`,
          ...mcqFrom(rng, d(-1), [
            { value: d(1), why: `${d(1)} is tomorrow.` },
            { value: d(-2), why: `${d(-2)} was 2 days ago.` },
          ], 3),
          hints: ['Yesterday is the day before today.', 'Say the days of the week in order.', `Which day comes just before ${day}?`],
          explanation: `Yesterday is the day before today. The day before ${day} is ${d(-1)}.`,
        }
      }
      if (v === 1) {
        return {
          type: 'mcq',
          prompt: `Today is ${day}. What day will it be tomorrow?`,
          ...mcqFrom(rng, d(1), [
            { value: d(-1), why: `${d(-1)} was yesterday.` },
            { value: d(2), why: `${d(2)} is 2 days from now.` },
          ], 3),
          hints: ['Tomorrow is the day after today.', 'Say the days of the week in order.', `Which day comes just after ${day}?`],
          explanation: `Tomorrow is the day after today. The day after ${day} is ${d(1)}.`,
        }
      }
      return {
        type: 'mcq',
        prompt: `What day is 2 days after ${day}?`,
        ...mcqFrom(rng, d(2), [
          { value: d(1), why: `${d(1)} is only 1 day after ${day}.` },
          { value: d(3), why: `${d(3)} is 3 days after ${day}.` },
        ], 3),
        hints: ['Count on in days, one day at a time.', `Start at ${day}. Say the next 2 days.`, `The first day after ${day} is ${d(1)}.`],
        explanation: `After ${day} comes ${d(1)}, then ${d(2)}.`,
      }
    }
    const j = rng.int(0, 11)
    const month = MONTHS[j]!
    const mo = (k: number) => MONTHS[(((j + k) % 12) + 12) % 12]!
    const v = rng.int(0, 3)
    if (v === 0) {
      const after = rng.chance(0.6)
      return {
        type: 'mcq',
        prompt: `Which month comes ${after ? 'after' : 'before'} ${month}?`,
        ...mcqFrom(rng, after ? mo(1) : mo(-1), [
          { value: after ? mo(-1) : mo(1), why: after ? `${mo(-1)} comes before ${month}.` : `${mo(1)} comes after ${month}.` },
          { value: after ? mo(2) : mo(-2), why: after ? `${mo(2)} is 2 months after ${month}.` : `${mo(-2)} is 2 months before ${month}.` },
        ], 3),
        hints: ['Say the months of the year in order.', 'There are 12 months. After the last one, the year starts again.', after ? `Say ${month}, then say the next month.` : `Which month do you say just before ${month}?`],
        explanation: after ? `${mo(1)} comes straight after ${month}.` : `${mo(-1)} comes just before ${month}.`,
      }
    }
    if (v === 1) {
      const items = range(0, 3).map((k) => mo(k))
      return {
        type: 'order',
        prompt: `Put the months in order. Start with ${month}.`,
        items,
        hints: ['Say the months of the year in order.', `${month} is first. Which month comes next?`, 'After December, the year starts again with January.'],
        explanation: `The months go in this order: ${items.join(', ')}.`,
      }
    }
    const week = v === 2
    return {
      type: 'numeric',
      prompt: week ? 'How many days are there in one week?' : 'How many months are there in one year?',
      answer: week ? 7 : 12,
      hints: [week ? 'Say the days of the week.' : 'Say the months of the year.', 'Count on your fingers as you say each one.', week ? 'Start with Monday and say 1.' : 'Start with January and say 1.'],
      explanation: week ? 'Monday to Sunday makes 7 days in a week.' : 'January to December makes 12 months in a year.',
    }
  },
}

const oclockHalfPast: Generator = {
  skill: 'm1.oclock-half-past',
  levels: [1, 2, 3, 4],
  generate({ rng, level }) {
    const h = rng.int(1, 12)
    if (level === 1) {
      const figure = clockFig(h, 0)
      const ds = [
        ...(h !== 12 ? [{ value: "12 o'clock", why: 'The long hand shows the minutes. Read the short hand for the hour.' }] : [{ value: "1 o'clock", why: 'The short hand points to 12, not 1.' }]),
        { value: `half past ${h}`, why: 'At half past, the long hand points down to 6.' },
        { value: `${nextHour(h)} o'clock`, why: `The short hand points to ${h}, not ${nextHour(h)}.` },
      ]
      return {
        type: 'mcq',
        prompt: 'What time does the clock show?',
        figure,
        ...mcqFrom(rng, timeWords(h, 0), ds, 3),
        hints: ['The short hand shows the hour.', "When the long hand points to 12, it is o'clock.", 'Look at the short hand first. Which number does it point to?'],
        explanation: `The long hand points to 12 and the short hand points to ${h}, so it is ${h} o'clock.`,
      }
    }
    if (level === 2) {
      const half = rng.chance(0.5)
      const m = half ? 30 : 0
      return {
        type: 'clock',
        prompt: `Show ${timeWords(h, m)} on the clock.`,
        answer: { h, m },
        stepMinutes: 30,
        hints: half ? ['Half past means 30 minutes after the hour.', 'At half past, the long hand points down to 6.', `Put the short hand halfway between ${h} and ${nextHour(h)}.`] : ["At o'clock the long hand points straight up to 12.", 'The short hand points to the hour.', `Put the short hand on ${h} first.`],
        explanation: half ? `At half past ${h}, the long hand points to 6 and the short hand is halfway between ${h} and ${nextHour(h)}.` : `At ${h} o'clock, the long hand points to 12 and the short hand points to ${h}.`,
        solution: [
          { say: half ? 'Put the long hand on 6.' : 'Put the long hand on 12.' },
          { say: half ? `Put the short hand halfway between ${h} and ${nextHour(h)}.` : `Put the short hand on ${h}.`, figure: clockFig(h, m) },
        ],
      }
    }
    if (level === 3) {
      const figure = clockFig(h, 30)
      return {
        type: 'mcq',
        prompt: 'What time does the clock show?',
        figure,
        ...mcqFrom(rng, timeWords(h, 30), [
          { value: `half past ${nextHour(h)}`, why: `The short hand has gone past ${h}, but not past ${nextHour(h)}.` },
          { value: "6 o'clock", why: 'The long hand on 6 means half past, not 6 o\'clock.' },
          { value: `${h} o'clock`, why: "At o'clock the long hand points to 12." },
        ], 3),
        hints: ['Look at the long hand first.', 'When the long hand points to 6, it is half past.', 'The short hand has just gone past the hour. Which number is it past?'],
        explanation: `The long hand points to 6 and the short hand is just past ${h}, so it is half past ${h}.`,
      }
    }
    const v = rng.int(0, 2)
    if (v === 0) {
      return {
        type: 'clock',
        prompt: `It is ${h} o'clock. Show the time 1 hour later.`,
        answer: { h: nextHour(h), m: 0 },
        stepMinutes: 30,
        hints: ['1 hour later means the short hand moves on one number.', "The long hand goes all the way round and is back on 12.", `Move the short hand from ${h} to the next number.`],
        explanation: `1 hour after ${h} o'clock is ${nextHour(h)} o'clock.`,
        solution: [
          { say: `It starts at ${h} o'clock.`, figure: clockFig(h, 0) },
          { say: '1 hour later, the short hand has moved on one number.', figure: clockFig(nextHour(h), 0), show: `${nextHour(h)} o'clock` },
        ],
      }
    }
    if (v === 1) {
      return {
        type: 'clock',
        prompt: `It is ${h} o'clock. Show the time half an hour later.`,
        answer: { h, m: 30 },
        stepMinutes: 30,
        hints: ['Half an hour is 30 minutes.', 'The long hand moves halfway round, from 12 to 6.', `The short hand moves to halfway between ${h} and ${nextHour(h)}.`],
        explanation: `Half an hour after ${h} o'clock is half past ${h}.`,
        solution: [
          { say: `It starts at ${h} o'clock.`, figure: clockFig(h, 0) },
          { say: 'The long hand moves halfway round to 6.', figure: clockFig(h, 30), show: `half past ${h}` },
        ],
      }
    }
    const name = pickName(rng)
    return {
      type: 'clock',
      prompt: `${name} starts reading at half past ${h}. ${name} reads for half an hour. Show the time ${name} stops.`,
      answer: { h: nextHour(h), m: 0 },
      stepMinutes: 30,
      hints: ['Half an hour is 30 minutes.', 'From half past, half an hour more takes the long hand back to 12.', `The short hand moves on to ${nextHour(h)}.`],
      explanation: `Half an hour after half past ${h} is ${nextHour(h)} o'clock.`,
      tags: ['word-problem'],
    }
  },
}

/* -------------------------------------------------------------------------
 * Shapes and measures (Gg), position (Gp)
 * ---------------------------------------------------------------------- */

const shapes2d: Generator = {
  skill: 'm1.shapes-2d',
  levels: [1, 2, 3, 4],
  generate({ rng, level }) {
    if (level === 1) {
      const pool: ShapeKey[] = ['circle', 'triangle', 'square', 'rectangle']
      const s = rng.pick(pool)
      return {
        type: 'mcq',
        prompt: 'What is the name of this shape?',
        figure: shapeFig(s),
        ...mcqFrom(rng, s, rng.shuffle(pool.filter((x) => x !== s)).map((x) => ({ value: x, why: SHAPE_INFO[x].about })), 3),
        hints: ['Look at the sides. Are they straight or curved?', 'Count the sides and the corners.', 'Put your finger on one corner and go round the shape.'],
        explanation: `This shape is ${art(s)} ${s}. ${SHAPE_INFO[s].about}`,
      }
    }
    if (level === 2) {
      const s = rng.pick<ShapeKey>(['triangle', 'square', 'rectangle', 'pentagon', 'hexagon'])
      const corners = rng.chance(0.4)
      const k = corners ? SHAPE_INFO[s].corners : SHAPE_INFO[s].sides
      return {
        type: 'numeric',
        prompt: corners ? 'How many corners does this shape have?' : 'How many straight sides does this shape have?',
        figure: shapeFig(s),
        answer: k,
        hints: [corners ? 'A corner is where two sides meet.' : 'A side is a straight line on the edge.', `Count each ${corners ? 'corner' : 'side'} once as you go round.`, 'Start at the top. Put your finger there and move round.'],
        explanation: `This is ${art(s)} ${s}. It has ${k} ${corners ? 'corners' : 'straight sides'}.`,
      }
    }
    if (level === 3) {
      if (rng.chance(0.5)) {
        const s = rng.pick<ShapeKey>(['triangle', 'square', 'pentagon', 'hexagon'])
        const k = SHAPE_INFO[s].sides
        const others = rng.shuffle<ShapeKey>(['circle', 'triangle', 'rectangle', 'pentagon', 'hexagon'].filter((x) => SHAPE_INFO[x as ShapeKey].sides !== k) as ShapeKey[])
        return {
          type: 'mcq',
          prompt: `Which shape has ${k} straight sides?`,
          ...mcqOpts(rng, { figure: shapeFig(s) }, others.map((x) => ({ figure: shapeFig(x), why: SHAPE_INFO[x].sides === 0 ? 'This shape has no straight sides.' : `This shape has ${SHAPE_INFO[x].sides} sides.` })), 3),
          hints: ['Count the sides of each shape.', 'Go round each shape with your finger.', 'Count the sides of the first shape. Then check the next one.'],
          explanation: `${cap(art(s))} ${s} has ${k} straight sides.`,
        }
      }
      const s = rng.pick<ShapeKey>(['circle', 'semicircle', 'oval'])
      const others = rng.sample<ShapeKey>(['triangle', 'square', 'rectangle', 'pentagon', 'hexagon'], 2)
      return {
        type: 'mcq',
        prompt: 'Which shape has a curved side?',
        ...mcqOpts(rng, { figure: shapeFig(s) }, others.map((x) => ({ figure: shapeFig(x), why: `This shape has ${SHAPE_INFO[x].sides} straight sides and no curves.` })), 3),
        hints: ['A curved side bends like part of a circle.', 'Run your finger round each shape. Does it go straight or bend?', 'Look for a side that is not a straight line.'],
        explanation: `${cap(art(s))} ${s} has a curved side. ${SHAPE_INFO[s].about}`,
      }
    }
    const kinds: ShapeKey[] = ['circle', 'triangle', 'square', 'rectangle', 'hexagon']
    const unitLen = rng.int(2, 3)
    const chosen = rng.sample(kinds, unitLen === 2 ? 2 : rng.pick([2, 3]))
    const a = chosen[0]!
    const b = chosen[1]!
    const c = chosen[2]
    const units: ShapeKey[][] = c ? [[a, b, c]] : unitLen === 2 ? [[a, b]] : [[a, a, b], [a, b, b]]
    const unit = rng.pick(units)
    const shown = rng.int(unit.length * 2, Math.min(unit.length * 3, 9))
    const seqShapes = range(0, shown - 1).map((k) => unit[k % unit.length]!)
    const ans = unit[shown % unit.length]!
    const figure: Fig = { kind: 'pattern', items: [...seqShapes.map((s) => ({ shape: s })), null], alt: `A pattern of shapes: ${seqShapes.join(', ')}, then a blank.` }
    const inPattern = [...new Set(unit)]
    const extra = kinds.filter((k) => !inPattern.includes(k))
    const ds = [
      ...inPattern.filter((s) => s !== ans).map((s) => ({ value: s, why: `Say the pattern out loud: ${unit.join(', ')}, and again.` })),
      ...rng.shuffle(extra).map((s) => ({ value: s, why: `There is no ${s} in this pattern.` })),
    ]
    return {
      type: 'mcq',
      prompt: 'What shape comes next in the pattern?',
      figure,
      ...mcqFrom(rng, ans, ds, 3),
      hints: ['Say the shapes out loud.', 'Find the part that repeats.', `The pattern starts ${unit.join(', ')}. Then it repeats.`],
      explanation: `The pattern repeats ${unit.join(', ')}. The next shape is ${art(ans)} ${ans}.`,
      solution: [
        { say: 'Find the part that repeats.', show: unit.join(', '), figure },
        { say: 'Keep the pattern going.', show: [...seqShapes, ans].join(', ') },
      ],
    }
  },
}

const G1_SOLIDS: readonly Solid[] = ['cube', 'cuboid', 'sphere', 'cylinder', 'cone', 'square-pyramid']
const g1SolidName = (s: Solid): string => (s === 'square-pyramid' ? 'pyramid' : SOLID_INFO[s].name)

const REAL_SOLIDS: readonly { icon: IconName; text: string; solid: Solid }[] = [
  { icon: 'ball', text: 'a ball', solid: 'sphere' },
  { icon: 'orange', text: 'an orange', solid: 'sphere' },
  { icon: 'box', text: 'a box', solid: 'cuboid' },
  { icon: 'block', text: 'a toy block', solid: 'cube' },
  { icon: 'battery', text: 'a battery', solid: 'cylinder' },
  { icon: 'candle', text: 'a candle', solid: 'cylinder' },
]

const shapes3d: Generator = {
  skill: 'm1.shapes-3d',
  levels: [1, 2, 3, 4],
  generate({ rng, level }) {
    if (level === 1) {
      const s = rng.pick(G1_SOLIDS)
      const others = rng.shuffle(G1_SOLIDS.filter((x) => x !== s))
      return {
        type: 'mcq',
        prompt: 'What is the name of this 3D shape?',
        figure: solidFig(s),
        ...mcqFrom(rng, g1SolidName(s), others.map((x) => ({ value: g1SolidName(x), why: SOLID_INFO[x].about.replace('square-based pyramid', 'pyramid') })), 3),
        hints: ['Look at the faces. Are they flat or curved?', 'Count the flat faces you can see.', 'Look for a curved face or a point first.'],
        explanation: `This shape is ${art(g1SolidName(s))} ${g1SolidName(s)}. ${SOLID_INFO[s].about.replace('square-based pyramid', 'pyramid')}`,
      }
    }
    if (level === 2) {
      const o = rng.pick(REAL_SOLIDS)
      const others = rng.shuffle(G1_SOLIDS.filter((x) => x !== o.solid))
      return {
        type: 'mcq',
        prompt: `${cap(o.text)} is shaped like which 3D shape?`,
        figure: { kind: 'icons', items: [{ icon: o.icon }], alt: `A picture of ${o.text}.` },
        ...mcqFrom(rng, g1SolidName(o.solid), others.map((x) => ({ value: g1SolidName(x), why: SOLID_INFO[x].about.replace('square-based pyramid', 'pyramid') })), 3),
        hints: [`Think about the shape of ${o.text}.`, 'Is it round all over, a box shape, or round with flat ends?', `Imagine holding ${o.text}. Does it have flat faces?`],
        explanation: `${cap(o.text)} is shaped like ${art(g1SolidName(o.solid))} ${g1SolidName(o.solid)}. ${SOLID_INFO[o.solid].about.replace('square-based pyramid', 'pyramid')}`,
      }
    }
    if (level === 3) {
      if (rng.chance(0.6)) {
        const s = rng.pick<Solid>(['sphere', 'cylinder', 'cone'])
        const others = rng.sample<Solid>(['cube', 'cuboid', 'square-pyramid'], 2)
        return {
          type: 'mcq',
          prompt: 'Which shape can roll?',
          ...mcqOpts(rng, { figure: solidFig(s) }, others.map((x) => ({ figure: solidFig(x), why: 'This shape has only flat faces, so it slides but does not roll.' })), 3),
          hints: ['A shape needs a curved face to roll.', 'Look for a face that is not flat.', 'Check each shape. Does it have a curved face?'],
          explanation: `The ${g1SolidName(s)} has a curved face, so it can roll.`,
        }
      }
      return {
        type: 'mcq',
        prompt: 'Which shape has no flat faces?',
        ...mcqOpts(rng, { figure: solidFig('sphere') }, rng.shuffle([
          { figure: solidFig('cylinder'), why: 'This shape has 2 flat faces at its ends.' },
          { figure: solidFig('cone'), why: 'This shape has 1 flat face at the bottom.' },
          { figure: solidFig('cube'), why: 'This shape has 6 flat faces.' },
        ]), 3),
        hints: ['A flat face is like a table top.', 'Look for a shape that is curved all over.', 'Check each shape. Can it stand on a flat face?'],
        explanation: 'A sphere is round all over. It has no flat faces at all.',
      }
    }
    const v = rng.int(0, 2)
    if (v === 0) {
      const s = rng.pick<Solid>(['cube', 'cuboid', 'sphere', 'cylinder', 'cone'])
      const flat = rng.sample<ShapeKey>(['circle', 'square', 'rectangle', 'triangle'], 2)
      return {
        type: 'mcq',
        prompt: 'Which shape is a 3D shape?',
        ...mcqOpts(rng, { figure: solidFig(s) }, flat.map((x) => ({ figure: shapeFig(x), why: 'This shape is flat. It is a 2D shape.' })), 3),
        hints: ['A 3D shape is solid. You can hold it.', 'A 2D shape is flat, like a drawing on paper.', 'Look for the shape that has faces you could touch.'],
        explanation: `The ${g1SolidName(s)} is solid, so it is a 3D shape. The other shapes are flat.`,
      }
    }
    if (v === 1) {
      const s = rng.pick<ShapeKey>(['circle', 'square', 'triangle', 'rectangle'])
      const solids = rng.sample<Solid>(['cube', 'sphere', 'cylinder', 'cone', 'cuboid'], 2)
      return {
        type: 'mcq',
        prompt: 'Which shape is a flat 2D shape?',
        ...mcqOpts(rng, { figure: shapeFig(s) }, solids.map((x) => ({ figure: solidFig(x), why: 'This is a solid shape. It is 3D.' })), 3),
        hints: ['A 2D shape is flat, like a drawing on paper.', 'A 3D shape is solid. You can hold it.', 'Look for the shape with no faces to touch.'],
        explanation: `The ${s} is flat, so it is a 2D shape.`,
      }
    }
    const s = rng.pick<Solid>(['cube', 'cuboid', 'cylinder', 'cone'])
    const info = SOLID_INFO[s]
    const all = s === 'cube' || s === 'cuboid'
    return {
      type: 'numeric',
      prompt: all ? `How many faces does ${art(info.name)} ${info.name} have?` : `How many flat faces does ${art(info.name)} ${info.name} have?`,
      figure: solidFig(s),
      answer: info.flat,
      hints: ['A face is a flat side of the shape.', all ? 'Count top, bottom, front, back and the two sides.' : 'Look at the ends of the shape.', 'Count the faces you can see. Then think about the ones behind.'],
      explanation: info.about,
    }
  },
}

const RULER_THINGS: readonly { icon: IconName; name: string }[] = [
  { icon: 'pencil', name: 'pencil' }, { icon: 'crayon', name: 'crayon' }, { icon: 'key', name: 'key' }, { icon: 'eraser', name: 'eraser' },
  { icon: 'spoon', name: 'spoon' }, { icon: 'leaf', name: 'leaf' }, { icon: 'paperclip', name: 'paperclip' }, { icon: 'feather', name: 'feather' },
  { icon: 'carrot', name: 'carrot' }, { icon: 'nail', name: 'nail' },
]

const measureCompare: Generator = {
  skill: 'm1.measure-compare',
  levels: [1, 2, 3, 4],
  generate({ rng, level }) {
    if (level === 1) {
      const who = rng.sample(NAMES, 3)
      const vals = rng.sample(range(3, 12), 3)
      const longest = rng.chance(0.6)
      const target = longest ? Math.max(...vals) : Math.min(...vals)
      const ti = vals.indexOf(target)
      const ans = who[ti]!
      return {
        type: 'mcq',
        prompt: `Whose ribbon is the ${longest ? 'longest' : 'shortest'}?`,
        figure: { kind: 'bars', title: 'Ribbons', categories: who, values: vals, horizontal: true, step: 1, yLabel: 'Length in cubes', alt: `Ribbons: ${who.map((w, k) => `${w}'s ribbon is ${vals[k]} cubes long`).join(', ')}.` },
        ...mcqFrom(rng, ans, who.filter((w) => w !== ans).map((w) => ({ value: w, why: longest ? `${w}'s ribbon is shorter than ${ans}'s.` : `${w}'s ribbon is longer than ${ans}'s.` })), 3),
        hints: ['Look at where each ribbon ends.', longest ? 'The longest ribbon reaches the furthest.' : 'The shortest ribbon stops first.', `Compare two ribbons first. Keep the ${longest ? 'longer' : 'shorter'} one.`],
        explanation: `${ans}'s ribbon is ${target} cubes long. That is the ${longest ? 'longest' : 'shortest'}.`,
      }
    }
    if (level === 2) {
      const cols = rng.sample(['red', 'blue', 'green', 'yellow'], 2)
      const c1 = cols[0]!
      const c2 = cols[1]!
      const thing = rng.pick(['box', 'bag'])
      const tilt = rng.pick(['left', 'left', 'right', 'right', 'level'] as const)
      const heavier = rng.chance(0.6)
      const left = `the ${c1} ${thing}`
      const right = `the ${c2} ${thing}`
      const lower = tilt === 'left' ? left : right
      const higher = tilt === 'left' ? right : left
      const correct = tilt === 'level' ? 'They weigh the same' : cap(heavier ? lower : higher)
      const ds = tilt === 'level'
        ? [
            { value: cap(left), why: 'The balance is level, so neither side is heavier.' },
            { value: cap(right), why: 'The balance is level, so neither side is heavier.' },
          ]
        : [
            { value: cap(heavier ? higher : lower), why: heavier ? `${cap(higher)} is higher, so it is lighter.` : `${cap(lower)} is lower, so it is heavier.` },
            { value: 'They weigh the same', why: 'The balance is not level, so they are not the same.' },
          ]
      return {
        type: 'mcq',
        prompt: `Which ${thing} is ${heavier ? 'heavier' : 'lighter'}?`,
        figure: { kind: 'balance', left: [`${c1} ${thing}`], right: [`${c2} ${thing}`], tilt, alt: `A balance with the ${c1} ${thing} on the left and the ${c2} ${thing} on the right. ${tilt === 'level' ? 'The balance is level.' : `The ${tilt} side is lower.`}` },
        ...mcqFrom(rng, correct, ds, 3),
        hints: ['Look at which side of the balance goes down.', 'The heavier side goes down. The lighter side goes up.', 'Find the lower side first.'],
        explanation: tilt === 'level' ? 'The balance is level, so the two weigh the same.' : `${cap(lower)} is on the lower side, so it is heavier. ${cap(higher)} is lighter.`,
      }
    }
    if (level === 3) {
      if (rng.chance(0.5)) {
        const state = rng.pick(['full', 'half full', 'empty'] as const)
        const value = state === 'full' ? 1000 : state === 'half full' ? 500 : 0
        const alt = state === 'full' ? 'A jug filled with water right to the top.' : state === 'half full' ? 'A jug with water up to the halfway mark.' : 'A jug with no water in it.'
        const words = ['Full', 'Half full', 'Empty']
        return {
          type: 'mcq',
          prompt: 'Is the jug full, half full or empty?',
          figure: { kind: 'jug', capacity: 1000, value, step: 100, unit: 'ml', alt },
          ...mcqFrom(rng, cap(state), words.filter((w) => w !== cap(state)).map((w) => ({ value: w, why: w === 'Full' ? 'A full jug has water right to the top.' : w === 'Empty' ? 'An empty jug has no water in it.' : 'A half full jug has water up to the middle.' })), 3),
          hints: ['Look at how high the water is.', 'Full is at the top. Empty is no water. Half full is in the middle.', 'Find the top of the water first.'],
          explanation: `The jug is ${state}. ${alt}`,
        }
      }
      const vals = rng.sample([100, 200, 300, 400, 500, 600, 700, 800, 900], 3)
      const most = rng.chance(0.6)
      const target = most ? Math.max(...vals) : Math.min(...vals)
      const jug = (v: number): Fig => ({ kind: 'jug', capacity: 1000, value: v, step: 100, unit: 'ml', alt: `A jug with water up to the ${v} ml mark.` })
      return {
        type: 'mcq',
        prompt: `Which jug has the ${most ? 'most' : 'least'} water?`,
        ...mcqOpts(rng, { figure: jug(target) }, vals.filter((v) => v !== target).map((v) => ({ figure: jug(v), why: most ? 'This jug has less water than the fullest jug.' : 'This jug has more water than the emptiest jug.' })), 3),
        hints: ['Look at how high the water is in each jug.', most ? 'The jug with the highest water has the most.' : 'The jug with the lowest water has the least.', 'Compare two jugs first. Then check the third.'],
        explanation: `The jug with water up to ${target} ml has the ${most ? 'most' : 'least'} water.`,
      }
    }
    const t = rng.pick(RULER_THINGS)
    const len = rng.int(3, 14)
    const figure: Fig = { kind: 'ruler', lengthCm: 15, objectCm: len, object: t.icon, alt: `A ${t.name} next to a ruler. It starts at 0 and ends at ${len} cm.` }
    return {
      type: 'numeric',
      prompt: `How long is the ${t.name}?`,
      figure,
      answer: len,
      unit: 'cm',
      hints: [`Check that the ${t.name} starts at 0.`, `Look where the end of the ${t.name} is on the ruler.`, `Follow the end of the ${t.name} down to the ruler.`],
      explanation: `The ${t.name} starts at 0 and ends at ${len}, so it is ${len} cm long.`,
      solution: [
        { say: `The ${t.name} starts at 0.`, figure },
        { say: `It ends at ${len}.`, show: `${len} cm` },
      ],
    }
  },
}

const DIRS = [
  { key: 'above', dx: 0, dy: 2 },
  { key: 'below', dx: 0, dy: -2 },
  { key: 'to the left of', dx: -2, dy: 0 },
  { key: 'to the right of', dx: 2, dy: 0 },
] as const

const positionDirection: Generator = {
  skill: 'm1.position-direction',
  levels: [1, 2, 3, 4],
  generate({ rng, level }) {
    if (level === 1 || level === 2) {
      const len = level === 1 ? 3 : 5
      const row = rng.sample(THINGS, len)
      const figure: Fig = { kind: 'icons', items: row.map((x) => ({ icon: x.icon, label: x.name })), alt: `A row of things from left to right: ${row.map((x) => x.name).join(', ')}.` }
      if (level === 1) {
        const a = row[0]!.name
        const b = row[1]!.name
        const c = row[2]!.name
        return {
          type: 'mcq',
          prompt: `What is between the ${a} and the ${c}?`,
          figure,
          ...mcqFrom(rng, b, [
            { value: a, why: `The ${a} is at one end of the row.` },
            { value: c, why: `The ${c} is at one end of the row.` },
          ], 3),
          hints: ['Between means in the middle of two things.', `Find the ${a} and the ${c}.`, `Put one finger on the ${a} and one on the ${c}. What is in the middle?`],
          explanation: `The ${b} is in the middle, so it is between the ${a} and the ${c}.`,
        }
      }
      const left = rng.chance(0.5)
      const idx = left ? rng.int(1, len - 1) : rng.int(0, len - 2)
      const x = row[idx]!.name
      const ans = row[idx + (left ? -1 : 1)]!.name
      const ds = [
        ...(row[idx + (left ? 1 : -1)] ? [{ value: row[idx + (left ? 1 : -1)]!.name, why: `That is just to the ${left ? 'right' : 'left'} of the ${x}.` }] : []),
        ...(row[idx + (left ? -2 : 2)] ? [{ value: row[idx + (left ? -2 : 2)]!.name, why: `Just ${left ? 'to the left' : 'to the right'} means right next to the ${x}.` }] : []),
        { value: x, why: `That is the ${x} itself.` },
      ]
      return {
        type: 'mcq',
        prompt: `What is just to the ${left ? 'left' : 'right'} of the ${x}?`,
        figure,
        ...mcqFrom(rng, ans, ds, 3),
        hints: [`Find the ${x} first.`, `Hold up your ${left ? 'left' : 'right'} hand. That side is ${left ? 'left' : 'right'}.`, `Look at the thing right next to the ${x}, on the ${left ? 'left' : 'right'}.`],
        explanation: `The ${ans} is right next to the ${x}, on its ${left ? 'left' : 'right'}.`,
      }
    }
    const letters = rng.shuffle(['A', 'B', 'C', 'D'])
    if (level === 3) {
      const pts = DIRS.map((d, k) => ({ x: 3 + d.dx, y: 3 + d.dy, label: letters[k]!, key: d.key }))
      const ask = rng.int(0, 3)
      const target = pts[ask]!
      const figure: Fig = { kind: 'coordinates', size: 6, points: [{ x: 3, y: 3, label: 'P' }, ...pts.map((p) => ({ x: p.x, y: p.y, label: p.label }))], alt: `A grid with point P in the middle. ${pts.map((p) => `${p.label} is 2 squares ${p.key} P`).join('. ')}.` }
      return {
        type: 'mcq',
        prompt: `Which point is ${target.key} P?`,
        figure,
        ...mcqFrom(rng, target.label, rng.shuffle(pts.filter((p) => p !== target)).map((p) => ({ value: p.label, why: `${p.label} is ${p.key} P.` })), 3),
        hints: ['Find P first.', target.key === 'above' ? 'Above means higher up.' : target.key === 'below' ? 'Below means lower down.' : `Look along the row ${target.key.replace('to the ', 'towards the ').replace(' of', '')}.`, 'Put your finger on P. Move it the way the question says.'],
        explanation: `${target.label} is ${target.key} P.`,
      }
    }
    const r = rng.int(1, 3)
    const u = rng.int(1, 3)
    const spots = [
      { x: 1 + r, y: 1 + u },
      ...(r !== u ? [{ x: 1 + u, y: 1 + r }] : [{ x: 1 + r + 1, y: 1 + u }]),
      { x: 1 + r, y: 1 + u + 1 },
    ]
    const pts = spots.map((s, k) => ({ ...s, label: letters[k]! }))
    const figure: Fig = { kind: 'coordinates', size: 6, points: [{ x: 1, y: 1, label: 'S' }, ...pts.map((p) => ({ x: p.x, y: p.y, label: p.label }))], alt: `A grid. S is at 1 across and 1 up. ${pts.map((p) => `${p.label} is at ${p.x} across and ${p.y} up`).join('. ')}.` }
    const right = `${r} ${r === 1 ? 'square' : 'squares'} right`
    const up = `${u} ${u === 1 ? 'square' : 'squares'} up`
    return {
      type: 'mcq',
      prompt: `Start at S. Move ${right} and ${up}. Which letter do you reach?`,
      figure,
      ...mcqFrom(rng, pts[0]!.label, [
        { value: pts[1]!.label, why: r !== u ? `To reach ${pts[1]!.label}, you move ${u} right and ${r} up.` : `${pts[1]!.label} is one square too far right.` },
        { value: pts[2]!.label, why: `${pts[2]!.label} is one square too far up.` },
      ], 3),
      hints: ['Put your finger on S.', 'Move right first, then move up.', `Move ${right}. Then stop and move ${up}.`],
      explanation: `From S, ${right} and ${up} reaches ${pts[0]!.label}.`,
    }
  },
}

/* -------------------------------------------------------------------------
 * Statistics (Ss)
 * ---------------------------------------------------------------------- */

const SURVEYS: readonly { title: string; labels: readonly string[] }[] = [
  { title: 'Favourite fruit', labels: ['Apples', 'Bananas', 'Mangoes', 'Oranges'] },
  { title: 'Favourite pet', labels: ['Cats', 'Dogs', 'Fish', 'Rabbits'] },
  { title: 'Favourite colour', labels: ['Red', 'Blue', 'Green', 'Yellow'] },
  { title: 'Favourite sport', labels: ['Football', 'Swimming', 'Badminton', 'Running'] },
  { title: 'Favourite snack', labels: ['Rice cakes', 'Bananas', 'Biscuits', 'Yoghurt'] },
]

/** Nilai berbeda supaya paling banyak dan paling sedikit selalu tunggal. */
function distinctCounts(rng: Rng, n: number, min: number, max: number): number[] {
  return rng.sample(range(min, max), n)
}

const pictogramsGraphs: Generator = {
  skill: 'm1.pictograms-graphs',
  levels: [1, 2, 3, 4],
  generate({ rng, level }) {
    const survey = rng.pick(SURVEYS)
    if (level === 1 || level === 2) {
      const labels = rng.sample(survey.labels, 3)
      const counts = distinctCounts(rng, 3, 1, 8)
      const figure: Fig = { kind: 'pictogram', title: survey.title, rows: labels.map((l, k) => ({ label: l, count: counts[k]! })), icon: 'star', key: 1, alt: `Pictogram of ${survey.title.toLowerCase()}. Each star is 1 child. ${labels.map((l, k) => `${l}: ${counts[k]}`).join(', ')}.` }
      if (level === 1) {
        const k = rng.int(0, 2)
        const label = labels[k]!
        return {
          type: 'numeric',
          prompt: `How many children chose ${label.toLowerCase()}?`,
          figure,
          answer: counts[k]!,
          hints: [`Find the row for ${label.toLowerCase()}.`, 'Each star stands for 1 child.', 'Point to each star in the row and count.'],
          explanation: `The ${label.toLowerCase()} row has ${counts[k]} stars, so ${counts[k]} children chose ${label.toLowerCase()}.`,
        }
      }
      const most = rng.chance(0.5)
      const target = most ? Math.max(...counts) : Math.min(...counts)
      const ans = labels[counts.indexOf(target)]!
      return {
        type: 'mcq',
        prompt: `Which was chosen by the ${most ? 'most' : 'fewest'} children?`,
        figure,
        ...mcqFrom(rng, ans, labels.filter((l) => l !== ans).map((l) => ({ value: l, why: `${l} has ${counts[labels.indexOf(l)]} stars. ${ans} has ${most ? 'more' : 'fewer'}.` })), 3),
        hints: ['Count the stars in each row.', most ? 'The most popular row has the most stars.' : 'The least popular row has the fewest stars.', `Count the stars for ${labels.find((l) => l !== ans)!.toLowerCase()} first.`],
        explanation: `${ans} has ${target} stars. That is the ${most ? 'most' : 'fewest'}.`,
      }
    }
    if (level === 3) {
      const labels = rng.sample(survey.labels, 3)
      const counts = distinctCounts(rng, 3, 2, 7)
      const figure: Fig = { kind: 'bars', title: survey.title, categories: labels, values: counts, step: 1, axisMax: 8, yLabel: 'Children', alt: `Block graph of ${survey.title.toLowerCase()}. ${labels.map((l, k) => `${l}: ${counts[k]}`).join(', ')}.` }
      if (rng.chance(0.5)) {
        const order = [0, 1, 2].sort((x, y) => counts[y]! - counts[x]!)
        const hi = order[0]!
        const lo = rng.pick([order[1]!, order[2]!])
        const diff = counts[hi]! - counts[lo]!
        return {
          type: 'numeric',
          prompt: `How many more children chose ${labels[hi]!.toLowerCase()} than ${labels[lo]!.toLowerCase()}?`,
          figure,
          answer: diff,
          hints: ['Read the two blocks first.', `How many more means find the difference.`, `Count on from ${counts[lo]} to ${counts[hi]}.`],
          explanation: `${labels[hi]} has ${counts[hi]} and ${labels[lo]} has ${counts[lo]}. ${counts[hi]} - ${counts[lo]} = ${diff}.`,
          solution: [
            { say: 'Read each block.', figure },
            { say: `Count on from ${counts[lo]} to ${counts[hi]}.`, show: `${counts[hi]} - ${counts[lo]} = ${diff}` },
          ],
        }
      }
      const total = counts.reduce((s, c) => s + c, 0)
      return {
        type: 'numeric',
        prompt: 'How many children were asked altogether?',
        figure,
        answer: total,
        hints: ['Every child is in one block.', 'Read each block, then add them.', `Start with ${counts[0]} for ${labels[0]!.toLowerCase()}. Add the next block.`],
        explanation: `${counts.join(' + ')} = ${total} children.`,
        solution: [
          { say: 'Read each block.', figure },
          { say: 'Add the three numbers.', show: `${counts.join(' + ')} = ${total}` },
        ],
      }
    }
    if (rng.chance(0.6)) {
      const labels = rng.sample(survey.labels, 3)
      const counts = distinctCounts(rng, 3, 6, 14)
      const k = rng.int(0, 2)
      const c = counts[k]!
      return {
        type: 'numeric',
        prompt: `How many children chose ${labels[k]!.toLowerCase()}?`,
        figure: { kind: 'tally', rows: labels.map((l, j) => ({ label: l, count: counts[j]! })), alt: `Tally chart of ${survey.title.toLowerCase()}. ${labels.map((l, j) => `${l}: ${counts[j]}`).join(', ')}.` },
        answer: c,
        hints: ['Each tally mark is 1 child.', 'A gate of 4 marks with a line across is 5.', c >= 5 ? 'Count the gates in 5s first. Then count on the single marks.' : 'Count the single marks one by one.'],
        explanation: c % 5 === 0 ? `${c / 5} gates of 5 make ${c}.` : `${Math.floor(c / 5)} ${Math.floor(c / 5) === 1 ? 'gate makes' : 'gates make'} ${Math.floor(c / 5) * 5}, and ${c % 5} more makes ${c}.`,
      }
    }
    const lowEven = rng.sample([2, 4, 6, 8], 2)
    const lowOdd = rng.sample([1, 3, 5, 7, 9], 2)
    const highEven = rng.sample([12, 14, 16, 18], 2)
    const highOdd = rng.sample([11, 13, 15, 17, 19], 1)
    const items = [
      ...lowOdd.map((v) => ({ text: String(v), region: 'a' as const })),
      ...highEven.map((v) => ({ text: String(v), region: 'b' as const })),
      ...lowEven.map((v) => ({ text: String(v), region: 'both' as const })),
      ...highOdd.map((v) => ({ text: String(v), region: 'none' as const })),
    ]
    const ans = String(rng.pick(lowEven))
    return {
      type: 'mcq',
      prompt: 'Which number is in both circles?',
      figure: { kind: 'venn', sets: ['Less than 10', 'Even'], items, alt: `Venn diagram. Less than 10 only: ${lowOdd.join(', ')}. Even only: ${highEven.join(', ')}. In both: ${lowEven.join(', ')}. Outside: ${highOdd.join(', ')}.` },
      ...mcqFrom(rng, ans, [
        { value: String(rng.pick(lowOdd)), why: 'This number is less than 10 but it is not even.' },
        { value: String(rng.pick(highEven)), why: 'This number is even but it is not less than 10.' },
        { value: String(highOdd[0]), why: 'This number is outside both circles.' },
      ], 3),
      hints: ['Both circles means the part where they overlap.', 'A number in the middle is less than 10 and even.', 'Look at the middle part where the circles cross.'],
      explanation: `${ans} is less than 10 and it is even, so it is in both circles.`,
    }
  },
}

/** Generator Math Grade 1. */
export const generators: Generator[] = [
  countObjects,
  numberNames,
  countOnBack,
  skipCount,
  oddEven,
  placeValue20,
  compareOrder,
  ordinalNumbers,
  numberBonds10,
  addWithin20,
  subtractWithin20,
  doubles,
  money1,
  halves,
  quarters,
  daysMonths,
  oclockHalfPast,
  shapes2d,
  shapes3d,
  measureCompare,
  positionDirection,
  pictogramsGraphs,
]
