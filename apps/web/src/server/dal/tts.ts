import 'server-only'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { jakartaDate, type IsoDate } from '@kira/core'
import { isClipText, QUIZ_HOST_LINES, type TtsClipRequest } from '@kira/core/tts'
import { tables } from '@kira/db'
import { itemSpeechClips, lessonSpeechClips, passageSpeechClips } from '@kira/content/speech'
import type { OrgContext, Tx } from '../db'
import { clipExists, clipKeyOf, ttsEnabled } from '../tts'
import { lesson, passage, resolveItems } from './content'
import { enqueueJobTx } from './jobs'
import type { AttemptItem } from './learner-runner'

const { quest, attempt, job } = tables

/** Paling banyak klip yang menunggu di antrean per org. Melindungi antrean dari layar yang meminta terus. */
const MAX_QUEUED = 150
const RECENT_MS = 10 * 60 * 1000
const recent = new Map<string, number>()
/** Paling banyak klip baru yang boleh diminta satu pengguna dalam satu jam. */
const PER_USER_HOURLY = 60
const byUser = new Map<string, number[]>()

function withinUserLimit(userId: string, n: number, now: number): boolean {
  const recentAsks = (byUser.get(userId) ?? []).filter((t) => now - t < 3_600_000)
  if (recentAsks.length + n > PER_USER_HOURLY) {
    byUser.set(userId, recentAsks)
    return false
  }
  byUser.set(userId, [...recentAsks, ...Array<number>(n).fill(now)])
  return true
}

/** Minta worker membuat klip yang belum ada. Mengembalikan jumlah klip yang benar-benar diantrekan. */
export async function requestClips(tx: Tx, ctx: OrgContext, clips: TtsClipRequest[]): Promise<number> {
  if (!ttsEnabled()) return 0
  const now = Date.now()
  for (const [k, at] of recent) if (now - at > RECENT_MS) recent.delete(k)
  const fresh: TtsClipRequest[] = []
  for (const c of clips) {
    if (!isClipText(c.text)) continue
    const key = clipKeyOf(c.text, c.style)
    if (recent.has(key) || (await clipExists(key))) continue
    recent.set(key, now)
    fresh.push(c)
  }
  if (fresh.length === 0) return 0
  if (!withinUserLimit(ctx.userId, fresh.length, now)) return 0
  const [waiting] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(job)
    .where(and(eq(job.kind, 'tts.clip'), eq(job.status, 'queued')))
  if ((waiting?.n ?? 0) >= MAX_QUEUED) return 0
  await enqueueJobTx(tx, ctx, 'tts.clip', { clips: fresh })
  return fresh.length
}

/**
 * Alamat klip yang sudah ada untuk sesi hari ini (soal, pembahasan, bacaan, dan pelajarannya), supaya
 * service worker menyimpannya untuk dipakai offline. Klip yang belum dibuat tidak disertakan.
 */
/** Alamat klip kalimat pembawa acara Quiz Arena yang sudah ada (selalu ikut disimpan untuk offline). */
async function hostClipUrls(): Promise<string[]> {
  const urls: string[] = []
  for (const text of QUIZ_HOST_LINES) {
    const key = clipKeyOf(text, 'quizhost')
    if (await clipExists(key)) urls.push(`/tts/${key}.mp3`)
  }
  return urls
}

export async function todayClipUrls(tx: Tx, learnerId: string, date: IsoDate = jakartaDate()): Promise<string[]> {
  const host = await hostClipUrls()
  const quests = await tx
    .select({ attemptId: quest.attemptId, skillId: quest.skillId, mode: quest.mode, status: quest.status })
    .from(quest)
    .where(and(eq(quest.learnerId, learnerId), eq(quest.date, date)))
  const open = quests.filter((q) => q.status !== 'done' && q.attemptId)
  if (open.length === 0) return host
  const attempts = await tx
    .select({ items: attempt.items })
    .from(attempt)
    .where(inArray(attempt.id, open.map((q) => q.attemptId!)))
  const refs = attempts.flatMap((a) => ((a.items as AttemptItem[]) ?? []).map((i) => i.ref))
  const items = await resolveItems(tx, refs)
  const clips: TtsClipRequest[] = []
  const seenPassages = new Set<string>()
  for (const item of items.values()) {
    clips.push(...itemSpeechClips(item))
    if (item.passage && !seenPassages.has(item.passage)) {
      seenPassages.add(item.passage)
      const p = passage(item.passage)
      if (p) clips.push(...passageSpeechClips(p))
    }
  }
  for (const q of open) {
    const l = q.skillId && q.mode === 'belajar' ? lesson(q.skillId) : undefined
    if (l) clips.push(...lessonSpeechClips(l))
  }
  const urls = new Set<string>(host)
  for (const c of clips) {
    const key = clipKeyOf(c.text, c.style)
    if (await clipExists(key)) urls.add(`/tts/${key}.mp3`)
  }
  return [...urls].slice(0, 600)
}
