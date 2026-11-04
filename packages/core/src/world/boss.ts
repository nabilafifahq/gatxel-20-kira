/**
 * Tantangan bos. Empat belas lawan ramah, masing-masing dengan nama, sifat, gambar (di @kira/figures), kelemahan,
 * dan kalimat serangan serta kalah sendiri. Tenaga pertarungan hanya dari jawaban benar pada soal biasa. Anak tidak
 * punya nyawa: jawaban salah hanya membuat bos bercanda, dan kalah tidak mengurangi apa pun.
 */

export type BossSubject = 'math' | 'english' | 'science'
export type BossLevel = 1 | 2 | 3

export type BossDef = {
  id: string
  name: string
  /** Julukan pendek di papan nama. */
  epithet: string
  personality: string
  level: BossLevel
  /** Kelemahan yang dibaca anak. Soal lawan ini diambil dari mapel dan rumpun skill ini. */
  weakness: string
  subjects: readonly BossSubject[]
  /** Kode strand (skema konten). Kosong: semua strand mapel itu. */
  strands: readonly string[]
  intro: string
  /** Muncul saat jawaban salah. Tidak ada yang berkurang. */
  attacks: readonly string[]
  /** Muncul saat jawaban benar. */
  hits: readonly string[]
  defeat: string
  rematch: string
  /** Kartu langka yang didapat saat pertama kali menang. */
  card: string
}

