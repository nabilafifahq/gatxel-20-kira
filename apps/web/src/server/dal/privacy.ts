import 'server-only'
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { addDays, formatDateId, jakartaDate, jakartaMidnight, type IsoDate } from '@kira/core/time'
import { tables } from '@kira/db'
import type { ConsentPurpose, ConsoleShell, PrivacyDTO } from '@/lib/dto'
import type { Actor } from '../auth/actor'
import { orgCtx } from '../auth/actor'
import { NOTICE_VERSION } from '../auth/accounts'
import type { OrgContext, Tx } from '../db'
import { inOrg } from '../db'
import { conflict, forbidden, invalid, newReference, notFound } from '../errors'
import { auditTx, systemCtx } from '../audit'
import { origin } from '../env'
import { privacyNoticeData } from '../legal'
import { CONSENT_PURPOSES, latestConsents, recordConsentTx, type ConsentPurposeId } from './consent'
import { shellIn } from './console-shell'
import { enqueueJobTx } from './jobs'
import { loadLearner } from './learner-core'
import { queueEmail, simpleEmail } from './outbox'

/**
 * G02 Privasi keluarga. Orang tua mengubah persetujuan, mengunduh data, dan meminta atau
 * membatalkan penghapusan akun anak yang tertaut. Tutor melihat halaman yang sama tanpa
 * bisa mengubahnya (kecuali mengunduh salinan data, yang juga bisa dari Laporan).
 * Judul dan isi tujuan persetujuan diambil dari Kebijakan Privasi (server/legal.ts).
 */

const { consentEvent, deletionRequest, guardianLink, memberProfile, media } = tables

/** Masa tunggu penghapusan, sama dengan Kebijakan Privasi ("dihapus 7 hari setelah permintaan hapus"). */
export const DELETION_DELAY_DAYS = 7

/** Urutan tujuan di Kebijakan Privasi sama dengan CONSENT_PURPOSES. */
const NOTICE_INDEX: Record<ConsentPurposeId, number> = { learning: 0, 'progress-email': 1, audio: 2, photo: 3, 'ai-drafts': 4 }

export function purposeText(id: ConsentPurposeId): { title: string; description: string } {
  const p = privacyNoticeData().purposes[NOTICE_INDEX[id]]
  return p ? { title: p.title, description: p.description } : { title: id, description: '' }
}

export type ConsentRow = { purpose: ConsentPurposeId; granted: boolean; method: 'in-app' | 'offline'; noticeVersion: string; evidence: string | null; recordedBy: string; at: Date }

function lowerFirst(s: string): string {
  return /^[A-Z]{2}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1)
}

/** "A", "A dan b", "A, b, dan c" (judul kedua dan seterusnya diawali huruf kecil). */
export function joinTitles(titles: readonly string[]): string {
  const t = titles.map((x, i) => (i === 0 ? x : lowerFirst(x)))
  if (t.length <= 1) return t[0] ?? ''
  if (t.length === 2) return `${t[0]} dan ${t[1]}`
  return `${t.slice(0, -1).join(', ')}, dan ${t[t.length - 1]}`
}

/**
 * Riwayat persetujuan, terbaru dulu. Perubahan yang dicatat bersamaan (selisih kurang dari
 * 2 detik, sama arah, cara, dan pencatat) digabung menjadi satu baris.
 */
