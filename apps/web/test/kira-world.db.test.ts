import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import postgres from 'postgres'
import { randomUUID } from 'node:crypto'
import { createDb, withOrg, type Tx } from '@kira/db/client'
import { BOSS_WIN_STARS, jakartaDate, weekStart } from '@kira/core'
import { addMedal, albumDTO, applyLook, bossDTO, buyItem, choosePet, equipItem, finishBoss, finishChapter, grantStars, medalsOf, removeMedal, spendStars, startBossSession, starTotals, storyDTO, syncCards, treatPet } from '@/server/dal/kira-world'

/** Tes Kira World di Postgres sungguhan (migrasi 0021): dompet bintang, toko, teman, bos, RLS. */

const urls = { owner: process.env.DATABASE_URL_OWNER, app: process.env.DATABASE_URL_APP }
const ready = Boolean(urls.owner && urls.app)

describe.skipIf(!ready)('Kira World (Postgres)', () => {
  const owner = ready ? postgres(urls.owner!, { max: 2, onnotice: () => {} }) : (null as never)
  const app = ready ? createDb(urls.app, { name: 'world-test', max: 6 }) : (null as never)
  const orgId = randomUUID()

  async function newLearner(role: 'learner' | 'guardian' = 'learner') {
    const id = randomUUID()
    await owner`insert into learner_profile (user_id, org_id, name, grade, active) values (${id}, ${orgId}, 'Anak Dunia __GTX_SEED__', 3, true)`
    const run = <T>(fn: (tx: Tx) => Promise<T>) => withOrg(app.db, { orgId, userId: id, role }, fn)
    return { id, run }
  }

  beforeAll(async () => {
    await owner`insert into org (id, name) values (${orgId}, 'Org Dunia __GTX_SEED__')`
  })
  afterAll(async () => {
    await owner`delete from org where id = ${orgId}`
    await Promise.all([owner.end(), app.client.end()])
  })

  it('bintang sekali per sumber dan saldo dihitung dari buku besar', async () => {
    const l = await newLearner()
    expect(await l.run((tx) => grantStars(tx, l.id, 3, 'session', 'session:a'))).toBe(3)
    expect(await l.run((tx) => grantStars(tx, l.id, 3, 'session', 'session:a'))).toBe(0)
    expect(await l.run((tx) => grantStars(tx, l.id, 2, 'perfect', 'perfect:a'))).toBe(2)
    expect(await l.run((tx) => starTotals(tx, l.id))).toEqual({ balance: 5, earned: 5 })
    expect(await l.run((tx) => grantStars(tx, l.id, 0, 'x'))).toBe(0)
  })

  it('belanja ditolak bila saldo kurang dan tidak pernah membuat saldo negatif, juga saat bersamaan', async () => {
    const l = await newLearner()
    await l.run((tx) => grantStars(tx, l.id, 20, 'session', 's1'))
    await expect(l.run((tx) => spendStars(tx, l.id, 30, 'x1'))).rejects.toMatchObject({ code: 'conflict' })
    const results = await Promise.allSettled([l.run((tx) => spendStars(tx, l.id, 15, 'p1')), l.run((tx) => spendStars(tx, l.id, 15, 'p2'))])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const t = await l.run((tx) => starTotals(tx, l.id))
    expect(t.balance).toBe(5)
    expect(t.earned).toBe(20)
  })

  it('toko: beli sekali, simpan kepemilikan, pakai hanya yang dimiliki', async () => {
    const l = await newLearner()
    await l.run((tx) => grantStars(tx, l.id, 30, 'session', 's1'))
    await expect(l.run((tx) => equipItem(tx, l.id, 'outfit', 'party-hat'))).rejects.toMatchObject({ code: 'forbidden' })
    await l.run((tx) => buyItem(tx, l.id, 'party-hat'))
    await expect(l.run((tx) => buyItem(tx, l.id, 'party-hat'))).rejects.toMatchObject({ code: 'conflict' })
    await expect(l.run((tx) => buyItem(tx, l.id, 'frame-leaf'))).rejects.toMatchObject({ code: 'not-found' })
    const look = await l.run((tx) => equipItem(tx, l.id, 'outfit', 'party-hat'))
    expect(look).toEqual({ look: 'avatarAccessory', value: 'party-hat' })
    await withOrg(app.db, { orgId, userId: l.id, role: 'tutor' }, (tx) => applyLook(tx, l.id, look!.look, look!.value))
    const [row] = await owner`select avatar_accessory from learner_profile where user_id = ${l.id}`
    expect(row!.avatar_accessory).toBe('party-hat')
    expect((await l.run((tx) => starTotals(tx, l.id))).balance).toBe(15)
  })

  it('teman: telur butuh bintang pertama, satu teman, camilan memakai bintang', async () => {
    const l = await newLearner()
    await expect(l.run((tx) => choosePet(tx, l.id, { kind: 'moonbun', name: 'Mimi' }))).rejects.toMatchObject({ code: 'forbidden' })
    await l.run((tx) => grantStars(tx, l.id, 8, 'session', 's1'))
    await expect(l.run((tx) => choosePet(tx, l.id, { kind: 'dragonx', name: 'Mimi' }))).rejects.toMatchObject({ code: 'invalid' })
    await l.run((tx) => choosePet(tx, l.id, { kind: 'moonbun', name: 'Mimi' }))
    await expect(l.run((tx) => choosePet(tx, l.id, { kind: 'flamekit', name: 'Lala' }))).rejects.toMatchObject({ code: 'conflict' })
    const r = await l.run((tx) => treatPet(tx, l.id, 'apple', 'n1'))
    expect(r.hearts).toBe(1)
    expect((await l.run((tx) => starTotals(tx, l.id))).balance).toBe(6)
    await l.run((tx) => treatPet(tx, l.id, 'apple', 'n1')).catch(() => null)
    expect((await l.run((tx) => starTotals(tx, l.id))).balance).toBe(6)
  })

  it('bos: menang di 7 dari 10, hadiah sekali per minggu, kalah tidak mengurangi apa pun', async () => {
    const l = await newLearner()
    const lose = await l.run((tx) => finishBoss(tx, l.id, randomUUID(), 'boss:2026-11-02:1', 6))
    expect(lose).toEqual({ won: false, stars: 0, cardId: null })
    const win = await l.run((tx) => finishBoss(tx, l.id, randomUUID(), 'boss:2026-11-02:2', 8))
    expect(win).toEqual({ won: true, stars: BOSS_WIN_STARS, cardId: 'rb-robot' })
    const again = await l.run((tx) => finishBoss(tx, l.id, randomUUID(), 'boss:2026-11-02:3', 10))
    expect(again).toEqual({ won: true, stars: 0, cardId: null })
    // Minggu berikutnya: bintang lagi, tetapi kartu Puzzle Robot sudah dimiliki.
    const next = await l.run((tx) => finishBoss(tx, l.id, randomUUID(), 'boss:2026-11-09:robot:1', 10))
    expect(next).toEqual({ won: true, stars: BOSS_WIN_STARS, cardId: null })
    // Lawan lain di minggu yang sama: kartu baru, bintang tidak dua kali.
    const comet = await l.run((tx) => finishBoss(tx, l.id, randomUUID(), 'boss:2026-11-09:comet:1', 9, 12))
    expect(comet).toEqual({ won: true, stars: 0, cardId: 'rb-comet' })
    const lost = await l.run((tx) => finishBoss(tx, l.id, randomUUID(), 'boss:2026-11-09:aurora:1', 8, 12))
    expect(lost).toEqual({ won: false, stars: 0, cardId: null })
    expect((await l.run((tx) => starTotals(tx, l.id))).balance).toBe(BOSS_WIN_STARS * 2)
  })

  it('kartu tonggak: dari bos, cerita, dan bintang, tanpa acak dan tanpa dobel', async () => {
    const l = await newLearner()
    await l.run((tx) => finishBoss(tx, l.id, randomUUID(), 'boss:2026-11-02:robot:1', 8, 8))
    await l.run((tx) => grantStars(tx, l.id, 100, 'session', 's1'))
    const fresh = await l.run((tx) => syncCards(tx, l.id))
    expect(fresh.map((c) => c.id)).toContain('ms-st100')
    const again = await l.run((tx) => syncCards(tx, l.id))
    expect(again).toEqual([])
    const first = await l.run((tx) => finishChapter(tx, l.id, 1))
    expect(first.cards.map((c) => c.id)).toEqual(['st-lumi'])
    expect((await l.run((tx) => finishChapter(tx, l.id, 1))).cards).toEqual([])
    // Bab yang belum terbuka tidak bisa ditandai selesai, dan isinya tidak dikirim.
    await expect(l.run((tx) => finishChapter(tx, l.id, 8))).rejects.toMatchObject({ code: 'forbidden' })
    const story = await l.run((tx) => storyDTO(tx, l.id))
    expect(story.chapters[0]!.done).toBe(true)
    expect(story.chapters[7]!.pages).toEqual([])
    expect(story.chapters[7]!.scrap).toBeNull()
    const album = await l.run((tx) => albumDTO(tx, l.id))
    expect(album.owned).toBeGreaterThanOrEqual(3)
    expect(album.sets.find((s) => s.id === 'robot')!.cards.find((c) => c.id === 'rb-robot')!.owned).toBe(true)
  })

  it('bos: mapel mati tidak ditawarkan, lawan baru masih misteri, dan bintang tidak menjadi syarat', async () => {
    const l = await newLearner()
    await owner`insert into learner_feature (org_id, learner_id, key, enabled) values (${orgId}, ${l.id}, 'math', false)`
    const dto = await l.run((tx) => bossDTO(tx, l.id))
    expect(dto.bosses.some((b) => b.id === 'clickerclaw')).toBe(false)
    expect(dto.bosses.some((b) => b.id === 'robot')).toBe(true)
    expect(dto.bosses.filter((b) => b.open)).toHaveLength(3)
    const closed = dto.bosses.find((b) => !b.open)!
    expect(closed.name).toBe('A new challenger')
    expect(closed.personality).toBe('')
    expect(dto.nextIn).toBe(2)
  })

  it('bos: batas layar habis menolak ronde baru, ronde yang sudah terbuka tetap bisa diselesaikan', async () => {
    const l = await newLearner()
    const ctx = { orgId, userId: l.id, role: 'learner' as const }
    const today = jakartaDate()
    const ref = `boss:${weekStart(today)}:robot:1`
    const [open] = await owner`insert into attempt (org_id, learner_id, kind, mode, subject, title, ref_id, items) values (${orgId}, ${l.id}, 'test', 'latihan', 'math', 'Puzzle Robot', ${ref}, '[]'::jsonb) returning id`
    await owner`insert into day_record (org_id, learner_id, date, minutes) values (${orgId}, ${l.id}, ${today}, 999)`
    expect((await l.run((tx) => bossDTO(tx, l.id))).limitReached).toBe(true)
    expect(await l.run((tx) => startBossSession(tx, ctx, l.id, 'robot'))).toBe(open!.id)
    await owner`update attempt set status = 'submitted', submitted_at = now() where id = ${open!.id}`
    await expect(l.run((tx) => startBossSession(tx, ctx, l.id, 'robot'))).rejects.toMatchObject({ code: 'forbidden' })
    const [count] = await owner`select count(*)::int n from attempt where learner_id = ${l.id}`
    expect(count!.n).toBe(1)
    await owner`update day_record set minutes = 0 where learner_id = ${l.id}`
    expect((await l.run((tx) => bossDTO(tx, l.id))).limitReached).toBe(false)
  })

  it('anak tidak melihat bintang anak lain (RLS) dan anak tidak bisa mencatat medali', async () => {
    const a = await newLearner()
    const b = await newLearner()
    await a.run((tx) => grantStars(tx, a.id, 5, 'session', 's1'))
    expect((await b.run((tx) => starTotals(tx, a.id))).balance).toBe(0)
    await expect(a.run((tx) => addMedal(tx, a.id, { title: 'Medali', medal: 'gold', earnedOn: '2026-11-01' }))).rejects.toBeTruthy()
    const parent = (fn: (tx: Tx) => Promise<unknown>) => withOrg(app.db, { orgId, userId: randomUUID(), role: 'tutor' }, fn)
    await parent((tx) => addMedal(tx, a.id, { title: 'OSN tingkat sekolah', medal: 'silver', earnedOn: '2026-11-01' }))
    const medals = await a.run((tx) => medalsOf(tx, a.id))
    expect(medals).toHaveLength(1)
    await parent((tx) => removeMedal(tx, a.id, medals[0]!.id))
    expect(await a.run((tx) => medalsOf(tx, a.id))).toHaveLength(0)
  })
})
