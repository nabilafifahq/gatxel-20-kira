import { fmt, gcd, mcqFrom, NAMES, rupiah } from './helpers'
import type { Generator } from './types'
import {
  addMinutes,
  anum,
  hhmm,
  timeAnswers,
  at,
  bigWords,
  cap,
  compareWhy,
  coordAnswers,
  dec,
  decChart,
  digitsOf,
  distinctDigits,
  factorsOf,
  fracAnswers,
  fs,
  mixed,
  over,
  simp,
  type Frac,
  fromDigits,
  fx,
  isPrime,
  jumpLine,
  lcm,
  lineItem,
  mcqItem,
  mcqText,
  multiItem,
  numItem,
  ORD,
  orderItem,
  PLACE,
  placeName,
  placePhrase,
  plur,
  PRIMES_TO_100,
  pvChart,
  range,
  roundTo,
  sortItem,
  sum,
  textItem,
  uniq,
  units,
  withTags,
  WP,
  deg,
  par,
  type Fig,
  type Hints,
  type Step,
} from './g5'

/**
 * Generator Math Grade 6 (Cambridge Primary Stage 6).
 * Helper bersama ada di g5.ts. Soal tingkat 2 ke atas diberi tag `checkpoint`
 * supaya bisa dipakai preset latihan Cambridge Primary Checkpoint.
 */

/** Tambah tag checkpoint untuk soal tingkat `from` ke atas. */
function checkpoint(gen: Generator, from = 2): Generator {
  return {
    skill: gen.skill,
    levels: gen.levels,
    generate(ctx) {
      const item = gen.generate(ctx)
      return ctx.level >= from ? withTags(item, ['checkpoint']) : item
    },
  }
}

/* ------------------------------------------------------------------ */
/* Np                                                                  */
/* ------------------------------------------------------------------ */

const placeValue: Generator = {
  skill: 'm6.place-value',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level === 1) {
      const ds = distinctDigits(rng, 7)
      const n = fromDigits(ds)
      const chart = pvChart(ds)
      if (rng.chance(0.5)) {
        const i = rng.pick(range(0, 5).filter((j) => at(ds, j) !== 0))
        const d = at(ds, i)
        const p = 6 - i
        const value = d * 10 ** p
        return numItem({
          prompt: `What is the value of the digit ${d} in ${fmt(n)}?`,
          answer: value,
          figure: chart,
          hints: [`Find the digit ${d} in ${fmt(n)}.`, 'Each column is worth 10 times the column on its right.', `The digit ${d} is in the ${at(PLACE, p)} column.`],
          explanation: `The digit ${d} is in the ${at(PLACE, p)} column, so it is worth ${d} × ${fmt(10 ** p)} = ${fmt(value)}.`,
          solution: [
            { say: 'Put the number in a place value chart.', figure: chart },
            { say: `The ${d} is in the ${at(PLACE, p)} column.`, show: `${d} × ${fmt(10 ** p)} = ${fmt(value)}` },
          ],
        })
      }
      const i = rng.int(0, 5)
      const p = 6 - i
      const d = at(ds, i)
      const others = ds.map((x, j) => ({ x, j })).filter((o) => o.j !== i)
      const m = mcqFrom(rng, d, rng.shuffle(others).map((o) => ({ value: o.x, why: `${o.x} is in the ${at(PLACE, 6 - o.j)} column.` })))
      return mcqItem({
        prompt: `Which digit is in the ${at(PLACE, p)} column of ${fmt(n)}?`,
        ...m,
        hints: ['Name the columns from the right: ones, tens, hundreds, thousands, and so on.', 'The commas split the number into groups of three columns.', `The digit just after the first comma is in the hundred thousands column.`],
        explanation: `${fmt(n)} has ${placePhrase(d, p)}, so the ${at(PLACE, p)} digit is ${d}.`,
        solution: [
          { say: 'Use a place value chart.', figure: chart },
          { say: `Read the ${at(PLACE, p)} column.`, show: `${cap(at(PLACE, p))}: ${d}` },
        ],
      })
    }

    if (level === 2) {
      const style = rng.int(0, 2)
      if (style === 0) {
        const w = rng.int(1, 9)
        const dd = rng.sample(range(2, 9).filter((x) => x !== w), 3)
        const u = w * 1000 + at(dd, 0) * 100 + at(dd, 1) * 10 + at(dd, 2)
        const n = dec(u, 3)
        const pos = rng.int(1, 3)
        const d = at(dd, pos - 1)
        const value = dec(d, pos)
        return numItem({
          prompt: `What is the value of the digit ${d} in ${fx(n, 3)}? Write it as a decimal.`,
          answer: value,
          decimal: true,
          figure: decChart(u, 3),
          hints: [`Find the digit ${d} in ${fx(n, 3)}.`, 'After the decimal point come tenths, hundredths, then thousandths.', `Count the places after the decimal point to reach the ${d}.`],
          explanation: `The ${d} is in the ${placeName(-pos)} place, so its value is ${placePhrase(d, -pos)} = ${fmt(value)}.`,
          solution: [
            { say: 'Put the number in a place value chart.', figure: decChart(u, 3) },
            { say: `The ${d} is in the ${placeName(-pos)} column.`, show: fmt(value) },
          ],
        })
      }
      if (style === 1) {
        const w = rng.int(0, 12)
        const ds = [rng.int(0, 9), rng.int(0, 9), rng.int(1, 9)]
        if (rng.chance(0.6)) ds[rng.int(0, 1)] = 0
        const u = w * 1000 + at(ds, 0) * 100 + at(ds, 1) * 10 + at(ds, 2)
        const bits = [placePhrase(w, 0), placePhrase(at(ds, 0), -1), placePhrase(at(ds, 1), -2), placePhrase(at(ds, 2), -3)]
        return numItem({
          prompt: `Write the number that has ${bits.slice(0, 3).join(', ')} and ${at(bits, 3)}.`,
          answer: dec(u, 3),
          decimal: true,
          hints: ['Tenths, hundredths and thousandths come after the decimal point.', 'Write a 0 for any place that has nothing in it.', `Start with ${w} and the decimal point.`],
          explanation: `The number is ${fx(dec(u, 3), 3)}.`,
          solution: [
            { say: 'Put each digit in its column.', figure: decChart(u, 3) },
            { say: 'Read the number.', show: fx(dec(u, 3), 3) },
          ],
        })
      }
      const mil = rng.int(1, 9)
      const rest = rng.pick([rng.int(1, 99) * 1000 + rng.int(10, 99), rng.int(100, 999) * 1000 + rng.int(1, 9), rng.int(1, 9) * 100000 + rng.int(1, 9) * 100])
      const n = mil * 1_000_000 + rest
      return numItem({
        prompt: `Write ${bigWords(n)} in figures.`,
        answer: n,
        hints: ['A million has six zeros: 1,000,000.', 'Write the millions, then the thousands, then the rest. Use 0 for empty columns.', `${cap(bigWords(mil * 1_000_000))} is ${fmt(mil * 1_000_000)}.`],
        explanation: `${cap(bigWords(mil * 1_000_000))} is ${fmt(mil * 1_000_000)} and the rest is ${fmt(rest)}, so the number is ${fmt(n)}.`,
        solution: [
          { say: 'Fill a place value chart.', figure: pvChart(digitsOf(n)) },
          { say: 'Read the number with commas.', show: fmt(n) },
        ],
      })
    }

    if (level === 3) {
      const w = rng.int(0, 9)
      const set = new Set<number>()
      if (rng.chance(0.5)) {
        const [a, b] = rng.sample(range(1, 9), 2) as [number, number]
        for (const u of rng.shuffle([100 * a + 10 * b, 100 * a + b, 10 * a + b, 100 * a, 100 * b + 10 * a, 100 * b])) {
          if (set.size < 5) set.add(w * 1000 + u)
        }
      } else {
        while (set.size < 5) {
          const dp = rng.pick([1, 2, 3])
          set.add(w * 1000 + (dp === 1 ? rng.int(1, 9) * 100 : dp === 2 ? rng.int(1, 99) * 10 : rng.int(1, 999)))
        }
      }
      const vals = [...set].map((u) => dec(u, 3)).slice(0, rng.int(4, 5))
      const asc = [...vals].sort((x, y) => x - y)
      if (rng.chance(0.5)) {
        const desc = rng.chance(0.4)
        const items = (desc ? [...asc].reverse() : asc).map(fmt)
        return orderItem({
          prompt: `Put these numbers in order, starting with the ${desc ? 'largest' : 'smallest'}.`,
          items,
          hints: ['Compare the whole numbers first, then tenths, hundredths and thousandths.', 'Write every number with three decimal places before you compare.', `For example, ${fmt(at(vals, 0))} = ${fx(at(vals, 0), 3)}.`],
          explanation: `With three decimal places: ${vals.map((v) => fx(v, 3)).join(', ')}. In order: ${items.join(', ')}.`,
          solution: [
            { say: 'Give each number three decimal places.', show: vals.map((v) => fx(v, 3)).join(', ') },
            { say: 'Compare digit by digit from the left.', show: asc.map(fmt).join(' < ') },
          ],
        })
      }
      const greatest = rng.chance(0.5)
      const four = vals.slice(0, 4)
      const sorted = [...four].sort((x, y) => x - y)
      const c = greatest ? at(sorted, 3) : at(sorted, 0)
      const m = mcqFrom(rng, c, four.filter((v) => v !== c).map((v) => ({ value: v, why: compareWhy(v, c, 3) })))
      return mcqItem({
        prompt: `Which number is the ${greatest ? 'greatest' : 'smallest'}?`,
        ...m,
        hints: ['A number with more digits after the point is not always bigger.', 'Write each number with three decimal places.', 'Compare the tenths first.'],
        explanation: `${fmt(c)} is the ${greatest ? 'greatest' : 'smallest'}. In order: ${sorted.map(fmt).join(', ')}.`,
        solution: [
          { say: 'Give each number three decimal places.', show: four.map((v) => fx(v, 3)).join(', ') },
          { say: 'Compare from the left.', show: sorted.map(fmt).join(' < ') },
        ],
      })
    }

    if (level === 4) {
      const style = rng.int(0, 2)
      if (style === 0) {
        const ds = [rng.int(1, 9), rng.int(1, 9), rng.int(1, 9), rng.int(1, 9)]
        const u = fromDigits(ds)
        const parts = [at(ds, 0), dec(at(ds, 1), 1), dec(at(ds, 2), 2), dec(at(ds, 3), 3)]
        const miss = rng.int(1, 3)
        const missing = at(parts, miss)
        return numItem({
          prompt: `Find the missing number. ${fx(dec(u, 3), 3)} = ${parts.map((v, j) => (j === miss ? '___' : fmt(v))).join(' + ')}`,
          answer: missing,
          decimal: true,
          hints: ['Each part is the value of one digit.', `Which digit of ${fx(dec(u, 3), 3)} has no part yet?`, `It is the ${placeName(-miss)} digit.`],
          explanation: `${fx(dec(u, 3), 3)} = ${parts.map(fmt).join(' + ')}, so the missing part is ${fmt(missing)}.`,
          solution: [
            { say: 'Split the number by place value.', figure: decChart(u, 3) },
            { say: `The ${placeName(-miss)} digit is ${at(ds, miss)}.`, show: fmt(missing) },
          ],
        })
      }
      if (style === 1) {
        const target = rng.pick([2, 3])
        const name = target === 3 ? 'thousandths' : 'hundredths'
        const dp = target === 3 ? rng.pick([1, 2]) : 1
        const u = rng.int(11, dp === 1 ? 99 : 999)
        const n = dec(u, dp)
        const ans = u * 10 ** (target - dp)
        return numItem({
          prompt: `How many ${name} are there in ${fmt(n)} altogether?`,
          answer: ans,
          hints: [`How many ${name} make 1 whole?`, target === 3 ? '1 whole = 1,000 thousandths, 1 tenth = 100 thousandths, 1 hundredth = 10 thousandths.' : '1 whole = 100 hundredths and 1 tenth = 10 hundredths.', `Multiply ${fmt(n)} by ${10 ** target}.`],
          explanation: `${fmt(n)} × ${fmt(10 ** target)} = ${fmt(ans)}, so there are ${fmt(ans)} ${name}.`,
          solution: [
            { say: `Change ${fmt(n)} into ${name}.` },
            { say: `Multiply by ${fmt(10 ** target)}.`, show: `${fmt(n)} × ${fmt(10 ** target)} = ${fmt(ans)}` },
          ],
        })
      }
      const B = rng.int(100, 989)
      const k = rng.int(1, 9)
      const min = dec(B, 2)
      const max = dec(B + 1, 2)
      const ans = dec(B * 10 + k, 3)
      return lineItem({
        prompt: `Mark ${fx(ans, 3)} on the number line.`,
        min,
        max,
        step: 0.001,
        answer: ans,
        hints: [`The line goes from ${fx(min, 2)} to ${fx(max, 2)}.`, 'There are 10 small steps. Each one is 0.001.', `Count on from ${fx(min, 2)} in thousandths.`],
        explanation: `${fx(ans, 3)} is ${k} thousandths more than ${fx(min, 2)}.`,
        solution: [
          { say: 'Each small step is one thousandth.' },
          { say: `Count ${k} steps from ${fx(min, 2)}.`, show: `${fx(min, 2)} + ${fx(dec(k, 3), 3)} = ${fx(ans, 3)}` },
        ],
      })
    }

    if (rng.chance(0.55)) {
      const more = rng.chance(0.5)
      const step = rng.pick([1, 10])
      const w = rng.int(1, 9)
      let u: number
      if (more) u = step === 1 ? w * 1000 + rng.int(0, 9) * 100 + rng.int(0, 9) * 10 + 9 : w * 1000 + rng.int(0, 9) * 100 + 90 + rng.int(0, 9)
      else u = step === 1 ? w * 1000 + rng.int(0, 9) * 100 + rng.int(0, 9) * 10 : w * 1000 + rng.int(0, 9) * 100 + rng.int(0, 9)
      if (more && rng.chance(0.3)) u = w * 1000 + 999 - (step === 10 ? rng.int(0, 9) : 0)
      if (!more && rng.chance(0.3)) u = w * 1000
      const n = dec(u, 3)
      const ans = dec(more ? u + step : u - step, 3)
      const stepText = step === 1 ? '0.001' : '0.01'
      const place = step === 1 ? 'thousandths' : 'hundredths'
      const digit = step === 1 ? u % 10 : Math.floor(u / 10) % 10
      return numItem({
        prompt: `What number is ${stepText} ${more ? 'more' : 'less'} than ${fmt(n)}?`,
        answer: ans,
        decimal: true,
        hints: [`${stepText} is one ${step === 1 ? 'thousandth' : 'hundredth'}.`, `Change the ${place} digit by 1 and regroup if you need to.`, `The ${place} digit of ${fmt(n)} is ${digit}.`],
        explanation: `${fmt(n)} ${more ? '+' : '−'} ${stepText} = ${fmt(ans)}.`,
        solution: [
          { say: `Look at the ${place} digit: ${digit}.` },
          { say: more ? 'Add 1 and regroup.' : 'Exchange if needed, then take away 1.', show: `${fmt(n)} ${more ? '+' : '−'} ${stepText} = ${fmt(ans)}` },
        ],
      })
    }
    const delta = rng.pick([10000, 100000])
    const more = rng.chance(0.5)
    const p = delta === 10000 ? 4 : 5
    const ds = [rng.int(2, 8), rng.int(0, 9), rng.int(0, 9), rng.int(0, 9), rng.int(0, 9), rng.int(0, 9), rng.int(0, 9)]
    ds[6 - p] = more ? 9 : 0
    if (p === 4) ds[1] = more ? 9 : 0
    const n = fromDigits(ds)
    const ans = more ? n + delta : n - delta
    return numItem({
      prompt: `What number is ${fmt(delta)} ${more ? 'more' : 'less'} than ${fmt(n)}?`,
      answer: ans,
      hints: [`Which column does ${fmt(delta)} change?`, `${more ? 'Adding' : 'Taking away'} ${fmt(delta)} changes the ${at(PLACE, p)} digit. Regroup when you need to.`, `The ${at(PLACE, p)} digit of ${fmt(n)} is ${at(ds, 6 - p)}.`],
      explanation: `${fmt(n)} ${more ? '+' : '−'} ${fmt(delta)} = ${fmt(ans)}. The change ripples into the next column${p === 4 ? 's' : ''}.`,
      solution: [
        { say: `Find the ${at(PLACE, p)} digit.`, show: String(at(ds, 6 - p)) },
        { say: 'Change it by 1 and regroup.', show: `${fmt(n)} ${more ? '+' : '−'} ${fmt(delta)} = ${fmt(ans)}` },
      ],
    })
  },
}

const rounding: Generator = {
  skill: 'm6.rounding',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level === 1) {
      const p = rng.pick([10000, 100000, 1000000])
      let n = rng.int(1_000_001, 9_899_999)
      if (rng.chance(0.35) && p < 1000000) n = Math.floor(n / (p * 10)) * (p * 10) + 9 * p + rng.int(p / 2, p - 1)
      if (n % p === 0) n += rng.int(1, p - 1)
      const lo = Math.floor(n / p) * p
      const hi = lo + p
      const r = roundTo(n, p)
      const dExp = Math.round(Math.log10(p)) - 1
      const decider = Math.floor(n / 10 ** dExp) % 10
      const hints: Hints = [`Which two multiples of ${fmt(p)} is ${fmt(n)} between?`, `Look at the ${at(PLACE, dExp)} digit. 5 or more rounds up.`, `The ${at(PLACE, dExp)} digit of ${fmt(n)} is ${decider}.`]
      const explanation = `${fmt(n)} is between ${fmt(lo)} and ${fmt(hi)}. The ${at(PLACE, dExp)} digit is ${decider}, so it rounds ${decider >= 5 ? 'up' : 'down'} to ${fmt(r)}.`
      const solution: Step[] = [
        { say: `${fmt(n)} is between ${fmt(lo)} and ${fmt(hi)}.` },
        { say: `The ${at(PLACE, dExp)} digit is ${decider}.`, show: `${fmt(n)} → ${fmt(r)}` },
      ]
      if (rng.chance(0.45)) {
        const m = mcqFrom(rng, r, [
          { value: r === lo ? hi : lo, why: `Look at the ${at(PLACE, dExp)} digit again. It is ${decider}.` },
          { value: roundTo(n, p / 10), why: `That is rounded to the nearest ${fmt(p / 10)}.` },
          { value: roundTo(n, p * 10), why: `That is rounded to the nearest ${fmt(p * 10)}.` },
          { value: lo + p / 2, why: `That is halfway between ${fmt(lo)} and ${fmt(hi)}.` },
          { value: r === hi ? hi + p : lo - p, why: `That is too far. ${fmt(n)} is between ${fmt(lo)} and ${fmt(hi)}.` },
        ])
        return mcqItem({ prompt: `What is ${fmt(n)} rounded to the nearest ${fmt(p)}?`, ...m, hints, explanation, solution })
      }
      return numItem({ prompt: `Round ${fmt(n)} to the nearest ${fmt(p)}.`, answer: r, hints, explanation, solution })
    }

    if (level <= 3) {
      let u = rng.int(1001, 49999)
      if (u % 10 === 0) u += rng.int(1, 9)
      const target = level === 2 ? rng.pick([0, 1]) : 2
      if (level === 3 && rng.chance(0.3)) u = Math.floor(u / 100) * 100 + 99 - rng.int(0, 4)
      const n = dec(u, 3)
      const keep = 3 - target
      const ru = Math.round(u / 10 ** keep)
      const r = dec(ru, target)
      const decider = Math.floor(u / 10 ** (keep - 1)) % 10
      const placeTo = target === 0 ? 'whole number' : target === 1 ? 'one decimal place' : 'two decimal places'
      const dName = placeName(-(target + 1))
      const hints: Hints = [`How many decimal places should the answer have?`, `Look at the ${dName} digit. 5 or more rounds up.`, `The ${dName} digit of ${fmt(n)} is ${decider}.`]
      const explanation = `The ${dName} digit is ${decider}, so ${fmt(n)} rounds ${decider >= 5 ? 'up' : 'down'} to ${fx(r, target)}.`
      const solution: Step[] = [
        { say: `Round to ${target === 0 ? 'the nearest whole number' : placeTo}. Look at the next digit.`, show: `${dName}: ${decider}` },
        { say: decider >= 5 ? 'Round up.' : 'Round down.', show: `${fmt(n)} → ${fx(r, target)}` },
      ]
      if (level === 3 && rng.chance(0.4) && !Number.isInteger(r)) {
        const lower = dec(Math.floor(u / 10), 2)
        const other = decider >= 5 ? lower : dec(Math.floor(u / 10) + 1, 2)
        const m = mcqFrom(
          rng,
          fx(r, 2),
          [
            { value: fx(other, 2), why: `The thousandths digit is ${decider}, so round ${decider >= 5 ? 'up' : 'down'}.` },
            { value: fx(dec(Math.round(u / 100), 1), 1), why: 'That is rounded to one decimal place.' },
            { value: String(Math.round(n)), why: 'That is rounded to the nearest whole number.' },
            { value: fx(dec(Math.floor(u / 10) * 10 + 5, 3), 3), why: 'Rounding to two decimal places leaves two digits after the point.' },
          ],
          4,
          (v) => v,
        )
        return mcqItem({ prompt: `What is ${fmt(n)} rounded to two decimal places?`, ...m, hints, explanation, solution })
      }
      return numItem({ prompt: `Round ${fmt(n)} to ${target === 0 ? 'the nearest whole number' : placeTo}.`, answer: r, decimal: true, hints, explanation, solution })
    }

    if (level === 4) {
      const style = rng.int(0, 2)
      if (style === 0) {
        let a = rng.int(25, 199)
        if (a % 10 === 0) a += 3
        let b = rng.int(21, 89)
        if (b % 10 === 0) b += 2
        const ua = dec(a, 1)
        const ub = dec(b, 1)
        const ra = Math.round(ua)
        const rb = Math.round(ub)
        return numItem({
          prompt: `Estimate ${fmt(ua)} × ${fmt(ub)} by rounding each number to the nearest whole number.`,
          answer: ra * rb,
          hints: ['Round first, then multiply.', `Round ${fmt(ua)} and ${fmt(ub)} to whole numbers.`, `${fmt(ua)} rounds to ${ra}.`],
          explanation: `${fmt(ua)} ≈ ${ra} and ${fmt(ub)} ≈ ${rb}, so the estimate is ${ra} × ${rb} = ${ra * rb}.`,
          solution: [{ say: 'Round both numbers.', show: `${fmt(ua)} → ${ra}, ${fmt(ub)} → ${rb}` }, { say: 'Multiply.', show: `${ra} × ${rb} = ${ra * rb}` }],
        })
      }
      if (style === 1) {
        const nums = [rng.int(1100, 9800), rng.int(1100, 9800), rng.int(1100, 9800)]
        const rs = nums.map((x) => roundTo(x, 1000))
        return numItem({
          prompt: `Estimate ${nums.map(fmt).join(' + ')} by rounding each number to the nearest 1,000.`,
          answer: sum(rs),
          hints: ['Round each number first, then add.', 'Look at the hundreds digit of each number.', `${fmt(at(nums, 0))} rounds to ${fmt(at(rs, 0))}.`],
          explanation: `${nums.map((x, i) => `${fmt(x)} → ${fmt(at(rs, i))}`).join(', ')}. ${rs.map(fmt).join(' + ')} = ${fmt(sum(rs))}.`,
          solution: [{ say: 'Round each number.', show: rs.map(fmt).join(', ') }, { say: 'Add the rounded numbers.', show: `${rs.map(fmt).join(' + ')} = ${fmt(sum(rs))}` }],
        })
      }
      const city = rng.pick(['Surabaya', 'Bandung', 'Medan', 'Semarang'] as const)
      const pop = rng.int(1_200_000, 3_900_000)
      const p = rng.pick([100000, 10000, 1000000])
      const r = roundTo(pop, p)
      const dExp = Math.round(Math.log10(p)) - 1
      return numItem({
        prompt: `A news report says that ${fmt(pop)} people live in ${city}. Round this number to the nearest ${fmt(p)}.`,
        answer: r,
        hints: [`Which two multiples of ${fmt(p)} is ${fmt(pop)} between?`, `Look at the ${at(PLACE, dExp)} digit.`, `The ${at(PLACE, dExp)} digit is ${Math.floor(pop / 10 ** dExp) % 10}.`],
        explanation: `${fmt(pop)} rounded to the nearest ${fmt(p)} is ${fmt(r)}.`,
        solution: [{ say: `Find the ${at(PLACE, dExp)} digit.`, show: String(Math.floor(pop / 10 ** dExp) % 10) }, { say: 'Round.', show: `${fmt(pop)} → ${fmt(r)}` }],
        tags: [WP],
      })
    }

    if (rng.chance(0.5)) {
      const t1 = rng.int(11, 99)
      const smallest = rng.chance(0.5)
      const ans = smallest ? dec(t1 * 100 - 50, 3) : dec(t1 * 100 + 49, 3)
      return numItem({
        prompt: `A number with three decimal places rounds to ${fx(dec(t1, 1), 1)} to one decimal place. What is the ${smallest ? 'smallest' : 'greatest'} it could be?`,
        answer: ans,
        decimal: true,
        hints: ['Think about which numbers round to it.', smallest ? `Numbers from halfway below ${fx(dec(t1, 1), 1)} round up to it.` : `Numbers below halfway above ${fx(dec(t1, 1), 1)} round down to it.`, smallest ? `What is halfway between ${fx(dec(t1 - 1, 1), 1)} and ${fx(dec(t1, 1), 1)}?` : `What is halfway between ${fx(dec(t1, 1), 1)} and ${fx(dec(t1 + 1, 1), 1)}?`],
        explanation: smallest
          ? `Halfway between ${fx(dec(t1 - 1, 1), 1)} and ${fx(dec(t1, 1), 1)} is ${fx(ans, 3)}, and halfway rounds up. So the smallest is ${fmt(ans)}.`
          : `${fx(dec(t1 * 100 + 50, 3), 3)} would round up, so the greatest with three decimal places is ${fx(ans, 3)}.`,
        solution: [
          { say: 'Find the halfway point.', show: smallest ? fx(dec(t1 * 100 - 50, 3), 3) : fx(dec(t1 * 100 + 50, 3), 3) },
          { say: smallest ? 'Halfway rounds up, so it counts.' : 'Take one thousandth less.', show: fx(ans, 3) },
        ],
        secs: 120,
      })
    }
    const p = rng.pick([1000, 10000])
    const X = rng.int(25, 900) * p
    const smallest = rng.chance(0.5)
    return numItem({
      prompt: `A whole number rounds to ${fmt(X)} when rounded to the nearest ${fmt(p)}. What is the ${smallest ? 'smallest' : 'greatest'} it could be?`,
      answer: smallest ? X - p / 2 : X + p / 2 - 1,
      hints: [`Think about which whole numbers round to ${fmt(X)}.`, 'Halfway numbers round up.', smallest ? `Find the number halfway between ${fmt(X - p)} and ${fmt(X)}.` : `Find the number halfway between ${fmt(X)} and ${fmt(X + p)}.`],
      explanation: smallest ? `${fmt(X - p / 2)} is halfway and rounds up to ${fmt(X)}.` : `${fmt(X + p / 2)} rounds up to ${fmt(X + p)}, so the greatest is ${fmt(X + p / 2 - 1)}.`,
      solution: [
        { say: 'Find the halfway point.', show: smallest ? fmt(X - p / 2) : fmt(X + p / 2) },
        { say: smallest ? 'It rounds up, so it counts.' : 'Take one less.', show: fmt(smallest ? X - p / 2 : X + p / 2 - 1) },
      ],
      secs: 120,
    })
  },
}

