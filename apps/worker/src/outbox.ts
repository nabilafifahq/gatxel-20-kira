import { randomUUID } from 'node:crypto'
import { and, asc, eq, lt, lte, notInArray, sql } from 'drizzle-orm'
import nodemailer from 'nodemailer'
import type postgres from 'postgres'
import { mailDomain, parseAddressList, stripHeaderBreaks } from '@kira/core/email'
import { tables, withOrg, type Db } from '@kira/db'
import { listOrgIds, workerCtx } from './db'
import type { Env } from './env'
import type { Logger } from './log'
import { deleteSupportFile, readSupportFile } from './support-files'

/**
 * Kotak keluar email. Web menulis baris `outbox_email` (status queued) lalu NOTIFY kira_mail;
 * worker mengirim lewat SMTP_URL. Tanpa SMTP_URL, status menjadi no-smtp supaya tutor bisa
 * menyalin tautannya dari konsol. Gagal dicoba lagi sampai 5 kali. Log hanya berisi jumlah,
 * tidak pernah alamat, subjek, atau isi email. Pesan last_error tidak memuat kredensial.
 */

export const MAX_EMAIL_ATTEMPTS = 5
const PER_ORG_LIMIT = 50
const PUBLIC_LIMIT = 100

export type MailAttachment = { filename: string; content: Buffer; contentType: string }

export type OutgoingMail = { from: string; to: string; subject: string; text: string; html: string; replyTo?: string; attachments?: MailAttachment[]; listUnsubscribe?: string | null }

export type Mailer = { send(mail: OutgoingMail): Promise<void> }

/** Alamat balasan bawaan: alamat dukungan pertama. Pengirim noreply jadi tetap bisa dibalas. */
export function defaultReplyTo(env: Pick<Env, 'KIRA_SUPPORT_EMAIL' | 'KIRA_LEGAL_EMAIL'>): string | undefined {
  return parseAddressList(env.KIRA_SUPPORT_EMAIL)[0] ?? parseAddressList(env.KIRA_LEGAL_EMAIL)[0]
}

/**
 * Pesan akhir untuk nodemailer. Semua header yang berasal dari data dibersihkan dari CR dan LF di sini, sebagai lapis
 * terakhir. Message-ID memakai domain pengirim. Auto-Submitted ada di semua email karena semuanya otomatis.
 * List-Unsubscribe hanya di email daftar tunggu dan kabar.
 */
export function buildMessage(mail: OutgoingMail, now: Date = new Date()) {
  const domain = mailDomain(mail.from) ?? 'kira.gatxel.com'
  const headers: Record<string, string> = { 'Auto-Submitted': 'auto-generated' }
  if (mail.listUnsubscribe) {
    headers['List-Unsubscribe'] = `<${stripHeaderBreaks(mail.listUnsubscribe)}>`
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'
  }
  return {
    from: stripHeaderBreaks(mail.from),
    to: stripHeaderBreaks(mail.to),
    subject: stripHeaderBreaks(mail.subject),
    text: mail.text,
    html: mail.html,
    date: now,
    messageId: `<${randomUUID()}@${domain}>`,
    headers,
    ...(mail.replyTo ? { replyTo: stripHeaderBreaks(mail.replyTo) } : {}),
    ...(mail.attachments?.length ? { attachments: mail.attachments.map((a) => ({ ...a, filename: stripHeaderBreaks(a.filename), contentDisposition: 'attachment' as const })) } : {}),
  }
}

export function smtpMailer(env: Env): Mailer | null {
  if (!env.SMTP_URL) return null
  const transport = nodemailer.createTransport(env.SMTP_URL)
  return {
    async send(mail) {
      await transport.sendMail(buildMessage(mail))
    },
  }
}

