// __GTX_SEED__
// Soal contoh untuk pratinjau layar learner. Ditulis tangan, divalidasi itemSchema,
// lalu dibentuk dengan presentItem seperti di server. Tidak pernah masuk database produksi.

import { answerText } from '@kira/content/check'
import { presentItem, type ClientItem } from '@kira/content/present'
import { itemSchema, type ItemInput, type Passage } from '@kira/content/schema'
import type { RunnerItem } from '@/lib/dto'

const SEED = '__GTX_SEED__:learner-preview'

export function make(input: ItemInput, opts: { key?: boolean; passage?: Passage } = {}): ClientItem {
  const item = itemSchema.parse(input)
  const withKey = opts.key ?? true
  return presentItem(item, {
    seed: SEED,
    includeKey: withKey,
    includeHints: withKey,
    answerText: answerText(item),
    ...(opts.passage ? { passage: opts.passage } : {}),
  })
}

export function asRunner(items: ClientItem[], section: RunnerItem['section'] = 'core'): RunnerItem[] {
  return items.map((it, i) => ({ ...it, position: i + 1, section }))
}

export const LOST_KITE: Passage = {
  id: 'e2.p.lost-kite',
  title: 'The lost kite',
  kind: 'story',
  lang: 'en-GB',
  text:
    'Mia and her dad flew a red kite at the park on Saturday. The wind was strong, and the string slipped out of her hand.\n\n' +
    'The kite floated over the pond and landed in a tall mango tree. Mia was sad, but Dad had an idea. He asked the park keeper for a long ladder.\n\n' +
    'On Sunday they went back to the park. The kite was still in the tree, so Dad climbed up and got it down. Mia held the string tightly all the way home.',
}

// ---------------------------------------------------------------------------
// Math kelas 2: soal papan Runner (keypad, gambar, urutkan, jodohkan) dan lainnya.

export const M_ARRAY_KEYPAD: ItemInput = {
  id: 'm2.arrays.001',
  skill: 'm2.arrays',
  type: 'numeric',
  difficulty: 3,
  prompt: 'There are 4 rows of apples. Each row has 5 apples. How many apples are there?',
  figure: { kind: 'array', rows: 4, cols: 5, icon: 'apple', alt: '4 rows of apples with 5 apples in each row.' },
  answer: 20,
  hints: ['Look at one row. How many apples are in it?', 'Count in fives, one row at a time: 5, 10, ...', 'Add the rows: 5 + 5 + 5 + 5.'],
  explanation: '4 rows of 5 apples make 20.',
  tip: 'Count the rows, then count how many are in one row.',
  solution: [
    { say: 'Look at the first row. It has 5 apples.', show: '5' },
    { say: 'Count on in fives for each new row: 10, then 15.', show: '5, 10, 15' },
    { say: 'The last row makes 20. So 4 rows of 5 is 20.', show: '4 × 5 = 20' },
  ],
}

export const M_GROUPS_PICTURES: ItemInput = {
  id: 'm2.equal-groups.002',
  skill: 'm2.equal-groups',
  type: 'mcq',
  difficulty: 2,
  prompt: 'Which picture shows 3 groups of 4?',
  options: [
    { figure: { kind: 'groups', groups: [3, 3, 3, 3], icon: 'cookie', container: 'plate', alt: '4 plates with 3 cookies on each.' }, why: 'This picture has 4 groups of 3.' },
    { figure: { kind: 'groups', groups: [4, 4, 4], icon: 'cookie', container: 'plate', alt: '3 plates with 4 cookies on each.' } },
    { figure: { kind: 'groups', groups: [3, 3, 3], icon: 'cookie', container: 'plate', alt: '3 plates with 3 cookies on each.' }, why: 'There are 3 groups, but each has only 3.' },
    { figure: { kind: 'groups', groups: [6, 6], icon: 'cookie', container: 'plate', alt: '2 plates with 6 cookies on each.' }, why: 'This picture has 2 groups of 6.' },
  ],
  answer: 1,
  tags: ['keep-order'],
  hints: ['Count the groups first. You need 3 groups.', 'Now count inside one group. You need 4.', 'Find 3 plates with 4 on each plate.'],
  explanation: 'B has 3 plates, and each plate has 4 cookies.',
}

