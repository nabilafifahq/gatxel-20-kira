import 'server-only'
import { kvEval, kvSetNx } from './kv'

/**
 * Pembatas laju bersama semua replika web lewat Valkey. Bila Valkey tidak tersedia, setiap fungsi memakai
 * hitungan di memori proses ini (lebih longgar karena tiap replika menghitung sendiri, tetapi tetap membatasi).
 */

const BUCKET_LUA = `
local t = redis.call('TIME')
local now = t[1] * 1000 + math.floor(t[2] / 1000)
local cap = tonumber(ARGV[1])
local v = redis.call('HMGET', KEYS[1], 't', 'a')
local tokens = tonumber(v[1]) or cap
local at = tonumber(v[2]) or now
tokens = math.min(cap, tokens + (now - at) / 60000 * cap)
local ok = 0
local wait = 0
if tokens >= 1 then tokens = tokens - 1; ok = 1 else wait = math.ceil((1 - tokens) * 60 / cap) end
redis.call('HSET', KEYS[1], 't', tostring(tokens), 'a', tostring(now))
redis.call('PEXPIRE', KEYS[1], 120000)
return {ok, wait}
`

const WINDOW_LUA = `
local c = redis.call('INCRBY', KEYS[1], ARGV[2])
if c == tonumber(ARGV[2]) then redis.call('PEXPIRE', KEYS[1], ARGV[3]) end
if c > tonumber(ARGV[1]) then redis.call('DECRBY', KEYS[1], ARGV[2]); return 0 end
return 1
`

const buckets = new Map<string, { tokens: number; at: number }>()

function memoryBucket(key: string, perMinute: number, now: number): number {
  const b = buckets.get(key) ?? { tokens: perMinute, at: now }
  b.tokens = Math.min(perMinute, b.tokens + ((now - b.at) / 60_000) * perMinute)
  b.at = now
  if (b.tokens < 1) {
    buckets.set(key, b)
    return Math.max(1, Math.ceil(((1 - b.tokens) * 60) / perMinute))
  }
  b.tokens -= 1
  buckets.set(key, b)
  if (buckets.size > 5000) buckets.clear()
  return 0
}

/** Ember token per menit. Mengembalikan 0 bila boleh, atau jumlah detik tunggu. */
export async function takeToken(key: string, perMinute: number): Promise<number> {
  const r = await kvEval(BUCKET_LUA, [`rl:${key}`], [perMinute])
  if (Array.isArray(r) && typeof r[0] === 'number') return r[0] === 1 ? 0 : Math.max(1, Number(r[1]) || 1)
  return memoryBucket(key, perMinute, Date.now())
}

const windows = new Map<string, { n: number; until: number }>()

/** Hitung n kejadian dalam jendela tetap. False bila melewati batas (hitungan tidak bertambah). */
export async function takeWindow(key: string, limit: number, windowMs: number, n = 1): Promise<boolean> {
  const r = await kvEval(WINDOW_LUA, [`rw:${key}`], [limit, n, windowMs])
  if (typeof r === 'number') return r === 1
  const now = Date.now()
  const w = windows.get(key)
  const cur = w && w.until > now ? w : { n: 0, until: now + windowMs }
  if (cur.n + n > limit) return false
  cur.n += n
  windows.set(key, cur)
  if (windows.size > 5000) windows.clear()
  return true
}

const claimed = new Map<string, number>()

/** True bila kunci ini belum diklaim dalam ttlMs terakhir (dan sekarang diklaim). */
export async function claimOnce(key: string, ttlMs: number): Promise<boolean> {
  const r = await kvSetNx(`rc:${key}`, Math.max(1, Math.ceil(ttlMs / 1000)))
  if (r !== null) return r
  const now = Date.now()
  const until = claimed.get(key)
  if (until && until > now) return false
  claimed.set(key, now + ttlMs)
  if (claimed.size > 5000) claimed.clear()
  return true
}
