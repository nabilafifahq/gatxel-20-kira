import 'server-only'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import type { ActionResult } from '@/lib/dto'
import { log } from './log'

/** Kode referensi pendek untuk ditampilkan ke pengguna dan dicari di log, misalnya KR-7F3A2C. */
export function newReference(): string {
  return `KR-${randomBytes(3).toString('hex').toUpperCase()}`
}

export class AppError extends Error {
  constructor(
    readonly code: 'unauthenticated' | 'forbidden' | 'not-found' | 'invalid' | 'conflict' | 'rate-limited' | 'locked' | 'unavailable',
    readonly userMessage: string,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(userMessage)
    this.name = 'AppError'
  }
}

export const unauthenticated = (msg = 'Sesi berakhir. Masuk lagi untuk melanjutkan.') => new AppError('unauthenticated', msg)
export const forbidden = (msg = 'Akun ini tidak punya akses ke data itu.') => new AppError('forbidden', msg)
export const notFound = (msg = 'Data tidak ditemukan. Mungkin sudah dihapus.') => new AppError('not-found', msg)
export const invalid = (msg: string, fieldErrors?: Record<string, string>) => new AppError('invalid', msg, fieldErrors)
export const conflict = (msg: string) => new AppError('conflict', msg)

export function zodFieldErrors(e: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const i of e.issues) {
    const key = i.path.join('.') || '_'
    if (!out[key]) out[key] = i.message
  }
  return out
}

/**
 * Ubah error apa pun menjadi ActionResult. Detail teknis hanya masuk log;
 * pengguna menerima pesan umum dan kode referensi (GTX: gagal tertutup).
 */
export function toFailure(e: unknown, context: string, lang: 'id' | 'en-GB' = 'id'): Extract<ActionResult, { ok: false }> {
  const reference = newReference()
  if (e instanceof AppError) {
    log.warn('action ditolak', { context, reference, code: e.code, message: e.message })
    return { ok: false, message: e.userMessage, reference, ...(e.fieldErrors ? { fieldErrors: e.fieldErrors } : {}) }
  }
  if (e instanceof z.ZodError) {
    log.warn('input tidak valid', { context, reference, issues: e.issues.slice(0, 5) })
    return {
      ok: false,
      message: lang === 'id' ? 'Isian belum lengkap atau formatnya salah. Periksa kolom yang ditandai.' : 'Something in the answer is not right. Please try again.',
      reference,
      fieldErrors: zodFieldErrors(e),
    }
  }
  if (isNextControlFlow(e)) throw e
  log.error('action gagal', { context, reference, error: e })
  return {
    ok: false,
    message: lang === 'id' ? 'Terjadi kesalahan di server. Coba lagi sebentar lagi; kalau masih gagal, sebutkan kode ini ke tutor.' : 'Something went wrong. Try again in a moment.',
    reference,
  }
}

/** redirect() dan notFound() dari Next melempar error khusus yang harus diteruskan. */
export function isNextControlFlow(e: unknown): boolean {
  const digest = (e as { digest?: unknown } | null)?.digest
  return typeof digest === 'string' && (digest.startsWith('NEXT_REDIRECT') || digest.startsWith('NEXT_HTTP_ERROR_FALLBACK') || digest === 'NEXT_NOT_FOUND')
}

export async function runAction<T>(context: string, fn: () => Promise<T>, lang: 'id' | 'en-GB' = 'id'): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (e) {
    return toFailure(e, context, lang)
  }
}
