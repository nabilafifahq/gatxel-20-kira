'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import type { SetupScreenProps } from '@/lib/dto'
import { Button } from '@/components/console/Button'
import { Checkbox, FieldError, TextField } from '@/components/console/Field'
import { InlineAlert } from '@/components/console/Feedback'
import { PasswordField, passwordProblem } from '@/components/console/PasswordField'
import { PUBLIC_ROUTES } from '@/components/console/routes'
import { useAction } from '@/components/console/useAction'
import { AuthCard, PublicFrame } from './PublicFrame'

/**
 * Setup pertama server Kira: membuat akun keluarga dan akun tutor pemilik.
 * Kode setup sekali pakai mencegah orang lain di jaringan yang sama mengambil alih
 * server yang baru dipasang. Password mengikuti NIST: paling sedikit 15 karakter,
 * tanpa aturan komposisi, paste boleh.
 */

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

type Errors = Partial<Record<'setupToken' | 'orgName' | 'name' | 'email' | 'password' | 'terms', string>>

export function SetupScreen({ createOrg }: SetupScreenProps) {
  const [setupToken, setSetupToken] = useState('')
  const [orgName, setOrgName] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [terms, setTerms] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const create = useAction(createOrg)

  const clear = (k: keyof Errors) => setErrors((x) => (x[k] ? { ...x, [k]: undefined } : x))

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const next: Errors = {}
    if (!setupToken.trim()) next.setupToken = 'Isi kode setup dari pemasangan server.'
    if (!orgName.trim()) next.orgName = 'Isi nama akun keluarga, misalnya Keluarga Wiratama.'
    else if (orgName.trim().length > 60) next.orgName = `Nama akun keluarga paling banyak 60 karakter, sekarang ${orgName.trim().length}.`
    if (!name.trim()) next.name = 'Isi nama lengkap pemilik akun.'
    else if (name.trim().length > 120) next.name = `Nama paling banyak 120 karakter, sekarang ${name.trim().length}.`
    if (!email.trim()) next.email = 'Isi email pemilik akun.'
    else if (!EMAIL_RE.test(email.trim())) next.email = 'Tulis alamat email lengkap, dengan @ dan nama domain.'
    const pp = passwordProblem(password)
    if (pp) next.password = pp
    if (!terms) next.terms = 'Centang persetujuan Syarat dan Ketentuan untuk membuat akun.'
    setErrors(next)
    const first = (['setupToken', 'orgName', 'name', 'email', 'password', 'terms'] as const).find((k) => next[k])
    if (first) {
      document.getElementById(`setup-${first}`)?.focus()
      return
    }
    const r = await create.run({ setupToken: setupToken.trim(), orgName: orgName.trim(), name: name.trim(), email: email.trim(), password })
    if (r.ok) window.location.assign(r.data.redirectTo)
    else if (r.fieldErrors) setErrors((x) => ({ ...x, ...r.fieldErrors }))
  }

  return (
    <PublicFrame>
      <AuthCard labelledBy="setup-judul">
        <div className="flex flex-col gap-1">
          <h1 id="setup-judul" className="m-0 text-h1 font-bold max-sm:text-h2">
            Siapkan Kira
          </h1>
          <p className="m-0 text-body text-fg-muted">Buat akun keluarga dan akun tutor pertama. Akun ini menjadi pemilik server dan bisa menambah learner.</p>
        </div>
        <form method="post" noValidate onSubmit={submit} className="flex flex-col gap-5">
          <TextField
            id="setup-setupToken"
            name="setup-token"
            label="Kode setup"
            hint="Kode sekali pakai dari pemasangan server Kira."
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={setupToken}
            error={errors.setupToken}
            onChange={(e) => {
              setSetupToken(e.target.value)
              clear('setupToken')
            }}
          />
          <TextField
            id="setup-orgName"
            name="organization"
            label="Nama akun keluarga"
            hint="Terlihat di konsol, laporan, dan email ke orang tua."
            autoComplete="organization"
            value={orgName}
            error={errors.orgName}
            onChange={(e) => {
              setOrgName(e.target.value)
              clear('orgName')
            }}
          />
          <TextField
            id="setup-name"
            name="name"
            label="Nama lengkap"
            autoComplete="name"
            value={name}
            error={errors.name}
            onChange={(e) => {
              setName(e.target.value)
              clear('name')
            }}
          />
          <TextField
            id="setup-email"
            name="email"
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={email}
            error={errors.email}
            onChange={(e) => {
              setEmail(e.target.value)
              clear('email')
            }}
          />
          <PasswordField
            id="setup-password"
            name="new-password"
            label="Password"
            hint="Paling sedikit 15 karakter. Tidak perlu huruf besar, angka, atau simbol. Kalimat pendek yang mudah diingat juga boleh."
            autoComplete="new-password"
            value={password}
            error={errors.password}
            onChange={(e) => {
              setPassword(e.target.value)
              clear('password')
            }}
          />
          <div className="flex flex-col gap-1.5">
            <Checkbox
              id="setup-terms"
              checked={terms}
              aria-invalid={errors.terms ? true : undefined}
              onChange={(e) => {
                setTerms(e.target.checked)
                clear('terms')
              }}
              label={
                <>
                  Saya sudah membaca dan menyetujui <Link href={PUBLIC_ROUTES.terms}>Syarat dan Ketentuan</Link>.
                </>
              }
              description={
                <>
                  Data pribadi diatur terpisah di <Link href={PUBLIC_ROUTES.privacyNotice}>Kebijakan Privasi</Link>.
                </>
              }
            />
            {errors.terms ? <FieldError id="setup-terms-error">{errors.terms}</FieldError> : null}
          </div>
          {create.error ? (
            <InlineAlert tone="danger" title={create.error.message} reference={create.error.reference}>
              Perbaiki isian yang ditandai, lalu coba lagi.
            </InlineAlert>
          ) : null}
          <Button type="submit" variant="primary" loading={create.pending} className="h-12! w-full">
            Buat akun keluarga
          </Button>
        </form>
      </AuthCard>
    </PublicFrame>
  )
}
