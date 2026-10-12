import 'server-only'
import { eq } from 'drizzle-orm'
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
  const rows = await authDb().select().from(tables.learnerSecret).where(eq(tables.learnerSecret.userId, userId)).limit(1)
  const secret = rows[0]
  if (!secret) return { ok: false, reason: 'wrong', attemptsLeft: 0 }
  if (secret.lockedUntil && secret.lockedUntil.getTime() > Date.now()) return { ok: false, reason: 'locked', lockedUntil: secret.lockedUntil }
  let candidate: string
  try {
    candidate = pinString(pin)
  } catch {
    candidate = 'invalid'
  }
  const ok = await verifySecret(secret.pinHash, candidate)
  if (ok) {
    if (secret.failedPins > 0 || secret.lockedUntil) {
      await authDb().update(tables.learnerSecret).set({ failedPins: 0, lockedUntil: null }).where(eq(tables.learnerSecret.userId, userId))
    }
    return { ok: true }
  }
  const fails = secret.failedPins + 1
  if (fails >= PIN_MAX_FAILS) {
    const lockedUntil = new Date(Date.now() + PIN_LOCK_MS)
    await authDb().update(tables.learnerSecret).set({ failedPins: 0, lockedUntil }).where(eq(tables.learnerSecret.userId, userId))
    return { ok: false, reason: 'locked', lockedUntil }
  }
  await authDb().update(tables.learnerSecret).set({ failedPins: fails, lockedUntil: null }).where(eq(tables.learnerSecret.userId, userId))
  return { ok: false, reason: 'wrong', attemptsLeft: PIN_MAX_FAILS - fails }
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
