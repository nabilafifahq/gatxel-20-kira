import { afterAll, describe, expect, it } from 'vitest'
import postgres from 'postgres'
import { randomUUID } from 'node:crypto'

/**
 * Pembaruan sumber soal mingguan hanya untuk org bertanda settings.weeklySourcing (migrasi 0015).
 * Butuh DATABASE_URL_OWNER dan DATABASE_URL_WORKER dan migrasi sudah dijalankan.
 */
const owner = process.env.DATABASE_URL_OWNER
const worker = process.env.DATABASE_URL_WORKER
const ready = Boolean(owner && worker)

describe.skipIf(!ready)('kira_list_sourcing_orgs', () => {
  const o = ready ? postgres(owner!, { max: 1, onnotice: () => {} }) : (null as never)
  const w = ready ? postgres(worker!, { max: 1, onnotice: () => {} }) : (null as never)
  const flagged = randomUUID()
  const plain = randomUUID()
  const off = randomUUID()

  afterAll(async () => {
    await o`delete from org where id in (${flagged}, ${plain}, ${off})`
    await Promise.all([o.end(), w.end()])
  })

  it('hanya org bertanda yang ikut, org lain (keluarga baru) tidak', async () => {
    await o`insert into org (id, name, settings) values (${flagged}, 'Keluarga lama __GTX_SEED__', '{"weeklySourcing": true}'::jsonb)`
    await o`insert into org (id, name) values (${plain}, 'Keluarga baru __GTX_SEED__')`
    await o`insert into org (id, name, settings) values (${off}, 'Dimatikan __GTX_SEED__', '{"weeklySourcing": false}'::jsonb)`
    const ids = (await w<{ id: string }[]>`select id from kira_list_sourcing_orgs()`).map((r) => r.id)
    expect(ids).toContain(flagged)
    expect(ids).not.toContain(plain)
    expect(ids).not.toContain(off)
    const all = (await w<{ id: string }[]>`select id from kira_list_orgs()`).map((r) => r.id)
    expect(all).toEqual(expect.arrayContaining([flagged, plain, off]))
  })

  it('role aplikasi tidak boleh memanggil fungsinya', async () => {
    const app = postgres(process.env.DATABASE_URL_APP ?? owner!.replace('kira_owner', 'kira_app'), { max: 1, onnotice: () => {} })
    await expect(app`select id from kira_list_sourcing_orgs()`).rejects.toThrow()
    await app.end()
  })
})
