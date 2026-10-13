/**
 * Topik alam: hewan, tubuh manusia, tata surya, dinosaurus.
 */
import type { IconName } from '@kira/figures/spec'
import type { KAsk, KFact, KOrderSet, KTopic, Pic, PlanetName } from '../types'

const icon = (name: IconName): Pic => ({ t: 'icon', name })
const planet = (name: PlanetName): Pic => ({ t: 'planet', name })
const without = (list: readonly string[], x: string): string[] => list.filter((y) => y !== x)

// ---------------------------------------------------------------------------
// Hewan

const GROUPS = ['Mammal', 'Bird', 'Reptile', 'Amphibian', 'Fish', 'Insect'] as const
type AnimalGroup = (typeof GROUPS)[number]

type Animal = {
  id: string
  name: string
  /** Ikon gambar (kosong bila tidak ada gambarnya). */
  icon?: IconName
  group: AnimalGroup | 'Other'
  habitat?: string
  /** Pilihan habitat lain yang juga benar, tidak dipakai sebagai pengecoh. */
  alsoOk?: string[]
  diet?: 'Herbivore' | 'Carnivore' | 'Omnivore'
  food?: string
  foodKind?: 'plants' | 'meat' | 'insects' | 'nectar' | 'fish' | 'mixed'
  /** Kalimat fakta untuk kartu belajar. */
  fact: string
}

