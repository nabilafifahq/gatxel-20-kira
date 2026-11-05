import { redirect } from 'next/navigation'
import { PickLearnerScreen } from '@/screens/learner'
import { getActor, homeFor } from '@/server/auth/actor'
import { DEVICE_COOKIE, readCookie } from '@/server/auth/cookies'
import { getDevice } from '@/server/auth/device'
import { pickLearnerDTO } from '@/server/dal/learner-entry'

export const dynamic = 'force-dynamic'

/** Halaman awal: tablet terdaftar menampilkan pilihan learner; orang dewasa diarahkan ke konsol. */
export default async function Home() {
  const actor = await getActor()
  if (actor) redirect(homeFor(actor.role))
  const device = await getDevice()
  // Pengunjung tanpa tablet terdaftar dan tanpa sesi melihat halaman depan publik (proxy.ts mengalihkan / ke /beranda).
  if (!device) {
    // Cookie perangkat masih ada tetapi tidak berlaku lagi (dicabut orang tua atau kedaluwarsa): anak diberi tahu, bukan dilempar ke halaman depan.
    if (await readCookie(DEVICE_COOKIE)) redirect('/masuk/anak?perangkat=berakhir')
    redirect('/beranda')
  }
  const data = await pickLearnerDTO(device)
  return <PickLearnerScreen data={data} grownUpHref="/masuk" addLearnerHref="/masuk?next=/konsol/learner" />
}
