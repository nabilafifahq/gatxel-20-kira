import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { checkAnswer } from '@kira/content/check'
import { loadContent } from '@kira/content/load'
import { presentItem, type ClientItem } from '@kira/content/present'
import { itemSchema, type Item } from '@kira/content/schema'
import { isAnswerComplete, isManualType } from '@/components/widgets/answers'
import { QuestionView } from '@/components/widgets/QuestionView'
import { speakableText } from '@/components/widgets/speakable'
import { remainingTiles } from '@/components/widgets/TilesWidget'
import { Widget } from '@/components/widgets/Widget'

const NEW_TYPES = ['story', 'listen', 'tiles', 'spell', 'cloze', 'hotspot', 'label', 'table', 'grid', 'photo']

const base = { skill: 'e2.test', difficulty: 2, hints: ['One.', 'Two.', 'Three.'], explanation: 'Because.' }
const item = (extra: Record<string, unknown>): Item => itemSchema.parse({ id: 'e2.test.001', prompt: 'Try this.', ...base, ...extra })
const present = (i: Item, key = false): ClientItem => presentItem(i, { seed: 's', includeKey: key, includeHints: key })

const scene = { kind: 'scene', width: 240, height: 160, shapes: [{ t: 'rect', x: 10, y: 10, w: 100, h: 60 }], alt: 'A plain picture with one box.' }

const listen = item({ type: 'listen', prompt: 'Listen. Which animal did you hear?', listenText: 'I can see a cat on the mat.', options: [{ text: 'dog' }, { text: 'cat' }, { text: 'hen' }], answer: 1 })
const spell = item({ type: 'spell', prompt: 'Listen, then spell the word.', word: 'hat', sentence: 'I wear a hat.' })
const tiles = item({ type: 'tiles', prompt: 'Build it.', answer: 'we eat rice and fish', distractors: ['drink'] })
const cloze = item({ type: 'cloze', prompt: 'She ___ to school and ___ her friends.', gaps: [{ options: ['walks', 'walk'], answer: 0 }, { options: ['meet', 'meets'], answer: 1 }] })
const hotspot = item({
  type: 'hotspot',
  prompt: 'Tap the box.',
  figure: scene,
  regions: [{ label: 'box', x: 30, y: 30, w: 30, h: 30 }, { label: 'sky', x: 75, y: 20, w: 30, h: 30 }],
  answers: [0],
})
const label = item({ type: 'label', prompt: 'Label it.', figure: scene, labels: ['root', 'stem'], spots: [{ x: 50, y: 85 }, { x: 50, y: 40 }], extraLabels: ['petal'] })
const table = item({ type: 'table', prompt: 'Fill in.', head: ['Animal', 'Legs'], rows: [['Cat', '4'], ['Bird', '']], blanks: [{ row: 1, col: 1, answers: ['2'] }] })
const grid = item({ type: 'grid', prompt: 'Fill the grid.', puzzle: 'latin', size: 3, given: [[1, 2, 0], [0, 3, 1], [3, 1, 2]], filled: [[1, 2, 3], [2, 3, 1], [3, 1, 2]] })
const story = item({
  type: 'story',
  prompt: 'Mia has 8 mangoes.',
  parts: [{ type: 'numeric', prompt: 'How many?', answer: 8 }, { type: 'mcq', prompt: 'Who?', options: [{ text: 'Mia' }, { text: 'Sam' }], answer: 0 }],
})
const photo = item({ type: 'photo', prompt: 'Take a photo.', hints: [], rubric: { criteria: [{ label: 'Shows it', points: 2 }] } })

