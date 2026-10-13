import { toSegments, ttsSeed, type TtsStyleId } from '@kira/core/tts'
import { clipKey } from './store'

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

export type TtsClient = {
  health(signal?: AbortSignal): Promise<{ ok: boolean; engineLoaded?: boolean; lastDevice?: string }>
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
        return (await res.json()) as { ok: boolean; engineLoaded?: boolean; lastDevice?: string }
      } catch {
        return { ok: false }
      }
    },
    async synthesize(text, style, signal) {
      const body = JSON.stringify({ style, segments: toSegments(text), seed: ttsSeed(clipKey(text, style)), format: 'mp3' })
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
