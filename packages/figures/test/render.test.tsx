import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Figure, figureBox, FIGURE_KINDS, figureSpec, MATH, MATH_50, type FigureKind, type FigureSpec, type FigureSpecInput } from '../src'
import { digitalText, handAngles } from '../src/render/clock'
import { fmt, rupiah, textWidth, wrapText } from '../src/render/kit'
import { gaugeScale, minorPer, ticksBetween } from '../src/render/gauges'

/** Dua contoh realistis atau lebih untuk setiap jenis figur. */
const SAMPLES: Record<FigureKind, FigureSpecInput[]> = {
  array: [
    { kind: 'array', rows: 4, cols: 5, icon: 'apple', alt: '4 rows of 5 apples.' },
    { kind: 'array', rows: 3, cols: 6, icon: 'star', highlightRows: 2, alt: '3 rows of 6 stars, 2 rows highlighted.' },
    { kind: 'array', rows: 12, cols: 12, icon: 'dot', alt: '12 rows of 12 dots.' },
  ],
  groups: [
    { kind: 'groups', groups: [3, 3, 3], icon: 'cookie', container: 'plate', alt: '3 plates with 3 cookies on each.' },
    { kind: 'groups', groups: [4, 4, 4, 4, 4], icon: 'sweet', container: 'bag', highlightGroups: 2, alt: '5 bags with 4 sweets in each.' },
    { kind: 'groups', groups: [5, 5], icon: 'apple', container: 'basket', alt: '2 baskets with 5 apples in each.' },
    { kind: 'groups', groups: [6, 6, 6], icon: 'egg', container: 'box', alt: '3 boxes with 6 eggs in each.' },
    { kind: 'groups', groups: [20, 0], icon: 'marble', alt: 'One circle with 20 marbles and an empty circle.' },
  ],
  objects: [
    { kind: 'objects', items: [{ icon: 'apple', count: 4 }, { icon: 'pear', count: 2 }], alt: '4 apples and 2 pears.' },
    { kind: 'objects', items: [{ icon: 'balloon', count: 9, crossed: 3 }], alt: '9 balloons, 3 crossed out.' },
    { kind: 'objects', items: [{ icon: 'fish', count: 20, crossed: 5 }, { icon: 'shell', count: 6 }], alt: '20 fish with 5 crossed out and 6 shells.' },
  ],
  numberline: [
    { kind: 'numberline', min: 0, max: 20, step: 2, labels: 'all', jumps: [{ from: 4, to: 10 }], alt: 'A number line from 0 to 20 with a jump from 4 to 10.' },
    { kind: 'numberline', min: 0, max: 10, step: 1, jumps: [{ from: 3, to: 5, label: '+2' }], missing: [7], alt: 'A number line from 0 to 10 with 7 missing.' },
    { kind: 'numberline', min: -10, max: 10, step: 2, labels: 'ends', marks: [{ at: -4, label: 'A' }], alt: 'A number line from minus 10 to 10 with A at minus 4.' },
    { kind: 'numberline', min: 0, max: 1, step: 0.1, labels: [0, 0.5, 1], alt: 'A number line from 0 to 1 in tenths.' },
    { kind: 'numberline', min: 0, max: 100, step: 1, alt: 'A number line from 0 to 100 in ones.' },
  ],
  clock: [
    { kind: 'clock', h: 3, m: 30, alt: 'A clock showing half past 3.' },
    { kind: 'clock', h: 15, m: 45, digital: true, alt: 'A clock showing 15:45.' },
    { kind: 'clock', h: 9, m: 0, showNumbers: false, alt: 'A clock without numbers at 9 o clock.' },
  ],
  shape: [
    { kind: 'shape', shape: 'rectangle', sideLabels: ['6 cm', '3 cm'], showRightAngles: true, alt: 'A rectangle 6 cm long and 3 cm wide.' },
    { kind: 'shape', shape: 'hexagon', lineOfSymmetry: 'vertical', tone: 'science', alt: 'A hexagon with a vertical line of symmetry.' },
    { kind: 'shape', shape: 'circle', sideLabels: ['3 cm'], alt: 'A circle with a radius of 3 cm.' },
    { kind: 'shape', shape: 'right-triangle', sideLabels: ['4 cm', '5 cm', '3 cm'], showRightAngles: true, alt: 'A right-angled triangle.' },
  ],
  shapes: [
    { kind: 'shapes', items: [{ shape: 'triangle' }, { shape: 'cube' }], alt: 'A triangle and a cube.' },
    { kind: 'shapes', items: [{ shape: 'circle', label: 'A' }, { shape: 'square', label: 'B' }, { shape: 'pentagon', label: 'C' }, { shape: 'oval', label: 'D' }, { shape: 'cone', label: 'E', tone: 'english' }], alt: 'Five shapes labelled A to E.' },
  ],
  solid: [
    { kind: 'solid', solid: 'cube', label: 'cube', alt: 'A cube with 6 faces.' },
    { kind: 'solid', solid: 'cylinder', alt: 'A cylinder standing up.' },
    { kind: 'solid', solid: 'square-pyramid', alt: 'A square-based pyramid.' },
    { kind: 'solid', solid: 'triangular-prism', alt: 'A triangular prism.' },
    { kind: 'solid', solid: 'cone', alt: 'A cone with a round base.' },
    { kind: 'solid', solid: 'sphere', alt: 'A sphere like a ball.' },
    { kind: 'solid', solid: 'cuboid', alt: 'A cuboid like a box.' },
  ],
  grid: [
    { kind: 'grid', rows: 3, cols: 4, shaded: [[0, 0], [0, 1]], alt: 'A 3 by 4 grid with 2 squares shaded.' },
    { kind: 'grid', rows: 6, cols: 6, shaded: [[1, 1], [2, 1], [3, 1], [3, 2]], showUnits: true, tone: 'science', alt: 'An L shape of 4 squares on a 6 by 6 grid.' },
  ],
  fraction: [
    { kind: 'fraction', shape: 'circle', parts: 4, shaded: 1, label: '1/4', alt: 'A circle cut into 4 equal parts with 1 part shaded.' },
    { kind: 'fraction', shape: 'bar', parts: 8, shaded: 3, alt: 'A bar cut into 8 equal parts with 3 shaded.' },
    { kind: 'fraction', shape: 'square', parts: 9, shaded: 4, label: '?', alt: 'A square cut into 9 equal parts with 4 shaded.' },
  ],
  bars: [
    { kind: 'bars', categories: ['Mon', 'Tue'], values: [4, 7], step: 1, yLabel: 'Books', alt: 'Bar chart: Monday 4 books, Tuesday 7 books.' },
    { kind: 'bars', title: 'Pets', horizontal: true, categories: ['Cat', 'Dog', 'Rabbit'], values: [12, 18, 5], step: 5, yLabel: 'Children', tone: 'science', alt: 'Horizontal bar chart of pets.' },
    { kind: 'bars', categories: ['Red', 'Blue', 'Green'], values: [2.5, 4, 1.5], step: 0.5, alt: 'Bar chart with halves.' },
  ],
  pictogram: [
    { kind: 'pictogram', rows: [{ label: 'Red', count: 3 }], icon: 'star', key: 2, alt: 'Pictogram: red has 3 stars, each star means 2 children.' },
    { kind: 'pictogram', title: 'Books read', rows: [{ label: 'Aisha', count: 4 }, { label: 'Budi', count: 2.5 }, { label: 'Citra', count: 0 }], icon: 'book', key: 2, alt: 'Pictogram of books read.' },
  ],
  tally: [
    { kind: 'tally', rows: [{ label: 'Cats', count: 7 }], alt: 'Tally chart: cats 7.' },
    { kind: 'tally', rows: [{ label: 'Red', count: 12 }, { label: 'Blue', count: 0 }, { label: 'Green', count: 40 }], alt: 'Tally chart: red 12, blue 0, green 40.' },
  ],
  table: [
    { kind: 'table', head: ['Animal', 'Legs'], rows: [['Spider', '8'], ['Bird', '2']], alt: 'Table of animals and legs.' },
    { kind: 'table', caption: 'Bus timetable', head: ['Stop', 'Bus A', 'Bus B'], rows: [['School', '08:15', '?'], ['Market and park', '08:32', '09:50']], alt: 'Bus timetable with one missing time.' },
  ],
  basetens: [
    { kind: 'basetens', hundreds: 1, tens: 3, ones: 4, alt: '1 hundred, 3 tens and 4 ones.' },
    { kind: 'basetens', thousands: 2, hundreds: 3, tens: 1, ones: 5, alt: '2 thousands, 3 hundreds, 1 ten and 5 ones.' },
    { kind: 'basetens', thousands: 9, hundreds: 9, tens: 19, ones: 19, alt: 'The largest set of base ten blocks.' },
  ],
  money: [
    { kind: 'money', items: [{ value: 5000, count: 2 }, { value: 1000, count: 3 }], alt: 'Two Rp5.000 notes and three Rp1.000 coins.' },
    { kind: 'money', items: [{ value: 100000, count: 1 }, { value: 100, count: 4 }, { value: 500, count: 2 }], alt: 'One Rp100.000 note and six coins.' },
  ],
  ruler: [
    { kind: 'ruler', lengthCm: 15, objectCm: 9, object: 'pencil', alt: 'A pencil next to a ruler, from 0 to 9 cm.' },
    { kind: 'ruler', lengthCm: 10, objectCm: 6.5, objectStartCm: 2, alt: 'A ribbon from 2 cm to 8.5 cm.' },
    { kind: 'ruler', lengthCm: 30, objectCm: 22, object: 'shell', alt: 'A shell strip 22 cm long.' },
  ],
  thermometer: [
    { kind: 'thermometer', min: -10, max: 40, value: 25, step: 10, alt: 'A thermometer showing 25 degrees Celsius.' },
    { kind: 'thermometer', min: -20, max: 20, value: -6, step: 5, alt: 'A thermometer showing minus 6 degrees Celsius.' },
  ],
  scale: [
    { kind: 'scale', max: 1000, value: 600, step: 100, unit: 'g', alt: 'Scales showing 600 g.' },
    { kind: 'scale', max: 5, value: 2.5, step: 0.5, unit: 'kg', alt: 'Scales showing 2.5 kg.' },
  ],
  jug: [
    { kind: 'jug', capacity: 1000, value: 400, step: 100, unit: 'ml', alt: 'A jug with 400 ml of water.' },
    { kind: 'jug', capacity: 2, value: 1.5, step: 0.5, unit: 'l', alt: 'A jug with 1.5 litres of water.' },
    { kind: 'jug', capacity: 500, value: 0, step: 50, unit: 'ml', alt: 'An empty 500 ml jug.' },
  ],
  sequence: [
    { kind: 'sequence', items: ['1', '3', '5', null], style: 'stones', alt: 'Stones numbered 1, 3, 5 and one blank stone.' },
    { kind: 'sequence', items: ['100', '90', null, '70'], style: 'circles', alt: 'Circles 100, 90, blank, 70.' },
    { kind: 'sequence', items: ['5', '10', '15', '20', '25', null, '35', '40', '45', null, '55', '60'], alt: 'Counting in 5s with two blanks.' },
  ],
  pattern: [
    { kind: 'pattern', items: [{ shape: 'circle' }, { shape: 'square' }, { shape: 'circle' }, null], alt: 'Circle, square, circle, blank.' },
    { kind: 'pattern', items: [{ shape: 'circle', tone: 'english' }, { shape: 'circle', tone: 'science' }, { icon: 'apple' }, null], alt: 'Red circle, green circle, apple, blank.' },
  ],
  venn: [
    { kind: 'venn', sets: ['Can fly', 'Has legs'], items: [{ text: 'bird', region: 'both' }, { text: 'plane', region: 'a' }, { text: 'dog', region: 'b' }, { text: 'fish', region: 'none' }], alt: 'Venn diagram of flying things and things with legs.' },
    { kind: 'venn', sets: ['Even numbers', 'Greater than 10'], alt: 'An empty Venn diagram.' },
  ],
  carroll: [
    { kind: 'carroll', cols: ['Even', 'Not even'], rows: ['Less than 10', 'Not less than 10'], cells: [['4'], ['7'], ['12'], ['15']], alt: 'Carroll diagram of even numbers.' },
    { kind: 'carroll', cols: ['Mammal', 'Not a mammal'], rows: ['Lives in water', 'Does not live in water'], cells: [['whale'], ['shark', 'crab'], ['cat', 'cow', 'rabbit'], ['?']], alt: 'Carroll diagram of animals.' },
  ],
  coordinates: [
    { kind: 'coordinates', size: 6, points: [{ x: 2, y: 3, label: 'A' }], alt: 'Point A at (2, 3).' },
    { kind: 'coordinates', size: 5, quadrants: 4, polygon: true, points: [{ x: -3, y: 2, label: 'P' }, { x: 4, y: -1, label: 'Q' }, { x: -2, y: -4, label: 'R' }], alt: 'Triangle PQR on four quadrants.' },
  ],
  angle: [
    { kind: 'angle', degrees: 90, alt: 'A right angle.' },
    { kind: 'angle', degrees: 45, showProtractor: true, label: '?', alt: 'A protractor measuring 45 degrees.' },
    { kind: 'angle', degrees: 270, label: 'x', alt: 'A reflex angle of 270 degrees.' },
    { kind: 'angle', degrees: 5, label: '5°', alt: 'A very small angle of 5 degrees.' },
  ],
  icons: [
    { kind: 'icons', items: [{ icon: 'egg', label: 'egg' }, { icon: 'tadpole', label: 'tadpole' }, { icon: 'frog', label: 'frog' }], arrows: 'cycle', alt: 'Life cycle of a frog.' },
    { kind: 'icons', items: [{ icon: 'grass' }, { icon: 'rabbit' }, { icon: 'lion' }], arrows: 'chain', alt: 'Food chain: grass, rabbit, lion.' },
    { kind: 'icons', items: Array.from({ length: 7 }, () => ({ icon: 'seed' as const, label: 'seed' })), arrows: 'chain', alt: 'A chain of seven seeds.' },
  ],
  circuit: [
    { kind: 'circuit', parts: ['battery', 'bulb-lit', 'switch-closed'], alt: 'A circuit with a battery, a lit bulb and a closed switch.' },
    { kind: 'circuit', parts: ['battery', 'bulb', 'buzzer', 'motor', 'switch-open', 'gap'], symbols: true, alt: 'Circuit diagram with an open switch and a gap.' },
  ],
  balance: [
    { kind: 'balance', left: ['3', '4'], right: ['?'], tilt: 'level', alt: 'A balance with 3 and 4 on the left and a missing number.' },
    { kind: 'balance', left: ['5', '5', '5'], right: ['20'], tilt: 'right', alt: 'A balance tipped to the right.' },
  ],
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
}

