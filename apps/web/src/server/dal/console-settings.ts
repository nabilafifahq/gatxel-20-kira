import 'server-only'
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import { tables } from '@kira/db'
import type { SettingsDTO } from '@/lib/dto'
import type { Actor } from '../auth/actor'
import { orgCtx } from '../auth/actor'
import { listDevices, listPendingInvites } from '../auth/admin'
import { listPasskeys } from '../auth/passkey'
import type { OrgContext, Tx } from '../db'
import { inOrg } from '../db'
import { env } from '../env'
import { invalid, notFound } from '../errors'
import { auditTx } from '../audit'
import { log } from '../log'
import { shellIn } from './console-shell'

/**
 * T10 Pengaturan: akun dan passkey, perangkat terdaftar, batas per learner, anggota dan undangan,
 * status email, cadangan, dan APK tablet. Data skema auth dibaca lewat helper auth/* yang selalu
 * menyaring org dari sesi.
 */

const { learnerProfile, memberProfile, guardianLink } = tables

export const LIMIT_MIN = 10
export const LIMIT_MAX = 240

/** "850 KB", "48 MB", "12,4 MB", "1,2 GB" (koma desimal). */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 KB'
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = bytes / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  const rounded = v >= 10 || i === 0 ? String(Math.round(v)) : v.toFixed(1).replace('.', ',').replace(/,0$/, '')
  return `${rounded} ${units[i]}`
}

/**
 * Isi status.json dari layanan cadangan: { lastAt, lastSize }. lastAt timestamp ISO; lastSize
 * jumlah byte atau teks pendek. Nilai lain diabaikan.
 */
export function parseBackupStatus(raw: unknown): { lastAt: string | null; lastSize: string | null } {
  if (!raw || typeof raw !== 'object') return { lastAt: null, lastSize: null }
  const r = raw as { lastAt?: unknown; lastSize?: unknown }
  const at = typeof r.lastAt === 'string' && !Number.isNaN(Date.parse(r.lastAt)) ? new Date(r.lastAt).toISOString() : null
  const size = typeof r.lastSize === 'number' && Number.isFinite(r.lastSize) && r.lastSize >= 0 ? formatBytes(r.lastSize) : typeof r.lastSize === 'string' && r.lastSize.trim() && r.lastSize.length <= 40 ? r.lastSize.trim() : null
  return { lastAt: at, lastSize: at ? size : null }
}

export function backupFolderLabel(e: { KIRA_BACKUP_LABEL?: string; KIRA_BACKUP_DIR?: string }): string {
  return e.KIRA_BACKUP_LABEL?.trim() || e.KIRA_BACKUP_DIR?.trim() || 'Cadangan belum diatur di server ini (isi KIRA_BACKUP_DIR di .env).'
}

async function backupStatus(): Promise<SettingsDTO['backups']> {
  const e = env()
  const folder = backupFolderLabel(e)
  if (!e.KIRA_BACKUP_DIR) return { lastAt: null, lastSize: null, folder }
  try {
    const text = await readFile(join(e.KIRA_BACKUP_DIR, 'status.json'), 'utf8')
    return { ...parseBackupStatus(JSON.parse(text.slice(0, 10_000))), folder }
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code !== 'ENOENT') log.warn('status cadangan tidak terbaca', { code: code ?? 'parse' })
    return { lastAt: null, lastSize: null, folder }
  }
}

/** Lokasi APK tablet di folder data server. */
export function apkPath(dataDir: string): string {
  return join(dataDir, 'apk', 'kira.apk')
}

export async function apkInfo(): Promise<NonNullable<SettingsDTO['apk']>> {
  try {
    const s = await stat(apkPath(env().KIRA_DATA_DIR))
    if (!s.isFile() || s.size === 0) return { available: false, size: null, updatedAt: null }
    return { available: true, size: formatBytes(s.size), updatedAt: s.mtime.toISOString() }
  } catch {
    return { available: false, size: null, updatedAt: null }
  }
}

