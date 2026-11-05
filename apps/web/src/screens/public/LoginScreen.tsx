'use client'

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { LoginScreenProps } from '@/lib/dto'
import { Button } from '@/components/console/Button'
import { RequiredNote, TextField } from '@/components/console/Field'
import { InlineAlert } from '@/components/console/Feedback'
import { ConsoleIcon } from '@/components/console/icons'
import { PasswordField } from '@/components/console/PasswordField'
import { useAction } from '@/components/console/useAction'
import { TurnstileField } from '@/components/auth/TurnstileField'
import { PUBLIC_ROUTES } from '@/components/console/routes'
import { AuthCard, PublicFrame } from './PublicFrame'

/**
 * P01 Masuk untuk tutor dan orang tua (papan MasukDewasa, MasukDewasaTerkunci).
 * Email dengan autocomplete "username webauthn", password "current-password",
 * tombol Tampilkan, passkey bila perangkat mendukung, dan alur lupa password
 * yang memberi jawaban sama apakah akunnya ada atau tidak.
 */

const NOTICE: Record<NonNullable<LoginScreenProps['notice']>, { tone: 'danger' | 'warn' | 'success' | 'info'; title: string; body: string }> = {
  locked: {
    tone: 'danger',
    title: 'Akun dikunci sementara.',
    body: 'Terlalu banyak percobaan password yang salah. Tunggu 15 menit atau pakai Lupa password. Passkey tetap bisa dipakai.',
  },
  'reset-done': { tone: 'success', title: 'Password baru tersimpan.', body: 'Masuk dengan password baru.' },
  'signed-out': { tone: 'info', title: 'Sudah keluar dari Kira.', body: 'Masuk lagi kapan saja dengan email dan password.' },
  'session-expired': { tone: 'warn', title: 'Sesi berakhir.', body: 'Sesi berakhir karena lama tidak dipakai. Masuk lagi untuk melanjutkan.' },
  'invite-accepted': { tone: 'success', title: 'Akun sudah dibuat.', body: 'Masuk dengan email dan password yang baru dibuat.' },
  'google-failed': { tone: 'danger', title: 'Masuk dengan Google belum berhasil.', body: 'Coba lagi, atau masuk dengan email dan password.' },
  'google-cancelled': { tone: 'info', title: 'Masuk dengan Google dibatalkan.', body: 'Tidak ada yang berubah. Coba lagi kapan saja.' },
  'google-unverified': { tone: 'warn', title: 'Email Google ini belum terverifikasi.', body: 'Verifikasi emailnya di akun Google Anda dulu, atau daftar dengan email dan password.' },
  'google-other-account': { tone: 'warn', title: 'Akun Kira ini sudah tertaut ke akun Google lain.', body: 'Pakai akun Google yang pertama kali ditautkan, atau masuk dengan email dan password.' },
  'google-disabled': { tone: 'warn', title: 'Akun ini sedang tidak aktif.', body: 'Hubungi kami lewat halaman Bantuan bila menurut Anda ini keliru.' },
  'google-not-adult': { tone: 'warn', title: 'Google hanya untuk akun orang tua.', body: 'Anak masuk lewat tombol Masuk sebagai anak.' },
  'google-use-password': { tone: 'warn', title: 'Email ini sudah terdaftar dengan penulisan lain.', body: 'Masuk dengan email dan password akun itu.' },
  'google-disposable': { tone: 'warn', title: 'Alamat email sementara belum bisa dipakai di Kira.', body: 'Pakai akun Google dengan email yang Anda baca setiap hari, supaya kabar tentang akun Anda sampai.' },
  'google-no-mail': { tone: 'warn', title: 'Email akun Google ini belum bisa menerima surat.', body: 'Pakai akun Google lain, atau daftar dengan email dan password.' },
  'google-taken': { tone: 'info', title: 'Email ini sudah punya akun Kira.', body: 'Tekan Lanjutkan dengan Google sekali lagi untuk masuk.' },
  'google-app': { tone: 'info', title: 'Google tidak bisa dibuka di aplikasi ini.', body: 'Masuk dengan email dan password, atau pakai Lupa password untuk membuat password.' },
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

function go(url: string) {
  window.location.assign(url)
}

export type LoginPanelExtras = {
  /** Tanpa kerangka dan kartu: dipakai panel kanan layar masuk. Judul menjadi h2. */
  bare?: boolean
  /** Pindah ke Daftar di halaman yang sama. Tanpa ini, tautan biasa ke /daftar. */
  onSwitchToSignup?: () => void
  /** Email yang dibawa dari form Daftar. */
  sharedEmail?: string
  onEmailChange?: (email: string) => void
  /** Tombol Lanjutkan dengan Google, bila aktif. */
  googleSlot?: ReactNode
}

export function LoginScreen({ bare = false, onSwitchToSignup, sharedEmail = '', onEmailChange, googleSlot, ...props }: LoginScreenProps & LoginPanelExtras) {
  const [mode, setMode] = useState<'login' | 'forgot'>('login')
  const [email, setEmailState] = useState(sharedEmail)
  const setEmail = (v: string) => {
    setEmailState(v)
    onEmailChange?.(v)
  }
  const body =
    mode === 'login' ? (
      <LoginForm {...props} googleSlot={googleSlot} bare={bare} onSwitchToSignup={onSwitchToSignup} email={email} setEmail={setEmail} onForgot={() => setMode('forgot')} />
    ) : (
      <ForgotForm bare={bare} requestReset={props.requestReset} turnstileSiteKey={props.turnstileSiteKey} email={email} setEmail={setEmail} onBack={() => setMode('login')} />
    )
  return bare ? body : <PublicFrame>{body}</PublicFrame>
}

function LoginForm({
  next,
  notice,
  passwordLogin,
  passkeyLogin,
  passkeySupported,
  turnstileSiteKey,
  resendVerification,
  email,
  setEmail,
  onForgot,
  bare = false,
  onSwitchToSignup,
  googleSlot,
}: LoginScreenProps & { email: string; setEmail: (v: string) => void; onForgot: () => void; bare?: boolean; onSwitchToSignup?: () => void; googleSlot?: ReactNode }) {
  const H = bare ? 'h2' : 'h1'
  const [password, setPassword] = useState('')
  const [captcha, setCaptcha] = useState<string | null>(null)
  const [captchaKey, setCaptchaKey] = useState(0)
  const [resent, setResent] = useState(false)
  const resend = useAction(resendVerification ?? (async () => ({ ok: true as const, data: undefined })))
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const login = useAction(passwordLogin)
  const passkey = useAction(passkeyLogin)
  const alertRef = useRef<HTMLDivElement>(null)
  const n = notice ? NOTICE[notice] : null

  // Masuk ditekan saat pemeriksaan keamanan belum selesai: begitu token datang, kirim sendiri tanpa perlu menekan lagi.
  const form = useRef<HTMLFormElement>(null)
  const waitingCaptcha = useRef(false)
  useEffect(() => {
    if (!captcha || !waitingCaptcha.current) return
    waitingCaptcha.current = false
    setErrors({})
    form.current?.requestSubmit()
  }, [captcha])

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const next_: typeof errors = {}
    const em = email.trim()
    if (!em) next_.email = 'Isi email akun Kira.'
    else if (!EMAIL_RE.test(em)) next_.email = 'Tulis alamat email lengkap, dengan @ dan nama domain.'
    if (!password) next_.password = 'Isi password dulu.'
    setErrors(next_)
    if (next_.email || next_.password) {
      document.getElementById(next_.email ? 'masuk-email' : 'masuk-password')?.focus()
      return
    }
    passkey.reset()
    if (turnstileSiteKey && !captcha) {
      waitingCaptcha.current = true
      setErrors({ password: 'Selesaikan pemeriksaan keamanan di bawah dulu.' })
      return
    }
    const r = await login.run({ email: em, password, next, ...(captcha ? { turnstile: captcha } : {}) })
    if (r.ok) go(r.data.redirectTo)
    else {
      setCaptchaKey((k) => k + 1)
      window.setTimeout(() => alertRef.current?.focus(), 0)
    }
  }

  async function withPasskey() {
    login.reset()
    const r = await passkey.run(next)
    if (r.ok) go(r.data.redirectTo)
    else window.setTimeout(() => alertRef.current?.focus(), 0)
  }

  const failure = login.error ?? passkey.error

  return (
    <AuthCard labelledBy="masuk-judul" bare={bare}>
      <div className="flex flex-col gap-1">
        <H id="masuk-judul" className="m-0 text-h1 font-bold max-sm:text-h2">
          Masuk
        </H>
        <p className="m-0 text-body text-fg-muted">Untuk tutor dan orang tua. Anak memakai tombol Masuk sebagai anak.</p>
      </div>
      {n ? (
        <InlineAlert tone={n.tone} title={n.title} live={n.tone === 'danger' ? 'alert' : 'status'}>
          {n.body}
        </InlineAlert>
      ) : null}
      {failure ? (
        <div ref={alertRef} tabIndex={-1} className="outline-none">
          <InlineAlert tone="danger" title={failure.message} reference={login.error ? undefined : failure.reference}>
            {login.error?.fieldErrors?.unverified ? (
              resent ? (
                'Email konfirmasi dikirim ulang. Cek kotak masuk dan folder spam.'
              ) : (
                <Button
                  variant="secondary"
                  loading={resend.pending}
                  onClick={async () => {
                    const r = await resend.run({ email: email.trim(), ...(captcha ? { turnstile: captcha } : {}) })
                    if (r.ok) setResent(true)
                  }}
                >
                  Kirim ulang email konfirmasi
                </Button>
              )
            ) : login.error && /dikunci/.test(login.error.message) ? (
              'Password baru dari Lupa password langsung membuka kunci ini.'
            ) : login.error ? (
              'Cek email dan password, lalu coba lagi. Lupa password? Pakai tautan di atas kotak password.'
            ) : (
              'Coba lagi, atau masuk dengan email dan password.'
            )}
          </InlineAlert>
        </div>
      ) : null}
      {googleSlot}
      <form ref={form} method="post" noValidate onSubmit={submit} className="flex flex-col gap-5">
        <RequiredNote />
        <TextField
          required
          id="masuk-email"
          name="email"
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="username webauthn"
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
          required
          id="masuk-password"
          name="password"
          label="Password"
          autoComplete="current-password"
          size="L"
          value={password}
          error={errors.password}
          labelAside={
            <button type="button" onClick={onForgot} className="-my-3 inline-flex min-h-11 cursor-pointer items-center border-0 bg-transparent p-0 text-small font-semibold text-accent underline underline-offset-3 hover:text-fg">
              Lupa password?
            </button>
          }
          onChange={(e) => {
            setPassword(e.target.value)
            if (errors.password) setErrors((x) => ({ ...x, password: undefined }))
          }}
        />
        <TurnstileField siteKey={turnstileSiteKey} onToken={setCaptcha} resetKey={captchaKey} />
        <Button type="submit" variant="primary" loading={login.pending} className="h-12! w-full">
          Masuk
        </Button>
      </form>
      <p className="m-0 text-body text-fg-muted">
        Belum punya akun?{' '}
        {onSwitchToSignup ? (
          <button type="button" onClick={onSwitchToSignup} className="inline-flex min-h-11 cursor-pointer items-center border-0 bg-transparent p-0 font-bold text-accent underline underline-offset-3">
            Daftar kursi beta
          </button>
        ) : (
          <a href={PUBLIC_ROUTES.signup} className="font-bold">
            Daftar kursi beta
          </a>
        )}
      </p>
      {passkeySupported ? (
        <>
          <div aria-hidden="true" className="flex items-center gap-3 text-small text-fg-muted">
            <span className="h-px flex-1 bg-divider" />
            atau
            <span className="h-px flex-1 bg-divider" />
          </div>
          <Button variant="secondary" icon="key" loading={passkey.pending} onClick={withPasskey} className="h-12! w-full">
            Masuk dengan passkey
          </Button>
        </>
      ) : null}
    </AuthCard>
  )
}

