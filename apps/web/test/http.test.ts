import { describe, expect, it } from 'vitest'
import { readTextCapped, requestHosts, sameOrigin, seeOther } from '@/server/http'

// Server standalone (Docker) menyusun req.url dari HOSTNAME=0.0.0.0, bukan dari alamat browser.
const STANDALONE_URL = 'http://0.0.0.0:3000/keluar'
const TAILNET = 'https://kira-pc.tail1234.ts.net'

function post(headers: Record<string, string>): Request {
  return new Request(STANDALONE_URL, { method: 'POST', headers })
}

describe('sameOrigin', () => {
  it('menerima browser di localhost walau req.url berisi 0.0.0.0', () => {
    expect(
      sameOrigin(post({ host: 'localhost:3000', origin: 'http://localhost:3000' }), 'http://localhost:3000'),
    ).toBe(true)
  })

  it('menerima Tailscale serve lewat X-Forwarded-Host atau KIRA_ORIGIN', () => {
    expect(
      sameOrigin(
        post({ host: '127.0.0.1:3000', 'x-forwarded-host': 'kira-pc.tail1234.ts.net', origin: TAILNET }),
        undefined,
      ),
    ).toBe(true)
    expect(sameOrigin(post({ host: '127.0.0.1:3000', origin: TAILNET }), TAILNET)).toBe(true)
  })

  it('menolak situs lain, origin null, dan origin yang tidak bisa dibaca', () => {
    expect(sameOrigin(post({ host: 'localhost:3000', origin: 'https://contoh-jahat.test' }), TAILNET)).toBe(
      false,
    )
    expect(sameOrigin(post({ host: 'localhost:3000', origin: 'null' }), TAILNET)).toBe(false)
    expect(sameOrigin(post({ host: 'localhost:3000', origin: 'bukan url' }), TAILNET)).toBe(false)
  })

  it('port berbeda dianggap host berbeda', () => {
    expect(
      sameOrigin(post({ host: 'localhost:3000', origin: 'http://localhost:4000' }), 'http://localhost:3000'),
    ).toBe(false)
  })

  it('klien tanpa Origin lolos ke pemeriksaan sesi', () => {
    expect(sameOrigin(post({ host: 'localhost:3000' }), TAILNET)).toBe(true)
  })
})

describe('requestHosts', () => {
  it('memakai nilai pertama X-Forwarded-Host dan huruf kecil', () => {
    expect(
      requestHosts(
        post({ host: 'LOCALHOST:3000', 'x-forwarded-host': 'Kira-PC.tail1234.ts.net, proxy-lain' }),
        TAILNET,
      ),
    ).toEqual(['kira-pc.tail1234.ts.net', 'localhost:3000'])
  })
})

describe('seeOther', () => {
  it('membuat redirect 303 dengan Location relatif', () => {
    const res = seeOther('/masuk?notice=signed-out')
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('/masuk?notice=signed-out')
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('menolak tujuan di luar situs', () => {
    expect(() => seeOther('https://contoh-jahat.test/')).toThrow()
    expect(() => seeOther('//contoh-jahat.test/')).toThrow()
    expect(() => seeOther('/\\contoh-jahat.test')).toThrow()
  })
})

describe('readTextCapped', () => {
  const chunked = (parts: string[]) =>
    new Request('http://0.0.0.0:3000/api/mcp', {
      method: 'POST',
      body: new ReadableStream({
        start(c) {
          for (const p of parts) c.enqueue(new TextEncoder().encode(p))
          c.close()
        },
      }),
      // @ts-expect-error duplex wajib di Node untuk body stream
      duplex: 'half',
    })

  it('membaca body kecil utuh', async () => {
    expect(await readTextCapped(chunked(['{"a":', '1}']), 100)).toBe('{"a":1}')
  })

  it('berhenti saat body chunked melebihi batas', async () => {
    expect(await readTextCapped(chunked(['x'.repeat(60), 'y'.repeat(60)]), 100)).toBeNull()
  })

  it('menolak Content-Length yang terlalu besar sebelum membaca', async () => {
    const req = new Request('http://0.0.0.0:3000/api/mcp', { method: 'POST', body: 'kecil', headers: { 'content-length': '999999' } })
    expect(await readTextCapped(req, 100)).toBeNull()
  })
})
