import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Suara pembawa acara Quiz Arena: memutar klip quizhost yang sudah ada, dan diam (bukan suara perangkat) bila
 * layanan mati, klip belum ada, atau efek suara dibisukan.
 */
const store = new Map<string, string>()
let audios: { src: string; play: ReturnType<typeof vi.fn> }[] = []
let calls: { url: string; method: string }[] = []
let clipStatus = 200
let enabled = true
let spoken = 0

function setup() {
  store.clear()
  audios = []
  calls = []
  spoken = 0
  vi.stubGlobal('window', { setTimeout: (f: () => void) => (f(), 0), dispatchEvent: () => true })
  vi.stubGlobal('navigator', { onLine: true })
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) })
  vi.stubGlobal('speechSynthesis', { speak: () => void spoken++, cancel: () => undefined })
  vi.stubGlobal(
    'Audio',
    class {
      src: string
      onended: (() => void) | null = null
      play = vi.fn(() => Promise.resolve())
      pause = vi.fn()
      constructor(src: string) {
        this.src = src
        audios.push(this)
      }
    },
  )
  URL.createObjectURL = () => 'blob:clip'
  URL.revokeObjectURL = () => undefined
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: { method?: string }) => {
      calls.push({ url: input, method: init?.method ?? 'GET' })
      if (input === '/api/tts/today') return new Response(JSON.stringify({ enabled, urls: [] }))
      if (input.startsWith('/tts/')) return clipStatus === 200 ? new Response(new Uint8Array([1, 2, 3])) : new Response('x', { status: clipStatus })
      return new Response('{}')
    }),
  )
}

const settle = () => new Promise((r) => setTimeout(r, 30))

describe('hostSay', () => {
  beforeEach(() => {
    vi.resetModules()
    clipStatus = 200
    enabled = true
    setup()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('memutar klip quizhost yang sudah ada', async () => {
    const { hostSay } = await import('@/components/learner/host-voice')
    hostSay('Three in a row!')
    await settle()
    expect(audios).toHaveLength(1)
    expect(audios[0]!.play).toHaveBeenCalled()
    expect(calls.some((c) => /^\/tts\/[0-9a-f]{64}\.mp3$/.test(c.url))).toBe(true)
  })

  it('klip belum ada: diam, tidak memakai suara perangkat, dan klip diminta dibuat', async () => {
    clipStatus = 404
    const { hostSay } = await import('@/components/learner/host-voice')
    hostSay('Here we go!')
    await settle()
    expect(audios).toHaveLength(0)
    expect(spoken).toBe(0)
    expect(calls.some((c) => c.url === '/api/tts/request' && c.method === 'POST')).toBe(true)
  })

  it('layanan suara mati: tidak ada permintaan klip dan tidak ada bunyi', async () => {
    enabled = false
    const { hostSay } = await import('@/components/learner/host-voice')
    hostSay('Next question.')
    await settle()
    expect(audios).toHaveLength(0)
    expect(calls.filter((c) => c.url.startsWith('/tts/'))).toHaveLength(0)
  })

  it('dibisukan atau teks bukan kalimat pembawa acara: tidak ada apa-apa', async () => {
    const { hostSay } = await import('@/components/learner/host-voice')
    hostSay('Some other sentence.')
    store.set('kira.sfx.muted', '1')
    vi.resetModules()
    const again = await import('@/components/learner/host-voice')
    again.hostSay('Next question.')
    await settle()
    expect(audios).toHaveLength(0)
    expect(calls).toHaveLength(0)
  })

  it('jaringan gagal: diam tanpa melempar', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    const { hostSay } = await import('@/components/learner/host-voice')
    expect(() => hostSay('Here we go!')).not.toThrow()
    await settle()
    expect(audios).toHaveLength(0)
  })
})
