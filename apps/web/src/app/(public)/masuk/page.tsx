import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { LoginClient } from '@/components/auth/LoginClient'
import { getActor, homeFor, safeNext } from '@/server/auth/actor'
import { orgCount } from '@/server/auth/accounts'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Masuk' }

const NOTICES = ['locked', 'reset-done', 'signed-out', 'session-expired', 'invite-accepted'] as const

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; notice?: string }> }) {
  const { next, notice } = await searchParams
  const actor = await getActor()
  if (actor) redirect(safeNext(next, homeFor(actor.role)))
  if ((await orgCount()) === 0) redirect('/setup')
  const n = (NOTICES as readonly string[]).includes(notice ?? '') ? (notice as (typeof NOTICES)[number]) : null
  return <LoginClient next={next ? safeNext(next, '/') : null} notice={n} />
}
