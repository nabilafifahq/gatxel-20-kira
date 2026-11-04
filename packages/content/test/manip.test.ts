import { describe, expect, it } from 'vitest'
import { checkAnswer, keyOf } from '../src/check'
import { findContentDir, loadContent } from '../src/load'
import {
  analysePegs,
  blocksValue,
  exchangeDown,
  exchangeUp,
  fittingOrientations,
  orient,
  overlapArea,
  PIECE_AREA,
  pieceTypeOf,
  polygonArea,
  tangramProblems,
  type Pt,
} from '../src/manip'
import { presentItem } from '../src/present'

const loaded = loadContent(findContentDir())
const TOOL_TYPES = ['blocks', 'fractionbar', 'barmodel', 'tangram', 'geoboard']
const tools = [...loaded.index.items.values()].filter((i) => TOOL_TYPES.includes(i.type))
const ofType = (t: string) => tools.filter((i) => i.type === t)

describe('place value blocks', () => {
  it('trades and breaks keep the value', () => {
    const b = { h: 1, t: 12, o: 14 }
    expect(blocksValue(exchangeUp(b, 'o'))).toBe(blocksValue(b))
    expect(blocksValue(exchangeUp(b, 't'))).toBe(blocksValue(b))
    expect(blocksValue(exchangeDown(b, 'h'))).toBe(blocksValue(b))
    expect(blocksValue(exchangeDown(b, 't'))).toBe(blocksValue(b))
    expect(exchangeUp({ h: 0, t: 0, o: 9 }, 'o')).toEqual({ h: 0, t: 0, o: 9 })
  })
})

describe('tangram geometry', () => {
  const PIECES = ['L', 'M', 'S', 'Q', 'P'] as const
  it('has seven pieces whose areas add to 16', () => {
    expect(2 * PIECE_AREA.L + PIECE_AREA.M + 2 * PIECE_AREA.S + PIECE_AREA.Q + PIECE_AREA.P).toBe(16)
    for (const t of PIECES) expect(polygonArea(orient(t, 0, false))).toBe(PIECE_AREA[t])
  })
  it('rotation keeps area and the piece fits its own outline', () => {
    for (const t of PIECES) {
      for (let r = 0; r < 4; r++) for (const f of [false, true]) expect(polygonArea(orient(t, r, f))).toBe(PIECE_AREA[t])
      expect(fittingOrientations(t, orient(t, 1, true)).length).toBeGreaterThan(0)
      expect(pieceTypeOf(orient(t, 2, false))).toBe(t)
    }
  })
  it('the parallelogram needs a flip to face the other way', () => {
    expect(fittingOrientations('P', orient('P', 0, false)).some((o) => o.flip)).toBe(false)
    expect(fittingOrientations('P', orient('P', 0, true)).every((o) => o.flip)).toBe(true)
  })
  it('detects overlap', () => {
    const a = orient('L', 0, false)
    expect(overlapArea(a, a)).toBeGreaterThan(3.5)
    const b = orient('L', 2, false).map((p): Pt => [p[0], p[1] + 2])
    expect(tangramProblems({ pieces: ['L', 'L'], slots: [a, b] }).filter((m) => m.includes('bertumpuk'))).toEqual([])
  })
})

describe('geoboard geometry', () => {
  const info = (pegs: [number, number][]) => analysePegs(pegs)
  it('measures rectangles, triangles and L-shapes', () => {
    expect(info([[0, 0], [3, 0], [3, 2], [0, 2]])).toMatchObject({ ok: true, sides: 4, area: 6, perimeter: 10, shape: 'rectangle', rectilinear: true })
    expect(info([[0, 0], [3, 0], [3, 3], [0, 3]]).shape).toBe('square')
    expect(info([[0, 0], [4, 0], [0, 3]])).toMatchObject({ area: 6, shape: 'right-triangle' })
    expect(info([[0, 0], [4, 0], [2, 3]]).shape).toBe('isosceles-triangle')
    expect(info([[0, 0], [4, 0], [4, 1], [1, 1], [1, 4], [0, 4]])).toMatchObject({ sides: 6, area: 7, rectilinear: true, perimeter: 16 })
  })
  it('ignores pegs in the middle of a straight side', () => {
    expect(info([[0, 0], [1, 0], [2, 0], [2, 2], [0, 2]]).sides).toBe(4)
  })
  it('rejects crossing, flat, and repeated pegs', () => {
    expect(info([[0, 0], [2, 2], [2, 0], [0, 2]]).reason).toBe('cross')
    expect(info([[0, 0], [1, 0], [2, 0]]).reason).toBe('flat')
    expect(info([[0, 0], [2, 0], [2, 2], [0, 0]]).reason).toBe('repeat')
  })
  it('classifies parallelograms and trapeziums', () => {
    expect(info([[0, 0], [3, 0], [4, 2], [1, 2]]).shape).toBe('slanted-parallelogram')
    expect(info([[0, 0], [4, 0], [3, 3], [1, 3]]).shape).toBe('trapezium')
  })
})

