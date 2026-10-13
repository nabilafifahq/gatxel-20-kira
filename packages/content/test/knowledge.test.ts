/// <reference types="node" />
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  COUNTRIES,
  KNOWN_AFTER_RIGHT,
  KROUND,
  LOOKALIKES,
  PROVINCES,
  TOPICS,
  TOPIC_IDS,
  factById,
  isCorrectAnswer,
  isKnown,
  knowledgeCounts,
  openTier,
  planLearn,
  planRound,
  questionFor,
  recordKnow,
  roundQuestion,
  topicById,
  topicOfFact,
  topicProgress,
  topicsTried,
  totalFacts,
  type KClientQuestion,
  type KnowMap,
  type Pic,
} from '../src/knowledge'
import { ICON_NAMES } from '@kira/figures/spec'
import { PLANET_NAMES } from '../src/knowledge/types'

const FLAGS_DIR = fileURLToPath(new URL('../../../apps/web/public/flags/4x3/', import.meta.url))
const SEEDS = Array.from({ length: 12 }, (_, i) => `ks-${i}`)

function pics(q: KClientQuestion): Pic[] {
  const out: Pic[] = []
  if ('pic' in q && q.pic) out.push(q.pic)
  if (q.kind === 'mc') for (const o of q.options) if (o.pic) out.push(o.pic)
  if (q.kind === 'order') for (const i of q.items) if (i.pic) out.push(i.pic)
  return out
}