const powersOfTen: Generator = {
  skill: 'm6.multiply-divide-powers-of-ten',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const f = rng.pick([10, 100, 1000])
    const z = Math.round(Math.log10(f))
    const places = `${z} place${z > 1 ? 's' : ''}`
    if (level === 1) {
      const dp = rng.pick([2, 3])
      let u = rng.int(dp === 2 ? 101 : 1001, dp === 2 ? 999 : 9999)
      if (u % 10 === 0) u += 7
      const n = dec(u, dp)
      const ans = dec(u * f, dp)
      return numItem({
        prompt: `What is ${fmt(n)} × ${fmt(f)}?`,
        answer: ans,
        decimal: true,
        hints: [`Multiplying by ${fmt(f)} makes the number ${fmt(f)} times bigger.`, `Each digit moves ${places} to the left.`, `The first digit after the point moves to the ${z === 1 ? 'ones' : at(PLACE, z - 1)} column.`],
        explanation: `${fmt(n)} × ${fmt(f)} = ${fmt(ans)}. Each digit moves ${places} to the left.`,
        solution: [
          { say: 'Put the number in a place value chart.', figure: decChart(u, dp) },
          { say: `Move every digit ${places} to the left.`, show: `${fmt(n)} × ${fmt(f)} = ${fmt(ans)}` },
        ],
      })
    }
    if (level === 2) {
      const dp = z === 3 ? 0 : rng.pick([0, 1])
      let u = dp === 0 ? rng.int(2, 999) : rng.int(11, 999)
      if (u % 10 === 0) u += 3
      const n = dec(u, dp)
      const ans = dec(u, dp + z)
      return numItem({
        prompt: `What is ${fmt(n)} ÷ ${fmt(f)}?`,
        answer: ans,
        decimal: true,
        hints: [`Dividing by ${fmt(f)} makes the number ${fmt(f)} times smaller.`, `Each digit moves ${places} to the right.`, `The ones digit of ${fmt(n)} moves to the ${placeName(-z)} column.`],
        explanation: `${fmt(n)} ÷ ${fmt(f)} = ${fmt(ans)}. Each digit moves ${places} to the right.`,
        solution: [
          { say: 'Put the number in a place value chart.', figure: decChart(u, dp) },
          { say: `Move every digit ${places} to the right. Fill gaps with zeros.`, show: `${fmt(n)} ÷ ${fmt(f)} = ${fmt(ans)}` },
        ],
      })
    }
    if (level === 3) {
      let u = rng.int(11, 999)
      if (u % 10 === 0) u += 1
      const up = rng.chance(0.5)
      const dp = up ? rng.pick([2, 3]) : rng.int(0, 3 - z)
      const n = dec(u, dp)
      const res = up ? dec(u * f, dp) : dec(u, dp + z)
      if (rng.chance(0.5)) {
        return numItem({
          prompt: `Find the missing number. ${fmt(n)} ${up ? '×' : '÷'} ___ = ${fmt(res)}`,
          answer: f,
          hints: [`Compare ${fmt(n)} with ${fmt(res)}. Did the digits move left or right?`, 'Count how many places the digits moved.', 'One place is 10, two places is 100, three places is 1,000.'],
          explanation: `The digits moved ${places} to the ${up ? 'left' : 'right'}, so the missing number is ${fmt(f)}.`,
          solution: [{ say: 'Count the places moved.', show: places }, { say: 'Match to 10, 100 or 1,000.', show: `${fmt(n)} ${up ? '×' : '÷'} ${fmt(f)} = ${fmt(res)}` }],
        })
      }
      const m = mcqFrom(
        rng,
        fmt(res),
        [
          { value: fmt(up ? dec(u, dp + 1) : dec(u * f, dp)), why: up ? 'That moves the digits the wrong way.' : 'That multiplies instead of dividing.' },
          { value: fmt(up ? dec(u * f * 10, dp) : dec(u, dp + z + 1)), why: 'The digits have moved one place too many.' },
          { value: fmt(up ? dec(u * (f / 10), dp) : dec(u, dp + z - 1)), why: 'The digits have moved one place too few.' },
          { value: `${fx(n, dp)}${'0'.repeat(z)}`, why: 'Adding zeros to the end of a decimal does not change its value.' },
        ],
        4,
        (v) => v,
      )
      return mcqItem({
        prompt: `What is ${fmt(n)} ${up ? '×' : '÷'} ${fmt(f)}?`,
        ...m,
        hints: [`${up ? 'Multiplying' : 'Dividing'} by ${fmt(f)} moves each digit ${places}.`, `Move the digits to the ${up ? 'left' : 'right'}.`, `Write ${fmt(n)} in a place value chart first.`],
        explanation: `${fmt(n)} ${up ? '×' : '÷'} ${fmt(f)} = ${fmt(res)}.`,
        solution: [{ say: 'Place value chart.', figure: decChart(u, dp) }, { say: `Move ${places} to the ${up ? 'left' : 'right'}.`, show: fmt(res) }],
      })
    }
    if (level === 4) {
      const conv = rng.pick([
        { a: 'g', b: 'kg', f: 1000, up: false },
        { a: 'kg', b: 'g', f: 1000, up: true },
        { a: 'mm', b: 'm', f: 1000, up: false },
        { a: 'm', b: 'km', f: 1000, up: false },
        { a: 'km', b: 'm', f: 1000, up: true },
        { a: 'ml', b: 'litres', f: 1000, up: false },
        { a: 'litres', b: 'ml', f: 1000, up: true },
        { a: 'cm', b: 'm', f: 100, up: false },
      ] as const)
      let value: number
      let ans: number
      const fz = Math.round(Math.log10(conv.f))
      if (conv.up) {
        let u = rng.int(1001, 9999)
        if (u % 10 === 0) u += 3
        value = dec(u, 3)
        ans = dec(u * conv.f, 3)
      } else {
        const u = rng.int(5, 9999)
        value = u
        ans = dec(u, fz)
      }
      const oneBig = (conv.up ? conv.a : conv.b).replace(/s$/, '')
      return numItem({
        prompt: `Convert ${fmt(value)} ${conv.a} to ${conv.b}.`,
        answer: ans,
        decimal: true,
        unit: conv.b,
        hints: [`How many ${conv.up ? conv.b : conv.a} are in 1 ${oneBig}?`, `1 ${oneBig} = ${fmt(conv.f)} ${conv.up ? conv.b : conv.a}, so ${conv.up ? 'multiply' : 'divide'} by ${fmt(conv.f)}.`, `Each digit moves ${fz} places to the ${conv.up ? 'left' : 'right'}.`],
        explanation: `${fmt(value)} ${conv.up ? '×' : '÷'} ${fmt(conv.f)} = ${fmt(ans)}, so ${fmt(value)} ${conv.a} = ${fmt(ans)} ${conv.b}.`,
        solution: [{ say: `1 ${oneBig} = ${fmt(conv.f)} ${conv.up ? conv.b : conv.a}.` }, { say: conv.up ? 'Multiply.' : 'Divide.', show: `${fmt(value)} ${conv.up ? '×' : '÷'} ${fmt(conv.f)} = ${fmt(ans)}` }],
      })
    }
    if (rng.chance(0.6)) {
      const ctx = rng.pick([
        { s: (t: string) => `A stack of 100 sheets of paper is ${t} cm thick.`, q: 'How thick is one sheet, in cm?', unit: 'cm', k: 100, lo: 6, hi: 15 },
        { s: (t: string) => `1,000 paper clips weigh ${t} g.`, q: 'How much does one paper clip weigh, in grams?', unit: 'g', k: 1000, lo: 300, hi: 900 },
        { s: (t: string) => `10 identical books weigh ${t} kg.`, q: 'How much does one book weigh, in kg?', unit: 'kg', k: 10, lo: 21, hi: 89 },
      ])
      const tu = rng.int(ctx.lo, ctx.hi)
      const total = ctx.k === 1000 ? tu : dec(tu, 1)
      const ans = ctx.k === 1000 ? dec(tu, 3) : dec(tu, 1 + Math.round(Math.log10(ctx.k)))
      return numItem({
        prompt: `${ctx.s(fmt(total))} ${ctx.q}`,
        answer: ans,
        decimal: true,
        unit: ctx.unit,
        hints: ['Share the total equally.', `Divide ${fmt(total)} by ${fmt(ctx.k)}.`, `Dividing by ${fmt(ctx.k)} moves each digit ${Math.round(Math.log10(ctx.k))} place${ctx.k > 10 ? 's' : ''} to the right.`],
        explanation: `${fmt(total)} ÷ ${fmt(ctx.k)} = ${fmt(ans)} ${ctx.unit}.`,
        solution: [{ say: 'Divide the total by the number of items.' }, { say: 'Move the digits to the right.', show: `${fmt(total)} ÷ ${fmt(ctx.k)} = ${fmt(ans)}` }],
        tags: [WP],
      })
    }
    const u = rng.int(11, 99)
    const n = dec(u, 3)
    const ans = dec(u * 10, 2)
    return numItem({
      prompt: `What is ${fmt(n)} × 1,000 ÷ 100?`,
      answer: ans,
      decimal: true,
      hints: ['Work from left to right.', `First multiply ${fmt(n)} by 1,000.`, `${fmt(n)} × 1,000 = ${fmt(u)}.`],
      explanation: `${fmt(n)} × 1,000 = ${fmt(u)}, and ${fmt(u)} ÷ 100 = ${fmt(ans)}.`,
      solution: [{ say: 'Multiply first.', show: `${fmt(n)} × 1,000 = ${fmt(u)}` }, { say: 'Then divide.', show: `${fmt(u)} ÷ 100 = ${fmt(ans)}` }],
    })
  },
}

/* ------------------------------------------------------------------ */
/* Nc                                                                  */
/* ------------------------------------------------------------------ */

const seqFig = (items: (string | null)[]): Fig => ({
  kind: 'sequence',
  items,
  style: 'boxes',
  alt: `A sequence: ${items.map((x) => x ?? 'a missing term').join(', ')}.`,
})

const sequences: Generator = {
  skill: 'm6.sequences',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level === 1) {
      const dec2 = rng.chance(0.5)
      if (dec2) {
        const du = rng.pick([15, 25, 35, 45, 75, 125])
        const au = rng.int(10, 400)
        const down = rng.chance(0.5)
        const terms = [0, 1, 2, 3, 4].map((i) => dec(down ? au + 600 - i * du : au + i * du, 2))
        const miss = rng.pick([4, 2, 3])
        const shown = terms.map((t, i) => (i === miss ? null : fmt(t)))
        return numItem({
          prompt: `What is the missing term? ${shown.map((x) => x ?? '___').join(', ')}`,
          answer: at(terms, miss),
          decimal: true,
          figure: seqFig(shown),
          hints: ['Find the difference between two terms next to each other.', `Work out ${miss >= 2 ? `${fmt(at(terms, 0))} and ${fmt(at(terms, 1))}` : `${fmt(at(terms, 2))} and ${fmt(at(terms, 3))}`}: what is the gap?`, miss === 4 ? `The last term you can see is ${fmt(at(terms, 3))}.` : `The term before the gap is ${fmt(at(terms, miss - 1))}.`],
          explanation: `The terms ${down ? 'go down' : 'go up'} by ${fmt(dec(du, 2))} each time, so the missing term is ${fmt(at(terms, miss))}.`,
          solution: [{ say: `The step is ${down ? '−' : '+'}${fmt(dec(du, 2))}.` }, { say: 'Use the step to fill the gap.', show: terms.map(fmt).join(', ') }],
        })
      }
      const d = rng.int(4, 15)
      const a = rng.int(d + 1, 3 * d)
      const terms = [0, 1, 2, 3, 4, 5].map((i) => a - i * d)
      const miss = rng.pick([5, 4])
      const shown = terms.map((t, i) => (i === miss ? null : String(t)))
      return numItem({
        prompt: `What is the missing term? ${shown.map((x) => x ?? '___').join(', ')}`,
        answer: at(terms, miss),
        negative: true,
        figure: seqFig(shown),
        hints: ['Find the step between the terms.', `${at(terms, 0)} − ${at(terms, 1)} = ${d}.`, `Count back ${d} from ${at(terms, miss - 1)}.`],
        explanation: `The rule is subtract ${d}, so the missing term is ${at(terms, miss)}.`,
        solution: [{ say: `The step is −${d}.`, figure: jumpLine(at(terms, miss - 1), at(terms, miss), `−${d}`) }, { say: 'Fill the gap.', show: terms.join(', ') }],
      })
    }
    if (level === 2) {
      const mult = rng.int(2, 9)
      const add = rng.pick([-5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 7, 8, 9])
      const n = rng.int(10, 50)
      const ans = mult * n + add
      const rule = add === 0 ? `multiply the position number by ${mult}` : add > 0 ? `multiply the position number by ${mult}, then add ${add}` : `multiply the position number by ${mult}, then subtract ${-add}`
      return numItem({
        prompt: `The rule for a sequence is: ${rule}. What is the ${ORD(n)} term?`,
        answer: ans,
        hints: ['The position number is which term it is: 1st, 2nd, 3rd, and so on.', `Use ${n} as the position number.`, `${mult} × ${n} = ${mult * n}.`],
        explanation: `${mult} × ${n} = ${mult * n}${add === 0 ? '' : `, then ${add > 0 ? `+ ${add}` : `− ${-add}`}`} = ${ans}.`,
        solution: [
          { say: 'Check the rule with the first term.', show: `${mult} × 1 ${add >= 0 ? '+' : '−'} ${Math.abs(add)} = ${mult + add}` },
          { say: `Use position ${n}.`, show: `${mult} × ${n} ${add >= 0 ? '+' : '−'} ${Math.abs(add)} = ${ans}` },
        ],
      })
    }
    if (level === 3) {
      const mult = rng.int(2, 8)
      let add = rng.int(-3, 7)
      if (add === 0) add = 2
      const terms = [1, 2, 3, 4].map((p) => mult * p + add)
      const fmtRule = (m: number, c: number) => (c === 0 ? `${m} × position` : `${m} × position ${c > 0 ? '+' : '−'} ${Math.abs(c)}`)
      const correct = fmtRule(mult, add)
      const wrong = [
        { value: `position + ${mult}`, why: `Position 1 would give ${1 + mult}, not ${at(terms, 0)}.` },
        { value: fmtRule(mult, add + 1), why: `Position 1 would give ${mult + add + 1}, not ${at(terms, 0)}.` },
        { value: fmtRule(mult + 1, add - 1), why: `Position 2 would give ${2 * (mult + 1) + add - 1}, not ${at(terms, 1)}.` },
        { value: fmtRule(mult - 1, add + 1), why: `Position 2 would give ${2 * (mult - 1) + add + 1}, not ${at(terms, 1)}.` },
      ].filter((w) => w.value !== correct)
      const m = mcqText(rng, correct, wrong)
      return mcqItem({
        prompt: `Which position-to-term rule gives this sequence? ${terms.join(', ')}, ...`,
        ...m,
        figure: seqFig([...terms.map(String), '...']),
        hints: ['The step between terms tells you what to multiply the position by.', `The terms go up by ${mult} each time.`, `Test each rule with position 1. It must give ${at(terms, 0)}.`],
        explanation: `The terms go up by ${mult}, so start with ${mult} × position. Position 1 gives ${mult}, and we need ${at(terms, 0)}, so the rule is ${correct}.`,
        solution: [{ say: `The step is ${mult}.`, show: `${mult} × position` }, { say: 'Adjust to match the first term.', show: correct }],
      })
    }
    if (level === 4) {
      const kind = rng.pick(['triangular', 'square', 'cube'] as const)
      const n = kind === 'cube' ? rng.int(4, 7) : rng.int(6, 12)
      const val = kind === 'triangular' ? (n * (n + 1)) / 2 : kind === 'square' ? n * n : n * n * n
      if (rng.chance(0.5)) {
        return numItem({
          prompt: `What is the ${ORD(n)} ${kind} number?`,
          answer: val,
          hints: [
            kind === 'triangular' ? 'Triangular numbers start 1, 3, 6, 10. Each step adds one more than the step before.' : kind === 'square' ? 'Square numbers start 1, 4, 9, 16. The nth one is n × n.' : 'Cube numbers start 1, 8, 27. The nth one is n × n × n.',
            kind === 'triangular' ? `The ${ORD(n)} triangular number is 1 + 2 + 3 + ... + ${n}.` : `Use n = ${n}.`,
            kind === 'triangular' ? `1 + 2 + 3 + 4 + 5 = 15.` : kind === 'square' ? `${n} × ${n - 1} = ${n * (n - 1)}. Add one more ${n}.` : `${n} × ${n} = ${n * n}.`,
          ],
          explanation: kind === 'triangular' ? `1 + 2 + ... + ${n} = ${val}.` : kind === 'square' ? `${n} × ${n} = ${val}.` : `${n} × ${n} × ${n} = ${val}.`,
          solution: [{ say: `Use the rule for ${kind} numbers.` }, { say: 'Work it out.', show: String(val) }],
        })
      }
      const start = rng.int(1, 4)
      const seq = range(start, start + 4).map((k) => (kind === 'triangular' ? (k * (k + 1)) / 2 : kind === 'square' ? k * k : k * k * k))
      const next = start + 5
      const nextVal = kind === 'triangular' ? (next * (next + 1)) / 2 : kind === 'square' ? next * next : next ** 3
      return numItem({
        prompt: `What is the next number? ${seq.join(', ')}, ___`,
        answer: nextVal,
        figure: seqFig([...seq.map(String), null]),
        hints: ['Look at the differences between the terms.', kind === 'triangular' ? 'The differences go up by 1 each time.' : kind === 'square' ? 'These are square numbers.' : 'These are cube numbers.', kind === 'cube' ? `${start + 4} × ${start + 4} × ${start + 4} = ${(start + 4) ** 3}.` : `The last difference is ${at(seq, 4) - at(seq, 3)}.`],
        explanation: `These are ${kind} numbers. The next one is ${nextVal}.`,
        solution: [{ say: 'Find the pattern.', show: seq.join(', ') }, { say: 'Continue it.', show: String(nextVal) }],
      })
    }
    const shape = rng.pick([
      { what: 'squares in a row', a: 3, b: 1 },
      { what: 'triangles in a row', a: 2, b: 1 },
      { what: 'hexagons in a row', a: 5, b: 1 },
      { what: 'pentagons in a row', a: 4, b: 1 },
    ] as const)
    const target = rng.int(8, 30)
    const sticks = shape.a * target + shape.b
    const name = rng.pick(NAMES)
    return numItem({
      prompt: `${name} makes ${shape.what} with sticks. Pattern n uses ${shape.a} × n + ${shape.b} sticks. Which pattern uses ${sticks} sticks?`,
      answer: target,
      hints: ['Work backwards through the rule.', `First take away ${shape.b}.`, `${sticks} − ${shape.b} = ${sticks - shape.b}.`],
      explanation: `${sticks} − ${shape.b} = ${sticks - shape.b} and ${sticks - shape.b} ÷ ${shape.a} = ${target}, so it is pattern ${target}.`,
      solution: [{ say: 'Undo the adding.', show: `${sticks} − ${shape.b} = ${sticks - shape.b}` }, { say: 'Undo the multiplying.', show: `${sticks - shape.b} ÷ ${shape.a} = ${target}` }],
      tags: [WP],
      secs: 120,
    })
  },
}

type Op = { s: string; f: (x: number) => number; inv: string; g: (x: number) => number }
const opAdd = (k: number): Op => ({ s: `+ ${k}`, f: (x) => x + k, inv: `− ${k}`, g: (x) => x - k })
const opSub = (k: number): Op => ({ s: `− ${k}`, f: (x) => x - k, inv: `+ ${k}`, g: (x) => x + k })
const opMul = (k: number): Op => ({ s: `× ${k}`, f: (x) => x * k, inv: `÷ ${k}`, g: (x) => x / k })

const functionMachines: Generator = {
  skill: 'm6.function-machines',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const machineFig = (input: string | null, ops: Op[], output: string | null): Fig => ({
      kind: 'sequence',
      items: [input, ...ops.map((o) => o.s), output],
      style: 'boxes',
      alt: `A function machine: input ${input ?? 'unknown'}, then ${ops.map((o) => o.s).join(', then ')}, output ${output ?? 'unknown'}.`,
    })
    if (level === 1) {
      const op = rng.pick([opMul(rng.int(3, 12)), opAdd(rng.int(12, 99)), opSub(rng.int(5, 40))])
      const input = rng.int(op.s.startsWith('−') ? 45 : 3, 60)
      const out = op.f(input)
      if (rng.chance(0.5)) {
        return numItem({
          prompt: `The function machine does ${op.s}. The input is ${input}. What is the output?`,
          answer: out,
          figure: machineFig(String(input), [op], null),
          hints: ['Put the input into the machine.', `Do ${op.s} to ${input}.`, `Work out ${input} ${op.s}.`],
          explanation: `${input} ${op.s} = ${out}.`,
          solution: [{ say: 'Start with the input.', figure: machineFig(String(input), [op], null) }, { say: 'Apply the rule.', show: `${input} ${op.s} = ${out}` }],
        })
      }
      return numItem({
        prompt: `The function machine does ${op.s}. The output is ${out}. What was the input?`,
        answer: input,
        figure: machineFig(null, [op], String(out)),
        hints: ['Work backwards from the output.', `The opposite of ${op.s} is ${op.inv}.`, `Work out ${out} ${op.inv}.`],
        explanation: `Undo the rule: ${out} ${op.inv} = ${input}.`,
        solution: [{ say: 'Use the inverse.', show: op.inv }, { say: 'Work back to the input.', show: `${out} ${op.inv} = ${input}` }],
      })
    }
    if (level <= 3) {
      const m = rng.int(2, 9)
      const c = rng.int(2, 25)
      const ops = rng.chance(0.6) ? [opMul(m), rng.chance(0.5) ? opAdd(c) : opSub(Math.min(c, m))] : [opAdd(c), opMul(m)]
      const input = rng.int(2, 15)
      const mid = at(ops, 0).f(input)
      const out = at(ops, 1).f(mid)
      if (level === 2) {
        return numItem({
          prompt: `A function machine does ${at(ops, 0).s}, then ${at(ops, 1).s}. The input is ${input}. What is the output?`,
          answer: out,
          figure: machineFig(String(input), ops, null),
          hints: ['Do the two steps in order.', `First: ${input} ${at(ops, 0).s}.`, `${input} ${at(ops, 0).s} = ${mid}.`],
          explanation: `${input} ${at(ops, 0).s} = ${mid}, then ${mid} ${at(ops, 1).s} = ${out}.`,
          solution: [{ say: 'First step.', show: `${input} ${at(ops, 0).s} = ${mid}` }, { say: 'Second step.', show: `${mid} ${at(ops, 1).s} = ${out}` }],
        })
      }
      return numItem({
        prompt: `A function machine does ${at(ops, 0).s}, then ${at(ops, 1).s}. The output is ${out}. What was the input?`,
        answer: input,
        figure: machineFig(null, ops, String(out)),
        hints: ['Work backwards, starting with the last step.', `Undo ${at(ops, 1).s} first, then undo ${at(ops, 0).s}.`, `${out} ${at(ops, 1).inv} = ${mid}.`],
        explanation: `${out} ${at(ops, 1).inv} = ${mid}, then ${mid} ${at(ops, 0).inv} = ${input}.`,
        solution: [{ say: 'Undo the last step.', show: `${out} ${at(ops, 1).inv} = ${mid}` }, { say: 'Undo the first step.', show: `${mid} ${at(ops, 0).inv} = ${input}` }],
        secs: 90,
      })
    }
    if (level === 4) {
      const letter = rng.pick(['n', 'x', 'a', 'y', 'm'] as const)
      const form = rng.int(0, 3)
      const v = rng.int(2, 15)
      let eq: string
      let steps: Step[]
      let h3: string
      let left: string[]
      let right: string[]
      let ans = v
      if (form === 0) {
        const k = rng.int(4, 30)
        eq = `${letter} + ${k} = ${v + k}`
        h3 = `Take ${k} away from ${v + k}.`
        steps = [{ say: `Take ${k} from both sides.`, show: `${letter} = ${v + k} − ${k} = ${v}` }, { say: 'Check.', show: `${v} + ${k} = ${v + k}` }]
        left = [letter, String(k)]
        right = [String(v + k)]
      } else if (form === 1) {
        const k = rng.int(3, 9)
        eq = `${k}${letter} = ${k * v}`
        h3 = `${k}${letter} means ${k} × ${letter}. Divide ${k * v} by ${k}.`
        steps = [{ say: `Divide both sides by ${k}.`, show: `${letter} = ${k * v} ÷ ${k} = ${v}` }, { say: 'Check.', show: `${k} × ${v} = ${k * v}` }]
        left = Array(Math.min(k, 6)).fill(letter)
        right = [String(k * v)]
      } else if (form === 2) {
        const k = rng.int(2, 5)
        const c = rng.int(1, 12)
        eq = `${k}${letter} + ${c} = ${k * v + c}`
        h3 = `First take ${c} away from both sides: ${k}${letter} = ${k * v}.`
        steps = [
          { say: `Take ${c} from both sides.`, show: `${k}${letter} = ${k * v}` },
          { say: `Divide by ${k}.`, show: `${letter} = ${v}` },
        ]
        left = [...Array(k).fill(letter), String(c)]
        right = [String(k * v + c)]
      } else {
        const k = rng.int(2, 6)
        eq = `${letter} ÷ ${k} = ${v}`
        ans = v * k
        h3 = `Multiply both sides by ${k}.`
        steps = [{ say: `Multiply both sides by ${k}.`, show: `${letter} = ${v} × ${k} = ${v * k}` }, { say: 'Check.', show: `${v * k} ÷ ${k} = ${v}` }]
        left = [`${letter} ÷ ${k}`]
        right = [String(v)]
      }
      return numItem({
        prompt: `Find the value of ${letter} when ${eq}.`,
        answer: ans,
        figure: { kind: 'balance', left: left.slice(0, 6), right, tilt: 'level', alt: `A balance: ${left.join(' and ')} on the left, ${right.join(', ')} on the right. Both sides are equal.` },
        hints: ['The equation is like a balance. Keep both sides equal.', 'Use the inverse operation to get the letter on its own.', h3],
        explanation: `If ${eq}, then ${letter} = ${ans}.`,
        solution: steps,
      })
    }
    if (rng.chance(0.5)) {
      const a = rng.int(2, 9)
      const b = rng.int(2, 9)
      const p = rng.int(2, 6)
      const q = rng.int(1, 4)
      const minus = p * a > q * b && rng.chance(0.5)
      const ans = minus ? p * a - q * b : p * a + q * b
      return numItem({
        prompt: `If a = ${a} and b = ${b}, what is the value of ${p}a ${minus ? '−' : '+'} ${q}b?`,
        answer: ans,
        hints: [`${p}a means ${p} × a.`, `Replace a with ${a} and b with ${b}.`, `${p} × ${a} = ${p * a}.`],
        explanation: `${p} × ${a} = ${p * a} and ${q} × ${b} = ${q * b}. ${p * a} ${minus ? '−' : '+'} ${q * b} = ${ans}.`,
        solution: [{ say: 'Substitute the numbers.', show: `${p} × ${a} ${minus ? '−' : '+'} ${q} × ${b}` }, { say: 'Multiply first, then add or subtract.', show: `${p * a} ${minus ? '−' : '+'} ${q * b} = ${ans}` }],
      })
    }
    const m = rng.int(2, 6)
    const c = rng.int(1, 9)
    const ins = rng.sample(range(1, 10), 3).sort((x, y) => x - y)
    const outs = ins.map((x) => m * x + c)
    const correct = `× ${m}, then + ${c}`
    const x0 = at(ins, 0)
    const y0 = at(outs, 0)
    const candidates: { value: string; f: (x: number) => number }[] = [
      { value: `+ ${y0 - x0}`, f: (x) => x + y0 - x0 },
      { value: `× ${m + 1}`, f: (x) => x * (m + 1) },
      { value: `× ${m}, then − ${c}`, f: (x) => x * m - c },
      { value: `+ ${c}, then × ${m}`, f: (x) => (x + c) * m },
      { value: `× ${m + 1}, then − ${m + 1}`, f: (x) => x * (m + 1) - (m + 1) },
    ]
    const wrong = candidates
      .filter((w) => w.value !== correct)
      .map((w) => {
        const i = ins.findIndex((x, j) => w.f(x) !== at(outs, j))
        return i < 0 ? null : { value: w.value, why: `Input ${at(ins, i)} would give ${w.f(at(ins, i))}, not ${at(outs, i)}.` }
      })
      .filter((w): w is { value: string; why: string } => w !== null)
    const mm = mcqText(rng, correct, wrong)
    return mcqItem({
      prompt: 'The table shows the inputs and outputs of a function machine. Which rule does it use?',
      ...mm,
      figure: { kind: 'table', head: ['Input', 'Output'], rows: ins.map((x, i) => [String(x), String(at(outs, i))]), alt: `Table of inputs and outputs: ${ins.map((x, i) => `${x} gives ${at(outs, i)}`).join(', ')}.` },
      hints: ['Test each rule with every pair in the table.', `When the input goes up by 1, the output goes up by ${m}.`, `Try the first pair: input ${x0}, output ${y0}.`],
      explanation: `${ins.map((x, i) => `${x} × ${m} + ${c} = ${at(outs, i)}`).join(', ')}. The rule is ${correct}.`,
      solution: [{ say: 'Test the rule on each pair.', show: ins.map((x, i) => `${x} → ${at(outs, i)}`).join(', ') }, { say: 'Only one rule works for all of them.', show: correct }],
      secs: 120,
    })
  },
}

/* ------------------------------------------------------------------ */
/* Ni                                                                  */
/* ------------------------------------------------------------------ */

const negativeNumbers: Generator = {
  skill: 'm6.negative-numbers',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level === 1) {
      const set = new Set<number>()
      while (set.size < 5) set.add(rng.int(-30, 20))
      const vals = [...set]
      const asc = [...vals].sort((a, b) => a - b)
      if (rng.chance(0.5)) {
        const desc = rng.chance(0.4)
        const items = (desc ? [...asc].reverse() : asc).map(String)
        return orderItem({
          prompt: `Put these numbers in order, starting with the ${desc ? 'largest' : 'smallest'}.`,
          items,
          hints: ['Picture the numbers on a number line.', 'For negative numbers, the further from 0, the smaller the number.', `Which number is furthest to the ${desc ? 'right' : 'left'} on the number line?`],
          explanation: `In order: ${items.join(', ')}.`,
          solution: [{ say: 'Place them on a number line.' }, { say: 'Read from left to right.', show: asc.join(' < ') }],
        })
      }
      const val = -2 * rng.int(1, 9)
      return lineItem({
        prompt: `Mark ${val} on the number line.`,
        min: -20,
        max: 20,
        step: 2,
        answer: val,
        hints: ['Negative numbers are to the left of 0.', 'Each mark on this line is 2 more than the one before.', `${val} is ${-val / 2} marks to the left of 0.`],
        explanation: `${val} is ${-val} to the left of 0, which is ${-val / 2} marks of 2.`,
        solution: [{ say: 'Start at 0.' }, { say: `Count back in 2s to ${val}.`, show: `0 → ${val}` }],
      })
    }
    if (level === 2) {
      const form = rng.int(0, 2)
      let a: number
      let b: number
      let op: '+' | '−'
      if (form === 0) {
        a = rng.int(-25, -3)
        b = rng.int(2, 40)
        op = '+'
      } else if (form === 1) {
        a = rng.int(3, 20)
        b = rng.int(a + 2, a + 25)
        op = '−'
      } else {
        a = rng.int(-20, -2)
        b = rng.int(3, 20)
        op = '−'
      }
      const ans = op === '+' ? a + b : a - b
      return numItem({
        prompt: `Work out ${a} ${op} ${b}.`,
        answer: ans,
        negative: true,
        hints: [`Start at ${a} on a number line.`, `${op === '+' ? 'Adding' : 'Subtracting'} ${b} moves ${b} to the ${op === '+' ? 'right' : 'left'}.`, (a < 0 && ans > 0) || (a > 0 && ans < 0) ? `It takes ${Math.abs(a)} steps to reach 0.` : `Count ${b} steps from ${a}.`],
        explanation: `Start at ${a} and move ${b} to the ${op === '+' ? 'right' : 'left'}: ${a} ${op} ${b} = ${ans}.`,
        solution: [{ say: `Start at ${a}.`, figure: jumpLine(a, ans, `${op}${b}`) }, { say: `Move ${b}.`, show: `${a} ${op} ${b} = ${ans}` }],
      })
    }
    if (level === 3) {
      const cities = rng.sample(['Harbin', 'Moscow', 'Oslo', 'Toronto', 'Helsinki', 'Seoul', 'Reykjavik'], 4)
      const temps = rng.shuffle([rng.int(-25, -15), rng.int(-14, -6), rng.int(-5, -1), rng.int(0, 6)])
      const fig: Fig = { kind: 'table', caption: 'Temperatures at 06:00 on one day in January', head: ['City', 'Temperature (°C)'], rows: cities.map((c, i) => [c, String(at(temps, i))]), alt: `Temperatures: ${cities.map((c, i) => `${c} ${deg(at(temps, i))}`).join(', ')}.` }
      const [i, j] = rng.sample([0, 1, 2, 3], 2).sort((x, y) => at(temps, y) - at(temps, x))
      const warm = at(temps, i!)
      const cold = at(temps, j!)
      return numItem({
        prompt: `The table shows the temperature in four cities one January morning. How many degrees warmer was ${at(cities, i!)} than ${at(cities, j!)}?`,
        answer: warm - cold,
        unit: 'degrees',
        figure: fig,
        hints: ['Find both temperatures in the table.', 'Find the difference by counting on a number line.', `${at(cities, j!)} was ${deg(cold)}.`],
        explanation: `${warm} − ${par(cold)} = ${warm - cold}, so ${at(cities, i!)} was ${warm - cold} degrees warmer.`,
        solution: [{ say: 'Read the two temperatures.', show: `${deg(warm)} and ${deg(cold)}`, figure: jumpLine(cold, warm) }, { say: 'Count the gap.', show: `${warm} − ${par(cold)} = ${warm - cold}` }],
        tags: [WP],
      })
    }
    if (level === 4) {
      const t = rng.int(0, 2)
      if (t === 0) {
        const start = rng.int(-3, 2)
        const up = rng.int(3, 9)
        const down = rng.int(up + 1, up + start + 6)
        const ans = start + up - down
        return numItem({
          prompt: `A lift starts at floor ${start}. It goes up ${up} floors, then down ${down} floors. Which floor is it on now? Floors below the ground are negative.`,
          answer: ans,
          negative: true,
          hints: ['Work one move at a time.', `Going up adds, going down subtracts.`, `${start} + ${up} = ${start + up}.`],
          explanation: `${start} + ${up} = ${start + up}, then ${start + up} − ${down} = ${ans}.`,
          solution: [{ say: 'Go up.', show: `${start} + ${up} = ${start + up}` }, { say: 'Go down.', show: `${start + up} − ${down} = ${ans}` }],
          tags: [WP],
        })
      }
      if (t === 1) {
        const depth = rng.int(12, 40)
        const rise = rng.int(4, depth - 2)
        const ans = -depth + rise
        return numItem({
          prompt: `A diver is at -${depth} m, which means ${depth} m below the surface of the sea. The diver swims up ${rise} m. What is the diver's new position?`,
          answer: ans,
          negative: true,
          unit: 'm',
          hints: ['Swimming up makes the number bigger.', `Start at -${depth} and add ${rise}.`, `-${depth} + ${rise} is still below 0.`],
          explanation: `-${depth} + ${rise} = ${ans}, so the diver is at ${ans} m.`,
          solution: [{ say: `Start at -${depth}.`, figure: jumpLine(-depth, ans, `+${rise}`) }, { say: 'Add the rise.', show: `-${depth} + ${rise} = ${ans}` }],
          tags: [WP],
        })
      }
      const inside = rng.int(-24, -15)
      const room = rng.int(18, 32)
      return numItem({
        prompt: `A freezer is at ${deg(inside)}. The kitchen is at ${deg(room)}. How many degrees colder is the freezer than the kitchen?`,
        answer: room - inside,
        unit: 'degrees',
        hints: ['Find the gap between the two temperatures.', 'Count from the freezer temperature up to 0, then on to the kitchen temperature.', `From ${deg(inside)} up to 0 is ${-inside} degrees.`],
        explanation: `${-inside} + ${room} = ${room - inside} degrees.`,
        solution: [{ say: 'Up to 0.', show: `${-inside}` }, { say: 'Then up to the kitchen temperature.', show: `${-inside} + ${room} = ${room - inside}` }],
        tags: [WP],
      })
    }
    if (rng.chance(0.5)) {
      const form = rng.int(0, 2)
      const x = form === 2 ? rng.int(-15, -2) : rng.int(2, 15)
      const k = rng.int(3, 18)
      let eq: string
      let ans: number
      if (form === 0) {
        eq = `___ − ${k} = ${x - k}`
        ans = x
      } else if (form === 1) {
        const a = rng.int(-12, -2)
        eq = `${a} + ___ = ${a + x}`
        ans = x
      } else {
        const a = rng.int(-10, 5)
        eq = `${a} + ___ = ${a + x}`
        ans = x
      }
      return numItem({
        prompt: `Find the missing number. ${eq}`,
        answer: ans,
        negative: true,
        hints: ['Use the inverse operation.', 'Picture the jump on a number line.', `Start from the number after the equals sign: ${eq.split('= ')[1]}.`],
        explanation: `The missing number is ${ans}. Check: ${eq.replace('___', par(ans))}.`,
        solution: [{ say: 'Use the inverse.' }, { say: 'Check the answer in the gap.', show: eq.replace('___', par(ans)) }],
      })
    }
    let a = rng.int(-20, -2)
    let b = rng.int(-1, 16)
    if ((b - a) % 2 !== 0) b += 1
    if (b === 0) b = 2
    if ((b - a) % 2 !== 0) a -= 1
    const mid = (a + b) / 2
    return numItem({
      prompt: `Which number is exactly halfway between ${a} and ${b}?`,
      answer: mid,
      negative: true,
      hints: ['Halfway is the same distance from both numbers.', `Find the gap from ${a} to ${b}.`, `The gap is ${b - a}.`],
      explanation: `The gap is ${b - a}. Half of it is ${(b - a) / 2}. ${a} + ${(b - a) / 2} = ${mid}.`,
      solution: [{ say: 'Find the gap.', show: `${b} − ${par(a)} = ${b - a}`, figure: jumpLine(a, b) }, { say: 'Move half the gap.', show: `${a} + ${(b - a) / 2} = ${mid}` }],
    })
  },
}

