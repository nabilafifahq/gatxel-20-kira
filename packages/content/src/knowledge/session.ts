/**
 * Rencana ronde Quiz Arena: fakta mana yang ditanyakan. Dipilih acak dengan bobot, jadi fakta yang belum
 * dikenal dan yang baru salah lebih sering muncul. Rencana disimpan di config ronde, sehingga soal bisa
 * dibuat ulang persis di server walau catatan kemajuan sudah berubah.
 */
import { createRng, type Rng } from '@kira/core/rng'
import { questionFor } from './generate'
import { topicById, TOPICS, topicOfFact } from './topics'
import { isKnown, KROUND, TOPIC_IDS, type KnowMap, type KQuestion, type KRoundMode, type KTopic, type TopicId } from './types'

/** Topik besar membuka soal bertahap menurut tingkat (1 paling dikenal). */
const GATED_MIN_FACTS = 60
const OPEN_NEXT_TIER_AT = 0.6

export type RoundTopic = TopicId | 'mix'

export function isRoundTopic(value: unknown): value is RoundTopic {
  return value === 'mix' || (typeof value === 'string' && (TOPIC_IDS as readonly string[]).includes(value))
}

/** Tingkat tertinggi yang sudah terbuka untuk satu topik. */
export function openTier(topic: KTopic, know: KnowMap): 1 | 2 | 3 {
  if (topic.facts.length < GATED_MIN_FACTS) return 3
  for (const tier of [1, 2] as const) {
    const facts = topic.facts.filter((f) => f.tier === tier)
    if (facts.length === 0) continue
    const known = facts.filter((f) => isKnown(know[f.id])).length
    if (known / facts.length < OPEN_NEXT_TIER_AT) return tier
  }
  return 3
}

function weightOf(know: KnowMap, factId: string, learn: boolean): number {
  const e = know[factId]
  if (!e) return 3
  if (isKnown(e)) return learn ? 0.2 : 1
  return e.last === 0 && e.n > 0 ? 4 : 3
}

function sampleWeighted<T>(rng: Rng, items: readonly T[], weight: (t: T) => number, n: number): T[] {
  const pool = items.map((item) => ({ item, w: Math.max(0.0001, weight(item)) }))
  const out: T[] = []
  while (out.length < n && pool.length > 0) {
    const total = pool.reduce((a, b) => a + b.w, 0)
    let roll = rng.next() * total
    let idx = pool.length - 1
    for (let i = 0; i < pool.length; i++) {
      roll -= pool[i]!.w
      if (roll < 0) {
        idx = i
        break
      }
    }
    out.push(pool[idx]!.item)
    pool.splice(idx, 1)
  }
  return out
}

function eligibleFacts(topic: KTopic, know: KnowMap): string[] {
  const tier = openTier(topic, know)
  return topic.facts.filter((f) => f.tier <= tier || isKnown(know[f.id])).map((f) => f.id)
}

/** Tanda soal yang dilihat anak, tanpa urutan pilihan: dua soal dengan tanda sama dianggap soal yang sama. */
export function questionSignature(q: KQuestion): string {
  const c = q.client as Record<string, unknown>
  const opts = Array.isArray(c.options) ? (c.options as unknown[]).map((o) => JSON.stringify(o && typeof o === 'object' ? { ...(o as object), i: undefined, id: undefined } : o)).sort() : undefined
  const items = Array.isArray(c.items) ? (c.items as { label?: string; id?: string }[]).map((x) => x.label ?? x.id ?? '').sort() : undefined
  return JSON.stringify([c.kind, c.prompt, c.pic ?? null, opts ?? null, items ?? null])
}

/**
 * Satu ronde tidak boleh menanyakan hal yang sama dua kali: fakta yang berulang atau dua fakta yang menghasilkan soal
 * sama diganti fakta lain dari `pool` yang soalnya belum ada. Bila pool habis, ronde menjadi lebih pendek.
 */
