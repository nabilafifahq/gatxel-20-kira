import { describe, expect, it } from 'vitest'
import { claudeArgs, claudeChildEnv, claudeUserMessage, interpretClaudeStream } from '../src/ai/claude-code'

/**
 * Baris contoh diringkas dari keluaran nyata Claude Code CLI 2.1.295 dengan
 * --output-format stream-json --verbose (dijalankan terhadap server Messages API tiruan).
 */
const init = JSON.stringify({ type: 'system', subtype: 'init', tools: ['StructuredOutput'], mcp_servers: [], model: 'claude-haiku-5-5', permissionMode: 'dontAsk' })
const allowed = JSON.stringify({ type: 'rate_limit_event', rate_limit_info: { status: 'allowed', isUsingOverage: false } })

const success = [
  init,
  JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'StructuredOutput', input: { ok: true } }] } }),
  allowed,
  JSON.stringify({
    type: 'result',
    subtype: 'success',
    is_error: false,
    result: '{"ok":true}',
    structured_output: { ok: true },
    num_turns: 2,
    api_error_status: null,
    terminal_reason: 'completed',
    total_cost_usd: 0.0002,
    duration_api_ms: 939,
    usage: { input_tokens: 2, output_tokens: 52, cache_read_input_tokens: 0, cache_creation_input_tokens: 920 },
    modelUsage: { 'claude-haiku-5-5': { inputTokens: 2, outputTokens: 52 } },
  }),
].join('\n')

const usageLimit = [
  init,
  JSON.stringify({ type: 'rate_limit_event', rate_limit_info: { status: 'rejected', resetsAt: 1791804913, rateLimitType: 'five_hour', isUsingOverage: false } }),
  JSON.stringify({ type: 'result', subtype: 'success', is_error: true, result: "You've hit your session limit \u00B7 resets 11:35am (UTC)", api_error_status: 429, terminal_reason: 'api_error', api_error: 'usage_limit_reached' }),
].join('\n')

const plain429 = [
  init,
  JSON.stringify({ type: 'system', subtype: 'api_retry', attempt: 1, max_retries: 2, error_status: 429, error: 'rate_limit' }),
  JSON.stringify({ type: 'rate_limit_event', rate_limit_info: { status: 'rejected', isUsingOverage: false } }),
  JSON.stringify({ type: 'result', subtype: 'success', is_error: true, result: 'API Error: Server is temporarily limiting requests (not your usage limit) \u00B7 Rate limited', api_error_status: 429, terminal_reason: 'api_error', api_error: null }),
].join('\n')

const auth401 = [init, JSON.stringify({ type: 'result', subtype: 'success', is_error: true, result: 'Failed to authenticate. API Error: 401 Invalid bearer token', api_error_status: 401 })].join('\n')
const server500 = [init, JSON.stringify({ type: 'result', subtype: 'success', is_error: true, result: 'API Error: 500 Internal server error.', api_error_status: 500 })].join('\n')

