'use client'

import { useState, type FormEvent } from 'react'
import type { ResetPasswordScreenProps } from '@/lib/dto'
import { Button, ButtonLink } from '@/components/console/Button'
import { InlineAlert } from '@/components/console/Feedback'
import { PasswordField, passwordProblem } from '@/components/console/PasswordField'
import { PUBLIC_ROUTES } from '@/components/console/routes'
import { useAction } from '@/components/console/useAction'
import { AuthCard, PublicFrame } from './PublicFrame'

/**
 * Buat password baru dari link email. Link yang sudah dipakai atau kedaluwarsa
 * menampilkan jalan keluar ke halaman Masuk untuk meminta link baru.
 */
export function ResetPasswordScreen({ token, valid, resetPassword }: ResetPasswordScreenProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const save = useAction(resetPassword)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const pp = passwordProblem(password)
    setError(pp)
    if (pp) {
      document.getElementById('reset-password')?.focus()
      return
    }
    const r = await save.run({ token, password })
    if (r.ok) window.location.assign(r.data.redirectTo)
    else if (r.fieldErrors?.password) setError(r.fieldErrors.password)
  }

  if (!valid) {
    return (
      <PublicFrame>
        <AuthCard labelledBy="reset-judul">
          <div className="flex flex-col gap-2">
            <h1 id="reset-judul" className="m-0 text-h1 font-bold max-sm:text-h2">
              Link ini sudah tidak berlaku
            </h1>
            <p className="m-0 text-body">Link atur ulang password hanya bisa dipakai sekali dan punya batas waktu.</p>
            <p className="m-0 text-body">Buka halaman Masuk, pilih Lupa password?, lalu minta link baru. Password lama tetap berlaku sampai password baru disimpan.</p>
          </div>
          <ButtonLink href={PUBLIC_ROUTES.login} variant="primary" className="h-12! w-full">
            Ke halaman Masuk
          </ButtonLink>
        </AuthCard>
      </PublicFrame>
    )
  }

  return (
    <PublicFrame>
      <AuthCard labelledBy="reset-judul">
        <div className="flex flex-col gap-1">
          <h1 id="reset-judul" className="m-0 text-h1 font-bold max-sm:text-h2">
            Buat password baru
          </h1>
          <p className="m-0 text-body text-fg-muted">Setelah disimpan, masuk lagi dengan password baru ini.</p>
        </div>
        <form method="post" noValidate onSubmit={submit} className="flex flex-col gap-5">
          <PasswordField
            id="reset-password"
            name="new-password"
            label="Password baru"
            hint="Paling sedikit 15 karakter. Tidak perlu huruf besar, angka, atau simbol. Kalimat pendek yang mudah diingat juga boleh."
            autoComplete="new-password"
            size="L"
            value={password}
            error={error}
            onChange={(e) => {
              setPassword(e.target.value)
              if (error) setError(null)
            }}
          />
          {save.error && !save.error.fieldErrors?.password ? (
            <InlineAlert tone="danger" title={save.error.message} reference={save.error.reference}>
              Coba lagi. Bila link sudah tidak berlaku, minta link baru dari halaman Masuk.
            </InlineAlert>
          ) : null}
          <Button type="submit" variant="primary" loading={save.pending} className="h-12! w-full">
            Simpan password baru
          </Button>
        </form>
      </AuthCard>
    </PublicFrame>
  )
}
