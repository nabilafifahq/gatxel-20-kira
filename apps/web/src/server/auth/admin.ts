import 'server-only'
import { and, desc, eq, gt, isNull } from 'drizzle-orm'
import { tables } from '@kira/db'
import { authDb } from '../db'
import { randomToken, sha256hex } from './crypto'

/**
 * Query skema auth untuk konsol (perangkat, undangan, token MCP).
 * Role kira_auth tidak kena RLS, jadi SETIAP fungsi wajib menyaring dengan orgId dari sesi.
 */
const { device, invite, mcpToken } = tables

export type DeviceRow = { id: string; name: string; learnerIds: string[]; createdAt: Date; lastSeenAt: Date | null; expiresAt: Date }

export async function listDevices(orgId: string): Promise<DeviceRow[]> {
  return authDb()
    .select({ id: device.id, name: device.name, learnerIds: device.learnerIds, createdAt: device.createdAt, lastSeenAt: device.lastSeenAt, expiresAt: device.expiresAt })
    .from(device)
    .where(and(eq(device.orgId, orgId), isNull(device.revokedAt), gt(device.expiresAt, new Date())))
    .orderBy(desc(device.createdAt))
}

/** Jumlah perangkat aktif per learner. */
export async function deviceCountByLearner(orgId: string): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  for (const d of await listDevices(orgId)) for (const id of d.learnerIds) out.set(id, (out.get(id) ?? 0) + 1)
  return out
}

export async function revokeDevice(orgId: string, deviceId: string): Promise<boolean> {
  const rows = await authDb()
    .update(device)
    .set({ revokedAt: new Date() })
    .where(and(eq(device.id, deviceId), eq(device.orgId, orgId), isNull(device.revokedAt)))
    .returning({ id: device.id })
  return rows.length > 0
}

export async function renameDevice(orgId: string, deviceId: string, name: string): Promise<boolean> {
  const rows = await authDb()
    .update(device)
    .set({ name: name.trim() })
    .where(and(eq(device.id, deviceId), eq(device.orgId, orgId), isNull(device.revokedAt)))
    .returning({ id: device.id })
  return rows.length > 0
}

/** Lepas learner dari semua perangkat (misalnya saat learner dihapus). */
export async function detachLearnerFromDevices(orgId: string, learnerId: string): Promise<void> {
  for (const d of await listDevices(orgId)) {
    if (!d.learnerIds.includes(learnerId)) continue
    await authDb()
      .update(device)
      .set({ learnerIds: d.learnerIds.filter((x) => x !== learnerId) })
      .where(and(eq(device.id, d.id), eq(device.orgId, orgId)))
  }
}

export type InviteRow = { id: string; email: string; role: 'tutor' | 'guardian'; learnerIds: string[]; expiresAt: Date; createdAt: Date }

export async function listPendingInvites(orgId: string): Promise<InviteRow[]> {
  return authDb()
    .select({ id: invite.id, email: invite.email, role: invite.role, learnerIds: invite.learnerIds, expiresAt: invite.expiresAt, createdAt: invite.createdAt })
    .from(invite)
    .where(and(eq(invite.orgId, orgId), isNull(invite.acceptedAt), isNull(invite.revokedAt), gt(invite.expiresAt, new Date())))
    .orderBy(desc(invite.createdAt))
}

export async function revokeInvite(orgId: string, inviteId: string): Promise<boolean> {
  const rows = await authDb()
    .update(invite)
    .set({ revokedAt: new Date() })
    .where(and(eq(invite.id, inviteId), eq(invite.orgId, orgId), isNull(invite.acceptedAt), isNull(invite.revokedAt)))
    .returning({ id: invite.id })
  return rows.length > 0
}

export type McpTokenRow = { id: string; name: string; createdAt: Date; lastUsedAt: Date | null }

export async function listMcpTokens(orgId: string): Promise<McpTokenRow[]> {
  return authDb()
    .select({ id: mcpToken.id, name: mcpToken.name, createdAt: mcpToken.createdAt, lastUsedAt: mcpToken.lastUsedAt })
    .from(mcpToken)
    .where(and(eq(mcpToken.orgId, orgId), isNull(mcpToken.revokedAt)))
    .orderBy(desc(mcpToken.createdAt))
}

/** Token hanya ditampilkan sekali saat dibuat; yang disimpan hanya hash SHA-256. */
export async function createMcpToken(orgId: string, userId: string, name: string): Promise<{ id: string; token: string }> {
  const token = `kira_mcp_${randomToken(32)}`
  const [row] = await authDb()
    .insert(mcpToken)
    .values({ orgId, userId, name: name.trim(), tokenHash: sha256hex(token) })
    .returning({ id: mcpToken.id })
  return { id: row!.id, token }
}

export async function revokeMcpToken(orgId: string, tokenId: string): Promise<boolean> {
  const rows = await authDb()
    .update(mcpToken)
    .set({ revokedAt: new Date() })
    .where(and(eq(mcpToken.id, tokenId), eq(mcpToken.orgId, orgId), isNull(mcpToken.revokedAt)))
    .returning({ id: mcpToken.id })
  return rows.length > 0
}

/** Cari pemilik token MCP. Akun pemilik harus masih tutor aktif (diperiksa pemanggil lewat member_profile). */
export async function findMcpToken(token: string): Promise<{ id: string; orgId: string; userId: string } | null> {
  if (!token.startsWith('kira_mcp_') || token.length > 120) return null
  const rows = await authDb()
    .select({ id: mcpToken.id, orgId: mcpToken.orgId, userId: mcpToken.userId, lastUsedAt: mcpToken.lastUsedAt })
    .from(mcpToken)
    .where(and(eq(mcpToken.tokenHash, sha256hex(token)), isNull(mcpToken.revokedAt)))
    .limit(1)
  const row = rows[0]
  if (!row) return null
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) {
    await authDb().update(mcpToken).set({ lastUsedAt: new Date() }).where(eq(mcpToken.id, row.id))
  }
  return { id: row.id, orgId: row.orgId, userId: row.userId }
}

/** Status akun pengguna di org (untuk token MCP dan daftar anggota). */
export async function accountActive(orgId: string, userId: string): Promise<{ role: 'tutor' | 'guardian' | 'learner'; name: string } | null> {
  const rows = await authDb()
    .select({ role: tables.userAccount.role, name: tables.userAccount.name, disabledAt: tables.userAccount.disabledAt })
    .from(tables.userAccount)
    .where(and(eq(tables.userAccount.id, userId), eq(tables.userAccount.orgId, orgId)))
    .limit(1)
  const r = rows[0]
  return r && !r.disabledAt ? { role: r.role, name: r.name } : null
}
