// __GTX_SEED__
import { BORDER, DIVIDER, ENGLISH, INK, MATH, MATH_50, SCIENCE, STAR, WHITE } from '@kira/figures/palette'
import type { GradingDTO, InboxDTO, InboxRow } from '@/lib/dto'
import { ITEM_DRAW, ITEM_SPEAK, ITEM_WRITE, shell, wib } from './console-shared'

/** Gambar SVG sebagai data URL (warna dari palet figur). */
function svgUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** Foto tulisan tangan buatan di kertas bergaris. */
export const PHOTO_URL = svgUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 300"><rect width="640" height="300" fill="${DIVIDER}"/>` +
    `<g transform="rotate(-1.5 320 150)"><rect x="40" y="40" width="560" height="220" fill="${WHITE}"/>` +
    [80, 120, 160, 200, 240].map((y) => `<line x1="40" x2="600" y1="${y}" y2="${y}" stroke="${MATH_50}" stroke-width="2"/>`).join('') +
    `<text x="60" y="110" font-family="Comic Sans MS, Andika, cursive" font-size="24" fill="${INK}">On Saturday I visited my grandma.</text>` +
    `<text x="60" y="150" font-family="Comic Sans MS, Andika, cursive" font-size="24" fill="${INK}">We eated noodles. Then I played</text>` +
    `<text x="60" y="190" font-family="Comic Sans MS, Andika, cursive" font-size="24" fill="${INK}">with my cousin.</text></g></svg>`,
)

/** Gambar kolam dari widget menggambar. */
export const DRAWING_URL = svgUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 512"><rect width="700" height="512" fill="${WHITE}"/>` +
    `<g fill="none" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="M120 300 C 118 232 270 206 380 214 C 506 222 548 270 530 322 C 512 380 372 404 250 392 C 160 384 122 352 120 300 Z" stroke="${MATH}" stroke-width="6"/>` +
    `<path d="M190 330 Q 210 318 230 330 T 270 330" stroke="${MATH}" stroke-width="5"/>` +
    `<path d="M390 350 Q 410 338 430 350 T 470 350" stroke="${MATH}" stroke-width="5"/>` +
    `<path d="M290 282 C 312 256 364 256 386 282 C 364 308 312 308 290 282 Z" stroke="${ENGLISH}" stroke-width="6"/>` +
    `<path d="M290 282 L 262 262 L 262 302 Z" stroke="${ENGLISH}" stroke-width="6"/>` +
    `<path d="M366 276 L 367 277" stroke="${INK}" stroke-width="7"/>` +
    `<path d="M556 330 C 550 280 554 230 566 186" stroke="${SCIENCE}" stroke-width="6"/>` +
    `<path d="M584 336 C 584 292 590 250 604 214" stroke="${SCIENCE}" stroke-width="6"/>` +
    `<path d="M534 334 C 526 304 524 276 530 246" stroke="${SCIENCE}" stroke-width="6"/>` +
    `<path d="M600 64 A 28 28 0 1 0 600.1 64" stroke="${STAR}" stroke-width="6"/>` +
    `<path d="M600 52 L 600 38 M 600 132 L 600 146 M 560 92 L 546 92 M 640 92 L 654 92" stroke="${STAR}" stroke-width="5"/>` +
    `</g><rect x="1" y="1" width="698" height="510" fill="none" stroke="${BORDER}" stroke-width="2"/></svg>`,
)

/** Rekaman pendek buatan (nada 3 detik, WAV 8 kHz) supaya pemutar bisa dicoba. */
export function toneWavUrl(seconds = 3): string {
  const rate = 8000
  const n = rate * seconds
  const bytes = new Uint8Array(44 + n)
  const dv = new DataView(bytes.buffer)
  const w = (o: number, s: string) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)))
  w(0, 'RIFF')
  dv.setUint32(4, 36 + n, true)
  w(8, 'WAVE')
  w(12, 'fmt ')
  dv.setUint32(16, 16, true)
  dv.setUint16(20, 1, true)
  dv.setUint16(22, 1, true)
  dv.setUint32(24, rate, true)
  dv.setUint32(28, rate, true)
  dv.setUint16(32, 1, true)
  dv.setUint16(34, 8, true)
  w(36, 'data')
  dv.setUint32(40, n, true)
  for (let i = 0; i < n; i++) {
    const env = Math.min(1, i / 800, (n - i) / 800)
    bytes[44 + i] = 128 + Math.round(20 * env * Math.sin((2 * Math.PI * 330 * i) / rate))
  }
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
  return `data:audio/wav;base64,${btoa(bin)}`
}

export const INBOX_ROWS: InboxRow[] = [
  { responseId: 'r-q9', learnerName: 'Alya', subject: 'english', itemTitle: 'Quest English, soal 9', type: 'write', submittedAt: wib('2026-10-15', '16:21'), status: 'waiting', score: null, max: 3 },
  { responseId: 'r-q10', learnerName: 'Alya', subject: 'english', itemTitle: 'Quest English, soal 10', type: 'write', submittedAt: wib('2026-10-15', '16:24'), status: 'waiting', score: null, max: 3 },
  { responseId: 'r-w1', learnerName: 'Alya', subject: 'english', itemTitle: 'Tulisan: My weekend', type: 'photo', submittedAt: wib('2026-10-16', '14:05'), status: 'waiting', score: null, max: 5 },
  { responseId: 'r-s1', learnerName: 'Alya', subject: 'english', itemTitle: 'Quest English, soal 4: bicara', type: 'speak', submittedAt: wib('2026-10-16', '15:52'), status: 'waiting', score: null, max: 4 },
  { responseId: 'r-d1', learnerName: 'Bima', subject: 'science', itemTitle: 'Quest Science, soal 6: gambar', type: 'draw', submittedAt: wib('2026-10-16', '15:31'), status: 'waiting', score: null, max: 3 },
  { responseId: 'r-g1', learnerName: 'Alya', subject: 'english', itemTitle: 'Quest English, soal 8', type: 'write', submittedAt: wib('2026-10-14', '16:10'), status: 'graded', score: 3, max: 3 },
  { responseId: 'r-g2', learnerName: 'Bima', subject: 'english', itemTitle: 'Tulisan: My pet', type: 'photo', submittedAt: wib('2026-10-13', '15:02'), status: 'graded', score: 4, max: 5 },
]

