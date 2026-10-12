import type { Metadata } from 'next'
import { AcceptInviteScreen } from '@/screens/public/AcceptInviteScreen'
import { findInvite } from '@/server/auth/accounts'
import { learnerNames, orgNameFor } from '@/server/dal/learner-entry'
import { acceptInviteAction } from '@/server/actions/auth'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Undangan', referrer: 'no-referrer' }

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const inv = /^[A-Za-z0-9_-]{30,100}$/.test(token) ? await findInvite(token) : null
  const invite = inv
    ? {
        orgName: await orgNameFor(inv.orgId),
        email: inv.email,
        role: inv.role,
        learnerNames: (await learnerNames(inv.orgId, inv.learnerIds)).map((l) => l.name),
        expiresAt: inv.expiresAt.toISOString(),
      }
    : null
  return <AcceptInviteScreen token={token} invite={invite} acceptInvite={acceptInviteAction} />
}
