import { readFileSync } from 'node:fs'
import { sql } from 'drizzle-orm'
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export type Db = PostgresJsDatabase<typeof schema>
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

export type DbRole = 'app' | 'auth' | 'worker' | 'owner'

/**
 * Koneksi Postgres per role. URL wajib ada; tanpa URL proses berhenti (gagal tertutup).
 * TLS: bila PGSSLROOTCERT diisi, koneksi memakai sslmode verify-full dengan CA lokal.
 */
export function createDb(url: string | undefined, opts: { max?: number; name: string }): { db: Db; client: postgres.Sql } {
  if (!url) throw new Error(`Variabel database untuk ${opts.name} belum diisi`)
  const ca = process.env.PGSSLROOTCERT ? readFileSync(process.env.PGSSLROOTCERT, 'utf8') : undefined
  const client = postgres(url, {
    max: opts.max ?? 10,
    idle_timeout: 30,
    connect_timeout: 10,
    prepare: true,
    connection: { application_name: `kira-${opts.name}` },
    ...(ca ? { ssl: { ca, rejectUnauthorized: true } } : {}),
    onnotice: () => {},
  })
  return { db: drizzle(client, { schema }), client }
}

export type OrgContext = {
  orgId: string
  userId: string
  role: 'tutor' | 'guardian' | 'learner' | 'worker'
}

/**
 * Semua akses data tenant lewat fungsi ini. Konteks diset dengan set_config(..., true)
 * sehingga hanya berlaku di transaksi ini dan tidak bocor ke koneksi lain di pool.
 */
export async function withOrg<T>(db: Db, ctx: OrgContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!ctx.orgId || !ctx.userId) throw new Error('withOrg: konteks org belum lengkap')
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.org_id', ${ctx.orgId}, true), set_config('app.user_id', ${ctx.userId}, true), set_config('app.role', ${ctx.role}, true)`,
    )
    return fn(tx)
  })
}

export { schema }
