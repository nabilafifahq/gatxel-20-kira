import { mkdirSync, mkdtempSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { buildMessage, defaultReplyTo, type OutgoingMail } from '../src/outbox'
import { deleteSupportFile, readSupportFile, safeSupportPath, SUPPORT_FILE_DAYS, supportRoot, sweepSupportFiles } from '../src/support-files'

const BASE: OutgoingMail = { from: 'Kira <noreply@gatxel.com>', to: 'ortu@example.com', subject: 'Kode verifikasi', text: 'teks', html: '<p>html</p>' }

describe('buildMessage', () => {
  it('Message-ID memakai domain pengirim, ada Date dan Auto-Submitted', () => {
    const now = new Date('2026-11-05T01:00:00Z')
    const m = buildMessage(BASE, now)
    expect(m.messageId).toMatch(/^<[0-9a-f-]{36}@gatxel\.com>$/)
    expect(m.date).toBe(now)
    expect(m.headers['Auto-Submitted']).toBe('auto-generated')
    expect(m.from).toBe('Kira <noreply@gatxel.com>')
    expect(m.text).toBe('teks')
    expect(m.html).toBe('<p>html</p>')
  })

  it('setiap email punya Message-ID baru', () => {
    expect(buildMessage(BASE).messageId).not.toBe(buildMessage(BASE).messageId)
  })

  it('List-Unsubscribe hanya bila diminta, dengan One-Click', () => {
    expect(buildMessage(BASE).headers).not.toHaveProperty('List-Unsubscribe')
    expect(buildMessage(BASE).headers).not.toHaveProperty('List-Unsubscribe-Post')
    const m = buildMessage({ ...BASE, listUnsubscribe: 'https://kira.gatxel.com/api/kabar/berhenti/abc' })
    expect(m.headers['List-Unsubscribe']).toBe('<https://kira.gatxel.com/api/kabar/berhenti/abc>')
    expect(m.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
  })

  it('CR dan LF di semua header dari data dibuang', () => {
    const m = buildMessage({
      ...BASE,
      to: 'a@example.com\r\nBcc: b@example.com',
      subject: 'Halo\r\nBcc: korban@example.com',
      replyTo: 'c@example.com\nX-Sisipan: ya',
      listUnsubscribe: 'https://kira.test/x\r\nX-Lain: ya',
      attachments: [{ filename: 'a\r\nb.png', content: Buffer.from('x'), contentType: 'image/png' }],
    })
    expect(m.subject).toBe('Halo Bcc: korban@example.com')
    expect(m.to).not.toMatch(/[\r\n]/)
    expect(m.replyTo).not.toMatch(/[\r\n]/)
    expect(m.headers['List-Unsubscribe']).not.toMatch(/[\r\n]/)
    expect(m.attachments![0]!.filename).toBe('a b.png')
    expect(m.attachments![0]!.contentDisposition).toBe('attachment')
  })

  it('tanpa alamat pengirim yang jelas tetap memakai domain Kira', () => {
    expect(buildMessage({ ...BASE, from: 'Kira' }).messageId).toMatch(/@kira\.gatxel\.com>$/)
  })
})

describe('defaultReplyTo', () => {
  it('alamat dukungan pertama, lalu alamat legal', () => {
    expect(defaultReplyTo({ KIRA_SUPPORT_EMAIL: 'a@gatxel.com, b@gatxel.com', KIRA_LEGAL_EMAIL: 'l@gatxel.com' })).toBe('a@gatxel.com')
    expect(defaultReplyTo({ KIRA_SUPPORT_EMAIL: undefined, KIRA_LEGAL_EMAIL: 'l@gatxel.com' })).toBe('l@gatxel.com')
    expect(defaultReplyTo({ KIRA_SUPPORT_EMAIL: undefined, KIRA_LEGAL_EMAIL: undefined })).toBeUndefined()
  })
})

describe('berkas lampiran', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kira-worker-support-'))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('path tidak boleh keluar dari folder support', () => {
    expect(() => safeSupportPath(dir, '../media/x.png')).toThrow()
    expect(() => safeSupportPath(dir, '')).toThrow()
    expect(() => safeSupportPath(dir, 'a\0b')).toThrow()
    expect(() => safeSupportPath(dir, join(dir, 'x'))).toThrow()
    expect(safeSupportPath(dir, '2026-11/x.png').startsWith(supportRoot(dir))).toBe(true)
  })

  it('baca lalu hapus; menghapus berkas yang tidak ada dianggap berhasil', async () => {
    mkdirSync(join(supportRoot(dir), '2026-11'), { recursive: true })
    writeFileSync(join(supportRoot(dir), '2026-11', 'a.png'), 'isi')
    expect((await readSupportFile(dir, '2026-11/a.png')).toString()).toBe('isi')
    await deleteSupportFile(dir, '2026-11/a.png')
    await expect(deleteSupportFile(dir, '2026-11/a.png')).resolves.toBeUndefined()
    await expect(readSupportFile(dir, '2026-11/a.png')).rejects.toThrow()
  })

  it('penyapuan hanya menghapus berkas yang lebih tua dari masa simpan', async () => {
    const month = join(supportRoot(dir), '2026-10')
    mkdirSync(month, { recursive: true })
    const old = join(month, 'lama.pdf')
    const fresh = join(month, 'baru.pdf')
    writeFileSync(old, 'x')
    writeFileSync(fresh, 'x')
    const now = new Date('2026-11-05T00:00:00Z')
    const past = new Date(now.getTime() - (SUPPORT_FILE_DAYS + 1) * 86_400_000)
    utimesSync(old, past, past)
    utimesSync(fresh, now, now)
    expect(await sweepSupportFiles(dir, now)).toBe(1)
    expect(() => statSync(old)).toThrow()
    expect(statSync(fresh).isFile()).toBe(true)
  })

  it('tanpa folder support tidak gagal', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'kira-worker-kosong-'))
    expect(await sweepSupportFiles(empty)).toBe(0)
    rmSync(empty, { recursive: true, force: true })
  })
})
