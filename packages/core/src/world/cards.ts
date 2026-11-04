/**
 * Album kartu. Setiap kartu didapat dari kemampuan yang dikuasai, topik Quiz, atau menang lawan Puzzle Robot.
 * Tidak ada undian. Fakta ditulis sendiri dan diperiksa satu per satu. Kartu bertingkat: common, rare, epic,
 * legendary. Epic dan legendary berkilau.
 */

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'
export const RARITIES: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary']
export const RARITY_LABEL: Record<Rarity, string> = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' }

export type CardSetId = 'animals' | 'planets' | 'flags' | 'landmarks' | 'inventors' | 'scientists' | 'robot'

export type CardReq =
  /** Persen fakta yang sudah dikenal di satu topik Quiz Arena. */
  | { kind: 'quiz'; topic: string; pct: number }
  /** Jumlah skill Science yang sudah dikuasai. */
  | { kind: 'mastered'; subject: 'science'; count: number }
  /** Menang lawan Puzzle Robot, kartu ke-n dari hadiah bos. */
  | { kind: 'boss' }

export type CardDef = {
  id: string
  set: CardSetId
  name: string
  rarity: Rarity
  /** Gambar: icon:<nama>, planet:<nama>, flag:<id>, land:<id>, boss:<id>. Digambar di @kira/figures. */
  art: string
  fact: string
  req: CardReq
}

export type CardSetDef = { id: CardSetId; name: string; blurb: string; tone: 'math' | 'english' | 'science' | 'mental' | 'knowledge' | 'warn'; reward: string; earnedBy: string }

export const CARD_SETS: readonly CardSetDef[] = [
  { id: 'animals', name: 'Animals', blurb: 'Big, small and amazing.', tone: 'science', reward: 'frame-leaf', earnedBy: 'Learn animal facts in Quiz Arena' },
  { id: 'planets', name: 'Planets', blurb: 'Worlds in our Solar System.', tone: 'knowledge', reward: 'night', earnedBy: 'Learn space facts in Quiz Arena' },
  { id: 'flags', name: 'Flags', blurb: 'Colours from around the world.', tone: 'english', reward: 'frame-wave', earnedBy: 'Learn flags in Quiz Arena' },
  { id: 'landmarks', name: 'Landmarks', blurb: 'Famous places to visit.', tone: 'warn', reward: 'home-treehouse', earnedBy: 'Learn landmarks in Quiz Arena' },
  { id: 'inventors', name: 'Inventors', blurb: 'People who built new things.', tone: 'mental', reward: 'frame-gold', earnedBy: 'Learn inventors in Quiz Arena' },
  { id: 'scientists', name: 'Scientists', blurb: 'People who asked big questions.', tone: 'math', reward: 'home-cave', earnedBy: 'Master Science skills' },
  { id: 'robot', name: 'Puzzle Robot', blurb: 'Rare cards for beating the robot.', tone: 'mental', reward: 'home-castle', earnedBy: 'Beat the Puzzle Robot' },
]

/** Hadiah selesai set: barang yang diberikan gratis, bukan dari toko. Ini id barang dunia. */
export const SET_REWARD_NAMES: Record<string, string> = {
  'frame-leaf': 'Leaf ring',
  'night': 'Night sky',
  'frame-wave': 'Wave ring',
  'home-treehouse': 'Treehouse home',
  'frame-gold': 'Gold ring',
  'home-cave': 'Crystal cave home',
  'home-castle': 'Cloud castle home',
}

const q = (topic: string, pct: number): CardReq => ({ kind: 'quiz', topic, pct })