export function consentHistory(rows: readonly ConsentRow[], names: ReadonlyMap<string, string>, learnerName: string): PrivacyDTO['history'] {
  const sorted = [...rows].sort((a, b) => b.at.getTime() - a.at.getTime())
  const groups: ConsentRow[][] = []
  for (const r of sorted) {
    const g = groups[groups.length - 1]
    const head = g?.[0]
    if (g && head && head.granted === r.granted && head.method === r.method && head.recordedBy === r.recordedBy && Math.abs(head.at.getTime() - r.at.getTime()) < 2000) g.push(r)
    else groups.push([r])
  }
  return groups.map((g) => {
    const head = g[0]!
    const order = (p: ConsentPurposeId) => CONSENT_PURPOSES.indexOf(p)
    const titles = [...new Set(g.map((r) => r.purpose))].sort((a, b) => order(a) - order(b)).map((p) => purposeText(p).title)
    const who = names.get(head.recordedBy)
    const how = head.method === 'offline' ? `dicatat dari persetujuan tertulis${who ? ` oleh ${who}` : ''}` : `di aplikasi${who ? ` oleh ${who}` : ''}`
    let text = `${joinTitles(titles)} ${head.granted ? 'disetujui' : 'ditarik'} ${how}, Kebijakan Privasi versi ${head.noticeVersion}.`
    if (head.method === 'offline' && head.evidence) text += ` Bukti: ${head.evidence}.`
    if (!head.granted && g.some((r) => r.purpose === 'learning')) text += ` Akun ${learnerName} dijeda.`
    return { date: head.at.toISOString(), text }
  })
}

/** Tanggal hapus: hari ini (WIB) ditambah masa tunggu. Job berjalan pukul 00.00 WIB tanggal itu. */
export function deletionSchedule(today: IsoDate): { scheduledFor: IsoDate; runAfter: Date } {
  const scheduledFor = addDays(today, DELETION_DELAY_DAYS)
  return { scheduledFor, runAfter: jakartaMidnight(scheduledFor) }
}

/** Nama yang diketik orang tua harus sama dengan nama learner (spasi tepi dan huruf besar diabaikan). */
export function confirmNameMatches(typed: string, name: string): boolean {
  const norm = (s: string) => s.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('id')
  return norm(typed).length > 0 && norm(typed) === norm(name)
}

async function consentRows(tx: Tx, learnerId: string): Promise<ConsentRow[]> {
  const rows = await tx
    .select({
      purpose: consentEvent.purpose,
      granted: consentEvent.granted,
      method: consentEvent.method,
      noticeVersion: consentEvent.noticeVersion,
      evidence: consentEvent.evidence,
      recordedBy: consentEvent.recordedBy,
      at: consentEvent.createdAt,
    })
    .from(consentEvent)
    .where(eq(consentEvent.learnerId, learnerId))
    .orderBy(desc(consentEvent.createdAt))
  return rows
}

async function openDeletion(tx: Tx, learnerId: string) {
  const [row] = await tx
    .select({ id: deletionRequest.id, reference: deletionRequest.reference, scheduledFor: deletionRequest.scheduledFor, createdAt: deletionRequest.createdAt })
    .from(deletionRequest)
    .where(and(eq(deletionRequest.learnerId, learnerId), isNull(deletionRequest.cancelledAt), isNull(deletionRequest.executedAt)))
    .orderBy(desc(deletionRequest.createdAt))
    .limit(1)
  return row ?? null
}

/** Data halaman Privasi. `privacy` null bila akun ini belum tertaut ke learner mana pun. */
export async function privacyDTO(actor: Actor, learnerParam: string | null): Promise<{ shell: ConsoleShell; privacy: PrivacyDTO | null }> {
  return inOrg(orgCtx(actor), async (tx) => {
    const { shell, learner } = await shellIn(tx, actor, learnerParam)
    if (!learner) return { shell, privacy: null }
    const rows = await consentRows(tx, learner.id)
    const members = await tx.select({ id: memberProfile.userId, name: memberProfile.name }).from(memberProfile)
    const names = new Map(members.map((m) => [m.id, m.name]))
    const latest = new Map<ConsentPurposeId, ConsentRow>()
    for (const r of rows) if (!latest.has(r.purpose)) latest.set(r.purpose, r)
    const purposes: ConsentPurpose[] = CONSENT_PURPOSES.map((id) => {
      const cur = latest.get(id)
      const text = purposeText(id)
      return { id, title: text.title, description: text.description, required: id === 'learning', granted: cur?.granted ?? false, grantedAt: cur?.granted ? cur.at.toISOString() : null }
    })
    const del = await openDeletion(tx, learner.id)
    return {
      shell,
      privacy: {
        shell,
        learner: { id: learner.id, name: learner.name, active: learner.active },
        noticeVersion: NOTICE_VERSION,
        purposes,
        history: consentHistory(rows, names, learner.name),
        retention: privacyNoticeData().dataRows.map((r) => ({ label: r.data, value: r.retention })),
        deletion: { requestedAt: del ? del.createdAt.toISOString() : null, scheduledFor: del?.scheduledFor ?? null },
      },
    }
  })
}

