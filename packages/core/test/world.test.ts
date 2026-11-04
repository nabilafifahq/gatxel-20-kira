import { describe, expect, it } from 'vitest'
import { ALL_ITEMS, BOSSES, BOSS_LEVEL_QUESTIONS, BOSS_WIN_AT, CARDS, CARD_COUNT, CARD_SETS, NO_CARD_PROGRESS, PET_COSTUMES, PET_HOMES, PRICE, QUIET_DAY_STARS, RARITIES, SHOP, STORY, STORY_SCENE_IDS, TYPICAL_DAY_STARS, BOSS_WIN_STARS, HATCH_AT_STARS, bossById, bossCardIds, bossEnergy, bossLine, bossNextIn, bossOpenCount, bossPlan, bossPrizeCard, bossRef, bossSpotlight, bossWinAt, bossesAvailable, cardAvailable, cardById, cardCloseness, cardEarned, cardHint, cardsOfSet, certificatesFor, chaptersOpen, cleanPetName, cleanStoryDone, diminishing, DRILL_STARS_BY_COUNT, lumiGlow, parseBossRef, petStage, sessionStars, setComplete } from '../src/world'

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
  it('id kartu unik, cukup banyak, dan tiap set punya hadiah sendiri', () => {
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length)
    expect(CARD_COUNT).toBeGreaterThanOrEqual(110)
    for (const s of CARD_SETS) expect(cardsOfSet(s.id).length).toBeGreaterThanOrEqual(4)
    expect(new Set(CARD_SETS.map((s) => s.reward)).size).toBe(CARD_SETS.length)
    for (const s of CARD_SETS) expect(ALL_ITEMS.some((i) => i.id === s.reward)).toBe(true)
  })
  it('id kartu lama tetap ada supaya kartu milik anak tidak hilang', () => {
    for (const id of ['an-lion', 'an-penguin', 'an-elephant', 'an-whale', 'pl-earth', 'pl-mars', 'pl-saturn', 'pl-jupiter', 'fl-id', 'fl-jp', 'fl-fr', 'fl-it', 'lm-fuji', 'lm-pyramid', 'lm-eiffel', 'lm-borobudur', 'iv-bell', 'iv-gutenberg', 'iv-edison', 'iv-wright', 'sc-darwin', 'sc-newton', 'sc-galileo', 'sc-curie', 'rb-robot', 'rb-comet', 'rb-aurora', 'rb-rainbow']) {
      expect(cardById(id), id).toBeDefined()
    }
  })
  it('kartu tonggak tingkat rare ke atas dan tidak pernah acak', () => {
    const milestone = CARDS.filter((c) => ['boss', 'story', 'book', 'streak', 'sessions', 'stars'].includes(c.req.kind))
    expect(milestone.length).toBeGreaterThanOrEqual(30)
    for (const c of milestone) expect(c.rarity).not.toBe('common')
    for (const r of RARITIES) expect(CARDS.some((c) => c.rarity === r)).toBe(true)
    for (const s of CARD_SETS.filter((x) => x.rare)) for (const c of cardsOfSet(s.id)) expect(milestone).toContain(c)
    expect(JSON.stringify(CARDS)).not.toMatch(/random|chance|pack|unlock/i)
  })
  it('kemajuan jujur: kartu didapat tepat saat kedekatan penuh, dan tanpa kemajuan tidak ada kartu', () => {
    for (const c of CARDS) {
      expect(cardEarned(c, NO_CARD_PROGRESS), c.id).toBe(false)
      expect(cardCloseness(c, NO_CARD_PROGRESS), c.id).toBe(0)
      expect(cardHint(c).length).toBeGreaterThan(8)
    }
    const lion = cardById('an-lion')!
    expect(cardEarned(lion, { ...NO_CARD_PROGRESS, quiz: { animals: { known: 1, total: 20 } } })).toBe(false)
    expect(cardCloseness(lion, { ...NO_CARD_PROGRESS, quiz: { animals: { known: 1, total: 20 } } })).toBeCloseTo(1 / 3)
    expect(cardEarned(lion, { ...NO_CARD_PROGRESS, quiz: { animals: { known: 3, total: 20 } } })).toBe(true)
    const streak = cardById('ms-7')!
    expect(cardCloseness(streak, { ...NO_CARD_PROGRESS, bestStreak: 3 })).toBeCloseTo(3 / 7)
    expect(cardEarned(streak, { ...NO_CARD_PROGRESS, bestStreak: 7 })).toBe(true)
    expect(cardEarned(cardById('st-pip')!, { ...NO_CARD_PROGRESS, storyDone: [1, 2] })).toBe(false)
    expect(cardEarned(cardById('st-pip')!, { ...NO_CARD_PROGRESS, storyDone: [8] })).toBe(true)
    expect(cardEarned(cardById('bk-3')!, { ...NO_CARD_PROGRESS, booksFinished: 3 })).toBe(true)
    expect(cardEarned(bossPrizeCard('flapdoodle')!, { ...NO_CARD_PROGRESS, bossesBeaten: ['flapdoodle'] })).toBe(true)
  })
  it('album tidak menghitung kartu dari fitur yang dimatikan', () => {
    const on = (k: string) => k !== 'math' && k !== 'quiz-arena'
    expect(cardAvailable(cardById('nm-euclid')!, on)).toBe(false)
    expect(cardAvailable(cardById('an-lion')!, on)).toBe(false)
    expect(cardAvailable(bossPrizeCard('clickerclaw')!, on)).toBe(false)
    expect(cardAvailable(bossPrizeCard('robot')!, on)).toBe(true)
    expect(cardAvailable(cardById('ms-7')!, on)).toBe(true)
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
  it('terbaca sebagai buku bergambar: kalimat pendek, halaman ringkas, refrein berubah, tanpa kata terlarang', () => {
    const banned = /unlock|\u2014|\u2013|hurry|last chance|before it is too late|lives left/i
    for (const c of STORY) {
      expect(c.pages.length).toBeGreaterThanOrEqual(10)
      expect(c.scrap.length).toBeGreaterThan(10)
      expect(c.wonder.endsWith('?')).toBe(true)
      for (const t of [c.title, c.scrap, c.wonder, c.tease, ...c.pages.map((p) => p.text)]) expect(banned.test(t), t).toBe(false)
      for (const p of c.pages) {
        expect(p.text.split(/\s+/).length, p.text).toBeLessThanOrEqual(36)
        for (const s of p.text.split(/(?<=[.!?\u201D])\s+/)) expect(s.split(/\s+/).length, s).toBeLessThanOrEqual(19)
      }
      expect(c.pages.map((p) => p.text).join(' ')).toMatch(/One \w+ at a time/)
    }
  })
  it('buku enam warna, Pip di setiap gambar, Lumi makin terang, adegan dikenal', () => {
    for (const c of STORY) for (const p of c.pages) {
      expect(p.pip.x).toBeGreaterThanOrEqual(0)
      expect(p.pip.x).toBeLessThanOrEqual(100)
      expect(STORY_SCENE_IDS as readonly string[]).toContain(p.scene ?? c.scene)
    }
    expect(lumiGlow(8)).toBeGreaterThan(lumiGlow(1))
    expect(STORY[7]!.pages.map((p) => p.text).join(' ')).toContain('Pip')
    expect(STORY.slice(0, 7).flatMap((c) => c.pages.map((p) => p.text)).join(' ')).not.toContain('Pip')
  })
  it('daftar bab selesai dibersihkan', () => {
    expect(cleanStoryDone([2, 2, 1, 99, 'x', 0])).toEqual([1, 2])
    expect(cleanStoryDone(null)).toEqual([])
  })
  it('bos menang di 70 persen', () => expect([10, 8, 5, 3].map(bossWinAt)).toEqual([7, 6, 4, 3]))
})

