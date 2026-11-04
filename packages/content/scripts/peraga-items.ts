/**
 * Pembuat soal alat peraga Math (blocks, fractionbar, barmodel, tangram, geoboard).
 * Menulis content/items/math/g<N>/<skill>.tools.json. Jalankan: pnpm exec tsx packages/content/scripts/peraga-items.ts
 * Angka dan jawaban dihitung di sini dari data soal, dan content:check memeriksa lagi semuanya.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRng } from '@kira/core/rng'
import {
  analysePegs,
  blocksValue,
  formatLength,
  orient,
  overlapArea,
  PIECE_AREA,
  PIECE_COUNT,
  PIECE_NAME,
  PIECE_TYPES,
  shareEdge,
  tangramProblems,
  type Blocks,
  type GeoRule,
  type PieceType,
  type Pt,
} from '../src/manip'
import { findContentDir } from '../src/load'

type Obj = Record<string, unknown>
const out = new Map<string, Obj[]>()
const counter = new Map<string, number>()

function add(skill: string, item: Obj): void {
  const n = (counter.get(skill) ?? 700) + 1
  counter.set(skill, n)
  const list = out.get(skill) ?? []
  list.push({ id: `${skill}.${n}`, skill, source: 'kira-original', ...item })
  out.set(skill, list)
}

const assert = (ok: boolean, msg: string) => {
  if (!ok) throw new Error(msg)
}
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

// ------------------------------------------------------------------ Balok nilai tempat

type BlockSpec = {
  skill: string
  d: number
  places: 'to' | 'hto'
  prompt: string
  start?: Blocks
  /** Nilai akhir; susunan target ditentukan di `target`. */
  target: Blocks
  /** Perhitungan yang harus cocok dengan target: awal + tambah - kurang. */
  add?: number
  sub?: number
  exact: boolean
  hints: [string, string, string]
  explanation: string
}

