import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { etagOf, parseRange, serveClip } from '@/server/tts-serve'

describe('Range klip suara', () => {
  it('tanpa Range seluruh berkas, rentang dipotong ke ukuran berkas', () => {
    expect(parseRange(null, 1000)).toBeNull()
    expect(parseRange('bytes=0-99', 1000)).toEqual({ start: 0, end: 99 })
    expect(parseRange('bytes=900-', 1000)).toEqual({ start: 900, end: 999 })
    expect(parseRange('bytes=900-5000', 1000)).toEqual({ start: 900, end: 999 })
    expect(parseRange('bytes=-100', 1000)).toEqual({ start: 900, end: 999 })
    expect(parseRange('bytes=-5000', 1000)).toEqual({ start: 0, end: 999 })
  })
  it('rentang yang tak bisa dipenuhi ditolak, bentuk lain diabaikan', () => {
    expect(parseRange('bytes=1000-', 1000)).toBe('invalid')
    expect(parseRange('bytes=50-10', 1000)).toBe('invalid')
    expect(parseRange('bytes=-', 1000)).toBe('invalid')
    expect(parseRange('bytes=0-1,5-9', 1000)).toBeNull()
    expect(parseRange('items=0-5', 1000)).toBeNull()
  })
})

describe('serveClip', () => {
  let dir = ''
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
  })
  async function clip() {
    dir = await mkdtemp(join(tmpdir(), 'kira-serve-'))
    const path = join(dir, 'a.mp3')
    await writeFile(path, Buffer.from('0123456789'))
    const s = await stat(path)
    return { path, size: s.size, mtimeMs: s.mtimeMs }
  }
  const CC = 'public, max-age=31536000, immutable'

  it('200 dengan cache panjang dan Accept-Ranges', async () => {
    const res = serveClip(await clip(), { cacheControl: CC, range: null, ifNoneMatch: null })
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe(CC)
    expect(res.headers.get('accept-ranges')).toBe('bytes')
    expect(res.headers.get('content-length')).toBe('10')
    expect(res.headers.get('content-type')).toBe('audio/mpeg')
    expect(await res.text()).toBe('0123456789')
  })
  it('206 untuk Range, isi sesuai rentang', async () => {
    const res = serveClip(await clip(), { cacheControl: CC, range: 'bytes=2-5', ifNoneMatch: null })
    expect(res.status).toBe(206)
    expect(res.headers.get('content-range')).toBe('bytes 2-5/10')
    expect(res.headers.get('content-length')).toBe('4')
    expect(await res.text()).toBe('2345')
  })
  it('416 untuk rentang di luar berkas dan 304 untuk ETag yang sama', async () => {
    const f = await clip()
    const bad = serveClip(f, { cacheControl: CC, range: 'bytes=99-', ifNoneMatch: null })
    expect(bad.status).toBe(416)
    expect(bad.headers.get('content-range')).toBe('bytes */10')
    const same = serveClip(f, { cacheControl: CC, range: null, ifNoneMatch: etagOf(f.size, f.mtimeMs) })
    expect(same.status).toBe(304)
  })
})
