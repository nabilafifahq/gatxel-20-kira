import type { Metadata } from 'next'
import { FamilyShell } from '@/components/family/FamilyShell'
import { FamilyHomeScreen } from '@/screens/family/FamilyHomeScreen'
import { pageActor } from '@/server/auth/actor'
import { familyHomeDTO } from '@/server/dal/family'
import { load } from '@/server/page'
import { spDate, spUuid, type SearchParams } from '@/server/params'

export const metadata: Metadata = { title: 'Ringkasan minggu' }

/** G01 Ringkasan minggu untuk orang tua (tutor ikut melihat). */
export default async function FamilyHomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const actor = await pageActor(['guardian', 'tutor'], '/keluarga')
  const sp = await searchParams
  const { shell, home } = await load(() => familyHomeDTO(actor, spUuid(sp, 'learner'), spDate(sp, 'minggu')))
  if (!home) {
    return (
      <FamilyShell shell={shell} active="home">
        <h1 className="m-0 text-h2 font-bold">Ringkasan minggu</h1>
        <p role="status" className="m-0 rounded-card border border-divider bg-surface p-4 text-body">
          Akun ini belum tertaut ke anak mana pun, jadi belum ada ringkasan. Minta tutor mengirim undangan yang menyertakan nama anak, lalu ringkasan
          mingguan muncul di sini.
        </p>
      </FamilyShell>
    )
  }
  return <FamilyHomeScreen data={home} />
}
