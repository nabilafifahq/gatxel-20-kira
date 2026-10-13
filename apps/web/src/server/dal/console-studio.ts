import 'server-only'
import { and, desc, eq, gte, inArray, isNull, ne, sql } from 'drizzle-orm'
import { z } from 'zod'
import { formatDateId, jakartaDate, jakartaMidnight, type IsoDate } from '@kira/core/time'
import { tables, type AiJobInput, type AiSkillBrief, type JobKind } from '@kira/db'
import { itemSchema, MANUAL_TYPES, SKILL_ID, skillGrade, skillSubject, type Item } from '@kira/content'
import { semanticProblems } from '@kira/content/load'
import { GENERATORS, generateItem, genRef } from '@kira/content/math'
import type { AiDraftDTO, StudioAiDTO } from '@/lib/dto'
import type { Actor } from '../auth/actor'
import { orgCtx } from '../auth/actor'
import { auditTx } from '../audit'
import type { OrgContext, Tx } from '../db'
import { inOrg } from '../db'
import { env, type Env } from '../env'
import { conflict, invalid, notFound } from '../errors'
import { log } from '../log'
import { skillOptions, skillTitle } from './console-common'
import { shellIn } from './console-shell'
import { content, resolveItems, skill, toClient } from './content'
import { enqueueJobTx } from './jobs'

/**
 * T11 Studio AI dan bantuan AI bersama (kuota bulanan, status provider, ringkasan skill, antrean job AI).
 * AI hanya dijalankan worker. Isi `ai_job.input` mengikuti kontrak AiJobInput di packages/db/src/jobs.ts
 * dan tidak pernah memuat nama, email, atau data identitas anak.
 */

const { aiJob, aiDraft, orgItem, job, learnerProfile } = tables

// ---------------------------------------------------------------------------
// Kuota dan provider

export const PROVIDER_NAME: Record<Env['AI_PROVIDER'], string> = {
  'claude-code': 'Claude Code (langganan)',
  'openai-compatible': 'Endpoint OpenAI-compatible',
  none: 'AI dimatikan',
}

/** Tanggal 1 bulan ini dan bulan depan (WIB). */
export function monthBounds(today: IsoDate): { start: IsoDate; next: IsoDate } {
  const [y, m] = today.split('-').map(Number) as [number, number]
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
  return { start: `${today.slice(0, 7)}-01`, next }
}

/** Job AI yang dibuat bulan ini (WIB). Draf dari MCP tidak dihitung karena tidak dijalankan worker. */
export async function aiUsage(tx: Tx, today: IsoDate = jakartaDate()): Promise<{ used: number; limit: number }> {
  const since = jakartaMidnight(monthBounds(today).start)
  const [row] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(aiJob)
    .where(and(gte(aiJob.createdAt, since), ne(aiJob.kind, 'mcp')))
  return { used: row?.n ?? 0, limit: env().AI_MONTHLY_JOB_LIMIT }
}

export function quotaMessage(limit: number, today: IsoDate = jakartaDate()): string {
  return `Batas ${limit} job AI bulan ini sudah tercapai. Permintaan baru bisa dikirim lagi mulai ${formatDateId(monthBounds(today).next)}. Batas diubah lewat AI_MONTHLY_JOB_LIMIT di server.`
}

export async function assertAiQuota(tx: Tx): Promise<void> {
  const u = await aiUsage(tx)
  if (u.used >= u.limit) throw conflict(quotaMessage(u.limit))
}

export function assertAiProvider(): void {
  if (env().AI_PROVIDER === 'none') {
    throw conflict('AI di server ini dimatikan (AI_PROVIDER none). Isi AI_PROVIDER di pengaturan server, jalankan ulang web dan worker, lalu coba lagi.')
  }
}

const aiTestResult = z.object({ ok: z.boolean(), detail: z.string().max(2000), provider: z.string().max(60).optional(), model: z.string().max(120).nullable().optional() })

export type AiTestInfo = { ok: boolean; detail: string; at: Date }