export const BOSSES: readonly BossDef[] = [
  {
    id: 'robot',
    name: 'Puzzle Robot',
    epithet: 'The cheerful tinkerer',
    personality: 'Loves every kind of puzzle and polishes its head between rounds.',
    level: 1,
    weakness: 'A bit of everything',
    subjects: ['math', 'english', 'science'],
    strands: [],
    intro: 'Beep boop! I have a thousand puzzles and one very shiny head.',
    attacks: ['Puzzle Robot does a little victory beep. Try the next one!', 'Whirr! The robot spins its ears at you. No harm done.', 'The robot polishes its head and winks.'],
    hits: ['Bzzt! My gears!', 'Clunk! That one rattled my bolts.', 'Ouch! Who turned down my battery?'],
    defeat: 'Powering down. What a clever human. Beep.',
    rematch: 'Beep! My battery is still full. Come back for another go any time.',
    card: 'rb-robot',
  },
  {
    id: 'clickerclaw',
    name: 'Clickerclaw',
    epithet: 'The counting crab',
    personality: 'Counts everything twice, then once more to be sure.',
    level: 1,
    weakness: 'Counting and numbers',
    subjects: ['math'],
    strands: ['Nc', 'Ni', 'Np'],
    intro: 'Click, click, click! I have counted every grain of sand. Twice.',
    attacks: ['Clickerclaw clicks its beads at you. Click, click, click!', 'Clickerclaw waves a claw and counts to ten, very slowly.', 'Clickerclaw scuttles sideways and giggles.'],
    hits: ['Oh! You made me lose count!', 'My beads! They slid the wrong way!', 'Ow! Now I have to start again from one.'],
    defeat: 'I have counted it twice. You really did win.',
    rematch: 'Nine, ten, eleven. Oh, are you back? Let us count again soon.',
    card: 'bs-clickerclaw',
  },
  {
    id: 'mumblewump',
    name: 'Mumblewump',
    epithet: 'The fluffy word muddler',
    personality: 'A soft, round fluff ball who mixes up every word it tries to say.',
    level: 1,
    weakness: 'Word meanings',
    subjects: ['english'],
    strands: ['Rv', 'Wv'],
    intro: 'Good morning, my little spoon! I mean, my little moon. I mean, oh dear.',
    attacks: ['Mumblewump says: nice try, you clever teapot!', 'Mumblewump puffs up and sneezes out a word. It is the word “sausage”.', 'Mumblewump bounces and hums the wrong song.'],
    hits: ['Oof! My words fell out!', 'Fluff and bother! That was a good one!', 'Ow! I mean, wow! I mean, ow!'],
    defeat: 'You beat me fair and square. Or was it square and pear?',
    rematch: 'Come back soon, my little toast! I mean, my little host. I mean, my friend.',
    card: 'bs-mumblewump',
  },
  {
    id: 'mossback',
    name: 'Old Mossback',
    epithet: 'The sleepy stump',
    personality: 'A very old tree stump who has watched every bug and bird for a hundred years.',
    level: 1,
    weakness: 'Living things',
    subjects: ['science'],
    strands: ['Bs', 'Bp', 'Be'],
    intro: 'Mmm? Oh. A visitor. I was growing some moss. Very slowly.',
    attacks: ['Old Mossback yawns. A small beetle walks out of the yawn.', 'Old Mossback drops one leaf on your head. Very gently.', 'Old Mossback snores a little, then wakes up.'],
    hits: ['Oh! That woke up my roots!', 'Hmm! A squirrel fell off me!', 'Ooh, that made my leaves shake.'],
    defeat: 'Well, well. You know your living things. I shall have a little nap now.',
    rematch: 'Take your time. I am a stump. I will be right here.',
    card: 'bs-mossback',
  },
  {
    id: 'pizzasaur',
    name: 'Pizzasaur',
    epithet: 'The slice-loving dino',
    personality: 'Shares everything exactly, and gets very upset by a slice that is too big.',
    level: 2,
    weakness: 'Fractions and parts',
    subjects: ['math'],
    strands: ['Nf'],
    intro: 'Roar! That means: would you like one half or two quarters?',
    attacks: ['Pizzasaur roars a cheesy roar. It smells lovely.', 'Pizzasaur cuts the air into equal parts. Swish, swish.', 'Pizzasaur tosses a tomato. It misses by a mile.'],
    hits: ['My crust! My lovely crust!', 'Ouch! A whole slice fell off!', 'Oh no, I am only three quarters now!'],
    defeat: 'Roar. That means: you win. Have a slice.',
    rematch: 'Roar! That means: come back when you are hungry for more.',
    card: 'bs-pizzasaur',
  },
  {
    id: 'flapdoodle',
    name: 'Flapdoodle',
    epithet: 'The letter-dropping bat',
    personality: 'A bat who carries letters in the dark and keeps dropping them.',
    level: 2,
    weakness: 'Spelling and word parts',
    subjects: ['english'],
    strands: ['Ww', 'Rw'],
    intro: 'Eep! Has anyone seen my letter E? I dropped it in the word “tre”.',
    attacks: ['Flapdoodle drops a letter B on the floor. Bonk.', 'Flapdoodle hangs upside down and spells your name backwards.', 'Flapdoodle flaps past your ear. Eep eep!'],
    hits: ['Eep! There go my vowels!', 'My letters! They are all over the cave!', 'Oh! You spelled that right, and it hurt!'],
    defeat: 'E-E-E-Eep. You spell better than I fly. I give in.',
    rematch: 'Eep! I will go and find my letters. See you when you like.',
    card: 'bs-flapdoodle',
  },
  {
    id: 'rainbow',
    name: 'Rainbow Snail',
    epithet: 'The stuff collector',
    personality: 'Slow, proud and shiny, and it wants to know what everything is made of.',
    level: 2,
    weakness: 'Materials and changes',
    subjects: ['science'],
    strands: ['Cm', 'Cp', 'Cc'],
    intro: 'Is that wood? Is that metal? Hold still. I am coming. Slowly.',
    attacks: ['Rainbow Snail leaves a shiny trail. It will take a while to reach you.', 'Rainbow Snail pops into its shell, then pops out again. Boo!', 'Rainbow Snail licks a spoon and says: metal.'],
    hits: ['Ooh! My shell lost a colour!', 'Ouch! That was as hard as a diamond!', 'Oh my! I just melted a little!'],
    defeat: 'You know your stuff. I shall go back in my shell and think about it.',
    rematch: 'No hurry at all. I am the slowest boss there is.',
    card: 'rb-rainbow',
  },
  {
    id: 'ticktoad',
    name: 'Tick-Tock Toad',
    epithet: 'The toad who is always late',
    personality: 'Wears a clock on its tummy and still turns up five minutes late.',
    level: 2,
    weakness: 'Telling the time',
    subjects: ['math'],
    strands: ['Gt'],
    intro: 'Ribbit! Sorry I am late. What time is it? Do not look at my tummy.',
    attacks: ['Tick-Tock Toad croaks the hour. It is the wrong hour.', 'Tick-Tock Toad hops on the spot, tick, tock, tick, tock.', 'Tick-Tock Toad winds up its tummy and burps.'],
    hits: ['Ribbit! My hands spun round!', 'Oof! You knocked me back an hour!', 'Ding! That one rang my tummy bell.'],
    defeat: 'Time is up, and so am I. Well done. Ribbit.',
    rematch: 'Come back whenever suits you. I will be late anyway.',
    card: 'bs-ticktoad',
  },
  {
    id: 'inkyblot',
    name: 'Inky Blot',
    epithet: 'The comma-throwing squid',
    personality: 'A neat little squid who throws commas and full stops at any sentence it sees.',
    level: 2,
    weakness: 'Grammar and punctuation',
    subjects: ['english'],
    strands: ['Rg', 'Wg'],
    intro: 'Stop. Right. There. Comma. I have, too, many, commas.',
    attacks: ['Inky Blot throws a comma. It lands in the wrong place.', 'Inky Blot squirts a full stop right in the. Middle of a sentence.', 'Inky Blot wiggles all eight arms and shouts: question mark?'],
    hits: ['Splat! My ink ran out!', 'Oh! You put that exactly where it goes!', 'Blub! That was a perfect sentence!'],
    defeat: 'You win. Full stop.',
    rematch: 'This is not the end, comma, just a little pause. See you soon!',
    card: 'bs-inkyblot',
  },
  {
    id: 'voltafin',
    name: 'Voltafin',
    epithet: 'The zippy spark eel',
    personality: 'Cannot sit still, and lights up every time it has an idea.',
    level: 2,
    weakness: 'Forces and electricity',
    subjects: ['science'],
    strands: ['Pf', 'Pe'],
    intro: 'Zzzip! Push me, pull me, plug me in. I have so much energy!',
    attacks: ['Voltafin zips around you in a circle. Zzzip!', 'Voltafin lights up like a small lamp and laughs.', 'Voltafin sticks to a magnet and has to pull itself off.'],
    hits: ['Zzzt! You broke my circuit!', 'Whoa! You pushed me right over!', 'My spark! It went fizzle!'],
    defeat: 'Fizzle. My battery is flat. That was electric!',
    rematch: 'Zzzip! I will charge up. You charge up. Then let us go again.',
    card: 'bs-voltafin',
  },
  {
    id: 'hexapuff',
    name: 'Hexapuff',
    epithet: 'The six-sided puffer',
    personality: 'A pufferfish who swells into a perfect hexagon when it is excited.',
    level: 3,
    weakness: 'Shapes and position',
    subjects: ['math'],
    strands: ['Gg', 'Gp'],
    intro: 'Puff! Count my sides. Go on. I will wait. Puff, puff.',
    attacks: ['Hexapuff puffs up into a big hexagon and bumps you softly.', 'Hexapuff turns a quarter turn and looks very pleased.', 'Hexapuff swims in a perfect square.'],
    hits: ['Pfff! I lost a side!', 'Oh! Now I am only a pentagon!', 'Pop! That was a sharp one!'],
    defeat: 'Pfffffft. I am round again. You are very good at this.',
    rematch: 'Puff! I will practise my corners. Come back when you like.',
    card: 'bs-hexapuff',
  },
  {
    id: 'bookworm',
    name: 'Baron Bookworm',
    epithet: 'The grand reader',
    personality: 'Has eaten through the whole library and remembers every word.',
    level: 3,
    weakness: 'Reading and understanding',
    subjects: ['english'],
    strands: ['Ri', 'Rs', 'Ra'],
    intro: 'Ah. A reader. I have read everything, you know. I have also eaten most of it.',
    attacks: ['Baron Bookworm adjusts his top hat and reads you a very long word.', 'Baron Bookworm says: hmm, shall we read that one again?', 'Baron Bookworm nibbles a corner of the page.'],
    hits: ['Good grief! You understood that!', 'My hat! You knocked it right off!', 'Oh! I did not see that ending coming.'],
    defeat: 'Splendid. A true reader. I tip my hat, and then I eat it.',
    rematch: 'A good reader always goes back. I shall save you a page.',
    card: 'bs-bookworm',
  },
  {
    id: 'comet',
    name: 'Captain Comet',
    epithet: 'The icy sky pirate',
    personality: 'Sails around the Sun with a tail of dust and a very large hat.',
    level: 3,
    weakness: 'Earth and space',
    subjects: ['science'],
    strands: ['ESp', 'ESc', 'ESs'],
    intro: 'Ahoy! I have sailed past every planet, and I have only melted a little.',
    attacks: ['Captain Comet swooshes past and flicks some dust at you.', 'Captain Comet shouts: ahoy, how many moons have you got?', 'Captain Comet takes a very long trip round the Sun, then comes back.'],
    hits: ['Arr! My tail is shorter!', 'Blow me down! That was a direct hit!', 'Oh no, I can feel myself melting!'],
    defeat: 'Arr. You are a star among stars. I will see you in about seventy years.',
    rematch: 'Ahoy! Comets always come back. So can you.',
    card: 'rb-comet',
  },
  {
    id: 'aurora',
    name: 'Aurora Sprite',
    epithet: 'The dancer in the sky',
    personality: 'A ribbon of coloured light who sings very quietly above the snow.',
    level: 3,
    weakness: 'Light and sound',
    subjects: ['science'],
    strands: ['Pl'],
    intro: 'Shhh. Look up. Listen. Can you tell which is the light and which is the song?',
    attacks: ['Aurora Sprite swirls green and purple around you. How pretty!', 'Aurora Sprite sings one very high note. Ting!', 'Aurora Sprite casts a long, wobbly shadow.'],
    hits: ['Oh! You dimmed my colours!', 'That rang right through me!', 'Ah! You reflected that straight back!'],
    defeat: 'You see clearly and you hear clearly. Goodnight, bright one.',
    rematch: 'The sky is always here. Come and dance again.',
    card: 'rb-aurora',
  },
]

