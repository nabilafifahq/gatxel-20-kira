// __GTX_SEED__
/**
 * Paket impor contoh untuk pratinjau T12. Soal dan nama paket buatan sendiri
 * (bukan salinan paket lomba resmi). Halaman PDF digambar sebagai SVG data URL
 * dengan warna dari palet figur.
 */
import { BORDER, DIVIDER, INK, MUTED, WARN, WHITE } from '@kira/figures/palette'
import type { ImportDTO, ImportItemDTO } from '@/lib/dto'
import { shell, wib } from './console-shared'

const LETTER = ['A', 'B', 'C', 'D', 'E']

function svgUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function wrap(text: string, max: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    if ((line + ' ' + word).trim().length > max) {
      lines.push(line.trim())
      line = word
    } else line += ' ' + word
  }
  if (line.trim()) lines.push(line.trim())
  return lines
}

type Raw = {
  number: number
  page: number
  prompt: string
  options: string[]
  answer: number | null
  answerFromKey: number | null
  status: ImportItemDTO['status']
  figureNote?: string
  /** Pecahan ditulis bersusun di halaman PDF. */
  stacked?: boolean
  /** Teks sisa kunci yang ikut tercetak di halaman. */
  leftover?: string
  clock?: boolean
}

const RAW: Raw[] = [
  { number: 1, page: 1, prompt: 'Hari ini hari Senin. Hari apakah 10 hari lagi?', options: ['Rabu', 'Kamis', 'Jumat', 'Sabtu'], answer: 1, answerFromKey: 1, status: 'ok' },
  {
    number: 2,
    page: 1,
    prompt: 'Aku bilangan dua angka. Angka puluhanku 4. Jumlah kedua angkaku 9. Bilangan berapakah aku?',
    options: ['45', '54', '49', '94'],
    answer: 0,
    answerFromKey: 0,
    status: 'ok',
  },
  {
    number: 3,
    page: 1,
    prompt: 'Seekor katak melompat dari batu 1 ke batu 3, lalu ke batu 5 dan batu 7. Di batu nomor berapa katak mendarat pada lompatan berikutnya?',
    options: ['8', '10', '9', '11'],
    answer: 2,
    answerFromKey: 2,
    status: 'ok',
  },
  {
    number: 4,
    page: 2,
    prompt: 'Rani mulai membaca pukul 07.15. Ia membaca selama 30 menit. Pukul berapa Rani selesai membaca?',
    options: ['07.30', '08.15', '08.00', '07.45'],
    answer: 3,
    answerFromKey: 3,
    status: 'ok',
  },
  {
    number: 5,
    page: 2,
    prompt: 'Ibu memotong kue menjadi 4 bagian sama besar. Adik makan 1 bagian. Bagian kue yang dimakan adik adalah ...',
    options: ['1 4', '1 2', '3 4', '2 4'],
    answer: 0,
    answerFromKey: 0,
    status: 'broken-fraction',
    stacked: true,
  },
  { number: 6, page: 2, prompt: 'Ada 4 kotak pensil. Setiap kotak berisi 6 pensil. Berapa banyak pensil seluruhnya?', options: ['10', '20', '24', '28'], answer: 2, answerFromKey: 2, status: 'ok' },
  {
    number: 7,
    page: 3,
    prompt: 'Ibu membeli 15 kue. Adik makan 6 kue, lalu 4 kue diberikan kepada tetangga. Berapa kue yang tersisa?',
    options: ['5', '6', '9', '11'],
    answer: 0,
    answerFromKey: 0,
    status: 'ok',
  },
  {
    number: 8,
    page: 3,
    prompt: 'Perhatikan pola 3, 6, 9, 12, ... Bilangan ke-6 pada pola itu adalah ... #Kunci: B',
    options: ['15', '18', '21', '24'],
    answer: 1,
    answerFromKey: 1,
    status: 'leftover-key-text',
    leftover: '#Kunci: B',
  },
  {
    number: 9,
    page: 3,
    prompt: 'Jam menunjukkan pukul 3 tepat. Jarum panjang menunjuk ke angka ...',
    options: ['3', '6', '9', '12'],
    answer: null,
    answerFromKey: 4,
    status: 'key-mismatch',
    figureNote: 'Gambar jam analog di bawah teks soal tidak ikut terbaca. Soal tetap bisa dijawab tanpa gambar.',
    clock: true,
  },
  { number: 10, page: 4, prompt: 'Perhatikan pola bilangan 2, 5, 8, 11, ... Bilangan berikutnya adalah ...', options: ['12', '13', '14', '15'], answer: 2, answerFromKey: 2, status: 'ok' },
]

