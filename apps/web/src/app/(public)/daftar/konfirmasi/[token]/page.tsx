import type { Metadata } from 'next'
import { VerifyClient } from '@/components/auth/VerifyClient'
import { PublicFrame } from '@/screens/public/PublicFrame'
import { signupTokenState } from '@/server/signup/service'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Konfirmasi email', referrer: 'no-referrer' }

export default async function VerifyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const state = /^[A-Za-z0-9_-]{30,100}$/.test(token) ? await signupTokenState(token) : 'invalid'
  return (
    <PublicFrame brandHref="/">
      <VerifyClient token={token} valid={state !== 'invalid'} needsPassword={state === 'needs-password'} />
    </PublicFrame>
  )
}
