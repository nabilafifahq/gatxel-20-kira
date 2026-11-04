'use client'

import Link from 'next/link'
import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/console/Button'
import { FieldError, focusFirstProblem, RequiredNote, TextField } from '@/components/console/Field'
import { InlineAlert } from '@/components/console/Feedback'
import { PasswordField } from '@/components/console/PasswordField'
import { useAction } from '@/components/console/useAction'
import { SignupConsentChecks } from '@/components/auth/SignupConsentChecks'
import { TurnstileField } from '@/components/auth/TurnstileField'
import { isComplete, signupProblems, type Problems, type SignupField } from '@/lib/required-rules'
import { AuthCard } from '@/screens/public/PublicFrame'
import { resendVerificationAction, signUpAction } from '@/server/actions/signup'

/** Sama dengan RESEND_GAP_MS di server. Di bawah jeda ini server tidak mengirim apa pun. */
const RESEND_WAIT_S = 60
type Errors = Problems<SignupField>

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
  const [marketing, setMarketing] = useState(false)
  const [captcha, setCaptcha] = useState<string | null>(null)
  const [captchaKey, setCaptchaKey] = useState(0)
  const [errors, setErrors] = useState<Errors>({})
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [resent, setResent] = useState(false)
  const [wait, setWait] = useState(0)
  const signup = useAction(signUpAction)
  const resend = useAction(resendVerificationAction)

  const waiting = wait > 0
  useEffect(() => {
    if (!waiting) return
    const t = window.setInterval(() => setWait((s) => Math.max(0, s - 1)), 1000)
    return () => window.clearInterval(t)
  }, [waiting])

  const problems = signupProblems({ name, email, password, consent, captchaNeeded: Boolean(turnstileSiteKey) && !captcha })
  const incomplete = !isComplete(problems)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const em = email.trim()
    setErrors(problems)
    if (incomplete) {
      focusFirstProblem(form)
      return
    }
    const r = await signup.run({ name: name.trim(), email: em, password, consent, marketing, ...(captcha ? { turnstile: captcha } : {}) })
    if (r.ok) {
      setSentTo(em)
      setPassword('')
      setResent(false)
      setWait(RESEND_WAIT_S)
      setCaptchaKey((k) => k + 1)
    } else {
      if (r.fieldErrors) {
        setErrors({ name: r.fieldErrors.name, email: r.fieldErrors.email, password: r.fieldErrors.password, consent: r.fieldErrors.consent })
        focusFirstProblem(form)
      }
      setCaptchaKey((k) => k + 1)
    }
  }

  if (sentTo) {
    return (
      <AuthCard labelledBy="daftar-cek" bare={bare}>
        <H id="daftar-cek" className="m-0 text-h1 font-bold max-sm:text-h2">
          Cek email Anda
        </H>
        <p className="m-0 text-body text-fg-muted">
          Kami mengirim tombol konfirmasi ke <strong className="text-fg">{sentTo}</strong>. Tekan tombol itu, lalu keluarga Kira Anda langsung dibuat. Tautan berlaku 24 jam. Cek juga folder spam.
        </p>
        {resent ? (
          <InlineAlert tone="success" title="Email dikirim ulang." live="status">
            Pakai tautan di email terbaru, karena tautan yang lama sudah tidak berlaku.
          </InlineAlert>
        ) : null}
        <TurnstileField siteKey={turnstileSiteKey} onToken={setCaptcha} resetKey={captchaKey} />
        <Button
          variant="secondary"
          loading={resend.pending}
          disabled={waiting || (Boolean(turnstileSiteKey) && !captcha)}
          onClick={async () => {
            const r = await resend.run({ email: sentTo, ...(captcha ? { turnstile: captcha } : {}) })
            setCaptchaKey((k) => k + 1)
            if (r.ok) {
              setResent(true)
              setWait(RESEND_WAIT_S)
            }
          }}
        >
          {waiting ? `Kirim ulang dalam ${wait} detik` : 'Kirim ulang email'}
        </Button>
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
          {bare ? 'Untuk orang tua. Setelah email dikonfirmasi, Anda menambahkan anak dan bisa mulai hari ini.' : `Untuk orang tua. Tersisa ${seatsLeft} kursi. Setelah email dikonfirmasi, Anda menambahkan anak sendiri dan bisa mulai belajar di hari yang sama.`}
        </p>
        <RequiredNote className="mt-1" />
      </div>
      <form method="post" noValidate onSubmit={submit} className="flex flex-col gap-5">
        <TextField
          name="name"
          required
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
          required
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
          required
          label="Password"
          autoComplete="new-password"
          size="L"
          value={password}
          error={errors.password}
          checklist
          onChange={(e) => {
            setPassword(e.target.value)
            if (errors.password) setErrors((x) => ({ ...x, password: undefined }))
          }}
        />
        <SignupConsentChecks
          consent={consent}
          marketing={marketing}
          consentError={errors.consent}
          onConsentChange={(checked) => {
            setConsent(checked)
            if (errors.consent) setErrors((x) => ({ ...x, consent: undefined }))
          }}
          onMarketingChange={setMarketing}
        />
        <div tabIndex={errors.captcha ? -1 : undefined} data-problem={errors.captcha ? 'true' : undefined} className="flex flex-col gap-1">
          <TurnstileField
            siteKey={turnstileSiteKey}
            onToken={(t) => {
              setCaptcha(t)
              if (t && errors.captcha) setErrors((x) => ({ ...x, captcha: undefined }))
            }}
            resetKey={captchaKey}
          />
          {errors.captcha ? <FieldError id="daftar-captcha-error">{errors.captcha}</FieldError> : null}
        </div>
        {signup.error && !signup.error.fieldErrors ? (
          <InlineAlert tone="danger" title={signup.error.message} reference={signup.error.reference}>
            Coba lagi dalam beberapa menit.
          </InlineAlert>
        ) : null}
        <Button type="submit" variant="primary" loading={signup.pending} incomplete={incomplete} className="h-12! w-full">
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