function render(spec: FigureSpec): string {
  return renderToStaticMarkup(<Figure spec={spec} />)
}

function viewBoxOf(html: string): [number, number] {
  const m = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(html)
  expect(m).not.toBeNull()
  return [Number(m![1]), Number(m![2])]
}

const count = (html: string, needle: string): number => html.split(needle).length - 1

describe('Figure: setiap jenis', () => {
  it('punya paling sedikit dua contoh untuk setiap jenis di FIGURE_KINDS', () => {
    for (const kind of FIGURE_KINDS) expect(SAMPLES[kind]?.length ?? 0, kind).toBeGreaterThanOrEqual(2)
  })

  for (const kind of FIGURE_KINDS) {
    describe(kind, () => {
      SAMPLES[kind].forEach((input, i) => {
        it(`contoh ${i + 1} dirender menjadi satu svg yang bisa diakses`, () => {
          const spec = figureSpec.parse(input)
          const html = render(spec)
          expect(html.startsWith('<svg')).toBe(true)
          expect(count(html, '<svg')).toBe(1)
          expect(html).toContain('role="img"')
          expect(html).toContain(`aria-label="${esc(spec.alt)}"`)
          expect(html).toContain(`<title>${esc(spec.alt)}</title>`)
          expect(html).not.toMatch(/NaN|Infinity|undefined/)
          expect(html).not.toContain('data-fallback')
          const [w, h] = viewBoxOf(html)
          expect(w).toBeGreaterThan(40)
          expect(h).toBeGreaterThan(40)
          expect(w).toBeLessThanOrEqual(900)
          expect(figureBox(spec)).toEqual({ width: w, height: h })
        })
      })
    })
  }
})

