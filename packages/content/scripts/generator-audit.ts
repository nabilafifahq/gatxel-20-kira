import { findContentDir, loadContent, semanticProblems } from '../src/load'
import { GENERATORS, generateUncached, genRef } from '../src/math'

/**
 * Uji besar semua generator Math. Pemakaian: SEEDS=1000 pnpm tsx packages/content/scripts/generator-audit.ts
 * Keluar dengan kode 1 bila ada temuan. Memeriksa: struktur dan opsi (semanticProblems), jawaban yang dihitung ulang
 * dari prompt untuk soal hitung polos, tanda dan bilangan bulat sesuai kelas, ukuran angka sesuai kelas,
 * kata aneh, serta variasi instans (kombinasi dengan sangat sedikit instans dilaporkan, bukan gagal).
 */
const seeds = Number(process.env.SEEDS ?? 1000)
const { index } = loadContent(findContentDir())

const NUM = String.raw`-?\d[\d,]*(?:\.\d+)?`
const OPCLASS = String.raw`[+\-−×x÷]`
const toNum = (s: string) => Number(s.replace(/,/g, ''))
const OPS: Record<string, (a: number, b: number) => number> = {
  '+': (a, b) => a + b,
  '-': (a, b) => a - b,
  '−': (a, b) => a - b,
  '×': (a, b) => a * b,
  x: (a, b) => a * b,
  '÷': (a, b) => a / b,
}
const RE_DIRECT = new RegExp(String.raw`^(?:What is |Work out |Calculate )?(${NUM})\s*(${OPCLASS})\s*(${NUM})\s*(?:=\s*___|\?|\.)?$`)
const RE_MISSING = new RegExp(String.raw`^(?:Find the missing number\.\s*)?(${NUM})\s*(${OPCLASS})\s*___\s*=\s*(${NUM})$`)

type AnyItem = { type: string; prompt?: string; answer?: unknown; options?: { text?: string }[] }
const answerNumber = (it: AnyItem): number | null => {
  if (it.type === 'numeric') return typeof it.answer === 'number' ? it.answer : null
  if (it.type === 'mcq' && typeof it.answer === 'number') {
    const t = String(it.options?.[it.answer]?.text ?? '').replace(/,/g, '')
    return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null
  }
  return null
}

const LIMIT: Record<number, number> = { 1: 100, 2: 1000, 3: 10000, 4: 1000000, 5: 100000000, 6: 1000000000 }
const NEG_OK = /negative|sequences|function|order-of-operations|coordinates|transformations|fdp|temperature|add-sub|add-subtract|rounding|averages|graphs|decimal/
const FREE_RANGE = /money|time|length|mass|perimeter|area|coordinates|ratio|scale|percent|decimal|fdp|convert|volume|statistics|place-value|rounding|multiply-divide|powers/
const FREE_FRACTION = /money|time|length|mass|fractions|shapes|chart|statistics|probability|decimal/

const TEXT_FAULTS: [string, RegExp][] = [
  ['bentuk tunggal', /(?<![\d.,/]|\d )\b1 (?:ones|tens|hundreds|thousands|tenths|hundredths|steps|children|parts|degrees|days|hours|minutes|coins|squares|units|boxes|sweets|apples|cookies|marbles|edges|vertices)\b/],
  ['a atau an', /\b[Aa] (?:octagon|octagonal|oval|eighth|even chance)\b/],
  ['kata berulang', /\bNot Not\b/],
  ['nilai sama', /would give (\d[\d,.]*), not \1(?![\d])|rounds to (\d[\d,.]*), not \2(?![\d])/],
  ['notasi mentah', /\d\s?\^\s?\d|\d\s?\*\s?\d|\d [xX] \d/],
]

const flags: Record<string, string[]> = {}
const flag = (k: string, ref: string) => (flags[k] ??= []).push(ref)
let combos = 0
let items = 0
let arith = 0
const sparse: string[] = []

