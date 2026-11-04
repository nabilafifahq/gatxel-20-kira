import { toSegments, type TtsClipRequest, type TtsStyleId } from '@kira/core/tts'

/**
 * Klien layanan suara (deploy/tts/server.py). Tidak pernah melempar: kegagalan dikembalikan sebagai kode
 * supaya job bisa melewati klip dengan tenang.
 *   unavailable  layanan tidak menjawab atau belum dijalankan (profil tts mati)
 *   gpu_oom      GPU tidak punya memori kosong cukup (program lain sedang memakainya)
 *   failed       kegagalan lain
 */
export type SynthResult =
  | { ok: true; audio: Buffer; device: string; genMs: number }
  | { ok: false; code: 'unavailable' | 'gpu_oom' | 'failed'; detail: string }

/** Hasil satu klip dalam batch. */
export type BatchItem = { ok: true; audio: Buffer; genMs: number } | { ok: false; detail: string }
export type BatchResult = { ok: true; items: BatchItem[]; device: string } | { ok: false; code: 'unavailable' | 'gpu_oom' | 'failed'; detail: string }

export type TtsClient = {
  /** Banyak klip sekaligus (POST /batch): layanan membaginya ke beberapa proses mesin. Tidak pernah melempar. */
  synthesizeBatch(clips: TtsClipRequest[], signal?: AbortSignal): Promise<BatchResult>
  health(signal?: AbortSignal): Promise<{ ok: boolean; engineLoaded?: boolean; lastDevice?: string; voiceVersion?: string; backend?: string }>
  synthesize(text: string, style: TtsStyleId, signal?: AbortSignal): Promise<SynthResult>
}

const FIRST_LOAD_TIMEOUT_MS = 15 * 60 * 1000

export function createTtsClient(baseUrl: string, token: string, fetchImpl: typeof fetch = fetch): TtsClient {
  const base = baseUrl.replace(/\/+$/, '')
  return {
    async health(signal) {
      try {
        const res = await fetchImpl(`${base}/health`, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000) })
        if (!res.ok) return { ok: false }
        return (await res.json()) as { ok: boolean; engineLoaded?: boolean; lastDevice?: string; voiceVersion?: string; backend?: string }
      } catch {
        return { ok: false }
      }
    },
    async synthesizeBatch(clips, signal) {
      const body = JSON.stringify({ clips: clips.map((c) => ({ style: c.style, segments: toSegments(c.text) })) })
      const timeout = AbortSignal.timeout(FIRST_LOAD_TIMEOUT_MS)
      try {
        const res = await fetchImpl(`${base}/batch`, {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body,
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        })
        if (res.ok) {
          const j = (await res.json()) as { results: { ok: boolean; mp3?: string; ms?: number; error?: string; detail?: string }[]; device?: string }
          const items: BatchItem[] = j.results.map((r) => {
            if (!r.ok || !r.mp3) return { ok: false, detail: `${r.error ?? 'failed'} ${r.detail ?? ''}`.trim() }
            const audio = Buffer.from(r.mp3, 'base64')
            return audio.length < 200 ? { ok: false, detail: 'Audio kosong dari layanan suara.' } : { ok: true, audio, genMs: r.ms ?? 0 }
          })
          // Galat tingkat mesin pada seluruh potongan (OOM) muncul sebagai gpu_oom di tiap klip.
          if (items.length > 0 && items.every((i) => !i.ok && /gpu_oom|no_gpu/.test(i.detail))) return { ok: false, code: 'gpu_oom', detail: 'GPU tidak punya memori kosong cukup.' }
          return { ok: true, items, device: j.device ?? '-' }
        }
        const err = (await res.json().catch(() => ({}))) as { error?: string; detail?: string }
        if (res.status === 503 && (err.error === 'gpu_oom' || err.error === 'no_gpu')) return { ok: false, code: 'gpu_oom', detail: err.detail ?? 'GPU tidak punya memori kosong cukup.' }
        return { ok: false, code: 'failed', detail: `Layanan suara menjawab ${res.status}: ${err.error ?? ''} ${err.detail ?? ''}`.trim() }
      } catch (e) {
        if (signal?.aborted) throw e
        const code = (e as { cause?: { code?: string } }).cause?.code ?? ''
        const unreachable = /ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ECONNRESET|UND_ERR_SOCKET|EHOSTUNREACH/.test(code) || (e as Error).name === 'TypeError'
        return { ok: false, code: unreachable ? 'unavailable' : 'failed', detail: `Layanan suara tidak terjangkau (${code || (e as Error).name}).` }
      }
    },
    async synthesize(text, style, signal) {
      const body = JSON.stringify({ style, segments: toSegments(text), format: 'mp3' })
      const timeout = AbortSignal.timeout(FIRST_LOAD_TIMEOUT_MS)
      try {
        const res = await fetchImpl(`${base}/synthesize`, {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body,
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        })
        if (res.ok) {
          const audio = Buffer.from(await res.arrayBuffer())
          if (audio.length < 200) return { ok: false, code: 'failed', detail: 'Audio kosong dari layanan suara.' }
          return { ok: true, audio, device: res.headers.get('x-kira-device') ?? '-', genMs: Number(res.headers.get('x-kira-gen-ms') ?? 0) }
        }
        const err = (await res.json().catch(() => ({}))) as { error?: string; detail?: string }
        if (res.status === 503 && (err.error === 'gpu_oom' || err.error === 'no_gpu')) return { ok: false, code: 'gpu_oom', detail: err.detail ?? 'GPU tidak punya memori kosong cukup.' }
        return { ok: false, code: 'failed', detail: `Layanan suara menjawab ${res.status}: ${err.error ?? ''} ${err.detail ?? ''}`.trim() }
      } catch (e) {
        if (signal?.aborted) throw e
        const code = (e as { cause?: { code?: string } }).cause?.code ?? ''
        const unreachable = /ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ECONNRESET|UND_ERR_SOCKET|EHOSTUNREACH/.test(code) || (e as Error).name === 'TypeError'
        return { ok: false, code: unreachable ? 'unavailable' : 'failed', detail: `Layanan suara tidak terjangkau (${code || (e as Error).name}).` }
      }
    },
  }
}
