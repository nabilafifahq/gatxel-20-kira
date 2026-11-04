import { describe, expect, it } from 'vitest'

/**
 * Klien Valkey (RESP2) terhadap server sungguhan. Dilewati bila KIRA_TEST_VALKEY_URL kosong, misalnya:
 *   docker run -d --name vk -p 127.0.0.1:56379:6379 valkey/valkey:8-alpine valkey-server --requirepass uji
 *   KIRA_TEST_VALKEY_URL=redis://:uji@127.0.0.1:56379 pnpm --filter @kira/web test kv
 */
const url = process.env.KIRA_TEST_VALKEY_URL

describe.skipIf(!url)('kv dan limiter lewat Valkey', () => {
  it('get, set, del, incr, setnx, dan skrip bersama antar proses logis', async () => {
    process.env.KIRA_VALKEY_URL = url
    ;(globalThis as { __kiraValkey?: unknown }).__kiraValkey = undefined
    const kv = await import('@/server/kv')
    const k = `uji:${Math.random()}`
    expect(await kv.kvGet(k)).toBeNull()
    await kv.kvSet(k, 'nilai ünïcode', 30)
    expect(await kv.kvGet(k)).toBe('nilai ünïcode')
    await kv.kvDel(k)
    expect(await kv.kvGet(k)).toBeNull()
    expect(await kv.kvIncr(`${k}:n`)).toBe(1)
    expect(await kv.kvIncr(`${k}:n`)).toBe(2)
    expect(await kv.kvSetNx(`${k}:nx`, 30)).toBe(true)
    expect(await kv.kvSetNx(`${k}:nx`, 30)).toBe(false)
    expect(await kv.kvMGet([`${k}:n`, `${k}:none`])).toEqual(['2', null])
    const big = 'x'.repeat(200_000)
    await kv.kvSet(`${k}:big`, big, 30)
    expect((await kv.kvGet(`${k}:big`))?.length).toBe(200_000)
  })

  it('takeToken lewat Lua: satu ember dibagi, paralel tidak melebihi batas', async () => {
    process.env.KIRA_VALKEY_URL = url
    ;(globalThis as { __kiraValkey?: unknown }).__kiraValkey = undefined
    const { takeToken, takeWindow } = await import('@/server/limiter')
    const key = `uji-${Math.random()}`
    const results = await Promise.all(Array.from({ length: 30 }, () => takeToken(key, 10)))
    expect(results.filter((r) => r === 0)).toHaveLength(10)
    const wkey = `w-${Math.random()}`
    const w = await Promise.all(Array.from({ length: 20 }, () => takeWindow(wkey, 7, 60_000)))
    expect(w.filter(Boolean)).toHaveLength(7)
  })

  it('Valkey mati: fungsi mengembalikan null tanpa melempar dan limiter memakai memori', async () => {
    process.env.KIRA_VALKEY_URL = 'redis://:x@127.0.0.1:1'
    ;(globalThis as { __kiraValkey?: unknown }).__kiraValkey = undefined
    const kv = await import('@/server/kv')
    expect(await kv.kvGet('a')).toBeNull()
    const { takeToken } = await import('@/server/limiter')
    const key = `mati-${Math.random()}`
    expect(await takeToken(key, 1)).toBe(0)
    expect(await takeToken(key, 1)).toBeGreaterThan(0)
  })
})
