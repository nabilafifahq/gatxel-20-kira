import type { FigureSpecInput, IconName } from '@kira/figures/spec'

/**
 * Gambar berderet dari ikon, tanpa teks, untuk soal ketuk di gambar dan beri label yang dibuat otomatis
 * (draf AI dan skrip konten). Mengembalikan figur scene beserta pusat tiap gambar dalam persen, supaya
 * area ketuk dan titik label jatuh tepat di gambar.
 */

export type IconPicture = { icon: IconName; label: string }

const CELL = 100
const ICON = 72

export function iconRowScene(pictures: readonly IconPicture[]): { figure: FigureSpecInput; centres: { x: number; y: number }[]; cell: { w: number; h: number } } {
  const n = pictures.length
  const cols = n <= 3 ? n : Math.ceil(n / 2)
  const rows = Math.ceil(n / cols)
  const width = Math.max(120, cols * CELL)
  const height = rows * CELL
  const offsetX = (width - cols * CELL) / 2
  const shapes = pictures.map((p, i) => ({
    t: 'icon' as const,
    icon: p.icon,
    x: offsetX + (i % cols) * CELL + (CELL - ICON) / 2,
    y: Math.floor(i / cols) * CELL + (CELL - ICON) / 2,
    size: ICON,
  }))
  const round1 = (v: number) => Math.round(v * 10) / 10
  const centres = pictures.map((_, i) => ({
    x: round1(((offsetX + (i % cols) * CELL + CELL / 2) / width) * 100),
    y: round1(((Math.floor(i / cols) * CELL + CELL / 2) / height) * 100),
  }))
  const list = pictures.map((p) => p.label)
  const alt = `${list.length} pictures: ${list.slice(0, -1).join(', ')}${list.length > 1 ? ' and ' : ''}${list[list.length - 1] ?? ''}.`
  return {
    figure: { kind: 'scene', width, height, shapes, alt },
    centres,
    cell: { w: round1(((CELL - 6) / width) * 100), h: round1(((CELL - 6) / height) * 100) },
  }
}
