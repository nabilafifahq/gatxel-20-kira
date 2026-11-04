import { BOSSES, bossById, type BossLevel } from './boss'

/**
 * Album kartu. Setiap kartu didapat dari belajar: fakta di Quiz Arena, skill yang dikuasai, atau tonggak (menang
 * lawan bos, selesai membaca buku, selesai bab cerita, streak terbaik, jumlah sesi). Tidak ada undian dan tidak ada
 * uang. Kemajuan yang tampil dihitung dari data yang sama dengan syaratnya. Fakta ditulis sendiri dan diperiksa satu
 * per satu. Tingkat: common, rare, epic, legendary. Kartu tonggak selalu rare ke atas dan berkilau di epic ke atas.
 */

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'
export const RARITIES: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary']
export const RARITY_LABEL: Record<Rarity, string> = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' }

export type CardSetId = 'animals' | 'planets' | 'flags' | 'landmarks' | 'inventors' | 'scientists' | 'body' | 'music' | 'numbers' | 'words' | 'robot' | 'story' | 'books' | 'milestones'

export type MasterySubject = 'math' | 'english' | 'science'

export type CardReq =
  /** Persen fakta yang sudah dikenal di satu topik Quiz Arena. */
  | { kind: 'quiz'; topic: string; pct: number }
  /** Jumlah skill yang sudah dikuasai di satu mapel. */
  | { kind: 'mastered'; subject: MasterySubject; count: number }
  /** Menang pertama kali lawan bos ini. */
  | { kind: 'boss'; boss: string }
  /** Selesai membaca bab cerita mingguan. */
  | { kind: 'story'; chapter: number }
  /** Jumlah buku Ruang Baca yang selesai. */
  | { kind: 'book'; count: number }
  /** Streak terbaik. Tidak turun bila anak libur. */
  | { kind: 'streak'; days: number }
  /** Jumlah sesi wajib yang pernah selesai. */
  | { kind: 'sessions'; count: number }
  /** Jumlah bintang yang pernah didapat, belanja tidak mengurangi. */
  | { kind: 'stars'; count: number }

export type CardDef = {
  id: string
  set: CardSetId
  name: string
  rarity: Rarity
  /** Gambar: icon:<nama>, planet:<nama>, flag:<id>, land:<id>, boss:<id>, story:<id>. Digambar di @kira/figures. */
  art: string
  fact: string
  req: CardReq
}

export type CardSetDef = { id: CardSetId; name: string; blurb: string; tone: 'math' | 'english' | 'science' | 'mental' | 'knowledge' | 'warn'; reward: string; earnedBy: string; rare?: boolean }

export const CARD_SETS: readonly CardSetDef[] = [
  { id: 'robot', name: 'Boss cards', blurb: 'One rare card for each boss you beat.', tone: 'mental', reward: 'home-castle', earnedBy: 'Beat a boss for the first time', rare: true },
  { id: 'story', name: 'Story keepsakes', blurb: 'Memories from Kira and the Lost Library.', tone: 'knowledge', reward: 'frame-lamp', earnedBy: 'Finish a chapter of the weekly story', rare: true },
  { id: 'books', name: 'Book club', blurb: 'For readers who reach the last page.', tone: 'english', reward: 'frame-page', earnedBy: 'Finish books in the Reading Room', rare: true },
  { id: 'milestones', name: 'Milestones', blurb: 'For steady days and long journeys.', tone: 'warn', reward: 'frame-comet', earnedBy: 'Reach a best streak, sessions or stars milestone', rare: true },
  { id: 'animals', name: 'Animals', blurb: 'Big, small and amazing.', tone: 'science', reward: 'frame-leaf', earnedBy: 'Learn animal facts in Quiz Arena' },
  { id: 'planets', name: 'Solar System', blurb: 'Worlds around our Sun.', tone: 'knowledge', reward: 'night', earnedBy: 'Learn space facts in Quiz Arena' },
  { id: 'flags', name: 'Flags', blurb: 'Colours from around the world.', tone: 'english', reward: 'frame-wave', earnedBy: 'Learn flags in Quiz Arena' },
  { id: 'landmarks', name: 'Landmarks', blurb: 'Famous places to visit.', tone: 'warn', reward: 'home-treehouse', earnedBy: 'Learn landmarks in Quiz Arena' },
  { id: 'inventors', name: 'Inventors', blurb: 'People who built new things.', tone: 'mental', reward: 'frame-gold', earnedBy: 'Learn inventors in Quiz Arena' },
  { id: 'body', name: 'My body', blurb: 'The busy machine you live in.', tone: 'english', reward: 'frame-heart', earnedBy: 'Learn body facts in Quiz Arena' },
  { id: 'music', name: 'Music makers', blurb: 'Things that sing, ring and boom.', tone: 'mental', reward: 'frame-note', earnedBy: 'Learn instruments in Quiz Arena' },
  { id: 'scientists', name: 'Scientists', blurb: 'People who asked big questions.', tone: 'math', reward: 'home-cave', earnedBy: 'Master Science skills' },
  { id: 'numbers', name: 'Number minds', blurb: 'People who loved numbers and shapes.', tone: 'math', reward: 'frame-dot', earnedBy: 'Master Maths skills' },
  { id: 'words', name: 'Word wonders', blurb: 'Where our words come from.', tone: 'english', reward: 'frame-book', earnedBy: 'Master English skills' },
]

