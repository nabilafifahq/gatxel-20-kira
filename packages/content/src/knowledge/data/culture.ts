/**
 * Topik budaya: penemu dan tokoh sains, bangunan terkenal dunia, alat musik.
 */
import type { IconName } from '@kira/figures/spec'
import type { KAsk, KFact, KTopic } from '../types'

const without = (list: readonly string[], x: string): string[] => list.filter((y) => y !== x)

// ---------------------------------------------------------------------------
// Penemu dan tokoh sains

type Person = { id: string; name: string; tier: 1 | 2; q: string; s: (l: string) => string; explain: string; exclude?: string[] }

const PEOPLE: readonly Person[] = [
  { id: 'bell', name: 'Alexander Graham Bell', tier: 1, q: 'Who made the first working telephone?', s: (l) => `${l} made the first working telephone.`, explain: 'Alexander Graham Bell made the first working telephone in 1876.' },
  { id: 'edison', name: 'Thomas Edison', tier: 1, q: 'Who is famous for making a light bulb that lasted a long time?', s: (l) => `${l} made a light bulb that lasted a long time.`, explain: 'Thomas Edison and his team made a long-lasting light bulb in 1879.' },
  { id: 'wright', name: 'The Wright brothers', tier: 1, q: 'Who made the first aeroplane flight with an engine?', s: (l) => `${l} made the first aeroplane flight with an engine.`, explain: 'Orville and Wilbur Wright flew the first aeroplane with an engine in 1903.' },
  { id: 'newton', name: 'Isaac Newton', tier: 1, q: 'Which scientist is famous for the three laws of motion?', s: (l) => `${l} is famous for the three laws of motion.`, explain: 'Isaac Newton wrote the three laws of motion and explained gravity.' },
  { id: 'einstein', name: 'Albert Einstein', tier: 1, q: 'Which scientist is famous for the theory of relativity?', s: (l) => `${l} is famous for the theory of relativity.`, explain: 'Albert Einstein came up with the theory of relativity.' },
  { id: 'habibie', name: 'B. J. Habibie', tier: 1, q: 'Which president of Indonesia was also an aircraft engineer?', s: (l) => `${l} was a president of Indonesia and an aircraft engineer.`, explain: 'B. J. Habibie was an aircraft engineer and the third president of Indonesia.' },
  { id: 'kartini', name: 'R. A. Kartini', tier: 1, q: 'Who is the Indonesian hero who fought for girls to go to school?', s: (l) => `${l} fought for girls to go to school.`, explain: 'R. A. Kartini fought for girls to go to school. Kartini Day is on 21 April.' },
  { id: 'dewantara', name: 'Ki Hajar Dewantara', tier: 2, q: 'Who is known as the father of education in Indonesia?', s: (l) => `${l} is known as the father of education in Indonesia.`, explain: 'Ki Hajar Dewantara started schools for all children. National Education Day is on 2 May.' },
  { id: 'curie', name: 'Marie Curie', tier: 2, q: 'Which scientist found the elements polonium and radium?', s: (l) => `${l} found the elements polonium and radium.`, explain: 'Marie Curie found polonium and radium. She won two Nobel Prizes.' },
  { id: 'fleming', name: 'Alexander Fleming', tier: 2, q: 'Who discovered penicillin, the first antibiotic medicine?', s: (l) => `${l} discovered penicillin.`, explain: 'Alexander Fleming discovered penicillin in 1928.' },
  { id: 'darwin', name: 'Charles Darwin', tier: 2, q: 'Who wrote about evolution by natural selection?', s: (l) => `${l} wrote about evolution by natural selection.`, explain: 'Charles Darwin wrote about evolution after he studied animals on many islands.' },
  { id: 'berners', name: 'Tim Berners-Lee', tier: 2, q: 'Who invented the World Wide Web?', s: (l) => `${l} invented the World Wide Web.`, explain: 'Tim Berners-Lee invented the World Wide Web in 1989.' },
  { id: 'gutenberg', name: 'Johannes Gutenberg', tier: 2, q: 'Who made the printing press with moving letters in Europe?', s: (l) => `${l} made the printing press with moving letters in Europe.`, explain: 'Johannes Gutenberg made the printing press with moving letters, around 1440.' },
  { id: 'jenner', name: 'Edward Jenner', tier: 2, q: 'Who made the first vaccine, against smallpox?', s: (l) => `${l} made the first vaccine.`, explain: 'Edward Jenner made the first vaccine, against smallpox, in 1796.' },
  { id: 'pasteur', name: 'Louis Pasteur', tier: 2, q: 'Which scientist is famous for pasteurisation, which makes milk safe to drink?', s: (l) => `${l} is famous for pasteurisation.`, explain: 'Louis Pasteur showed that heating milk kills germs. We call this pasteurisation.' },
  { id: 'galileo', name: 'Galileo Galilei', tier: 2, q: 'Who used a telescope to see the moons of Jupiter?', s: (l) => `${l} used a telescope to see the moons of Jupiter.`, explain: 'Galileo Galilei saw the moons of Jupiter with his telescope in 1610.' },
  { id: 'volta', name: 'Alessandro Volta', tier: 2, q: 'Who made the first electric battery?', s: (l) => `${l} made the first electric battery.`, explain: 'Alessandro Volta made the first electric battery around 1800.' },
  { id: 'marconi', name: 'Guglielmo Marconi', tier: 2, q: 'Who sent radio signals across the Atlantic Ocean in 1901?', s: (l) => `${l} sent radio signals across the Atlantic Ocean.`, explain: 'Guglielmo Marconi sent radio signals across the Atlantic Ocean in 1901.' },
  { id: 'braille', name: 'Louis Braille', tier: 2, q: 'Who made a way of reading with raised dots for blind people?', s: (l) => `${l} made a way of reading with raised dots.`, explain: 'Louis Braille made braille, a way of reading with raised dots, when he was a teenager.' },
  { id: 'babbage', name: 'Charles Babbage', tier: 2, q: 'Who designed an early computer called the Analytical Engine?', s: (l) => `${l} designed an early computer called the Analytical Engine.`, explain: 'Charles Babbage designed the Analytical Engine, an early computer, in the 1830s.', exclude: ['Ada Lovelace'] },
  { id: 'lovelace', name: 'Ada Lovelace', tier: 2, q: 'Who wrote the first computer program, long ago?', s: (l) => `${l} wrote the first computer program.`, explain: 'Ada Lovelace wrote the first computer program in the 1840s.', exclude: ['Charles Babbage'] },
  { id: 'nobel', name: 'Alfred Nobel', tier: 2, q: 'Who invented dynamite and started the Nobel Prizes?', s: (l) => `${l} invented dynamite and started the Nobel Prizes.`, explain: 'Alfred Nobel invented dynamite. He left his money to start the Nobel Prizes.' },
  { id: 'goddard', name: 'Robert Goddard', tier: 2, q: 'Who built the first rocket that used liquid fuel?', s: (l) => `${l} built the first rocket that used liquid fuel.`, explain: 'Robert Goddard launched the first rocket that used liquid fuel in 1926.' },
  { id: 'hawking', name: 'Stephen Hawking', tier: 2, q: 'Which British scientist is famous for his work on black holes?', s: (l) => `${l} is famous for his work on black holes.`, explain: 'Stephen Hawking is famous for his work on black holes and the universe.' },
  { id: 'mendeleev', name: 'Dmitri Mendeleev', tier: 2, q: 'Who made the first periodic table of the elements?', s: (l) => `${l} made the first periodic table of the elements.`, explain: 'Dmitri Mendeleev made the first periodic table in 1869.' },
  { id: 'cailun', name: 'Cai Lun', tier: 2, q: 'Who is said to have invented paper in China?', s: (l) => `${l} is said to have invented paper.`, explain: 'Cai Lun is said to have invented paper in China about 2,000 years ago.' },
  { id: 'copernicus', name: 'Nicolaus Copernicus', tier: 2, q: 'Who said that the Earth goes around the Sun?', s: (l) => `${l} said that the Earth goes around the Sun.`, explain: 'Nicolaus Copernicus said that the Earth goes around the Sun.' },
  { id: 'tesla', name: 'Nikola Tesla', tier: 2, q: 'Who worked on alternating current (AC) electricity?', s: (l) => `${l} worked on alternating current electricity.`, explain: 'Nikola Tesla worked on alternating current, the kind of electricity in our homes.' },
]

