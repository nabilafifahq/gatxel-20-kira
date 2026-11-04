import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AuthGateway } from '@/screens/public/AuthGateway'
import { LandingBelow } from '@/screens/public/LandingBelow'
import { getActor, homeFor } from '@/server/auth/actor'
import { turnstileSiteKey } from '@/server/auth/turnstile'
import { curriculumClaim } from '@/server/signup/claims'
import { seatInfo } from '@/server/signup/service'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Daftar' }

/** Pendaftaran orang tua, layar yang sama dengan halaman depan. Saat kursi beta penuh, sisi Daftar menjadi daftar tunggu. */
export default async function SignupPage() {
  const actor = await getActor()
  if (actor) redirect(homeFor(actor.role))
  const seats = await seatInfo()
  return <AuthGateway initialMode="signup" seats={seats} claim={curriculumClaim()} turnstileSiteKey={turnstileSiteKey()} below={<LandingBelow full={seats.full} />} />
}
