import { describe, expect, it } from 'vitest'
import { answerText, cellMatches, checkAnswer, keyOf, normaliseSentence, normaliseWord } from '../src/check'
import { gridRulesOk, gridValues, solveGrid } from '../src/grid'
import { answerFromLabels, answerToLabels, labelCount, type LabelPerm } from '../src/labels'
import { semanticProblems } from '../src/load'
import { presentItem } from '../src/present'
import { itemSchema, MANUAL_TYPES, type Item } from '../src/schema'

const base = { skill: 'e2.test', difficulty: 2, prompt: 'Try this.', hints: ['One.', 'Two.', 'Three.'], explanation: 'Because.' }
const make = (extra: Record<string, unknown>): Item => itemSchema.parse({ id: `e2.test.001`, ...base, ...extra })
const present = (item: Item, labels?: LabelPerm) => presentItem(item, { seed: 'seed', includeKey: false, includeHints: false, ...(labels ? { labels } : {}) })

const scene = { kind: 'scene', width: 240, height: 160, shapes: [{ t: 'rect', x: 10, y: 10, w: 100, h: 60 }], alt: 'A plain picture with one box.' }

const story = make({
  type: 'story',
  prompt: 'Mia has 8 mangoes. She gives 3 to Sam and then picks 2 more.',
  parts: [
    { type: 'numeric', prompt: 'How many mangoes does Mia have after she gives some to Sam?', answer: 5 },
    { type: 'mcq', prompt: 'Who has fewer mangoes now?', options: [{ text: 'Mia' }, { text: 'Sam' }, { text: 'Neither' }], answer: 1 },
    { type: 'mcq', prompt: 'How many does Mia have at the end?', options: [{ text: '6' }, { text: '7' }, { text: '10' }], answer: 1 },
    { type: 'text', prompt: 'What fruit is it?', answers: ['mango', 'mangoes'] },
  ],
})
const listen = make({ type: 'listen', prompt: 'Listen. Which animal did you hear?', listenText: 'I can see a cat on the mat.', options: [{ text: 'dog' }, { text: 'cat' }, { text: 'hen' }], answer: 1 })
const tiles = make({ type: 'tiles', prompt: 'Build the sentence.', answer: 'we eat rice and fish', alternatives: ['we eat fish and rice'], distractors: ['drink', 'bread'] })
const spell = make({ type: 'spell', prompt: 'Listen, then spell the word.', word: 'hat', sentence: 'I wear a hat.' })
const cloze = make({
  type: 'cloze',
  prompt: 'She ___ to school and ___ her friends.',
  gaps: [
    { options: ['walks', 'walk', 'walking'], answer: 0 },
    { options: ['meet', 'meets'], answer: 1 },
  ],
})
const hotspot = make({
  type: 'hotspot',
  prompt: 'Tap the box.',
  figure: scene,
  regions: [
    { label: 'box', x: 30, y: 30, w: 30, h: 30 },
    { label: 'sky', x: 75, y: 20, w: 30, h: 30 },
    { label: 'ground', x: 50, y: 80, w: 50, h: 30 },
  ],
  answers: [0],
})
const label = make({
  type: 'label',
  prompt: 'Label the parts.',
  figure: scene,
  labels: ['root', 'stem', 'leaf'],
  spots: [{ x: 50, y: 85 }, { x: 50, y: 50 }, { x: 80, y: 30 }],
  extraLabels: ['petal'],
})
const table = make({
  type: 'table',
  prompt: 'Fill in the table.',
  head: ['Animal', 'Legs'],
  rows: [['Cat', '4'], ['Bird', ''], ['Spider', '']],
  blanks: [{ row: 1, col: 1, answers: ['2'] }, { row: 2, col: 1, answers: ['8', 'eight'] }],
})
const magic = make({
  type: 'grid',
  prompt: 'Make every row, column and diagonal add up to 15.',
  puzzle: 'magic',
  size: 3,
  given: [[2, 0, 6], [0, 5, 0], [4, 0, 0]],
  filled: [[2, 7, 6], [9, 5, 1], [4, 3, 8]],
})
const sudoku = make({
  type: 'grid',
  prompt: 'Put 1 to 4 in every row, column and box once.',
  puzzle: 'sudoku',
  size: 4,
  given: [[1, 2, 0, 4], [0, 4, 1, 0], [0, 1, 4, 0], [4, 3, 0, 1]],
  filled: [[1, 2, 3, 4], [3, 4, 1, 2], [2, 1, 4, 3], [4, 3, 2, 1]],
})
const photo = make({ type: 'photo', prompt: 'Solve it on paper, then take a photo.', hints: [], rubric: { criteria: [{ label: 'Shows the working', points: 2 }, { label: 'Correct answer', points: 2 }] } })

