import 'server-only'
import { asc, eq, isNull } from 'drizzle-orm'
import { tables } from '@kira/db'
import type { ConsoleShell } from '@/lib/dto'
import type { Actor } from '../auth/actor'
import { orgCtx } from '../auth/actor'
import type { Tx } from '../db'
import { inOrg } from '../db'
import { env } from '../env'

const { learnerProfile, org } = tables

export type ShellLearner = { id: string; name: string; grade: number; active: boolean }

/** Learner yang boleh dilihat akun ini (RLS: tutor semua, orang tua hanya yang tertaut). */
export async function visibleLearners(tx: Tx): Promise<ShellLearner[]> {
  return tx
    .select({ id: learnerProfile.userId, name: learnerProfile.name, grade: learnerProfile.grade, active: learnerProfile.active })
    .from(learnerProfile)
    .where(isNull(learnerProfile.deletedAt))
    .orderBy(asc(learnerProfile.name))
}

export function aiEnabled(): boolean {
  return env().AI_PROVIDER !== 'none'
}

/**
 * Kerangka konsol dan orang tua: nama akun, nama keluarga, daftar learner, learner terpilih.
 * `learnerParam` berasal dari ?learner= dan hanya dipakai bila learner itu terlihat oleh akun ini.
 */
export async function shellIn(tx: Tx, actor: Actor, learnerParam: string | null): Promise<{ shell: ConsoleShell; learner: ShellLearner | null; learners: ShellLearner[] }> {
  const [orgRow] = await tx.select({ name: org.name }).from(org).where(eq(org.id, actor.orgId)).limit(1)
  const learners = await visibleLearners(tx)
  const learner = learners.find((l) => l.id === learnerParam) ?? learners.find((l) => l.active) ?? learners[0] ?? null
  return {
    shell: {
      userName: actor.name,
      orgName: orgRow?.name ?? 'Kira',
      role: actor.role === 'guardian' ? 'guardian' : 'tutor',
      learners: learners.map((l) => ({ id: l.id, name: l.name, grade: l.grade })),
      currentLearnerId: learner?.id ?? null,
      aiEnabled: actor.role === 'tutor' && aiEnabled(),
    },
    learner,
    learners,
  }
}

export function consoleShell(actor: Actor, learnerParam: string | null) {
  return inOrg(orgCtx(actor), (tx) => shellIn(tx, actor, learnerParam))
}
