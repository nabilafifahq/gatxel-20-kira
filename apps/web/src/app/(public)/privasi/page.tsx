import type { Metadata } from 'next'
import { PrivacyNoticePage } from '@/screens/public/PrivacyNoticePage'
import { privacyNoticeData } from '@/server/legal'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Kebijakan Privasi' }

export default function PrivacyPage() {
  return <PrivacyNoticePage data={privacyNoticeData()} />
}
