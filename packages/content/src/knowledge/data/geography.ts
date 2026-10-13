/**
 * Topik geografi: bendera, ibu kota negara, provinsi Indonesia, benua dan samudra.
 */
import type { KAsk, KFact, KOrderSet, KTopic } from '../types'
import { CONTINENTS, COUNTRIES, type Country } from './countries'

const flagPic = (c: Country) => ({ t: 'flag' as const, code: c.iso })

/**
 * Bendera yang mirip satu sama lain. Dua negara dalam satu kelompok tidak pernah menjadi pilihan
 * di soal yang sama, supaya jawabannya tidak ambigu.
 */
export const LOOKALIKES: readonly (readonly string[])[] = [
  ['id', 'mc', 'pl'],
  ['ro', 'td', 'ad', 'md'],
  ['nl', 'lu'],
  ['ie', 'ci', 'it'],
  ['ru', 'sk', 'si'],
  ['au', 'nz'],
  ['ml', 'gn', 'sn', 'cm'],
  ['gh', 'et', 'bo', 'lt'],
  ['eg', 'ye', 'sy', 'iq', 'sd'],
  ['us', 'lr'],
  ['at', 'lv'],
  ['ve', 'co', 'ec'],
  ['sv', 'ni', 'hn'],
  ['ar', 'uy'],
  ['th', 'cr'],
  ['tr', 'tn'],
  ['dk', 'no', 'is', 'fi', 'se'],
]

function similarNames(c: Country): string[] {
  const group = LOOKALIKES.filter((g) => g.includes(c.iso)).flat()
  return COUNTRIES.filter((x) => x.iso !== c.iso && group.includes(x.iso)).map((x) => x.name)
}

// ---------------------------------------------------------------------------
// Bendera

function flagFact(c: Country): KFact {
  const exclude = similarNames(c)
  const asks: KAsk[] = [
    {
      prompt: 'Which country does this flag belong to?',
      pic: flagPic(c),
      answer: { label: c.name },
      pool: 'country',
      group: c.continent,
      mode: 'near',
      exclude,
      statement: (l) => `This is the flag of ${l}.`,
      explain: `This is the flag of ${c.name}. It is in ${c.continent}.`,
    },
    {
      prompt: `Which flag belongs to ${c.name}?`,
      answer: { label: c.name, pic: flagPic(c) },
      pool: 'flag',
      group: c.continent,
      mode: 'near',
      exclude,
      style: 'pics',
      explain: `That is the flag of ${c.name}.`,
    },
  ]
  return {
    id: `flag:${c.iso}`,
    topic: 'flags',
    group: c.continent,
    tier: c.tier,
    card: {
      front: 'Which country is this?',
      frontPic: flagPic(c),
      back: c.capital ? `${c.name}. It is in ${c.continent}. The capital is ${c.capital}.` : `${c.name}. It is in ${c.continent}.`,
    },
    asks,
  }
}

export const FLAGS_TOPIC: KTopic = {
  id: 'flags',
  title: 'World flags',
  blurb: 'Learn the flags of the countries of the world.',
  pic: { t: 'flag', code: 'id' },
  pictures: true,
  facts: COUNTRIES.map(flagFact),
  orders: [],
}

// ---------------------------------------------------------------------------
// Ibu kota negara

function capitalFact(c: Country): KFact {
  const capital = c.capital as string
  return {
    id: `cap:${c.iso}`,
    topic: 'capitals',
    group: c.continent,
    tier: c.tier,
    card: { front: c.name, frontPic: flagPic(c), back: `The capital is ${capital}.` },
    asks: [
      {
        prompt: `What is the capital of ${c.name}?`,
        pic: flagPic(c),
        answer: { label: capital },
        pool: 'capital',
        group: c.continent,
        mode: 'near',
        statement: (l) => `The capital of ${c.name} is ${l}.`,
        explain: `${capital} is the capital of ${c.name}.`,
      },
      {
        prompt: `${capital} is the capital of which country?`,
        answer: { label: c.name },
        pool: 'country',
        group: c.continent,
        mode: 'near',
        explain: `${capital} is the capital of ${c.name}.`,
      },
    ],
  }
}

export const CAPITALS_TOPIC: KTopic = {
  id: 'capitals',
  title: 'Capital cities',
  blurb: 'Match each country with its capital city.',
  pic: { t: 'icon', name: 'house' },
  pictures: true,
  facts: COUNTRIES.filter((c) => c.capital !== null).map(capitalFact),
  orders: [],
}

// ---------------------------------------------------------------------------
// Provinsi Indonesia (38 provinsi sejak 2022)

export const REGIONS = ['Sumatra', 'Java', 'Bali and Nusa Tenggara', 'Kalimantan', 'Sulawesi', 'Maluku', 'Papua'] as const

