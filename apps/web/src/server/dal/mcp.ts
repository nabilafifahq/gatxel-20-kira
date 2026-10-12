import 'server-only'
import { z } from 'zod'

/**
 * Server MCP Kira: Streamable HTTP tanpa sesi (JSON-RPC 2.0 lewat POST, jawaban application/json).
 * Modul ini hanya protokol: token, batas laju, dan tool diberikan lewat McpDeps supaya bisa diuji tanpa database.
 * Implementasi tool ada di mcp-tools.ts. Learner hanya muncul sebagai Learner 1, Learner 2, tanpa nama (CLAUDE.md aturan 12).
 *
 * Versi protokol: revisi dengan handshake initialize. Klien yang lebih baru mengirim versi yang tidak dikenal di header
 * MCP-Protocol-Version; server menjawab 400 dengan error JSON-RPC biasa sehingga klien kembali ke initialize.
 */

export const MCP_PROTOCOL_VERSIONS: readonly string[] = ['2025-11-25', '2025-06-18', '2025-03-26']
export const MCP_SERVER_INFO = { name: 'kira', title: 'Kira', version: '1.0.0' }

const INSTRUCTIONS = [
  'Kira is a home learning site for primary school children (Cambridge Primary Math, English and Science).',
  'Learners appear only as Learner 1, Learner 2 and so on; their names are never shared. Start with list_learners.',
  'Items use Kira item JSON. Call get_item on an existing item of the same skill before writing drafts with create_draft_items.',
  'Drafts are only used after a tutor approves them in Studio AI.',
].join(' ')

export type McpAuth = { tokenId: string; orgId: string; userId: string }
export type ToolResult = { content: { type: 'text'; text: string }[]; structuredContent?: Record<string, unknown>; isError?: boolean }

const subject = z.enum(['math', 'english', 'science'])

export const TOOL_INPUTS = {
  list_learners: z.object({}).strict(),
  learner_progress: z
    .object({ learner: z.string().trim().min(1).max(60).describe('A label from list_learners, for example "Learner 1", or the learner id.') })
    .strict(),
  list_skills: z
    .object({
      subject: subject.optional().describe('math, english or science.'),
      grade: z.number().int().min(1).max(6).optional().describe('Grade 1 to 6.'),
    })
    .strict(),
  get_item: z
    .object({ ref: z.string().trim().min(1).max(200).describe('Item ref: m2.oly-patterns.003 (built in), org:<uuid> (family item) or gen:<skill>:<level>:<seed> (generated).') })
    .strict(),
  search_items: z
    .object({
      skillId: z.string().trim().min(1).max(80).optional().describe('Skill id from list_skills, for example m2.numbers-to-100.'),
      text: z.string().trim().min(1).max(100).optional().describe('Words that appear in the item prompt.'),
      limit: z.number().int().min(1).max(50).optional().describe('Maximum number of results, 20 when left out.'),
    })
    .strict(),
  create_draft_items: z
    .object({
      skillId: z.string().trim().min(3).max(80).describe('Skill id from list_skills. Every draft is filed under this skill.'),
      items: z.array(z.record(z.string(), z.unknown())).min(1).max(10).describe('1 to 10 items in Kira item JSON. id, source and skill are set by Kira.'),
    })
    .strict(),
} as const

export type ToolName = keyof typeof TOOL_INPUTS

