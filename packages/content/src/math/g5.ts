import type { Rng } from '@kira/core/rng'
import type { FigureSpecInput } from '@kira/figures/spec'
import { fmt, gcd, mcqFrom, NAMES, numberWords, rupiah } from './helpers'
import type { GeneratedItem, Generator } from './types'

/**
 * Generator Math Grade 5 (Cambridge Primary Stage 5).
 * Bagian pertama file ini berisi helper bersama yang juga dipakai g6.ts.
 * Semua angka desimal dihitung dalam satuan bulat (misalnya perseratus) lalu
 * dibagi pangkat 10, supaya tidak ada sisa floating point.
 */

/* ------------------------------------------------------------------ */
/* Helper bersama                                                      */
/* ------------------------------------------------------------------ */

export type Fig = FigureSpecInput
export type Hints = [string, string, string]
export type Step = { say: string; show?: string; figure?: Fig }
export type McqOption = { text?: string; figure?: Fig; why?: string }

export const WP = 'word-problem'

type Common = {
  prompt: string
  hints: Hints
  explanation: string
  figure?: Fig | undefined
  solution?: Step[] | undefined
  tags?: string[] | undefined
  tip?: string | undefined
  secs?: number | undefined
}

function common(c: Common) {
  return {
    prompt: c.prompt,
    hints: c.hints,
    explanation: c.explanation,
    ...(c.figure ? { figure: c.figure } : {}),
    ...(c.solution ? { solution: c.solution } : {}),
    ...(c.tags && c.tags.length > 0 ? { tags: c.tags } : {}),
    ...(c.tip ? { tip: c.tip } : {}),
    ...(c.secs ? { expectedSeconds: c.secs } : {}),
  }
}

export function numItem(
  c: Common & { answer: number; unit?: string; decimal?: boolean; negative?: boolean; tolerance?: number },
): GeneratedItem {
  return {
    type: 'numeric',
    ...common(c),
    answer: c.answer,
    ...(c.unit ? { unit: c.unit } : {}),
    ...(c.tolerance ? { tolerance: c.tolerance } : {}),
    ...(c.decimal ? { allowDecimal: true } : {}),
    ...(c.negative ? { allowNegative: true } : {}),
  }
}

export function mcqItem(c: Common & { options: McqOption[]; answer: number }): GeneratedItem {
  return { type: 'mcq', ...common(c), options: c.options, answer: c.answer }
}

export function multiItem(c: Common & { options: McqOption[]; answers: number[] }): GeneratedItem {
  return { type: 'multi', ...common(c), options: c.options, answers: c.answers }
}

export function textItem(c: Common & { answers: string[][] }): GeneratedItem {
  return { type: 'text', ...common(c), blanks: c.answers.map((a) => ({ answers: uniq(a).slice(0, 8) })) }
}

export function orderItem(c: Common & { items: string[] }): GeneratedItem {
  return { type: 'order', ...common(c), items: c.items }
}

export function lineItem(c: Common & { min: number; max: number; step: number; answer: number }): GeneratedItem {
  return { type: 'numberline', ...common(c), min: c.min, max: c.max, step: c.step, answer: c.answer }
}

export function fractionItem(
  c: Common & { shape: 'bar' | 'circle' | 'square'; parts: number; num: number; den: number },
): GeneratedItem {
  return { type: 'fraction', ...common(c), shape: c.shape, parts: c.parts, answer: { num: c.num, den: c.den } }
}

export function sortItem(c: Common & { groups: string[]; items: { text: string; group: number }[] }): GeneratedItem {
  return { type: 'sort', ...common(c), groups: c.groups, items: c.items }
}

export function matchItem(c: Common & { pairs: [string, string][] }): GeneratedItem {
  return { type: 'match', ...common(c), pairs: c.pairs }
}

export function clockItem(c: Common & { h: number; m: number; step: 1 | 5 | 15 | 30 }): GeneratedItem {
  return { type: 'clock', ...common(c), answer: { h: c.h, m: c.m }, stepMinutes: c.step }
}

/** Tambah tag ke soal yang sudah jadi (dipakai g6 untuk tag checkpoint). */
export function withTags(item: GeneratedItem, extra: string[]): GeneratedItem {
  const tags = uniq([...(item.tags ?? []), ...extra]).slice(0, 10)
  return { ...item, tags }
}

/** "a" atau "an" sebelum angka yang dibaca: an 8, an 11, an 18, an 80. */
export function aword(w: string): string {
  return /^[aeiou]/i.test(w) ? 'an' : 'a'
}

export function anum(n: number): string {
  return /^8/.test(String(n)) || n === 11 || n === 18 ? 'an' : 'a'
}

/** Huruf pertama kapital, untuk kalimat yang dimulai dengan kata bilangan. */
export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function uniq<T>(list: readonly T[]): T[] {
  return [...new Set(list)]
}

export function at<T>(list: readonly T[], i: number): T {
  const v = list[i]
  if (v === undefined) throw new Error(`Indeks ${i} di luar daftar`)
  return v
}

export function sum(list: readonly number[]): number {
  return list.reduce((a, b) => a + b, 0)
}

/** Pilihan ganda dengan opsi berupa figur. */
export function mcqFigs(
  rng: Rng,
  correct: Fig,
  wrong: readonly { figure: Fig; why: string }[],
): { options: McqOption[]; answer: number } {
  const all = rng.shuffle([{ figure: correct, why: '', ok: true }, ...wrong.map((w) => ({ ...w, ok: false }))])
  return {
    options: all.map((o) => (o.ok ? { figure: o.figure } : { figure: o.figure, why: o.why })),
    answer: all.findIndex((o) => o.ok),
  }
}

/** Pilihan ganda teks dengan pengecoh yang diacak dulu, lalu dipotong ke `count` opsi. */
export function mcqText(
  rng: Rng,
  correct: string,
  distractors: readonly { value: string; why: string }[],
  count = 4,
): { options: McqOption[]; answer: number } {
  return mcqFrom(rng, correct, rng.shuffle(distractors), count)
}

export function pickNames(rng: Rng, n: number): string[] {
  return rng.sample(NAMES, n)
}

/** Desimal persis dari bilangan bulat satuan 10^-dp: dec(345, 2) = 3.45. */
export function dec(units: number, dp: number): number {
  return units / 10 ** dp
}

/** Satuan bulat dari desimal: units(3.45, 2) = 345. */
export function units(n: number, dp: number): number {
  return Math.round(n * 10 ** dp)
}

/** Format dengan jumlah tempat desimal tetap: fx(3.5, 2) = "3.50". */
export function fx(n: number, dp: number): string {
  return n.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp })
}

export function roundTo(n: number, p: number): number {
  return Math.round(n / p) * p
}

export function plur(n: number, one: string, many: string): string {
  return `${fmt(n)} ${n === 1 ? one : many}`
}

export const PLACE = ['ones', 'tens', 'hundreds', 'thousands', 'ten thousands', 'hundred thousands', 'millions', 'ten millions'] as const
export const PLACE_ONE = ['one', 'ten', 'hundred', 'thousand', 'ten thousand', 'hundred thousand', 'million', 'ten million'] as const
export const PLACE_HEAD = ['O', 'T', 'H', 'Th', 'TTh', 'HTh', 'M', 'TM'] as const
export const DPLACE = ['tenths', 'hundredths', 'thousandths'] as const
export const DPLACE_ONE = ['tenth', 'hundredth', 'thousandth'] as const

/** Nama tempat untuk eksponen: 2 = hundreds, -1 = tenths. */
export function placeName(exp: number): string {
  return exp >= 0 ? at(PLACE, exp) : at(DPLACE, -exp - 1)
}

export function placePhrase(d: number, exp: number): string {
  if (exp >= 0) return `${d} ${d === 1 ? at(PLACE_ONE, exp) : at(PLACE, exp)}`
  return `${d} ${d === 1 ? at(DPLACE_ONE, -exp - 1) : at(DPLACE, -exp - 1)}`
}

/** Digit paling kiri dulu. */
export function digitsOf(n: number): number[] {
  return String(n).split('').map(Number)
}

export function fromDigits(ds: readonly number[]): number {
  return ds.reduce((a, d) => a * 10 + d, 0)
}

/** Bilangan len digit dengan digit berbeda semua, digit pertama bukan 0. */
export function distinctDigits(rng: Rng, len: number): number[] {
  const first = rng.int(1, 9)
  const rest = rng.sample([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => d !== first), len - 1)
  return [first, ...rest]
}

/** Tabel nilai tempat. `dp` digit terakhir adalah desimal. */
export function pvChart(ds: readonly number[], dp = 0): Fig {
  const whole = ds.length - dp
  const head = [...PLACE_HEAD.slice(0, whole).reverse(), ...DPLACE.slice(0, dp)]
  const numberText = dp > 0 ? `${fmt(fromDigits(ds.slice(0, whole)))}.${ds.slice(whole).join('')}` : fmt(fromDigits(ds))
  const parts = ds.map((d, i) => `${d} in ${placeName(whole - 1 - i)}`)
  return { kind: 'table', head: [...head], rows: [ds.map(String)], alt: `Place value chart for ${numberText}: ${parts.join(', ')}.` }
}

/** Tabel nilai tempat untuk desimal dari satuan bulat: decChart(45, 2) untuk 0.45. */
export function decChart(u: number, dp: number): Fig {
  return pvChart(String(u).padStart(dp + 1, '0').split('').map(Number), dp)
}

/** Tempat digit pertama yang berbeda (dibaca dari kiri) antara a dan b. */
export function firstDiff(a: number, b: number, dp: number): { place: string; da: number; db: number } {
  const ua = units(a, dp)
  const ub = units(b, dp)
  const len = Math.max(String(ua).length, String(ub).length, dp + 1)
  const sa = String(ua).padStart(len, '0')
  const sb = String(ub).padStart(len, '0')
  for (let i = 0; i < len; i++) {
    if (sa[i] !== sb[i]) return { place: placeName(len - dp - 1 - i), da: Number(sa[i]), db: Number(sb[i]) }
  }
  return { place: 'ones', da: 0, db: 0 }
}

/** Alasan ramah mengapa d bukan jawaban saat jawaban terbesar atau terkecil adalah c. */
export function compareWhy(d: number, c: number, dp: number, render: (n: number) => string = fmt): string {
  const f = firstDiff(d, c, dp)
  return `${render(d)} is ${d < c ? 'less' : 'greater'} than ${render(c)}. Compare the ${f.place}: ${f.da} and ${f.db}.`
}

export function bigWords(n: number): string {
  if (n < 1_000_000) return numberWords(n)
  const m = Math.floor(n / 1_000_000)
  const rest = n % 1_000_000
  const head = `${numberWords(m)} million`
  if (rest === 0) return head
  return rest < 100 ? `${head} and ${numberWords(rest)}` : `${head}, ${numberWords(rest)}`
}

export function permutations<T>(xs: readonly T[]): T[][] {
  if (xs.length <= 1) return [xs.slice()]
  const out: T[][] = []
  xs.forEach((x, i) => {
    for (const p of permutations([...xs.slice(0, i), ...xs.slice(i + 1)])) out.push([x, ...p])
  })
  return out
}

export function isPrime(n: number): boolean {
  if (n < 2) return false
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false
  return true
}

export function factorsOf(n: number): number[] {
  const out: number[] = []
  for (let i = 1; i <= n; i++) if (n % i === 0) out.push(i)
  return out
}

export function lcm(a: number, b: number): number {
  return (a / gcd(a, b)) * b
}

export type Frac = { n: number; d: number }

export function simp(f: Frac): Frac {
  const g = gcd(f.n, f.d) || 1
  return { n: f.n / g, d: f.d / g }
}

export function fs(f: Frac): string {
  return `${f.n}/${f.d}`
}

/** "2 1/4", "3/4", atau "2". */
export function mixed(f: Frac): string {
  const w = Math.floor(f.n / f.d)
  const r = f.n % f.d
  if (r === 0) return String(w)
  if (w === 0) return `${r}/${f.d}`
  return `${w} ${r}/${f.d}`
}

/** Pecahan desimal berakhir (paling banyak 3 tempat) atau null. */
export function fracDecimal(f: Frac): string | null {
  for (const dp of [0, 1, 2, 3]) {
    const scaled = (f.n * 10 ** dp) / f.d
    if (Number.isInteger(scaled)) return fmt(dec(scaled, dp))
  }
  return null
}

/** Bentuk jawaban ketik untuk pecahan. */
export function fracAnswers(f: Frac, opts: { simplestOnly?: boolean; decimal?: boolean } = {}): string[] {
  const s = simp(f)
  const out: string[] = []
  if (s.d === 1) out.push(String(s.n))
  else {
    out.push(mixed(s))
    out.push(fs(s))
  }
  if (!opts.simplestOnly && f.d !== s.d) {
    out.push(fs(f))
    if (f.n > f.d) out.push(mixed(f))
  }
  if (opts.decimal) {
    const d = fracDecimal(s)
    if (d) out.push(d)
  }
  return uniq(out)
}

/** "15:05" */
export function hhmm(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Bentuk jawaban ketik untuk waktu 24 jam. */
export function timeAnswers(h: number, m: number): string[] {
  const hh = String(h).padStart(2, '0')
  const mm = String(m).padStart(2, '0')
  return uniq([`${hh}:${mm}`, `${hh}.${mm}`, `${hh}${mm}`, `${h}:${mm}`, `${h}.${mm}`])
}

/** "3:45 pm" */
export function ampm(h: number, m: number): string {
  const suffix = h < 12 ? 'am' : 'pm'
  const hh = ((h + 11) % 12) + 1
  return `${hh}:${String(m).padStart(2, '0')} ${suffix}`
}

/** Bentuk jawaban ketik untuk koordinat. */
export function coordAnswers(x: number, y: number): string[] {
  return [`(${x}, ${y})`, `(${x},${y})`, `${x}, ${y}`, `${x},${y}`]
}

/* ------------------------------------------------------------------ */
/* Np: nilai tempat                                                    */
/* ------------------------------------------------------------------ */

const placeValueMillions: Generator = {
  skill: 'm5.place-value-millions',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level <= 2) {
      const len = level === 1 ? 5 : 6
      const ds = distinctDigits(rng, len)
      const n = fromDigits(ds)
      const chart = pvChart(ds)
      const style = rng.int(0, level === 1 ? 1 : 3)
      if (style === 0 || style === 3) {
        const i = rng.pick(ds.map((_, j) => j).filter((j) => ds[j] !== 0 && j < len - 1))
        const d = at(ds, i)
        const p = len - 1 - i
        const value = d * 10 ** p
        return numItem({
          prompt: `What is the value of the digit ${d} in ${fmt(n)}?`,
          answer: value,
          figure: level === 1 ? chart : undefined,
          hints: [
            `Find the digit ${d} in ${fmt(n)}.`,
            'Each column is worth 10 times the column on its right.',
            `The digit ${d} is in the ${at(PLACE, p)} column.`,
          ],
          explanation: `The digit ${d} is in the ${at(PLACE, p)} column, so it is worth ${d} × ${fmt(10 ** p)} = ${fmt(value)}.`,
          solution: [
            { say: `Write ${fmt(n)} in a place value chart.`, figure: chart },
            { say: `The ${d} is in the ${at(PLACE, p)} column.`, show: `${d} × ${fmt(10 ** p)} = ${fmt(value)}` },
          ],
        })
      }
      if (style === 1) {
        const i = rng.int(0, len - 2)
        const p = len - 1 - i
        const d = at(ds, i)
        const others = ds.map((x, j) => ({ x, j })).filter((o) => o.j !== i)
        const m = mcqFrom(
          rng,
          d,
          rng.shuffle(others).map((o) => ({ value: o.x, why: `${o.x} is in the ${at(PLACE, len - 1 - o.j)} column.` })),
        )
        return mcqItem({
          prompt: `Which digit is in the ${at(PLACE, p)} column of ${fmt(n)}?`,
          ...m,
          figure: level === 1 ? chart : undefined,
          hints: [
            `Say ${fmt(n)} aloud and listen for the ${at(PLACE, p)}.`,
            'Name the columns from the right: ones, tens, hundreds, thousands, ten thousands.',
            `Start on the right. The ones digit of ${fmt(n)} is ${at(ds, len - 1)}.`,
          ],
          explanation: `${fmt(n)} has ${placePhrase(d, p)}, so the ${at(PLACE, p)} digit is ${d}.`,
          solution: [
            { say: 'Put the number in a place value chart.', figure: chart },
            { say: `Read the ${at(PLACE, p)} column.`, show: `${cap(at(PLACE, p))}: ${d}` },
          ],
        })
      }
      if (rng.chance(0.5)) {
        const parts = ds.map((d, i) => d * 10 ** (len - 1 - i)).filter((v) => v > 0)
        const miss = rng.int(0, parts.length - 1)
        const missing = at(parts, miss)
        return numItem({
          prompt: `Find the missing number. ${fmt(n)} = ${parts.map((v, j) => (j === miss ? '___' : fmt(v))).join(' + ')}`,
          answer: missing,
          hints: [
            'Each part is the value of one digit.',
            `Look for the digit of ${fmt(n)} that has no part yet.`,
            `The parts you can see add up to ${fmt(n - missing)}.`,
          ],
          explanation: `${fmt(n)} = ${parts.map(fmt).join(' + ')}, so the missing part is ${fmt(missing)}.`,
          solution: [
            { say: 'Split the number into the value of each digit.', figure: chart },
            { say: 'Add the parts back together to check.', show: `${parts.map(fmt).join(' + ')} = ${fmt(n)}` },
          ],
        })
      }
      const th = rng.int(101, 999)
      const rest = rng.pick([rng.int(1, 99), rng.int(100, 999), rng.int(1, 9) * 100])
      const w = th * 1000 + rest
      const wd = digitsOf(w)
      return numItem({
        prompt: `Write ${numberWords(w)} in figures.`,
        answer: w,
        hints: [
          'Split the words where you see thousand.',
          'Write the thousands part, then the hundreds, tens and ones. Use 0 for an empty column.',
          `${cap(numberWords(th))} thousand is ${fmt(th * 1000)}.`,
        ],
        explanation: `${cap(numberWords(th))} thousand is ${fmt(th * 1000)} and ${numberWords(rest)} is ${fmt(rest)}. Together they make ${fmt(w)}.`,
        solution: [
          { say: 'Put each part in a place value chart.', figure: pvChart(wd) },
          { say: 'Add the two parts.', show: `${fmt(th * 1000)} + ${fmt(rest)} = ${fmt(w)}` },
        ],
      })
    }

    if (level === 3) {
      const style = rng.int(0, 2)
      if (style === 0) {
        const delta = rng.pick([1000, 10000, 100000])
        const p = Math.round(Math.log10(delta))
        const more = rng.chance(0.5)
        const ds = [rng.int(2, 8), rng.int(0, 9), rng.int(0, 9), rng.int(0, 9), rng.int(0, 9), rng.int(0, 9)]
        const bridge = p < 5 && rng.chance(0.6)
        if (bridge) ds[5 - p] = more ? 9 : 0
        const n = fromDigits(ds)
        const ans = more ? n + delta : n - delta
        const d = at(ds, 5 - p)
        return numItem({
          prompt: `What number is ${fmt(delta)} ${more ? 'more' : 'less'} than ${fmt(n)}?`,
          answer: ans,
          hints: [
            `Which column changes when you ${more ? 'add' : 'take away'} ${fmt(delta)}?`,
            `${more ? 'Adding' : 'Taking away'} ${fmt(delta)} changes the ${at(PLACE, p)} digit by 1.${bridge ? ' You will need to regroup.' : ''}`,
            `The ${at(PLACE, p)} digit of ${fmt(n)} is ${d}.`,
          ],
          explanation: `${fmt(n)} ${more ? '+' : '−'} ${fmt(delta)} = ${fmt(ans)}.${bridge ? ` The ${at(PLACE, p)} digit is ${d}, so the next column changes too.` : ''}`,
          solution: [
            { say: `Find the ${at(PLACE, p)} digit of ${fmt(n)}. It is ${d}.` },
            { say: `${more ? 'Add' : 'Take away'} 1 in that column${bridge ? ' and regroup' : ''}.`, show: `${fmt(n)} ${more ? '+' : '−'} ${fmt(delta)} = ${fmt(ans)}` },
          ],
        })
      }
      const head = rng.int(1, 9) * 100000 + rng.int(0, 9) * 10000
      const set = new Set<number>()
      while (set.size < 4) set.add(head + rng.int(0, 9) * 1000 + rng.int(0, 9) * 100 + rng.int(0, 99))
      const vals = [...set]
      const asc = [...vals].sort((a, b) => a - b)
      if (style === 1) {
        return orderItem({
          prompt: 'Put these numbers in order, starting with the smallest.',
          items: asc.map(fmt),
          hints: [
            'Compare the digits from the left.',
            'Every number has the same first two digits, so compare the thousands digits next.',
            `The smallest thousands digit here is ${Math.min(...vals.map((v) => Math.floor(v / 1000) % 10))}.`,
          ],
          explanation: `In order: ${asc.map(fmt).join(', ')}. Compare digits from the left until they are different.`,
          solution: [
            { say: 'Line the numbers up in place value columns.' },
            { say: 'Compare thousands, then hundreds, then tens.', show: asc.map(fmt).join(' < ') },
          ],
        })
      }
      const greatest = rng.chance(0.5)
      const c = greatest ? at(asc, 3) : at(asc, 0)
      const m = mcqFrom(
        rng,
        c,
        vals.filter((v) => v !== c).map((v) => ({ value: v, why: compareWhy(v, c, 0) })),
      )
      return mcqItem({
        prompt: `Which number is the ${greatest ? 'greatest' : 'smallest'}?`,
        ...m,
        hints: [
          'Compare the digits from the left.',
          'If two digits are the same, move one column to the right.',
          'All the numbers have the same hundred thousands and ten thousands digits. Look at the thousands.',
        ],
        explanation: `${fmt(c)} is the ${greatest ? 'greatest' : 'smallest'}. In order: ${asc.map(fmt).join(', ')}.`,
        solution: [
          { say: 'Line up the numbers by place value and compare from the left.' },
          { say: 'The first column that differs decides.', show: asc.map(fmt).join(' < ') },
        ],
      })
    }

    if (level === 4) {
      const style = rng.int(0, 2)
      if (style === 0) {
        const unit = rng.pick([10, 100, 1000])
        const k = rng.int(12, 990)
        const n = k * unit
        const uname = unit === 10 ? 'tens' : unit === 100 ? 'hundreds' : 'thousands'
        const zeros = Math.round(Math.log10(unit))
        return numItem({
          prompt: `How many ${uname} make ${fmt(n)}?`,
          answer: k,
          hints: [
            `${fmt(n)} can be split into groups of ${fmt(unit)}.`,
            `Divide ${fmt(n)} by ${fmt(unit)}. Each digit moves ${zeros} place${zeros > 1 ? 's' : ''} to the right.`,
            `There are 10 ${uname} in ${fmt(unit * 10)} and 100 ${uname} in ${fmt(unit * 100)}.`,
          ],
          explanation: `${fmt(n)} ÷ ${fmt(unit)} = ${fmt(k)}, so ${fmt(k)} ${uname} make ${fmt(n)}.`,
          solution: [
            { say: `Count how many lots of ${fmt(unit)} are in ${fmt(n)}.` },
            { say: 'Divide by the size of each group.', show: `${fmt(n)} ÷ ${fmt(unit)} = ${fmt(k)}` },
          ],
        })
      }
      if (style === 1) {
        const ds = [rng.int(1, 9), rng.int(1, 9), rng.int(1, 9), rng.int(1, 9), rng.int(1, 9), rng.int(1, 9)]
        for (const z of rng.sample([1, 2, 3, 4], 2)) ds[z] = 0
        const n = fromDigits(ds)
        const said = ds.map((d, i) => ({ d, p: 5 - i })).filter((o) => o.d > 0).map((o) => placePhrase(o.d, o.p))
        const list = `${said.slice(0, -1).join(', ')} and ${at(said, said.length - 1)}`
        return numItem({
          prompt: `Write the number that has ${list}.`,
          answer: n,
          hints: [
            'Draw a place value chart with six columns.',
            'Put each digit in its column. Write 0 in any empty column.',
            `Start with ${at(ds, 0)} in the hundred thousands column.`,
          ],
          explanation: `The chart reads ${ds.join(' ')}, so the number is ${fmt(n)}. The zeros keep the empty places.`,
          solution: [
            { say: 'Fill the place value chart. Empty columns get a 0.', figure: pvChart(ds) },
            { say: 'Read the number.', show: fmt(n) },
          ],
        })
      }
      const wide = rng.chance(0.5)
      const min = wide ? 0 : rng.int(1, 8) * 100000
      const step = wide ? 50000 : 10000
      const max = wide ? 1000000 : min + 100000
      const k = wide ? rng.int(1, 19) : rng.int(1, 9)
      const ans = min + k * step
      return lineItem({
        prompt: `Mark ${fmt(ans)} on the number line.`,
        min,
        max,
        step,
        answer: ans,
        hints: [
          `The line goes from ${fmt(min)} to ${fmt(max)}.`,
          `Each small step is ${fmt(step)}.`,
          `Count on from ${fmt(min)} in steps of ${fmt(step)}.`,
        ],
        explanation: `${fmt(ans)} is ${k} steps of ${fmt(step)} after ${fmt(min)}.`,
        solution: [
          { say: `Work out the size of one step: ${fmt(step)}.` },
          { say: `Count ${k} steps from ${fmt(min)}.`, show: `${fmt(min)} + ${k} × ${fmt(step)} = ${fmt(ans)}` },
        ],
      })
    }

    // level 5
    if (rng.chance(0.5)) {
      let digits: number[] = []
      do digits = rng.sample([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 6)
      while (!digits.some((d) => d % 2 === 0) || !digits.some((d) => d % 2 === 1))
      const kind = rng.pick(['largest even', 'smallest odd', 'largest odd', 'smallest even'] as const)
      const wantEven = kind.endsWith('even')
      const wantLargest = kind.startsWith('largest')
      const nums = permutations(digits)
        .filter((p) => p[0] !== 0 && at(p, 5) % 2 === (wantEven ? 0 : 1))
        .map(fromDigits)
      const ans = wantLargest ? Math.max(...nums) : Math.min(...nums)
      const last = ans % 10
      return numItem({
        prompt: `Use each of these digits once: ${digits.join(', ')}. What is the ${kind} 6-digit number you can make?`,
        answer: ans,
        hints: [
          wantEven ? 'An even number ends in 0, 2, 4, 6 or 8.' : 'An odd number ends in 1, 3, 5, 7 or 9.',
          wantLargest
            ? 'Put the biggest digits in the biggest place value columns.'
            : 'Put the smallest digits in the biggest columns, but the first digit cannot be 0.',
          `Choose the last digit first. It must be ${wantEven ? 'even' : 'odd'}.`,
        ],
        explanation: `${fmt(ans)} is the ${kind} number. It ends in ${last}, and the other digits are placed ${wantLargest ? 'from largest to smallest' : 'from smallest to largest, without a 0 at the front'}.`,
        solution: [
          { say: `The last digit must be ${wantEven ? 'even' : 'odd'}. The best choice here is ${last}.` },
          { say: 'Arrange the other five digits in the other columns.', show: fmt(ans) },
        ],
        secs: 120,
      })
    }
    const mil = rng.int(1, 9)
    const rest = rng.pick([rng.int(1, 99) * 1000 + rng.int(1, 9), rng.int(100, 999) * 1000, rng.int(1, 9) * 100000 + rng.int(10, 99), rng.int(2, 99)])
    const n = mil * 1_000_000 + rest
    return numItem({
      prompt: `Write ${bigWords(n)} in figures.`,
      answer: n,
      hints: [
        'A million is 1,000,000. It has six zeros.',
        'Write the millions, then the thousands, then the rest. Use 0 for empty columns.',
        `${cap(numberWords(mil))} million is ${fmt(mil * 1_000_000)}.`,
      ],
      explanation: `${cap(numberWords(mil))} million is ${fmt(mil * 1_000_000)}, and the rest is ${fmt(rest)}. Together they make ${fmt(n)}.`,
      solution: [
        { say: 'Fill a place value chart with seven columns.', figure: pvChart(digitsOf(n)) },
        { say: 'Add the millions and the rest.', show: `${fmt(mil * 1_000_000)} + ${fmt(rest)} = ${fmt(n)}` },
      ],
    })
  },
}

const roundWholeNumbers: Generator = {
  skill: 'm5.round-whole-numbers',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level <= 3) {
      const p = level === 1 ? rng.pick([10, 100]) : level === 2 ? rng.pick([100, 1000]) : rng.pick([1000, 10000, 100000])
      const lo0 = level === 1 ? 1000 : level === 2 ? 10000 : 100000
      let n = rng.int(lo0 + 1, lo0 * 10 - 1)
      if (level === 3 && rng.chance(0.4) && p < 100000) {
        // memaksa pembulatan yang melewati 9
        n = Math.floor(n / (p * 10)) * (p * 10) + 9 * p + rng.int(p / 2, p - 1)
      }
      if (n % p === 0) n += rng.int(1, p - 1)
      const lo = Math.floor(n / p) * p
      const hi = lo + p
      const r = roundTo(n, p)
      const decider = Math.floor(n / (p / 10)) % 10
      const deciderPlace = at(PLACE, Math.round(Math.log10(p)) - 1)
      const hints: [string, string, string] = [
        `Which two multiples of ${fmt(p)} is ${fmt(n)} between?`,
        `Look at the ${deciderPlace} digit. If it is 5 or more, round up.`,
        `The ${deciderPlace} digit of ${fmt(n)} is ${decider}.`,
      ]
      const explanation = `${fmt(n)} is between ${fmt(lo)} and ${fmt(hi)}. The ${deciderPlace} digit is ${decider}, so it rounds ${decider >= 5 ? 'up' : 'down'} to ${fmt(r)}.`
      const line: Fig = {
        kind: 'numberline',
        min: lo,
        max: hi,
        step: p / 10,
        labels: 'ends',
        marks: [{ at: n, label: fmt(n) }],
        alt: `A number line from ${fmt(lo)} to ${fmt(hi)} with ${fmt(n)} marked.`,
      }
      const solution: Step[] = [
        { say: `${fmt(n)} is between ${fmt(lo)} and ${fmt(hi)}.`, figure: line },
        { say: `The ${deciderPlace} digit is ${decider}. ${decider >= 5 ? 'That is 5 or more, so round up.' : 'That is less than 5, so round down.'}`, show: `${fmt(n)} → ${fmt(r)}` },
      ]
      const style = rng.int(0, 2)
      if (level === 1 && style === 0) {
        const span = p * 10
        const min = Math.floor(n / span) * span
        return lineItem({
          prompt: `Round ${fmt(n)} to the nearest ${fmt(p)}. Mark your answer on the number line.`,
          min,
          max: min + span,
          step: p,
          answer: r,
          hints,
          explanation,
          solution,
        })
      }
      if (level === 2 && style === 0) {
        const X = roundTo(rng.int(lo0 * 2, lo0 * 9), p)
        let off = rng.int(1, p - 2)
        if (off === p / 2) off += 1
        const c = X - p / 2 + off
        const ds = [X - p / 2 - rng.int(1, p / 2 - 1), X + p / 2 + rng.int(0, p / 2 - 1), X - 2 * p + rng.int(1, p / 2 - 1), X + 2 * p - rng.int(1, p / 2 - 1)]
        const m = mcqFrom(rng, c, rng.shuffle(ds).map((d) => ({ value: d, why: `${fmt(d)} rounds to ${fmt(roundTo(d, p))}.` })))
        return mcqItem({
          prompt: `Which number rounds to ${fmt(X)} when rounded to the nearest ${fmt(p)}?`,
          ...m,
          hints: [
            `Round each number to the nearest ${fmt(p)} and check.`,
            `Numbers from ${fmt(X - p / 2)} up to ${fmt(X + p / 2 - 1)} round to ${fmt(X)}.`,
            `Look at the ${at(PLACE, Math.round(Math.log10(p)) - 1)} digit of each number first.`,
          ],
          explanation: `${fmt(c)} is between ${fmt(X - p / 2)} and ${fmt(X + p / 2 - 1)}, so it rounds to ${fmt(X)}.`,
          solution: [
            { say: `Halfway between ${fmt(X - p)} and ${fmt(X)} is ${fmt(X - p / 2)}. Halfway between ${fmt(X)} and ${fmt(X + p)} is ${fmt(X + p / 2)}.` },
            { say: `Only numbers between those halfway points round to ${fmt(X)}.`, show: `${fmt(c)} → ${fmt(X)}` },
          ],
        })
      }
      if (level === 3 && style === 0) {
        const wrong = [
          { value: r === lo ? hi : lo, why: `Look again at the ${deciderPlace} digit. It is ${decider}, so round ${decider >= 5 ? 'up' : 'down'}.` },
          { value: roundTo(n, p / 10), why: `That is rounded to the nearest ${fmt(p / 10)}. The question asks for the nearest ${fmt(p)}.` },
          { value: roundTo(n, p * 10), why: `That is rounded to the nearest ${fmt(p * 10)}. The question asks for the nearest ${fmt(p)}.` },
          { value: lo + p / 2, why: `That is the halfway point between ${fmt(lo)} and ${fmt(hi)}.` },
          { value: r === hi ? hi + p : lo - p, why: `That is too far. ${fmt(n)} is between ${fmt(lo)} and ${fmt(hi)}.` },
        ]
        const m = mcqFrom(rng, r, wrong)
        return mcqItem({ prompt: `What is ${fmt(n)} rounded to the nearest ${fmt(p)}?`, ...m, hints, explanation, solution })
      }
      return numItem({ prompt: `Round ${fmt(n)} to the nearest ${fmt(p)}.`, answer: r, hints, explanation, solution })
    }

    if (level === 4) {
      const p = rng.pick([100, 1000])
      const A = rng.int(2000, 9800) + (p === 100 ? rng.int(0, 9) * 10000 : 0)
      let B = rng.int(1100, 8900)
      if (B % p === 0) B += 7
      const rA = roundTo(A, p)
      const rB = roundTo(B, p)
      const add = rng.chance(0.5) || Math.abs(rA - rB) <= p
      const big = Math.max(rA, rB)
      const small = Math.min(rA, rB)
      const first = rA >= rB ? A : B
      const second = rA >= rB ? B : A
      const ans = add ? rA + rB : big - small
      const word = rng.chance(0.5)
      const [m1, m2] = rng.pick([['May', 'June'], ['March', 'April'], ['August', 'September']] as const)
      const prompt = word
        ? add
          ? `A cinema sold ${fmt(A)} tickets in ${m1} and ${fmt(B)} in ${m2}. Round each number to the nearest ${fmt(p)} to estimate the total.`
          : `A cinema sold ${fmt(first)} tickets in ${m1} and ${fmt(second)} in ${m2}. Round each number to the nearest ${fmt(p)} to estimate the difference.`
        : `Estimate ${add ? `${fmt(A)} + ${fmt(B)}` : `${fmt(first)} − ${fmt(second)}`} by rounding each number to the nearest ${fmt(p)}.`
      return numItem({
        prompt,
        answer: ans,
        hints: [
          'Round each number first, then do the calculation.',
          `Round ${fmt(A)} and ${fmt(B)} to the nearest ${fmt(p)}.`,
          `${fmt(A)} rounds to ${fmt(rA)}.`,
        ],
        explanation: `${fmt(A)} rounds to ${fmt(rA)} and ${fmt(B)} rounds to ${fmt(rB)}. ${add ? `${fmt(rA)} + ${fmt(rB)}` : `${fmt(big)} − ${fmt(small)}`} = ${fmt(ans)}.`,
        solution: [
          { say: 'Round both numbers.', show: `${fmt(A)} → ${fmt(rA)}, ${fmt(B)} → ${fmt(rB)}` },
          { say: add ? 'Add the rounded numbers.' : 'Subtract the rounded numbers.', show: `${add ? `${fmt(rA)} + ${fmt(rB)}` : `${fmt(big)} − ${fmt(small)}`} = ${fmt(ans)}` },
        ],
        tags: word ? [WP] : [],
        tip: 'An estimate helps you check if a written answer is sensible.',
      })
    }

    const p = rng.pick([100, 1000, 10000])
    const X = rng.int(3, 95) * p
    const smallest = rng.chance(0.5)
    const ans = smallest ? X - p / 2 : X + p / 2 - 1
    const what = rng.pick([
      ['visitors to a museum', 'visitors'],
      ['people at a football match', 'people'],
      ['books in a library', 'books'],
    ] as const)
    return numItem({
      prompt: `The number of ${what[0]} was ${fmt(X)}, rounded to the nearest ${fmt(p)}. What is the ${smallest ? 'smallest' : 'greatest'} number of ${what[1]} there could have been?`,
      answer: ans,
      hints: [
        `Think about which whole numbers round to ${fmt(X)}.`,
        smallest
          ? `Numbers from halfway between ${fmt(X - p)} and ${fmt(X)} round up to ${fmt(X)}.`
          : `Numbers below halfway between ${fmt(X)} and ${fmt(X + p)} round down to ${fmt(X)}.`,
        smallest
          ? `First find the number halfway between ${fmt(X - p)} and ${fmt(X)}.`
          : `First find the number halfway between ${fmt(X)} and ${fmt(X + p)}.`,
      ],
      explanation: smallest
        ? `${fmt(X - p / 2)} is halfway between ${fmt(X - p)} and ${fmt(X)}, and halfway numbers round up. So ${fmt(ans)} is the smallest.`
        : `${fmt(X + p / 2)} would round up to ${fmt(X + p)}, so the greatest is one less: ${fmt(ans)}.`,
      solution: [
        { say: `Find the halfway point${smallest ? ` below ${fmt(X)}` : ` above ${fmt(X)}`}.`, show: smallest ? `${fmt(X - p)} and ${fmt(X)} → ${fmt(X - p / 2)}` : `${fmt(X)} and ${fmt(X + p)} → ${fmt(X + p / 2)}` },
        { say: smallest ? 'Halfway rounds up, so that number counts.' : 'Halfway rounds up, so take one less.', show: fmt(ans) },
      ],
      tags: [WP],
      secs: 120,
    })
  },
}

/* ------------------------------------------------------------------ */
/* Np: desimal                                                         */
/* ------------------------------------------------------------------ */

const decimalPlaceValue: Generator = {
  skill: 'm5.decimal-place-value',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level === 1) {
      const w = rng.int(1, 9)
      const ds = rng.sample([2, 3, 4, 5, 6, 7, 8, 9].filter((d) => d !== w), 2)
      const tt = at(ds, 0)
      const hh = at(ds, 1)
      const n = dec(w * 100 + tt * 10 + hh, 2)
      const s = fx(n, 2)
      const pos = rng.int(0, 2)
      const d = pos === 0 ? w : pos === 1 ? tt : hh
      const exp = pos === 0 ? 0 : -pos
      const chart = pvChart([w, tt, hh], 2)
      if (rng.chance(0.6)) {
        const labels = [placePhrase(d, 0), placePhrase(d, -1), placePhrase(d, -2), placePhrase(d, 1)]
        const whys = [
          `The ones digit is just before the decimal point. In ${s} it is ${w}.`,
          `The tenths digit is the first digit after the point. In ${s} it is ${tt}.`,
          `The hundredths digit is the second digit after the point. In ${s} it is ${hh}.`,
          `${s} is less than 10, so it has no tens digit.`,
        ]
        const correct = at(labels, pos)
        const m = mcqFrom(
          rng,
          correct,
          rng.shuffle(labels.map((l, i) => ({ value: l, why: at(whys, i) })).filter((o) => o.value !== correct)),
        )
        return mcqItem({
          prompt: `What is the value of the digit ${d} in ${s}?`,
          ...m,
          figure: chart,
          hints: [
            `Find the digit ${d} in ${s}.`,
            'After the decimal point come tenths, then hundredths.',
            `Find the decimal point in ${s} first.`,
          ],
          explanation: `In ${s}, the ${d} is in the ${placeName(exp)} place, so it is worth ${placePhrase(d, exp)}.`,
          solution: [
            { say: 'Put the number in a place value chart.', figure: chart },
            { say: `The ${d} is in the ${placeName(exp)} column.`, show: placePhrase(d, exp) },
          ],
        })
      }
      const dpos = pos === 0 ? rng.int(1, 2) : pos
      const dd = dpos === 1 ? tt : hh
      const dexp = -dpos
      const value = dec(dd, dpos)
      return numItem({
        prompt: `What is the value of the digit ${dd} in ${s}? Write it as a decimal.`,
        answer: value,
        decimal: true,
        figure: chart,
        hints: [
          `Find the digit ${dd} in ${s}.`,
          'One tenth is written 0.1. One hundredth is written 0.01.',
          `Is the ${dd} the first or the second digit after the decimal point?`,
        ],
        explanation: `The ${dd} is in the ${placeName(dexp)} place, so its value is ${placePhrase(dd, dexp)}, which is ${fmt(value)}.`,
        solution: [
          { say: 'Find the column of the digit.', figure: chart },
          { say: `${placePhrase(dd, dexp)} is written like this.`, show: fmt(value) },
        ],
      })
    }

    if (level === 2) {
      const tens = rng.chance(0.3) ? rng.int(1, 9) : 0
      const w = rng.int(0, 9)
      const t = rng.int(0, 9)
      const h = rng.int(1, 9)
      const u = tens * 1000 + w * 100 + t * 10 + h
      const n = dec(u, 2)
      if (rng.chance(0.5)) {
        const bits = [
          ...(tens > 0 ? [placePhrase(tens, 1)] : []),
          placePhrase(w, 0),
          placePhrase(t, -1),
          placePhrase(h, -2),
        ]
        return numItem({
          prompt: `Write the number that has ${bits.slice(0, -1).join(', ')} and ${at(bits, bits.length - 1)}.`,
          answer: n,
          decimal: true,
          hints: [
            'Ones come just before the decimal point. Tenths and hundredths come after it.',
            'Write a 0 for any place with nothing in it.',
            `Start with ${tens > 0 ? `${tens}${w}` : w}, then the decimal point.`,
          ],
          explanation: `${bits.join(', ')} make ${fx(n, 2)}.`,
          solution: [
            { say: 'Put each digit in its column.', figure: pvChart(tens > 0 ? [tens, w, t, h] : [w, t, h], 2) },
            { say: 'Read the number.', show: fx(n, 2) },
          ],
        })
      }
      const parts = [
        ...(tens > 0 ? [tens * 10] : []),
        ...(w > 0 ? [w] : []),
        ...(t > 0 ? [dec(t, 1)] : []),
        dec(h, 2),
      ]
      if (parts.length < 2) parts.unshift(rng.int(1, 9))
      const total = dec(sum(parts.map((v) => units(v, 2))), 2)
      const miss = rng.int(0, parts.length - 1)
      const missing = at(parts, miss)
      const shown = dec(units(total, 2) - units(missing, 2), 2)
      return numItem({
        prompt: `Find the missing number. ${fmt(total)} = ${parts.map((v, j) => (j === miss ? '___' : fmt(v))).join(' + ')}`,
        answer: missing,
        decimal: true,
        hints: [
          'Each part is the value of one digit.',
          `Which digit of ${fmt(total)} is not shown yet?`,
          `The parts you can see add up to ${fmt(shown)}.`,
        ],
        explanation: `${fmt(total)} = ${parts.map(fmt).join(' + ')}, so the missing part is ${fmt(missing)}.`,
        solution: [
          { say: 'Split the number by place value.', figure: decChart(units(total, 2), 2) },
          { say: 'The missing part is the value of the digit that is left.', show: fmt(missing) },
        ],
      })
    }

    if (level === 3) {
      const style = rng.int(0, 2)
      if (style === 0) {
        const den = rng.pick([10, 100])
        const w = rng.chance(0.5) ? rng.int(1, 9) : 0
        const a = den === 10 ? rng.int(1, 9) : rng.pick([rng.int(1, 9), rng.int(11, 99)])
        const fixedA = den === 100 && a % 10 === 0 ? a + 3 : a
        const value = dec(w * den + fixedA, den === 10 ? 1 : 2)
        const fracText = `${w > 0 ? `${w} ` : ''}${fixedA}/${den}`
        return numItem({
          prompt: `Write ${fracText} as a decimal.`,
          answer: value,
          decimal: true,
          hints: [
            den === 10 ? 'Tenths go in the first place after the decimal point.' : 'Hundredths need two places after the decimal point.',
            den === 100 && fixedA < 10 ? `${fixedA}/100 has no tenths, so the tenths digit is 0.` : `Write the ${den === 10 ? 'tenths' : 'hundredths'} after the point.`,
            w > 0 ? `Write the whole number ${w} first, then the decimal point.` : 'Start with 0 and a decimal point.',
          ],
          explanation: `${fracText} = ${fmt(value)}. ${den === 10 ? 'Tenths fill one decimal place.' : 'Hundredths fill two decimal places.'}`,
          solution: [
            { say: `The denominator is ${den}, so we need ${den === 10 ? 'one decimal place' : 'two decimal places'}.` },
            { say: 'Write the whole number, the point, then the digits.', show: `${fracText} = ${fmt(value)}` },
          ],
        })
      }
      if (style === 1) {
        const base = rng.int(1, 89)
        const h = rng.int(1, 9)
        const min = dec(base, 1)
        const max = dec(base + 1, 1)
        const ans = dec(base * 10 + h, 2)
        return lineItem({
          prompt: `Mark ${fx(ans, 2)} on the number line.`,
          min,
          max,
          step: 0.01,
          answer: ans,
          hints: [
            `The line goes from ${fx(min, 1)} to ${fx(max, 1)}.`,
            'There are 10 small steps between them. Each step is 0.01.',
            `Count on from ${fx(min, 1)} in hundredths.`,
          ],
          explanation: `${fx(ans, 2)} is ${h} hundredths more than ${fx(min, 1)}.`,
          solution: [
            { say: `Each small step is one hundredth.` },
            { say: `Count ${h} steps from ${fx(min, 1)}.`, show: `${fx(min, 1)} + ${fx(dec(h, 2), 2)} = ${fx(ans, 2)}` },
          ],
        })
      }
      const dp = rng.pick([1, 2])
      const u = dp === 1 ? rng.int(1, 9) : rng.pick([rng.int(1, 9), rng.int(11, 99)])
      const n = dec(u, dp)
      const f = { n: u, d: 10 ** dp }
      return textItem({
        prompt: `Write ${fmt(n)} as a fraction.`,
        answers: [fracAnswers(f)],
        hints: [
          'The last decimal place tells you the denominator.',
          `${fmt(n)} has ${dp === 1 ? 'one decimal place' : 'two decimal places'}, so the denominator is ${10 ** dp}.`,
          'Write the digits after the point as the numerator.',
        ],
        explanation: `${fmt(n)} is ${u} ${dp === 1 ? (u === 1 ? 'tenth' : 'tenths') : u === 1 ? 'hundredth' : 'hundredths'}, which is ${fs(f)}.${simp(f).d !== f.d ? ` In its simplest form this is ${fs(simp(f))}.` : ''}`,
        solution: [
          { say: `${fmt(n)} has ${dp === 1 ? 'one decimal place' : 'two decimal places'}.` },
          { say: 'Write it over ' + 10 ** dp + '.', show: `${fmt(n)} = ${fs(f)}` },
        ],
      })
    }

    if (level === 4) {
      const w = rng.int(1, 9)
      const t = rng.int(1, 9)
      const h = rng.int(1, 9)
      const style = rng.int(0, 2)
      if (style === 0) {
        const dp = rng.pick([1, 2])
        const u = dp === 1 ? w * 10 + t : w * 100 + t * 10 + h
        const n = dec(u, dp)
        const name = dp === 1 ? 'tenths' : 'hundredths'
        return numItem({
          prompt: `How many ${name} are there in ${fmt(n)} altogether?`,
          answer: u,
          hints: [
            `How many ${name} make 1 whole?`,
            dp === 1 ? '1 whole is 10 tenths.' : '1 whole is 100 hundredths, and 1 tenth is 10 hundredths.',
            `${w} wholes make ${w * 10 ** dp} ${name}.`,
          ],
          explanation: `${fmt(n)} = ${dp === 1 ? `${w * 10} + ${t}` : `${w * 100} + ${t * 10} + ${h}`} ${name} = ${u} ${name}.`,
          solution: [
            { say: `Change the wholes into ${name}.`, show: `${w} = ${w * 10 ** dp} ${name}` },
            { say: 'Add the rest.', show: `${fmt(n)} = ${u} ${name}` },
          ],
        })
      }
      if (style === 1) {
        const n = dec(w * 10 + t, 1)
        return numItem({
          prompt: `Find the missing number. ${fmt(n)} = ${w - 1} ${w - 1 === 1 ? 'one' : 'ones'} and ___ tenths`,
          answer: 10 + t,
          hints: [
            'You can swap 1 one for 10 tenths.',
            `Only ${w - 1} ${w - 1 === 1 ? 'one is' : 'ones are'} used, so 1 one has been changed into tenths.`,
            `1 one is 10 tenths. Add the ${t} tenths that are already there.`,
          ],
          explanation: `${fmt(n)} is ${w} ones and ${t} tenths. Change 1 one into 10 tenths: ${w - 1} ones and ${10 + t} tenths.`,
          solution: [
            { say: `Start with ${w} ones and ${t} tenths.` },
            { say: 'Swap 1 one for 10 tenths.', show: `${w - 1} ones + ${10 + t} tenths = ${fmt(n)}` },
          ],
        })
      }
      const n = dec(w * 100 + t * 10 + h, 2)
      return numItem({
        prompt: `Find the missing number. ${fx(n, 2)} = ${w} ${w === 1 ? 'one' : 'ones'}, ${t - 1} ${t - 1 === 1 ? 'tenth' : 'tenths'} and ___ hundredths`,
        answer: 10 + h,
        hints: [
          'You can swap 1 tenth for 10 hundredths.',
          `Only ${t - 1} ${t - 1 === 1 ? 'tenth is' : 'tenths are'} used, so 1 tenth has been changed into hundredths.`,
          `1 tenth is 10 hundredths. Add the ${h} hundredths that are already there.`,
        ],
        explanation: `${fx(n, 2)} is ${w} ones, ${t} tenths and ${h} hundredths. Change 1 tenth into 10 hundredths: ${10 + h} hundredths.`,
        solution: [
          { say: `Start with ${placePhrase(t, -1)} and ${placePhrase(h, -2)}.` },
          { say: 'Swap 1 tenth for 10 hundredths.', show: `${t - 1} tenths + ${10 + h} hundredths` },
        ],
      })
    }

    // level 5: menambah atau mengurangi 0.1 atau 0.01 dengan regroup
    const more = rng.chance(0.5)
    const step = rng.pick([1, 10])
    const w = rng.int(1, 9)
    let u: number
    if (more) u = step === 1 ? w * 100 + rng.int(0, 9) * 10 + 9 : w * 100 + 90 + rng.int(0, 9)
    else u = step === 1 ? w * 100 + rng.int(0, 9) * 10 : w * 100 + rng.int(0, 9)
    if (!more && rng.chance(0.3)) u = w * 100
    const n = dec(u, 2)
    const ans = dec(more ? u + step : u - step, 2)
    const stepText = step === 1 ? '0.01' : '0.1'
    const place = step === 1 ? 'hundredths' : 'tenths'
    const digit = step === 1 ? u % 10 : Math.floor(u / 10) % 10
    return numItem({
      prompt: `What number is ${stepText} ${more ? 'more' : 'less'} than ${fmt(n)}?`,
      answer: ans,
      decimal: true,
      hints: [
        `${stepText} is one ${step === 1 ? 'hundredth' : 'tenth'}.`,
        `Change the ${place} digit by 1. Regroup if you need to.`,
        `The ${place} digit of ${fmt(n)} is ${digit}.`,
      ],
      explanation: `${fmt(n)} ${more ? '+' : '−'} ${stepText} = ${fmt(ans)}. The ${place} digit ${more ? 'goes past 9' : 'is 0'}, so the next column changes too.`,
      solution: [
        { say: `Look at the ${place} digit: ${digit}.` },
        { say: more ? 'Add 1 and regroup 10 into the next column.' : 'Exchange from the next column, then take away 1.', show: `${fmt(n)} ${more ? '+' : '−'} ${stepText} = ${fmt(ans)}` },
      ],
    })
  },
}

const compareDecimals: Generator = {
  skill: 'm5.compare-decimals',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const w = rng.int(1, 9)
    if (level <= 2) {
      let vals: number[]
      if (level === 1) {
        vals = rng.sample([1, 2, 3, 4, 5, 6, 7, 8, 9], 4).map((t) => dec(w * 10 + t, 1))
      } else {
        const t = rng.int(3, 8)
        vals = [
          dec(w * 10 + t, 1),
          dec(w * 100 + (t - 1) * 10 + rng.int(5, 9), 2),
          dec(w * 100 + t, 2),
          rng.chance(0.5) ? dec((w - 1) * 100 + 90 + rng.int(1, 9), 2) : dec(w * 100 + (t - 2) * 10 + rng.int(1, 9), 2),
        ]
      }
      const greatest = rng.chance(0.5)
      const asc = [...vals].sort((a, b) => a - b)
      const c = greatest ? at(asc, asc.length - 1) : at(asc, 0)
      const m = mcqFrom(rng, c, vals.filter((v) => v !== c).map((v) => ({ value: v, why: compareWhy(v, c, 2) })))
      return mcqItem({
        prompt: `Which number is the ${greatest ? 'greatest' : 'smallest'}?`,
        ...m,
        hints: [
          'Compare the whole number parts first.',
          'If they match, compare the tenths, then the hundredths.',
          level === 1 ? `All the numbers have ${w} ones. Look at the tenths.` : 'Write each number with two decimal places, like 3.50, before you compare.',
        ],
        explanation: `${fmt(c)} is the ${greatest ? 'greatest' : 'smallest'}. In order: ${asc.map(fmt).join(', ')}.`,
        solution: [
          { say: 'Write every number with the same number of decimal places.', show: vals.map((v) => fx(v, 2)).join(', ') },
          { say: 'Now compare from the left.', show: asc.map(fmt).join(' < ') },
        ],
      })
    }

    if (level === 3) {
      if (rng.chance(0.3)) {
        const k = rng.int(1, 19)
        const ans = dec(w * 100 + k * 5, 2)
        return lineItem({
          prompt: `Mark ${fmt(ans)} on the number line.`,
          min: w,
          max: w + 1,
          step: 0.05,
          answer: ans,
          hints: [
            `The line goes from ${w} to ${w + 1}.`,
            'Each small step is 0.05, so two steps make 0.1.',
            `${fmt(ans)} is between ${fx(dec(Math.floor((w * 100 + k * 5) / 10), 1), 1)} and ${fx(dec(Math.floor((w * 100 + k * 5) / 10) + 1, 1), 1)}.`,
          ],
          explanation: `${fmt(ans)} is ${k} steps of 0.05 after ${w}.`,
          solution: [
            { say: 'Find the tenths first, then the half step.' },
            { say: `Count ${k} steps of 0.05 from ${w}.`, show: `${w} + ${k} × 0.05 = ${fmt(ans)}` },
          ],
        })
      }
      const count = rng.int(4, 5)
      const set = new Set<number>()
      while (set.size < count) {
        const u = rng.chance(0.4) ? rng.int(1, 9) * 10 : rng.int(1, 99)
        set.add(w * 100 + u + (rng.chance(0.15) ? 100 : 0))
      }
      const vals = [...set].map((u) => dec(u, 2))
      const asc = [...vals].sort((a, b) => a - b)
      const desc = rng.chance(0.4)
      const items = (desc ? [...asc].reverse() : asc).map(fmt)
      return orderItem({
        prompt: `Put these numbers in order, starting with the ${desc ? 'largest' : 'smallest'}.`,
        items,
        hints: [
          'Compare the whole number parts first.',
          'Then compare tenths, then hundredths. More digits does not mean bigger.',
          `Write each number with two decimal places: ${vals.map((v) => fx(v, 2)).join(', ')}.`,
        ],
        explanation: `In order: ${items.join(', ')}.`,
        solution: [
          { say: 'Give every number two decimal places.', show: vals.map((v) => fx(v, 2)).join(', ') },
          { say: 'Compare from the left.', show: asc.map(fmt).join(' < ') },
        ],
      })
    }

    if (level === 4) {
      const ctx = rng.pick([
        { what: 'jumped', unit: 'm', q: 'Who jumped the furthest?', qs: 'Who jumped the shortest distance?' },
        { what: 'ran', unit: 'km', q: 'Who ran the furthest?', qs: 'Who ran the shortest distance?' },
        { what: 'picked mangoes weighing', unit: 'kg', q: 'Who picked the heaviest bag?', qs: 'Who picked the lightest bag?' },
      ] as const)
      const people = pickNames(rng, 4)
      const t = rng.int(3, 8)
      const us = rng.shuffle([w * 10 + t, w * 100 + (t - 1) * 10 + rng.int(5, 9), w * 100 + t * 10 - 10 + rng.int(1, 4), w * 100 + rng.int(1, 9)])
      const vals = us.map((u) => (u < 100 ? dec(u, 1) : dec(u, 2)))
      if (rng.chance(0.5)) {
        const greatest = rng.chance(0.6)
        const target = greatest ? Math.max(...vals) : Math.min(...vals)
        const ci = vals.indexOf(target)
        const lines = people.map((p, i) => `${p} ${ctx.what} ${fmt(at(vals, i))} ${ctx.unit}.`).join(' ')
        const m = mcqFrom(
          rng,
          at(people, ci),
          people
            .map((p, i) => ({ p, v: at(vals, i) }))
            .filter((o) => o.v !== target)
            .map((o) => ({ value: o.p, why: `${o.p}: ${compareWhy(o.v, target, 2)}` })),
        )
        return mcqItem({
          prompt: `${lines} ${greatest ? ctx.q : ctx.qs}`,
          ...m,
          figure: { kind: 'table', head: ['Name', `Result (${ctx.unit})`], rows: people.map((p, i) => [p, fmt(at(vals, i))]), alt: `Table: ${people.map((p, i) => `${p} ${fmt(at(vals, i))} ${ctx.unit}`).join(', ')}.` },
          hints: [
            'All the results have the same whole number. Compare the decimal parts.',
            'Write each result with two decimal places before you compare.',
            `Start with the tenths digits: ${vals.map((v) => Math.floor(units(v, 2) / 10) % 10).join(', ')}.`,
          ],
          explanation: `${at(people, ci)} has ${fmt(target)} ${ctx.unit}, which is the ${greatest ? 'greatest' : 'smallest'} result.`,
          solution: [
            { say: 'Write each result with two decimal places.', show: vals.map((v) => fx(v, 2)).join(', ') },
            { say: `The ${greatest ? 'greatest' : 'smallest'} is ${fx(target, 2)}.`, show: at(people, ci) },
          ],
          tags: [WP],
        })
      }
      const asc = [...vals].sort((a, b) => a - b)
      return orderItem({
        prompt: `Put these ${ctx.unit === 'kg' ? 'masses' : 'distances'} in order, starting with the smallest.`,
        items: asc.map((v) => `${fmt(v)} ${ctx.unit}`),
        hints: [
          'Compare the whole numbers, then tenths, then hundredths.',
          'A number with more digits is not always bigger.',
          `Write them with two decimal places: ${vals.map((v) => fx(v, 2)).join(', ')}.`,
        ],
        explanation: `In order: ${asc.map((v) => `${fmt(v)} ${ctx.unit}`).join(', ')}.`,
        solution: [
          { say: 'Give each number two decimal places.', show: vals.map((v) => fx(v, 2)).join(', ') },
          { say: 'Order them from the left digit.', show: asc.map(fmt).join(' < ') },
        ],
      })
    }

    // level 5
    if (rng.chance(0.5)) {
      const gap = rng.pick([1, 2, 4])
      const a = rng.int(w * 10, w * 10 + 9 - gap)
      const lo = dec(a, 1)
      const hi = dec(a + gap, 1)
      const mid = dec(a * 10 + gap * 5, 2)
      return numItem({
        prompt: `Which number is exactly halfway between ${fx(lo, 1)} and ${fx(hi, 1)}?`,
        answer: mid,
        decimal: true,
        hints: [
          'Halfway means the same distance from both numbers.',
          `Write both numbers in hundredths: ${fx(lo, 2)} and ${fx(hi, 2)}.`,
          `The gap is ${fx(dec(gap, 1), 1)}. Find half of the gap.`,
        ],
        explanation: `The gap from ${fx(lo, 1)} to ${fx(hi, 1)} is ${fx(dec(gap, 1), 1)}. Half of it is ${fmt(dec(gap * 5, 2))}, so halfway is ${fmt(mid)}.`,
        solution: [
          { say: 'Find the gap between the numbers.', show: `${fx(hi, 1)} − ${fx(lo, 1)} = ${fx(dec(gap, 1), 1)}` },
          { say: 'Add half of the gap to the smaller number.', show: `${fx(lo, 1)} + ${fmt(dec(gap * 5, 2))} = ${fmt(mid)}` },
        ],
      })
    }
    const t = rng.int(0, 8)
    const h = rng.int(1, 9)
    const ans = dec(w * 100 + t * 10 + h, 2)
    return numItem({
      prompt: `A number has two decimal places. It is between ${fx(dec(w * 10 + t, 1), 1)} and ${fx(dec(w * 10 + t + 1, 1), 1)}. Its hundredths digit is ${h}. What is the number?`,
      answer: ans,
      decimal: true,
      hints: [
        `Numbers between ${fx(dec(w * 10 + t, 1), 1)} and ${fx(dec(w * 10 + t + 1, 1), 1)} start with ${w}.${t}.`,
        'The second decimal place is the hundredths.',
        `Write ${w}.${t} and then think about the next digit.`,
      ],
      explanation: `The number starts ${w}.${t} and its hundredths digit is ${h}, so it is ${fx(ans, 2)}.`,
      solution: [
        { say: 'The ones and tenths come from the two numbers.', show: `${w}.${t}_` },
        { say: 'Put the hundredths digit last.', show: fx(ans, 2) },
      ],
    })
  },
}

const roundDecimals: Generator = {
  skill: 'm5.round-decimals',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level <= 2) {
      const w = rng.int(3, 49)
      const dp = level === 1 ? 1 : 2
      let u = dp === 1 ? w * 10 + rng.int(1, 9) : w * 100 + rng.int(1, 99)
      if (dp === 2 && u % 10 === 0) u += 3
      const n = dec(u, dp)
      const r = Math.round(n)
      const tenths = dp === 1 ? u % 10 : Math.floor(u / 10) % 10
      const hints: Hints = [
        `Which two whole numbers is ${fmt(n)} between?`,
        'Look at the tenths digit. If it is 5 or more, round up.',
        `The tenths digit of ${fmt(n)} is ${tenths}.`,
      ]
      const explanation = `The tenths digit of ${fmt(n)} is ${tenths}, so it rounds ${tenths >= 5 ? 'up' : 'down'} to ${r}.`
      const solution: Step[] = [
        { say: `${fmt(n)} is between ${w} and ${w + 1}.` },
        { say: `The tenths digit is ${tenths}. ${tenths >= 5 ? 'Round up.' : 'Round down.'}`, show: `${fmt(n)} → ${r}` },
      ]
      if (level === 1 && rng.chance(0.5)) {
        return lineItem({
          prompt: `Round ${fmt(n)} to the nearest whole number. Mark your answer on the number line.`,
          min: w - 2,
          max: w + 3,
          step: 1,
          answer: r,
          hints,
          explanation,
          solution,
        })
      }
      if (level === 2 && tenths > 0 && rng.chance(0.5)) {
        const m = mcqFrom(rng, r, [
          { value: r === w ? w + 1 : w, why: `Check the tenths digit again. It is ${tenths}, so round ${tenths >= 5 ? 'up' : 'down'}.` },
          { value: dec(Math.round(u / 10), 1), why: 'That is rounded to one decimal place. The question asks for a whole number.' },
          { value: dec(Math.floor(u / 10), 1), why: 'That only removes the last digit. Round to a whole number instead.' },
          { value: roundTo(n, 10), why: 'That is rounded to the nearest 10.' },
          { value: r === w ? w - 1 : w + 2, why: `That is too far. ${fmt(n)} is between ${w} and ${w + 1}.` },
        ])
        return mcqItem({ prompt: `What is ${fmt(n)} rounded to the nearest whole number?`, ...m, hints, explanation, solution })
      }
      return numItem({ prompt: `Round ${fmt(n)} to the nearest whole number.`, answer: r, hints, explanation, solution })
    }

    if (level === 3) {
      const w = rng.int(1, 29)
      let u = w * 100 + rng.int(1, 99)
      if (u % 10 === 0) u += 1
      if (rng.chance(0.2)) u = w * 100 + 90 + rng.int(5, 9)
      const n = dec(u, 2)
      const r1 = Math.round(u / 10)
      const r = dec(r1, 1)
      const hd = u % 10
      const hints: Hints = [
        `Which two numbers with one decimal place is ${fmt(n)} between?`,
        'Look at the hundredths digit. If it is 5 or more, round up.',
        `The hundredths digit of ${fmt(n)} is ${hd}.`,
      ]
      const explanation = `The hundredths digit is ${hd}, so ${fmt(n)} rounds ${hd >= 5 ? 'up' : 'down'} to ${fx(r, 1)}.`
      const solution: Step[] = [
        { say: `${fmt(n)} is between ${fx(dec(Math.floor(u / 10), 1), 1)} and ${fx(dec(Math.floor(u / 10) + 1, 1), 1)}.` },
        { say: `The hundredths digit is ${hd}.`, show: `${fmt(n)} → ${fx(r, 1)}` },
      ]
      if (!Number.isInteger(r) && rng.chance(0.5)) {
        const other = hd >= 5 ? dec(Math.floor(u / 10), 1) : dec(Math.floor(u / 10) + 1, 1)
        const m = mcqFrom(
          rng,
          fx(r, 1),
          [
            { value: fx(other, 1), why: `Check the hundredths digit. It is ${hd}, so round ${hd >= 5 ? 'up' : 'down'}.` },
            { value: String(Math.round(n)), why: 'That is rounded to the nearest whole number.' },
            { value: fx(dec(Math.floor(u / 10) * 10 + 5, 2), 2), why: 'Rounding to one decimal place leaves only one digit after the point.' },
          ],
        )
        return mcqItem({ prompt: `What is ${fmt(n)} rounded to one decimal place?`, ...m, hints, explanation, solution })
      }
      return numItem({ prompt: `Round ${fmt(n)} to one decimal place.`, answer: r, decimal: true, hints, explanation, solution })
    }

    if (level === 4) {
      if (rng.chance(0.5)) {
        const ctx = rng.pick([
          { s: 'A bean plant is', after: ' tall', unit: 'cm', noun: 'centimetre' },
          { s: 'A bag of rice weighs', after: '', unit: 'kg', noun: 'kilogram' },
          { s: 'A bottle holds', after: '', unit: 'litres', noun: 'litre' },
          { s: 'A school path is', after: ' long', unit: 'm', noun: 'metre' },
        ] as const)
        let u = rng.int(105, 4999)
        if (u % 10 === 0) u += 7
        const n = dec(u, 2)
        const toTenth = rng.chance(0.5)
        const r = toTenth ? dec(Math.round(u / 10), 1) : Math.round(n)
        const d = toTenth ? u % 10 : Math.floor(u / 10) % 10
        return numItem({
          prompt: `${ctx.s} ${fmt(n)} ${ctx.unit}${ctx.after}. Round this to the nearest ${toTenth ? `tenth of a ${ctx.noun}` : `whole ${ctx.noun}`}.`,
          answer: r,
          decimal: true,
          unit: ctx.unit,
          hints: [
            toTenth ? 'Rounding to the nearest tenth leaves one decimal place.' : 'Rounding to the nearest whole leaves no decimal places.',
            `Look at the ${toTenth ? 'hundredths' : 'tenths'} digit.`,
            `The ${toTenth ? 'hundredths' : 'tenths'} digit of ${fmt(n)} is ${d}.`,
          ],
          explanation: `The ${toTenth ? 'hundredths' : 'tenths'} digit is ${d}, so ${fmt(n)} rounds ${d >= 5 ? 'up' : 'down'} to ${toTenth ? fx(r, 1) : fmt(r)} ${ctx.unit}.`,
          solution: [
            { say: `Look at the digit after the place you round to: ${d}.` },
            { say: d >= 5 ? 'It is 5 or more, so round up.' : 'It is less than 5, so round down.', show: `${fmt(n)} → ${toTenth ? fx(r, 1) : fmt(r)}` },
          ],
          tags: [WP],
        })
      }
      const a = dec(rng.int(11, 99) * 10 + rng.int(1, 9), 2) // 1.1 to 9.99
      const ua = units(a, 2)
      const b = dec(rng.int(11, 99) * 10 + rng.int(1, 9), 2)
      const ub = units(b, 2)
      const ra = Math.round(ua / 100)
      const rb = Math.round(ub / 100)
      const mult = rng.chance(0.4)
      const k = rng.int(3, 9)
      if (mult) {
        return numItem({
          prompt: `Estimate ${fmt(a)} × ${k} by rounding ${fmt(a)} to the nearest whole number first.`,
          answer: ra * k,
          hints: ['Round first, then multiply.', `Round ${fmt(a)} to the nearest whole number.`, `The tenths digit of ${fmt(a)} is ${Math.floor(ua / 10) % 10}.`],
          explanation: `${fmt(a)} rounds to ${ra}, and ${ra} × ${k} = ${ra * k}.`,
          solution: [
            { say: 'Round the decimal.', show: `${fmt(a)} → ${ra}` },
            { say: 'Multiply.', show: `${ra} × ${k} = ${ra * k}` },
          ],
        })
      }
      return numItem({
        prompt: `Estimate ${fmt(a)} + ${fmt(b)} by rounding each number to the nearest whole number.`,
        answer: ra + rb,
        hints: ['Round each number first, then add.', `Round ${fmt(a)} and ${fmt(b)} to whole numbers.`, `${fmt(a)} rounds to ${ra}.`],
        explanation: `${fmt(a)} rounds to ${ra} and ${fmt(b)} rounds to ${rb}. ${ra} + ${rb} = ${ra + rb}.`,
        solution: [
          { say: 'Round both numbers.', show: `${fmt(a)} → ${ra}, ${fmt(b)} → ${rb}` },
          { say: 'Add.', show: `${ra} + ${rb} = ${ra + rb}` },
        ],
      })
    }

    const t1 = rng.int(11, 99)
    const target = dec(t1, 1)
    const smallest = rng.chance(0.5)
    const ans = smallest ? dec(t1 * 10 - 5, 2) : dec(t1 * 10 + 4, 2)
    return numItem({
      prompt: `A number with two decimal places rounds to ${fx(target, 1)} to one decimal place. What is the ${smallest ? 'smallest' : 'greatest'} it could be?`,
      answer: ans,
      decimal: true,
      hints: [
        `Think about the numbers with two decimal places close to ${fx(target, 1)}.`,
        smallest ? 'A hundredths digit of 5 or more rounds up.' : 'A hundredths digit of 4 or less rounds down.',
        smallest
          ? `Which numbers just below ${fx(target, 1)} round up to it?`
          : `Which numbers just above ${fx(target, 1)} round down to it?`,
      ],
      explanation: smallest
        ? `${fmt(ans)} has 5 hundredths, so it rounds up to ${fx(target, 1)}. ${fmt(dec(t1 * 10 - 6, 2))} would round down.`
        : `${fmt(ans)} has 4 hundredths, so it rounds down to ${fx(target, 1)}. ${fmt(dec(t1 * 10 + 5, 2))} would round up.`,
      solution: [
        { say: smallest ? 'Halfway below rounds up.' : 'Anything below halfway above rounds down.', show: smallest ? `${fmt(dec(t1 * 10 - 5, 2))} → ${fx(target, 1)}` : `${fmt(dec(t1 * 10 + 4, 2))} → ${fx(target, 1)}` },
        { say: 'Check the next number too.', show: smallest ? `${fmt(dec(t1 * 10 - 6, 2))} → ${fx(dec(t1 - 1, 1), 1)}` : `${fmt(dec(t1 * 10 + 5, 2))} → ${fx(dec(t1 + 1, 1), 1)}` },
      ],
      secs: 120,
    })
  },
}

const multiplyDivide10: Generator = {
  skill: 'm5.multiply-divide-10-100-1000',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const f = rng.pick([10, 100, 1000])
    const z = Math.round(Math.log10(f))
    const places = `${z} place${z > 1 ? 's' : ''}`
    if (level === 1) {
      if (rng.chance(0.5)) {
        const n = rng.int(12, 999)
        const ans = n * f
        return numItem({
          prompt: `What is ${fmt(n)} × ${fmt(f)}?`,
          answer: ans,
          hints: [
            `Multiplying by ${fmt(f)} makes a number ${fmt(f)} times bigger.`,
            `Each digit moves ${places} to the left.`,
            `The ones digit ${n % 10} moves to the ${at(PLACE, z)} column.`,
          ],
          explanation: `Each digit of ${fmt(n)} moves ${places} to the left, so ${fmt(n)} × ${fmt(f)} = ${fmt(ans)}.`,
          solution: [
            { say: `Move every digit ${places} to the left.` },
            { say: 'Fill the empty columns with zeros.', show: `${fmt(n)} × ${fmt(f)} = ${fmt(ans)}` },
          ],
        })
      }
      const k = rng.int(12, 999)
      const n = k * f
      return numItem({
        prompt: `What is ${fmt(n)} ÷ ${fmt(f)}?`,
        answer: k,
        hints: [
          `Dividing by ${fmt(f)} makes a number ${fmt(f)} times smaller.`,
          `Each digit moves ${places} to the right.`,
          `The ${at(PLACE, z)} digit of ${fmt(n)} moves to the ones column.`,
        ],
        explanation: `Each digit of ${fmt(n)} moves ${places} to the right, so ${fmt(n)} ÷ ${fmt(f)} = ${fmt(k)}.`,
        solution: [
          { say: `Move every digit ${places} to the right.` },
          { say: 'The zeros at the end drop off.', show: `${fmt(n)} ÷ ${fmt(f)} = ${fmt(k)}` },
        ],
      })
    }

    if (level === 2) {
      const ff = rng.pick([10, 100])
      const zz = Math.round(Math.log10(ff))
      let n = rng.pick([rng.int(1, 9), rng.int(11, 99), rng.int(101, 999)])
      if (n % ff === 0) n += 1
      const ans = dec(n, zz)
      return numItem({
        prompt: `What is ${fmt(n)} ÷ ${fmt(ff)}?`,
        answer: ans,
        decimal: true,
        hints: [
          `Dividing by ${fmt(ff)} makes a number ${fmt(ff)} times smaller.`,
          `Each digit moves ${zz} place${zz > 1 ? 's' : ''} to the right, past the decimal point.`,
          `The ones digit ${n % 10} becomes ${zz === 1 ? 'tenths' : 'hundredths'}.`,
        ],
        explanation: `${fmt(n)} ÷ ${fmt(ff)} = ${fmt(ans)}. Each digit moves ${zz} place${zz > 1 ? 's' : ''} to the right.`,
        solution: [
          { say: 'Write the number in a place value chart.', figure: pvChart(digitsOf(n)) },
          { say: `Move each digit ${zz} place${zz > 1 ? 's' : ''} to the right.`, show: `${fmt(n)} ÷ ${fmt(ff)} = ${fmt(ans)}` },
        ],
      })
    }

    if (level === 3) {
      const dp = rng.pick([1, 2])
      let u = dp === 1 ? rng.int(11, 99) : rng.int(101, 999)
      if (u % 10 === 0) u += 1
      const n = dec(u, dp)
      const ff = dp === 1 ? rng.pick([10, 100]) : rng.pick([10, 100, 1000])
      const ans = dec(u * ff, dp)
      const style = rng.int(0, 2)
      if (style === 0) {
        return numItem({
          prompt: `Find the missing number. ${fmt(n)} × ___ = ${fmt(ans)}`,
          answer: ff,
          hints: [
            `Compare ${fmt(n)} and ${fmt(ans)}. How many places has each digit moved?`,
            'Each place the digits move to the left is one more zero in the multiplier.',
            `Look at where the digit ${at(digitsOf(u), 0)} is in each number.`,
          ],
          explanation: `The digits moved ${Math.round(Math.log10(ff))} place${ff > 10 ? 's' : ''} to the left, so ${fmt(n)} was multiplied by ${fmt(ff)}.`,
          solution: [
            { say: 'Count how many places the digits moved.' },
            { say: 'That tells you the multiplier.', show: `${fmt(n)} × ${fmt(ff)} = ${fmt(ans)}` },
          ],
        })
      }
      const hints: Hints = [
        `Multiplying by ${fmt(ff)} makes ${fmt(n)} ${fmt(ff)} times bigger.`,
        `Move each digit ${Math.round(Math.log10(ff))} place${ff > 10 ? 's' : ''} to the left.`,
        `The first digit after the point, ${digitsOf(u)[String(u).length - dp]}, moves left of the point.`,
      ]
      const explanation = `${fmt(n)} × ${fmt(ff)} = ${fmt(ans)}. The digits move ${Math.round(Math.log10(ff))} place${ff > 10 ? 's' : ''} to the left.`
      const solution: Step[] = [
        { say: 'Write the number in a place value chart.', figure: pvChart(digitsOf(u), dp) },
        { say: 'Move the digits to the left.', show: `${fmt(n)} × ${fmt(ff)} = ${fmt(ans)}` },
      ]
      if (style === 1) {
        const m = mcqFrom(
          rng,
          fmt(ans),
          [
            { value: `${fx(n, dp)}0`, why: `Writing a 0 after the decimal digits does not change the value of ${fmt(n)}.` },
            { value: fmt(dec(u, dp + 1)), why: `That is ${fmt(n)} ÷ 10. Multiplying makes the number bigger.` },
            { value: fmt(dec(u * ff * 10, dp)), why: `That is ${fmt(n)} × ${fmt(ff * 10)}. Count the places again.` },
          ],
          4,
          (v) => v,
        )
        return mcqItem({ prompt: `What is ${fmt(n)} × ${fmt(ff)}?`, ...m, hints, explanation, solution })
      }
      return numItem({ prompt: `What is ${fmt(n)} × ${fmt(ff)}?`, answer: ans, decimal: true, hints, explanation, solution })
    }

    if (level === 4) {
      const conv = rng.pick([
        { a: 'm', b: 'cm', f: 100, up: true },
        { a: 'cm', b: 'm', f: 100, up: false },
        { a: 'kg', b: 'g', f: 1000, up: true },
        { a: 'g', b: 'kg', f: 1000, up: false },
        { a: 'litres', b: 'ml', f: 1000, up: true },
        { a: 'ml', b: 'litres', f: 1000, up: false },
        { a: 'km', b: 'm', f: 1000, up: true },
        { a: 'cm', b: 'mm', f: 10, up: true },
        { a: 'mm', b: 'cm', f: 10, up: false },
      ] as const)
      if (rng.chance(0.3)) {
        const pack = rng.pick([10, 100])
        const each = rng.int(2, 9) * 500
        const total = each * pack
        const item = rng.pick(['pencils', 'erasers', 'stickers', 'rulers'] as const)
        return numItem({
          prompt: `A box of ${pack} ${item} costs ${rupiah(total)}. Each one costs the same. How much does one cost, in rupiah?`,
          answer: each,
          hints: ['You need to share the cost equally.', `Divide the total by ${pack}.`, `Each digit moves ${pack === 10 ? 'one place' : 'two places'} to the right.`],
          explanation: `${rupiah(total)} ÷ ${pack} = ${rupiah(each)}.`,
          solution: [
            { say: `Share the cost between ${pack} ${item}.` },
            { say: 'Divide.', show: `${fmt(total)} ÷ ${pack} = ${fmt(each)}` },
          ],
          tags: [WP],
        })
      }
      let value: number
      let ans: number
      if (conv.up) {
        const dp = rng.pick([1, 2])
        let u = dp === 1 ? rng.int(11, 99) : rng.int(101, 999)
        if (u % 10 === 0) u += 1
        value = dec(u, dp)
        ans = dec(u * conv.f, dp)
      } else {
        const u = conv.f === 1000 ? rng.int(1, 95) * 10 : rng.int(5, 950)
        value = u
        ans = dec(u, Math.round(Math.log10(conv.f)))
      }
      return numItem({
        prompt: `Convert ${fmt(value)} ${conv.a} to ${conv.b}.`,
        answer: ans,
        decimal: true,
        unit: conv.b,
        hints: [
          `How many ${conv.up ? conv.b : conv.a} are in 1 ${(conv.up ? conv.a : conv.b).replace(/s$/, '')}?`,
          `1 ${conv.up ? conv.a.replace(/s$/, '') : conv.b.replace(/s$/, '')} = ${fmt(conv.f)} ${conv.up ? conv.b : conv.a}. So ${conv.up ? 'multiply' : 'divide'} by ${fmt(conv.f)}.`,
          `${conv.up ? 'Multiplying' : 'Dividing'} by ${fmt(conv.f)} moves each digit ${Math.round(Math.log10(conv.f))} place${conv.f > 10 ? 's' : ''} to the ${conv.up ? 'left' : 'right'}.`,
        ],
        explanation: `${fmt(value)} ${conv.up ? '×' : '÷'} ${fmt(conv.f)} = ${fmt(ans)}, so ${fmt(value)} ${conv.a} = ${fmt(ans)} ${conv.b}.`,
        solution: [
          { say: `1 ${conv.up ? conv.a.replace(/s$/, '') : conv.b.replace(/s$/, '')} = ${fmt(conv.f)} ${conv.up ? conv.b : conv.a}.` },
          { say: conv.up ? 'Multiply.' : 'Divide.', show: `${fmt(value)} ${conv.up ? '×' : '÷'} ${fmt(conv.f)} = ${fmt(ans)}` },
        ],
      })
    }

    // level 5
    if (rng.chance(0.5)) {
      const ff = rng.pick([10, 100, 1000])
      const zz = Math.round(Math.log10(ff))
      const u = ff === 1000 ? rng.int(1, 99) * 10 : rng.int(1, 99)
      const result = u / ff
      return numItem({
        prompt: `Find the missing number. ___ ÷ ${fmt(ff)} = ${fmt(result)}`,
        answer: u,
        decimal: true,
        hints: [
          'Use the inverse. What undoes dividing?',
          `Multiply ${fmt(result)} by ${fmt(ff)}.`,
          `Each digit of ${fmt(result)} moves ${zz} place${zz > 1 ? 's' : ''} to the left.`,
        ],
        explanation: `${fmt(result)} × ${fmt(ff)} = ${fmt(u)}, so ${fmt(u)} ÷ ${fmt(ff)} = ${fmt(result)}.`,
        solution: [
          { say: 'Multiplying undoes dividing.' },
          { say: 'Multiply the answer by the divisor.', show: `${fmt(result)} × ${fmt(ff)} = ${fmt(u)}` },
        ],
      })
    }
    const u = rng.int(11, 99)
    const n = dec(u, 2)
    const a = rng.pick([100, 1000])
    const b = rng.pick([10, 100].filter((x) => x < a))
    const mid = dec(u * a, 2)
    const ans = dec((u * a) / b, 2)
    return numItem({
      prompt: `What is ${fmt(n)} × ${fmt(a)} ÷ ${fmt(b)}?`,
      answer: ans,
      decimal: true,
      hints: ['Work from left to right.', `First multiply ${fmt(n)} by ${fmt(a)}.`, `Then divide that answer by ${fmt(b)}.`],
      explanation: `${fmt(n)} × ${fmt(a)} = ${fmt(mid)}, and ${fmt(mid)} ÷ ${fmt(b)} = ${fmt(ans)}.`,
      solution: [
        { say: 'Multiply first.', show: `${fmt(n)} × ${fmt(a)} = ${fmt(mid)}` },
        { say: 'Then divide.', show: `${fmt(mid)} ÷ ${fmt(b)} = ${fmt(ans)}` },
      ],
    })
  },
}

/* ------------------------------------------------------------------ */
/* Ni dan Nc: bilangan bulat, barisan, operasi hitung                  */
/* ------------------------------------------------------------------ */

export const deg = (v: number): string => `${v} °C`

/** Bilangan negatif dalam kurung untuk pengurangan: 6 − (-4). */
export const par = (v: number): string => (v < 0 ? `(${v})` : String(v))

export function thermo(v: number): Fig {
  const min = Math.min(-20, Math.floor(v / 5) * 5 - 5)
  const max = Math.max(20, Math.ceil(v / 5) * 5 + 5)
  return { kind: 'thermometer', min, max, value: v, step: 5, alt: `A thermometer showing ${deg(v)}.` }
}

/** Garis bilangan dengan satu loncatan dari `from` ke `to`. */
export function jumpLine(from: number, to: number, label?: string): Fig {
  const lo = Math.min(from, to, 0) - 1
  const hi = Math.max(from, to, 0) + 1
  const step = hi - lo > 30 ? 5 : 1
  const min = Math.floor(lo / step) * step
  const max = Math.ceil(hi / step) * step
  return {
    kind: 'numberline',
    min,
    max,
    step,
    labels: max - min > 20 ? [min, 0, max] : 'all',
    jumps: [{ from, to, ...(label ? { label } : {}) }],
    alt: `A number line from ${min} to ${max} with a jump from ${from} to ${to}.`,
  }
}

const negativeNumbers: Generator = {
  skill: 'm5.negative-numbers',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level === 1) {
      if (rng.chance(0.5)) {
        const v = rng.int(-9, -1)
        return lineItem({
          prompt: `Mark ${v} on the number line.`,
          min: -10,
          max: 10,
          step: 1,
          answer: v,
          hints: ['Negative numbers are to the left of 0.', 'The further left you go, the smaller the number.', `Start at 0 and count ${-v} steps to the left.`],
          explanation: `${v} is ${-v} steps to the left of 0.`,
          solution: [{ say: 'Find 0 first.' }, { say: `Count ${-v} steps to the left.`, show: `0 → ${v}` }],
        })
      }
      const coldest = rng.chance(0.6)
      const negs = rng.sample([-12, -9, -8, -7, -5, -4, -3, -2, -1], rng.int(2, 3))
      const vals = [...negs, ...rng.sample([0, 2, 3, 5, 6, 8], 4 - negs.length)]
      const target = coldest ? Math.min(...vals) : Math.max(...vals)
      const sorted = [...vals].sort((a, b) => a - b)
      const m = mcqFrom(
        rng,
        deg(target),
        vals.filter((v) => v !== target).map((v) => ({ value: deg(v), why: coldest ? `${deg(v)} is warmer than ${deg(target)}.` : `${deg(v)} is colder than ${deg(target)}.` })),
        4,
        (x) => x,
      )
      return mcqItem({
        prompt: `Which temperature is the ${coldest ? 'coldest' : 'warmest'}?`,
        ...m,
        hints: [
          'Picture the temperatures on a thermometer.',
          'Below 0, the bigger the number after the minus sign, the colder it is.',
          coldest ? 'Look at the temperatures below 0 first.' : 'Look at the temperatures that are 0 or above first.',
        ],
        explanation: `From coldest to warmest: ${sorted.map(deg).join(', ')}. The ${coldest ? 'coldest' : 'warmest'} is ${deg(target)}.`,
        solution: [
          { say: 'Put the temperatures on a number line.', figure: { kind: 'numberline', min: -15, max: 10, step: 1, labels: [-15, -10, -5, 0, 5, 10], marks: vals.map((v) => ({ at: v, label: String(v) })), alt: `A number line from -15 to 10 with ${vals.join(', ')} marked.` } },
          { say: `The ${coldest ? 'coldest is furthest left' : 'warmest is furthest right'}.`, show: deg(target) },
        ],
      })
    }

    if (level === 2) {
      const cross = rng.chance(0.7)
      const fall = rng.chance(0.5)
      let s: number
      let c: number
      if (fall) {
        if (cross) {
          s = rng.int(1, 8)
          c = rng.int(s + 1, s + 9)
        } else {
          s = rng.int(-8, -1)
          c = rng.int(2, 9)
        }
      } else if (cross) {
        s = rng.int(-9, -1)
        c = rng.int(-s + 1, -s + 9)
      } else {
        s = rng.int(-15, -6)
        c = rng.int(2, -s - 1)
      }
      const ans = fall ? s - c : s + c
      const op = fall ? '−' : '+'
      return numItem({
        prompt: `The temperature is ${deg(s)}. It ${fall ? 'falls' : 'rises'} by ${c} degrees. What is the temperature now?`,
        answer: ans,
        negative: true,
        unit: '°C',
        figure: thermo(s),
        hints: cross
          ? [`Start at ${deg(s)} and count ${fall ? 'down' : 'up'} ${c} degrees.`, 'Count to 0 first, then count the rest.', `From ${deg(s)} to 0 is ${Math.abs(s)} degrees.`]
          : [
              `Start at ${deg(s)} and count ${fall ? 'down' : 'up'} ${c} degrees.`,
              fall ? 'Falling makes it colder, so the number after the minus sign gets bigger.' : 'Rising makes it warmer, so it moves towards 0.',
              `Count ${fall ? 'down' : 'up'} one degree at a time from ${deg(s)}.`,
            ],
        explanation: `${s} ${op} ${c} = ${ans}, so the temperature is now ${deg(ans)}.`,
        solution: [
          { say: `Start at ${deg(s)}.`, figure: jumpLine(s, ans, `${op}${c}`) },
          cross
            ? { say: `${Math.abs(s)} degrees takes you to 0. Then count ${c - Math.abs(s)} more.`, show: `${s} ${op} ${c} = ${ans}` }
            : { say: `Count ${c} degrees ${fall ? 'down' : 'up'}.`, show: `${s} ${op} ${c} = ${ans}` },
        ],
        tags: [WP],
      })
    }

    if (level === 3) {
      const style = rng.int(0, 2)
      if (style === 0) {
        const low = rng.int(-12, -1)
        const high = rng.int(1, 15)
        return numItem({
          prompt: `At night the temperature was ${deg(low)}. At midday it was ${deg(high)}. How many degrees warmer was it at midday?`,
          answer: high - low,
          unit: 'degrees',
          hints: [
            'Picture both temperatures on a thermometer.',
            `Count from ${deg(low)} up to 0, then from 0 up to ${deg(high)}.`,
            `From ${deg(low)} up to 0 is ${-low} degrees.`,
          ],
          explanation: `${-low} degrees up to 0, then ${high} more: ${-low} + ${high} = ${high - low} degrees.`,
          solution: [
            { say: `From ${deg(low)} to 0 is ${-low} degrees.`, figure: jumpLine(low, high) },
            { say: `From 0 to ${deg(high)} is ${high} degrees.`, show: `${-low} + ${high} = ${high - low}` },
          ],
          tags: [WP],
        })
      }
      if (style === 1) {
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
        const temps = [rng.int(-9, -2), rng.int(-5, 3), rng.int(1, 9), rng.int(-3, 6), rng.int(-7, 2)]
        const shuffled = rng.shuffle(temps)
        const hi = Math.max(...shuffled)
        const lo = Math.min(...shuffled)
        return numItem({
          prompt: 'The table shows the midday temperature in a mountain village. What is the difference between the highest and the lowest temperature?',
          answer: hi - lo,
          unit: 'degrees',
          figure: { kind: 'table', head: ['Day', 'Temperature (°C)'], rows: days.map((d, i) => [d, String(at(shuffled, i))]), alt: `Table of temperatures: ${days.map((d, i) => `${d} ${deg(at(shuffled, i))}`).join(', ')}.` },
          hints: [
            'Find the highest and the lowest temperature first.',
            'Count the degrees between them on a number line, going through 0 if you need to.',
            `The lowest temperature is ${deg(lo)}.`,
          ],
          explanation: `The highest is ${deg(hi)} and the lowest is ${deg(lo)}. From ${lo} up to 0 is ${-lo} degrees and from 0 up to ${hi} is ${hi} degrees, so the difference is ${hi - lo} degrees.`,
          solution: [
            { say: `Highest ${deg(hi)}, lowest ${deg(lo)}.`, figure: jumpLine(lo, hi) },
            { say: 'Count the gap through 0.', show: `${-lo} + ${hi} = ${hi - lo}` },
          ],
        })
      }
      const set = new Set<number>()
      while (set.size < 5) set.add(rng.int(-15, 12))
      const vals = [...set]
      const asc = [...vals].sort((a, b) => a - b)
      const desc = rng.chance(0.4)
      const items = (desc ? [...asc].reverse() : asc).map(String)
      return orderItem({
        prompt: `Put these numbers in order, starting with the ${desc ? 'largest' : 'smallest'}.`,
        items,
        hints: [
          'Picture the numbers on a number line.',
          'Negative numbers are less than 0. The further from 0, the smaller they are.',
          desc ? 'Find the number furthest to the right on a number line first.' : 'Find the number furthest to the left on a number line first.',
        ],
        explanation: `In order: ${items.join(', ')}.`,
        solution: [
          { say: 'Place each number on a number line.', figure: { kind: 'numberline', min: -15, max: 15, step: 1, labels: [-15, -10, -5, 0, 5, 10, 15], marks: vals.map((v) => ({ at: v, label: String(v) })), alt: `A number line with ${vals.join(', ')} marked.` } },
          { say: 'Read them from left to right.', show: asc.join(' < ') },
        ],
      })
    }

    if (level === 4) {
      const form = rng.int(0, 3)
      let a: number
      let b: number
      let op: '+' | '−'
      if (form === 0) {
        a = rng.int(-15, -2)
        b = rng.int(-a + 1, -a + 12)
        op = '+'
      } else if (form === 1) {
        a = rng.int(2, 12)
        b = rng.int(a + 1, a + 12)
        op = '−'
      } else if (form === 2) {
        a = rng.int(-12, -1)
        b = rng.int(2, 12)
        op = '−'
      } else {
        a = rng.int(-20, -8)
        b = rng.int(2, -a - 1)
        op = '+'
      }
      const ans = op === '+' ? a + b : a - b
      const crosses = (a < 0 && ans > 0) || (a > 0 && ans < 0)
      const hints: Hints = [
        `Start at ${a} on a number line.`,
        `${op === '+' ? 'Adding' : 'Subtracting'} ${b} means moving ${b} steps to the ${op === '+' ? 'right' : 'left'}.`,
        crosses ? `From ${a}, it takes ${Math.abs(a)} steps to reach 0.` : `Move ${b} steps to the ${op === '+' ? 'right' : 'left'} of ${a}.`,
      ]
      const explanation = `Start at ${a} and move ${b} to the ${op === '+' ? 'right' : 'left'}. You land on ${ans}.`
      const solution: Step[] = [
        { say: `Start at ${a}.`, figure: jumpLine(a, ans, `${op}${b}`) },
        crosses
          ? { say: `${Math.abs(a)} steps take you to 0, then ${b - Math.abs(a)} more.`, show: `${a} ${op} ${b} = ${ans}` }
          : { say: `Move ${b} steps.`, show: `${a} ${op} ${b} = ${ans}` },
      ]
      if (rng.chance(0.4)) {
        const m = mcqFrom(rng, ans, [
          { value: -ans, why: `Check the direction. ${op === '+' ? 'Adding moves right.' : 'Subtracting moves left.'}` },
          { value: Math.abs(a) + b, why: `That adds ${Math.abs(a)} and ${b} and forgets the signs.` },
          { value: ans + (op === '+' ? -1 : 1), why: 'Count the steps again, one at a time.' },
          { value: Math.abs(Math.abs(a) - b), why: 'That finds the gap between the numbers and forgets the sign.' },
        ])
        return mcqItem({ prompt: `What is ${a} ${op} ${b}?`, ...m, hints, explanation, solution })
      }
      return numItem({ prompt: `Work out ${a} ${op} ${b}.`, answer: ans, negative: true, hints, explanation, solution })
    }

    if (rng.chance(0.5)) {
      const s = rng.int(-10, -2)
      const r = rng.int(-s + 2, -s + 14)
      const noon = s + r
      const f = rng.int(noon + 1, noon + 10)
      const ans = noon - f
      return numItem({
        prompt: `At 06:00 the temperature was ${deg(s)}. By noon it had risen by ${r} degrees. By midnight it had fallen by ${f} degrees from noon. What was the temperature at midnight?`,
        answer: ans,
        negative: true,
        unit: '°C',
        hints: ['Work out the temperature at noon first.', 'Then count down from the noon temperature.', `${s} + ${r} gives the noon temperature.`],
        explanation: `At noon: ${s} + ${r} = ${noon}. At midnight: ${noon} − ${f} = ${ans}. So it was ${deg(ans)}.`,
        solution: [
          { say: 'Find the noon temperature.', show: `${s} + ${r} = ${noon}`, figure: jumpLine(s, noon, `+${r}`) },
          { say: 'Then the midnight temperature.', show: `${noon} − ${f} = ${ans}`, figure: jumpLine(noon, ans, `−${f}`) },
        ],
        tags: [WP],
        secs: 150,
      })
    }
    let a = rng.int(-15, -1)
    let b = rng.int(1, 15)
    if ((a + b) % 2 !== 0) b += 1
    if (b > 15) {
      b -= 2
      if (b <= 0) b = 1
      if ((a + b) % 2 !== 0) a -= 1
    }
    const mid = (a + b) / 2
    return numItem({
      prompt: `Which number is exactly halfway between ${a} and ${b}?`,
      answer: mid,
      negative: true,
      hints: [
        'Halfway is the same distance from both numbers.',
        `Find the gap from ${a} to ${b} first.`,
        `The gap from ${a} to ${b} is ${b - a}.`,
      ],
      explanation: `The gap is ${b - a}. Half of it is ${(b - a) / 2}, and ${a} + ${(b - a) / 2} = ${mid}.`,
      solution: [
        { say: 'Find the gap.', show: `${b} − ${a} = ${b - a}`, figure: jumpLine(a, b) },
        { say: 'Move half the gap from the smaller number.', show: `${a} + ${(b - a) / 2} = ${mid}` },
      ],
    })
  },
}

export const ORD = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}

const sequences: Generator = {
  skill: 'm5.sequences',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const seqFig = (items: (string | null)[]): Fig => ({
      kind: 'sequence',
      items,
      style: 'boxes',
      alt: `A sequence: ${items.map((x) => x ?? 'a missing number').join(', ')}.`,
    })

    if (level <= 2) {
      let terms: number[]
      let dp = 0
      let decreasing = false
      if (level === 1) {
        const d = rng.pick([15, 25, 35, 45, 50, 75, 125, 250])
        const a = rng.int(2, 60) * 5
        terms = [0, 1, 2, 3, 4].map((i) => a + i * d)
      } else if (rng.chance(0.5)) {
        const d = rng.int(3, 9)
        const a = rng.int(2 * d + 1, 3 * d - 1)
        terms = [0, 1, 2, 3, 4].map((i) => a - i * d)
        decreasing = true
      } else {
        const du = rng.pick([20, 25, 50, 150, 30])
        const au = rng.int(1, 40) * 5 + 100
        dp = 2
        terms = [0, 1, 2, 3, 4].map((i) => dec(au + i * du, 2))
      }
      const miss = level === 1 ? rng.pick([4, 4, 1, 2]) : rng.pick([4, 4, 3])
      const ans = at(terms, miss)
      const shown = terms.map((t, i) => (i === miss ? null : fmt(t)))
      const known = miss >= 2 ? 0 : 2
      const t0 = at(terms, known)
      const t1 = at(terms, known + 1)
      const diff = dp > 0 ? dec(Math.abs(units(t1, 2) - units(t0, 2)), 2) : Math.abs(t1 - t0)
      return numItem({
        prompt: `What is the missing number in this sequence? ${shown.map((x) => x ?? '___').join(', ')}`,
        answer: ans,
        decimal: dp > 0,
        negative: ans < 0,
        figure: seqFig(shown),
        hints: [
          'Find the difference between two terms that are next to each other.',
          decreasing ? `Work out ${fmt(t0)} − ${fmt(t1)}.` : `Work out ${fmt(t1)} − ${fmt(t0)}.`,
          miss === 4 ? `The last term you can see is ${fmt(at(terms, 3))}.` : `Use the term before the gap: ${fmt(at(terms, miss - 1))}.`,
        ],
        explanation: `The terms ${decreasing ? 'go down' : 'go up'} by ${fmt(diff)} each time, so the missing number is ${fmt(ans)}.`,
        solution: [
          { say: `Find the step: ${decreasing ? 'subtract' : 'add'} ${fmt(diff)}.`, figure: seqFig(shown) },
          { say: 'Use the step to fill the gap.', show: terms.map(fmt).join(', ') },
        ],
      })
    }

    if (level === 3) {
      const up = rng.chance(0.6)
      const d = rng.int(3, 12)
      let a = up ? rng.int(2, 40) : rng.int(4 * d + 3, 4 * d + 60)
      if (a === d || a === 2 * d) a += 1
      const terms = [0, 1, 2, 3].map((i) => (up ? a + i * d : a - i * d))
      const t0 = at(terms, 0)
      const t1 = at(terms, 1)
      if (rng.chance(0.5)) {
        const correct = up ? `add ${d}` : `subtract ${d}`
        const m = mcqText(rng, correct, [
          { value: up ? `subtract ${d}` : `add ${d}`, why: up ? 'The numbers get bigger, so the rule cannot be subtract.' : 'The numbers get smaller, so the rule cannot be add.' },
          { value: up ? `add ${d + 1}` : `subtract ${d + 1}`, why: `${t0} ${up ? '+' : '−'} ${d + 1} = ${up ? t0 + d + 1 : t0 - d - 1}, not ${t1}.` },
          { value: up ? `add ${d - 1}` : `subtract ${d - 1}`, why: `${t0} ${up ? '+' : '−'} ${d - 1} = ${up ? t0 + d - 1 : t0 - d + 1}, not ${t1}.` },
          up
            ? { value: 'multiply by 2', why: `${t0} × 2 = ${t0 * 2}, not ${t1}.` }
            : { value: 'divide by 2', why: `${t0} ÷ 2 = ${fmt(t0 / 2)}, not ${t1}.` },
        ])
        return mcqItem({
          prompt: `What is the term-to-term rule for this sequence? ${terms.join(', ')}, ...`,
          ...m,
          figure: seqFig([...terms.map(String), '...']),
          hints: ['Do the numbers get bigger or smaller?', 'Find the difference between neighbouring terms.', `Work out the gap between ${t0} and ${t1}.`],
          explanation: `Each term is ${d} ${up ? 'more' : 'less'} than the one before, so the rule is ${correct}.`,
          solution: [
            { say: `The numbers get ${up ? 'bigger' : 'smaller'}.` },
            { say: 'Check the gap between each pair.', show: `${t0} ${up ? '+' : '−'} ${d} = ${t1}` },
          ],
        })
      }
      const n = rng.int(6, 12)
      const first = rng.int(2, 20)
      const ans = first + (n - 1) * d
      return numItem({
        prompt: `The first term of a sequence is ${first}. The rule is add ${d}. What is the ${ORD(n)} term?`,
        answer: ans,
        hints: [
          'You could write out the terms, or count the steps.',
          `From the 1st term to the ${ORD(n)} term there are ${n - 1} steps.`,
          `${n - 1} steps of ${d} is ${(n - 1) * d}.`,
        ],
        explanation: `The ${ORD(n)} term is ${first} + ${n - 1} × ${d} = ${first} + ${(n - 1) * d} = ${ans}.`,
        solution: [
          { say: `Count the steps: ${n} − 1 = ${n - 1}.` },
          { say: 'Add that many steps to the first term.', show: `${first} + ${n - 1} × ${d} = ${ans}` },
        ],
      })
    }

    if (level === 4) {
      if (rng.chance(0.5)) {
        const squares = rng.chance(0.5)
        const start = rng.int(1, 5)
        const ks = [0, 1, 2, 3, 4, 5].map((i) => start + i)
        const terms = ks.map((k) => (squares ? k * k : (k * (k + 1)) / 2))
        const miss = rng.int(2, 5)
        const ans = at(terms, miss)
        const shown = terms.map((t, i) => (i === miss ? null : String(t)))
        const knownK = at(ks, miss === 5 ? 4 : 5)
        return numItem({
          prompt: `What is the missing number? ${shown.map((x) => x ?? '___').join(', ')}`,
          answer: ans,
          figure: seqFig(shown),
          hints: [
            'Look at the differences between the terms. Do they change?',
            squares ? 'These are square numbers: 1 × 1, 2 × 2, 3 × 3, and so on.' : 'The differences go up by 1 each time. These are triangular numbers.',
            squares ? `${knownK} × ${knownK} = ${knownK * knownK}.` : `The difference between ${at(terms, 0)} and ${at(terms, 1)} is ${at(terms, 1) - at(terms, 0)}.`,
          ],
          explanation: squares
            ? `These are square numbers. The missing one is ${at(ks, miss)} × ${at(ks, miss)} = ${ans}.`
            : `These are triangular numbers. The differences go up by 1, so the missing number is ${ans}.`,
          solution: [
            { say: 'Look at the differences.', show: terms.slice(1).map((t, i) => t - at(terms, i)).join(', ') },
            { say: squares ? 'Each term is a number multiplied by itself.' : 'Each difference is 1 more than the last.', show: terms.join(', ') },
          ],
        })
      }
      const q = rng.pick([2, 3, 4, 5])
      const s0 = rng.int(1, q)
      const fr = [0, 1, 2, 3, 4].map((i) => ({ n: s0 + i, d: q }))
      const shownText = fr.slice(0, 4).map((f) => mixed(simp(f)))
      const next = at(fr, 4)
      return textItem({
        prompt: `What is the next term? ${shownText.join(', ')}, ___`,
        answers: [fracAnswers(next, { decimal: true })],
        figure: seqFig([...shownText, null]),
        hints: [
          'Find how much the sequence goes up each time.',
          `The terms go up by 1/${q} each time.`,
          `Add 1/${q} to ${at(shownText, 3)}.`,
        ],
        explanation: `The rule is add 1/${q}. ${at(shownText, 3)} + 1/${q} = ${mixed(simp(next))}.`,
        solution: [
          { say: `Write every term in ${q === 2 ? 'halves' : q === 3 ? 'thirds' : q === 4 ? 'quarters' : 'fifths'}.`, show: fr.slice(0, 4).map(fs).join(', ') },
          { say: `Add one more 1/${q}.`, show: `${fs(next)} = ${mixed(simp(next))}` },
        ],
      })
    }

    if (rng.chance(0.5)) {
      const a = rng.int(2, 15)
      const d = rng.int(3, 9)
      const k = rng.int(9, 20)
      const target = a + (k - 1) * d
      const terms = [0, 1, 2, 3].map((i) => a + i * d)
      return numItem({
        prompt: `This sequence continues: ${terms.join(', ')}, ... Which term is ${target}? For example, ${a} is the 1st term.`,
        answer: k,
        hints: ['Find the rule first.', `How many steps of ${d} does it take to get from ${a} to ${target}?`, `${target} − ${a} = ${target - a}.`],
        explanation: `${target} − ${a} = ${target - a}, and ${target - a} ÷ ${d} = ${k - 1} steps. So ${target} is the ${ORD(k)} term.`,
        solution: [
          { say: 'Find how far it is from the first term.', show: `${target} − ${a} = ${target - a}` },
          { say: `Divide by the step, ${d}, then add 1 for the first term.`, show: `${target - a} ÷ ${d} + 1 = ${k}` },
        ],
        secs: 120,
      })
    }
    const shape = rng.pick([
      { name: 'squares', a: 4, d: 3 },
      { name: 'triangles', a: 3, d: 2 },
      { name: 'pentagons', a: 5, d: 4 },
      { name: 'hexagons', a: 6, d: 5 },
    ] as const)
    const N = rng.int(8, 20)
    const ans = shape.a + (N - 1) * shape.d
    const t = [0, 1, 2].map((i) => shape.a + i * shape.d)
    const maker = rng.pick(NAMES)
    return numItem({
      prompt: `${maker} makes a row of ${shape.name} with sticks. Pattern 1 uses ${at(t, 0)} sticks, pattern 2 uses ${at(t, 1)} and pattern 3 uses ${at(t, 2)}. How many sticks does pattern ${N} use?`,
      answer: ans,
      figure: seqFig([String(at(t, 0)), String(at(t, 1)), String(at(t, 2)), '...']),
      hints: [
        'How many sticks are added each time?',
        `Each new pattern adds ${shape.d} sticks. From pattern 1 to pattern ${N} there are ${N - 1} steps.`,
        `${N - 1} × ${shape.d} = ${(N - 1) * shape.d}.`,
      ],
      explanation: `Pattern ${N} uses ${shape.a} + ${N - 1} × ${shape.d} = ${ans} sticks.`,
      solution: [
        { say: `Each pattern adds ${shape.d} sticks.`, show: t.join(', ') },
        { say: `Start with ${shape.a} and add ${N - 1} lots of ${shape.d}.`, show: `${shape.a} + ${N - 1} × ${shape.d} = ${ans}` },
      ],
      tags: [WP],
      secs: 150,
    })
  },
}

const mentalAddSubtract: Generator = {
  skill: 'm5.mental-add-subtract',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level === 1) {
      const add = rng.chance(0.5)
      let a = rng.int(12, 89) * 100
      let b = rng.int(11, 79) * 100
      if (!add && b > a) [a, b] = [b, a]
      if (!add && a === b) a += 500
      const ans = add ? a + b : a - b
      const op = add ? '+' : '−'
      return numItem({
        prompt: `Work out ${fmt(a)} ${op} ${fmt(b)} in your head.`,
        answer: ans,
        hints: [
          'Think of each number as a number of hundreds.',
          `${fmt(a)} is ${a / 100} hundreds and ${fmt(b)} is ${b / 100} hundreds.`,
          `Work out ${a / 100} ${op} ${b / 100} first.`,
        ],
        explanation: `${a / 100} ${op} ${b / 100} = ${ans / 100}, so ${fmt(a)} ${op} ${fmt(b)} = ${fmt(ans)}.`,
        solution: [
          { say: 'Count in hundreds.', show: `${a / 100} ${op} ${b / 100} = ${ans / 100}` },
          { say: 'Put the hundreds back.', show: `${fmt(a)} ${op} ${fmt(b)} = ${fmt(ans)}` },
        ],
      })
    }

    if (level === 2) {
      const c = rng.pick([100, 1000, 200, 2000, 300])
      const k = rng.pick([1, 1, 2])
      const b = c - k
      const add = rng.chance(0.5)
      const a = rng.int(2100, 9800)
      const ans = add ? a + b : a - b
      const mid = add ? a + c : a - c
      return numItem({
        prompt: `Work out ${fmt(a)} ${add ? '+' : '−'} ${fmt(b)} in your head.`,
        answer: ans,
        hints: [
          `${fmt(b)} is close to ${fmt(c)}.`,
          add ? `Add ${fmt(c)}, then take away ${k}.` : `Take away ${fmt(c)}, then add ${k} back.`,
          `${fmt(a)} ${add ? '+' : '−'} ${fmt(c)} = ${fmt(mid)}.`,
        ],
        explanation: `${fmt(a)} ${add ? '+' : '−'} ${fmt(c)} = ${fmt(mid)}, then ${add ? `− ${k}` : `+ ${k}`} gives ${fmt(ans)}.`,
        solution: [
          { say: `Use ${fmt(c)} instead of ${fmt(b)}.`, show: `${fmt(a)} ${add ? '+' : '−'} ${fmt(c)} = ${fmt(mid)}` },
          { say: add ? `You added ${k} too many, so take ${k} away.` : `You took away ${k} too many, so add ${k} back.`, show: `${fmt(mid)} ${add ? '−' : '+'} ${k} = ${fmt(ans)}` },
        ],
        tip: 'Round a number to make it easy, then adjust.',
      })
    }

    if (level === 3) {
      if (rng.chance(0.5)) {
        const target = rng.pick([1, 10])
        const u = target === 1 ? rng.int(11, 89) : rng.int(111, 899)
        const fixedU = u % 10 === 0 ? u + 3 : u
        const x = dec(fixedU, 2)
        const ans = dec(target * 100 - fixedU, 2)
        const nextStop = target === 1 ? dec(Math.ceil(fixedU / 10) * 10, 2) : Math.ceil(x)
        const gap1 = dec(units(nextStop, 2) - fixedU, 2)
        return numItem({
          prompt: `What must be added to ${fmt(x)} to make ${target}?`,
          answer: ans,
          decimal: true,
          hints: [
            'Count on from the smaller number in jumps.',
            target === 1 ? 'Jump to the next tenth, then jump to 1.' : 'Jump to the next whole number, then jump to 10.',
            `From ${fmt(x)} to ${fmt(nextStop)} is ${fmt(gap1)}.`,
          ],
          explanation: `${fmt(x)} + ${fmt(gap1)} = ${fmt(nextStop)}, and ${fmt(nextStop)} + ${fmt(dec(target * 100 - units(nextStop, 2), 2))} = ${target}. Altogether ${fmt(ans)}.`,
          solution: [
            { say: `Jump to ${fmt(nextStop)}.`, show: `${fmt(x)} + ${fmt(gap1)} = ${fmt(nextStop)}` },
            { say: `Jump to ${target}.`, show: `${fmt(nextStop)} + ${fmt(dec(target * 100 - units(nextStop, 2), 2))} = ${target}` },
            { say: 'Add the two jumps.', show: `${fmt(gap1)} + ${fmt(dec(target * 100 - units(nextStop, 2), 2))} = ${fmt(ans)}` },
          ],
        })
      }
      const w1 = rng.int(1, 9)
      const w2 = rng.int(1, 9)
      const t1 = rng.int(3, 9)
      const t2 = rng.int(11 - t1, 9)
      const a = dec(w1 * 10 + t1, 1)
      const b = dec(w2 * 10 + t2, 1)
      const ans = dec(w1 * 10 + t1 + w2 * 10 + t2, 1)
      return numItem({
        prompt: `Work out ${fmt(a)} + ${fmt(b)} in your head.`,
        answer: ans,
        decimal: true,
        hints: ['Split each number into wholes and tenths.', 'Add the whole numbers, then add the tenths.', `${w1} + ${w2} = ${w1 + w2}.`],
        explanation: `${w1} + ${w2} = ${w1 + w2} and ${t1} tenths + ${t2} tenths = ${t1 + t2} tenths, which is 1 and ${fmt(dec(t1 + t2 - 10, 1))}. So the answer is ${fmt(ans)}.`,
        solution: [
          { say: 'Add the wholes.', show: `${w1} + ${w2} = ${w1 + w2}` },
          { say: 'Add the tenths. 10 tenths make 1 whole.', show: `0.${t1} + 0.${t2} = ${fmt(dec(t1 + t2, 1))}` },
          { say: 'Put them together.', show: `${w1 + w2} + ${fmt(dec(t1 + t2, 1))} = ${fmt(ans)}` },
        ],
      })
    }

    if (level === 4) {
      if (rng.chance(0.35)) {
        const a = rng.int(2100, 8700)
        const c = rng.pick([1000, 2000, 3000])
        const k = rng.pick([1, 2])
        const b = c - k
        const correct = `${fmt(a)} + ${fmt(c)} − ${k}`
        const m = mcqText(rng, correct, [
          { value: `${fmt(a)} + ${fmt(c)} + ${k}`, why: `${fmt(b)} is ${k} less than ${fmt(c)}, so take ${k} away after adding ${fmt(c)}.` },
          { value: `${fmt(a)} − ${fmt(c)} + ${k}`, why: `The question is an addition, so add ${fmt(c)}.` },
          { value: `${fmt(a)} + ${fmt(c - 1000 || 100)} − ${k}`, why: `${fmt(b)} is close to ${fmt(c)}.` },
        ])
        return mcqItem({
          prompt: `Which is a good way to work out ${fmt(a)} + ${fmt(b)} in your head?`,
          ...m,
          hints: [`${fmt(b)} is very close to a round number.`, `Which round number is ${fmt(b)} close to?`, `${fmt(b)} + ${k} = ${fmt(c)}.`],
          explanation: `${fmt(b)} = ${fmt(c)} − ${k}, so add ${fmt(c)} and then take away ${k}.`,
          solution: [
            { say: `Swap ${fmt(b)} for ${fmt(c)} − ${k}.` },
            { say: 'Add the round number, then adjust.', show: `${correct} = ${fmt(a + b)}` },
          ],
        })
      }
      const form = rng.int(0, 2)
      const b = rng.int(12, 59) * 50
      const c = rng.int(12, 89) * 50
      let prompt: string
      let ans: number
      let hint3: string
      let calc: string
      if (form === 0) {
        ans = b + c
        prompt = `Find the missing number. ___ − ${fmt(b)} = ${fmt(c)}`
        hint3 = `Start with ${fmt(c)} + ${fmt(Math.floor(b / 1000) * 1000 || Math.floor(b / 100) * 100)}.`
        calc = `${fmt(c)} + ${fmt(b)} = ${fmt(ans)}`
      } else if (form === 1) {
        const a = Math.min(b, c)
        const total = b + c
        ans = total - a
        prompt = `Find the missing number. ${fmt(a)} + ___ = ${fmt(total)}`
        hint3 = `Count on from ${fmt(a)} to the next thousand.`
        calc = `${fmt(total)} − ${fmt(a)} = ${fmt(ans)}`
      } else {
        const a = b + c
        ans = Math.min(b, c)
        prompt = `Find the missing number. ${fmt(a)} − ___ = ${fmt(Math.max(b, c))}`
        hint3 = `Count on from ${fmt(Math.max(b, c))} to ${fmt(a)}.`
        calc = `${fmt(a)} − ${fmt(Math.max(b, c))} = ${fmt(ans)}`
      }
      return numItem({
        prompt,
        answer: ans,
        hints: ['Use the inverse operation.', 'Adding and subtracting undo each other.', hint3],
        explanation: `Use the inverse: ${calc}. The missing number is ${fmt(ans)}.`,
        solution: [
          { say: 'Write the matching calculation using the inverse.' },
          { say: 'Work it out, then check it in the gap.', show: calc },
        ],
      })
    }

    const name = rng.pick(NAMES)
    const B = rng.pick([20000, 50000, 100000])
    const r2 = rng.pick([5000, 10000, 2000, 3000])
    const p2 = r2 - rng.pick([100, 500, 200])
    const p1 = rng.int(2, Math.floor((B - r2) / 1000) - 2) * 1000 + rng.pick([0, 500])
    const ans = B - p1 - p2
    const [item1, item2] = rng.sample(['book', 'pen', 'ruler', 'notebook', 'drink', 'snack', 'kite', 'ball'], 2)
    return numItem({
      prompt: `${name} has ${rupiah(B)}. ${name} buys a ${item1} for ${rupiah(p1)} and a ${item2} for ${rupiah(p2)}. How much money is left, in rupiah?`,
      answer: ans,
      hints: [
        'Find the total cost first, or take away one price at a time.',
        `${rupiah(p2)} is close to ${rupiah(r2)}.`,
        `${rupiah(B)} − ${rupiah(p1)} = ${rupiah(B - p1)}.`,
      ],
      explanation: `${rupiah(B)} − ${rupiah(p1)} = ${rupiah(B - p1)}. Then ${rupiah(B - p1)} − ${rupiah(p2)} = ${rupiah(ans)}.`,
      solution: [
        { say: `Take away the ${item1}.`, show: `${fmt(B)} − ${fmt(p1)} = ${fmt(B - p1)}` },
        { say: `Take away ${fmt(r2)}, then add back ${fmt(r2 - p2)}.`, show: `${fmt(B - p1)} − ${fmt(r2)} + ${fmt(r2 - p2)} = ${fmt(ans)}` },
      ],
      tags: [WP],
      secs: 120,
    })
  },
}

/** Langkah penjumlahan bersusun, satu kolom per langkah. Angka dalam satuan 10^-dp. */
export function addColumnSteps(nums: readonly number[], dp = 0): Step[] {
  const width = Math.max(...nums.map((n) => String(n).length), dp + 1)
  const steps: Step[] = []
  let carry = 0
  for (let i = 0; i < width; i++) {
    const col = nums.map((n) => Math.floor(n / 10 ** i) % 10)
    const total = sum(col) + carry
    const write = total % 10
    const next = Math.floor(total / 10)
    steps.push({
      say: `${cap(placeName(i - dp))}: ${col.join(' + ')}${carry ? ` + ${carry} carried` : ''} = ${total}. Write ${write}${next ? ` and carry ${next}` : ''}.`,
    })
    carry = next
  }
  if (carry) steps.push({ say: `Write the carried ${carry} in the ${placeName(width - dp)} column.` })
  return steps
}

/** Langkah pengurangan bersusun dengan menukar (exchange). Angka dalam satuan 10^-dp. */
export function subColumnSteps(a: number, b: number, dp = 0): Step[] {
  const width = Math.max(String(a).length, dp + 1)
  const steps: Step[] = []
  let borrow = 0
  for (let i = 0; i < width; i++) {
    const top = (Math.floor(a / 10 ** i) % 10) - borrow
    const bottom = Math.floor(b / 10 ** i) % 10
    const name = cap(placeName(i - dp))
    if (top < bottom) {
      steps.push({ say: `${name}: ${top < 0 ? 'this column is now 0' : `${top} is less than ${bottom}`}, so exchange 1 from the next column. ${top + 10} − ${bottom} = ${top + 10 - bottom}.` })
      borrow = 1
    } else {
      steps.push({ say: `${name}: ${top} − ${bottom} = ${top - bottom}.` })
      borrow = 0
    }
  }
  return steps
}

const writtenAddSubtract: Generator = {
  skill: 'm5.written-add-subtract',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const addHints = (a: number, b: number): Hints => [
      'Line up the numbers in columns: ones under ones.',
      'Add each column from the right. Carry any ten into the next column.',
      `Ones: ${a % 10} + ${b % 10} = ${(a % 10) + (b % 10)}.`,
    ]
    const subHints = (a: number, b: number): Hints => [
      'Line up the numbers in columns: ones under ones.',
      'Subtract each column from the right. Exchange when the top digit is smaller.',
      a % 10 < b % 10 ? `Ones: ${a % 10} is less than ${b % 10}, so exchange first.` : `Ones: ${a % 10} − ${b % 10} = ${(a % 10) - (b % 10)}.`,
    ]
    if (level === 1) {
      let a = rng.int(1234, 6999)
      let b = rng.int(1234, 2999)
      if ((a % 10) + (b % 10) < 10) b += 5
      if (a % 10 === 0) a += 1
      const ans = a + b
      return numItem({
        prompt: `Work out ${fmt(a)} + ${fmt(b)}.`,
        answer: ans,
        hints: addHints(a, b),
        explanation: `${fmt(a)} + ${fmt(b)} = ${fmt(ans)}. Carry a ten into the next column when a column makes 10 or more.`,
        solution: [{ say: 'Line up the columns.', show: `${fmt(a)} + ${fmt(b)}` }, ...addColumnSteps([a, b]), { say: 'Read the answer.', show: fmt(ans) }],
      })
    }
    if (level === 2) {
      const a = rng.int(2, 9) * 10000 + rng.pick([rng.int(1, 9), rng.int(1, 9) * 10, rng.int(1, 9) * 100 + rng.int(1, 9)])
      const b = rng.int(10000, a - 1000)
      const ans = a - b
      return numItem({
        prompt: `Work out ${fmt(a)} − ${fmt(b)}.`,
        answer: ans,
        hints: subHints(a, b),
        explanation: `${fmt(a)} − ${fmt(b)} = ${fmt(ans)}. When a column has 0, exchange from the next column to the left.`,
        solution: [{ say: 'Line up the columns.', show: `${fmt(a)} − ${fmt(b)}` }, ...subColumnSteps(a, b), { say: 'Check by adding.', show: `${fmt(ans)} + ${fmt(b)} = ${fmt(a)}` }],
      })
    }
    if (level === 3) {
      const add = rng.chance(0.5)
      if (add) {
        const a = rng.int(12345, 59999)
        const b = rng.int(12345, 39999)
        const ans = a + b
        const noCarry = fromDigits(
          String(Math.max(a, b))
            .split('')
            .map((_, i, arr) => (Math.floor(a / 10 ** (arr.length - 1 - i)) % 10) + (Math.floor(b / 10 ** (arr.length - 1 - i)) % 10))
            .map((d) => d % 10),
        )
        const m = mcqFrom(rng, ans, [
          { value: noCarry, why: 'Remember to carry a ten into the next column.' },
          { value: ans + 1000, why: 'Check the thousands column again.' },
          { value: ans - 10, why: 'Check the tens column again.' },
          { value: ans + 100, why: 'Check the hundreds column again.' },
        ])
        return mcqItem({
          prompt: `What is ${fmt(a)} + ${fmt(b)}?`,
          ...m,
          hints: addHints(a, b),
          explanation: `${fmt(a)} + ${fmt(b)} = ${fmt(ans)}.`,
          solution: [{ say: 'Line up the columns.', show: `${fmt(a)} + ${fmt(b)}` }, ...addColumnSteps([a, b])],
        })
      }
      const a = rng.int(50000, 99999)
      let b = rng.int(12345, a - 5000)
      if (a % 10 >= b % 10) b = b - (b % 10) + Math.min(9, (a % 10) + 1)
      const ans = a - b
      const wrong = fromDigits(
        String(a)
          .split('')
          .map((_, i, arr) => Math.abs((Math.floor(a / 10 ** (arr.length - 1 - i)) % 10) - (Math.floor(b / 10 ** (arr.length - 1 - i)) % 10))),
      )
      const m = mcqFrom(rng, ans, [
        { value: wrong, why: 'In each column, take the bottom digit from the top digit. Exchange when the top digit is smaller.' },
        { value: ans + 10, why: 'After exchanging, the tens digit on top goes down by 1.' },
        { value: ans - 1000, why: 'Check the thousands column again.' },
        { value: ans + 100, why: 'Check the hundreds column again.' },
      ])
      return mcqItem({
        prompt: `What is ${fmt(a)} − ${fmt(b)}?`,
        ...m,
        hints: subHints(a, b),
        explanation: `${fmt(a)} − ${fmt(b)} = ${fmt(ans)}.`,
        solution: [{ say: 'Line up the columns.', show: `${fmt(a)} − ${fmt(b)}` }, ...subColumnSteps(a, b)],
      })
    }
    if (level === 4) {
      const t = rng.int(0, 2)
      if (t === 0) {
        const a = rng.int(8000, 25000)
        const g = rng.int(450, 2500)
        const b = rng.int(300, 3000)
        const ans = a - g + b
        return numItem({
          prompt: `A library had ${fmt(a)} books. It gave away ${fmt(g)} old books. Then it bought ${fmt(b)} new books. How many books does it have now?`,
          answer: ans,
          hints: ['There are two steps: one subtraction and one addition.', `First work out ${fmt(a)} − ${fmt(g)}.`, `Line up ${fmt(a)} and ${fmt(g)} in columns.`],
          explanation: `${fmt(a)} − ${fmt(g)} = ${fmt(a - g)}, then ${fmt(a - g)} + ${fmt(b)} = ${fmt(ans)}.`,
          solution: [
            { say: 'Take away the books given away.', show: `${fmt(a)} − ${fmt(g)} = ${fmt(a - g)}` },
            { say: 'Add the new books.', show: `${fmt(a - g)} + ${fmt(b)} = ${fmt(ans)}` },
          ],
          tags: [WP],
          secs: 150,
        })
      }
      if (t === 1) {
        const a = rng.int(2500, 9000)
        const b = rng.int(2500, 9000)
        const s2 = rng.int(1500, a + b - 500)
        const ans = a + b - s2
        const [m1, m2] = rng.pick([['May', 'June'], ['July', 'August'], ['October', 'November']] as const)
        return numItem({
          prompt: `A farm picked ${fmt(a)} mangoes in ${m1} and ${fmt(b)} in ${m2}. It sold ${fmt(s2)} of them. How many mangoes were left?`,
          answer: ans,
          hints: ['Find the total picked first.', `Add ${fmt(a)} and ${fmt(b)}.`, `Ones: ${a % 10} + ${b % 10} = ${(a % 10) + (b % 10)}.`],
          explanation: `${fmt(a)} + ${fmt(b)} = ${fmt(a + b)}, then ${fmt(a + b)} − ${fmt(s2)} = ${fmt(ans)}.`,
          solution: [
            { say: 'Find the total.', show: `${fmt(a)} + ${fmt(b)} = ${fmt(a + b)}` },
            { say: 'Take away the mangoes sold.', show: `${fmt(a + b)} − ${fmt(s2)} = ${fmt(ans)}` },
          ],
          tags: [WP],
          secs: 150,
        })
      }
      const p = rng.int(400, 1400) * 1000 + rng.int(1, 9) * 100
      const q = rng.int(200, 900) * 1000 + rng.int(1, 9) * 250
      const target = (Math.ceil((p + q) / 100000) + rng.int(2, 15)) * 100000
      const ans = target - p - q
      return numItem({
        prompt: `A school wants to raise ${rupiah(target)} for new books. It raises ${rupiah(p)} at a fair and ${rupiah(q)} at a sale. How much more does it need, in rupiah?`,
        answer: ans,
        hints: ['Find how much has been raised so far.', `Add ${rupiah(p)} and ${rupiah(q)}, then subtract from ${rupiah(target)}.`, `${rupiah(p)} + ${rupiah(q)} = ${rupiah(p + q)}.`],
        explanation: `${rupiah(p)} + ${rupiah(q)} = ${rupiah(p + q)}. ${rupiah(target)} − ${rupiah(p + q)} = ${rupiah(ans)}.`,
        solution: [
          { say: 'Add the money raised.', show: `${fmt(p)} + ${fmt(q)} = ${fmt(p + q)}` },
          { say: 'Subtract from the target.', show: `${fmt(target)} − ${fmt(p + q)} = ${fmt(ans)}` },
        ],
        tags: [WP],
        secs: 180,
      })
    }
    const form = rng.int(0, 2)
    const name = rng.pick(NAMES)
    if (form === 0) {
      const total = rng.pick([10000, 20000, 50000, 100000])
      const one = rng.int(Math.floor(total * 0.3), Math.floor(total * 0.7)) + 7
      return numItem({
        prompt: `The sum of two numbers is ${fmt(total)}. One of the numbers is ${fmt(one)}. What is the other number?`,
        answer: total - one,
        hints: ['Sum means the answer when you add.', `Subtract ${fmt(one)} from ${fmt(total)}.`, `${fmt(total)} has zeros, so you will need to exchange across several columns.`],
        explanation: `${fmt(total)} − ${fmt(one)} = ${fmt(total - one)}. Check: ${fmt(one)} + ${fmt(total - one)} = ${fmt(total)}.`,
        solution: [{ say: 'Subtract the number you know.', show: `${fmt(total)} − ${fmt(one)}` }, ...subColumnSteps(total, one).slice(0, 6), { say: 'Check by adding.', show: `${fmt(one)} + ${fmt(total - one)} = ${fmt(total)}` }],
      })
    }
    if (form === 1) {
      const start = rng.int(5, 20) * 1000
      const got = rng.int(1200, start - 800)
      return numItem({
        prompt: `${name} subtracted a number from ${fmt(start)} and got ${fmt(got)}. What number did ${name} subtract?`,
        answer: start - got,
        hints: [`Think of it as ${fmt(start)} − missing number = ${fmt(got)}.`, `The missing number is ${fmt(start)} − ${fmt(got)}.`, `${fmt(start)} has zeros, so exchange carefully.`],
        explanation: `${fmt(start)} − ${fmt(got)} = ${fmt(start - got)}. Check: ${fmt(start)} − ${fmt(start - got)} = ${fmt(got)}.`,
        solution: [
          { say: 'Swap the parts round.', show: `${fmt(start)} − ${fmt(got)}` },
          { say: 'Work it out and check.', show: `${fmt(start)} − ${fmt(start - got)} = ${fmt(got)}` },
        ],
      })
    }
    const added = rng.int(1234, 6789)
    const result = rng.int(added + 1500, added + 9000)
    return numItem({
      prompt: `${name} added ${fmt(added)} to a number and got ${fmt(result)}. What was the number?`,
      answer: result - added,
      hints: ['Use the inverse of adding.', `Subtract ${fmt(added)} from ${fmt(result)}.`, subColumnSteps(result, added)[0]?.say ?? 'Start with the ones column.'],
      explanation: `${fmt(result)} − ${fmt(added)} = ${fmt(result - added)}. Check: ${fmt(result - added)} + ${fmt(added)} = ${fmt(result)}.`,
      solution: [
        { say: 'Subtract to undo the adding.', show: `${fmt(result)} − ${fmt(added)} = ${fmt(result - added)}` },
        { say: 'Check by adding.', show: `${fmt(result - added)} + ${fmt(added)} = ${fmt(result)}` },
      ],
    })
  },
}

const multiplesFactors: Generator = {
  skill: 'm5.multiples-factors',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const remWhy = (n: number, d: number) => `${n} ÷ ${d} leaves a remainder of ${n % d}.`
    if (level === 1) {
      if (rng.chance(0.5)) {
        const k = rng.int(3, 12)
        const c = k * rng.pick([4, 6, 7, 8, 9, 11, 12])
        const cands = uniq([c + 1, c - 1, c + 2, c - 2, k + rng.int(1, 9), c + Math.ceil(k / 2)]).filter((d) => d % k !== 0 && d > 0)
        const m = mcqFrom(rng, c, rng.shuffle(cands).map((d) => ({ value: d, why: remWhy(d, k) })))
        return mcqItem({
          prompt: `Which number is a multiple of ${k}?`,
          ...m,
          hints: [`A multiple of ${k} is in the ${k} times table.`, `Count in ${k}s, or divide each number by ${k}.`, `${k} × 10 = ${k * 10}. Count on or back in ${k}s from there.`],
          explanation: `${fmt(c)} = ${k} × ${c / k}, so it is a multiple of ${k}.`,
          solution: [{ say: `Divide each number by ${k}.` }, { say: 'Only one divides exactly.', show: `${c} ÷ ${k} = ${c / k}` }],
        })
      }
      const N = rng.pick([24, 30, 36, 40, 42, 48, 60])
      const fs1 = factorsOf(N).filter((f) => f > 1 && f < N)
      const c = rng.pick(fs1)
      const non = [5, 7, 8, 9, 11, 13, 14, 16, 18, 25].filter((d) => N % d !== 0 && d < N)
      const m = mcqFrom(rng, c, rng.shuffle(non).map((d) => ({ value: d, why: remWhy(N, d) })))
      return mcqItem({
        prompt: `Which number is a factor of ${N}?`,
        ...m,
        hints: [`A factor of ${N} divides into ${N} exactly.`, `Try dividing ${N} by each number.`, `Start with the smallest option and divide ${N} by it.`],
        explanation: `${N} ÷ ${c} = ${N / c} with no remainder, so ${c} is a factor of ${N}.`,
        solution: [{ say: `Divide ${N} by each option.` }, { say: 'The factor leaves no remainder.', show: `${N} = ${c} × ${N / c}` }],
      })
    }

    if (level === 2) {
      const N = rng.pick([12, 18, 20, 24, 28, 30, 32, 36, 40, 42, 45, 48])
      const fac = factorsOf(N)
      if (rng.chance(0.6)) {
        const goodPool = fac.filter((f) => f > 1 && f < N)
        const good = rng.sample(goodPool, Math.min(goodPool.length, rng.int(2, 3)))
        const badPool = Array.from({ length: Math.min(N - 1, 20) }, (_, i) => i + 2).filter((d) => N % d !== 0)
        const bad = rng.sample(badPool, 6 - good.length)
        const opts = rng.shuffle([...good.map((v) => ({ v, ok: true })), ...bad.map((v) => ({ v, ok: false }))])
        return multiItem({
          prompt: `Choose all the factors of ${N}.`,
          options: opts.map((o) => (o.ok ? { text: String(o.v) } : { text: String(o.v), why: remWhy(N, o.v) })),
          answers: opts.map((o, i) => (o.ok ? i : -1)).filter((i) => i >= 0),
          hints: [`A factor divides into ${N} with no remainder.`, `Find the pairs of numbers that multiply to make ${N}, starting with 1 × ${N}.`, `Check each number: does ${N} divide by it exactly?`],
          explanation: `The factors of ${N} are ${fac.join(', ')}. Here that means ${good.sort((a, b) => a - b).join(', ')}.`,
          solution: [
            { say: 'List the factor pairs.', show: fac.filter((f) => f * f <= N).map((f) => `${f} × ${N / f}`).join(', ') },
            { say: 'Pick the options that appear in a pair.', show: good.sort((a, b) => a - b).join(', ') },
          ],
        })
      }
      return numItem({
        prompt: `How many factors does ${N} have?`,
        answer: fac.length,
        hints: ['Factors come in pairs that multiply to make the number.', `Start with 1 × ${N}, then try 2, 3, 4, and so on.`, `Stop when the pairs start to repeat. 1 × ${N} is the first pair.`],
        explanation: `The factors of ${N} are ${fac.join(', ')}. That is ${fac.length} factors.`,
        solution: [
          { say: 'Find the factor pairs.', show: fac.filter((f) => f * f <= N).map((f) => `${f} × ${N / f}`).join(', ') },
          { say: 'Count every different number.', show: `${fac.join(', ')} → ${fac.length}` },
        ],
      })
    }

    if (level === 3) {
      const style = rng.int(0, 2)
      if (style === 0) {
        let a = rng.int(3, 12)
        let b = rng.int(3, 12)
        while (a === b || lcm(a, b) > 72) {
          a = rng.int(3, 12)
          b = rng.int(3, 12)
        }
        const L = lcm(a, b)
        return numItem({
          prompt: `What is the smallest number that is a multiple of both ${a} and ${b}?`,
          answer: L,
          hints: [`List some multiples of ${Math.max(a, b)}.`, `Check which of them is also a multiple of ${Math.min(a, b)}.`, `Is ${Math.max(a, b)} a multiple of ${Math.min(a, b)}? If not, try the next multiple of ${Math.max(a, b)}.`],
          explanation: `${L} is the first number in both lists: ${L} = ${a} × ${L / a} = ${b} × ${L / b}.`,
          solution: [
            { say: `Multiples of ${a}.`, show: Array.from({ length: Math.min(8, L / a + 1) }, (_, i) => (i + 1) * a).join(', ') },
            { say: `Multiples of ${b}.`, show: Array.from({ length: Math.min(8, L / b + 1) }, (_, i) => (i + 1) * b).join(', ') },
            { say: 'The first number in both lists is the answer.', show: String(L) },
          ],
        })
      }
      if (style === 1) {
        const h = rng.int(2, 12)
        const [m1, m2] = rng.pick([[2, 3], [3, 4], [2, 5], [3, 5], [4, 5], [3, 7], [2, 7]] as const)
        const a = h * m1
        const b = h * m2
        return numItem({
          prompt: `What is the largest number that is a factor of both ${a} and ${b}?`,
          answer: h,
          hints: [`List the factors of ${Math.min(a, b)}.`, `Check which of them also divide ${Math.max(a, b)}.`, `The factors of ${Math.min(a, b)} are ${factorsOf(Math.min(a, b)).join(', ')}.`],
          explanation: `${h} divides both: ${a} = ${h} × ${m1} and ${b} = ${h} × ${m2}. No bigger number divides both.`,
          solution: [
            { say: `Factors of ${a}.`, show: factorsOf(a).join(', ') },
            { say: `Factors of ${b}.`, show: factorsOf(b).join(', ') },
            { say: 'The biggest number in both lists.', show: String(h) },
          ],
        })
      }
      const N = rng.pick([24, 30, 36, 40, 48, 60])
      const fac = factorsOf(N).filter((f) => f > 1 && f < N)
      const yes = rng.sample(fac, 3)
      const no = rng.sample(Array.from({ length: 18 }, (_, i) => i + 2).filter((d) => N % d !== 0), 3)
      const items = rng.shuffle([...yes.map((v) => ({ text: String(v), group: 0 })), ...no.map((v) => ({ text: String(v), group: 1 }))])
      return sortItem({
        prompt: `Sort the numbers: is each one a factor of ${N}?`,
        groups: [`Factor of ${N}`, `Not a factor of ${N}`],
        items,
        hints: [`A factor of ${N} divides it exactly.`, `Divide ${N} by each number.`, `${N} ÷ ${at(yes, 0)} = ${N / at(yes, 0)}, so ${at(yes, 0)} is a factor.`],
        explanation: `Factors of ${N}: ${factorsOf(N).join(', ')}.`,
        solution: [
          { say: 'List the factor pairs.', show: factorsOf(N).filter((f) => f * f <= N).map((f) => `${f} × ${N / f}`).join(', ') },
          { say: 'Numbers in a pair are factors.', show: yes.sort((x, y) => x - y).join(', ') },
        ],
      })
    }

    if (level === 4) {
      if (rng.chance(0.5)) {
        const k = rng.pick([4, 8])
        const span = k === 4 ? 100 : 1000
        const base = rng.int(11, 98) * span
        const goodTail = k * rng.int(3, Math.floor((span - 1) / k))
        const c = base + goodTail
        const bads: number[] = []
        while (bads.length < 3) {
          const t = rng.int(10, span - 1)
          if (t % 2 === 0 && t % k !== 0 && !bads.includes(base + t)) bads.push(base + t)
        }
        const m = mcqFrom(
          rng,
          c,
          bads.map((d) => ({ value: d, why: `The last ${k === 4 ? 'two' : 'three'} digits, ${d % span}, do not divide exactly by ${k}.` })),
        )
        return mcqItem({
          prompt: `Which number can be divided exactly by ${k}?`,
          ...m,
          hints: [
            'All the numbers are even, so look more closely.',
            k === 4 ? 'A number divides by 4 if its last two digits divide by 4.' : 'A number divides by 8 if its last three digits divide by 8.',
            `Check the last ${k === 4 ? 'two' : 'three'} digits of each number.`,
          ],
          explanation: `The last ${k === 4 ? 'two' : 'three'} digits of ${fmt(c)} are ${goodTail}, and ${goodTail} ÷ ${k} = ${goodTail / k}. So ${fmt(c)} divides exactly by ${k}.`,
          solution: [
            { say: `Look only at the last ${k === 4 ? 'two' : 'three'} digits.` },
            { say: 'Divide them by ' + k + '.', show: `${goodTail} ÷ ${k} = ${goodTail / k}` },
          ],
        })
      }
      const [x, y] = rng.pick([[6, 8], [4, 6], [6, 10], [8, 12], [6, 9], [4, 10], [10, 12], [8, 10]] as const)
      const L = lcm(x, y)
      const [thingA, thingB] = rng.pick([
        ['bread rolls', 'sausages'],
        ['cups', 'plates'],
        ['pencils', 'erasers'],
      ] as const)
      return numItem({
        prompt: `${cap(thingA)} come in packs of ${x}. ${cap(thingB)} come in packs of ${y}. What is the smallest number of each you can buy to have the same number?`,
        answer: L,
        hints: ['You need a number that is in both times tables.', `List the multiples of ${x} and of ${y}.`, `Is ${y} a multiple of ${x}? If not, try the next multiple of ${y}.`],
        explanation: `${L} is the smallest common multiple of ${x} and ${y}: ${L / x} packs of ${x} and ${L / y} packs of ${y}.`,
        solution: [
          { say: `Multiples of ${x}.`, show: Array.from({ length: L / x }, (_, i) => (i + 1) * x).join(', ') },
          { say: `Multiples of ${y}.`, show: Array.from({ length: L / y }, (_, i) => (i + 1) * y).join(', ') },
          { say: 'The first match is the answer.', show: String(L) },
        ],
        tags: [WP],
        secs: 120,
      })
    }

    for (let attempt = 0; attempt < 50; attempt++) {
      const a = rng.int(2, 9)
      const b = rng.int(2, 9)
      if (a === b) continue
      const L = lcm(a, b)
      if (L < 6 || L > 40) continue
      const n = L * rng.int(1, Math.floor(99 / L))
      if (n < 10) continue
      const lo = Math.max(10, n - rng.int(1, Math.min(L - 1, 9)))
      const hi = n + rng.int(1, Math.min(L - 1, 9))
      if (lo >= n) continue
      const cands = Array.from({ length: hi - lo - 1 }, (_, i) => lo + 1 + i).filter((v) => v % a === 0 && v % b === 0 && v >= 10 && v <= 99)
      if (cands.length !== 1) continue
      return numItem({
        prompt: `I am a two-digit number. I am a multiple of ${a} and a multiple of ${b}. I am between ${lo} and ${hi}. What number am I?`,
        answer: n,
        hints: [`Which numbers are multiples of both ${a} and ${b}?`, 'Find the smallest number that is a multiple of both. Then count on in steps of that number.', `Only look at numbers between ${lo} and ${hi}.`],
        explanation: `Multiples of both ${a} and ${b} are multiples of ${L}. The only one between ${lo} and ${hi} is ${n}.`,
        solution: [
          { say: `Count in ${L}s.`, show: Array.from({ length: Math.floor(99 / L) }, (_, i) => (i + 1) * L).join(', ') },
          { say: `Pick the one between ${lo} and ${hi}.`, show: String(n) },
        ],
        secs: 120,
      })
    }
    return numItem({
      prompt: 'I am a two-digit number. I am a multiple of 4 and a multiple of 6. I am between 30 and 40. What number am I?',
      answer: 36,
      hints: ['Which numbers are multiples of both 4 and 6?', 'The smallest number that is a multiple of both is 12. Count in 12s.', 'Only look at numbers between 30 and 40.'],
      explanation: 'Multiples of both 4 and 6 are multiples of 12. The only one between 30 and 40 is 36.',
      solution: [{ say: 'Count in 12s.', show: '12, 24, 36, 48' }, { say: 'Pick the one between 30 and 40.', show: '36' }],
    })
  },
}

export const PRIMES_TO_100 = Array.from({ length: 99 }, (_, i) => i + 2).filter(isPrime)

export function smallestFactor(n: number): number {
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return i
  return n
}

const primesSquares: Generator = {
  skill: 'm5.primes-squares',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const notPrimeWhy = (d: number) =>
      d === 1 ? '1 has only one factor, so it is not prime.' : `${d} = ${smallestFactor(d)} × ${d / smallestFactor(d)}, so it has more than two factors.`
    const notSquareWhy = (d: number) => {
      const r = Math.floor(Math.sqrt(d))
      return `${d} is between ${r} × ${r} = ${r * r} and ${r + 1} × ${r + 1} = ${(r + 1) * (r + 1)}, so it is not a square number.`
    }
    if (level === 1) {
      const k = rng.int(2, 12)
      if (rng.chance(0.5)) {
        return numItem({
          prompt: `What is ${k} squared (${k}²)?`,
          answer: k * k,
          hints: ['Squared means multiplied by itself.', `${k}² means ${k} × ${k}.`, `${k} × ${k - 1} = ${k * (k - 1)}. Add one more ${k}.`],
          explanation: `${k}² = ${k} × ${k} = ${k * k}.`,
          solution: [{ say: 'A square number is a number multiplied by itself.', figure: { kind: 'grid', rows: Math.min(k, 12), cols: Math.min(k, 12), shaded: [], showUnits: false, alt: `A ${k} by ${k} square grid.` } }, { say: 'Multiply.', show: `${k} × ${k} = ${k * k}` }],
        })
      }
      const c = k * k
      const cands = uniq([c + 1, c - 1, 2 * k, c + k, c + 2]).filter((d) => d > 1 && !Number.isInteger(Math.sqrt(d)))
      const m = mcqFrom(rng, c, rng.shuffle(cands).map((d) => ({ value: d, why: notSquareWhy(d) })))
      return mcqItem({
        prompt: 'Which of these is a square number?',
        ...m,
        hints: ['A square number is a whole number multiplied by itself.', 'Try to write each option as a number times the same number.', 'Start with the smallest option. Is it some number × the same number?'],
        explanation: `${c} = ${k} × ${k}, so it is a square number.`,
        solution: [{ say: 'List the square numbers.', show: Array.from({ length: 12 }, (_, i) => (i + 1) ** 2).join(', ') }, { say: 'Find the option in the list.', show: `${k} × ${k} = ${c}` }],
      })
    }

    if (level === 2) {
      if (rng.chance(0.55)) {
        const c = rng.pick(PRIMES_TO_100.filter((p) => p > 10))
        const comps = rng.shuffle([1, 9, 15, 21, 27, 33, 39, 49, 51, 57, 63, 69, 77, 87, 91, 93, 25, 35, 45, 55].filter((d) => d !== c))
        const m = mcqFrom(rng, c, comps.map((d) => ({ value: d, why: notPrimeWhy(d) })))
        return mcqItem({
          prompt: 'Which of these is a prime number?',
          ...m,
          hints: ['A prime number has exactly two factors: 1 and itself.', 'Try dividing each number by 3, 5 and 7.', 'Odd numbers can still have factors. Check each one.'],
          explanation: `${c} has only two factors, 1 and ${c}, so it is prime.`,
          solution: [{ say: 'Test each number for small factors: 2, 3, 5, 7.' }, { say: 'The prime has no factor except 1 and itself.', show: `${c} = 1 × ${c}` }],
        })
      }
      const pool = rng.sample(Array.from({ length: 49 }, (_, i) => i + 2), 7)
      const items = pool.map((v) => ({ text: String(v), group: isPrime(v) ? 0 : 1 }))
      if (!items.some((i) => i.group === 0)) items[0] = { text: String(rng.pick([7, 13, 29, 41])), group: 0 }
      if (!items.some((i) => i.group === 1)) items[1] = { text: String(rng.pick([21, 35, 49, 27])), group: 1 }
      const uniqItems = items.filter((it, i) => items.findIndex((o) => o.text === it.text) === i)
      return sortItem({
        prompt: 'Sort the numbers into prime and not prime.',
        groups: ['Prime', 'Not prime'],
        items: uniqItems,
        hints: ['A prime number has exactly two factors.', 'Even numbers bigger than 2 are not prime. Then test 3, 5 and 7.', `Start with ${at(uniqItems, 0).text}: does anything other than 1 and itself divide it?`],
        explanation: `Prime: ${uniqItems.filter((i) => i.group === 0).map((i) => i.text).join(', ')}. Not prime: ${uniqItems.filter((i) => i.group === 1).map((i) => i.text).join(', ')}.`,
        solution: [{ say: 'Test each number for factors other than 1 and itself.' }, { say: 'Numbers with only two factors are prime.', show: uniqItems.filter((i) => i.group === 0).map((i) => i.text).join(', ') }],
      })
    }

    if (level === 3) {
      if (rng.chance(0.5)) {
        const a = rng.int(1, 8) * 10
        const b = a + rng.pick([10, 20])
        const list = PRIMES_TO_100.filter((p) => p > a && p < b)
        return numItem({
          prompt: `How many prime numbers are there between ${a} and ${b}?`,
          answer: list.length,
          hints: ['A prime number has exactly two factors.', 'Ignore the even numbers and the numbers ending in 5. Test the rest for 3 and 7.', `Start with ${a + 1}. Is it prime?`],
          explanation: `The primes between ${a} and ${b} are ${list.join(', ') || 'none'}. That is ${list.length}.`,
          solution: [{ say: 'Cross out even numbers and numbers ending in 5.' }, { say: 'Test the rest for 3 and 7.', show: list.join(', ') }],
        })
      }
      const n = rng.int(20, 90)
      const next = PRIMES_TO_100.concat([101, 103])
        .filter((p) => p > n)
        .reduce((a, b) => Math.min(a, b))
      return numItem({
        prompt: `What is the first prime number after ${n}?`,
        answer: next,
        hints: [`Test the numbers after ${n} one at a time.`, 'Skip even numbers and numbers ending in 5. Test the others for 3 and 7.', `Start with ${n + 1}.`],
        explanation: `${next} is prime. Every number from ${n + 1} to ${next - 1} has a factor other than 1 and itself.`,
        solution: [{ say: `Check ${n + 1}, ${n + 2}, and so on.` }, { say: 'The first one with only two factors.', show: String(next) }],
      })
    }

    if (level === 4) {
      const style = rng.int(0, 2)
      if (style === 0) {
        const k = rng.int(4, 11)
        const X = k * k + rng.int(1, 2 * k)
        return numItem({
          prompt: `What is the smallest square number that is greater than ${X}?`,
          answer: (k + 1) * (k + 1),
          hints: ['List the square numbers in order.', `${k} × ${k} = ${k * k}. Is that greater than ${X}?`, `Try the next whole number after ${k}.`],
          explanation: `${k * k} is less than ${X}, but ${k + 1} × ${k + 1} = ${(k + 1) * (k + 1)} is greater. So the answer is ${(k + 1) * (k + 1)}.`,
          solution: [{ say: 'Square numbers near this one.', show: `${k * k}, ${(k + 1) * (k + 1)}, ${(k + 2) * (k + 2)}` }, { say: `The first one above ${X}.`, show: String((k + 1) * (k + 1)) }],
        })
      }
      if (style === 1) {
        const k = rng.int(5, 11)
        const lo = (k - 1) * (k - 1) + rng.int(1, k - 2)
        const hi = (k + 1) * (k + 1) - rng.int(1, k)
        return numItem({
          prompt: `Which square number is between ${lo} and ${hi}?`,
          answer: k * k,
          hints: ['A square number is a number multiplied by itself.', `${k - 1} × ${k - 1} = ${(k - 1) * (k - 1)}. That is too small.`, `Try ${k} × ${k}.`],
          explanation: `${k} × ${k} = ${k * k}, which is between ${lo} and ${hi}. The squares next to it, ${(k - 1) * (k - 1)} and ${(k + 1) * (k + 1)}, are outside.`,
          solution: [{ say: 'List squares near the range.', show: `${(k - 1) * (k - 1)}, ${k * k}, ${(k + 1) * (k + 1)}` }, { say: 'Only one fits.', show: String(k * k) }],
        })
      }
      const k = rng.int(3, 9)
      const c = k * k
      const cands = uniq([k * 2, k * k + 1, k * k - 1, k * (k + 2), k * (k + 3), k * k + 2]).filter((d) => !Number.isInteger(Math.sqrt(d)))
      const m = mcqFrom(rng, `${c} = ${k} × ${k}`, rng.shuffle(cands).map((d) => ({ value: `${d} = ${smallestFactor(d)} × ${d / smallestFactor(d)}`, why: `${smallestFactor(d)} and ${d / smallestFactor(d)} are different numbers, so this does not show a square.` })), 4, (v) => v)
      return mcqItem({
        prompt: 'Which of these shows a square number?',
        ...m,
        hints: ['A square number is a number times the same number.', 'Look for a multiplication with two equal numbers.', 'Check each one: are the two numbers the same?'],
        explanation: `${c} = ${k} × ${k}, so ${c} is a square number.`,
        solution: [{ say: 'A square can be drawn as a square grid.', figure: { kind: 'grid', rows: k, cols: k, shaded: [], showUnits: false, alt: `A ${k} by ${k} square grid.` } }, { say: 'It has the same number of rows and columns.', show: `${k} × ${k} = ${c}` }],
      })
    }

    for (let attempt = 0; attempt < 60; attempt++) {
      const usePrimes = rng.chance(0.5)
      const lo = rng.int(1, 8) * 10
      const hi = lo + rng.pick([10, 20, 30])
      const pool = usePrimes ? PRIMES_TO_100.filter((p) => p > lo && p < hi) : Array.from({ length: 10 }, (_, i) => (i + 1) ** 2).filter((s) => s > lo && s < hi)
      if (pool.length < 2) continue
      const kind = rng.int(0, 2)
      const digitSum = (v: number) => String(v).split('').map(Number).reduce((x, y) => x + y, 0)
      let clue: string
      let pick: number[]
      if (kind === 0) {
        const target = digitSum(rng.pick(pool))
        clue = `My digits add up to ${target}.`
        pick = pool.filter((v) => digitSum(v) === target)
      } else if (kind === 1) {
        const last = rng.pick(pool) % 10
        clue = `My ones digit is ${last}.`
        pick = pool.filter((v) => v % 10 === last)
      } else {
        const odd = rng.chance(0.5)
        clue = `I am ${odd ? 'odd' : 'even'}.`
        pick = pool.filter((v) => (v % 2 === 1) === odd)
      }
      if (pick.length !== 1) continue
      const ans = at(pick, 0)
      return numItem({
        prompt: `I am a ${usePrimes ? 'prime' : 'square'} number between ${lo} and ${hi}. ${clue} What number am I?`,
        answer: ans,
        hints: [
          `List all the ${usePrimes ? 'prime' : 'square'} numbers between ${lo} and ${hi} first.`,
          'Then use the clue to cross out the ones that do not fit.',
          usePrimes ? `Start at ${lo + 1} and test each odd number.` : `Start with ${Math.ceil(Math.sqrt(lo + 1))} × ${Math.ceil(Math.sqrt(lo + 1))}.`,
        ],
        explanation: `The ${usePrimes ? 'primes' : 'square numbers'} between ${lo} and ${hi} are ${pool.join(', ')}. Only ${ans} fits the clue.`,
        solution: [{ say: 'List the candidates.', show: pool.join(', ') }, { say: 'Use the clue.', show: String(ans) }],
        secs: 120,
      })
    }
    return numItem({
      prompt: 'I am a prime number between 90 and 100. What number am I?',
      answer: 97,
      hints: ['List the odd numbers between 90 and 100.', 'Cross out numbers that divide by 3, 5 or 7.', '91 = 7 × 13, so it is not prime.'],
      explanation: '93, 95 and 99 divide by 3 or 5 and 91 = 7 × 13. Only 97 is prime.',
      solution: [{ say: 'Odd numbers: 91, 93, 95, 97, 99.' }, { say: 'Only one is prime.', show: '97' }],
    })
  },
}

/** Langkah perkalian bersusun dengan memecah pengali menurut nilai tempat. */
export function multiplySteps(a: number, b: number): Step[] {
  const small = Math.min(a, b) < 10 ? Math.min(a, b) : b
  const big = small === b ? a : b
  if (small < 10) {
    const parts = digitsOf(big)
      .map((d, i, arr) => d * 10 ** (arr.length - 1 - i))
      .filter((v) => v > 0)
    return [
      { say: `Split ${fmt(big)} by place value.`, show: parts.map(fmt).join(' + ') },
      { say: `Multiply each part by ${small}.`, show: parts.map((p) => `${fmt(p)} × ${small} = ${fmt(p * small)}`).join(', ') },
      { say: 'Add the parts.', show: `${parts.map((p) => fmt(p * small)).join(' + ')} = ${fmt(big * small)}` },
    ]
  }
  const tens = Math.floor(small / 10) * 10
  const ones = small % 10
  return [
    { say: `Split ${small} into ${tens} and ${ones}.` },
    { say: `${fmt(big)} × ${tens} = ${fmt(big * tens)}.`, show: `${fmt(big)} × ${tens} = ${fmt(big * tens)}` },
    ...(ones ? [{ say: `${fmt(big)} × ${ones} = ${fmt(big * ones)}.`, show: `${fmt(big)} × ${ones} = ${fmt(big * ones)}` }] : []),
    { say: 'Add the two answers.', show: `${fmt(big * tens)} + ${fmt(big * ones)} = ${fmt(big * small)}` },
  ]
}

const multiplyWritten: Generator = {
  skill: 'm5.multiply-written',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level <= 2) {
      const a = level === 1 ? rng.int(112, 989) : rng.int(1012, 2999)
      const m = rng.int(3, 9)
      const ans = a * m
      const top = at(digitsOf(a), 0) * 10 ** (String(a).length - 1)
      return numItem({
        prompt: `Work out ${fmt(a)} × ${m}.`,
        answer: ans,
        hints: [`Split ${fmt(a)} into ${level === 1 ? 'hundreds, tens and ones' : 'thousands, hundreds, tens and ones'}.`, `Multiply each part by ${m}, then add.`, `${fmt(top)} × ${m} = ${fmt(top * m)}.`],
        explanation: `${fmt(a)} × ${m} = ${digitsOf(a).map((d, i, arr) => d * 10 ** (arr.length - 1 - i) * m).filter((v) => v > 0).map(fmt).join(' + ')} = ${fmt(ans)}.`,
        solution: multiplySteps(a, m),
      })
    }
    if (level === 3) {
      const a = rng.int(23, 98)
      let b = rng.int(21, 89)
      if (b % 10 === 0) b += 3
      const ans = a * b
      if (rng.chance(0.4)) {
        const ra = roundTo(a, 10)
        const rb = roundTo(b, 10)
        const est = ra * rb
        const m = mcqFrom(rng, est, [
          { value: (ra - 10) * rb, why: `${a} rounds to ${ra}.` },
          { value: ra * (rb + 10), why: `${b} rounds to ${rb}.` },
          { value: est / 10, why: `Check the zeros: ${ra} × ${rb} = ${fmt(est)}.` },
          { value: ra + rb, why: 'That adds the numbers instead of multiplying.' },
        ])
        return mcqItem({
          prompt: `Which is the best estimate for ${a} × ${b}?`,
          ...m,
          hints: ['Round each number to the nearest 10.', `${a} is close to ${ra}.`, `Work out ${ra / 10} × ${rb / 10} and then think about the zeros.`],
          explanation: `${a} ≈ ${ra} and ${b} ≈ ${rb}, so ${a} × ${b} ≈ ${ra} × ${rb} = ${fmt(est)}. The exact answer is ${fmt(ans)}.`,
          solution: [{ say: 'Round both numbers.', show: `${a} → ${ra}, ${b} → ${rb}` }, { say: 'Multiply the rounded numbers.', show: `${ra} × ${rb} = ${fmt(est)}` }],
        })
      }
      return numItem({
        prompt: `Work out ${a} × ${b}.`,
        answer: ans,
        hints: [`Split ${b} into tens and ones.`, `Work out ${a} × ${Math.floor(b / 10) * 10} and ${a} × ${b % 10}, then add.`, `${a} × ${Math.floor(b / 10) * 10} = ${fmt(a * Math.floor(b / 10) * 10)}.`],
        explanation: `${a} × ${b} = ${fmt(a * Math.floor(b / 10) * 10)} + ${fmt(a * (b % 10))} = ${fmt(ans)}.`,
        solution: multiplySteps(a, b),
      })
    }
    if (level === 4) {
      const t = rng.int(0, 2)
      if (t === 0) {
        const rows = rng.int(18, 45)
        let seats = rng.int(16, 38)
        if (seats % 10 === 0) seats += 2
        return numItem({
          prompt: `A hall has ${rows} rows of chairs. Each row has ${seats} chairs. How many chairs are there altogether?`,
          answer: rows * seats,
          hints: ['Equal rows means multiply.', `Work out ${rows} × ${seats}.`, `${rows} × ${Math.floor(seats / 10) * 10} = ${fmt(rows * Math.floor(seats / 10) * 10)}.`],
          explanation: `${rows} × ${seats} = ${fmt(rows * seats)} chairs.`,
          solution: multiplySteps(rows, seats),
          tags: [WP],
        })
      }
      if (t === 1) {
        let boxes = rng.int(12, 48)
        if (boxes % 10 === 0) boxes += 4
        const each = rng.int(24, 96)
        const thing = rng.pick(['eggs', 'pencils', 'oranges', 'stickers'] as const)
        return numItem({
          prompt: `A shop has ${boxes} boxes. Each box holds ${each} ${thing}. How many ${thing} are there in total?`,
          answer: boxes * each,
          hints: ['Equal groups means multiply.', `Work out ${boxes} × ${each}.`, `${each} × ${Math.floor(boxes / 10) * 10} = ${fmt(each * Math.floor(boxes / 10) * 10)}.`],
          explanation: `${boxes} × ${each} = ${fmt(boxes * each)} ${thing}.`,
          solution: multiplySteps(each, boxes),
          tags: [WP],
        })
      }
      let price = rng.int(12, 85) * 500
      if (price % 1000 === 0) price += 500
      const qty = rng.int(3, 9)
      const item = rng.pick(['notebooks', 'water bottles', 'T-shirts', 'tickets'] as const)
      return numItem({
        prompt: `One of the ${item} costs ${rupiah(price)}. How much do ${qty} ${item} cost, in rupiah?`,
        answer: price * qty,
        hints: ['The same price is paid several times, so multiply.', `Work out ${fmt(price)} × ${qty}.`, `${fmt(Math.floor(price / 1000) * 1000)} × ${qty} = ${fmt(Math.floor(price / 1000) * 1000 * qty)}.`],
        explanation: `${rupiah(price)} × ${qty} = ${rupiah(price * qty)}.`,
        solution: multiplySteps(price, qty),
        tags: [WP],
      })
    }
    if (rng.chance(0.5)) {
      const a = rng.int(112, 899)
      let b = rng.int(12, 39)
      if (b % 10 === 0) b += 6
      return numItem({
        prompt: `Work out ${a} × ${b}.`,
        answer: a * b,
        hints: [`Split ${b} into tens and ones.`, `Work out ${a} × ${Math.floor(b / 10) * 10} and ${a} × ${b % 10}, then add.`, `${a} × ${Math.floor(b / 10) * 10} = ${fmt(a * Math.floor(b / 10) * 10)}.`],
        explanation: `${a} × ${b} = ${fmt(a * Math.floor(b / 10) * 10)} + ${fmt(a * (b % 10))} = ${fmt(a * b)}.`,
        solution: multiplySteps(a, b),
        secs: 150,
      })
    }
    const price = rng.int(25, 60) * 1000
    let qty = rng.int(12, 28)
    if (qty % 10 === 0) qty += 3
    const cost = price * qty
    const pay = Math.ceil(cost / 500000) * 500000 + (cost % 500000 === 0 ? 500000 : 0)
    return numItem({
      prompt: `A class buys ${qty} museum tickets at ${rupiah(price)} each. The teacher pays with ${rupiah(pay)}. How much change does the teacher get, in rupiah?`,
      answer: pay - cost,
      hints: ['First find the total cost.', `Work out ${fmt(price)} × ${qty}, then subtract it from ${fmt(pay)}.`, `${fmt(price)} × ${Math.floor(qty / 10) * 10} = ${fmt(price * Math.floor(qty / 10) * 10)}.`],
      explanation: `${rupiah(price)} × ${qty} = ${rupiah(cost)}. Change: ${rupiah(pay)} − ${rupiah(cost)} = ${rupiah(pay - cost)}.`,
      solution: [...multiplySteps(price, qty), { say: 'Subtract from the money paid.', show: `${fmt(pay)} − ${fmt(cost)} = ${fmt(pay - cost)}` }],
      tags: [WP],
      secs: 180,
    })
  },
}

/** Langkah pembagian dengan mengurangi kelompok besar (chunking). */
export function divideSteps(n: number, d: number): Step[] {
  const q = Math.floor(n / d)
  const r = n % d
  const steps: Step[] = []
  let rest = n
  const chunks: number[] = []
  const qd = digitsOf(q)
  qd.forEach((digit, i) => {
    if (digit === 0) return
    const chunk = digit * 10 ** (qd.length - 1 - i)
    chunks.push(chunk)
    steps.push({ say: `${d} × ${fmt(chunk)} = ${fmt(chunk * d)}. Take it away: ${fmt(rest)} − ${fmt(chunk * d)} = ${fmt(rest - chunk * d)}.` })
    rest -= chunk * d
  })
  steps.push({ say: `Add the parts: ${chunks.map(fmt).join(' + ')} = ${fmt(q)}${r ? `, with ${r} left over` : ''}.`, show: `${fmt(n)} ÷ ${d} = ${fmt(q)}${r ? ` remainder ${r}` : ''}` })
  return steps
}

const divideWritten: Generator = {
  skill: 'm5.divide-written',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const d = rng.int(3, 9)
    if (level <= 2) {
      let q = level === 1 ? rng.int(14, 99) : rng.int(112, Math.floor(9999 / d))
      if (q % 10 === 0) q += 3
      const n = q * d
      const lead = level === 1 ? Math.floor(q / 10) * 10 : Math.floor(q / 100) * 100
      return numItem({
        prompt: `Work out ${fmt(n)} ÷ ${d}.`,
        answer: q,
        hints: [`How many groups of ${d} are in ${fmt(n)}?`, `Take away big chunks of ${d}, like ${d} × 10 or ${d} × 100.`, `${d} × ${fmt(lead)} = ${fmt(d * lead)}.`],
        explanation: `${fmt(n)} ÷ ${d} = ${fmt(q)}. Check: ${fmt(q)} × ${d} = ${fmt(n)}.`,
        solution: divideSteps(n, d),
      })
    }
    if (level === 3) {
      let q = rng.int(24, 240)
      if (q % 10 === 0) q += 1
      const r = rng.int(1, d - 1)
      const n = q * d + r
      return textItem({
        prompt: `Work out ${fmt(n)} ÷ ${d}. Write the answer and the remainder. ${fmt(n)} ÷ ${d} = ___ remainder ___`,
        answers: [[String(q)], [String(r)]],
        hints: [`Find the biggest multiple of ${d} that is not more than ${fmt(n)}.`, `The remainder must be less than ${d}.`, `${d} × ${Math.floor(q / 10) * 10} = ${fmt(d * Math.floor(q / 10) * 10)}.`],
        explanation: `${d} × ${q} = ${fmt(q * d)}, and ${fmt(n)} − ${fmt(q * d)} = ${r}. So ${fmt(n)} ÷ ${d} = ${q} remainder ${r}.`,
        solution: divideSteps(n, d),
      })
    }
    if (level === 4) {
      const up = rng.chance(0.5)
      const per = rng.int(6, 16)
      const q = rng.int(6, 30)
      const r = rng.int(1, per - 1)
      const n = q * per + r
      if (up) {
        const reader = rng.pick(NAMES)
        const ctx = rng.pick([
          { s: `${n} children are going on a trip. Each minibus holds ${per} children.`, q: 'How many minibuses are needed?', one: 'child', many: 'children', unit: 'minibus' },
          { s: `${n} eggs need to be packed. Each box holds ${per} eggs.`, q: 'How many boxes are needed to pack all the eggs?', one: 'egg', many: 'eggs', unit: 'box' },
          { s: `A book has ${n} pages. ${reader} reads ${per} pages each day.`, q: 'How many days does it take to finish the book?', one: 'page', many: 'pages', unit: 'day' },
        ])
        return numItem({
          prompt: `${ctx.s} ${ctx.q}`,
          answer: q + 1,
          hints: [`Divide ${n} by ${per}.`, 'Think about the remainder. Does it need one more?', `${per} × ${q} = ${per * q}.`],
          explanation: `${n} ÷ ${per} = ${q} remainder ${r}. The ${plur(r, ctx.one, ctx.many)} left over ${r === 1 ? 'needs' : 'need'} one more ${ctx.unit}, so the answer is ${q + 1}.`,
          solution: [...divideSteps(n, per).slice(-1), { say: `${r} are left over, so round up.`, show: `${q} + 1 = ${q + 1}` }],
          tags: [WP],
          secs: 120,
        })
      }
      const ctx = rng.pick([
        { s: `A baker has ${n} cookies. Cookies are sold in bags of ${per}.`, q: 'How many full bags can the baker make?', left: `${plur(r, 'cookie', 'cookies')} left over ${r === 1 ? 'is' : 'are'} not enough for another bag` },
        { s: `There are ${n} chairs. They are put in rows of ${per}.`, q: 'How many full rows are there?', left: `${plur(r, 'chair', 'chairs')} left over ${r === 1 ? 'is' : 'are'} not enough for another row` },
        { s: `A ribbon is ${n} cm long. It is cut into pieces ${per} cm long.`, q: 'How many whole pieces can be cut?', left: `${r} cm left over ${r === 1 ? 'is' : 'are'} too short for another piece` },
      ])
      return numItem({
        prompt: `${ctx.s} ${ctx.q}`,
        answer: q,
        hints: [`Divide ${n} by ${per}.`, 'Think about the remainder. Is it enough for another full group?', `${per} × ${q + 1} = ${per * (q + 1)}. That is too many.`],
        explanation: `${n} ÷ ${per} = ${q} remainder ${r}. The ${ctx.left}, so the answer is ${q}.`,
        solution: [...divideSteps(n, per).slice(-1), { say: `${r} is not enough for another group.`, show: String(q) }],
        tags: [WP],
        secs: 120,
      })
    }
    if (rng.chance(0.5)) {
      const q = rng.int(25, 120)
      const r = rng.int(1, d - 1)
      const n = q * d + r
      return numItem({
        prompt: `A number divided by ${d} gives ${q} remainder ${r}. What is the number?`,
        answer: n,
        hints: ['Use the inverse: multiply, then add the remainder.', `Work out ${q} × ${d} first.`, `${q} × ${d} = ${q * d}.`],
        explanation: `${q} × ${d} = ${q * d}, and ${q * d} + ${r} = ${n}.`,
        solution: [
          { say: 'Multiply the answer by the divisor.', show: `${q} × ${d} = ${q * d}` },
          { say: 'Add the remainder.', show: `${q * d} + ${r} = ${n}` },
        ],
      })
    }
    const n = rng.int(300, 2000)
    const r = n % d
    const add = r === 0 ? 0 : d - r
    if (add === 0) {
      return numItem({
        prompt: `What is ${fmt(n)} ÷ ${d}?`,
        answer: n / d,
        hints: [`How many groups of ${d} are in ${fmt(n)}?`, `Take away chunks of ${d} × 100 and ${d} × 10.`, `${d} × 100 = ${d * 100}.`],
        explanation: `${fmt(n)} ÷ ${d} = ${fmt(n / d)}.`,
        solution: divideSteps(n, d),
      })
    }
    return numItem({
      prompt: `What is the smallest number you can add to ${fmt(n)} so that it divides exactly by ${d}?`,
      answer: add,
      hints: [`Divide ${fmt(n)} by ${d} and look at the remainder.`, `The next multiple of ${d} is the next number that divides exactly.`, `${fmt(n)} ÷ ${d} = ${Math.floor(n / d)} remainder ${r}.`],
      explanation: `${fmt(n)} ÷ ${d} = ${Math.floor(n / d)} remainder ${r}. The next multiple of ${d} is ${fmt(n + add)}, so add ${add}.`,
      solution: [...divideSteps(n, d).slice(-1), { say: `Add ${d} − ${r} to reach the next multiple.`, show: `${fmt(n)} + ${add} = ${fmt(n + add)}` }],
      secs: 120,
    })
  },
}

/* ------------------------------------------------------------------ */
/* Nf: pecahan, desimal, persen, rasio                                 */
/* ------------------------------------------------------------------ */

const DEN_WORDS: Record<number, [string, string]> = {
  2: ['half', 'halves'],
  3: ['third', 'thirds'],
  4: ['quarter', 'quarters'],
  5: ['fifth', 'fifths'],
  6: ['sixth', 'sixths'],
  7: ['seventh', 'sevenths'],
  8: ['eighth', 'eighths'],
  9: ['ninth', 'ninths'],
  10: ['tenth', 'tenths'],
  11: ['eleventh', 'elevenths'],
  12: ['twelfth', 'twelfths'],
  14: ['fourteenth', 'fourteenths'],
  15: ['fifteenth', 'fifteenths'],
  16: ['sixteenth', 'sixteenths'],
  18: ['eighteenth', 'eighteenths'],
  20: ['twentieth', 'twentieths'],
  24: ['twenty-fourth', 'twenty-fourths'],
  25: ['twenty-fifth', 'twenty-fifths'],
  30: ['thirtieth', 'thirtieths'],
  100: ['hundredth', 'hundredths'],
}

export function denName(d: number, many = true): string {
  const w = DEN_WORDS[d]
  if (w) return many ? w[1] : w[0]
  return many ? `${d}ths` : `${d}th`
}

/** Figur pecahan bila penyebut muat (maksimal 16 bagian), selain itu undefined. */
export function fracFigOpt(n: number, d: number, shape: 'bar' | 'circle' | 'square' = 'bar', label?: string): Fig | undefined {
  return d <= 16 && n <= 16 ? fracFig(n, d, shape, label) : undefined
}

export function fracFig(n: number, d: number, shape: 'bar' | 'circle' | 'square' = 'bar', label?: string): Fig {
  return {
    kind: 'fraction',
    shape,
    parts: d,
    shaded: n,
    ...(label ? { label } : {}),
    alt: `A ${shape} cut into ${d} equal parts with ${n} shaded${label ? `. The whole is ${label}` : ''}.`,
  }
}

export const PROPER: readonly (readonly [number, number])[] = [
  [1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5], [1, 6], [5, 6], [1, 8], [3, 8], [5, 8], [7, 8], [3, 10], [7, 10], [9, 10],
]

export function smallestCommonFactor(a: number, b: number): number {
  for (let i = 2; i <= Math.min(a, b); i++) if (a % i === 0 && b % i === 0) return i
  return 1
}

export function range(lo: number, hi: number): number[] {
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
}

/** Nilai pecahan sebagai pembilang dengan penyebut bersama L. */
export const over = (f: Frac, L: number): number => (f.n * L) / f.d

const equivalentFractions: Generator = {
  skill: 'm5.equivalent-fractions',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const [a, b] = rng.pick(PROPER)
    if (level === 1) {
      const k = rng.int(2, 6)
      const missTop = a > 1 && rng.chance(0.6)
      return numItem({
        prompt: missTop ? `Find the missing number. ${a}/${b} = ___/${b * k}` : `Find the missing number. ${a}/${b} = ${a * k}/___`,
        answer: missTop ? a * k : b * k,
        figure: fracFig(a, b),
        hints: missTop
          ? [`How did ${b} become ${b * k}?`, 'Multiply the numerator by the same number as the denominator.', `${b} × ${k} = ${b * k}.`]
          : [`How did ${a} become ${a * k}?`, 'Multiply the denominator by the same number as the numerator.', `${a} × ${k} = ${a * k}.`],
        explanation: `${a}/${b} = ${a * k}/${b * k}, because the numerator and the denominator are both multiplied by ${k}.`,
        solution: [
          { say: `Equivalent fractions show the same amount.`, figure: fracFigOpt(a * k, b * k) },
          { say: `Multiply the top and the bottom by ${k}.`, show: `${a}/${b} = ${a * k}/${b * k}` },
        ],
      })
    }
    if (level === 2) {
      const k = rng.int(2, 6)
      const n = a * k
      const d = b * k
      return textItem({
        prompt: `Write ${n}/${d} in its simplest form.`,
        answers: [[fs({ n: a, d: b })]],
        hints: ['Find a number that divides both the numerator and the denominator.', `Look for the highest common factor of ${n} and ${d}.`, `Both ${n} and ${d} can be divided by ${smallestCommonFactor(n, d)}.`],
        explanation: `The highest common factor of ${n} and ${d} is ${k}. ${n} ÷ ${k} = ${a} and ${d} ÷ ${k} = ${b}, so ${n}/${d} = ${a}/${b}.`,
        solution: [
          { say: `Divide the top and the bottom by ${k}.`, show: `${n} ÷ ${k} = ${a}, ${d} ÷ ${k} = ${b}` },
          { say: `Now 1 is the only common factor, so it is in its simplest form.`, show: `${n}/${d} = ${a}/${b}` },
        ],
      })
    }
    if (level === 3) {
      const k = rng.int(2, 5)
      const correct = `${a * k}/${b * k}`
      const m = mcqText(rng, correct, [
        { value: `${a + k}/${b + k}`, why: `Adding ${k} to the top and the bottom changes the size of the fraction.` },
        { value: `${a}/${b * k}`, why: `Only the denominator was multiplied by ${k}. Multiply both.` },
        { value: `${a * k}/${b}`, why: `Only the numerator was multiplied by ${k}. Multiply both.` },
        { value: `${b}/${a}`, why: 'The numerator and the denominator have swapped places.' },
      ])
      return mcqItem({
        prompt: `Which fraction is equivalent to ${a}/${b}?`,
        ...m,
        figure: fracFig(a, b),
        hints: ['Equivalent fractions show the same amount.', 'Multiply the numerator and the denominator by the same number.', `Try multiplying ${a}/${b} by ${k} on the top and the bottom.`],
        explanation: `${a} × ${k} = ${a * k} and ${b} × ${k} = ${b * k}, so ${a}/${b} = ${correct}.`,
        solution: [
          { say: 'Multiply the top and the bottom by the same number.', show: `${a}/${b} = ${a * k}/${b * k}` },
          { say: 'The shaded amount stays the same.', figure: fracFigOpt(a * k, b * k) },
        ],
      })
    }
    if (level === 4) {
      if (rng.chance(0.55)) {
        const [fa, fb] = rng.pick(PROPER.filter(([, d]) => d <= 8))
        const ks = [2, 3, 4].filter((k) => fb * k <= 16)
        const k = rng.pick(ks)
        const parts = fb * k
        const shape = parts <= 12 && rng.chance(0.4) ? 'circle' : 'bar'
        return fractionItem({
          prompt: `Shade ${fa}/${fb} of the ${shape}.`,
          shape,
          parts,
          num: fa,
          den: fb,
          hints: [`The ${shape} has ${parts} equal parts.`, `Work out how many parts make 1/${fb}: ${parts} ÷ ${fb}.`, `1/${fb} of the ${shape} is ${k} parts.`],
          explanation: `1/${fb} is ${k} parts, so ${fa}/${fb} is ${fa * k} parts out of ${parts}. ${fa}/${fb} = ${fa * k}/${parts}.`,
          solution: [
            { say: `Split the ${parts} parts into ${fb} equal groups of ${k}.` },
            { say: `Shade ${fa} of those groups.`, show: `${fa}/${fb} = ${fa * k}/${parts}`, figure: fracFig(fa * k, parts, shape) },
          ],
        })
      }
      const total = rng.pick([6, 8, 10, 12, 15, 16, 18, 20, 24])
      const eaten = rng.pick(range(2, total - 1).filter((x) => gcd(x, total) > 1))
      const s1 = simp({ n: eaten, d: total })
      const name = rng.pick(NAMES)
      const food = rng.pick(['pizza', 'cake', 'pie', 'chocolate bar'] as const)
      return textItem({
        prompt: `A ${food} is cut into ${total} equal pieces. ${name} eats ${eaten} of them. What fraction of the ${food} does ${name} eat? Write it in its simplest form.`,
        answers: [[fs(s1)]],
        hints: [`Write the fraction first: ${eaten} out of ${total}.`, `Divide the top and the bottom by a common factor of ${eaten} and ${total}.`, `Both ${eaten} and ${total} divide by ${smallestCommonFactor(eaten, total)}.`],
        explanation: `${name} eats ${eaten}/${total}. Dividing both by ${gcd(eaten, total)} gives ${fs(s1)}.`,
        solution: [
          { say: 'Write the fraction.', show: `${eaten}/${total}` },
          { say: `Divide the top and the bottom by ${gcd(eaten, total)}.`, show: `${eaten}/${total} = ${fs(s1)}` },
        ],
        tags: [WP],
      })
    }
    const ks = rng.sample([2, 3, 4, 5, 6], 2)
    const k1 = at(ks, 0)
    const k2 = at(ks, 1)
    return textItem({
      prompt: `Fill in the missing numbers. ${a}/${b} = ${a * k1}/___ = ___/${b * k2}`,
      answers: [[String(b * k1)], [String(a * k2)]],
      hints: [
        'Every fraction in the line must be equal to the first one.',
        `${a} × ${k1} = ${a * k1}, so the first denominator is also multiplied by ${k1}.`,
        `For the last fraction, find what ${b} is multiplied by to make ${b * k2}.`,
      ],
      explanation: `${a}/${b} = ${a * k1}/${b * k1} = ${a * k2}/${b * k2}. Each time the top and the bottom are multiplied by the same number.`,
      solution: [
        { say: `Multiply by ${k1}.`, show: `${a}/${b} = ${a * k1}/${b * k1}` },
        { say: `Multiply by ${k2}.`, show: `${a}/${b} = ${a * k2}/${b * k2}` },
      ],
    })
  },
}

const compareFractions: Generator = {
  skill: 'm5.compare-fractions',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level === 1) {
      const greatest = rng.chance(0.6)
      if (rng.chance(0.5)) {
        const d = rng.int(5, 12)
        const ns = rng.sample(range(1, d - 1), 4)
        const c = greatest ? Math.max(...ns) : Math.min(...ns)
        const m = mcqFrom(
          rng,
          `${c}/${d}`,
          ns.filter((x) => x !== c).map((x) => ({ value: `${x}/${d}`, why: `The parts are the same size, and ${x} ${denName(d)} is ${x < c ? 'fewer' : 'more'} than ${c} ${denName(d)}.` })),
          4,
          (v) => v,
        )
        return mcqItem({
          prompt: `Which fraction is the ${greatest ? 'greatest' : 'smallest'}?`,
          ...m,
          hints: ['Look at the denominators. Are they the same?', 'When the parts are the same size, compare how many parts there are.', `Compare the numerators: ${ns.join(', ')}.`],
          explanation: `All the fractions are in ${denName(d)}, so the one with the ${greatest ? 'most' : 'fewest'} parts is the ${greatest ? 'greatest' : 'smallest'}: ${c}/${d}.`,
          solution: [{ say: `Every fraction is in ${denName(d)}.`, figure: fracFig(c, d) }, { say: 'Compare the numerators.', show: `${c}/${d}` }],
        })
      }
      const n = rng.int(1, 3)
      const ds = rng.sample(range(n + 1, 12), 4)
      const c = greatest ? Math.min(...ds) : Math.max(...ds)
      const m = mcqFrom(
        rng,
        `${n}/${c}`,
        ds.filter((x) => x !== c).map((x) => ({ value: `${n}/${x}`, why: `${cap(denName(x))} are ${x > c ? 'smaller' : 'bigger'} pieces than ${denName(c)}, so ${n}/${x} is ${x > c ? 'smaller' : 'bigger'}.` })),
        4,
        (v) => v,
      )
      return mcqItem({
        prompt: `Which fraction is the ${greatest ? 'greatest' : 'smallest'}?`,
        ...m,
        hints: ['The numerators are all the same.', 'The bigger the denominator, the smaller each part is.', `Which denominator is the ${greatest ? 'smallest' : 'biggest'}?`],
        explanation: `Each fraction has ${n} part${n > 1 ? 's' : ''}. ${cap(denName(c))} are the ${greatest ? 'biggest' : 'smallest'} parts, so ${n}/${c} is the ${greatest ? 'greatest' : 'smallest'}.`,
        solution: [{ say: 'Same number of parts, different sizes.', figure: fracFig(n, c) }, { say: `Bigger denominator, smaller parts.`, show: `${n}/${c}` }],
      })
    }

    if (level === 2) {
      const b = rng.pick([2, 3, 4, 5])
      const dens = [b, 2 * b, 4 * b].filter((d) => d <= 20)
      const L = Math.max(...dens)
      const fr: Frac[] = []
      const seen = new Set<number>()
      while (fr.length < 4) {
        const d = rng.pick(dens)
        const n = rng.int(1, d - 1)
        const v = over({ n, d }, L)
        if (seen.has(v)) continue
        seen.add(v)
        fr.push({ n, d })
      }
      const greatest = rng.chance(0.5)
      const sorted = [...fr].sort((x, y) => over(x, L) - over(y, L))
      const c = greatest ? at(sorted, 3) : at(sorted, 0)
      const m = mcqFrom(
        rng,
        fs(c),
        fr.filter((x) => x !== c).map((x) => ({ value: fs(x), why: `${fs(x)} = ${over(x, L)}/${L}, which is ${over(x, L) < over(c, L) ? 'less' : 'more'} than ${over(c, L)}/${L}.` })),
        4,
        (v) => v,
      )
      return mcqItem({
        prompt: `Which fraction is the ${greatest ? 'greatest' : 'smallest'}?`,
        ...m,
        hints: [
          'The denominators are different. Make them the same first.',
          `Change every fraction into ${denName(L)}.`,
          (() => {
            const h = fr.find((x) => x.d !== L && x !== c)
            return h ? `${fs(h)} = ${over(h, L)}/${L}.` : `Multiply the top and the bottom of each fraction so the denominator is ${L}.`
          })(),
        ],
        explanation: `In ${denName(L)}: ${fr.map((x) => `${fs(x)} = ${over(x, L)}/${L}`).join(', ')}. The ${greatest ? 'greatest' : 'smallest'} is ${fs(c)}.`,
        solution: [
          { say: `Change each fraction into ${denName(L)}.`, show: fr.map((x) => `${over(x, L)}/${L}`).join(', ') },
          { say: 'Compare the numerators.', show: fs(c) },
        ],
      })
    }

    if (level === 3) {
      const d = rng.int(2, 9)
      const w = rng.int(1, 5)
      const r = rng.int(1, d - 1)
      const f = { n: w * d + r, d }
      if (rng.chance(0.5)) {
        return textItem({
          prompt: `Write ${fs(f)} as a mixed number.`,
          answers: [uniq([mixed(f), mixed(simp(f))])],
          hints: [`How many whole ones are in ${fs(f)}? Each whole is ${d}/${d}.`, `Divide ${f.n} by ${d}. The remainder tells you the fraction part.`, `${d} × ${w} = ${d * w}.`],
          explanation: `${f.n} ÷ ${d} = ${w} remainder ${r}, so ${fs(f)} = ${mixed(f)}.`,
          solution: [
            { say: `Find the wholes: ${f.n} ÷ ${d}.`, show: `${f.n} ÷ ${d} = ${w} r ${r}` },
            { say: 'The remainder is the fraction part.', show: `${fs(f)} = ${mixed(f)}` },
          ],
        })
      }
      return textItem({
        prompt: `Write ${mixed(f)} as an improper fraction.`,
        answers: [uniq([fs(f), fs(simp(f))])],
        hints: [`Each whole one is ${d}/${d}.`, `Change the ${w} whole${w > 1 ? 's' : ''} into ${denName(d)}, then add ${r}/${d}.`, `${w} × ${d} = ${w * d}.`],
        explanation: `${w} whole${w > 1 ? 's' : ''} = ${w * d}/${d}. Add ${r}/${d} to get ${fs(f)}.`,
        solution: [
          { say: `Change the wholes into ${denName(d)}.`, show: `${w} = ${w * d}/${d}` },
          { say: 'Add the fraction part.', show: `${w * d}/${d} + ${r}/${d} = ${fs(f)}` },
        ],
      })
    }

    if (level === 4) {
      const b = rng.pick([2, 3, 4, 5])
      const dens = [b, 2 * b, 4 * b].filter((d) => d <= 20)
      const L = Math.max(...dens)
      const fr: Frac[] = []
      const seen = new Set<number>()
      while (fr.length < 4) {
        const d = rng.pick(dens)
        const n = rng.int(1, 2 * d - 1)
        if (n === d) continue
        const v = over({ n, d }, L)
        if (seen.has(v)) continue
        seen.add(v)
        fr.push({ n, d })
      }
      const asc = [...fr].sort((x, y) => over(x, L) - over(y, L))
      const desc = rng.chance(0.4)
      const show = (x: Frac) => mixed(simp(x))
      const items = (desc ? [...asc].reverse() : asc).map(show)
      return orderItem({
        prompt: `Put these fractions in order, starting with the ${desc ? 'largest' : 'smallest'}.`,
        items,
        hints: ['Change mixed numbers into improper fractions first.', `Then write every fraction in ${denName(L)}.`, `${show(at(fr, 0))} = ${over(at(fr, 0), L)}/${L}.`],
        explanation: `In ${denName(L)}: ${asc.map((x) => `${show(x)} = ${over(x, L)}/${L}`).join(', ')}. So the order is ${items.join(', ')}.`,
        solution: [
          { say: `Write each one in ${denName(L)}.`, show: fr.map((x) => `${show(x)} = ${over(x, L)}/${L}`).join(', ') },
          { say: 'Compare the numerators.', show: asc.map(show).join(' < ') },
        ],
      })
    }

    if (rng.chance(0.5)) {
      const q = rng.pick([2, 3, 4, 5, 6])
      const a = rng.int(1, q - 1)
      const b2 = a + 1
      const L = 2 * q
      const mid = { n: a * 2 + 1, d: L }
      return textItem({
        prompt: `Which fraction is exactly halfway between ${fs(simp({ n: a, d: q }))} and ${fs(simp({ n: b2, d: q }))}?`,
        answers: [fracAnswers(mid, { decimal: true })],
        hints: ['Write both fractions with the same denominator.', `Use ${denName(L)} for both fractions.`, `${fs(simp({ n: a, d: q }))} = ${2 * a}/${L}.`],
        explanation: `${fs(simp({ n: a, d: q }))} = ${2 * a}/${L} and ${fs(simp({ n: b2, d: q }))} = ${2 * b2}/${L}. Halfway between them is ${fs(mid)}.`,
        solution: [
          { say: `Change both into ${denName(L)}.`, show: `${2 * a}/${L} and ${2 * b2}/${L}` },
          { say: 'Find the numerator in the middle.', show: fs(mid) },
        ],
        secs: 120,
      })
    }
    const base = rng.pick([{ n: 2, d: 3 }, { n: 3, d: 4 }, { n: 3, d: 5 }, { n: 1, d: 2 }, { n: 2, d: 5 }])
    const pool: Frac[] = [
      { n: 3, d: 4 }, { n: 5, d: 8 }, { n: 7, d: 12 }, { n: 3, d: 5 }, { n: 4, d: 5 }, { n: 5, d: 6 }, { n: 2, d: 3 }, { n: 7, d: 10 },
      { n: 1, d: 2 }, { n: 5, d: 12 }, { n: 3, d: 8 }, { n: 9, d: 10 }, { n: 2, d: 5 }, { n: 4, d: 9 },
      { n: 1, d: 3 }, { n: 1, d: 4 }, { n: 3, d: 10 }, { n: 1, d: 5 },
    ].filter((f) => f.n * base.d !== base.n * f.d)
    const bigger = pool.filter((f) => f.n * base.d > base.n * f.d)
    const smaller = pool.filter((f) => f.n * base.d < base.n * f.d)
    const c = rng.pick(bigger)
    const wrong = rng.sample(smaller, 3)
    const L2 = (f: Frac) => lcm(f.d, base.d)
    const m = mcqFrom(
      rng,
      fs(c),
      wrong.map((f) => ({ value: fs(f), why: `In ${denName(L2(f))}, ${fs(f)} = ${over(f, L2(f))}/${L2(f)} and ${fs(base)} = ${over(base, L2(f))}/${L2(f)}. It is smaller.` })),
      4,
      (v) => v,
    )
    return mcqItem({
      prompt: `Which fraction is greater than ${fs(base)}?`,
      ...m,
      hints: ['Compare each option with the fraction in the question.', 'Give the two fractions the same denominator before you compare.', `For ${fs(at(wrong, 0))}, use ${denName(L2(at(wrong, 0)))}.`],
      explanation: `In ${denName(L2(c))}, ${fs(c)} = ${over(c, L2(c))}/${L2(c)} and ${fs(base)} = ${over(base, L2(c))}/${L2(c)}. So ${fs(c)} is greater.`,
      solution: [
        { say: 'Use a common denominator for each pair.' },
        { say: 'Compare the numerators.', show: `${over(c, L2(c))}/${L2(c)} > ${over(base, L2(c))}/${L2(c)}` },
      ],
      secs: 120,
    })
  },
}

const addSubtractFractions: Generator = {
  skill: 'm5.add-subtract-fractions',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level <= 2) {
      const d = rng.int(5, 12)
      let a: number
      let b: number
      let add: boolean
      let oneMinus = false
      if (level === 1) {
        add = rng.chance(0.6)
        if (add) {
          a = rng.int(1, d - 2)
          b = rng.int(1, d - 1 - a)
        } else {
          a = rng.int(3, d - 1)
          b = rng.int(1, a - 1)
        }
      } else {
        oneMinus = rng.chance(0.35)
        add = !oneMinus
        if (oneMinus) {
          a = d
          b = rng.int(1, d - 1)
        } else {
          a = rng.int(Math.ceil(d / 2), d - 1)
          b = rng.int(d - a + 1, d - 1)
        }
      }
      const res = { n: add ? a + b : a - b, d }
      const left = oneMinus ? '1' : `${a}/${d}`
      const op = add ? '+' : '−'
      return textItem({
        prompt: `Work out ${left} ${op} ${b}/${d}.`,
        answers: [fracAnswers(res)],
        figure: oneMinus ? fracFig(d, d) : fracFig(a, d),
        hints: oneMinus
          ? [`1 whole is the same as ${d}/${d}.`, `Take ${b}/${d} away from ${d}/${d}.`, `Think of it as ${d} ${denName(d)} take away ${b} ${denName(d, b !== 1)}.`]
          : [
              'The denominators are the same, so the parts are the same size.',
              `${add ? 'Add' : 'Subtract'} the numerators. Keep the denominator.`,
              `Think of it as ${a} ${denName(d, a !== 1)} ${add ? 'and' : 'take away'} ${b} ${denName(d, b !== 1)}.`,
            ],
        explanation: `${oneMinus ? `${d}/${d}` : `${a}/${d}`} ${op} ${b}/${d} = ${fs(res)}${res.n > d ? ` = ${mixed(res)}` : ''}${simp(res).d !== d ? ` = ${mixed(simp(res))}` : ''}.`,
        solution: [
          { say: 'Same denominators, so work with the numerators.', show: `${oneMinus ? d : a} ${op} ${b} = ${res.n}` },
          { say: 'Keep the denominator.', show: `${fs(res)}${res.n > d ? ` = ${mixed(res)}` : ''}` },
        ],
      })
    }

    if (level === 3) {
      const b = rng.pick([2, 3, 4, 5])
      const k = rng.pick([2, 3, 4].filter((x) => b * x <= 16))
      const D = b * k
      const a1 = rng.int(1, b - 1)
      let a2 = rng.int(1, D - 1)
      if (a2 % k === 0) a2 = a2 === D - 1 ? a2 - 1 : a2 + 1
      if (a2 % k === 0 || a2 <= 0) a2 = 1
      const add = rng.chance(0.5)
      const big = a1 * k >= a2 ? 'first' : 'second'
      const res = add ? { n: a1 * k + a2, d: D } : { n: Math.abs(a1 * k - a2), d: D }
      const expr = add || big === 'first' ? `${a1}/${b} ${add ? '+' : '−'} ${a2}/${D}` : `${a2}/${D} − ${a1}/${b}`
      if (res.n === 0) {
        return textItem({
          prompt: `Work out ${a1}/${b} + ${a2}/${D}.`,
          answers: [fracAnswers({ n: a1 * k + a2, d: D })],
          hints: ['Make the denominators the same first.', `Change ${a1}/${b} into ${denName(D)}.`, `${a1}/${b} = ${a1 * k}/${D}.`],
          explanation: `${a1}/${b} = ${a1 * k}/${D}, so the sum is ${fs({ n: a1 * k + a2, d: D })}.`,
          solution: [{ say: 'Same denominators first.', show: `${a1 * k}/${D} + ${a2}/${D}` }, { say: 'Add the numerators.', show: fs({ n: a1 * k + a2, d: D }) }],
        })
      }
      return textItem({
        prompt: `Work out ${expr}.`,
        answers: [fracAnswers(res)],
        hints: ['The denominators are different. Make them the same first.', `${b} × ${k} = ${D}, so change ${a1}/${b} into ${denName(D)}.`, `${a1}/${b} = ${a1 * k}/${D}.`],
        explanation: `${a1}/${b} = ${a1 * k}/${D}. Then ${add ? `${a1 * k}/${D} + ${a2}/${D}` : big === 'first' ? `${a1 * k}/${D} − ${a2}/${D}` : `${a2}/${D} − ${a1 * k}/${D}`} = ${fs(res)}${simp(res).d !== D || res.n > D ? ` = ${mixed(simp(res))}` : ''}.`,
        solution: [
          { say: `Change ${a1}/${b} into ${denName(D)}.`, show: `${a1}/${b} = ${a1 * k}/${D}` },
          { say: `${add ? 'Add' : 'Subtract'} the numerators.`, show: `${fs(res)}${simp(res).d !== D || res.n > D ? ` = ${mixed(simp(res))}` : ''}` },
        ],
      })
    }

    if (level === 4) {
      const name = rng.pick(NAMES)
      const b = rng.pick([2, 4])
      const D = 8
      const k = D / b
      const a1 = rng.int(1, b - 1)
      const a2 = rng.pick(range(1, D - 1 - a1 * k).filter((x) => x % 2 === 1))
      const t = rng.int(0, 1)
      if (t === 0) {
        const used = a1 * k + a2
        const res = { n: D - used, d: D }
        return textItem({
          prompt: `${name} drinks ${a1}/${b} of a bottle of water in the morning and ${a2}/${D} in the afternoon. What fraction of the bottle is left?`,
          answers: [fracAnswers(res)],
          hints: ['First find how much was drunk altogether.', `Change ${a1}/${b} into eighths, then add ${a2}/${D}.`, `${a1}/${b} = ${a1 * k}/${D}.`],
          explanation: `${a1}/${b} + ${a2}/${D} = ${a1 * k}/${D} + ${a2}/${D} = ${used}/${D}. Left: ${D}/${D} − ${used}/${D} = ${fs(res)}${simp(res).d !== D ? ` = ${fs(simp(res))}` : ''}.`,
          solution: [
            { say: 'Add what was drunk.', show: `${a1 * k}/${D} + ${a2}/${D} = ${used}/${D}`, figure: fracFig(used, D) },
            { say: 'Take it away from the whole bottle.', show: `${D}/${D} − ${used}/${D} = ${fs(res)}` },
          ],
          tags: [WP],
          secs: 150,
        })
      }
      const total = { n: rng.pick([5, 7]), d: 8 }
      const cut = rng.pick([{ n: 1, d: 4 }, { n: 1, d: 2 }, { n: 3, d: 4 }].filter((c) => c.n * (8 / c.d) < total.n))
      const res = { n: total.n - cut.n * (8 / cut.d), d: 8 }
      return textItem({
        prompt: `A ribbon is ${fs(total)} m long. ${name} cuts off ${fs(cut)} m. How long is the ribbon now, in metres?`,
        answers: [fracAnswers(res, { decimal: true })],
        hints: ['Cutting off means subtract.', `Change ${fs(cut)} into eighths.`, `${fs(cut)} = ${cut.n * (8 / cut.d)}/8.`],
        explanation: `${fs(total)} − ${fs(cut)} = ${total.n}/8 − ${cut.n * (8 / cut.d)}/8 = ${fs(res)}${simp(res).d !== 8 ? ` = ${fs(simp(res))}` : ''} m.`,
        solution: [
          { say: 'Use eighths for both.', show: `${total.n}/8 − ${cut.n * (8 / cut.d)}/8` },
          { say: 'Subtract the numerators.', show: `${fs(res)} m` },
        ],
        tags: [WP],
        secs: 120,
      })
    }

    const b = rng.pick([2, 3, 4, 5])
    const k = rng.pick([1, 2].filter((x) => b * x <= 10))
    const D = b * k
    const w1 = rng.int(1, 4)
    const w2 = rng.int(1, 3)
    const n1 = rng.int(1, b - 1)
    const n2 = rng.pick(range(1, D - 1).filter((x) => gcd(x, D) === 1))
    const f1 = { n: w1 * D + n1 * k, d: D }
    const f2 = { n: w2 * D + n2, d: D }
    const add = rng.chance(0.5) || f1.n <= f2.n
    const res = { n: add ? f1.n + f2.n : f1.n - f2.n, d: D }
    const m1 = mixed({ n: w1 * b + n1, d: b })
    const m2 = mixed(f2)
    return textItem({
      prompt: `Work out ${m1} ${add ? '+' : '−'} ${m2}.`,
      answers: [fracAnswers(res)],
      hints: [
        add ? 'Add the whole numbers, then add the fractions.' : 'Change both mixed numbers into improper fractions first.',
        k > 1 ? `Use ${denName(D)} for both fractions.` : `Both fractions are in ${denName(D)}.`,
        add ? `${w1} + ${w2} = ${w1 + w2}.` : `${m1} = ${fs(f1)}.`,
      ],
      explanation: `${m1} ${add ? '+' : '−'} ${m2} = ${fs(f1)} ${add ? '+' : '−'} ${fs(f2)} = ${fs(res)} = ${mixed(simp(res))}.`,
      solution: [
        { say: 'Write both as improper fractions with the same denominator.', show: `${fs(f1)} ${add ? '+' : '−'} ${fs(f2)}` },
        { say: `${add ? 'Add' : 'Subtract'} the numerators.`, show: fs(res) },
        { say: 'Change back to a mixed number.', show: mixed(simp(res)) },
      ],
      secs: 150,
    })
  },
}

const fractionsOfAmounts: Generator = {
  skill: 'm5.fractions-of-amounts',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level <= 2) {
      const d = level === 1 ? rng.int(2, 10) : rng.int(3, 10)
      const aa = level === 1 ? 1 : rng.int(2, d - 1)
      let k = rng.int(3, 12)
      if (k === d) k += 1
      const n = d * k
      const ans = aa * k
      const thing = rng.pick(COUNT_NOUNS)
      return numItem({
        prompt: `What is ${aa}/${d} of ${n}${level === 2 ? ` ${thing}` : ''}?`,
        answer: ans,
        figure: fracFig(aa, d, 'bar', String(n)),
        hints: [`Split ${n} into ${d} equal parts.`, aa === 1 ? `Divide ${n} by ${d}.` : `Find 1/${d} first, then multiply by ${aa}.`, aa === 1 ? `Think: ${d} times which number makes ${n}?` : `${n} ÷ ${d} = ${k}.`],
        explanation: aa === 1 ? `${n} ÷ ${d} = ${k}, so 1/${d} of ${n} is ${k}.` : `1/${d} of ${n} is ${n} ÷ ${d} = ${k}. So ${aa}/${d} of ${n} is ${aa} × ${k} = ${ans}.`,
        solution: [
          { say: `Find 1/${d}.`, show: `${n} ÷ ${d} = ${k}`, figure: fracFig(1, d, 'bar', String(n)) },
          aa > 1 ? { say: `Then ${aa} lots of that.`, show: `${aa} × ${k} = ${ans}` } : { say: 'Check by multiplying.', show: `${k} × ${d} = ${n}` },
        ],
      })
    }
    if (level === 3) {
      const style = rng.int(0, 2)
      if (style === 0) {
        const d = rng.pick([4, 5, 8, 10])
        const a = rng.pick(range(1, d - 1).filter((x) => gcd(x, d) === 1))
        const each = rng.int(2, 12) * 500
        const n = d * each
        return numItem({
          prompt: `What is ${a}/${d} of ${rupiah(n)}? Give the answer in rupiah.`,
          answer: a * each,
          hints: [`Find 1/${d} of ${rupiah(n)} first.`, `Divide ${rupiah(n)} by ${d}, then multiply by ${a}.`, `${rupiah(n)} ÷ ${d} = ${rupiah(each)}.`],
          explanation: `1/${d} of ${rupiah(n)} is ${rupiah(each)}, so ${a}/${d} is ${a} × ${rupiah(each)} = ${rupiah(a * each)}.`,
          solution: [
            { say: `Find 1/${d}.`, show: `${fmt(n)} ÷ ${d} = ${fmt(each)}` },
            { say: `Multiply by ${a}.`, show: `${a} × ${fmt(each)} = ${fmt(a * each)}` },
          ],
        })
      }
      const conv = rng.pick([
        { big: 'kg', small: 'g', f: 1000 },
        { big: 'm', small: 'cm', f: 100 },
        { big: 'litres', small: 'ml', f: 1000 },
        { big: 'hours', small: 'minutes', f: 60 },
      ] as const)
      const d = rng.pick([2, 3, 4, 5].filter((x) => conv.f % x === 0 || x === 3))
      const a = rng.int(1, d - 1)
      const qty = conv.f === 60 ? rng.int(1, 3) : rng.int(1, 4)
      const total = qty * conv.f
      if (total % d !== 0) {
        const d2 = 4
        const a2 = 3
        const tot2 = conv.f === 60 ? 2 * 60 : 2 * conv.f
        return numItem({
          prompt: `What is ${a2}/${d2} of 2 ${conv.big}? Give the answer in ${conv.small}.`,
          answer: (a2 * tot2) / d2,
          unit: conv.small,
          hints: [`Change 2 ${conv.big} into ${conv.small} first.`, `Then find 1/${d2} and multiply by ${a2}.`, `2 ${conv.big} = ${fmt(tot2)} ${conv.small}.`],
          explanation: `2 ${conv.big} = ${fmt(tot2)} ${conv.small}. 1/${d2} of it is ${fmt(tot2 / d2)}, so ${a2}/${d2} is ${fmt((a2 * tot2) / d2)} ${conv.small}.`,
          solution: [
            { say: 'Change the units.', show: `2 ${conv.big} = ${fmt(tot2)} ${conv.small}` },
            { say: `Find ${a2}/${d2}.`, show: `${fmt(tot2)} ÷ ${d2} × ${a2} = ${fmt((a2 * tot2) / d2)}` },
          ],
        })
      }
      const one = total / d
      return numItem({
        prompt: `What is ${a}/${d} of ${qty} ${qty === 1 ? conv.big.replace(/s$/, '') : conv.big}? Give the answer in ${conv.small}.`,
        answer: a * one,
        unit: conv.small,
        hints: [`Change ${qty} ${qty === 1 ? conv.big.replace(/s$/, '') : conv.big} into ${conv.small} first.`, `Then find 1/${d} and multiply by ${a}.`, `${qty} ${qty === 1 ? conv.big.replace(/s$/, '') : conv.big} = ${fmt(total)} ${conv.small}.`],
        explanation: `${qty} ${qty === 1 ? conv.big.replace(/s$/, '') : conv.big} = ${fmt(total)} ${conv.small}. 1/${d} of it is ${fmt(one)}, so ${a}/${d} is ${fmt(a * one)} ${conv.small}.`,
        solution: [
          { say: 'Change the units first.', show: `${qty} ${qty === 1 ? conv.big.replace(/s$/, '') : conv.big} = ${fmt(total)} ${conv.small}` },
          { say: `Find ${a}/${d}.`, show: `${fmt(total)} ÷ ${d} × ${a} = ${fmt(a * one)}` },
        ],
      })
    }
    if (level === 4) {
      const name = rng.pick(NAMES)
      if (rng.chance(0.5)) {
        const d = rng.pick([3, 4, 5, 8, 10])
        const a = rng.pick(range(1, d - 1).filter((x) => gcd(x, d) === 1))
        const each = rng.int(2, 10) * 1000
        const n = d * each
        const spent = a * each
        const item = rng.pick(['a book', 'a football', 'a puzzle', 'some paints'] as const)
        return numItem({
          prompt: `${name} has ${rupiah(n)}. ${name} spends ${a}/${d} of it on ${item}. How much money is left, in rupiah?`,
          answer: n - spent,
          hints: ['First find how much was spent.', a === 1 ? `Find 1/${d} of ${rupiah(n)}, then subtract it.` : `Find 1/${d} of ${rupiah(n)}, then ${a} lots of it.`, `${rupiah(n)} ÷ ${d} = ${rupiah(each)}.`],
          explanation: `${a}/${d} of ${rupiah(n)} is ${rupiah(spent)}. ${rupiah(n)} − ${rupiah(spent)} = ${rupiah(n - spent)}.`,
          solution: [
            { say: 'Find the amount spent.', show: `${fmt(n)} ÷ ${d} × ${a} = ${fmt(spent)}` },
            { say: 'Subtract it.', show: `${fmt(n)} − ${fmt(spent)} = ${fmt(n - spent)}` },
          ],
          tags: [WP],
          secs: 150,
        })
      }
      const d = rng.pick([4, 5, 6, 8])
      const a = rng.pick(range(1, d - 2).filter((x) => gcd(x, d) === 1))
      const k = rng.int(3, 6)
      const n = d * k
      const walk = a * k
      const how = rng.pick(['walk', 'cycle', 'come by bus'] as const)
      return numItem({
        prompt: `A class has ${n} children. ${a}/${d} of them ${how} to school. How many children do not ${how} to school?`,
        answer: n - walk,
        hints: [`Find ${a}/${d} of ${n} first.`, 'Then subtract from the whole class.', `1/${d} of ${n} is ${k}.`],
        explanation: `${a}/${d} of ${n} is ${walk}. ${n} − ${walk} = ${n - walk} children do not ${how} to school.`,
        solution: [
          { say: `Find ${a}/${d} of ${n}.`, show: `${n} ÷ ${d} × ${a} = ${walk}`, figure: fracFig(a, d, 'bar', String(n)) },
          { say: 'Subtract from the class.', show: `${n} − ${walk} = ${n - walk}` },
        ],
        tags: [WP],
        secs: 120,
      })
    }
    const d = rng.pick([3, 4, 5, 6, 7, 8])
    const a = rng.pick(range(1, d - 1).filter((x) => gcd(x, d) === 1 && x > 1).concat(d === 3 ? [2] : []))
    const unit = rng.int(4, 30)
    const part = a * unit
    const whole = d * unit
    if (rng.chance(0.5)) {
      return numItem({
        prompt: `${a}/${d} of a number is ${part}. What is the number?`,
        answer: whole,
        hints: [`${a} parts out of ${d} make ${part}.`, `Find 1/${d} first: divide ${part} by ${a}.`, `${part} ÷ ${a} = ${unit}.`],
        explanation: `1/${d} of the number is ${part} ÷ ${a} = ${unit}. The whole number is ${d} × ${unit} = ${whole}.`,
        solution: [
          { say: 'Find one part.', show: `${part} ÷ ${a} = ${unit}`, figure: fracFig(a, d, 'bar', '?') },
          { say: `The whole is ${d} parts.`, show: `${d} × ${unit} = ${whole}` },
        ],
        secs: 120,
      })
    }
    const name = rng.pick(NAMES)
    return numItem({
      prompt: `${name} has read ${a}/${d} of a book. That is ${part} pages. How many pages does the book have?`,
      answer: whole,
      hints: [`${a}/${d} of the book is ${part} pages.`, `Find 1/${d} of the book first.`, `${part} ÷ ${a} = ${unit}.`],
      explanation: `1/${d} of the book is ${part} ÷ ${a} = ${unit} pages, so the whole book is ${d} × ${unit} = ${whole} pages.`,
      solution: [
        { say: 'Find one part.', show: `${part} ÷ ${a} = ${unit}` },
        { say: 'Multiply by the number of parts in the whole.', show: `${d} × ${unit} = ${whole}` },
      ],
      tags: [WP],
      secs: 120,
    })
  },
}

const COUNT_NOUNS = ['stickers', 'marbles', 'beads', 'stamps', 'shells', 'cards'] as const

const addSubtractDecimals: Generator = {
  skill: 'm5.add-subtract-decimals',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level <= 2) {
      const dp = level === 1 ? 1 : 2
      const add = rng.chance(0.5)
      let ua = dp === 1 ? rng.int(12, 89) : rng.int(112, 1899)
      let ub = dp === 1 ? rng.int(12, 89) : rng.int(112, 999)
      if (ua % 10 === 0) ua += rng.int(1, 9)
      if (ub % 10 === 0) ub += rng.int(1, 9)
      if (add && (ua % 10) + (ub % 10) < 10) ub = ub - (ub % 10) + rng.int(10 - (ua % 10), 9)
      if (!add && ub > ua) [ua, ub] = [ub, ua]
      if (!add && ua === ub) ua += 7
      const ans = add ? ua + ub : ua - ub
      const a = dec(ua, dp)
      const b = dec(ub, dp)
      const op = add ? '+' : '−'
      return numItem({
        prompt: `Work out ${fx(a, dp)} ${op} ${fx(b, dp)}.`,
        answer: dec(ans, dp),
        decimal: true,
        hints: [
          'Line up the decimal points.',
          add ? 'Add each column from the right. Carry into the next column when you need to.' : 'Subtract each column from the right. Exchange when the top digit is smaller.',
          `${cap(placeName(-dp))}: ${ua % 10} ${op} ${ub % 10}${!add && ua % 10 < ub % 10 ? ' needs an exchange first' : ''}.`,
        ],
        explanation: `${fx(a, dp)} ${op} ${fx(b, dp)} = ${fmt(dec(ans, dp))}. Keep the decimal points in a straight line.`,
        solution: [
          { say: 'Line up the decimal points.', show: `${fx(a, dp)} ${op} ${fx(b, dp)}` },
          ...(add ? addColumnSteps([ua, ub], dp) : subColumnSteps(ua, ub, dp)).slice(0, 5),
          { say: 'Put the decimal point in the answer.', show: fmt(dec(ans, dp)) },
        ],
      })
    }
    if (level === 3) {
      const whole = rng.chance(0.35)
      if (whole) {
        const W = rng.pick([5, 10, 20])
        const ub = rng.int(105, W * 100 - 50)
        const fixed = ub % 10 === 0 ? ub + 3 : ub
        const ans = dec(W * 100 - fixed, 2)
        return numItem({
          prompt: `Work out ${W} − ${fx(dec(fixed, 2), 2)}.`,
          answer: ans,
          decimal: true,
          hints: [`Write ${W} as ${W}.00 so both numbers have two decimal places.`, 'Then subtract column by column, exchanging as you go.', `You could also count on from ${fx(dec(fixed, 2), 2)} to ${W}.`],
          explanation: `${W}.00 − ${fx(dec(fixed, 2), 2)} = ${fmt(ans)}.`,
          solution: [{ say: `Write ${W} as ${W}.00.`, show: `${W}.00 − ${fx(dec(fixed, 2), 2)}` }, ...subColumnSteps(W * 100, fixed, 2).slice(0, 4), { say: 'Read the answer.', show: fmt(ans) }],
        })
      }
      const ua1 = rng.int(11, 99)
      let ub = rng.int(101, 899)
      if (ub % 10 === 0) ub += 7
      const add = rng.chance(0.6)
      const a = dec(ua1, 1)
      const b = dec(ub, 2)
      if (add) {
        const ans = dec(ua1 * 10 + ub, 2)
        const wrong = dec(ua1 + ub, 2)
        const m = mcqFrom(rng, fmt(ans), [
          { value: fmt(wrong), why: `Line up the decimal points. ${fmt(a)} has ${ua1 % 10} tenths, not ${ua1 % 10} hundredths.` },
          { value: fmt(dec(ua1 * 10 + ub + 100, 2)), why: 'Check the ones column again.' },
          { value: fmt(dec(ua1 * 10 + ub - 10, 2)), why: 'Check the tenths column again.' },
          { value: fmt(dec(ua1 * 10 + ub, 3)), why: 'Check where the decimal point goes in the answer.' },
        ], 4, (v) => v)
        return mcqItem({
          prompt: `What is ${fmt(a)} + ${fmt(b)}?`,
          ...m,
          hints: ['Line up the decimal points, not the last digits.', `Write ${fmt(a)} as ${fx(a, 2)} so both have two decimal places.`, `Hundredths: 0 + ${ub % 10} = ${ub % 10}.`],
          explanation: `${fx(a, 2)} + ${fmt(b)} = ${fmt(ans)}.`,
          solution: [{ say: 'Give both numbers two decimal places.', show: `${fx(a, 2)} + ${fmt(b)}` }, ...addColumnSteps([ua1 * 10, ub], 2).slice(0, 5)],
        })
      }
      const big = Math.max(ua1 * 10, ub)
      const small = Math.min(ua1 * 10, ub)
      const ans = dec(big - small, 2)
      return numItem({
        prompt: `Work out ${fmt(dec(big, 2))} − ${fmt(dec(small, 2))}.`,
        answer: ans,
        decimal: true,
        hints: ['Line up the decimal points.', 'Give both numbers two decimal places, then subtract column by column.', `Write ${fmt(dec(big, 2))} as ${fx(dec(big, 2), 2)}.`],
        explanation: `${fx(dec(big, 2), 2)} − ${fx(dec(small, 2), 2)} = ${fmt(ans)}.`,
        solution: [{ say: 'Line up the decimal points.', show: `${fx(dec(big, 2), 2)} − ${fx(dec(small, 2), 2)}` }, ...subColumnSteps(big, small, 2).slice(0, 5)],
      })
    }
    if (level === 4) {
      const ctx = rng.pick([
        { what: 'A rope', unit: 'm', verb: 'is', cut: 'cuts off' },
        { what: 'A bag of flour', unit: 'kg', verb: 'weighs', cut: 'uses' },
        { what: 'A jug', unit: 'litres', verb: 'holds', cut: 'pours out' },
      ] as const)
      const name = rng.pick(NAMES)
      const tu = rng.int(25, 95) * 10 + rng.pick([0, 5])
      const c1 = rng.int(35, Math.floor(tu / 2))
      const c2 = rng.int(15, tu - c1 - 10)
      const left = tu - c1 - c2
      return numItem({
        prompt: `${ctx.what} ${ctx.verb} ${fmt(dec(tu, 2))} ${ctx.unit}. ${name} ${ctx.cut} ${fmt(dec(c1, 2))} ${ctx.unit} and then ${fmt(dec(c2, 2))} ${ctx.unit}. How much is left?`,
        answer: dec(left, 2),
        decimal: true,
        unit: ctx.unit,
        hints: ['Add the two amounts taken first, or subtract them one at a time.', 'Line up the decimal points each time.', `${fmt(dec(c1, 2))} + ${fmt(dec(c2, 2))} = ${fmt(dec(c1 + c2, 2))}.`],
        explanation: `${fmt(dec(c1, 2))} + ${fmt(dec(c2, 2))} = ${fmt(dec(c1 + c2, 2))}. ${fmt(dec(tu, 2))} − ${fmt(dec(c1 + c2, 2))} = ${fmt(dec(left, 2))} ${ctx.unit}.`,
        solution: [
          { say: 'Add the amounts taken.', show: `${fmt(dec(c1, 2))} + ${fmt(dec(c2, 2))} = ${fmt(dec(c1 + c2, 2))}` },
          { say: 'Subtract from the start amount.', show: `${fx(dec(tu, 2), 2)} − ${fx(dec(c1 + c2, 2), 2)} = ${fmt(dec(left, 2))}` },
        ],
        tags: [WP],
        secs: 150,
      })
    }
    const us = [rng.int(105, 399), rng.int(50, 299), rng.int(105, 399)].map((u, i) => (i === 1 && u % 10 !== 0 ? u - (u % 10) : u))
    const total = sum(us)
    const target = Math.ceil(total / 100 + 1) * 100
    const ask = rng.chance(0.5)
    if (ask) {
      return numItem({
        prompt: `Three parcels weigh ${us.map((u) => `${fmt(dec(u, 2))} kg`).join(', ')}. How much more weight is needed to make ${target / 100} kg altogether?`,
        answer: dec(target - total, 2),
        decimal: true,
        unit: 'kg',
        hints: ['Find the total weight first.', `Then subtract the total from ${target / 100} kg.`, `${fmt(dec(at(us, 0), 2))} + ${fmt(dec(at(us, 1), 2))} = ${fmt(dec(at(us, 0) + at(us, 1), 2))}.`],
        explanation: `The total is ${fmt(dec(total, 2))} kg. ${target / 100} − ${fmt(dec(total, 2))} = ${fmt(dec(target - total, 2))} kg.`,
        solution: [
          { say: 'Add the three weights.', show: `${us.map((u) => fx(dec(u, 2), 2)).join(' + ')} = ${fmt(dec(total, 2))}` },
          { say: 'Count on to the target.', show: `${target / 100} − ${fmt(dec(total, 2))} = ${fmt(dec(target - total, 2))}` },
        ],
        tags: [WP],
        secs: 180,
      })
    }
    return numItem({
      prompt: `Three parcels weigh ${us.map((u) => `${fmt(dec(u, 2))} kg`).join(', ')}. What is their total weight?`,
      answer: dec(total, 2),
      decimal: true,
      unit: 'kg',
      hints: ['Line up the decimal points.', 'Give every number two decimal places, then add.', `${fmt(dec(at(us, 0), 2))} + ${fmt(dec(at(us, 1), 2))} = ${fmt(dec(at(us, 0) + at(us, 1), 2))}.`],
      explanation: `${us.map((u) => fx(dec(u, 2), 2)).join(' + ')} = ${fmt(dec(total, 2))} kg.`,
      solution: [{ say: 'Write each weight with two decimal places.', show: us.map((u) => fx(dec(u, 2), 2)).join(' + ') }, ...addColumnSteps(us, 2).slice(0, 5), { say: 'Total.', show: `${fmt(dec(total, 2))} kg` }],
      tags: [WP],
      secs: 150,
    })
  },
}

const multiplyDecimals: Generator = {
  skill: 'm5.multiply-decimals',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const tenthsSteps = (u: number, m: number): Step[] => [
      { say: `${fmt(dec(u, 1))} is ${u} tenths.` },
      { say: `${u} tenths × ${m} = ${u * m} tenths.`, show: `${u} × ${m} = ${u * m}` },
      { say: `${u * m} tenths is ${fmt(dec(u * m, 1))}.`, show: `${fmt(dec(u, 1))} × ${m} = ${fmt(dec(u * m, 1))}` },
    ]
    if (level <= 2) {
      const u = level === 1 ? rng.int(0, 3) * 10 + rng.int(1, 4) : rng.int(1, 9) * 10 + rng.int(1, 9)
      const m = level === 1 ? rng.int(2, 4) : rng.int(3, 9)
      return numItem({
        prompt: `Work out ${fmt(dec(u, 1))} × ${m}.`,
        answer: dec(u * m, 1),
        decimal: true,
        hints: [`Think of ${fmt(dec(u, 1))} as ${u} tenths.`, `Multiply ${u} by ${m}, then change the answer back into tenths.`, `${u} tenths × ${m} gives a number of tenths.`],
        explanation: `${fmt(dec(u, 1))} is ${u} tenths. ${u} × ${m} = ${u * m}, and ${u * m} tenths = ${fmt(dec(u * m, 1))}.`,
        solution: tenthsSteps(u, m),
      })
    }
    if (level === 3) {
      const u = rng.int(15, 99)
      const m = rng.int(3, 9)
      if (rng.chance(0.4)) {
        const r = Math.round(u / 10)
        const est = r * m
        const opts = [
          { value: Math.floor(u / 10) * m === est ? (Math.floor(u / 10) + 2) * m : Math.floor(u / 10) * m, why: `${fmt(dec(u, 1))} rounds to ${r}, not ${Math.floor(u / 10)}.` },
          { value: est * 10, why: `Check the size: ${fmt(dec(u, 1))} is about ${r}, so the answer is about ${r} × ${m}.` },
          { value: r + m, why: 'That adds the numbers instead of multiplying.' },
          { value: (r + 1) * m, why: `${fmt(dec(u, 1))} rounds to ${r}.` },
        ]
        const m2 = mcqFrom(rng, est, opts)
        return mcqItem({
          prompt: `Which is the best estimate for ${fmt(dec(u, 1))} × ${m}?`,
          ...m2,
          hints: ['Round the decimal to the nearest whole number.', `Which whole number is ${fmt(dec(u, 1))} closest to?`, `Multiply your rounded number by ${m}.`],
          explanation: `${fmt(dec(u, 1))} ≈ ${r}, so ${fmt(dec(u, 1))} × ${m} ≈ ${r} × ${m} = ${est}. The exact answer is ${fmt(dec(u * m, 1))}.`,
          solution: [{ say: 'Round first.', show: `${fmt(dec(u, 1))} → ${r}` }, { say: 'Multiply.', show: `${r} × ${m} = ${est}` }],
        })
      }
      const ctx = rng.pick([
        { s: (v: string) => `A bottle holds ${v} litres of water.`, q: (k: number) => `How many litres are in ${k} bottles?`, unit: 'litres' },
        { s: (v: string) => `A bag of rice weighs ${v} kg.`, q: (k: number) => `How much do ${k} bags weigh?`, unit: 'kg' },
        { s: (v: string) => `One lap of the park is ${v} km.`, q: (k: number) => `How far is ${k} laps?`, unit: 'km' },
      ])
      return numItem({
        prompt: `${ctx.s(fmt(dec(u, 1)))} ${ctx.q(m)}`,
        answer: dec(u * m, 1),
        decimal: true,
        unit: ctx.unit,
        hints: ['Equal amounts many times means multiply.', `Work out ${fmt(dec(u, 1))} × ${m}.`, `${fmt(dec(u, 1))} is ${u} tenths.`],
        explanation: `${fmt(dec(u, 1))} × ${m} = ${fmt(dec(u * m, 1))} ${ctx.unit}.`,
        solution: tenthsSteps(u, m),
        tags: [WP],
      })
    }
    if (level === 4) {
      let piece = rng.int(11, 29)
      if (piece % 10 === 0) piece += 3
      const k = rng.int(2, 5)
      const used = piece * k
      const total = Math.ceil(used / 10) + rng.int(1, 4)
      const left = total * 10 - used
      const name = rng.pick(NAMES)
      return numItem({
        prompt: `${name} has a plank that is ${total} m long. ${name} cuts ${k} pieces that are each ${fmt(dec(piece, 1))} m long. How much of the plank is left?`,
        answer: dec(left, 1),
        decimal: true,
        unit: 'm',
        hints: ['First find the total length of the pieces.', `Work out ${fmt(dec(piece, 1))} × ${k}, then subtract from ${total}.`, `${fmt(dec(piece, 1))} is ${piece} tenths.`],
        explanation: `${fmt(dec(piece, 1))} × ${k} = ${fmt(dec(used, 1))} m. ${total} − ${fmt(dec(used, 1))} = ${fmt(dec(left, 1))} m.`,
        solution: [
          { say: 'Find the length of the pieces.', show: `${fmt(dec(piece, 1))} × ${k} = ${fmt(dec(used, 1))}` },
          { say: 'Subtract from the plank.', show: `${total} − ${fmt(dec(used, 1))} = ${fmt(dec(left, 1))}` },
        ],
        tags: [WP],
        secs: 150,
      })
    }
    if (rng.chance(0.5)) {
      const t = rng.int(2, 9)
      const m = rng.int(3, 9)
      return numItem({
        prompt: `Find the missing number. ___ × ${m} = ${fmt(dec(t * m, 1))}`,
        answer: dec(t, 1),
        decimal: true,
        hints: ['Use the inverse: divide.', `${fmt(dec(t * m, 1))} is ${t * m} tenths.`, `Divide ${t * m} tenths by ${m}.`],
        explanation: `${t * m} tenths ÷ ${m} = ${t} tenths, which is ${fmt(dec(t, 1))}. Check: ${fmt(dec(t, 1))} × ${m} = ${fmt(dec(t * m, 1))}.`,
        solution: [{ say: 'Change to tenths.', show: `${fmt(dec(t * m, 1))} = ${t * m} tenths` }, { say: 'Divide.', show: `${t * m} ÷ ${m} = ${t} tenths = ${fmt(dec(t, 1))}` }],
      })
    }
    const u = rng.int(101, 499)
    const fixedU = u % 10 === 0 ? u + 5 : u
    const m = rng.int(2, 6)
    return numItem({
      prompt: `Work out ${fmt(dec(fixedU, 2))} × ${m}.`,
      answer: dec(fixedU * m, 2),
      decimal: true,
      hints: [`Think of ${fmt(dec(fixedU, 2))} as ${fixedU} hundredths.`, `Work out ${fixedU} × ${m}, then change back to hundredths.`, `${Math.floor(fixedU / 100)} × ${m} = ${Math.floor(fixedU / 100) * m}.`],
      explanation: `${fixedU} hundredths × ${m} = ${fixedU * m} hundredths = ${fmt(dec(fixedU * m, 2))}.`,
      solution: [{ say: `${fmt(dec(fixedU, 2))} is ${fixedU} hundredths.` }, { say: 'Multiply.', show: `${fixedU} × ${m} = ${fixedU * m}` }, { say: 'Change back.', show: `${fixedU * m} hundredths = ${fmt(dec(fixedU * m, 2))}` }],
    })
  },
}

const FDP: readonly [number, number][] = [
  [1, 2], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5], [1, 10], [3, 10], [7, 10], [9, 10], [1, 20], [3, 20], [7, 20], [9, 20], [1, 25], [3, 25], [1, 50], [9, 50], [17, 100], [43, 100],
]

const pct = (f: Frac): number => (f.n * 100) / f.d

const fractionsDecimalsPercentages: Generator = {
  skill: 'm5.fractions-decimals-percentages',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level === 1) {
      const N = rng.int(5, 95)
      const shaded = Array.from({ length: N }, (_, i) => [Math.floor(i / 10), i % 10] as [number, number])
      const fullRows = Math.floor(N / 10)
      return numItem({
        prompt: 'The grid has 100 equal squares. What percentage of the grid is shaded?',
        answer: N,
        unit: '%',
        figure: { kind: 'grid', rows: 10, cols: 10, shaded, alt: `A 10 by 10 grid with ${N} squares shaded: ${plur(fullRows, 'full row', 'full rows')}${N % 10 ? ` and ${plur(N % 10, 'more square', 'more squares')}` : ''}.` },
        hints: ['Per cent means out of 100.', 'Each full row has 10 squares. Count the rows, then the extra squares.', `There ${fullRows === 1 ? 'is' : 'are'} ${fullRows} full row${fullRows === 1 ? '' : 's'}.`],
        explanation: `${N} out of 100 squares are shaded, so ${N}% is shaded.`,
        solution: [{ say: 'Count the shaded squares.', show: `${fullRows} × 10 + ${N % 10} = ${N}` }, { say: 'Out of 100 means per cent.', show: `${N}/100 = ${N}%` }],
      })
    }
    if (level === 2) {
      const [n, d] = rng.pick(FDP.filter(([, d]) => d <= 25))
      const f = { n, d }
      const p = pct(f)
      if (rng.chance(0.4)) {
        const m = mcqFrom(
          rng,
          `${p}%`,
          rng.shuffle([
            { value: `${n}%`, why: `${n}% is ${n}/100, not ${n}/${d}.` },
            { value: `${d}%`, why: 'The denominator is not the percentage.' },
            { value: `${(n * 100) / d / 2}%`, why: `Check: ${n}/${d} = ${p}/100.` },
            { value: `${100 - p}%`, why: `That is the part that is not ${n}/${d}.` },
          ]),
          4,
          (v) => v,
        )
        return mcqItem({
          prompt: `Which percentage is equal to ${n}/${d}?`,
          ...m,
          hints: ['A percentage is a number of hundredths.', `Make an equivalent fraction with denominator 100.`, n === 1 ? `Think of 100 split into ${d} equal parts.` : `${d} × ${100 / d} = 100.`],
          explanation: `${n}/${d} = ${p}/100 = ${p}%.`,
          solution: [{ say: `Multiply the top and the bottom by ${100 / d}.`, show: `${n}/${d} = ${p}/100` }, { say: 'Hundredths are a percentage.', show: `${p}%` }],
        })
      }
      return numItem({
        prompt: `Write ${n}/${d} as a percentage.`,
        answer: p,
        unit: '%',
        hints: ['A percentage is a number of hundredths.', 'Make an equivalent fraction with denominator 100.', n === 1 ? `Think of 100 split into ${d} equal parts.` : `${d} × ${100 / d} = 100.`],
        explanation: `${n}/${d} = ${p}/100 = ${p}%.`,
        solution: [{ say: `Multiply the top and the bottom by ${100 / d}.`, show: `${n}/${d} = ${p}/100` }, { say: 'Hundredths are a percentage.', show: `${p}%` }],
      })
    }
    if (level === 3) {
      const style = rng.int(0, 2)
      if (style === 0) {
        const u = rng.pick([rng.int(1, 9), rng.int(11, 99), rng.int(1, 9) * 10])
        const d = dec(u, 2)
        return numItem({
          prompt: `Write ${fmt(d)} as a percentage.`,
          answer: u,
          unit: '%',
          hints: ['Per cent means out of 100.', `${fmt(d)} is a number of hundredths.`, `Multiply ${fmt(d)} by 100.`],
          explanation: `${fmt(d)} = ${u}/100 = ${u}%.`,
          solution: [{ say: 'Change the decimal into hundredths.', show: `${fmt(d)} = ${u}/100` }, { say: 'Hundredths are a percentage.', show: `${u}%` }],
        })
      }
      if (style === 1) {
        const u = rng.pick([rng.int(1, 9), rng.int(11, 99), rng.int(1, 9) * 10])
        return numItem({
          prompt: `Write ${u}% as a decimal.`,
          answer: dec(u, 2),
          decimal: true,
          hints: ['Per cent means out of 100.', `${u}% is ${u}/100.`, 'Divide by 100: each digit moves two places to the right.'],
          explanation: `${u}% = ${u}/100 = ${fmt(dec(u, 2))}.`,
          solution: [{ say: 'Write it as hundredths.', show: `${u}% = ${u}/100` }, { say: 'Divide by 100.', show: fmt(dec(u, 2)) }],
        })
      }
      const picks = rng.sample(FDP.filter(([, d]) => d <= 20), 4)
      return matchItem({
        prompt: 'Match each fraction to the equal percentage.',
        pairs: picks.map(([n, d]) => [`${n}/${d}`, `${pct({ n, d })}%`] as [string, string]),
        hints: ['A percentage is a number of hundredths.', 'Change each fraction into hundredths.', `${at(picks, 0)[0]}/${at(picks, 0)[1]} = ${pct({ n: at(picks, 0)[0], d: at(picks, 0)[1] })}/100.`],
        explanation: picks.map(([n, d]) => `${n}/${d} = ${pct({ n, d })}%`).join(', ') + '.',
        solution: [{ say: 'Write each fraction out of 100.', show: picks.map(([n, d]) => `${n}/${d} = ${pct({ n, d })}/100`).join(', ') }, { say: 'Hundredths are percentages.' }],
      })
    }
    if (level === 4) {
      const vals = new Set<number>()
      const forms: { text: string; v: number; how: string }[] = []
      while (forms.length < 4) {
        const kind = forms.length % 3
        const [n, d] = rng.pick(FDP)
        const p = pct({ n, d })
        if (vals.has(p)) continue
        vals.add(p)
        if (kind === 0) forms.push({ text: `${n}/${d}`, v: p, how: `${n}/${d} = ${p}%` })
        else if (kind === 1) forms.push({ text: fmt(dec(p, 2)), v: p, how: `${fmt(dec(p, 2))} = ${p}%` })
        else forms.push({ text: `${p}%`, v: p, how: `${p}%` })
      }
      const largest = rng.chance(0.5)
      const sorted = [...forms].sort((a, b) => a.v - b.v)
      if (rng.chance(0.5)) {
        const c = largest ? at(sorted, 3) : at(sorted, 0)
        const m = mcqFrom(
          rng,
          c.text,
          forms.filter((f) => f !== c).map((f) => ({ value: f.text, why: `${f.how}, which is ${f.v < c.v ? 'less' : 'more'} than ${c.v}%.` })),
          4,
          (v) => v,
        )
        return mcqItem({
          prompt: `Which is the ${largest ? 'largest' : 'smallest'}?`,
          ...m,
          hints: ['The numbers are written in different ways.', 'Change them all into percentages first.', `${(forms.find((f) => f !== c && !f.text.endsWith('%')) ?? at(forms, 0)).how}.`],
          explanation: `As percentages: ${forms.map((f) => f.how).join(', ')}. The ${largest ? 'largest' : 'smallest'} is ${c.text}.`,
          solution: [{ say: 'Change each one into a percentage.', show: forms.map((f) => `${f.v}%`).join(', ') }, { say: 'Compare.', show: c.text }],
        })
      }
      return orderItem({
        prompt: 'Put these in order, starting with the smallest.',
        items: sorted.map((f) => f.text),
        hints: ['Change every number into a percentage.', 'Then compare the percentages.', `${at(forms, 0).how}.`],
        explanation: `As percentages: ${sorted.map((f) => f.how).join(', ')}.`,
        solution: [{ say: 'Change each one into a percentage.', show: forms.map((f) => `${f.text} = ${f.v}%`).join(', ') }, { say: 'Order them.', show: sorted.map((f) => f.text).join(' < ') }],
      })
    }
    if (rng.chance(0.5)) {
      const [n, d] = rng.pick(FDP.filter(([, d]) => d <= 10))
      const p = pct({ n, d })
      const how = rng.pick(['walk to school', 'have a pet', 'play football', 'like mangoes'] as const)
      return numItem({
        prompt: `In a class, ${n}/${d} of the children ${how}. What percentage of the children do not ${how}?`,
        answer: 100 - p,
        unit: '%',
        hints: ['The whole class is 100%.', `Change ${n}/${d} into a percentage first.`, `${n}/${d} = ${p}/100.`],
        explanation: `${n}/${d} = ${p}%. The rest is 100% − ${p}% = ${100 - p}%.`,
        solution: [{ say: 'Change the fraction into a percentage.', show: `${n}/${d} = ${p}%` }, { say: 'Subtract from 100%.', show: `100% − ${p}% = ${100 - p}%` }],
        tags: [WP],
      })
    }
    const out = rng.pick([20, 25, 50])
    const got = rng.int(Math.ceil(out * 0.4), out - 1)
    const name = rng.pick(NAMES)
    return numItem({
      prompt: `${name} scored ${got} out of ${out} in a spelling test. What percentage is that?`,
      answer: (got * 100) / out,
      unit: '%',
      hints: [`Write the score as a fraction: ${got}/${out}.`, 'Make an equivalent fraction with denominator 100.', `${out} × ${100 / out} = 100.`],
      explanation: `${got}/${out} = ${(got * 100) / out}/100 = ${(got * 100) / out}%.`,
      solution: [{ say: 'Write the score as a fraction.', show: `${got}/${out}` }, { say: `Multiply the top and the bottom by ${100 / out}.`, show: `${(got * 100) / out}/100 = ${(got * 100) / out}%` }],
      tags: [WP],
    })
  },
}

/** Langkah pertama yang tidak membocorkan jawaban untuk persen satu langkah. */
function firstStepHint(p: number, n: number): string {
  if (p === 50) return `Halving ${fmt(n)} is the same as dividing it by 2.`
  if (p === 25) return `Start by halving ${fmt(n)}.`
  if (p === 1) return `Dividing by 100 moves each digit of ${fmt(n)} two places to the right.`
  if (p === 10) return `Dividing by 10 moves each digit of ${fmt(n)} one place to the right.`
  return `Start with 10% of ${fmt(n)}.`
}

const percentagesOfAmounts: Generator = {
  skill: 'm5.percentages-of-amounts',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const how = (p: number, n: number, f: (x: number) => string = fmt): { hint: string; steps: Step[] } => {
      const ten = n / 10
      if (p === 50) return { hint: '50% is one half of the amount.', steps: [{ say: '50% is one half.', show: `${f(n)} ÷ 2 = ${f(n / 2)}` }] }
      if (p === 25) return { hint: `25% is a quarter. Halve ${f(n)}, then halve again.`, steps: [{ say: '25% is one quarter.', show: `${f(n)} ÷ 4 = ${f(n / 4)}` }] }
      if (p === 75) return { hint: 'Find 25% first, then multiply by 3.', steps: [{ say: '25% is one quarter.', show: `${f(n)} ÷ 4 = ${f(n / 4)}` }, { say: '75% is three quarters.', show: `${f(n / 4)} × 3 = ${f((3 * n) / 4)}` }] }
      if (p === 1) return { hint: `1% is one hundredth. Divide ${f(n)} by 100.`, steps: [{ say: '1% is one hundredth.', show: `${f(n)} ÷ 100 = ${f(n / 100)}` }] }
      if (p === 5) return { hint: 'Find 10% first, then halve it.', steps: [{ say: 'Find 10%.', show: `${f(n)} ÷ 10 = ${f(ten)}` }, { say: '5% is half of 10%.', show: `${f(ten)} ÷ 2 = ${f(ten / 2)}` }] }
      if (p % 10 === 0) return { hint: `Find 10% first: ${f(n)} ÷ 10.`, steps: [{ say: 'Find 10%.', show: `${f(n)} ÷ 10 = ${f(ten)}` }, ...(p === 10 ? [] : [{ say: `${p}% is ${p / 10} lots of 10%.`, show: `${f(ten)} × ${p / 10} = ${f((ten * p) / 10)}` }])] }
      return { hint: 'Find 10% and 5%, then combine them.', steps: [{ say: 'Find 10% and 5%.', show: `10% = ${f(ten)}, 5% = ${f(ten / 2)}` }, { say: 'Add them.', show: `${f(ten)} + ${f(ten / 2)} = ${f((ten * 3) / 2)}` }] }
    }
    if (level <= 2) {
      const p = level === 1 ? rng.pick([50, 10, 25]) : rng.pick([20, 75, 5, 1, 30, 40, 60, 15])
      const base = p === 1 ? 100 : p === 5 || p === 15 ? 20 : p === 25 || p === 75 ? 4 : p === 50 ? 2 : 10
      const n = base * (p === 1 ? rng.int(2, 9) : rng.int(Math.ceil(20 / base), Math.floor(800 / base)))
      const ans = (n * p) / 100
      const h = how(p, n)
      return numItem({
        prompt: `What is ${p}% of ${fmt(n)}?`,
        answer: ans,
        hints: [`${p}% means ${p} out of every 100.`, h.hint.replace(' = ?', '.'), h.steps.length > 1 && h.steps[0]?.show ? `${h.steps[0].show}.` : firstStepHint(p, n)],
        explanation: `${p}% of ${fmt(n)} = ${fmt(ans)}.`,
        solution: [...h.steps, { say: `So ${p}% of ${fmt(n)} is ${fmt(ans)}.`, show: fmt(ans) }],
      })
    }
    if (level === 3) {
      const p = rng.pick([10, 20, 25, 30, 50, 75])
      const price = rng.int(4, 30) * (p === 25 || p === 75 ? 4000 : 5000)
      const off = (price * p) / 100
      const h = how(p, price, rupiah)
      const item = rng.pick(['bag', 'pair of shoes', 'football', 'jacket', 'board game'] as const)
      return numItem({
        prompt: `A ${item} costs ${rupiah(price)}. The shop takes ${p}% off. How much money is taken off, in rupiah?`,
        answer: off,
        hints: [`Find ${p}% of ${rupiah(price)}.`, h.hint.replace(' = ?', '.'), h.steps.length > 1 && h.steps[0]?.show ? `${h.steps[0].show}.` : firstStepHint(p, price)],
        explanation: `${p}% of ${rupiah(price)} is ${rupiah(off)}.`,
        solution: [...h.steps, { say: `So ${rupiah(off)} is taken off.`, show: rupiah(off) }],
        tags: [WP],
      })
    }
    if (level === 4) {
      const p = rng.pick([10, 15, 20, 25, 30, 40])
      const price = rng.int(5, 40) * (p === 25 ? 4000 : p === 15 ? 20000 : 10000)
      const off = (price * p) / 100
      const h = how(p, price, rupiah)
      const item = rng.pick(['bicycle helmet', 'school bag', 'pair of trainers', 'tennis racket'] as const)
      return numItem({
        prompt: `A ${item} costs ${rupiah(price)}. In a sale it is ${p}% off. What is the sale price, in rupiah?`,
        answer: price - off,
        hints: ['Find the amount taken off first.', `Find ${p}% of ${rupiah(price)}, then subtract it.`, h.steps.length > 1 && h.steps[0]?.show ? `${h.steps[0].show}.` : firstStepHint(p, price)],
        explanation: `${p}% of ${rupiah(price)} is ${rupiah(off)}. ${rupiah(price)} − ${rupiah(off)} = ${rupiah(price - off)}.`,
        solution: [...h.steps, { say: 'Subtract from the price.', show: `${rupiah(price)} − ${rupiah(off)} = ${rupiah(price - off)}` }],
        tags: [WP],
        secs: 150,
      })
    }
    const p = rng.pick([20, 30, 35, 45, 60, 15])
    let ten = rng.int(2, 15)
    if (p % 10 === 5 && ten % 2 === 1) ten += ten < 15 ? 1 : -1
    const n = ten * 10
    return numItem({
      prompt: `10% of a number is ${ten}. What is ${p}% of the same number?`,
      answer: (n * p) / 100,
      hints: [
        `If 10% is ${ten}, what is 100%?`,
        p % 10 === 0 ? `${p}% is ${p / 10} lots of 10%.` : `${p}% is ${Math.floor(p / 10)} lots of 10% and one lot of 5%.`,
        p % 10 === 0 ? `Count up in lots of ${ten}.` : `5% is half of 10%, so 5% is ${fmt(ten / 2)}.`,
      ],
      explanation: `10% is ${ten}${p % 10 ? `, so 5% is ${fmt(ten / 2)}` : ''}. ${p}% = ${Math.floor(p / 10)} × ${ten}${p % 10 ? ` + ${fmt(ten / 2)}` : ''} = ${fmt((n * p) / 100)}.`,
      solution: [
        { say: 'Use 10% to build the percentage.', show: `10% = ${ten}, 5% = ${fmt(ten / 2)}` },
        { say: `Make ${p}%.`, show: `${Math.floor(p / 10)} × ${ten}${p % 10 ? ` + ${fmt(ten / 2)}` : ''} = ${fmt((n * p) / 100)}` },
      ],
      secs: 120,
    })
  },
}

const ratioProportion: Generator = {
  skill: 'm5.ratio-proportion',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level === 1) {
      const a = rng.int(1, 4)
      let b = rng.int(2, 5)
      if (b === a) b += 1
      const k = rng.int(2, 6)
      const beadFig: Fig = {
        kind: 'pattern',
        items: [...Array(a).fill({ shape: 'circle', tone: 'english' }), ...Array(b).fill({ shape: 'circle', tone: 'math' }), ...Array(a).fill({ shape: 'circle', tone: 'english' }), ...Array(b).fill({ shape: 'circle', tone: 'math' })].slice(0, 14),
        alt: `A string of beads: ${a} red then ${b} blue, repeated.`,
      }
      return numItem({
        prompt: `On a necklace, for every ${a} red ${a === 1 ? 'bead' : 'beads'} there are ${b} blue beads. There are ${a * k} red beads. How many blue beads are there?`,
        answer: b * k,
        figure: beadFig,
        hints: [`The pattern repeats: ${a} red, then ${b} blue.`, `How many groups of ${a} red beads are there?`, `${a * k} ÷ ${a} = ${k} groups.`],
        explanation: `There are ${k} groups. Each group has ${b} blue beads, so ${k} × ${b} = ${b * k} blue beads.`,
        solution: [
          { say: 'Count the groups.', show: `${a * k} ÷ ${a} = ${k}`, figure: beadFig },
          { say: 'Each group has the same number of blue beads.', show: `${k} × ${b} = ${b * k}` },
        ],
        tags: [WP],
      })
    }
    if (level === 2) {
      const t = rng.int(3, 8)
      const a = rng.int(1, t - 1)
      if (rng.chance(0.5)) {
        return textItem({
          prompt: `In every packet of ${t} sweets, ${a} ${a === 1 ? 'is' : 'are'} red. What fraction of the sweets are red?`,
          answers: [fracAnswers({ n: a, d: t })],
          hints: ['Proportion compares a part with the whole.', `The whole packet has ${t} sweets.`, `${a} out of ${t} are red.`],
          explanation: `${a} out of every ${t} sweets are red, so the fraction is ${a}/${t}${simp({ n: a, d: t }).d !== t ? ` = ${fs(simp({ n: a, d: t }))}` : ''}.`,
          solution: [{ say: 'Part out of whole.', show: `${a}/${t}` }, { say: 'Simplify if you can.', show: fs(simp({ n: a, d: t })) }],
        })
      }
      const k = rng.int(3, 8)
      const a2 = Math.max(2, a)
      return numItem({
        prompt: `In every packet of ${t} sweets, ${a2} are red. A jar has ${t * k} sweets mixed the same way. How many are red?`,
        answer: a2 * k,
        hints: [`How many lots of ${t} are in ${t * k}?`, `Each lot of ${t} has ${a2} red.`, `${t * k} ÷ ${t} = ${k}.`],
        explanation: `${t * k} ÷ ${t} = ${k} lots, and ${k} × ${a2} = ${a2 * k} red sweets.`,
        solution: [{ say: 'Count the lots.', show: `${t * k} ÷ ${t} = ${k}` }, { say: 'Multiply by the red sweets in each lot.', show: `${k} × ${a2} = ${a2 * k}` }],
        tags: [WP],
      })
    }
    if (level === 3) {
      const ctx = rng.pick([
        { food: 'pancakes', verb: 'need', ing: 'flour', unit: 'g', per: 50 },
        { food: 'fried rice', verb: 'needs', ing: 'rice', unit: 'g', per: 75 },
        { food: 'fruit punch', verb: 'needs', ing: 'juice', unit: 'ml', per: 150 },
        { food: 'cookies', verb: 'need', ing: 'sugar', unit: 'g', per: 25 },
      ] as const)
      const p = rng.pick([2, 4, 5])
      let q = rng.int(3, 12)
      if (q === p) q += 1
      const amount = ctx.per * p
      const ans = ctx.per * q
      return numItem({
        prompt: `${cap(ctx.food)} for ${p} people ${ctx.verb} ${amount} ${ctx.unit} of ${ctx.ing}. How much ${ctx.ing} is needed for ${q} people?`,
        answer: ans,
        unit: ctx.unit,
        hints: ['Find the amount for 1 person first.', `Divide ${amount} by ${p}.`, `For 1 person: ${amount} ÷ ${p} = ${ctx.per} ${ctx.unit}.`],
        explanation: `1 person needs ${amount} ÷ ${p} = ${ctx.per} ${ctx.unit}. ${q} people need ${q} × ${ctx.per} = ${ans} ${ctx.unit}.`,
        solution: [{ say: 'Find the amount for 1 person.', show: `${amount} ÷ ${p} = ${ctx.per}` }, { say: `Multiply by ${q}.`, show: `${q} × ${ctx.per} = ${ans}` }],
        tags: [WP],
        secs: 120,
      })
    }
    if (level === 4) {
      const [x, y] = rng.pick([[2, 3], [3, 4], [1, 3], [2, 5], [3, 5], [4, 5], [1, 4], [3, 2], [5, 2], [4, 3]] as const)
      const k = rng.int(2, 6)
      const [A, B] = rng.pick([['cats', 'dogs'], ['boys', 'girls'], ['red cars', 'blue cars'], ['mango trees', 'banana trees']] as const)
      return textItem({
        prompt: `There are ${x * k} ${A} and ${y * k} ${B}. Write the ratio of ${A} to ${B} in its simplest form.`,
        answers: [[`${x}:${y}`, `${x} : ${y}`, `${x} to ${y}`]],
        hints: [`Write the ratio first: ${x * k} : ${y * k}.`, 'Divide both numbers by their highest common factor.', `Both ${x * k} and ${y * k} divide by ${smallestCommonFactor(x * k, y * k)}.`],
        explanation: `${x * k} : ${y * k}. Dividing both by ${k} gives ${x} : ${y}.`,
        solution: [{ say: `Write ${A} first, then ${B}.`, show: `${x * k} : ${y * k}` }, { say: `Divide both by ${k}.`, show: `${x} : ${y}` }],
        tags: [WP],
      })
    }
    const [a, b] = rng.pick([[1, 2], [2, 3], [1, 3], [2, 5], [3, 4], [3, 5], [1, 4], [4, 5]] as const)
    const k = rng.int(2, 9)
    const total = (a + b) * k
    const [p1, p2] = pickNames(rng, 2)
    const askSecond = a === 1 ? true : rng.chance(0.6)
    return numItem({
      prompt: `${p1} and ${p2} share ${total} sweets in the ratio ${a} : ${b}. How many sweets does ${askSecond ? p2 : p1} get?`,
      answer: (askSecond ? b : a) * k,
      hints: [`The ratio ${a} : ${b} means ${a + b} equal parts altogether.`, `Find the size of one part: ${total} ÷ ${a + b}.`, `${total} ÷ ${a + b} = ${k}.`],
      explanation: `There are ${a} + ${b} = ${a + b} parts. One part is ${total} ÷ ${a + b} = ${k}. ${askSecond ? p2 : p1} gets ${askSecond ? b : a} × ${k} = ${(askSecond ? b : a) * k}.`,
      solution: [
        { say: 'Count the parts.', show: `${a} + ${b} = ${a + b}` },
        { say: 'Find one part.', show: `${total} ÷ ${a + b} = ${k}` },
        { say: `${askSecond ? p2 : p1} gets ${askSecond ? b : a} parts.`, show: `${askSecond ? b : a} × ${k} = ${(askSecond ? b : a) * k}` },
      ],
      tags: [WP],
      secs: 150,
    })
  },
}

/* ------------------------------------------------------------------ */
/* Gt: waktu                                                           */
/* ------------------------------------------------------------------ */

export const addMinutes = (h: number, m: number, add: number): [number, number] => {
  const t = (((h * 60 + m + add) % 1440) + 1440) % 1440
  return [Math.floor(t / 60), t % 60]
}

const time24: Generator = {
  skill: 'm5.time-24-hour',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level === 1) {
      const pm = rng.chance(0.65)
      const h = pm ? rng.int(13, 23) : rng.int(1, 11)
      const m = rng.int(0, 11) * 5
      const h12 = ((h + 11) % 12) + 1
      if (rng.chance(0.6)) {
        return textItem({
          prompt: `Write ${ampm(h, m)} in 24-hour time.`,
          answers: [timeAnswers(h, m)],
          hints: [
            '24-hour times go from 00:00 to 23:59.',
            pm ? 'For pm times, add 12 to the hour.' : 'For am times, keep the hour and write it with two digits.',
            pm ? `${h12} + 12 = ${h}.` : 'Morning times start with 0 when the hour is less than 10.',
          ],
          explanation: `${ampm(h, m)} is ${hhmm(h, m)} in 24-hour time.`,
          solution: [
            { say: pm ? 'It is after noon, so add 12 to the hour.' : 'It is in the morning, so the hour stays the same.', show: pm ? `${h12} + 12 = ${h}` : `${h12} → ${String(h).padStart(2, '0')}` },
            { say: 'Write the hours and the minutes with a colon.', show: hhmm(h, m), figure: { kind: 'clock', h, m, digital: true, alt: `A digital clock showing ${hhmm(h, m)}.` } },
          ],
        })
      }
      const hh = pm ? h : h + 12
      return clockItem({
        prompt: `The time is ${hhmm(hh, m)}. Show this time on the clock.`,
        h: hh,
        m,
        step: 5,
        hints: [
          'A clock face only shows 12 hours.',
          'For times after 12:00, take 12 away from the hour.',
          `Set the minute hand first. ${m === 0 ? 'It points to 12.' : `${m} minutes past is the ${m / 5} on the clock.`}`,
        ],
        explanation: `${hhmm(hh, m)} is ${ampm(hh, m)}, so the hour hand is near the ${((hh + 11) % 12) + 1} and the minute hand points to ${m === 0 ? '12' : String(m / 5)}.`,
        solution: [
          { say: 'Change to 12-hour time.', show: `${hh} − 12 = ${hh - 12}` },
          { say: 'Set the hands.', figure: { kind: 'clock', h: hh, m, alt: `A clock showing ${ampm(hh, m)}.` } },
        ],
      })
    }
    if (level === 2) {
      const h = rng.pick([rng.int(0, 11), rng.int(13, 23), rng.int(13, 23)])
      const m = rng.int(1, 11) * 5
      const h12 = ((h + 11) % 12) + 1
      const suffix = h < 12 ? 'am' : 'pm'
      const other = h < 12 ? 'pm' : 'am'
      const mm = String(m).padStart(2, '0')
      const wrong = [
        { value: `${h12}:${mm} ${other}`, why: h < 12 ? 'Times before 12:00 are in the morning, so they are am.' : 'Times after 12:00 are in the afternoon or evening, so they are pm.' },
        ...(h >= 13 ? [{ value: `${h - 10}:${mm} pm`, why: 'Take away 12 from the hour, not 10.' }] : [{ value: `${h12 + 12}:${mm} am`, why: 'A 12-hour time never has an hour bigger than 12.' }]),
        { value: `${(h12 % 12) + 1}:${mm} ${suffix}`, why: 'Check the hour again.' },
        { value: `${h12}:${String((m + 30) % 60).padStart(2, '0')} ${suffix}`, why: 'The minutes stay the same in both times.' },
      ]
      const m2 = mcqText(rng, ampm(h, m), wrong)
      return mcqItem({
        prompt: `What is ${hhmm(h, m)} in 12-hour time?`,
        ...m2,
        figure: { kind: 'clock', h, m, digital: true, alt: `A digital clock showing ${hhmm(h, m)}.` },
        hints: ['Times before 12:00 are am. Times from 12:00 are pm.', h >= 13 ? 'If the hour is 13 or more, take away 12.' : 'If the hour is less than 12, keep it.', `Is ${hhmm(h, m)} before or after midday?`],
        explanation: `${hhmm(h, m)} is ${h < 12 ? 'before' : 'after'} midday, so it is ${ampm(h, m)}.`,
        solution: [
          { say: h < 12 ? 'It is in the morning.' : 'It is after midday.', show: h >= 13 ? `${h} − 12 = ${h12}` : `${h} → ${h12}` },
          { say: 'Add am or pm.', show: ampm(h, m) },
        ],
      })
    }
    if (level === 3) {
      const h1 = rng.int(8, 18)
      const m1 = rng.int(1, 11) * 5
      const dur = rng.int(Math.ceil((60 - m1 + 5) / 5), 34) * 5
      const [h2, m2] = addMinutes(h1, m1, dur)
      const toNext = 60 - m1
      const event = rng.pick(['A film', 'A football match', 'A school concert', 'A swimming lesson'] as const)
      return numItem({
        prompt: `${event} starts at ${hhmm(h1, m1)} and ends at ${hhmm(h2, m2)}. How long does it last, in minutes?`,
        answer: dur,
        unit: 'minutes',
        hints: ['Count on from the start time to the end time.', `Count on to the next o'clock first: ${hhmm(h1, m1)} to ${hhmm(h1 + 1, 0)}.`, `${hhmm(h1, m1)} to ${hhmm(h1 + 1, 0)} is ${toNext} minutes.`],
        explanation: `${hhmm(h1, m1)} to ${hhmm(h1 + 1, 0)} is ${toNext} minutes, then ${hhmm(h1 + 1, 0)} to ${hhmm(h2, m2)} is ${dur - toNext} minutes. ${toNext} + ${dur - toNext} = ${dur} minutes.`,
        solution: [
          { say: `Count on to ${hhmm(h1 + 1, 0)}.`, show: `${toNext} minutes` },
          { say: `Count on to ${hhmm(h2, m2)}.`, show: `${dur - toNext} minutes` },
          { say: 'Add the two parts.', show: `${toNext} + ${dur - toNext} = ${dur}` },
        ],
        tags: [WP],
      })
    }
    if (level === 4) {
      const stops = rng.pick([
        ['Bus station', 'School', 'Park', 'Market'],
        ['Terminal', 'Library', 'Hospital', 'Beach'],
        ['Station', 'Museum', 'Zoo', 'Stadium'],
      ] as const)
      const gaps = [0, rng.int(2, 4) * 5 - rng.pick([0, 3]), rng.int(2, 4) * 5 + rng.pick([0, 2]), rng.int(2, 5) * 5 - rng.pick([0, 1])]
      const offs = gaps.reduce<number[]>((acc, g, i) => [...acc, i === 0 ? 0 : at(acc, i - 1) + g], [])
      const firstH = rng.int(7, 9)
      const firstM = rng.pick([0, 10, 15, 20, 30, 45])
      const every = rng.pick([25, 30, 35, 40])
      const buses = [0, 1, 2, 3].map((b) => addMinutes(firstH, firstM, b * every))
      const cell = (b: number, sIdx: number) => {
        const [bh, bm] = at(buses, b)
        const [h, m] = addMinutes(bh, bm, at(offs, sIdx))
        return { h, m, t: hhmm(h, m) }
      }
      const table: Fig = {
        kind: 'table',
        caption: 'Bus timetable',
        head: ['Stop', 'Bus 1', 'Bus 2', 'Bus 3', 'Bus 4'],
        rows: stops.map((st, si) => [st, ...[0, 1, 2, 3].map((b) => cell(b, si).t)]),
        alt: `Bus timetable. ${stops.map((st, si) => `${st}: ${[0, 1, 2, 3].map((b) => cell(b, si).t).join(', ')}`).join('. ')}.`,
      }
      const style = rng.int(0, 2)
      if (style === 0) {
        const b = rng.int(0, 3)
        const [s1, s2] = rng.sample([0, 1, 2, 3], 2).sort((x, y) => x - y)
        const dur = at(offs, s2!) - at(offs, s1!)
        return numItem({
          prompt: `Look at the timetable. How long does Bus ${b + 1} take to go from the ${at(stops, s1!)} to the ${at(stops, s2!)}, in minutes?`,
          answer: dur,
          unit: 'minutes',
          figure: table,
          hints: [`Find the Bus ${b + 1} column.`, `Read the times at the ${at(stops, s1!)} and the ${at(stops, s2!)}.`, `Bus ${b + 1} leaves the ${at(stops, s1!)} at ${cell(b, s1!).t}.`],
          explanation: `Bus ${b + 1} is at the ${at(stops, s1!)} at ${cell(b, s1!).t} and at the ${at(stops, s2!)} at ${cell(b, s2!).t}. That is ${dur} minutes.`,
          solution: [
            { say: 'Read the two times.', show: `${cell(b, s1!).t} and ${cell(b, s2!).t}` },
            { say: 'Count on from the first time.', show: `${dur} minutes` },
          ],
          tags: [WP],
          secs: 120,
        })
      }
      if (style === 1) {
        const si = rng.int(0, 2)
        const b = rng.int(1, 3)
        const target = cell(b, si)
        const [ah, am] = addMinutes(target.h, target.m, -rng.int(2, every - 3))
        const name = rng.pick(NAMES)
        return textItem({
          prompt: `Look at the timetable. ${name} gets to the ${at(stops, si)} at ${hhmm(ah, am)}. What time does the next bus leave the ${at(stops, si)}?`,
          answers: [timeAnswers(target.h, target.m)],
          figure: table,
          hints: [`Find the row for the ${at(stops, si)}.`, `Look for the first time that is after ${hhmm(ah, am)}.`, `Read the ${at(stops, si)} row from left to right.`],
          explanation: `The buses leave the ${at(stops, si)} at ${[0, 1, 2, 3].map((x) => cell(x, si).t).join(', ')}. The first one after ${hhmm(ah, am)} is ${target.t}.`,
          solution: [
            { say: `Read the ${at(stops, si)} row.`, show: [0, 1, 2, 3].map((x) => cell(x, si).t).join(', ') },
            { say: `The next time after ${hhmm(ah, am)}.`, show: target.t },
          ],
          tags: [WP],
          secs: 120,
        })
      }
      const b = rng.int(1, 3)
      const arrive = cell(b, 3)
      const [dh, dm] = addMinutes(arrive.h, arrive.m, rng.int(1, every - 2))
      const name = rng.pick(NAMES)
      const m2 = mcqFrom(
        rng,
        `Bus ${b + 1}`,
        [0, 1, 2, 3]
          .filter((x) => x !== b)
          .map((x) => ({ value: `Bus ${x + 1}`, why: x > b ? `Bus ${x + 1} reaches the ${at(stops, 3)} at ${cell(x, 3).t}, which is too late.` : `Bus ${x + 1} would work, but Bus ${b + 1} leaves later and still arrives in time.` })),
        4,
        (v) => v,
      )
      return mcqItem({
        prompt: `Look at the timetable. ${name} must be at the ${at(stops, 3)} by ${hhmm(dh, dm)}. Which is the latest bus ${name} can catch from the ${at(stops, 0)}?`,
        ...m2,
        figure: table,
        hints: [`Look at the ${at(stops, 3)} row.`, `Find the buses that arrive at or before ${hhmm(dh, dm)}.`, `Bus ${(b < 3 ? b + 1 : b - 1) + 1} reaches the ${at(stops, 3)} at ${cell(b < 3 ? b + 1 : b - 1, 3).t}.`],
        explanation: `Bus ${b + 1} reaches the ${at(stops, 3)} at ${arrive.t}, which is before ${hhmm(dh, dm)}. ${b < 3 ? `Bus ${b + 2} arrives at ${cell(b + 1, 3).t}, which is too late.` : ''}`.trim(),
        solution: [
          { say: `Read the ${at(stops, 3)} row.`, show: [0, 1, 2, 3].map((x) => cell(x, 3).t).join(', ') },
          { say: `The latest arrival before ${hhmm(dh, dm)}.`, show: `Bus ${b + 1}` },
        ],
        tags: [WP],
        secs: 150,
      })
    }
    if (rng.chance(0.5)) {
      const h1 = rng.int(20, 23)
      const m1 = rng.int(0, 11) * 5
      const dh = rng.int(1, 4)
      const dm = rng.int(1, 11) * 5
      const [h2, m2] = addMinutes(h1, m1, dh * 60 + dm)
      const what = rng.pick(['A night train', 'A night bus', 'A ferry'] as const)
      return textItem({
        prompt: `${what} leaves at ${hhmm(h1, m1)}. The trip takes ${dh} ${dh === 1 ? 'hour' : 'hours'} and ${dm} minutes. What time does it arrive? Use the 24-hour clock.`,
        answers: [timeAnswers(h2, m2)],
        hints: ['Add the hours first, then the minutes.', 'After 23:59 the time goes back to 00:00.', `${hhmm(h1, m1)} + ${dh} ${dh === 1 ? 'hour' : 'hours'} = ${hhmm(...addMinutes(h1, m1, dh * 60))}.`],
        explanation: `${hhmm(h1, m1)} + ${dh} h = ${hhmm(...addMinutes(h1, m1, dh * 60))}, then + ${dm} min = ${hhmm(h2, m2)}.`,
        solution: [
          { say: 'Add the hours.', show: `${hhmm(h1, m1)} → ${hhmm(...addMinutes(h1, m1, dh * 60))}` },
          { say: 'Add the minutes.', show: `${hhmm(...addMinutes(h1, m1, dh * 60))} → ${hhmm(h2, m2)}` },
        ],
        tags: [WP],
        secs: 150,
      })
    }
    const total = rng.int(70, 300)
    const fixedTotal = total % 60 === 0 ? total + 7 : total
    return textItem({
      prompt: `Write ${fixedTotal} minutes in hours and minutes. ${fixedTotal} minutes = ___ hours ___ minutes`,
      answers: [[String(Math.floor(fixedTotal / 60))], [String(fixedTotal % 60)]],
      hints: ['There are 60 minutes in 1 hour.', `Find how many lots of 60 fit into ${fixedTotal}.`, 'Count up in 60s: 60, 120, 180, and so on.'],
      explanation: `${fixedTotal} ÷ 60 = ${Math.floor(fixedTotal / 60)} remainder ${fixedTotal % 60}, so ${fixedTotal} minutes = ${Math.floor(fixedTotal / 60)} hours ${fixedTotal % 60} minutes.`,
      solution: [
        { say: 'Take out whole hours.', show: `${fixedTotal} ÷ 60 = ${Math.floor(fixedTotal / 60)} r ${fixedTotal % 60}` },
        { say: 'The remainder is minutes.', show: `${Math.floor(fixedTotal / 60)} h ${fixedTotal % 60} min` },
      ],
    })
  },
}

/* ------------------------------------------------------------------ */
/* Gg: pengukuran dan bangun                                           */
/* ------------------------------------------------------------------ */

export function rectFig(l: number, w: number, unit: string): Fig {
  return { kind: 'shape', shape: 'rectangle', sideLabels: [`${l} ${unit}`, `${w} ${unit}`], showRightAngles: true, alt: `A rectangle ${l} ${unit} long and ${w} ${unit} wide.` }
}

/** Bentuk L di grid: persegi panjang C x R dengan potongan c x r di pojok kanan atas. */
export function lShapeFig(R: number, C: number, r: number, c: number, unitWord = '1 cm'): Fig {
  const shaded: [number, number][] = []
  for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) if (!(i < r && j >= C - c)) shaded.push([i, j])
  return {
    kind: 'grid',
    rows: R,
    cols: C,
    shaded,
    showUnits: true,
    alt: `An L-shape on a grid of ${unitWord} squares. It is ${C} squares wide and ${R} squares tall, with ${anum(c)} ${c} by ${r} piece missing from the top right corner.`,
  }
}

const perimeterArea: Generator = {
  skill: 'm5.perimeter-area',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level <= 2) {
      const sq = rng.chance(0.25)
      const l = rng.int(5, 20)
      const w = sq ? l : rng.int(2, l - 1)
      const unit = rng.pick(['cm', 'm'] as const)
      const fig: Fig = sq
        ? { kind: 'shape', shape: 'square', sideLabels: [`${l} ${unit}`], showRightAngles: true, alt: `A square with sides of ${l} ${unit}.` }
        : rectFig(l, w, unit)
      if (level === 1) {
        return numItem({
          prompt: sq ? `A square has sides of ${l} ${unit}. What is its perimeter?` : `A rectangle is ${l} ${unit} long and ${w} ${unit} wide. What is its perimeter?`,
          answer: 2 * (l + w),
          unit,
          figure: fig,
          hints: ['Perimeter is the distance all the way around the edge.', sq ? 'A square has four equal sides.' : 'A rectangle has two long sides and two short sides.', sq ? `Add four lots of ${l}.` : `${l} + ${w} = ${l + w}. That is half of the way round.`],
          explanation: sq ? `4 × ${l} = ${4 * l} ${unit}.` : `${l} + ${w} + ${l} + ${w} = ${2 * (l + w)} ${unit}.`,
          solution: [
            { say: 'Add all four sides.', figure: fig },
            { say: sq ? 'Four equal sides.' : 'Two lengths and two widths.', show: sq ? `4 × ${l} = ${4 * l}` : `2 × (${l} + ${w}) = ${2 * (l + w)}` },
          ],
        })
      }
      return numItem({
        prompt: sq ? `A square has sides of ${l} ${unit}. What is its area?` : `A rectangle is ${l} ${unit} long and ${w} ${unit} wide. What is its area?`,
        answer: l * w,
        unit: `${unit}²`,
        figure: fig,
        hints: ['Area is the space inside the shape.', 'For a rectangle, area = length × width.', `Work out ${l} × ${w}.`],
        explanation: `${l} × ${w} = ${l * w} ${unit}².`,
        solution: [
          { say: 'Area of a rectangle is length × width.', figure: fig },
          { say: 'Multiply.', show: `${l} × ${w} = ${l * w} ${unit}²` },
        ],
      })
    }
    if (level === 3) {
      const R = rng.int(5, 9)
      const C = rng.int(6, 11)
      const r = rng.int(2, R - 2)
      const c = rng.int(2, C - 2)
      const fig = lShapeFig(R, C, r, c)
      if (rng.chance(0.5)) {
        const area = R * C - r * c
        return numItem({
          prompt: 'The shape is drawn on a grid of 1 cm squares. What is its area?',
          answer: area,
          unit: 'cm²',
          figure: fig,
          hints: ['Split the shape into two rectangles, or count squares.', `The whole grid rectangle is ${C} cm by ${R} cm. A ${c} cm by ${r} cm piece is missing.`, `${C} × ${R} = ${C * R}.`],
          explanation: `${C} × ${R} = ${C * R} cm². Take away the missing ${c} × ${r} = ${c * r} cm². ${C * R} − ${c * r} = ${area} cm².`,
          solution: [
            { say: 'Find the area of the big rectangle.', show: `${C} × ${R} = ${C * R}`, figure: fig },
            { say: 'Subtract the missing corner.', show: `${C * R} − ${c} × ${r} = ${area}` },
          ],
        })
      }
      return numItem({
        prompt: 'The shape is drawn on a grid of 1 cm squares. What is its perimeter?',
        answer: 2 * (R + C),
        unit: 'cm',
        figure: fig,
        hints: ['Perimeter is the distance around the outside edge.', 'Go round the shape and add the length of every side.', `The bottom edge is ${C} cm and the left edge is ${R} cm.`],
        explanation: `The sides are ${C}, ${R}, ${C - c}, ${r}, ${c} and ${R - r} cm. They add up to ${2 * (R + C)} cm.`,
        solution: [
          { say: 'List every side as you go round.', show: `${C} + ${R - r} + ${c} + ${r} + ${C - c} + ${R}` },
          { say: 'Add them.', show: `${2 * (R + C)} cm` },
        ],
      })
    }
    if (level === 4) {
      const t = rng.int(0, 2)
      const l = rng.int(6, 15)
      const w = rng.int(3, l - 1)
      if (t === 0) {
        return numItem({
          prompt: `A rectangle has an area of ${l * w} cm². Its length is ${l} cm. What is its width?`,
          answer: w,
          unit: 'cm',
          hints: ['Area = length × width.', `Think: ${l} times which number makes ${l * w}?`, `Divide ${l * w} by ${l}.`],
          explanation: `${l * w} ÷ ${l} = ${w}, so the width is ${w} cm.`,
          solution: [{ say: 'Use the inverse of multiplying.', show: `${l * w} ÷ ${l} = ${w}` }, { say: 'Check.', show: `${l} × ${w} = ${l * w}` }],
        })
      }
      if (t === 1) {
        return numItem({
          prompt: `A rectangle has a perimeter of ${2 * (l + w)} cm. Its length is ${l} cm. What is its width?`,
          answer: w,
          unit: 'cm',
          hints: ['The perimeter is two lengths and two widths.', `Half of the perimeter is one length and one width.`, `${2 * (l + w)} ÷ 2 = ${l + w}.`],
          explanation: `Half the perimeter is ${l + w} cm. ${l + w} − ${l} = ${w} cm.`,
          solution: [{ say: 'Halve the perimeter.', show: `${2 * (l + w)} ÷ 2 = ${l + w}` }, { say: 'Take away the length.', show: `${l + w} − ${l} = ${w}` }],
        })
      }
      const cost = rng.pick([15000, 20000, 25000, 50000])
      return numItem({
        prompt: `A rectangular garden is ${l} m long and ${w} m wide. Fencing costs ${rupiah(cost)} for each metre. How much does it cost to fence all the way round, in rupiah?`,
        answer: 2 * (l + w) * cost,
        hints: ['First find the perimeter of the garden.', `Perimeter = 2 × (${l} + ${w}).`, `${l} + ${w} = ${l + w}.`],
        explanation: `The perimeter is ${2 * (l + w)} m. ${2 * (l + w)} × ${rupiah(cost)} = ${rupiah(2 * (l + w) * cost)}.`,
        solution: [
          { say: 'Find the perimeter.', show: `2 × (${l} + ${w}) = ${2 * (l + w)} m`, figure: rectFig(l, w, 'm') },
          { say: 'Multiply by the cost of 1 metre.', show: `${2 * (l + w)} × ${fmt(cost)} = ${fmt(2 * (l + w) * cost)}` },
        ],
        tags: [WP],
        secs: 150,
      })
    }
    if (rng.chance(0.5)) {
      const L = rng.int(8, 15)
      const W = rng.int(6, 12)
      const a = rng.int(2, L - 3)
      const b = rng.int(2, W - 3)
      const room = rng.pick(['room', 'garden', 'playground'] as const)
      return numItem({
        prompt: `An L-shaped ${room} is ${anum(L)} ${L} m by ${W} m rectangle with a corner cut out. The corner is ${a} m by ${b} m. What is the area of the ${room}?`,
        answer: L * W - a * b,
        unit: 'm²',
        figure: L <= 12 && W <= 12 ? lShapeFig(W, L, b, a, '1 m') : undefined,
        hints: ['Find the area of the whole rectangle first.', 'Then take away the area of the corner that is cut out.', `${L} × ${W} = ${L * W}.`],
        explanation: `${L} × ${W} = ${L * W} m² and ${a} × ${b} = ${a * b} m². ${L * W} − ${a * b} = ${L * W - a * b} m².`,
        solution: [
          { say: 'Area of the big rectangle.', show: `${L} × ${W} = ${L * W}` },
          { say: 'Area of the cut-out corner.', show: `${a} × ${b} = ${a * b}` },
          { say: 'Subtract.', show: `${L * W} − ${a * b} = ${L * W - a * b}` },
        ],
        tags: [WP],
        secs: 150,
      })
    }
    const A = rng.pick([24, 36, 48, 30, 40])
    const pairs = factorsOf(A).filter((f) => f * f <= A).map((f) => [f, A / f] as [number, number])
    const opts = rng.sample(pairs, Math.min(4, pairs.length))
    const greatest = rng.chance(0.6)
    const per = (p: [number, number]) => 2 * (p[0] + p[1])
    const best = [...opts].sort((x, y) => per(x) - per(y))
    const c = greatest ? at(best, best.length - 1) : at(best, 0)
    const label = (p: [number, number]) => `${p[0]} cm by ${p[1]} cm`
    const m = mcqFrom(
      rng,
      label(c),
      opts.filter((o) => o !== c).map((o) => ({ value: label(o), why: `Its perimeter is 2 × (${o[0]} + ${o[1]}) = ${per(o)} cm.` })),
      4,
      (v) => v,
    )
    return mcqItem({
      prompt: `Each rectangle has an area of ${A} cm². Which one has the ${greatest ? 'greatest' : 'smallest'} perimeter?`,
      ...m,
      hints: [
        'The areas are the same, but the perimeters are not.',
        'Work out 2 × (length + width) for each one.',
        (() => {
          const o = opts.find((x) => x !== c) ?? c
          return `For ${label(o)}: ${o[0]} + ${o[1]} = ${o[0] + o[1]}.`
        })(),
      ],
      explanation: `The perimeters are ${opts.map((o) => `${per(o)} cm`).join(', ')}. ${label(c)} has the ${greatest ? 'greatest' : 'smallest'}, ${per(c)} cm.`,
      solution: [
        { say: 'Find each perimeter.', show: opts.map((o) => `${label(o)}: ${per(o)} cm`).join('; ') },
        { say: greatest ? 'Long, thin rectangles have bigger perimeters.' : 'Rectangles close to a square have smaller perimeters.', show: label(c) },
      ],
      secs: 150,
    })
  },
}

const ANGLE_TYPES = [
  { name: 'acute', why: 'An acute angle is less than 90°.' },
  { name: 'right angle', why: 'A right angle is exactly 90°, like the corner of a book.' },
  { name: 'obtuse', why: 'An obtuse angle is between 90° and 180°.' },
  { name: 'reflex', why: 'A reflex angle is more than 180°.' },
  { name: 'straight angle', why: 'A straight angle is exactly 180°.' },
] as const

export const angleType = (d: number): string => (d < 90 ? 'acute' : d === 90 ? 'right angle' : d < 180 ? 'obtuse' : d === 180 ? 'straight angle' : 'reflex')

/** "an acute angle", "a right angle", "a reflex angle". */
export const angleWithArticle = (d: number): string => {
  const t = angleType(d)
  const phrase = t.endsWith('angle') ? t : `${t} angle`
  return `${/^[aeiou]/.test(phrase) ? 'an' : 'a'} ${phrase}`
}

const angles: Generator = {
  skill: 'm5.angles',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level === 1) {
      const kind = rng.int(0, 3)
      const d = kind === 0 ? rng.int(4, 16) * 5 : kind === 1 ? 90 : kind === 2 ? rng.int(20, 34) * 5 : rng.int(38, 68) * 5
      const correct = angleType(d)
      const m = mcqFrom(
        rng,
        correct,
        rng.shuffle(ANGLE_TYPES.filter((t) => t.name !== correct).map((t) => ({ value: t.name, why: t.why }))),
        4,
        (v) => v,
      )
      return mcqItem({
        prompt: 'What type of angle is this?',
        ...m,
        figure: { kind: 'angle', degrees: d, alt: `An angle of ${d}°.` },
        hints: ['Compare the angle with a right angle, like the corner of a book.', 'Acute is less than 90°. Obtuse is between 90° and 180°. Reflex is more than 180°.', 'Is the angle smaller or bigger than a right angle?'],
        explanation: `This angle is ${d}°, so it is ${angleWithArticle(d)}.`,
        solution: [
          { say: 'Compare it with a right angle.', figure: { kind: 'angle', degrees: d, alt: `An angle of ${d}°.` } },
          { say: `It is ${d}°.`, show: correct },
        ],
      })
    }
    if (level === 2) {
      let d = rng.int(3, 35) * 5
      const measure = rng.chance(0.6)
      if (!measure && d === 90) d = 95
      if (measure) {
        return numItem({
          prompt: 'Use the protractor. How big is this angle?',
          answer: d,
          unit: '°',
          tolerance: 2,
          figure: { kind: 'angle', degrees: d, showProtractor: true, alt: `An angle of ${d}° on a protractor.` },
          hints: ['Put the centre of the protractor on the corner of the angle.', 'Start at 0 on the scale where one arm lies.', `First decide: is it acute or obtuse? That tells you which scale to read.`],
          explanation: `The angle measures ${d}°. It is ${angleWithArticle(d)}, so the answer ${d < 90 ? 'is less than 90°' : d === 90 ? 'is 90°' : 'is more than 90°'}.`,
          solution: [
            { say: 'Line up 0 with one arm.', figure: { kind: 'angle', degrees: d, showProtractor: true, alt: `An angle of ${d}° on a protractor.` } },
            { say: 'Read where the other arm crosses the scale.', show: `${d}°` },
          ],
        })
      }
      const wrong = uniq([d < 90 ? d + 60 : d - 60, 90 === d ? 45 : 90, 180 - d === d ? d + 30 : 180 - d, d < 90 ? d + 100 : Math.max(10, d - 100)])
        .filter((x) => x > 0 && x < 180 && x !== d)
        .map((x) => ({ value: `${x}°`, why: `${x}° is ${angleWithArticle(x)}. This angle is ${d < 90 ? 'less than' : d === 90 ? 'exactly' : 'more than'} 90°.` }))
      const m = mcqFrom(rng, `${d}°`, wrong, 4, (v) => v)
      return mcqItem({
        prompt: 'Which is the best estimate for the size of this angle?',
        ...m,
        figure: { kind: 'angle', degrees: d, alt: `An angle of about ${d}°.` },
        hints: ['Compare it with a right angle, 90°.', 'Half a right angle is 45°. A straight line is 180°.', 'Is it smaller or bigger than a right angle?'],
        explanation: `The angle is ${d < 90 ? 'smaller' : d === 90 ? 'the same as' : 'bigger'} than a right angle. ${d}° is the best estimate.`,
        solution: [{ say: 'Compare with 90°.' }, { say: 'Pick the estimate that fits.', show: `${d}°` }],
      })
    }
    if (level === 3) {
      let a = rng.int(25, 155)
      if (a % 10 === 0) a += 3
      return numItem({
        prompt: `Two angles are on a straight line. One angle is ${a}°. What is the other angle?`,
        answer: 180 - a,
        unit: '°',
        figure: { kind: 'angle', degrees: 180, label: `${a}° and ?`, alt: `A straight line split into two angles: ${a}° and a missing angle.` },
        hints: ['Angles on a straight line add up to 180°.', `Subtract ${a}° from 180°.`, `180 − ${Math.floor(a / 10) * 10} = ${180 - Math.floor(a / 10) * 10}.`],
        explanation: `Angles on a straight line add up to 180°. 180° − ${a}° = ${180 - a}°.`,
        solution: [
          { say: 'A straight line is 180°.' },
          { say: 'Subtract the angle you know.', show: `180 − ${a} = ${180 - a}` },
        ],
      })
    }
    if (level === 4) {
      const a = rng.int(25, 95)
      const b = rng.int(20, 160 - a)
      return numItem({
        prompt: `Two angles of a triangle are ${a}° and ${b}°. What is the third angle?`,
        answer: 180 - a - b,
        unit: '°',
        figure: { kind: 'shape', shape: 'triangle', alt: `A triangle with angles of ${a}°, ${b}° and a missing angle.` },
        hints: ['The three angles in a triangle add up to 180°.', `Add the two angles you know: ${a} + ${b}.`, `${a} + ${b} = ${a + b}.`],
        explanation: `${a}° + ${b}° = ${a + b}°. 180° − ${a + b}° = ${180 - a - b}°.`,
        solution: [
          { say: 'Add the angles you know.', show: `${a} + ${b} = ${a + b}` },
          { say: 'Subtract from 180°.', show: `180 − ${a + b} = ${180 - a - b}` },
        ],
      })
    }
    if (rng.chance(0.5)) {
      const top = rng.int(10, 70) * 2
      const base = (180 - top) / 2
      return numItem({
        prompt: `An isosceles triangle has one angle of ${top}°. The other two angles are equal. How big is each of them?`,
        answer: base,
        unit: '°',
        figure: { kind: 'shape', shape: 'triangle', alt: `An isosceles triangle with a top angle of ${top}° and two equal base angles.` },
        hints: ['The angles in a triangle add up to 180°.', `Take ${top}° away from 180°, then share what is left equally.`, `180 − ${top} = ${180 - top}.`],
        explanation: `180° − ${top}° = ${180 - top}°. The two equal angles share it: ${180 - top} ÷ 2 = ${base}°.`,
        solution: [
          { say: 'Take away the angle you know.', show: `180 − ${top} = ${180 - top}` },
          { say: 'Share between the two equal angles.', show: `${180 - top} ÷ 2 = ${base}` },
        ],
        secs: 120,
      })
    }
    let a = rng.int(30, 170)
    if (a % 10 === 0) a += 4
    return numItem({
      prompt: `An angle is ${a}°. What is the reflex angle that makes a full turn with it?`,
      answer: 360 - a,
      unit: '°',
      figure: { kind: 'angle', degrees: 360 - a, label: '?', alt: `A reflex angle that makes a full turn with an angle of ${a}°.` },
      hints: ['A full turn is 360°.', `Subtract ${a}° from 360°.`, `360 − ${Math.floor(a / 10) * 10} = ${360 - Math.floor(a / 10) * 10}.`],
      explanation: `A full turn is 360°. 360° − ${a}° = ${360 - a}°.`,
      solution: [{ say: 'A full turn is 360°.' }, { say: 'Subtract the angle you know.', show: `360 − ${a} = ${360 - a}` }],
      secs: 90,
    })
  },
}

type SolidName = 'cube' | 'cuboid' | 'square-pyramid' | 'triangular-prism'
const SOLID_FACTS: Record<SolidName, { name: string; faces: number; edges: number; vertices: number; top: string }> = {
  cube: { name: 'cube', faces: 6, edges: 12, vertices: 8, top: 'The top face has 4 edges.' },
  cuboid: { name: 'cuboid', faces: 6, edges: 12, vertices: 8, top: 'The top face has 4 edges.' },
  'square-pyramid': { name: 'square-based pyramid', faces: 5, edges: 8, vertices: 5, top: 'The square base has 4 edges.' },
  'triangular-prism': { name: 'triangular prism', faces: 5, edges: 9, vertices: 6, top: 'Each triangle end has 3 edges.' },
}

const VALID_NETS: readonly (readonly [number, number])[][] = [
  [[0, 1], [1, 0], [1, 1], [1, 2], [1, 3], [2, 1]],
  [[0, 0], [1, 0], [1, 1], [1, 2], [1, 3], [2, 0]],
  [[0, 0], [1, 0], [1, 1], [1, 2], [1, 3], [2, 3]],
  [[0, 1], [1, 0], [1, 1], [1, 2], [1, 3], [2, 3]],
  [[0, 0], [0, 1], [1, 1], [1, 2], [1, 3], [2, 3]],
  [[0, 0], [0, 1], [1, 1], [1, 2], [2, 2], [2, 3]],
  [[0, 0], [0, 1], [0, 2], [1, 2], [1, 3], [1, 4]],
  [[0, 0], [0, 1], [0, 2], [1, 1], [2, 1], [3, 1]],
]
const INVALID_NETS: readonly { cells: (readonly [number, number])[]; why: string }[] = [
  { cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]], why: 'Some squares would land on top of each other when folded.' },
  { cells: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 0]], why: 'Five squares in a row would overlap when folded.' },
  { cells: [[0, 0], [0, 1], [1, 0], [1, 1], [1, 2], [1, 3]], why: 'A 2 by 2 block of squares cannot fold into a cube.' },
  { cells: [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2]], why: 'Two faces would overlap and one face would be missing.' },
  { cells: [[0, 0], [0, 2], [1, 0], [1, 1], [1, 2], [1, 3]], why: 'Both flaps fold onto the same side, so one face is missing.' },
  { cells: [[0, 1], [0, 2], [1, 0], [1, 1], [2, 0], [2, 1]], why: 'Two squares would overlap when folded.' },
]

function netFig(cells: readonly (readonly [number, number])[], alt: string): Fig {
  const rows = Math.max(...cells.map((c) => c[0])) + 1
  const cols = Math.max(...cells.map((c) => c[1])) + 1
  return { kind: 'grid', rows, cols, shaded: cells.map((c) => [c[0], c[1]] as [number, number]), alt }
}

const POLY = [
  { n: 3, name: 'triangle', adj: 'triangular' },
  { n: 4, name: 'square', adj: 'square' },
  { n: 5, name: 'pentagon', adj: 'pentagonal' },
  { n: 6, name: 'hexagon', adj: 'hexagonal' },
  { n: 8, name: 'octagon', adj: 'octagonal' },
] as const

const shapes2d3d: Generator = {
  skill: 'm5.shapes-2d-3d',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level === 1) {
      const key = rng.pick(Object.keys(SOLID_FACTS) as SolidName[])
      const f = SOLID_FACTS[key]
      const prop = rng.pick(['faces', 'edges', 'vertices'] as const)
      return numItem({
        prompt: `How many ${prop} does a ${f.name} have?`,
        answer: f[prop],
        figure: { kind: 'solid', solid: key, label: f.name, alt: `A drawing of a ${f.name}.` },
        hints: ['Faces are flat surfaces. Edges are where two faces meet. Vertices are corners.', 'Count carefully, including the ones at the back that you cannot see.', prop === 'faces' ? 'Count the face at the bottom too.' : f.top],
        explanation: `A ${f.name} has ${f.faces} faces, ${f.edges} edges and ${f.vertices} vertices.`,
        solution: [
          { say: `Look at the ${f.name}.`, figure: { kind: 'solid', solid: key, label: f.name, alt: `A drawing of a ${f.name}.` } },
          { say: `Count the ${prop}.`, show: `${f[prop]} ${prop}` },
        ],
      })
    }
    if (level === 2) {
      const kind = rng.int(0, 3)
      const a = rng.int(4, 12)
      let sides: number[]
      if (kind === 0) sides = [a, a, a]
      else if (kind === 1) sides = rng.shuffle([a, a, rng.pick(range(Math.max(2, a - 3), 2 * a - 1).filter((x) => x !== a))])
      else {
        let b = rng.int(a + 1, a + 5)
        let c = rng.int(b + 1, a + b - 1)
        if (c <= b) c = b + 1
        if (c >= a + b) b = c - a + 1
        sides = rng.shuffle([a, b, c])
      }
      const names = ['equilateral', 'isosceles', 'scalene']
      if (kind === 3) {
        const m = mcqText(rng, 'right-angled', [
          { value: 'equilateral', why: 'An equilateral triangle has three angles of 60°, so none is a right angle.' },
          { value: 'obtuse-angled', why: 'An obtuse-angled triangle has one angle bigger than 90°.' },
          { value: 'acute-angled', why: 'An acute-angled triangle has every angle less than 90°.' },
        ])
        return mcqItem({
          prompt: 'One angle of a triangle is exactly 90°. What type of triangle is it?',
          ...m,
          figure: { kind: 'shape', shape: 'right-triangle', showRightAngles: true, alt: 'A triangle with one right angle.' },
          hints: ['Look for the special angle.', 'A 90° angle is called a right angle.', 'The name of the triangle comes from its right angle.'],
          explanation: 'A triangle with a 90° angle is a right-angled triangle.',
          solution: [{ say: '90° is a right angle.' }, { say: 'So it is a right-angled triangle.', show: 'right-angled' }],
        })
      }
      const correct = at(names, kind)
      const m = mcqText(rng, correct, [
        { value: 'equilateral', why: 'An equilateral triangle has three equal sides.' },
        { value: 'isosceles', why: 'An isosceles triangle has exactly two equal sides.' },
        { value: 'scalene', why: 'A scalene triangle has no equal sides.' },
        { value: 'right-angled', why: 'You cannot tell there is a 90° angle from these sides.' },
      ].filter((o) => o.value !== correct))
      return mcqItem({
        prompt: `A triangle has sides of ${sides.join(' cm, ').replace(/, (\d+)$/, ' and $1')} cm. What type of triangle is it?`,
        ...m,
        figure: { kind: 'shape', shape: 'triangle', sideLabels: sides.map((x) => `${x} cm`), alt: `A triangle with sides of ${sides.join(' cm, ')} cm.` },
        hints: ['Look at the side lengths.', 'Count how many sides are the same length.', `The sides are ${sides.join(', ')}. Are any of them equal?`],
        explanation: kind === 0 ? 'All three sides are equal, so it is equilateral.' : kind === 1 ? 'Exactly two sides are equal, so it is isosceles.' : 'No sides are equal, so it is scalene.',
        solution: [{ say: 'Compare the three sides.', show: sides.map((x) => `${x} cm`).join(', ') }, { say: 'Name the triangle.', show: correct }],
      })
    }
    if (level === 3) {
      const qs = [
        { q: 'Which quadrilateral has exactly one pair of parallel sides?', a: 'trapezium', w: [['parallelogram', 'A parallelogram has two pairs of parallel sides.'], ['rectangle', 'A rectangle has two pairs of parallel sides.'], ['kite', 'A kite has no parallel sides.']] },
        { q: 'Which quadrilateral has four equal sides but no right angles?', a: 'rhombus', w: [['square', 'A square has four right angles.'], ['rectangle', 'A rectangle has four right angles.'], ['kite', 'A kite has two pairs of equal sides, not four equal sides.']] },
        { q: 'Which quadrilateral has two pairs of equal sides that are next to each other?', a: 'kite', w: [['rhombus', 'All four sides of a rhombus are equal.'], ['parallelogram', 'In a parallelogram, equal sides are opposite each other.'], ['trapezium', 'A trapezium does not need any equal sides.']] },
        { q: 'Which quadrilateral has four right angles and two pairs of equal sides, but not four equal sides?', a: 'rectangle', w: [['square', 'A square has four equal sides.'], ['rhombus', 'A rhombus does not have right angles.'], ['parallelogram', 'A parallelogram does not need right angles.']] },
      ] as const
      if (rng.chance(0.55)) {
        const pick = rng.pick(qs)
        const m = mcqText(rng, pick.a, pick.w.map(([value, why]) => ({ value, why })))
        return mcqItem({
          prompt: pick.q,
          ...m,
          hints: ['Think about the sides and the angles of each shape.', 'Parallel sides never meet, like train tracks.', 'Picture each shape and check every clue.'],
          explanation: `A ${pick.a} fits every clue.`,
          solution: [{ say: 'Check each clue for each shape.' }, { say: 'Only one shape fits.', show: pick.a }],
        })
      }
      const sym = rng.pick([
        { shape: 'rectangle', n: 2 },
        { shape: 'square', n: 4 },
        { shape: 'rhombus', n: 2 },
        { shape: 'kite', n: 1 },
        { shape: 'parallelogram', n: 0 },
        { shape: 'hexagon', n: 6 },
        { shape: 'pentagon', n: 5 },
      ] as const)
      const nm = sym.shape === 'hexagon' ? 'regular hexagon' : sym.shape === 'pentagon' ? 'regular pentagon' : sym.shape
      return numItem({
        prompt: `How many lines of symmetry does a ${nm} have?`,
        answer: sym.n,
        figure: { kind: 'shape', shape: sym.shape, alt: `A drawing of a ${nm}.` },
        hints: ['A line of symmetry splits a shape into two matching halves.', 'Imagine folding the shape so the halves fit exactly.', 'Try folding across, then up and down, then from corner to corner.'],
        explanation: `A ${nm} has ${sym.n} line${sym.n === 1 ? '' : 's'} of symmetry.`,
        solution: [{ say: 'Try every possible fold.' }, { say: 'Count the folds where the halves match.', show: String(sym.n) }],
      })
    }
    if (level === 4) {
      if (rng.chance(0.55)) {
        const good = rng.pick(VALID_NETS)
        const bad = rng.sample(INVALID_NETS, 3)
        const m = mcqFigs(
          rng,
          netFig(good, 'Six squares that fold into a cube.'),
          bad.map((b) => ({ figure: netFig(b.cells, 'Six joined squares.'), why: b.why })),
        )
        return mcqItem({
          prompt: 'Which of these is a net of a cube?',
          ...m,
          hints: ['A cube has 6 square faces, so its net has 6 squares.', 'Imagine folding each net. No two squares can land in the same place.', 'A 2 by 2 block of squares can never be part of a cube net.'],
          explanation: 'Only one net folds so that the 6 squares make 6 different faces of a cube.',
          solution: [{ say: 'Fold each net in your head.' }, { say: 'Every face must be covered exactly once.' }],
          secs: 90,
        })
      }
      const nets = [
        { desc: '2 triangles and 3 rectangles', a: 'triangular prism' },
        { desc: '1 square and 4 triangles', a: 'square-based pyramid' },
        { desc: '6 squares', a: 'cube' },
        { desc: '6 rectangles, in 3 matching pairs', a: 'cuboid' },
      ]
      const pick = rng.pick(nets)
      const whys: Record<string, string> = {
        'triangular prism': 'A triangular prism has 2 triangles and 3 rectangles.',
        'square-based pyramid': 'A square-based pyramid has 1 square and 4 triangles.',
        cube: 'A cube has 6 squares.',
        cuboid: 'A cuboid has 6 rectangles.',
      }
      const m = mcqText(rng, pick.a, nets.filter((x) => x.a !== pick.a).map((x) => ({ value: x.a, why: whys[x.a] ?? '' })))
      return mcqItem({
        prompt: `A net is made of ${pick.desc}. Which 3D shape does it make?`,
        ...m,
        hints: ['Each shape in the net becomes one face.', 'Think about the faces of each 3D shape.', `Count the faces: the net has ${pick.desc.split(' ').filter((w) => /^\d+$/.test(w)).map(Number).reduce((x, y) => x + y, 0)} faces.`],
        explanation: `${cap(pick.a)}: ${whys[pick.a]}`,
        solution: [{ say: 'Match the faces to a 3D shape.' }, { say: 'It folds into this shape.', show: pick.a }],
      })
    }
    const base = rng.pick(POLY)
    const prism = rng.chance(0.5)
    const prop = rng.pick(['faces', 'edges', 'vertices'] as const)
    const val = prism ? { faces: base.n + 2, edges: 3 * base.n, vertices: 2 * base.n } : { faces: base.n + 1, edges: 2 * base.n, vertices: base.n + 1 }
    const shapeName = prism ? `${base.adj} prism` : `${base.adj}-based pyramid`
    return numItem({
      prompt: `How many ${prop} does ${aword(shapeName)} ${shapeName} have? The base is ${aword(base.name)} ${base.name} with ${base.n} sides.`,
      answer: val[prop],
      hints: [
        prism ? 'A prism has two matching ends joined by rectangles.' : 'A pyramid has one base. Triangles meet at a point at the top.',
        prism ? `Each end is ${aword(base.name)} ${base.name} with ${base.n} sides.` : `The base is ${aword(base.name)} ${base.name} with ${base.n} sides.`,
        prop === 'faces' ? (prism ? `There is one rectangle for each side of the ${base.name}.` : `There is one triangle for each side of the base.`) : prop === 'edges' ? (prism ? `Each end has ${base.n} edges.` : `The base has ${base.n} edges.`) : prism ? `Each end has ${base.n} corners.` : `The base has ${base.n} corners.`,
      ],
      explanation: prism
        ? `${cap(aword(shapeName))} ${shapeName} has ${base.n} + 2 = ${base.n + 2} faces, 3 × ${base.n} = ${3 * base.n} edges and 2 × ${base.n} = ${2 * base.n} vertices.`
        : `${cap(aword(shapeName))} ${shapeName} has ${base.n} + 1 = ${base.n + 1} faces, 2 × ${base.n} = ${2 * base.n} edges and ${base.n} + 1 = ${base.n + 1} vertices.`,
      solution: [
        { say: prism ? 'Two ends plus one rectangle for each side.' : 'One base plus one triangle for each side.' },
        { say: `Count the ${prop}.`, show: `${val[prop]} ${prop}` },
      ],
      secs: 120,
    })
  },
}

/* ------------------------------------------------------------------ */
/* Gp: posisi                                                          */
/* ------------------------------------------------------------------ */

const coordinatesTransformations: Generator = {
  skill: 'm5.coordinates-transformations',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    const size = 10
    const pts = (n: number, avoid: [number, number][] = []): [number, number][] => {
      const out: [number, number][] = []
      while (out.length < n) {
        const p: [number, number] = [rng.int(1, size - 1), rng.int(1, size - 1)]
        if ([...out, ...avoid].some((q) => q[0] === p[0] && q[1] === p[1])) continue
        out.push(p)
      }
      return out
    }
    if (level === 1) {
      const all = pts(3)
      const [x, y] = at(all, 0)
      const labels = ['A', 'B', 'C']
      return textItem({
        prompt: 'What are the coordinates of point A? Write them like (2, 5).',
        answers: [coordAnswers(x, y)],
        figure: { kind: 'coordinates', size, points: all.map((p, i) => ({ x: p[0], y: p[1], label: at(labels, i) })), alt: `A grid with points ${all.map((p, i) => `${at(labels, i)} at (${p[0]}, ${p[1]})`).join(', ')}.` },
        hints: ['Read across first, then up.', 'Start at (0, 0). Count along the x-axis, then up the y-axis.', `Point A is ${x} squares across from (0, 0).`],
        explanation: `Point A is ${x} across and ${y} up, so its coordinates are (${x}, ${y}).`,
        solution: [{ say: 'Count across along the x-axis.', show: `x = ${x}` }, { say: 'Count up the y-axis.', show: `(${x}, ${y})` }],
      })
    }
    if (level === 2) {
      let [x, y] = [rng.int(1, size - 1), rng.int(1, size - 1)]
      if (x === y) y = y === size - 1 ? y - 1 : y + 1
      const others = pts(2, [[x, y], [y, x]])
      const all: [number, number][] = rng.shuffle([[x, y], [y, x], ...others])
      const labels = ['P', 'Q', 'R', 'S']
      const ci = all.findIndex((p) => p[0] === x && p[1] === y)
      const m = mcqFrom(
        rng,
        at(labels, ci),
        all
          .map((p, i) => ({ p, l: at(labels, i) }))
          .filter((o) => o.l !== at(labels, ci))
          .map((o) => ({ value: o.l, why: o.p[0] === y && o.p[1] === x ? `Point ${o.l} is at (${o.p[0]}, ${o.p[1]}). Read across first, then up.` : `Point ${o.l} is at (${o.p[0]}, ${o.p[1]}).` })),
        4,
        (v) => v,
      )
      return mcqItem({
        prompt: `Which point is at (${x}, ${y})?`,
        ...m,
        figure: { kind: 'coordinates', size, points: all.map((p, i) => ({ x: p[0], y: p[1], label: at(labels, i) })), alt: `A grid with points ${all.map((p, i) => `${at(labels, i)} at (${p[0]}, ${p[1]})`).join(', ')}.` },
        hints: ['The first number tells you how far across. The second tells you how far up.', `Go ${x} across first.`, `Then go ${y} up.`],
        explanation: `(${x}, ${y}) means ${x} across and ${y} up. That is point ${at(labels, ci)}.`,
        solution: [{ say: `Go ${x} across.` }, { say: `Then go ${y} up.`, show: `Point ${at(labels, ci)}` }],
      })
    }
    if (level === 3) {
      const x1 = rng.int(1, 4)
      const x2 = rng.int(x1 + 2, size - 1)
      const y1 = rng.int(1, 4)
      const y2 = rng.int(y1 + 2, size - 1)
      const corners: [number, number][] = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]
      const miss = rng.int(0, 3)
      const shown = corners.filter((_, i) => i !== miss)
      const [mx, my] = at(corners, miss)
      const labels = ['A', 'B', 'C']
      return textItem({
        prompt: 'Points A, B and C are three corners of a rectangle. What are the coordinates of the fourth corner?',
        answers: [coordAnswers(mx, my)],
        figure: { kind: 'coordinates', size, points: shown.map((p, i) => ({ x: p[0], y: p[1], label: at(labels, i) })), alt: `A grid with points ${shown.map((p, i) => `${at(labels, i)} at (${p[0]}, ${p[1]})`).join(', ')}.` },
        hints: ['The sides of this rectangle are straight across or straight up.', 'The missing corner shares its x number with one point and its y number with another.', 'Write down the coordinates of A, B and C first.'],
        explanation: `The rectangle uses x = ${x1} and ${x2}, and y = ${y1} and ${y2}. The missing corner is (${mx}, ${my}).`,
        solution: [
          { say: 'List the corners you know.', show: shown.map((p) => `(${p[0]}, ${p[1]})`).join(', ') },
          { say: 'Use the x and y values that are missing a pair.', show: `(${mx}, ${my})` },
        ],
      })
    }
    if (level === 4) {
      const x = rng.int(1, 8)
      const y = rng.int(1, 8)
      let dx = rng.int(-4, 4)
      let dy = rng.int(-4, 4)
      if (dx === 0 && dy === 0) dx = 3
      if (x + dx < 0 || x + dx > size) dx = -dx
      if (y + dy < 0 || y + dy > size) dy = -dy
      const nx = x + dx
      const ny = y + dy
      const move = [dx !== 0 ? `${Math.abs(dx)} ${Math.abs(dx) === 1 ? 'square' : 'squares'} ${dx > 0 ? 'right' : 'left'}` : '', dy !== 0 ? `${Math.abs(dy)} ${Math.abs(dy) === 1 ? 'square' : 'squares'} ${dy > 0 ? 'up' : 'down'}` : '']
        .filter(Boolean)
        .join(' and ')
      return textItem({
        prompt: `Point P is at (${x}, ${y}). It is translated ${move}. What are its new coordinates?`,
        answers: [coordAnswers(nx, ny)],
        figure: { kind: 'coordinates', size, points: [{ x, y, label: 'P' }], alt: `A grid with point P at (${x}, ${y}).` },
        hints: ['Moving right or left changes the first number. Moving up or down changes the second.', dx !== 0 ? `${dx > 0 ? 'Add' : 'Subtract'} ${Math.abs(dx)} ${dx > 0 ? 'to' : 'from'} the x-coordinate.` : 'The x-coordinate stays the same.', `Start from (${x}, ${y}).`],
        explanation: `${dx >= 0 ? `${x} + ${dx}` : `${x} − ${-dx}`} = ${nx} and ${dy >= 0 ? `${y} + ${dy}` : `${y} − ${-dy}`} = ${ny}, so P moves to (${nx}, ${ny}).`,
        solution: [
          { say: 'Change the x-coordinate.', show: `${x} → ${nx}` },
          { say: 'Change the y-coordinate.', show: `${y} → ${ny}`, figure: { kind: 'coordinates', size, points: [{ x, y, label: 'P' }, { x: nx, y: ny, label: 'P2' }], alt: `Point P at (${x}, ${y}) and its image at (${nx}, ${ny}).` } },
        ],
      })
    }
    const vertical = rng.chance(0.5)
    const k = rng.int(3, 7)
    const d = rng.int(1, Math.min(k, size - k))
    const side = rng.chance(0.5) ? -1 : 1
    const other = rng.int(1, size - 1)
    const x = vertical ? k + side * d : other
    const y = vertical ? other : k + side * d
    const nx = vertical ? 2 * k - x : x
    const ny = vertical ? y : 2 * k - y
    return textItem({
      prompt: `Point P is at (${x}, ${y}). It is reflected in a ${vertical ? 'vertical' : 'horizontal'} mirror line through ${k} on the ${vertical ? 'x-axis' : 'y-axis'}. Where is its image?`,
      answers: [coordAnswers(nx, ny)],
      figure: { kind: 'coordinates', size, points: [{ x, y, label: 'P' }], alt: `A grid with point P at (${x}, ${y}). The mirror line is ${vertical ? `x = ${k}` : `y = ${k}`}.` },
      hints: [
        'The image is the same distance from the mirror line, on the other side.',
        `P is ${d} ${d === 1 ? 'square' : 'squares'} from the mirror line.`,
        vertical ? 'A vertical mirror changes the x-coordinate only.' : 'A horizontal mirror changes the y-coordinate only.',
      ],
      explanation: `P is ${d} from the mirror line, so the image is ${d} on the other side, at (${nx}, ${ny}).`,
      solution: [
        { say: `Measure from P to the mirror line: ${d}.` },
        { say: 'Go the same distance on the other side.', show: `(${nx}, ${ny})`, figure: { kind: 'coordinates', size, points: [{ x, y, label: 'P' }, { x: nx, y: ny, label: 'P2' }], alt: `Point P at (${x}, ${y}) and its image at (${nx}, ${ny}).` } },
      ],
      secs: 120,
    })
  },
}

/* ------------------------------------------------------------------ */
/* Ss dan Sp: statistika dan peluang                                   */
/* ------------------------------------------------------------------ */

export function modeOf(list: readonly number[]): number[] {
  const counts = new Map<number, number>()
  for (const v of list) counts.set(v, (counts.get(v) ?? 0) + 1)
  const max = Math.max(...counts.values())
  return [...counts].filter(([, c]) => c === max).map(([v]) => v)
}

export function medianOf(list: readonly number[]): number {
  const s = [...list].sort((a, b) => a - b)
  const n = s.length
  return n % 2 === 1 ? at(s, (n - 1) / 2) : (at(s, n / 2 - 1) + at(s, n / 2)) / 2
}

const statistics: Generator = {
  skill: 'm5.statistics',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level === 1) {
      if (rng.chance(0.5)) {
        let list: number[] = []
        do list = Array.from({ length: rng.int(7, 9) }, () => rng.int(30, 37))
        while (modeOf(list).length !== 1)
        const mo = at(modeOf(list), 0)
        const count = list.filter((v) => v === mo).length
        return numItem({
          prompt: `These are the shoe sizes of some children: ${list.join(', ')}. What is the mode?`,
          answer: mo,
          hints: ['The mode is the value that appears most often.', 'Count how many times each size appears.', 'It may help to write the sizes in order first.'],
          explanation: `${mo} appears ${count} times, more than any other size, so the mode is ${mo}.`,
          solution: [{ say: 'Put the sizes in order.', show: [...list].sort((a, b) => a - b).join(', ') }, { say: 'Find the one that appears most often.', show: `${mo} (${count} times)` }],
        })
      }
      const cats = rng.pick([['Red', 'Blue', 'Green', 'Yellow'], ['Mango', 'Banana', 'Papaya', 'Apple'], ['Walk', 'Bus', 'Car', 'Bicycle']] as const)
      let counts: number[] = []
      do counts = cats.map(() => rng.int(2, 14))
      while (new Set(counts).size < counts.length)
      const best = counts.indexOf(Math.max(...counts))
      const m = mcqFrom(
        rng,
        at(cats, best),
        cats.map((c, i) => ({ c, i })).filter((o) => o.i !== best).map((o) => ({ value: o.c, why: `${o.c} has ${at(counts, o.i)}, which is fewer than ${at(counts, best)}.` })),
        4,
        (v) => v,
      )
      return mcqItem({
        prompt: 'The tally chart shows the votes in a class. Which choice is the mode?',
        ...m,
        figure: { kind: 'tally', rows: cats.map((c, i) => ({ label: c, count: at(counts, i) })), alt: `Tally chart: ${cats.map((c, i) => `${c} ${at(counts, i)}`).join(', ')}.` },
        hints: ['The mode is the most common choice.', 'Count each row of tally marks. Each bundle is 5.', `${at(cats, best === 0 ? 1 : 0)} has ${at(counts, best === 0 ? 1 : 0)} votes.`],
        explanation: `${at(cats, best)} has the most votes, ${at(counts, best)}, so it is the mode.`,
        solution: [{ say: 'Count each row.', show: cats.map((c, i) => `${c} ${at(counts, i)}`).join(', ') }, { say: 'The biggest count is the mode.', show: at(cats, best) }],
      })
    }
    if (level === 2) {
      const n = rng.pick([5, 7])
      const list = Array.from({ length: n }, () => rng.int(2, 40))
      if (rng.chance(0.55)) {
        const sorted = [...list].sort((a, b) => a - b)
        const med = medianOf(list)
        return numItem({
          prompt: `Find the median of these numbers: ${list.join(', ')}.`,
          answer: med,
          hints: ['The median is the middle value when the numbers are in order.', 'Write the numbers in order from smallest to largest.', `There are ${n} numbers, so the middle one is number ${(n + 1) / 2} in the list.`],
          explanation: `In order: ${sorted.join(', ')}. The middle value is ${med}.`,
          solution: [{ say: 'Put the numbers in order.', show: sorted.join(', ') }, { say: 'Find the middle one.', show: String(med) }],
        })
      }
      const mx = Math.max(...list)
      const mn = Math.min(...list)
      return numItem({
        prompt: `Find the range of these numbers: ${list.join(', ')}.`,
        answer: mx - mn,
        hints: ['The range is the difference between the largest and the smallest value.', 'Find the largest and the smallest numbers.', `The largest number is ${mx}.`],
        explanation: `The largest is ${mx} and the smallest is ${mn}. ${mx} − ${mn} = ${mx - mn}.`,
        solution: [{ say: 'Find the largest and the smallest.', show: `${mx} and ${mn}` }, { say: 'Subtract.', show: `${mx} − ${mn} = ${mx - mn}` }],
      })
    }
    if (level === 3) {
      const cats = rng.pick([['Football', 'Badminton', 'Swimming', 'Basketball', 'Running'], ['Mango', 'Rambutan', 'Durian', 'Banana', 'Papaya'], ['Cat', 'Dog', 'Rabbit', 'Fish', 'Bird']] as const)
      const step = rng.pick([1, 2, 5])
      const k = rng.int(4, 5)
      const used = cats.slice(0, k)
      let vals: number[] = []
      do vals = used.map(() => rng.int(1, 10) * step)
      while (new Set(vals).size < vals.length)
      const fig: Fig = { kind: 'bars', title: 'Favourite choices', categories: [...used], values: vals, step, yLabel: 'Children', alt: `Bar chart: ${used.map((c, i) => `${c} ${at(vals, i)}`).join(', ')}.` }
      if (rng.chance(0.5)) {
        const [i, j] = rng.sample(range(0, k - 1), 2).sort((a, b) => at(vals, b) - at(vals, a))
        const big = at(vals, i!)
        const small = at(vals, j!)
        return numItem({
          prompt: `The bar chart shows the favourite choices of a class. How many more children chose ${at(used, i!)} than ${at(used, j!)}?`,
          answer: big - small,
          figure: fig,
          hints: ['Read the height of each bar carefully.', `Read the bars for ${at(used, i!)} and ${at(used, j!)}, then subtract.`, `Each line on the scale is ${step}.`],
          explanation: `${at(used, i!)} has ${big} and ${at(used, j!)} has ${small}. ${big} − ${small} = ${big - small}.`,
          solution: [{ say: 'Read the two bars.', show: `${at(used, i!)} ${big}, ${at(used, j!)} ${small}`, figure: fig }, { say: 'Find the difference.', show: `${big} − ${small} = ${big - small}` }],
        })
      }
      return numItem({
        prompt: 'The bar chart shows the favourite choices of a class. How many children were asked altogether?',
        answer: sum(vals),
        figure: fig,
        hints: ['Read the value of every bar.', 'Add all the values together.', `${at(used, 0)} has ${at(vals, 0)}.`],
        explanation: `${vals.join(' + ')} = ${sum(vals)} children.`,
        solution: [{ say: 'Read each bar.', show: vals.join(', '), figure: fig }, { say: 'Add them.', show: `${vals.join(' + ')} = ${sum(vals)}` }],
      })
    }
    if (level === 4) {
      if (rng.chance(0.5)) {
        const list = Array.from({ length: rng.pick([6, 8]) }, () => rng.int(10, 60))
        const sorted = [...list].sort((a, b) => a - b)
        const n = list.length
        const a = at(sorted, n / 2 - 1)
        const b = at(sorted, n / 2)
        const med = (a + b) / 2
        return numItem({
          prompt: `Find the median of these numbers: ${list.join(', ')}.`,
          answer: med,
          decimal: true,
          hints: ['Write the numbers in order first.', `There are ${n} numbers, so there are two middle numbers.`, `The median is halfway between the two middle numbers.`],
          explanation: `In order: ${sorted.join(', ')}. The middle two are ${a} and ${b}. Halfway between them is ${fmt(med)}.`,
          solution: [{ say: 'Put the numbers in order.', show: sorted.join(', ') }, { say: 'Find halfway between the two middle numbers.', show: `(${a} + ${b}) ÷ 2 = ${fmt(med)}` }],
        })
      }
      const weeks = [1, 2, 3, 4, 5, 6]
      const heights: number[] = []
      let h = rng.int(1, 2)
      for (const _ of weeks) {
        heights.push(h)
        h = Math.min(12, h + rng.int(0, 3))
      }
      const [w1, w2] = rng.sample(weeks, 2).sort((a, b) => a - b)
      const grow = at(heights, w2! - 1) - at(heights, w1! - 1)
      return numItem({
        prompt: `The graph shows the height of a bean plant in cm at the end of each week. How much did it grow from week ${w1} to week ${w2}?`,
        answer: grow,
        unit: 'cm',
        figure: { kind: 'coordinates', size: 12, points: weeks.map((w, i) => ({ x: w, y: at(heights, i) })), alt: `A line graph of the plant height. The x-axis shows weeks and the y-axis shows height in cm. ${weeks.map((w, i) => `Week ${w}: ${at(heights, i)} cm`).join(', ')}.` },
        hints: ['Find the two weeks on the x-axis.', 'Read the height for each one from the y-axis.', `In week ${w1} the plant was ${at(heights, w1! - 1)} cm tall.`],
        explanation: `Week ${w1}: ${at(heights, w1! - 1)} cm. Week ${w2}: ${at(heights, w2! - 1)} cm. It grew ${at(heights, w2! - 1)} − ${at(heights, w1! - 1)} = ${grow} cm.`,
        solution: [{ say: 'Read both heights.', show: `${at(heights, w1! - 1)} cm and ${at(heights, w2! - 1)} cm` }, { say: 'Subtract.', show: `${at(heights, w2! - 1)} − ${at(heights, w1! - 1)} = ${grow}` }],
      })
    }
    if (rng.chance(0.5)) {
      const smallest = rng.int(3, 20)
      const rangeV = rng.int(5, 25)
      return numItem({
        prompt: `The range of a set of numbers is ${rangeV}. The smallest number is ${smallest}. What is the largest number?`,
        answer: smallest + rangeV,
        hints: ['Range = largest − smallest.', `So the largest is the smallest plus the range.`, `Start from ${smallest} and count on ${rangeV}.`],
        explanation: `Largest − ${smallest} = ${rangeV}, so the largest is ${smallest} + ${rangeV} = ${smallest + rangeV}.`,
        solution: [{ say: 'Use range = largest − smallest.' }, { say: 'Add the range to the smallest.', show: `${smallest} + ${rangeV} = ${smallest + rangeV}` }],
      })
    }
    const a = rng.int(2, 6)
    const b = rng.int(a + 2, a + 6)
    const target = rng.int(b + 1, b + 4)
    const c = rng.int(target + 1, target + 6)
    const d = rng.int(c, c + 5)
    const known = rng.shuffle([a, b, c, d])
    return numItem({
      prompt: `Five numbers have a median of ${target}. Four of them are ${known.join(', ')}. What is the fifth number?`,
      answer: target,
      hints: ['The median is the middle number when the five numbers are in order.', 'Put the four numbers you know in order.', `In order they are ${[a, b, c, d].join(', ')}. Where could the middle be?`],
      explanation: `In order: ${a}, ${b}, ___, ${c}, ${d}. The missing number must be in the middle, so it is the median: ${target}.`,
      solution: [{ say: 'Order the four numbers.', show: [a, b, c, d].join(', ') }, { say: 'The median must be in the middle.', show: `${a}, ${b}, ${target}, ${c}, ${d}` }],
      secs: 120,
    })
  },
}

const LIKELY = ['impossible', 'unlikely', 'even chance', 'likely', 'certain'] as const
const LIKELY_WHY: Record<(typeof LIKELY)[number], string> = {
  impossible: 'Impossible means it can never happen.',
  unlikely: 'Unlikely means it could happen, but less than half the time.',
  'even chance': 'Even chance means it happens half of the time.',
  likely: 'Likely means it happens more than half of the time.',
  certain: 'Certain means it will always happen.',
}

const probability: Generator = {
  skill: 'm5.probability',
  levels: [1, 2, 3, 4, 5],
  generate({ rng, level }) {
    if (level === 1) {
      const kind = rng.int(0, 4)
      const total = rng.int(6, 12)
      const blue = kind === 0 ? 0 : kind === 1 ? rng.int(1, Math.floor((total - 1) / 2)) : kind === 2 ? total / 2 : kind === 3 ? rng.int(Math.floor(total / 2) + 1, total - 1) : total
      const t2 = kind === 2 && total % 2 === 1 ? total + 1 : total
      const b2 = kind === 2 ? t2 / 2 : blue
      const red = t2 - b2
      const correct = LIKELY[kind]!
      const m = mcqFrom(rng, correct, rng.shuffle(LIKELY.filter((l) => l !== correct).map((l) => ({ value: l, why: LIKELY_WHY[l] }))), 4, (v) => v)
      const bag = b2 === 0 ? `${plur(red, 'red counter', 'red counters')} and no blue counters` : red === 0 ? `${plur(b2, 'blue counter', 'blue counters')} and no other counters` : `${plur(red, 'red counter', 'red counters')} and ${plur(b2, 'blue counter', 'blue counters')}`
      return mcqItem({
        prompt: `A bag has ${bag}. You take one without looking. How likely is it to be blue?`,
        ...m,
        hints: ['Compare the number of blue counters with the total.', `There are ${t2} counters altogether.`, b2 === 0 ? `None of the ${t2} counters are blue.` : `${b2} of the ${t2} counters ${b2 === 1 ? 'is' : 'are'} blue.`],
        explanation: `${b2} out of ${t2} counters ${b2 === 1 ? 'is' : 'are'} blue, so picking blue is ${correct}.`,
        solution: [{ say: 'Count the blue counters and all the counters.', show: `${b2} out of ${t2}` }, { say: 'Choose the word.', show: correct }],
      })
    }
    if (level === 2) {
      if (rng.chance(0.5)) {
        const events = [
          { e: 'rolling an even number', same: 'rolling an odd number', ways: 3 },
          { e: 'rolling a number less than 4', same: 'rolling a number greater than 3', ways: 3 },
          { e: 'rolling a 1 or a 2', same: 'rolling a 5 or a 6', ways: 2 },
        ]
        const pick = rng.pick(events)
        const m = mcqText(rng, pick.same, [
          { value: 'rolling a 6', why: 'There is only one 6 on the dice.' },
          { value: 'rolling a number greater than 1', why: 'Five of the six numbers are greater than 1.' },
          { value: 'rolling a 7', why: 'There is no 7 on a 1 to 6 dice, so this is impossible.' },
          { value: 'rolling a number less than 3', why: 'Only 1 and 2 are less than 3.' },
        ].filter((o) => o.value !== pick.same && !(pick.e === 'rolling a 1 or a 2' && o.value === 'rolling a number less than 3')))
        return mcqItem({
          prompt: `A fair dice has the numbers 1 to 6. Which outcome is equally likely as ${pick.e}?`,
          ...m,
          hints: ['Equally likely means the same chance.', `Count how many numbers on the dice give ${pick.e}.`, 'Now count the numbers for each option.'],
          explanation: `Both ${pick.e} and ${pick.same} can happen in ${pick.ways} ways out of 6, so they are equally likely.`,
          solution: [{ say: 'List the numbers for each event.' }, { say: 'Equal counts mean equally likely.', show: pick.same }],
        })
      }
      const parts = rng.pick([4, 6, 8])
      const shaded = rng.pick(range(1, parts - 1).filter((x) => x * 2 !== parts))
      const correct = shaded * 2 > parts ? 'landing on a shaded section' : 'landing on a white section'
      const m = mcqText(rng, correct, [
        { value: correct === 'landing on a shaded section' ? 'landing on a white section' : 'landing on a shaded section', why: `There are ${correct.includes('shaded') ? parts - shaded : shaded} of those sections, which is fewer.` },
        { value: 'they are equally likely', why: `${shaded} shaded and ${parts - shaded} white are not the same number.` },
        { value: 'it is impossible to land on either', why: 'The spinner must land on one of the sections.' },
      ])
      return mcqItem({
        prompt: `A spinner has ${parts} equal sections. ${shaded} ${shaded === 1 ? 'is' : 'are'} shaded and the rest are white. Which is more likely?`,
        ...m,
        figure: fracFig(shaded, parts, 'circle'),
        hints: ['Count the shaded sections and the white sections.', 'More sections means more likely, because all sections are the same size.', `There ${shaded === 1 ? 'is 1 shaded section' : `are ${shaded} shaded sections`}.`],
        explanation: `${plur(shaded, 'section is', 'sections are')} shaded and ${parts - shaded} ${parts - shaded === 1 ? 'is' : 'are'} white, so ${correct} is more likely.`,
        solution: [{ say: 'Count each colour.', show: `shaded ${shaded}, white ${parts - shaded}`, figure: fracFig(shaded, parts, 'circle') }, { say: 'More sections, more likely.', show: correct }],
      })
    }
    if (level === 3) {
      const r = rng.int(1, 6)
      const b = rng.int(1, 6)
      const g = rng.int(0, 4)
      const total = r + b + g
      const ask = rng.pick(['red', 'blue'] as const)
      const n = ask === 'red' ? r : b
      return textItem({
        prompt: `A bag has ${r} red, ${b} blue${g ? ` and ${g} green` : ''} counters. One counter is taken without looking. What is the probability that it is ${ask}? Write it as a fraction.`,
        answers: [fracAnswers({ n, d: total }, { decimal: true })],
        hints: ['Probability = number of ways it can happen ÷ total number of outcomes.', `How many counters are there altogether?`, `There are ${n} ${ask} counters.`],
        explanation: `There are ${total} counters and ${n} are ${ask}, so the probability is ${n}/${total}${simp({ n, d: total }).d !== total ? ` = ${fs(simp({ n, d: total }))}` : ''}.`,
        solution: [{ say: 'Count all the counters.', show: `${r} + ${b}${g ? ` + ${g}` : ''} = ${total}` }, { say: `Count the ${ask} ones.`, show: `${n}/${total}` }],
      })
    }
    if (level === 4) {
      const r = rng.int(1, 9)
      return lineItem({
        prompt: `A bag has 10 counters. ${r} of them ${r === 1 ? 'is' : 'are'} red. Mark the probability of taking a red counter on the probability scale.`,
        min: 0,
        max: 1,
        step: 0.1,
        answer: dec(r, 1),
        hints: ['The scale goes from 0 (impossible) to 1 (certain).', 'Probability = red counters ÷ all counters.', `${r} out of 10 is ${r} ${r === 1 ? 'tenth' : 'tenths'}.`],
        explanation: `${r} out of 10 counters ${r === 1 ? 'is' : 'are'} red, so the probability is ${r}/10 = ${fmt(dec(r, 1))}.`,
        solution: [{ say: 'Write the probability as a fraction.', show: `${r}/10` }, { say: 'Change it to a decimal and mark it.', show: fmt(dec(r, 1)) }],
      })
    }
    if (rng.chance(0.5)) {
      const rolls = rng.pick([30, 60, 90, 120])
      const ev = rng.pick([
        { e: 'a 6', ways: 1 },
        { e: 'an even number', ways: 3 },
        { e: 'a number less than 3', ways: 2 },
      ] as const)
      return numItem({
        prompt: `A fair 1 to 6 dice is rolled ${rolls} times. About how many times would you expect to roll ${ev.e}?`,
        answer: (rolls * ev.ways) / 6,
        hints: [`How many of the 6 numbers give ${ev.e}?`, `The probability is ${ev.ways}/6.`, ev.ways === 1 ? `Share the ${rolls} rolls equally between the 6 numbers.` : `${rolls} ÷ 6 = ${rolls / 6}.`],
        explanation: `The probability is ${ev.ways}/6. ${ev.ways}/6 of ${rolls} is ${(rolls * ev.ways) / 6}.`,
        solution: [{ say: 'Find the probability.', show: `${ev.ways}/6` }, { say: `Find that fraction of ${rolls}.`, show: `${rolls} ÷ 6 × ${ev.ways} = ${(rolls * ev.ways) / 6}` }],
        tip: 'An expected number is a good guess, not a promise. Real results can be a little different.',
      })
    }
    const sides = rng.pick([3, 4, 5, 6])
    const what = rng.pick(['a coin is tossed', 'a second spinner with 2 colours is spun'] as const)
    return numItem({
      prompt: `A spinner numbered 1 to ${sides} is spun and ${what}. How many different outcomes are there?`,
      answer: sides * 2,
      hints: ['List the outcomes in a table or a list.', `Each of the ${sides} numbers can go with 2 results.`, `Start your list: 1 and the first result, 1 and the second result.`],
      explanation: `There are ${sides} numbers and 2 results for each, so ${sides} × 2 = ${sides * 2} outcomes.`,
      solution: [{ say: 'Pair each number with each result.' }, { say: 'Count the pairs.', show: `${sides} × 2 = ${sides * 2}` }],
    })
  },
}

/** Generator Math Grade 5. */
export const generators: Generator[] = [
  placeValueMillions,
  roundWholeNumbers,
  decimalPlaceValue,
  compareDecimals,
  roundDecimals,
  multiplyDivide10,
  negativeNumbers,
  sequences,
  mentalAddSubtract,
  writtenAddSubtract,
  multiplesFactors,
  primesSquares,
  multiplyWritten,
  divideWritten,
  equivalentFractions,
  compareFractions,
  addSubtractFractions,
  fractionsOfAmounts,
  addSubtractDecimals,
  multiplyDecimals,
  fractionsDecimalsPercentages,
  percentagesOfAmounts,
  ratioProportion,
  time24,
  perimeterArea,
  angles,
  shapes2d3d,
  coordinatesTransformations,
  statistics,
  probability,
]