export const M_ORDER_FIVES: ItemInput = {
  id: 'm2.skip-counting.003',
  skill: 'm2.skip-counting',
  type: 'order',
  difficulty: 2,
  prompt: 'Count in fives. Put the cards in order, smallest first.',
  items: ['5', '10', '15', '20'],
  hints: ['Start with the smallest number.', 'Counting in fives goes 5, 10, ...', 'Each card is 5 more than the one before.'],
  explanation: '5, 10, 15, 20. Each card is 5 more than the one before.',
}

export const M_MATCH_ARRAYS: ItemInput = {
  id: 'm2.arrays.004',
  skill: 'm2.arrays',
  type: 'match',
  difficulty: 3,
  prompt: 'Match each array to the number of dots.',
  pairs: [
    ['2 rows of 5 dots', '10'],
    ['3 rows of 2 dots', '6'],
    ['4 rows of 3 dots', '12'],
  ],
  hints: ['Count the dots in one row.', 'Count on by that number for each row.', '2 rows of 5 is 5, 10.'],
  explanation: '2 rows of 5 make 10. 3 rows of 2 make 6. 4 rows of 3 make 12.',
}

export const M_PATTERN_MCQ: ItemInput = {
  id: 'm2.patterns.005',
  skill: 'm2.patterns',
  type: 'mcq',
  difficulty: 2,
  prompt: 'What comes next? 2, 4, 6, 8, ...',
  options: [{ text: '9', why: '9 is only 1 more than 8. The pattern jumps by 2.' }, { text: '10' }, { text: '12', why: '12 jumps by 4. The pattern jumps by 2.' }, { text: '16', why: '16 doubles 8. The pattern adds 2 each time.' }],
  answer: 1,
  tags: ['keep-order'],
  hints: ['Look at how much each number grows.', 'The numbers go up in 2s.', 'What is 8 and 2 more?'],
  explanation: 'The numbers go up in 2s. 8 and 2 more is 10.',
  tip: 'Find the jump between two numbers first.',
}

export const M_EVEN_MULTI: ItemInput = {
  id: 'm2.odd-even.006',
  skill: 'm2.odd-even',
  type: 'multi',
  difficulty: 2,
  prompt: 'Choose the 2 even numbers.',
  options: [{ text: '7' }, { text: '8' }, { text: '11' }, { text: '14' }],
  answers: [1, 3],
  tags: ['keep-order'],
  hints: ['Even numbers can be shared into 2 equal groups.', 'Even numbers end in 0, 2, 4, 6 or 8.', 'Look at the last digit of each number.'],
  explanation: '8 and 14 end in 8 and 4, so they are even.',
}

export const M_NUMBERLINE: ItemInput = {
  id: 'm2.number-line.007',
  skill: 'm2.number-line',
  type: 'numberline',
  difficulty: 1,
  prompt: 'Put the marker on 13.',
  min: 0,
  max: 20,
  step: 1,
  answer: 13,
  hints: ['Find 10 on the line first.', '13 is 3 more than 10.', 'Count 3 jumps after 10.'],
  explanation: '13 is 3 jumps after 10.',
}

export const M_CLOCK: ItemInput = {
  id: 'm2.time.008',
  skill: 'm2.time',
  type: 'clock',
  difficulty: 2,
  prompt: 'Show half past 3 on the clock.',
  answer: { h: 3, m: 30 },
  stepMinutes: 15,
  hints: ['Half past means 30 minutes.', 'The long hand points to 6 at half past.', 'The short hand sits between 3 and 4.'],
  explanation: 'At half past 3 the long hand points to 6 and the short hand is between 3 and 4.',
}

export const M_FRACTION: ItemInput = {
  id: 'm2.halves.009',
  skill: 'm2.halves',
  type: 'fraction',
  difficulty: 2,
  prompt: 'Shade one half of the bar.',
  shape: 'bar',
  parts: 4,
  answer: { num: 1, den: 2 },
  hints: ['One half means 1 of 2 equal parts.', 'The bar has 4 parts. Half of 4 is 2.', 'Shade 2 of the 4 parts.'],
  explanation: 'Half of 4 parts is 2 parts, so shade 2 parts.',
}

export const M_SPLIT_NUMERIC: ItemInput = {
  id: 'm2.add-subtract.010',
  skill: 'm2.add-subtract',
  type: 'numeric',
  difficulty: 2,
  prompt: 'Sam has 15 marbles. He gives 6 away. How many marbles are left?',
  answer: 9,
  hints: ['Gives away means take away.', 'Start at 15 and count back 6.', '15 take away 5 is 10. Take 1 more.'],
  explanation: '15 take away 6 is 9.',
}

