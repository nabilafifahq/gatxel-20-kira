import { z } from 'zod'

/**
 * FigureSpec: deskripsi figur sebagai data. Figur yang sama dirender di layar,
 * di pembahasan, dan di kertas cetak. Setiap figur wajib punya `alt`.
 * Ikon hanya boleh dari ICON_NAMES (digambar di src/icons).
 */

export const ICON_NAMES = [
  // makanan dan benda hitung
  'apple', 'pear', 'banana', 'orange', 'strawberry', 'cherry', 'grapes', 'watermelon', 'carrot', 'bread',
  'cookie', 'muffin', 'cake', 'sweet', 'ice-cream', 'egg', 'milk', 'rice', 'cheese', 'juice',
  'ball', 'marble', 'block', 'car', 'bus', 'boat', 'plane', 'bicycle', 'kite', 'balloon',
  'pencil', 'crayon', 'eraser', 'book', 'bag', 'plate', 'basket', 'box', 'jar', 'cup',
  'button', 'shell', 'coin', 'sock', 'hat', 'shoe', 'umbrella', 'key', 'clock', 'bell',
  // bentuk sederhana untuk array dan pola
  'dot', 'star', 'heart', 'square', 'circle', 'triangle', 'flower',
  // hewan
  'cat', 'dog', 'fish', 'bird', 'frog', 'tadpole', 'butterfly', 'caterpillar', 'chrysalis', 'bee',
  'ant', 'snail', 'worm', 'spider', 'ladybird', 'chick', 'hen', 'duck', 'cow', 'rabbit',
  'mouse', 'lion', 'elephant', 'monkey', 'snake', 'lizard', 'turtle', 'crab', 'whale', 'camel',
  'penguin', 'polar-bear', 'owl', 'bat', 'shark',
  // tumbuhan dan alam
  'plant', 'tree', 'leaf', 'seed', 'seedling', 'cactus', 'mushroom', 'grass', 'sun', 'moon',
  'earth', 'planet', 'cloud', 'rain', 'snowflake', 'rainbow', 'wind', 'lightning', 'rock', 'soil',
  'sand', 'water-drop', 'ice-cube', 'steam', 'puddle', 'volcano', 'mountain', 'river', 'fossil', 'feather',
  // bahan dan benda ilmiah
  'spoon', 'wooden-spoon', 'glass', 'bottle', 'paper', 'fabric', 'rubber-band', 'brick', 'nail', 'paperclip',
  'scissors', 'magnet', 'battery', 'bulb', 'switch', 'wire', 'torch', 'candle', 'mirror', 'kettle',
  'thermometer', 'drum', 'guitar', 'whistle', 'parachute', 'toy-car', 'ramp', 'spring', 'sponge', 'stone',
  // tubuh manusia dan kesehatan
  'eye', 'ear', 'nose', 'hand', 'tongue', 'tooth', 'heart-organ', 'lungs', 'brain', 'stomach',
  'bone', 'skeleton', 'muscle', 'toothbrush', 'soap', 'bed', 'running',
  // tempat
  'house', 'school', 'shop', 'park', 'pond', 'sea', 'desert', 'forest', 'arctic', 'farm',
] as const

export const iconName = z.enum(ICON_NAMES)
export type IconName = z.infer<typeof iconName>

export const AVATARS = ['fox', 'cat', 'owl', 'bear', 'rabbit', 'turtle', 'penguin', 'frog'] as const
export type AvatarName = (typeof AVATARS)[number]

/** Gambar PIN anak: 9 gambar, PIN memakai 4. */
export const PIN_PICTURES = ['sun', 'moon', 'star', 'cat', 'fish', 'tree', 'apple', 'boat', 'ball'] as const
export type PinPicture = (typeof PIN_PICTURES)[number]

const tone = z.enum(['math', 'english', 'science', 'warn', 'star', 'muted', 'ink'])
const short = z.string().min(1).max(60)
const alt = z.string().min(8).max(400)

