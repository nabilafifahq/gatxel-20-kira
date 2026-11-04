import 'server-only'
import { connect as netConnect, type Socket } from 'node:net'
import { log } from './log'

/**
 * Klien Valkey/Redis kecil (RESP2) tanpa dependensi. Dipakai untuk pembatas laju bersama dan cache sesi
 * lintas replika. Kalau KIRA_VALKEY_URL kosong atau server tidak bisa dihubungi, semua fungsi mengembalikan
 * null (pemanggil memakai cadangan di memori atau database). Setelah gagal, klien menunggu beberapa detik
 * sebelum mencoba lagi, jadi permintaan tidak menunggu koneksi yang mati.
 */

type Reply = string | number | null | Reply[] | Error

type Pending = { resolve: (r: Reply) => void; timer: NodeJS.Timeout }

const CMD_TIMEOUT_MS = 250
const RETRY_AFTER_MS = 5000

class Valkey {
  private sock: Socket | null = null
  private ready = false
  private connecting: Promise<boolean> | null = null
  private downUntil = 0
  private buf: Buffer = Buffer.alloc(0)
  private queue: Pending[] = []
  private readonly host: string
  private readonly port: number
  private readonly password: string | null

  constructor(url: string) {
    const u = new URL(url)
    this.host = u.hostname
    this.port = Number(u.port || 6379)
    this.password = u.password ? decodeURIComponent(u.password) : null
  }

  private fail(why: string): void {
    const wasUp = this.ready
    this.ready = false
    this.downUntil = Date.now() + RETRY_AFTER_MS
    const s = this.sock
    this.sock = null
    this.buf = Buffer.alloc(0)
    s?.destroy()
    for (const p of this.queue.splice(0)) {
      clearTimeout(p.timer)
      p.resolve(new Error(why))
    }
    if (wasUp) log.warn('Valkey terputus, memakai cadangan di memori', { why })
  }

  private open(): Promise<boolean> {
    if (this.ready) return Promise.resolve(true)
    if (Date.now() < this.downUntil) return Promise.resolve(false)
    if (this.connecting) return this.connecting
    this.connecting = new Promise<boolean>((resolve) => {
      const s = netConnect({ host: this.host, port: this.port })
      s.setNoDelay(true)
      s.setKeepAlive(true, 10_000)
      this.sock = s
      const timer = setTimeout(() => (this.fail('connect timeout'), resolve(false)), 1500)
      s.on('data', (d) => this.onData(d))
      s.on('error', (e) => this.fail(e.message))
      s.on('close', () => this.fail('closed'))
      s.once('connect', () => {
        const done = (ok: boolean) => {
          clearTimeout(timer)
          resolve(ok)
        }
        this.ready = true
        if (!this.password) return done(true)
        this.send(['AUTH', this.password]).then((r) => {
          if (r instanceof Error) {
            this.fail('auth')
            done(false)
          } else done(true)
        })
      })
    }).finally(() => {
      this.connecting = null
    })
    return this.connecting
  }

  private onData(d: Buffer): void {
    this.buf = this.buf.length ? Buffer.concat([this.buf, d]) : d
    for (;;) {
      const parsed = parse(this.buf, 0)
      if (!parsed) return
      this.buf = this.buf.subarray(parsed.next)
      const p = this.queue.shift()
      if (p) {
        clearTimeout(p.timer)
        p.resolve(parsed.value)
      }
    }
  }

  private send(args: (string | number)[]): Promise<Reply> {
    return new Promise<Reply>((resolve) => {
      const s = this.sock
      if (!s || !this.ready) return resolve(new Error('down'))
      const timer = setTimeout(() => this.fail('command timeout'), CMD_TIMEOUT_MS)
      this.queue.push({ resolve, timer })
      const parts = [`*${args.length}\r\n`]
      for (const a of args) {
        const v = String(a)
        parts.push(`$${Buffer.byteLength(v)}\r\n${v}\r\n`)
      }
      s.write(parts.join(''))
    })
  }

  async cmd(args: (string | number)[]): Promise<Reply | undefined> {
    if (!(await this.open())) return undefined
    const r = await this.send(args)
    return r instanceof Error ? undefined : r
  }
}

function parse(b: Buffer, at: number): { value: Reply; next: number } | null {
  if (at >= b.length) return null
  const eol = b.indexOf('\r\n', at)
  if (eol < 0) return null
  const type = String.fromCharCode(b[at]!)
  const line = b.toString('utf8', at + 1, eol)
  const after = eol + 2
  switch (type) {
    case '+':
      return { value: line, next: after }
    case '-':
      return { value: new Error(line), next: after }
    case ':':
      return { value: Number(line), next: after }
    case '$': {
      const n = Number(line)
      if (n < 0) return { value: null, next: after }
      if (b.length < after + n + 2) return null
      return { value: b.toString('utf8', after, after + n), next: after + n + 2 }
    }
    case '*': {
      const n = Number(line)
      if (n < 0) return { value: null, next: after }
      const out: Reply[] = []
      let pos = after
      for (let i = 0; i < n; i++) {
        const el = parse(b, pos)
        if (!el) return null
        out.push(el.value)
        pos = el.next
      }
      return { value: out, next: pos }
    }
    default:
      return { value: new Error('protocol'), next: b.length }
  }
}

const g = globalThis as unknown as { __kiraValkey?: Valkey | null }

function client(): Valkey | null {
  if (g.__kiraValkey !== undefined) return g.__kiraValkey
  const url = process.env.KIRA_VALKEY_URL?.trim()
  try {
    g.__kiraValkey = url ? new Valkey(url) : null
  } catch {
    g.__kiraValkey = null
  }
  return g.__kiraValkey
}

/** Nilai string atau null (tidak ada, atau Valkey tidak tersedia). */
export async function kvGet(key: string): Promise<string | null> {
  const r = await client()?.cmd(['GET', key])
  return typeof r === 'string' ? r : null
}

export async function kvSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  await client()?.cmd(['SET', key, value, 'EX', ttlSeconds])
}

export async function kvDel(...keys: string[]): Promise<void> {
  if (keys.length === 0) return
  await client()?.cmd(['DEL', ...keys])
}

/** Jalankan skrip Lua. Undefined bila Valkey tidak tersedia. */
export async function kvEval(script: string, keys: string[], args: (string | number)[]): Promise<Reply | undefined> {
  return client()?.cmd(['EVAL', script, keys.length, ...keys, ...args])
}

export const kvConfigured = (): boolean => client() !== null

export type { Reply as KvReply }

/** SET NX EX. True bila kunci baru dibuat, false bila sudah ada, null bila Valkey tidak tersedia. */
export async function kvSetNx(key: string, ttlSeconds: number): Promise<boolean | null> {
  const r = await client()?.cmd(['SET', key, '1', 'EX', ttlSeconds, 'NX'])
  if (r === undefined) return null
  return r === 'OK'
}

/** INCR. Null bila Valkey tidak tersedia. */
export async function kvIncr(key: string): Promise<number | null> {
  const r = await client()?.cmd(['INCR', key])
  return typeof r === 'number' ? r : null
}

/** MGET. Array kosong bila Valkey tidak tersedia. */
export async function kvMGet(keys: string[]): Promise<(string | null)[]> {
  const r = await client()?.cmd(['MGET', ...keys])
  return Array.isArray(r) ? r.map((x) => (typeof x === 'string' ? x : null)) : []
}
