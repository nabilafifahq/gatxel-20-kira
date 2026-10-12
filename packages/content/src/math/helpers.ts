import type { Rng } from '@kira/core/rng'
import type { IconName } from '@kira/figures/spec'

/** Nama anak untuk soal cerita. Campuran nama Indonesia dan internasional, tanpa nama learner asli. */
export const NAMES = [
  'Aisha', 'Budi', 'Citra', 'Dimas', 'Eka', 'Farah', 'Gilang', 'Hana', 'Iqbal', 'Jasmine', 'Kevin', 'Laila',
  'Maya', 'Nadia', 'Omar', 'Putri', 'Rafi', 'Sari', 'Tomi', 'Wulan', 'Yusuf', 'Zara', 'Ben', 'Chloe', 'Daniel',
  'Emma', 'Leo', 'Mia', 'Noah', 'Olivia', 'Sam', 'Tara', 'Arif', 'Bella', 'Dewi', 'Rizky',
] as const

/** Benda hitung dengan ikon yang tersedia. */
export const COUNTABLES: readonly { icon: IconName; one: string; many: string }[] = [
  { icon: 'apple', one: 'apple', many: 'apples' },
  { icon: 'orange', one: 'orange', many: 'oranges' },
  { icon: 'banana', one: 'banana', many: 'bananas' },
  { icon: 'strawberry', one: 'strawberry', many: 'strawberries' },
  { icon: 'cookie', one: 'cookie', many: 'cookies' },
  { icon: 'muffin', one: 'muffin', many: 'muffins' },
  { icon: 'sweet', one: 'sweet', many: 'sweets' },
  { icon: 'egg', one: 'egg', many: 'eggs' },
  { icon: 'ball', one: 'ball', many: 'balls' },
  { icon: 'marble', one: 'marble', many: 'marbles' },
  { icon: 'pencil', one: 'pencil', many: 'pencils' },
  { icon: 'crayon', one: 'crayon', many: 'crayons' },
  { icon: 'book', one: 'book', many: 'books' },
  { icon: 'flower', one: 'flower', many: 'flowers' },
  { icon: 'star', one: 'star', many: 'stars' },
  { icon: 'shell', one: 'shell', many: 'shells' },
  { icon: 'button', one: 'button', many: 'buttons' },
  { icon: 'car', one: 'toy car', many: 'toy cars' },
  { icon: 'fish', one: 'fish', many: 'fish' },
  { icon: 'bird', one: 'bird', many: 'birds' },
] as const

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

/** Angka ke kata en-GB sampai 999 999, misalnya 342 = "three hundred and forty-two". */
export function numberWords(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 999999) throw new Error(`numberWords: ${n}`)
  if (n < 20) return ONES[n]!
  if (n < 100) return TENS[Math.floor(n / 10)]! + (n % 10 ? `-${ONES[n % 10]}` : '')
  if (n < 1000) {
    const rest = n % 100
    return `${ONES[Math.floor(n / 100)]} hundred${rest ? ` and ${numberWords(rest)}` : ''}`
  }
  const th = Math.floor(n / 1000)
  const rest = n % 1000
  const tail = rest === 0 ? '' : rest < 100 ? ` and ${numberWords(rest)}` : ` ${numberWords(rest)}`
  return `${numberWords(th)} thousand${tail}`
}

/** Format en-GB dengan koma ribuan: 12,500. */
export function fmt(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString('en-GB')
  return n.toLocaleString('en-GB', { maximumFractionDigits: 6 })
}

/** Format Rupiah gaya Indonesia: Rp5.000. */
export function rupiah(n: number): string {
  return `Rp${n.toLocaleString('id-ID')}`
}

/**
 * Pilihan ganda dari jawaban benar dan pengecoh. Pengecoh duplikat atau sama dengan
 * jawaban dibuang, lalu urutan diacak deterministik.
 */
export function mcqFrom<T extends string | number>(
  rng: Rng,
  correct: T,
  distractors: readonly { value: T; why?: string }[],
  count = 4,
  render: (v: T) => string = (v) => (typeof v === 'number' ? fmt(v) : String(v)),
): { options: { text: string; why?: string }[]; answer: number } {
  const seen = new Set<string>([render(correct)])
  const picked: { value: T; why?: string }[] = []
  for (const d of distractors) {
    const key = render(d.value)
    if (seen.has(key)) continue
    seen.add(key)
    picked.push(d)
    if (picked.length >= count - 1) break
  }
  const all = rng.shuffle([{ value: correct, correct: true as const }, ...picked.map((p) => ({ ...p, correct: false as const }))])
  return {
    options: all.map((o) => ({ text: render(o.value), ...('why' in o && o.why ? { why: o.why } : {}) })),
    answer: all.findIndex((o) => o.correct),
  }
}

/** Pengecoh angka di sekitar jawaban, tidak negatif dan tidak sama. */
export function nearNumbers(rng: Rng, answer: number, spread: number[], min = 0): number[] {
  const out: number[] = []
  for (const d of rng.shuffle(spread)) {
    const v = answer + d
    if (v >= min && v !== answer && !out.includes(v)) out.push(v)
  }
  return out
}

export function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b)
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const

/** "half past 3", "quarter to 5", "10 past 2" */
export function timeWords(h: number, m: number): string {
  const hh = ((h + 11) % 12) + 1
  const next = (hh % 12) + 1
  if (m === 0) return `${hh} o'clock`
  if (m === 15) return `quarter past ${hh}`
  if (m === 30) return `half past ${hh}`
  if (m === 45) return `quarter to ${next}`
  if (m < 30) return `${m} minutes past ${hh}`
  return `${60 - m} minutes to ${next}`
}

/** "3:05" */
export function digital(h: number, m: number): string {
  return `${h}:${String(m).padStart(2, '0')}`
}
