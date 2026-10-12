// __GTX_SEED__
/**
 * Data contoh untuk pratinjau konsol tutor, halaman orang tua, publik, dan cetak.
 * Semua nama, email, dan angka buatan (bukan data keluarga asli). Hanya dipakai
 * di /dev, tidak pernah masuk database.
 */
import type { ActionResult, ConsoleShell } from '@/lib/dto'
import type { ClientItem } from '@kira/content/present'

export const SEED_MARK = '__GTX_SEED__'

export const LEARNER_A = { id: 'lrn_seed_alya', name: 'Alya', grade: 2 }
export const LEARNER_B = { id: 'lrn_seed_bima', name: 'Bima', grade: 4 }

export const shell: ConsoleShell = {
  userName: 'Dina Pratiwi',
  orgName: 'Keluarga Wiratama',
  role: 'tutor',
  learners: [LEARNER_A, LEARNER_B],
  currentLearnerId: LEARNER_A.id,
  aiEnabled: true,
}

export const shellSingle: ConsoleShell = { ...shell, learners: [LEARNER_A] }

export const guardianShell: ConsoleShell = {
  userName: 'Ratna Wiratama',
  orgName: 'Keluarga Wiratama',
  role: 'guardian',
  learners: [LEARNER_A, LEARNER_B],
  currentLearnerId: LEARNER_A.id,
  aiEnabled: false,
}

/** Tanggal acuan pratinjau: Jumat, 16 Oktober 2026 (WIB). */
export const TODAY = '2026-10-16'
export const WEEK_START = '2026-10-12'

/** Waktu WIB sebagai timestamp ISO UTC. */
export function wib(date: string, hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number) as [number, number]
  const t = Date.parse(`${date}T00:00:00Z`) + (h - 7) * 3600_000 + m * 60_000
  return new Date(t).toISOString()
}

/**
 * Action palsu: selesai setelah 300ms. `fail` membuat hasil gagal dengan
 * kode referensi DEV-0001 untuk menguji state error.
 */
export function fake<T = undefined>(data: T, fail = false, message = 'Perubahan belum tersimpan di server.', ms = 300) {
  return (..._args: unknown[]): Promise<ActionResult<T>> =>
    new Promise((resolve) =>
      setTimeout(() => resolve(fail ? { ok: false, message, reference: 'DEV-0001' } : { ok: true, data }), ms),
    )
}

// ---------------------------------------------------------------------------
// Soal contoh (bentuk ClientItem tanpa kunci, kecuali yang diberi `key`).

export const ITEM_ARRAY: ClientItem = {
  ref: 'KRA-M-0398',
  type: 'mcq',
  skill: 'm2-arrays',
  difficulty: 2,
  prompt: 'There are 4 rows of apples. Each row has 5 apples. How many apples are there?',
  lang: 'en-GB',
  figure: { kind: 'array', rows: 4, cols: 5, icon: 'apple', alt: '4 rows of 5 apples.' },
  options: [
    { i: 0, text: '9' },
    { i: 1, text: '20' },
    { i: 2, text: '15' },
    { i: 3, text: '25' },
  ],
  expectedSeconds: 45,
}

export const ITEM_CLOCK: ClientItem = {
  ref: 'KRA-M-0413',
  type: 'numeric',
  skill: 'm2-time',
  difficulty: 3,
  prompt: 'Rani starts reading at 7:15. She reads for 30 minutes. What time does she stop? Write the minutes past 7.',
  lang: 'en-GB',
  figure: { kind: 'clock', h: 7, m: 15, showNumbers: true, digital: false, alt: 'A clock showing quarter past 7.' },
  unit: 'minutes past 7',
  allowDecimal: false,
  allowNegative: false,
  expectedSeconds: 60,
}

export const ITEM_ORDER: ClientItem = {
  ref: 'KRA-S-0120',
  type: 'order',
  skill: 's2-life-cycles',
  difficulty: 2,
  prompt: 'Put the life cycle of a frog in order.',
  lang: 'en-GB',
  orderItems: [
    { i: 2, text: 'Froglet' },
    { i: 0, text: 'Frogspawn' },
    { i: 3, text: 'Adult frog' },
    { i: 1, text: 'Tadpole' },
  ],
  expectedSeconds: 60,
}

