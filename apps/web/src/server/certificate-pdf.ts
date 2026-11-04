import 'server-only'
import { dictFor, type Dict } from '@/lib/i18n'

/**
 * Sertifikat milestone sebagai PDF A4 lanskap, ditulis langsung (tanpa pustaka): huruf Helvetica bawaan PDF,
 * bingkai dan bintang digambar dengan jalur vektor. Nama dibersihkan ke Latin-1 supaya selalu terbaca.
 */

const W = 842
const H = 595

function latin1(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7e]/g, '')
    .replace(/[\\()]/g, '')
    .trim()
}

/** Lebar huruf Helvetica dan Helvetica-Bold per 1000 em (AFM), untuk ASCII 32 sampai 126. */
const WIDTHS = {
  F1: [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584],
  F2: [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584],
} as const

function widthOf(font: 'F1' | 'F2', size: number, text: string): number {
  let units = 0
  for (const ch of text) units += WIDTHS[font][ch.charCodeAt(0) - 32] ?? 556
  return (units * size) / 1000
}

/** Teks di tengah halaman. Yang terlalu lebar (nama panjang) mengecil supaya tetap di dalam bingkai. */
function textAt(font: 'F1' | 'F2', size: number, y: number, text: string, rgb: string): string {
  const max = W - 120
  const full = widthOf(font, size, text)
  const fitted = full > max ? (size * max) / full : size
  const x = (W - widthOf(font, fitted, text)) / 2
  return `BT /${font} ${fitted.toFixed(1)} Tf ${rgb} rg ${x.toFixed(1)} ${y} Td (${text}) Tj ET\n`
}

function star(cx: number, cy: number, r: number): string {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)} ${(cy - rad * Math.sin(a)).toFixed(1)}`)
  }
  return `${pts[0]} m ${pts.slice(1).join(' l ')} l h\n`
}

export function certificatePdf(input: { name: string; days: number; date: string }, t: Dict['world']['certificate'] = dictFor('en').world.certificate): Buffer {
  const name = latin1(input.name) || t.fallbackName
  const ink = '0.078 0.125 0.18'
  const gold = '0.949 0.694 0.055'
  const blue = '0.122 0.435 0.698'
  let c = ''
  c += `${gold} RG 6 w 28 28 ${W - 56} ${H - 56} re S\n`
  c += `${blue} RG 1.5 w 40 40 ${W - 80} ${H - 80} re S\n`
  c += `${gold} rg ${star(W / 2, 470, 38)} f\n`
  c += `${ink} RG 2 w ${star(W / 2, 470, 38)} S\n`
  c += textAt('F2', 40, 385, t.title, ink)
  c += textAt('F1', 18, 345, t.givenTo, ink)
  c += textAt('F2', 44, 285, name, blue)
  c += textAt('F1', 20, 235, t.reason(input.days), ink)
  c += textAt('F1', 16, 200, t.closing, ink)
  c += textAt('F1', 13, 90, t.awardedOn(input.date), ink)
  const objs: string[] = []
  objs.push('<< /Type /Catalog /Pages 2 0 R >>')
  objs.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`)
  objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
  objs.push(`<< /Length ${Buffer.byteLength(c, 'latin1')} >>\nstream\n${c}endstream`)
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out, 'latin1'))
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = Buffer.byteLength(out, 'latin1')
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
  for (const off of offsets) out += `${String(off).padStart(10, '0')} 00000 n \n`
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}
