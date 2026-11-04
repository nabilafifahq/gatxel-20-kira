import 'server-only'
import { and, eq, inArray, ne, sql } from 'drizzle-orm'
import { jakartaDate, type IsoDate, type SessionType } from '@kira/core'
import { STRAND_NAMES } from '@kira/content'
import { tables } from '@kira/db'
import type { Subject } from '@/lib/dto'
import type { ParentSkillChangeResult, ParentSkillOptionsDTO } from '@/lib/dto-parent'
import type { Actor } from '../auth/actor'
import { withFamilyAdmin, type ParentScope } from '../auth/parent'
import { auditTx } from '../audit'
import { conflict, invalid, notFound } from '../errors'
import type { Tx } from '../db'
import { setSessionSkillTx } from './console-planner'
import { poolForSkill, skill, skillsFor } from './content'
import { loadLearner, type LearnerRow } from './learner-core'
import { isFeatureOnTx } from './learner-features'
import { questStarted } from './learner-session'
import { groupSkillOptions, sessionName, sessionState, skillChangeView, type SkillSession } from './session-skill-logic'

/**
 * Orang tua mengganti pelajaran sesi hari ini (permintaan "ubah pelajaran di hari yang sama"). Berlaku hari ini saja.
 * Sesi yang selesai ditolak; sesi yang sedang dikerjakan tetap berjalan dan perubahannya berlaku mulai sesi berikutnya
 * yang belum dimulai. Wajib atau Opsional tidak berubah, jadi streak tetap dihitung dari sesi wajib.
 *
 * "Pakai juga minggu ini" sengaja tidak ada: slot hari berikutnya mengunci Wajib atau Opsional per tanggal (Aturan hari
 * yang diubah kemudian tidak berlaku lagi untuk hari itu) dan orang tua tidak punya layar minggu untuk melihat atau
 * membatalkannya.
 */

const { quest, response } = tables

/** Jumlah jawaban per attempt: status quest tetap ready sampai selesai, jadi sesi berjalan terlihat dari jawabannya. */
export async function answeredByAttempt(tx: Tx, attemptIds: readonly (string | null)[]): Promise<Map<string, number>> {
  const ids = attemptIds.filter((id): id is string => id !== null)
  if (ids.length === 0) return new Map()
  const rows = await tx
    .select({ attemptId: response.attemptId, n: sql<number>`count(*)::int` })
    .from(response)
    .where(inArray(response.attemptId, ids))
    .groupBy(response.attemptId)
  return new Map(rows.map((r) => [r.attemptId, r.n]))
}

async function daySessions(tx: Tx, learnerId: string, date: IsoDate): Promise<(SkillSession & { slotId: string | null })[]> {
  const rows = await tx
    .select({
      id: quest.id,
      subject: quest.subject,
      session: quest.session,
      kind: quest.kind,
      seq: quest.seq,
      skillId: quest.skillId,
      status: quest.status,
      slotId: quest.planSlotId,
      attemptId: quest.attemptId,
    })
    .from(quest)
    .where(and(eq(quest.learnerId, learnerId), eq(quest.date, date), ne(quest.kind, 'bonus')))
  const answered = await answeredByAttempt(tx, rows.map((r) => r.attemptId))
  return rows.map((r) => ({ id: r.id, subject: r.subject as Subject, session: r.session, required: r.kind === 'daily', seq: r.seq, skillId: r.skillId, state: sessionState(r.status, answered.get(r.attemptId ?? '') ?? 0), slotId: r.slotId }))
}

/** Sesi hari ini yang dituju, hanya bila anaknya tertaut ke orang tua ini. */
async function loadTarget(tx: Tx, scope: ParentScope, questId: string): Promise<{ learner: LearnerRow; clicked: SkillSession; sessions: (SkillSession & { slotId: string | null })[] }> {
  const [q] = await tx.select({ learnerId: quest.learnerId, date: quest.date }).from(quest).where(eq(quest.id, questId)).limit(1)
  if (!q) throw notFound('Sesi ini tidak ditemukan. Muat ulang halaman.')
  await scope.assertParentOf(q.learnerId)
  if (q.date !== jakartaDate()) throw conflict('Sesi ini bukan sesi hari ini. Muat ulang halaman.')
  const sessions = await daySessions(tx, q.learnerId, q.date)
  const clicked = sessions.find((s) => s.id === questId)
  if (!clicked) throw notFound('Sesi ini tidak ditemukan. Muat ulang halaman.')
  return { learner: await loadLearner(tx, q.learnerId), clicked, sessions }
}