describe('Figure: perilaku umum', () => {
  it('mengalir 100% dengan maxWidth bawaan selebar ukuran alami', () => {
    const spec = figureSpec.parse(SAMPLES.array[0])
    const html = render(spec)
    const { width } = figureBox(spec)
    expect(html).toContain('width:100%')
    expect(html).toContain(`max-width:${width}px`)
    expect(html).toContain('height:auto')
    const custom = renderToStaticMarkup(<Figure spec={spec} maxWidth={240} className="mx-auto" />)
    expect(custom).toContain('max-width:240px')
    expect(custom).toContain('class="mx-auto"')
  })

  it('tetap aman untuk spec yang belum melewati parse (nilai bawaan kosong)', () => {
    const raw = [
      { kind: 'numberline', min: 0, max: 10, step: 1, alt: 'A number line from 0 to 10.' },
      { kind: 'clock', h: 7, m: 15, alt: 'A clock at quarter past 7.' },
      { kind: 'groups', groups: [2, 2], icon: 'apple', alt: 'Two groups of 2 apples.' },
      { kind: 'grid', rows: 2, cols: 3, alt: 'A 2 by 3 grid.' },
      { kind: 'sequence', items: ['1', null], alt: 'A sequence with a blank.' },
      { kind: 'venn', sets: ['A set', 'B set'], alt: 'An empty Venn diagram.' },
      { kind: 'basetens', tens: 2, alt: 'Two tens rods only.' },
      { kind: 'ruler', lengthCm: 10, objectCm: 4, alt: 'A ribbon 4 cm long.' },
      { kind: 'pattern', items: [{ shape: 'circle' }, null], alt: 'A circle and a blank.' },
      { kind: 'coordinates', size: 5, points: [], alt: 'An empty coordinate grid.' },
      { kind: 'icons', items: [{ icon: 'sun' }, { icon: 'moon' }], alt: 'The sun and the moon.' },
      { kind: 'circuit', parts: ['battery', 'bulb'], alt: 'A battery and a bulb.' },
      { kind: 'balance', left: ['1'], right: ['1'], alt: 'A level balance.' },
      { kind: 'shape', shape: 'square', alt: 'A plain square.' },
      { kind: 'bars', categories: ['A'], values: [3], alt: 'One bar of 3.' },
      { kind: 'pictogram', rows: [{ label: 'A', count: 2 }], icon: 'star', alt: 'A pictogram row.' },
    ] as unknown as FigureSpec[]
    for (const spec of raw) {
      const html = render(spec)
      expect(html, spec.kind).not.toMatch(/NaN|Infinity|undefined/)
      expect(html, spec.kind).not.toContain('data-fallback')
    }
  })

  it('memberi bingkai pengganti untuk jenis yang tidak dikenal, tanpa melempar galat', () => {
    const html = render({ kind: 'mystery', alt: 'Something unknown here.' } as unknown as FigureSpec)
    expect(html).toContain('data-fallback')
    expect(html).toContain('aria-label="Something unknown here."')
  })

  it('id pola dan clipPath unik untuk dua figur di halaman yang sama', () => {
    const spec = figureSpec.parse(SAMPLES.pattern[1])
    const html = renderToStaticMarkup(
      <div>
        <Figure spec={spec} />
        <Figure spec={spec} />
      </div>,
    )
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1])
    expect(ids.length).toBeGreaterThanOrEqual(2)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(html).toContain(`url(#${id})`)
  })
})

