import type { ClientItem } from '@kira/content/present'
import { letterAt } from './answers'

/** Teks yang dibacakan tombol baca suara: teks soal lalu opsi jawaban. */
export function speakableText(item: ClientItem): string {
  const blank = item.lang === 'id' ? 'titik-titik' : 'blank'
  const parts: string[] = [item.prompt.replace(/_{3,}/g, blank)]
  if (item.readText) parts.push(item.readText)
  if (item.options && item.options.length > 0) {
    parts.push(item.options.map((o, idx) => `${letterAt(idx)}. ${o.text ?? o.figure?.alt ?? ''}`).join(' '))
  }
  if (item.orderItems) parts.push(item.orderItems.map((o) => o.text).join(', '))
  if (item.matchLeft && item.matchRight) {
    parts.push(item.matchLeft.join(', '))
    parts.push(item.matchRight.map((r) => r.text).join(', '))
  }
  if (item.sortGroups && item.sortItems) {
    parts.push(item.sortGroups.join(', '))
    parts.push(item.sortItems.map((s) => s.text).join(', '))
  }
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (/[.!?]$/.test(p) ? p : `${p}.`))
    .join(' ')
}
