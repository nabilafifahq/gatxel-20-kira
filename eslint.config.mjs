// ESLint untuk seluruh monorepo Kira (GTX-ENG-001 v1.7, tingkat HOUSE).
// `pnpm lint` menjalankan `eslint . --max-warnings=0`, lalu scripts/check-copy.mjs untuk aturan teks GTX.
// Sengaja tanpa aturan yang butuh informasi tipe supaya tetap cepat; pemeriksaan tipe ada di `pnpm typecheck`.
import { defineConfig, globalIgnores } from 'eslint/config'
import { builtinRules } from 'eslint/use-at-your-own-risk'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const CODE = '**/*.{js,mjs,cjs,ts,tsx,mts,cts}'
const TS = '**/*.{ts,tsx,mts,cts}'

// Setara eslint:recommended. @eslint/js tidak lagi ikut eslint 10 dan repo ini tidak menambah dependensi,
// jadi daftarnya diambil dari metadata aturan bawaan (sumber yang sama dengan @eslint/js).
const coreRecommended = Object.fromEntries(
  [...builtinRules].filter(([, rule]) => rule.meta?.docs?.recommended).map(([name]) => [name, 'error']),
)

export default defineConfig([
  globalIgnores([
    '**/node_modules/',
    '**/.next/',
    '**/dist/',
    '**/out/',
    '**/coverage/',
    '**/test-results/',
    '**/playwright-report/',
    '.kira-local/',
    'apps/android/',
    'apps/web/.scripts/',
    '**/next-env.d.ts',
  ]),

  { files: [CODE], rules: coreRecommended },
  { files: [TS], extends: [tseslint.configs.recommended] },

  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.node } },
  },
  // Service worker dan skrip statis lain di public/ berjalan di browser, bukan di Node.
  {
    files: ['apps/web/public/**/*.js'],
    languageOptions: { sourceType: 'script', globals: { ...globals.browser, ...globals.serviceworker } },
  },

  {
    files: [CODE],
    rules: {
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': 'error',
      // `let [x, y] = ...` dengan hanya y yang diubah tidak perlu dipecah jadi dua deklarasi.
      'prefer-const': ['error', { destructuring: 'all' }],
    },
  },
  {
    files: [TS],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    rules: {
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
    },
  },

  // App Router saja (CLAUDE.md). next/router hanya ada di Pages Router.
  {
    files: ['apps/web/**/*.{ts,tsx,js,mjs}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'next/router',
              message: 'Kira memakai App Router. Pakai next/navigation (useRouter, usePathname, useSearchParams).',
            },
          ],
        },
      ],
    },
  },

  // Tempat yang boleh menulis ke console: dua modul log, skrip CLI, dan tes.
  {
    files: [
      'apps/worker/src/log.ts',
      'apps/web/src/server/log.ts',
      'scripts/**',
      '**/scripts/**',
      '**/test/**',
      '**/__tests__/**',
      '**/*.test.*',
      '**/*.spec.*',
      'e2e/**',
    ],
    rules: { 'no-console': 'off' },
  },
])
