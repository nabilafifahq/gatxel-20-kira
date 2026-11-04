// Menyiapkan klip suara di folder data staging dan out/clips.json untuk skenario audio.
//   node deploy/load/prep.mjs --real <folder klip sumber> <folder data staging> [jumlah|all]   klip sungguhan (sumber hanya dibaca)
//   node deploy/load/prep.mjs <folder data staging> [jumlah]                                   klip palsu (efek suara CC0)
// out/clips.json berisi kunci klip yang ada. out/assets.json berisi alamat kamus. Bila --real dan folder staging sudah berisi klip, salinan dilewati.
import { createHash, randomBytes } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const real = process.argv[2] === '--real'
const args = process.argv.slice(real ? 3 : 2)
mkdirSync(join(here, 'out'), { recursive: true })
const dict = /DICTIONARY_URL = '([^']+)'/.exec(readFileSync(join(here, '..', '..', 'apps', 'web', 'src', 'components', 'learner', 'dictionary-file.ts'), 'utf8'))?.[1]
writeFileSync(join(here, 'out', 'assets.json'), JSON.stringify({ dict }))
const isClip = (f) => /^[0-9a-f]{64}[.]mp3$/.test(f)

if (real) {
  const [src, dataDir, count = 'all'] = args
  if (!src || !dataDir) throw new Error('Pakai: node prep.mjs --real <sumber> <folder data staging> [jumlah|all]')
  const dest = join(dataDir, 'tts')
  mkdirSync(dest, { recursive: true })
  if (readdirSync(dest).filter(isClip).length === 0) {
    let list = readdirSync(src).filter(isClip)
    if (count !== 'all') list = list.sort(() => Math.random() - 0.5).slice(0, Number(count))
    for (const f of list) copyFileSync(join(src, f), join(dest, f))
  }
  const versionFile = join(dest, 'served-version.txt')
  if (!existsSync(versionFile) && existsSync(join(src, 'served-version.txt'))) copyFileSync(join(src, 'served-version.txt'), versionFile)
  const names = readdirSync(dest).filter(isClip)
  const sizes = names.slice(0, 5000).map((f) => statSync(join(dest, f)).size).sort((a, b) => a - b)
  writeFileSync(join(here, 'out', 'clips.json'), JSON.stringify(names.map((f) => f.slice(0, 64))))
  const avg = sizes.reduce((a, b) => a + b, 0) / (sizes.length || 1)
  console.log(`${names.length} klip sungguhan di ${dest}; 5000 pertama: rata-rata ${Math.round(avg / 1024)} KB, median ${Math.round(sizes[sizes.length >> 1] / 1024)} KB, terbesar ${Math.round(sizes[sizes.length - 1] / 1024)} KB`)
} else {
  const [dataDir, count = '200'] = args
  if (!dataDir) throw new Error('Pakai: node prep.mjs <folder data staging> [jumlah]')
  const n = Number(count)
  const source = join(here, '..', '..', 'apps', 'web', 'public', 'sounds', 'big-1.mp3')
  mkdirSync(join(dataDir, 'tts'), { recursive: true })
  const names = []
  for (let i = 0; i < n; i++) {
    const h = createHash('sha256').update(randomBytes(16)).digest('hex')
    copyFileSync(source, join(dataDir, 'tts', `${h}.mp3`))
    names.push(h)
  }
  writeFileSync(join(here, 'out', 'clips.json'), JSON.stringify(names))
  console.log(`${n} klip palsu ditulis ke ${join(dataDir, 'tts')}`)
}