const orderOfOperations: Generator = {
  skill: 'm6.order-of-operations',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level === 1) {
      const form = rng.int(0, 3)
      let expr: string
      let ans: number
      let wrongLR: number
      let first: string
      if (form === 0) {
        const [a, b, c] = [rng.int(2, 20), rng.int(2, 9), rng.int(2, 9)]
        expr = `${a} + ${b} × ${c}`
        ans = a + b * c
        wrongLR = (a + b) * c
        first = `${b} × ${c} = ${b * c}`
      } else if (form === 1) {
        const [b, c] = [rng.int(2, 9), rng.int(2, 9)]
        const a = b * c + rng.int(1, 30)
        expr = `${a} − ${b} × ${c}`
        ans = a - b * c
        wrongLR = (a - b) * c
        first = `${b} × ${c} = ${b * c}`
      } else if (form === 2) {
        const [a, b, c] = [rng.int(2, 9), rng.int(2, 9), rng.int(2, 30)]
        expr = `${a} × ${b} + ${c}`
        ans = a * b + c
        wrongLR = a * (b + c)
        first = `${a} × ${b} = ${a * b}`
      } else {
        const c = rng.int(2, 9)
        const b = c * rng.int(2, 9)
        const a = rng.int(2, 30)
        expr = `${a} + ${b} ÷ ${c}`
        ans = a + b / c
        wrongLR = (a + b) / c
        first = `${b} ÷ ${c} = ${b / c}`
      }
      const solution: Step[] = [{ say: 'Multiply or divide first.', show: first }, { say: 'Then add or subtract.', show: `${expr} = ${ans}` }]
      if (rng.chance(0.5) && Number.isInteger(wrongLR) && wrongLR !== ans) {
        const m = mcqFrom(rng, ans, [
          { value: wrongLR, why: 'That works from left to right. Multiply or divide before you add or subtract.' },
          { value: ans + 1, why: 'Check your arithmetic.' },
          { value: ans + 10, why: 'Check your arithmetic.' },
          { value: ans - 1, why: 'Check your arithmetic.' },
          { value: ans + 2, why: 'Check your arithmetic.' },
        ])
        return mcqItem({ prompt: `What is ${expr}?`, ...m, hints: ['There is no bracket here.', 'Multiply or divide before you add or subtract.', `Start with ${first.split(' =')[0]}.`], explanation: `Multiply or divide first: ${first}. So ${expr} = ${ans}.`, solution })
      }
      return numItem({ prompt: `Work out ${expr}.`, answer: ans, hints: ['There is no bracket here.', 'Multiply or divide before you add or subtract.', `Start with ${first.split(' =')[0]}.`], explanation: `Multiply or divide first: ${first}. So ${expr} = ${ans}.`, solution })
    }
    if (level === 2) {
      const form = rng.int(0, 3)
      let expr: string
      let ans: number
      let inner: string
      if (form === 0) {
        const [a, b, c] = [rng.int(2, 15), rng.int(2, 15), rng.int(2, 9)]
        expr = `(${a} + ${b}) × ${c}`
        ans = (a + b) * c
        inner = `${a} + ${b} = ${a + b}`
      } else if (form === 1) {
        const c = rng.int(2, 9)
        const b = rng.int(c + 1, 20)
        const a = rng.int(2, 12)
        expr = `${a} × (${b} − ${c})`
        ans = a * (b - c)
        inner = `${b} − ${c} = ${b - c}`
      } else if (form === 2) {
        const c = rng.int(2, 9)
        const s = c * rng.int(2, 9)
        const a = rng.int(1, s - 1)
        expr = `(${a} + ${s - a}) ÷ ${c}`
        ans = s / c
        inner = `${a} + ${s - a} = ${s}`
      } else {
        const b = rng.int(5, 30)
        const c = rng.int(2, 20)
        const a = rng.int(b + c + 1, b + c + 50)
        expr = `${a} − (${b} + ${c})`
        ans = a - (b + c)
        inner = `${b} + ${c} = ${b + c}`
      }
      return numItem({
        prompt: `Work out ${expr}.`,
        answer: ans,
        hints: ['Brackets come first.', 'Work out the part inside the brackets, then do the rest.', `Inside the brackets: ${inner.split(' =')[0]}.`],
        explanation: `Brackets first: ${inner}. Then ${expr} = ${ans}.`,
        solution: [{ say: 'Do the brackets first.', show: inner }, { say: 'Then the rest.', show: `${expr} = ${ans}` }],
      })
    }
    if (level === 3) {
      const form = rng.int(0, 2)
      let expr: string
      let ans: number
      let steps: Step[]
      if (form === 0) {
        const b = rng.int(2, 9)
        const a = b * rng.int(2, 9)
        const [c, d] = [rng.int(2, 9), rng.int(2, 9)]
        expr = `${a} ÷ ${b} + ${c} × ${d}`
        ans = a / b + c * d
        steps = [{ say: 'Divide and multiply first.', show: `${a} ÷ ${b} = ${a / b}, ${c} × ${d} = ${c * d}` }, { say: 'Then add.', show: `${a / b} + ${c * d} = ${ans}` }]
      } else if (form === 1) {
        const [a, b, c] = [rng.int(2, 9), rng.int(2, 9), rng.int(2, 9)]
        const d = rng.int(1, a * (b + c) - 1)
        expr = `${a} × (${b} + ${c}) − ${d}`
        ans = a * (b + c) - d
        steps = [{ say: 'Brackets first.', show: `${b} + ${c} = ${b + c}` }, { say: 'Then multiply.', show: `${a} × ${b + c} = ${a * (b + c)}` }, { say: 'Then subtract.', show: `${a * (b + c)} − ${d} = ${ans}` }]
      } else {
        const b = rng.int(1, 9)
        const a = b + rng.int(2, 9)
        const [c, d] = [rng.int(1, 9), rng.int(1, 9)]
        expr = `(${a} − ${b}) × (${c} + ${d})`
        ans = (a - b) * (c + d)
        steps = [{ say: 'Work out both brackets.', show: `${a} − ${b} = ${a - b}, ${c} + ${d} = ${c + d}` }, { say: 'Multiply.', show: `${a - b} × ${c + d} = ${ans}` }]
      }
      return numItem({
        prompt: `Work out ${expr}.`,
        answer: ans,
        hints: ['Brackets first, then multiply and divide, then add and subtract.', 'Write each step on a new line.', steps[0]?.show ? `${steps[0].show}.` : 'Start with the brackets.'],
        explanation: `${expr} = ${ans}.`,
        solution: steps,
        secs: 90,
      })
    }
    if (level === 4) {
      const [a, b, c] = [rng.int(2, 9), rng.int(2, 9), rng.int(2, 9)]
      const kind = rng.int(0, 1)
      const expr = kind === 0 ? `${a} + ${b} × ${c}` : `${a} × ${b} + ${c}`
      const target = kind === 0 ? (a + b) * c : a * (b + c)
      const right = kind === 0 ? `(${a} + ${b}) × ${c}` : `${a} × (${b} + ${c})`
      const noBr = kind === 0 ? a + b * c : a * b + c
      const wrongs = kind === 0
        ? [
            { value: `${a} + (${b} × ${c})`, why: `That gives ${a} + ${b * c} = ${noBr}.` },
            { value: `(${a} + ${b} × ${c})`, why: `Brackets round everything do not change the order. It still gives ${noBr}.` },
            { value: `${a} + ${b} × ${c} (no brackets)`, why: `Without brackets you multiply first and get ${noBr}.` },
          ]
        : [
            { value: `(${a} × ${b}) + ${c}`, why: `That gives ${a * b} + ${c} = ${noBr}.` },
            { value: `(${a} × ${b} + ${c})`, why: `Brackets round everything do not change the order. It still gives ${noBr}.` },
            { value: `${a} × ${b} + ${c} (no brackets)`, why: `Without brackets you multiply first and get ${noBr}.` },
          ]
      const m = mcqText(rng, right, wrongs)
      return mcqItem({
        prompt: `Where do the brackets go so that ${expr} = ${target}?`,
        ...m,
        hints: [`Without brackets, ${expr} = ${noBr}.`, `To get ${target}, the addition must happen first.`, 'Brackets make a part of the calculation happen first.'],
        explanation: `${right} = ${target}.`,
        solution: [{ say: 'Try putting the addition in brackets.' }, { say: 'Check.', show: `${right} = ${target}` }],
      })
    }
    if (rng.chance(0.5)) {
      const form = rng.int(0, 1)
      if (form === 0) {
        const k = rng.int(2, 9)
        const x = rng.int(2, 12)
        const c = rng.int(1, 9)
        return numItem({
          prompt: `Find the missing number. ${k} × (___ + ${c}) = ${k * (x + c)}`,
          answer: x,
          hints: ['Work backwards.', `First divide ${k * (x + c)} by ${k} to find the value of the bracket.`, `${k * (x + c)} ÷ ${k} = ${x + c}.`],
          explanation: `The bracket must equal ${k * (x + c)} ÷ ${k} = ${x + c}. So the missing number is ${x + c} − ${c} = ${x}.`,
          solution: [{ say: 'Find the bracket.', show: `${k * (x + c)} ÷ ${k} = ${x + c}` }, { say: 'Find the missing number.', show: `${x + c} − ${c} = ${x}` }],
        })
      }
      const d = rng.int(2, 9)
      const q = rng.int(2, 9)
      const x = rng.int(1, 30)
      const total = q * d + x
      return numItem({
        prompt: `Find the missing number. (${total} − ___) ÷ ${d} = ${q}`,
        answer: x,
        hints: ['Work backwards.', `The bracket must equal ${q} × ${d}.`, `${q} × ${d} = ${q * d}.`],
        explanation: `The bracket equals ${q * d}, so the missing number is ${total} − ${q * d} = ${x}.`,
        solution: [{ say: 'Find the bracket.', show: `${q} × ${d} = ${q * d}` }, { say: 'Find the missing number.', show: `${total} − ${q * d} = ${x}` }],
      })
    }
    const packs = rng.int(2, 6)
    const per = rng.int(3, 12)
    const extra = rng.int(1, 9)
    const name = rng.pick(NAMES)
    const correct = `${packs} × ${per} + ${extra}`
    const m = mcqText(rng, correct, [
      { value: `${packs} × (${per} + ${extra})`, why: `That adds ${extra} pens to every pack.` },
      { value: `(${packs} + ${per}) × ${extra}`, why: 'That adds packs and pens together, which does not make sense.' },
      { value: `${packs} + ${per} × ${extra}`, why: `That multiplies the pens in a pack by the extra pens.` },
    ])
    return mcqItem({
      prompt: `${name} buys ${packs} packs of pens with ${per} pens in each pack, and ${extra} more pens. Which calculation gives the total number of pens?`,
      ...m,
      hints: ['First find the pens in the packs.', `${packs} packs of ${per} pens means ${packs} × ${per}.`, `Then add the ${extra} extra pens.`],
      explanation: `${correct} = ${packs * per + extra} pens. Multiplication is done before addition, so no brackets are needed.`,
      solution: [{ say: 'Pens in packs.', show: `${packs} × ${per} = ${packs * per}` }, { say: 'Add the extra pens.', show: `${packs * per} + ${extra} = ${packs * per + extra}` }],
      tags: [WP],
    })
  },
}

const factorsMultiplesPrimes: Generator = {
  skill: 'm6.factors-multiples-primes',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level === 1) {
      const pair = rng.pick([[24, 36], [18, 30], [20, 30], [16, 40], [12, 42], [28, 42], [30, 45], [36, 48]] as const)
      const [x, y] = pair
      const common = factorsOf(x).filter((f) => y % f === 0)
      const notCommon = uniq([...factorsOf(x), ...factorsOf(y)]).filter((f) => !common.includes(f))
      const good = rng.sample(common.filter((f) => f > 1), Math.min(3, common.length - 1))
      const bad = rng.sample(notCommon, 6 - good.length)
      const opts = rng.shuffle([...good.map((v) => ({ v, ok: true })), ...bad.map((v) => ({ v, ok: false }))])
      return multiItem({
        prompt: `Choose all the common factors of ${x} and ${y}.`,
        options: opts.map((o) => (o.ok ? { text: String(o.v) } : { text: String(o.v), why: x % o.v === 0 ? `${o.v} is a factor of ${x} but not of ${y}.` : `${o.v} is a factor of ${y} but not of ${x}.` })),
        answers: opts.map((o, i) => (o.ok ? i : -1)).filter((i) => i >= 0),
        hints: ['A common factor divides both numbers exactly.', `List the factors of ${x}, then check which also divide ${y}.`, `Start with 2: does it divide both ${x} and ${y}?`],
        explanation: `The common factors of ${x} and ${y} are ${common.join(', ')}.`,
        solution: [{ say: `Factors of ${x}.`, show: factorsOf(x).join(', ') }, { say: `Factors of ${y}.`, show: factorsOf(y).join(', ') }, { say: 'Common factors.', show: common.join(', ') }],
      })
    }
    if (level === 2) {
      if (rng.chance(0.5)) {
        const h = rng.int(3, 15)
        const [m1, m2] = rng.pick([[2, 3], [3, 4], [2, 5], [3, 5], [4, 5], [3, 7], [5, 6], [4, 7]] as const)
        const a = h * m1
        const b = h * m2
        return numItem({
          prompt: `What is the highest common factor of ${a} and ${b}?`,
          answer: h,
          hints: ['The highest common factor is the biggest number that divides both.', `List the factors of ${a}.`, `Check each factor of ${a} to see if it also divides ${b}, starting with the largest.`],
          explanation: `${a} = ${h} × ${m1} and ${b} = ${h} × ${m2}. ${m1} and ${m2} share no factor except 1, so the highest common factor is ${h}.`,
          solution: [{ say: `Factors of ${a}.`, show: factorsOf(a).join(', ') }, { say: `Factors of ${b}.`, show: factorsOf(b).join(', ') }, { say: 'The biggest one in both lists.', show: String(h) }],
        })
      }
      let a = rng.int(4, 18)
      let b = rng.int(4, 18)
      while (a === b || lcm(a, b) > 150 || lcm(a, b) === Math.max(a, b)) {
        a = rng.int(4, 18)
        b = rng.int(4, 18)
      }
      const L = lcm(a, b)
      return numItem({
        prompt: `What is the lowest common multiple of ${a} and ${b}?`,
        answer: L,
        hints: ['The lowest common multiple is the smallest number in both times tables.', `List the multiples of ${Math.max(a, b)}.`, `Check if each multiple of ${Math.max(a, b)} divides by ${Math.min(a, b)}.`],
        explanation: `${L} = ${a} × ${L / a} = ${b} × ${L / b}. No smaller number is a multiple of both.`,
        solution: [{ say: `Multiples of ${Math.max(a, b)}.`, show: range(1, L / Math.max(a, b)).map((i) => i * Math.max(a, b)).join(', ') }, { say: `The first that divides by ${Math.min(a, b)}.`, show: String(L) }],
      })
    }
    if (level === 3) {
      const N = rng.pick([24, 30, 36, 40, 42, 45, 48, 60, 63, 70, 72, 84, 90, 98])
      const pf: number[] = []
      let r = N
      for (let p = 2; r > 1; p++) while (r % p === 0) { pf.push(p); r /= p }
      if (rng.chance(0.5)) {
        const correct = pf.join(' × ')
        const comp = factorsOf(N).filter((f) => f > 1 && f < N && !isPrime(f))
        const cf = rng.pick(comp)
        const restPf: number[] = []
        let rr = N / cf
        for (let p = 2; rr > 1; p++) while (rr % p === 0) { restPf.push(p); rr /= p }
        const w1 = [cf, ...restPf].sort((x, y) => x - y).join(' × ')
        const extra = [...pf, at(pf, 0)].sort((x, y) => x - y).join(' × ')
        const fewer = pf.slice(1).join(' × ')
        const wrongs = [
          { value: w1, why: `${cf} is not a prime number.` },
          { value: extra, why: `That multiplies to ${N * at(pf, 0)}, not ${N}.` },
          { value: fewer.length ? fewer : '1 × ' + N, why: `That multiplies to ${N / at(pf, 0)}, not ${N}.` },
          { value: `1 × ${N}`, why: `1 is not a prime number and ${N} is not prime.` },
        ].filter((w) => w.value !== correct)
        const m = mcqText(rng, correct, wrongs)
        return mcqItem({
          prompt: `Which shows ${N} written as a product of prime numbers?`,
          ...m,
          hints: ['Every number in the answer must be prime.', `Keep dividing ${N} by prime numbers: 2, 3, 5, 7.`, `${N} ÷ ${at(pf, 0)} = ${N / at(pf, 0)}.`],
          explanation: `${N} = ${correct}, and every number in it is prime.`,
          solution: [{ say: 'Divide by primes until you reach 1.', show: pf.map((p, i) => `${pf.slice(i).reduce((x, y) => x * y, 1)} ÷ ${p}`).join(', ') }, { say: 'Write the primes multiplied.', show: correct }],
        })
      }
      const largest = Math.max(...pf)
      const distinct = uniq(pf).length
      const askLargest = rng.chance(0.5)
      return numItem({
        prompt: askLargest ? `What is the largest prime factor of ${N}?` : `How many different prime factors does ${N} have?`,
        answer: askLargest ? largest : distinct,
        hints: ['A prime factor is a factor that is also a prime number.', `Divide ${N} by prime numbers, starting with 2.`, `${N} ÷ ${at(pf, 0)} = ${N / at(pf, 0)}.`],
        explanation: `${N} = ${pf.join(' × ')}. The prime factors are ${uniq(pf).join(', ')}.`,
        solution: [{ say: 'Break the number into primes.', show: `${N} = ${pf.join(' × ')}` }, { say: askLargest ? 'Pick the largest.' : 'Count the different primes.', show: String(askLargest ? largest : distinct) }],
      })
    }
    if (level === 4) {
      if (rng.chance(0.5)) {
        const [a, b] = rng.pick([[12, 18], [8, 12], [6, 10], [15, 20], [10, 25], [9, 12], [20, 30], [14, 21]] as const)
        const L = lcm(a, b)
        const ctx = rng.pick([
          `Bus A leaves the station every ${a} minutes. Bus B leaves every ${b} minutes. They both leave at 08:00. After how many minutes do they next leave together?`,
          `One light flashes every ${a} seconds. Another light flashes every ${b} seconds. They flash together now. After how many seconds do they next flash together?`,
        ])
        return numItem({
          prompt: ctx,
          answer: L,
          hints: ['You need a number in both times tables.', `List the multiples of ${b}.`, `Write the multiples of ${b} in order and test each one with ${a}.`],
          explanation: `The lowest common multiple of ${a} and ${b} is ${L}.`,
          solution: [{ say: `Multiples of ${b}.`, show: range(1, L / b).map((i) => i * b).join(', ') }, { say: `The first that is also a multiple of ${a}.`, show: String(L) }],
          tags: [WP],
          secs: 120,
        })
      }
      const h = rng.int(4, 12)
      const [m1, m2] = rng.pick([[2, 3], [3, 4], [3, 5], [4, 5], [2, 5], [5, 6]] as const)
      const a = h * m1
      const b = h * m2
      return numItem({
        prompt: `Two ribbons are ${a} cm and ${b} cm long. They are cut into pieces that are all the same length, with nothing left over. What is the longest each piece can be, in cm?`,
        answer: h,
        hints: ['The piece length must divide both lengths exactly.', `Find the highest common factor of ${a} and ${b}.`, `List the factors of ${a}.`],
        explanation: `The highest common factor of ${a} and ${b} is ${h}, so the longest piece is ${h} cm.`,
        solution: [{ say: 'Common factors.', show: factorsOf(a).filter((f) => b % f === 0).join(', ') }, { say: 'The biggest one.', show: `${h} cm` }],
        tags: [WP],
        secs: 120,
      })
    }
    for (let attempt = 0; attempt < 80; attempt++) {
      const [p, q] = rng.sample(PRIMES_TO_100.filter((x) => x > 2 && x < 50), 2).sort((x, y) => x - y) as [number, number]
      const s = p + q
      const d = q - p
      const pairs = PRIMES_TO_100.filter((x) => x < s && isPrime(s - x) && x <= s - x).filter((x) => s - x - x === d)
      if (pairs.length !== 1 || d === 0) continue
      const other = PRIMES_TO_100.find((x) => isPrime(s - x) && x !== p && x !== q && x < s - x)
      return numItem({
        prompt: `Two prime numbers add up to ${s}. Their difference is ${d}. What is the larger prime number?`,
        answer: q,
        hints: [`List pairs of prime numbers that add up to ${s}.`, `Then check which pair has a difference of ${d}.`, other ? `One pair to try is ${other} and ${s - other}.` : `Start with the smallest odd prime, 3, and check ${s - 3}.`],
        explanation: `${p} + ${q} = ${s} and ${q} − ${p} = ${d}, so the larger prime is ${q}.`,
        solution: [{ say: 'Find prime pairs with the right sum.' }, { say: 'Check the difference.', show: `${q} − ${p} = ${d}` }],
        secs: 150,
      })
    }
    return numItem({
      prompt: 'Two prime numbers add up to 30. Their difference is 4. What is the larger prime number?',
      answer: 17,
      hints: ['List pairs of prime numbers that add up to 30.', 'Then check which pair has a difference of 4.', 'One pair to try is 7 and 23.'],
      explanation: '13 + 17 = 30 and 17 − 13 = 4, so the larger prime is 17.',
      solution: [{ say: 'Pairs: 7 and 23, 11 and 19, 13 and 17.' }, { say: 'Check the difference.', show: '17 − 13 = 4' }],
    })
  },
}

const squaresCubes: Generator = {
  skill: 'm6.squares-cubes',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level === 1) {
      const cube = rng.chance(0.5)
      const k = cube ? rng.int(2, 6) : rng.int(11, 15)
      const val = cube ? k ** 3 : k * k
      return numItem({
        prompt: `What is ${k}${cube ? '³' : '²'}?`,
        answer: val,
        hints: [cube ? `${k}³ means ${k} × ${k} × ${k}.` : `${k}² means ${k} × ${k}.`, cube ? 'Multiply the first two numbers, then multiply by the third.' : `Split ${k} into 10 and ${k - 10}.`, cube ? `${k} × ${k} = ${k * k}.` : `${k} × 10 = ${k * 10}.`],
        explanation: cube ? `${k} × ${k} × ${k} = ${k * k} × ${k} = ${val}.` : `${k} × ${k} = ${k * 10} + ${k * (k - 10)} = ${val}.`,
        solution: cube
          ? [{ say: 'Multiply two of them first.', show: `${k} × ${k} = ${k * k}` }, { say: 'Then multiply by the last one.', show: `${k * k} × ${k} = ${val}` }]
          : [{ say: `Split into ${k} × 10 and ${k} × ${k - 10}.`, show: `${k * 10} + ${k * (k - 10)}` }, { say: 'Add.', show: String(val) }],
      })
    }
    if (level === 2) {
      if (rng.chance(0.6)) {
        const k = rng.int(4, 15)
        return numItem({
          prompt: `What is the square root of ${k * k}?`,
          answer: k,
          hints: ['The square root is the number that multiplies by itself to make the square.', `Think: which number × itself = ${k * k}?`, `${k - 1} × ${k - 1} = ${(k - 1) * (k - 1)}. Is that too small?`],
          explanation: `${k} × ${k} = ${k * k}, so the square root of ${k * k} is ${k}.`,
          solution: [{ say: 'Try numbers multiplied by themselves.', show: `${k - 1}² = ${(k - 1) ** 2}, ${k}² = ${k * k}` }, { say: 'The match is the root.', show: `√${k * k} = ${k}` }],
        })
      }
      const k = rng.int(4, 10)
      return numItem({
        prompt: `Which number, multiplied by itself three times, makes ${k ** 3}?`,
        answer: k,
        hints: ['You are looking for the cube root.', 'Try whole numbers. Multiply each one by itself three times.', `The last digit of ${k ** 3} is a clue.`],
        explanation: `${k} × ${k} × ${k} = ${k ** 3}, so the number is ${k}.`,
        solution: [{ say: 'List cube numbers.', show: range(2, Math.min(10, k + 1)).map((x) => `${x}³ = ${x ** 3}`).join(', ') }, { say: 'Find the match.', show: String(k) }],
      })
    }
    if (level === 3) {
      if (rng.chance(0.5)) {
        const sq = [4, 9, 16, 25, 36, 49, 81, 100]
        const cu = [8, 27, 125, 216]
        const both = [1, 64]
        const items = rng.shuffle([...rng.sample(sq, 3).map((v) => ({ text: String(v), group: 0 })), ...rng.sample(cu, 2).map((v) => ({ text: String(v), group: 1 })), ...rng.sample(both, 1).map((v) => ({ text: String(v), group: 2 }))])
        return sortItem({
          prompt: 'Sort the numbers: square number only, cube number only, or both.',
          groups: ['Square only', 'Cube only', 'Both'],
          items,
          hints: ['A square number is n × n. A cube number is n × n × n.', 'Test each number both ways.', '64 = 8 × 8. Is it also a cube?'],
          explanation: `Squares: ${items.filter((i) => i.group === 0).map((i) => i.text).join(', ')}. Cubes: ${items.filter((i) => i.group === 1).map((i) => i.text).join(', ')}. Both: ${items.filter((i) => i.group === 2).map((i) => i.text).join(', ')}.`,
          solution: [{ say: 'Square numbers up to 100.', show: '1, 4, 9, 16, 25, 36, 49, 64, 81, 100' }, { say: 'Cube numbers up to 216.', show: '1, 8, 27, 64, 125, 216' }],
        })
      }
      const c = 64
      const m = mcqText(rng, String(c), rng.sample([
        { value: '16', why: '16 = 4 × 4 is a square number, but it is not a cube number.' },
        { value: '27', why: '27 = 3 × 3 × 3 is a cube number, but it is not a square number.' },
        { value: '36', why: '36 = 6 × 6 is a square number, but it is not a cube number.' },
        { value: '8', why: '8 = 2 × 2 × 2 is a cube number, but it is not a square number.' },
        { value: '100', why: '100 = 10 × 10 is a square number, but it is not a cube number.' },
      ], 3))
      return mcqItem({
        prompt: 'Which number is both a square number and a cube number?',
        ...m,
        hints: ['Check each number in two ways.', 'Can it be written as n × n? Can it be written as n × n × n?', 'Cube numbers start 1, 8, 27.'],
        explanation: '64 = 8 × 8 and 64 = 4 × 4 × 4, so it is both a square number and a cube number.',
        solution: [{ say: 'Test as a square.', show: '64 = 8 × 8' }, { say: 'Test as a cube.', show: '64 = 4 × 4 × 4' }],
      })
    }
    if (level === 4) {
      const form = rng.int(0, 2)
      if (form === 0) {
        const a = rng.int(3, 12)
        const b = rng.int(2, 5)
        return numItem({
          prompt: `Work out ${a}² + ${b}³.`,
          answer: a * a + b ** 3,
          hints: ['Work out each power first.', `${a}² = ${a} × ${a} and ${b}³ = ${b} × ${b} × ${b}.`, `${a}² = ${a * a}.`],
          explanation: `${a}² = ${a * a} and ${b}³ = ${b ** 3}. ${a * a} + ${b ** 3} = ${a * a + b ** 3}.`,
          solution: [{ say: 'Powers first.', show: `${a * a} + ${b ** 3}` }, { say: 'Add.', show: String(a * a + b ** 3) }],
        })
      }
      if (form === 1) {
        const a = rng.int(6, 15)
        const b = rng.int(2, a - 1)
        return numItem({
          prompt: `Work out ${a}² − ${b}².`,
          answer: a * a - b * b,
          hints: ['Square each number first.', `${a}² = ${a} × ${a}.`, `${b}² = ${b * b}.`],
          explanation: `${a * a} − ${b * b} = ${a * a - b * b}.`,
          solution: [{ say: 'Square both numbers.', show: `${a * a} − ${b * b}` }, { say: 'Subtract.', show: String(a * a - b * b) }],
        })
      }
      const k = rng.int(2, 9)
      return numItem({
        prompt: `What is ${k}² × ${k}?`,
        answer: k ** 3,
        hints: [`${k}² means ${k} × ${k}.`, `So this is ${k} × ${k} × ${k}.`, `${k}² = ${k * k}.`],
        explanation: `${k}² × ${k} = ${k * k} × ${k} = ${k ** 3}, which is ${k}³.`,
        solution: [{ say: 'Square first.', show: `${k}² = ${k * k}` }, { say: 'Multiply.', show: `${k * k} × ${k} = ${k ** 3}` }],
      })
    }
    if (rng.chance(0.5)) {
      const s2 = rng.int(4, 15)
      const askPer = rng.chance(0.6)
      return numItem({
        prompt: `A square tile has an area of ${s2 * s2} cm². What is ${askPer ? 'its perimeter' : 'the length of one side'}?`,
        answer: askPer ? 4 * s2 : s2,
        unit: 'cm',
        hints: ['The area of a square is side × side.', `Find the square root of ${s2 * s2}.`, `Which number × itself = ${s2 * s2}?`],
        explanation: `${s2} × ${s2} = ${s2 * s2}, so each side is ${s2} cm.${askPer ? ` The perimeter is 4 × ${s2} = ${4 * s2} cm.` : ''}`,
        solution: [{ say: 'Find the side.', show: `√${s2 * s2} = ${s2}`, figure: { kind: 'shape', shape: 'square', sideLabels: ['? cm'], alt: `A square with an area of ${s2 * s2} cm².` } }, ...(askPer ? [{ say: 'Four equal sides.', show: `4 × ${s2} = ${4 * s2}` }] : [{ say: 'That is the side length.', show: `${s2} cm` }])],
        tags: [WP],
      })
    }
    const k = rng.int(3, 8)
    return numItem({
      prompt: `A large cube is built from ${k ** 3} small cubes. How many small cubes long is each edge of the large cube?`,
      answer: k,
      figure: { kind: 'solid', solid: 'cube', label: `${k ** 3} small cubes`, alt: `A large cube made from ${k ** 3} small cubes.` },
      hints: ['A cube has the same number of small cubes along each edge.', `Find the number that, multiplied by itself three times, makes ${k ** 3}.`, `Try ${k - 1} × ${k - 1} × ${k - 1} = ${(k - 1) ** 3}.`],
      explanation: `${k} × ${k} × ${k} = ${k ** 3}, so each edge is ${k} cubes long.`,
      solution: [{ say: 'Find the cube root.', show: `${k}³ = ${k ** 3}` }, { say: 'Each edge.', show: `${k} cubes` }],
      tags: [WP],
    })
  },
}