describe('bos', () => {
  it('sedikitnya 12 lawan, lengkap, dengan id unik dan kartu masing-masing', () => {
    expect(BOSSES.length).toBeGreaterThanOrEqual(12)
    expect(new Set(BOSSES.map((b) => b.id)).size).toBe(BOSSES.length)
    expect(new Set(BOSSES.map((b) => b.name)).size).toBe(BOSSES.length)
    expect(new Set(bossCardIds()).size).toBe(BOSSES.length)
    for (const b of BOSSES) {
      for (const s of [b.name, b.epithet, b.personality, b.weakness, b.intro, b.defeat, b.rematch]) expect(s.length, b.id).toBeGreaterThan(3)
      expect(b.attacks.length).toBeGreaterThanOrEqual(3)
      expect(b.hits.length).toBeGreaterThanOrEqual(3)
      expect(b.subjects.length).toBeGreaterThan(0)
      expect(bossPrizeCard(b.id)?.req).toEqual({ kind: 'boss', boss: b.id })
      for (const s of [b.intro, b.defeat, b.rematch, ...b.attacks, ...b.hits]) {
        expect(s, b.id).not.toMatch(/unlock|\u2014|\u2013|lives|hearts|you lost|hurry up|pay/i)
      }
    }
  })
  it('semua mapel punya lawan', () => {
    for (const s of ['math', 'english', 'science'] as const) expect(BOSSES.filter((b) => b.subjects.includes(s)).length).toBeGreaterThanOrEqual(4)
  })
  it('lawan dengan mapel mati tidak ditawarkan, robot campuran tetap selama ada mapel menyala', () => {
    const noMath = bossesAvailable((s) => s !== 'math')
    expect(noMath.some((b) => b.subjects.length === 1 && b.subjects[0] === 'math')).toBe(false)
    expect(noMath.some((b) => b.id === 'robot')).toBe(true)
    expect(bossesAvailable(() => false)).toEqual([])
  })
  it('lawan baru datang lewat hari belajar dan tidak pernah berkurang', () => {
    expect([0, 1, 2, 3, 4, 22].map(bossOpenCount)).toEqual([3, 3, 4, 4, 5, 14])
    expect(bossNextIn(0, 14)).toBe(2)
    expect(bossNextIn(1, 14)).toBe(1)
    expect(bossNextIn(22, 14)).toBeNull()
    expect(bossNextIn(0, 3)).toBeNull()
  })
  it('referensi attempt: format baru dan format lama', () => {
    expect(bossRef('2026-11-02', 'hexapuff', 2)).toBe('boss:2026-11-02:hexapuff:2')
    expect(parseBossRef('boss:2026-11-02:hexapuff:2')).toEqual({ week: '2026-11-02', id: 'hexapuff' })
    expect(parseBossRef('boss:2026-11-02:1')).toEqual({ week: '2026-11-02', id: 'robot' })
  })
  it('bar tenaga jujur: habis tepat saat cukup untuk menang', () => {
    expect(bossEnergy(0, 10)).toBe(1)
    expect(bossEnergy(bossWinAt(10), 10)).toBe(0)
    expect(bossEnergy(10, 10)).toBe(0)
    expect(bossEnergy(3, 12)).toBeCloseTo(1 - 3 / 9)
    expect(BOSS_WIN_AT).toBe(bossWinAt(10))
  })
  it('rencana soal menjumlah tepat, memakai rumpun lawan, dan melewati mapel yang mati', () => {
    for (const b of BOSSES) {
      const q = BOSS_LEVEL_QUESTIONS[b.level]
      const plan = bossPlan(b, q, () => true)
      expect(plan.reduce((s, c) => s + c.count, 0)).toBe(q)
      for (const c of plan) expect(b.subjects).toContain(c.subject)
    }
    const robot = bossById('robot')!
    const plan = bossPlan(robot, 8, (s) => s === 'english')
    expect(new Set(plan.map((c) => c.subject))).toEqual(new Set(['english']))
    expect(bossPlan(bossById('clickerclaw')!, 8, (s) => s !== 'math')).toEqual([])
  })
  it('sorotan memilih lawan yang belum kalah', () => {
    expect(bossSpotlight(['robot', 'mossback'], { robot: 2 }, '2026-11-02')).toBe('mossback')
    expect(['robot', 'mossback']).toContain(bossSpotlight(['robot', 'mossback'], { robot: 2, mossback: 1 }, '2026-11-02'))
    expect(bossSpotlight([], {}, '2026-11-02')).toBeNull()
    expect(bossLine(['a', 'b'], 3)).toBe('b')
  })
})

