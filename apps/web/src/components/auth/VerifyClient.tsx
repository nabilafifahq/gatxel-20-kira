'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/console/Button'
import { InlineAlert } from '@/components/console/Feedback'
import { PasswordField } from '@/components/console/PasswordField'
import { useAction } from '@/components/console/useAction'
import { AuthCard } from '@/screens/public/PublicFrame'
import { WaitlistFull } from '@/components/auth/WaitlistFull'
import { verifySignupAction } from '@/server/actions/signup'

/**
 * Konfirmasi email. Tautan di email hanya membuka halaman ini; kursi baru diambil saat tombol ditekan,
 * supaya pemindai email atau pratinjau tautan tidak menghabiskan token.
 */
export function VerifyClient({ token, valid }: { token: string; valid: boolean }) {
  const verify = useAction(verifySignupAction)
  const [outcome, setOutcome] = useState<'full' | 'invalid' | 'taken' | null>(valid ? null : 'invalid')
  const [password, setPassword] = useState('')
  const [wrong, setWrong] = useState(false)

  async function confirm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!password) return setWrong(true)
    const r = await verify.run({ token, password })
    if (!r.ok) return
    if (r.data.status === 'ok') window.location.assign(r.data.redirectTo)
    else if (r.data.status === 'password') setWrong(true)
    else setOutcome(r.data.status)
  }

  if (outcome === 'full') return <WaitlistFull />
  if (outcome === 'taken') {
    return (
      <AuthCard labelledBy="vf-judul">
        <h1 id="vf-judul" className="m-0 text-h1 font-bold max-sm:text-h2">
          Email ini sudah punya akun
        </h1>
        <p className="m-0 text-body text-fg-muted">Masuk dengan email dan password yang kamu buat. Lupa password? Pakai Lupa password di halaman masuk.</p>
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
        <p className="m-0 text-body text-fg-muted">Tautan konfirmasi berlaku 24 jam dan hanya bisa dipakai sekali. Daftar lagi atau masuk bila akunmu sudah dibuat. Pendaftaran yang tidak dikonfirmasi dalam 24 jam dihapus otomatis.</p>
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
  return (
    <AuthCard labelledBy="vf-judul">
      <h1 id="vf-judul" className="m-0 text-h1 font-bold max-sm:text-h2">
        Satu tekan lagi
      </h1>
      <p className="m-0 text-body text-fg-muted">Masukkan password yang kamu buat saat mendaftar, lalu tekan Konfirmasi. Keluarga Kira kamu langsung dibuat dan kamu masuk.</p>
      <form method="post" noValidate onSubmit={confirm} className="flex flex-col gap-5">
        <PasswordField
          name="password"
          label="Password"
          autoComplete="current-password"
          size="L"
          value={password}
          error={wrong ? 'Password belum cocok dengan yang dibuat saat mendaftar.' : null}
          hint="Ini memastikan hanya kamu yang menyelesaikan pendaftaran dengan email ini."
          onChange={(e) => {
            setPassword(e.target.value)
            setWrong(false)
          }}
        />
        {wrong ? (
          <p className="m-0 text-small text-fg-muted">
            Lupa, atau bukan kamu yang mendaftar? <Link href="/daftar" className="font-bold">Daftar lagi</Link> untuk membuat password baru, lalu pakai email konfirmasi yang terbaru.
          </p>
        ) : null}
        {verify.error ? (
          <InlineAlert tone="danger" title={verify.error.message} reference={verify.error.reference}>
            Coba lagi dalam beberapa menit.
          </InlineAlert>
        ) : null}
        <Button type="submit" variant="primary" loading={verify.pending} className="h-12! w-full">
          Konfirmasi email
        </Button>
      </form>
    </AuthCard>
  )
}
