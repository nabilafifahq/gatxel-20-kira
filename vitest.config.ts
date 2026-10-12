import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: ['packages/core', 'packages/content', 'packages/figures', 'packages/db', 'apps/web', 'apps/worker'],
  },
})
