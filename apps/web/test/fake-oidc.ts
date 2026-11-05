import { createHash } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose'

/**
 * Server OIDC palsu untuk tes masuk Google: endpoint token yang memeriksa kode, rahasia klien, dan PKCE, plus JWKS sungguhan.
 * Klaim ID token diatur per tes lewat `claims`. `wrongKey` menandatangani dengan kunci di luar JWKS.
 */
export type FakeOidc = {
  url: string
  clientId: string
  clientSecret: string
  claims: Record<string, unknown>
  wrongKey: boolean
  /** Kode yang dikeluarkan endpoint authorize palsu beserta tantangan PKCE dan nonce-nya. */
  issue(challenge: string, nonce: string): string
  sign(claims: Record<string, unknown>, opts?: { wrongKey?: boolean; alg?: 'RS256' }): Promise<string>
  stop(): Promise<void>
}

export async function startFakeOidc(clientId = 'klien-uji.apps.googleusercontent.com', clientSecret = 'rahasia-klien-uji', port = 0): Promise<FakeOidc> {
  const good = await generateKeyPair('RS256')
  const bad = await generateKeyPair('RS256')
  const jwk: JWK = { ...(await exportJWK(good.publicKey)), kid: 'kunci-uji', alg: 'RS256', use: 'sig' }
  const codes = new Map<string, { challenge: string; nonce: string }>()
  let seq = 0

  const fake: FakeOidc = {
    url: '',
    clientId,
    clientSecret,
    claims: {},
    wrongKey: false,
    issue(challenge, nonce) {
      const code = `kode-${++seq}`
      codes.set(code, { challenge, nonce })
      return code
    },
    async sign(claims, opts = {}) {
      const now = Math.floor(Date.now() / 1000)
      const base = { iss: fake.url, aud: clientId, iat: now, exp: now + 300 }
      const key = opts.wrongKey ? bad.privateKey : good.privateKey
      return new SignJWT({ ...base, ...claims } as Record<string, unknown>).setProtectedHeader({ alg: opts.alg ?? 'RS256', kid: 'kunci-uji' }).sign(key)
    },
    async stop() {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    },
  }

  const server: Server = createServer((req, res) => {
    if (req.url?.startsWith('/authorize')) {
      // Persetujuan otomatis untuk uji di browser sungguhan.
      const q = new URL(req.url, fake.url).searchParams
      const back = new URL(q.get('redirect_uri')!)
      back.searchParams.set('state', q.get('state') ?? '')
      back.searchParams.set('code', fake.issue(q.get('code_challenge') ?? '', q.get('nonce') ?? ''))
      back.searchParams.set('scope', q.get('scope') ?? '')
      res.writeHead(302, { Location: back.toString() })
      res.end()
      return
    }
    if (req.url === '/jwks') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ keys: [jwk] }))
      return
    }
    if (req.url === '/token' && req.method === 'POST') {
      let raw = ''
      req.on('data', (c) => (raw += String(c)))
      req.on('end', () => {
        void (async () => {
          const form = new URLSearchParams(raw)
          const entry = codes.get(form.get('code') ?? '')
          const verifier = form.get('code_verifier') ?? ''
          const pkce = entry && createHash('sha256').update(verifier).digest('base64url') === entry.challenge
          if (!entry || !pkce || form.get('client_id') !== clientId || form.get('client_secret') !== clientSecret || form.get('grant_type') !== 'authorization_code') {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'invalid_grant' }))
            return
          }
          codes.delete(form.get('code') ?? '')
          const idToken = await fake.sign({ nonce: entry.nonce, ...fake.claims }, { wrongKey: fake.wrongKey })
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ access_token: 'token-akses-yang-tidak-boleh-dipakai', id_token: idToken, token_type: 'Bearer', expires_in: 3599 }))
        })()
      })
      return
    }
    res.writeHead(404)
    res.end()
  })
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve))
  fake.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  return fake
}
