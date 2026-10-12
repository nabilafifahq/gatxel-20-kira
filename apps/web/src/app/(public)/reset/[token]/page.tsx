import type { Metadata } from 'next'
import { ResetPasswordScreen } from '@/screens/public/ResetPasswordScreen'
import { resetTokenValid } from '@/server/auth/accounts'
import { resetPasswordAction } from '@/server/actions/auth'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Atur ulang password', referrer: 'no-referrer' }

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const valid = /^[A-Za-z0-9_-]{30,100}$/.test(token) && (await resetTokenValid(token))
  return <ResetPasswordScreen token={token} valid={valid} resetPassword={resetPasswordAction} />
}
