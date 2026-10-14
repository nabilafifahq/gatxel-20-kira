/**
 * Pembuat soal Quiz Arena. Deterministik dari (seed, indeks, id fakta): server membuat ulang soal
 * untuk memeriksa jawaban, client hanya menerima `KClientQuestion` (tanpa kunci).
 * Pilihan jawaban selalu diacak dan pengecoh diambil dari kolam jawaban topik yang sama.
 */
import { createRng, type Rng } from '@kira/core/rng'
import { buildMapQuestion, isMapFactId } from './map'
import type { KAnswer, KAsk, KFact, KOption, KOrderSet, KQuestion, KTopic } from './types'

type PoolEntry = KOption & { group?: string }

const poolCache = new WeakMap<KTopic, Map<string, PoolEntry[]>>()

export function poolFor(topic: KTopic, key: string): PoolEntry[] {
  let byKey = poolCache.get(topic)
  if (!byKey) {
    byKey = new Map()
    poolCache.set(topic, byKey)
  }
  const cached = byKey.get(key)
  if (cached) return cached
  const seen = new Set<string>()
  const out: PoolEntry[] = []
  for (const f of topic.facts) {
    for (const a of f.asks) {
      if (a.pool !== key || seen.has(a.answer.label)) continue
      seen.add(a.answer.label)
      out.push({ label: a.answer.label, ...(a.answer.pic ? { pic: a.answer.pic } : {}), ...(a.group ? { group: a.group } : {}) })
    }
  }
  byKey.set(key, out)
  return out
}

/** Pilih pengecoh. Mengembalikan paling banyak `need` pilihan salah, tanpa label ganda. */
export function pickWrong(topic: KTopic, ask: KAsk, rng: Rng, need: number): KOption[] {
  const taken = new Set<string>([ask.answer.label, ...(ask.exclude ?? [])])
  const out: KOption[] = []
  const add = (o: KOption) => {
    if (out.length >= need || taken.has(o.label)) return
    taken.add(o.label)
    out.push(o)
  }
  for (const w of rng.shuffle(ask.wrong ?? [])) add({ label: w })
  const keys = ask.draw ?? (ask.pool ? [ask.pool] : [])
  if (out.length < need && keys.length) {
    const seenLabels = new Set<string>()
    const pool = keys.flatMap((k) => poolFor(topic, k)).filter((e) => (seenLabels.has(e.label) ? false : (seenLabels.add(e.label), true)))
    const mode = ask.mode ?? (ask.group ? 'near' : 'any')
    const same = rng.shuffle(pool.filter((e) => ask.group !== undefined && e.group === ask.group))
    const other = rng.shuffle(pool.filter((e) => ask.group === undefined || e.group !== ask.group))
    const ordered = mode === 'near' ? [...same.slice(0, 2), ...other, ...same.slice(2)] : mode === 'far' ? other : rng.shuffle([...same, ...other])
    for (const e of ordered) add({ label: e.label, ...(e.pic ? { pic: e.pic } : {}) })
    // Kolam kecil: lepas aturan jauh/dekat, tetap menghormati exclude.
    if (out.length < need) for (const e of rng.shuffle(pool)) add({ label: e.label, ...(e.pic ? { pic: e.pic } : {}) })
  }
  return out
}

function buildMc(topic: KTopic, fact: KFact, ask: KAsk, rng: Rng): KQuestion {
  const total = ask.options ?? 4
  const wrongs = pickWrong(topic, ask, rng, total - 1)
  if (wrongs.length < 2) throw new Error(`Soal ${fact.id} "${ask.prompt}" kekurangan pengecoh (${wrongs.length})`)
  const options = rng.shuffle<KOption>([ask.answer, ...wrongs])
  const correct = options.findIndex((o) => o.label === ask.answer.label)
  return {
    client: { kind: 'mc', factId: fact.id, prompt: ask.prompt, ...(ask.pic ? { pic: ask.pic } : {}), style: ask.style ?? 'text', options },
    key: { kind: 'mc', correct, explain: ask.explain ?? `The answer is ${ask.answer.label}.`, factId: fact.id, answerLabel: ask.answer.label },
  }
}

