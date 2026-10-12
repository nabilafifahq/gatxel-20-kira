import { describe, expect, it, vi } from 'vitest'
import { createRateLimiter, handleMcpPost, MCP_PROTOCOL_VERSIONS, type McpDeps, type McpHttpResponse } from '@/server/dal/mcp'

const AUTH = { tokenId: 'tok-1', orgId: 'org-1', userId: 'tutor-1' }
const GOOD = 'kira_mcp_good-token'

function deps(over: Partial<McpDeps> = {}): McpDeps {
  return {
    origin: 'https://kira.example.test',
    authenticate: async (t) => (t === GOOD ? AUTH : null),
    rateLimit: () => 0,
    callTool: async (_auth, name, args) => ({ content: [{ type: 'text', text: JSON.stringify({ name, args }) }] }),
    onToolError: () => 'KR-TEST01',
    ...over,
  }
}

function post(body: unknown, headers: Record<string, string> = {}, d: McpDeps = deps()): Promise<McpHttpResponse> {
  return handleMcpPost(
    {
      headers: new Headers({ authorization: `Bearer ${GOOD}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers }),
      body: typeof body === 'string' ? body : JSON.stringify(body),
    },
    d,
  )
}

const json = (r: McpHttpResponse) => JSON.parse(r.body ?? 'null')

describe('initialize', () => {
  it('memakai versi yang diminta klien bila didukung', async () => {
    const r = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'claude-code', version: '2' } } })
    expect(r.status).toBe(200)
    expect(r.headers['Content-Type']).toBe('application/json')
    const body = json(r)
    expect(body).toMatchObject({ jsonrpc: '2.0', id: 1, result: { protocolVersion: '2025-06-18', capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'kira' } } })
    expect(typeof body.result.instructions).toBe('string')
  })

  it('menjawab dengan versi terbaru yang didukung bila versi klien tidak dikenal', async () => {
    const r = await post({ jsonrpc: '2.0', id: 'a', method: 'initialize', params: { protocolVersion: '2099-01-01' } })
    expect(json(r).result.protocolVersion).toBe(MCP_PROTOCOL_VERSIONS[0])
  })

  it('initialize tidak ditolak oleh header versi, supaya klien baru bisa kembali ke handshake', async () => {
    const r = await post({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '2025-11-25' } }, { 'mcp-protocol-version': '2026-07-28' })
    expect(r.status).toBe(200)
  })

  it('notifications/initialized dijawab 202 tanpa isi', async () => {
    const r = await post({ jsonrpc: '2.0', method: 'notifications/initialized' })
    expect(r.status).toBe(202)
    expect(r.body).toBeNull()
  })

  it('ping dijawab objek kosong', async () => {
    expect(json(await post({ jsonrpc: '2.0', id: 3, method: 'ping' }))).toEqual({ jsonrpc: '2.0', id: 3, result: {} })
  })
})

describe('tools/list dan tools/call', () => {
  it('mendaftar enam tool dengan JSON Schema objek', async () => {
    const r = await post({ jsonrpc: '2.0', id: 4, method: 'tools/list' }, { 'mcp-protocol-version': '2025-06-18' })
    const tools = json(r).result.tools as { name: string; description: string; inputSchema: Record<string, unknown>; annotations: { readOnlyHint: boolean } }[]
    expect(tools.map((t) => t.name)).toEqual(['list_learners', 'learner_progress', 'list_skills', 'get_item', 'search_items', 'create_draft_items'])
    for (const t of tools) {
      expect(t.inputSchema.type).toBe('object')
      expect(t.inputSchema).not.toHaveProperty('$schema')
      expect(t.description.length).toBeGreaterThan(20)
      expect(t.description).not.toMatch(/[\u2013\u2014]/)
    }
    expect(tools.find((t) => t.name === 'learner_progress')?.inputSchema.required).toEqual(['learner'])
    expect(tools.filter((t) => !t.annotations.readOnlyHint).map((t) => t.name)).toEqual(['create_draft_items'])
  })

  it('meneruskan nama tool dan argumen ke implementasi', async () => {
    const callTool = vi.fn(deps().callTool)
    const r = await post({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'list_skills', arguments: { subject: 'math', grade: 2 } } }, {}, deps({ callTool }))
    expect(callTool).toHaveBeenCalledWith(AUTH, 'list_skills', { subject: 'math', grade: 2 })
    expect(json(r).result.content[0].text).toContain('list_skills')
  })

  it('tool yang tidak dikenal menjadi error -32602', async () => {
    const r = await post({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'drop_tables', arguments: {} } })
    expect(json(r).error).toMatchObject({ code: -32602 })
  })

  it('error tak terduga di tool menjadi isError dengan kode referensi, tanpa jejak tumpukan', async () => {
    const r = await post(
      { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'get_item', arguments: { ref: 'm2.arrays.003' } } },
      {},
      deps({ callTool: async () => Promise.reject(new Error('relation "secret" does not exist')) }),
    )
    const result = json(r).result
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('KR-TEST01')
    expect(result.content[0].text).not.toContain('relation')
  })
})

describe('protokol dan keamanan', () => {
  it('metode yang tidak dikenal menjadi -32601', async () => {
    const r = await post({ jsonrpc: '2.0', id: 8, method: 'resources/list' })
    expect(r.status).toBe(200)
    expect(json(r)).toMatchObject({ id: 8, error: { code: -32601 } })
  })

  it('token salah atau tidak ada dijawab 401 tanpa alasan', async () => {
    for (const headers of [{ authorization: 'Bearer kira_mcp_salah' }, { authorization: '' }, { authorization: 'Basic abc' }]) {
      const r = await post({ jsonrpc: '2.0', id: 9, method: 'tools/list' }, headers)
      expect(r.status).toBe(401)
      expect(r.headers['WWW-Authenticate']).toContain('Bearer')
      expect(json(r)).toEqual({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Unauthorized.' } })
    }
  })

  it('token salah ditolak sebelum isi permintaan dibaca', async () => {
    const r = await post('bukan json', { authorization: 'Bearer kira_mcp_salah' })
    expect(r.status).toBe(401)
  })

  it('versi protokol di header yang tidak didukung dijawab 400 dengan error JSON-RPC biasa', async () => {
    const r = await post({ jsonrpc: '2.0', id: 10, method: 'tools/list' }, { 'mcp-protocol-version': '2026-07-28' })
    expect(r.status).toBe(400)
    // Bukan UnsupportedProtocolVersionError (-32022), supaya klien dua era kembali ke initialize.
    expect(json(r).error.code).toBe(-32600)
  })

  it('origin lain ditolak 403', async () => {
    const r = await post({ jsonrpc: '2.0', id: 11, method: 'ping' }, { origin: 'https://evil.example' })
    expect(r.status).toBe(403)
    expect((await post({ jsonrpc: '2.0', id: 12, method: 'ping' }, { origin: 'https://kira.example.test' })).status).toBe(200)
  })

  it('JSON rusak, batch, dan pesan tanpa jsonrpc ditolak 400', async () => {
    expect(json(await post('{"jsonrpc": "2.0",')).error.code).toBe(-32700)
    expect((await post([{ jsonrpc: '2.0', id: 1, method: 'ping' }])).status).toBe(400)
    expect((await post({ id: 1, method: 'ping' })).status).toBe(400)
    expect((await post({ jsonrpc: '2.0', id: null, method: 'ping' })).status).toBe(400)
  })

  it('jawaban dari klien diterima 202', async () => {
    expect((await post({ jsonrpc: '2.0', id: 1, result: {} })).status).toBe(202)
  })

  it('batas laju dijawab 429 dengan Retry-After', async () => {
    const r = await post({ jsonrpc: '2.0', id: 13, method: 'ping' }, {}, deps({ rateLimit: () => 7 }))
    expect(r.status).toBe(429)
    expect(r.headers['Retry-After']).toBe('7')
  })
})

describe('createRateLimiter', () => {
  it('60 permintaan per menit per token, lalu terisi lagi', () => {
    let now = 1_000_000
    const allow = createRateLimiter(60, () => now)
    for (let i = 0; i < 60; i++) expect(allow('a')).toBe(0)
    expect(allow('a')).toBeGreaterThan(0)
    expect(allow('b')).toBe(0)
    // 1,5 detik mengisi 1,5 token: satu permintaan boleh, berikutnya menunggu.
    now += 1_500
    expect(allow('a')).toBe(0)
    expect(allow('a')).toBeGreaterThan(0)
  })
})
