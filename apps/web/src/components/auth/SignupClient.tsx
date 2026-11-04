'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/console/Button'
import { Checkbox, TextField } from '@/components/console/Field'
import { InlineAlert } from '@/components/console/Feedback'
import { PasswordField } from '@/components/console/PasswordField'
import { useAction } from '@/components/console/useAction'
import { TurnstileField } from '@/components/auth/TurnstileField'
import { AuthCard } from '@/screens/public/PublicFrame'
import { resendVerificationAction, signUpAction } from '@/server/actions/signup'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
type Errors = { name?: string; email?: string; password?: string; consent?: string }

/** Pendaftaran orang tua: nama, email, password, persetujuan. Setelah terkirim, layar berganti ke petunjuk cek email. */
export function SignupClient({
  turnstileSiteKey,
  seatsLeft,
  bare = false,
  onSwitchToLogin,
  sharedEmail = '',
  onEmailChange,
}: {
  turnstileSiteKey: string | null
  seatsLeft: number
  /** Tanpa kartu: panel kanan layar masuk. Judul menjadi h2. */
  bare?: boolean
  /** Pindah ke Masuk di halaman yang sama. Tanpa ini, tautan biasa ke /masuk. */
  onSwitchToLogin?: () => void
  /** Email yang dibawa dari form Masuk. */
  sharedEmail?: string
  onEmailChange?: (email: string) => void
}) {
  const H = bare ? 'h2' : 'h1'
  const [name, setName] = useState('')
  const [email, setEmailState] = useState(sharedEmail)
  const setEmail = (v: string) => {
    setEmailState(v)
    onEmailChange?.(v)
  }
  const [password, setPassword] = useState('')
  const [consent, setConsent] = useState(false)
  const [captcha, setCaptcha] = useState<string | null>(null)
  const [captchaKey, setCaptchaKey] = useState(0)
  const [errors, setErrors] = useState<Errors>({})
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [resent, setResent] = useState(false)
  const signup = useAction(signUpAction)
  const resend = useAction(resendVerificationAction)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const em = email.trim()
    const next: Errors = {}
    if (name.trim().length < 2) next.name = 'Tulis nama kamu, paling sedikit 2 huruf.'
    if (!em) next.email = 'Isi email kamu.'
    else if (!EMAIL_RE.test(em)) next.email = 'Tulis alamat email lengkap, dengan @ dan nama domain.'
    const n = [...password].length
    if (n < 15) next.password = `Password paling sedikit 15 karakter. Sekarang ${n} karakter.`
    if (!consent) next.consent = 'Centang persetujuan untuk melanjutkan.'
    setErrors(next)
    if (Object.keys(next).length > 0) return
    if (turnstileSiteKey && !captcha) {
      setErrors({ consent: 'Selesaikan pemeriksaan keamanan di atas dulu.' })
      return
    }
    const r = await signup.run({ name: name.trim(), email: em, password, consent, ...(captcha ? { turnstile: captcha } : {}) })
    if (r.ok) {
      setSentTo(em)
      setPassword('')
    } else {
      if (r.fieldErrors) setErrors({ name: r.fieldErrors.name, email: r.fieldErrors.email, password: r.fieldErrors.password, consent: r.fieldErrors.consent })
      setCaptchaKey((k) => k + 1)
    }
  }

  if (sentTo) {
    return (
      <AuthCard labelledBy="daftar-cek" bare={bare}>
        <H id="daftar-cek" className="m-0 text-h1 font-bold max-sm:text-h2">
          Cek email kamu
        </H>
        <p className="m-0 text-body text-fg-muted">
          Kami mengirim tombol konfirmasi ke <strong className="text-fg">{sentTo}</strong>. Tekan tombol itu, lalu keluarga Kira kamu langsung dibuat. Tautan berlaku 24 jam. Cek juga folder spam.
        </p>
        {resent ? (
          <InlineAlert tone="success" title="Email dikirim ulang." live="status">
            Kalau belum juga sampai dalam beberapa menit, tunggu sebentar lalu coba lagi.
          </InlineAlert>
        ) : (
          <Button
            variant="secondary"
            loading={resend.pending}
            onClick={async () => {
              const r = await resend.run({ email: sentTo, ...(captcha ? { turnstile: captcha } : {}) })
              if (r.ok) setResent(true)
            }}
          >
            Kirim ulang email
          </Button>
        )}
        {resend.error ? (
          <InlineAlert tone="danger" title={resend.error.message} reference={resend.error.reference}>
            Coba lagi dalam beberapa menit.
          </InlineAlert>
        ) : null}
        <p className="m-0 text-small text-fg-muted">
          Salah ketik email?{' '}
          <button type="button" onClick={() => setSentTo(null)} className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-accent underline underline-offset-3">
            Daftar lagi dengan email lain
          </button>
          .
        </p>
      </AuthCard>
    )
  }

  return (
    <AuthCard labelledBy="daftar-judul" bare={bare}>
      <div className="flex flex-col gap-1">
        <H id="daftar-judul" className="m-0 text-h1 font-bold max-sm:text-h2">
          Daftar kursi beta
        </H>
        <p className="m-0 text-body text-fg-muted">
          {bare ? 'Untuk orang tua. Setelah email dikonfirmasi, kamu menambahkan anak dan bisa mulai hari ini.' : `Untuk orang tua. Tersisa ${seatsLeft} kursi. Setelah email dikonfirmasi, kamu menambahkan anak sendiri dan bisa mulai belajar di hari yang sama.`}
        </p>
      </div>
      <form method="post" noValidate onSubmit={submit} className="flex flex-col gap-5">
        <TextField
          name="name"
          label="Nama orang tua"
          autoComplete="name"
          value={name}
          error={errors.name}
          className="h-12!"
          onChange={(e) => {
            setName(e.target.value)
            if (errors.name) setErrors((x) => ({ ...x, name: undefined }))
          }}
        />
        <TextField
          name="email"
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={email}
          error={errors.email}
          className="h-12!"
          onChange={(e) => {
            setEmail(e.target.value)
            if (errors.email) setErrors((x) => ({ ...x, email: undefined }))
          }}
        />
        <PasswordField
          name="password"
          label="Password"
          autoComplete="new-password"
          size="L"
          value={password}
          error={errors.password}
          hint="Paling sedikit 15 karakter. Kalimat panjang yang mudah diingat paling baik."
          onChange={(e) => {
            setPassword(e.target.value)
            if (errors.password) setErrors((x) => ({ ...x, password: undefined }))
          }}
        />
        <div className="flex flex-col gap-1">
          <Checkbox
            name="consent"
            checked={consent}
            onChange={(e) => {
              setConsent(e.target.checked)
              if (errors.consent) setErrors((x) => ({ ...x, consent: undefined }))
            }}
            label={
              <>
                Saya setuju dengan{' '}
                <Link href="/ketentuan" target="_blank" className="underline underline-offset-3">
                  Syarat dan Ketentuan
                </Link>{' '}
                dan sudah membaca{' '}
                <Link href="/privasi" target="_blank" className="underline underline-offset-3">
                  Kebijakan Privasi
                </Link>
              </>
            }
          />
          {errors.consent ? <p className="m-0 text-small font-bold text-danger">{errors.consent}</p> : null}
        </div>
        <TurnstileField siteKey={turnstileSiteKey} onToken={setCaptcha} resetKey={captchaKey} />
        {signup.error && !signup.error.fieldErrors ? (
          <InlineAlert tone="danger" title={signup.error.message} reference={signup.error.reference}>
            Coba lagi dalam beberapa menit.
          </InlineAlert>
        ) : null}
        <Button type="submit" variant="primary" loading={signup.pending} className="h-12! w-full">
          Daftar
        </Button>
      </form>
      <p className="m-0 text-body text-fg-muted">
        Sudah punya akun?{' '}
        {onSwitchToLogin ? (
          <button type="button" onClick={onSwitchToLogin} className="cursor-pointer border-0 bg-transparent p-0 font-bold text-accent underline underline-offset-3">
            Masuk
          </button>
        ) : (
          <Link href="/masuk" className="font-bold">
            Masuk
          </Link>
        )}
      </p>
    </AuthCard>
  )
}