const addSubtract: Generator = {
  skill: 'm6.add-subtract',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level === 1) {
      const add = rng.chance(0.5)
      let a = rng.int(1_200_000, 8_900_000)
      let b = rng.int(150_000, 990_000)
      if (!add && b > a) [a, b] = [b, a]
      const ans = add ? a + b : a - b
      return numItem({
        prompt: `Work out ${fmt(a)} ${add ? '+' : '−'} ${fmt(b)}.`,
        answer: ans,
        hints: ['Line up the numbers by place value.', add ? 'Add from the right and carry when a column makes 10 or more.' : 'Subtract from the right and exchange when the top digit is smaller.', `Ones: ${a % 10} ${add ? '+' : '−'} ${b % 10}${!add && a % 10 < b % 10 ? ' needs an exchange' : ''}.`],
        explanation: `${fmt(a)} ${add ? '+' : '−'} ${fmt(b)} = ${fmt(ans)}.`,
        solution: [{ say: 'Line up the columns.', show: `${fmt(a)} ${add ? '+' : '−'} ${fmt(b)}` }, { say: 'Work from right to left.', show: fmt(ans) }],
      })
    }
    if (level === 2) {
      const add = rng.chance(0.5)
      const ua = rng.int(101, 999) * 10 + rng.pick([0, 0, 5])
      let ub = rng.int(1001, 9999)
      if (ub % 10 === 0) ub += 3
      const A = ua
      const B = ub
      const big = add ? A : Math.max(A, B)
      const small = add ? B : Math.min(A, B)
      const ans = add ? A + B : big - small
      return numItem({
        prompt: `Work out ${fmt(dec(add ? A : big, 3))} ${add ? '+' : '−'} ${fmt(dec(add ? B : small, 3))}.`,
        answer: dec(ans, 3),
        decimal: true,
        hints: ['Line up the decimal points.', 'Fill empty decimal places with zeros so both numbers have three decimal places.', `Write ${fmt(dec(add ? A : big, 3))} as ${fx(dec(add ? A : big, 3), 3)}.`],
        explanation: `${fx(dec(add ? A : big, 3), 3)} ${add ? '+' : '−'} ${fx(dec(add ? B : small, 3), 3)} = ${fmt(dec(ans, 3))}.`,
        solution: [{ say: 'Give both numbers three decimal places.', show: `${fx(dec(add ? A : big, 3), 3)} ${add ? '+' : '−'} ${fx(dec(add ? B : small, 3), 3)}` }, { say: 'Work column by column.', show: fmt(dec(ans, 3)) }],
      })
    }
    if (level === 3) {
      const add = rng.chance(0.5)
      const near = rng.pick([1, 2])
      const wholeTarget = rng.int(3, 9)
      const bu = wholeTarget * 100 - near
      const au = rng.int(115, 1499)
      const realAdd = add || au <= bu
      const result = realAdd ? au + bu : au - bu
      if (rng.chance(0.4)) {
        const wrong = realAdd ? au + wholeTarget * 100 + near : au - wholeTarget * 100 - near
        const m = mcqFrom(rng, fmt(dec(result, 2)), [
          { value: fmt(dec(wrong, 2)), why: `${fmt(dec(bu, 2))} is ${fmt(dec(near, 2))} less than ${wholeTarget}, so adjust the other way.` },
          { value: fmt(dec(result + 100, 2)), why: 'Check the ones column.' },
          { value: fmt(dec(result - 10, 2)), why: 'Check the tenths column.' },
          { value: fmt(dec(result + 1, 2)), why: 'Check the hundredths column.' },
        ], 4, (v) => v)
        return mcqItem({
          prompt: `What is ${fmt(dec(au, 2))} ${realAdd ? '+' : '−'} ${fmt(dec(bu, 2))}?`,
          ...m,
          hints: [`${fmt(dec(bu, 2))} is close to ${wholeTarget}.`, realAdd ? `Add ${wholeTarget}, then take away ${fmt(dec(near, 2))}.` : `Take away ${wholeTarget}, then add ${fmt(dec(near, 2))} back.`, `${fmt(dec(au, 2))} ${realAdd ? '+' : '−'} ${wholeTarget} = ${fmt(dec(realAdd ? au + wholeTarget * 100 : au - wholeTarget * 100, 2))}.`],
          explanation: `${fmt(dec(au, 2))} ${realAdd ? '+' : '−'} ${wholeTarget} = ${fmt(dec(realAdd ? au + wholeTarget * 100 : au - wholeTarget * 100, 2))}, then ${realAdd ? '−' : '+'} ${fmt(dec(near, 2))} gives ${fmt(dec(result, 2))}.`,
          solution: [{ say: `Use ${wholeTarget} instead.`, show: `${fmt(dec(au, 2))} ${realAdd ? '+' : '−'} ${wholeTarget} = ${fmt(dec(realAdd ? au + wholeTarget * 100 : au - wholeTarget * 100, 2))}` }, { say: 'Adjust.', show: fmt(dec(result, 2)) }],
        })
      }
      return numItem({
        prompt: `Work out ${fmt(dec(au, 2))} ${realAdd ? '+' : '−'} ${fmt(dec(bu, 2))} in your head.`,
        answer: dec(result, 2),
        decimal: true,
        hints: [`${fmt(dec(bu, 2))} is close to ${wholeTarget}.`, realAdd ? `Add ${wholeTarget}, then take away ${fmt(dec(near, 2))}.` : `Take away ${wholeTarget}, then add ${fmt(dec(near, 2))} back.`, `${fmt(dec(au, 2))} ${realAdd ? '+' : '−'} ${wholeTarget} = ${fmt(dec(realAdd ? au + wholeTarget * 100 : au - wholeTarget * 100, 2))}.`],
        explanation: `${fmt(dec(au, 2))} ${realAdd ? '+' : '−'} ${wholeTarget} = ${fmt(dec(realAdd ? au + wholeTarget * 100 : au - wholeTarget * 100, 2))}, then adjust by ${fmt(dec(near, 2))}: ${fmt(dec(result, 2))}.`,
        solution: [{ say: `Use ${wholeTarget} instead.`, show: `${fmt(dec(au, 2))} ${realAdd ? '+' : '−'} ${wholeTarget}` }, { say: 'Adjust.', show: fmt(dec(result, 2)) }],
      })
    }
    if (level === 4) {
      if (rng.chance(0.5)) {
        const budget = rng.int(30, 90) * 100000
        const a = rng.int(800, 2500) * 1000 + rng.int(1, 9) * 100
        const b = rng.int(500, 1800) * 1000 + rng.int(1, 9) * 50
        const left = budget - a - b
        if (left <= 0) {
          return numItem({
            prompt: `A school spends ${rupiah(a)} on books and ${rupiah(b)} on sports kit. How much does it spend altogether, in rupiah?`,
            answer: a + b,
            hints: ['Altogether means add.', 'Line up the numbers by place value.', `Work out ${rupiah(a)} + ${rupiah(b)}.`],
            explanation: `${rupiah(a)} + ${rupiah(b)} = ${rupiah(a + b)}.`,
            solution: [{ say: 'Add the two amounts.', show: `${fmt(a)} + ${fmt(b)} = ${fmt(a + b)}` }, { say: 'Write it in rupiah.', show: rupiah(a + b) }],
            tags: [WP],
          })
        }
        return numItem({
          prompt: `A school has ${rupiah(budget)}. It spends ${rupiah(a)} on books and ${rupiah(b)} on sports kit. How much money is left, in rupiah?`,
          answer: left,
          hints: ['First find how much was spent.', `Add ${rupiah(a)} and ${rupiah(b)}.`, `${rupiah(a)} + ${rupiah(b)} = ${rupiah(a + b)}.`],
          explanation: `Spent: ${rupiah(a + b)}. Left: ${rupiah(budget)} − ${rupiah(a + b)} = ${rupiah(left)}.`,
          solution: [{ say: 'Add the spending.', show: `${fmt(a)} + ${fmt(b)} = ${fmt(a + b)}` }, { say: 'Subtract from the budget.', show: `${fmt(budget)} − ${fmt(a + b)} = ${fmt(left)}` }],
          tags: [WP],
          secs: 150,
        })
      }
      const name = rng.pick(NAMES)
      const runs = [rng.int(1050, 4800), rng.int(1050, 4800), rng.int(1050, 4800)]
      const total = sum(runs)
      const target = Math.ceil(total / 1000 + 1) * 1000
      return numItem({
        prompt: `${name} runs ${runs.map((r) => `${fmt(dec(r, 3))} km`).join(', ')} on three days. How much further must ${name} run to reach ${target / 1000} km in total?`,
        answer: dec(target - total, 3),
        decimal: true,
        unit: 'km',
        hints: ['Find the total distance first.', 'Line up the decimal points when you add.', `${fmt(dec(at(runs, 0), 3))} + ${fmt(dec(at(runs, 1), 3))} = ${fmt(dec(at(runs, 0) + at(runs, 1), 3))}.`],
        explanation: `Total: ${fmt(dec(total, 3))} km. ${target / 1000} − ${fmt(dec(total, 3))} = ${fmt(dec(target - total, 3))} km.`,
        solution: [{ say: 'Add the three runs.', show: `${runs.map((r) => fx(dec(r, 3), 3)).join(' + ')} = ${fmt(dec(total, 3))}` }, { say: 'Subtract from the target.', show: `${target / 1000} − ${fmt(dec(total, 3))} = ${fmt(dec(target - total, 3))}` }],
        tags: [WP],
        secs: 180,
      })
    }
    if (rng.chance(0.5)) {
      const total = rng.int(50, 200)
      const part = rng.int(105, total * 10 - 20)
      const fixed = part % 10 === 0 ? part + 3 : part
      return numItem({
        prompt: `Find the missing number. ___ + ${fmt(dec(fixed, 2))} = ${fmt(dec(total, 1))}`,
        answer: dec(total * 10 - fixed, 2),
        decimal: true,
        hints: ['Use the inverse: subtract.', `Work out ${fmt(dec(total, 1))} − ${fmt(dec(fixed, 2))}.`, `Write ${fmt(dec(total, 1))} as ${fx(dec(total, 1), 2)}.`],
        explanation: `${fx(dec(total, 1), 2)} − ${fx(dec(fixed, 2), 2)} = ${fmt(dec(total * 10 - fixed, 2))}.`,
        solution: [{ say: 'Subtract to find the missing number.', show: `${fx(dec(total, 1), 2)} − ${fx(dec(fixed, 2), 2)}` }, { say: 'Check by adding.', show: `${fmt(dec(total * 10 - fixed, 2))} + ${fmt(dec(fixed, 2))} = ${fmt(dec(total, 1))}` }],
      })
    }
    const W = rng.int(3, 20)
    const x = rng.int(105, W * 100 - 5)
    const fixed = x % 10 === 0 ? x + 1 : x
    return numItem({
      prompt: `Find the missing number. ${W} − ___ = ${fmt(dec(W * 100 - fixed, 2))}`,
      answer: dec(fixed, 2),
      decimal: true,
      hints: ['The missing number is the difference.', `Work out ${W} − ${fmt(dec(W * 100 - fixed, 2))}.`, `Write ${W} as ${W}.00.`],
      explanation: `${W}.00 − ${fx(dec(W * 100 - fixed, 2), 2)} = ${fmt(dec(fixed, 2))}.`,
      solution: [{ say: 'Subtract the answer from the start number.', show: `${W}.00 − ${fx(dec(W * 100 - fixed, 2), 2)}` }, { say: 'Check.', show: `${W} − ${fmt(dec(fixed, 2))} = ${fmt(dec(W * 100 - fixed, 2))}` }],
    })
  },
}

/** Langkah perkalian panjang: pecah pengali dua angka. */
function longMultSteps(a: number, b: number): Step[] {
  const t = Math.floor(b / 10) * 10
  const o = b % 10
  return [
    { say: `Split ${b} into ${t} and ${o}.` },
    { say: `${fmt(a)} × ${t} = ${fmt(a * t)}.`, show: `${fmt(a)} × ${t} = ${fmt(a * t)}` },
    { say: `${fmt(a)} × ${o} = ${fmt(a * o)}.`, show: `${fmt(a)} × ${o} = ${fmt(a * o)}` },
    { say: 'Add the two parts.', show: `${fmt(a * t)} + ${fmt(a * o)} = ${fmt(a * b)}` },
  ]
}

const multiplyWritten: Generator = {
  skill: 'm6.multiply-written',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const two = () => {
      let b = rng.int(12, 89)
      if (b % 10 === 0) b += 3
      return b
    }
    if (level <= 2) {
      const a = level === 1 ? rng.int(112, 899) : rng.int(1012, 6999)
      const b = two()
      return numItem({
        prompt: `Work out ${fmt(a)} × ${b}.`,
        answer: a * b,
        hints: [`Split ${b} into tens and ones.`, `Work out ${fmt(a)} × ${Math.floor(b / 10) * 10} and ${fmt(a)} × ${b % 10}, then add.`, `${fmt(a)} × ${Math.floor(b / 10) * 10} = ${fmt(a * Math.floor(b / 10) * 10)}.`],
        explanation: `${fmt(a)} × ${b} = ${fmt(a * Math.floor(b / 10) * 10)} + ${fmt(a * (b % 10))} = ${fmt(a * b)}.`,
        solution: longMultSteps(a, b),
        secs: level === 2 ? 150 : 120,
      })
    }
    if (level === 3) {
      const a = rng.int(1100, 8900)
      const b = two()
      const ra = roundTo(a, 1000)
      const rb = roundTo(b, 10)
      const est = ra * rb
      const m = mcqFrom(rng, est, [
        { value: est * 10, why: `Check the zeros: ${fmt(ra)} × ${rb} = ${fmt(est)}.` },
        { value: est / 10, why: `Check the zeros: ${fmt(ra)} × ${rb} = ${fmt(est)}.` },
        { value: (ra + 1000) * rb, why: `${fmt(a)} rounds to ${fmt(ra)}.` },
        { value: ra * (rb + 10), why: `${b} rounds to ${rb}.` },
      ])
      return mcqItem({
        prompt: `Which is the best estimate for ${fmt(a)} × ${b}?`,
        ...m,
        hints: ['Round each number first.', `Round ${fmt(a)} to the nearest 1,000 and ${b} to the nearest 10.`, `${fmt(a)} is close to ${fmt(ra)}.`],
        explanation: `${fmt(a)} ≈ ${fmt(ra)} and ${b} ≈ ${rb}. ${fmt(ra)} × ${rb} = ${fmt(est)}. The exact answer is ${fmt(a * b)}.`,
        solution: [{ say: 'Round both numbers.', show: `${fmt(ra)} × ${rb}` }, { say: 'Multiply the digits, then add the zeros.', show: fmt(est) }],
      })
    }
    if (level === 4) {
      const price = rng.int(25, 199) * 500
      const qty = two()
      const item = rng.pick(['concert tickets', 'school T-shirts', 'packs of crayons', 'bus tickets'] as const)
      return numItem({
        prompt: `A school buys ${qty} ${item} at ${rupiah(price)} each. What is the total cost, in rupiah?`,
        answer: price * qty,
        hints: ['The same price many times means multiply.', `Work out ${fmt(price)} × ${qty}.`, `${fmt(price)} × ${Math.floor(qty / 10) * 10} = ${fmt(price * Math.floor(qty / 10) * 10)}.`],
        explanation: `${rupiah(price)} × ${qty} = ${rupiah(price * qty)}.`,
        solution: longMultSteps(price, qty),
        tags: [WP],
        secs: 150,
      })
    }
    const adult = rng.int(30, 80) * 1000
    const child = rng.int(10, Math.floor(adult / 1000) - 5) * 1000
    const na = rng.int(12, 35)
    const nc = rng.int(21, 95)
    const total = adult * na + child * nc
    return numItem({
      prompt: `Museum tickets cost ${rupiah(adult)} for an adult and ${rupiah(child)} for a child. A group has ${na} adults and ${nc} children. What is the total cost, in rupiah?`,
      answer: total,
      hints: ['Work out the adult tickets and the child tickets separately.', `Adults: ${fmt(adult)} × ${na}. Children: ${fmt(child)} × ${nc}.`, `${fmt(adult)} × ${na} = ${fmt(adult * na)}.`],
      explanation: `${rupiah(adult)} × ${na} = ${rupiah(adult * na)} and ${rupiah(child)} × ${nc} = ${rupiah(child * nc)}. Total: ${rupiah(total)}.`,
      solution: [
        { say: 'Adult tickets.', show: `${fmt(adult)} × ${na} = ${fmt(adult * na)}` },
        { say: 'Child tickets.', show: `${fmt(child)} × ${nc} = ${fmt(child * nc)}` },
        { say: 'Add.', show: `${fmt(adult * na)} + ${fmt(child * nc)} = ${fmt(total)}` },
      ],
      tags: [WP],
      secs: 180,
    })
  },
}

/** Pembagian panjang dengan pembagi dua angka, dengan potongan kelipatan. */
function longDivSteps(n: number, d: number): Step[] {
  const q = Math.floor(n / d)
  const r = n % d
  const steps: Step[] = []
  let rest = n
  const qd = digitsOf(q)
  const chunks: number[] = []
  qd.forEach((digit, i) => {
    if (digit === 0) return
    const chunk = digit * 10 ** (qd.length - 1 - i)
    chunks.push(chunk)
    steps.push({ say: `${d} × ${fmt(chunk)} = ${fmt(chunk * d)}. ${fmt(rest)} − ${fmt(chunk * d)} = ${fmt(rest - chunk * d)}.` })
    rest -= chunk * d
  })
  steps.push({ say: `Add the parts: ${chunks.map(fmt).join(' + ')} = ${fmt(q)}${r ? `, remainder ${r}` : ''}.`, show: `${fmt(n)} ÷ ${d} = ${fmt(q)}${r ? ` r ${r}` : ''}` })
  return steps.slice(-8)
}

const divideWritten: Generator = {
  skill: 'm6.divide-written',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const d = rng.int(11, 29)
    if (level <= 2) {
      let q = level === 1 ? rng.int(12, Math.floor(999 / d)) : rng.int(Math.ceil(1000 / d), Math.floor(9999 / d))
      if (q % 10 === 0) q += 1
      const n = q * d
      return numItem({
        prompt: `Work out ${fmt(n)} ÷ ${d}.`,
        answer: q,
        hints: [`How many lots of ${d} are in ${fmt(n)}?`, `Take away big chunks like ${d} × 10 or ${d} × 100.`, `${d} × ${Math.floor(q / 10) * 10} = ${fmt(d * Math.floor(q / 10) * 10)}.`],
        explanation: `${fmt(n)} ÷ ${d} = ${fmt(q)}. Check: ${fmt(q)} × ${d} = ${fmt(n)}.`,
        solution: longDivSteps(n, d),
        secs: 150,
      })
    }
    if (level === 3) {
      let q = rng.int(15, 85)
      if (q % 10 === 0) q += 1
      const dd = rng.pick([12, 14, 15, 16, 18, 20, 24])
      const r = rng.int(1, dd - 1)
      const n = q * dd + r
      const f = { n: r, d: dd }
      const s1 = { n: r / gcd(r, dd), d: dd / gcd(r, dd) }
      return textItem({
        prompt: `Work out ${n} ÷ ${dd}. Write the answer as a mixed number.`,
        answers: [uniq([`${q} ${s1.n}/${s1.d}`, `${q} ${f.n}/${f.d}`])],
        hints: [`Divide ${n} by ${dd} and find the remainder.`, `The remainder is written over ${dd} as a fraction.`, `${dd} × ${q} = ${dd * q}.`],
        explanation: `${n} ÷ ${dd} = ${q} remainder ${r}. The remainder ${r} out of ${dd} is ${r}/${dd}${s1.d !== dd ? ` = ${s1.n}/${s1.d}` : ''}, so the answer is ${q} ${s1.n}/${s1.d}.`,
        solution: [{ say: 'Divide.', show: `${n} ÷ ${dd} = ${q} r ${r}` }, { say: 'Write the remainder as a fraction of the divisor.', show: `${q} ${s1.n}/${s1.d}` }],
        secs: 150,
      })
    }
    if (level === 4) {
      const dd = rng.pick([4, 5, 8, 20, 25, 40])
      let n = rng.int(dd + 1, 999)
      if (n % dd === 0) n += 1
      const ans = n / dd
      return numItem({
        prompt: `Work out ${n} ÷ ${dd}. Give your answer as a decimal.`,
        answer: Math.round(ans * 1000) / 1000,
        decimal: true,
        hints: ['Divide as normal, then keep going past the decimal point.', `Write ${n} as ${n}.000 so you can carry on dividing.`, `${dd} × ${Math.floor(ans)} = ${dd * Math.floor(ans)}, so the whole number part is ${Math.floor(ans)}.`],
        explanation: `${n} ÷ ${dd} = ${Math.floor(ans)} remainder ${n % dd}, and ${n % dd} ÷ ${dd} = ${fmt(Math.round(((n % dd) / dd) * 1000) / 1000)}. So the answer is ${fmt(Math.round(ans * 1000) / 1000)}.`,
        solution: [{ say: 'Divide the whole number part.', show: `${n} ÷ ${dd} = ${Math.floor(ans)} r ${n % dd}` }, { say: 'Divide the remainder too.', show: `${n % dd} ÷ ${dd} = ${fmt(Math.round(((n % dd) / dd) * 1000) / 1000)}` }, { say: 'Put them together.', show: fmt(Math.round(ans * 1000) / 1000) }],
        secs: 150,
      })
    }
    const per = rng.int(12, 36)
    let q = rng.int(15, 60)
    if (q % 10 === 0) q += 1
    const r = rng.int(1, per - 1)
    const n = q * per + r
    const up = rng.chance(0.5)
    const ctx = up
      ? rng.pick([
          { s: `A school orders ${fmt(n)} books. Each box holds ${per} books.`, q: 'How many boxes are needed for all the books?' },
          { s: `${fmt(n)} people are going to a festival. Each bus carries ${per} people.`, q: 'How many buses are needed?' },
        ])
      : rng.pick([
          { s: `A farmer has ${fmt(n)} eggs. Eggs are packed in trays of ${per}.`, q: 'How many full trays can the farmer fill?' },
          { s: `A baker has ${fmt(n)} g of flour. Each cake needs ${per} g.`, q: 'How many cakes can the baker make?' },
        ])
    return numItem({
      prompt: `${ctx.s} ${ctx.q}`,
      answer: up ? q + 1 : q,
      hints: [`Divide ${fmt(n)} by ${per}.`, up ? 'Every one must fit, so think about the remainder.' : 'Only complete groups count.', `${per} × ${Math.floor(q / 10) * 10} = ${fmt(per * Math.floor(q / 10) * 10)}.`],
      explanation: `${fmt(n)} ÷ ${per} = ${q} remainder ${r}. ${up ? `The remainder needs one more, so the answer is ${q + 1}.` : `The remainder is not a full group, so the answer is ${q}.`}`,
      solution: [...longDivSteps(n, per).slice(-1), { say: up ? 'Round up.' : 'Round down.', show: String(up ? q + 1 : q) }],
      tags: [WP],
      secs: 180,
    })
  },
}

/* ------------------------------------------------------------------ */
/* Nf                                                                  */
/* ------------------------------------------------------------------ */

const DENS = [3, 4, 5, 6, 8, 9, 10, 12] as const

function randFrac(rng: { int(a: number, b: number): number; pick<T>(l: readonly T[]): T }, dens: readonly number[] = DENS): Frac {
  const d = rng.pick(dens)
  let n = rng.int(1, d - 1)
  while (gcd(n, d) !== 1) n = rng.int(1, d - 1)
  return { n, d }
}

const compareFractions: Generator = {
  skill: 'm6.compare-fractions',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level === 1) {
      const base = randFrac(rng)
      const k = rng.int(3, 12)
      const n = base.n * k
      const d = base.d * k
      return textItem({
        prompt: `Write ${n}/${d} in its simplest form.`,
        answers: [[fs(base)]],
        hints: ['Divide the numerator and the denominator by the same number.', `Find the highest common factor of ${n} and ${d}.`, `Both ${n} and ${d} divide by ${smallestFactorCommon(n, d)}.`],
        explanation: `The highest common factor of ${n} and ${d} is ${k}. ${n} ÷ ${k} = ${base.n} and ${d} ÷ ${k} = ${base.d}.`,
        solution: [{ say: `Divide both by ${k}.`, show: `${n}/${d} = ${fs(base)}` }, { say: 'Check that only 1 divides both now.', show: fs(base) }],
      })
    }
    if (level <= 3) {
      const fr: Frac[] = []
      const seen = new Set<number>()
      while (fr.length < 4) {
        const f = randFrac(rng)
        const v = f.n / f.d
        if ([...seen].some((x) => Math.abs(x - v) < 1e-9)) continue
        seen.add(v)
        fr.push(f)
      }
      const L = fr.reduce((acc, f) => lcm(acc, f.d), 1)
      const conv = (f: Frac) => over(f, L)
      const asc = [...fr].sort((x, y) => conv(x) - conv(y))
      if (level === 2) {
        const greatest = rng.chance(0.5)
        const c = greatest ? at(asc, 3) : at(asc, 0)
        const m = mcqFrom(
          rng,
          fs(c),
          fr.filter((f) => f !== c).map((f) => {
            const LL = lcm(f.d, c.d)
            return { value: fs(f), why: `With denominator ${LL}: ${fs(f)} = ${over(f, LL)}/${LL} and ${fs(c)} = ${over(c, LL)}/${LL}.` }
          }),
          4,
          (v) => v,
        )
        return mcqItem({
          prompt: `Which fraction is the ${greatest ? 'greatest' : 'smallest'}?`,
          ...m,
          hints: ['The denominators are different, so compare carefully.', 'Change the fractions so they have a common denominator.', `A common denominator for all of them is ${L}.`],
          explanation: `With denominator ${L}: ${fr.map((f) => `${fs(f)} = ${conv(f)}/${L}`).join(', ')}. The ${greatest ? 'greatest' : 'smallest'} is ${fs(c)}.`,
          solution: [{ say: `Use denominator ${L}.`, show: fr.map((f) => `${conv(f)}/${L}`).join(', ') }, { say: 'Compare the numerators.', show: fs(c) }],
        })
      }
      const desc = rng.chance(0.4)
      const items = (desc ? [...asc].reverse() : asc).map(fs)
      return orderItem({
        prompt: `Put these fractions in order, starting with the ${desc ? 'largest' : 'smallest'}.`,
        items,
        hints: ['Give the fractions a common denominator.', `${L} is a common denominator for all of them.`, `${fs(at(fr, 0))} = ${conv(at(fr, 0))}/${L}.`],
        explanation: `With denominator ${L}: ${asc.map((f) => `${fs(f)} = ${conv(f)}/${L}`).join(', ')}.`,
        solution: [{ say: `Change each one into ${L}ths.`, show: fr.map((f) => `${fs(f)} = ${conv(f)}/${L}`).join(', ') }, { say: 'Order the numerators.', show: asc.map(fs).join(' < ') }],
        secs: 150,
      })
    }
    if (level === 4) {
      for (let attempt = 0; attempt < 60; attempt++) {
        const lo = randFrac(rng, [3, 4, 5, 6, 8])
        const hi = randFrac(rng, [3, 4, 5, 6, 8])
        if (hi.n / hi.d - lo.n / lo.d < 0.08) continue
        const inside = randFrac(rng, [7, 9, 10, 12, 15])
        const v = inside.n / inside.d
        if (!(v > lo.n / lo.d && v < hi.n / hi.d)) continue
        const outs: Frac[] = []
        for (let t = 0; t < 40 && outs.length < 3; t++) {
          const o = randFrac(rng, [7, 9, 10, 12, 15])
          const ov = o.n / o.d
          if ((ov < lo.n / lo.d || ov > hi.n / hi.d) && !outs.some((x) => x.n === o.n && x.d === o.d) && Math.abs(ov - lo.n / lo.d) > 1e-9 && Math.abs(ov - hi.n / hi.d) > 1e-9) outs.push(o)
        }
        if (outs.length < 3) continue
        const m = mcqFrom(
          rng,
          fs(inside),
          outs.map((o) => ({ value: fs(o), why: o.n / o.d < lo.n / lo.d ? `${fs(o)} is smaller than ${fs(lo)}.` : `${fs(o)} is bigger than ${fs(hi)}.` })),
          4,
          (x) => x,
        )
        return mcqItem({
          prompt: `Which fraction is between ${fs(lo)} and ${fs(hi)}?`,
          ...m,
          hints: ['Compare each option with both fractions.', 'Use a common denominator for each comparison.', `${fs(lo)} and ${fs(hi)} are both less than 1, so start by checking which options are bigger than ${fs(lo)}.`],
          explanation: `${fs(inside)} is bigger than ${fs(lo)} and smaller than ${fs(hi)}.`,
          solution: [{ say: 'Check each option against both fractions.' }, { say: 'Only one fits between them.', show: `${fs(lo)} < ${fs(inside)} < ${fs(hi)}` }],
          secs: 150,
        })
      }
      const m = mcqText(rng, '5/12', [
        { value: '1/12', why: '1/12 is smaller than 1/3.' },
        { value: '7/12', why: '7/12 is bigger than 1/2.' },
        { value: '11/12', why: '11/12 is bigger than 1/2.' },
      ])
      return mcqItem({
        prompt: 'Which fraction is between 1/3 and 1/2?',
        ...m,
        hints: ['Use twelfths.', '1/3 = 4/12 and 1/2 = 6/12.', 'Which option is between 4/12 and 6/12?'],
        explanation: '5/12 is between 4/12 and 6/12.',
        solution: [{ say: 'Use twelfths.', show: '1/3 = 4/12, 1/2 = 6/12' }, { say: 'Find the one in between.', show: '5/12' }],
      })
    }
    for (let attempt = 0; attempt < 80; attempt++) {
      const D = rng.pick([12, 15, 16, 18, 20, 24, 30, 40])
      const dens = factorsOf(D).filter((b) => b > 2 && b < D)
      const fracs: Frac[] = []
      for (const b of dens) for (let a = 1; a < b; a++) if (gcd(a, b) === 1) fracs.push({ n: a, d: b })
      const pairs: [Frac, Frac][] = []
      for (const lo of fracs) for (const hi of fracs) if (over(hi, D) - over(lo, D) === 2 && lo.d !== hi.d) pairs.push([lo, hi])
      if (pairs.length === 0) continue
      const [lo, hi] = rng.pick(pairs)
      const L0 = over(lo, D)
      const n = L0 + 1
      return numItem({
        prompt: `A fraction has a denominator of ${D}. It is between ${fs(lo)} and ${fs(hi)}. What is its numerator?`,
        answer: n,
        hints: [`Write ${fs(lo)} and ${fs(hi)} with denominator ${D}.`, `${fs(lo)} = ${L0}/${D}.`, `Change ${fs(hi)} into ${D}ths too, then look between the numerators.`],
        explanation: `${fs(lo)} = ${L0}/${D} and ${fs(hi)} = ${L0 + 2}/${D}. The only whole number between ${L0} and ${L0 + 2} is ${n}, so the fraction is ${n}/${D}.`,
        solution: [{ say: `Change both into ${D}ths.`, show: `${L0}/${D} and ${L0 + 2}/${D}` }, { say: 'Find the numerator in between.', show: `${n}/${D}` }],
        secs: 150,
      })
    }
    return numItem({
      prompt: 'A fraction has a denominator of 20. It is between 2/5 and 1/2. What is its numerator?',
      answer: 9,
      hints: ['Write 2/5 and 1/2 with denominator 20.', '2/5 = 8/20.', 'Which whole number numerator is between 8 and 10?'],
      explanation: '2/5 = 8/20 and 1/2 = 10/20, so the fraction is 9/20.',
      solution: [{ say: 'Change both into twentieths.', show: '8/20 and 10/20' }, { say: 'Find the one in between.', show: '9/20' }],
    })
  },
}

