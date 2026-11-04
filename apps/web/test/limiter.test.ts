import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Pembatas laju tanpa Valkey (KIRA_VALKEY_URL kosong): cadangan di memori harus tetap membatasi.
 * Jalur Valkey diuji di staging (deploy/load) karena butuh server sungguhan.
 */

describe('limiter tanpa Valkey', () => {
  beforeEach(() => {
    vi.resetModules()
    delete process.env.KIRA_VALKEY_URL
    ;(globalThis as { __kiraValkey?: unknown }).__kiraValkey = undefined
  })

  it('takeToken: habis setelah perMinute permintaan, lalu memberi detik tunggu', async () => {
    const { takeToken } = await import('@/server/limiter')
    const key = `uji-${Math.random()}`
    for (let i = 0; i < 5; i++) expect(await takeToken(key, 5)).toBe(0)
    expect(await takeToken(key, 5)).toBeGreaterThan(0)
  })

  it('takeToken: kunci berbeda tidak saling mengganggu', async () => {
    const { takeToken } = await import('@/server/limiter')
    const a = `a-${Math.random()}`
    for (let i = 0; i < 2; i++) await takeToken(a, 2)
    expect(await takeToken(a, 2)).toBeGreaterThan(0)
    expect(await takeToken(`b-${Math.random()}`, 2)).toBe(0)
  })

  it('takeWindow: menolak bila jumlah melewati batas dan tidak menambah hitungan', async () => {
    const { takeWindow } = await import('@/server/limiter')
    const key = `w-${Math.random()}`
    expect(await takeWindow(key, 10, 60_000, 6)).toBe(true)
    expect(await takeWindow(key, 10, 60_000, 6)).toBe(false)
    expect(await takeWindow(key, 10, 60_000, 4)).toBe(true)
    expect(await takeWindow(key, 10, 60_000, 1)).toBe(false)
  })

  it('claimOnce: hanya pemanggil pertama yang menang dalam jendela', async () => {
    const { claimOnce } = await import('@/server/limiter')
    const key = `c-${Math.random()}`
    expect(await claimOnce(key, 60_000)).toBe(true)
    expect(await claimOnce(key, 60_000)).toBe(false)
  })
})
