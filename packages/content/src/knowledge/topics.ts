import { CAPITALS_TOPIC, CONTINENTS_TOPIC, FLAGS_TOPIC, PROVINCES_TOPIC } from './data/geography'
import { INSTRUMENTS_TOPIC, INVENTORS_TOPIC, LANDMARKS_TOPIC } from './data/culture'
import { ANIMALS_TOPIC, BODY_TOPIC, DINOSAURS_TOPIC, SPACE_TOPIC } from './data/nature'
import { WORDS_TOPIC } from './data/words'
import { TOPIC_IDS, type KFact, type KTopic, type TopicId } from './types'

/** Urutan tampil di layar. */
export const TOPICS: readonly KTopic[] = [
  FLAGS_TOPIC,
  CAPITALS_TOPIC,
  PROVINCES_TOPIC,
  CONTINENTS_TOPIC,
  ANIMALS_TOPIC,
  BODY_TOPIC,
  SPACE_TOPIC,
  INVENTORS_TOPIC,
  LANDMARKS_TOPIC,
  INSTRUMENTS_TOPIC,
  DINOSAURS_TOPIC,
  WORDS_TOPIC,
]

const BY_ID = new Map<TopicId, KTopic>(TOPICS.map((t) => [t.id, t]))

export function isTopicId(value: unknown): value is TopicId {
  return typeof value === 'string' && (TOPIC_IDS as readonly string[]).includes(value)
}

export function topicById(id: TopicId): KTopic {
  const t = BY_ID.get(id)
  if (!t) throw new Error(`Topik tidak dikenal: ${id}`)
  return t
}

const FACT_TOPIC = new Map<string, TopicId>()
for (const t of TOPICS) {
  for (const f of t.facts) FACT_TOPIC.set(f.id, t.id)
  for (const o of t.orders) FACT_TOPIC.set(`order:${o.id}`, t.id)
}

export function topicOfFact(factId: string): TopicId | undefined {
  return FACT_TOPIC.get(factId)
}

const FACT_BY_ID = new Map<string, KFact>(TOPICS.flatMap((t) => t.facts.map((f) => [f.id, f] as const)))

export function factById(id: string): KFact | undefined {
  return FACT_BY_ID.get(id)
}

export function totalFacts(): number {
  return FACT_BY_ID.size
}
