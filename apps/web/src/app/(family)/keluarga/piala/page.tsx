import type { Metadata } from 'next'
import { MedalsScreen } from '@/screens/family/MedalsScreen'
import { parentAddMedalAction, parentRemoveMedalAction } from '@/server/actions/world'
import { pageActor, orgCtx } from '@/server/auth/actor'
import { inOrg } from '@/server/db'
import { consoleShell } from '@/server/dal/console-shell'
import { medalsOf } from '@/server/dal/kira-world'
import { parentHomeDTO } from '@/server/dal/parent'
import { load } from '@/server/page'

export const metadata: Metadata = { title: 'Medali lomba' }

/** Orang tua mencatat medali lomba sungguhan anak. Ditulis lewat aksi dengan requireParent dan guardian_link. */
export default async function MedalsPage() {
  const actor = await pageActor(['guardian'], '/keluarga/piala')
  const [{ shell }, home] = await Promise.all([load(() => consoleShell(actor, null)), load(() => parentHomeDTO(actor))])
  const children = await load(() =>
    inOrg(orgCtx(actor), async (tx) => Promise.all(home.children.map(async (c) => ({ id: c.id, name: c.name, medals: await medalsOf(tx, c.id) })))),
  )
  return <MedalsScreen data={{ shell, children }} actions={{ add: parentAddMedalAction, remove: parentRemoveMedalAction }} />
}