type Province = { id: string; name: string; capital: string; region: (typeof REGIONS)[number] }

export const PROVINCES: readonly Province[] = [
  { id: 'aceh', name: 'Aceh', capital: 'Banda Aceh', region: 'Sumatra' },
  { id: 'sumut', name: 'Sumatera Utara', capital: 'Medan', region: 'Sumatra' },
  { id: 'sumbar', name: 'Sumatera Barat', capital: 'Padang', region: 'Sumatra' },
  { id: 'riau', name: 'Riau', capital: 'Pekanbaru', region: 'Sumatra' },
  { id: 'kepri', name: 'Kepulauan Riau', capital: 'Tanjungpinang', region: 'Sumatra' },
  { id: 'jambi', name: 'Jambi', capital: 'Jambi', region: 'Sumatra' },
  { id: 'sumsel', name: 'Sumatera Selatan', capital: 'Palembang', region: 'Sumatra' },
  { id: 'babel', name: 'Kepulauan Bangka Belitung', capital: 'Pangkalpinang', region: 'Sumatra' },
  { id: 'bengkulu', name: 'Bengkulu', capital: 'Bengkulu', region: 'Sumatra' },
  { id: 'lampung', name: 'Lampung', capital: 'Bandar Lampung', region: 'Sumatra' },
  { id: 'jakarta', name: 'DKI Jakarta', capital: 'Jakarta', region: 'Java' },
  { id: 'banten', name: 'Banten', capital: 'Serang', region: 'Java' },
  { id: 'jabar', name: 'Jawa Barat', capital: 'Bandung', region: 'Java' },
  { id: 'jateng', name: 'Jawa Tengah', capital: 'Semarang', region: 'Java' },
  { id: 'diy', name: 'DI Yogyakarta', capital: 'Yogyakarta', region: 'Java' },
  { id: 'jatim', name: 'Jawa Timur', capital: 'Surabaya', region: 'Java' },
  { id: 'bali', name: 'Bali', capital: 'Denpasar', region: 'Bali and Nusa Tenggara' },
  { id: 'ntb', name: 'Nusa Tenggara Barat', capital: 'Mataram', region: 'Bali and Nusa Tenggara' },
  { id: 'ntt', name: 'Nusa Tenggara Timur', capital: 'Kupang', region: 'Bali and Nusa Tenggara' },
  { id: 'kalbar', name: 'Kalimantan Barat', capital: 'Pontianak', region: 'Kalimantan' },
  { id: 'kalteng', name: 'Kalimantan Tengah', capital: 'Palangka Raya', region: 'Kalimantan' },
  { id: 'kalsel', name: 'Kalimantan Selatan', capital: 'Banjarmasin', region: 'Kalimantan' },
  { id: 'kaltim', name: 'Kalimantan Timur', capital: 'Samarinda', region: 'Kalimantan' },
  { id: 'kaltara', name: 'Kalimantan Utara', capital: 'Tanjung Selor', region: 'Kalimantan' },
  { id: 'sulut', name: 'Sulawesi Utara', capital: 'Manado', region: 'Sulawesi' },
  { id: 'gorontalo', name: 'Gorontalo', capital: 'Gorontalo', region: 'Sulawesi' },
  { id: 'sulteng', name: 'Sulawesi Tengah', capital: 'Palu', region: 'Sulawesi' },
  { id: 'sulbar', name: 'Sulawesi Barat', capital: 'Mamuju', region: 'Sulawesi' },
  { id: 'sulsel', name: 'Sulawesi Selatan', capital: 'Makassar', region: 'Sulawesi' },
  { id: 'sultra', name: 'Sulawesi Tenggara', capital: 'Kendari', region: 'Sulawesi' },
  { id: 'maluku', name: 'Maluku', capital: 'Ambon', region: 'Maluku' },
  { id: 'malut', name: 'Maluku Utara', capital: 'Sofifi', region: 'Maluku' },
  { id: 'papbar', name: 'Papua Barat', capital: 'Manokwari', region: 'Papua' },
  { id: 'papbd', name: 'Papua Barat Daya', capital: 'Sorong', region: 'Papua' },
  { id: 'papua', name: 'Papua', capital: 'Jayapura', region: 'Papua' },
  { id: 'papteng', name: 'Papua Tengah', capital: 'Nabire', region: 'Papua' },
  { id: 'pappeg', name: 'Papua Pegunungan', capital: 'Wamena', region: 'Papua' },
  { id: 'papsel', name: 'Papua Selatan', capital: 'Merauke', region: 'Papua' },
]

