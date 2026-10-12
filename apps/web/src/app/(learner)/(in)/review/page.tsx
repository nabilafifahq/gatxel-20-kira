import { CorrectionBookScreen } from '@/screens/learner'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { correctionBookDTO } from '@/server/dal/learner-explore'
import { load } from '@/server/page'

export const dynamic = 'force-dynamic'

export default async function CorrectionBookPage() {
  const actor = await pageActor(['learner'])
  const data = await load(() => inOrg(orgCtx(actor), (tx) => correctionBookDTO(tx, actor.userId)))
  return <CorrectionBookScreen data={data} />
}