const TOOL_META: Record<ToolName, { title: string; description: string; readOnly: boolean }> = {
  list_learners: {
    title: 'List learners',
    description: 'List the learners in this family as Learner 1, Learner 2 and so on, with grade and whether the account is active. Names are never shared.',
    readOnly: true,
  },
  learner_progress: {
    title: 'Learner progress',
    description:
      'Progress for one learner: stars (0 to 3) and gate (new, reteach, review or mastered) for every practised skill, and accuracy per subject for each of the last 4 weeks (first attempts only).',
    readOnly: true,
  },
  list_skills: {
    title: 'List skills',
    description: 'Curriculum skills with id, subject, grade, strand, title and can-do statement. Filter by subject and grade to keep the list short.',
    readOnly: true,
  },
  get_item: {
    title: 'Get item',
    description: 'One practice item as Kira item JSON, including the answer key, hints and explanation.',
    readOnly: true,
  },
  search_items: {
    title: 'Search items',
    description: 'Find items by skill, by words in the prompt, or both. Returns refs with a short preview; call get_item for the full JSON.',
    readOnly: true,
  },
  create_draft_items: {
    title: 'Create draft items',
    description:
      'Send 1 to 10 new items for one skill to the Studio AI review queue. Nothing reaches a learner until a tutor approves each draft. Auto-marked types need exactly 3 hints and an explanation; mcq answer is the zero-based index of the correct option.',
    readOnly: false,
  },
}

export function toolDefinitions(): Record<string, unknown>[] {
  return (Object.keys(TOOL_INPUTS) as ToolName[]).map((name) => {
    const { $schema: _drop, ...inputSchema } = z.toJSONSchema(TOOL_INPUTS[name]) as Record<string, unknown>
    void _drop
    const meta = TOOL_META[name]
    return {
      name,
      title: meta.title,
      description: meta.description,
      inputSchema,
      annotations: { title: meta.title, readOnlyHint: meta.readOnly, destructiveHint: false, idempotentHint: meta.readOnly, openWorldHint: false },
    }
  })
}

export function toolJson(data: Record<string, unknown>): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: data }
}

export function toolError(text: string): ToolResult {
  return { content: [{ type: 'text', text }], isError: true }
}

/** Ringkasan masalah argumen tool untuk model: "learner: Too small". */
export function argIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((i) => `${i.path.map(String).join('.') || 'arguments'}: ${i.message}`)
    .join('; ')
}

// ---------------------------------------------------------------------------
// Batas laju per token (memori proses, ember token)

export function createRateLimiter(perMinute: number, now: () => number = Date.now): (key: string) => number {
  const buckets = new Map<string, { tokens: number; at: number }>()
  return (key) => {
    const t = now()
    const b = buckets.get(key) ?? { tokens: perMinute, at: t }
    b.tokens = Math.min(perMinute, b.tokens + ((t - b.at) / 60_000) * perMinute)
    b.at = t
    if (b.tokens < 1) {
      buckets.set(key, b)
      return Math.max(1, Math.ceil(((1 - b.tokens) * 60_000) / perMinute / 1000))
    }
    b.tokens -= 1
    buckets.set(key, b)
    if (buckets.size > 1000) buckets.clear()
    return 0
  }
}

// ---------------------------------------------------------------------------
// HTTP dan JSON-RPC

export type McpDeps = {
  /** Origin publik Kira; permintaan dengan header Origin lain ditolak (DNS rebinding). */
  origin: string
  authenticate(token: string | null): Promise<McpAuth | null>
  /** 0 bila boleh, selain itu jumlah detik sebelum boleh mencoba lagi. */
  rateLimit(tokenId: string): number
  callTool(auth: McpAuth, name: ToolName, args: unknown): Promise<ToolResult>
  /** Catat error tool yang tidak terduga; mengembalikan kode referensi. */
  onToolError(e: unknown, tool: ToolName): string
}

export type McpHttpResponse = { status: number; headers: Record<string, string>; body: string | null }

type JsonRpcId = string | number | null

const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }

function reply(status: number, payload: unknown, extra: Record<string, string> = {}): McpHttpResponse {
  return { status, headers: { ...JSON_HEADERS, ...extra }, body: JSON.stringify(payload) }
}

function rpcError(id: JsonRpcId, code: number, message: string, status = 200, extra: Record<string, string> = {}): McpHttpResponse {
  return reply(status, { jsonrpc: '2.0', id, error: { code, message } }, extra)
}