describe('schema', () => {
  it('accepts every new type and keeps photo manual', () => {
    for (const it of [story, listen, tiles, spell, cloze, hotspot, label, table, magic, sudoku, photo]) expect(it.type).toBeTruthy()
    expect(MANUAL_TYPES).toContain('photo')
  })

  it('rejects unknown keys and bad shapes', () => {
    expect(itemSchema.safeParse({ id: 'e2.test.001', ...base, type: 'spell', word: 'hat', extra: 1 }).success).toBe(false)
    expect(itemSchema.safeParse({ id: 'e2.test.001', ...base, type: 'spell', word: 'h4t' }).success).toBe(false)
    expect(itemSchema.safeParse({ id: 'e2.test.001', ...base, type: 'hotspot', regions: [], answers: [0] }).success).toBe(false)
    expect(itemSchema.safeParse({ id: 'e2.test.001', ...base, type: 'story', parts: [{ type: 'numeric', prompt: 'x', answer: 1 }] }).success).toBe(false)
  })
})

describe('checkAnswer story', () => {
  const key = keyOf(story)
  it('is correct only when every part is right', () => {
    const right = { parts: [{ value: '5' }, { choice: 1 }, { choice: 1 }, { texts: ['Mango'] }] }
    expect(checkAnswer(key, right).status).toBe('correct')
    const wrong = checkAnswer(key, { parts: [{ value: '5' }, { choice: 0 }, { choice: 1 }, { texts: ['mango'] }] })
    expect(wrong.status).toBe('wrong')
    expect(wrong.partial).toBeCloseTo(0.75)
  })
  it('treats empty and half-empty answers', () => {
    expect(checkAnswer(key, { parts: [null, null, null, null] }).status).toBe('blank')
    expect(checkAnswer(key, { parts: [{ value: '5' }] }).status).toBe('wrong')
    expect(checkAnswer(key, null).status).toBe('blank')
  })
})

