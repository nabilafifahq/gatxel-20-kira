import 'server-only'
import { sql } from 'drizzle-orm'
import { tables } from '@kira/db'
import { BG, DIVIDER, INK, MUTED, WHITE } from '@kira/figures/palette'
import { appDb, inOrg } from '../db'
import { systemCtx } from '../audit'

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
export async function queuePublicMail(mail: { to: string; subject: string; html: string; text: string; kind: string; listUnsubscribe?: string; sendAfter?: Date }): Promise<void> {
  await appDb().insert(tables.publicMail).values({ toAddr: mail.to, subject: mail.subject, html: mail.html, text: mail.text, kind: mail.kind, listUnsubscribe: mail.listUnsubscribe ?? null, sendAfter: mail.sendAfter ?? new Date() })
  await appDb().execute(sql`select pg_notify('kira_mail', 'public')`)
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** Email transaksi sederhana: satu paragraf dan satu tombol. */
export function simpleEmail(input: { title: string; lines: string[]; buttonLabel?: string; buttonUrl?: string; footer: string; footerLink?: { label: string; url: string } }): { html: string; text: string } {
  const button =
    input.buttonLabel && input.buttonUrl
      ? `<p style="margin:24px 0"><a href="${escapeHtml(input.buttonUrl)}" style="display:inline-block;background:${INK};color:${WHITE};text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px">${escapeHtml(input.buttonLabel)}</a></p>`
      : ''
  const footerLink = input.footerLink ? `<p style="margin:8px 0 0;font-size:14px;line-height:22px"><a href="${escapeHtml(input.footerLink.url)}" style="color:${MUTED}">${escapeHtml(input.footerLink.label)}</a></p>` : ''
  const html = `<!doctype html><html lang="id"><body style="margin:0;background:${BG};font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif;color:${INK}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px"><table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:${WHITE};border:1px solid ${DIVIDER};border-radius:16px"><tr><td style="padding:28px"><h1 style="margin:0 0 16px;font-size:22px;line-height:30px">${escapeHtml(input.title)}</h1>${input.lines.map((l) => `<p style="margin:0 0 12px;font-size:16px;line-height:26px">${escapeHtml(l)}</p>`).join('')}${button}<p style="margin:24px 0 0;font-size:14px;line-height:22px;color:${MUTED}">${escapeHtml(input.footer)}</p>${footerLink}</td></tr></table></td></tr></table></body></html>`
  const text = [input.title, '', ...input.lines, ...(input.buttonUrl ? ['', `${input.buttonLabel}: ${input.buttonUrl}`] : []), '', input.footer, ...(input.footerLink ? [`${input.footerLink.label}: ${input.footerLink.url}`] : [])].join('\n')
  return { html, text }
}
