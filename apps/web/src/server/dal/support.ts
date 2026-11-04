import 'server-only'
import { sql } from 'drizzle-orm'
import { supportConfirmEmail, supportTicketEmail } from '@kira/core/email-templates'
import { tables } from '@kira/db'
import { formatDateId, jakartaClock, jakartaDate } from '@kira/core/time'
import { appDb } from '../db'
import { emailIdentity, supportAddresses } from '../email'
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
