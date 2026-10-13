import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

/**
 * Daftar kata Spelling Bee (content/spelling/<level>.json), satu berkas per tingkat Cambridge Young Learners.
 * Setiap kata punya satu kalimat contoh yang memuat kata itu. Kata dan kalimat dibacakan dengan suara
 * dikte (lihat packages/core/src/tts.ts), jadi teksnya ditulis apa adanya untuk dibaca keras.
 */

export const SPELLING_LEVELS = ['starters', 'movers', 'flyers'] as const
export type SpellingLevel = (typeof SPELLING_LEVELS)[number]

export const spellingWordSchema = z
  .object({
    word: z.string().regex(/^[A-Za-z]{2,16}$/, 'Kata hanya huruf, 2 sampai 16 huruf'),
    sentence: z.string().trim().min(8).max(140),
  })
  .strict()
export type SpellingWord = z.infer<typeof spellingWordSchema>

export const spellingFileSchema = z
  .object({ level: z.enum(SPELLING_LEVELS), words: z.array(spellingWordSchema).min(10).max(400) })
  .strict()

export function spellingId(level: SpellingLevel, word: string): string {
  return `${level}:${word.toLowerCase()}`
}

/** Apakah kalimat memuat kata itu sebagai kata utuh (tanpa huruf lain di kiri dan kanannya). */
export function containsWord(sentence: string, word: string): boolean {
  const s = sentence.toLowerCase()
  const w = word.toLowerCase()
  let from = 0
  for (;;) {
    const at = s.indexOf(w, from)
    if (at < 0) return false
    const before = at === 0 ? '' : s[at - 1]!
    const after = s[at + w.length] ?? ''
    if (!/[a-z]/.test(before) && !/[a-z]/.test(after)) return true
    from = at + 1
  }
}

/** Temuan semantik satu berkas: kata kembar, kalimat tanpa kata itu, em dash. */
export function spellingProblems(file: z.infer<typeof spellingFileSchema>): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const w of file.words) {
    const key = w.word.toLowerCase()
    if (seen.has(key)) out.push(`${w.word}: kata kembar`)
    seen.add(key)
    if (!containsWord(w.sentence, key)) out.push(`${w.word}: kalimat contoh tidak memuat kata itu`)
    if (/[\u2013\u2014]/.test(w.sentence)) out.push(`${w.word}: ada em dash atau en dash`)
  }
  return out
}

export type SpellingLoad = { levels: Record<SpellingLevel, SpellingWord[]>; errors: { file: string; message: string }[] }

/** Baca semua berkas content/spelling. Folder yang tidak ada berarti belum ada kata (bukan error). */
export function loadSpelling(contentDir: string): SpellingLoad {
  const levels: Record<SpellingLevel, SpellingWord[]> = { starters: [], movers: [], flyers: [] }
  const errors: SpellingLoad['errors'] = []
  for (const level of SPELLING_LEVELS) {
    const file = join(contentDir, 'spelling', `${level}.json`)
    if (!existsSync(file)) continue
    const rel = `spelling/${level}.json`
    let raw: unknown
    try {
      raw = JSON.parse(readFileSync(file, 'utf8'))
    } catch (e) {
      errors.push({ file: rel, message: `JSON tidak terbaca: ${(e as Error).message}` })
      continue
    }
    const parsed = spellingFileSchema.safeParse(raw)
    if (!parsed.success) {
      errors.push({ file: rel, message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') })
      continue
    }
    if (parsed.data.level !== level) errors.push({ file: rel, message: `level di dalam berkas (${parsed.data.level}) tidak cocok dengan nama berkas` })
    for (const m of spellingProblems(parsed.data)) errors.push({ file: rel, message: m })
    levels[level] = parsed.data.words
  }
  return { levels, errors }
}
