import 'server-only'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { formatDateId, jakartaDate, type IsoDate } from '@kira/core/time'
import { tables } from '@kira/db'
import type { CompetitionCalendarDTO, CompetitionRow, Subject } from '@/lib/dto'
import type { Actor } from '../auth/actor'
import { orgCtx } from '../auth/actor'
import type { OrgContext, Tx } from '../db'
import { inOrg } from '../db'
import { invalid, notFound } from '../errors'
import { auditTx } from '../audit'
import { SUBJECT_ID_LABEL, SUBJECT_ORDER } from './console-common'
import { shellIn } from './console-shell'
import { content } from './content'

/**
 * T08 Kalender lomba. Baris lomba milik org ada di competition_event; katalog dan preset simulator
 * dari content/competitions/catalog.json. Layar learner membaca baris yang sama (learner-today,
 * learner-competition): tanggal pasti untuk hitung mundur, `learner_ids` (kosong berarti semua
 * learner), dan `competition_id` dari katalog (`esmo` membuka halaman ESMO).
 */

const { competitionEvent, learnerProfile } = tables

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

export const STATUSES: CompetitionRow['status'][] = ['not-open', 'not-registered', 'registered', 'done', 'skip', 'check']

function monthName(key: string): string {
  const [y, m] = key.split('-').map(Number) as [number, number]
  return `${MONTHS[m - 1]} ${y}`
}

