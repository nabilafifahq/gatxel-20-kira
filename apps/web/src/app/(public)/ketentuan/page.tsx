import type { Metadata } from 'next'
import { TermsPage } from '@/screens/public/TermsPage'
import { termsData } from '@/server/legal'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Syarat dan Ketentuan' }

export default function KetentuanPage() {
  return <TermsPage data={termsData()} />
}
