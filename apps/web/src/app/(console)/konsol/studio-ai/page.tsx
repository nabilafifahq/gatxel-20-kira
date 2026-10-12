import type { Metadata } from 'next'
import { StudioAiScreen } from '@/screens/console/StudioAiScreen'
import { pageActor } from '@/server/auth/actor'
import { approveDraftAction, rejectDraftAction, requestDraftsAction } from '@/server/actions/console-studio'
import { studioAiDTO } from '@/server/dal/console-studio'
import { load } from '@/server/page'

export const metadata: Metadata = { title: 'Studio AI' }

/** T11 Studio AI: minta draf ke worker, pantau job, tinjau dan setujui draf. */
export default async function StudioAiPage() {
  const actor = await pageActor(['tutor'], '/konsol/studio-ai')
  const data = await load(() => studioAiDTO(actor))
  return <StudioAiScreen data={data} actions={{ requestDrafts: requestDraftsAction, approveDraft: approveDraftAction, rejectDraft: rejectDraftAction }} />
}
