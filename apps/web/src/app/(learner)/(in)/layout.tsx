import { LearnerRuntime } from '@/components/runtime/LearnerRuntime'
import { TtsRuntime } from '@/components/runtime/TtsRuntime'
import { pageActor } from '@/server/auth/actor'

/** Semua layar learner yang butuh sesi anak. */
export default async function LearnerInLayout({ children }: { children: React.ReactNode }) {
  await pageActor(['learner'])
  return (
    <>
      {children}
      <LearnerRuntime screenLimitMin={60} />
      <TtsRuntime />
    </>
  )
}
