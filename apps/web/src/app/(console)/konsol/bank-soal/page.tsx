import type { Metadata } from 'next'
import { ItemBankScreen } from '@/screens/console/ItemBankScreen'
import { pageActor } from '@/server/auth/actor'
import { bankParams, itemBankDTO } from '@/server/dal/console-bank'
import { load } from '@/server/page'
import { spUuid, type SearchParams } from '@/server/params'

export const metadata: Metadata = { title: 'Bank soal' }

/** T07 Bank soal: filter, cari, dan halaman di server; pratinjau lewat ?soal=. */
export default async function ItemBankPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const actor = await pageActor(['tutor'], '/konsol/bank-soal')
  const sp = await searchParams
  const data = await load(() => itemBankDTO(actor, { learner: spUuid(sp, 'learner'), ...bankParams(sp) }))
  return <ItemBankScreen data={data} />
}
