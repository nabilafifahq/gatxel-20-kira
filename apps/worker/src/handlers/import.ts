import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { and, eq, inArray } from 'drizzle-orm'
import { tables, withOrg, type ImportStoredItem } from '@kira/db'
import { O } from '../ai/item-schema'
import { AI_TIMEOUT_MS } from '../ai/types'
import { JobError, UsageLimitError, isAbortError } from '../errors'
import { deleteStored, readStored, storeFile } from '../media'
import { ProcSpawnError, runProcess } from '../proc'
import { aiJobIdOf, completeAiJobTx, failAiJob, loadAiJob, markAiRunning } from './ai-job'
import { parseImport, worseStatus } from './import-parse'
import type { Handler, HandlerCtx } from './types'

/**
 * Job ai.import: membaca PDF paket resmi milik keluarga menjadi `import_batch.items`
 * (ImportStoredItem[]) dan gambar halaman (`import_batch.pages`, id media jenis page).
 * Teks dibaca dengan poppler (pdftotext -layout) dan diurai tanpa AI. Bila provider AI siap,
 * satu pemeriksaan tambahan menandai soal yang kuncinya berbeda dengan jawaban AI (key-mismatch);
 * kegagalan pemeriksaan ini tidak menggagalkan impor.
 * Status batch: parsing, lalu review, atau failed dengan pesan bahasa Indonesia.
 */

export const MAX_PAGES = 60
const DPI = '110'

async function tool(h: HandlerCtx, cmd: string, args: string[], timeoutMs: number): Promise<string> {
  let r
  try {
    r = await runProcess(cmd, args, { timeoutMs, signal: h.signal, maxStdout: 64 * 1024 * 1024 })
  } catch (e) {
    if (e instanceof ProcSpawnError) {
      throw new JobError('Program poppler (pdfinfo, pdftotext, pdftoppm) belum terpasang di server worker. Pasang paket poppler-utils di image worker.', { retryable: false, cause: e })
    }
    throw e
  }
  if (r.aborted) {
    const err = new Error('dibatalkan')
    err.name = 'AbortError'
    throw err
  }
  if (r.timedOut) throw new JobError('Membaca PDF terlalu lama. Coba unggah PDF yang lebih kecil.', { retryable: true })
  if (r.code !== 0) {
    h.log.warn('program PDF gagal', { cmd, code: r.code, stderr: r.stderr.slice(0, 300) })
    throw new JobError('PDF tidak bisa dibaca. Pastikan berkasnya tidak rusak dan tidak dikunci password.', { retryable: false })
  }
  return r.stdout
}

export function pageCount(pdfinfoOut: string): number | null {
  const m = /^Pages:\s+(\d+)/m.exec(pdfinfoOut)
  return m ? Number(m[1]) : null
}

const KEY_CHECK_SCHEMA = O({
  answers: {
    type: 'array',
    items: O({ number: { type: 'integer' }, answer: { type: ['integer', 'null'], description: 'Zero-based index of the correct option (A is 0), or null when unsure.' } }),
  },
})

/** Pemeriksaan kunci dengan AI. Mengembalikan nomor soal yang jawabannya berbeda dengan kunci, atau null bila dilewati. */
export async function aiKeyCheck(h: HandlerCtx, items: ImportStoredItem[], subject: string, grade: number): Promise<{ mismatched: Set<number>; model: string } | null> {
  const candidates = items.filter((i) => i.answerFromKey !== null && i.options.length >= 2 && i.status !== 'needs-check')
  if (!h.ai.ready || candidates.length === 0) return null
  const questions = candidates.map((i) => ({ number: i.number, prompt: i.prompt, options: i.options.map((o, k) => `${'ABCDE'[k]}. ${o}`) }))
  try {
    const out = await h.ai.run({
      system: `You check the answer key of a multiple choice contest paper for primary school children (${subject}, Grade ${grade}). Solve each question carefully. Reply only with the JSON object described by the schema.`,
      prompt: `For every question, give the zero-based index of the correct option (A is 0). Use null when the question needs a picture you cannot see or when you are not sure.\n\n${JSON.stringify(questions)}`,
      jsonSchema: KEY_CHECK_SCHEMA,
      tier: 'author',
      timeoutMs: AI_TIMEOUT_MS,
      signal: h.signal,
    })
    const answers = (out.json as { answers?: { number?: unknown; answer?: unknown }[] }).answers ?? []
    const byNumber = new Map(candidates.map((i) => [i.number, i]))
    const mismatched = new Set<number>()
    for (const a of answers) {
      const item = typeof a.number === 'number' ? byNumber.get(a.number) : undefined
      if (item && typeof a.answer === 'number' && a.answer !== item.answerFromKey) mismatched.add(item.number)
    }
    return { mismatched, model: out.model }
  } catch (e) {
    if (isAbortError(e)) throw e
    h.log.warn('pemeriksaan kunci AI dilewati', { reason: e instanceof UsageLimitError ? 'batas pemakaian' : e instanceof Error ? e.message : 'tidak diketahui' })
    return null
  }
}