const ANIMALS: readonly Animal[] = [
  { id: 'cat', name: 'Cat', icon: 'cat', group: 'Mammal', habitat: 'At home', alsoOk: ['On a farm'], diet: 'Carnivore', food: 'Meat and fish', foodKind: 'meat', fact: 'A cat is a mammal. It purrs when it is happy.' },
  { id: 'dog', name: 'Dog', icon: 'dog', group: 'Mammal', habitat: 'At home', alsoOk: ['On a farm'], fact: 'A dog is a mammal. Dogs have a great sense of smell.' },
  { id: 'fish', name: 'Fish', icon: 'fish', group: 'Fish', fact: 'A fish lives in water and breathes with gills.' },
  { id: 'bird', name: 'Bird', icon: 'bird', group: 'Bird', fact: 'A bird has feathers and wings. Most birds can fly.' },
  { id: 'frog', name: 'Frog', icon: 'frog', group: 'Amphibian', habitat: 'In a pond', alsoOk: ['In the forest'], diet: 'Carnivore', food: 'Insects', foodKind: 'insects', fact: 'A frog is an amphibian. It starts life as a tadpole in the water.' },
  { id: 'butterfly', name: 'Butterfly', icon: 'butterfly', group: 'Insect', diet: 'Herbivore', food: 'Nectar from flowers', foodKind: 'nectar', fact: 'A butterfly is an insect with six legs. It starts life as a caterpillar.' },
  { id: 'bee', name: 'Bee', icon: 'bee', group: 'Insect', habitat: 'In a hive', diet: 'Herbivore', food: 'Nectar and pollen', foodKind: 'nectar', fact: 'A bee is an insect. Honey bees live in a hive and make honey.' },
  { id: 'ant', name: 'Ant', icon: 'ant', group: 'Insect', habitat: 'In an ant nest', diet: 'Omnivore', food: 'Seeds, sugar and tiny insects', foodKind: 'mixed', fact: 'An ant is an insect. Ants live together in a big nest.' },
  { id: 'snail', name: 'Snail', icon: 'snail', group: 'Other', diet: 'Herbivore', food: 'Leaves', foodKind: 'plants', fact: 'A snail has a soft body and a hard shell. It is not an insect.' },
  { id: 'spider', name: 'Spider', icon: 'spider', group: 'Other', diet: 'Carnivore', food: 'Insects', foodKind: 'insects', fact: 'A spider has eight legs, so it is not an insect.' },
  { id: 'hen', name: 'Hen', icon: 'hen', group: 'Bird', habitat: 'On a farm', diet: 'Omnivore', food: 'Seeds and insects', foodKind: 'mixed', fact: 'A hen is a bird that lays eggs.' },
  { id: 'duck', name: 'Duck', icon: 'duck', group: 'Bird', habitat: 'In a pond', alsoOk: ['On a farm'], diet: 'Omnivore', food: 'Plants, insects and small fish', foodKind: 'mixed', fact: 'A duck is a bird with webbed feet for swimming.' },
  { id: 'cow', name: 'Cow', icon: 'cow', group: 'Mammal', habitat: 'On a farm', diet: 'Herbivore', food: 'Grass', foodKind: 'plants', fact: 'A cow is a mammal that gives us milk.' },
  { id: 'rabbit', name: 'Rabbit', icon: 'rabbit', group: 'Mammal', habitat: 'In a burrow', alsoOk: ['On a farm', 'At home'], diet: 'Herbivore', food: 'Grass and vegetables', foodKind: 'plants', fact: 'A rabbit is a mammal with long ears and strong back legs.' },
  { id: 'mouse', name: 'Mouse', icon: 'mouse', group: 'Mammal', diet: 'Omnivore', food: 'Seeds, grain and fruit', foodKind: 'mixed', fact: 'A mouse is a small mammal with a long tail.' },
  { id: 'lion', name: 'Lion', icon: 'lion', group: 'Mammal', habitat: 'In the savannah', diet: 'Carnivore', food: 'Meat', foodKind: 'meat', fact: 'A lion is a big cat that lives in a group called a pride.' },
  { id: 'elephant', name: 'Elephant', icon: 'elephant', group: 'Mammal', habitat: 'In the savannah', alsoOk: ['In the forest'], diet: 'Herbivore', food: 'Grass, leaves and bark', foodKind: 'plants', fact: 'An elephant is the biggest land animal.' },
  { id: 'monkey', name: 'Monkey', icon: 'monkey', group: 'Mammal', habitat: 'In the forest', diet: 'Omnivore', food: 'Fruit, leaves and insects', foodKind: 'mixed', fact: 'A monkey is a mammal that climbs trees.' },
  { id: 'snake', name: 'Snake', icon: 'snake', group: 'Reptile', diet: 'Carnivore', food: 'Small animals', foodKind: 'meat', fact: 'A snake is a reptile with no legs and dry scaly skin.' },
  { id: 'lizard', name: 'Lizard', icon: 'lizard', group: 'Reptile', fact: 'A lizard is a reptile with four legs and scaly skin.' },
  { id: 'turtle', name: 'Turtle', icon: 'turtle', group: 'Reptile', fact: 'A turtle is a reptile with a hard shell on its back.' },
  { id: 'crab', name: 'Crab', icon: 'crab', group: 'Other', habitat: 'By the sea', alsoOk: ['In the sea'], diet: 'Omnivore', food: 'Small sea animals and plants', foodKind: 'mixed', fact: 'A crab has a hard shell and ten legs, including two claws.' },
  { id: 'whale', name: 'Whale', icon: 'whale', group: 'Mammal', habitat: 'In the sea', alsoOk: ['By the sea'], diet: 'Carnivore', food: 'Fish and tiny sea animals', foodKind: 'fish', fact: 'A whale is a mammal, not a fish. It breathes air.' },
  { id: 'camel', name: 'Camel', icon: 'camel', group: 'Mammal', habitat: 'In the desert', diet: 'Herbivore', food: 'Desert plants', foodKind: 'plants', fact: 'A camel is a mammal that can go a long time without water.' },
  { id: 'penguin', name: 'Penguin', icon: 'penguin', group: 'Bird', habitat: 'In icy lands', alsoOk: ['In the sea'], diet: 'Carnivore', food: 'Fish and krill', foodKind: 'fish', fact: 'A penguin is a bird that cannot fly but swims very well.' },
  { id: 'owl', name: 'Owl', icon: 'owl', group: 'Bird', habitat: 'In the forest', alsoOk: ['On a farm'], diet: 'Carnivore', food: 'Mice and insects', foodKind: 'meat', fact: 'An owl is a bird that hunts at night.' },
  { id: 'bat', name: 'Bat', icon: 'bat', group: 'Mammal', fact: 'A bat is the only mammal that can truly fly.' },
  { id: 'shark', name: 'Shark', icon: 'shark', group: 'Fish', habitat: 'In the sea', alsoOk: ['By the sea'], diet: 'Carnivore', food: 'Fish and other sea animals', foodKind: 'fish', fact: 'A shark is a fish with a skeleton made of cartilage.' },
  { id: 'polarbear', name: 'Polar bear', icon: 'polar-bear', group: 'Mammal', habitat: 'In icy lands', alsoOk: ['In the sea'], diet: 'Carnivore', food: 'Seals and fish', foodKind: 'meat', fact: 'A polar bear is a big white mammal that lives in the icy Arctic.' },
  { id: 'ladybird', name: 'Ladybird', icon: 'ladybird', group: 'Insect', diet: 'Carnivore', food: 'Tiny insects called aphids', foodKind: 'insects', fact: 'A ladybird is a small red beetle with black spots. It is an insect.' },
  { id: 'chick', name: 'Chick', icon: 'chick', group: 'Bird', habitat: 'On a farm', fact: 'A chick is a baby bird that hatches from an egg.' },
  { id: 'caterpillar', name: 'Caterpillar', icon: 'caterpillar', group: 'Insect', diet: 'Herbivore', food: 'Leaves', foodKind: 'plants', fact: 'A caterpillar is a baby butterfly or moth. It eats lots of leaves.' },
  { id: 'tadpole', name: 'Tadpole', icon: 'tadpole', group: 'Amphibian', habitat: 'In a pond', alsoOk: ['In the forest'], fact: 'A tadpole is a baby frog. It lives in the water and has a tail.' },
  // Tanpa gambar
  { id: 'orangutan', name: 'Orangutan', group: 'Mammal', habitat: 'In the forest', diet: 'Omnivore', food: 'Fruit, leaves and bark', foodKind: 'mixed', fact: 'An orangutan is a mammal that lives in the rainforests of Sumatra and Borneo.' },
  { id: 'komodo', name: 'Komodo dragon', group: 'Reptile', diet: 'Carnivore', food: 'Deer, pigs and other animals', foodKind: 'meat', fact: 'The Komodo dragon is the biggest lizard in the world. It lives on islands of Indonesia.' },
  { id: 'tiger', name: 'Tiger', group: 'Mammal', habitat: 'In the forest', diet: 'Carnivore', food: 'Meat', foodKind: 'meat', fact: 'A tiger is the biggest of the big cats. Its fur has stripes.' },
  { id: 'giraffe', name: 'Giraffe', group: 'Mammal', habitat: 'In the savannah', diet: 'Herbivore', food: 'Leaves from tall trees', foodKind: 'plants', fact: 'A giraffe is the tallest land animal.' },
  { id: 'crocodile', name: 'Crocodile', group: 'Reptile', diet: 'Carnivore', food: 'Fish and other animals', foodKind: 'meat', fact: 'A crocodile is a big reptile that lives in water.' },
  { id: 'dolphin', name: 'Dolphin', group: 'Mammal', habitat: 'In the sea', alsoOk: ['By the sea'], diet: 'Carnivore', food: 'Fish', foodKind: 'fish', fact: 'A dolphin is a clever mammal that lives in the sea.' },
  { id: 'kangaroo', name: 'Kangaroo', group: 'Mammal', diet: 'Herbivore', food: 'Grass', foodKind: 'plants', fact: 'A kangaroo is a mammal that hops. Its baby grows up in a pouch.' },
  { id: 'eagle', name: 'Eagle', group: 'Bird', diet: 'Carnivore', food: 'Small animals', foodKind: 'meat', fact: 'An eagle is a big bird with very sharp eyes.' },
]