export const CARDS: readonly CardDef[] = [
  { id: 'an-lion', set: 'animals', name: 'Lion', rarity: 'common', art: 'icon:lion', req: q('animals', 15), fact: 'Lions live in groups called prides. A pride has lionesses, their cubs and a few adult males.' },
  { id: 'an-penguin', set: 'animals', name: 'Penguin', rarity: 'common', art: 'icon:penguin', req: q('animals', 35), fact: 'Penguins are birds that cannot fly. They use their wings like flippers to swim fast.' },
  { id: 'an-elephant', set: 'animals', name: 'Elephant', rarity: 'rare', art: 'icon:elephant', req: q('animals', 60), fact: 'An elephant trunk has no bones. It can pick up a tiny peanut and also suck up water to drink.' },
  { id: 'an-whale', set: 'animals', name: 'Blue whale', rarity: 'epic', art: 'icon:whale', req: q('animals', 85), fact: 'The blue whale is the biggest animal known to have ever lived. It is much longer than a bus.' },

  { id: 'pl-earth', set: 'planets', name: 'Earth', rarity: 'common', art: 'planet:earth', req: q('space', 15), fact: 'Earth is the third planet from the Sun. It is the only place we know that has living things.' },
  { id: 'pl-mars', set: 'planets', name: 'Mars', rarity: 'common', art: 'planet:mars', req: q('space', 35), fact: 'Mars is called the Red Planet because its rusty dust makes the ground look red.' },
  { id: 'pl-saturn', set: 'planets', name: 'Saturn', rarity: 'rare', art: 'planet:saturn', req: q('space', 60), fact: 'Saturn has big rings made of countless pieces of ice and rock, from tiny grains to huge chunks.' },
  { id: 'pl-jupiter', set: 'planets', name: 'Jupiter', rarity: 'epic', art: 'planet:jupiter', req: q('space', 85), fact: 'Jupiter is the biggest planet in our Solar System. More than 1,300 Earths could fit inside it.' },

  { id: 'fl-id', set: 'flags', name: 'Indonesia', rarity: 'common', art: 'flag:id', req: q('flags', 15), fact: 'The flag of Indonesia has two bands, red on top and white below. It is called Sang Saka Merah Putih.' },
  { id: 'fl-jp', set: 'flags', name: 'Japan', rarity: 'common', art: 'flag:jp', req: q('flags', 35), fact: 'The flag of Japan is a red circle on white. The circle stands for the sun.' },
  { id: 'fl-fr', set: 'flags', name: 'France', rarity: 'rare', art: 'flag:fr', req: q('flags', 60), fact: 'The flag of France has three tall stripes: blue, white and red. People call it the tricolore.' },
  { id: 'fl-it', set: 'flags', name: 'Italy', rarity: 'epic', art: 'flag:it', req: q('flags', 85), fact: 'The flag of Italy has three tall stripes: green, white and red. Italians call it il Tricolore.' },

  { id: 'lm-fuji', set: 'landmarks', name: 'Mount Fuji', rarity: 'common', art: 'land:fuji', req: q('landmarks', 15), fact: 'Mount Fuji in Japan is a volcano and the highest mountain in the country, about 3,776 metres tall.' },
  { id: 'lm-pyramid', set: 'landmarks', name: 'Great Pyramid', rarity: 'common', art: 'land:pyramid', req: q('landmarks', 35), fact: 'The Great Pyramid of Giza in Egypt was built about 4,500 years ago.' },
  { id: 'lm-eiffel', set: 'landmarks', name: 'Eiffel Tower', rarity: 'rare', art: 'land:eiffel', req: q('landmarks', 60), fact: 'The Eiffel Tower in Paris, France is made of iron. It was finished in 1889.' },
  { id: 'lm-borobudur', set: 'landmarks', name: 'Borobudur', rarity: 'epic', art: 'land:borobudur', req: q('landmarks', 85), fact: 'Borobudur in Central Java, Indonesia is the largest Buddhist temple in the world. It is over 1,000 years old.' },

  { id: 'iv-bell', set: 'inventors', name: 'Alexander Graham Bell', rarity: 'common', art: 'icon:bell', req: q('inventors', 15), fact: 'Alexander Graham Bell received the first patent for a telephone in 1876.' },
  { id: 'iv-gutenberg', set: 'inventors', name: 'Johannes Gutenberg', rarity: 'common', art: 'icon:book', req: q('inventors', 35), fact: 'Around 1450, Johannes Gutenberg built a printing press with movable metal letters, so books could be made faster.' },
  { id: 'iv-edison', set: 'inventors', name: 'Thomas Edison', rarity: 'rare', art: 'icon:bulb', req: q('inventors', 60), fact: 'In 1879 Thomas Edison and his team made an electric light bulb that could glow for many hours.' },
  { id: 'iv-wright', set: 'inventors', name: 'The Wright brothers', rarity: 'epic', art: 'icon:plane', req: q('inventors', 85), fact: 'In 1903 Orville and Wilbur Wright made the first powered, controlled flight in an aeroplane. It lasted 12 seconds.' },

  { id: 'sc-darwin', set: 'scientists', name: 'Charles Darwin', rarity: 'common', art: 'icon:turtle', req: { kind: 'mastered', subject: 'science', count: 1 }, fact: 'Charles Darwin sailed on a ship called the Beagle and studied many animals and plants, including those on the Galapagos Islands.' },
  { id: 'sc-newton', set: 'scientists', name: 'Isaac Newton', rarity: 'common', art: 'icon:apple', req: { kind: 'mastered', subject: 'science', count: 3 }, fact: 'Isaac Newton explained gravity, the pull that makes things fall down. A famous story says an apple helped him think about it.' },
  { id: 'sc-galileo', set: 'scientists', name: 'Galileo Galilei', rarity: 'rare', art: 'icon:moon', req: { kind: 'mastered', subject: 'science', count: 6 }, fact: 'In 1610 Galileo used a telescope to see four moons moving around Jupiter.' },
  { id: 'sc-curie', set: 'scientists', name: 'Marie Curie', rarity: 'epic', art: 'icon:bottle', req: { kind: 'mastered', subject: 'science', count: 10 }, fact: 'Marie Curie studied radioactivity. She won two Nobel Prizes, one in physics and one in chemistry.' },

  { id: 'rb-robot', set: 'robot', name: 'Puzzle Robot', rarity: 'legendary', art: 'boss:robot', req: { kind: 'boss' }, fact: 'The word robot comes from the Czech word robota, which means hard work. It was used in a play in 1920.' },
  { id: 'rb-comet', set: 'robot', name: 'Comet', rarity: 'legendary', art: 'boss:comet', req: { kind: 'boss' }, fact: 'A comet is a ball of ice and dust. When it comes near the Sun, it grows a glowing tail.' },
  { id: 'rb-aurora', set: 'robot', name: 'Aurora', rarity: 'legendary', art: 'boss:aurora', req: { kind: 'boss' }, fact: 'An aurora is a show of coloured light in the sky. It happens when particles from the Sun hit the air high above Earth.' },
  { id: 'rb-rainbow', set: 'robot', name: 'Rainbow', rarity: 'legendary', art: 'boss:rainbow', req: { kind: 'boss' }, fact: 'A rainbow appears when sunlight passes through raindrops and splits into its colours.' },
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
  masteredScience: number
}

