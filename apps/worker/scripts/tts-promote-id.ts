/**
 * Nyalakan suara Indonesia: tulis penunjuk served-id-version.txt secara atomik, hanya bila klipnya lengkap dan lulus gerbang.
 *
 *   pnpm tts:promote-id -- --data-dir C:/Kira/data --report C:/kw4/tts-id/tts-id-report.csv [--min-pass 0.99] [--dry]
 *
 * Syarat: manifest-<versi>.jsonl sudah ada di <data-dir>/tts, setiap klipnya ada, dan laporan check_id_clips.py memuatnya dengan
 * tingkat lulus minimal --min-pass. Berkas lain tidak disentuh: served-version.txt (suara Inggris) dan manifest.jsonl tetap apa adanya.
 * Klip tambahan sesudah ini cukup disalin lagi; penunjuknya tidak perlu diubah, dan tombol suara muncul sendiri saat klipnya ada.
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { isVoiceVersion, TTS_ID_SERVED_VERSION_FILE, TTS_ID_VOICE_VERSION } from '@kira/core/tts'
import { hasClip, ttsRoot } from '../src/tts/store'

const { values } = parseArgs({
  options: {
    'data-dir': { type: 'string' },
    report: { type: 'string' },
    'min-pass': { type: 'string', default: '0.99' },
    dry: { type: 'boolean', default: false },
  },
})
const dataDir = values['data-dir']
if (!dataDir || !values.report) throw new Error('--data-dir dan --report wajib')
const version = TTS_ID_VOICE_VERSION
if (!isVoiceVersion(version)) throw new Error('Versi suara tidak valid')

const manifest = (await readFile(join(ttsRoot(dataDir), `manifest-${version}.jsonl`), 'utf8'))
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l) as { key: string; style: string })
if (manifest.some((m) => m.style !== 'indonesian')) throw new Error('Manifest memuat klip yang bukan peran indonesian')
const missing: string[] = []
for (const m of manifest) if (!(await hasClip(dataDir, m.key))) missing.push(m.key)
if (missing.length > 0) throw new Error(`${missing.length} dari ${manifest.length} klip belum ada di folder data (contoh ${missing[0]}). Salin dulu.`)

// Laporan CSV dari check_id_clips.py: key,seconds,peak_db,rms_db,clip_frac,flags. Kolom terakhir kosong berarti lulus.
const rows = (await readFile(values.report, 'utf8')).split(/\r?\n/).slice(1).filter(Boolean)
const passed = new Set<string>()
const checked = new Set<string>()
for (const row of rows) {
  const cols = row.split(',')
  const key = cols[0]!
  checked.add(key)
  if (!cols[5]) passed.add(key)
}
const inReport = manifest.filter((m) => checked.has(m.key)).length
const ok = manifest.filter((m) => passed.has(m.key)).length
const rate = ok / Math.max(1, manifest.length)
console.log(`versi ${version}: ${manifest.length} klip, ${inReport} diperiksa, ${ok} lulus (${(rate * 100).toFixed(2)}%)`)
if (rate < Number(values['min-pass'])) throw new Error(`Tingkat lulus ${(rate * 100).toFixed(2)}% di bawah batas. Penunjuk tidak diubah.`)
if (values.dry) process.exit(0)

await mkdir(ttsRoot(dataDir), { recursive: true })
const dest = join(ttsRoot(dataDir), TTS_ID_SERVED_VERSION_FILE)
const tmp = `${dest}.${process.pid}.tmp`
await writeFile(tmp, `${version}\n`, { mode: 0o644 })
await rename(tmp, dest)
console.log(`Suara Indonesia menyala: ${dest} = ${version}. Penunjuk suara Inggris tidak disentuh.`)
