/**
 * Kamus Ketuk: aturan murni untuk kamus English ke Indonesia di content/dictionary/en-id.json.
 * Dipakai bersama oleh layar learner (TapWords), server (dek kata pribadi), dan pemeriksa konten.
 * Tidak mengimpor Node supaya aman dibundel ke client.
 */

/** Satu arti. i = arti Indonesia (paling banyak 3, yang paling umum dulu), e = arti English sederhana, p = jenis kata, g = kelas terendah yang memuatnya. */
import type { TtsClipRequest, TtsStyleId } from './tts'

export type DictEntry = { i: string[]; e: string; p?: string; g?: number }

/** Berkas kamus. forms memetakan bentuk jadian (ran, mice, happier) ke bentuk dasar. */
export type DictFile = {
  v: 1
  meta: { source: string; licence: string; attribution: string; built: string }
  entries: Record<string, DictEntry>
  forms: Record<string, string>
}

export const DICT_POS = ['n', 'v', 'adj', 'adv', 'prep', 'pron', 'conj', 'det', 'interj', 'num', 'aux', 'abbr', 'n/v'] as const
export const DICT_MAX_SENSES = 3

/** Nama jenis kata untuk anak. */
export const DICT_POS_LABEL: Record<string, string> = {
  n: 'noun',
  v: 'verb',
  adj: 'adjective',
  adv: 'adverb',
  prep: 'preposition',
  pron: 'pronoun',
  conj: 'joining word',
  det: 'determiner',
  interj: 'exclamation',
  num: 'number word',
  aux: 'helping verb',
  abbr: 'short form',
  'n/v': 'noun or verb',
}

/** Kata yang disimpan anak: huruf kecil, boleh ada tanda hubung, spasi, atau apostrof di dalam. */
export const SAVED_WORD_RE = /^[a-z]+(?:[-' ][a-z]+)*$/

export function normaliseWord(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/[‘’]/g, "'")
    .toLowerCase()
    .replace(/^[^a-z]+|[^a-z]+$/g, '')
}

export type WordHit = { word: string; lemma: string; entry: DictEntry }

function tryRules(dict: Pick<DictFile, 'entries'>, w: string): string | null {
  const c: string[] = []
  if (w.endsWith('ies')) c.push(`${w.slice(0, -3)}y`)
  if (w.endsWith('es')) c.push(w.slice(0, -2))
  if (w.endsWith('s')) c.push(w.slice(0, -1))
  if (w.endsWith('ied')) c.push(`${w.slice(0, -3)}y`)
  if (w.endsWith('ed')) c.push(w.slice(0, -2), w.slice(0, -1))
  if (w.endsWith('ing')) c.push(w.slice(0, -3), `${w.slice(0, -3)}e`)
  if (w.endsWith('er')) c.push(w.slice(0, -2), w.slice(0, -1))
  if (w.endsWith('est')) c.push(w.slice(0, -3), w.slice(0, -2))
  if (w.endsWith('ier')) c.push(`${w.slice(0, -3)}y`)
  if (w.endsWith('iest')) c.push(`${w.slice(0, -4)}y`)
  // Huruf akhir ganda: running -> runn -> run, bigger -> bigg -> big.
  for (const b of [...c]) if (b.length > 3 && b[b.length - 1] === b[b.length - 2] && !'aeiou'.includes(b[b.length - 1] ?? '')) c.push(b.slice(0, -1))
  for (const b of c) if (b.length > 2 && dict.entries[b]) return b
  return null
}

/** Cari kata di kamus: bentuk persis, lalu peta bentuk, lalu tanpa 's, lalu aturan akhiran. */
export function lookupWord(dict: Pick<DictFile, 'entries' | 'forms'>, raw: string): WordHit | null {
  const word = normaliseWord(raw)
  if (word.length === 0) return null
  const direct = dict.entries[word]
  if (direct) return { word, lemma: word, entry: direct }
  const viaForm = dict.forms[word]
  const formEntry = viaForm ? dict.entries[viaForm] : undefined
  if (viaForm && formEntry) return { word, lemma: viaForm, entry: formEntry }
  if (word.endsWith("'s")) return lookupWord(dict, word.slice(0, -2))
  if (word.length > 3) {
    const base = tryRules(dict, word)
    const baseEntry = base ? dict.entries[base] : undefined
    if (base && baseEntry) return { word, lemma: base, entry: baseEntry }
  }
  return null
}

export type TextPiece = { text: string; word: boolean }

/** Pecah teks menjadi kata dan sisanya (spasi, tanda baca, angka). Apostrof di tengah kata (don't, Ana's) tetap satu kata. */
export function splitWords(text: string): TextPiece[] {
  const out: TextPiece[] = []
  const re = /[A-Za-z]+(?:['’][A-Za-z]+)*/g
  let last = 0
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0
    if (at > last) out.push({ text: text.slice(last, at), word: false })
    out.push({ text: m[0], word: true })
    last = at + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last), word: false })
  return out
}

