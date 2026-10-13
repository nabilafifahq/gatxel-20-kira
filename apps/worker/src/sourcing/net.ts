import { abortError } from '../errors'

/**
 * Unduhan untuk pengambilan sumber soal. Hanya HTTPS, hanya host yang tercantum di registri untuk sumber itu,
 * tanpa kredensial di alamat, tanpa mengikuti pengalihan, dengan batas ukuran dan waktu.
 */

export class FetchGuardError extends Error {
  override name = 'FetchGuardError'
}

export const USER_AGENT = 'KiraSourcing/1.0 (private family learning app; open datasets and free official downloads only)'

export type FetchOptions = {
  allowedHosts: readonly string[]
  maxBytes: number
  timeoutMs?: number
  signal?: AbortSignal
  fetchImpl?: typeof fetch
  accept?: string
}

/** Periksa alamat sebelum dihubungi. Melempar FetchGuardError dengan pesan Indonesia. */
export function assertAllowedUrl(raw: string, allowedHosts: readonly string[]): URL {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    throw new FetchGuardError(`Alamat tidak valid: ${raw.slice(0, 80)}`)
  }
  if (u.protocol !== 'https:') throw new FetchGuardError(`Hanya https yang diizinkan: ${u.hostname}`)
  if (u.username || u.password) throw new FetchGuardError(`Alamat tidak boleh memuat kredensial: ${u.hostname}`)
  if (!allowedHosts.includes(u.hostname)) throw new FetchGuardError(`Host ${u.hostname} tidak ada di daftar host sumber ini`)
  return u
}

export async function guardedFetch(rawUrl: string, opts: FetchOptions): Promise<Buffer> {
  const url = assertAllowedUrl(rawUrl, opts.allowedHosts)
  const doFetch = opts.fetchImpl ?? fetch
  const timeout = AbortSignal.timeout(opts.timeoutMs ?? 60_000)
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout
  let res: Response
  try {
    res = await doFetch(url, { redirect: 'error', signal, headers: { 'user-agent': USER_AGENT, ...(opts.accept ? { accept: opts.accept } : {}) } })
  } catch (e) {
    if (opts.signal?.aborted) throw abortError()
    throw new FetchGuardError(`Unduhan ${url.hostname} gagal: ${e instanceof Error ? e.message : 'tidak diketahui'}`)
  }
  if (!res.ok) throw new FetchGuardError(`Unduhan ${url.hostname} dijawab kode ${res.status}`)
  const declared = Number(res.headers.get('content-length') ?? 0)
  if (declared > opts.maxBytes) throw new FetchGuardError(`Berkas dari ${url.hostname} terlalu besar (${Math.round(declared / 1024 / 1024)} MB)`)
  const body = res.body
  if (!body) return Buffer.alloc(0)
  const chunks: Buffer[] = []
  let size = 0
  const reader = body.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > opts.maxBytes) {
      await reader.cancel().catch(() => undefined)
      throw new FetchGuardError(`Berkas dari ${url.hostname} melewati batas ${Math.round(opts.maxBytes / 1024 / 1024)} MB`)
    }
    chunks.push(Buffer.from(value))
  }
  return Buffer.concat(chunks)
}

export async function fetchText(rawUrl: string, opts: FetchOptions): Promise<string> {
  return (await guardedFetch(rawUrl, opts)).toString('utf8')
}
