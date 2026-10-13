import { CorrectionBookScreen, FixItCard } from '@/screens/learner'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { correctionBookDTO } from '@/server/dal/learner-explore'
import { fixItDTO } from '@/server/dal/mistake-book'
import { load } from '@/server/page'

export const dynamic = 'force-dynamic'

export default async function CorrectionBookPage() {
  const actor = await pageActor(['learner'])
  const data = await load(() => inOrg(orgCtx(actor), (tx) => correctionBookDTO(tx, actor.userId)))
  // Buku Salah (Fix-it Book) tampil sebagai kartu di atas kartu review bila ada soal yang menunggu.
  const fixIt = await load(() => inOrg(orgCtx(actor), (tx) => fixItDTO(tx, actor.userId)))
  return <CorrectionBookScreen data={data} extra={<FixItCard open={fixIt.open} saturday={fixIt.saturday} />} />
}
