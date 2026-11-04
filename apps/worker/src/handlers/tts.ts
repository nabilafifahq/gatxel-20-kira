import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import { findContentDir, loadContent } from '@kira/content/load'
import { loadSpelling } from '@kira/content/spelling'
import { spellingSpeechClips } from '@kira/content/speech'
import { itemSchema } from '@kira/content/schema'
import { isClipText, isTtsStyle, TTS_VOICE_VERSION, ttsKeyInput, type TtsClipRequest } from '@kira/core/tts'
import { tables, withOrg } from '@kira/db'
import { PostponeError, abortError, whenWib } from '../errors'
import { createTtsClient } from '../tts/client'
import { dedupe, globalClipKeys, itemClips, repoClips } from '../tts/collect'
import { clipKey, hasClip, PUBLIC_SCOPE, readServedVersion, writeClip, type ClipScope } from '../tts/store'
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

/** Klip yang dibuat. `orgId` terisi bila klip milik satu org (soal org): disimpan di folder keluarga, bukan publik. */
export type ClipJob = TtsClipRequest & { orgId?: string }
const scopeOf = (c: ClipJob): ClipScope => (c.orgId ? { kind: 'org', orgId: c.orgId } : PUBLIC_SCOPE)

/** Klip per panggilan /batch. Layanan membaginya lagi ke beberapa proses mesin. */
const BATCH_SIZE = 32

/**
 * Buat klip yang belum ada. Bisa dilanjutkan: klip yang sudah ada dilewati. Mengembalikan angka ringkasan dan
 * alasan berhenti bila berhenti lebih awal.
 */
export async function generate(h: HandlerCtx, clips: ClipJob[], opts: { heartbeat: boolean; version?: string }): Promise<Totals> {
  const version = opts.version ?? TTS_VOICE_VERSION
  const url = h.env.TTS_URL
  const dataDir = h.env.KIRA_DATA_DIR
  const t: Totals = { total: clips.length, existing: 0, generated: 0, failed: 0, remaining: 0, stoppedBy: null, avgMs: null, device: null }
  const todo: ClipJob[] = []
  for (const c of clips) {
    if (await hasClip(dataDir, clipKey(c.text, c.style, version), scopeOf(c))) t.existing++
    else todo.push(c)
  }
  t.remaining = todo.length
  if (todo.length === 0 || !url) return t

  const client = createTtsClient(url, h.env.KIRA_INTERNAL_TOKEN)
  let beat = Date.now()
  let consecutiveFailures = 0
  const started = Date.now()
  for (let at = 0; at < todo.length && !t.stoppedBy; at += BATCH_SIZE) {
    if (h.signal.aborted) throw abortError()
    const group = todo.slice(at, at + BATCH_SIZE)
    const res = await client.synthesizeBatch(group, h.signal)
    if (!res.ok) {
      if (res.code === 'gpu_oom' || res.code === 'unavailable') {
        t.stoppedBy = res.code
        h.log.warn('pembuatan suara berhenti', { reason: res.code, detail: res.detail, generated: t.generated, remaining: t.remaining })
        break
      }
      t.failed += group.length
      consecutiveFailures += group.length
      h.log.warn('potongan klip gagal dibuat', { detail: res.detail, clips: group.length })
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) t.stoppedBy = 'failing'
      continue
    }
    t.device = res.device
    for (const [k, item] of res.items.entries()) {
      const c = group[k]!
      if (item.ok) {
        await writeClip(dataDir, clipKey(c.text, c.style, version), item.audio, scopeOf(c))
        t.generated++
        t.remaining--
        consecutiveFailures = 0
      } else {
        t.failed++
        consecutiveFailures++
        h.log.warn('klip gagal dibuat', { detail: item.detail, text: c.text.slice(0, 60), style: c.style })
      }
    }
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) t.stoppedBy = 'failing'
    if (opts.heartbeat && Date.now() - beat >= HEARTBEAT_MS) {
      beat = Date.now()
      await touchJob(h)
      h.log.info('suara berjalan', { generated: t.generated, remaining: t.remaining, clipsPerSecond: Number((t.generated / Math.max(1, (Date.now() - started) / 1000)).toFixed(2)) })
    }
  }
  t.avgMs = t.generated > 0 ? Math.round((Date.now() - started) / t.generated) : null
  return t
}

/**
 * Muatan tts.batch: `{ scope: "all" }` dari jadwal malam, atau `{ source: "weekly-sourcing", refs: ["org:<id>", ...] }` dari
 * pembaruan mingguan sumber soal (hanya soal org yang baru masuk). `waits` ditambahkan batch sendiri saat menunggu GPU.
 */
const batchPayload = z
  .object({
    scope: z.literal('all').optional(),
    source: z.string().max(40).optional(),
    refs: z.array(z.string().regex(/^org:[0-9a-f-]{36}$/)).max(1000).optional(),
    waits: z.number().optional(),
  })
  .passthrough()