/** Hasil job ai.test terakhir (job.result) dan tes yang masih menunggu worker. */
export async function latestAiTest(tx: Tx): Promise<{ last: AiTestInfo | null; pendingSince: Date | null }> {
  const rows = await tx
    .select({ status: job.status, result: job.result, lastError: job.lastError, createdAt: job.createdAt, finishedAt: job.finishedAt })
    .from(job)
    .where(eq(job.kind, 'ai.test'))
    .orderBy(desc(job.createdAt))
    .limit(10)
  let last: AiTestInfo | null = null
  let pendingSince: Date | null = null
  for (const r of rows) {
    if (r.status === 'queued' || r.status === 'running') {
      if (!last) pendingSince = r.createdAt
      continue
    }
    const parsed = aiTestResult.safeParse(r.result)
    if (parsed.success) last = { ok: r.status === 'done' && parsed.data.ok, detail: parsed.data.detail, at: r.finishedAt ?? r.createdAt }
    else last = { ok: false, detail: r.lastError ?? 'Tes koneksi gagal tanpa keterangan. Lihat log worker.', at: r.finishedAt ?? r.createdAt }
    break
  }
  return { last, pendingSince }
}

export async function studioProvider(tx: Tx): Promise<StudioAiDTO['provider']> {
  const provider = env().AI_PROVIDER
  const name = PROVIDER_NAME[provider]
  if (provider === 'none') {
    return { name, ready: false, detail: 'AI_PROVIDER di server diisi none, jadi Studio AI dan saran nilai mati. Ubah pengaturan server, lalu jalankan ulang web dan worker.' }
  }
  const { last } = await latestAiTest(tx)
  if (!last) return { name, ready: true, detail: 'Koneksi belum pernah dites. Tes dari halaman Koneksi Claude.' }
  if (!last.ok) return { name, ready: false, detail: `Tes koneksi terakhir gagal: ${last.detail}` }
  return { name, ready: true, detail: last.detail }
}

// ---------------------------------------------------------------------------
// Isi job AI

export function skillBrief(skillId: string): AiSkillBrief {
  const s = skill(skillId)
  if (!s) throw notFound(`Skill ${skillId} tidak ada di konten. Pilih skill dari daftar, lalu kirim lagi.`)
  return { id: s.id, subject: s.subject, grade: s.grade, title: s.title, canDo: s.canDo, strand: s.strand }
}

const AI_JOB_KIND: Record<AiJobInput['kind'], JobKind> = {
  items: 'ai.items',
  variants: 'ai.variants',
  hints: 'ai.hints',
  translate: 'ai.translate',
  rubric: 'ai.rubric',
  grade: 'ai.grade',
  import: 'ai.import',
  test: 'ai.test',
}

