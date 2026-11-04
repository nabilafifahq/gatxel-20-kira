import { z } from 'zod'

/**
 * Langkah pembahasan bergerak. Satu langkah boleh membawa `anim` (gambar yang bergerak) dan `mark`
 * (bagian soal yang disorot). Himpunan jenisnya sengaja kecil dan dipakai ulang oleh semua soal:
 *  - combine: dua bilangan bergerak ke tengah dan menjadi hasil (a op b = r)
 *  - column: hitung bersusun, angka muncul dari satuan ke kiri
 *  - bar: model batang yang digambar bagian demi bagian
 *  - line: garis bilangan dengan lompatan
 *  - seq: bilangan yang muncul satu per satu (menghitung, pola)
 *  - lines: baris pengerjaan yang dicentang satu per satu
 * Setiap jenis bisa diperiksa secara aritmetika (`animProblem`), jadi pembahasan yang salah tidak lolos content:check.
 */

const num = z.number().finite()
const short = (max: number) => z.string().trim().min(1).max(max)

export const animSchema = z.discriminatedUnion('k', [
  z.object({ k: z.literal('combine'), a: num, op: z.enum(['+', '-', '×', '÷']), b: num, r: num, cur: z.literal('Rp').optional() }).strict(),
  z.object({ k: z.literal('column'), op: z.enum(['+', '-', '×']), a: z.number().int().min(0).max(999999), b: z.number().int().min(0).max(999999), r: z.number().int().min(0).max(99999999), upTo: z.number().int().min(0).max(9).optional() }).strict(),
  z
    .object({
      k: z.literal('bar'),
      parts: z.array(z.object({ v: num, q: z.boolean().optional(), label: short(24).optional() }).strict()).min(2).max(10),
      total: num,
      unit: short(20).optional(),
      cur: z.literal('Rp').optional(),
    })
    .strict(),
  z.object({ k: z.literal('line'), min: num, max: num, start: num, jumps: z.array(num).min(1).max(8) }).strict(),
  z.object({ k: z.literal('seq'), items: z.array(short(16)).min(2).max(14) }).strict(),
  z.object({ k: z.literal('lines'), lines: z.array(short(70)).min(2).max(6) }).strict(),
])
export type Anim = z.infer<typeof animSchema>

const EPS = 1e-9
const close = (a: number, b: number) => Math.abs(a - b) <= EPS * Math.max(1, Math.abs(a), Math.abs(b))

export function applyOp(a: number, op: '+' | '-' | '×' | '÷', b: number): number {
  switch (op) {
    case '+':
      return a + b
    case '-':
      return a - b
    case '×':
      return a * b
    case '÷':
      return b === 0 ? Number.NaN : a / b
  }
}

/** Pesan masalah bila gerakan tidak benar secara hitungan, null bila benar. */
export function animProblem(a: Anim): string | null {
  switch (a.k) {
    case 'combine':
      return close(applyOp(a.a, a.op, a.b), a.r) ? null : `${a.a} ${a.op} ${a.b} bukan ${a.r}`
    case 'column':
      return close(applyOp(a.a, a.op, a.b), a.r) ? null : `Hitung bersusun ${a.a} ${a.op} ${a.b} bukan ${a.r}`
    case 'bar': {
      const sum = a.parts.reduce((n, p) => n + p.v, 0)
      if (!close(sum, a.total)) return `Bagian batang berjumlah ${sum}, bukan ${a.total}`
      if (a.parts.filter((p) => p.q).length > 1) return 'Batang punya lebih dari satu bagian yang ditanyakan'
      return a.parts.some((p) => p.v < 0) ? 'Bagian batang negatif' : null
    }
    case 'line': {
      if (!(a.max > a.min)) return 'Garis bilangan: max harus lebih besar dari min'
      let at = a.start
      if (at < a.min || at > a.max) return 'Garis bilangan: awal di luar garis'
      for (const j of a.jumps) {
        at += j
        if (at < a.min - EPS || at > a.max + EPS) return 'Garis bilangan: lompatan keluar garis'
      }
      return null
    }
    case 'seq':
      return null
    case 'lines': {
      for (const l of a.lines) {
        const p = parseEquation(l)
        if (p && !close(applyOp(p.a, p.op, p.b), p.r)) return `Baris pengerjaan salah: ${l}`
      }
      return null
    }
  }
}

