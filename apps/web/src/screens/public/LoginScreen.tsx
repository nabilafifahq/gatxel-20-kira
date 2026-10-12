'use client'

import { useRef, useState, type FormEvent } from 'react'
import type { LoginScreenProps } from '@/lib/dto'
import { Button } from '@/components/console/Button'
import { TextField } from '@/components/console/Field'
import { InlineAlert } from '@/components/console/Feedback'
import { ConsoleIcon } from '@/components/console/icons'
import { PasswordField } from '@/components/console/PasswordField'
import { useAction } from '@/components/console/useAction'
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
    body: 'Terlalu banyak percobaan password yang salah. Link untuk membuka kunci lebih cepat sudah dikirim ke email akun ini. Passkey tetap bisa dipakai.',
  },
  'reset-done': { tone: 'success', title: 'Password baru tersimpan.', body: 'Masuk dengan password baru.' },
  'signed-out': { tone: 'info', title: 'Sudah keluar dari Kira.', body: 'Masuk lagi kapan saja dengan email dan password.' },
  'session-expired': { tone: 'warn', title: 'Sesi berakhir.', body: 'Sesi berakhir karena lama tidak dipakai. Masuk lagi untuk melanjutkan.' },
  'invite-accepted': { tone: 'success', title: 'Akun sudah dibuat.', body: 'Masuk dengan email dan password yang baru dibuat.' },
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

function go(url: string) {
  window.location.assign(url)
}

export function LoginScreen(props: LoginScreenProps) {
  const [mode, setMode] = useState<'login' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  return (
    <PublicFrame>
      {mode === 'login' ? (
        <LoginForm {...props} email={email} setEmail={setEmail} onForgot={() => setMode('forgot')} />
      ) : (
        <ForgotForm requestReset={props.requestReset} email={email} setEmail={setEmail} onBack={() => setMode('login')} />
      )}
    </PublicFrame>
  )
}

function LoginForm({
  next,
  notice,
  passwordLogin,
  passkeyLogin,
  passkeySupported,
  email,
  setEmail,
  onForgot,
}: LoginScreenProps & { email: string; setEmail: (v: string) => void; onForgot: () => void }) {
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const login = useAction(passwordLogin)
  const passkey = useAction(passkeyLogin)
  const alertRef = useRef<HTMLDivElement>(null)
  const n = notice ? NOTICE[notice] : null

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
    const r = await login.run({ email: em, password, next })
    if (r.ok) go(r.data.redirectTo)
    else window.setTimeout(() => alertRef.current?.focus(), 0)
  }

  async function withPasskey() {
    login.reset()
    const r = await passkey.run(next)
    if (r.ok) go(r.data.redirectTo)
    else window.setTimeout(() => alertRef.current?.focus(), 0)
  }

  const failure = login.error ?? passkey.error

  return (
    <AuthCard labelledBy="masuk-judul">
      <div className="flex flex-col gap-1">
        <h1 id="masuk-judul" className="m-0 text-h1 font-bold max-sm:text-h2">
          Masuk
        </h1>
        <p className="m-0 text-body text-fg-muted">Untuk tutor dan orang tua. Anak masuk dengan PIN gambar di tablet.</p>
      </div>
      {n ? (
        <InlineAlert tone={n.tone} title={n.title} live={n.tone === 'danger' ? 'alert' : 'status'}>
          {n.body}
        </InlineAlert>
      ) : null}
      {failure ? (
        <div ref={alertRef} tabIndex={-1} className="outline-none">
          <InlineAlert tone="danger" title={failure.message} reference={failure.reference}>
            {login.error ? 'Cek email dan password, lalu coba lagi. Lupa password? Pakai tautan di atas kotak password.' : 'Coba lagi, atau masuk dengan email dan password.'}
          </InlineAlert>
        </div>
      ) : null}
      <form noValidate onSubmit={submit} className="flex flex-col gap-5">
        <TextField
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
          id="masuk-password"
          name="password"
          label="Password"
          autoComplete="current-password"
          size="L"
          value={password}
          error={errors.password}
          labelAside={
            <button type="button" onClick={onForgot} className="cursor-pointer border-0 bg-transparent p-0 text-small font-semibold text-accent underline underline-offset-3 hover:text-fg">
              Lupa password?
            </button>
          }
          onChange={(e) => {
            setPassword(e.target.value)
            if (errors.password) setErrors((x) => ({ ...x, password: undefined }))
          }}
        />
        <Button type="submit" variant="primary" loading={login.pending} className="h-12! w-full">
          Masuk
        </Button>
      </form>
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
  requestReset,
  email,
  setEmail,
  onBack,
}: {
  requestReset: LoginScreenProps['requestReset']
  email: string
  setEmail: (v: string) => void
  onBack: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const send = useAction(requestReset)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const em = email.trim()
    if (!em) return setError('Isi email akun Kira.')
    if (!EMAIL_RE.test(em)) return setError('Tulis alamat email lengkap, dengan @ dan nama domain.')
    setError(null)
    const r = await send.run(em)
    if (r.ok) setSentTo(em)
  }

  return (
    <AuthCard labelledBy="lupa-judul">
      <div className="flex flex-col gap-1">
        <h1 id="lupa-judul" className="m-0 text-h1 font-bold max-sm:text-h2">
          Atur ulang password
        </h1>
        <p className="m-0 text-body text-fg-muted">Tulis email akun. Link untuk membuat password baru dikirim ke email itu.</p>
      </div>
      {sentTo ? (
        <InlineAlert tone="success" title={`Cek email ${sentTo}.`}>
          Bila ada akun Kira dengan email itu, link untuk membuat password baru sudah dikirim. Link hanya bisa dipakai sekali. Cek juga folder spam.
        </InlineAlert>
      ) : (
        <form noValidate onSubmit={submit} className="flex flex-col gap-5">
          <TextField
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
