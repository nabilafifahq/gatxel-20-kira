import type { Item } from '@kira/content'

/** Kriteria rubrik sebuah soal tulis, bicara, gambar, atau foto. */
export function rubricCriteriaOf(item: Item | undefined): { label: string; points: number }[] {
  if (!item || !('rubric' in item) || !item.rubric) return []
  return item.rubric.criteria.map((c) => ({ label: c.label, points: c.points }))
}
