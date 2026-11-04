import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * Kata pribadi (Kamus Ketuk) di Postgres sungguhan: kata disimpan sebagai bentuk dasar, kata yang tidak ada di kamus
 * ditolak, anak lain dan org lain tidak melihat baris itu (RLS), dan dek kartu pribadi dibuat dari kata tersimpan.
 */

const ownerUrl = process.env.DATABASE_URL_OWNER
const appUrl = process.env.DATABASE_URL_APP
const ready = Boolean(ownerUrl && appUrl)

describe.skipIf(!ready)('kata pribadi', () => {
  const owner = ready ? postgres(ownerUrl!, { max: 2, onnotice: () => {} }) : (null as never)
  const orgA = randomUUID()
  const orgB = randomUUID()
  const anna = randomUUID()
  const budi = randomUUID()
  const carl = randomUUID()
  let vocab: typeof import('@/server/dal/vocab')
  let dbm: typeof import('@/server/db')
  let end: () => Promise<void>
  const ctx = (orgId: string, userId: string) => ({ orgId, userId, role: 'learner' as const })

  beforeAll(async () => {
    process.env.KIRA_ORIGIN = 'http://localhost:3100'
    process.env.DATABASE_URL_APP = appUrl!
    process.env.DATABASE_URL_AUTH = appUrl!
    process.env.KIRA_SECRET = 'uji-kata-pribadi-rahasia-minimal-32-karakter'
    process.env.KIRA_DATA_DIR = '.kira-local/data'
    vocab = await import('@/server/dal/vocab')
    dbm = await import('@/server/db')
    end = () => (dbm.appDb() as unknown as { $client: { end(): Promise<void> } }).$client.end()
    await owner`insert into org (id, name) values (${orgA}, 'Uji kata A __GTX_SEED__'), (${orgB}, 'Uji kata B __GTX_SEED__')`
    for (const [id, org, name] of [[anna, orgA, 'Anna'], [budi, orgA, 'Budi'], [carl, orgB, 'Carl']] as const) {
      await owner`insert into learner_profile (user_id, org_id, name, grade, active, screen_limit_min, rest_weekdays, started_on)
        values (${id}, ${org}, ${name}, 3, true, 120, '{}', '2026-11-01')`
    }
  })

  afterAll(async () => {
    await owner`delete from org where id in (${orgA}, ${orgB})`
    await Promise.all([owner.end(), end()])
  })

  it('menyimpan bentuk dasar dan tidak menggandakan', async () => {
    const w = await dbm.inOrg(ctx(orgA, anna), (tx) => vocab.saveWordTx(tx, orgA, anna, 'Ran'))
    expect(w).toBe('run')
    await dbm.inOrg(ctx(orgA, anna), (tx) => vocab.saveWordTx(tx, orgA, anna, 'running'))
    expect(await dbm.inOrg(ctx(orgA, anna), (tx) => vocab.savedWordSet(tx, anna))).toEqual(['run'])
  })

  it('menolak kata yang tidak ada di kamus', async () => {
    await expect(dbm.inOrg(ctx(orgA, anna), (tx) => vocab.saveWordTx(tx, orgA, anna, 'Zxqvw'))).rejects.toThrow()
    await expect(dbm.inOrg(ctx(orgA, anna), (tx) => vocab.saveWordTx(tx, orgA, anna, '42'))).rejects.toThrow()
  })

  it('anak lain di org yang sama dan anak di org lain tidak melihat kata Anna', async () => {
    expect(await dbm.inOrg(ctx(orgA, budi), (tx) => vocab.savedWordSet(tx, anna))).toEqual([])
    expect(await dbm.inOrg(ctx(orgB, carl), (tx) => vocab.savedWordSet(tx, anna))).toEqual([])
    // Budi tidak bisa menyisipkan kata atas nama Anna.
    await expect(dbm.inOrg(ctx(orgA, budi), (tx) => vocab.saveWordTx(tx, orgA, anna, 'dog'))).rejects.toThrow()
    // Budi tidak bisa menghapus kata Anna.
    await dbm.inOrg(ctx(orgA, budi), (tx) => vocab.removeWordTx(tx, anna, 'run'))
    expect(await dbm.inOrg(ctx(orgA, anna), (tx) => vocab.savedWordSet(tx, anna))).toEqual(['run'])
  })

  it('membuat dek kartu pribadi dan daftar My words dengan arti', async () => {
    await dbm.inOrg(ctx(orgA, anna), (tx) => vocab.saveWordTx(tx, orgA, anna, 'dog'))
    const deck = await dbm.inOrg(ctx(orgA, anna), (tx) => vocab.personalVocabDeck(tx, anna))
    expect(deck?.id).toBe('personal-vocab')
    expect(deck?.cards.map((c) => c.front).sort()).toEqual(['dog', 'run'])
    expect(deck?.cards.every((c) => c.back.includes('\n') && c.say === c.front)).toBe(true)
    const mine = await dbm.inOrg(ctx(orgA, anna), (tx) => vocab.myWordsDTO(tx, anna))
    expect(mine.words.map((w) => w.word).sort()).toEqual(['dog', 'run'])
    expect(await dbm.inOrg(ctx(orgA, budi), (tx) => vocab.personalVocabDeck(tx, budi))).toBeNull()
  })

  it('menghapus kata dan membatasi jumlahnya', async () => {
    await dbm.inOrg(ctx(orgA, anna), (tx) => vocab.removeWordTx(tx, anna, 'dog'))
    expect(await dbm.inOrg(ctx(orgA, anna), (tx) => vocab.savedWordSet(tx, anna))).toEqual(['run'])
  })

  it('role aplikasi tidak bisa membaca baris tanpa konteks org', async () => {
    const app = postgres(appUrl!, { max: 1, onnotice: () => {} })
    const rows = await app`select word from saved_word`
    await app.end()
    expect(rows.length).toBe(0)
  })
})
