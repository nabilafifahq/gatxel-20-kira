import type { BankItemRow } from '@/lib/dto'

/** Nama tipe soal untuk konsol (id). */
export const TYPE_LABEL: Record<string, string> = {
  mcq: 'Pilihan ganda',
  multi: 'Pilihan ganda banyak',
  numeric: 'Isian angka',
  text: 'Isian kata',
  order: 'Urutkan',
  match: 'Jodohkan',
  sort: 'Kelompokkan',
  numberline: 'Garis bilangan',
  clock: 'Jam',
  fraction: 'Pecahan',
  write: 'Menulis',
  speak: 'Berbicara',
  draw: 'Menggambar',
}

export const SOURCE_LABEL: Record<BankItemRow['source'], string> = {
  'kira-original': 'Kira',
  imported: 'Impor resmi',
  'ai-draft': 'Draf AI',
  tutor: 'Tutor',
  generator: 'Generator',
}

export function typeLabel(t: string): string {
  return TYPE_LABEL[t] ?? t
}