describe('Quiz Arena: data', () => {
  it('ada 12 topik dengan id sesuai daftar dan semuanya punya fakta', () => {
    expect(TOPICS.map((t) => t.id)).toEqual([...TOPIC_IDS])
    for (const t of TOPICS) expect(t.facts.length, t.id).toBeGreaterThanOrEqual(15)
  })

  it('id fakta unik di seluruh topik dan cocok dengan topiknya', () => {
    const seen = new Set<string>()
    for (const t of TOPICS) {
      for (const f of t.facts) {
        expect(seen.has(f.id), `ganda: ${f.id}`).toBe(false)
        seen.add(f.id)
        expect(f.topic).toBe(t.id)
        expect(topicOfFact(f.id)).toBe(t.id)
        expect(factById(f.id)).toBe(f)
      }
      for (const o of t.orders) expect(o.items.length).toBeGreaterThanOrEqual(o.pick)
    }
    expect(totalFacts()).toBe(seen.size)
  })

  it('jumlah fakta sesuai: 192 negara, 38 provinsi, 8 planet', () => {
    expect(COUNTRIES.length).toBe(192)
    expect(new Set(COUNTRIES.map((c) => c.iso)).size).toBe(192)
    expect(new Set(COUNTRIES.map((c) => c.name)).size).toBe(192)
    expect(PROVINCES).toHaveLength(38)
    expect(new Set(PROVINCES.map((p) => p.name)).size).toBe(38)
    expect(topicById('provinces').facts).toHaveLength(38)
    expect(topicById('flags').facts).toHaveLength(192)
    expect(COUNTRIES.filter((c) => c.continent === 'Asia')).toHaveLength(45)
    expect(topicById('space').facts.filter((f) => f.group === 'planets')).toHaveLength(8)
  })

  it('setiap negara punya berkas bendera SVG di apps/web/public/flags/4x3', () => {
    const missing = COUNTRIES.filter((c) => !existsSync(`${FLAGS_DIR}${c.iso}.svg`)).map((c) => c.iso)
    expect(missing).toEqual([])
    expect(existsSync(`${FLAGS_DIR}../LICENSE`)).toBe(true)
  })

  it('ibu kota: negara dengan ibu kota ambigu dikecualikan', () => {
    const caps = COUNTRIES.filter((c) => c.capital !== null)
    expect(topicById('capitals').facts).toHaveLength(caps.length)
    expect(caps.length).toBeGreaterThanOrEqual(180)
    const noCapital = COUNTRIES.filter((c) => c.capital === null).map((c) => c.iso)
    expect(noCapital).toEqual(expect.arrayContaining(['za', 'bo', 'lk']))
  })

  it('beberapa fakta penting benar (cek tangan)', () => {
    const cap = (iso: string) => COUNTRIES.find((c) => c.iso === iso)?.capital
    expect(cap('id')).toBe('Jakarta')
    expect(cap('au')).toBe('Canberra')
    expect(cap('tr')).toBe('Ankara')
    expect(cap('ca')).toBe('Ottawa')
    expect(cap('br')).toBe('Brasilia')
    expect(cap('mm')).toBe('Naypyidaw')
    expect(cap('kz')).toBe('Astana')
    expect(cap('ch')).toBe('Bern')
    expect(cap('nz')).toBe('Wellington')
    expect(PROVINCES.find((p) => p.name === 'Kalimantan Timur')?.capital).toBe('Samarinda')
    expect(PROVINCES.find((p) => p.name === 'Papua Pegunungan')?.capital).toBe('Wamena')
    expect(PROVINCES.find((p) => p.name === 'Sulawesi Selatan')?.capital).toBe('Makassar')
  })

  it('pertanyaan dengan dua jawaban benar dihindari: negara dua benua dan tulang lawan kerangka', () => {
    const ids = topicById('continents').facts.map((f) => f.id)
    for (const iso of ['ru', 'tr', 'eg']) expect(ids).not.toContain(`cont:in-${iso}`)
    expect(ids).toContain('cont:in-id')
    for (const seed of SEEDS) {
      for (let i = 0; i < 6; i++) {
        const q = questionFor(topicById('body'), 'body:bone', seed, i)
        if (q.client.kind === 'mc' && q.client.prompt.includes('do the bones do')) expect(q.client.options.map((o) => o.label)).not.toContain('It holds the body up and protects the organs.')
      }
    }
  })

  it('gambar yang dipakai soal ada: ikon valid, planet valid, bendera ada', () => {
    const icons = new Set<string>(ICON_NAMES)
    const planets = new Set<string>(PLANET_NAMES)
    const bad: string[] = []
    const check = (p: Pic | undefined, where: string) => {
      if (!p) return
      if (p.t === 'icon' && !icons.has(p.name)) bad.push(`${where}: ikon ${p.name}`)
      if (p.t === 'planet' && !planets.has(p.name)) bad.push(`${where}: planet ${p.name}`)
      if (p.t === 'flag' && !existsSync(`${FLAGS_DIR}${p.code}.svg`)) bad.push(`${where}: bendera ${p.code}`)
    }
    for (const t of TOPICS) {
      check(t.pic, t.id)
      for (const f of t.facts) {
        check(f.card.frontPic, f.id)
        check(f.card.backPic, f.id)
        for (const a of f.asks) {
          check(a.pic, f.id)
          check(a.answer.pic, f.id)
        }
        for (const x of f.tf ?? []) check(x.pic, f.id)
      }
      for (const o of t.orders) for (const i of o.items) check(i.pic, o.id)
    }
    expect(bad).toEqual([])
  })

  it('teks tidak memuat tanda pisah, emoji, atau kata terlarang', () => {
    const banned = /[–—]|unlock|navigate|landscape|leverage|seamless|delve/i
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u
    const texts: string[] = []
    for (const t of TOPICS) {
      texts.push(t.title, t.blurb)
      for (const f of t.facts) {
        texts.push(f.card.front, f.card.back)
        for (const a of f.asks) texts.push(a.prompt, a.answer.label, a.explain ?? '', ...(a.wrong ?? []))
        for (const x of f.tf ?? []) texts.push(x.prompt, x.explain)
      }
      for (const o of t.orders) texts.push(o.prompt, o.explain, ...o.items.map((i) => i.label))
    }
    const bad = texts.filter((x) => banned.test(x) || emoji.test(x))
    expect(bad).toEqual([])
  })
})