describe('checkAnswer other new types', () => {
  it('listen checks the chosen option', () => {
    expect(checkAnswer(keyOf(listen), { choice: 1 }).status).toBe('correct')
    expect(checkAnswer(keyOf(listen), { choice: 0 }).status).toBe('wrong')
    expect(checkAnswer(keyOf(listen), { choice: null }).status).toBe('blank')
  })

  it('tiles accepts the main sentence and alternatives, rejects distractors and reordering', () => {
    const key = keyOf(tiles)
    expect(checkAnswer(key, { words: ['we', 'eat', 'rice', 'and', 'fish'] }).status).toBe('correct')
    expect(checkAnswer(key, { words: ['we', 'eat', 'fish', 'and', 'rice'] }).status).toBe('correct')
    expect(checkAnswer(key, { words: ['eat', 'we', 'rice', 'and', 'fish'] }).status).toBe('wrong')
    expect(checkAnswer(key, { words: ['we', 'eat', 'rice', 'and', 'bread'] }).status).toBe('wrong')
    expect(checkAnswer(key, { words: ['We', 'eat', 'rice', 'and', 'fish'] }).status).toBe('wrong')
    expect(checkAnswer(key, { words: [] }).status).toBe('blank')
    expect(checkAnswer(key, { words: ['we', 'eat', 'rice', 'and', 'bread'] }).partial).toBeCloseTo(0.8)
  })

  it('spell ignores case and spaces but not letters', () => {
    const key = keyOf(spell)
    expect(checkAnswer(key, { value: 'HAT' }).status).toBe('correct')
    expect(checkAnswer(key, { value: ' hat ' }).status).toBe('correct')
    expect(checkAnswer(key, { value: 'hut' }).status).toBe('wrong')
    expect(checkAnswer(key, { value: '' }).status).toBe('blank')
  })

  it('cloze compares the chosen word per gap', () => {
    const key = keyOf(cloze)
    expect(checkAnswer(key, { texts: ['walks', 'meets'] }).status).toBe('correct')
    const part = checkAnswer(key, { texts: ['walks', 'meet'] })
    expect(part.status).toBe('wrong')
    expect(part.partial).toBeCloseTo(0.5)
    expect(checkAnswer(key, { texts: ['', ''] }).status).toBe('blank')
  })

  it('hotspot needs exactly the right regions', () => {
    const key = keyOf(hotspot)
    expect(checkAnswer(key, { texts: ['box'] }).status).toBe('correct')
    expect(checkAnswer(key, { texts: ['sky'] }).status).toBe('wrong')
    expect(checkAnswer(key, { texts: ['box', 'sky'] }).status).toBe('wrong')
    expect(checkAnswer(key, { texts: ['Box', 'box'] }).status).toBe('correct')
  })

  it('label compares the label placed on each spot', () => {
    const key = keyOf(label)
    expect(checkAnswer(key, { texts: ['root', 'stem', 'leaf'] }).status).toBe('correct')
    const swapped = checkAnswer(key, { texts: ['stem', 'root', 'leaf'] })
    expect(swapped.status).toBe('wrong')
    expect(swapped.partial).toBeCloseTo(1 / 3)
    expect(checkAnswer(key, { texts: ['root', '', ''] }).status).toBe('wrong')
    expect(checkAnswer(key, { texts: ['', '', ''] }).status).toBe('blank')
  })

  it('table matches text or numbers', () => {
    const key = keyOf(table)
    expect(checkAnswer(key, { texts: ['2', '8'] }).status).toBe('correct')
    expect(checkAnswer(key, { texts: ['2.0', 'Eight'] }).status).toBe('correct')
    expect(checkAnswer(key, { texts: ['2', '6'] }).status).toBe('wrong')
    expect(cellMatches('', '')).toBe(false)
  })

  it('grid accepts any filling that keeps the givens and follows the rules', () => {
    const key = keyOf(magic)
    expect(checkAnswer(key, { cells: [2, 7, 6, 9, 5, 1, 4, 3, 8] }).status).toBe('correct')
    const wrong = checkAnswer(key, { cells: [2, 7, 6, 9, 5, 1, 4, 8, 3] })
    expect(wrong.status).toBe('wrong')
    expect(wrong.partial).toBeCloseTo(3 / 5)
    expect(checkAnswer(key, { cells: [0, 0, 0, 0, 0, 0, 0, 0, 0] }).status).toBe('blank')
    expect(checkAnswer(key, { cells: [2, 0, 6, 0, 5, 0, 4, 0, 0] }).status).toBe('wrong')
    expect(checkAnswer(key, { cells: [3, 7, 6, 9, 5, 1, 4, 3, 8] }).status).toBe('wrong')
    const sk = keyOf(sudoku)
    expect(checkAnswer(sk, { cells: [1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1] }).status).toBe('correct')
    expect(checkAnswer(sk, { cells: [1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 1, 2] }).status).toBe('wrong')
  })

  it('photo is pending once a photo is sent', () => {
    expect(checkAnswer(keyOf(photo), { mediaId: 'abc' }).status).toBe('pending')
    expect(checkAnswer(keyOf(photo), null).status).toBe('blank')
  })
})

