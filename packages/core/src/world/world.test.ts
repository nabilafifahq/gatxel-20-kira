import { describe, expect, it } from 'vitest'
import { bossWinAt, CARDS, CARD_SETS, SHOP, STORY, cardEarned, cardsOfSet, certificatesFor, chaptersOpen, cleanPetName, diminishing, DRILL_STARS_BY_COUNT, nextBossCard, petStage, sessionStars, setComplete } from '../index'

describe('bintang', () => {
  it('sesi wajib 3 bintang, sempurna +2, ulangan 0', () => {
    expect(sessionStars({ perfect: false, retry: false })).toEqual({ base: 3, perfect: 0 })
    expect(sessionStars({ perfect: true, retry: false })).toEqual({ base: 3, perfect: 2 })
    expect(sessionStars({ perfect: true, retry: true })).toEqual({ base: 0, perfect: 0 })
  })
  it('drill menurun per hari lalu berhenti', () => {
    expect([0, 1, 2, 3, 9].map((n) => diminishing(DRILL_STARS_BY_COUNT, n))).toEqual([2, 1, 1, 0, 0])
  })
  it('sertifikat streak', () => {
    expect(certificatesFor(6)).toEqual([])
    expect(certificatesFor(30)).toEqual([7, 30])
    expect(certificatesFor(100)).toEqual([7, 30, 100])
  })
})

describe('teman', () => {
  it('tahap menurut sesi', () => {
    expect([0, 9, 10, 39, 40].map(petStage)).toEqual([1, 1, 2, 2, 3])
  })
  it('nama dibersihkan', () => {
    expect(cleanPetName('  Mimi  ')).toBe('Mimi')
    expect(cleanPetName('<b>')).toBeNull()
    expect(cleanPetName('')).toBeNull()
    expect(cleanPetName('x'.repeat(13))).toBeNull()
  })
})

describe('katalog', () => {
  it('id kartu unik, 4 per set, dan tiap set punya hadiah', () => {
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length)
    for (const s of CARD_SETS) expect(cardsOfSet(s.id)).toHaveLength(4)
  })
  it('kartu bos hanya dari bos, bukan dari kemampuan', () => {
    const none = { quiz: {}, masteredScience: 99 }
    for (const c of cardsOfSet('robot')) expect(cardEarned(c, none)).toBe(false)
    expect(nextBossCard(new Set())?.id).toBe('rb-robot')
    expect(nextBossCard(new Set(cardsOfSet('robot').map((c) => c.id)))).toBeNull()
  })
  it('kartu quiz didapat dari persen fakta yang dikenal', () => {
    const lion = CARDS.find((c) => c.id === 'an-lion')!
    expect(cardEarned(lion, { quiz: { animals: { known: 1, total: 20 } }, masteredScience: 0 })).toBe(false)
    expect(cardEarned(lion, { quiz: { animals: { known: 3, total: 20 } }, masteredScience: 0 })).toBe(true)
  })
  it('selesai set', () => {
    const ids = new Set(cardsOfSet('flags').map((c) => c.id))
    expect(setComplete('flags', ids)).toBe(true)
    ids.delete('fl-id')
    expect(setComplete('flags', ids)).toBe(false)
  })
  it('harga toko positif dan id unik', () => {
    expect(SHOP.every((i) => i.price > 0)).toBe(true)
    expect(new Set(SHOP.map((i) => i.id)).size).toBe(SHOP.length)
  })
})

describe('cerita', () => {
  it('delapan bab dan bab terbuka menurut minggu tujuan', () => {
    expect(STORY).toHaveLength(8)
    expect([0, 1, 7, 20].map(chaptersOpen)).toEqual([1, 2, 8, 8])
    for (const c of STORY) {
      expect(c.pages.length).toBeGreaterThanOrEqual(4)
      expect(c.tease.length).toBeGreaterThan(10)
    }
  })
  it('bos menang di 70 persen', () => expect([10, 8, 5, 3].map(bossWinAt)).toEqual([7, 6, 4, 3]))
})
