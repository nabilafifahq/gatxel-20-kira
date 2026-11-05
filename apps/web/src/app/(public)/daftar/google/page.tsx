import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { GoogleConsentClient } from '@/components/auth/GoogleConsentClient'
import { PublicFrame } from '@/screens/public/PublicFrame'
import { getActor, homeFor } from '@/server/auth/actor'
import { googleConfig, readPendingGoogle } from '@/server/auth/google'
import { turnstileSiteKey } from '@/server/auth/turnstile'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Daftar dengan Google', referrer: 'no-referrer' }

/** Satu langkah sebelum akun dibuat: persetujuan orang tua yang baru pertama kali masuk dengan Google. */
export default async function GoogleConsentPage() {
  if (!googleConfig()) notFound()
  const actor = await getActor()
  if (actor) redirect(homeFor(actor.role))
  const claims = await readPendingGoogle()
  if (!claims) redirect('/masuk?notice=google-failed')
  return (
    <PublicFrame brandHref="/">
      <GoogleConsentClient email={claims.email} turnstileSiteKey={turnstileSiteKey()} />
    </PublicFrame>
  )
}
