import type { Metadata } from 'next'
import { InboxScreen } from '@/screens/console/InboxScreen'
import { pageActor } from '@/server/auth/actor'
import { gradeAction, requestAiSuggestionAction } from '@/server/actions/console-inbox'
import { inboxDTO } from '@/server/dal/console-inbox'
import { load } from '@/server/page'
import { spEnum, spUuid, type SearchParams } from '@/server/params'

export const metadata: Metadata = { title: 'Hasil dan penilaian' }

const FILTERS = ['waiting', 'graded'] as const

/** T05 Hasil dan penilaian: jawaban tulisan, foto, rekaman, dan gambar yang dinilai tutor. */
export default async function InboxPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const actor = await pageActor(['tutor'], '/konsol/hasil')
  const sp = await searchParams
  const data = await load(() => inboxDTO(actor, spEnum(sp, 'filter', FILTERS) ?? 'waiting', spUuid(sp, 'respon')))
  return <InboxScreen data={data} actions={{ grade: gradeAction, requestAiSuggestion: requestAiSuggestionAction }} />
}
