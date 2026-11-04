import type { Metadata } from 'next'
import { ConfirmWaitlistClient } from '@/components/auth/ConfirmWaitlistClient'
import { PublicFrame } from '@/screens/public/PublicFrame'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Konfirmasi daftar tunggu', referrer: 'no-referrer' }

export default async function ConfirmWaitlistPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return (
    <PublicFrame brandHref="/">
      <ConfirmWaitlistClient token={token} />
    </PublicFrame>
  )
}
