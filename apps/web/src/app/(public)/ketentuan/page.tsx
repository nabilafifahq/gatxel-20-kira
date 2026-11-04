import type { Metadata } from 'next'
import { TermsPage } from '@/screens/public/TermsPage'
import { termsData } from '@/server/legal'
import { siteAccount } from '@/server/site-account'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Syarat dan Ketentuan' }

export default async function KetentuanPage() {
  return <TermsPage data={termsData()} account={await siteAccount()} />
}
