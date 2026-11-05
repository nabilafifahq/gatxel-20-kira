/**
 * Buat klip suara Indonesia untuk terjemahan penjelasan, lewat API suara Gatxel. Set bahasa Inggris dan penunjuknya tidak disentuh.
 *
 *   pnpm tts:generate-id -- --out C:/kw4/tts-id --env C:/kw4/_secrets/voice.env [--kinds lesson,explanation,solution,tip,why]
 *       [--url http://127.0.0.1:3000/api/v1/audio/speech] [--concurrency 2] [--limit N] [--dry]
 *
 * - Klip ditulis ke <out>/tts/<kunci>.mp3 dan daftarnya ke <out>/tts/manifest.jsonl dan manifest-<versi>.jsonl.
 *   Kunci = sha256(versi suara Indonesia, peran indonesian, teks yang tampil). Teks yang dikirim ke API adalah bentuk ucapan
 *   (`spokenIndonesian`), jadi lambang dan angka dibaca benar tanpa mengubah kuncinya.
 * - Bisa dilanjutkan: klip yang sudah ada dilewati. Aman dihentikan kapan saja; berkas ditulis lewat berkas sementara lalu rename.
 * - Layanan itu dipakai bersama, jadi konkurensi paling banyak 2.
 * - Kunci API dibaca dari berkas --env dan tidak pernah dicetak.
 */
import { appendFile, mkdir, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { findContentDir } from '@kira/content/load'
import type { SourceText } from '@kira/content/translations'
import { spokenIndonesian, TTS_ID_VOICE_VERSION, TTS_STYLE_VOICE } from '@kira/core/tts'
import { translationClips } from '../src/tts/collect'
import { clipKey, hasClip, ttsRoot, writeClip } from '../src/tts/store'

const { values } = parseArgs({
  options: {
    out: { type: 'string' },
    env: { type: 'string' },
    kinds: { type: 'string', default: 'lesson,explanation,solution,tip,why' },
    url: { type: 'string', default: 'http://127.0.0.1:3000/api/v1/audio/speech' },
    concurrency: { type: 'string', default: '2' },
    limit: { type: 'string' },
    dry: { type: 'boolean', default: false },
  },
})

const out = values.out
if (!out) throw new Error('--out wajib')
const concurrency = Math.min(2, Math.max(1, Number(values.concurrency)))

function apiKey(): string {
  if (!values.env) throw new Error('--env wajib')
  for (const line of readFileSync(values.env, 'utf8').split(/\r?\n/)) {
    const m = /^GATXEL_VOICE_KEY=(.*)$/.exec(line.trim())
    if (m?.[1]) return m[1].replace(/^["']|["']$/g, '')
  }
  throw new Error('GATXEL_VOICE_KEY tidak ada di berkas env')
}

const kinds = values.kinds!.split(',') as SourceText['kind'][]
let clips = translationClips(findContentDir(), kinds)
if (values.limit) clips = clips.slice(0, Number(values.limit))
const version = TTS_ID_VOICE_VERSION
const rows = clips.map((c) => ({ key: clipKey(c.text, 'indonesian', version), style: 'indonesian' as const, text: c.text, version }))

await mkdir(ttsRoot(out), { recursive: true })
const manifest = rows.map((r) => JSON.stringify(r)).join('\n') + '\n'
await writeFile(join(ttsRoot(out), 'manifest.jsonl'), manifest)
await writeFile(join(ttsRoot(out), `manifest-${version}.jsonl`), manifest)
console.log(`versi suara ${version}, jenis ${kinds.join(',')}: ${rows.length} klip`)
if (values.dry) process.exit(0)

const key = apiKey()
const started = Date.now()
let next = 0
let made = 0
let skipped = 0
let failed = 0

async function synth(text: string): Promise<Buffer> {
  let lastError = ''
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(values.url!, {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'piper', voice: TTS_STYLE_VOICE.indonesian, input: spokenIndonesian(text) }),
        signal: AbortSignal.timeout(120_000),
      })
      if (!res.ok) throw new Error(`status ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length < 500) throw new Error('klip terlalu kecil')
      return buf
    } catch (e) {
      lastError = e instanceof Error ? e.message : 'gagal'
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)))
    }
  }
  throw new Error(lastError)
}

async function worker(): Promise<void> {
  for (;;) {
    const i = next++
    const row = rows[i]
    if (!row) return
    if (await hasClip(out!, row.key)) {
      skipped++
      continue
    }
    try {
      await writeClip(out!, row.key, await synth(row.text))
      made++
    } catch (e) {
      failed++
      await appendFile(join(ttsRoot(out!), 'gagal.jsonl'), JSON.stringify({ key: row.key, error: e instanceof Error ? e.message : 'gagal' }) + '\n')
    }
    if ((made + failed) % 200 === 0) console.log(`dibuat ${made}, dilewati ${skipped}, gagal ${failed}, ${Math.round((Date.now() - started) / 1000)} detik`)
  }
}

await Promise.all(Array.from({ length: concurrency }, worker))
console.log(`Selesai: dibuat ${made}, sudah ada ${skipped}, gagal ${failed}, dari ${rows.length}, ${Math.round((Date.now() - started) / 1000)} detik`)
if (failed > 0) process.exitCode = 1