const array = z.object({
  kind: z.literal('array'),
  rows: z.number().int().min(1).max(12),
  cols: z.number().int().min(1).max(12),
  icon: iconName,
  highlightRows: z.number().int().min(0).max(12).optional(),
  alt,
}).strict()

const groups = z.object({
  kind: z.literal('groups'),
  groups: z.array(z.number().int().min(0).max(20)).min(1).max(10),
  icon: iconName,
  container: z.enum(['plate', 'bag', 'box', 'basket', 'circle']).default('circle'),
  highlightGroups: z.number().int().min(0).max(10).optional(),
  alt,
}).strict()

const objects = z.object({
  kind: z.literal('objects'),
  items: z.array(z.object({ icon: iconName, count: z.number().int().min(1).max(20), crossed: z.number().int().min(0).max(20).optional() }).strict()).min(1).max(5),
  alt,
}).strict()

const numberline = z.object({
  kind: z.literal('numberline'),
  min: z.number(),
  max: z.number(),
  step: z.number().positive(),
  labels: z.union([z.literal('all'), z.literal('ends'), z.array(z.number())]).default('all'),
  marks: z.array(z.object({ at: z.number(), label: short.optional() }).strict()).max(10).optional(),
  jumps: z.array(z.object({ from: z.number(), to: z.number(), label: short.optional() }).strict()).max(12).optional(),
  missing: z.array(z.number()).max(6).optional(),
  alt,
}).strict()

const clock = z.object({
  kind: z.literal('clock'),
  h: z.number().int().min(0).max(23),
  m: z.number().int().min(0).max(59),
  showNumbers: z.boolean().default(true),
  digital: z.boolean().default(false),
  alt,
}).strict()

export const SHAPES_2D = [
  'circle', 'semicircle', 'oval', 'square', 'rectangle', 'triangle', 'right-triangle', 'pentagon', 'hexagon',
  'octagon', 'rhombus', 'trapezium', 'parallelogram', 'kite', 'star',
] as const
export const SOLIDS = ['cube', 'cuboid', 'sphere', 'cylinder', 'cone', 'square-pyramid', 'triangular-prism'] as const

const shape = z.object({
  kind: z.literal('shape'),
  shape: z.enum(SHAPES_2D),
  sideLabels: z.array(short).max(8).optional(),
  tone: tone.default('math'),
  showRightAngles: z.boolean().default(false),
  lineOfSymmetry: z.enum(['vertical', 'horizontal', 'none']).default('none'),
  alt,
}).strict()

const shapes = z.object({
  kind: z.literal('shapes'),
  items: z.array(z.object({ shape: z.union([z.enum(SHAPES_2D), z.enum(SOLIDS)]), label: short.optional(), tone: tone.optional() }).strict()).min(1).max(8),
  alt,
}).strict()

const solid = z.object({
  kind: z.literal('solid'),
  solid: z.enum(SOLIDS),
  label: short.optional(),
  alt,
}).strict()

const grid = z.object({
  kind: z.literal('grid'),
  rows: z.number().int().min(1).max(12),
  cols: z.number().int().min(1).max(12),
  shaded: z.array(z.tuple([z.number().int().min(0), z.number().int().min(0)])).max(144).default([]),
  tone: tone.default('math'),
  showUnits: z.boolean().default(false),
  alt,
}).strict()

const fraction = z.object({
  kind: z.literal('fraction'),
  shape: z.enum(['bar', 'circle', 'square']),
  parts: z.number().int().min(1).max(16),
  shaded: z.number().int().min(0).max(16),
  label: short.optional(),
  alt,
}).strict()

const bars = z.object({
  kind: z.literal('bars'),
  title: short.optional(),
  categories: z.array(short).min(1).max(8),
  values: z.array(z.number().min(0)).min(1).max(8),
  axisMax: z.number().positive().optional(),
  step: z.number().positive().optional(),
  yLabel: short.optional(),
  horizontal: z.boolean().default(false),
  tone: tone.default('math'),
  alt,
}).strict()

