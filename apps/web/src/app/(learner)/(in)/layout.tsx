import { LearnerRuntime } from '@/components/runtime/LearnerRuntime'
import { TtsRuntime } from '@/components/runtime/TtsRuntime'
import { SoundRuntime } from '@/components/learner/SoundRuntime'
import { PageTransition } from '@/components/learner/PageTransition'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { inOrg } from '@/server/db'
import { soundPolicyOf } from '@/server/dal/learner-motion'

/** Semua layar learner yang butuh sesi anak. */
export default async function LearnerInLayout({ children }: { children: React.ReactNode }) {
  const actor = await pageActor(['learner'])
  // Pilihan suara dan musik dari tutor mengalahkan pilihan perangkat.
  const policy = await inOrg(orgCtx(actor), (tx) => soundPolicyOf(tx, actor.userId)).catch(() => ({ sfx: true, music: true }))
  return (
    <>
      <PageTransition>{children}</PageTransition>
      <LearnerRuntime screenLimitMin={60} />
      <TtsRuntime />
      <SoundRuntime sfx={policy.sfx} music={policy.music} />
    </>
  )
}
