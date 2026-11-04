import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isSafeAddress, stripHeaderBreaks } from '@kira/core/email'
import { cleanImage } from '@/lib/image-clean'
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_SIZE_MESSAGE,
  ATTACHMENT_TYPE_MESSAGE,
  MESSAGE_MAX,
  MESSAGE_MIN,
  safePagePath,
  SUBJECT_MAX,
  SUBJECT_MIN,
  SUPPORT_CATEGORY_IDS,
} from '@/lib/support'
import { appVersion } from '@/server/app-version'
import { getActor, type Actor } from '@/server/auth/actor'
import { ipHash } from '@/server/auth/crypto'
import { clientIp, emailSendAllowed, throttleIp } from '@/server/auth/ratelimit'
import { turnstileSiteKey, verifyTurnstile } from '@/server/auth/turnstile'
import { createSupportTicket } from '@/server/dal/support'
import { env } from '@/server/env'
import { AppError, invalid, runAction } from '@/server/errors'
import { sameOrigin } from '@/server/http'
import { takeWindow } from '@/server/limiter'
import { log } from '@/server/log'
import { checkEmail } from '@/server/signup/email-policy'
import { newTicketReference, removeSupportFile, safeAttachmentName, sniffAttachment, storeSupportFile } from '@/server/support-file'

export const dynamic = 'force-dynamic'

/** Isi formulir paling besar: lampiran 5 MB ditambah teks dan batas multipart. Ditolak sebelum body dibaca. */
const MAX_REQUEST_BYTES = ATTACHMENT_MAX_BYTES + 64 * 1024

const EMAIL_PROBLEMS = {
  shape: 'Tulis alamat email lengkap, dengan @ dan nama domain.',
  disposable: 'Alamat email sementara belum bisa dipakai. Pakai email yang Anda baca setiap hari, supaya balasan kami sampai.',
  'no-mx': 'Alamat email ini sepertinya belum bisa menerima surat. Periksa penulisannya, atau pakai alamat lain.',
} as const

const fields = z
  .object({
    category: z.enum(SUPPORT_CATEGORY_IDS, { error: 'Pilih salah satu kategori.' }),
    subject: z
      .string({ error: `Tulis subjek, paling sedikit ${SUBJECT_MIN} huruf.` })
      .transform(stripHeaderBreaks)
      .pipe(z.string().min(SUBJECT_MIN, `Tulis subjek, paling sedikit ${SUBJECT_MIN} huruf.`).max(SUBJECT_MAX, `Subjek paling panjang ${SUBJECT_MAX} huruf.`)),
    message: z
      .string({ error: `Ceritakan sedikit lebih lengkap, paling sedikit ${MESSAGE_MIN} huruf.` })
      .transform((m) => m.replace(/\r\n?/g, '\n').replace(/\0/g, '').trim())
      .pipe(z.string().min(MESSAGE_MIN, `Ceritakan sedikit lebih lengkap, paling sedikit ${MESSAGE_MIN} huruf.`).max(MESSAGE_MAX, `Pesan paling panjang ${MESSAGE_MAX} huruf.`)),
    email: z.string().max(254, EMAIL_PROBLEMS.shape).optional(),
    /** Kolom jebakan: tersembunyi dari orang, biasanya diisi robot. */
    website: z.string().max(500).optional(),
    turnstile: z.string().max(2048).optional(),
    screen: z.string().max(20).optional(),
    pageFrom: z.string().max(400).optional(),
  })
  .strict()

/** Kesalahan dengan kode HTTP tertentu. */
class HttpProblem extends AppError {
  constructor(
    readonly status: number,
    message: string,
    fieldErrors?: Record<string, string>,
  ) {
    super('invalid', message, fieldErrors)
  }
}

const attachmentProblem = (status: number, message: string) => new HttpProblem(status, message, { attachment: message })

function statusOf(e: unknown): number {
  if (e instanceof HttpProblem) return e.status
  if (e instanceof z.ZodError) return 422
  if (e instanceof AppError) return e.code === 'forbidden' ? 403 : e.code === 'rate-limited' ? 429 : 422
  return 500
}

async function readAttachment(file: Blob): Promise<{ buf: Buffer; ext: string; mime: string; name: string }> {
  if (file.size > ATTACHMENT_MAX_BYTES) throw attachmentProblem(413, ATTACHMENT_SIZE_MESSAGE)
  const raw = Buffer.from(await file.arrayBuffer())
  const type = sniffAttachment(raw)
  if (!type) throw attachmentProblem(415, ATTACHMENT_TYPE_MESSAGE)
  // Gambar: buang EXIF dan lokasi, dan tolak yang strukturnya rusak, termasuk berkas yang hanya berpura-pura PNG.
  const buf = type.mime.startsWith('image/') ? cleanImage(type.mime, raw) : raw
  if (!buf) throw attachmentProblem(415, ATTACHMENT_TYPE_MESSAGE)
  return { buf, ext: type.ext, mime: type.mime, name: safeAttachmentName(file instanceof File ? file.name : null, type.ext) }
}

