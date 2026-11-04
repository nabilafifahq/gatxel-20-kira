/**
 * Penyaji berkas klip: Range, ETag, dan aliran dari disk (tanpa membaca seluruh berkas ke memori).
 * Murni terhadap `fs`, tanpa Next, supaya bisa diuji. Dipakai route /tts/[file].
 */
import { createReadStream } from 'node:fs'
import { Readable } from 'node:stream'

export type ByteRange = { start: number; end: number }

/**
 * Baca header Range satu rentang (`bytes=a-b`, `bytes=a-`, `bytes=-n`). Mengembalikan:
 *   null        tidak ada Range, kirim seluruh berkas
 *   'invalid'   tidak bisa dipenuhi, jawab 416
 *   ByteRange   rentang yang sudah dipotong ke ukuran berkas
 * Beberapa rentang sekaligus tidak didukung dan diperlakukan sebagai tanpa Range (boleh menurut RFC 9110).
 */
export function parseRange(header: string | null, size: number): ByteRange | 'invalid' | null {
  if (!header) return null
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!m) return null
  const [, a, b] = m
  if (a === '' && b === '') return 'invalid'
  if (size <= 0) return 'invalid'
  if (a === '') {
    const n = Number(b)
    if (!Number.isFinite(n) || n <= 0) return 'invalid'
    return { start: Math.max(0, size - n), end: size - 1 }
  }
  const start = Number(a)
  const end = b === '' ? size - 1 : Math.min(Number(b), size - 1)
  if (!Number.isFinite(start) || start >= size || end < start) return 'invalid'
  return { start, end }
}

/** ETag lemah dari ukuran dan waktu ubah. Nama berkas sudah berupa hash isi-dan-suara, jadi ini hanya untuk revalidasi. */
export function etagOf(size: number, mtimeMs: number): string {
  return `W/"${size.toString(16)}-${Math.floor(mtimeMs).toString(16)}"`
}

export type ClipFile = { path: string; size: number; mtimeMs: number }

export type ServeOptions = {
  /** Nilai header Cache-Control. */
  cacheControl: string
  range: string | null
  ifNoneMatch: string | null
}

/** Bangun Response untuk berkas klip: 200, 206, 304, atau 416. Isi dialirkan dari disk. */
export function serveClip(file: ClipFile, opts: ServeOptions): Response {
  const etag = etagOf(file.size, file.mtimeMs)
  const base: Record<string, string> = {
    'Content-Type': 'audio/mpeg',
    'Accept-Ranges': 'bytes',
    'Cache-Control': opts.cacheControl,
    ETag: etag,
    'X-Content-Type-Options': 'nosniff',
  }
  if (opts.ifNoneMatch && opts.ifNoneMatch.split(',').some((t) => t.trim() === etag)) return new Response(null, { status: 304, headers: base })
  const range = parseRange(opts.range, file.size)
  if (range === 'invalid') return new Response(null, { status: 416, headers: { ...base, 'Content-Range': `bytes */${file.size}` } })
  const part = range ?? { start: 0, end: file.size - 1 }
  const body = Readable.toWeb(createReadStream(file.path, { start: part.start, end: part.end })) as unknown as ReadableStream
  const headers: Record<string, string> = { ...base, 'Content-Length': String(part.end - part.start + 1) }
  if (range) headers['Content-Range'] = `bytes ${part.start}-${part.end}/${file.size}`
  return new Response(body, { status: range ? 206 : 200, headers })
}