function smallestFactorCommon(a: number, b: number): number {
  for (let i = 2; i <= Math.min(a, b); i++) if (a % i === 0 && b % i === 0) return i
  return 1
}

const addSubtractFractions: Generator = {
  skill: 'm6.add-subtract-fractions',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const pair = (): [Frac, Frac] => {
      for (;;) {
        const a = randFrac(rng, [2, 3, 4, 5, 6, 8])
        const b = randFrac(rng, [2, 3, 4, 5, 6, 8, 10])
        if (a.d === b.d || a.d % b.d === 0 || b.d % a.d === 0) continue
        if (lcm(a.d, b.d) > 40) continue
        return [a, b]
      }
    }
    if (level <= 2) {
      let [a, b] = pair()
      if (level === 2) {
        for (let t = 0; t < 40 && a.n / a.d + b.n / b.d <= 1; t++) [a, b] = pair()
      }
      const add = level === 2 ? true : rng.chance(0.5)
      if (!add && a.n / a.d < b.n / b.d) [a, b] = [b, a]
      const L = lcm(a.d, b.d)
      const na = over(a, L)
      const nb = over(b, L)
      const res = { n: add ? na + nb : na - nb, d: L }
      return textItem({
        prompt: `Work out ${fs(a)} ${add ? '+' : '−'} ${fs(b)}.`,
        answers: [fracAnswers(res)],
        hints: ['The denominators are different. Find a common denominator.', `${L} is a multiple of ${a.d} and of ${b.d}.`, `${fs(a)} = ${na}/${L}.`],
        explanation: `${fs(a)} = ${na}/${L} and ${fs(b)} = ${nb}/${L}. ${na}/${L} ${add ? '+' : '−'} ${nb}/${L} = ${fs(res)}${simp(res).d !== L || res.n > L ? ` = ${mixed(simp(res))}` : ''}.`,
        solution: [
          { say: `Change both into ${L}ths.`, show: `${na}/${L} ${add ? '+' : '−'} ${nb}/${L}` },
          { say: `${add ? 'Add' : 'Subtract'} the numerators.`, show: fs(res) },
          { say: 'Simplify if you can.', show: mixed(simp(res)) },
        ],
      })
    }
    if (level <= 4) {
      const [a, b] = pair()
      const w1 = rng.int(level === 3 ? 1 : 3, 5)
      const w2 = rng.int(1, level === 3 ? 4 : w1 - 1)
      const L = lcm(a.d, b.d)
      const f1 = { n: w1 * L + over(a, L), d: L }
      const f2 = { n: w2 * L + over(b, L), d: L }
      const add = level === 3
      const res = { n: add ? f1.n + f2.n : f1.n - f2.n, d: L }
      const m1 = `${w1} ${fs(a)}`
      const m2 = `${w2} ${fs(b)}`
      const needsExchange = !add && over(a, L) < over(b, L)
      return textItem({
        prompt: `Work out ${m1} ${add ? '+' : '−'} ${m2}.`,
        answers: [fracAnswers(res)],
        hints: [
          add ? 'Add the whole numbers, then add the fractions.' : 'Subtract the whole numbers, then the fractions.',
          `Use ${L} as the common denominator: ${fs(a)} = ${over(a, L)}/${L} and ${fs(b)} = ${over(b, L)}/${L}.`,
          add ? `${w1} + ${w2} = ${w1 + w2}.` : needsExchange ? `${over(a, L)}/${L} is less than ${over(b, L)}/${L}, so exchange 1 whole for ${L}/${L}.` : `${w1} − ${w2} = ${w1 - w2}.`,
        ],
        explanation: `${m1} ${add ? '+' : '−'} ${m2} = ${fs(f1)} ${add ? '+' : '−'} ${fs(f2)} = ${fs(res)} = ${mixed(simp(res))}.`,
        solution: [
          { say: `Change the fractions into ${L}ths.`, show: `${w1} ${over(a, L)}/${L} ${add ? '+' : '−'} ${w2} ${over(b, L)}/${L}` },
          ...(needsExchange ? [{ say: 'Exchange 1 whole into the fraction.', show: `${w1 - 1} ${over(a, L) + L}/${L} − ${w2} ${over(b, L)}/${L}` }] : []),
          { say: `${add ? 'Add' : 'Subtract'} the wholes and the fractions.`, show: mixed(simp(res)) },
        ],
        secs: 150,
      })
    }
    const name = rng.pick(NAMES)
    const [a, b] = pair()
    const L = lcm(a.d, b.d)
    const used = over(a, L) + over(b, L)
    if (used >= L) {
      const total = { n: used, d: L }
      return textItem({
        prompt: `${name} walks ${fs(a)} km to school and ${fs(b)} km to the park. How far does ${name} walk altogether, in km?`,
        answers: [fracAnswers(total, { decimal: true })],
        hints: ['Altogether means add.', `Use ${L} as the common denominator.`, `${fs(a)} = ${over(a, L)}/${L}.`],
        explanation: `${over(a, L)}/${L} + ${over(b, L)}/${L} = ${fs(total)} = ${mixed(simp(total))} km.`,
        solution: [{ say: 'Common denominator.', show: `${over(a, L)}/${L} + ${over(b, L)}/${L}` }, { say: 'Add.', show: `${mixed(simp(total))} km` }],
        tags: [WP],
      })
    }
    const left = { n: L - used, d: L }
    return textItem({
      prompt: `${name} reads ${fs(a)} of a book on Saturday and ${fs(b)} of it on Sunday. What fraction of the book is left to read?`,
      answers: [fracAnswers(left)],
      hints: ['Find how much was read altogether first.', `Use ${L} as the common denominator.`, `${fs(a)} + ${fs(b)} = ${used}/${L}.`],
      explanation: `${fs(a)} + ${fs(b)} = ${used}/${L}. ${L}/${L} − ${used}/${L} = ${fs(left)}${simp(left).d !== L ? ` = ${fs(simp(left))}` : ''}.`,
      solution: [{ say: 'Add what was read.', show: `${over(a, L)}/${L} + ${over(b, L)}/${L} = ${used}/${L}` }, { say: 'Subtract from the whole book.', show: `${L}/${L} − ${used}/${L} = ${fs(left)}` }],
      tags: [WP],
      secs: 150,
    })
  },
}

const multiplyDivideFractions: Generator = {
  skill: 'm6.multiply-divide-fractions',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level === 1) {
      const f = randFrac(rng, [3, 4, 5, 6, 8])
      const k = rng.int(2, 9)
      const res = { n: f.n * k, d: f.d }
      return textItem({
        prompt: `Work out ${fs(f)} × ${k}.`,
        answers: [fracAnswers(res, { decimal: true })],
        hints: [`${fs(f)} × ${k} means ${k} lots of ${fs(f)}.`, 'Multiply the numerator by the whole number. Keep the denominator.', `${f.n} × ${k} = ${f.n * k}.`],
        explanation: `${fs(f)} × ${k} = ${f.n * k}/${f.d}${simp(res).d !== f.d || res.n >= f.d ? ` = ${mixed(simp(res))}` : ''}.`,
        solution: [{ say: 'Multiply the numerator.', show: `${f.n} × ${k} = ${f.n * k}` }, { say: 'Keep the denominator and simplify.', show: `${f.n * k}/${f.d} = ${mixed(simp(res))}` }],
      })
    }
    if (level === 2) {
      const f = randFrac(rng, [2, 3, 4, 5, 6, 8])
      const k = rng.int(2, 6)
      const res = { n: f.n, d: f.d * k }
      return textItem({
        prompt: `Work out ${fs(f)} ÷ ${k}.`,
        answers: [fracAnswers(res, { decimal: true })],
        hints: [`Dividing by ${k} means sharing into ${k} equal parts.`, `Multiply the denominator by ${k}. Keep the numerator.`, `${f.d} × ${k} = ${f.d * k}.`],
        explanation: `${fs(f)} ÷ ${k} = ${f.n}/${f.d * k}${simp(res).d !== f.d * k ? ` = ${fs(simp(res))}` : ''}.`,
        solution: [{ say: 'Share each part into smaller parts.', figure: f.d * k <= 16 ? { kind: 'fraction', shape: 'bar', parts: f.d * k, shaded: f.n, alt: `A bar cut into ${f.d * k} equal parts with ${f.n} shaded.` } : undefined }, { say: 'Multiply the denominator.', show: `${f.n}/${f.d * k}` }],
      })
    }
    if (level === 3) {
      const conv = rng.pick([
        { big: 'kg', small: 'g', f: 1000 },
        { big: 'km', small: 'm', f: 1000 },
        { big: 'litres', small: 'ml', f: 1000 },
        { big: 'hours', small: 'minutes', f: 60 },
        { big: 'm', small: 'cm', f: 100 },
      ] as const)
      const f = randFrac(rng, conv.f === 60 ? [3, 4, 5, 6] : [4, 5, 8, 10])
      const qty = rng.int(1, 5)
      const total = qty * conv.f
      const ok = total % f.d === 0
      const q2 = ok ? qty : f.d
      const tot2 = q2 * conv.f
      const ans = (tot2 / f.d) * f.n
      const big = q2 === 1 ? conv.big.replace(/s$/, '') : conv.big
      return numItem({
        prompt: `What is ${fs(f)} of ${q2} ${big}? Give the answer in ${conv.small}.`,
        answer: ans,
        unit: conv.small,
        hints: [`Change ${q2} ${big} into ${conv.small} first.`, `Then find 1/${f.d} and multiply by ${f.n}.`, `${q2} ${big} = ${fmt(tot2)} ${conv.small}.`],
        explanation: `${q2} ${big} = ${fmt(tot2)} ${conv.small}. ${fmt(tot2)} ÷ ${f.d} × ${f.n} = ${fmt(ans)} ${conv.small}.`,
        solution: [{ say: 'Change the units.', show: `${q2} ${big} = ${fmt(tot2)} ${conv.small}` }, { say: `Find ${fs(f)} of it.`, show: `${fmt(tot2)} ÷ ${f.d} × ${f.n} = ${fmt(ans)}` }],
      })
    }
    if (level === 4) {
      const s1 = rng.pick([
        { n: 2, d: 3 }, { n: 3, d: 4 }, { n: 2, d: 5 }, { n: 3, d: 5 }, { n: 4, d: 5 }, { n: 5, d: 6 }, { n: 2, d: 7 }, { n: 3, d: 7 },
        { n: 3, d: 8 }, { n: 5, d: 8 }, { n: 7, d: 8 }, { n: 2, d: 9 }, { n: 4, d: 9 }, { n: 5, d: 9 },
      ])
      const unit = rng.int(3, 15)
      const part = s1.n * unit
      const whole = s1.d * unit
      const name = rng.pick(NAMES)
      const ctx = rng.pick([
        { p: `${fs(s1)} of a number is ${part}. What is the number?`, wp: false },
        { p: `${name} has saved ${fs(s1)} of the money for a bicycle. That is ${rupiah(part * 10000)}. How much does the bicycle cost, in rupiah?`, wp: true },
        { p: `${fs(s1)} of the children in a school are girls. There are ${part} girls. How many children are in the school?`, wp: true },
      ])
      const money = ctx.p.includes('bicycle')
      const k = money ? 10000 : 1
      return numItem({
        prompt: ctx.p,
        answer: whole * k,
        hints: [`${s1.n} parts out of ${s1.d} make ${money ? rupiah(part * k) : part}.`, `Find one part: divide by ${s1.n}.`, `${money ? rupiah(part * k) : part} ÷ ${s1.n} = ${money ? rupiah(unit * k) : unit}.`],
        explanation: `One part is ${money ? rupiah(unit * k) : unit}. The whole is ${s1.d} parts: ${s1.d} × ${money ? rupiah(unit * k) : unit} = ${money ? rupiah(whole * k) : whole}.`,
        solution: [{ say: 'Find one part.', show: `${fmt(part * k)} ÷ ${s1.n} = ${fmt(unit * k)}` }, { say: `Multiply by ${s1.d}.`, show: `${s1.d} × ${fmt(unit * k)} = ${fmt(whole * k)}` }],
        tags: ctx.wp ? [WP] : [],
        secs: 120,
      })
    }
    const [q1, q2] = rng.pick([[4, 3], [3, 4], [5, 4], [4, 5], [2, 3], [3, 2], [5, 3]] as const)
    const unitK = rng.int(1, 6) * 1000
    const start = q1 * q2 * unitK
    const afterFirst = (start * (q1 - 1)) / q1
    const left = (afterFirst * (q2 - 1)) / q2
    const name = rng.pick(NAMES)
    return numItem({
      prompt: `${name} spends 1/${q1} of some money on lunch, then 1/${q2} of what is left on a book. ${name} has ${rupiah(left)} left. How much money was there at the start, in rupiah?`,
      answer: start,
      hints: ['Work backwards from the money left.', `After the book, ${q2 - 1}/${q2} of the money after lunch was left.`, `${rupiah(left)} is ${q2 - 1} parts out of ${q2}, so one part is ${rupiah(left / (q2 - 1))}.`],
      explanation: `After lunch there was ${rupiah(left)} ÷ ${q2 - 1} × ${q2} = ${rupiah(afterFirst)}. That is ${q1 - 1}/${q1} of the start, so the start was ${rupiah(afterFirst)} ÷ ${q1 - 1} × ${q1} = ${rupiah(start)}.`,
      solution: [
        { say: 'Undo the book.', show: `${fmt(left)} ÷ ${q2 - 1} × ${q2} = ${fmt(afterFirst)}` },
        { say: 'Undo the lunch.', show: `${fmt(afterFirst)} ÷ ${q1 - 1} × ${q1} = ${fmt(start)}` },
      ],
      tags: [WP],
      secs: 180,
    })
  },
}

const decimalsMultiplyDivide: Generator = {
  skill: 'm6.decimals-multiply-divide',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level === 1) {
      let u = rng.int(101, 999)
      if (u % 10 === 0) u += 3
      const m = rng.int(3, 9)
      return numItem({
        prompt: `Work out ${fmt(dec(u, 2))} × ${m}.`,
        answer: dec(u * m, 2),
        decimal: true,
        hints: [`Think of ${fmt(dec(u, 2))} as ${u} hundredths.`, `Work out ${u} × ${m}, then divide by 100.`, `${Math.floor(u / 100)} × ${m} = ${Math.floor(u / 100) * m}, so the answer is more than ${Math.floor(u / 100) * m}.`],
        explanation: `${u} × ${m} = ${u * m}, and ${u * m} hundredths = ${fmt(dec(u * m, 2))}.`,
        solution: [{ say: 'Multiply without the decimal point.', show: `${u} × ${m} = ${u * m}` }, { say: 'Put back two decimal places.', show: fmt(dec(u * m, 2)) }],
      })
    }
    if (level === 2) {
      let u = rng.int(11, 99)
      if (u % 10 === 0) u += 1
      let b = rng.int(12, 39)
      if (b % 10 === 0) b += 4
      return numItem({
        prompt: `Work out ${fmt(dec(u, 1))} × ${b}.`,
        answer: dec(u * b, 1),
        decimal: true,
        hints: [`Work out ${u} × ${b} first.`, 'Then put back one decimal place.', `${u} × ${Math.floor(b / 10) * 10} = ${u * Math.floor(b / 10) * 10}.`],
        explanation: `${u} × ${b} = ${u * b}, so ${fmt(dec(u, 1))} × ${b} = ${fmt(dec(u * b, 1))}.`,
        solution: [{ say: 'Multiply the whole numbers.', show: `${u} × ${b} = ${u * b}` }, { say: 'One decimal place in the question, one in the answer.', show: fmt(dec(u * b, 1)) }],
      })
    }
    if (level === 3) {
      const d = rng.int(3, 9)
      const dp = rng.pick([1, 2])
      let q = dp === 1 ? rng.int(11, 99) : rng.int(101, 999)
      if (q % 10 === 0) q += 1
      const n = q * d
      return numItem({
        prompt: `Work out ${fmt(dec(n, dp))} ÷ ${d}.`,
        answer: dec(q, dp),
        decimal: true,
        hints: [`Divide as if there were no decimal point: ${n} ÷ ${d}.`, `Then put back ${dp} decimal place${dp > 1 ? 's' : ''}.`, `${d} × ${Math.floor(q / 10) * 10} = ${d * Math.floor(q / 10) * 10}.`],
        explanation: `${n} ÷ ${d} = ${q}, so ${fmt(dec(n, dp))} ÷ ${d} = ${fmt(dec(q, dp))}.`,
        solution: [{ say: 'Divide the digits.', show: `${n} ÷ ${d} = ${q}` }, { say: 'Put the decimal point back.', show: fmt(dec(q, dp)) }],
      })
    }
    if (level === 4) {
      const people = rng.int(3, 8)
      let each = rng.int(11, 95)
      if (each % 10 === 0) each += 2
      const total = each * people
      const ctx = rng.pick([
        { s: `${people} friends share ${fmt(dec(total, 1))} litres of juice equally.`, q: 'How much does each friend get, in litres?', unit: 'litres' },
        { s: `A ${fmt(dec(total, 1))} m rope is cut into ${people} equal pieces.`, q: 'How long is each piece, in metres?', unit: 'm' },
        { s: `${people} bags of rice weigh ${fmt(dec(total, 1))} kg altogether.`, q: 'How much does one bag weigh, in kg?', unit: 'kg' },
      ])
      return numItem({
        prompt: `${ctx.s} ${ctx.q}`,
        answer: dec(each, 1),
        decimal: true,
        unit: ctx.unit,
        hints: ['Sharing equally means divide.', `Work out ${fmt(dec(total, 1))} ÷ ${people}.`, `${fmt(dec(total, 1))} is ${total} tenths.`],
        explanation: `${total} tenths ÷ ${people} = ${each} tenths = ${fmt(dec(each, 1))} ${ctx.unit}.`,
        solution: [{ say: 'Change to tenths.', show: `${fmt(dec(total, 1))} = ${total} tenths` }, { say: 'Divide.', show: `${total} ÷ ${people} = ${each} tenths = ${fmt(dec(each, 1))}` }],
        tags: [WP],
      })
    }
    if (rng.chance(0.5)) {
      let a = rng.int(181, 799)
      if (a % 10 === 0) a += 3
      let b = rng.int(21, 99)
      if (b % 10 === 0) b += 1
      const ra = Math.round(a / 10)
      const rb = Math.round(b / 10)
      const ok = ra % rb === 0 ? ra / rb : null
      if (ok !== null) {
        const m = mcqFrom(rng, ok, [
          { value: ok * 10, why: `Check the sizes: ${fmt(dec(a, 1))} ÷ ${fmt(dec(b, 1))} is about ${ra} ÷ ${rb}.` },
          { value: ra * rb, why: 'That multiplies instead of dividing.' },
          { value: ok + 2, why: `${fmt(dec(a, 1))} is close to ${ra} and ${fmt(dec(b, 1))} is close to ${rb}.` },
        ])
        return mcqItem({
          prompt: `Which is the best estimate for ${fmt(dec(a, 1))} ÷ ${fmt(dec(b, 1))}?`,
          ...m,
          hints: ['Round each number to the nearest whole number.', `${fmt(dec(a, 1))} is close to ${ra}.`, `${fmt(dec(b, 1))} is close to ${rb}.`],
          explanation: `${fmt(dec(a, 1))} ≈ ${ra} and ${fmt(dec(b, 1))} ≈ ${rb}. ${ra} ÷ ${rb} = ${ok}.`,
          solution: [{ say: 'Round both numbers.', show: `${ra} ÷ ${rb}` }, { say: 'Divide.', show: String(ok) }],
        })
      }
    }
    const price = rng.int(12, 48) * 500
    const kg = rng.int(11, 39)
    const fixedKg = kg % 10 === 0 ? kg + 2 : kg
    return numItem({
      prompt: `Mangoes cost ${rupiah(price)} per kg. ${rng.pick(NAMES)} buys ${fmt(dec(fixedKg, 1))} kg. How much does it cost, in rupiah?`,
      answer: (price * fixedKg) / 10,
      hints: [`Work out ${fmt(price)} × ${fmt(dec(fixedKg, 1))}.`, `Multiply ${fmt(price)} by ${fixedKg}, then divide by 10.`, `${fmt(price)} × ${Math.floor(fixedKg / 10)} = ${fmt(price * Math.floor(fixedKg / 10))}.`],
      explanation: `${fmt(price)} × ${fixedKg} = ${fmt(price * fixedKg)}, and ÷ 10 gives ${rupiah((price * fixedKg) / 10)}.`,
      solution: [{ say: 'Multiply by the tenths.', show: `${fmt(price)} × ${fixedKg} = ${fmt(price * fixedKg)}` }, { say: 'Divide by 10.', show: rupiah((price * fixedKg) / 10) }],
      tags: [WP],
      secs: 150,
    })
  },
}

const FDP6: readonly [number, number][] = [
  [1, 2], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5], [1, 8], [3, 8], [5, 8], [7, 8], [1, 10], [3, 10], [7, 10], [9, 10],
  [1, 20], [3, 20], [7, 20], [9, 20], [11, 20], [13, 20], [1, 25], [2, 25], [3, 25], [6, 25], [1, 50], [7, 50], [9, 50],
]

const fdpEquivalence: Generator = {
  skill: 'm6.fdp-equivalence',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const [n, d] = rng.pick(FDP6)
    const f = { n, d }
    const decv = (n * 1000) / d / 1000
    const pctv = (n * 1000) / d / 10
    if (level === 1) {
      return numItem({
        prompt: `Write ${n}/${d} as a decimal.`,
        answer: decv,
        decimal: true,
        hints: ['A decimal is tenths, hundredths or thousandths.', 100 % d === 0 ? `Make the denominator 100: multiply the top and the bottom by ${100 / d}.` : `Make the denominator 1,000: multiply the top and the bottom by ${1000 / d}.`, `Or divide ${n} by ${d}.`],
        explanation: `${n}/${d} = ${100 % d === 0 ? `${(n * 100) / d}/100` : `${(n * 1000) / d}/1000`} = ${fmt(decv)}.`,
        solution: [{ say: 'Change to tenths, hundredths or thousandths.', show: 100 % d === 0 ? `${n}/${d} = ${(n * 100) / d}/100` : `${n}/${d} = ${(n * 1000) / d}/1000` }, { say: 'Write it as a decimal.', show: fmt(decv) }],
      })
    }
    if (level === 2) {
      const dpl = String(decv).split('.')[1]?.length ?? 0
      const raw = { n: Math.round(decv * 10 ** dpl), d: 10 ** dpl }
      return textItem({
        prompt: `Write ${fmt(decv)} as a fraction in its simplest form.`,
        answers: [[fs(simp(raw))]],
        hints: [`${fmt(decv)} has ${dpl} decimal place${dpl > 1 ? 's' : ''}, so start with a denominator of ${fmt(raw.d)}.`, 'Write the digits after the point as the numerator, then simplify.', gcd(raw.n, raw.d) > 1 ? `${raw.n} and ${fmt(raw.d)} have a common factor of ${smallestFactorCommon(raw.n, raw.d)}.` : 'Check whether the numerator and the denominator share a factor.'],
        explanation: `${fmt(decv)} = ${raw.n}/${raw.d} = ${fs(simp(raw))}.`,
        solution: [{ say: 'Write it over a power of 10.', show: `${raw.n}/${raw.d}` }, { say: 'Simplify.', show: fs(simp(raw)) }],
      })
    }
    if (level === 3) {
      if (rng.chance(0.5)) {
        const p = Number.isInteger(pctv) ? pctv : rng.pick([35, 45, 15, 64, 8, 24, 75, 40])
        const ff = simp({ n: p, d: 100 })
        return textItem({
          prompt: `Write ${p}% as a fraction in its simplest form.`,
          answers: [[fs(ff)]],
          hints: ['Per cent means out of 100.', `${p}% = ${p}/100.`, `Divide ${p} and 100 by a common factor.`],
          explanation: `${p}% = ${p}/100 = ${fs(ff)}.`,
          solution: [{ say: 'Write it over 100.', show: `${p}/100` }, { say: 'Simplify.', show: fs(ff) }],
        })
      }
      return numItem({
        prompt: `Write ${n}/${d} as a percentage.`,
        answer: pctv,
        unit: '%',
        decimal: true,
        hints: ['Per cent means out of 100.', `Find ${n}/${d} of 100.`, n === 1 ? `Think of 100 split into ${d} equal parts.` : `100 ÷ ${d} = ${fmt(100 / d)}.`],
        explanation: `${n}/${d} × 100 = ${fmt(pctv)}, so ${n}/${d} = ${fmt(pctv)}%.`,
        solution: [{ say: 'Find what 1/' + d + ' of 100 is.', show: `100 ÷ ${d} = ${fmt(100 / d)}` }, { say: `Multiply by ${n}.`, show: `${fmt(100 / d)} × ${n} = ${fmt(pctv)}` }],
      })
    }
    if (level === 4) {
      const forms: { text: string; v: number; how: string }[] = []
      const used = new Set<number>()
      while (forms.length < 4) {
        const [a, b] = rng.pick(FDP6)
        const v = (a * 1000) / b
        if (used.has(v)) continue
        used.add(v)
        const k = forms.length % 3
        const p = v / 10
        if (k === 0) forms.push({ text: `${a}/${b}`, v, how: `${a}/${b} = ${fmt(p)}%` })
        else if (k === 1) forms.push({ text: fmt(v / 1000), v, how: `${fmt(v / 1000)} = ${fmt(p)}%` })
        else forms.push({ text: `${fmt(p)}%`, v, how: `${fmt(p)}%` })
      }
      const asc = [...forms].sort((x, y) => x.v - y.v)
      if (rng.chance(0.5)) {
        return orderItem({
          prompt: 'Put these in order, starting with the smallest.',
          items: asc.map((x) => x.text),
          hints: ['Change them all into the same form first.', 'Percentages are often easiest to compare.', `${(forms.find((x) => !x.text.endsWith('%')) ?? at(forms, 0)).how}.`],
          explanation: `As percentages: ${asc.map((x) => x.how).join(', ')}.`,
          solution: [{ say: 'Change each one into a percentage.', show: forms.map((x) => x.how).join(', ') }, { say: 'Order them.', show: asc.map((x) => x.text).join(' < ') }],
        })
      }
      const largest = rng.chance(0.5)
      const c = largest ? at(asc, 3) : at(asc, 0)
      const m = mcqFrom(rng, c.text, forms.filter((x) => x !== c).map((x) => ({ value: x.text, why: `${x.how}, which is ${x.v < c.v ? 'less' : 'more'} than ${c.how.split(' = ').pop()}.` })), 4, (v) => v)
      return mcqItem({
        prompt: `Which is the ${largest ? 'largest' : 'smallest'}?`,
        ...m,
        hints: ['Change them all into percentages.', 'Then compare.', `${(forms.find((x) => x !== c && !x.text.endsWith('%')) ?? at(forms, 0)).how}.`],
        explanation: `As percentages: ${forms.map((x) => x.how).join(', ')}. The ${largest ? 'largest' : 'smallest'} is ${c.text}.`,
        solution: [{ say: 'Change to percentages.', show: forms.map((x) => x.how).join(', ') }, { say: 'Compare.', show: c.text }],
      })
    }
    const a = rng.pick([0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45])
    const [bn, bd] = rng.pick([[1, 5], [1, 4], [3, 10], [2, 5], [1, 10], [3, 20]] as const)
    const pa = Math.round(a * 100)
    const pb = (bn * 100) / bd
    const rest = 100 - pa - pb
    if (rest <= 0) {
      return numItem({
        prompt: `In a survey, ${fmt(a)} of the children chose football and ${bn}/${bd} chose badminton. What percentage chose football or badminton?`,
        answer: pa + pb,
        unit: '%',
        hints: ['Change both into percentages.', `${fmt(a)} = ${pa}%.`, `${bn}/${bd} = ${pb}%.`],
        explanation: `${pa}% + ${pb}% = ${pa + pb}%.`,
        solution: [{ say: 'Change to percentages.', show: `${pa}% and ${pb}%` }, { say: 'Add.', show: `${pa + pb}%` }],
        tags: [WP],
      })
    }
    return numItem({
      prompt: `In a survey, ${fmt(a)} of the children chose football, ${bn}/${bd} chose badminton and the rest chose swimming. What percentage chose swimming?`,
      answer: rest,
      unit: '%',
      hints: ['The whole group is 100%.', 'Change the decimal and the fraction into percentages.', `${fmt(a)} = ${pa}%.`],
      explanation: `${fmt(a)} = ${pa}% and ${bn}/${bd} = ${pb}%. 100% − ${pa}% − ${pb}% = ${rest}%.`,
      solution: [{ say: 'Change to percentages.', show: `${pa}% and ${pb}%` }, { say: 'Subtract from 100%.', show: `100 − ${pa} − ${pb} = ${rest}` }],
      tags: [WP],
      secs: 150,
    })
  },
}

