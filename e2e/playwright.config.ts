import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

/**
 * Tes ujung ke ujung Kira. Server harus sudah jalan (pnpm dev, atau next start di CI) dengan database
 * yang bisa di-seed ulang: globalSetup menjalankan seed --reset (org __GTX_SEED__ saja).
 * Variabel: E2E_BASE_URL (default http://localhost:3000), DATABASE_URL_OWNER, KIRA_ALLOW_SEED=1.
 */
const localChromium = '/opt/pw-browsers/chromium'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // 'github' menulis kegagalan sebagai anotasi run, terbaca walau log Actions tidak bisa diunduh.
  reporter: process.env.CI ? [['github'], ['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]] : [['list']],
  globalSetup: './global-setup.ts',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'en-GB',
    timezoneId: 'Asia/Jakarta',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 900 },
        ...(existsSync(localChromium) && !process.env.CI ? { launchOptions: { executablePath: localChromium } } : {}),
      },
    },
  ],
})
