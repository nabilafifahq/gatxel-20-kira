import 'server-only'
import { createDb, withOrg, type Db, type OrgContext, type Tx } from '@kira/db/client'
import { env } from './env'
import { noteDbAccess, runHoldingTx } from './tx-guard'

/**
 * Dua pool koneksi: kira_app (data tenant, RLS) dan kira_auth (skema auth).
 * Disimpan di globalThis supaya hot reload pengembangan tidak membuka pool baru terus.
 */
type Pools = { app: Db; auth: Db; closeAll: () => Promise<void> }

const g = globalThis as unknown as { __kiraPools?: Pools }

function pools(): Pools {
  if (g.__kiraPools) return g.__kiraPools
  // Ukuran pool per replika (KIRA_POOL_APP, KIRA_POOL_AUTH). Total sambungan ke PgBouncer = replika x ukuran pool.
  const app = createDb(env().DATABASE_URL_APP, { name: 'app', max: env().KIRA_POOL_APP })
  const auth = createDb(env().DATABASE_URL_AUTH, { name: 'auth', max: env().KIRA_POOL_AUTH })
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
  noteDbAccess('app')
  return pools().app
}

export function authDb(): Db {
  noteDbAccess('auth')
  return pools().auth
}

/** Transaksi tenant dengan konteks RLS. */
export function inOrg<T>(ctx: OrgContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withOrg(appDb(), ctx, (tx) => runHoldingTx(() => fn(tx)))
}

export type { Db, Tx, OrgContext }