for (const [skill, gen] of GENERATORS) {
  const grade = Number(skill[1])
  if (!index.skills.has(skill)) flag(`skill generator tidak ada di indeks: ${skill}`, skill)
  for (const level of gen.levels) {
    combos++
    const sigs = new Set<string>()
    for (let s = 0; s < seeds; s++) {
      const ref = genRef(skill, level, (s * 104729 + 7).toString(36))
      items++
      let it: AnyItem & Record<string, unknown>
      try {
        it = generateUncached(ref) as never
      } catch (e) {
        flag(`melempar galat ${skill}:${level}: ${(e as Error).message.slice(0, 80)}`, ref)
        continue
      }
      const { id: _id, ...body } = it as Record<string, unknown>
      sigs.add(JSON.stringify(body))
      for (const m of semanticProblems(it as never)) flag(`semantik ${skill}:${level}: ${m}`, ref)
      const prompt = String(it.prompt ?? '')
      const a = answerNumber(it)
      const m1 = RE_DIRECT.exec(prompt.trim())
      const m2 = RE_MISSING.exec(prompt.trim())
      if (m1 && a !== null) {
        arith++
        const exp = OPS[m1[2]!]!(toNum(m1[1]!), toNum(m1[3]!))
        if (Math.abs(exp - a) > 1e-9) flag(`jawaban salah ${skill}:${level}: ${prompt} => ${a}, seharusnya ${exp}`, ref)
      } else if (m2 && a !== null) {
        arith++
        const x = toNum(m2[1]!)
        const c = toNum(m2[3]!)
        const op = m2[2]!
        const exp = op === '+' ? c - x : op === '×' || op === 'x' ? c / x : op === '÷' ? x / c : x - c
        if (Math.abs(exp - a) > 1e-9) flag(`jawaban salah ${skill}:${level}: ${prompt} => ${a}, seharusnya ${exp}`, ref)
      }
      if (a !== null && a < 0 && grade <= 3) flag(`jawaban negatif di kelas ${grade}: ${skill}:${level}`, ref)
      if (a !== null && a < 0 && grade >= 4 && !NEG_OK.test(skill)) flag(`jawaban negatif tak terduga: ${skill}:${level}`, ref)
      if (a !== null && !Number.isInteger(a) && grade <= 3 && !FREE_FRACTION.test(skill)) flag(`jawaban bukan bilangan bulat di kelas ${grade}: ${skill}:${level}`, ref)
      const nums = [...prompt.replace(/Rp[\d.,]+/g, '').matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((x) => toNum(x[0]))
      const mx = Math.max(0, ...nums, a !== null ? Math.abs(a) : 0)
      if (!FREE_RANGE.test(skill) && mx > LIMIT[grade]!) flag(`angka terlalu besar untuk kelas ${grade}: ${skill}:${level}`, `${ref} (${mx})`)
      const text = JSON.stringify(body)
      const odd = /undefined|NaN|"null"|\[object/.exec(text)
      if (odd) flag(`kata aneh (${odd[0]}) di ${skill}:${level}`, `${ref} ${text.slice(Math.max(0, odd.index - 40), odd.index + 30)}`)
      // Pola soal lain yang bisa dihitung ulang dari prompt: pembulatan, sisa bagi, persen dari bilangan.
      const rr = /^Round (-?[\d,]+(?:\.\d+)?) to the nearest ([\d,]+)\.?$/.exec(prompt.trim())
      const rem = /^What is the remainder when ([\d,]+) is divided by ([\d,]+)\?$/.exec(prompt.trim())
      const pc = /^(?:What is |Work out )?(\d+(?:\.\d+)?)% of (?:Rp)?([\d.,]+)\??$/.exec(prompt.trim())
      let expected: number | null = null
      if (rr) expected = Math.round(toNum(rr[1]!) / toNum(rr[2]!)) * toNum(rr[2]!)
      else if (rem) expected = toNum(rem[1]!) % toNum(rem[2]!)
      else if (pc && !prompt.includes('Rp')) expected = (toNum(pc[1]!) * toNum(pc[2]!)) / 100
      if (expected !== null && a !== null) {
        arith++
        if (Math.abs(expected - a) > 1e-9) flag(`jawaban salah ${skill}:${level}: ${prompt} => ${a}, seharusnya ${expected}`, ref)
      }
      // Penjelasan numerik harus menyebut jawabannya (dengan atau tanpa pemisah ribuan, titik atau koma desimal).
      if (it.type === 'numeric' && a !== null && String(it.explanation ?? '').length > 0) {
        const raw = String(it.explanation).replace(/,/g, '')
        const ex = raw + ' ' + raw.replace(/Rp(\d{1,3}(?:\.\d{3})+)/g, (_m, g: string) => g.replace(/\./g, ''))
        const forms = [String(a), String(Math.abs(a)), a.toFixed(2), a.toFixed(1)]
        if (a !== 0 && !/factors-multiples-primes/.test(skill) && !forms.some((f) => ex.includes(f)) && !/(centre|grid|chart|table|graph)/i.test(prompt)) flag(`penjelasan tidak menyebut jawaban di ${skill}:${level}`, `${ref} jawaban ${a}: ${String(it.explanation).slice(0, 80)}`)
      }
      if (/ {2}\S/.test(prompt)) flag(`spasi ganda di ${skill}:${level}`, ref)
      if (/\b1 (apples|books|cats|pens|balls|boxes|bags|cars|stickers|sheets|cups|plates|pencils|marbles|bottles|seats|coins)\b/.test(prompt)) flag(`bentuk tunggal salah di ${skill}:${level}`, `${ref} ${prompt.slice(0, 70)}`)
      if (/\b([2-9]|\d\d+) (apple|book|cat|pen|ball|box|bag|car|sticker|cup|plate|pencil|marble|bottle|seat|coin)\b(?! cases?\b)/.test(prompt)) flag(`bentuk jamak salah di ${skill}:${level}`, `${ref} ${prompt.slice(0, 70)}`)
      // Pola bahasa dan notasi di seluruh teks soal, termasuk opsi, petunjuk, dan pembahasan.
      for (const [name, re] of TEXT_FAULTS) {
        const hit = re.exec(text)
        if (hit) flag(`${name} di ${skill}:${level}: "${hit[0]}"`, ref)
      }
    }
    if (sigs.size < 20) sparse.push(`${skill}:${level} (${sigs.size} instans)`)
  }
}

console.log(`skill ${GENERATORS.size}, kombinasi tingkat ${combos}, soal dibangkitkan ${items}, hitungan polos dihitung ulang ${arith}`)
const keys = Object.keys(flags)
console.log(`temuan: ${keys.length} jenis`)
for (const k of keys.slice(0, 60)) console.log(' ', k, `(${flags[k]!.length}x, contoh ${flags[k]![0]})`)
console.log(`kombinasi dengan kurang dari 20 instans berbeda dalam ${seeds} seed: ${sparse.length}`)
if (process.env.SHOW_SPARSE) for (const s of sparse) console.log(' ', s)
process.exit(keys.length ? 1 : 0)