const B = (h: number, t: number, o: number): Blocks => ({ h, t, o })
const blockSpecs: BlockSpec[] = [
  // Kelas 1
  { skill: 'm1.place-value-20', d: 1, places: 'to', prompt: 'Show the number 13 with blocks.', target: B(0, 1, 3), exact: false, hints: ['Think of 13 as one group of ten and some ones.', 'Add 1 ten, then count the ones you still need.', 'You need 1 ten and 3 ones.'], explanation: '13 is 1 ten and 3 ones, because 10 and 3 more make 13.' },
  { skill: 'm1.place-value-20', d: 1, places: 'to', prompt: 'Show the number 18 with blocks.', target: B(0, 1, 8), exact: false, hints: ['The tens column shows groups of ten.', '18 is more than 10, so use 1 ten first.', 'After 1 ten, add 8 ones.'], explanation: '18 is 1 ten and 8 ones, because 10 and 8 more make 18.' },
  { skill: 'm1.place-value-20', d: 1, places: 'to', prompt: 'Show 20 using only tens.', target: B(0, 2, 0), exact: true, hints: ['Ten ones make one ten.', 'Count in tens: 10, 20.', 'Use 2 tens and 0 ones.'], explanation: '20 is 2 tens and 0 ones, because 10 and 10 make 20.' },
  { skill: 'm1.place-value-20', d: 2, places: 'to', prompt: 'You have 12 ones. Trade ones for a ten so that 12 uses the fewest blocks.', start: B(0, 0, 12), target: B(0, 1, 2), exact: true, hints: ['Look for 10 ones that can become 1 ten.', 'Tap Trade 10 for 1 ten in the ones column.', 'You should end with 1 ten and 2 ones.'], explanation: '10 of the 12 ones become 1 ten, so 12 is 1 ten and 2 ones.' },
  { skill: 'm1.place-value-20', d: 2, places: 'to', prompt: 'You have 10 ones. Trade them so that the number is shown with just one block.', start: B(0, 0, 10), target: B(0, 1, 0), exact: true, hints: ['How many ones make a ten?', 'Tap Trade 10 for 1 ten.', 'One ten block replaces all 10 ones.'], explanation: '10 ones are worth the same as 1 ten, so one ten block shows 10.' },
  // Kelas 2
  { skill: 'm2.place-value', d: 1, places: 'to', prompt: 'Show the number 47 with blocks.', target: B(0, 4, 7), exact: false, hints: ['The first digit of 47 tells you the tens.', 'Add 4 tens.', 'Then add 7 ones.'], explanation: '47 is 4 tens and 7 ones, because 40 and 7 make 47.' },
  { skill: 'm2.place-value', d: 1, places: 'to', prompt: 'Show 90 using only tens.', target: B(0, 9, 0), exact: true, hints: ['Count in tens: 10, 20, 30 and so on.', 'You need to reach 90.', 'Use 9 tens and no ones.'], explanation: '90 is 9 tens, because nine groups of 10 make 90.' },
  { skill: 'm2.place-value', d: 2, places: 'to', prompt: 'You have 25 ones. Trade until 25 is shown with the fewest blocks.', start: B(0, 0, 25), target: B(0, 2, 5), exact: true, hints: ['How many groups of 10 are in 25?', 'Trade 10 ones for 1 ten two times.', 'Five ones are left over.'], explanation: '25 ones hold 2 groups of ten and 5 ones left over, so 25 is 2 tens and 5 ones.' },
  { skill: 'm2.place-value', d: 3, places: 'to', prompt: 'Show 40 as 3 tens and 10 ones by breaking one ten.', start: B(0, 4, 0), target: B(0, 3, 10), exact: true, hints: ['Breaking a ten gives you 10 ones.', 'Tap Break 1 into 10 ones in the tens column.', 'You should have 3 tens and 10 ones.'], explanation: 'One ten becomes 10 ones, so 4 tens is the same as 3 tens and 10 ones.' },
  { skill: 'm2.place-value', d: 3, places: 'to', prompt: 'Show 58 using exactly 4 tens.', start: B(0, 5, 8), target: B(0, 4, 18), exact: true, hints: ['You must give up one of the 5 tens.', 'Break 1 ten into 10 ones.', 'Then you have 4 tens and 18 ones.'], explanation: 'Breaking 1 ten gives 10 more ones. So 58 is 4 tens and 18 ones.' },
  { skill: 'm2.place-value', d: 3, places: 'to', prompt: 'Start with 36. Add 2 tens and 5 ones, then trade so the answer uses the fewest blocks.', start: B(0, 3, 6), add: 25, target: B(0, 6, 1), exact: true, hints: ['Add the tens, then add the ones.', 'You will have 11 ones. Trade 10 of them.', 'The answer is 6 tens and 1 one.'], explanation: '36 plus 25 is 61. Adding gives 5 tens and 11 ones, and trading 10 ones leaves 6 tens and 1 one.' },
  // Kelas 3
  { skill: 'm3.place-value', d: 1, places: 'hto', prompt: 'Show the number 235 with blocks.', target: B(2, 3, 5), exact: false, hints: ['The first digit of 235 is the hundreds.', 'Add 2 hundreds, then 3 tens.', 'Finish with 5 ones.'], explanation: '235 is 2 hundreds, 3 tens and 5 ones, because 200, 30 and 5 make 235.' },
  { skill: 'm3.place-value', d: 1, places: 'hto', prompt: 'Show the number 408 with blocks.', target: B(4, 0, 8), exact: false, hints: ['Look at the digit in the tens place.', 'There are no tens in 408.', 'Use 4 hundreds, 0 tens and 8 ones.'], explanation: '408 is 4 hundreds, 0 tens and 8 ones. The zero means no tens.' },
  { skill: 'm3.place-value', d: 2, places: 'hto', prompt: 'You have 23 tens. Trade until the number is shown with the fewest blocks.', start: B(0, 23, 0), target: B(2, 3, 0), exact: true, hints: ['How many tens make one hundred?', 'Trade 10 tens for 1 hundred two times.', '3 tens are left over.'], explanation: '23 tens is 230. Two groups of 10 tens become 2 hundreds, and 3 tens are left.' },
  { skill: 'm3.place-value', d: 3, places: 'hto', prompt: 'Show 300 as 2 hundreds and 10 tens by breaking a hundred.', start: B(3, 0, 0), target: B(2, 10, 0), exact: true, hints: ['A hundred can break into 10 tens.', 'Tap Break 1 into 10 tens in the hundreds column.', 'You should have 2 hundreds and 10 tens.'], explanation: 'One hundred breaks into 10 tens, so 300 is the same as 2 hundreds and 10 tens.' },
  { skill: 'm3.place-value', d: 3, places: 'hto', prompt: 'Show 560 using exactly 4 hundreds.', start: B(5, 6, 0), target: B(4, 16, 0), exact: true, hints: ['Give up one of the 5 hundreds.', 'Break 1 hundred into 10 tens.', 'You will have 16 tens in all.'], explanation: 'Breaking 1 hundred gives 10 more tens. So 560 is 4 hundreds and 16 tens.' },
  { skill: 'm3.place-value', d: 4, places: 'hto', prompt: 'Start with 274. Add 58, then trade so the answer uses the fewest blocks.', start: B(2, 7, 4), add: 58, target: B(3, 3, 2), exact: true, hints: ['Add 5 tens and 8 ones.', 'You will have 12 ones and 12 tens. Trade ones first, then tens.', 'The answer is 3 hundreds, 3 tens and 2 ones.'], explanation: '274 plus 58 is 332. After adding there are 12 tens and 12 ones. Trading gives 3 hundreds, 3 tens and 2 ones.' },
  { skill: 'm3.place-value', d: 4, places: 'hto', prompt: 'Start with 412. Take away 27 by breaking blocks when you need to.', start: B(4, 1, 2), sub: 27, target: B(3, 8, 5), exact: true, hints: ['You cannot take 7 ones from 2 ones yet.', 'Break a ten into ones, then break a hundred into tens.', 'The answer has 3 hundreds, 8 tens and 5 ones.'], explanation: '412 minus 27 is 385. Breaking a ten and then a hundred gives enough ones and tens to take away.' },
  // Kelas 4
  { skill: 'm4.place-value', d: 2, places: 'hto', prompt: 'Show 1,200 using only hundreds.', target: B(12, 0, 0), exact: true, hints: ['1,200 is the same as 12 hundreds.', 'Keep tapping the hundreds column.', 'You need 12 hundreds.'], explanation: '1,200 is 12 hundreds, because 12 groups of 100 make 1,200.' },
  { skill: 'm4.place-value', d: 2, places: 'hto', prompt: 'Show 1,450 using hundreds and tens only.', target: B(14, 5, 0), exact: true, hints: ['Split 1,450 into 1,400 and 50.', '1,400 is 14 hundreds.', 'Add 5 tens for the 50.'], explanation: '1,450 is 14 hundreds and 5 tens, because 1,400 and 50 make 1,450.' },
  { skill: 'm4.place-value', d: 3, places: 'hto', prompt: 'You have 9 hundreds and 15 tens. Trade tens for hundreds so the number uses the fewest blocks.', start: B(9, 15, 0), target: B(10, 5, 0), exact: true, hints: ['10 tens make 1 hundred.', 'Tap Trade 10 for 1 hundred once.', 'You will have 10 hundreds and 5 tens.'], explanation: '9 hundreds and 15 tens is 1,050. Trading 10 tens gives 10 hundreds and 5 tens.' },
  { skill: 'm4.place-value', d: 3, places: 'hto', prompt: 'Show 2,070 using hundreds and tens only.', target: B(20, 7, 0), exact: true, hints: ['2,000 is 20 hundreds.', 'The 70 is 7 tens.', 'Use 20 hundreds and 7 tens.'], explanation: '2,070 is 20 hundreds and 7 tens, because 2,000 and 70 make 2,070.' },
  { skill: 'm4.place-value', d: 4, places: 'hto', prompt: 'Start with 1,230. Add 480, then trade so the answer uses the fewest blocks.', start: B(12, 3, 0), add: 480, target: B(17, 1, 0), exact: true, hints: ['480 is 4 hundreds and 8 tens.', 'You will have 11 tens. Trade 10 of them for a hundred.', 'The answer has 17 hundreds and 1 ten.'], explanation: '1,230 plus 480 is 1,710. Adding gives 16 hundreds and 11 tens, and trading gives 17 hundreds and 1 ten.' },
  { skill: 'm4.place-value', d: 4, places: 'hto', prompt: 'Start with 1,500. Take away 650 by breaking blocks when you need to.', start: B(15, 0, 0), sub: 650, target: B(8, 5, 0), exact: true, hints: ['650 is 6 hundreds and 5 tens.', 'You have no tens to take, so break a hundred into tens.', 'The answer has 8 hundreds and 5 tens.'], explanation: '1,500 minus 650 is 850. Breaking 1 hundred gives 10 tens, so 5 tens can be taken away.' },
  { skill: 'm4.place-value', d: 3, places: 'hto', prompt: 'Show 1,305 using hundreds and ones only.', target: B(13, 0, 5), exact: true, hints: ['1,300 is 13 hundreds.', 'There are no tens.', 'Add 5 ones.'], explanation: '1,305 is 13 hundreds, 0 tens and 5 ones.' },
]

for (const s of blockSpecs) {
  const start = s.start ?? B(0, 0, 0)
  const want = blocksValue(start) + (s.add ?? 0) - (s.sub ?? 0)
  assert(blocksValue(s.target) === want || (!s.start && !s.add && !s.sub), `blocks: target ${JSON.stringify(s.target)} is not ${want}: ${s.prompt}`)
  assert(s.exact || blocksValue(start) !== blocksValue(s.target), `blocks: start equals target: ${s.prompt}`)
  if (s.exact && s.start && !s.add && !s.sub) assert(blocksValue(start) === blocksValue(s.target), `blocks: trade must keep the value: ${s.prompt}`)
  add(s.skill, {
    type: 'blocks',
    difficulty: s.d,
    prompt: s.prompt,
    places: s.places,
    start,
    target: s.target,
    exact: s.exact,
    hints: s.hints,
    explanation: s.explanation,
    tags: ['manipulative', 'blocks', ...(s.exact ? ['regroup'] : [])],
  })
}

// ------------------------------------------------------------------ Batang pecahan

