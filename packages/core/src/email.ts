// gtx-allow-hex: email
/**
 * Tata letak tunggal semua email Kira, dipakai web, worker, dan perintah admin. Murni: tanpa Node, database, atau env.
 * HTML memakai tabel dan gaya inline supaya terbaca di Gmail, Outlook, dan Apple Mail. Tanpa font dari luar,
 * tanpa skrip, tanpa piksel pelacak. Logo PNG absolut karena Gmail tidak menampilkan SVG.
 * Warna hanya dari tabel DESIGN.md. Footer ada di dalam kartu putih, jadi tetap terbaca saat latar halaman
 * digelapkan klien email.
 */

const PAGE = '#FFFCF5'
const CARD = '#FFFFFF'
const INK = '#6546A5'
const SOFT = '#E9DDFB'
const ON_INK = '#FFFFFF'
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,'Courier New',monospace"

export const EMAIL_LOGO_URL = 'https://kira.gatxel.com/icons/email-logo.png'
export const EMAIL_LOGO_WIDTH = 120
export const EMAIL_LOGO_HEIGHT = 44
export const EMAIL_CREDIT = 'Build by Gatxel @ 2026 Made with Love by GATteam'
/** Kalimat wajib di email yang dipicu permintaan seseorang. */
export const EMAIL_IGNORE_LINE = 'Kalau bukan Anda, abaikan email ini.'
/** Gmail memotong email di atas sekitar 102 KB. */
export const EMAIL_MAX_BYTES = 100 * 1024

/** Identitas pengirim untuk footer: origin publik, dan alamat pengelola dari KIRA_LEGAL_*. */
export type EmailIdentity = { origin: string; legalName?: string | null; legalAddress?: string | null }

export type EmailBlock =
  | { kind: 'text'; text: string; strong?: boolean }
  | { kind: 'heading'; text: string }
  /** Kotak jelas untuk kode verifikasi atau nomor referensi. */
  | { kind: 'code'; label: string; value: string }
  | { kind: 'facts'; rows: { label: string; value: string }[] }
  | { kind: 'list'; items: { lead?: string; text: string }[] }
  /** Kotak berlatar lembut. Baris baru di isinya dipertahankan. */
  | { kind: 'callout'; title?: string; text: string }
  | { kind: 'link'; label: string; url: string }

export type EmailAction = { label: string; url: string }

export type EmailContent = {
  subject: string
  /** Teks pratinjau di kotak masuk. */
  preheader: string
  heading: string
  blocks: EmailBlock[]
  /** Satu tombol utama. Tautannya juga ditulis sebagai teks. */
  action?: EmailAction
  /** Blok di bawah tombol, misalnya batas waktu. */
  after?: EmailBlock[]
  /** true menambahkan "Kalau bukan Anda, abaikan email ini." */
  ignoreLine?: boolean
  /** Alasan penerima mendapat email ini. */
  why: string
  footerLinks?: { label: string; url: string }[]
}

export type RenderedEmail = { subject: string; html: string; text: string }

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

const CONTROL_CHARS = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f\\u2028\\u2029]+', 'g')

/** Satu baris aman untuk header email: CR, LF, dan karakter kendali lain dibuang, spasi dirapikan. */
export function stripHeaderBreaks(value: string): string {
  return value.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim()
}

const SAFE_ADDRESS = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/

/** Alamat polos (local@domain) tanpa nama tampilan, spasi, atau karakter yang bisa menambah header atau penerima. */
export function isSafeAddress(address: string): boolean {
  return address.length <= 254 && SAFE_ADDRESS.test(address)
}

/** Daftar alamat dipisah koma dari env. Yang tidak sah dan domain .invalid dibuang; duplikat dibuang. */
export function parseAddressList(raw: string | null | undefined): string[] {
  if (!raw) return []
  const out: string[] = []
  for (const part of raw.split(',')) {
    const a = part.trim()
    if (!isSafeAddress(a) || a.toLowerCase().endsWith('.invalid')) continue
    if (!out.some((x) => x.toLowerCase() === a.toLowerCase())) out.push(a)
  }
  return out
}

/** Domain dari nilai SMTP_FROM, misalnya `Kira <noreply@gatxel.com>` menjadi gatxel.com. */
export function mailDomain(from: string | null | undefined): string | null {
  const m = from?.match(/@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\s*>?\s*$/)
  return m ? m[1]!.toLowerCase() : null
}

function logoUrl(origin: string): string {
  return origin.startsWith('https://') ? `${origin.replace(/\/$/, '')}/icons/email-logo.png` : EMAIL_LOGO_URL
}

