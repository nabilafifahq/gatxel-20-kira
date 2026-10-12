'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import type { AcceptInviteScreenProps } from '@/lib/dto'
import { Button, ButtonLink } from '@/components/console/Button'
import { Checkbox, FieldError, TextField } from '@/components/console/Field'
import { InlineAlert } from '@/components/console/Feedback'
import { dateTimeId } from '@/components/console/format'
import { PasswordField, passwordProblem } from '@/components/console/PasswordField'
import { PUBLIC_ROUTES } from '@/components/console/routes'
import { useAction } from '@/components/console/useAction'
import { AuthCard, PublicFrame } from './PublicFrame'

/**
 * Terima undangan tutor atau orang tua. Email terkunci sesuai undangan dan ikut
 * diisi sebagai username supaya pengelola password menyimpan pasangan yang benar.
 */

const ROLE_LABEL = { tutor: 'tutor', guardian: 'orang tua' } as const

function joinNames(ns: string[]): string {
  if (ns.length <= 1) return ns.join('')
  return `${ns.slice(0, -1).join(', ')} dan ${ns[ns.length - 1]}`
}

type Errors = Partial<Record<'name' | 'password' | 'terms', string>>

export function AcceptInviteScreen({ token, invite, acceptInvite }: AcceptInviteScreenProps) {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [terms, setTerms] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const accept = useAction(acceptInvite)

  if (!invite) {
    return (
      <PublicFrame>
        <AuthCard labelledBy="undangan-judul">
          <div className="flex flex-col gap-2">
            <h1 id="undangan-judul" className="m-0 text-h1 font-bold max-sm:text-h2">
              Undangan ini sudah tidak berlaku
            </h1>
            <p className="m-0 text-body">Undangan hanya bisa dipakai sekali dan punya batas waktu. Minta tutor mengirim undangan baru dari Pengaturan di konsol Kira.</p>
          </div>
          <ButtonLink href={PUBLIC_ROUTES.login} variant="secondary" className="h-12! w-full">
            Sudah punya akun? Masuk
          </ButtonLink>
        </AuthCard>
      </PublicFrame>
    )
  }

  const inv = invite
  const clear = (k: keyof Errors) => setErrors((x) => (x[k] ? { ...x, [k]: undefined } : x))

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const next: Errors = {}
    if (!name.trim()) next.name = 'Isi nama lengkap.'
    else if (name.trim().length > 120) next.name = `Nama paling banyak 120 karakter, sekarang ${name.trim().length}.`
    const pp = passwordProblem(password)
    if (pp) next.password = pp
    if (!terms) next.terms = 'Centang persetujuan Syarat dan Ketentuan untuk membuat akun.'
    setErrors(next)
    const first = (['name', 'password', 'terms'] as const).find((k) => next[k])
    if (first) {
      document.getElementById(`undangan-${first}`)?.focus()
      return
    }
    const r = await accept.run({ token, name: name.trim(), password })
    if (r.ok) window.location.assign(r.data.redirectTo)
    else if (r.fieldErrors) setErrors((x) => ({ ...x, ...r.fieldErrors }))
  }

  return (
    <PublicFrame>
      <AuthCard labelledBy="undangan-judul">
        <div className="flex flex-col gap-1">
          <h1 id="undangan-judul" className="m-0 text-h1 font-bold max-sm:text-h2 [overflow-wrap:anywhere]">
            Gabung ke {inv.orgName}
          </h1>
          <p className="m-0 text-body text-fg-muted">
            Undangan sebagai {ROLE_LABEL[inv.role]}
            {inv.learnerNames.length ? ` untuk ${joinNames(inv.learnerNames)}` : ''}. Berlaku sampai {dateTimeId(inv.expiresAt)}.
          </p>
        </div>
        <form method="post" noValidate onSubmit={submit} className="flex flex-col gap-5">
          <TextField
            id="undangan-email"
            name="email"
            label="Email"
            type="email"
            autoComplete="username"
            value={inv.email}
            readOnly
            hint="Email dari undangan. Minta undangan baru bila ingin memakai email lain."
            className="bg-bg!"
          />
          <TextField
            id="undangan-name"
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
          <PasswordField
            id="undangan-password"
            name="new-password"
            label="Password"
            hint="Paling sedikit 15 karakter. Tidak perlu huruf besar, angka, atau simbol."
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
              id="undangan-terms"
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
                  Data pribadi diatur terpisah di <Link href={PUBLIC_ROUTES.privacyNotice}>Kebijakan Privasi</Link>. Persetujuan untuk data anak diminta terpisah setelah
                  akun dibuat.
                </>
              }
            />
            {errors.terms ? <FieldError id="undangan-terms-error">{errors.terms}</FieldError> : null}
          </div>
          {accept.error ? (
            <InlineAlert tone="danger" title={accept.error.message} reference={accept.error.reference}>
              Perbaiki isian yang ditandai, lalu coba lagi.
            </InlineAlert>
          ) : null}
          <Button type="submit" variant="primary" loading={accept.pending} className="h-12! w-full">
            Buat akun
          </Button>
        </form>
      </AuthCard>
    </PublicFrame>
  )
}
