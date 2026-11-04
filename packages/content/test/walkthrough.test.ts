import { describe, expect, it } from 'vitest'
import { animProblem, animResult, findEquation, parseEquation, type Anim } from '../src/anim'
import { semanticProblems, solutionProblems } from '../src/load'
import { GENERATORS, generateUncached, genRef } from '../src/math'
import { itemSchema, type Item } from '../src/schema'
import { animateSteps, deriveSteps, solutionReaches, splitSentences, withWalkthrough } from '../src/walkthrough'

const base = { skill: 'm3.test', difficulty: 2, hints: ['One.', 'Two.', 'Three.'], explanation: 'Add the two amounts to find the total.' }
const make = (extra: Record<string, unknown>): Item => itemSchema.parse({ id: 'm3.test.001', ...base, ...extra })

describe('parseEquation dan findEquation', () => {
  it('membaca persamaan, koma ribuan, dan tanda kali dan bagi', () => {
    expect(parseEquation('23 + 45 = 68')).toMatchObject({ a: 23, op: '+', b: 45, r: 68 })
    expect(parseEquation('1,250 − 250 = 1,000')).toMatchObject({ a: 1250, op: '-', b: 250, r: 1000 })
    expect(parseEquation('6 × 7 = 42')).toMatchObject({ op: '×' })
    expect(parseEquation('42 ÷ 6 = 7')).toMatchObject({ op: '÷' })
    expect(parseEquation('banyak kata')).toBeNull()
  })
  it('rupiah memakai titik ribuan', () => {
    expect(parseEquation('Rp5.000 - Rp3.500 = Rp1.500')).toMatchObject({ a: 5000, b: 3500, r: 1500, cur: 'Rp' })
    expect(findEquation('Her change is Rp5.000 - Rp3.500 = Rp1.500.')).toMatchObject({ r: 1500, cur: 'Rp' })
  })
})

describe('animProblem', () => {
  const ok: Anim[] = [
    { k: 'combine', a: 3, op: '+', b: 4, r: 7 },
    { k: 'column', op: '+', a: 345, b: 278, r: 623 },
    { k: 'bar', parts: [{ v: 5 }, { v: 7, q: true }], total: 12 },
    { k: 'line', min: 0, max: 20, start: 8, jumps: [5] },
    { k: 'seq', items: ['2', '4', '6'] },
    { k: 'lines', lines: ['3 + 4 = 7', '7 + 1 = 8'] },
  ]
  it('menerima gerakan yang benar', () => {
    for (const a of ok) expect(animProblem(a), JSON.stringify(a)).toBeNull()
  })
  it('menolak hitungan yang salah', () => {
    expect(animProblem({ k: 'combine', a: 3, op: '+', b: 4, r: 8 })).not.toBeNull()
    expect(animProblem({ k: 'column', op: '-', a: 500, b: 123, r: 378 })).not.toBeNull()
    expect(animProblem({ k: 'bar', parts: [{ v: 5 }, { v: 6 }], total: 12 })).not.toBeNull()
    expect(animProblem({ k: 'line', min: 0, max: 10, start: 8, jumps: [5] })).not.toBeNull()
    expect(animProblem({ k: 'lines', lines: ['3 + 4 = 7', '7 + 1 = 9'] })).not.toBeNull()
  })
  it('hasil gerakan', () => {
    expect(animResult(ok[2]!)).toBe(7)
    expect(animResult(ok[3]!)).toBe(13)
  })
})