export const ITEM_MATCH: ClientItem = {
  ref: 'KRA-E-0211',
  type: 'match',
  skill: 'e2-past-tense',
  difficulty: 2,
  prompt: 'Match each verb to its past tense.',
  lang: 'en-GB',
  matchLeft: ['play', 'go', 'eat'],
  matchRight: [
    { i: 1, text: 'went' },
    { i: 2, text: 'ate' },
    { i: 0, text: 'played' },
  ],
  expectedSeconds: 75,
}

export const ITEM_SORT: ClientItem = {
  ref: 'KRA-S-0144',
  type: 'sort',
  skill: 's2-materials',
  difficulty: 2,
  prompt: 'Sort the objects: does a magnet pull them or not?',
  lang: 'en-GB',
  sortGroups: ['Pulled by a magnet', 'Not pulled'],
  sortItems: [
    { i: 0, text: 'paperclip' },
    { i: 1, text: 'wooden spoon' },
    { i: 2, text: 'iron nail' },
    { i: 3, text: 'rubber band' },
  ],
  expectedSeconds: 75,
}

export const ITEM_TEXT: ClientItem = {
  ref: 'KRA-E-0230',
  type: 'text',
  skill: 'e2-past-tense',
  difficulty: 2,
  prompt: 'Yesterday I ____ football with my brother. (play)',
  lang: 'en-GB',
  blanks: 1,
  expectedSeconds: 60,
}

export const ITEM_WRITE: ClientItem = {
  ref: 'KRA-E-0302',
  type: 'write',
  skill: 'e2-writing-recount',
  difficulty: 3,
  prompt: 'Write two or three sentences about what you did last weekend.',
  lang: 'en-GB',
  rubric: [
    { label: 'Uses the past tense', points: 2 },
    { label: 'Full sentences with capital letters and full stops', points: 2 },
    { label: 'Tells what happened in order', points: 1 },
  ],
  minWords: 15,
  maxWords: 60,
  expectedSeconds: 600,
}

export const ITEM_SPEAK: ClientItem = {
  ref: 'KRA-E-0310',
  type: 'speak',
  skill: 'e2-reading-aloud',
  difficulty: 2,
  prompt: 'Read the sentence aloud.',
  lang: 'en-GB',
  readText: 'The little cat sat on the warm mat and went to sleep.',
  maxSeconds: 30,
  rubric: [
    { label: 'Reads every word', points: 2 },
    { label: 'Clear and at a steady pace', points: 2 },
  ],
  expectedSeconds: 120,
}

export const ITEM_DRAW: ClientItem = {
  ref: 'KRA-S-0160',
  type: 'draw',
  skill: 's2-habitats',
  difficulty: 2,
  prompt: 'Draw a pond habitat. Show one animal and one plant that live there.',
  lang: 'en-GB',
  drawBackground: 'blank',
  rubric: [
    { label: 'Shows water', points: 1 },
    { label: 'One animal that lives in a pond', points: 1 },
    { label: 'One plant that lives in a pond', points: 1 },
  ],
  expectedSeconds: 300,
}

export const ITEM_ESMO: ClientItem = {
  ref: 'ORG-ESMO-M-0007',
  type: 'mcq',
  skill: 'm2-patterns',
  difficulty: 3,
  prompt: 'Seekor katak melompat di atas batu bernomor 3, 7, 11, 15. Batu nomor berapa yang diinjak berikutnya?',
  lang: 'id',
  figure: { kind: 'sequence', items: ['3', '7', '11', '15', null], style: 'stones', alt: 'Batu bernomor 3, 7, 11, 15, lalu satu batu kosong.' },
  options: [
    { i: 0, text: '17' },
    { i: 1, text: '18' },
    { i: 2, text: '19' },
    { i: 3, text: '20' },
  ],
  terms: [{ term: 'batu', en: 'stone' }],
  expectedSeconds: 60,
}

export const ITEM_BARS: ClientItem = {
  ref: 'KRA-M-0451',
  type: 'numeric',
  skill: 'm2-data',
  difficulty: 2,
  prompt: 'The chart shows the fruit children chose. How many more children chose bananas than pears?',
  lang: 'en-GB',
  figure: {
    kind: 'bars',
    categories: ['Apple', 'Banana', 'Pear'],
    values: [6, 9, 4],
    axisMax: 10,
    step: 2,
    horizontal: false,
    tone: 'math',
    alt: 'Bar chart. Apple 6, banana 9, pear 4.',
  },
  allowDecimal: false,
  allowNegative: false,
  expectedSeconds: 60,
}