const DIET_OPTIONS = ['Herbivore', 'Carnivore', 'Omnivore'] as const
const HOME_OF = (a: Animal) => a.habitat as string

function animalFact(a: Animal): KFact {
  const pic = a.icon ? icon(a.icon) : undefined
  const article = /^[AEIOU]/.test(a.name) ? 'an' : 'a'
  const nm = a.id === 'komodo' ? a.name : a.name.toLowerCase()
  const The = `The ${nm}`
  const asks: KAsk[] = []
  if (pic) {
    asks.push({ prompt: 'Which animal is this?', pic, answer: { label: a.name }, pool: 'animal-pic', mode: 'any', explain: `This is a ${nm}.` })
  }
  if (a.group !== 'Other') {
    asks.push({
      prompt: `Which group does the ${nm} belong to?`,
      ...(pic ? { pic } : {}),
      answer: { label: a.group },
      pool: '',
      wrong: without(GROUPS, a.group),
      statement: (l) => `${The} is ${/^[AEIOU]/.test(l) ? 'an' : 'a'} ${l.toLowerCase()}.`,
      explain: a.fact,
    })
  }
  if (a.habitat) {
    asks.push({
      prompt: `Where does ${article} ${nm} live?`,
      ...(pic ? { pic } : {}),
      answer: { label: HOME_OF(a) },
      pool: 'habitat',
      mode: 'any',
      exclude: [...(a.alsoOk ?? [])],
      statement: (l) => `${The} lives ${l.charAt(0).toLowerCase()}${l.slice(1)}.`,
      explain: `${The} lives ${HOME_OF(a).charAt(0).toLowerCase()}${HOME_OF(a).slice(1)}.`,
    })
  }
  if (a.diet) {
    asks.push({
      prompt: `Is the ${nm} a herbivore, a carnivore or an omnivore?`,
      ...(pic ? { pic } : {}),
      answer: { label: a.diet },
      pool: '',
      wrong: without(DIET_OPTIONS, a.diet),
      options: 3,
      explain: `${The} is ${/^[AEIOU]/.test(a.diet) ? 'an' : 'a'} ${a.diet.toLowerCase()}. ${a.diet === 'Herbivore' ? 'It eats plants.' : a.diet === 'Carnivore' ? 'It eats other animals.' : 'It eats plants and animals.'}`,
    })
  }
  if (a.food && a.foodKind && a.foodKind !== 'mixed') {
    asks.push({
      prompt: `What does ${article} ${nm} eat?`,
      ...(pic ? { pic } : {}),
      answer: { label: a.food },
      pool: a.foodKind === 'plants' ? 'food-plants' : 'food-animal',
      draw: [a.foodKind === 'plants' ? 'food-animal' : 'food-plants'],
      mode: 'any',
      explain: `${The} eats: ${a.food.charAt(0).toLowerCase()}${a.food.slice(1)}.`,
    })
  }
  const tf = [] as NonNullable<KFact['tf']>
  if (a.id === 'whale') tf.push({ prompt: 'A whale is a fish.', truth: false, explain: 'A whale is a mammal. It breathes air and feeds milk to its baby.' })
  if (a.id === 'bat') tf.push({ prompt: 'A bat is a mammal.', truth: true, explain: 'Yes. A bat is a mammal, and it is the only mammal that can truly fly.' })
  if (a.id === 'spider') tf.push({ prompt: 'A spider is an insect.', truth: false, explain: 'A spider has eight legs. Insects have six legs, so a spider is not an insect.' })
  if (a.id === 'penguin') tf.push({ prompt: 'A penguin can fly.', truth: false, explain: 'A penguin is a bird, but it cannot fly. It swims very well.' })
  if (a.id === 'snail') tf.push({ prompt: 'A snail is an insect.', truth: false, explain: 'A snail has a soft body and a shell. It is not an insect.' })
  if (a.id === 'butterfly') tf.push({ prompt: 'A butterfly starts life as a caterpillar.', truth: true, explain: 'Yes. A caterpillar grows, makes a chrysalis, and becomes a butterfly.' })
  if (a.id === 'frog') tf.push({ prompt: 'A frog starts life as a tadpole.', truth: true, explain: 'Yes. A tadpole lives in the water and grows into a frog.' })
  if (a.id === 'komodo') tf.push({ prompt: 'The Komodo dragon is a kind of lizard.', truth: true, explain: 'Yes. It is the biggest lizard in the world.' })
  if (a.id === 'elephant') tf.push({ prompt: 'The elephant is the biggest land animal.', truth: true, explain: 'Yes. The elephant is the biggest animal that lives on land.' })
  if (a.id === 'shark') tf.push({ prompt: 'A shark is a mammal.', truth: false, explain: 'A shark is a fish. It breathes with gills.' })
  if (a.id === 'camel') tf.push({ prompt: 'A camel lives in the Arctic.', truth: false, explain: 'A camel lives in hot deserts, not in the Arctic.' })
  return {
    id: `animal:${a.id}`,
    topic: 'animals',
    group: a.icon ? 'pictured' : 'text',
    tier: a.icon ? 1 : 2,
    card: { front: a.name, ...(pic ? { frontPic: pic } : {}), back: a.fact },
    asks,
    ...(tf.length ? { tf } : {}),
  }
}

export const ANIMALS_TOPIC: KTopic = {
  id: 'animals',
  title: 'Animals',
  blurb: 'Groups, homes and food of animals.',
  pic: icon('lion'),
  pictures: true,
  facts: ANIMALS.map(animalFact),
  orders: [],
}

// ---------------------------------------------------------------------------
// Tubuh manusia

type Part = { id: string; name: string; icon?: IconName; verb: string; sense?: string; fact: string }

