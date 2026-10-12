import { notFound, redirect } from 'next/navigation'
import { PinScreen } from '@/screens/learner'
import { getActor, homeFor } from '@/server/auth/actor'
import { getDevice } from '@/server/auth/device'
import { pinScreenDTO } from '@/server/dal/learner-entry'
import { submitPinAction } from '@/server/actions/learner'

export const dynamic = 'force-dynamic'

export default async function PinPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor()
  if (actor) redirect(homeFor(actor.role))
  const device = await getDevice()
  if (!device) redirect('/masuk')
  const { id } = await params
  const data = await pinScreenDTO(device, id)
  if (!data) notFound()
  return <PinScreen data={data} actions={{ submitPin: submitPinAction }} grownUpHref="/masuk" />
}
