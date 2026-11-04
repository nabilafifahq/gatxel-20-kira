import type { Metadata } from 'next'
import { CardsHubScreen } from '@/screens/learner/CardsScreen'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { cardsHubDTO } from '@/server/dal/flashcards'
import { gateFeature } from '@/server/feature-gate'
import { load } from '@/server/page'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Flashcards' }

export default async function CardsPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const actor = await pageActor(['learner'])
  const mode = (await searchParams).mode === 'vocab' ? 'vocab' : 'cards'
  await gateFeature(mode === 'vocab' ? 'vocab' : 'flashcards')
  const data = await load(() => inOrg(orgCtx(actor), (tx) => cardsHubDTO(tx, actor.userId, mode)))
  return <CardsHubScreen data={data} />
}
