/**
 * Suara bahasa Inggris (Kokoro-82M, rencana bagian 11). Modul murni yang dipakai bersama oleh web, worker,
 * dan uji: peran suara, aturan kunci simpanan klip, pemecah teks, dan penggolong kalimat.
 *
 * Aturan suara tetap (pilot publik): satu suara Inggris Britania perempuan yang hangat untuk semua soal,
 * pelajaran, perintah, dan bacaan. Pembawa acara kuis dan dikte memakai suara yang SAMA dengan kecepatan berbeda,
 * bukan orang lain. Satu-satunya suara kedua ('second') dipakai hanya untuk bacaan dialog yang secara tegas
 * punya dua pembicara berlabel (lihat `dialogueTurns`). Satu klip selalu satu suara dari awal sampai akhir.
 *
 * Kunci simpanan klip = sha256 dari `ttsKeyInput(teks, peran)`. Masukannya memuat `TTS_VOICE_VERSION`, jadi klip
 * dari suara lama (kunci tanpa versi) tidak pernah disajikan. Naikkan versi bila suara atau kecepatan berubah.
 * Web (SubtleCrypto) dan worker (node:crypto) harus menghitung masukan yang sama persis, jadi semua
 * normalisasi ada di sini. Daftar suara dan kecepatan ada di deploy/tts/styles.json (dibaca layanan Python);
 * uji packages/content/test/tts-styles.test.ts menjaganya tetap sama dengan berkas ini.
 */

/** Versi suara. Bagian dari kunci klip. k1 = Kokoro-82M. */
export const TTS_VOICE_VERSION = 'k1'

/** Peran suara. teacher = suara utama (soal, pelajaran, cerita); quizhost dan dictation = suara utama dengan kecepatan lain. */
export const TTS_STYLE_IDS = ['teacher', 'quizhost', 'dictation', 'second', 'indonesian'] as const
export type TtsStyleId = (typeof TTS_STYLE_IDS)[number]

export const TTS_DEFAULT_STYLE: TtsStyleId = 'teacher'

/** Teks terpanjang yang dikirim sebagai satu klip. Teks lebih panjang dipecah per kalimat. */
export const TTS_CLIP_MAX_CHARS = 280

/** Suara Kokoro tiap peran. Dikunci oleh uji: hanya dua suara berbeda, keduanya Inggris Britania. */
export const TTS_STYLE_VOICE: Record<TtsStyleId, string> = {
  teacher: 'bf_emma',
  quizhost: 'bf_emma',
  dictation: 'bf_emma',
  second: 'bf_isabella',
  // Peran bahasa Indonesia (kamus, arti kata): suara id dari server suara Gatxel, hanya lewat API. Teks Inggris tidak pernah memakainya.
  indonesian: 'id',
}

export function isTtsStyle(v: unknown): v is TtsStyleId {
  return typeof v === 'string' && (TTS_STYLE_IDS as readonly string[]).includes(v)
}

/** Rapikan teks sebelum dihitung kuncinya: NFC, spasi ganda dan baris baru jadi satu spasi. */
export function normalizeTtsText(text: string): string {
  return text.normalize('NFC').replace(/\s+/g, ' ').trim()
}

/**
 * Versi suara yang boleh dipakai di kunci: huruf kecil, angka, titik, garis. Nama backend dan suara ikut di dalamnya
 * (mis. k1 untuk Kokoro, oa-gatxel-female untuk suara jarak jauh), jadi dua suara berbeda tidak pernah berbagi kunci.
 */
export function isVoiceVersion(v: unknown): v is string {
  return typeof v === 'string' && /^[a-z0-9][a-z0-9._-]{0,31}$/.test(v)
}

