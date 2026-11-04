import type { Metadata } from 'next'
import { CoachScreen } from '@/screens/family/CoachScreen'
import { pageActor } from '@/server/auth/actor'
import { parentCoachDTO } from '@/server/dal/coach'
import { consoleShell } from '@/server/dal/console-shell'
import { load } from '@/server/page'
import { spUuid, type SearchParams } from '@/server/params'

export const metadata: Metadata = { title: 'Pelatih orang tua' }

/** Pelatih mingguan: tiga skill untuk dilatih, kegiatan 10 menit, dan satu hal untuk dipuji. Khusus orang tua. */
export default async function CoachPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const actor = await pageActor(['guardian'], '/keluarga/pelatih')
  const learner = spUuid(await searchParams, 'learner')
  const [{ shell }, data] = await Promise.all([load(() => consoleShell(actor, learner)), load(() => parentCoachDTO(actor, learner))])
  return <CoachScreen shell={shell} data={data} />
}
