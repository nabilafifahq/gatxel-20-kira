import type { Metadata } from 'next'
import { SourcesScreen } from '@/screens/console/PustakaScreens'
import { setSourceEnabledAction } from '@/server/actions/console-pustaka'
import { pageActor } from '@/server/auth/actor'
import { sourcesDTO } from '@/server/dal/console-sources'
import { load } from '@/server/page'

export const metadata: Metadata = { title: 'Sumber soal' }

/** Registri sumber soal terbuka dan resmi, serta status pengambilan mingguan. */
export default async function SourcesPage() {
  const actor = await pageActor(['tutor'], '/konsol/pustaka/sumber')
  const data = await load(() => sourcesDTO(actor))
  return <SourcesScreen data={data} actions={{ setSourceEnabled: setSourceEnabledAction }} />
}
