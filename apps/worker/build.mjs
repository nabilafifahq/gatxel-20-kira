import { build } from 'esbuild'

/**
 * Satu berkas ESM untuk image Docker: dist/index.mjs. Paket workspace (@kira/*) ikut dibundel.
 * Banner createRequire dibutuhkan dependensi CommonJS yang memanggil require() di dalam bundel ESM.
 */
await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.mjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: false,
  legalComments: 'none',
  logLevel: 'info',
  banner: {
    js: "import { createRequire as __kiraCreateRequire } from 'node:module';\nconst require = __kiraCreateRequire(import.meta.url);",
  },
})
