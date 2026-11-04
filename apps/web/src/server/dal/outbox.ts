import 'server-only'
import { sql } from 'drizzle-orm'
import { tables } from '@kira/db'
import { renderEmail } from '@kira/core/email'
import { appDb, inOrg } from '../db'
import { systemCtx } from '../audit'
import { emailIdentity } from '../email'

/**
 * Email masuk kotak keluar di database; worker yang mengirim lewat SMTP.
 * Tanpa SMTP, status menjadi no-smtp dan tutor melihatnya di konsol.
 */
export async function queueEmail(orgId: string, mail: { to: string; subject: string; html: string; text: string; kind: string }): Promise<string> {
  return inOrg(systemCtx(orgId), async (tx) => {
    const [row] = await tx
      .insert(tables.outboxEmail)
      .values({ orgId, toAddr: mail.to, subject: mail.subject, html: mail.html, text: mail.text, kind: mail.kind })
      .returning({ id: tables.outboxEmail.id })
    await tx.execute(sql`select pg_notify('kira_mail', ${row!.id})`)
    return row!.id
  })
}

/**
 * Email tanpa org (verifikasi pendaftaran, kabar daftar tunggu). Web hanya menulis; worker mengirim.
 * `sendAfter` untuk pengiriman bertahap, `listUnsubscribe` menambah header berhenti satu klik.
 */
export async function queuePublicMail(mail: { to: string; subject: string; html: string; text: string; kind: string; listUnsubscribe?: string; sendAfter?: Date; replyTo?: string }): Promise<void> {
  await appDb().insert(tables.publicMail).values({ toAddr: mail.to, subject: mail.subject, html: mail.html, text: mail.text, kind: mail.kind, listUnsubscribe: mail.listUnsubscribe ?? null, replyTo: mail.replyTo ?? null, sendAfter: mail.sendAfter ?? new Date() })
  await appDb().execute(sql`select pg_notify('kira_mail', 'public')`)
}

export { escapeHtml } from '@kira/core/email'

/** Email transaksi sederhana lewat tata letak bersama. Email baru sebaiknya punya fungsi sendiri di @kira/core/email-templates. */
export function simpleEmail(input: { title: string; lines: string[]; buttonLabel?: string; buttonUrl?: string; footer: string; footerLink?: { label: string; url: string } }): { html: string; text: string } {
  const { html, text } = renderEmail(
    {
      subject: input.title,
      preheader: input.lines[0] ?? input.title,
      heading: input.title,
      blocks: input.lines.map((l) => ({ kind: 'text' as const, text: l })),
      ...(input.buttonLabel && input.buttonUrl ? { action: { label: input.buttonLabel, url: input.buttonUrl } } : {}),
      why: input.footer,
      ...(input.footerLink ? { footerLinks: [input.footerLink] } : {}),
    },
    emailIdentity(),
  )
  return { html, text }
}
