import 'server-only'
import { and, asc, desc, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm'
import { addDays, formatDateId, jakartaDate, jakartaMidnight, weekStart as mondayOf, type IsoDate } from '@kira/core/time'
import { tables } from '@kira/db'
import type { ReportDTO, Subject, WeekSummaryDTO } from '@/lib/dto'
import { renderWeekSummaryEmail } from '@/components/family/WeekSummaryEmail'
import { questLine, studyLine } from '@/components/family/summaryText'
import type { Actor } from '../auth/actor'
import { orgCtx } from '../auth/actor'
import type { OrgContext, Tx } from '../db'
import { inOrg } from '../db'
import { origin } from '../env'
import { invalid, notFound } from '../errors'
import { auditTx } from '../audit'
import { hasConsent } from './consent'
import { accuracyPct, shortDateId, skillTitle, SUBJECT_ID_LABEL, SUBJECT_ORDER, thisWeekStart } from './console-common'
import { shellIn } from './console-shell'
import { streakFor } from './learner-core'
import { queueEmail } from './outbox'
import { weekSummaryData, type RepeatSkill, type SkillWeek } from './week-summary'

/**
 * T09 Laporan dan ekspor: ringkasan minggu untuk orang tua, Markdown untuk Claude dengan nama
 * samaran, kotak keluar email, dan pengiriman laporan. `deliverWeekReport` juga dipakai
 * endpoint internal worker (laporan otomatis Minggu malam).
 */

const { outboxEmail, competitionEvent, guardianLink, memberProfile, weekReport, response, org } = tables

export const REPORT_PSEUDONYM = 'learner_1'
export const NOTE_MAX = 600

const WEEKDAY_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

const STATUS_ID: Record<string, string> = {
  'not-open': 'pendaftaran belum dibuka',
  'not-registered': 'belum daftar',
  registered: 'sudah terdaftar',
  done: 'selesai',
  skip: 'tidak ikut',
  check: 'perlu konfirmasi',
}

/** "Minggu", "Sabtu dan Minggu", "Rabu, Sabtu, dan Minggu" (urut Senin dulu). */
export function restDaysLabel(days: readonly number[]): string {
  const names = [1, 2, 3, 4, 5, 6, 0].filter((d) => days.includes(d)).map((d) => WEEKDAY_ID[d]!)
  if (names.length === 0) return 'tidak ada'
  if (names.length === 1) return names[0]!
  if (names.length === 2) return `${names[0]} dan ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, dan ${names[names.length - 1]}`
}

/** Minggu laporan: tanggal apa pun dinormalkan ke Senin, minggu depan dikembalikan ke minggu ini. */
export function reportWeek(param: IsoDate | null, today: IsoDate): IsoDate {
  const current = thisWeekStart(today)
  if (!param) return current
  const monday = mondayOf(param)
  return monday > current ? current : monday
}

export type MarkdownInput = {
  grade: number
  summary: WeekSummaryDTO
  streak: number
  accuracy: { subject: Subject; points: { label: string; accuracy: number | null }[] }[]
  up: SkillWeek[]
  repeat: RepeatSkill[]
  competitions: { name: string; when: string; close: IsoDate | null; status: string }[]
  limits: { screenLimitMin: number; restWeekdays: number[]; reviewEnabled: boolean }
}

/**
 * Markdown untuk ditempel ke Claude (atau dibaca sebagai teks biasa). Nama learner diganti
 * learner_1; isinya hanya angka, nama skill, lomba, dan batas. Tanpa em dash.
 */
export function reportMarkdown(m: MarkdownInput, pseudonym = REPORT_PSEUDONYM): string {
  const s = m.summary
  const lines: string[] = [`# Ringkasan minggu ${pseudonym}`, `${s.weekLabel}. Grade ${m.grade}, Cambridge Primary Stage ${m.grade}.`, '']
  lines.push('## Waktu dan quest', `- ${studyLine(s)}`, `- ${questLine(s)}`, `- Streak sekarang ${m.streak} hari.`)
  if (s.firstWeek) lines.push('- Minggu pertama di Kira, data belum sampai 7 hari.')
  lines.push('')
  const labels = m.accuracy[0]?.points.map((p) => p.label) ?? []
  lines.push('## Akurasi jawaban pertama, 4 minggu terakhir', `| Mapel | ${labels.join(' | ')} |`, `|---|${labels.map(() => '---').join('|')}|`)
  for (const row of m.accuracy) lines.push(`| ${SUBJECT_ID_LABEL[row.subject]} | ${row.points.map((p) => (p.accuracy === null ? 'belum ada' : `${p.accuracy}%`)).join(' | ')} |`)
  lines.push('', '## Perlu diulang')
  if (m.repeat.length) for (const r of m.repeat) lines.push(`- ${skillTitle(r.skillId)} (${r.skillId}), ${SUBJECT_ID_LABEL[r.subject]}: ${r.note}`)
  else lines.push('- Tidak ada skill yang perlu diulang minggu ini.')
  lines.push('', '## Naik')
  if (m.up.length)
    for (const u of m.up)
      lines.push(
        `- ${skillTitle(u.skillId)} (${u.skillId}), ${SUBJECT_ID_LABEL[u.subject]}: ${u.after.stars > u.before.stars ? `${u.before.stars} ke ${u.after.stars} bintang` : `tetap ${u.after.stars} bintang, ${u.week.right} dari ${u.week.total} benar minggu ini`}`,
      )
  else lines.push('- Belum ada skill yang naik bintang minggu ini.')
  lines.push('', '## Lomba')
  if (m.competitions.length)
    for (const c of m.competitions) lines.push(`- ${c.name}: ${c.when}${c.close ? `, pendaftaran tutup ${formatDateId(c.close)}` : ''}, ${STATUS_ID[c.status] ?? c.status}`)
  else lines.push('- Belum ada lomba yang dicatat untuk learner ini.')
  lines.push(
    '',
    '## Batas',
    `- Waktu layar paling lama ${m.limits.screenLimitMin} menit sehari, hari istirahat ${restDaysLabel(m.limits.restWeekdays)}.`,
    `- Buku Koreksi ${m.limits.reviewEnabled ? 'aktif' : 'tidak aktif'}.`,
  )
  return lines.join('\n')
}

/** Tanggal lomba untuk teks: tanggal pasti, bulan perkiraan, atau belum diumumkan. */
export function competitionWhen(date: IsoDate | null, estimate: boolean): string {
  if (!date) return 'tanggal belum diumumkan'
  if (!estimate) return formatDateId(date)
  const [y, mo] = date.split('-').map(Number) as [number, number]
  return `perkiraan ${MONTHS[mo - 1]} ${y}`
}

async function weeklyAccuracy(tx: Tx, learnerId: string, monday: IsoDate): Promise<MarkdownInput['accuracy']> {
  const weeks = [21, 14, 7, 0].map((d) => addDays(monday, -d))
  const rows = await tx
    .select({
      subject: response.subject,
      week: sql<string>`to_char(date_trunc('week', ${response.answeredAt} at time zone 'Asia/Jakarta'), 'YYYY-MM-DD')`,
      total: sql<number>`count(*)::int`,
      correct: sql<number>`count(*) filter (where ${response.status} = 'correct')::int`,
    })
    .from(response)
    .where(
      and(
        eq(response.learnerId, learnerId),
        eq(response.attemptNo, 1),
        inArray(response.status, ['correct', 'wrong']),
        gte(response.answeredAt, jakartaMidnight(weeks[0]!)),
        lt(response.answeredAt, jakartaMidnight(addDays(monday, 7))),
      ),
    )
    .groupBy(response.subject, sql`2`)
  return SUBJECT_ORDER.map((subject) => ({
    subject,
    points: weeks.map((w) => {
      const r = rows.find((x) => x.subject === subject && x.week === w)
      return { label: shortDateId(w), accuracy: r ? accuracyPct(r.correct, r.total) : null }
    }),
  }))
}

async function learnerCompetitions(tx: Tx, learnerId: string, today: IsoDate): Promise<MarkdownInput['competitions']> {
  const rows = await tx
    .select({ name: competitionEvent.name, date: competitionEvent.date, estimate: competitionEvent.dateIsEstimate, close: competitionEvent.registrationClose, status: competitionEvent.status, ids: competitionEvent.learnerIds })
    .from(competitionEvent)
    .orderBy(sql`${competitionEvent.date} asc nulls last`, asc(competitionEvent.name))
  return rows
    .filter((r) => (r.ids.length === 0 || r.ids.includes(learnerId)) && r.status !== 'skip' && r.status !== 'done' && (r.date === null || r.date >= today))
    .slice(0, 5)
    .map((r) => ({ name: r.name, when: competitionWhen(r.date, r.estimate), close: r.close, status: r.status }))
}

/** Data halaman Laporan. `report` null bila org belum punya learner (halaman menampilkan keadaan kosong). */
export async function reportDTO(actor: Actor, learnerParam: string | null, weekParam: IsoDate | null): Promise<{ shell: ReportDTO['shell']; report: ReportDTO | null }> {
  const today = jakartaDate()
  return inOrg(orgCtx(actor), async (tx) => {
    const { shell, learner } = await shellIn(tx, actor, learnerParam)
    if (!learner) return { shell, report: null }
    const monday = reportWeek(weekParam, today)
    const data = await weekSummaryData(tx, learner.id, monday, { today })
    const full = data.learner
    const streak = await streakFor(tx, full, today).then((r) => r.current)
    const markdown = reportMarkdown({
      grade: full.grade,
      summary: data.dto,
      streak,
      accuracy: await weeklyAccuracy(tx, learner.id, monday),
      up: data.up,
      repeat: data.repeat,
      competitions: await learnerCompetitions(tx, learner.id, today),
      limits: { screenLimitMin: full.screenLimitMin, restWeekdays: full.restWeekdays, reviewEnabled: full.reviewEnabled },
    })
    const [sent] = await tx
      .select({ sentAt: weekReport.sentAt })
      .from(weekReport)
      .where(and(eq(weekReport.learnerId, learner.id), eq(weekReport.weekStart, monday)))
      .limit(1)
    const outbox = await tx
      .select({ id: outboxEmail.id, to: outboxEmail.toAddr, subject: outboxEmail.subject, status: outboxEmail.status, createdAt: outboxEmail.createdAt })
      .from(outboxEmail)
      .orderBy(desc(outboxEmail.createdAt))
      .limit(20)
    return {
      shell,
      report: {
        shell,
        learnerId: learner.id,
        weekStart: monday,
        weekLabel: data.dto.weekLabel,
        markdown,
        summary: data.dto,
        outbox: outbox.map((o) => ({ ...o, createdAt: o.createdAt.toISOString() })),
        sentAt: sent?.sentAt ? sent.sentAt.toISOString() : null,
      },
    }
  })
}

/** Email orang tua yang tertaut ke learner ini (akun orang tua aktif, email terisi). */
async function guardianEmails(tx: Tx, learnerId: string): Promise<string[]> {
  const rows = await tx
    .select({ email: memberProfile.email })
    .from(guardianLink)
    .innerJoin(memberProfile, eq(memberProfile.userId, guardianLink.guardianId))
    .where(and(eq(guardianLink.learnerId, learnerId), eq(memberProfile.role, 'guardian'), isNull(memberProfile.removedAt)))
  return [...new Set(rows.map((r) => r.email.trim().toLowerCase()).filter((e) => e.includes('@')))]
}

export type DeliverResult = { queued: number; skipped?: 'inactive' | 'already-sent' | 'no-consent' | 'no-recipient' }

/** Hapus alamat email dari teks error sebelum dicatat (pesan driver memuat parameter query). */
export function scrubEmails(text: string): string {
  return text.replace(/[^\s@"'(),;<>]+@[^\s@"'(),;<>]+/g, '[email]')
}

/**
 * Teks error yang aman dicatat: pesan Postgres asli (cause), bukan pesan drizzle yang memuat
 * query dan parameternya (alamat email, isi email dengan nama anak). Email tetap dibersihkan.
 */
export function safeErrorText(e: unknown): string {
  const cause = (e as { cause?: unknown } | null)?.cause
  const base = cause instanceof Error ? cause.message : e instanceof Error && !/params:|failed query/i.test(e.message) ? e.message : e instanceof Error ? e.name : 'galat tidak dikenal'
  return scrubEmails(base).slice(0, 200)
}

/** Error yang aman dicatat: tanpa alamat email dan tanpa parameter query. */
export class ReportDeliveryError extends Error {
  constructor(message: string) {
    super(scrubEmails(message))
    this.name = 'ReportDeliveryError'
  }
}

/**
 * Kirim laporan satu minggu ke orang tua: simpan week_report, antrekan satu email per orang tua
 * yang tertaut dan punya email, bila persetujuan `progress-email` terbaru diberikan.
 * - manual (T09, tutor): `note` dari form, menolak dengan pesan jelas bila tidak ada penerima.
 * - scheduled (worker): catatan tutor yang tersimpan dipakai, minggu yang sudah terkirim dilewati,
 *   learner yang tidak aktif atau tidak punya penerima dilewati tanpa error.
 * Alamat email tidak pernah dicatat di log atau audit.
 */
export async function deliverWeekReport(
  ctx: OrgContext,
  input: { learnerId: string; weekStart: IsoDate; mode: 'manual' | 'scheduled'; note?: string | null; createdBy: string | null },
): Promise<DeliverResult> {
  const monday = mondayOf(input.weekStart)
  const prep = await inOrg(ctx, async (tx) => {
    const [l] = await tx
      .select({ id: tables.learnerProfile.userId, active: tables.learnerProfile.active, deletedAt: tables.learnerProfile.deletedAt })
      .from(tables.learnerProfile)
      .where(eq(tables.learnerProfile.userId, input.learnerId))
      .limit(1)
    if (!l || l.deletedAt) {
      if (input.mode === 'manual') throw notFound('Learner tidak ditemukan. Muat ulang halaman laporan.')
      return { skipped: 'inactive' as const }
    }
    if (!l.active) {
      if (input.mode === 'manual') throw invalid('Laporan belum terkirim: akun learner ini sedang tidak aktif (persetujuan belajar belum ada, ditarik, atau sedang menunggu penghapusan). Periksa status di halaman Learner.')
      return { skipped: 'inactive' as const }
    }
    const [existing] = await tx.select({ sentAt: weekReport.sentAt }).from(weekReport).where(and(eq(weekReport.learnerId, input.learnerId), eq(weekReport.weekStart, monday))).limit(1)
    if (input.mode === 'scheduled' && existing?.sentAt) return { skipped: 'already-sent' as const }
    const consent = await hasConsent(tx, input.learnerId, 'progress-email')
    const emails = await guardianEmails(tx, input.learnerId)
    const summary = (await weekSummaryData(tx, input.learnerId, monday, input.mode === 'manual' ? { note: input.note ?? null } : {})).dto
    const [o] = await tx.select({ name: org.name }).from(org).where(eq(org.id, ctx.orgId)).limit(1)
    return { summary, consent, emails, orgName: o?.name ?? 'Kira' }
  })
  if ('skipped' in prep) return { queued: 0, skipped: prep.skipped }
  if (!prep.consent) {
    if (input.mode === 'manual')
      throw invalid('Laporan belum terkirim: orang tua belum menyetujui laporan lewat email. Ringkasan tetap tampil di halaman keluarga; persetujuan diatur orang tua di halaman Privasi.')
    return { queued: 0, skipped: 'no-consent' }
  }
  if (prep.emails.length === 0) {
    if (input.mode === 'manual') throw invalid('Laporan belum terkirim: belum ada orang tua dengan email yang tertaut ke learner ini. Undang orang tua dari halaman Pengaturan.')
    return { queued: 0, skipped: 'no-recipient' }
  }

  const base = origin()
  const legalName = process.env.KIRA_LEGAL_NAME?.trim()
  const mail = renderWeekSummaryEmail(prep.summary, {
    reportUrl: `${base}/keluarga?learner=${encodeURIComponent(input.learnerId)}&minggu=${monday}`,
    privacyUrl: `${base}/keluarga/privasi?learner=${encodeURIComponent(input.learnerId)}`,
    controller: legalName ? `Kira, dikelola ${legalName}` : `Kira ${prep.orgName}`,
  })
  let queued = 0
  for (const to of prep.emails) {
    try {
      await queueEmail(ctx.orgId, { to, subject: mail.subject, html: mail.html, text: mail.text, kind: 'week-report' })
      queued++
    } catch (e) {
      throw new ReportDeliveryError(`Email laporan ke orang tua ke-${queued + 1} gagal masuk kotak keluar: ${safeErrorText(e)}`)
    }
  }

  await inOrg(ctx, async (tx) => {
    const now = new Date()
    const values = { orgId: ctx.orgId, learnerId: input.learnerId, weekStart: monday, data: prep.summary, sentAt: now, createdBy: input.createdBy }
    if (input.mode === 'manual') {
      const note = input.note?.trim() ? input.note.trim() : null
      await tx
        .insert(weekReport)
        .values({ ...values, note })
        .onConflictDoUpdate({ target: [weekReport.learnerId, weekReport.weekStart], set: { note, data: prep.summary, sentAt: now, createdBy: input.createdBy } })
    } else {
      await tx
        .insert(weekReport)
        .values({ ...values, note: null })
        .onConflictDoUpdate({ target: [weekReport.learnerId, weekReport.weekStart], set: { data: prep.summary, sentAt: now } })
    }
    await auditTx(tx, ctx, input.mode === 'manual' ? 'report.sent' : 'report.sent.scheduled', input.learnerId, { weekStart: monday, recipients: prep.emails.length })
  })
  return { queued }
}