/**
 * Hanya orang tua yang tertaut ke learner ini yang boleh bertindak. RLS sudah menyembunyikan
 * learner lain; pemeriksaan ini membuat aturannya eksplisit dan gagal tertutup.
 */
export async function assertGuardianOf(tx: Tx, guardianId: string, learnerId: string): Promise<void> {
  const [link] = await tx
    .select({ id: guardianLink.learnerId })
    .from(guardianLink)
    .where(and(eq(guardianLink.guardianId, guardianId), eq(guardianLink.learnerId, learnerId)))
    .limit(1)
  if (!link) throw forbidden('Akun ini bukan orang tua yang tertaut ke learner ini, jadi persetujuan dan datanya tidak bisa diubah dari sini.')
}

/**
 * Catat perubahan persetujuan (in-app, guardianId = akun ini). Mengembalikan false bila status
 * sudah sama. Menarik rekaman atau foto menjadwalkan berkas yang ada untuk dihapus (retensi harian).
 */
export async function setConsentTx(tx: Tx, ctx: OrgContext, input: { guardianId: string; learnerId: string; purpose: ConsentPurposeId; granted: boolean }): Promise<{ changed: boolean; learnerName: string }> {
  const learner = await loadLearner(tx, input.learnerId)
  await assertGuardianOf(tx, input.guardianId, input.learnerId)
  const current = (await latestConsents(tx, [input.learnerId])).get(input.learnerId)?.get(input.purpose)
  if ((current?.granted ?? false) === input.granted) return { changed: false, learnerName: learner.name }
  if (input.granted && input.purpose === 'learning' && (await openDeletion(tx, input.learnerId)))
    throw conflict(`Penghapusan akun ${learner.name} sedang dijadwalkan. Batalkan penghapusan dulu, lalu berikan persetujuan belajar lagi.`)
  await recordConsentTx(tx, ctx, { learnerId: input.learnerId, purposes: [input.purpose], granted: input.granted, method: 'in-app', guardianId: input.guardianId })
  if (!input.granted && (input.purpose === 'audio' || input.purpose === 'photo')) {
    const kinds: ('audio' | 'image' | 'drawing')[] = input.purpose === 'audio' ? ['audio'] : ['image', 'drawing']
    const now = new Date()
    const gone = await tx
      .update(media)
      .set({ deletedAt: now, expiresAt: now })
      .where(and(eq(media.learnerId, input.learnerId), inArray(media.kind, kinds), isNull(media.deletedAt)))
      .returning({ id: media.id })
    if (gone.length) await auditTx(tx, ctx, 'media.withdrawn', input.learnerId, { purpose: input.purpose, files: gone.length })
  }
  return { changed: true, learnerName: learner.name }
}

export type DeletionRequested = { reference: string; scheduledFor: IsoDate; learnerName: string }

export async function requestDeletionTx(tx: Tx, ctx: OrgContext, input: { guardianId: string; learnerId: string; confirmName: string; today?: IsoDate }): Promise<DeletionRequested> {
  const learner = await loadLearner(tx, input.learnerId)
  await assertGuardianOf(tx, input.guardianId, input.learnerId)
  if (!confirmNameMatches(input.confirmName, learner.name))
    throw invalid(`Nama yang diketik belum sama dengan ${learner.name}. Ketik ${learner.name} untuk melanjutkan.`, { confirmName: `Ketik ${learner.name}.` })
  const open = await openDeletion(tx, input.learnerId)
  if (open) throw conflict(`Permintaan hapus untuk ${learner.name} sudah tercatat dan terjadwal ${formatDateId(open.scheduledFor)} (kode ${open.reference}). Batalkan dulu kalau ingin membuat permintaan baru.`)
  const reference = newReference()
  const { scheduledFor, runAfter } = deletionSchedule(input.today ?? jakartaDate())
  const [row] = await tx
    .insert(deletionRequest)
    .values({ orgId: ctx.orgId, learnerId: input.learnerId, requestedBy: input.guardianId, reference, scheduledFor })
    .returning({ id: deletionRequest.id })
  await enqueueJobTx(tx, ctx, 'learner.delete', { learnerId: input.learnerId, deletionRequestId: row!.id }, runAfter)
  await deactivateLearnerTx(tx, ctx, input.learnerId)
  await auditTx(tx, ctx, 'deletion.requested', input.learnerId, { reference, scheduledFor })
  return { reference, scheduledFor, learnerName: learner.name }
}

