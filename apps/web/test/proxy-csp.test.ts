import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { proxy } from '@/proxy'

const call = (path: string, cookie?: string) =>
  proxy(new NextRequest(`http://localhost:3131${path}`, cookie ? { headers: { cookie } } : undefined))
const csp = (path: string, cookie?: string) => call(path, cookie).headers.get('content-security-policy') ?? ''

describe('CSP dan Turnstile', () => {
  const saved = { k: process.env.KIRA_TURNSTILE_SITE_KEY, s: process.env.KIRA_TURNSTILE_SECRET }
  beforeEach(() => {
    process.env.KIRA_TURNSTILE_SITE_KEY = 'situs'
    process.env.KIRA_TURNSTILE_SECRET = 'rahasia'
  })
  afterEach(() => {
    process.env.KIRA_TURNSTILE_SITE_KEY = saved.k
    process.env.KIRA_TURNSTILE_SECRET = saved.s
    if (saved.k === undefined) delete process.env.KIRA_TURNSTILE_SITE_KEY
    if (saved.s === undefined) delete process.env.KIRA_TURNSTILE_SECRET
  })

  it('halaman auth publik boleh memuat Turnstile bila dikonfigurasi', () => {
    for (const p of ['/daftar', '/masuk', '/masuk/anak', '/reset/abc', '/beranda']) expect(csp(p), p).toContain('challenges.cloudflare.com')
    // Langkah PIN dan area anak sesudahnya tetap tanpa skrip pihak ketiga.
    expect(csp('/masuk/anak/8387fff0-944d-4558-85df-b5294f636414')).not.toContain('challenges.cloudflare.com')
  })
  it('halaman depan untuk pengunjung baru memuatnya, tetapi tablet terdaftar dan area learner tidak', () => {
    expect(csp('/')).toContain('challenges.cloudflare.com')
    expect(csp('/', '__Host-kira.device=abc')).not.toContain('challenges.cloudflare.com')
    for (const p of ['/today', '/pin/x', '/arena', '/keluarga', '/konsol']) expect(csp(p), p).not.toContain('challenges.cloudflare.com')
  })
  it('tanpa kunci Turnstile tidak ada halaman yang mengizinkannya', () => {
    delete process.env.KIRA_TURNSTILE_SECRET
    expect(csp('/daftar')).not.toContain('challenges.cloudflare.com')
  })
  it('pengunjung tanpa sesi di / diarahkan ke halaman depan lewat rewrite, bukan redirect', () => {
    const r = call('/')
    expect(r.headers.get('x-middleware-rewrite')).toContain('/beranda')
    expect(call('/', '__Host-kira.session=abc').headers.get('x-middleware-rewrite')).toBeNull()
  })
})
