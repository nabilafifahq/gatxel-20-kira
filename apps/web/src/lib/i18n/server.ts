import 'server-only'
import { cache } from 'react'
import { deviceUiLang, getDevice } from '@/server/auth/device'
import { getSession } from '@/server/auth/session'
import { dictFor, DEFAULT_UI_LANG, type Dict, type UiLang } from './index'

/**
 * Bahasa tampilan untuk request ini. Saat sudah masuk, nilainya ikut terbaca bersama sesi, jadi tanpa query
 * tambahan. Layar tanpa sesi (pilih anak, PIN) memakai bahasa anak-anak di tablet itu.
 */
export const getLang = cache(async (): Promise<UiLang> => {
  const session = await getSession()
  if (session) return session.uiLang ?? DEFAULT_UI_LANG
  const device = await getDevice()
  return device ? deviceUiLang(device.learnerIds) : DEFAULT_UI_LANG
})

/** Kamus untuk Server Component, `generateMetadata`, Route Handler, dan pesan error di Server Action. */
export async function getT(): Promise<Dict> {
  return dictFor(await getLang())
}