const PARTS: readonly Part[] = [
  { id: 'eye', name: 'Eye', icon: 'eye', verb: 'the eyes do', sense: 'see', fact: 'We see with our eyes.' },
  { id: 'ear', name: 'Ear', icon: 'ear', verb: 'the ears do', sense: 'hear', fact: 'We hear with our ears.' },
  { id: 'nose', name: 'Nose', icon: 'nose', verb: 'the nose does', sense: 'smell', fact: 'We smell with our nose.' },
  { id: 'tongue', name: 'Tongue', icon: 'tongue', verb: 'the tongue does', sense: 'taste', fact: 'We taste with our tongue.' },
  { id: 'hand', name: 'Hand', icon: 'hand', verb: 'the hands do', fact: 'We use our hands to hold and touch things.' },
  { id: 'tooth', name: 'Tooth', icon: 'tooth', verb: 'the teeth do', fact: 'Our teeth help us bite and chew food.' },
  { id: 'heart', name: 'Heart', icon: 'heart-organ', verb: 'the heart does', fact: 'The heart pumps blood around the body.' },
  { id: 'lungs', name: 'Lungs', icon: 'lungs', verb: 'the lungs do', fact: 'The lungs help us breathe.' },
  { id: 'brain', name: 'Brain', icon: 'brain', verb: 'the brain does', fact: 'The brain controls the body and lets us think.' },
  { id: 'stomach', name: 'Stomach', icon: 'stomach', verb: 'the stomach does', fact: 'The stomach breaks down the food we eat.' },
  { id: 'bone', name: 'Bone', icon: 'bone', verb: 'the bones do', fact: 'Bones hold the body up and give it shape.' },
  { id: 'skeleton', name: 'Skeleton', icon: 'skeleton', verb: 'the skeleton does', fact: 'The skeleton is all the bones in the body. It protects the organs inside.' },
  { id: 'muscle', name: 'Muscle', icon: 'muscle', verb: 'the muscles do', fact: 'Muscles pull on the bones to make the body move.' },
]

const JOBS: Record<string, string> = {
  eye: 'They let us see.',
  ear: 'They let us hear.',
  nose: 'It lets us smell.',
  tongue: 'It lets us taste.',
  hand: 'They hold and touch things.',
  tooth: 'They bite and chew food.',
  heart: 'It pumps blood around the body.',
  lungs: 'They help us breathe.',
  brain: 'It controls the body and lets us think.',
  stomach: 'It breaks down our food.',
  bone: 'They hold the body up.',
  skeleton: 'It holds the body up and protects the organs.',
  muscle: 'They make the body move.',
}

function partFact(p: Part): KFact {
  const pic = p.icon ? icon(p.icon) : undefined
  const asks: KAsk[] = []
  if (pic) asks.push({ prompt: 'Which part of the body is this?', pic, answer: { label: p.name }, pool: 'part', mode: 'any', explain: p.fact })
  asks.push({
    prompt: `What ${p.verb.endsWith(' does') ? 'does' : 'do'} ${p.verb.replace(/ (do|does)$/, '')} do?`,
    answer: { label: JOBS[p.id] as string },
    pool: 'job',
    mode: 'any',
    ...(p.id === 'bone' ? { exclude: [JOBS.skeleton as string] } : p.id === 'skeleton' ? { exclude: [JOBS.bone as string] } : {}),
    explain: p.fact,
  })
  if (p.sense) {
    asks.push({
      prompt: `Which part of the body do we use to ${p.sense}?`,
      answer: { label: p.name },
      pool: 'part',
      mode: 'any',
      explain: p.fact,
    })
  }
  return { id: `body:${p.id}`, topic: 'body', group: 'parts', tier: 1, card: { front: p.name, ...(pic ? { frontPic: pic } : {}), back: p.fact }, asks }
}

