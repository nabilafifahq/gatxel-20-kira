'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/console/Button'
import { InlineAlert } from '@/components/console/Feedback'
import { useAction } from '@/components/console/useAction'
import { AuthCard } from '@/screens/public/PublicFrame'
import { confirmWaitlistAction } from '@/server/actions/signup'

/** Konfirmasi daftar tunggu lewat tombol (bukan saat halaman dibuka), supaya pemindai email tidak mengonfirmasi atas nama orang lain. */
export function ConfirmWaitlistClient({ token }: { token: string }) {
  const confirm = useAction(confirmWaitlistAction)
  const [done, setDone] = useState<boolean | null>(null)
  return (
    <AuthCard labelledBy="kk-judul">
      <h1 id="kk-judul" className="m-0 text-h1 font-bold max-sm:text-h2">
        {done === true ? 'Anda masuk daftar tunggu' : done === false ? 'Tautan ini tidak berlaku' : 'Kabari saya saat kursi dibuka'}
      </h1>
      {done === null ? (
        <>
          <p className="m-0 text-body text-fg-muted">Tekan tombol di bawah untuk mengonfirmasi bahwa email ini boleh kami kabari saat kursi beta Kira dibuka lagi.</p>
          {confirm.error ? (
            <InlineAlert tone="danger" title={confirm.error.message} reference={confirm.error.reference}>
              Coba lagi dalam beberapa menit.
            </InlineAlert>
          ) : null}
          <Button
            variant="primary"
            loading={confirm.pending}
            className="h-12! w-full"
            onClick={async () => {
              const r = await confirm.run({ token })
              if (r.ok) setDone(r.data.confirmed)
            }}
          >
            Ya, kabari saya
          </Button>
        </>
      ) : done ? (
        <p className="m-0 text-body text-fg-muted">Terima kasih. Kami kirim email saat kursi dibuka lagi. Setiap email punya tautan untuk berhenti.</p>
      ) : (
        <p className="m-0 text-body text-fg-muted">Tautan konfirmasi salah atau Anda sudah berhenti berlangganan. Anda bisa mendaftar lagi dari halaman depan.</p>
      )}
      <Link href="/" className="font-bold">
        Ke halaman depan
      </Link>
    </AuthCard>
  )
}
