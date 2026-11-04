import 'server-only'
import { and, eq, sql } from 'drizzle-orm'
import { tables } from '@kira/db'
import type { Actor } from '../auth/actor'
import { orgCtx } from '../auth/actor'
import { NOTICE_VERSION } from '../auth/accounts'
import { randomToken } from '../auth/crypto'
import { audit } from '../audit'
import { authDb } from '../db'

const { userAccount } = tables

/** Pilihan email kabar produk milik akun yang masuk. Bawaan: tidak berlangganan. */
export async function marketingPreference(actor: Pick<Actor, 'userId' | 'orgId'>): Promise<{ optIn: boolean }> {
  const [row] = await authDb()
    .select({ optIn: userAccount.marketingOptIn })
    .from(userAccount)
    .where(and(eq(userAccount.id, actor.userId), eq(userAccount.orgId, actor.orgId)))
    .limit(1)
  return { optIn: row?.optIn ?? false }
}

/**
 * Orang tua mengubah pilihannya sendiri. Waktu dan versi kebijakan dicatat saat setuju, waktu berhenti saat menarik.
 * Hanya perubahan nyata yang menulis audit. Pekerjaan ini tidak mengirim email kabar apa pun.
 */
export async function setMarketingPreference(actor: Actor, optIn: boolean): Promise<{ optIn: boolean }> {
  const now = new Date()
  const changed = await authDb()
    .update(userAccount)
    .set(
      optIn
        ? { marketingOptIn: true, marketingOptInAt: now, marketingWithdrawnAt: null, marketingNoticeVersion: NOTICE_VERSION, marketingToken: sql`coalesce(${userAccount.marketingToken}, ${randomToken(32)})` }
        : { marketingOptIn: false, marketingWithdrawnAt: now },
    )
    .where(and(eq(userAccount.id, actor.userId), eq(userAccount.orgId, actor.orgId), eq(userAccount.marketingOptIn, !optIn)))
    .returning({ id: userAccount.id })
  if (changed.length) await audit(orgCtx(actor), optIn ? 'marketing.opted-in' : 'marketing.withdrawn', actor.userId, optIn ? { noticeVersion: NOTICE_VERSION, via: 'privacy-page' } : { via: 'privacy-page' })
  return { optIn }
}
