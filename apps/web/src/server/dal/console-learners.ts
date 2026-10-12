import 'server-only'
import { and, asc, eq, isNull, ne, sql } from 'drizzle-orm'
import { formatDateId, jakartaDate, type IsoDate } from '@kira/core'
import { tables } from '@kira/db'
import type { AvatarName, LearnersDTO, PinPicture } from '@/lib/dto'
import type { Actor } from '../auth/actor'
import { orgCtx } from '../auth/actor'
import type { Tx } from '../db'
import { inOrg } from '../db'
import { env, origin } from '../env'
import { audit, auditTx } from '../audit'
import { AppError, conflict, invalid, notFound } from '../errors'
import { log } from '../log'
import { createInvite, createLearnerAccount, normaliseEmail, renameUser } from '../auth/accounts'
import { deviceCountByLearner, listPendingInvites, revokeInvite } from '../auth/admin'
import { setPin, unlockPin } from '../auth/pin'
import { revokeUserSessions } from '../auth/session'
import { latestConsents, recordConsentTx, syncLearnerActive, type ConsentPurposeId } from './consent'
import { queueEmail, simpleEmail } from './outbox'
import { shellIn } from './console-shell'

/**
 * T13 Learner dan grade. Akun learner (skema auth) dibuat lewat createLearnerAccount dan
 * tetap tidak aktif sampai persetujuan `learning` dari orang tua tercatat: lewat undangan
 * (orang tua menyetujui di /keluarga/privasi) atau dicatat tutor dari persetujuan tertulis.
 * PIN tidak pernah masuk log atau audit.
 */

const { learnerProfile, guardianLink, memberProfile, org } = tables

export const OFFLINE_METHODS = ['paper-form', 'in-person', 'written-message'] as const
export type OfflineMethod = (typeof OFFLINE_METHODS)[number]

const METHOD_TEXT: Record<OfflineMethod, string> = {
  'paper-form': 'formulir kertas bertanda tangan',
  'in-person': 'langsung setelah Kebijakan Privasi dibaca bersama',
  'written-message': 'pesan tertulis',
}

/** Teks bukti untuk consent_event.evidence: siapa, dengan cara apa, kapan. */
export function offlineEvidence(guardianName: string, method: OfflineMethod, date: IsoDate): string {
  return `${guardianName.trim()}, ${METHOD_TEXT[method]}, ${formatDateId(date)}.`
}

export async function learnersDTO(actor: Actor): Promise<LearnersDTO> {
  const devices = await deviceCountByLearner(actor.orgId)
  return inOrg(orgCtx(actor), async (tx) => {
    const { shell } = await shellIn(tx, actor, null)
    const rows = await tx
      .select({
        id: learnerProfile.userId,
        name: learnerProfile.name,
        grade: learnerProfile.grade,
        avatar: learnerProfile.avatar,
        active: learnerProfile.active,
        startedOn: learnerProfile.startedOn,
        createdAt: learnerProfile.createdAt,
      })
      .from(learnerProfile)
      .where(isNull(learnerProfile.deletedAt))
      .orderBy(asc(learnerProfile.createdAt), asc(learnerProfile.name))
    const consents = await latestConsents(
      tx,
      rows.map((r) => r.id),
    )
    const links = await tx
      .select({ learnerId: guardianLink.learnerId, name: memberProfile.name })
      .from(guardianLink)
      .innerJoin(memberProfile, eq(memberProfile.userId, guardianLink.guardianId))
      .where(isNull(memberProfile.removedAt))
      .orderBy(asc(memberProfile.name))
    return {
      shell,
      learners: rows.map((r) => {
        const learning = consents.get(r.id)?.get('learning')
        const consent: LearnersDTO['learners'][number]['consent'] = !learning ? 'pending' : learning.granted ? 'granted' : 'withdrawn'
        const since =
          consent === 'pending' ? jakartaDate(r.createdAt) : (r.startedOn ?? (consent === 'granted' ? jakartaDate(learning!.at) : jakartaDate(r.createdAt)))
        return {
          id: r.id,
          name: r.name,
          grade: r.grade,
          avatar: r.avatar as AvatarName,
          active: r.active,
          consent,
          guardians: links.filter((l) => l.learnerId === r.id).map((l) => l.name),
          devices: devices.get(r.id) ?? 0,
          since,
        }
      }),
      maxLearners: env().KIRA_MAX_LEARNERS,
    }
  })
}

async function assertLearner(tx: Tx, learnerId: string): Promise<{ id: string; name: string }> {
  const rows = await tx
    .select({ id: learnerProfile.userId, name: learnerProfile.name })
    .from(learnerProfile)
    .where(and(eq(learnerProfile.userId, learnerId), isNull(learnerProfile.deletedAt)))
    .limit(1)
  if (!rows[0]) throw notFound('Learner tidak ditemukan. Muat ulang halaman learner lalu coba lagi.')
  return rows[0]
}

