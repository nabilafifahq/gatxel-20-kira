import 'server-only'
import { createDb, withOrg, type Db, type OrgContext, type Tx } from '@kira/db/client'
import { env } from './env'

/**
 * Dua pool koneksi: kira_app (data tenant, RLS) dan kira_auth (skema auth).
 * Disimpan di globalThis supaya hot reload pengembangan tidak membuka pool baru terus.
 */
type Pools = { app: Db; auth: Db; closeAll: () => Promise<void> }

const g = globalThis as unknown as { __kiraPools?: Pools }

function pools(): Pools {
  if (g.__kiraPools) return g.__kiraPools
  const app = createDb(env().DATABASE_URL_APP, { name: 'app', max: 15 })
  const auth = createDb(env().DATABASE_URL_AUTH, { name: 'auth', max: 8 })
  g.__kiraPools = {
    app: app.db,
    auth: auth.db,
    closeAll: async () => {
      await Promise.all([app.client.end(), auth.client.end()])
    },
  }
  return g.__kiraPools
}

export function appDb(): Db {
  return pools().app
}

export function authDb(): Db {
  return pools().auth
}

/** Transaksi tenant dengan konteks RLS. */
export function inOrg<T>(ctx: OrgContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withOrg(appDb(), ctx, fn)
}

export type { Db, Tx, OrgContext }