const BODY_STATIC: KFact[] = [
  {
    id: 'body:bones-206',
    topic: 'body',
    group: 'numbers',
    tier: 2,
    card: { front: 'How many bones does a grown-up have?', back: '206 bones.' },
    asks: [{ prompt: 'How many bones does a grown-up have?', answer: { label: '206' }, pool: '', wrong: ['106', '156', '306', '406'], explain: 'A grown-up has 206 bones.', statement: (l) => `A grown-up has ${l} bones.` }],
  },
  {
    id: 'body:teeth-32',
    topic: 'body',
    group: 'numbers',
    tier: 2,
    card: { front: 'How many teeth does a grown-up have?', back: '32 teeth. Children have 20 baby teeth first.' },
    asks: [{ prompt: 'How many teeth does a grown-up usually have?', answer: { label: '32' }, pool: '', wrong: ['20', '24', '28', '40'], explain: 'A grown-up usually has 32 teeth. Children have 20 baby teeth first.', statement: (l) => `A grown-up usually has ${l} teeth.` }],
  },
  {
    id: 'body:senses-5',
    topic: 'body',
    group: 'numbers',
    tier: 1,
    card: { front: 'How many senses do we have?', back: '5 senses: sight, hearing, smell, taste and touch.' },
    asks: [{ prompt: 'How many senses do we usually count?', answer: { label: '5' }, pool: '', wrong: ['3', '4', '6', '7'], explain: 'We count five senses: sight, hearing, smell, taste and touch.', statement: (l) => `We usually count ${l} senses.` }],
  },
  {
    id: 'body:skin',
    topic: 'body',
    group: 'other',
    tier: 1,
    card: { front: 'The biggest organ', back: 'Your skin is the biggest organ of the body.' },
    asks: [{ prompt: 'Which is the biggest organ of the body?', answer: { label: 'Skin' }, pool: '', wrong: ['Heart', 'Brain', 'Stomach', 'Lungs'], explain: 'Your skin is the biggest organ of the body.', statement: (l) => `${l} is the biggest organ of the body.` }],
  },
  {
    id: 'body:thigh-bone',
    topic: 'body',
    group: 'other',
    tier: 3,
    card: { front: 'The longest bone', back: 'The thigh bone, called the femur, is the longest bone.' },
    asks: [{ prompt: 'Where is the longest bone in the body?', answer: { label: 'In the leg (thigh)' }, pool: '', wrong: ['In the arm', 'In the back', 'In the neck'], explain: 'The thigh bone, called the femur, is the longest bone.' }],
  },
  {
    id: 'body:ear-bone',
    topic: 'body',
    group: 'other',
    tier: 3,
    card: { front: 'The smallest bone', back: 'The smallest bone is deep inside the ear.' },
    asks: [{ prompt: 'Where is the smallest bone in the body?', answer: { label: 'In the ear' }, pool: '', wrong: ['In the finger', 'In the nose', 'In the foot'], explain: 'The smallest bone is deep inside the ear.' }],
  },
  {
    id: 'body:breathe',
    topic: 'body',
    group: 'other',
    tier: 1,
    card: { front: 'What we breathe in', back: 'We breathe in oxygen and breathe out carbon dioxide.' },
    asks: [{ prompt: 'Which gas do we breathe in to stay alive?', answer: { label: 'Oxygen' }, pool: '', wrong: ['Carbon dioxide', 'Steam', 'Smoke'], explain: 'We breathe in oxygen and breathe out carbon dioxide.' }],
  },
  {
    id: 'body:skull',
    topic: 'body',
    group: 'other',
    tier: 2,
    card: { front: 'The skull', back: 'The skull is the bone that protects the brain.' },
    asks: [{ prompt: 'Which bones protect the brain?', answer: { label: 'The skull' }, pool: '', wrong: ['The ribs', 'The spine', 'The knee'], explain: 'The skull protects the brain.' }],
    tf: [{ prompt: 'Your ribs protect your heart and lungs.', truth: true, explain: 'Yes. The ribs make a cage around the heart and lungs.' }],
  },
  {
    id: 'body:blood',
    topic: 'body',
    group: 'other',
    tier: 2,
    card: { front: 'Blood', back: 'Blood carries oxygen around the body.' },
    asks: [{ prompt: 'What carries oxygen around the body?', answer: { label: 'Blood' }, pool: '', wrong: ['Bones', 'Skin', 'Hair'], explain: 'Blood carries oxygen around the body. The heart pumps it.' }],
    tf: [{ prompt: 'We use our eyes to hear.', truth: false, explain: 'We hear with our ears. We see with our eyes.' }],
  },
]

export const BODY_TOPIC: KTopic = {
  id: 'body',
  title: 'The human body',
  blurb: 'Body parts, senses and what they do.',
  pic: icon('heart-organ'),
  pictures: true,
  facts: [...PARTS.map(partFact), ...BODY_STATIC],
  orders: [],
}

// ---------------------------------------------------------------------------
// Tata surya

const PLANET_LABELS = ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'] as const
type PlanetLabel = (typeof PLANET_LABELS)[number]

type PlanetData = { id: PlanetName; name: PlanetLabel; place: string; fact: string; traits: { q: string; s: (l: string) => string; explain: string }[] }

const PLANETS: readonly PlanetData[] = [
  {
    id: 'mercury',
    name: 'Mercury',
    place: 'first',
    fact: 'Mercury is the closest planet to the Sun and the smallest planet.',
    traits: [
      { q: 'Which planet is closest to the Sun?', s: (l) => `${l} is the closest planet to the Sun.`, explain: 'Mercury is the closest planet to the Sun.' },
      { q: 'Which is the smallest planet?', s: (l) => `${l} is the smallest planet.`, explain: 'Mercury is the smallest planet in our solar system.' },
    ],
  },
  {
    id: 'venus',
    name: 'Venus',
    place: 'second',
    fact: 'Venus is the hottest planet. Thick clouds trap the heat.',
    traits: [
      { q: 'Which planet is the hottest?', s: (l) => `${l} is the hottest planet.`, explain: 'Venus is the hottest planet because thick clouds trap its heat.' },
      { q: 'Which planet is second from the Sun?', s: (l) => `${l} is second from the Sun.`, explain: 'Venus is the second planet from the Sun.' },
    ],
  },
  {
    id: 'earth',
    name: 'Earth',
    place: 'third',
    fact: 'Earth is our home. It is the only planet we know that has life.',
    traits: [
      { q: 'Which planet do we live on?', s: (l) => `We live on ${l}.`, explain: 'We live on Earth, the third planet from the Sun.' },
      { q: 'Which planet is third from the Sun?', s: (l) => `${l} is third from the Sun.`, explain: 'Earth is the third planet from the Sun.' },
      { q: 'Which planet is the only one we know that has life?', s: (l) => `${l} is the only planet we know that has life.`, explain: 'Earth is the only planet we know that has life.' },
    ],
  },
  {
    id: 'mars',
    name: 'Mars',
    place: 'fourth',
    fact: 'Mars is the Red Planet. It has the biggest volcano in the solar system.',
    traits: [
      { q: 'Which planet is called the Red Planet?', s: (l) => `${l} is called the Red Planet.`, explain: 'Mars is called the Red Planet because its soil is rusty red.' },
      { q: 'Which planet is fourth from the Sun?', s: (l) => `${l} is fourth from the Sun.`, explain: 'Mars is the fourth planet from the Sun.' },
    ],
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    place: 'fifth',
    fact: 'Jupiter is the biggest planet. It has a giant storm called the Great Red Spot.',
    traits: [
      { q: 'Which is the biggest planet?', s: (l) => `${l} is the biggest planet.`, explain: 'Jupiter is the biggest planet in our solar system.' },
      { q: 'Which planet has a giant storm called the Great Red Spot?', s: (l) => `${l} has a giant storm called the Great Red Spot.`, explain: 'Jupiter has a giant storm called the Great Red Spot.' },
    ],
  },
  {
    id: 'saturn',
    name: 'Saturn',
    place: 'sixth',
    fact: 'Saturn is famous for its bright rings.',
    traits: [
      { q: 'Which planet is famous for its bright rings?', s: (l) => `${l} is famous for its bright rings.`, explain: 'Saturn is famous for its bright rings of ice and rock.' },
      { q: 'Which planet is sixth from the Sun?', s: (l) => `${l} is sixth from the Sun.`, explain: 'Saturn is the sixth planet from the Sun.' },
    ],
  },
  {
    id: 'uranus',
    name: 'Uranus',
    place: 'seventh',
    fact: 'Uranus is tipped over and spins on its side.',
    traits: [
      { q: 'Which planet spins on its side?', s: (l) => `${l} spins on its side.`, explain: 'Uranus is tipped over, so it spins on its side.' },
      { q: 'Which planet is seventh from the Sun?', s: (l) => `${l} is seventh from the Sun.`, explain: 'Uranus is the seventh planet from the Sun.' },
    ],
  },
  {
    id: 'neptune',
    name: 'Neptune',
    place: 'eighth',
    fact: 'Neptune is the farthest planet from the Sun. It is a cold, windy, blue planet.',
    traits: [
      { q: 'Which planet is farthest from the Sun?', s: (l) => `${l} is the farthest planet from the Sun.`, explain: 'Neptune is the farthest planet from the Sun.' },
      { q: 'Which planet is eighth from the Sun?', s: (l) => `${l} is eighth from the Sun.`, explain: 'Neptune is the eighth planet from the Sun.' },
    ],
  },
]

