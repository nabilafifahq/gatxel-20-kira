import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { recommendationFor } from '@kira/core/recommendation'
import type { Actor } from '@/server/auth/actor'

/**
 * Jalur onboarding di Postgres sungguhan: jalur rekomendasi dan atur sendiri lewat DAL dan RLS, anak keluarga lain ditolak,
 * daftar langkah orang tua hilang setelah selesai, dan tips pertama anak hanya sekali.
 * Butuh DATABASE_URL_OWNER, DATABASE_URL_APP, DATABASE_URL_AUTH dan migrasi sudah dijalankan.
 */
const ownerUrl = process.env.DATABASE_URL_OWNER
const ready = Boolean(ownerUrl && process.env.DATABASE_URL_APP && process.env.DATABASE_URL_AUTH)
const PIN = ['sun', 'moon', 'star', 'cat'] as const

describe.skipIf(!ready)('jalur onboarding', () => {
  const owner = ready ? postgres(ownerUrl!, { max: 2, onnotice: () => {} }) : (null as never)
  let onboarding: typeof import('@/server/dal/onboarding')
  let entry: typeof import('@/server/dal/learner-entry')
  let dbm: typeof import('@/server/db')
  const orgs: string[] = []

  async function family(name: string, seat = true): Promise<Actor> {
    const orgId = randomUUID()
    const userId = randomUUID()
    const email = `${name}-${userId.slice(0, 8)}@contoh.test`
    orgs.push(orgId)
    await owner`insert into org (id, name) values (${orgId}, ${`Keluarga ${name}`})`
    await owner`insert into auth.user_account (id, org_id, kind, role, email, name) values (${userId}, ${orgId}, 'adult', 'guardian', ${email}, ${name})`
    await owner`insert into member_profile (user_id, org_id, name, role, email) values (${userId}, ${orgId}, ${name}, 'guardian', ${email})`
    if (seat) await owner`insert into auth.beta_seat (org_id, user_id, email_norm) values (${orgId}, ${userId}, ${email})`
    return { userId, orgId, role: 'guardian', name, email } as unknown as Actor
  }

  const offKeys = async (learnerId: string) => (await owner`select key from learner_feature where learner_id = ${learnerId} and enabled = false`).map((r) => r.key as string).sort()
  const pathOf = async (learnerId: string) => (await owner`select setup_path from learner_profile where user_id = ${learnerId}`)[0]!.setup_path as string | null

  beforeAll(async () => {
    process.env.KIRA_SECRET ??= 'tes-rahasia-minimal-32-karakter-xxxxxxxx'
    process.env.KIRA_ORIGIN ??= 'http://localhost:3000'
    process.env.KIRA_DATA_DIR ??= '.kira-local/data'
    onboarding = await import('@/server/dal/onboarding')
    entry = await import('@/server/dal/learner-entry')
    dbm = await import('@/server/db')
  })

  afterAll(async () => {
    for (const id of orgs) {
      await owner`delete from auth.beta_seat where org_id = ${id}`
      await owner`delete from auth.user_account where org_id = ${id}`
      await owner`delete from org where id = ${id}`
    }
    await owner.end()
  })

  it('anak baru langsung memakai isi rekomendasi, sebelum orang tua memilih apa pun', async () => {
    const a = await family('Baru')
    const kid = await onboarding.addChild(a, { name: 'Sari', grade: 2, avatar: 'fox', pin: [...PIN] })
    expect(await pathOf(kid)).toBeNull()
    expect(await offKeys(kid)).toEqual([...recommendationFor(2).off].sort())
  })

  it('rekomendasi dan lewati menyimpan isi yang sama, dengan catatan jalur yang berbeda', async () => {
    const a = await family('Dua')
    const one = await onboarding.addChild(a, { name: 'Rani', grade: 5, avatar: 'cat', pin: [...PIN] })
    const two = await onboarding.addChild(a, { name: 'Rudi', grade: 1, avatar: 'owl', pin: [...PIN] })
    await onboarding.applyRecommendedPath(a, { mode: 'recommended', learnerIds: [one] })
    await onboarding.applyRecommendedPath(a, { mode: 'skipped', learnerIds: [two] })
    expect(await pathOf(one)).toBe('recommended')
    expect(await pathOf(two)).toBe('skipped')
    expect(await offKeys(one)).toEqual([...recommendationFor(5).off].sort())
    expect(await offKeys(two)).toEqual([...recommendationFor(1).off].sort())
    const state = await onboarding.onboardingState(a)
    expect(state.children.map((c) => c.setupPath).sort()).toEqual(['recommended', 'skipped'])
  })

  it('anak keluarga lain ditolak, dan tidak berubah', async () => {
    const a = await family('Satu')
    const b = await family('Lain')
    const theirs = await onboarding.addChild(b, { name: 'Tono', grade: 3, avatar: 'fox', pin: [...PIN] })
    await expect(onboarding.applyRecommendedPath(a, { mode: 'recommended', learnerIds: [theirs] })).rejects.toThrow()
    await expect(onboarding.markCustomPath(a, theirs)).rejects.toThrow()
    expect(await pathOf(theirs)).toBeNull()
  })

  it('atur sendiri hanya mencatat jalur', async () => {
    const a = await family('Atur')
    const kid = await onboarding.addChild(a, { name: 'Wati', grade: 4, avatar: 'fox', pin: [...PIN] })
    const before = await offKeys(kid)
    await onboarding.markCustomPath(a, kid)
    expect(await pathOf(kid)).toBe('custom')
    expect(await offKeys(kid)).toEqual(before)
  })

  it('daftar langkah: hanya untuk pemilik, naik sesuai data, lalu hilang', async () => {
    const guest = await family('Tamu', false)
    expect(await onboarding.firstRunChecklist(guest)).toBeNull()

    const a = await family('Daftar')
    const done = async () => (await onboarding.firstRunChecklist(a))?.filter((i) => i.done).map((i) => i.key)
    expect(await done()).toEqual([])
    const kid = await onboarding.addChild(a, { name: 'Yani', grade: 2, avatar: 'fox', pin: [...PIN] })
    expect(await done()).toEqual(['child'])
    await onboarding.applyRecommendedPath(a, { mode: 'recommended', learnerIds: [kid] })
    expect(await done()).toEqual(['child', 'path'])
    await onboarding.markFirstReportSeen(a)
    expect(await done()).toEqual(['child', 'path', 'report'])
    await owner`insert into quest (org_id, learner_id, date, subject, session, mode, kind, status, seq) values (${a.orgId}, ${kid}, '2026-11-05', 'math', 'latihan', 'latihan', 'daily', 'done', 0)`
    expect(await onboarding.firstRunChecklist(a)).toBeNull()
  })

  it('tips pertama anak: tertunda sekali, tersimpan di server', async () => {
    const a = await family('Tips')
    const kid = await onboarding.addChild(a, { name: 'Zaki', grade: 2, avatar: 'fox', pin: [...PIN] })
    const ctx = { orgId: a.orgId, userId: kid, role: 'learner' as const }
    expect(await dbm.inOrg(ctx, (tx) => entry.firstRunPending(tx, kid))).toBe(true)
    await entry.markFirstRunDone(a.orgId, kid)
    expect(await dbm.inOrg(ctx, (tx) => entry.firstRunPending(tx, kid))).toBe(false)
    expect((await owner`select first_run_done_at from learner_profile where user_id = ${kid}`)[0]!.first_run_done_at).not.toBeNull()
  })
})
