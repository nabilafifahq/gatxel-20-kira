import { and, eq, gte, isNull, sql } from 'drizzle-orm'
import { JOB_KINDS, tables, type AiJobInput, type Tx } from '@kira/db'
import type { Item } from '@kira/content/schema'
import { SYSTEM_USER } from '../db'
import type { Candidate, Mapping, Subject } from './types'

/** Penulisan ke database untuk pengambilan sumber soal. Semua fungsi berjalan di dalam withOrg milik pemanggil. */

const { sourceRecord, sourceState, orgItem, aiDraft, aiJob, job } = tables

export type RecordInput = {
  sourceId: string
  candidate: Candidate
  mapping: Mapping | null
  item: Item | null
  hash: string
  license: string
  attribution: string
  keyOrigin: 'source' | 'ai' | 'none'
  verify: 'agree' | 'disagree' | 'ai-only' | 'unverified'
}

/** Soal tanpa id untuk org_item.body, sama dengan yang ditulis jalur persetujuan. */
export function bodyOf(item: Item): Record<string, unknown> {
  const { id: _id, ...body } = item
  void _id
  return body
}

/**
 * Catat dan langsung masukkan ke Bank soal: kunci sumber dan jawaban AI sama. Mengembalikan id org_item, atau null
 * bila soal yang sama sudah tercatat (kunci unik org dan hash).
 */
export async function publishRecord(tx: Tx, orgId: string, r: RecordInput, now: Date): Promise<string | null> {
  if (!r.item || !r.mapping) return null
  const [rec] = await tx
    .insert(sourceRecord)
    .values(baseValues(orgId, r, 'published', now))
    .onConflictDoNothing()
    .returning({ id: sourceRecord.id })
  if (!rec) return null
  const [row] = await tx
    .insert(orgItem)
    .values({
      orgId,
      skillId: r.mapping.skillId,
      subject: r.candidate.subject,
      grade: r.mapping.grade,
      body: bodyOf(r.item),
      source: 'imported',
      tags: r.item.tags,
      createdBy: SYSTEM_USER,
      // Kunci sumber dan jawaban AI sama: masuk otomatis tanpa persetujuan tutor, sesuai rencana 10.7.
      approvedAt: now,
    })
    .returning({ id: orgItem.id })
  await tx.update(sourceRecord).set({ orgItemId: row!.id }).where(eq(sourceRecord.id, rec.id))
  return row!.id
}

/** Catat dan kirim ke antrean Studio AI sebagai draf untuk disetujui tutor. */
export async function queueRecord(tx: Tx, orgId: string, jobId: string, r: RecordInput, problems: string[], now: Date): Promise<string | null> {
  if (!r.item || !r.mapping) return null
  const [rec] = await tx
    .insert(sourceRecord)
    .values(baseValues(orgId, r, 'queued', now))
    .onConflictDoNothing()
    .returning({ id: sourceRecord.id })
  if (!rec) return null
  const [draft] = await tx
    .insert(aiDraft)
    .values({ orgId, jobId, kind: 'items', status: 'pending', body: r.item as unknown as Record<string, unknown>, problems })
    .returning({ id: aiDraft.id })
  await tx.update(sourceRecord).set({ aiDraftId: draft!.id }).where(eq(sourceRecord.id, rec.id))
  return draft!.id
}

/** Catat soal yang lolos saringan tetapi belum punya skill (misalnya Pengetahuan Umum), tanpa membuat soal Kira. */
export async function recordUnmapped(tx: Tx, orgId: string, r: RecordInput, now: Date): Promise<boolean> {
  const rows = await tx.insert(sourceRecord).values(baseValues(orgId, r, 'unmapped', now)).onConflictDoNothing().returning({ id: sourceRecord.id })
  return rows.length > 0
}

function baseValues(orgId: string, r: RecordInput, status: 'published' | 'queued' | 'unmapped', now: Date) {
  return {
    orgId,
    sourceId: r.sourceId,
    kind: 'item' as const,
    externalId: r.candidate.externalId,
    contentHash: r.hash,
    subject: r.candidate.subject as Subject,
    grade: r.mapping?.grade ?? r.candidate.grade,
    skillId: r.mapping?.skillId ?? null,
    body: (r.item ? bodyOf(r.item) : { prompt: r.candidate.prompt, options: r.candidate.options ?? null, answer: r.candidate.answer, topic: r.candidate.topicHint ?? null }) as Record<string, unknown>,
    keyOrigin: r.keyOrigin,
    verify: r.verify,
    status,
    license: r.license,
    attribution: r.attribution,
    createdAt: now,
    updatedAt: now,
  }
}

export async function loadState(tx: Tx, sourceId: string): Promise<{ enabled: boolean; cursor: unknown }> {
  const [row] = await tx.select({ enabled: sourceState.enabled, cursor: sourceState.cursor }).from(sourceState).where(eq(sourceState.sourceId, sourceId)).limit(1)
  return { enabled: row?.enabled ?? true, cursor: row?.cursor ?? null }
}

