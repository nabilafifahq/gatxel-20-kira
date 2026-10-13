import { defineProject } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineProject({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)), 'server-only': fileURLToPath(new URL('./test/server-only-stub.ts', import.meta.url)) } },
  test: { name: 'web', include: ['test/**/*.test.{ts,tsx}'], exclude: ['test/**/*.db.test.ts', '**/node_modules/**'], environment: 'node' },
})
