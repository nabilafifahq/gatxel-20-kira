import type { Metadata } from 'next'
import { Onboarding } from '@/components/family/Onboarding'
import { redirect } from 'next/navigation'
import { pageActor } from '@/server/auth/actor'
import { isFamilyOwner } from '@/server/auth/parent'
import { onboardingState } from '@/server/dal/onboarding'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Mulai' }

/** Onboarding orang tua baru: tambah anak, izin data, buka Kira untuk anak di perangkat ini. */
export default async function StartPage() {
  const actor = await pageActor(['guardian'], '/mulai')
  if (!(await isFamilyOwner(actor))) redirect('/keluarga')
  return <Onboarding state={await onboardingState(actor)} />
}
