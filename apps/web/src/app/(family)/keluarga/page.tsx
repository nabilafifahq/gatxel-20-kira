import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ParentHomeClient } from '@/screens/family/ParentHomeClient'
import { pageActor } from '@/server/auth/actor'
import { isFamilyOwner } from '@/server/auth/parent'
import { consoleShell } from '@/server/dal/console-shell'
import { parentHomeDTO } from '@/server/dal/parent'
import { load } from '@/server/page'
import { FAMILY_ROUTES } from '@/components/console/routes'

export const metadata: Metadata = { title: 'Anak saya' }

/** Beranda orang tua: anak, status hari ini, streak, menit, dan XP. Tutor memakai Laporan minggu. */
export default async function ParentHomePage() {
  const actor = await pageActor(['guardian', 'tutor'], '/keluarga')
  if (actor.role === 'tutor') redirect(FAMILY_ROUTES.week)
  const [{ shell }, data] = await Promise.all([load(() => consoleShell(actor, null)), load(() => parentHomeDTO(actor))])
  // Orang tua yang mendaftar sendiri dan belum menambah anak melanjutkan onboarding.
  if (data.children.length === 0 && (await isFamilyOwner(actor))) redirect('/mulai')
  return <ParentHomeClient shell={shell} data={data} />
}
