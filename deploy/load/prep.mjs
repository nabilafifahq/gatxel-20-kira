// Menyiapkan klip suara palsu di folder data staging (nama = sha256, isi = efek suara CC0) dan out/clips.json untuk skenario audio.
// Pemakaian: node deploy/load/prep.mjs <folder data staging> [jumlah]
import { createHash, randomBytes } from 'node:crypto'
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = process.argv[2]
if (!dataDir) throw new Error('Pakai: node prep.mjs <folder data staging> [jumlah]')
const n = Number(process.argv[3] ?? 200)
const src = join(here, '..', '..', 'apps', 'web', 'public', 'sounds', 'big-1.mp3')
mkdirSync(join(dataDir, 'tts'), { recursive: true })
const names = []
for (let i = 0; i < n; i++) {
  const h = createHash('sha256').update(randomBytes(16)).digest('hex')
  copyFileSync(src, join(dataDir, 'tts', `${h}.mp3`))
  names.push(h)
}
mkdirSync(join(here, 'out'), { recursive: true })
writeFileSync(join(here, 'out', 'clips.json'), JSON.stringify(names))
console.log(`${n} klip palsu ditulis ke ${join(dataDir, 'tts')}`)