function ForgotForm({
  bare = false,
  requestReset,
  turnstileSiteKey,
  email,
  setEmail,
  onBack,
}: {
  bare?: boolean
  requestReset: LoginScreenProps['requestReset']
  turnstileSiteKey?: string | null
  email: string
  setEmail: (v: string) => void
  onBack: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const send = useAction(requestReset)
  const [captcha, setCaptcha] = useState<string | null>(null)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const em = email.trim()
    if (!em) return setError('Isi email akun Kira.')
    if (!EMAIL_RE.test(em)) return setError('Tulis alamat email lengkap, dengan @ dan nama domain.')
    setError(null)
    if (turnstileSiteKey && !captcha) return setError('Selesaikan pemeriksaan keamanan di bawah dulu.')
    const r = await send.run(em, captcha ?? undefined)
    if (r.ok) setSentTo(em)
  }

  return (
    <AuthCard labelledBy="lupa-judul" bare={bare}>
      <div className="flex flex-col gap-1">
        <h2 id="lupa-judul" className="m-0 text-h1 font-bold max-sm:text-h2">
          Atur ulang password
        </h2>
        <p className="m-0 text-body text-fg-muted">Tulis email akun. Link untuk membuat password baru dikirim ke email itu.</p>
      </div>
      {sentTo ? (
        <InlineAlert tone="success" title={`Cek email ${sentTo}.`}>
          Bila ada akun Kira dengan email itu, link untuk membuat password baru sudah dikirim. Link hanya bisa dipakai sekali. Cek juga folder spam.
        </InlineAlert>
      ) : (
        <form method="post" noValidate onSubmit={submit} className="flex flex-col gap-5">
          <RequiredNote />
          <TextField
            required
            id="lupa-email"
            name="email"
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={email}
            error={error}
            className="h-12!"
            onChange={(e) => {
              setEmail(e.target.value)
              if (error) setError(null)
            }}
          />
          <TurnstileField siteKey={turnstileSiteKey} onToken={setCaptcha} />
          {send.error ? (
            <InlineAlert tone="danger" title={send.error.message} reference={send.error.reference}>
              Coba lagi dalam beberapa menit.
            </InlineAlert>
          ) : null}
          <Button type="submit" variant="primary" loading={send.pending} className="h-12! w-full">
            Kirim link
          </Button>
        </form>
      )}
      <Button variant="quiet" icon="arrowLeft" onClick={onBack} className="self-start">
        Kembali ke Masuk
      </Button>
      <p className="m-0 flex items-start gap-2 text-small text-fg-muted">
        <ConsoleIcon name="infoCircle" size={18} className="mt-0.5 flex-none" />
        <span>Akun dengan passkey bisa masuk tanpa password. Password lama tetap berlaku sampai password baru disimpan.</span>
      </p>
    </AuthCard>
  )
}