const percentages: Generator = {
  skill: 'm6.percentages',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level === 1) {
      const p = rng.pick([15, 35, 45, 65, 85, 12, 24, 36])
      const n = p % 5 === 0 ? rng.int(2, 40) * 20 : rng.pick([25, 50, 75, 125, 150, 175, 200, 225])
      const ans = (n * p) / 100
      return numItem({
        prompt: `What is ${p}% of ${fmt(n)}?`,
        answer: ans,
        decimal: !Number.isInteger(ans),
        hints: [`${p}% means ${p} out of every 100.`, p % 5 === 0 ? `Find 10% and 5% of ${fmt(n)}, then build ${p}%.` : `Find 1% of ${fmt(n)}, then multiply by ${p}.`, p % 5 === 0 ? `10% of ${fmt(n)} is ${fmt(n / 10)}.` : `1% of ${fmt(n)} is ${fmt(n / 100)}.`],
        explanation: `${p}% of ${fmt(n)} = ${fmt(ans)}.`,
        solution: p % 5 === 0
          ? [{ say: 'Find 10% and 5%.', show: `10% = ${fmt(n / 10)}, 5% = ${fmt(n / 20)}` }, { say: `Build ${p}%.`, show: `${Math.floor(p / 10)} × ${fmt(n / 10)}${p % 10 ? ` + ${fmt(n / 20)}` : ''} = ${fmt(ans)}` }]
          : [{ say: 'Find 1%.', show: `${fmt(n)} ÷ 100 = ${fmt(n / 100)}` }, { say: `Multiply by ${p}.`, show: `${fmt(n / 100)} × ${p} = ${fmt(ans)}` }],
      })
    }
    if (level === 2) {
      const p = rng.pick([10, 15, 20, 25, 30, 35, 40])
      const price = rng.int(5, 40) * 20000
      const off = (price * p) / 100
      const item = rng.pick(['bicycle', 'school bag', 'pair of trainers', 'tablet case', 'football'] as const)
      return numItem({
        prompt: `A ${item} costs ${rupiah(price)}. In a sale there is ${p}% off. What is the sale price, in rupiah?`,
        answer: price - off,
        hints: ['Find the discount first, then subtract it.', `Find ${p}% of ${rupiah(price)}.`, `10% of ${rupiah(price)} is ${rupiah(price / 10)}.`],
        explanation: `${p}% of ${rupiah(price)} = ${rupiah(off)}. ${rupiah(price)} − ${rupiah(off)} = ${rupiah(price - off)}.`,
        solution: [{ say: 'Find the discount.', show: `${p}% of ${fmt(price)} = ${fmt(off)}` }, { say: 'Subtract.', show: `${fmt(price)} − ${fmt(off)} = ${fmt(price - off)}` }],
        tags: [WP],
      })
    }
    if (level === 3) {
      const total = rng.pick([20, 25, 40, 50, 200])
      const part = rng.int(1, total - 1)
      const p = (part * 100) / total
      const what = rng.pick(['have a pet', 'walk to school', 'can swim', 'play an instrument'] as const)
      return numItem({
        prompt: `${part} out of ${total} children ${what}. What percentage is that?`,
        answer: p,
        unit: '%',
        decimal: !Number.isInteger(p),
        hints: [`Write it as a fraction: ${part}/${total}.`, 'Change the fraction so the denominator is 100.', total < 100 ? `${total} × ${100 / total} = 100.` : `${total} ÷ 2 = 100.`],
        explanation: `${part}/${total} = ${fmt(p)}/100 = ${fmt(p)}%.`,
        solution: [{ say: 'Write a fraction.', show: `${part}/${total}` }, { say: 'Make it out of 100.', show: `${fmt(p)}/100 = ${fmt(p)}%` }],
        tags: [WP],
      })
    }
    if (level === 4) {
      const up = rng.chance(0.6)
      const p = rng.pick([10, 20, 25, 30, 50, 5, 15])
      const base = rng.int(4, 30) * 20
      const change = (base * p) / 100
      const ctx = rng.pick([
        { s: `A school had ${base} pupils last year.`, q: (u: boolean) => `This year the number ${u ? 'went up' : 'went down'} by ${p}%. How many pupils are there now?` },
        { s: `A farm had ${base} chickens.`, q: (u: boolean) => `The number ${u ? 'increased' : 'decreased'} by ${p}%. How many chickens are there now?` },
      ])
      return numItem({
        prompt: `${ctx.s} ${ctx.q(up)}`,
        answer: up ? base + change : base - change,
        hints: [`Find ${p}% of ${base} first.`, `Then ${up ? 'add it to' : 'take it away from'} ${base}.`, `10% of ${base} is ${base / 10}.`],
        explanation: `${p}% of ${base} is ${fmt(change)}. ${base} ${up ? '+' : '−'} ${fmt(change)} = ${fmt(up ? base + change : base - change)}.`,
        solution: [{ say: `Find ${p}%.`, show: `${p}% of ${base} = ${fmt(change)}` }, { say: up ? 'Add it on.' : 'Take it away.', show: `${base} ${up ? '+' : '−'} ${fmt(change)} = ${fmt(up ? base + change : base - change)}` }],
        tags: [WP],
        secs: 120,
      })
    }
    if (rng.chance(0.5)) {
      const price = rng.int(8, 40) * 20000
      const p = rng.pick([10, 20, 25, 30])
      const offA = (price * p) / 100
      let offB = rng.int(2, 12) * 10000
      if (offB === offA) offB += 10000
      const cheaper = offA > offB ? 'A' : 'B'
      return numItem({
        prompt: `A game costs ${rupiah(price)} in two shops. Shop A takes ${p}% off. Shop B takes ${rupiah(offB)} off. How much cheaper is the better offer, in rupiah?`,
        answer: Math.abs(offA - offB),
        hints: [`Find ${p}% of ${rupiah(price)} for Shop A.`, 'Compare the two discounts.', `10% of ${rupiah(price)} is ${rupiah(price / 10)}.`],
        explanation: `Shop A takes off ${rupiah(offA)} and Shop B takes off ${rupiah(offB)}. Shop ${cheaper} is cheaper by ${rupiah(Math.abs(offA - offB))}.`,
        solution: [{ say: 'Shop A discount.', show: `${p}% of ${fmt(price)} = ${fmt(offA)}` }, { say: 'Compare with Shop B.', show: `${fmt(Math.max(offA, offB))} − ${fmt(Math.min(offA, offB))} = ${fmt(Math.abs(offA - offB))}` }],
        tags: [WP],
        secs: 180,
      })
    }
    const one = rng.int(2, 9) + rng.pick([0, 0.5])
    const p = rng.pick([25, 15, 40, 60, 12])
    const ans = one * p
    return numItem({
      prompt: `1% of a number is ${fmt(one)}. What is ${p}% of the same number?`,
      answer: ans,
      decimal: !Number.isInteger(ans),
      hints: [`${p}% is ${p} lots of 1%.`, `Multiply ${fmt(one)} by ${p}.`, `${fmt(one)} × 10 = ${fmt(one * 10)}.`],
      explanation: `${p}% = ${p} × 1% = ${p} × ${fmt(one)} = ${fmt(ans)}.`,
      solution: [{ say: `${p} lots of 1%.`, show: `${p} × ${fmt(one)}` }, { say: 'Multiply.', show: fmt(ans) }],
    })
  },
}

const ratioProportion: Generator = {
  skill: 'm6.ratio-proportion',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level === 1) {
      const [x, y] = rng.pick([[2, 3], [3, 4], [2, 5], [3, 5], [4, 5], [5, 6], [3, 7], [4, 7], [5, 8], [7, 9], [3, 2], [5, 3]] as const)
      const k = rng.int(3, 12)
      return textItem({
        prompt: `Write the ratio ${x * k} : ${y * k} in its simplest form.`,
        answers: [[`${x}:${y}`, `${x} : ${y}`]],
        hints: ['Divide both parts by the same number.', `Find the highest common factor of ${x * k} and ${y * k}.`, `Both ${x * k} and ${y * k} divide by ${smallestFactorCommon(x * k, y * k)}.`],
        explanation: `The highest common factor is ${k}. ${x * k} ÷ ${k} = ${x} and ${y * k} ÷ ${k} = ${y}, so the ratio is ${x} : ${y}.`,
        solution: [{ say: `Divide both by ${k}.`, show: `${x * k} : ${y * k} = ${x} : ${y}` }, { say: 'Only 1 divides both now.', show: `${x} : ${y}` }],
      })
    }
    if (level === 2) {
      const [a, b] = rng.pick([[2, 3], [3, 4], [2, 5], [3, 5], [4, 5], [5, 7], [3, 7], [1, 4], [2, 7]] as const)
      const k = rng.int(4, 25)
      const total = (a + b) * k
      const [n1, n2] = pickNames6(rng)
      const askSecond = a === 1 ? true : rng.chance(0.6)
      const ctx = rng.pick([`share ${rupiah(total * 1000)}`, `share ${total} stickers`])
      const money = ctx.includes('Rp')
      const unit = money ? 1000 : 1
      return numItem({
        prompt: `${n1} and ${n2} ${ctx} in the ratio ${a} : ${b}. How much does ${askSecond ? n2 : n1} get${money ? ', in rupiah' : ''}?`,
        answer: (askSecond ? b : a) * k * unit,
        hints: [`There are ${a} + ${b} = ${a + b} equal parts.`, `Find one part: ${money ? rupiah(total * unit) : total} ÷ ${a + b}.`, `One part is ${money ? rupiah(k * unit) : k}.`],
        explanation: `One part is ${money ? rupiah(k * unit) : k}. ${askSecond ? n2 : n1} gets ${askSecond ? b : a} parts: ${money ? rupiah((askSecond ? b : a) * k * unit) : (askSecond ? b : a) * k}.`,
        solution: [{ say: 'Count the parts.', show: `${a} + ${b} = ${a + b}` }, { say: 'Find one part.', show: `${fmt(total * unit)} ÷ ${a + b} = ${fmt(k * unit)}` }, { say: 'Multiply.', show: `${askSecond ? b : a} × ${fmt(k * unit)} = ${fmt((askSecond ? b : a) * k * unit)}` }],
        tags: [WP],
        secs: 120,
      })
    }
    if (level === 3) {
      const [a, b] = rng.pick([[3, 4], [2, 3], [5, 4], [3, 5], [4, 7], [2, 5]] as const)
      const k = rng.int(3, 12)
      const ask = rng.pick(['other', 'total'] as const)
      return numItem({
        prompt: `The ratio of boys to girls in a club is ${a} : ${b}. There are ${a * k} boys. ${ask === 'other' ? 'How many girls are there?' : 'How many children are in the club altogether?'}`,
        answer: ask === 'other' ? b * k : (a + b) * k,
        hints: [`${a} parts are boys and ${b} parts are girls.`, `Find one part: ${a * k} ÷ ${a}.`, `One part is ${k} children.`],
        explanation: `One part is ${k}. Girls: ${b} × ${k} = ${b * k}.${ask === 'total' ? ` Altogether: ${a * k} + ${b * k} = ${(a + b) * k}.` : ''}`,
        solution: [{ say: 'Find one part.', show: `${a * k} ÷ ${a} = ${k}` }, { say: ask === 'other' ? 'Girls.' : 'All the parts.', show: ask === 'other' ? `${b} × ${k} = ${b * k}` : `${a + b} × ${k} = ${(a + b) * k}` }],
        tags: [WP],
      })
    }
    if (level === 4) {
      if (rng.chance(0.5)) {
        const n1 = rng.pick([4, 5, 6])
        let n2 = rng.int(3, 12)
        if (n2 === n1) n2 += 1
        const unitP = rng.int(3, 12) * 500
        const item = rng.pick(['pens', 'notebooks', 'mangoes', 'stickers'] as const)
        return numItem({
          prompt: `${n1} ${item} cost ${rupiah(n1 * unitP)}. How much do ${n2} ${item} cost, in rupiah?`,
          answer: n2 * unitP,
          hints: ['Find the cost of 1 first.', `Divide ${rupiah(n1 * unitP)} by ${n1}.`, `1 costs ${rupiah(unitP)}.`],
          explanation: `1 costs ${rupiah(unitP)}, so ${n2} cost ${n2} × ${rupiah(unitP)} = ${rupiah(n2 * unitP)}.`,
          solution: [{ say: 'Cost of 1.', show: `${fmt(n1 * unitP)} ÷ ${n1} = ${fmt(unitP)}` }, { say: `Cost of ${n2}.`, show: `${n2} × ${fmt(unitP)} = ${fmt(n2 * unitP)}` }],
          tags: [WP],
        })
      }
      const people = rng.pick([4, 6, 8])
      const target = rng.pick([3, 5, 10, 12, 14, 9].filter((x) => x !== people))
      const per = rng.pick([50, 100, 150, 200])
      const amount = (per * people) / 2
      return numItem({
        prompt: `A recipe for ${people} people uses ${amount} g of rice. How much rice is needed for ${target} people?`,
        answer: (amount * target) / people,
        unit: 'g',
        decimal: !Number.isInteger((amount * target) / people),
        hints: ['Find the amount for 1 person, or for 2 people.', `${amount} ÷ ${people} gives the amount for 1 person.`, `For 2 people: ${amount} ÷ ${people / 2} = ${(amount * 2) / people} g.`],
        explanation: `1 person needs ${fmt(amount / people)} g, so ${target} people need ${fmt((amount * target) / people)} g.`,
        solution: [{ say: 'Amount for 1 person.', show: `${amount} ÷ ${people} = ${fmt(amount / people)}` }, { say: `Times ${target}.`, show: `${fmt(amount / people)} × ${target} = ${fmt((amount * target) / people)}` }],
        tags: [WP],
      })
    }
    if (rng.chance(0.5)) {
      const scale = rng.pick([2, 4, 5, 10, 20])
      const cmU = rng.int(15, 95)
      const map = dec(cmU, 1)
      return numItem({
        prompt: `On a map, 1 cm stands for ${scale} km. Two villages are ${fmt(map)} cm apart on the map. How far apart are they really, in km?`,
        answer: dec(cmU * scale, 1),
        decimal: true,
        unit: 'km',
        hints: [`Each centimetre on the map is ${scale} km.`, `Multiply ${fmt(map)} by ${scale}.`, `${Math.floor(cmU / 10)} cm stands for ${Math.floor(cmU / 10) * scale} km.`],
        explanation: `${fmt(map)} × ${scale} = ${fmt(dec(cmU * scale, 1))} km.`,
        solution: [{ say: 'Use the scale.', show: `1 cm → ${scale} km` }, { say: 'Multiply.', show: `${fmt(map)} × ${scale} = ${fmt(dec(cmU * scale, 1))}` }],
        tags: [WP],
      })
    }
    const [a, b] = rng.pick([[3, 5], [2, 5], [4, 7], [2, 3], [5, 8], [3, 4]] as const)
    const k = rng.int(3, 15)
    const diff = (b - a) * k
    return numItem({
      prompt: `In a box, the ratio of red pens to blue pens is ${a} : ${b}. There are ${diff} more blue pens than red pens. How many red pens are there?`,
      answer: a * k,
      hints: [`The difference between the parts is ${b} − ${a} = ${b - a} parts.`, `${b - a} parts are ${diff} pens.`, `One part is ${diff} ÷ ${b - a}.`],
      explanation: `${b - a} parts = ${diff}, so one part = ${k}. Red pens: ${a} × ${k} = ${a * k}.`,
      solution: [{ say: 'Find one part.', show: `${diff} ÷ ${b - a} = ${k}` }, { say: 'Red pens.', show: `${a} × ${k} = ${a * k}` }],
      tags: [WP],
      secs: 150,
    })
  },
}

function pickNames6(rng: { sample<T>(l: readonly T[], n: number): T[] }): [string, string] {
  const [a, b] = rng.sample(NAMES, 2)
  return [a ?? 'Aisha', b ?? 'Budi']
}

/* ------------------------------------------------------------------ */
/* Gt                                                                  */
/* ------------------------------------------------------------------ */

const ZONES = [
  { city: 'Makassar', zone: 'WITA', diff: 1 },
  { city: 'Jayapura', zone: 'WIT', diff: 2 },
  { city: 'Singapore', zone: '', diff: 1 },
  { city: 'Tokyo', zone: '', diff: 2 },
  { city: 'Dubai', zone: '', diff: -3 },
] as const

const timeTimetables: Generator = {
  skill: 'm6.time-timetables',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level === 1) {
      const h1 = rng.int(6, 15)
      const m1 = rng.int(0, 11) * 5
      const dur = rng.int(70, 330)
      const durF = dur % 5 === 0 ? dur : dur - (dur % 5)
      const [h2, m2] = addMinutes(h1, m1, durF)
      return textItem({
        prompt: `A trip starts at ${hhmm(h1, m1)} and ends at ${hhmm(h2, m2)}. How long is the trip? ___ hours ___ minutes`,
        answers: [[String(Math.floor(durF / 60))], [String(durF % 60)]],
        hints: ['Count on in whole hours first, then the minutes.', `From ${hhmm(h1, m1)}, count on whole hours without going past ${hhmm(h2, m2)}.`, `Count on to the next o'clock first: ${hhmm(h1, m1)} to ${hhmm(h1 + 1, 0)}.`],
        explanation: `From ${hhmm(h1, m1)} to ${hhmm(h2, m2)} is ${plur(Math.floor(durF / 60), 'hour', 'hours')} ${plur(durF % 60, 'minute', 'minutes')}.`,
        solution: [{ say: 'Count whole hours.', show: `${hhmm(h1, m1)} → ${hhmm(...addMinutes(h1, m1, Math.floor(durF / 60) * 60))}` }, { say: 'Count the minutes left.', show: `${durF % 60} minutes` }],
      })
    }
    if (level === 2) {
      const h1 = rng.int(5, 21)
      const m1 = rng.int(0, 59)
      const dh = rng.int(1, 5)
      const dm = rng.int(5, 55)
      const [h2, m2] = addMinutes(h1, m1, dh * 60 + dm)
      return textItem({
        prompt: `A boat leaves at ${hhmm(h1, m1)}. The trip takes ${dh} ${dh === 1 ? 'hour' : 'hours'} ${dm} minutes. What time does it arrive? Use the 24-hour clock.`,
        answers: [timeAnswers(h2, m2)],
        hints: ['Add the hours first, then the minutes.', 'If the minutes go past 60, add 1 more hour.', `${hhmm(h1, m1)} + ${dh} ${dh === 1 ? 'hour' : 'hours'} = ${hhmm(...addMinutes(h1, m1, dh * 60))}.`],
        explanation: `${hhmm(h1, m1)} + ${dh} h ${dm} min = ${hhmm(h2, m2)}.`,
        solution: [{ say: 'Add the hours.', show: hhmm(...addMinutes(h1, m1, dh * 60)) }, { say: 'Add the minutes.', show: hhmm(h2, m2) }],
        tags: [WP],
      })
    }
    if (level === 3) {
      const stations = rng.pick([
        ['Jakarta Kota', 'Manggarai', 'Depok', 'Bogor'],
        ['Surabaya', 'Sidoarjo', 'Bangil', 'Malang'],
        ['Bandung', 'Cimahi', 'Purwakarta', 'Cikampek'],
      ] as const)
      const gaps = [0, rng.int(9, 22), rng.int(12, 28), rng.int(15, 35)]
      const offs = gaps.reduce<number[]>((acc, g, i) => [...acc, i === 0 ? 0 : at(acc, i - 1) + g], [])
      const starts = [0, 1, 2, 3].map((t) => addMinutes(rng.int(6, 7), 0, t * rng.int(35, 50) + rng.int(0, 5) * 5))
      const sorted = [...starts].sort((x, y) => x[0] * 60 + x[1] - (y[0] * 60 + y[1]))
      const cell = (t: number, sIdx: number) => {
        const [h, m] = addMinutes(at(sorted, t)[0], at(sorted, t)[1], at(offs, sIdx))
        return { h, m, t: hhmm(h, m) }
      }
      const fig: Fig = {
        kind: 'table',
        caption: 'Train timetable',
        head: ['Station', 'Train 1', 'Train 2', 'Train 3', 'Train 4'],
        rows: stations.map((st, si) => [st, ...[0, 1, 2, 3].map((t) => cell(t, si).t)]),
        alt: `Train timetable. ${stations.map((st, si) => `${st}: ${[0, 1, 2, 3].map((t) => cell(t, si).t).join(', ')}`).join('. ')}.`,
      }
      if (rng.chance(0.5)) {
        const t = rng.int(0, 3)
        return numItem({
          prompt: `Look at the timetable. How many minutes does Train ${t + 1} take from ${at(stations, 0)} to ${at(stations, 3)}?`,
          answer: at(offs, 3),
          unit: 'minutes',
          figure: fig,
          hints: [`Find the Train ${t + 1} column.`, `Read the times at ${at(stations, 0)} and ${at(stations, 3)}.`, `Train ${t + 1} leaves ${at(stations, 0)} at ${cell(t, 0).t}.`],
          explanation: `It leaves at ${cell(t, 0).t} and arrives at ${cell(t, 3).t}. That is ${at(offs, 3)} minutes.`,
          solution: [{ say: 'Read both times.', show: `${cell(t, 0).t} → ${cell(t, 3).t}` }, { say: 'Count on.', show: `${at(offs, 3)} minutes` }],
          tags: [WP],
          secs: 120,
        })
      }
      const t = rng.int(1, 3)
      const arrive = cell(t, 3)
      const [dh, dm] = addMinutes(arrive.h, arrive.m, rng.int(1, 9))
      const m = mcqFrom(
        rng,
        `Train ${t + 1}`,
        [0, 1, 2, 3].filter((x) => x !== t).map((x) => ({ value: `Train ${x + 1}`, why: x > t ? `Train ${x + 1} reaches ${at(stations, 3)} at ${cell(x, 3).t}, which is too late.` : `Train ${x + 1} works, but Train ${t + 1} leaves later and still arrives in time.` })),
        4,
        (v) => v,
      )
      return mcqItem({
        prompt: `Look at the timetable. You must be in ${at(stations, 3)} by ${hhmm(dh, dm)}. Which is the latest train you can catch from ${at(stations, 0)}?`,
        ...m,
        figure: fig,
        hints: [`Read the ${at(stations, 3)} row.`, `Find the trains that arrive at or before ${hhmm(dh, dm)}.`, `Pick the one of those that leaves last.`],
        explanation: `Train ${t + 1} arrives at ${cell(t, 3).t}, before ${hhmm(dh, dm)}.${t < 3 ? ` Train ${t + 2} arrives at ${cell(t + 1, 3).t}, which is too late.` : ''}`,
        solution: [{ say: `Read the ${at(stations, 3)} row.`, show: [0, 1, 2, 3].map((x) => cell(x, 3).t).join(', ') }, { say: 'Latest one in time.', show: `Train ${t + 1}` }],
        tags: [WP],
        secs: 150,
      })
    }
    if (level === 4) {
      const z = rng.pick(ZONES)
      const h = rng.int(6, 20)
      const m = rng.int(0, 11) * 5
      const toCity = rng.chance(0.6)
      const [rh, rm] = addMinutes(h, m, (toCity ? z.diff : -z.diff) * 60)
      const rel = z.diff > 0 ? `${z.diff} ${z.diff === 1 ? 'hour' : 'hours'} ahead of` : `${-z.diff} hours behind`
      return textItem({
        prompt: toCity
          ? `${z.city} is ${rel} Jakarta. When it is ${hhmm(h, m)} in Jakarta, what time is it in ${z.city}?`
          : `${z.city} is ${rel} Jakarta. When it is ${hhmm(h, m)} in ${z.city}, what time is it in Jakarta?`,
        answers: [timeAnswers(rh, rm)],
        hints: [
          'Ahead means the clock shows a later time. Behind means an earlier time.',
          toCity ? `${z.diff > 0 ? 'Add' : 'Subtract'} ${Math.abs(z.diff)} ${Math.abs(z.diff) === 1 ? 'hour' : 'hours'}.` : `Jakarta is ${z.diff > 0 ? 'behind' : 'ahead'}, so ${z.diff > 0 ? 'subtract' : 'add'} ${Math.abs(z.diff)} ${Math.abs(z.diff) === 1 ? 'hour' : 'hours'}.`,
          `Start from ${hhmm(h, m)}.`,
        ],
        explanation: `${hhmm(h, m)} ${(toCity ? z.diff : -z.diff) > 0 ? '+' : '−'} ${Math.abs(z.diff)} h = ${hhmm(rh, rm)}.`,
        solution: [{ say: `${z.city} is ${rel} Jakarta.` }, { say: 'Change the hour.', show: `${hhmm(h, m)} → ${hhmm(rh, rm)}` }],
        tags: [WP],
      })
    }
    const z = ZONES[1]
    const h1 = rng.int(19, 23)
    const m1 = rng.int(0, 11) * 5
    const dh = rng.int(3, 5)
    const dm = rng.int(1, 11) * 5
    const [ah, am] = addMinutes(h1, m1, dh * 60 + dm)
    const [lh, lm] = addMinutes(ah, am, z.diff * 60)
    return textItem({
      prompt: `A plane leaves Jakarta at ${hhmm(h1, m1)} Jakarta time. The flight takes ${dh} hours ${dm} minutes. ${z.city} is ${z.diff} hours ahead of Jakarta. What is the local time in ${z.city} when it lands?`,
      answers: [timeAnswers(lh, lm)],
      hints: ['First find the landing time in Jakarta time.', `${hhmm(h1, m1)} + ${dh} h ${dm} min. Remember that after 23:59 comes 00:00.`, `Then add ${z.diff} hours for ${z.city}.`],
      explanation: `Jakarta time on landing: ${hhmm(ah, am)}. ${z.city} is ${z.diff} hours ahead, so it is ${hhmm(lh, lm)} there.`,
      solution: [{ say: 'Add the flight time.', show: `${hhmm(h1, m1)} → ${hhmm(ah, am)}` }, { say: 'Change to local time.', show: `${hhmm(ah, am)} + ${z.diff} h = ${hhmm(lh, lm)}` }],
      tags: [WP],
      secs: 180,
    })
  },
}

/* ------------------------------------------------------------------ */
/* Gg                                                                  */
/* ------------------------------------------------------------------ */

/** Bentuk U di grid: persegi panjang W x H dengan takik a x b di tengah sisi atas. */
function uShapeFig(H: number, W: number, a: number, b: number, c0: number): Fig {
  const shaded: [number, number][] = []
  for (let i = 0; i < H; i++) for (let j = 0; j < W; j++) if (!(i < b && j >= c0 && j < c0 + a)) shaded.push([i, j])
  return { kind: 'grid', rows: H, cols: W, shaded, showUnits: true, alt: `A U-shape on a grid of 1 cm squares. It is ${W} squares wide and ${H} squares tall, with ${anum(a)} ${a} by ${b} gap cut from the middle of the top.` }
}

const areaPerimeter: Generator = {
  skill: 'm6.area-perimeter',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level <= 2) {
      const H = rng.int(5, 10)
      const W = rng.int(7, 12)
      const a = rng.int(2, W - 4)
      const b = rng.int(2, H - 2)
      const c0 = rng.int(1, W - a - 1)
      const fig = uShapeFig(H, W, a, b, c0)
      if (level === 1) {
        const area = W * H - a * b
        return numItem({
          prompt: 'The shape is drawn on a grid of 1 cm squares. What is its area?',
          answer: area,
          unit: 'cm²',
          figure: fig,
          hints: ['Think of the whole rectangle, then take away the gap.', `The whole rectangle is ${W} cm by ${H} cm. The gap is ${a} cm by ${b} cm.`, `${W} × ${H} = ${W * H}.`],
          explanation: `${W} × ${H} = ${W * H} cm². The gap is ${a} × ${b} = ${a * b} cm². ${W * H} − ${a * b} = ${area} cm².`,
          solution: [{ say: 'Area of the whole rectangle.', show: `${W} × ${H} = ${W * H}`, figure: fig }, { say: 'Subtract the gap.', show: `${W * H} − ${a * b} = ${area}` }],
        })
      }
      const per = 2 * (W + H) + 2 * b
      return numItem({
        prompt: 'The shape is drawn on a grid of 1 cm squares. What is its perimeter?',
        answer: per,
        unit: 'cm',
        figure: fig,
        hints: ['Go all the way round the outside, including the inside edges of the gap.', `The outside rectangle is ${W} by ${H}, and the gap is ${b} cm deep.`, `The two sides of the gap add ${b} + ${b} = ${2 * b} cm.`],
        explanation: `The rectangle's perimeter is 2 × (${W} + ${H}) = ${2 * (W + H)} cm. The gap adds two edges of ${b} cm, so the perimeter is ${per} cm.`,
        solution: [{ say: 'Perimeter of the rectangle.', show: `2 × (${W} + ${H}) = ${2 * (W + H)}` }, { say: 'Add the two inside edges of the gap.', show: `${2 * (W + H)} + ${2 * b} = ${per}` }],
        secs: 120,
      })
    }
    if (level === 3) {
      const W = rng.int(8, 12)
      const h1 = rng.int(2, 5)
      const w2 = rng.int(3, W - 3)
      const h2 = rng.int(2, 6)
      const area = W * h1 + w2 * h2
      const H = h1 + h2
      const shaded: [number, number][] = []
      for (let i = 0; i < H; i++) for (let j = 0; j < W; j++) if (i >= h2 || j < w2) shaded.push([i, j])
      const fig: Fig = { kind: 'grid', rows: H, cols: W, shaded, showUnits: true, alt: `An L-shape on a grid of 1 m squares: ${anum(W)} ${W} m by ${h1} m rectangle at the bottom, with ${anum(w2)} ${w2} m by ${h2} m rectangle on top at the left.` }
      return numItem({
        prompt: `An L-shaped garden is made of two rectangles: ${W} m by ${h1} m, and ${w2} m by ${h2} m. What is its total area?`,
        answer: area,
        unit: 'm²',
        figure: fig,
        hints: ['Find the area of each rectangle.', 'Then add the two areas.', `${W} × ${h1} = ${W * h1}.`],
        explanation: `${W} × ${h1} = ${W * h1} and ${w2} × ${h2} = ${w2 * h2}. ${W * h1} + ${w2 * h2} = ${area} m².`,
        solution: [{ say: 'Bottom rectangle.', show: `${W} × ${h1} = ${W * h1}` }, { say: 'Top rectangle.', show: `${w2} × ${h2} = ${w2 * h2}` }, { say: 'Add.', show: `${area} m²` }],
        tags: [WP],
      })
    }
    if (level === 4) {
      let l = rng.int(6, 16)
      let w = rng.int(2, 12)
      if ((l + w) % 2 !== 0) w += 1
      if (w >= l) [l, w] = [w + 2, l]
      const side = (l + w) / 2
      return numItem({
        prompt: `A square has the same perimeter as a rectangle that is ${l} cm long and ${w} cm wide. What is the area of the square?`,
        answer: side * side,
        unit: 'cm²',
        hints: ['Find the perimeter of the rectangle first.', 'A square has four equal sides, so divide the perimeter by 4.', `The rectangle's perimeter is 2 × (${l} + ${w}) = ${2 * (l + w)} cm.`],
        explanation: `Perimeter = ${2 * (l + w)} cm. Each side of the square is ${2 * (l + w)} ÷ 4 = ${side} cm. Area = ${side} × ${side} = ${side * side} cm².`,
        solution: [{ say: 'Rectangle perimeter.', show: `2 × (${l} + ${w}) = ${2 * (l + w)}` }, { say: 'Square side.', show: `${2 * (l + w)} ÷ 4 = ${side}` }, { say: 'Square area.', show: `${side} × ${side} = ${side * side}` }],
        secs: 150,
      })
    }
    if (rng.chance(0.5)) {
      const L = rng.int(3, 8)
      const W = rng.int(2, 6)
      const tile = rng.pick([50, 25])
      const per = 100 / tile
      return numItem({
        prompt: `A floor is ${L} m long and ${W} m wide. It is covered with square tiles that are ${tile} cm by ${tile} cm. How many tiles are needed?`,
        answer: L * per * W * per,
        hints: [`How many tiles fit along 1 m? 1 m = 100 cm.`, `${per} tiles fit along each metre.`, `Along the length: ${L} × ${per} = ${L * per} tiles.`],
        explanation: `${L * per} tiles along the length and ${W * per} along the width. ${L * per} × ${W * per} = ${L * per * W * per} tiles.`,
        solution: [{ say: 'Tiles along the length.', show: `${L} × ${per} = ${L * per}` }, { say: 'Tiles along the width.', show: `${W} × ${per} = ${W * per}` }, { say: 'Multiply.', show: `${L * per} × ${W * per} = ${L * per * W * per}` }],
        tags: [WP],
        secs: 150,
      })
    }
    const L = rng.int(4, 9)
    const W = rng.int(3, 7)
    const cost = rng.pick([45000, 60000, 75000, 85000, 120000])
    return numItem({
      prompt: `A classroom floor is ${L} m by ${W} m. Carpet costs ${rupiah(cost)} for each square metre. How much does it cost to carpet the floor, in rupiah?`,
      answer: L * W * cost,
      hints: ['Find the area of the floor first.', `Area = ${L} × ${W}.`, `${L} × ${W} = ${L * W} m².`],
      explanation: `The area is ${L * W} m². ${L * W} × ${rupiah(cost)} = ${rupiah(L * W * cost)}.`,
      solution: [{ say: 'Area.', show: `${L} × ${W} = ${L * W}` }, { say: 'Cost.', show: `${L * W} × ${fmt(cost)} = ${fmt(L * W * cost)}` }],
      tags: [WP],
      secs: 150,
    })
  },
}

