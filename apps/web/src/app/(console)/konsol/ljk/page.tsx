import type { Metadata } from 'next'
import { LjkScreen } from '@/screens/console/LjkScreen'
import { pageActor } from '@/server/auth/actor'
import { saveLjkAction } from '@/server/actions/console-ljk'
import { ljkDTO } from '@/server/dal/console-ljk'
import { load } from '@/server/page'
import { spUuid, type SearchParams } from '@/server/params'

export const metadata: Metadata = { title: 'Input LJK' }

/** T06 Input LJK: lembar Kertas yang menunggu, ?lembar= memilih satu lembar. */
export default async function LjkPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const actor = await pageActor(['tutor'], '/konsol/ljk')
  const sp = await searchParams
  const data = await load(() => ljkDTO(actor, { learner: spUuid(sp, 'learner'), lembar: spUuid(sp, 'lembar') }))
  return <LjkScreen data={data} actions={{ saveLjk: saveLjkAction }} />
}
