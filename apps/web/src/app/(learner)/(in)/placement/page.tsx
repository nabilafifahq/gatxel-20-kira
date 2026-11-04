import type { Metadata } from 'next'
import { getT } from '@/lib/i18n/server'
import { PlacementScreen } from '@/screens/learner/PlacementScreen'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { placementEntry } from '@/server/dal/placement'
import { load } from '@/server/page'
import { answerPlacementAction, skipPlacementAction } from '@/server/actions/placement'

export const dynamic = 'force-dynamic'
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).shell.titles.startingPoint }
}

/** Tes penempatan: /placement?subject=math. Tanpa parameter, satu tes langsung mulai; beberapa tes menampilkan pilihan mapel. */
export default async function PlacementPage({ searchParams }: { searchParams: Promise<{ subject?: string }> }) {
  const { subject } = await searchParams
  const actor = await pageActor(['learner'])
  const entry = await load(() => inOrg(orgCtx(actor), (tx) => placementEntry(tx, orgCtx(actor), actor.userId, subject ?? null)))
  return <PlacementScreen key={subject ?? 'all'} entry={entry} actions={{ answer: answerPlacementAction, skip: skipPlacementAction }} />
}
