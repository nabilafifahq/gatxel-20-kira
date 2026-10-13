import { defineProject } from 'vitest/config'
import { fileURLToPath } from 'node:url'

/** Tes DAL yang butuh Postgres sungguhan (DATABASE_URL_*). Dijalankan oleh `pnpm test:db`, dilewati tanpa URL. */
export default defineProject({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)), 'server-only': fileURLToPath(new URL('./test/server-only-stub.ts', import.meta.url)) } },
  test: { name: 'web-db', include: ['test/**/*.db.test.ts'], environment: 'node', testTimeout: 30000, hookTimeout: 60000, fileParallelism: false },
})
