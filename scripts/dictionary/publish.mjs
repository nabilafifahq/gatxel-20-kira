// Salin kamus ke apps/web/public/dict/en-id.<hash>.json (nama berhash, bisa disimpan selamanya) dan tulis
// apps/web/src/components/learner/dictionary-file.ts yang memuat alamatnya. Jalankan setelah content/dictionary/en-id.json berubah.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(process.argv[2] ?? '.')
const src = JSON.parse(readFileSync(join(root, 'content/dictionary/en-id.json'), 'utf8'))
// Berkas klien: tanpa meta panjang, entri ringkas.
const compact = JSON.stringify({ v: src.v, entries: src.entries, forms: src.forms })
const hash = createHash('sha256').update(compact).digest('hex').slice(0, 8)
const dir = join(root, 'apps/web/public/dict')
mkdirSync(dir, { recursive: true })
for (const f of readdirSync(dir)) if (f.startsWith('en-id.') && f.endsWith('.json')) rmSync(join(dir, f))
const name = `en-id.${hash}.json`
writeFileSync(join(dir, name), compact)
writeFileSync(
  join(root, 'apps/web/src/components/learner/dictionary-file.ts'),
  `// Dibuat oleh scripts/dictionary/publish.mjs. Jangan diubah tangan.\nexport const DICTIONARY_URL = '/dict/${name}'\n`,
)
console.log(name, compact.length, 'bytes', existsSync(join(dir, name)))