// ---------------------------------------------------------------------------
// English dan Science kelas 2.

export const E_PAST_TEXT: ItemInput = {
  id: 'e2.past-tense-ed.011',
  skill: 'e2.past-tense-ed',
  type: 'text',
  difficulty: 2,
  prompt: 'Yesterday Ben ___ his bike to the park.',
  blanks: [{ answers: ['rode'] }],
  hints: ['Look for the word that tells you when.', 'Yesterday means the past.', 'Ride does not take -ed. It changes its middle sound.'],
  explanation: 'Yesterday tells us it is in the past. The past of ride is rode.',
}

export const E_READING_MCQ: ItemInput = {
  id: 'e2.story-facts.012',
  skill: 'e2.story-facts',
  type: 'mcq',
  difficulty: 3,
  passage: 'e2.p.lost-kite',
  prompt: 'Why did Mia and Dad go back to the park on Sunday?',
  options: [
    { text: 'To fly a new kite', why: 'The story does not talk about a new kite.' },
    { text: 'To get the kite out of the tree' },
    { text: 'To swim in the pond', why: 'The kite went over the pond, but nobody swam.' },
    { text: 'To meet the park keeper', why: 'They asked the park keeper on Saturday.' },
  ],
  answer: 1,
  hints: ['Read the last part of the story again.', 'Where was the kite on Sunday?', 'What did Dad do with the ladder?'],
  explanation: 'The kite was still in the tree, so they went back to get it down.',
}

export const S_SORT_LIVING: ItemInput = {
  id: 's2.living-things.013',
  skill: 's2.living-things',
  type: 'sort',
  difficulty: 2,
  prompt: 'Sort the cards. Is each thing living or never alive?',
  groups: ['Living', 'Never alive'],
  items: [
    { text: 'tree', group: 0 },
    { text: 'rock', group: 1 },
    { text: 'cat', group: 0 },
    { text: 'spoon', group: 1 },
    { text: 'flower', group: 0 },
    { text: 'cup', group: 1 },
  ],
  hints: ['Living things grow and need food or water.', 'A rock never grows.', 'Ask: does it need food and water?'],
  explanation: 'A tree, a cat and a flower grow and need water. A rock, a spoon and a cup were never alive.',
}

export const E_WRITE: ItemInput = {
  id: 'e2.past-tense-ed.014',
  skill: 'e2.past-tense-ed',
  type: 'write',
  difficulty: 3,
  prompt: 'Write three sentences about your weekend. Use verbs with -ed.',
  rubric: {
    criteria: [
      { label: 'Writes 3 sentences', points: 2 },
      { label: 'Uses capital letters and full stops', points: 2 },
      { label: 'Uses verbs with -ed', points: 2 },
    ],
  },
  minWords: 12,
  maxWords: 60,
  planning: ['I wrote 3 sentences.', 'Each sentence starts with a capital letter.', 'Each sentence ends with a full stop.', 'I used verbs with -ed.'],
  explanation: 'Your tutor reads your sentences and gives you stars.',
}

export const E_SPEAK: ItemInput = {
  id: 'e2.speaking.015',
  skill: 'e2.speaking',
  type: 'speak',
  difficulty: 2,
  prompt: 'Tell me about last Saturday. Say 2 sentences.',
  rubric: { criteria: [{ label: 'Says 2 clear sentences', points: 2 }, { label: 'Uses verbs with -ed', points: 2 }] },
  maxSeconds: 30,
  hints: ['Start with: On Saturday I ...'],
  explanation: 'Your tutor listens and gives you stars.',
}

export const S_DRAW: ItemInput = {
  id: 's2.habitats.016',
  skill: 's2.habitats',
  type: 'draw',
  difficulty: 2,
  prompt: 'Draw a pond habitat. Draw 1 animal that lives in a pond. Draw 1 thing it needs.',
  rubric: { criteria: [{ label: 'Draws a pond animal', points: 2 }, { label: 'Draws something the animal needs', points: 2 }] },
  background: 'blank',
  hints: ['Fish, frogs and ducks live in ponds. What do they need to stay alive?'],
  explanation: 'Your tutor looks at your drawing and gives you stars.',
}