function personFact(p: Person): KFact {
  return {
    id: `inv:${p.id}`,
    topic: 'inventors',
    group: 'people',
    tier: p.tier,
    card: { front: p.name, back: p.explain },
    asks: [{ prompt: p.q, answer: { label: p.name }, pool: 'person', mode: 'any', ...(p.exclude ? { exclude: p.exclude } : {}), statement: p.s, explain: p.explain }],
  }
}

export const INVENTORS_TOPIC: KTopic = {
  id: 'inventors',
  title: 'Inventors and scientists',
  blurb: 'People who changed the world with ideas.',
  pic: { t: 'icon', name: 'bulb' },
  pictures: false,
  facts: PEOPLE.map(personFact),
  orders: [],
}

// ---------------------------------------------------------------------------
// Bangunan terkenal dunia

type Landmark = { id: string; name: string; the: string; plural?: boolean; country: string; tier: 1 | 2; fact: string }

const LANDMARKS: readonly Landmark[] = [
  { id: 'eiffel', name: 'Eiffel Tower', the: 'The Eiffel Tower', country: 'France', tier: 1, fact: 'The Eiffel Tower is a tall iron tower in Paris.' },
  { id: 'greatwall', name: 'Great Wall', the: 'The Great Wall', country: 'China', tier: 1, fact: 'The Great Wall of China is a very long wall built to guard the north of China.' },
  { id: 'tajmahal', name: 'Taj Mahal', the: 'The Taj Mahal', country: 'India', tier: 1, fact: 'The Taj Mahal is a white marble building in Agra.' },
  { id: 'liberty', name: 'Statue of Liberty', the: 'The Statue of Liberty', country: 'United States', tier: 1, fact: 'The Statue of Liberty stands in New York Harbor.' },
  { id: 'colosseum', name: 'Colosseum', the: 'The Colosseum', country: 'Italy', tier: 1, fact: 'The Colosseum is a huge old stadium in Rome.' },
  { id: 'pisa', name: 'Leaning Tower of Pisa', the: 'The Leaning Tower of Pisa', country: 'Italy', tier: 1, fact: 'The Leaning Tower of Pisa leans to one side.' },
  { id: 'pyramids', name: 'Pyramids of Giza', the: 'The Pyramids of Giza', plural: true, country: 'Egypt', tier: 1, fact: 'The Pyramids of Giza are huge stone tombs built about 4,500 years ago.' },
  { id: 'bigben', name: 'Big Ben', the: 'Big Ben', country: 'United Kingdom', tier: 1, fact: 'Big Ben is the famous bell in the clock tower in London.' },
  { id: 'opera', name: 'Sydney Opera House', the: 'The Sydney Opera House', country: 'Australia', tier: 1, fact: 'The Sydney Opera House has a roof like white sails.' },
  { id: 'christ', name: 'Christ the Redeemer', the: 'Christ the Redeemer', country: 'Brazil', tier: 2, fact: 'Christ the Redeemer is a huge statue above Rio de Janeiro.' },
  { id: 'machu', name: 'Machu Picchu', the: 'Machu Picchu', country: 'Peru', tier: 2, fact: 'Machu Picchu is an old city high in the Andes mountains.' },
  { id: 'petra', name: 'Petra', the: 'Petra', country: 'Jordan', tier: 2, fact: 'Petra is an old city carved into pink rock.' },
  { id: 'angkor', name: 'Angkor Wat', the: 'Angkor Wat', country: 'Cambodia', tier: 1, fact: 'Angkor Wat is the biggest temple in the world.' },
  { id: 'borobudur', name: 'Borobudur', the: 'Borobudur', country: 'Indonesia', tier: 1, fact: 'Borobudur is a huge Buddhist temple near Magelang in Central Java.' },
  { id: 'prambanan', name: 'Prambanan', the: 'Prambanan', country: 'Indonesia', tier: 1, fact: 'Prambanan is a big Hindu temple near Yogyakarta.' },
  { id: 'monas', name: 'Monas', the: 'Monas', country: 'Indonesia', tier: 1, fact: 'Monas, the National Monument, stands in the middle of Jakarta.' },
  { id: 'bromo', name: 'Mount Bromo', the: 'Mount Bromo', country: 'Indonesia', tier: 2, fact: 'Mount Bromo is an active volcano in East Java.' },
  { id: 'komodo-park', name: 'Komodo National Park', the: 'Komodo National Park', country: 'Indonesia', tier: 2, fact: 'Komodo National Park is home to the Komodo dragon.' },
  { id: 'fuji', name: 'Mount Fuji', the: 'Mount Fuji', country: 'Japan', tier: 1, fact: 'Mount Fuji is the tallest mountain in Japan.' },
  { id: 'burj', name: 'Burj Khalifa', the: 'The Burj Khalifa', country: 'United Arab Emirates', tier: 1, fact: 'The Burj Khalifa in Dubai is one of the tallest buildings in the world.' },
  { id: 'stonehenge', name: 'Stonehenge', the: 'Stonehenge', country: 'United Kingdom', tier: 2, fact: 'Stonehenge is a circle of big standing stones in England.' },
  { id: 'petronas', name: 'Petronas Twin Towers', the: 'The Petronas Twin Towers', plural: true, country: 'Malaysia', tier: 1, fact: 'The Petronas Twin Towers are two tall towers in Kuala Lumpur.' },
  { id: 'merlion', name: 'Merlion', the: 'The Merlion', country: 'Singapore', tier: 1, fact: 'The Merlion is a statue with a lion head and a fish body.' },
  { id: 'grandcanyon', name: 'Grand Canyon', the: 'The Grand Canyon', country: 'United States', tier: 2, fact: 'The Grand Canyon is a giant valley cut by the Colorado River.' },
  { id: 'reef', name: 'Great Barrier Reef', the: 'The Great Barrier Reef', country: 'Australia', tier: 2, fact: 'The Great Barrier Reef is the biggest coral reef in the world.' },
  { id: 'parthenon', name: 'Parthenon', the: 'The Parthenon', country: 'Greece', tier: 2, fact: 'The Parthenon is an old temple in Athens.' },
  { id: 'hagia', name: 'Hagia Sophia', the: 'Hagia Sophia', country: 'Turkey', tier: 2, fact: 'Hagia Sophia is a huge old building with a big dome in Istanbul.' },
  { id: 'kilimanjaro', name: 'Mount Kilimanjaro', the: 'Mount Kilimanjaro', country: 'Tanzania', tier: 2, fact: 'Mount Kilimanjaro is the tallest mountain in Africa.' },
  { id: 'halong', name: 'Ha Long Bay', the: 'Ha Long Bay', country: 'Vietnam', tier: 2, fact: 'Ha Long Bay has thousands of rocky islands in the sea.' },
  { id: 'chichen', name: 'Chichen Itza', the: 'Chichen Itza', country: 'Mexico', tier: 2, fact: 'Chichen Itza is an old Maya city with a big stepped pyramid.' },
  { id: 'brandenburg', name: 'Brandenburg Gate', the: 'The Brandenburg Gate', country: 'Germany', tier: 2, fact: 'The Brandenburg Gate is a famous old gate in Berlin.' },
  { id: 'cntower', name: 'CN Tower', the: 'The CN Tower', country: 'Canada', tier: 2, fact: 'The CN Tower is a very tall tower in Toronto.' },
  { id: 'moai', name: 'Moai statues', the: 'The Moai statues', plural: true, country: 'Chile', tier: 2, fact: 'The Moai are giant stone heads on Easter Island.' },
]