const areaTriangles: Generator = {
  skill: 'm6.area-triangles',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level <= 2) {
      let b = rng.int(4, 20)
      let h = rng.int(3, 16)
      if ((b * h) % 2 !== 0) b += 1
      const right = level === 1
      const area = (b * h) / 2
      const fig: Fig = right
        ? { kind: 'shape', shape: 'right-triangle', sideLabels: [`${b} cm`, `${h} cm`], showRightAngles: true, alt: `A right-angled triangle with a base of ${b} cm and a height of ${h} cm.` }
        : { kind: 'shape', shape: 'triangle', sideLabels: [`base ${b} cm`, `height ${h} cm`], alt: `A triangle with a base of ${b} cm and a perpendicular height of ${h} cm.` }
      return numItem({
        prompt: right ? `A right-angled triangle has a base of ${b} cm and a height of ${h} cm. What is its area?` : `A triangle has a base of ${b} cm and a perpendicular height of ${h} cm. What is its area?`,
        answer: area,
        unit: 'cm²',
        figure: fig,
        hints: ['A triangle is half of a rectangle with the same base and height.', 'Area = base × height ÷ 2.', `${b} × ${h} = ${b * h}.`],
        explanation: `${b} × ${h} = ${b * h}, and half of that is ${area} cm².`,
        solution: [{ say: 'Multiply the base by the height.', show: `${b} × ${h} = ${b * h}`, figure: fig }, { say: 'Halve it.', show: `${b * h} ÷ 2 = ${area}` }],
      })
    }
    if (level === 3) {
      const y0 = rng.int(-4, 0)
      const x1 = rng.int(-5, -1)
      const x2 = rng.int(1, 5)
      const x3 = rng.int(x1, x2)
      const y3 = rng.int(1, 5)
      const base = x2 - x1
      const h = y3 - y0
      const area = (base * h) / 2
      return numItem({
        prompt: 'The triangle is drawn on a grid of 1 cm squares. What is its area?',
        answer: area,
        unit: 'cm²',
        decimal: !Number.isInteger(area),
        figure: { kind: 'coordinates', size: 6, quadrants: 4, polygon: true, points: [{ x: x1, y: y0, label: 'A' }, { x: x2, y: y0, label: 'B' }, { x: x3, y: y3, label: 'C' }], alt: `A triangle with corners A (${x1}, ${y0}), B (${x2}, ${y0}) and C (${x3}, ${y3}). AB is horizontal.` },
        hints: ['Use the horizontal side AB as the base.', `The base goes from x = ${x1} to x = ${x2}. The height goes from y = ${y0} up to C.`, `The base is ${base} cm.`],
        explanation: `Base ${base} cm, height ${h} cm. ${base} × ${h} ÷ 2 = ${fmt(area)} cm².`,
        solution: [{ say: 'Find the base and the height.', show: `base ${base}, height ${h}` }, { say: 'Base × height ÷ 2.', show: `${base} × ${h} ÷ 2 = ${fmt(area)}` }],
        secs: 120,
      })
    }
    if (level === 4) {
      let b = rng.int(4, 16)
      let h = rng.int(3, 14)
      if ((b * h) % 2 !== 0) h += 1
      const area = (b * h) / 2
      const findH = rng.chance(0.5)
      return numItem({
        prompt: findH ? `A triangle has an area of ${area} cm² and a base of ${b} cm. What is its perpendicular height?` : `A triangle has an area of ${area} cm² and a perpendicular height of ${h} cm. What is its base?`,
        answer: findH ? h : b,
        unit: 'cm',
        hints: ['Area = base × height ÷ 2.', `So base × height = ${area} × 2.`, `${area} × 2 = ${area * 2}.`],
        explanation: `Base × height = ${area * 2}. ${area * 2} ÷ ${findH ? b : h} = ${findH ? h : b} cm.`,
        solution: [{ say: 'Double the area.', show: `${area} × 2 = ${area * 2}` }, { say: `Divide by the ${findH ? 'base' : 'height'}.`, show: `${area * 2} ÷ ${findH ? b : h} = ${findH ? h : b}` }],
      })
    }
    if (rng.chance(0.5)) {
      let W = rng.int(4, 12)
      const H = rng.int(3, 10)
      const t = rng.int(2, 8)
      if ((W * t) % 2 !== 0) W += 1
      const area = W * H + (W * t) / 2
      return numItem({
        prompt: `A house shape is a rectangle ${W} cm wide and ${H} cm tall, with a triangle roof on top. The roof has the same base and is ${t} cm tall. What is the total area?`,
        answer: area,
        unit: 'cm²',
        hints: ['Find the area of the rectangle and the area of the triangle.', `Rectangle: ${W} × ${H}. Triangle: ${W} × ${t} ÷ 2.`, `${W} × ${H} = ${W * H}.`],
        explanation: `${W * H} + ${(W * t) / 2} = ${area} cm².`,
        solution: [{ say: 'Rectangle.', show: `${W} × ${H} = ${W * H}` }, { say: 'Triangle.', show: `${W} × ${t} ÷ 2 = ${(W * t) / 2}` }, { say: 'Add.', show: `${area} cm²` }],
        secs: 150,
      })
    }
    const b = rng.int(5, 16)
    const h = rng.int(3, 12)
    return numItem({
      prompt: `A parallelogram has a base of ${b} cm and a perpendicular height of ${h} cm. What is its area?`,
      answer: b * h,
      unit: 'cm²',
      figure: { kind: 'shape', shape: 'parallelogram', sideLabels: [`base ${b} cm`, `height ${h} cm`], alt: `A parallelogram with a base of ${b} cm and a perpendicular height of ${h} cm.` },
      hints: ['A parallelogram can be cut and moved to make a rectangle.', 'Area = base × perpendicular height.', `Work out ${b} × ${h}.`],
      explanation: `${b} × ${h} = ${b * h} cm². It is made of two equal triangles, each ${(b * h) / 2} cm².`,
      solution: [{ say: 'Cut off a triangle and move it to make a rectangle.' }, { say: 'Base × height.', show: `${b} × ${h} = ${b * h}` }],
    })
  },
}

const volumeCuboids: Generator = {
  skill: 'm6.volume-cuboids',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const l = rng.int(2, level <= 2 ? 8 : 15)
    const w = rng.int(2, level <= 2 ? 6 : 12)
    const h = rng.int(2, level <= 2 ? 5 : 10)
    const fig = (label: string): Fig => ({ kind: 'solid', solid: 'cuboid', label, alt: `A cuboid ${label}.` })
    if (level === 1) {
      return numItem({
        prompt: `A cuboid is built from 1 cm cubes. It is ${l} cubes long, ${w} cubes wide and ${h} cubes tall. How many cubes are used?`,
        answer: l * w * h,
        figure: fig(`${l} by ${w} by ${h} cubes`),
        hints: ['Count one layer first.', `One layer has ${l} × ${w} cubes.`, `${l} × ${w} = ${l * w}.`],
        explanation: `One layer has ${l * w} cubes and there are ${h} layers: ${l * w} × ${h} = ${l * w * h}.`,
        solution: [{ say: 'Cubes in one layer.', show: `${l} × ${w} = ${l * w}` }, { say: 'Number of layers.', show: `${l * w} × ${h} = ${l * w * h}` }],
      })
    }
    if (level === 2) {
      return numItem({
        prompt: `A box is ${l} cm long, ${w} cm wide and ${h} cm tall. What is its volume?`,
        answer: l * w * h,
        unit: 'cm³',
        figure: fig(`${l} cm × ${w} cm × ${h} cm`),
        hints: ['Volume = length × width × height.', 'Multiply two of the numbers first.', `${l} × ${w} = ${l * w}.`],
        explanation: `${l} × ${w} × ${h} = ${l * w * h} cm³.`,
        solution: [{ say: 'Multiply length by width.', show: `${l} × ${w} = ${l * w}` }, { say: 'Multiply by the height.', show: `${l * w} × ${h} = ${l * w * h}` }],
      })
    }
    if (level === 3) {
      return numItem({
        prompt: `A cuboid has a volume of ${l * w * h} cm³. It is ${l} cm long and ${w} cm wide. How tall is it?`,
        answer: h,
        unit: 'cm',
        hints: ['Volume = length × width × height.', `Find the area of the base: ${l} × ${w}.`, `${l} × ${w} = ${l * w}.`],
        explanation: `${l} × ${w} = ${l * w}. ${l * w * h} ÷ ${l * w} = ${h} cm.`,
        solution: [{ say: 'Base area.', show: `${l} × ${w} = ${l * w}` }, { say: 'Divide the volume by it.', show: `${l * w * h} ÷ ${l * w} = ${h}` }],
      })
    }
    if (level === 4) {
      const L = rng.pick([20, 25, 30, 40, 50, 60])
      const W = rng.pick([10, 20, 25, 30])
      const H = rng.pick([10, 20, 30, 40])
      const vol = L * W * H
      return numItem({
        prompt: `A fish tank is ${L} cm long, ${W} cm wide and ${H} cm tall. How many litres of water does it hold when it is full? (1,000 cm³ = 1 litre)`,
        answer: vol / 1000,
        unit: 'litres',
        decimal: !Number.isInteger(vol / 1000),
        hints: ['Find the volume in cm³ first.', `${L} × ${W} × ${H}.`, `${L} × ${W} = ${L * W}.`],
        explanation: `${L} × ${W} × ${H} = ${fmt(vol)} cm³. ${fmt(vol)} ÷ 1,000 = ${fmt(vol / 1000)} litres.`,
        solution: [{ say: 'Volume.', show: `${L} × ${W} × ${H} = ${fmt(vol)} cm³` }, { say: 'Change to litres.', show: `${fmt(vol)} ÷ 1,000 = ${fmt(vol / 1000)}` }],
        tags: [WP],
        secs: 150,
      })
    }
    const s = rng.pick([2, 3, 5])
    const a = s * rng.int(2, 6)
    const b = s * rng.int(2, 5)
    const c = s * rng.int(1, 4)
    const n = (a / s) * (b / s) * (c / s)
    return numItem({
      prompt: `A box is ${a} cm by ${b} cm by ${c} cm. How many cubes with ${s} cm edges fit exactly inside it?`,
      answer: n,
      hints: [`Find how many cubes fit along each edge of the box.`, `Along ${a} cm: ${a} ÷ ${s}.`, `${a} ÷ ${s} = ${a / s}.`],
      explanation: `${a / s} × ${b / s} × ${c / s} = ${n} cubes.`,
      solution: [{ say: 'Cubes along each edge.', show: `${a / s}, ${b / s}, ${c / s}` }, { say: 'Multiply.', show: `${a / s} × ${b / s} × ${c / s} = ${n}` }],
      secs: 150,
    })
  },
}

const angles: Generator = {
  skill: 'm6.angles',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level === 1) {
      const a = rng.int(40, 140)
      const b = rng.int(30, 120)
      const c = rng.int(25, Math.min(150, 330 - a - b))
      const d = 360 - a - b - c
      return numItem({
        prompt: `Four angles meet at a point. Three of them are ${a}°, ${b}° and ${c}°. What is the fourth angle?`,
        answer: d,
        unit: '°',
        hints: ['Angles around a point add up to 360°.', `Add the three angles you know.`, `${a} + ${b} = ${a + b}.`],
        explanation: `${a} + ${b} + ${c} = ${a + b + c}. 360 − ${a + b + c} = ${d}°.`,
        solution: [{ say: 'Add the known angles.', show: `${a} + ${b} + ${c} = ${a + b + c}` }, { say: 'Subtract from 360°.', show: `360 − ${a + b + c} = ${d}` }],
      })
    }
    if (level === 2) {
      const a = rng.int(60, 130)
      const b = rng.int(50, 130)
      const c = rng.int(40, Math.min(140, 320 - a - b))
      const d = 360 - a - b - c
      return numItem({
        prompt: `Three angles of a quadrilateral are ${a}°, ${b}° and ${c}°. What is the fourth angle?`,
        answer: d,
        unit: '°',
        figure: { kind: 'shape', shape: 'trapezium', alt: `A quadrilateral with angles of ${a}°, ${b}°, ${c}° and a missing angle.` },
        hints: ['The angles in a quadrilateral add up to 360°.', 'Add the three angles you know, then subtract from 360°.', `${a} + ${b} = ${a + b}.`],
        explanation: `${a} + ${b} + ${c} = ${a + b + c}. 360 − ${a + b + c} = ${d}°.`,
        solution: [{ say: 'Add the known angles.', show: `${a + b + c}` }, { say: 'Subtract from 360°.', show: `360 − ${a + b + c} = ${d}` }],
      })
    }
    if (level === 3) {
      if (rng.chance(0.5)) {
        const base = rng.int(25, 80)
        return numItem({
          prompt: `An isosceles triangle has two equal angles of ${base}° each. What is the third angle?`,
          answer: 180 - 2 * base,
          unit: '°',
          figure: { kind: 'shape', shape: 'triangle', alt: `An isosceles triangle with two angles of ${base}°.` },
          hints: ['The angles in a triangle add up to 180°.', `The two equal angles together make ${base} × 2.`, `${base} × 2 = ${2 * base}.`],
          explanation: `${base} + ${base} = ${2 * base}. 180 − ${2 * base} = ${180 - 2 * base}°.`,
          solution: [{ say: 'Add the two equal angles.', show: `${2 * base}` }, { say: 'Subtract from 180°.', show: `180 − ${2 * base} = ${180 - 2 * base}` }],
        })
      }
      const a = rng.int(15, 75)
      return numItem({
        prompt: `A right-angled triangle has one angle of ${a}°. What is the size of the other angle that is not the right angle?`,
        answer: 90 - a,
        unit: '°',
        figure: { kind: 'shape', shape: 'right-triangle', showRightAngles: true, alt: `A right-angled triangle with one angle of ${a}°.` },
        hints: ['One angle is 90°.', 'The three angles add up to 180°, so the other two add up to 90°.', `Work out 90 − ${a}.`],
        explanation: `180 − 90 − ${a} = ${90 - a}°.`,
        solution: [{ say: 'The right angle uses 90°.', show: '180 − 90 = 90' }, { say: 'Subtract the angle you know.', show: `90 − ${a} = ${90 - a}` }],
      })
    }
    if (level === 4) {
      const a = rng.int(30, 80)
      const b = rng.int(30, 90)
      return numItem({
        prompt: `A triangle has angles of ${a}° and ${b}°. One side next to the third angle is made longer to form a straight line. What is the angle outside the triangle on that line?`,
        answer: a + b,
        unit: '°',
        hints: ['First find the third angle of the triangle.', 'The outside angle and the third angle are on a straight line, so they add up to 180°.', `The third angle is 180 − ${a} − ${b} = ${180 - a - b}°.`],
        explanation: `The third angle is ${180 - a - b}°. The outside angle is 180 − ${180 - a - b} = ${a + b}°, which equals ${a} + ${b}.`,
        solution: [{ say: 'Third angle.', show: `180 − ${a} − ${b} = ${180 - a - b}` }, { say: 'Angle on the straight line.', show: `180 − ${180 - a - b} = ${a + b}` }],
        secs: 120,
      })
    }
    if (rng.chance(0.5)) {
      const [p, q, r] = rng.pick([[1, 2, 3], [1, 1, 2], [2, 3, 4], [1, 2, 6], [1, 3, 5], [2, 2, 5]] as const)
      const total = p + q + r
      if (180 % total === 0) {
        const x = 180 / total
        return numItem({
          prompt: `Three angles on a straight line are ${p === 1 ? '' : p}x, ${q === 1 ? '' : q}x and ${r}x. What is the value of x?`,
          answer: x,
          unit: '°',
          hints: ['Angles on a straight line add up to 180°.', `Altogether there are ${p} + ${q} + ${r} = ${total} lots of x.`, `So ${total}x = 180.`],
          explanation: `${total}x = 180, so x = 180 ÷ ${total} = ${x}°.`,
          solution: [{ say: 'Add the x terms.', show: `${total}x = 180` }, { say: 'Divide.', show: `x = ${x}` }],
          secs: 120,
        })
      }
    }
    const k = rng.pick([2, 3, 4, 5])
    const given = rng.int(4, 18) * 10
    const rest = 360 - given
    const each = rest / k
    if (!Number.isInteger(each)) {
      return numItem({
        prompt: `Around a point there is one angle of 120° and four equal angles. How big is each equal angle?`,
        answer: 60,
        unit: '°',
        hints: ['Angles around a point add up to 360°.', 'Take away the 120° first.', '360 − 120 = 240.'],
        explanation: '360 − 120 = 240, and 240 ÷ 4 = 60°.',
        solution: [{ say: 'Take away the known angle.', show: '360 − 120 = 240' }, { say: 'Share equally.', show: '240 ÷ 4 = 60' }],
      })
    }
    return numItem({
      prompt: `Around a point there is one angle of ${given}° and ${k} equal angles. How big is each equal angle?`,
      answer: each,
      unit: '°',
      hints: ['Angles around a point add up to 360°.', `Take away the ${given}° first.`, `360 − ${given} = ${rest}.`],
      explanation: `360 − ${given} = ${rest}, and ${rest} ÷ ${k} = ${each}°.`,
      solution: [{ say: 'Take away the known angle.', show: `360 − ${given} = ${rest}` }, { say: 'Share equally.', show: `${rest} ÷ ${k} = ${each}` }],
      secs: 120,
    })
  },
}

const QUADS = [
  { clue: 'four equal sides and four right angles', a: 'square' },
  { clue: 'four right angles, but its sides are not all equal', a: 'rectangle' },
  { clue: 'four equal sides, but no right angles', a: 'rhombus' },
  { clue: 'two pairs of parallel sides, no right angles, and sides that are not all equal', a: 'parallelogram' },
  { clue: 'exactly one pair of parallel sides', a: 'trapezium' },
  { clue: 'two pairs of equal sides next to each other, and no parallel sides', a: 'kite' },
] as const

const QUAD_WHY: Record<string, string> = {
  square: 'A square has four equal sides and four right angles.',
  rectangle: 'A rectangle has four right angles.',
  rhombus: 'A rhombus has four equal sides.',
  parallelogram: 'A parallelogram has two pairs of parallel sides.',
  trapezium: 'A trapezium has exactly one pair of parallel sides.',
  kite: 'A kite has two pairs of equal sides next to each other.',
}

const shapesProperties: Generator = {
  skill: 'm6.shapes-properties',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level === 1) {
      const r = rng.int(3, 25)
      const askD = rng.chance(0.5)
      const unit = rng.pick(['cm', 'm', 'mm'] as const)
      return numItem({
        prompt: askD ? `A circle has a radius of ${r} ${unit}. What is its diameter?` : `A circle has a diameter of ${2 * r} ${unit}. What is its radius?`,
        answer: askD ? 2 * r : r,
        unit,
        figure: { kind: 'shape', shape: 'circle', sideLabels: [askD ? `radius ${r} ${unit}` : `diameter ${2 * r} ${unit}`], alt: askD ? `A circle with a radius of ${r} ${unit}.` : `A circle with a diameter of ${2 * r} ${unit}.` },
        hints: ['The radius goes from the centre to the edge.', 'The diameter goes right across the circle through the centre, so it is two radii.', askD ? `Double the radius: 2 × ${r}.` : `Halve the diameter: ${2 * r} ÷ 2.`],
        explanation: askD ? `The diameter is 2 × ${r} = ${2 * r} ${unit}.` : `The radius is ${2 * r} ÷ 2 = ${r} ${unit}.`,
        solution: [{ say: 'Diameter = 2 × radius.' }, { say: askD ? 'Double it.' : 'Halve it.', show: askD ? `2 × ${r} = ${2 * r}` : `${2 * r} ÷ 2 = ${r}` }],
      })
    }
    if (level === 2) {
      const pick = rng.pick(QUADS)
      const m = mcqText(rng, pick.a, rng.shuffle(QUADS.filter((q) => q.a !== pick.a)).map((q) => ({ value: q.a, why: QUAD_WHY[q.a] ?? '' })))
      return mcqItem({
        prompt: `Which quadrilateral has ${pick.clue}?`,
        ...m,
        hints: ['Check every clue against each shape.', 'Parallel sides go in the same direction and never meet.', 'Sketch each shape quickly and test the clues.'],
        explanation: `${cap(QUAD_WHY[pick.a] ?? pick.a)} It is the only shape that fits every clue.`,
        solution: [{ say: 'Test each shape.' }, { say: 'Only one fits.', show: pick.a }],
      })
    }
    if (level === 3) {
      const base = rng.pick([
        { n: 3, name: 'triangle', adj: 'triangular' },
        { n: 5, name: 'pentagon', adj: 'pentagonal' },
        { n: 6, name: 'hexagon', adj: 'hexagonal' },
        { n: 8, name: 'octagon', adj: 'octagonal' },
      ] as const)
      const prism = rng.chance(0.5)
      const prop = rng.pick(['faces', 'edges', 'vertices'] as const)
      const val = prism ? { faces: base.n + 2, edges: 3 * base.n, vertices: 2 * base.n } : { faces: base.n + 1, edges: 2 * base.n, vertices: base.n + 1 }
      const nm = prism ? `${base.adj} prism` : `${base.adj}-based pyramid`
      return numItem({
        prompt: `How many ${prop} does ${/^[aeiou]/.test(nm) ? 'an' : 'a'} ${nm} have?`,
        answer: val[prop],
        hints: [prism ? `A prism has two matching ${base.name} ends joined by rectangles.` : `A pyramid has one ${base.name} base and triangles that meet at the top.`, `A ${base.name} has ${base.n} sides.`, prop === 'faces' ? (prism ? 'Count the two ends, then one rectangle for each side.' : 'Count the base, then one triangle for each side.') : prop === 'edges' ? (prism ? `Each end has ${base.n} edges, and edges join the two ends.` : `The base has ${base.n} edges, and edges go up to the top point.`) : prism ? `Each end has ${base.n} corners.` : `The base has ${base.n} corners, plus the top.`],
        explanation: `${cap(/^[aeiou]/.test(nm) ? 'an' : 'a')} ${nm} has ${val.faces} faces, ${val.edges} edges and ${val.vertices} vertices.`,
        solution: [{ say: prism ? 'Two ends plus the side faces.' : 'One base plus the triangles.' }, { say: `Count the ${prop}.`, show: String(val[prop]) }],
      })
    }
    if (level === 4) {
      const nets = [
        { desc: '2 circles and 1 rectangle', a: 'cylinder', why: 'A cylinder has 2 circle faces and a curved face that opens into a rectangle.' },
        { desc: '1 circle and 1 curved piece shaped like a fan', a: 'cone', why: 'A cone has 1 circle and a curved face.' },
        { desc: '4 triangles', a: 'triangular-based pyramid', why: 'A triangular-based pyramid has 4 triangle faces.' },
        { desc: '2 triangles and 3 rectangles', a: 'triangular prism', why: 'A triangular prism has 2 triangles and 3 rectangles.' },
        { desc: '1 square and 4 triangles', a: 'square-based pyramid', why: 'A square-based pyramid has 1 square and 4 triangles.' },
      ]
      const pick = rng.pick(nets)
      const m = mcqText(rng, pick.a, rng.shuffle(nets.filter((n) => n.a !== pick.a)).map((n) => ({ value: n.a, why: n.why })))
      return mcqItem({
        prompt: `A net is made of ${pick.desc}. Which 3D shape does it fold into?`,
        ...m,
        hints: ['Each piece of the net becomes one face.', 'Match the faces to a 3D shape.', 'Count the flat faces and look for curved faces.'],
        explanation: pick.why,
        solution: [{ say: 'Match each piece to a face.' }, { say: 'The shape is:', show: pick.a }],
      })
    }
    const poly = rng.pick([
      { n: 5, name: 'pentagon' },
      { n: 6, name: 'hexagon' },
      { n: 8, name: 'octagon' },
      { n: 10, name: 'decagon' },
      { n: 3, name: 'triangle' },
      { n: 4, name: 'square' },
    ] as const)
    const side = rng.int(3, 12)
    return textItem({
      prompt: `A regular polygon has a perimeter of ${poly.n * side} cm. Each side is ${side} cm. What is the name of the polygon?`,
      answers: [uniq([poly.name, `regular ${poly.name}`, ...(poly.n === 3 ? ['equilateral triangle'] : [])])],
      hints: ['Regular means all the sides are equal.', `Find how many sides it has: ${poly.n * side} ÷ ${side}.`, 'Then name a polygon with that many sides.'],
      explanation: `${poly.n * side} ÷ ${side} = ${poly.n} sides, so it is a regular ${poly.name}.`,
      solution: [{ say: 'Count the sides.', show: `${poly.n * side} ÷ ${side} = ${poly.n}` }, { say: 'Name it.', show: poly.name }],
    })
  },
}

/* ------------------------------------------------------------------ */
/* Gp                                                                  */
/* ------------------------------------------------------------------ */

const pt = (rng: { int(a: number, b: number): number }, avoid: [number, number][] = []): [number, number] => {
  for (;;) {
    const p: [number, number] = [rng.int(-5, 5), rng.int(-5, 5)]
    if (p[0] === 0 || p[1] === 0) continue
    if (avoid.some((q) => q[0] === p[0] && q[1] === p[1])) continue
    return p
  }
}

const coordFig = (points: { x: number; y: number; label?: string }[], polygon = false): Fig => ({
  kind: 'coordinates',
  size: 6,
  quadrants: 4,
  polygon,
  points,
  alt: `A coordinate grid with four quadrants, from -6 to 6. ${polygon ? 'A shape joins the points ' : 'Points: '}${points.map((p) => `${p.label ? `${p.label} at ` : ''}(${p.x}, ${p.y})`).join(', ')}.`,
})

const coordinates: Generator = {
  skill: 'm6.coordinates',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level === 1) {
      const a = pt(rng)
      const b = pt(rng, [a])
      const c = pt(rng, [a, b])
      return textItem({
        prompt: 'What are the coordinates of point A? Write them like (-2, 3).',
        answers: [coordAnswers(a[0], a[1])],
        figure: coordFig([{ x: a[0], y: a[1], label: 'A' }, { x: b[0], y: b[1], label: 'B' }, { x: c[0], y: c[1], label: 'C' }]),
        hints: ['Read across first (x), then up or down (y).', 'Left of 0 is negative for x. Below 0 is negative for y.', `Point A is ${Math.abs(a[0])} ${a[0] < 0 ? 'left' : 'right'} of the y-axis.`],
        explanation: `Point A is ${Math.abs(a[0])} ${a[0] < 0 ? 'left' : 'right'} and ${Math.abs(a[1])} ${a[1] < 0 ? 'down' : 'up'}, so it is at (${a[0]}, ${a[1]}).`,
        solution: [{ say: 'Read the x-coordinate.', show: `x = ${a[0]}` }, { say: 'Read the y-coordinate.', show: `(${a[0]}, ${a[1]})` }],
      })
    }
    if (level === 2) {
      let [x, y] = pt(rng)
      if (Math.abs(x) === Math.abs(y)) y = y > 0 ? (y === 5 ? 4 : y + 1) : y === -5 ? -4 : y - 1
      const wrongs: [number, number][] = [[y, x], [-x, y], [x, -y]]
      const all: [number, number][] = rng.shuffle([[x, y], ...wrongs])
      const labels = ['P', 'Q', 'R', 'S']
      const ci = all.findIndex((p) => p[0] === x && p[1] === y)
      const m = mcqFrom(
        rng,
        at(labels, ci),
        all
          .map((p, i) => ({ p, l: at(labels, i) }))
          .filter((o) => o.l !== at(labels, ci))
          .map((o) => ({ value: o.l, why: `Point ${o.l} is at (${o.p[0]}, ${o.p[1]}). ${o.p[0] === y && o.p[1] === x ? 'Read across first, then up or down.' : 'Check the signs.'}` })),
        4,
        (v) => v,
      )
      return mcqItem({
        prompt: `Which point is at (${x}, ${y})?`,
        ...m,
        figure: coordFig(all.map((p, i) => ({ x: p[0], y: p[1], label: at(labels, i) }))),
        hints: ['The first number is across, the second is up or down.', `${x < 0 ? 'Negative' : 'Positive'} x means ${x < 0 ? 'left' : 'right'} of the y-axis.`, `Go ${Math.abs(x)} ${x < 0 ? 'left' : 'right'} first.`],
        explanation: `(${x}, ${y}) is ${Math.abs(x)} ${x < 0 ? 'left' : 'right'} and ${Math.abs(y)} ${y < 0 ? 'down' : 'up'}. That is point ${at(labels, ci)}.`,
        solution: [{ say: `Go ${Math.abs(x)} ${x < 0 ? 'left' : 'right'}.` }, { say: `Then ${Math.abs(y)} ${y < 0 ? 'down' : 'up'}.`, show: at(labels, ci) }],
      })
    }
    if (level === 3) {
      const x1 = rng.int(-5, -1)
      const x2 = rng.int(1, 5)
      const y1 = rng.int(-5, -1)
      const y2 = rng.int(1, 5)
      const corners: [number, number][] = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]
      const miss = rng.int(0, 3)
      const shown = corners.filter((_, i) => i !== miss)
      const [mx, my] = at(corners, miss)
      return textItem({
        prompt: 'A, B and C are three corners of a rectangle. What are the coordinates of the fourth corner?',
        answers: [coordAnswers(mx, my)],
        figure: coordFig(shown.map((p, i) => ({ x: p[0], y: p[1], label: at(['A', 'B', 'C'], i) }))),
        hints: ['The sides of the rectangle are horizontal and vertical.', 'The missing corner shares its x with one corner and its y with another.', 'Write the coordinates of A, B and C first.'],
        explanation: `The rectangle uses x = ${x1} and ${x2}, and y = ${y1} and ${y2}. The missing corner is (${mx}, ${my}).`,
        solution: [{ say: 'List the known corners.', show: shown.map((p) => `(${p[0]}, ${p[1]})`).join(', ') }, { say: 'Find the missing pair.', show: `(${mx}, ${my})` }],
      })
    }
    if (level === 4) {
      const horiz = rng.chance(0.5)
      const fixed = rng.int(-5, 5)
      const a = rng.int(-6, -1)
      const b = rng.int(1, 6)
      const P: [number, number] = horiz ? [a, fixed] : [fixed, a]
      const Q: [number, number] = horiz ? [b, fixed] : [fixed, b]
      return numItem({
        prompt: `Point P is at (${P[0]}, ${P[1]}) and point Q is at (${Q[0]}, ${Q[1]}). How many units apart are P and Q?`,
        answer: b - a,
        figure: coordFig([{ x: P[0], y: P[1], label: 'P' }, { x: Q[0], y: Q[1], label: 'Q' }]),
        hints: [horiz ? 'The y-coordinates are the same, so the line PQ is horizontal.' : 'The x-coordinates are the same, so the line PQ is vertical.', `Count from ${a} to ${b} on the ${horiz ? 'x' : 'y'}-axis.`, `From ${a} to 0 is ${-a} units.`],
        explanation: `From ${a} to 0 is ${-a} and from 0 to ${b} is ${b}. ${-a} + ${b} = ${b - a} units.`,
        solution: [{ say: 'Count to 0.', show: String(-a) }, { say: 'Count on to the other point.', show: `${-a} + ${b} = ${b - a}` }],
      })
    }
    const x1 = rng.int(-6, -1)
    const x2 = rng.int(1, 6)
    const y1 = rng.int(-6, -1)
    const y2 = rng.int(1, 6)
    return numItem({
      prompt: `A rectangle has corners at (${x1}, ${y1}), (${x2}, ${y1}), (${x2}, ${y2}) and (${x1}, ${y2}). The grid is in centimetres. What is its area?`,
      answer: (x2 - x1) * (y2 - y1),
      unit: 'cm²',
      figure: coordFig([{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }], true),
      hints: ['Find the length and the width from the coordinates.', `The length goes from x = ${x1} to x = ${x2}.`, `${x2} − ${par(x1)} = ${x2 - x1}.`],
      explanation: `Length = ${x2 - x1} cm, width = ${y2 - y1} cm. Area = ${x2 - x1} × ${y2 - y1} = ${(x2 - x1) * (y2 - y1)} cm².`,
      solution: [{ say: 'Find the side lengths.', show: `${x2 - x1} and ${y2 - y1}` }, { say: 'Multiply.', show: `${(x2 - x1) * (y2 - y1)} cm²` }],
      secs: 120,
    })
  },
}