type FracSpec = {
  skill: string
  d: number
  prompt: string
  rows: { den?: number; locked?: number }[]
  splits?: number[]
  targets: ({ num: number; den: number } | null)[]
  exactSplit?: boolean
  relation?: 'lt' | 'gt' | 'eq'
  hints: [string, string, string]
  explanation: string
}
const F = (num: number, den: number) => ({ num, den })
const fracSpecs: FracSpec[] = [
  { skill: 'm1.halves', d: 1, prompt: 'Shade one half of the bar.', rows: [{ den: 2 }], targets: [F(1, 2)], hints: ['The bar is cut into 2 equal parts.', 'A half is one of the 2 equal parts.', 'Tap one part to shade it.'], explanation: 'A half is 1 of 2 equal parts, so 1 part is shaded.' },
  { skill: 'm1.halves', d: 1, prompt: 'Shade both halves to show the whole bar.', rows: [{ den: 2 }], targets: [F(2, 2)], hints: ['The bar has 2 equal parts.', 'A whole is every part.', 'Shade both parts.'], explanation: 'Two halves make one whole, so both parts are shaded.' },
  { skill: 'm1.halves', d: 2, prompt: 'Cut the bar into 2 equal parts, then shade one half.', rows: [{}], splits: [2, 3, 4], targets: [F(1, 2)], exactSplit: true, hints: ['Halves need 2 equal parts.', 'Tap 2 under Cut into.', 'Then shade 1 part.'], explanation: 'Cutting into 2 equal parts makes halves, and shading 1 part shows one half.' },
  { skill: 'm1.halves', d: 2, prompt: 'This bar has 4 equal parts. Shade one half of it.', rows: [{ den: 4 }], targets: [F(2, 4)], hints: ['Half means 2 equal groups.', 'Split the 4 parts into 2 equal groups.', 'Shade 2 parts.'], explanation: 'Half of 4 parts is 2 parts, so 2 of 4 is the same as one half.' },
  { skill: 'm1.quarters', d: 1, prompt: 'Shade one quarter of the bar.', rows: [{ den: 4 }], targets: [F(1, 4)], hints: ['The bar is cut into 4 equal parts.', 'A quarter is one of the 4 parts.', 'Tap one part.'], explanation: 'A quarter is 1 of 4 equal parts, so 1 part is shaded.' },
  { skill: 'm1.quarters', d: 1, prompt: 'Shade three quarters of the bar.', rows: [{ den: 4 }], targets: [F(3, 4)], hints: ['The bar has 4 equal parts.', 'Each part is one quarter.', 'Shade 3 parts.'], explanation: 'Three quarters means 3 of the 4 equal parts are shaded.' },
  { skill: 'm1.quarters', d: 2, prompt: 'Cut the bar into quarters, then shade one quarter.', rows: [{}], splits: [2, 3, 4, 5], targets: [F(1, 4)], exactSplit: true, hints: ['Quarters need 4 equal parts.', 'Tap 4 under Cut into.', 'Shade 1 part.'], explanation: 'Quarters come from 4 equal parts. Shading 1 part shows one quarter.' },
  { skill: 'm1.quarters', d: 2, prompt: 'Cut the bar into quarters, then shade two quarters.', rows: [{}], splits: [2, 3, 4, 5], targets: [F(2, 4)], exactSplit: true, hints: ['Quarters need 4 equal parts.', 'Tap 4 under Cut into.', 'Shade 2 parts.'], explanation: 'Two quarters is 2 of the 4 equal parts. It is the same as one half.' },
  { skill: 'm2.fractions-shapes', d: 1, prompt: 'Shade two thirds of the bar.', rows: [{ den: 3 }], targets: [F(2, 3)], hints: ['The bar is cut into 3 equal parts.', 'Each part is one third.', 'Shade 2 parts.'], explanation: 'Two thirds means 2 of the 3 equal parts are shaded.' },
  { skill: 'm2.fractions-shapes', d: 2, prompt: 'Shade three eighths of the bar.', rows: [{ den: 8 }], targets: [F(3, 8)], hints: ['Eighths are 8 equal parts.', 'The bottom number says how many parts in all.', 'Shade 3 parts.'], explanation: 'Three eighths means 3 of the 8 equal parts are shaded.' },
  { skill: 'm2.fractions-shapes', d: 2, prompt: 'Cut the bar into sixths, then shade five sixths.', rows: [{}], splits: [2, 3, 4, 6, 8], targets: [F(5, 6)], exactSplit: true, hints: ['Sixths need 6 equal parts.', 'Tap 6 under Cut into.', 'Shade 5 parts.'], explanation: 'Sixths come from 6 equal parts, and five sixths means 5 of them are shaded.' },
  { skill: 'm2.fractions-shapes', d: 3, prompt: 'Bar 1 shows one half. Shade bar 2 so it shows the same amount.', rows: [{ den: 2, locked: 1 }, { den: 4 }], targets: [null, F(2, 4)], hints: ['Look at how much of bar 1 is shaded.', 'Bar 2 has smaller parts.', 'Shade 2 parts of bar 2 to reach the same length.'], explanation: 'Half of a bar cut into 4 parts is 2 parts, so 2/4 is the same as 1/2.' },
  { skill: 'm3.fractions', d: 1, prompt: 'Shade four fifths of the bar.', rows: [{ den: 5 }], targets: [F(4, 5)], hints: ['The bar is cut into 5 equal parts.', 'The top number says how many parts to shade.', 'Shade 4 parts.'], explanation: 'Four fifths means 4 of the 5 equal parts are shaded.' },
  { skill: 'm3.fractions', d: 2, prompt: 'Cut the bar into tenths, then shade seven tenths.', rows: [{}], splits: [2, 3, 4, 5, 6, 8, 10, 12], targets: [F(7, 10)], exactSplit: true, hints: ['Tenths need 10 equal parts.', 'Tap 10 under Cut into.', 'Shade 7 parts.'], explanation: 'Tenths come from 10 equal parts, and seven tenths means 7 of them are shaded.' },
  { skill: 'm3.fractions', d: 2, prompt: 'Shade three sixths on bar 1 and one third on bar 2.', rows: [{ den: 6 }, { den: 3 }], targets: [F(3, 6), F(1, 3)], hints: ['Bar 1 has 6 parts and bar 2 has 3 parts.', 'Three sixths means 3 of the 6 parts.', 'One third means 1 of the 3 parts.'], explanation: 'Bar 1 has 3 of 6 parts shaded and bar 2 has 1 of 3 parts shaded.' },
  { skill: 'm3.fractions', d: 3, prompt: 'Bar 1 shows three quarters. Shade bar 2 so it shows the same amount.', rows: [{ den: 4, locked: 3 }, { den: 8 }], relation: 'eq', targets: [null, null], hints: ['Compare the lengths of the shaded parts.', 'Each quarter is the same as 2 eighths.', 'Shade 6 parts of bar 2.'], explanation: 'Three quarters is 6 eighths, because each quarter is 2 eighths.' },
  { skill: 'm3.equivalent-fractions', d: 2, prompt: 'Bar 1 shows one half. Shade bar 2 so it shows the same amount.', rows: [{ den: 2, locked: 1 }, { den: 6 }], targets: [null, F(3, 6)], hints: ['Bar 2 is cut into 6 equal parts.', 'Half of 6 parts is 3 parts.', 'Shade 3 parts of bar 2.'], explanation: 'One half is the same as 3 sixths, because 3 is half of 6.' },
  { skill: 'm3.equivalent-fractions', d: 3, prompt: 'Bar 1 shows one third. Cut bar 2 into twelfths and shade the same amount.', rows: [{ den: 3, locked: 1 }, {}], splits: [3, 6, 9, 12], targets: [null, F(4, 12)], exactSplit: true, hints: ['Tap 12 under Cut into.', 'One third of 12 parts is 4 parts.', 'Shade 4 parts.'], explanation: 'One third is the same as 4 twelfths, because 12 shared into 3 equal groups is 4 each.' },
  { skill: 'm3.equivalent-fractions', d: 3, prompt: 'Bar 1 shows two quarters. Shade bar 2 and bar 3 so they show the same amount.', rows: [{ den: 4, locked: 2 }, { den: 8 }, { den: 12 }], targets: [null, F(4, 8), F(6, 12)], hints: ['Two quarters is the same as one half.', 'Half of 8 parts is 4 parts, and half of 12 parts is 6 parts.', 'Shade 4 parts of bar 2 and 6 parts of bar 3.'], explanation: 'Two quarters is one half. One half is 4 of 8 parts and 6 of 12 parts.' },
  { skill: 'm3.equivalent-fractions', d: 3, prompt: 'Bar 1 shows two fifths. Shade bar 2 so it shows the same amount.', rows: [{ den: 5, locked: 2 }, { den: 10 }], targets: [null, F(4, 10)], hints: ['Bar 2 has twice as many parts as bar 1.', 'Twice as many parts means twice as many shaded.', 'Shade 4 parts of bar 2.'], explanation: 'Two fifths is the same as 4 tenths, because both numbers double.' },
  { skill: 'm4.equivalent-fractions', d: 3, prompt: 'Bar 1 shows two thirds. Shade bar 2 so it shows the same amount.', rows: [{ den: 3, locked: 2 }, { den: 12 }], targets: [null, F(8, 12)], hints: ['12 is 4 times 3.', 'Multiply the shaded parts by 4 too.', 'Shade 8 parts of bar 2.'], explanation: 'Two thirds is the same as 8 twelfths, because 2 times 4 is 8 and 3 times 4 is 12.' },
  { skill: 'm4.equivalent-fractions', d: 4, prompt: 'Bar 1 shows three sixths. Cut bar 2 any way that can show the same amount, then shade it.', rows: [{ den: 6, locked: 3 }, {}], splits: [3, 4, 5, 6, 8, 10, 12], targets: [null, F(1, 2)], hints: ['Three sixths is the same as one half.', 'Pick a number of parts that can be split into 2 equal groups.', 'For example 4 parts with 2 shaded, or 8 parts with 4 shaded.'], explanation: 'Three sixths is one half. Any even number of parts works, shading half of them.' },
  { skill: 'm4.equivalent-fractions', d: 3, prompt: 'Bar 1 shows five tenths. Shade bar 2 so it shows the same amount.', rows: [{ den: 10, locked: 5 }, { den: 4 }], targets: [null, F(2, 4)], hints: ['Five tenths is the same as one half.', 'Bar 2 has 4 parts, and half of 4 is 2.', 'Shade 2 parts of bar 2.'], explanation: 'Five tenths is one half, and one half of bar 2 is 2 of its 4 parts.' },
  { skill: 'm5.compare-fractions', d: 4, prompt: 'Bar 1 shows three quarters. Shade bar 2 so it shows more than bar 1.', rows: [{ den: 4, locked: 3 }, { den: 8 }], relation: 'gt', targets: [null, null], hints: ['Three quarters is the same as 6 eighths.', 'Bar 2 must show more than 6 eighths.', 'Shade 7 or 8 parts of bar 2.'], explanation: 'Three quarters is 6 eighths, so 7 or 8 eighths is more.' },
  { skill: 'm5.compare-fractions', d: 4, prompt: 'Bar 1 shows two fifths. Shade bar 2 so it shows more than bar 1.', rows: [{ den: 5, locked: 2 }, { den: 10 }], relation: 'gt', targets: [null, null], hints: ['Two fifths is the same as 4 tenths.', 'Bar 2 must show more than 4 tenths.', 'Shade 5 or more parts of bar 2.'], explanation: 'Two fifths is 4 tenths, so anything above 4 tenths is more.' },
]
for (const s of fracSpecs) {
  add(s.skill, {
    type: 'fractionbar',
    difficulty: s.d,
    prompt: s.prompt,
    rows: s.rows,
    ...(s.splits ? { splits: s.splits } : {}),
    targets: s.targets,
    ...(s.exactSplit ? { exactSplit: true } : {}),
    ...(s.relation ? { relation: s.relation } : {}),
    hints: s.hints,
    explanation: s.explanation,
    tags: ['manipulative', 'fractionbar'],
  })
}

