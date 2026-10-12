import { defineProject } from 'vitest/config'

export default defineProject({
  test: { name: 'figures', include: ['test/**/*.test.{ts,tsx}'], environment: 'node' },
})
