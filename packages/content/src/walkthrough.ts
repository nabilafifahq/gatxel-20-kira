import { animResult, applyOp, findEquation, numbersIn, parseEquation, type Anim } from './anim'
import { answerText } from './check'
import type { Item, SolutionStep } from './schema'

/**
 * Pembahasan bergerak otomatis. Dua pekerjaan, keduanya murni dan deterministik:
 *  1. `animateSteps`: langkah yang sudah ada diberi gerakan bila bentuknya dikenal (persamaan a op b = r,
 *     hitung bersusun, deret bilangan). Gerakan hanya dipasang bila hitungannya benar.
 *  2. `deriveSteps`: soal yang belum punya langkah dibuatkan penjelasan "mengapa" dari explanation,
 *     alasan pilihan yang salah, dan kunci jawabannya.
 * Kunci jawaban hanya ikut terkirim lewat `reveal`, yang hanya dibuat di mode latihan.
 */

const MANUAL = new Set(['write', 'speak', 'draw', 'photo', 'story', 'listen', 'grid'])

const COLUMN_ALT = /^Column (addition|subtraction): ([\d,]+) (?:add|take away) ([\d,]+)(?:, answer ([\d,]+))?/

const nice = (n: number): number => Number(n.toFixed(6))

/** Rentang garis bilangan yang rapi untuk lompatan dari a ke r. */
function lineRange(a: number, r: number): { min: number; max: number } | null {
  const lo = Math.min(a, r)
  const hi = Math.max(a, r)
  if (Math.abs(hi) > 100000 || Math.abs(lo) > 100000) return null
  const span = Math.max(1, hi - lo)
  const pad = Math.max(1, Math.ceil(span * 0.25))
  let min = lo - pad
  if (lo >= 0 && min < 0) min = 0
  return { min: Math.floor(min), max: Math.ceil(hi + pad) }
}

/** Bilangan n sebagaimana tertulis di prompt (dengan atau tanpa koma ribuan), atau null. */
function tokenIn(prompt: string, n: number): string | null {
  const plain = String(nice(n))
  const withComma = Number.isInteger(n) && Math.abs(n) >= 1000 ? n.toLocaleString('en-GB') : null
  for (const tok of [withComma, plain]) {
    if (!tok) continue
    const re = new RegExp(`(?<![\\d.,])${tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\d]|[.,]\\d)`)
    if (re.test(prompt)) return tok
  }
  return null
}

/** Rupiah sebagaimana tertulis di prompt, mis. Rp5.000. */
function rupiahIn(prompt: string, n: number): string | null {
  const tok = `Rp${n.toLocaleString('id-ID')}`
  return prompt.includes(tok) ? tok : null
}

type Eq = { a: number; op: '+' | '-' | '×' | '÷'; b: number; r: number; cur?: 'Rp' }

function barFor(eq: Eq): Anim | null {
  const { a, op, b, r } = eq
  const cur = eq.cur ? { cur: eq.cur } : {}
  if (![a, b, r].every((x) => x > 0 && Number.isFinite(x))) return null
  switch (op) {
    case '+':
      return { k: 'bar', parts: [{ v: a }, { v: b }], total: r, ...cur }
    case '-':
      return { k: 'bar', parts: [{ v: b }, { v: r, q: true }], total: a, ...cur }
    case '×':
      if (b < 2 || b > 8 || !Number.isInteger(b)) return null
      return { k: 'bar', parts: Array.from({ length: b }, () => ({ v: a })), total: r, ...cur }
    case '÷':
      if (b < 2 || b > 8 || !Number.isInteger(b)) return null
      return { k: 'bar', parts: Array.from({ length: b }, (_, i) => ({ v: r, ...(i === 0 ? { q: true } : {}) })), total: a, ...cur }
  }
}

const isWordProblem = (item: Pick<Item, 'prompt'>): boolean => item.prompt.split(/\s+/).length >= 9 && /[A-Za-z]{3,}/.test(item.prompt)

