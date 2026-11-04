import type { Metadata } from 'next'
import { Onboarding } from '@/components/family/Onboarding'
import { pageActor } from '@/server/auth/actor'
import { onboardingState } from '@/server/dal/onboarding'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Mulai' }

/** Onboarding orang tua baru: tambah anak, izin data, buka Kira untuk anak di perangkat ini. */
export default async function StartPage() {
  const actor = await pageActor(['guardian'], '/mulai')
  return <Onboarding state={await onboardingState(actor)} />
}
