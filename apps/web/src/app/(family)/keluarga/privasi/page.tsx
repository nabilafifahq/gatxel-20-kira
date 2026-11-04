import type { Metadata } from 'next'
import { FamilyShell } from '@/components/family/FamilyShell'
import { MarketingPreference } from '@/components/family/MarketingPreference'
import { PrivacyScreen } from '@/screens/family/PrivacyScreen'
import { cancelDeletionAction, exportDataAction, requestDeletionAction, setConsentAction } from '@/server/actions/family'
import { setMarketingAction } from '@/server/actions/parent'
import { pageActor } from '@/server/auth/actor'
import { marketingPreference } from '@/server/dal/marketing'
import { privacyDTO } from '@/server/dal/privacy'
import { load } from '@/server/page'
import { spUuid, type SearchParams } from '@/server/params'

export const metadata: Metadata = { title: 'Privasi dan data' }

/** G02 Privasi keluarga: orang tua mengubah persetujuan, mengunduh data, dan meminta hapus; tutor hanya melihat. */
export default async function FamilyPrivacyPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const actor = await pageActor(['guardian', 'tutor'], '/keluarga/privasi')
  const sp = await searchParams
  const { shell, privacy } = await load(() => privacyDTO(actor, spUuid(sp, 'learner')))
  // Pilihan akun orang tua sendiri. Tutor melihat halaman ini tanpa pilihan ini.
  const accountSection = actor.role === 'guardian' ? <MarketingPreference initial={(await marketingPreference(actor)).optIn} setMarketing={setMarketingAction} /> : null
  if (!privacy) {
    return (
      <FamilyShell shell={shell} active="privacy">
        <h1 className="m-0 text-h2 font-bold">Privasi dan data</h1>
        <p role="status" className="m-0 rounded-card bg-surface shadow-soft p-4 text-body">
          Akun ini belum tertaut ke anak mana pun, jadi belum ada persetujuan yang bisa diatur. Minta tutor mengirim undangan yang menyertakan nama anak.
        </p>
        {accountSection}
      </FamilyShell>
    )
  }
  // Kunci per learner: galat dan kode referensi dari learner sebelumnya tidak terbawa.
  return (
    <PrivacyScreen
      key={privacy.learner.id}
      data={privacy}
      accountSection={accountSection}
      actions={{ setConsent: setConsentAction, exportData: exportDataAction, requestDeletion: requestDeletionAction, cancelDeletion: cancelDeletionAction }}
    />
  )
}