function landmarkFact(l: Landmark): KFact {
  const verb = l.plural ? 'are' : 'is'
  const asks: KAsk[] = [
    {
      prompt: `In which country ${verb} ${l.the.replace(/^The /, 'the ')}?`,
      answer: { label: l.country },
      pool: 'lm-country',
      mode: 'any',
      statement: (c) => `${l.the} ${verb} in ${c}.`,
      explain: `${l.the} ${verb} in ${l.country}.`,
    },
    {
      prompt: `Which of these ${l.plural ? 'are' : 'is'} in ${l.country}?`,
      answer: { label: l.name },
      pool: 'lm-name',
      group: l.country,
      mode: 'far',
      explain: `${l.the} ${verb} in ${l.country}.`,
    },
  ]
  return { id: `lm:${l.id}`, topic: 'landmarks', group: l.country, tier: l.tier, card: { front: l.name, back: `${l.fact} It is in ${l.country}.` }, asks }
}

export const LANDMARKS_TOPIC: KTopic = {
  id: 'landmarks',
  title: 'World landmarks',
  blurb: 'Famous buildings and places around the world.',
  pic: { t: 'icon', name: 'mountain' },
  pictures: false,
  facts: LANDMARKS.map(landmarkFact),
  orders: [],
}

// ---------------------------------------------------------------------------
// Alat musik

