import 'server-only'
import { content } from './dal/content'
import { log } from './log'

const g = globalThis as unknown as { __kiraReady?: boolean }

/** Muat konten repo sekali. Setelah selesai, /api/health boleh lulus. */
export function warmUp(): void {
  try {
    content()
    g.__kiraReady = true
  } catch (e) {
    log.error('pemanasan gagal', { error: e })
  }
}

export function isReady(): boolean {
  // Pengembangan dan uji tidak memanaskan: dianggap siap.
  return process.env.NODE_ENV !== 'production' || g.__kiraReady === true
}