/**
 * Berkas penunjuk versi yang DISAJIKAN: KIRA_DATA_DIR/tts/served-version.txt. Hanya satu suara yang didengar anak pada satu
 * waktu. Penunjuk berpindah secara atomik oleh `pnpm tts:promote`, setelah seluruh set versi baru lulus gerbang mutu. Selama
 * belum, versi lama yang lengkap tetap disajikan, termasuk untuk klip baru sesuai permintaan. Tanpa berkas: TTS_VOICE_VERSION.
 */
export const TTS_SERVED_VERSION_FILE = 'served-version.txt'

/**
 * Suara Indonesia (peran `indonesian`, suara `id` lewat API Gatxel), hanya untuk terjemahan penjelasan. Versinya berdiri sendiri:
 * penunjuk Inggris (`served-version.txt`) tidak pernah menyentuhnya dan sebaliknya. Tanpa berkas penunjuk ini tidak ada suara Indonesia
 * sama sekali, jadi tombolnya tersembunyi. Berkas klip tetap <kunci>.mp3 di folder yang sama; kuncinya memuat versi ini.
 */
export const TTS_ID_VOICE_VERSION = 'id-piper1'
export const TTS_ID_SERVED_VERSION_FILE = 'served-id-version.txt'

/** Masukan yang di-hash sha256 untuk kunci klip. Memuat versi suara (bawaan: versi kode). */
export function ttsKeyInput(text: string, style: TtsStyleId, version: string = TTS_VOICE_VERSION): string {
  return `${version}\n${style}\n${normalizeTtsText(text)}`
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

/**
 * Bentuk ucapan teks Indonesia, yang dikirim ke layanan suara. Teks yang tampil (dan kuncinya) tidak berubah.
 * Angka di layar mengikuti soal berbahasa Inggris (1,000 dan 3.5), tetapi suara Indonesia membaca koma sebagai pemisah desimal,
 * jadi bentuk itu diucapkan sebagai 1000 dan 3 koma 5. Rupiah memakai titik ribuan (Rp27.500), jadi titik dengan tiga angka dianggap ribuan
 * bila angka terakhirnya 0 atau ada Rp di depannya, selain itu desimal (0.175, 3.125). Angka di belakang koma dibaca satu per satu.
 * Lambang hitung ditulis sebagai katanya. Mengubah fungsi ini setelah klip disajikan berarti menaikkan TTS_ID_VOICE_VERSION.
 */
const digitsApart = (digits: string): string => digits.split('').join(' ')

const UNIT_ID: Record<string, string> = { cm: 'sentimeter', m: 'meter', km: 'kilometer', mm: 'milimeter' }

export function spokenIndonesian(text: string): string {
  return normalizeTtsText(text)
    .replace(/Rp\s*(\d{1,3}(?:[.,]\d{3})+)/g, (_, n: string) => `Rp${n.replace(/[.,]/g, '')}`)
    .replace(/(?<![\d.,])0\.(\d+)/g, (_, f: string) => `0 koma ${digitsApart(f)}`)
    .replace(/(\d)\.(\d{2}[1-9])(?![\d.,])/g, (_, i: string, f: string) => `${i} koma ${digitsApart(f)}`)
    .replace(/(\d)[,.](\d{3})(?=\D|$)/g, '$1$2')
    .replace(/(\d)[,.](\d{3})(?=\D|$)/g, '$1$2')
    .replace(/(\d)\.(\d+)/g, (_, i: string, f: string) => `${i} koma ${digitsApart(f)}`)
    .replace(/\bRp\s*(\d+)/g, '$1 rupiah')
    .replace(/(\d)\s*%/g, '$1 persen')
    .replace(/\s*%/g, ' persen')
    .replace(/(\d)\s+\/\s+(\d)/g, '$1 dibagi $2')
    .replace(/(\d)\/(\d)/g, '$1 per $2')
    .replace(/\s*[×✕]\s*|(?<=\d)\s+x\s+(?=\d)/g, ' kali ')
    .replace(/\s*÷\s*/g, ' dibagi ')
    .replace(/\s*\+\s*/g, ' tambah ')
    .replace(/\s*=\s*/g, ' sama dengan ')
    .replace(/(?<=\d|\s)\s*[−]\s*(?=\d)|(?<=\d)\s+-\s+(?=\d)/g, ' kurang ')
    .replace(/_{3,}/g, 'kosong')
    .replace(/(?<=\d)_(?=\d)/g, ' kosong ')
    .replace(/\s*√\s*/g, ' akar ')
    .replace(/π/g, 'pi')
    .replace(/\s*≈\s*/g, ' kira-kira ')
    .replace(/☐/g, 'kotak')
    .replace(/\s*<\s*/g, ' kurang dari ')
    .replace(/\s*>\s*/g, ' lebih dari ')
    .replace(/(^|[\s(])[-−](?=\d)/g, '$1minus ')
    .replace(/°\s*C\b/g, ' derajat Celsius')
    .replace(/(\d)\s*°/g, '$1 derajat')
    .replace(/(\d)\s*(cm|m|km|mm)²/g, (_, d: string, u: string) => `${d} ${UNIT_ID[u]} persegi`)
    .replace(/(\d)\s*(cm|m)³/g, (_, d: string, u: string) => `${d} ${UNIT_ID[u]} kubik`)
    .replace(/(\d)\s*cm\b/g, '$1 sentimeter')
    .replace(/(\d)\s*mm\b/g, '$1 milimeter')
    .replace(/(\d)\s*km\b/g, '$1 kilometer')
    .replace(/(\d)\s*kg\b/g, '$1 kilogram')
    .replace(/(\d)\s*ml\b/g, '$1 mililiter')
    .replace(/(\d)\s*m\b/g, '$1 meter')
    .replace(/(\d)\s*g\b/g, '$1 gram')
    .replace(/(\d)\s*l\b/g, '$1 liter')
    .replace(/\$\s*(\d+)/g, '$1 dolar')
    .replace(/\s*−\s*/g, ' kurang ')
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => ` pangkat ${[...m].map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c)).join('')}`)
    .replace(/\s{2,}/g, ' ')
    .trim()
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
 * Teks yang layak dibacakan: ada huruf atau angka, bukan hanya tanda baca, dan tidak terlalu panjang
 * untuk satu klip. Dipakai worker dan endpoint permintaan sebelum membuat klip.
 */
export function isClipText(text: string): boolean {
  const t = normalizeTtsText(text)
  return t.length >= 1 && t.length <= TTS_CLIP_MAX_CHARS && /[A-Za-z0-9]/.test(t)
}

/** Teks di layar memakai ___ untuk isian. Dibacakan sebagai kata "blank". */
export function spokenBlanks(text: string): string {
  return text.replace(/_{3,}/g, 'blank')
}

/** Gaya default menurut jenis isi yang dibacakan. */
export type TtsContext = 'question' | 'passage-story' | 'passage-other' | 'lesson' | 'arena' | 'dictation' | 'examiner' | 'dialogue'

export function styleForContext(ctx: TtsContext): TtsStyleId {
  switch (ctx) {
    case 'arena':
      return 'quizhost'
    case 'dictation':
      return 'dictation'
    default:
      return 'teacher'
  }
}

/** Semua jenis bacaan dibawakan suara utama. Suara kedua hanya untuk dialog dua pembicara (`dialogueTurns`). */
export function styleForPassageKind(_kind: string): TtsStyleId {
  return 'teacher'
}

/**
 * Dialog berlabel `Nama: kalimat` dengan TEPAT dua pembicara: pembicara pertama (menurut kemunculan) memakai suara
 * utama, pembicara kedua memakai suara kedua. Label nama dan petunjuk panggung (dalam tanda kurung) tidak dibacakan.
 * Bila pembicaranya satu atau lebih dari dua, atau ada baris yang tidak berlabel yang bukan petunjuk panggung,
 * mengembalikan null dan seluruh bacaan memakai satu suara utama.
 */
export function dialogueTurns(text: string): TtsClipRequest[] | null {
  const speakers: string[] = []
  const turns: TtsClipRequest[] = []
  for (const raw of text.split(/\n+/)) {
    const line = raw.trim()
    if (!line || /^\(.*\)$/.test(line)) continue
    const m = /^([A-Za-z][A-Za-z .'-]{0,24}):\s+(.+)$/.exec(line)
    if (!m) return null
    const who = m[1]!.trim().toLowerCase()
    if (who === 'characters') return null
    let at = speakers.indexOf(who)
    if (at < 0) {
      speakers.push(who)
      at = speakers.length - 1
    }
    if (at > 1) return null
    const spoken = m[2]!.replace(/\([^)]*\)\s*/g, '').trim()
    if (spoken) turns.push({ text: spoken, style: at === 0 ? 'teacher' : 'second' })
  }
  return speakers.length === 2 ? turns : null
}

/** Rencana klip bacaan: dialog dua pembicara per giliran, selain itu satu suara utama. */
export function passageClipPlan(kind: string, text: string): TtsClipRequest[] {
  const turns = kind === 'dialogue' ? dialogueTurns(text) : null
  const raw = turns ?? splitClipText(text).map((t) => ({ text: t, style: styleForPassageKind(kind) }))
  return raw.flatMap((c) => splitClipText(c.text).map((t) => ({ text: t, style: c.style }))).filter((c) => isClipText(c.text))
}

/** Soal ejaan dan dikte dibacakan dengan suara pelan dan jelas. Gaya mengikuti id skill (mis. e2.spelling-bee). */
export function styleForSkill(skillId: string): TtsStyleId {
  return /(?:^|[.-])(?:dictation|spelling|spell)(?:$|[.-])/.test(skillId) ? 'dictation' : 'teacher'
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

/** Klip penanda pilihan jawaban. Dibuat untuk semua gaya yang dipakai soal. */
export function letterClip(index: number): string {
  return `Option ${LETTERS[index] ?? String(index + 1)}.`
}

/** Klip penanda isian ke-n di soal cloze (dihitung dari 0). */
export function blankClip(index: number): string {
  return `Blank ${index + 1}.`
}

/** Bentuk netral isi soal yang bisa dibacakan. Web mengisinya dari ClientItem, worker dari Item. */
export type SpeakableFields = {
  prompt: string
  readText?: string | undefined
  /** Teks tiap opsi menurut urutan tampil; opsi tanpa teks diberi deskripsi gambarnya. */
  options?: string[] | undefined
  orderItems?: string[] | undefined
  matchLeft?: string[] | undefined
  matchRight?: string[] | undefined
  sortGroups?: string[] | undefined
  sortItems?: string[] | undefined
  /** Soal cerita bertahap: pertanyaan tiap bagian beserta opsinya (opsi diberi penanda huruf seperti pilihan ganda). */
  parts?: { prompt: string; options?: string[] | undefined }[] | undefined
  /** Kepingan kata. Urutannya diacak per anak, jadi tiap keping menjadi klipnya sendiri. */
  tiles?: string[] | undefined
  /** Pilihan tiap isian soal cloze. Urutannya diacak, jadi tiap pilihan menjadi klipnya sendiri. */
  cloze?: string[][] | undefined
  /** Label yang disediakan untuk diagram (diacak, tiap label klipnya sendiri). */
  labels?: string[] | undefined
  /** Tabel: judul kolom lalu tiap baris dibacakan sebagai satu bagian. Sel isian kosong dibacakan "blank". */
  table?: { head: string[]; rows: string[][] } | undefined
}

/**
 * Bagian-bagian yang dibacakan untuk satu soal, berurutan. Setiap bagian lalu dipecah `splitClipText`
 * menjadi klip. Opsi dibacakan satu per satu dengan penanda hurufnya, jadi urutan opsi yang diacak
 * tidak membuat klip baru: setiap klip hanya bergantung pada satu teks.
 */
export function speakableParts(f: SpeakableFields): string[] {
  const parts: string[] = [spokenBlanks(f.prompt)]
  if (f.readText) parts.push(f.readText)
  f.options?.forEach((o, i) => {
    parts.push(letterClip(i))
    if (o) parts.push(o)
  })
  for (const list of [f.orderItems, f.matchLeft, f.matchRight, f.sortGroups, f.sortItems]) for (const t of list ?? []) parts.push(t)
  for (const part of f.parts ?? []) {
    parts.push(spokenBlanks(part.prompt))
    part.options?.forEach((o, i) => {
      parts.push(letterClip(i))
      if (o) parts.push(o)
    })
  }
  for (const t of f.tiles ?? []) parts.push(t)
  f.cloze?.forEach((opts, g) => {
    parts.push(blankClip(g))
    for (const t of opts) parts.push(t)
  })
  for (const t of f.labels ?? []) parts.push(t)
  if (f.table) {
    const row = (cells: readonly string[]) => cells.map((c) => (c.trim() === '' ? 'blank' : c)).join(', ')
    parts.push(row(f.table.head))
    for (const r of f.table.rows) parts.push(row(r))
  }
  return parts.map((p) => p.trim()).filter(Boolean)
}

/** Semua klip (teks yang sudah dipecah dan layak dibacakan) dari bagian-bagian. */
export function clipTextsOf(parts: readonly string[]): string[] {
  return parts.flatMap((p) => splitClipText(p)).filter(isClipText)
}

/** Kalimat tetap layar English Skills. Worker membuatnya di setiap batch supaya layar itu selalu punya suara. */
export const TTS_EXAMINER_INTRO = 'Hello! I am your English examiner today.'
export const TTS_BEE_PRAISE = 'Well done!'
export const TTS_BEE_RETRY = 'Not quite. Listen again.'

/**
 * Suara pembawa acara Quiz Arena (gaya quizhost): kalimat pendek yang tetap, jadi bisa dibuat lebih dulu oleh batch
 * dan diputar tanpa menunggu. Bila klipnya belum ada, layar diam saja (bukan suara perangkat).
 */
export const QUIZ_HOST_INTROS = ['Here we go!', 'Next question.', 'Ready? Listen up.', 'Here is your question.'] as const
export const QUIZ_HOST_STREAKS: Readonly<Record<number, string>> = {
  3: 'Three in a row!',
  5: 'Five in a row! Wow!',
  8: 'Eight in a row! You are on fire!',
  10: 'Ten in a row! Amazing!',
}
export const QUIZ_HOST_LINES: readonly string[] = [...QUIZ_HOST_INTROS, ...Object.values(QUIZ_HOST_STREAKS)]

/** Kalimat pembuka pertanyaan: sekali di pertanyaan pertama, lalu tiap empat pertanyaan berikutnya. Selain itu null. */
export function hostIntroLine(index: number): string | null {
  if (index < 0 || index % 4 !== 0) return null
  return index === 0 ? QUIZ_HOST_INTROS[0] : QUIZ_HOST_INTROS[1 + ((index / 4 - 1) % (QUIZ_HOST_INTROS.length - 1))]!
}

/** Pujian saat deretan jawaban benar mencapai 3, 5, 8, dan 10. Selain itu null. */
export function hostStreakLine(streak: number): string | null {
  return QUIZ_HOST_STREAKS[streak] ?? null
}

export const TTS_FIXED_LINES: TtsClipRequest[] = [
    ...[TTS_EXAMINER_INTRO, TTS_BEE_PRAISE, TTS_BEE_RETRY].map((text) => ({ text, style: 'teacher' as const })),
  ...QUIZ_HOST_LINES.map((text) => ({ text, style: 'quizhost' as const })),
]