const FAMILIES = ['String', 'Woodwind', 'Brass', 'Percussion', 'Keyboard'] as const
type Family = (typeof FAMILIES)[number]
const ISLANDS = ['Sumatra', 'Java', 'Bali and Nusa Tenggara', 'Kalimantan', 'Sulawesi', 'Maluku', 'Papua']

type Instrument = { id: string; name: string; family: Family; icon?: IconName; from?: string; alsoFrom?: string[]; fact: string; clue?: string }

const INSTRUMENTS: readonly Instrument[] = [
  { id: 'violin', name: 'Violin', family: 'String', fact: 'A violin has four strings. You play it with a bow.' },
  { id: 'guitar', name: 'Guitar', family: 'String', icon: 'guitar', fact: 'A guitar has strings that you pluck or strum.' },
  { id: 'cello', name: 'Cello', family: 'String', fact: 'A cello is a big string instrument. You sit down to play it.' },
  { id: 'harp', name: 'Harp', family: 'String', fact: 'A harp has many strings that you pluck with your fingers.' },
  { id: 'piano', name: 'Piano', family: 'Keyboard', fact: 'A piano has black and white keys.' },
  { id: 'organ', name: 'Organ', family: 'Keyboard', fact: 'An organ has keys and pipes, and it can sound very big.' },
  { id: 'flute', name: 'Flute', family: 'Woodwind', fact: 'A flute is a woodwind instrument. You blow across a hole.' },
  { id: 'clarinet', name: 'Clarinet', family: 'Woodwind', fact: 'A clarinet is a woodwind instrument with a single reed.' },
  { id: 'recorder', name: 'Recorder', family: 'Woodwind', fact: 'A recorder is a woodwind instrument that many children learn at school.' },
  { id: 'trumpet', name: 'Trumpet', family: 'Brass', fact: 'A trumpet is a brass instrument with three valves.' },
  { id: 'trombone', name: 'Trombone', family: 'Brass', fact: 'A trombone is a brass instrument with a long slide.' },
  { id: 'tuba', name: 'Tuba', family: 'Brass', fact: 'A tuba is the biggest brass instrument. It plays very low notes.' },
  { id: 'horn', name: 'French horn', family: 'Brass', fact: 'A French horn is a brass instrument with a curly tube.' },
  { id: 'drum', name: 'Drum', family: 'Percussion', icon: 'drum', fact: 'A drum is a percussion instrument. You hit it with sticks or your hands.', clue: 'Tifa' },
  { id: 'xylophone', name: 'Xylophone', family: 'Percussion', fact: 'A xylophone has wooden bars that you hit with mallets.' },
  { id: 'triangle', name: 'Triangle', family: 'Percussion', fact: 'A triangle is a small metal percussion instrument that rings when you hit it.' },
  { id: 'cymbals', name: 'Cymbals', family: 'Percussion', fact: 'Cymbals are two metal plates that crash together.' },
  { id: 'tambourine', name: 'Tambourine', family: 'Percussion', fact: 'A tambourine is a percussion instrument that you shake or tap.' },
  { id: 'angklung', name: 'Angklung', family: 'Percussion', from: 'Java', fact: 'The angklung is made of bamboo tubes in a frame. You shake it to make a note. It comes from West Java.' },
  { id: 'gamelan', name: 'Gamelan', family: 'Percussion', from: 'Java', alsoFrom: ['Bali and Nusa Tenggara'], fact: 'A gamelan is a set of gongs, drums and metal bars played together in Java and Bali.' },
  { id: 'sasando', name: 'Sasando', family: 'String', from: 'Bali and Nusa Tenggara', fact: 'The sasando is a string instrument with a leaf case. It comes from Rote island in East Nusa Tenggara.' },
  { id: 'kolintang', name: 'Kolintang', family: 'Percussion', from: 'Sulawesi', fact: 'The kolintang has wooden bars you hit with mallets. It comes from North Sulawesi.' },
  { id: 'tifa', name: 'Tifa', family: 'Percussion', from: 'Maluku', alsoFrom: ['Papua'], fact: 'The tifa is a drum from Maluku and Papua.' },
  { id: 'suling', name: 'Suling', family: 'Woodwind', fact: 'The suling is a bamboo flute from Indonesia.' },
  { id: 'saluang', name: 'Saluang', family: 'Woodwind', from: 'Sumatra', fact: 'The saluang is a bamboo flute from West Sumatra.' },
  { id: 'kecapi', name: 'Kecapi', family: 'String', fact: 'The kecapi is a plucked string instrument from Indonesia.' },
  { id: 'rebab', name: 'Rebab', family: 'String', fact: 'The rebab is a string instrument that you play with a bow. It is used in the gamelan.' },
]

