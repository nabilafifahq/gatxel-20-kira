import 'server-only'
import { sql } from 'drizzle-orm'
import { findContentDir } from '@kira/content/load'
import { loadRegistry } from '@kira/content/extras'
import { canCommitToRepo, licensePolicy, type Registry, type Source } from '@kira/content/sources'
import { tables } from '@kira/db'
import type { SourceRowDTO, SourcesDTO } from '@/lib/dto-paper'
import type { Actor } from '../auth/actor'
import { orgCtx } from '../auth/actor'
import { auditTx } from '../audit'
import type { OrgContext, Tx } from '../db'
import { inOrg } from '../db'
import { notFound } from '../errors'
import { shellIn } from './console-shell'

/**
 * Halaman Sumber soal: isi registri (content/sources/registry.json), status pengambilan terakhir per sumber,
 * dan jumlah soal per status. Pengambilan sendiri dijalankan worker setiap Minggu dini hari (apps/worker/src/sourcing).
 */

const { sourceRecord, sourceState } = tables

let cache: Registry | null | undefined
export function registry(): Registry | null {
  if (cache === undefined) cache = loadRegistry(findContentDir()).registry
  return cache
}

const ACCESS_LABEL: Record<Source['access'], string> = {
  auto: 'Otomatis tiap Minggu',
  'manual-upload': 'Unggah manual',
  listed: 'Dicatat saja',
}

const SUBJECT_ID: Record<string, string> = { math: 'Math', english: 'English', science: 'Science' }

export async function sourcesDTO(actor: Actor): Promise<SourcesDTO> {
  return inOrg(orgCtx(actor), async (tx) => {
    const { shell } = await shellIn(tx, actor, null)
    const states = new Map((await tx.select().from(sourceState)).map((s) => [s.sourceId, s]))
    const counts = await tx
      .select({ sourceId: sourceRecord.sourceId, status: sourceRecord.status, n: sql<number>`count(*)::int` })
      .from(sourceRecord)
      .groupBy(sourceRecord.sourceId, sourceRecord.status)
    const byId = new Map<string, Partial<Record<string, number>>>()
    for (const c of counts) byId.set(c.sourceId, { ...(byId.get(c.sourceId) ?? {}), [c.status]: c.n })
    const reg = registry()
    const sources: SourceRowDTO[] = (reg?.sources ?? []).map((s) => {
      const st = states.get(s.id)
      const n = byId.get(s.id) ?? {}
      const policy = licensePolicy(s.license)
      return {
        id: s.id,
        name: s.name,
        site: s.site,
        licenseId: s.license,
        licenseLabel: policy.label,
        licenseNote: s.licenseNote ?? null,
        access: s.access,
        accessLabel: ACCESS_LABEL[s.access],
        subjects: s.subjects.map((x) => SUBJECT_ID[x] ?? x).join(', '),
        grades: s.grades.length === 6 ? 'Grade 1 sampai 6' : `Grade ${s.grades.join(', ')}`,
        years: s.years,
        attribution: s.attribution,
        committable: canCommitToRepo(s),
        enabled: st?.enabled ?? true,
        lastRun: st?.lastRunAt ? st.lastRunAt.toISOString() : null,
        lastResult: st?.lastResult ?? null,
        counts: { published: n.published ?? 0, queued: n.queued ?? 0, rejected: n.rejected ?? 0, unmapped: n.unmapped ?? 0, imported: n.imported ?? 0 },
        notes: s.notes ?? null,
      }
    })
    const last = [...states.values()].filter((s) => s.lastRunAt).sort((a, b) => b.lastRunAt!.getTime() - a.lastRunAt!.getTime())[0]
    return { shell, sources, weekly: { lastRun: last?.lastRunAt?.toISOString() ?? null, lastResult: last?.lastResult ?? null } }
  })
}

/** Nyalakan atau matikan pengambilan otomatis satu sumber (hanya untuk org ini). */
export async function setSourceEnabledTx(tx: Tx, ctx: OrgContext, input: { sourceId: string; enabled: boolean }): Promise<void> {
  const known = registry()?.sources.some((s) => s.id === input.sourceId)
  if (!known) throw notFound('Sumber itu tidak ada di registri. Muat ulang halaman sumber.')
  await tx
    .insert(sourceState)
    .values({ orgId: ctx.orgId, sourceId: input.sourceId, enabled: input.enabled })
    .onConflictDoUpdate({ target: [sourceState.orgId, sourceState.sourceId], set: { enabled: input.enabled } })
  await auditTx(tx, ctx, input.enabled ? 'source.enabled' : 'source.disabled', input.sourceId)
}
