import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import postgres from 'postgres'
import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { createDb, withOrg, type Tx } from '@kira/db/client'
import { jakartaDate } from '@kira/core'
import {
  assertChestOwned,
  chestDTO,
  collectionDTO,
  openChestTx,
  soundPolicyOf,
  updateLearnerSoundTx,
} from '@/server/dal/learner-motion'

/**
 * Tes peti hadiah harian di Postgres sungguhan (migrasi 0010): satu peti per hari, syarat semua sesi
 * wajib selesai, RLS antar learner, dan pilihan suara dari tutor.
 */

const urls = { owner: process.env.DATABASE_URL_OWNER, app: process.env.DATABASE_URL_APP }
const ready = Boolean(urls.owner && urls.app)

const allDone = { variant: 'all-done' as const, progress: { done: 3, total: 3, extraDone: 0, extraTotal: 0 } }
const notDone = { variant: 'normal' as const, progress: { done: 1, total: 3, extraDone: 0, extraTotal: 0 } }
const rest = { variant: 'rest-day' as const, progress: { done: 0, total: 0, extraDone: 0, extraTotal: 0 } }

describe.skipIf(!ready)('peti hadiah harian (Postgres)', () => {
  const owner = ready ? postgres(urls.owner!, { max: 2, onnotice: () => {} }) : (null as never)
  const app = ready ? createDb(urls.app, { name: 'chest-test', max: 4 }) : (null as never)
  const orgId = randomUUID()
  const today = jakartaDate()

  async function newLearner() {
    const id = randomUUID()
    await owner`insert into learner_profile (user_id, org_id, name, grade, active) values (${id}, ${orgId}, 'Anak Tes __GTX_SEED__', 2, true)`
    const ctx = { orgId, userId: id, role: 'learner' as const }
    return { id, ctx, run: <T>(fn: (tx: Tx) => Promise<T>) => withOrg(app.db, ctx, fn) }
  }

  beforeAll(async () => {
    await owner`insert into org (id, name) values (${orgId}, 'Org Peti __GTX_SEED__')`
  })

  afterAll(async () => {
    await owner`delete from org where id = ${orgId}`
    await Promise.all([owner.end(), app.client.end()])
  })

  it('peti terkunci sebelum semua sesi wajib selesai, dan tidak ada di hari istirahat', async () => {
    const l = await newLearner()
    await expect(l.run((tx) => openChestTx(tx, orgId, l.id, notDone))).rejects.toMatchObject({
      code: 'forbidden',
    })
    await expect(l.run((tx) => openChestTx(tx, orgId, l.id, rest))).rejects.toMatchObject({
      code: 'forbidden',
    })
    expect((await l.run((tx) => chestDTO(tx, l.id, notDone)))?.state).toBe('locked')
    expect(await l.run((tx) => chestDTO(tx, l.id, rest))).toBeNull()
  })

  it('satu peti per hari: membuka kedua kalinya ditolak dan hadiah tetap sama', async () => {
    const l = await newLearner()
    expect((await l.run((tx) => chestDTO(tx, l.id, allDone)))?.state).toBe('ready')
    const reward = await l.run((tx) => openChestTx(tx, orgId, l.id, allDone))
    expect(reward.isNew).toBe(true)
    await expect(l.run((tx) => openChestTx(tx, orgId, l.id, allDone))).rejects.toMatchObject({
      code: 'conflict',
    })
    const after = await l.run((tx) => chestDTO(tx, l.id, allDone))
    expect(after?.state).toBe('opened')
    expect(after?.reward).toMatchObject({ kind: reward.kind, id: reward.id })
    const rows =
      await owner`select count(*)::int as n from daily_chest where learner_id = ${l.id} and date = ${today}`
    expect(rows[0]!.n).toBe(1)
  })

  it('hadiah yang didapat masuk koleksi, yang belum didapat tidak boleh dipakai', async () => {
    const l = await newLearner()
    const reward = await l.run((tx) => openChestTx(tx, orgId, l.id, allDone))
    await l.run((tx) => assertChestOwned(tx, l.id, reward.kind, reward.id))
    const other = reward.kind === 'sticker' ? 'background' : 'sticker'
    await expect(l.run((tx) => assertChestOwned(tx, l.id, other, 'tidak-ada'))).rejects.toMatchObject({
      code: 'forbidden',
    })
    const col = await l.run((tx) => collectionDTO(tx, l.id))
    const owned = [...col.stickers, ...col.backgrounds, ...col.accessories].filter((x) => x.owned)
    expect(owned).toHaveLength(1)
  })

  it('learner lain tidak bisa melihat atau menulis peti anak lain (RLS)', async () => {
    const a = await newLearner()
    const b = await newLearner()
    await a.run((tx) => openChestTx(tx, orgId, a.id, allDone))
    const seen = await b.run((tx) => tx.execute(sql`select learner_id from daily_chest`))
    expect(JSON.stringify(seen)).not.toContain(a.id)
    await expect(
      b.run((tx) =>
        tx.execute(
          sql`insert into daily_chest (org_id, learner_id, date, reward_kind, reward_id) values (${orgId}, ${a.id}, '2020-01-01', 'sticker', 'cake')`,
        ),
      ),
    ).rejects.toThrow()
  })

  it('pilihan suara dari tutor: bawaan hidup, bisa dimatikan', async () => {
    const l = await newLearner()
    expect(await l.run((tx) => soundPolicyOf(tx, l.id))).toEqual({ sfx: true, music: true })
    const tutor = withOrg(app.db, { orgId, userId: randomUUID(), role: 'tutor' }, (tx) =>
      updateLearnerSoundTx(tx, l.id, { soundEnabled: false, musicEnabled: false }),
    )
    await tutor
    expect(await l.run((tx) => soundPolicyOf(tx, l.id))).toEqual({ sfx: false, music: false })
  })
})
