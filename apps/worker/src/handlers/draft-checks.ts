import type { z } from 'zod'
import { semanticProblems } from '@kira/content/load'
import { itemSchema, type Item } from '@kira/content/schema'
import { MANUAL_ITEM_TYPES } from '../ai/item-schema'

/**
 * Pemeriksaan draf AI. Hasilnya `ai_draft.problems`: kalimat pendek bahasa Indonesia yang dibaca
 * tutor sebelum menyetujui. Draf yang lolos itemSchema diperiksa dengan semanticProblems (sama
 * dengan `pnpm content:check`); draf yang belum lolos tetap disimpan dengan daftar masalahnya
 * supaya tutor bisa memperbaikinya di editor JSON.
 */

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => v !== null && typeof v === 'object' && !Array.isArray(v)

// Sama dengan packages/content/src/load.ts supaya draf dan content:check memakai aturan yang sama.
const BANNED_CHARS = /[\u2014\u2013]/
const BANNED_WORDS = /\b(leverag\w*|seamless\w*|robust|delv\w*|unlock\w*|empower\w*|crucial|pivotal|holistic|tapestry|testament|utiliz\w*|utilis\w*)\b/i
const ANTITHESIS = /\b(not just|not merely|more than just|bukan sekadar|lebih dari sekadar)\b/i
const MENTIONS_FIGURE = /\b(picture|diagram|figure|chart|graph|table|image|gambar|tabel|grafik|bagan)\b/i

function textsOf(c: Obj): string[] {
  const t: string[] = []
  const push = (v: unknown) => {
    if (typeof v === 'string') t.push(v)
  }
  push(c.prompt)
  push(c.explanation)
  push(c.tip)
  push(c.model)
  push(c.readText)
  for (const h of Array.isArray(c.hints) ? c.hints : []) push(h)
  for (const o of Array.isArray(c.options) ? c.options : []) if (isObj(o)) (push(o.text), push(o.why))
  for (const i of Array.isArray(c.items) ? c.items : []) (push(i), isObj(i) && push(i.text))
  for (const g of Array.isArray(c.groups) ? c.groups : []) push(g)
  for (const p of Array.isArray(c.pairs) ? c.pairs : []) if (Array.isArray(p)) p.forEach(push)
  for (const b of Array.isArray(c.blanks) ? c.blanks : []) if (isObj(b) && Array.isArray(b.answers)) b.answers.forEach(push)
  for (const p of Array.isArray(c.planning) ? c.planning : []) push(p)
  if (isObj(c.rubric) && Array.isArray(c.rubric.criteria)) for (const k of c.rubric.criteria) if (isObj(k)) push(k.label)
  return t
}

/** Pemeriksaan untuk kandidat yang belum lolos itemSchema (bentuknya belum pasti). */
function rawProblems(c: Obj): string[] {
  const p: string[] = []
  const type = String(c.type)
  const hints = Array.isArray(c.hints) ? c.hints : []
  if (!MANUAL_ITEM_TYPES.includes(type) && hints.length !== 3) p.push(`Hint harus tepat 3 untuk soal yang dinilai otomatis, sekarang ${hints.length}.`)
  if (MANUAL_ITEM_TYPES.includes(type) && hints.length > 3) p.push('Hint paling banyak 3.')
  if (typeof c.explanation !== 'string' || !c.explanation.trim()) p.push('Penjelasan kosong.')
  if (type === 'mcq' || type === 'multi') {
    const opts = Array.isArray(c.options) ? c.options : []
    const keys = opts.map((o) => (isObj(o) && typeof o.text === 'string' ? o.text.trim().toLowerCase() : ''))
    if (new Set(keys).size !== keys.length) p.push('Opsi kembar')
    const answers = type === 'mcq' ? [c.answer] : Array.isArray(c.answers) ? c.answers : [c.answers]
    if (answers.some((a) => typeof a !== 'number' || !Number.isInteger(a) || a < 0 || a >= opts.length)) p.push('answer di luar opsi')
  }
  for (const t of textsOf(c)) {
    if (BANNED_CHARS.test(t)) p.push(`Ada em dash atau en dash: "${t.slice(0, 50)}"`)
    if (BANNED_WORDS.test(t)) p.push(`Kata terlarang GTX: "${t.slice(0, 50)}"`)
  }
  return p
}

/** Masalah Zod yang sudah dijelaskan rawProblems dengan kalimat yang lebih jelas (jumlah hint, penjelasan kosong, indeks jawaban mcq/multi). */
function coveredByRaw(issue: z.core.$ZodIssue, c: Obj): boolean {
  const [head, ...rest] = issue.path.map(String)
  if (rest.length === 0 && (head === 'hints' || head === 'explanation')) return true
  return (c.type === 'mcq' || c.type === 'multi') && (head === 'answer' || head === 'answers')
}