describe('Quiz Arena: soal', () => {
  it('setiap fakta menghasilkan soal valid untuk banyak seed: satu jawaban benar, pilihan unik, 3 sampai 4 pilihan', () => {
    const problems: string[] = []
    let count = 0
    for (const t of TOPICS) {
      for (const f of t.facts) {
        for (const seed of SEEDS) {
          let q
          try {
            q = questionFor(t, f.id, seed, 0)
          } catch (e) {
            problems.push(`${f.id} ${seed}: ${(e as Error).message}`)
            continue
          }
          count++
          const c = q.client
          if (c.kind === 'mc') {
            const labels = c.options.map((o) => o.label)
            if (new Set(labels).size !== labels.length) problems.push(`${f.id}: pilihan ganda ${labels.join('|')}`)
            if (c.options.length < 3 || c.options.length > 4) problems.push(`${f.id}: ${c.options.length} pilihan`)
            if (q.key.kind !== 'mc' || q.key.correct < 0 || q.key.correct >= c.options.length) problems.push(`${f.id}: kunci salah`)
            else if (c.options[q.key.correct]!.label !== q.key.answerLabel) problems.push(`${f.id}: kunci tidak cocok dengan label`)
            if (c.prompt.trim().length < 5) problems.push(`${f.id}: prompt kosong`)
          } else if (c.kind === 'tf') {
            if (q.key.kind !== 'tf') problems.push(`${f.id}: kunci tf`)
          }
        }
      }
    }
    expect(count).toBeGreaterThan(3000)
    expect(problems.slice(0, 20)).toEqual([])
  })

  it('soal sama untuk seed dan indeks yang sama, dan berbeda antar indeks', () => {
    const t = topicById('capitals')
    const f = t.facts[0]!
    expect(questionFor(t, f.id, 'x', 3)).toEqual(questionFor(t, f.id, 'x', 3))
    const variants = new Set<string>()
    for (let i = 0; i < 20; i++) variants.add(JSON.stringify(questionFor(t, f.id, 'x', i).client))
    expect(variants.size).toBeGreaterThan(3)
  })

  it('urutan pilihan diacak: jawaban benar muncul di keempat posisi', () => {
    const t = topicById('flags')
    const positions = new Set<number>()
    for (let i = 0; i < 80; i++) {
      const q = questionFor(t, 'flag:id', 'shuffle', i)
      if (q.key.kind === 'mc') positions.add(q.key.correct)
    }
    expect(positions.size).toBe(4)
  })

  it('soal untuk client tidak membocorkan jawaban', () => {
    const q = questionFor(topicById('capitals'), 'cap:fr', 's', 0)
    expect(JSON.stringify(q.client)).not.toContain('"correct"')
    expect(Object.keys(q.client)).not.toContain('key')
  })

  it('bendera yang mirip tidak muncul bersama dalam satu soal', () => {
    const t = topicById('flags')
    const nameOf = new Map(COUNTRIES.map((c) => [c.iso, c.name] as const))
    for (const group of LOOKALIKES) {
      for (const iso of group) {
        const others = new Set(group.filter((g) => g !== iso).map((g) => nameOf.get(g)!))
        for (const seed of SEEDS) {
          for (let i = 0; i < 6; i++) {
            const q = questionFor(t, `flag:${iso}`, seed, i).client
            if (q.kind === 'mc') for (const o of q.options) expect(others.has(o.label), `${iso} dengan ${o.label}`).toBe(false)
          }
        }
      }
    }
  })

  it('pilihan salah soal ibu kota lebih sering berasal dari benua yang sama', () => {
    const t = topicById('capitals')
    const contOf = new Map(COUNTRIES.map((c) => [c.capital, c.continent] as const))
    let same = 0
    let total = 0
    for (const f of t.facts.slice(0, 60)) {
      for (let i = 0; i < 4; i++) {
        const q = questionFor(t, f.id, 'near', i)
        if (q.client.kind !== 'mc' || !q.client.prompt.startsWith('What is the capital')) continue
        const cont = contOf.get(q.key.answerLabel)
        for (const o of q.client.options) {
          if (o.label === q.key.answerLabel) continue
          total++
          if (contOf.get(o.label) === cont) same++
        }
      }
    }
    expect(same / total).toBeGreaterThan(0.4)
  })

  it('soal "Which flag" memakai bendera di setiap pilihan', () => {
    let found = 0
    for (let i = 0; i < 40; i++) {
      const c = questionFor(topicById('flags'), 'flag:jp', 'pics', i).client
      if (c.kind === 'mc' && c.style === 'pics') {
        found++
        for (const o of c.options) expect(o.pic?.t).toBe('flag')
      }
    }
    expect(found).toBeGreaterThan(5)
  })

  it('jenis benar atau salah: kunci cocok dengan pernyataan', () => {
    const t = topicById('capitals')
    let trues = 0
    let falses = 0
    for (let i = 0; i < 200; i++) {
      const q = questionFor(t, 'cap:fr', 'tf', i)
      if (q.client.kind !== 'tf' || q.key.kind !== 'tf') continue
      expect(q.key.correct).toBe(q.client.prompt.includes('Paris'))
      if (q.key.correct) trues++
      else falses++
    }
    expect(trues).toBeGreaterThan(5)
    expect(falses).toBeGreaterThan(5)
  })

  it('soal urutan: kunci memuat urutan yang benar dan tampilan diacak', () => {
    const t = topicById('space')
    const q = questionFor(t, 'order:planets-sun', 'ord', 0)
    expect(q.client.kind).toBe('order')
    if (q.client.kind !== 'order' || q.key.kind !== 'order') return
    expect(q.client.items).toHaveLength(4)
    const order = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']
    expect(q.key.correct).toEqual([...q.key.correct].sort((a, b) => order.indexOf(a) - order.indexOf(b)))
    expect(q.client.items.map((i) => i.id)).not.toEqual(q.key.correct)
    expect(isCorrectAnswer(q.key, q.key.correct)).toBe(true)
    expect(isCorrectAnswer(q.key, [...q.key.correct].reverse())).toBe(false)
  })

  it('isCorrectAnswer: jenis jawaban yang tidak cocok dianggap salah', () => {
    const q = questionFor(topicById('capitals'), 'cap:fr', 'a', 0)
    if (q.key.kind === 'mc') {
      expect(isCorrectAnswer(q.key, q.key.correct)).toBe(true)
      expect(isCorrectAnswer(q.key, (q.key.correct + 1) % 4)).toBe(false)
      expect(isCorrectAnswer(q.key, true)).toBe(false)
      expect(isCorrectAnswer(q.key, null)).toBe(false)
      expect(isCorrectAnswer(q.key, ['x'])).toBe(false)
    }
  })

  it('topik bergambar benar-benar memakai gambar di soalnya', () => {
    for (const t of TOPICS.filter((x) => x.pictures)) {
      let withPic = 0
      for (const f of t.facts) {
        for (let i = 0; i < 6; i++) {
          if (pics(questionFor(t, f.id, 'pic-seed', i).client).length) withPic++
        }
      }
      expect(withPic, t.id).toBeGreaterThan(10)
    }
  })
})

