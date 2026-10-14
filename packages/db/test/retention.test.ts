import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import postgres from 'postgres'
import { randomUUID } from 'node:crypto'

/**
 * Tes fungsi kira_retention() (migrations/0002_retention.sql) di Postgres sungguhan.
 * Butuh DATABASE_URL_OWNER, DATABASE_URL_APP, DATABASE_URL_WORKER dan migrasi sudah dijalankan.
 * Semua baris contoh memakai org __GTX_SEED__ sendiri dan dihapus lagi di afterAll.
 */

const urls = {
  owner: process.env.DATABASE_URL_OWNER,
  app: process.env.DATABASE_URL_APP,
  worker: process.env.DATABASE_URL_WORKER,
}
const ready = Object.values(urls).every(Boolean)
const conn = (u: string | undefined) => postgres(u!, { max: 2, onnotice: () => {} })

describe.skipIf(!ready)('kira_retention', () => {
  const owner = ready ? conn(urls.owner) : (null as never)
  const app = ready ? conn(urls.app) : (null as never)
  const worker = ready ? conn(urls.worker) : (null as never)

  const org = randomUUID()
  const tutor = randomUUID()
  const goneAdult = randomUUID()
  const recentlyRemoved = randomUUID()
  const learner = randomUUID()
  const tag = `retensi-${org}`
  const path = (name: string) => `${org}/2026-01/${name}`
  const id = {
    oldAudio: randomUUID(),
    newAudio: randomUUID(),
    oldPage: randomUUID(),
    expiredPdf: randomUUID(),
    oldTutorImage: randomUUID(),
  }

  beforeAll(async () => {
    await owner`insert into org (id, name) values (${org}, 'Org retensi __GTX_SEED__')`
    await owner`insert into auth.user_account (id, org_id, kind, role, email, name) values
      (${tutor}, ${org}, 'adult', 'tutor', ${`tutor-${org}@example.test`}, 'Tutor R'),
      (${goneAdult}, ${org}, 'adult', 'guardian', ${`lama-${org}@example.test`}, 'Wali lama'),
      (${recentlyRemoved}, ${org}, 'adult', 'guardian', ${`baru-${org}@example.test`}, 'Wali baru'),
      (${learner}, ${org}, 'learner', 'learner', null, 'Anak R')`
    await owner`insert into member_profile (user_id, org_id, name, role, email, removed_at) values
      (${tutor}, ${org}, 'Tutor R', 'tutor', ${`tutor-${org}@example.test`}, null),
      (${goneAdult}, ${org}, 'Wali lama', 'guardian', ${`lama-${org}@example.test`}, now() - interval '40 days'),
      (${recentlyRemoved}, ${org}, 'Wali baru', 'guardian', ${`baru-${org}@example.test`}, now() - interval '10 days')`
    await owner`insert into learner_profile (user_id, org_id, name, grade, active) values (${learner}, ${org}, 'Anak R', 2, true)`

    await owner`insert into auth.login_attempt (key, success, at) values
      (${`${tag}:lama`}, false, now() - interval '31 days'), (${`${tag}:baru`}, false, now() - interval '1 day')`
    await owner`insert into auth.session (id, user_id, org_id, kind, expires_at, revoked_at) values
      (${`${tag}:kedaluwarsa`}, ${tutor}, ${org}, 'adult', now() - interval '8 days', null),
      (${`${tag}:dicabut`}, ${tutor}, ${org}, 'adult', now() + interval '1 day', now() - interval '8 days'),
      (${`${tag}:dicabut-baru`}, ${tutor}, ${org}, 'adult', now() + interval '1 day', now() - interval '1 day'),
      (${`${tag}:aktif`}, ${tutor}, ${org}, 'adult', now() + interval '1 day', null)`
    await owner`insert into auth.reset_token (user_id, token_hash, expires_at, used_at) values
      (${tutor}, ${`${tag}:dipakai`}, now() + interval '1 hour', now() - interval '2 days'),
      (${tutor}, ${`${tag}:kedaluwarsa`}, now() - interval '2 days', null),
      (${tutor}, ${`${tag}:berlaku`}, now() + interval '1 hour', null)`
    await owner`insert into auth.webauthn_challenge (challenge, purpose, expires_at) values
      (${`${tag}:lama`}, 'login', now() - interval '1 minute'), (${`${tag}:baru`}, 'login', now() + interval '5 minutes')`
    await owner`insert into auth.invite (org_id, email, role, token_hash, invited_by, expires_at) values
      (${org}, 'a@example.test', 'guardian', ${`${tag}:lama`}, ${tutor}, now() - interval '31 days'),
      (${org}, 'b@example.test', 'guardian', ${`${tag}:baru`}, ${tutor}, now() - interval '5 days')`
    await owner`insert into audit_log (org_id, actor_kind, action, created_at) values
      (${org}, 'system', 'tes.lama', now() - interval '13 months'), (${org}, 'system', 'tes.baru', now())`
    await owner`insert into outbox_email (org_id, to_addr, subject, html, text, kind, created_at) values
      (${org}, 'x@example.test', 'lama', '<p>x</p>', 'x', 'tes', now() - interval '91 days'),
      (${org}, 'x@example.test', 'baru', '<p>x</p>', 'x', 'tes', now())`
    await owner`insert into job (org_id, kind, status, created_at, finished_at) values
      (${org}, 'tes.done-lama', 'done', now() - interval '40 days', now() - interval '31 days'),
      (${org}, 'tes.failed-lama', 'failed', now() - interval '40 days', now() - interval '31 days'),
      (${org}, 'tes.queued-lama', 'queued', now() - interval '40 days', null),
      (${org}, 'tes.done-baru', 'done', now() - interval '2 days', now() - interval '1 day')`
    await owner`insert into media (id, org_id, learner_id, kind, path, mime, size, sha256, created_by, created_at, expires_at) values
      (${id.oldAudio}, ${org}, ${learner}, 'audio', ${path('lama.webm')}, 'audio/webm', 10, 'x', ${tutor}, now() - interval '91 days', null),
      (${id.newAudio}, ${org}, ${learner}, 'audio', ${path('baru.webm')}, 'audio/webm', 10, 'x', ${tutor}, now() - interval '10 days', null),
      (${id.oldPage}, ${org}, null, 'page', ${path('halaman.png')}, 'image/png', 10, 'x', ${tutor}, now() - interval '100 days', null),
      (${id.expiredPdf}, ${org}, null, 'pdf', ${path('paket.pdf')}, 'application/pdf', 10, 'x', ${tutor}, now() - interval '1 day', now() - interval '1 minute'),
      (${id.oldTutorImage}, ${org}, null, 'image', ${path('tutor.png')}, 'image/png', 10, 'x', ${tutor}, now() - interval '100 days', null)`
    // Ronde arena: yang lebih tua dari 90 hari diringkas ke arena_state.rolled lalu dihapus, yang baru tetap.
    await owner`insert into arena_session (org_id, learner_id, arena, mode, seed, config, date, started_at, finished_at, total, answered, correct, duration_ms, ppm) values
      (${org}, ${learner}, 'hitung', 'sprint60', 's1', '{}', current_date - 100, now() - interval '100 days', now() - interval '100 days', 20, 20, 20, 60000, 20),
      (${org}, ${learner}, 'hitung', 'sprint60', 's2', '{}', current_date - 95, now() - interval '95 days', now() - interval '95 days', 20, 12, 10, 60000, 10),
      (${org}, ${learner}, 'hitung', 'sprint60', 's3', '{}', current_date - 5, now() - interval '5 days', now() - interval '5 days', 20, 12, 12, 60000, 12)`
    await owner`insert into arena_state (org_id, learner_id, arena, data) values (${org}, ${learner}, 'hitung', '{"x":1}')`
  })

  afterAll(async () => {
    await owner`delete from auth.login_attempt where key like ${`${tag}:%`}`
    await owner`delete from auth.webauthn_challenge where challenge like ${`${tag}:%`}`
    await owner`delete from auth.invite where org_id = ${org}`
    await owner`delete from auth.session where org_id = ${org}`
    await owner`delete from auth.user_account where org_id = ${org}`
    await owner`delete from org where id = ${org}`
    await Promise.all([owner.end(), app.end(), worker.end()])
  })

  it('kira_app tidak bisa memanggil kira_retention', async () => {
    await expect(app`select * from kira_retention()`).rejects.toThrow(/permission denied/)
  })

  it('worker menghapus data lama dan menerima path media yang dihapus', async () => {
    const rows = await worker<{ path: string }[]>`select path from kira_retention()`
    const paths = rows.map((r) => r.path).filter((p) => p.startsWith(`${org}/`)).sort()
    expect(paths).toEqual([path('lama.webm'), path('paket.pdf')].sort())

    const media = await owner<{ id: string }[]>`select id from media where org_id = ${org}`
    expect(media.map((m) => m.id).sort()).toEqual([id.newAudio, id.oldPage, id.oldTutorImage].sort())

    const count = async (q: Promise<{ n: number }[]>) => (await q)[0]!.n
    expect(await count(owner`select count(*)::int as n from auth.login_attempt where key like ${`${tag}:%`}`)).toBe(1)
    expect((await owner`select id from auth.session where org_id = ${org} order by id`).map((r) => r.id)).toEqual([`${tag}:aktif`, `${tag}:dicabut-baru`])
    expect((await owner`select token_hash from auth.reset_token where token_hash like ${`${tag}:%`}`).map((r) => r.token_hash)).toEqual([`${tag}:berlaku`])
    expect((await owner`select challenge from auth.webauthn_challenge where challenge like ${`${tag}:%`}`).map((r) => r.challenge)).toEqual([`${tag}:baru`])
    expect((await owner`select token_hash from auth.invite where org_id = ${org}`).map((r) => r.token_hash)).toEqual([`${tag}:baru`])
    expect((await owner`select action from audit_log where org_id = ${org} and action like 'tes.%'`).map((r) => r.action)).toEqual(['tes.baru'])
    expect((await owner`select subject from outbox_email where org_id = ${org}`).map((r) => r.subject)).toEqual(['baru'])
    expect((await owner`select kind from job where org_id = ${org} order by kind`).map((r) => r.kind)).toEqual(['tes.done-baru', 'tes.queued-lama'])
    expect((await owner`select user_id from member_profile where org_id = ${org} order by name`).map((r) => r.user_id).sort()).toEqual([tutor, recentlyRemoved].sort())
    expect((await owner`select id from auth.user_account where org_id = ${org}`).map((r) => r.id).sort()).toEqual([tutor, recentlyRemoved, learner].sort())
  })

  it('ronde arena lebih dari 90 hari diringkas ke arena_state.rolled lalu dihapus', async () => {
    const left = await owner`select seed from arena_session where learner_id = ${learner} order by seed`
    expect(left.map((r) => r.seed)).toEqual(['s3'])
    const [st] = await owner`select data, rolled from arena_state where learner_id = ${learner} and arena = 'hitung'`
    expect(st!.data).toEqual({ x: 1 })
    expect(st!.rolled).toEqual({ rounds: 2, bestSprintPpm: 20, perfectSprint: true, speedBest: 0, perfectQuiz: false })
  })

  it('panggilan kedua tidak menghapus apa pun lagi', async () => {
    const rows = await worker<{ path: string }[]>`select path from kira_retention()`
    expect(rows.filter((r) => r.path.startsWith(`${org}/`))).toEqual([])
  })
})
