import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { z } from 'zod'

/**
 * Dek kartu belajar: content/flashcards/<mapel>/g<kelas>/<dek>.json dengan {id, subject, grade, title, cards}.
 * Kartu: depan, belakang, figur opsional, dan teks bacaan keras opsional (`say`) bila berbeda dari depan.
 * Skema ini dimiliki agent hub; isi dek dimiliki agent kartu.
 */
const text = (max: number) => z.string().trim().min(1).max(max)

export const FLASHCARD_ID = /^[a-z0-9][a-z0-9-]{1,60}$/
export const CARD_ID = /^[a-z0-9][a-z0-9-]{0,60}$/

export const flashcardSchema = z
  .object({
    id: z.string().regex(CARD_ID, 'id kartu: huruf kecil, angka, tanda hubung'),
    front: text(160),
    back: text(240),
    /** Nama figur di @kira/figures; dirender bila dikenal. */
    figure: z.string().regex(/^[a-z0-9-]{1,40}$/).optional(),
    /** Teks yang dibacakan; kosong berarti depan. */
    say: text(200).optional(),
  })
  .strict()

export const deckSchema = z
  .object({
    id: z.string().regex(FLASHCARD_ID, 'id dek: huruf kecil, angka, tanda hubung'),
    subject: z.enum(['math', 'english', 'science']),
    grade: z.number().int().min(1).max(6),
    title: text(80),
    cards: z.array(flashcardSchema).min(4).max(120),
  })
  .strict()

export type Flashcard = z.infer<typeof flashcardSchema>
export type Deck = z.infer<typeof deckSchema>

export type FlashcardProblem = { file: string; message: string }

const BANNED = new RegExp(String.raw`[\u2014\u2013]|\b(unlock\w*|leverag\w*|seamless\w*|delv\w*)\b`, 'i')

function walk(dir: string): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (name.endsWith('.json')) out.push(p)
  }
  return out
}

/** Muat semua dek. Dek rusak dilaporkan, bukan dimuat. Kartu kembar dalam satu dek ditolak. */
export function loadFlashcards(contentDir: string): { decks: Deck[]; errors: FlashcardProblem[] } {
  const root = join(contentDir, 'flashcards')
  const decks: Deck[] = []
  const errors: FlashcardProblem[] = []
  const ids = new Set<string>()
  for (const file of walk(root)) {
    const rel = relative(contentDir, file)
    const m = /^flashcards[\\/](math|english|science)[\\/]g([1-6])[\\/][a-z0-9-]+\.json$/.exec(rel)
    if (!m) {
      errors.push({ file: rel, message: 'Nama file dek harus flashcards/<subject>/g<grade>/<dek>.json' })
      continue
    }
    let raw: unknown
    try {
      raw = JSON.parse(readFileSync(file, 'utf8'))
    } catch (e) {
      errors.push({ file: rel, message: `JSON tidak valid: ${(e as Error).message}` })
      continue
    }
    const parsed = deckSchema.safeParse(raw)
    if (!parsed.success) {
      errors.push({ file: rel, message: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ') })
      continue
    }
    const d = parsed.data
    const problems: string[] = []
    if (d.subject !== m[1] || d.grade !== Number(m[2])) problems.push('subject dan grade harus sama dengan folder')
    if (ids.has(d.id)) problems.push(`id dek kembar: ${d.id}`)
    const cardIds = new Set<string>()
    const fronts = new Set<string>()
    for (const c of d.cards) {
      if (cardIds.has(c.id)) problems.push(`id kartu kembar: ${c.id}`)
      cardIds.add(c.id)
      const key = c.front.trim().toLowerCase()
      if (fronts.has(key)) problems.push(`sisi depan kembar: ${c.front}`)
      fronts.add(key)
      if (BANNED.test(`${c.front} ${c.back} ${c.say ?? ''}`)) problems.push(`kartu ${c.id}: pakai kata atau tanda yang dilarang`)
      if (key === c.back.trim().toLowerCase()) problems.push(`kartu ${c.id}: depan dan belakang sama`)
    }
    if (BANNED.test(d.title)) problems.push('judul memakai kata atau tanda yang dilarang')
    if (problems.length > 0) {
      errors.push(...problems.map((message) => ({ file: rel, message })))
      continue
    }
    ids.add(d.id)
    decks.push(d)
  }
  return { decks, errors }
}

/** Kartu dikenal lewat kunci gabungan yang stabil untuk FSRS per anak: `<dek>:<kartu>`. */
export const cardKey = (deckId: string, cardId: string) => `${deckId}:${cardId}`