/**
 * Skill yang boleh dipilih: kelas anak dan mapel sesi, olimpiade hanya bila saklarnya menyala, dan hanya yang punya
 * soal yang dinilai otomatis. Skill menulis dan berbicara tanpa soal otomatis tidak bisa menjadi sesi Latihan atau Tes.
 */
async function allowedSkills(tx: Tx, orgId: string, learner: LearnerRow, subject: Subject) {
  if (!(await isFeatureOnTx(tx, learner.userId, subject))) return []
  const olympiad = await isFeatureOnTx(tx, learner.userId, `olympiad-${subject}`)
  const out = []
  for (const s of skillsFor(subject, learner.grade)) {
    if (s.strand === 'Oly' && !olympiad) continue
    if ((await poolForSkill(tx, orgId, s.id, { allowManual: false })).length > 0) out.push(s)
  }
  return out
}

function blockedError(note: string | null) {
  return note ? conflict(note) : invalid('Hanya Latihan dan Tes yang berisi satu pelajaran, jadi hanya sesi itu yang bisa diganti.')
}

export async function parentSkillOptions(actor: Actor, input: { questId: string }): Promise<ParentSkillOptionsDTO> {
  return withFamilyAdmin(actor, async (tx, scope) => {
    const { learner, clicked, sessions } = await loadTarget(tx, scope, input.questId)
    const view = skillChangeView(clicked, sessions, sessionName)
    if (!view.canChange) throw blockedError(view.note)
    const skills = await allowedSkills(tx, scope.ctx.orgId, learner, clicked.subject)
    return {
      questId: clicked.id,
      label: sessionName(clicked),
      note: view.note,
      appliesTo: view.appliesTo ?? sessionName(clicked),
      currentSkillId: view.targets[0]?.skillId ?? null,
      topics: groupSkillOptions(skills, (strand) => STRAND_NAMES[strand]?.id ?? null),
    }
  })
}

export async function parentChangeSessionSkill(actor: Actor, input: { questId: string; skillId: string }): Promise<ParentSkillChangeResult> {
  return withFamilyAdmin(actor, async (tx, scope) => {
    const { learner, clicked, sessions } = await loadTarget(tx, scope, input.questId)
    const view = skillChangeView(clicked, sessions, sessionName)
    if (!view.canChange) throw blockedError(view.note)
    const allowed = await allowedSkills(tx, scope.ctx.orgId, learner, clicked.subject)
    if (!allowed.some((s) => s.id === input.skillId)) {
      throw invalid('Pelajaran itu tidak tersedia untuk sesi ini. Pilih dari daftar.', { skillId: 'Pilih pelajaran dari daftar.' })
    }
    const title = skill(input.skillId)?.titleId ?? input.skillId
    const targets = sessions.filter((s) => view.targets.some((t) => t.id === s.id) && s.skillId !== input.skillId)
    if (targets.length === 0) {
      return { change: { today: true, published: false, created: 0, removed: 0, regenerated: 0, kept: 0 }, note: `${view.appliesTo} sudah memakai pelajaran ${title}.` }
    }
    const change = await scope.elevate(() =>
      setSessionSkillTx(tx, scope.ctx, {
        learnerId: learner.userId,
        skillId: input.skillId,
        targets: targets.map((t) => ({ slotId: t.slotId, subject: t.subject, session: t.session as SessionType })),
      }),
    )
    // Sesi bisa saja baru dimulai anak, atau soalnya tidak bisa disusun. Jangan laporkan perubahan yang tidak terjadi: batalkan semuanya.
    const after = await tx.select().from(quest).where(inArray(quest.id, targets.map((t) => t.id)))
    for (const q of after) {
      if (q.skillId === input.skillId) continue
      if (await questStarted(tx, q)) throw conflict(`${sessionName({ session: q.session, subject: q.subject as Subject })} baru saja dimulai, jadi tetap berjalan. Muat ulang halaman lalu coba lagi.`)
      throw conflict('Soal untuk pelajaran ini belum bisa disusun. Pilih pelajaran lain.')
    }
    await auditTx(tx, scope.ctx, 'parent.session.skill', learner.userId, { subject: clicked.subject, session: clicked.session, skillId: input.skillId, sessions: targets.length })
    const lead = clicked.state === 'ready' ? `Pelajaran ${view.appliesTo} hari ini diganti ke ${title}.` : `${sessionName(clicked)} sedang dikerjakan dan tetap berjalan. Mulai ${view.appliesTo}, pelajarannya ${title}.`
    return { change, note: `${lead} Wajib atau opsional tidak berubah. Layar Hari Ini ${learner.name} menyesuaikan saat dimuat berikutnya.` }
  })
}