const pictogram = z.object({
  kind: z.literal('pictogram'),
  title: short.optional(),
  rows: z.array(z.object({ label: short, count: z.number().min(0).max(20) }).strict()).min(1).max(7),
  icon: iconName,
  key: z.number().int().min(1).max(100).default(1),
  alt,
}).strict()

const tally = z.object({
  kind: z.literal('tally'),
  rows: z.array(z.object({ label: short, count: z.number().int().min(0).max(40) }).strict()).min(1).max(7),
  alt,
}).strict()

const table = z.object({
  kind: z.literal('table'),
  caption: short.optional(),
  head: z.array(short).min(1).max(7),
  rows: z.array(z.array(z.string().max(60)).min(1).max(7)).min(1).max(12),
  alt,
}).strict()

const basetens = z.object({
  kind: z.literal('basetens'),
  thousands: z.number().int().min(0).max(9).default(0),
  hundreds: z.number().int().min(0).max(9).default(0),
  tens: z.number().int().min(0).max(19).default(0),
  ones: z.number().int().min(0).max(19).default(0),
  alt,
}).strict()

const money = z.object({
  kind: z.literal('money'),
  items: z.array(z.object({
    value: z.union([z.literal(100), z.literal(200), z.literal(500), z.literal(1000), z.literal(2000), z.literal(5000), z.literal(10000), z.literal(20000), z.literal(50000), z.literal(100000)]),
    count: z.number().int().min(1).max(10),
  }).strict()).min(1).max(6),
  alt,
}).strict()

const ruler = z.object({
  kind: z.literal('ruler'),
  lengthCm: z.number().int().min(5).max(30),
  objectCm: z.number().min(0.5).max(30),
  objectStartCm: z.number().min(0).max(25).default(0),
  object: iconName.optional(),
  alt,
}).strict()

const thermometer = z.object({
  kind: z.literal('thermometer'),
  min: z.number(),
  max: z.number(),
  value: z.number(),
  step: z.number().positive().default(10),
  alt,
}).strict()

const scale = z.object({
  kind: z.literal('scale'),
  max: z.number().positive(),
  value: z.number().min(0),
  step: z.number().positive(),
  unit: z.enum(['g', 'kg']),
  alt,
}).strict()

const jug = z.object({
  kind: z.literal('jug'),
  capacity: z.number().positive(),
  value: z.number().min(0),
  step: z.number().positive(),
  unit: z.enum(['ml', 'l']),
  alt,
}).strict()

const sequence = z.object({
  kind: z.literal('sequence'),
  items: z.array(z.union([z.string().max(12), z.null()])).min(2).max(12),
  style: z.enum(['stones', 'boxes', 'circles']).default('boxes'),
  alt,
}).strict()

const pattern = z.object({
  kind: z.literal('pattern'),
  items: z.array(z.union([z.object({ shape: z.enum(SHAPES_2D), tone: tone.default('math') }).strict(), z.object({ icon: iconName }).strict(), z.null()])).min(2).max(14),
  alt,
}).strict()

const venn = z.object({
  kind: z.literal('venn'),
  sets: z.tuple([short, short]),
  items: z.array(z.object({ text: z.string().max(20), region: z.enum(['a', 'b', 'both', 'none']) }).strict()).max(16).default([]),
  alt,
}).strict()

const carroll = z.object({
  kind: z.literal('carroll'),
  cols: z.tuple([short, short]),
  rows: z.tuple([short, short]),
  cells: z.tuple([z.array(z.string().max(16)), z.array(z.string().max(16)), z.array(z.string().max(16)), z.array(z.string().max(16))]),
  alt,
}).strict()

const coordinates = z.object({
  kind: z.literal('coordinates'),
  size: z.number().int().min(4).max(12),
  points: z.array(z.object({ x: z.number().int(), y: z.number().int(), label: z.string().max(3).optional() }).strict()).max(10),
  polygon: z.boolean().default(false),
  quadrants: z.union([z.literal(1), z.literal(4)]).default(1),
  alt,
}).strict()