/** Pesan singkat untuk last_error. Tidak menyalin pesan asli karena bisa memuat alamat server atau data login. */
export function smtpErrorMessage(e: unknown): string {
  const err = e as { code?: string; responseCode?: number }
  const code = err?.responseCode ? ` (kode ${err.responseCode})` : ''
  switch (err?.code) {
    case 'EAUTH':
    case 'ENOAUTH':
      return `Login SMTP ditolak${code}. Periksa user dan password di SMTP_URL.`
    case 'ECONNECTION':
    case 'ETIMEDOUT':
    case 'ESOCKET':
    case 'EDNS':
    case 'ECONNREFUSED':
    case 'ENOTFOUND':
      return 'Server SMTP tidak bisa dihubungi. Periksa alamat dan port di SMTP_URL.'
    case 'ETLS':
    case 'EREQUIRETLS':
      return 'Koneksi TLS ke server SMTP gagal.'
    case 'EENVELOPE':
      return `Alamat pengirim atau penerima ditolak server SMTP${code}.`
    case 'EMESSAGE':
      return `Isi email ditolak server SMTP${code}.`
    default:
      return `Email gagal dikirim${code || (err?.code ? ` (${err.code})` : '')}.`
  }
}

export type OutboxDeps = { db: Db; client: postgres.Sql; env: Env; log: Logger; mailer: Mailer | null }

export class OutboxSender {
  private busy = false
  private again = false
  private stopping = false
  private current: Promise<void> | null = null

  constructor(private readonly deps: OutboxDeps) {}

  trigger(): void {
    if (this.stopping) return
    if (this.busy) {
      this.again = true
      return
    }
    this.current = this.loop()
  }

  private async loop(): Promise<void> {
    this.busy = true
    try {
      do {
        this.again = false
        const r = await this.runOnce()
        if (r.sent + r.failed + r.noSmtp > 0) this.deps.log.info('kotak keluar diproses', r)
      } while (this.again && !this.stopping)
    } catch (e) {
      this.deps.log.error('kotak keluar gagal diproses', { error: e })
    } finally {
      this.busy = false
    }
  }

  async runOnce(): Promise<{ sent: number; failed: number; retry: number; noSmtp: number }> {
    const totals = { sent: 0, failed: 0, retry: 0, noSmtp: 0 }
    for (const orgId of await listOrgIds(this.deps.client)) {
      // Email yang gagal di putaran ini tidak dicoba lagi sampai putaran berikutnya (60 detik).
      const tried: string[] = []
      for (let n = 0; n < PER_ORG_LIMIT && !this.stopping; n++) {
        const r = await this.sendNext(orgId, tried)
        if (r === 'empty') break
        totals[r]++
      }
    }
    // Email tanpa org (verifikasi pendaftaran, kabar daftar tunggu).
    const tried: string[] = []
    for (let n = 0; n < PUBLIC_LIMIT && !this.stopping; n++) {
      const r = await this.sendNextPublic(tried)
      if (r === 'empty') break
      totals[r]++
    }
    return totals
  }

  /** Satu email publik per transaksi, dengan penguncian yang sama seperti email org. Menghormati send_after. */
  private async sendNextPublic(tried: string[]): Promise<'sent' | 'failed' | 'retry' | 'noSmtp' | 'empty'> {
    const { db, env, mailer } = this.deps
    const o = tables.publicMail
    let sentAttachment: string | null = null
    const outcome = await db.transaction(async (tx) => {
      const [mail] = await tx
        .select({ id: o.id, to: o.toAddr, subject: o.subject, text: o.text, html: o.html, attempts: o.attempts, unsub: o.listUnsubscribe, replyTo: o.replyTo, attachmentPath: o.attachmentPath, attachmentName: o.attachmentName, attachmentMime: o.attachmentMime })
        .from(o)
        .where(and(eq(o.status, 'queued'), lt(o.attempts, MAX_EMAIL_ATTEMPTS), lte(o.sendAfter, new Date()), tried.length ? notInArray(o.id, tried) : undefined))
        .orderBy(asc(o.sendAfter))
        .limit(1)
        .for('update', { skipLocked: true })
      if (!mail) return 'empty'
      tried.push(mail.id)
      if (!mailer) {
        await tx.update(o).set({ status: 'no-smtp', lastError: 'SMTP belum diatur.' }).where(eq(o.id, mail.id))
        return 'noSmtp'
      }
      try {
        const attachments = mail.attachmentPath ? await this.loadAttachment(mail.attachmentPath, mail.attachmentName, mail.attachmentMime) : []
        const replyTo = mail.replyTo ?? defaultReplyTo(env)
        await mailer.send({ from: env.SMTP_FROM ?? '', to: mail.to, subject: mail.subject, text: mail.text, html: mail.html, listUnsubscribe: mail.unsub, ...(replyTo ? { replyTo } : {}), ...(attachments.length ? { attachments } : {}) })
        await tx.update(o).set({ status: 'sent', sentAt: new Date(), attempts: sql`${o.attempts} + 1`, lastError: null, attachmentPath: null }).where(eq(o.id, mail.id))
        sentAttachment = mail.attachmentPath
        return 'sent'
      } catch (e) {
        const attempts = mail.attempts + 1
        const final = attempts >= MAX_EMAIL_ATTEMPTS
        await tx.update(o).set({ status: final ? 'failed' : 'queued', attempts, lastError: smtpErrorMessage(e) }).where(eq(o.id, mail.id))
        this.deps.log.warn('email publik gagal dikirim', { code: (e as { code?: string }).code ?? null, final })
        return final ? 'failed' : 'retry'
      }
    })
    // Lampiran dihapus setelah transaksi selesai: bila commit gagal, pengiriman ulang masih punya berkasnya.
    if (sentAttachment) await deleteSupportFile(env.KIRA_DATA_DIR, sentAttachment).catch(() => this.deps.log.warn('lampiran bantuan gagal dihapus', {}))
    return outcome
  }

