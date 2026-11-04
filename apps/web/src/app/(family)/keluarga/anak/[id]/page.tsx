import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { ParentChildClient } from '@/screens/family/ParentChildClient'
import { pageActor } from '@/server/auth/actor'
import { consoleShell } from '@/server/dal/console-shell'
import { parentChildDTO } from '@/server/dal/parent'
import { load } from '@/server/page'

export const metadata: Metadata = { title: 'Anak saya' }

/** Satu anak untuk orang tua. Anak yang tidak tertaut ke akun ini menjadi 404. */
export default async function ParentChildPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) notFound()
  const actor = await pageActor(['guardian'], `/keluarga/anak/${id}`)
  const [{ shell }, data] = await Promise.all([load(() => consoleShell(actor, id)), load(() => parentChildDTO(actor, id))])
  return <ParentChildClient shell={shell} data={data} />
}