/** Halaman PDF buatan: teks soal, opsi, gambar jam, dan tabel kunci di halaman terakhir. */
function pageSvg(page: number, total: number): string {
  const W = 595
  const H = 842
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="Times New Roman, Times, serif">`,
    `<rect width="${W}" height="${H}" fill="${WHITE}"/>`,
    `<text x="48" y="60" font-size="15" font-weight="700" fill="${INK}">LATIHAN SOAL KE-5  MATH LEVEL 1</text>`,
    `<text x="${W - 48}" y="60" font-size="12" text-anchor="end" fill="${MUTED}">Halaman ${page}</text>`,
    `<line x1="48" x2="${W - 48}" y1="74" y2="74" stroke="${BORDER}" stroke-width="1"/>`,
  ]
  let y = 110
  for (const it of RAW.filter((r) => r.page === page)) {
    const promptText = it.leftover ? it.prompt.replace(it.leftover, '').trim() : it.prompt
    const lines = wrap(promptText, 70)
    parts.push(`<text x="48" y="${y}" font-size="14" font-weight="700" fill="${INK}">${it.number}.</text>`)
    lines.forEach((ln, i) => parts.push(`<text x="72" y="${y + i * 20}" font-size="14" fill="${INK}">${esc(ln)}</text>`))
    y += lines.length * 20
    if (it.leftover) {
      parts.push(`<text x="72" y="${y}" font-size="12" fill="${WARN}">${esc(it.leftover)}</text>`)
      y += 20
    }
    if (it.clock) {
      const cx = 120
      const cy = y + 46
      parts.push(`<circle cx="${cx}" cy="${cy}" r="40" fill="${WHITE}" stroke="${INK}" stroke-width="2"/>`)
      for (let h = 1; h <= 12; h++) {
        const a = (h / 12) * Math.PI * 2
        parts.push(`<text x="${(cx + Math.sin(a) * 30).toFixed(1)}" y="${(cy - Math.cos(a) * 30 + 4).toFixed(1)}" font-size="10" text-anchor="middle" fill="${INK}">${h}</text>`)
      }
      parts.push(`<line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - 26}" stroke="${INK}" stroke-width="2"/>`)
      parts.push(`<line x1="${cx}" y1="${cy}" x2="${cx + 18}" y2="${cy}" stroke="${INK}" stroke-width="3"/>`)
      y += 100
    }
    y += 8
    it.options.forEach((o, i) => {
      const x = 72 + i * 118
      parts.push(`<text x="${x}" y="${y}" font-size="14" fill="${INK}">${LETTER[i]}.</text>`)
      if (it.stacked) {
        const [n, d] = o.split(' ')
        parts.push(`<text x="${x + 26}" y="${y - 8}" font-size="13" text-anchor="middle" fill="${INK}">${n}</text>`)
        parts.push(`<line x1="${x + 19}" x2="${x + 33}" y1="${y - 4}" y2="${y - 4}" stroke="${INK}" stroke-width="1"/>`)
        parts.push(`<text x="${x + 26}" y="${y + 9}" font-size="13" text-anchor="middle" fill="${INK}">${d}</text>`)
      } else {
        parts.push(`<text x="${x + 20}" y="${y}" font-size="14" fill="${INK}">${esc(o)}</text>`)
      }
    })
    y += it.stacked ? 52 : 44
  }
  if (page === total) {
    y += 16
    parts.push(`<text x="48" y="${y}" font-size="14" font-weight="700" fill="${INK}">KUNCI JAWABAN</text>`)
    y += 14
    const keys = ['B', 'A', 'C', 'D', 'A', 'C', 'A', 'B', 'E', 'C']
    keys.forEach((k, i) => {
      const x = 48 + i * 48
      parts.push(`<rect x="${x}" y="${y}" width="48" height="24" fill="${WHITE}" stroke="${BORDER}"/>`)
      parts.push(`<rect x="${x}" y="${y + 24}" width="48" height="24" fill="${WHITE}" stroke="${BORDER}"/>`)
      parts.push(`<text x="${x + 24}" y="${y + 17}" font-size="12" text-anchor="middle" fill="${MUTED}">${i + 1}</text>`)
      parts.push(`<text x="${x + 24}" y="${y + 41}" font-size="13" font-weight="700" text-anchor="middle" fill="${INK}">${k}</text>`)
    })
  }
  parts.push(`<line x1="48" x2="${W - 48}" y1="${H - 48}" y2="${H - 48}" stroke="${DIVIDER}" stroke-width="1"/>`)
  parts.push(`<text x="${W / 2}" y="${H - 30}" font-size="11" text-anchor="middle" fill="${MUTED}">${page} / ${total}</text>`)
  parts.push('</svg>')
  return svgUrl(parts.join(''))
}

