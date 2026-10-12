import { defineProject } from 'vitest/config'

export default defineProject({
  test: { name: 'db', include: ['test/**/*.test.ts'], environment: 'node', testTimeout: 30000, hookTimeout: 60000, fileParallelism: false },
})
