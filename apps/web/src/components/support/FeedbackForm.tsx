'use client'

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { formatDateId, jakartaClock, jakartaDate } from '@kira/core/time'
import { TurnstileField } from '@/components/auth/TurnstileField'
import { Button, ButtonLink, IconButton } from '@/components/console/Button'
import { cx } from '@/components/console/cx'
import { InlineAlert } from '@/components/console/Feedback'
import { OptionalMark, RequiredMark, RequiredNote, TextArea, TextField } from '@/components/console/Field'
import { ConsoleIcon } from '@/components/console/icons'
import type { ActionResult } from '@/lib/dto'
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_SIZE_MESSAGE,
  ATTACHMENT_TYPE_MESSAGE,
  MESSAGE_MAX,
  MESSAGE_MIN,
  roleLabel,
  safePagePath,
  SUBJECT_MAX,
  SUBJECT_MIN,
  SUPPORT_CATEGORIES,
  WHATSAPP_HELP_URL,
  type SupportCategoryId,
} from '@/lib/support'

export type FeedbackViewer = { accountId: string; role: 'tutor' | 'guardian'; email: string | null; homeHref: string }

type Errors = { category?: string; subject?: string; message?: string; email?: string; attachment?: string }

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const FILE_RE = /\.(png|jpe?g|pdf|mp4)$/i

