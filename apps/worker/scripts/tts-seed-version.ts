/**
 * Siapkan versi suara baru tanpa membuat ulang semua klip. Klip yang tidak terdampak dipakai ulang persis (byte sama) dengan kunci versi baru,
 * dan barisnya di laporan gerbang ikut pindah, jadi hanya klip terdampak yang dibuat ulang dan diperiksa.
 *
 *   pnpm tsx apps/worker/scripts/tts-seed-version.ts --data-dir <data> --from piper-lessac-medium --to piper-lessac-medium-2 \
 *     --report <laporan-lama.csv> --out-report <laporan-benih.csv> [--dry]
 *
 * Tidak mengubah penunjuk suara dan tidak menyentuh klip lama: kunci memuat versi, jadi berkas baru bernama lain. Sesudah ini:
 *   pnpm tts:generate -- --data-dir <data> --url <layanan dengan penjaga bunyi s> --token <token> --version <versi baru>
 *   python check_clips.py --dir <data>/tts --report <laporan-baru.csv> --prior <laporan-benih.csv>   (manifest.jsonl = set versi baru)
 *   pnpm tts:promote -- --data-dir <data> --version <versi baru> --report <laporan-baru.csv>
 * Tautan keras dipakai bila bisa: tanpa tambahan ruang disk, dan waktu berkas tetap sama, yang dipakai gerbang untuk melewati klip yang sudah diperiksa.
 */
import { copyFile, link, readFile, stat, utimes, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { isVoiceVersion, type TtsStyleId } from '@kira/core/tts'
import { clipKey, ttsRoot } from '../src/tts/store'

const { values } = parseArgs({
  options: {
    'data-dir': { type: 'string' },
    from: { type: 'string' },
    to: { type: 'string' },
    report: { type: 'string' },
    'out-report': { type: 'string' },
    dry: { type: 'boolean', default: false },
  },
})
const dataDir = values['data-dir']
const { from, to } = values
if (!dataDir || !isVoiceVersion(from) || !isVoiceVersion(to) || from === to || !values.report || !values['out-report']) {
  throw new Error('--data-dir, --from, --to (berbeda), --report, dan --out-report wajib')
}

/** Kalimat yang mulai dengan gugus s yang tertelan model. Ejaan, bukan fonem, jadi sedikit lebih luas dari penjaga di deploy/tts/remote.py: lebih baik ikut dibuat ulang daripada tertinggal. */
const AFFECTED = /(?:^|[.!?]["'”)]*\s+)["'“(]*s(?:p|t|k|w|c|q)/i

type Row = { key: string; style: TtsStyleId; text: string }
const rows = (await readFile(join(ttsRoot(dataDir), `manifest-${from}.jsonl`), 'utf8'))
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l) as Row)

const moved = new Map<string, string>()
let affected = 0
let missing = 0
let linked = 0
let copied = 0
const started = Date.now()
const keep: Row[] = []
for (const r of rows) {
  if (AFFECTED.test(r.text)) affected++
  else keep.push(r)
}

async function seed(r: Row): Promise<void> {
  const src = join(ttsRoot(dataDir!), `${r.key}.mp3`)
  const key = clipKey(r.text, r.style, to)
  const dest = join(ttsRoot(dataDir!), `${key}.mp3`)
  moved.set(r.key, key)
  if (values.dry) return
  const info = await stat(src).catch(() => null)
  if (!info) {
    missing++
    moved.delete(r.key)
    return
  }
  if (await stat(dest).catch(() => null)) return
  try {
    await link(src, dest)
    linked++
  } catch {
    await copyFile(src, dest)
    await utimes(dest, info.atime, info.mtime)
    copied++
  }
}

const WORKERS = 16
let at = 0
await Promise.all(
  Array.from({ length: WORKERS }, async () => {
    while (at < keep.length) await seed(keep[at++]!)
  }),
)

// Baris laporan pindah ke kunci baru. Kolom key selalu pertama di CSV check_clips.py, dan kunci tidak pernah memuat koma.
const report = (await readFile(values.report, 'utf8')).split('\n')
const out: string[] = [report[0]!]
for (const line of report.slice(1)) {
  const comma = line.indexOf(',')
  const key = comma > 0 ? moved.get(line.slice(0, comma)) : undefined
  if (key) out.push(`${key}${line.slice(comma)}`)
}
if (!values.dry) await writeFile(values['out-report'], out.join('\n') + '\n')

console.log(`${rows.length} klip di ${from}: ${keep.length} dipakai ulang (tautan ${linked}, salinan ${copied}, hilang ${missing}), ${affected} harus dibuat ulang untuk ${to}. Baris laporan pindah: ${out.length - 1}. ${Math.round((Date.now() - started) / 1000)} detik.`)