const lc = (n: string): string => (n === 'French horn' ? n : n.toLowerCase())

function instrumentFact(i: Instrument): KFact {
  const pic = i.icon ? ({ t: 'icon', name: i.icon } as const) : undefined
  const article = /^[AEIOU]/.test(i.name) ? 'an' : 'a'
  const asks: KAsk[] = []
  if (i.id !== 'organ') {
    asks.push({
      prompt: `Which family does the ${lc(i.name)} belong to?`,
      ...(pic ? { pic } : {}),
      answer: { label: i.family },
      pool: '',
      wrong: i.id === 'piano' ? ['Woodwind', 'Brass'] : without(FAMILIES, i.family),
      explain: i.fact,
    })
  }
  asks.push(
    {
      prompt: `Which of these is a ${i.family.toLowerCase()} instrument?`,
      answer: { label: i.name },
      pool: 'inst',
      group: i.family,
      mode: 'far',
      exclude: ['Piano', 'Organ'].filter((x) => x !== i.name),
      explain: i.fact,
    },
  )
  if (pic) {
    asks.push({
      prompt: 'Which instrument is this?',
      pic,
      answer: { label: i.name },
      pool: 'inst-pic',
      draw: ['inst'],
      mode: 'any',
      exclude: i.clue ? [i.clue] : [],
      explain: `This is ${article} ${lc(i.name)}.`,
    })
  }
  if (i.from) {
    const exclude = [i.from, ...(i.alsoFrom ?? [])]
    asks.push({
      prompt: `Which part of Indonesia does the ${lc(i.name)} come from?`,
      answer: { label: i.from },
      pool: '',
      wrong: ISLANDS.filter((x) => !exclude.includes(x)),
      explain: i.fact,
    })
  }
  return { id: `inst:${i.id}`, topic: 'instruments', group: i.family, tier: i.from ? 2 : 1, card: { front: i.name, ...(pic ? { frontPic: pic } : {}), back: i.fact }, asks }
}

