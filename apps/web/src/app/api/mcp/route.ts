import { NextResponse } from 'next/server'
import { env, origin } from '@/server/env'
import { newReference } from '@/server/errors'
import { log } from '@/server/log'
import { readTextCapped } from '@/server/http'
import { createRateLimiter, handleMcpPost } from '@/server/dal/mcp'
import { authenticateMcpToken, callKiraTool } from '@/server/dal/mcp-tools'

export const dynamic = 'force-dynamic'

/**
 * Endpoint MCP untuk Claude Code (Streamable HTTP tanpa sesi). Token dari halaman Koneksi Claude,
 * dikirim sebagai Authorization: Bearer. Pemilik token harus masih tutor aktif di org itu.
 */

const MAX_BODY = 512 * 1024
const g = globalThis as unknown as { __kiraMcpLimiter?: (key: string) => number }
const limiter = (g.__kiraMcpLimiter ??= createRateLimiter(60))

function disabled(): NextResponse | null {
  return env().KIRA_MCP === 'on' ? null : new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: Request) {
  const off = disabled()
  if (off) return off
  const body = await readTextCapped(req, MAX_BODY)
  if (body === null) return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Request body is too large.' } }, { status: 413 })
  try {
    const out = await handleMcpPost(
      { headers: req.headers, body },
      {
        origin: origin(),
        authenticate: authenticateMcpToken,
        rateLimit: limiter,
        callTool: callKiraTool,
        onToolError(e, tool) {
          const reference = newReference()
          log.error('tool MCP gagal', { tool, reference, error: e })
          return reference
        },
      },
    )
    return new NextResponse(out.body, { status: out.status, headers: out.headers })
  } catch (e) {
    const reference = newReference()
    log.error('permintaan MCP gagal', { reference, error: e })
    return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32603, message: `Internal error. Reference ${reference}.` } }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}

function notAllowed() {
  return disabled() ?? new NextResponse(null, { status: 405, headers: { Allow: 'POST', 'Cache-Control': 'no-store' } })
}

export function GET() {
  return notAllowed()
}

export function DELETE() {
  return notAllowed()
}
