import { JobError, UsageLimitError, abortError, durationId } from '../errors'
import { extractJson } from './json'
import type { AiProvider, AiRunInput, AiRunOutput, AiTier } from './types'

/**
 * Provider `openai-compatible`: POST {AI_BASE_URL}/chat/completions, untuk model lokal Gatxel
 * (ai.gatxel.com) atau DeepInfra. Keluaran diminta lewat response_format json_schema (strict).
 * Bila server menolak response_format, permintaan diulang tanpa response_format dengan skema di
 * prompt sistem, lalu JSON diambil dari teks jawaban.
 */

type FetchLike = (url: string, init: RequestInit) => Promise<Response>

export type OpenAiOptions = { baseUrl: string; apiKey?: string | undefined; model: string; fetchImpl?: FetchLike }

/** Waktu reset dari header Retry-After (detik atau tanggal HTTP). */
export function retryAfterToDate(header: string | null, now: Date = new Date()): Date | null {
  if (!header) return null
  const secs = Number(header)
  if (Number.isFinite(secs) && secs >= 0) return new Date(now.getTime() + secs * 1000)
  const at = Date.parse(header)
  return Number.isNaN(at) ? null : new Date(at)
}

export class OpenAiCompatibleProvider implements AiProvider {
  readonly name = 'openai-compatible' as const
  readonly label = 'server AI'
  readonly model: string
  readonly ready = true
  readonly notReadyReason = null
  private readonly url: string
  private readonly fetchImpl: FetchLike

  constructor(private readonly opts: OpenAiOptions) {
    this.model = opts.model
    this.url = `${opts.baseUrl.replace(/\/+$/, '')}/chat/completions`
    this.fetchImpl = opts.fetchImpl ?? ((u, i) => fetch(u, i))
  }

  modelFor(_tier: AiTier): string {
    return this.model
  }

  async describe(): Promise<string | null> {
    try {
      return `server ${new URL(this.opts.baseUrl).host}`
    } catch {
      return null
    }
  }

  private async post(body: unknown, signal: AbortSignal): Promise<Response> {
    const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json' }
    if (this.opts.apiKey) headers.authorization = `Bearer ${this.opts.apiKey}`
    return this.fetchImpl(this.url, { method: 'POST', headers, body: JSON.stringify(body), signal })
  }

  async run(input: AiRunInput): Promise<AiRunOutput> {
    const started = Date.now()
    const timeout = AbortSignal.timeout(input.timeoutMs)
    const signal = input.signal ? AbortSignal.any([timeout, input.signal]) : timeout
    const userContent = input.images?.length
      ? [{ type: 'text', text: input.prompt }, ...input.images.map((i) => ({ type: 'image_url', image_url: { url: `data:${i.mime};base64,${i.base64}` } }))]
      : input.prompt
    const strictBody = {
      model: this.model,
      messages: [
        { role: 'system', content: input.system },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_schema', json_schema: { name: 'kira_output', strict: true, schema: input.jsonSchema } },
    }
    try {
      let res = await this.post(strictBody, signal)
      if (res.status === 400 || res.status === 422) {
        const text = await res.text().catch(() => '')
        if (!/response_format|json_schema|schema|structured/i.test(text)) {
          throw new JobError(`Server AI menolak permintaan (kode ${res.status}).`, { retryable: false })
        }
        const fallbackBody = {
          model: this.model,
          messages: [
            { role: 'system', content: `${input.system}\n\nReply with one JSON object only, with no other text. It must match this JSON Schema:\n${JSON.stringify(input.jsonSchema)}` },
            { role: 'user', content: userContent },
          ],
        }
        res = await this.post(fallbackBody, signal)
      }
      if (res.status === 429) throw new UsageLimitError(retryAfterToDate(res.headers.get('retry-after')), this.label)
      if (res.status === 401 || res.status === 403) throw new JobError('Kunci AI_API_KEY ditolak server AI. Periksa kunci di .env lalu mulai ulang worker.', { retryable: false })
      if (res.status === 404) throw new JobError('Alamat AI_BASE_URL atau model AI_MODEL tidak ditemukan di server AI.', { retryable: false })
      if (res.status >= 500) throw new JobError(`Server AI sedang bermasalah (kode ${res.status}).`, { retryable: true })
      if (!res.ok) throw new JobError(`Server AI menolak permintaan (kode ${res.status}).`, { retryable: false })
      const data = (await res.json()) as { model?: unknown; usage?: unknown; choices?: { message?: { content?: unknown; refusal?: unknown } }[] }
      const message = data.choices?.[0]?.message
      if (message?.refusal) throw new JobError('Model AI menolak menjawab permintaan ini.', { retryable: false })
      const content = typeof message?.content === 'string'
        ? message.content
        : Array.isArray(message?.content)
          ? (message.content as { text?: unknown }[]).map((p) => (typeof p?.text === 'string' ? p.text : '')).join('')
          : ''
      const json = extractJson(content)
      if (json === undefined) throw new JobError('Jawaban server AI bukan JSON yang bisa dibaca.', { retryable: true })
      return { json, usage: data.usage ?? undefined, model: typeof data.model === 'string' ? data.model : this.model, durationMs: Date.now() - started }
    } catch (e) {
      if (e instanceof JobError || e instanceof UsageLimitError) throw e
      if (input.signal?.aborted) throw abortError()
      if (timeout.aborted) throw new JobError(`Server AI tidak menjawab dalam ${durationId(input.timeoutMs)}.`, { retryable: true })
      throw new JobError('Server AI tidak bisa dihubungi. Cek AI_BASE_URL dan jaringan server.', { retryable: true, cause: e })
    }
  }
}
