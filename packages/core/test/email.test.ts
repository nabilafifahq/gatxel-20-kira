import { describe, expect, it } from 'vitest'
import { EMAIL_CREDIT, EMAIL_IGNORE_LINE, EMAIL_LOGO_URL, EMAIL_MAX_BYTES, escapeHtml, isSafeAddress, mailDomain, parseAddressList, renderEmail, stripHeaderBreaks } from '../src/email'
import { emailSamples, formatBytes, passwordResetEmail, signupVerifyEmail, supportConfirmEmail, supportSubject, supportTicketEmail } from '../src/email-templates'

const ID = { origin: 'https://kira.gatxel.com', legalName: 'Gatxel', legalAddress: 'Jakarta Selatan, Indonesia' }
const samples = emailSamples(ID)
// Dibangun dari kode karakter supaya berkas ini sendiri bersih dari keduanya.
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
const EMOJI = /\p{Extended_Pictographic}/u

describe('header email', () => {
  it('membuang CR, LF, dan karakter kendali lain', () => {
    expect(stripHeaderBreaks('Halo\r\nBcc: korban@example.com')).toBe('Halo Bcc: korban@example.com')
    expect(stripHeaderBreaks(['a', 'b', 'c'].join(String.fromCharCode(0x2028)) + String.fromCharCode(0) + 'd\te')).toBe('a b c d e')
    expect(stripHeaderBreaks('  rapi   sekali  ')).toBe('rapi sekali')
  })

  it('alamat harus polos: tanpa spasi, baris baru, atau penerima tambahan', () => {
    expect(isSafeAddress('nabila+uji@gatxel.com')).toBe(true)
    for (const bad of ['a@b.com\r\nBcc: c@d.com', 'a@b.com, c@d.com', 'Nama <a@b.com>', 'a b@c.com', 'a@b', '@b.com', 'a@b.com\n', `${'x'.repeat(250)}@b.com`]) expect(isSafeAddress(bad)).toBe(false)
  })

  it('daftar alamat dari env dipisah koma, duplikat dan .invalid dibuang', () => {
    expect(parseAddressList(' a@gatxel.com, b@gatxel.com ,A@gatxel.com,bukan alamat,email-pengelola@belum-diisi.invalid')).toEqual(['a@gatxel.com', 'b@gatxel.com'])
    expect(parseAddressList(undefined)).toEqual([])
    expect(parseAddressList('')).toEqual([])
  })

  it('domain Message-ID diambil dari SMTP_FROM', () => {
    expect(mailDomain('Kira <noreply@gatxel.com>')).toBe('gatxel.com')
    expect(mailDomain('noreply@Gatxel.com')).toBe('gatxel.com')
    expect(mailDomain('tanpa alamat')).toBeNull()
    expect(mailDomain(null)).toBeNull()
  })
})

describe('semua jenis email', () => {
  it('mencakup setiap jenis yang dikirim Kira', () => {
    expect(samples.map((s) => s.kind).sort()).toEqual(
      ['consent-request', 'data-export', 'deletion-request', 'invite', 'password-reset', 'seat-reopened', 'signup-active', 'signup-existing', 'signup-verify', 'support-confirm', 'support-ticket', 'waitlist-confirm', 'waitlist-welcome', 'week-report'].map((k) => `sample-${k}`).sort(),
    )
  })

  for (const { kind, mail, listUnsubscribe } of samples) {
    describe(kind, () => {
      it('tanpa em dash atau en dash, tanpa emoji', () => {
        expect(`${mail.subject}\n${mail.html}\n${mail.text}`).not.toMatch(DASHES)
        expect(`${mail.subject}\n${mail.text}`).not.toMatch(EMOJI)
      })

      it('subjek tenang: tanpa huruf besar semua, tanda seru, atau kata promosi', () => {
        expect(mail.subject).not.toMatch(/[!]/)
        expect(mail.subject).not.toMatch(/\b(GRATIS|PROMO|DISKON|SEGERA)\b/i)
        expect(mail.subject.replace(/\[[^\]]*\]|\([^)]*\)/g, '')).not.toMatch(/\b[A-Z]{5,}\b/)
        expect(mail.subject.length).toBeLessThan(90)
      })

      it('footer wajib ada di HTML dan teks', () => {
        for (const body of [mail.html, mail.text]) {
          expect(body).toContain(EMAIL_CREDIT)
          expect(body).toContain('https://kira.gatxel.com/feedback')
          expect(body).toContain('https://kira.gatxel.com/privasi')
          expect(body).toContain('Jakarta Selatan, Indonesia')
          expect(body).toContain('Bantuan')
          expect(body).toContain('Privasi')
        }
        expect(mail.text).toMatch(/Anda menerima email ini|Email ini dikirim ke tim Gatxel/)
      })

      it('versi teks sungguhan, bukan HTML', () => {
        expect(mail.text).not.toMatch(/<[a-z!][^>]*>/i)
        expect(mail.text.length).toBeGreaterThan(120)
      })

      it('HTML aman untuk Gmail: tabel, logo PNG absolut, tanpa font luar, skrip, atau piksel pelacak', () => {
        expect(mail.html.startsWith('<!doctype html><html lang="id">')).toBe(true)
        expect(mail.html).toContain('role="presentation"')
        const imgs = mail.html.match(/<img\b[^>]*>/g) ?? []
        expect(imgs).toHaveLength(1)
        expect(imgs[0]).toContain(`src="${EMAIL_LOGO_URL}"`)
        expect(imgs[0]).toContain('alt="Kira"')
        expect(imgs[0]).toMatch(/width="\d+"/)
        expect(mail.html).not.toMatch(/<script|<link\b|@import|@font-face|fonts\.googleapis|url\(/i)
        expect(new TextEncoder().encode(mail.html).length).toBeLessThan(EMAIL_MAX_BYTES)
      })

      it('orang tua disapa Anda', () => {
        expect(`${mail.subject}\n${mail.text}`).not.toMatch(/\b(kamu|kamulah|akunmu|emailmu|milikmu)\b/i)
      })

      it('List-Unsubscribe hanya di email daftar tunggu, dan tautan berhenti ada di isi', () => {
        const isList = /waitlist|seat/.test(kind)
        expect(Boolean(listUnsubscribe)).toBe(isList)
        if (isList) {
          expect(listUnsubscribe).toContain('/api/kabar/berhenti/')
          expect(mail.text).toContain('Berhenti berlangganan')
        }
      })
    })
  }
})

