import type { Metadata } from 'next'
import { LearnersScreen } from '@/screens/console/LearnersScreen'
import { pageActor } from '@/server/auth/actor'
import { learnersDTO } from '@/server/dal/console-learners'
import { load } from '@/server/page'
import { addLearnerAction, recordOfflineConsentAction, resetPinAction, unlockLearnerAction, updateLearnerAction } from '@/server/actions/console-learners'

export const metadata: Metadata = { title: 'Learner dan grade' }

/** T13 Learner dan grade: daftar learner, tambah, ubah, PIN, dan persetujuan offline. */
export default async function LearnersPage() {
  const actor = await pageActor(['tutor'], '/konsol/learner')
  const data = await load(() => learnersDTO(actor))
  return (
    <LearnersScreen
      data={data}
      actions={{
        addLearner: addLearnerAction,
        updateLearner: updateLearnerAction,
        resetPin: resetPinAction,
        unlockLearner: unlockLearnerAction,
        recordOfflineConsent: recordOfflineConsentAction,
      }}
    />
  )
}
