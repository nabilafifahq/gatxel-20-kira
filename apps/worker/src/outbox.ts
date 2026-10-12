import { and, asc, eq, lt, notInArray, sql } from 'drizzle-orm'
import nodemailer from 'nodemailer'
import type postgres from 'postgres'
import { tables, withOrg, type Db } from '@kira/db'
import { listOrgIds, workerCtx } from './db'
import type { Env } from './env'
import type { Logger } from './log'

/**
 * Kotak keluar email. Web menulis baris `outbox_email` (status queued) lalu NOTIFY kira_mail;
 * worker mengirim lewat SMTP_URL. Tanpa SMTP_URL, status menjadi no-smtp supaya tutor bisa
 * menyalin tautannya dari konsol. Gagal dicoba lagi sampai 5 kali. Log hanya berisi jumlah,
 * tidak pernah alamat, subjek, atau isi email. Pesan last_error tidak memuat kredensial.
 */

export const MAX_EMAIL_ATTEMPTS = 5
const PER_ORG_LIMIT = 50

export type Mailer = { send(mail: { from: string; to: string; subject: string; text: string; html: string }): Promise<void> }

export function smtpMailer(env: Env): Mailer | null {
  if (!env.SMTP_URL) return null
  const transport = nodemailer.createTransport(env.SMTP_URL)
  return {
    async send(mail) {
      await transport.sendMail({ ...mail, headers: { 'Auto-Submitted': 'auto-generated' } })
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
    return totals
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
        await mailer.send({ from: env.SMTP_FROM ?? '', to: mail.to, subject: mail.subject, text: mail.text, html: mail.html })
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
