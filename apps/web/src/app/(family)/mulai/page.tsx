import type { Metadata } from 'next'
import { Onboarding } from '@/components/family/Onboarding'
import { redirect } from 'next/navigation'
import { getActor } from '@/server/auth/actor'
import { getDevice } from '@/server/auth/device'
import { isFamilyOwner } from '@/server/auth/parent'
import { onboardingState } from '@/server/dal/onboarding'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Mulai' }

/** Onboarding orang tua baru: tambah anak, izin data, buka Kira untuk anak di perangkat ini. */
export default async function StartPage() {
  const actor = await getActor()
  // Setelah "Buka Kira untuk anak" sesi orang tua berakhir dan tablet terdaftar: lanjut ke pilihan anak.
  if (!actor) redirect((await getDevice()) ? '/' : '/masuk?next=%2Fmulai')
  if (actor.role !== 'guardian') redirect('/keluarga')
  if (!(await isFamilyOwner(actor))) redirect('/keluarga')
  return <Onboarding state={await onboardingState(actor)} />
}
