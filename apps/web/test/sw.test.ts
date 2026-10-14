import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'

/**
 * Service worker: Cloudflare menjawab 502 sampai 504 dan 520 sampai 530 saat Kira di rumah tidak terjangkau.
 * Jawaban itu harus diperlakukan seperti internet putus. sw.js dijalankan di sandbox dengan `caches` dan `fetch` palsu.
 */
const SW = readFileSync(fileURLToPath(new URL('../public/sw.js', import.meta.url)), 'utf8')
const ORIGIN = 'https://kira.test'

type Handler = (event: unknown) => void

function boot(fetchImpl: (req: string | { url: string }) => Promise<Response>, cachedPages: Record<string, string> = {}) {
  const handlers: Record<string, Handler> = {}
  const stores = new Map<string, Map<string, Response>>()
  const store = (name: string) => {
    let s = stores.get(name)
    if (!s) stores.set(name, (s = new Map()))
    return s
  }
  store('kira-v1-static').set(`${ORIGIN}/offline.html`, new Response('OFFLINE PAGE', { status: 200 }))
  for (const [path, body] of Object.entries(cachedPages)) store('kira-v1-pages').set(`${ORIGIN}${path}`, new Response(body, { status: 200 }))
  const keyOf = (r: unknown) => (typeof r === 'string' ? new URL(r, ORIGIN).href : (r as { url: string }).url)
  const caches = {
    open: async (name: string) => {
      const s = store(name)
      return {
        match: async (r: unknown, opts?: { ignoreSearch?: boolean }) => {
          const k = keyOf(r)
          const hit = s.get(k) ?? (opts?.ignoreSearch ? [...s].find(([u]) => u.split('?')[0] === k.split('?')[0])?.[1] : undefined)
          return hit?.clone()
        },
        put: async (r: unknown, res: Response) => void s.set(keyOf(r), res),
        keys: async () => [...s.keys()].map((url) => ({ url })),
        delete: async (r: unknown) => s.delete(keyOf(r)),
        addAll: async () => undefined,
      }
    },
    match: async (r: unknown) => {
      for (const s of stores.values()) {
        const hit = s.get(keyOf(r))
        if (hit) return hit.clone()
      }
      return undefined
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
  }
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, h: Handler) => void (handlers[type] = h),
    skipWaiting: () => Promise.resolve(),
    clients: { claim: () => Promise.resolve() },
  }
  vm.runInNewContext(SW, { self, caches, fetch: fetchImpl, URL, Response, Promise, console, setTimeout })
  const go = async (path: string, mode = 'navigate'): Promise<Response | null> => {
    let result: Promise<Response> | null = null
    handlers.fetch?.({
      request: { method: 'GET', url: `${ORIGIN}${path}`, mode },
      respondWith: (p: Promise<Response>) => void (result = p),
      waitUntil: () => undefined,
    })
    return result ? await result : null
  }
  const message = async (data: unknown) => {
    const pending: Promise<unknown>[] = []
    handlers.message?.({ data, waitUntil: (p: Promise<unknown>) => void pending.push(p) })
    await Promise.all(pending)
  }
  return Object.assign(go, { message, stores })
}

const reply = (status: number, body = 'SERVER') => () => Promise.resolve(new Response(body, { status }))

describe('server tidak terjangkau', () => {
  it.each([502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527, 530])('status %i di halaman learner memakai halaman tersimpan', async (status) => {
    const go = boot(reply(status), { '/today': 'CACHED TODAY' })
    expect(await (await go('/today'))!.text()).toBe('CACHED TODAY')
  })

  it('status 5xx Cloudflare tanpa simpanan menampilkan halaman offline', async () => {
    const go = boot(reply(521))
    expect(await (await go('/today'))!.text()).toBe('OFFLINE PAGE')
  })

  it('halaman yang tidak disimpan (konsol) menampilkan halaman offline saat 52x dan 50x', async () => {
    for (const status of [502, 504, 520, 523, 530]) {
      const go = boot(reply(status))
      expect(await (await go('/konsol'))!.text()).toBe('OFFLINE PAGE')
    }
  })

  it('jaringan putus tetap memakai halaman offline', async () => {
    const go = boot(() => Promise.reject(new TypeError('Failed to fetch')))
    expect(await (await go('/konsol'))!.text()).toBe('OFFLINE PAGE')
    expect(await (await go('/today'))!.text()).toBe('OFFLINE PAGE')
  })

  it('status lain diteruskan apa adanya', async () => {
    for (const status of [200, 401, 404, 500, 501, 505, 519, 531]) {
      const go = boot(reply(status))
      const res = (await go('/konsol'))!
      expect(res.status).toBe(status)
      expect(await res.text()).toBe('SERVER')
    }
  })
})