describe('grid helpers', () => {
  it('solves the puzzles uniquely', () => {
    const m = solveGrid('magic', 3, [2, 0, 6, 0, 5, 0, 4, 0, 0], gridValues('magic', 3, [2, 7, 6, 9, 5, 1, 4, 3, 8]))
    expect(m).toEqual([[2, 7, 6, 9, 5, 1, 4, 3, 8]])
    const s = solveGrid('sudoku', 4, [1, 2, 0, 4, 0, 4, 1, 0, 0, 1, 4, 0, 4, 3, 0, 1], [1, 2, 3, 4])
    expect(s).toEqual([[1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1]])
    expect(solveGrid('sudoku', 4, [1, 0, 0, 4, 0, 4, 1, 0, 0, 1, 4, 0, 4, 0, 0, 1], [1, 2, 3, 4])).toHaveLength(2)
  })
  it('finds several solutions for an open puzzle', () => {
    expect(solveGrid('latin', 3, [0, 0, 0, 0, 0, 0, 0, 0, 0], [1, 2, 3], 50).length).toBe(12)
  })
  it('knows the rules', () => {
    expect(gridRulesOk('sudoku', 4, [1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1], [1, 2, 3, 4])).toBe(true)
    expect(gridRulesOk('latin', 3, [1, 2, 3, 2, 3, 1, 3, 1, 2], [1, 2, 3])).toBe(true)
    expect(gridRulesOk('latin', 3, [1, 2, 3, 2, 3, 1, 3, 2, 1], [1, 2, 3])).toBe(false)
    expect(gridRulesOk('magic', 3, [8, 1, 6, 3, 5, 7, 4, 9, 2], [1, 2, 3, 4, 5, 6, 7, 8, 9])).toBe(true)
  })
})

describe('normalisers', () => {
  it('normalises sentences, words and cells', () => {
    expect(normaliseSentence('  I  like   red apples ')).toBe('I like red apples')
    expect(normaliseWord(" Don't ")).toBe("don't")
    expect(cellMatches('8', 'eight')).toBe(false)
    expect(cellMatches(' 08 ', '8')).toBe(true)
  })
})

describe('presentItem', () => {
  it('shows listen and spell audio text to the device only as listenText, never in the prompt', () => {
    const l = present(listen)
    expect(l.listenText).toBe('I can see a cat on the mat.')
    expect(l.prompt).not.toContain('cat on the mat')
    expect(JSON.stringify({ ...l, listenText: undefined })).not.toContain('on the mat')
    const s = present(spell)
    expect(s.listenText).toContain('hat')
    expect(s.spellLength).toBe(3)
    expect(JSON.stringify({ ...s, listenText: undefined })).not.toContain('"hat"')
  })

  it('does not put the key in a test-mode item', () => {
    for (const it of [story, listen, tiles, spell, cloze, hotspot, label, table, magic, sudoku]) {
      const c = present(it)
      expect(c.key).toBeUndefined()
      expect(c.reveal).toBeUndefined()
      expect(JSON.stringify(c)).not.toContain('"explanation"')
    }
    const key = presentItem(listen, { seed: 's', includeKey: true, includeHints: true }).key
    expect(key).toEqual({ type: 'listen', answer: 1 })
  })

  it('does not reveal the grid solution in the client item', () => {
    const c = present(magic)
    expect(c.grid).toEqual({ puzzle: 'magic', size: 3, given: [2, 0, 6, 0, 5, 0, 4, 0, 0], values: [1, 2, 3, 4, 5, 6, 7, 8, 9] })
  })

  it('shuffles tiles away from the answer order and keeps distractors', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const c = presentItem(tiles, { seed, includeKey: false, includeHints: false })
      expect(c.tiles).toHaveLength(7)
      expect([...c.tiles!].sort()).toEqual(['and', 'bread', 'drink', 'eat', 'fish', 'rice', 'we'].sort())
      expect(c.tiles!.join(' ')).not.toContain('we eat rice and fish')
    }
  })

  it('cloze gap options are shuffled but complete', () => {
    const c = present(cloze)
    expect(c.cloze).toHaveLength(2)
    expect([...c.cloze![0]!].sort()).toEqual(['walk', 'walking', 'walks'])
    expect(c.blanks).toBeUndefined()
  })

  it('hotspot regions carry labels and positions but no answer flag', () => {
    const c = present(hotspot)
    expect(c.hotspot!.count).toBe(1)
    expect(c.hotspot!.regions.map((r) => r.label).sort()).toEqual(['box', 'ground', 'sky'])
    expect(JSON.stringify(c.hotspot)).not.toContain('answer')
  })

  it('label gives shuffled labels including distractors and keeps spot order', () => {
    const c = present(label)
    expect([...c.labelDiagram!.labels].sort()).toEqual(['leaf', 'petal', 'root', 'stem'])
    expect(c.labelDiagram!.spots).toEqual([{ x: 50, y: 85 }, { x: 50, y: 50 }, { x: 80, y: 30 }])
  })

  it('table blanks are emptied and flagged numeric', () => {
    const c = present(table)
    expect(c.table!.rows).toEqual([['Cat', '4'], ['Bird', ''], ['Spider', '']])
    expect(c.table!.blanks).toEqual([{ row: 1, col: 1, numeric: true }, { row: 2, col: 1, numeric: false }])
  })

  it('story parts get their own options, local indices without labels', () => {
    const c = present(story)
    expect(c.parts).toHaveLength(4)
    const p1 = c.parts![1]!
    expect(p1.options!.map((o) => o.i).sort()).toEqual([0, 1, 2])
    expect(c.parts![0]).toMatchObject({ type: 'numeric', allowDecimal: false })
  })
})