// ------------------------------------------------------------------ Model batang

type ModelSpec = {
  skill: string
  d: number
  kind: 'partwhole' | 'compare'
  prompt: string
  bars: { label: string; units: number }[]
  extra?: string[]
  unit?: number
  unitName?: string
  /** Pemeriksa angka: total semua batang, atau nilai satu batang tertentu. */
  total?: number
  given?: { label: string; value: number }
  hints: [string, string, string]
  explanation: string
}
const M = (label: string, units: number) => ({ label, units })
const modelSpecs: ModelSpec[] = [
  { skill: 'm2.addition', d: 1, kind: 'partwhole', prompt: 'Ayu has 6 red beads and 3 blue beads. Build a part-whole model with one unit for each bead.', bars: [M('Red beads', 6), M('Blue beads', 3)], extra: ['Green beads'], hints: ['Each unit stands for one bead.', 'Make one bar for each colour that Ayu has.', 'Red beads get 6 units and blue beads get 3 units.'], explanation: 'The red part has 6 units and the blue part has 3 units. Together they make 9 units.' },
  { skill: 'm2.addition', d: 1, kind: 'partwhole', prompt: 'Budi picked 7 mangoes in the morning and 4 in the afternoon. Build a part-whole model with one unit for each mango.', bars: [M('Morning', 7), M('Afternoon', 4)], extra: ['Evening'], hints: ['Each unit stands for one mango.', 'Make one bar for each time of day.', 'Morning gets 7 units and afternoon gets 4 units.'], explanation: 'The morning part has 7 units and the afternoon part has 4 units. Together they make 11 units.' },
  { skill: 'm2.addition', d: 2, kind: 'partwhole', prompt: 'A shelf has 5 story books and 8 picture books. Build a part-whole model with one unit for each book.', bars: [M('Story books', 5), M('Picture books', 8)], extra: ['Maths books'], hints: ['Each unit stands for one book.', 'Label one part for each kind of book.', 'Story books get 5 units and picture books get 8 units.'], explanation: 'The story part has 5 units and the picture part has 8 units. The whole is 13 units.' },
  { skill: 'm2.subtraction', d: 1, kind: 'compare', prompt: 'Citra has 9 stickers and Dika has 4 stickers. Build a comparison model with one unit for each sticker.', bars: [M('Citra', 9), M('Dika', 4)], extra: ['Eka'], hints: ['Each unit stands for one sticker.', 'Make one bar for each child.', 'Citra gets 9 units and Dika gets 4 units.'], explanation: 'Citra has 9 units and Dika has 4 units. The longer bar shows who has more.' },
  { skill: 'm2.subtraction', d: 2, kind: 'compare', prompt: 'A tall tower has 11 blocks and a short tower has 7 blocks. Build a comparison model with one unit for each block.', bars: [M('Tall tower', 11), M('Short tower', 7)], extra: ['Wide tower'], hints: ['Each unit stands for one block.', 'Make one bar for each tower.', 'The tall tower gets 11 units and the short tower gets 7 units.'], explanation: 'The tall tower is 11 units and the short tower is 7 units. The difference is 4 units.' },
  { skill: 'm2.subtraction', d: 2, kind: 'compare', prompt: 'Fajar read 12 pages on Monday and 5 pages on Tuesday. Build a comparison model with one unit for each page.', bars: [M('Monday', 12), M('Tuesday', 5)], extra: ['Wednesday'], hints: ['Each unit stands for one page.', 'Make one bar for each day.', 'Monday gets 12 units and Tuesday gets 5 units.'], explanation: 'Monday is 12 units and Tuesday is 5 units. The difference is 7 units.' },
  { skill: 'm3.times-tables', d: 2, kind: 'compare', prompt: 'Gita has 3 times as many shells as Hana. Hana has 4 shells. Build the model and say what one unit is worth.', bars: [M('Hana', 1), M('Gita', 3)], extra: ['Indra'], unit: 4, unitName: 'shells', given: { label: 'Hana', value: 4 }, hints: ['Hana is the smaller amount, so she gets 1 unit.', 'Gita has 3 times as many, so she gets 3 units.', 'One unit is the number of shells Hana has.'], explanation: 'Hana is 1 unit, which is 4 shells. Gita is 3 units, which is 3 groups of 4.' },
  { skill: 'm3.times-tables', d: 2, kind: 'compare', prompt: 'A ribbon is 5 times as long as a string. The string is 3 cm long. Build the model and say what one unit is worth.', bars: [M('String', 1), M('Ribbon', 5)], extra: ['Rope'], unit: 3, unitName: 'cm', given: { label: 'String', value: 3 }, hints: ['The string is the shorter length, so it gets 1 unit.', 'The ribbon is 5 times as long, so it gets 5 units.', 'One unit is the length of the string.'], explanation: 'The string is 1 unit, which is 3 cm. The ribbon is 5 units, which is 5 groups of 3 cm.' },
  { skill: 'm3.times-tables', d: 3, kind: 'compare', prompt: 'Indra has 2 times as many cards as Joko. Joko has 7 cards. Build the model and say what one unit is worth.', bars: [M('Joko', 1), M('Indra', 2)], extra: ['Kiki'], unit: 7, unitName: 'cards', given: { label: 'Joko', value: 7 }, hints: ['Joko has the smaller amount, so he gets 1 unit.', 'Indra has twice as many, so he gets 2 units.', 'One unit is the number of cards Joko has.'], explanation: 'Joko is 1 unit, which is 7 cards. Indra is 2 units, which is 14 cards.' },
  { skill: 'm3.fractions-of-amounts', d: 2, kind: 'partwhole', prompt: 'Kiki has 20 sweets and eats one fifth of them. Build a part-whole model with 5 equal units and say what one unit is worth.', bars: [M('Eaten', 1), M('Left', 4)], extra: ['Shared'], unit: 4, unitName: 'sweets', total: 20, hints: ['One fifth means the whole is cut into 5 equal units.', 'Eaten is 1 unit and left is the other 4 units.', 'Share 20 sweets equally between 5 units.'], explanation: '20 divided by 5 is 4, so one unit is 4 sweets. Kiki eats 1 unit and has 4 units left.' },
  { skill: 'm3.fractions-of-amounts', d: 3, kind: 'partwhole', prompt: 'There are 18 children in a class and one third wear glasses. Build a part-whole model with 3 equal units and say what one unit is worth.', bars: [M('Glasses', 1), M('No glasses', 2)], extra: ['Hats'], unit: 6, unitName: 'children', total: 18, hints: ['One third means 3 equal units in the whole.', 'Glasses is 1 unit and no glasses is the other 2 units.', 'Share 18 children equally between 3 units.'], explanation: '18 divided by 3 is 6, so one unit is 6 children. Glasses is 1 unit and no glasses is 2 units.' },
  { skill: 'm3.fractions-of-amounts', d: 3, kind: 'partwhole', prompt: 'A jar holds 24 coins and three quarters are silver. Build a part-whole model with 4 equal units and say what one unit is worth.', bars: [M('Silver', 3), M('Other coins', 1)], extra: ['Gold'], unit: 6, unitName: 'coins', total: 24, hints: ['Quarters mean 4 equal units in the whole.', 'Silver is 3 units and the other coins are 1 unit.', 'Share 24 coins equally between 4 units.'], explanation: '24 divided by 4 is 6, so one unit is 6 coins. Silver is 3 units, which is 18 coins.' },
  { skill: 'm4.fractions-of-amounts', d: 3, kind: 'partwhole', prompt: 'A farmer has 35 hens and two sevenths are brown. Build a part-whole model with 7 equal units and say what one unit is worth.', bars: [M('Brown', 2), M('White', 5)], extra: ['Black'], unit: 5, unitName: 'hens', total: 35, hints: ['Sevenths mean 7 equal units in the whole.', 'Brown is 2 units and white is the other 5 units.', 'Share 35 hens equally between 7 units.'], explanation: '35 divided by 7 is 5, so one unit is 5 hens. Brown is 2 units, which is 10 hens.' },
  { skill: 'm4.fractions-of-amounts', d: 4, kind: 'partwhole', prompt: 'A tank holds 48 litres and is five eighths full. Build a part-whole model with 8 equal units and say what one unit is worth.', bars: [M('Water', 5), M('Space', 3)], extra: ['Mud'], unit: 6, unitName: 'litres', total: 48, hints: ['Eighths mean 8 equal units in the whole.', 'Water is 5 units and the empty space is 3 units.', 'Share 48 litres equally between 8 units.'], explanation: '48 divided by 8 is 6, so one unit is 6 litres. The water is 5 units, which is 30 litres.' },
  { skill: 'm4.fractions-of-amounts', d: 4, kind: 'partwhole', prompt: 'A book has 90 pages and Lola has read three tenths. Build a part-whole model with 10 equal units and say what one unit is worth.', bars: [M('Read', 3), M('Not read', 7)], extra: ['Torn'], unit: 9, unitName: 'pages', total: 90, hints: ['Tenths mean 10 equal units in the whole.', 'Read is 3 units and not read is 7 units.', 'Share 90 pages equally between 10 units.'], explanation: '90 divided by 10 is 9, so one unit is 9 pages. Lola has read 3 units, which is 27 pages.' },
  { skill: 'm4.add-sub-written', d: 3, kind: 'compare', prompt: 'Mika has 3 times as many coins as Nia. Together they have 80 coins. Build the model and say what one unit is worth.', bars: [M('Nia', 1), M('Mika', 3)], extra: ['Oka'], unit: 20, unitName: 'coins', total: 80, hints: ['Nia has the smaller amount, so she gets 1 unit.', 'Mika gets 3 units, so there are 4 units in all.', 'Share 80 coins equally between 4 units.'], explanation: '80 divided by 4 is 20, so one unit is 20 coins. Nia has 20 coins and Mika has 60.' },
  { skill: 'm4.add-sub-written', d: 4, kind: 'compare', prompt: 'Oka has twice as many marbles as Pia, and 30 more than Pia. Build the model and say what one unit is worth.', bars: [M('Pia', 1), M('Oka', 2)], extra: ['Raka'], unit: 30, unitName: 'marbles', given: { label: 'Pia', value: 30 }, hints: ['Pia has the smaller amount, so she gets 1 unit.', 'Oka has twice as many, so he gets 2 units.', 'The extra unit that Oka has is worth 30 marbles.'], explanation: 'Oka has 1 unit more than Pia, and that unit is 30 marbles. So Pia has 30 and Oka has 60.' },
  { skill: 'm5.fractions-of-amounts', d: 4, kind: 'partwhole', prompt: 'A road trip is 120 km. Dina drove three eighths of it before lunch. Build a part-whole model with 8 equal units and say what one unit is worth.', bars: [M('Before lunch', 3), M('After lunch', 5)], extra: ['At lunch'], unit: 15, unitName: 'km', total: 120, hints: ['Eighths mean 8 equal units in the whole.', 'Before lunch is 3 units and after lunch is 5 units.', 'Share 120 km equally between 8 units.'], explanation: '120 divided by 8 is 15, so one unit is 15 km. Dina drove 3 units, which is 45 km, before lunch.' },
  { skill: 'm5.fractions-of-amounts', d: 4, kind: 'partwhole', prompt: 'A school sold five sixths of its 72 tickets. Build a part-whole model with 6 equal units and say what one unit is worth.', bars: [M('Sold', 5), M('Not sold', 1)], extra: ['Lost'], unit: 12, unitName: 'tickets', total: 72, hints: ['Sixths mean 6 equal units in the whole.', 'Sold is 5 units and not sold is 1 unit.', 'Share 72 tickets equally between 6 units.'], explanation: '72 divided by 6 is 12, so one unit is 12 tickets. Sold is 5 units, which is 60 tickets.' },
  { skill: 'm5.ratio-proportion', d: 4, kind: 'partwhole', prompt: 'Red and white paint are mixed in the ratio 2 to 3. A pot holds 30 litres. Build the model and say what one unit is worth.', bars: [M('Red', 2), M('White', 3)], extra: ['Blue'], unit: 6, unitName: 'litres', total: 30, hints: ['The ratio 2 to 3 gives 2 units of red and 3 units of white.', 'There are 5 units in all.', 'Share 30 litres equally between 5 units.'], explanation: '30 divided by 5 is 6, so one unit is 6 litres. Red is 2 units, which is 12 litres.' },
  { skill: 'm5.ratio-proportion', d: 4, kind: 'compare', prompt: 'Sam and Tara share 36 stickers in the ratio 1 to 5. Build the model and say what one unit is worth.', bars: [M('Sam', 1), M('Tara', 5)], extra: ['Uma'], unit: 6, unitName: 'stickers', total: 36, hints: ['The ratio 1 to 5 gives Sam 1 unit and Tara 5 units.', 'There are 6 units in all.', 'Share 36 stickers equally between 6 units.'], explanation: '36 divided by 6 is 6, so one unit is 6 stickers. Sam gets 6 and Tara gets 30.' },
  { skill: 'm5.ratio-proportion', d: 5, kind: 'partwhole', prompt: 'Orange juice and soda are mixed in the ratio 3 to 2 to make 20 cups of punch. Build the model and say what one unit is worth.', bars: [M('Orange juice', 3), M('Soda', 2)], extra: ['Water'], unit: 4, unitName: 'cups', total: 20, hints: ['The ratio 3 to 2 gives 3 units of juice and 2 units of soda.', 'There are 5 units in all.', 'Share 20 cups equally between 5 units.'], explanation: '20 divided by 5 is 4, so one unit is 4 cups. Juice is 3 units, which is 12 cups.' },
  { skill: 'm6.ratio-proportion', d: 5, kind: 'compare', prompt: 'A club has boys and girls in the ratio 4 to 5. There are 45 children in the club. Build the model and say what one unit is worth.', bars: [M('Boys', 4), M('Girls', 5)], extra: ['Adults'], unit: 5, unitName: 'children', total: 45, hints: ['The ratio 4 to 5 gives boys 4 units and girls 5 units.', 'There are 9 units in all.', 'Share 45 children equally between 9 units.'], explanation: '45 divided by 9 is 5, so one unit is 5 children. There are 20 boys and 25 girls.' },
  { skill: 'm6.ratio-proportion', d: 5, kind: 'partwhole', prompt: 'Lea has blue and green beads in the ratio 3 to 7, and 60 beads in all. Build the model and say what one unit is worth.', bars: [M('Blue', 3), M('Green', 7)], extra: ['Red'], unit: 6, unitName: 'beads', total: 60, hints: ['The ratio 3 to 7 gives blue 3 units and green 7 units.', 'There are 10 units in all.', 'Share 60 beads equally between 10 units.'], explanation: '60 divided by 10 is 6, so one unit is 6 beads. Blue is 18 beads and green is 42 beads.' },
  { skill: 'm6.percentages', d: 4, kind: 'partwhole', prompt: 'A bike costs 80 dollars. Fitri has saved 30 percent of the price. Build a model with 10 equal units, each worth 10 percent, and say what one unit is worth in dollars.', bars: [M('Saved', 3), M('Still needed', 7)], extra: ['Spent'], unit: 8, unitName: 'dollars', total: 80, hints: ['10 percent is one tenth, so the whole is 10 units.', 'Saved is 3 units and still needed is 7 units.', 'Share 80 dollars equally between 10 units.'], explanation: '80 divided by 10 is 8, so one unit is 8 dollars. Fitri has saved 3 units, which is 24 dollars.' },
]
for (const s of modelSpecs) {
  const units = s.bars.reduce((n, b) => n + b.units, 0)
  if (s.total !== undefined) assert(units * (s.unit ?? 0) === s.total, `barmodel total mismatch: ${s.prompt}`)
  if (s.given) assert((s.bars.find((b) => b.label === s.given!.label)?.units ?? 0) * (s.unit ?? 0) === s.given.value, `barmodel given mismatch: ${s.prompt}`)
  assert(s.bars.every((b) => b.units <= 12), `barmodel units too big: ${s.prompt}`)
  add(s.skill, {
    type: 'barmodel',
    difficulty: s.d,
    kind: s.kind,
    prompt: s.prompt,
    bars: s.bars,
    extraLabels: s.extra ?? [],
    ...(s.unit !== undefined ? { unitValue: s.unit } : {}),
    ...(s.unitName ? { unitName: s.unitName } : {}),
    hints: s.hints,
    explanation: s.explanation,
    tags: ['manipulative', 'barmodel', s.kind],
  })
}