export async function settingsDTO(actor: Actor, learnerParam: string | null): Promise<SettingsDTO> {
  const ctx = orgCtx(actor)
  const base = await inOrg(ctx, async (tx) => {
    const { shell } = await shellIn(tx, actor, learnerParam)
    const learners = await tx
      .select({ id: learnerProfile.userId, name: learnerProfile.name, screenLimitMin: learnerProfile.screenLimitMin, restWeekdays: learnerProfile.restWeekdays, reviewEnabled: learnerProfile.reviewEnabled, soundEnabled: learnerProfile.soundEnabled, musicEnabled: learnerProfile.musicEnabled })
      .from(learnerProfile)
      .where(isNull(learnerProfile.deletedAt))
      .orderBy(asc(learnerProfile.name))
    const members = await tx
      .select({ id: memberProfile.userId, name: memberProfile.name, email: memberProfile.email, role: memberProfile.role })
      .from(memberProfile)
      .where(isNull(memberProfile.removedAt))
      .orderBy(asc(memberProfile.name))
    const links = await tx.select({ guardianId: guardianLink.guardianId, learnerId: guardianLink.learnerId }).from(guardianLink)
    return { shell, learners, members, links }
  })
  const nameOf = new Map(base.learners.map((l) => [l.id, l.name]))
  const [passkeys, devices, invites, backups, apk] = await Promise.all([listPasskeys(actor.userId), listDevices(actor.orgId), listPendingInvites(actor.orgId), backupStatus(), apkInfo()])
  const e = env()
  return {
    shell: base.shell,
    account: {
      name: actor.name,
      email: actor.email ?? '',
      passkeys: passkeys
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((k) => ({ id: k.id, name: k.name, createdAt: k.createdAt.toISOString(), lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null })),
    },
    devices: devices.map((d) => ({
      id: d.id,
      name: d.name,
      learners: d.learnerIds.map((id) => nameOf.get(id)).filter((n): n is string => Boolean(n)),
      createdAt: d.createdAt.toISOString(),
      lastSeenAt: d.lastSeenAt ? d.lastSeenAt.toISOString() : null,
      expiresAt: d.expiresAt.toISOString(),
    })),
    learners: base.learners.map((l) => ({ id: l.id, name: l.name, screenLimitMin: l.screenLimitMin, restWeekdays: [...l.restWeekdays].sort((a, b) => a - b), reviewEnabled: l.reviewEnabled, soundEnabled: l.soundEnabled, musicEnabled: l.musicEnabled })),
    // Tutor dulu, lalu orang tua; masing-masing urut nama.
    members: [...base.members.filter((m) => m.role === 'tutor'), ...base.members.filter((m) => m.role !== 'tutor')].map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      role: m.role,
      learners: m.role === 'tutor' ? base.learners.map((l) => l.name) : base.links.filter((x) => x.guardianId === m.id).map((x) => nameOf.get(x.learnerId)).filter((n): n is string => Boolean(n)),
    })),
    invites: invites.map((i) => ({ id: i.id, email: i.email, role: i.role, expiresAt: i.expiresAt.toISOString() })),
    email: { configured: Boolean(e.SMTP_URL?.trim()), from: e.SMTP_FROM?.trim() || null },
    backups,
    apk,
  }
}

export async function updateLearnerLimitsTx(tx: Tx, ctx: OrgContext, input: { learnerId: string; screenLimitMin: number; restWeekdays: number[]; reviewEnabled: boolean }): Promise<void> {
  const rest = [...new Set(input.restWeekdays)].sort((a, b) => a - b)
  if (rest.length >= 7) throw invalid('Semua hari dipilih sebagai hari istirahat. Sisakan paling sedikit satu hari belajar.', { restWeekdays: 'Sisakan satu hari belajar.' })
  if (input.screenLimitMin < LIMIT_MIN || input.screenLimitMin > LIMIT_MAX)
    throw invalid(`Batas waktu layar harus ${LIMIT_MIN} sampai ${LIMIT_MAX} menit. Isian sekarang ${input.screenLimitMin}.`, { screenLimitMin: `${LIMIT_MIN} sampai ${LIMIT_MAX} menit.` })
  const rows = await tx
    .update(learnerProfile)
    .set({ screenLimitMin: input.screenLimitMin, restWeekdays: rest, reviewEnabled: input.reviewEnabled, updatedAt: new Date() })
    .where(and(eq(learnerProfile.userId, input.learnerId), isNull(learnerProfile.deletedAt)))
    .returning({ id: learnerProfile.userId })
  if (rows.length === 0) throw notFound('Learner tidak ditemukan. Muat ulang halaman Pengaturan.')
  await auditTx(tx, ctx, 'learner.limits', input.learnerId, { screenLimitMin: input.screenLimitMin, restWeekdays: rest, reviewEnabled: input.reviewEnabled })
}

/** Learner yang dipilih harus ada di org ini dan belum dihapus. */
export async function assertLearnersInOrg(tx: Tx, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return
  const found = await tx
    .select({ id: learnerProfile.userId })
    .from(learnerProfile)
    .where(and(inArray(learnerProfile.userId, [...ids]), isNull(learnerProfile.deletedAt)))
  if (found.length !== new Set(ids).size) throw invalid('Ada learner yang tidak ditemukan di keluarga ini. Muat ulang halaman lalu pilih lagi.', { learnerIds: 'Learner tidak ditemukan.' })
}