describe('animateSteps dan withWalkthrough', () => {
  it('soal cerita jumlah menjadi model batang dan menyorot bilangan di soal', () => {
    const item = make({
      type: 'numeric',
      prompt: 'Aisha has 345 stickers and gets 278 more from her friend. How many stickers does she have now?',
      answer: 623,
      solution: [
        { say: 'Add the two amounts.', show: '345 + 278 = 623' },
        { say: 'Check by taking away.', show: '623 - 278 = 345' },
      ],
    })
    const out = withWalkthrough(item)
    expect(out.solution![0]!.anim).toMatchObject({ k: 'bar', total: 623 })
    expect(out.solution![0]!.mark).toEqual(['345', '278'])
    expect(out.solution![1]!.anim).toMatchObject({ k: 'combine' })
    expect(solutionProblems(out)).toEqual([])
    expect(solutionReaches(out)).toBe(true)
  })
  it('lompatan menjadi garis bilangan', () => {
    const item = make({ type: 'numeric', prompt: 'What is 8 + 5?', answer: 13, solution: [{ say: 'Make a jump of 5 from 8.', show: '8 + 5 = 13' }, { say: 'You land on 13.' }] })
    expect(withWalkthrough(item).solution![0]!.anim).toMatchObject({ k: 'line', start: 8, jumps: [5] })
  })
  it('langkah yang tidak menyebut jawaban ditutup dengan kunci', () => {
    const item = make({ type: 'numeric', prompt: 'What is 12 - 4?', answer: 8, solution: [{ say: 'Start with twelve.' }, { say: 'Take four away.' }] })
    expect(solutionReaches(item)).toBe(false)
    const out = withWalkthrough(item)
    expect(solutionReaches(out)).toBe(true)
    expect(out.solution!.at(-1)!.show).toBe('8')
  })
  it('tidak memasang gerakan pada persamaan yang salah', () => {
    const item = make({ type: 'numeric', prompt: 'What is 2 + 2?', answer: 4, solution: [{ say: 'Add.', show: '2 + 2 = 5' }, { say: 'Done.' }] })
    expect(animateSteps(item, item.solution!)[0]!.anim).toBeUndefined()
  })
  it('soal tanpa langkah mendapat penjelasan dari explanation, dan hasilnya sampai ke kunci', () => {
    const item = make({
      skill: 's3.test',
      type: 'mcq',
      prompt: 'Which part of a plant takes in water from the soil?',
      options: [{ text: 'Leaf', why: 'Leaves make food from light.' }, { text: 'Root' }, { text: 'Flower' }],
      answer: 1,
      explanation: 'Roots grow in the soil. They take in water and hold the plant in place.',
    })
    const steps = deriveSteps(item)!
    expect(steps.length).toBeGreaterThanOrEqual(3)
    expect(steps[0]!.mark).toEqual(['Which part of a plant takes in water from the soil?'])
    const out = withWalkthrough(item)
    expect(solutionReaches(out)).toBe(true)
    expect(semanticProblems(out)).toEqual([])
  })
  it('soal yang dinilai tutor tidak dibuatkan pembahasan', () => {
    const item = make({ type: 'write', prompt: 'Write one sentence about your day.', rubric: { criteria: [{ label: 'Sentence', points: 2 }] }, model: 'I read a book.' })
    expect(withWalkthrough(item).solution).toBeUndefined()
  })
})

describe('generator', () => {
  it('pembahasan semua generator sampai ke jawaban dan hitungan gerakannya benar', () => {
    let animated = 0
    let total = 0
    for (const [skill, g] of GENERATORS) {
      for (const level of g.levels) {
        for (let s = 0; s < 6; s++) {
          const item = generateUncached(genRef(skill, level, `w${s}`))
          total++
          expect(solutionProblems(item), `${skill} ${level} w${s}`).toEqual([])
          if (item.solution?.some((x) => x.anim)) animated++
        }
      }
    }
    // Cakupan: sepertiga lebih soal generator punya gerakan.
    expect(animated / total).toBeGreaterThan(0.3)
  })
})

describe('splitSentences', () => {
  it('tidak memotong titik di dalam angka', () => {
    expect(splitSentences('Two adults cost Rp90.000. Two children cost Rp50.000.')).toEqual(['Two adults cost Rp90.000.', 'Two children cost Rp50.000.'])
    expect(splitSentences('Pi is about 3.14. Use it.')).toEqual(['Pi is about 3.14.', 'Use it.'])
  })
  it('memisah dua kalimat biasa dan menjaga tanda tanya', () => {
    expect(splitSentences('Add the two amounts. What is the total?')).toEqual(['Add the two amounts.', 'What is the total?'])
    expect(splitSentences('No end mark')).toEqual(['No end mark'])
  })
})