async function setBatch(h: HandlerCtx, batchId: string, fields: { status: 'parsing' | 'review' | 'failed' | 'uploaded'; error: string | null }): Promise<void> {
  await withOrg(h.db, h.org, (tx) => tx.update(tables.importBatch).set({ ...fields, updatedAt: h.now() }).where(eq(tables.importBatch.id, batchId)))
}

export const importHandler: Handler = {
  async run(h) {
    const aj = await loadAiJob(h, 'import')
    const input = aj.input
    const batch = await withOrg(h.db, h.org, async (tx) => {
      const [b] = await tx
        .select({ id: tables.importBatch.id, status: tables.importBatch.status, mediaId: tables.importBatch.mediaId, pages: tables.importBatch.pages, createdBy: tables.importBatch.createdBy })
        .from(tables.importBatch)
        .where(eq(tables.importBatch.id, input.batchId))
        .limit(1)
      if (!b) return null
      const [m] = await tx
        .select({ path: tables.media.path, mime: tables.media.mime })
        .from(tables.media)
        .where(and(eq(tables.media.id, input.mediaId), eq(tables.media.kind, 'pdf')))
        .limit(1)
      return { ...b, media: m ?? null }
    })
    if (!batch) throw new JobError('Batch impor tidak ditemukan.', { retryable: false })
    if (aj.status === 'done' && (batch.status === 'review' || batch.status === 'done')) return { skipped: 'batch sudah diurai' }
    if (batch.mediaId !== input.mediaId || !batch.media) throw new JobError('Berkas PDF batch ini tidak ditemukan.', { retryable: false })

    await setBatch(h, batch.id, { status: 'parsing', error: null })
    await markAiRunning(h, aj.id)
    const started = Date.now()
    const work = await mkdtemp(join(tmpdir(), 'kira-import-'))
    const written: string[] = []
    try {
      const pdf = join(work, 'input.pdf')
      let buf: Buffer
      try {
        buf = await readStored(h.env.KIRA_DATA_DIR, batch.media.path)
      } catch {
        throw new JobError('Berkas PDF tidak ada di server. Unggah ulang PDF-nya.', { retryable: false })
      }
      await writeFile(pdf, buf, { mode: 0o600 })

      const pages = pageCount(await tool(h, 'pdfinfo', [pdf], 60_000))
      if (!pages) throw new JobError('Jumlah halaman PDF tidak terbaca. Pastikan berkasnya tidak rusak.', { retryable: false })
      if (pages > MAX_PAGES) throw new JobError(`PDF punya ${pages} halaman, batasnya ${MAX_PAGES}. Pisahkan PDF menjadi beberapa berkas lalu unggah ulang.`, { retryable: false })

      const text = await tool(h, 'pdftotext', ['-layout', '-enc', 'UTF-8', '-f', '1', '-l', String(pages), pdf, '-'], 120_000)
      const pageTexts = text.split('\f').slice(0, pages)
      if (pageTexts.join('').replace(/\s+/g, '').length < 20) {
        throw new JobError('PDF ini berupa gambar hasil pindai, teksnya tidak bisa dibaca. Ketik soalnya manual atau unggah PDF yang punya teks.', { retryable: false })
      }
      const parsed = parseImport(pageTexts)
      if (parsed.items.length === 0) {
        throw new JobError('Tidak ada nomor soal yang terbaca di PDF ini. Pastikan soal bernomor 1., 1), atau No. 1.', { retryable: false })
      }

      await tool(h, 'pdftoppm', ['-png', '-r', DPI, '-f', '1', '-l', String(pages), pdf, join(work, 'page')], 300_000)
      const images = (await readdir(work))
        .map((f) => ({ f, n: /^page-(\d+)\.png$/.exec(f)?.[1] }))
        .filter((x): x is { f: string; n: string } => Boolean(x.n))
        .sort((a, b) => Number(a.n) - Number(b.n))

      const check = await aiKeyCheck(h, parsed.items, input.subject, input.grade)
      const items = parsed.items.map((i) => (check?.mismatched.has(i.number) ? { ...i, status: worseStatus(i.status, 'key-mismatch') } : i))

      const createdBy = h.job.created_by ?? batch.createdBy
      const stored: { path: string; sha256: string; size: number }[] = []
      for (const img of images) {
        const s = await storeFile(h.env.KIRA_DATA_DIR, h.org.orgId, await readFile(join(work, img.f)), 'png', h.now())
        written.push(s.path)
        stored.push(s)
      }

      const counts: Record<string, number> = {}
      for (const i of items) counts[i.status] = (counts[i.status] ?? 0) + 1
      const output = {
        items: items.length,
        pages: stored.length,
        keyFound: parsed.keyFound,
        keyEntries: parsed.keyEntries,
        statusCounts: counts,
        aiCheck: check ? 'selesai' : 'dilewati',
      }
      const oldPaths = await withOrg(h.db, h.org, async (tx) => {
        const old = batch.pages.length
          ? await tx.select({ id: tables.media.id, path: tables.media.path }).from(tables.media).where(and(inArray(tables.media.id, batch.pages), eq(tables.media.kind, 'page')))
          : []
        if (old.length) await tx.delete(tables.media).where(inArray(tables.media.id, old.map((o) => o.id)))
        const rows = stored.length
          ? await tx
              .insert(tables.media)
              .values(stored.map((s) => ({ orgId: h.org.orgId, learnerId: null, kind: 'page' as const, path: s.path, mime: 'image/png', size: s.size, sha256: s.sha256, createdBy })))
              .returning({ id: tables.media.id })
          : []
        await tx
          .update(tables.importBatch)
          .set({ items, pages: rows.map((r) => r.id), status: 'review', error: null, updatedAt: h.now() })
          .where(eq(tables.importBatch.id, batch.id))
        await completeAiJobTx(tx, aj.id, { output, provider: check ? h.ai.name : null, model: check?.model ?? null, durationMs: Date.now() - started, usage: null }, h.now())
        return old.map((o) => o.path)
      })
      written.length = 0
      for (const p of oldPaths) await deleteStored(h.env.KIRA_DATA_DIR, p).catch(() => undefined)
      return output
    } finally {
      // Berkas halaman yang sudah ditulis tetapi transaksinya gagal dihapus lagi.
      for (const p of written) await deleteStored(h.env.KIRA_DATA_DIR, p).catch(() => undefined)
      await rm(work, { recursive: true, force: true })
    }
  },
  async onFailure(h, info) {
    await failAiJob(h, info)
    const id = aiJobIdOf(h.job.payload)
    if (!id) return
    const [row] = await withOrg(h.db, h.org, (tx) => tx.select({ input: tables.aiJob.input }).from(tables.aiJob).where(eq(tables.aiJob.id, id)).limit(1))
    const batchId = (row?.input as { batchId?: unknown } | undefined)?.batchId
    if (typeof batchId !== 'string' || !/^[0-9a-f-]{36}$/i.test(batchId)) return
    // Selama masih dicoba lagi, batch tetap "parsing" dengan pesannya; gagal permanen menjadi "failed".
    await setBatch(h, batchId, { status: info.action === 'fail' ? 'failed' : 'parsing', error: info.message })
  },
}
