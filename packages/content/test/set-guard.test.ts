import { beforeAll, describe, expect, it } from 'vitest'
import { createRng } from '@kira/core/rng'
import { loadContent, type ContentIndex } from '../src/load'
import { generateItem, GENERATORS, genRef, instanceSignature, type Level } from '../src/math'
import { clashKeys } from '../src/signature'
import { guardSet } from '../src/set-guard'

let index: ContentIndex
beforeAll(() => {
  index = loadContent().index
})

type E = { ref: string; difficulty: number }
const run = (entries: E[], seed = 't', mode?: string) => guardSet(entries, { index, seed, ...(mode ? { mode } : {}) })

function expectNoClash(refs: string[]) {
  const seen = new Set<string>()
  for (const ref of refs) {
    const item = ref.startsWith('gen:') ? generateItem(ref) : index.items.get(ref)!
    for (const k of clashKeys(item, item.passage ? index.passages.get(item.passage) : undefined)) {
      expect(seen.has(k), `${ref} bentrok`).toBe(false)
      seen.add(k)
    }
  }
}

describe('replay sesi produksi yang pernah menampilkan soal kembar', () => {
  // Dari tes Math kelas 2 tanggal 31 Okt 2026: dua soal "Match each number to its partner to make 100" dengan
  // empat pasangan yang sama (50 dan 50, 90 dan 10, 30 dan 70, 60 dan 40), hanya beda urutan dan arah. Tanpa data anak.
  const bad: E[] = [
    ['gen:m2.number-bonds:1:i7i39u', 1],
    ['gen:m2.number-bonds:1:ew1pj4', 1],
    ['gen:m2.number-bonds:2:b6y3pr', 2],
    ['gen:m2.number-bonds:2:2zoq4f', 2],
    ['gen:m2.number-bonds:3:gd0ixd', 3],
    ['gen:m2.number-bonds:3:1gpnkq', 3],
    ['gen:m2.number-bonds:4:pry413', 4],
    ['gen:m2.number-bonds:5:q65r1d', 5],
  ].map(([ref, difficulty]) => ({ ref: ref as string, difficulty: difficulty as number }))

  it('kode lama tidak melihatnya: tanda instans lama berbeda, tanda tampilan sama', () => {
    expect(instanceSignature(bad[4]!.ref)).not.toBe(instanceSignature(bad[5]!.ref))
    const [a, b] = [generateItem(bad[4]!.ref), generateItem(bad[5]!.ref)]
    expect(clashKeys(a).some((k) => clashKeys(b).includes(k))).toBe(true)
  })

  it('penjaga mengganti salah satunya dan set tetap penuh tanpa kembar', () => {
    const r = run(bad)
    expect(r.entries).toHaveLength(bad.length)
    expect(r.replaced).toBeGreaterThanOrEqual(1)
    expectNoClash(r.entries.map((e) => e.ref))
  })
})

describe('penjaga set', () => {
  it('ref yang sama dua kali diganti, bukan dipakai ulang', () => {
    const r = run([{ ref: 'e2.magic-e.019', difficulty: 1 }, { ref: 'e2.magic-e.019', difficulty: 1 }])
    expect(r.entries).toHaveLength(2)
    expect(new Set(r.entries.map((e) => e.ref)).size).toBe(2)
  })

  it('operan sama dalam operasi sama dianggap sama (3 + 5 dan 5 + 3)', () => {
    const a = clashKeys({ ...generateItem(genRef('m2.number-bonds', 1, 'aaa')), prompt: '3 + 5 = ?' })
    const b = clashKeys({ ...generateItem(genRef('m2.number-bonds', 1, 'aaa')), prompt: '5 + 3 = ?' })
    expect(a.some((k) => b.includes(k))).toBe(true)
  })

  it('tanpa pengganti, set dipendekkan dan tidak pernah berisi kembar', () => {
    const one = [...index.items.values()].find((i) => i.type === 'mcq')!
    const r = guardSet([{ ref: one.id, difficulty: 1 }, { ref: one.id, difficulty: 1 }], { index: { ...index, itemsBySkill: new Map(), skillsByKey: new Map() }, seed: 'x' })
    expect(r.entries).toHaveLength(1)
    expect(r.dropped).toBe(1)
  })
})

describe('properti: tidak ada soal kembar untuk setiap skill, tingkat, dan seed', () => {
  const rngAll = createRng('property')
  it('generator Math: kumpulan seed acak per skill dan tingkat', () => {
    let replaced = 0
    let dropped = 0
    for (const [skill, g] of GENERATORS) {
      for (const level of g.levels) {
        for (let trial = 0; trial < 2; trial++) {
          const refs: E[] = Array.from({ length: 12 }, () => ({ ref: genRef(skill, level as Level, rngAll.int(0, 2 ** 31 - 1).toString(36)), difficulty: level }))
          const r = run(refs, `${skill}${level}${trial}`)
          expectNoClash(r.entries.map((e) => e.ref))
          replaced += r.replaced
          dropped += r.dropped
          expect(r.entries.length).toBeGreaterThanOrEqual(10)
        }
      }
    }
    expect(dropped).toBeLessThan(replaced + 1)
  })

  it('soal tertulis: set acak dengan pengulangan dari tiap skill', () => {
    for (const [skillId, list] of index.itemsBySkill) {
      if (list.length < 2) continue
      const r2 = createRng(`w:${skillId}`)
      for (let trial = 0; trial < 3; trial++) {
        const refs: E[] = Array.from({ length: Math.min(12, list.length + 3) }, () => {
          const it = r2.pick(list)
          return { ref: it.id, difficulty: it.difficulty }
        })
        const r = run(refs, `${skillId}${trial}`, 'latihan')
        expectNoClash(r.entries.map((e) => e.ref))
      }
    }
  })

  it('campuran lintas skill: pemanasan review yang sama dengan soal inti', () => {
    const list = [...index.itemsBySkill.values()].find((l) => l.length > 6)!
    const refs: E[] = [list[0]!, list[1]!, list[2]!, list[0]!, list[3]!].map((i) => ({ ref: i.id, difficulty: i.difficulty }))
    const r = run(refs)
    expect(r.entries).toHaveLength(5)
    expectNoClash(r.entries.map((e) => e.ref))
  })
})
