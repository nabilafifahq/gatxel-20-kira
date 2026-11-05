import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AuthGateway } from '@/screens/public/AuthGateway'
import { LandingBelow } from '@/screens/public/LandingBelow'
import { getActor, homeFor, safeNext } from '@/server/auth/actor'
import { googleButtonVisible } from '@/server/auth/google'
import { turnstileSiteKey } from '@/server/auth/turnstile'
import { curriculumClaim } from '@/server/signup/claims'
import { seatInfo } from '@/server/signup/service'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Masuk' }

const NOTICES = ['locked', 'reset-done', 'signed-out', 'session-expired', 'invite-accepted', 'google-failed', 'google-cancelled', 'google-unverified', 'google-other-account', 'google-disabled', 'google-not-adult', 'google-use-password', 'google-disposable', 'google-no-mail', 'google-taken', 'google-app'] as const

/** Masuk untuk orang tua dan tutor, layar yang sama dengan halaman depan. */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; notice?: string }> }) {
  const { next, notice } = await searchParams
  const actor = await getActor()
  if (actor) redirect(safeNext(next, homeFor(actor.role)))
  const n = (NOTICES as readonly string[]).includes(notice ?? '') ? (notice as (typeof NOTICES)[number]) : null
  const seats = await seatInfo()
  return (
    <AuthGateway
      initialMode="login"
      seats={seats}
      claim={curriculumClaim()}
      turnstileSiteKey={turnstileSiteKey()}
      google={await googleButtonVisible()}
      next={next ? safeNext(next, '/') : null}
      notice={n}
      below={<LandingBelow full={seats.full} />}
    />
  )
}
