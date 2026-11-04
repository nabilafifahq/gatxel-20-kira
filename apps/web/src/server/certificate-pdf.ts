import 'server-only'

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

function textAt(font: 'F1' | 'F2', size: number, y: number, text: string, rgb: string): string {
  const width = text.length * size * (font === 'F2' ? 0.56 : 0.5)
  const x = Math.max(30, (W - width) / 2)
  return `BT /${font} ${size} Tf ${rgb} rg ${x.toFixed(1)} ${y} Td (${text}) Tj ET\n`
}

function star(cx: number, cy: number, r: number): string {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)} ${(cy - rad * Math.sin(a) * -1).toFixed(1)}`)
  }
  return `${pts[0]} m ${pts.slice(1).join(' l ')} l h\n`
}

export function certificatePdf(input: { name: string; days: number; date: string }): Buffer {
  const name = latin1(input.name) || 'Kira learner'
  const ink = '0.078 0.125 0.18'
  const gold = '0.949 0.694 0.055'
  const blue = '0.122 0.435 0.698'
  let c = ''
  c += `${gold} RG 6 w 28 28 ${W - 56} ${H - 56} re S\n`
  c += `${blue} RG 1.5 w 40 40 ${W - 80} ${H - 80} re S\n`
  c += `${gold} rg ${star(W / 2, 470, 38)} f\n`
  c += `${ink} RG 2 w ${star(W / 2, 470, 38)} S\n`
  c += textAt('F2', 40, 385, 'Certificate of achievement', ink)
  c += textAt('F1', 18, 345, 'This certificate is proudly given to', ink)
  c += textAt('F2', 44, 285, name, blue)
  c += textAt('F1', 20, 235, `for studying on ${input.days} days in a row with Kira.`, ink)
  c += textAt('F1', 16, 200, 'One page at a time, one day at a time. Well done!', ink)
  c += textAt('F1', 13, 90, `Awarded on ${input.date}`, ink)
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