function planetFact(p: PlanetData): KFact {
  const asks: KAsk[] = [
    { prompt: 'Which planet is this?', pic: planet(p.id), answer: { label: p.name }, pool: 'planet', mode: 'any', explain: `This is ${p.name}. ${p.fact}` },
    ...p.traits.map(
      (t): KAsk => ({ prompt: t.q, answer: { label: p.name }, pool: 'planet', mode: 'any', statement: t.s, explain: t.explain }),
    ),
  ]
  return { id: `space:${p.id}`, topic: 'space', group: 'planets', tier: 1, card: { front: p.name, frontPic: planet(p.id), back: p.fact }, asks }
}

const SPACE_STATIC: KFact[] = [
  {
    id: 'space:sun',
    topic: 'space',
    group: 'other',
    tier: 1,
    card: { front: 'The Sun', frontPic: planet('sun'), back: 'The Sun is a star. It gives us light and heat.' },
    asks: [
      { prompt: 'What is the Sun?', pic: planet('sun'), answer: { label: 'A star' }, pool: '', wrong: ['A planet', 'A moon', 'A comet'], explain: 'The Sun is a star. It gives us light and heat.' },
    ],
    tf: [{ prompt: 'The Sun is a planet.', truth: false, explain: 'The Sun is a star, not a planet.' }],
  },
  {
    id: 'space:moon',
    topic: 'space',
    group: 'other',
    tier: 1,
    card: { front: 'The Moon', frontPic: planet('moon'), back: 'The Moon goes around the Earth.' },
    asks: [
      { prompt: 'What goes around the Earth?', pic: planet('moon'), answer: { label: 'The Moon' }, pool: '', wrong: ['The Sun', 'Mars', 'A star'], explain: 'The Moon goes around the Earth.' },
    ],
    tf: [{ prompt: 'The Earth goes around the Sun.', truth: true, explain: 'Yes. The Earth goes around the Sun once a year.' }],
  },
  {
    id: 'space:eight',
    topic: 'space',
    group: 'other',
    tier: 1,
    card: { front: 'How many planets?', back: 'There are 8 planets in our solar system.' },
    asks: [{ prompt: 'How many planets are in our solar system?', answer: { label: '8' }, pool: '', wrong: ['7', '9', '10', '6'], explain: 'There are 8 planets in our solar system.', statement: (l) => `There are ${l} planets in our solar system.` }],
  },
  {
    id: 'space:gravity',
    topic: 'space',
    group: 'other',
    tier: 2,
    card: { front: 'Gravity', back: 'Gravity is the force that pulls things toward the Earth, so we stay on the ground.' },
    asks: [{ prompt: 'Which force keeps us on the ground?', answer: { label: 'Gravity' }, pool: '', wrong: ['Wind', 'Magnetism', 'Friction'], explain: 'Gravity pulls things toward the Earth, so we stay on the ground.' }],
  },
  {
    id: 'space:galaxy',
    topic: 'space',
    group: 'other',
    tier: 2,
    card: { front: 'The Milky Way', back: 'Our solar system is in a galaxy called the Milky Way.' },
    asks: [{ prompt: 'Our solar system is in a galaxy. What is it called?', answer: { label: 'The Milky Way' }, pool: '', wrong: ['The Big Dipper', 'The Rainbow', 'The Comet'], explain: 'Our solar system is in a galaxy called the Milky Way.' }],
  },
  {
    id: 'space:armstrong',
    topic: 'space',
    group: 'other',
    tier: 3,
    card: { front: 'First on the Moon', back: 'Neil Armstrong was the first person to walk on the Moon, in 1969.' },
    asks: [{ prompt: 'Who was the first person to walk on the Moon?', answer: { label: 'Neil Armstrong' }, pool: '', wrong: ['Yuri Gagarin', 'Buzz Aldrin', 'John Glenn'], explain: 'Neil Armstrong was the first person to walk on the Moon, in 1969.' }],
  },
  {
    id: 'space:gagarin',
    topic: 'space',
    group: 'other',
    tier: 3,
    card: { front: 'First in space', back: 'Yuri Gagarin was the first person in space, in 1961.' },
    asks: [{ prompt: 'Who was the first person to travel into space?', answer: { label: 'Yuri Gagarin' }, pool: '', wrong: ['Neil Armstrong', 'Buzz Aldrin', 'Alan Shepard'], explain: 'Yuri Gagarin was the first person in space, in 1961.' }],
  },
  {
    id: 'space:telescope',
    topic: 'space',
    group: 'other',
    tier: 2,
    card: { front: 'Telescope', back: 'A telescope helps us see things that are far away, like stars and planets.' },
    asks: [{ prompt: 'What do we use to look at faraway stars and planets?', answer: { label: 'A telescope' }, pool: '', wrong: ['A microscope', 'A magnet', 'A thermometer'], explain: 'A telescope helps us see things that are far away.' }],
  },
]

