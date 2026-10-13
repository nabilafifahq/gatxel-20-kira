import { Figure, FIGURE_KINDS, figureSpec, type FigureKind, type FigureSpecInput } from '@kira/figures'

export const dynamic = 'force-dynamic'

type Sample = { note: string; spec: FigureSpecInput }

/** Bentuk L dari 12 persegi: kolom 1 dan 2 di baris 1 sampai 4, ditambah kolom 3 dan 4 di baris 3 dan 4. */
const L_SHAPE: [number, number][] = [[1, 1], [1, 2], [2, 1], [2, 2], [3, 1], [3, 2], [4, 1], [4, 2], [3, 3], [3, 4], [4, 3], [4, 4]]

const LONG_PATTERN: FigureSpecInput = {
  kind: 'pattern',
  items: [
    ...Array.from({ length: 13 }, (_, i) => (i % 3 === 0 ? { shape: 'star' as const, tone: 'star' as const } : { shape: 'square' as const, tone: 'science' as const })),
    null,
  ],
  alt: 'Star, square, square repeating, then a blank.',
}

/** Contoh realistis untuk setiap jenis figur, termasuk kasus tepi (label panjang, banyak benda, desimal, negatif). */
const SAMPLES: Record<FigureKind, Sample[]> = {
  array: [
    { note: '4 rows of 5', spec: { kind: 'array', rows: 4, cols: 5, icon: 'apple', alt: '4 rows of 5 apples.' } },
    { note: 'highlightRows 2', spec: { kind: 'array', rows: 3, cols: 6, icon: 'star', highlightRows: 2, alt: '3 rows of 6 stars, the first 2 rows highlighted.' } },
    { note: '10 by 10, highlight 3', spec: { kind: 'array', rows: 10, cols: 10, icon: 'dot', highlightRows: 3, alt: '10 rows of 10 dots, 3 rows highlighted.' } },
    { note: '2 by 12', spec: { kind: 'array', rows: 2, cols: 12, icon: 'egg', alt: '2 rows of 12 eggs.' } },
  ],
  groups: [
    { note: 'plates', spec: { kind: 'groups', groups: [3, 3, 3], icon: 'cookie', container: 'plate', alt: '3 plates with 3 cookies on each.' } },
    { note: 'bags, highlightGroups 2', spec: { kind: 'groups', groups: [4, 4, 4, 4, 4], icon: 'sweet', container: 'bag', highlightGroups: 2, alt: '5 bags with 4 sweets in each, 2 bags highlighted.' } },
    { note: 'baskets', spec: { kind: 'groups', groups: [5, 5], icon: 'apple', container: 'basket', alt: '2 baskets with 5 apples in each.' } },
    { note: 'boxes', spec: { kind: 'groups', groups: [6, 6, 6], icon: 'egg', container: 'box', alt: '3 boxes with 6 eggs in each.' } },
    { note: '10 circles', spec: { kind: 'groups', groups: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2], icon: 'marble', alt: '10 groups of 2 marbles.' } },
    { note: 'unequal and empty', spec: { kind: 'groups', groups: [12, 7, 0], icon: 'button', container: 'circle', alt: 'Three circles with 12, 7 and 0 buttons.' } },
  ],
  objects: [
    { note: 'two kinds', spec: { kind: 'objects', items: [{ icon: 'apple', count: 4 }, { icon: 'pear', count: 2 }], alt: '4 apples and 2 pears.' } },
    { note: 'crossed out', spec: { kind: 'objects', items: [{ icon: 'balloon', count: 9, crossed: 3 }], alt: '9 balloons, 3 are crossed out.' } },
    { note: '17 and 6', spec: { kind: 'objects', items: [{ icon: 'fish', count: 17, crossed: 5 }, { icon: 'shell', count: 6 }], alt: '17 fish with 5 crossed out, and 6 shells.' } },
  ],
  numberline: [
    { note: 'step 2, one jump', spec: { kind: 'numberline', min: 0, max: 20, step: 2, labels: 'all', jumps: [{ from: 4, to: 10 }], alt: 'A number line from 0 to 20 with a jump from 4 to 10.' } },
    { note: 'labelled jumps, missing', spec: { kind: 'numberline', min: 0, max: 10, step: 1, jumps: [{ from: 3, to: 5, label: '+2' }, { from: 5, to: 9, label: '+4' }], missing: [7], alt: 'A number line from 0 to 10. Jumps of 2 and 4 from 3. The number 7 is missing.' } },
    { note: 'ends only, marks', spec: { kind: 'numberline', min: 0, max: 100, step: 10, labels: 'ends', marks: [{ at: 40, label: 'A' }, { at: 75, label: 'B' }], alt: 'A number line from 0 to 100 with A at 40 and B at 75.' } },
    { note: 'negatives, missing', spec: { kind: 'numberline', min: -10, max: 10, step: 2, missing: [-4, 6], alt: 'A number line from minus 10 to 10 with two missing numbers.' } },
    { note: 'decimals, chosen labels', spec: { kind: 'numberline', min: 0, max: 1, step: 0.1, labels: [0, 0.5, 1], marks: [{ at: 0.3, label: '?' }], alt: 'A number line from 0 to 1 in tenths with a mark at 0.3.' } },
    { note: 'backward jump', spec: { kind: 'numberline', min: 20, max: 40, step: 5, jumps: [{ from: 35, to: 25, label: '−10' }], alt: 'A number line from 20 to 40 with a jump back from 35 to 25.' } },
    { note: '0 to 100 in ones', spec: { kind: 'numberline', min: 0, max: 100, step: 1, alt: 'A number line from 0 to 100 marked in ones.' } },
  ],
  clock: [
    { note: 'half past 3', spec: { kind: 'clock', h: 3, m: 30, alt: 'A clock showing half past 3.' } },
    { note: 'no numbers', spec: { kind: 'clock', h: 9, m: 0, showNumbers: false, alt: 'A clock without numbers showing 9 o clock.' } },
    { note: '15:45 digital', spec: { kind: 'clock', h: 15, m: 45, digital: true, alt: 'A clock showing quarter to 4, and 15:45.' } },
    { note: '11:55', spec: { kind: 'clock', h: 11, m: 55, alt: 'A clock showing 5 minutes to 12.' } },
    { note: '00:05 digital', spec: { kind: 'clock', h: 0, m: 5, digital: true, alt: 'A clock showing 5 minutes past midnight.' } },
    { note: '6:20 digital', spec: { kind: 'clock', h: 6, m: 20, digital: true, alt: 'A clock showing 20 minutes past 6.' } },
  ],
  shape: [
    { note: 'rectangle, right angles', spec: { kind: 'shape', shape: 'rectangle', sideLabels: ['6 cm', '3 cm'], showRightAngles: true, alt: 'A rectangle 6 cm long and 3 cm wide.' } },
    { note: 'right triangle', spec: { kind: 'shape', shape: 'right-triangle', sideLabels: ['4 cm', '5 cm', '3 cm'], showRightAngles: true, tone: 'english', alt: 'A right-angled triangle with sides 3 cm, 4 cm and 5 cm.' } },
    { note: 'hexagon, vertical symmetry', spec: { kind: 'shape', shape: 'hexagon', lineOfSymmetry: 'vertical', tone: 'science', alt: 'A hexagon with a vertical line of symmetry.' } },
    { note: 'square, horizontal symmetry', spec: { kind: 'shape', shape: 'square', sideLabels: ['5 cm'], showRightAngles: true, lineOfSymmetry: 'horizontal', alt: 'A square with 5 cm sides and a horizontal line of symmetry.' } },
    { note: 'circle radius', spec: { kind: 'shape', shape: 'circle', sideLabels: ['3 cm'], alt: 'A circle with a radius of 3 cm.' } },
    { note: 'kite', spec: { kind: 'shape', shape: 'kite', lineOfSymmetry: 'vertical', tone: 'star', alt: 'A kite with a vertical line of symmetry.' } },
    { note: 'trapezium, 4 labels', spec: { kind: 'shape', shape: 'trapezium', sideLabels: ['10 cm', '4 cm', '6 cm', '4 cm'], alt: 'A trapezium with sides 10 cm, 4 cm, 6 cm and 4 cm.' } },
    { note: 'semicircle', spec: { kind: 'shape', shape: 'semicircle', sideLabels: ['8 cm'], tone: 'warn', alt: 'A semicircle with a straight edge of 8 cm.' } },
    { note: 'parallelogram', spec: { kind: 'shape', shape: 'parallelogram', sideLabels: ['7 cm', '4 cm'], tone: 'muted', alt: 'A parallelogram with sides 7 cm and 4 cm.' } },
    { note: 'rhombus', spec: { kind: 'shape', shape: 'rhombus', sideLabels: ['5 cm', '5 cm', '5 cm', '5 cm'], lineOfSymmetry: 'horizontal', alt: 'A rhombus with 5 cm sides.' } },
    { note: 'pentagon, octagon style', spec: { kind: 'shape', shape: 'octagon', tone: 'ink', alt: 'An octagon.' } },
    { note: 'star', spec: { kind: 'shape', shape: 'star', tone: 'star', lineOfSymmetry: 'vertical', alt: 'A star with a vertical line of symmetry.' } },
  ],
  shapes: [
    { note: '2D set 1', spec: { kind: 'shapes', items: [{ shape: 'circle', label: 'circle' }, { shape: 'semicircle', label: 'semicircle' }, { shape: 'oval', label: 'oval' }, { shape: 'square', label: 'square' }, { shape: 'rectangle', label: 'rectangle' }, { shape: 'triangle', label: 'triangle' }, { shape: 'right-triangle', label: 'right-angled triangle' }, { shape: 'pentagon', label: 'pentagon' }], alt: 'Eight 2D shapes with their names.' } },
    { note: '2D set 2', spec: { kind: 'shapes', items: [{ shape: 'hexagon', label: 'hexagon' }, { shape: 'octagon', label: 'octagon' }, { shape: 'rhombus', label: 'rhombus' }, { shape: 'trapezium', label: 'trapezium' }, { shape: 'parallelogram', label: 'parallelogram' }, { shape: 'kite', label: 'kite' }, { shape: 'star', label: 'star', tone: 'star' }], alt: 'Seven 2D shapes with their names.' } },
    { note: 'solids', spec: { kind: 'shapes', items: [{ shape: 'cube', label: 'cube' }, { shape: 'cuboid', label: 'cuboid' }, { shape: 'sphere', label: 'sphere' }, { shape: 'cylinder', label: 'cylinder' }, { shape: 'cone', label: 'cone' }, { shape: 'square-pyramid', label: 'pyramid' }, { shape: 'triangular-prism', label: 'prism' }], alt: 'Seven 3D shapes with their names.' } },
    { note: 'mcq letters', spec: { kind: 'shapes', items: [{ shape: 'triangle', label: 'A' }, { shape: 'square', label: 'B' }, { shape: 'cube', label: 'C' }, { shape: 'hexagon', label: 'D', tone: 'english' }], alt: 'Shape A is a triangle, B a square, C a cube and D a hexagon.' } },
  ],
  solid: [
    { note: 'cube', spec: { kind: 'solid', solid: 'cube', label: 'cube', alt: 'A cube with 6 square faces.' } },
    { note: 'cuboid', spec: { kind: 'solid', solid: 'cuboid', alt: 'A cuboid.' } },
    { note: 'sphere', spec: { kind: 'solid', solid: 'sphere', alt: 'A sphere.' } },
    { note: 'cylinder', spec: { kind: 'solid', solid: 'cylinder', label: 'cylinder', alt: 'A cylinder.' } },
    { note: 'cone', spec: { kind: 'solid', solid: 'cone', alt: 'A cone with a circular base.' } },
    { note: 'square pyramid', spec: { kind: 'solid', solid: 'square-pyramid', label: 'square-based pyramid', alt: 'A square-based pyramid.' } },
    { note: 'triangular prism', spec: { kind: 'solid', solid: 'triangular-prism', alt: 'A triangular prism.' } },
  ],
  grid: [
    { note: '3 by 4, 2 shaded', spec: { kind: 'grid', rows: 3, cols: 4, shaded: [[0, 0], [0, 1]], alt: 'A 3 by 4 grid with 2 squares shaded.' } },
    { note: 'L shape with units', spec: { kind: 'grid', rows: 6, cols: 6, shaded: L_SHAPE, showUnits: true, alt: 'An L shape made of 12 shaded squares on a 6 by 6 grid.' } },
    { note: '12 by 12 science', spec: { kind: 'grid', rows: 12, cols: 12, shaded: [[2, 2], [2, 3], [3, 2], [3, 3], [8, 8], [8, 9], [9, 8], [9, 9], [9, 10], [10, 10]], tone: 'science', alt: 'A 12 by 12 grid with two shaded shapes.' } },
    { note: 'star tone', spec: { kind: 'grid', rows: 4, cols: 10, shaded: [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1]], tone: 'star', alt: 'A 4 by 10 grid with 7 squares shaded.' } },
  ],
  fraction: [
    { note: 'circle 1/4', spec: { kind: 'fraction', shape: 'circle', parts: 4, shaded: 1, label: '1/4', alt: 'A circle cut into 4 equal parts with 1 part shaded.' } },
    { note: 'bar 3/8', spec: { kind: 'fraction', shape: 'bar', parts: 8, shaded: 3, label: '3/8', alt: 'A bar cut into 8 equal parts with 3 parts shaded.' } },
    { note: 'square 4/9', spec: { kind: 'fraction', shape: 'square', parts: 9, shaded: 4, alt: 'A square cut into 9 equal parts with 4 shaded.' } },
    { note: 'square sixths, label ?', spec: { kind: 'fraction', shape: 'square', parts: 6, shaded: 5, label: '?', alt: 'A square cut into 6 equal parts with 5 shaded.' } },
    { note: 'circle thirds', spec: { kind: 'fraction', shape: 'circle', parts: 3, shaded: 2, alt: 'A circle cut into 3 equal parts with 2 shaded.' } },
    { note: 'bar halves, word label', spec: { kind: 'fraction', shape: 'bar', parts: 2, shaded: 1, label: 'one half', alt: 'A bar cut in half with one half shaded.' } },
    { note: 'circle 7/12', spec: { kind: 'fraction', shape: 'circle', parts: 12, shaded: 7, alt: 'A circle cut into 12 equal parts with 7 shaded.' } },
  ],
  bars: [
    { note: 'two bars', spec: { kind: 'bars', categories: ['Mon', 'Tue'], values: [4, 7], step: 1, yLabel: 'Books', alt: 'Bar chart: Monday 4 books, Tuesday 7 books.' } },
    { note: 'title, step 2', spec: { kind: 'bars', title: 'Favourite fruit', categories: ['Apple', 'Banana', 'Mango', 'Orange', 'Strawberry'], values: [6, 4, 9, 3, 5], step: 2, yLabel: 'Children', alt: 'Bar chart of favourite fruit: apple 6, banana 4, mango 9, orange 3, strawberry 5.' } },
    { note: 'horizontal', spec: { kind: 'bars', horizontal: true, categories: ['Cat', 'Dog', 'Rabbit', 'Fish'], values: [12, 18, 5, 9], step: 5, yLabel: 'Number of pets', tone: 'science', alt: 'Horizontal bar chart: cat 12, dog 18, rabbit 5, fish 9.' } },
    { note: '8 months, axisMax', spec: { kind: 'bars', categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'], values: [120, 90, 150, 60, 200, 180, 30, 75], axisMax: 200, step: 20, yLabel: 'Rainfall (mm)', alt: 'Rainfall from January to August.' } },
    { note: 'halves', spec: { kind: 'bars', categories: ['Red', 'Blue', 'Green'], values: [2.5, 4, 1.5], step: 0.5, tone: 'english', alt: 'Bar chart: red 2.5, blue 4, green 1.5.' } },
  ],
  pictogram: [
    { note: 'one row, key 2', spec: { kind: 'pictogram', rows: [{ label: 'Red', count: 3 }], icon: 'star', key: 2, alt: 'Pictogram: red has 3 stars, each star means 2 children.' } },
    { note: 'halves', spec: { kind: 'pictogram', title: 'Books read this week', rows: [{ label: 'Aisha', count: 4 }, { label: 'Budi', count: 2.5 }, { label: 'Citra', count: 6 }, { label: 'Dimas', count: 1.5 }], icon: 'book', key: 2, alt: 'Pictogram of books read: Aisha 8, Budi 5, Citra 12, Dimas 3.' } },
    { note: '20 icons wrap', spec: { kind: 'pictogram', title: 'Stickers collected', rows: [{ label: 'Class 2A', count: 20 }, { label: 'Class 2B with a long name', count: 13.5 }, { label: 'Class 2C', count: 6 }], icon: 'star', key: 5, alt: 'Stickers collected by three classes.' } },
    { note: 'key 10, quarter', spec: { kind: 'pictogram', rows: [{ label: 'Monday', count: 7 }, { label: 'Tuesday', count: 10 }, { label: 'Wednesday', count: 3.25 }, { label: 'Thursday', count: 0 }, { label: 'Friday', count: 12 }], icon: 'apple', key: 10, alt: 'Apples sold each day.' } },
  ],
  tally: [
    { note: 'one row', spec: { kind: 'tally', rows: [{ label: 'Cats', count: 7 }], alt: 'Tally chart: cats 7.' } },
    { note: 'four rows', spec: { kind: 'tally', rows: [{ label: 'Red', count: 12 }, { label: 'Blue', count: 5 }, { label: 'Green', count: 23 }, { label: 'Yellow', count: 0 }], alt: 'Tally chart: red 12, blue 5, green 23, yellow 0.' } },
    { note: '40 marks', spec: { kind: 'tally', rows: [{ label: 'Sunny days', count: 40 }, { label: 'Rainy days', count: 3 }], alt: 'Tally chart: 40 sunny days and 3 rainy days.' } },
  ],
  table: [
    { note: 'animals', spec: { kind: 'table', head: ['Animal', 'Legs'], rows: [['Spider', '8'], ['Bird', '2'], ['Cat', '4'], ['Ant', '6']], alt: 'Table of animals and legs.' } },
    { note: 'timetable with ?', spec: { kind: 'table', caption: 'Bus timetable', head: ['Stop', 'Bus A', 'Bus B'], rows: [['School', '08:15', '09:40'], ['Market', '08:32', '?'], ['Park', '08:50', '10:15']], alt: 'Bus timetable for school, market and park.' } },
    { note: 'yes and no', spec: { kind: 'table', head: ['Material', 'Magnetic?', 'Conductor?'], rows: [['Iron nail', 'Yes', 'Yes'], ['Plastic spoon', 'No', 'No'], ['Copper wire', 'No', 'Yes'], ['Wooden ruler', 'No', '']], alt: 'Table of materials, magnetic and conductor.' } },
    { note: '7 columns', spec: { kind: 'table', caption: 'Weather this week', head: ['Day', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], rows: [['Rain (mm)', '12', '0', '4', '?', '25', '8'], ['Highest (\u00B0C)', '31', '33', '32', '30', '29', '31'], ['Sky', 'cloudy', 'sunny', 'sunny', 'stormy', 'rainy', 'cloudy']], alt: 'Weather table for six days.' } },
    { note: 'long text wraps', spec: { kind: 'table', head: ['Habitat', 'What lives there'], rows: [['Pond', 'Frogs, ducks, water snails and dragonfly larvae'], ['Desert', 'Camels, lizards and cactus plants']], alt: 'Table of habitats and what lives there.' } },
  ],
  basetens: [
    { note: '134', spec: { kind: 'basetens', hundreds: 1, tens: 3, ones: 4, alt: '1 hundred, 3 tens and 4 ones.' } },
    { note: '47', spec: { kind: 'basetens', tens: 4, ones: 7, alt: '4 tens and 7 ones.' } },
    { note: '2315', spec: { kind: 'basetens', thousands: 2, hundreds: 3, tens: 1, ones: 5, alt: '2 thousands, 3 hundreds, 1 ten and 5 ones.' } },
    { note: '999', spec: { kind: 'basetens', hundreds: 9, tens: 9, ones: 9, alt: '9 hundreds, 9 tens and 9 ones.' } },
    { note: '13 tens, 16 ones', spec: { kind: 'basetens', tens: 13, ones: 16, alt: '13 tens and 16 ones.' } },
    { note: 'largest, two rows', spec: { kind: 'basetens', thousands: 9, hundreds: 9, tens: 19, ones: 19, alt: '9 thousands, 9 hundreds, 19 tens and 19 ones.' } },
  ],
  money: [
    { note: 'notes and coins', spec: { kind: 'money', items: [{ value: 5000, count: 2 }, { value: 1000, count: 3 }], alt: 'Two Rp5.000 notes and three Rp1.000 coins.' } },
    { note: 'all notes', spec: { kind: 'money', items: [{ value: 100000, count: 1 }, { value: 50000, count: 1 }, { value: 20000, count: 2 }, { value: 10000, count: 1 }, { value: 2000, count: 3 }], alt: 'Notes worth Rp100.000, Rp50.000, two Rp20.000, Rp10.000 and three Rp2.000.' } },
    { note: 'all coins', spec: { kind: 'money', items: [{ value: 100, count: 4 }, { value: 200, count: 2 }, { value: 500, count: 3 }, { value: 1000, count: 1 }], alt: 'Coins: four Rp100, two Rp200, three Rp500 and one Rp1.000.' } },
  ],
  ruler: [
    { note: 'pencil 9 cm', spec: { kind: 'ruler', lengthCm: 15, objectCm: 9, object: 'pencil', alt: 'A pencil next to a ruler, from 0 to 9 cm.' } },
    { note: 'crayon from 2 cm', spec: { kind: 'ruler', lengthCm: 10, objectCm: 6.5, objectStartCm: 2, object: 'crayon', alt: 'A crayon from 2 cm to 8.5 cm.' } },
    { note: '30 cm, feather', spec: { kind: 'ruler', lengthCm: 30, objectCm: 22, object: 'feather', alt: 'A feather 22 cm long next to a 30 cm ruler.' } },
    { note: '5 cm, nail', spec: { kind: 'ruler', lengthCm: 5, objectCm: 3.5, object: 'nail', alt: 'A nail 3.5 cm long.' } },
    { note: 'leaf', spec: { kind: 'ruler', lengthCm: 12, objectCm: 7, objectStartCm: 1, object: 'leaf', alt: 'A leaf from 1 cm to 8 cm.' } },
    { note: 'ribbon, no icon', spec: { kind: 'ruler', lengthCm: 20, objectCm: 12, objectStartCm: 3, alt: 'A ribbon from 3 cm to 15 cm.' } },
    { note: 'caterpillar', spec: { kind: 'ruler', lengthCm: 10, objectCm: 4, object: 'caterpillar', alt: 'A caterpillar 4 cm long.' } },
    { note: 'key', spec: { kind: 'ruler', lengthCm: 15, objectCm: 8, object: 'key', alt: 'A key 8 cm long.' } },
    { note: 'spoon', spec: { kind: 'ruler', lengthCm: 15, objectCm: 13, object: 'spoon', alt: 'A spoon 13 cm long.' } },
    { note: 'worm', spec: { kind: 'ruler', lengthCm: 10, objectCm: 7.5, objectStartCm: 1, object: 'worm', alt: 'A worm from 1 cm to 8.5 cm.' } },
    { note: 'paperclip', spec: { kind: 'ruler', lengthCm: 6, objectCm: 3, object: 'paperclip', alt: 'A paperclip 3 cm long.' } },
    { note: 'other icon (shell)', spec: { kind: 'ruler', lengthCm: 10, objectCm: 5, object: 'shell', alt: 'A shell 5 cm long.' } },
  ],
  thermometer: [
    { note: '25 degrees', spec: { kind: 'thermometer', min: -10, max: 40, value: 25, step: 10, alt: 'A thermometer showing 25 degrees Celsius.' } },
    { note: '0 to 100', spec: { kind: 'thermometer', min: 0, max: 100, value: 37, step: 10, alt: 'A thermometer showing 37 degrees Celsius.' } },
    { note: 'below zero, step 5', spec: { kind: 'thermometer', min: -20, max: 20, value: -6, step: 5, alt: 'A thermometer showing minus 6 degrees Celsius.' } },
  ],
  scale: [
    { note: '600 g', spec: { kind: 'scale', max: 1000, value: 600, step: 100, unit: 'g', alt: 'Scales showing 600 g.' } },
    { note: '2.5 kg', spec: { kind: 'scale', max: 5, value: 2.5, step: 0.5, unit: 'kg', alt: 'Scales showing 2.5 kg.' } },
    { note: '1250 g', spec: { kind: 'scale', max: 2000, value: 1250, step: 250, unit: 'g', alt: 'Scales showing 1,250 g.' } },
    { note: '350 g of 500', spec: { kind: 'scale', max: 500, value: 350, step: 50, unit: 'g', alt: 'Scales showing 350 g.' } },
  ],
  jug: [
    { note: '400 ml', spec: { kind: 'jug', capacity: 1000, value: 400, step: 100, unit: 'ml', alt: 'A jug with 400 ml of water.' } },
    { note: '1.5 l', spec: { kind: 'jug', capacity: 2, value: 1.5, step: 0.5, unit: 'l', alt: 'A jug with 1.5 litres of water.' } },
    { note: '250 of 500 ml', spec: { kind: 'jug', capacity: 500, value: 250, step: 50, unit: 'ml', alt: 'A jug with 250 ml of water.' } },
    { note: 'step 250', spec: { kind: 'jug', capacity: 1000, value: 750, step: 250, unit: 'ml', alt: 'A jug with 750 ml of water.' } },
  ],
  sequence: [
    { note: 'stones', spec: { kind: 'sequence', items: ['1', '3', '5', null], style: 'stones', alt: 'Stones numbered 1, 3, 5 and one blank stone.' } },
    { note: 'boxes', spec: { kind: 'sequence', items: ['2', '4', '6', '8', null, '12'], style: 'boxes', alt: 'Boxes 2, 4, 6, 8, blank, 12.' } },
    { note: 'circles', spec: { kind: 'sequence', items: ['100', '90', null, '70', '60'], style: 'circles', alt: 'Circles 100, 90, blank, 70, 60.' } },
    { note: '12 items wrap', spec: { kind: 'sequence', items: ['5', '10', '15', '20', '25', null, '35', '40', '45', null, '55', '60'], alt: 'Counting in 5s with two blanks.' } },
    { note: 'long words', spec: { kind: 'sequence', items: ['Monday', 'Tuesday', null, 'Thursday'], style: 'boxes', alt: 'Days of the week with one missing.' } },
  ],
  pattern: [
    { note: 'shapes', spec: { kind: 'pattern', items: [{ shape: 'circle' }, { shape: 'square' }, { shape: 'circle' }, { shape: 'square' }, null], alt: 'Circle, square, circle, square, blank.' } },
    { note: 'colour pattern', spec: { kind: 'pattern', items: [{ shape: 'circle', tone: 'english' }, { shape: 'circle', tone: 'math' }, { shape: 'circle', tone: 'english' }, { shape: 'circle', tone: 'math' }, { shape: 'circle', tone: 'english' }, null], alt: 'Red, blue, red, blue, red, blank.' } },
    { note: 'icons', spec: { kind: 'pattern', items: [{ icon: 'apple' }, { icon: 'banana' }, { icon: 'banana' }, { icon: 'apple' }, { icon: 'banana' }, { icon: 'banana' }, null], alt: 'Apple, banana, banana, apple, banana, banana, blank.' } },
    { note: 'every tone', spec: { kind: 'pattern', items: [{ shape: 'triangle', tone: 'math' }, { shape: 'triangle', tone: 'english' }, { shape: 'triangle', tone: 'science' }, { shape: 'triangle', tone: 'warn' }, { shape: 'triangle', tone: 'star' }, { shape: 'triangle', tone: 'muted' }, { shape: 'triangle', tone: 'ink' }], alt: 'Seven triangles in different colours.' } },
    { note: '14 items wrap', spec: LONG_PATTERN },
  ],
  venn: [
    { note: 'animals', spec: { kind: 'venn', sets: ['Can fly', 'Has legs'], items: [{ text: 'bird', region: 'both' }, { text: 'bee', region: 'both' }, { text: 'plane', region: 'a' }, { text: 'kite', region: 'a' }, { text: 'dog', region: 'b' }, { text: 'cat', region: 'b' }, { text: 'table', region: 'b' }, { text: 'fish', region: 'none' }, { text: 'snake', region: 'none' }], alt: 'Venn diagram of things that can fly and things that have legs.' } },
    { note: 'numbers', spec: { kind: 'venn', sets: ['Multiples of 2', 'Multiples of 5'], items: [{ text: '2', region: 'a' }, { text: '4', region: 'a' }, { text: '6', region: 'a' }, { text: '8', region: 'a' }, { text: '10', region: 'both' }, { text: '20', region: 'both' }, { text: '5', region: 'b' }, { text: '15', region: 'b' }, { text: '25', region: 'b' }, { text: '3', region: 'none' }, { text: '?', region: 'both' }], alt: 'Venn diagram of multiples of 2 and multiples of 5.' } },
    { note: 'empty', spec: { kind: 'venn', sets: ['Even numbers', 'Numbers greater than 10'], alt: 'An empty Venn diagram for even numbers and numbers greater than 10.' } },
  ],
  carroll: [
    { note: 'numbers', spec: { kind: 'carroll', cols: ['Even', 'Not even'], rows: ['Less than 10', 'Not less than 10'], cells: [['4'], ['7'], ['12'], ['15']], alt: 'Carroll diagram of even numbers and numbers less than 10.' } },
    { note: 'animals', spec: { kind: 'carroll', cols: ['Mammal', 'Not a mammal'], rows: ['Lives in water', 'Does not live in water'], cells: [['whale', 'dolphin'], ['shark', 'crab', 'frog'], ['cat', 'cow', 'rabbit', 'monkey', 'camel'], ['bird', 'ant', '?']], alt: 'Carroll diagram of mammals and animals that live in water.' } },
  ],
  coordinates: [
    { note: 'one point', spec: { kind: 'coordinates', size: 6, points: [{ x: 2, y: 3, label: 'A' }], alt: 'Point A at (2, 3).' } },
    { note: 'rectangle polygon', spec: { kind: 'coordinates', size: 8, points: [{ x: 1, y: 1, label: 'A' }, { x: 6, y: 1, label: 'B' }, { x: 6, y: 5, label: 'C' }, { x: 1, y: 5, label: 'D' }], polygon: true, alt: 'Rectangle ABCD with A at (1, 1) and C at (6, 5).' } },
    { note: 'four quadrants', spec: { kind: 'coordinates', size: 5, quadrants: 4, points: [{ x: -3, y: 2, label: 'P' }, { x: 4, y: -1, label: 'Q' }, { x: -2, y: -4, label: 'R' }, { x: 5, y: 5, label: 'S' }], alt: 'Points P (-3, 2), Q (4, -1), R (-2, -4) and S (5, 5).' } },
    { note: '10, four quadrants, triangle', spec: { kind: 'coordinates', size: 10, quadrants: 4, points: [{ x: -6, y: -4, label: 'A' }, { x: 8, y: -4, label: 'B' }, { x: 2, y: 7, label: 'C' }], polygon: true, alt: 'Triangle ABC on a grid from minus 10 to 10.' } },
    { note: 'size 12', spec: { kind: 'coordinates', size: 12, points: [{ x: 0, y: 0, label: 'O' }, { x: 12, y: 12, label: 'T' }, { x: 3, y: 9 }], alt: 'Points on a 12 by 12 grid.' } },
  ],
  angle: [
    { note: 'right angle', spec: { kind: 'angle', degrees: 90, alt: 'A right angle.' } },
    { note: '60 with label', spec: { kind: 'angle', degrees: 60, label: '60°', alt: 'An angle of 60 degrees.' } },
    { note: 'obtuse, letter', spec: { kind: 'angle', degrees: 135, label: 'a', alt: 'An obtuse angle a.' } },
    { note: 'protractor 45', spec: { kind: 'angle', degrees: 45, showProtractor: true, alt: 'A protractor measuring an angle of 45 degrees.' } },
    { note: 'protractor 120 ?', spec: { kind: 'angle', degrees: 120, label: '?', showProtractor: true, alt: 'A protractor measuring an angle of 120 degrees.' } },
    { note: 'reflex 270', spec: { kind: 'angle', degrees: 270, label: 'x', alt: 'A reflex angle of 270 degrees.' } },
    { note: 'small 15', spec: { kind: 'angle', degrees: 15, label: '15°', alt: 'An angle of 15 degrees.' } },
  ],
  icons: [
    { note: 'frog life cycle', spec: { kind: 'icons', items: [{ icon: 'egg', label: 'egg' }, { icon: 'tadpole', label: 'tadpole' }, { icon: 'frog', label: 'frog' }], arrows: 'cycle', alt: 'Life cycle of a frog.' } },
    { note: 'butterfly cycle', spec: { kind: 'icons', items: [{ icon: 'egg', label: 'egg' }, { icon: 'caterpillar', label: 'caterpillar' }, { icon: 'chrysalis', label: 'chrysalis' }, { icon: 'butterfly', label: 'butterfly' }], arrows: 'cycle', alt: 'Life cycle of a butterfly.' } },
    { note: 'water cycle 5', spec: { kind: 'icons', items: [{ icon: 'sea', label: 'sea' }, { icon: 'steam', label: 'evaporation' }, { icon: 'cloud', label: 'condensation' }, { icon: 'rain', label: 'rain' }, { icon: 'river', label: 'river' }], arrows: 'cycle', alt: 'The water cycle.' } },
    { note: 'food chain', spec: { kind: 'icons', items: [{ icon: 'grass', label: 'grass' }, { icon: 'caterpillar', label: 'caterpillar' }, { icon: 'bird', label: 'bird' }, { icon: 'cat', label: 'cat' }], arrows: 'chain', alt: 'Food chain: grass, caterpillar, bird, cat.' } },
    { note: 'senses, no arrows', spec: { kind: 'icons', items: [{ icon: 'eye', label: 'see' }, { icon: 'ear', label: 'hear' }, { icon: 'nose', label: 'smell' }, { icon: 'tongue', label: 'taste' }, { icon: 'hand', label: 'touch' }], alt: 'The five senses.' } },
    { note: 'chain of 7 wraps', spec: { kind: 'icons', items: [{ icon: 'seed', label: 'seed' }, { icon: 'seedling', label: 'seedling' }, { icon: 'plant', label: 'young plant' }, { icon: 'flower', label: 'flower' }, { icon: 'bee', label: 'pollination' }, { icon: 'apple', label: 'fruit' }, { icon: 'seed', label: 'new seeds' }], arrows: 'chain', alt: 'From seed to fruit in seven steps.' } },
  ],
  circuit: [
    { note: 'lit bulb, closed switch', spec: { kind: 'circuit', parts: ['battery', 'bulb-lit', 'switch-closed'], alt: 'A circuit with a battery, a lit bulb and a closed switch.' } },
    { note: 'open switch', spec: { kind: 'circuit', parts: ['battery', 'bulb', 'switch-open'], alt: 'A circuit with a battery, a bulb and an open switch.' } },
    { note: 'symbols', spec: { kind: 'circuit', parts: ['battery', 'bulb-lit', 'switch-closed'], symbols: true, alt: 'Circuit diagram with a cell, a lit lamp and a closed switch.' } },
    { note: 'symbols, 6 parts', spec: { kind: 'circuit', parts: ['battery', 'bulb', 'buzzer', 'motor', 'switch-open', 'battery'], symbols: true, alt: 'Circuit diagram with two batteries, a lamp, a buzzer, a motor and an open switch.' } },
    { note: 'gap', spec: { kind: 'circuit', parts: ['battery', 'bulb', 'gap'], alt: 'A circuit with a battery, a bulb and a gap in the wire.' } },
    { note: 'motor and buzzer', spec: { kind: 'circuit', parts: ['battery', 'motor', 'buzzer', 'switch-closed'], alt: 'A circuit with a battery, a motor, a buzzer and a closed switch.' } },
  ],
  balance: [
    { note: 'level with ?', spec: { kind: 'balance', left: ['3', '4'], right: ['?'], tilt: 'level', alt: 'A balance with 3 and 4 on the left and a missing number on the right.' } },
    { note: 'level 10 = 6 + ?', spec: { kind: 'balance', left: ['10'], right: ['6', '?'], alt: 'A level balance with 10 on the left and 6 and a missing number on the right.' } },
    { note: 'right heavier', spec: { kind: 'balance', left: ['5', '5', '5'], right: ['20'], tilt: 'right', alt: 'A balance with three 5s on the left and 20 on the right. The right side is lower.' } },
    { note: 'masses, left heavier', spec: { kind: 'balance', left: ['1 kg', '500 g'], right: ['1 kg'], tilt: 'left', alt: 'A balance with 1 kg and 500 g on the left and 1 kg on the right. The left side is lower.' } },
    { note: 'wide blocks', spec: { kind: 'balance', left: ['250 g', '250 g', '500 g', '100 g'], right: ['1 kg', '?'], tilt: 'right', alt: 'A balance with four masses on the left and 1 kg and a missing mass on the right.' } },
    { note: '6 blocks', spec: { kind: 'balance', left: ['1', '2', '3', '4', '5', '6'], right: ['21'], alt: 'A level balance with 1 to 6 on the left and 21 on the right.' } },
  ],
  scene: [
    {
      note: 'plant with soil',
      spec: {
        kind: 'scene',
        width: 320,
        height: 260,
        shapes: [
          { t: 'rect', x: 0, y: 190, w: 320, h: 70, tone: 'warn' },
          { t: 'line', x1: 160, y1: 190, x2: 160, y2: 80, tone: 'science', width: 6 },
          { t: 'ellipse', cx: 205, cy: 140, rx: 38, ry: 15, rot: -30, tone: 'science', fill: 'solid' },
          { t: 'ellipse', cx: 115, cy: 120, rx: 38, ry: 15, rot: 30, tone: 'science', fill: 'solid' },
          { t: 'circle', cx: 160, cy: 62, r: 24, tone: 'star' },
          { t: 'line', x1: 160, y1: 190, x2: 120, y2: 235, tone: 'warn', width: 3 },
          { t: 'line', x1: 160, y1: 190, x2: 200, y2: 235, tone: 'warn', width: 3 },
          { t: 'icon', icon: 'sun', x: 262, y: 8, size: 48 },
        ],
        alt: 'A plant with a yellow flower, a straight stem, two green leaves and roots in brown soil, with a sun in the corner.',
      },
    },
  ],
}

export default async function FigureGallery({ searchParams }: { searchParams: Promise<{ kind?: string | string[] }> }) {
  // ?kind=clock,ruler menampilkan jenis tertentu saja; nilai lain diabaikan
  const raw = (await searchParams).kind
  const wanted = (Array.isArray(raw) ? raw.join(',') : (raw ?? '')).split(',').filter((k): k is FigureKind => (FIGURE_KINDS as string[]).includes(k))
  const kinds = wanted.length ? wanted : FIGURE_KINDS
  return (
    <main className="mx-auto max-w-[1180px] p-4 sm:p-8">
      <h1 className="text-h1 font-bold">Figur</h1>
      <p className="mt-2 text-small text-fg-muted">
        {FIGURE_KINDS.length} jenis figur, setiap contoh divalidasi dengan skema FigureSpec sebelum dirender.
      </p>
      <nav className="mt-4 flex flex-wrap gap-2 text-small" aria-label="Jenis figur">
        <a href="?" className="rounded-pill border border-divider bg-surface px-3 py-1">semua</a>
        {FIGURE_KINDS.map((kind) => (
          <a key={kind} href={`?kind=${kind}`} aria-current={kinds.length === 1 && kinds[0] === kind ? 'page' : undefined} className="rounded-pill border border-divider bg-surface px-3 py-1">
            {kind}
          </a>
        ))}
      </nav>
      {kinds.map((kind) => (
        <section key={kind} id={kind} className="mt-10">
          <h2 className="text-h2 font-bold">{kind}</h2>
          <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
            {SAMPLES[kind].map((sample, i) => {
              const parsed = figureSpec.safeParse(sample.spec)
              return (
                <figure key={i} className="m-0 flex flex-col justify-between gap-3 rounded-card border border-divider bg-surface p-4">
                  {parsed.success ? (
                    <div className="flex justify-center">
                      <Figure spec={parsed.data} />
                    </div>
                  ) : (
                    <pre className="text-small whitespace-pre-wrap text-danger">{parsed.error.message}</pre>
                  )}
                  <figcaption className="text-small text-fg-muted">
                    {kind}: {sample.note}
                  </figcaption>
                </figure>
              )
            })}
          </div>
        </section>
      ))}
    </main>
  )
}