function rpcResult(id: JsonRpcId, result: unknown): McpHttpResponse {
  return reply(200, { jsonrpc: '2.0', id, result })
}

const accepted = (): McpHttpResponse => ({ status: 202, headers: { 'Cache-Control': 'no-store' }, body: null })

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

export async function handleMcpPost(req: { headers: Headers; body: string }, deps: McpDeps): Promise<McpHttpResponse> {
  const origin = req.headers.get('origin')
  if (origin && origin !== deps.origin) return rpcError(null, -32600, 'Origin not allowed.', 403)

  const bearer = /^Bearer\s+(\S+)\s*$/i.exec(req.headers.get('authorization') ?? '')?.[1] ?? null
  const auth = await deps.authenticate(bearer)
  if (!auth) return rpcError(null, -32001, 'Unauthorized.', 401, { 'WWW-Authenticate': 'Bearer' })

  const wait = deps.rateLimit(auth.tokenId)
  if (wait > 0) {
    return rpcError(null, -32000, `Too many requests: the limit is 60 per minute for each token. Try again in ${wait} second${wait === 1 ? '' : 's'}.`, 429, { 'Retry-After': String(wait) })
  }

  let msg: unknown
  try {
    msg = JSON.parse(req.body)
  } catch {
    return rpcError(null, -32700, 'Parse error: the body is not valid JSON.', 400)
  }
  if (Array.isArray(msg)) return rpcError(null, -32600, 'Batch requests are not supported. Send one JSON-RPC message per request.', 400)
  if (!isObject(msg) || msg.jsonrpc !== '2.0') return rpcError(null, -32600, 'Invalid request: expected one JSON-RPC 2.0 message.', 400)

  const id: JsonRpcId = typeof msg.id === 'string' || typeof msg.id === 'number' ? msg.id : null
  if (typeof msg.method !== 'string') {
    // Jawaban atau error dari klien: server ini tidak pernah mengirim permintaan, jadi cukup diterima.
    if ('result' in msg || 'error' in msg) return accepted()
    return rpcError(id, -32600, 'Invalid request: method is missing.', 400)
  }
  const method = msg.method
  if (!('id' in msg)) return accepted()
  if (id === null) return rpcError(null, -32600, 'Invalid request: id must be a string or a number.', 400)

  if (method !== 'initialize') {
    const version = req.headers.get('mcp-protocol-version')
    if (version && !MCP_PROTOCOL_VERSIONS.includes(version)) {
      return rpcError(id, -32600, `Unsupported MCP protocol version ${version.slice(0, 20)}. This server supports ${MCP_PROTOCOL_VERSIONS.join(', ')} with an initialize handshake.`, 400)
    }
  }

  const params = isObject(msg.params) ? msg.params : {}
  switch (method) {
    case 'initialize': {
      const requested = typeof params.protocolVersion === 'string' ? params.protocolVersion : ''
      return rpcResult(id, {
        protocolVersion: MCP_PROTOCOL_VERSIONS.includes(requested) ? requested : MCP_PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: MCP_SERVER_INFO,
        instructions: INSTRUCTIONS,
      })
    }
    case 'ping':
      return rpcResult(id, {})
    case 'tools/list':
      return rpcResult(id, { tools: toolDefinitions() })
    case 'tools/call': {
      const name = params.name
      if (typeof name !== 'string' || !Object.hasOwn(TOOL_INPUTS, name)) return rpcError(id, -32602, `Unknown tool: ${String(name).slice(0, 60)}.`)
      try {
        return rpcResult(id, await deps.callTool(auth, name as ToolName, params.arguments ?? {}))
      } catch (e) {
        const reference = deps.onToolError(e, name as ToolName)
        return rpcResult(id, toolError(`The tool failed on the Kira server. Try again later. Reference ${reference}.`))
      }
    }
    default:
      return rpcError(id, -32601, `Method not found: ${method.slice(0, 60)}.`)
  }
}
