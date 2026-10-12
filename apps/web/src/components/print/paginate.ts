import type { ClientItem } from '@kira/content/present'

/**
 * Perkiraan tinggi blok (px pada 96 dpi) untuk membagi soal ke halaman A4.
 * Sengaja sedikit berlebih supaya soal tidak terpotong; satu soal tidak pernah
 * dibagi dua halaman.
 */

const CHARS_PER_LINE = 56
const PROMPT_LINE = 30
const OPTION_LINE = 30

function lines(text: string, perLine = CHARS_PER_LINE): number {
  return Math.max(1, Math.ceil(text.length / perLine))
}

export function estimateItemHeight(item: ClientItem, workBox: boolean): number {
  let h = lines(item.prompt) * PROMPT_LINE
  const gap = 12
  const hasFigure = Boolean(item.figure) || item.type === 'numberline' || item.type === 'fraction' || item.type === 'clock'
  const numericLike = item.type === 'numeric' || item.type === 'clock' || item.type === 'numberline' || item.type === 'fraction'
  if (item.passage) h += gap + 50 + lines(item.passage.text, 60) * 29
  if (item.readText) h += gap + 26 + lines(item.readText, 55) * 29
  if (hasFigure || (workBox && numericLike)) h += gap + (hasFigure ? 172 : 140)
  switch (item.type) {
    case 'mcq':
    case 'multi': {
      const n = item.options?.length ?? 4
      const fig = item.options?.some((o) => o.figure)
      const longest = Math.max(1, ...(item.options ?? []).map((o) => (o.text ? lines(o.text, 26) : 1)))
      h += gap + (fig ? Math.ceil(n / 3) * 130 : Math.ceil(n / 2) * (longest * OPTION_LINE + 10))
      if (item.type === 'multi') h += 26
      break
    }
    case 'numeric':
    case 'clock':
      h += gap + 44
      break
    case 'text':
      h += gap + Math.ceil(Math.max(1, item.blanks ?? 1) / 3) * 52
      break
    case 'numberline':
    case 'fraction':
      h += gap + 26
      break
    case 'order':
      h += gap + 26 + (item.orderItems?.length ?? 4) * 48
      break
    case 'match':
      h += gap + 26 + Math.max(item.matchLeft?.length ?? 3, item.matchRight?.length ?? 3) * 48
      break
    case 'sort':
      h += gap + 52 + Math.ceil((item.sortItems?.length ?? 4) / 2) * 48
      break
    case 'write': {
      const words = item.maxWords ?? item.minWords ?? 30
      const ruled = Math.min(12, Math.max(4, Math.ceil(words / 7)))
      h += gap + (item.planning?.length ?? 0) * 26 + ruled * 32 + 26
      break
    }
    case 'draw':
      h += gap + 200
      break
    case 'speak':
      h += gap + 26
      break
  }
  return Math.round(h * 1.02) + 6
}

export type Block<T> = { kind: 'section'; title: string; height: number } | { kind: 'item'; data: T; height: number }

/**
 * Bagi blok ke halaman secara berurutan. Judul bagian tidak boleh menjadi blok
 * terakhir di halaman (ikut pindah bersama soal pertamanya).
 */
export function paginate<T>(blocks: Block<T>[], firstCapacity: number, capacity: number, gap: number): Block<T>[][] {
  const pages: Block<T>[][] = [[]]
  let used = 0
  let cap = firstCapacity
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!
    const next = blocks[i + 1]
    const need = b.height + (pages[pages.length - 1]!.length ? gap : 0)
    const keepWith = b.kind === 'section' && next ? next.height + gap : 0
    if (pages[pages.length - 1]!.length > 0 && used + need + keepWith > cap) {
      pages.push([])
      used = 0
      cap = capacity
    }
    const cur = pages[pages.length - 1]!
    used += b.height + (cur.length ? gap : 0)
    cur.push(b)
  }
  return pages
}
