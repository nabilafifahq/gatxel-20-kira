import type { Metadata } from 'next'
import { PlacementScreen } from '@/screens/learner/PlacementScreen'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { placementEntry } from '@/server/dal/placement'
import { load } from '@/server/page'
import { answerPlacementAction, skipPlacementAction } from '@/server/actions/placement'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Starting point' }

/** Tes penempatan: /placement?subject=math. Tanpa parameter, satu tes langsung mulai; beberapa tes menampilkan pilihan mapel. */
export default async function PlacementPage({ searchParams }: { searchParams: Promise<{ subject?: string }> }) {
  const { subject } = await searchParams
  const actor = await pageActor(['learner'])
  const entry = await load(() => inOrg(orgCtx(actor), (tx) => placementEntry(tx, orgCtx(actor), actor.userId, subject ?? null)))
  return <PlacementScreen entry={entry} actions={{ answer: answerPlacementAction, skip: skipPlacementAction }} />
}
