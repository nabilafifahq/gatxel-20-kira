import 'server-only'
import { cache } from 'react'
import { and, eq, gt, inArray, isNull } from 'drizzle-orm'
import { tables } from '@kira/db'
import { authDb } from '../db'
import { clearCookie, DEVICE_COOKIE, DEVICE_TTL_MS, readCookie, writeCookie } from './cookies'
import { randomToken, sha256hex } from './crypto'
import { DEFAULT_UI_LANG, type UiLang } from '@/lib/i18n/lang'

const { device, userAccount } = tables

export type DeviceInfo = { id: string; orgId: string; name: string; learnerIds: string[] }

/** Perangkat terdaftar untuk browser ini (cookie __Host-kira.device), atau null. */
export const getDevice = cache(async (): Promise<DeviceInfo | null> => {
  const token = await readCookie(DEVICE_COOKIE)
  if (!token || token.length < 30 || token.length > 100) return null
  const rows = await authDb()
    .select({ id: device.id, orgId: device.orgId, name: device.name, learnerIds: device.learnerIds, lastSeenAt: device.lastSeenAt })
    .from(device)
    .where(and(eq(device.tokenHash, sha256hex(token)), isNull(device.revokedAt), gt(device.expiresAt, new Date())))
    .limit(1)
  const row = rows[0]
  if (!row) return null
  return { id: row.id, orgId: row.orgId, name: row.name, learnerIds: row.learnerIds }
})

/**
 * Bahasa untuk layar tanpa sesi (pilih anak, PIN) di tablet ini: Inggris hanya bila semua anak di tablet memakai
 * Inggris, jadi tablet keluarga lama tetap seperti sebelumnya.
 */
export async function deviceUiLang(learnerIds: string[]): Promise<UiLang> {
  if (learnerIds.length === 0) return DEFAULT_UI_LANG
  const rows = await authDb().select({ uiLang: userAccount.uiLang }).from(userAccount).where(inArray(userAccount.id, learnerIds))
  return rows.length > 0 && rows.every((r) => r.uiLang === 'en') ? 'en' : DEFAULT_UI_LANG
}

export async function registerDevice(input: { orgId: string; name: string; learnerIds: string[]; registeredBy: string }): Promise<DeviceInfo> {
  const token = randomToken(32)
  const [row] = await authDb()
    .insert(device)
    .values({
      orgId: input.orgId,
      name: input.name,
      tokenHash: sha256hex(token),
      learnerIds: input.learnerIds,
      registeredBy: input.registeredBy,
      expiresAt: new Date(Date.now() + DEVICE_TTL_MS),
    })
    .returning({ id: device.id })
  await writeCookie(DEVICE_COOKIE, token, DEVICE_TTL_MS)
  return { id: row!.id, orgId: input.orgId, name: input.name, learnerIds: input.learnerIds }
}

/** Perpanjang masa berlaku perangkat setiap kali dipakai (90 hari sejak pemakaian terakhir). */
export async function touchDevice(deviceId: string): Promise<void> {
  await authDb()
    .update(device)
    .set({ lastSeenAt: new Date(), expiresAt: new Date(Date.now() + DEVICE_TTL_MS) })
    .where(eq(device.id, deviceId))
}

export async function forgetDeviceCookie(): Promise<void> {
  await clearCookie(DEVICE_COOKIE)
}