export function bossById(id: string): BossDef | undefined {
  return BOSSES.find((b) => b.id === id)
}

/** Lawan level lebih tinggi butuh lebih banyak pukulan: 8, 10, atau 12 soal. */
export const BOSS_LEVEL_QUESTIONS: Record<BossLevel, number> = { 1: 8, 2: 10, 3: 12 }

/** Lawan yang bisa ditawarkan: mapelnya tidak dimatikan orang tua. Robot campuran cukup satu mapel menyala. */
export function bossesAvailable(subjectOn: (s: BossSubject) => boolean): BossDef[] {
  return BOSSES.filter((b) => b.subjects.some(subjectOn))
}

/** Tiga lawan terbuka sejak awal. Lawan baru datang tiap 2 hari belajar. Tidak pernah berkurang. */
export const BOSS_OPEN_START = 3
export const BOSS_OPEN_EVERY = 2

export function bossOpenCount(studyDays: number): number {
  return BOSS_OPEN_START + Math.floor(Math.max(0, studyDays) / BOSS_OPEN_EVERY)
}

/** Berapa hari belajar lagi sampai lawan berikutnya datang. Null bila semua sudah datang. */
export function bossNextIn(studyDays: number, available: number): number | null {
  if (bossOpenCount(studyDays) >= available) return null
  return BOSS_OPEN_EVERY - (Math.max(0, studyDays) % BOSS_OPEN_EVERY)
}