/** Beri gerakan pada langkah yang sudah ada. Mengembalikan langkah baru, tidak mengubah masukan. */
export function animateSteps(item: Item, steps: readonly SolutionStep[]): SolutionStep[] {
  const answer = item.type === 'numeric' ? item.answer : null
  const word = isWordProblem(item)
  let barDone = false
  return steps.map((step) => {
    if (step.anim) return step
    const out: SolutionStep = { ...step }
    // Hitung bersusun dari figur kolom.
    const col = step.figure && step.figure.kind === 'table' ? COLUMN_ALT.exec(step.figure.alt ?? '') : null
    if (col) {
      const a = Number(col[2]!.replace(/,/g, ''))
      const b = Number(col[3]!.replace(/,/g, ''))
      const op = col[1] === 'addition' ? '+' : '-'
      const r = applyOp(a, op, b)
      if (Number.isInteger(r) && r >= 0 && a < 1e6 && b < 1e6) {
        delete out.figure
        out.anim = { k: 'column', op, a, b, r, ...(col[4] ? {} : { upTo: 0 }) }
        return out
      }
    }
    const eq = (step.show ? (parseEquation(step.show) ?? findEquation(step.show)) : null) ?? findEquation(step.say)
    if (eq && Math.abs(applyOp(eq.a, eq.op, eq.b) - eq.r) < 1e-9) {
      const marks = [eq.a, eq.b].map((n) => (eq.cur ? rupiahIn(item.prompt, n) : tokenIn(item.prompt, n))).filter((t): t is string => t !== null)
      if (marks.length > 0 && !out.mark) out.mark = [...new Set(marks)].slice(0, 3)
      const isFinal = answer !== null && Math.abs(eq.r - answer) < 1e-9
      if (word && isFinal && !barDone) {
        const bar = barFor(eq)
        if (bar) {
          barDone = true
          out.anim = bar
          return out
        }
      }
      const jumpy = /jump|count on|count back|land|number line/i.test(step.say)
      if (jumpy && (eq.op === '+' || eq.op === '-') && Math.abs(eq.b) <= 100 && eq.a >= 0 && eq.r >= 0) {
        const range = lineRange(eq.a, eq.r)
        if (range) {
          out.anim = { k: 'line', min: range.min, max: range.max, start: eq.a, jumps: [eq.op === '+' ? eq.b : -eq.b] }
          return out
        }
      }
      out.anim = { k: 'combine', a: eq.a, op: eq.op, b: eq.b, r: eq.r, ...(eq.cur ? { cur: eq.cur } : {}) }
      return out
    }
    // Deret bilangan: "3, 4, 5, 6".
    if (step.show && /^-?\d+(?:\s*,\s*-?\d+){2,13}$/.test(step.show)) {
      out.anim = { k: 'seq', items: step.show.split(',').map((s) => s.trim()) }
      return out
    }
    return out
  })
}

/** Pisah kalimat. Titik di antara angka (Rp90.000, 3.14) bukan akhir kalimat. */
export const splitSentences = (text: string): string[] =>
  (text.match(/(?:[^.!?]|\.(?=\d))+[.!?]+(?:["')\]]+)?|(?:[^.!?]|\.(?=\d))+$/g) ?? [text]).map((s) => s.trim()).filter(Boolean)

function clip(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const at = cut.lastIndexOf(' ')
  return `${cut.slice(0, at > max / 2 ? at : max - 1).replace(/[,;:]$/, '')}.`
}

/** Kalimat soal yang bertanya, dipotong di batas kata dan harus muncul persis di prompt. */
function questionMark(prompt: string): string | null {
  const sentences = splitSentences(prompt)
  const q = [...sentences].reverse().find((s) => s.endsWith('?')) ?? sentences[sentences.length - 1]
  if (!q) return null
  let tok = q
  if (tok.length > 60) {
    const cut = tok.slice(0, 60)
    tok = cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:]$/, '')
  }
  tok = tok.trim()
  return tok.length >= 8 && prompt.includes(tok) ? tok : null
}

/** Opsi diacak saat tampil kecuali soal lomba, jadi huruf opsi di kunci hanya berlaku bila urutannya tetap. */
const KEEP_ORDER = new Set(['keep-order', 'esmo', 'ikmc', 'sasmo'])
function shownKey(item: Item, key: string): string {
  if (item.type !== 'mcq' && item.type !== 'multi') return key
  return item.tags.some((t) => KEEP_ORDER.has(t)) ? key : key.replace(/(^|; )[A-F]\. /g, '$1')
}

/** Penjelasan "mengapa" dari penjelasan yang sudah ada. Null bila soal tidak cocok. */
export function deriveSteps(item: Item): SolutionStep[] | null {
  if (MANUAL.has(item.type)) return null
  let key: string
  try {
    key = answerText(item)
  } catch {
    return null
  }
  if (!key || key.length > 118) return null
  const steps: SolutionStep[] = []
  const mark = questionMark(item.prompt)
  steps.push({
    say: item.figure ? 'Look at the picture and read what the question asks.' : 'Read what the question asks.',
    ...(mark ? { mark: [mark] } : {}),
    ...(item.figure ? { focus: 'figure' as const } : {}),
  })
  const sentences = splitSentences(item.explanation).map((s) => clip(s, 220))
  // Paling banyak 4 langkah penjelasan: kalimat sisa digabung ke langkah terakhir selama muat.
  const groups: string[] = []
  for (const s of sentences) {
    if (groups.length < 4) groups.push(s)
    else if (groups[3]!.length + s.length + 1 <= 220) groups[3] = `${groups[3]} ${s}`
  }
  for (const g of groups) steps.push({ say: g })
  if (item.type === 'mcq' || item.type === 'multi') {
    const right = item.type === 'mcq' ? [item.answer] : item.answers
    const w = item.options.map((o, i) => ({ o, i })).find(({ o, i }) => !right.includes(i) && o.why && o.text)
    if (w && steps.length < 6) steps.push({ say: clip(`Not ${w.o.text}. ${w.o.why}`, 220) })
  }
  steps.push({ say: 'So the answer is:', show: shownKey(item, key) })
  return steps.length >= 2 && steps.length <= 8 ? steps : null
}

/** Pembahasan akhir satu soal: langkah milik soal diberi gerakan, atau diturunkan bila belum ada. */
export function withWalkthrough<T extends Item>(item: T): T {
  if (item.solution && item.solution.length >= 2) {
    const solution = animateSteps(item, item.solution)
    const full = { ...item, solution }
    // Langkah yang tidak menyebut jawabannya (misalnya pecahan belum disederhanakan) ditutup dengan kunci.
    if (solutionReaches(full) === false && solution.length < 8) {
      let key: string
      try {
        key = answerText(item)
      } catch {
        key = ''
      }
      if (key && key.length <= 118) return { ...item, solution: [...solution, { say: 'So the answer is:', show: shownKey(item, key) }] }
    }
    return full
  }
  const derived = deriveSteps(item)
  if (!derived) return item
  const solution = animateSteps(item, derived)
  DERIVED.add(solution)
  return { ...item, solution }
}

/** Langkah yang diturunkan otomatis (bukan tulisan penulis soal). Dipakai supaya klip suara tidak dibuat massal untuknya. */
const DERIVED = new WeakSet<object>()
export const isDerivedSolution = (solution: readonly SolutionStep[] | undefined): boolean => solution !== undefined && DERIVED.has(solution)

/** Semua bilangan yang ditunjukkan satu gerakan. */
function animNumbers(a: Anim): number[] {
  const r = animResult(a)
  const out = r === null ? [] : [r]
  if (a.k === 'bar') out.push(a.total, ...a.parts.map((p) => p.v))
  if (a.k === 'line') out.push(a.start)
  return out
}

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9.]+/g, ' ').trim()

