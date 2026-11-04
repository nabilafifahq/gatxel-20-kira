import { isClipText, splitClipText, ttsKeyInput, type TtsClipRequest, type TtsStyleId } from '@kira/core/tts'

/**
 * Sisi browser suara bahasa Inggris (Qwen3-TTS). Teks dipecah menjadi klip dengan aturan yang sama dengan
 * worker (packages/core/src/tts.ts), kuncinya dihitung dengan SubtleCrypto (sha256), lalu klip diambil dari
 * /tts/<kunci>.mp3 dengan cookie sesi. Service worker menyimpan klip hari ini untuk offline.
 * Semua fungsi di sini tidak pernah melempar: kegagalan berarti pembaca memakai suara bawaan perangkat.
 */

export type TtsStatus = { enabled: boolean; urls: string[] }

let statusPromise: Promise<TtsStatus | null> | null = null
let statusAt = 0

/** Status layanan suara dan alamat klip hari ini. Diambil sekali per halaman, diulang bila gagal lebih dari semenit lalu. */
export function ttsStatus(): Promise<TtsStatus | null> {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (statusPromise && Date.now() - statusAt < 60_000) return statusPromise
  statusAt = Date.now()
  const p: Promise<TtsStatus | null> = fetch('/api/tts/today', { credentials: 'same-origin' })
    .then((r) => (r.ok ? (r.json() as Promise<TtsStatus>) : null))
    .catch(() => null)
  statusPromise = p
  // Hasil sukses disimpan selama halaman terbuka; hasil gagal boleh diulang.
  void p.then((v) => {
    if (v) statusAt = Number.MAX_SAFE_INTEGER
  })
  return p
}

/** Satu bagian bacaan: teks biasa (suara bawaan peran), atau teks dengan suara sendiri (giliran dialog dua pembicara). */
export type SpeechPart = string | TtsClipRequest

/** Teks yang akan dibuat klip: bagian-bagian dipecah per kalimat, yang tidak layak dibacakan dibuang. */
export function clipPlan(input: string | readonly SpeechPart[], style: TtsStyleId): TtsClipRequest[] {
  const parts = typeof input === 'string' ? [input] : input
  return parts
    .flatMap((p) => (typeof p === 'string' ? splitClipText(p).map((text) => ({ text, style })) : splitClipText(p.text).map((text) => ({ text, style: p.style }))))
    .filter((c) => isClipText(c.text))
}

/** Kunci klip (sha256 hex), atau null bila SubtleCrypto tidak tersedia (alamat http biasa). */
export async function clipKey(text: string, style: TtsStyleId): Promise<string | null> {
  try {
    const subtle = globalThis.crypto?.subtle
    if (!subtle) return null
    const digest = await subtle.digest('SHA-256', new TextEncoder().encode(ttsKeyInput(text, style)))
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return null
  }
}

export type ClipSet = { blobs: Blob[]; missing: TtsClipRequest[]; failed: boolean }

/**
 * Klip yang sudah diambil, per kunci. Pramuat (preloadClips) mengisinya sebelum anak menekan tombol, jadi
 * bacaan mulai tanpa menunggu jaringan. Dibatasi supaya memori tablet aman.
 */
const blobCache = new Map<string, Blob>()
const BLOB_CACHE_MAX = 60
function remember(key: string, blob: Blob): void {
  blobCache.delete(key)
  blobCache.set(key, blob)
  while (blobCache.size > BLOB_CACHE_MAX) blobCache.delete(blobCache.keys().next().value as string)
}

/** Ambil semua klip rencana secara paralel. missing berisi klip yang belum dibuat (404), failed bila jaringan atau hash gagal. */
export async function fetchClips(plan: TtsClipRequest[]): Promise<ClipSet> {
  const keys = await Promise.all(plan.map((c) => clipKey(c.text, c.style)))
  if (keys.some((k) => k === null)) return { blobs: [], missing: [], failed: true }
  type Fetched = { kind: 'ok'; blob: Blob } | { kind: 'missing' } | { kind: 'failed' }
  const results = await Promise.all(
    keys.map(async (k): Promise<Fetched> => {
      try {
        const hit = blobCache.get(k!)
        if (hit) return { kind: 'ok', blob: hit }
        const res = await fetch(`/tts/${k}.mp3`, { credentials: 'same-origin' })
        if (res.ok) {
          const blob = await res.blob()
          remember(k!, blob)
          return { kind: 'ok', blob }
        }
        return { kind: res.status === 404 ? 'missing' : 'failed' }
      } catch {
        return { kind: 'failed' }
      }
    }),
  )
  const missing = plan.filter((_, i) => results[i]!.kind === 'missing')
  const failed = results.some((r) => r.kind === 'failed')
  const blobs: Blob[] = []
  for (const r of results) if (r.kind === 'ok') blobs.push(r.blob)
  return { blobs, missing, failed }
}

/**
 * Ambil klip lebih dulu (soal yang sedang tampil), supaya tombol baca mulai di bawah satu detik. Hanya bila suara
 * server aktif; tidak meminta klip yang belum ada dan tidak pernah melempar.
 */
export function preloadClips(input: string | readonly SpeechPart[], style: TtsStyleId): void {
  if (typeof window === 'undefined' || !navigator.onLine) return
  const plan = clipPlan(input, style)
  if (plan.length === 0) return
  void ttsStatus()
    .then((s) => (s?.enabled ? fetchClips(plan) : undefined))
    .catch(() => undefined)
}

const requested = new Set<string>()

/** Minta worker membuat klip yang belum ada. Satu teks hanya diminta sekali per halaman; hasilnya tidak ditunggu. */
export function requestClips(clips: TtsClipRequest[]): void {
  const fresh = clips.filter((c) => {
    const k = ttsKeyInput(c.text, c.style)
    if (requested.has(k)) return false
    requested.add(k)
    return true
  })
  if (fresh.length === 0 || typeof navigator === 'undefined' || !navigator.onLine) return
  void fetch('/api/tts/request', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ clips: fresh.slice(0, 12) }),
  }).catch(() => undefined)
}

/** Pesan ke service worker: simpan klip hari ini untuk offline. */
export function precacheClips(urls: string[]): void {
  if (urls.length === 0 || typeof navigator === 'undefined' || !('serviceWorker' in navigator) || !navigator.onLine) return
  void navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage({ type: 'precache-audio', urls })).catch(() => undefined)
}

/** Teks untuk suara bawaan perangkat: semua bagian, masing-masing diakhiri tanda baca supaya ada jeda. */
export function deviceText(input: string | readonly SpeechPart[]): string {
  const parts = typeof input === 'string' ? [input] : input
  return parts
    .map((p) => (typeof p === 'string' ? p : p.text).trim())
    .filter(Boolean)
    .map((p) => (/[.!?]$/.test(p) ? p : `${p}.`))
    .join(' ')
}
