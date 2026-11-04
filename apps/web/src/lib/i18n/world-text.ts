import { bossById, cardById } from '@kira/core'
import type { Dict } from './index'
import { itemName, setName, topicName } from './dict/world'

/** Syarat kartu dalam bahasa tampilan. Kartu yang tidak dikenal memakai teks sumber dari server. */
export function cardHintOf(t: Dict, cardId: string, source: string): string {
  const r = cardById(cardId)?.req
  if (!r) return source
  const a = t.world.album
  switch (r.kind) {
    case 'quiz':
      return a.hint.quiz(r.pct, topicName(t.world, r.topic))
    case 'mastered':
      return a.hint.mastered(r.count, a.masterySubject[r.subject])
    case 'boss':
      return a.hint.boss(bossById(r.boss)?.name ?? a.hint.thisBoss)
    case 'story':
      return a.hint.story(r.chapter)
    case 'book':
      return a.hint.book(r.count)
    case 'streak':
      return a.hint.streak(r.days)
    case 'sessions':
      return a.hint.sessions(r.count)
    case 'stars':
      return a.hint.stars(r.count)
  }
}

/** Nama, keterangan, dan hadiah satu set kartu dalam bahasa tampilan. Set baru memakai teks sumbernya. */
export function setTextOf<T extends { id: string; name: string; blurb: string; earnedBy: string; reward: string }>(t: Dict, set: T, rewardId?: string): { name: string; blurb: string; earnedBy: string; reward: string } {
  const info = (t.world.setInfo as Record<string, { blurb: string; earnedBy: string } | undefined>)[set.id]
  return {
    name: setName(t.world, set.id, set.name),
    blurb: info?.blurb ?? set.blurb,
    earnedBy: info?.earnedBy ?? set.earnedBy,
    reward: rewardId ? itemName(t.world, rewardId, set.reward) : set.reward,
  }
}
