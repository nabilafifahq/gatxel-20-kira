'use client'

import Link from 'next/link'
import { Checkbox } from '@/components/console/Field'

/**
 * Persetujuan Syarat dan Ketentuan (wajib) dan email kabar (opsional), tidak pernah tercentang dari awal.
 * Dipakai form daftar dan langkah Buat password baru, supaya kalimat yang disetujui selalu sama.
 */
export function SignupConsentChecks({
  consent,
  marketing,
  consentError,
  onConsentChange,
  onMarketingChange,
}: {
  consent: boolean
  marketing: boolean
  consentError?: string | null
  onConsentChange: (checked: boolean) => void
  onMarketingChange: (checked: boolean) => void
}) {
  return (
    <>
      <Checkbox
        name="consent"
        required
        checked={consent}
        error={consentError}
        onChange={(e) => onConsentChange(e.target.checked)}
        label={
          <>
            Saya setuju dengan{' '}
            <Link href="/ketentuan" target="_blank" className="underline underline-offset-3">
              Syarat dan Ketentuan
            </Link>{' '}
            dan{' '}
            <Link href="/privasi" target="_blank" className="underline underline-offset-3">
              Kebijakan Privasi
            </Link>
          </>
        }
      />
      <Checkbox name="marketing" optional checked={marketing} onChange={(e) => onMarketingChange(e.target.checked)} label="Kirim saya kabar produk, tips belajar, dan penawaran dari Kira lewat email" />
    </>
  )
}