function buildAutoTf(topic: KTopic, fact: KFact, ask: KAsk, rng: Rng): KQuestion {
  const truth = rng.chance(0.5)
  const wrong = pickWrong(topic, ask, rng, 1)[0]
  const useTrue = truth || !wrong
  const label = useTrue ? ask.answer.label : wrong!.label
  const right = ask.statement!(ask.answer.label)
  return {
    client: { kind: 'tf', factId: fact.id, prompt: ask.statement!(label), ...(ask.pic ? { pic: ask.pic } : {}) },
    key: { kind: 'tf', correct: useTrue, explain: useTrue ? `Yes. ${right}` : `Not quite. ${right}`, factId: fact.id, answerLabel: useTrue ? 'True' : 'False' },
  }
}

type Choice = { weight: number; build: (rng: Rng) => KQuestion }

export function buildFactQuestion(topic: KTopic, fact: KFact, rng: Rng): KQuestion {
  const choices: Choice[] = []
  for (const ask of fact.asks) {
    choices.push({ weight: 3, build: (r) => buildMc(topic, fact, ask, r) })
    if (ask.statement) choices.push({ weight: 1, build: (r) => buildAutoTf(topic, fact, ask, r) })
  }
  for (const tf of fact.tf ?? []) {
    choices.push({
      weight: 1,
      build: () => ({
        client: { kind: 'tf', factId: fact.id, prompt: tf.prompt, ...(tf.pic ? { pic: tf.pic } : {}) },
        key: { kind: 'tf', correct: tf.truth, explain: tf.explain, factId: fact.id, answerLabel: tf.truth ? 'True' : 'False' },
      }),
    })
  }
  if (choices.length === 0) throw new Error(`Fakta ${fact.id} tidak punya soal`)
  const total = choices.reduce((n, c) => n + c.weight, 0)
  let roll = rng.next() * total
  for (const c of choices) {
    roll -= c.weight
    if (roll < 0) return c.build(rng)
  }
  return choices[choices.length - 1]!.build(rng)
}

export function buildOrderQuestion(set: KOrderSet, rng: Rng): KQuestion {
  const idx = rng
    .sample(
      set.items.map((_, i) => i),
      Math.min(set.pick, set.items.length),
    )
    .sort((a, b) => a - b)
  const correct = idx.map((i) => set.items[i]!)
  let shown = rng.shuffle(correct)
  for (let tries = 0; tries < 8 && shown.every((it, i) => it.id === correct[i]!.id); tries++) shown = rng.shuffle(correct)
  return {
    client: { kind: 'order', factId: `order:${set.id}`, prompt: set.prompt, items: shown },
    key: { kind: 'order', correct: correct.map((c) => c.id), explain: set.explain, factId: `order:${set.id}`, answerLabel: correct.map((c) => c.label).join(', ') },
  }
}

export function isOrderId(factId: string): boolean {
  return factId.startsWith('order:')
}

/** Soal ke-`index` dari ronde; `factId` berasal dari rencana ronde yang disimpan di config. */
export function questionFor(topic: KTopic, factId: string, seed: string, index: number): KQuestion {
  if (isMapFactId(factId)) return buildMapQuestion(factId)
  const rng = createRng(`${seed}#k${index}:${factId}`)
  if (isOrderId(factId)) {
    const set = topic.orders.find((o) => `order:${o.id}` === factId)
    if (!set) throw new Error(`Urutan ${factId} tidak ada di topik ${topic.id}`)
    return buildOrderQuestion(set, rng)
  }
  const fact = topic.facts.find((f) => f.id === factId)
  if (!fact) throw new Error(`Fakta ${factId} tidak ada di topik ${topic.id}`)
  return buildFactQuestion(topic, fact, rng)
}

/** Apakah jawaban benar? Jenis jawaban yang tidak cocok dengan kunci dianggap salah. */
export function isCorrectAnswer(key: KQuestion['key'], answer: KAnswer | null): boolean {
  if (answer === null) return false
  switch (key.kind) {
    case 'mc':
      return typeof answer === 'number' && answer === key.correct
    case 'tf':
      return typeof answer === 'boolean' && answer === key.correct
    case 'map':
      return typeof answer === 'string' && answer === key.correct
    case 'order':
      return Array.isArray(answer) && answer.length === key.correct.length && answer.every((id, i) => id === key.correct[i])
  }
}
