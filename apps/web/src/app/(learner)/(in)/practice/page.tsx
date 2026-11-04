import type { Metadata } from 'next'
import { PracticeScreen } from '@/screens/learner/PracticeScreen'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { practiceDTO } from '@/server/dal/practice'
import { load } from '@/server/page'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Practice' }

export default async function PracticePage({ searchParams }: { searchParams: Promise<{ off?: string; few?: string }> }) {
  const actor = await pageActor(['learner'])
  const sp = await searchParams
  const data = await load(() => inOrg(orgCtx(actor), (tx) => practiceDTO(tx, actor.userId, typeof sp.off === 'string' ? sp.off : null)))
  return <PracticeScreen data={data} few={sp.few === '1'} />
}