/** Referensi attempt bos. Format lama `boss:<minggu>:<n>` berarti Puzzle Robot. */
export function bossRef(week: string, id: string, tryNo: number): string {
  return `boss:${week}:${id}:${tryNo}`
}

export function parseBossRef(ref: string): { week: string; id: string } {
  const parts = ref.split(':')
  return { week: parts[1] ?? '', id: parts.length >= 4 && parts[2] ? parts[2] : 'robot' }
}

/** Menang bila benar sedikitnya 70 persen dari soal yang ada (7 dari 10, 6 dari 8). */
export function bossWinAt(total: number): number {
  return Math.max(3, Math.ceil(total * 0.7))
}

/** Sisa tenaga bos, 0 sampai 1. Tenaga habis tepat saat jumlah benar cukup untuk menang, jadi bar selalu jujur. */
export function bossEnergy(right: number, total: number): number {
  const hits = bossWinAt(total)
  return Math.max(0, 1 - Math.max(0, right) / hits)
}

/** Kalimat ke-n dari daftar, berputar. */
export function bossLine(lines: readonly string[], n: number): string {
  return lines[Math.max(0, n) % lines.length] ?? ''
}

export type BossChunk = { subject: BossSubject; strands: readonly string[]; count: number }

/**
 * Rencana soal. Lawan satu rumpun: potongan 3 soal dari skill yang berbeda di rumpun itu. Robot: bergiliran antar
 * mapel yang menyala. Jumlah total selalu sama dengan `questions` (selama ada mapel yang menyala).
 */
export function bossPlan(def: BossDef, questions: number, subjectOn: (s: BossSubject) => boolean): BossChunk[] {
  const subjects = def.subjects.filter(subjectOn)
  if (subjects.length === 0) return []
  const out: BossChunk[] = []
  let left = questions
  let i = 0
  while (left > 0) {
    const count = Math.min(3, left)
    out.push({ subject: subjects[i % subjects.length]!, strands: def.strands, count })
    left -= count
    i++
  }
  return out
}

/** Lawan yang disorot saat layar dibuka: yang belum pernah kalah, atau bergiliran per minggu bila semua sudah kalah. */
export function bossSpotlight(openIds: readonly string[], wins: Readonly<Record<string, number>>, week: string): string | null {
  const fresh = openIds.find((id) => !wins[id])
  if (fresh) return fresh
  if (openIds.length === 0) return null
  const seed = week.split('').reduce((s, ch) => s + ch.charCodeAt(0), 0)
  return openIds[seed % openIds.length]!
}
