import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { z } from 'zod'
import { RunnerClient } from '@/components/runtime/RunnerClient'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { runnerDTO } from '@/server/dal/learner-runner'
import { load } from '@/server/page'

export const dynamic = 'force-dynamic'

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await pageActor(['learner'])
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) notFound()
  // Service worker menyimpan halaman ini untuk offline (x-kira-precache) dan router bisa prefetch:
  // keduanya bukan pembukaan oleh learner. Untuk attempt berwaktu runnerDTO tetap memulai jam.
  const h = await headers()
  const markOpened = h.get('x-kira-precache') !== '1' && !h.has('next-router-prefetch')
  const data = await load(() => inOrg(orgCtx(actor), (tx) => runnerDTO(tx, actor.userId, id, { markOpened })))
  if ('submitted' in data) redirect(`/results/${id}`)
  return <RunnerClient data={data} />
}
