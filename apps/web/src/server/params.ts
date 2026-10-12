import 'server-only'
import { isIsoDate } from '@kira/core/time'

/**
 * Pembaca searchParams dan params. Semua nilai dari URL adalah input pengguna:
 * nilai yang tidak lolos validasi dianggap tidak ada (null), tidak pernah dilempar ke halaman.
 */
export type SearchParams = Record<string, string | string[] | undefined>

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v)
}

export function spString(sp: SearchParams, key: string, max = 120): string | null {
  const raw = sp[key]
  const v = Array.isArray(raw) ? raw[0] : raw
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t.length > 0 && t.length <= max ? t : null
}

export function spUuid(sp: SearchParams, key: string): string | null {
  const v = spString(sp, key, 36)
  return v && isUuid(v) ? v : null
}

export function spDate(sp: SearchParams, key: string): string | null {
  const v = spString(sp, key, 10)
  return v && isIsoDate(v) ? v : null
}

export function spInt(sp: SearchParams, key: string, min: number, max: number): number | null {
  const v = spString(sp, key, 12)
  if (!v || !/^-?\d+$/.test(v)) return null
  const n = Number(v)
  return n >= min && n <= max ? n : null
}

export function spEnum<T extends string>(sp: SearchParams, key: string, values: readonly T[]): T | null {
  const v = spString(sp, key, 60)
  return v && (values as readonly string[]).includes(v) ? (v as T) : null
}