describe('isAnswerComplete', () => {
  it('needs a full answer for every new type', () => {
    expect(isAnswerComplete(present(listen), null)).toBe(false)
    expect(isAnswerComplete(present(listen), { choice: 2 })).toBe(true)
    expect(isAnswerComplete(present(tiles), { words: ['we'] })).toBe(false)
    expect(isAnswerComplete(present(tiles), { words: ['we', 'eat'] })).toBe(true)
    expect(isAnswerComplete(present(spell), { value: '' })).toBe(false)
    expect(isAnswerComplete(present(spell), { value: 'h' })).toBe(true)
    expect(isAnswerComplete(present(cloze), { texts: ['walks', ''] })).toBe(false)
    expect(isAnswerComplete(present(cloze), { texts: ['walks', 'meets'] })).toBe(true)
    expect(isAnswerComplete(present(hotspot), { texts: [] })).toBe(false)
    expect(isAnswerComplete(present(hotspot), { texts: ['box'] })).toBe(true)
    expect(isAnswerComplete(present(label), { texts: ['root', ''] })).toBe(false)
    expect(isAnswerComplete(present(label), { texts: ['root', 'stem'] })).toBe(true)
    expect(isAnswerComplete(present(table), { texts: [''] })).toBe(false)
    expect(isAnswerComplete(present(table), { texts: ['2'] })).toBe(true)
    expect(isAnswerComplete(present(grid), { cells: [1, 2, 0, 0, 3, 1, 3, 1, 2] })).toBe(false)
    expect(isAnswerComplete(present(grid), { cells: [1, 2, 3, 2, 3, 1, 3, 1, 2] })).toBe(true)
    expect(isAnswerComplete(present(story), { parts: [{ value: '8' }, null] })).toBe(false)
    expect(isAnswerComplete(present(story), { parts: [{ value: '8' }, { choice: 0 }] })).toBe(true)
    expect(isAnswerComplete(present(photo), null)).toBe(false)
    expect(isAnswerComplete(present(photo), { mediaId: 'abc' })).toBe(true)
  })

  it('photo is a manual type', () => {
    expect(isManualType('photo')).toBe(true)
    expect(isManualType('listen')).toBe(false)
  })

  it('the key built from a complete answer says correct (client and server agree)', () => {
    const key = present(story, true).key!
    expect(checkAnswer(key, { parts: [{ value: '8' }, { choice: 0 }] }).status).toBe('correct')
  })
})

describe('speakableText never reads the hidden text', () => {
  it('listen and spell', () => {
    const l = speakableText(present(listen))
    expect(l).toContain('Listen. Which animal did you hear?')
    expect(l).not.toContain('on the mat')
    const s = speakableText(present(spell))
    expect(s.toLowerCase()).not.toContain('hat')
    expect(s).toBe('Listen, then spell the word.')
  })

  it('reads cards, gaps and tables', () => {
    expect(speakableText(present(tiles))).toContain('drink')
    expect(speakableText(present(cloze))).toContain('Gap 1')
    expect(speakableText(present(table))).toContain('Animal, Legs')
    expect(speakableText(present(story))).toContain('How many?')
  })
})

describe('remainingTiles', () => {
  it('removes one card per used word, so repeated words stay safe', () => {
    const tilesList = ['I', 'went', 'I', 'ran']
    expect(remainingTiles(tilesList, ['I']).map((t) => t.text)).toEqual(['went', 'I', 'ran'])
    expect(remainingTiles(tilesList, ['I', 'I']).map((t) => t.text)).toEqual(['went', 'ran'])
    expect(remainingTiles(tilesList, ['went', 'I', 'ran', 'I'])).toEqual([])
  })
})

const widgetProps = (c: ClientItem) => ({ item: c, value: null, onChange: () => undefined, subject: 'english' as const })

describe('widgets render', () => {
  it('listen shows a play button and renders the same with or without the hidden text', () => {
    const c = present(listen)
    const html = renderToStaticMarkup(createElement(Widget, widgetProps(c)))
    expect(html.includes('Play the audio')).toBe(true)
    expect(html.includes('on the mat')).toBe(false)
    expect(renderToStaticMarkup(createElement(Widget, widgetProps({ ...c, listenText: undefined })))).toBe(html)
    const q = (x: ClientItem) => renderToStaticMarkup(createElement(QuestionView, { item: x, number: 1, subject: 'english', answer: { value: null, onChange: () => undefined } }))
    expect(q(c).includes('on the mat')).toBe(false)
    expect(q({ ...c, listenText: undefined })).toBe(q(c))
  })

  it('spell shows empty boxes for the word length and renders the same without the hidden text', () => {
    const c = present(spell)
    const html = renderToStaticMarkup(createElement(Widget, widgetProps(c)))
    expect(html.includes('Hear the word')).toBe(true)
    expect(html.includes('Your spelling is empty')).toBe(true)
    expect(html.match(/h-16 w-12/g)?.length).toBe(3)
    expect(renderToStaticMarkup(createElement(Widget, widgetProps({ ...c, listenText: undefined })))).toBe(html)
  })

  it('cloze puts a select in the question text for each gap', () => {
    const q = renderToStaticMarkup(createElement(QuestionView, { item: present(cloze), number: 1, subject: 'english', answer: { value: null, onChange: () => undefined } }))
    expect(q.match(/<select/g)?.length).toBe(2)
    expect(q).toContain('aria-label="Gap 1 of 2"')
  })

  it('hotspot and label draw the picture once, in the answer area', () => {
    const q = renderToStaticMarkup(createElement(QuestionView, { item: present(hotspot), number: 1, subject: 'science', answer: { value: null, onChange: () => undefined } }))
    expect(q.includes('role="img"')).toBe(false)
    const w = renderToStaticMarkup(createElement(Widget, { ...widgetProps(present(hotspot)), subject: 'science' }))
    expect(w.includes('role="img"')).toBe(true)
    expect(w.includes('aria-label="box"')).toBe(true)
    const l = renderToStaticMarkup(createElement(Widget, { ...widgetProps(present(label)), subject: 'science' }))
    expect(l).toContain('Place 1, empty')
    expect(l).toContain('petal')
  })

  it('table and grid render their cells as buttons', () => {
    const t = renderToStaticMarkup(createElement(Widget, widgetProps(present(table))))
    expect(t).toContain('<table')
    expect(t).toContain('Legs, row 2')
    const g = renderToStaticMarkup(createElement(Widget, { ...widgetProps(present(grid)), subject: 'math' }))
    expect(g).toContain('Row 1, column 3: empty')
    expect(g).toContain('given')
  })

  it('photo offers camera and gallery, and a skip when the runner allows it', () => {
    const html = renderToStaticMarkup(createElement(Widget, { ...widgetProps(present(photo)), onSkip: () => undefined, onUpload: async () => null }))
    expect(html).toContain('Take a photo')
    expect(html).toContain('Choose a photo')
    expect(html).toContain('Skip this one')
    expect(html).toContain('capture="environment"')
  })
})