describe('Figure: isi sesuai data', () => {
  it('array menggambar baris x kolom ikon', () => {
    const html = render(figureSpec.parse({ kind: 'array', rows: 3, cols: 7, icon: 'apple', alt: '3 rows of 7 apples.' }))
    expect(count(html, 'scale(')).toBe(21)
  })

  it('objects mencoret benda terakhir sebanyak crossed', () => {
    const html = render(figureSpec.parse({ kind: 'objects', items: [{ icon: 'apple', count: 9, crossed: 4 }], alt: '9 apples, 4 crossed out.' }))
    expect(count(html, 'scale(')).toBe(9)
    expect(count(html, 'opacity="0.45"')).toBe(4)
  })

  it('jam: sudut jarum termasuk geseran jarum jam oleh menit', () => {
    expect(handAngles(3, 0)).toEqual({ hour: 90, minute: 0 })
    expect(handAngles(3, 30)).toEqual({ hour: 105, minute: 180 })
    expect(handAngles(15, 45)).toEqual({ hour: 112.5, minute: 270 })
    expect(handAngles(12, 0)).toEqual({ hour: 0, minute: 0 })
    expect(handAngles(0, 20)).toEqual({ hour: 10, minute: 120 })
    expect(digitalText(15, 5)).toBe('15:05')
    expect(digitalText(3, 30)).toBe('3:30')
    expect(digitalText(0, 5)).toBe('00:05')
  })

  it('jam setengah 4: jarum menit lurus ke bawah, jarum jam di antara 3 dan 4', () => {
    const html = render(figureSpec.parse({ kind: 'clock', h: 3, m: 30, alt: 'A clock showing half past 3.' }))
    const hand = (name: string): number[] => {
      const m = new RegExp(`data-hand="${name}" x1="([-\\d.]+)" y1="([-\\d.]+)" x2="([-\\d.]+)" y2="([-\\d.]+)"`).exec(html)
      expect(m, name).not.toBeNull()
      return m!.slice(1).map(Number)
    }
    const [mx1, my1, mx2, my2] = hand('minute')
    expect(Math.abs(mx2! - mx1!)).toBeLessThan(0.5)
    expect(my2!).toBeGreaterThan(my1!)
    const [hx1, hy1, hx2, hy2] = hand('hour')
    const deg = (Math.atan2(hx2! - hx1!, -(hy2! - hy1!)) * 180) / Math.PI
    expect(deg).toBeCloseTo(105, 0)
  })

  it('turus dikelompokkan lima: empat garis tegak dan satu garis miring', () => {
    const html = render(figureSpec.parse({ kind: 'tally', rows: [{ label: 'Cats', count: 13 }], alt: 'Tally chart: cats 13.' }))
    const d = /<path d="([^"]+)" stroke="#14202E" stroke-width="2.5" fill="none"/.exec(html)
    expect(d).not.toBeNull()
    expect(count(d![1]!, 'V')).toBe(4 * 2 + 3)
    expect(count(d![1]!, 'L')).toBe(2)
  })

  it('garis bilangan: satu tick per langkah dan kotak tanya untuk nilai hilang', () => {
    const html = render(figureSpec.parse({ kind: 'numberline', min: 0, max: 20, step: 2, missing: [6, 14], alt: 'A number line from 0 to 20 in twos.' }))
    expect(count(html, '<line')).toBe(1 + 11)
    expect(count(html, 'stroke-dasharray="4 5"')).toBe(2)
    expect(html).not.toMatch(/>6</)
    expect(html).toMatch(/>8</)
  })

  it('pecahan mengarsir sebanyak shaded dari parts', () => {
    for (const shape of ['bar', 'circle', 'square'] as const) {
      const html = render(figureSpec.parse({ kind: 'fraction', shape, parts: 6, shaded: 5, alt: 'Five sixths shaded.' }))
      expect(count(html, `fill="${MATH}"`), shape).toBe(5)
    }
  })

  it('basetens menggambar satu balok per keping', () => {
    const html = render(figureSpec.parse({ kind: 'basetens', thousands: 1, hundreds: 2, tens: 3, ones: 4, alt: '1234 in base ten blocks.' }))
    expect(count(html, `fill="${MATH_50}"`)).toBe(1 + 2 + 3 + 4)
  })

  it('uang: setiap koin dan lembar ditulis dengan format Rupiah', () => {
    const html = render(figureSpec.parse({ kind: 'money', items: [{ value: 5000, count: 2 }, { value: 1000, count: 3 }], alt: 'Two Rp5.000 notes and three Rp1.000 coins.' }))
    expect(count(html, '>Rp5.000<')).toBe(2)
    expect(count(html, '>Rp<')).toBe(3)
    expect(count(html, '>1.000<')).toBe(3)
  })

  it('piktogram memotong ikon untuk setengah', () => {
    const html = render(figureSpec.parse({ kind: 'pictogram', rows: [{ label: 'A', count: 2.5 }, { label: 'B', count: 3 }], icon: 'star', key: 2, alt: 'A pictogram with a half star.' }))
    expect(count(html, '<clipPath')).toBe(1)
    expect(html).toContain('>Key:<')
    expect(html).toContain('>= 2<')
  })

  it('koordinat: satu titik per data dan label di dekatnya', () => {
    const html = render(figureSpec.parse({ kind: 'coordinates', size: 6, points: [{ x: 1, y: 1, label: 'A' }, { x: 5, y: 4, label: 'B' }], alt: 'Points A and B.' }))
    expect(count(html, 'r="5.5"')).toBe(2)
    expect(html).toContain('>A<')
    expect(html).toContain('>B<')
  })

  it('urutan menandai item null dengan tanda tanya', () => {
    const html = render(figureSpec.parse({ kind: 'sequence', items: ['2', null, '6', null], alt: 'Two, blank, six, blank.' }))
    expect(count(html, '>?<')).toBe(2)
  })
})

