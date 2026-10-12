import 'server-only'
import { and, desc, eq, gt, inArray } from 'drizzle-orm'
import { jakartaClock } from '@kira/core/time'
import { tables } from '@kira/db'
import type { ClaudeConnectionDTO } from '@/lib/dto'
import type { Actor } from '../auth/actor'
import { orgCtx } from '../auth/actor'
import { createMcpToken, listMcpTokens, revokeMcpToken } from '../auth/admin'
import { audit, auditTx } from '../audit'
import { inOrg } from '../db'
import { env, origin } from '../env'
import { AppError, conflict, notFound } from '../errors'
import { shellIn } from './console-shell'
import { enqueueAiJobTx, latestAiTest } from './console-studio'

/**
 * T14 Koneksi Claude: status AI di worker (hasil job ai.test terakhir), tes koneksi, dan token MCP.
 * Token MCP hanya ditampilkan sekali saat dibuat; yang tersimpan hanya hash-nya (server/auth/admin.ts).
 */

const { job } = tables

export const MCP_PATH = '/api/mcp'

function pendingNote(since: Date | null): string {
  return since ? ` Tes baru menunggu worker sejak pukul ${jakartaClock(since)} WIB. Muat ulang halaman ini setelah worker berjalan.` : ''
}

export async function claudeConnectionDTO(actor: Actor): Promise<ClaudeConnectionDTO> {
  const ctx = orgCtx(actor)
  const base = await inOrg(ctx, async (tx) => {
    const { shell } = await shellIn(tx, actor, null)
    const { last, pendingSince } = await latestAiTest(tx)
    return { shell, last, pendingSince }
  })
  const provider = env().AI_PROVIDER
  let status: ClaudeConnectionDTO['status']
  let detail: string
  if (provider === 'none') {
    status = 'not-configured'
    detail = 'AI_PROVIDER di server diisi none, jadi Studio AI dan saran nilai mati. Isi AI_PROVIDER dengan claude-code atau openai-compatible, jalankan ulang web dan worker, lalu tes koneksi.'
  } else if (base.last) {
    status = base.last.ok ? 'connected' : 'error'
    detail = `${base.last.detail}${pendingNote(base.pendingSince)}`
  } else {
    status = 'not-configured'
    detail = `Belum ada hasil tes koneksi. Tekan Tes koneksi untuk memeriksa apakah worker bisa memakai AI.${pendingNote(base.pendingSince)}`
  }
  const tokens = await listMcpTokens(actor.orgId)
  return {
    shell: base.shell,
    provider,
    status,
    detail,
    lastCheckAt: base.last ? base.last.at.toISOString() : null,
    mcp: {
      enabled: env().KIRA_MCP === 'on',
      url: `${origin()}${MCP_PATH}`,
      tokens: tokens.map((t) => ({ id: t.id, name: t.name, createdAt: t.createdAt.toISOString(), lastUsedAt: t.lastUsedAt ? t.lastUsedAt.toISOString() : null })),
    },
  }
}

const MAX_TOKENS = 20

/** Token MCP baru untuk tutor ini. Token asli hanya dikembalikan sekali; audit hanya mencatat id dan nama. */
export async function createMcpTokenFor(actor: Actor, name: string): Promise<{ token: string }> {
  if (env().KIRA_MCP !== 'on') throw conflict('Server MCP sedang mati. Nyalakan KIRA_MCP di pengaturan server, lalu muat ulang halaman ini.')
  const existing = await listMcpTokens(actor.orgId)
  if (existing.length >= MAX_TOKENS) throw conflict(`Sudah ada ${MAX_TOKENS} token aktif. Cabut token yang tidak dipakai, lalu buat token baru.`)
  if (existing.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
    throw conflict(`Token bernama ${name} sudah ada. Pakai nama lain supaya mudah dicabut nanti.`)
  }
  const created = await createMcpToken(actor.orgId, actor.userId, name)
  await audit(orgCtx(actor), 'mcp.token.created', created.id, { name })
  return { token: created.token }
}

export async function revokeMcpTokenFor(actor: Actor, tokenId: string): Promise<void> {
  const ok = await revokeMcpToken(actor.orgId, tokenId)
  if (!ok) throw notFound('Token tidak ditemukan atau sudah dicabut. Muat ulang halaman ini.')
  await audit(orgCtx(actor), 'mcp.token.revoked', tokenId)
}

const POLL_MS = 500
const WAIT_MS = 25_000
/** Tes yang masih menunggu worker dipakai lagi supaya klik berulang tidak menumpuk job. */
const REUSE_MS = 10 * 60 * 1000

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Antrekan job ai.test lalu tunggu hasilnya paling lama 25 detik. Berhasil: detail dari worker.
 * Gagal: AppError dengan detail dari worker. Worker belum menjawab: AppError yang meminta muat ulang nanti.
 */
export async function runConnectionTest(actor: Actor): Promise<{ detail: string }> {
  if (env().AI_PROVIDER === 'none') {
    throw conflict('AI_PROVIDER di server diisi none, jadi tidak ada yang bisa dites. Isi AI_PROVIDER di pengaturan server, jalankan ulang web dan worker, lalu tes lagi.')
  }
  const ctx = orgCtx(actor)
  const jobId = await inOrg(ctx, async (tx) => {
    const [open] = await tx
      .select({ id: job.id })
      .from(job)
      .where(and(eq(job.kind, 'ai.test'), inArray(job.status, ['queued', 'running']), gt(job.createdAt, new Date(Date.now() - REUSE_MS))))
      .orderBy(desc(job.createdAt))
      .limit(1)
    if (open) return open.id
    const queued = await enqueueAiJobTx(tx, ctx, { kind: 'test' })
    await auditTx(tx, ctx, 'ai.test.requested', queued.aiJobId)
    return queued.jobId
  })

  const deadline = Date.now() + WAIT_MS
  while (Date.now() < deadline) {
    await sleep(POLL_MS)
    const [row] = await inOrg(ctx, (tx) => tx.select({ status: job.status, result: job.result, lastError: job.lastError }).from(job).where(eq(job.id, jobId)).limit(1))
    if (!row) break
    if (row.status !== 'done' && row.status !== 'failed') continue
    const result = row.result as { ok?: unknown; detail?: unknown } | null
    const detail = typeof result?.detail === 'string' && result.detail.trim() ? result.detail : row.lastError
    if (row.status === 'done' && result?.ok === true) return { detail: detail ?? 'Worker bisa memakai AI.' }
    throw new AppError('unavailable', detail ?? 'Tes koneksi gagal tanpa keterangan. Lihat log worker.')
  }
  throw new AppError('unavailable', 'Tes koneksi masih menunggu worker. Hasilnya tampil di halaman ini setelah dimuat ulang. Bila tetap menunggu, pastikan worker Kira berjalan.')
}
