import 'server-only'
import { and, eq, sql } from 'drizzle-orm'
import { isClipText, splitClipText, styleForSkill, type TtsClipRequest } from '@kira/core/tts'
import { listenTextOf } from '@kira/content/present'
import type { Item } from '@kira/content'
import { tables } from '@kira/db'
import type { OrgContext, Tx } from '../db'
import { clipExistsFor, clipKeyOf, ttsEnabled } from '../tts'
import { enqueueJobTx } from './jobs'
import { claimOnce, takeWindow } from '../limiter'

const { job } = tables

/** Paling banyak klip yang menunggu di antrean per org. Melindungi antrean dari layar yang meminta terus. */
const MAX_QUEUED = 150
const RECENT_MS = 10 * 60 * 1000
/** Paling banyak klip baru yang boleh diminta satu pengguna dalam satu jam (dibagi semua replika lewat Valkey). */
const PER_USER_HOURLY = 60

/**
 * Klip teks dengar satu soal (soal dengar dan eja), dengan aturan pecah dan gaya yang sama dengan tombol dengar. Null bila soal
 * ini tidak punya teks dengar. ready false bila ada klip yang belum dibuat: mode tanpa umpan balik tidak boleh jatuh ke suara
 * perangkat, karena suara perangkat butuh teksnya, dan teks itu adalah jawabannya.
 */
export async function spokenClipRefs(item: Item, orgId: string): Promise<{ keys: string[]; ready: boolean } | null> {
  const heard = listenTextOf(item)
  if (heard === null) return null
  const style = styleForSkill(item.skill)
  const keys = splitClipText(heard).filter(isClipText).map((text) => clipKeyOf(text, style))
  const found = await Promise.all(keys.map((k) => clipExistsFor(k, orgId)))
  return { keys, ready: item.lang === 'en-GB' && keys.length > 0 && found.every(Boolean) }
}

/** Minta worker membuat klip yang belum ada. Mengembalikan jumlah klip yang benar-benar diantrekan. */
export async function requestClips(tx: Tx, ctx: OrgContext, clips: TtsClipRequest[]): Promise<number> {
  if (!ttsEnabled()) return 0
  const fresh: TtsClipRequest[] = []
  for (const c of clips) {
    if (!isClipText(c.text)) continue
    const key = clipKeyOf(c.text, c.style)
    if (await clipExistsFor(key, ctx.orgId)) continue
    if (!(await claimOnce(`tts:${key}`, RECENT_MS))) continue
    fresh.push(c)
  }
  if (fresh.length === 0) return 0
  if (!(await takeWindow(`tts:${ctx.userId}`, PER_USER_HOURLY, 3_600_000, fresh.length))) return 0
  const [waiting] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(job)
    .where(and(eq(job.kind, 'tts.clip'), eq(job.status, 'queued')))
  if ((waiting?.n ?? 0) >= MAX_QUEUED) return 0
  await enqueueJobTx(tx, ctx, 'tts.clip', { clips: fresh })
  return fresh.length
}
