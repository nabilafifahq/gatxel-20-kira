import { describe, expect, it } from 'vitest'
import { createRng } from '@kira/core'
import {
  assembleKiraPaper,
  choosePaper,
  fullCandidates,
  miniCandidates,
  minutesFor,
  paperTitle,
  sectionOrder,
  type LibraryEntry,
  type PickRecord,
  type PoolItem,
} from '@/server/dal/paper-picker-logic'

let n = 0
function entry(p: Partial<LibraryEntry> & { competition: string | null; year: number | null; section: string }): LibraryEntry {
  n++
  const refs = p.itemRefs ?? Array.from({ length: 6 }, (_, i) => `org:${p.competition}-${p.year}-${p.section}-${i}`)
  return {
    id: `id-${n}`,
    subject: 'math',
    grade: 2,
    title: paperTitle({ competition: p.competition, year: p.year, grade: 2, section: p.section }),
    minutes: 25,
    source: 'unggahan tutor',
    itemRefs: refs,
    ...p,
  }
}

const pick = (competition: string | null, year: number | null, date: string, itemRefs: string[]): PickRecord => ({ competition, year, date, itemRefs })

describe('judul dan waktu', () => {
  it('paperTitle dan minutesFor', () => {
    expect(paperTitle({ competition: 'ikmc', year: 2023, grade: 2, section: 'a' })).toBe('IKMC 2023, Grade 2, part A')
    expect(paperTitle({ competition: 'sasmo', year: 2022, grade: 2, section: 'penuh' })).toBe('SASMO 2022, Grade 2, full paper')
    expect(paperTitle({ competition: null, year: null, grade: 3, section: 'B' })).toBe('Contest paper, Grade 3, part B')
    expect(minutesFor(10)).toBe(15)
    expect(minutesFor(24)).toBe(36)
    expect(minutesFor(1)).toBe(5)
  })

  it('sectionOrder: A sebelum B, angka menurut nilainya, penuh paling akhir', () => {
    expect(sectionOrder('A')).toBeLessThan(sectionOrder('b'))
    expect(sectionOrder('2')).toBeLessThan(sectionOrder('10'))
    expect(sectionOrder('C')).toBeLessThan(sectionOrder('penuh'))
  })
})

describe('kandidat mini dan penuh', () => {
  const a = entry({ competition: 'ikmc', year: 2023, section: 'A', minutes: 20 })
  const b = entry({ competition: 'ikmc', year: 2023, section: 'B', minutes: 25 })
  const full = entry({ competition: 'sasmo', year: 2022, section: 'penuh', minutes: 90 })
  const loneSection = entry({ competition: 'kmnr', year: 2024, section: 'A' })

  it('mini hanya memakai bagian, bukan paper penuh', () => {
    expect(miniCandidates([a, b, full]).map((c) => c.libraryId)).toEqual([a.id, b.id])
  })

  it('penuh memakai paper penuh dan menggabung bagian dari paper yang sama', () => {
    const c = fullCandidates([a, b, full, loneSection])
    expect(c).toHaveLength(2)
    const combo = c.find((x) => x.key.startsWith('grp:'))!
    expect(combo.libraryId).toBeNull()
    expect(combo.minutes).toBe(45)
    expect(combo.itemRefs).toEqual([...a.itemRefs, ...b.itemRefs])
    expect(combo.title).toBe('IKMC 2023, Grade 2, full paper')
  })

  it('bagian digabung tidak dibuat bila paper penuhnya sudah ada', () => {
    const fullIkmc = entry({ competition: 'ikmc', year: 2023, section: 'penuh' })
    expect(fullCandidates([a, b, fullIkmc]).map((c) => c.key)).toEqual([`lib:${fullIkmc.id}`])
  })
})

