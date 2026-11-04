import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * POST /api/feedback tanpa database: peran, Turnstile, batas laju, kolom jebakan, lampiran, dan injeksi header.
 * Penulisan ke tabel diuji di support.db.test.ts.
 */
const dataDir = mkdtempSync(join(tmpdir(), 'kira-feedback-'))
process.env.KIRA_ORIGIN = 'https://kira.test'
process.env.DATABASE_URL_APP = 'postgres://x'
process.env.DATABASE_URL_AUTH = 'postgres://x'
process.env.KIRA_SECRET = 'uji-rahasia-minimal-32-karakter-xxxxxxxx'
process.env.KIRA_DATA_DIR = dataDir

const state = vi.hoisted(() => ({
  actor: null as null | { userId: string; orgId: string; role: string; email: string | null; name: string },
  headers: new Map<string, string>(),
  turnstileOn: false,
  turnstileOk: true,
  created: [] as Record<string, unknown>[],
}))

vi.mock('next/headers', () => ({ headers: async () => state.headers, cookies: async () => ({ get: () => undefined }) }))
vi.mock('@/server/auth/actor', () => ({ getActor: async () => state.actor }))
vi.mock('@/server/auth/turnstile', () => ({
  turnstileSiteKey: () => (state.turnstileOn ? 'kunci' : null),
  verifyTurnstile: async (token: string | undefined) => {
    if (!state.turnstileOn) return
    if (!state.turnstileOk || !token) {
      const { AppError } = await import('@/server/errors')
      throw new AppError('invalid', 'Pemeriksaan keamanan belum selesai.')
    }
  },
}))
vi.mock('@/server/dal/support', () => ({
  createSupportTicket: async (t: Record<string, unknown>) => {
    state.created.push(t)
    return { mailedTeam: true }
  },
}))
vi.mock('@/server/signup/email-policy', async (orig) => {
  const real = await orig<typeof import('@/server/signup/email-policy')>()
  return { ...real, checkEmail: (raw: string) => real.checkEmail(raw, { resolver: async () => [{ exchange: 'mx.example.com' }] }) }
})

const { POST } = await import('@/app/api/feedback/route')

let ipCounter = 0
const VALID = { category: 'bug', subject: 'Tombol tidak jalan', message: 'Tombol simpan tidak merespons sama sekali.' }

function request(fields: Record<string, string>, opts: { file?: File; origin?: string; contentLength?: string | null } = {}): Request {
  const body = new FormData()
  for (const [k, v] of Object.entries(fields)) body.set(k, v)
  if (opts.file) body.set('attachment', opts.file)
  const probe = new Request('https://kira.test/api/feedback', { method: 'POST', body })
  const headers = new Headers(probe.headers)
  headers.set('host', 'kira.test')
  headers.set('content-length', opts.contentLength === undefined ? '100000' : (opts.contentLength ?? ''))
  if (opts.contentLength === null) headers.delete('content-length')
  headers.set('user-agent', 'Agen\tuji')
  if (opts.origin) headers.set('origin', opts.origin)
  return new Request('https://kira.test/api/feedback', { method: 'POST', headers, body: probe.body, duplex: 'half' } as RequestInit)
}

const send = async (fields: Record<string, string>, opts: Parameters<typeof request>[1] = {}) => {
  const res = await POST(request(fields, opts))
  return { status: res.status, json: (await res.json()) as { ok: boolean; message?: string; fieldErrors?: Record<string, string>; data?: { reference: string } } }
}

const realPng = () => {
  const crcless = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    return Buffer.concat([len, Buffer.from(type, 'latin1'), data, Buffer.alloc(4)])
  }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), crcless('IHDR', Buffer.alloc(13)), crcless('IEND', Buffer.alloc(0))])
}

const storedFiles = (): string[] => {
  try {
    return readdirSync(join(dataDir, 'support'), { recursive: true, withFileTypes: true })
      .filter((d) => d.isFile())
      .map((d) => d.name)
  } catch {
    return []
  }
}

beforeEach(() => {
  state.actor = null
  state.turnstileOn = false
  state.turnstileOk = true
  state.created.length = 0
  // Setiap tes memakai IP sendiri supaya ember token tidak saling memengaruhi.
  state.headers = new Map([['cf-connecting-ip', `203.0.113.${++ipCounter}`]])
})

afterAll(() => rmSync(dataDir, { recursive: true, force: true }))

