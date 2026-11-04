import { createHash, randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * Isolasi antar keluarga di Postgres sungguhan, lewat DAL dan RLS: dua keluarga yang mendaftar sendiri
 * (jalur verifikasi sungguhan), masing-masing menambah anak. Keluarga A tidak boleh membaca atau mengubah apa pun
 * milik keluarga B: anak, persetujuan, hasil, media (/api/media), undangan, dan batas jumlah anak tidak dibagi.
 * Butuh DATABASE_URL_OWNER, DATABASE_URL_APP, DATABASE_URL_AUTH dan migrasi sudah dijalankan.
 */
const ownerUrl = process.env.DATABASE_URL_OWNER
const appUrl = process.env.DATABASE_URL_APP
const authUrl = process.env.DATABASE_URL_AUTH
const ready = Boolean(ownerUrl && appUrl && authUrl)
const sha = (v: string) => createHash('sha256').update(v).digest('hex')
const PIN = ['sun', 'moon', 'star', 'cat'] as const

describe.skipIf(!ready)('isolasi antar keluarga', () => {
  const owner = ready ? postgres(ownerUrl!, { max: 2, onnotice: () => {} }) : (null as never)
  const run = randomUUID().slice(0, 8)
  type Fam = { userId: string; orgId: string; actor: import('@/server/auth/actor').Actor; kids: string[] }
  let A: Fam
  let B: Fam
  let onboarding: typeof import('@/server/dal/onboarding')
  let parent: typeof import('@/server/auth/parent')
  let dbm: typeof import('@/server/db')
  let media: typeof import('@/server/dal/media-rows')
  let admin: typeof import('@/server/auth/admin')
  let accounts: typeof import('@/server/auth/accounts')
  let privacy: typeof import('@/server/dal/privacy')
  let mediaB: string
  let attemptB: string
  let end: () => Promise<void>

  async function signUpFamily(tag: string): Promise<Fam> {
    const email = `fam${tag}.${run}@isolasi.test`
    const token = `isolasi-${tag}-${run}-${randomUUID()}`
    await owner`insert into auth.signup (email, email_norm, name, password_hash, token_hash, expires_at, terms_version, notice_version)
      values (${email}, ${email}, ${`Ibu ${tag}`}, 'x', ${sha(token)}, now() + interval '1 day', 't', 'n')`
    const rows = await dbm.authDb().execute(sql`select status, user_id, org_id from kira_verify_signup(${sha(token)}, ${100000})`)
    const r = (rows as unknown as { status: string; user_id: string; org_id: string }[])[0]!
    expect(r.status).toBe('ok')
    return {
      userId: r.user_id,
      orgId: r.org_id,
      kids: [],
      actor: { sessionId: 's', userId: r.user_id, orgId: r.org_id, kind: 'adult', role: 'guardian', name: `Ibu ${tag}`, email, deviceId: null, createdAt: new Date() },
    }
  }

  beforeAll(async () => {
    process.env.KIRA_ORIGIN = 'http://localhost:3100'
    process.env.DATABASE_URL_APP = appUrl!
    process.env.DATABASE_URL_AUTH = authUrl!
    process.env.KIRA_SECRET = 'uji-isolasi-keluarga-rahasia-minimal-32-karakter'
    process.env.KIRA_DATA_DIR = '.kira-local/data'
    process.env.KIRA_MAX_LEARNERS_PER_FAMILY = '3'
    dbm = await import('@/server/db')
    onboarding = await import('@/server/dal/onboarding')
    parent = await import('@/server/auth/parent')
    media = await import('@/server/dal/media-rows')
    admin = await import('@/server/auth/admin')
    accounts = await import('@/server/auth/accounts')
    privacy = await import('@/server/dal/privacy')
    end = async () => {
      await Promise.all([(dbm.appDb() as unknown as { $client: { end(): Promise<void> } }).$client.end(), (dbm.authDb() as unknown as { $client: { end(): Promise<void> } }).$client.end()])
    }
    A = await signUpFamily('a')
    B = await signUpFamily('b')
    for (const f of [A, B]) f.kids.push(await onboarding.addChild(f.actor, { name: `Anak ${f.actor.name}`, grade: 2, avatar: 'fox', pin: [...PIN], guardianConsent: true }))
    await onboarding.saveChildConsents(B.actor, { learnerId: B.kids[0]!, consents: { learning: true, 'progress-email': false, audio: true, photo: false } })
    // Data B yang tidak boleh bocor: media, hasil belajar, catatan.
    const [m] = await owner`insert into media (org_id, learner_id, kind, path, mime, size, sha256, created_by)
      values (${B.orgId}, ${B.kids[0]!}, 'audio', ${`${B.orgId}/rahasia.webm`}, 'audio/webm', 10, 'abc', ${B.userId}) returning id`
    mediaB = m!.id as string
    const [at] = await owner`insert into attempt (org_id, learner_id, kind, mode, subject, title, items, status)
      values (${B.orgId}, ${B.kids[0]!}, 'quest', 'latihan', 'math', 'Hasil B', '[]'::jsonb, 'graded') returning id`
    attemptB = at!.id as string
    await owner`insert into xp_event (org_id, learner_id, amount, reason, date) values (${B.orgId}, ${B.kids[0]!}, 5, 'uji', '2026-11-01')`
    await owner`insert into skill_state (org_id, learner_id, skill_id, theta) values (${B.orgId}, ${B.kids[0]!}, 'm2.arrays', 0.5)`
  })

  afterAll(async () => {
    for (const f of [A, B]) {
      if (!f) continue
      await owner`delete from auth.user_account where org_id = ${f.orgId}`
      await owner`delete from auth.invite where org_id = ${f.orgId}`
      await owner`delete from auth.beta_seat where org_id = ${f.orgId}`
      await owner`delete from outbox_email where org_id = ${f.orgId}`
      await owner`delete from org where id = ${f.orgId}`
    }
    await owner`delete from public_mail where to_addr like ${`%.${run}@isolasi.test`}`
    await Promise.all([owner.end(), end()])
  })

  it('A hanya melihat anaknya sendiri', async () => {
    const s = await onboarding.onboardingState(A.actor)
    expect(s.children.map((c) => c.id)).toEqual(A.kids)
    expect(JSON.stringify(s)).not.toContain(B.kids[0]!)
  })

  it('A tidak bisa membaca atau mengubah persetujuan B', async () => {
    await expect(onboarding.saveChildConsents(A.actor, { learnerId: B.kids[0]!, consents: { learning: true, 'progress-email': true, audio: true, photo: true } })).rejects.toThrow()
    const [c] = await owner`select count(*)::int as n from consent_event where learner_id = ${B.kids[0]!}`
    expect(c!.n).toBe(2)
    // Lewat RLS langsung: konteks A tidak melihat consent_event B dan tidak bisa menulisnya.
    const ctx = { orgId: A.orgId, userId: A.userId, role: 'guardian' as const }
    const seen = await dbm.inOrg(ctx, (tx) => tx.execute(sql`select count(*)::int as n from consent_event where learner_id = ${B.kids[0]!}`))
    expect((seen as unknown as { n: number }[])[0]!.n).toBe(0)
    await expect(
      dbm.inOrg(ctx, (tx) =>
        tx.execute(sql`insert into consent_event (org_id, learner_id, guardian_id, recorded_by, purpose, granted, notice_version, method) values (${B.orgId}, ${B.kids[0]!}, ${A.userId}, ${A.userId}, 'photo', true, 'v', 'in-app')`),
      ),
    ).rejects.toThrow()
  })

  it('A tidak bisa membuka media B lewat DAL /api/media, tetapi B bisa', async () => {
    expect(await media.mediaForViewer(A.actor, mediaB)).toBeNull()
    const own = await media.mediaForViewer(B.actor, mediaB)
    expect(own?.mime).toBe('audio/webm')
    const learnerA = { ...A.actor, userId: A.kids[0]!, role: 'learner' as const, kind: 'learner' as const }
    expect(await media.mediaForViewer(learnerA, mediaB)).toBeNull()
  })

  it('A tidak melihat atau mengubah hasil, XP, dan kemajuan B di tabel mana pun', async () => {
    const ctx = { orgId: A.orgId, userId: A.userId, role: 'guardian' as const }
    for (const t of ['learner_profile', 'guardian_link', 'member_profile', 'consent_event', 'attempt', 'response', 'xp_event', 'skill_state', 'media', 'note', 'audit_log', 'outbox_email']) {
      const seen = await dbm.inOrg(ctx, (tx) => tx.execute(sql`select count(*)::int as n from ${sql.identifier(t)} where org_id = ${B.orgId}`))
      expect((seen as unknown as { n: number }[])[0]!.n, t).toBe(0)
    }
    const upd = await dbm.inOrg(ctx, (tx) => tx.execute(sql`update attempt set title = 'diubah' where id = ${attemptB} returning id`))
    expect((upd as unknown as unknown[]).length).toBe(0)
    const del = await dbm.inOrg(ctx, (tx) => tx.execute(sql`delete from skill_state where learner_id = ${B.kids[0]!} returning learner_id`))
    expect((del as unknown as unknown[]).length).toBe(0)
    const [check] = await owner`select title from attempt where id = ${attemptB}`
    expect(check!.title).toBe('Hasil B')
  })

  it('orang tua tidak bisa menjangkau anak yang tidak tertaut, walau satu keluarga', async () => {
    await expect(parent.withFamilyAdmin(A.actor, (_tx, scope) => scope.assertParentOf(B.kids[0]!))).rejects.toThrow()
    await parent.withFamilyAdmin(A.actor, (_tx, scope) => scope.assertParentOf(A.kids[0]!))
    const learner = { ...A.actor, role: 'learner' as const, userId: A.kids[0]! }
    await expect(parent.withFamilyAdmin(learner, async () => 1)).rejects.toThrow()
    // Orang tua tidak bisa mengubah learner_profile langsung; hanya lewat elevate yang sempit.
    const ctx = { orgId: A.orgId, userId: A.userId, role: 'guardian' as const }
    await expect(dbm.inOrg(ctx, (tx) => tx.execute(sql`update learner_profile set grade = 6 where user_id = ${A.kids[0]!}`))).rejects.toThrow()
  })

  it('undangan B tidak terlihat atau bisa dicabut oleh A', async () => {
    const inv = await accounts.createInvite({ orgId: B.orgId, userId: B.userId }, { email: `undang.${run}@isolasi.test`, role: 'guardian', learnerIds: [], orgName: 'Keluarga B' })
    expect((await admin.listPendingInvites(A.orgId)).some((i) => i.id === inv.inviteId)).toBe(false)
    expect(await admin.revokeInvite(A.orgId, inv.inviteId)).toBe(false)
    expect((await admin.listPendingInvites(B.orgId)).some((i) => i.id === inv.inviteId)).toBe(true)
  })

  it('batas anak per keluarga tidak dibagi antar keluarga', async () => {
    // Batas uji 3 per keluarga: A penuh, B masih bisa menambah.
    await onboarding.addChild(A.actor, { name: 'A dua', grade: 1, avatar: 'cat', pin: [...PIN], guardianConsent: true })
    await onboarding.addChild(A.actor, { name: 'A tiga', grade: 3, avatar: 'owl', pin: [...PIN], guardianConsent: true })
    await expect(onboarding.addChild(A.actor, { name: 'A empat', grade: 3, avatar: 'bear', pin: [...PIN], guardianConsent: true })).rejects.toThrow(/sampai 3 anak/)
    await onboarding.addChild(B.actor, { name: 'B dua', grade: 4, avatar: 'cat', pin: [...PIN], guardianConsent: true })
    const [n] = await owner`select count(*)::int as n from learner_profile where org_id = ${A.orgId}`
    expect(n!.n).toBe(3)
  })

  it('penambahan serentak tidak melewati batas', async () => {
    const results = await Promise.allSettled([1, 2, 3, 4].map((i) => onboarding.addChild(B.actor, { name: `B serentak ${i}`, grade: 2, avatar: 'frog', pin: [...PIN], guardianConsent: true })))
    const [n] = await owner`select count(*)::int as n from learner_profile where org_id = ${B.orgId}`
    expect(n!.n).toBe(3)
    expect(results.filter((r) => r.status === 'fulfilled').length).toBe(1)
  })

  it('minta hapus anak B oleh A ditolak', async () => {
    const ctx = { orgId: A.orgId, userId: A.userId, role: 'guardian' as const }
    await expect(dbm.inOrg(ctx, (tx) => privacy.requestDeletionTx(tx, ctx, { guardianId: A.userId, learnerId: B.kids[0]!, confirmName: 'Anak Ibu b' }))).rejects.toThrow()
    const [p] = await owner`select active, deleted_at from learner_profile where user_id = ${B.kids[0]!}`
    expect(p!.active).toBe(true)
  })

  it('/setup tetap tertutup setelah ada org mana pun', async () => {
    expect(await accounts.orgCount()).toBeGreaterThan(0)
  })
})