async function assertNameFree(tx: Tx, name: string, selfId: string | null): Promise<void> {
  const rows = await tx
    .select({ id: learnerProfile.userId })
    .from(learnerProfile)
    .where(and(isNull(learnerProfile.deletedAt), sql`lower(trim(${learnerProfile.name})) = ${name.trim().toLowerCase()}`, selfId ? ne(learnerProfile.userId, selfId) : undefined))
    .limit(1)
  if (rows[0]) {
    const msg = `Nama ${name.trim()} sudah dipakai learner lain. Pakai nama lain supaya mudah dibedakan di tablet.`
    throw invalid(msg, { name: msg })
  }
}

export type AddLearnerInput = { name: string; grade: number; avatar: AvatarName; pin: PinPicture[]; guardianEmail: string | null }
export type AddLearnerResult = { learnerId: string; inviteLink: string | null; partialFailure: string | null }

/**
 * Tambah learner baru (belum aktif). Email orang tua yang sudah punya akun di keluarga ini langsung
 * ditautkan dan diberi tahu lewat email; email baru mendapat undangan orang tua untuk learner ini.
 * Undangan lain yang masih menunggu untuk email yang sama digabung (diganti undangan baru).
 */
export async function addLearner(actor: Actor, input: AddLearnerInput): Promise<AddLearnerResult> {
  const ctx = orgCtx(actor)
  const max = env().KIRA_MAX_LEARNERS
  const email = input.guardianEmail ? normaliseEmail(input.guardianEmail) : null
  const name = input.name.trim()

  // Batas jumlah dan nama dicek sebelum akun dibuat. Satu tutor per keluarga, jadi balapan dua
  // penambahan bersamaan cukup kecil; kalau terjadi, batas terlewati satu learner.
  const pre = await inOrg(ctx, async (tx) => {
    const [n] = await tx.select({ n: sql<number>`count(*)::int` }).from(learnerProfile).where(isNull(learnerProfile.deletedAt))
    if ((n?.n ?? 0) >= max) {
      throw conflict(`Akun ini sudah berisi ${max} learner, batas untuk server ini. Learner baru bisa ditambah setelah salah satu akun learner dihapus lewat halaman Privasi keluarga.`)
    }
    await assertNameFree(tx, name, null)
    const [orgRow] = await tx.select({ name: org.name }).from(org).where(eq(org.id, ctx.orgId)).limit(1)
    let guardian: { userId: string; name: string } | null = null
    if (email) {
      const [m] = await tx
        .select({ userId: memberProfile.userId, name: memberProfile.name, role: memberProfile.role, removedAt: memberProfile.removedAt })
        .from(memberProfile)
        .where(sql`lower(${memberProfile.email}) = ${email}`)
        .limit(1)
      if (m?.removedAt) {
        const msg = 'Email ini milik anggota yang sudah dikeluarkan dari keluarga ini. Pakai email lain, atau kosongkan lalu catat persetujuan offline.'
        throw invalid(msg, { guardianEmail: msg })
      }
      if (m?.role === 'tutor') {
        const msg = 'Email ini milik akun tutor. Isi email orang tua, atau kosongkan lalu catat persetujuan offline.'
        throw invalid(msg, { guardianEmail: msg })
      }
      if (m) guardian = { userId: m.userId, name: m.name }
    }
    return { orgName: orgRow?.name ?? 'Kira', guardian }
  })

  const pending = email && !pre.guardian ? ((await listPendingInvites(ctx.orgId)).find((i) => i.email === email) ?? null) : null
  if (pending?.role === 'tutor') {
    const msg = 'Email ini sedang diundang sebagai tutor. Isi email orang tua, atau batalkan undangan tutor itu di Pengaturan.'
    throw invalid(msg, { guardianEmail: msg })
  }

  const learnerId = await createLearnerAccount(ctx, { name, grade: input.grade, avatar: input.avatar, pin: input.pin })
  if (!email) return { learnerId, inviteLink: null, partialFailure: null }

  if (pre.guardian) {
    const guardian = pre.guardian
    await inOrg(ctx, async (tx) => {
      await tx.insert(guardianLink).values({ orgId: ctx.orgId, guardianId: guardian.userId, learnerId }).onConflictDoNothing()
      await auditTx(tx, ctx, 'guardian.linked', learnerId, { guardianId: guardian.userId })
    })
    try {
      const mail = simpleEmail({
        title: `Persetujuan untuk ${name} di Kira`,
        lines: [
          `${actor.name} menambahkan ${name} di Kira ${pre.orgName}.`,
          `${name} bisa mulai belajar di tablet setelah persetujuan orang tua diberikan di halaman Privasi.`,
        ],
        buttonLabel: 'Buka halaman Privasi',
        buttonUrl: `${origin()}/keluarga/privasi?learner=${learnerId}`,
        footer: 'Email ini dikirim karena akun orang tua ini tertaut ke learner tersebut di Kira.',
      })
      await queueEmail(ctx.orgId, { to: email, subject: `Persetujuan untuk ${name} di Kira`, ...mail, kind: 'consent-request' })
    } catch (e) {
      // Tautan sudah dibuat; email pemberitahuan hanya pelengkap.
      log.error('email permintaan persetujuan gagal masuk antrean', { learnerId, error: e })
    }
    return { learnerId, inviteLink: null, partialFailure: null }
  }

  try {
    const learnerIds = [...new Set([...(pending?.learnerIds ?? []), learnerId])]
    const inv = await createInvite(ctx, { email, role: 'guardian', learnerIds, orgName: pre.orgName })
    if (pending) await revokeInvite(ctx.orgId, pending.id)
    await audit(ctx, 'invite.created', inv.inviteId, { role: 'guardian', learners: learnerIds.length, replaced: pending ? 1 : 0 })
    return { learnerId, inviteLink: inv.link, partialFailure: null }
  } catch (e) {
    const reason = e instanceof AppError ? e.userMessage : 'Server belum bisa membuat undangan.'
    if (!(e instanceof AppError)) log.error('undangan orang tua gagal dibuat', { learnerId, error: e })
    return {
      learnerId,
      inviteLink: null,
      partialFailure: `${name} sudah ditambahkan, tetapi undangan ke ${email} belum terkirim. ${reason} Catat persetujuan offline dari daftar learner, atau undang orang tua lewat Pengaturan.`,
    }
  }
}