const SPACE_ORDERS: KOrderSet[] = [
  {
    id: 'planets-sun',
    topic: 'space',
    prompt: 'Tap the planets in order. Start with the one closest to the Sun.',
    items: PLANETS.map((p) => ({ id: p.id, label: p.name, pic: planet(p.id) })),
    pick: 4,
    explain: 'From the Sun: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune.',
  },
  {
    id: 'planets-size',
    topic: 'space',
    prompt: 'Tap the planets from the smallest to the biggest.',
    items: ['mercury', 'mars', 'venus', 'earth', 'neptune', 'uranus', 'saturn', 'jupiter'].map((id) => {
      const p = PLANETS.find((x) => x.id === id)!
      return { id: p.id, label: p.name, pic: planet(p.id) }
    }),
    pick: 4,
    explain: 'Smallest to biggest: Mercury, Mars, Venus, Earth, Neptune, Uranus, Saturn, Jupiter.',
  },
]

export const SPACE_TOPIC: KTopic = {
  id: 'space',
  title: 'Solar system',
  blurb: 'The Sun, the eight planets and space.',
  pic: planet('saturn'),
  pictures: true,
  facts: [...PLANETS.map(planetFact), ...SPACE_STATIC],
  orders: SPACE_ORDERS,
}

export { PLANET_LABELS }

// ---------------------------------------------------------------------------
// Dinosaurus

type Dino = { id: string; name: string; diet: 'Herbivore' | 'Carnivore'; feature: string; period: 'Triassic' | 'Jurassic' | 'Cretaceous'; fact: string; clue: string; clueShort: string }

const DINOS: readonly Dino[] = [
  { id: 'trex', name: 'Tyrannosaurus rex', diet: 'Carnivore', feature: 'tiny arms and a huge head', period: 'Cretaceous', fact: 'Tyrannosaurus rex was a huge meat eater with tiny arms. Its name means tyrant lizard king.', clue: 'Which dinosaur had a huge head, tiny arms and ate meat?', clueShort: 'had tiny arms and a huge head' },
  { id: 'triceratops', name: 'Triceratops', diet: 'Herbivore', feature: 'three horns on its face', period: 'Cretaceous', fact: 'Triceratops ate plants. It had three horns and a big frill on its head.', clue: 'Which dinosaur had three horns on its face?', clueShort: 'had three horns on its face' },
  { id: 'stegosaurus', name: 'Stegosaurus', diet: 'Herbivore', feature: 'plates on its back and spikes on its tail', period: 'Jurassic', fact: 'Stegosaurus ate plants. It had plates on its back and spikes on its tail.', clue: 'Which dinosaur had plates on its back and spikes on its tail?', clueShort: 'had plates on its back and spikes on its tail' },
  { id: 'velociraptor', name: 'Velociraptor', diet: 'Carnivore', feature: 'small, fast and feathered', period: 'Cretaceous', fact: 'Velociraptor was about the size of a turkey. It was fast and had feathers.', clue: 'Which dinosaur was small, fast and feathered?', clueShort: 'was small, fast and feathered' },
  { id: 'brachiosaurus', name: 'Brachiosaurus', diet: 'Herbivore', feature: 'a very long neck', period: 'Jurassic', fact: 'Brachiosaurus ate leaves from tall trees. It had a very long neck.', clue: 'Which dinosaur had a very long neck for reaching tall trees?', clueShort: 'had a very long neck for reaching tall trees' },
  { id: 'ankylosaurus', name: 'Ankylosaurus', diet: 'Herbivore', feature: 'armour and a club tail', period: 'Cretaceous', fact: 'Ankylosaurus was covered in armour and had a heavy club on its tail.', clue: 'Which dinosaur was covered in armour and had a club on its tail?', clueShort: 'was covered in armour and had a club on its tail' },
  { id: 'spinosaurus', name: 'Spinosaurus', diet: 'Carnivore', feature: 'a sail on its back', period: 'Cretaceous', fact: 'Spinosaurus had a big sail on its back. It hunted fish.', clue: 'Which dinosaur had a big sail on its back and ate fish?', clueShort: 'had a big sail on its back' },
  { id: 'diplodocus', name: 'Diplodocus', diet: 'Herbivore', feature: 'a long neck and a very long tail', period: 'Jurassic', fact: 'Diplodocus was very long, with a long neck and a whip-like tail.', clue: 'Which dinosaur was very long with a long neck and a whip-like tail?', clueShort: 'had a long neck and a whip-like tail' },
  { id: 'allosaurus', name: 'Allosaurus', diet: 'Carnivore', feature: 'sharp teeth and strong jaws', period: 'Jurassic', fact: 'Allosaurus was a big meat eater with sharp teeth. It lived before Tyrannosaurus rex.', clue: 'Which meat-eating dinosaur lived in the Jurassic, before Tyrannosaurus rex?', clueShort: 'was a big meat eater of the Jurassic' },
  { id: 'parasaurolophus', name: 'Parasaurolophus', diet: 'Herbivore', feature: 'a long hollow crest on its head', period: 'Cretaceous', fact: 'Parasaurolophus had a long hollow crest on its head. It ate plants.', clue: 'Which dinosaur had a long hollow crest on its head?', clueShort: 'had a long hollow crest on its head' },
]