// ------------------------------------------------------------------ Tangram

const rng = createRng('peraga-tangram-v1')
const fmtPieces = (types: PieceType[]): string => {
  const n: Partial<Record<PieceType, number>> = {}
  for (const t of types) n[t] = (n[t] ?? 0) + 1
  const parts = PIECE_TYPES.filter((t) => n[t]).map((t) => plural(n[t]!, PIECE_NAME[t]))
  return parts.length === 1 ? parts[0]! : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}
const shift = (pts: readonly Pt[], dx: number, dy: number): Pt[] => pts.map((p): Pt => [p[0] + dx, p[1] + dy])

function buildTangram(types: PieceType[]): Pt[][] | null {
  const placed: Pt[][] = []
  const order = rng.shuffle(types)
  for (const t of order) {
    if (placed.length === 0) {
      placed.push(orient(t, rng.int(0, 3), rng.chance(0.5)))
      continue
    }
    const options: Pt[][] = []
    for (const flip of [false, true]) {
      for (let rot = 0; rot < 4; rot++) {
        const base = orient(t, rot, flip)
        for (let dx = -5; dx <= 8; dx++) {
          for (let dy = -5; dy <= 8; dy++) {
            const poly = shift(base, dx, dy)
            if (placed.some((q) => overlapArea(poly, q) > 0.01)) continue
            if (!placed.some((q) => shareEdge(poly, q))) continue
            options.push(poly)
          }
        }
      }
    }
    if (options.length === 0) return null
    placed.push(rng.pick(options))
  }
  const minX = Math.min(...placed.flat().map((p) => p[0]))
  const minY = Math.min(...placed.flat().map((p) => p[1]))
  const slots = placed.map((p) => shift(p, -minX, -minY))
  const w = Math.max(...slots.flat().map((p) => p[0]))
  const h = Math.max(...slots.flat().map((p) => p[1]))
  const area = types.reduce((n, t) => n + PIECE_AREA[t], 0)
  // Hindari bentuk yang terlalu memanjang atau berongga.
  if (w > 9 || h > 9 || w * h > area * 2.6) return null
  return slots
}

