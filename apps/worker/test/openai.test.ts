import { describe, expect, it } from 'vitest'
import { OpenAiCompatibleProvider, retryAfterToDate } from '../src/ai/openai'
import { JobError, UsageLimitError } from '../src/errors'

type Call = { url: string; body: Record<string, unknown>; headers: Record<string, string> }

function fakeFetch(responses: Response[]) {
  const calls: Call[] = []
  const impl = async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)), headers: init.headers as Record<string, string> })
    const r = responses.shift()
    if (!r) throw new Error('tidak ada respons')
    return r
  }
  return { calls, impl }
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })

const schema = { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false }
const input = { system: 'sys', prompt: 'hi', jsonSchema: schema, timeoutMs: 5000 }

describe('OpenAiCompatibleProvider', () => {
  it('mengirim response_format json_schema strict dan membaca JSON', async () => {
    const f = fakeFetch([json(200, { model: 'gatxel-8b', usage: { total_tokens: 9 }, choices: [{ message: { content: '{"ok":true}' } }] })])
    const p = new OpenAiCompatibleProvider({ baseUrl: 'https://ai.example.test/v1/', apiKey: 'k', model: 'gatxel-8b', fetchImpl: f.impl })
    const out = await p.run(input)
    expect(out).toMatchObject({ json: { ok: true }, model: 'gatxel-8b', usage: { total_tokens: 9 } })
    expect(f.calls[0]!.url).toBe('https://ai.example.test/v1/chat/completions')
    expect(f.calls[0]!.headers.authorization).toBe('Bearer k')
    expect(f.calls[0]!.body.response_format).toEqual({ type: 'json_schema', json_schema: { name: 'kira_output', strict: true, schema } })
  })

  it('gambar dikirim sebagai image_url data URL', async () => {
    const f = fakeFetch([json(200, { choices: [{ message: { content: '{"ok":true}' } }] })])
    const p = new OpenAiCompatibleProvider({ baseUrl: 'https://ai.example.test/v1', model: 'm', fetchImpl: f.impl })
    await p.run({ ...input, images: [{ mime: 'image/jpeg', base64: 'QUJD' }] })
    const user = (f.calls[0]!.body.messages as { role: string; content: unknown }[])[1]!
    expect(user.content).toEqual([{ type: 'text', text: 'hi' }, { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,QUJD' } }])
    expect(f.calls[0]!.headers.authorization).toBeUndefined()
  })

  it('fallback tanpa response_format bila server menolaknya, JSON diambil dari teks', async () => {
    const f = fakeFetch([
      json(400, { error: { message: "response_format 'json_schema' is not supported" } }),
      json(200, { choices: [{ message: { content: 'Sure!\n{"ok": true}' } }] }),
    ])
    const p = new OpenAiCompatibleProvider({ baseUrl: 'https://ai.example.test/v1', model: 'm', fetchImpl: f.impl })
    const out = await p.run(input)
    expect(out.json).toEqual({ ok: true })
    expect(f.calls[1]!.body.response_format).toBeUndefined()
    expect(String((f.calls[1]!.body.messages as { content: string }[])[0]!.content)).toContain('JSON Schema')
  })

  it('429 menjadi UsageLimitError dengan waktu dari Retry-After', async () => {
    const f = fakeFetch([json(429, { error: 'slow down' }, { 'retry-after': '120' })])
    const p = new OpenAiCompatibleProvider({ baseUrl: 'https://ai.example.test/v1', model: 'm', fetchImpl: f.impl })
    const err = await p.run(input).catch((e) => e)
    expect(err).toBeInstanceOf(UsageLimitError)
    expect((err as UsageLimitError).resetAt!.getTime()).toBeGreaterThan(Date.now() + 100_000)
  })

  it('401 tidak dicoba lagi, 503 dicoba lagi', async () => {
    const p401 = new OpenAiCompatibleProvider({ baseUrl: 'https://ai.example.test/v1', model: 'm', fetchImpl: fakeFetch([json(401, {})]).impl })
    const e401 = await p401.run(input).catch((e) => e)
    expect(e401).toBeInstanceOf(JobError)
    expect((e401 as JobError).retryable).toBe(false)
    const p503 = new OpenAiCompatibleProvider({ baseUrl: 'https://ai.example.test/v1', model: 'm', fetchImpl: fakeFetch([json(503, {})]).impl })
    const e503 = await p503.run(input).catch((e) => e)
    expect((e503 as JobError).retryable).toBe(true)
  })

  it('server tidak bisa dihubungi menjadi pesan Indonesia', async () => {
    const p = new OpenAiCompatibleProvider({
      baseUrl: 'https://ai.example.test/v1',
      model: 'm',
      fetchImpl: async () => {
        throw new TypeError('fetch failed')
      },
    })
    const e = await p.run(input).catch((x) => x)
    expect((e as JobError).message).toMatch(/tidak bisa dihubungi/)
  })

  it('Retry-After berupa detik atau tanggal', () => {
    const now = new Date('2026-10-12T10:00:00Z')
    expect(retryAfterToDate('30', now)).toEqual(new Date('2026-10-12T10:00:30Z'))
    expect(retryAfterToDate('Mon, 12 Oct 2026 11:00:00 GMT', now)).toEqual(new Date('2026-10-12T11:00:00Z'))
    expect(retryAfterToDate(null, now)).toBeNull()
  })
})
