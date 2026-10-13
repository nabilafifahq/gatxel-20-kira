import { and, eq, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import { loadContent } from '@kira/content/load'
import { itemSchema } from '@kira/content/schema'
import { isClipText, isTtsStyle, TTS_STYLE_MODEL, type TtsClipRequest } from '@kira/core/tts'
import { tables, withOrg } from '@kira/db'
import { PostponeError, abortError, whenWib } from '../errors'
import { createTtsClient } from '../tts/client'
import { dedupe, itemClips, repoClips } from '../tts/collect'
import { clipKey, hasClip, writeClip } from '../tts/store'
import type { Handler, HandlerCtx } from './types'

/**
 * Job suara bahasa Inggris. Layanan tts (deploy/tts) membuat klip mp3; di sini klip disimpan di
 * KIRA_DATA_DIR/tts/<sha256 teks+gaya>.mp3 dan disajikan web (apps/web/src/app/tts).
 *
 *   tts.batch  membuat semua klip yang belum ada untuk soal, pelajaran, dan bacaan English. Bisa berjam-jam,
 *              aman dihentikan dan dilanjutkan karena klip yang sudah ada dilewati.
 *   tts.clip   membuat beberapa klip yang diminta layar learner (konten baru).
 *
 * Layanan tidak ada atau GPU penuh bukan kegagalan: batch menunggu satu jam lalu lanjut, klip permintaan
 * dilewati (layar learner sudah memakai suara tablet), dan tidak ada job yang dicoba berulang kali.
 */

const HEARTBEAT_MS = 60_000
const POSTPONE_MS = 60 * 60 * 1000
const MAX_WAITS = 36
const MAX_CONSECUTIVE_FAILURES = 5

type Stop = 'gpu_oom' | 'unavailable' | 'failing' | null
export type Totals = {
  total: number
  existing: number
  generated: number
  failed: number
  remaining: number
  stoppedBy: Stop
  avgMs: number | null
  device: string | null
}

async function touchJob(h: HandlerCtx, patch: Record<string, unknown> = {}): Promise<void> {
  await withOrg(h.db, h.org, (tx) =>
    tx
      .update(tables.job)
      .set({ lockedAt: h.now(), ...(Object.keys(patch).length ? { payload: sql`${tables.job.payload} || ${JSON.stringify(patch)}::jsonb` } : {}) })
      .where(eq(tables.job.id, h.job.id)),
  )
}

/** Buat klip yang belum ada. Mengembalikan angka ringkasan dan alasan berhenti bila berhenti lebih awal. */
export async function generate(h: HandlerCtx, clips: TtsClipRequest[], opts: { heartbeat: boolean }): Promise<Totals> {
  const url = h.env.TTS_URL
  const dataDir = h.env.KIRA_DATA_DIR
  const t: Totals = { total: clips.length, existing: 0, generated: 0, failed: 0, remaining: 0, stoppedBy: null, avgMs: null, device: null }
  const todo: TtsClipRequest[] = []
  for (const c of clips) {
    if (await hasClip(dataDir, clipKey(c.text, c.style))) t.existing++
    else todo.push(c)
  }
  // Satu model pada satu waktu di GPU: kerjakan semua klip satu model dulu supaya layanan jarang bertukar model.
  todo.sort((a, b) => (TTS_STYLE_MODEL[a.style] === TTS_STYLE_MODEL[b.style] ? 0 : TTS_STYLE_MODEL[a.style] === 'design' ? -1 : 1))
  t.remaining = todo.length
  if (todo.length === 0 || !url) return t

  const client = createTtsClient(url, h.env.KIRA_INTERNAL_TOKEN)
  let beat = Date.now()
  let consecutiveFailures = 0
  let genMsSum = 0
  for (const c of todo) {
    if (h.signal.aborted) throw abortError()
    const res = await client.synthesize(c.text, c.style, h.signal)
    if (res.ok) {
      await writeClip(dataDir, clipKey(c.text, c.style), res.audio)
      t.generated++
      t.remaining--
      genMsSum += res.genMs
      t.device = res.device
      consecutiveFailures = 0
    } else if (res.code === 'gpu_oom' || res.code === 'unavailable') {
      t.stoppedBy = res.code
      h.log.warn('pembuatan suara berhenti', { reason: res.code, detail: res.detail, generated: t.generated, remaining: t.remaining })
      break
    } else {
      t.failed++
      consecutiveFailures++
      h.log.warn('klip gagal dibuat', { detail: res.detail, text: c.text.slice(0, 60), style: c.style })
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        t.stoppedBy = 'failing'
        break
      }
    }
    if (opts.heartbeat && Date.now() - beat >= HEARTBEAT_MS) {
      beat = Date.now()
      await touchJob(h)
      h.log.info('suara berjalan', { generated: t.generated, remaining: t.remaining, avgGenMs: Math.round(genMsSum / Math.max(1, t.generated)) })
    }
  }
  t.avgMs = t.generated > 0 ? Math.round(genMsSum / t.generated) : null
  return t
}