const bag = (): PieceType[] => PIECE_TYPES.flatMap((t) => Array.from({ length: PIECE_COUNT[t] }, () => t))
const intro = ['Fit all the pieces into the outline.', 'Build the shape with these pieces.', 'Complete the puzzle by filling every place.', 'Fill the outline with the pieces.']
const tangramPlan: { skill: string; count: number; d: number }[] = [
  ...[2, 2, 3, 3, 3, 3].map((count) => ({ skill: 'm1.shapes-2d', count, d: 1 })),
  ...[3, 3, 4, 4, 4, 4].map((count) => ({ skill: 'm2.shapes-2d', count, d: 2 })),
  ...[4, 4, 5, 5, 5, 5].map((count) => ({ skill: 'm3.shapes-2d', count, d: 3 })),
  ...[5, 6, 6, 7].map((count) => ({ skill: 'm4.shapes-2d', count, d: 4 })),
  ...[3, 4, 5].map((count) => ({ skill: 'm3.shapes-2d', count, d: 3 })),
]
const seen = new Set<string>()
let tIndex = 0
for (const plan of tangramPlan) {
  for (let attempt = 0; attempt < 400; attempt++) {
    const types = rng.sample(bag(), plan.count)
    const slots = buildTangram(types)
    if (!slots) continue
    const problems = tangramProblems({ pieces: types, slots })
    if (problems.length > 0) continue
    const sig = slots.map((s) => s.map((p) => p.join(',')).join(';')).sort().join('|')
    if (seen.has(sig)) continue
    seen.add(sig)
    const sorted = [...types].sort((a, b) => PIECE_AREA[b] - PIECE_AREA[a] || a.localeCompare(b))
    const biggest = sorted[0]!
    const hasP = sorted.includes('P')
    add(plan.skill, {
      type: 'tangram',
      difficulty: plan.d,
      prompt: `${intro[tIndex % intro.length]} You have ${fmtPieces(sorted)}.`,
      pieces: sorted,
      slots,
      hints: [
        `Start with the biggest outline. It needs the ${PIECE_NAME[biggest]}.`,
        'Match a long straight edge of a piece to an edge of the outline. Tap Turn if the piece points the wrong way.',
        hasP ? 'The parallelogram can lean left or right. Tap Flip if it leans the wrong way.' : 'Tap a piece on the board to pick it up and try it in another place.',
      ],
      explanation: `The ${sorted.length} pieces fit together with no gaps: ${fmtPieces(sorted)}. Each piece fills one outline exactly.`,
      tags: ['manipulative', 'tangram'],
    })
    tIndex++
    break
  }
}

