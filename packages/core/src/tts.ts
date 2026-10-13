/**
 * Suara bahasa Inggris (Qwen3-TTS, rencana bagian 11). Modul murni yang dipakai bersama oleh web, worker,
 * dan uji: id gaya suara, aturan kunci simpanan klip, pemecah teks, dan penggolong kalimat.
 *
 * Kunci simpanan klip = sha256 dari `ttsKeyInput(teks, gaya)`. Web (SubtleCrypto) dan worker (node:crypto)
 * harus menghitung masukan yang sama persis, jadi semua normalisasi ada di sini. Suara yang dipilih dari
 * pustaka gaya diputar secara deterministik dari kunci itu (`ttsSeed`), jadi teks yang sama selalu
 * mendapat suara yang sama.
 *
 * Daftar suara dan instruksi per gaya ada di deploy/tts/styles.json (dibaca layanan Python). Uji
 * packages/core/src/tts.test.ts menjaga id gaya di sini tetap sama dengan berkas itu.
 */

export const TTS_STYLE_IDS = ['narrator', 'teacher', 'quizhost', 'child', 'robot', 'grandpa', 'dictation'] as const
export type TtsStyleId = (typeof TTS_STYLE_IDS)[number]

export const TTS_DEFAULT_STYLE: TtsStyleId = 'teacher'

/** Teks terpanjang yang dikirim sebagai satu klip. Teks lebih panjang dipecah per kalimat. */
export const TTS_CLIP_MAX_CHARS = 280

export const TTS_STYLE_LABELS: Record<TtsStyleId, string> = {
  narrator: 'Warm storyteller',
  teacher: 'Friendly teacher',
  quizhost: 'Quiz host',
  child: 'Child',
  robot: 'Robot',
  grandpa: 'Grandpa',
  dictation: 'Slow and clear',
}

/** Model yang dipakai tiap gaya. Batch mengurutkan klip menurut model supaya layanan jarang bertukar model. */
export const TTS_STYLE_MODEL: Record<TtsStyleId, 'design' | 'custom'> = {
  narrator: 'design',
  teacher: 'design',
  quizhost: 'custom',
  child: 'design',
  robot: 'design',
  grandpa: 'design',
  dictation: 'design',
}

export function isTtsStyle(v: unknown): v is TtsStyleId {
  return typeof v === 'string' && (TTS_STYLE_IDS as readonly string[]).includes(v)
}

/** Rapikan teks sebelum dihitung kuncinya: NFC, spasi ganda dan baris baru jadi satu spasi. */
export function normalizeTtsText(text: string): string {
  return text.normalize('NFC').replace(/\s+/g, ' ').trim()
}

/** Masukan yang di-hash sha256 untuk kunci klip. */
export function ttsKeyInput(text: string, style: TtsStyleId): string {
  return `${style}\n${normalizeTtsText(text)}`
}

const KEY_RE = /^[0-9a-f]{64}$/
export function isTtsKey(v: unknown): v is string {
  return typeof v === 'string' && KEY_RE.test(v)
}

/** Nama berkas klip: <kunci>.mp3. Mengembalikan kunci dari nama berkas, atau null bila bentuknya salah. */
export function ttsKeyFromFile(name: string): string | null {
  const m = /^([0-9a-f]{64})\.mp3$/.exec(name)
  return m ? m[1]! : null
}

/** Bilangan dari 8 hex pertama kunci. Layanan memakainya untuk memutar suara di dalam satu gaya. */
export function ttsSeed(key: string): number {
  return parseInt(key.slice(0, 8), 16)
}

export type TtsSentenceKind = 'praise' | 'question' | 'instruction' | 'statement'
export type TtsSegment = { text: string; kind: TtsSentenceKind }

const ABBREVIATIONS = /\b(?:Mr|Mrs|Ms|Dr|St|Prof|Jr|Sr)\.$/