describe('labels for story and listen', () => {
  const PERM: LabelPerm = [4, 2, 0, 5, 1, 3] // 3 options in part 1 + 3 in part 2
  it('counts all choice labels', () => {
    expect(labelCount(story)).toBe(6)
    expect(labelCount(listen)).toBe(3)
  })

  it('presents global labels and maps them back to indices inside each part', () => {
    const c = present(story, PERM)
    const labels = c.parts!.flatMap((p) => (p.options ? p.options.map((o) => o.i) : []))
    expect(labels.sort()).toEqual([0, 1, 2, 3, 4, 5])
    // Part 1 option 1 (Sam, the right answer) has label PERM[1] = 2; part 2 option 1 (7) has label PERM[4] = 1.
    const device = { parts: [{ value: '5' }, { choice: PERM[1] }, { choice: PERM[3 + 1] }, { texts: ['mango'] }] }
    const back = answerFromLabels(story, device, PERM)
    expect(back).toEqual({ parts: [{ value: '5' }, { choice: 1 }, { choice: 1 }, { texts: ['mango'] }] })
    expect(checkAnswer(keyOf(story), back).status).toBe('correct')
    expect(answerToLabels(story, back, PERM)).toEqual(device)
  })

  it('a label from another part does not count as a right answer', () => {
    const device = { parts: [{ value: '5' }, { choice: PERM[3 + 1] }, { choice: PERM[1] }, { texts: ['mango'] }] }
    const back = answerFromLabels(story, device, PERM) as { parts: { choice?: number }[] }
    expect(back.parts[1]!.choice).toBe(-1)
    expect(back.parts[2]!.choice).toBe(-1)
    expect(checkAnswer(keyOf(story), back).status).toBe('wrong')
  })

  it('maps a listen answer', () => {
    const perm: LabelPerm = [2, 0, 1]
    const device = { choice: perm[1] }
    expect(answerFromLabels(listen, device, perm)).toEqual({ choice: 1 })
    expect(answerToLabels(listen, { choice: 1 }, perm)).toEqual(device)
  })
})

