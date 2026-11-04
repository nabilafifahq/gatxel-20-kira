'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/console/Button'
import { InlineAlert } from '@/components/console/Feedback'
import { useAction } from '@/components/console/useAction'
import { AuthCard } from '@/screens/public/PublicFrame'
import { WaitlistFull } from '@/components/auth/WaitlistFull'
import { verifySignupAction } from '@/server/actions/signup'

/**
 * Konfirmasi email. Browser langsung mengonfirmasi setelah halaman terbuka, lalu masuk ke langkah tambah anak.
 * Token dipakai lewat Server Action, jadi pemindai email dan pratinjau tautan tanpa JavaScript tidak memakainya.
 */
export function VerifyClient({ token, valid }: { token: string; valid: boolean }) {
  const verify = useAction(verifySignupAction)
  const [outcome, setOutcome] = useState<'full' | 'invalid' | 'taken' | null>(valid ? null : 'invalid')
  const started = useRef(false)

  async function confirm() {
    const r = await verify.run({ token })
    if (!r.ok) return
    if (r.data.status === 'ok') window.location.assign(r.data.redirectTo)
    else setOutcome(r.data.status)
  }

  useEffect(() => {
    if (!valid || started.current) return
    started.current = true
    void confirm()
  }, [])

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
