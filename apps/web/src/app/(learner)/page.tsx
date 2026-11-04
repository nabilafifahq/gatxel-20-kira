import { redirect } from 'next/navigation'
import { PickLearnerScreen } from '@/screens/learner'
import { getActor, homeFor } from '@/server/auth/actor'
import { getDevice } from '@/server/auth/device'
import { pickLearnerDTO } from '@/server/dal/learner-entry'

export const dynamic = 'force-dynamic'

/** Halaman awal: tablet terdaftar menampilkan pilihan learner; orang dewasa diarahkan ke konsol. */
export default async function Home() {
  const actor = await getActor()
  if (actor) redirect(homeFor(actor.role))
  const device = await getDevice()
  // Pengunjung tanpa tablet terdaftar dan tanpa sesi melihat halaman depan publik (proxy.ts mengalihkan / ke /beranda).
  if (!device) redirect('/beranda')
  const data = await pickLearnerDTO(device)
  return <PickLearnerScreen data={data} grownUpHref="/masuk" addLearnerHref="/masuk?next=/konsol/learner" />
}
