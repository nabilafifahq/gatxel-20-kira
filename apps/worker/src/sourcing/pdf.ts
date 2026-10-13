import { createHash } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { allowedHosts, type PdfFile, type Source } from '@kira/content/sources'
import { tables, withOrg, type Db } from '@kira/db'
import { SYSTEM_USER, workerCtx } from '../db'
import { deleteStored, storeFile } from '../media'
import { guardedFetch, type FetchOptions } from './net'
import { enqueueImport } from './store'

/**
 * PDF gratis resmi dari penyelenggara (lisensi official-free). Berkas diunduh ke server keluarga dan masuk antrean
 * Impor paket resmi (job ai.import) lengkap dengan data paper-nya; tutor yang menyetujui soalnya. PDF tidak pernah
 * masuk repo. Setiap PDF dicatat di source_record (alamat dan sha256), jadi tidak diunduh atau diimpor dua kali.
 */

const { sourceRecord, media, importBatch } = tables

export const MAX_PDF_BYTES = 60 * 1024 * 1024 - 64 * 1024
/** Setiap PDF yang diimpor memakai pemeriksaan kunci AI (satu sampai tiga panggilan); dihitung dua terhadap batas mingguan. */
export const AI_CALLS_PER_PDF = 2

export type PdfOutcome = { imported: number; skipped: number; failed: number; aiCalls: number; notes: string[] }

export function normalizeTag(label: string): string {
  return label.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
}

/** Berkas yang belum pernah diambil dari sumber ini, urut menurut daftar registri (tahun terbaru ditulis lebih dulu di registri). */
export function pendingFiles(files: readonly PdfFile[], doneUrls: ReadonlySet<string>): PdfFile[] {
  return files.filter((f) => !doneUrls.has(f.url))
}

export async function importPdfSource(
  deps: { db: Db; dataDir: string; orgId: string; now: Date; fetchImpl?: typeof fetch; signal: AbortSignal; maxFiles: number; budgetCalls: number },
  source: Source,
): Promise<PdfOutcome> {
  const out: PdfOutcome = { imported: 0, skipped: 0, failed: 0, aiCalls: 0, notes: [] }
  if (source.fetch?.kind !== 'official-pdf') return out
  const org = workerCtx(deps.orgId, null)
  const done = new Set(
    (await withOrg(deps.db, org, (tx) => tx.select({ url: sourceRecord.externalId }).from(sourceRecord).where(and(eq(sourceRecord.sourceId, source.id), eq(sourceRecord.kind, 'pdf'))))).map((r) => r.url ?? ''),
  )
  const net: FetchOptions = { allowedHosts: allowedHosts(source), maxBytes: MAX_PDF_BYTES, timeoutMs: 120_000, signal: deps.signal, accept: 'application/pdf', ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}) }
  let calls = deps.budgetCalls
  for (const file of pendingFiles(source.fetch.files, done)) {
    if (out.imported >= deps.maxFiles || deps.signal.aborted) break
    if (calls < AI_CALLS_PER_PDF) {
      out.notes.push('batas AI mingguan habis, sisa PDF menunggu minggu depan')
      break
    }
    try {
      const buf = await guardedFetch(file.url, net)
      if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') throw new Error('bukan PDF')
      const sha = createHash('sha256').update(buf).digest('hex')
      const stored = await storeFile(deps.dataDir, deps.orgId, buf, 'pdf', deps.now)
      const subject = file.subject ?? source.subjects[0]!
      try {
        const inserted = await withOrg(deps.db, org, async (tx) => {
          const [rec] = await tx
            .insert(sourceRecord)
            .values({ orgId: deps.orgId, sourceId: source.id, kind: 'pdf', externalId: file.url, contentHash: sha, subject, grade: file.grade, body: { url: file.url, title: file.title, bytes: buf.length }, status: 'imported', license: source.license, attribution: source.attribution })
            .onConflictDoNothing()
            .returning({ id: sourceRecord.id })
          // sha256 sama dengan PDF yang sudah ada (misalnya diunggah tutor): catat alamatnya saja.
          if (!rec) return false
          const [m] = await tx
            .insert(media)
            .values({ orgId: deps.orgId, learnerId: null, kind: 'pdf', path: stored.path, mime: 'application/pdf', size: buf.length, sha256: sha, createdBy: SYSTEM_USER })
            .returning({ id: media.id })
          const [b] = await tx
            .insert(importBatch)
            .values({
              orgId: deps.orgId,
              title: file.title,
              subject,
              grade: file.grade,
              tags: source.competition ? [normalizeTag(source.competition)] : [],
              mediaId: m!.id,
              status: 'uploaded',
              createdBy: SYSTEM_USER,
              competition: source.competition ?? null,
              year: file.year,
              section: file.section ?? null,
              originalMinutes: file.minutes ?? null,
              source: file.url,
            })
            .returning({ id: importBatch.id })
          await enqueueImport(tx, deps.orgId, { kind: 'import', batchId: b!.id, mediaId: m!.id, subject, grade: file.grade, title: file.title })
          await tx.update(sourceRecord).set({ importBatchId: b!.id }).where(eq(sourceRecord.id, rec.id))
          return true
        })
        if (inserted) {
          out.imported++
          calls -= AI_CALLS_PER_PDF
          out.aiCalls += AI_CALLS_PER_PDF
        } else {
          out.skipped++
          await deleteStored(deps.dataDir, stored.path).catch(() => undefined)
        }
      } catch (e) {
        await deleteStored(deps.dataDir, stored.path).catch(() => undefined)
        throw e
      }
    } catch (e) {
      if (deps.signal.aborted) break
      out.failed++
      out.notes.push(`${file.title}: ${e instanceof Error ? e.message : 'gagal'}`)
    }
  }
  return out
}