const angle = z.object({
  kind: z.literal('angle'),
  degrees: z.number().min(1).max(359),
  label: short.optional(),
  showProtractor: z.boolean().default(false),
  alt,
}).strict()

const icons = z.object({
  kind: z.literal('icons'),
  items: z.array(z.object({ icon: iconName, label: short.optional() }).strict()).min(1).max(8),
  arrows: z.enum(['none', 'chain', 'cycle']).default('none'),
  alt,
}).strict()

const circuit = z.object({
  kind: z.literal('circuit'),
  parts: z.array(z.enum(['battery', 'bulb', 'bulb-lit', 'switch-open', 'switch-closed', 'buzzer', 'motor', 'gap'])).min(2).max(6),
  symbols: z.boolean().default(false),
  alt,
}).strict()

const balance = z.object({
  kind: z.literal('balance'),
  left: z.array(z.string().max(10)).max(6),
  right: z.array(z.string().max(10)).max(6),
  tilt: z.enum(['left', 'right', 'level']).default('level'),
  alt,
}).strict()

const sceneNum = z.number().min(-20).max(500)
const sceneTone = tone.default('ink')
const sceneFill = z.enum(['none', 'light', 'solid']).default('light')
const sceneShape = z.discriminatedUnion('t', [
  z.object({ t: z.literal('rect'), x: sceneNum, y: sceneNum, w: z.number().min(1).max(500), h: z.number().min(1).max(500), r: z.number().min(0).max(60).default(0), tone: sceneTone, fill: sceneFill }).strict(),
  z.object({ t: z.literal('circle'), cx: sceneNum, cy: sceneNum, r: z.number().min(1).max(250), tone: sceneTone, fill: sceneFill }).strict(),
  z.object({ t: z.literal('ellipse'), cx: sceneNum, cy: sceneNum, rx: z.number().min(1).max(250), ry: z.number().min(1).max(250), rot: z.number().min(-180).max(180).default(0), tone: sceneTone, fill: sceneFill }).strict(),
  z.object({ t: z.literal('line'), x1: sceneNum, y1: sceneNum, x2: sceneNum, y2: sceneNum, width: z.number().min(1).max(12).default(2.5), tone: sceneTone }).strict(),
  z.object({ t: z.literal('poly'), points: z.array(z.tuple([sceneNum, sceneNum])).min(2).max(24), closed: z.boolean().default(true), tone: sceneTone, fill: sceneFill }).strict(),
  z.object({ t: z.literal('icon'), icon: iconName, x: sceneNum, y: sceneNum, size: z.number().min(16).max(200).default(56) }).strict(),
  z.object({ t: z.literal('text'), x: sceneNum, y: sceneNum, text: z.string().min(1).max(30), size: z.number().min(10).max(40).default(16), tone: sceneTone, anchor: z.enum(['start', 'middle', 'end']).default('middle') }).strict(),
])
export type SceneShape = z.infer<typeof sceneShape>

/** Gambar bebas dari bentuk dasar di kotak width x height, untuk diagram (tumbuhan, tubuh) dan layar ketuk di gambar. Koordinat dalam piksel kotak. */
const scene = z.object({
  kind: z.literal('scene'),
  width: z.number().int().min(120).max(480),
  height: z.number().int().min(80).max(400),
  shapes: z.array(sceneShape).min(1).max(80),
  alt,
}).strict()

export const figureSpec = z.discriminatedUnion('kind', [
  array, groups, objects, numberline, clock, shape, shapes, solid, grid, fraction, bars, pictogram, tally, table,
  basetens, money, ruler, thermometer, scale, jug, sequence, pattern, venn, carroll, coordinates, angle, icons,
  circuit, balance, scene,
])

export type FigureSpec = z.infer<typeof figureSpec>
export type FigureSpecInput = z.input<typeof figureSpec>
export type FigureKind = FigureSpec['kind']

export const FIGURE_KINDS = figureSpec.options.map((o) => o.shape.kind.value) as FigureKind[]
