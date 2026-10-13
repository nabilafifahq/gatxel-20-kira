import type { ClientItem } from '@kira/content/present'
import { letterAt } from './answers'

/**
 * Teks yang dibacakan tombol baca suara: teks soal lalu opsi jawaban.
 * Teks dengar (listenText, untuk soal dengar dan eja) tidak pernah ikut: itu jawabannya.
 */
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
  if (item.parts) {
    for (const p of item.parts) {
      parts.push(p.prompt.replace(/_{3,}/g, blank))
      if (p.options && p.options.length > 0) parts.push(p.options.map((o, idx) => `${letterAt(idx)}. ${o.text ?? o.figure?.alt ?? ''}`).join(' '))
    }
  }
  if (item.tiles) parts.push(item.tiles.join(', '))
  if (item.cloze) item.cloze.forEach((opts, g) => parts.push(`Gap ${g + 1}: ${opts.join(', ')}`))
  if (item.labelDiagram) parts.push(item.labelDiagram.labels.join(', '))
  if (item.table) {
    const t = item.table
    parts.push(t.head.join(', '))
    for (const row of t.rows) parts.push(row.map((cell) => (cell === '' ? blank : cell)).join(', '))
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