describe('Figure: isi ekstrem tetap berukuran wajar', () => {
  const many = (n: number, t: string): string[] => Array.from({ length: n }, (_, i) => `${t}${i}`)
  const extremes: FigureSpecInput[] = [
    { kind: 'table', caption: 'A caption that is fairly long', head: many(7, 'Heading'), rows: Array.from({ length: 12 }, () => many(7, 'Some longer cell text ')), alt: 'Big table with seven columns.' },
    { kind: 'bars', title: 'Very long title for a chart', categories: many(8, 'Strawberry'), values: [1, 2, 3, 4, 5, 6, 7, 8], yLabel: 'Number of children', alt: 'Bars with long categories.' },
    { kind: 'tally', rows: Array.from({ length: 7 }, (_, i) => ({ label: `A very long label for a tally row ${i}`, count: 40 })), alt: 'Tally with long labels.' },
    { kind: 'pictogram', rows: Array.from({ length: 7 }, (_, i) => ({ label: `A long pictogram label ${i}`, count: 20 })), icon: 'apple', key: 100, alt: 'Pictogram with twenty icons.' },
    { kind: 'sequence', items: Array.from({ length: 12 }, () => '123456789012'), style: 'circles', alt: 'Sequence of long numbers.' },
    { kind: 'balance', left: many(6, 'ABCDEFGH'), right: many(6, 'ABCDEFGH'), tilt: 'left', alt: 'Balance with wide blocks.' },
    { kind: 'basetens', thousands: 9, hundreds: 9, tens: 19, ones: 19, alt: 'The largest base ten set.' },
    { kind: 'money', items: [100000, 50000, 20000, 10000, 5000, 2000].map((value) => ({ value: value as 2000, count: 10 })), alt: 'Sixty notes.' },
    { kind: 'groups', groups: Array.from({ length: 10 }, () => 20), icon: 'apple', container: 'plate', alt: 'Ten plates of twenty apples.' },
    { kind: 'ruler', lengthCm: 30, objectCm: 30, objectStartCm: 25, object: 'pencil', alt: 'A pencil sticking out past the ruler.' },
    { kind: 'icons', items: Array.from({ length: 8 }, () => ({ icon: 'apple' as const, label: 'A rather long label for an icon' })), arrows: 'cycle', alt: 'Eight icons in a cycle.' },
  ]
  for (const input of extremes) {
    it(`${input.kind} tidak lebih lebar dari 800`, () => {
      const box = figureBox(figureSpec.parse(input))
      expect(box.width).toBeLessThanOrEqual(800)
      expect(box.height).toBeLessThanOrEqual(2000)
    })
  }
})

