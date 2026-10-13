import type { XpTrack } from '@kira/core'

/**
 * Kelas Tailwind per jalur XP. Ditulis utuh supaya Tailwind menemukannya.
 * belajar memakai --star (hanya isi bar, bukan teks), hitung --mental, pengetahuan --knowledge.
 */
export const TRACK_TONE: Record<XpTrack, { bar: string; text: string; border: string; tint: string; solid: string }> = {
  belajar: { bar: 'bg-star', text: 'text-fg', border: 'border-star', tint: 'bg-bg', solid: 'bg-fg' },
  hitung: { bar: 'bg-mental', text: 'text-mental', border: 'border-mental', tint: 'bg-mental-50', solid: 'bg-mental' },
  pengetahuan: { bar: 'bg-knowledge', text: 'text-knowledge', border: 'border-knowledge', tint: 'bg-knowledge-50', solid: 'bg-knowledge' },
}

export type ArenaTone = 'hitung' | 'pengetahuan'