const INSTRUMENT_STATIC: KFact[] = [
  {
    id: 'inst:angklung-how',
    topic: 'instruments',
    group: 'Percussion',
    tier: 2,
    card: { front: 'The angklung', back: 'You shake the angklung to make a note. It is made of bamboo.' },
    asks: [
      {
        prompt: 'Which Indonesian instrument is made of bamboo tubes and is played by shaking it?',
        answer: { label: 'Angklung' },
        pool: 'inst',
        group: 'Percussion',
        mode: 'far',
        explain: 'You shake the angklung to make a note. It is made of bamboo.',
      },
    ],
  },
  {
    id: 'inst:sasando-how',
    topic: 'instruments',
    group: 'String',
    tier: 2,
    card: { front: 'The sasando', back: 'The sasando has strings and a case made from lontar palm leaves.' },
    asks: [
      {
        prompt: 'Which Indonesian instrument has strings and a case made from palm leaves?',
        answer: { label: 'Sasando' },
        pool: 'inst',
        group: 'String',
        mode: 'far',
        explain: 'The sasando has strings and a case made from lontar palm leaves.',
      },
    ],
  },
  {
    id: 'inst:gamelan-how',
    topic: 'instruments',
    group: 'Percussion',
    tier: 2,
    card: { front: 'The gamelan', back: 'A gamelan is a group of players with gongs, drums and metal bars.' },
    asks: [
      {
        prompt: 'Which set of gongs, drums and metal bars is played together in Java and Bali?',
        answer: { label: 'Gamelan' },
        pool: 'inst',
        group: 'Percussion',
        mode: 'far',
        explain: 'A gamelan is a group of players with gongs, drums and metal bars.',
      },
    ],
  },
  {
    id: 'inst:orchestra',
    topic: 'instruments',
    group: 'other',
    tier: 1,
    card: { front: 'An orchestra', back: 'An orchestra is a big group of musicians who play together.' },
    asks: [{ prompt: 'What do we call a big group of musicians who play together?', answer: { label: 'An orchestra' }, pool: '', wrong: ['A choir', 'A band stand', 'A duet'], explain: 'An orchestra is a big group of musicians who play together.' }],
    tf: [{ prompt: 'A choir is a group of people who sing together.', truth: true, explain: 'Yes. A choir is a group of people who sing together.' }],
  },
]

export const INSTRUMENTS_TOPIC: KTopic = {
  id: 'instruments',
  title: 'Musical instruments',
  blurb: 'Instruments from the orchestra and from Indonesia.',
  pic: { t: 'icon', name: 'guitar' },
  pictures: false,
  facts: [...INSTRUMENTS.map(instrumentFact), ...INSTRUMENT_STATIC],
  orders: [],
}