/** Satu soal untuk setiap tipe widget. */
export function allWidgetItems(): RunnerItem[] {
  return asRunner([
    make(M_ARRAY_KEYPAD),
    make(M_GROUPS_PICTURES),
    make(M_ORDER_FIVES),
    make(M_MATCH_ARRAYS),
    make(M_PATTERN_MCQ),
    make(M_EVEN_MULTI),
    make(E_PAST_TEXT),
    make(S_SORT_LIVING),
    make(M_NUMBERLINE),
    make(M_CLOCK),
    make(M_FRACTION),
    make(E_WRITE),
    make(E_SPEAK),
    make(S_DRAW),
    make(E_READING_MCQ, { passage: LOST_KITE }),
  ])
}

// ---------------------------------------------------------------------------
// Tes mingguan English (RunnerMingguan) dan ESMO Math berbahasa Indonesia (RunnerEsmo).

const ENGLISH_TEST: [string, string[], number][] = [
  ["Which word rhymes with 'cake'?", ['lake', 'cat', 'kick', 'cook'], 0],
  ['Which word is a noun?', ['run', 'happy', 'table', 'quickly'], 2],
  ['Tom ___ to the park yesterday.', ['walk', 'walked', 'walking', 'walks'], 1],
  ["What is the plural of 'mouse'?", ['mice', 'mouses', 'mouse', 'mices'], 0],
  ['Which sentence is written correctly?', ['the dog is big.', 'The Dog is big.', 'The dog is big.', 'the Dog is big.'], 2],
  ["What is the opposite of 'hot'?", ['warm', 'wet', 'big', 'cold'], 3],
  ['There ___ three apples on the table.', ['is', 'am', 'are', 'be'], 2],
  ["Which word means the same as 'big'?", ['large', 'small', 'thin', 'short'], 0],
  ["Mia has a red bag. Her pencil is in the bag. Where is Mia's pencil?", ['on the desk', 'under the bag', 'in her hand', 'in the bag'], 3],
  ['Which sentence is in the right order?', ['It is sunny today.', 'Sunny it is today.', 'Today sunny is it.', 'Is it today sunny.'], 0],
]

export function englishTestItems(): RunnerItem[] {
  return asRunner(
    ENGLISH_TEST.map(([prompt, opts, answer], i) =>
      make(
        {
          id: `e2.weekly-test.${String(i + 1).padStart(3, '0')}`,
          skill: 'e2.weekly-test',
          type: 'mcq',
          difficulty: 2,
          prompt,
          options: opts.map((text) => ({ text })),
          answer,
          tags: ['keep-order'],
          hints: ['Read the question slowly.', 'Say each answer in your head.', 'Choose the one that sounds right.'],
          explanation: `The answer is ${opts[answer] ?? ''}.`,
        },
        { key: false },
      ),
    ),
  )
}