describe('alat ukur: label di kelipatan rapi dari step', () => {
  it('menjarangkan label tanpa membuat angka ganjil', () => {
    expect(gaugeScale(50, 10, 12)).toEqual({ major: 10, base: 10 })
    expect(gaugeScale(100, 1, 12)).toEqual({ major: 10, base: 1 })
    expect(gaugeScale(1000, 10, 12)).toEqual({ major: 100, base: 10 })
    expect(gaugeScale(5000, 1, 12).major).toBe(500)
    expect(gaugeScale(2, 0.5, 12)).toEqual({ major: 0.5, base: 0.5 })
  })

  it('tick kecil memakai step penulis bila muat', () => {
    expect(minorPer(10, 1, 54, 4.5)).toBe(10)
    expect(minorPer(500, 10, 40, 5)).toBe(5)
    expect(minorPer(100, 100, 25, 5)).toBe(5)
  })

  it('tick mulai dari kelipatan, bukan dari nilai terkecil', () => {
    const t = ticksBetween(-15, 45, 10, 10)
    expect(t[0]).toMatchObject({ v: -15, kind: 'mid' })
    expect(t.filter((x) => x.kind === 'major').map((x) => x.v)).toEqual([-10, 0, 10, 20, 30, 40])
  })

  it('termometer -50 sampai 50 dengan step 1 diberi label setiap 10 derajat', () => {
    const html = render(figureSpec.parse({ kind: 'thermometer', min: -50, max: 50, value: 12, step: 1, alt: 'A thermometer from minus 50 to 50.' }))
    const labels = [...html.matchAll(/>([\u2212\d.,]+)</g)].map((m) => m[1]!)
    expect(labels).toEqual(['\u221250', '\u221240', '\u221230', '\u221220', '\u221210', '0', '10', '20', '30', '40', '50'])
  })
})

describe('kit', () => {
  it('format angka en-GB dan Rupiah', () => {
    expect(fmt(1250)).toBe('1,250')
    expect(fmt(-6)).toBe('−6')
    expect(fmt(0.1 + 0.2)).toBe('0.3')
    expect(fmt(2.5)).toBe('2.5')
    expect(rupiah(5000)).toBe('Rp5.000')
    expect(rupiah(100000)).toBe('Rp100.000')
    expect(rupiah(500)).toBe('Rp500')
  })

  it('lebar teks dan pembungkus kata', () => {
    expect(textWidth('00', 10)).toBeCloseTo(12, 5)
    const lines = wrapText('Frogs, ducks, water snails and dragonfly larvae', 120, 16, 600)
    expect(lines.length).toBeGreaterThan(1)
    for (const line of lines) expect(textWidth(line, 16, 600)).toBeLessThanOrEqual(120 + 1e-9)
  })
})
