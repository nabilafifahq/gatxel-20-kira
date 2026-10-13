/**
 * Kemajuan Quiz Arena per topik dan angka untuk lencana arena.
 */
import type { ArenaBadgeStats } from '@kira/core'
import { topicById, TOPICS } from './topics'
import { isKnown, type KnowMap, type TopicId } from './types'

export type TopicProgress = { known: number; total: number; seen: number }

export function topicProgress(topic: TopicId, know: KnowMap): TopicProgress {
  const facts = topicById(topic).facts
  return { known: facts.filter((f) => isKnown(know[f.id])).length, total: facts.length, seen: facts.filter((f) => (know[f.id]?.n ?? 0) > 0).length }
}

export type KnowledgeCounts = Pick<
  ArenaBadgeStats,
  | 'quizAsiaFlagsKnown'
  | 'quizAsiaFlagsTotal'
  | 'quizFlagsKnown'
  | 'quizFlagsTotal'
  | 'quizProvincesKnown'
  | 'quizProvincesTotal'
  | 'quizPlanetsKnown'
  | 'quizPlanetsTotal'
  | 'quizCapitalsKnown'
  | 'quizTopicsTotal'
>

const PLANET_IDS = new Set(['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'].map((p) => `space:${p}`))

export function knowledgeCounts(know: KnowMap): KnowledgeCounts {
  const flags = topicById('flags').facts
  const asia = flags.filter((f) => f.group === 'Asia')
  const provinces = topicById('provinces').facts
  const planets = topicById('space').facts.filter((f) => PLANET_IDS.has(f.id))
  const known = (list: { id: string }[]) => list.filter((f) => isKnown(know[f.id])).length
  return {
    quizAsiaFlagsKnown: known(asia),
    quizAsiaFlagsTotal: asia.length,
    quizFlagsKnown: known(flags),
    quizFlagsTotal: flags.length,
    quizProvincesKnown: known(provinces),
    quizProvincesTotal: provinces.length,
    quizPlanetsKnown: known(planets),
    quizPlanetsTotal: planets.length,
    quizCapitalsKnown: known(topicById('capitals').facts),
    quizTopicsTotal: TOPICS.length,
  }
}

/** Topik yang pernah dimainkan: ada paling sedikit satu fakta yang pernah dijawab. */
export function topicsTried(know: KnowMap): number {
  return TOPICS.filter((t) => t.facts.some((f) => (know[f.id]?.n ?? 0) > 0)).length
}
