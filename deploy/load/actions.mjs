// Menulis out/actions.json (nama Server Action -> ID) dari image web staging. ID berubah di setiap build.
// Pemakaian: node deploy/load/actions.mjs [image]   (bawaan kirastg-web:latest)
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const image = process.argv[2] ?? 'kirastg-web:latest'
const raw = execFileSync('docker', ['run', '--rm', '--entrypoint', 'cat', image, '/app/apps/web/.next/server/server-reference-manifest.json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const manifest = JSON.parse(raw).node
const out = {}
for (const [id, v] of Object.entries(manifest)) out[v.exportedName] = id
const dir = join(dirname(fileURLToPath(import.meta.url)), 'out')
mkdirSync(dir, { recursive: true })
writeFileSync(join(dir, 'actions.json'), JSON.stringify(out, null, 1))
console.log(`${Object.keys(out).length} action ditulis ke ${join(dir, 'actions.json')}`)
