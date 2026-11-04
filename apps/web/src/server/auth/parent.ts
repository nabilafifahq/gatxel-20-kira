import 'server-only'
import { and, eq, sql } from 'drizzle-orm'
import { tables } from '@kira/db'
import type { OrgContext, Tx } from '../db'
import { authDb, inOrg } from '../db'
import { systemCtx } from '../audit'
import { forbidden } from '../errors'
import { orgCtx, requireActor, type Actor } from './actor'

/**
 * Kemampuan orang tua (parent capability).
 *
 * `requireParent()` untuk Server Action dan Route Handler: mengembalikan orang tua yang masuk (peran guardian)
 * dan melempar unauthenticated atau forbidden. Orang tua hanya boleh menjangkau learner yang tertaut lewat
 * guardian_link; `ParentScope.assertParentOf` dan RLS menjaga itu.
 *
 * `withFamilyAdmin(actor, fn)` membuka satu transaksi di org orang tua itu. Peran transaksi tetap `guardian`
 * (RLS tetap membatasi ke anak yang tertaut). Untuk satu tulisan sempit yang memang hanya boleh staf
 * (misalnya membuat learner_profile atau guardian_link), bungkus dengan `scope.elevate(...)`: peran dinaikkan
 * ke peran sistem hanya selama panggilan itu lalu dikembalikan, seperti `deactivateLearnerTx`.
 */

export type ParentScope = {
  /** Konteks org dengan peran guardian. */
  ctx: OrgContext
  /** Lempar forbidden bila orang tua ini tidak tertaut ke learner. */
  assertParentOf(learnerId: string): Promise<void>
  /** Jalankan fn dengan peran dinaikkan ke peran sistem, lalu kembalikan peran guardian. Tulisan di dalamnya harus sempit. */
  elevate<T>(fn: () => Promise<T>): Promise<T>
}

export async function requireParent(): Promise<Actor> {
  return requireActor({ roles: ['guardian'] })
}

export async function withFamilyAdmin<T>(actor: Actor, fn: (tx: Tx, scope: ParentScope) => Promise<T>): Promise<T> {
  if (actor.role !== 'guardian') throw forbidden()
  const ctx = orgCtx(actor)
  return inOrg(ctx, async (tx) => {
    const scope: ParentScope = {
      ctx,
      async assertParentOf(learnerId) {
        const [link] = await tx
          .select({ id: tables.guardianLink.learnerId })
          .from(tables.guardianLink)
          .where(and(eq(tables.guardianLink.guardianId, ctx.userId), eq(tables.guardianLink.learnerId, learnerId)))
          .limit(1)
        if (!link) throw forbidden('Akun ini bukan orang tua yang tertaut ke learner ini.')
      },
      async elevate(inner) {
        await tx.execute(sql`select set_config('app.role', ${systemCtx(ctx.orgId).role}, true)`)
        try {
          return await inner()
        } finally {
          await tx.execute(sql`select set_config('app.role', ${ctx.role}, true)`)
        }
      },
    }
    return fn(tx, scope)
  })
}

/**
 * True bila orang tua ini mendaftar sendiri dan memiliki keluarganya (punya kursi beta). Orang tua yang diundang
 * tutor ke keluarga lama tidak memilikinya, jadi tidak bisa menambah anak sendiri.
 */
export async function isFamilyOwner(actor: Pick<Actor, 'userId' | 'orgId'>): Promise<boolean> {
  const rows = await authDb()
    .select({ orgId: tables.betaSeat.orgId })
    .from(tables.betaSeat)
    .where(and(eq(tables.betaSeat.userId, actor.userId), eq(tables.betaSeat.orgId, actor.orgId)))
    .limit(1)
  return Boolean(rows[0])
}