export function cardEarned(card: CardDef, p: CardProgress): boolean {
  const r = card.req
  if (r.kind === 'quiz') {
    const t = p.quiz[r.topic]
    return !!t && t.total > 0 && (t.known * 100) / t.total >= r.pct
  }
  if (r.kind === 'mastered') return p.masteredScience >= r.count
  return false
}

/** Seberapa dekat kartu: 0 sampai 1, untuk bar kemajuan. */
export function cardCloseness(card: CardDef, p: CardProgress): number {
  const r = card.req
  if (r.kind === 'quiz') {
    const t = p.quiz[r.topic]
    if (!t || t.total === 0) return 0
    return Math.min(1, (t.known * 100) / t.total / r.pct)
  }
  if (r.kind === 'mastered') return Math.min(1, p.masteredScience / r.count)
  return 0
}

export function cardHint(card: CardDef): string {
  const r = card.req
  if (r.kind === 'quiz') return `Know ${r.pct} percent of the ${r.topic} facts in Quiz Arena`
  if (r.kind === 'mastered') return `Master ${r.count} Science ${r.count === 1 ? 'skill' : 'skills'}`
  return 'Beat the Puzzle Robot'
}

/** Kartu hadiah bos yang berikutnya (belum dimiliki), atau null bila semua sudah. */
export function nextBossCard(ownedIds: ReadonlySet<string>): CardDef | null {
  return cardsOfSet('robot').find((c) => !ownedIds.has(c.id)) ?? null
}

export function setComplete(set: CardSetId, ownedIds: ReadonlySet<string>): boolean {
  return cardsOfSet(set).every((c) => ownedIds.has(c.id))
}