/** Bilangan yang dicari pembahasan: jawaban soal numerik, atau pilihan benar yang berupa angka saja. */
function targetNumbers(item: Item): number[] | null {
  if (item.type === 'numeric') return [item.answer, ...(item.acceptAlt ?? [])]
  if (item.type === 'mcq') {
    const t = item.options[item.answer]?.text?.replace(/,/g, '').trim()
    if (t && /^-?\d+(?:\.\d+)?$/.test(t)) return [Number(t)]
  }
  return null
}

/**
 * Apakah pembahasan sampai ke jawaban berkunci? Bilangan: ada hasil gerakan atau angka di teks langkah yang sama dengan kunci.
 * Selain itu: teks jawaban (bagian pilihan atau isian pertama) muncul di salah satu langkah.
 * Null bila soal tidak punya pembahasan atau tidak bisa diperiksa.
 */
export function solutionReaches(item: Item): boolean | null {
  const steps = item.solution
  if (!steps || steps.length === 0 || MANUAL.has(item.type)) return null
  const texts = steps.map((s) => `${s.say} ${s.show ?? ''}`)
  const nums = targetNumbers(item)
  if (nums) {
    const found: number[] = []
    for (const s of steps) if (s.anim) found.push(...animNumbers(s.anim))
    for (const t of texts) found.push(...numbersIn(t))
    return nums.some((n) => found.some((f) => Math.abs(f - n) < 1e-6))
  }
  let needle: string | null = null
  if (item.type === 'mcq') needle = item.options[item.answer]?.text ?? null
  else if (item.type === 'text') needle = item.blanks[0]?.answers[0] ?? null
  else if (item.type === 'multi') needle = item.options[item.answers[0] ?? 0]?.text ?? null
  else if (item.type === 'tiles') needle = item.answer
  else if (item.type === 'spell') needle = item.word
  if (!needle) return null
  const n = norm(needle)
  if (!n) return null
  const all = norm(texts.join(' '))
  if (all.includes(n)) return true
  // Jawaban berupa kalimat: angka di jawaban harus ada, dan sebagian besar kata kuncinya.
  const digits = n.match(/[0-9]+(?:[.][0-9]+)?/g) ?? []
  const has = (d: string) => all.includes(d) && new RegExp('(?<![0-9])' + d.replace('.', '[.]') + '(?![0-9])').test(all)
  if (digits.some((d) => !has(d))) return false
  if (digits.length > 0) return true
  const words = n.split(' ').filter((x) => x.length >= 3 && !/[0-9]/.test(x))
  if (words.length === 0) return digits.length > 0
  const hit = words.filter((x) => all.includes(x)).length
  return hit / words.length >= 0.6
}
