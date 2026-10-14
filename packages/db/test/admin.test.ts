import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * Perintah admin sourcing-now dan tts-status (packages/db/scripts/admin.ts), dijalankan sungguhan sebagai proses
 * terhadap Postgres. Butuh DATABASE_URL_OWNER dan migrasi sudah dijalankan.
 */
const ready = Boolean(process.env.DATABASE_URL_OWNER)
const root = join(import.meta.dirname, '..', '..', '..')

function admin(cmd: string): { out: string; code: number | null } {
  const r = spawnSync(process.execPath, ['--import', 'tsx', 'packages/db/scripts/admin.ts', cmd], { cwd: root, env: process.env, encoding: 'utf8' })
  return { out: `${r.stdout}${r.stderr}`, code: r.status }
}

describe.skipIf(!ready)('perintah admin', () => {
  const owner = ready ? postgres(process.env.DATABASE_URL_OWNER!, { max: 2, onnotice: () => {} }) : (null as never)
  const orgId = randomUUID()

  beforeAll(async () => {
    await owner`insert into org (id, name) values (${orgId}, 'Org Admin __GTX_SEED__')`
  })
  afterAll(async () => {
    await owner`delete from org where id = ${orgId}`
    await owner.end()
  })

  it('sourcing-now menambah satu job sourcing.run per org dan tidak menggandakannya', async () => {
    const first = admin('sourcing-now')
    expect(first.code).toBe(0)
    expect(first.out).toContain(`Org ${orgId}: job sourcing.run`)
    const second = admin('sourcing-now')
    expect(second.out).toContain(`Org ${orgId}: sudah ada job sourcing.run`)
    const jobs = await owner`select kind, status, payload from job where org_id = ${orgId} and kind = 'sourcing.run'`
    expect(jobs).toHaveLength(1)
    expect(jobs[0]).toMatchObject({ status: 'queued', payload: { scope: 'org' } })
    await owner`update job set status = 'done', finished_at = now() where org_id = ${orgId}`
  })

  it('tts-status menghitung klip jadi dan menunggu dari batch terakhir, mengabaikan batch bercakupan refs', async () => {
    expect(admin('tts-status').out).toContain(`Org ${orgId}: belum ada batch suara yang selesai`)
    await owner`insert into job (org_id, kind, status, payload, result, finished_at) values
      (${orgId}, 'tts.batch', 'done', '{"scope":"all"}', ${owner.json({ total: 10, existing: 4, generated: 3, failed: 1, remaining: 3 })}, now() - interval '1 hour'),
      (${orgId}, 'tts.batch', 'done', ${owner.json({ source: 'weekly-sourcing', refs: ['org:x'] })}, ${owner.json({ total: 2, existing: 2, generated: 0, failed: 0, remaining: 0 })}, now())`
    await owner`insert into job (org_id, kind, status, payload) values (${orgId}, 'tts.clip', 'queued', '{"clips":[]}')`
    const s = admin('tts-status')
    expect(s.code).toBe(0)
    expect(s.out).toContain(`Org ${orgId}: klip jadi 7 dari 10, menunggu 3, gagal 1. Job menunggu 1, berjalan 0.`)
  })

  it('perintah tak dikenal menampilkan daftar perintah', () => {
    const r = admin('apa-ini')
    expect(r.code).toBe(1)
    expect(r.out).toContain('sourcing-now')
    expect(r.out).toContain('tts-status')
  })
})