/** Hadiah selesai set: barang yang diberikan gratis, bukan dari toko. Ini id barang dunia. */
export const SET_REWARD_NAMES: Record<string, string> = {
  'frame-leaf': 'Leaf ring',
  night: 'Night sky',
  'frame-wave': 'Wave ring',
  'home-treehouse': 'Treehouse home',
  'frame-gold': 'Gold ring',
  'home-cave': 'Crystal cave home',
  'home-castle': 'Cloud castle home',
  'frame-lamp': 'Lamp ring',
  'frame-page': 'Page ring',
  'frame-comet': 'Comet ring',
  'frame-heart': 'Heart ring',
  'frame-note': 'Music ring',
  'frame-dot': 'Number ring',
  'frame-book': 'Word ring',
}

const q = (topic: string, pct: number): CardReq => ({ kind: 'quiz', topic, pct })
const m = (subject: MasterySubject, count: number): CardReq => ({ kind: 'mastered', subject, count })

const BOSS_RARITY: Record<BossLevel, Rarity> = { 1: 'rare', 2: 'epic', 3: 'legendary' }
const bossCard = (id: string, boss: string, fact: string, art: string = `boss:${boss}`): CardDef => {
  const b = bossById(boss)!
  return { id, set: 'robot', name: b.name, rarity: BOSS_RARITY[b.level], art, req: { kind: 'boss', boss }, fact }
}