async function orgClips(h: HandlerCtx): Promise<TtsClipRequest[]> {
  const rows = await withOrg(h.db, h.org, (tx) =>
    tx.select({ body: tables.orgItem.body }).from(tables.orgItem).where(and(eq(tables.orgItem.orgId, h.org.orgId), isNull(tables.orgItem.retiredAt))),
  )
  const out: TtsClipRequest[] = []
  for (const r of rows) {
    const parsed = itemSchema.safeParse(r.body)
    if (parsed.success) out.push(...itemClips(parsed.data))
  }
  return out
}

export const ttsBatchHandler: Handler = {
  async run(h) {
    if (!h.env.TTS_URL) return { skipped: 'TTS_URL belum diisi, suara bahasa Inggris memakai suara tablet.' }
    const client = createTtsClient(h.env.TTS_URL, h.env.KIRA_INTERNAL_TOKEN)
    const health = await client.health(h.signal)
    if (!health.ok) return { skipped: 'Layanan suara (tts) tidak terjangkau. Jalankan profil tts lalu coba lagi.' }

    const { index, errors } = loadContent()
    if (errors.length > 0) h.log.warn('konten punya error, soal yang rusak dilewati', { count: errors.length })
    const clips = dedupe([...repoClips(index), ...(await orgClips(h))]).filter((c) => isClipText(c.text))
    h.log.info('batch suara mulai', { clips: clips.length })
    const t = await generate(h, clips, { heartbeat: true })
    h.log.info('batch suara selesai', { ...t })

    if (t.stoppedBy === 'gpu_oom' || t.stoppedBy === 'unavailable') {
      const waits = Number((h.job.payload as { waits?: number } | null)?.waits ?? 0)
      if (waits >= MAX_WAITS) return { ...t, gaveUp: true }
      const runAfter = new Date(h.now().getTime() + POSTPONE_MS)
      await touchJob(h, { waits: waits + 1 })
      throw new PostponeError(
        runAfter,
        `${t.stoppedBy === 'gpu_oom' ? 'GPU sedang penuh' : 'Layanan suara berhenti'}. ${t.generated} klip dibuat, ${t.remaining} tersisa. Dilanjutkan ${whenWib(runAfter, h.now())}.`,
      )
    }
    return t
  },
}

const clipPayload = z
  .object({ clips: z.array(z.object({ text: z.string().min(1).max(400), style: z.string() }).strict()).min(1).max(20) })
  .strict()

export const ttsClipHandler: Handler = {
  async run(h) {
    const parsed = clipPayload.safeParse(h.job.payload)
    if (!parsed.success) return { skipped: 'Isi job tidak valid.' }
    if (!h.env.TTS_URL) return { skipped: 'TTS_URL belum diisi.' }
    const clips = dedupe(parsed.data.clips.flatMap((c) => (isTtsStyle(c.style) && isClipText(c.text) ? [{ text: c.text, style: c.style }] : [])))
    if (clips.length === 0) return { skipped: 'Tidak ada teks yang layak dibacakan.' }
    const t = await generate(h, clips, { heartbeat: false })
    // GPU penuh atau layanan mati: dilewati tanpa coba lagi. Layar learner sudah memakai suara tablet dan akan meminta lagi.
    if (t.stoppedBy) return { ...t, skipped: t.stoppedBy === 'gpu_oom' ? 'GPU penuh' : t.stoppedBy === 'unavailable' ? 'Layanan suara tidak terjangkau' : 'Gagal berulang' }
    return t
  },
}
