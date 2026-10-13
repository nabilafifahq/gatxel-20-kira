import type { Item } from './schema'

/*
 * Label pilihan untuk mode Tes, Simulasi, dan Kertas.
 *
 * Perangkat learner mengenali opsi, kartu urut, kartu kanan, dan kartu kelompok lewat angka `i`. Tanpa label,
 * `i` adalah indeks asli di file soal, dan indeks asli adalah jawabannya (urutan benar 0, 1, 2; pasangan kiri k
 * dengan kanan k). Di mode tanpa umpan balik, server mengganti `i` dengan permutasi rahasia per attempt lalu
 * mengembalikannya ke indeks asli sebelum memeriksa dan menyimpan jawaban. Basis data selalu memakai indeks asli.
 */

/** perm[i] adalah label yang dilihat perangkat untuk indeks asli i. */
export type LabelPerm = readonly number[]

/** Banyaknya pilihan berlabel di soal ini. Nol berarti soal tidak memakai label. */
export function labelCount(item: Item): number {
  switch (item.type) {
    case 'mcq':
    case 'multi':
    case 'listen':
      return item.options.length
    case 'story':
      return item.parts.reduce((n, part) => n + (part.type === 'mcq' ? part.options.length : 0), 0)
    case 'order':
      return item.items.length
    case 'match':
      return item.pairs.length
    case 'sort':
      return item.items.length
    default:
      return 0
  }
}

function inverse(perm: LabelPerm): number[] {
  const inv = new Array<number>(perm.length)
  perm.forEach((label, i) => {
    inv[label] = i
  })
  return inv
}

const inRange = (v: unknown, n: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < n

/** Awal label pilihan tiap pertanyaan soal cerita: pertanyaan pilihan ganda diberi label berurutan. */
function storyOffsets(item: Extract<Item, { type: 'story' }>): number[] {
  const out: number[] = []
  let at = 0
  for (const part of item.parts) {
    out.push(at)
    if (part.type === 'mcq') at += part.options.length
  }
  return out
}

/** Ubah pilihan tiap pertanyaan cerita dengan fungsi `map(label atau indeks global, awal, jumlah opsi)`. */
function mapStory(item: Extract<Item, { type: 'story' }>, answer: Record<string, unknown>, map: (v: unknown, offset: number, count: number) => unknown): unknown {
  if (!Array.isArray(answer.parts)) return answer
  const offsets = storyOffsets(item)
  return {
    ...answer,
    parts: answer.parts.map((p, k) => {
      const part = item.parts[k]
      if (!part || part.type !== 'mcq' || p === null || typeof p !== 'object' || Array.isArray(p)) return p
      const r = p as Record<string, unknown>
      return { ...r, choice: map(r.choice, offsets[k]!, part.options.length) }
    }),
  }
}

/**
 * Jawaban dari perangkat (label) ke indeks asli. Nilai di luar rentang dibiarkan apa adanya supaya
 * pemeriksa bentuk jawaban menolaknya; -1 (belum diisi) tetap -1.
 */
export function answerFromLabels(item: Item, answer: unknown, perm: LabelPerm | null): unknown {
  if (!perm || answer === null || typeof answer !== 'object' || Array.isArray(answer)) return answer
  const inv = inverse(perm)
  const back = (v: unknown) => (inRange(v, inv.length) ? inv[v] : v)
  const a = answer as Record<string, unknown>
  switch (item.type) {
    case 'mcq':
    case 'listen':
      return { ...a, choice: back(a.choice) }
    case 'multi':
      return Array.isArray(a.choices) ? { ...a, choices: a.choices.map(back) } : answer
    case 'order':
      return Array.isArray(a.order) ? { ...a, order: a.order.map(back) } : answer
    case 'match':
      return Array.isArray(a.pairs) ? { ...a, pairs: a.pairs.map(back) } : answer
    case 'story':
      // Label global ke indeks asli dalam pertanyaannya; label milik pertanyaan lain menjadi -1 (salah).
      return mapStory(item, a, (v, offset, count) => {
        if (v === -1) return -1
        const orig = inRange(v, inv.length) ? inv[v] : v
        return typeof orig === 'number' && orig >= offset && orig < offset + count ? orig - offset : inRange(v, inv.length) ? -1 : v
      })
    case 'sort': {
      // groups diindeks dengan label kartu: kartu asli i ada di posisi perm[i].
      const groups = a.groups
      if (!Array.isArray(groups) || groups.length !== perm.length) return answer
      return { ...a, groups: perm.map((label) => groups[label]) }
    }
    default:
      return answer
  }
}

/** Jawaban tersimpan (indeks asli) ke label perangkat, untuk melanjutkan attempt yang sama. */
export function answerToLabels(item: Item, answer: unknown, perm: LabelPerm | null): unknown {
  if (!perm || answer === null || typeof answer !== 'object' || Array.isArray(answer)) return answer
  const fwd = (v: unknown) => (inRange(v, perm.length) ? perm[v] : v)
  const a = answer as Record<string, unknown>
  switch (item.type) {
    case 'mcq':
    case 'listen':
      return { ...a, choice: fwd(a.choice) }
    case 'multi':
      return Array.isArray(a.choices) ? { ...a, choices: a.choices.map(fwd) } : answer
    case 'order':
      return Array.isArray(a.order) ? { ...a, order: a.order.map(fwd) } : answer
    case 'match':
      return Array.isArray(a.pairs) ? { ...a, pairs: a.pairs.map(fwd) } : answer
    case 'story':
      return mapStory(item, a, (v, offset, count) => (inRange(v, count) ? fwd(offset + v) : v))
    case 'sort': {
      const groups = a.groups
      if (!Array.isArray(groups) || groups.length !== perm.length) return answer
      const out = new Array<unknown>(perm.length)
      perm.forEach((label, i) => {
        out[label] = groups[i]
      })
      return { ...a, groups: out }
    }
    default:
      return answer
  }
}
