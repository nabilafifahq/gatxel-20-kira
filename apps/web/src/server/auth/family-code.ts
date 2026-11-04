import 'server-only'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { tables } from '@kira/db'
import { firstNameChoices, isFamilyCode, type FamilyChildChoice } from '@/lib/family-code'
import { authDb, inOrg } from '../db'
import { systemCtx } from '../audit'
import { clearCookie, FAMILY_TICKET_COOKIE, readCookie, writeCookie } from './cookies'
import { hmac, safeEqual } from './crypto'
import { getDevice, registerDevice, type DeviceInfo } from './device'

const { device, learnerProfile, learnerSecret, userAccount } = tables

/**
 * Jalur anak masuk dengan kode keluarga. Kode hanya membuka daftar nama depan; akses ke anak tetap butuh PIN.
 * Setelah kode benar, browser memegang tiket 20 menit berisi kode itu, ditandatangani server. Tiket mengikat langkah
 * nama dan PIN ke pemeriksaan kode (dan Turnstile), dan langsung gugur saat kode diganti.
 */
export const FAMILY_TICKET_MS = 20 * 60 * 1000

export async function orgForFamilyCode(code: string): Promise<string | null> {
  if (!isFamilyCode(code)) return null
  const rows = await authDb().execute(sql`select kira_org_by_family_code(${code}) as org_id`)
  return (rows as unknown as { org_id: string | null }[])[0]?.org_id ?? null
}

/** Kode baru dari fungsi definer. orgId wajib dari sesi pemanggil. */
export async function rotateFamilyCodeFor(orgId: string): Promise<string | null> {
  const rows = await authDb().execute(sql`select kira_rotate_family_code(${orgId}::uuid) as code`)
  return (rows as unknown as { code: string | null }[])[0]?.code ?? null
}

function ticketFor(code: string, expiresAt: number): string {
  const body = `${code}.${expiresAt}`
  return `${body}.${hmac(body, 'family-code-ticket')}`
}

export async function writeFamilyTicket(code: string): Promise<void> {
  await writeCookie(FAMILY_TICKET_COOKIE, ticketFor(code, Date.now() + FAMILY_TICKET_MS), FAMILY_TICKET_MS)
}

export async function forgetFamilyTicket(): Promise<void> {
  await clearCookie(FAMILY_TICKET_COOKIE)
}

/** Org dari tiket browser ini, atau null bila tiket tidak ada, palsu, kedaluwarsa, atau kodenya sudah diganti. */
export async function readFamilyTicket(): Promise<{ orgId: string } | null> {
  const raw = await readCookie(FAMILY_TICKET_COOKIE)
  if (!raw || raw.length > 200) return null
  const [code, exp] = raw.split('.')
  if (!code || !exp || !/^\d+$/.test(exp)) return null
  const expiresAt = Number(exp)
  if (!safeEqual(raw, ticketFor(code, expiresAt)) || expiresAt <= Date.now()) return null
  const orgId = await orgForFamilyCode(code)
  return orgId ? { orgId } : null
}

/** Anak yang bisa masuk: aktif, tidak terhapus, akunnya tidak dinonaktifkan, dan sudah punya PIN. */
async function eligibleChildren(orgId: string): Promise<{ id: string; name: string }[]> {
  const rows = await inOrg(systemCtx(orgId), (tx) =>
    tx
      .select({ id: learnerProfile.userId, name: learnerProfile.name })
      .from(learnerProfile)
      .where(and(eq(learnerProfile.orgId, orgId), eq(learnerProfile.active, true), isNull(learnerProfile.deletedAt))),
  )
  if (rows.length === 0) return []
  const ready = await authDb()
    .select({ id: learnerSecret.userId })
    .from(learnerSecret)
    .innerJoin(userAccount, eq(userAccount.id, learnerSecret.userId))
    .where(and(inArray(learnerSecret.userId, rows.map((r) => r.id)), eq(userAccount.orgId, orgId), isNull(userAccount.disabledAt)))
  const ok = new Set(ready.map((r) => r.id))
  return rows.filter((r) => ok.has(r.id))
}

/** Daftar nama depan untuk layar pilih nama. Tidak ada data lain: tanpa kelas, nama lengkap, atau avatar. */
export async function familyChildChoices(orgId: string): Promise<FamilyChildChoice[]> {
  return firstNameChoices(await eligibleChildren(orgId))
}

/** Satu anak di keluarga ini, dengan label yang sama seperti di daftar nama. */
export async function familyChildChoice(orgId: string, learnerId: string): Promise<FamilyChildChoice | null> {
  return (await familyChildChoices(orgId)).find((c) => c.id === learnerId) ?? null
}

/**
 * Setelah PIN benar: browser ini menjadi perangkat terdaftar lewat mekanisme perangkat yang sama, jadi terlihat dan bisa
 * dicabut seperti perangkat lain. Perangkat keluarga yang sama hanya ditambah anak ini (saudara berbagi iPad).
 */
export async function deviceForFamilyChild(input: { orgId: string; learnerId: string; firstName: string }): Promise<{ device: DeviceInfo; created: boolean }> {
  const existing = await getDevice()
  if (existing && existing.orgId === input.orgId) {
    if (!existing.learnerIds.includes(input.learnerId)) {
      await authDb()
        .update(device)
        .set({ learnerIds: sql`array_append(${device.learnerIds}, ${input.learnerId}::uuid)` })
        .where(and(eq(device.id, existing.id), sql`not (${input.learnerId}::uuid = any(${device.learnerIds}))`))
    }
    return { device: existing, created: false }
  }
  const created = await registerDevice({
    orgId: input.orgId,
    name: `Perangkat ${input.firstName}`.slice(0, 60),
    learnerIds: [input.learnerId],
    registeredBy: input.learnerId,
  })
  return { device: created, created: true }
}
