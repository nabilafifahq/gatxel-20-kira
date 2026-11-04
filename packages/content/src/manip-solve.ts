import { checkAnswer, keyOf } from './check'
import { fittingOrientations, type Pt } from './manip'
import type { Item } from './schema'

/**
 * Satu jawaban benar untuk soal alat peraga, dihitung dari data soal. Dipakai tes (DB, e2e, widget)
 * untuk menjawab soal baru tanpa menulis penyelesai di tiap tes. Mengembalikan null untuk jenis soal lain.
 */
export function manipulativeAnswer(item: Item): unknown | null {
  switch (item.type) {
    case 'blocks':
      return { blocks: item.target }
    case 'barmodel':
      return { model: { bars: item.bars.map((b) => ({ label: b.label, units: b.units })), ...(item.unitValue !== undefined ? { unit: item.unitValue } : {}) } }
    case 'geoboard':
      return { pegs: item.example, closed: true }
    case 'tangram': {
      const used = new Set<number>()
      const placed = item.slots.map((slot) => {
        for (let p = 0; p < item.pieces.length; p++) {
          if (used.has(p)) continue
          const o = fittingOrientations(item.pieces[p]!, slot as unknown as Pt[])[0]
          if (o) {
            used.add(p)
            return [p, o.rot, o.flip ? 1 : 0]
          }
        }
        return null
      })
      return { placed }
    }
    case 'fractionbar': {
      const key = keyOf(item)
      const choices = item.rows.map((r) => {
        const dens = r.den !== undefined ? [r.den] : item.splits
        return dens.flatMap((den) => (r.locked !== undefined ? [{ den, shaded: r.locked }] : Array.from({ length: den + 1 }, (_, shaded) => ({ den, shaded }))))
      })
      let found: { den: number; shaded: number }[] | null = null
      const walk = (i: number, acc: { den: number; shaded: number }[]) => {
        if (found) return
        if (i === choices.length) {
          if (checkAnswer(key, { bars: acc }).status === 'correct') found = acc
          return
        }
        for (const c of choices[i]!) walk(i + 1, [...acc, c])
      }
      walk(0, [])
      return found ? { bars: found } : null
    }
    default:
      return null
  }
}