const kb = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`)

/** Formulir Bantuan bergaya daftar pengaturan iPhone: satu kolom, baris besar, dan semua yang ikut terkirim terlihat. */
export function FeedbackForm({ viewer, turnstileSiteKey, appVersion, fromPath }: { viewer: FeedbackViewer | null; turnstileSiteKey: string | null; appVersion: string; fromPath: string }) {
  const [category, setCategory] = useState<SupportCategoryId | null>(null)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [errors, setErrors] = useState<Errors>({})
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<{ message: string; reference: string } | null>(null)
  const [done, setDone] = useState<{ reference: string; email: string | null } | null>(null)
  const [captcha, setCaptcha] = useState<string | null>(null)
  const [captchaKey, setCaptchaKey] = useState(0)
  const [meta, setMeta] = useState({ userAgent: '', screen: '', when: '', from: fromPath })
  const doneHeading = useRef<HTMLHeadingElement>(null)

  // Nilai ini hanya ada di browser. Waktu kirim yang sah dihitung ulang di server.
  useEffect(() => {
    const now = new Date()
    let from = fromPath
    if (!from && document.referrer) {
      try {
        const ref = new URL(document.referrer)
        if (ref.origin === window.location.origin) from = safePagePath(ref.pathname)
      } catch {
        from = ''
      }
    }
    setMeta({ userAgent: navigator.userAgent, screen: `${window.screen.width}x${window.screen.height}`, when: `${formatDateId(jakartaDate(now))}, ${jakartaClock(now)} WIB`, from })
  }, [fromPath])

  useEffect(() => {
    if (done) doneHeading.current?.focus()
  }, [done])

  const clear = (key: keyof Errors) => setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e))

  function chooseFile(e: ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0] ?? null
    e.target.value = ''
    if (!chosen) return
    if (!FILE_RE.test(chosen.name)) {
      setFile(null)
      setErrors((x) => ({ ...x, attachment: ATTACHMENT_TYPE_MESSAGE }))
      return
    }
    if (chosen.size > ATTACHMENT_MAX_BYTES) {
      setFile(null)
      setErrors((x) => ({ ...x, attachment: ATTACHMENT_SIZE_MESSAGE }))
      return
    }
    setFile(chosen)
    clear('attachment')
  }

  function validate(): Errors {
    const next: Errors = {}
    if (!category) next.category = 'Pilih salah satu kategori.'
    if (subject.trim().length < SUBJECT_MIN) next.subject = `Tulis subjek, paling sedikit ${SUBJECT_MIN} huruf.`
    if (message.trim().length < MESSAGE_MIN) next.message = `Ceritakan sedikit lebih lengkap, paling sedikit ${MESSAGE_MIN} huruf.`
    if (!viewer?.email) {
      if (!email.trim()) next.email = 'Isi email Anda supaya kami bisa membalas.'
      else if (!EMAIL_RE.test(email.trim())) next.email = 'Tulis alamat email lengkap, dengan @ dan nama domain.'
    }
    return next
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (pending) return
    setFailure(null)
    // Berkas yang ditolak server tetap menahan pengiriman sampai diganti atau dihapus. Pilihan yang ditolak di browser tidak ikut terkirim.
    const problems = { ...validate(), ...(file && errors.attachment ? { attachment: errors.attachment } : {}) }
    setErrors(problems)
    const first = Object.keys(problems).find((k) => problems[k as keyof Errors])
    if (first) {
      const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      document.querySelector<HTMLElement>(`[data-field="${first}"]`)?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' })
      return
    }
    if (turnstileSiteKey && !captcha) {
      setFailure({ message: 'Selesaikan pemeriksaan keamanan di bawah dulu.', reference: '' })
      return
    }
    const body = new FormData()
    body.set('category', category!)
    body.set('subject', subject)
    body.set('message', message)
    if (!viewer?.email) body.set('email', email.trim())
    if (website) body.set('website', website)
    if (meta.screen) body.set('screen', meta.screen)
    if (meta.from) body.set('pageFrom', meta.from)
    if (captcha) body.set('turnstile', captcha)
    if (file) body.set('attachment', file)
    setPending(true)
    try {
      const res = await fetch('/api/feedback', { method: 'POST', body })
      const r = (await res.json()) as ActionResult<{ reference: string }>
      if (r.ok) {
        setDone({ reference: r.data.reference, email: viewer?.email ?? email.trim() })
        return
      }
      setCaptchaKey((k) => k + 1)
      if (r.fieldErrors && Object.keys(r.fieldErrors).length) setErrors(r.fieldErrors as Errors)
      setFailure({ message: r.message, reference: r.reference })
    } catch {
      setCaptchaKey((k) => k + 1)
      setFailure({ message: 'Koneksi ke server Kira terputus.', reference: '' })
    } finally {
      setPending(false)
    }
  }

  function again() {
    setDone(null)
    setCategory(null)
    setSubject('')
    setMessage('')
    setFile(null)
    setErrors({})
    setCaptchaKey((k) => k + 1)
  }

  const metaLine = useMemo(() => {
    const parts = [`browser ${meta.userAgent || 'sedang dibaca'}`, `layar ${meta.screen || 'sedang dibaca'}`, `versi aplikasi ${appVersion}`, `waktu ${meta.when || 'saat dikirim'}`, `halaman asal ${meta.from || 'tidak diketahui'}`]
    if (viewer) parts.push(`akun ${viewer.accountId} (${roleLabel(viewer.role)})`)
    return parts.join(', ')
  }, [meta, appVersion, viewer])

  if (done) {
    return (
      <section aria-labelledby="terkirim" className="flex flex-col items-center gap-4 rounded-card bg-surface p-8 text-center shadow-soft motion-safe:animate-[kira-fade-in_200ms_var(--ease-kira)] max-sm:p-5">
        <span className="inline-flex size-16 items-center justify-center rounded-pill bg-lavender">
          <ConsoleIcon name="check" size={32} strokeWidth={3} />
        </span>
        <h2 id="terkirim" ref={doneHeading} tabIndex={-1} className="m-0 font-display text-h2 font-semibold outline-none">
          Pesan Anda sudah kami terima
        </h2>
        <div className="flex w-full flex-col gap-1 rounded-control bg-lavender px-4 py-3">
          <span className="text-small font-bold">Nomor referensi</span>
          <span className="font-numbers text-h2 font-bold select-all" data-testid="nomor-referensi">
            {done.reference}
          </span>
        </div>
        <p className="m-0 text-body">Kami membalas ke {done.email} secepatnya, biasanya dalam 3 hari kerja. Simpan nomor ini bila Anda menghubungi kami lagi.</p>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={again} icon="plus">
            Kirim pesan lain
          </Button>
          {viewer ? <ButtonLink href={viewer.homeHref}>Kembali ke Kira</ButtonLink> : <ButtonLink href="/">Kembali ke beranda</ButtonLink>}
        </div>
      </section>
    )
  }

  return (
    <form method="post" noValidate onSubmit={submit} aria-label="Kirim pesan ke tim Kira" className="flex flex-col gap-5 rounded-card bg-surface p-6 shadow-soft max-sm:p-4">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 font-display text-h3 font-semibold">Kirim lewat email</h2>
        <p className="m-0 text-small text-fg-muted">Balasan kami masuk ke kotak masuk Anda.</p>
      </div>
      <RequiredNote />

      <fieldset data-field="category" className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-2 p-0 text-small font-bold">
          Tentang apa pesan Anda?
          <RequiredMark />
        </legend>
        <div className="flex flex-col overflow-hidden rounded-control border-2 border-lavender">
          {SUPPORT_CATEGORIES.map((c, i) => {
            const on = category === c.id
            return (
              <label
                key={c.id}
                className={cx(
                  'flex min-h-[52px] cursor-pointer items-center gap-3 px-4 py-2 transition-colors duration-150 ease-kira motion-reduce:transition-none',
                  i > 0 && 'border-t-2 border-lavender',
                  on ? 'bg-lavender font-bold' : 'bg-surface font-semibold hover:bg-lavender/50',
                  'has-focus-visible:outline-3 has-focus-visible:-outline-offset-3 has-focus-visible:outline-fg',
                )}
              >
                <input
                  type="radio"
                  name="category"
                  value={c.id}
                  checked={on}
                  aria-describedby={errors.category ? 'category-error' : undefined}
                  onChange={() => {
                    setCategory(c.id)
                    clear('category')
                  }}
                  className="sr-only"
                />
                <ConsoleIcon name={c.icon} size={22} />
                <span className="min-w-0 flex-1 text-body">{c.label}</span>
                <span aria-hidden="true" className={cx('inline-flex size-6 flex-none items-center justify-center rounded-pill border-2 border-fg', on ? 'bg-fg text-white' : 'bg-surface')}>
                  {on ? <ConsoleIcon name="check" size={14} strokeWidth={3.5} /> : null}
                </span>
              </label>
            )
          })}
        </div>
        {errors.category ? (
          <p id="category-error" className="m-0 text-small font-bold text-danger">
            {errors.category}
          </p>
        ) : null}
      </fieldset>

      <div data-field="subject">
        <TextField
          required
          label="Subjek"
          name="subject"
          value={subject}
          maxLength={SUBJECT_MAX}
          autoComplete="off"
          enterKeyHint="next"
          error={errors.subject}
          className="h-12!"
          onChange={(e) => {
            setSubject(e.target.value)
            clear('subject')
          }}
        />
      </div>

      <div data-field="message">
        <TextArea
          required
          label="Pesan"
          name="message"
          rows={5}
          value={message}
          maxLength={MESSAGE_MAX}
          hint="Tulis apa yang terjadi dan langkah yang Anda lakukan. Hindari nama lengkap atau foto wajah anak."
          labelAside={
            <span className="text-small text-fg-muted tabular" aria-hidden="true">
              {message.length}/{MESSAGE_MAX}
            </span>
          }
          error={errors.message}
          onChange={(e) => {
            setMessage(e.target.value)
            clear('message')
          }}
        />
      </div>

      {viewer?.email ? (
        <div className="flex min-h-12 items-center gap-3 rounded-control bg-lavender px-4 py-2" data-testid="dikirim-sebagai">
          <ConsoleIcon name="lock" size={20} />
          <span className="min-w-0 text-body break-words">
            Dikirim sebagai <strong>{viewer.email}</strong>
          </span>
        </div>
      ) : (
        <div data-field="email">
          <TextField
            required
            label="Email Anda"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={200}
            value={email}
            error={errors.email}
            className="h-12!"
            onChange={(e) => {
              setEmail(e.target.value)
              clear('email')
            }}
          />
        </div>
      )}

      <div data-field="attachment" className="flex flex-col gap-1.5">
        <span className="text-small font-bold" id="lampiran-label">
          Lampiran
          <OptionalMark />
        </span>
        {file ? (
          <div className="flex min-h-14 items-center gap-3 rounded-control border-2 border-lavender px-3 py-2">
            <ConsoleIcon name="paper" size={22} />
            <span className="min-w-0 flex-1 text-body break-words">
              {file.name} <span className="text-small text-fg-muted">({kb(file.size)})</span>
            </span>
            <IconButton
              icon="x"
              label="Hapus lampiran"
              variant="quiet"
              onClick={() => {
                setFile(null)
                clear('attachment')
                setFailure(null)
              }}
            />
          </div>
        ) : (
          <label className={cx('flex min-h-14 cursor-pointer items-center gap-3 rounded-control border-2 border-dashed px-4 py-2 font-semibold transition-colors duration-150 ease-kira hover:bg-lavender/50 motion-reduce:transition-none has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-fg', errors.attachment ? 'border-danger' : 'border-fg')}>
            <input type="file" name="attachment" accept={ATTACHMENT_ACCEPT} aria-labelledby="lampiran-label" onChange={chooseFile} className="sr-only" />
            <ConsoleIcon name="upload" size={22} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span>Pilih berkas</span>
              <span className="text-small font-normal text-fg-muted">PNG, JPG, PDF, atau MP4, sampai 5 MB</span>
            </span>
          </label>
        )}
        {errors.attachment ? (
          <p role="alert" className="m-0 text-small font-bold text-danger">
            {errors.attachment}
          </p>
        ) : null}
      </div>

      {/* Kolom jebakan untuk robot: tidak terlihat, tidak bisa difokus, dan tidak dibacakan. */}
      <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
        <label>
          Situs web
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>

      <TurnstileField siteKey={turnstileSiteKey} onToken={setCaptcha} resetKey={captchaKey} />

      <p className="m-0 text-small text-fg-muted break-words" data-testid="metadata">
        Supaya kami mudah memeriksa, ikut terkirim: {metaLine}.
      </p>

      {failure ? (
        <InlineAlert tone="danger" title={failure.message} reference={failure.reference || null}>
          Pesan belum terkirim dan isian Anda masih ada. Coba lagi, atau{' '}
          <a href={WHATSAPP_HELP_URL} target="_blank" rel="noopener noreferrer" className="font-bold">
            chat lewat WhatsApp
          </a>
          .
        </InlineAlert>
      ) : null}

      <Button type="submit" variant="primary" icon="mail" loading={pending} className="h-14! w-full text-body-lg!">
        Kirim pesan
      </Button>
    </form>
  )
}