const transformations: Generator = {
  skill: 'm6.transformations',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const [x, y] = pt(rng)
    if (level === 1) {
      let dx = rng.int(-5, 5)
      let dy = rng.int(-5, 5)
      if (dx === 0) dx = 3
      if (dy === 0) dy = -2
      if (Math.abs(x + dx) > 6) dx = -dx
      if (Math.abs(y + dy) > 6) dy = -dy
      const nx = x + dx
      const ny = y + dy
      const move = `${Math.abs(dx)} ${dx > 0 ? 'right' : 'left'} and ${Math.abs(dy)} ${dy > 0 ? 'up' : 'down'}`
      return textItem({
        prompt: `Point P is at (${x}, ${y}). It is translated ${move}. What are its new coordinates?`,
        answers: [coordAnswers(nx, ny)],
        figure: coordFig([{ x, y, label: 'P' }]),
        hints: ['Right and left change x. Up and down change y.', `${dx > 0 ? 'Add' : 'Subtract'} ${Math.abs(dx)} ${dx > 0 ? 'to' : 'from'} the x-coordinate.`, `${x} ${dx > 0 ? '+' : '−'} ${Math.abs(dx)} = ${nx}.`],
        explanation: `The x-coordinate becomes ${x} ${dx > 0 ? '+' : '−'} ${Math.abs(dx)} = ${nx}. The y-coordinate becomes ${y} ${dy > 0 ? '+' : '−'} ${Math.abs(dy)} = ${ny}. The image is (${nx}, ${ny}).`,
        solution: [{ say: 'Change x.', show: `${x} → ${nx}` }, { say: 'Change y.', show: `${y} → ${ny}`, figure: coordFig([{ x, y, label: 'P' }, { x: nx, y: ny, label: 'P2' }]) }],
      })
    }
    if (level === 2) {
      const xAxis = rng.chance(0.5)
      const nx = xAxis ? x : -x
      const ny = xAxis ? -y : y
      return textItem({
        prompt: `Point P is at (${x}, ${y}). It is reflected in the ${xAxis ? 'x-axis' : 'y-axis'}. Where is its image?`,
        answers: [coordAnswers(nx, ny)],
        figure: coordFig([{ x, y, label: 'P' }]),
        hints: ['The image is the same distance from the mirror line, on the other side.', xAxis ? 'The x-axis is the mirror. The x-coordinate stays the same.' : 'The y-axis is the mirror. The y-coordinate stays the same.', xAxis ? `P is ${Math.abs(y)} ${y > 0 ? 'above' : 'below'} the x-axis.` : `P is ${Math.abs(x)} ${x > 0 ? 'right of' : 'left of'} the y-axis.`],
        explanation: `Reflecting in the ${xAxis ? 'x-axis changes the sign of y' : 'y-axis changes the sign of x'}: (${x}, ${y}) → (${nx}, ${ny}).`,
        solution: [{ say: 'Same distance on the other side of the mirror.' }, { say: 'The image.', show: `(${nx}, ${ny})`, figure: coordFig([{ x, y, label: 'P' }, { x: nx, y: ny, label: 'P2' }]) }],
      })
    }
    if (level === 3) {
      const [x2, y2] = pt(rng, [[x, y]])
      const dx = x2 - x
      const dy = y2 - y
      const desc = (a: number, b: number) =>
        [a !== 0 ? `${Math.abs(a)} ${a > 0 ? 'right' : 'left'}` : '', b !== 0 ? `${Math.abs(b)} ${b > 0 ? 'up' : 'down'}` : ''].filter(Boolean).join(' and ') || 'no move'
      const correct = desc(dx, dy)
      const wrongs = uniq([desc(-dx, -dy), desc(dy, dx), desc(dx, -dy), desc(-dx, dy), desc(dx + (dx > 0 ? 1 : -1), dy), desc(dx, dy + (dy > 0 ? 1 : -1))]).filter((w) => w !== correct)
      const m = mcqText(rng, correct, wrongs.map((w) => ({ value: w, why: w === desc(-dx, -dy) ? 'That moves Q back to P. Go from P to Q.' : 'Check the change in x and the change in y separately.' })))
      return mcqItem({
        prompt: `Point P (${x}, ${y}) is translated to point Q (${x2}, ${y2}). Which describes the translation?`,
        ...m,
        figure: coordFig([{ x, y, label: 'P' }, { x: x2, y: y2, label: 'Q' }]),
        hints: ['Find the change in x, then the change in y.', `The x-coordinate goes from ${x} to ${x2}.`, `${x2} − ${par(x)} = ${dx}.`],
        explanation: `The x-coordinate changes by ${dx} and the y-coordinate changes by ${dy}, so the translation is ${correct}.`,
        solution: [{ say: 'Change in x.', show: `${x2} − ${par(x)} = ${dx}` }, { say: 'Change in y.', show: `${y2} − ${par(y)} = ${dy}` }],
      })
    }
    if (level === 4) {
      const kind = rng.pick(['180', 'cw', 'acw'] as const)
      const [nx, ny] = kind === '180' ? [-x, -y] : kind === 'cw' ? [y, -x] : [-y, x]
      const label = kind === '180' ? 'a half turn (180°)' : kind === 'cw' ? 'a quarter turn (90°) clockwise' : 'a quarter turn (90°) anticlockwise'
      return textItem({
        prompt: `Point P is at (${x}, ${y}). It is rotated ${label} about the origin (0, 0). Where is its image?`,
        answers: [coordAnswers(nx, ny)],
        figure: coordFig([{ x, y, label: 'P' }, { x: 0, y: 0, label: 'O' }]),
        hints: [
          'Imagine a line from the origin to P, and turn the line.',
          kind === '180' ? 'A half turn moves the point to the opposite side of the origin.' : `A quarter turn moves P into the ${kind === 'cw' ? 'next quadrant clockwise' : 'next quadrant anticlockwise'}.`,
          kind === '180' ? 'Both coordinates change sign.' : 'The x and y numbers swap places, and one of them changes sign.',
        ],
        explanation: `${cap(label)} about the origin takes (${x}, ${y}) to (${nx}, ${ny}).`,
        solution: [{ say: 'Turn the point about the origin.' }, { say: 'The image.', show: `(${nx}, ${ny})`, figure: coordFig([{ x, y, label: 'P' }, { x: nx, y: ny, label: 'P2' }]) }],
        secs: 120,
      })
    }
    const xAxis = rng.chance(0.5)
    const [rx, ry] = xAxis ? [x, -y] : [-x, y]
    let dx = rng.int(-4, 4)
    if (dx === 0) dx = 2
    if (Math.abs(rx + dx) > 6) dx = -dx
    const fx2 = rx + dx
    return textItem({
      prompt: `Point P is at (${x}, ${y}). It is reflected in the ${xAxis ? 'x-axis' : 'y-axis'}, then translated ${Math.abs(dx)} ${dx > 0 ? 'right' : 'left'}. Where does it end up?`,
      answers: [coordAnswers(fx2, ry)],
      figure: coordFig([{ x, y, label: 'P' }]),
      hints: ['Do the two moves in order.', `First reflect: the ${xAxis ? 'y' : 'x'}-coordinate changes sign.`, `After the reflection P is at (${rx}, ${ry}).`],
      explanation: `Reflect: (${x}, ${y}) → (${rx}, ${ry}). Translate: (${rx}, ${ry}) → (${fx2}, ${ry}).`,
      solution: [{ say: 'Reflect.', show: `(${rx}, ${ry})` }, { say: 'Translate.', show: `(${fx2}, ${ry})` }],
      secs: 150,
    })
  },
}

/* ------------------------------------------------------------------ */
/* Ss dan Sp                                                           */
/* ------------------------------------------------------------------ */

const averages: Generator = {
  skill: 'm6.averages',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level === 1) {
      const n = rng.int(4, 6)
      const mean = rng.int(8, 40)
      let fixed: number[] = []
      do {
        fixed = Array.from({ length: n - 1 }, () => mean + rng.int(-7, 7))
        fixed.push(mean * n - sum(fixed))
      } while (at(fixed, n - 1) < 1)
      const total = sum(fixed)
      const realMean = total / n
      return numItem({
        prompt: `Find the mean of these numbers: ${rng.shuffle(fixed).join(', ')}.`,
        answer: realMean,
        decimal: !Number.isInteger(realMean),
        hints: ['Mean = total ÷ how many numbers there are.', 'Add all the numbers first.', `There are ${n} numbers.`],
        explanation: `The total is ${total}. ${total} ÷ ${n} = ${fmt(realMean)}.`,
        solution: [{ say: 'Add them.', show: `${fixed.join(' + ')} = ${total}` }, { say: `Divide by ${n}.`, show: `${total} ÷ ${n} = ${fmt(realMean)}` }],
      })
    }
    if (level === 2) {
      const kind = rng.pick(['median', 'range', 'mode'] as const)
      const n = rng.pick([6, 8])
      let list: number[] = Array.from({ length: n }, () => rng.int(3, 60))
      if (kind === 'mode') {
        do {
          list = Array.from({ length: n }, () => rng.int(3, 20))
        } while (modeList(list).length !== 1)
      }
      const sorted = [...list].sort((a, b) => a - b)
      if (kind === 'median') {
        const med = (at(sorted, n / 2 - 1) + at(sorted, n / 2)) / 2
        return numItem({
          prompt: `Find the median of these numbers: ${list.join(', ')}.`,
          answer: med,
          decimal: true,
          hints: ['Put the numbers in order.', `There are ${n} numbers, so there are two middle numbers.`, 'The median is halfway between the two middle numbers.'],
          explanation: `In order: ${sorted.join(', ')}. The middle two are ${at(sorted, n / 2 - 1)} and ${at(sorted, n / 2)}, so the median is ${fmt(med)}.`,
          solution: [{ say: 'Order the numbers.', show: sorted.join(', ') }, { say: 'Halfway between the middle two.', show: fmt(med) }],
        })
      }
      if (kind === 'range') {
        return numItem({
          prompt: `Find the range of these numbers: ${list.join(', ')}.`,
          answer: at(sorted, n - 1) - at(sorted, 0),
          hints: ['Range = largest − smallest.', 'Find the largest and the smallest numbers.', `The smallest number is ${at(sorted, 0)}.`],
          explanation: `${at(sorted, n - 1)} − ${at(sorted, 0)} = ${at(sorted, n - 1) - at(sorted, 0)}.`,
          solution: [{ say: 'Largest and smallest.', show: `${at(sorted, n - 1)} and ${at(sorted, 0)}` }, { say: 'Subtract.', show: String(at(sorted, n - 1) - at(sorted, 0)) }],
        })
      }
      const mo = at(modeList(list), 0)
      return numItem({
        prompt: `Find the mode of these numbers: ${list.join(', ')}.`,
        answer: mo,
        hints: ['The mode is the number that appears most often.', 'Putting the numbers in order helps.', `There are ${n} numbers. Tick each one as you count it.`],
        explanation: `${mo} appears ${list.filter((v) => v === mo).length} times, more than any other number.`,
        solution: [{ say: 'Order the numbers.', show: sorted.join(', ') }, { say: 'Most common.', show: String(mo) }],
      })
    }
    if (level === 3) {
      const n = rng.pick([4, 5, 8, 10])
      const list = Array.from({ length: n }, () => rng.int(10, 50))
      const total = sum(list)
      const mean = total / n
      return numItem({
        prompt: `The scores in a quiz were ${list.join(', ')}. What is the mean score?`,
        answer: Math.round(mean * 1000) / 1000,
        decimal: true,
        hints: ['Add all the scores.', `Then divide by ${n}.`, `${list.slice(0, 2).join(' + ')} = ${at(list, 0) + at(list, 1)}.`],
        explanation: `Total = ${total}. ${total} ÷ ${n} = ${fmt(mean)}.`,
        solution: [{ say: 'Total.', show: `${total}` }, { say: `Divide by ${n}.`, show: `${total} ÷ ${n} = ${fmt(mean)}` }],
      })
    }
    if (level === 4) {
      const n = rng.int(4, 6)
      const mean = rng.int(8, 30)
      const known = Array.from({ length: n - 1 }, () => mean + rng.int(-7, 7))
      const missing = mean * n - sum(known)
      if (missing <= 0) known[0] = at(known, 0) + missing - 5
      const miss2 = mean * n - sum(known)
      return numItem({
        prompt: `The mean of ${n} numbers is ${mean}. ${n - 1} of the numbers are ${known.join(', ')}. What is the missing number?`,
        answer: miss2,
        hints: [`If the mean is ${mean}, the total of all ${n} numbers is ${mean} × ${n}.`, 'Subtract the numbers you know from the total.', `${mean} × ${n} = ${mean * n}.`],
        explanation: `Total = ${mean * n}. Known numbers add to ${sum(known)}. ${mean * n} − ${sum(known)} = ${miss2}.`,
        solution: [{ say: 'Find the total.', show: `${mean} × ${n} = ${mean * n}` }, { say: 'Subtract the known numbers.', show: `${mean * n} − ${sum(known)} = ${miss2}` }],
        secs: 150,
      })
    }
    const n = rng.int(4, 7)
    const mean = rng.int(6, 20)
    const extra = mean + (n + 1) * rng.int(1, 3)
    const nm = (mean * n + extra) / (n + 1)
    return numItem({
      prompt: `The mean of ${n} numbers is ${mean}. Another number, ${extra}, is added. What is the new mean of the ${n + 1} numbers?`,
      answer: nm,
      decimal: !Number.isInteger(nm),
      hints: ['Find the total of the first numbers.', `${n} numbers with a mean of ${mean} add up to ${mean * n}.`, `Add ${extra} to that total.`],
      explanation: `Old total ${mean * n}, new total ${mean * n + extra}. ${mean * n + extra} ÷ ${n + 1} = ${fmt(nm)}.`,
      solution: [{ say: 'Old total.', show: `${mean} × ${n} = ${mean * n}` }, { say: 'New total.', show: `${mean * n} + ${extra} = ${mean * n + extra}` }, { say: 'New mean.', show: `${mean * n + extra} ÷ ${n + 1} = ${fmt(nm)}` }],
      secs: 150,
    })
  },
}

function modeList(list: readonly number[]): number[] {
  const counts = new Map<number, number>()
  for (const v of list) counts.set(v, (counts.get(v) ?? 0) + 1)
  const max = Math.max(...counts.values())
  return [...counts].filter(([, c]) => c === max).map(([v]) => v)
}

const graphsCharts: Generator = {
  skill: 'm6.graphs-charts',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level === 1) {
      const parts = rng.pick([4, 5, 6, 8, 10, 12])
      const k = rng.int(1, parts - 1)
      const total = parts * rng.int(2, 10)
      const how = rng.pick(['walk to school', 'come by bus', 'cycle to school'] as const)
      return numItem({
        prompt: `The pie chart shows how ${total} children travel to school. The shaded part shows the children who ${how}. How many children ${how}?`,
        answer: (total / parts) * k,
        figure: { kind: 'fraction', shape: 'circle', parts, shaded: k, alt: `A pie chart split into ${parts} equal sectors with ${k} shaded.` },
        hints: [`The circle is split into ${parts} equal parts.`, `The shaded part is ${k}/${parts} of the children.`, k === 1 ? `Share ${total} into ${parts} equal groups.` : `1/${parts} of ${total} is ${total / parts}.`],
        explanation: `${k}/${parts} of ${total} = ${(total / parts) * k} children.`,
        solution: [{ say: 'Find one part.', show: `${total} ÷ ${parts} = ${total / parts}` }, { say: `Times ${k}.`, show: `${total / parts} × ${k} = ${(total / parts) * k}` }],
      })
    }
    if (level === 2) {
      const ang = rng.pick([30, 40, 45, 60, 72, 90, 120, 135, 150, 180, 210, 240, 270])
      const unit = 360 / gcd(ang, 360)
      const total = unit * rng.int(1, Math.max(1, Math.floor(120 / unit)))
      const cat = rng.pick(['football', 'badminton', 'swimming', 'basketball'] as const)
      const ans = (ang * total) / 360
      return numItem({
        prompt: `In a pie chart about ${total} children, the sector for ${cat} has an angle of ${ang}°. How many children chose ${cat}?`,
        answer: ans,
        figure: { kind: 'angle', degrees: ang, label: `${ang}°`, alt: `A pie chart sector of ${ang}°.` },
        hints: ['The whole pie chart is 360°.', `The sector is ${ang}/360 of the children.`, `${ang}/360 simplifies to ${fs(simp({ n: ang, d: 360 }))}.`],
        explanation: `${ang}/360 = ${fs(simp({ n: ang, d: 360 }))}, and ${fs(simp({ n: ang, d: 360 }))} of ${total} is ${ans}.`,
        solution: [{ say: 'Write the angle as a fraction of 360°.', show: `${ang}/360 = ${fs(simp({ n: ang, d: 360 }))}` }, { say: `Find that fraction of ${total}.`, show: String(ans) }],
        secs: 120,
      })
    }
    if (level === 3) {
      const groups = ['1 to 10', '11 to 20', '21 to 30', '31 to 40', '41 to 50']
      const counts = groups.map(() => rng.int(1, 12))
      const fig: Fig = { kind: 'table', caption: 'Quiz scores', head: ['Score', 'Number of children'], rows: groups.map((g, i) => [g, String(at(counts, i))]), alt: `Frequency table of quiz scores: ${groups.map((g, i) => `${g}: ${at(counts, i)}`).join(', ')}.` }
      if (rng.chance(0.5)) {
        const cut = rng.int(1, 2)
        const ans = sum(counts.slice(cut + 1))
        const threshold = (cut + 1) * 10
        return numItem({
          prompt: `The frequency table shows quiz scores. How many children scored more than ${threshold}?`,
          answer: ans,
          figure: fig,
          hints: [`Which groups have scores more than ${threshold}?`, `Add the numbers in the groups from ${threshold + 1} upwards.`, `The group ${at(groups, cut + 1)} has ${at(counts, cut + 1)} children.`],
          explanation: `${counts.slice(cut + 1).join(' + ')} = ${ans} children.`,
          solution: [{ say: 'Pick the groups above the score.', show: groups.slice(cut + 1).join(', ') }, { say: 'Add their counts.', show: `${counts.slice(cut + 1).join(' + ')} = ${ans}` }],
        })
      }
      let cs = counts
      while (cs.filter((v) => v === Math.max(...cs)).length !== 1) cs = groups.map(() => rng.int(1, 12))
      const best = cs.indexOf(Math.max(...cs))
      const fig2: Fig = { ...fig, rows: groups.map((g, i) => [g, String(at(cs, i))]), alt: `Frequency table of quiz scores: ${groups.map((g, i) => `${g}: ${at(cs, i)}`).join(', ')}.` }
      const m = mcqFrom(
        rng,
        at(groups, best),
        groups.map((g, i) => ({ g, i })).filter((o) => o.i !== best).map((o) => ({ value: o.g, why: `${o.g} has ${at(cs, o.i)} children, fewer than ${at(cs, best)}.` })),
        4,
        (v) => v,
      )
      return mcqItem({
        prompt: 'The frequency table shows quiz scores. Which group is the modal group?',
        ...m,
        figure: fig2,
        hints: ['The modal group is the group with the most children.', 'Compare the numbers in the second column.', `The group ${at(groups, best === 0 ? 1 : 0)} has ${at(cs, best === 0 ? 1 : 0)} children.`],
        explanation: `${at(groups, best)} has the most children (${at(cs, best)}), so it is the modal group.`,
        solution: [{ say: 'Read the frequencies.', show: cs.join(', ') }, { say: 'Biggest frequency.', show: at(groups, best) }],
      })
    }
    if (level === 4) {
      const hours = [1, 2, 3, 4, 5, 6, 7]
      const temps: number[] = []
      let t = rng.int(1, 4)
      for (let i = 0; i < hours.length; i++) {
        temps.push(t)
        t = Math.min(12, Math.max(0, t + rng.int(-1, 3)))
      }
      const rises = temps.slice(1).map((v, i) => v - at(temps, i))
      const maxRise = Math.max(...rises)
      const idxs = rises.map((r, i) => (r === maxRise ? i : -1)).filter((i) => i >= 0)
      const fig: Fig = { kind: 'coordinates', size: 12, points: hours.map((h, i) => ({ x: h, y: at(temps, i) })), alt: `A line graph of temperature. The x-axis shows hours after 06:00 and the y-axis shows degrees Celsius. ${hours.map((h, i) => `Hour ${h}: ${at(temps, i)} °C`).join(', ')}.` }
      if (idxs.length === 1 && maxRise > 0) {
        const i = at(idxs, 0)
        const label = (j: number) => `hour ${j + 1} and hour ${j + 2}`
        const m = mcqFrom(
          rng,
          label(i),
          rises.map((r, j) => ({ r, j })).filter((o) => o.j !== i).map((o) => ({ value: label(o.j), why: `The temperature changed by ${o.r} degrees then, which is less than ${maxRise}.` })),
          4,
          (v) => v,
        )
        return mcqItem({
          prompt: 'The line graph shows the temperature each hour. Between which two hours did the temperature rise the most?',
          ...m,
          figure: fig,
          hints: ['Look for the steepest part going up.', 'Work out the change between each pair of hours.', `From hour 1 to hour 2 it changed by ${at(rises, 0)} degrees.`],
          explanation: `The biggest rise is ${maxRise} degrees, between ${label(i)}.`,
          solution: [{ say: 'Find each change.', show: rises.join(', ') }, { say: 'The biggest rise.', show: label(i) }],
        })
      }
      const [a, b] = rng.sample(hours, 2).sort((x, y) => x - y)
      return numItem({
        prompt: `The line graph shows the temperature each hour. What is the difference between the temperature at hour ${a} and at hour ${b}?`,
        answer: Math.abs(at(temps, b! - 1) - at(temps, a! - 1)),
        unit: 'degrees',
        figure: fig,
        hints: ['Read both temperatures from the y-axis.', `Find hour ${a} and hour ${b} on the x-axis.`, `At hour ${a} it was ${at(temps, a! - 1)} °C.`],
        explanation: `${at(temps, a! - 1)} °C and ${at(temps, b! - 1)} °C differ by ${Math.abs(at(temps, b! - 1) - at(temps, a! - 1))} degrees.`,
        solution: [{ say: 'Read both values.', show: `${at(temps, a! - 1)} and ${at(temps, b! - 1)}` }, { say: 'Find the difference.', show: String(Math.abs(at(temps, b! - 1) - at(temps, a! - 1))) }],
      })
    }
    const total = rng.pick([20, 25, 50])
    const cats = ['Mango', 'Rambutan', 'Durian', 'Banana']
    let vals: number[] = []
    do {
      vals = [0, 1, 2].map(() => rng.int(2, Math.floor(total / 3)))
      vals.push(total - sum(vals))
    } while (at(vals, 3) < 2)
    const i = vals.findIndex((v) => v >= 2) >= 0 ? rng.pick(range(0, 3).filter((j) => at(vals, j) >= 2)) : 0
    const p = (at(vals, i) * 100) / total
    return numItem({
      prompt: `The bar chart shows the favourite fruit of ${total} children. What percentage of the children chose ${at(cats, i)}?`,
      answer: p,
      unit: '%',
      figure: { kind: 'bars', title: 'Favourite fruit', categories: cats, values: vals, step: total === 50 ? 5 : 1, yLabel: 'Children', alt: `Bar chart of favourite fruit: ${cats.map((c, j) => `${c} ${at(vals, j)}`).join(', ')}.` },
      hints: [`Read the bar for ${at(cats, i)}.`, `Write it as a fraction of ${total}, then change it to a percentage.`, `${total} × ${100 / total} = 100.`],
      explanation: `${at(vals, i)}/${total} = ${p}/100 = ${p}%.`,
      solution: [{ say: 'Read the bar.', show: `${at(vals, i)} out of ${total}` }, { say: 'Change to a percentage.', show: `${p}%` }],
      secs: 120,
    })
  },
}

const probability: Generator = {
  skill: 'm6.probability',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level === 1) {
      const ev = rng.pick([
        { e: 'an even number', n: 3 },
        { e: 'a number greater than 4', n: 2 },
        { e: 'a 3', n: 1 },
        { e: 'a prime number', n: 3 },
        { e: 'a number less than 5', n: 4 },
        { e: 'a multiple of 3', n: 2 },
      ])
      return textItem({
        prompt: `A fair dice is numbered 1 to 6. What is the probability of rolling ${ev.e}? Write it as a fraction.`,
        answers: [fracAnswers({ n: ev.n, d: 6 }, { decimal: true })],
        hints: ['Probability = number of ways it can happen ÷ number of possible outcomes.', 'There are 6 possible outcomes.', `List the numbers that give ${ev.e}.`],
        explanation: `${ev.n} out of 6 outcomes give ${ev.e}, so the probability is ${ev.n}/6${simp({ n: ev.n, d: 6 }).d !== 6 ? ` = ${fs(simp({ n: ev.n, d: 6 }))}` : ''}.`,
        solution: [{ say: 'Count the good outcomes.', show: String(ev.n) }, { say: 'Divide by all the outcomes.', show: `${ev.n}/6` }],
      })
    }
    if (level === 2) {
      const form = rng.pick(['fraction', 'decimal', 'percent'] as const)
      const pu = rng.pick([1, 2, 3, 4, 5, 6, 7, 8, 9]) * 10 + rng.pick([0, 0, 5])
      if (form === 'fraction') {
        const d = rng.pick([5, 8, 10, 12, 20])
        const n = rng.int(1, d - 1)
        return textItem({
          prompt: `The probability that it rains tomorrow is ${n}/${d}. What is the probability that it does not rain? Write it as a fraction.`,
          answers: [fracAnswers({ n: d - n, d }, { decimal: true })],
          hints: ['It either rains or it does not, so the two probabilities add up to 1.', `1 = ${d}/${d}.`, `Work out ${d}/${d} − ${n}/${d}.`],
          explanation: `1 − ${n}/${d} = ${d - n}/${d}.`,
          solution: [{ say: 'Probabilities of an event and its opposite add to 1.' }, { say: 'Subtract.', show: `${d}/${d} − ${n}/${d} = ${d - n}/${d}` }],
        })
      }
      if (form === 'decimal') {
        return numItem({
          prompt: `The probability that a bus is late is ${fmt(dec(pu, 2))}. What is the probability that it is not late?`,
          answer: dec(100 - pu, 2),
          decimal: true,
          hints: ['Late and not late add up to 1.', `Work out 1 − ${fmt(dec(pu, 2))}.`, `1 = 1.00.`],
          explanation: `1 − ${fmt(dec(pu, 2))} = ${fmt(dec(100 - pu, 2))}.`,
          solution: [{ say: 'They add up to 1.' }, { say: 'Subtract.', show: `1 − ${fmt(dec(pu, 2))} = ${fmt(dec(100 - pu, 2))}` }],
        })
      }
      return numItem({
        prompt: `There is a ${pu}% chance that a seed will grow. What is the percentage chance that it will not grow?`,
        answer: 100 - pu,
        unit: '%',
        hints: ['Grow and not grow add up to 100%.', `Work out 100 − ${pu}.`, `Count on from ${pu} to 100.`],
        explanation: `100% − ${pu}% = ${100 - pu}%.`,
        solution: [{ say: 'They add up to 100%.' }, { say: 'Subtract.', show: `100 − ${pu} = ${100 - pu}` }],
      })
    }
    if (level === 3) {
      const kind = rng.pick(['coins', 'coin-dice', 'spinners'] as const)
      if (kind === 'coins') {
        const ask = rng.pick([{ e: 'two heads', n: 1 }, { e: 'one head and one tail', n: 2 }, { e: 'at least one head', n: 3 }])
        return textItem({
          prompt: `Two fair coins are tossed. What is the probability of getting ${ask.e}? Write it as a fraction.`,
          answers: [fracAnswers({ n: ask.n, d: 4 }, { decimal: true })],
          hints: ['List all the outcomes: HH, HT, TH, TT.', 'There are 4 equally likely outcomes.', `Count the outcomes that give ${ask.e}.`],
          explanation: `${ask.n} of the 4 outcomes give ${ask.e}, so the probability is ${ask.n}/4${ask.n === 2 ? ' = 1/2' : ''}.`,
          solution: [{ say: 'List the outcomes.', show: 'HH, HT, TH, TT' }, { say: 'Count the ones that fit.', show: `${ask.n}/4` }],
        })
      }
      if (kind === 'coin-dice') {
        const n = rng.int(1, 6)
        return textItem({
          prompt: `A coin is tossed and a 1 to 6 dice is rolled. What is the probability of getting a head and a ${n}? Write it as a fraction.`,
          answers: [fracAnswers({ n: 1, d: 12 })],
          hints: ['Count all the outcomes first.', 'Each of the 2 coin results can go with each of the 6 dice results.', '2 × 6 = 12 outcomes.'],
          explanation: `There are 12 equally likely outcomes and only 1 is a head with a ${n}. The probability is 1/12.`,
          solution: [{ say: 'Count the outcomes.', show: '2 × 6 = 12' }, { say: 'Only one fits.', show: '1/12' }],
        })
      }
      const a = rng.pick([3, 4, 5])
      return textItem({
        prompt: `Two spinners are each numbered 1 to ${a}. Both are spun. What is the probability that both show the same number? Write it as a fraction.`,
        answers: [fracAnswers({ n: a, d: a * a })],
        hints: [`There are ${a} × ${a} outcomes.`, 'Count the pairs where both numbers match.', 'The matching pairs are 1 and 1, 2 and 2, and so on.'],
        explanation: `There are ${a * a} outcomes and ${a} matching pairs, so the probability is ${a}/${a * a} = 1/${a}.`,
        solution: [{ say: 'All outcomes.', show: `${a} × ${a} = ${a * a}` }, { say: 'Matching pairs.', show: `${a}/${a * a} = 1/${a}` }],
      })
    }
    if (level === 4) {
      if (rng.chance(0.5)) {
        const spins = rng.pick([20, 40, 50, 60, 80, 100])
        let red = rng.int(Math.floor(spins / 10), Math.floor(spins * 0.6))
        if (gcd(red, spins) === 1) red += 1
        if (gcd(red, spins) === 1) red += 1
        return textItem({
          prompt: `A spinner landed on red ${red} times in ${spins} spins. What fraction of the spins landed on red? Write it in its simplest form.`,
          answers: [[fs(simp({ n: red, d: spins }))]],
          hints: ['Write the number of reds over the number of spins.', `That is ${red}/${spins}.`, `Divide the top and the bottom by a common factor of ${red} and ${spins}.`],
          explanation: `${red}/${spins} = ${fs(simp({ n: red, d: spins }))}.`,
          solution: [{ say: 'Write the fraction.', show: `${red}/${spins}` }, { say: 'Simplify.', show: fs(simp({ n: red, d: spins })) }],
        })
      }
      const parts = rng.pick([4, 5, 8, 10])
      const k = rng.int(1, parts - 1)
      const spins = parts * rng.int(5, 20)
      return numItem({
        prompt: `A fair spinner has ${parts} equal sections and ${k} of them are blue. It is spun ${spins} times. About how many times would you expect it to land on blue?`,
        answer: (spins / parts) * k,
        figure: { kind: 'fraction', shape: 'circle', parts, shaded: k, alt: `A spinner with ${parts} equal sections, ${k} shaded blue.` },
        hints: [`The probability of blue is ${k}/${parts}.`, `Find ${k}/${parts} of ${spins}.`, `1/${parts} of ${spins} is ${spins / parts}.`],
        explanation: `${k}/${parts} of ${spins} = ${(spins / parts) * k}.`,
        solution: [{ say: 'Probability of blue.', show: `${k}/${parts}` }, { say: `Times ${spins}.`, show: `${spins} ÷ ${parts} × ${k} = ${(spins / parts) * k}` }],
        tip: 'The expected number is a good estimate. Real results can be a little different.',
      })
    }
    const bags: { r: number; b: number }[] = []
    const seen = new Set<number>()
    while (bags.length < 4) {
      const r = rng.int(1, 9)
      const b = rng.int(1, 9)
      const v = r / (r + b)
      if ([...seen].some((x) => Math.abs(x - v) < 1e-9)) continue
      seen.add(v)
      bags.push({ r, b })
    }
    const best = bags.reduce((m, x) => (x.r / (x.r + x.b) > m.r / (m.r + m.b) ? x : m))
    const label = (x: { r: number; b: number }) => `${x.r} red and ${x.b} blue`
    const m = mcqFrom(
      rng,
      label(best),
      bags.filter((x) => x !== best).map((x) => ({ value: label(x), why: `The chance of red is ${x.r}/${x.r + x.b}, which is less than ${best.r}/${best.r + best.b}.` })),
      4,
      (v) => v,
    )
    return mcqItem({
      prompt: 'Which bag gives the best chance of picking a red counter without looking?',
      ...m,
      hints: [
        'More red counters does not always mean a better chance.',
        'Work out red ÷ total for each bag.',
        (() => {
          const o = bags.find((x) => x !== best) ?? best
          return `For ${label(o)}, the chance is ${o.r}/${o.r + o.b}.`
        })(),
      ],
      explanation: `The bag with ${label(best)} has a chance of ${best.r}/${best.r + best.b}, which is the highest.`,
      solution: [{ say: 'Write each chance as a fraction.', show: bags.map((x) => `${x.r}/${x.r + x.b}`).join(', ') }, { say: 'Compare them.', show: label(best) }],
      secs: 150,
    })
  },
}

/** Generator Math Grade 6. */
export const generators: Generator[] = [
  placeValue,
  rounding,
  powersOfTen,
  sequences,
  functionMachines,
  negativeNumbers,
  orderOfOperations,
  factorsMultiplesPrimes,
  squaresCubes,
  addSubtract,
  multiplyWritten,
  divideWritten,
  compareFractions,
  addSubtractFractions,
  multiplyDivideFractions,
  decimalsMultiplyDivide,
  fdpEquivalence,
  percentages,
  ratioProportion,
  timeTimetables,
  areaPerimeter,
  areaTriangles,
  volumeCuboids,
  angles,
  shapesProperties,
  coordinates,
  transformations,
  averages,
  graphsCharts,
  probability,
].map((g) => checkpoint(g))