const ESMO: { text: string; opts: string[]; key: number; terms: [string, string][]; stones?: boolean }[] = [
  { text: 'Hari ini hari Senin. Hari apakah 10 hari lagi?', opts: ['Rabu', 'Kamis', 'Jumat', 'Sabtu'], key: 1, terms: [['hari ini', 'today'], ['10 hari lagi', '10 days from now'], ['hari apakah', 'which day'], ['Senin, Rabu, Kamis', 'Monday, Wednesday, Thursday'], ['Jumat, Sabtu', 'Friday, Saturday']] },
  { text: 'Aku bilangan dua angka. Angka puluhanku 4. Jumlah kedua angkaku 9. Bilangan berapakah aku?', opts: ['45', '49', '54', '94'], key: 0, terms: [['bilangan dua angka', 'two-digit number'], ['angka puluhan', 'tens digit'], ['jumlah', 'sum, total'], ['kedua angka', 'both digits']] },
  { text: 'Seekor katak melompat di atas batu bernomor dengan pola yang sama. Mula-mula katak di batu 1, lalu ke batu 3, 5, dan 7. Di batu nomor berapa katak berada setelah lompatan ke-5?', opts: ['9', '10', '11', '13'], key: 2, stones: true, terms: [['lompatan', 'jump'], ['ke-5', '5th, fifth'], ['pola', 'pattern'], ['batu bernomor', 'numbered stones'], ['mula-mula', 'at first']] },
  { text: 'Rani mulai membaca pukul 07.15. Ia membaca selama 30 menit. Pukul berapa Rani selesai membaca?', opts: ['08.15', '08.00', '07.30', '07.45'], key: 3, terms: [['mulai', 'starts'], ['selama 30 menit', 'for 30 minutes'], ['pukul berapa', 'what time'], ['selesai', 'finishes']] },
  { text: 'Lima anak berbaris. Eka paling depan. Budi paling belakang. Dodi di depan Ani, dan Ani di depan Caca. Siapa yang berada di urutan ketiga dari depan?', opts: ['Dodi', 'Ani', 'Caca', 'Eka'], key: 1, terms: [['berbaris', 'stand in a line'], ['paling depan', 'at the very front'], ['paling belakang', 'at the very back'], ['urutan ketiga', 'third place']] },
  { text: 'Ada 4 kotak pensil. Setiap kotak berisi 6 pensil. Berapa banyak pensil seluruhnya?', opts: ['10', '20', '24', '28'], key: 2, terms: [['kotak', 'box'], ['setiap', 'each'], ['berisi', 'holds'], ['seluruhnya', 'altogether']] },
  { text: 'Ibu membeli 15 kue. Adik makan 6 kue, lalu 4 kue diberikan kepada tetangga. Berapa kue yang tersisa?', opts: ['5', '9', '11', '25'], key: 0, terms: [['membeli', 'buys'], ['diberikan kepada', 'given to'], ['tetangga', 'neighbour'], ['tersisa', 'left over']] },
  { text: 'Berapa banyak sisi pada sebuah kubus?', opts: ['4', '6', '8', '12'], key: 1, terms: [['sisi', 'face'], ['kubus', 'cube'], ['berapa banyak', 'how many']] },
  { text: 'Sebuah persegi panjang mempunyai panjang 6 cm dan lebar 4 cm. Berapa keliling persegi panjang itu?', opts: ['10 cm', '24 cm', '16 cm', '20 cm'], key: 3, terms: [['persegi panjang', 'rectangle'], ['panjang', 'length'], ['lebar', 'width'], ['keliling', 'perimeter']] },
  { text: 'Perhatikan pola bilangan 2, 5, 8, 11, ... Bilangan berikutnya adalah ...', opts: ['12', '13', '14', '15'], key: 2, terms: [['perhatikan', 'look at'], ['pola bilangan', 'number pattern'], ['berikutnya', 'next']] },
]

export function esmoItems(count = 10): RunnerItem[] {
  return asRunner(
    Array.from({ length: count }, (_, i) => {
      const q = ESMO[i % ESMO.length]!
      return make(
        {
          id: `m2.esmo-practice.${String(i + 1).padStart(3, '0')}`,
          skill: 'm2.esmo-practice',
          type: 'mcq',
          difficulty: 4,
          lang: 'id',
          prompt: q.text,
          options: q.opts.map((text) => ({ text })),
          answer: q.key,
          tags: ['esmo'],
          terms: q.terms.map(([term, en]) => ({ term, en })),
          ...(q.stones
            ? { figure: { kind: 'sequence', items: ['1', '2', '3', '4', '5', '6', '7', '8'], style: 'stones', alt: 'Batu bernomor 1 sampai 8 di atas air. Katak duduk di batu 1.' } }
            : {}),
          hints: ['Baca soal pelan-pelan.', 'Tulis yang kamu tahu.', 'Coba setiap pilihan.'],
          explanation: `Jawabannya ${q.opts[q.key] ?? ''}.`,
        },
        { key: false },
      )
    }),
  )
}

/** Soal angka cepat untuk mode kilat. */
export function sprintItems(): RunnerItem[] {
  const facts: [number, number][] = [[6, 2], [5, 4], [3, 3], [10, 2], [4, 2], [5, 5], [2, 7], [10, 3], [5, 3], [2, 9], [10, 6], [5, 6], [2, 8], [3, 2], [10, 9], [5, 9]]
  return asRunner(
    facts.map(([a, b], i) =>
      make({
        id: `m2.times-facts.${String(i + 1).padStart(3, '0')}`,
        skill: 'm2.times-facts',
        type: 'numeric',
        difficulty: 1,
        prompt: `${a} × ${b} = ?`,
        answer: a * b,
        hints: [`Count in ${b}s.`, `${a} groups of ${b}.`, `Start at ${b} and count on.`],
        explanation: `${a} times ${b} is ${a * b}.`,
      }),
    ),
    'sprint',
  )
}
