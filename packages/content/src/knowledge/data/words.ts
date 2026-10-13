/**
 * Topik kata sehari-hari dalam bahasa Inggris: benda bergambar, kelompok kata, lawan kata, bentuk jamak,
 * hari, bulan, dan angka.
 */
import type { IconName } from '@kira/figures/spec'
import type { KAsk, KFact, KOrderSet, KTopic } from '../types'

const without = (list: readonly string[], x: string): string[] => list.filter((y) => y !== x)
const an = (word: string): string => (/^[aeiou]/i.test(word) ? 'an' : 'a')

// ---------------------------------------------------------------------------
// Benda bergambar

type PicWord = { icon: IconName; label: string; cat: string; sentence?: string }

const PIC_WORDS: readonly PicWord[] = [
  { icon: 'apple', label: 'Apple', cat: 'fruit' },
  { icon: 'pear', label: 'Pear', cat: 'fruit' },
  { icon: 'banana', label: 'Banana', cat: 'fruit' },
  { icon: 'orange', label: 'Orange', cat: 'fruit' },
  { icon: 'strawberry', label: 'Strawberry', cat: 'fruit' },
  { icon: 'cherry', label: 'Cherries', cat: 'fruit' },
  { icon: 'grapes', label: 'Grapes', cat: 'fruit' },
  { icon: 'watermelon', label: 'Watermelon', cat: 'fruit' },
  { icon: 'carrot', label: 'Carrot', cat: 'food' },
  { icon: 'bread', label: 'Bread', cat: 'food' },
  { icon: 'cookie', label: 'Cookie', cat: 'food' },
  { icon: 'muffin', label: 'Muffin', cat: 'food' },
  { icon: 'cake', label: 'Cake', cat: 'food' },
  { icon: 'ice-cream', label: 'Ice cream', cat: 'food' },
  { icon: 'egg', label: 'Egg', cat: 'food' },
  { icon: 'milk', label: 'Milk', cat: 'food' },
  { icon: 'rice', label: 'Rice', cat: 'food' },
  { icon: 'cheese', label: 'Cheese', cat: 'food' },
  { icon: 'car', label: 'Car', cat: 'vehicle' },
  { icon: 'bus', label: 'Bus', cat: 'vehicle' },
  { icon: 'boat', label: 'Boat', cat: 'vehicle' },
  { icon: 'plane', label: 'Aeroplane', cat: 'vehicle' },
  { icon: 'bicycle', label: 'Bicycle', cat: 'vehicle' },
  { icon: 'pencil', label: 'Pencil', cat: 'school' },
  { icon: 'crayon', label: 'Crayon', cat: 'school' },
  { icon: 'eraser', label: 'Eraser', cat: 'school' },
  { icon: 'book', label: 'Book', cat: 'school' },
  { icon: 'bag', label: 'School bag', cat: 'school' },
  { icon: 'ball', label: 'Ball', cat: 'toy' },
  { icon: 'kite', label: 'Kite', cat: 'toy' },
  { icon: 'balloon', label: 'Balloon', cat: 'toy' },
  { icon: 'plate', label: 'Plate', cat: 'home' },
  { icon: 'basket', label: 'Basket', cat: 'home' },
  { icon: 'box', label: 'Box', cat: 'home' },
  { icon: 'jar', label: 'Jar', cat: 'home' },
  { icon: 'cup', label: 'Cup', cat: 'home' },
  { icon: 'key', label: 'Key', cat: 'home' },
  { icon: 'clock', label: 'Clock', cat: 'home' },
  { icon: 'bell', label: 'Bell', cat: 'home' },
  { icon: 'umbrella', label: 'Umbrella', cat: 'home' },
  { icon: 'spoon', label: 'Spoon', cat: 'home' },
  { icon: 'candle', label: 'Candle', cat: 'home' },
  { icon: 'mirror', label: 'Mirror', cat: 'home' },
  { icon: 'scissors', label: 'Scissors', cat: 'home' },
  { icon: 'bed', label: 'Bed', cat: 'home' },
  { icon: 'hat', label: 'Hat', cat: 'clothes' },
  { icon: 'shoe', label: 'Shoe', cat: 'clothes' },
  { icon: 'sock', label: 'Sock', cat: 'clothes' },
  { icon: 'circle', label: 'Circle', cat: 'shape' },
  { icon: 'square', label: 'Square', cat: 'shape' },
  { icon: 'triangle', label: 'Triangle', cat: 'shape' },
  { icon: 'star', label: 'Star', cat: 'shape' },
  { icon: 'heart', label: 'Heart', cat: 'shape' },
  { icon: 'tree', label: 'Tree', cat: 'nature' },
  { icon: 'flower', label: 'Flower', cat: 'nature' },
  { icon: 'leaf', label: 'Leaf', cat: 'nature' },
  { icon: 'sun', label: 'Sun', cat: 'nature' },
  { icon: 'moon', label: 'Moon', cat: 'nature' },
  { icon: 'cloud', label: 'Cloud', cat: 'nature' },
  { icon: 'rainbow', label: 'Rainbow', cat: 'nature' },
  { icon: 'mountain', label: 'Mountain', cat: 'nature' },
  { icon: 'volcano', label: 'Volcano', cat: 'nature' },
  { icon: 'river', label: 'River', cat: 'nature' },
  { icon: 'house', label: 'House', cat: 'place' },
  { icon: 'school', label: 'School', cat: 'place' },
  { icon: 'shop', label: 'Shop', cat: 'place' },
  { icon: 'park', label: 'Park', cat: 'place' },
  { icon: 'farm', label: 'Farm', cat: 'place' },
]