describe('semanticProblems for new types', () => {
  const edit = (it: Item, patch: Record<string, unknown>): Item => itemSchema.parse({ ...(it as object), ...patch })

  it('passes the well-formed examples', () => {
    for (const it of [story, listen, tiles, spell, cloze, hotspot, label, table, magic, sudoku, photo]) expect(semanticProblems(it)).toEqual([])
  })

  it('listen: the prompt must not contain the audio text', () => {
    expect(semanticProblems(edit(listen, { prompt: 'Listen: I can see a cat on the mat. Which animal?' })).join()).toContain('listenText')
  })

  it('spell: the prompt must not contain the word', () => {
    expect(semanticProblems(edit(spell, { prompt: 'Spell the word hat.' })).join()).toContain('eja')
    expect(semanticProblems(edit(spell, { prompt: 'Spell the word that you hear.' }))).toEqual([])
  })

  it('tiles: alternatives use the same words, distractors differ', () => {
    expect(semanticProblems(edit(tiles, { alternatives: ['we eat fish and bread'] })).join()).toContain('berbeda')
    expect(semanticProblems(edit(tiles, { distractors: ['Rice'] })).join()).toContain('sama dengan kata')
    expect(semanticProblems(edit(tiles, { answer: 'we eat' })).join()).toContain('3 sampai 9')
  })

  it('cloze: gap count must match', () => {
    expect(semanticProblems(edit(cloze, { prompt: 'She ___ to school.' })).join()).toContain('titik kosong')
  })

  it('hotspot: answers in range, regions apart and inside the picture', () => {
    expect(semanticProblems(edit(hotspot, { answers: [5] })).join()).toContain('answers')
    expect(semanticProblems(edit(hotspot, { regions: [{ label: 'a', x: 30, y: 30, w: 30, h: 30 }, { label: 'b', x: 35, y: 35, w: 30, h: 30 }] })).join()).toContain('terlalu dekat')
    expect(semanticProblems(edit(hotspot, { regions: [{ label: 'a', x: 95, y: 30, w: 30, h: 30 }, { label: 'b', x: 35, y: 80, w: 30, h: 30 }] })).join()).toContain('keluar')
  })

  it('label: labels match spots and are unique', () => {
    expect(semanticProblems(edit(label, { extraLabels: ['Root'] })).join()).toContain('kembar')
    expect(semanticProblems(edit(label, { labels: ['root', 'stem'] })).join()).toContain('tidak sama')
  })

  it('table: blank cells must be empty and listed', () => {
    expect(semanticProblems(edit(table, { rows: [['Cat', '4'], ['Bird', '2'], ['Spider', '']] })).join()).toContain('dikosongkan')
    expect(semanticProblems(edit(table, { rows: [['Cat', ''], ['Bird', ''], ['Spider', '']] })).join()).toContain('tidak ada di blanks')
  })

  it('grid: needs exactly one solution that follows the rules', () => {
    expect(semanticProblems(edit(magic, { given: [[0, 0, 0], [0, 5, 0], [0, 0, 0]] })).join()).toContain('tepat satu')
    expect(semanticProblems(edit(magic, { filled: [[2, 7, 6], [9, 5, 1], [4, 8, 3]] })).join()).toContain('aturan')
    expect(semanticProblems(edit(sudoku, { size: 3 })).join()).toContain('tidak bisa')
  })

  it('bans dashes in the new text fields', () => {
    expect(semanticProblems(edit(listen, { listenText: 'I can see a cat — on the mat.' })).join()).toContain('em dash')
    expect(semanticProblems(edit(table, { caption: 'Legs – count' })).join()).toContain('en dash')
  })
})

describe('answerText', () => {
  it('writes the key for each new type', () => {
    expect(answerText(story)).toBe('1. 5; 2. Sam; 3. 7; 4. mango')
    expect(answerText(listen)).toContain('B. cat')
    expect(answerText(tiles)).toBe('we eat rice and fish')
    expect(answerText(spell)).toBe('hat')
    expect(answerText(cloze)).toBe('walks, meets')
    expect(answerText(hotspot)).toBe('box')
    expect(answerText(label)).toBe('1. root; 2. stem; 3. leaf')
    expect(answerText(table)).toBe('2, 8')
    expect(answerText(magic)).toBe('2 7 6 / 9 5 1 / 4 3 8')
    expect(answerText(photo)).toBe('Marked by your tutor')
  })
})