describe('the new items', () => {
  it('has at least 25 verified items per tool and every file loads clean', () => {
    for (const t of TOOL_TYPES) expect(ofType(t).length).toBeGreaterThanOrEqual(25)
    expect(loaded.errors.filter((e) => e.file.includes('.tools.json'))).toEqual([])
  })

  it('spreads items across grades', () => {
    for (const t of TOOL_TYPES) expect(new Set(ofType(t).map((i) => i.skill[1])).size).toBeGreaterThanOrEqual(3)
  })

  it('blocks: the target is right, the start is not', () => {
    for (const it of ofType('blocks')) {
      if (it.type !== 'blocks') continue
      const key = keyOf(it)
      expect(checkAnswer(key, { blocks: it.target }).status, it.id).toBe('correct')
      expect(checkAnswer(key, { blocks: it.start }).status, it.id).toBe('wrong')
      expect(checkAnswer(key, { blocks: { ...it.target, o: it.target.o + 1 } }).status).toBe('wrong')
    }
  })

  it('fractionbar: a search finds a right answer, and the starting state is wrong', () => {
    for (const it of ofType('fractionbar')) {
      if (it.type !== 'fractionbar') continue
      const key = keyOf(it)
      const choices = it.rows.map((r) => {
        const dens = r.den !== undefined ? [r.den] : it.splits
        return dens.flatMap((den) => (r.locked !== undefined ? [{ den, shaded: r.locked }] : Array.from({ length: den + 1 }, (_, shaded) => ({ den, shaded }))))
      })
      let solutions = 0
      const walk = (i: number, acc: { den: number; shaded: number }[]) => {
        if (i === choices.length) {
          if (checkAnswer(key, { bars: acc }).status === 'correct') solutions++
          return
        }
        for (const c of choices[i]!) walk(i + 1, [...acc, c])
      }
      walk(0, [])
      expect(solutions, it.id).toBeGreaterThan(0)
      const start = it.rows.map((r) => ({ den: r.den ?? it.splits[0]!, shaded: r.locked ?? 0 }))
      expect(checkAnswer(key, { bars: start }).status, it.id).toBe('wrong')
    }
  })

  it('barmodel: the written bars are right, and mistakes are wrong', () => {
    for (const it of ofType('barmodel')) {
      if (it.type !== 'barmodel') continue
      const key = keyOf(it)
      const bars = it.bars.map((b) => ({ label: b.label, units: b.units }))
      const model = { bars, ...(it.unitValue !== undefined ? { unit: it.unitValue } : {}) }
      expect(checkAnswer(key, { model }).status, it.id).toBe('correct')
      expect(checkAnswer(key, { model: { ...model, bars: bars.map((b, i) => (i === 0 ? { ...b, units: b.units + 1 } : b)) } }).status).toBe('wrong')
      expect(checkAnswer(key, { model: { ...model, bars: bars.slice(0, -1) } }).status).toBe('wrong')
      if (it.unitValue !== undefined) expect(checkAnswer(key, { model: { ...model, unit: it.unitValue + 1 } }).status).toBe('wrong')
    }
  })

  it('tangram: a greedy solver fills every slot, and an empty board is blank', () => {
    for (const it of ofType('tangram')) {
      if (it.type !== 'tangram') continue
      const key = keyOf(it)
      const used = new Set<number>()
      const placed = it.slots.map((slot) => {
        for (let p = 0; p < it.pieces.length; p++) {
          if (used.has(p)) continue
          const o = fittingOrientations(it.pieces[p]!, slot as unknown as Pt[])[0]
          if (o) {
            used.add(p)
            return [p, o.rot, o.flip ? 1 : 0] as const
          }
        }
        return null
      })
      expect(placed.every(Boolean), it.id).toBe(true)
      expect(checkAnswer(key, { placed }).status, it.id).toBe('correct')
      expect(checkAnswer(key, { placed: placed.map(() => null) }).status).toBe('blank')
      // Using one piece twice is never right.
      expect(checkAnswer(key, { placed: placed.map((p) => (p ? ([placed[0]![0], p[1], p[2]] as const) : p)) }).status).toBe('wrong')
    }
  })

  it('geoboard: the example is right, an open or wrong shape is not', () => {
    for (const it of ofType('geoboard')) {
      if (it.type !== 'geoboard') continue
      const key = keyOf(it)
      expect(checkAnswer(key, { pegs: it.example, closed: true }).status, it.id).toBe('correct')
      expect(checkAnswer(key, { pegs: it.example, closed: false }).status).toBe('wrong')
      const probes = [[[0, 0], [1, 0], [0, 1]], [[0, 0], [1, 0], [1, 1], [0, 1]], [[0, 0], [2, 0], [2, 1], [0, 1]], [[0, 0], [1, 0], [1, 2], [2, 2], [2, 3], [0, 3]]] as [number, number][][]
      const results = probes.map((pegs) => checkAnswer(key, { pegs, closed: true }).status)
      expect(results).toContain('wrong')
    }
  })

  it('never sends the key or the target to the learner in test mode', () => {
    for (const it of tools) {
      const client = presentItem(it, { seed: 's', includeKey: false, includeHints: false })
      expect(client.key).toBeUndefined()
      expect(client.hints).toBeUndefined()
      expect(client.reveal).toBeUndefined()
      const json = JSON.stringify(client)
      for (const secret of ['"target"', '"targets"', '"rule"', '"example"', '"unitValue"', '"explanation"']) expect(json, `${it.id} ${secret}`).not.toContain(secret)
      if (it.type === 'barmodel') expect(json).not.toContain('"units"')
    }
  })

  it('sends the key and hints in practice mode', () => {
    for (const it of tools) {
      const client = presentItem(it, { seed: 's', includeKey: true, includeHints: true, answerText: 'x' })
      expect(client.key?.type).toBe(it.type)
      expect(client.hints).toHaveLength(3)
    }
  })
})