/** Response bertipe basic seperti jawaban fetch same-origin sungguhan (new Response() bertipe default). */
const basic = (body: string, status = 200) => {
  const r = new Response(body, { status })
  Object.defineProperty(r, 'type', { value: 'basic' })
  return r
}

describe('gambar media organisasi (no-store di server)', () => {
  const ID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'
  const PAGE = `<html><img src="/api/media/${ID}"><img src="/api/media/${ID}"></html>`
  const onlineThenOffline = () => {
    let online = true
    const go = boot((req) => {
      const path = new URL(typeof req === 'string' ? req : req.url).pathname
      if (!online) return Promise.reject(new TypeError('Failed to fetch'))
      if (path === `/api/media/${ID}`) return Promise.resolve(basic('PNG-BYTES'))
      if (path === '/run/11111111-1111-4111-8111-111111111111') return Promise.resolve(basic(PAGE))
      return Promise.resolve(basic('x'))
    })
    return { go, goOffline: () => void (online = false) }
  }
  const RUN = '/run/11111111-1111-4111-8111-111111111111'

  it('gambar yang dirujuk halaman yang di-precache disimpan di simpanan media dan dipakai saat offline', async () => {
    const { go, goOffline } = onlineThenOffline()
    await go.message({ type: 'precache', urls: [RUN] })
    expect([...go.stores.get('kira-v1-media')!.keys()]).toEqual([`${ORIGIN}/api/media/${ID}`])
    goOffline()
    const res = await go(`/api/media/${ID}`, 'no-cors')
    expect(await res!.text()).toBe('PNG-BYTES')
  })

  it('jaringan dipakai lebih dulu dan gambar yang belum di-precache tidak disimpan', async () => {
    const { go, goOffline } = onlineThenOffline()
    const live = await go(`/api/media/${ID}`, 'no-cors')
    expect(await live!.text()).toBe('PNG-BYTES')
    expect(go.stores.get('kira-v1-media')?.size ?? 0).toBe(0)
    goOffline()
    expect((await go(`/api/media/${ID}`, 'no-cors'))!.status).toBe(503)
  })

  it('akses yang dicabut (404) menghapus simpanan, dan berganti learner menghapus semuanya', async () => {
    let status = 200
    const go = boot((req) => {
      const path = new URL(typeof req === 'string' ? req : req.url).pathname
      if (path.startsWith('/api/media/')) return Promise.resolve(basic('IMG', status))
      return Promise.resolve(basic(PAGE))
    })
    await go.message({ type: 'precache', urls: [RUN] })
    expect(go.stores.get('kira-v1-media')!.size).toBe(1)
    status = 404
    await go(`/api/media/${ID}`, 'no-cors')
    expect(go.stores.get('kira-v1-media')!.size).toBe(0)

    status = 200
    await go.message({ type: 'precache', urls: [RUN] })
    expect(go.stores.get('kira-v1-media')!.size).toBe(1)
    await go.message({ type: 'clear-pages' })
    expect(go.stores.has('kira-v1-media')).toBe(false)
    expect(go.stores.has('kira-v1-pages')).toBe(false)

    await go.message({ type: 'precache', urls: [RUN] })
    await go('/bye')
    expect(go.stores.has('kira-v1-media')).toBe(false)
  })

  it('Cloudflare 52x memakai simpanan media', async () => {
    let status = 200
    const go = boot((req) => (new URL(typeof req === 'string' ? req : req.url).pathname.startsWith('/api/media/') ? Promise.resolve(basic('IMG', status)) : Promise.resolve(basic(PAGE))))
    await go.message({ type: 'precache', urls: [RUN] })
    status = 523
    expect(await (await go(`/api/media/${ID}`, 'no-cors'))!.text()).toBe('IMG')
  })
})