const PRAISE = /^(?:well done|great|good job|good work|brilliant|excellent|fantastic|super|wonderful|amazing|nice work|nice one|you did it|perfect|hooray|hurray|yes|correct|that is right|that's right|clever)\b/i

const INSTRUCTION_VERBS = new Set(
  [
    'choose', 'read', 'listen', 'look', 'write', 'tick', 'circle', 'match', 'put', 'find', 'say', 'tell', 'point', 'complete', 'fill',
    'spell', 'type', 'tap', 'draw', 'count', 'answer', 'think', 'try', 'use', 'sort', 'order', 'name', 'repeat', 'copy', 'underline',
    'colour', 'press', 'pick', 'show', 'circle', 'cross', 'join', 'finish', 'begin', 'start', 'record', 'speak', 'talk', 'describe',
    'imagine', 'remember', 'check', 'decide', 'select', 'rewrite', 'change', 'add', 'remove', 'make', 'give', 'take', 'sing', 'wait',
  ],
)

/** Golongkan satu kalimat supaya nadanya bisa dibedakan: pujian, pertanyaan, perintah, atau biasa. */
export function sentenceKind(sentence: string): TtsSentenceKind {
  const s = sentence.trim()
  if (s.length === 0) return 'statement'
  if (/\?["'”’)]*$/.test(s)) return 'question'
  if (PRAISE.test(s)) return 'praise'
  const first = /^[("'‘“]*([A-Za-z]+)/.exec(s)?.[1]?.toLowerCase()
  if (first && INSTRUCTION_VERBS.has(first)) return 'instruction'
  return 'statement'
}

/** Pecah teks menjadi kalimat. Titik pada singkatan (Mr., Mrs., Dr.) bukan akhir kalimat. */
export function splitSentences(text: string): string[] {
  const flat = normalizeTtsText(text)
  if (!flat) return []
  const raw = flat.split(/(?<=[.!?]["'”’)]*)\s+(?=["'‘“(]*[A-Z0-9])/)
  const out: string[] = []
  for (const piece of raw) {
    const prev = out[out.length - 1]
    if (prev !== undefined && ABBREVIATIONS.test(prev)) out[out.length - 1] = `${prev} ${piece}`
    else out.push(piece)
  }
  return out
}

/** Kalimat bergolongan, dikirim ke layanan supaya tiap kalimat mendapat instruksi nada sendiri. */
export function toSegments(text: string): TtsSegment[] {
  return splitSentences(text).map((t) => ({ text: t, kind: sentenceKind(t) }))
}

/**
 * Pecah teks panjang menjadi klip yang tidak melebihi `max` karakter. Paragraf dipertahankan sebagai
 * batas, lalu kalimat digabung selama muat. Satu kalimat yang lebih panjang dari batas dipecah di koma.
 * Web dan worker memakai fungsi ini, jadi potongannya (dan kuncinya) sama di kedua sisi.
 */
export function splitClipText(text: string, max: number = TTS_CLIP_MAX_CHARS): string[] {
  const out: string[] = []
  for (const para of text.split(/\n{2,}/)) {
    let cur = ''
    const flush = () => {
      if (cur) out.push(cur)
      cur = ''
    }
    for (const sentence of splitSentences(para)) {
      for (const part of sentence.length > max ? breakLong(sentence, max) : [sentence]) {
        if (cur && cur.length + 1 + part.length > max) flush()
        cur = cur ? `${cur} ${part}` : part
      }
    }
    flush()
  }
  return out
}

function breakLong(sentence: string, max: number): string[] {
  const pieces = sentence.split(/(?<=[,;:])\s+/)
  const out: string[] = []
  let cur = ''
  for (const p of pieces) {
    if (cur && cur.length + 1 + p.length > max) {
      out.push(cur)
      cur = ''
    }
    cur = cur ? `${cur} ${p}` : p
    while (cur.length > max) {
      const cut = cur.lastIndexOf(' ', max)
      const at = cut > 0 ? cut : max
      out.push(cur.slice(0, at).trim())
      cur = cur.slice(at).trim()
    }
  }
  if (cur) out.push(cur)
  return out
}

export type TtsClipRequest = { text: string; style: TtsStyleId }

/**
 * Teks yang layak dibacakan: ada huruf, bukan hanya angka atau tanda baca, dan tidak terlalu panjang
 * untuk satu klip. Dipakai worker dan endpoint permintaan sebelum membuat klip.
 */
export function isClipText(text: string): boolean {
  const t = normalizeTtsText(text)
  return t.length >= 1 && t.length <= TTS_CLIP_MAX_CHARS && /[A-Za-z]/.test(t)
}

/** Teks di layar memakai ___ untuk isian. Dibacakan sebagai kata "blank". */
export function spokenBlanks(text: string): string {
  return text.replace(/_{3,}/g, 'blank')
}

/** Gaya default menurut jenis isi yang dibacakan. */
export type TtsContext = 'question' | 'passage-story' | 'passage-other' | 'lesson' | 'arena' | 'dictation' | 'examiner' | 'dialogue'

export function styleForContext(ctx: TtsContext): TtsStyleId {
  switch (ctx) {
    case 'passage-story':
      return 'narrator'
    case 'arena':
      return 'quizhost'
    case 'dictation':
      return 'dictation'
    default:
      return 'teacher'
  }
}