describe('choosePaper', () => {
  it('tanpa kandidat atau semuanya sudah dikerjakan hasilnya null', () => {
    expect(choosePaper([], [])).toBeNull()
    const a = entry({ competition: 'ikmc', year: 2023, section: 'A' })
    const [c] = miniCandidates([a])
    expect(choosePaper([c!], [pick('ikmc', 2023, '2026-10-01', a.itemRefs)])).toBeNull()
  })

  it('bagian yang separuh atau lebih sudah dikerjakan dianggap sudah dilihat, yang sedikit tumpang tindih masih boleh', () => {
    const a = entry({ competition: 'ikmc', year: 2023, section: 'A' })
    const [c] = miniCandidates([a])
    expect(choosePaper([c!], [pick('ikmc', 2023, '2026-10-01', a.itemRefs.slice(0, 3))])).toBeNull()
    expect(choosePaper([c!], [pick('ikmc', 2023, '2026-10-01', a.itemRefs.slice(0, 2))])?.key).toBe(c!.key)
  })

  it('lomba bergiliran: lomba yang paling lama tidak muncul didahulukan, lomba baru paling depan', () => {
    const list = [
      entry({ competition: 'ikmc', year: 2024, section: 'A' }),
      entry({ competition: 'sasmo', year: 2024, section: 'A' }),
      entry({ competition: 'kmnr', year: 2024, section: 'A' }),
    ]
    const cands = miniCandidates(list)
    const history = [pick('ikmc', 2023, '2026-10-12', ['x1']), pick('sasmo', 2023, '2026-10-05', ['x2'])]
    expect(choosePaper(cands, history)?.competition).toBe('kmnr')
    expect(choosePaper(cands.filter((c) => c.competition !== 'kmnr'), history)?.competition).toBe('sasmo')
  })

  it('tahun 2021 ke atas didahulukan, lalu yang lebih baru', () => {
    const list = [
      entry({ competition: 'ikmc', year: 2019, section: 'A' }),
      entry({ competition: 'ikmc', year: 2022, section: 'A' }),
      entry({ competition: 'ikmc', year: 2024, section: 'A' }),
    ]
    expect(choosePaper(miniCandidates(list), [])?.year).toBe(2024)
    expect(choosePaper(miniCandidates(list.filter((e) => e.year !== 2024)), [])?.year).toBe(2022)
    expect(choosePaper(miniCandidates(list.filter((e) => e.year === 2019)), [])?.year).toBe(2019)
  })

  it('preferensi tahun menang atas giliran lomba, dan bagian A sebelum B di paper yang sama', () => {
    const old = entry({ competition: 'kmnr', year: 2018, section: 'A' })
    const recent = entry({ competition: 'ikmc', year: 2023, section: 'A' })
    expect(choosePaper(miniCandidates([old, recent]), [pick('ikmc', 2023, '2026-10-12', ['z'])])?.libraryId).toBe(recent.id)
    const b = entry({ competition: 'sasmo', year: 2023, section: 'B' })
    const a = entry({ competition: 'sasmo', year: 2023, section: 'A' })
    expect(choosePaper(miniCandidates([b, a]), [])?.libraryId).toBe(a.id)
  })

  it('minggu simulasi: paper penuh berdurasi di rentang program didahulukan', () => {
    const long = entry({ competition: 'ikmc', year: 2024, section: 'penuh', minutes: 75 })
    const fit = entry({ competition: 'sasmo', year: 2021, section: 'penuh', minutes: 35 })
    const cands = fullCandidates([long, fit])
    expect(choosePaper(cands, [])?.libraryId).toBe(long.id)
    expect(choosePaper(cands, [], { window: { min: 30, max: 40 } })?.libraryId).toBe(fit.id)
  })

  it('paper penuh gabungan dianggap sudah dilihat setelah bagiannya dikerjakan', () => {
    const a = entry({ competition: 'ikmc', year: 2023, section: 'A' })
    const b = entry({ competition: 'ikmc', year: 2023, section: 'B' })
    const c = entry({ competition: 'ikmc', year: 2023, section: 'C' })
    const cands = fullCandidates([a, b, c])
    // Satu dari tiga bagian: paper penuh masih layak. Dua dari tiga: sudah dianggap dilihat.
    expect(choosePaper(cands, [pick('ikmc', 2023, '2026-10-01', a.itemRefs)])?.key).toBe(cands[0]!.key)
    expect(choosePaper(cands, [pick('ikmc', 2023, '2026-10-01', [...a.itemRefs, ...b.itemRefs])])).toBeNull()
  })
})

describe('assembleKiraPaper', () => {
  const pool: PoolItem[] = Array.from({ length: 40 }, (_, i) => ({ ref: `m2.oly-${['a', 'b', 'c', 'd'][i % 4]}.${String(i).padStart(3, '0')}`, skillId: `m2.oly-${['a', 'b', 'c', 'd'][i % 4]}`, difficulty: 1 + (i % 5) }))

  it('mengambil jumlah yang diminta, tersebar antar-skill, diurutkan dari kesulitan terendah', () => {
    const r = assembleKiraPaper(pool, 10, [], createRng('a'))!
    expect(r.refs).toHaveLength(10)
    expect(r.minutes).toBe(15)
    const diffs = r.refs.map((ref) => pool.find((p) => p.ref === ref)!.difficulty)
    expect(diffs).toEqual([...diffs].sort((x, y) => x - y))
    const skills = new Set(r.refs.map((ref) => pool.find((p) => p.ref === ref)!.skillId))
    expect(skills.size).toBe(4)
  })

  it('hasilnya sama untuk seed yang sama dan tanpa soal ganda', () => {
    const one = assembleKiraPaper(pool, 24, [], createRng('seed'))!
    const two = assembleKiraPaper(pool, 24, [], createRng('seed'))!
    expect(one).toEqual(two)
    expect(new Set(one.refs).size).toBe(24)
  })

  it('soal yang pernah dipilih hanya mengisi kekurangan', () => {
    const seen = pool.slice(0, 35).map((p) => p.ref)
    const r = assembleKiraPaper(pool, 10, [pick(null, null, '2026-10-01', seen)], createRng('x'))!
    const fresh = pool.slice(35).map((p) => p.ref)
    expect(fresh.every((f) => r.refs.includes(f))).toBe(true)
    expect(r.refs).toHaveLength(10)
  })

  it('soal terlalu sedikit menghasilkan null', () => {
    expect(assembleKiraPaper(pool.slice(0, 4), 10, [], createRng('x'))).toBeNull()
    expect(assembleKiraPaper([], 10, [], createRng('x'))).toBeNull()
  })

  it('soal yang sama di pool tidak dihitung dua kali', () => {
    const dup = [...pool.slice(0, 6), ...pool.slice(0, 6)]
    expect(assembleKiraPaper(dup, 10, [], createRng('x'))!.refs).toHaveLength(6)
  })
})