function zodProblem(issue: z.core.$ZodIssue): string {
  const path = issue.path.map(String).join('.') || 'soal'
  switch (issue.code) {
    case 'too_small':
      return `${path}: terlalu sedikit atau terlalu pendek (minimal ${String(issue.minimum)}).`
    case 'too_big':
      return `${path}: terlalu banyak atau terlalu panjang (maksimal ${String(issue.maximum)}).`
    case 'invalid_type':
      return `${path}: isian kosong atau tipenya salah.`
    case 'invalid_value':
      return `${path}: nilai tidak dikenal.`
    case 'unrecognized_keys':
      return `${path}: ada kolom yang tidak dikenal (${issue.keys.join(', ')}).`
    case 'invalid_union':
      return `${path}: bentuk soal tidak cocok dengan jenisnya.`
    case 'custom':
      return `${path}: ${issue.message}`
    default:
      return `${path}: isian tidak valid.`
  }
}

// ---------------------------------------------------------------------------
// Kemiripan

function words(s: unknown): string[] {
  return typeof s === 'string'
    ? s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean)
    : []
}

export function jaccard(a: string[], b: string[]): number {
  const A = new Set(a)
  const B = new Set(b)
  if (A.size === 0 && B.size === 0) return 1
  let inter = 0
  for (const w of A) if (B.has(w)) inter++
  return inter / (A.size + B.size - inter)
}

function answerSignature(c: Obj): string {
  const norm = (v: unknown) => JSON.stringify(v ?? null).toLowerCase()
  switch (c.type) {
    case 'mcq':
    case 'multi':
      return norm([Array.isArray(c.options) ? c.options.map((o) => (isObj(o) ? String(o.text ?? '').trim() : '')) : [], c.answer ?? c.answers])
    case 'numeric':
      return norm(c.answer)
    case 'text':
      return norm(c.blanks)
    case 'order':
    case 'sort':
      return norm(c.items)
    case 'match':
      return norm(c.pairs)
    default:
      return norm(c.prompt)
  }
}

/** Mirip bila prompt hampir sama, atau cukup mirip dan kunci jawabannya sama persis. */
export function nearDuplicate(a: Obj, b: Obj): boolean {
  const sim = jaccard(words(a.prompt), words(b.prompt))
  return sim >= 0.9 || (sim >= 0.6 && a.type === b.type && answerSignature(a) === answerSignature(b))
}

// ---------------------------------------------------------------------------

export type DraftCheck = { body: Obj; parsed: Item | null; problems: string[] }

/**
 * Validasi kandidat dengan itemSchema lalu kumpulkan masalahnya.
 * `source` diisi untuk varian (cek terlalu mirip), `siblings` untuk draf lain di job yang sama.
 */
export function checkDraft(candidate: Obj, ctx: { source?: Obj | null; siblings?: Obj[]; hasFigure?: boolean } = {}): DraftCheck {
  const parsed = itemSchema.safeParse(candidate)
  const problems: string[] = []
  let body: Obj = candidate
  let item: Item | null = null
  if (parsed.success) {
    item = parsed.data
    body = parsed.data as unknown as Obj
    problems.push(...semanticProblems(parsed.data))
  } else {
    problems.push(...rawProblems(candidate))
    problems.push(...parsed.error.issues.filter((i) => !coveredByRaw(i, candidate)).map(zodProblem))
    if (problems.length === 0) problems.push('Draf belum lolos skema soal. Periksa JSON-nya sebelum disetujui.')
  }
  for (const t of textsOf(body)) if (ANTITHESIS.test(t)) problems.push(`Ada bingkai antitesis: "${t.slice(0, 50)}"`)
  if (!ctx.hasFigure && typeof body.prompt === 'string' && MENTIONS_FIGURE.test(body.prompt)) {
    problems.push('Prompt menyebut gambar, tabel, atau diagram, padahal draf ini tidak punya figur.')
  }
  if (ctx.source && nearDuplicate(body, ctx.source)) problems.push('Terlalu mirip dengan soal asal.')
  if (ctx.siblings?.some((s) => nearDuplicate(body, s))) problems.push('Mirip dengan draf lain di job ini.')
  // Kutipan teks yang bermasalah tidak menampilkan tanda pisahnya sendiri di konsol.
  const clean = problems.map((p) => p.replace(/[\u2014\u2013]/g, '[tanda pisah]'))
  return { body, parsed: item, problems: [...new Set(clean)].slice(0, 20) }
}
