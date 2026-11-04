import 'server-only'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { supportConfirmEmail, supportTicketEmail } from '@kira/core/email-templates'
import { tables } from '@kira/db'
import { formatDateId, jakartaClock, jakartaDate } from '@kira/core/time'
import { systemCtx } from '../audit'
import { appVersion } from '../app-version'
import { appDb, inOrg } from '../db'
import { newTicketReference } from '../support-file'
import { emailIdentity, supportAddresses } from '../email'
import { gradeOfSkill, resolveItems } from './content'
import { roleLabel, SUPPORT_CATEGORIES, type SupportCategoryId } from '@/lib/support'

export type NewSupportTicket = {
  reference: string
  category: SupportCategoryId
  subject: string
  message: string
  senderEmail: string
  account: { id: string; role: 'tutor' | 'guardian' } | null
  userAgent: string
  screen: string
  appVersion: string
  pageFrom: string
  ipHash: string
  attachment: { path: string; name: string; mime: string; bytes: number } | null
  /** Balasan otomatis ke pengirim, hanya untuk akun yang masuk dan pengirim yang lolos Turnstile. */
  sendConfirmation: boolean
}

/**
 * Pesan bantuan dan emailnya masuk dalam satu transaksi. Role kira_app hanya bisa menambah baris; tidak ada yang
 * bisa dibaca balik dari support_ticket atau public_mail. Worker yang mengirim. Mengembalikan false bila tidak ada
 * alamat tim, supaya pemanggil bisa membuang lampiran yang tidak akan terkirim.
 */
export async function createSupportTicket(t: NewSupportTicket): Promise<{ mailedTeam: boolean }> {
  const id = emailIdentity()
  const category = SUPPORT_CATEGORIES.find((c) => c.id === t.category)!
  const now = new Date()
  const whenLabel = `${formatDateId(jakartaDate(now))}, ${jakartaClock(now)}`
  const team = supportAddresses()
  const teamMail = supportTicketEmail(id, {
    reference: t.reference,
    tag: category.tag,
    categoryLabel: category.label,
    subject: t.subject,
    message: t.message,
    senderEmail: t.senderEmail,
    senderKind: t.account ? 'akun masuk, alamat terverifikasi' : 'belum masuk, alamat belum diverifikasi',
    accountId: t.account?.id ?? null,
    accountRole: t.account ? roleLabel(t.account.role) : null,
    userAgent: t.userAgent,
    screen: t.screen,
    appVersion: t.appVersion,
    whenLabel,
    pageFrom: t.pageFrom,
    attachment: t.attachment ? { name: t.attachment.name, mime: t.attachment.mime, bytes: t.attachment.bytes } : null,
  })
  await appDb().transaction(async (tx) => {
    await tx.insert(tables.supportTicket).values({
      reference: t.reference,
      category: t.category,
      subject: t.subject,
      message: t.message,
      senderEmail: t.senderEmail,
      accountId: t.account?.id ?? null,
      accountRole: t.account?.role ?? null,
      userAgent: t.userAgent || null,
      screen: t.screen || null,
      appVersion: t.appVersion,
      pageFrom: t.pageFrom || null,
      ipHash: t.ipHash,
      attachmentName: t.attachment?.name ?? null,
      attachmentMime: t.attachment?.mime ?? null,
      attachmentBytes: t.attachment?.bytes ?? null,
    })
    if (team.length) {
      await tx.insert(tables.publicMail).values({
        toAddr: team.join(', '),
        ...teamMail,
        kind: 'support-ticket',
        replyTo: t.senderEmail,
        attachmentPath: t.attachment?.path ?? null,
        attachmentName: t.attachment?.name ?? null,
        attachmentMime: t.attachment?.mime ?? null,
      })
    }
    if (t.sendConfirmation) {
      const confirm = supportConfirmEmail(id, { reference: t.reference, categoryLabel: category.label })
      await tx.insert(tables.publicMail).values({ toAddr: t.senderEmail, ...confirm, kind: 'support-confirm' })
    }
    await tx.execute(sql`select pg_notify('kira_mail', 'public')`)
  })
  return { mailedTeam: team.length > 0 }
}

const REPORT_REASON: Record<string, string> = {
  'wrong-answer': 'Jawabannya salah',
  confusing: 'Soalnya membingungkan',
  picture: 'Masalah pada gambar',
  other: 'Lainnya',
}

const REPORT_SCREEN: Record<'practice' | 'test', string> = { practice: 'Layar latihan anak', test: 'Layar tes anak' }

/**
 * Laporan soal dari anak dibaca di konsol tutor. Keluarga tanpa tutor tidak punya konsol, jadi laporannya diteruskan
 * ke kotak bantuan tim. Keluarga bertutor tidak berubah. Pesan tidak memuat nama anak; pengirimnya email orang tua.
 */
export async function forwardProblemReport(input: { orgId: string; reference: string; itemRef: string; reason: string; note: string; learnerId: string | null; screen: 'practice' | 'test' | null; ipHash: string }): Promise<boolean> {
  const { members, skillId, itemGrade, learnerGrade } = await inOrg(systemCtx(input.orgId), async (tx) => {
    const rows = await tx
      .select({ id: tables.memberProfile.userId, role: tables.memberProfile.role, email: tables.memberProfile.email })
      .from(tables.memberProfile)
      .where(and(eq(tables.memberProfile.orgId, input.orgId), isNull(tables.memberProfile.removedAt)))
    if (rows.some((m) => m.role === 'tutor')) return { members: rows, skillId: null, itemGrade: null, learnerGrade: null }
    const found = (await resolveItems(tx, [input.itemRef])).get(input.itemRef)
    const learner = input.learnerId ? (await tx.select({ grade: tables.learnerProfile.grade }).from(tables.learnerProfile).where(eq(tables.learnerProfile.userId, input.learnerId)).limit(1))[0] : undefined
    return { members: rows, skillId: found?.skill ?? null, itemGrade: found ? gradeOfSkill(found.skill) : null, learnerGrade: learner?.grade ?? null }
  })
  if (members.some((m) => m.role === 'tutor')) return false
  const parent = members.find((m) => m.role === 'guardian' && m.email)
  if (!parent?.email) return false
  await createSupportTicket({
    reference: newTicketReference(),
    category: 'koreksi',
    subject: `Laporan soal dari anak: ${input.itemRef}`.slice(0, 120),
    message: [
      `Soal: ${input.itemRef}`,
      `Skill: ${skillId ?? 'tidak diketahui'}`,
      `Kelas soal: ${itemGrade ?? 'tidak diketahui'}`,
      `Kelas anak: ${learnerGrade ?? 'tidak diketahui'}`,
      `Learner: ${input.learnerId ?? 'orang dewasa'}`,
      `Layar: ${input.screen ? REPORT_SCREEN[input.screen] : 'tidak diketahui'}`,
      `Alasan: ${REPORT_REASON[input.reason] ?? input.reason}`,
      `Catatan anak: ${input.note.trim() || 'tidak ada'}`,
      `Kode laporan: ${input.reference}`,
    ].join('\n'),
    senderEmail: parent.email,
    account: { id: parent.id, role: 'guardian' },
    userAgent: '',
    screen: '',
    appVersion: appVersion(),
    pageFrom: input.screen ? REPORT_SCREEN[input.screen] : '',
    ipHash: input.ipHash,
    attachment: null,
    sendConfirmation: false,
  })
  return true
}
