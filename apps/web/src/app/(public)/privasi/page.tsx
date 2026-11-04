import type { Metadata } from 'next'
import { PrivacyNoticePage } from '@/screens/public/PrivacyNoticePage'
import { privacyNoticeData } from '@/server/legal'
import { siteAccount } from '@/server/site-account'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Kebijakan Privasi' }

export default async function PrivacyPage() {
  return <PrivacyNoticePage data={privacyNoticeData()} account={await siteAccount()} />
}