const RUBRIC_SHORT = [
  { label: 'Kata kerja lampau', points: 2 },
  { label: 'Kalimat lengkap', points: 1 },
]

export const GRADINGS: Record<string, GradingDTO> = {
  'r-q9': {
    responseId: 'r-q9',
    learnerName: 'Alya',
    prompt: 'Write a sentence about yesterday. Use a verb with -ed.',
    item: { ...ITEM_WRITE, ref: 'KRA-E-0305', prompt: 'Write a sentence about yesterday. Use a verb with -ed.', rubric: RUBRIC_SHORT },
    answerText: 'Yesterday I play with my cat.',
    mediaUrl: null,
    mediaKind: null,
    rubric: RUBRIC_SHORT,
    scores: null,
    feedback: null,
    aiSuggestion: null,
  },
  'r-q10': {
    responseId: 'r-q10',
    learnerName: 'Alya',
    prompt: 'What did you do after school? Write one sentence.',
    item: { ...ITEM_WRITE, ref: 'KRA-E-0306', prompt: 'What did you do after school? Write one sentence.', rubric: RUBRIC_SHORT },
    answerText: 'I watched TV and I eated noodles.',
    mediaUrl: null,
    mediaKind: null,
    rubric: RUBRIC_SHORT,
    scores: null,
    feedback: null,
    aiSuggestion: null,
  },
  'r-w1': {
    responseId: 'r-w1',
    learnerName: 'Alya',
    prompt: ITEM_WRITE.prompt,
    item: ITEM_WRITE,
    answerText: 'On Saturday I visited my grandma. We eated noodles. Then I played with my cousin.',
    mediaUrl: PHOTO_URL,
    mediaKind: 'image',
    rubric: ITEM_WRITE.rubric ?? [],
    scores: null,
    feedback: null,
    aiSuggestion: {
      scores: [1, 2, 1],
      feedback: 'Lovely recount! Visited and played are correct. The past of eat is ate.',
      confidence: 'sedang',
      createdAt: wib('2026-10-16', '14:07'),
    },
  },
  'r-s1': {
    responseId: 'r-s1',
    learnerName: 'Alya',
    prompt: ITEM_SPEAK.prompt,
    item: ITEM_SPEAK,
    answerText: null,
    mediaUrl: null,
    mediaKind: 'audio',
    rubric: ITEM_SPEAK.rubric ?? [],
    scores: null,
    feedback: null,
    aiSuggestion: null,
  },
  'r-d1': {
    responseId: 'r-d1',
    learnerName: 'Bima',
    prompt: ITEM_DRAW.prompt,
    item: ITEM_DRAW,
    answerText: 'Kolam biru berisi ikan merah, tiga batang rumput hijau di tepi kolam, dan matahari kuning',
    mediaUrl: DRAWING_URL,
    mediaKind: 'image',
    rubric: ITEM_DRAW.rubric ?? [],
    scores: null,
    feedback: null,
    aiSuggestion: null,
  },
  'r-g1': {
    responseId: 'r-g1',
    learnerName: 'Alya',
    prompt: 'Write a sentence about last weekend. Use a verb with -ed.',
    item: { ...ITEM_WRITE, ref: 'KRA-E-0304', prompt: 'Write a sentence about last weekend. Use a verb with -ed.', rubric: RUBRIC_SHORT },
    answerText: 'Last weekend I visited the zoo.',
    mediaUrl: null,
    mediaKind: null,
    rubric: RUBRIC_SHORT,
    scores: [2, 1],
    feedback: 'Great sentence! Visited is a perfect -ed verb.',
    aiSuggestion: null,
  },
  'r-g2': {
    responseId: 'r-g2',
    learnerName: 'Bima',
    prompt: 'Write three sentences about your pet.',
    item: { ...ITEM_WRITE, ref: 'KRA-E-0410', prompt: 'Write three sentences about your pet.' },
    answerText: 'My cat is called Milo. He likes fish. He sleeps on my bed.',
    mediaUrl: PHOTO_URL,
    mediaKind: 'image',
    rubric: ITEM_WRITE.rubric ?? [],
    scores: [2, 1, 1],
    feedback: 'Three clear sentences. Try one sentence about what Milo did yesterday.',
    aiSuggestion: null,
  },
}

export function inboxFor(filter: InboxDTO['filter'], respon: string | undefined, opts: { audioUrl?: string } = {}): InboxDTO {
  const rows = INBOX_ROWS
  const pool = rows.filter((r) => (filter === 'waiting' ? r.status === 'waiting' : r.status === 'graded'))
  const id = respon && pool.some((r) => r.responseId === respon) ? respon : pool[0]?.responseId
  let selected = id ? GRADINGS[id] ?? null : null
  if (selected && selected.mediaKind === 'audio') selected = { ...selected, mediaUrl: opts.audioUrl ?? null }
  return { shell, filter, rows, selected }
}

export function inboxEmpty(): InboxDTO {
  return { shell, filter: 'waiting', rows: INBOX_ROWS.filter((r) => r.status === 'graded'), selected: null }
}
