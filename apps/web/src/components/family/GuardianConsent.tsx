'use client'

import Link from 'next/link'
import { Checkbox } from '@/components/console/Field'

/**
 * Persetujuan orang tua atau wali saat menambah anak. Tercatat sebagai persetujuan `learning` beserta waktu dan
 * versi kebijakan, di transaksi yang sama dengan pembuatan anak. Dipakai onboarding dan dashboard orang tua.
 */
export function GuardianConsent({ checked, onChange, error }: { checked: boolean; onChange: (checked: boolean) => void; error?: string | null }) {
  return (
    <Checkbox
      name="guardian-consent"
      required
      checked={checked}
      error={error}
      onChange={(e) => onChange(e.target.checked)}
      label={
        <>
          Saya orang tua atau wali anak ini dan menyetujui Kira memproses data belajarnya sesuai{' '}
          <Link href="/privasi" target="_blank" className="underline underline-offset-3">
            Kebijakan Privasi
          </Link>
        </>
      }
      description="Menyimpan jawaban, skor, dan kemajuan supaya soal berikutnya sesuai kemampuan anak. Lalu lintas ke Kira melewati Cloudflare, termasuk pusat data di luar Indonesia. Bisa ditarik kapan saja di halaman Privasi."
    />
  )
}
