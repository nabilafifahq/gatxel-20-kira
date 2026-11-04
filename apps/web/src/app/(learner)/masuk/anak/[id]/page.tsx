import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { PIN_PICTURES } from '@kira/figures/spec'
import type { PinPicture } from '@/lib/dto'
import { PinScreen } from '@/screens/learner'
import { submitFamilyPinAction } from '@/server/actions/family-code'
import { getActor, homeFor } from '@/server/auth/actor'
import { familyChildChoice, readFamilyTicket } from '@/server/auth/family-code'
import { pinState } from '@/server/auth/pin'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Masuk sebagai anak' }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** PIN gambar di jalur kode keluarga. Tanpa tiket yang sah, atau anak di luar keluarga itu, kembali ke langkah kode. */
export default async function ChildCodePinPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor()
  if (actor) redirect(homeFor(actor.role))
  const { id } = await params
  const ticket = UUID_RE.test(id) ? await readFamilyTicket() : null
  const child = ticket ? await familyChildChoice(ticket.orgId, id) : null
  if (!child) redirect('/masuk/anak')
  const state = (await pinState([child.id])).get(child.id)
  return (
    <PinScreen
      data={{
        learnerId: child.id,
        name: child.firstName,
        avatar: null,
        pictures: [...PIN_PICTURES] as PinPicture[],
        lockedUntil: state?.lockedUntil ? state.lockedUntil.toISOString() : null,
        attemptsLeft: Math.max(0, 5 - (state?.failed ?? 0)),
      }}
      actions={{ submitPin: submitFamilyPinAction }}
      pickHref="/masuk/anak"
      grownUpHref="/masuk"
    />
  )
}