const base = (extra: string) => `font-family:${FONT};color:${INK};${extra}`
const paragraph = (extra = '') => base(`margin:0 0 14px 0;font-size:16px;line-height:26px;${extra}`)
const multiline = (s: string) => escapeHtml(s).replace(/\r?\n/g, '<br>')
const anchor = (url: string, label: string, extra = '') => `<a href="${escapeHtml(url)}" target="_blank" style="color:${INK};font-weight:700;text-decoration:underline;${extra}">${escapeHtml(label)}</a>`
const table = (attrs: string, inner: string) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" ${attrs}>${inner}</table>`

function blockHtml(b: EmailBlock): string {
  switch (b.kind) {
    case 'text':
      return `<p style="${paragraph(b.strong ? 'font-weight:700;' : '')}">${multiline(b.text)}</p>`
    case 'heading':
      return `<h2 style="${base('margin:22px 0 8px 0;font-size:18px;line-height:26px;font-weight:700;')}">${escapeHtml(b.text)}</h2>`
    case 'code':
      return table(
        'width="100%" style="margin:6px 0 18px 0;border-collapse:separate;"',
        `<tr><td align="center" bgcolor="${SOFT}" style="${base(`background-color:${SOFT};border-radius:12px;padding:16px 12px;`)}"><div style="${base('font-size:13px;line-height:18px;font-weight:700;margin:0 0 4px 0;')}">${escapeHtml(b.label)}</div><div style="font-family:${MONO};color:${INK};font-size:24px;line-height:32px;font-weight:700;letter-spacing:2px;">${escapeHtml(b.value)}</div></td></tr>`,
      )
    case 'facts':
      return table(
        'width="100%" style="margin:0 0 16px 0;border-collapse:collapse;"',
        b.rows
          .map(
            (r) =>
              `<tr><td valign="top" width="34%" style="${base(`padding:8px 10px 8px 0;border-bottom:1px solid ${SOFT};font-size:14px;line-height:21px;font-weight:700;`)}">${escapeHtml(r.label)}</td><td valign="top" style="${base(`padding:8px 0;border-bottom:1px solid ${SOFT};font-size:14px;line-height:21px;word-break:break-word;`)}">${multiline(r.value)}</td></tr>`,
          )
          .join(''),
      )
    case 'list':
      return table(
        'width="100%" style="margin:0 0 14px 0;border-collapse:collapse;"',
        b.items
          .map(
            (it) =>
              `<tr><td valign="top" width="18" style="${base('padding:0 0 8px 0;font-size:16px;line-height:26px;font-weight:700;')}">&#8226;</td><td valign="top" style="${base('padding:0 0 8px 0;font-size:16px;line-height:26px;')}">${it.lead ? `<strong>${escapeHtml(it.lead)}</strong> ` : ''}${multiline(it.text)}</td></tr>`,
          )
          .join(''),
      )
    case 'callout':
      return table(
        'width="100%" style="margin:6px 0 18px 0;border-collapse:separate;"',
        `<tr><td bgcolor="${SOFT}" style="${base(`background-color:${SOFT};border-radius:12px;padding:14px 16px;font-size:16px;line-height:26px;word-break:break-word;`)}">${b.title ? `<strong>${escapeHtml(b.title)}</strong><br>` : ''}${multiline(b.text)}</td></tr>`,
      )
    case 'link':
      return `<p style="${paragraph()}">${anchor(b.url, b.label)}</p>`
  }
}

function blockText(b: EmailBlock): string {
  switch (b.kind) {
    case 'text':
      return b.text
    case 'heading':
      return b.text.toUpperCase()
    case 'code':
      return `${b.label}: ${b.value}`
    case 'facts':
      return b.rows.map((r) => `${r.label}: ${r.value}`).join('\n')
    case 'list':
      return b.items.map((it) => `- ${it.lead ? `${it.lead} ` : ''}${it.text}`).join('\n')
    case 'callout':
      return b.title ? `${b.title}\n${b.text}` : b.text
    case 'link':
      return `${b.label}: ${b.url}`
  }
}

/** Tombol tahan banting: warna ada di sel tabel, jadi Outlook tetap menggambarnya walau mengabaikan padding pada tautan. */
function buttonHtml(action: EmailAction): string {
  const url = escapeHtml(action.url)
  return (
    table(
      'style="margin:10px 0 14px 0;border-collapse:separate;"',
      `<tr><td align="center" bgcolor="${INK}" style="background-color:${INK};border-radius:12px;mso-padding-alt:14px 28px;"><a href="${url}" target="_blank" style="display:inline-block;padding:14px 28px;border-radius:12px;background-color:${INK};color:${ON_INK};font-family:${FONT};font-size:16px;line-height:22px;font-weight:700;text-decoration:none;">${escapeHtml(action.label)}</a></td></tr>`,
    ) +
    `<p style="${base('margin:0 0 18px 0;font-size:14px;line-height:22px;word-break:break-all;')}">Kalau tombol tidak berfungsi, salin tautan ini ke browser Anda:<br>${anchor(action.url, action.url, 'font-weight:400;')}</p>`
  )
}

