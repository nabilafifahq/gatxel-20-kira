import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { SetupScreen } from '@/screens/public/SetupScreen'
import { orgCount } from '@/server/auth/accounts'
import { createOrgAction } from '@/server/actions/auth'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Siapkan Kira' }

export default async function SetupPage() {
  if ((await orgCount()) > 0) redirect('/masuk')
  return <SetupScreen createOrg={createOrgAction} />
}