export const CARDS: readonly CardDef[] = [
  // Kartu bos: kartu kenangan pertama kali menang.
  bossCard('rb-robot', 'robot', 'The word robot comes from the Czech word robota, which means hard work. It was used in a play in 1920.'),
  bossCard('bs-clickerclaw', 'clickerclaw', 'An abacus is a counting frame with sliding beads. People have used counting tools like it for thousands of years.'),
  bossCard('bs-mumblewump', 'mumblewump', 'English loves to borrow words. Shampoo comes from Hindi, and orangutan comes from Malay.'),
  bossCard('bs-mossback', 'mossback', 'Moss has no flowers and no true roots. It soaks up water like a sponge.'),
  bossCard('bs-pizzasaur', 'pizzasaur', 'A fraction is a part of a whole. Cut a pizza into 8 equal slices, and each slice is one eighth.'),
  bossCard('bs-flapdoodle', 'flapdoodle', 'Flapdoodle is a real English word. It means silly talk.'),
  bossCard('rb-rainbow', 'rainbow', 'A rainbow appears when sunlight passes through raindrops and splits into its colours.'),
  bossCard('bs-ticktoad', 'ticktoad', 'A day is about 24 hours long, because that is how long Earth takes to spin around once.'),
  bossCard('bs-inkyblot', 'inkyblot', 'Long ago, people wrote with feathers. The word pen comes from the Latin word for feather.'),
  bossCard('bs-voltafin', 'voltafin', 'An electric eel can make strong shocks of electricity to catch its food. It is really a kind of fish.'),
  bossCard('bs-hexapuff', 'hexapuff', 'Bees build honeycomb from hexagons, shapes with six sides. Hexagons fit together with no gaps.'),
  bossCard('bs-bookworm', 'bookworm', 'The British Library in London holds more than 150 million items, from books to maps and stamps.'),
  bossCard('rb-comet', 'comet', 'A comet is a ball of ice and dust. When it comes near the Sun, it grows a glowing tail.'),
  bossCard('rb-aurora', 'aurora', 'An aurora is a show of coloured light in the sky. It happens when particles from the Sun hit the air high above Earth.'),

  // Kenangan cerita: selesai membaca bab. Bab terakhir legendary.
  { id: 'st-lumi', set: 'story', name: 'Lumi', rarity: 'rare', art: 'story:lumi', req: { kind: 'story', chapter: 1 }, fact: 'Fireflies make their own light. They flash it to find each other in the dark.' },
  { id: 'st-owl', set: 'story', name: 'Old Owl', rarity: 'rare', art: 'icon:owl', req: { kind: 'story', chapter: 2 }, fact: 'An owl can turn its head about three quarters of the way round, because its neck has extra bones.' },
  { id: 'st-river', set: 'story', name: 'Mirror River', rarity: 'rare', art: 'icon:river', req: { kind: 'story', chapter: 3 }, fact: 'Still water works like a mirror, because light bounces off its flat surface.' },
  { id: 'st-baker', set: 'story', name: 'The Baker’s Bun', rarity: 'rare', art: 'icon:bread', req: { kind: 'story', chapter: 4 }, fact: 'Yeast is a tiny living thing. It makes bubbles of gas, and the bubbles help bread to rise.' },
  { id: 'st-keeper', set: 'story', name: 'The Lighthouse', rarity: 'rare', art: 'land:lighthouse', req: { kind: 'story', chapter: 5 }, fact: 'One of the Seven Wonders of the ancient world was a giant lighthouse at Alexandria in Egypt.' },
  { id: 'st-peak', set: 'story', name: 'The Snowy Peak', rarity: 'epic', art: 'icon:mountain', req: { kind: 'story', chapter: 6 }, fact: 'Air gets colder the higher you climb. That is why very high mountains can keep their snow all year.' },
  { id: 'st-cloud', set: 'story', name: 'Cloud Island', rarity: 'epic', art: 'icon:cloud', req: { kind: 'story', chapter: 7 }, fact: 'A cloud is made of billions of tiny water drops or ice crystals floating in the air.' },
  { id: 'st-pip', set: 'story', name: 'Pip the Librarian', rarity: 'legendary', art: 'story:pip', req: { kind: 'story', chapter: 8 }, fact: 'A librarian looks after books and helps people find the right one. People have kept libraries for thousands of years.' },

  // Klub buku: buku Ruang Baca yang selesai.
  { id: 'bk-1', set: 'books', name: 'First Finish', rarity: 'rare', art: 'icon:book', req: { kind: 'book', count: 1 }, fact: 'The Diamond Sutra, printed in China in the year 868, is the oldest dated printed book we know of.' },
  { id: 'bk-3', set: 'books', name: 'Reed Reader', rarity: 'rare', art: 'icon:paper', req: { kind: 'book', count: 3 }, fact: 'Before paper was common, people in ancient Egypt wrote on papyrus, made from a tall water plant.' },
  { id: 'bk-5', set: 'books', name: 'Fingertip Reader', rarity: 'epic', art: 'icon:hand', req: { kind: 'book', count: 5 }, fact: 'Braille lets people read with their fingertips. Louis Braille created it when he was still a teenager.' },
  { id: 'bk-10', set: 'books', name: 'Library Friend', rarity: 'epic', art: 'icon:bag', req: { kind: 'book', count: 10 }, fact: 'The ancient Library of Alexandria in Egypt was one of the greatest libraries of its time.' },
  { id: 'bk-20', set: 'books', name: 'Grand Reader', rarity: 'legendary', art: 'icon:school', req: { kind: 'book', count: 20 }, fact: 'World Book Day is held by UNESCO on 23 April each year, to celebrate reading around the world.' },

  // Tonggak: dihitung dari yang terbaik, jadi tidak pernah hilang.
  { id: 'ms-3', set: 'milestones', name: 'Little Flame', rarity: 'rare', art: 'icon:candle', req: { kind: 'streak', days: 3 }, fact: 'A candle burns because melted wax climbs the wick and turns into a gas that catches fire.' },
  { id: 'ms-7', set: 'milestones', name: 'Week of Stars', rarity: 'rare', art: 'icon:star', req: { kind: 'streak', days: 7 }, fact: 'The seven-day week is very old. People in ancient Babylon used it thousands of years ago.' },
  { id: 'ms-14', set: 'milestones', name: 'Steady Turtle', rarity: 'epic', art: 'icon:turtle', req: { kind: 'streak', days: 14 }, fact: 'Some giant tortoises live for more than 100 years.' },
  { id: 'ms-30', set: 'milestones', name: 'Moon Keeper', rarity: 'epic', art: 'icon:moon', req: { kind: 'streak', days: 30 }, fact: 'The word month comes from the word moon. People once counted time by the Moon’s changing shape.' },
  { id: 'ms-60', set: 'milestones', name: 'Tall Tree', rarity: 'legendary', art: 'icon:tree', req: { kind: 'streak', days: 60 }, fact: 'Many trees grow one new ring of wood each year, so you can count the rings to find their age.' },
  { id: 'ms-100', set: 'milestones', name: 'Hundred-Day Hero', rarity: 'legendary', art: 'icon:mountain', req: { kind: 'streak', days: 100 }, fact: 'The word century comes from centum, the Latin word for one hundred.' },
  { id: 'ms-s10', set: 'milestones', name: 'Small Seed', rarity: 'rare', art: 'icon:seedling', req: { kind: 'sessions', count: 10 }, fact: 'A seed holds a tiny baby plant and a store of food to help it start growing.' },
  { id: 'ms-s50', set: 'milestones', name: 'Green Sprout', rarity: 'rare', art: 'icon:plant', req: { kind: 'sessions', count: 50 }, fact: 'Plants make their own food using sunlight, water and a gas from the air.' },
  { id: 'ms-s150', set: 'milestones', name: 'Whole Forest', rarity: 'epic', art: 'icon:forest', req: { kind: 'sessions', count: 150 }, fact: 'Forests cover about a third of all the land on Earth.' },
  { id: 'ms-st100', set: 'milestones', name: 'Star Catcher', rarity: 'rare', art: 'icon:sun', req: { kind: 'stars', count: 100 }, fact: 'The Sun is the closest star to Earth. Its light takes about 8 minutes to reach us.' },
  { id: 'ms-st500', set: 'milestones', name: 'Star Keeper', rarity: 'epic', art: 'planet:sun', req: { kind: 'stars', count: 500 }, fact: 'On a dark, clear night you can see a few thousand stars with just your eyes.' },
  { id: 'ms-st1500', set: 'milestones', name: 'Galaxy Friend', rarity: 'legendary', art: 'icon:planet', req: { kind: 'stars', count: 1500 }, fact: 'Our galaxy is called the Milky Way. It holds more than 100 billion stars.' },

  // Hewan
  { id: 'an-lion', set: 'animals', name: 'Lion', rarity: 'common', art: 'icon:lion', req: q('animals', 15), fact: 'Lions live in groups called prides. A pride has lionesses, their cubs and a few adult males.' },
  { id: 'an-butterfly', set: 'animals', name: 'Butterfly', rarity: 'common', art: 'icon:butterfly', req: q('animals', 20), fact: 'Butterflies taste with their feet. They can tell if a leaf is good for their eggs just by standing on it.' },
  { id: 'an-frog', set: 'animals', name: 'Frog', rarity: 'common', art: 'icon:frog', req: q('animals', 25), fact: 'A frog can breathe through its skin as well as with its lungs.' },
  { id: 'an-crab', set: 'animals', name: 'Crab', rarity: 'common', art: 'icon:crab', req: q('animals', 30), fact: 'Crabs have ten legs, and many kinds walk sideways.' },
  { id: 'an-penguin', set: 'animals', name: 'Penguin', rarity: 'common', art: 'icon:penguin', req: q('animals', 35), fact: 'Penguins are birds that cannot fly. They use their wings like flippers to swim fast.' },
  { id: 'an-bee', set: 'animals', name: 'Honey bee', rarity: 'common', art: 'icon:bee', req: q('animals', 40), fact: 'A honey bee does a waggle dance to show other bees where to find flowers.' },
  { id: 'an-camel', set: 'animals', name: 'Camel', rarity: 'common', art: 'icon:camel', req: q('animals', 50), fact: 'A camel’s hump stores fat, which gives it energy when food is hard to find.' },
  { id: 'an-elephant', set: 'animals', name: 'Elephant', rarity: 'rare', art: 'icon:elephant', req: q('animals', 60), fact: 'An elephant trunk has no bones. It can pick up a tiny peanut and also suck up water to drink.' },
  { id: 'an-snake', set: 'animals', name: 'Snake', rarity: 'rare', art: 'icon:snake', req: q('animals', 70), fact: 'Snakes smell with their tongues. The tongue picks up tiny bits of scent from the air.' },
  { id: 'an-polar', set: 'animals', name: 'Polar bear', rarity: 'rare', art: 'icon:polar-bear', req: q('animals', 75), fact: 'A polar bear has black skin under its thick fur. Its clear, hollow hairs make it look white.' },
  { id: 'an-whale', set: 'animals', name: 'Blue whale', rarity: 'epic', art: 'icon:whale', req: q('animals', 85), fact: 'The blue whale is the biggest animal known to have ever lived. It is much longer than a bus.' },
  { id: 'an-shark', set: 'animals', name: 'Shark', rarity: 'epic', art: 'icon:shark', req: q('animals', 95), fact: 'A shark’s skeleton is made of cartilage, the same bendy stuff that is in your nose and ears.' },

  // Tata Surya
  { id: 'pl-earth', set: 'planets', name: 'Earth', rarity: 'common', art: 'planet:earth', req: q('space', 15), fact: 'Earth is the third planet from the Sun. It is the only place we know that has living things.' },
  { id: 'pl-moon', set: 'planets', name: 'The Moon', rarity: 'common', art: 'planet:moon', req: q('space', 25), fact: 'The Moon takes about 27 days to go around Earth. We always see the same side of it.' },
  { id: 'pl-mars', set: 'planets', name: 'Mars', rarity: 'common', art: 'planet:mars', req: q('space', 35), fact: 'Mars is called the Red Planet because its rusty dust makes the ground look red.' },
  { id: 'pl-mercury', set: 'planets', name: 'Mercury', rarity: 'common', art: 'planet:mercury', req: q('space', 45), fact: 'Mercury is the smallest planet and the closest to the Sun. One year there lasts only 88 Earth days.' },
  { id: 'pl-venus', set: 'planets', name: 'Venus', rarity: 'common', art: 'planet:venus', req: q('space', 50), fact: 'Venus is the hottest planet, even though Mercury is closer to the Sun. Its thick air traps the heat.' },
  { id: 'pl-saturn', set: 'planets', name: 'Saturn', rarity: 'rare', art: 'planet:saturn', req: q('space', 60), fact: 'Saturn has big rings made of countless pieces of ice and rock, from tiny grains to huge chunks.' },
  { id: 'pl-uranus', set: 'planets', name: 'Uranus', rarity: 'rare', art: 'planet:uranus', req: q('space', 70), fact: 'Uranus spins on its side, so it seems to roll around the Sun like a ball.' },
  { id: 'pl-neptune', set: 'planets', name: 'Neptune', rarity: 'rare', art: 'planet:neptune', req: q('space', 78), fact: 'Neptune is the farthest planet from the Sun. One year there lasts about 165 Earth years.' },
  { id: 'pl-jupiter', set: 'planets', name: 'Jupiter', rarity: 'epic', art: 'planet:jupiter', req: q('space', 85), fact: 'Jupiter is the biggest planet in our Solar System. More than 1,300 Earths could fit inside it.' },
  { id: 'pl-sun', set: 'planets', name: 'The Sun', rarity: 'epic', art: 'icon:sun', req: q('space', 95), fact: 'The Sun is a star. It is so big that more than a million Earths could fit inside it.' },

  // Bendera
  { id: 'fl-id', set: 'flags', name: 'Indonesia', rarity: 'common', art: 'flag:id', req: q('flags', 15), fact: 'The flag of Indonesia has two bands, red on top and white below. It is called Sang Saka Merah Putih.' },
  { id: 'fl-pl', set: 'flags', name: 'Poland', rarity: 'common', art: 'flag:pl', req: q('flags', 20), fact: 'The flag of Poland has two bands, white on top and red below. It looks like Indonesia’s flag turned upside down.' },
  { id: 'fl-nl', set: 'flags', name: 'The Netherlands', rarity: 'common', art: 'flag:nl', req: q('flags', 25), fact: 'The flag of the Netherlands has three flat stripes: red, white and blue.' },
  { id: 'fl-jp', set: 'flags', name: 'Japan', rarity: 'common', art: 'flag:jp', req: q('flags', 35), fact: 'The flag of Japan is a red circle on white. The circle stands for the sun.' },
  { id: 'fl-ua', set: 'flags', name: 'Ukraine', rarity: 'common', art: 'flag:ua', req: q('flags', 40), fact: 'The flag of Ukraine has two bands, blue on top and yellow below. People often say they show a blue sky over golden wheat.' },
  { id: 'fl-ng', set: 'flags', name: 'Nigeria', rarity: 'common', art: 'flag:ng', req: q('flags', 50), fact: 'The flag of Nigeria has three tall stripes: green, white and green. The green stands for the land and its farms.' },
  { id: 'fl-fr', set: 'flags', name: 'France', rarity: 'rare', art: 'flag:fr', req: q('flags', 60), fact: 'The flag of France has three tall stripes: blue, white and red. People call it the tricolore.' },
  { id: 'fl-th', set: 'flags', name: 'Thailand', rarity: 'rare', art: 'flag:th', req: q('flags', 68), fact: 'The flag of Thailand has five flat stripes. The blue one in the middle is twice as wide as the others.' },
  { id: 'fl-vn', set: 'flags', name: 'Vietnam', rarity: 'rare', art: 'flag:vn', req: q('flags', 75), fact: 'The flag of Vietnam is red with one big yellow star in the middle. The star has five points.' },
  { id: 'fl-it', set: 'flags', name: 'Italy', rarity: 'epic', art: 'flag:it', req: q('flags', 85), fact: 'The flag of Italy has three tall stripes: green, white and red. Italians call it il Tricolore.' },
  { id: 'fl-se', set: 'flags', name: 'Sweden', rarity: 'epic', art: 'flag:se', req: q('flags', 90), fact: 'The flag of Sweden is blue with a yellow cross. The cross sits closer to the pole side of the flag.' },
  { id: 'fl-ch', set: 'flags', name: 'Switzerland', rarity: 'epic', art: 'flag:ch', req: q('flags', 95), fact: 'The flag of Switzerland is square. Only one other country has a square flag: Vatican City.' },

  // Tempat terkenal
  { id: 'lm-fuji', set: 'landmarks', name: 'Mount Fuji', rarity: 'common', art: 'land:fuji', req: q('landmarks', 15), fact: 'Mount Fuji in Japan is a volcano and the highest mountain in the country, about 3,776 metres tall.' },
  { id: 'lm-wall', set: 'landmarks', name: 'Great Wall', rarity: 'common', art: 'land:wall', req: q('landmarks', 25), fact: 'The Great Wall of China was built over many hundreds of years. All its parts together stretch for thousands of kilometres.' },
  { id: 'lm-pyramid', set: 'landmarks', name: 'Great Pyramid', rarity: 'common', art: 'land:pyramid', req: q('landmarks', 35), fact: 'The Great Pyramid of Giza in Egypt was built about 4,500 years ago.' },
  { id: 'lm-bigben', set: 'landmarks', name: 'Big Ben', rarity: 'common', art: 'land:bigben', req: q('landmarks', 50), fact: 'Big Ben is the name of the great bell inside a famous clock tower in London, United Kingdom.' },
  { id: 'lm-eiffel', set: 'landmarks', name: 'Eiffel Tower', rarity: 'rare', art: 'land:eiffel', req: q('landmarks', 60), fact: 'The Eiffel Tower in Paris, France is made of iron. It was finished in 1889.' },
  { id: 'lm-colosseum', set: 'landmarks', name: 'Colosseum', rarity: 'rare', art: 'land:colosseum', req: q('landmarks', 72), fact: 'The Colosseum in Rome, Italy is nearly 2,000 years old. It could hold about 50,000 people.' },
  { id: 'lm-borobudur', set: 'landmarks', name: 'Borobudur', rarity: 'epic', art: 'land:borobudur', req: q('landmarks', 85), fact: 'Borobudur in Central Java, Indonesia is the largest Buddhist temple in the world. It is over 1,000 years old.' },
  { id: 'lm-taj', set: 'landmarks', name: 'Taj Mahal', rarity: 'epic', art: 'land:taj', req: q('landmarks', 95), fact: 'The Taj Mahal in Agra, India is made of white marble. An emperor built it in memory of his wife.' },

  // Penemu
  { id: 'iv-bell', set: 'inventors', name: 'Alexander Graham Bell', rarity: 'common', art: 'icon:bell', req: q('inventors', 15), fact: 'Alexander Graham Bell received the first patent for a telephone in 1876.' },
  { id: 'iv-cailun', set: 'inventors', name: 'Cai Lun', rarity: 'common', art: 'icon:paper', req: q('inventors', 25), fact: 'Around the year 105, Cai Lun in China improved the way paper was made, using bark, rags and old fishing nets.' },
  { id: 'iv-gutenberg', set: 'inventors', name: 'Johannes Gutenberg', rarity: 'common', art: 'icon:book', req: q('inventors', 35), fact: 'Around 1450, Johannes Gutenberg built a printing press with movable metal letters, so books could be made faster.' },
  { id: 'iv-anderson', set: 'inventors', name: 'Mary Anderson', rarity: 'common', art: 'icon:rain', req: q('inventors', 50), fact: 'In 1903 Mary Anderson patented a windscreen wiper, after seeing a tram driver struggle to see through the snow.' },
  { id: 'iv-edison', set: 'inventors', name: 'Thomas Edison', rarity: 'rare', art: 'icon:bulb', req: q('inventors', 60), fact: 'In 1879 Thomas Edison and his team made an electric light bulb that could glow for many hours.' },
  { id: 'iv-volta', set: 'inventors', name: 'Alessandro Volta', rarity: 'rare', art: 'icon:battery', req: q('inventors', 72), fact: 'In 1800 Alessandro Volta built one of the first batteries from a stack of metal discs.' },
  { id: 'iv-wright', set: 'inventors', name: 'The Wright brothers', rarity: 'epic', art: 'icon:plane', req: q('inventors', 85), fact: 'In 1903 Orville and Wilbur Wright made the first powered, controlled flight in an aeroplane. It lasted 12 seconds.' },
  { id: 'iv-benz', set: 'inventors', name: 'Karl Benz', rarity: 'epic', art: 'icon:car', req: q('inventors', 95), fact: 'In 1886 Karl Benz built a three-wheeled motor car that many people call the first real petrol car.' },

  // Tubuh
  { id: 'bd-eye', set: 'body', name: 'Eyes', rarity: 'common', art: 'icon:eye', req: q('body', 15), fact: 'You blink many times every minute. Each blink keeps your eyes clean and wet.' },
  { id: 'bd-tooth', set: 'body', name: 'Teeth', rarity: 'common', art: 'icon:tooth', req: q('body', 25), fact: 'Enamel, the white outside of your teeth, is the hardest thing in your body.' },
  { id: 'bd-tongue', set: 'body', name: 'Tongue', rarity: 'common', art: 'icon:tongue', req: q('body', 35), fact: 'Your tongue is covered in tiny bumps. They hold thousands of taste buds.' },
  { id: 'bd-muscle', set: 'body', name: 'Muscles', rarity: 'common', art: 'icon:muscle', req: q('body', 50), fact: 'Your body has more than 600 muscles. You use many of them just to smile.' },
  { id: 'bd-lungs', set: 'body', name: 'Lungs', rarity: 'rare', art: 'icon:lungs', req: q('body', 60), fact: 'Your left lung is a little smaller than your right lung. That leaves room for your heart.' },
  { id: 'bd-bone', set: 'body', name: 'Bones', rarity: 'rare', art: 'icon:skeleton', req: q('body', 72), fact: 'A baby has about 300 bones. Some join together as you grow, so an adult has 206.' },
  { id: 'bd-heart', set: 'body', name: 'Heart', rarity: 'epic', art: 'icon:heart-organ', req: q('body', 85), fact: 'Your heart is a muscle about the size of your fist. It beats about 100,000 times a day.' },
  { id: 'bd-brain', set: 'body', name: 'Brain', rarity: 'epic', art: 'icon:brain', req: q('body', 95), fact: 'Your brain is small, yet it uses about a fifth of your body’s energy.' },

  // Alat musik
  { id: 'mu-drum', set: 'music', name: 'Drum', rarity: 'common', art: 'icon:drum', req: q('instruments', 20), fact: 'A drum makes sound when its skin shakes. Hit it harder and the sound gets louder.' },
  { id: 'mu-whistle', set: 'music', name: 'Whistle', rarity: 'common', art: 'icon:whistle', req: q('instruments', 45), fact: 'A whistle sings when air rushes past its sharp edge and starts to shake.' },
  { id: 'mu-guitar', set: 'music', name: 'Guitar', rarity: 'rare', art: 'icon:guitar', req: q('instruments', 70), fact: 'A guitar usually has six strings. Shorter or tighter strings make higher notes.' },
  { id: 'mu-bell', set: 'music', name: 'Great bell', rarity: 'epic', art: 'icon:bell', req: q('instruments', 90), fact: 'A bell rings when the whole bell shakes. Big bells make deep sounds, and small bells make high ones.' },

  // Ilmuwan
  { id: 'sc-darwin', set: 'scientists', name: 'Charles Darwin', rarity: 'common', art: 'icon:turtle', req: m('science', 1), fact: 'Charles Darwin sailed on a ship called the Beagle and studied many animals and plants, including those on the Galapagos Islands.' },
  { id: 'sc-newton', set: 'scientists', name: 'Isaac Newton', rarity: 'common', art: 'icon:apple', req: m('science', 3), fact: 'Isaac Newton explained gravity, the pull that makes things fall down. A famous story says an apple helped him think about it.' },
  { id: 'sc-anning', set: 'scientists', name: 'Mary Anning', rarity: 'common', art: 'icon:fossil', req: m('science', 5), fact: 'Mary Anning found amazing fossils on the beaches of Lyme Regis in England, starting when she was still a child.' },
  { id: 'sc-galileo', set: 'scientists', name: 'Galileo Galilei', rarity: 'rare', art: 'icon:moon', req: m('science', 8), fact: 'In 1610 Galileo used a telescope to see four moons moving around Jupiter.' },
  { id: 'sc-haytham', set: 'scientists', name: 'Ibn al-Haytham', rarity: 'rare', art: 'icon:eye', req: m('science', 12), fact: 'About 1,000 years ago, Ibn al-Haytham showed that we see because light travels into our eyes.' },
  { id: 'sc-goodall', set: 'scientists', name: 'Jane Goodall', rarity: 'rare', art: 'icon:monkey', req: m('science', 16), fact: 'Jane Goodall spent many years watching chimpanzees in Tanzania. She saw them making and using tools.' },
  { id: 'sc-curie', set: 'scientists', name: 'Marie Curie', rarity: 'epic', art: 'icon:bottle', req: m('science', 22), fact: 'Marie Curie studied radioactivity. She won two Nobel Prizes, one in physics and one in chemistry.' },
  { id: 'sc-einstein', set: 'scientists', name: 'Albert Einstein', rarity: 'epic', art: 'icon:clock', req: m('science', 30), fact: 'Albert Einstein is famous for his ideas about space, time and light. He won a Nobel Prize for physics.' },

  // Tokoh angka
  { id: 'nm-euclid', set: 'numbers', name: 'Euclid', rarity: 'common', art: 'icon:triangle', req: m('math', 1), fact: 'Euclid wrote a famous book about shapes called the Elements, more than 2,000 years ago.' },
  { id: 'nm-hypatia', set: 'numbers', name: 'Hypatia', rarity: 'common', art: 'icon:star', req: m('math', 3), fact: 'Hypatia taught maths and astronomy in Alexandria, Egypt, about 1,600 years ago.' },
  { id: 'nm-aryabhata', set: 'numbers', name: 'Aryabhata', rarity: 'common', art: 'icon:circle', req: m('math', 6), fact: 'Aryabhata was an Indian mathematician who lived about 1,500 years ago. He found a very close value for pi.' },
  { id: 'nm-khwarizmi', set: 'numbers', name: 'Al-Khwarizmi', rarity: 'rare', art: 'icon:book', req: m('math', 10), fact: 'Al-Khwarizmi lived in Baghdad about 1,200 years ago. The word algebra comes from the title of his book.' },
  { id: 'nm-lovelace', set: 'numbers', name: 'Ada Lovelace', rarity: 'rare', art: 'icon:key', req: m('math', 16), fact: 'In the 1840s Ada Lovelace wrote notes about a calculating machine. Many people call her the first computer programmer.' },
  { id: 'nm-johnson', set: 'numbers', name: 'Katherine Johnson', rarity: 'epic', art: 'icon:planet', req: m('math', 24), fact: 'Katherine Johnson worked out flight paths for NASA’s early space flights, often by hand.' },

  // Kata
  { id: 'wd-alphabet', set: 'words', name: 'Alphabet', rarity: 'common', art: 'icon:paper', req: m('english', 1), fact: 'The word alphabet comes from alpha and beta, the first two letters of the Greek alphabet.' },
  { id: 'wd-pencil', set: 'words', name: 'Pencil', rarity: 'common', art: 'icon:pencil', req: m('english', 3), fact: 'The word pencil comes from a Latin word that means little tail.' },
  { id: 'wd-umbrella', set: 'words', name: 'Umbrella', rarity: 'common', art: 'icon:umbrella', req: m('english', 6), fact: 'The word umbrella comes from umbra, the Latin word for shade.' },
  { id: 'wd-rubber', set: 'words', name: 'Rubber', rarity: 'rare', art: 'icon:eraser', req: m('english', 10), fact: 'In 1770 Joseph Priestley noticed that this bouncy stuff could rub out pencil marks. That is how rubber got its name.' },
  { id: 'wd-orangutan', set: 'words', name: 'Orangutan', rarity: 'rare', art: 'icon:tree', req: m('english', 16), fact: 'Orangutan comes from the Malay words orang and hutan, which together mean person of the forest.' },
  { id: 'wd-bookworm', set: 'words', name: 'Bookworm', rarity: 'epic', art: 'icon:worm', req: m('english', 24), fact: 'A bookworm is a person who loves reading. Real bookworms are small insects that nibble old books.' },
]

