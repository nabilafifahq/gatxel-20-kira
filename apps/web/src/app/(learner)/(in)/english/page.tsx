import { EnglishSkillsScreen } from '@/screens/learner/EnglishSkillsScreen'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { englishSkillsDTO } from '@/server/dal/english-skills'
import { load } from '@/server/page'

export const dynamic = 'force-dynamic'

export default async function EnglishSkillsPage() {
  const actor = await pageActor(['learner'])
  const data = await load(() => inOrg(orgCtx(actor), (tx) => englishSkillsDTO(tx, actor.userId)))
  return <EnglishSkillsScreen data={data} />
}