function footerLinks(c: EmailContent, id: EmailIdentity): { label: string; url: string }[] {
  const origin = id.origin.replace(/\/$/, '')
  return [{ label: 'Bantuan', url: `${origin}/feedback` }, { label: 'Privasi', url: `${origin}/privasi` }, ...(c.footerLinks ?? [])]
}

function addressLine(id: EmailIdentity): string | null {
  const parts = [id.legalName?.trim(), id.legalAddress?.trim()].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

/** Satu-satunya pembuat email Kira. Semua teks masukan di-escape di HTML. */
export function renderEmail(c: EmailContent, id: EmailIdentity): RenderedEmail {
  const subject = stripHeaderBreaks(c.subject)
  const links = footerLinks(c, id)
  const address = addressLine(id)
  const ignore: EmailBlock[] = c.ignoreLine ? [{ kind: 'text', text: EMAIL_IGNORE_LINE }] : []
  const small = base('margin:0 0 8px 0;font-size:13px;line-height:20px;')
  const html =
    '<!doctype html><html lang="id"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="x-apple-disable-message-reformatting">' +
    '<meta name="format-detection" content="telephone=no,date=no,address=no,email=no,url=no">' +
    '<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">' +
    `<title>${escapeHtml(subject)}</title>` +
    '<style>' +
    ':root{color-scheme:light;supported-color-schemes:light}' +
    '@media only screen and (max-width:620px){.kira-pad{padding-left:20px!important;padding-right:20px!important}.kira-outer{padding:12px 8px 20px!important}}' +
    `@media (prefers-color-scheme:dark){.kira-page{background-color:${INK}!important}}` +
    '</style></head>' +
    `<body class="kira-page" style="margin:0;padding:0;background-color:${PAGE};">` +
    `<div style="display:none;max-height:0;max-width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${PAGE};">${escapeHtml(c.preheader)}</div>` +
    table(
      `width="100%" class="kira-page" bgcolor="${PAGE}" style="background-color:${PAGE};border-collapse:collapse;"`,
      `<tr><td align="center" class="kira-outer" style="padding:28px 12px 40px;">` +
        table(
          `width="600" bgcolor="${CARD}" style="width:100%;max-width:600px;background-color:${CARD};border:1px solid ${SOFT};border-radius:16px;border-collapse:separate;"`,
          `<tr><td class="kira-pad" style="padding:24px 36px 16px;border-bottom:1px solid ${SOFT};"><img src="${escapeHtml(logoUrl(id.origin))}" width="${EMAIL_LOGO_WIDTH}" height="${EMAIL_LOGO_HEIGHT}" alt="Kira" style="display:block;width:${EMAIL_LOGO_WIDTH}px;height:${EMAIL_LOGO_HEIGHT}px;border:0;outline:none;text-decoration:none;"></td></tr>` +
            `<tr><td class="kira-pad" style="padding:28px 36px 12px;">` +
            `<h1 style="${base('margin:0 0 14px 0;font-size:24px;line-height:32px;font-weight:700;')}">${escapeHtml(c.heading)}</h1>` +
            c.blocks.map(blockHtml).join('') +
            (c.action ? buttonHtml(c.action) : '') +
            (c.after ?? []).map(blockHtml).join('') +
            ignore.map(blockHtml).join('') +
            `</td></tr>` +
            `<tr><td class="kira-pad" style="padding:18px 36px 24px;border-top:1px solid ${SOFT};">` +
            `<p style="${small}font-weight:700;">${escapeHtml(EMAIL_CREDIT)}</p>` +
            `<p style="${small}">${escapeHtml(c.why)}</p>` +
            `<p style="${small}">${links.map((l) => anchor(l.url, l.label)).join(' &#183; ')}</p>` +
            (address ? `<p style="${base('margin:0;font-size:13px;line-height:20px;')}">${escapeHtml(address)}</p>` : '') +
            `</td></tr>`,
        ) +
        `</td></tr>`,
    ) +
    '</body></html>'

  const sections: string[] = [c.heading, ...c.blocks.map(blockText)]
  if (c.action) sections.push(`${c.action.label}:\n${c.action.url}`)
  sections.push(...(c.after ?? []).map(blockText), ...ignore.map(blockText))
  const footer = ['--', EMAIL_CREDIT, c.why, ...links.map((l) => `${l.label}: ${l.url}`), ...(address ? [address] : [])].join('\n')
  return { subject, html, text: `${sections.join('\n\n')}\n\n${footer}\n` }
}