export const CARD_COUNT = CARDS.length

export function cardById(id: string): CardDef | undefined {
  return CARDS.find((c) => c.id === id)
}
export function cardsOfSet(set: CardSetId): CardDef[] {
  return CARDS.filter((c) => c.set === set)
}
/** Nomor kartu di album, mulai 1. */
export function cardNumber(id: string): number {
  return CARDS.findIndex((c) => c.id === id) + 1
}

export type CardProgress = {
  /** Fakta dikenal / total per id topik Quiz. */
  quiz: Record<string, { known: number; total: number }>
  mastered: Record<MasterySubject, number>
  /** Id bos yang pernah dikalahkan. */
  bossesBeaten: readonly string[]
  /** Nomor bab cerita yang pernah selesai. */
  storyDone: readonly number[]
  booksFinished: number
  bestStreak: number
  sessions: number
  starsEarned: number
}

export const NO_CARD_PROGRESS: CardProgress = { quiz: {}, mastered: { math: 0, english: 0, science: 0 }, bossesBeaten: [], storyDone: [], booksFinished: 0, bestStreak: 0, sessions: 0, starsEarned: 0 }

/** Seberapa dekat kartu: 0 sampai 1, untuk bar kemajuan. Kartu didapat tepat saat nilainya 1. */
export function cardCloseness(card: CardDef, p: CardProgress): number {
  const r = card.req
  switch (r.kind) {
    case 'quiz': {
      const t = p.quiz[r.topic]
      if (!t || t.total === 0) return 0
      return Math.min(1, (t.known * 100) / t.total / r.pct)
    }
    case 'mastered':
      return Math.min(1, p.mastered[r.subject] / r.count)
    case 'boss':
      return p.bossesBeaten.includes(r.boss) ? 1 : 0
    case 'story':
      return p.storyDone.includes(r.chapter) ? 1 : 0
    case 'book':
      return Math.min(1, p.booksFinished / r.count)
    case 'streak':
      return Math.min(1, p.bestStreak / r.days)
    case 'sessions':
      return Math.min(1, p.sessions / r.count)
    case 'stars':
      return Math.min(1, p.starsEarned / r.count)
  }
}

