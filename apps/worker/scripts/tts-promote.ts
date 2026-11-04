/**
 * Pindahkan suara yang disajikan ke versi baru, secara atomik, hanya bila set penuhnya sudah jadi dan lulus gerbang mutu.
 *
 *   pnpm tts:promote -- --data-dir <KIRA_DATA_DIR> --version <versi> --report <laporan.csv> [--min-pass 0.99] [--dry]
 *
 * Syarat (semuanya harus terpenuhi, kalau tidak penunjuk tidak diubah dan anak tetap mendengar versi lama):
 *   1. manifest-<versi>.jsonl ada (ditulis oleh pnpm tts:generate untuk versi itu) dan SETIAP klipnya ada di <data-dir>/tts.
 *   2. Laporan check_clips.py memuat klip-klip itu dan tingkat lulusnya >= --min-pass (bawaan 0,99).
 * Penunjuk: <data-dir>/tts/served-version.txt. Web membacanya tiap 5 detik dan memberi tahu browser lewat /api/tts/today,
 * sehingga semua perangkat berpindah suara bersama-sama, tanpa suara campuran di antara pertanyaan.
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { isVoiceVersion } from '@kira/core/tts'
import { hasClip, readServedVersion, ttsRoot, writeServedVersion } from '../src/tts/store'

const { values } = parseArgs({
  options: {
    'data-dir': { type: 'string' },
    version: { type: 'string' },
    report: { type: 'string' },
    'min-pass': { type: 'string', default: '0.99' },
    dry: { type: 'boolean', default: false },
  },
})
const dataDir = values['data-dir']
const version = values.version
if (!dataDir || !isVoiceVersion(version) || !values.report) throw new Error('--data-dir, --version (huruf kecil/angka/titik/garis) dan --report wajib')

function csvRows(text: string): Record<string, string>[] {
  // CSV sederhana dari check_clips.py (Python csv): kolom diberi tanda kutip bila perlu.
  const rows: string[][] = []
  let cur: string[] = []
  let cell = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') q = false
      else cell += c
    } else if (c === '"') q = true
    else if (c === ',') {
      cur.push(cell)
      cell = ''
    } else if (c === '\n') {
      cur.push(cell)
      rows.push(cur)
      cur = []
      cell = ''
    } else if (c !== '\r') cell += c
  }
  const head = rows.shift() ?? []
  return rows.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]!])))
}

const manifest = (await readFile(join(ttsRoot(dataDir), `manifest-${version}.jsonl`), 'utf8'))
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l) as { key: string })
const missing: string[] = []
for (const m of manifest) if (!(await hasClip(dataDir, m.key))) missing.push(m.key)
if (missing.length > 0) throw new Error(`${missing.length} dari ${manifest.length} klip belum ada (contoh ${missing[0]}). Jalankan pnpm tts:generate dulu.`)

const byKey = new Map(csvRows(await readFile(values.report, 'utf8')).map((r) => [r.key!, r]))
const checked = manifest.filter((m) => byKey.has(m.key))
if (checked.length < manifest.length) throw new Error(`Laporan hanya memuat ${checked.length} dari ${manifest.length} klip. Jalankan check_clips.py sampai selesai.`)
const passed = checked.filter((m) => byKey.get(m.key)!.pass === 'ok').length
const rate = passed / manifest.length
const min = Number(values['min-pass'])
console.log(`${manifest.length} klip lengkap, lulus ${passed} (${(rate * 100).toFixed(2)}%), batas ${(min * 100).toFixed(2)}%`)
if (rate < min) throw new Error('Belum lulus gerbang mutu; penunjuk tidak diubah.')

const before = await readServedVersion(dataDir)
if (values.dry) {
  console.log(`(uji) akan memindahkan ${before} -> ${version}`)
} else {
  await writeServedVersion(dataDir, version)
  console.log(`suara yang disajikan: ${before} -> ${version}`)
}
