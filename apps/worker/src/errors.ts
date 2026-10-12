import { randomBytes } from 'node:crypto'
import { formatDateId, jakartaClock, jakartaDate } from '@kira/core/time'

/**
 * Kesalahan yang dipahami antrean job. Pesan di sini dibaca tutor di konsol, jadi ditulis dalam
 * bahasa Indonesia, singkat, tanpa jejak tumpukan dan tanpa rahasia.
 */

/** Kegagalan job dengan pesan untuk tutor. retryable=false berarti job langsung gagal tanpa dicoba lagi. */
export class JobError extends Error {
  override name = 'JobError'
  readonly retryable: boolean
  readonly result: unknown
  constructor(message: string, opts: { retryable?: boolean; result?: unknown; cause?: unknown } = {}) {
    super(message, opts.cause === undefined ? undefined : { cause: opts.cause })
    this.retryable = opts.retryable ?? true
    this.result = opts.result
  }
}

/** Batas pemakaian atau rate limit dari provider AI. Job diantrekan lagi sampai batasnya pulih, tanpa memakai jatah percobaan. */
export class UsageLimitError extends Error {
  override name = 'UsageLimitError'
  constructor(
    readonly resetAt: Date | null,
    readonly providerLabel: string,
  ) {
    super(`Batas pemakaian ${providerLabel} tercapai`)
  }
}

/** Job belum waktunya (misalnya permintaan hapus yang dijadwalkan besok). Diantrekan lagi tanpa memakai jatah percobaan. */
export class PostponeError extends Error {
  override name = 'PostponeError'
  constructor(
    readonly runAfter: Date,
    readonly note: string,
  ) {
    super(note)
  }
}

export function isAbortError(e: unknown): boolean {
  return e instanceof Error && (e.name === 'AbortError' || (e as { code?: string }).code === 'ABORT_ERR')
}

export function abortError(): Error {
  const e = new Error('Dihentikan karena worker berhenti')
  e.name = 'AbortError'
  return e
}

/** Kode rujukan pendek untuk mencocokkan pesan di konsol dengan baris log. */
export function refCode(): string {
  return `W-${randomBytes(3).toString('hex').toUpperCase()}`
}

/** "pukul 16.05 WIB" untuk hari ini, "13 Oktober 2026 pukul 16.05 WIB" untuk hari lain. */
export function whenWib(at: Date, now: Date = new Date()): string {
  const clock = `pukul ${jakartaClock(at)} WIB`
  return jakartaDate(at) === jakartaDate(now) ? clock : `${formatDateId(jakartaDate(at))} ${clock}`
}

/** "5 menit" atau "45 detik". */
export function durationId(ms: number): string {
  const secs = Math.round(ms / 1000)
  return secs >= 60 ? `${Math.round(secs / 60)} menit` : `${secs} detik`
}
