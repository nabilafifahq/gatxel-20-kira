import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { SignupClient } from '@/components/auth/SignupClient'
import { PublicFrame } from '@/screens/public/PublicFrame'
import { SeatsFull } from '@/screens/public/SeatsFull'
import { getActor, homeFor } from '@/server/auth/actor'
import { turnstileSiteKey } from '@/server/auth/turnstile'
import { seatInfo } from '@/server/signup/service'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Daftar' }

/** Pendaftaran orang tua. Saat kursi beta penuh, halaman berganti ke daftar tunggu. */
export default async function SignupPage() {
  const actor = await getActor()
  if (actor) redirect(homeFor(actor.role))
  const seats = await seatInfo()
  if (seats.full) {
    return (
      <PublicFrame center={false} brandHref="/">
        <SeatsFull turnstileSiteKey={turnstileSiteKey()} />
      </PublicFrame>
    )
  }
  return (
    <PublicFrame brandHref="/">
      <SignupClient turnstileSiteKey={turnstileSiteKey()} seatsLeft={seats.left} />
    </PublicFrame>
  )
}