export async function cancelDeletionTx(tx: Tx, ctx: OrgContext, input: { guardianId: string; learnerId: string }): Promise<{ reference: string }> {
  const learner = await loadLearner(tx, input.learnerId)
  await assertGuardianOf(tx, input.guardianId, input.learnerId)
  const rows = await tx
    .update(deletionRequest)
    .set({ cancelledAt: new Date() })
    .where(and(eq(deletionRequest.learnerId, input.learnerId), isNull(deletionRequest.cancelledAt), isNull(deletionRequest.executedAt)))
    .returning({ id: deletionRequest.id, reference: deletionRequest.reference })
  if (rows.length === 0) throw notFound(`Tidak ada permintaan hapus yang masih berjalan untuk ${learner.name}. Muat ulang halaman Privasi.`)
  await auditTx(tx, ctx, 'deletion.cancelled', input.learnerId, { reference: rows[0]!.reference })
  return { reference: rows[0]!.reference }
}

/**
 * Learner langsung tidak aktif setelah permintaan hapus. Ditulis di transaksi yang sama dengan
 * permintaannya: tidak ada saat permintaan sudah tercatat tetapi learner masih aktif, dan
 * permintaan tidak tertinggal tanpa pause bila prosesnya mati di antara dua transaksi.
 * Orang tua tidak boleh mengubah learner_profile (RLS hanya staf), jadi peran transaksi ini
 * dinaikkan ke peran sistem (tutor) hanya untuk satu UPDATE sempit, lalu dikembalikan.
 */
export async function deactivateLearnerTx(tx: Tx, ctx: OrgContext, learnerId: string): Promise<void> {
  await tx.execute(sql`select set_config('app.role', ${systemCtx(ctx.orgId).role}, true)`)
  await tx.update(tables.learnerProfile).set({ active: false, updatedAt: new Date() }).where(eq(tables.learnerProfile.userId, learnerId))
  await tx.execute(sql`select set_config('app.role', ${ctx.role}, true)`)
}

/** Email konfirmasi ke orang tua yang meminta: kode referensi, tanggal hapus, dan cara membatalkan. */
export async function queueDeletionConfirmation(orgId: string, to: string, info: DeletionRequested & { learnerId: string }): Promise<void> {
  const date = formatDateId(info.scheduledFor)
  const mail = simpleEmail({
    title: `Permintaan hapus akun ${info.learnerName} tercatat`,
    lines: [
      `Kode referensi: ${info.reference}.`,
      `Akun dan data belajar ${info.learnerName} dihapus pada ${date}. Sampai tanggal itu ${info.learnerName} tidak bisa masuk ke Kira.`,
      `Untuk membatalkan, buka halaman Privasi keluarga lalu pilih Batalkan penghapusan sebelum ${date}.`,
    ],
    buttonLabel: 'Buka halaman Privasi',
    buttonUrl: `${origin()}/keluarga/privasi?learner=${encodeURIComponent(info.learnerId)}`,
    footer: 'Kalau permintaan ini bukan dari kamu, buka halaman Privasi dan batalkan sekarang.',
  })
  await queueEmail(orgId, { to, subject: `Permintaan hapus akun ${info.learnerName} tercatat`, html: mail.html, text: mail.text, kind: 'deletion-request' })
}