  /** Lampiran yang sudah hilang tidak boleh menahan pesan: email tetap dikirim, isinya tetap memuat nama berkas. */
  private async loadAttachment(path: string, name: string | null, mime: string | null): Promise<MailAttachment[]> {
    try {
      return [{ filename: name ?? 'lampiran', content: await readSupportFile(this.deps.env.KIRA_DATA_DIR, path), contentType: mime ?? 'application/octet-stream' }]
    } catch (e) {
      this.deps.log.warn('lampiran bantuan tidak bisa dibaca', { code: (e as { code?: string }).code ?? null })
      return []
    }
  }

  /** Satu email per transaksi: baris dikunci (SKIP LOCKED) selama dikirim supaya tidak terkirim dua kali. */
  private async sendNext(orgId: string, tried: string[]): Promise<'sent' | 'failed' | 'retry' | 'noSmtp' | 'empty'> {
    const { db, env, mailer } = this.deps
    const o = tables.outboxEmail
    return withOrg(db, workerCtx(orgId, null), async (tx) => {
      const [mail] = await tx
        .select({ id: o.id, to: o.toAddr, subject: o.subject, text: o.text, html: o.html, attempts: o.attempts })
        .from(o)
        .where(and(eq(o.status, 'queued'), lt(o.attempts, MAX_EMAIL_ATTEMPTS), tried.length ? notInArray(o.id, tried) : undefined))
        .orderBy(asc(o.createdAt))
        .limit(1)
        .for('update', { skipLocked: true })
      if (!mail) return 'empty'
      tried.push(mail.id)
      if (!mailer) {
        await tx.update(o).set({ status: 'no-smtp', lastError: 'SMTP belum diatur. Salin tautan dari konsol dan kirim manual.' }).where(eq(o.id, mail.id))
        return 'noSmtp'
      }
      try {
        const replyTo = defaultReplyTo(env)
        await mailer.send({ from: env.SMTP_FROM ?? '', to: mail.to, subject: mail.subject, text: mail.text, html: mail.html, ...(replyTo ? { replyTo } : {}) })
        await tx.update(o).set({ status: 'sent', sentAt: new Date(), attempts: sql`${o.attempts} + 1`, lastError: null }).where(eq(o.id, mail.id))
        return 'sent'
      } catch (e) {
        const attempts = mail.attempts + 1
        const final = attempts >= MAX_EMAIL_ATTEMPTS
        await tx
          .update(o)
          .set({ status: final ? 'failed' : 'queued', attempts, lastError: smtpErrorMessage(e) })
          .where(eq(o.id, mail.id))
        this.deps.log.warn('email gagal dikirim', { code: (e as { code?: string }).code ?? null, responseCode: (e as { responseCode?: number }).responseCode ?? null, final })
        return final ? 'failed' : 'retry'
      }
    })
  }

  async shutdown(): Promise<void> {
    this.stopping = true
    if (this.current) await this.current
  }
}