function provinceFact(p: Province): KFact {
  return {
    id: `prov:${p.id}`,
    topic: 'provinces',
    group: p.region,
    tier: 1,
    card: { front: p.name, back: `The capital is ${p.capital}. It is in ${p.region}.` },
    asks: [
      {
        prompt: `What is the capital of ${p.name}?`,
        answer: { label: p.capital },
        pool: 'pcap',
        group: p.region,
        mode: 'near',
        statement: (l) => `The capital of ${p.name} is ${l}.`,
        explain: `${p.capital} is the capital of ${p.name}.`,
      },
      {
        prompt: `${p.capital} is the capital of which province?`,
        answer: { label: p.name },
        pool: 'prov',
        group: p.region,
        mode: 'near',
        explain: `${p.capital} is the capital of ${p.name}.`,
      },
      {
        prompt: `Which part of Indonesia is ${p.name} in?`,
        answer: { label: p.region },
        pool: '',
        wrong: REGIONS.filter((r) => r !== p.region),
        explain: `${p.name} is in ${p.region}.`,
      },
    ],
  }
}

export const PROVINCES_TOPIC: KTopic = {
  id: 'provinces',
  title: 'Provinces of Indonesia',
  blurb: 'All 38 provinces and their capital cities.',
  pic: { t: 'icon', name: 'volcano' },
  pictures: false,
  facts: PROVINCES.map(provinceFact),
  orders: [],
}

// ---------------------------------------------------------------------------
// Benua dan samudra

const CONTINENT_LABELS = ['Asia', 'Africa', 'North America', 'South America', 'Antarctica', 'Europe', 'Oceania'] as const
const OCEAN_LABELS = ['Pacific Ocean', 'Atlantic Ocean', 'Indian Ocean', 'Southern Ocean', 'Arctic Ocean'] as const

const others = (list: readonly string[], answer: string): string[] => list.filter((x) => x !== answer)

function contStatic(
  id: string,
  group: 'continent' | 'ocean' | 'place',
  prompt: string,
  answer: string,
  list: readonly string[],
  explain: string,
  card: { front: string; back: string },
  statement?: (label: string) => string,
): KFact {
  return {
    id: `cont:${id}`,
    topic: 'continents',
    group,
    tier: 1,
    card,
    asks: [{ prompt, answer: { label: answer }, pool: '', wrong: others(list, answer), explain, ...(statement ? { statement } : {}) }],
  }
}

const TRANSCONTINENTAL = new Set(['ru', 'tr', 'eg', 'kz'])

function countryContinentFact(c: Country): KFact {
  return {
    id: `cont:in-${c.iso}`,
    topic: 'continents',
    group: 'country',
    tier: 1,
    card: { front: c.name, frontPic: flagPic(c), back: `${c.name} is in ${c.continent}.` },
    asks: [
      {
        prompt: `Which continent is ${c.name} in?`,
        pic: flagPic(c),
        answer: { label: c.continent },
        pool: '',
        wrong: others(CONTINENT_LABELS, c.continent),
        statement: (l) => `${c.name} is in ${l}.`,
        explain: `${c.name} is in ${c.continent}.`,
      },
    ],
  }
}