describe('POST /api/feedback', () => {
  it('pengirim publik tercatat tanpa akun', async () => {
    const r = await send({ ...VALID, email: 'ortu@gmail.com', screen: '390x844', pageFrom: '/reset/AbCdEfGhIjKlMnOpQrStUvWxYz012345?x=1' })
    expect(r.status).toBe(200)
    expect(r.json.ok).toBe(true)
    expect(r.json.data?.reference).toMatch(/^KR-/)
    const t = state.created[0]!
    expect(t).toMatchObject({ senderEmail: 'ortu@gmail.com', account: null, screen: '390x844', pageFrom: '/reset/[kode]', category: 'bug' })
  })

  it('akun yang masuk memakai email akun, bukan isian formulir', async () => {
    state.actor = { userId: 'u1', orgId: 'o1', role: 'guardian', email: 'ortu.akun@gmail.com', name: 'Ibu' }
    const r = await send({ ...VALID, email: 'orang.lain@gmail.com' })
    expect(r.status).toBe(200)
    expect(state.created[0]).toMatchObject({ senderEmail: 'ortu.akun@gmail.com', account: { id: 'u1', role: 'guardian' }, sendConfirmation: true })
  })

  it('akun anak ditolak di server', async () => {
    state.actor = { userId: 'a1', orgId: 'o1', role: 'learner', email: null, name: 'Alya' }
    const r = await send({ ...VALID }, { file: new File([realPng()], 'a.png') })
    expect(r.status).toBe(403)
    expect(r.json.message).toContain('orang tua')
    expect(state.created).toHaveLength(0)
  })

  it('permintaan dari situs lain ditolak', async () => {
    const r = await send({ ...VALID, email: 'ortu@gmail.com' }, { origin: 'https://evil.test' })
    expect(r.status).toBe(403)
    expect(state.created).toHaveLength(0)
  })

  it('kolom jebakan terisi: tampak berhasil, tidak ada yang disimpan', async () => {
    const r = await send({ ...VALID, email: 'ortu@gmail.com', website: 'https://spam.test' }, { file: new File([realPng()], 'a.png') })
    expect(r.status).toBe(200)
    expect(r.json.data?.reference).toMatch(/^KR-/)
    expect(state.created).toHaveLength(0)
  })

  it('kolom yang tidak dikenal ditolak (Zod strict)', async () => {
    const r = await send({ ...VALID, email: 'ortu@gmail.com', role: 'tutor' })
    expect(r.status).toBe(422)
    expect(state.created).toHaveLength(0)
  })

  describe('injeksi header', () => {
    it('CR dan LF di subjek dibuang sebelum disimpan', async () => {
      await send({ ...VALID, subject: 'Halo\r\nBcc: korban@example.com', email: 'ortu@gmail.com' })
      const t = state.created[0]!
      expect(t.subject).toBe('Halo Bcc: korban@example.com')
      expect(t.userAgent).toBe('Agen uji')
    })

    it('email dengan baris baru atau penerima tambahan ditolak', async () => {
      for (const email of ['ortu@gmail.com\r\nBcc: korban@example.com', 'ortu@gmail.com, korban@example.com', 'Nama <ortu@gmail.com>']) {
        const r = await send({ ...VALID, email })
        expect(r.status).toBe(422)
        expect(r.json.fieldErrors?.email).toBeTruthy()
      }
      expect(state.created).toHaveLength(0)
    })
  })

  describe('batas isian', () => {
    it('subjek, pesan, dan email wajib', async () => {
      expect((await send({ ...VALID, subject: 'a', email: 'ortu@gmail.com' })).json.fieldErrors?.subject).toBeTruthy()
      expect((await send({ ...VALID, message: 'pendek', email: 'ortu@gmail.com' })).json.fieldErrors?.message).toBeTruthy()
      expect((await send({ ...VALID })).json.fieldErrors?.email).toBeTruthy()
      expect((await send({ ...VALID, category: 'palsu', email: 'ortu@gmail.com' })).json.fieldErrors?.category).toBeTruthy()
    })

    it('subjek dan pesan terlalu panjang ditolak', async () => {
      expect((await send({ ...VALID, subject: 'a'.repeat(121), email: 'ortu@gmail.com' })).json.fieldErrors?.subject).toBeTruthy()
      expect((await send({ ...VALID, message: 'a'.repeat(4001), email: 'ortu@gmail.com' })).json.fieldErrors?.message).toBeTruthy()
    })

    it('alamat sekali pakai ditolak dengan sapaan Anda', async () => {
      const r = await send({ ...VALID, email: 'x@mailinator.com' })
      expect(r.json.fieldErrors?.email).toContain('Anda')
    })
  })

  describe('lampiran', () => {
    it('PNG asli disimpan dengan nama aman, dan EXIF dibuang', async () => {
      const before = storedFiles().length
      const r = await send({ ...VALID, email: 'ortu@gmail.com' }, { file: new File([realPng()], '../../foto saya.png', { type: 'text/html' }) })
      expect(r.status).toBe(200)
      const att = state.created[0]!.attachment as { path: string; name: string; mime: string; bytes: number }
      expect(att.mime).toBe('image/png')
      expect(att.name).toBe('foto saya.png')
      expect(att.path).toMatch(/^\d{4}-\d{2}\/[0-9a-f-]+\.png$/)
      expect(storedFiles().length).toBe(before + 1)
    })

    it('PNG palsu ditolak: isi teks walau nama dan tipenya PNG', async () => {
      const before = storedFiles().length
      const r = await send({ ...VALID, email: 'ortu@gmail.com' }, { file: new File(['bukan gambar sama sekali, hanya teks'], 'foto.png', { type: 'image/png' }) })
      expect(r.status).toBe(415)
      expect(r.json.fieldErrors?.attachment).toContain('PNG, JPG, PDF, atau MP4')
      expect(state.created).toHaveLength(0)
      expect(storedFiles().length).toBe(before)
    })

    it('tanda tangan PNG dengan isi rusak juga ditolak', async () => {
      const fake = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('isi palsu setelah tanda tangan png yang panjang')])
      const r = await send({ ...VALID, email: 'ortu@gmail.com' }, { file: new File([fake], 'foto.png', { type: 'image/png' }) })
      expect(r.status).toBe(415)
    })

    it('berkas di atas 5 MB ditolak', async () => {
      const r = await send({ ...VALID, email: 'ortu@gmail.com' }, { file: new File([Buffer.alloc(5 * 1024 * 1024 + 1)], 'besar.png') })
      expect(r.status).toBe(413)
      expect(r.json.fieldErrors?.attachment).toContain('5 MB')
    })

    it('Content-Length besar ditolak sebelum body dibaca, dan yang hilang juga ditolak', async () => {
      expect((await send({ ...VALID, email: 'ortu@gmail.com' }, { contentLength: String(7 * 1024 * 1024) })).status).toBe(413)
      expect((await send({ ...VALID, email: 'ortu@gmail.com' }, { contentLength: null })).status).toBe(411)
    })

    it('lampiran berupa teks biasa ditolak', async () => {
      const r = await send({ ...VALID, email: 'ortu@gmail.com', attachment: 'teks' })
      expect(r.status).toBe(415)
    })
  })

  describe('Turnstile dan balasan otomatis', () => {
    it('Turnstile mati: pengirim publik tidak menerima balasan otomatis', async () => {
      await send({ ...VALID, email: 'ortu@gmail.com' })
      expect(state.created[0]).toMatchObject({ sendConfirmation: false })
    })

    it('Turnstile aktif: tanpa token ditolak, dengan token dapat balasan', async () => {
      state.turnstileOn = true
      expect((await send({ ...VALID, email: 'ortu@gmail.com' })).status).toBe(422)
      expect(state.created).toHaveLength(0)
      expect((await send({ ...VALID, email: 'ortu@gmail.com', turnstile: 'token' })).status).toBe(200)
      expect(state.created[0]).toMatchObject({ sendConfirmation: true })
    })

    it('akun yang masuk tidak perlu Turnstile', async () => {
      state.turnstileOn = true
      state.turnstileOk = false
      state.actor = { userId: 'u2', orgId: 'o1', role: 'tutor', email: 'tutor@gmail.com', name: 'Bu Sari' }
      expect((await send({ ...VALID })).status).toBe(200)
    })

    it('balasan otomatis ke satu alamat dibatasi 5 per jam', async () => {
      const email = 'korban.spam@gmail.com'
      state.turnstileOn = true
      for (let i = 0; i < 7; i++) {
        state.headers = new Map([['cf-connecting-ip', `198.51.100.${i + 1}`]])
        await send({ ...VALID, email, turnstile: 'token' })
      }
      expect(state.created.filter((t) => t.sendConfirmation)).toHaveLength(5)
      expect(state.created).toHaveLength(7)
    })
  })

  describe('batas laju', () => {
    it('per IP: permintaan kesembilan dalam semenit ditolak', async () => {
      const results: number[] = []
      for (let i = 0; i < 9; i++) results.push((await send({ ...VALID, email: 'ortu@gmail.com' })).status)
      expect(results.slice(0, 8).every((s) => s === 200)).toBe(true)
      expect(results[8]).toBe(429)
    })

    it('per akun: permintaan kelima dalam semenit ditolak, walau IP berganti', async () => {
      state.actor = { userId: 'u-laju', orgId: 'o1', role: 'guardian', email: 'ortu.laju@gmail.com', name: 'Ibu' }
      const results: number[] = []
      for (let i = 0; i < 5; i++) {
        state.headers = new Map([['cf-connecting-ip', `192.0.2.${i + 1}`]])
        results.push((await send({ ...VALID })).status)
      }
      expect(results).toEqual([200, 200, 200, 200, 429])
    })
  })
})
