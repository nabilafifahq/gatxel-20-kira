import 'server-only'
import { z } from 'zod'
import type { ActionResult } from '@/lib/dto'
import { DEFAULT_UI_LANG, dictFor } from '@/lib/i18n'
import { getLang } from '@/lib/i18n/server'
import { AppError, toFailure } from '../errors'

/**
 * runAction untuk aksi anak di Ruang Baca, kartu, dan kamus: pesan umum mengikuti bahasa tampilan anak. Bahasanya
 * baru dibaca saat aksi gagal, jadi aksi yang berhasil tidak menambah query.
 */
export async function runLearnerAction<T>(context: string, fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (e) {
    const failure = toFailure(e, context, 'en-GB')
    if (e instanceof AppError) return failure
    const lang = await getLang().catch(() => DEFAULT_UI_LANG)
    const { badInput, generic } = dictFor(lang).reading.errors
    return { ...failure, message: e instanceof z.ZodError ? badInput : generic }
  }
}
