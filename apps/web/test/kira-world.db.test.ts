import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import postgres from 'postgres'
import { randomUUID } from 'node:crypto'
import { createDb, withOrg, type Tx } from '@kira/db/client'
import { BOSS_WIN_STARS } from '@kira/core'
import { addMedal, applyLook, buyItem, choosePet, equipItem, finishBoss, grantStars, medalsOf, removeMedal, spendStars, starTotals, treatPet } from '@/server/dal/kira-world'

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
    expect(win).toMatchObject({ won: true, stars: BOSS_WIN_STARS, cardId: 'rb-robot' })
    const again = await l.run((tx) => finishBoss(tx, l.id, randomUUID(), 'boss:2026-11-02:3', 10))
    expect(again).toEqual({ won: true, stars: 0, cardId: null })
    const next = await l.run((tx) => finishBoss(tx, l.id, randomUUID(), 'boss:2026-11-09:1', 10))
    expect(next.cardId).toBe('rb-comet')
    expect((await l.run((tx) => starTotals(tx, l.id))).balance).toBe(BOSS_WIN_STARS * 2)
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
