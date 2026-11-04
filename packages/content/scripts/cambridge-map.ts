import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { computeGaps, loadCambridgeMap } from '../src/cambridge'
import { findContentDir, loadContent } from '../src/load'

/** Hitung ulang `gaps` dan `match` di content/curriculum/cambridge-map.json. Pakai --write untuk menyimpan. */
const dir = findContentDir()
const { map, errors } = loadCambridgeMap(dir)
if (!map) {
  console.error(errors.map((e) => e.message).join('\n'))
  process.exit(1)
}
const { index } = loadContent(dir)
for (const m of Object.values(map.skills)) m.match = m.direct.length + m.partial.length === 0 ? 'enrichment' : m.direct.length > 0 ? 'direct' : 'partial'
map.gaps = computeGaps(map, (id) => index.skills.get(id)?.subject)
const file = join(dir, 'curriculum', 'cambridge-map.json')
if (process.argv.includes('--write')) {
  writeFileSync(file, JSON.stringify(map, null, 1) + '\n')
  console.log('ditulis', file)
} else {
  console.log(readFileSync(file, 'utf8') === JSON.stringify(map, null, 1) + '\n' ? 'sudah mutakhir' : 'berbeda (pakai --write)')
}
