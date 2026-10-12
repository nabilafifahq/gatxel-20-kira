import 'server-only'
import { and, eq, isNull, lte, or, sql } from 'drizzle-orm'
import { tables } from '@kira/db'
import { PIN_PICTURES } from '@kira/figures/spec'
import { authDb } from '../db'
import { hashSecret, verifySecret } from './password'

/** PIN anak: 4 gambar dari 9 (boleh berulang). 5 kali salah mengunci learner itu 15 menit. */
export const PIN_LENGTH = 4
export const PIN_MAX_FAILS = 5
export const PIN_LOCK_MS = 15 * 60 * 1000

export function pinString(pin: readonly string[]): string {
  if (pin.length !== PIN_LENGTH || pin.some((p) => !(PIN_PICTURES as readonly string[]).includes(p))) throw new Error('PIN tidak valid')
  return `kira-pin:${pin.join('-')}`
}

export async function setPin(userId: string, pin: readonly string[]): Promise<void> {
  const pinHash = await hashSecret(pinString(pin))
  await authDb()
    .insert(tables.learnerSecret)
    .values({ userId, pinHash })
    .onConflictDoUpdate({ target: tables.learnerSecret.userId, set: { pinHash, failedPins: 0, lockedUntil: null, updatedAt: new Date() } })
}

export type PinCheck =
  | { ok: true }
  | { ok: false; reason: 'wrong'; attemptsLeft: number }
  | { ok: false; reason: 'locked'; lockedUntil: Date }

export async function checkPin(userId: string, pin: readonly string[]): Promise<PinCheck> {
  const t = tables.learnerSecret
  // Hitung percobaan lebih dulu dalam satu UPDATE atomik, sebelum Argon2. Permintaan paralel mendapat nomor
  // berbeda, percobaan ke-5 langsung memasang kunci, dan permintaan berikutnya ditolak tanpa memeriksa PIN.
  // Kunci yang sudah lewat memulai hitungan dari 1 lagi.
  const next = sql<number>`case when ${t.lockedUntil} is not null then 1 else ${t.failedPins} + 1 end`
  const reserved = await authDb()
    .update(t)
    .set({
      failedPins: next,
      lockedUntil: sql`case when (${next}) >= ${PIN_MAX_FAILS} then now() + make_interval(secs => ${PIN_LOCK_MS / 1000}) else null end`,
    })
    .where(and(eq(t.userId, userId), or(isNull(t.lockedUntil), lte(t.lockedUntil, sql`now()`))))
    .returning({ pinHash: t.pinHash, failedPins: t.failedPins, lockedUntil: t.lockedUntil })
  const row = reserved[0]
  if (!row) {
    const rows = await authDb().select({ lockedUntil: t.lockedUntil }).from(t).where(eq(t.userId, userId)).limit(1)
    const lockedUntil = rows[0]?.lockedUntil
    if (!rows[0] || !lockedUntil) return { ok: false, reason: 'wrong', attemptsLeft: 0 }
    return { ok: false, reason: 'locked', lockedUntil }
  }
  let candidate: string
  try {
    candidate = pinString(pin)
  } catch {
    candidate = 'invalid'
  }
  const ok = await verifySecret(row.pinHash, candidate)
  if (ok) {
    await authDb().update(t).set({ failedPins: 0, lockedUntil: null }).where(eq(t.userId, userId))
    return { ok: true }
  }
  if (row.lockedUntil) return { ok: false, reason: 'locked', lockedUntil: row.lockedUntil }
  return { ok: false, reason: 'wrong', attemptsLeft: Math.max(0, PIN_MAX_FAILS - row.failedPins) }
}

export async function pinState(userIds: string[]): Promise<Map<string, { lockedUntil: Date | null; failed: number }>> {
  const out = new Map<string, { lockedUntil: Date | null; failed: number }>()
  for (const id of userIds) {
    const rows = await authDb()
      .select({ lockedUntil: tables.learnerSecret.lockedUntil, failed: tables.learnerSecret.failedPins })
      .from(tables.learnerSecret)
      .where(eq(tables.learnerSecret.userId, id))
      .limit(1)
    const r = rows[0]
    out.set(id, { lockedUntil: r?.lockedUntil && r.lockedUntil.getTime() > Date.now() ? r.lockedUntil : null, failed: r?.failed ?? 0 })
  }
  return out
}

export async function unlockPin(userId: string): Promise<void> {
  await authDb().update(tables.learnerSecret).set({ failedPins: 0, lockedUntil: null }).where(eq(tables.learnerSecret.userId, userId))
}
