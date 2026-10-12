import type { Metadata } from 'next'
import { ImportScreen } from '@/screens/console/ImportScreen'
import { pageActor } from '@/server/auth/actor'
import { approveImportItemsAction, updateImportItemAction, uploadPdfAction } from '@/server/actions/console-import'
import { importDTO } from '@/server/dal/console-import'
import { load } from '@/server/page'
import { spUuid, type SearchParams } from '@/server/params'

export const metadata: Metadata = { title: 'Impor paket resmi' }

/** T12 Impor paket resmi: unggah PDF milik keluarga, cek soal hasil baca, setujui ke Bank soal. */
export default async function ImportPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const actor = await pageActor(['tutor'], '/konsol/impor')
  const sp = await searchParams
  const data = await load(() => importDTO(actor, spUuid(sp, 'paket')))
  return <ImportScreen data={data} actions={{ uploadPdf: uploadPdfAction, updateImportItem: updateImportItemAction, approveImportItems: approveImportItemsAction }} />
}