export async function updateLearner(actor: Actor, input: { learnerId: string; name: string; grade: number; avatar: AvatarName }): Promise<void> {
  const ctx = orgCtx(actor)
  const name = input.name.trim()
  await inOrg(ctx, async (tx) => {
    const before = await tx
      .select({ grade: learnerProfile.grade })
      .from(learnerProfile)
      .where(and(eq(learnerProfile.userId, input.learnerId), isNull(learnerProfile.deletedAt)))
      .limit(1)
    if (!before[0]) throw notFound('Learner tidak ditemukan. Muat ulang halaman learner lalu coba lagi.')
    await assertNameFree(tx, name, input.learnerId)
    await tx
      .update(learnerProfile)
      .set({ name, grade: input.grade, avatar: input.avatar, updatedAt: new Date() })
      .where(eq(learnerProfile.userId, input.learnerId))
    await auditTx(tx, ctx, 'learner.updated', input.learnerId, { grade: input.grade, gradeChanged: before[0].grade !== input.grade })
  })
  await renameUser(input.learnerId, ctx.orgId, name)
}

/** PIN baru langsung berlaku; sesi learner di semua tablet ikut dicabut. */
export async function resetPin(actor: Actor, input: { learnerId: string; pin: PinPicture[] }): Promise<void> {
  const ctx = orgCtx(actor)
  await inOrg(ctx, (tx) => assertLearner(tx, input.learnerId))
  await setPin(input.learnerId, input.pin)
  await revokeUserSessions(input.learnerId)
  await audit(ctx, 'learner.pin.reset', input.learnerId)
}

export async function unlockLearner(actor: Actor, learnerId: string): Promise<void> {
  const ctx = orgCtx(actor)
  await inOrg(ctx, (tx) => assertLearner(tx, learnerId))
  await unlockPin(learnerId)
  await audit(ctx, 'learner.pin.unlocked', learnerId)
}

/** Catat persetujuan yang diberikan di luar Kira, lalu samakan status aktif learner. */
export async function recordOfflineConsent(
  actor: Actor,
  input: { learnerId: string; guardianName: string; method: OfflineMethod; date: IsoDate; purposes: ConsentPurposeId[] },
): Promise<{ active: boolean }> {
  const ctx = orgCtx(actor)
  const today = jakartaDate()
  if (input.date > today) {
    const msg = `Tanggal persetujuan tidak boleh setelah hari ini (${formatDateId(today)}).`
    throw invalid(msg, { date: msg })
  }
  await inOrg(ctx, async (tx) => {
    await assertLearner(tx, input.learnerId)
    await recordConsentTx(tx, ctx, {
      learnerId: input.learnerId,
      purposes: input.purposes,
      granted: true,
      method: 'offline',
      guardianId: null,
      evidence: offlineEvidence(input.guardianName, input.method, input.date),
    })
  })
  return { active: await syncLearnerActive(ctx.orgId, input.learnerId) }
}