const COMPETITIONS: ImportDTO['competitions'] = [
  { id: 'esmo', name: 'ESMO' },
  { id: 'ikmc', name: 'IKMC' },
  { id: 'sasmo', name: 'SASMO' },
]

const PAGE_COUNT = 4
const PAGES = Array.from({ length: PAGE_COUNT }, (_, i) => pageSvg(i + 1, PAGE_COUNT))

const ITEMS: ImportItemDTO[] = RAW.map((r, i) => ({
  index: i,
  number: r.number,
  prompt: r.prompt,
  options: r.options,
  answer: r.answer,
  answerFromKey: r.answerFromKey,
  figureNote: r.figureNote ?? null,
  pageImage: PAGES[r.page - 1] ?? null,
  status: r.status,
  approved: false,
  keyCheck: r.answerFromKey === null ? null : i === 3 ? 'disagree' : 'agree',
  aiAnswer: r.answerFromKey,
  figure: null,
}))

const BATCHES: ImportDTO['batches'] = [
  { id: 'imp-0005', title: 'Latihan soal ke-5 Math Level 1.pdf', status: 'review', createdAt: wib('2026-10-12', '10:52'), itemCount: 10, approved: 0 },
  { id: 'imp-0006', title: 'Latihan soal ke-6 Math Level 1.pdf', status: 'parsing', createdAt: wib('2026-10-12', '11:04'), itemCount: 0, approved: 0 },
  { id: 'imp-0004', title: 'Latihan soal ke-4 Math Level 1.pdf', status: 'done', createdAt: wib('2026-10-05', '19:20'), itemCount: 12, approved: 12 },
  { id: 'imp-0003', title: 'Simulasi babak penyisihan 2025.pdf', status: 'failed', createdAt: wib('2026-09-28', '08:41'), itemCount: 0, approved: 0 },
]

export const importReview: ImportDTO = {
  shell,
  batches: BATCHES,
  selected: {
    id: 'imp-0005',
    title: 'Latihan soal ke-5 Math Level 1.pdf',
    subject: 'math',
    grade: 2,
    tags: ['ESMO', 'Level 1'],
    pages: PAGES,
    items: ITEMS,
    meta: { competition: 'esmo', year: 2026, section: 'A', originalMinutes: 40, source: 'unggahan tutor' },
  },
  competitions: COMPETITIONS,
}

export const importList: ImportDTO = { shell, batches: BATCHES, selected: null, competitions: COMPETITIONS }

export const importEmpty: ImportDTO = { shell, batches: [], selected: null, competitions: COMPETITIONS }
