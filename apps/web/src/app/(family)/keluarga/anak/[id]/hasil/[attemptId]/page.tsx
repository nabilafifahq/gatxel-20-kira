import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { ParentResultScreen } from '@/screens/family/ParentResultScreen'
import { FamilyShell } from '@/components/family/FamilyShell'
import { pageActor } from '@/server/auth/actor'
import { consoleShell } from '@/server/dal/console-shell'
import { parentResultDTO } from '@/server/dal/parent'
import { load } from '@/server/page'

export const metadata: Metadata = { title: 'Hasil sesi' }

/** Hasil per soal: pertanyaan, jawaban anak, jawaban benar, dan penjelasan. Hanya setelah sesi dikumpulkan. */
export default async function ParentResultPage({ params }: { params: Promise<{ id: string; attemptId: string }> }) {
  const { id, attemptId } = await params
  const uuid = z.string().uuid()
  if (!uuid.safeParse(id).success || !uuid.safeParse(attemptId).success) notFound()
  const actor = await pageActor(['guardian'], `/keluarga/anak/${id}/hasil/${attemptId}`)
  const [{ shell }, data] = await Promise.all([load(() => consoleShell(actor, id)), load(() => parentResultDTO(actor, id, attemptId))])
  return (
    <FamilyShell shell={shell} active="home" learnerName={data.learner.name}>
      <ParentResultScreen data={data} />
    </FamilyShell>
  )
}
