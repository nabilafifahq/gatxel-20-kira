import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

/** Buat ulang data contoh (org __GTX_SEED__) supaya setiap putaran tes mulai dari keadaan yang sama. */
export default async function globalSetup() {
  if (!process.env.DATABASE_URL_OWNER) throw new Error('DATABASE_URL_OWNER belum diisi untuk tes e2e.')
  const root = fileURLToPath(new URL('..', import.meta.url))
  execFileSync('pnpm', ['exec', 'tsx', 'packages/db/scripts/seed.ts', '--reset'], {
    cwd: root,
    env: { ...process.env, KIRA_ALLOW_SEED: '1', NODE_ENV: 'development' },
    stdio: 'inherit',
  })
}