describe('every new-type item in content/', () => {
  const { index, errors } = loadContent()
  const all = [...index.items.values()].filter((i) => NEW_TYPES.includes(i.type))

  it('loads without errors and covers every type with at least 15 items', () => {
    expect(errors).toEqual([])
    for (const t of NEW_TYPES) expect(all.filter((i) => i.type === t).length, t).toBeGreaterThanOrEqual(15)
  })

  it('renders through the real widget router and keeps its key out of test mode', () => {
    for (const it of all) {
      const c = present(it)
      expect(c.key, it.id).toBeUndefined()
      expect(c.reveal, it.id).toBeUndefined()
      const html = renderToStaticMarkup(createElement(Widget, { ...widgetProps(c), subject: it.skill.startsWith('s') ? 'science' : it.skill.startsWith('m') ? 'math' : 'english' }))
      expect(html.length, it.id).toBeGreaterThan(50)
      if (it.type === 'listen' || it.type === 'spell') {
        // Teks dengar tidak dipakai di layar atau di bacaan suara: hasilnya sama tanpa teks itu.
        const without = { ...c, listenText: undefined }
        const sub = it.skill.startsWith('s') ? 'science' : it.skill.startsWith('m') ? 'math' : 'english'
        expect(speakableText(c), it.id).toBe(speakableText(without))
        expect(html === renderToStaticMarkup(createElement(Widget, { ...widgetProps(without), subject: sub })), it.id).toBe(true)
      }
      expect(isAnswerComplete(c, null), it.id).toBe(false)
    }
  })

  it('the correct answer built from the key is accepted for every auto-marked item', () => {
    for (const it of all) {
      if (it.type === 'photo') continue
      const key = present(it, true).key!
      const right = correctAnswer(it)
      expect(checkAnswer(key, right).status, it.id).toBe('correct')
      expect(isAnswerComplete(present(it), right), it.id).toBe(true)
    }
  })
})

/** The answer a child would give for the right solution. */
function correctAnswer(it: Item): unknown {
  switch (it.type) {
    case 'story':
      return {
        parts: it.parts.map((p) => (p.type === 'mcq' ? { choice: p.answer } : p.type === 'numeric' ? { value: String(p.answer) } : { texts: [p.answers[0]] })),
      }
    case 'listen':
      return { choice: it.answer }
    case 'tiles':
      return { words: it.answer.split(/\s+/) }
    case 'spell':
      return { value: it.word }
    case 'cloze':
      return { texts: it.gaps.map((g) => g.options[g.answer]) }
    case 'hotspot':
      return { texts: it.answers.map((i) => it.regions[i]!.label) }
    case 'label':
      return { texts: it.labels }
    case 'table': {
      const texts = it.blanks.map((b) => b.answers[0])
      return { texts }
    }
    case 'grid':
      return { cells: it.filled.flat() }
    default:
      return null
  }
}
