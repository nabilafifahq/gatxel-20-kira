'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/console/Button'
import { focusFirstProblem, RequiredNote, TextField } from '@/components/console/Field'
import { InlineAlert } from '@/components/console/Feedback'
import { PasswordField } from '@/components/console/PasswordField'
import { useAction } from '@/components/console/useAction'
import { AuthCard } from '@/screens/public/PublicFrame'
import { SignupConsentChecks } from '@/components/auth/SignupConsentChecks'
import { WaitlistFull } from '@/components/auth/WaitlistFull'
import { isComplete, replacementProblems, type Problems, type ReplacementField } from '@/lib/required-rules'
import { verifySignupAction } from '@/server/actions/signup'

/**
 * Konfirmasi email. Browser langsung mengonfirmasi setelah halaman terbuka, lalu masuk ke langkah tambah anak.
 * Token dipakai lewat Server Action, jadi pemindai email dan pratinjau tautan tanpa JavaScript tidak memakainya.
 * Bila ada pendaftaran lain dengan password berbeda, akun baru aktif setelah pemegang tautan mengisi nama, password baru,
 * dan persetujuannya sendiri. Semua kolom mulai kosong, karena isian yang tersimpan bisa berasal dari orang lain.
 */
export function VerifyClient({ token, valid, needsPassword }: { token: string; valid: boolean; needsPassword: boolean }) {
  const verify = useAction(verifySignupAction)
  const [outcome, setOutcome] = useState<'full' | 'invalid' | 'taken' | null>(valid ? null : 'invalid')
  const [askPassword, setAskPassword] = useState(needsPassword)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [consent, setConsent] = useState(false)
  const [marketing, setMarketing] = useState(false)
  const [errors, setErrors] = useState<Problems<ReplacementField>>({})
  const form = useRef<HTMLFormElement>(null)
  const started = useRef(false)

  const problems = replacementProblems({ name, password, consent })
  const incomplete = !isComplete(problems)

  async function confirm(replacement?: { name: string; password: string; consent: boolean; marketing: boolean }) {
    const r = await verify.run({ token, ...replacement })
    if (!r.ok) {
      if (r.fieldErrors) {
        setErrors({ name: r.fieldErrors.name, password: r.fieldErrors.password, consent: r.fieldErrors.consent })
        focusFirstProblem(form.current)
      }
      return
    }
    if (r.data.status === 'ok') window.location.assign(r.data.redirectTo)
    else if (r.data.status === 'needs-password') setAskPassword(true)
    else setOutcome(r.data.status)
  }

  useEffect(() => {
    if (!valid || needsPassword || started.current) return
    started.current = true
    void confirm()
  }, [])

  async function submitReplacement(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrors(problems)
    if (incomplete) {
      focusFirstProblem(e.currentTarget)
      return
    }
    await confirm({ name: name.trim(), password, consent, marketing })
  }

  if (outcome === 'full') return <WaitlistFull />
  if (outcome === 'taken') {
    return (
      <AuthCard labelledBy="vf-judul">
        <h1 id="vf-judul" className="m-0 text-h1 font-bold max-sm:text-h2">
          Email ini sudah punya akun
        </h1>
        <p className="m-0 text-body text-fg-muted">Masuk dengan email dan password yang Anda buat. Lupa password? Pakai Lupa password di halaman masuk.</p>
        <Link href="/masuk" className="font-bold">
          Ke halaman masuk
        </Link>
      </AuthCard>
    )
  }
  if (outcome === 'invalid') {
    return (
      <AuthCard labelledBy="vf-judul">
        <h1 id="vf-judul" className="m-0 text-h1 font-bold max-sm:text-h2">
          Tautan ini sudah tidak berlaku
        </h1>
        <p className="m-0 text-body text-fg-muted">Tautan konfirmasi berlaku 24 jam dan hanya bisa dipakai sekali. Daftar lagi atau masuk bila akun Anda sudah dibuat. Pendaftaran yang tidak dikonfirmasi dalam 24 jam dihapus otomatis.</p>
        <div className="flex flex-wrap gap-4">
          <Link href="/daftar" className="font-bold">
            Daftar lagi
          </Link>
          <Link href="/masuk" className="font-bold">
            Masuk
          </Link>
        </div>
      </AuthCard>
    )
  }
  if (askPassword) {
    return (
      <AuthCard labelledBy="vf-judul">
        <div className="flex flex-col gap-1">
          <h1 id="vf-judul" className="m-0 text-h1 font-bold max-sm:text-h2">
            Buat password baru
          </h1>
          <p className="m-0 text-body text-fg-muted">Ada lebih dari satu pendaftaran dengan email ini, jadi isian saat mendaftar tidak dipakai. Isi nama Anda, buat password baru, dan setujui ketentuan untuk mengaktifkan akun.</p>
          <RequiredNote className="mt-1" />
        </div>
        <form ref={form} method="post" noValidate onSubmit={submitReplacement} className="flex flex-col gap-5">
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
          <PasswordField
            name="new-password"
            required
            label="Password baru"
            checklist
            autoComplete="new-password"
            size="L"
            value={password}
            error={errors.password}
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
          {verify.error && !verify.error.fieldErrors ? (
            <InlineAlert tone="danger" title={verify.error.message} reference={verify.error.reference}>
              Coba lagi. Bila tautan sudah tidak berlaku, daftar lagi dari halaman depan.
            </InlineAlert>
          ) : null}
          <Button type="submit" variant="primary" loading={verify.pending} incomplete={incomplete} className="h-12! w-full">
            Aktifkan akun
          </Button>
        </form>
      </AuthCard>
    )
  }
  return (
    <AuthCard labelledBy="vf-judul">
      <h1 id="vf-judul" className="m-0 text-h1 font-bold max-sm:text-h2">
        {verify.error ? 'Email belum terkonfirmasi' : 'Mengonfirmasi email Anda'}
      </h1>
      {verify.error ? (
        <>
          <InlineAlert tone="danger" title={verify.error.message} reference={verify.error.reference}>
            Sambungan mungkin terputus. Tekan tombol di bawah untuk mencoba lagi.
          </InlineAlert>
          <Button type="button" variant="primary" loading={verify.pending} className="h-12! w-full" onClick={() => void confirm()}>
            Konfirmasi email
          </Button>
        </>
      ) : (
        <p role="status" className="m-0 text-body text-fg-muted">
          Sebentar ya. Akun keluarga Anda sedang disiapkan, lalu Anda langsung masuk.
        </p>
      )}
    </AuthCard>
  )
}
