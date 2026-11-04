import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Item } from '@kira/content'
import { createDb, withOrg, type Db, type OrgContext, type Tx } from '@kira/db/client'

/**
 * Tes penempatan di Postgres sungguhan: anak lama tidak ditanya, anak baru dapat tes siap per mapel, tes adaptif berhenti
 * di 8 sampai 12 soal tanpa soal ganda, skill_state terisi di bawah tingkat tanpa menimpa jawaban asli, titik awal sesi
 * harian bergeser, tes ulang hanya sebulan sekali, dan RLS: orang tua hanya melihat anaknya dan tidak bisa mengubah hasil.
 */

const ownerUrl = process.env.DATABASE_URL_OWNER
const appUrl = process.env.DATABASE_URL_APP
const ready = Boolean(ownerUrl && appUrl)

describe.skipIf(!ready)('tes penempatan', () => {
  const owner = ready ? postgres(ownerUrl!, { max: 2, onnotice: () => {} }) : (null as never)
  const app = ready ? createDb(appUrl!, { name: 'placement', max: 4 }) : (null as never)
  const orgId = randomUUID()
  const orgB = randomUUID()
  const oldId = randomUUID()
  const newId = randomUUID()
  const otherId = randomUUID()
  const guardianId = randomUUID()
  const strangerId = randomUUID()
  const lctx = (id: string): OrgContext => ({ orgId, userId: id, role: 'learner' })
  const gctx = (id: string, org = orgId): OrgContext => ({ orgId: org, userId: id, role: 'guardian' })
  let db: Db
  let p: typeof import('@/server/dal/placement')
  let content: typeof import('@/server/dal/content')
  let pgrade: typeof import('@/server/dal/placement-grade')

  const as = <T>(ctx: OrgContext, fn: (tx: Tx) => Promise<T>) => withOrg(db, ctx, fn)

  function correct(item: Item): unknown {
    switch (item.type) {
      case 'mcq':
        return { choice: item.answer }
      case 'numeric':
        return { value: String(item.answer) }
      case 'tiles':
        return { words: item.answer.split(/\s+/) }
      case 'spell':
        return { value: item.word }
      case 'cloze':
        return { texts: item.gaps.map((g) => g.options[g.answer]) }
      case 'hotspot':
        return { texts: item.answers.map((i) => item.regions[i]!.label) }
      case 'label':
        return { texts: item.labels }
      case 'table':
        return { texts: item.blanks.map((b) => b.answers[0]) }
      case 'grid':
        return { cells: item.filled.flat() }
      default:
        return undefined
    }
  }

  /** Jalankan satu tes sampai selesai. `good`: jawab benar bila bisa; selain itu pilih "belum tahu". */
  async function play(learnerId: string, subject: string, good: boolean) {
    const refs: string[] = []
    let entry = await as(lctx(learnerId), (tx) => p.placementEntry(tx, lctx(learnerId), learnerId, subject))
    for (let i = 0; i < 20; i++) {
      if (entry.kind !== 'step') throw new Error(`bukan soal: ${entry.kind}`)
      const step = entry.step
      refs.push(step.item.ref)
      const item = (await as(lctx(learnerId), (tx) => content.resolveItems(tx, [step.item.ref]))).get(step.item.ref)!
      const ans = good ? correct(item) : undefined
      const r = await as(lctx(learnerId), (tx) => p.answerPlacement(tx, lctx(learnerId), learnerId, { runId: step.runId, ref: step.item.ref, ...(ans === undefined ? { unsure: true } : { answer: ans, unsure: false }) }))
      if (r.done) return { refs }
      entry = { kind: 'step', step: r.step, first: false }
    }
    throw new Error('tes tidak berhenti')
  }

  beforeAll(async () => {
    process.env.KIRA_ORIGIN = 'http://localhost:3100'
    process.env.DATABASE_URL_APP = appUrl!
    process.env.DATABASE_URL_AUTH = appUrl!
    process.env.KIRA_SECRET = 'uji-tes-penempatan-rahasia-minimal-32-karakter'
    process.env.KIRA_DATA_DIR = '.kira-local/data'
    db = app.db
    p = await import('@/server/dal/placement')
    content = await import('@/server/dal/content')
    pgrade = await import('@/server/dal/placement-grade')
    await owner`insert into org (id, name) values (${orgId}, 'Uji penempatan __GTX_SEED__'), (${orgB}, 'Uji penempatan B __GTX_SEED__')`
    await owner`insert into member_profile (user_id, org_id, name, role, email) values
      (${guardianId}, ${orgId}, 'Ibu uji', 'guardian', 'ibu-penempatan@example.test'),
      (${strangerId}, ${orgB}, 'Ibu lain', 'guardian', 'lain-penempatan@example.test')`
    await owner`insert into learner_profile (user_id, org_id, name, grade, active, created_at) values
      (${oldId}, ${orgId}, 'Anak lama', 4, true, '2026-01-10T00:00:00Z'),
      (${newId}, ${orgId}, 'Anak baru', 3, true, '2026-12-01T00:00:00Z'),
      (${otherId}, ${orgId}, 'Anak lain', 3, true, '2026-12-01T00:00:00Z')`
    await owner`insert into guardian_link (guardian_id, learner_id, org_id) values (${guardianId}, ${newId}, ${orgId})`
  })

  afterAll(async () => {
    await owner`delete from org where id in (${orgId}, ${orgB})`
    await Promise.all([owner.end(), app.client.end()])
  })

  it('bank soal: tiap mapel punya soal otomatis di kelas 1 sampai 6, tanpa ref ganda', () => {
    for (const subject of ['math', 'english', 'science'] as const) {
      const c = p.candidatesFor(subject)
      const byGrade = new Map<number, number>()
      for (const x of c) byGrade.set(x.grade, (byGrade.get(x.grade) ?? 0) + 1)
      for (let g = 1; g <= 6; g++) expect(byGrade.get(g) ?? 0, subject + ' kelas ' + g).toBeGreaterThanOrEqual(10)
      expect(new Set(c.map((x) => x.ref)).size).toBe(c.length)
    }
  })

  it('anak lama tidak ditanya otomatis dan tidak mendapat baris', async () => {
    const card = await as(lctx(oldId), (tx) => p.placementCard(tx, lctx(oldId), oldId))
    expect(card).toBeNull()
    const [{ n }] = (await owner`select count(*)::int as n from placement_run where learner_id = ${oldId}`) as unknown as [{ n: number }]
    expect(n).toBe(0)
  })

  it('anak baru mendapat satu tes siap per mapel, tanpa ganda', async () => {
    const card = await as(lctx(newId), (tx) => p.placementCard(tx, lctx(newId), newId))
    expect(card?.subjects.map((s) => s.subject)).toEqual(['math', 'english', 'science'])
    await as(lctx(newId), (tx) => p.placementCard(tx, lctx(newId), newId))
    const [{ n }] = (await owner`select count(*)::int as n from placement_run where learner_id = ${newId}`) as unknown as [{ n: number }]
    expect(n).toBe(3)
  })

  it('anak baru yang sudah punya jawaban asli tidak ditanya otomatis', async () => {
    await owner`insert into skill_state (org_id, learner_id, skill_id, n_answers, gate) values (${orgId}, ${otherId}, 'm3.addition-subtraction-3-digit', 12, 'review')`
    const card = await as(lctx(otherId), (tx) => p.placementCard(tx, lctx(otherId), otherId))
    expect(card).toBeNull()
  })

  it('tes adaptif Math: 8 sampai 12 soal, tanpa soal ganda, hanya soal otomatis', async () => {
    const { refs } = await play(newId, 'math', true)
    expect(refs.length).toBeGreaterThanOrEqual(8)
    expect(refs.length).toBeLessThanOrEqual(12)
    expect(new Set(refs).size).toBe(refs.length)
    const [run] = await owner`select status, result, answers, current from placement_run where learner_id = ${newId} and subject = 'math'`
    expect(run!.status).toBe('done')
    expect(run!.current).toBeNull()
    for (const ref of refs) {
      const it = (await as(lctx(newId), (tx) => content.resolveItems(tx, [ref]))).get(ref)!
      expect(['write', 'speak', 'draw', 'photo', 'listen', 'story']).not.toContain(it.type)
    }
    const result = run!.result as { level: number; groups: { id: string }[] }
    // Anak yang menjawab benar naik dari kelas 3.
    expect(result.level).toBeGreaterThanOrEqual(4)
    expect(result.groups.map((g) => g.id)).toEqual(['num', 'geo', 'data'])
  })

  it('skill di bawah tingkat ditandai, skill di tingkat itu dan di atasnya tetap baru', async () => {
    const [{ level }] = (await owner`select (result->>'level')::int as level from placement_run where learner_id = ${newId} and subject = 'math'`) as unknown as [{ level: number }]
    const rows = await owner`select skill_id, gate, n_answers from skill_state where learner_id = ${newId}`
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) {
      const grade = Number(String(r.skill_id).slice(1, 2))
      expect(grade).toBeLessThan(level)
      expect(['review', 'mastered']).toContain(r.gate)
      expect(r.n_answers).toBe(0)
    }
  })

  it('titik awal sesi harian bergeser ke tingkat hasil, dibatasi dekat kelas anak', async () => {
    const g = await as(lctx(newId), (tx) => pgrade.placementStartGrade(tx, { userId: newId, grade: 3 }, 'math'))
    expect(g).toBeGreaterThanOrEqual(3)
    expect(g).toBeLessThanOrEqual(4)
    const none = await as(lctx(newId), (tx) => pgrade.placementStartGrade(tx, { userId: newId, grade: 3 }, 'english'))
    expect(none).toBe(3)
  })

  it('soal tes penempatan dihitung sudah dilihat', async () => {
    const core = await import('@/server/dal/learner-core')
    const seen = await as(lctx(newId), (tx) => core.recentSeen(tx, newId))
    const [run] = await owner`select answers from placement_run where learner_id = ${newId} and subject = 'math'`
    for (const a of run!.answers as { ref: string }[]) expect(seen.has(a.ref)).toBe(true)
  })

  it('lewati, siapkan lagi oleh orang tua, dan tes ulang hanya sebulan sekali', async () => {
    await as(lctx(newId), (tx) => p.skipPlacement(tx, newId, 'english'))
    const [e] = await owner`select status from placement_run where learner_id = ${newId} and subject = 'english'`
    expect(e!.status).toBe('skipped')
    const view = await as(gctx(guardianId), (tx) => p.parentPlacement(tx, { userId: newId, grade: 3, name: 'Anak baru' } as never))
    const english = view.subjects.find((s) => s.subject === 'english')!
    expect(english.state).toBe('dilewati')
    expect(english.canRequest).toBe(true)
    await as(gctx(guardianId), (tx) => p.requestPlacement(tx, gctx(guardianId), newId, 'english'))
    const [e2] = await owner`select status, origin from placement_run where learner_id = ${newId} and subject = 'english' and status = 'ready'`
    expect(e2!.origin).toBe('parent')
    await expect(as(gctx(guardianId), (tx) => p.requestPlacement(tx, gctx(guardianId), newId, 'english'))).rejects.toThrow()
    // Math selesai baru saja: tes ulang ditolak dengan tanggal.
    await expect(as(gctx(guardianId), (tx) => p.requestPlacement(tx, gctx(guardianId), newId, 'math'))).rejects.toThrow(/mulai/)
    // Sebulan lebih kemudian: boleh.
    await owner`update placement_run set finished_at = now() - interval '31 days' where learner_id = ${newId} and subject = 'math' and status = 'done'`
    await as(gctx(guardianId), (tx) => p.requestPlacement(tx, gctx(guardianId), newId, 'math'))
    const [n] = await owner`select count(*)::int as n from placement_run where learner_id = ${newId} and subject = 'math' and status = 'ready'`
    expect(n!.n).toBe(1)
  })

  it('tes ulang tidak menimpa jawaban asli dan membersihkan penandaan lama', async () => {
    const skillId = (await owner`select skill_id from skill_state where learner_id = ${newId} limit 1`)[0]!.skill_id as string
    await owner`update skill_state set n_answers = 15, gate = 'reteach' where learner_id = ${newId} and skill_id = ${skillId}`
    await play(newId, 'math', false)
    const [row] = await owner`select n_answers, gate from skill_state where learner_id = ${newId} and skill_id = ${skillId}`
    expect(row!.n_answers).toBe(15)
    expect(row!.gate).toBe('reteach')
    // Anak yang memilih "belum tahu" terus jatuh ke kelas rendah: penandaan mastered dari tes pertama hilang.
    const stale = await owner`select count(*)::int as n from skill_state where learner_id = ${newId} and gate = 'mastered' and n_answers = 0`
    expect(stale[0]!.n).toBeLessThanOrEqual(1)
  })

  it('English dan Science juga selesai dalam 8 sampai 12 soal, anak lama hanya bila tutor memulai', async () => {
    for (const subject of ['english', 'science']) {
      await owner`insert into placement_run (org_id, learner_id, subject, origin, start_grade, theta) values (${orgId}, ${oldId}, ${subject}, 'tutor', 4, 0.3)`
      const { refs } = await play(oldId, subject, true)
      expect(refs.length).toBeGreaterThanOrEqual(8)
      expect(refs.length).toBeLessThanOrEqual(12)
      expect(new Set(refs).size).toBe(refs.length)
    }
  })

  it('RLS: orang tua lain tidak melihat tes anak ini dan orang tua tidak bisa mengubah baris', async () => {
    const stranger = await as(gctx(strangerId, orgB), (tx) => tx.execute('select id from placement_run'))
    expect([...(stranger as unknown as Iterable<unknown>)]).toHaveLength(0)
    const mine = await as(gctx(guardianId), (tx) => tx.execute(`select id from placement_run where learner_id = '${newId}'`))
    expect([...(mine as unknown as Iterable<unknown>)].length).toBeGreaterThan(0)
    const upd = await as(gctx(guardianId), (tx) => tx.execute(`update placement_run set status = 'done' where learner_id = '${newId}' returning id`))
    expect([...(upd as unknown as Iterable<unknown>)]).toHaveLength(0)
    const other = await as(gctx(guardianId), (tx) => tx.execute(`select id from placement_run where learner_id = '${otherId}'`))
    expect([...(other as unknown as Iterable<unknown>)]).toHaveLength(0)
  })
})