describe('ekonomi bintang', () => {
  const sold = SHOP
  const total = sold.reduce((s, i) => s + i.price, 0)
  const week = (day: number) => day * 6 + BOSS_WIN_STARS
  it('hari yang paling tenang pun cukup untuk menetas dan membeli sesuatu', () => {
    expect(QUIET_DAY_STARS).toBeGreaterThanOrEqual(HATCH_AT_STARS)
    expect(sold.filter((i) => i.price <= QUIET_DAY_STARS).length).toBeGreaterThanOrEqual(3)
    expect(PET_COSTUMES.some((c) => c.price <= QUIET_DAY_STARS)).toBe(true)
  })
  it('tujuan berminggu-minggu: toko tidak habis sebelum 6 minggu hari biasa', () => {
    expect(total / week(TYPICAL_DAY_STARS)).toBeGreaterThanOrEqual(6)
    expect(Math.max(...sold.map((i) => i.price))).toBeGreaterThanOrEqual(TYPICAL_DAY_STARS * 7)
  })
  it('barang punya tiga kelas harga dan semua harga ada di satu tabel', () => {
    expect(sold.some((i) => i.price <= 9)).toBe(true)
    expect(sold.some((i) => i.price > 9 && i.price <= 45)).toBe(true)
    expect(sold.some((i) => i.price >= 60)).toBe(true)
    for (const i of sold) {
      if (i.id in PRICE) expect(i.price, i.id).toBe(PRICE[i.id as keyof typeof PRICE])
    }
    expect(PET_HOMES.find((h) => h.id === 'home-pond')?.price).toBe(PRICE['home-pond'])
  })
})