describe('Quiz Arena: rencana ronde', () => {
  const empty: KnowMap = {}

  it('rencana deterministik untuk seed yang sama dan berukuran sesuai mode', () => {
    for (const mode of ['learn', 'quiz', 'speed'] as const) {
      const a = planRound({ topic: 'flags', mode, seed: 'p1', know: empty })
      const b = planRound({ topic: 'flags', mode, seed: 'p1', know: empty })
      expect(a).toEqual(b)
      expect(a).toHaveLength(KROUND[mode].count)
    }
    expect(planRound({ topic: 'flags', mode: 'quiz', seed: 'p1', know: empty })).not.toEqual(planRound({ topic: 'flags', mode: 'quiz', seed: 'p2', know: empty }))
  })

  it('tanpa pengulangan fakta dalam satu ronde kuis bila faktanya cukup', () => {
    for (const topic of TOPIC_IDS) {
      const plan = planRound({ topic, mode: 'quiz', seed: 'u', know: empty }).filter((id) => !id.startsWith('order:'))
      expect(new Set(plan).size, topic).toBe(plan.length)
    }
  })

  it('topik besar mulai dari tingkat 1 dan membuka tingkat berikutnya setelah 60 persen dikenal', () => {
    const flags = topicById('flags')
    expect(openTier(flags, empty)).toBe(1)
    for (const id of planRound({ topic: 'flags', mode: 'speed', seed: 't', know: empty })) expect(factById(id)!.tier).toBe(1)
    const know: KnowMap = {}
    for (const f of flags.facts.filter((x) => x.tier === 1)) know[f.id] = { n: 4, r: KNOWN_AFTER_RIGHT, last: 1 }
    expect(openTier(flags, know)).toBe(2)
    expect(planRound({ topic: 'flags', mode: 'speed', seed: 't', know }).some((id) => factById(id)!.tier === 2)).toBe(true)
    expect(openTier(topicById('inventors'), empty)).toBe(3)
  })

  it('fakta yang belum dikenal lebih sering dipilih daripada yang sudah dikenal', () => {
    const t = topicById('inventors')
    const know: KnowMap = {}
    for (const f of t.facts.slice(0, 13)) know[f.id] = { n: 6, r: 5, last: 1 }
    let knownPicked = 0
    let unknownPicked = 0
    for (let i = 0; i < 40; i++) {
      for (const id of planRound({ topic: 'inventors', mode: 'quiz', seed: `w${i}`, know })) {
        if (id.startsWith('order:')) continue
        if (isKnown(know[id])) knownPicked++
        else unknownPicked++
      }
    }
    expect(unknownPicked).toBeGreaterThan(knownPicked * 1.5)
  })

  it('topik campuran memilih dari banyak topik', () => {
    const plan = planRound({ topic: 'mix', mode: 'quiz', seed: 'mix', know: empty })
    expect(plan).toHaveLength(10)
    expect(new Set(plan.map((id) => topicOfFact(id))).size).toBeGreaterThanOrEqual(4)
  })

  it('roundQuestion membuat soal dari rencana dan seed yang sama', () => {
    const plan = planRound({ topic: 'space', mode: 'quiz', seed: 'rq', know: empty })
    for (let i = 0; i < plan.length; i++) expect(roundQuestion(plan, 'rq', i)).toEqual(roundQuestion(plan, 'rq', i))
    expect(() => roundQuestion(plan, 'rq', 99)).toThrow()
  })

  it('soal urutan disisipkan di topik yang punya, tidak berturut-turut', () => {
    let found = 0
    for (let i = 0; i < 60; i++) {
      const plan = planRound({ topic: 'space', mode: 'speed', seed: `o${i}`, know: empty })
      for (let k = 1; k < plan.length; k++) {
        if (plan[k]!.startsWith('order:')) {
          found++
          expect(plan[k - 1]!.startsWith('order:')).toBe(false)
        }
      }
    }
    expect(found).toBeGreaterThan(20)
  })

  it('tumpukan belajar: 12 kartu, yang belum dikenal lebih dulu', () => {
    const t = topicById('provinces')
    const know: KnowMap = {}
    for (const f of t.facts.slice(0, 30)) know[f.id] = { n: 5, r: 4, last: 1 }
    const deck = planLearn({ topic: 'provinces', seed: 'd', know })
    expect(deck).toHaveLength(12)
    const unknown = t.facts.filter((f) => !isKnown(know[f.id])).map((f) => f.id)
    expect(unknown).toHaveLength(8)
    for (const id of unknown) expect(deck.map((c) => c.factId)).toContain(id)
    for (const c of deck) expect(c.front.length).toBeGreaterThan(0)
  })

  it('recordKnow: hanya jawaban pilihan ganda yang benar menaikkan hitungan dikenal', () => {
    let k: KnowMap = {}
    k = recordKnow(k, 'flag:id', true, true)
    expect(k['flag:id']).toEqual({ n: 1, r: 1, last: 1 })
    k = recordKnow(k, 'flag:id', true, false)
    expect(k['flag:id']).toEqual({ n: 2, r: 1, last: 1 })
    k = recordKnow(k, 'flag:id', false, true)
    expect(k['flag:id']).toEqual({ n: 3, r: 1, last: 0 })
    k = recordKnow(k, 'flag:id', true, true)
    expect(isKnown(k['flag:id'])).toBe(true)
    expect(recordKnow(k, 'order:x', true, true)).toBe(k)
  })

  it('kemajuan topik dan angka lencana mengikuti peta dikenal', () => {
    const know: KnowMap = {}
    for (const f of topicById('flags').facts.filter((x) => x.group === 'Asia')) know[f.id] = { n: 3, r: 2, last: 1 }
    for (const f of topicById('provinces').facts) know[f.id] = { n: 3, r: 2, last: 1 }
    const c = knowledgeCounts(know)
    expect(c.quizAsiaFlagsKnown).toBe(45)
    expect(c.quizAsiaFlagsTotal).toBe(45)
    expect(c.quizFlagsKnown).toBe(45)
    expect(c.quizFlagsTotal).toBe(192)
    expect(c.quizProvincesKnown).toBe(38)
    expect(c.quizPlanetsKnown).toBe(0)
    expect(c.quizPlanetsTotal).toBe(8)
    expect(c.quizTopicsTotal).toBe(12)
    expect(topicProgress('flags', know)).toEqual({ known: 45, total: 192, seen: 45 })
    expect(topicsTried(know)).toBe(2)
  })

  it('berkas bendera berformat SVG', () => {
    expect(readFileSync(`${FLAGS_DIR}id.svg`, 'utf8').startsWith('<svg')).toBe(true)
  })
})
