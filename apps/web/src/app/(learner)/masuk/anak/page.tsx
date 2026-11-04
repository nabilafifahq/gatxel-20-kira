import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { FamilyCodeStep, FamilyNamesStep } from '@/screens/learner/FamilyCodeScreen'
import { checkFamilyCodeAction, forgetFamilyCodeAction } from '@/server/actions/family-code'
import { getActor, homeFor } from '@/server/auth/actor'
import { getDevice } from '@/server/auth/device'
import { familyChildChoices, readFamilyTicket } from '@/server/auth/family-code'
import { turnstileSiteKey } from '@/server/auth/turnstile'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Masuk sebagai anak' }

/** Anak masuk tanpa perangkat yang didaftarkan orang tua: kode keluarga, lalu nama, lalu PIN gambar. */
export default async function ChildCodePage({ searchParams }: { searchParams: Promise<{ lain?: string }> }) {
  const actor = await getActor()
  if (actor) redirect(homeFor(actor.role))
  const { lain } = await searchParams
  // Perangkat terdaftar langsung ke nama dan PIN. ?lain=1 untuk saudara yang belum ada di perangkat ini.
  if (lain !== '1' && (await getDevice())) redirect('/')
  const ticket = await readFamilyTicket()
  if (!ticket) return <FamilyCodeStep turnstileSiteKey={turnstileSiteKey()} checkCode={checkFamilyCodeAction} />
  return <FamilyNamesStep childrenList={await familyChildChoices(ticket.orgId)} forgetCode={forgetFamilyCodeAction} />
}