export async function saveState(tx: Tx, orgId: string, sourceId: string, cursor: number, result: string, now: Date): Promise<void> {
  await tx
    .insert(sourceState)
    .values({ orgId, sourceId, cursor: { at: cursor }, lastRunAt: now, lastResult: result.slice(0, 300) })
    .onConflictDoUpdate({ target: [sourceState.orgId, sourceState.sourceId], set: { cursor: { at: cursor }, lastRunAt: now, lastResult: result.slice(0, 300) } })
}

/** Hash prompt yang sudah ada di org (catatan sumber dan soal org), untuk membuang yang dobel. */
export async function knownHashes(tx: Tx): Promise<Set<string>> {
  const rows = await tx.select({ h: sourceRecord.contentHash }).from(sourceRecord)
  return new Set(rows.map((r) => r.h))
}

export async function orgPrompts(tx: Tx): Promise<string[]> {
  const rows = await tx.select({ p: sql<string | null>`${orgItem.body}->>'prompt'` }).from(orgItem).where(isNull(orgItem.retiredAt))
  return rows.map((r) => r.p).filter((p): p is string => Boolean(p))
}

/** Jumlah soal org per skill (tanpa soal yang dipensiunkan). */
export async function orgCountsBySkill(tx: Tx): Promise<Map<string, number>> {
  const rows = await tx.select({ skillId: orgItem.skillId, n: sql<number>`count(*)::int` }).from(orgItem).where(isNull(orgItem.retiredAt)).groupBy(orgItem.skillId)
  return new Map(rows.map((r) => [r.skillId, r.n]))
}

/** Skill yang baru diminta draf AI dalam beberapa hari terakhir, supaya tidak diminta berulang tiap Minggu. */
export async function recentlyRequestedSkills(tx: Tx, since: Date): Promise<Set<string>> {
  const rows = await tx
    .select({ skill: sql<string | null>`${aiJob.input}->'skill'->>'id'` })
    .from(aiJob)
    .where(and(eq(aiJob.kind, 'items'), gte(aiJob.createdAt, since)))
  const pending = await tx.select({ skill: sql<string | null>`${aiDraft.body}->>'skill'` }).from(aiDraft).where(eq(aiDraft.status, 'pending'))
  return new Set([...rows, ...pending].map((r) => r.skill).filter((s): s is string => Boolean(s)))
}

// ---------------------------------------------------------------------------
// Job

/** Satu baris ai_job "sourcing" per org per pembaruan: menampung draf antrean Studio dan mencatat pemakaian AI. */
export async function startRun(tx: Tx, orgId: string, week: string, now: Date): Promise<string> {
  const [row] = await tx
    .insert(aiJob)
    .values({ orgId, kind: 'sourcing', status: 'running', input: { kind: 'sourcing', week }, createdBy: SYSTEM_USER, startedAt: now })
    .returning({ id: aiJob.id })
  return row!.id
}

export async function finishRun(tx: Tx, id: string, output: Record<string, unknown>, provider: string | null, model: string | null, now: Date, error: string | null = null): Promise<void> {
  await tx
    .update(aiJob)
    .set({ status: error ? 'failed' : 'done', output, error, provider, model, finishedAt: now })
    .where(eq(aiJob.id, id))
}

/** Antrekan job AI yang sudah ada handlernya (ai.items, ai.import) lewat tabel ai_job dan job. */
async function enqueueAi(tx: Tx, orgId: string, kind: 'ai.items' | 'ai.import', input: AiJobInput): Promise<string> {
  const [ai] = await tx.insert(aiJob).values({ orgId, kind: input.kind, status: 'queued', input, createdBy: SYSTEM_USER }).returning({ id: aiJob.id })
  const [j] = await tx.insert(job).values({ orgId, kind, payload: { aiJobId: ai!.id }, createdBy: SYSTEM_USER }).returning({ id: job.id })
  await tx.execute(sql`select pg_notify('kira_job', ${j!.id})`)
  return ai!.id
}

export const enqueueItemsDraft = (tx: Tx, orgId: string, input: Extract<AiJobInput, { kind: 'items' }>) => enqueueAi(tx, orgId, 'ai.items', input)
export const enqueueImport = (tx: Tx, orgId: string, input: Extract<AiJobInput, { kind: 'import' }>) => enqueueAi(tx, orgId, 'ai.import', input)

/**
 * Antrekan pembuatan suara untuk soal English baru. Muatan: { source: "weekly-sourcing", refs: ["org:<id>", ...] }; job
 * tts.batch (handlers/tts.ts) membuat klip hanya untuk soal org itu.
 */
export const TTS_JOB_KIND = 'tts.batch'

export function ttsAvailable(): boolean {
  return (JOB_KINDS as readonly string[]).includes(TTS_JOB_KIND)
}

export async function enqueueTts(tx: Tx, orgId: string, refs: string[]): Promise<string | null> {
  if (refs.length === 0 || !ttsAvailable()) return null
  const [j] = await tx
    .insert(job)
    .values({ orgId, kind: TTS_JOB_KIND, payload: { source: 'weekly-sourcing', refs }, createdBy: SYSTEM_USER })
    .returning({ id: job.id })
  await tx.execute(sql`select pg_notify('kira_job', ${j!.id})`)
  return j!.id
}