const EQ = /^(-?\d[\d,]*(?:\.\d+)?)\s*([+\-−×÷x*/])\s*(-?\d[\d,]*(?:\.\d+)?)\s*=\s*(-?\d[\d,]*(?:\.\d+)?)$/

export function toNumber(s: string): number {
  return Number(s.replace(/,/g, ''))
}

/** Persamaan sederhana "a op b = r". Null bila bentuknya lain. */
export function parseEquation(text: string): { a: number; op: '+' | '-' | '×' | '÷'; b: number; r: number; cur?: 'Rp' } | null {
  let src = text.trim()
  const cur = /\bRp\s?\d/.test(src)
  // Rupiah memakai titik ribuan gaya Indonesia: Rp5.000 - Rp3.500 = Rp1.500.
  if (cur) src = src.replace(/Rp\s?/g, '').replace(/(\d)\.(?=\d{3}(?!\d))/g, '$1')
  const m = EQ.exec(src)
  if (!m) return null
  const raw = m[2]!
  const op = raw === '+' ? '+' : raw === '-' || raw === '−' ? '-' : raw === '×' || raw === 'x' || raw === '*' ? '×' : '÷'
  const a = toNumber(m[1]!)
  const b = toNumber(m[3]!)
  const r = toNumber(m[4]!)
  if (![a, b, r].every(Number.isFinite)) return null
  return { a, op, b, r, ...(cur ? { cur: 'Rp' as const } : {}) }
}

const EQ_FIND = /((?:Rp\s?)?-?\d[\d.,]*)\s*([+\-−×÷x*/])\s*((?:Rp\s?)?-?\d[\d.,]*)\s*=\s*((?:Rp\s?)?-?\d[\d.,]*)/

/** Persamaan "a op b = r" yang tertanam di kalimat, mis. "Her change is 5.000 - 3.500 = Rp1.500.". */
export function findEquation(text: string): ReturnType<typeof parseEquation> {
  const m = EQ_FIND.exec(text)
  if (!m) return null
  const clean = m[0].replace(/[.,]+$/, '')
  // Titik ribuan hanya dibaca bila ada Rp; angka biasa tetap desimal.
  return parseEquation(clean)
}

/** Hasil akhir yang ditunjukkan gerakan, bila ada. */
export function animResult(a: Anim): number | null {
  switch (a.k) {
    case 'combine':
    case 'column':
      return a.r
    case 'bar': {
      const q = a.parts.find((p) => p.q)
      return q ? q.v : a.total
    }
    case 'line':
      return a.jumps.reduce((n, j) => n + j, a.start)
    case 'seq': {
      const last = Number(a.items[a.items.length - 1]!.replace(/,/g, ''))
      return Number.isFinite(last) ? last : null
    }
    case 'lines': {
      const p = parseEquation(a.lines[a.lines.length - 1]!)
      return p ? p.r : null
    }
  }
}

/** Bilangan dalam teks. Titik ribuan gaya Indonesia (5.000) dibaca dua cara: 5 dan 5000. */
export function numbersIn(text: string): number[] {
  const out: number[] = []
  for (const m of text.match(/-?\d[\d,.]*\d|-?\d/g) ?? []) {
    const plain = toNumber(m)
    if (Number.isFinite(plain)) out.push(plain)
    if (/^-?\d{1,3}(?:\.\d{3})+$/.test(m)) out.push(Number(m.replace(/\./g, '')))
  }
  return out
}