async function handle(req: Request, actor: Actor | null, stored: { path: string | null }): Promise<{ reference: string }> {
  if (actor?.role === 'learner') throw new AppError('forbidden', 'Minta bantuan orang tua untuk mengirim pesan ke tim Kira.')
  const account = actor ? { id: actor.userId, role: actor.role as 'tutor' | 'guardian' } : null
  await throttleIp('feedback', 8)
  if (account) await throttleIp('feedback-account', 4, account.id)
  const ip = await clientIp()
  const hash = ipHash(ip)
  if (!(await takeWindow(`feedback-hour:${account ? account.id : hash}`, account ? 15 : 30, 3_600_000))) {
    throw new AppError('rate-limited', 'Terlalu banyak pesan dalam satu jam. Coba lagi nanti, atau chat kami lewat WhatsApp.', undefined, 600)
  }

  // Content-Length wajib dan dibatasi sebelum body dibaca, karena FormData dibaca utuh ke memori.
  const rawLen = req.headers.get('content-length')
  if (rawLen === null || !/^\d+$/.test(rawLen)) throw new HttpProblem(411, 'Permintaan tidak lengkap. Muat ulang halaman lalu coba lagi.')
  if (Number(rawLen) > MAX_REQUEST_BYTES) throw attachmentProblem(413, ATTACHMENT_SIZE_MESSAGE)
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    throw invalid('Isian tidak bisa dibaca. Muat ulang halaman lalu coba lagi.')
  }
  const file = form.get('attachment')
  if (file !== null && !(file instanceof Blob)) throw attachmentProblem(415, ATTACHMENT_TYPE_MESSAGE)
  form.delete('attachment')
  const data = fields.parse(Object.fromEntries(form))

  const reference = newTicketReference()
  // Robot yang mengisi kolom jebakan melihat keberhasilan biasa, dan tidak ada yang disimpan atau dikirim.
  if (data.website?.trim()) {
    log.warn('keamanan: kolom jebakan bantuan terisi', { event: 'honeypot' })
    return { reference }
  }

  if (!actor) await verifyTurnstile(data.turnstile, ip)
  let senderEmail = actor?.email ?? null
  if (!senderEmail) {
    const verdict = await checkEmail(data.email ?? '')
    if (!verdict.ok) throw invalid(EMAIL_PROBLEMS[verdict.reason], { email: EMAIL_PROBLEMS[verdict.reason] })
    senderEmail = verdict.email
  }
  if (!isSafeAddress(senderEmail)) throw invalid(EMAIL_PROBLEMS.shape, { email: EMAIL_PROBLEMS.shape })

  const dataDir = env().KIRA_DATA_DIR
  const upload = file && file.size > 0 ? await readAttachment(file) : null
  if (upload) stored.path = await storeSupportFile(dataDir, upload.buf, upload.ext)

  // Balasan otomatis hanya untuk alamat yang punya bukti: akun yang masuk, atau pengirim yang lolos Turnstile.
  const sendConfirmation = (Boolean(actor) || turnstileSiteKey() !== null) && emailSendAllowed('support-confirm', senderEmail)
  const { mailedTeam } = await createSupportTicket({
    reference,
    category: data.category,
    subject: data.subject,
    message: data.message,
    senderEmail,
    account,
    userAgent: stripHeaderBreaks(req.headers.get('user-agent') ?? '').slice(0, 400),
    screen: /^\d{2,5}x\d{2,5}$/.test(data.screen ?? '') ? data.screen! : '',
    appVersion: appVersion(),
    pageFrom: safePagePath(data.pageFrom),
    ipHash: hash,
    attachment: upload && stored.path ? { path: stored.path, name: upload.name, mime: upload.mime, bytes: upload.buf.length } : null,
    sendConfirmation,
  })
  if (!mailedTeam) {
    log.error('alamat tim dukungan belum diatur: pesan bantuan tersimpan tanpa email', { event: 'support-no-address' })
    if (stored.path) await removeSupportFile(dataDir, stored.path)
  }
  return { reference }
}

/** Terima pesan dari halaman Bantuan. Publik: Turnstile untuk pengirim yang belum masuk. Akun anak ditolak. */
export async function POST(req: Request) {
  const noStore = { 'Cache-Control': 'no-store' }
  if (!sameOrigin(req)) return NextResponse.json({ ok: false, message: 'Permintaan ditolak.', reference: '' }, { status: 403, headers: noStore })
  const actor = await getActor()
  const stored: { path: string | null } = { path: null }
  let status = 500
  let retryAfter: number | undefined
  const r = await runAction('feedback', async () => {
    try {
      return await handle(req, actor, stored)
    } catch (e) {
      status = statusOf(e)
      if (e instanceof AppError) retryAfter = e.retryAfter
      throw e
    }
  })
  if (r.ok) return NextResponse.json(r, { headers: noStore })
  // Berkas sudah tersimpan tetapi pesan gagal dicatat: jangan tinggalkan berkas tanpa pemilik.
  if (stored.path) await removeSupportFile(env().KIRA_DATA_DIR, stored.path).catch(() => log.warn('lampiran bantuan gagal dibuang', {}))
  return NextResponse.json(r, { status, headers: { ...noStore, ...(retryAfter ? { 'Retry-After': String(retryAfter) } : {}) } })
}