const CONTINENT_FACTS: KFact[] = [
  contStatic('count', 'continent', 'How many continents are there?', '7', ['5', '6', '7', '8', '9'], 'There are 7 continents: Asia, Africa, North America, South America, Antarctica, Europe and Oceania.', {
    front: 'How many continents are there?',
    back: '7 continents: Asia, Africa, North America, South America, Antarctica, Europe and Oceania.',
  }, (l) => `There are ${l} continents.`),
  contStatic('oceans', 'ocean', 'How many oceans are there?', '5', ['3', '4', '5', '6', '7'], 'There are 5 oceans: Pacific, Atlantic, Indian, Southern and Arctic.', {
    front: 'How many oceans are there?',
    back: '5 oceans: Pacific, Atlantic, Indian, Southern and Arctic.',
  }, (l) => `There are ${l} oceans.`),
  contStatic('biggest', 'continent', 'Which is the biggest continent?', 'Asia', CONTINENT_LABELS, 'Asia is the biggest continent. Indonesia is in Asia.', { front: 'The biggest continent', back: 'Asia' }, (l) => `${l} is the biggest continent.`),
  contStatic('smallest', 'continent', 'Which is the smallest continent?', 'Oceania', CONTINENT_LABELS, 'Oceania is the smallest continent. It has Australia, New Zealand and many islands.', { front: 'The smallest continent', back: 'Oceania' }, (l) => `${l} is the smallest continent.`),
  contStatic('coldest', 'continent', 'Which continent is the coldest?', 'Antarctica', CONTINENT_LABELS, 'Antarctica is the coldest continent. It is covered in ice.', { front: 'The coldest continent', back: 'Antarctica' }, (l) => `${l} is the coldest continent.`),
  contStatic('most', 'continent', 'Which continent has the most countries?', 'Africa', CONTINENT_LABELS, 'Africa has 54 countries, more than any other continent.', { front: 'The continent with the most countries', back: 'Africa (54 countries)' }, (l) => `${l} has the most countries.`),
  contStatic('sahara', 'place', 'The Sahara Desert is on which continent?', 'Africa', CONTINENT_LABELS, 'The Sahara Desert is in Africa. It is the biggest hot desert in the world.', { front: 'The Sahara Desert', back: 'Africa' }, (l) => `The Sahara Desert is in ${l}.`),
  contStatic('amazon', 'place', 'The Amazon rainforest is on which continent?', 'South America', CONTINENT_LABELS, 'The Amazon rainforest is in South America, mostly in Brazil.', { front: 'The Amazon rainforest', back: 'South America' }, (l) => `The Amazon rainforest is in ${l}.`),
  contStatic('everest', 'place', 'Mount Everest is on which continent?', 'Asia', CONTINENT_LABELS, 'Mount Everest is in Asia, on the border of Nepal and China. It is the highest mountain in the world.', { front: 'Mount Everest', back: 'Asia' }, (l) => `Mount Everest is in ${l}.`),
  contStatic('kangaroo', 'place', 'Wild kangaroos live on which continent?', 'Oceania', CONTINENT_LABELS, 'Kangaroos live in Australia, which is part of Oceania.', { front: 'Wild kangaroos', back: 'Oceania (Australia)' }, (l) => `Wild kangaroos live in ${l}.`),
  contStatic('pacific', 'ocean', 'Which is the biggest ocean?', 'Pacific Ocean', OCEAN_LABELS, 'The Pacific Ocean is the biggest and deepest ocean.', { front: 'The biggest ocean', back: 'The Pacific Ocean' }, (l) => `The ${l} is the biggest ocean.`),
  contStatic('arctic', 'ocean', 'Which is the smallest ocean?', 'Arctic Ocean', OCEAN_LABELS, 'The Arctic Ocean is the smallest ocean. It is around the North Pole.', { front: 'The smallest ocean', back: 'The Arctic Ocean' }, (l) => `The ${l} is the smallest ocean.`),
  contStatic('indian', 'ocean', 'Which ocean is between Africa, Asia and Australia?', 'Indian Ocean', OCEAN_LABELS, 'The Indian Ocean lies between Africa, Asia and Australia.', { front: 'The ocean between Africa, Asia and Australia', back: 'The Indian Ocean' }, (l) => `The ${l} is between Africa, Asia and Australia.`),
  contStatic('southern', 'ocean', 'Which ocean is around Antarctica?', 'Southern Ocean', OCEAN_LABELS, 'The Southern Ocean surrounds Antarctica.', { front: 'The ocean around Antarctica', back: 'The Southern Ocean' }, (l) => `The ${l} is around Antarctica.`),
  contStatic('northpole', 'ocean', 'Which ocean is around the North Pole?', 'Arctic Ocean', OCEAN_LABELS, 'The Arctic Ocean is around the North Pole.', { front: 'The ocean around the North Pole', back: 'The Arctic Ocean' }, (l) => `The ${l} is around the North Pole.`),
  contStatic('atlantic', 'ocean', 'Which ocean is between Europe and North America?', 'Atlantic Ocean', OCEAN_LABELS, 'The Atlantic Ocean lies between Europe and Africa on one side and the Americas on the other.', {
    front: 'The ocean between Europe and North America',
    back: 'The Atlantic Ocean',
  }, (l) => `The ${l} is between Europe and North America.`),
  // Negara yang membentang di dua benua (Rusia, Turki, Mesir) tidak ditanyakan: jawabannya bisa dua.
  ...COUNTRIES.filter((c) => c.tier === 1 && !TRANSCONTINENTAL.has(c.iso)).map(countryContinentFact),
]

const CONTINENT_ORDERS: KOrderSet[] = [
  {
    id: 'continents-size',
    topic: 'continents',
    prompt: 'Tap the continents from the biggest to the smallest.',
    items: [
      { id: 'asia', label: 'Asia' },
      { id: 'africa', label: 'Africa' },
      { id: 'namerica', label: 'North America' },
      { id: 'samerica', label: 'South America' },
      { id: 'antarctica', label: 'Antarctica' },
      { id: 'europe', label: 'Europe' },
      { id: 'oceania', label: 'Oceania' },
    ],
    pick: 4,
    explain: 'From the biggest: Asia, Africa, North America, South America, Antarctica, Europe, Oceania.',
  },
]

export const CONTINENTS_TOPIC: KTopic = {
  id: 'continents',
  title: 'Continents and oceans',
  blurb: 'The seven continents, the five oceans and where places are.',
  pic: { t: 'icon', name: 'earth' },
  pictures: true,
  facts: CONTINENT_FACTS,
  orders: CONTINENT_ORDERS,
}

export { CONTINENTS }