/**
 * Soal kosakata, ejaan, dan fonik: arti kata bisa memberi jawaban, jadi kamus mati. Daftar ini harus sama dengan
 * semua skill English berstrand Rv, Wv, Rw, Ww (dijaga oleh pemeriksa konten dan uji paket content).
 */
export const NO_LOOKUP_SKILLS: readonly string[] = [
  'e1.letter-sounds', 'e1.digraphs', 'e1.vowel-teams', 'e1.tricky-words', 'e1.word-meanings',
  'e2.vowel-spellings', 'e2.magic-e', 'e2.tricky-words', 'e2.synonyms-opposites', 'e2.adjectives',
  'e3.prefixes', 'e3.suffixes', 'e3.er-est', 'e3.plurals', 'e3.dictionary-order', 'e3.homophones', 'e3.synonyms-antonyms',
  'e4.spelling-strategies', 'e4.prefixes', 'e4.suffixes', 'e4.plurals', 'e4.word-families', 'e4.similes',
  'e5.prefixes-suffixes', 'e5.silent-letters-homophones', 'e5.figurative-language', 'e5.precise-verbs',
  'e6.spelling-strategies', 'e6.word-origins', 'e6.spelling-homonyms', 'e6.idioms-metaphors', 'e6.formal-informal',
]

/** Soal yang menanyakan arti atau hubungan kata: kamus mati apa pun skill-nya. */
const ASKS_ABOUT_WORDS = /\b(mean|means|meaning|synonym|synonyms|antonym|antonyms|opposite|opposites|another word|same as|similar to|homophone|homophones|rhymes?|spelled|spelt|spelling|misspelt|definition|which word|odd one out)\b/i

/**
 * Apakah ketuk kata boleh dipakai pada soal ini? Pemanggil sudah mematikannya di Tes berwaktu, Paper, dan Simulasi;
 * di sini hanya aturan per soal: skill kosakata dan soal yang menanyakan arti kata.
 */
export function tapWordsAllowedFor(item: { skill?: string; prompt?: string; type?: string }): boolean {
  if (item.skill && NO_LOOKUP_SKILLS.includes(item.skill)) return false
  if (item.type === 'spell' || item.type === 'listen') return false
  if (item.prompt && ASKS_ABOUT_WORDS.test(item.prompt)) return false
  return true
}

/** Periksa satu entri; kembalikan daftar masalah (kosong bila benar). Dipakai content:check. */
export function dictEntryProblems(word: string, e: unknown): string[] {
  const p: string[] = []
  if (!SAVED_WORD_RE.test(word) && !/^[a-z]+(?:'[a-z]+)+$/.test(word) && !/^[a-z]+\.[a-z.]*$/.test(word)) p.push('kata tidak berbentuk huruf kecil')
  if (!e || typeof e !== 'object') return [...p, 'entri bukan objek']
  const x = e as Record<string, unknown>
  const i = x.i
  if (!Array.isArray(i) || i.length < 1 || i.length > DICT_MAX_SENSES) p.push(`i harus 1 sampai ${DICT_MAX_SENSES} arti`)
  else
    for (const s of i) {
      if (typeof s !== 'string' || s.trim() !== s || s.length < 1 || s.length > 48) p.push(`arti Indonesia tidak valid: ${String(s)}`)
  // gtx-ignore-next-line dash
      else if (/[;—–]/.test(s)) p.push(`arti memuat titik koma atau tanda pisah: ${s}`)
    }
  if (typeof x.e !== 'string' || x.e.length < 3 || x.e.length > 90) p.push('e (arti English) kosong atau lebih dari 90 huruf')
  // gtx-ignore-next-line dash
  else if (/[;—–]/.test(x.e)) p.push('e memuat titik koma atau tanda pisah')
  if (x.p !== undefined && (typeof x.p !== 'string' || !(DICT_POS as readonly string[]).includes(x.p))) p.push(`p tidak dikenal: ${String(x.p)}`)
  if (x.g !== undefined && (typeof x.g !== 'number' || x.g < 1 || x.g > 6)) p.push('g di luar 1 sampai 6')
  return p
}

/** Gaya suara klip satu kata: pelan dan jelas. Tombol speaker di popover memakai gaya yang sama. */
export const DICT_CLIP_STYLE: TtsStyleId = 'dictation'

/** Klip satu kata untuk batch suara: setiap kata dasar dan setiap bentuk jadian yang bisa diketuk. */
export function dictionaryWordClips(dict: Pick<DictFile, 'entries' | 'forms'>): TtsClipRequest[] {
  const words = new Set<string>([...Object.keys(dict.entries), ...Object.keys(dict.forms)])
  return [...words].sort().map((text) => ({ text, style: DICT_CLIP_STYLE }))
}