describe('interpretClaudeStream', () => {
  it('berhasil: structured_output, model, dan pemakaian token', () => {
    const r = interpretClaudeStream(success, 0, 'claude-haiku-5-5')
    expect(r.kind).toBe('ok')
    if (r.kind !== 'ok') return
    expect(r.json).toEqual({ ok: true })
    expect(r.model).toBe('claude-haiku-5-5')
    expect(r.usage).toMatchObject({ inputTokens: 2, outputTokens: 52, cacheCreationInputTokens: 920, costUsdEstimate: 0.0002, numTurns: 2 })
  })

  it('batas langganan: limit dengan waktu reset dari rate_limit_event', () => {
    const r = interpretClaudeStream(usageLimit, 1, 'm')
    expect(r).toEqual({ kind: 'limit', resetAt: new Date(1791804913 * 1000) })
  })

  it('429 biasa tanpa waktu reset tetap dianggap limit', () => {
    expect(interpretClaudeStream(plain429, 1, 'm')).toEqual({ kind: 'limit', resetAt: null })
  })

  it('401: token ditolak, tidak dicoba lagi', () => {
    const r = interpretClaudeStream(auth401, 1, 'm')
    expect(r.kind).toBe('error')
    if (r.kind !== 'error') return
    expect(r.retryable).toBe(false)
    expect(r.message).toMatch(/Token Claude ditolak/)
  })

  it('500: server bermasalah, dicoba lagi', () => {
    const r = interpretClaudeStream(server500, 1, 'm')
    expect(r).toMatchObject({ kind: 'error', retryable: true, status: 500 })
  })

  it('tanpa baris result: kesalahan yang dicoba lagi', () => {
    const r = interpretClaudeStream(`${init}\nbukan json\n`, 137, 'm')
    expect(r).toMatchObject({ kind: 'error', retryable: true })
  })

  it('JSON di teks bila structured_output kosong', () => {
    const out = JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'Here:\n```json\n{"hints":["a","b","c"]}\n```' })
    const r = interpretClaudeStream(out, 0, 'm')
    expect(r).toMatchObject({ kind: 'ok', json: { hints: ['a', 'b', 'c'] }, model: 'm' })
  })

  it('pesan untuk tutor tanpa em dash atau en dash', () => {
    for (const s of [usageLimit, plain429, auth401, server500, '']) {
      const r = interpretClaudeStream(s, 1, 'm')
      if (r.kind === 'error') expect(r.message).not.toMatch(/[\u2013\u2014]/)
    }
  })
})

describe('argumen dan env proses claude', () => {
  it('tanpa tool, tanpa MCP, tanpa setelan, tanpa sesi, tanpa --bare', () => {
    const args = claudeArgs({ model: 'claude-sonnet-5-5', system: 'sys', schema: { type: 'object', properties: {}, additionalProperties: false } })
    const pair = (flag: string) => args[args.indexOf(flag) + 1]
    expect(args[0]).toBe('-p')
    expect(pair('--tools')).toBe('')
    expect(pair('--mcp-config')).toBe('{"mcpServers":{}}')
    expect(args).toContain('--strict-mcp-config')
    expect(pair('--setting-sources')).toBe('')
    expect(args).toContain('--no-session-persistence')
    expect(pair('--input-format')).toBe('stream-json')
    expect(pair('--output-format')).toBe('stream-json')
    expect(args).toContain('--verbose')
    expect(pair('--model')).toBe('claude-sonnet-5-5')
    expect(JSON.parse(pair('--json-schema')!)).toEqual({ type: 'object', properties: {}, additionalProperties: false })
    expect(args).not.toContain('--bare')
  })

  it('env minimal: rahasia worker tidak ikut', () => {
    const env = claudeChildEnv(
      { PATH: '/usr/bin', DATABASE_URL_WORKER: 'postgres://x', SMTP_URL: 'smtp://u:p@h', KIRA_INTERNAL_TOKEN: 'x'.repeat(40), HTTPS_PROXY: 'http://proxy:3128' },
      '/tmp/h',
      'tok',
    )
    expect(env).toMatchObject({ PATH: '/usr/bin', HOME: '/tmp/h', CLAUDE_CODE_OAUTH_TOKEN: 'tok', CLAUDE_CODE_DISABLE_CLAUDE_MDS: '1', HTTPS_PROXY: 'http://proxy:3128' })
    expect(Object.keys(env).some((k) => /DATABASE|SMTP|KIRA/.test(k))).toBe(false)
  })

  it('pesan stdin: teks lalu gambar base64', () => {
    const line = claudeUserMessage('Mark this.', [{ mime: 'image/png', base64: 'AAAA' }])
    expect(line.endsWith('\n')).toBe(true)
    const msg = JSON.parse(line)
    expect(msg).toEqual({
      type: 'user',
      message: { role: 'user', content: [{ type: 'text', text: 'Mark this.' }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } }] },
    })
  })
})
