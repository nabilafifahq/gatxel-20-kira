/**
 * Menambah satu langkah "coba sendiri" dengan alat peraga (lesson.steps[].tool) dan, di beberapa pelajaran,
 * satu soal cek berjenis baru. Aman dijalankan ulang: langkah yang sudah ada dilewati.
 * Jalankan: pnpm exec tsx packages/content/scripts/peraga-lessons.ts
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { findContentDir } from '../src/load'

type Obj = Record<string, unknown>
const dir = findContentDir()

const plan: { file: string; step: Obj; check?: Obj }[] = [
  {
    file: 'math/g1/halves.json',
    step: { say: 'Your turn. Tap the parts to shade one half of the bar.', tool: { kind: 'fractionbar', bars: 1, split: 2 } },
  },
  {
    file: 'math/g1/shapes-2d.json',
    step: { say: 'Your turn. Pick a piece, turn it, and tap a place to fit it into the outline.', tool: { kind: 'tangram', pieces: ['L', 'L'] } },
    check: {
      id: 'm1.shapes-2d.903',
      skill: 'm1.shapes-2d',
      type: 'tangram',
      difficulty: 1,
      prompt: 'Fit the two large triangles into the outline.',
      pieces: ['L', 'L'],
      slots: [[[0, 0], [4, 0], [2, 2]], [[4, 0], [4, 4], [2, 2]]],
      hints: ['Both pieces are large triangles.', 'Turn a piece until its long edge faces the right way.', 'The two triangles meet in the middle of the shape.'],
      explanation: 'Two large triangles fit together to make a bigger triangle.',
    },
  },
  {
    file: 'math/g2/place-value.json',
    step: { say: 'Your turn. Show 63, then trade 10 ones for a ten and break a ten back into ones.', tool: { kind: 'blocks', blocks: { h: 0, t: 5, o: 13 } } },
    check: {
      id: 'm2.place-value.903',
      skill: 'm2.place-value',
      type: 'blocks',
      difficulty: 2,
      prompt: 'You have 5 tens and 13 ones. Trade so that the number is shown with the fewest blocks.',
      places: 'to',
      start: { h: 0, t: 5, o: 13 },
      target: { h: 0, t: 6, o: 3 },
      exact: true,
      hints: ['Look for 10 ones that can become a ten.', 'Tap Trade 10 for 1 ten in the ones column.', 'You should end with 6 tens and 3 ones.'],
      explanation: '5 tens and 13 ones is 63. Trading 10 ones for 1 ten leaves 6 tens and 3 ones.',
    },
  },
  {
    file: 'math/g3/place-value.json',
    step: { say: 'Your turn. Trade 10 tens for a hundred, then break a hundred back into tens.', tool: { kind: 'blocks', blocks: { h: 2, t: 12, o: 0 } } },
  },
  {
    file: 'math/g3/equivalent-fractions.json',
    step: { say: 'Your turn. Cut two bars into different numbers of parts and shade the same amount on both.', tool: { kind: 'fractionbar', bars: 2, split: 2 } },
    check: {
      id: 'm3.equivalent-fractions.903',
      skill: 'm3.equivalent-fractions',
      type: 'fractionbar',
      difficulty: 2,
      prompt: 'Bar 1 shows one half. Shade bar 2 so it shows the same amount.',
      rows: [{ den: 2, locked: 1 }, { den: 4 }],
      targets: [null, { num: 2, den: 4 }],
      hints: ['Look at how much of bar 1 is shaded.', 'Bar 2 has twice as many parts.', 'Shade 2 parts of bar 2.'],
      explanation: 'One half is the same as 2 quarters, because bar 2 has twice as many parts.',
    },
  },
  {
    file: 'math/g3/perimeter-area.json',
    step: { say: 'Your turn. Make a rectangle on the geoboard and watch the sides, perimeter and area change.', tool: { kind: 'geoboard', size: 6 } },
    check: {
      id: 'm3.perimeter-area.903',
      skill: 'm3.perimeter-area',
      type: 'geoboard',
      difficulty: 2,
      prompt: 'Make a rectangle with an area of 8 square units.',
      size: 6,
      rule: { shape: 'rectangle', area: 8 },
      example: [[0, 0], [4, 0], [4, 2], [0, 2]],
      hints: ['Area is the number of unit squares inside.', 'Multiply the length by the width.', 'A rectangle 4 long and 2 wide has an area of 8.'],
      explanation: 'A rectangle 4 units long and 2 units wide has an area of 4 times 2, which is 8 square units.',
    },
  },
  {
    file: 'math/g3/times-tables.json',
    step: { say: 'Your turn. Add two bars and give each one the right number of units.', tool: { kind: 'barmodel' } },
    check: {
      id: 'm3.times-tables.903',
      skill: 'm3.times-tables',
      type: 'barmodel',
      difficulty: 2,
      kind: 'compare',
      prompt: 'Ella has 4 times as many beads as Fay. Fay has 3 beads. Build the model and say what one unit is worth.',
      bars: [{ label: 'Fay', units: 1 }, { label: 'Ella', units: 4 }],
      extraLabels: ['Gus'],
      unitValue: 3,
      unitName: 'beads',
      hints: ['Fay has the smaller amount, so she gets 1 unit.', 'Ella has 4 times as many, so she gets 4 units.', 'One unit is the number of beads Fay has.'],
      explanation: 'Fay is 1 unit, which is 3 beads. Ella is 4 units, which is 4 groups of 3.',
    },
  },
  {
    file: 'math/g4/place-value.json',
    step: { say: 'Your turn. Show 1,250 with hundreds and tens, then trade or break blocks to show it another way.', tool: { kind: 'blocks', blocks: { h: 12, t: 5, o: 0 } } },
  },
]

for (const p of plan) {
  const path = join(dir, 'lessons', p.file)
  if (!existsSync(path)) throw new Error(`Tidak ada: ${p.file}`)
  const lesson = JSON.parse(readFileSync(path, 'utf8')) as { steps: Obj[]; check: Obj[] }
  if (!lesson.steps.some((s) => s.tool)) lesson.steps.push(p.step)
  if (p.check && !lesson.check.some((c) => c.id === p.check!.id)) lesson.check.push(p.check)
  writeFileSync(path, `${JSON.stringify(lesson, null, 2)}\n`)
}
console.log(`Diperbarui ${plan.length} pelajaran`)
