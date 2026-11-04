'use client'

import { useState } from 'react'
import { Button } from '@/components/console/Button'
import { Dialog } from '@/components/console/Dialog'
import { ActionError } from '@/components/console/Feedback'
import { useAction } from '@/components/console/useAction'
import { formatFamilyCode } from '@/lib/family-code'
import { rotateFamilyCodeAction } from '@/server/actions/family-code'

type Status = 'copied' | 'shared' | 'failed' | 'rotated' | null

/** Pesan untuk anak atau pengasuh. Dipakai tombol Bagikan di sini dan di langkah Cara anak masuk. */
export function familyCodeMessage(origin: string, code: string): string {
  return `Cara masuk Kira untuk anak: buka ${origin}/masuk/anak di browser (Safari di iPhone dan iPad), ketik kode keluarga ${formatFamilyCode(code)}, pilih nama, lalu tekan PIN gambar.`
}

/** Kode keluarga dengan tombol salin, bagikan, dan ganti. Untuk orang tua dan tutor. */
export function FamilyCodeCard({ code: initial }: { code: string | null }) {
  const [code, setCode] = useState(initial)
  const [status, setStatus] = useState<Status>(null)
  const [confirming, setConfirming] = useState(false)
  const rotate = useAction(rotateFamilyCodeAction)
  if (!code) return null

  async function copy() {
    setStatus(null)
    try {
      await navigator.clipboard.writeText(formatFamilyCode(code!))
      setStatus('copied')
    } catch {
      setStatus('failed')
    }
  }

  async function share() {
    const text = familyCodeMessage(window.location.origin, code!)
    setStatus(null)
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: 'Kode keluarga Kira', text })
        setStatus('shared')
        return
      }
      await navigator.clipboard.writeText(text)
      setStatus('copied')
    } catch (e) {
      // Membatalkan lembar bagikan bukan kegagalan.
      if (e instanceof Error && e.name === 'AbortError') return
      setStatus('failed')
    }
  }

  async function replace() {
    const r = await rotate.run({})
    if (!r.ok) return
    setCode(r.data.code)
    setStatus('rotated')
    setConfirming(false)
  }

  return (
    <section aria-labelledby="kode-keluarga-judul" data-testid="family-code-card" className="flex flex-col gap-3 rounded-card bg-lavender p-4">
      <h2 id="kode-keluarga-judul" className="m-0 text-h3 font-bold">
        Kode keluarga
      </h2>
      <p data-testid="family-code" className="m-0 font-numbers text-h1 font-bold tracking-widest break-all">
        {formatFamilyCode(code)}
      </p>
      <p className="m-0 text-body">Anak bisa masuk sendiri di browser atau aplikasi: tekan Masuk, lalu Masuk sebagai anak, ketik kode ini, pilih nama, lalu tekan PIN gambar. Kode saja tidak cukup untuk membuka akun anak, karena PIN tetap diminta.</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <Button variant="secondary" className="h-12" onClick={copy}>
          Salin kode
        </Button>
        <Button variant="secondary" className="h-12" onClick={share}>
          Bagikan
        </Button>
        <Button variant="secondary" className="h-12" onClick={() => (rotate.reset(), setConfirming(true))}>
          Ganti kode
        </Button>
      </div>
      {status === 'copied' ? <p role="status" className="m-0 text-small font-bold">Tersalin.</p> : null}
      {status === 'shared' ? <p role="status" className="m-0 text-small font-bold">Terbagikan.</p> : null}
      {status === 'rotated' ? <p role="status" className="m-0 text-small font-bold">Kode baru sudah aktif. Kode lama tidak bisa dipakai lagi.</p> : null}
      {status === 'failed' ? <p role="status" className="m-0 text-small font-bold">Belum bisa menyalin di perangkat ini. Anda bisa membacakan kodenya.</p> : null}
      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        dismissible={!rotate.pending}
        title="Ganti kode keluarga?"
        description="Kode lama langsung berhenti berlaku. Perangkat yang sudah masuk tidak ikut keluar. Untuk mengeluarkan perangkat, cabut dari daftar perangkat."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={rotate.pending}>
              Batal
            </Button>
            <Button variant="primary" onClick={replace} loading={rotate.pending}>
              Ganti kode
            </Button>
          </>
        }
      >
        <ActionError error={rotate.error} />
      </Dialog>
    </section>
  )
}
