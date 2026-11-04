import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CardsPlayerScreen } from '@/screens/learner/CardsScreen'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { cardSessionDTO } from '@/server/dal/flashcards'
import { gateFeature } from '@/server/feature-gate'
import { load } from '@/server/page'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Flashcards' }

export default async function CardDeckPage({ params, searchParams }: { params: Promise<{ deck: string }>; searchParams: Promise<{ mode?: string }> }) {
  const actor = await pageActor(['learner'])
  const { deck } = await params
  if (!/^[a-z0-9-]{2,61}$/.test(deck)) notFound()
  const mode = (await searchParams).mode === 'vocab' ? 'vocab' : 'cards'
  await gateFeature(mode === 'vocab' ? 'vocab' : 'flashcards')
  const session = await load(() => inOrg(orgCtx(actor), (tx) => cardSessionDTO(tx, actor.userId, deck, mode)))
  return <CardsPlayerScreen session={session} />
}