async function orgClips(h: HandlerCtx, only?: readonly string[]): Promise<ClipJob[]> {
  const rows = await withOrg(h.db, h.org, (tx) =>
    tx
      .select({ body: tables.orgItem.body })
      .from(tables.orgItem)
      .where(and(eq(tables.orgItem.orgId, h.org.orgId), isNull(tables.orgItem.retiredAt), ...(only ? [inArray(tables.orgItem.id, [...only])] : []))),
  )
  const out: ClipJob[] = []
  for (const r of rows) {
    const parsed = itemSchema.safeParse(r.body)
    if (parsed.success) out.push(...itemClips(parsed.data).map((c) => ({ ...c, orgId: h.org.orgId })))
  }
  return out
}

export const ttsBatchHandler: Handler = {
  async run(h) {
    if (!h.env.TTS_URL) return { skipped: 'TTS_URL belum diisi, suara bahasa Inggris memakai suara tablet.' }
    const client = createTtsClient(h.env.TTS_URL, h.env.KIRA_INTERNAL_TOKEN)
    const health = await client.health(h.signal)
    if (!health.ok) return { skipped: 'Layanan suara (tts) tidak terjangkau. Jalankan profil tts lalu coba lagi.' }

    // Soal org yang baru masuk (pembaruan mingguan): hanya klipnya, tanpa menghitung ulang seluruh konten repo.
    const scoped = batchPayload.safeParse(h.job.payload)
    const refs = scoped.success ? (scoped.data.refs ?? []) : []
    let clips: ClipJob[]
    if (refs.length > 0) {
      clips = dedupe<ClipJob>(await orgClips(h, refs.map((r) => r.slice('org:'.length)))).filter((c) => isClipText(c.text))
    } else {
      const { index, errors } = loadContent()
      if (errors.length > 0) h.log.warn('konten punya error, soal yang rusak dilewati', { count: errors.length })
      const spelling = loadSpelling(findContentDir())
      const spellingClips = Object.values(spelling.levels).flatMap((words) => spellingSpeechClips(words))
      clips = dedupe<ClipJob>([...repoClips(index), ...spellingClips, ...(await orgClips(h))]).filter((c) => isClipText(c.text))
    }
    // Versi yang dibuat = versi layanan (backend dan nama suaranya). Bila berbeda dari versi yang disajikan, ini set calon:
    // ia dibuat penuh, diperiksa gerbang mutu, lalu dipromosikan dengan pnpm tts:promote. Anak tetap mendengar versi lama.
    const version = health.voiceVersion ?? TTS_VOICE_VERSION
    h.log.info('batch suara mulai', { clips: clips.length, scoped: refs.length, version, served: await readServedVersion(h.env.KIRA_DATA_DIR) })
    const t = await generate(h, clips, { heartbeat: true, version })
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
    // Klip sesuai permintaan hanya dibuat bila layanan memakai suara yang SEDANG disajikan. Bila tidak, dilewati:
    // anak tidak boleh mendengar dua suara di antara pertanyaan (suara perangkat dipakai sampai klipnya ada).
    const served = await readServedVersion(h.env.KIRA_DATA_DIR)
    const health = await createTtsClient(h.env.TTS_URL, h.env.KIRA_INTERNAL_TOKEN).health(h.signal)
    if (!health.ok) return { skipped: 'Layanan suara tidak terjangkau' }
    if ((health.voiceVersion ?? TTS_VOICE_VERSION) !== served) return { skipped: `Layanan memakai suara ${health.voiceVersion ?? '?'}, yang disajikan ${served}` }
    // Teks konten bersama dibuat publik. Teks lain (soal milik org) hanya untuk org pemintanya.
    const global = globalClipKeys(served)
    const clips = dedupe<ClipJob>(
      parsed.data.clips.flatMap((c): ClipJob[] => {
        if (!isTtsStyle(c.style) || !isClipText(c.text)) return []
        return global.has(ttsKeyInput(c.text, c.style, served)) ? [{ text: c.text, style: c.style }] : [{ text: c.text, style: c.style, orgId: h.org.orgId }]
      }),
    )
    if (clips.length === 0) return { skipped: 'Tidak ada teks yang layak dibacakan.' }
    const t = await generate(h, clips, { heartbeat: false, version: served })
    // GPU penuh atau layanan mati: dilewati tanpa coba lagi. Layar learner sudah memakai suara tablet dan akan meminta lagi.
    if (t.stoppedBy) return { ...t, skipped: t.stoppedBy === 'gpu_oom' ? 'GPU penuh' : t.stoppedBy === 'unavailable' ? 'Layanan suara tidak terjangkau' : 'Gagal berulang' }
    return t
  },
}
