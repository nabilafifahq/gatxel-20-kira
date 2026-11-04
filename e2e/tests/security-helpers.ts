import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { request as pwRequest, type APIRequestContext } from '@playwright/test'
import { db, jakartaToday, learnerId, seedOrgId } from './helpers'

/**
 * Bantuan untuk tes keamanan. Sesi dibuat langsung di database (tabel auth.session) supaya tes tidak
 * bergantung pada layar masuk dan bisa memakai akun dari keluarga lain ("org B") tanpa password.
 */

export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex')
export const SESSION_COOKIE = '__Host-kira.session'
export const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'

// PNG 1 x 1 piksel (sama dengan security.spec.ts).
export const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

export type Who = { token: string; userId: string; orgId: string }

export async function userIdByEmail(email: string): Promise<string> {
  const rows = await db()`select id from auth.user_account where lower(email) = ${email} limit 1`
  return rows[0]!.id as string
}

/** Buat sesi untuk pengguna yang sudah ada. Learner butuh perangkat terdaftar yang memuatnya. */
export async function sessionFor(userId: string, orgId: string, kind: 'adult' | 'learner', deviceId: string | null = null): Promise<Who> {
  const token = randomBytes(32).toString('base64url')
  await db()`insert into auth.session (id, user_id, org_id, kind, device_id, expires_at, user_agent)
    values (${sha256(token)}, ${userId}, ${orgId}, ${kind}, ${deviceId}, now() + interval '8 hours', 'security-e2e')`
  return { token, userId, orgId }
}

export async function deviceFor(orgId: string, learnerIds: string[], registeredBy: string): Promise<string> {
  const rows = await db()`insert into auth.device (org_id, name, token_hash, learner_ids, registered_by, expires_at)
    values (${orgId}, 'security-e2e', ${sha256(randomBytes(16).toString('hex'))}, ${learnerIds}, ${registeredBy}, now() + interval '7 days') returning id`
  return rows[0]!.id as string
}

export async function learnerSession(learner: string, orgId: string, registeredBy: string): Promise<Who> {
  const dev = await deviceFor(orgId, [learner], registeredBy)
  return sessionFor(learner, orgId, 'learner', dev)
}

export async function api(who: Who | null, extraHeaders: Record<string, string> = {}): Promise<APIRequestContext> {
  return pwRequest.newContext({
    baseURL: BASE,
    extraHTTPHeaders: { ...(who ? { Cookie: `${SESSION_COOKIE}=${who.token}` } : {}), ...extraHeaders },
    ignoreHTTPSErrors: true,
  })
}

export type OrgB = {
  orgId: string
  guardian: Who
  learner: Who
  learnerId: string
  guardianId: string
  attemptId: string
  attemptTitle: string
  noteBody: string
}

/** Keluarga kedua, terpisah dari org seed: guardian, learner, satu attempt dan satu catatan. */
export async function createOrgB(): Promise<OrgB> {
  const orgId = randomUUID()
  const guardianId = randomUUID()
  const lid = randomUUID()
  const attemptTitle = `RAHASIA-ORG-B-${randomUUID().slice(0, 8)}`
  const noteBody = `CATATAN-ORG-B-${randomUUID().slice(0, 8)}`
  const sql = db()
  await sql.begin(async (tx) => {
    await tx`insert into org (id, name) values (${orgId}, ${'Keluarga B __SEC_E2E__'})`
    await tx`insert into auth.user_account (id, org_id, kind, role, email, name) values
      (${guardianId}, ${orgId}, 'adult', 'guardian', ${`b-${guardianId.slice(0, 8)}@contoh.test`}, 'Ortu B'),
      (${lid}, ${orgId}, 'learner', 'learner', null, 'Anak B')`
    await tx`insert into member_profile (user_id, org_id, name, role, email) values (${guardianId}, ${orgId}, 'Ortu B', 'guardian', ${`b-${guardianId.slice(0, 8)}@contoh.test`})`
    await tx`insert into learner_profile (user_id, org_id, name, avatar, grade, active) values (${lid}, ${orgId}, 'Anak B', 'fox', 3, true)`
    await tx`insert into guardian_link (org_id, guardian_id, learner_id) values (${orgId}, ${guardianId}, ${lid})`
    await tx`insert into note (org_id, learner_id, author_id, body) values (${orgId}, ${lid}, ${guardianId}, ${noteBody})`
  })
  const att = await sql`insert into attempt (org_id, learner_id, kind, mode, subject, title, items, status, submitted_at)
    values (${orgId}, ${lid}, 'test', 'latihan', 'math', ${attemptTitle}, '[]'::jsonb, 'submitted', now()) returning id`
  return {
    orgId,
    guardianId,
    learnerId: lid,
    attemptId: att[0]!.id as string,
    attemptTitle,
    noteBody,
    guardian: await sessionFor(guardianId, orgId, 'adult'),
    learner: await learnerSession(lid, orgId, guardianId),
  }
}

export async function dropOrgB(b: OrgB): Promise<void> {
  const sql = db()
  await sql`delete from auth.session where org_id = ${b.orgId}`
  await sql`delete from auth.device where org_id = ${b.orgId}`
  await sql`delete from auth.user_account where org_id = ${b.orgId}`
  await sql`delete from org where id = ${b.orgId}`
}

/** Semua pelaku dari keluarga seed (org A) dengan sesi langsung. */
export async function familyA() {
  const orgId = await seedOrgId()
  const tutorId = await userIdByEmail('tutor@contoh.test')
  const mamaId = await userIdByEmail('mama@contoh.test')
  const aisha = await learnerId('Aisha')
  const raka = await learnerId('Raka')
  return {
    orgId,
    tutorId,
    mamaId,
    aishaId: aisha,
    rakaId: raka,
    tutor: await sessionFor(tutorId, orgId, 'adult'),
    mama: await sessionFor(mamaId, orgId, 'adult'),
    aisha: await learnerSession(aisha, orgId, tutorId),
    raka: await learnerSession(raka, orgId, tutorId),
  }
}

export { jakartaToday }

export async function uploadPng(ctx: APIRequestContext, attemptId: string, headers: Record<string, string> = {}) {
  return ctx.post('/api/media', {
    headers,
    multipart: { kind: 'drawing', attemptId, position: '1', file: { name: 'gambar.png', mimeType: 'image/png', buffer: PNG_1PX } },
  })
}
