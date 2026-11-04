/**
 * Buat semua klip suara dari konten repo tanpa database dan tanpa worker. Dipakai untuk regenerasi massal
 * (misalnya setelah konten digabung atau suara diganti) dan untuk uji cepat.
 *
 *   pnpm tts:generate -- --data-dir <KIRA_DATA_DIR> --url http://127.0.0.1:8000 --token <KIRA_INTERNAL_TOKEN>
 *       [--concurrency 2] [--batch 48] [--limit N] [--version V] [--dry]
 *
 * - Klip ditulis ke <data-dir>/tts/<sha256>.mp3 (tata letak yang sama dengan produksi) dan daftar teksnya ke
 *   <data-dir>/tts/manifest.jsonl (satu baris per klip: key, style, text) untuk check_clips.py.
 * - Bisa dilanjutkan: klip yang sudah ada dilewati, jadi menjalankan perintah yang sama lagi hanya membuat sisanya.
 *   Aman dihentikan kapan saja (Ctrl+C); berkas ditulis lewat berkas sementara lalu rename.
 * - Token dibaca dari --token atau KIRA_INTERNAL_TOKEN. Tidak pernah dicetak.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { findContentDir, loadContent } from '@kira/content/load'
import { loadSpelling } from '@kira/content/spelling'
import { spellingSpeechClips } from '@kira/content/speech'
import { isClipText, TTS_VOICE_VERSION } from '@kira/core/tts'
import { createTtsClient } from '../src/tts/client'
import { bookClips, dedupe, dictionaryClips, repoClips, worldClips } from '../src/tts/collect'
import { clipKey, hasClip, ttsRoot, writeClip } from '../src/tts/store'

const { values } = parseArgs({
  options: {
    'data-dir': { type: 'string' },
    url: { type: 'string', default: 'http://127.0.0.1:8000' },
    token: { type: 'string' },
    concurrency: { type: 'string', default: '2' },
    batch: { type: 'string', default: '48' },
    limit: { type: 'string' },
    dry: { type: 'boolean', default: false },
    'content-dir': { type: 'string' },
    version: { type: 'string' },
  },
})

const dataDir = values['data-dir']
if (!dataDir) throw new Error('--data-dir wajib')
const token = values.token ?? process.env.KIRA_INTERNAL_TOKEN ?? ''
const concurrency = Math.max(1, Number(values.concurrency))
const batchSize = Math.max(1, Number(values.batch))

const client = createTtsClient(values.url!, token)
// Versi suara = versi layanan (backend dan nama suara). Kunci klip memuatnya, jadi suara berbeda tidak bertabrakan.
const health = values.dry && !values.version ? { ok: false as const } : await client.health()
const version = values.version ?? health.voiceVersion ?? TTS_VOICE_VERSION
console.log(`versi suara: ${version}${health.ok ? ` (layanan ${health.backend ?? '?'})` : ' (layanan tidak menjawab, memakai versi kode)'}`)

const { index, errors } = loadContent(values['content-dir'] ?? findContentDir())
if (errors.length > 0) console.warn(`konten punya ${errors.length} error, soal yang rusak dilewati`)
const spelling = loadSpelling(values['content-dir'] ?? findContentDir())
const contentDir = values['content-dir'] ?? findContentDir()
let clips = dedupe([...repoClips(index), ...Object.values(spelling.levels).flatMap((w) => spellingSpeechClips(w)), ...dictionaryClips(contentDir), ...bookClips(contentDir), ...worldClips(contentDir)]).filter((c) => isClipText(c.text))
if (values.limit) clips = clips.slice(0, Number(values.limit))

await mkdir(ttsRoot(dataDir), { recursive: true })
const manifest = clips.map((c) => JSON.stringify({ key: clipKey(c.text, c.style, version), style: c.style, text: c.text, version })).join('\n') + '\n'
// manifest.jsonl = set yang sedang dikerjakan (dibaca check_clips.py); manifest-<versi>.jsonl dipakai tts:promote.
await writeFile(join(ttsRoot(dataDir), 'manifest.jsonl'), manifest)
await writeFile(join(ttsRoot(dataDir), `manifest-${version}.jsonl`), manifest)

const todo = []
for (const c of clips) if (!(await hasClip(dataDir, clipKey(c.text, c.style, version)))) todo.push(c)
console.log(`klip: ${clips.length} total, ${clips.length - todo.length} sudah ada, ${todo.length} dibuat sekarang`)
if (values.dry || todo.length === 0) process.exit(0)

const started = Date.now()
let done = 0
let failed = 0
let next = 0
let stop = false
process.on('SIGINT', () => {
  stop = true
  console.log('\nberhenti setelah potongan ini, jalankan lagi untuk melanjutkan')
})

async function lane(): Promise<void> {
  while (!stop) {
    const at = next
    next += batchSize
    const group = todo.slice(at, at + batchSize)
    if (group.length === 0) return
    const res = await client.synthesizeBatch(group)
    if (!res.ok) {
      failed += group.length
      console.warn(`potongan gagal (${res.code}): ${res.detail}`)
      if (res.code !== 'failed') {
        stop = true
        return
      }
      continue
    }
    for (const [k, item] of res.items.entries()) {
      const c = group[k]!
      if (item.ok) {
        await writeClip(dataDir, clipKey(c.text, c.style, version), item.audio)
        done++
      } else {
        failed++
        console.warn(`gagal: ${c.text.slice(0, 50)} (${item.detail})`)
      }
    }
    const secs = (Date.now() - started) / 1000
    console.log(`${done}/${todo.length} klip, ${failed} gagal, ${(done / secs).toFixed(1)} klip/detik, ${Math.round(secs)} detik`)
  }
}

await Promise.all(Array.from({ length: concurrency }, () => lane()))
const secs = (Date.now() - started) / 1000
console.log(`selesai: ${done} dibuat, ${failed} gagal, ${secs.toFixed(0)} detik, ${(done / Math.max(1, secs)).toFixed(1)} klip/detik`)
if (failed > 0) process.exitCode = 1
