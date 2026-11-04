import type { Metadata } from 'next'
import { VerifyClient } from '@/components/auth/VerifyClient'
import { PublicFrame } from '@/screens/public/PublicFrame'
import { signupTokenValid } from '@/server/signup/service'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Konfirmasi email', referrer: 'no-referrer' }

export default async function VerifyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const valid = /^[A-Za-z0-9_-]{30,100}$/.test(token) && (await signupTokenValid(token))
  return (
    <PublicFrame brandHref="/">
      <VerifyClient token={token} valid={valid} />
    </PublicFrame>
  )
}