export function cardEarned(card: CardDef, p: CardProgress): boolean {
  return cardCloseness(card, p) >= 1
}

/** Angka di bawah bar kemajuan. Kosong untuk kartu ya-atau-belum (menang lawan, selesai bab). */
export function cardCount(card: CardDef, p: CardProgress): { have: number; need: number; unit: 'percent' | 'count' } | null {
  const r = card.req
  switch (r.kind) {
    case 'quiz': {
      const t = p.quiz[r.topic]
      return { have: t && t.total > 0 ? Math.floor((t.known * 100) / t.total) : 0, need: r.pct, unit: 'percent' }
    }
    case 'mastered':
      return { have: p.mastered[r.subject], need: r.count, unit: 'count' }
    case 'book':
      return { have: p.booksFinished, need: r.count, unit: 'count' }
    case 'streak':
      return { have: p.bestStreak, need: r.days, unit: 'count' }
    case 'sessions':
      return { have: p.sessions, need: r.count, unit: 'count' }
    case 'stars':
      return { have: p.starsEarned, need: r.count, unit: 'count' }
    default:
      return null
  }
}

const SUBJECT_WORD: Record<MasterySubject, string> = { math: 'Maths', english: 'English', science: 'Science' }

export function cardHint(card: CardDef): string {
  const r = card.req
  switch (r.kind) {
    case 'quiz':
      return `Know ${r.pct} percent of the ${r.topic} facts in Quiz Arena`
    case 'mastered':
      return `Master ${r.count} ${SUBJECT_WORD[r.subject]} ${r.count === 1 ? 'skill' : 'skills'}`
    case 'boss':
      return `Beat ${bossById(r.boss)?.name ?? 'this boss'} for the first time`
    case 'story':
      return `Finish chapter ${r.chapter} of the weekly story`
    case 'book':
      return `Finish ${r.count} ${r.count === 1 ? 'book' : 'books'} in the Reading Room`
    case 'streak':
      return `Reach a best streak of ${r.days} days`
    case 'sessions':
      return `Finish ${r.count} required sessions`
    case 'stars':
      return `Earn ${r.count} stars in total`
  }
}

/** Kartu bisa didapat oleh anak ini? Kartu dari mapel atau fitur yang dimatikan orang tua tidak dihitung di album. */
export function cardAvailable(card: CardDef, on: (key: string) => boolean): boolean {
  const r = card.req
  switch (r.kind) {
    case 'quiz':
      return on('quiz-arena')
    case 'mastered':
      return on(r.subject)
    case 'boss':
      return (bossById(r.boss)?.subjects ?? []).some(on)
    case 'book':
      return on('reading-room')
    default:
      return true
  }
}

/** Kartu hadiah pertama kali menang lawan bos ini. */
export function bossPrizeCard(bossId: string): CardDef | undefined {
  const b = bossById(bossId)
  return b ? cardById(b.card) : undefined
}

export function setComplete(set: CardSetId, ownedIds: ReadonlySet<string>): boolean {
  return cardsOfSet(set).every((c) => ownedIds.has(c.id))
}

/** Setiap bos punya tepat satu kartu. Dipakai tes katalog. */
export function bossCardIds(): string[] {
  return BOSSES.map((b) => b.card)
}