const DINO_NAMES = DINOS.map((d) => d.name)

function dinoFact(d: Dino): KFact {
  return {
    id: `dino:${d.id}`,
    topic: 'dinosaurs',
    group: d.diet,
    tier: 1,
    card: { front: d.name, back: d.fact },
    asks: [
      { prompt: d.clue, answer: { label: d.name }, pool: 'dino', mode: 'any', statement: (l) => `${l} ${d.clueShort}.`, explain: d.fact },
    ],
    tf: [
      {
        prompt: `${d.name} ate ${d.diet === 'Herbivore' ? 'plants' : 'meat'}.`,
        truth: true,
        explain: d.diet === 'Herbivore' ? `Yes. ${d.name} was a herbivore. It ate plants.` : `Yes. ${d.name} was a carnivore. It ate meat.`,
      },
      {
        prompt: `${d.name} ate ${d.diet === 'Herbivore' ? 'meat' : 'plants'}.`,
        truth: false,
        explain: d.diet === 'Herbivore' ? `${d.name} was a herbivore. It ate plants, not meat.` : `${d.name} was a carnivore. It ate meat, not plants.`,
      },
    ],
  }
}

const DINO_STATIC: KFact[] = [
  {
    id: 'dino:not-dino',
    topic: 'dinosaurs',
    group: 'other',
    tier: 1,
    card: { front: 'Not a dinosaur', back: 'Pteranodon was a flying reptile, but it was not a dinosaur.' },
    asks: [{ prompt: 'Which of these was NOT a dinosaur?', answer: { label: 'Pteranodon' }, pool: '', wrong: without(DINO_NAMES, 'x').slice(0, 5), explain: 'Pteranodon was a flying reptile called a pterosaur. It was not a dinosaur.' }],
    tf: [{ prompt: 'Pteranodon was a dinosaur.', truth: false, explain: 'Pteranodon was a flying reptile called a pterosaur.' }],
  },
  {
    id: 'dino:extinct',
    topic: 'dinosaurs',
    group: 'other',
    tier: 1,
    card: { front: 'When did they die out?', back: 'The big dinosaurs died out about 66 million years ago.' },
    asks: [{ prompt: 'When did the big dinosaurs die out?', answer: { label: 'About 66 million years ago' }, pool: '', wrong: ['About 66 years ago', 'About 6,600 years ago', 'About 66 thousand years ago'], explain: 'The big dinosaurs died out about 66 million years ago.' }],
    tf: [{ prompt: 'People and big dinosaurs lived at the same time.', truth: false, explain: 'Big dinosaurs died out about 66 million years ago, long before people.' }],
  },
  {
    id: 'dino:fossil',
    topic: 'dinosaurs',
    group: 'other',
    tier: 1,
    card: { front: 'Fossil', frontPic: icon('fossil'), back: 'A fossil is what is left of a plant or animal from long ago, found in rock.' },
    asks: [{ prompt: 'What do we call the bones of a dinosaur that are found in rock?', pic: icon('fossil'), answer: { label: 'Fossils' }, pool: '', wrong: ['Crystals', 'Seeds', 'Shells'], explain: 'A fossil is what is left of a plant or animal from long ago, found in rock.' }],
  },
  {
    id: 'dino:palaeo',
    topic: 'dinosaurs',
    group: 'other',
    tier: 2,
    card: { front: 'Palaeontologist', back: 'A palaeontologist is a scientist who studies fossils.' },
    asks: [{ prompt: 'What do we call a scientist who studies fossils?', answer: { label: 'A palaeontologist' }, pool: '', wrong: ['An astronomer', 'A chemist', 'A biologist'], explain: 'A palaeontologist is a scientist who studies fossils.' }],
  },
  {
    id: 'dino:birds',
    topic: 'dinosaurs',
    group: 'other',
    tier: 2,
    card: { front: 'Dinosaurs today', back: 'Birds are the living relatives of the dinosaurs.' },
    asks: [{ prompt: 'Which animals today are the relatives of the dinosaurs?', answer: { label: 'Birds' }, pool: '', wrong: ['Frogs', 'Fish', 'Bats'], explain: 'Birds are the living relatives of the dinosaurs.' }],
    tf: [{ prompt: 'Birds are related to the dinosaurs.', truth: true, explain: 'Yes. Birds are the living relatives of the dinosaurs.' }],
  },
  {
    id: 'dino:eggs',
    topic: 'dinosaurs',
    group: 'other',
    tier: 2,
    card: { front: 'Dinosaur babies', back: 'Dinosaurs laid eggs, like birds do.' },
    asks: [{ prompt: 'How did dinosaurs start life?', answer: { label: 'They hatched from eggs' }, pool: '', wrong: ['They were born from seeds', 'They grew from tadpoles', 'They hatched from cocoons'], explain: 'Dinosaurs laid eggs, like birds do.' }],
  },
  {
    id: 'dino:biggest',
    topic: 'dinosaurs',
    group: 'other',
    tier: 3,
    card: { front: 'The longest dinosaurs', back: 'The longest dinosaurs, such as Diplodocus, ate plants.' },
    asks: [{ prompt: 'What did the longest dinosaurs, such as Diplodocus, eat?', answer: { label: 'Plants' }, pool: '', wrong: ['Meat', 'Fish'], options: 3, explain: 'The longest dinosaurs, such as Diplodocus, ate plants.' }],
  },
]

export const DINOSAURS_TOPIC: KTopic = {
  id: 'dinosaurs',
  title: 'Dinosaurs',
  blurb: 'Famous dinosaurs and how we know about them.',
  pic: icon('fossil'),
  pictures: false,
  facts: [...DINOS.map(dinoFact), ...DINO_STATIC],
  orders: [],
}
