import type postgres from 'postgres'
import { createDb, type Db, type OrgContext } from '@kira/db'

/**
 * Worker memakai satu koneksi role kira_worker (kena RLS). Data tenant hanya disentuh lewat
 * withOrg(db, workerCtx(...)). Fungsi lintas org (kira_claim_jobs, kira_list_orgs, kira_retention)
 * dipanggil lewat client postgres.js karena fungsi itu SECURITY DEFINER dan tidak butuh app.org_id.
 */

/** Pengguna sistem untuk job tanpa created_by dan untuk jadwal. Tidak ada akun dengan id ini. */
export const SYSTEM_USER = '00000000-0000-4000-8000-000000000000'

export function workerCtx(orgId: string, userId: string | null | undefined): OrgContext {
  return { orgId, userId: userId ?? SYSTEM_USER, role: 'worker' }
}

export type WorkerDb = { db: Db; client: postgres.Sql }

export function connectWorkerDb(url: string): WorkerDb {
  return createDb(url, { name: 'worker', max: 5 })
}

/** Daftar org lewat fungsi definer (RLS kira_worker tidak membolehkan membaca tabel org langsung). */
export async function listOrgIds(client: postgres.Sql): Promise<string[]> {
  const rows = await client<{ id: string }[]>`select id from kira_list_orgs()`
  return rows.map((r) => r.id)
}