describe('isi email', () => {
  it('tombol tahan banting dan tautan yang sama ditulis sebagai teks', () => {
    const url = 'https://kira.gatxel.com/reset/abc?x=1&y=2'
    const { html, text } = passwordResetEmail(ID, { url })
    expect(html).toContain('bgcolor="#6546A5"')
    expect(html).toContain('mso-padding-alt')
    expect(html.match(/href="https:\/\/kira\.gatxel\.com\/reset\/abc\?x=1&amp;y=2"/g)).toHaveLength(2)
    expect(text).toContain(url)
    expect(text).toContain('30 menit')
    expect(text).toContain(EMAIL_IGNORE_LINE)
  })

  it('email verifikasi menyebut batas waktu dan kalimat abaikan', () => {
    const { text, subject } = signupVerifyEmail(ID, { url: 'https://kira.gatxel.com/daftar/konfirmasi/abc' })
    expect(subject).toBe('Konfirmasi email untuk akun Kira Anda')
    expect(text).toContain('24 jam')
    expect(text).toContain(EMAIL_IGNORE_LINE)
  })

  it('semua masukan di-escape di HTML', () => {
    const evil = '<img src=x onerror=alert(1)>"\'&'
    const { html } = renderEmail(
      { subject: evil, preheader: evil, heading: evil, blocks: [{ kind: 'text', text: evil }, { kind: 'callout', title: evil, text: evil }, { kind: 'facts', rows: [{ label: evil, value: evil }] }, { kind: 'list', items: [{ lead: evil, text: evil }] }, { kind: 'code', label: evil, value: evil }, { kind: 'heading', text: evil }], action: { label: evil, url: 'https://kira.test/x?a="><script>alert(1)</script>' }, why: evil },
      ID,
    )
    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('<script>')
    expect(html).toContain(escapeHtml(evil))
  })

  it('tanpa identitas pengelola baris alamat dilewati, tanpa teks kosong', () => {
    const { text, html } = signupVerifyEmail({ origin: 'https://kira.gatxel.com' }, { url: 'https://kira.gatxel.com/x' })
    expect(text).not.toMatch(/undefined|null|belum diisi/)
    expect(html).not.toMatch(/undefined|belum diisi/)
  })

  it('origin http lokal tetap memakai logo yang di-host di https', () => {
    expect(signupVerifyEmail({ origin: 'http://localhost:3183' }, { url: 'http://localhost:3183/x' }).html).toContain(EMAIL_LOGO_URL)
  })

  it('balasan otomatis ke pengirim hanya memuat nomor referensi dan kategori, tanpa teks bebas', () => {
    const mail = supportConfirmEmail(ID, { reference: 'KR-ABCD2345', categoryLabel: 'Masalah atau bug' })
    expect(mail.subject).toContain('KR-ABCD2345')
    expect(mail.html).toContain('KR-ABCD2345')
    expect(mail.text).toContain('Masalah atau bug')
    expect(mail.text).toContain(EMAIL_IGNORE_LINE)
    // Fungsi ini memang tidak punya parameter subjek atau pesan.
    expect(supportConfirmEmail.length).toBe(2)
  })

  it('email ke tim: subjek bertanda, isi pengguna di-escape, header bersih', () => {
    const mail = supportTicketEmail(ID, {
      reference: 'KR-ABCD2345',
      tag: 'Bug',
      categoryLabel: 'Masalah atau bug',
      subject: 'Tombol <b>rusak</b>\r\nBcc: korban@example.com',
      message: 'Baris satu <script>alert(1)</script>\nBaris dua',
      senderEmail: 'ortu@example.com',
      senderKind: 'belum masuk',
      accountId: null,
      accountRole: null,
      userAgent: 'Agen <i>uji</i>',
      screen: '390x844',
      appVersion: '0.1.0',
      whenLabel: '5 November 2026, 09.30',
      pageFrom: '/keluarga',
      attachment: { name: 'foto.png', mime: 'image/png', bytes: 2048 },
    })
    expect(mail.subject).toBe('[Kira][Bug] Tombol <b>rusak</b> Bcc: korban@example.com (KR-ABCD2345)')
    expect(mail.subject).not.toMatch(/[\r\n]/)
    expect(mail.html).not.toContain('<script>')
    expect(mail.html).not.toContain('<b>rusak')
    expect(mail.html).not.toContain('<i>uji')
    expect(mail.html).toContain('Baris satu &lt;script&gt;')
    expect(mail.html).toContain('<br>Baris dua')
    expect(mail.text).toContain('Baris dua')
    expect(mail.text).toContain('foto.png (image/png, 2 KB)')
    expect(mail.text).toContain('ortu@example.com')
    expect(mail.text).toContain('390x844')
    expect(mail.text).toContain('Agen <i>uji</i>')
  })

  it('format subjek dan ukuran berkas', () => {
    expect(supportSubject('Saran', 'Warna tombol', 'KR-1')).toBe('[Kira][Saran] Warna tombol (KR-1)')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5,0 MB')
  })
})