// ------------------------------------------------------------------ Geoboard

type GeoSpec = {
  skill: string
  d: number
  size: number
  prompt: string
  rule: GeoRule
  example: [number, number][]
  extraHint?: string
}
const G = (skill: string, d: number, size: number, prompt: string, rule: GeoRule, example: [number, number][]): GeoSpec => ({ skill, d, size, prompt, rule, example })
const geoSpecs: GeoSpec[] = [
  G('m2.shapes-2d', 1, 5, 'Make a triangle on the geoboard.', { shape: 'triangle' }, [[0, 0], [3, 0], [0, 2]]),
  G('m2.shapes-2d', 1, 5, 'Make a square on the geoboard.', { shape: 'square' }, [[1, 1], [3, 1], [3, 3], [1, 3]]),
  G('m2.shapes-2d', 2, 5, 'Make a rectangle on the geoboard. A square also counts.', { shape: 'rectangle' }, [[0, 0], [4, 0], [4, 2], [0, 2]]),
  G('m3.shapes-2d', 2, 5, 'Make a shape with exactly 5 sides.', { sides: 5 }, [[0, 0], [2, 0], [3, 1], [2, 2], [0, 2]]),
  G('m3.shapes-2d', 3, 5, 'Make a shape with exactly 6 sides.', { sides: 6 }, [[0, 0], [3, 0], [3, 1], [1, 1], [1, 3], [0, 3]]),
  G('m3.shapes-2d', 3, 5, 'Make a triangle that has a right angle.', { shape: 'right-triangle' }, [[0, 0], [4, 0], [0, 3]]),
  G('m3.perimeter-area', 2, 5, 'Make a rectangle with an area of 6 square units.', { shape: 'rectangle', area: 6 }, [[0, 0], [3, 0], [3, 2], [0, 2]]),
  G('m3.perimeter-area', 2, 5, 'Make a square with a perimeter of 12 units.', { shape: 'square', perimeter: 12 }, [[0, 0], [3, 0], [3, 3], [0, 3]]),
  G('m3.perimeter-area', 3, 5, 'Make a rectangle with a perimeter of 10 units and an area of 4 square units.', { shape: 'rectangle', perimeter: 10, area: 4 }, [[0, 0], [4, 0], [4, 1], [0, 1]]),
  G('m3.perimeter-area', 3, 7, 'Make a rectangle with a perimeter of 14 units.', { shape: 'rectangle', perimeter: 14 }, [[0, 0], [4, 0], [4, 3], [0, 3]]),
  G('m3.perimeter-area', 3, 6, 'Make a shape with an area of 5 square units, using only sides that go straight across or straight up.', { rectilinear: true, area: 5 }, [[0, 0], [5, 0], [5, 1], [0, 1]]),
  G('m4.perimeter-area', 3, 5, 'Make an L-shape with 6 sides, all along the grid, and an area of 7 square units.', { sides: 6, rectilinear: true, area: 7 }, [[0, 0], [4, 0], [4, 1], [1, 1], [1, 4], [0, 4]]),
  G('m4.perimeter-area', 4, 7, 'Make a rectangle with an area of 12 square units and a perimeter of 16 units.', { shape: 'rectangle', area: 12, perimeter: 16 }, [[0, 0], [6, 0], [6, 2], [0, 2]]),
  G('m4.perimeter-area', 4, 6, 'Make a rectangle with an area of 15 square units and a perimeter of 16 units.', { shape: 'rectangle', area: 15, perimeter: 16 }, [[0, 0], [5, 0], [5, 3], [0, 3]]),
  G('m4.perimeter-area', 3, 5, 'Make a square with an area of 9 square units.', { shape: 'square', area: 9 }, [[0, 0], [3, 0], [3, 3], [0, 3]]),
  G('m4.perimeter-area', 4, 6, 'Make a rectangle with a perimeter of 18 units and an area of 20 square units.', { shape: 'rectangle', perimeter: 18, area: 20 }, [[0, 0], [5, 0], [5, 4], [0, 4]]),
  G('m5.perimeter-area', 4, 6, 'Make a right-angled triangle with an area of 6 square units.', { shape: 'right-triangle', area: 6 }, [[0, 0], [4, 0], [0, 3]]),
  G('m5.perimeter-area', 4, 5, 'Make an isosceles triangle with an area of 6 square units.', { shape: 'isosceles-triangle', area: 6 }, [[0, 0], [4, 0], [2, 3]]),
  G('m5.perimeter-area', 5, 5, 'Make a slanted parallelogram with an area of 6 square units. It must not be a rectangle.', { shape: 'slanted-parallelogram', area: 6 }, [[0, 0], [3, 0], [4, 2], [1, 2]]),
  G('m5.perimeter-area', 5, 5, 'Make a trapezium with an area of 9 square units.', { shape: 'trapezium', area: 9 }, [[0, 0], [4, 0], [3, 3], [1, 3]]),
  G('m6.area-perimeter', 4, 8, 'Make a rectangle with an area of 24 square units.', { shape: 'rectangle', area: 24 }, [[0, 0], [6, 0], [6, 4], [0, 4]]),
  G('m6.area-perimeter', 5, 5, 'Make an L-shape with 6 sides, all along the grid, a perimeter of 16 units and an area of 10 square units.', { sides: 6, rectilinear: true, perimeter: 16, area: 10 }, [[0, 0], [4, 0], [4, 2], [1, 2], [1, 4], [0, 4]]),
  G('m6.area-perimeter', 5, 6, 'Make a triangle with an area of 7.5 square units.', { shape: 'triangle', area: 7.5 }, [[0, 0], [5, 0], [1, 3]]),
  G('m6.area-triangles', 4, 6, 'Make a right-angled triangle with an area of 10 square units.', { shape: 'right-triangle', area: 10 }, [[0, 0], [5, 0], [0, 4]]),
  G('m6.area-triangles', 5, 5, 'Make an isosceles triangle with an area of 8 square units.', { shape: 'isosceles-triangle', area: 8 }, [[0, 0], [4, 0], [2, 4]]),
]
const SHAPE_WORD: Record<string, string> = {
  rectangle: 'rectangle',
  square: 'square',
  triangle: 'triangle',
  'right-triangle': 'right-angled triangle',
  'isosceles-triangle': 'isosceles triangle',
  'slanted-parallelogram': 'slanted parallelogram',
  trapezium: 'trapezium',
}
for (const s of geoSpecs) {
  const info = analysePegs(s.example)
  assert(info.ok, `geoboard example invalid: ${s.prompt}`)
  assert(s.example.every((p) => p[0] < s.size && p[1] < s.size), `geoboard example off board: ${s.prompt}`)
  if (s.rule.area !== undefined) assert(Math.abs(info.area - s.rule.area) < 1e-9, `geoboard area ${info.area}: ${s.prompt}`)
  if (s.rule.perimeter !== undefined) assert(Math.abs(info.perimeter - s.rule.perimeter) < 1e-9, `geoboard perimeter ${info.perimeter}: ${s.prompt}`)
  if (s.rule.sides !== undefined) assert(info.sides === s.rule.sides, `geoboard sides ${info.sides}: ${s.prompt}`)
  const hints: string[] = []
  if (s.rule.shape) hints.push(`A ${SHAPE_WORD[s.rule.shape]}: check the number of sides and the corners before you close the shape.`)
  else if (s.rule.sides) hints.push(`Count the sides in the Sides box. You need ${s.rule.sides}.`)
  else hints.push('Tap pegs one at a time to place corners, then tap the first peg again to close the shape.')
  if (s.rule.area !== undefined && s.rule.perimeter !== undefined) hints.push('Area counts the squares inside. Perimeter counts the units around the outside. Both boxes update as you draw.')
  else if (s.rule.area !== undefined) hints.push('Area is the number of unit squares inside the shape. Watch the Area box as you change the shape.')
  else if (s.rule.perimeter !== undefined) hints.push('Perimeter is the distance around the outside. Watch the Perimeter box as you change the shape.')
  else hints.push('Corners are where two sides meet. A peg in the middle of a straight side is not a corner.')
  hints.push(s.rule.area !== undefined || s.rule.perimeter !== undefined ? 'If a number is too big or too small, tap Undo and move one corner by a peg.' : 'If your shape is not right, tap Undo to remove the last corner and try another peg.')
  const exText = s.example.map((p) => `(${p[0]},${p[1]})`).join(', ')
  add(s.skill, {
    type: 'geoboard',
    difficulty: s.d,
    prompt: s.prompt,
    size: s.size,
    rule: s.rule,
    example: s.example,
    hints,
    explanation: `One answer uses the pegs ${exText}. It has ${plural(info.sides, 'side')}, a perimeter of ${formatLength(info.perimeter)} and an area of ${formatLength(info.area)} square units.`,
    tags: ['manipulative', 'geoboard'],
  })
}

// ------------------------------------------------------------------ Tulis

const dir = findContentDir()
let total = 0
for (const [skill, items] of out) {
  const m = /^m([1-6])\.(.+)$/.exec(skill)!
  const file = join(dir, 'items', 'math', `g${m[1]}`, `${m[2]}.tools.json`)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify({ skill, items }, null, 2)}\n`)
  total += items.length
}
const byType: Record<string, number> = {}
for (const items of out.values()) for (const it of items) byType[it.type as string] = (byType[it.type as string] ?? 0) + 1
console.log(`Ditulis ${total} soal di ${out.size} berkas`, byType)