const PLURAL_LABELS = new Set(['Cherries', 'Grapes', 'Scissors'])

function picFact(w: PicWord): KFact {
  const pic = { t: 'icon', name: w.icon } as const
  const thing = (l: string): string => (PLURAL_LABELS.has(l) ? `These are ${l.toLowerCase()}.` : `This is ${an(l)} ${l.toLowerCase()}.`)
  const ask: KAsk = {
    prompt: 'What is this?',
    pic,
    answer: { label: w.label },
    pool: 'w-pic',
    group: w.cat,
    mode: 'near',
    statement: thing,
    explain: thing(w.label),
  }
  return { id: `word:pic-${w.icon}`, topic: 'words', group: 'pictures', tier: 1, card: { front: 'What is this?', frontPic: pic, back: w.label }, asks: [ask] }
}

// ---------------------------------------------------------------------------
// Kelompok kata

type Category = { id: string; phrase: string; words: string[] }

const CATEGORIES: readonly Category[] = [
  { id: 'colour', phrase: 'a colour', words: ['Red', 'Blue', 'Green', 'Yellow', 'Orange', 'Purple', 'Pink', 'Brown', 'Black', 'White', 'Grey'] },
  { id: 'fruit', phrase: 'a fruit', words: ['Apple', 'Banana', 'Mango', 'Pear', 'Strawberry', 'Watermelon', 'Pineapple', 'Papaya', 'Durian', 'Rambutan', 'Lemon'] },
  { id: 'vegetable', phrase: 'a vegetable', words: ['Carrot', 'Potato', 'Cabbage', 'Spinach', 'Onion', 'Broccoli', 'Lettuce'] },
  { id: 'animal', phrase: 'an animal', words: ['Cat', 'Dog', 'Cow', 'Lion', 'Tiger', 'Elephant', 'Rabbit', 'Monkey', 'Horse', 'Goat'] },
  { id: 'clothes', phrase: 'something we wear', words: ['Hat', 'Shoe', 'Sock', 'Shirt', 'Dress', 'Coat', 'Skirt', 'Trousers', 'Scarf', 'Jacket'] },
  { id: 'family', phrase: 'a member of a family', words: ['Mother', 'Father', 'Brother', 'Sister', 'Grandmother', 'Grandfather', 'Aunt', 'Uncle', 'Cousin'] },
  { id: 'school', phrase: 'something we use at school', words: ['Pencil', 'Ruler', 'Eraser', 'Notebook', 'Pen', 'Crayon', 'Scissors', 'Glue'] },
  { id: 'vehicle', phrase: 'a vehicle', words: ['Car', 'Bus', 'Train', 'Boat', 'Bicycle', 'Aeroplane', 'Motorbike', 'Lorry', 'Helicopter', 'Ship'] },
  { id: 'weather', phrase: 'a weather word', words: ['Sunny', 'Rainy', 'Windy', 'Cloudy', 'Snowy', 'Stormy'] },
  { id: 'room', phrase: 'a room in a house', words: ['Kitchen', 'Bedroom', 'Bathroom', 'Living room'] },
  { id: 'shape', phrase: 'a shape', words: ['Circle', 'Square', 'Triangle', 'Rectangle', 'Oval', 'Star', 'Heart', 'Diamond'] },
  { id: 'job', phrase: 'a job', words: ['Teacher', 'Doctor', 'Farmer', 'Driver', 'Cook', 'Nurse', 'Pilot', 'Dentist'] },
]

