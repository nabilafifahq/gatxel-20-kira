import type { Metadata } from 'next'
import { Onboarding } from '@/components/family/Onboarding'
import { resolveStep } from '@/lib/onboarding-steps'
import { redirect } from 'next/navigation'
import { getActor } from '@/server/auth/actor'
import { getDevice } from '@/server/auth/device'
import { isFamilyOwner } from '@/server/auth/parent'
import { onboardingState } from '@/server/dal/onboarding'
import { spString, spUuid, type SearchParams } from '@/server/params'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Mulai' }

/** Onboarding orang tua baru: tambah anak, pilih jalur, cara anak masuk. Muat ulang melanjutkan di langkah yang benar. */
export default async function StartPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const actor = await getActor()
  // Setelah "Mulai belajar sebagai anak" sesi orang tua berakhir dan perangkat terdaftar: lanjut ke pilihan anak.
  if (!actor) redirect((await getDevice()) ? '/' : '/masuk?next=%2Fmulai')
  if (actor.role !== 'guardian') redirect('/keluarga')
  if (!(await isFamilyOwner(actor))) redirect('/keluarga')
  const sp = await searchParams
  const state = await onboardingState(actor)
  const step = resolveStep(state.children, spString(sp, 'langkah', 2))
  const anak = spUuid(sp, 'anak')
  const custom = step === 2 && anak ? (state.children.find((c) => c.id === anak) ?? null) : null
  return <Onboarding state={state} step={step} customChild={custom} />
}
