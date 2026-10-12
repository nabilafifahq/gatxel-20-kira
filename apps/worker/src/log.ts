/**
 * Log JSON satu baris per kejadian, salinan apps/web/src/server/log.ts tanpa 'server-only'.
 * Kunci sensitif disensor sebelum ditulis (GTX: jangan pernah mencatat password, token, sesi, atau kunci).
 * Tambahan worker: isi prompt, jawaban learner, umpan balik, dan isi email juga disensor, jadi
 * kesalahan menaruh data itu di meta tidak sampai ke log.
 */
const REDACT = /pass(word)?|token|secret|authorization|cookie|session|apikey|api_key|pin|otp|challenge|credential|prompt|answer|feedback|html|body|smtp_url/i

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || value === undefined) return value
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack?.split('\n').slice(0, 6).join('\n') }
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => scrub(v, depth + 1))
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = REDACT.test(k) ? '[disensor]' : scrub(v, depth + 1)
    return out
  }
  if (typeof value === 'string' && value.length > 2000) return `${value.slice(0, 2000)}...`
  return value
}

type Level = 'debug' | 'info' | 'warn' | 'error'

function write(level: Level, msg: string, meta?: Record<string, unknown>) {
  if (level === 'debug' && process.env.NODE_ENV === 'production') return
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...(meta ? (scrub(meta) as object) : {}) })
  if (level === 'error' || level === 'warn') console.error(line)
  else console.log(line)
}

export type Logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => void
  info: (msg: string, meta?: Record<string, unknown>) => void
  warn: (msg: string, meta?: Record<string, unknown>) => void
  error: (msg: string, meta?: Record<string, unknown>) => void
  child: (base: Record<string, unknown>) => Logger
}

function make(base: Record<string, unknown>): Logger {
  const w = (level: Level) => (msg: string, meta?: Record<string, unknown>) => write(level, msg, { ...base, ...meta })
  return { debug: w('debug'), info: w('info'), warn: w('warn'), error: w('error'), child: (more) => make({ ...base, ...more }) }
}

export const log: Logger = make({})