export function dedupePlan(plan: readonly string[], seed: string, pool: readonly string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const unusedPool = pool.filter((id) => !plan.includes(id))
  const sigOf = (id: string, index: number): string | null => {
    try {
      const q = roundQuestion([...out, id], seed, index)
      return questionSignature(q)
    } catch {
      return null
    }
  }
  for (const id of plan) {
    let pick: string | null = null
    const sig = sigOf(id, out.length)
    const afterOrder = id.startsWith('order:') && (out[out.length - 1]?.startsWith('order:') ?? false)
    if (sig && !seen.has(sig) && !afterOrder) {
      pick = id
      seen.add(sig)
    } else {
      while (unusedPool.length > 0) {
        const cand = unusedPool.shift()!
        const cs = sigOf(cand, out.length)
        if (cs && !seen.has(cs)) {
          pick = cand
          seen.add(cs)
          break
        }
      }
    }
    if (pick) out.push(pick)
  }
  return out
}

/** Daftar id fakta (atau `order:...`) untuk satu ronde. */
export function planRound(input: { topic: RoundTopic; mode: KRoundMode; seed: string; know: KnowMap }): string[] {
  const rng = createRng(`${input.seed}#plan`)
  const count = KROUND[input.mode].count
  const learn = input.mode === 'learn'
  const plan: string[] = []
  const used = new Set<string>()

  if (input.topic === 'mix') {
    const topics = TOPICS.filter((t) => t.facts.length > 0)
    let guard = 0
    while (plan.length < count && guard++ < count * 20) {
      const t = rng.pick(topics)
      const ids = eligibleFacts(t, input.know).filter((id) => !used.has(id))
      if (ids.length === 0) continue
      const pick = sampleWeighted(rng, ids, (id) => weightOf(input.know, id, learn), 1)[0]!
      used.add(pick)
      plan.push(pick)
    }
    return dedupePlan(plan, input.seed, TOPICS.flatMap((t) => eligibleFacts(t, input.know)))
  }

  const topic = topicById(input.topic)
  const ids = eligibleFacts(topic, input.know)
  while (plan.length < count && ids.length > 0) {
    const batch = sampleWeighted(rng, ids, (id) => weightOf(input.know, id, learn), Math.min(count - plan.length, ids.length))
    plan.push(...batch)
  }
  // Sisipkan soal urutan di topik yang punya, kira-kira satu dari delapan soal, tidak berturut-turut.
  if (!learn && topic.orders.length > 0) {
    let last = -2
    for (let i = 1; i < plan.length; i++) {
      if (i - last > 1 && rng.chance(0.12)) {
        plan[i] = `order:${rng.pick(topic.orders).id}`
        last = i
      }
    }
  }
  return dedupePlan(plan, input.seed, ids)
}

/** Soal ke-`index` dari rencana ronde. */
export function roundQuestion(plan: readonly string[], seed: string, index: number): KQuestion {
  const factId = plan[index]
  if (factId === undefined) throw new Error(`Soal ke-${index} tidak ada dalam rencana`)
  const topicId = topicOfFact(factId)
  if (!topicId) throw new Error(`Fakta tidak dikenal: ${factId}`)
  return questionFor(topicById(topicId), factId, seed, index)
}

export type LearnCard = { factId: string; front: string; back: string; frontPic?: import('./types').Pic; backPic?: import('./types').Pic }

/** Tumpukan kartu belajar: yang belum dikenal lebih dulu. */
export function planLearn(input: { topic: TopicId; seed: string; know: KnowMap }): LearnCard[] {
  const ids = planRound({ topic: input.topic, mode: 'learn', seed: input.seed, know: input.know })
  const topic = topicById(input.topic)
  return ids
    .map((id) => topic.facts.find((f) => f.id === id))
    .filter((f): f is NonNullable<typeof f> => f !== undefined)
    .map((f) => ({ factId: f.id, front: f.card.front, back: f.card.back, ...(f.card.frontPic ? { frontPic: f.card.frontPic } : {}), ...(f.card.backPic ? { backPic: f.card.backPic } : {}) }))
}

/** Catat satu jawaban pada peta kemajuan. Hanya pilihan ganda yang menaikkan hitungan benar. */
export function recordKnow(know: KnowMap, factId: string, correct: boolean, countsAsKnown: boolean): KnowMap {
  if (factId.startsWith('order:') || factId.startsWith('map:')) return know
  const prev = know[factId] ?? { n: 0, r: 0, last: 0 as 0 | 1 }
  return { ...know, [factId]: { n: prev.n + 1, r: prev.r + (correct && countsAsKnown ? 1 : 0), last: correct ? 1 : 0 } }
}