/** Tulis ai_job lalu job worker-nya dalam transaksi yang sama. */
export async function enqueueAiJobTx(tx: Tx, ctx: OrgContext, input: AiJobInput): Promise<{ aiJobId: string; jobId: string }> {
  const [row] = await tx.insert(aiJob).values({ orgId: ctx.orgId, kind: input.kind, status: 'queued', input, createdBy: ctx.userId }).returning({ id: aiJob.id })
  const jobId = await enqueueJobTx(tx, ctx, AI_JOB_KIND[input.kind], { aiJobId: row!.id })
  return { aiJobId: row!.id, jobId }
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Instruksi tutor dikirim ke AI apa adanya, jadi tidak boleh memuat email, NIK, atau nama learner. */
export function childDataProblem(text: string, learnerNames: readonly string[]): string | null {
  if (/[^\s@]+@[^\s@]+\.[^\s@]{2,}/.test(text)) return 'Instruksi memuat alamat email. Hapus data pribadi dari instruksi, lalu kirim lagi.'
  if (/(?<!\d)\d{16}(?!\d)/.test(text)) return 'Instruksi memuat angka 16 digit seperti NIK. Hapus data pribadi dari instruksi, lalu kirim lagi.'
  for (const name of learnerNames) {
    const full = name.trim()
    const parts = [...new Set([full, ...full.split(/\s+/)])].filter((p) => p.length >= 3)
    for (const p of parts) {
      if (new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(p)}(?![\\p{L}\\p{N}])`, 'iu').test(text)) {
        return `Instruksi memuat nama learner (${p}). Hapus nama anak dari instruksi, lalu kirim lagi.`
      }
    }
  }
  return null
}

const AI_ITEM_TYPES: readonly string[] = ['mcq', 'multi', 'numeric', 'text', 'order', 'match', 'sort', 'write', 'speak', 'draw']

export type DraftKind = 'items' | 'variants' | 'hints' | 'translate' | 'rubric'
export type DraftRequest = { kind: DraftKind; skillId: string; count: number; difficulty: number; itemRef?: string; instructions: string }

/** Contoh soal untuk job items: soal repo, lalu soal org, lalu soal generator, yang kesulitannya paling dekat. */
async function examplesFor(tx: Tx, skillId: string, difficulty: number): Promise<Item[]> {
  const near = (a: { difficulty: number }, b: { difficulty: number }) => Math.abs(a.difficulty - difficulty) - Math.abs(b.difficulty - difficulty)
  const out: Item[] = [...(content().itemsBySkill.get(skillId) ?? [])].sort((a, b) => near(a, b) || a.id.localeCompare(b.id)).slice(0, 3)
  if (out.length < 3) {
    const rows = await tx
      .select({ id: orgItem.id, body: orgItem.body })
      .from(orgItem)
      .where(and(eq(orgItem.skillId, skillId), isNull(orgItem.retiredAt)))
      .orderBy(desc(orgItem.createdAt))
      .limit(10)
    for (const r of rows) {
      const parsed = itemSchema.safeParse({ ...(r.body as object), id: `org:${r.id}` })
      if (parsed.success && out.length < 3) out.push(parsed.data)
    }
  }
  const gen = GENERATORS.get(skillId)
  if (out.length < 3 && gen) {
    const levels = [...gen.levels].sort((a, b) => Math.abs(a - difficulty) - Math.abs(b - difficulty))
    for (let i = 0; out.length < 3 && i < 3; i++) {
      try {
        out.push(generateItem(genRef(skillId, levels[i % levels.length]!, `studio${i + 1}`)))
      } catch (e) {
        log.warn('contoh generator gagal dibuat', { skillId, error: e })
        break
      }
    }
  }
  return out
}

export async function requestDraftsTx(tx: Tx, ctx: OrgContext, req: DraftRequest): Promise<string> {
  assertAiProvider()
  await assertAiQuota(tx)
  const instructions = req.instructions.trim()
  const names = await tx.select({ name: learnerProfile.name }).from(learnerProfile)
  const problem = childDataProblem(instructions, names.map((n) => n.name))
  if (problem) throw invalid(problem, { instructions: problem })

  let input: AiJobInput
  if (req.kind === 'items') {
    const brief = skillBrief(req.skillId)
    input = { kind: 'items', skill: brief, count: req.count, difficulty: req.difficulty, instructions, examples: await examplesFor(tx, brief.id, req.difficulty) }
  } else {
    const ref = req.itemRef?.trim() ?? ''
    if (!ref) throw invalid('Tulis ID soal asal untuk jenis draf ini, misalnya m2.oly-patterns.003 atau org:<id> dari Bank soal.', { itemRef: 'Isi ID soal asal.' })
    const item = (await resolveItems(tx, [ref])).get(ref)
    if (!item) throw notFound(`Soal ${ref} tidak ditemukan. Salin ID soal dari Bank soal, lalu kirim lagi.`)
    if (req.kind === 'rubric' && !MANUAL_TYPES.includes(item.type)) {
      throw invalid(`Soal ${ref} berjenis ${item.type}. Rubrik hanya untuk soal write, speak, atau draw.`, { itemRef: 'Pilih soal write, speak, atau draw.' })
    }
    if ((req.kind === 'variants' || req.kind === 'translate') && !AI_ITEM_TYPES.includes(item.type)) {
      throw invalid(`Jenis soal ${item.type} belum bisa dibuatkan ${req.kind === 'variants' ? 'varian' : 'terjemahan'} oleh AI. Pilih soal lain.`, { itemRef: 'Jenis soal ini belum didukung.' })
    }
    // Skill selalu mengikuti soal asal supaya draf tetap di skill yang sama.
    const brief = skillBrief(item.skill)
    switch (req.kind) {
      case 'variants':
        input = { kind: 'variants', skill: brief, count: req.count, difficulty: req.difficulty, instructions, itemRef: ref, item }
        break
      case 'hints':
        input = { kind: 'hints', skill: brief, instructions, itemRef: ref, item }
        break
      case 'translate':
        input = { kind: 'translate', skill: brief, instructions, itemRef: ref, item, to: item.lang === 'id' ? 'en-GB' : 'id' }
        break
      case 'rubric':
        input = { kind: 'rubric', skill: brief, instructions, itemRef: ref, item }
        break
    }
  }
  const { aiJobId } = await enqueueAiJobTx(tx, ctx, input)
  await auditTx(tx, ctx, 'ai.drafts.requested', aiJobId, { kind: req.kind, skillId: input.skill.id, ...(req.kind === 'items' || req.kind === 'variants' ? { count: req.count } : {}) })
  return aiJobId
}

// ---------------------------------------------------------------------------
// Tinjau draf

const MAX_DRAFT_JSON_BYTES = 20 * 1024

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

/** Ringkasan masalah Zod yang bisa dibaca tutor: "options.2.text: terlalu panjang". */
export function schemaIssues(error: z.ZodError, max = 3): string {
  return error.issues
    .slice(0, max)
    .map((i) => {
      const path = i.path.map(String).join('.') || 'soal'
      switch (i.code) {
        case 'too_small':
          return `${path} terlalu sedikit atau terlalu pendek`
        case 'too_big':
          return `${path} terlalu banyak atau terlalu panjang`
        case 'invalid_type':
          return `${path} kosong atau tipenya salah`
        case 'unrecognized_keys':
          return `${path} punya kolom yang tidak dikenal (${i.keys.join(', ')})`
        case 'invalid_union':
          return `${path} tidak cocok dengan jenis soal`
        default:
          return `${path} tidak valid`
      }
    })
    .join('; ')
}

/** Skill draf: dari isi draf bila valid, selain itu dari permintaan job. */
export function draftSkill(body: unknown, jobInput: unknown): string | null {
  const fromBody = isPlainObject(body) ? body.skill : undefined
  if (typeof fromBody === 'string' && SKILL_ID.test(fromBody) && skill(fromBody)) return fromBody
  if (isPlainObject(jobInput)) {
    const s = isPlainObject(jobInput.skill) ? jobInput.skill.id : jobInput.skillId
    if (typeof s === 'string' && SKILL_ID.test(s) && skill(s)) return s
  }
  return null
}

/** Parse dan validasi JSON draf yang disetujui tutor. Id, sumber, dan skill selalu dipaksa dari server. */
export function parseApprovedDraft(json: string, skillId: string): { ok: true; item: Item } | { ok: false; message: string } {
  if (Buffer.byteLength(json, 'utf8') > MAX_DRAFT_JSON_BYTES) return { ok: false, message: 'JSON draf lebih dari 20 KB. Pendekkan isinya, lalu setujui lagi.' }
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return { ok: false, message: 'JSON draf tidak valid. Periksa tanda kurung, tanda kutip, dan koma, lalu setujui lagi.' }
  }
  if (!isPlainObject(raw)) return { ok: false, message: 'JSON draf harus berupa satu objek soal di dalam kurung kurawal.' }
  const parsed = itemSchema.safeParse({ ...raw, id: 'draft', source: 'ai-draft', skill: skillId })
  if (!parsed.success) return { ok: false, message: `Draf belum lolos skema soal: ${schemaIssues(parsed.error)}. Perbaiki JSON-nya, lalu setujui lagi.` }
  const problems = semanticProblems(parsed.data)
  if (problems.length > 0) return { ok: false, message: `Draf masih punya masalah: ${problems.slice(0, 3).join('; ')}. Perbaiki JSON-nya, lalu setujui lagi.` }
  return { ok: true, item: parsed.data }
}

export async function approveDraftTx(tx: Tx, ctx: OrgContext, draftId: string, json: string): Promise<{ ref: string }> {
  const [d] = await tx
    .select({ id: aiDraft.id, status: aiDraft.status, body: aiDraft.body, jobInput: aiJob.input, jobCreatedBy: aiJob.createdBy })
    .from(aiDraft)
    .innerJoin(aiJob, eq(aiJob.id, aiDraft.jobId))
    .where(eq(aiDraft.id, draftId))
    .limit(1)
    .for('update', { of: aiDraft })
  if (!d) throw notFound('Draf tidak ditemukan. Muat ulang Studio AI.')
  if (d.status !== 'pending') throw conflict(`Draf ini sudah ${d.status === 'approved' ? 'disetujui' : 'ditolak'}. Muat ulang Studio AI untuk melihat status terbaru.`)
  const skillId = draftSkill(d.body, d.jobInput)
  if (!skillId) throw invalid('Skill draf ini tidak dikenal. Tolak draf ini lalu minta draf baru dari Studio AI.')
  const parsed = parseApprovedDraft(json, skillId)
  if (!parsed.ok) throw invalid(parsed.message, { json: parsed.message })
  const { id: _id, ...body } = parsed.item
  void _id
  const now = new Date()
  const [row] = await tx
    .insert(orgItem)
    .values({
      orgId: ctx.orgId,
      skillId,
      subject: skillSubject(skillId),
      grade: skillGrade(skillId),
      body,
      source: 'ai-draft',
      tags: parsed.item.tags,
      createdBy: d.jobCreatedBy,
      approvedBy: ctx.userId,
      approvedAt: now,
    })
    .returning({ id: orgItem.id })
  await tx.update(aiDraft).set({ status: 'approved', reviewedBy: ctx.userId, reviewedAt: now, orgItemId: row!.id }).where(eq(aiDraft.id, draftId))
  await auditTx(tx, ctx, 'ai.draft.approved', draftId, { orgItemId: row!.id, skillId })
  return { ref: `org:${row!.id}` }
}

export async function rejectDraftTx(tx: Tx, ctx: OrgContext, draftId: string): Promise<void> {
  const rows = await tx
    .update(aiDraft)
    .set({ status: 'rejected', reviewedBy: ctx.userId, reviewedAt: new Date() })
    .where(and(eq(aiDraft.id, draftId), eq(aiDraft.status, 'pending')))
    .returning({ id: aiDraft.id })
  if (rows.length === 0) {
    const [d] = await tx.select({ status: aiDraft.status }).from(aiDraft).where(eq(aiDraft.id, draftId)).limit(1)
    if (!d) throw notFound('Draf tidak ditemukan. Muat ulang Studio AI.')
    throw conflict(`Draf ini sudah ${d.status === 'approved' ? 'disetujui' : 'ditolak'}. Muat ulang Studio AI untuk melihat status terbaru.`)
  }
  await auditTx(tx, ctx, 'ai.draft.rejected', draftId)
}

// ---------------------------------------------------------------------------
// DTO

type JobRow = { kind: string; status: 'queued' | 'running' | 'done' | 'failed'; input: unknown; output: unknown; error: string | null }

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
const int = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) ? v : null)

/** Ringkasan satu job AI untuk daftar Job terakhir: jenis, skill, jumlah. Tanpa data learner. */
export function jobSummary(j: JobRow, titleOf: (skillId: string) => string): string {
  const input = isPlainObject(j.input) ? j.input : {}
  const output = isPlainObject(j.output) ? j.output : {}
  const skillId = (isPlainObject(input.skill) ? str(input.skill.id) : null) ?? str(input.skillId)
  const title = skillId ? titleOf(skillId) : null
  const ref = str(input.itemRef)
  const count = int(input.count)
  let base: string
  switch (j.kind) {
    case 'items':
      base = `${count ?? 'Beberapa'} soal baru${title ? ` ${title}` : ''}`
      break
    case 'variants':
      base = `${count ?? 'Beberapa'} varian${title ? ` ${title}` : ''}${ref ? ` dari ${ref}` : ''}`
      break
    case 'hints':
      base = `Hint bertingkat untuk ${ref ?? 'satu soal'}`
      break
    case 'translate':
      base = `Terjemahan ${ref ?? 'satu soal'} ke ${input.to === 'id' ? 'Bahasa Indonesia' : 'English'}`
      break
    case 'rubric':
      base = `Rubrik penilaian untuk ${ref ?? 'satu soal'}`
      break
    case 'grade':
      base = `Saran nilai${title ? ` ${title}` : ''}`
      break
    case 'import':
      base = `Baca PDF ${str(input.title) ?? 'paket impor'}`
      break
    case 'test':
      base = 'Tes koneksi AI'
      break
    case 'sourcing':
      // Pembaruan mingguan sumber soal (worker): draf yang antre di Studio berasal dari sini.
      base = 'Pembaruan soal mingguan dari sumber terbuka'
      if (j.status === 'done') {
        const published = int(output.published)
        const queued = int(output.queued)
        if (published !== null || queued !== null) base += `, ${published ?? 0} masuk bank dan ${queued ?? 0} antre untuk disetujui`
      }
      break
    case 'mcp':
      base = `${count ?? 'Beberapa'} draf${title ? ` ${title}` : ''} dari Claude lewat MCP`
      break
    default:
      base = `Job ${j.kind}`
  }
  if (j.status === 'done') {
    const drafts = int(output.drafts)
    const problems = int(output.withProblems)
    if ((j.kind === 'items' || j.kind === 'variants') && drafts !== null) base += `, ${drafts} draf jadi`
    if (problems) base += `, ${problems} perlu dicek`
    if (j.kind === 'import' && int(output.items) !== null) base += `, ${int(output.items)} soal terbaca`
  }
  if (j.status === 'queued' && j.error) base += `. ${j.error}`
  return base
}

const DRAFT_KINDS = new Set(['items', 'variants', 'hints', 'translate', 'rubric'])

export async function studioAiDTO(actor: Actor): Promise<StudioAiDTO> {
  const ctx = orgCtx(actor)
  return inOrg(ctx, async (tx) => {
    const { shell } = await shellIn(tx, actor, null)
    const provider = await studioProvider(tx)
    const usage = await aiUsage(tx)
    const jobs = await tx
      .select({ id: aiJob.id, kind: aiJob.kind, status: aiJob.status, input: aiJob.input, output: aiJob.output, error: aiJob.error, createdAt: aiJob.createdAt })
      .from(aiJob)
      .orderBy(desc(aiJob.createdAt))
      .limit(20)
    const draftCols = { id: aiDraft.id, jobId: aiDraft.jobId, kind: aiDraft.kind, status: aiDraft.status, body: aiDraft.body, problems: aiDraft.problems, compareRef: aiDraft.compareRef, createdAt: aiDraft.createdAt }
    const pending = await tx.select(draftCols).from(aiDraft).where(eq(aiDraft.status, 'pending')).orderBy(desc(aiDraft.createdAt)).limit(100)
    const reviewed = await tx
      .select(draftCols)
      .from(aiDraft)
      .where(inArray(aiDraft.status, ['approved', 'rejected']))
      .orderBy(desc(aiDraft.reviewedAt), desc(aiDraft.createdAt))
      .limit(20)
    const all = [...pending, ...reviewed]
    const compareRefs = [...new Set(all.map((d) => d.compareRef).filter((r): r is string => Boolean(r)))]
    const compared = compareRefs.length ? await resolveItems(tx, compareRefs) : new Map<string, Item>()
    const drafts: AiDraftDTO[] = all.map((d) => {
      const parsed = itemSchema.safeParse(d.body)
      let item: AiDraftDTO['item'] = null
      if (parsed.success) {
        try {
          item = toClient(parsed.data, { ref: `draft-${d.id.slice(0, 8)}`, seed: d.id, includeKey: true, includeHints: true })
        } catch (e) {
          log.warn('draf gagal ditampilkan', { draftId: d.id, error: e })
        }
      }
      const source = d.compareRef ? compared.get(d.compareRef) : undefined
      return {
        id: d.id,
        jobId: d.jobId.slice(0, 8),
        kind: DRAFT_KINDS.has(d.kind) ? d.kind : 'items',
        status: d.status,
        createdAt: d.createdAt.toISOString(),
        item,
        json: JSON.stringify(d.body, null, 2),
        problems: d.problems,
        compareTo: source && d.compareRef ? { ref: d.compareRef, item: toClient(source, { ref: d.compareRef, seed: d.compareRef, includeKey: true, includeHints: true }) } : null,
      }
    })
    return {
      shell,
      provider,
      usage,
      jobs: jobs.map((j) => ({
        id: j.id,
        kind: j.kind,
        status: j.status,
        createdAt: j.createdAt.toISOString(),
        summary: jobSummary(j, skillTitle),
        error: j.status === 'failed' ? (j.error ?? 'Job gagal tanpa keterangan. Lihat log worker.') : null,
      })),
      drafts,
      skills: skillOptions().map((s) => ({ id: s.id, subject: s.subject, grade: s.grade, title: s.title })),
    }
  })
}
