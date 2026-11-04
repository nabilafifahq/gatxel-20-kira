import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { checkAnswer } from '@kira/content/check'
import { loadContent } from '@kira/content/load'
import { manipulativeAnswer } from '@kira/content/manip-solve'
import { presentItem, type ClientItem } from '@kira/content/present'
import { isAnswerComplete } from '@/components/widgets/answers'
import { BarModelWidget } from '@/components/widgets/BarModelWidget'
import { BlocksWidget } from '@/components/widgets/BlocksWidget'
import { FractionBarWidget } from '@/components/widgets/FractionBarWidget'
import { GeoboardWidget } from '@/components/widgets/GeoboardWidget'
import { TangramWidget } from '@/components/widgets/TangramWidget'
import type { WidgetProps } from '@/components/widgets/types'

const { index } = loadContent()
const TYPES = ['blocks', 'fractionbar', 'barmodel', 'tangram', 'geoboard'] as const
const first = (type: string) => [...index.items.values()].find((i) => i.type === type)!

const WIDGET: Record<(typeof TYPES)[number], (p: WidgetProps) => ReactElement | null> = {
  blocks: BlocksWidget,
  fractionbar: FractionBarWidget,
  barmodel: BarModelWidget,
  tangram: TangramWidget,
  geoboard: GeoboardWidget,
}

const props = (item: ClientItem, value: unknown | null = null, extra: Partial<WidgetProps> = {}): WidgetProps => ({ item, value, onChange: () => {}, subject: 'math', ...extra })
const render = (type: (typeof TYPES)[number], p: WidgetProps) => renderToStaticMarkup(createElement(WIDGET[type], p))

describe('widgets alat peraga', () => {
  it('each tool renders its tap controls from the presented item alone', () => {
    const expected: Record<(typeof TYPES)[number], RegExp> = {
      blocks: /Add one one/,
      fractionbar: /Part 1 of \d+/,
      barmodel: /Add bar/,
      tangram: /Tray of pieces/,
      geoboard: /Peg column 1, row 1/,
    }
    for (const type of TYPES) {
      const client = presentItem(first(type), { seed: 's', includeKey: false, includeHints: false })
      expect(render(type, props(client)), type).toMatch(expected[type])
    }
  })

  it('does not leak the target into the markup in a timed mode', () => {
    for (const type of TYPES) {
      const it = first(type)
      const html = render(type, props(presentItem(it, { seed: 's', includeKey: false, includeHints: false })))
      expect(html).not.toContain(it.explanation)
      if (it.type === 'geoboard') expect(html).not.toContain('example')
    }
  })

  it('every tool needs an answer before Check turns on, and the right answer completes it and scores right', () => {
    for (const type of TYPES) {
      const it = first(type)
      const client = presentItem(it, { seed: 's', includeKey: false, includeHints: false })
      expect(isAnswerComplete(client, null), type).toBe(false)
      const right = manipulativeAnswer(it)
      expect(right, type).not.toBeNull()
      expect(isAnswerComplete(client, right), type).toBe(true)
      expect(checkAnswer(presentItem(it, { seed: 's', includeKey: true, includeHints: true, answerText: 'x' }).key!, right).status, type).toBe('correct')
    }
  })

  it('an unfinished answer is not complete', () => {
    const bm = presentItem(first('barmodel'), { seed: 's', includeKey: false, includeHints: false })
    expect(isAnswerComplete(bm, { model: { bars: [{ label: '', units: 1 }] } })).toBe(false)
    const geo = presentItem(first('geoboard'), { seed: 's', includeKey: false, includeHints: false })
    expect(isAnswerComplete(geo, { pegs: [[0, 0], [1, 0], [0, 1]], closed: false })).toBe(false)
    const tan = presentItem(first('tangram'), { seed: 's', includeKey: false, includeHints: false })
    expect(isAnswerComplete(tan, { placed: (tan.tangram?.slots ?? []).map(() => null) })).toBe(false)
  })

  it('disables the controls once feedback is shown', () => {
    const client = presentItem(first('blocks'), { seed: 's', includeKey: false, includeHints: false })
    const html = render('blocks', props(client, null, { feedback: 'correct' }))
    expect(html).toMatch(/disabled=""/)
    expect(html).toContain('border-success')
  })
})