function categoryFact(cat: Category, word: string): KFact {
  return {
    id: `word:cat-${cat.id}-${word.toLowerCase().replace(/\s+/g, '-')}`,
    topic: 'words',
    group: cat.id,
    tier: 1,
    card: { front: word, back: `${word} is ${cat.phrase}.` },
    asks: [
      {
        prompt: `Which word is ${cat.phrase}?`,
        answer: { label: word },
        pool: 'w-word',
        group: cat.id,
        mode: 'far',
        exclude: word === 'Orange' ? [] : ['Orange'],
        statement: (l) => `${l} is ${cat.phrase}.`,
        explain: `${word} is ${cat.phrase}.`,
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// Lawan kata

const OPPOSITES: readonly (readonly [string, string])[] = [
  ['big', 'small'],
  ['hot', 'cold'],
  ['up', 'down'],
  ['happy', 'sad'],
  ['fast', 'slow'],
  ['open', 'closed'],
  ['full', 'empty'],
  ['old', 'new'],
  ['hard', 'soft'],
  ['tall', 'short'],
  ['wet', 'dry'],
  ['day', 'night'],
  ['in', 'out'],
  ['clean', 'dirty'],
  ['loud', 'quiet'],
  ['near', 'far'],
  ['thick', 'thin'],
  ['early', 'late'],
]

function oppositeFacts(): KFact[] {
  const out: KFact[] = []
  for (const [a, b] of OPPOSITES) {
    const pairs: [string, string][] = [
      [a, b],
      [b, a],
    ]
    for (const [w, o] of pairs) {
      out.push({
        id: `word:opp-${w}`,
        topic: 'words',
        group: 'opposites',
        tier: 1,
        card: { front: `The opposite of ${w}`, back: `${o}` },
        asks: [
          {
            prompt: `What is the opposite of "${w}"?`,
            answer: { label: o },
            pool: 'w-opp',
            mode: 'any',
            statement: (l) => `The opposite of "${w}" is "${l}".`,
            explain: `The opposite of "${w}" is "${o}".`,
          },
        ],
      })
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Bentuk jamak

const PLURALS: readonly (readonly [string, string])[] = [
  ['child', 'children'],
  ['mouse', 'mice'],
  ['foot', 'feet'],
  ['man', 'men'],
  ['woman', 'women'],
  ['tooth', 'teeth'],
  ['goose', 'geese'],
  ['sheep', 'sheep'],
  ['leaf', 'leaves'],
  ['knife', 'knives'],
  ['baby', 'babies'],
  ['box', 'boxes'],
  ['bus', 'buses'],
  ['city', 'cities'],
  ['wolf', 'wolves'],
]

function pluralFact([one, many]: readonly [string, string]): KFact {
  const naive = one.endsWith('y') ? `${one.slice(0, -1)}s` : `${one}s`
  const wrong = [naive, one.endsWith('y') ? `${one}es` : `${one}es`].filter((w) => w !== many)
  return {
    id: `word:plural-${one}`,
    topic: 'words',
    group: 'plurals',
    tier: 2,
    card: { front: `More than one ${one}`, back: many },
    asks: [
      {
        prompt: `What is the plural of "${one}"? (More than one ${one}.)`,
        answer: { label: many },
        pool: 'w-plural',
        mode: 'any',
        wrong,
        explain: `More than one ${one} is "${many}".`,
        statement: (l) => `The plural of "${one}" is "${l}".`,
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// Hari, bulan, dan angka

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const

function sequenceFacts(): KFact[] {
  const out: KFact[] = []
  DAYS.forEach((d, i) => {
    const next = DAYS[(i + 1) % 7] as string
    out.push({
      id: `word:day-after-${d.toLowerCase()}`,
      topic: 'words',
      group: 'days',
      tier: 1,
      card: { front: `The day after ${d}`, back: next },
      asks: [{ prompt: `Which day comes after ${d}?`, answer: { label: next }, pool: '', wrong: without(DAYS, next), explain: `${next} comes after ${d}.`, statement: (l) => `${l} comes after ${d}.` }],
    })
  })
  MONTHS.forEach((m, i) => {
    const next = MONTHS[(i + 1) % 12] as string
    out.push({
      id: `word:month-after-${m.toLowerCase()}`,
      topic: 'words',
      group: 'months',
      tier: 1,
      card: { front: `The month after ${m}`, back: next },
      asks: [{ prompt: `Which month comes after ${m}?`, answer: { label: next }, pool: '', wrong: without(MONTHS, next), explain: `${next} comes after ${m}.`, statement: (l) => `${l} comes after ${m}.` }],
    })
  })
  out.push(
    {
      id: 'word:week-days',
      topic: 'words',
      group: 'days',
      tier: 1,
      card: { front: 'Days in a week', back: 'There are 7 days in a week.' },
      asks: [{ prompt: 'How many days are in a week?', answer: { label: '7' }, pool: '', wrong: ['5', '6', '8', '10'], explain: 'There are 7 days in a week.', statement: (l) => `There are ${l} days in a week.` }],
    },
    {
      id: 'word:year-months',
      topic: 'words',
      group: 'months',
      tier: 1,
      card: { front: 'Months in a year', back: 'There are 12 months in a year.' },
      asks: [{ prompt: 'How many months are in a year?', answer: { label: '12' }, pool: '', wrong: ['10', '11', '13', '52'], explain: 'There are 12 months in a year.', statement: (l) => `There are ${l} months in a year.` }],
    },
  )
  return out
}

const NUMBER_WORDS: readonly [number, string][] = [
  [1, 'one'],
  [2, 'two'],
  [3, 'three'],
  [4, 'four'],
  [5, 'five'],
  [6, 'six'],
  [7, 'seven'],
  [8, 'eight'],
  [9, 'nine'],
  [10, 'ten'],
  [11, 'eleven'],
  [12, 'twelve'],
  [13, 'thirteen'],
  [14, 'fourteen'],
  [15, 'fifteen'],
  [16, 'sixteen'],
  [17, 'seventeen'],
  [18, 'eighteen'],
  [19, 'nineteen'],
  [20, 'twenty'],
  [30, 'thirty'],
  [40, 'forty'],
  [50, 'fifty'],
  [100, 'one hundred'],
]

function numberFact([n, w]: readonly [number, string]): KFact {
  return {
    id: `word:num-${n}`,
    topic: 'words',
    group: 'numbers',
    tier: n <= 10 ? 1 : 2,
    card: { front: String(n), back: w },
    asks: [
      { prompt: `Which word is the number ${n}?`, answer: { label: w }, pool: 'w-num', mode: 'any', statement: (l) => `The number ${n} is written "${l}".`, explain: `The number ${n} is written "${w}".` },
      { prompt: `Which number is "${w}"?`, answer: { label: String(n) }, pool: 'w-digit', mode: 'any', explain: `"${w}" is the number ${n}.` },
    ],
  }
}

const SHAPE_SIDES: readonly (readonly [string, number])[] = [
  ['triangle', 3],
  ['square', 4],
  ['rectangle', 4],
  ['pentagon', 5],
  ['hexagon', 6],
  ['octagon', 8],
]

const SHAPE_FACTS: KFact[] = SHAPE_SIDES.map(([name, sides]) => {
  const sentence = (n: string): string => `${an(name).charAt(0).toUpperCase()}${an(name).slice(1)} ${name} has ${n} sides.`
  return {
    id: `word:sides-${name}`,
    topic: 'words' as const,
    group: 'shapes',
    tier: 2 as const,
    card: { front: `How many sides has ${an(name)} ${name}?`, back: `${sides} sides.` },
    asks: [
      {
        prompt: `How many sides does ${an(name)} ${name} have?`,
        answer: { label: String(sides) },
        pool: '',
        wrong: ['3', '4', '5', '6', '8', '10'].filter((x) => x !== String(sides)),
        explain: sentence(String(sides)),
        statement: sentence,
      },
    ],
  }
})

const ORDERS: KOrderSet[] = [
  {
    id: 'days',
    topic: 'words',
    prompt: 'Tap the days of the week in order.',
    items: DAYS.map((d) => ({ id: d.toLowerCase(), label: d })),
    pick: 5,
    explain: 'The days in order: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday.',
  },
  {
    id: 'months',
    topic: 'words',
    prompt: 'Tap the months of the year in order.',
    items: MONTHS.map((m) => ({ id: m.toLowerCase(), label: m })),
    pick: 5,
    explain: 'The months in order: January, February, March, April, May, June, July, August, September, October, November, December.',
  },
  {
    id: 'numbers',
    topic: 'words',
    prompt: 'Tap the number words from the smallest to the biggest.',
    items: NUMBER_WORDS.slice(0, 20).map(([n, w]) => ({ id: `n${n}`, label: w })),
    pick: 5,
    explain: 'The number words from the smallest to the biggest.',
  },
]

export const WORDS_TOPIC: KTopic = {
  id: 'words',
  title: 'Everyday English words',
  blurb: 'Things, colours, shapes, opposites and more.',
  pic: { t: 'icon', name: 'book' },
  pictures: true,
  facts: [
    ...PIC_WORDS.map(picFact),
    ...CATEGORIES.flatMap((c) => c.words.map((w) => categoryFact(c, w))),
    ...oppositeFacts(),
    ...PLURALS.map(pluralFact),
    ...sequenceFacts(),
    ...NUMBER_WORDS.map(numberFact),
    ...SHAPE_FACTS,
  ],
  orders: ORDERS,
}