function monthKeyAdd(key: string, n: number): string {
  const [y, m] = key.split('-').map(Number) as [number, number]
  const total = y * 12 + (m - 1) + n
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

/** "Math, soal berbahasa Indonesia" dari mapel dan bahasa katalog. */
export function subjectLine(subjects: readonly string[], langs: readonly string[] | null): string {
  const names = SUBJECT_ORDER.filter((s) => subjects.includes(s)).map((s) => SUBJECT_ID_LABEL[s])
  const list = names.length <= 1 ? (names[0] ?? 'Mapel belum dipilih') : names.length === 2 ? `${names[0]} dan ${names[1]}` : `${names.slice(0, -1).join(', ')}, dan ${names[names.length - 1]}`
  if (!langs || langs.length !== 1) return list
  return `${list}, soal berbahasa ${langs[0] === 'id' ? 'Indonesia' : 'Inggris'}`
}

/** Label tanggal untuk tabel: tanggal pasti, bulan perkiraan, atau belum diumumkan. */
export function dateLabel(date: IsoDate | null, estimate: boolean): string {
  if (!date) return 'Tanggal belum diumumkan'
  if (!estimate) return formatDateId(date)
  return `Perkiraan ${monthName(date.slice(0, 7))}`
}

/**
 * Label singkat di garis waktu: "17 April" untuk tanggal pasti, nama bulan saja untuk perkiraan
 * (layar menambahkan ", perkiraan"), dan ", selesai" untuk lomba yang sudah lewat.
 */
export function timelineWhen(date: IsoDate, estimate: boolean, status: CompetitionRow['status']): string {
  const [, m, d] = date.split('-').map(Number) as [number, number, number]
  const base = estimate ? MONTHS[m - 1]! : `${d} ${MONTHS[m - 1]}`
  return status === 'done' ? `${base}, selesai` : base
}

export type EventForTimeline = { id: string; name: string; date: IsoDate | null; dateIsEstimate: boolean; status: CompetitionRow['status'] }

/**
 * Garis waktu 12 bulan mulai bulan ini. Lomba tanpa tanggal tidak masuk garis waktu (tetap di tabel).
 * Lomba yang tidak diikuti (status Tidak ikut) tidak ditampilkan di garis waktu.
 */
export function buildMonths(events: readonly EventForTimeline[], today: IsoDate): CompetitionCalendarDTO['months'] {
  const first = today.slice(0, 7)
  return Array.from({ length: 12 }, (_, i) => {
    const key = monthKeyAdd(first, i)
    const rows = events
      .filter((e) => e.date && e.date.slice(0, 7) === key && e.status !== 'skip')
      .sort((a, b) => (a.date! < b.date! ? -1 : a.date! > b.date! ? 1 : a.name.localeCompare(b.name)))
      .map((e) => ({ id: e.id, name: e.name, when: timelineWhen(e.date!, e.dateIsEstimate, e.status) }))
    return { key, name: monthName(key), rows }
  })
}

/** Urutan tabel: yang akan datang (tanggal terdekat), yang belum bertanggal, lalu yang sudah lewat. */
export function sortRows<T extends { date: IsoDate | null; name: string }>(rows: readonly T[], today: IsoDate): T[] {
  const rank = (r: T) => (r.date === null ? 1 : r.date >= today ? 0 : 2)
  return [...rows].sort((a, b) => {
    const ra = rank(a)
    const rb = rank(b)
    if (ra !== rb) return ra - rb
    if (a.date && b.date && a.date !== b.date) return ra === 2 ? (a.date < b.date ? 1 : -1) : a.date < b.date ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

function presetMeta(id: string): { title: string; verified: boolean } | null {
  const p = content().presets.find((x) => x.id === id)
  return p ? { title: `${p.title}, ${p.rules.questionCount} soal, ${p.rules.timeLimitMin} menit`, verified: p.verified } : null
}

export async function competitionCalendarDTO(actor: Actor, learnerParam: string | null): Promise<CompetitionCalendarDTO> {
  const today = jakartaDate()
  return inOrg(orgCtx(actor), async (tx) => {
    const { shell } = await shellIn(tx, actor, learnerParam)
    const rows = await tx
      .select({
        id: competitionEvent.id,
        competitionId: competitionEvent.competitionId,
        name: competitionEvent.name,
        subjects: competitionEvent.subjects,
        date: competitionEvent.date,
        dateIsEstimate: competitionEvent.dateIsEstimate,
        registrationClose: competitionEvent.registrationClose,
        presetId: competitionEvent.presetId,
        link: competitionEvent.link,
        status: competitionEvent.status,
        learnerIds: competitionEvent.learnerIds,
      })
      .from(competitionEvent)
    const catalog = content().competitions
    const visible = new Set(shell.learners.map((l) => l.id))
    const out: CompetitionRow[] = sortRows(rows, today).map((r) => {
      const c = r.competitionId ? catalog.find((x) => x.id === r.competitionId) : undefined
      const preset = r.presetId ? presetMeta(r.presetId) : null
      return {
        id: r.id,
        name: r.name,
        subjectLine: subjectLine(r.subjects, c?.lang ?? null),
        date: r.date,
        dateLabel: dateLabel(r.date, r.dateIsEstimate),
        dateIsEstimate: r.dateIsEstimate,
        registrationClose: r.registrationClose,
        status: r.status,
        presetLabel: preset?.title ?? '',
        presetVerified: preset ? preset.verified : null,
        link: r.link,
        learnerIds: r.learnerIds.filter((id) => visible.has(id)),
        competitionId: r.competitionId,
        presetId: r.presetId,
      }
    })
    return {
      shell,
      todayLabel: `Hari ini ${formatDateId(today, true)}`,
      months: rows.length ? buildMonths(rows, today) : [],
      rows: out,
      catalog: catalog.map((c) => ({ id: c.id, name: c.name, organizer: c.organizer, format: c.format, verified: c.verified, website: c.website ?? null })),
      presets: content().presets.map((p) => ({ id: p.id, title: `${p.title}, ${p.rules.questionCount} soal, ${p.rules.timeLimitMin} menit`, verified: p.verified })),
    }
  })
}

export type EventInput = {
  eventId?: string
  competitionId: string | null
  name: string
  subjects: Subject[]
  date: IsoDate | null
  dateIsEstimate: boolean
  registrationClose: IsoDate | null
  presetId: string | null
  link: string | null
  learnerIds: string[]
}

/** Periksa referensi ke katalog dan preset (konten repo) serta learner (org ini). */
export async function saveEventTx(tx: Tx, ctx: OrgContext, input: EventInput): Promise<string> {
  if (input.competitionId && !content().competitions.some((c) => c.id === input.competitionId))
    throw invalid('Lomba ini tidak ada di katalog. Pilih dari daftar atau pilih Bukan dari katalog.', { competitionId: 'Tidak ada di katalog.' })
  if (input.presetId && !content().presets.some((p) => p.id === input.presetId))
    throw invalid('Preset simulator ini tidak dikenal. Pilih preset dari daftar atau Belum ada preset.', { presetId: 'Preset tidak dikenal.' })
  if (input.date && input.registrationClose && input.registrationClose > input.date)
    throw invalid('Pendaftaran tutup sesudah tanggal lomba. Periksa kedua tanggal.', { registrationClose: 'Sesudah tanggal lomba.' })
  if (input.learnerIds.length) {
    const found = await tx
      .select({ id: learnerProfile.userId })
      .from(learnerProfile)
      .where(and(inArray(learnerProfile.userId, input.learnerIds), isNull(learnerProfile.deletedAt)))
    if (found.length !== new Set(input.learnerIds).size) throw invalid('Ada learner yang tidak ditemukan di keluarga ini. Muat ulang halaman lalu pilih lagi.', { learnerIds: 'Learner tidak ditemukan.' })
  }
  const values = {
    competitionId: input.competitionId,
    name: input.name,
    subjects: input.subjects,
    date: input.date,
    dateIsEstimate: input.date ? input.dateIsEstimate : true,
    registrationClose: input.registrationClose,
    presetId: input.presetId,
    link: input.link,
    learnerIds: [...new Set(input.learnerIds)],
  }
  if (input.eventId) {
    const rows = await tx
      .update(competitionEvent)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(competitionEvent.id, input.eventId))
      .returning({ id: competitionEvent.id })
    if (rows.length === 0) throw notFound('Lomba ini tidak ditemukan. Mungkin sudah dihapus; muat ulang kalender.')
    await auditTx(tx, ctx, 'competition.updated', input.eventId, { competitionId: input.competitionId })
    return input.eventId
  }
  const [row] = await tx
    .insert(competitionEvent)
    .values({ orgId: ctx.orgId, ...values, status: defaultStatus(input.registrationClose, jakartaDate()) })
    .returning({ id: competitionEvent.id })
  await auditTx(tx, ctx, 'competition.created', row!.id, { competitionId: input.competitionId })
  return row!.id
}

/** Status awal lomba baru: belum daftar bila tanggal tutup sudah diketahui dan belum lewat, selain itu perlu konfirmasi. */
export function defaultStatus(registrationClose: IsoDate | null, today: IsoDate): CompetitionRow['status'] {
  if (registrationClose && registrationClose >= today) return 'not-registered'
  return 'check'
}

export async function setEventStatusTx(tx: Tx, ctx: OrgContext, eventId: string, status: CompetitionRow['status']): Promise<void> {
  const rows = await tx
    .update(competitionEvent)
    .set({ status, updatedAt: new Date() })
    .where(eq(competitionEvent.id, eventId))
    .returning({ id: competitionEvent.id })
  if (rows.length === 0) throw notFound('Lomba ini tidak ditemukan. Mungkin sudah dihapus; muat ulang kalender.')
  await auditTx(tx, ctx, 'competition.status', eventId, { status })
}

export async function deleteEventTx(tx: Tx, ctx: OrgContext, eventId: string): Promise<void> {
  const rows = await tx.delete(competitionEvent).where(eq(competitionEvent.id, eventId)).returning({ id: competitionEvent.id, name: competitionEvent.name })
  if (rows.length === 0) throw notFound('Lomba ini tidak ditemukan. Mungkin sudah dihapus; muat ulang kalender.')
  await auditTx(tx, ctx, 'competition.deleted', eventId)
}
