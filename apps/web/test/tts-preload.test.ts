import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { preloadClips } from '../src/components/learner/tts-client'

/** Hasil pramuat menentukan tombol baca: klip yang memang tidak ada berbeda dari jaringan yang gagal. */
describe('preloadClips', () => {
  let clip: () => Promise<Response>

  beforeEach(() => {
    vi.stubGlobal('window', globalThis)
    vi.stubGlobal('navigator', { onLine: true })
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => (url === '/api/tts/today' ? Promise.resolve(Response.json({ enabled: true, urls: [], voiceVersion: 'piper-lessac-medium' })) : clip())),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('klip ada: ready', async () => {
    clip = () => Promise.resolve(new Response(new Blob(['x']), { status: 200 }))
    await expect(preloadClips('The first clip is here.', 'teacher')).resolves.toBe('ready')
  })

  it('server menjawab 404: missing, tombol boleh disembunyikan', async () => {
    clip = () => Promise.resolve(new Response('', { status: 404 }))
    await expect(preloadClips('This clip was never made.', 'teacher')).resolves.toBe('missing')
  })

  it('jaringan gagal: failed, bukan missing, jadi tombol tetap ada', async () => {
    clip = () => Promise.reject(new Error('offline'))
    await expect(preloadClips('The network dropped here.', 'teacher')).resolves.toBe('failed')
  })

  it('jaringan gagal mengalahkan klip yang hilang', async () => {
    let n = 0
    clip = () => (n++ === 0 ? Promise.resolve(new Response('', { status: 404 })) : Promise.reject(new Error('offline')))
    await expect(preloadClips(['Part one is absent.', 'Part two hit a dropout.'], 'teacher')).resolves.toBe('failed')
  })

  it('offline: belum diperiksa, tombol tetap ada untuk klip simpanan', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    clip = () => Promise.reject(new Error('tidak boleh dipanggil'))
    await expect(preloadClips('Saved for offline use.', 'teacher')).resolves.toBe('skipped')
  })
})
